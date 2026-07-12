// ============================================================
// p5.brush Fill Angle Test
//
// Same polygon repeated with different seeds. Fixed-angle rows
// should keep the wash direction consistent across every panel.
// ============================================================

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

let currentY = MARGIN;
let labelBuf;

function section(title, note) {
  labelBuf.noStroke();
  labelBuf.fill(29);
  labelBuf.textStyle(BOLD);
  labelBuf.textSize(13);
  labelBuf.text(title, MARGIN, currentY + 14);
  if (note) {
    labelBuf.fill(92);
    labelBuf.textStyle(NORMAL);
    labelBuf.textSize(10);
    labelBuf.text(note, MARGIN, currentY + 30);
  }
  push();
  stroke(215, 205, 191);
  strokeWeight(1);
  line(MARGIN, currentY + 40, CANVAS_W - MARGIN, currentY + 40);
  pop();
  currentY += 58;
}

function arrow(g, cx, cy, angleDeg) {
  const rad = (-angleDeg * Math.PI) / 180;
  const x2 = cx + Math.cos(rad) * 38;
  const y2 = cy + Math.sin(rad) * 38;
  const left = rad + Math.PI * 0.82;
  const right = rad - Math.PI * 0.82;
  g.stroke("#111");
  g.strokeWeight(2);
  g.line(cx, cy, x2, y2);
  g.noStroke();
  g.fill("#111");
  g.triangle(
    x2, y2,
    x2 + Math.cos(left) * 10, y2 + Math.sin(left) * 10,
    x2 + Math.cos(right) * 10, y2 + Math.sin(right) * 10,
  );
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
  push();
  fill(PANEL_BG);
  stroke(FRAME);
  strokeWeight(1);
  rect(x, y, w, h, 14);
  pop();

  labelBuf.noStroke();
  labelBuf.fill(255, 255, 255, 220);
  labelBuf.rect(x + 8, y + 8, w - 16, 20, 10);
  labelBuf.fill(74);
  labelBuf.textStyle(NORMAL);
  labelBuf.textSize(9);
  labelBuf.text(title + " · seed " + seedValue, x + 14, y + 22);
  if (angle != null) arrow(labelBuf, x + w - 50, y + 54, angle);

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

  labelBuf.noStroke();
  labelBuf.fill(251, 247, 239, 240);
  labelBuf.rect(MARGIN - 2, currentY + 6, LABEL_W - 10, ROW_H - 18, 10);
  labelBuf.fill(46);
  labelBuf.textStyle(BOLD);
  labelBuf.textSize(11);
  labelBuf.text(label, MARGIN, currentY + 20, LABEL_W - 18, ROW_H - 30);

  seeds.forEach((seedValue, i) => {
    const x = MARGIN + LABEL_W + i * (panelW + PANEL_GAP);
    drawPanel(x, currentY, panelW, ROW_H - 8, angle == null ? "random" : angle + "°", seedValue, angle);
  });
  currentY += ROW_H;
}

function setup() {
  createCanvas(CANVAS_W, CANVAS_H, WEBGL).parent("canvas-host");
  brush.load();
  brush.scaleBrushes(5);
  angleMode(DEGREES);
  noLoop();

  labelBuf = createGraphics(CANVAS_W, CANVAS_H);
  labelBuf.pixelDensity(pixelDensity());
  labelBuf.textFont("monospace");
}

function draw() {
  background("#f4ede0");
  translate(-width / 2, -height / 2);

  section("FILL BLEED ANGLE", "Each row repeats one angle with different seeds. Direction should stay consistent across the row.");
  drawRow("angle omitted (random baseline)", null);
  drawRow("fixed angle 0°  left → right", 0);
  drawRow("fixed angle 90°  bottom → top", 90);
  drawRow("fixed angle 180°  right → left", 180);
  drawRow("fixed angle 270°  top → bottom", 270);

  image(labelBuf, 0, 0);
  window.reportP5FirstFrame?.("fill_angle_test");
}
