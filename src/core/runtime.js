// =============================================================================
// Runtime Hooks
// =============================================================================

const identityMatrix = {
  a: 1,
  b: 0,
  c: 0,
  d: 1,
  x: 0,
  y: 0,
};

export let usesRadians = () => false;
export let fromDegrees = (angle) => angle;
export let createColor = () => {
  throw new Error("No runtime color adapter registered.");
};
export let getAffineMatrix = () => identityMatrix;

/**
 * Registers or updates host-runtime hooks used by core modules.
 *
 * @param {object} hooks
 */
export function setRuntime(hooks) {
  if (hooks.usesRadians) usesRadians = hooks.usesRadians;
  if (hooks.fromDegrees) fromDegrees = hooks.fromDegrees;
  if (hooks.createColor) createColor = hooks.createColor;
  if (hooks.getAffineMatrix) getAffineMatrix = hooks.getAffineMatrix;
}
