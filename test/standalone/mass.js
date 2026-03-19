import * as brush from "../../dist/brush.esm.js";

brush.createCanvas(600, 600, {
  id: "brush-canvas",
  parent: "#canvas-host",
  pixelDensity: globalThis.devicePixelRatio || 1,
});
brush.clear("#fffceb");
brush.scaleBrushes(3);
brush.angleMode(brush.DEGREES);
brush.mass("pastel", "#4b6cb7", {
  precision: 0.75,
  strength: 1,
  gradient: 0.65,
  outline: true,
});
brush.push();
brush.rotate(-7);
brush.rect(0, 0, 220, 160, "center");
brush.pop();
brush.noMass();
brush.render();

console.log("standalone mass test executed");
