// =============================================================================
// Adapter: Standalone Target Hooks
// =============================================================================

import {
  setTargetRuntime,
  setTargetState,
} from "../../core/target.js";
import { Mix, flushActiveComposite } from "../../core/color.js";

const renderers = new WeakMap();
let activeTarget = null;
let isLoaded = false;
let activeDensity = 1;
let activeWidth = 0;
let activeHeight = 0;

function isCanvasTarget(target) {
  return (
    typeof HTMLCanvasElement !== "undefined" &&
    target instanceof HTMLCanvasElement
  );
}

function isOffscreenCanvasTarget(target) {
  return (
    typeof OffscreenCanvas !== "undefined" &&
    target instanceof OffscreenCanvas
  );
}

function isSupportedTarget(target) {
  return isCanvasTarget(target) || isOffscreenCanvasTarget(target);
}

function getTargetContext(target) {
  return (
    target.getContext("webgl2", { premultipliedAlpha: true, preserveDrawingBuffer: true }) ??
    target.getContext("webgl2", { preserveDrawingBuffer: true })
  );
}

function createRenderer(target, width, height, density) {
  const drawingContext = getTargetContext(target);
  if (!drawingContext) {
    throw new Error("brush.load(target) requires a canvas with a WebGL2 context.");
  }

  return {
    canvas: target,
    drawingContext,
    width,
    height,
    density,
    pixelDensity() { return this.density; },
  };
}

function applyLoadedTarget(target, width, height, density) {
  // Resolve/validate before disturbing the current drawing session.
  const renderer = renderers.get(target) ?? createRenderer(target, width, height, density);
  if (isLoaded) flushActiveComposite();
  renderer.width = width;
  renderer.height = height;
  renderer.density = density;
  renderers.set(target, renderer);
  activeTarget = target;
  activeWidth = width;
  activeHeight = height;
  activeDensity = density;
  setTargetState({
    Renderer: renderer,
    Cwidth: width,
    Cheight: height,
    Density: density,
  });
  isLoaded = true;
  // clear() is legal immediately after load/createCanvas, even before a stroke.
  Mix.isBrush = null;
  Mix.justChanged = false;
  Mix.load();
}

/**
 * Loads a standalone draw target from a DOM canvas or OffscreenCanvas.
 *
 * @param {HTMLCanvasElement|OffscreenCanvas} target
 */
export function load(target = activeTarget) {
  if (target === false) target = activeTarget;
  if (!isSupportedTarget(target)) {
    throw new Error(
      "Standalone brush.load(target) requires an HTMLCanvasElement or OffscreenCanvas.",
    );
  }

  const cached = renderers.get(target);
  const density = cached?.density ?? 1;
  const width = cached && Math.round(cached.width * density) === target.width ? cached.width : target.width / density;
  const height = cached && Math.round(cached.height * density) === target.height ? cached.height : target.height / density;
  applyLoadedTarget(target, width, height, density);
}

/**
 * Creates a standalone DOM canvas, configures its backing resolution according
 * to the provided pixel density, appends it optionally to the DOM, and loads it
 * as the active brush target.
 *
 * @param {number} width Logical canvas width.
 * @param {number} height Logical canvas height.
 * @param {{pixelDensity?: number, parent?: string|Element|null, id?: string}} [options]
 * @returns {HTMLCanvasElement}
 */
export function createCanvas(width, height, options = {}) {
  if (typeof document === "undefined") {
    throw new Error("brush.createCanvas() requires a browser document.");
  }

  const logicalWidth = Math.max(1, Math.round(width));
  const logicalHeight = Math.max(1, Math.round(height));
  const density = Math.max(1, Number(options.pixelDensity) || 1);
  const canvas = document.createElement("canvas");

  canvas.width = Math.max(1, Math.round(logicalWidth * density));
  canvas.height = Math.max(1, Math.round(logicalHeight * density));
  canvas.style.width = `${logicalWidth}px`;
  canvas.style.height = `${logicalHeight}px`;
  canvas.id = options.id ?? "brush-canvas";

  const parentTarget = options.parent !== undefined ? options.parent : document.body;
  if (parentTarget) {
    const parent =
      typeof parentTarget === "string"
        ? document.querySelector(parentTarget)
        : parentTarget;
    if (!parent) {
      throw new Error(`Could not find parent "${options.parent}" for brush.createCanvas().`);
    }
    parent.appendChild(canvas);
  }

  applyLoadedTarget(canvas, logicalWidth, logicalHeight, density);
  return canvas;
}

/**
 * Refreshes the standalone target density.
 *
 * Created canvases retain their logical size and configured pixel density.
 *
 * @returns {number}
 */
export function syncDensity() {
  setTargetState({
    Cwidth: activeWidth,
    Cheight: activeHeight,
    Density: activeDensity,
  });
  return activeDensity;
}

/**
 * Ensures a standalone target has been loaded.
 */
export function isCanvasReady() {
  if (!isLoaded) {
    throw new Error(
      "No standalone target loaded. Call brush.load(canvasOrOffscreenCanvas) first.",
    );
  }
}

/**
 * Standalone build does not use p5 instance switching, so these are no-ops.
 */
export function instance() {}
export function activateInstance() {}
export function deactivateInstance() {}

/**
 * Standalone build does not yet support framebuffer targets.
 *
 * @returns {null}
 */
export function getActiveFramebuffer() {
  return null;
}

/**
 * Returns whether the given target behaves like a framebuffer target.
 *
 * Standalone targets currently only accept canvases and offscreen canvases.
 *
 * @returns {boolean}
 */
export function isFramebufferTarget() {
  return arguments[0]?.__brushFramebuffer === true;
}

export function initStandaloneTargetRuntime() {
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
