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

// =============================================================================
// Section: Composite Profiling
// =============================================================================
const CompositeProfile = {
  enabled: false,
  stats: new Map(),
  timer: null,
};

const getCompositeProfileFlag = () => {
  if (typeof window === "undefined") return false;
  if (window.__P5_BRUSH_COMPOSITE_PROFILE__ != null) {
    return !!window.__P5_BRUSH_COMPOSITE_PROFILE__;
  }
  return new URLSearchParams(window.location.search).get("compositeProfile") === "on";
};

const now = () => globalThis.performance?.now?.() ?? Date.now();

const profileComposite = (name, fn) => {
  if (!CompositeProfile.enabled) return fn();
  const start = now();
  try {
    return fn();
  } finally {
    const stat = CompositeProfile.stats.get(name) ?? { total: 0, count: 0 };
    stat.total += now() - start;
    stat.count += 1;
    CompositeProfile.stats.set(name, stat);
    if (CompositeProfile.timer) clearTimeout(CompositeProfile.timer);
    CompositeProfile.timer = setTimeout(() => {
      const rows = [...CompositeProfile.stats.entries()]
        .map(([operation, stat]) => ({
          operation,
          total_ms: stat.total.toFixed(2),
          count: stat.count,
          avg_ms: (stat.total / stat.count).toFixed(4),
        }))
        .sort((a, b) => Number(b.total_ms) - Number(a.total_ms));
      console.log(
        `[p5.brush composite profile] entries=${rows.length}`,
      );
      console.table(rows);
    }, 300);
  }
};

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
 * Verifies that a framebuffer belongs to the currently active sketch.
 * @param {p5.Framebuffer} target - Framebuffer candidate.
 * @returns {boolean} True when the framebuffer belongs to the active sketch.
 */
const isSupportedFramebufferTarget = (target) =>
  isFramebufferTarget(target) && target.renderer._pInst === getSketchRenderer();

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
    if (!isSupportedFramebufferTarget(buffer)) {
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
const getActiveFramebuffer = () =>
  Renderer &&
  Renderer._renderer &&
  typeof Renderer._renderer.activeFramebuffer === "function"
    ? Renderer._renderer.activeFramebuffer()
    : null;

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
const toScissorBox = (rect) => {
  const normalized = normalizeDirtyRect(rect);
  if (!normalized) return null;

  // WebGL scissor coordinates are bottom-left based, unlike p5's top-left
  // oriented screen-space bookkeeping.
  const { height } = getTargetPixelSize();
  return {
    x: normalized.minX,
    y: height - normalized.maxY,
    width: normalized.maxX - normalized.minX,
    height: normalized.maxY - normalized.minY,
  };
};

/**
 * Runs a draw callback with a temporary scissor region.
 * @param {WebGL2RenderingContext} gl - Active WebGL context.
 * @param {{minX:number,minY:number,maxX:number,maxY:number}|null} rect - Dirty rect.
 * @param {Function} draw - Draw callback executed under the scissor box.
 * @returns {boolean} True when a valid scissor box was applied.
 */
const withScissor = (gl, rect, draw) => {
  const box = toScissorBox(rect);
  if (!box) return false;

  // Scissor is never nested in this module, so we can set/clear it directly
  // without saving previous GL state.
  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(box.x, box.y, box.width, box.height);

  try {
    draw();
  } finally {
    gl.disable(gl.SCISSOR_TEST);
  }

  return true;
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

  // Check if Rendrer is webgl and throw error if it's not

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

    target.clear();
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

    // Brush masks are generated in a separate WEBGL surface and sampled back
    // into the active renderer. Framebuffer output can disagree about Y
    // orientation there, so brush-mask compositing falls back to full-frame.
    if (isBrushMask && getActiveFramebuffer()) return getFullDirtyRect();
    return normalizeDirtyRect(
      expandDirtyRect(
        target.dirtyRect,
        isBrushMask ? DIRTY_BRUSH_PADDING : DIRTY_FILL_PADDING,
      ),
    );
  },

  /**
   * Captures the current framebuffer contents into a reusable source texture.
   * For main-canvas draws this simply returns the sketch renderer directly.
   * @param {{minX:number,minY:number,maxX:number,maxY:number}} dirtyRect - Region to copy.
   * @returns {object} Renderer or framebuffer source to sample in the blend shader.
   */
  captureBlendSource(dirtyRect) {
    const activeFramebuffer = getActiveFramebuffer();
    if (!activeFramebuffer) return Renderer._renderer;

    // Framebuffer compositing cannot safely sample from the active framebuffer
    // while drawing back into it, so we copy the relevant area first.
    const source = Renderer.blendSourceFramebuffer;
    const needsSource =
      !source ||
      source.width !== Cwidth ||
      source.height !== Cheight ||
      (typeof source.pixelDensity === "function" &&
        source.pixelDensity() !== Density);

    if (needsSource) {
      if (source?.remove) source.remove();
      Renderer.blendSourceFramebuffer = Renderer.createFramebuffer({
        width: Cwidth,
        height: Cheight,
        density: Density,
        antialias: false,
        depth: false,
        stencil: false,
      });
    }

    Renderer.blendSourceFramebuffer.draw(() => {
      withScissor(Renderer.drawingContext, dirtyRect, () => {
        Renderer.clear();
        Renderer.push();
        if (typeof Renderer.imageMode === "function") {
          Renderer.imageMode(
            Renderer.CENTER ?? Renderer._renderer?._pInst?.CENTER,
          );
        }
        Renderer.image(activeFramebuffer, 0, 0, Cwidth, Cheight);
        Renderer.pop();
      });
    });
    return Renderer.blendSourceFramebuffer;
  },

  // =============================================================================
  // Section: Setup and load shaders
  // =============================================================================
  /**
   * Ensures the mask buffers and blend shader exist for the current renderer.
   */
  load() {
    CompositeProfile.enabled = getCompositeProfileFlag();
    const graphicsFactory =
      typeof Renderer.createGraphics === "function" ? Renderer : Renderer._pInst;
    const needsBuffers =
      !Renderer.mask ||
      !Renderer.glMask ||
      Renderer.mask.width !== Cwidth ||
      Renderer.mask.height !== Cheight ||
      Renderer.glMask.width !== Cwidth ||
      Renderer.glMask.height !== Cheight;

    Density = Renderer.pixelDensity();
    const p2dMode = graphicsFactory.P2D ?? Renderer.P2D;
    const webglMode = graphicsFactory.WEBGL ?? Renderer.WEBGL;

    if (!Renderer.loaded || needsBuffers) {
      if (Renderer.mask?.remove) Renderer.mask.remove();
      if (Renderer.glMask?.remove) Renderer.glMask.remove();
      // Keep one 2D mask for fill/hatch work and one WEBGL mask for brush
      // stamps so each path can draw in the renderer that suits it best.
      Renderer.mask = graphicsFactory.createGraphics(Cwidth, Cheight, p2dMode);
      Renderer.glMask = graphicsFactory.createGraphics(
        Cwidth,
        Cheight,
        webglMode,
      );
      Renderer.loaded = true;
      Renderer.shaderProgram ??= Renderer.createShader(vertSrc, fragSrc);
    }

    this.mask = Renderer.mask;
    this.glMask = Renderer.glMask;
    this.ctx = this.mask.drawingContext;

    this.mask.pixelDensity(Density);
    this.mask.angleMode(Renderer.DEGREES);
    this.mask.dirtyRect ??= null;
    this.mask.noSmooth();
    this.mask.isDrawn ??= false;

    this.glMask.pixelDensity(Density);
    this.glMask.angleMode(this.glMask.DEGREES);
    this.glMask.drawingContext.lineWidth = 0;
    this.glMask.dirtyRect ??= null;
    this.glMask.isDrawn ??= false;

    // Link Matrix of GL mask to main Renderer
    this.glMask._renderer.uModelMatrix = Renderer._renderer.uModelMatrix;
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
      // Force p5 to bind its internal render target for glMask before the
      // first raw GL brush draw of the blend cycle.
      this.glMask.clear();
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
    const profilePrefix = isBrushMask ? "brush" : "fill";
    profileComposite(`${profilePrefix}.applyShader`, () => {
      // Brush masks are drawn via raw GL into a separate WEBGL graphics surface,
      // so flush that context before sampling it as a texture.
      if (isBrushMask && typeof mask.drawingContext?.flush === "function") {
        profileComposite(`${profilePrefix}.flushMask`, () =>
          mask.drawingContext.flush(),
        );
      }

      const dirtyRect = profileComposite(
        `${profilePrefix}.getCompositeRect`,
        () => this.getCompositeRect(mask, isBrushMask),
      );
      if (!dirtyRect) {
        profileComposite(`${profilePrefix}.clearMask`, () => this.clearMask(mask));
        return;
      }

      const gl = Renderer.drawingContext;
      const shader = Renderer.shaderProgram;
      const source = profileComposite(
        `${profilePrefix}.captureSource`,
        () => this.captureBlendSource(dirtyRect),
      );
      const flipOutputY = !!getActiveFramebuffer();
      const hadDepthTest = gl.getParameter(gl.DEPTH_TEST);

      // This pass is a fullscreen compositing rect, not scene geometry, so it
      // should not participate in the sketch's depth buffer.
      gl.disable(gl.DEPTH_TEST);

      const drawShaderPass = () => {
        Renderer.push();
        Renderer.translate(0, 0);
        Renderer.shader(shader);

        shader.setUniform("u_source", source);
        shader.setUniform("u_isBrush", isBrushMask);
        shader.setUniform("u_flipOutputY", flipOutputY);
        shader.setUniform("u_mask", mask);
        shader.setUniform("u_color", this.cachedColor);

        withScissor(gl, dirtyRect, () => {
          Renderer.fill(0, 0, 0, 0);
          Renderer.noStroke();
          Renderer.rect(-Cwidth / 2, -Cheight / 2, Cwidth, Cheight);
        });

        Renderer.pop();
      };

      profileComposite(`${profilePrefix}.shaderPass`, drawShaderPass);

      Renderer.resetShader();
      if (hadDepthTest) gl.enable(gl.DEPTH_TEST);
      profileComposite(`${profilePrefix}.clearMask`, () => this.clearMask(mask));
    });
  },
};
