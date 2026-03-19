// =============================================================================
// Target Runtime Hooks
// =============================================================================

/**
 * Shared target state exposed to core modules.
 *
 * Host adapters are expected to keep these bindings updated with the currently
 * active drawing target. The exact object type is adapter-defined, but core code
 * assumes the active renderer exposes:
 * - `drawingContext`: the active WebGL context
 * - target dimensions through `Cwidth` / `Cheight`
 * - pixel density through `Density`
 */

export let Cwidth, Cheight, Instance, Renderer, Density;

let targetRuntime = {
  load: () => {
    throw new Error("No target runtime adapter registered.");
  },
  syncDensity: () => Density,
  isCanvasReady: () => {
    throw new Error("No target runtime adapter registered.");
  },
  instance: (inst) => {
    Instance = inst;
  },
  activateInstance: (inst) => {
    Instance = inst;
  },
  deactivateInstance: () => {},
  getActiveFramebuffer: () => null,
  isFramebufferTarget: () => false,
};

/**
 * Updates the shared target state consumed by core modules.
 *
 * @param {object} state
 */
export function setTargetState(state) {
  if ("Cwidth" in state) Cwidth = state.Cwidth;
  if ("Cheight" in state) Cheight = state.Cheight;
  if ("Instance" in state) Instance = state.Instance;
  if ("Renderer" in state) Renderer = state.Renderer;
  if ("Density" in state) Density = state.Density;
}

/**
 * Registers or updates host target hooks used by core modules.
 *
 * @param {object} hooks
 */
export function setTargetRuntime(hooks) {
  targetRuntime = { ...targetRuntime, ...hooks };
}

export const load = (buffer = false) => targetRuntime.load(buffer);
export const syncDensity = () => targetRuntime.syncDensity();
export const isCanvasReady = () => targetRuntime.isCanvasReady();
export const instance = (inst) => targetRuntime.instance(inst);
export const activateInstance = (inst) => targetRuntime.activateInstance(inst);
export const deactivateInstance = () => targetRuntime.deactivateInstance();
export const getActiveFramebuffer = () => targetRuntime.getActiveFramebuffer();
export const isFramebufferTarget = (target) =>
  targetRuntime.isFramebufferTarget(target);
