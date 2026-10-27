// =============================================================================
// Adapter: Standalone Compositor Hooks
// =============================================================================

import { createProgram } from "../../core/gl/utils.js";
import {
  setCompositorRuntime,
  blitDefaultFramebufferSource,
} from "../../core/compositor_runtime.js";

function clearTarget(renderer, target, isFramebufferTarget, rect = null) {
  if (!target) return;

  if (isFramebufferTarget(target)) {
    const gl = renderer.drawingContext;
    const previousFramebuffer = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING);
    // Clears ignore the viewport. Bind only DRAW so READ state stays untouched.
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, target.framebuffer);
    const hadScissor = rect && gl.isEnabled(gl.SCISSOR_TEST);
    const previousScissor = hadScissor ? gl.getParameter(gl.SCISSOR_BOX) : null;
    if (rect) {
      gl.enable(gl.SCISSOR_TEST);
      gl.scissor(rect.minX, rect.minY, rect.maxX - rect.minX, rect.maxY - rect.minY);
    }
    try {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    } finally {
      if (rect) {
        if (hadScissor) gl.scissor(...previousScissor);
        else gl.disable(gl.SCISSOR_TEST);
      }
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, previousFramebuffer);
    }
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

  // Persistent VAO for fullscreen-triangle draws (avoids create/delete per pass)
  const quadVao = gl.createVertexArray();

  const getUniformLocation = (name) => {
    if (!uniformCache.has(name)) {
      uniformCache.set(name, gl.getUniformLocation(program, name));
    }
    return uniformCache.get(name);
  };

  // Pre-cache sampler and color uniform locations (called every blend pass)
  const loc_source = gl.getUniformLocation(program, "u_source");
  const loc_mask = gl.getUniformLocation(program, "u_mask");
  const loc_color = gl.getUniformLocation(program, "u_color");
  const loc_pigmentKS = gl.getUniformLocation(program, "u_pigmentKS");
  const loc_pigmentLuminance = gl.getUniformLocation(program, "u_pigmentLuminance");

  return {
    program,
    quadVao,
    loc_source,
    loc_mask,
    loc_color,
    loc_pigmentKS,
    loc_pigmentLuminance,
    setUniform(name, value) {
      const location = getUniformLocation(name);
      if (!location) return;
      // Extra textures go on unit 2; units 0 and 1 hold the source and mask.
      if (value?.colorTexture) {
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, value.colorTexture);
        gl.uniform1i(location, 2);
        gl.activeTexture(gl.TEXTURE0);
        return;
      }
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

function ensureBlendShaderProgram(renderer, vertSrc, fragSrc, brushFragSrc, watercolorFragSrc) {
  renderer.shaderProgram ??= makeShader(renderer.drawingContext, vertSrc, fragSrc);
  renderer.brushShaderProgram ??= makeShader(renderer.drawingContext, vertSrc, brushFragSrc);
  renderer.watercolorShaderProgram ??= makeShader(renderer.drawingContext, vertSrc, watercolorFragSrc);
  renderer.loaded = true;
}

function createFramebufferTexture(gl, width, height, halfFloat = false) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    halfFloat ? gl.RGBA16F : gl.RGBA,
    width,
    height,
    0,
    gl.RGBA,
    halfFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE,
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
  const halfFloat = options.format === "half-float";
  // Rendering to half-float textures needs this extension in WebGL2.
  if (halfFloat && !gl.getExtension("EXT_color_buffer_float")) {
    throw new Error("p5.brush fills need WebGL2 with EXT_color_buffer_float.");
  }
  const colorTexture = createFramebufferTexture(gl, pixelWidth, pixelHeight, halfFloat);
  let depthBuffer = null;

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    colorTexture,
    0,
  );
  if (options.depth) {
    const stencil = !!options.stencil;
    depthBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
    gl.renderbufferStorage(
      gl.RENDERBUFFER,
      stencil ? gl.DEPTH24_STENCIL8 : gl.DEPTH_COMPONENT24,
      pixelWidth,
      pixelHeight,
    );
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.framebufferRenderbuffer(
      gl.FRAMEBUFFER,
      stencil ? gl.DEPTH_STENCIL_ATTACHMENT : gl.DEPTH_ATTACHMENT,
      gl.RENDERBUFFER,
      depthBuffer,
    );
  }
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
      if (depthBuffer) gl.deleteRenderbuffer(depthBuffer);
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
  pigment,
  uniforms,
  dirtyRect,
  targetIsFramebuffer,
  withScissor,
}) {
  const gl = renderer.drawingContext;
  const hadDepthTest = gl.isEnabled(gl.DEPTH_TEST);
  const previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
  const previousProgram = gl.getParameter(gl.CURRENT_PROGRAM);
  const previousVao = gl.getParameter(gl.VERTEX_ARRAY_BINDING);

  gl.bindVertexArray(shader.quadVao);
  gl.useProgram(shader.program);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, source.colorTexture);
  gl.uniform1i(shader.loc_source, 0);

  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, mask.colorTexture);
  gl.uniform1i(shader.loc_mask, 1);

  shader.setUniform("u_targetIsFramebuffer", targetIsFramebuffer);
  gl.uniform3f(shader.loc_color, color[0], color[1], color[2]);
  gl.uniform1fv(shader.loc_pigmentKS, pigment.ks);
  gl.uniform1f(shader.loc_pigmentLuminance, pigment.luminance);
  if (uniforms) for (const name in uniforms) shader.setUniform(name, uniforms[name]);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  withScissor(
    gl,
    dirtyRect,
    () => {
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    !targetIsFramebuffer,
  );

  // Unbind the mask (unit 1) and any extra texture (unit 2).
  for (const unit of [gl.TEXTURE2, gl.TEXTURE1]) {
    gl.activeTexture(unit);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }
  gl.activeTexture(gl.TEXTURE0);
  gl.bindVertexArray(previousVao);
  gl.useProgram(previousProgram);
  gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer);
  if (hadDepthTest) gl.enable(gl.DEPTH_TEST);
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
