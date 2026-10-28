// Smooth value noise in [0, 1] on an integer lattice, hashed with PCG.
// Used by watercolour fills and their paper height.
//
// No `u`-suffixed literals: glslify renames the `u` of `123u` in modules
// required from other modules. uint(int) keeps the bit pattern, so
// uint(-1403630843) is 2891336453u.

uint paperPcg(uint v) {
    uint state = v * uint(747796405) + uint(-1403630843);
    uint word = ((state >> ((state >> 28) + uint(4))) ^ state) * uint(277803737);
    return (word >> 22) ^ word;
}

float paperCell(ivec2 c, uint seed) {
    return float(paperPcg(uint(c.x) * uint(1597334677) ^ paperPcg(uint(c.y) ^ seed)) >> 8) * (1.0 / 16777216.0);
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

#pragma glslify: export(paperNoise)
