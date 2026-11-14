// =============================================================================
// Adapter: p5 Addon Registration
// =============================================================================

import { flushActiveComposite, getLoadTarget } from "../../core/color.js";
import {
  instance as bindInstance,
  activateInstance,
  deactivateInstance,
  Renderer,
} from "../../core/target.js";
import { isReadyWebGLSketch } from "./target.js";
import { push as brushPush, pop as brushPop } from "../../core/save.js";
import { seed as brushSeed, noiseSeed as brushNoiseSeed } from "../../core/utils.js";

/**
 * Registers the p5 addon hooks that keep p5.brush in sync with p5's runtime.
 *
 * This stays in the p5 adapter layer so a future standalone build can provide
 * its own lifecycle integration without importing p5-specific globals.
 *
 * @param {*} _p5
 * @param {Object} fn
 * @param {Object} lifecycles
 */
export function registerP5Addon(_p5, fn, lifecycles) {
  lifecycles.presetup = function () {
    activateInstance(this);
  };

  lifecycles.predraw = function () {
    activateInstance(this);
  };

  lifecycles.postsetup = lifecycles.postdraw = function () {
    try {
      // Graphics targets belong to their parent sketch. Unrelated sketches
      // must not flush the shared compositor or initialize a brush target.
      if (Renderer === this || Renderer?._pInst === this) {
        bindInstance(this);
        flushActiveComposite();
      }
    } finally {
      deactivateInstance();
    }
  };

  // A p5.Framebuffer target is only bound inside its begin()/end() (or draw()) scope, and the
  // documented pattern calls brush.load() after leaving it. Flush brush work queued on that
  // framebuffer before end() unbinds it, or it would be composited into the next target.
  const FB = _p5 && _p5.Framebuffer;
  if (FB && FB.prototype && typeof FB.prototype.end === "function" && !FB.prototype.end.__brushFlush) {
    const _end = FB.prototype.end;
    const end = function () {
      if (getLoadTarget() === this) flushActiveComposite();
      return _end.apply(this, arguments);
    };
    end.__brushFlush = true;
    FB.prototype.end = end;
  }

  const _push = fn.push;
  const _pop = fn.pop;
  const _randomSeed = fn.randomSeed;
  const _noiseSeed = fn.noiseSeed;

  fn.push = function () {
    _push.call(this);
    if (isReadyWebGLSketch(this)) brushPush(this);
  };

  fn.pop = function () {
    _pop.call(this);
    if (isReadyWebGLSketch(this)) brushPop(this);
  };

  fn.randomSeed = function (s) {
    _randomSeed.call(this, s);
    brushSeed(s);
  };

  fn.noiseSeed = function (s) {
    _noiseSeed.call(this, s);
    brushNoiseSeed(s);
  };
}
