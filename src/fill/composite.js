import * as Color from "../core/color.js";
import {
  createFramebuffer,
  create2DCanvas,
  get2DContext,
} from "../core/compositor_runtime.js";

// Small staging canvas used to upload only the dirty fill sub-rect into the
// framebuffer-backed mask mirror consumed by the blend shader.
let FillMaskUploadCanvas = null;
let isFillCompositeRegistered = false;
const DIRTY_FILL_PADDING = 4;

// =============================================================================
// Section: Helpers
// =============================================================================
/**
 * Returns whether the CPU-side 2D fill mask must be recreated.
 *
 * @param {object} Renderer - Active host renderer.
 * @param {number} maskWidth - Mask width in physical pixels.
 * @param {number} maskHeight - Mask height in physical pixels.
 * @returns {boolean} True when the 2D fill mask needs reallocation.
 */
function needsFillMaskCanvas(Renderer, maskWidth, maskHeight) {
  return (
    !Renderer.mask ||
    Renderer.mask.width !== maskWidth ||
    Renderer.mask.height !== maskHeight
  );
}

/**
 * Returns whether the framebuffer-backed fill mask mirror must be recreated.
 *
 * @param {object} Renderer - Active host renderer.
 * @param {number} Cwidth - Target width in sketch units.
 * @param {number} Cheight - Target height in sketch units.
 * @param {number} Density - Active pixel density.
 * @returns {boolean} True when the fill mask framebuffer needs reallocation.
 */
function needsFillMaskFramebuffer(Renderer, Cwidth, Cheight, Density) {
  return (
    !Renderer.fillMaskFramebuffer ||
    Renderer.fillMaskFramebuffer.width !== Cwidth ||
    Renderer.fillMaskFramebuffer.height !== Cheight ||
    (typeof Renderer.fillMaskFramebuffer.pixelDensity === "function" &&
      Renderer.fillMaskFramebuffer.pixelDensity() !== Density)
  );
}

// =============================================================================
// Section: Resource Management
// =============================================================================
/**
 * Ensures fill compositing resources exist for the active renderer.
 *
 * Fill draws first into a CPU-side 2D mask canvas. That mask is later uploaded,
 * dirty-rect by dirty-rect, into a framebuffer-backed mirror used by the final
 * blend shader pass.
 *
 * @param {object} Renderer - Active host renderer.
 * @param {number} Cwidth - Target width in sketch units.
 * @param {number} Cheight - Target height in sketch units.
 * @param {number} Density - Active pixel density.
 * @param {Function} clearTarget - Shared low-level clear helper from core.
 * @returns {{mask: object, ctx: CanvasRenderingContext2D}} Fill mask resources.
 */
export function ensureFillCompositeResources(
  Renderer,
  Cwidth,
  Cheight,
  Density,
  clearTarget,
) {
  const maskWidth = Math.max(1, Math.round(Cwidth * Density));
  const maskHeight = Math.max(1, Math.round(Cheight * Density));

  if (needsFillMaskCanvas(Renderer, maskWidth, maskHeight)) {
    Renderer.mask = create2DCanvas(maskWidth, maskHeight);
    Renderer.mask.drawingContext = get2DContext(Renderer.mask);
  }

  if (needsFillMaskFramebuffer(Renderer, Cwidth, Cheight, Density)) {
    if (Renderer.fillMaskFramebuffer?.remove) {
      Renderer.fillMaskFramebuffer.remove();
    }
    Renderer.fillMaskFramebuffer = createFramebuffer(Renderer, {
      width: Cwidth,
      height: Cheight,
      density: Density,
      antialias: false,
      depth: false,
      stencil: false,
    });
    clearTarget(Renderer.fillMaskFramebuffer);
  }

  Renderer.mask.dirtyRect ??= null;
  Renderer.mask.isDrawn ??= false;
  Renderer.mask.drawingContext = get2DContext(Renderer.mask);
  Renderer.mask.drawingContext.imageSmoothingEnabled = false;
  return {
    mask: Renderer.mask,
    ctx: Renderer.mask.drawingContext,
  };
}

// =============================================================================
// Section: Mask Lifecycle
// =============================================================================
/**
 * Clears the current fill mask and resets its bookkeeping flags.
 *
 * @param {object|null} target - Fill mask canvas or framebuffer mirror.
 * @param {Function} clearTarget - Shared low-level clear helper from core.
 */
export function clearFillMask(target, clearTarget) {
  if (!target) return;
  clearTarget(target);
  target.isDrawn = false;
  target.dirtyRect = null;
}

// =============================================================================
// Section: Composite Bounds
// =============================================================================
/**
 * Returns the fill dirty rect to composite into the main target. Fill bounds are
 * taken directly from the accumulated 2D mask dirty area plus a small padding.
 *
 * @param {object|null} target - Fill mask canvas.
 * @param {Function} _getActiveFramebuffer - Unused for fill masks.
 * @param {Function} getFullDirtyRect - Returns the full-target dirty rect.
 * @param {Function} expandDirtyRect - Expands a rect by a constant padding.
 * @param {Function} normalizeDirtyRect - Clamps a rect to target bounds.
 * @returns {{minX:number,minY:number,maxX:number,maxY:number}|null} Composite rect.
 */
export function getFillCompositeRect(
  target,
  _getActiveFramebuffer,
  getFullDirtyRect,
  expandDirtyRect,
  normalizeDirtyRect,
) {
  if (!target) return null;
  if (!target.dirtyRect) return getFullDirtyRect();
  return normalizeDirtyRect(
    expandDirtyRect(target.dirtyRect, DIRTY_FILL_PADDING),
  );
}

// =============================================================================
// Section: Upload
// =============================================================================
/**
 * Uploads only the dirty portion of the CPU-side 2D fill mask into the
 * framebuffer-backed fill mask mirror used by the shader compositor.
 *
 * @param {object} Renderer - Active host renderer.
 * @param {object} mask - CPU-side 2D fill mask canvas.
 * @param {{minX:number,minY:number,maxX:number,maxY:number}|null} dirtyRect - Dirty rect to upload.
 * @param {Function} normalizeDirtyRect - Clamps a rect to target bounds.
 * @param {Function} getFullDirtyRect - Returns the full-target dirty rect.
 * @param {Function} clearTarget - Shared low-level clear helper from core.
 * @returns {object} Framebuffer-backed fill mask mirror.
 */
export function getFillShaderMask(
  Renderer,
  mask,
  dirtyRect,
  normalizeDirtyRect,
  getFullDirtyRect,
  clearTarget,
) {
  const target = Renderer.fillMaskFramebuffer;
  const gl = Renderer.drawingContext;
  const uploadRect = normalizeDirtyRect(dirtyRect) ?? getFullDirtyRect();
  const uploadWidth = uploadRect.maxX - uploadRect.minX;
  const uploadHeight = uploadRect.maxY - uploadRect.minY;

  if (
    !FillMaskUploadCanvas ||
    FillMaskUploadCanvas.width !== uploadWidth ||
    FillMaskUploadCanvas.height !== uploadHeight
  ) {
    FillMaskUploadCanvas = create2DCanvas(uploadWidth, uploadHeight);
    FillMaskUploadCanvas.drawingContext = get2DContext(FillMaskUploadCanvas);
  }

  const uploadContext = get2DContext(FillMaskUploadCanvas);
  uploadContext.clearRect(0, 0, uploadWidth, uploadHeight);
  uploadContext.drawImage(
    mask,
    uploadRect.minX,
    uploadRect.minY,
    uploadWidth,
    uploadHeight,
    0,
    0,
    uploadWidth,
    uploadHeight,
  );

  clearTarget(target);
  gl.bindTexture(gl.TEXTURE_2D, target.colorTexture);
  gl.texSubImage2D(
    gl.TEXTURE_2D,
    0,
    uploadRect.minX,
    uploadRect.minY,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    FillMaskUploadCanvas,
  );
  return target;
}

// =============================================================================
// Section: Registration
// =============================================================================
/**
 * Registers the fill compositor with the shared color/composite core.
 * Safe to call multiple times.
 */
export function initFillComposite() {
  if (isFillCompositeRegistered) return;
  Color.registerFillComposite?.({
    ensureResources: ensureFillCompositeResources,
    clearMask: clearFillMask,
    getCompositeRect: getFillCompositeRect,
    getShaderMask: getFillShaderMask,
  });
  isFillCompositeRegistered = true;
}
