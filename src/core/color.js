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

const Canvases = {}; // Stores canvas instances by ID
export let cID, Cwidth, Cheight, Instance, Renderer, Density; // Global canvas properties

/**
 * Loads and initializes a canvas for the drawing system.
 * @param {string|boolean} [canvasID=false] - Optional ID of the canvas element to use.
 *                                            If false, it uses the current window as the rendering context.
 */
export const load = (buffer = false) => {
  // Set renderer to specificed Buffer, Instance,, or Window
  Renderer =
    _isInstanced && !buffer
      ? Instance
      : !buffer
        ? window.self.p5.instance
        : buffer;

  // Check if Rendrer is webgl and throw error if it's not

  if (Renderer.webglVersion !== "webgl2") {
    throw new Error("p5.brush requires a WEBGL canvas");
  }

  Cwidth = Renderer.width;
  Cheight = Renderer.height;

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
  if (!Renderer.loaded) {
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
  isBlendingGL: false,
  isWaterColor: false,
  cachedColor: new Object(),
  cachedColorGL: new Object(),
  masks: [],

  /**
   * Loads necessary resources and prepares the mask buffer and shader for colour blending.
   */
  load() {
    // Create Renderer masks
    if (!Renderer.loaded) {
      Renderer.mask = Renderer.createGraphics(Cwidth, Cheight, Renderer.P2D);
      Renderer.glMask = Renderer.createGraphics(
        Cwidth,
        Cheight,
        Renderer.WEBGL,
      );
      Renderer.loaded = true;
      Renderer.shaderProgram = Renderer.createShader(vertSrc, fragSrc);

      Density = Renderer.pixelDensity();

      this.mask = Renderer.mask;
      this.mask.pixelDensity(Density);
      this.mask.clear();
      this.mask.angleMode(Renderer.DEGREES);

      this.ctx = this.mask.drawingContext;

      this.glMask = Renderer.glMask;
      this.glMask.pixelDensity(Density);
      this.glMask.clear();
      this.glMask.angleMode(this.glMask.DEGREES);
      this.glMask.drawingContext.lineWidth = 0;
      // Link Matrix of GL mask to main Renderer
      this.glMask._renderer.uModelMatrix = Renderer._renderer.uModelMatrix;
    }
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

    const mask = this.isBrush ? this.glMask : this.mask;
    const no_mask = this.isBrush ? this.mask : this.glMask;

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
    if (!this.isBlending && _color) {
      this.isBlending = true;
      this.cachedColor = _color._array;
      // Force p5 to bind its internal render target for glMask,
      // so the first glDraw() writes to the correct framebuffer.
      this.glMask.clear();
    }

    if (_isLast || this.cachedColor[0] !== _color._array[0] || this.cachedColor[1] !== _color._array[1] || this.cachedColor[2] !== _color._array[2] || this.cachedColor[3] !== _color._array[3]) {
      if (this.justChanged) {
        this.applyShader(no_mask);
        this.justChanged = false;
      }
      if (this.isBlending) {
        this.applyShader(mask);
      }
      this.cachedColor = _color._array;
      if (_isLast) this.isBlending = false;
    }
  },

  applyShader(mask) {
    let shader = Renderer.shaderProgram;
    const gl = Renderer.drawingContext;

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
    shader.setUniform("u_source", Renderer._renderer);
    shader.setUniform("u_isBrush", this.isBrush);
    shader.setUniform("u_mask", mask);
    shader.setUniform("u_color", this.cachedColor);

    // Draw a rectangle covering the whole canvas to apply the shader
    Renderer.fill(0, 0, 0, 0);
    Renderer.noStroke();
    Renderer.rect(-Cwidth / 2, -Cheight / 2, Cwidth, Cheight);

    // Finish and clear mask
    Renderer.pop();
    Renderer.resetShader();

    // Restore depth test state
    if (hadDepthTest) gl.enable(gl.DEPTH_TEST);

    mask.clear();
    mask.isDrawn = false;
  },
};
