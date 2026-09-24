import { beforeEach, describe, expect, it, vi } from "vitest";

const { currentAngleMode, plots } = vi.hoisted(() => ({
  currentAngleMode: { value: "degrees" },
  plots: [],
}));

vi.mock("../../src/core/runtime.js", () => ({
  usesRadians: () => currentAngleMode.value === "radians",
  fromDegrees: (angle) => currentAngleMode.value === "radians" ? angle * Math.PI / 180 : angle,
}));
vi.mock("../../src/core/target.js", () => ({
  Renderer: { angleMode: () => currentAngleMode.value, RADIANS: "radians", DEGREES: "degrees" },
}));
vi.mock("../../src/core/polygon.js", () => ({ Polygon: class Polygon {} }));
vi.mock("../../src/core/plot.js", () => ({
  Plot: class Plot {
    constructor() { this.addSegment = vi.fn(); this.endPlot = vi.fn(); this.draw = vi.fn(); plots.push(this); }
  },
}));

import { arc } from "../../src/core/primitives.js";
import { cos, sin } from "../../src/core/utils.js";

beforeEach(() => { plots.length = 0; });

describe("arc geometry", () => {
  it.each(["degrees", "radians"])("uses p5-style sweep and coordinates in %s mode", (mode) => {
    currentAngleMode.value = mode;
    const angle = (degrees) => mode === "radians" ? degrees * Math.PI / 180 : degrees;

    arc(100, 120, 40, angle(20), angle(145));

    const plot = plots[0];
    expect(plot.addSegment).toHaveBeenCalledTimes(2);
    expect(plot.addSegment.mock.calls[0][0]).toBeCloseTo(110);
    expect(plot.endPlot).toHaveBeenCalledWith(235, 1, true);
    expect(plot.draw.mock.calls[0][0]).toBeCloseTo(100 + 40 * cos(20));
    expect(plot.draw.mock.calls[0][1]).toBeCloseTo(120 - 40 * sin(20));
  });
});
