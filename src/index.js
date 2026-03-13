/**
 * @fileoverview p5.brush - A comprehensive toolset for brush management in p5.js.
 * @version 2.0.0-alpha
 * @license MIT
 * @author Alejandro Campos Uribe
 *
 * @description
 * p5.brush is a p5.js library dedicated to the creation and management of custom brushes.
 * It extends the drawing capabilities of p5.js by allowing users to simulate a wide range
 * of brush strokes, vector fields, hatching patterns, and fill textures. These features
 * are essential for emulating the nuanced effects found in traditional sketching and painting.
 * Whether for digital art applications or procedural generation of graphics, p5.brush provides
 * a robust framework for artists and developers to create rich, dynamic, and textured visuals.
 *
 * @example
 * // Basic usage:
 * brush.pick('marker'); // Select brush type
 * brush.stroke(255, 0, 0); // Set brush color
 * brush.strokeWeight(10); // Set brush size
 * brush.line(25, 25, 75, 75); // Draw a line
 *
 * // Add a new brush type:
 * brush.add('customBrush', { /* parameters for the brush *\/ });
 * brush.pick('customBrush');
 *
 * // Use the custom brush for a vector-field line:
 * brush.field('field_name') // Pick a flowfield
 * brush.flowLine(50, 50, 100, PI / 4); // Draw a line within the vector-field
 *
 * // Fill textures:
 * brush.noStroke();
 * brush.fill('#FF0000', 90); // Set fill color to red and opacity to 90
 * brush.bleed(0.3); // Set bleed effect for a watercolor-like appearance
 * brush.rect(100, 100, 50, 50); // Fill a rectangle with the bleed effect
 *
 * @license
 * MIT License
 *
 * Copyright (c) 2023-2024 Alejandro Campos Uribe
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

// Randomness and other auxiliary functions
export { weightedRand as wRand } from "./core/utils.js";

// Color Blending
export { load, instance } from "./core/color.js";

// Matrix transformations, FlowField and Position Class
export {
  field,
  noField,
  addField,
  refreshField,
  listFields,
  Position,
  wiggle,
} from "./core/flowfield.js";

// Polygon and Plot classes
export { Polygon } from "./core/polygon.js";
export { Plot } from "./core/plot.js";

// Primitives
export {
  rect,
  circle,
  arc,
  beginShape,
  vertex,
  endShape,
  beginStroke,
  move,
  endStroke,
  spline,
  polygon,
} from "./core/primitives.js";

// Brushes
export {
  add,
  box,
  scaleBrushes,
  pick,
  stroke,
  strokeWeight,
  set,
  noStroke,
  clip,
  noClip,
  line,
  flowLine,
  preload,
} from "./stroke/stroke.js";

// Section: Hatching
export {
  hatch,
  hatchStyle,
  noHatch,
  createHatch as hatchArray,
} from "./hatch/hatch.js";

// Fill
export { fill, noFill, fillTexture, fillBleed } from "./fill/fill.js";

// p5 addon registration
import { Mix } from "./core/color.js";
import { push as brushPush, pop as brushPop } from "./core/save.js";
import { seed as brushSeed, noiseSeed as brushNoiseSeed } from "./core/utils.js";

function registerAddon(_p5, fn, lifecycles) {
  lifecycles.postsetup = () => Mix.blend(false, true);
  lifecycles.postdraw = () => Mix.blend(false, true);

  const _push = fn.push;
  const _pop = fn.pop;
  const _randomSeed = fn.randomSeed;
  const _noiseSeed = fn.noiseSeed;

  fn.push = function () {
    _push.call(this);
    brushPush();
  };

  fn.pop = function () {
    _pop.call(this);
    brushPop();
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

if (typeof p5 !== "undefined") p5.registerAddon(registerAddon);
