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

// Core imports
import { Cwidth, Cheight, Renderer, isCanvasReady } from "../core/target.js";
import {
  Mix,
  State,
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
  cos,
  sin
} from "../core/utils.js";
import { createColor } from "../core/runtime.js";
import { Position, isFieldReady } from "../core/flowfield.js";
import { Polygon } from "../core/polygon.js";
import { Plot } from "../core/plot.js";
import { createTipSurface, loadImageTip } from "./runtime.js";

// Internal module imports
import { initStrokeComposite } from "./composite.js";
import {
  isReady,
  glDraw,
  glDrawImages,
  circle,
  stampImage,
  invalidateTexEntry,
  snapshotMatrix,
} from "./gl_draw.js";

initStrokeComposite(); // Register the stroke composite system for offscreen mask rendering and compositing.

// ---------------------------------------------------------------------------
// Brush State and Helpers
// ---------------------------------------------------------------------------

/**
 * Global stroke state settings.
 */
State.stroke = {
  color: null,
  weight: 1,
  type: "HB",
  isActive: false,
  opacity: 1,
};

let list = new Map();

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
  if (params.noise === undefined) params.noise = 0.3;
  params.noise = Math.max(0, Math.min(1, params.noise));
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
    const g = createTipSurface(500, 500);
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

export function getBrushParams(brushName) {
  return list.get(brushName)?.param ?? null;
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
  State.stroke.color = createColor(...arguments);
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

/**
 * Defines a clipping region for strokes.
 * The region uses the same coordinate space as brush drawing commands,
 * with the current runtime transform captured at call time.
 * @param {number[]} region - Array as [x1, y1, x2, y2] defining the clipping region.
 */
export function clip(region) {
  isCanvasReady();
  return region;
}

/**
 * Disables the clipping region.
 */
export function noClip() {
  return;
}

// ---------------------------------------------------------------------------
// Drawing Variables and Functions
// ---------------------------------------------------------------------------
let _position, _length, _plot, _dir;
let _cachedPlotAngle = 0;
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
  current.pressureCount = 10;
  current.cachedPressure = undefined;
  current.lineNoiseCount = 5;
  current.cachedLineNoise = undefined;

  const neededGaussians = totalSteps * 2;
  while (gaussians.length < neededGaussians) {
    gaussians.push(gaussian());
  }

  for (let i = 0; i < totalSteps; i++) {
    if (isPlot) _cachedPlotAngle = _plot.angle(_position.plotted);
    tip();
    if (isPlot) {
      _position.plotTo(_plot, stepSize, stepSize, angleScale, _cachedPlotAngle);
    } else {
      _position._moveToDegrees(angleScale, stepSize, stepSize);
    }
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
  current.isCustomPressure = pressure.type === "custom";
  current.a = !current.isCustomPressure ? rr(-1, 1) : 0;
  current.b = !current.isCustomPressure ? rr(1, 1.5) : 0;
  if (!current.isCustomPressure) {
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

  current.noiseoffset = 0.05 * current.p.noise;

  // Cache stroke direction for direction-aware dispersion (non-plot strokes only)
  if (!_plot) {
    current.cos = cos(_dir);
    current.sin = sin(_dir);
  }

  // Ensure GL is ready and blend state
  isReady();
  const switchingToBrush = Mix.isBrush !== true;
  Mix.isBrush = true;
  if (switchingToBrush) Mix.justChanged = true;
  Mix.blend(State.stroke.color);

  // Set additional state values
  current.alpha = calculateAlpha();
  current.overscan = getImageTipOverscan();
  current.drawFn =
    current.p.type === "spray"  ? drawSpray :
    current.p.type === "marker" ? drawMarker :
    (current.p.type === "custom" || current.p.type === "image") ? drawImageTip :
    drawDefault;

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
  const pressure = calculatePressure();
  const lineNoise = calculateLineNoise();

  if (lineNoise > rr(1,1.02) && rr(0,1) < 0.7) return;
  current.drawFn(pressure * lineNoise);
}

/**
 * Calculates the effective brush pressure.
 * @returns {number} The calculated pressure.
 */
function calculatePressure() {
  if (current.pressureCount >= 10 || current.cachedPressure === undefined) {
    current.cachedPressure = _plot
      ? simPressure() * _plot.pressure(_position.plotted)
      : simPressure();
    current.pressureCount = 0;
  }
  current.pressureCount++;
  return current.cachedPressure;
}

function calculateLineNoise() {
  if (current.lineNoiseCount >= 10 || current.cachedLineNoise === undefined) {
    current.cachedLineNoise = map(
      noise(current.seed + _position.plotted * 0.01, 0),
      -1,
      1,
      1 - current.noiseoffset,
      1 + current.noiseoffset,
    );
    current.lineNoiseCount = 0;
  }
  current.lineNoiseCount++;
  return current.cachedLineNoise;
}

/**
 * Simulates brush pressure based on stroke parameters.
 * @returns {number} Simulated pressure value.
 */
function simPressure() {
  if (!current.isCustomPressure) return gauss();
  const t = _position.plotted / _length;
  return map(
    current.p.pressure.curve(
      Math.max(0, Math.min(1, 0.5 + (t - 0.5 + current.ct) * current.cs)),
    ) +
      current.cp +
      current.ck * (t - 0.5),
    0,
    1,
    current.min,
    current.max,
    true,
  );
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
 * Calculates the step spacing based on the current brush parameters.
 * @returns {number} The spacing value.
 */
function spacing() {
  return current.p?.spacing ?? 1;
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
  const overscan = current.overscan;
  let angle = 0;
  if (current.p.rotate === "random") {
    angle = randInt(0, 360) * (Math.PI / 180);
  } else if (current.p.rotate === "natural") {
    angle = ((_plot ? -_cachedPlotAngle : -_dir) + _position.angle()) * (Math.PI / 180);
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
      const plotAngle = _cachedPlotAngle;
      const plotCos = cos(plotAngle);
      const plotSin = sin(plotAngle);
      const perp = vibration * rr(-1, 1);
      const along = 0.3 * vibration * rr(-1, 1);
      dx = perp * plotSin + along * plotCos;
      dy = perp * plotCos - along * plotSin;
    } else {
      const perp = vibration * rr(-1, 1);
      const along = 0.3 * vibration * rr(-1, 1);
      dx = perp * current.sin + along * current.cos;
      dy = perp * current.cos - along * current.sin;
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
 * @param {number} dir - Direction, interpreted using the current runtime angle units.
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
  "noise",
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
    "pastel",
    [
      2.05 / 3,
      13.4 / 3,
      0.91,
      28,
      35,
      0.085 / 3,
      { mode: "gaussian", curve: [0.4, 0.05], min_max: [1.09, 0.93] },
      "default",
      undefined,
      "natural",
      true,
      1,
    ],
  ],
  [
    "crayon",
    [
      0.9 / 3,
      5.45 / 3,
      0.75,
      250,
      159,
      0.23 / 3,
      [1.1, 0.9],
      "default",
      undefined,
      "natural",
      true,
      1,
    ],
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
 * scheme, and integrate them into the active host image pipeline.
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
   * @param {object} image - The host image object to convert.
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
          loadImageTip(src, T.imageToWhite).then((p5img) => {
            this.tips.set(src, p5img);
          }),
      ),
    );
  },
};
