/**
 * p5.brush Performance Benchmark
 * ================================
 * Imports directly from source files to ensure benchmark always reflects
 * the actual implementation. Uses a custom ESM loader to stub GLSL shaders.
 *
 * Run via: node --experimental-loader ./benchmark/loader.mjs benchmark/bench.mjs
 * Outputs METRIC lines for autoresearch.
 */

import { performance } from "perf_hooks";
import { setTargetState, setTargetRuntime } from "../src/core/target.js";
import { setRuntime } from "../src/core/runtime.js";
import {
  cos, sin, gaussian, map, rr, randInt, constrain, dist, rotate, intersectLines, seed,
} from "../src/core/utils.js";
import { Plot } from "../src/core/plot.js";
import { Polygon } from "../src/core/polygon.js";
import { hatch, getHatchLines } from "../src/hatch/hatch.js";
import { isFieldReady, Position, noField } from "../src/core/flowfield.js";
import { Mix } from "../src/core/color.js";
import { fill, fillBleed, fillTexture, createFill } from "../src/fill/fill.js";

// Mock canvas context for fill benchmarking
const mockCtx = {
  save: () => {}, restore: () => {}, beginPath: () => {}, fill: () => {}, stroke: () => {},
  closePath: () => {}, moveTo: () => {}, lineTo: () => {}, arc: () => {},
  setTransform: () => {}, strokeStyle: '', lineCap: '', lineWidth: 0, fillStyle: '',
  globalCompositeOperation: 'source-over',
  getTransform: () => ({ a: 1, b: 0, c: 0, d: 1, e: 400, f: 300 }),
};

// Setup minimal environment
setTargetState({ Cwidth: 800, Cheight: 600, Density: 1, Renderer: { loaded: true } });
setTargetRuntime({ isCanvasReady: () => {}, syncDensity: () => 1 });
setRuntime({ createColor: (r, g, b) => ({ r, g, b }), getAffineMatrix: () => ({ a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 }), usesRadians: () => false });
Mix.ctx = mockCtx;
Mix.isBrush = false; Mix.justChanged = false; Mix.blend = () => {}; Mix.mask = null; Mix.markDirtyRect = () => {};

seed(42);
isFieldReady();
noField();

fill(255, 0, 0, 150); fillBleed(0.07); fillTexture(0.8, 0.5);

// ============================================================
// BENCHMARK RUNNER
// ============================================================

function bench(fn, iterations) {
  // Warmup
  for (let i = 0; i < Math.min(Math.ceil(iterations / 10), 100); i++) fn();
  // Timed run
  const t0 = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  return performance.now() - t0;
}

function medianOf(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const RUNS = 7;

// ============================================================
// 1. TRIG LOOKUP (cos/sin from utils.js)
// ============================================================
function benchTrig() {
  let sum = 0;
  for (let i = 0; i < 10000; i++) {
    sum += cos(i * 0.1) + sin(i * 0.1 + 45.3);
  }
  return sum;
}
const trigMs = medianOf(Array.from({ length: RUNS }, () => bench(benchTrig, 100)));

// ============================================================
// 2. GAUSSIAN RANDOM (Box-Muller from utils.js)
// ============================================================
function benchGaussian() {
  let sum = 0;
  for (let i = 0; i < 1000; i++) sum += gaussian(0, 1);
  return sum;
}
const gaussMs = medianOf(Array.from({ length: RUNS }, () => bench(benchGaussian, 200)));

// ============================================================
// 3. PLOT: calcIndex + angle + pressure
// ============================================================
const testPlot = new Plot("curve");
for (let i = 0; i < 20; i++) testPlot.addSegment(i * 18, 50, 0.8);
testPlot.endPlot(0, 1.0);

function benchPlot() {
  let sum = 0;
  for (let d = 0; d < testPlot.length; d += 2) {
    sum += testPlot.angle(d) + testPlot.pressure(d);
  }
  return sum;
}
const plotMs = medianOf(Array.from({ length: RUNS }, () => bench(benchPlot, 2000)));

// ============================================================
// 4. HATCH: scanlineHatch (via getHatchLines)
// ============================================================
const hatchPolyPts = [];
for (let i = 0; i < 200; i++) {
  const a = (i / 200) * 2 * Math.PI;
  hatchPolyPts.push([Math.cos(a) * 200, Math.sin(a) * 200]);
}
const hatchPolygon = new Polygon(hatchPolyPts);
hatch(8, 45);

function benchHatch() {
  return getHatchLines([hatchPolygon]);
}
const hatchMs = medianOf(Array.from({ length: RUNS }, () => bench(benchHatch, 200)));

// ============================================================
// 5. POLYGON: intersect (via cached intersection)
// ============================================================
const bigPolygon = (() => {
  const pts = [];
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * 2 * Math.PI;
    pts.push([Math.cos(a) * 150, Math.sin(a) * 150]);
  }
  return new Polygon(pts);
})();

function benchIntersect() {
  // Clear cache to force fresh computation
  bigPolygon._intersectionCache = {};
  let count = 0;
  for (let y = -120; y < 120; y += 10) {
    const line = { point1: { x: -200, y }, point2: { x: 200, y } };
    count += bigPolygon.intersect(line).length;
  }
  return count;
}
const intersectMs = medianOf(Array.from({ length: RUNS }, () => bench(benchIntersect, 500)));

// ============================================================
// 6. POSITION.movePos() — core stroke rendering loop
// ============================================================
const movePlot = new Plot("curve");
for (let i = 0; i < 10; i++) movePlot.addSegment(i * 36, 100, 0.8);
movePlot.endPlot(0, 1.0);

function benchMovePos() {
  // Simulate a brush stroke: moveTo (direction-based) + plotTo (plot-based)
  let total = 0;
  for (let i = 0; i < 5; i++) {
    const pos = new Position(400, 300);
    pos.moveTo(45 + i * 30, 200, 1);
    total += pos.x;
  }
  for (let i = 0; i < 5; i++) {
    const pos = new Position(400, 300);
    pos.plotTo(movePlot, 500, 1, 1);
    total += pos.x;
  }
  return total;
}
const movePosMs = medianOf(Array.from({ length: RUNS }, () => bench(benchMovePos, 200)));

// ============================================================
// 7. INTERSECT LINES: raw intersectLines() from utils.js
// ============================================================
function benchIntersectLines() {
  let count = 0;
  const p1 = { x: -200, y: 0 }, p2 = { x: 200, y: 0 };
  for (let i = 0; i < 1000; i++) {
    const a = { x: i * 0.5 - 100, y: -50 };
    const b = { x: i * 0.3 + 50, y: 50 };
    if (intersectLines(p1, p2, a, b)) count++;
  }
  return count;
}
const intersectLinesMs = medianOf(Array.from({ length: RUNS }, () => bench(benchIntersectLines, 500)));

// ============================================================
// 8. FILL: createFill() watercolor hot path
// ============================================================
const fillPolyPts = [];
for (let i = 0; i < 30; i++) {
  const a = (i / 30) * 2 * Math.PI;
  fillPolyPts.push([Math.cos(a) * 100, Math.sin(a) * 100]);
}
const fillPolygon = new Polygon(fillPolyPts);

function benchFill() {
  seed(42);
  createFill(fillPolygon);
}
const fillMs = medianOf(Array.from({ length: RUNS }, () => bench(benchFill, 30)));

// ============================================================
// TOTAL (primary metric)
// ============================================================
const total_ms = trigMs + gaussMs + plotMs + hatchMs + intersectMs + intersectLinesMs + movePosMs + fillMs;

console.log(`METRIC total_ms=${total_ms.toFixed(3)}`);
console.log(`METRIC trig_ms=${trigMs.toFixed(3)}`);
console.log(`METRIC gauss_ms=${gaussMs.toFixed(3)}`);
console.log(`METRIC plot_ms=${plotMs.toFixed(3)}`);
console.log(`METRIC hatch_ms=${hatchMs.toFixed(3)}`);
console.log(`METRIC intersect_ms=${intersectMs.toFixed(3)}`);
console.log(`METRIC intersect_lines_ms=${intersectLinesMs.toFixed(3)}`);
console.log(`METRIC movepos_ms=${movePosMs.toFixed(3)}`);
console.log(`METRIC fill_ms=${fillMs.toFixed(3)}`);
