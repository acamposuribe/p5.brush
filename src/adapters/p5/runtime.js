// =============================================================================
// Adapter: p5 Runtime Hooks
// =============================================================================

import { setRuntime } from "../../core/runtime.js";
import { Renderer } from "../../core/target.js";
import { getSketchRenderer } from "./target.js";

const getP5RuntimeRenderer = () =>
  Renderer ?? getSketchRenderer?.() ?? window.self?.p5?.instance ?? null;

export function initP5Runtime() {
  setRuntime({
    usesRadians: () =>
      !!getP5RuntimeRenderer() &&
      typeof getP5RuntimeRenderer().angleMode === "function" &&
      getP5RuntimeRenderer().angleMode() === getP5RuntimeRenderer().RADIANS,

    fromDegrees: (angle) =>
      !!getP5RuntimeRenderer() &&
      typeof getP5RuntimeRenderer().angleMode === "function" &&
      getP5RuntimeRenderer().angleMode() === getP5RuntimeRenderer().RADIANS
        ? (angle * Math.PI) / 180
        : angle,

    createColor: (...args) => {
      const renderer = getP5RuntimeRenderer();
      if (!renderer?.color) {
        throw new Error("p5 runtime color creation requires an active renderer.");
      }
      return renderer.color(...args);
    },

    getAffineMatrix: () => {
      const renderer = getP5RuntimeRenderer();
      const mat4 = renderer?._renderer?.uModelMatrix?.mat4;
      if (!mat4) {
        return {
          a: 1,
          b: 0,
          c: 0,
          d: 1,
          x: 0,
          y: 0,
        };
      }
      return {
        a: mat4[0],
        b: mat4[1],
        c: mat4[4],
        d: mat4[5],
        x: mat4[12],
        y: mat4[13],
      };
    },
  });
}
