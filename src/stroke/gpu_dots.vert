#version 300 es

// EXPERIMENTAL: GPU dot generation for default-type brushes.
//
// One vertex per path segment of up to u_substeps fine steps; one instance
// per fine step. Segments vary in length (a_pressure.y steps each). Each vertex reproduces drawDefault() from stroke.js: a grain test,
// a gaussian vibration, perpendicular/along dispersion, and randomised
// diameter and alpha. Randomness comes from a hash of (stroke seed,
// segment, step) instead of the CPU random stream.

in vec2 a_start;     // segment start, position space (logical px)
in vec2 a_end;       // segment end, after a_pressure.y steps
in vec2 a_dir;       // (cos, sin) used for dispersion
in vec2 a_pressure;  // (pressure, active step count)
in vec2 a_stroke;    // (stroke alpha 0..255, segment index within stroke)
in uint a_seed;      // per-stroke seed
in float a_pressureEnd; // pressure at segment end (interpolated along it)

uniform mat4 u_matrix;
uniform vec4 u_affine;     // ma, mb, mc, md
uniform vec2 u_translate;  // mx, my
uniform vec2 u_half;       // Cwidth / 2, Cheight / 2
uniform float u_sizeScale; // density * transform scale
// weight, scatter, sharpness, grain (brush params)
uniform vec4 u_brush;
uniform float u_strokeWeight;

out float v_alpha;

uint pcg(uint v) {
    uint state = v * 747796405u + 2891336453u;
    uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
    return (word >> 22u) ^ word;
}

float rand(inout uint s) {
    s = pcg(s);
    return float(s >> 8u) * (1.0 / 16777216.0);
}

void cull() {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    v_alpha = 0.0;
}

void main() {
    float step = float(gl_InstanceID);
    float t = step / a_pressure.y;
    float p = mix(a_pressure.x, a_pressureEnd, t);
    if (step >= a_pressure.y || p <= 0.0) { cull(); return; }

    uint s = pcg(a_seed ^ pcg(uint(a_stroke.y) * 64u + uint(gl_InstanceID)));

    float weight = u_brush.x, scatter = u_brush.y, sharpness = u_brush.z, grain = u_brush.w;
    if (rand(s) >= grain * p) { cull(); return; }

    // Box-Muller, matching the CPU gaussian pool (mean 0, stdev 1).
    float u1 = 1.0 - rand(s);
    float u2 = rand(s);
    float g = sqrt(-2.0 * log(u1)) * cos(6.283185307179586 * u2);

    float vibration = u_strokeWeight * scatter * (sharpness + (1.0 - sharpness) * g / p);
    float perp = vibration * (rand(s) * 2.0 - 1.0);
    float along = 0.3 * vibration * (rand(s) * 2.0 - 1.0);
    vec2 offset = vec2(perp * a_dir.y + along * a_dir.x, perp * a_dir.x - along * a_dir.y);

    vec2 pos = mix(a_start, a_end, t) + offset;
    float diameter = p * p * weight * (0.85 + 0.3 * rand(s)) * u_strokeWeight;
    float alpha = max(0.9, p) * a_stroke.x * (0.75 + 0.35 * rand(s));

    // Same affine mapping as circle() in gl_draw.js.
    vec2 local = pos - u_half;
    vec2 screen = vec2(
        u_affine.x * local.x + u_affine.z * local.y,
        u_affine.y * local.x + u_affine.w * local.y
    ) + u_translate + u_half;

    if (diameter <= 0.0) { cull(); return; }
    gl_Position = u_matrix * vec4(screen, 0.0, 1.0);
    gl_PointSize = u_sizeScale * diameter;
    v_alpha = alpha / 255.0;
}
