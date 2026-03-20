import { describe, it, expect, vi } from "vitest";

vi.mock("../src/core/color.js", () => ({
  Mix: {},
  State: {},
  isCanvasReady: () => {},
  registerStrokeComposite: () => {},
}));

vi.mock("../src/core/target.js", () => ({
  Cwidth: 800,
  Cheight: 600,
  Renderer: {},
  Instance: null,
}));

vi.mock("../src/core/utils.js", () => ({
  rr: () => 0,
  map: (value, start1, stop1, start2, stop2) =>
    start2 + ((value - start1) / (stop1 - start1 || 1)) * (stop2 - start2),
  dist: () => 0,
  randInt: () => 0,
  calcAngle: () => 0,
  toDegrees: (v) => v,
  gaussian: () => 0,
  rArray: () => 0,
  noise: () => 0,
  _onSeed: () => {},
}));

vi.mock("../src/core/flowfield.js", () => ({
  Position: class Position {},
  Matrix: {
    a: () => 1,
    b: () => 0,
    c: () => 0,
    d: () => 1,
    x: () => 0,
    y: () => 0,
  },
  isFieldReady: () => {},
}));

vi.mock("../src/core/polygon.js", () => ({
  Polygon: class Polygon {},
}));

vi.mock("../src/core/plot.js", () => ({
  Plot: class Plot {},
}));

vi.mock("../src/stroke/gl_draw.js", () => ({
  isReady: () => {},
  glDraw: () => {},
  glDrawImages: () => {},
  circle: () => {},
  stampImage: () => {},
  invalidateTexEntry: () => {},
  snapshotMatrix: () => {},
}));

import { add, box, normalizePressure } from "../../src/stroke/stroke.js";

describe("normalizePressure()", () => {
  it("keeps function pressure in explicit custom mode", () => {
    const curve = (t) => t;
    expect(normalizePressure(curve)).toEqual({
      type: "custom",
      min_max: [0, 1],
      curve,
      variation: {
        offset: 0.08,
        scale: 0.08,
        warp: 0.06,
        tilt: 0.06,
      },
    });
  });

  it("normalizes explicit gaussian mode objects", () => {
    expect(
      normalizePressure({
        mode: "gaussian",
        curve: [0.15, 0.2],
        min_max: [1.1, 0.9],
      }),
    ).toEqual({
      mode: "gaussian",
      type: "gaussian",
      curve: [0.15, 0.2],
      min_max: [1.1, 0.9],
    });
  });

  it("preserves legacy gaussian objects while making the mode explicit", () => {
    expect(
      normalizePressure({
        curve: [0.35, 0.25],
        min_max: [1.2, 0.85],
      }),
    ).toEqual({
      type: "gaussian",
      curve: [0.35, 0.25],
      min_max: [1.2, 0.85],
    });
  });

  it("adds subtle default variation to simplified array pressure", () => {
    expect(normalizePressure([0.5, 1.5, 0.5])).toMatchObject({
      type: "custom",
      min_max: [0.5, 1.5],
      variation: {
        offset: 0.08,
        scale: 0.08,
        warp: 0.06,
        tilt: 0.06,
      },
    });
  });
});

describe("brush.add()", () => {
  it("accepts gaussian pressure objects for custom brushes", () => {
    add("gaussian-test-brush", {
      weight: 0.3,
      scatter: 0.6,
      sharpness: 0.3,
      grain: 10,
      opacity: 170,
      spacing: 0.1,
      pressure: {
        mode: "gaussian",
        curve: [0.15, 0.2],
        min_max: [1.1, 0.9],
      },
    });

    expect(box()).toContain("gaussian-test-brush");
  });
});
