# Rendering plan

**Status (2026-10-27, branch `experiment/gpu-dots`):** steps 1–4 done; step 7 partly done (paper tooth, always on); step 6 replaced by GPU dot generation, done for every brush type. D1 decided (density 2); D4 decided (GPU dots replace CPU dots). No library code has changed.  
**Evidence and background:** [`rendering-model-audit.md`](rendering-model-audit.md). Finding IDs (F01 and so on) refer to that document.

## Goal

Make p5.brush output independent of pixel density, then make it faster where hardware profiling shows a real cost. Preserve the library's artistic look and public API. A new natural-media renderer is a separate, opt-in experiment that has to justify itself with a spike.

## Open decisions

These need an owner's answer before the step that depends on them.

| # | Decision | Needed before | Notes |
|---|---|---|---|
| D1 | **Reference density.** At which pixel density do the current presets look as intended? **Decided 2026-10-27: density 2.** | Step 3 | Fine brushes are about 3.5× darker at density 1 than at density 2 (F01). The fix keeps the look at the reference density and changes it at the others. Choose the density the presets were tuned on. |
| D2 | **Release vehicle for the F01 fix.** Patch, minor, or major version, and is there an opt-out? | Step 3 merge | The fix changes seeded output for every fine-brush sketch on non-reference screens. |
| D3 | **Go/no-go for the segment renderer.** | After step 7 | Decided against the criteria in step 7. |
| D4 | **GPU dot generation in classic mode?** Seeds keep their statistics but produce different dots. **Decided 2026-10-27: yes, and CPU dots are removed.** | Step 6 | Approved after side-by-side comparison. |

## Steps

Each step stands alone and can be reviewed on its own. Do not combine a visual-model change with an ownership or architecture refactor in one change.

### 1. Commit the harness and re-baseline on 2.3.0 — done

- Add `test/e2e/density.mjs`: for each built-in brush, draw one seeded line at densities 1, 2, and 3 and report integrated darkness, intended point-diameter quantiles, and point counts (audit §3.1, §10.2).
- Add `test/e2e/bench.mjs`: the lines, hatch, mass, and fill workloads (audit §3.2, §10.3), reporting median and p90 time plus upload and draw counts.
- Each script records the commit, bundle hash, browser version, and `UNMASKED_RENDERER_WEBGL`.
- Run both on a clean 2.3.0 build and commit the output as the baseline.

**Done when:** both scripts run with `npm run` and the 2.3.0 baseline is committed. No library code changes.

**Result.** Run with `npm run measure:density` and `npm run measure:bench`. Add `-- --angle=metal` (or `d3d11`, `vulkan`) for a hardware GPU; the default is SwiftShader. A fresh build of 2.3.0 reproduces the committed `dist/` byte for byte (`brush.esm.js` sha256 `4f0c545e…`). Baselines are in `test/e2e/baselines/`, recorded on SwiftShader and on an Apple M4 through ANGLE Metal.

| Measurement (2.3.0) | SwiftShader | Apple M4 (Metal) |
|---|---:|---:|
| HB darkness, d1 / d2 / d3 | 419 / 121 / 57 | 417 / 117 / 55 |
| HB d1/d2, d1/d3 | 3.5×, 7.3× | 3.6×, 7.6× |
| Lines: CPU / total ms | 23 / 64 | 23 / 30 |
| Hatch: CPU / total ms | 33 / 73 | 33 / 39 |
| Mass: CPU / total ms | 248 / 287 | 247 / 250 |
| Fill: CPU / total ms | 4 / 807 | 4 / 9 |

CPU is drawing calls through `brush.render()` returning; total adds a blocking 1×1 `readPixels()`. Full per-brush tables and call counts are in the JSON files.

Findings that change later steps:

1. **Density dependence is worse than the audit reported.** At density 3, fine brushes have 3.4–8.7× less darkness than at density 1 (charcoal least affected, 2H most). The measured line width is about 2 *device* pixels at every density (2, 1, and 0.67 logical px for HB at d1, d2, d3). The raster sets the line width, not the brush.
2. **Mass is limited by CPU dot generation, not GL submission.** On the M4, mass spends 247 of 250 ms on the CPU, and only about 6 ms of that is inside WebGL calls (a one-off probe that timed every GL method). It generates 1.6 million circles for one 300×300 rectangle. On this hardware, batching (step 6) could save at most about 2% of mass time. This is a preliminary step 5 result for one of the three targets.
3. **The audit's fill timing was CPU-only.** It reported 12.3 ms, which matches the JavaScript time here, not the GPU time. On SwiftShader, the four spectral composites take about 800 ms of GPU time; on the M4, about 5 ms.
4. **The audit's density table was not measured on SwiftShader.** Its values and its point-size range of [1, 511] match the Metal run exactly; SwiftShader in this Chromium reports [1, 1023].

### 2. Decide the reference density (D1) — done (density 2)

Render the brush matrix at densities 1 and 2 with the step 1 harness, compare them side by side, and record the decision in this document.

### 3. Subpixel coverage fix (F01) — done

**Result.** In `dots.vert`, dots keep a footprint of at least 0.5 logical px (one device pixel at density 2), points rasterise at no less than one device pixel, and alpha scales by footprint over raster area. Density 2 is unchanged (darkness ratio 1.00 for every brush). Fine-brush darkness relative to density 2 went from 3.5× (d1) and 0.3× (d3) to 0.79–0.94× (d1) and 1.05–1.18× (d3). The remaining gap is coverage-union overlap: at density 1 several faint dots share one pixel and combine to less ink than the same dots in separate pixels, and the reverse at density 3. Closing it needs resolution-independent accumulation, so the 10% target is not met for d1 on the finest brushes. The large-point quad fallback was not added; behaviour above the point-size limit is unchanged from 2.3.0.

- Pass the intended diameter to the shader, clamp the support size to a minimum, and scale alpha by the ratio of intended to support area (sketch in audit F01).
- Add a quad fallback when the intended size exceeds `ALIASED_POINT_SIZE_RANGE[1]`; query the limit at runtime.
- Applies to classic mode as a bug fix (D2).

**Acceptance:**
- At the reference density, output stays within a small tolerance of the 2.3.0 baseline.
- Integrated darkness for each fine brush is within 10% across densities 1, 2, and 3.
- Line width and grain look the same at matched display size. Darkness alone is not enough: a blurred, over-wide line can match it.
- `npm test` passes, with legacy fixtures updated only where the change is intended and explained.

### 4. Small fixes — done

**Result.**
- **F12:** straight lines step along their exact direction instead of the 0.25° lookup table; a new regression test fails on 2.3.0 (0.75 px off) and passes now. Rounding the table itself was tried and reverted: it changed every seeded watercolour fill for no visible benefit.
- **F15:** `"sideEffects": false` made bundlers drop `import "p5.brush"` entirely (confirmed: a consumer bundle came out empty). The flag is removed; `npm run test:packaging` installs the package into a temporary `node_modules` and checks both entry points survive bundling.
- **Docs:** the adapter READMEs now describe the standalone adapter as it exists.

- **F12:** use exact endpoint-derived direction vectors for straight lines. Round instead of truncate in `angleToIdx()`, or interpolate. Add an endpoint/angle test.
- **F15:** list side-effectful modules in `package.json` `sideEffects`, and add a bundled-consumer fixture that proves tree-shaking keeps registration.
- **Docs:** update the adapter READMEs that still describe standalone as a future adapter.

### 5. Profile on hardware GPUs

Run `bench.mjs` (instrumented to split CPU tip generation, upload/submission, and composite, using `EXT_disjoint_timer_query_webgl2` where available) on at least:

- one Apple/Metal browser,
- one Windows ANGLE browser,
- one mobile GPU.

**Output:** a short table, added here, showing where the time goes in the mass and hatch workloads.

### 6. Cross-stroke batching (F03) — superseded by GPU dot generation, done

**Result.** Profiling showed mass spent ~97% of its time generating dots and walking the path on the CPU, so batching alone could not help. Instead, every brush type now queues path segments of up to 4 logical px, and shaders expand them into dots (`dots.vert`: default, spray, marker) or textured stamps (`stamps.vert`: image and custom tips), using hashed randomness keyed by stroke seed, segment and step. Strokes sharing brush, colour, transform, clip and target are batched into one draw. The CPU dot path is removed. Ink per brush matches 2.3.0 within ~2% at density 2. Apple M4: lines 29.6 → 3.7 ms, hatch 39.3 → 4.2 ms, mass 250.4 → 13.7 ms.

Original plan text, kept for reference:

Proceed only if submission or upload accounts for a meaningful share of mass/hatch time on hardware. If CPU tip generation dominates, skip to step 7, which attacks that cost directly.

*Preliminary (step 1, Apple M4):* GL calls are about 2% of mass time, so batching is unlikely to pay off there. Confirm on Windows and mobile before dropping it. If it holds, the performance work should shift to reducing how many dots are generated (step 7, or cheaper tip generation in classic mode).

- Move the per-stroke transform uniforms (`u_tipInverse`, `u_affineCircle`, and the image linear transform) into per-instance data, or flush only when transform, colour, clip, tip texture, or target changes.
- Preserve stamp order and RNG order.

**Acceptance:** pixel output matches the step 3/4 baseline within tolerance; upload/draw counts drop; hardware wall time improves measurably on at least two of the step 5 targets.

### 7. Segment-renderer spike, time-boxed — paper half done

**Result (paper).** Tested first, on the existing dot strokes. Every stroke is now drawn onto a procedural paper tooth (`src/stroke/paper.glsl`, shared by the dot and stamp shaders): a fixed height map in canvas space. A mark deposits only where the paper rises above a level set by its pressure. It is **always on** (strength 0.5, grain 1.26 logical px × the `scaleBrushes()` factor), its pattern follows `brush.seed()`, and `brush.paper()` / `brush.noPaper()` tune or remove it. Strokes come out somewhat paler; this was accepted rather than recalibrating presets. Cost on an Apple M4 is 0–3 ms per workload, and about 0–10% on SwiftShader. The continuous-stroke half has not been started.

Original plan text:

A throwaway prototype of continuous segment coverage with persistent paper texture (audit §5.2–5.3) for **pen and HB pencil only**, behind an internal flag.

**Go criteria (all required):**
- Pencil and pen look at least as convincing as classic at matched display size, judged side by side on the step 1 brush matrix.
- Density invariance meets the step 3 target.
- Hardware wall time for the lines and mass workloads is at least 2× better than classic after step 6.
- Joins, caps, sharp corners, and variable pressure have no visible seams.

If go, write a separate design document for the opt-in engine (audit §5, §6, compatibility strategy in §8). If no-go, record why here and stop.

## Out of scope for this plan

These remain candidates in the audit and need their own justification later: float mask buffers (F06), hoisted pigment spectral data (F07), material/glazing modes (F08), GPU fill masks and image-space watercolour (F09, F10), stable hashed randomness (F11, §5.4), interpolated flow sampling (F13), context-ownership refactor and p5 boundary (F14, §6), WebGPU.
