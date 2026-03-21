import { usesRadians as runtimeUsesRadians } from "./runtime.js";

// =============================================================================
// Section: Randomness & Noise
// =============================================================================

import { createNoise2D } from "simplex-noise";

// ---------------------------------------------------------------------------
// Mulberry32 PRNG — ~4x faster than prng_alea (Alea), full statistical quality
// Passes PractRand and BigCrush; suitable for visual simulation.
// ---------------------------------------------------------------------------

/**
 * Maps any seed value (number or string) to a non-zero uint32.
 * Uses a finalizer from SplitMix64 for good avalanche behavior.
 * @param {number|string} seed
 * @returns {number} uint32
 */
function _hashSeed(seed) {
  let h = 0;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 0x9e3779b9) | 0;
    h ^= h >>> 15;
  }
  // Finalizer
  h = Math.imul(h ^ h >>> 16, 0x85ebca6b) | 0;
  h = Math.imul(h ^ h >>> 13, 0xc2b2ae35) | 0;
  return (h ^ h >>> 16) >>> 0 || 1;
}

/**
 * Creates a Mulberry32 PRNG seeded from an arbitrary value.
 * Returns a function that yields uniform floats in [0, 1).
 * @param {number|string} seed
 * @returns {() => number}
 */
function _makePRNG(seed) {
  let s = _hashSeed(seed);
  return () => {
    s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, s | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) * 2.3283064365386963e-10;
  };
}

/**
 * A uniform PRNG function. Returns a float in [0,1).
 * @callback RNG
 * @returns {number}
 */
/** @type {RNG} */
let rng = _makePRNG(Math.random());
let rng2 = _makePRNG(Math.random() + ':2');

const _seedCallbacks = [];

/**
 * Register a callback to be called whenever seed() is invoked.
 * Used internally by modules that maintain gaussian pools.
 * @param {Function} cb
 */
export const _onSeed = (cb) => _seedCallbacks.push(cb);

/**
 * Seed the random number generator.
 * @param {number|string} s – The seed value.
 * @returns {void}
 */
export const seed = (s) => {
  rng = _makePRNG(s);
  rng2 = _makePRNG(`${s}:2`);
  _gaussCached = false; // reset cached gaussian on reseed
  for (const callback of _seedCallbacks) {
    callback();
  }
};

/**
 * Simplex‐noise 2D function.
 * @type {function(number, number): number}
 */
export let noise = createNoise2D(_makePRNG(Math.random()));
export let noise2 = createNoise2D(_makePRNG(Math.random() + ':2'));

/**
 * Seed the noise generator.
 * @param {number|string} s - The seed value.
 * @returns {void}
 */
export const noiseSeed = (s) => {
  noise = createNoise2D(_makePRNG(s));
  noise2 = createNoise2D(_makePRNG(`${s}:2`));
};

/**
 * Returns a random float in [min, max).
 * @param {number} [min=0]
 * @param {number} [max=1]
 * @returns {number}
 */
export const rr = (e = 0, r = 1) => e + rng() * (r - e);
export const rr2 = (e = 0, r = 1) => e + rng2() * (r - e);

/**
 * Selects a random element from an array.
 * @param {T[]} array - Input array.
 * @returns {T}
 */
export const rArray = (array) => array[~~(rng() * array.length)];

/**
 * Returns a random integer in [min, max).
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export const randInt = (e, r) => ~~rr(e, r);
export const randInt2 = (e, r) => ~~rr2(e, r);

/**
 * Gaussian (normal) random sample N(mean, stdev²).
 * @param {number} [mean=0]
 * @param {number} [stdev=1]
 * @returns {number}
 */
// Box-Muller with cached second value — halves Math.sqrt/Math.log calls.
let _gaussCached = false;
let _gaussZ1 = 0;
export const gaussian = (mean = 0, stdev = 1) => {
  if (_gaussCached) {
    _gaussCached = false;
    return _gaussZ1 * stdev + mean;
  }
  const u = 1 - rng();
  const v = rng();
  const r = Math.sqrt(-2.0 * Math.log(u));
  const angle = 360 * v;
  _gaussZ1 = r * sin(angle);
  _gaussCached = true;
  return r * cos(angle) * stdev + mean;
};

/**
 * Picks a key from an object according to weighted probabilities.
 * @param {Object<string|number, number>} weights
 * @returns {string|number}
 */
export const weightedRand = (weights) => {
  let totalWeight = 0;
  const entries = [];

  // Build cumulative weights array
  for (const key in weights) {
    totalWeight += weights[key];
    entries.push({ key, cumulative: totalWeight });
  }

  // Get a random number between 0 and totalWeight
  const rnd = rng() * totalWeight;

  // Pick the first entry where rnd is less than the cumulative weight
  for (const { key, cumulative } of entries) {
    if (rnd < cumulative) {
      return isNaN(key) ? key : parseInt(key);
    }
  }
};

// =============================================================================
// Section: Numeric Mapping & Constraints
// =============================================================================

/**
 * Maps a value from range [a,b] to [c,d], optionally clamped.
 * @param {number} value
 * @param {number} a
 * @param {number} b
 * @param {number} c
 * @param {number} d
 * @param {boolean} [withinBounds=false]
 * @returns {number}
 */
export const map = (value, a, b, c, d, withinBounds = false) => {
  let r = c + ((value - a) / (b - a)) * (d - c);
  if (!withinBounds) return r;
  if (c < d) return constrain(r, c, d);
  else return constrain(r, d, c);
};

/**
 * Constrains a number within the provided bounds.
 * @param {number} n - The number.
 * @param {number} low - Lower bound.
 * @param {number} high - Upper bound.
 * @returns {number} The constrained number.
 */
export const constrain = (n, low, high) => Math.max(Math.min(n, high), low);

// =============================================================================
// Section: Trigonometry
// =============================================================================

// number of discrete steps (360° × 4 samples per degree)
const totalDegrees = 1440;
const radiansPerIndex = (2 * Math.PI) / totalDegrees;

// Pre-warmed lookup tables — filled at module load, no lazy-init overhead
const cLookup = new Float32Array(totalDegrees);
const sLookup = new Float32Array(totalDegrees);
for (let _i = 0; _i < totalDegrees; _i++) {
  cLookup[_i] = Math.cos(_i * radiansPerIndex);
  sLookup[_i] = Math.sin(_i * radiansPerIndex);
}

/**
 * Normalize an angle in degrees to a lookup-table index [0, 1440).
 * Avoids the % operator for the common range [-360, 720) found in the library.
 * @param {number} angle
 * @returns {number} integer index in [0, 1440)
 */
const angleToIdx = (angle) => {
  if (angle < 0) {
    if (angle >= -360) return ~~((angle + 360) * 4);
    angle = angle % 360;
    return ~~((angle < 0 ? angle + 360 : angle) * 4);
  }
  if (angle < 360) return ~~(angle * 4);
  if (angle < 720) return ~~((angle - 360) * 4);
  angle = angle % 360;
  return ~~((angle < 0 ? angle + 360 : angle) * 4);
};

/**
 * Cosine of an angle (degrees), via a pre-warmed lookup table.
 * @param {number} angle
 * @returns {number}
 */
export const cos = (angle) => cLookup[angleToIdx(angle)];

/**
 * Sine of an angle (degrees), via a pre-warmed lookup table.
 * @param {number} angle
 * @returns {number}
 */
export const sin = (angle) => sLookup[angleToIdx(angle)];

/**
 * Returns [cos(angle), sin(angle)] via a single index computation.
 * Use when both values are needed for the same angle — avoids computing
 * angleToIdx() twice (once per separate cos/sin call).
 * Returns a reusable Float32Array — use values immediately, do not store the reference.
 * @param {number} angle
 * @returns {Float32Array} [cos, sin]
 */
const _cosSinBuf = new Float32Array(2);
export const cossin = (angle) => {
  const idx = angleToIdx(angle);
  _cosSinBuf[0] = cLookup[idx];
  _cosSinBuf[1] = sLookup[idx];
  return _cosSinBuf;
};

/**
 * Converts radians to degrees, normalized to [0,360).
 * @param {number} rad
 * @returns {number}
 */
export const toDegrees = (rad, isRad = false) => {
  if (isRad || runtimeUsesRadians()) {
    let angle = ((rad * 180) / Math.PI) % 360;
    return angle < 0 ? angle + 360 : angle;
  } else {
    return rad;
  }
};

/**
 * Converts radians to degrees without wrapping the result.
 * Preserves signed angles so downstream scaling keeps its direction.
 * @param {number} angle
 * @param {boolean} [isRad=false]
 * @returns {number}
 */
export const toDegreesSigned = (angle, isRad = false) =>
  isRad || runtimeUsesRadians()
    ? (angle * 180) / Math.PI
    : angle;

// =============================================================================
// Section: Geometry & Transforms
// =============================================================================

/**
 * Rotates point (x,y) around center (cx,cy) by angle degrees.
 * @param {number} cx
 * @param {number} cy
 * @param {number} x
 * @param {number} y
 * @param {number} angle - Degrees
 * @returns {{x:number,y:number}}
 */
export const rotate = (cx, cy, x, y, angle) => {
  const cs = cossin(angle);
  const coseno = cs[0], seno = cs[1];
  const nx = coseno * (x - cx) + seno * (y - cy) + cx;
  const ny = coseno * (y - cy) - seno * (x - cx) + cy;
  return { x: nx, y: ny };
};

/**
 * Euclidean distance between two points.
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {number}
 */
export const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

/**
 * Angle in degrees between two points, measured clockwise from +X.
 * @param {number} x1
 * @param {number} y1
 * @param {number} x2
 * @param {number} y2
 * @returns {number}
 */
export const calcAngle = (x1, y1, x2, y2) =>
  toDegrees(Math.atan2(-(y2 - y1), x2 - x1), true);

/**
 * Intersection of two line segments, or false if none.
 * @param {{x:number,y:number}} s1a
 * @param {{x:number,y:number}} s1b
 * @param {{x:number,y:number}} s2a
 * @param {{x:number,y:number}} s2b
 * @param {boolean} [includeSegmentExtension=false]
 * @returns {{x:number,y:number}|false}
 */
export const intersectLines = (
  s1a,
  s1b,
  s2a,
  s2b,
  includeSegmentExtension = false
) => {
  const x1 = s1a.x, y1 = s1a.y;
  const x2 = s1b.x, y2 = s1b.y;
  const x3 = s2a.x, y3 = s2a.y;
  const x4 = s2b.x, y4 = s2b.y;
  const dx1 = x2 - x1, dy1 = y2 - y1;
  const dx2 = x4 - x3, dy2 = y4 - y3;
  // Handles parallel lines AND zero-length segments (denominator = 0 in both cases)
  const denom = dy2 * dx1 - dx2 * dy1;
  if (denom === 0) return false;
  const dy13 = y1 - y3, dx13 = x1 - x3;
  const ua = (dx2 * dy13 - dy2 * dx13) / denom;
  const ub = (dx1 * dy13 - dy1 * dx13) / denom;
  if (!includeSegmentExtension && (ub < 0 || ub > 1)) return false;
  return { x: x1 + ua * dx1, y: y1 + ua * dy1 };
};
