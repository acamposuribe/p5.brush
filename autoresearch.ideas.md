# Autoresearch Ideas

## Unexplored / Deferred

- **Amortized O(1) calcIndex for genPol()**: In Plot.genPol(), `this.calcIndex(pos.plotted)` is called after `pos.plotTo(this, step, step)`. The plotTo already sets this.index for the pre-step position. A post-step check (`if (this._cumLen[this.index+1] > pos.plotted)`) would save binary search for ~95% of genPol steps. BUT: previous attempt caused JIT interference when added inside calcIndex. Could work if inlined in genPol() directly. **Risk: medium (modifying plot.js).**

- **AEL (Active Edge List) for scanlineHatch**: Sort edges by min(y1,y2) and use an active edge list to skip checking edges that don't span the current Y. For convex polygons (common case), would save ~0% (all edges are potentially active). For non-convex shapes: could save up to 50% of edge checks. **Risk: medium complexity, low benefit for convex polygons.**

- **XOR pre-check in Polygon.intersect() for horizontal lines**: Add a fast Y-range check before calling intersectLines for horizontal lines. Saves ~50% of intersectLines calls. But Polygon.intersect() is not in rendering hot path, and modifying polygon.js risks JIT interference with fill.js. **Risk: medium JIT, low benefit.**

- **Box-Muller cached value**: Store the second gaussian value (z1 = sqrt(-2ln(u)) * sin(360*v)) and use it on next call. Would halve Math.sqrt/Math.log calls. BUT: changes the RNG sequence = changes visual output. **Off-limits without explicit visual-change permission.**

- **GROW_CAP skip computation**: For grows that will hit GROW_CAP (idx > GROW_CAP, step=2), the inserted vertices are discarded. Computing them wastes CPU but the RNG calls are needed for sequence preservation. Only the NON-RNG computation (cossin, multiplications) can be skipped for discarded vertices. Saves ~10ns × 150 vertices × 200 GROW_CAP grows = 300µs per fill. **Worth trying: low risk to utils.js, high complexity in fill.js.**

- **Double-buffered scratch arrays for grow()**: Use two alternating sets of newMods/newDirs to avoid slice() allocation. Complex to implement correctly given multiple live FillPoly objects. **Risk: high complexity.**

- **Interleaved Float64Array for FillPoly vertices**: Store [x0, y0, x1, y1, ...] as a single Float64Array. Better cache locality than parallel arrays. Avoids {x,y} object allocations in grow(). BUT: previous typed-array refactors caused JIT interference. Float64 vs Float32 matters (avoid type conversion overhead). **Risk: high JIT interference.**

## Known Dead Ends

- Sequential fast path in calcIndex (inside the function): Causes JIT deoptimization of unrelated code
- movePos fast path for constant-direction strokes: JIT interference
- Float32Array for FillPoly vertices: net negative (2 writes per vertex instead of 1 alloc)
- Float32Array for gaussian pools: JIT interference
- for-of → indexed loop in fill inner loop: JIT interference from fill.js changes
- Any code additions to hatch.js that change control flow: JIT interference on fill_ms
