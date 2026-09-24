import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockState } = vi.hoisted(() => ({ mockState: {} }));

vi.mock("../../src/core/color.js", () => ({
  Mix: {},
  State: mockState,
  isCanvasReady: () => {},
  isMixReady: () => {},
}));
vi.mock("../../src/core/runtime.js", () => ({
  usesRadians: () => false,
  fromDegrees: (angle) => angle,
  createColor: () => ({}),
  getAffineMatrix: () => ({ a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 }),
  setRuntime: () => {},
}));
vi.mock("../../src/core/target.js", () => ({
  Renderer: { angleMode: () => "degrees", RADIANS: "radians", DEGREES: "degrees" },
  Cwidth: 800,
  Cheight: 600,
}));
vi.mock("../../src/stroke/stroke.js", () => ({
  BrushState: () => ({}), BrushSetState: () => {}, set: () => {}, line: () => {},
}));
vi.mock("../../src/core/polygon.js", () => ({ Polygon: class Polygon {} }));
vi.mock("../../src/core/plot.js", () => ({ Plot: class Plot {} }));

import { getHatchLines, hatch } from "../../src/hatch/hatch.js";

function square(x, y, size) {
  return { a: [[x, y], [x + size, y], [x + size, y + size], [x, y + size]] };
}

beforeEach(() => {
  mockState.hatch = { isActive: false, dist: 5, angle: 45, options: {}, hBrush: false };
});

describe("hatch polygon arrays", () => {
  it("uses even-odd crossings so a nested polygon remains a hole", () => {
    hatch(4, 0, { rand: 0, continuous: false, gradient: false });
    const lines = getHatchLines([square(0, 0, 10), square(3, 3, 4)])
      .filter((line) => !line.isConnector);
    const center = lines
      .filter((line) => line.y1 === 6 && line.y2 === 6)
      .sort((a, b) => a.x1 - b.x1);

    expect(center).toHaveLength(2);
    expect(center.map(({ x1, x2 }) => [x1, x2])).toEqual([[0, 3], [7, 10]]);
  });
});
