// ============================================================
// p5.brush Hatch Test
//
// Exercises the hatch module: angle sweep, spacing, rand,
// gradient, continuous, cross-hatching, brush types, polygon
// shapes, large polygons, and combined options.
//
// Run:  open test/hatch_test.html
// ============================================================

const CANVAS_W = 1360;
const CANVAS_H = 1800;
const MARGIN = 36;
const LABEL_W = 170;
const PANEL_GAP = 14;
const ROW_H = 160;

const INK = "#183a59";
const FRAME = "#cdbfae";
const PANEL_BG = "#fcf7ef";

const palette = ["#002185", "#c0392b", "#27ae60", "#8e44ad", "#e67e22", "#16a085", "#d35400"];
function col(i) { return palette[i % palette.length]; }

let currentY = MARGIN;
let labelBuf;

// ---- Layout helpers (matches angle_mode_test pattern) ----

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

function drawRow(label, panels) {
  const available = CANVAS_W - 2 * MARGIN - LABEL_W;
  const panelW = (available - PANEL_GAP * (panels.length - 1)) / panels.length;

  // Row label
  labelBuf.noStroke();
  labelBuf.fill(251, 247, 239, 240);
  labelBuf.rect(MARGIN - 2, currentY + 6, LABEL_W - 10, ROW_H - 18, 10);
  labelBuf.fill(46);
  labelBuf.textStyle(BOLD);
  labelBuf.textSize(11);
  labelBuf.text(label, MARGIN, currentY + 20, LABEL_W - 18, ROW_H - 30);

  panels.forEach((panel, index) => {
    const x = MARGIN + LABEL_W + index * (panelW + PANEL_GAP);
    const y = currentY;

    // Panel frame
    push();
    fill(PANEL_BG);
    stroke(FRAME);
    strokeWeight(1);
    rect(x, y, panelW, ROW_H - 8, 14);
    pop();

    // Panel title
    labelBuf.noStroke();
    labelBuf.fill(255, 255, 255, 220);
    labelBuf.rect(x + 8, y + 8, panelW - 16, 18, 9);
    labelBuf.fill(74);
    labelBuf.textStyle(NORMAL);
    labelBuf.textSize(9);
    labelBuf.text(panel.title, x + 14, y + 21);

    panel.render(x + 10, y + 32, panelW - 20, ROW_H - 48);
  });

  currentY += ROW_H;
}

// ---- Hatch-in-panel helper ----

function hatchInPanel(x, y, w, h, polyFn, hatchSetup, brushName, brushColor) {
  const poly = polyFn(x, y, w, h);
  brush.noField();
  brush.noStroke();
  brush.noFill();
  hatchSetup();
  brush.hatchStyle(brushName || "HB", brushColor || INK, 1);
  poly.hatch();
  brush.noHatch();
}

// ---- Polygon factories (take panel-local x, y, w, h) ----

function makeRect(x, y, w, h) {
  return new brush.Polygon([
    [x, y], [x + w, y], [x + w, y + h], [x, y + h],
  ]);
}

function makeTriangle(x, y, w, h) {
  return new brush.Polygon([
    [x + w / 2, y], [x + w, y + h], [x, y + h],
  ]);
}

function makeDiamond(x, y, w, h) {
  return new brush.Polygon([
    [x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2],
  ]);
}

function makeIrregular(x, y, w, h) {
  return new brush.Polygon([
    [x + w * 0.1, y + h * 0.2],
    [x + w * 0.4, y],
    [x + w * 0.8, y + h * 0.1],
    [x + w, y + h * 0.5],
    [x + w * 0.7, y + h],
    [x + w * 0.3, y + h * 0.9],
    [x, y + h * 0.6],
  ]);
}

function makeStar(x, y, w, h) {
  const cx = x + w / 2, cy = y + h / 2;
  const outerR = Math.min(w, h) * 0.48;
  const innerR = outerR * 0.4;
  const verts = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    verts.push([cx + Math.cos(angle) * r, cy + Math.sin(angle) * r]);
  }
  return new brush.Polygon(verts);
}

function makeCircleApprox(x, y, w, h, n) {
  const cx = x + w / 2, cy = y + h / 2;
  const rx = w * 0.45, ry = h * 0.45;
  const verts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    verts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return new brush.Polygon(verts);
}

// ============================================================
// Main sketch
// ============================================================

function setup() {
  randomSeed(42);
  noiseSeed(42);
  const canvas = createCanvas(CANVAS_W, CANVAS_H, WEBGL);
  canvas.parent("canvas-host");
  brush.load();
  brush.scaleBrushes(2.4);
  angleMode(DEGREES);
  noLoop();

  labelBuf = createGraphics(CANVAS_W, CANVAS_H);
  labelBuf.pixelDensity(pixelDensity());
  labelBuf.textFont("monospace");
}

function draw() {
  background("#f4ede0");
  translate(-width / 2, -height / 2);

  // ================================================================
  // 1 — Angle sweep
  // ================================================================
  section("ANGLE SWEEP", "Same rectangle, angle from 0 to 170 degrees");

  const angles = [0, 30, 45, 60, 90, 135, 170];
  drawRow("angle variations", angles.map((a, i) => ({
    title: a + "°",
    render: (x, y, w, h) => hatchInPanel(x, y, w, h, makeRect,
      () => brush.hatch(6, a), "HB", col(i)),
  })));

  // ================================================================
  // 2 — Spacing
  // ================================================================
  section("SPACING", "Same angle (45°), varying dist");

  const spacings = [3, 6, 10, 18, 30];
  drawRow("dist variations", spacings.map((d, i) => ({
    title: "dist=" + d,
    render: (x, y, w, h) => hatchInPanel(x, y, w, h, makeRect,
      () => brush.hatch(d, 45), "HB", col(i)),
  })));

  // ================================================================
  // 3 — Rand option
  // ================================================================
  section("RAND OPTION", "Increasing randomness displaces line endpoints");

  const rands = [0, 0.3, 0.6, 1.0, 1.5];
  drawRow("rand values", rands.map((r, i) => ({
    title: "rand=" + r,
    render: (x, y, w, h) => hatchInPanel(x, y, w, h, makeRect,
      () => brush.hatch(7, 45, { rand: r }), "HB", col(i)),
  })));

  // ================================================================
  // 4 — Gradient option
  // ================================================================
  section("GRADIENT OPTION", "Line spacing grows multiplicatively per line");

  const grads = [0, 0.3, 0.6, 0.8, 1.0];
  drawRow("gradient values", grads.map((g, i) => ({
    title: "grad=" + g,
    render: (x, y, w, h) => hatchInPanel(x, y, w, h, makeRect,
      () => brush.hatch(5, 30, { gradient: g }), "HB", col(i)),
  })));

  // ================================================================
  // 5 — Continuous
  // ================================================================
  section("CONTINUOUS OPTION", "Connected lines vs independent segments");

  drawRow("continuous", [
    {
      title: "continuous: false",
      render: (x, y, w, h) => hatchInPanel(x, y, w, h, makeRect,
        () => brush.hatch(12, 45, { continuous: false }), "HB", col(0)),
    },
    {
      title: "continuous: true",
      render: (x, y, w, h) => hatchInPanel(x, y, w, h, makeRect,
        () => brush.hatch(12, 45, { continuous: true }), "HB", col(1)),
    },
  ]);

  // ================================================================
  // 6 — Polygon shapes
  // ================================================================
  section("POLYGON SHAPES", "Same hatch (45°, dist=6) on different shapes");

  const shapeFns = [
    { title: "Rectangle", fn: makeRect },
    { title: "Triangle", fn: makeTriangle },
    { title: "Diamond", fn: makeDiamond },
    { title: "Irregular", fn: makeIrregular },
    { title: "Star", fn: makeStar },
  ];
  drawRow("shape variety", shapeFns.map((s, i) => ({
    title: s.title,
    render: (x, y, w, h) => hatchInPanel(x, y, w, h, s.fn,
      () => brush.hatch(6, 45), "HB", col(i)),
  })));

  // ================================================================
  // 7 — Cross-hatching
  // ================================================================
  section("CROSS-HATCHING", "Two hatch passes at different angles");

  const crossPairs = [
    { a1: 45, a2: -45, label: "45 / -45" },
    { a1: 0, a2: 90, label: "0 / 90" },
    { a1: 30, a2: 120, label: "30 / 120" },
  ];
  drawRow("cross-hatch", crossPairs.map((cp, i) => ({
    title: cp.label,
    render: (x, y, w, h) => {
      const poly = makeRect(x, y, w, h);
      brush.noField(); brush.noStroke(); brush.noFill();

      brush.hatch(8, cp.a1);
      brush.hatchStyle("HB", col(i * 2), 1);
      poly.hatch();
      brush.noHatch();

      brush.hatch(8, cp.a2);
      brush.hatchStyle("HB", col(i * 2 + 1), 1);
      poly.hatch();
      brush.noHatch();
    },
  })));

  // ================================================================
  // 8 — Large polygon (many vertices)
  // ================================================================
  section("LARGE POLYGON", "64-vertex circle approximation with fine spacing");

  drawRow("64-vert circle", [
    {
      title: "dist=4, angle=30",
      render: (x, y, w, h) => hatchInPanel(x, y, w, h,
        (x, y, w, h) => makeCircleApprox(x, y, w, h, 64),
        () => brush.hatch(4, 30), "HB", col(0)),
    },
    {
      title: "dist=4, angle=75",
      render: (x, y, w, h) => hatchInPanel(x, y, w, h,
        (x, y, w, h) => makeCircleApprox(x, y, w, h, 64),
        () => brush.hatch(4, 75), "HB", col(3)),
    },
    {
      title: "dist=3, angle=45, rand=0.3",
      render: (x, y, w, h) => hatchInPanel(x, y, w, h,
        (x, y, w, h) => makeCircleApprox(x, y, w, h, 64),
        () => brush.hatch(3, 45, { rand: 0.3 }), "HB", col(5)),
    },
  ]);

  // ================================================================
  // 9 — Combined options
  // ================================================================
  section("COMBINED OPTIONS", "Mixing rand, gradient, and continuous");

  drawRow("combos", [
    {
      title: "rand + gradient",
      render: (x, y, w, h) => hatchInPanel(x, y, w, h, makeRect,
        () => brush.hatch(6, 45, { rand: 0.4, gradient: 0.5 }), "HB", col(0)),
    },
    {
      title: "rand + continuous",
      render: (x, y, w, h) => hatchInPanel(x, y, w, h, makeRect,
        () => brush.hatch(8, 45, { rand: 0.3, continuous: true }), "HB", col(1)),
    },
    {
      title: "all three",
      render: (x, y, w, h) => hatchInPanel(x, y, w, h, makeRect,
        () => brush.hatch(6, 45, { rand: 0.3, gradient: 0.3, continuous: true }), "HB", col(2)),
    },
  ]);

  // ================================================================
  // Composite labels on top
  // ================================================================
  image(labelBuf, 0, 0);
  console.log("Hatch test complete");
}
