// =============================================================================
// Module: Wash
// =============================================================================
/**
 * Minimal stateful API for the `wash()` fill modifier.
 */

import earcut from "earcut";
import { Renderer, Cwidth, Cheight, isCanvasReady } from "../core/target.js";
import { State, flushActiveComposite } from "../core/color.js";
import { Polygon } from "../core/polygon.js";
import { Plot } from "../core/plot.js";
import { Matrix } from "../core/flowfield.js";
import { createProgram } from "../core/gl/utils.js";
import { createColor } from "../core/runtime.js";
import { resetDirectShaderTracking } from "../core/renderer_runtime.js";

let gl = null;
let washProgram = null;
let washVao = null;
let washBuffer = null;
let washProjection = null;
let loadedWidth = 0;
let loadedHeight = 0;
let washGpuBufferSize = 0;

const WashAttr = {};
const WashUniform = {};

const washVertSrc = `#version 300 es
in vec2 a_position;
uniform mat4 u_matrix;
void main() {
  gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);
}`;

const washFragSrc = `#version 300 es
precision highp float;
uniform vec4 u_color;
out vec4 outColor;
void main() {
  outColor = vec4(u_color.rgb * u_color.a, u_color.a);
}`;

State.wash = {
  color: null,
  opacity: 150,
  isActive: false,
};

// =============================================================================
// Public API
// =============================================================================

/**
 * Enables wash mode with a color and opacity.
 *
 * @param {number|string|Color} a - Either the red component, a CSS color string, or a Color object.
 * @param {number} [b] - The green component or the opacity if using grayscale.
 * @param {number} [c] - The blue component.
 * @param {number} [d] - The opacity.
 */
export function wash(a, b, c, d) {
  isCanvasReady();
  State.wash.opacity = (arguments.length < 4 ? b : d) ?? 150;
  State.wash.color = arguments.length < 3 ? createColor(a) : createColor(a, b, c);
  State.wash.isActive = true;
}

/**
 * Disables wash mode for subsequent drawing operations.
 */
export function noWash() {
  State.wash.isActive = false;
}

// =============================================================================
// GL helpers
// =============================================================================

/**
 * Lazily creates the reusable program/buffer state for solid wash drawing and
 * refreshes the orthographic projection when the active target size changes.
 */
function ensureWashReady() {
  const nextGl = Renderer.drawingContext;
  const sizeChanged = loadedWidth !== Cwidth || loadedHeight !== Cheight;

  if (!washProjection || sizeChanged) {
    loadedWidth = Cwidth;
    loadedHeight = Cheight;
    washProjection = new Float32Array([
      2 / loadedWidth,
      0,
      0,
      0,
      0,
      -2 / loadedHeight,
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
  }

  if (gl === nextGl && washProgram && washVao && washBuffer) return;

  gl = nextGl;
  washProgram = createProgram(gl, washVertSrc, washFragSrc);
  WashAttr.a_position = gl.getAttribLocation(washProgram, "a_position");
  WashUniform.u_matrix = gl.getUniformLocation(washProgram, "u_matrix");
  WashUniform.u_color = gl.getUniformLocation(washProgram, "u_color");

  washVao = gl.createVertexArray();
  gl.bindVertexArray(washVao);

  washBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, washBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, 0, gl.DYNAMIC_DRAW);
  washGpuBufferSize = 0;

  gl.enableVertexAttribArray(WashAttr.a_position);
  gl.vertexAttribPointer(WashAttr.a_position, 2, gl.FLOAT, false, 8, 0);

  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
}

/**
 * Applies the current runtime affine transform and converts the result into
 * the screen-space coordinates used by the direct GL wash pipeline.
 *
 * @param {number} x - The source x-coordinate in brush drawing space.
 * @param {number} y - The source y-coordinate in brush drawing space.
 * @returns {[number, number]} The transformed screen-space position.
 */
function transformVertexToScreen(x, y) {
  return [
    Matrix.a() * x + Matrix.c() * y + Matrix.x() + loadedWidth / 2,
    Matrix.b() * x + Matrix.d() * y + Matrix.y() + loadedHeight / 2,
  ];
}

/**
 * Triangulates a polygon in local space and returns the transformed triangle
 * vertex buffer ready for upload to the GPU.
 *
 * @param {Polygon} polygon - The polygon to triangulate.
 * @returns {{ triangles: Float32Array, vertexCount: number }} Screen-space
 * triangle vertices plus the number of vertices to draw.
 */
function buildTriangleBuffer(polygon) {
  const flat = new Float32Array(polygon.vertices.length * 2);
  for (let i = 0; i < polygon.vertices.length; i++) {
    const vertex = polygon.vertices[i];
    flat[i * 2] = vertex.x;
    flat[i * 2 + 1] = vertex.y;
  }

  const indices = earcut(flat);
  const triangles = new Float32Array(indices.length * 2);
  for (let i = 0; i < indices.length; i++) {
    const idx = indices[i];
    const [screenX, screenY] = transformVertexToScreen(flat[idx * 2], flat[idx * 2 + 1]);
    triangles[i * 2] = screenX;
    triangles[i * 2 + 1] = screenY;
  }

  return {
    triangles,
    vertexCount: indices.length,
  };
}

/**
 * Draws a triangulated solid wash directly to the current GL target.
 *
 * @param {Polygon} polygon - The polygon to fill with the current wash state.
 */
function drawWashPolygon(polygon) {
  if (!State.wash?.isActive || !State.wash.color || polygon.vertices.length < 3) return;

  flushActiveComposite();
  ensureWashReady();
  const { triangles, vertexCount } = buildTriangleBuffer(polygon);
  const byteCount = triangles.byteLength;
  gl.useProgram(washProgram);
  gl.enable(gl.BLEND);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.bindVertexArray(washVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, washBuffer);
  if (byteCount > washGpuBufferSize) {
    gl.bufferData(gl.ARRAY_BUFFER, triangles, gl.DYNAMIC_DRAW);
    washGpuBufferSize = byteCount;
  } else {
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, triangles);
  }
  const color = State.wash.color._array;
  gl.uniformMatrix4fv(WashUniform.u_matrix, false, washProjection);
  gl.uniform4f(
    WashUniform.u_color,
    color[0],
    color[1],
    color[2],
    State.wash.opacity / 255,
  );

  gl.drawArrays(gl.TRIANGLES, 0, vertexCount);
  gl.bindVertexArray(null);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  resetDirectShaderTracking(Renderer, gl);
}

// =============================================================================
// Prototype methods
// =============================================================================

/**
 * Applies a direct GL wash fill to the polygon using the current wash state.
 *
 * @param {Color|string|false} [_color] - Optional override color for this call.
 * @param {number} [_opacity] - Optional override opacity for this call.
 */
Polygon.prototype.wash = function (_color = false, _opacity) {
  const state = { ...State.wash };
  if (_color !== false) wash(_color, _opacity);

  if (State.wash.isActive) {
    drawWashPolygon(this);
  }

  State.wash = { ...state };
};

/**
 * Applies wash to a plot by first generating the plot polygon, mirroring the
 * existing fill-path behavior, and then drawing that polygon with wash.
 *
 * @param {number} x - The x-coordinate.
 * @param {number} y - The y-coordinate.
 * @param {number} scale - The scale factor.
 */
Plot.prototype.wash = function (x, y, scale) {
  if (!State.wash?.isActive) return;
  if (this.origin) {
    x = this.origin[0];
    y = this.origin[1];
    scale = 1;
  }
  this.pol = this.genPol(x, y, scale, 0, -1);
  this.pol.wash();
};
