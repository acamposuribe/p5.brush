// =============================================================================
// Module: GL Draw
// =============================================================================
/**
 * The GL Draw module renders brush strokes on the GPU. Strokes are queued as
 * path segments; shaders expand each segment into the brush's dots (dots.vert)
 * or textured stamps (stamps.vert) and draw them into the shared
 * framebuffer-backed brush mask.
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
import { CLIP_UNIFORMS, setClipUniforms } from "./clip.js";
import dotsVertSrc from "./dots.vert";
import dotsFragSrc from "./dots.frag";
import stampsVertSrc from "./stamps.vert";
import stampsFragSrc from "./stamps.frag";

// =============================================================================
// Section: State
// =============================================================================

/** Fine brush steps per queued path segment. */
export const SUBSTEPS = 40;
/** Fine steps per record of a straight stroke walked on the GPU (queueLine). */
const LINE_CHUNK = 1024;
// The shaders hash a dot from (record index × 64 + step), so a record of
// LINE_CHUNK steps takes LINE_CHUNK / 64 indices.
const HASH_STEPS = 64;
// Records are drawn in groups by step count; each draw runs every record in
// its group for the group's largest count, and culls the steps past its own.
const GROUP_STEPS = [SUBSTEPS, 64, 128, 256, 512, LINE_CHUNK];

const DOT_TYPES = { default: 0, spray: 1, marker: 2 };
const ROTATE_MODES = { random: 1, natural: 2 };

let isLoaded = false,
  gl,
  framebufferProjMatrix;
let loadedWidth = 0,
  loadedHeight = 0;

const dots = { program: null, vao: null, attr: {}, uni: {} };
const stamps = { program: null, vao: null, attr: {}, uni: {} };
let segBuf = null;
let segGpuSize = 0;

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

// Record layout (22 words): startX, startY, endX, endY, cos, sin,
// pressure0, pressure1, count, alpha, segIndex, naturalAngle, seed (uint),
// stroke weight, brush weight, scatter, sharpness, grain, and the pressure
// bump (peak, half-width before and after it, exponent). The brush's shape
// travels with each record, so brushes that share a shader share a batch.
// A path segment interpolates its pressure from pressure0 to pressure1 and
// has no bump (exponent 0). A straight stroke's record (queueLine) evaluates
// the bump at every step, mapped from pressure0 to pressure1.
const SEG_WORDS = 22;
let segData = new Float32Array(1024 * SEG_WORDS);
let segSeeds = new Uint32Array(segData.buffer);
let segGroups = new Uint8Array(1024); // each record's draw group (GROUP_STEPS)
let segCount = 0;
// The records reordered by draw group, for upload (see sortIntoGroups).
let drawData = new Float32Array(segData.length);
// Bounds of the queued segments' endpoints in position space, and the largest
// dot reach (logical px). The batch shares one transform, so they map to the
// mask's dirty rect once, at flush, instead of once per segment.
let segMinX = Infinity, segMinY = Infinity, segMaxX = -Infinity, segMaxY = -Infinity;
let segReach = 0;
let perStep = 1; // spray dots per step needed by the current batch

// The stroke being queued, and the batch it belongs to. Everything the shaders
// read as a uniform is captured in the batch, because by the time it is
// flushed the live transform, colour or clip may belong to a later stroke.
const stroke = { seed: 0, alpha: 0, index: 0, start: 0, param: null, weight: 1 };
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
  for (const p of [dots, stamps]) {
    if (p.program) gl.deleteProgram(p.program);
    if (p.vao) gl.deleteVertexArray(p.vao);
    p.program = p.vao = null;
  }
  if (segBuf) gl.deleteBuffer(segBuf);
  segBuf = null;
  segGpuSize = 0;
}

/**
 * Compiles a program, records its locations, and builds a VAO over the shared
 * record buffer. Records are per instance: `divisor` 1 for dots (one instance
 * per record, its steps as vertices) and SUBSTEPS for stamps (one instance
 * per step).
 */
function setupProgram(target, vertSrc, fragSrc, attributes, uniforms, divisor) {
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
    gl.vertexAttribDivisor(loc, divisor);
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
  gl.bindBuffer(gl.ARRAY_BUFFER, segBuf);
  const stride = SEG_WORDS * 4;
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
  if (segCount > 0 && gl && Renderer.drawingContext !== gl) flushStrokes();
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

  segBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, segBuf);
  gl.bufferData(gl.ARRAY_BUFFER, segData.byteLength, gl.DYNAMIC_DRAW);
  segGpuSize = segData.byteLength;

  const attributes = [
    ["a_start", 2, 0], ["a_end", 2, 8], ["a_dir", 2, 16],
    ["a_pressure", 2, 24], ["a_info", 4, 32], ["a_seed", 1, 48], ["a_weight", 1, 52],
    ["a_brush", 4, 56], ["a_bump", 4, 72],
  ];
  setupProgram(dots, dotsVertSrc, dotsFragSrc, attributes, [
    "u_matrix", "u_affine", "u_translate", "u_half", "u_sizeScale", "u_density",
    "u_type", "u_perStep",
    "u_color", "u_affineCircle", "u_tipInverse", "u_specks", "u_paperSeed", "u_paperInverse", "u_paperPx", "u_nib", ...CLIP_UNIFORMS,
  ], 1);
  setupProgram(stamps, stampsVertSrc, stampsFragSrc, attributes, [
    "u_proj", "u_tipLinear", "u_translate", "u_half", "u_substeps",
    "u_rotate", "u_color", "u_tex", ...CLIP_UNIFORMS,
  ], SUBSTEPS);

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
  if (segCount > 0 && !joinsBatch(batch, param, tip, color)) flushStrokes();
  if (segCount === 0) {
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
  stroke.index = 0;
  stroke.start = segCount;
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
  segCount = Math.min(segCount, stroke.start);
}

/**
 * Queues one path segment of up to SUBSTEPS fine steps, in position space
 * (user coords + Cwidth/2, Cheight/2). Pressure is interpolated from p0 to p1
 * along the segment. `alphaScale` brightens marker/tip segments.
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
  writeRecord(x0, y0, x1, y1, cs, sn, p0, p1, count, stroke.index++, naturalAngle, alphaScale, NO_BUMP);
  growBounds(x0, y0, x1, y1, dotReach(param, Math.min(p0, p1), pMax));
}

const NO_BUMP = { peak: 0, halfBefore: 0, halfAfter: 0, exponent: 0 };

/**
 * Queues a straight stroke of `steps` fine steps from (x0, y0) towards
 * (x1, y1), whose pressure is the default bump: `bump` gives its peak and
 * half-widths as distances from the stroke's start, its exponent, and the
 * pressure range it maps to (see gauss() in stroke.js). The GPU computes each
 * step's position and pressure, so the stroke costs one record per LINE_CHUNK
 * steps. `pMin` and `pMax` are the pressure's extremes along the stroke.
 */
export function queueLine(x0, y0, x1, y1, cs, sn, steps, bump, pMin, pMax) {
  if (_scale === 0 || steps <= 0 || pMax <= 0) return;
  const param = stroke.param;
  if (param.type === "spray") growPerStep(param.grain, pMin);
  const dx = (x1 - x0) / steps, dy = (y1 - y0) / steps;
  const spacing = Math.hypot(dx, dy);
  // Start on a fresh range of hash indices, past any tip segment.
  let index = Math.ceil(stroke.index / (LINE_CHUNK / HASH_STEPS)) * (LINE_CHUNK / HASH_STEPS);
  for (let i = 0; i < steps; i += LINE_CHUNK) {
    const n = Math.min(LINE_CHUNK, steps - i);
    const chunkBump = { ...bump, peak: bump.peak - i * spacing };
    writeRecord(
      x0 + dx * i, y0 + dy * i, x0 + dx * (i + n), y0 + dy * (i + n), cs, sn,
      bump.min, bump.max, n, index, 0, 1, chunkBump,
    );
    index += LINE_CHUNK / HASH_STEPS;
  }
  stroke.index = index;
  growBounds(x0, y0, x1, y1, dotReach(param, pMin, pMax));
}

function writeRecord(x0, y0, x1, y1, cs, sn, p0, p1, count, index, naturalAngle, alphaScale, bump) {
  if ((segCount + 1) * SEG_WORDS > segData.length) {
    const next = new Float32Array(segData.length * 2);
    next.set(segData);
    segData = next;
    segSeeds = new Uint32Array(segData.buffer);
    const groups = new Uint8Array(segGroups.length * 2);
    groups.set(segGroups);
    segGroups = groups;
  }
  const param = stroke.param;
  const o = segCount * SEG_WORDS;
  segData[o] = x0;
  segData[o + 1] = y0;
  segData[o + 2] = x1;
  segData[o + 3] = y1;
  segData[o + 4] = cs;
  segData[o + 5] = sn;
  segData[o + 6] = p0;
  segData[o + 7] = p1;
  segData[o + 8] = count;
  segData[o + 9] = stroke.alpha * alphaScale;
  segData[o + 10] = index;
  segData[o + 11] = naturalAngle;
  segSeeds[o + 12] = stroke.seed;
  segData[o + 13] = stroke.weight;
  segData[o + 14] = param.weight;
  segData[o + 15] = param.scatter;
  segData[o + 16] = param.sharpness ?? 0;
  segData[o + 17] = param.grain ?? 0;
  segData[o + 18] = bump.peak;
  segData[o + 19] = bump.halfBefore;
  segData[o + 20] = bump.halfAfter;
  segData[o + 21] = bump.exponent;
  let group = 0;
  while (GROUP_STEPS[group] < count) group++;
  segGroups[segCount] = group;
  segCount++;
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
  if (reach > segReach) segReach = reach;
  if (x0 < segMinX) segMinX = x0;
  if (x0 > segMaxX) segMaxX = x0;
  if (x1 < segMinX) segMinX = x1;
  if (x1 > segMaxX) segMaxX = x1;
  if (y0 < segMinY) segMinY = y0;
  if (y0 > segMaxY) segMaxY = y0;
  if (y1 < segMinY) segMinY = y1;
  if (y1 > segMaxY) segMaxY = y1;
}

/**
 * Orders the queued records by draw group into drawData and returns each
 * group's range. Records keep their queue order within a group. With only
 * path segments queued (one group), segData is drawn as it is.
 * @returns {{data: Float32Array, groups: {first: number, count: number, steps: number}[]}}
 */
function sortIntoGroups() {
  const sizes = new Array(GROUP_STEPS.length).fill(0);
  for (let i = 0; i < segCount; i++) sizes[segGroups[i]]++;
  if (sizes[0] === segCount) {
    return { data: segData, groups: [{ first: 0, count: segCount, steps: GROUP_STEPS[0] }] };
  }
  if (drawData.length < segData.length) drawData = new Float32Array(segData.length);
  const groups = [];
  const next = [];
  let first = 0;
  for (let g = 0; g < GROUP_STEPS.length; g++) {
    next.push(first);
    if (sizes[g]) groups.push({ first, count: sizes[g], steps: GROUP_STEPS[g] });
    first += sizes[g];
  }
  // Copy whole words through integer views, so the seeds' bits are untouched.
  const from = new Uint32Array(segData.buffer), to = new Uint32Array(drawData.buffer);
  for (let i = 0; i < segCount; i++) {
    const o = next[segGroups[i]]++ * SEG_WORDS;
    to.set(from.subarray(i * SEG_WORDS, (i + 1) * SEG_WORDS), o);
  }
  return { data: drawData, groups };
}

/**
 * The device-pixel rect the queued segments can touch: their endpoint bounds
 * through the batch's transform, padded by the largest dot reach.
 */
function segmentsDirtyRect(b) {
  const [a, bb, c, d] = b.affine;
  const [tx, ty] = b.translate;
  const [hw, hh] = b.half;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const x of [segMinX, segMaxX]) {
    for (const y of [segMinY, segMaxY]) {
      const dx = (a * (x - hw) + c * (y - hh) + tx + hw) * b.density;
      const dy = (bb * (x - hw) + d * (y - hh) + ty + hh) * b.density;
      if (dx < minX) minX = dx;
      if (dx > maxX) maxX = dx;
      if (dy < minY) minY = dy;
      if (dy > maxY) maxY = dy;
    }
  }
  const r = segReach * b.scale * b.density + 1;
  return { minX: minX - r, minY: minY - r, maxX: maxX + r, maxY: maxY + r };
}

function resetSegments() {
  segCount = 0;
  perStep = 1;
  segMinX = segMinY = Infinity;
  segMaxX = segMaxY = -Infinity;
  segReach = 0;
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
  if (segCount === 0) return;
  const b = batch;
  // The context may have been lost since the batch started.
  if (!gl || gl.isContextLost?.() || !Mix.glMask || !b) {
    resetSegments();
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
  gl.bindBuffer(gl.ARRAY_BUFFER, segBuf);
  const { data, groups } = sortIntoGroups();
  if (segCount * SEG_WORDS * 4 > segGpuSize) {
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    segGpuSize = data.byteLength;
  } else {
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data.subarray(0, segCount * SEG_WORDS));
  }

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
    gl.uniform1i(u.u_substeps, SUBSTEPS);
    gl.uniform1i(u.u_rotate, ROTATE_MODES[b.param.rotate] ?? 0);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, segCount * SUBSTEPS);
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
      gl.drawArraysInstanced(gl.POINTS, 0, group.steps * perStep, group.count);
    }
  }

  gl.bindVertexArray(null);
  endDirectMaskDraw(Renderer, gl, targetState);

  Mix.markDirtyRect(Mix.glMask, segmentsDirtyRect(b));
  resetSegments();

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
