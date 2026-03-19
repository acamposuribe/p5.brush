const PAPER = "#fffceb";
const PALETTE = ["#002185", "#003c32", "#fcd300", "#ff2702", "#6b9404"];
const CANVAS_W = 600;
const CANVAS_H = 600;
let currentSeed = Math.floor(Math.random() * 900000) + 100000;
const state = {
  brushType: "pastel",
  precision: 0.3,
  strength: 0.6,
  gradient: 0.1,
  outline: false,
};

const controls = {
  seedVal: document.getElementById("seedVal"),
  refreshSeed: document.getElementById("refresh-seed"),
  brushType: document.getElementById("brushType"),
  precision: document.getElementById("precision"),
  precisionVal: document.getElementById("precisionVal"),
  strength: document.getElementById("strength"),
  strengthVal: document.getElementById("strengthVal"),
  gradient: document.getElementById("gradient"),
  gradientVal: document.getElementById("gradientVal"),
  outline: document.getElementById("outline"),
};

function formatValue(value) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0$/, "").replace(/\.$/, "");
}

function syncReadouts() {
  controls.seedVal.textContent = String(currentSeed).padStart(6, "0");
  controls.precisionVal.textContent = formatValue(state.precision);
  controls.strengthVal.textContent = formatValue(state.strength);
  controls.gradientVal.textContent = formatValue(state.gradient);
}

function queueRender() {
  redraw();
}

function setup() {
  const canvas = createCanvas(CANVAS_W, CANVAS_H, WEBGL);
  canvas.parent("canvas-host");
  brush.load();

  brush.scaleBrushes(3)

  noLoop();

  syncReadouts();

  if (controls.refreshSeed) {
    controls.refreshSeed.addEventListener("click", () => {
      currentSeed = Math.floor(Math.random() * 900000) + 100000;
      syncReadouts();
      queueRender();
    });
  }

  controls.brushType?.addEventListener("input", () => {
    state.brushType = controls.brushType.value;
    queueRender();
  });

  controls.precision?.addEventListener("input", () => {
    state.precision = Number(controls.precision.value);
    syncReadouts();
    queueRender();
  });

  controls.strength?.addEventListener("input", () => {
    state.strength = Number(controls.strength.value);
    syncReadouts();
    queueRender();
  });

  controls.gradient?.addEventListener("input", () => {
    state.gradient = Number(controls.gradient.value);
    syncReadouts();
    queueRender();
  });

  controls.outline?.addEventListener("input", () => {
    state.outline = controls.outline.checked;
    queueRender();
  });
}

function draw() {
  randomSeed(currentSeed);
  noiseSeed(currentSeed);
  syncReadouts();
  background(PAPER);
  translate(-width / 2, -height / 2);
  brush.wiggle();

  for (let i = 0; i < 3; i++) {
    brush.mass(state.brushType, random(PALETTE), {
      precision: state.precision,
      strength: state.strength,
      gradient: state.gradient,
      outline: state.outline,
    });
    brush.set("pen", "black", 1)
    brush.circle(
      random(CANVAS_W),
      random(CANVAS_H),
      CANVAS_W * random(0.2, 0.4),
    );
    brush.noMass();
  }
  noLoop();
  window.reportP5FirstFrame?.("pastel_hatching_test");
}
