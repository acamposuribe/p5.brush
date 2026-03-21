import {
  Cwidth,
  Cheight,
  Renderer,
  Density,
  load as loadTarget,
  isCanvasReady,
  syncDensity,
  getActiveFramebuffer,
  isFramebufferTarget,
} from "./target.js";
import {
  expandDirtyRect,
  normalizeDirtyRect as clampDirtyRect,
  unionDirtyRect,
  getFullDirtyRect as getFullRect,
} from "./dirty_rect.js";
import {
  clearTarget as clearRenderTarget,
  ensureBlendShaderProgram,
  ensureBlendSourceFramebuffer,
  runBlendShaderPass,
  blitSourceToFramebuffer,
} from "./compositor_runtime.js";

import vertSrc from "./gl/shader.vert";
import fragSrc from "./gl/shader.frag";
import { notifyDraw } from "./runtime.js";

// =============================================================================
// Module: Configure and Initiate
// =============================================================================
/**
 * This module handles the configuration and initialization of the drawing system.
 * It manages canvas properties, ensures the system is ready for rendering, and
 * provides utilities for saving and restoring states.
 */

let strokeComposite = null;
let fillComposite = null;

export const registerStrokeComposite = (composite) => {
  strokeComposite = composite;
};

export const registerFillComposite = (composite) => {
  fillComposite = composite;
};

const clearTarget = (target) => {
  clearRenderTarget(Renderer, target, isFramebufferTarget);
};

// =============================================================================
// Section: Dirty Rect Utilities
// =============================================================================
/**
 * Returns the current render target size in physical pixels.
 * @returns {{width: number, height: number}} Pixel size of the active target.
 */
const getTargetPixelSize = () => ({
  width: Math.max(1, Math.round(Cwidth * Density)),
  height: Math.max(1, Math.round(Cheight * Density)),
});

const normalizeDirtyRect = (rect) => {
  if (!rect) return null;
  const { width, height } = getTargetPixelSize();
  return clampDirtyRect(rect, width, height);
};

/**
 * Returns a dirty rectangle covering the full active target.
 * @returns {{minX:number,minY:number,maxX:number,maxY:number}} Full-target rect.
 */
const getFullDirtyRect = () => {
  const { width, height } = getTargetPixelSize();
  return getFullRect(width, height);
};

// =============================================================================
// Section: Scissor Helpers
// =============================================================================
/**
 * Converts a top-left-based dirty rectangle into a WebGL scissor box.
 * @param {{minX:number,minY:number,maxX:number,maxY:number}|null} rect - Dirty rect.
 * @returns {{x:number,y:number,width:number,height:number}|null} Scissor box or null.
 */
const toScissorBox = (rect, flipY = true) => {
  const normalized = normalizeDirtyRect(rect);
  if (!normalized) return null;

  const { height } = getTargetPixelSize();
  return {
    x: normalized.minX,
    y: flipY ? height - normalized.maxY : normalized.minY,
    width: normalized.maxX - normalized.minX,
    height: normalized.maxY - normalized.minY,
  };
};

/**
 * Runs a draw callback with a temporary scissor region.
 * @param {WebGL2RenderingContext} gl - Active WebGL context.
 * @param {{minX:number,minY:number,maxX:number,maxY:number}|null} rect - Dirty rect.
 * @param {Function} draw - Draw callback executed under the scissor box.
 */
const withScissor = (gl, rect, draw, flipY = true) => {
  const box = toScissorBox(rect, flipY);
  if (!box) {
    draw();
    return;
  }

  // Scissor is never nested in this module, so we can set/clear it directly
  // without saving previous GL state.
  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(box.x, box.y, box.width, box.height);

  try {
    draw();
  } finally {
    gl.disable(gl.SCISSOR_TEST);
  }
};

/**
 * Stores the current state of the drawing system.
 * Can be used to save and restore configurations or canvas states.
 */
export const State = {};
/**
 * Handles color blending using WebGL shaders. Implements advanced blending
 * effects based on Kubelka-Munk theory. Relies on spectral.js for blending logic.
 */

// =============================================================================
// Section: Color Blending / Rendering
// =============================================================================
/**
 * Ensures the Mix object is initialized and ready for blending.
 */
export const isMixReady = () => {
  if (!Renderer?.loaded) {
    isCanvasReady();
    Mix.load();
  }
};

/**
 * Manages blending operations with WebGL shaders.
 * @property {boolean} loaded - Indicates if shaders are loaded.
 * @property {boolean} isBlending - Indicates if blending is active.
 * @property {object} currentColor - Current color in WebGL format.
 * @property {function} load - Initializes blending resources.
 * @property {function} blend - Applies blending effects.
 */
export const Mix = {
  isBlending: false,
  cachedColor: null,

  /**
   * Merges a new dirty rectangle into the target's accumulated draw bounds.
   * @param {object} target - Mask buffer receiving draw output.
   * @param {{minX:number,minY:number,maxX:number,maxY:number}|null} rect - Rect to merge.
   */
  markDirtyRect(target, rect) {
    const normalized = normalizeDirtyRect(rect);
    if (!target || !normalized) return;
    target.dirtyRect = unionDirtyRect(target.dirtyRect, normalized);
    target.isDrawn = true;
  },

  /**
   * Clears a mask buffer and resets its dirty-rect tracking.
   * @param {object} target - Mask buffer to reset.
   */
  clearMask(target) {
    if (!target) return;
    const composite = target === this.glMask ? strokeComposite : fillComposite;
    composite?.clearMask?.(target, clearTarget);
  },

  /**
   * Resolves the region that should be composited back into the destination.
   * @param {object} target - Mask buffer being sampled.
   * @param {boolean} isBrushMask - True when compositing the GL brush mask.
   * @returns {{minX:number,minY:number,maxX:number,maxY:number}|null} Composite rect.
   */
  getCompositeRect(target, isBrushMask) {
    const composite = isBrushMask ? strokeComposite : fillComposite;
    return composite?.getCompositeRect?.(
      target,
      getActiveFramebuffer,
      getFullDirtyRect,
      expandDirtyRect,
      normalizeDirtyRect,
    );
  },

  // =============================================================================
  // Section: Setup and load shaders
  // =============================================================================
  /**
   * Ensures the mask buffers and blend shader exist for the current renderer.
   */
  load() {
    syncDensity();
    const needsBlendSourceFramebuffer =
      !Renderer.blendSourceFramebuffer ||
        Renderer.blendSourceFramebuffer.width !== Cwidth ||
        Renderer.blendSourceFramebuffer.height !== Cheight ||
        (typeof Renderer.blendSourceFramebuffer.pixelDensity === "function" &&
          Renderer.blendSourceFramebuffer.pixelDensity() !== Density);
    ensureBlendShaderProgram(Renderer, vertSrc, fragSrc);

    this.glMask = strokeComposite?.ensureResources?.(
      Renderer,
      Cwidth,
      Cheight,
      Density,
    );
    const fillResources = fillComposite?.ensureResources?.(
      Renderer,
      Cwidth,
      Cheight,
      Density,
      clearTarget,
    ) ?? {
      mask: null,
      ctx: null,
    };

    if (needsBlendSourceFramebuffer) {
      Renderer.blendSourceFramebuffer = ensureBlendSourceFramebuffer(
        Renderer,
        Renderer.blendSourceFramebuffer,
        Cwidth,
        Cheight,
        Density,
      );
    }

    this.mask = fillResources.mask;
    this.ctx = fillResources.ctx;
  },

  // =============================================================================
  // Section: Compositing
  // =============================================================================
  /**
   * Flushes pending mask work when the blend color changes or a frame ends.
   * @param {Color|false} [_color=false] - New blend color.
   * @param {boolean} [_isLast=false] - True when this is the final blend flush.
   */
  blend(_color = false, _isLast = false) {
    isMixReady();
    // Only one mask is "active" for the current drawing mode; the other one
    // may still need flushing if the mode just changed mid-frame.
    const isBrushMask = this.isBrush === true;
    const mask = isBrushMask ? this.glMask : this.mask;
    const otherMask = isBrushMask ? this.mask : this.glMask;
    const nextColor = _color?._array;
    const colorChanged =
      !!nextColor &&
      (this.cachedColor?.[0] !== nextColor[0] ||
        this.cachedColor?.[1] !== nextColor[1] ||
        this.cachedColor?.[2] !== nextColor[2] ||
        this.cachedColor?.[3] !== nextColor[3]);
    if (!this.isBlending && nextColor) {
      this.isBlending = true;
      this.cachedColor = nextColor;
      notifyDraw();
      // Reset the brush mask fully at the start of each blend cycle so stale
      // dirty-rect bookkeeping cannot leak an old stroke into the next color.
      this.clearMask(this.glMask);
    }

    if (_isLast || colorChanged) {
      if (this.justChanged) {
        this.applyShader(otherMask, !isBrushMask);
        this.justChanged = false;
      }
      if (this.isBlending) {
        this.applyShader(mask, isBrushMask);
      }
      if (nextColor) this.cachedColor = nextColor;
      if (_isLast) {
        this.isBlending = false;
        this.cachedColor = null;
        
      }
    }
  },

  /**
   * Runs the blend shader over a mask and composites the result into the active renderer.
   * @param {object} mask - Mask buffer to composite.
   * @param {boolean} isBrushMask - True when compositing the GL brush mask.
   */
  applyShader(mask, isBrushMask) {
    if (!mask?.isDrawn) return;

    const dirtyRect = this.getCompositeRect(mask, isBrushMask);
    if (!dirtyRect) {
      this.clearMask(mask);
      return;
    }

    const gl = Renderer.drawingContext;
    const shader = Renderer.shaderProgram;
    const activeFramebuffer = getActiveFramebuffer();
    const source = blitSourceToFramebuffer({
      renderer: Renderer,
      sourceTarget: activeFramebuffer ?? Renderer,
      sourceFramebuffer: Renderer.blendSourceFramebuffer,
      dirtyRect,
      isFramebufferTarget,
      Cwidth,
      Cheight,
      getTargetPixelSize,
      toScissorBox,
      withScissor,
    });
    const targetIsFramebuffer = !!activeFramebuffer;
    const composite = isBrushMask ? strokeComposite : fillComposite;
    const shaderMask = composite.getShaderMask(
      Renderer,
      mask,
      dirtyRect,
      getFullDirtyRect,
      clearTarget,
    );

    runBlendShaderPass({
      renderer: Renderer,
      shader,
      source,
      mask: shaderMask,
      color: this.cachedColor,
      isBrushMask,
      Cwidth,
      Cheight,
      dirtyRect,
      targetIsFramebuffer,
      withScissor,
    });
    this.clearMask(mask);
  },
};

/**
 * Flushes any pending stroke/fill mask work into the current target and resets
 * the shared compositor back to its initial idle state.
 */
export const flushActiveComposite = () => {
  isMixReady();
  Mix.blend(false, true);
  Mix.clearMask(Mix.glMask);
  Mix.clearMask(Mix.mask);
  Mix.justChanged = false;
  Mix.isBlending = false;
  Mix.isBrush = null;
  Mix.cachedColor = null;
};

/**
 * Loads and initializes the drawing target, then refreshes compositing
 * resources if the renderer was already active.
 *
 * @param {object|false} [buffer=false] - Optional offscreen target.
 */
export const load = (buffer = false) => {
  loadTarget(buffer);
  if (Renderer.loaded) Mix.load();
};
