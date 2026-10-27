import * as Color from "../core/color.js";
import { createFramebuffer } from "../core/compositor_runtime.js";
import { clearFillTarget } from "./gl_fill.js";

let isFillCompositeRegistered = false;
const DIRTY_FILL_PADDING = 4;

// =============================================================================
// Section: Helpers
// =============================================================================
/**
 * Returns whether the fill mask framebuffer must be recreated.
 *
 * @param {object} Renderer - Active host renderer.
 * @param {number} Cwidth - Target width in sketch units.
 * @param {number} Cheight - Target height in sketch units.
 * @param {number} Density - Active pixel density.
 * @returns {boolean} True when the fill mask needs reallocation.
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
 * Ensures the fill mask exists for the active renderer: a half-float
 * framebuffer with depth and stencil, drawn by gl_fill.js and read directly by
 * the blend shader.
 *
 * @param {object} Renderer - Active host renderer.
 * @param {number} Cwidth - Target width in sketch units.
 * @param {number} Cheight - Target height in sketch units.
 * @param {number} Density - Active pixel density.
 * @returns {{mask: object}} Fill mask resources.
 */
export function ensureFillCompositeResources(Renderer, Cwidth, Cheight, Density) {
  if (needsFillMaskFramebuffer(Renderer, Cwidth, Cheight, Density)) {
    if (Renderer.fillMaskFramebuffer?.remove) {
      Renderer.fillMaskFramebuffer.remove();
    }
    Renderer.fillMaskFramebuffer = createFramebuffer(Renderer, {
      width: Cwidth,
      height: Cheight,
      density: Density,
      format: "half-float",
      antialias: false,
      depth: true,
      stencil: true,
    });
    clearFillTarget(Renderer.fillMaskFramebuffer);
  }

  const mask = Renderer.fillMaskFramebuffer;
  mask.dirtyRect ??= null;
  mask.isDrawn ??= false;
  return { mask };
}

// =============================================================================
// Section: Mask Lifecycle
// =============================================================================
/**
 * Clears the current fill mask and resets its bookkeeping flags.
 *
 * @param {object|null} target - Fill mask framebuffer.
 */
export function clearFillMask(target) {
  if (!target) return;
  clearFillTarget(target);
  target.isDrawn = false;
  target.dirtyRect = null;
}

// =============================================================================
// Section: Composite Bounds
// =============================================================================
/**
 * Returns the fill dirty rect to composite into the main target: the
 * accumulated mask dirty area plus a small padding.
 *
 * @param {object|null} target - Fill mask framebuffer.
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

/**
 * Returns the resource bound to the blend shader's `u_mask` for fills: the
 * fill mask framebuffer itself.
 *
 * @param {object} _Renderer - Active host renderer.
 * @param {object} mask - Fill mask framebuffer.
 * @returns {object} Fill mask framebuffer.
 */
export function getFillShaderMask(_Renderer, mask) {
  return mask;
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
