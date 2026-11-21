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
import { Cwidth, Cheight, isCanvasReady } from "../core/target.js";
import {
  Mix,
  State,
} from "../core/color.js";
import {
  rr,
  map,
  dist,
  calcAngle,
  toDegrees,
  gaussian,
  noise,
  cos,
  sin,
} from "../core/utils.js";
import { createColor, getAffineMatrix } from "../core/runtime.js";
import { Position, isFieldReady } from "../core/flowfield.js";
import { Polygon } from "../core/polygon.js";
import { Plot, pathPoint } from "../core/plot.js";
import { createTipSurface, loadImageTip } from "./runtime.js";

// Internal module imports
import { initStrokeComposite } from "./composite.js";
import {
  SUBSTEPS,
  isReady,
  invalidateTexEntry,
  snapshotMatrix,
  beginStroke,
  queueSegment,
  queuePiece,
  setStrokePressure,
  PRESSURE_BUMP,
  PRESSURE_CUSTOM,
  TABLE_SAMPLES,
  discardStroke,
  setStrokeOverscan,
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
  clip: null,
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

/**
 * A custom pressure curve sampled for the GPU (pressure.glsl): TABLE_SAMPLES
 * values for t from 0 to 1.
 * @param {(t: number) => number} curve
 * @returns {Float32Array}
 */
function sampleCurve(curve) {
  const table = new Float32Array(TABLE_SAMPLES);
  for (let i = 0; i < TABLE_SAMPLES; i++) table[i] = curve(i / (TABLE_SAMPLES - 1));
  return table;
}

export function add(name, params) {
  if (params.spacing !== undefined && (!Number.isFinite(params.spacing) || params.spacing <= 0)) {
    throw new Error(`Brush "${name}" spacing must be finite and greater than zero.`);
  }
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
    try {
      params.tip(g);
    } finally {
      g.pop();
    }
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
  if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) {
    throw new Error("scaleBrushes() factor must be finite and greater than zero.");
  }
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
  if (!Array.isArray(region) || region.length !== 4 || !region.every(Number.isFinite)) {
    throw new Error("clip() requires four finite coordinates [x1, y1, x2, y2].");
  }
  const [x1, y1, x2, y2] = region;
  State.stroke.clip = {
    bounds: [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)],
    matrix: { ...getAffineMatrix() },
  };
  return region;
}

/**
 * Disables the clipping region.
 */
export function noClip() {
  State.stroke.clip = null;
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
  if (![x, y, length].every(Number.isFinite) || length < 0) {
    throw new Error("Stroke coordinates and length must be finite, with a non-negative length.");
  }
  snapshotMatrix();
  _position = new Position(x + Cwidth / 2, y + Cheight / 2);
  _length = length;
  _plot = plot;
  if (_plot) _plot.calcIndex(0);
}

/**
 * Executes the drawing operation.
 * @param {number} angleScale - Angle (in degrees) or scaling factor.
 * @param {boolean} isPlot - True if plotting a shape.
 */
function draw(angleScale, isPlot) {
  if (!Number.isFinite(angleScale) || (isPlot && angleScale <= 0)) {
    throw new Error("Stroke direction/scale must be finite, with a positive plot scale.");
  }
  const stepSize = list.get(State.stroke.type)?.param.spacing ?? 1;
  const totalSteps = Math.round((_length * (isPlot ? angleScale : 1)) / stepSize);
  if (!Number.isFinite(stepSize) || stepSize <= 0 || !Number.isFinite(totalSteps) || totalSteps > 10_000_000) {
    throw new Error("Stroke spacing must be positive and produce a bounded number of steps.");
  }
  if (!isPlot) _dir = angleScale;
  try {
    saveState();
    // A flow field bends the path step by step, so only the CPU can walk it.
    if (State.field.isActive) drawSegments(totalSteps, stepSize, isPlot, angleScale);
    else walkOnGpu(totalSteps, stepSize, isPlot ? angleScale : 1);
    markerTip();
  } catch (error) {
    discardStroke();
    throw error;
  }
}

// Longest path segment (logical px) drawn as a straight chord.
const SEGMENT_LENGTH = 4;

/**
 * Walks a stroke through a flow field on the CPU, in segments of up to
 * SEGMENT_LENGTH logical px (and at most SUBSTEPS fine steps), and queues
 * them for the GPU, which expands each segment into the brush's dots or
 * stamps. Pressure is evaluated at segment ends and interpolated along each
 * segment.
 */
function drawSegments(totalSteps, stepSize, isPlot, angleScale) {
  const steps = Math.max(1, Math.min(SUBSTEPS, Math.round(SEGMENT_LENGTH / stepSize)));
  // Straight lines use their exact direction (not the 0.25° lookup table),
  // so long lines end where they were asked to.
  const stepX = isPlot ? 0 : stepSize * current.cos;
  const stepY = isPlot ? 0 : -stepSize * current.sin;
  let pressure = calculatePressure();
  for (let i = 0; i < totalSteps; i += steps) {
    const n = Math.min(steps, totalSteps - i);
    const len = stepSize * n;
    const x0 = _position.x, y0 = _position.y;
    const natural = naturalAngle();
    let cs = current.cos, sn = current.sin;
    if (isPlot) {
      // Use the direction at the segment midpoint: start-of-segment
      // directions drift off curves once segments are a few pixels long.
      _cachedPlotAngle = _plot.angle(_position.plotted + len / angleScale / 2);
      cs = cos(_cachedPlotAngle);
      sn = sin(_cachedPlotAngle);
      _position.plotTo(_plot, len, len, angleScale, _cachedPlotAngle);
    } else if (!State.field.isActive) {
      _position.x += stepX * n;
      _position.y += stepY * n;
      _position.plotted += len;
    } else {
      _position._moveToDegrees(angleScale, len, len);
    }
    const endPressure = calculatePressure();
    queueSegment(x0, y0, _position.x, _position.y, cs, sn, pressure, endPressure, n, natural);
    pressure = endPressure;
  }
}

// A line is a single straight piece, reused from stroke to stroke.
const LINE = [{ x: 0, y: 0, heading: 0, turn: 0, start: 0, length: 0, pressure: 1, pressureSlope: 0 }];

/**
 * Queues the stroke for the GPU to walk (gl_draw.js queuePiece()): its path
 * as straight runs and arcs, and its pressure, with no per-step work here.
 * Steps fall at 0, stepSize, … (totalSteps − 1) × stepSize along the path,
 * in position space; `scale` is the plot's scale (1 for lines).
 */
function walkOnGpu(totalSteps, stepSize, scale) {
  const length = totalSteps * stepSize;
  let pieces = LINE;
  if (_plot) {
    pieces = _plot.pieces(_position.x, _position.y, scale);
  } else {
    const line = LINE[0];
    line.x = _position.x;
    line.y = _position.y;
    line.heading = (_dir * Math.PI) / 180;
    line.length = length;
  }
  if (pieces.length === 0) return;
  setStrokePressure(gpuPressure(scale, totalSteps, stepSize));
  // Each piece takes the steps that fall on it; the last also takes any that
  // the rounding of totalSteps puts past the path's end.
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    const first = Math.ceil(piece.start / stepSize);
    const end = i === pieces.length - 1
      ? totalSteps
      : Math.min(totalSteps, Math.ceil((piece.start + piece.length) / stepSize));
    queuePiece(piece, first, end - first, stepSize);
  }
  // Leave the position where the CPU walk would: one step past the last.
  const last = pieces[pieces.length - 1];
  [_position.x, _position.y] = pathPoint(last, length - last.start);
  _position.plotted = length / scale;
}

/**
 * The stroke's pressure for the GPU walk (pressure.glsl): the default bump or
 * the brush's custom curve, with distances in position space, and the range
 * it stays within along the stroke. The object is reused from stroke to
 * stroke; gl_draw.js reads it as it queues.
 */
function gpuPressure(scale, totalSteps, stepSize) {
  const custom = current.isCustomPressure;
  const pressure = GPU_PRESSURE;
  pressure.model = custom ? PRESSURE_CUSTOM : PRESSURE_BUMP;
  pressure.from = current.min;
  pressure.to = current.max;
  pressure.length = _length * scale;
  const shape = pressure.shape;
  if (custom) {
    shape[0] = current.ct;
    shape[1] = current.cs;
    shape[2] = current.cp;
    shape[3] = current.ck;
    // Sampled on first use, so the curve runs only once a stroke needs it.
    pressure.table = current.p.pressure.table ??= sampleCurve(current.p.pressure.curve);
  } else {
    shape[0] = current.peak * scale;
    shape[1] = current.halfBefore * scale;
    shape[2] = current.halfAfter * scale;
    shape[3] = 2 * current.cp;
    pressure.table = null;
  }
  setPressureRange(pressure, ((totalSteps - 1) * stepSize) / scale);
  return pressure;
}

/**
 * Sets the range the stroke's pressure stays within, up to its last step at
 * distance `last` (in the plot's units): `min`, `max` and the lowest positive
 * value, `minPositive`, including the plot's own pressure. The bump's
 * extremes lie at its ends and its peak; a custom curve is sampled.
 */
function setPressureRange(pressure, last) {
  let min = Infinity, max = -Infinity, minPositive = Infinity;
  const include = (p) => {
    if (p < min) min = p;
    if (p > max) max = p;
    if (p > 0 && p < minPositive) minPositive = p;
  };
  if (current.isCustomPressure) {
    for (let i = 0; i <= 32; i++) include(simPressure((last * i) / 32));
  } else {
    include(simPressure(0));
    include(simPressure(last));
    if (current.peak > 0 && current.peak < last) include(simPressure(current.peak));
  }
  if (_plot) {
    let plotMin = Infinity, plotMax = -Infinity, plotMinPositive = Infinity;
    for (const p of _plot.pres) {
      if (p < plotMin) plotMin = p;
      if (p > plotMax) plotMax = p;
      if (p > 0 && p < plotMinPositive) plotMinPositive = p;
    }
    min *= plotMin;
    max *= plotMax;
    minPositive *= plotMinPositive;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    throw new Error("Brush pressure must be finite.");
  }
  pressure.min = min;
  pressure.max = max;
  pressure.minPositive = minPositive;
}

const GPU_PRESSURE = {
  model: PRESSURE_BUMP, from: 0, to: 0, shape: [0, 0, 0, 0], length: 0,
  table: null, min: 0, max: 0, minPositive: 0,
};

/**
 * Stamp rotation (radians) for "natural" image tips: the stroke direction
 * plus the flow-field angle at the current position. 0 for other brushes,
 * without looking up the path's direction.
 */
function naturalAngle() {
  if (current.p.rotate !== "natural") return 0;
  const pathAngle = _plot ? _plot.angle(_position.plotted) : _dir;
  return (-pathAngle + _position.angle()) * (Math.PI / 180);
}

/**
 * Prepares the environment for a brush stroke.
 */
function saveState() {
  current.seed = rr() * 999999;
  const { param } = list.get(State.stroke.type) ?? {};
  if (!param) throw new Error(`Brush "${State.stroke.type}" is not registered.`);
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
    // The pressure bump's shape is fixed for the stroke (see gauss()).
    const width = 1 - pressure.curve[1] * current.b;
    current.peak = (0.5 + pressure.curve[0] * current.a) * _length;
    current.halfBefore = width * 1.2 * (_length / 2);
    current.halfAfter = width * 0.8 * (_length / 2);
  } else {
    const variation = pressure.variation ?? DEFAULT_CUSTOM_PRESSURE_VARIATION;
    current.cp = rr(-variation.offset, variation.offset);
    current.ct = rr(-variation.warp, variation.warp);
    current.cs = rr(1 - variation.scale, 1 + variation.scale);
    current.ck = rr(-variation.tilt, variation.tilt);
  }
  [current.min, current.max] = pressure.min_max;

  // Cache the exact stroke direction for stepping and direction-aware
  // dispersion (non-plot strokes only)
  if (!_plot) {
    const rad = (_dir * Math.PI) / 180;
    current.cos = Math.cos(rad);
    current.sin = Math.sin(rad);
  }

  // Ensure GL is ready and blend state
  isReady();
  const switchingToBrush = Mix.isBrush !== true;
  Mix.isBrush = true;
  if (switchingToBrush) Mix.justChanged = true;
  Mix.blend(State.stroke.color);

  // Stroke-level noise: modulate alpha once per stroke so whole strokes are
  // subtly lighter or darker — organic variation without per-tip cost.
  const baseAlpha = calculateAlpha();
  const noiseStrength = 0.1 * (current.p.noise ?? 0);
  current.alpha = noiseStrength > 0
    ? Math.max(0, baseAlpha * (1 + gaussian(0, noiseStrength)))
    : baseAlpha;

  const tipKey = param.type === "image" ? param.image.src : param.type === "custom" ? param.tipKey : null;
  beginStroke(current.seed, current.alpha, param, tipKey ? { key: tipKey, image: T.tips.get(tipKey) } : null);
  if (tipKey) setStrokeOverscan(getImageTipOverscan());

  markerTip();
}

/**
 * Calculates the effective brush pressure.
 * @returns {number} The calculated pressure.
 */
function calculatePressure() {
  const pressure = _plot
    ? simPressure() * _plot.pressure(_position.plotted)
    : simPressure();
  if (!Number.isFinite(pressure)) {
    throw new Error("Brush pressure must be finite.");
  }
  return pressure;
}

/**
 * Simulates brush pressure based on stroke parameters.
 * @param {number} [at] - Distance along the stroke.
 * @returns {number} Simulated pressure value.
 */
function simPressure(at = _position.plotted) {
  if (!current.isCustomPressure) return gauss(at);
  const t = at / _length;
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
 * Pressure along a default stroke: a bump peaking at current.peak, steeper
 * after the peak than before it, mapped to the brush's pressure range.
 * pressure.glsl evaluates the same bump for strokes walked on the GPU.
 * @param {number} [at] - Distance along the stroke.
 * @returns {number}
 */
function gauss(at = _position.plotted) {
  const d = at - current.peak;
  const halfWidth = at < current.peak ? current.halfBefore : current.halfAfter;
  return map(
    1 / (1 + Math.pow(Math.abs(d / halfWidth), 2 * current.cp)),
    0,
    1,
    current.min,
    current.max,
  );
}

/**
 * Calculates the alpha (opacity) level for a brush stroke.
 * @returns {number} The calculated opacity.
 */
function calculateAlpha() {
  const type = current.p.type;
  return type === "default" || type === "spray"
    ? current.p.opacity
    : current.p.opacity / Math.min(State.stroke.weight, 1.3);
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
// Brush Tips
// ---------------------------------------------------------------------------

/**
 * Draws the blended end cap for marker and image/custom brushes: a short
 * burst of stamps at the current position. A marker's nib rests there and
 * soaks a round spot a little wider than the line: 9 dots from 0.85 to 1.15
 * of the tip pressure at 8× alpha. Image tips ramp from 0.1 to 0.4 (4 stamps
 * at 2× alpha).
 */
function markerTip() {
  if (current.p.markerTip === false) return;
  const isMarker = current.p.type === "marker";
  if (!isMarker && current.p.type !== "custom" && current.p.type !== "image") return;
  const pressure = calculatePressure();
  const count = isMarker ? 9 : 4;
  const angle = naturalAngle();
  queueSegment(
    _position.x, _position.y, _position.x, _position.y,
    current.cos ?? 1, current.sin ?? 0,
    isMarker ? pressure * 0.85 : pressure * 0.1,
    isMarker ? pressure * 1.15 : pressure * 0.1 * (count + 1),
    count,
    angle, isMarker ? 8 : 2,
  );
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
    [0.3, 0.15, 0.9, 0.7, 150, 0.1, { curve: [0.15, 0.2], min_max: [1.2, 1] }],
  ],
  [
    "rotring",
    [0.15, 0.05, 0.7, 0.9, 210, 0.1, { curve: [0.35, 0.2], min_max: [1.3, 1] }],
  ],
  [
    "2B",
    [0.3, 0.75, 0.45, 0.8, 180, 0.1, { curve: [0.1, 0.3], min_max: [1.1, 0.9] }],
  ],
  [
    "HB",
    [0.3, 0.6, 0.3, 0.7, 170, 0.1, { curve: [0.15, 0.2], min_max: [1.1, 0.9] }],
  ],
  [
    "2H",
    [0.2, 0.6, 0.3, 0.75, 120, 0.1, { curve: [0.15, 0.2], min_max: [1.1, 0.9] }],
  ],
  [
    "cpencil",
    [0.35, 0.55, 0.8, 0.7, 75, 0.1, { curve: [0.15, 0.2], min_max: [0.95, 1.1] }],
  ],
  [
    "pastel",
    [
      0.7,
      5,
      0.91,
      1,
      30,
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
      0.33,
      1.9,
      0.75,
      2,
      159,
      0.07,
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
      2,
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
  try {
    if (_brush) set(_brush, _color, _weight);
    if (State.stroke.isActive) {
      for (let s of this.sides) {
        line(s[0].x, s[0].y, s[1].x, s[1].y);
      }
    }
  } finally {
    BrushSetState(state);
  }
  return this;
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
  return this;
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
      image.pixels[i + 3] = (255 - average) * (image.pixels[i + 3] / 255);
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
          }).catch((error) => {
            // A failed source must not poison all later, unrelated tip loads.
            if (!this.tips.get(src)) this.tips.delete(src);
            throw error;
          }),
      ),
    );
  },
};
