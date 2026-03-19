import * as brush from "../../dist/brush.esm.js";

brush.createCanvas(600, 600, {
  id: "brush-canvas",
  parent: "#canvas-host",
  pixelDensity: globalThis.devicePixelRatio || 1,
});
brush.clear("#fffceb");
brush.angleMode(brush.DEGREES);
brush.fill("#3f76b5", 220);
brush.fillBleed(0.2, "out");
brush.fillTexture(0.55, 0.35);
brush.push();
brush.rotate(10);
brush.rect(0, 0, 220, 160, "center");
brush.pop();
brush.render();

console.log("standalone fill test executed");
