// The value at a lattice point of value_noise.glsl's noise, in [0, 1): what
// paperNoise(c, seed) returns at integer c, at a quarter of the cost. Keep
// the hash identical to value_noise.glsl's.
//
// No `u`-suffixed literals: glslify renames them in nested modules.

uint latticePcg(uint v) {
    uint state = v * uint(747796405) + uint(-1403630843);
    uint word = ((state >> ((state >> 28) + uint(4))) ^ state) * uint(277803737);
    return (word >> 22) ^ word;
}

float latticeHash(vec2 c, uint seed) {
    ivec2 i = ivec2(floor(c));
    return float(latticePcg(uint(i.x) * uint(1597334677) ^ latticePcg(uint(i.y) ^ seed)) >> 8) * (1.0 / 16777216.0);
}

#pragma glslify: export(latticeHash)
