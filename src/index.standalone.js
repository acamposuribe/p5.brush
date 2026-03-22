/**
 * @fileoverview Standalone entry point for brush.
 */

export * from "./adapters/standalone/runtime.js";
export * from "./adapters/standalone/frame.js";
export { createCanvas } from "./adapters/standalone/target.js";
export * from "./index.shared.js";
export { random, noise } from "./core/utils.js";

import { initStandaloneTargetRuntime } from "./adapters/standalone/target.js";
import { initStandaloneRendererRuntime } from "./adapters/standalone/renderer.js";
import { initStandaloneCompositorRuntime } from "./adapters/standalone/compositor.js";
import { initStandaloneStrokeRuntime } from "./adapters/standalone/stroke.js";
import { initStandaloneRuntime } from "./adapters/standalone/runtime.js";

initStandaloneTargetRuntime();
initStandaloneRuntime();
initStandaloneRendererRuntime();
initStandaloneCompositorRuntime();
initStandaloneStrokeRuntime();
