// =============================================================================
// Adapter: Standalone Renderer Hooks
// =============================================================================

import { Cwidth, Cheight, Density } from "../../core/target.js";
import { setRendererRuntime } from "../../core/renderer_runtime.js";

function beginDirectMaskDraw(_renderer, gl, target) {
  const hadDepthTest = gl.isEnabled(gl.DEPTH_TEST);
  if (hadDepthTest) gl.disable(gl.DEPTH_TEST);

  gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
  gl.viewport(0, 0, target.width * target.density, target.height * target.density);

  return { hadDepthTest };
}

function endDirectMaskDraw(renderer, gl, state) {
  if (state?.hadDepthTest) gl.enable(gl.DEPTH_TEST);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(
    0,
    0,
    Math.max(1, Math.round(Cwidth * Density)),
    Math.max(1, Math.round(Cheight * Density)),
  );
}

function resetStandaloneShaderTracking(_renderer, gl) {
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.blendEquation(gl.FUNC_ADD);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
}

export function initStandaloneRendererRuntime() {
  setRendererRuntime({
    beginDirectMaskDraw,
    endDirectMaskDraw,
    resetDirectShaderTracking: resetStandaloneShaderTracking,
  });
}
