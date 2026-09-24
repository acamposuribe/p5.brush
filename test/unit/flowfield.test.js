import { describe, expect, it, vi } from "vitest";

const { currentAngleMode, mockState } = vi.hoisted(() => ({
  currentAngleMode: { value: "degrees" },
  mockState: {},
}));

vi.mock("../../src/core/color.js", () => ({
  Mix: {}, State: mockState, isCanvasReady: () => {}, isMixReady: () => {},
}));
vi.mock("../../src/core/runtime.js", () => ({
  usesRadians: () => currentAngleMode.value === "radians",
  fromDegrees: (angle) => currentAngleMode.value === "radians" ? angle * Math.PI / 180 : angle,
  createColor: () => ({}),
  getAffineMatrix: () => ({ a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 }),
  setRuntime: () => {},
}));
vi.mock("../../src/core/target.js", () => ({
  Renderer: {
    angleMode: () => currentAngleMode.value, RADIANS: "radians", DEGREES: "degrees",
    _renderer: { uModelMatrix: { mat4: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] } },
  },
  Cwidth: 800, Cheight: 600,
}));
vi.mock("../../src/stroke/stroke.js", () => ({
  BrushState: () => ({}), BrushSetState: () => {}, set: () => {}, line: () => {},
}));
vi.mock("../../src/core/polygon.js", () => ({ Polygon: class Polygon {} }));
vi.mock("../../src/core/plot.js", () => ({ Plot: class Plot {} }));

import { Position, addField, field, noField } from "../../src/core/flowfield.js";

describe("flowfield movement", () => {
  it("moves along the active field direction rather than the requested stroke direction", () => {
    addField("constant-down", (_time, grid) => {
      for (const column of grid) column.fill(90);
      return grid;
    }, { angleMode: "degrees" });
    field("constant-down");
    mockState.field.wiggle = 1;
    currentAngleMode.value = "degrees";

    const position = new Position(400, 300);
    position.moveTo(0, 10, 10);

    expect(position.x).toBeCloseTo(400, 1);
    expect(position.y).toBeCloseTo(310, 1);
    noField();
  });
});
