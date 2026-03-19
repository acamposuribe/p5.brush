import * as brush from "../../dist/brush.esm.js";

brush.createCanvas(600, 600, {
  id: "brush-canvas",
  parent: "#canvas-host",
  pixelDensity: globalThis.devicePixelRatio || 1,
});
brush.clear("#fffceb");
brush.angleMode(brush.DEGREES);
brush.wash("#3f76b5", 230);
brush.push();
brush.rotate(-8);
brush.rect(0, 0, 240, 170, "center");
brush.pop();
brush.noWash();
brush.render();

console.log("standalone wash test executed");
