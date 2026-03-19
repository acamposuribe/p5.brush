/**
 * @fileoverview p5 entry point for p5.brush.
 */

export * from "./index.shared.js";

import { initP5TargetRuntime } from "./adapters/p5/target.js";
import { initP5Runtime } from "./adapters/p5/runtime.js";
import { initP5RendererRuntime } from "./adapters/p5/renderer.js";
import { initP5CompositorRuntime } from "./adapters/p5/compositor.js";
import { initP5StrokeRuntime } from "./adapters/p5/stroke.js";
import { registerP5Addon } from "./adapters/p5/addon.js";

initP5TargetRuntime();
initP5Runtime();
initP5RendererRuntime();
initP5CompositorRuntime();
initP5StrokeRuntime();

if (typeof p5 !== "undefined") p5.registerAddon(registerP5Addon);
