const PALETTE = ["#002185", "#003c32", "#fcd300", "#ff2702", "#6b9404"];
const PAPER = "#fffceb";
const STROKE = "#111111";

const state = {
  bleed: 0.3,
  opacity: 92,
  texture: 0.5,
  border: 0.4,
  color: PALETTE[0],
  seed: 100000 + Math.floor(Math.random() * 900000),
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
  });
  history.replaceState(null, "", `?${qs.toString()}`);
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
      syncUrl();
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
    syncUrl();
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
  syncUrl();
  queueRender();
});

setupPalette();
syncReadouts();
syncUrl();

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
  brush.fill(state.color, state.opacity);
  brush.fillBleed(state.bleed, "out");
  brush.fillTexture(state.texture, state.border);
  brush.set("HB", STROKE, 0.5);
  brush.circle(width * 0.5, height * 0.5, width * 0.25);
  brush.noFill();

  pop();
}

function draw() {
  if (!needsRender) return;
  needsRender = false;
  renderScene();
}
