import { describe, expect, it, vi } from "vitest";

vi.mock("../../src/core/color.js", () => ({
  Mix: {}, State: {}, isCanvasReady: () => {}, registerStrokeComposite: () => {},
}));
vi.mock("../../src/core/target.js", () => ({ Cwidth: 800, Cheight: 600, Renderer: {}, Instance: null }));
vi.mock("../../src/core/utils.js", () => ({
  rr: () => 0, map: (v, a, b, c, d) => c + ((v - a) / (b - a || 1)) * (d - c),
  dist: () => 0, randInt: () => 0, calcAngle: () => 0, toDegrees: (v) => v,
  gaussian: () => 0, rArray: () => 0, noise: () => 0, _onSeed: () => {},
}));
vi.mock("../../src/core/flowfield.js", () => ({
  Position: class Position {}, Matrix: { a: () => 1, b: () => 0, c: () => 0, d: () => 1, x: () => 0, y: () => 0 },
  isFieldReady: () => {},
}));
vi.mock("../../src/core/polygon.js", () => ({ Polygon: class Polygon {} }));
vi.mock("../../src/core/plot.js", () => ({ Plot: class Plot {} }));
vi.mock("../../src/stroke/gl_draw.js", () => ({
  isReady: () => {}, glDraw: () => {}, glDrawImages: () => {}, circle: () => {},
  stampImage: () => {}, invalidateTexEntry: () => {}, snapshotMatrix: () => {},
}));

import { normalizePressure } from "../../src/stroke/stroke.js";

describe("pressure profile compatibility", () => {
  it("preserves the explicit gaussian profile and its bounds", () => {
    const profile = { mode: "gaussian", curve: [0.15, 0.2], min_max: [1.1, 0.9] };
    expect(normalizePressure(profile)).toMatchObject({
      type: "gaussian", curve: [0.15, 0.2], min_max: [1.1, 0.9],
    });
  });

  it("continues to accept the legacy gaussian profile format", () => {
    expect(normalizePressure({ curve: [0.35, 0.25], min_max: [1.2, 0.85] })).toMatchObject({
      type: "gaussian", curve: [0.35, 0.25], min_max: [1.2, 0.85],
    });
  });
});
