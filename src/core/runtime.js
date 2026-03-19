// =============================================================================
// Runtime Hooks
// =============================================================================

let runtime = {
  usesRadians: () => false,
  fromDegrees: (angle) => angle,
  createColor: () => {
    throw new Error("No runtime color adapter registered.");
  },
  getAffineMatrix: () => ({
    a: 1,
    b: 0,
    c: 0,
    d: 1,
    x: 0,
    y: 0,
  }),
};

/**
 * Registers or updates host-runtime hooks used by core modules.
 *
 * @param {object} hooks
 */
export function setRuntime(hooks) {
  runtime = { ...runtime, ...hooks };
}

/**
 * Returns whether the active host runtime currently uses radians.
 *
 * @returns {boolean}
 */
export const usesRadians = () => runtime.usesRadians();

/**
 * Converts a degree value into the current host runtime's angle unit.
 *
 * @param {number} angle
 * @returns {number}
 */
export const fromDegrees = (angle) => runtime.fromDegrees(angle);

/**
 * Creates a runtime-native color object from user-facing color inputs.
 *
 * @param {...*} args
 * @returns {*}
 */
export const createColor = (...args) => runtime.createColor(...args);

/**
 * Returns the current 2D affine transform exposed by the active runtime.
 *
 * The returned object uses the canonical form:
 * `{ a, b, c, d, x, y }`
 * where `(a*x + c*y + tx, b*x + d*y + ty)` transforms a point.
 *
 * @returns {{a:number,b:number,c:number,d:number,x:number,y:number}}
 */
export const getAffineMatrix = () => runtime.getAffineMatrix();
