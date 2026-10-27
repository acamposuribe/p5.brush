// =============================================================================
// Module: GL Draw
// =============================================================================
/**
 * The GL Draw module renders brush strokes on the GPU. Strokes are queued as
 * path segments; shaders expand each segment into the brush's dots (dots.vert)
 * or textured stamps (stamps.vert) and draw them into the shared
 * framebuffer-backed brush mask.
 *
 * Consecutive strokes that share brush, colour, transform, clip and target are
 * drawn together in one call. The queue is flushed when that state changes
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

// Segment layout (13 words): startX, startY, endX, endY, cos, sin,
// pressure0, pressure1, count, alpha, segIndex, naturalAngle, seed (uint)
const SEG_WORDS = 13;
let segData = new Float32Array(1024 * SEG_WORDS);
let segSeeds = new Uint32Array(segData.buffer);
let segCount = 0;
let segDirtyRect = null;
let perStep = 1; // spray dots per step needed by the current batch

// Paper tooth shared by all strokes: contact strength, grain size (logical
// px, already multiplied by the brush scale) and seed. See paper.glsl.
const paperState = { strength: 0, grain: 1, seed: 0 };

/**
 * Sets the paper tooth that dry-media strokes deposit on.
 * @param {number} strength - 0 (off) to 1.
 * @param {number} grain - Grain size in logical px.
 * @param {number} seed - Integer seed for the paper pattern.
 */
export function setPaper(strength, grain, seed) {
  paperState.strength = strength;
  paperState.grain = grain;
  paperState.seed = seed;
}

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

function accumulateDirtyRect(currentRect, minX, minY, maxX, maxY) {
  if (!currentRect) return { minX, minY, maxX, maxY };
  if (minX < currentRect.minX) currentRect.minX = minX;
  if (minY < currentRect.minY) currentRect.minY = minY;
  if (maxX > currentRect.maxX) currentRect.maxX = maxX;
  if (maxY > currentRect.maxY) currentRect.maxY = maxY;
  return currentRect;
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
 * segment buffer. `divisor` is 0 for per-vertex segments (dots) and SUBSTEPS
 * for per-instance segments (stamps).
 */
function setupProgram(target, vertSrc, fragSrc, attributes, uniforms, divisor) {
  target.program = createProgram(gl, vertSrc, fragSrc);
  for (const n of uniforms) target.uni[n] = gl.getUniformLocation(target.program, n);
  target.vao = gl.createVertexArray();
  gl.bindVertexArray(target.vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, segBuf);
  const stride = SEG_WORDS * 4;
  for (const [name, size, offset] of attributes) {
    const loc = gl.getAttribLocation(target.program, name);
    if (loc < 0) continue;
    gl.enableVertexAttribArray(loc);
    if (name === "a_seed") gl.vertexAttribIPointer(loc, 1, gl.UNSIGNED_INT, stride, offset);
    else gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
    gl.vertexAttribDivisor(loc, divisor);
  }
  gl.bindVertexArray(null);
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
    ["a_pressure", 2, 24], ["a_info", 4, 32], ["a_seed", 1, 48],
  ];
  setupProgram(dots, dotsVertSrc, dotsFragSrc, attributes, [
    "u_matrix", "u_affine", "u_translate", "u_half", "u_sizeScale", "u_density",
    "u_type", "u_perStep", "u_brush", "u_strokeWeight",
    "u_color", "u_affineCircle", "u_tipInverse", "u_paper", ...CLIP_UNIFORMS,
  ], 0);
  setupProgram(stamps, stampsVertSrc, stampsFragSrc, attributes, [
    "u_proj", "u_tipLinear", "u_translate", "u_half", "u_substeps",
    "u_rotate", "u_brush", "u_strokeWeight", "u_color", "u_tex", "u_paper", ...CLIP_UNIFORMS,
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
  const strokeWeight = State.stroke.weight;
  const key = [
    gl, Mix.glMask, framebufferProjMatrix, State.stroke.clip, tip?.key,
    color[0], color[1], color[2], color[3],
    _ma, _mb, _mc, _md, _mx, _my, _halfW, _halfH, _density, _scale, _affineCircle, ..._tipInverse,
    param.type, param.rotate, param.weight, param.scatter, param.sharpness, param.grain, strokeWeight,
    paperState.strength, paperState.grain, paperState.seed, param.paper,
  ];
  if (segCount > 0 && (!batch || key.some((v, i) => v !== batch.key[i]))) flushStrokes();
  if (segCount === 0) {
    batch = {
      key,
      tip,
      projection: framebufferProjMatrix,
      color: [...color],
      clip: State.stroke.clip,
      affine: [_ma, _mb, _mc, _md],
      translate: [_mx, _my],
      half: [_halfW, _halfH],
      sizeScale: _density * _scale,
      density: _density,
      affineCircle: _affineCircle,
      tipInverse: new Float32Array(_tipInverse),
      param,
      strokeWeight,
      paper: [
        paperState.strength * paperResponse(param), paperState.grain, _density, paperState.seed,
      ],
    };
  }
  stroke.seed = Math.floor(seed * 4294.967) >>> 0;
  stroke.alpha = alpha;
  stroke.index = 0;
  stroke.start = segCount;
  stroke.param = param;
  stroke.weight = strokeWeight;
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
  const sw = stroke.weight;

  if (param.type === "spray") {
    // Every step needs ceil(grain / p) dots; size the batch for the densest step.
    let pMin = Infinity;
    for (let s = 0; s < count; s++) {
      const p = p0 + (p1 - p0) * (s / count);
      if (p > 0 && p < pMin) pMin = p;
    }
    const needed = Math.ceil(param.grain / pMin);
    if (!Number.isFinite(needed) || needed > 1_000_000) {
      throw new Error("Spray pressure/grain must produce a bounded number of dots.");
    }
    if (needed > perStep) perStep = needed;
  }

  if ((segCount + 1) * SEG_WORDS > segData.length) {
    const next = new Float32Array(segData.length * 2);
    next.set(segData);
    segData = next;
    segSeeds = new Uint32Array(segData.buffer);
  }
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
  segData[o + 10] = stroke.index++;
  segData[o + 11] = naturalAngle;
  segSeeds[o + 12] = stroke.seed;
  segCount++;

  // Conservative reach in logical units. Box-Muller from 24-bit uniforms
  // stays below 6 sigma.
  let reach;
  if (param.type === "spray") {
    reach = 1.1 * sw * param.scatter * (pMax + 2) + param.weight * 0.55;
  } else if (param.type === "marker") {
    reach = sw * param.scatter * 1.5 + sw * param.weight * pMax * 0.5;
  } else if (param.type === "image" || param.type === "custom") {
    reach = sw * param.scatter * 1.5 + sw * param.weight * pMax * 0.75 + stroke.overscan;
  } else {
    const pMin = Math.max(Math.min(p0, p1), 1e-3);
    reach = sw * param.scatter * (param.sharpness + ((1 - param.sharpness) * 6) / pMin) * 1.05
      + pMax * pMax * param.weight * 1.15 * sw;
  }
  const r = reach * _scale * _density + 1;
  const ax = (_ma * (x0 - _halfW) + _mc * (y0 - _halfH) + _mx + _halfW) * _density;
  const ay = (_mb * (x0 - _halfW) + _md * (y0 - _halfH) + _my + _halfH) * _density;
  const bx = (_ma * (x1 - _halfW) + _mc * (y1 - _halfH) + _mx + _halfW) * _density;
  const by = (_mb * (x1 - _halfW) + _md * (y1 - _halfH) + _my + _halfH) * _density;
  segDirtyRect = accumulateDirtyRect(
    segDirtyRect,
    Math.min(ax, bx) - r,
    Math.min(ay, by) - r,
    Math.max(ax, bx) + r,
    Math.max(ay, by) + r,
  );
}

/**
 * How strongly a brush picks up the paper tooth (0..1): dry media fully,
 * wet media (markers) not at all. Brushes can override with `paper`.
 */
function paperResponse(param) {
  if (param.paper !== undefined) return param.paper;
  if (param.type === "marker") return 0;
  if (param.type === "spray") return 0.5;
  return 1;
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
    segCount = 0;
    segDirtyRect = null;
    perStep = 1;
    return;
  }

  Mix.glMask.isDrawn = true;
  const targetState = beginDirectMaskDraw(Renderer, gl, Mix.glMask);
  const isStamp = b.param.type === "image" || b.param.type === "custom";
  const prog = isStamp ? stamps : dots;
  const u = prog.uni;

  gl.useProgram(prog.program);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.ONE);
  gl.bindVertexArray(prog.vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, segBuf);
  if (segCount * SEG_WORDS * 4 > segGpuSize) {
    gl.bufferData(gl.ARRAY_BUFFER, segData, gl.DYNAMIC_DRAW);
    segGpuSize = segData.byteLength;
  } else {
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, segData.subarray(0, segCount * SEG_WORDS));
  }

  gl.uniform4f(u.u_color, ...b.color);
  gl.uniform2f(u.u_translate, ...b.translate);
  gl.uniform2f(u.u_half, ...b.half);
  gl.uniform1f(u.u_strokeWeight, b.strokeWeight);
  gl.uniform4f(u.u_paper, ...b.paper);
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
    gl.uniform2f(u.u_brush, b.param.weight, b.param.scatter);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, segCount * SUBSTEPS);
    gl.bindTexture(gl.TEXTURE_2D, null);
  } else {
    gl.uniformMatrix4fv(u.u_matrix, false, b.projection);
    gl.uniform4f(u.u_affine, ...b.affine);
    gl.uniform1f(u.u_sizeScale, b.sizeScale);
    gl.uniform1f(u.u_density, b.density);
    gl.uniform1i(u.u_type, DOT_TYPES[b.param.type] ?? 0);
    gl.uniform1i(u.u_perStep, perStep);
    gl.uniform4f(u.u_brush, b.param.weight, b.param.scatter, b.param.sharpness ?? 0, b.param.grain ?? 0);
    gl.uniform1i(u.u_affineCircle, b.affineCircle);
    gl.uniformMatrix2fv(u.u_tipInverse, false, b.tipInverse);
    gl.drawArraysInstanced(gl.POINTS, 0, segCount, SUBSTEPS * perStep);
  }

  gl.bindVertexArray(null);
  endDirectMaskDraw(Renderer, gl, targetState);

  if (segDirtyRect) {
    Mix.markDirtyRect(Mix.glMask, segDirtyRect);
    segDirtyRect = null;
  }
  segCount = 0;
  perStep = 1;

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
