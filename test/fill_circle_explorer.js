const PALETTE = ["#002185", "#003c32", "#fcd300", "#ff2702", "#6b9404", "#000000", "#ffffff"];
const PAPER = "#fffceb";
const STROKE = "#111111";

const SHAPES = ["circle", "rect", "blob", "grid"];

const state = {
  bleed: 0.3,
  opacity: 92,
  texture: 0.5,
  border: 0.4,
  color: PALETTE[0],
  seed: 100000 + Math.floor(Math.random() * 900000),
  shape: "circle",
};

const urlParams = new URLSearchParams(location.search);

const controls = {
  bleed: document.getElementById("bleed"),
  opacity: document.getElementById("opacity"),
  texture: document.getElementById("texture"),
  border: document.getElementById("border"),
  bleedVal: document.getElementById("bleedVal"),
  opacityVal: document.getElementById("opacityVal"),
  textureVal: document.getElementById("textureVal"),
  borderVal: document.getElementById("borderVal"),
  seedVal: document.getElementById("seedVal"),
  refreshSeed: document.getElementById("refreshSeed"),
  palette: document.getElementById("palette"),
};

let needsRender = true;
let renderQueued = false;
let urlSyncQueued = false;

function formatValue(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0$/, "").replace(/\.$/, "");
}

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function readUrlNumber(key, fallback, min, max, decimals = null) {
  if (!urlParams.has(key)) return fallback;
  const value = Number(urlParams.get(key));
  if (!Number.isFinite(value)) return fallback;
  const clamped = clampValue(value, min, max);
  return decimals === null ? clamped : Number(clamped.toFixed(decimals));
}

function syncUrl() {
  const qs = new URLSearchParams({
    bleed: String(state.bleed),
    opacity: String(state.opacity),
    texture: String(state.texture),
    border: String(state.border),
    color: state.color,
    seed: String(state.seed),
    shape: state.shape,
  });
  const nextSearch = `?${qs.toString()}`;
  if (location.search === nextSearch) return;
  history.replaceState(null, "", nextSearch);
}

function queueUrlSync() {
  if (urlSyncQueued) return;
  urlSyncQueued = true;
  requestAnimationFrame(() => {
    urlSyncQueued = false;
    syncUrl();
  });
}

function syncReadouts() {
  controls.bleedVal.textContent = formatValue(state.bleed);
  controls.opacityVal.textContent = formatValue(state.opacity);
  controls.textureVal.textContent = formatValue(state.texture);
  controls.borderVal.textContent = formatValue(state.border);
  controls.seedVal.textContent = String(state.seed).padStart(6, "0");
}

function syncPalette() {
  for (const btn of controls.palette.querySelectorAll(".swatch")) {
    btn.classList.toggle("active", btn.dataset.color === state.color);
  }
}

function queueRender() {
  needsRender = true;
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    redraw();
  });
}

function setupPalette() {
  for (const color of PALETTE) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "swatch";
    btn.dataset.color = color;
    btn.style.background = color;
    btn.title = color;
    btn.addEventListener("click", () => {
      state.color = color;
      syncPalette();
      queueUrlSync();
      queueRender();
    });
    controls.palette.appendChild(btn);
  }
  syncPalette();
}

function bindSlider(key, input, readout) {
  input.addEventListener("input", () => {
    state[key] = Number(input.value);
    readout.textContent = formatValue(state[key]);
    queueUrlSync();
    queueRender();
  });
}

state.bleed = readUrlNumber("bleed", state.bleed, 0, 1, 2);
state.opacity = Math.round(readUrlNumber("opacity", state.opacity, 0, 255));
state.texture = readUrlNumber("texture", state.texture, 0, 1, 2);
state.border = readUrlNumber("border", state.border, 0, 1, 2);
state.seed = Math.round(readUrlNumber("seed", state.seed, 100000, 999999));
if (urlParams.has("color") && PALETTE.includes(urlParams.get("color"))) {
  state.color = urlParams.get("color");
}
if (urlParams.has("shape") && SHAPES.includes(urlParams.get("shape"))) {
  state.shape = urlParams.get("shape");
}

controls.bleed.value = state.bleed;
controls.opacity.value = state.opacity;
controls.texture.value = state.texture;
controls.border.value = state.border;

bindSlider("bleed", controls.bleed, controls.bleedVal);
bindSlider("opacity", controls.opacity, controls.opacityVal);
bindSlider("texture", controls.texture, controls.textureVal);
bindSlider("border", controls.border, controls.borderVal);

controls.refreshSeed.addEventListener("click", () => {
  state.seed = 100000 + Math.floor(Math.random() * 900000);
  syncReadouts();
  queueUrlSync();
  queueRender();
});

function syncShapeButtons() {
  for (const btn of document.querySelectorAll(".shape-btn")) {
    btn.classList.toggle("active", btn.dataset.shape === state.shape);
  }
}

for (const btn of document.querySelectorAll(".shape-btn")) {
  btn.addEventListener("click", () => {
    state.shape = btn.dataset.shape;
    syncShapeButtons();
    queueUrlSync();
    queueRender();
  });
}

setupPalette();
syncShapeButtons();
syncReadouts();
syncUrl();

// Blob: a self-intersecting curvy shape drawn with beginShape(curvature)
// Vertices are arranged so two arms cross, creating interior holes.
function drawBlob(cx, cy, r) {
  brush.beginShape(1);
  const pts = [
    [  0, -1.0],  // top
    [ 0.9, -0.3], // right-upper — crosses toward lower-left
    [-0.7,  0.7], // lower-left  — passes through the right arm
    [ 0.7,  0.5], // right-lower
    [-0.9, -0.4], // left-upper  — closes the self-intersection
  ];
  for (const [dx, dy] of pts) brush.vertex(cx + dx * r, cy + dy * r);
  brush.endShape(true);
}

function drawShape(w, h) {
  const cx = w * 0.5, cy = h * 0.5, r = w * 0.28;
  if (state.shape === "circle") {
    brush.circle(cx, cy, r);
  } else if (state.shape === "rect") {
    brush.rect(cx - r, cy - r, r * 2, r * 2);
  } else {
    drawBlob(cx, cy, r);
  }
}

// Grid: 10 rects in a 2×5 layout, each a different palette color.
// Lets you verify fill-direction consistency across multiple shapes at once.
function drawGrid(w, h) {
  const COLS = 2, ROWS = 5, PAD = 24, GAP = 12;
  const cellW = (w - PAD * 2 - GAP * (COLS - 1)) / COLS;
  const cellH = (h - PAD * 2 - GAP * (ROWS - 1)) / ROWS;
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const color = PALETTE[(row * COLS + col) % PALETTE.length];
      const x = PAD + col * (cellW + GAP);
      const y = PAD + row * (cellH + GAP);
      brush.fill(color, state.opacity);
      brush.fillBleed(state.bleed, "out");
      brush.fillTexture(state.texture, state.border);
      brush.rect(x, y, cellW, cellH);
      brush.noFill();
    }
  }
}

function setup() {
  const canvas = createCanvas(800, 800, WEBGL);
  canvas.parent("canvas-host");
  angleMode(DEGREES);
  brush.load();
  noLoop();
}

function renderScene() {
  randomSeed(state.seed);
  noiseSeed(state.seed);
  syncReadouts();

  background(PAPER);
  push();
  translate(-width / 2, -height / 2);

  brush.noField();
  brush.noHatch();
  brush.set("HB", STROKE, 0.5);
  if (state.shape === "grid") {
    drawGrid(width, height);
  } else {
    brush.fill(state.color, state.opacity);
    brush.fillBleed(state.bleed, "out");
    brush.fillTexture(state.texture, state.border);
    drawShape(width, height);
    brush.noFill();
  }

  pop();
}

function draw() {
  if (!needsRender) return;
  needsRender = false;
  renderScene();
  window.reportP5FirstFrame?.("fill_circle_explorer");
}
