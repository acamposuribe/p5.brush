import { State } from "../core/color.js";
import { Cwidth, Cheight, Density } from "../core/target.js";

export const CLIP_UNIFORMS = ["u_clipEnabled", "u_clipMatrix", "u_clipBounds"];

// Clip in the call-time user coordinate space, not the stamp's current transform.
export function setClipUniforms(gl, uniforms) {
  const clip = State.stroke.clip;
  gl.uniform1i(uniforms.u_clipEnabled, !!clip);
  if (!clip) return;
  const { a, b, c, d, x, y } = clip.matrix;
  const det = a * d - b * c;
  if (!det) {
    gl.uniformMatrix3fv(uniforms.u_clipMatrix, false, [1, 0, 0, 0, 1, 0, 0, 0, 1]);
    gl.uniform4f(uniforms.u_clipBounds, 1, 1, 0, 0);
    return;
  }
  const ia = d / det, ib = -b / det, ic = -c / det, id = a / det;
  const tx = x + Cwidth / 2, ty = y + Cheight / 2;
  gl.uniformMatrix3fv(uniforms.u_clipMatrix, false, [
    ia / Density, ib / Density, 0,
    ic / Density, id / Density, 0,
    -ia * tx - ic * ty, -ib * tx - id * ty, 1,
  ]);
  gl.uniform4fv(uniforms.u_clipBounds, clip.bounds);
}
