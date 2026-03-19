import * as Color from "../core/color.js";

let isStrokeCompositeRegistered = false;
const DIRTY_BRUSH_PADDING = 2;

// =============================================================================
// Section: Helpers
// =============================================================================
/**
 * Returns whether the current stroke mask framebuffer must be recreated.
 * This happens when the renderer has no mask yet, or when the canvas size or
 * pixel density changed since the last allocation.
 *
 * @param {object} Renderer - Active p5 renderer/sketch.
 * @param {number} Cwidth - Target width in sketch units.
 * @param {number} Cheight - Target height in sketch units.
 * @param {number} Density - Active pixel density.
 * @returns {boolean} True when the stroke mask must be rebuilt.
 */
function needsStrokeMask(Renderer, Cwidth, Cheight, Density) {
  return (
    !Renderer.glMask ||
    Renderer.glMask.width !== Cwidth ||
    Renderer.glMask.height !== Cheight ||
    (typeof Renderer.glMask.pixelDensity === "function" &&
      Renderer.glMask.pixelDensity() !== Density)
  );
}

// =============================================================================
// Section: Resource Management
// =============================================================================
/**
 * Ensures the stroke compositor owns a framebuffer-backed mask with the current
 * canvas dimensions. Stroke stamps are rendered into this mask in WebGL before
 * being blended into the main target.
 *
 * @param {object} Renderer - Active p5 renderer/sketch.
 * @param {number} Cwidth - Target width in sketch units.
 * @param {number} Cheight - Target height in sketch units.
 * @param {number} Density - Active pixel density.
 * @returns {object} The framebuffer used as stroke mask.
 */
export function ensureStrokeCompositeResources(
  Renderer,
  Cwidth,
  Cheight,
  Density,
) {
  if (needsStrokeMask(Renderer, Cwidth, Cheight, Density)) {
    if (Renderer.glMask?.remove) Renderer.glMask.remove();
    Renderer.glMask = Renderer.createFramebuffer({
      width: Cwidth,
      height: Cheight,
      density: Density,
      antialias: false,
      depth: false,
      stencil: false,
    });
  }

  Renderer.glMask.dirtyRect ??= null;
  Renderer.glMask.isDrawn ??= false;
  return Renderer.glMask;
}

// =============================================================================
// Section: Mask Lifecycle
// =============================================================================
/**
 * Clears the current stroke mask and resets its bookkeeping flags.
 *
 * @param {object|null} target - Stroke mask framebuffer.
 * @param {Function} clearTarget - Shared low-level clear helper from core.
 */
export function clearStrokeMask(target, clearTarget) {
  if (!target) return;
  clearTarget(target);
  target.isDrawn = false;
  target.dirtyRect = null;
}

// =============================================================================
// Section: Composite Bounds
// =============================================================================
/**
 * Returns the rect that should be composited from the stroke mask into the
 * main canvas. Stroke bounds are normally tight dirty rects, but when drawing
 * into an active framebuffer we keep the result conservative and composite the
 * full target.
 *
 * @param {object|null} target - Stroke mask framebuffer.
 * @param {Function} getActiveFramebuffer - Returns the currently bound framebuffer.
 * @param {Function} getFullDirtyRect - Returns the full-target dirty rect.
 * @param {Function} expandDirtyRect - Expands a rect by a constant padding.
 * @param {Function} normalizeDirtyRect - Clamps a rect to target bounds.
 * @param {number} padding - Extra brush padding in pixels.
 * @returns {{minX:number,minY:number,maxX:number,maxY:number}|null} Composite rect.
 */
export function getStrokeCompositeRect(
  target,
  getActiveFramebuffer,
  getFullDirtyRect,
  expandDirtyRect,
  normalizeDirtyRect,
) {
  if (!target) return null;
  if (!target.dirtyRect) return getFullDirtyRect();
  if (getActiveFramebuffer()) return getFullDirtyRect();
  return normalizeDirtyRect(
    expandDirtyRect(target.dirtyRect, DIRTY_BRUSH_PADDING),
  );
}

/**
 * Returns the resource that should be bound to the blend shader's `u_mask`
 * uniform for stroke compositing.
 *
 * @param {object} _Renderer - Active p5 renderer/sketch.
 * @param {object} mask - Stroke mask framebuffer.
 * @returns {object} Stroke mask framebuffer.
 */
export function getStrokeShaderMask(_Renderer, mask) {
  return mask;
}

// =============================================================================
// Section: Registration
// =============================================================================
/**
 * Registers the stroke compositor with the shared color/composite core.
 * Safe to call multiple times.
 */
export function initStrokeComposite() {
  if (isStrokeCompositeRegistered) return;
  Color.registerStrokeComposite?.({
    ensureResources: ensureStrokeCompositeResources,
    clearMask: clearStrokeMask,
    getCompositeRect: getStrokeCompositeRect,
    getShaderMask: getStrokeShaderMask,
  });
  isStrokeCompositeRegistered = true;
}
