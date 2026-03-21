/**
 * @fileoverview Shared exports for p5.brush runtime-specific entry points.
 */

// Randomness and other auxiliary functions
export { weightedRand as wRand } from "./core/utils.js";
export { seed, noiseSeed } from "./core/utils.js";

// Color Blending
export { load } from "./core/color.js";
export { instance } from "./core/target.js";

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
} from "./stroke/stroke.js";

// Section: Hatching
export {
  hatch,
  hatchStyle,
  noHatch,
  createHatch as hatchArray,
} from "./hatch/hatch.js";
export { mass, noMass } from "./hatch/mass.js";

// Fill
export { fill, noFill, fillTexture, fillBleed } from "./fill/fill.js";
export { wash, noWash } from "./fill/wash.js";
