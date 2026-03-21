// =============================================================================
// Adapter: p5 Runtime Hooks
// =============================================================================

import { setRuntime } from "../../core/runtime.js";
import { Renderer } from "../../core/target.js";
import { getSketchRenderer } from "./target.js";

const getP5RuntimeRenderer = () =>
  Renderer ?? getSketchRenderer?.() ?? window.self?.p5?.instance ?? null;
const identityMatrix = {
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  x: 0,
  y: 0,
};
const affineMatrix = {
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  x: 0,
  y: 0,
};

function isRadians() {
  const renderer = getP5RuntimeRenderer();
  return !!renderer &&
    typeof renderer.angleMode === "function" &&
    renderer.angleMode() === renderer.RADIANS;
}

export function initP5Runtime() {
  setRuntime({
    usesRadians: isRadians,

    fromDegrees: (angle) =>
      isRadians() ? (angle * Math.PI) / 180 : angle,

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
      if (!mat4) return identityMatrix;

      affineMatrix.a = mat4[0];
      affineMatrix.b = mat4[1];
      affineMatrix.c = mat4[4];
      affineMatrix.d = mat4[5];
      affineMatrix.x = mat4[12];
      affineMatrix.y = mat4[13];
      return affineMatrix;
    },
  });
}
