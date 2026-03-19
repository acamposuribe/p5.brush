// =============================================================================
// Adapter: Standalone Frame Helpers
// =============================================================================

import { Renderer, isCanvasReady } from "../../core/target.js";
import { Mix, flushActiveComposite } from "../../core/color.js";
import { createColor } from "../../core/runtime.js";

function resetCompositeState() {
  if (Mix.glMask) Mix.clearMask(Mix.glMask);
  if (Mix.mask) Mix.clearMask(Mix.mask);
  Mix.justChanged = false;
  Mix.isBlending = false;
  Mix.isBrush = null;
  Mix.cachedColor = null;
}

/**
 * Flushes any pending stroke/fill compositing into the active standalone target.
 *
 * Standalone users should call this at the end of a drawing pass or frame.
 */
export function render() {
  flushActiveComposite();
}

/**
 * Clears the active standalone target.
 *
 * With no arguments, clears to transparent white.
 * With a color, clears to that color at full opacity.
 *
 * @param {...*} args
 */
export function clear(...args) {
  isCanvasReady();
  resetCompositeState();

  const gl = Renderer.drawingContext;
  const color =
    args.length === 0
      ? [1, 1, 1, 0]
      : [...createColor(...args)._array.slice(0, 3), 1];

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.disable(gl.SCISSOR_TEST);
  gl.clearColor(color[0], color[1], color[2], color[3]);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
}
