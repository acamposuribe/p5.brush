// =============================================================================
// Module: Wash
// =============================================================================
/**
 * Minimal stateful API for the `wash()` fill modifier.
 * 
 * Wash provides a simpler, solid-color fill that uses the existing 2D canvas
 * pipeline instead of direct WebGL rendering, avoiding the need for polygon
 * triangulation.
 */

import { Cwidth, Cheight, Density, isCanvasReady } from "../core/target.js";
import { Mix, State } from "../core/color.js";
import { drawPolygon } from "./mask.js";
import { Polygon } from "../core/polygon.js";
import { Plot } from "../core/plot.js";
import { createColor, getAffineMatrix } from "../core/runtime.js";

State.wash = {
  color: null,
  opacity: 150,
  isActive: false,
};

// =============================================================================
// Public API
// =============================================================================

/**
 * Enables wash mode with a color and opacity.
 *
 * @param {number|string|Color} a - Either the red component, a CSS color string, or a Color object.
 * @param {number} [b] - The green component or the opacity if using grayscale.
 * @param {number} [c] - The blue component.
 * @param {number} [d] - The opacity.
 */
export function wash(a, b, c, d) {
  isCanvasReady();
  State.wash.opacity = (arguments.length < 4 ? b : d) ?? 150;
  State.wash.color = arguments.length < 3 ? createColor(a) : createColor(a, b, c);
  State.wash.isActive = true;
}

/**
 * Disables wash mode for subsequent drawing operations.
 */
export function noWash() {
  State.wash.isActive = false;
}

// =============================================================================
// Drawing Implementation
// =============================================================================

/**
 * Draws a solid wash fill to the polygon using the 2D canvas pipeline.
 * Follows the same pattern as fill() for consistency with the color caching system.
 *
 * @param {Polygon} polygon - The polygon to fill with the current wash state.
 */
function drawWashPolygon(polygon) {
  if (!State.wash?.isActive || !State.wash.color || polygon.vertices.length < 3) return;

  // Track if we're switching from brush to fill mode
  const switchingToWash = Mix.isBrush !== false;
  Mix.isBrush = false;
  if (switchingToWash) Mix.justChanged = true;

  // CRITICAL: Call Mix.blend() BEFORE drawing!
  // This checks if color changed and composites previous mask if needed.
  // Our drawing will go to the mask and composite on the next draw call.
  Mix.blend(State.wash.color);

  // Get the user's affine transform matrix
  const m = getAffineMatrix();
  
  // Apply transform with Density and centering (exactly like fill does)
  Mix.ctx.save();
  Mix.ctx.setTransform(
    Density * m.a,
    Density * m.b,
    Density * m.c,
    Density * m.d,
    Density * (m.x + Cwidth / 2),
    Density * (m.y + Cheight / 2),
  );
  
  // Draw the polygon path to the 2D canvas mask
  // This will update dirty rects automatically
  drawPolygon(polygon.vertices);
  
  // Set up fill and stroke with wash color (exactly like fill does)
  const alpha = State.wash.opacity / 255;
  const washColorBase = `rgb(255 0 0 / `;
  Mix.ctx.fillStyle = washColorBase + alpha + ")";
  
  Mix.ctx.fill();
  
  // Restore the context transform
  Mix.ctx.restore();
}

// =============================================================================
// Prototype methods
// =============================================================================

/**
 * Applies a wash fill to the polygon using the current wash state.
 *
 * @param {Color|string|false} [_color] - Optional override color for this call.
 * @param {number} [_opacity] - Optional override opacity for this call.
 */
Polygon.prototype.wash = function (_color = false, _opacity) {
  const state = { ...State.wash };
  if (_color !== false) wash(_color, _opacity);

  if (State.wash.isActive) {
    drawWashPolygon(this);
  }

  State.wash = { ...state };
};

/**
 * Applies wash to a plot by first generating the plot polygon, mirroring the
 * existing fill-path behavior, and then drawing that polygon with wash.
 *
 * @param {number} x - The x-coordinate.
 * @param {number} y - The y-coordinate.
 * @param {number} scale - The scale factor.
 */
Plot.prototype.wash = function (x, y, scale) {
  if (!State.wash?.isActive) return;
  if (this.origin) {
    x = this.origin[0];
    y = this.origin[1];
    scale = 1;
  }
  this.pol = this.genPol(x, y, scale, 0, -1);
  this.pol.wash();
};
