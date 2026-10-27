#version 300 es

// Expands queued path segments into brush dots (default, spray and marker
// brushes). One vertex per segment; instances enumerate the segment's fine
// steps (and, for spray, the dots within each step):
//   instance = step * u_perStep + dot
//
// Each step reproduces the brush's tip model: a grain test and gaussian
// vibration for default brushes, a cloud of dots for spray, and a single
// jittered dot for markers. Randomness is a hash of (stroke seed, segment,
// step, dot), so output does not depend on how strokes are batched.

in vec2 a_start;     // segment start, position space (logical px)
in vec2 a_end;       // segment end, after a_info.x steps
in vec2 a_dir;       // (cos, sin) of the travel direction, for dispersion
in vec2 a_pressure;  // pressure at segment start and end
in vec4 a_info;      // (step count, stroke alpha 0..255, segment index, unused)
in uint a_seed;      // per-stroke seed

uniform mat4 u_matrix;
uniform vec4 u_affine;     // ma, mb, mc, md
uniform vec2 u_translate;  // mx, my
uniform vec2 u_half;       // Cwidth / 2, Cheight / 2
uniform float u_sizeScale; // density * transform scale
uniform float u_density;
uniform int u_type;        // 0 default, 1 spray, 2 marker
uniform int u_perStep;     // instances per step (spray dot capacity, else 1)
uniform vec4 u_brush;      // weight, scatter, sharpness, grain
uniform float u_strokeWeight;

out float v_alpha;
out float v_pressure;

uint pcg(uint v) {
    uint state = v * 747796405u + 2891336453u;
    uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
    return (word >> 22u) ^ word;
}

float rand(inout uint s) {
    s = pcg(s);
    return float(s >> 8u) * (1.0 / 16777216.0);
}

// Box-Muller: mean 0, stdev 1.
float gauss(inout uint s) {
    float u1 = 1.0 - rand(s);
    float u2 = rand(s);
    return sqrt(-2.0 * log(u1)) * cos(6.283185307179586 * u2);
}

void cull() {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    v_alpha = 0.0;
    v_pressure = 0.0;
}

void main() {
    int step = gl_InstanceID / u_perStep;
    int dot = gl_InstanceID - step * u_perStep;
    float count = a_info.x;
    float t = float(step) / count;
    float p = mix(a_pressure.x, a_pressure.y, t);
    if (float(step) >= count || p <= 0.0) { cull(); return; }

    float weight = u_brush.x, scatter = u_brush.y, sharpness = u_brush.z, grain = u_brush.w;
    float sw = u_strokeWeight;
    float alpha = a_info.y;
    uint s = pcg(a_seed ^ pcg(uint(a_info.z) * 64u + uint(step)));
    vec2 offset;
    float diameter;

    if (u_type == 1) {
        // Spray: ceil(grain / p) dots scattered in a disc around the step.
        if (float(dot) >= ceil(grain / p)) { cull(); return; }
        float vibration = sw * scatter * p + sw * gauss(s) * scatter / 3.0;
        diameter = weight * (0.9 + 0.2 * rand(s));
        uint d = pcg(s ^ (uint(dot) * 2654435769u + 1u));
        float r = (0.9 + 0.2 * rand(d)) * vibration;
        float rx = r * (rand(d) * 2.0 - 1.0);
        float ry = (rand(d) * 2.0 - 1.0) * sqrt(max(0.0, r * r - rx * rx));
        offset = vec2(rx, ry);
    } else if (u_type == 2) {
        // Marker: one jittered dot per step.
        float vibration = sw * scatter;
        offset = vibration * vec2(rand(s) * 2.0 - 1.0, rand(s) * 2.0 - 1.0);
        diameter = sw * weight * p;
        alpha *= max(0.8, p) * (0.9 + 0.2 * rand(s));
    } else {
        // Default: grain test, then a dot dispersed across/along the stroke.
        if (rand(s) >= grain * p) { cull(); return; }
        float vibration = sw * scatter * (sharpness + (1.0 - sharpness) * gauss(s) / p);
        float perp = vibration * (rand(s) * 2.0 - 1.0);
        float along = 0.3 * vibration * (rand(s) * 2.0 - 1.0);
        offset = vec2(perp * a_dir.y + along * a_dir.x, perp * a_dir.x - along * a_dir.y);
        diameter = p * p * weight * (0.85 + 0.3 * rand(s)) * sw;
        alpha *= max(0.9, p) * (0.75 + 0.35 * rand(s));
    }
    if (diameter <= 0.0) { cull(); return; }

    vec2 local = mix(a_start, a_end, t) + offset - u_half;
    vec2 screen = vec2(
        u_affine.x * local.x + u_affine.z * local.y,
        u_affine.y * local.x + u_affine.w * local.y
    ) + u_translate + u_half;

    // Dots smaller than 0.5 logical px (one device px at the reference
    // density 2) keep that footprint at every density, and points are never
    // rasterised below one device px; alpha scales by footprint / raster area
    // so the ink per logical area does not depend on pixel density.
    float footprint = max(u_sizeScale * diameter, 0.5 * u_density);
    float raster = max(footprint, 1.0);
    gl_Position = u_matrix * vec4(screen, 0.0, 1.0);
    gl_PointSize = raster;
    v_alpha = alpha / 255.0 * (footprint * footprint) / (raster * raster);
    v_pressure = p;
}
