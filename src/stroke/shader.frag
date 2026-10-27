#version 300 es
precision highp float;

in float v_alpha;
out vec4 outColor;

uniform vec4 u_color;
uniform bool u_affineCircle;
uniform mat2 u_tipInverse;

uniform bool u_clipEnabled;
uniform mat3 u_clipMatrix;
uniform vec4 u_clipBounds;

void main() {
    if (u_clipEnabled) {
        vec2 p = (u_clipMatrix * vec3(gl_FragCoord.xy, 1.0)).xy;
        if (p.x < u_clipBounds.x || p.y < u_clipBounds.y ||
            p.x > u_clipBounds.z || p.y > u_clipBounds.w) discard;
    }
    // Point coordinate centered around (0.0, 0.0)
    vec2 v = gl_PointCoord - vec2(0.5);
    if (u_affineCircle) v = u_tipInverse * vec2(v.x, -v.y);

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