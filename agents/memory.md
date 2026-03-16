# p5.brush — Agent Session Summary (March 2026)

## Recent Focus
- **Custom tip rasterization:** Custom brush tips are now rasterized to a 500×500 p5.Graphics buffer at `add()` time, using a 100×100 user coordinate space (origin at center). Dark = opaque, light = transparent.
- **GL instancing:** Both image and custom tips are drawn via GPU instancing for performance. All tips are routed through the same `stampImage`/`glDrawImages` path.
- **Brush-maker tool:** Added a real-time 100×100 preview for custom tips, improved slider logic, and moved generated code to a right column.
- **UI/UX fixes:** Weight slider is now always visible for custom/image tips; slider ranges and defaults are unified; spacing min is 0.5 for both.
- **Edge crispness:** Custom tips now use `noSmooth()` during rasterization to avoid blurred borders.

## Key Files
- `src/stroke/stroke.js`: Main brush logic, custom tip rasterization, instancing.
- `src/stroke/gl_draw.js`: WebGL2 engine, instancing, texture cache.
- `tools/brush-maker.html`: Brush design tool, preview, sliders, code output.

## Custom Tip Convention
- Draw in 100×100 units, origin at center.
- Use plain p5 commands (fill, rect, ellipse, etc).
- Dark = opaque ink; light/white = transparent.
- Tip rasterized at 500×500 with `scale(5)` and `noSmooth()`.

## UI Changes
- Preview window for custom tips (100×100, real-time).
- Weight slider always visible for custom/image.
- Generated code panel moved to right column.

## Performance
- All tips (image/custom) use GPU instancing for fast drawing.
- Texture cache prevents redundant uploads.

## Outstanding Issues
- None pending. All recent fixes verified.

## How to Continue
- For new custom tip features, update rasterization logic in `stroke.js`.
- For UI changes, edit `brush-maker.html`.
- For GL/instancing, update `gl_draw.js`.

---
This summary is for agent handoff. See code comments and recent commit history for details.
