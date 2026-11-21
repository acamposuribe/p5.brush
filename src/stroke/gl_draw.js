// =============================================================================
// Module: GL Draw
// =============================================================================
/**
 * The GL Draw module renders brush strokes on the GPU. A stroke is queued as
 * records, each covering up to RECORD_STEPS fine steps of one piece of its
 * path, a straight run or an arc; the shaders compute every step's position
 * and pressure and expand it into the brush's dots (dots.vert) or textured
 * stamps (stamps.vert), drawn into the shared framebuffer-backed brush mask.
 * Strokes bent by a flow field are walked on the CPU instead and queued as
 * short straight segments (queueSegment).
 *
 * Consecutive strokes that share a brush type, colour, transform, clip and
 * target are drawn together in one call, whatever their brush's weight,
 * scatter, sharpness or grain. The queue is flushed when that state changes
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

/** Most fine steps in a segment of a stroke walked on the CPU (stroke.js). */
export const SUBSTEPS = 40;
/** Most fine steps in one record. */
const RECORD_STEPS = 1024;

// Records are drawn in groups by step count: each draw runs its records for
// the group's step count and culls the steps past their own. Counts round up
// to a multiple of 8 up to 64, and of 64 above.
const GROUPS = 23;
const groupOf = (count) => (count <= 64 ? Math.ceil(count / 8) - 1 : 6 + Math.ceil(count / 64));
const groupSteps = (group) => (group < 8 ? (group + 1) * 8 : (group - 6) * 64);

// The shaders visit a record's steps in a scattered order, step = (i ×
// stride) mod n, so dots drawn one after another land far apart along the
// path: at fine spacing, consecutive dots on the same pixels make each blend
// wait for the last. A stride coprime with n visits every step exactly once;
// one near n / φ spreads them evenly.
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
function scatterStride(n) {
  let stride = Math.round(n * 0.618) | 1;
  while (gcd(stride, n) !== 1) stride += 2;
  return stride;
}
const GROUP_STRIDES = Array.from({ length: GROUPS }, (_, group) => scatterStride(groupSteps(group)));

// Pressure models (pressure.glsl).
const PRESSURE_LINEAR = 0;
export const PRESSURE_BUMP = 1, PRESSURE_CUSTOM = 2;
// Samples per custom pressure curve (t = 0, 1/256, … 1).
export const TABLE_SAMPLES = 257;

const DOT_TYPES = { default: 0, spray: 1, marker: 2 };
const ROTATE_MODES = { random: 1, natural: 2 };

let isLoaded = false,
  gl,
  framebufferProjMatrix;
let loadedWidth = 0,
  loadedHeight = 0;

const dots = { program: null, vao: null, attr: {}, uni: {} };
const stamps = { program: null, vao: null, attr: {}, uni: {} };
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

// Record layout (31 words, read by dots.vert and stamps.vert):
//   0  path:  origin x, y, and heading as a unit vector (y up) (path.glsl)
//   4  steps: first step's distance from the origin, step length, step
//             count, first step's distance from the stroke's start
//   8  pressure model: from, to, model, custom curve's table row
//   12 pressure shape: bump or custom curve (pressure.glsl)
//   16 plot pressure at the origin and per unit, stroke length, alpha
//   20 first step's hash index, turn per unit (path.glsl), natural tip
//      angle at the origin, stroke weight
//   24 dispersion's direction relative to the heading, as a unit vector
//   26 seed (uint)
//   27 brush weight, scatter, sharpness, grain
// The brush's shape travels with each record, so brushes that share a shader
// share a batch.
const RECORD_WORDS = 31;
let recordData = new Float32Array(1024 * RECORD_WORDS);
let recordSeeds = new Uint32Array(recordData.buffer);
let recordGroups = new Uint8Array(1024); // each record's draw group
let recordCount = 0;
// The records reordered by draw group, for upload (see sortIntoGroups).
let sortedData = new Float32Array(recordData.length);
// Bounds of the queued steps in position space, and the largest dot reach
// (logical px). The batch shares one transform, so they map to the mask's
// dirty rect once, at flush.
let queuedMinX = Infinity, queuedMinY = Infinity, queuedMaxX = -Infinity, queuedMaxY = -Infinity;
let queuedReach = 0;
let perStep = 1; // spray dots per step needed by the current batch

// Custom pressure curves, a row of TABLE_SAMPLES each in a float texture the
// shaders read (pressure.glsl). Rows are assigned once per curve; the
// texture is rebuilt when a curve is added or the GL context changes.
const tableRows = new Map(); // Float32Array → row
let tableTexture = null;
let tableDirty = true;

// The stroke being queued, and the batch it belongs to. Everything the shaders
// read as a uniform is captured in the batch, because by the time it is
// flushed the live transform, colour or clip may belong to a later stroke.
const stroke = { seed: 0, alpha: 0, hash: 0, start: 0, param: null, weight: 1, overscan: 0, pressure: null };
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
 * Compiles a program, records its locations, and builds a VAO over the shared
 * record buffer, one record per instance: the shaders take a record's fine
 * steps from the vertex index.
 */
function setupProgram(target, vertSrc, fragSrc, attributes, uniforms) {
  target.program = createProgram(gl, vertSrc, fragSrc);
  for (const n of uniforms) target.uni[n] = gl.getUniformLocation(target.program, n);
  target.attributes = [];
  for (const [name, size, offset] of attributes) {
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
 * Points the bound VAO's attributes at the record buffer, starting from
 * record `first`. WebGL2 has no base instance, so a draw that starts past the
 * first record moves the pointers instead.
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

  const attributes = [
    ["a_path", 4, 0], ["a_steps", 4, 16], ["a_press", 4, 32], ["a_shape", 4, 48],
    ["a_plot", 4, 64], ["a_misc", 4, 80], ["a_disp", 2, 96], ["a_seed", 1, 104], ["a_brush", 4, 108],
  ];
  setupProgram(dots, dotsVertSrc, dotsFragSrc, attributes, [
    "u_matrix", "u_affine", "u_translate", "u_half", "u_sizeScale", "u_density",
    "u_type", "u_perStep", "u_pressureTable", "u_groupSteps", "u_stride",
    "u_color", "u_affineCircle", "u_tipInverse", "u_specks", "u_paperSeed", "u_paperInverse", "u_paperPx", "u_nib", ...CLIP_UNIFORMS,
  ]);
  setupProgram(stamps, stampsVertSrc, stampsFragSrc, attributes, [
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
 * is not per segment (type, stamp tip and rotation, marker nib).
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
 * Drops the segments of the stroke being queued (e.g. after it threw),
 * keeping earlier strokes in the batch.
 */
export function discardStroke() {
  recordCount = Math.min(recordCount, stroke.start);
}

/**
 * Sets the current stroke's pressure for queuePiece(): the default bump or a
 * custom curve (pressure.glsl), with distances measured in position space
 * from the stroke's start.
 * @param {{model: number, from: number, to: number, shape: number[],
 *   length: number, table: Float32Array|null, min: number, max: number,
 *   minPositive: number}} pressure - `model` is PRESSURE_BUMP or
 *   PRESSURE_CUSTOM (with its curve's `table`); `min`, `max` and
 *   `minPositive` bound the pressure along the stroke, for how far dots land
 *   and how dense spray gets.
 */
export function setStrokePressure(pressure) {
  stroke.pressure = pressure;
}

/**
 * Queues `count` fine steps along one piece of the stroke's path (see
 * Plot.pieces()), starting at the stroke's step `first`, `stepSize` apart.
 * The GPU computes each step's position and pressure.
 */
export function queuePiece(piece, first, count, stepSize) {
  if (_scale === 0 || count <= 0) return;
  const param = stroke.param;
  const pressure = stroke.pressure;
  if (pressure.max <= 0) return;
  if (param.type === "spray") growPerStep(param.grain, pressure.minPositive);
  const row = pressure.table ? tableRow(pressure.table) : 0;
  const cos = Math.cos(piece.heading), sin = Math.sin(piece.heading);

  for (let i = 0; i < count; i += RECORD_STEPS) {
    const n = Math.min(RECORD_STEPS, count - i);
    const fromStart = (first + i) * stepSize;
    const o = appendRecord(n, 1);
    // Path: the piece; steps: this record's share of it.
    recordData[o] = piece.x;
    recordData[o + 1] = piece.y;
    recordData[o + 2] = cos;
    recordData[o + 3] = sin;
    recordData[o + 4] = fromStart - piece.start;
    recordData[o + 5] = stepSize;
    recordData[o + 6] = n;
    recordData[o + 7] = fromStart;
    // Pressure: the stroke's model, times the plot's own pressure.
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
    recordData[o + 21] = piece.turn;
    // A natural tip turns with the path, from its heading at the origin.
    recordData[o + 22] = -piece.heading;
    // Dots disperse across the heading itself.
    recordData[o + 24] = 1;
    recordData[o + 25] = 0;
  }

  // The steps lie on the piece between s0 and s1 from its origin. An arc
  // stays within half its length of its midpoint.
  const s0 = first * stepSize - piece.start;
  const s1 = s0 + (count - 1) * stepSize;
  const reach = dotReach(param, pressure.min, pressure.max);
  if (piece.turn === 0) {
    const [x0, y0] = pathPoint(piece, s0);
    const [x1, y1] = pathPoint(piece, s1);
    growBounds(x0, y0, x1, y1, reach);
  } else {
    const [x, y] = pathPoint(piece, (s0 + s1) / 2);
    const r = (s1 - s0) / 2;
    growBounds(x - r, y - r, x + r, y + r, reach);
  }
}

/**
 * Queues one straight segment of up to SUBSTEPS fine steps from (x0, y0) to
 * (x1, y1), in position space (user coords + Cwidth/2, Cheight/2), for
 * strokes the CPU walks through a flow field, and for marker and tip end
 * caps. Pressure is interpolated from p0 to p1 along it. (cs, sn) is the
 * stroke's direction there, for dispersion; `alphaScale` brightens end caps.
 */
export function queueSegment(x0, y0, x1, y1, cs, sn, p0, p1, count, naturalAngle = 0, alphaScale = 1) {
  if (_scale === 0 || count <= 0) return;
  const pMax = Math.max(p0, p1);
  if (pMax <= 0) return;
  const param = stroke.param;
  if (param.type === "spray") {
    // The densest step is the one with the lowest positive pressure.
    let pMin = Infinity;
    for (let s = 0; s < count; s++) {
      const p = p0 + (p1 - p0) * (s / count);
      if (p > 0 && p < pMin) pMin = p;
    }
    growPerStep(param.grain, pMin);
  }
  const dx = x1 - x0, dy = y1 - y0;
  const length = Math.hypot(dx, dy);
  // The chord's heading (y up); a zero-length end cap has none, so any will do.
  const ux = length > 0 ? dx / length : 1, uy = length > 0 ? -dy / length : 0;
  const o = appendRecord(count, alphaScale);
  recordData[o] = x0;
  recordData[o + 1] = y0;
  recordData[o + 2] = ux;
  recordData[o + 3] = uy;
  recordData[o + 4] = 0;
  recordData[o + 5] = length / count;
  recordData[o + 6] = count;
  recordData[o + 7] = 0;
  recordData[o + 8] = p0;
  recordData[o + 9] = p1;
  recordData[o + 10] = PRESSURE_LINEAR;
  recordData[o + 11] = 0;
  recordData[o + 12] = recordData[o + 13] = recordData[o + 14] = recordData[o + 15] = 0;
  recordData[o + 16] = 1;
  recordData[o + 17] = 0;
  recordData[o + 18] = 0;
  recordData[o + 21] = 0;
  recordData[o + 22] = naturalAngle;
  // Dots disperse across (cs, sn), the path's own heading, not the chord's:
  // that direction relative to the chord, (cs, sn) × conj(ux, uy).
  recordData[o + 24] = cs * ux + sn * uy;
  recordData[o + 25] = sn * ux - cs * uy;
  growBounds(x0, y0, x1, y1, dotReach(param, Math.min(p0, p1), pMax));
}

/**
 * Appends a record of `count` steps for the current stroke, fills in the
 * stroke's own fields (alpha, hash index, weight, seed, brush) and returns
 * its first word; the caller writes the path, steps and pressure. Every
 * record takes the next `count` hash indices, so no two steps of a stroke
 * share their randomness.
 */
function appendRecord(count, alphaScale) {
  if ((recordCount + 1) * RECORD_WORDS > recordData.length) {
    const next = new Float32Array(recordData.length * 2);
    next.set(recordData);
    recordData = next;
    recordSeeds = new Uint32Array(recordData.buffer);
    const groups = new Uint8Array(recordGroups.length * 2);
    groups.set(recordGroups);
    recordGroups = groups;
  }
  const param = stroke.param;
  const o = recordCount * RECORD_WORDS;
  recordData[o + 19] = stroke.alpha * alphaScale;
  recordData[o + 20] = stroke.hash;
  recordData[o + 23] = stroke.weight;
  recordSeeds[o + 26] = stroke.seed;
  recordData[o + 27] = param.weight;
  recordData[o + 28] = param.scatter;
  recordData[o + 29] = param.sharpness ?? 0;
  recordData[o + 30] = param.grain ?? 0;
  stroke.hash += count;
  recordGroups[recordCount] = groupOf(count);
  recordCount++;
  return o;
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
  // Plain comparisons: this runs per segment, where Math.min/max cost more.
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
 * Orders the queued records by draw group into sortedData and returns each
 * group's range. Records keep their queue order within a group. With a
 * single group, recordData is drawn as it is.
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
  // Copy whole words through integer views, so the seeds' bits are untouched.
  const from = new Uint32Array(recordData.buffer), to = new Uint32Array(sortedData.buffer);
  for (let i = 0; i < recordCount; i++) {
    const o = next[recordGroups[i]]++ * RECORD_WORDS;
    const r = i * RECORD_WORDS;
    for (let w = 0; w < RECORD_WORDS; w++) to[o + w] = from[r + w];
  }
  return { data: sortedData, groups };
}

/**
 * The device-pixel rect the queued segments can touch: their endpoint bounds
 * through the batch's transform, padded by the largest dot reach.
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
 * Draws all queued segments in one call and clears the queue.
 */
export function flushStrokes() {
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
    // Two triangles per step.
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
