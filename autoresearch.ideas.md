# Autoresearch Ideas

## Unexplored / Deferred

- **Remove esm-seedrandom dependency**: No longer imported — can be removed from package.json. Reduces bundle size.

- **Box-Muller cached value**: Store second gaussian value (z1 = sqrt(-2ln(u)) * sin(360*v)) and use on next call. Halves Math.sqrt/Math.log calls. RNG sequence changes but user approved RNG output changes. **High potential for gauss_ms.**

- **Amortized O(1) calcIndex for genPol()**: Inline the forward-scan check directly in genPol() instead of inside calcIndex. Previous attempt inside calcIndex caused JIT interference but inline at call site may work. **Risk: medium.**

- **GROW_CAP skip computation**: For grows that hit GROW_CAP (step≥2), inserted vertices get discarded. Can skip cossin/multiplications for those — but RNG calls must still happen for sequence preservation. Estimated ~300µs savings per fill. **Medium complexity, low risk to utils.js.**

## Known Dead Ends (do NOT retry)
- Sequential fast path in calcIndex (with complex conditions): JIT deoptimization
- movePos constant-direction fast path: JIT interference
- Float32Array for FillPoly vertices: net negative
- Float32Array for gaussian pools: JIT interference
- Any code additions to hatch.js changing control flow: JIT on fill_ms
- intersectLines 1/denom optimization: JIT interference
- for-of → indexed loop in fill inner loop: JIT interference
- genPol fast index check (inside calcIndex): JIT interference
- AEL for scanlineHatch: low benefit for convex polygons
