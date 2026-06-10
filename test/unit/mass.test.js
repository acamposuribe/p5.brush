import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  arc,
  BrushSetState,
  getHatchLines,
  mockState,
  set,
  wiggle,
} = vi.hoisted(() => ({
  arc: vi.fn(),
  BrushSetState: vi.fn(),
  getHatchLines: vi.fn(() => [
    { x1: 0, y1: 0, x2: 10, y2: 0, isConnector: false },
  ]),
  mockState: {
    field: {},
  },
  set: vi.fn(),
  wiggle: vi.fn(),
}));

vi.mock("../../src/core/color.js", () => ({
  State: mockState,
}));

vi.mock("../../src/core/primitives.js", () => ({
  arc,
}));

vi.mock("../../src/core/plot.js", () => ({
  Plot: class Plot {},
}));

vi.mock("../../src/core/runtime.js", () => ({
  fromDegrees: (angle) => angle,
  usesRadians: () => false,
}));

vi.mock("../../src/hatch/hatch.js", () => ({
  HatchState: () => ({}),
  HatchSetState: () => {},
  hatch: () => {},
  getHatchLines,
}));

vi.mock("../../src/stroke/stroke.js", () => ({
  BrushState: () => ({}),
  BrushSetState,
  getBrushParams: () => ({ scatter: 1 }),
  set,
}));

vi.mock("../../src/core/flowfield.js", () => ({
  wiggle,
}));

vi.mock("../../src/core/utils.js", () => ({
  rr2: (min = 0, max = 1) => (min + max) / 2,
  dist: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
  calcAngle: (x1, y1, x2, y2) => {
    const deg = (Math.atan2(-(y2 - y1), x2 - x1) * 180) / Math.PI;
    return deg < 0 ? deg + 360 : deg;
  },
}));

vi.mock("../../src/core/polygon.js", () => ({
  Polygon: class Polygon {
    constructor(pointsArray) {
      this.a = pointsArray;
      this.vertices = pointsArray.map(([x, y]) => ({ x, y }));
    }

    draw() {}
  },
}));

import { createMass, createMassArray, mass } from "../../src/hatch/mass.js";
import { Polygon } from "../../src/core/polygon.js";

function makeSquarePolygon(x0 = 0, y0 = 0, size = 10) {
  return new Polygon([
    [x0,        y0],
    [x0 + size, y0],
    [x0 + size, y0 + size],
    [x0,        y0 + size],
  ]);
}

describe("createMassArray()", () => {
  beforeEach(() => {
    arc.mockClear();
    BrushSetState.mockClear();
    getHatchLines.mockClear();
    set.mockClear();
    wiggle.mockClear();
    mockState.mass = {
      isActive: false,
      brush: null,
      color: null,
      options: {},
    };
    mockState.field = { isActive: false };
  });

  // ---- existing test ----
  it("passes polygon arrays through the mass pipeline as combined layers", () => {
    mass("HB", "#000", { strength: 1, precision: 0.5, gradient: 0.1 });

    const outer = makeSquarePolygon(0, 0, 10);
    const inner = makeSquarePolygon(3, 3, 4);

    expect(() => createMassArray([outer, inner])).not.toThrow();
    expect(getHatchLines).toHaveBeenCalled();
    expect(getHatchLines.mock.calls[0][0]).toHaveLength(2);
    expect(Array.isArray(getHatchLines.mock.calls[0][0])).toBe(true);
    expect(arc).toHaveBeenCalled();
  });

  // ---- characterization: first arc call arguments ----
  it("first arc call receives a positive finite radius and finite start/end angles", () => {
    mass("HB", "#000", { strength: 1, precision: 0.5, gradient: 0.1 });
    createMassArray([makeSquarePolygon(0, 0, 10)]);

    expect(arc).toHaveBeenCalled();
    const firstCall = arc.mock.calls[0];
    // arc(cx, cy, radius, startAngle, endAngle)
    const [_cx, _cy, radius, startAngle, endAngle] = firstCall;
    expect(Number.isFinite(radius)).toBe(true);
    expect(radius).toBeGreaterThan(0);
    expect(Number.isFinite(startAngle)).toBe(true);
    expect(Number.isFinite(endAngle)).toBe(true);
  });

  // ---- characterization: single polygon createMass ----
  it("createMass with a single polygon calls getHatchLines and arc", () => {
    mass("HB", "#000", { strength: 1, precision: 0.5, gradient: 0.1 });
    const polygon = makeSquarePolygon(0, 0, 10);

    expect(() => createMass(polygon, false)).not.toThrow();
    expect(getHatchLines).toHaveBeenCalled();
    expect(arc).toHaveBeenCalled();
  });

  // ---- characterization: empty input ----
  it("createMassArray([]) does not throw (getPolygonBounds degenerates to Infinity/NaN)", () => {
    // Empty polygon array → getPolygonBounds produces Infinity/-Infinity bounds
    // and NaN size. This is KNOWN degenerate behavior (characterized, not fixed).
    getHatchLines.mockReturnValueOnce([]);
    getHatchLines.mockReturnValueOnce([]);
    getHatchLines.mockReturnValueOnce([]);
    mass("HB", "#000", { strength: 1, precision: 0.5, gradient: 0.1 });
    expect(() => createMassArray([])).not.toThrow();
    // No hatch lines → no arcs drawn
    expect(arc).not.toHaveBeenCalled();
  });

  // ---- characterization: brush state restore ----
  it("restores brush state after createMassArray completes", () => {
    mass("HB", "#000", { strength: 1, precision: 0.5, gradient: 0.1 });
    createMassArray([makeSquarePolygon(0, 0, 10)]);
    // BrushSetState should have been called to restore the saved brush state
    expect(BrushSetState).toHaveBeenCalled();
    // The value passed is what BrushState() returned — an empty object in our mock
    expect(BrushSetState.mock.calls[BrushSetState.mock.calls.length - 1][0]).toEqual({});
  });
});