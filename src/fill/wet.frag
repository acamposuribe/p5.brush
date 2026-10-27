#version 300 es

// Stamps a watercolour fill into the wetness buffer after its composite: where
// the fill's blurred silhouette (src/fill/blur.frag, channel b) is inside, the
// paper is left wet by this fill. Stores (wetness, wetness · fill index):
// filtered reads then still give the index exactly, as g / r. The composite
// dries it by the number of fills since (see watercolor() in shader.frag).

precision highp float;

uniform sampler2D u_blur;
uniform vec2 u_dstSize;
uniform float u_level; // silhouette edge level
uniform vec2 u_wet;    // (wetness 0..1, fill index)

out vec4 outColor;

void main() {
    float inside = smoothstep(0.3 * u_level, 1.3 * u_level, texture(u_blur, gl_FragCoord.xy / u_dstSize).b);
    if (inside < 0.3) discard;
    float wetness = u_wet.x * inside;
    outColor = vec4(wetness, wetness * u_wet.y, 0.0, 1.0);
}
