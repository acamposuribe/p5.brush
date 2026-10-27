# p5.brush performance review and bug audit

## Executive summary

Audited **p5.brush 2.2.4**, repository commit **`43ac6d5`**. The audit originally made no library changes; the subsequent bug-fix pass is recorded below. The existing build and both smoke suites passed before fixes, but missed important correctness failures.

> **Bug-fix handoff status:** B01–B24 are fixed in the current working tree. B24's seeded-output change was subsequently approved by the user: signed integer sampling now uses floor instead of truncation. See the status column in §4 and the per-bug implementation/verification notes in §8. The bug-fix pass did not implement performance proposals. The subsequent low-risk optimization pass (appearance-risk orders 1–4) is recorded in §9; additional risks in §5 remain follow-up work.

**Recommended order of work:**

1. **Prevent hangs:** validate hatch/stroke spacing and zero-pressure spray behavior; prevent mass from generating non-positive hatch spacing.
2. **Fix visible regressions:** restore clipping, correct image/custom-tip density and transforms, repair two-point splines and polygon generation scaling.
3. **Fix target/resource lifecycle:** switching canvases currently produces a WebGL error; repeated standalone loads allocate new framebuffer resources; fields never update their geometry after target changes.
4. **Optimize fill compositing and hatch/mass batching**, rather than starting with micro-optimizations to geometry math.
5. Add deterministic pixel/geometry tests and real performance benchmarks. Passing the current smoke test is not sufficient evidence of rendering correctness.

The strongest measured performance findings are:

- Three small watercolor rectangles take about **1.58 seconds** in the software-rendered test environment, with **12 fill uploads/blits/composite draws per iteration**.
- A 300×300 HB mass takes about **263 ms**, issuing roughly **1,489 draws per iteration**, despite only one final composite pass.
- Dense strokes spend substantial CPU samples in random generation, tip generation, circle queuing, and dirty-bound accumulation.
- WebGL state queries are prominent synchronization points in this environment, especially for fill. These samples must not be interpreted as pure JavaScript computation time.

These are baseline observations, **not claimed hardware-GPU timings or measured optimization speedups**.

## 1. Scope, method, and reproducibility

### Reviewed areas

- Shared rendering/target/runtime architecture and both p5 and standalone adapters.
- Stroke generation, pressure profiles, circle batching, instanced image/custom tips, and image loading.
- Watercolor growth, scatter/erase layers, solid wash, CPU mask upload, dirty rectangles, and spectral compositing.
- Plot, spline, polygon, flow-field, hatch, mass, push/pop, and random/geometry utilities.
- Package exports, build configuration, public documentation, and existing smoke coverage.

The review prioritizes the execution paths and their boundary conditions; it is not a proof that all inputs, browsers, and p5 integrations are defect-free.

### Checks executed

- `npm test`: build succeeded; **p5 adapter PASS**, **standalone WebGL2 PASS**.
- `node workspace/audit-runner.mjs`: five standalone workloads, CPU sampling, GL-call counts, and targeted bug reproductions.
- Node CommonJS export probe: both advertised `require()` entry points returned no brush API.

### Artifacts

- **`workspace/audit-runner.mjs`** — repeatable diagnostic harness, not a CI assertion suite.
- **`workspace/audit-results.json`** — raw timings, call counts, mapped CPU sample locations, and reproduction outputs.
- **This report.**

Run from the repository root:

```sh
npm test
node workspace/audit-runner.mjs
```

Environment: Node **v23.9.0**, Chromium **145.0.7632.6**, headless Chromium with **ANGLE SwiftShader**, 512×512 canvas, density 1 for benchmarks. The harness uses the built ESM bundle and maps CPU sample locations through its source map. Each workload uses a separate page, warms the same target before profiling, and runs seven measured iterations. It reports medians; counters and CPU samples aggregate all seven iterations. `clear()` and reseeding are outside the timed workload but inside the sampled/counted region.

`draw` measures synchronous drawing calls, `render` measures the final flush, and `total` includes a final `gl.finish()`. The latter is diagnostic only and should **not** be added to production drawing. **Timing correction:** §9 now shows that `gl.finish()` alone did not include completed rendering in these browser-side intervals. The historical `total` column is not guaranteed GPU-completed time; the corrected harness includes synchronous pixel readback. CPU profiling and GL wrappers introduce overhead. The software renderer can block at state queries; the resulting timings cannot establish hardware GPU costs. Individual column medians need not sum exactly.

Dynamic performance measurements were standalone-only. p5 passed the existing smoke suite; shared-code findings also affect p5 unless explicitly scoped otherwise. Safari, Firefox, physical GPUs, context restoration, worker deployment, and p5 framebuffer densities were not dynamically tested.

## 2. Performance baseline

| Workload | Geometry | Median draw | Median final render | Median total |
|---|---|---:|---:|---:|
| HB | 100 horizontal lines, each 400 units | 24.4 ms | 0.3 ms | 24.6 ms |
| Marker | Same 100 lines | 64.3 ms | 0.3 ms | 64.6 ms |
| Hatch | 400×400 rectangle, spacing 3, plus HB outline | 34.0 ms | 0.2 ms | 34.2 ms |
| Watercolor fill | Three 100×200 rectangles, default texture/bleed, no outline | 1,577.6 ms | 0.0 ms | 1,577.6 ms |
| Mass | 300×300 rectangle, HB, default mass options, no outer outline | 263.1 ms | 0.2 ms | 263.3 ms |

The fill's negligible final `render()` is **not** evidence that rendering is cheap: `FillPoly.fill()` already flushes its layers while the drawing call is executing.

### GL calls across seven iterations

| Workload | `drawArrays` | `bufferSubData` | `blitFramebuffer` | `texSubImage2D` | `getParameter` |
|---|---:|---:|---:|---:|---:|
| HB | 707 | 699 | 7 | 0 | 91 |
| Marker | 707 | 699 | 7 | 0 | 91 |
| Hatch | 945 | 936 | 7 | 0 | 91 |
| Fill | 84 | 0 | 84 | 84 | 770 |
| Mass | 10,422 | 10,414 | 7 | 0 | 91 |

All five final benchmark runs reported **`gl.getError() === 0`**. Separate target-switch checks deliberately expose an error described below. Upload counters omit `bufferData` reallocations, explaining small discrepancies between stroke uploads and draws.

### CPU sampling interpretation

Mapped HB/mass samples repeatedly land in:

- `src/core/utils.js:41`: PRNG closure; `:104`: random range helper.
- `src/stroke/stroke.js:629`: `drawDefault()`.
- `src/stroke/gl_draw.js:295`: `circle()`; `:128`: dirty-rect accumulation.
- `src/core/flowfield.js`: movement, plot traversal, and field-angle lookup.

For fill, samples overwhelmingly land in native **`getParameter`**, with comparatively few in `grow()`/Canvas drawing. For marker, state-query/wait samples are also prominent. This identifies a **synchronization/pass-cost problem in this environment**, not proof that polygon growth is universally cheap. Profile physical GPUs before deciding the exact CPU/GPU split.

## 3. Prioritized optimization proposals

### P1 — Reduce fill pass count and state-query synchronization

**Evidence:** `src/fill/fill.js:582–676` draws 20 layers and flushes at layers 0, 8, 16, and 19. Each flush goes through source blitting, CPU-mask staging/upload, spectral compositing, and clearing. Three rectangles produce 12 such cycles.

Relevant code:

- `src/core/color.js`: `Mix.applyShader()`.
- `src/core/compositor_runtime.js`: `blitDefaultFramebufferSource()`.
- `src/adapters/standalone/compositor.js`: `clearTarget()` and `runBlendShaderPass()`.
- `src/fill/composite.js`: `getFillShaderMask()`.

**Proposal:**

1. Track state owned by the standalone adapter, avoiding repeated driver queries where ownership is guaranteed. Keep explicit save/restore boundaries for external GL users; do not blindly remove p5 state preservation.
2. Investigate fewer fill flushes or an explicit quality setting for layer/flush counts.
3. Avoid redundant full-target clears when the shader samples only a known dirty area, using both previous and current dirty bounds where necessary.
4. Benchmark small/large fills at densities 1 and 2, and separate mask drawing, staging copy, upload, source copy, and spectral pass timing.

**Risk:** Changing when pigment layers are composited changes watercolor appearance and nonlinear color mixing. Require visual comparison and potentially keep current output as the default. Reduced pass count is not a drop-in mathematically equivalent optimization.

### P2 — Batch stroke uploads/draws across compatible strokes

**Evidence:** `restoreState()` in `src/stroke/stroke.js:441` flushes `glDraw()` at the end of every line/arc. Existing typed arrays/VAOs already batch stamps **within** a stroke, but hatches/masses still issue a draw/upload for each generated stroke. The mass benchmark has more than ten thousand draws over seven iterations.

**Proposal:** Queue transformed stamp records across compatible strokes, flushing at color/type/texture changes, target switches, host-drawing boundaries, mask/composite transitions, and frame end. Start with internally controlled hatch/mass passes to reduce API-interleaving risk. Texture changes need explicit queue ownership.

**Important correctness constraint:** `Mix.blend(newColor)` must flush previously queued geometry before compositing the old color. Simply removing `glDraw()` from `restoreState()` will produce incorrect colors/order.

**Risk:** The brush mask saturates alpha and nonlinear blending depends on draw boundaries. Preserve current semantics and compare fixed-seed pixels; do not reorder different colors or host draws.

### P3 — Specialize the straight, no-field movement loop

**Evidence:** Per-tip code calls `_moveToDegrees()` → `_moveConstant()` → `isIn()`/`cossin()`, even though line direction and spacing are fixed. CPU samples show movement and bounds checks in dense strokes.

**Proposal:** Cache direction increments once per stroke; update position/plotted distance directly in a no-field/no-plot fast path. Fix the movement/bounds correctness issue B13 first. Cache per-plot-step sine/cosine where shared by position and dispersion.

**Risk:** LUT quantization, boundary behavior, pressure sampling every ten tips, and exact RNG consumption must remain consistent unless intentionally versioned.

### P4 — Bound the Gaussian pool and reduce unnecessary pool generation

**Evidence:** `src/stroke/stroke.js:359–362` grows a retained JS array to `totalSteps * 2` for every brush type. Marker/image/custom tips do not consume this pool for scatter, yet pay its allocation cost on the first long stroke. A very long stroke permanently raises retained memory until reseeding.

**Proposal:** Only prepare the pool for consumers; choose a bounded typed pool or reproducible indexed sampling. Measure both cold and warm strokes and heap retention.

**Risk:** Moving random generation changes the main RNG stream and therefore later artwork. Treat seeded reproducibility as part of compatibility, not an incidental detail.

### P5 — Improve fill-mask staging reuse

**Evidence:** `getFillShaderMask()` recreates its staging canvas whenever dirty width/height changes and clears the framebuffer mirror on every upload. It also copies the mask via `drawImage()` before uploading.

**Proposal:** Reuse a bucketed/pool staging canvas, or evaluate a WebGL2 upload strategy with a source crop that avoids recreating/copying the canvas. Benchmark browser-supported DOM-source upload semantics rather than assuming `UNPACK_ROW_LENGTH` eliminates a Canvas source copy. Track uploaded bytes and allocation counts.

**Risk:** Stale pixels, flip-Y/unpack state, and mask filtering near dirty bounds require image tests.

### P6 — Hoist constant spectral-color work out of the fragment shader

**Evidence:** `src/core/gl/shader.frag:157–186` converts both colors into **38 reflectance bands**, computes luminance, and mixes them per affected fragment. The stroke pigment is constant for a blend pass; fill also samples a 3×3 edge neighborhood.

**Proposal:** Evaluate passing precomputed pigment reflectance/K–S/luminance as uniforms, keeping the varying destination conversion on-GPU. Explicitly hoist concentration calculations out of the band loop if shader compiler output does not already do so. Consider a LUT/reduced-band option only as a separately validated quality tradeoff.

**Risk:** Darkening modifies pigment for high-alpha brush pixels, so a single constant pigment spectrum is not sufficient for all brush fragments. Shader compilers may already hoist some arithmetic. Use GPU timers (`EXT_disjoint_timer_query_webgl2`, when available) and color-error tests; no speedup is established here.

### P7 — Use active-edge hatch traversal and reuse mass geometry

**Evidence:** Scanlines test every non-horizontal edge (`src/hatch/hatch.js:174–183`), then allocate segments and a second line list. Mass repeatedly checks ring membership and, for polygon arrays, recomputes/allocates bounds in `biasArrayMassCenter()`.

**Proposal:** Use an active-edge table for complex polygons, precompute slopes, avoid unnecessary whole-list sorting, stream internal lines where the public array is not needed, and cache shape bounds for each mass layer. Consider a spatial index for high-vertex arc containment tests.

**Priority:** Lower than batching for the measured simple rectangle; more valuable for complex contours. Seven sample points are not sufficient for guaranteed containment (see follow-up risks).

### Existing optimizations worth preserving

Flat stamp buffers with geometric growth, persistent VBOs/VAOs, image instancing, dirty-rect compositing, cumulative plot lengths/cached traversal, trig lookup tables, and reuse of fill scratch arrays are already sensible choices. Do not replace them without measurements.

### Appearance-risk ranking and estimated speedups

The original P1–P7 numbering ranks performance opportunities, not appearance risk. For implementation, use the order below. Composite proposals are split because purely technical changes and quality tradeoffs have very different risks.

**These are planning estimates, not measured speedups.** These estimates were made before implementation; actual progress and measurements for orders 1–4 are recorded in §9. Ranges refer to the affected workload's total time, not universal library throughput. A lower bound of 1.0× means there may be no measurable benefit. Real results depend on CPU/GPU balance, browser, density, shape complexity and workload. The original SwiftShader timings cannot establish hardware-GPU speedups. Speedups overlap and must not be multiplied together.

Appearance risk concerns color, texture, density, geometry and layering—not engineering difficulty. Seed-only changes are separately flagged: approved by the user, but not pixel-identical to previous output.

| Order | Optimization | Appearance risk | Estimated speedup / affected workload | Conditions for preserving appearance |
|---|---|---|---|---|
| 1 | P7: cache mass bounds and reuse temporary geometry storage | **Low** | **1.0–1.15×** hatch/mass; more useful for repeated complex geometry | Cache only immutable geometry; retain computation, emission and RNG order. |
| 2 | P3: straight/no-field movement fast path | **Low** | **1.0–1.30×** dense straight strokes | Reuse the existing trig/LUT values, coordinate update order, pressure cadence and RNG calls; do not change sampling spacing. |
| 3 | P1: owned GL-state tracking and redundant-clear removal | **Low** | **1.0–1.30×** fill-heavy work | Start with standalone-owned state. Preserve p5/external GL boundaries and clear all potentially stale pixels. Do not change composition timing. |
| 4 | P5: reuse fill-mask staging surfaces | **Low** | **1.0–1.20×** repeated fills | Keep the same crop, filtering, orientation and uploaded mask pixels; pooled dimensions must not alter UVs. |
| 5 | P2: batch compatible hatch/mass stroke uploads and draws | **Low–moderate** | **1.2–3.0×** dense mass; **1.0–1.40×** hatch/ordinary line workloads | Preserve stamp order and existing pigment composition points; flush on color, texture, transform/clip uniforms, target and host-drawing boundaries. Start within controlled internal passes. |
| 6 | P7: active-edge hatch traversal / containment indexing | **Low–moderate** | **1.0–2.0×** complex-contour hatching; approximately **1.0×** for simple rectangles | Same intersections, tie handling, arithmetic and line ordering. Equivalent algorithms can still produce changed pixels if floating-point rounding or RNG ordering changes. |
| 7 | P6: exact spectral-work hoisting/precomputation | **Moderate** | **1.0–1.40×** compositing-heavy workloads | Retain the full spectral model, alpha-dependent darkening and color conversion. CPU/GPU rounding may introduce small color differences; shader compilers may already do much of the hoisting. |
| 8 | P4: skip Gaussian preparation for non-consuming brush types | **Moderate — seed-only** | **1.0–1.60×** cold/reseeded long marker/image/custom strokes; **1.0–1.05×** warm strokes | Noise distribution and brush model need not change, but skipping draws changes the subsequent main RNG stream. Keep Gaussian-consuming brushes unchanged in the first implementation. |
| 9 | P4: bounded/streamed Gaussian storage | **Moderate; high if samples are naively repeated** | **0.8–1.15×** stroke time: can slow warm strokes; primary benefit is bounded memory | Do not cycle a short pool into visible repetitive patterns. Fresh/indexed generation changes seed mapping and can add computation; evaluate memory independently of speed. |
| 10 | P1: fewer watercolor composition flushes | **High–extreme** | **1.0–3.0×** fill-heavy workloads | Nonlinear pigment mixing is not equivalent when several masks are merged before blending. Expect potentially substantial watercolor/color/layering changes; treat as an explicit quality/renderer option. |
| 11 | P1: fewer watercolor growth/texture layers | **Extreme** | **1.0–3.0×** fill-heavy workloads | Directly changes texture, bleed and density; reduced CPU work does not guarantee a proportionate overall gain. Opt-in quality tradeoff, not a transparent optimization. |
| 12 | P6: fewer spectral bands / approximate color LUT | **Extreme** | **1.0–2.0×** compositing-heavy workloads | Changes the pigment-mixing model and can shift colors throughout brush and fill output. Benefit depends on GPU shader cost versus upload/copy costs. A LUT is not necessarily inaccurate, but its appearance error must be measured. |

**Suggested rollout:** implement orders 1–4 first, then ordered internal batching (5). Measure each change separately against the post-bug-fix baseline. Preserve rendering fingerprints for technical optimizations; update a fingerprint only for an explained and approved appearance/seed change. Investigate exact spectral hoisting and Gaussian preparation next according to measured bottlenecks. Keep orders 10–12 separate from the default renderer unless the resulting artistic change is deliberately accepted.

For interpretation: 1.2× speed means about 17% less execution time; 1.5× means 33% less; 2× means 50% less. An accelerated phase does not translate directly to the same whole-scene speedup—for example, doubling a phase responsible for half the scene time yields only 1.33× overall speed.

## 4. Bug findings

**Priority:** P0 = potentially hangs execution; P1 = major visible/resource/API failure; P2 = important boundary/compatibility defect. **Evidence:** Runtime = reproduced by harness/probe; Source = deterministic defect established from control flow, but not executed here when dangerous or environment-specific.

### Summary

| ID | Priority | Evidence | Finding | Fix status |
|---|---|---|---|---|
| B01 | P0 | Source | Zero/negative hatch spacing can loop forever; mass can generate it internally | **Fixed** |
| B02 | P0 | Source | Zero stroke spacing / zero-pressure spray can run unbounded loops | **Fixed** |
| B03 | P1 | Runtime | `clip()` and `noClip()` are no-ops | **Fixed** |
| B04 | P1 | Runtime | Custom/image tips scale twice with pixel density | **Fixed** |
| B05 | P1 | Source | Tip shape rotation, reflection, and nonuniform scale are not inherited correctly | **Fixed** |
| B06 | P1 | Runtime | Default two-point spline produces an empty plot | **Fixed** |
| B07 | P1 | Runtime | `Plot.genPol()` ignores its scale parameter | **Fixed** |
| B08 | P1 | Runtime + Source | Explicit polygon fill/draw overrides do not activate when outer mode is off | **Fixed** |
| B09 | P2 | Runtime | `fill(color, 0)` replaces zero opacity with 150 | **Fixed** |
| B10 | P1 | Runtime | Standalone target switch followed by clear yields `INVALID_OPERATION` | **Fixed** |
| B11 | P1 | Runtime + Source | Repeated standalone load allocates new resources and loses density metadata | **Fixed** |
| B12 | P1 | Source | Flow-field grid is permanently tied to the first target geometry | **Fixed** |
| B13 | P2 | Runtime | Off-canvas movement freezes position and advances the wrong plotted distance | **Fixed** |
| B14 | P2 | Runtime | `Plot.pressure()` depends on a previous angle query at the same distance | **Fixed** |
| B15 | P2 | Runtime | Empty filled polygon crashes inside mask drawing | **Fixed** |
| B16 | P2 | Runtime | Standalone valid transparent CSS colors are rejected | **Fixed** |
| B17 | P1 | Runtime | Advertised CommonJS exports return no API | **Fixed** |
| B18 | P2 | Source | Temporary brush/fill/hatch/mass state is not restored after exceptions | **Fixed** |
| B19 | P2 | Source | Fill growth fast path can bypass the vertex cap | **Fixed** |
| B20 | P2 | Source | GL shader objects are leaked and compilation/link errors are unchecked | **Fixed** |
| B21 | P2 | Source | Image-processing exceptions can leave loading promises pending forever | **Fixed** |
| B22 | P2 | Source | Image-tip conversion ignores original transparency | **Fixed** |
| B23 | P2 | Source | Standalone tip-surface push/pop does not restore its style state | **Fixed** |
| B24 | P2 | Source | Negative-range random integers are biased by truncation toward zero | **Fixed — seeded changes approved** |

### B01 — Non-terminating hatch loops, including internally generated mass spacing

**Locations:** `src/hatch/hatch.js:43–55,174–217`; `src/hatch/mass.js:417`.

`hatch()` accepts any distance. With `dist = 0`, `Y += step` never advances; with negative distance, Y moves away from `maxY`. The loop continues allocating segments. A tiny positive step can also fail to advance floating-point Y or demand unreasonable work.

Mass calculates `1.6 * rr2(scatter * .65, scatter * .85) - .4 * gradient`. A valid custom brush with **scatter 0** and default gradient .1 yields **-.04**, so normal `mass()` use can enter the same problem without an explicitly invalid hatch argument.

**Fix:** Reject non-finite/non-positive public spacing. Clamp or otherwise redesign internally derived mass spacing with a documented positive minimum. Add a progress/iteration guard to scanline generation. Test zero-scatter custom brushes and `scaleBrushes(0)` interactions. Dangerous loops were not executed in the main audit process.

### B02 — Unbounded stroke/spray work

**Locations:** `src/stroke/stroke.js:173–180,353–365,565–566`.

- `spacing = 0` makes `totalSteps` infinite and the Gaussian preparation loop unbounded.
- A spray pressure profile `[0, 0]` produces pressure zero; `Math.ceil(grain / pressure)` is infinite for positive grain.
- Non-finite lengths, parameters, or extremely small positive spacing can cause equivalent excessive work.

**Fix:** Validate finite lengths/spacing/brush parameters at API boundaries, skip zero-pressure spray tips, and establish explicit work limits or chunking for huge strokes. Throw useful errors rather than relying on JS arithmetic to sanitize input.

### B03 — Clipping is absent

**Location:** `src/stroke/stroke.js:303–315`; documented in `README.md:543–566`.

`clip(region)` only initializes the canvas and returns the input. `noClip()` does nothing. No clipping state is passed to the stamp queues or shaders.

**Reproduction:** Clip to [-10,-10,10,10], draw a black marker across [-40,40]. Pixel at logical x=26 outside the region is visibly dark rather than white (raw output in JSON).

**Fix:** Implement transform-captured clipping for stroke/hatch masks, including push/pop semantics. Test rotated regions, reset, density, and image/custom brushes; leave fill unclipped as documented.

### B04 — Density is applied twice to image/custom stamp extent

**Locations:** `src/stroke/gl_draw.js:357`; `src/stroke/image.vert:26`; projection in `gl_draw.js:175–194`.

Centers/projection are in logical coordinates, but the image quad half-size is multiplied by Density before projection. Viewport/backing resolution then scales it again. Circle point sizes, by contrast, correctly need physical-pixel diameters for `gl_PointSize`.

**Reproduction:** An opaque square custom tip of weight 20 is **20 physical / 20 logical pixels** at density 1, but **80 physical / 40 logical pixels** at density 2. Intended density-2 size is 40 physical / 20 logical. Dirty tracking uses a physical radius corresponding to the smaller extent, risking cropped composites as well.

**Fix:** Keep image-quad vertices/extents in logical coordinates, multiplying by density only for physical dirty bounds. Test densities 1, 1.5, 2 and compare circles, image tips, custom tips, and fill.

### B05 — Affine transforms affect centers, not complete stamp shapes

**Locations:** `src/stroke/gl_draw.js:70,309–319,351–364`.

Shape size uses only the transformed x-axis length. Image rotation stores the brush's local angle unchanged; runtime rotation is not included. Reflection and independent y-scale are discarded. Circles remain circles under nonuniform scale where a fully transformed tip should become an ellipse. Fill/wash use the full Canvas affine matrix, producing adapter-internal inconsistencies.

**Fix:** Pass a transformed basis/full 2×2 matrix to image-quad instances; decide/document ellipse behavior for circle tips. Test an asymmetric tip under `rotate()`, negative scale, and `scale(2, .5)` with pixel comparisons.

### B06 — Two-point curved spline has no segments

**Location:** `src/core/primitives.js:284–395`.

With the default curvature .5 and two points, neither the three-point curved branch nor the `curvature === 0` branch executes. The returned plot has **length 0**. This also affects `beginShape(curvature > 0)` with exactly two vertices, and can lead to an empty-fill crash if fill is enabled.

**Fix:** Treat two-point splines as straight segments. Define handling for duplicate/degenerate points and collinear reversals; avoid passing failed intersections into radius calculations.

### B07 — Polygon generation ignores scale

**Location:** `src/core/plot.js:143–166`.

`_scale` is declared but never passed to `pos.plotTo()` or included in the step count. A plot converted with scale 1 and scale 2 produces identical coordinates. The harness's 40-unit segment has the same last sampled vertex **[33,0]** in both cases.

**Impact:** Plot outlines and fill/wash/hatch/mass geometry can disagree in size. Endpoint/origin sampling also warrants an explicit contract: generated polygons do not necessarily preserve path endpoints.

**Fix:** Apply scale consistently to traversal/length sampling and verify outline-vs-fill bounds at multiple scales.

### B08 — Explicit polygon overrides use the old active flag

**Locations:** `src/fill/fill.js:722–742`; `src/stroke/stroke.js:879–889`.

Both snapshot outer state, apply an explicit fill/brush override, then gate execution on **`state.isActive`**, not the newly active state. After `noFill()`, `polygon.fill('blue', ...)` silently draws nothing; the reproduced center pixel stays white. The draw method has the same control-flow defect after `noStroke()`.

**Fix:** Gate on the current state after applying the override, then restore outer state in `finally`.

### B09 — Zero fill opacity is lost

**Location:** `src/fill/fill.js:89`.

Opacity uses `value || 150`, so zero becomes the default. The harness draws a visibly blue pixel **[231,239,255,255]** on white after `fill('blue', 0)`. Wash already uses `??`.

**Fix:** Use nullish defaulting and finite/clamped opacity validation. Test omitted, zero, negative, and full opacity for both string and RGB overloads.

### B10 — Switching standalone targets leaves stale global mask handles

**Locations:** `src/adapters/standalone/target.js:56–69`; `src/adapters/standalone/frame.js:33–40`; `src/core/color.js` global `Mix` state.

Creating/loading a new target replaces Renderer, but Mix can still hold the previous target's masks. `clear()` immediately clears those masks using the **new** renderer's GL context, trying to bind a framebuffer from the old context.

**Reproduction:** Draw/render on one canvas, create a second canvas, call clear; the second context reports **1282 (`INVALID_OPERATION`)**.

**Fix:** Flush/discard old pending work while the old target is active, then install the new target and its compositor resources atomically. Test A→B→A both with pending and flushed work, clear-before-draw, different dimensions, and different densities. Target switching is explicitly documented in `docs/standalone.md`.

### B11 — Repeated standalone load drops resources and logical-size metadata

**Location:** `src/adapters/standalone/target.js:56–85`.

Every load creates a new renderer wrapper, losing shader/framebuffer references held by the old wrapper, without explicit disposal. The harness sees **three new framebuffer textures on each load of the same canvas**. The GL stamp module sees the same context and therefore does not dispose these compositor resources.

Also, `load(canvas)` sets width/height to backing dimensions and density 1. Reloading a canvas originally created at density 2 loses its logical dimensions/density and changes drawing semantics.

**Fix:** Maintain renderer/resource metadata per target with a WeakMap; preserve logical dimensions/density; expose disposal or otherwise explicitly release owned GL resources. Avoid treating `load()` as unconditional recreation.

### B12 — Field geometry never follows resize/target switch

**Location:** `src/core/flowfield.js:23–35,270–278`.

The field grid initializes once and caches resolution, origin, rows, columns, and generated fields. Later target changes do not invalidate it. Even `refreshField()` generates using the old dimensions. Fields therefore cover/sample the wrong coordinate range after resize or drawing into differently sized targets.

**Fix:** Key field geometry by target/size or invalidate/rebuild when dimensions change. Preserve user generators and avoid silently overwriting pre-registered built-in-name overrides when defaults initialize.

### B13 — Movement freezes outside the canvas/field

**Location:** `src/core/flowfield.js:151–166,192–207`.

Outside `isIn()`, both movement paths advance only `_step` (or `_step/scale`) and return without changing x/y. A path starting outside can never enter. For a multi-step movement, plotted distance is wrong too.

**Reproduction:** `new Position(-100,64).moveTo(0,200,1)` leaves x **-100** and plotted **1**, instead of progressing through the requested movement.

**Fix:** Separate movement from rendering culling. Out-of-field movement should use a defined fallback direction and advance the full requested distance. Test strokes crossing each boundary from both directions.

### B14 — Public pressure queries rely on stale traversal state

**Location:** `src/core/plot.js:78–87`.

`pressure(d)` assumes an earlier `angle(d)` updated `index/suma`. Querying pressure after an angle at another distance extrapolates the wrong segment.

**Reproduction:** Two 40-unit segments with pressures 1→3→9, `angle(60)` then `pressure(10)` returns **-1.5**, expected **1.5**.

**Fix:** Make public `pressure()` compute its index, with a separate private fast path for coordinated internal sampling if required. Audit end-of-plot rotation and zero-length segment behavior at the same time.

### B15 — Empty polygons crash and can leave render state partially mutated

**Locations:** `src/fill/mask.js:43`; `src/fill/fill.js:204,582`.

`drawPolygon()` dereferences the first vertex without a guard. `new Polygon([]).fill()` produces **“Cannot read properties of undefined (reading 'x')”** rather than a controlled error or no-op. This can be reached through failed/empty plot generation, not only direct user input.

**Fix:** Validate minimum geometry before entering compositing; guarantee Canvas state restoration after errors. Test empty, one/two-vertex, zero-length, and non-finite polygons.

### B16 — Transparent CSS color normalization is incompatible with parsing

**Location:** `src/adapters/standalone/runtime.js:65–89,127–179`.

The browser accepts valid transparent colors and normalizes them to `rgba(...)`, but `hexToRgb()` only accepts opaque hex. Explicit comma-style rgba passes a separate parser and works.

**Reproduced failures:** `transparent`, `#ff000080`, and `rgb(255 0 0 / 0.5)`; **`rgba(255,0,0,0.5)` is accepted**.

**Fix:** Normalize all accepted CSS colors to RGBA rather than assuming browser serialization is hex. Define and test alpha semantics across p5 and standalone.

### B17 — CommonJS package exports are broken

**Locations:** `package.json` `type`/`exports`; `rollup.config.js` UMD `.js` outputs.

The package declares `"type": "module"` but points `require` at UMD `.js` files. Under the tested Node version, `require('p5.brush')` and `require('p5.brush/standalone')` both return **zero keys**, with `set` undefined. Older runtimes may reject the ESM load instead. This is separate from browser script-tag UMD use.

**Fix:** Emit actual `.cjs` CommonJS entry points and route `require` there, or remove the advertised CommonJS contract. Test installed-package ESM/CommonJS imports in supported Node versions. Review `sideEffects: false` against the p5 addon registration side effect, especially side-effect-only imports.

### B18 — Exception paths leak temporary styles and Canvas saves

**Locations:** Polygon override methods; `withHatchStyle()`; `createMass()`; `FillPoly.fill()`.

State restoration occurs only after successful execution. A throwing custom pressure/field callback, unknown brush, geometry error, or GL/Canvas exception can leave temporary stroke/hatch/field/fill state active. Fill's `ctx.save()` is not protected by a matching `finally`.

**Fix:** Use scoped helpers with `try/finally`; test a deliberate throw at each entry point and then verify state/transform/drawing recovery. This matters before enabling more aggressive batching.

### B19 — Growth cap fast path is incorrect beyond step 2

**Location:** `src/fill/fill.js:478–494`.

For any even downsample step, `skipInserted` returns all original trimmed vertices. That matches step 2, but step 4/6/... must also discard some **original** vertices. With `len = 5000`, `GROW_CAP = 2024`, step is 6: the shortcut returns 5000 vertices instead of roughly 1667. The cap is bypassed, changing both work and geometry.

**Fix:** Restrict the shortcut to step 2, or subsample original vertices by step/2 while preserving intended RNG consumption. Test inputs already above the cap, including large SVG contours.

### B20 — GL shader resource/error handling is incomplete

**Location:** `src/core/gl/utils.js:10–20`.

Shader objects are created/attached but never marked for deletion. Deleting programs later is not a substitute for deleting shader objects. Compile/link status is unchecked, so failures surface as later WebGL errors rather than helpful exceptions.

**Fix:** Check status/logs, detach/delete shaders after linking, and release all partial allocations on failure. Add a disposal contract for standalone shader/VAO/framebuffer resources. Context restoration also needs explicit invalidation; identity comparison alone does not detect a restored context with invalid old handles.

### B21 — Exceptions in image onload bypass promise rejection

**Locations:** `src/adapters/p5/stroke.js:21–33`; `src/adapters/standalone/stroke.js:169–175`.

The asynchronous `onload` callback runs outside the Promise executor. If drawing/readback/preprocessing throws, it raises an event-handler error but does not resolve/reject the loading Promise. Awaiting `brush.add()` can remain pending indefinitely.

**Fix:** Wrap onload processing in try/catch and reject. Cache in-flight loads by source to avoid duplicate concurrent work. Test network failure and deliberate preprocessing/readback errors.

### B22 — Image-tip preprocessing discards source alpha

**Location:** `src/stroke/stroke.js:934–943`.

Alpha becomes `255 - averageRGB`, ignoring original alpha. Transparent black PNG pixels become fully opaque ink, producing unwanted rectangular backgrounds or halos.

**Fix:** Multiply inverted luminance by original alpha (with explicit desired semantics for partially transparent pixels). Test opaque white/black, transparent black, and anti-aliased PNG edges.

### B23 — Custom tip push/pop restores transforms but not styles

**Location:** `src/adapters/standalone/stroke.js:44–49` and style setters.

Styles live in `_fillStyle`, `_strokeStyle`, and `_lineWidth`, but push/pop only save/restore the Canvas context. These JS properties persist after pop, so the next `_paint()` reapplies the nested styles instead of restored outer styles. Custom tips render differently from the p5 adapter.

**Fix:** Store/restore the wrapper style fields alongside Canvas state. Add nested-style tip tests shared by both adapters.

### B24 — Random integers use truncation instead of floor

**Location:** `src/core/utils.js:136–137`.

At audit time, `~~rr(-10,10)` truncated negative values toward zero. It could not generate -10, while 0 had twice the probability mass of most integers. Negative-only ranges could also return the excluded upper bound. Several built-in fields and angle jitter use negative ranges, so the distribution was observably asymmetric.

**Status: Fixed.** `randInt()` and `randInt2()` now floor their existing uniform RNG samples. This also removes signed 32-bit wrapping from the integer conversion. The user approved seeded artwork changes; the PRNG and random-call count are unchanged.

**Fix:** Use floor with defined half-open integer-range semantics and finite/bounded input handling. Expect seeded visual changes; document/version them. Weighted numeric-key conversion also warrants review (`parseInt('1.5')` returns 1 rather than 1.5).

## 5. Additional risks requiring targeted validation

These are not counted as independently reproduced defects above:

- **p5 multi-instance isolation:** lifecycle activation changes selected Instance but existing Renderer readiness/global brush state may survive. The current dedicated instance/async/offscreen tests are not part of `npm test`. Automate them with explicit target/color assertions before changing target caching.
- **p5 framebuffer density:** `syncDensity()` reads renderer density, not necessarily the active framebuffer's density. Exercise different framebuffer/parent densities and dimensions.
- **Host GL interop:** `withScissor()` disables scissor without preserving a pre-existing state; standalone draw paths change blend/program/VAO/texture/framebuffer state without a comprehensive documented contract. Verify expected state restoration with a host renderer and p5 clipping.
- **Arc containment:** mass tests only seven samples along a candidate arc. Narrow holes/concave notches can lie between samples. Use edge/arc intersection checks if containment is promised.
- **Fill scatter containment:** moving a point partway toward a randomized centroid does not guarantee membership for concave shapes or an outside centroid. The source comment claims a guarantee that the algorithm does not establish.
- **Workers:** OffscreenCanvas is accepted, but warning scheduling uses global `requestAnimationFrame`, and image loading requires `Image`. Establish the supported worker environments and use `createImageBitmap`/safe scheduling where appropriate.
- **Mutable inputs/caches:** brush `add()` mutates the supplied parameter object; polygon intersection caching is unbounded and assumes geometry does not change. Define ownership/mutation contracts or clone/invalidate/bound caches.
- **Maximum point size:** circles use `gl.POINTS`; very large brush diameters may exceed `ALIASED_POINT_SIZE_RANGE`. Query capabilities once and use quads for oversized tips.
- **Failed target load:** p5 load changes Renderer before validating WebGL version; failed operations should leave the old session usable.

## 6. Testing gaps and recommended regression suite

`test/e2e/smoke.mjs` loads only the two visual suites, waits five seconds, checks errors, and checks canvas/context existence. It does **not** assert final pixels, shape geometry, bounded runtime, GPU errors, target isolation, heap/resource growth, or performance budgets. A blank/incorrect image can pass. A next-rAF timestamp in the existing first-frame profiler is also not a reliable isolated GPU timer: it includes scheduling and other frame work.

### Immediate tests

1. **Geometry/unit tests:** two-point/degenerate splines, scaled genPol bounds, random-order pressure queries, empty polygons, negative-range RNG.
2. **Deterministic pixels:** clip/noClip, zero opacity, explicit polygon overrides, density 1/2 image/custom tips, rotated asymmetric tips, mirrored/nonuniform transforms.
3. **Bounded-runtime tests:** invalid spacing/length, zero-pressure spray, zero-scatter mass. Run dangerous cases in an isolated page/process with an external watchdog.
4. **Target lifecycle tests:** A→B→A, pending and flushed work, clear-before-draw, resize, density changes, active framebuffers. Assert `gl.getError() === 0` at controlled boundaries.
5. **Exception recovery:** throw from user callbacks; assert restored state and successful subsequent rendering. Loading promises must settle on every failure.
6. **Resource counters:** repeated load/add/resize/remove; assert no unbounded texture/framebuffer/program/shader growth.
7. **Package integration:** script-tag UMD, ESM import, CommonJS require, and bundler tree-shaking/addon registration.
8. **Automate existing dedicated pages:** instance mode, multi-instance async, offscreen targets, hatch-array regression, push/pop, transforms, angle modes, wash, and fill angles, using explicit completion signals rather than arbitrary sleeps.

### Performance coverage

Use a fixed seeded corpus: straight/curved lines for every brush family; cold/warm custom/image tips; simple/complex/holed polygons; hatch and mass; watercolor and wash; targets at 512, 1024, 2048 with densities 1/2. Track CPU submission, full completion, draw/flush counts, upload bytes, resource allocation, retained memory, and disjoint GPU timers where supported. Run separate non-profiled timing sessions on physical GPUs; compare median/p95, not one first frame. Establish tolerances from repeated CI/hardware measurements, not these SwiftShader numbers.

## 7. Suggested implementation sequence

| Phase | Work | Acceptance criteria |
|---|---|---|
| 1 — Safety/correctness | B01–B09, B15, exception guards | No hangs; clipping and shape/opacity/density tests pass |
| 2 — Runtime lifecycle | B10–B14, B17, B20–B23 | Target switches produce no GL errors; repeated loads do not accumulate owned resources; promises settle |
| 3 — Low-risk perf | Cache straight movement; skip unused pool work; cache bounds; reduce staging allocation/state queries where ownership is explicit | Measured gains without unexplained seeded/pixel changes |
| 4 — Architectural perf | Internal hatch/mass batching; fill pass/state design | Significant draw/flush reduction; host interleaving and color order tests pass |
| 5 — Optional quality tradeoffs | Fill layer settings, spectral precompute/LUT variants | Documented output/quality differences and hardware-GPU measurements |

**Bottom line:** The library already has good low-level buffering optimizations. The next substantial gains are likely at **stroke/flush granularity and compositor lifecycle**, while the most urgent work is making existing behavior correct and bounded. Fix those invariants before allowing larger cross-stroke batches.

## 8. Bug-fix progress and handoff

### Scope and compatibility constraint

This pass fixes correctness defects only. It does **not** implement the performance proposals, alter brush presets, change the PRNG, reduce watercolor layers, change spectral mixing, or change stroke batching/compositing boundaries. Correcting broken clipping, transforms, opacity and geometry necessarily changes those formerly incorrect outputs. The user subsequently approved changes to seeded artwork for B24; fixing signed integer sampling is now included. Users needing the previous artwork can pin the previous library version.

**Implementation state:** changes are in the working tree, not committed. Build outputs are generated by `npm run build`. The original findings and benchmark numbers above remain a historical baseline, not a post-fix performance claim. `.gitignore` now makes this audit document trackable while retaining the ignore rule for other workspace scratch files, so the handoff notes can travel with the implementation.

| Bug | Status | Implementation / verification |
|---|---|---|
| B01 | **Fixed** | `hatch.js` rejects non-positive/non-finite distance and non-finite angle, and guards non-advancing/excessive scans. `mass.js` substitutes 0.1 only for invalid/non-positive internally derived spacing; all positive existing spacing is preserved. Regression exercises invalid hatch values and zero-scatter mass. |
| B02 | **Fixed** | `stroke.js` validates registration/scaling/drawing spacing and finite stroke inputs before allocating work; zero-pressure spray emits no dots; non-finite/excessive spray work and pressure are rejected. Safety ceilings: 10 million stroke/sample steps and 1 million spray dots per tip; hatch has a 1 million scanline ceiling. Focused regression covers former hangs. |
| B03 | **Fixed** | `stroke/clip.js` and both stamp fragment shaders clip against bounds in the transform captured by `clip()`. Clip state is saved with stroke push/pop; `noClip()` clears it. Tests verify transformed clipping, pop/reset, and density-2 custom tips. |
| B04 | **Fixed** | Image/custom quad half-size is now logical, not density-scaled before projection. Dirty bounds remain physical. Regression measures a 20-unit tip at densities 1 and 2 and after reload. |
| B05 | **Fixed** | Image/custom vertices inherit the full 2×2 affine basis; circle tips use an inverse-basis fragment mask only for nonuniform/sheared transforms. Ordinary circular/uniform rendering keeps the original path. Regression verifies rotated/nonuniform custom tips and nonuniform circle tips at densities 1 and 2; legacy scene fingerprints verify ordinary rendering. |
| B06 | **Fixed** | `_createSpline()` treats two points as a straight segment regardless of curvature. Regression asserts the correct nonzero plot length. |
| B07 | **Fixed** | `genPol()` applies scale to path traversal, step count and spacing reference; scale-1 math is retained. Regression compares scale-1/scale-2 extents. |
| B08 | **Fixed** | Polygon fill/draw overrides gate on the newly active state and restore outer state in `finally`. Tests exercise explicit calls after `noFill()`/`noStroke()`. Omitted bleed in an explicit fill no longer feeds undefined into the bleed calculation. |
| B09 | **Fixed** | Fill opacity uses `??`, and zero-opacity fill exits before independent border layers can add pigment. Regression asserts a white destination remains unchanged. |
| B10 | **Fixed** | Standalone target activation flushes the old session before switching, then installs the new target's mask references before clear/draw. Owned active stroke programs are unbound before deletion during GL-context switching. Regression verifies pending A→B→A work and no foreign-handle GL errors. |
| B11 | **Fixed** | Standalone renderer/resource wrappers are reused per canvas via WeakMap; logical dimensions/density survive reload. Standalone initialization marks the renderer ready. Regression asserts zero new textures on same-canvas reload and unchanged density semantics. No new public disposal API is introduced. |
| B12 | **Fixed** | Field dimensions are checked on readiness; size changes invalidate cached grids and regenerate the active field. Defaults are initialized once instead of reinstalled on resize. Regression uses two aspect ratios to verify row counts. |
| B13 | **Fixed** | Movement no longer freezes outside the canvas/field; out-of-field movement uses zero field deflection and advances the requested steps. Regression starts outside and traverses into the canvas. |
| B14 | **Fixed** | Public `pressure(d)` updates its cached segment index independently of `angle()`. Regression reproduces the previous -1.5 vs expected 1.5 result. |
| B15 | **Fixed** | Fill exits for fewer than three vertices; mask drawing safely clears an empty path rather than dereferencing the first vertex. Empty polygon fill regression passes. |
| B16 | **Fixed** | Standalone CSS parsing accepts browser-normalized rgba and preserves alpha; other supported serialized color spaces use Canvas readback. Regression covers transparent, alpha hex, modern rgb syntax and invalid CSS. |
| B17 | **Fixed** | Rollup emits dedicated `.cjs` outputs; package `main` and `require` exports point to them. Browser UMD and ESM paths remain unchanged. Both package CommonJS entry points are asserted to expose the brush API. |
| B18 | **Fixed** | Polygon overrides, hatch style, mass state, fill/wash Canvas state and custom-tip push/pop use scoped restoration. Failed stroke generation discards only its queued stamps so they cannot contaminate the next stroke. Regression checks failed overrides/hatches and a throwing pressure callback followed by valid rendering. |
| B19 | **Fixed** | The growth shortcut is restricted to step 2; larger even steps use the existing general downsampling path, including original-vertex reduction. Direct original-vs-fixed watercolor pixel comparison confirms ordinary output is preserved within the original native raster variation. |
| B20 | **Fixed (reported shader defect)** | Shader compilation/link status is checked; shader objects are detached/deleted, failed programs cleaned up, and error logs propagated. Both adapters compile and pass the existing smoke suites. Context restoration and broader GL ownership remain follow-up risks in §5; they are not claimed fixed. |
| B21 | **Fixed** | Both image onload handlers catch preprocessing errors and reject. Failed sources are removed from the pending tip registry so unrelated subsequent loads are not poisoned. Regression forces a processing failure and then loads a valid image. |
| B22 | **Fixed** | Tip conversion multiplies inverted luminance by original alpha. Opaque input is unchanged. Regression verifies transparent black stays transparent around an opaque center. |
| B23 | **Fixed** | Standalone tip push/pop stores/restores wrapper fill, stroke and line-width fields together with Canvas state. Regression verifies rendered fill after nested style changes. |
| B24 | **Fixed — seeded changes approved** | `src/core/utils.js` uses `Math.floor(rr(...))` and `Math.floor(rr2(...))`. This restores integer range endpoints, removes the zero bias and avoids 32-bit wrapping, without changing either RNG or its call count. One focused regression compares both helpers against their reseeded uniform streams for mixed-sign, negative-only, non-negative and above-32-bit integer ranges. The field-scene fingerprint is intentionally updated and annotated; all other rendering references remain unchanged. |

### Verification performed after fixes

`npm test` passes:

- Build, including ESM, browser UMD and the new CommonJS outputs.
- Focused `test:bugs` suite (11 grouped browser audited-failure scenarios, B24 integer-sampling regression, and CommonJS assertions).
- Existing p5 and standalone smoke suites.

The only added tests are direct regressions for these fixes and a pre-fix rendering compatibility check. No benchmark suite or broad coverage expansion was added.

**Rendering compatibility:** fixtures were captured from the original `43ac6d5` source before fixes (watercolor reference independently rebuilt from that commit). Standard brushes, curves, wash, hatch and mass scenes retain the original exact pixel fingerprints. The field scene has a new, explicitly annotated fingerprint for the approved B24 sampling correction; it is no longer claimed identical to the pre-fix field. Watercolor already exhibits tiny native raster/derivative variation across executions of the original build, so it uses a narrowly bounded pixel comparison: at most 256 changed channels and total absolute difference 1024 over 262,144 channels. A direct original/fixed comparison measured 62 changed channels, total difference 198, maximum channel difference 14. The native variation is not a rewritten artistic algorithm or an updated-to-pass baseline.

### Remaining work

- No B01–B24 fixes remain deferred. B24's seeded-output change is approved and recorded; release notes should mention that signed field variation and randomized angle jitter can differ for existing seeds.
- Additional risks in §5 remain follow-up investigation, not completed fixes.
- The subsequent optimization pass is tracked separately in §9; proposals outside appearance-risk orders 1–4 remain untouched.
- Run on real GPUs and other supported browsers before release; the automated rendering checks here use Chromium/SwiftShader.

## 9. Low-risk optimization progress (appearance-risk orders 1–4)

Keep this separate from bug status and the original P1–P7 priority numbering. Changes preserve the current post-B24 RNG stream and drawing/compositing order. No batching, spectral-model change, reduced layer count or Gaussian-pool change is included.

| Order | Status | Implementation |
|---|---|---|
| 1 — Mass geometry | **Completed; tests pass** | `src/hatch/mass.js` scans bounds once per mass layer, passes the resulting size to all arc-center bias calculations, and avoids temporary `flatMap` point arrays. Bounds are local to a pass, not a persistent mutable-geometry cache. Arc containment/sampling is unchanged. |
| 2 — Straight strokes | **Completed; tests pass** | `src/stroke/stroke.js` caches the existing LUT-derived dx/dy for straight no-field strokes. Repeated additions, pressure cadence and RNG work remain unchanged. Field/plot movement stays on the existing path; a field activated by a callback triggers fallback. |
| 3 — GL queries/clears | **Completed; tests pass** | `src/core/color.js` skips clearing masks already known clean. Standalone clears bind only DRAW framebuffer and do not query/change viewport (clear is viewport-independent). Fill-mirror clears are restricted to the previous upload region; p5 still uses its existing full-clear/state-preserving adapter path. No general GL-state cache/interception framework was added. |
| 4 — Fill staging | **Completed; tests pass** | `src/fill/composite.js` reuses up to four exact-size staging canvases, evicting oldest entries. Identical crops and the existing DOM-source upload overload are retained. This bounds entry count but can retain up to four surfaces instead of one; no unbounded pool or new upload semantics. |

**Verification complete:** `npm test` passes (build, focused regressions, p5 smoke, standalone smoke). Existing rendering references are unchanged. Three necessary optimization-path references were added—array mass with a hole, non-axis straight strokes, and successive differently sized/disjoint washes—captured from an independently rebuilt pre-optimization/post-B24 snapshot, not from optimized output. All nine exact scene hashes match that snapshot. One focused regression verifies that alternating fill sizes reuse staging surfaces and remain valid at densities 1/2; no CI timing thresholds or general coverage expansion was added.

A direct 512×512 three-watercolor-rectangle comparison differed in only 107 of 1,048,576 channels, total absolute difference 608, maximum channel difference 20, consistent with the already observed tiny native raster variation. Both contexts reported zero GL errors. Details: `workspace/optimization-verification.json`; reproducible comparison script: `workspace/optimization-verify.mjs`.

**Baseline captured before these changes:** `workspace/optimization-bench.mjs` and `workspace/optimization-baseline.json` use the post-B24 code, seven measured iterations after two warmups, 512×512 density 1, Chromium/SwiftShader, no CPU profiler. They count GL calls and staging allocations. These original timings included reset and `gl.finish()` but omitted pixel readback. They are superseded for end-to-end comparisons: the corrected harness drains both warmups and includes full readback in every timed iteration. These workspace benchmark artifacts remain scratch files, not new CI tests.

### Timing correction — the 200× fill speedup claim is withdrawn

The user challenged the reported 1.6 s → 7–8 ms result. Pixel readback **inside every measured iteration** demonstrated that the comparison primarily measured a change in where execution blocked, not elimination of rendering work. In this Chromium/SwiftShader setup, `gl.finish()` alone did not include completed GPU output in the timed interval. The original warmups were also undrained.

**Do not quote the earlier 200× figure as a rendering speedup.** That end-to-end interpretation was incorrect and is explicitly retracted. The earlier 9–11% HB / 8–10% hatch / 3–7% array-mass comparisons also omitted pending work and are superseded below.

Corrected diagnostics: `workspace/optimization-before-readback.json`, `workspace/optimization-after-readback.json`, and the corresponding `*-readback-rest.json` files. Both versions use two readback-drained warmups and seven measured iterations, with a reused 512×512 RGBA buffer read after every draw. The interval includes GPU waiting and readback/copy overhead; it is not a pure GPU timer. These are **Chromium/SwiftShader** observations, not real-GPU promises.

| Workload | Before: completed work + readback | After: completed work + readback | Interpretation |
|---|---:|---:|---|
| HB straight lines | 61.8 ms | 59.1 ms | About 4% lower in this run; smaller than the original incomplete comparison. |
| Marker lines | 266.5 ms | 265.5 ms | Essentially unchanged. |
| Hatch rectangle | 100.4 ms | 101.6 ms | Essentially unchanged/slightly slower; no confirmed end-to-end hatch gain. |
| Three watercolor rectangles | 1,590.7 ms | 1,651.3 ms | No rendering speedup; about 4% slower in this run. |
| Simple rectangle mass | 339.4 ms | 333.6 ms | About 2% lower in this run; no substantial speedup claimed. |
| Small eight-vertex array mass | 80.5 ms | 81.3 ms | Essentially unchanged/slightly slower. |

Median phases for fill:

| Phase | Before | After |
|---|---:|---:|
| Drawing calls + `finish()` | 1,488.3 ms | 7.7 ms |
| Subsequent blocking readback | 101.8 ms | 1,643.8 ms |
| Entire measured interval | 1,590.7 ms | 1,651.3 ms |

Individual phase medians need not add exactly to the total median. Most of the apparent gain moved into readback waiting. Lower submission-side blocking is **not** proof of higher completed-frame throughput or FPS.

**Work counters remain valid across seven iterations:** stroke/hatch/mass queries dropped from 91 to 42 and clears from 35 to 14. Fill queries dropped from 770 to 504 (35% fewer) and clears from 182 to 91 (50% fewer); mirror clears touch only the previous upload region. Fill still performs exactly 84 uploads and 84 composite draws. Fewer calls alone do not establish an end-to-end speedup.

**Staging reuse remains verified:** repeated alternating-size wash uploads allocate at most two staging surfaces in six uploads per density. Randomized watercolor cycles through too many crop sizes for the four-entry cache; its allocation count remains 70 across seven iterations. The cache was not enlarged to chase the benchmark. Capacity is entry-bounded, not a fixed byte budget.

**Rendering correctness is unaffected by the timing correction:** exact scene references still match, the watercolor tolerance passes, and both adapter smoke suites pass. No library code was changed to obtain corrected timings.

**Remaining validation:** physical GPUs, other browsers and p5 performance. Use readback-drained measurements or appropriate GPU timers, not `finish()` alone. Investigate slight regressions; do not claim every workload benefits. No batching, shader approximation, pool/RNG changes or quality reduction was included.


