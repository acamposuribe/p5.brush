import * as brush from "../../dist/brush.esm.js";

brush.createCanvas(600, 600, {
  id: "brush-canvas",
  parent: "#canvas-host",
  pixelDensity: globalThis.devicePixelRatio || 1,
});
brush.clear("#fffceb");
brush.scaleBrushes(3);
brush.angleMode(brush.DEGREES);
brush.hatch(10, 25, { rand: 0.4, continuous: true, gradient: 0.6 });
brush.hatchStyle("HB", "#264a67", 1);
brush.push();
brush.rotate(9);
brush.rect(0, 0, 240, 170, "center");
brush.pop();
brush.noHatch();
brush.render();

console.log("standalone hatch test executed");
