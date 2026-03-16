#version 300 es
precision highp float;

in vec2  v_uv;
in float v_alpha;

uniform sampler2D u_tex;    // preprocessed brush-tip (white RGB, ink density in alpha)
uniform vec4      u_color;  // stroke colour (same channel layout as the circle shader)

out vec4 outColor;

void main() {
    float inkAlpha = texture(u_tex, v_uv).a;
    if (inkAlpha < 0.01) discard;
    outColor = vec4(u_color.rgb, inkAlpha * v_alpha);
}
