// ============================================================
// Standalone Color parsing (Vitest)
//
// Covers the argument forms Color accepts and, more importantly, what it does
// with input it cannot parse. A non-finite channel must not reach _array: the
// compositor compares _array against the cached colour to decide whether a
// stroke can keep accumulating into the pending mask, and NaN !== NaN makes
// every stroke read as a colour change, silently disabling stroke batching.
// ============================================================

import { describe, it, expect, vi } from "vitest";

// Color lives beside the runtime hooks, and that module imports core/save.js,
// which reaches GLSL sources through core/color.js. Node cannot load those.
// Color itself needs none of it.
vi.mock("../../src/core/save.js", () => ({ push: () => {}, pop: () => {} }));

const { Color } = await import("../../src/adapters/standalone/runtime.js");

describe("Color", () => {
  it("accepts three numeric channels", () => {
    expect(new Color(255, 128, 0)._array).toEqual([1, 128 / 255, 0, 1]);
  });

  it("accepts an array, matching what p5's own color() takes", () => {
    expect(new Color([255, 128, 0])._array).toEqual(new Color(255, 128, 0)._array);
  });

  it("reads alpha from a four-element array", () => {
    expect(new Color([255, 0, 0, 0.5])._array).toEqual([1, 0, 0, 0.5]);
  });

  it("accepts an rgb() string", () => {
    // Hex and named colours are resolved through a canvas context, which the
    // Node test environment does not provide, so they are covered by the
    // browser suites rather than here.
    expect(new Color("rgb(255,128,0)")._array).toEqual(new Color(255, 128, 0)._array);
  });

  it("copies an existing Color", () => {
    const source = new Color(10, 20, 30);
    expect(new Color(source)._array).toEqual(source._array);
  });

  it("clamps out-of-range channels instead of rejecting them", () => {
    expect(new Color(300, -20, 0)._array).toEqual([1, 0, 0, 1]);
  });

  it("throws rather than producing a NaN channel", () => {
    expect(() => new Color({})).toThrow(/Invalid color value/);
    expect(() => new Color(NaN)).toThrow(/Invalid color value/);
    expect(() => new Color([1, "x", 3])).toThrow(/Invalid color value/);
  });

  it("never puts a non-finite value in _array", () => {
    for (const args of [[0, 0, 0], [[1, 2, 3]], [[4, 5, 6, 0.25]], [255]]) {
      expect(new Color(...args)._array.every(Number.isFinite)).toBe(true);
    }
  });

  it("compares equal for equal input, so batching can dedupe by colour", () => {
    // The compositor's colour-change check is a componentwise compare of
    // _array. Two separately constructed but equal colours must not read as a
    // change, or every stroke forces its own composite pass.
    const a = new Color([20, 20, 20])._array;
    const b = new Color([20, 20, 20])._array;
    expect(a.every((v, i) => v === b[i])).toBe(true);
  });
});
