// =============================================================================
// Module: GL Draw
// =============================================================================
/**
 * The GL Draw module batches brush primitives for WebGL2 rendering. It initializes
 * the shader programs and buffers used by circle-based brushes and image-tip brushes,
 * then flushes those queues into the shared framebuffer-backed brush mask.
 */

import {
  Mix,
  Cwidth,
  Cheight,
  isMixReady,
  Density,
  State,
  Renderer,
} from "../core/color.js";
import { Matrix } from "../core/flowfield.js";
import { createProgram } from "../core/gl/utils.js";
import vertSrc from "./shader.vert";
import fragSrc from "./shader.frag";
import imgVertSrc from "./image.vert";
import imgFragSrc from "./image.frag";

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
let prevMaskTarget = null;
const Attr = {},
  Frag = {};

// Cached matrix values — snapshotted once per stroke in snapshotMatrix()
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
 * Snapshots the current p5 model matrix. Call once at the start of each stroke.
 */
export function snapshotMatrix() {
  _ma = Matrix.a();
  _mb = Matrix.b();
  _mc = Matrix.c();
  _md = Matrix.d();
  _mx = Matrix.x();
  _my = Matrix.y();
  _halfW = Cwidth / 2;
  _halfH = Cheight / 2;
  _scale = Math.sqrt(_ma * _ma + _mb * _mb);
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

function resetMaskShaderTracking() {
  const renderer = Mix.glMask?.renderer;
  if (!renderer) return;
  renderer._curShader = null;
  renderer._cachedBlendMode = null;
  renderer._isBlending = null;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
}

function getFramebufferHandle(target) {
  if (!target) return null;
  if (typeof target._framebufferToBind === "function") return target._framebufferToBind();
  return target.framebuffer ?? null;
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
  const hadDepthTest = gl.isEnabled(gl.DEPTH_TEST);
  beginMaskTarget._hadDepthTest = hadDepthTest;
  if (hadDepthTest) gl.disable(gl.DEPTH_TEST);
  prevMaskTarget = Renderer._renderer.activeFramebuffer?.() ?? null;
  if (prevMaskTarget?._beforeEnd) prevMaskTarget._beforeEnd();
  gl.bindFramebuffer(gl.FRAMEBUFFER, getFramebufferHandle(Mix.glMask));
  gl.viewport(
    0,
    0,
    Mix.glMask.width * Mix.glMask.density,
    Mix.glMask.height * Mix.glMask.density,
  );
}

function endMaskTarget() {
  if (beginMaskTarget._hadDepthTest) gl.enable(gl.DEPTH_TEST);
  beginMaskTarget._hadDepthTest = false;
  if (prevMaskTarget?._beforeBegin) {
    prevMaskTarget._beforeBegin();
  } else {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    Renderer._renderer.viewport(
      Renderer._renderer._origViewport.width,
      Renderer._renderer._origViewport.height,
    );
    Renderer._renderer._applyStencilTestIfClipping?.();
  }
  prevMaskTarget = null;
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
 * Initializes WebGL objects if not done already.
 */
export function isReady() {
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
  ["u_matrix", "u_color"].forEach(
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
  texCache.clear();

  imgProgram = createProgram(gl, imgVertSrc, imgFragSrc);
  ["a_corner", "a_pos", "a_size", "a_angle", "a_alpha"].forEach(
    (n) => (imgAttr[n] = gl.getAttribLocation(imgProgram, n)),
  );
  ["u_proj", "u_color", "u_tex"].forEach(
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

  isLoaded = true;
}

// =============================================================================
// Section: Drawing Primitives
// =============================================================================

/**
 * Queue a circle to be drawn with the specified parameters.
 * Data is written directly into a flat Float32Array to avoid object allocation.
 * Applies the full 2D affine transform (rotation + scale + translation) from
 * p5's current model matrix so that brush.rotate() and brush.scale() work correctly.
 */
export function circle(x, y, diameter, alpha) {
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
 */
export function stampImage(x, y, size, angle, alpha) {
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
  const halfSize = (_density * size * _scale) / 2;

  const base = imgCount * IMG_FLOATS;
  imgData[base]     = screenX;
  imgData[base + 1] = screenY;
  imgData[base + 2] = halfSize;
  imgData[base + 3] = angle;
  imgData[base + 4] = alpha / 255;

  // Bounding box: rotated square worst-case = circle of radius halfSize * √2
  const dScreenX = screenX * _density;
  const dScreenY = screenY * _density;
  imgDirtyRect = accumulateDirtyRect(
    imgDirtyRect,
    dScreenX - halfSize * 1.42 - 1,
    dScreenY - halfSize * 1.42 - 1,
    dScreenX + halfSize * 1.42 + 1,
    dScreenY + halfSize * 1.42 + 1,
  );

  imgCount++;
}

/**
 * Flush all queued image stamps in a single instanced draw call.
 * @param {p5.Image} p5img - The preprocessed brush-tip image (from T.tips).
 * @param {string}   src   - The image src string, used as the texture cache key.
 */
export function glDrawImages(p5img, src) {
  if (imgCount === 0) return;

  Mix.glMask.isDrawn = true;
  beginMaskTarget();

  // Lazy-create the WebGL texture from the p5.Image canvas on first use
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
  gl.flush();

  gl.bindVertexArray(null);
  gl.bindTexture(gl.TEXTURE_2D, null);
  endMaskTarget();

  if (imgDirtyRect) {
    Mix.markDirtyRect(Mix.glMask, imgDirtyRect);
    imgDirtyRect = null;
  }

  imgCount = 0;

  // Let p5 know we changed the active program
  resetMaskShaderTracking();
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
  beginMaskTarget();

  const color = State.stroke.color._array;

  // Re-activate our shader (p5 drawing may have switched programs)
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
  gl.drawArrays(gl.POINTS, 0, circleCount);
  gl.flush();

  gl.bindVertexArray(null);
  endMaskTarget();

  if (circleDirtyRect) {
    Mix.markDirtyRect(Mix.glMask, circleDirtyRect);
    circleDirtyRect = null;
  }

  // Reset queue (no deallocation)
  circleCount = 0;

  // We called gl.useProgram() directly, bypassing p5's _curShader tracking.
  // Reset it to null so p5 is forced to re-activate its own shader next time
  // it draws — otherwise p5 skips gl.useProgram() and sets uniforms on the
  // wrong active program, causing "location is not from the associated program".
  resetMaskShaderTracking();
}
