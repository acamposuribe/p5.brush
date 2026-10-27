# How p5.brush renders

Notes for contributors: how strokes and fills are drawn as of 3.0.0, the decisions behind them, and what is still open. The full working history (the 2026 rendering audit, the stroke plan and the fill plan) is in git, up to commit `1b630a8`.

Measurements are from an Apple M4 through ANGLE Metal. No Windows (D3D11) or mobile GPU has been profiled yet; that is the main open risk.

## Measuring

- `npm run measure:bench -- --angle=metal` runs the benchmark workloads: lines, hatch, mass, fill, fillLarge, fillMany, wash and fillHighBleed. Use `d3d11` or `vulkan` on other hardware; the default, SwiftShader, is a CPU renderer and its timings don't resemble any GPU. Baselines are in `test/e2e/baselines/`.
- `npm run measure:density` measures each brush's ink at densities 1, 2 and 3.
- `node test/e2e/fill-sheet.mjs --density=2 --angle=metal` writes a contact sheet of fills for side-by-side review.
- `test/standalone/fill_circle_explorer.html` (`npm run serve`) has sliders for every fill setting and several compositions (dots, swatches, an af Klint study).
- The compatibility fixtures in `test/e2e/legacy-output.json` pin every scene's pixels. Intentional changes are listed there with their reason.

## Strokes

Every brush type queues path segments of up to 4 logical px. Shaders expand them into dots (`src/stroke/dots.vert`: default, spray, marker) or textured stamps (`stamps.vert`: image and custom tips). Randomness is hashed from the stroke seed, segment and step, so no dots are generated on the CPU. Strokes that share brush, colour, transform, clip and target draw in one call. Compared with 2.3.0: lines 30 → 3 ms, hatch 39 → 3 ms, mass 250 → 17 ms.

- **Density 2 is the reference look.** Dots keep a footprint of at least half a logical pixel, and their alpha scales by footprint over raster area. So fine brushes look the same at any density, within about 6–21% at density 1 (overlapping faint dots in one pixel combine to less ink).
- **Paper tooth, always on.** `src/stroke/paper.glsl` is a fixed height map in canvas space. A mark deposits only where the paper rises above a level set by its pressure. It follows `brush.seed()` and `scaleBrushes()`; `brush.paper()` and `brush.noPaper()` tune it.
- **Compositing.** Strokes accumulate in a mask, then one spectral (Kubelka-Munk) pass per colour mixes the mask's ink into the canvas. The pigment's K/S and luminance are computed once per pass on the CPU (`src/core/spectral.js`).

## Fills

`fill()` paints watercolour. The shape is Tyler Hobbs' recursive midpoint displacement: a base polygon grown with per-vertex bleed, three trims, a darker layer and a sparse scatter layer, all on the CPU (`src/fill/fill.js`). Of Hobbs' 20-step layer schedule, 7 evenly spaced layers are drawn. The finest growth level is skipped, because it shows as a saw-tooth on a crisp edge.

1. **Mask.** Layers are drawn into a half-float framebuffer as log-domain paint, so draw order doesn't matter: Σ −ln(1 − α), turned back into coverage with 1 − e^−r. Polygons are filled by stencil-then-cover, which is Canvas2D's nonzero rule, with two jittered samples. The untrimmed outline layers also write a silhouette channel, so trims shade the interior but never move the edge. Washes use the same mask with one polygon and four samples. (`src/fill/gl_fill.js`, `fan.*`)
2. **Blur.** A separable Gaussian blur at half resolution (`blur.frag`) gives:
   - a smooth silhouette (σ/2);
   - each pixel's share of the neighbourhood that is inside the shape;
   - the mean paint inside (σ ≈ 7% of the shape).
3. **Composite.** One pass per fill: the `WATERCOLOR` build of `src/core/gl/shader.frag`. `watercolor()` turns the fields above into a paint amount:
   - **Edge:** the signed distance to the blurred silhouette's iso-line, bent by noise and by the paper. Some stretches are *lost* (they fade into the paper).
   - **Rim:** a coffee-ring band that rises toward the edge and varies along it.
   - **Interior:** granulation, reticulation in patches, drift, and occasional pools, drops and blooms.
   - **Colour:** the fill colour is split into a warmer and a cooler pigment (OKLab hue ±30° × `split`), whose ratio drifts across the wash. The two are blended in K/S and mixed spectrally with the canvas.
4. **Wet-in-wet.** Each fill stamps a half-resolution wetness buffer from its silhouette. A later fill whose edge meets wet paper loses its edge there and creeps into it. Wetness decays by 0.45 per fill, and everything dries at each frame flush (`render()`, the end of p5's `draw()`, or a target switch). A frame never depends on earlier frames.

Cost compared with 2.4.0: fillLarge (one 1200² fill at density 2) 82 → 47 ms, fillMany (40 fills) 283 → 51 ms, wash 66 → 18 ms.

### Decisions

- **Watercolour replaced the classic look entirely** (3.0.0). Reference studies (dot sheets, swatches, Lieberman's scanned drops) showed dried washes, rings and hue shifts. The classic look built its texture by stacking 90 translucent layers and erasing circles.
- **Image-space effects, not a fluid simulation.** Curtis et al.'s shallow-water simulation is expensive and tied to resolution. Rims, backruns, flow and wet-in-wet are approximated from the blurred paint field instead, in the spirit of Bousseau and Montesdeoca.
- **Rejected on review:**
  - a cold-press paper structure with white sparkle ("bullshit realism");
  - a weaker darker layer, and pale-centre rings, which made washes flat and pale;
  - Curtis' two-constant Kubelka-Munk glazing: with spectra guessed from one RGB colour it only raised saturation. Pigment separation gives hue variation instead;
  - batching same-colour fills, which would merge silhouettes and break wet-in-wet;
  - evaluating the shape-scale noise at quarter resolution: its pixels matched, but it slowed small fills (extra render-target switches, then a larger shader).

## Open

- **Profile on Windows (D3D11) and a mobile GPU.** Everything above is M4-only.
- **Animated fills.** A small fill costs about 1.25 ms, half CPU geometry and half fixed GPU passes, so about 12 per frame at 60 fps. Next steps, cheapest first:
  - cap vertices by perimeter in device pixels: a small circle currently grows up to ~2000 × bleed vertices;
  - trim the fixed passes per fill;
  - move the finest growth to the GPU with hashed randomness.
- **Reticulation** costs about 20 ms on a large fill that rolls it. It is computed only inside its patches, and its cell points are hashed directly. Making it cheaper further can't keep pixels identical.
- **Strokes:** interpolated flow-field sampling; context ownership between p5 and the library; a WebGPU backend. None has been started.
