//////////////////////////////////////////////////
function adjustCanvas(id) {
  let canvas = document.getElementById(id);
  canvas.style.maxWidth = "100vw";
  canvas.style.maxHeight = "100vh";
  canvas.style.width = "auto";
  canvas.style.height = "auto";
  canvas.style.objectFit = "contain";
}

//////////////////////////////////////////////////
// P5 FUNCTIONS

let palette = ["#002185", "#fcd300", "#ff2702", "#6b9404"];

async function setup() {
  randomSeed(1232343);
  brush.seed(1212233);
  brush.noiseSeed(121233123);
  brush.scaleBrushes(7);
  let c = createCanvas(1500, 1500, WEBGL);
  c.id("main");
  adjustCanvas("main");
  clear();

  //background("#ffffff");
  angleMode(DEGREES);

  brush.load();

  brush.wiggle(5);

  // ---- Custom tip brush definition ----
  brush.add("diamondTip", {
    type: "custom",
    weight: 0.5,
    scatter: 0.3,
    sharpness: 0.5,
    grain: 8,
    opacity: 6,
    spacing: 1,
    pressure: [1.35, 1],
    rotate: "natural",
    tip: function (_m) {
      (_m.rotate(45), _m.rect(-5, -5, 10, 10), _m.rect(0, 0, 3, 3));
    },
  });

  // ---- Image tip brush definition ----
  await brush.add("imageTip", {
    type: "image",
    weight: 50,
    scatter: 0.2,
    sharpness: 1,
    grain: 1,
    opacity: 14,
    spacing: 1.5,
    pressure: [0.95, 5, 1.35],
    rotate: "natural",
    image: { src: "brush_tips/brush.jpg" },
  });

  translate(-width / 2, -height / 2);

  // ---- Standard brushes test ----
  let i = 0;

  brush.set("imageTip", random(palette), 1);
  brush.flowLine(150, 150 + i * 50, 700, 0);

  /*
  for (let b of brush.box()) {
    brush.set(b, random(palette), 1);
    brush.flowLine(150, 150 + i * 50, 700, 0);
    i++;
  }
    */
}

function draw() {}
