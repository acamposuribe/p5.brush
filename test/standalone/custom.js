import * as brush from "../../dist/brush.esm.js";

brush.createCanvas(600, 600, {
  id: "brush-canvas",
  parent: "#canvas-host",
  pixelDensity: globalThis.devicePixelRatio || 1,
});
brush.clear("#fffceb");
brush.scaleBrushes(3);
brush.angleMode(brush.DEGREES);

brush.add("standalone-star", {
  type: "custom",
  weight: 0.7,
  scatter: 0.8,
  sharpness: 1,
  grain: 40,
  opacity: 180,
  spacing: 0.2,
  noise: 0.2,
  rotate: "natural",
  markerTip: false,
  pressure: [1, 1],
  tip(g) {
    g.noStroke();
    g.fill("black");
    g.beginShape();
    g.vertex(0, -14);
    g.vertex(4, -4);
    g.vertex(14, 0);
    g.vertex(4, 4);
    g.vertex(0, 14);
    g.vertex(-4, 4);
    g.vertex(-14, 0);
    g.vertex(-4, -4);
    g.endShape(true);
  },
});

brush.set("standalone-star", "#8f3a2f", 1);
brush.line(-200, -120, 200, 120);
brush.render();

console.log("standalone custom brush test executed");
