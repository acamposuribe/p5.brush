# Autoresearch: p5.brush Performance Optimization

## Objective
Optimize the core computational hot paths in p5.brush for maximum speed with **zero visual changes**.
The library renders generative brush strokes, watercolor fills, and hatch patterns. We optimize the
pure math and data structure operations that run thousands of times per frame.

## Metrics
- **Primary**: `total_ms` (ms, lower is better) — sum of all hot-path timings
- **Secondary**: `trig_ms`, `gauss_ms`, `plot_ms`, `hatch_ms`, `intersect_ms`, `intersect_lines_ms`

## How to Run
```
./autoresearch.sh
```
Outputs `METRIC name=value` lines. Tests must pass. Benchmark imports from actual source files.

## Files in Scope
- `src/core/utils.js` — Math utilities: cos/sin lookup tables, random number generators, gaussian, intersectLines, map, constrain, rotate, dist
- `src/core/plot.js` — Plot class: calcIndex (O(n) linear scan), angle(), pressure(), curving() interpolation
- `src/core/polygon.js` — Polygon class: intersect() with cache
- `src/hatch/hatch.js` — scanlineHatch(): edge-list intersection, scanline generation
- `src/fill/fill.js` — FillPoly: grow(), trim(), scatter() — watercolor simulation hot path
- `benchmark/bench.mjs` — Benchmark script (imports from source)
- `benchmark/loader.mjs` — ESM loader stub for .vert/.frag files

## Off Limits
- `src/stroke/gl_draw.js` — WebGL rendering, not benchmarked
- `src/core/color.js` — Compositor/color management
- `test/` — Tests must keep passing unchanged
- No new dependencies

## Constraints
- All 50 existing tests must pass after every change
- Visual output must be identical (same RNG sequence, same math results within float precision)
- No algorithmic changes that alter output values

## What's Been Tried

### Key Finding: JIT Sensitivity
Adding branches (if/else fast paths) to hot functions like `calcIndex()` and `movePos()` causes V8 to deoptimize the function OR unrelated code in the same module. This happened twice — sequential fast path in calcIndex, constant-direction fast path in movePos. **Do NOT add branches to these functions.**

### Key Finding: Fill Performance
The `createFill()` watercolor fill function is dominated by RNG calls (prng_alea ~6ns/call × ~87,000 calls/fill ≈ 522µs). A typed-array refactor of FillPoly vertices made it SLOWER because V8 handles short-lived `{x,y}` objects efficiently in young-gen GC. Real optimization opportunity: avoid calling `angleToIdx()` twice for the same angle (cos + sin).

### Baseline
- Established benchmark: total_ms ≈ 36-37ms
- trig_ms ≈ 7ms (lookup table already in place)
- gauss_ms ≈ 3ms (Box-Muller with trig lookup)
- plot_ms ≈ 13ms (Plot.calcIndex is O(n) linear scan)
- hatch_ms ≈ 6ms (scanlineHatch with edge intersections)
- intersect_ms ≈ 5ms (Polygon.intersect with cache)
- intersect_lines_ms ≈ 2ms

### Key Observations
1. **plot_ms dominates** at ~35% of total. Plot.calcIndex() does a linear scan through segments on every angle/pressure query. This is called thousands of times per stroke.
2. **trig lookup tables** are already implemented (good optimization already in place)
3. **Polygon.intersect cache** already uses string key caching
4. **gaussian()** uses Box-Muller with cos() lookup — could pool pre-computed values
5. **intersectLines()** uses early exit checks — pretty lean already

### Ideas to Try
- [ ] Plot.calcIndex(): Use binary search instead of linear scan (O(log n) vs O(n))
- [ ] Plot: Cache cumulative segment lengths for faster binary search
- [ ] Polygon.intersect: Replace string key with numeric hash for cache lookup
- [ ] scanlineHatch: Avoid repeated rotation math per scanline
- [ ] intersectLines: Simplify with direct computations
- [ ] gaussian pool: Pre-compute pool at seed time, use cycling index
