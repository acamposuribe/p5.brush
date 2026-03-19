import * as brush from "../../dist/brush.esm.js";

brush.createCanvas(600, 600, {
  id: "brush-canvas",
  parent: "#canvas-host",
  pixelDensity: globalThis.devicePixelRatio || 1,
});
brush.scaleBrushes(3);
brush.angleMode(brush.DEGREES);

brush.set("HB", "#183a52", 1);
brush.line(-180, -160, 180, 160);

brush.push();
brush.translate(0, 40);
brush.rotate(12);
brush.set("HB", "#b1542f", 1);
brush.rect(0, 0, 180, 110, "center");
brush.pop();

brush.render();

console.log("standalone smoke test executed");
