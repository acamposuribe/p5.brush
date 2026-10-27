# Fill plan

**Status: in progress.** Steps 0, 1 and 2 done (2026-10-27); step 2 awaits F-D1 approval. Step 3 spike works as an opt-in prototype (`fillStyle("watercolor")`); step 3b (wet-in-wet) in progress; F-D2 open. Hardware measurements are from an Apple M4 (ANGLE Metal) only.  
**Background:** [`rendering-model-audit.md`](rendering-model-audit.md) (F06, F07, F09, F10, F11) and the closed stroke plan in [`rendering-plan.md`](rendering-plan.md).

## Goal

Make fills radically faster, then make them look more like real watercolour. Keep Tyler Hobbs' idea (a deformed polygon rendered as many related translucent layers) and the public API (`fill`, `fillBleed`, `fillTexture`, `wash`). Speed and style share one new foundation, a GPU paint buffer, so they are planned together and shipped in order: speed first without changing the look, then style on top.

## 1. How fills work now

`createFill()` → `FillPoly.fill()` in `src/fill/fill.js`. For one fill:

- **Geometry (CPU).** 20 iterations. Each iteration re-derives several polygons by recursive midpoint displacement: `pol.grow(f).grow(999).grow(997)` for three trimmed variants, a sparse scatter layer, and a darker layer every other iteration. That is about **90 polygons and 47K vertices per fill**, built from `{x, y}` objects and sequential `rr()` calls. `GROW_CAP` limits vertex counts.
- **Raster (Canvas2D).** Every polygon is filled and stroked into a CPU-side 2D mask. The stroke is a wide, round-joined, 0.5%-alpha outline (`lineWidth ≈ size/25 × border`).
- **Erasure (Canvas2D).** `erase()` draws random `destination-out` circles: about 950 per call at texture 0.6, **about 3,000 per fill**.
- **Composite (WebGL), 4 times per fill.** At iterations 0, 8, 16 and 19 the mask is copied to a staging canvas (`drawImage`), uploaded (`texSubImage2D`), the destination rect is blitted, and the spectral shader (`src/core/gl/shader.frag`) mixes the pigment into the canvas. Then the mask is cleared. These are four "glazes".

`wash()` uses the same Canvas2D mask and composite with a single polygon.

## 2. Measurements

Scripts are not committed; step 0 turns them into a harness. Apple M4, Metal, median of 4 runs after 2 warm-ups. "Total" includes a blocking readback, so it includes GPU time.

| Case | Total | What it shows |
|---|---:|---|
| Bench fill: 300×300 rect, 512² canvas, density 1 | 12 ms | Small canvases are cheap on a fast GPU |
| One 450-unit circle fill, 1200² canvas, density 2 | 80 ms | CPU is only 5 ms |
| Same size, **4 plain `wash()` circles** (one polygon each) | **64 ms** | The 4 composites alone cost nearly as much as a full fill |
| Same fill, `spectral_mix` replaced by a lerp | 28 ms | **About 75% of large-fill time is the spectral mix** |
| Same washes, lerp | 14 ms | About 3.5 ms per pass of blit, upload and pass-through at this size |
| Same fill, shader loops fused (no 38-float arrays) | no change | The cost is the arithmetic, not register pressure |
| Same fill, **pigment terms moved to CPU uniforms** | 48 ms (washes 68 → 29) | **2× on every composite**, near-identical pixels |
| 40 small fills, 1000² canvas, density 2 | 279 ms | CPU-bound; 160 composites |
| Same, Canvas2D calls stubbed out | 105 ms | About 2.5 ms/fill of JS geometry; Canvas2D recording plus `drawImage` sync is about 3–4 ms/fill |

The fill varied between 80 and 93 ms across sessions; compare ratios within one session. 
A CPU profile of the 40-fill case puts 53% of samples in `drawImage`, the sync point between Canvas2D and WebGL. `grow()` and the RNG take most of the rest.

## 3. First-principles findings

**P1. The pigment is recomputed for every pixel.** For the whole pass, `spectral_mix` mixes the canvas with one constant colour. The pigment's 38-band reflectance, its KS values and its luminance are uniforms in disguise, yet they are computed per pixel. That is half the work, and strokes use the same shader. Measured: 2×.

**P2. The four composites are a Canvas2D artefact.** They exist because the mask has to cross back into WebGL before each erase/glaze boundary. If the mask lives on the GPU, the four glazes become four channels of one buffer, and one pass composites all of them.

**P3. The mask is order-independent, so it doesn't need a path rasteriser.** Low-alpha source-over layers combine exactly in log space: alpha = 1 − exp(−Σwᵢ), with wᵢ = −ln(1 − aᵢ). Erasure is also a sum, kept in a separate channel: × exp(−Σeⱼ). Additive blending is commutative, so:

- one instanced draw renders every polygon, and another every erase disk, into a float buffer;
- no triangulation is needed: each polygon is drawn as a fan of triangles from its centroid, each triangle signed by its orientation, and the sum gives the exact coverage count;
- the 8-bit mask quantisation goes away (F06).

**P4. Glazes of the same pigment collapse in KS space.** Mixing a background with pigment P again and again gives KSₙ = Λ·KS_bg + (1 − Λ)·KS_P, where Λ is the product of the per-glaze weights. The weights depend only on each intermediate's luminance, which a cheap 38-band Y loop gives. So 4 full mixes become about 2 mix-equivalents per pixel. The same rule lets consecutive fills of one colour share a composite, the way strokes batch. This skips today's sRGB round-trip between glazes, so it is a small visible change.

**P5. Most vertices are drawn once and thrown away.** The last two `grow()` levels displace a midpoint on every edge. A vertex shader can compute them from a hash of (seed, fill, layer, edge, level). The CPU keeps the coarse Hobbs evolution (base polygon, trims, scatter, per-vertex bleed modifiers) at about a quarter of the vertex count.

**P6. Realism lives inside the shape, not at its boundary.** See §4. The Hobbs stack puts all its character into the silhouette and 90 overlapping translucent layers. Real watercolour gets most of its character from how pigment is distributed inside the shape, plus a thin dried edge. Both of those are per-pixel fields: cheap to evaluate in the composite, and they don't need more layers. This is where speed and style point the same way.

## 4. Style: what "better" looks like

References: Zach Lieberman, [post 1](https://x.com/zachlieberman/status/2105577082365387257), [post 2](https://x.com/zachlieberman/status/2103642760565629399) and [post 3](https://x.com/zachlieberman/status/2103948104068170164) (videos). Post 1's discs are perfect circles with real watercolour texture inside, so they look like masked scans of real paint. Post 2's blobs are a grid of irregular, dried washes.

Their features, roughly in order of visual weight:

1. **Hard, dried edges with a thin dark rim.** Pigment carried to the edge as the wash dries (the coffee-ring effect). Edges are crisp, not haloed.
2. **Large tonal range.** Shapes go from nearly white to nearly black. Tone varies inside a shape too: pigment pools to one side.
3. **Granulation.** A mottled, sometimes reticulated (cell-like) texture where pigment settles into the paper's valleys.
4. **Blooms (backruns).** Paler regions with jagged, cauliflower-like dark fringes, where water flowed back into a drying wash.
5. **Wet-in-wet drops.** Dense dark spots with feathered, dendritic edges.
6. **Transparent glazing.** Overlaps are darker and keep both shapes' edges visible.

The current fills (seeded render, density 2) are soft, pale and haloed. They have scalloped outlines from stacked growth, faint polygon creases at low bleed, and visible circular erase marks. Shapes stay light, and edges get darker only through the broad stroke band. Features 1 and 3–5 are missing.

Most of these features are image-space effects over a per-pixel paint field. That is the approach of Bousseau et al. and Montesdeoca et al. (audit §7.4), not a fluid simulation:

| Feature | Image-space approximation | Needs |
|---|---|---|
| Dried rim | Paint − blurred paint gives an edge band; darken it | Float paint field, one small blur (half resolution) |
| Granulation | Modulate deposit by the paper height already used for strokes (`paper.glsl`), stronger where paint is thin | Shared paper function |
| Pooling | Low-frequency noise or a directional gradient (reuse `fillBleed`'s angle) on paint density | Composite uniforms |
| Blooms | Noise-thresholded fronts inside the shape: a lighter interior with a darkened, jagged edge | Same as the rim, plus noise |
| Wet-in-wet drops | Radial, dendritic stamps added to the paint field | Instanced stamps into the paint buffer |
| Glazing | Already handled by the spectral composite | — |

All of this assumes the GPU paint buffer from step 2, which is why speed and style share a foundation. The Canvas2D mask cannot do it cheaply: it is 8-bit, lives on the CPU side, and gets cleared four times per fill.

## 5. Target architecture

```
CPU   Hobbs macro geometry (coarse polygons, trims, scatter, bleed modifiers)
        └─► one vertex buffer per fill
GPU   pass A: instanced fine subdivision + signed fan triangles ─┐
              instanced erase disks / bloom and drop stamps     ├─► RGBA16F paint buffer
              border ribbons (from the coarse polygon)          ─┘  (glazes × paint/erase)
      pass B: ONE composite per fill or same-colour batch
              hoisted pigment, glazes collapsed in KS space,
              edge rim / granulation / pooling from the paint field and the paper
```

The float buffer needs `EXT_color_buffer_float` or `EXT_color_buffer_half_float`, which practically every WebGL2 device supports. The fallback is RGBA8: source-over and destination-out blending on separate channels, which reproduces today's 8-bit behaviour.

## Open decisions

| # | Decision | Needed before | Notes |
|---|---|---|---|
| F-D1 | **How much may the classic look change in step 2?** Same CPU polygons, but GPU coverage changes edge antialiasing, quantisation and the border band. | Step 2 merge | Approve from side-by-side seeded renders. |
| F-D2 | **New look: default or opt-in?** | Step 3 end | For example, a `fillStyle("classic" \| "watercolor")` call, or the new model becomes the default and the classic one stays behind a flag. 2.4.0 made a similar call for strokes (paper always on). |
| F-D3 | **Seed compatibility.** Steps 4 and 5 change seeded output (KS-space glazes, hashed RNG). | Step 4 | Seeds keep their statistics, not their exact pixels, as with D4 in the stroke plan. |
| F-D4 | **Release vehicle.** | Step 6 | Minor (2.5.0) if the classic look stays the default; consider a major version if the new look becomes the default. |

## Steps

Each step stands alone and is measured before and after. Don't mix a look change with an architecture change in one commit.

### 0. Fill harness and baseline — done

- Add fill workloads to `test/e2e/bench.mjs`: the large fill (1200², density 2), 40 small fills, 4 washes, and one high-bleed case.
- Add a seeded visual fixture: a grid of fills across the bleed, texture and border ranges, saved as PNG for side-by-side review. Don't add a strict pixel test, because steps 2–5 change pixels by design.
- Commit the 2.4.0 baseline on a hardware GPU (Apple M4, Metal).

**Done when:** `npm run measure:bench` reports the new workloads and the baselines are committed. No library changes.

**Result.** `bench.mjs` has four new workloads: `fillLarge`, `fillMany`, `wash` and `fillHighBleed`. `node test/e2e/fill-sheet.mjs [--density=2] [--angle=metal]` writes the contact sheet to `workspace/fill-sheet-d2.png`. The 2.4.0 baseline is `test/e2e/baselines/bench-2.4.0-metal-m4.json`. Run the bench with `--angle=metal`: this plan doesn't track SwiftShader (Chrome's CPU software renderer). It is far too slow, and its costs don't resemble any real GPU.

| Workload, total ms (2.4.0, Apple M4) | |
|---|---:|
| fill (512², d1) | 10 |
| fillLarge | 82 |
| fillMany | 283 |
| wash | 66 |
| fillHighBleed | 92 |

### 1. Hoist pigment terms out of the composite — done

- In `runBlendShaderPass` (both adapters), compute the pigment's KS[38] and luminance once per pass and pass them as uniforms.
- Brush composites darken the pigment per pixel (`u_isBrush`, above `DARKEN_THRESHOLD`). Hoist the two endpoints (plain pigment and fully darkened pigment) and interpolate KS per pixel, or keep the per-pixel path for that branch only. Measure which is faster.

**Done when:** washes and strokes are within 1/255 of 2.4.0, and composite time drops at least 1.8× on the large-fill workload (measured: 2.3×).

**Result.** `src/core/spectral.js` computes the pigment's K/S and luminance once per pass, and the shader's `spectral_mix_pigment()` uses them. The shader is compiled twice: the stroke program keeps the per-pixel darkening path (`#define BRUSH`); the fill/wash program leaves it out. That split mattered more than the hoisting. With the darkening branch merely present, unused, fills ran only 1.45× faster; without it, 2.5×. Interpolating precomputed darkened pigments instead would have been off by up to 17/255.

- **Pixels:** strokes, hatch, mass and washes are bit-identical to 2.4.0. Fills differ by 1/255 in a handful of channels (11 of 5.8 M; p5 adapter: 4 of 640 K). The exact-hash compatibility tests pass unchanged.
- **Timings:** the wash and fillLarge results repeat across runs. Other workloads vary by up to ±20% between runs on the M4.

| Workload, total ms (Apple M4) | 2.4.0 | Step 1 |
|---|---:|---:|
| fill | 10 | 8.5 |
| fillLarge | 82 | **33** |
| fillMany | 283 | 301 |
| wash | 66 | **19–24** |
| fillHighBleed | 92 | 72–90 |

`fillMany` is CPU-bound, so step 1 doesn't help it; step 2 targets it.

### 2. GPU paint buffer (replace the Canvas2D mask) — done, pending F-D1

CPU geometry and RNG stay exactly as they are, so the same polygons are produced.

What was built (`src/fill/gl_fill.js`, `fan.*`, `capsule.*`):

- **Mask.** A half-float framebuffer with depth and stencil replaces the Canvas2D mask, staging canvases, `drawImage` and `texSubImage2D`. It stores log-domain paint in R and erasure in G. The composite shader decodes coverage as (1 − e^−R)·e^−G, which is exactly Canvas2D source-over followed by destination-out, without 8-bit quantisation. Fills and washes need `EXT_color_buffer_float`, which WebGL2 hardware supports in practice.
- **Glazes.** Kept as before: 4 composites per fill. Merging them into one pass is left to step 4, together with the KS-space collapse, because step 1 showed the cost is the spectral math, not the pass count.
- **Polygons: stencil-then-cover.** This replaces the planned signed additive fans. Self-intersecting grown polygons counted twice under additive fans and showed as dark spots at high bleed. Stencil-then-cover is Canvas2D's nonzero rule, exactly. It takes 2 draws per polygon.
- **Antialiasing: jittered passes.** 2 sub-pixel samples for fill layers, 4 for washes (a wash is one hard-edged polygon). Without antialiasing, wash and low-bleed edges were visibly stair-stepped at density 1. MSAA was rejected: about 200 MB of buffers on a large density-2 canvas. 4 samples for fills cost +6–15 ms over 2 for no visible gain.
- **Borders and erase circles.** Instanced capsules with analytic edge antialiasing. Each polygon's border shares a depth value, and a LESS depth test paints each pixel once per border, matching Canvas2D's stroke union. This replaces the planned ribbon, which would have needed smoothed normals.
- **Bounds.** All mask writes are scissored to the paint bounds, and clears are confined to the same rect.
- **GPU sync points removed.** There are no `getParameter` queries on the fill path, and vertex buffers are orphaned (`bufferData`) instead of overwritten (`bufferSubData`). Both had stalled the CPU on the GPU.
- **Washes** go through the same buffer.

Bounds work, measured separately on `fillMany`, total ms:

| | fillMany | fillHighBleed |
|---|---:|---:|
| Neither | 131 | 48 |
| Scissored draws | 126 | 49 |
| Scissored draws + partial clears | 107 | 38 |

Pixels against 2.4.0:
- Strokes, hatch and mass are bit-identical.
- Washes are identical except at the antialiased edges.
- Fills: 86% of painted pixels are within 5/255, 12% within 10/255 and 2% further (max 67/255). Dense areas come out slightly deeper because float accumulation has no 8-bit saturation. Character is unchanged in the contact sheets (`test/e2e/fill-sheet.mjs`, densities 1 and 2).
- Fringe pixels below 1/255 coverage differ in footprint by about 0.1%. They are invisible but make exact hashes differ on transparent targets.
- The `wash`, `washSequence` and `watercolor` compatibility fixtures were regenerated, with notes in `legacy-output.json`. All other fingerprints are unchanged.

| Workload, total ms (Apple M4) | 2.4.0 | Step 1 | Step 2 |
|---|---:|---:|---:|
| fill | 10 | 8.5 | **5.9** |
| fillLarge | 82 | 33 | **31** |
| fillMany | 283 | 301 | **106** |
| wash | 66 | 19–24 | **18.5** |
| fillHighBleed | 92 | 72–90 | **38** |

The done-when target for `fillMany` (≥3×) is not met: it is 2.7×. Its 102 ms of CPU time is now almost all JS polygon growth (`grow()` and the RNG, about 2.5 ms per fill), which step 3 (fewer layers) or step 5 (GPU subdivision) address. `fillLarge` is bound by the 4 spectral composites (step 4).

### 3. Style spike: watercolour on the paint buffer

Build it as an opt-in prototype; it is not the default.

- Dried rim: an edge band from paint − blurred paint (half-resolution separable blur), controlled by `border`.
- Granulation from the shared paper height, controlled by `texture`.
- Low-frequency pooling, aligned with the `fillBleed` angle when one is set.
- Blooms and wet-in-wet drops as stamps or noise fronts.
- Rebalance the Hobbs stack. If interior fields carry the texture, the silhouette may need fewer layers (for example 20–30 instead of 90) and fewer or no erase circles. That cuts geometry cost without step 5.
- Compare against the reference videos and the current look, at densities 1, 2 and 3.

**Done when:** F-D2 is decided, with the cost of the new look measured. A rejected spike is a valid outcome; steps 1–2 stand on their own.

**Result (spike, 2026-10-27).** `brush.fillStyle("classic" | "watercolor")`, experimental and opt-in. Classic output is unchanged: all exact-hash fixtures pass.

The watercolour composite is a third build of `shader.frag` (`#define WATERCOLOR`), so the classic and stroke programs stay as they were. It runs once per fill instead of four times. Geometry is still Hobbs (base growth, three trims, the darker layer, the scatter layer, the same bleed modifiers), with these changes:

- **5 layers instead of 20.** The schedule is walked in steps of 4, each layer 4× denser. It looked better than 10 or 20 layers (flatter washes, distinct glaze shapes, no beaded edges), and it is the main speed win.
- **No erase circles and no border capsules.** Texture and rim come from the composite.
- **No finest growth level.** Its zigzags showed as a saw-tooth along a crisp edge.
- **Trim cuts bow slightly inward**, so their tone steps read as wash boundaries rather than ruler lines.
- **The outline layer is never trimmed** and also writes a silhouette channel (mask B). The edge comes from that channel only, so trims shade the interior but never cut the outline or close a concave notch.

The composite (`watercolor()` in `shader.frag`):

- **A half-resolution separable Gaussian blur of the mask** (`src/fill/blur.frag`, 2 passes, σ ≈ 3.5% of the shape size). It gives the smooth silhouette field, the share of each neighbourhood that is inside, and the mean inside paint. An earlier version built these from 16 ring taps instead. Its edge traced shifted copies of the pixel-stepped raster ("a blown-up low-res image"), with ghost contours.
- **Edge.** The signed distance to the blurred silhouette's iso-line, roughened by the shared paper height. The paper shift is kept below the paper bumps' size: noise thresholds broke off flecks that looked cut out in Photoshop. Some stretches are rougher than others. Some stretches, more often on wetter fills, are *lost edges* that fade to bare paper with no line.
- **Rim.** A thin dark line that follows the actual edge, over a faint band fading inward (`border`).
- **Interior.** Granulation in the paper's valleys, strongest where paint is thin. Patchy reticulation (Worley cell walls), more likely at high `texture`. Low-frequency drift. Per fill, sometimes: a pooled side behind a curved front (downstream with a `fillBleed` angle), a wet-in-wet drop, or a small bloom with a broken front.
- Pitfalls hit: glslify renames the `u` of `123u` literals in modules required from other modules (`value_noise.glsl` uses `uint(int)` instead). The composite rect is wider than the paint bounds, so the blur must cover it, or the composite reads a previous fill's blur as a stray line.

Cost, Apple M4, total ms. These are quiet-machine runs, after the blur and before the final edge rework:

| Workload | classic | watercolor |
|---|---:|---:|
| fill | 6.3 | 3.3 |
| fillLarge | 31 | 27 |
| fillMany | 106 | **34** |
| fillHighBleed | 38 | 28 |

The final edge (paper roughness and lost edges) was measured only on a loaded machine. In that run classic read 1.4–1.6× its quiet numbers, and watercolour stayed faster than classic on every fill workload (fillMany 45 vs 151–176 ms). Re-measure before release. `node test/e2e/bench.mjs --fill-style=watercolor` and `node test/e2e/fill-sheet.mjs --style=watercolor` select the style; the standalone and p5 fill explorers take `?style=watercolor`.

Not done in the spike: densities 1 and 3 were only spot-checked.

### 3b. Wet-in-wet contacts

Fills that touch a wash that is still wet lose their edge there, and their pigment creeps into the wet area. Wet-on-dry overlaps stay as they are (hard-edged glazes).

- A per-target, half-resolution wetness buffer. After each watercolour fill composites, its blurred silhouette is stamped in as wet. Every new fill dries the buffer by a fixed factor: drying is by fill count, deterministic under a seed.
- The composite reads wetness under the fill. Where its edge meets wet paint, the edge becomes a lost edge and the pigment spreads past the silhouette. Only the new fill moves; the earlier one is already on the canvas.
- Lifecycle: cleared on `clear()` and resize, one buffer per drawing target.
- Also fix: smooth, dense drops (no granulation spray over them), less regular reticulation, and less periodic wobble along long straight edges.

### 4. Composite collapse

- Collapse glazes in KS space (P4): one composite evaluates about 2 mix-equivalents instead of 4.
- Batch consecutive same-colour fills into one composite. Overlaps change slightly, because one fill's erasure now also hits the other's paint. Keep this only if the side-by-side passes.
- With the seed-compatibility decision (F-D3), skip constructing the sparse scatter geometry when `State.fill.scatter` is false. Currently `this.scatter(0.1).grow().scatter(0.75).flipDirs()` runs even though its result is unused. Skipping it changes subsequent RNG consumption; accept that alongside the other seeded-output changes rather than adding RNG-preservation machinery. Do not skip scatter merely because texture is zero: its border can still contribute.

Whether this applies to the classic look, the new look, or both depends on step 3.

**Done when:** F-D3 is decided; composite time on the large fill drops at least 1.5× more, and the 40-fill workload uses at most one composite per colour run.

### 5. GPU fine geometry (only if still needed)

- Do the last two growth levels in the vertex shader with hashed randomness (F11, audit §5.4), and use typed arrays for the coarse levels.
- Skip this step if, after step 3, CPU geometry is below about 20% of fill time (see the no-overengineering rule in the stroke plan).

**Done when:** CPU geometry time drops at least 3× on the 40-fill workload with no visible change in character.

### 6. Release

- Update the README and `llms.txt` for any new API (F-D2).
- Rebuild `dist`, rerun the harness on a hardware GPU, and record the results here.

## Expected outcome

These are projections, not measurements. Steps 1, 2 and 4 together should take the large fill from about 80 ms to roughly 10–15 ms on an M4, and the 40-fill workload from 279 ms to roughly 30–40 ms. Step 3's cost will be budgeted against these numbers. The new look should cost no more than the old one; it will probably cost less if the layer count drops.
