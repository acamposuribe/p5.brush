import * as brush from "../../dist/brush.esm.js";

const CW = 760;
const CH = 600;
const COLS = 3;
const ROWS = 2;
const CellW = CW / COLS;
const CellH = CH / ROWS;
const cx = (c) => -CW / 2 + c * CellW + CellW / 2;
const cy = (r) => -CH / 2 + r * CellH + CellH / 2;

const BLUE = "#1a3a6a";
const RED = "#c0392b";
const OLIVE = "#4a6a1a";

const pixelDensity = globalThis.devicePixelRatio || 1;
brush.createCanvas(CW, CH, {
  id: "brush-canvas",
  parent: "#canvas-host",
  pixelDensity,
});
const refCanvas = document.createElement("canvas");
refCanvas.id = "ref-canvas";
refCanvas.width = Math.round(CW * pixelDensity);
refCanvas.height = Math.round(CH * pixelDensity);
refCanvas.style.width = `${CW}px`;
refCanvas.style.height = `${CH}px`;
document.getElementById("canvas-host").appendChild(refCanvas);
const ref = refCanvas.getContext("2d");
ref.setTransform(pixelDensity, 0, 0, pixelDensity, 0, 0);

brush.clear("#f8f6ee");
brush.scaleBrushes(2);

function withRefTransform(drawFn) {
  ref.save();
  ref.translate(CW / 2, CH / 2);
  drawFn();
  ref.restore();
}

function drawGrid() {
  ref.save();
  ref.strokeStyle = "rgba(120, 112, 100, 0.35)";
  ref.lineWidth = 1;
  ref.translate(CW / 2, CH / 2);
  for (let c = 1; c < COLS; c++) {
    const x = -CW / 2 + c * CellW;
    ref.beginPath();
    ref.moveTo(x, -CH / 2);
    ref.lineTo(x, CH / 2);
    ref.stroke();
  }
  ref.beginPath();
  ref.moveTo(-CW / 2, 0);
  ref.lineTo(CW / 2, 0);
  ref.stroke();
  ref.restore();
}

function drawAxisDashes(x, y) {
  const dashLen = 3;
  const gapLen = 4;
  const unit = dashLen + gapLen;
  ref.save();
  ref.translate(x, y);
  ref.strokeStyle = "rgba(120, 112, 100, 0.45)";
  ref.lineWidth = 1;
  for (let d = -70; d < 70; d += unit) {
    ref.beginPath();
    ref.moveTo(d, 0);
    ref.lineTo(Math.min(d + dashLen, 70), 0);
    ref.stroke();
  }
  for (let d = -60; d < 60; d += unit) {
    ref.beginPath();
    ref.moveTo(0, d);
    ref.lineTo(0, Math.min(d + dashLen, 60));
    ref.stroke();
  }
  ref.restore();
}

function refLines() {
  ref.strokeStyle = "rgba(220, 30, 30, 0.9)";
  ref.lineWidth = 1;
  ref.beginPath();
  ref.moveTo(-60, 0);
  ref.lineTo(60, 0);
  ref.moveTo(0, -40);
  ref.lineTo(0, 40);
  ref.moveTo(-50, -20);
  ref.lineTo(50, 20);
  ref.stroke();
}

function refRect(color) {
  ref.fillStyle = `${color}50`;
  ref.strokeStyle = "rgba(220, 30, 30, 0.9)";
  ref.lineWidth = 2;
  ref.beginPath();
  ref.rect(-55, -40, 110, 80);
  ref.fill();
  ref.stroke();
}

function brushLines(color) {
  brush.set("HB", color, 1.2);
  brush.line(-60, 0, 60, 0);
  brush.line(0, -40, 0, 40);
  brush.set("2B", color, 0.8);
  brush.line(-50, -20, 50, 20);
}

function brushFill(color) {
  brush.noStroke();
  brush.fill(color, 200);
  brush.fillBleed(0.3);
  brush.fillTexture(0.5, 0.4);
  brush.rect(-55, -40, 110, 80, "corner");
  brush.noFill();
}

drawGrid();

brush.push();
brush.translate(cx(0), cy(0));
drawAxisDashes(cx(0), cy(0));
brush.push();
brush.translate(80, -40);
withRefTransform(() => {
  ref.translate(cx(0), cy(0));
  ref.translate(80, -40);
  refLines();
});
brushLines(BLUE);
brush.pop();
brush.pop();

brush.push();
brush.translate(cx(1), cy(0));
drawAxisDashes(cx(1), cy(0));
brush.push();
brush.rotate(25);
withRefTransform(() => {
  ref.translate(cx(1), cy(0));
  ref.rotate((25 * Math.PI) / 180);
  refLines();
});
brushLines(RED);
brush.pop();
brush.pop();

brush.push();
brush.translate(cx(2), cy(0));
drawAxisDashes(cx(2), cy(0));
brush.push();
brush.scale(1.8);
withRefTransform(() => {
  ref.translate(cx(2), cy(0));
  ref.scale(1.8, 1.8);
  refLines();
});
brushLines(OLIVE);
brush.pop();
brush.pop();

brush.push();
brush.translate(cx(0), cy(1));
brush.push();
brush.translate(80, -40);
withRefTransform(() => {
  ref.translate(cx(0), cy(1));
  ref.translate(80, -40);
  refRect(BLUE);
});
brushFill(BLUE);
brush.pop();
brush.pop();

brush.push();
brush.translate(cx(1), cy(1));
brush.push();
brush.rotate(25);
withRefTransform(() => {
  ref.translate(cx(1), cy(1));
  ref.rotate((25 * Math.PI) / 180);
  refRect(RED);
});
brushFill(RED);
brush.pop();
brush.pop();

brush.push();
brush.translate(cx(2), cy(1));
brush.push();
brush.scale(1.8);
withRefTransform(() => {
  ref.translate(cx(2), cy(1));
  ref.scale(1.8, 1.8);
  refRect(OLIVE);
});
brushFill(OLIVE);
brush.pop();
brush.pop();

brush.render();
