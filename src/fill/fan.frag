#version 300 es

precision highp float;

uniform float u_weight; // log-domain paint of the polygon being covered
uniform float u_shape;  // 1: also paint the silhouette channel (watercolour)

out vec4 outColor;

void main() {
    outColor = vec4(u_weight, 0.0, u_weight * u_shape, 0.0);
}
