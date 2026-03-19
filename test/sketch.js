// ============================================================
// p5.brush Visual Test Suite
//
// Opens a canvas that exercises every public API function.
// Error-message tests are logged to the browser console.
//
// Run:  open test/visual_suite.html
// ============================================================

// ---- Layout constants ----
const CANVAS_W = 1400;
const CANVAS_H = 5200;
const MARGIN = 50;
const LABEL_W = 175; // width reserved for row labels
const ROW_H = 52; // height of one test row
const CONTENT_X = MARGIN + LABEL_W;
const CONTENT_W = CANVAS_W - MARGIN - LABEL_W - 40;

let currentY = MARGIN;
let labelBuf; // P2D overlay for labels (composited at the end)

const palette = ["#002185", "#c0392b", "#27ae60", "#8e44ad", "#e67e22"];
const query = new URLSearchParams(window.location.search);
const nativeDebugStage = query.get("nativeDebug");

function col(i) {
  return palette[i % palette.length];
}

// ---- Label helpers (all draw to labelBuf so they don't interfere with brush) ----

function header(title) {
  labelBuf.noStroke();
  labelBuf.fill(15);
  labelBuf.textSize(12);
  labelBuf.textStyle(BOLD);
  labelBuf.text(title, MARGIN, currentY + 15);
  labelBuf.stroke(180);
  labelBuf.strokeWeight(0.7);
  labelBuf.line(MARGIN, currentY + 20, CANVAS_W - MARGIN, currentY + 20);
  currentY += 30;
}

function rowLabel(text) {
  labelBuf.noStroke();
  // White bg so label is readable over any brush strokes that bleed left
  labelBuf.fill(245);
  labelBuf.rect(MARGIN - 2, currentY + 2, LABEL_W - 3, ROW_H - 4);
  labelBuf.fill(70);
  labelBuf.textSize(10);
  labelBuf.textStyle(NORMAL);
  // Constrain text to label column so it never overlaps brush strokes
  labelBuf.text(text, MARGIN, currentY + ROW_H / 2 - 4, LABEL_W - 8, ROW_H);
}

function nextRow() {
  currentY += ROW_H;
}

function gap(px = 12) {
  currentY += px;
}

// ---- Error tests (runs before drawing, logged to console) ----

function runErrorTests() {
  // Each test: [description, function that SHOULD throw]
  const tests = [
    ["pick() with unknown brush name", () => brush.pick("__DOES_NOT_EXIST__")],
    [
      "line() without brush/color set",
      () => {
        brush.noStroke();
        brush.line(0, 0, 10, 10);
      },
    ],
    [
      "flowLine() without brush/color set",
      () => {
        brush.noStroke();
        brush.flowLine(0, 0, 100, 0);
      },
    ],
    ["vertex() called before beginShape()", () => brush.vertex(0, 0)],
    ["endShape() called before beginShape()", () => brush.endShape()],
    ["move() called before beginStroke()", () => brush.move(0, 100, 1)],
    ["endStroke() called before beginStroke()", () => brush.endStroke(0, 1)],
    [
      'beginStroke() with invalid type (not "curve"/"segments")',
      () => brush.beginStroke("INVALID_TYPE", 0, 0),
    ],
    ["spline() with fewer than 2 points", () => brush.spline([[0, 0, 1]])],
    [
      "field() with unknown field name",
      () => brush.field("__DOES_NOT_EXIST__"),
    ],
    [
      "refreshField() when no field is active",
      () => {
        brush.noField();
        brush.refreshField();
      },
    ],
  ];

  let passed = 0;
  console.group(
    "%cp5.brush - Error Message Tests",
    "font-weight:bold;font-size:14px",
  );

  for (const [desc, fn] of tests) {
    try {
      fn();
      console.error(`[FAIL]  ${desc}\n    (no error was thrown)`);
    } catch (e) {
      console.log(
        `%c[PASS]%c  ${desc}\n    > "${e.message}"`,
        "color:green;font-weight:bold",
        "color:inherit",
      );
      passed++;
    }
  }

  const all = passed === tests.length;
  console.log(
    `\n%c${passed} / ${tests.length} passed`,
    all
      ? "color:green;font-weight:bold;font-size:13px"
      : "color:red;font-weight:bold;font-size:13px",
  );
  console.groupEnd();

  return { passed, total: tests.length };
}

// ================================================================
// MAIN SETUP
// ================================================================

async function setup() {
  randomSeed(42);
  noiseSeed(42);

  const canvas = createCanvas(CANVAS_W, CANVAS_H, WEBGL);
  canvas.parent("canvas-host");
  brush.load();
  brush.scaleBrushes(5);
  angleMode(DEGREES);

  // P2D buffer for labels — transparent background so brush strokes show through
  labelBuf = createGraphics(CANVAS_W, CANVAS_H);
  labelBuf.pixelDensity(pixelDensity());
  labelBuf.textFont("monospace");
  labelBuf.textLeading(14);

  // Gray canvas background (visible where no brush strokes land)
  background(245);

  // Shift origin to top-left corner (WEBGL default is center)
  translate(-width / 2, -height / 2);

  // ---- Add image brush (must be awaited) ----
  await brush.add("imageTip", {
    type: "image",
    weight: 40,
    scatter: 0.15,
    opacity: 10,
    spacing: 1.5,
    pressure: [0.8, 1.2],
    rotate: "random",
    image: { src: "../example/brush_tips/brush.jpg" },
  });

  // ---- Add custom tip brush ----
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

  // ---- Run error tests first (before modifying drawing state) ----
  brush.set("HB", "#000000", 1); // ensure canvas is ready for canvas-dependent checks
  const { passed, total } = runErrorTests();
  brush.set("HB", "#000000", 1); // restore clean state

  const ok = passed === total;
  if (!ok) {
    labelBuf.noStroke();
    labelBuf.fill("#b03030");
    labelBuf.textSize(10);
    labelBuf.textStyle(NORMAL);
    labelBuf.text(
      `Error tests: ${passed}/${total} passed. See browser console.`,
      MARGIN,
      currentY + 12,
    );
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
      type: "default",
      weight: 0.3,
      scatter: 3,
      sharpness: 0.3,
      grain: 8,
      opacity: 140,
      spacing: 0.1,
      pressure: p,
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

  // All fields except "hand"; add "hand" at end as wiggle demo
  const allFields = [...brush.listFields().filter((f) => f !== "hand"), "hand"];

  for (let fi = 0; fi < allFields.length; fi += 2) {
    for (let side = 0; side < 2 && fi + side < allFields.length; side++) {
      const name = allFields[fi + side];
      const cellX = CONTENT_X + side * (FIELD_CELL_W + FIELD_GAP);
      const cellY = currentY;
      const lineColor = col(fi + side);

      if (name === "hand") {
        brush.wiggle(5);
      } else {
        brush.field(name);
      }
      brush.set("HB", lineColor, 1);

      for (let li = 0; li < FIELD_LINES; li++) {
        const ly =
          cellY + 22 + (li / (FIELD_LINES - 1)) * (FIELD_CELL_H - 32);
        brush.flowLine(cellX, ly, FIELD_CELL_W, 0);
      }

      // Label above the hatch lines
      labelBuf.noStroke();
      labelBuf.fill(245);
      labelBuf.rect(cellX, cellY, 130, 18);
      labelBuf.fill(30);
      labelBuf.textSize(10);
      labelBuf.textStyle(BOLD);
      labelBuf.text(
        name === "hand" ? "hand  [wiggle(5)]" : name,
        cellX + 4,
        cellY + 13,
      );
    }
    currentY += FIELD_CELL_H + 8;
  }

  brush.noField();
  gap();

  // ================================================================
  // SECTION 5 — PRIMITIVES
  // ================================================================
  header("PRIMITIVES");

  // line()
  brush.set("pen", col(0), 1);
  rowLabel("line()");
  brush.line(
    CONTENT_X,
    currentY + ROW_H / 2,
    CONTENT_X + 500,
    currentY + ROW_H / 2,
  );
  nextRow();

  // flowLine()
  brush.set("HB", col(1), 1);
  rowLabel("flowLine()");
  brush.flowLine(CONTENT_X, currentY + ROW_H / 2, 500, 0);
  nextRow();

  // circle()
  brush.set("pen", col(2), 1);
  rowLabel("circle()");
  brush.circle(CONTENT_X + 80, currentY + ROW_H / 2, 22, true);
  nextRow();

  // arc()
  brush.set("HB", col(3), 1);
  rowLabel("arc()");
  brush.arc(CONTENT_X + 80, currentY + ROW_H / 2 + 5, 22, 0, Math.PI * 1.5);
  nextRow();

  // rect()
  brush.set("cpencil", col(4), 1);
  rowLabel("rect()");
  brush.rect(CONTENT_X, currentY + 6, 260, ROW_H - 14);
  nextRow();

  // spline()
  brush.set("2B", col(0), 1);
  rowLabel("spline()");
  brush.spline(
    [
      [CONTENT_X, currentY + ROW_H - 10, 1],
      [CONTENT_X + 110, currentY + 10, 1],
      [CONTENT_X + 220, currentY + ROW_H - 10, 1],
      [CONTENT_X + 330, currentY + 10, 1],
      [CONTENT_X + 440, currentY + ROW_H - 10, 1],
    ],
    0.5,
  );
  nextRow();

  // polygon()
  brush.set("pen", col(2), 1);
  rowLabel("polygon()");
  const px = CONTENT_X + 70,
    py = currentY + ROW_H / 2,
    pr = 22;
  brush.polygon([
    [px + pr * cos(0), py + pr * sin(0), 1],
    [px + pr * cos(72), py + pr * sin(72), 1],
    [px + pr * cos(144), py + pr * sin(144), 1],
    [px + pr * cos(216), py + pr * sin(216), 1],
    [px + pr * cos(288), py + pr * sin(288), 1],
  ]);
  nextRow();
  gap();

  // ================================================================
  // SECTION 6 — beginShape / vertex / endShape
  // ================================================================
  header("beginShape / vertex / endShape");

  // open shape
  brush.set("2B", col(0), 1);
  rowLabel("open shape (curvature 0.5)");
  brush.beginShape(0.5);
  for (let i = 0; i < 7; i++) {
    brush.vertex(
      CONTENT_X + i * 70,
      currentY + (i % 2 === 0 ? 10 : ROW_H - 10),
    );
  }
  brush.endShape(false);
  nextRow();

  // closed shape
  brush.set("HB", col(1), 1);
  rowLabel("closed shape (curvature 0.3)");
  brush.beginShape(0.3);
  brush.vertex(CONTENT_X + 40, currentY + ROW_H - 8);
  brush.vertex(CONTENT_X + 90, currentY + 8);
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
  brush.move(20, 90, 1.0);
  brush.move(-20, 90, 1.5);
  brush.move(35, 90, 0.7);
  brush.move(-35, 90, 1.2);
  brush.move(0, 90, 1.0);
  brush.endStroke(0, 1);
  nextRow();
  gap();

  // ================================================================
  // SECTION 8 — HATCH
  // ================================================================
  header("HATCH");

  const hatchTests = [
    { label: "45deg basic", angle: 45, dist: 9, opts: {} },
    { label: "0deg horizontal", angle: 0, dist: 9, opts: {} },
    {
      label: "rand + continuous",
      angle: 30,
      dist: 8,
      opts: { rand: 0.2, continuous: true },
    },
    { label: "gradient (0.6)", angle: 60, dist: 6, opts: { gradient: 0.6 } },
  ];

  for (let hi = 0; hi < hatchTests.length; hi++) {
    const h = hatchTests[hi];
    brush.hatch(h.dist, h.angle, h.opts);
    brush.hatchStyle("HB", col(hi), 1);
    rowLabel(h.label);
    const hp = new brush.Polygon([
      [CONTENT_X, currentY + 5],
      [CONTENT_X + 260, currentY + 5],
      [CONTENT_X + 260, currentY + ROW_H - 6],
      [CONTENT_X, currentY + ROW_H - 6],
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
  const FCIRC_X = CONTENT_X + FRECT_W + 70 + FCIRC_R; // circle center x

  // Helper — draws one test row with rect + polygon-circle
  function fillRow(label, color, opacity, bleed, dir, texture, border) {
    brush.noStroke();
    brush.fill(color, opacity);
    brush.fillBleed(bleed, dir);
    brush.fillTexture(texture, border);
    rowLabel(label);
    const ry = currentY + (FILL_ROW_H - FRECT_H) / 2;
    brush.rect(CONTENT_X, ry, FRECT_W, FRECT_H);
    // Polygon approximating a circle (~24 verts)
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

  // Sub-section label helper
  function fillSubHeader(text) {
    labelBuf.noStroke();
    labelBuf.fill(120);
    labelBuf.textSize(9);
    labelBuf.textStyle(ITALIC);
    labelBuf.text(text, MARGIN, currentY + 12);
    currentY += 18;
  }

  // -- Bleed strength (direction: out) --
  fillSubHeader("bleed strength  (texture 0.4, border 0.4, opacity 60)");
  fillRow("bleed 0.03  out", col(0), 60, 0.03, "out", 0.4, 0.4);
  fillRow("bleed 0.1   out", col(0), 60, 0.1,  "out", 0.4, 0.4);
  fillRow("bleed 0.25  out", col(0), 60, 0.25, "out", 0.4, 0.4);
  fillRow("bleed 0.5   out", col(0), 60, 0.5,  "out", 0.4, 0.4);

  // -- Bleed direction --
  fillSubHeader("bleed direction  (bleed 0.2, texture 0.4, border 0.4, opacity 60)");
  fillRow("direction: out",  col(1), 60, 0.2, "out", 0.4, 0.4);
  fillRow("direction: in",   col(1), 60, 0.2, "in",  0.4, 0.4);

  // -- Texture strength --
  fillSubHeader("texture strength  (bleed 0.1, border 0.4, opacity 60)");
  fillRow("texture 0.05", col(2), 60, 0.1, "out", 0.05, 0.4);
  fillRow("texture 0.3",  col(2), 60, 0.1, "out", 0.3,  0.4);
  fillRow("texture 0.7",  col(2), 60, 0.1, "out", 0.7,  0.4);
  fillRow("texture 1.0",  col(2), 60, 0.1, "out", 1.0,  0.4);

  // -- Border strength --
  fillSubHeader("border strength  (bleed 0.1, texture 0.4, opacity 60)");
  fillRow("border 0.05", col(3), 60, 0.1, "out", 0.4, 0.05);
  fillRow("border 0.3",  col(3), 60, 0.1, "out", 0.4, 0.3);
  fillRow("border 0.7",  col(3), 60, 0.1, "out", 0.4, 0.7);
  fillRow("border 1.0",  col(3), 60, 0.1, "out", 0.4, 1.0);

  // -- Opacity --
  fillSubHeader("opacity  (bleed 0.1, texture 0.4, border 0.4)");
  fillRow("opacity 20",  col(4), 20,  0.1, "out", 0.4, 0.4);
  fillRow("opacity 50",  col(4), 50,  0.1, "out", 0.4, 0.4);
  fillRow("opacity 90",  col(4), 90,  0.1, "out", 0.4, 0.4);
  fillRow("opacity 140", col(4), 140, 0.1, "out", 0.4, 0.4);

  // ---- Composite label overlay on top of brush rendering ----
  // (draw() runs after postsetup which composites the final brush pass)
}

// draw() runs after postsetup — ideal moment to overlay labels
function draw() {
  // WEBGL resets transforms each frame; re-translate to top-left
  translate(-width / 2, -height / 2);
  if (!nativeDebugStage) image(labelBuf, 0, 0, width, height);
  window.reportP5FirstFrame?.("visual_suite");
  noLoop(); // static sketch — draw only once
}
