// =============================================================================
// Adapter: Standalone image()
// =============================================================================

import { Renderer, Cwidth, Cheight, Density, isCanvasReady } from "../../core/target.js";
import { getAffineMatrix } from "../../core/runtime.js";
import { createProgram } from "../../core/gl/utils.js";
import { render } from "./frame.js";

// One quad from gl_VertexID; u_x / u_y map image uv (0..1, y down) to clip space.
const vertSrc = `#version 300 es
uniform vec3 u_x;
uniform vec3 u_y;
out vec2 v_uv;
void main() {
  v_uv = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  vec3 uv = vec3(v_uv, 1.0);
  gl_Position = vec4(dot(u_x, uv), dot(u_y, uv), 0.0, 1.0);
}`;

// Textures are uploaded premultiplied, matching the premultiplied canvas.
const fragSrc = `#version 300 es
precision highp float;
uniform sampler2D u_image;
in vec2 v_uv;
out vec4 outColor;
void main() {
  outColor = texture(u_image, v_uv);
}`;

const isImmutable = (source) =>
  (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) ||
  (typeof HTMLImageElement !== "undefined" && source instanceof HTMLImageElement);

function sourceSize(source) {
  if (typeof HTMLImageElement !== "undefined" && source instanceof HTMLImageElement) {
    if (!source.complete || !source.naturalWidth) {
      throw new Error("brush.image() needs a loaded HTMLImageElement.");
    }
    return [source.naturalWidth, source.naturalHeight];
  }
  const supported =
    (typeof HTMLCanvasElement !== "undefined" && source instanceof HTMLCanvasElement) ||
    (typeof OffscreenCanvas !== "undefined" && source instanceof OffscreenCanvas) ||
    (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) ||
    (typeof ImageData !== "undefined" && source instanceof ImageData);
  if (!supported) {
    throw new Error(
      "brush.image() takes an HTMLCanvasElement, OffscreenCanvas, ImageBitmap, HTMLImageElement or ImageData.",
    );
  }
  return [source.width, source.height];
}

function getResources(renderer) {
  if (renderer.imageResources) return renderer.imageResources;
  const gl = renderer.drawingContext;
  const program = createProgram(gl, vertSrc, fragSrc);
  renderer.imageResources = {
    program,
    vao: gl.createVertexArray(),
    loc_x: gl.getUniformLocation(program, "u_x"),
    loc_y: gl.getUniformLocation(program, "u_y"),
    loc_image: gl.getUniformLocation(program, "u_image"),
    // Immutable sources keep their texture; it goes when the source is collected.
    cache: new WeakMap(),
    // Mutable sources share one texture, re-uploaded on every call.
    scratch: null,
    scratchWidth: 0,
    scratchHeight: 0,
  };
  return renderer.imageResources;
}

function createTexture(gl) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

const upload = (gl, source) =>
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

// Binds the source's texture on the active unit, uploading it when needed.
function bindSourceTexture(gl, res, source, width, height) {
  if (isImmutable(source)) {
    const cached = res.cache.get(source);
    if (cached) {
      gl.bindTexture(gl.TEXTURE_2D, cached);
      return;
    }
    const texture = createTexture(gl);
    upload(gl, source);
    res.cache.set(source, texture);
    return;
  }
  if (res.scratch && res.scratchWidth === width && res.scratchHeight === height) {
    gl.bindTexture(gl.TEXTURE_2D, res.scratch);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source);
    return;
  }
  res.scratch ??= createTexture(gl);
  gl.bindTexture(gl.TEXTURE_2D, res.scratch);
  upload(gl, source);
  res.scratchWidth = width;
  res.scratchHeight = height;
}

/**
 * Draws a picture onto the active standalone canvas, source-over, in order
 * with brush drawing: pending strokes and fills are flushed first, and later
 * ones mix into it.
 *
 * Position and size are in brush coordinates under the current transform.
 * ImageBitmap and HTMLImageElement textures are cached per object; canvases
 * and ImageData are uploaded on every call.
 *
 * @param {HTMLCanvasElement|OffscreenCanvas|ImageBitmap|HTMLImageElement|ImageData} source
 * @param {number} x
 * @param {number} y
 * @param {number} [width] Defaults to the source width.
 * @param {number} [height] Defaults to the source height.
 */
export function image(source, x, y, width, height) {
  isCanvasReady();
  const [sourceWidth, sourceHeight] = sourceSize(source);
  if (!sourceWidth || !sourceHeight) return;
  width ??= sourceWidth;
  height ??= sourceHeight;
  render();

  const gl = Renderer.drawingContext;
  const res = getResources(Renderer);

  // Brush coords -> device px (as fills do) -> clip space, as a function of uv.
  const m = getAffineMatrix();
  const pixelWidth = Math.max(1, Math.round(Cwidth * Density));
  const pixelHeight = Math.max(1, Math.round(Cheight * Density));
  const sx = (2 * Density) / pixelWidth;
  const sy = (-2 * Density) / pixelHeight;
  const ox = m.a * x + m.c * y + m.x + Cwidth / 2;
  const oy = m.b * x + m.d * y + m.y + Cheight / 2;

  const saved = {
    program: gl.getParameter(gl.CURRENT_PROGRAM),
    vao: gl.getParameter(gl.VERTEX_ARRAY_BINDING),
    drawFramebuffer: gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING),
    activeTexture: gl.getParameter(gl.ACTIVE_TEXTURE),
    viewport: gl.getParameter(gl.VIEWPORT),
    blend: gl.isEnabled(gl.BLEND),
    scissor: gl.isEnabled(gl.SCISSOR_TEST),
    depth: gl.isEnabled(gl.DEPTH_TEST),
    flipY: gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL),
    premultiply: gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL),
    colorspace: gl.getParameter(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL),
  };
  gl.activeTexture(gl.TEXTURE0);
  saved.texture = gl.getParameter(gl.TEXTURE_BINDING_2D);

  try {
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.BROWSER_DEFAULT_WEBGL);
    bindSourceTexture(gl, res, source, sourceWidth, sourceHeight);

    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    gl.viewport(0, 0, pixelWidth, pixelHeight);
    gl.disable(gl.SCISSOR_TEST);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.FUNC_ADD);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(res.program);
    gl.bindVertexArray(res.vao);
    gl.uniform1i(res.loc_image, 0);
    gl.uniform3f(res.loc_x, sx * m.a * width, sx * m.c * height, sx * ox - 1);
    gl.uniform3f(res.loc_y, sy * m.b * width, sy * m.d * height, sy * oy + 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  } finally {
    gl.bindTexture(gl.TEXTURE_2D, saved.texture);
    gl.activeTexture(saved.activeTexture);
    gl.bindVertexArray(saved.vao);
    gl.useProgram(saved.program);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, saved.drawFramebuffer);
    gl.viewport(...saved.viewport);
    // The blend function stays premultiplied over, the renderer's default:
    // every draw sets its own, and querying it would stall on the GPU.
    if (saved.blend) gl.enable(gl.BLEND);
    else gl.disable(gl.BLEND);
    if (saved.scissor) gl.enable(gl.SCISSOR_TEST);
    if (saved.depth) gl.enable(gl.DEPTH_TEST);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, saved.flipY);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, saved.premultiply);
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, saved.colorspace);
  }
}
