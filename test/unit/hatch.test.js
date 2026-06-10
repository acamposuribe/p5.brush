// ============================================================
// p5.brush – Hatch characterization tests
//
// Characterizes getHatchLines() / hatch() behavior so that
// future refactors can be verified. Tests pin TODAY's behavior.
// Run:  npx vitest run test/unit/hatch.test.js
// ============================================================

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Hoisted mock state (mirrors unit.test.js pattern) ----
const { currentAngleMode, mockState } = vi.hoisted(() => ({
  currentAngleMode: { value: "radians" },
  mockState: {},
}));

vi.mock("../../src/core/color.js", () => ({
  Mix: {},
  State: mockState,
  isCanvasReady: () => {},
  isMixReady: () => {},
}));

vi.mock("../../src/core/runtime.js", () => ({
  usesRadians: () => currentAngleMode.value === "radians",
  fromDegrees: (angle) =>
    currentAngleMode.value === "radians" ? (angle * Math.PI) / 180 : angle,
  createColor: () => ({}),
  getAffineMatrix: () => ({ a: 1, b: 0, c: 0, d: 1, x: 0, y: 0 }),
  setRuntime: () => {},
}));

vi.mock("../../src/core/target.js", () => ({
  Renderer: {
    angleMode: () => currentAngleMode.value,
    RADIANS: "radians",
    DEGREES: "degrees",
    _renderer: {
      uModelMatrix: {
        mat4: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      },
    },
  },
  Cwidth: 800,
  Cheight: 600,
}));

vi.mock("../../src/stroke/stroke.js", () => ({
  BrushState: () => ({}),
  BrushSetState: () => {},
  set: () => {},
  line: () => {},
}));

vi.mock("../../src/core/polygon.js", () => ({
  Polygon: class Polygon {},
}));

vi.mock("../../src/core/plot.js", () => ({
  Plot: class Plot {},
}));

import { hatch, getHatchLines, noHatch } from "../../src/hatch/hatch.js";
import { seed } from "../../src/core/utils.js";

// ---- Polygon factory ----
// hatch.js uses polygon.a — an array of [x, y] tuples
function makeSquare(x0 = 0, y0 = 0, size = 100) {
  return {
    a: [
      [x0,        y0],
      [x0 + size, y0],
      [x0 + size, y0 + size],
      [x0,        y0 + size],
    ],
  };
}

beforeEach(() => {
  currentAngleMode.value = "radians";
  // Reset hatch state before each test
  if (mockState.hatch) {
    mockState.hatch.isActive = false;
    mockState.hatch.dist = 5;
    mockState.hatch.angle = 45;
    mockState.hatch.options = {};
    mockState.hatch.hBrush = false;
  }
  seed(12345);
});

// ---------------------------------------------------------------------------
// 1. Horizontal scanlines (angle = 0)
// ---------------------------------------------------------------------------
describe("getHatchLines() — angle 0 → horizontal lines", () => {
  it("returns a non-empty array for a 100×100 square at dist=10", () => {
    hatch(10, 0, { rand: 0, continuous: false, gradient: false });
    const lines = getHatchLines(makeSquare()).filter((l) => !l.isConnector);
    expect(lines.length).toBeGreaterThan(0);
  });

  it("every line has y1 === y2 (horizontal)", () => {
    hatch(10, 0, { rand: 0, continuous: false, gradient: false });
    const lines = getHatchLines(makeSquare()).filter((l) => !l.isConnector);
    for (const line of lines) {
      expect(line.y1).toBeCloseTo(line.y2, 5);
    }
  });

  it("produces approximately dist=10 spacing for 100-unit square", () => {
    hatch(10, 0, { rand: 0, continuous: false, gradient: false });
    const lines = getHatchLines(makeSquare()).filter((l) => !l.isConnector);
    // 100 units / 10 dist → expect ~9 scanlines (first at 5, last at 95)
    // Characterize: between 8 and 11 lines
    expect(lines.length).toBeGreaterThanOrEqual(8);
    expect(lines.length).toBeLessThanOrEqual(11);
  });
});

// ---------------------------------------------------------------------------
// 2. Vertical scanlines (angle = 90)
// ---------------------------------------------------------------------------
describe("getHatchLines() — angle 90 → vertical lines", () => {
  it("every non-connector line has x1 === x2 (vertical)", () => {
    // angle 90 in degrees mode
    currentAngleMode.value = "degrees";
    hatch(10, 90, { rand: 0, continuous: false, gradient: false });
    const lines = getHatchLines(makeSquare()).filter((l) => !l.isConnector);
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(line.x1).toBeCloseTo(line.x2, 5);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Nested squares (donut) — even-odd parity
// ---------------------------------------------------------------------------
describe("getHatchLines() — nested squares produce two runs per hole scanline", () => {
  it("pairs crossings with even-odd parity (mirrors unit.test.js)", () => {
    hatch(4, 0, { rand: 0, continuous: false, gradient: false });

    const outer = makeSquare(0, 0, 10);
    const inner = makeSquare(3, 3, 4); // inner square at (3,3)-(7,7)

    const lines = getHatchLines([outer, inner]).filter((l) => !l.isConnector);
    // Scanline at y=6 crosses outer (enter+exit) and inner (enter+exit) → 2 segments
    const centerLines = lines
      .filter((l) => Math.abs(l.y1 - 6) < 0.01 && Math.abs(l.y2 - 6) < 0.01)
      .sort((a, b) => a.x1 - b.x1);

    expect(centerLines).toHaveLength(2);
    expect(centerLines[0].x1).toBeCloseTo(0);
    expect(centerLines[0].x2).toBeCloseTo(3);
    expect(centerLines[1].x1).toBeCloseTo(7);
    expect(centerLines[1].x2).toBeCloseTo(10);
  });

  it("donut produces more total lines than a solid square of equal outer size", () => {
    // The hole creates extra segments per scanline in the inner region
    hatch(4, 0, { rand: 0, continuous: false, gradient: false });
    const solid = getHatchLines(makeSquare(0, 0, 10)).filter((l) => !l.isConnector);
    const donut = getHatchLines([makeSquare(0, 0, 10), makeSquare(3, 3, 4)]).filter(
      (l) => !l.isConnector,
    );
    // Donut has the inner 4 scanlines split into 2 each → more total lines
    expect(donut.length).toBeGreaterThan(solid.length);
  });
});

// ---------------------------------------------------------------------------
// 4. Gradient option → spacing increases monotonically
// ---------------------------------------------------------------------------
describe("getHatchLines() — gradient > 0 increases scanline spacing", () => {
  it("y-gaps between consecutive scanlines are non-decreasing", () => {
    hatch(5, 0, { rand: 0, continuous: false, gradient: 0.8 });
    const lines = getHatchLines(makeSquare(0, 0, 200)).filter((l) => !l.isConnector);
    // Need enough lines for a meaningful assertion
    expect(lines.length).toBeGreaterThanOrEqual(3);

    const ys = lines.map((l) => l.y1);
    for (let i = 1; i < ys.length - 1; i++) {
      expect(ys[i + 1] - ys[i]).toBeGreaterThanOrEqual(ys[i] - ys[i - 1] - 1e-9);
    }
  });
});

// ---------------------------------------------------------------------------
// 5. Degenerate polygon (2 vertices, zero area)
// ---------------------------------------------------------------------------
describe("getHatchLines() — degenerate polygon", () => {
  it("returns empty array (no throw) for a 2-vertex polygon", () => {
    hatch(5, 0, { rand: 0, continuous: false, gradient: false });
    const degenerate = { a: [[0, 0], [10, 0]] }; // collinear, zero area
    let result;
    expect(() => {
      result = getHatchLines(degenerate);
    }).not.toThrow();
    // No scanlines cross a zero-height polygon
    expect(result.filter((l) => !l.isConnector)).toHaveLength(0);
  });

  it("returns empty array for a single-vertex polygon", () => {
    hatch(5, 0, { rand: 0, continuous: false, gradient: false });
    const degenerate = { a: [[5, 5]] };
    let result;
    expect(() => {
      result = getHatchLines(degenerate);
    }).not.toThrow();
    expect(result.filter((l) => !l.isConnector)).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 6. noHatch() disables hatching (state check)
// ---------------------------------------------------------------------------
describe("noHatch()", () => {
  it("sets isActive to false and clears hBrush", () => {
    hatch(10, 0);
    noHatch();
    expect(mockState.hatch.isActive).toBe(false);
    expect(mockState.hatch.hBrush).toBe(false);
  });
});
