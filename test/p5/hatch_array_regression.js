const PAPER = "#fffceb";
const INK = "#183a59";
const GUIDE = "#b8ac99";
const CANVAS_SIZE = 720;
const CIRCLE_STEPS = 120;

const state = {
  mode: "hatch",
};

const controls = {
  modeLabel: document.getElementById("mode-label"),
  hatch: document.getElementById("mode-hatch"),
  mass: document.getElementById("mode-mass"),
};

function makeCirclePolygon(cx, cy, radius, steps = CIRCLE_STEPS) {
  const verts = [];
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * Math.PI * 2;
    verts.push([cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius]);
  }
  return new brush.Polygon(verts);
}

function drawGuides(cx, cy, outerRadius, innerRadius) {
  push();
  noFill();
  stroke(GUIDE);
  strokeWeight(1);
  circle(cx, cy, outerRadius * 2);
  circle(cx, cy, innerRadius * 2);
  pop();
}

function syncModeControls() {
  controls.modeLabel.textContent = state.mode === "mass" ? "Mass" : "Hatch";
  controls.hatch.classList.toggle("active", state.mode === "hatch");
  controls.mass.classList.toggle("active", state.mode === "mass");
}

function queueRender(mode) {
  state.mode = mode;
  syncModeControls();
  redraw();
}

function renderArray(outer, inner) {
  if (state.mode === "mass") {
    brush.mass("HB", INK, {
      precision: 0.95,
      strength: 2,
      gradient: 0,
      outline: false,
    });
    brush.massArray([outer, inner]);
    brush.noMass();
    return;
  }

  brush.hatch(10, 45, { rand: 0, continuous: false, gradient: false });
  brush.hatchStyle("HB", INK, 1.1);
  brush.hatchArray([outer, inner]);
  brush.noHatch();
}

function setup() {
  const canvas = createCanvas(CANVAS_SIZE, CANVAS_SIZE, WEBGL);
  canvas.parent("canvas-host");
  brush.load();
  brush.scaleBrushes(2.8);
  angleMode(DEGREES);
  noLoop();
  syncModeControls();

  controls.hatch.addEventListener("click", () => queueRender("hatch"));
  controls.mass.addEventListener("click", () => queueRender("mass"));
}

function draw() {
  randomSeed(7);
  noiseSeed(7);
  background(PAPER);
  translate(-width / 2, -height / 2);

  const cx = width * 0.5;
  const cy = height * 0.54;
  const outerRadius = 180;
  const innerRadius = 92;
  const outer = makeCirclePolygon(cx, cy, outerRadius);
  const inner = makeCirclePolygon(cx, cy, innerRadius);

  drawGuides(cx, cy, outerRadius, innerRadius);

  brush.noField();
  brush.noStroke();
  brush.noFill();
  renderArray(outer, inner);

  push();
  noStroke();
  fill(24, 58, 89);
  textAlign(CENTER, CENTER);
  textSize(16);
  text(state.mode === "mass" ? "Expected: massed ring only" : "Expected: hatched ring only", cx, 52);
  textSize(13);
  fill(82, 97, 110);
  text(state.mode === "mass" ? "Single-pass mass test; center hole should remain clear" : "Center hole should remain clear", cx, 74);
  pop();

  window.reportP5FirstFrame?.("hatch_array_regression");
}
