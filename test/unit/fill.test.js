import { beforeEach, describe, expect, it, vi } from "vitest";

const { blend, mockCtx, mockState } = vi.hoisted(() => ({
  blend: vi.fn(),
  mockCtx: {
    beginPath: vi.fn(),
    fill: vi.fn(),
    restore: vi.fn(),
    save: vi.fn(),
    setTransform: vi.fn(),
    stroke: vi.fn(),
    getTransform: vi.fn(() => ({
      a: 1, b: 0, c: 0, d: 1, e: 0, f: 0,
    })),
    fillStyle: "",
    globalCompositeOperation: "source-over",
    lineCap: "round",
    lineWidth: 0,
    strokeStyle: "",
  },
  mockState: {},
}));

vi.mock("../../src/core/color.js", () => ({
  Mix: {
    blend,
    ctx: mockCtx,
    isBrush: true,
    justChanged: false,
  },
  State: mockState,
  registerFillComposite: () => {},
}));

vi.mock("../../src/core/target.js", () => ({
  Renderer: {
    color: () => ({
      _getBlue: () => 64,
      _getGreen: () => 128,
      _getRed: () => 255,
    }),
  },
  Cwidth: 800,
  Cheight: 600,
  Density: 1,
}));

vi.mock("../../src/fill/mask.js", () => ({
  circle: vi.fn(),
  drawPolygon: vi.fn(),
}));

vi.mock("../../src/core/flowfield.js", () => ({
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

vi.mock("../../src/core/polygon.js", () => ({
  Polygon: class Polygon {},
}));

vi.mock("../../src/core/plot.js", () => ({
  Plot: class Plot {},
}));

vi.mock("../../src/core/runtime.js", () => ({
  createColor: (r, g, b) => ({
    r: typeof r === 'string' ? 255 : r,
    g: g ?? r ?? 0,
    b: b ?? r ?? 0,
    _getRed: function() { return this.r; },
    _getGreen: function() { return this.g; },
    _getBlue: function() { return this.b; },
  }),
  getAffineMatrix: () => ({
    a: 1, b: 0, c: 0, d: 1, x: 0, y: 0,
  }),
}));

import { createFill, fill } from "../../src/fill/fill.js";

describe("createFill()", () => {
  beforeEach(() => {
    mockState.fill = {
      opacity: 150,
      bleed_strength: 0.07,
      texture_strength: 0.8,
      border_strength: 0.5,
      direction: "out",
      isActive: false,
    };

    blend.mockClear();
    mockCtx.beginPath.mockClear();
    mockCtx.fill.mockClear();
    mockCtx.restore.mockClear();
    mockCtx.save.mockClear();
    mockCtx.setTransform.mockClear();
    mockCtx.stroke.mockClear();
    mockCtx.globalCompositeOperation = "source-over";
  });

  it("does not throw for small polygons in the centroid fast path", () => {
    fill("#ff0000", 80);

    const vertices = [
      { x: 10, y: 10 },
      { x: 80, y: 10 },
      { x: 110, y: 45 },
      { x: 95, y: 90 },
      { x: 35, y: 100 },
      { x: 5, y: 55 },
    ];

    const polygon = {
      vertices,
      sides: vertices.map((vertex, index) => [
        vertex,
        vertices[(index + 1) % vertices.length],
      ]),
      intersect: () => [],
    };

    expect(() => createFill(polygon)).not.toThrow();
  });
});
