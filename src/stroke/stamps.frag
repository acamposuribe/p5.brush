#version 300 es
precision highp float;

in vec2  v_uv;
in float v_alpha;
in float v_pressure;

uniform sampler2D u_tex;    // preprocessed brush-tip (white RGB, ink density in alpha)
uniform vec4      u_color;  // stroke colour (same channel layout as the circle shader)

out vec4 outColor;

// Paper: (contact strength 0..1, grain size in logical px, pixel density, seed)
uniform vec4 u_paper;

#pragma glslify: paperContact = require(./paper.glsl)

uniform bool u_clipEnabled;
uniform mat3 u_clipMatrix;
uniform vec4 u_clipBounds;

void main() {
    if (u_clipEnabled) {
        vec2 p = (u_clipMatrix * vec3(gl_FragCoord.xy, 1.0)).xy;
        if (p.x < u_clipBounds.x || p.y < u_clipBounds.y ||
            p.x > u_clipBounds.z || p.y > u_clipBounds.w) discard;
    }
    float inkAlpha = texture(u_tex, v_uv).a;
    if (inkAlpha < 0.01) discard;
    outColor = vec4(u_color.rgb, inkAlpha * v_alpha * paperContact(u_paper, gl_FragCoord.xy, v_pressure));
}
