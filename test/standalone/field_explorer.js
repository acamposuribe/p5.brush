import * as brush from "../../dist/brush.esm.js";

const FIELDS = ["curved", "zigzag", "waves", "seabed", "spiral", "columns", "hand"];
const SIZE = 800;

const params = new URLSearchParams(location.search);
let currentField = params.get("field") || "curved";
let currentDensity = parseInt(params.get("density") || "18", 10);
let currentLen = parseInt(params.get("len") || "55", 10);
let currentSeed = params.has("seed")
  ? parseInt(params.get("seed"), 10)
  : Math.floor(Math.random() * 1000000);

const sel = document.getElementById("fieldSel");
FIELDS.forEach((fieldName) => {
  const opt = document.createElement("option");
  opt.value = fieldName;
  opt.textContent = fieldName;
  if (fieldName === currentField) opt.selected = true;
  sel.appendChild(opt);
});

const densityEl = document.getElementById("density");
const densityVal = document.getElementById("densityVal");
const lineLenEl = document.getElementById("lineLen");
const lineLenVal = document.getElementById("lineLenVal");
const seedVal = document.getElementById("seedVal");
const refreshSeedBtn = document.getElementById("refreshSeed");

densityEl.value = currentDensity;
densityVal.textContent = currentDensity;
lineLenEl.value = currentLen;
lineLenVal.textContent = currentLen;
seedVal.textContent = currentSeed;

let renderQueued = false;

function syncUrl() {
  const qs = new URLSearchParams({
    field: currentField,
    density: String(currentDensity),
    len: String(currentLen),
    seed: String(currentSeed),
  });
  history.replaceState(null, "", `?${qs.toString()}`);
}

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderExplorer();
  });
}

function handleControlInput() {
  currentField = sel.value;
  currentDensity = parseInt(densityEl.value, 10);
  currentLen = parseInt(lineLenEl.value, 10);
  densityVal.textContent = currentDensity;
  lineLenVal.textContent = currentLen;
  syncUrl();
  queueRender();
}

densityEl.addEventListener("input", handleControlInput);
lineLenEl.addEventListener("input", handleControlInput);
sel.addEventListener("input", handleControlInput);
sel.addEventListener("change", handleControlInput);

refreshSeedBtn.addEventListener("click", () => {
  currentSeed = Math.floor(Math.random() * 1000000);
  seedVal.textContent = currentSeed;
  syncUrl();
  queueRender();
});

syncUrl();
brush.createCanvas(SIZE, SIZE, {
  id: "brush-canvas",
  parent: "#canvas-host",
  pixelDensity: globalThis.devicePixelRatio || 1,
});
brush.scaleBrushes(3);

function renderExplorer() {
  brush.seed(currentSeed);
  brush.noiseSeed(currentSeed);
  seedVal.textContent = currentSeed;

  brush.clear("#f5f5f5");
  brush.push();
  brush.translate(-SIZE / 2, -SIZE / 2);

  if (currentField === "hand") {
    brush.wiggle(5);
  } else {
    brush.field(currentField);
  }
  brush.refreshField(0);
  brush.set("HB", "#1a2a5a", 1);

  const n = currentDensity;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const x = 40 + (c / (n - 1)) * 720;
      const y = 40 + (r / (n - 1)) * 720;
      brush.flowLine(x, y, currentLen, 0);
    }
  }

  brush.noField();
  brush.pop();
  brush.render();
}

renderExplorer();
