import { State } from "./color.js";
import { isFieldReady } from "./flowfield.js";

// =============================================================================
// SAVE / RESTORE
// =============================================================================

/**
 * Stack of saved brush states for push/pop operations.
 * A stack (not a single slot) is required because applyShader() internally
 * calls Renderer.push()/pop(), which fires our hook — a flat object would be
 * overwritten mid-draw and pop() would restore the wrong state.
 */
const _stateStack = [];

/**
 * Pushes the current brush state onto the stack.
 */
export function push() {
  isFieldReady();
  _stateStack.push({
    fill: { ...State.fill },
    stroke: { ...State.stroke },
    hatch: { ...State.hatch },
    field: { ...State.field },
  });
}

/**
 * Pops the top brush state from the stack and restores it.
 */
export function pop() {
  const saved = _stateStack.pop();
  if (!saved) return;
  State.stroke = { ...saved.stroke };
  State.field = { ...saved.field };
  State.hatch = { ...saved.hatch };
  State.fill = { ...saved.fill };
}
