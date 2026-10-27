// =============================================================================
// Module: GL Draw
// =============================================================================
/**
 * The GL Draw module batches brush primitives for WebGL2 rendering. It initializes
 * the shader programs and buffers used by circle-based brushes and image-tip brushes,
 * then flushes those queues into the shared framebuffer-backed brush mask.
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
import vertSrc from "./shader.vert";
import fragSrc from "./shader.frag";
import imgVertSrc from "./image.vert";
import imgFragSrc from "./image.frag";
import gpuDotsVertSrc from "./gpu_dots.vert";

// =============================================================================
// Section: Initialization and Setup
// =============================================================================

// Module state
let isLoaded = false,
  gl,
  framebufferProjMatrix,
  vao,
  buf,
  program;
let loadedWidth = 0,
  loadedHeight = 0;
let brushMaskTarget = null;
const Attr = {},
  Frag = {};

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

// Pre-allocated flat buffer for circle data (x, y, radius, alpha per circle)
const INITIAL_CAPACITY = 2048;
let circleData = new Float32Array(INITIAL_CAPACITY * 4);
let circleCount = 0;
let bufferCapacity = INITIAL_CAPACITY;
let gpuBufferSize = INITIAL_CAPACITY * 4 * 4; // bytes allocated on GPU
let circleDirtyRect = null;

// ---------------------------------------------------------------------------
// Image instancing state
// ---------------------------------------------------------------------------
let imgProgram = null;
let imgVao = null;
let imgCornerBuf = null;
let imgInstanceBuf = null;
const imgAttr = {};
const imgFrag = {};
let imgGpuSize = 0;

const IMG_FLOATS = 5;    // screenX, screenY, halfSize, angle, alpha — per stamp
const IMG_INIT_CAP = 256;
let imgData = new Float32Array(IMG_INIT_CAP * IMG_FLOATS);
let imgCount = 0;
let imgCapacity = IMG_INIT_CAP;
let imgDirtyRect = null;

// Texture cache: src string → WebGLTexture (cleared whenever the GL context changes)
const texCache = new Map();

// Static unit-quad corners for gl.TRIANGLE_STRIP in quad-local space.
const QUAD_CORNERS = new Float32Array([-1, -1,  1, -1,  -1, 1,  1, 1]);

// ---------------------------------------------------------------------------
// EXPERIMENTAL: GPU dot generation state
//
// Default-type brushes can queue path segments instead of circles. Each
// segment covers gpuSubsteps fine steps; the vertex shader expands it into
// dots (see gpu_dots.vert). Toggle with setGpuDots().
// ---------------------------------------------------------------------------
let gpuSubsteps = 40;
// startX, startY, endX, endY, cos, sin, pressure, count, alpha, segIndex,
// seed (uint), endPressure
const SEG_FLOATS = 12;
let gpuDotsEnabled = false;
let segProgram = null;
let segVao = null;
let segBuf = null;
let segGpuSize = 0;
const segAttr = {};
const segFrag = {};
let segData = new Float32Array(1024 * SEG_FLOATS);
let segSeeds = new Uint32Array(segData.buffer);
let segCount = 0;
let segDirtyRect = null;
// Per-stroke values (seed, alpha, segment index) travel as vertex data, so
// consecutive strokes share one draw. Everything still sent as uniforms is
// captured in segBatch; a stroke that changes any of it flushes first.
const segStroke = { seed: 0, alpha: 0, index: 0, weight: 0, scatter: 0, sharpness: 0, grain: 0, strokeWeight: 0 };
let segBatch = null;

/**
 * @param {boolean} enabled
 * @param {object} [options]
 * @param {number} [options.substeps] - Fine steps per CPU path segment (default 40).
 */
export function setGpuDots(enabled, options = {}) {
  gpuDotsEnabled = !!enabled;
  if (options.substeps !== undefined) {
    const n = Math.round(options.substeps);
    if (!(n >= 1 && n <= 1024)) throw new Error("substeps must be between 1 and 1024.");
    gpuSubsteps = n;
  }
}

export function getGpuSubsteps() {
  return gpuSubsteps;
}

Mix.beforeBrushMaskAccess = () => glDrawGpuDots();

export function isGpuDotsEnabled() {
  return gpuDotsEnabled;
}

export function discardPendingStamps() {
  circleCount = imgCount = segCount = 0;
  circleDirtyRect = imgDirtyRect = segDirtyRect = null;
}

function ensureBrushMaskTarget() {
  const rendererMask = Renderer?.glMask;
  if (!rendererMask) return null;
  brushMaskTarget = rendererMask;
  brushMaskTarget.dirtyRect ??= null;
  brushMaskTarget.isDrawn ??= false;
  Mix.glMask = brushMaskTarget;
  return brushMaskTarget;
}

function getProjectionMatrix() {
  return framebufferProjMatrix;
}

function beginMaskTarget() {
  return beginDirectMaskDraw(Renderer, gl, Mix.glMask);
}

function endMaskTarget(state) {
  endDirectMaskDraw(Renderer, gl, state);
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
  if (activeProgram === program || activeProgram === imgProgram || activeProgram === segProgram) gl.useProgram(null);
  for (const tex of texCache.values()) gl.deleteTexture(tex);
  texCache.clear();
  if (program) gl.deleteProgram(program);
  if (vao) gl.deleteVertexArray(vao);
  if (buf) gl.deleteBuffer(buf);
  if (imgProgram) gl.deleteProgram(imgProgram);
  if (imgVao) gl.deleteVertexArray(imgVao);
  if (imgCornerBuf) gl.deleteBuffer(imgCornerBuf);
  if (imgInstanceBuf) gl.deleteBuffer(imgInstanceBuf);
  if (segProgram) gl.deleteProgram(segProgram);
  if (segVao) gl.deleteVertexArray(segVao);
  if (segBuf) gl.deleteBuffer(segBuf);
  program = vao = buf = null;
  imgProgram = imgVao = imgCornerBuf = imgInstanceBuf = null;
  segProgram = segVao = segBuf = null;
  gpuBufferSize = 0;
  imgGpuSize = 0;
  segGpuSize = 0;
}

/**
 * Initializes WebGL objects if not done already.
 */
export function isReady() {
  // EXPERIMENTAL: draw queued GPU dots on their own context before switching.
  if (segCount > 0 && gl && Renderer.drawingContext !== gl) glDrawGpuDots();
  isMixReady();
  ensureBrushMaskTarget();

  const nextGl = Renderer.drawingContext;
  const needsContextRefresh = !isLoaded || gl !== nextGl;
  const needsProjectionRefresh =
    needsContextRefresh || loadedWidth !== Cwidth || loadedHeight !== Cheight;

  if (needsProjectionRefresh) {
    framebufferProjMatrix = new Float32Array([
      2 / Cwidth,
      0,
      0,
      0,
      0,
      2 / Cheight,
      0,
      0,
      0,
      0,
      1,
      0,
      -1,
      -1,
      0,
      1,
    ]);
    loadedWidth = Cwidth;
    loadedHeight = Cheight;
  }

  if (!needsContextRefresh) return;

  releaseGlResources();
  gl = nextGl;

  // Create shader program and initialize
  program = createProgram(gl, vertSrc, fragSrc);
  gl.useProgram(program);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.ONE);

  // Cache attribute and uniform locations
  ["a_position", "a_radius", "a_alpha"].forEach(
    (n) => (Attr[n] = gl.getAttribLocation(program, n)),
  );
  ["u_matrix", "u_color", "u_affineCircle", "u_tipInverse", ...CLIP_UNIFORMS].forEach(
    (n) => (Frag[n] = gl.getUniformLocation(program, n)),
  );

  // Create persistent VAO and VBO
  vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, circleData.byteLength, gl.DYNAMIC_DRAW);
  gpuBufferSize = circleData.byteLength;

  // Set up vertex attributes (only needs to happen once with persistent VAO)
  const stride = 16; // 4 floats × 4 bytes
  gl.enableVertexAttribArray(Attr.a_position);
  gl.vertexAttribPointer(Attr.a_position, 2, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(Attr.a_radius);
  gl.vertexAttribPointer(Attr.a_radius, 1, gl.FLOAT, false, stride, 8);
  gl.enableVertexAttribArray(Attr.a_alpha);
  gl.vertexAttribPointer(Attr.a_alpha, 1, gl.FLOAT, false, stride, 12);

  gl.bindVertexArray(null);

  // ------------------------------------------------------------------
  // Image-tip instancing program
  // ------------------------------------------------------------------
  imgProgram = createProgram(gl, imgVertSrc, imgFragSrc);
  ["a_corner", "a_pos", "a_size", "a_angle", "a_alpha"].forEach(
    (n) => (imgAttr[n] = gl.getAttribLocation(imgProgram, n)),
  );
  ["u_proj", "u_color", "u_tex", "u_tipLinear", ...CLIP_UNIFORMS].forEach(
    (n) => (imgFrag[n] = gl.getUniformLocation(imgProgram, n)),
  );

  imgVao = gl.createVertexArray();
  gl.bindVertexArray(imgVao);

  // Static corner VBO (per-vertex, no divisor)
  imgCornerBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, imgCornerBuf);
  gl.bufferData(gl.ARRAY_BUFFER, QUAD_CORNERS, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(imgAttr.a_corner);
  gl.vertexAttribPointer(imgAttr.a_corner, 2, gl.FLOAT, false, 0, 0);

  // Instance data VBO (per-instance)
  imgInstanceBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, imgInstanceBuf);
  gl.bufferData(gl.ARRAY_BUFFER, imgData.byteLength, gl.DYNAMIC_DRAW);
  imgGpuSize = imgData.byteLength;

  const istride = IMG_FLOATS * 4; // 20 bytes
  gl.enableVertexAttribArray(imgAttr.a_pos);
  gl.vertexAttribPointer(imgAttr.a_pos, 2, gl.FLOAT, false, istride, 0);
  gl.vertexAttribDivisor(imgAttr.a_pos, 1);

  gl.enableVertexAttribArray(imgAttr.a_size);
  gl.vertexAttribPointer(imgAttr.a_size, 1, gl.FLOAT, false, istride, 8);
  gl.vertexAttribDivisor(imgAttr.a_size, 1);

  gl.enableVertexAttribArray(imgAttr.a_angle);
  gl.vertexAttribPointer(imgAttr.a_angle, 1, gl.FLOAT, false, istride, 12);
  gl.vertexAttribDivisor(imgAttr.a_angle, 1);

  gl.enableVertexAttribArray(imgAttr.a_alpha);
  gl.vertexAttribPointer(imgAttr.a_alpha, 1, gl.FLOAT, false, istride, 16);
  gl.vertexAttribDivisor(imgAttr.a_alpha, 1);

  gl.bindVertexArray(null);

  // ------------------------------------------------------------------
  // EXPERIMENTAL: GPU dot generation program (shares the circle fragment shader)
  // ------------------------------------------------------------------
  segProgram = createProgram(gl, gpuDotsVertSrc, fragSrc);
  ["a_start", "a_end", "a_dir", "a_pressure", "a_stroke", "a_seed", "a_pressureEnd"].forEach(
    (n) => (segAttr[n] = gl.getAttribLocation(segProgram, n)),
  );
  [
    "u_matrix", "u_affine", "u_translate", "u_half", "u_sizeScale",
    "u_brush", "u_strokeWeight",
    "u_color", "u_affineCircle", "u_tipInverse", ...CLIP_UNIFORMS,
  ].forEach((n) => (segFrag[n] = gl.getUniformLocation(segProgram, n)));

  segVao = gl.createVertexArray();
  gl.bindVertexArray(segVao);
  segBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, segBuf);
  gl.bufferData(gl.ARRAY_BUFFER, segData.byteLength, gl.DYNAMIC_DRAW);
  segGpuSize = segData.byteLength;
  const sstride = SEG_FLOATS * 4;
  [["a_start", 0], ["a_end", 8], ["a_dir", 16], ["a_pressure", 24], ["a_stroke", 32]].forEach(([n, off]) => {
    gl.enableVertexAttribArray(segAttr[n]);
    gl.vertexAttribPointer(segAttr[n], 2, gl.FLOAT, false, sstride, off);
  });
  gl.enableVertexAttribArray(segAttr.a_seed);
  gl.vertexAttribIPointer(segAttr.a_seed, 1, gl.UNSIGNED_INT, sstride, 40);
  gl.enableVertexAttribArray(segAttr.a_pressureEnd);
  gl.vertexAttribPointer(segAttr.a_pressureEnd, 1, gl.FLOAT, false, sstride, 44);
  gl.bindVertexArray(null);

  isLoaded = true;
}

// =============================================================================
// Section: Drawing Primitives
// =============================================================================

/**
 * Queue a circle to be drawn with the specified parameters.
 * Data is written directly into a flat Float32Array to avoid object allocation.
 * Applies the full 2D affine transform (rotation + scale + translation) from
 * the current runtime transform so that brush.rotate() and brush.scale() work correctly.
 */
export function circle(x, y, diameter, alpha) {
  if (_scale === 0 || diameter <= 0) return;
  // Grow buffer if needed
  if (circleCount >= bufferCapacity) {
    bufferCapacity *= 2;
    const newData = new Float32Array(bufferCapacity * 4);
    newData.set(circleData);
    circleData = newData;
  }

  // x/y arrive in "position space": user coords + (Cwidth/2, Cheight/2).
  // Subtract the offset to recover user coords, apply the full matrix, then re-add
  // the offset so the result is in screen pixel space [0..Cwidth, 0..Cheight].
  const px = x - _halfW;
  const py = y - _halfH;

  const offset = circleCount * 4;
  const screenX = _ma * px + _mc * py + _mx + _halfW;
  const screenY = _mb * px + _md * py + _my + _halfH;
  const radius = (_density * diameter * _scale) / 2;

  circleData[offset] = screenX;
  circleData[offset + 1] = screenY;
  // Scale the diameter by the matrix's scale factor (length of the transformed x-axis)
  circleData[offset + 2] = radius;
  circleData[offset + 3] = alpha / 255;

  const dScreenX = screenX * _density;
  const dScreenY = screenY * _density;
  circleDirtyRect = accumulateDirtyRect(
    circleDirtyRect,
    dScreenX - radius - 1,
    dScreenY - radius - 1,
    dScreenX + radius + 1,
    dScreenY + radius + 1,
  );

  circleCount++;
}

/**
 * Queue an image stamp to be drawn with instanced rendering.
 * Accepts the same coordinate conventions as circle(): x/y in position space
 * (user coords + Cwidth/2, Cheight/2), size in user-coord units, alpha in [0..255].
 * @param {number} x     - X in position space.
 * @param {number} y     - Y in position space.
 * @param {number} size  - Full stamp diameter in user-coord units.
 * @param {number} angle - Rotation in radians.
 * @param {number} alpha - Opacity [0..255].
 * @param {number} [extraPadding=0] - Conservative extra padding in user units.
 */
export function stampImage(x, y, size, angle, alpha, extraPadding = 0) {
  if (size <= 0) return;
  if (imgCount >= imgCapacity) {
    imgCapacity *= 2;
    const next = new Float32Array(imgCapacity * IMG_FLOATS);
    next.set(imgData);
    imgData = next;
  }

  const px = x - _halfW;
  const py = y - _halfH;
  const screenX  = _ma * px + _mc * py + _mx + _halfW;
  const screenY  = _mb * px + _md * py + _my + _halfH;
  // Quad geometry and projection both use logical units. Density belongs only
  // in the viewport and physical dirty bounds, unlike gl_PointSize.
  const halfSize = size / 2;
  const extraRadius = _density * extraPadding * _scale;

  const base = imgCount * IMG_FLOATS;
  imgData[base]     = screenX;
  imgData[base + 1] = screenY;
  imgData[base + 2] = halfSize;
  imgData[base + 3] = angle;
  imgData[base + 4] = alpha / 255;

  // Bounding box: rotated square worst-case = circle of radius halfSize * √2
  const dScreenX = screenX * _density;
  const dScreenY = screenY * _density;
  const c = Math.cos(angle), s = Math.sin(angle);
  const reachX = _density * halfSize * (Math.abs(_ma * c + _mc * s) + Math.abs(-_ma * s + _mc * c)) + extraRadius;
  const reachY = _density * halfSize * (Math.abs(_mb * c + _md * s) + Math.abs(-_mb * s + _md * c)) + extraRadius;
  imgDirtyRect = accumulateDirtyRect(
    imgDirtyRect,
    dScreenX - reachX - 1,
    dScreenY - reachY - 1,
    dScreenX + reachX + 1,
    dScreenY + reachY + 1,
  );

  imgCount++;
}

/**
 * Flush all queued image stamps in a single instanced draw call.
 * @param {object} p5img - The preprocessed brush-tip image/canvas (from T.tips).
 * @param {string}   src   - The image src string, used as the texture cache key.
 */
export function glDrawImages(p5img, src) {
  if (imgCount === 0) return;

  Mix.glMask.isDrawn = true;
  const targetState = beginMaskTarget();

  // Lazy-create the WebGL texture from the tip canvas on first use.
  let tex = texCache.get(src);
  if (!tex) {
    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, p5img.canvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    texCache.set(src, tex);
  }

  gl.useProgram(imgProgram);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.ONE);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(imgFrag.u_tex, 0);

  const color = State.stroke.color._array;
  gl.uniform4f(imgFrag.u_color, ...color);
  gl.uniformMatrix4fv(imgFrag.u_proj, false, getProjectionMatrix());
  gl.uniformMatrix2fv(imgFrag.u_tipLinear, false, [_ma, _mb, _mc, _md]);
  setClipUniforms(gl, imgFrag);

  gl.bindVertexArray(imgVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, imgInstanceBuf);

  const byteCount = imgCount * IMG_FLOATS * 4;
  const dataView  = imgData.subarray(0, imgCount * IMG_FLOATS);
  if (byteCount > imgGpuSize) {
    gl.bufferData(gl.ARRAY_BUFFER, imgData, gl.DYNAMIC_DRAW);
    imgGpuSize = imgData.byteLength;
  } else {
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, dataView);
  }

  gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, imgCount);

  gl.bindVertexArray(null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  endMaskTarget(targetState);

  if (imgDirtyRect) {
    Mix.markDirtyRect(Mix.glMask, imgDirtyRect);
    imgDirtyRect = null;
  }

  imgCount = 0;

  // Let the host adapter know we changed the active program.
  resetDirectShaderTracking(Renderer, gl);
}

// =============================================================================
// Section: EXPERIMENTAL GPU dot generation
// =============================================================================

/**
 * Starts a GPU-generated stroke. Captures the per-stroke values that
 * drawDefault() reads from the brush and stroke state.
 */
export function beginGpuStroke(seed, alpha, param, strokeWeight) {
  // Everything drawn as a uniform is captured here, because by the time the
  // batch is flushed the live transform, colour, or clip may belong to a
  // later stroke (or be cleared by noStroke()/noClip()).
  const color = State.stroke.color._array;
  const key = [
    gl, Mix.glMask, getProjectionMatrix(), State.stroke.clip, color[0], color[1], color[2], color[3],
    _ma, _mb, _mc, _md, _mx, _my, _halfW, _halfH, _density, _scale, _affineCircle, ..._tipInverse,
    param.weight, param.scatter, param.sharpness, param.grain, strokeWeight, gpuSubsteps,
  ];
  if (segCount > 0 && (!segBatch || key.some((v, i) => v !== segBatch.key[i]))) glDrawGpuDots();
  segBatch = {
    key,
    projection: getProjectionMatrix(),
    color: [...color],
    clip: State.stroke.clip,
    affine: [_ma, _mb, _mc, _md],
    translate: [_mx, _my],
    half: [_halfW, _halfH],
    sizeScale: _density * _scale,
    affineCircle: _affineCircle,
    tipInverse: new Float32Array(_tipInverse),
    brush: [param.weight, param.scatter, param.sharpness, param.grain],
    strokeWeight,
    substeps: gpuSubsteps,
  };
  segStroke.seed = Math.floor(seed * 4294.967) >>> 0; // seed is in [0, 999999)
  segStroke.alpha = alpha;
  segStroke.index = 0;
  segStroke.weight = param.weight;
  segStroke.scatter = param.scatter;
  segStroke.sharpness = param.sharpness;
  segStroke.grain = param.grain;
  segStroke.strokeWeight = strokeWeight;
}

/**
 * Queues one path segment of up to getGpuSubsteps() fine steps.
 * Coordinates are in position space, as for circle(). Pressure is
 * interpolated from `pressure` to `endPressure` along the segment.
 */
export function queueDotSegment(x0, y0, x1, y1, cs, sn, pressure, endPressure, count) {
  if (_scale === 0 || count <= 0) return;
  if ((segCount + 1) * SEG_FLOATS > segData.length) {
    const next = new Float32Array(segData.length * 2);
    next.set(segData);
    segData = next;
    segSeeds = new Uint32Array(segData.buffer);
  }
  const o = segCount * SEG_FLOATS;
  segData[o] = x0;
  segData[o + 1] = y0;
  segData[o + 2] = x1;
  segData[o + 3] = y1;
  segData[o + 4] = cs;
  segData[o + 5] = sn;
  segData[o + 6] = pressure;
  segData[o + 7] = count;
  segData[o + 8] = segStroke.alpha;
  segData[o + 9] = segStroke.index++;
  segSeeds[o + 10] = segStroke.seed;
  segData[o + 11] = endPressure;
  segCount++;

  // Conservative bounds: Box-Muller from 24-bit uniforms stays below 6 sigma.
  // Vibration grows as pressure falls, so bound with the smaller end.
  const pMin = Math.min(pressure, endPressure);
  const pMax = Math.max(pressure, endPressure);
  if (pMax <= 0) return;
  const st = segStroke;
  const vib = st.strokeWeight * st.scatter * (st.sharpness + ((1 - st.sharpness) * 6) / Math.max(pMin, 1e-3));
  const reach = vib * 1.05 + pMax * pMax * st.weight * 1.15 * st.strokeWeight;
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
 * Expands all queued segments into dots in one instanced draw.
 */
export function glDrawGpuDots() {
  if (segCount === 0) return;
  // The mask may have been replaced since the batch started (e.g. target switch).
  if (!gl || gl.isContextLost?.() || !Mix.glMask) {
    segCount = 0;
    segDirtyRect = null;
    return;
  }

  Mix.glMask.isDrawn = true;
  const targetState = beginMaskTarget();

  gl.useProgram(segProgram);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.ONE);
  gl.bindVertexArray(segVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, segBuf);

  const byteCount = segCount * SEG_FLOATS * 4;
  if (byteCount > segGpuSize) {
    gl.bufferData(gl.ARRAY_BUFFER, segData, gl.DYNAMIC_DRAW);
    segGpuSize = segData.byteLength;
  } else {
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, segData.subarray(0, segCount * SEG_FLOATS));
  }

  const b = segBatch;
  gl.uniform4f(segFrag.u_color, ...b.color);
  gl.uniformMatrix4fv(segFrag.u_matrix, false, b.projection);
  gl.uniform4f(segFrag.u_affine, ...b.affine);
  gl.uniform2f(segFrag.u_translate, ...b.translate);
  gl.uniform2f(segFrag.u_half, ...b.half);
  gl.uniform1f(segFrag.u_sizeScale, b.sizeScale);
  gl.uniform4f(segFrag.u_brush, ...b.brush);
  gl.uniform1f(segFrag.u_strokeWeight, b.strokeWeight);
  gl.uniform1i(segFrag.u_affineCircle, b.affineCircle);
  gl.uniformMatrix2fv(segFrag.u_tipInverse, false, b.tipInverse);
  const liveClip = State.stroke.clip;
  State.stroke.clip = b.clip;
  setClipUniforms(gl, segFrag);
  State.stroke.clip = liveClip;
  gl.drawArraysInstanced(gl.POINTS, 0, segCount, b.substeps);

  gl.bindVertexArray(null);
  endMaskTarget(targetState);

  if (segDirtyRect) {
    Mix.markDirtyRect(Mix.glMask, segDirtyRect);
    segDirtyRect = null;
  }
  segCount = 0;
  resetDirectShaderTracking(Renderer, gl);
}

/**
 * Removes a cached GL texture by key, forcing re-upload on next draw.
 * Call this when a custom tip function changes after brush.add().
 */
export function invalidateTexEntry(key) {
  const tex = texCache.get(key);
  if (tex && gl) gl.deleteTexture(tex);
  texCache.delete(key);
}

/**
 * Draw all queued circles using WebGL
 */
export function glDraw() {
  if (circleCount === 0) return;

  Mix.glMask.isDrawn = true;
  const targetState = beginMaskTarget();

  const color = State.stroke.color._array;

  // Re-activate our shader in case host drawing switched programs.
  gl.useProgram(program);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE_MINUS_DST_ALPHA, gl.ONE);

  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);

  // Upload vertex data — reallocate GPU buffer only if needed
  const byteCount = circleCount * 16; // 4 floats × 4 bytes
  const dataView = circleData.subarray(0, circleCount * 4);
  if (byteCount > gpuBufferSize) {
    gl.bufferData(gl.ARRAY_BUFFER, circleData, gl.DYNAMIC_DRAW);
    gpuBufferSize = circleData.byteLength;
  } else {
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, dataView);
  }

  // Set uniforms and draw
  gl.uniform4f(Frag.u_color, ...color);
  gl.uniformMatrix4fv(Frag.u_matrix, false, getProjectionMatrix());
  gl.uniform1i(Frag.u_affineCircle, _affineCircle);
  gl.uniformMatrix2fv(Frag.u_tipInverse, false, _tipInverse);
  setClipUniforms(gl, Frag);
  gl.drawArrays(gl.POINTS, 0, circleCount);

  gl.bindVertexArray(null);
  endMaskTarget(targetState);

  if (circleDirtyRect) {
    Mix.markDirtyRect(Mix.glMask, circleDirtyRect);
    circleDirtyRect = null;
  }

  // Reset queue (no deallocation)
  circleCount = 0;

  // We called gl.useProgram() directly, bypassing host shader tracking.
  // Reset it so the host is forced to re-activate its own shader next time
  // it draws — otherwise it may skip gl.useProgram() and set uniforms on the
  // wrong active program, causing "location is not from the associated program".
  resetDirectShaderTracking(Renderer, gl);
}
