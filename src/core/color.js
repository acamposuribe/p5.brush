import vertSrc from "./gl/shader.vert";
import fragSrc from "./gl/shader.frag";

// =============================================================================
// Section: Configure and Initiate
// =============================================================================
/**
 * This module handles the configuration and initialization of the drawing system.
 * It manages canvas properties, ensures the system is ready for rendering, and
 * provides utilities for saving and restoring states.
 */

export let Cwidth, Cheight, Instance, Renderer, Density; // Global canvas properties

const isFramebufferTarget = (target) =>
  !!target &&
  typeof target.begin === "function" &&
  typeof target.end === "function" &&
  !!target.renderer &&
  !!target.renderer._pInst;

const getSketchRenderer = () =>
  _isInstanced ? Instance : window.self.p5.instance;

const isSupportedFramebufferTarget = (target) =>
  isFramebufferTarget(target) && target.renderer._pInst === getSketchRenderer();

const resolveTarget = (buffer = false) => {
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
        "p5.brush only supports p5.Framebuffer targets created from the active sketch. Framebuffers created from p5.Graphics are not supported.",
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

const removeTargetBuffer = (buffer) => {
  if (buffer && typeof buffer.remove === "function") {
    buffer.remove();
  }
};

const getGraphicsFactory = () =>
  typeof Renderer.createGraphics === "function" ? Renderer : Renderer._pInst;

const getActiveFramebuffer = () =>
  Renderer &&
  Renderer._renderer &&
  typeof Renderer._renderer.activeFramebuffer === "function"
    ? Renderer._renderer.activeFramebuffer()
    : null;

const needsBlendSourceFramebuffer = (framebuffer) =>
  !framebuffer ||
  framebuffer.width !== Cwidth ||
  framebuffer.height !== Cheight ||
  (typeof framebuffer.pixelDensity === "function" &&
    framebuffer.pixelDensity() !== Density);

const needsMixBuffers = () =>
  !Renderer.mask ||
  !Renderer.glMask ||
  Renderer.mask.width !== Cwidth ||
  Renderer.mask.height !== Cheight ||
  Renderer.glMask.width !== Cwidth ||
  Renderer.glMask.height !== Cheight;

const DIRTY_BRUSH_PADDING = 2;
const DIRTY_FILL_PADDING = 4;

const getTargetPixelSize = () => ({
  width: Math.max(1, Math.round(Cwidth * Density)),
  height: Math.max(1, Math.round(Cheight * Density)),
});

const expandDirtyRect = (rect, padding = 0) =>
  rect
    ? {
        minX: rect.minX - padding,
        minY: rect.minY - padding,
        maxX: rect.maxX + padding,
        maxY: rect.maxY + padding,
      }
    : null;

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

const getFullDirtyRect = () => {
  const { width, height } = getTargetPixelSize();
  return { minX: 0, minY: 0, maxX: width, maxY: height };
};

const toScissorBox = (rect) => {
  const normalized = normalizeDirtyRect(rect);
  if (!normalized) return null;

  const { height } = getTargetPixelSize();
  return {
    x: normalized.minX,
    y: height - normalized.maxY,
    width: normalized.maxX - normalized.minX,
    height: normalized.maxY - normalized.minY,
  };
};

const withScissor = (gl, rect, draw) => {
  const box = toScissorBox(rect);
  if (!box) return false;

  const wasEnabled = gl.isEnabled(gl.SCISSOR_TEST);
  const prevBox = gl.getParameter(gl.SCISSOR_BOX);

  gl.enable(gl.SCISSOR_TEST);
  gl.scissor(box.x, box.y, box.width, box.height);

  try {
    draw();
  } finally {
    if (wasEnabled) {
      gl.scissor(prevBox[0], prevBox[1], prevBox[2], prevBox[3]);
    } else {
      gl.disable(gl.SCISSOR_TEST);
    }
  }

  return true;
};

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


// =============================================================================
// Section: Color Blending
// =============================================================================
/**
 * Handles color blending using WebGL shaders. Implements advanced blending
 * effects based on Kubelka-Munk theory. Relies on spectral.js for blending logic.
 */

/**
 * Ensures the Mix object is initialized and ready for blending.
 */
export const isMixReady = () => {
  if (!Renderer?.loaded) {
    isCanvasReady();
    Mix.load();
  }
};

const disable = false;

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

  markDirtyRect(target, rect) {
    const normalized = normalizeDirtyRect(rect);
    if (!target || !normalized) return;

    target.dirtyRect = unionDirtyRect(target.dirtyRect, normalized);
    target.isDrawn = true;
  },

  markFull(target) {
    if (!target) return;

    target.dirtyRect = getFullDirtyRect();
    target.isDrawn = true;
  },

  clearMask(target) {
    if (!target) return;

    target.clear();
    target.isDrawn = false;
    target.dirtyRect = null;
  },

  getCompositeRect(target, isBrushMask) {
    if (!target) return null;
    if (!target.dirtyRect) return getFullDirtyRect();

    return normalizeDirtyRect(
      expandDirtyRect(
        target.dirtyRect,
        isBrushMask ? DIRTY_BRUSH_PADDING : DIRTY_FILL_PADDING,
      ),
    );
  },

  captureBlendSource(dirtyRect) {
    const activeFramebuffer = getActiveFramebuffer();

    if (!activeFramebuffer) return Renderer._renderer;

    if (needsBlendSourceFramebuffer(Renderer.blendSourceFramebuffer)) {
      removeTargetBuffer(Renderer.blendSourceFramebuffer);
      Renderer.blendSourceFramebuffer = Renderer.createFramebuffer({
        width: Cwidth,
        height: Cheight,
        density: Density,
        antialias: false,
        depth: false,
        stencil: false,
      });
    }

    const source = Renderer.blendSourceFramebuffer;

    source.draw(() => {
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

    return source;
  },

  /**
   * Loads necessary resources and prepares the mask buffer and shader for colour blending.
   */
  load() {
    Density = Renderer.pixelDensity();
    const graphicsFactory = getGraphicsFactory();
    const p2dMode = graphicsFactory.P2D ?? Renderer.P2D;
    const webglMode = graphicsFactory.WEBGL ?? Renderer.WEBGL;

    if (!Renderer.loaded || needsMixBuffers()) {
      removeTargetBuffer(Renderer.mask);
      removeTargetBuffer(Renderer.glMask);

      Renderer.mask = graphicsFactory.createGraphics(Cwidth, Cheight, p2dMode);
      Renderer.glMask = graphicsFactory.createGraphics(
        Cwidth,
        Cheight,
        webglMode,
      );
      Renderer.loaded = true;
      Renderer.shaderProgram ??= Renderer.createShader(vertSrc, fragSrc);

      this.mask = Renderer.mask;
      this.mask.pixelDensity(Density);
      this.mask.clear();
      this.mask.angleMode(Renderer.DEGREES);
      this.mask.dirtyRect = null;
      this.mask.isDrawn = false;

      this.ctx = this.mask.drawingContext;

      this.glMask = Renderer.glMask;
      this.glMask.pixelDensity(Density);
      this.glMask.clear();
      this.glMask.angleMode(this.glMask.DEGREES);
      this.glMask.drawingContext.lineWidth = 0;
      this.glMask.dirtyRect = null;
      this.glMask.isDrawn = false;
    } else {
      this.mask = Renderer.mask;
      this.glMask = Renderer.glMask;
      this.ctx = this.mask.drawingContext;
      this.mask.dirtyRect ??= null;
      this.mask.isDrawn ??= false;
      this.glMask.dirtyRect ??= null;
      this.glMask.isDrawn ??= false;
    }

    // Link Matrix of GL mask to main Renderer
    this.glMask._renderer.uModelMatrix = Renderer._renderer.uModelMatrix;
  },

  /**
   * Applies blending effects using the current color and mask.
   * @param {Color} _color - Color to blend.
   * @param {boolean} _isLast - If this is the final blend operation.
   * @param {boolean} _isImg - If blending an image.
   * @param {boolean} _isFillLayer - If this is a special case.
   */
  blend(_color = false, _isLast = false) {
    isMixReady();

    const activeIsBrush = this.isBrush === true;
    const mask = activeIsBrush ? this.glMask : this.mask;
    const no_mask = activeIsBrush ? this.mask : this.glMask;
    const nextColor = _color?._array;
    const colorChanged =
      !!nextColor &&
      (this.cachedColor[0] !== nextColor[0] ||
        this.cachedColor[1] !== nextColor[1] ||
        this.cachedColor[2] !== nextColor[2] ||
        this.cachedColor[3] !== nextColor[3]);

    // Perf gains are minimal but let's keep it for now
    if (disable) {
      if (_isLast && mask.isDrawn) {
        Renderer.push();
        Renderer.translate(0, 0);
        Renderer.image(mask, 0, 0, Cwidth, Cheight);
        Renderer.pop();
        mask.isDrawn = false;
      }
      return;
    }

    // Initialize blending if not already active
    if (!this.isBlending && nextColor) {
      this.isBlending = true;
      this.cachedColor = nextColor;
      // Force p5 to bind its internal render target for glMask,
      // so the first glDraw() writes to the correct framebuffer.
      this.glMask.clear();
    }

    if (_isLast || colorChanged) {
      if (this.justChanged) {
        this.applyShader(no_mask, !activeIsBrush);
        this.justChanged = false;
      }
      if (this.isBlending) {
        this.applyShader(mask, activeIsBrush);
      }
      if (nextColor) this.cachedColor = nextColor;
      if (_isLast) this.isBlending = false;
    }
  },

  applyShader(mask, isBrushMask) {
    if (!mask?.isDrawn) return;

    const dirtyRect = this.getCompositeRect(mask, isBrushMask);
    if (!dirtyRect) {
      this.clearMask(mask);
      return;
    }

    let shader = Renderer.shaderProgram;
    const gl = Renderer.drawingContext;
    const targetIsFramebuffer = !!getActiveFramebuffer();
    const source = this.captureBlendSource(dirtyRect);

    // Disable depth test for this compositing draw so the fullscreen rect
    // does not write Z=0 into the depth buffer — which would cause any
    // subsequent p5 geometry drawn at the same depth to fail depth testing
    // and become invisible.
    const hadDepthTest = gl.getParameter(gl.DEPTH_TEST);
    gl.disable(gl.DEPTH_TEST);

    Renderer.push();
    Renderer.translate(0, 0);

    // Use the blend shader for rendering
    Renderer.shader(shader);

    // Set shader uniforms
    shader.setUniform("u_source", source);
    shader.setUniform("u_isBrush", isBrushMask);
    shader.setUniform("u_flipOutputY", targetIsFramebuffer);
    shader.setUniform("u_mask", mask);
    shader.setUniform("u_color", this.cachedColor);

    // Draw a rectangle covering the whole canvas to apply the shader
    withScissor(gl, dirtyRect, () => {
      Renderer.fill(0, 0, 0, 0);
      Renderer.noStroke();
      Renderer.rect(-Cwidth / 2, -Cheight / 2, Cwidth, Cheight);
    });

    // Finish and clear mask
    Renderer.pop();
    Renderer.resetShader();

    // Restore depth test state
    if (hadDepthTest) gl.enable(gl.DEPTH_TEST);

    this.clearMask(mask);
  },
};
