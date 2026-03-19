// =============================================================================
// Adapter: p5 Renderer Hooks
// =============================================================================

import { setRendererRuntime } from "../../core/renderer_runtime.js";

function getFramebufferHandle(target) {
  if (!target) return null;
  if (typeof target._framebufferToBind === "function") return target._framebufferToBind();
  return target.framebuffer ?? null;
}

function beginDirectMaskDraw(renderer, gl, target) {
  const hadDepthTest = gl.isEnabled(gl.DEPTH_TEST);
  if (hadDepthTest) gl.disable(gl.DEPTH_TEST);

  const previousTarget = renderer._renderer.activeFramebuffer?.() ?? null;
  if (previousTarget?._beforeEnd) previousTarget._beforeEnd();

  gl.bindFramebuffer(gl.FRAMEBUFFER, getFramebufferHandle(target));
  gl.viewport(0, 0, target.width * target.density, target.height * target.density);

  return { hadDepthTest, previousTarget };
}

function endDirectMaskDraw(renderer, gl, state) {
  if (state?.hadDepthTest) gl.enable(gl.DEPTH_TEST);

  if (state?.previousTarget?._beforeBegin) {
    state.previousTarget._beforeBegin();
    return;
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  renderer._renderer.viewport(
    renderer._renderer._origViewport.width,
    renderer._renderer._origViewport.height,
  );
  renderer._renderer._applyStencilTestIfClipping?.();
}

function resetP5ShaderTracking(renderer, gl) {
  const coreRenderer = renderer?._renderer;
  if (!coreRenderer) return;
  coreRenderer._curShader = null;
  coreRenderer._cachedBlendMode = null;
  coreRenderer._isBlending = null;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
}

export function initP5RendererRuntime() {
  setRendererRuntime({
    beginDirectMaskDraw,
    endDirectMaskDraw,
    resetDirectShaderTracking: resetP5ShaderTracking,
  });
}
