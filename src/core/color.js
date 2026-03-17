import vertSrc from "./gl/shader.vert";
import fragSrc from "./gl/shader.frag";

// =============================================================================
// Module: Configure and Initiate
// =============================================================================
/**
 * This module handles the configuration and initialization of the drawing system.
 * It manages canvas properties, ensures the system is ready for rendering, and
 * provides utilities for saving and restoring states.
 */

export let Cwidth, Cheight, Instance, Renderer, Density; // Global canvas properties

let FillMaskUploadCanvas = null;

// =============================================================================
// Section: Target Resolution
// =============================================================================

/**
 * Checks whether the given draw target is a p5.Framebuffer-like object.
 * @param {*} target - Candidate draw target.
 * @returns {boolean} True when the target behaves like a p5.Framebuffer.
 */
const isFramebufferTarget = (target) =>
  !!target &&
  typeof target.begin === "function" &&
  typeof target.end === "function" &&
  !!target.renderer &&
  !!target.renderer._pInst;

/**
 * Resolves the sketch renderer that owns the current drawing session.
 * @returns {p5|Window["p5"]["instance"]} The active sketch renderer.
 */
const getSketchRenderer = () =>
  _isInstanced ? Instance : window.self.p5.instance;

/**
 * Resolves the renderer and pixel size used by `brush.load()`.
 * @param {p5.Graphics|p5.Framebuffer|false} [buffer=false] - Optional draw target.
 * @returns {{renderer: object, width: number, height: number}} Active renderer info.
 */
const resolveTarget = (buffer = false) => {
  // brush.load() can target the main sketch renderer, a p5.Graphics surface,
  // or an active framebuffer owned by the current sketch.
  if (_isInstanced && !buffer) {
    return {
      renderer: Instance,
      width: Instance.width,
      height: Instance.height,
    };
  }

  if (!buffer) {
    const renderer = getSketchRenderer();
    return {
      renderer,
      width: renderer.width,
      height: renderer.height,
    };
  }

  if (isFramebufferTarget(buffer)) {
    if (buffer.renderer._pInst !== getSketchRenderer()) {
      throw new Error(
        "p5.brush only supports p5.Framebuffer targets created from the active sketch",
      );
    }

    return {
      renderer: getSketchRenderer(),
      width: buffer.width,
      height: buffer.height,
    };
  }

  return {
    renderer: buffer,
    width: buffer.width,
    height: buffer.height,
  };
};

/**
 * Returns the currently bound sketch framebuffer when drawing into one.
 * @returns {p5.Framebuffer|null} Active framebuffer or null.
 */
const getActiveFramebuffer = () => Renderer?._renderer?.activeFramebuffer?.() ?? null;

const clearTarget = (target) => {
  if (!target) return;

  if (isFramebufferTarget(target)) {
    target.draw(() => Renderer.clear());
    return;
  }

  const ctx = target.drawingContext;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.restore();
};

const uploadFillMaskToMirror = (mask, dirtyRect = null) => {
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
    FillMaskUploadCanvas = new OffscreenCanvas(uploadWidth, uploadHeight);
    FillMaskUploadCanvas.drawingContext = FillMaskUploadCanvas.getContext("2d");
  }

  const uploadContext = FillMaskUploadCanvas.drawingContext;
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
};

// =============================================================================
// Section: Dirty Rect Utilities
// =============================================================================
const DIRTY_BRUSH_PADDING = 2;
const DIRTY_FILL_PADDING = 4;

/**
 * Returns the current render target size in physical pixels.
 * @returns {{width: number, height: number}} Pixel size of the active target.
 */
const getTargetPixelSize = () => ({
  width: Math.max(1, Math.round(Cwidth * Density)),
  height: Math.max(1, Math.round(Cheight * Density)),
});

/**
 * Expands a dirty rectangle outward by a constant padding value.
 * @param {{minX:number,minY:number,maxX:number,maxY:number}|null} rect - Rect to expand.
 * @param {number} [padding=0] - Padding in pixels.
 * @returns {{minX:number,minY:number,maxX:number,maxY:number}|null} Expanded rect.
 */
const expandDirtyRect = (rect, padding = 0) =>
  rect
    ? {
        minX: rect.minX - padding,
        minY: rect.minY - padding,
        maxX: rect.maxX + padding,
        maxY: rect.maxY + padding,
      }
    : null;

/**
 * Clamps a dirty rectangle to the current target bounds.
 * @param {{minX:number,minY:number,maxX:number,maxY:number}|null} rect - Candidate rect.
 * @returns {{minX:number,minY:number,maxX:number,maxY:number}|null} Clamped rect.
 */
const normalizeDirtyRect = (rect) => {
  if (!rect) return null;

  const { width, height } = getTargetPixelSize();
  const minX = Math.max(0, Math.floor(Math.min(rect.minX, rect.maxX)));
  const minY = Math.max(0, Math.floor(Math.min(rect.minY, rect.maxY)));
  const maxX = Math.min(width, Math.ceil(Math.max(rect.minX, rect.maxX)));
  const maxY = Math.min(height, Math.ceil(Math.max(rect.minY, rect.maxY)));

  if (maxX <= minX || maxY <= minY) return null;

  return { minX, minY, maxX, maxY };
};

/**
 * Returns the union of two dirty rectangles.
 * @param {{minX:number,minY:number,maxX:number,maxY:number}|null} a - First rect.
 * @param {{minX:number,minY:number,maxX:number,maxY:number}|null} b - Second rect.
 * @returns {{minX:number,minY:number,maxX:number,maxY:number}|null} Union rect.
 */
const unionDirtyRect = (a, b) => {
  if (!a) return b;
  if (!b) return a;

  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
};

/**
 * Returns a dirty rectangle covering the full active target.
 * @returns {{minX:number,minY:number,maxX:number,maxY:number}} Full-target rect.
 */
const getFullDirtyRect = () => {
  const { width, height } = getTargetPixelSize();
  return { minX: 0, minY: 0, maxX: width, maxY: height };
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

// =============================================================================
// Section: Load and State
// =============================================================================
/**
 * Loads and initializes a canvas for the drawing system.
 * @param {p5.Graphics|p5.Framebuffer|false} [buffer=false] - Optional offscreen target.
 * Pass a framebuffer only while drawing inside its begin()/end() or draw() scope.
 * Framebuffers created from p5.Graphics are not supported.
 */
export const load = (buffer = false) => {
  const target = resolveTarget(buffer);
  Renderer = target.renderer;

  if (Renderer.webglVersion !== "webgl2") {
    throw new Error("p5.brush requires a WEBGL canvas");
  }

  Cwidth = target.width;
  Cheight = target.height;

  _isReady = true;
  if (Renderer.loaded) Mix.load();
};

let _isReady = false;
let _isInstanced = false;

/**
 * Ensures the drawing system is ready before any operation.
 */
export const isCanvasReady = () => {
  if (!_isReady) load();
};

/**
 * Stores the current state of the drawing system.
 * Can be used to save and restore configurations or canvas states.
 */
export const State = {};

export const instance = (inst) => {
  _isInstanced = true;
  Instance = inst;
};
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
  cachedColor: new Object(),

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

    clearTarget(target);
    target.isDrawn = false;
    target.dirtyRect = null;
  },

  /**
   * Resolves the region that should be composited back into the destination.
   * @param {object} target - Mask buffer being sampled.
   * @param {boolean} isBrushMask - True when compositing the WEBGL brush mask.
   * @returns {{minX:number,minY:number,maxX:number,maxY:number}|null} Composite rect.
   */
  getCompositeRect(target, isBrushMask) {
    if (!target) return null;
    if (!target.dirtyRect) return getFullDirtyRect();

    // Brush-mask dirty rects are still less predictable when the destination
    // is itself a framebuffer, so keep that path conservative.
    if (isBrushMask && getActiveFramebuffer()) return getFullDirtyRect();
    return normalizeDirtyRect(
      expandDirtyRect(
        target.dirtyRect,
        isBrushMask ? DIRTY_BRUSH_PADDING : DIRTY_FILL_PADDING,
      ),
    );
  },

  // =============================================================================
  // Section: Setup and load shaders
  // =============================================================================
  /**
   * Ensures the mask buffers and blend shader exist for the current renderer.
   */
  load() {
    Density = Renderer.pixelDensity();
    const maskWidth = Math.max(1, Math.round(Cwidth * Density));
    const maskHeight = Math.max(1, Math.round(Cheight * Density));
    const needsBuffers =
      !Renderer.mask ||
      !Renderer.glMask ||
      Renderer.mask.width !== maskWidth ||
      Renderer.mask.height !== maskHeight ||
      Renderer.glMask.width !== Cwidth ||
      Renderer.glMask.height !== Cheight;
    const needsBlendSourceFramebuffer =
      !Renderer.blendSourceFramebuffer ||
        Renderer.blendSourceFramebuffer.width !== Cwidth ||
        Renderer.blendSourceFramebuffer.height !== Cheight ||
        (typeof Renderer.blendSourceFramebuffer.pixelDensity === "function" &&
          Renderer.blendSourceFramebuffer.pixelDensity() !== Density);
    const needsFillMaskFramebuffer =
      !Renderer.fillMaskFramebuffer ||
        Renderer.fillMaskFramebuffer.width !== Cwidth ||
        Renderer.fillMaskFramebuffer.height !== Cheight ||
        (typeof Renderer.fillMaskFramebuffer.pixelDensity === "function" &&
          Renderer.fillMaskFramebuffer.pixelDensity() !== Density);
    if (!Renderer.loaded || needsBuffers) {
      if (Renderer.glMask?.remove) Renderer.glMask.remove();
      // Keep one 2D mask for fill/hatch work and one framebuffer-backed mask
      // for brush stamps so the brush path stays in the main renderer context.
      Renderer.mask = new OffscreenCanvas(maskWidth, maskHeight);
      Renderer.mask.drawingContext = Renderer.mask.getContext("2d");
      Renderer.glMask = Renderer.createFramebuffer({
        width: Cwidth,
        height: Cheight,
        density: Density,
        antialias: false,
        depth: false,
        stencil: false,
      });
      Renderer.loaded = true;

      Renderer.shaderProgram ??= Renderer.createShader(vertSrc, fragSrc);
    }

    if (needsBlendSourceFramebuffer) {
      if (Renderer.blendSourceFramebuffer?.remove) {
        Renderer.blendSourceFramebuffer.remove();
      }
      Renderer.blendSourceFramebuffer = Renderer.createFramebuffer({
        width: Cwidth,
        height: Cheight,
        density: Density,
        antialias: false,
        depth: false,
        stencil: false,
      });
    }

    if (needsFillMaskFramebuffer) {
      if (Renderer.fillMaskFramebuffer?.remove) {
        Renderer.fillMaskFramebuffer.remove();
      }
      Renderer.fillMaskFramebuffer = Renderer.createFramebuffer({
        width: Cwidth,
        height: Cheight,
        density: Density,
        antialias: false,
        depth: false,
        stencil: false,
      });
      clearTarget(Renderer.fillMaskFramebuffer);
    }

    this.mask = Renderer.mask;
    this.glMask = Renderer.glMask;
    this.ctx = this.mask.drawingContext;
    this.mask.dirtyRect ??= null;
    this.mask.isDrawn ??= false;
    this.ctx.imageSmoothingEnabled = false;

    this.glMask.dirtyRect ??= null;
    this.glMask.isDrawn ??= false;
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
      (this.cachedColor[0] !== nextColor[0] ||
        this.cachedColor[1] !== nextColor[1] ||
        this.cachedColor[2] !== nextColor[2] ||
        this.cachedColor[3] !== nextColor[3]);
    if (!this.isBlending && nextColor) {
      this.isBlending = true;
      this.cachedColor = nextColor;
      // Reset the brush mask at the start of each blend cycle.
      clearTarget(this.glMask);
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
      if (_isLast) this.isBlending = false;
    }
  },

  /**
   * Runs the blend shader over a mask and composites the result into the active renderer.
   * @param {object} mask - Mask buffer to composite.
   * @param {boolean} isBrushMask - True when compositing the WEBGL brush mask.
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
    const source = blitToBlendSourceFramebuffer(activeFramebuffer ?? Renderer, dirtyRect);
    const targetIsFramebuffer = !!activeFramebuffer;
    const hadDepthTest = gl.getParameter(gl.DEPTH_TEST);

    // This pass is a fullscreen compositing rect, not scene geometry, so it
    // should not participate in the sketch's depth buffer.
    gl.disable(gl.DEPTH_TEST);

    Renderer.push();
    Renderer.translate(0, 0);
    Renderer.shader(shader);

    shader.setUniform("u_source", source);
    shader.setUniform("u_targetIsFramebuffer", targetIsFramebuffer);
    shader.setUniform("u_isBrush", isBrushMask);
    if (isBrushMask) {
      shader.setUniform("u_mask", mask);
    } else {
      shader.setUniform("u_mask", uploadFillMaskToMirror(mask, dirtyRect));
    }
    shader.setUniform("u_color", this.cachedColor);

    withScissor(gl, dirtyRect, () => {
      Renderer.fill(0, 0, 0, 0);
      Renderer.noStroke();
      Renderer.rect(-Cwidth / 2, -Cheight / 2, Cwidth, Cheight);
    }, !targetIsFramebuffer);

    Renderer.pop();
    Renderer.resetShader();
    if (hadDepthTest) gl.enable(gl.DEPTH_TEST);
    this.clearMask(mask);
  },
};

/**
 * Copies the current pixels of a renderer or framebuffer into the reusable
 * blend source framebuffer.
 * @param {p5|p5.Graphics|p5.Framebuffer} sourceTarget - Source to copy from.
 * @param {{minX:number,minY:number,maxX:number,maxY:number}|null} [dirtyRect=null] - Optional copy region.
 * @returns {p5.Framebuffer} Blend source framebuffer after the blit.
 */
const blitToBlendSourceFramebuffer = (sourceTarget, dirtyRect = null) => {
  const sourceFramebuffer = Renderer.blendSourceFramebuffer;
  const gl = Renderer.drawingContext;
  const sourceIsFramebuffer = isFramebufferTarget(sourceTarget);
  const { width, height } = getTargetPixelSize();
  const sourceBox = dirtyRect ? toScissorBox(dirtyRect) : null;
  const previousReadFramebuffer = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING);
  const previousDrawFramebuffer = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING);

  (sourceIsFramebuffer ? sourceTarget.renderer : Renderer._renderer)?.flushDraw?.();

  if (sourceIsFramebuffer) {
    sourceFramebuffer.draw(() => {
      withScissor(Renderer.drawingContext, dirtyRect, () => {
        Renderer.clear();
        Renderer.push();
        Renderer.imageMode(Renderer.CENTER);
        Renderer.image(sourceTarget, 0, 0, Cwidth, Cheight);
        Renderer.pop();
      }, false);
    });
    return sourceFramebuffer;
  }

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
};
