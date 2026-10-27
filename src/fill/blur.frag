#version 300 es

// One pass of a separable Gaussian blur of the fill mask, for watercolour
// fills (see watercolor() in core/gl/shader.frag). The first pass reads the
// mask and also marks which texels are inside the silhouette (u_level > 0):
// it outputs (paint · inside, unused, silhouette paint, inside), so that after
// both passes r / a is the mean paint of the inside only, and a is the share
// of the neighbourhood inside the shape.
//
// Two widths in one pass: r and a (paint and share inside, for the rim band
// and the body) use σ; g and b (the silhouette) use σ / u_ratio, so the
// outline stays detailed while the band fades over a wide neighbourhood.

precision highp float;

uniform sampler2D u_src;
uniform vec2 u_dstSize; // destination size in pixels
uniform vec2 u_step;    // uv between taps along the blur axis: σ / 4
uniform float u_ratio;  // σ of r and a over σ of g and b
uniform float u_level;  // silhouette edge level; 0 on the second pass

out vec4 outColor;

const int TAPS = 12; // each side, σ/4 apart: covers 3σ

vec4 tap(vec2 uv) {
    vec4 t = texture(u_src, uv);
    if (u_level <= 0.0) return t;
    float inside = smoothstep(u_level * 0.7, u_level * 1.4, t.b);
    return vec4(t.r * inside, t.g, t.b, inside);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_dstSize;
    vec4 sum = tap(uv);
    vec4 total = vec4(1.0);
    for (int i = 1; i <= TAPS; i++) {
        float x = float(i) / 4.0; // in σ
        float wide = exp(-0.5 * x * x);
        float narrow = exp(-0.5 * x * x * u_ratio * u_ratio);
        vec4 w = vec4(wide, narrow, narrow, wide);
        sum += w * (tap(uv + u_step * float(i)) + tap(uv - u_step * float(i)));
        total += 2.0 * w;
    }
    outColor = sum / total;
}
