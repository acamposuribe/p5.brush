// =============================================================================
// Module: GL Fill
// =============================================================================
/**
 * Renders fill and wash layers into the fill mask on the GPU.
 *
 * The mask is a half-float framebuffer that stores paint in log space:
 *   r = Σ −ln(1 − a) over painted layers
 *   g = Σ −ln(1 − e) over erase circles
 *   b = Σ −ln(1 − a) over silhouette layers only (watercolour fills)
 * and the composite shader turns it back into coverage, (1 − e^−r) · e^−g.
 * That is exactly what Canvas2D source-over painting followed by
 * destination-out erasing produces, but every term is a sum, so draw order
 * does not matter. Polygons are filled by stencil-then-cover (fan.vert), two
 * draws each; borders and erase circles draw in one instanced call
 * (capsule.vert).
 */

import { Renderer, Cwidth, Cheight, Density } from "../core/target.js";
import { Mix } from "../core/color.js";
import { createProgram } from "../core/gl/utils.js";
import { createFramebuffer } from "../core/compositor_runtime.js";
import {
  beginDirectMaskDraw,
  endDirectMaskDraw,
  resetDirectShaderTracking,
} from "../core/renderer_runtime.js";
import fanVertSrc from "./fan.vert";
import fanFragSrc from "./fan.frag";
import capsuleVertSrc from "./capsule.vert";
import capsuleFragSrc from "./capsule.frag";
import fullscreenVertSrc from "../core/gl/shader.vert";
import blurFragSrc from "./blur.frag";

// =============================================================================
// Section: State
// =============================================================================

const FAN_WORDS = 6; // one fan triangle: centre.xy, start.xy, end.xy
const CAPSULE_WORDS = 8; // start.xy, end.xy, radius, paint, erase, depth
const MAX_ALPHA = 0.9999; // keeps −ln(1 − a) finite for opaque washes
// Each border and erase circle gets its own depth, decreasing from 1.
const DEPTH_STEP = 1 / (1 << 22);
// Sub-pixel offsets (device px) that antialias polygon fills, by sample
// count. Fill layers use 2: the many overlapping layers smooth their edges
// further. A wash is a single hard-edged polygon and uses 4 (rotated grid).
const JITTER = {
  2: [[0.25, 0.25], [-0.25, -0.25]],
  4: [[0.125, 0.375], [0.375, -0.125], [-0.125, -0.375], [-0.375, 0.125]],
};

let gl = null;
const fan = { program: null, vao: null, buffer: null, uMatrix: null, uWeight: null, uJitter: null, uShape: null };
const capsule = { program: null, vao: null, buffer: null, uMatrix: null, uPixel: null };
const blur = { program: null, vao: null, uSrc: null, uDstSize: null, uStep: null, uLevel: null };

let fanData = new Float32Array(4096 * FAN_WORDS);
let fanCount = 0;
// Queued polygons: first triangle, triangle count, log-domain weight,
// antialiasing sample count and silhouette flag.
let polygons = [];
let capsuleData = new Float32Array(4096 * CAPSULE_WORDS);
let capsuleCount = 0;

// User space → device pixels (a, b, c, d, e, f, as in DOMMatrix).
const matrix = new Float64Array(6);
let depth = 1;
let dirtyRect = null;

// Draw queued layers before the composite reads or clears the fill mask.
Mix.beforeFillMaskAccess = () => flushFill();

// =============================================================================
// Section: GL resources
// =============================================================================

function releaseGlResources() {
  if (!gl || gl.isContextLost?.()) return;
  for (const p of [fan, capsule, blur]) {
    if (p.program) gl.deleteProgram(p.program);
    if (p.vao) gl.deleteVertexArray(p.vao);
    if (p.buffer) gl.deleteBuffer(p.buffer);
    p.program = p.vao = p.buffer = null;
  }
}

function setupProgram(target, vertSrc, fragSrc, attributes, words, divisor) {
  target.program = createProgram(gl, vertSrc, fragSrc);
  target.uMatrix = gl.getUniformLocation(target.program, "u_matrix");
  target.uWeight = gl.getUniformLocation(target.program, "u_weight");
  target.uJitter = gl.getUniformLocation(target.program, "u_jitter");
  target.uPixel = gl.getUniformLocation(target.program, "u_pixel");
  target.uShape = gl.getUniformLocation(target.program, "u_shape");
  target.buffer = gl.createBuffer();
  target.vao = gl.createVertexArray();
  gl.bindVertexArray(target.vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, target.buffer);
  for (const [name, size, offset] of attributes) {
    const loc = gl.getAttribLocation(target.program, name);
    if (loc < 0) continue;
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, words * 4, offset * 4);
    gl.vertexAttribDivisor(loc, divisor);
  }
  gl.bindVertexArray(null);
}

function ensureGl() {
  const nextGl = Renderer.drawingContext;
  if (gl === nextGl && fan.program) return;
  releaseGlResources();
  gl = nextGl;
  setupProgram(fan, fanVertSrc, fanFragSrc, [["a_pos", 2, 0]], 2, 0);
  setupProgram(capsule, capsuleVertSrc, capsuleFragSrc, [
    ["a_start", 2, 0], ["a_end", 2, 2], ["a_info", 4, 4],
  ], CAPSULE_WORDS, 1);
  blur.program = createProgram(gl, fullscreenVertSrc, blurFragSrc);
  blur.vao = gl.createVertexArray();
  for (const name of ["u_src", "u_dstSize", "u_step", "u_level"]) {
    blur[name] = gl.getUniformLocation(blur.program, name);
  }
}

// A fresh bufferData each flush lets the driver hand out new storage instead
// of waiting for the GPU to finish reading the previous fill's vertices.
function upload(target, data, count, words) {
  gl.bindBuffer(gl.ARRAY_BUFFER, target.buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, count * words), gl.STREAM_DRAW);
}

// =============================================================================
// Section: Queue
// =============================================================================

const logWeight = (alpha) => -Math.log1p(-Math.min(alpha, MAX_ALPHA));

function growFan(extra) {
  if ((fanCount + extra) * FAN_WORDS <= fanData.length) return;
  let size = fanData.length * 2;
  while (size < (fanCount + extra) * FAN_WORDS) size *= 2;
  const next = new Float32Array(size);
  next.set(fanData);
  fanData = next;
}

function growCapsule(extra) {
  if ((capsuleCount + extra) * CAPSULE_WORDS <= capsuleData.length) return;
  let size = capsuleData.length * 2;
  while (size < (capsuleCount + extra) * CAPSULE_WORDS) size *= 2;
  const next = new Float32Array(size);
  next.set(capsuleData);
  capsuleData = next;
}

function markBounds(minX, minY, maxX, maxY, pad) {
  const [a, b, c, d, e, f] = matrix;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of [[minX, minY], [maxX, minY], [minX, maxY], [maxX, maxY]]) {
    const tx = a * x + c * y + e;
    const ty = b * x + d * y + f;
    if (tx < x0) x0 = tx;
    if (tx > x1) x1 = tx;
    if (ty < y0) y0 = ty;
    if (ty > y1) y1 = ty;
  }
  const p = 1 + pad * Math.max(Math.hypot(a, c), Math.hypot(b, d));
  x0 -= p; y0 -= p; x1 += p; y1 += p;
  if (!dirtyRect) dirtyRect = { minX: x0, minY: y0, maxX: x1, maxY: y1 };
  else {
    if (x0 < dirtyRect.minX) dirtyRect.minX = x0;
    if (y0 < dirtyRect.minY) dirtyRect.minY = y0;
    if (x1 > dirtyRect.maxX) dirtyRect.maxX = x1;
    if (y1 > dirtyRect.maxY) dirtyRect.maxY = y1;
  }
}

/**
 * Sets the user-space → device-pixel transform for the layers queued next.
 * Flushes queued layers drawn under a different transform.
 * @param {number[]} m - (a, b, c, d, e, f), as in DOMMatrix.
 */
export function setFillTransform(m) {
  if (m.every((v, i) => v === matrix[i])) return;
  flushFill();
  matrix.set(m);
}

/**
 * Queues a polygon layer: a fill with opacity `alpha` and, when
 * `strokeAlpha` > 0, a round-joined border `lineWidth` wide.
 * @param {{x: number, y: number}[]} vertices - Polygon in user space.
 * @param {number} alpha - Fill opacity 0..1.
 * @param {number} [strokeAlpha=0] - Border opacity 0..1.
 * @param {number} [lineWidth=0] - Border width in user space.
 * @param {2|4} [samples=2] - Antialiasing samples per pixel.
 * @param {boolean} [shape=false] - Also paint the silhouette channel.
 */
export function queuePolygon(vertices, alpha, strokeAlpha = 0, lineWidth = 0, samples = 2, shape = false) {
  const n = vertices.length;
  if (n < 3) return;

  let cx = 0, cy = 0, area = 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const p = vertices[i];
    const q = vertices[i + 1 < n ? i + 1 : 0];
    cx += p.x;
    cy += p.y;
    area += p.x * q.y - q.x * p.y;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  cx /= n;
  cy /= n;

  const stroke = strokeAlpha > 0 && lineWidth > 0;
  if (alpha > 0 && area !== 0) {
    growFan(n);
    polygons.push(fanCount, n, logWeight(alpha), samples, shape ? 1 : 0);
    let o = fanCount * FAN_WORDS;
    for (let i = 0; i < n; i++, o += FAN_WORDS) {
      const p = vertices[i];
      const q = vertices[i + 1 < n ? i + 1 : 0];
      fanData[o] = cx;
      fanData[o + 1] = cy;
      fanData[o + 2] = p.x;
      fanData[o + 3] = p.y;
      fanData[o + 4] = q.x;
      fanData[o + 5] = q.y;
    }
    fanCount += n;
  }
  if (stroke) {
    const w = logWeight(strokeAlpha);
    const r = lineWidth / 2;
    depth -= DEPTH_STEP;
    growCapsule(n);
    let o = capsuleCount * CAPSULE_WORDS;
    for (let i = 0; i < n; i++, o += CAPSULE_WORDS) {
      const p = vertices[i];
      const q = vertices[i + 1 < n ? i + 1 : 0];
      capsuleData[o] = p.x;
      capsuleData[o + 1] = p.y;
      capsuleData[o + 2] = q.x;
      capsuleData[o + 3] = q.y;
      capsuleData[o + 4] = r;
      capsuleData[o + 5] = w;
      capsuleData[o + 6] = 0;
      capsuleData[o + 7] = depth;
    }
    capsuleCount += n;
  }
  if (alpha > 0 || stroke) {
    markBounds(minX, minY, maxX, maxY, stroke ? lineWidth / 2 : 0);
  }
}

/**
 * Queues an erase circle that removes a fraction `alpha` of the paint under it.
 * @param {number} x - Centre x in user space.
 * @param {number} y - Centre y in user space.
 * @param {number} radius - Radius in user space.
 * @param {number} alpha - Erase strength 0..1.
 */
export function queueErase(x, y, radius, alpha) {
  if (alpha <= 0 || radius <= 0) return;
  growCapsule(1);
  const o = capsuleCount * CAPSULE_WORDS;
  depth -= DEPTH_STEP;
  capsuleData[o] = x;
  capsuleData[o + 1] = y;
  capsuleData[o + 2] = x;
  capsuleData[o + 3] = y;
  capsuleData[o + 4] = radius;
  capsuleData[o + 5] = 0;
  capsuleData[o + 6] = logWeight(alpha);
  capsuleData[o + 7] = depth;
  capsuleCount++;
}

/**
 * Draws all queued layers into the fill mask and clears the queue.
 */
export function flushFill() {
  if (fanCount === 0 && capsuleCount === 0) return;
  const mask = Mix.mask;
  if (!mask || !Renderer?.drawingContext || Renderer.drawingContext.isContextLost?.()) {
    fanCount = capsuleCount = 0;
    polygons = [];
    dirtyRect = null;
    return;
  }
  ensureGl();

  // User space → device pixels → clip space. Row 0 of the mask is the top of
  // the canvas, matching the stroke mask and the composite shader.
  const w = mask.width * mask.density;
  const h = mask.height * mask.density;
  const [a, b, c, d, e, f] = matrix;
  const clip = new Float32Array([
    (2 * a) / w, (2 * b) / h, 0,
    (2 * c) / w, (2 * d) / h, 0,
    (2 * e) / w - 1, (2 * f) / h - 1, 1,
  ]);

  // Every write is confined to the mask's paint bounds: erasing outside
  // painted pixels cannot change the result, and the clear can then be
  // confined to the same region.
  if (dirtyRect) Mix.markDirtyRect(mask, dirtyRect);
  dirtyRect = null;
  const bounds = mask.dirtyRect;
  if (!bounds) {
    fanCount = capsuleCount = 0;
    polygons = [];
    return;
  }

  const targetState = beginDirectMaskDraw(Renderer, gl, mask);
  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  // Culling would drop the back faces that count negative winding.
  const hadCullFace = gl.isEnabled(gl.CULL_FACE);
  if (hadCullFace) gl.disable(gl.CULL_FACE);
  gl.enable(gl.BLEND);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.ONE, gl.ONE);

  if (fanCount > 0) {
    gl.useProgram(fan.program);
    gl.uniformMatrix3fv(fan.uMatrix, false, clip);
    gl.bindVertexArray(fan.vao);
    upload(fan, fanData, fanCount, FAN_WORDS);
    gl.enable(gl.STENCIL_TEST);
    gl.stencilMask(0xff);
    for (let k = 0; k < polygons.length; k += 5) {
      const first = polygons[k] * 3;
      const count = polygons[k + 1] * 3;
      const jitter = JITTER[polygons[k + 3]];
      for (const [jx, jy] of jitter) {
        gl.uniform2f(fan.uJitter, (2 * jx) / w, (2 * jy) / h);
        // Count the winding number: front faces add, back faces subtract.
        gl.colorMask(false, false, false, false);
        gl.stencilFunc(gl.ALWAYS, 0, 0xff);
        gl.stencilOpSeparate(gl.FRONT, gl.KEEP, gl.KEEP, gl.INCR_WRAP);
        gl.stencilOpSeparate(gl.BACK, gl.KEEP, gl.KEEP, gl.DECR_WRAP);
        gl.drawArrays(gl.TRIANGLES, first, count);
        // Paint where it is non-zero, once per pixel, resetting the stencil.
        gl.colorMask(true, true, true, true);
        gl.stencilFunc(gl.NOTEQUAL, 0, 0xff);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.ZERO);
        gl.uniform1f(fan.uWeight, polygons[k + 2] / jitter.length);
        gl.uniform1f(fan.uShape, polygons[k + 4]);
        gl.drawArrays(gl.TRIANGLES, first, count);
      }
    }
    gl.disable(gl.STENCIL_TEST);
  }
  if (capsuleCount > 0) {
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LESS);
    gl.depthMask(true);
    gl.useProgram(capsule.program);
    gl.uniformMatrix3fv(capsule.uMatrix, false, clip);
    gl.uniform1f(capsule.uPixel, Math.sqrt(Math.abs(a * d - b * c)));
    gl.bindVertexArray(capsule.vao);
    upload(capsule, capsuleData, capsuleCount, CAPSULE_WORDS);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, capsuleCount);
    gl.disable(gl.DEPTH_TEST);
  }

  // Restore the host's usual depth state without a synchronous query: p5
  // draws with LEQUAL and depth writes on; standalone does not use depth.
  gl.depthFunc(gl.LEQUAL);
  gl.depthMask(true);
  if (hadCullFace) gl.enable(gl.CULL_FACE);
  gl.bindVertexArray(null);
  gl.disable(gl.SCISSOR_TEST);
  endDirectMaskDraw(Renderer, gl, targetState);
  resetDirectShaderTracking(Renderer, gl);

  fanCount = capsuleCount = 0;
  polygons = [];
}

/**
 * Clears the fill mask's paint and depth. Queued layers are dropped.
 * @param {object} target - Fill mask framebuffer.
 */
export function clearFillTarget(target) {
  fanCount = capsuleCount = 0;
  polygons = [];
  dirtyRect = null;
  depth = 1;
  const context = Renderer.drawingContext;
  const state = beginDirectMaskDraw(Renderer, context, target);
  context.depthMask(true);
  context.clearColor(0, 0, 0, 0);
  context.clearDepth(1);
  context.clearStencil(0);
  context.stencilMask(0xff);
  // All writes since the last clear stayed inside the paint bounds.
  const rect = target.dirtyRect;
  if (rect) {
    context.enable(context.SCISSOR_TEST);
    context.scissor(rect.minX, rect.minY, rect.maxX - rect.minX, rect.maxY - rect.minY);
  }
  context.clear(context.COLOR_BUFFER_BIT | context.DEPTH_BUFFER_BIT | context.STENCIL_BUFFER_BIT);
  context.disable(context.SCISSOR_TEST);
  endDirectMaskDraw(Renderer, context, state);
}

// =============================================================================
// Section: Watercolour blur
// =============================================================================

// Two half-resolution half-float targets: horizontal pass, then vertical.
function ensureBlurTargets() {
  const density = Density / 2;
  const current = Renderer.fillBlurTargets;
  const fits = (t) =>
    t.width === Cwidth && t.height === Cheight &&
    (t.pixelDensity?.() ?? t.density) === density;
  if (current && current.every(fits)) return current;
  current?.forEach((t) => t.remove?.());
  Renderer.fillBlurTargets = [0, 1].map(() =>
    createFramebuffer(Renderer, {
      width: Cwidth,
      height: Cheight,
      density,
      format: "half-float",
      antialias: false,
      depth: false,
      stencil: false,
    }),
  );
  return Renderer.fillBlurTargets;
}

/**
 * Blurs the fill mask's paint bounds into a half-resolution target for the
 * watercolour composite (see blur.frag). Queued layers are drawn first.
 * @param {number} sigma - Gaussian σ in mask pixels.
 * @param {number} level - Silhouette edge level (log-domain paint).
 * @returns {object|null} The blurred target, or null when nothing is painted.
 */
export function blurFillMask(sigma, level) {
  flushFill();
  const mask = Mix.mask;
  const rect = mask?.dirtyRect;
  if (!rect || !Renderer?.drawingContext || Renderer.drawingContext.isContextLost?.()) return null;
  ensureGl();
  const targets = ensureBlurTargets();
  const maskW = mask.width * mask.density;
  const maskH = mask.height * mask.density;
  const w = Math.round(maskW / 2);
  const h = Math.round(maskH / 2);
  // Cover everything the composite reads: its rect is the paint bounds plus
  // a few pixels (composite.js), sampled bilinearly. Anything less reads a
  // previous fill's blur. The vertical pass reads the horizontal one up to
  // 3σ above and below.
  const margin = 6;
  const pad = Math.ceil((3 * sigma) / 2) + 1;
  const x0 = Math.max(0, Math.floor(rect.minX / 2) - margin);
  const x1 = Math.min(w, Math.ceil(rect.maxX / 2) + margin);
  const y0 = Math.max(0, Math.floor(rect.minY / 2) - margin);
  const y1 = Math.min(h, Math.ceil(rect.maxY / 2) + margin);
  const passes = [
    [mask, targets[0], [sigma / 4 / maskW, 0], level, Math.max(0, y0 - pad), Math.min(h, y1 + pad)],
    [targets[0], targets[1], [0, sigma / 4 / maskH], 0, y0, y1],
  ];

  gl.disable(gl.BLEND);
  gl.enable(gl.SCISSOR_TEST);
  gl.useProgram(blur.program);
  gl.bindVertexArray(blur.vao);
  gl.uniform1i(blur.u_src, 0);
  gl.uniform2f(blur.u_dstSize, w, h);
  gl.activeTexture(gl.TEXTURE0);
  for (const [src, dst, step, passLevel, py0, py1] of passes) {
    const state = beginDirectMaskDraw(Renderer, gl, dst);
    gl.scissor(x0, py0, x1 - x0, py1 - py0);
    gl.bindTexture(gl.TEXTURE_2D, src.colorTexture);
    gl.uniform2f(blur.u_step, step[0], step[1]);
    gl.uniform1f(blur.u_level, passLevel);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindTexture(gl.TEXTURE_2D, null);
    endDirectMaskDraw(Renderer, gl, state);
  }
  gl.disable(gl.SCISSOR_TEST);
  gl.enable(gl.BLEND);
  gl.bindVertexArray(null);
  resetDirectShaderTracking(Renderer, gl);
  return targets[1];
}
