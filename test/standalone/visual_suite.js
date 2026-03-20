// ============================================================
// p5.brush Standalone Visual Suite
//
// Standalone (no p5) equivalent of test/visual_suite.html.
// ============================================================

import * as brush from "../../dist/brush.esm.js";

const CANVAS_W = 1400;
const CANVAS_H = 5200;
const MARGIN = 50;
const LABEL_W = 175;
const ROW_H = 52;
const CONTENT_X = MARGIN + LABEL_W;
const CONTENT_W = CANVAS_W - MARGIN - LABEL_W - 40;

const palette = ["#002185", "#c0392b", "#27ae60", "#8e44ad", "#e67e22"];
const query = new URLSearchParams(window.location.search);
const nativeDebugStage = query.get("nativeDebug");

function col(i) { return palette[i % palette.length]; }

// ---- Canvas setup ----

const pixelDensity = window.devicePixelRatio || 1;
brush.createCanvas(CANVAS_W, CANVAS_H, {
  id: "brush-canvas",
  parent: "#canvas-host",
  pixelDensity,
});

// Label overlay (2D canvas stacked above brush canvas via CSS grid-area)
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

// ---- Label helpers ----

function lcText(text, x, y, maxW) {
  if (!maxW) { lc.fillText(text, x, y); return; }
  const words = text.split(" ");
  let line = "";
  let dy = y;
  const lh = 13;
  for (const word of words) {
    const test = line + word + " ";
    if (lc.measureText(test).width > maxW && line) {
      lc.fillText(line.trim(), x, dy);
      line = word + " ";
      dy += lh;
    } else {
      line = test;
    }
  }
  lc.fillText(line.trim(), x, dy);
}

function header(title) {
  lc.fillStyle = "#0f0f0f";
  lc.font = "bold 12px monospace";
  lc.fillText(title, MARGIN, currentY + 4);
  lc.strokeStyle = "rgb(180,180,180)";
  lc.lineWidth = 0.7;
  lc.beginPath();
  lc.moveTo(MARGIN, currentY + 20);
  lc.lineTo(CANVAS_W - MARGIN, currentY + 20);
  lc.stroke();
  currentY += 30;
}

function rowLabel(text) {
  lc.fillStyle = "rgb(245,245,245)";
  lc.fillRect(MARGIN - 2, currentY + 2, LABEL_W - 3, ROW_H - 4);
  lc.fillStyle = "rgb(70,70,70)";
  lc.font = "10px monospace";
  lcText(text, MARGIN, currentY + ROW_H / 2 - 12, LABEL_W - 8);
}

function nextRow() { currentY += ROW_H; }
function gap(px = 12) { currentY += px; }

// ---- Error tests ----

function runErrorTests() {
  const tests = [
    ["pick() with unknown brush name", () => brush.pick("__DOES_NOT_EXIST__")],
    ["line() without brush/color set", () => { brush.noStroke(); brush.line(0, 0, 10, 10); }],
    ["flowLine() without brush/color set", () => { brush.noStroke(); brush.flowLine(0, 0, 100, 0); }],
    ["vertex() called before beginShape()", () => brush.vertex(0, 0)],
    ["endShape() called before beginShape()", () => brush.endShape()],
    ["move() called before beginStroke()", () => brush.move(0, 100, 1)],
    ["endStroke() called before beginStroke()", () => brush.endStroke(0, 1)],
    ['beginStroke() with invalid type', () => brush.beginStroke("INVALID_TYPE", 0, 0)],
    ["spline() with fewer than 2 points", () => brush.spline([[0, 0, 1]])],
    ["field() with unknown field name", () => brush.field("__DOES_NOT_EXIST__")],
    ["refreshField() when no field is active", () => { brush.noField(); brush.refreshField(); }],
  ];

  let passed = 0;
  console.group("%cp5.brush - Error Message Tests", "font-weight:bold;font-size:14px");
  for (const [desc, fn] of tests) {
    try {
      fn();
      console.error(`[FAIL]  ${desc}\n    (no error was thrown)`);
    } catch (e) {
      console.log(
        `%c[PASS]%c  ${desc}\n    > "${e.message}"`,
        "color:green;font-weight:bold", "color:inherit",
      );
      passed++;
    }
  }
  const all = passed === tests.length;
  console.log(
    `\n%c${passed} / ${tests.length} passed`,
    all ? "color:green;font-weight:bold;font-size:13px" : "color:red;font-weight:bold;font-size:13px",
  );
  console.groupEnd();
  return { passed, total: tests.length };
}

// ================================================================
// MAIN
// ================================================================

(async () => {
  brush.seed(42);
  brush.noiseSeed(42);
  brush.scaleBrushes(5);
  brush.angleMode(brush.DEGREES);

  // Image brush (async) — must be awaited before drawing starts
  await brush.add("imageTip", {
    type: "image",
    weight: 40,
    scatter: 0.15,
    opacity: 10,
    spacing: 1.5,
    pressure: [0.8, 1.2],
    rotate: "random",
    image: { src: "../../example/brush_tips/brush.jpg" },
  });

  // Custom tip brush
  brush.add("diamondTip", {
    type: "custom",
    weight: 0.6,
    scatter: 0.15,
    sharpness: 0.5,
    grain: 8,
    opacity: 30,
    spacing: 0.8,
    pressure: [1, 1],
    rotate: "natural",
    tip: (_m) => {
      _m.rotate(45);
      _m.rect(-4, -4, 8, 8);
      _m.rect(1, 1, 2, 2);
    },
  });

  // Error tests (before drawing state changes)
  brush.set("HB", "#000000", 1);
  const { passed, total } = runErrorTests();
  brush.set("HB", "#000000", 1);

  // Clear and set up transform now — after all awaits so the WebGL buffer
  // isn't discarded by the browser between the clear and brush.render().
  brush.clear("#f5f5f5");
  brush.push();
  brush.translate(-CANVAS_W / 2, -CANVAS_H / 2);

  if (passed !== total) {
    lc.fillStyle = "#b03030";
    lc.font = "10px monospace";
    lc.fillText(`Error tests: ${passed}/${total} passed. See browser console.`, MARGIN, currentY + 2);
    currentY += 20;
    gap(6);
  }

  // ================================================================
  // SECTION 1 — STANDARD BRUSHES
  // ================================================================
  header("STANDARD BRUSHES");

  const customNames = new Set(["imageTip", "diamondTip", "_pt"]);
  for (const b of brush.box().filter((n) => !customNames.has(n))) {
    brush.set(b, col(brush.box().indexOf(b)), 1);
    rowLabel(b);
    brush.flowLine(CONTENT_X, currentY + ROW_H / 2, CONTENT_W, 0);
    nextRow();
  }
  gap();

  // ================================================================
  // SECTION 2 — PRESSURE CURVES
  // ================================================================
  header("PRESSURE CURVES  (type: default, brush: pen weight)");

  const pressureCases = [
    { label: "[2, 0.3] heavy -> thin", p: [2, 0.3] },
    { label: "[0.3, 2] thin -> heavy", p: [0.3, 2] },
    { label: "[1.5, 0.3, 1.5] U-curve", p: [1.5, 0.3, 1.5] },
    { label: "[0.3, 1.5, 0.3] hill", p: [0.3, 1.5, 0.3] },
    { label: "[1, 1] flat", p: [1, 1] },
  ];
  for (const { label, p } of pressureCases) {
    brush.add("_pt", {
      type: "default", weight: 0.3, scatter: 3, sharpness: 0.3,
      grain: 8, opacity: 140, spacing: 0.1, pressure: p,
    });
    brush.set("_pt", "#1a1a1a", 1);
    rowLabel(label);
    brush.flowLine(CONTENT_X, currentY + ROW_H / 2, CONTENT_W, 0);
    nextRow();
  }
  gap();

  // ================================================================
  // SECTION 3 — BRUSH TYPES
  // ================================================================
  header("BRUSH TYPES");

  const typeTests = [
    { label: "custom tip  (diamondTip)", name: "diamondTip", color: col(0) },
    { label: "image tip   (imageTip)", name: "imageTip", color: col(0) },
    { label: "marker", name: "marker", color: col(1) },
    { label: "spray", name: "spray", color: col(2) },
  ];
  for (const t of typeTests) {
    brush.set(t.name, t.color, 1);
    rowLabel(t.label);
    brush.flowLine(CONTENT_X, currentY + ROW_H / 2, CONTENT_W, 0);
    nextRow();
  }
  gap();

  // ================================================================
  // SECTION 4 — FLOW FIELDS
  // ================================================================
  header("FLOW FIELDS  (hatching reveals distortion per field)");

  const FIELD_GAP = 20;
  const FIELD_CELL_W = Math.floor((CONTENT_W - FIELD_GAP) / 2);
  const FIELD_CELL_H = 140;
  const FIELD_LINES = 9;
  const allFields = [...brush.listFields().filter((f) => f !== "hand"), "hand"];

  for (let fi = 0; fi < allFields.length; fi += 2) {
    for (let side = 0; side < 2 && fi + side < allFields.length; side++) {
      const name = allFields[fi + side];
      const cellX = CONTENT_X + side * (FIELD_CELL_W + FIELD_GAP);
      const cellY = currentY;

      if (name === "hand") {
        brush.wiggle(5);
      } else {
        brush.field(name);
      }
      brush.set("HB", col(fi + side), 1);

      for (let li = 0; li < FIELD_LINES; li++) {
        const ly = cellY + 22 + (li / (FIELD_LINES - 1)) * (FIELD_CELL_H - 32);
        brush.flowLine(cellX, ly, FIELD_CELL_W, 0);
      }

      lc.fillStyle = "rgb(245,245,245)";
      lc.fillRect(cellX, cellY, 130, 18);
      lc.fillStyle = "rgb(30,30,30)";
      lc.font = "bold 10px monospace";
      lc.fillText(name === "hand" ? "hand  [wiggle(5)]" : name, cellX + 4, cellY + 4);
    }
    currentY += FIELD_CELL_H + 8;
  }
  brush.noField();
  gap();

  // ================================================================
  // SECTION 5 — PRIMITIVES
  // ================================================================
  header("PRIMITIVES");

  const toRad = (d) => (d * Math.PI) / 180;

  brush.set("pen", col(0), 1);
  rowLabel("line()");
  brush.line(CONTENT_X, currentY + ROW_H / 2, CONTENT_X + 500, currentY + ROW_H / 2);
  nextRow();

  brush.set("HB", col(1), 1);
  rowLabel("flowLine()");
  brush.flowLine(CONTENT_X, currentY + ROW_H / 2, 500, 0);
  nextRow();

  brush.set("pen", col(2), 1);
  rowLabel("circle()");
  brush.circle(CONTENT_X + 80, currentY + ROW_H / 2, 22, true);
  nextRow();

  brush.set("HB", col(3), 1);
  rowLabel("arc()");
  brush.arc(CONTENT_X + 80, currentY + ROW_H / 2 + 5, 22, 0, 270);
  nextRow();

  brush.set("cpencil", col(4), 1);
  rowLabel("rect()");
  brush.rect(CONTENT_X, currentY + 6, 260, ROW_H - 14);
  nextRow();

  brush.set("2B", col(0), 1);
  rowLabel("spline()");
  brush.spline(
    [
      [CONTENT_X,       currentY + ROW_H - 10, 1],
      [CONTENT_X + 110, currentY + 10,         1],
      [CONTENT_X + 220, currentY + ROW_H - 10, 1],
      [CONTENT_X + 330, currentY + 10,         1],
      [CONTENT_X + 440, currentY + ROW_H - 10, 1],
    ],
    0.5,
  );
  nextRow();

  brush.set("pen", col(2), 1);
  rowLabel("polygon()");
  const px = CONTENT_X + 70, py = currentY + ROW_H / 2, pr = 22;
  brush.polygon([
    [px + pr * Math.cos(toRad(0)),   py + pr * Math.sin(toRad(0)),   1],
    [px + pr * Math.cos(toRad(72)),  py + pr * Math.sin(toRad(72)),  1],
    [px + pr * Math.cos(toRad(144)), py + pr * Math.sin(toRad(144)), 1],
    [px + pr * Math.cos(toRad(216)), py + pr * Math.sin(toRad(216)), 1],
    [px + pr * Math.cos(toRad(288)), py + pr * Math.sin(toRad(288)), 1],
  ]);
  nextRow();
  gap();

  // ================================================================
  // SECTION 6 — beginShape / vertex / endShape
  // ================================================================
  header("beginShape / vertex / endShape");

  brush.set("2B", col(0), 1);
  rowLabel("open shape (curvature 0.5)");
  brush.beginShape(0.5);
  for (let i = 0; i < 7; i++) {
    brush.vertex(CONTENT_X + i * 70, currentY + (i % 2 === 0 ? 10 : ROW_H - 10));
  }
  brush.endShape(false);
  nextRow();

  brush.set("HB", col(1), 1);
  rowLabel("closed shape (curvature 0.3)");
  brush.beginShape(0.3);
  brush.vertex(CONTENT_X + 40,  currentY + ROW_H - 8);
  brush.vertex(CONTENT_X + 90,  currentY + 8);
  brush.vertex(CONTENT_X + 140, currentY + ROW_H - 8);
  brush.vertex(CONTENT_X + 190, currentY + 8);
  brush.vertex(CONTENT_X + 240, currentY + ROW_H - 8);
  brush.endShape(true);
  nextRow();
  gap();

  // ================================================================
  // SECTION 7 — beginStroke / move / endStroke
  // ================================================================
  header("beginStroke / move / endStroke");

  brush.set("cpencil", col(0), 1);
  rowLabel('type: "curve"');
  brush.beginStroke("curve", CONTENT_X, currentY + ROW_H / 2);
  brush.move(15, 90, 1.0);
  brush.move(25, 90, 1.5);
  brush.move(-25, 90, 0.5);
  brush.move(-15, 90, 1.0);
  brush.move(0, 90, 1.2);
  brush.endStroke(0, 1);
  nextRow();

  brush.set("pen", col(3), 1);
  rowLabel('type: "segments"');
  brush.beginStroke("segments", CONTENT_X, currentY + ROW_H / 2);
  brush.move(20,  90, 1.0);
  brush.move(-20, 90, 1.5);
  brush.move(35,  90, 0.7);
  brush.move(-35, 90, 1.2);
  brush.move(0,   90, 1.0);
  brush.endStroke(0, 1);
  nextRow();
  gap();

  // ================================================================
  // SECTION 8 — HATCH
  // ================================================================
  header("HATCH");

  const hatchTests = [
    { label: "45deg basic",       angle: 45, dist: 9, opts: {} },
    { label: "0deg horizontal",   angle: 0,  dist: 9, opts: {} },
    { label: "rand + continuous", angle: 30, dist: 8, opts: { rand: 0.2, continuous: true } },
    { label: "gradient (0.6)",    angle: 60, dist: 6, opts: { gradient: 0.6 } },
  ];

  for (let hi = 0; hi < hatchTests.length; hi++) {
    const h = hatchTests[hi];
    brush.hatch(h.dist, h.angle, h.opts);
    brush.hatchStyle("HB", col(hi), 1);
    rowLabel(h.label);
    const hp = new brush.Polygon([
      [CONTENT_X,       currentY + 5],
      [CONTENT_X + 260, currentY + 5],
      [CONTENT_X + 260, currentY + ROW_H - 6],
      [CONTENT_X,       currentY + ROW_H - 6],
    ]);
    hp.hatch();
    brush.noHatch();
    nextRow();
  }
  gap();

  // ================================================================
  // SECTION 9 — FILL (watercolor)
  // ================================================================
  header("FILL  (watercolor)  rect + polygon per row");

  const FILL_ROW_H = 115;
  const FRECT_W = 230, FRECT_H = 90;
  const FCIRC_R = 45;
  const FCIRC_X = CONTENT_X + FRECT_W + 70 + FCIRC_R;

  function fillSubHeader(text) {
    lc.fillStyle = "rgb(120,120,120)";
    lc.font = "italic 9px monospace";
    lc.fillText(text, MARGIN, currentY + 4);
    currentY += 18;
  }

  function fillRow(label, color, opacity, bleed, dir, texture, border) {
    brush.noStroke();
    brush.fill(color, opacity);
    brush.fillBleed(bleed, dir);
    brush.fillTexture(texture, border);

    lc.fillStyle = "rgb(245,245,245)";
    lc.fillRect(MARGIN - 2, currentY + 2, LABEL_W - 3, FILL_ROW_H - 4);
    lc.fillStyle = "rgb(70,70,70)";
    lc.font = "10px monospace";
    lcText(label, MARGIN, currentY + FILL_ROW_H / 2 - 12, LABEL_W - 8);

    const ry = currentY + (FILL_ROW_H - FRECT_H) / 2;
    brush.rect(CONTENT_X, ry, FRECT_W, FRECT_H);

    const cx = FCIRC_X, cy = currentY + FILL_ROW_H / 2;
    const n = 24;
    const pts = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return [cx + FCIRC_R * Math.cos(a), cy + FCIRC_R * Math.sin(a)];
    });
    brush.polygon(pts);
    brush.noFill();
    currentY += FILL_ROW_H;
  }

  fillSubHeader("bleed strength  (texture 0.4, border 0.4, opacity 60)");
  fillRow("bleed 0.03  out", col(0), 60, 0.03, "out", 0.4, 0.4);
  fillRow("bleed 0.1   out", col(0), 60, 0.1,  "out", 0.4, 0.4);
  fillRow("bleed 0.25  out", col(0), 60, 0.25, "out", 0.4, 0.4);
  fillRow("bleed 0.5   out", col(0), 60, 0.5,  "out", 0.4, 0.4);

  fillSubHeader("bleed direction  (bleed 0.2, texture 0.4, border 0.4, opacity 60)");
  fillRow("direction: out", col(1), 60, 0.2, "out", 0.4, 0.4);
  fillRow("direction: in",  col(1), 60, 0.2, "in",  0.4, 0.4);

  fillSubHeader("texture strength  (bleed 0.1, border 0.4, opacity 60)");
  fillRow("texture 0.05", col(2), 60, 0.1, "out", 0.05, 0.4);
  fillRow("texture 0.3",  col(2), 60, 0.1, "out", 0.3,  0.4);
  fillRow("texture 0.7",  col(2), 60, 0.1, "out", 0.7,  0.4);
  fillRow("texture 1.0",  col(2), 60, 0.1, "out", 1.0,  0.4);

  fillSubHeader("border strength  (bleed 0.1, texture 0.4, opacity 60)");
  fillRow("border 0.05", col(3), 60, 0.1, "out", 0.4, 0.05);
  fillRow("border 0.3",  col(3), 60, 0.1, "out", 0.4, 0.3);
  fillRow("border 0.7",  col(3), 60, 0.1, "out", 0.4, 0.7);
  fillRow("border 1.0",  col(3), 60, 0.1, "out", 0.4, 1.0);

  fillSubHeader("opacity  (bleed 0.1, texture 0.4, border 0.4)");
  fillRow("opacity 20",  col(4), 20,  0.1, "out", 0.4, 0.4);
  fillRow("opacity 50",  col(4), 50,  0.1, "out", 0.4, 0.4);
  fillRow("opacity 90",  col(4), 90,  0.1, "out", 0.4, 0.4);
  fillRow("opacity 140", col(4), 140, 0.1, "out", 0.4, 0.4);

  brush.pop();
  brush.render();
  window.reportStandaloneFirstFrame?.("visual_suite");
  console.log("Standalone visual suite complete");
})();
