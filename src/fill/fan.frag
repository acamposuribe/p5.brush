#version 300 es

precision highp float;

uniform float u_weight; // log-domain paint of the polygon being covered

out vec4 outColor;

void main() {
    outColor = vec4(u_weight, 0.0, 0.0, 0.0);
}
