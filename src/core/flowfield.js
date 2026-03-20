import { Cwidth, Cheight } from "./target.js";
import { isMixReady, State } from "./color.js";
import { randInt2, noise2, rr2, sin, cos, map, toDegreesSigned } from "./utils.js";
import { getAffineMatrix } from "./runtime.js";

// =============================================================================
// Section: Matrix transformations
// =============================================================================

// =============================================================================
// Section: Field Initialization
// =============================================================================

let isLoaded = false;

/**
 * Ensures the field system is initialized and ready for use.
 * If the field is not loaded, it initializes the mixing system and creates the field.
 */
export function isFieldReady() {
  if (!isLoaded) {
    isMixReady(); // Ensure the mixing system is ready
    createField(); // Initialize the field
    isLoaded = true;
  }
}

// =============================================================================
// Section: Position Class
// =============================================================================

/**
 * The Position class represents a point within a two-dimensional space, which can interact with a vector field.
 * It provides methods to update the position based on the field's flow and to check whether the position is
 * within certain bounds (e.g., within the field or canvas).
 */
export class Position {
  /**
   * Constructs a new Position instance.
   * @param {number} x - The initial x-coordinate.
   * @param {number} y - The initial y-coordinate.
   */
  constructor(x, y) {
    isFieldReady();
    const m = getAffineMatrix();
    this.mx = m.x;
    this.my = m.y;
    this.update(x, y);
    this.plotted = 0; // Tracks the total distance plotted
  }

  /**
   * Updates the position's coordinates and calculates its offsets and indices within the flow field.
   * @param {number} x - The new x-coordinate.
   * @param {number} y - The new y-coordinate.
   */
  update(x, y) {
    this.x = x;
    this.y = y;
    if (State.field.isActive) {
      this.colIdx = Math.round((x + this.mx - left_x) / resolution);
      this.rowIdx = Math.round((y + this.my - top_y) / resolution);
    }
  }

  /**
   * Resets the 'plotted' property to 0.
   */
  reset() {
    this.plotted = 0;
  }

  /**
   * Checks if the position is within the active flow field's bounds.
   * @returns {boolean} - True if the position is within the flow field, false otherwise.
   */
  isIn() {
    return State.field.isActive
      ? Position.isIn(this.colIdx, this.rowIdx)
      : this.isInCanvas(this.x, this.y);
  }

  /**
   * Checks if the position is within the canvas bounds (with a margin).
   * @returns {boolean} - True if the position is within bounds, false otherwise.
   */
  isInCanvas() {
    const margin = 0.3;
    const w = Cwidth;
    const h = Cheight;
    const x = this.x + this.mx;
    const y = this.y + this.my;
    return (
      x >= -margin * w &&
      x <= (1 + margin) * w &&
      y >= -margin * h &&
      y <= (1 + margin) * h
    );
  }

  /**
   * Calculates the angle of the flow field at the position's current coordinates.
   * @returns {number} - The internal flow angle in degrees, or 0 if the position is not in the field or if no field is active.
   */
  angle(skipCheck = false) {
    if (!State.field.isActive) return 0;
    return (skipCheck || this.isIn())
      ? flow_field()[this.colIdx][this.rowIdx] * State.field.wiggle
      : 0;
  }

  /**
   * Moves the position along the flow field by a certain length.
   * @param {number} _dir - The direction of movement, interpreted using the current runtime angle units.
   * @param {number} _length - The length to move along the field.
   * @param {number} _step_length - The length of each step.
   */
  moveTo(_dir, _length, _step_length = 1) {
    this.movePos(toDegreesSigned(_dir), _length, _step_length);
  }

  /**
   * Internal variant of moveTo() that expects a degree value already normalized to the library's internal representation.
   */
  _moveToDegrees(_dir, _length, _step_length = 1) {
    this.movePos(_dir, _length, _step_length);
  }

  /**
   * Plots a point to another position within the flow field, following a Plot object
   * @param {Position} _plot - The Plot path object.
   * @param {number} _length - The length to move towards the target position.
   * @param {number} _step_length - The length of each step.
   * @param {number} _scale - The scaling factor for the plotting path.
   */
  plotTo(_plot, _length, _step_length, _scale = 1, precomputedAngle = undefined) {
    this.movePos(_plot, _length, _step_length, _scale, precomputedAngle);
  }

  movePos(_dirPlot, _length, _step, _scale = false, precomputedAngle = undefined) {
    const scaleFactor = _scale || 1;
    if (!this.isIn()) {
      this.plotted += _step / scaleFactor;
      return;
    }
    const steps = _length / _step;
    const fieldActive = State.field.isActive;
    const usePlot = !!_scale;
    for (let i = 0; i < steps; i++) {
      const plotAngle = (usePlot && precomputedAngle !== undefined && i === 0)
        ? precomputedAngle
        : (usePlot ? _dirPlot.angle(this.plotted) : _dirPlot);
      const angle = (fieldActive ? this.angle(true) : 0) - plotAngle;
      // Calculate new position
      this.update(this.x + _step * cos(angle), this.y + _step * sin(angle));
      this.plotted += _step / scaleFactor;
    }
  }

  // Static Methods

  /**
   * Gets the row index for a given y-coordinate.
   * @param {number} y - The y-coordinate.
   * @returns {number} - The row index.
   */
  static getRowIndex(y, d = 1) {
    const y_offset = y + getAffineMatrix().y - top_y;
    return Math.round(y_offset / resolution / d);
  }

  /**
   * Gets the column index for a given x-coordinate.
   * @param {number} x - The x-coordinate.
   * @returns {number} - The column index.
   */
  static getColIndex(x, d = 1) {
    const x_offset = x + getAffineMatrix().x - left_x;
    return Math.round(x_offset / resolution / d);
  }

  /**
   * Checks if a column and row index are within the flow field bounds.
   * @param {number} col - The column index.
   * @param {number} row - The row index.
   * @returns {boolean} - True if the indices are within bounds, false otherwise.
   */
  static isIn(col, row) {
    return col >= 0 && row >= 0 && col < num_columns && row < num_rows;
  }
}

// =============================================================================
// Section: VectorField
// =============================================================================

/**
 * Represents the state of the vector field.
 * @property {boolean} isActive - Indicates if the vector field is active.
 * @property {string|null} current - The name of the currently active vector field.
 */
State.field = {
  isActive: false,
  current: null,
  wiggle: 1,
};

// Internal variables for field configuration
let list = new Map();
let resolution, left_x, top_y, num_columns, num_rows;
const FIELD_ANGLE_MODES = new Set(["degrees", "radians"]);

/**
 * Initializes the field grid and sets up the vector field's structure based on the renderer's dimensions.
 */
function createField() {
  resolution = Cwidth * 0.01; // Determine the resolution of the field grid
  left_x = -0.5 * Cwidth; // Left boundary of the field
  top_y = -0.5 * Cheight; // Top boundary of the field
  num_columns = Math.round((2 * Cwidth) / resolution); // Number of columns in the grid
  num_rows = Math.round((2 * Cheight) / resolution); // Number of columns in the grid
  addStandard(); // Add default vector field
}

/**
 * Retrieves the field values for the current vector field.
 * @returns {Float32Array[]} The current vector field grid.
 */
function flow_field() {
  return list.get(State.field.current).field;
}

function normalizeFieldAngleMode(options = {}) {
  const config =
    typeof options === "string" ? { angleMode: options } : options || {};
  const angleMode = config.angleMode ?? "degrees";

  if (!FIELD_ANGLE_MODES.has(angleMode)) {
    throw new Error(
      `Invalid field angle mode "${angleMode}". Use "degrees" or "radians".`,
    );
  }

  return angleMode;
}

function normalizeFieldAngles(field, angleMode) {
  if (angleMode !== "radians") return field;

  for (let c = 0; c < field.length; c++) {
    for (let r = 0; r < field[c].length; r++) {
      field[c][r] = toDegreesSigned(field[c][r], true);
    }
  }

  return field;
}

function generateField(entry, t) {
  return normalizeFieldAngles(entry.gen(t, genField()), entry.angleMode);
}

/**
 * Regenerates the current vector field using its associated generator function.
 * @param {number} [t=0] - An optional time parameter that can affect field generation.
 */
export function refreshField(t = 0) {
  if (!State.field.isActive || !State.field.current) {
    throw new Error(
      "No field is currently active. Call brush.field('name') to activate one before refreshing.",
    );
  }
  const currentField = list.get(State.field.current);
  currentField.field = generateField(currentField, t);
}

/**
 * Generates an empty field array.
 * Reuses existing arrays to reduce memory allocation overhead.
 * @returns {Float32Array[]} Empty vector field grid.
 */
function genField() {
  return new Array(num_columns)
    .fill(null)
    .map(() => new Float32Array(num_rows));
}

/**
 * Activates a specific vector field by name, ensuring it's ready for use.
 * @param {string} a - The name of the vector field to activate.
 */
export function field(a) {
  if (!State.field.wiggle) {
    State.field.wiggle = 1;
  } // Set default wiggle value
  isFieldReady();
  if (!list.has(a)) {
    throw new Error(
      `Field "${a}" does not exist. Available fields: ${Array.from(list.keys()).join(", ")}.`,
    );
  }
  State.field.isActive = true;
  State.field.current = a;
  const entry = list.get(a);
  if (!entry.field) entry.field = generateField(entry, 0);
}

/**
 * Deactivates the current vector field.
 */
export function noField() {
  isFieldReady();
  State.field.isActive = false;
}

/**
 * Adds a new vector field to the field list with a unique name and a generator function.
 * @param {string} name - The unique name for the new vector field.
 * @param {Function} funct - The function that generates the field values.
 * @param {object} [options] - Optional field configuration.
 * @param {"degrees"|"radians"} [options.angleMode="degrees"] - How the generator's output angles should be interpreted.
 */
export function addField(name, funct, options = {}) {
  list.set(name, {
    gen: funct,
    field: null,
    angleMode: normalizeFieldAngleMode(options),
  });
}

/**
 * Retrieves a list of all available vector field names.
 * @returns {string[]} An array of all the field names.
 */
export function listFields() {
  isFieldReady();
  return Array.from(list.keys());
}

export function wiggle(a = 1) {
  field("hand");
  State.field.wiggle = a;
}

/**
 * Fills every cell of a field grid using a callback (c, r) => angle.
 */
function fillField(field, fn) {
  for (let c = 0; c < num_columns; c++)
    for (let r = 0; r < num_rows; r++) field[c][r] = fn(c, r);
  return field;
}

/**
 * Adds standard predefined vector fields to the list with unique behaviors.
 */
function addStandard() {
  // Organic noise — basis for brush.wiggle()
  addField("hand", (t, field) => {
    const bs = rr2(0.2, 0.8),
      ba = randInt2(5, 10);
    return fillField(field, (c, r) => {
      const angle = 0.5 * ba * sin(bs * r * c + randInt2(15, 25));
      return 0.2 * angle * cos(t) + noise2(c, r) * ba * 0.7;
    });
  });
  // Smooth large-scale noise curves
  addField("curved", (t, field) => {
    let ar = randInt2(-10, 10);
    if (randInt2(0, 100) % 2 == 0) ar *= -1;
    return fillField(
      field,
      (c, r) =>
        3 * map(noise2(c * 0.02 + t * 0.03, r * 0.02 + t * 0.03), 0, 1, -ar, ar),
    );
  });
  // Sharp alternating angles per cell — herringbone / wicker look
  addField("zigzag", (t, field) => {
    let ar = randInt2(-30, -15) + Math.abs(44 * sin(t));
    if (randInt2(0, 100) % 2 == 0) ar *= -1;
    let dif = ar,
      angle = 0;
    for (let c = 0; c < num_columns; c++) {
      for (let r = 0; r < num_rows; r++) {
        field[c][r] = angle;
        angle += dif;
        dif *= -1;
      }
      angle += dif;
      dif *= -1;
    }
    return field;
  });
  // Sinusoidal wave bands
  addField("waves", (t, field) => {
    const sr = randInt2(10, 15) + 5 * sin(t),
      cr = randInt2(3, 6) + 3 * cos(t),
      ba = randInt2(20, 35);
    return fillField(
      field,
      (c, r) => sin(sr * c) * ba * cos(r * cr) + randInt2(-3, 3),
    );
  });
  // Dense oscillation from row×col product
  addField("seabed", (t, field) => {
    const bs = rr2(0.4, 0.8),
      ba = randInt2(18, 26);
    return fillField(
      field,
      (c, r) => 1.1 * ba * sin(bs * r * c + randInt2(15, 20)) * cos(t),
    );
  });
  // Radial vortex — angles spiral around the field centre
  addField("spiral", (_t, field) => {
    const n = randInt2(5, 10);
    const dir = randInt2(0, 2) * 2 - 1;
    const offset = randInt2(65, 80); // <90 = inward spiral
    const attractors = Array.from({ length: n }, () => ({
      x: rr2(0.1, 0.9) * num_columns,
      y: rr2(0.1, 0.9) * num_rows,
    }));
    return fillField(field, (c, r) => {
      let wx = 0,
        wy = 0;
      for (const att of attractors) {
        const dx = c - att.x,
          dy = r - att.y;
        const w = 1 / (dx * dx + dy * dy + 1);
        const a = Math.atan2(dy, dx) * (180 / Math.PI);
        const angle = (dir * (a + offset) * Math.PI) / 180;
        wx += w * Math.cos(angle);
        wy += w * Math.sin(angle);
      }
      return Math.atan2(wy, wx) * (180 / Math.PI);
    });
  });
  // Column-banded stripes — parallel rake marks
  addField("columns", (_t, field) => {
    const freq = randInt2(3, 8),
      amp = randInt2(25, 45);
    return fillField(field, (c, _r) => sin(c * freq) * amp);
  });
}
