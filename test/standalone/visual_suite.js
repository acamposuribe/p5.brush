import * as brush from "../../dist/brush.esm.js";

const CANVAS_W = 1240;
const CANVAS_H = 3200;
const MARGIN = 50;
const LABEL_W = 175;
const ROW_H = 56;
const CONTENT_X = MARGIN + LABEL_W;
const CONTENT_W = CANVAS_W - MARGIN - LABEL_W - 40;

let currentY = MARGIN;

const palette = ["#002185", "#c0392b", "#27ae60", "#8e44ad", "#e67e22"];
const col = (i) => palette[i % palette.length];

const pixelDensity = globalThis.devicePixelRatio || 1;

brush.createCanvas(CANVAS_W, CANVAS_H, {
  id: "brush-canvas",
  parent: "#canvas-host",
  pixelDensity,
});

const labelCanvas = document.createElement("canvas");
labelCanvas.id = "label-canvas";
labelCanvas.width = Math.round(CANVAS_W * pixelDensity);
labelCanvas.height = Math.round(CANVAS_H * pixelDensity);
labelCanvas.style.width = `${CANVAS_W}px`;
labelCanvas.style.height = `${CANVAS_H}px`;
document.getElementById("canvas-host").appendChild(labelCanvas);
const labelCtx = labelCanvas.getContext("2d");
labelCtx.setTransform(pixelDensity, 0, 0, pixelDensity, 0, 0);

function header(title) {
  labelCtx.fillStyle = "#111111";
  labelCtx.font = "700 12px Menlo, Monaco, monospace";
  labelCtx.fillText(title, MARGIN, currentY + 15);
  labelCtx.strokeStyle = "#b4b4b4";
  labelCtx.lineWidth = 0.7;
  labelCtx.beginPath();
  labelCtx.moveTo(MARGIN, currentY + 20);
  labelCtx.lineTo(CANVAS_W - MARGIN, currentY + 20);
  labelCtx.stroke();
  currentY += 30;
}

function rowLabel(text) {
  labelCtx.fillStyle = "#f5f5f5";
  labelCtx.fillRect(MARGIN - 2, currentY + 2, LABEL_W - 3, ROW_H - 4);
  labelCtx.fillStyle = "#464646";
  labelCtx.font = "10px Menlo, Monaco, monospace";
  labelCtx.fillText(text, MARGIN, currentY + ROW_H / 2);
}

function nextRow() {
  currentY += ROW_H;
}

function gap(px = 12) {
  currentY += px;
}

async function main() {
  brush.scaleBrushes(5);
  brush.angleMode(brush.DEGREES);
  brush.seed(42);
  brush.noiseSeed(42);
  brush.clear("#f5f5f5");

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
    tip: (m) => {
      m.rotate(45);
      m.rect(-4, -4, 8, 8);
      m.rect(1, 1, 2, 2);
    },
  });

  brush.push();
  brush.translate(-CANVAS_W / 2, -CANVAS_H / 2);

  header("STANDARD BRUSHES");
  const customNames = new Set(["imageTip", "diamondTip", "_pt"]);
  for (const name of brush.box().filter((n) => !customNames.has(n))) {
    brush.set(name, col(brush.box().indexOf(name)), 1);
    rowLabel(name);
    brush.flowLine(CONTENT_X, currentY + ROW_H / 2, CONTENT_W, 0);
    nextRow();
  }
  gap();

  header("BRUSH TYPES");
  const typeTests = [
    { label: "custom tip (diamondTip)", name: "diamondTip", color: col(0) },
    { label: "image tip (imageTip)", name: "imageTip", color: col(1) },
    { label: "marker", name: "marker", color: col(2) },
    { label: "spray", name: "spray", color: col(3) },
  ];
  for (const test of typeTests) {
    brush.set(test.name, test.color, 1);
    rowLabel(test.label);
    brush.flowLine(CONTENT_X, currentY + ROW_H / 2, CONTENT_W, 0);
    nextRow();
  }
  gap();

  header("FLOW FIELDS");
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
      const lineColor = col(fi + side);

      if (name === "hand") {
        brush.wiggle(5);
      } else {
        brush.field(name);
      }
      brush.set("HB", lineColor, 1);

      for (let li = 0; li < FIELD_LINES; li++) {
        const ly = cellY + 22 + (li / (FIELD_LINES - 1)) * (FIELD_CELL_H - 32);
        brush.flowLine(cellX, ly, FIELD_CELL_W, 0);
      }

      labelCtx.fillStyle = "#f5f5f5";
      labelCtx.fillRect(cellX, cellY, 140, 18);
      labelCtx.fillStyle = "#1e1e1e";
      labelCtx.font = "700 10px Menlo, Monaco, monospace";
      labelCtx.fillText(name === "hand" ? "hand [wiggle(5)]" : name, cellX + 4, cellY + 13);
    }
    currentY += FIELD_CELL_H + 8;
  }
  brush.noField();
  gap();

  header("PRIMITIVES");
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
  brush.spline([
    [CONTENT_X, currentY + ROW_H - 10, 1],
    [CONTENT_X + 110, currentY + 10, 1],
    [CONTENT_X + 220, currentY + ROW_H - 10, 1],
    [CONTENT_X + 330, currentY + 10, 1],
    [CONTENT_X + 440, currentY + ROW_H - 10, 1],
  ], 0.5);
  nextRow();

  brush.set("pen", col(2), 1);
  rowLabel("polygon()");
  const px = CONTENT_X + 70;
  const py = currentY + ROW_H / 2;
  const pr = 22;
  brush.polygon([
    [px + pr * Math.cos(0), py + pr * Math.sin(0), 1],
    [px + pr * Math.cos((72 * Math.PI) / 180), py + pr * Math.sin((72 * Math.PI) / 180), 1],
    [px + pr * Math.cos((144 * Math.PI) / 180), py + pr * Math.sin((144 * Math.PI) / 180), 1],
    [px + pr * Math.cos((216 * Math.PI) / 180), py + pr * Math.sin((216 * Math.PI) / 180), 1],
    [px + pr * Math.cos((288 * Math.PI) / 180), py + pr * Math.sin((288 * Math.PI) / 180), 1],
  ]);
  nextRow();
  gap();

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
  brush.vertex(CONTENT_X + 40, currentY + ROW_H - 8);
  brush.vertex(CONTENT_X + 90, currentY + 8);
  brush.vertex(CONTENT_X + 140, currentY + ROW_H - 8);
  brush.vertex(CONTENT_X + 190, currentY + 8);
  brush.vertex(CONTENT_X + 240, currentY + ROW_H - 8);
  brush.endShape(true);
  nextRow();
  gap();

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

  header("HATCH / WASH / MASS");
  brush.hatch(9, 45);
  brush.hatchStyle("HB", col(0), 1);
  rowLabel("hatch");
  new brush.Polygon([
    [CONTENT_X, currentY + 5],
    [CONTENT_X + 260, currentY + 5],
    [CONTENT_X + 260, currentY + ROW_H - 6],
    [CONTENT_X, currentY + ROW_H - 6],
  ]).hatch();
  brush.noHatch();
  nextRow();

  brush.wash("#fffceb", 255);
  rowLabel("wash");
  brush.rect(CONTENT_X, currentY + 6, 260, ROW_H - 14);
  brush.noWash();
  nextRow();

  brush.mass("pastel", col(2), { precision: 0.5, strength: 0.7, outline: true });
  rowLabel("mass");
  brush.rect(CONTENT_X, currentY + 6, 260, ROW_H - 14);
  brush.noMass();
  nextRow();
  gap();

  header("FILL");
  brush.noStroke();
  brush.fill(col(4), 90);
  brush.fillBleed(0.1, "out");
  brush.fillTexture(0.4, 0.4);
  rowLabel("rect + polygon");
  brush.rect(CONTENT_X, currentY + 10, 220, 90);
  const cx = CONTENT_X + 330;
  const cy = currentY + 56;
  const n = 24;
  const r = 45;
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  brush.polygon(pts);
  brush.noFill();
  currentY += 115;

  brush.pop();
  brush.render();
}

main();
