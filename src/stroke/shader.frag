#version 300 es
precision highp float;

in float v_alpha;
out vec4 outColor;

uniform vec4 u_color;

void main() {
    // Point coordinate centered around (0.0, 0.0)
    vec2 v = gl_PointCoord - vec2(0.5);

    // Distance from center
    float f = length(v);

    // Antialiasing factor
    float a = fwidth(f);

    // Soft circular mask (1.0 at center, 0.0 outside radius ~0.5)
    f = 1.0 - smoothstep(0.5 - a, 0.5 + a, f);

    // Discard nearly transparent fragments
    if (f < 0.01) {
        discard;
    }

    // Red color tinted by v_alpha, with smooth edge by f
    outColor = vec4(u_color.xyz, v_alpha * f);
}