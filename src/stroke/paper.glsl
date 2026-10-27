// Paper tooth: a fixed height map in canvas space shared by every stroke.
// paperContact() returns how much of a mark's ink a fragment keeps.

uint paperPcg(uint v) {
    uint state = v * 747796405u + 2891336453u;
    uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
    return (word >> 22u) ^ word;
}

float paperCell(ivec2 c, uint seed) {
    return float(paperPcg(uint(c.x) * 1597334677u ^ paperPcg(uint(c.y) ^ seed)) >> 8u) * (1.0 / 16777216.0);
}

float paperNoise(vec2 p, uint seed) {
    ivec2 i = ivec2(floor(p));
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(paperCell(i, seed), paperCell(i + ivec2(1, 0), seed), f.x),
        mix(paperCell(i + ivec2(0, 1), seed), paperCell(i + ivec2(1, 1), seed), f.x),
        f.y);
}

// Paper height in [0, 1] at a canvas position given in grain units.
float paperHeight(vec2 q, uint seed) {
    float h = 0.55 * paperNoise(q, seed)                                    // tooth
            + 0.25 * paperNoise(q * 2.1 + 31.7, seed + 1u)                  // finer tooth
            + 0.20 * paperNoise(mat2(0.94, 0.34, -0.34, 0.94) * q * vec2(0.18, 1.6) + 7.3, seed + 2u); // fibres
    return clamp((h - 0.5) * 2.2 + 0.5, 0.0, 1.0);
}

// paper: (contact strength 0..1, grain size in logical px, pixel density, seed).
// A mark deposits only where the paper rises above a level set by its
// pressure — light pressure catches only the hilltops.
float paperContact(vec4 paper, vec2 fragCoord, float pressure) {
    if (paper.x <= 0.0) return 1.0;
    float h = paperHeight(fragCoord / (paper.z * paper.y), uint(paper.w));
    float level = 0.95 - 0.45 * pressure;
    return mix(1.0, smoothstep(level - 0.25, level + 0.25, h), paper.x);
}

#pragma glslify: export(paperContact)
