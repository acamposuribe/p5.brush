import { setTargetState, setTargetRuntime } from "../src/core/target.js";
import { seed } from "../src/core/utils.js";
import { isFieldReady, noField } from "../src/core/flowfield.js";

setTargetState({ Cwidth: 800, Cheight: 600, Density: 1, Renderer: { loaded: true } });
setTargetRuntime({ isCanvasReady: () => {}, syncDensity: () => 1 });
seed(42);
isFieldReady();
noField();

// Test importing fill.js indirectly through what we can
import { createFill, fill, noFill } from "../src/fill/fill.js";
console.log("fill.js imported OK");
