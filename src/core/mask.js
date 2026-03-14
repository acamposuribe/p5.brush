import { Mix } from "./color.js";

function transformPoint(matrix, x, y) {
  return {
    x: matrix.a * x + matrix.c * y + matrix.e,
    y: matrix.b * x + matrix.d * y + matrix.f,
  };
}

function strokePadding(ctx, matrix) {
  const lineWidth = ctx.lineWidth || 0;
  if (lineWidth <= 0) return 1;

  return (
    1 +
    (lineWidth * Math.max(Math.hypot(matrix.a, matrix.c), Math.hypot(matrix.b, matrix.d))) /
      2
  );
}

// =============================================================================
// Section: Draw shapes to Mask Buffers
// =============================================================================

/**
 * Draws a polygon to the mask using the provided vertices.
 * @param {Array<{x: number, y: number}>} vertices - Array of vertex coordinates.
 */
export function drawPolygon(vertices) {
  const ctx = Mix.ctx;
  const matrix = ctx.getTransform();
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;

  ctx.beginPath();
  vertices.forEach((v, i) => {
    const point = transformPoint(matrix, v.x, v.y);
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);

    if (i === 0) ctx.moveTo(v.x, v.y);
    else ctx.lineTo(v.x, v.y);
  });
  ctx.closePath();

  const padding = strokePadding(ctx, matrix);
  Mix.markDirtyRect(Mix.mask, {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
  });
}

/**
 * Draws a circle to the mask.
 * @param {number} x - X-coordinate of the circle's center.
 * @param {number} y - Y-coordinate of the circle's center.
 * @param {number} d - Diameter of the circle.
 */
export function circle(x, y, d) {
  const PI2 = Math.PI * 2;
  const ctx = Mix.ctx;
  const matrix = ctx.getTransform();
  const radius = d / 2;
  const center = transformPoint(matrix, x, y);
  const rx = radius * Math.hypot(matrix.a, matrix.c);
  const ry = radius * Math.hypot(matrix.b, matrix.d);
  const padding = strokePadding(ctx, matrix);

  Mix.markDirtyRect(Mix.mask, {
    minX: center.x - rx - padding,
    minY: center.y - ry - padding,
    maxX: center.x + rx + padding,
    maxY: center.y + ry + padding,
  });

  ctx.moveTo(x + radius, y);
  ctx.arc(x, y, radius, 0, PI2);
}
