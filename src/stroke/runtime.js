// =============================================================================
// Stroke Runtime Hooks
// =============================================================================

let strokeRuntime = {
  createTipSurface: () => {
    throw new Error("No stroke runtime adapter registered.");
  },
  loadImageTip: () => {
    throw new Error("No stroke runtime adapter registered.");
  },
};

/**
 * Registers or updates host stroke hooks used by brush-tip loading code.
 *
 * @param {object} hooks
 */
export function setStrokeRuntime(hooks) {
  strokeRuntime = { ...strokeRuntime, ...hooks };
}

export const createTipSurface = (width, height) =>
  strokeRuntime.createTipSurface(width, height);
export const loadImageTip = (src, imageToWhite) =>
  strokeRuntime.loadImageTip(src, imageToWhite);
