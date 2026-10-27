#version 300 es

// Expands queued path segments into textured stamps (image and custom tip
// brushes). Draws a 4-vertex triangle strip per stamp; instances enumerate
// segments × steps, with segment attributes advancing every u_substeps
// instances (attribute divisor), so step = gl_InstanceID % u_substeps.

in vec2 a_start;     // segment start, position space (logical px)
in vec2 a_end;       // segment end, after a_info.x steps
in vec2 a_pressure;  // pressure at segment start and end
in vec4 a_info;      // (step count, stroke alpha 0..255, segment index, natural angle in radians)
in uint a_seed;      // per-stroke seed

uniform mat4 u_proj;
uniform mat2 u_tipLinear;  // ma, mb, mc, md
uniform vec2 u_translate;  // mx, my
uniform vec2 u_half;       // Cwidth / 2, Cheight / 2
uniform int u_substeps;
uniform int u_rotate;      // 0 none, 1 random, 2 natural
uniform vec2 u_brush;      // weight, scatter
uniform float u_strokeWeight;

out vec2  v_uv;
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

void main() {
    int step = gl_InstanceID % u_substeps;
    float count = a_info.x;
    float t = float(step) / count;
    float p = mix(a_pressure.x, a_pressure.y, t);
    float size = u_brush.x * u_strokeWeight * p;
    if (float(step) >= count || size <= 0.0) {
        gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        v_uv = vec2(0.0);
        v_alpha = 0.0;
        v_pressure = 0.0;
        return;
    }

    uint s = pcg(a_seed ^ pcg(uint(a_info.z) * 64u + uint(step)));
    float vibration = u_strokeWeight * u_brush.y;
    vec2 offset = vibration * vec2(rand(s) * 2.0 - 1.0, rand(s) * 2.0 - 1.0);
    float angle = u_rotate == 1 ? floor(rand(s) * 360.0) * 0.017453292519943295
                : u_rotate == 2 ? a_info.w
                : 0.0;
    float alpha = a_info.y * max(0.8, p) * (0.9 + 0.2 * rand(s));

    vec2 local = mix(a_start, a_end, t) + offset - u_half;
    vec2 centre = u_tipLinear * local + u_translate + u_half;

    // Triangle-strip corners: (-1,-1), (1,-1), (-1,1), (1,1).
    vec2 corner = vec2(float(gl_VertexID & 1) * 2.0 - 1.0, float(gl_VertexID >> 1) * 2.0 - 1.0);
    float c = cos(angle), sn = sin(angle);
    vec2 rotated = vec2(c * corner.x - sn * corner.y, sn * corner.x + c * corner.y);
    gl_Position = u_proj * vec4(centre + u_tipLinear * (rotated * size * 0.5), 0.0, 1.0);
    // Map corner [-1,1] → uv [0,1]; the projection already has Y increasing downward.
    v_uv = corner * 0.5 + 0.5;
    v_alpha = alpha / 255.0;
    v_pressure = p;
}
