import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  arc,
  getHatchLines,
  mockState,
  set,
  wiggle,
} = vi.hoisted(() => ({
  arc: vi.fn(),
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
  BrushSetState: () => {},
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

import { createMassArray, mass } from "../../src/hatch/mass.js";
import { Polygon } from "../../src/core/polygon.js";

describe("createMassArray()", () => {
  beforeEach(() => {
    arc.mockClear();
    getHatchLines.mockClear();
    set.mockClear();
    wiggle.mockClear();
    mockState.mass = {
      isActive: false,
      brush: null,
      color: null,
      options: {},
    };
  });

  it("passes polygon arrays through the mass pipeline as combined layers", () => {
    mass("HB", "#000", { strength: 1, precision: 0.5, gradient: 0.1 });

    const outer = new Polygon([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ]);
    const inner = new Polygon([
      [3, 3],
      [7, 3],
      [7, 7],
      [3, 7],
    ]);

    expect(() => createMassArray([outer, inner])).not.toThrow();
    expect(getHatchLines).toHaveBeenCalled();
    expect(getHatchLines.mock.calls[0][0]).toHaveLength(2);
    expect(Array.isArray(getHatchLines.mock.calls[0][0])).toBe(true);
    expect(arc).toHaveBeenCalled();
  });
});