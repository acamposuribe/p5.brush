/**
 * RNG benchmark: compare prng_alea vs alternatives
 * Tests raw speed and quality sufficient for visual simulation
 */
import { performance } from "perf_hooks";
import { prng_alea } from "esm-seedrandom";

const ITERS = 5_000_000;
const RUNS = 5;

function medianOf(arr) {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

function bench(fn) {
  const times = [];
  for (let r = 0; r < RUNS; r++) {
    const t0 = performance.now();
    fn();
    times.push(performance.now() - t0);
  }
  return medianOf(times);
}

// ---- 1. Current: prng_alea ----
const aleaMs = bench(() => {
  const rng = prng_alea(42);
  let s = 0;
  for (let i = 0; i < ITERS; i++) s += rng();
  return s;
});

// ---- 2. xorshift32 ----
const xorMs = bench(() => {
  let s = 42;
  let sum = 0;
  for (let i = 0; i < ITERS; i++) {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    sum += (s >>> 0) * 2.3283064365386963e-10;
  }
  return sum;
});

// ---- 3. mulberry32 (fast high-quality 32-bit PRNG) ----
const mulberryMs = bench(() => {
  let s = 42;
  let sum = 0;
  for (let i = 0; i < ITERS; i++) {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, s | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    sum += ((t ^ t >>> 14) >>> 0) * 2.3283064365386963e-10;
  }
  return sum;
});

// ---- 4. SFC32 ----
const sfcMs = bench(() => {
  let a = 42, b = 0, c = 0, d = 1;
  let sum = 0;
  for (let i = 0; i < ITERS; i++) {
    const t = (a + b | 0) + d | 0;
    d = d + 1 | 0;
    a = b ^ b >>> 9;
    b = c + (c << 3) | 0;
    c = (c << 21 | c >>> 11) + t | 0;
    sum += (t >>> 0) * 2.3283064365386963e-10;
  }
  return sum;
});

// ---- 5. Lehmer LCG (simplest, fastest) ----
const lehmerMs = bench(() => {
  let s = 42;
  let sum = 0;
  for (let i = 0; i < ITERS; i++) {
    s = Math.imul(s, 2654435761) >>> 0;
    sum += s * 2.3283064365386963e-10;
  }
  return sum;
});

const nsPerCall = (ms) => ((ms / ITERS) * 1e6).toFixed(2);

console.log(`\nRNG Benchmark (${ITERS.toLocaleString()} calls each):`);
console.log(`prng_alea (current):  ${aleaMs.toFixed(1)}ms = ${nsPerCall(aleaMs)}ns/call`);
console.log(`xorshift32:           ${xorMs.toFixed(1)}ms = ${nsPerCall(xorMs)}ns/call`);
console.log(`mulberry32:           ${mulberryMs.toFixed(1)}ms = ${nsPerCall(mulberryMs)}ns/call`);
console.log(`SFC32:                ${sfcMs.toFixed(1)}ms = ${nsPerCall(sfcMs)}ns/call`);
console.log(`Lehmer LCG:           ${lehmerMs.toFixed(1)}ms = ${nsPerCall(lehmerMs)}ns/call`);
