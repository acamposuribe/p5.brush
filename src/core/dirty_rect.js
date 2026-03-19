// =============================================================================
// Module: Dirty Rect Utilities
// =============================================================================
/**
 * Expands a dirty rectangle outward by a constant padding value.
 *
 * @param {{minX:number,minY:number,maxX:number,maxY:number}|null} rect - Rect to expand.
 * @param {number} [padding=0] - Padding in pixels.
 * @returns {{minX:number,minY:number,maxX:number,maxY:number}|null} Expanded rect.
 */
export const expandDirtyRect = (rect, padding = 0) =>
  rect
    ? {
        minX: rect.minX - padding,
        minY: rect.minY - padding,
        maxX: rect.maxX + padding,
        maxY: rect.maxY + padding,
      }
    : null;

/**
 * Clamps a dirty rectangle to explicit target bounds.
 *
 * @param {{minX:number,minY:number,maxX:number,maxY:number}|null} rect - Candidate rect.
 * @param {number} width - Target width in physical pixels.
 * @param {number} height - Target height in physical pixels.
 * @returns {{minX:number,minY:number,maxX:number,maxY:number}|null} Clamped rect.
 */
export const normalizeDirtyRect = (rect, width, height) => {
  if (!rect) return null;

  const minX = Math.max(0, Math.floor(Math.min(rect.minX, rect.maxX)));
  const minY = Math.max(0, Math.floor(Math.min(rect.minY, rect.maxY)));
  const maxX = Math.min(width, Math.ceil(Math.max(rect.minX, rect.maxX)));
  const maxY = Math.min(height, Math.ceil(Math.max(rect.minY, rect.maxY)));

  if (maxX <= minX || maxY <= minY) return null;

  return { minX, minY, maxX, maxY };
};

/**
 * Returns the union of two dirty rectangles.
 *
 * @param {{minX:number,minY:number,maxX:number,maxY:number}|null} a - First rect.
 * @param {{minX:number,minY:number,maxX:number,maxY:number}|null} b - Second rect.
 * @returns {{minX:number,minY:number,maxX:number,maxY:number}|null} Union rect.
 */
export const unionDirtyRect = (a, b) => {
  if (!a) return b;
  if (!b) return a;

  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
};

/**
 * Returns a dirty rectangle covering the full target bounds.
 *
 * @param {number} width - Target width in physical pixels.
 * @param {number} height - Target height in physical pixels.
 * @returns {{minX:number,minY:number,maxX:number,maxY:number}} Full-target rect.
 */
export const getFullDirtyRect = (width, height) => ({
  minX: 0,
  minY: 0,
  maxX: width,
  maxY: height,
});
