// Brush pressure at one fine step of a stroke record (see its layout in
// gl_draw.js and calculatePressure() in stroke.js).
//   press = (from, to, model, table row). Model 0 interpolates from → to
//           across the record. Model 1 is the default bump and model 2 a
//           custom curve, each mapped from → to.
//   shape = the bump's (peak, half-width before it, after it, exponent), or
//           the custom curve's (warp, scale, offset, tilt).
//   plot  = (the plot's own pressure at the piece's origin, its change per
//           unit of length, the stroke's length, -).
//   j is the step within the record, of `count`; c is the step's distance
//   from the stroke's start and s its distance from the piece's origin.
//   table holds the custom curves, 257 samples per row.
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
