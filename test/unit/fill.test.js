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

import { createFill, fill, noFill } from "../../src/fill/fill.js";
import { seed } from "../../src/core/utils.js";

// Helper: builds a simple convex polygon object that fill.js expects.
function makePolygon(vertices) {
  return {
    vertices,
    sides: vertices.map((v, i) => [v, vertices[(i + 1) % vertices.length]]),
    intersect: () => [],
  };
}

// Hexagonal polygon (6 vertices — uses centroid "simple average" fast path)
function makeHexagon(cx = 50, cy = 50, r = 40) {
  const verts = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * 2 * Math.PI;
    verts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return makePolygon(verts);
}

// 10-vertex polygon (uses shoelace centroid path)
function makeDodecagon(cx = 50, cy = 50, r = 40) {
  const verts = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * 2 * Math.PI;
    verts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return makePolygon(verts);
}

describe("createFill()", () => {
  beforeEach(() => {
    mockState.fill = {
      opacity: 150,
      bleed_strength: 0.07,
      texture_strength: 0.8,
      border_strength: 0.5,
      direction: "out",
      scatter: true,
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

  // ---- existing test ----
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

  // ---- characterization tests ----

  it("throws the exact error message when fill is inactive", () => {
    // isActive is false (set in beforeEach)
    expect(() => createFill(makeHexagon())).toThrow(
      "No fill color set. Call brush.fill(color) before drawing shapes.",
    );
  });

  it("throws the exact error message when fill is active but color is unset", () => {
    mockState.fill.isActive = true;
    mockState.fill.color = undefined;
    expect(() => createFill(makeHexagon())).toThrow(
      "No fill color set. Call brush.fill(color) before drawing shapes.",
    );
  });

  it("does not throw after fill() activates fill state (hexagon — small polygon path)", () => {
    seed(12345);
    fill("#00ff00", 120);
    expect(() => createFill(makeHexagon())).not.toThrow();
  });

  it("does not throw after fill() activates fill state (10-vertex polygon — shoelace path)", () => {
    seed(12345);
    fill("#0000ff", 200);
    expect(() => createFill(makeDodecagon())).not.toThrow();
  });

  it("invokes ctx.save() and ctx.restore() once each per fill pass", () => {
    seed(12345);
    fill("#ff0000", 100);
    createFill(makeHexagon());
    expect(mockCtx.save).toHaveBeenCalled();
    expect(mockCtx.restore).toHaveBeenCalled();
    expect(mockCtx.save.mock.calls.length).toBe(mockCtx.restore.mock.calls.length);
  });

  it("calls blend at least once per fill pass (watercolor layering)", () => {
    seed(12345);
    fill("#aabbcc", 80);
    createFill(makeHexagon());
    expect(blend).toHaveBeenCalled();
  });

  it("noFill() disables the fill so createFill throws afterward", () => {
    fill("#ff0000", 100);
    noFill();
    expect(() => createFill(makeHexagon())).toThrow(
      "No fill color set. Call brush.fill(color) before drawing shapes.",
    );
  });
});
