import * as brush from "../../dist/brush.esm.js";

const CW = 760;
const CH = 500;
const COLS = 3;
const CellW = CW / COLS;
const cx = (c) => -CW / 2 + c * CellW + CellW / 2;

const Y_BEFORE = -150;
const Y_INSIDE = 0;
const Y_AFTER = 150;

brush.createCanvas(CW, CH, {
  id: "brush-canvas",
  parent: "#canvas-host",
  pixelDensity: globalThis.devicePixelRatio || 1,
});
brush.clear("#f8f6ee");
brush.scaleBrushes(1.5);

brush.pick("marker");
brush.stroke("#1a3a6a");
brush.strokeWeight(3);

brush.push();
brush.translate(cx(0), Y_BEFORE);
brush.line(-60, 0, 60, 0);
brush.line(0, -30, 0, 30);
brush.pop();

brush.push();
brush.translate(cx(0), Y_INSIDE);
brush.stroke("#c0392b");
brush.line(-60, 0, 60, 0);
brush.line(0, -30, 0, 30);
brush.pop();

brush.push();
brush.translate(cx(0), Y_AFTER);
brush.line(-60, 0, 60, 0);
brush.line(0, -30, 0, 30);
brush.pop();

brush.pick("HB");
brush.stroke("#1a3a6a");
brush.strokeWeight(1);
brush.noFill();

brush.push();
brush.translate(cx(1), Y_BEFORE);
brush.line(-60, 0, 60, 0);
brush.line(0, -30, 0, 30);
brush.pop();

brush.push();
brush.translate(cx(1), Y_INSIDE);
brush.pick("charcoal");
brush.stroke("#c0392b");
brush.strokeWeight(6);
brush.line(-60, 0, 60, 0);
brush.line(0, -30, 0, 30);
brush.pop();

brush.push();
brush.translate(cx(1), Y_AFTER);
brush.line(-60, 0, 60, 0);
brush.line(0, -30, 0, 30);
brush.pop();

brush.noStroke();
brush.fill("#1a3a6a", 70);
brush.fillBleed(0.2);
brush.fillTexture(0.4, 0.3);

brush.push();
brush.translate(cx(2), Y_BEFORE);
brush.rect(-55, -35, 110, 70, "corner");
brush.pop();

brush.push();
brush.translate(cx(2), Y_INSIDE);
brush.fill("#c0392b", 120);
brush.rect(-55, -35, 110, 70, "corner");
brush.pop();

brush.push();
brush.translate(cx(2), Y_AFTER);
brush.rect(-55, -35, 110, 70, "corner");
brush.pop();

brush.render();
