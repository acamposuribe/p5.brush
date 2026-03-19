import * as brush from "../../dist/brush.esm.js";

brush.createCanvas(600, 600, {
  id: "brush-canvas",
  parent: "#canvas-host",
  pixelDensity: globalThis.devicePixelRatio || 1,
});
brush.clear("#fffceb");
brush.scaleBrushes(3);

brush.angleMode(brush.DEGREES);
brush.set("HB", "#183a52", 1);
brush.push();
brush.translate(-120, -80);
brush.rotate(25);
brush.line(-80, 0, 80, 0);
brush.pop();

brush.angleMode(brush.RADIANS);
brush.set("HB", "#8f3a2f", 1);
brush.push();
brush.translate(120, 80);
brush.rotate(Math.PI / 6);
brush.line(-80, 0, 80, 0);
brush.pop();

brush.render();

console.log("standalone angle/transform test executed");
