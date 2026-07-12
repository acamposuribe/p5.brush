// ============================================================
// p5.brush Standalone Fill Angle Test
//
// Same polygon repeated with different seeds. Fixed-angle rows
// should keep the wash direction consistent across every panel.
// ============================================================

import * as brush from "../../dist/brush.esm.js";

const CANVAS_W = 1360;
const CANVAS_H = 890;
const MARGIN = 36;
const LABEL_W = 170;
const PANEL_GAP = 14;
const ROW_H = 150;

const FRAME = "#cdbfae";
const PANEL_BG = "#fcf7ef";
const FILL = "#2364aa";
const seeds = [11, 22, 33, 44];
const scriptStart = performance.now();

const pixelDensity = window.devicePixelRatio || 1;
brush.createCanvas(CANVAS_W, CANVAS_H, {
  id: "brush-canvas",
  parent: "#canvas-host",
  pixelDensity,
});

const labelCanvas = document.createElement("canvas");
labelCanvas.id = "label-canvas";
labelCanvas.width = Math.round(CANVAS_W * pixelDensity);
labelCanvas.height = Math.round(CANVAS_H * pixelDensity);
labelCanvas.style.width = CANVAS_W + "px";
labelCanvas.style.height = CANVAS_H + "px";
document.getElementById("canvas-host").appendChild(labelCanvas);

const lc = labelCanvas.getContext("2d");
lc.setTransform(pixelDensity, 0, 0, pixelDensity, 0, 0);
lc.textBaseline = "top";

let currentY = MARGIN;

function lcRoundRect(x, y, w, h, r) {
  lc.beginPath();
  lc.moveTo(x + r, y);
  lc.lineTo(x + w - r, y);
  lc.arcTo(x + w, y, x + w, y + r, r);
  lc.lineTo(x + w, y + h - r);
  lc.arcTo(x + w, y + h, x + w - r, y + h, r);
  lc.lineTo(x + r, y + h);
  lc.arcTo(x, y + h, x, y + h - r, r);
  lc.lineTo(x, y + r);
  lc.arcTo(x, y, x + r, y, r);
  lc.closePath();
}

function section(title, note) {
  lc.fillStyle = "#1d1d1d";
  lc.font = "bold 13px monospace";
  lc.fillText(title, MARGIN, currentY + 2);
  if (note) {
    lc.fillStyle = "#5c5c5c";
    lc.font = "10px monospace";
    lc.fillText(note, MARGIN, currentY + 18);
  }
  lc.strokeStyle = "#d7cdbf";
  lc.lineWidth = 1;
  lc.beginPath();
  lc.moveTo(MARGIN, currentY + 40);
  lc.lineTo(CANVAS_W - MARGIN, currentY + 40);
  lc.stroke();
  currentY += 58;
}

function arrow(ctx, cx, cy, angleDeg) {
  const rad = (-angleDeg * Math.PI) / 180;
  const x2 = cx + Math.cos(rad) * 38;
  const y2 = cy + Math.sin(rad) * 38;
  const left = rad + Math.PI * 0.82;
  const right = rad - Math.PI * 0.82;
  ctx.strokeStyle = "#111";
  ctx.fillStyle = "#111";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 + Math.cos(left) * 10, y2 + Math.sin(left) * 10);
  ctx.lineTo(x2 + Math.cos(right) * 10, y2 + Math.sin(right) * 10);
  ctx.closePath();
  ctx.fill();
}

function fillPoints(x, y, w, h) {
  const cx = x + w / 2;
  const cy = y + h / 2 + 6;
  const sx = Math.min(w / 260, 1);
  const sy = Math.min(h / 120, 1);
  return [
    [cx - 92 * sx, cy - 28 * sy],
    [cx + 8 * sx,  cy - 54 * sy],
    [cx + 96 * sx, cy - 16 * sy],
    [cx + 66 * sx, cy + 52 * sy],
    [cx - 78 * sx, cy + 42 * sy],
  ];
}

function drawPanel(x, y, w, h, title, seedValue, angle) {
  new brush.Polygon([[x, y], [x + w, y], [x + w, y + h], [x, y + h]]).wash(PANEL_BG, 255);
  lc.strokeStyle = FRAME;
  lc.lineWidth = 1;
  lcRoundRect(x, y, w, h, 14);
  lc.stroke();

  lc.fillStyle = "rgba(255,255,255,0.86)";
  lcRoundRect(x + 8, y + 8, w - 16, 20, 10);
  lc.fill();
  lc.fillStyle = "#4a4a4a";
  lc.font = "9px monospace";
  lc.fillText(title + " · seed " + seedValue, x + 14, y + 13);
  if (angle != null) arrow(lc, x + w - 50, y + 54, angle);

  brush.seed(seedValue);
  brush.noStroke();
  brush.fill(FILL, 72);
  angle == null ? brush.fillBleed(0.24, "out") : brush.fillBleed(0.24, "out", angle);
  brush.fillTexture(0.45, 0.45);
  brush.polygon(fillPoints(x + 18, y + 36, w - 36, h - 48));
  brush.noFill();
}

function drawRow(label, angle) {
  const available = CANVAS_W - 2 * MARGIN - LABEL_W;
  const panelW = (available - PANEL_GAP * (seeds.length - 1)) / seeds.length;

  lc.fillStyle = "rgba(251,247,239,0.94)";
  lcRoundRect(MARGIN - 2, currentY + 6, LABEL_W - 10, ROW_H - 18, 10);
  lc.fill();
  lc.fillStyle = "#2e2e2e";
  lc.font = "bold 11px monospace";
  lc.fillText(label, MARGIN, currentY + 18, LABEL_W - 20);

  seeds.forEach((seedValue, i) => {
    const x = MARGIN + LABEL_W + i * (panelW + PANEL_GAP);
    drawPanel(x, currentY, panelW, ROW_H - 8, angle == null ? "random" : angle + "°", seedValue, angle);
  });
  currentY += ROW_H;
}

brush.scaleBrushes(5);
brush.angleMode(brush.DEGREES);
brush.clear("#f4ede0");
brush.push();
brush.translate(-CANVAS_W / 2, -CANVAS_H / 2);

section("FILL BLEED ANGLE", "Each row repeats one angle with different seeds. Direction should stay consistent across the row.");
drawRow("angle omitted (random baseline)", null);
drawRow("fixed angle 0°  left → right", 0);
drawRow("fixed angle 90°  bottom → top", 90);
drawRow("fixed angle 180°  right → left", 180);
drawRow("fixed angle 270°  top → bottom", 270);

brush.pop();
brush.render();
window.reportStandaloneFirstFrame?.("fill_angle_test", {
  parseMs: scriptStart - (window.__brushLoadStart ?? scriptStart),
  drawMs: performance.now() - scriptStart,
});
