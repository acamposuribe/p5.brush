# Rendering model and architecture audit

**Recorded:** 2026-10-27  
**Project:** p5.brush  
**Purpose:** Assess whether the underlying drawing model is still appropriate, and identify a path to better performance, more convincing natural media, and a simpler implementation.  
**Status:** Investigation and recommendations only. No rendering changes were implemented by this audit.  
**Plan:** The actionable sequence, decisions, and acceptance criteria live in [`rendering-plan.md`](rendering-plan.md). This document is the supporting evidence and background.

## Executive summary

The library does not need to be replaced by a machine-learning model, a fluid simulator, or an entirely different graphics API. Its principal choices remain reasonable:

- Stamp-based rendering is a standard, useful approach to expressive brushes.
- Spectral Kubelka–Munk colour mixing is a strong foundation for paint-like colour behaviour.
- Tyler Hobbs-style deformed polygons are an effective, art-directable way to generate watercolour washes.
- Generating hatch and mass strokes as geometry is appropriate for a generative-art library.
- WebGL2 remains a practical browser target, especially when interoperating with p5.

The largest weakness is **the way fine marks are represented and rasterised**. Most built-in pencil, pen, charcoal, and spray stamps are smaller than one device pixel. They are submitted as `gl.POINTS`, whose minimum supported raster size in the test environment is one device pixel. The resulting texture is strongly affected by rasterisation limits rather than only by the intended brush model. In a controlled experiment, the same seeded HB line deposited approximately **3.6 times less integrated darkness per logical area at pixel density 2 than at density 1**.

The next major weakness is **too much CPU work and too many submissions for coherent strokes**. A 300×300 HB mass issued 1,550 point-draw submissions plus one composite draw. It took approximately 251 ms in the software-rendered diagnostic environment. This is evidence for investigating cross-stroke batching, not a hardware-GPU speed estimate.

Because the software renderer cannot show whether CPU tip generation or GL submission dominates on real GPUs, batching should follow a hardware profile rather than precede it.

The recommended order (detailed in [`rendering-plan.md`](rendering-plan.md)) is:

1. Commit the measurement harness and re-baseline on 2.3.0.
2. Decide the reference pixel density for preset appearance.
3. Prototype the subpixel coverage fix, in classic mode as a bug fix.
4. Land small, low-risk fixes (angle truncation, `sideEffects`).
5. Profile on hardware GPUs.
6. Batch across strokes if the profile supports it.
7. Time-box a segment-renderer spike with explicit go/no-go criteria.

**Keep the artistic vocabulary and public API. Change the internal representation where it improves the result.**

---

## Contents

1. [Scope, provenance, and evidence](#1-scope-provenance-and-evidence)
2. [Current rendering model](#2-current-rendering-model)
3. [Measurements](#3-measurements)
4. [Findings](#4-findings)
5. [Proposed rendering model](#5-proposed-rendering-model)
6. [Architecture and simplification](#6-architecture-and-simplification)
7. [Alternatives and research](#7-alternatives-and-research)
8. [Implementation roadmap](#8-implementation-roadmap)
9. [Verification and acceptance criteria](#9-verification-and-acceptance-criteria)
10. [Reproduction notes](#10-reproduction-notes)
11. [References](#11-references)

## 1. Scope, provenance, and evidence

### 1.1 Repository state

The dynamic measurements were taken from an uncommitted pre-2.3.0 build of `dist/brush.esm.js`, not from a clean 2.3.0 checkout. The source findings were checked against 2.3.0 (`ca19980`), and the mechanisms they describe are present in that release.

Treat the numbers in §3 as indicative only. The first step of the plan is to commit the harness and re-run it on a clean 2.3.0 build, recording the commit, bundle hash, browser version, and renderer. That run becomes the baseline.

### 1.2 Reviewed areas

The source review concentrated on:

- `src/stroke/stroke.js`: brush definitions, path stepping, pressure, randomness, and tip generation.
- `src/stroke/gl_draw.js` and stroke shaders: circle points, instanced image stamps, transforms, clipping, dirty rectangles, and buffer upload.
- `src/core/color.js` and `src/core/gl/shader.frag`: mask lifecycle, composite boundaries, spectral mixing, edge effects, and background handling.
- `src/fill/fill.js`, `mask.js`, `composite.js`, and `wash.js`: watercolour growth, mask drawing, erasure, upload, and solid washes.
- `src/hatch/hatch.js` and `mass.js`: scanline hatching and mass stroke generation.
- `src/core/plot.js`, `flowfield.js`, `utils.js`, and relevant primitive code: sampling, pressure lookup, movement, randomness, and trigonometry.
- The p5 and standalone runtime/compositor/renderer integration paths.
- Public entry points, documentation, existing test/profiler infrastructure, and earlier local audit artefacts.

This is a rendering-model audit, not an exhaustive defect, security, accessibility, or browser-compatibility audit.

### 1.3 Evidence categories

The report distinguishes:

- **Observed:** measured in the browser experiment.
- **Source-derived:** follows from the implementation, but was not separately isolated by a dynamic test.
- **Proposal:** a direction to prototype and benchmark.
- **Unverified:** a risk or expected benefit requiring additional investigation.

No alternative renderer was implemented, so proposed performance gains are not measured speedups.

### 1.4 Test environment and limitations

Dynamic experiments used:

- The standalone ESM distribution, `dist/brush.esm.js`.
- Headless Chromium launched through `playwright-chromium`.
- ANGLE/SwiftShader software rendering, as originally reported. The step 1 re-run found that the §3.1 density table matches an ANGLE Metal (Apple GPU) run exactly, including its point-size range of [1, 511], so that experiment most likely ran on Metal. The §3.2 workloads match SwiftShader.
- Logical canvas sizes of 400×120 and 512×512.
- Explicit pixel densities of 1 and 2 where indicated.
- Seeded random generation.
- Instrumentation around selected WebGL methods.

The temporary harness was not committed, and the exact browser version and bundle hash were not captured. The tables below preserve its results, but they cannot be reproduced exactly. §10 describes the experiment well enough to rebuild it as a committed script, which the plan requires before any rendering change.

Timing limitations:

- These are **software-renderer diagnostic timings**, not Apple, Windows, mobile, or discrete-GPU measurements.
- Method wrappers introduce overhead.
- The workload benchmark used one warmup and five measured iterations, reporting the median.
- Each workload ended with `brush.render()` and a synchronous 1×1 `readPixels()` from the current framebuffer. This supplies a readback boundary, but is not a substitute for isolated GPU timer queries.
- The density experiment included first-use setup and was not warmed consistently enough to support performance conclusions. Its timing column is intentionally omitted.
- Native GPU performance, peak memory, Safari, Firefox, and dynamic p5 interoperation were not measured in this model audit.

The earlier local `workspace/performance-and-bug-audit.md` concerns related bugs and optimisation work. It is useful historical context, but its old baseline timings and later corrected timings should not be conflated with this experiment.

## 2. Current rendering model

### 2.1 Stroke generation

A stroke is generated by walking a path at a brush-specific spacing. For example:

- Most pen and pencil presets: spacing `0.1` logical units.
- Charcoal: `0.03`.
- Marker: `0.03`.
- Spray: `0.5`, with many dots generated per path step.

At each step, the engine evaluates a pressure approximation and executes a brush-specific tip function:

- Default brushes probabilistically emit small circles, with directional dispersion, random size, and random alpha.
- Marker emits overlapping circles.
- Spray emits many small circles inside a dispersed footprint.
- Custom/image brushes emit textured stamps with instanced quads.

Pressure is cached for ten tip steps. The physical distance between pressure updates therefore varies with brush spacing rather than being a common distance across brushes.

Circle instances are written to a growing `Float32Array`. `restoreState()` flushes the circle buffer at the end of each stroke. Image stamps have a separate instanced path and texture cache.

### 2.2 Stroke masks and compositing

Stamps are drawn into a framebuffer-backed mask. Circle and image paths use:

```js
gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.ONE);
```

For alpha values in the usual range, this implements the coverage-union recurrence:

```text
A_new = A_old + a_stamp × (1 − A_old)
A_final = 1 − product(1 − a_stamp)
```

The final compositor principally uses the mask's alpha and a cached pigment colour, not the mask's accumulated RGB.

`Mix.blend()` determines when masks are spectrally composited into the drawing target. Important triggers include colour changes, drawing-mode changes in conjunction with composite work, explicit rendering/finalisation, and the fill engine's internal flushes.

Consequently, generating geometry, flushing GPU stamp buffers, and applying a pigment layer are distinct operations, though the current API and internal state do not always make that distinction explicit.

### 2.3 Spectral colour

The final blend shader:

1. Samples the existing drawing and mask.
2. Reconstructs 38-sample reflectance spectra from RGB colours.
3. Converts reflectance to Kubelka–Munk `K/S` values.
4. Mixes according to concentration-like weights.
5. Converts the result back to display RGB.

For dense stroke masks, an additional heuristic darkens the pigment above alpha `0.7`.

The shader reconstructs a visible background with:

```glsl
vec3 bgColor = mix(vec3(1.0), source.rgb, source.a);
```

and outputs alpha 1 wherever it applies pigment. This is an intentional-looking white-paper/opaque-result assumption, not a general transparent-layer compositing model. A future material system must decide whether to preserve that contract or expose transparent painting separately.

### 2.4 Watercolour fills

The watercolour engine follows the broad Hobbs approach:

- Start with a polygon.
- Repeatedly insert and displace vertices.
- Render many related low-opacity polygon layers.
- Add sparse and darker layers.
- Erase low-opacity circles to break up the wash.

`FillPoly.fill()` uses 20 main iterations. Its inner loop can draw several polygons per iteration, so this is not merely 20 polygon draws. It composites at iterations 0, 8, 16, and 19: **four mask upload/composite cycles per fill**.

Geometry is drawn into a Canvas2D mask, cropped through a staging canvas, and uploaded into a framebuffer texture for the spectral shader.

### 2.5 Hatching, mass, and flow

Classic hatching rotates polygons into scanline space, computes crossings, pairs them into segments, and delegates each segment to the stroke engine.

Mass builds several related stroke passes, often using arcs rather than straight lines. These still reach the same stroke generation and per-stroke upload path.

Flow fields are stored as angle grids and sampled at the nearest cell. Plot geometry is largely generated by integrating directions rather than directly evaluating conventional curve control points at arbitrary parameter values.

## 3. Measurements

### 3.1 Subpixel stamps and density dependence

For each brush, the experiment drew one horizontal line from `(-180, 0)` to `(180, 0)` at weight 1 on a logical 400×120 canvas. Both random and noise generators were seeded with 1.

WebGL uploads were inspected for intended point diameters before hardware point-size clamping. The context reported:

```text
ALIASED_POINT_SIZE_RANGE = [1, 511]
```

The canvas result was copied over white into a Canvas2D surface. Integrated darkness was calculated as:

```text
D = sum((255 − redChannel) / 255) / density²
```

For a black mark on white, `D` is a convenient scalar measure of total displayed darkness normalised to logical area. It is not pigment mass, a perceptually uniform colour metric, or a calibrated reflectance measurement.

| Brush | Submitted points | Intended diameter at density 1, p10 / median / p90 (device px) | Fraction below 1 device px at density 1 | Darkness at density 1 | Darkness at density 2 | d1 / d2 |
|---|---:|---|---:|---:|---:|---:|
| HB | 2,408 | 0.221 / 0.265 / 0.346 | 100% | 416.7 | 117.0 | 3.56× |
| 2B | 2,840 | 0.223 / 0.279 / 0.368 | 100% | 505.8 | 152.3 | 3.32× |
| pen | 2,651 | 0.271 / 0.327 / 0.415 | 100% | 413.5 | 118.3 | 3.50× |
| charcoal | 12,000 | 0.296 / 0.366 / 0.450 | 100% | 921.7 | 409.8 | 2.25× |
| marker | 12,018 | 1.700 / 1.789 / 2.331 | 0% | 61.2 | 66.0 | 0.93× |
| spray | 34,410 | 0.184 / 0.200 / 0.216 | 100% | 2,697.6 | 915.2 | 2.95× |

At density 2, intended diameters approximately doubled, but all captured HB, 2B, pen, charcoal, and spray diameters were still below one device pixel. Marker remained above that threshold and its total darkness was much more stable.

Interpretation:

- **Observed:** substantial density-dependent changes for fine-dot brushes.
- **Source-derived explanation:** point-size clamping and the existing shader do not preserve subpixel coverage as intended size changes below one pixel.
- **Not established:** that every visual difference is caused exclusively by point-size clamping. Antialiasing, alpha accumulation, spectral nonlinearities, and Canvas readback also participate.

The measured stamp counts remain the same at both densities, as expected from logical-coordinate path stepping.

### 3.2 Workload timings and GL submissions

> **Correction (step 1 re-baseline).** The times below measure only the CPU side: they match the time for drawing calls to return, not the time until GPU work completes. Re-measured on 2.3.0 with a blocking readback, fill takes about 800 ms of GPU time on SwiftShader and about 9 ms in total on an Apple M4. Mass is almost entirely CPU-bound on the M4: 247 of 250 ms, with about 6 ms inside WebGL calls. The call counts below are confirmed exactly. See `test/e2e/baselines/` and the step 1 results in [`rendering-plan.md`](rendering-plan.md).

All workloads used a logical 512×512 canvas at density 1. Each ran once to warm up, followed by five measured runs. Clearing and reseeding were outside the timed section. Rendering and a 1×1 readback were inside it.

| Workload | Geometry and style | Median time | Point-buffer uploads (`bufferSubData`) | Total `drawArrays` calls | Source blits | Fill uploads |
|---|---|---:|---:|---:|---:|---:|
| Lines | 100 horizontal 400-unit 2B lines, weight 1 | 27.7 ms | 100 | 101 | 1 | 0 |
| Hatch | 400×400 rectangle, HB, spacing 3, angle 45°, including active outline | 39.7 ms | 184 | 185 | 1 | 0 |
| Mass | 300×300 rectangle, HB, default mass options, no outer stroke | 251.4 ms | 1,550 | 1,551 | 1 | 0 |
| Fill | 300×300 rectangle; opacity 150, bleed 0.3, texture 0.6, border 0.4; no stroke | 12.3 ms | 0 | 4 | 4 | 4 |

The final measured iteration reported these additional `getParameter()` counts:

| Workload | `getParameter()` calls |
|---|---:|
| Lines | 6 |
| Hatch | 6 |
| Mass | 6 |
| Fill | 24 |

Buffer reallocations were zero in the measured iterations after warmup. Counts above are per iteration, not totals across all five runs.

These workloads use circle-based presets. They do not measure `drawArraysInstanced()` for custom/image tips.

### 3.3 What these results do and do not show

The measurements support three concrete conclusions:

1. Fine brushes have a density-invariance problem.
2. Hatching and mass generate many individually submitted strokes despite one eventual colour composite.
3. The current fill implementation performs four upload/composite cycles per fill.

They do **not** establish:

- A tenfold batching speedup.
- A thousandfold renderer speedup.
- That fill is universally inexpensive on physical GPUs or high-resolution exports.
- That GPU shader cost dominates over CPU generation, driver submission, or synchronisation.
- That an alternative algorithm preserves the current appearance.

## 4. Findings

### F01 — Fine brushes depend on point rasterisation limits

**Priority:** High  
**Evidence:** Observed and source-derived  
**Files:** `src/stroke/gl_draw.js` (`circle()`, `glDraw()`), `src/stroke/shader.vert`, `src/stroke/shader.frag`, built-in presets in `src/stroke/stroke.js`

`shader.vert` sets `gl_PointSize = a_radius * 2.0` with no lower bound or compensation. When the rasteriser clamps a 0.2 px point to 1 px, that point produces one fragment. `gl_PointCoord` for that fragment lies within about 0.7 of the point centre, so the soft-disk calculation in `shader.frag` still gives it a large share of the stamp alpha. The fragment shader never receives the intended diameter, so it cannot scale alpha down to the requested area.

As a result, every fine-brush dot covers about one device pixel whatever its intended size. That pixel is one logical pixel² at density 1 and a quarter of one at density 2. The near-4× ratio measured in §3.1 matches this.

**This is a bug in classic mode, not only a limitation for a future engine.** The same seeded sketch currently looks roughly 3.5× darker on a density-1 screen than on a density-2 screen. Fixing it necessarily changes the look at one density or the other. The presets therefore need a declared **reference density**: the density at which current appearance is treated as intended and preserved. This decision is open; see the plan.

Maximum point size is also implementation-dependent. Large brush weights, strong transforms, or high-density exports can exceed it. Query the actual range; do not hardcode 511 from this experiment.

**Recommended response:**

- Add density-invariance regression tests before retuning presets.
- Prototype explicitly filtered subpixel coverage using quads or a corrected point path.
- Preserve the requested physical radius separately from the raster support size.
- Provide a quad fallback when the intended size exceeds the implementation's point limit.
- Evaluate not just total darkness but width, edge softness, and spatial grain.

The first prototype is small and should be built first, because it is the cheapest way to see how much appearance changes:

```glsl
// shader.vert — sketch, not implemented
float d = a_radius * 2.0;                 // intended diameter, device px
float size = max(d, MIN_SUPPORT);         // MIN_SUPPORT: 1.0 to start; 1.5 worth testing
gl_PointSize = size;
v_alpha = a_alpha * min(1.0, (d * d) / (size * size));
```

This approximates area-correct coverage. It is not an exact fix: overlap saturation, pixel alignment, filtering, and nonlinear colour mixing mean that matching total darkness does not guarantee the same image. The code is small, but the visual recalibration that follows is the real cost. Presets that look right at the reference density must be checked at the other densities.

### F02 — Coherent strokes are overrepresented as independent random dots

**Priority:** High for scalability and realism  
**Evidence:** Observed counts and source-derived behaviour  
**Files:** `src/stroke/stroke.js` (`draw()`, `drawDefault()`, `drawMarker()`, `drawSpray()`)

The default model uses many small circles to approximate a continuous mark. Each accepted mark involves random sampling, position/size/alpha calculations, CPU affine transformation, buffer writes, and dirty-bound updates.

The count is large even for simple shapes. A single 360-unit marker line submitted over 12,000 circles. A spray line submitted over 34,000.

This is not inherently wrong for particulate media. It is a poor universal representation for effects that can be expressed as a continuous stroke footprint with textured deposition.

The current grain is predominantly regenerated for each stroke. It does not encode a persistent substrate where the same paper peaks and valleys affect overlapping marks.

**Recommended response:**

- Use continuous segment coverage for pens and markers where possible.
- Model pencil/charcoal deposition as a function of coverage, pressure, persistent paper height, and stroke-specific noise.
- Retain particles where discrete grains or droplets matter, particularly spray.
- Keep custom/image stamps as a first-class brush type; the existing instanced-quad path is already a useful foundation.

### F03 — Batching stops at each stroke

**Priority:** High  
**Evidence:** Observed draw counts  
**Files:** `src/stroke/stroke.js` (`restoreState()`), `src/stroke/gl_draw.js`, `src/hatch/hatch.js`, `src/hatch/mass.js`

`restoreState()` flushes every completed stroke. Thus, one hatch or mass operation can issue hundreds or thousands of buffer uploads and draws before one final spectral composite.

There is a strong opportunity to queue compatible stamps across multiple strokes and draw larger batches.

**Compatibility constraints:**

A batch must account for at least:

- Destination context and framebuffer.
- Brush mask/composite mode and pigment colour.
- Circle versus image path, and image texture identity.
- Clip state and clip transform.
- Affine transform data currently supplied as uniforms.
- Antialiasing/material settings introduced by a future renderer.
- Explicit render calls and interleaved host drawing.

Currently, `snapshotMatrix()` in `gl_draw.js` captures the affine transform once per stroke. Positions are transformed on the CPU, but the circle-shape inverse (`u_tipInverse`, `u_affineCircle`) and the image linear transforms remain uniforms. Merely deleting `glDraw()` at stroke end would apply a later stroke's uniforms to earlier queued data. Batching therefore requires one of two things: move those values into per-instance data, or flush only when the transform, colour, clip, or tip actually changes. This is a real refactor, not a one-line removal.

**Profile on a hardware GPU first.** A single marker line generates over 12,000 circles on the CPU, and a spray line over 34,000. The step 1 re-baseline confirmed this on an Apple M4: mass generates 1.6 million circles, and only about 2% of its 250 ms is spent in WebGL calls. Batching does not reduce tip generation, so on that hardware it cannot deliver much.

Preserve RNG ordering for the classic engine. The alpha recurrence is commutative in exact arithmetic, but finite-precision render targets can introduce small differences if stamp order changes. Batching need not reorder stamps.

**Expected outcome:** fewer GL submissions and uploads. The actual wall-time gain must be measured, because batching does not remove CPU tip generation or GPU overdraw.

### F04 — Pigment layers are coupled to implementation flush boundaries

**Priority:** High for semantics and future optimisation  
**Evidence:** Source-derived  
**Files:** `src/core/color.js` (`Mix.blend()`, `applyShader()`), `src/fill/fill.js`

Same-colour strokes can accumulate into one mask and undergo one nonlinear spectral composite. If an explicit finalisation or another composite boundary is inserted, those strokes may be applied as separate pigment layers instead.

These are not generally equivalent:

```text
one composite of union(mask1, mask2)

versus

composite(mask1), then composite(mask2)
```

This affects both appearance and the safety of optimisations that change pass count.

Normal painter's order is not a bug: A,A,B and A,B,A can legitimately differ. The meaningful test is whether a supposedly non-artistic operation, such as a submission flush, changes the result without changing the intended pigment-layer sequence.

**Recommended response:** distinguish:

1. Geometry generation.
2. Buffer submission.
3. Mask completion.
4. Material/pigment-layer application.
5. Presentation to the host canvas.

Define which public operations establish artistic layer boundaries. Keep the classic behaviour available if existing sketches depend on it.

### F05 — The mask stores coverage, not physical paint quantity

**Priority:** Medium; high if physically meaningful layering is a goal  
**Evidence:** Source-derived  
**Files:** `src/stroke/gl_draw.js`, `src/core/gl/shader.frag`

The mask alpha approaches 1 under repeated application. It does not preserve unlimited deposition or distinguish coverage from thickness.

The shader's dense-stroke darkening heuristic compensates artistically, but does not produce a conserved pigment or optical-depth quantity.

For a more coherent model, consider a nonnegative deposition or optical-depth-like quantity `tau`, with a later mapping such as:

```text
coverage = 1 − exp(−tau)
```

This gives accumulated deposition a clearer meaning. It is only a useful abstraction, not a complete physical paint simulator. Subpixel area coverage and material concentration should not automatically be treated as the same scalar.

Changing this model changes presets and overlap behaviour. It belongs in a new rendering mode, not a silent patch.

### F06 — Eight-bit masks limit faint accumulation

**Priority:** Medium  
**Evidence:** Source-derived precision risk; visible banding was not isolated  
**Files:** `src/adapters/standalone/compositor.js` (`createFramebufferTexture()`), fill Canvas2D path

The standalone framebuffer textures use `RGBA`/`UNSIGNED_BYTE`. Small accumulated alpha increments can quantise away, and repeated low-opacity applications can develop precision artefacts.

An `RGBA16F` mask can improve this. However:

- Rendering to floating-point attachments requires runtime capability checks, commonly `EXT_color_buffer_float` in WebGL2.
- Blending support depends on the chosen format and implementation; validate the actual configuration, not just extension presence.
- Check framebuffer completeness.
- Keep an 8-bit fallback.
- RGBA16F uses twice the raw storage of RGBA8 and can increase bandwidth.
- Changing only the GPU mirror does not recover precision already lost while constructing an 8-bit Canvas2D mask.
- A single-channel format might save memory, but must be tested for renderability, blending, and adapter compatibility.

Float precision is a targeted tool, not automatically a faster or simpler default.

### F07 — The spectral foundation is sound, but some work is uniform per pigment

**Priority:** Medium  
**Evidence:** Source-derived; speedup unmeasured  
**File:** `src/core/gl/shader.frag`

The 38-band reconstruction is a defensible paint-like RGB mixing approximation. Retain it unless a controlled visual/performance comparison demonstrates a better trade-off.

One input pigment colour is constant across an entire composite. Its spectrum, luminance, and possibly its `K/S` transform can be prepared outside the per-pixel loop and supplied as uniforms or another small GPU resource.

The destination colour still varies per pixel and still requires reconstruction in the current RGB-canvas model. Colour-dependent dense-stroke darkening also varies by pixel and complicates hoisting all pigment-side work.

**Recommendation:** implement a small exactness-oriented prototype, compare colours and dense-mask cases, and measure shader time on hardware. Do not describe this as halving the complete shader or total rendering time: texture access, background reconstruction, mixing, colour conversion, and driver/compiler behaviour remain.

### F08 — Mixing, glazing, and transparent targets need distinct contracts

**Priority:** Medium; strategic  
**Evidence:** Source-derived and modelling judgement  
**Files:** `src/core/gl/shader.frag`, `src/core/color.js`

The current shader treats painting as mixing reconstructed RGB-derived reflectances. This is artistically effective but does not explicitly distinguish:

- Opaque material deposition.
- A transparent coloured layer over a dry substrate.
- Wet pigments mixing with one another.
- Dry graphite or charcoal scattering/absorbing over paper.

Finite-thickness Kubelka–Munk layering is a plausible option for some materials, but requires material parameters and is not a drop-in replacement at guaranteed equal cost. The infinite-thickness `K/S` mixing currently used is not itself a complete glazing model.

Realism also cannot be recovered uniquely from RGB: different physical pigments can have the same displayed colour but mix differently. A future optional pigment palette could provide named materials with explicit optical properties, while preserving convenient arbitrary-RGB brushes.

Keep these as explicit material modes rather than promising that one equation physically reproduces all media.

### F09 — Watercolour crosses CPU/GPU boundaries four times per fill

**Priority:** Medium; scale-dependent  
**Evidence:** Observed and source-derived  
**Files:** `src/fill/fill.js`, `mask.js`, `composite.js`

The current path is:

```text
deform polygon on CPU
→ draw many Canvas2D layers
→ copy dirty rectangle to staging Canvas2D surface
→ texSubImage2D into mask mirror
→ copy destination source
→ run spectral composite
→ clear/repeat
```

Dirty rectangles and staging reuse already reduce unnecessary transfer. The 12.3 ms figure in §3.2 was CPU time only. With GPU completion included, the fill takes about 9 ms on an Apple M4 but about 800 ms on SwiftShader, almost all of it in the four spectral composites. Fill cost therefore depends heavily on GPU throughput. Measure on low-end and mobile GPUs before deciding whether it matters. Do not use an old multi-second baseline to justify a rewrite of the current engine.

Remaining costs scale with fill area, density, number of layers, and browser upload behaviour. A high-density large-canvas case may behave very differently from 300×300 at density 1.

**Options:**

- Keep Canvas2D and improve staging reuse/quality controls first.
- Move only rasterisation to a GPU mask while keeping CPU polygon generation.
- Explore fewer *artistic* layers as an opt-in quality mode.

Reducing four composites to one is not an exact optimisation because spectral mixing is nonlinear and the intermediate masks differ.

### F10 — Watercolour texture is not yet substrate-aware

**Priority:** Medium for realism  
**Evidence:** Source-derived  
**Files:** `src/fill/fill.js` (`layer()`, `erase()`), `src/core/gl/shader.frag`

Current texture comes from related deformed polygons, sparse layers, random erasure, polygon-outline strokes, and a mask-neighbour derivative effect in the composite shader.

These can create attractive washes, but do not explicitly encode:

- A persistent paper height map.
- Pigment granulation into paper valleys.
- Material-specific settling.
- Shared wetness and diffusion between neighbouring wet marks.
- Evaporation-driven transport or drying boundaries.

The highest-value additions for this library are likely image-space approximations, not full fluid mechanics:

- Paper-driven deposition variation.
- A tunable boundary accumulation band.
- Low-frequency pigment turbulence.
- Optional bleed controlled by local mask/wetness.

A difference between an original mask and an eroded or blurred version can form a boundary band. This is an artistic approximation, not a physical explanation of pigment transport. Evaluate concave boundaries, tiny shapes, overlap seams, and density scaling.

Anchor texture in a documented coordinate system. Paper attached to the canvas should not move because a stroke is translated or because drawing switches between batches.

### F11 — Growth caps and RNG-preserving optimisations complicate the fill model

**Priority:** Low to medium  
**Evidence:** Source-derived  
**File:** `src/fill/fill.js` (`grow()`)

Growth uses a cap derived from `GROW_MAX_VERTS = 2024` and bleed strength. When cap downsampling keeps only original vertices, the fast path skips displacement writes but still consumes random samples to preserve the seeded sequence.

This is a reasonable compatibility optimisation, but exposes a deeper issue: visible output is coupled to incidental random-call order and polygon sampling density.

For a new engine, derive randomness from stable identities such as shape seed, layer index, edge index, and subdivision level. Preserve the old sequential RNG in classic mode. This permits algorithm changes without perturbing every later unrelated random decision.

Do not assume a counter/hash-based replacement reproduces old seeded output.

### F12 — Trigonometric lookup quantisation can move endpoints

**Priority:** Medium for geometric accuracy  
**Evidence:** Source-derived numerical bound  
**Files:** `src/core/utils.js`, `src/stroke/stroke.js`, `src/core/flowfield.js`

The trigonometric table has 1,440 entries, or 0.25° steps. `angleToIdx()` in `src/core/utils.js` uses `~~`, which truncates to the lower entry rather than rounding. For a length `L`, a direction error approaching 0.25° produces lateral error approximately:

```text
L × sin(0.25°)
```

For 400 units this is approximately **1.75 units**. This is a numerical bound, not an observed screenshot measurement.

For straight lines, use exact endpoint-derived direction vectors and normalise once. This avoids repeated trigonometry entirely and preserves the requested direction more accurately.

For curves and flow integration, benchmark native `Math.sin()`/`Math.cos()` against an interpolated lookup table on representative targets. Do not claim native trig is always faster; the concern is unnecessary error and complexity, and exact straight-line movement is cheap either way.

The number and placement of tip samples introduce separate endpoint/coverage questions. Removing angular quantisation does not guarantee that the final stamp lies exactly at the requested endpoint.

### F13 — Flow sampling and path geometry share brush-resolution concerns

**Priority:** Medium  
**Evidence:** Source-derived  
**Files:** `src/core/flowfield.js`, `src/core/plot.js`

The field resolution is 1% of canvas width. Positions use rounded grid indices, causing piecewise-constant angular perturbations.

For smoother fields, interpolate direction vectors rather than raw wrapped angles. Angles near 359° and 1° should interpolate near 0°, not 180°. Normalise the interpolated vector and define a fallback near zero magnitude.

Some built-in fields intentionally create abrupt changes; make interpolation configurable or retain classic sampling for them.

A longer-term simplification is to separate:

- Path geometry and flow integration tolerance.
- Pressure sampling tolerance.
- Brush deposition spacing.
- Polygon approximation tolerance for fills and hatches.

Today these concerns are tied together through repeated small movements and plot sampling. Adaptive path sampling can reduce work while respecting curvature and pressure variation, but must preserve corners, joins, closure, and intentional field effects.

### F14 — Host integration is vulnerable to private p5 API changes

**Priority:** Medium for maintenance; high during a renderer rewrite  
**Evidence:** Source-derived  
**Files:** `src/adapters/p5/renderer.js`, `compositor.js`, `target.js`

The p5 adapter uses private members such as:

- `_curShader` and blend-state caches.
- `_origViewport`.
- `_beforeBegin` / `_beforeEnd`.
- `_framebufferToBind`.
- Renderer flush and stencil-related internals.

This makes p5 updates a compatibility risk. However, owning native GL resources does **not** eliminate integration requirements when sharing p5's context. The host may batch draws, maintain state caches, draw to offscreen targets, or have clipping/stencil state active.

The goal should be a small, explicit interoperability boundary rather than an unrealistic promise of no p5-specific code.

### F15 — Global registration and prototype mutation obscure ownership

**Priority:** Medium for simplification  
**Evidence:** Source-derived  
**Files:** `src/core/*_runtime.js`, `src/core/color.js`, entry points, feature modules

Runtime hooks, active targets, style state, random streams, and several caches are module-level. Features add methods to `Polygon.prototype` and `Plot.prototype` from separate modules. This supports the existing convenience API, but makes dependencies and instance ownership less explicit.

Risks include:

- Hidden initialisation order.
- Harder isolated tests.
- More complicated multi-instance and asynchronous target reasoning.
- Resource lifetime dispersed across modules.

`package.json` also declares `sideEffects: false` despite registration and prototype mutations (for example, `src/fill/fill.js` calls `initFillComposite()` at import time). A bundler that trusts this flag may drop modules imported only for their side effects. No failure was reproduced dynamically, but the fix is cheap: list the side-effectful files in `sideEffects`, and add a consumer-build fixture that proves tree-shaking keeps them.

The adapter READMEs still describe standalone as a future/reserved adapter even though it exists. This documentation should be updated separately.

## 5. Proposed rendering model

### 5.1 Preserve multiple brush representations

Do not force every medium into one representation. A compact engine can support three complementary primitive families:

| Family | Best uses | Representation |
|---|---|---|
| Continuous textured strokes | Pen, marker, pencil, charcoal, crayon | Segment quads with analytic coverage and textured deposition |
| Image/custom tips | User-authored raster tips, unusual silhouettes | Instanced textured quads, building on the existing path |
| Particles | Spray droplets, scattered grains, splatter | Instanced particles/quads with explicitly filtered small footprints |

Share path sampling, material parameters, clip/transform handling, masks, and compositing across these families.

### 5.2 Segment-oriented strokes

A segment record might contain:

```text
start/end position
start/end width or pressure
arc-length range
stroke seed/identifier
material parameters or material-table index
bounds
```

Draw conservative quads covering the segment. The fragment shader computes local distance and longitudinal position, then evaluates coverage, pressure variation, paper interaction, and stroke noise.

This reduces CPU data generation when a continuous mark can replace many dots. It does not eliminate GPU work. Long segments, broad strokes, overlaps, high-frequency textures, or evaluating many candidate stamp footprints per fragment can all be expensive.

Design explicitly for:

- Joins and caps, including sharp turns.
- No double deposition where adjacent segment quads overlap unless intended.
- Variable width and discontinuous pressure.
- Antialiasing under scale, shear, and nonuniform transforms.
- Stroke-local arc length for stable texture placement.
- Clipping in the captured user coordinate space.
- Robust behaviour for zero-length or nearly zero-length segments.

A simple continuous-coverage renderer is a useful first prototype. Matching arbitrary classic stamp distributions is a separate, harder objective.

### 5.3 Persistent paper and deposition

Provide a tileable or procedurally generated substrate field anchored in logical canvas coordinates. Use multiple spatial scales rather than one generic noise texture:

- Fine tooth for dry-media contact.
- Medium fibres and grain.
- Low-frequency variation for wash turbulence.

A conceptual dry-media deposition model is:

```text
amount = strokeCoverage
       × pressureResponse
       × paperContact(paperHeight, pressure)
       × strokeVariation(seed, arcLength, transversePosition)
```

This is a controllable illustration model, not a physically calibrated formula. The useful improvement is that repeated marks interact with the **same** substrate instead of unrelated random texture.

Distinguish substrate texture from stroke-specific variation. A clean pen need not reveal strong paper tooth; a soft pencil should.

### 5.4 Deterministic GPU randomness

A hash keyed by stable stroke/shape IDs, sample index, and explicit seed can move suitable noise off the CPU and decouple randomness from submission order.

Requirements:

- Document the seed/version contract.
- Prefer integer operations when exact hash identity matters.
- Use logical coordinates for density stability.
- Avoid high-frequency aliasing by filtering or band-limiting noise.
- Test cross-browser image tolerances; deterministic integer hashes do not make all floating-point shader results bit-identical.

Classic mode should retain its current RNG sequence. New-mode determinism can be versioned separately.

### 5.5 GPU watercolour masks

Keep CPU polygon deformation initially. Two rasterisation approaches are worth comparing:

1. Triangulate suitable simple contours and draw them normally.
2. Use stencil-then-cover for paths that require fill-rule handling, including self-intersections.

Stencil-then-cover is not a free drop-in replacement. It requires:

- A stencil attachment and lifecycle.
- A deliberate even-odd or nonzero winding rule matching desired Canvas semantics.
- Correct handling of clipping, overlap, and antialiased edges.
- Separate border rendering if preserving the current outline contribution.
- Adequate batching; replacing Canvas calls with equally numerous GL calls may not help.

Evaluate a hybrid before moving all fill logic. Canvas2D is a capable path rasteriser and may remain preferable for some shapes.

### 5.6 Material compositing

Separate mask/deposition generation from material response. Initially retain the existing spectral result as one mode. Future material modes can distinguish coverage blending, paint-like mixing, and layer transmission where justified.

Use float buffers only when their precision/range benefit warrants the capability and memory cost. Keep final presentation and arbitrary host drawing in the supported target colour space, with an explicit premultiplied-alpha contract.

Do not expand to 38 spectral channels per canvas pixel merely because the mixer has 38 samples. That would be a much larger storage and bandwidth architecture than the current RGB canvas plus reconstruction.

## 6. Architecture and simplification

### 6.1 A small owned engine, not more hook layers

A useful internal ownership model is:

```text
BrushContext
├── style and random state
├── path/geometry generation
├── stroke/fill command queues
├── GPU resources keyed by GL context
├── mask/deposition buffers
├── material compositor
└── host interoperability boundary
    ├── standalone canvas/OffscreenCanvas
    └── p5 target, transform, lifecycle, and state synchronisation
```

The existing module-level API can remain a facade forwarding to an active context. This avoids requiring a breaking rewrite of user sketches.

Prefer explicit collaborators over mutable global hook registries where practical. Avoid building a generic plugin framework unless actual extension requirements justify it.

### 6.2 Shared-context boundaries

At an interoperability boundary:

1. Ensure queued host work is submitted before sampling the host target.
2. Flush relevant brush batches before host drawing must observe them.
3. Preserve or re-establish framebuffer, viewport, scissor, stencil, depth, blend, program, VAO, texture-unit, and other touched state.
4. Invalidate only host caches that genuinely require it.
5. Handle offscreen target orientation and density explicitly.

Inside an owned pass, use tracked state to reduce repeated driver queries. At external boundaries, correctness takes precedence over eliminating `getParameter()` calls.

### 6.3 Resource lifecycle

Make resize, density change, target switch, disposal, and context restoration explicit. Use per-context resource storage to avoid repeatedly rebuilding resources when switching between live contexts.

Context restoration can return a usable context object while old GPU resources are invalid. Comparing JavaScript context identity alone is insufficient; track a resource generation or restoration event.

Avoid eagerly allocating every full-size buffer if a sketch uses only strokes or only solid wash.

### 6.4 Memory budget

For a 2,000×2,000 logical canvas at density 2, each full-size buffer has 16 million physical pixels:

- RGBA8: approximately 64 MB decimal, or 61 MiB.
- RGBA16F: approximately 128 MB decimal, or 122 MiB.

Several full-size masks, source copies, intermediate blur targets, the host drawing buffer, and Canvas2D mirrors can quickly consume hundreds of megabytes. These figures exclude padding, driver overhead, depth/stencil, and multisampling.

Dirty-rectangle compositing reduces work and transfer, but does not reduce the allocation size of a full-canvas framebuffer. Consider lazy allocation, buffer reuse, and eventually tiles or bounded scratch targets for very large exports.

## 7. Alternatives and research

### 7.1 Keep WebGL2 as the baseline

WebGPU may eventually help compute-heavy deposition, fluid simulation, or very large workloads. It is not necessary to solve the identified CPU batching and subpixel-coverage issues. A new API would also introduce integration, device, and fallback complexity.

Start by improving the model within WebGL2. Reconsider WebGPU when a specific prototype demonstrates that the required algorithm is limited by WebGL2 rather than current implementation choices.

### 7.2 Ciallo and vector brush rendering

*Ciallo: GPU-Accelerated Rendering of Vector Brush Strokes* (SIGGRAPH 2024) is a relevant modern reference for rendering expressive vanilla, stamp, and airbrush strokes from vector representations on the GPU.

Its value here is algorithmic: evaluate stroke coverage/footprints using coherent vector geometry rather than automatically generating a huge CPU list of tiny raster stamps.

Do not assume:

- A trivial one-segment/one-quad implementation reproduces every Ciallo result.
- Published benchmark ratios transfer to p5.brush.
- Available application/tutorial code is permissively licensed for this MIT project.

The application repository has been published under AGPL terms; current file-level licences, exceptions, and tutorial licences must be checked before reuse. Study the paper and independently implement suitable ideas, or obtain compatible permission. This audit is not a licence clearance.

### 7.3 Spectral.js and Mixbox

Spectral.js is an appropriate permissively licensed reference for paint-like colour mixing. Updating to a newer version is a separate visual change: compare black/white extremes, saturated pigments, endpoints, and existing seeded output before replacing the embedded shader.

Mixbox is a relevant low-dimensional pigment-space/LUT alternative with shader integration. Its standard publicly offered licence is noncommercial, with commercial licensing available separately. It is not an automatic replacement for a generally usable MIT library.

This audit did not benchmark spectral.js versions against Mixbox. No claim is made that the current spectral implementation is the globally fastest or most physically accurate option.

### 7.4 Image-space watercolour

Bousseau and colleagues' interactive watercolour work and Montesdeoca and colleagues' real-time art-directed watercolour research are useful references for separating stylisation into controllable image-space effects, such as edge accumulation, pigment variation, granulation, and substrate interaction.

These are better aligned with the library's interactive, art-directed goals than reproducing full water/pigment dynamics for every fill.

### 7.5 Full fluid simulation

Curtis and colleagues' *Computer-Generated Watercolor* and subsequent work model richer transport, deposition, and drying effects. Such approaches can produce wet-in-wet behaviour that static texture approximations cannot.

They also introduce time stepping, stability constraints, state storage, resolution choices, and a different authoring model. They are not intrinsically simpler or faster. Consider an optional specialised wet-paint mode only if those interactions become a primary requirement.

### 7.6 Learned rendering

ML-based stylisation is not the recommended default. It adds model delivery, execution/deployment requirements, potential licensing/training questions, and weaker guarantees around seed stability, precise geometry, and user-authored brush behaviour.

AI tools can help implement, test, and compare rendering algorithms. That does not imply the runtime renderer should itself be a learned model.

## 8. Implementation roadmap

The roadmap has moved to [`rendering-plan.md`](rendering-plan.md), which orders the work, records the open decisions, and sets go/no-go criteria. The longer-term ideas in §5 and §6 (segment renderer, persistent paper, GPU fill masks, material modes, context ownership) are candidates for after the plan's spike, not commitments.

### Compatibility strategy

Preserve a classic mode and offer any new model explicitly, for example:

```js
// Illustrative API, not implemented:
brush.engine("classic");
brush.engine("natural");
```

Classic mode still receives bug fixes that make output depend less on the viewer's hardware, such as the subpixel coverage fix in F01. Those fixes are released with a version bump and a note on how the appearance changed. Document which combinations preserve old seeds and pixels. Do not hide materially different pressure, texture, or optical behaviour behind an unchanged, undocumented preset name.

## 9. Verification and acceptance criteria

### 9.1 Visual correctness

Build a reference scene matrix covering:

- Every built-in brush at several weights and opacity/pressure levels.
- Densities 1, 2, and 3, plus fractional density if supported.
- Horizontal, vertical, diagonal, curved, and sharp-corner paths.
- Tiny marks, zero-length paths, and very large marks.
- Translation, rotation, uniform/nonuniform scale, reflection, and shear.
- Image/custom tips with rotation and clipping.
- Repeated same-colour strokes, explicit render boundaries, and colour changes.
- p5 drawing before, between, and after brush operations.
- Transparent and coloured backgrounds.
- Canvas, offscreen, and supported p5 framebuffer targets.
- Resize, density change, target switch, disposal, and context loss/restoration.

For classic mode, keep exact or tightly bounded pixel regressions where browser stability permits. For a new renderer, compare perceptual and structural qualities rather than demanding accidental pixel identity with the old point-clamped look.

The existing `test/e2e/legacy-output.json` and legacy watercolour fixture are useful foundations. The exact coverage and tolerance rules should be reviewed before reusing them as release acceptance criteria.

### 9.2 Density invariance

For each mark:

1. Render the same logical geometry and seed at multiple densities.
2. Downsample higher-density results using a defined filter.
3. Compare integrated darkness, width profiles, footprint, and texture statistics.
4. Inspect visually at matched logical display size.

An initial engineering target could be integrated darkness within 10% across densities for a controlled single stroke, while retaining the expected footprint. This is a proposed target to validate, not a result already achieved.

Total darkness alone is insufficient: a blurred, over-wide line could pass that scalar metric.

### 9.3 Performance

Benchmark separately:

- CPU path generation.
- CPU tip/instance generation.
- Buffer upload/submission.
- Mask rasterisation.
- Fill staging/upload.
- Destination copy.
- Spectral/material composite.
- Presentation/readback for export scenarios.

Use hardware GPU timer queries when available (`EXT_disjoint_timer_query_webgl2`), discard disjoint results, and keep CPU timers for CPU work. Avoid adding synchronous readback or `gl.finish()` to production drawing loops.

Test at least:

- One Apple/Metal-backed browser.
- One Windows ANGLE configuration.
- A representative mobile GPU.
- Chromium plus Safari and Firefox where supported.
- Density 1 and 2, small interactive canvases and large exports.

Record median and tail latency, not just a single mean. Report raw work counts and memory alongside time. A reduction in draw calls is not by itself proof of an overall speedup.

### 9.4 Packaging and integration

Add consumer-build fixtures for named ESM imports, supported CommonJS consumption, p5 global mode, p5 instance mode, and standalone usage. Verify tree-shaking does not remove required initialisation.

Run the existing regression and smoke suites after implementation changes:

```sh
npm test
```

This model audit did not run a fresh full `npm test` and makes no new test-pass claim. Tests performed by earlier audit/bug-fix work are historical evidence, not a substitute for validating a future renderer.

## 10. Reproduction notes

### 10.1 Before rerunning

Record:

```sh
git rev-parse HEAD
git status --short
node --version
npm run build
```

Also record `package.json` version, a hash of `dist/brush.esm.js`, Playwright/Chromium version, context attributes, renderer/backend, logical dimensions, physical dimensions, and density.

Do not silently overwrite an uncommitted distribution just to obtain a benchmark. Use a clean worktree if preserving local build artefacts matters.

### 10.2 Minimal density experiment

Serve the repository over HTTP. The following page reproduces the measurement. It is not committed yet; step 1 of the plan turns it into `test/e2e/density.mjs`, following the Playwright pattern of `test/e2e/smoke.mjs`. Load it as an HTML module page with `?brush=HB&density=1`, then repeat with density 2.

```html
<!doctype html>
<html>
<body>
<script type="module">
import * as brush from "/dist/brush.esm.js";

const query = new URLSearchParams(location.search);
const name = query.get("brush") ?? "HB";
const density = Number(query.get("density") ?? 1);
const canvas = brush.createCanvas(400, 120, {
  parent: document.body,
  pixelDensity: density,
});

brush.seed(1);
brush.noiseSeed(1);
brush.set(name, "#000", 1);
brush.line(-180, 0, 180, 0);
brush.render();

const gl = canvas.getContext("webgl2");
const readback = document.createElement("canvas");
readback.width = canvas.width;
readback.height = canvas.height;
const ctx = readback.getContext("2d");
ctx.fillStyle = "white";
ctx.fillRect(0, 0, readback.width, readback.height);
ctx.drawImage(canvas, 0, 0);
const { data } = ctx.getImageData(0, 0, readback.width, readback.height);

let darkness = 0;
for (let i = 0; i < data.length; i += 4) {
  darkness += (255 - data[i]) / 255;
}

console.log({
  brush: name,
  density,
  logicalSize: [400, 120],
  physicalSize: [canvas.width, canvas.height],
  darknessPerLogicalArea: darkness / (density * density),
  pointSizeRange: Array.from(gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)),
});
</script>
</body>
</html>
```

To reproduce submitted point counts and diameter quantiles, instrument the active context before drawing:

- Count `gl.drawArrays(gl.POINTS, ..., count)`.
- Capture both `bufferData()` and `bufferSubData()`; the first upload or a capacity increase can use `bufferData()`.
- In the circle buffer layout, every four floats are position X, position Y, physical radius, and alpha.
- Double radius to obtain intended physical diameter.
- Ignore unused buffer capacity, and distinguish static image-quad data from circle data.
- Keep instrumentation separate from performance measurements when possible.

The original instrument first omitted `bufferData()`, producing empty diameter statistics, and initially used a readback calculation that treated transparent pixels as black. Those preliminary results were discarded. The table in §3 uses the corrected upload capture and white-background Canvas2D readback.

### 10.3 Workload definitions

The timed drawing functions were equivalent to:

```js
// Each workload had its own page/context. Clear and reseed before each run.

// Lines
brush.set("2B", "#222", 1);
for (let i = 0; i < 100; i++) {
  brush.line(-200, -200 + i * 4, 200, -200 + i * 4);
}

// Hatch
brush.set("HB", "#222", 1);
brush.hatch(3, 45);
brush.rect(-200, -200, 400, 400);
brush.noHatch();

// Mass
brush.noStroke();
brush.mass("HB", "#222");
brush.rect(-150, -150, 300, 300);
brush.noMass();

// Fill
brush.noStroke();
brush.fill("#2a6fb0", 150);
brush.fillBleed(0.3);
brush.fillTexture(0.6, 0.4);
brush.rect(-150, -150, 300, 300);
```

These are separate workloads, not four blocks to run sequentially with shared style state. Follow each drawing operation with `brush.render()` and, for matching the diagnostic timing, a 1×1 `readPixels()` into a preallocated four-byte array. Count GL methods over the same interval.

## 11. References

Source files and symbols named throughout this report are the primary evidence for implementation findings. External references inform proposals; they are not evidence of achieved performance in p5.brush.

- Tyler Hobbs, **A Generative Approach to Simulating Watercolor Paints** (2017): <https://tylerxhobbs.com/essays/2017/a-generative-approach-to-simulating-watercolor-paints>
- Shen Ciao et al., **Ciallo: GPU-Accelerated Rendering of Vector Brush Strokes**, SIGGRAPH 2024: <https://doi.org/10.1145/3641519.3657418>
- Ciallo project/research page: <https://cislab.hkust-gz.edu.cn/publications/ciallo-gpu-accelerated-rendering-of-vector-brush-strokes/>
- Ciallo application source; inspect current licence before reuse: <https://github.com/ShenCiao/Ciallo>
- Brush rendering tutorial; inspect its own licence separately: <https://github.com/ShenCiao/brush-rendering-tutorial>
- Spectral.js source and licence: <https://github.com/rvanwijnen/spectral.js>
- Spectral.js release notes: <https://github.com/rvanwijnen/spectral.js/releases>
- Mixbox source and licensing information: <https://github.com/scrtwpns/mixbox>
- Mixbox shader integration: <https://scrtwpns.com/mixbox/docs/shaders/README>
- Adrien Bousseau et al., **Interactive Watercolor Rendering with Temporal Coherence and Abstraction**, NPAR 2006.
- Santiago E. Montesdeoca et al., **Art-directed Watercolor Stylization of 3D Animations in Real-time**, Computers & Graphics, 2017. Research index: <https://artineering.io/research>
- Cassidy J. Curtis et al., **Computer-Generated Watercolor**, SIGGRAPH 1997.
- Khronos WebGL2 specification: <https://registry.khronos.org/webgl/specs/latest/2.0/>
- MDN, `EXT_color_buffer_float`: <https://developer.mozilla.org/en-US/docs/Web/API/EXT_color_buffer_float>
- MDN, WebGL best practices: <https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices>

### Final recommendation

Start by making results reproducible and choosing a reference density. Then prototype the subpixel coverage fix, which addresses a demonstrated, user-visible inconsistency in the current release. Batching should wait for a hardware profile. The segment renderer should start as a time-boxed spike with explicit success criteria, not as a wholesale replacement justified by speculative speedups.

The library's artistic identity is an asset. The aim is to make that identity less dependent on pixel density, incidental flushes, driver limits, and CPU sampling density, not to replace it with a generic "realistic brush" effect.
