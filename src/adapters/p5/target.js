// =============================================================================
// Adapter: p5 Runtime Target Resolution
// =============================================================================
/**
 * Owns the active renderer/instance selection used by p5.brush when running
 * on top of p5's WEBGL renderer.
 */

import {
  setTargetRuntime,
  setTargetState,
  Instance,
  Renderer,
} from "../../core/target.js";

let ReadySketch = null;
let ActiveInstance = null;
const ActiveInstanceStack = [];
let _isReady = false;

/**
 * Checks whether the given draw target is a p5.Framebuffer-like object.
 * @param {*} target - Candidate draw target.
 * @returns {boolean} True when the target behaves like a p5.Framebuffer.
 */
export const isFramebufferTarget = (target) =>
  !!target &&
  typeof target.begin === "function" &&
  typeof target.end === "function" &&
  !!target.renderer &&
  !!target.renderer._pInst;

const isFiniteSize = (value) =>
  typeof value === "number" && Number.isFinite(value) && value > 0;

const safeRead = (getter) => {
  try {
    return getter();
  } catch (_error) {
    return undefined;
  }
};

const isReadyWebGLSketch = (candidate) =>
  !!candidate &&
  typeof candidate.pixelDensity === "function" &&
  typeof candidate.createFramebuffer === "function" &&
  isFiniteSize(safeRead(() => candidate.width)) &&
  isFiniteSize(safeRead(() => candidate.height)) &&
  safeRead(() => candidate.webglVersion) === "webgl2";

const getCurrentP5Instance = () => window.self?.p5?.instance ?? null;

const rememberReadySketch = (candidate) => {
  if (isReadyWebGLSketch(candidate)) ReadySketch = candidate;
  return ReadySketch;
};

const getActiveSketchRenderer = () => {
  if (!ActiveInstance) return null;
  if (!isReadyWebGLSketch(ActiveInstance)) return null;
  return rememberReadySketch(ActiveInstance);
};

/**
 * Resolves the sketch renderer that owns the current drawing session.
 * Preference order:
 * 1. the sketch currently executing a p5 lifecycle callback
 * 2. the explicitly selected instance from brush.instance(p), if ready
 * 3. the last known-good ready sketch
 * @returns {p5|Window["p5"]["instance"]|null} The active sketch renderer.
 */
export const getSketchRenderer = () =>
  getActiveSketchRenderer() ||
  rememberReadySketch(getCurrentP5Instance()) ||
  rememberReadySketch(Instance) ||
  ReadySketch;

/**
 * Resolves the renderer and pixel size used by `brush.load()`.
 * @param {p5.Graphics|p5.Framebuffer|false} [buffer=false] - Optional draw target.
 * @returns {{renderer: object, width: number, height: number}} Active renderer info.
 */
const resolveTarget = (buffer = false) => {
  const sketchRenderer = getSketchRenderer();

  if (!buffer) {
    if (!sketchRenderer) {
      throw new Error(
        "p5.brush could not resolve an active WEBGL sketch. Call brush.instance(p) and brush.load() after createCanvas(..., WEBGL).",
      );
    }
    return {
      renderer: sketchRenderer,
      width: sketchRenderer.width,
      height: sketchRenderer.height,
    };
  }

  if (isFramebufferTarget(buffer)) {
    const owner = buffer.renderer._pInst;
    rememberReadySketch(owner);

    if (sketchRenderer && owner !== sketchRenderer) {
      throw new Error(
        "p5.brush only supports p5.Framebuffer targets created from the active sketch",
      );
    }

    return {
      renderer: owner,
      width: buffer.width,
      height: buffer.height,
    };
  }

  return {
    renderer: buffer,
    width: buffer.width,
    height: buffer.height,
  };
};

/**
 * Returns the currently bound sketch framebuffer when drawing into one.
 * @returns {p5.Framebuffer|null} Active framebuffer or null.
 */
export const getActiveFramebuffer = () =>
  Renderer?._renderer?.activeFramebuffer?.() ?? null;

/**
 * Loads and initializes a canvas for the drawing system.
 * @param {p5.Graphics|p5.Framebuffer|false} [buffer=false] - Optional offscreen target.
 * Pass a framebuffer only while drawing inside its begin()/end() or draw() scope.
 * Framebuffers created from p5.Graphics are not supported.
 */
export const load = (buffer = false) => {
  const target = resolveTarget(buffer);
  setTargetState({ Renderer: target.renderer });
  rememberReadySketch(!buffer ? Renderer : getSketchRenderer());

  if (Renderer.webglVersion !== "webgl2") {
    throw new Error("p5.brush requires a WEBGL canvas");
  }

  setTargetState({
    Cwidth: target.width,
    Cheight: target.height,
  });

  _isReady = true;
};

/**
 * Refreshes the stored pixel density for the active renderer.
 * @returns {number} Current renderer pixel density.
 */
export const syncDensity = () => {
  const density = Renderer.pixelDensity();
  setTargetState({ Density: density });
  return density;
};

/**
 * Ensures the drawing system is ready before any operation.
 */
export const isCanvasReady = () => {
  if (!_isReady) load();
};

export const instance = (inst) => {
  setTargetState({ Instance: inst });
  rememberReadySketch(inst);
};

export const activateInstance = (inst) => {
  ActiveInstanceStack.push(ActiveInstance);
  ActiveInstance = inst;
  instance(inst);
};

export const deactivateInstance = () => {
  ActiveInstance = ActiveInstanceStack.pop() ?? null;
};

export function initP5TargetRuntime() {
  setTargetRuntime({
    load,
    syncDensity,
    isCanvasReady,
    instance,
    activateInstance,
    deactivateInstance,
    getActiveFramebuffer,
    isFramebufferTarget,
  });
}
