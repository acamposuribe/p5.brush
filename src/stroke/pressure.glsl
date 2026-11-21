// Brush pressure at step j of a record's `count`, at distance c from the
// stroke's start and s from the piece's origin (see gauss() and simPressure()
// in stroke.js).
//   press = (from, to, model, table row): model 0 is a linear ramp across the
//           record, 1 the default bump and 2 a custom curve, mapped from → to
//   shape = bump (peak, half-width before, after, exponent) or custom curve
//           (warp, scale, offset, tilt)
//   plot  = (plot pressure at the origin, its change per unit, stroke length, -)
float strokePressure(vec4 press, vec4 shape, vec4 plot, float j, float count, float c, float s, sampler2D table) {
    if (press.z == 0.0) return mix(press.x, press.y, j / count);
    float v;
    if (press.z == 1.0) {
        float d = c - shape.x;
        float halfWidth = d < 0.0 ? shape.y : shape.z;
        v = 1.0 / (1.0 + pow(max(abs(d / halfWidth), 1e-20), shape.w));
    } else {
        float t = c / plot.z;
        float x = clamp(0.5 + (t - 0.5 + shape.x) * shape.y, 0.0, 1.0) * 256.0;
        int i = min(int(x), 255);
        int row = int(press.w);
        float curve = mix(
            texelFetch(table, ivec2(i, row), 0).r,
            texelFetch(table, ivec2(i + 1, row), 0).r,
            x - float(i)
        );
        v = curve + shape.z + shape.w * (t - 0.5);
    }
    float p = mix(press.x, press.y, v);
    if (press.z == 2.0) p = clamp(p, min(press.x, press.y), max(press.x, press.y));
    return p * (plot.x + plot.y * s);
}

#pragma glslify: export(strokePressure)
