// ============================================================
// p5.brush Unit Tests  (Vitest)
//
// Tests pure utility functions that have no browser dependency.
// Run:  npm test
// ============================================================

import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";

const { currentAngleMode, mockState, plotInstances } = vi.hoisted(() => ({
  currentAngleMode: { value: "radians" },
  mockState: {},
  plotInstances: [],
}));

// Mock color.js (pulls in GLSL shaders and WebGL — not available in Node)
vi.mock("../src/core/color.js", () => ({
  Mix: {},
  State: mockState,
  isCanvasReady: () => {},
  isMixReady: () => {},
}));

vi.mock("../src/core/target.js", () => ({
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

vi.mock("../src/stroke/stroke.js", () => ({
  BrushState: () => ({}),
  BrushSetState: () => {},
  set: () => {},
  line: () => {},
}));

vi.mock("../src/core/polygon.js", () => ({
  Polygon: class Polygon {},
}));

vi.mock("../src/core/plot.js", () => ({
  Plot: class Plot {
    constructor(type) {
      this.type = type;
      this.addSegment = vi.fn();
      this.endPlot = vi.fn();
      this.draw = vi.fn();
      plotInstances.push(this);
    }
  },
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
  toDegreesSigned,
} from "../src/core/utils.js";
import { arc } from "../src/core/primitives.js";
import { Position, addField, field as activateField, noField } from "../src/core/flowfield.js";
import { hatch } from "../src/hatch/hatch.js";

beforeEach(() => {
  currentAngleMode.value = "radians";
  plotInstances.length = 0;
  if (mockState.field) {
    mockState.field.isActive = false;
    mockState.field.current = null;
    mockState.field.wiggle = 1;
  }
  if (mockState.hatch) {
    mockState.hatch.isActive = false;
    mockState.hatch.dist = 5;
    mockState.hatch.angle = 45;
    mockState.hatch.options = {};
    mockState.hatch.hBrush = false;
  }
});

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

describe("toDegreesSigned()", () => {
  it("matches p5's default radians mode when angleMode() has not been changed", () => {
    expect(toDegreesSigned(Math.PI / 2)).toBeCloseTo(90);
  });

  it("converts radians without wrapping signed angles", () => {
    currentAngleMode.value = "radians";
    expect(toDegreesSigned(-Math.PI / 4)).toBeCloseTo(-45);
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

describe("hatch()", () => {
  it("captures the hatch angle using the current angle mode at call time", () => {
    currentAngleMode.value = "radians";
    hatch(8, Math.PI / 2);
    expect(mockState.hatch.angle).toBeCloseTo(90);

    currentAngleMode.value = "degrees";
    expect(mockState.hatch.angle).toBeCloseTo(90);
  });
});

describe("arc()", () => {
  it("matches p5-style top-half arc geometry in degrees mode", () => {
    currentAngleMode.value = "degrees";

    arc(100, 120, 40, 20, 145);

    const plot = plotInstances.at(-1);
    expect(plot).toBeTruthy();
    expect(plot.addSegment).toHaveBeenCalledTimes(2);
    expect(plot.addSegment.mock.calls[0][0]).toBeCloseTo(110);
    expect(plot.addSegment.mock.calls[1][0]).toBeCloseTo(172.5);
    expect(plot.endPlot).toHaveBeenCalledWith(235, 1, true);
    expect(plot.draw.mock.calls[0][0]).toBeCloseTo(100 + 40 * cos(20));
    expect(plot.draw.mock.calls[0][1]).toBeCloseTo(120 - 40 * sin(20));
  });

  it("uses equivalent geometry in radians mode", () => {
    currentAngleMode.value = "radians";

    arc(100, 120, 40, (20 * Math.PI) / 180, (145 * Math.PI) / 180);

    const plot = plotInstances.at(-1);
    expect(plot).toBeTruthy();
    expect(plot.addSegment).toHaveBeenCalledTimes(2);
    expect(plot.addSegment.mock.calls[0][0]).toBeCloseTo(110);
    expect(plot.endPlot).toHaveBeenCalledWith(235, 1, true);
    expect(plot.draw.mock.calls[0][0]).toBeCloseTo(100 + 40 * cos(20));
    expect(plot.draw.mock.calls[0][1]).toBeCloseTo(120 - 40 * sin(20));
  });
});

describe("Position.moveTo()", () => {
  it("interprets its public direction argument using the current angle mode", () => {
    currentAngleMode.value = "radians";
    noField();

    const pos = new Position(400, 300);
    pos.moveTo(Math.PI / 2, 10, 10);

    expect(pos.x).toBeCloseTo(400, 3);
    expect(pos.y).toBeCloseTo(290, 3);
  });

  it("keeps the internal degree-based path stable", () => {
    currentAngleMode.value = "radians";
    noField();

    const pos = new Position(400, 300);
    pos._moveToDegrees(90, 10, 10);

    expect(pos.x).toBeCloseTo(400, 3);
    expect(pos.y).toBeCloseTo(290, 3);
  });
});

describe("addField()", () => {
  it("supports custom fields declared in radians without losing signed direction", () => {
    addField(
      "neg-radians-test",
      (_t, field) => {
        for (let c = 0; c < field.length; c++) {
          for (let r = 0; r < field[c].length; r++) {
            field[c][r] = -Math.PI / 4;
          }
        }
        return field;
      },
      { angleMode: "radians" },
    );

    activateField("neg-radians-test");
    mockState.field.wiggle = 2;

    const pos = new Position(400, 300);
    expect(pos.angle()).toBeCloseTo(-90, 3);
  });
});
