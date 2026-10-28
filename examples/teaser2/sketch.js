// =============================================================================
//  p5.brush 2.x — Teaser Sketch
//
//  This sketch cycles through 7 scenes: the classic opener first, then the
//  new 2.x primitives, then the remaining classics.
//  Click anywhere to pause on the current scene.
//
//  Scenes:
//    0 · Brush Rain   — brush.flowLine() with a vector field
//    1 · Mass         — brush.mass(), dry-media hand-filled splines   [NEW]
//    2 · Mass Array   — brush.massArray(), even-odd holes             [NEW]
//    3 · Hatch Array  — brush.hatchArray(), many shapes one gesture   [NEW]
//    4 · Fields       — every built-in vector field cycling in sequence
//    5 · Strokes      — brush types, brush.set(), brush.pick()
//    6 · Watercolor   — brush.fill(), fillBleed(), fillTexture()
// =============================================================================


// ── Responsive canvas ────────────────────────────────────────────────────────
function adjustCanvas(id) {
    let canvas = document.getElementById(id);
    canvas.style.maxWidth   = "100vw";
    canvas.style.maxHeight  = "100vh";
    canvas.style.width      = "auto";
    canvas.style.height     = "auto";
    canvas.style.objectFit  = "contain";
}


// ── Globals ───────────────────────────────────────────────────────────────────

let palette = ["#002185", "#003c32", "#fcd300", "#ff2702", "#6b9404", "#4e93cc", "#9b1d10"];
const PAPER = "#fffceb";
const CX = 300, CY = 300;      // canvas centre — all labels live here
const DEBUG_SCENE = null;      // set to a scene number to debug it
const RECORD_GIF = new URLSearchParams(location.search).has("gif");

let lastScene = -1;            // tracks scene changes so accumulating scenes re-init cleanly
let font;                      // loaded in setup(), used for scene labels


// ── Helpers ───────────────────────────────────────────────────────────────────

function circlePoints(cx, cy, r, n = 36, phase = 0) {
    const pts = [];
    for (let i = 0; i < n; i++) {
        const a = phase + (360 * i) / n;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return pts;
}

// Scene label drawn centred on the canvas.
function label(str, col = 40, size = 40) {
    push();
    noStroke(); fill(col);
    textAlign(CENTER, CENTER); textSize(size);
    text(str, CX, CY);
    pop();
}


// ── Setup ─────────────────────────────────────────────────────────────────────
async function setup() {

    // p5.brush requires a WEBGL canvas.
    let c = createCanvas(600, 600, WEBGL);
    c.id("main");
    adjustCanvas("main");

    font = await loadFont("https://fonts.gstatic.com/s/inter/v3/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYMZhrib2Bg-4.ttf");
    angleMode(DEGREES);

    brush.scaleBrushes(3);

    // Custom brush used by scenes 0 and 5 — design your own at:
    // https://acamposuribe.github.io/p5.brush/tools/brush-maker.html
    brush.add("watercolor", {
        type:    "custom",
        weight:  10,
        scatter: 1.05,
        opacity: 9,
        spacing: 0.3,
        pressure: [0.8, 1.3],
        rotate:  "natural",
        tip: (_m) => {
            _m.fill(0, 200)
            _m.rect(-20, -20, 50, 50)
            _m.rect(25, 25, 20, 20)
        },
    });

    frameRate(30);

    // ?gif records exactly one complete loop, beginning at frame zero.
    if (RECORD_GIF) saveGif("p5-brush-2x", 42, { units: "seconds" });
}


// ── Draw loop ─────────────────────────────────────────────────────────────────
function draw() {

    const t     = frameCount / 30;
    const scene = DEBUG_SCENE ?? floor(t / 6) % 7;

    textFont(font);
    translate(-width / 2, -height / 2); // WEBGL origin is centre → shift to top-left

    switch (scene) {

        // ── Scene 0 · Brush Rain ──────────────────────────────────────────────
        // The classic opener: strokes accumulate on a fixed background under
        // the title.
        case 0: {
            if (lastScene !== 0) background(PAPER);

            const colores = ["#2c695a", "#4ad6af", "#7facc6", "#4e93cc", "#f6684f", "#ffd300"];
            const brushes = ["marker", "watercolor", "spray", "charcoal", "HB", "2B", "cpencil", "2H", "rotring"];

            brush.field("seabed");
            brush.set(random(brushes), random(colores), random(0.7, 1.6));
            brush.flowLine(random(width), random(height), random(140, 240), random(360));
            brush.noField();
            label("*p5.brush", 0, 50);
            break;
        }

        // ── Scene 1 · Mass ────────────────────────────────────────────────────
        // Three oversized overlapping pastel pebbles. All animate precision;
        // yellow also animates gradient, while blue uses two layers and red one.
        // Seeds stay constant so mass direction and pebble geometry do not flicker.
        case 1: {
            background(PAPER);
            brush.wiggle(2);

            const sweep = 0.5 - 0.5 * cos((t % 6) * 60); // 0 → 1 → 0
            const blobs = [
                { cx: 130 + 12 * sin(t * 2),       cy: 245 + 10 * cos(t * 1.6), R: 245, col: "#fcd300", seed: 11, rot: t * 1.2, strength: 1,    gradient: true },
                { cx: 390 + 10 * cos(t * 1.7),     cy: 425 + 12 * sin(t * 1.4), R: 220, col: "#002185", seed: 23, rot: -t,      strength: 0.65, gradient: false },
                { cx: 455 + 12 * sin(t * 1.5 + 2), cy: 205 + 10 * cos(t * 1.8), R: 180, col: "#ff2702", seed: 37, rot: t * 0.8, strength: 0.3,  gradient: false },
            ];

            for (const b of blobs) {
                randomSeed(b.seed);
                const ph1 = random(360), ph2 = random(360), ph3 = random(360);

                brush.noStroke();
                brush.mass("pastel", b.col, {
                    precision: sweep,
                    gradient: b.gradient ? sweep : 0,
                    strength: b.strength,
                    outline: false,
                });

                // A closed full-curvature brush shape built from eight organic
                // control points — an actual spline, not a polygon approximation.
                const pts = [];
                for (let k = 0; k < 8; k++) {
                    const a = (360 / 8) * k + b.rot;
                    const r = b.R * (1
                        + 0.13 * sin(a + ph1)
                        + 0.08 * sin(2 * a + ph2)
                        + 0.04 * sin(3 * a + ph3));
                    pts.push([b.cx + r * cos(a), b.cy + r * sin(a)]);
                }
                brush.beginShape(1);
                pts.forEach(([x, y]) => brush.vertex(x, y));
                brush.endShape(true);

                // Redraw the same main primitive for its independent contour.
                brush.noMass();
                brush.set("HB", "#000000", 1);
                brush.beginShape(1);
                pts.forEach(([x, y]) => brush.vertex(x, y));
                brush.endShape(true);
                brush.noStroke();
            }

            brush.noField();
            label("*mass()", 60);
            break;
        }

        // ── Scene 2 · Mass Array ──────────────────────────────────────────────
        // Three separate cheese forms: two curved pebbles and one pointy shape.
        // Each massArray combines one outer curve with several inner curves;
        // even-odd geometry cuts the inner shapes out as holes.
        case 2: {
            randomSeed(3030);
            noiseSeed(3030);
            background("#141b24");

            const rounded = (cx, cy, rx, ry, phase = 0) => {
                const points = [];
                for (let i = 0; i < 7; i++) {
                    const a = phase + i * 360 / 7;
                    const r = 1 + 0.12 * sin(2 * a + phase);
                    points.push([cx + rx * r * cos(a), cy + ry * r * sin(a)]);
                }
                return { points, curvature: 1 };
            };

            const cheeses = [
                {
                    color: palette[2], contour: palette[6], brush: "crayon", seed: 101, strength: 1, gradient: 0,
                    outer: rounded(140, 165, 190, 170, 12),
                    holeArea: { cx: 140, cy: 165, rx: 170, ry: 150 },
                },
                {
                    color: palette[3], contour: palette[5], brush: "crayon", seed: 202, strength: 1, gradient: 0.45,
                    outer: { points: [[235, 20], [560, 55], [625, 260], [440, 365], [230, 245]], curvature: 0 },
                    holeArea: { cx: 425, cy: 190, rx: 175, ry: 145 },
                },
                {
                    color: palette[0], contour: palette[1], brush: "crayon", seed: 303, strength: 0.65, gradient: 0,
                    outer: rounded(320, 465, 235, 185, 205),
                    holeArea: { cx: 320, cy: 465, rx: 210, ry: 160 },
                },
            ];

            // Reveal the same seeded holes progressively over each six-second pass.
            const holeCount = floor(((frameCount % 180) / 180) * 7);

            // Convert beginShape plots to the Polygon geometry massArray needs.
            const toPolygon = shape => {
                brush.beginShape(shape.curvature);
                shape.points.forEach(([x, y]) => brush.vertex(x, y));
                const plot = brush.endShape(true);
                return plot.genPol(plot.origin[0], plot.origin[1], 1, 0.3);
            };

            brush.noStroke();
            for (const cheese of cheeses) {
                // Fixed random holes: the first two are large and near an edge,
                // so they visibly bite through the outer silhouette.
                randomSeed(cheese.seed + 500);
                const holes = Array.from({ length: 6 }, (_, i) => {
                    const a = random(360);
                    const edge = i < 2;
                    const distance = edge ? random(0.78, 1.02) : random(0.1, 0.65);
                    const size = edge ? random(58, 88) : random(28, 52);
                    return rounded(
                        cheese.holeArea.cx + cheese.holeArea.rx * distance * cos(a),
                        cheese.holeArea.cy + cheese.holeArea.ry * distance * sin(a),
                        size,
                        size * random(0.75, 1.2),
                        random(360),
                    );
                });

                randomSeed(cheese.seed); // stable mass direction per cheese
                const rings = [cheese.outer, ...holes.slice(0, holeCount)];
                const polygons = rings.map(toPolygon);

                randomSeed(cheese.seed);
                brush.mass(cheese.brush, cheese.color, {
                    precision: 0.25,
                    strength: cheese.strength,
                    gradient: cheese.gradient,
                    outline: false,
                });
                brush.massArray(polygons);
                brush.noMass();

                // Redraw outer and hole curves independently with a pencil.
                randomSeed(cheese.seed + 1000);
                brush.set("HB", cheese.contour, 1);
                rings.forEach(shape => {
                    brush.beginShape(shape.curvature);
                    shape.points.forEach(([x, y]) => brush.vertex(x, y));
                    brush.endShape(true);
                });
                brush.noStroke();
            }

            label("*massArray()", 235);
            break;
        }

        // ── Scene 3 · Hatch Array ─────────────────────────────────────────────
        // One brush.hatchArray() call hatches several big, heavily overlapping
        // polygons as one combined gesture — the parallel lines run straight
        // across every shape as if drawn in a single pass. Their perimeters
        // are then traced on top with an HB pencil line.
        case 3: {
            randomSeed(2024);
            noiseSeed(2024);
            background("#ffe6d4");

            // Three static two-second compositions. The rectangle remains fixed;
            // the other five shapes switch family with the hatch brush.
            const rectAngle = -12;
            const rectangle = [[-125, -105], [125, -105], [125, 105], [-125, 105]].map(([x, y]) => [
                345 + x * cos(rectAngle) - y * sin(rectAngle),
                325 + x * sin(rectAngle) + y * cos(rectAngle),
            ]);
            const families = [
                [ // rounded pebbles
                    { points: [[-30, 130], [90, 45], [230, 90], [255, 205], [135, 270], [10, 230]], curvature: 1 },
                    { points: [[220, 70], [360, 25], [505, 95], [530, 215], [405, 270], [265, 205]], curvature: 1 },
                    { points: [[370, 220], [520, 195], [625, 325], [555, 475], [420, 500], [340, 355]], curvature: 1 },
                    { points: [[205, 380], [350, 350], [455, 480], [370, 630], [220, 605], [145, 480]], curvature: 1 },
                    { points: [[-25, 305], [115, 255], [245, 350], [210, 495], [75, 555], [-25, 450]], curvature: 1 },
                ],
                [ // pointy forms — varied scale and placement
                    { points: [[-35, 55], [145, 25], [105, 210]], curvature: 0 },
                    { points: [[135, 80], [510, 35], [445, 285], [205, 245]], curvature: 0 },
                    { points: [[475, 125], [635, 245], [530, 540], [405, 305]], curvature: 0 },
                    { points: [[130, 315], [480, 365], [315, 650], [65, 510]], curvature: 0 },
                    { points: [[-60, 260], [185, 330], [105, 585], [-30, 485]], curvature: 0 },
                ],
                [ // oversized charcoal ribbons, deliberately cropped by edges
                    { points: [[-130, 40], [80, -15], [365, 70], [310, 205], [40, 235], [-105, 170]], curvature: 1 },
                    { points: [[265, -80], [465, -55], [680, 105], [585, 255], [390, 205], [250, 90]], curvature: 1 },
                    { points: [[430, 145], [615, 180], [715, 390], [590, 590], [420, 490], [350, 285]], curvature: 1 },
                    { points: [[65, 300], [300, 255], [535, 430], [390, 720], [145, 655], [5, 470]], curvature: 1 },
                    { points: [[-145, 265], [70, 225], [315, 390], [225, 635], [-15, 690], [-125, 500]], curvature: 1 },
                ],
            ];
            const styleIndex = floor((frameCount % 180) / 60);
            const shapes = [...families[styleIndex], { points: rectangle, curvature: 0 }];

            // Build hatchArray's required Polygon inputs from real curved plots.
            brush.noStroke();
            brush.noHatch();
            const polygons = shapes.map(shape => {
                brush.beginShape(shape.curvature);
                shape.points.forEach(([x, y]) => brush.vertex(x, y));
                const plot = brush.endShape(true);
                return plot.genPol(plot.origin[0], plot.origin[1], 1, 0.3);
            });

            const hatchStyles = [
                { brush: "HB", color: palette[0], dist: 0.75, angle: 25 },
                { brush: "watercolor", color: palette[3], dist: 9, angle: 65 },
                { brush: "charcoal", color: palette[1], dist: 11, angle: 130, field: "seabed" },
            ];
            const hatchStyle = hatchStyles[styleIndex];
            if (hatchStyle.field) brush.field(hatchStyle.field);
            else brush.noField();
            brush.hatchStyle(hatchStyle.brush, hatchStyle.color, 1.2);
            brush.hatch(hatchStyle.dist, hatchStyle.angle, {
                rand: 0.15,
                gradient: 0.15,
                continuous: false,
            });
            brush.hatchArray(polygons);

            // Redraw the same main primitives for HB contours.
            brush.noHatch();
            brush.noField();
            randomSeed(9090);
            noiseSeed(9090);
            brush.set("HB", palette[1], 1.2);
            shapes.forEach(shape => {
                brush.beginShape(shape.curvature);
                shape.points.forEach(([x, y]) => brush.vertex(x, y));
                brush.endShape(true);
            });

            label("*hatchArray()", 50);
            break;
        }

        // ── Scene 4 · Vector Fields ───────────────────────────────────────────
        case 4: {
            background("#080f15");

            const flowfields = brush.listFields();
            if (t % 1 === 0) brush.field(flowfields[floor(t % flowfields.length)]);

            randomSeed(33213);
            brush.set("charcoal", "white", 1);
            brush.circle(CX, CY, 180, 0.3);

            brush.pick("HB");
            randomSeed(4412);
            for (let i = 0; i < 30; i++) {
                brush.flowLine(random(width), random(height), 75, 0);
            }

            label("*field()", 210);
            break;
        }

        // ── Scene 5 · Brush Wheel ─────────────────────────────────────────────
        case 5: {
            background("#e2e7dc");

            const brushes = ["marker", "marker", "watercolor", "watercolor", "charcoal", "HB", "2B", "rotring"];
            brush.field("seabed");

            for (let i = 0; i < 20; i++) {
                const angle = i * 18 + t * 30;
                randomSeed(33213 + i * 17);
                brush.set(random(brushes), random(palette), 1);
                brush.flowLine(CX + 100 * cos(-angle), CY + 100 * sin(-angle), 320, angle);
            }

            brush.noField();
            randomSeed(floor(t * 10));
            brush.set(random(brushes), random(palette), 1);
            brush.circle(CX, CY, 100, 0.2);

            label("*stroke()");
            break;
        }

        // ── Scene 6 · Watercolor Fill ─────────────────────────────────────────
        // Washes accumulate in layers on a fixed background.
        case 6: {
            if (lastScene !== 6) background(PAPER);

            const colores = ["#7b4800", "#002185", "#003c32", "#fcd300", "#ff2702", "#6b9404"];
            brush.set("marker", "#e0b411", 1.1);

            if ((10 * t) % 3 === 0) {
                brush.fill(random(colores), random(60, 110));
                brush.fillBleed(random(0.1, 0.55));
                brush.fillTexture(0.4, 0.4);
                brush.circle(random(width), random(height), random(40, 90), 0.4);
                brush.noFill();
            }
            label("*fill()", 0, 40);
            break;
        }
    }

    lastScene = scene;
}


// Click anywhere to pause the animation on the current scene.
function mouseClicked() {
    noLoop();
}
