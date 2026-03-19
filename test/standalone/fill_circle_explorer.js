import * as brush from "../../dist/brush.esm.js";

const PALETTE = ["#002185", "#003c32", "#fcd300", "#ff2702", "#6b9404"];
const PAPER = "#fffceb";
const STROKE = "#111111";
const SIZE = 800;

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
  firstLoadVal: document.getElementById("firstLoadVal"),
  refreshSeed: document.getElementById("refreshSeed"),
  palette: document.getElementById("palette"),
};

let renderQueued = false;
let urlSyncQueued = false;
let firstLoadReported = false;
const firstLoadStart =
  performance.getEntriesByType("navigation")[0]?.domContentLoadedEventEnd ??
  performance.now();

function formatValue(value) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(2).replace(/0$/, "").replace(/\.$/, "");
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
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderScene();
  });
}

function reportFirstLoad() {
  if (firstLoadReported) return;
  firstLoadReported = true;
  requestAnimationFrame(() => {
    const total = performance.now() - firstLoadStart;
    const text = `${total.toFixed(1)} ms`;
    controls.firstLoadVal.textContent = text;
    console.log(`standalone fill_circle_explorer first load: ${text}`);
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

setupPalette();
syncReadouts();
syncUrl();

brush.createCanvas(SIZE, SIZE, {
  id: "brush-canvas",
  parent: "#canvas-host",
  pixelDensity: globalThis.devicePixelRatio || 1,
});
brush.angleMode(brush.DEGREES);

function renderScene() {
  brush.seed(state.seed);
  brush.noiseSeed(state.seed);
  syncReadouts();

  brush.clear(PAPER);
  brush.push();
  brush.translate(-SIZE / 2, -SIZE / 2);

  brush.noField();
  brush.noHatch();
  brush.fill(state.color, state.opacity);
  brush.fillBleed(state.bleed, "out");
  brush.fillTexture(state.texture, state.border);
  brush.set("HB", STROKE, 0.5);
  brush.circle(SIZE * 0.5, SIZE * 0.5, SIZE * 0.25);
  brush.noFill();

  brush.pop();
  brush.render();
  reportFirstLoad();
}

renderScene();
