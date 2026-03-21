// =============================================================================
// Adapter: Standalone Frame Helpers
// =============================================================================

import { Renderer, isCanvasReady } from "../../core/target.js";
import { Mix, flushActiveComposite } from "../../core/color.js";
import { createColor, setRuntime } from "../../core/runtime.js";

// ---- render() reminder ----
// If drawing calls are made but render() is never called, nothing appears on
// screen. We detect this via the notifyDraw hook and warn once per cycle.

let _hasPendingDraw = false;
let _warnScheduled = false;

function onDraw() {
  if (_warnScheduled) return;
  _warnScheduled = true;
  _hasPendingDraw = true;
  requestAnimationFrame(() => {
    _warnScheduled = false;
    if (_hasPendingDraw) {
      console.warn(
        "[p5.brush] Drawing calls were made but brush.render() was never called. " +
        "Call brush.render() after your drawing code to flush to the canvas.",
      );
    }
  });
}

setRuntime({ notifyDraw: onDraw });

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
  _hasPendingDraw = false;
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
