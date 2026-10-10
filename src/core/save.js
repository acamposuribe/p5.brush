import { State } from "./color.js";

// =============================================================================
// SAVE / RESTORE
// =============================================================================

/**
 * Each drawing surface has its own stack, so nested compositor calls and
 * interleaved p5 instances cannot consume one another’s saved brush states.
 */
const _stateStacks = new WeakMap();

/**
 * Pushes the current brush state onto the drawing surface's stack.
 * @param {object} [owner=State] - The p5 surface, or shared standalone state.
 */
export function push(owner = State) {
  let stack = _stateStacks.get(owner);
  if (!stack) {
    stack = [];
    _stateStacks.set(owner, stack);
  }
  // State defaults exist at module load; saving them needs no GPU or field.
  stack.push({
    fill: { ...State.fill },
    wash: State.wash ? { ...State.wash } : null,
    stroke: { ...State.stroke },
    hatch: { ...State.hatch },
    mass: State.mass ? { ...State.mass } : null,
    field: { ...State.field },
  });
}

/**
 * Pops the drawing surface's top brush state and restores it.
 * @param {object} [owner=State] - The p5 surface, or shared standalone state.
 */
export function pop(owner = State) {
  const saved = _stateStacks.get(owner)?.pop();
  if (!saved) return;
  State.stroke = saved.stroke;
  State.field = saved.field;
  State.hatch = saved.hatch;
  State.fill = saved.fill;
  if (saved.wash) State.wash = saved.wash;
  if (saved.mass) {
    State.mass = saved.mass;
  } else if (State.mass) {
    State.mass = {
      ...State.mass,
      isActive: false,
      brush: null,
      color: null,
      options: {},
    };
  }
}
