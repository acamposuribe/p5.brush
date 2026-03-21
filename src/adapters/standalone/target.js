// =============================================================================
// Adapter: Standalone Target Hooks
// =============================================================================

import {
  setTargetRuntime,
  setTargetState,
} from "../../core/target.js";

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
    target.getContext("webgl2", { premultipliedAlpha: true }) ??
    target.getContext("webgl2")
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
    pixelDensity: () => density,
  };
}

function applyLoadedTarget(target, width, height, density) {
  activeTarget = target;
  activeWidth = width;
  activeHeight = height;
  activeDensity = density;

  const renderer = createRenderer(target, width, height, density);
  setTargetState({
    Renderer: renderer,
    Cwidth: width,
    Cheight: height,
    Density: density,
  });
  isLoaded = true;
}

/**
 * Loads a standalone draw target from a DOM canvas or OffscreenCanvas.
 *
 * @param {HTMLCanvasElement|OffscreenCanvas} target
 */
export function load(target = activeTarget) {
  if (!isSupportedTarget(target)) {
    throw new Error(
      "Standalone brush.load(target) requires an HTMLCanvasElement or OffscreenCanvas.",
    );
  }

  applyLoadedTarget(target, target.width, target.height, 1);
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
  if (options.id) canvas.id = options.id;

  if (options.parent) {
    const parent =
      typeof options.parent === "string"
        ? document.querySelector(options.parent)
        : options.parent;
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
 * Standalone targets currently use a fixed density of 1.
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
