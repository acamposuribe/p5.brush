// =============================================================================
// Adapter: p5 Addon Registration
// =============================================================================

import { flushActiveComposite } from "../../core/color.js";
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
