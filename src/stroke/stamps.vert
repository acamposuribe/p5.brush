#version 300 es

// Expands stroke records into textured stamps (image and custom tip
// brushes), like dots.vert: one instance per record, two triangles per step:
//   vertex = slot * 6 + corner,  step = slot * u_stride mod u_groupSteps

// The record, in position space (layout in gl_draw.js).
in vec4 a_path;
in vec4 a_steps;
in vec4 a_press;
in vec4 a_shape;
in vec4 a_plot;
in vec4 a_misc;
in uint a_seed;
in vec4 a_brush;

uniform mat4 u_proj;
uniform mat2 u_tipLinear;  // ma, mb, mc, md
uniform vec2 u_translate;  // mx, my
uniform vec2 u_half;       // Cwidth / 2, Cheight / 2
uniform int u_rotate;      // 0 none, 1 random, 2 natural
uniform int u_groupSteps;
uniform int u_stride;
uniform sampler2D u_pressureTable; // custom pressure curves (pressure.glsl)

out vec2  v_uv;
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

#pragma glslify: pathAt = require(./path.glsl)
#pragma glslify: strokePressure = require(./pressure.glsl)

// The two triangles' corners, as indices into (-1,-1), (1,-1), (-1,1), (1,1).
const int CORNERS[6] = int[6](0, 1, 2, 2, 1, 3);

void main() {
    int slot = gl_VertexID / 6;
    int step = slot * u_stride % u_groupSteps;
    float j = float(step);
    float count = a_steps.z;
    float along = a_steps.x + j * a_steps.y;
    float fromStart = a_steps.w + j * a_steps.y;
    float p = j < count
        ? strokePressure(a_press, a_shape, a_plot, j, count, fromStart, along, u_pressureTable)
        : 0.0;
    float size = a_brush.x * a_misc.w * p;
    if (size <= 0.0) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        v_uv = vec2(0.0);
        v_alpha = 0.0;
        return;
    }

    uint s = pcg(a_seed ^ pcg(uint(a_misc.x) + uint(step)));
    float vibration = a_misc.w * a_brush.y;
    vec2 offset = vibration * vec2(rand(s) * 2.0 - 1.0, rand(s) * 2.0 - 1.0);
    float angle = u_rotate == 1 ? floor(rand(s) * 360.0) * 0.017453292519943295
                : u_rotate == 2 ? a_misc.z - a_misc.y * along
                : 0.0;
    float alpha = a_plot.w * max(0.8, p) * (0.9 + 0.2 * rand(s));

    vec2 heading;
    vec2 local = pathAt(a_path, a_misc.y, along, heading) + offset - u_half;
    vec2 centre = u_tipLinear * local + u_translate + u_half;

    int index = CORNERS[gl_VertexID - slot * 6];
    vec2 corner = vec2(float(index & 1) * 2.0 - 1.0, float(index >> 1) * 2.0 - 1.0);
    float c = cos(angle), sn = sin(angle);
    vec2 rotated = vec2(c * corner.x - sn * corner.y, sn * corner.x + c * corner.y);
    gl_Position = u_proj * vec4(centre + u_tipLinear * (rotated * size * 0.5), 0.0, 1.0);
    // Map corner [-1,1] → uv [0,1]; the projection already has Y increasing downward.
    v_uv = corner * 0.5 + 0.5;
    v_alpha = alpha / 255.0;
}
