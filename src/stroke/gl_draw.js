// =============================================================================
// Module: GL Draw
// =============================================================================
/**
 * Renders brush strokes on the GPU. A stroke is queued as records, each
 * covering up to RECORD_STEPS fine steps of one piece of its path (a straight
 * run or an arc). The shaders compute every step's position and pressure and
 * draw it as the brush's dots (dots.vert) or stamps (stamps.vert) into the
 * brush mask.
 *
 * Consecutive strokes that share a brush type, colour, transform, clip and
 * target are drawn together. The queue is flushed when that state changes
 * and before the brush mask is cleared or composited.
 */

import { Cwidth, Cheight, Density, Renderer } from "../core/target.js";
import {
  Mix,
  isMixReady,
  State,
} from "../core/color.js";
import { createProgram } from "../core/gl/utils.js";
import {
  beginDirectMaskDraw,
  endDirectMaskDraw,
  resetDirectShaderTracking,
} from "../core/renderer_runtime.js";
import { getAffineMatrix } from "../core/runtime.js";
import { seedHash } from "../core/utils.js";
import { pathPoint } from "../core/plot.js";
import { CLIP_UNIFORMS, setClipUniforms } from "./clip.js";
import dotsVertSrc from "./dots.vert";
import dotsFragSrc from "./dots.frag";
import stampsVertSrc from "./stamps.vert";
import stampsFragSrc from "./stamps.frag";

// =============================================================================
// Section: State
// =============================================================================

/** Most fine steps in one record. */
const RECORD_STEPS = 1024;

// Records are drawn in groups by step count, rounded up to a multiple of 8
// below 64 and of 64 above; each record culls the steps past its own count.
const GROUPS = 23;
const groupOf = (count) => (count <= 64 ? Math.ceil(count / 8) - 1 : 6 + Math.ceil(count / 64));
const groupSteps = (group) => (group < 8 ? (group + 1) * 8 : (group - 6) * 64);

// The shaders draw a record's steps in a scattered order, step = i × stride
// mod n: dots drawn in path order overlap the same pixels and each blend
// waits for the last. A stride coprime with n visits every step once.
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
function scatterStride(n) {
  let stride = Math.round(n * 0.618) | 1;
  while (gcd(stride, n) !== 1) stride += 2;
  return stride;
}
const GROUP_STRIDES = Array.from({ length: GROUPS }, (_, group) => scatterStride(groupSteps(group)));

// Pressure models (pressure.glsl), and samples per custom pressure curve.
export const PRESSURE_LINEAR = 0, PRESSURE_BUMP = 1, PRESSURE_CUSTOM = 2;
export const TABLE_SAMPLES = 257;

const DOT_TYPES = { default: 0, spray: 1, marker: 2 };
const ROTATE_MODES = { random: 1, natural: 2 };

let isLoaded = false,
  gl,
  framebufferProjMatrix;
let loadedWidth = 0,
  loadedHeight = 0;

// The two programs: attributes lists each record attribute's location.
const dots = { program: null, vao: null, attributes: [], uni: {} };
const stamps = { program: null, vao: null, attributes: [], uni: {} };
let recordBuffer = null;
let recordBufferSize = 0;

// Texture cache: tip key → WebGLTexture (cleared whenever the GL context changes)
const texCache = new Map();

// Cached matrix values — snapshotted once per stroke in snapshotMatrix()
let _affineCircle = false;
const _tipInverse = new Float32Array([1, 0, 0, 1]);
let _ma = 1,
  _mb = 0,
  _mc = 0,
  _md = 1,
  _mx = 0,
  _my = 0,
  _halfW = 0,
  _halfH = 0,
  _scale = 1,
  _density = 1;

// Record layout, in words:
//   0  origin x, y, heading as a unit vector (y up)
//   4  first step's distance from the origin, step length, step count,
//      first step's distance from the stroke's start
//   8  pressure from, to, model, custom curve's table row
//   12 pressure shape (pressure.glsl)
//   16 plot pressure at the origin and per unit, stroke length, alpha
//   20 first step's hash index, turn per unit, natural tip angle, stroke weight
//   24 seed (uint)
//   25 brush weight, scatter, sharpness, grain
// The shaders read them as the attributes below (offsets in bytes).
const RECORD_WORDS = 29;
const RECORD_ATTRIBUTES = [
  ["a_path", 4, 0], ["a_steps", 4, 16], ["a_press", 4, 32], ["a_shape", 4, 48],
  ["a_plot", 4, 64], ["a_misc", 4, 80], ["a_seed", 1, 96], ["a_brush", 4, 100],
];
let recordData = new Float32Array(1024 * RECORD_WORDS);
let recordSeeds = new Uint32Array(recordData.buffer);
let recordGroups = new Uint8Array(1024);
let recordCount = 0;
let sortedData = new Float32Array(recordData.length);
// Bounds of the queued steps in position space and the largest dot reach,
// mapped to the mask's dirty rect at flush.
let queuedMinX = Infinity, queuedMinY = Infinity, queuedMaxX = -Infinity, queuedMaxY = -Infinity;
let queuedReach = 0;
let perStep = 1; // spray dots per step needed by the current batch

// Custom pressure curves, one row each in a float texture.
const tableRows = new Map(); // Float32Array → row
let tableTexture = null;
let tableDirty = true;

// The stroke being queued, and the batch it belongs to. Everything the shaders
// read as a uniform is captured in the batch, because by the time it is
// flushed the live transform, colour or clip may belong to a later stroke.
const stroke = { seed: 0, alpha: 0, hash: 0, start: 0, param: null, weight: 1, overscan: 0 };
let batch = null;

/**
 * Snapshots the current runtime affine transform. Call once at the start of each stroke.
 */
export function snapshotMatrix() {
  const m = getAffineMatrix();
  _ma = m.a;
  _mb = m.b;
  _mc = m.c;
  _md = m.d;
  _mx = m.x;
  _my = m.y;
  _halfW = Cwidth / 2;
  _halfH = Cheight / 2;
  _scale = Math.sqrt(_ma * _ma + _mb * _mb);
  const xx = _ma * _ma + _mb * _mb;
  const yy = _mc * _mc + _md * _md;
  const xy = _ma * _mc + _mb * _md;
  _affineCircle = Math.abs(xx - yy) > 1e-10 * Math.max(1, xx, yy) || Math.abs(xy) > 1e-10 * Math.max(1, xx, yy);
  if (_affineCircle) {
    _scale = Math.sqrt((xx + yy + Math.hypot(xx - yy, 2 * xy)) / 2);
    const det = _ma * _md - _mb * _mc;
    if (det) _tipInverse.set([_scale * _md / det, -_scale * _mb / det, -_scale * _mc / det, _scale * _ma / det]);
    else _scale = 0; // A singular transform has no drawable circle area.
  }
  _density = Density;
}

// The marker's paper lives in drawing space (position space: user coords +
// Cwidth/2, Cheight/2), so it maps device px back through the inverse of the
// batch's transform. At the identity this is device px / density.
function setPaperUniforms(u, b) {
  const [a, bb, c, d] = b.affine;
  const det = a * d - bb * c;
  const k = b.density;
  if (!det) {
    gl.uniformMatrix3fv(u.u_paperInverse, false, [1 / k, 0, 0, 0, 1 / k, 0, 0, 0, 1]);
    gl.uniform1f(u.u_paperPx, 1 / k);
    return;
  }
  const ia = d / det, ib = -bb / det, ic = -c / det, id = a / det;
  const tx = b.translate[0] + b.half[0], ty = b.translate[1] + b.half[1];
  gl.uniformMatrix3fv(u.u_paperInverse, false, [
    ia / k, ib / k, 0,
    ic / k, id / k, 0,
    -ia * tx - ic * ty + b.half[0], -ib * tx - id * ty + b.half[1], 1,
  ]);
  gl.uniform1f(u.u_paperPx, 1 / (k * Math.sqrt(Math.abs(det))));
}

// Draw queued strokes before the composite reads or clears the brush mask.
Mix.beforeBrushMaskAccess = () => flushStrokes();

// =============================================================================
// Section: Initialization and Setup
// =============================================================================

function ensureBrushMaskTarget() {
  const rendererMask = Renderer?.glMask;
  if (!rendererMask) return null;
  rendererMask.dirtyRect ??= null;
  rendererMask.isDrawn ??= false;
  Mix.glMask = rendererMask;
  return rendererMask;
}

/**
 * Deletes all GL objects owned by this module on the current context.
 * Called before re-initializing when the drawing context changes, so
 * resources are not orphaned on a still-alive previous context.
 */
function releaseGlResources() {
  if (!gl || gl.isContextLost?.()) {
    texCache.clear();
    return;
  }
  const activeProgram = gl.getParameter(gl.CURRENT_PROGRAM);
  if (activeProgram === dots.program || activeProgram === stamps.program) gl.useProgram(null);
  for (const tex of texCache.values()) gl.deleteTexture(tex);
  texCache.clear();
  if (tableTexture) gl.deleteTexture(tableTexture);
  tableTexture = null;
  tableDirty = true;
  for (const p of [dots, stamps]) {
    if (p.program) gl.deleteProgram(p.program);
    if (p.vao) gl.deleteVertexArray(p.vao);
    p.program = p.vao = null;
  }
  if (recordBuffer) gl.deleteBuffer(recordBuffer);
  recordBuffer = null;
  recordBufferSize = 0;
}

/**
 * Compiles a program and builds a VAO over the record buffer, one record per
 * instance; the shaders take its fine steps from the vertex index.
 */
function setupProgram(target, vertSrc, fragSrc, uniforms) {
  target.program = createProgram(gl, vertSrc, fragSrc);
  for (const n of uniforms) target.uni[n] = gl.getUniformLocation(target.program, n);
  target.attributes = [];
  for (const [name, size, offset] of RECORD_ATTRIBUTES) {
    const loc = gl.getAttribLocation(target.program, name);
    if (loc >= 0) target.attributes.push({ loc, size, offset, integer: name === "a_seed" });
  }
  target.vao = gl.createVertexArray();
  gl.bindVertexArray(target.vao);
  for (const { loc } of target.attributes) {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribDivisor(loc, 1);
  }
  pointAtRecord(target, 0);
  gl.bindVertexArray(null);
}

/**
 * Points the bound VAO's attributes at record `first` (WebGL2 has no base
 * instance).
 */
function pointAtRecord(target, first) {
  gl.bindBuffer(gl.ARRAY_BUFFER, recordBuffer);
  const stride = RECORD_WORDS * 4;
  for (const { loc, size, offset, integer } of target.attributes) {
    const at = first * stride + offset;
    if (integer) gl.vertexAttribIPointer(loc, size, gl.UNSIGNED_INT, stride, at);
    else gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, at);
  }
}

/**
 * Initializes WebGL objects if not done already.
 */
export function isReady() {
  // Draw queued strokes on their own context before switching.
  if (recordCount > 0 && gl && Renderer.drawingContext !== gl) flushStrokes();
  isMixReady();
  ensureBrushMaskTarget();

  const nextGl = Renderer.drawingContext;
  const needsContextRefresh = !isLoaded || gl !== nextGl;
  const needsProjectionRefresh =
    needsContextRefresh || loadedWidth !== Cwidth || loadedHeight !== Cheight;

  if (needsProjectionRefresh) {
    framebufferProjMatrix = new Float32Array([
      2 / Cwidth, 0, 0, 0,
      0, 2 / Cheight, 0, 0,
      0, 0, 1, 0,
      -1, -1, 0, 1,
    ]);
    loadedWidth = Cwidth;
    loadedHeight = Cheight;
  }

  if (!needsContextRefresh) return;

  releaseGlResources();
  gl = nextGl;

  recordBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, recordBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, recordData.byteLength, gl.DYNAMIC_DRAW);
  recordBufferSize = recordData.byteLength;

  setupProgram(dots, dotsVertSrc, dotsFragSrc, [
    "u_matrix", "u_affine", "u_translate", "u_half", "u_sizeScale", "u_density",
    "u_type", "u_perStep", "u_pressureTable", "u_groupSteps", "u_stride",
    "u_color", "u_affineCircle", "u_tipInverse", "u_specks", "u_paperSeed", "u_paperInverse", "u_paperPx", "u_nib", ...CLIP_UNIFORMS,
  ]);
  setupProgram(stamps, stampsVertSrc, stampsFragSrc, [
    "u_proj", "u_tipLinear", "u_translate", "u_half",
    "u_rotate", "u_color", "u_tex", "u_pressureTable", "u_groupSteps", "u_stride", ...CLIP_UNIFORMS,
  ]);

  isLoaded = true;
}

// =============================================================================
// Section: Stroke Queue
// =============================================================================

/**
 * Starts queueing a stroke. Flushes the current batch first if this stroke
 * needs different brush, colour, transform, clip or target state.
 * @param {number} seed - Per-stroke random seed in [0, 999999).
 * @param {number} alpha - Stroke opacity [0..255].
 * @param {object} param - Brush parameters.
 * @param {object|null} tip - Preprocessed tip ({ key, image }) for image/custom brushes.
 */
export function beginStroke(seed, alpha, param, tip = null) {
  const color = State.stroke.color._array;
  if (recordCount > 0 && !joinsBatch(batch, param, tip, color)) flushStrokes();
  if (recordCount === 0) {
    batch = {
      gl,
      mask: Mix.glMask,
      tip,
      projection: framebufferProjMatrix,
      color: [...color],
      clip: State.stroke.clip,
      affine: [_ma, _mb, _mc, _md],
      translate: [_mx, _my],
      half: [_halfW, _halfH],
      scale: _scale,
      sizeScale: _density * _scale,
      density: _density,
      affineCircle: _affineCircle,
      tipInverse: new Float32Array(_tipInverse),
      param,
    };
  }
  stroke.seed = Math.floor(seed * 4294.967) >>> 0;
  stroke.alpha = alpha;
  stroke.hash = 0;
  stroke.start = recordCount;
  stroke.param = param;
  stroke.weight = State.stroke.weight;
}

/**
 * Whether a stroke can join the queued batch. Everything the shaders read as
 * a uniform must match: target, colour, transform, and the brush state that
 * is not in the records (type, stamp tip and rotation, marker nib).
 */
function joinsBatch(b, param, tip, color) {
  if (!b) return false;
  const sameTarget =
    b.gl === gl && b.mask === Mix.glMask &&
    b.projection === framebufferProjMatrix && b.clip === State.stroke.clip;
  const sameColor = sameValues(b.color, color);
  const sameTransform =
    b.affine[0] === _ma && b.affine[1] === _mb && b.affine[2] === _mc && b.affine[3] === _md &&
    b.translate[0] === _mx && b.translate[1] === _my &&
    b.half[0] === _halfW && b.half[1] === _halfH &&
    b.density === _density && b.scale === _scale &&
    b.affineCircle === _affineCircle && sameValues(b.tipInverse, _tipInverse);
  const p = b.param;
  const sameBrush =
    p.type === param.type && b.tip?.key === tip?.key &&
    p.rotate === param.rotate &&
    p.nib?.angle === param.nib?.angle && p.nib?.thickness === param.nib?.thickness;
  return sameTarget && sameColor && sameTransform && sameBrush;
}

function sameValues(a, b) {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/**
 * Drops the records of the stroke being queued (e.g. after it threw),
 * keeping earlier strokes in the batch.
 */
export function discardStroke() {
  recordCount = Math.min(recordCount, stroke.start);
}

/**
 * Queues `count` fine steps along one piece of the stroke's path, from the
 * stroke's step `first`, `stepSize` apart.
 * @param {{x: number, y: number, heading: number, turn: number, start: number,
 *   pressure: number, pressureSlope: number}} piece - See Plot.pieces().
 * @param {{model: number, from: number, to: number, shape: number[],
 *   length: number, table: Float32Array|null, min: number, max: number,
 *   minPositive: number}} pressure - Its model (pressure.glsl), and the range
 *   it stays within over these steps.
 * @param {number} [alphaScale=1] - Brightens end caps.
 */
export function queuePiece(piece, first, count, stepSize, pressure, alphaScale = 1) {
  if (_scale === 0 || count <= 0 || pressure.max <= 0) return;
  const param = stroke.param;
  if (param.type === "spray") growPerStep(param.grain, pressure.minPositive);
  const row = pressure.table ? tableRow(pressure.table) : 0;
  const cos = Math.cos(piece.heading), sin = Math.sin(piece.heading);

  for (let i = 0; i < count; i += RECORD_STEPS) {
    const n = Math.min(RECORD_STEPS, count - i);
    const fromStart = (first + i) * stepSize;
    const o = appendRecord(n);
    recordData[o] = piece.x;
    recordData[o + 1] = piece.y;
    recordData[o + 2] = cos;
    recordData[o + 3] = sin;
    recordData[o + 4] = fromStart - piece.start;
    recordData[o + 5] = stepSize;
    recordData[o + 6] = n;
    recordData[o + 7] = fromStart;
    recordData[o + 8] = pressure.from;
    recordData[o + 9] = pressure.to;
    recordData[o + 10] = pressure.model;
    recordData[o + 11] = row;
    recordData[o + 12] = pressure.shape[0];
    recordData[o + 13] = pressure.shape[1];
    recordData[o + 14] = pressure.shape[2];
    recordData[o + 15] = pressure.shape[3];
    recordData[o + 16] = piece.pressure;
    recordData[o + 17] = piece.pressureSlope;
    recordData[o + 18] = pressure.length;
    recordData[o + 19] = stroke.alpha * alphaScale;
    // Each record takes the stroke's next n hash indices, so no two of its
    // steps share their randomness.
    recordData[o + 20] = stroke.hash;
    stroke.hash += n;
    recordData[o + 21] = piece.turn;
    recordData[o + 22] = -piece.heading;
    recordData[o + 23] = stroke.weight;
    recordSeeds[o + 24] = stroke.seed;
    recordData[o + 25] = param.weight;
    recordData[o + 26] = param.scatter;
    recordData[o + 27] = param.sharpness ?? 0;
    recordData[o + 28] = param.grain ?? 0;
  }

  // An arc stays within half its length of its midpoint.
  const s0 = first * stepSize - piece.start;
  const s1 = s0 + (count - 1) * stepSize;
  const reach = dotReach(param, pressure.min, pressure.max);
  if (piece.turn === 0) {
    growBounds(piece.x + s0 * cos, piece.y - s0 * sin, piece.x + s1 * cos, piece.y - s1 * sin, reach);
  } else {
    const [x, y] = pathPoint(piece, (s0 + s1) / 2);
    const r = (s1 - s0) / 2;
    growBounds(x - r, y - r, x + r, y + r, reach);
  }
}

/**
 * Makes room for one more record of `count` steps, files it under its draw
 * group, and returns its first word.
 */
function appendRecord(count) {
  if ((recordCount + 1) * RECORD_WORDS > recordData.length) {
    const next = new Float32Array(recordData.length * 2);
    next.set(recordData);
    recordData = next;
    recordSeeds = new Uint32Array(recordData.buffer);
    const groups = new Uint8Array(recordGroups.length * 2);
    groups.set(recordGroups);
    recordGroups = groups;
  }
  recordGroups[recordCount] = groupOf(count);
  return recordCount++ * RECORD_WORDS;
}

/** The custom pressure curve's row in the table texture, adding it if new. */
function tableRow(table) {
  let row = tableRows.get(table);
  if (row === undefined) {
    row = tableRows.size;
    tableRows.set(table, row);
    tableDirty = true;
  }
  return row;
}

/** Binds the custom pressure curves to texture unit 1, uploading them if changed. */
function bindPressureTable() {
  gl.activeTexture(gl.TEXTURE1);
  if (!tableTexture) tableTexture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tableTexture);
  if (tableDirty) {
    const rows = Math.max(1, tableRows.size);
    const data = new Float32Array(TABLE_SAMPLES * rows);
    for (const [table, row] of tableRows) data.set(table, row * TABLE_SAMPLES);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, TABLE_SAMPLES, rows, 0, gl.RED, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    tableDirty = false;
  }
}

/** Spray steps need ceil(grain / p) dots; sizes the batch for the densest. */
function growPerStep(grain, pMin) {
  const needed = Math.ceil(grain / pMin);
  if (!Number.isFinite(needed) || needed > 1_000_000) {
    throw new Error("Spray pressure/grain must produce a bounded number of dots.");
  }
  if (needed > perStep) perStep = needed;
}

/**
 * How far (logical px) the current brush's dots can land from the path, for
 * pressures between pMin and pMax. Box-Muller from 24-bit uniforms stays
 * below 6 sigma.
 */
function dotReach(param, pMin, pMax) {
  const sw = stroke.weight;
  if (param.type === "spray") {
    return 1.1 * sw * param.scatter * (pMax + 2) + param.weight * 0.55;
  }
  if (param.type === "marker") {
    return sw * param.scatter * 1.5 + sw * param.weight * pMax * 0.5;
  }
  if (param.type === "image" || param.type === "custom") {
    return sw * param.scatter * 1.5 + sw * param.weight * pMax * 0.75 + stroke.overscan;
  }
  const p = Math.max(pMin, 1e-3);
  return sw * param.scatter * (param.sharpness + ((1 - param.sharpness) * 6) / p) * 1.05
    + pMax * pMax * param.weight * 1.15 * sw;
}

function growBounds(x0, y0, x1, y1, reach) {
  if (reach > queuedReach) queuedReach = reach;
  if (x0 < queuedMinX) queuedMinX = x0;
  if (x0 > queuedMaxX) queuedMaxX = x0;
  if (x1 < queuedMinX) queuedMinX = x1;
  if (x1 > queuedMaxX) queuedMaxX = x1;
  if (y0 < queuedMinY) queuedMinY = y0;
  if (y0 > queuedMaxY) queuedMaxY = y0;
  if (y1 < queuedMinY) queuedMinY = y1;
  if (y1 > queuedMaxY) queuedMaxY = y1;
}

/**
 * Orders the queued records by draw group and returns each group's range.
 * @returns {{data: Float32Array, groups: {first: number, count: number, steps: number, stride: number}[]}}
 */
function sortIntoGroups() {
  const sizes = new Array(GROUPS).fill(0);
  for (let i = 0; i < recordCount; i++) sizes[recordGroups[i]]++;
  const only = sizes.findIndex((size) => size === recordCount);
  if (only >= 0) {
    return { data: recordData, groups: [{ first: 0, count: recordCount, steps: groupSteps(only), stride: GROUP_STRIDES[only] }] };
  }
  if (sortedData.length < recordData.length) sortedData = new Float32Array(recordData.length);
  const groups = [];
  const next = [];
  let first = 0;
  for (let g = 0; g < GROUPS; g++) {
    next.push(first);
    if (sizes[g]) groups.push({ first, count: sizes[g], steps: groupSteps(g), stride: GROUP_STRIDES[g] });
    first += sizes[g];
  }
  // Integer views copy the seeds' bits untouched.
  const from = new Uint32Array(recordData.buffer), to = new Uint32Array(sortedData.buffer);
  for (let i = 0; i < recordCount; i++) {
    const o = next[recordGroups[i]]++ * RECORD_WORDS;
    const r = i * RECORD_WORDS;
    for (let w = 0; w < RECORD_WORDS; w++) to[o + w] = from[r + w];
  }
  return { data: sortedData, groups };
}

/**
 * The device-pixel rect the queued steps can touch: their bounds through the
 * batch's transform, padded by the largest dot reach.
 */
function queuedDirtyRect(b) {
  const [a, bb, c, d] = b.affine;
  const [tx, ty] = b.translate;
  const [hw, hh] = b.half;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const x of [queuedMinX, queuedMaxX]) {
    for (const y of [queuedMinY, queuedMaxY]) {
      const dx = (a * (x - hw) + c * (y - hh) + tx + hw) * b.density;
      const dy = (bb * (x - hw) + d * (y - hh) + ty + hh) * b.density;
      if (dx < minX) minX = dx;
      if (dx > maxX) maxX = dx;
      if (dy < minY) minY = dy;
      if (dy > maxY) maxY = dy;
    }
  }
  const r = queuedReach * b.scale * b.density + 1;
  return { minX: minX - r, minY: minY - r, maxX: maxX + r, maxY: maxY + r };
}

function resetQueue() {
  recordCount = 0;
  perStep = 1;
  queuedMinX = queuedMinY = Infinity;
  queuedMaxX = queuedMaxY = -Infinity;
  queuedReach = 0;
}

/**
 * Sets the conservative image-tip padding (logical units) for the current stroke.
 */
export function setStrokeOverscan(overscan) {
  stroke.overscan = overscan;
}

/**
 * Draws the queued records, one call per draw group, and clears the queue.
 */
function flushStrokes() {
  if (recordCount === 0) return;
  const b = batch;
  // The context may have been lost since the batch started.
  if (!gl || gl.isContextLost?.() || !Mix.glMask || !b) {
    resetQueue();
    return;
  }

  Mix.glMask.isDrawn = true;
  const targetState = beginDirectMaskDraw(Renderer, gl, Mix.glMask);
  const isStamp = b.param.type === "image" || b.param.type === "custom";
  const prog = isStamp ? stamps : dots;
  const u = prog.uni;

  gl.useProgram(prog.program);
  gl.enable(gl.BLEND);
  // Coverage (alpha) fills up to 1; the extra-ink channel (red) adds up.
  gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ONE_MINUS_DST_ALPHA, gl.ONE);
  gl.bindVertexArray(prog.vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, recordBuffer);
  const { data, groups } = sortIntoGroups();
  if (recordCount * RECORD_WORDS * 4 > recordBufferSize) {
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    recordBufferSize = data.byteLength;
  } else {
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, recordCount * RECORD_WORDS));
  }
  bindPressureTable();
  gl.uniform1i(u.u_pressureTable, 1);

  gl.uniform4f(u.u_color, ...b.color);
  gl.uniform2f(u.u_translate, ...b.translate);
  gl.uniform2f(u.u_half, ...b.half);
  const liveClip = State.stroke.clip;
  State.stroke.clip = b.clip;
  setClipUniforms(gl, u);
  State.stroke.clip = liveClip;

  if (isStamp) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, getTipTexture(b.tip));
    gl.uniform1i(u.u_tex, 0);
    gl.uniformMatrix4fv(u.u_proj, false, b.projection);
    gl.uniformMatrix2fv(u.u_tipLinear, false, b.affine);
    gl.uniform1i(u.u_rotate, ROTATE_MODES[b.param.rotate] ?? 0);
    for (const group of groups) {
      pointAtRecord(stamps, group.first);
      gl.uniform1i(u.u_groupSteps, group.steps);
      gl.uniform1i(u.u_stride, group.stride);
      gl.drawArraysInstanced(gl.TRIANGLES, 0, group.steps * 6, group.count);
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
  } else {
    gl.uniformMatrix4fv(u.u_matrix, false, b.projection);
    gl.uniform4f(u.u_affine, ...b.affine);
    gl.uniform1f(u.u_sizeScale, b.sizeScale);
    gl.uniform1f(u.u_density, b.density);
    gl.uniform1i(u.u_type, DOT_TYPES[b.param.type] ?? 0);
    gl.uniform1i(u.u_perStep, perStep);
    gl.uniform1i(u.u_affineCircle, b.affineCircle);
    gl.uniformMatrix2fv(u.u_tipInverse, false, b.tipInverse);
    gl.uniform1f(u.u_specks, b.param.type === "marker" ? 1 : 0);
    const nib = b.param.type === "marker" ? b.param.nib : null;
    const nibAngle = ((nib?.angle ?? 0) * Math.PI) / 180;
    gl.uniform3f(u.u_nib, Math.cos(nibAngle), Math.sin(nibAngle), nib ? Math.min(Math.max(nib.thickness ?? 0.25, 0.05), 1) : 1);
    gl.uniform1ui(u.u_paperSeed, seedHash() % 65536);
    if (b.param.type === "marker") setPaperUniforms(u, b);
    for (const group of groups) {
      pointAtRecord(dots, group.first);
      gl.uniform1i(u.u_groupSteps, group.steps);
      gl.uniform1i(u.u_stride, group.stride);
      gl.drawArraysInstanced(gl.POINTS, 0, group.steps * perStep, group.count);
    }
  }

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindVertexArray(null);
  endDirectMaskDraw(Renderer, gl, targetState);

  Mix.markDirtyRect(Mix.glMask, queuedDirtyRect(b));
  resetQueue();

  // We called gl.useProgram() directly, bypassing host shader tracking.
  // Reset it so the host is forced to re-activate its own shader next time
  // it draws — otherwise it may skip gl.useProgram() and set uniforms on the
  // wrong active program, causing "location is not from the associated program".
  resetDirectShaderTracking(Renderer, gl);
}

/**
 * Returns the WebGL texture for a tip, uploading it on first use.
 * @param {{ key: string, image: object }} tip
 */
function getTipTexture(tip) {
  let tex = texCache.get(tip.key);
  if (!tex) {
    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tip.image.canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    texCache.set(tip.key, tex);
  }
  return tex;
}

/**
 * Removes a cached GL texture by key, forcing re-upload on next draw.
 * Call this when a custom tip function changes after brush.add().
 */
export function invalidateTexEntry(key) {
  if (batch?.tip?.key === key) flushStrokes();
  const tex = texCache.get(key);
  if (tex && gl) gl.deleteTexture(tex);
  texCache.delete(key);
}
