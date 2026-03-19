// =============================================================================
// Compositor Runtime Hooks
// =============================================================================

/**
 * Shared compositor helpers and host hooks.
 *
 * The shared code in this module assumes framebuffer-like targets expose:
 * - `framebuffer`: native WebGL framebuffer handle
 * - optional lifecycle methods supplied by the host adapter
 *
 * Higher-level core modules also attach their own bookkeeping fields onto the
 * active renderer and mask targets, such as:
 * - `shaderProgram`
 * - `blendSourceFramebuffer`
 * - `glMask`
 * - `fillMaskFramebuffer`
 * - `mask`
 *
 * These are library-level contract fields, not host-specific internals.
 */

export const create2DCanvas = (width, height, willReadFrequently = false) => {
  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(width, height)
      : (() => {
          const element = document.createElement("canvas");
          element.width = width;
          element.height = height;
          return element;
        })();
  canvas.drawingContext = canvas.getContext(
    "2d",
    willReadFrequently ? { willReadFrequently: true } : undefined,
  );
  return canvas;
};

export const get2DContext = (canvas, willReadFrequently = false) => {
  canvas.drawingContext ??= canvas.getContext(
    "2d",
    willReadFrequently ? { willReadFrequently: true } : undefined,
  );
  return canvas.drawingContext;
};

export function blitDefaultFramebufferSource({
  renderer,
  sourceFramebuffer,
  dirtyRect,
  getTargetPixelSize,
  toScissorBox,
}) {
  const gl = renderer.drawingContext;
  const { width, height } = getTargetPixelSize();
  const sourceBox = dirtyRect ? toScissorBox(dirtyRect) : null;
  const previousReadFramebuffer = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
  const previousDrawFramebuffer = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING);

  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, sourceFramebuffer.framebuffer);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.blitFramebuffer(
    sourceBox?.x ?? 0,
    sourceBox?.y ?? 0,
    sourceBox ? sourceBox.x + sourceBox.width : width,
    sourceBox ? sourceBox.y + sourceBox.height : height,
    sourceBox?.x ?? 0,
    sourceBox?.y ?? 0,
    sourceBox ? sourceBox.x + sourceBox.width : width,
    sourceBox ? sourceBox.y + sourceBox.height : height,
    gl.COLOR_BUFFER_BIT,
    gl.NEAREST,
  );

  gl.bindFramebuffer(gl.READ_FRAMEBUFFER, previousReadFramebuffer);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, previousDrawFramebuffer);

  return sourceFramebuffer;
}

let compositorRuntime = {
  clearTarget: () => {
    throw new Error("No compositor runtime adapter registered.");
  },
  ensureBlendShaderProgram: () => {
    throw new Error("No compositor runtime adapter registered.");
  },
  ensureBlendSourceFramebuffer: () => {
    throw new Error("No compositor runtime adapter registered.");
  },
  createFramebuffer: () => {
    throw new Error("No compositor runtime adapter registered.");
  },
  runBlendShaderPass: () => {
    throw new Error("No compositor runtime adapter registered.");
  },
  blitSourceToFramebuffer: () => {
    throw new Error("No compositor runtime adapter registered.");
  },
};

/**
 * Registers or updates host compositor hooks used by core compositing code.
 *
 * @param {object} hooks
 */
export function setCompositorRuntime(hooks) {
  compositorRuntime = { ...compositorRuntime, ...hooks };
}

export const clearTarget = (...args) => compositorRuntime.clearTarget(...args);
export const ensureBlendShaderProgram = (...args) =>
  compositorRuntime.ensureBlendShaderProgram(...args);
export const ensureBlendSourceFramebuffer = (...args) =>
  compositorRuntime.ensureBlendSourceFramebuffer(...args);
export const createFramebuffer = (...args) =>
  compositorRuntime.createFramebuffer(...args);
export const runBlendShaderPass = (...args) =>
  compositorRuntime.runBlendShaderPass(...args);
export const blitSourceToFramebuffer = (...args) =>
  compositorRuntime.blitSourceToFramebuffer(...args);
