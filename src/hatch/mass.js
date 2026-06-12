// =============================================================================
// Module: Mass
// =============================================================================

import { State } from "../core/color.js";
import { arc } from "../core/primitives.js";
import { Polygon } from "../core/polygon.js";
import { Plot } from "../core/plot.js";
import { rr2, dist, calcAngle } from "../core/utils.js";
import { fromDegrees, usesRadians } from "../core/runtime.js";
import { HatchState, HatchSetState, hatch, getHatchLines } from "./hatch.js";
import { BrushState, BrushSetState, getBrushParams, set } from "../stroke/stroke.js";
import { wiggle } from "../core/flowfield.js";

// ---------------------------------------------------------------------------
// Mass State
// ---------------------------------------------------------------------------

State.mass = {
  isActive: false,
  brush: null,
  color: null,
  options: {},
};

/**
 * Enables massing mode with a brush, color, and optional configuration.
 *
 * @param {string} brush - Brush name to use for the mass pass.
 * @param {string|Color} color - Color to use for the mass pass.
 * @param {object} [options={}] - Massing options such as precision, strength, gradient, and outline.
 */
export function mass(brush, color, options = {}) {
  State.mass.brush = brush;
  State.mass.color = color;
  State.mass.options = options;
  State.mass.isActive = true;
}

/**
 * Disables massing mode for subsequent geometry.
 */
export function noMass() {
  State.mass.isActive = false;
  State.mass.brush = null;
  State.mass.color = null;
  State.mass.options = {};
}

// ---------------------------------------------------------------------------
// Polygon Preparation
// ---------------------------------------------------------------------------

/**
 * Returns a translated copy of a polygon.
 * Used to build the secondary mass layers from an existing base polygon.
 * @param {Polygon} polygon
 * @param {number} jitterX
 * @param {number} jitterY
 * @returns {Polygon}
 */
function jitterPolygon(polygon, jitterX, jitterY) {
  return new Polygon(
    polygon.vertices.map((vertex) => [vertex.x + jitterX, vertex.y + jitterY]),
  );
}

function jitterPolygons(polygons, jitterX, jitterY) {
  return polygons.map((polygon) => jitterPolygon(polygon, jitterX, jitterY));
}

/**
 * Builds the three polygons used for a mass pass.
 * Both polygon and plot inputs use one base polygon plus two translated copies,
 * so plot-based massing only needs a single `genPol(...)` call.
 * @param {Polygon|Polygon[]|Plot} shape
 * @param {number|false} x
 * @param {number} y
 * @param {number} scale
 * @returns {(Polygon|Polygon[])[]}
 */
function getMassPolygons(shape, x, y, scale) {
  const isPolygon = x === false;
  const scatter = getBrushParams(State.mass.brush)?.scatter ?? 0;
  const basePolygon = isPolygon ? shape : shape.genPol(x, y, scale, 0.15);
  const maxJitter = Math.min(scatter * 2, 5);
  const jitters = [
    [rr2(-maxJitter, maxJitter), rr2(-maxJitter, maxJitter)],
    [rr2(-maxJitter, maxJitter), rr2(-maxJitter, maxJitter)],
  ];

  if (Array.isArray(basePolygon)) {
    return [
      basePolygon,
      jitterPolygons(basePolygon, jitters[0][0], jitters[0][1]),
      jitterPolygons(basePolygon, jitters[1][0], jitters[1][1]),
    ];
  }

  return [
    basePolygon,
    jitterPolygon(basePolygon, jitters[0][0], jitters[0][1]),
    jitterPolygon(basePolygon, jitters[1][0], jitters[1][1]),
  ];
}

// ---------------------------------------------------------------------------
// Angle & Bounds Helpers
// ---------------------------------------------------------------------------

/**
 * Converts degree values into the current runtime angle units.
 * @param {number} angle
 * @returns {number}
 */
function getAngleConverter() {
  return usesRadians()
    ? (angle) => (angle * Math.PI) / 180
    : (angle) => angle;
}

function getAngleInverseConverter() {
  return usesRadians()
    ? (angle) => (angle * 180) / Math.PI
    : (angle) => angle;
}

/**
 * Computes an axis-aligned bounding box for a polygon.
 * The diagonal is used as a size reference for pivot distance.
 * @param {Polygon|Polygon[]} polygon
 * @returns {{minX:number,minY:number,maxX:number,maxY:number,cx:number,cy:number,size:number}}
 */
function getPolygonBounds(polygon) {
  const points = Array.isArray(polygon)
    ? polygon.flatMap((part) => part?.a ?? [])
    : polygon?.a ?? [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return {
    minX,
    minY,
    maxX,
    maxY,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    size: Math.hypot(maxX - minX, maxY - minY),
  };
}

// ---------------------------------------------------------------------------
// Pivot Geometry
// ---------------------------------------------------------------------------

/**
 * Chooses the diagonal corner family for a whole mass gesture.
 * Positive-angle hatching uses either bottom-right or top-left; negative-angle
 * hatching uses either bottom-left or top-right.
 * @param {number} angleDeg
 * @returns {[number, number]}
 */
function getPivotBias(angleDeg) {
  const normalizedAngle = ((((angleDeg + 90) % 180) + 180) % 180) - 90;
  if (normalizedAngle >= 0) {
    return rr2() < 0.5 ? [1, 1] : [-1, -1];
  } else {
    return rr2() < 0.5 ? [-1, 1] : [1, -1];
  }
}

/**
 * Places the global pivot anchor outside the polygon, along the selected bias.
 * Distance varies per layer while the bias stays fixed for the whole mass.
 * @param {Polygon|Polygon[]} polygon
 * @param {[number, number]} bias
 * @returns {{x:number,y:number}}
 */
function getPivotAnchor(polygon, bias) {
  const bounds = getPolygonBounds(polygon);
  const offset = bounds.size * rr2(0.6, 1.4);
  const [sx, sy] = bias;
  return {
    x: bounds.cx + sx * offset,
    y: bounds.cy + sy * offset,
  };
}

/**
 * Projects the global pivot anchor onto the perpendicular bisector of a line.
 * This yields a valid circle center equidistant from both endpoints.
 * @param {{x:number,y:number}} anchor
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {{x:number,y:number}|null}
 */
function projectAnchorToBisector(anchor, x1, y1, x2, y2) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (!length) return null;
  const nx = -dy / length;
  const ny = dx / length;
  const offset = (anchor.x - mx) * nx + (anchor.y - my) * ny;
  return {
    x: mx + nx * offset,
    y: my + ny * offset,
  };
}

function biasArrayMassCenter(shape, center, x1, y1, x2, y2) {
  if (!Array.isArray(shape)) return center;

  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const chord = Math.hypot(x2 - x1, y2 - y1);
  const size = Math.max(getPolygonBounds(shape).size, chord, 1);
  const shortness = 1 - Math.min(1, chord / (size * 0.42));
  const bias = 0.08 + shortness * 0.18;

  return {
    x: center.x + (mx - center.x) * bias,
    y: center.y + (my - center.y) * bias,
  };
}

/**
 * Returns the shortest arc between two endpoints around a given center.
 * The returned angles are already converted into the current runtime angle units.
 * @param {number} cx
 * @param {number} cy
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {[number, number]}
 */
function getShortArcAngles(cx, cy, x1, y1, x2, y2, toAngleUnit) {
  let startDeg = calcAngle(cx, cy, x1, y1);
  let endDeg = calcAngle(cx, cy, x2, y2);
  const sweep = ((endDeg - startDeg) % 360 + 360) % 360;
  if (sweep > 180) [startDeg, endDeg] = [endDeg, startDeg];
  return [
    toAngleUnit(startDeg),
    toAngleUnit(endDeg),
  ];
}

function pointInRing(points, x, y) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i][0], yi = points[i][1];
    const xj = points[j][0], yj = points[j][1];
    const intersects = ((yi > y) !== (yj > y))
      && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInMassShape(shape, x, y) {
  if (Array.isArray(shape)) {
    let inside = false;
    for (const polygon of shape) {
      if (pointInRing(polygon.a, x, y)) inside = !inside;
    }
    return inside;
  }
  return pointInRing(shape.a, x, y);
}

function getArcSamplePoint(cx, cy, radius, startAngle, endAngle, toDegreesUnit, t) {
  const startDeg = toDegreesUnit(startAngle);
  const endDeg = toDegreesUnit(endAngle);
  const sweepDeg = ((endDeg - startDeg) % 360 + 360) % 360;
  const sampleDeg = startDeg + sweepDeg * t;
  const midRad = (sampleDeg * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(midRad),
    y: cy - radius * Math.sin(midRad),
  };
}

function arcFitsShape(shape, cx, cy, radius, startAngle, endAngle, toDegreesUnit) {
  for (const t of [0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875]) {
    const point = getArcSamplePoint(cx, cy, radius, startAngle, endAngle, toDegreesUnit, t);
    if (!pointInMassShape(shape, point.x, point.y)) return false;
  }
  return true;
}

function getMassArcAngles(shape, cx, cy, radius, x1, y1, x2, y2, toAngleUnit, toDegreesUnit) {
  const shortArc = getShortArcAngles(cx, cy, x1, y1, x2, y2, toAngleUnit);
  const longArc = [shortArc[1], shortArc[0]];
  const shortFits = arcFitsShape(shape, cx, cy, radius, shortArc[0], shortArc[1], toDegreesUnit);
  const longFits = arcFitsShape(shape, cx, cy, radius, longArc[0], longArc[1], toDegreesUnit);

  if (shortFits && !longFits) return shortArc;
  if (longFits && !shortFits) return longArc;
  if (shortFits) return shortArc;
  if (longFits) return longArc;
  return null;
}

/**
 * Splits a hatch line into two slightly separated segments so some gestures
 * read as interrupted rather than perfectly continuous.
 * @param {{x1:number,y1:number,x2:number,y2:number}} seg
 * @returns {Array<{x1:number,y1:number,x2:number,y2:number}>}
 */
function splitSegment(seg) {
  const t = rr2(0.35, 0.65);
  const mx = seg.x1 + (seg.x2 - seg.x1) * t;
  const my = seg.y1 + (seg.y2 - seg.y1) * t;
  const dx = seg.x2 - seg.x1;
  const dy = seg.y2 - seg.y1;
  const length = Math.hypot(dx, dy) || 1;
  const gap = rr2(0.04, 0.1) * length;
  const gx = (dx / length) * gap * 0.5;
  const gy = (dy / length) * gap * 0.5;
  return [
    { x1: seg.x1, y1: seg.y1, x2: mx - gx, y2: my - gy },
    { x1: mx + gx, y1: my + gy, x2: seg.x2, y2: seg.y2 },
  ];
}

// ---------------------------------------------------------------------------
// Mass Rendering
// ---------------------------------------------------------------------------

/**
 * Draws one polygon of the mass as a family of arcs derived from hatch lines.
 * The same pivot bias is used across layers, while each layer gets its own
 * anchor distance from the shape.
 * @param {Polygon|Polygon[]} polygon
 * @param {[number, number]} pivotBias
 */
function drawMassArcs(polygon, pivotBias, toAngleUnit, toDegreesUnit) {
  const anchor = getPivotAnchor(polygon, pivotBias);
  for (const seg of getHatchLines(polygon)) {
    const parts = !seg.isConnector && rr2() < 0.35 ? splitSegment(seg) : [seg];
    for (const part of parts) {
      const projectedCenter = projectAnchorToBisector(anchor, part.x1, part.y1, part.x2, part.y2);
      const center = projectedCenter
        ? biasArrayMassCenter(polygon, projectedCenter, part.x1, part.y1, part.x2, part.y2)
        : null;
      if (!center) continue;
      const radius = dist(center.x, center.y, part.x1, part.y1);
      if (!radius) continue;
      const arcAngles = getMassArcAngles(
        polygon,
        center.x,
        center.y,
        radius,
        part.x1,
        part.y1,
        part.x2,
        part.y2,
        toAngleUnit,
        toDegreesUnit,
      );
      if (!arcAngles) continue;
      const [startAngle, endAngle] = arcAngles;
      arc(center.x, center.y, radius, startAngle, endAngle);
    }
  }
}

/**
 * Configures a hatch pass and immediately reinterprets the generated lines as arcs.
 * @param {Polygon|Polygon[]} polygon
 * @param {number} dist
 * @param {number} angle
 * @param {object} options
 * @param {[number, number]} pivotBias
 */
function drawMassPass(polygon, dist, angle, options, pivotBias, toAngleUnit, toDegreesUnit) {
  hatch(dist, angle, Array.isArray(polygon) ? { ...options, continuous: false } : options);
  drawMassArcs(polygon, pivotBias, toAngleUnit, toDegreesUnit);
}

function drawMassOutline(shape) {
  if (Array.isArray(shape)) {
    for (const polygon of shape) polygon.draw();
    return;
  }
  shape.draw();
}

/**
 * Creates the built-in "massing" effect for a polygon or plot.
 * A mass is built from up to three jittered polygon layers, each hatched and
 * then redrawn as arc gestures around a shared pivot bias.
 * @param {Polygon|Polygon[]|Plot} shape
 * @param {number|false} x
 * @param {number} y
 * @param {number} scale
 */
export function createMass(shape, x, y, scale) {
  const pols = getMassPolygons(shape, x, y, scale);
  const hatchState = HatchState();
  const brushState = BrushState();
  const fieldState = { ...State.field };
  const precision = State.mass.options?.precision ?? 0.5;
  const strength = State.mass.options?.strength ?? 1;
  const gradient = State.mass.options?.gradient ?? 0.1;
  const outline = State.mass.options?.outline ?? false;
  const scatter = getBrushParams(State.mass.brush)?.scatter ?? 0;
  const hatchDist = 1.6 * rr2(scatter * 0.65, scatter * 0.85) - 0.4 * gradient;
  const baseAngle = rr2(-90, 90);
  const pivotBias = getPivotBias(baseAngle);
  const toAngleUnit = getAngleConverter();
  const toDegreesUnit = getAngleInverseConverter();

  set(State.mass.brush, State.mass.color, 1);
  wiggle(2 - precision);
  if (outline) drawMassOutline(pols[0]);

  drawMassPass(
    pols[0],
    hatchDist * 0.9,
    fromDegrees(baseAngle),
    {
      gradient,
      rand: 2 - 2 * precision,
      continuous: true,
    },
    pivotBias,
    toAngleUnit,
    toDegreesUnit,
  );

  if (strength > 0.33) {
    drawMassPass(
      pols[1],
      hatchDist,
      fromDegrees(baseAngle + 20 * rr2(-1, 1)),
      {
        gradient,
        rand: 0.6 - 0.6 * precision,
        continuous: true,
      },
      pivotBias,
      toAngleUnit,
      toDegreesUnit,
    );
  }

  if (strength > 0.66) {
    drawMassPass(
      pols[2],
      hatchDist * 0.8,
      fromDegrees(baseAngle + 15 * rr2(-1, 1)),
      {
        gradient,
        rand: 0.6 - 0.6 * precision,
        continuous: true,
      },
      pivotBias,
      toAngleUnit,
      toDegreesUnit,
    );
  }

  BrushSetState(brushState);
  HatchSetState(hatchState);
  State.field = { ...fieldState };
}

export function createMassArray(polygons) {
  return createMass(polygons, false);
}

// ---------------------------------------------------------------------------
// Prototype Extensions
// ---------------------------------------------------------------------------

/**
 * Applies massing to polygon geometry.
 */
Polygon.prototype.mass = function () {
  if (State.mass?.isActive) {
    createMass(this, false);
  }
  return this;
};

/**
 * Applies massing to plots by generating their polygon first.
 * @param {number} x
 * @param {number} y
 * @param {number} scale
 */
Plot.prototype.mass = function (x, y, scale) {
  if (State.mass?.isActive) {
    if (this.origin) ((x = this.origin[0]), (y = this.origin[1]), (scale = 1));
    createMass(this, x, y, scale);
  }
  return this;
};
