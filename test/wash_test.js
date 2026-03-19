const PALETTE = ["#002185", "#003c32", "#fcd300", "#ff2702", "#6b9404"];
const PAPER = "#fffceb";

const seedLabel = document.getElementById("seedVal");
const refreshSeedButton = document.getElementById("refreshSeed");

let currentSeed = 100000 + Math.floor(Math.random() * 900000);

function updateSeedLabel() {
  seedLabel.textContent = String(currentSeed).padStart(6, "0");
}

function drawRandomWashSet() {
  randomSeed(currentSeed);
  noiseSeed(currentSeed);
  updateSeedLabel();

  background(PAPER);
  translate(-width / 2, -height / 2);

  brush.wiggle(3)

  for (let i = 0; i < 50; i++) {

    const color = PALETTE[i % PALETTE.length];
    brush.wash(color, 255);
    
    const isCircle = random() < 0.5;

    if (isCircle) {
      const radius = random(100, 200);
      const cx = random(radius + 24, width - radius - 24);
      const cy = random(radius + 24, height - radius - 24);
      brush.circle(cx, cy, radius);
    } else {
      const rw = random(190, 250);
      const rh = random(190, 250);
      const rx = random(24, width - rw - 24);
      const ry = random(24, height - rh - 24);
      brush.rect(rx, ry, rw, rh);
    }
  }

  brush.noWash();
}

function setup() {
  const canvas = createCanvas(840, 720, WEBGL);
  canvas.parent("canvas-host");
  brush.load();
  brush.scaleBrushes(3)
  noLoop();
  updateSeedLabel();
}

function draw() {
  drawRandomWashSet();
}

refreshSeedButton.addEventListener("click", () => {
  currentSeed = 100000 + Math.floor(Math.random() * 900000);
  redraw();
});
