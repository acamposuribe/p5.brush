#version 300 es
precision highp float;

in float v_alpha;
in float v_pressure;
out vec4 outColor;

// Paper: (contact strength 0..1, grain size in logical px, pixel density, seed)
uniform vec4 u_paper;

uniform vec4 u_color;
uniform bool u_affineCircle;
uniform mat2 u_tipInverse;

uniform bool u_clipEnabled;
uniform mat3 u_clipMatrix;
uniform vec4 u_clipBounds;

// ---------------------------------------------------------------------------
// Paper tooth: a fixed height map in canvas space shared by every stroke.
// ---------------------------------------------------------------------------

uint pcg(uint v) {
    uint state = v * 747796405u + 2891336453u;
    uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
    return (word >> 22u) ^ word;
}

float cellHash(ivec2 c, uint seed) {
    return float(pcg(uint(c.x) * 1597334677u ^ pcg(uint(c.y) ^ seed)) >> 8u) * (1.0 / 16777216.0);
}

float valueNoise(vec2 p, uint seed) {
    ivec2 i = ivec2(floor(p));
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(cellHash(i, seed), cellHash(i + ivec2(1, 0), seed), f.x),
        mix(cellHash(i + ivec2(0, 1), seed), cellHash(i + ivec2(1, 1), seed), f.x),
        f.y);
}

// Paper height in [0, 1] at a canvas position given in grain units.
float paperHeight(vec2 q, uint seed) {
    float h = 0.55 * valueNoise(q, seed)                                    // tooth
            + 0.25 * valueNoise(q * 2.1 + 31.7, seed + 1u)                  // finer tooth
            + 0.20 * valueNoise(mat2(0.94, 0.34, -0.34, 0.94) * q * vec2(0.18, 1.6) + 7.3, seed + 2u); // fibres
    return clamp((h - 0.5) * 2.2 + 0.5, 0.0, 1.0);
}

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

    // Paper contact: a dot only deposits where the paper rises above a level
    // set by its pressure — light pressure catches only the hilltops.
    float contact = 1.0;
    if (u_paper.x > 0.0) {
        vec2 q = gl_FragCoord.xy / (u_paper.z * u_paper.y);
        float h = paperHeight(q, uint(u_paper.w));
        float level = 0.95 - 0.45 * v_pressure;
        contact = mix(1.0, smoothstep(level - 0.25, level + 0.25, h), u_paper.x);
    }

    outColor = vec4(u_color.xyz, v_alpha * f * contact);
}