// =============================================================================
// Adapter: Standalone Compositor Hooks
// =============================================================================

import { createProgram } from "../../core/gl/utils.js";
import {
  setCompositorRuntime,
  blitDefaultFramebufferSource,
} from "../../core/compositor_runtime.js";

function clearTarget(renderer, target, isFramebufferTarget) {
  if (!target) return;

  if (isFramebufferTarget(target)) {
    const gl = renderer.drawingContext;
    const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    const previousViewport = gl.getParameter(gl.VIEWPORT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
    gl.viewport(0, 0, target.width * target.density, target.height * target.density);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer);
    gl.viewport(
      previousViewport[0],
      previousViewport[1],
      previousViewport[2],
      previousViewport[3],
    );
    return;
  }

  const ctx = target.drawingContext;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.restore();
}

function makeShader(gl, vertSrc, fragSrc) {
  const program = createProgram(gl, vertSrc, fragSrc);
  const uniformCache = new Map();

  const getUniformLocation = (name) => {
    if (!uniformCache.has(name)) {
      uniformCache.set(name, gl.getUniformLocation(program, name));
    }
    return uniformCache.get(name);
  };

  return {
    program,
    setUniform(name, value) {
      const location = getUniformLocation(name);
      if (!location) return;
      if (typeof value === "boolean") {
        gl.uniform1i(location, value ? 1 : 0);
        return;
      }
      if (typeof value === "number") {
        gl.uniform1f(location, value);
        return;
      }
      if (Array.isArray(value)) {
        if (value.length === 3) gl.uniform3f(location, value[0], value[1], value[2]);
        else if (value.length === 4) gl.uniform4f(location, value[0], value[1], value[2], value[3]);
        return;
      }
    },
  };
}

function ensureBlendShaderProgram(renderer, vertSrc, fragSrc) {
  renderer.shaderProgram ??= makeShader(renderer.drawingContext, vertSrc, fragSrc);
  return renderer.shaderProgram;
}

function createFramebufferTexture(gl, width, height) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}

function createFramebuffer(renderer, options) {
  const gl = renderer.drawingContext;
  const density = options.density ?? 1;
  const framebuffer = gl.createFramebuffer();
  const width = Math.max(1, options.width);
  const height = Math.max(1, options.height);
  const pixelWidth = Math.max(1, Math.round(width * density));
  const pixelHeight = Math.max(1, Math.round(height * density));
  const colorTexture = createFramebufferTexture(gl, pixelWidth, pixelHeight);

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    colorTexture,
    0,
  );
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return {
    __brushFramebuffer: true,
    framebuffer,
    colorTexture,
    width,
    height,
    density,
    pixelDensity: () => density,
    remove() {
      gl.deleteFramebuffer(framebuffer);
      gl.deleteTexture(colorTexture);
    },
  };
}

function ensureBlendSourceFramebuffer(
  renderer,
  currentFramebuffer,
  width,
  height,
  density,
) {
  currentFramebuffer?.remove?.();
  return createFramebuffer(renderer, {
    width,
    height,
    density,
    antialias: false,
    depth: false,
    stencil: false,
  });
}

function runBlendShaderPass({
  renderer,
  shader,
  source,
  mask,
  color,
  isBrushMask,
  dirtyRect,
  targetIsFramebuffer,
  withScissor,
}) {
  const gl = renderer.drawingContext;
  const hadDepthTest = gl.isEnabled(gl.DEPTH_TEST);
  const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
  const previousProgram = gl.getParameter(gl.CURRENT_PROGRAM);
  const previousVao = gl.getParameter(gl.VERTEX_ARRAY_BINDING);

  const quadVao = gl.createVertexArray();
  gl.bindVertexArray(quadVao);
  gl.useProgram(shader.program);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, source.colorTexture);
  gl.uniform1i(gl.getUniformLocation(shader.program, "u_source"), 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, mask.colorTexture);
  gl.uniform1i(gl.getUniformLocation(shader.program, "u_mask"), 1);

  shader.setUniform("u_targetIsFramebuffer", targetIsFramebuffer);
  shader.setUniform("u_isBrush", isBrushMask);
  gl.uniform3f(
    gl.getUniformLocation(shader.program, "u_color"),
    color[0],
    color[1],
    color[2],
  );

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  withScissor(
    gl,
    dirtyRect,
    () => {
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    !targetIsFramebuffer,
  );

  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindVertexArray(previousVao);
  gl.useProgram(previousProgram);
  gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer);
  if (hadDepthTest) gl.enable(gl.DEPTH_TEST);
  gl.deleteVertexArray(quadVao);
}

function blitSourceToFramebuffer(args) {
  return blitDefaultFramebufferSource(args);
}

export function initStandaloneCompositorRuntime() {
  setCompositorRuntime({
    clearTarget,
    ensureBlendShaderProgram,
    ensureBlendSourceFramebuffer,
    createFramebuffer,
    runBlendShaderPass,
    blitSourceToFramebuffer,
  });
}
