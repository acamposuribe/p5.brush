#version 300 es

precision highp float;

in vec2 v_pos;
flat in vec2 v_start;
flat in vec2 v_end;
flat in vec3 v_info; // radius in device pixels, paint weight, erase weight

uniform float u_pixel; // device pixels per user unit

out vec4 outColor;

void main() {
    vec2 pa = v_pos - v_start;
    vec2 ba = v_end - v_start;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-12), 0.0, 1.0);
    // Coverage of a one-pixel footprint by the capsule edge.
    float coverage = clamp(v_info.x - length(pa - ba * h) * u_pixel + 0.5, 0.0, 1.0);
    if (coverage <= 0.0) discard;
    outColor = vec4(v_info.y, v_info.z, 0.0, 0.0) * coverage;
}
