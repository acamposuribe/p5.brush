// ============================================================
// p5.brush Unit Tests  (Vitest)
//
// Tests pure utility functions that have no browser dependency.
// Run:  npm test
// ============================================================

import { describe, it, expect, vi, beforeAll } from "vitest";

// Mock color.js (pulls in GLSL shaders and WebGL — not available in Node)
vi.mock("../src/core/color.js", () => ({
  Renderer: {
    angleMode: () => "radians",
    RADIANS: "radians",
    DEGREES: "degrees",
  },
  Mix: {},
  State: {},
  Cwidth: 800,
  Cheight: 600,
  isCanvasReady: () => {},
  isMixReady: () => {},
}));

import {
  map,
  constrain,
  dist,
  cos,
  sin,
  rotate,
  intersectLines,
  rr,
  randInt,
  seed,
  weightedRand,
} from "../src/core/utils.js";

// ---- map() ----
describe("map()", () => {
  it("maps midpoint correctly", () => {
    expect(map(5, 0, 10, 0, 100)).toBeCloseTo(50);
  });

  it("maps minimum", () => {
    expect(map(0, 0, 10, 0, 100)).toBeCloseTo(0);
  });

  it("maps maximum", () => {
    expect(map(10, 0, 10, 0, 100)).toBeCloseTo(100);
  });

  it("maps to inverted range", () => {
    expect(map(0, 0, 10, 100, 0)).toBeCloseTo(100);
    expect(map(10, 0, 10, 100, 0)).toBeCloseTo(0);
  });

  it("clamps when withinBounds=true", () => {
    expect(map(20, 0, 10, 0, 100, true)).toBeCloseTo(100);
    expect(map(-5, 0, 10, 0, 100, true)).toBeCloseTo(0);
  });

  it("does NOT clamp by default", () => {
    expect(map(20, 0, 10, 0, 100)).toBeCloseTo(200);
  });
});

// ---- constrain() ----
describe("constrain()", () => {
  it("returns value when within bounds", () => {
    expect(constrain(5, 0, 10)).toBe(5);
  });

  it("clamps to lower bound", () => {
    expect(constrain(-3, 0, 10)).toBe(0);
  });

  it("clamps to upper bound", () => {
    expect(constrain(15, 0, 10)).toBe(10);
  });

  it("handles equal bounds", () => {
    expect(constrain(7, 5, 5)).toBe(5);
  });
});

// ---- dist() ----
describe("dist()", () => {
  it("returns 0 for same point", () => {
    expect(dist(3, 4, 3, 4)).toBe(0);
  });

  it("returns correct Euclidean distance", () => {
    expect(dist(0, 0, 3, 4)).toBeCloseTo(5);
  });

  it("is symmetric", () => {
    expect(dist(1, 2, 5, 6)).toBeCloseTo(dist(5, 6, 1, 2));
  });
});

// ---- cos() / sin() — degree-based lookup table ----
describe("cos() and sin()", () => {
  it("cos(0) === 1", () => expect(cos(0)).toBeCloseTo(1));
  it("cos(90) === 0", () => expect(cos(90)).toBeCloseTo(0, 3));
  it("cos(180) === -1", () => expect(cos(180)).toBeCloseTo(-1));
  it("sin(0) === 0", () => expect(sin(0)).toBeCloseTo(0, 3));
  it("sin(90) === 1", () => expect(sin(90)).toBeCloseTo(1));
  it("sin(180) === 0", () => expect(sin(180)).toBeCloseTo(0, 3));

  it("cos² + sin² === 1 for arbitrary angle", () => {
    const a = 37;
    expect(cos(a) ** 2 + sin(a) ** 2).toBeCloseTo(1);
  });

  it("handles negative angles", () => {
    expect(cos(-90)).toBeCloseTo(cos(270));
  });

  it("handles angles > 360", () => {
    expect(cos(450)).toBeCloseTo(cos(90));
  });
});

// ---- rotate() ----
describe("rotate()", () => {
  it("rotating (1,0) by 90° around origin gives ~(0,1)", () => {
    const r = rotate(0, 0, 1, 0, 90);
    expect(r.x).toBeCloseTo(0, 3);
    expect(r.y).toBeCloseTo(-1, 3); // y-down coordinate system
  });

  it("rotating by 0° returns same point", () => {
    const r = rotate(0, 0, 5, 3, 0);
    expect(r.x).toBeCloseTo(5);
    expect(r.y).toBeCloseTo(3);
  });

  it("rotating by 360° returns same point", () => {
    const r = rotate(2, 2, 7, 5, 360);
    expect(r.x).toBeCloseTo(7);
    expect(r.y).toBeCloseTo(5);
  });
});

// ---- intersectLines() ----
describe("intersectLines()", () => {
  const mkPt = (x, y) => ({ x, y });

  it("finds intersection of two crossing lines", () => {
    const pt = intersectLines(
      mkPt(0, 0),
      mkPt(10, 10),
      mkPt(0, 10),
      mkPt(10, 0),
      true,
    );
    expect(pt).not.toBe(false);
    expect(pt.x).toBeCloseTo(5);
    expect(pt.y).toBeCloseTo(5);
  });

  it("returns false for parallel lines", () => {
    const pt = intersectLines(
      mkPt(0, 0),
      mkPt(10, 0),
      mkPt(0, 5),
      mkPt(10, 5),
      true,
    );
    expect(pt).toBe(false);
  });

  it("returns false when intersection is outside second segment bounds (default)", () => {
    // Segment 1: long horizontal at y=-5
    // Segment 2: short vertical from y=0 to y=3 — intersection at y=-5 is outside it
    const pt = intersectLines(
      mkPt(0, -5),
      mkPt(10, -5),
      mkPt(5, 0),
      mkPt(5, 3),
    );
    expect(pt).toBe(false);
  });

  it("returns false for point-like segments", () => {
    const pt = intersectLines(mkPt(0, 0), mkPt(0, 0), mkPt(1, 0), mkPt(2, 0));
    expect(pt).toBe(false);
  });
});

// ---- rr() and randInt() — seeded RNG ----
describe("rr() — seeded random", () => {
  beforeAll(() => seed(42));

  it("returns a number in [min, max)", () => {
    for (let i = 0; i < 50; i++) {
      const v = rr(5, 10);
      expect(v).toBeGreaterThanOrEqual(5);
      expect(v).toBeLessThan(10);
    }
  });

  it("default range is [0, 1)", () => {
    for (let i = 0; i < 50; i++) {
      const v = rr();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("produces consistent values with same seed", () => {
    seed(1234);
    const a = rr(0, 100);
    seed(1234);
    const b = rr(0, 100);
    expect(a).toBeCloseTo(b);
  });
});

describe("randInt()", () => {
  beforeAll(() => seed(42));

  it("returns integers in range", () => {
    for (let i = 0; i < 100; i++) {
      const v = randInt(0, 10);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
    }
  });
});

// ---- weightedRand() ----
describe("weightedRand()", () => {
  beforeAll(() => seed(99));

  it("always returns a key from the weights object", () => {
    const weights = { a: 1, b: 2, c: 7 };
    for (let i = 0; i < 100; i++) {
      const v = weightedRand(weights);
      expect(["a", "b", "c"]).toContain(String(v));
    }
  });

  it("returns numeric keys as numbers", () => {
    const weights = { 1: 1, 2: 2, 3: 7 };
    for (let i = 0; i < 100; i++) {
      const v = weightedRand(weights);
      expect(typeof v).toBe("number");
    }
  });

  it("strongly favours the high-weight key", () => {
    const weights = { rare: 1, common: 999 };
    seed(0);
    const counts = { rare: 0, common: 0 };
    for (let i = 0; i < 500; i++) {
      const v = String(weightedRand(weights));
      counts[v]++;
    }
    // common should win more than 98% of the time
    expect(counts.common).toBeGreaterThan(480);
  });
});
