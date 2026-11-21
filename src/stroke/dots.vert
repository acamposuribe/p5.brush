#version 300 es

// Expands stroke records into brush dots (default, spray and marker
// brushes). A record covers up to 1024 fine steps of one piece of a stroke's
// path: a straight run or an arc (path.glsl), or a short straight segment of
// a stroke the CPU walked through a flow field. One instance per record; its
// vertices enumerate the fine steps, and for spray the dots in each step,
// each dot once:
//   vertex = dot * u_groupSteps + slot,  step = slot * u_stride mod u_groupSteps
// Steps as vertices keep a long record's dots in the same GPU batches. The
// stride scatters the order the steps are drawn in, so consecutive dots
// rarely cover the same pixels and their blending need not wait on each
// other (see scatterStride() in gl_draw.js).
//
// Each step reproduces the brush's tip model: a grain test and gaussian
// vibration for default brushes, a cloud of dots for spray, and a single
// jittered dot for markers. Randomness is a hash of (stroke seed, step, dot),
// so output does not depend on how strokes are batched.

// The record (see its layout in gl_draw.js), in position space (logical px).
in vec4 a_path;      // piece origin xy, heading as a unit vector (path.glsl)
in vec4 a_steps;     // first step's distance from the origin, step length, step count, first step's distance from the stroke start
in vec4 a_press;     // pressure model (pressure.glsl)
in vec4 a_shape;     // pressure curve shape (pressure.glsl)
in vec4 a_plot;      // plot pressure at the origin and per unit, stroke length, stroke alpha 0..255
in vec4 a_misc;      // first step's hash index, turn per unit (path.glsl), natural tip angle at the origin, stroke weight
in vec2 a_disp;      // dispersion's direction relative to the heading, as a unit vector
in uint a_seed;      // per-stroke seed
in vec4 a_brush;     // brush weight, scatter, sharpness, grain (per record, so brushes share a batch)

uniform mat4 u_matrix;
uniform vec4 u_affine;     // ma, mb, mc, md
uniform vec2 u_translate;  // mx, my
uniform vec2 u_half;       // Cwidth / 2, Cheight / 2
uniform float u_sizeScale; // density * transform scale
uniform float u_density;
uniform int u_type;        // 0 default, 1 spray, 2 marker
uniform int u_perStep;     // dots per step (spray dot capacity, else 1)
uniform int u_groupSteps;  // steps drawn per record in this draw (its group's)
uniform int u_stride;      // scatters the order of the steps (see above)
uniform vec3 u_nib;        // markers: flat nib (cos, sin of its angle, thickness); thickness 1 is round
uniform sampler2D u_pressureTable; // custom pressure curves (pressure.glsl)

out float v_alpha;
out float v_rest;    // 1 for a marker's resting nib (its zero-length end caps)
out vec2 v_dir;      // travel direction in drawing space, for the paper specks
flat out uint v_seed; // per dot, for rounding a marker's extra ink

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
    v_rest = 0.0;
    v_seed = 0u;
}

#pragma glslify: pathAt = require(./path.glsl)
#pragma glslify: strokePressure = require(./pressure.glsl)

void main() {
    int slot = gl_VertexID % u_groupSteps;
    int dot = gl_VertexID / u_groupSteps;
    int step = slot * u_stride % u_groupSteps;
    float j = float(step);
    float count = a_steps.z;
    if (j >= count) { cull(); return; }
    float along = a_steps.x + j * a_steps.y;  // from the piece's origin
    float fromStart = a_steps.w + j * a_steps.y;
    float p = strokePressure(a_press, a_shape, a_plot, j, count, fromStart, along, u_pressureTable);
    if (p <= 0.0) { cull(); return; }
    vec2 heading;
    vec2 point = pathAt(a_path, a_misc.y, along, heading);
    // The direction dots disperse across (y up): the heading turned by a_disp.
    vec2 dir = vec2(heading.x * a_disp.x - heading.y * a_disp.y, heading.y * a_disp.x + heading.x * a_disp.y);

    float weight = a_brush.x, scatter = a_brush.y, sharpness = a_brush.z, grain = a_brush.w;
    float sw = a_misc.w;
    float alpha = a_plot.w;
    uint s = pcg(a_seed ^ pcg(uint(a_misc.x) + uint(step)));
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
        // A flat nib jitters along its edge, hardly across it, or its thin
        // stamps would show as parallel lines.
        vec2 axis = u_nib.xy;
        vec2 across = vec2(-axis.y, axis.x);
        // (no dot(): this shader has a variable of that name)
        offset = axis * (offset.x * axis.x + offset.y * axis.y)
               + across * (offset.x * across.x + offset.y * across.y) * u_nib.z;
        diameter = sw * weight * p;
        alpha *= max(0.8, p) * (0.9 + 0.2 * rand(s));
    } else {
        // Default: grain test, then a dot dispersed across/along the stroke.
        if (rand(s) >= grain * p) { cull(); return; }
        float vibration = sw * scatter * (sharpness + (1.0 - sharpness) * gauss(s) / p);
        float perp = vibration * (rand(s) * 2.0 - 1.0);
        float lengthwise = 0.3 * vibration * (rand(s) * 2.0 - 1.0);
        offset = vec2(perp * dir.y + lengthwise * dir.x, perp * dir.x - lengthwise * dir.y);
        diameter = p * p * weight * (0.85 + 0.3 * rand(s)) * sw;
        alpha *= max(0.9, p) * (0.75 + 0.35 * rand(s));
    }
    if (diameter <= 0.0) { cull(); return; }

    vec2 local = point + offset - u_half;
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
    v_rest = (u_type == 2 && a_steps.y == 0.0) ? 1.0 : 0.0;
    v_seed = pcg(s ^ 0x9e3779b9u);
    vec2 travel = vec2(dir.x, -dir.y);
    v_dir = normalize(travel + 1e-6);
}
