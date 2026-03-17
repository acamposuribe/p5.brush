// =============================================================================
// Module: Brush
// =============================================================================
/**
 * The Brush module provides a comprehensive set of functions and classes for
 * simulating various drawing tools ranging from pens, markers, pencils, to
 * custom image-based brushes. This module controls brush properties such as
 * weight, color, vibration, and spacing, and manages the drawing process through
 * stateful methods that enable features like pressure sensitivity, clipping, and
 * blending. By supporting multiple brush types and dynamic parameter adjustments,
 * the Brush module facilitates the creation of realistic and expressive stroke effects.
 */

import {
  Mix,
  Cwidth,
  Cheight,
  State,
  Renderer,
  Instance,
  isCanvasReady,
} from "../core/color.js";
import {
  rr,
  map,
  dist,
  randInt,
  calcAngle,
  toDegrees,
  gaussian,
  rArray,
  noise,
  _onSeed,
} from "../core/utils.js";
import { Position, Matrix, isFieldReady } from "../core/flowfield.js";
import { Polygon } from "../core/polygon.js";
import { Plot } from "../core/plot.js";
import {
  isReady,
  glDraw,
  glDrawImages,
  circle,
  stampImage,
  invalidateTexEntry,
  snapshotMatrix,
} from "./gl_draw.js";

// ---------------------------------------------------------------------------
// Brush State and Helpers
// ---------------------------------------------------------------------------

/**
 * Global stroke state settings.
 */
State.stroke = {
  color: null,
  weight: 1,
  clipWindow: null,
  type: "HB",
  isActive: false,
  opacity: 1,
};

let list = new Map();
let _strokeTransform = {
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  tx: 0,
  ty: 0,
};

function getBrushFactory() {
  return Renderer ?? Instance ?? window.self.p5.instance;
}

const DEFAULT_CUSTOM_PRESSURE_VARIATION = {
  offset: 0.08,
  scale: 0.08,
  warp: 0.06,
  tilt: 0.06,
};

/**
 * Retrieves a shallow copy of the current stroke state.
 * @returns {object} The stroke state.
 */
export function BrushState() {
  return { ...State.stroke };
}

/**
 * Updates the stroke state.
 * @param {object} state - The new stroke state.
 */
export function BrushSetState(state) {
  State.stroke = { ...state };
}

// =============================================================================
// Section: Brush Manager
// =============================================================================

/**
 * Adds a new brush with the specified parameters to the brush list.
 * @param {string} name - The unique name for the new brush.
 * @param {object} params - The parameters defining the brush behavior and appearance.
 */
/**
 * Normalizes the pressure parameter to the internal { type, min_max, curve } format.
 * Accepts:
 *   [start, end]         — linear ramp between two pressure values
 *   [start, mid, end]    — piecewise linear (e.g. [1.5, 0.5, 1.5] for U-curve)
 *   (t) => value         — custom function, t ∈ [0,1], return value ∈ [0,1]
 *   { mode: "gaussian", curve, min_max } — advanced built-in pressure profile
 *   { curve, min_max }   — legacy gaussian format, preserved for compatibility
 */
export function normalizePressure(p) {
  if (!p) return p;
  if (typeof p === "function")
    return {
      type: "custom",
      min_max: [0, 1],
      curve: p,
      variation: { ...DEFAULT_CUSTOM_PRESSURE_VARIATION },
    };
  if (typeof p === "object" && !Array.isArray(p)) {
    if (p.type === "custom" || p.mode === "custom") {
      const { mode, ...rest } = p;
      return {
        ...rest,
        type: "custom",
        variation: {
          ...DEFAULT_CUSTOM_PRESSURE_VARIATION,
          ...(rest.variation ?? {}),
        },
      };
    }
    if (
      p.type === "gaussian" ||
      p.mode === "gaussian" ||
      (Array.isArray(p.curve) && Array.isArray(p.min_max))
    ) {
      return {
        ...p,
        type: "gaussian",
        curve: p.curve,
        min_max: p.min_max,
      };
    }
    return p;
  }
  if (Array.isArray(p)) {
    const [s, m, e] = p.length === 2 ? [p[0], (p[0] + p[1]) / 2, p[1]] : p;
    const min = Math.min(s, m, e),
      max = Math.max(s, m, e);
    const range = max - min || 1;
    const [ns, nm, ne] = [
      (s - min) / range,
      (m - min) / range,
      (e - min) / range,
    ];
    return {
      type: "custom",
      min_max: [min, max],
      variation: { ...DEFAULT_CUSTOM_PRESSURE_VARIATION },
      curve: (t) =>
        t < 0.5 ? ns + (nm - ns) * t * 2 : nm + (ne - nm) * (t - 0.5) * 2,
    };
  }
}

export function add(name, params) {
  const validTypes = ["marker", "custom", "image", "spray"];
  params.type = validTypes.includes(params.type) ? params.type : "default";
  if (params.markerTip === undefined) params.markerTip = true;
  // Accept legacy param names for backward compatibility
  if (params.vibration !== undefined && params.scatter === undefined)
    params.scatter = params.vibration;
  if (params.definition !== undefined && params.sharpness === undefined)
    params.sharpness = params.definition;
  if (params.quality !== undefined && params.grain === undefined)
    params.grain = params.quality;
  params.pressure = normalizePressure(params.pressure);
  if (params.type === "custom") {
    if (typeof params.tip !== "function") {
      throw new Error(`Brush "${name}" is type "custom" but is missing a tip function.`);
    }
    // Rasterise the tip once into a 500×500 P2D buffer.
    // Users draw in a 100×100 coordinate space (origin at centre);
    // dark fills/strokes → high opacity, light/white → transparent.
    const key = `custom::${name}`;
    invalidateTexEntry(key); // discard stale GPU texture if tip changed
    const factory = getBrushFactory();
    const g = factory.createGraphics(500, 500);
    g.pixelDensity(1);
    g.background(255);
    g.noSmooth();
    g.push();
    g.translate(250, 250); // centre origin
    g.scale(5); // 100 user units → 500 px
    g.noStroke();
    params.tip(g);
    g.pop();
    T.imageToWhite(g); // dark → high alpha, RGB → white for tint
    T.tips.set(key, g);
    params.tipKey = key;
    list.set(name, { param: params, colors: [], buffers: [] });
    return;
  }
  if (params.type === "image") {
    if (!params.image || !params.image.src) {
      throw new Error(
        `Brush "${name}" is type "image" but is missing params.image.src. Example: image: { src: "./tip.jpg" }`,
      );
    }
    T.add(params.image.src);
    list.set(name, { param: params, colors: [], buffers: [] });
    return T.load(); // returns a Promise; only loads images not yet loaded
  }
  list.set(name, { param: params, colors: [], buffers: [] });
}

/**
 * Retrieves the list of available brush names.
 * @returns {Array<string>} Array of brush names.
 */
export function box() {
  return [...list.keys()];
}

/**
 * Scales standard brush parameters by the provided factor.
 * @param {number} scaleFactor - The scaling factor to apply.
 */
export function scaleBrushes(scaleFactor) {
  for (const { param } of list.values()) {
    if (param) {
      param.weight *= scaleFactor;
      param.scatter *= scaleFactor;
      param.spacing *= scaleFactor;
    }
  }
}

/**
 * Sets the current brush type by name.
 * @param {string} brushName - The name of the brush.
 */
export function pick(brushName) {
  if (!list.has(brushName)) {
    throw new Error(
      `Brush "${brushName}" not found. Available brushes: ${[...list.keys()].join(", ")}.`,
    );
  }
  State.stroke.type = brushName;
}

/**
 * Sets the stroke style (color) for the current brush.
 * @param {number|string|Color} r - Red component, CSS color string, or Color object.
 * @param {number} [g] - Green component.
 * @param {number} [b] - Blue component.
 */
export function stroke(r, g, b) {
  isCanvasReady();
  State.stroke.color = Renderer.color(...arguments);
  State.stroke.isActive = true;
}

/**
 * Sets the brush weight (thickness).
 * @param {number} weight - The weight value.
 */
export function strokeWeight(weight) {
  State.stroke.weight = weight;
}

/**
 * Sets the current brush with name, color, and weight.
 * @param {string} brushName - The brush name.
 * @param {string|Color} color - The brush color.
 * @param {number} [weight=1] - The brush weight.
 */
export function set(brushName, color, weight = 1) {
  pick(brushName);
  stroke(color);
  strokeWeight(weight);
}

/**
 * Disables the stroke effect.
 */
export function noStroke() {
  State.stroke.isActive = false;
}

function snapshotTransform() {
  return {
    a: Matrix.a(),
    b: Matrix.b(),
    c: Matrix.c(),
    d: Matrix.d(),
    tx: Matrix.x(),
    ty: Matrix.y(),
  };
}

function invertTransform(transform) {
  const det = transform.a * transform.d - transform.b * transform.c;
  if (Math.abs(det) < 1e-12) return null;

  return {
    a: transform.d / det,
    b: -transform.b / det,
    c: -transform.c / det,
    d: transform.a / det,
    tx: (transform.c * transform.ty - transform.d * transform.tx) / det,
    ty: (transform.b * transform.tx - transform.a * transform.ty) / det,
  };
}

function normalizeRegion(region) {
  const [x1, y1, x2, y2] = region;
  return {
    minX: Math.min(x1, x2),
    minY: Math.min(y1, y2),
    maxX: Math.max(x1, x2),
    maxY: Math.max(y1, y2),
  };
}

/**
 * Defines a clipping region for strokes.
 * The region uses the same coordinate space as brush drawing commands,
 * with the current p5 transform captured at call time.
 * @param {number[]} region - Array as [x1, y1, x2, y2] defining the clipping region.
 */
export function clip(region) {
  isCanvasReady();
  const inverse = invertTransform(snapshotTransform());
  if (!inverse) {
    throw new Error(
      "brush.clip() cannot be used with a non-invertible transform.",
    );
  }
  State.stroke.clipWindow = {
    bounds: normalizeRegion(region),
    inverse,
  };
}

/**
 * Disables the clipping region.
 */
export function noClip() {
  State.stroke.clipWindow = null;
}

// ---------------------------------------------------------------------------
// Drawing Variables and Functions
// ---------------------------------------------------------------------------
let _position, _length, _plot, _dir;
const current = {};

/**
 * Initializes the drawing state.
 * @param {number} x - Starting x-coordinate.
 * @param {number} y - Starting y-coordinate.
 * @param {number} length - Length of stroke.
 * @param {Plot|false} [plot=false] - Plot object for path-following strokes.
 */
function initializeDrawingState(x, y, length, plot = false) {
  snapshotMatrix();
  _strokeTransform = snapshotTransform();
  _position = new Position(x + Cwidth / 2, y + Cheight / 2);
  _length = length;
  _plot = plot;
  if (_plot) _plot.calcIndex(0);
}

const gaussians = [];

_onSeed(() => {
  gaussians.length = 0;
});

/**
 * Executes the drawing operation.
 * @param {number} angleScale - Angle (in degrees) or scaling factor.
 * @param {boolean} isPlot - True if plotting a shape.
 */
function draw(angleScale, isPlot) {
  if (!isPlot) _dir = angleScale;
  saveState();

  const stepSize = spacing();
  const totalSteps = Math.round(
    (_length * (isPlot ? angleScale : 1)) / stepSize,
  );
  for (let i = 0; i < totalSteps; i++) {
    if (gaussians.length < totalSteps * 2) {
      gaussians.push(gaussian());
    }
    tip();
    isPlot
      ? _position.plotTo(
          _plot,
          stepSize,
          stepSize,
          angleScale,
          i < 10 ? true : false,
        )
      : _position._moveToDegrees(angleScale, stepSize, stepSize);
  }
  restoreState();
}

/**
 * Prepares the environment for a brush stroke.
 */
function saveState() {
  current.seed = rr() * 999999;
  const { param } = list.get(State.stroke.type) ?? {};
  if (!param) return;
  current.p = param;

  // Set pressure values for the stroke
  const { pressure } = param;
  current.a = pressure.type !== "custom" ? rr(-1, 1) : 0;
  current.b = pressure.type !== "custom" ? rr(1, 1.5) : 0;
  if (pressure.type !== "custom") {
    current.cp = rr(3, 3.5);
    current.ct = 0;
    current.cs = 1;
    current.ck = 0;
  } else {
    const variation = pressure.variation ?? DEFAULT_CUSTOM_PRESSURE_VARIATION;
    current.cp = rr(-variation.offset, variation.offset);
    current.ct = rr(-variation.warp, variation.warp);
    current.cs = rr(1 - variation.scale, 1 + variation.scale);
    current.ck = rr(-variation.tilt, variation.tilt);
  }
  [current.min, current.max] = pressure.min_max;

  current.noiseoffset = 0.03;

  // Cache stroke direction for direction-aware dispersion (non-plot strokes only)
  if (!_plot) {
    const dirRad = (_dir * Math.PI) / 180;
    current.cos = Math.cos(dirRad);
    current.sin = Math.sin(dirRad);
  }

  // Ensure GL is ready and blend state
  isReady();
  const switchingToBrush = Mix.isBrush !== true;
  Mix.isBrush = true;
  if (switchingToBrush) Mix.justChanged = true;
  Mix.blend(State.stroke.color);

  // Set additional state values
  current.alpha = calculateAlpha();

  // Pre-compute clip-check coefficients so isInsideClippingArea() needs no
  // temporary objects and only one matrix×vector multiply per step instead of two.
  {
    const cw2 = Cwidth / 2, ch2 = Cheight / 2;
    const T = _strokeTransform;
    if (State.stroke.clipWindow) {
      const { inverse: I, bounds: B } = State.stroke.clipWindow;
      // Compose (I ∘ T) and fold the -cw2/-ch2 position offset into the translation
      const ca = I.a * T.a + I.c * T.b, cc = I.a * T.c + I.c * T.d;
      const cb = I.b * T.a + I.d * T.b, cd = I.b * T.c + I.d * T.d;
      current.clipA  = ca; current.clipB  = cb;
      current.clipC  = cc; current.clipD  = cd;
      current.clipTX = I.a * T.tx + I.c * T.ty + I.tx - ca * cw2 - cc * ch2;
      current.clipTY = I.b * T.tx + I.d * T.ty + I.ty - cb * cw2 - cd * ch2;
      current.clipMinX = B.minX; current.clipMaxX = B.maxX;
      current.clipMinY = B.minY; current.clipMaxY = B.maxY;
    } else {
      const o =
        current.p.type === "custom" || current.p.type === "image"
          ? Math.max(Cwidth * 0.05, getImageTipOverscan())
          : Cwidth * 0.05;
      current.clipA  = T.a; current.clipB  = T.b;
      current.clipC  = T.c; current.clipD  = T.d;
      current.clipTX = T.tx - T.a * cw2 - T.c * ch2;
      current.clipTY = T.ty - T.b * cw2 - T.d * ch2;
      current.clipMinX = -cw2 - o; current.clipMaxX = cw2 + o;
      current.clipMinY = -ch2 - o; current.clipMaxY = ch2 + o;
    }
  }

  markerTip();
}

/**
 * Restores drawing state after completing a stroke.
 */
function restoreState() {
  markerTip();
  glDraw();
  const type = current.p?.type;
  if (type === "image") glDrawImages(T.tips.get(current.p.image.src), current.p.image.src);
  else if (type === "custom") glDrawImages(T.tips.get(current.p.tipKey), current.p.tipKey);
}

/**
 * Renders the brush tip based on current pressure and position.
 */
function tip() {
  const insideClip = isInsideClippingArea();
  if (!insideClip) return;
  const pressure = calculatePressure();
  const lineNoise = map(
    noise(current.seed + _position.plotted * 0.002, 0),
    0,
    1,
    1 - current.noiseoffset,
    1 + current.noiseoffset,
  );
  switch (current.p.type) {
    case "spray":
      drawSpray(pressure * lineNoise);
      break;
    case "marker":
      drawMarker(pressure * lineNoise);
      break;
    case "custom":
    case "image":
      drawImageTip(pressure * lineNoise);
      break;
    default:
      drawDefault(pressure * lineNoise);
      break;
  }
}

/**
 * Calculates the effective brush pressure.
 * @returns {number} The calculated pressure.
 */
function calculatePressure() {
  return _plot
    ? simPressure() * _plot.pressure(_position.plotted)
    : simPressure();
}

/**
 * Simulates brush pressure based on stroke parameters.
 * @returns {number} Simulated pressure value.
 */
function simPressure() {
  const value = current.p.pressure.type === "custom"
    ? map(
        current.p.pressure.curve(
          Math.max(
            0,
            Math.min(
              1,
              0.5 + ((_position.plotted / _length) - 0.5 + current.ct) * current.cs,
            ),
          ),
        ) +
          current.cp +
          current.ck * ((_position.plotted / _length) - 0.5),
        0,
        1,
        current.min,
        current.max,
        true,
      )
    : gauss();
  return value;
}

/**
 * Generates a Gaussian-based pressure value.
 * @param {number} [a] - Center parameter.
 * @param {number} [b] - Width parameter.
 * @param {number} [c] - Shape parameter.
 * @param {number} [min] - Minimum pressure.
 * @param {number} [max] - Maximum pressure.
 * @returns {number} Gaussian pressure value.
 */
function gauss(
  a = 0.5 + current.p.pressure.curve[0] * current.a,
  b = 1 - current.p.pressure.curve[1] * current.b,
  c = current.cp,
  min = current.min,
  max = current.max,
) {
  const peakPos = a * _length;
  const halfWidth =
    (_position.plotted < peakPos ? b * 1.2 : b * 0.8) * (_length / 2);
  return map(
    1 /
      (1 +
        Math.pow(Math.abs((_position.plotted - peakPos) / halfWidth), 2 * c)),
    0,
    1,
    min,
    max,
  );
}

/**
 * Calculates the alpha (opacity) level for a brush stroke.
 * @returns {number} The calculated opacity.
 */
function calculateAlpha() {
  return ["default", "spray"].includes(current.p.type)
    ? current.p.opacity
    : current.p.opacity / Math.min(State.stroke.weight, 1.3);
}

/**
 * Checks if the current drawing position is within the clipping region.
 * Uses coefficients pre-computed in saveState() — no object allocations,
 * one fused matrix×vector multiply (both transforms composed at setup time).
 * @returns {boolean} True if inside clipping area; false otherwise.
 */
function isInsideClippingArea() {
  const lx = current.clipA * _position.x + current.clipC * _position.y + current.clipTX;
  if (lx < current.clipMinX || lx > current.clipMaxX) return false;
  const ly = current.clipB * _position.x + current.clipD * _position.y + current.clipTY;
  return ly >= current.clipMinY && ly <= current.clipMaxY;
}

/**
 * Calculates the step spacing based on the current brush parameters.
 * @returns {number} The spacing value.
 */
function spacing() {
  const { param } = list.get(State.stroke.type) ?? {};
  if (!param) return 1;
  return param.spacing;
}

function getImageTipOverscan() {
  const maxPressure = Math.max(1, current.max ?? 1);
  const scatterReach = State.stroke.weight * current.p.scatter;
  const tipReach = State.stroke.weight * current.p.weight * maxPressure;

  // Custom/image tips can extend beyond their nominal square because the tip
  // drawing itself may be large and because high scatter creates sparse large
  // stamps near the edge. Keep culling/dirty tracking conservative.
  return Math.max(8, scatterReach * 1.5 + tipReach * 0.75);
}

// ---------------------------------------------------------------------------
// Brush Tip Rendering Methods
// ---------------------------------------------------------------------------

/**
 * Draws the spray tip effect.
 * @param {number} pressure - Current pressure.
 */
function drawSpray(pressure) {
  const vibration =
    State.stroke.weight * current.p.scatter * pressure +
    (State.stroke.weight * rArray(gaussians) * current.p.scatter) / 3;
  const sw = current.p.weight * rr(0.9, 1.1);
  const iterations = Math.ceil(current.p.grain / pressure);
  for (let j = 0; j < iterations; j++) {
    const r = rr(0.9, 1.1);
    const rX = r * vibration * rr(-1, 1);
    const yRandomFactor = rr(-1, 1);
    const sqrtPart = Math.sqrt((r * vibration) ** 2 - rX ** 2);
    circle(
      _position.x + rX,
      _position.y + yRandomFactor * sqrtPart,
      sw,
      current.alpha,
    );
  }
}

/**
 * Draws the marker tip effect.
 * @param {number} pressure - Current pressure.
 * @param {boolean} [vibrate=true] - Whether to apply vibration.
 */
function drawMarker(pressure, vibrate = true, alpha = current.alpha) {
  const vibration = vibrate ? State.stroke.weight * current.p.scatter : 0;
  const rx = vibrate ? vibration * rr(-1, 1) : 0;
  const ry = vibrate ? vibration * rr(-1, 1) : 0;
  circle(
    _position.x + rx,
    _position.y + ry,
    State.stroke.weight * current.p.weight * pressure,
    alpha * Math.max(0.8, pressure) * rr(0.9,1.1),
  );
}

/**
 * Queues a stamp for instanced GL rendering.
 * Handles both "image" and "custom" tip types.
 * @param {number} pressure - Current pressure.
 * @param {number} alpha - Opacity [0..255].
 */
function drawImageTip(pressure, alpha = current.alpha) {
  const vibration = State.stroke.weight * current.p.scatter;
  const rx = vibration * rr(-1, 1);
  const ry = vibration * rr(-1, 1);
  const size = current.p.weight * State.stroke.weight * pressure;
  const overscan = getImageTipOverscan();
  let angle = 0;
  if (current.p.rotate === "random") {
    angle = randInt(0, 360) * (Math.PI / 180);
  } else if (current.p.rotate === "natural") {
    angle = ((_plot ? -_plot.angle(_position.plotted) : -_dir) + _position.angle()) * (Math.PI / 180);
  }
  stampImage(
    _position.x + rx,
    _position.y + ry,
    size,
    angle,
    alpha * Math.max(0.8, pressure) * rr(0.9, 1.1),
    overscan,
  );
}

/**
 * Draws the default brush tip.
 * @param {number} pressure - Current pressure.
 */
function drawDefault(pressure, wiggle = 1) {
  wiggle = map(wiggle, 0, 1, 0.9, 1.05);
  const vibration =
    wiggle *
    State.stroke.weight *
    current.p.scatter *
    (current.p.sharpness +
      ((1 - current.p.sharpness) * rArray(gaussians)) / pressure);
  const passesGate = rr(0, current.p.grain * pressure) > 0.4;
  if (passesGate) {
    let dx, dy;
    if (_plot) {
      dx = 0.7 * vibration * rr(-1, 1);
      dy = vibration * rr(-1, 1);
    } else {
      const perp = vibration * rr(-1, 1);
      const along = 0.3 * vibration * rr(-1, 1);
      dx = perp * -current.sin + along * current.cos;
      dy = perp * current.cos + along * current.sin;
    }
    const diameter =
      pressure *
      pressure *
      current.p.weight *
      rr(0.85, 1.15) *
      State.stroke.weight;
    const alpha = Math.max(0.9, pressure) * current.alpha * rr(0.75, 1.1);
    circle(
      _position.x + dx,
      _position.y + dy,
      diameter,
      alpha,
    );
  }
}

/**
 * Draws the marker tip with a blend effect.
 */
function markerTip() {
  if (current.p.markerTip === false) return;
  if (isInsideClippingArea()) {
    let pressure = calculatePressure();
    let alpha = current.alpha;
    if (current.p.type === "marker") {
      for (let s = 1; s < 10; s++) {
        drawMarker((pressure * s) / 10, true, alpha * 8);
      }
    } else if (current.p.type === "custom" || current.p.type === "image") {
      for (let s = 1; s < 5; s++) {
        drawImageTip((pressure * s) / 10, alpha * 2);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Basic Drawing Operations
// ---------------------------------------------------------------------------

/**
 * Draws a line using the current brush.
 * @param {number} x1 - Start x-coordinate.
 * @param {number} y1 - Start y-coordinate.
 * @param {number} x2 - End x-coordinate.
 * @param {number} y2 - End y-coordinate.
 */
export function line(x1, y1, x2, y2) {
  if (!State.stroke.isActive || !State.stroke.color) {
    throw new Error(
      "No brush or color set. Call brush.set('brushName', color) before drawing.",
    );
  }
  isFieldReady();
  let d = dist(x1, y1, x2, y2);
  if (d == 0) return;
  initializeDrawingState(x1, y1, d);
  let angle = calcAngle(x1, y1, x2, y2);
  draw(angle, false);
}

/**
 * Draws a stroke from a starting point in a given direction.
 * @param {number} x - Starting x-coordinate.
 * @param {number} y - Starting y-coordinate.
 * @param {number} length - Length of the stroke.
 * @param {number} dir - Direction, interpreted using the current p5 angle mode.
 */
export function flowLine(x, y, length, dir) {
  if (!State.stroke.isActive || !State.stroke.color) {
    throw new Error(
      "No brush or color set. Call brush.set('brushName', color) before drawing.",
    );
  }
  isFieldReady();
  initializeDrawingState(x, y, length);
  draw(toDegrees(dir), false);
}

/**
 * Draws a predefined plot.
 * @param {object} p - Shape object representing the plot.
 * @param {number} x - Starting x-coordinate.
 * @param {number} y - Starting y-coordinate.
 * @param {number} scale - Scale factor.
 */
function plot(p, x, y, scale) {
  isFieldReady();
  initializeDrawingState(x, y, p.length, p);
  draw(scale, true);
}

// ---------------------------------------------------------------------------
// Standard Brushes Definition and Initialization
// ---------------------------------------------------------------------------

/**
 * Defines a set of standard brushes with specific characteristics. Each brush is defined
 * with properties such as weight, scatter, sharpness, grain, opacity, spacing, and
 * pressure sensitivity. Some brushes have additional properties like type, tip, and rotate.
 */
const _vals = [
  "weight",
  "scatter",
  "sharpness",
  "grain",
  "opacity",
  "spacing",
  "pressure",
  "type",
  "tip",
  "rotate",
  "markerTip",
];
const _standard_brushes = [
  [
    "pen",
    [0.3, 0.15, 0.9, 2, 150, 0.1, { curve: [0.15, 0.2], min_max: [1.2, 1] }],
  ],
  [
    "rotring",
    [0.15, 0.05, 0.7, 15, 210, 0.1, { curve: [0.35, 0.2], min_max: [1.3, 1] }],
  ],
  [
    "2B",
    [0.3, 0.75, 0.45, 15, 180, 0.1, { curve: [0.1, 0.3], min_max: [1.1, 0.9] }],
  ],
  [
    "HB",
    [0.3, 0.6, 0.3, 10, 170, 0.1, { curve: [0.15, 0.2], min_max: [1.1, 0.9] }],
  ],
  [
    "2H",
    [0.2, 0.6, 0.3, 4, 120, 0.1, { curve: [0.15, 0.2], min_max: [1.1, 0.9] }],
  ],
  [
    "cpencil",
    [0.3, 0.55, 0.8, 7, 75, 0.1, { curve: [0.15, 0.2], min_max: [0.95, 1.2] }],
  ],
  [
    "charcoal",
    [
      0.35,
      1.5,
      0.68,
      500,
      120,
      0.03,
      { curve: [0.15, 0.4], min_max: [1.1, 0.95] },
    ],
  ],
  [
    "spray",
    [
      0.2,
      6,
      15,
      40,
      90,
      0.5,
      { curve: [0.2, 0.35], min_max: [0.7, 1] },
      "spray",
    ],
  ],
  [
    "marker",
    [
      2,
      0.2,
      null,
      null,
      1,
      0.03,
      { curve: [0.35, 0.25], min_max: [1.2, 0.85] },
      "marker",
    ],
  ],
];

for (let s of _standard_brushes) {
  let obj = {};
  for (let i = 0; i < s[1].length; i++) obj[_vals[i]] = s[1][i];
  add(s[0], obj);
}

// ---------------------------------------------------------------------------
// Extensions to Polygon and Plot Prototypes
// ---------------------------------------------------------------------------

/**
 * Draws the polygon using the current brush.
 * @param {boolean} [_brush=false] - Optional brush name override.
 * @param {string|Color} [_color] - Optional color override.
 * @param {number} [_weight] - Optional weight override.
 */
Polygon.prototype.draw = function (_brush = false, _color, _weight) {
  let state = BrushState();
  if (_brush) set(_brush, _color, _weight);
  if (state.isActive) {
    for (let s of this.sides) {
      line(s[0].x, s[0].y, s[1].x, s[1].y);
    }
  }
  BrushSetState(state);
};

/**
 * Draws the plot using the current brush.
 * @param {number} x - Starting x-coordinate.
 * @param {number} y - Starting y-coordinate.
 * @param {number} scale - Scale factor.
 */
Plot.prototype.draw = function (x, y, scale) {
  if (BrushState().isActive) {
    if (this.origin) ((x = this.origin[0]), (y = this.origin[1]), (scale = 1));
    plot(this, x, y, scale);
  }
};

// =============================================================================
// Section: Loading Custom Image Tips
// =============================================================================
/**
 * This section defines the functionality for managing the loading and processing of image tips.
 * Images are loaded from specified source URLs, converted to a white tint for visual effects,
 * and then stored for future use. It includes methods to add new images, convert their color
 * scheme, and integrate them into the p5.js graphics library.
 */

/**
 * Manages loading and processing of image tips.
 * Images are converted to white with inverted alpha for tinting via shaders.
 */
const T = {
  tips: new Map(),

  /**
   * Registers an image source for later loading.
   * @param {string} src - The source URL of the image.
   */
  add(src) {
    if (!this.tips.has(src)) this.tips.set(src, false);
  },

  /**
   * Converts image to white with inverted alpha for tint-based rendering.
   * @param {object} image - The p5.Image to convert.
   */
  imageToWhite(image) {
    image.loadPixels();
    for (let i = 0; i < 4 * image.width * image.height; i += 4) {
      let average =
        (image.pixels[i] + image.pixels[i + 1] + image.pixels[i + 2]) / 3;
      image.pixels[i] = image.pixels[i + 1] = image.pixels[i + 2] = 255;
      image.pixels[i + 3] = 255 - average;
    }
    image.updatePixels();
  },

  /**
   * Loads all registered image tips. Returns a promise that resolves
   * when all images are loaded and processed.
   * @returns {Promise}
   */
  async load() {
    const entries = [...this.tips.keys()].filter((k) => !this.tips.get(k));
    await Promise.all(
      entries.map(
        (src) =>
          new Promise((resolve, reject) => {
            const nativeImg = new window.Image();
            nativeImg.onload = () => {
              const factory = getBrushFactory();
              const p5img = factory.createImage(
                nativeImg.naturalWidth,
                nativeImg.naturalHeight,
              );
              p5img.drawingContext.drawImage(nativeImg, 0, 0);
              T.imageToWhite(p5img);
              this.tips.set(src, p5img);
              resolve();
            };
            nativeImg.onerror = () =>
              reject(new Error(`Failed to load image tip: ${src}`));
            nativeImg.crossOrigin = "anonymous";
            nativeImg.src = src;
          }),
      ),
    );
  },
};
