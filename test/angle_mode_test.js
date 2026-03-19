const CANVAS_W = 1360;
const CANVAS_H = 1260;
const MARGIN = 36;
const LABEL_W = 190;
const PANEL_GAP = 18;
const ROW_H = 170;

const INK = "#183a59";
const ALT = "#21695f";
const REF = "#c74a3d";
const FRAME = "#cdbfae";
const PANEL_BG = "#fcf7ef";
const REF_ALPHA = 110;
const REF_WEIGHT = 0.9;
const REF_POINT = 3;

let currentY = MARGIN;
let labelBuf;

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

function projectPoint(x, y, angleDeg, length) {
  const rad = toRadians(angleDeg);
  return {
    x: x + length * Math.cos(rad),
    y: y - length * Math.sin(rad),
  };
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

function runPositionSequence(startX, startY, steps, moveRunner) {
  const pos = new brush.Position(startX + width / 2, startY + height / 2);
  const pts = [{ x: startX, y: startY }];

  moveRunner(pos, steps, pts);

  return pts;
}

function maxLineLengthInBox(x, y, angleDeg, bounds) {
  const rad = toRadians(angleDeg);
  const dx = Math.cos(rad);
  const dy = -Math.sin(rad);
  const candidates = [];

  if (dx > 0) candidates.push((bounds.maxX - x) / dx);
  else if (dx < 0) candidates.push((bounds.minX - x) / dx);

  if (dy > 0) candidates.push((bounds.maxY - y) / dy);
  else if (dy < 0) candidates.push((bounds.minY - y) / dy);

  const valid = candidates.filter((value) => Number.isFinite(value) && value >= 0);
  return valid.length ? Math.min(...valid) : 0;
}

function drawCenteredReferenceLine(bounds, angleDeg, padding = 10) {
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;
  const forward = Math.max(
    0,
    maxLineLengthInBox(cx, cy, angleDeg, bounds) - padding,
  );
  const backward = Math.max(
    0,
    maxLineLengthInBox(cx, cy, angleDeg + 180, bounds) - padding,
  );
  const start = projectPoint(cx, cy, angleDeg + 180, backward);
  const end = projectPoint(cx, cy, angleDeg, forward);

  push();
  stroke(199, 74, 61, REF_ALPHA);
  strokeWeight(REF_WEIGHT);
  line(start.x, start.y, end.x, end.y);
  noStroke();
  fill(199, 74, 61, REF_ALPHA);
  circle(start.x, start.y, REF_POINT);
  circle(end.x, end.y, REF_POINT);
  pop();
}

function section(title, note = "") {
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

    push();
    fill(PANEL_BG);
    stroke(FRAME);
    strokeWeight(1);
    rect(x, y, panelW, ROW_H - 8, 14);
    pop();

    labelBuf.noStroke();
    labelBuf.fill(255, 255, 255, 220);
    labelBuf.rect(x + 10, y + 10, panelW - 20, 20, 9);
    labelBuf.fill(74);
    labelBuf.textStyle(NORMAL);
    labelBuf.textSize(10);
    labelBuf.text(panel.title, x + 16, y + 24);

    panel.render(x + 14, y + 40, panelW - 28, ROW_H - 56);
  });

  currentY += ROW_H;
}

function drawReferenceLine(x, y, length, angleDeg) {
  const end = projectPoint(x, y, angleDeg, length);
  push();
  stroke(199, 74, 61, REF_ALPHA);
  strokeWeight(REF_WEIGHT);
  line(x, y, end.x, end.y);
  fill(199, 74, 61);
  noStroke();
  circle(x, y, REF_POINT);
  circle(end.x, end.y, REF_POINT);
  pop();
}

function drawReferencePolyline(x, y, steps, options = {}) {
  const {
    dashed = false,
    showPoints = true,
    alpha = REF_ALPHA,
    pointSize = REF_POINT,
    dash = 7,
    gap = 5,
  } = options;
  const points = buildPolyline(x, y, steps);

  push();
  stroke(199, 74, 61, alpha);
  strokeWeight(REF_WEIGHT);
  noFill();
  if (dashed) {
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const dx = p1.x - p0.x;
      const dy = p1.y - p0.y;
      const len = Math.hypot(dx, dy);
      if (len === 0) continue;
      const ux = dx / len;
      const uy = dy / len;
      for (let d = 0; d < len; d += dash + gap) {
        const from = d;
        const to = Math.min(d + dash, len);
        line(
          p0.x + ux * from,
          p0.y + uy * from,
          p0.x + ux * to,
          p0.y + uy * to,
        );
      }
    }
  } else {
    beginShape();
    for (const pt of points) vertex(pt.x, pt.y);
    endShape();
  }

  if (showPoints) {
    noStroke();
    fill(199, 74, 61, alpha);
    for (const pt of points) circle(pt.x, pt.y, pointSize);
  }
  pop();
}

function drawReferenceArc(cx, cy, radius, startDeg, endDeg) {
  const segments = 36;

  push();
  stroke(199, 74, 61, REF_ALPHA);
  strokeWeight(REF_WEIGHT);
  noFill();
  beginShape();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = startDeg + (endDeg - startDeg) * t;
    const pt = projectPoint(cx, cy, angle, radius);
    vertex(pt.x, pt.y);
  }
  endShape();
  pop();
}

function renderFlowLinePanel(x, y, w, h, mode, angleValue) {
  const angleDeg = 28;
  const startX = x + 16;
  const startY = y + h - 14;
  const len = Math.max(
    12,
    maxLineLengthInBox(startX, startY, angleDeg, {
      minX: x + 8,
      minY: y + 8,
      maxX: x + w - 8,
      maxY: y + h - 8,
    }) - 4,
  );

  drawReferenceLine(startX, startY, len, angleDeg);

  angleMode(mode);
  brush.noField();
  brush.set("pen", INK, 1.8);
  brush.flowLine(startX, startY, len, angleValue);
  angleMode(DEGREES);
}

function renderArcPanel(x, y, w, h, mode, startValue, endValue) {
  const cx = x + w / 2;
  const cy = y + h / 2 + 10;
  const radius = Math.min(w, h) * 0.3;

  drawReferenceArc(cx, cy, radius, 20, 145);

  angleMode(mode);
  brush.noField();
  brush.set("pen", ALT, 1.8);
  brush.arc(cx, cy, radius, startValue, endValue);
  angleMode(DEGREES);
}

function renderManualStrokePanel(x, y, w, h, runner) {
  const startX = x + 20;
  const startY = y + h - 16;
  const steps = [
    { angle: 24, length: 64, pressure: 1 },
    { angle: 112, length: 52, pressure: 0.9 },
    { angle: -18, length: 70, pressure: 1.05 },
  ];

  drawReferencePolyline(startX, startY, steps);

  brush.set("2B", INK, 1.7);
  runner(startX, startY, steps);
  angleMode(DEGREES);
}

function renderPositionPanel(x, y, w, h, runner) {
  const startX = x + 20;
  const startY = y + h - 16;
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
    dashed: true,
    showPoints: true,
    pointSize: 2.4,
    alpha: 105,
    dash: 4,
    gap: 9,
  });

  push();
  noStroke();
  fill(24, 58, 89);
  for (const pt of pts) circle(pt.x, pt.y, 4);
  pop();
}

function renderHatchPanel(x, y, w, h, setupHatch, referenceAngleDeg = 45) {
  const rx = x + 14;
  const ry = y + 10;
  const rw = w - 28;
  const rh = h - 20;
  const bounds = {
    minX: rx,
    minY: ry,
    maxX: rx + rw,
    maxY: ry + rh,
  };

  push();
  fill(245, 239, 228);
  stroke(214, 201, 186);
  strokeWeight(1);
  rect(rx, ry, rw, rh, 10);
  pop();

  drawCenteredReferenceLine(bounds, referenceAngleDeg);

  brush.noField();
  brush.noStroke();
  brush.noFill();
  brush.hatchStyle("pen", INK, 1.35);
  setupHatch();
  brush.rect(rx, ry, rw, rh, "corner");
  brush.noHatch();
  angleMode(DEGREES);
}

function renderFieldPanel(x, y, w, h, mode, fieldName) {
  const lines = 6;
  const startX = x + 16;
  const len = w - 32;

  angleMode(mode);
  brush.field(fieldName);
  brush.set("pen", ALT, 1.45);
  for (let i = 0; i < lines; i++) {
    const sy = y + 12 + (i / (lines - 1)) * (h - 24);
    brush.flowLine(startX, sy, len, 0);
  }
  brush.noField();
  angleMode(DEGREES);
}

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

  brush.addField("diagDegreesTest", (_t, field) => {
    for (let col = 0; col < field.length; col++) {
      for (let row = 0; row < field[col].length; row++) {
        field[col][row] = 32;
      }
    }
    return field;
  });

  brush.addField(
    "diagRadiansTest",
    (_t, field) => {
      for (let col = 0; col < field.length; col++) {
        for (let row = 0; row < field[col].length; row++) {
          field[col][row] = toRadians(32);
        }
      }
      return field;
    },
    { angleMode: "radians" },
  );
}

function draw() {
  background("#f4ede0");
  translate(-width / 2, -height / 2);

  section(
    "DIRECT ANGLE ARGUMENTS",
    "Matching panels here mean the public function interprets degrees and radians equivalently under the current angleMode().",
  );

  drawRow("flowLine(dir)", [
    {
      title: "angleMode(DEGREES) + 28",
      render: (x, y, w, h) => renderFlowLinePanel(x, y, w, h, DEGREES, 28),
    },
    {
      title: "angleMode(RADIANS) + PI / 180 * 28",
      render: (x, y, w, h) => renderFlowLinePanel(x, y, w, h, RADIANS, toRadians(28)),
    },
  ]);

  drawRow("arc(start, end)", [
    {
      title: "DEGREES input",
      render: (x, y, w, h) => renderArcPanel(x, y, w, h, DEGREES, 20, 145),
    },
    {
      title: "RADIANS input",
      render: (x, y, w, h) => renderArcPanel(x, y, w, h, RADIANS, toRadians(20), toRadians(145)),
    },
  ]);

  drawRow("beginStroke / move / endStroke", [
    {
      title: "all degrees",
      render: (x, y, w, h) =>
        renderManualStrokePanel(x, y, w, h, (startX, startY, steps) => {
          angleMode(DEGREES);
          brush.beginStroke("segments", startX, startY);
          for (const step of steps) brush.move(step.angle, step.length, step.pressure);
          brush.endStroke(steps[steps.length - 1].angle, 1);
        }),
    },
    {
      title: "all radians",
      render: (x, y, w, h) =>
        renderManualStrokePanel(x, y, w, h, (startX, startY, steps) => {
          angleMode(RADIANS);
          brush.beginStroke("segments", startX, startY);
          for (const step of steps)
            brush.move(toRadians(step.angle), step.length, step.pressure);
          brush.endStroke(toRadians(steps[steps.length - 1].angle), 1);
        }),
    },
    {
      title: "mixed angleMode() per call",
      render: (x, y, w, h) =>
        renderManualStrokePanel(x, y, w, h, (startX, startY, steps) => {
          brush.beginStroke("segments", startX, startY);
          angleMode(DEGREES);
          brush.move(steps[0].angle, steps[0].length, steps[0].pressure);
          angleMode(RADIANS);
          brush.move(toRadians(steps[1].angle), steps[1].length, steps[1].pressure);
          angleMode(DEGREES);
          brush.move(steps[2].angle, steps[2].length, steps[2].pressure);
          angleMode(RADIANS);
          brush.endStroke(toRadians(steps[steps.length - 1].angle), 1);
        }),
    },
  ]);

  drawRow("Position.moveTo(dir, length, step)", [
    {
      title: "all degrees",
      render: (x, y, w, h) =>
        renderPositionPanel(x, y, w, h, (startX, startY, steps) => {
          return runPositionSequence(startX, startY, steps, (pos, steps, pts) => {
            angleMode(DEGREES);
            for (const step of steps) {
              pos.moveTo(step.angle, step.length, step.length);
              pts.push({ x: pos.x - width / 2, y: pos.y - height / 2 });
            }
          });
        }),
    },
    {
      title: "all radians",
      render: (x, y, w, h) =>
        renderPositionPanel(x, y, w, h, (startX, startY, steps) => {
          return runPositionSequence(startX, startY, steps, (pos, steps, pts) => {
            angleMode(RADIANS);
            for (const step of steps) {
              pos.moveTo(toRadians(step.angle), step.length, step.length);
              pts.push({ x: pos.x - width / 2, y: pos.y - height / 2 });
            }
          });
        }),
    },
    {
      title: "mixed angleMode() per segment",
      render: (x, y, w, h) =>
        renderPositionPanel(x, y, w, h, (startX, startY, steps) => {
          return runPositionSequence(startX, startY, steps, (pos, steps, pts) => {
            angleMode(DEGREES);
            pos.moveTo(steps[0].angle, steps[0].length, steps[0].length);
            pts.push({ x: pos.x - width / 2, y: pos.y - height / 2 });

            angleMode(RADIANS);
            pos.moveTo(toRadians(steps[1].angle), steps[1].length, steps[1].length);
            pts.push({ x: pos.x - width / 2, y: pos.y - height / 2 });

            angleMode(DEGREES);
            pos.moveTo(steps[2].angle, steps[2].length, steps[2].length);
            pts.push({ x: pos.x - width / 2, y: pos.y - height / 2 });
          });
        }),
    },
  ]);

  section(
    "STORED AND CUSTOM ANGLE STATE",
    "These rows check the places where angles are stored and used later, or where custom generators provide their own angle convention.",
  );

  drawRow("hatch(angle)", [
    {
      title: "set in degrees, draw in degrees",
      render: (x, y, w, h) =>
        renderHatchPanel(x, y, w, h, () => {
          angleMode(DEGREES);
          brush.hatch(10, 45, { rand: 0 });
        }, 45),
    },
    {
      title: "set in radians, draw in radians",
      render: (x, y, w, h) =>
        renderHatchPanel(x, y, w, h, () => {
          angleMode(RADIANS);
          brush.hatch(10, toRadians(45), { rand: 0 });
        }, 45),
    },
    {
      title: "set in degrees, switch to radians, then draw",
      render: (x, y, w, h) =>
        renderHatchPanel(x, y, w, h, () => {
          angleMode(DEGREES);
          brush.hatch(10, 45, { rand: 0 });
          angleMode(RADIANS);
        }, 45),
    },
  ]);

  drawRow("addField(name, fn, { angleMode })", [
    {
      title: "generator writes degrees",
      render: (x, y, w, h) => renderFieldPanel(x, y, w, h, DEGREES, "diagDegreesTest"),
    },
    {
      title: "generator writes radians",
      render: (x, y, w, h) => renderFieldPanel(x, y, w, h, RADIANS, "diagRadiansTest"),
    },
    {
      title: "degree field while global mode is radians",
      render: (x, y, w, h) => renderFieldPanel(x, y, w, h, RADIANS, "diagDegreesTest"),
    },
  ]);

  image(labelBuf, 0, 0);
}
