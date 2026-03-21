import { setTargetState, setTargetRuntime } from "../src/core/target.js";
import { seed } from "../src/core/utils.js";
import { isFieldReady, Position, noField } from "../src/core/flowfield.js";
import { Plot } from "../src/core/plot.js";

// Provide mock Renderer with loaded=true to skip Mix.load()
setTargetState({ Cwidth: 800, Cheight: 600, Density: 1, Renderer: { loaded: true } });
setTargetRuntime({ isCanvasReady: () => {}, syncDensity: () => 1 });
seed(42);
isFieldReady();
noField();

const plot = new Plot("curve");
for (let i = 0; i < 10; i++) plot.addSegment(i * 36, 100, 0.8);
plot.endPlot(0, 1);

const pos = new Position(400, 300);
pos.moveTo(45, 200, 1);
console.log("pos after moveTo:", pos.x.toFixed(2), pos.y.toFixed(2));

const pos2 = new Position(400, 300);
pos2.plotTo(plot, 500, 1, 1);
console.log("pos2 after plotTo:", pos2.x.toFixed(2), pos2.y.toFixed(2));
