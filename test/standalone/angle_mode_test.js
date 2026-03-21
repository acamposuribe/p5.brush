// ============================================================
// p5.brush Standalone Angle Mode Test
//
// Standalone equivalent of test/angle_mode_test.html.
// Reference geometry is drawn on a 2D label canvas overlay;
// brush strokes are drawn on the brush (WebGL) canvas.
// ============================================================

import * as brush from "../../dist/brush.esm.js";

const CANVAS_W = 1360;
const CANVAS_H = 1260;
const MARGIN = 36;
const LABEL_W = 190;
const PANEL_GAP = 18;
const ROW_H = 170;

const INK = "#183a59";
const ALT = "#21695f";
const FRAME = "#cdbfae";
const PANEL_BG = "#fcf7ef";
const REF_ALPHA = 110 / 255;
const REF_WEIGHT = 0.9;
const REF_POINT = 3;

// ---- Canvas setup ----

const pixelDensity = window.devicePixelRatio || 1;
brush.createCanvas(CANVAS_W, CANVAS_H, {
  id: "brush-canvas",
  parent: "#canvas-host",
  pixelDensity,
});

const labelCanvas = document.createElement("canvas");
labelCanvas.id = "label-canvas";
labelCanvas.width  = Math.round(CANVAS_W * pixelDensity);
labelCanvas.height = Math.round(CANVAS_H * pixelDensity);
labelCanvas.style.width  = CANVAS_W + "px";
labelCanvas.style.height = CANVAS_H + "px";
document.getElementById("canvas-host").appendChild(labelCanvas);

const lc = labelCanvas.getContext("2d");
lc.setTransform(pixelDensity, 0, 0, pixelDensity, 0, 0);
lc.textBaseline = "top";

let currentY = MARGIN;

// ---- Geometry helpers ----

function toRadians(deg) { return (deg * Math.PI) / 180; }

function projectPoint(x, y, angleDeg, length) {
  const rad = toRadians(angleDeg);
  return { x: x + length * Math.cos(rad), y: y - length * Math.sin(rad) };
}

function buildPolyline(x, y, steps) {
  const points = [{ x, y }];
  let cursor = { x, y };
  for (const step of steps) {
    cursor = projectPoint(cursor.x, cursor.y, step.angle, step.length);
    points.push(cursor);
  }
  return points;
}

function maxLineLengthInBox(x, y, angleDeg, bounds) {
  const rad = toRadians(angleDeg);
  const dx = Math.cos(rad), dy = -Math.sin(rad);
  const candidates = [];
  if (dx > 0) candidates.push((bounds.maxX - x) / dx);
  else if (dx < 0) candidates.push((bounds.minX - x) / dx);
  if (dy > 0) candidates.push((bounds.maxY - y) / dy);
  else if (dy < 0) candidates.push((bounds.minY - y) / dy);
  const valid = candidates.filter((v) => Number.isFinite(v) && v >= 0);
  return valid.length ? Math.min(...valid) : 0;
}

// ---- Reference drawing helpers (on label canvas 2D) ----

function refLine(x1, y1, x2, y2) {
  lc.strokeStyle = `rgba(199,74,61,${REF_ALPHA})`;
  lc.lineWidth = REF_WEIGHT;
  lc.beginPath();
  lc.moveTo(x1, y1);
  lc.lineTo(x2, y2);
  lc.stroke();
}

function refDot(x, y) {
  lc.fillStyle = `rgba(199,74,61,${REF_ALPHA})`;
  lc.beginPath();
  lc.arc(x, y, REF_POINT / 2, 0, Math.PI * 2);
  lc.fill();
}

function drawCenteredReferenceLine(bounds, angleDeg, padding = 10) {
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const forward  = Math.max(0, maxLineLengthInBox(cx, cy, angleDeg, bounds) - padding);
  const backward = Math.max(0, maxLineLengthInBox(cx, cy, angleDeg + 180, bounds) - padding);
  const start = projectPoint(cx, cy, angleDeg + 180, backward);
  const end   = projectPoint(cx, cy, angleDeg, forward);
  refLine(start.x, start.y, end.x, end.y);
  refDot(start.x, start.y);
  refDot(end.x, end.y);
}

function drawReferenceLine(x, y, length, angleDeg) {
  const end = projectPoint(x, y, angleDeg, length);
  refLine(x, y, end.x, end.y);
  refDot(x, y);
  refDot(end.x, end.y);
}

function drawReferencePolyline(x, y, steps, options = {}) {
  const { dashed = false, showPoints = true, alpha = REF_ALPHA, pointSize = REF_POINT, dash = 7, gap = 5 } = options;
  const points = buildPolyline(x, y, steps);

  lc.strokeStyle = `rgba(199,74,61,${alpha})`;
  lc.lineWidth = REF_WEIGHT;

  if (dashed) {
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i], p1 = points[i + 1];
      const dx = p1.x - p0.x, dy = p1.y - p0.y;
      const len = Math.hypot(dx, dy);
      if (!len) continue;
      const ux = dx / len, uy = dy / len;
      lc.beginPath();
      for (let d = 0; d < len; d += dash + gap) {
        const to = Math.min(d + dash, len);
        lc.moveTo(p0.x + ux * d, p0.y + uy * d);
        lc.lineTo(p0.x + ux * to, p0.y + uy * to);
      }
      lc.stroke();
    }
  } else {
    lc.beginPath();
    points.forEach((pt, i) => i === 0 ? lc.moveTo(pt.x, pt.y) : lc.lineTo(pt.x, pt.y));
    lc.stroke();
  }

  if (showPoints) {
    lc.fillStyle = `rgba(199,74,61,${alpha})`;
    for (const pt of points) {
      lc.beginPath();
      lc.arc(pt.x, pt.y, pointSize / 2, 0, Math.PI * 2);
      lc.fill();
    }
  }
}

function drawReferenceArc(cx, cy, radius, startDeg, endDeg) {
  lc.strokeStyle = `rgba(199,74,61,${REF_ALPHA})`;
  lc.lineWidth = REF_WEIGHT;
  lc.beginPath();
  for (let i = 0; i <= 36; i++) {
    const t = i / 36;
    const angle = startDeg + (endDeg - startDeg) * t;
    const pt = projectPoint(cx, cy, angle, radius);
    i === 0 ? lc.moveTo(pt.x, pt.y) : lc.lineTo(pt.x, pt.y);
  }
  lc.stroke();
}

// ---- Layout helpers ----

function lcRoundRect(x, y, w, h, r) {
  lc.beginPath();
  lc.moveTo(x + r, y); lc.lineTo(x + w - r, y);
  lc.arcTo(x + w, y, x + w, y + r, r); lc.lineTo(x + w, y + h - r);
  lc.arcTo(x + w, y + h, x + w - r, y + h, r); lc.lineTo(x + r, y + h);
  lc.arcTo(x, y + h, x, y + h - r, r); lc.lineTo(x, y + r);
  lc.arcTo(x, y, x + r, y, r); lc.closePath();
}

function section(title, note = "") {
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

function drawRow(label, panels) {
  const available = CANVAS_W - 2 * MARGIN - LABEL_W;
  const panelW = (available - PANEL_GAP * (panels.length - 1)) / panels.length;

  lc.fillStyle = "rgba(251,247,239,0.94)";
  lcRoundRect(MARGIN - 2, currentY + 6, LABEL_W - 10, ROW_H - 18, 10);
  lc.fill();
  lc.fillStyle = "#2e2e2e";
  lc.font = "bold 11px monospace";
  lc.fillText(label, MARGIN, currentY + 18);

  panels.forEach((panel, index) => {
    const x = MARGIN + LABEL_W + index * (panelW + PANEL_GAP);
    const y = currentY;

    // Panel background via brush.wash
    brush.wash(PANEL_BG, 255);
    new brush.Polygon([[x, y], [x + panelW, y], [x + panelW, y + ROW_H - 8], [x, y + ROW_H - 8]]).wash();
    brush.noWash();

    // Panel frame + title on label canvas
    lc.strokeStyle = FRAME;
    lc.lineWidth = 1;
    lcRoundRect(x, y, panelW, ROW_H - 8, 14);
    lc.stroke();

    lc.fillStyle = "rgba(255,255,255,0.86)";
    lcRoundRect(x + 10, y + 10, panelW - 20, 20, 9);
    lc.fill();
    lc.fillStyle = "#4a4a4a";
    lc.font = "10px monospace";
    lc.fillText(panel.title, x + 16, y + 15);

    panel.render(x + 14, y + 40, panelW - 28, ROW_H - 56);
  });

  currentY += ROW_H;
}

// ---- Panel renderers ----

function renderFlowLinePanel(x, y, w, h, mode, angleValue) {
  const angleDeg = 28;
  const startX = x + 16, startY = y + h - 14;
  const len = Math.max(12, maxLineLengthInBox(startX, startY, angleDeg, {
    minX: x + 8, minY: y + 8, maxX: x + w - 8, maxY: y + h - 8,
  }) - 4);

  drawReferenceLine(startX, startY, len, angleDeg);

  brush.angleMode(mode);
  brush.noField();
  brush.set("pen", INK, 1.8);
  brush.flowLine(startX, startY, len, angleValue);
  brush.angleMode(brush.DEGREES);
}

function renderArcPanel(x, y, w, h, mode, startValue, endValue) {
  const cx = x + w / 2, cy = y + h / 2 + 10;
  const radius = Math.min(w, h) * 0.3;

  drawReferenceArc(cx, cy, radius, 20, 145);

  brush.angleMode(mode);
  brush.noField();
  brush.set("pen", ALT, 1.8);
  brush.arc(cx, cy, radius, startValue, endValue);
  brush.angleMode(brush.DEGREES);
}

function renderManualStrokePanel(x, y, w, h, runner) {
  const startX = x + 20, startY = y + h - 16;
  const steps = [
    { angle: 24, length: 64, pressure: 1 },
    { angle: 112, length: 52, pressure: 0.9 },
    { angle: -18, length: 70, pressure: 1.05 },
  ];
  drawReferencePolyline(startX, startY, steps);
  brush.set("2B", INK, 1.7);
  runner(startX, startY, steps);
  brush.angleMode(brush.DEGREES);
}

function renderPositionPanel(x, y, w, h, runner) {
  const startX = x + 20, startY = y + h - 16;
  const steps = [
    { angle: 18, length: 58 },
    { angle: 104, length: 50 },
    { angle: -24, length: 68 },
  ];

  brush.noField();
  const pts = runner(startX, startY, steps);

  brush.set("marker", INK, 1.05);
  for (let i = 0; i < pts.length - 1; i++) {
    brush.line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
  }

  drawReferencePolyline(startX, startY, steps, {
    dashed: true, showPoints: true, pointSize: 2.4, alpha: REF_ALPHA, dash: 4, gap: 9,
  });

  // Draw brush position dots on label canvas
  lc.fillStyle = "rgb(24,58,89)";
  for (const pt of pts) {
    lc.beginPath();
    lc.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
    lc.fill();
  }
}

function renderHatchPanel(x, y, w, h, setupHatch, referenceAngleDeg = 45) {
  const rx = x + 14, ry = y + 10;
  const rw = w - 28, rh = h - 20;
  const bounds = { minX: rx, minY: ry, maxX: rx + rw, maxY: ry + rh };

  // Background and frame on label canvas (below hatch via wash)
  brush.wash("#f5efe5", 255);
  new brush.Polygon([[rx, ry], [rx + rw, ry], [rx + rw, ry + rh], [rx, ry + rh]]).wash();
  brush.noWash();

  lc.strokeStyle = "#d6c9ba";
  lc.lineWidth = 1;
  lc.strokeRect(rx, ry, rw, rh);

  drawCenteredReferenceLine(bounds, referenceAngleDeg);

  brush.noField();
  brush.noStroke();
  brush.noFill();
  brush.hatchStyle("pen", INK, 1.35);
  setupHatch();
  brush.rect(rx, ry, rw, rh, "corner");
  brush.noHatch();
  brush.angleMode(brush.DEGREES);
}

function renderFieldPanel(x, y, w, h, mode, fieldName) {
  const lines = 6, startX = x + 16, len = w - 32;
  brush.angleMode(mode);
  brush.field(fieldName);
  brush.set("pen", ALT, 1.45);
  for (let i = 0; i < lines; i++) {
    const sy = y + 12 + (i / (lines - 1)) * (h - 24);
    brush.flowLine(startX, sy, len, 0);
  }
  brush.noField();
  brush.angleMode(brush.DEGREES);
}

function runPositionSequence(startX, startY, steps, moveRunner) {
  const pos = new brush.Position(startX + CANVAS_W / 2, startY + CANVAS_H / 2);
  const pts = [{ x: startX, y: startY }];
  moveRunner(pos, steps, pts);
  return pts;
}

// ================================================================
// Draw
// ================================================================

brush.seed(42);
brush.noiseSeed(42);
brush.scaleBrushes(2.4);
brush.angleMode(brush.DEGREES);
brush.clear("#f4ede0");
brush.push();
brush.translate(-CANVAS_W / 2, -CANVAS_H / 2);

brush.addField("diagDegreesTest", (_t, field) => {
  for (let col = 0; col < field.length; col++)
    for (let row = 0; row < field[col].length; row++)
      field[col][row] = 32;
  return field;
});

brush.addField("diagRadiansTest", (_t, field) => {
  for (let col = 0; col < field.length; col++)
    for (let row = 0; row < field[col].length; row++)
      field[col][row] = toRadians(32);
  return field;
}, { angleMode: "radians" });

// ---- DIRECT ANGLE ARGUMENTS ----

section(
  "DIRECT ANGLE ARGUMENTS",
  "Matching panels mean the function interprets degrees and radians equivalently under the current angleMode().",
);

drawRow("flowLine(dir)", [
  {
    title: "angleMode(DEGREES) + 28",
    render: (x, y, w, h) => renderFlowLinePanel(x, y, w, h, brush.DEGREES, 28),
  },
  {
    title: "angleMode(RADIANS) + PI/180*28",
    render: (x, y, w, h) => renderFlowLinePanel(x, y, w, h, brush.RADIANS, toRadians(28)),
  },
]);

drawRow("arc(start, end)", [
  {
    title: "DEGREES input",
    render: (x, y, w, h) => renderArcPanel(x, y, w, h, brush.DEGREES, 20, 145),
  },
  {
    title: "RADIANS input",
    render: (x, y, w, h) => renderArcPanel(x, y, w, h, brush.RADIANS, toRadians(20), toRadians(145)),
  },
]);

drawRow("beginStroke / move / endStroke", [
  {
    title: "all degrees",
    render: (x, y, w, h) => renderManualStrokePanel(x, y, w, h, (sx, sy, steps) => {
      brush.angleMode(brush.DEGREES);
      brush.beginStroke("segments", sx, sy);
      for (const s of steps) brush.move(s.angle, s.length, s.pressure);
      brush.endStroke(steps[steps.length - 1].angle, 1);
    }),
  },
  {
    title: "all radians",
    render: (x, y, w, h) => renderManualStrokePanel(x, y, w, h, (sx, sy, steps) => {
      brush.angleMode(brush.RADIANS);
      brush.beginStroke("segments", sx, sy);
      for (const s of steps) brush.move(toRadians(s.angle), s.length, s.pressure);
      brush.endStroke(toRadians(steps[steps.length - 1].angle), 1);
    }),
  },
  {
    title: "mixed angleMode() per call",
    render: (x, y, w, h) => renderManualStrokePanel(x, y, w, h, (sx, sy, steps) => {
      brush.beginStroke("segments", sx, sy);
      brush.angleMode(brush.DEGREES);  brush.move(steps[0].angle, steps[0].length, steps[0].pressure);
      brush.angleMode(brush.RADIANS);  brush.move(toRadians(steps[1].angle), steps[1].length, steps[1].pressure);
      brush.angleMode(brush.DEGREES);  brush.move(steps[2].angle, steps[2].length, steps[2].pressure);
      brush.angleMode(brush.RADIANS);  brush.endStroke(toRadians(steps[steps.length - 1].angle), 1);
    }),
  },
]);

drawRow("Position.moveTo(dir, length, step)", [
  {
    title: "all degrees",
    render: (x, y, w, h) => renderPositionPanel(x, y, w, h, (sx, sy, steps) =>
      runPositionSequence(sx, sy, steps, (pos, steps, pts) => {
        brush.angleMode(brush.DEGREES);
        for (const s of steps) {
          pos.moveTo(s.angle, s.length, s.length);
          pts.push({ x: pos.x - CANVAS_W / 2, y: pos.y - CANVAS_H / 2 });
        }
      })),
  },
  {
    title: "all radians",
    render: (x, y, w, h) => renderPositionPanel(x, y, w, h, (sx, sy, steps) =>
      runPositionSequence(sx, sy, steps, (pos, steps, pts) => {
        brush.angleMode(brush.RADIANS);
        for (const s of steps) {
          pos.moveTo(toRadians(s.angle), s.length, s.length);
          pts.push({ x: pos.x - CANVAS_W / 2, y: pos.y - CANVAS_H / 2 });
        }
      })),
  },
  {
    title: "mixed angleMode() per segment",
    render: (x, y, w, h) => renderPositionPanel(x, y, w, h, (sx, sy, steps) =>
      runPositionSequence(sx, sy, steps, (pos, steps, pts) => {
        brush.angleMode(brush.DEGREES);
        pos.moveTo(steps[0].angle, steps[0].length, steps[0].length);
        pts.push({ x: pos.x - CANVAS_W / 2, y: pos.y - CANVAS_H / 2 });
        brush.angleMode(brush.RADIANS);
        pos.moveTo(toRadians(steps[1].angle), steps[1].length, steps[1].length);
        pts.push({ x: pos.x - CANVAS_W / 2, y: pos.y - CANVAS_H / 2 });
        brush.angleMode(brush.DEGREES);
        pos.moveTo(steps[2].angle, steps[2].length, steps[2].length);
        pts.push({ x: pos.x - CANVAS_W / 2, y: pos.y - CANVAS_H / 2 });
      })),
  },
]);

// ---- STORED AND CUSTOM ANGLE STATE ----

section(
  "STORED AND CUSTOM ANGLE STATE",
  "These rows check places where angles are stored and used later, or where custom generators provide their own angle convention.",
);

drawRow("hatch(angle)", [
  {
    title: "set in degrees, draw in degrees",
    render: (x, y, w, h) => renderHatchPanel(x, y, w, h, () => {
      brush.angleMode(brush.DEGREES);
      brush.hatch(10, 45, { rand: 0 });
    }, 45),
  },
  {
    title: "set in radians, draw in radians",
    render: (x, y, w, h) => renderHatchPanel(x, y, w, h, () => {
      brush.angleMode(brush.RADIANS);
      brush.hatch(10, toRadians(45), { rand: 0 });
    }, 45),
  },
  {
    title: "set degrees, switch to radians, then draw",
    render: (x, y, w, h) => renderHatchPanel(x, y, w, h, () => {
      brush.angleMode(brush.DEGREES);
      brush.hatch(10, 45, { rand: 0 });
      brush.angleMode(brush.RADIANS);
    }, 45),
  },
]);

drawRow("addField(name, fn, { angleMode })", [
  {
    title: "generator writes degrees",
    render: (x, y, w, h) => renderFieldPanel(x, y, w, h, brush.DEGREES, "diagDegreesTest"),
  },
  {
    title: "generator writes radians",
    render: (x, y, w, h) => renderFieldPanel(x, y, w, h, brush.RADIANS, "diagRadiansTest"),
  },
  {
    title: "degree field while global mode is radians",
    render: (x, y, w, h) => renderFieldPanel(x, y, w, h, brush.RADIANS, "diagDegreesTest"),
  },
]);

brush.pop();
brush.render();
window.reportStandaloneFirstFrame?.("angle_mode_test");
console.log("Standalone angle mode test complete");
