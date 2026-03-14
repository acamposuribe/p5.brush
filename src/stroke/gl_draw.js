// =============================================================================
// Module: GL Draw
// =============================================================================
/**
 * The GL Draw module provides functions for rendering shapes (circles and squares)
 * using WebGL2. It initializes the WebGL context and shader programs, prepares buffers,
 * and implements drawing routines based on queued drawing primitives. The module uses
 * an orthographic projection to map canvas coordinates to clip space and supports adjustable
 * blending for translucent effects.
 */

import {
  Mix,
  Cwidth,
  Cheight,
  isMixReady,
  Density,
  State,
} from "../core/color.js";
import { Matrix } from "../core/flowfield.js";
import { createProgram } from "../core/gl/utils.js";
import vertSrc from "./shader.vert";
import fragSrc from "./shader.frag";

// =============================================================================
// Section: Initialization and Setup
// =============================================================================

// Module state
let isLoaded = false,
  gl,
  projMatrix,
  vao,
  buf,
  program;
let loadedWidth = 0,
  loadedHeight = 0;
const Attr = {},
  Frag = {};

// Cached matrix values — snapshotted once per stroke in snapshotMatrix()
let _ma = 1,
  _mb = 0,
  _mc = 0,
  _md = 1,
  _mx = 0,
  _my = 0;

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
}

// Pre-allocated flat buffer for circle data (x, y, radius, alpha per circle)
const INITIAL_CAPACITY = 2048;
let circleData = new Float32Array(INITIAL_CAPACITY * 4);
let circleCount = 0;
let bufferCapacity = INITIAL_CAPACITY;
let gpuBufferSize = INITIAL_CAPACITY * 4 * 4; // bytes allocated on GPU

/**
 * Initializes WebGL objects if not done already.
 */
export function isReady() {
  isMixReady();

  const nextGl = Mix.glMask.drawingContext;
  const needsContextRefresh = !isLoaded || gl !== nextGl;
  const needsProjectionRefresh =
    needsContextRefresh || loadedWidth !== Cwidth || loadedHeight !== Cheight;

  if (needsProjectionRefresh) {
    projMatrix = new Float32Array([
      2 / Cwidth,
      0,
      0,
      0,
      0,
      -2 / Cheight,
      0,
      0,
      0,
      0,
      1,
      0,
      -1,
      1,
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
  const px = x - Cwidth / 2;
  const py = y - Cheight / 2;

  const offset = circleCount * 4;
  circleData[offset] = _ma * px + _mc * py + _mx + Cwidth / 2;
  circleData[offset + 1] = _mb * px + _md * py + _my + Cheight / 2;
  // Scale the diameter by the matrix's scale factor (length of the transformed x-axis)
  circleData[offset + 2] =
    (Density * diameter * Math.sqrt(_ma * _ma + _mb * _mb)) / 2;
  circleData[offset + 3] = alpha / 255;
  circleCount++;
}

/**
 * Draw all queued circles using WebGL
 */
export function glDraw() {
  if (circleCount === 0) return;

  Mix.glMask.isDrawn = true;

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
  gl.uniformMatrix4fv(Frag.u_matrix, false, projMatrix);
  gl.drawArrays(gl.POINTS, 0, circleCount);

  gl.bindVertexArray(null);

  // Reset queue (no deallocation)
  circleCount = 0;

  // We called gl.useProgram() directly, bypassing p5's _curShader tracking.
  // Reset it to null so p5 is forced to re-activate its own shader next time
  // it draws — otherwise p5 skips gl.useProgram() and sets uniforms on the
  // wrong active program, causing "location is not from the associated program".
  Mix.glMask._renderer._curShader = null;
}
