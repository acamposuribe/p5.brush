// =============================================================================
// Renderer Runtime Hooks
// =============================================================================

/**
 * Direct-render hooks used by modules that issue raw WebGL commands.
 *
 * These hooks are intentionally narrow:
 * - begin drawing into an offscreen GL mask target
 * - restore the previous draw target afterward
 * - reset any host-side shader/program bookkeeping after direct GL usage
 */

let rendererRuntime = {
  beginDirectMaskDraw: () => {
    throw new Error("No renderer runtime adapter registered.");
  },
  endDirectMaskDraw: () => {
    throw new Error("No renderer runtime adapter registered.");
  },
  resetDirectShaderTracking: () => {},
};

/**
 * Registers or updates host renderer hooks used by direct WebGL drawing paths.
 *
 * @param {object} hooks
 */
export function setRendererRuntime(hooks) {
  rendererRuntime = { ...rendererRuntime, ...hooks };
}

export const beginDirectMaskDraw = (renderer, gl, target) =>
  rendererRuntime.beginDirectMaskDraw(renderer, gl, target);
export const endDirectMaskDraw = (renderer, gl, state) =>
  rendererRuntime.endDirectMaskDraw(renderer, gl, state);
export const resetDirectShaderTracking = (renderer, gl) =>
  rendererRuntime.resetDirectShaderTracking(renderer, gl);
