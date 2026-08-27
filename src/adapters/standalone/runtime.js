// =============================================================================
// Adapter: Standalone Runtime Hooks
// =============================================================================

import { setRuntime } from "../../core/runtime.js";
import { push as pushState, pop as popState } from "../../core/save.js";

const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

export const DEGREES = "degrees";
export const RADIANS = "radians";

let colorContext = null;
let currentAngleMode = RADIANS;
const transformStack = [];
let currentTransform = {
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  x: 0,
  y: 0,
};

function getColorContext() {
  if (colorContext) return colorContext;

  if (typeof document !== "undefined") {
    colorContext = document.createElement("canvas").getContext("2d");
    return colorContext;
  }

  if (typeof OffscreenCanvas !== "undefined") {
    colorContext = new OffscreenCanvas(1, 1).getContext("2d");
    return colorContext;
  }

  throw new Error("Standalone color parsing requires CanvasRenderingContext2D support.");
}

function multiplyTransform(left, right) {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    x: left.a * right.x + left.c * right.y + left.x,
    y: left.b * right.x + left.d * right.y + left.y,
  };
}

/**
 * Runtime-native color object compatible with the expectations of core modules.
 */
export class Color {
  constructor(r, g, b) {
    const arg0 = r;
    let alpha = 1;
    if (r?._array) {
      this.r = Math.round(r._array[0] * 255);
      this.g = Math.round(r._array[1] * 255);
      this.b = Math.round(r._array[2] * 255);
      this.hex = this.rgbToHex(this.r, this.g, this.b);
      this._array = [...r._array];
      this.gl = this._array;
      return;
    }

    if (typeof r === "string") {
      const rgbaMatch = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/i.exec(r);
      if (rgbaMatch) {
        this.r = clamp(parseInt(rgbaMatch[1]), 0, 255);
        this.g = clamp(parseInt(rgbaMatch[2]), 0, 255);
        this.b = clamp(parseInt(rgbaMatch[3]), 0, 255);
        this.hex = this.rgbToHex(this.r, this.g, this.b);
        const alpha = rgbaMatch[4] !== undefined ? clamp(parseFloat(rgbaMatch[4]), 0, 1) : 1;
        this._array = [this.r / 255, this.g / 255, this.b / 255, alpha];
        this.gl = this._array;
        return;
      }
      this.hex = this.standardize(r);
      const rgb = this.hexToRgb(this.hex);
      this.r = rgb.r;
      this.g = rgb.g;
      this.b = rgb.b;
    } else {
      // Array form, e.g. [255, 0, 0] or [255, 0, 0, 0.5]. p5's own color()
      // accepts arrays and the p5 adapter forwards its arguments straight to
      // it, so the standalone runtime has to accept them too. Otherwise the
      // same sketch quietly means different things on the two runtimes.
      if (Array.isArray(r)) [r, g, b, alpha = 1] = r;
      this.r = clamp(r ?? 0, 0, 255);
      this.g = clamp(g ?? r ?? 0, 0, 255);
      this.b = clamp(b ?? r ?? 0, 0, 255);
      this.hex = this.rgbToHex(this.r, this.g, this.b);
    }

    // Reject non-finite channels here rather than letting them reach _array.
    // A NaN channel is worse than a wrong colour: the compositor decides
    // whether a stroke can keep accumulating into the pending mask by
    // comparing _array against the cached colour, and NaN !== NaN makes every
    // stroke look like a colour change. That silently turns off stroke
    // batching and forces a full composite pass per stroke.
    if (!Number.isFinite(this.r) || !Number.isFinite(this.g) || !Number.isFinite(this.b)) {
      throw new Error(`Invalid color value "${arg0}".`);
    }

    this._array = [this.r / 255, this.g / 255, this.b / 255, clamp(alpha, 0, 1)];
    this.gl = this._array;
  }

  rgbToHex(r, g, b) {
    return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
  }

  hexToRgb(hex) {
    hex = hex.replace(
      /^#?([a-f\d])([a-f\d])([a-f\d])$/i,
      (_match, red, green, blue) => red + red + green + green + blue + blue,
    );
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) {
      throw new Error(`Invalid color value "${hex}".`);
    }
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    };
  }

  standardize(value) {
    const ctx = getColorContext();

    // Assigning an unparseable value to fillStyle is a spec no-op, and this
    // context is a module-level singleton that is never reset, so reading it
    // straight back returns whatever colour was last parsed successfully. A
    // typo does not fail: `stroke("blu")` silently draws the previous colour,
    // and which colour that is depends on call order, so the same typo gives
    // different results between runs.
    //
    // Probe against two sentinels instead. A value the browser recognises
    // overwrites both and reads back identically; one it rejects leaves each
    // sentinel in place, and the two reads disagree.
    ctx.fillStyle = "#000000";
    ctx.fillStyle = value;
    const parsed = ctx.fillStyle;

    ctx.fillStyle = "#ffffff";
    ctx.fillStyle = value;
    if (parsed !== ctx.fillStyle) {
      throw new Error(`Invalid color value "${value}".`);
    }

    return parsed;
  }

  _getRed() {
    return this.r;
  }

  _getGreen() {
    return this.g;
  }

  _getBlue() {
    return this.b;
  }
}

/**
 * Sets the active standalone angle mode.
 *
 * @param {"degrees"|"radians"} mode
 */
export function angleMode(mode) {
  if (mode !== DEGREES && mode !== RADIANS) {
    throw new Error(`Invalid angle mode "${mode}". Use "degrees" or "radians".`);
  }
  currentAngleMode = mode;
}

/**
 * Returns the current standalone angle mode.
 *
 * @returns {"degrees"|"radians"}
 */
export function getAngleMode() {
  return currentAngleMode;
}

/**
 * Pushes the current standalone transform onto the stack.
 */
export function push() {
  pushState();
  transformStack.push({ ...currentTransform });
}

/**
 * Pops the last standalone transform from the stack.
 */
export function pop() {
  if (transformStack.length === 0) return;
  currentTransform = transformStack.pop();
  popState();
}

/**
 * Applies a translation to the current standalone transform.
 *
 * @param {number} x
 * @param {number} y
 */
export function translate(x, y) {
  currentTransform = multiplyTransform(currentTransform, {
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    x,
    y,
  });
}

/**
 * Applies a rotation to the current standalone transform.
 *
 * @param {number} angle
 */
export function rotate(angle) {
  const theta =
    currentAngleMode === RADIANS ? angle : (angle * Math.PI) / 180;
  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);
  currentTransform = multiplyTransform(currentTransform, {
    a: cosTheta,
    b: sinTheta,
    c: -sinTheta,
    d: cosTheta,
    x: 0,
    y: 0,
  });
}

/**
 * Applies a scale to the current standalone transform.
 *
 * @param {number} x
 * @param {number} [y=x]
 */
export function scale(x, y = x) {
  currentTransform = multiplyTransform(currentTransform, {
    a: x,
    b: 0,
    c: 0,
    d: y,
    x: 0,
    y: 0,
  });
}

/**
 * Installs the standalone runtime hooks used by core modules.
 */
export function initStandaloneRuntime() {
  setRuntime({
    usesRadians: () => currentAngleMode === "radians",
    fromDegrees: (angle) =>
      currentAngleMode === "radians" ? (angle * Math.PI) / 180 : angle,
    createColor: (...args) => {
      if (args.length === 1 && args[0]?._array) return args[0];
      return new Color(...args);
    },
    getAffineMatrix: () => currentTransform,
  });
}
