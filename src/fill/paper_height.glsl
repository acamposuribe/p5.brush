// Paper height: a fixed height map in canvas space that watercolour fills
// granulate on and whose valleys roughen their edges.

#pragma glslify: paperNoise = require(../core/gl/value_noise.glsl)

// Paper height in [0, 1] at a canvas position given in grain units.
float paperHeight(vec2 q, uint seed) {
    float h = 0.55 * paperNoise(q, seed)                                    // tooth
            + 0.25 * paperNoise(q * 2.1 + 31.7, seed + uint(1))                  // finer tooth
            + 0.20 * paperNoise(mat2(0.94, 0.34, -0.34, 0.94) * q * vec2(0.18, 1.6) + 7.3, seed + uint(2)); // fibres
    return clamp((h - 0.5) * 2.2 + 0.5, 0.0, 1.0);
}

#pragma glslify: export(paperHeight)
