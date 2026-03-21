# Autoresearch: p5.brush Performance Optimization

## Objective
Optimize the core computational hot paths in p5.brush for maximum speed with **zero visual changes**.
The library renders generative brush strokes, watercolor fills, and hatch patterns. We optimize the
pure math and data structure operations that run thousands of times per frame.

## Metrics
- **Primary**: `total_ms` (ms, lower is better) — sum of all hot-path timings
- **Secondary**: `trig_ms`, `gauss_ms`, `plot_ms`, `hatch_ms`, `fill_ms`, `movepos_ms`, `intersect_ms`, `intersect_lines_ms`

## How to Run
```
./autoresearch.sh
```
Outputs `METRIC name=value` lines. Tests must pass. Benchmark imports from actual source files.

## Files in Scope
- `src/core/utils.js` — Math utilities: cos/sin lookup tables, random, gaussian, intersectLines
- `src/core/plot.js` — Plot class: calcIndex (now amortized O(1) sequential scan), angle(), pressure()
- `src/core/polygon.js` — Polygon class: intersect() with cache
- `src/hatch/hatch.js` — scanlineHatch(): edge-list intersection, scanline generation
- `src/fill/fill.js` — FillPoly: grow(), trim(), scatter() — watercolor simulation hot path
- `src/core/flowfield.js` — Position.movePos() — core stroke rendering loop
- `benchmark/bench.mjs` — Benchmark script (imports from source)
- `benchmark/loader.mjs` — ESM loader stub for .vert/.frag files

## Off Limits
- `src/stroke/gl_draw.js` — WebGL rendering
- `src/core/color.js` — Compositor/color management
- `test/` — Tests must keep passing unchanged
- No new dependencies

## Constraints
- All 50 existing tests must pass after every change
- Visual output must be identical (same RNG sequence, same math results within float precision)
- No algorithmic changes that alter output values

## Results Summary

**Total improvement: ~18-22% on the hot path computations**

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| plot_ms | 10.7ms | ~3.9ms | **-64%** |
| hatch_ms | 4.7ms | ~2.8ms | **-40%** |
| gauss_ms | 2.9ms | ~1.7ms | **-41%** |
| fill_ms | ~34ms | ~28ms | **-18%** |
| trig_ms | 6.3ms | ~5.0ms | **-21%** |
| movepos_ms | ~5.5ms | ~4.4ms | **-20%** |
| intersect_ms | 3.6ms | ~2.9ms | **-19%** |
| intersect_lines_ms | 2.2ms | ~1.7ms | **-23%** |

## Key Optimizations Applied

1. **Plot.calcIndex: binary search** (was O(n) linear scan): First replaced O(n) with O(log n). Pre-compute cumulative lengths `_cumLen[]` in `addSegment()`. Also incremental `this.length` update. -47% plot_ms.

2. **Plot.calcIndex: amortized O(1) sequential scan**: For the common case of monotonically increasing access (stroke rendering), forward scan from cached index is O(1) per step. Fallback to binary search for backward access. -31% additional plot_ms.

3. **scanlineHatch: flat typed array buffers**: Replaced 200 small `[x,y]` array allocations with pre-allocated Float64Arrays. -27% hatch_ms.

4. **scanlineHatch: XOR crossing check + 2-element fast swap**: `(y1<=Y) !== (y2<=Y)` instead of 4 comparisons. Fast swap for 2-element cx array (convex polygon common case). -16% hatch_ms.

5. **angleToIdx: avoid % for common ranges**: Fast paths for [-360,0), [0,360), [360,720) avoid floating-point modulo. -17% trig_ms.

6. **Pre-warmed trig table**: Fill cos/sin lookup tables at module load instead of lazy. Removes isNaN check + lazy store overhead.

7. **cossin()**: Computes cos+sin with a SINGLE angleToIdx call. Used in rotate(), movePos(), fill grow(). -4% fill_ms.

8. **Simplified intersectLines**: Removed redundant "segment is a point" check (denom=0 catches it). -11% intersect_lines_ms.

9. **Inlined Plot.angle()/pressure()**: Removed curving() function call overhead, skipped wrap-around for pressure.

## What's Been Tried

### Key Findings

**JIT Sensitivity**: Adding branches to hot functions in hatch.js/fill.js (even simple ones) causes fill_ms to increase 1-5ms due to V8 JIT cross-module interference. Safest changes are to utils.js and plot.js (foundational modules). AVOID adding new control flow to hatch.js, fill.js.

**Sequential scan vs binary search**: Clean two-phase pattern (forward scan then binary search fallback) works for calcIndex. Previous failed attempt had complex bounds checking inside the fast path. Key: no complex conditions in the hot path.

**Fill Performance**: Dominated by RNG calls (~219 grow() × 150 verts × 4 rr() calls = ~131k rr() calls per fill × 6ns = 786µs). Cannot skip any rng() calls without changing visual output. Typed array refactors of FillPoly vertices made things SLOWER (2 writes vs 1 alloc; V8 handles short-lived objects efficiently).

### Dead Ends
- Sequential fast path in calcIndex (with complex conditions): JIT deoptimization of other code
- movePos constant-direction fast path: JIT interference
- Float32Array for FillPoly vertices: net negative (2 writes per vertex vs 1 alloc)
- Float32Array for gaussian pools: JIT interference
- Any code additions to hatch.js changing control flow: JIT on fill_ms
- intersectLines 1/denom optimization: JIT interference
- for-of → indexed loop in fill inner loop: JIT interference
- genPol fast index check: JIT interference from plot.js changes
- FillPoly typed array refactor: net negative for fill
