// =============================================================================
//  p5.brush — Live Tutorial Sketch
//
//  This sketch cycles through 6 scenes, each demonstrating a core feature
//  of the p5.brush library. Click anywhere to pause on the current scene.
//
//  Scenes:
//    0 · Brush Rain   — brush.flowLine() with a vector field
//    1 · Fields       — every built-in vector field cycling in sequence
//    2 · Strokes      — brush types, brush.set(), brush.pick()
//    3 · Hatches      — brush.hatch() inside polygons
//    4 · Watercolor   — brush.fill(), fillBleed(), fillTexture()
//    5 · Splines      — brush.spline() with per-point pressure
// =============================================================================


// ── Responsive canvas ────────────────────────────────────────────────────────
// Fits the canvas to the browser window while preserving its aspect ratio.
function adjustCanvas(id) {
    let canvas = document.getElementById(id);
    canvas.style.maxWidth   = "100vw";
    canvas.style.maxHeight  = "100vh";
    canvas.style.width      = "auto";
    canvas.style.height     = "auto";
    canvas.style.objectFit  = "contain";
}


// ── Globals ───────────────────────────────────────────────────────────────────

// A hand-picked colour palette used across all scenes.
let palette = ["#002185", "#003c32", "#fcd300", "#ff2702", "#6b9404"];

// Pre-generated random seeds — one per element — so each frame redraws
// identically (deterministic randomness prevents shimmering).
let seeds = [];

let isBackgroundDrawn = false; // prevents background() wiping accumulating scenes
let rrr = 213123;              // seed that can be refreshed mid-scene

let font; // loaded in setup(), used for scene labels


// ── Setup ─────────────────────────────────────────────────────────────────────
async function setup() {

    // p5.brush requires a WEBGL canvas.
    let c = createCanvas(600, 600, WEBGL);
    c.id("main");
    adjustCanvas("main");

    // In p5 2.x, loadFont must be awaited inside an async setup().
    font = await loadFont("https://fonts.gstatic.com/s/inter/v3/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYMZhrib2Bg-4.ttf");
    angleMode(DEGREES);

    // brush.scaleBrushes() multiplies the weight and scatter of every
    // built-in brush by the given factor — handy for high-resolution canvases.
    brush.scaleBrushes(3.5);

    // ── Custom brush ──────────────────────────────────────────────────────────
    // brush.add() registers a new brush you can use anywhere in your sketch.
    // "custom" type means you supply a tip function that draws the stamp shape.
    // Each line of the tip receives a graphics context (_m) with full p5 2D API.
    //
    // Try the interactive Brush Maker to design your own:
    // https://acamposuribe.github.io/p5.brush/tools/brush-maker.html
    brush.add("watercolor", {
        type:     "custom",
        weight:   5,
        scatter:  1,          // sideways spread of each stamp
        opacity:  10,         // very transparent — builds up like real watercolour
        spacing:  0.4,        // stamps placed close together for a smooth wash
        pressure: [0.78, 1.3],// stroke grows from start to end
        tip:      (_m) => { _m.rect(-5, -5, 10, 10); _m.rect(5, 5, 4, 4); },
        rotate:   "natural"   // tip rotates to follow the stroke direction
    });

    // Fill the seeds array with stable randoms for deterministic drawing.
    for (let i = 0; i < 150; i++) seeds.push(random());
    background("#fffceb");
    frameRate(30);
}


// ── Draw loop ─────────────────────────────────────────────────────────────────
function draw() {

    // t advances once per second; scene changes every 5 seconds, cycling 0–5.
    const t     = frameCount / 30;
    const scene = floor(t / 5) % 6;

    textFont(font);

    // In WEBGL mode the origin is at the canvas centre. Shifting it to the
    // top-left lets us use the same coordinate system as 2D mode (0,0 = top-left).
    translate(-width / 2, -height / 2);


    // ── Scene 0 · Brush Rain ──────────────────────────────────────────────────
    // Demonstrates: brush.field(), brush.set(), brush.flowLine()
    //
    // flowLine() draws a single stroke that follows the active vector field.
    // Here every frame adds a new line, building up a layered composition.
    if (scene === 0) {

        if (!isBackgroundDrawn) {
            background("#fffceb");
            isBackgroundDrawn = true;
        }

        // Scene label — drawn with native p5 text on top of brush strokes.
        push();
        noStroke(); fill(0);
        translate(-20 + width / 2, -5 + height / 2);
        textAlign(CENTER, CENTER); textSize(50);
        text("*p5.brush", 0, 0);
        pop();

        const colores = ["#2c695a", "#4ad6af", "#7facc6", "#4e93cc", "#f6684f", "#ffd300"];
        const brushes = ["marker", "watercolor", "spray", "charcoal", "HB", "2B", "cpencil", "2H", "rotring"];

        // Activate a vector field. "seabed" produces gentle organic curves.
        // While a field is active, every flowLine() bends to follow it.
        brush.field("seabed");

        // brush.set(name, color, weight) picks the brush, colour, and size in one call.
        brush.set(random(brushes), random(colores), random(0.7, 1.6));

        // brush.flowLine(x, y, length, direction) — the stroke starts at (x,y),
        // travels `length` canvas units, and bends along the current vector field.
        brush.flowLine(random(width), random(height), random(140, 240), random(360));
    }


    // ── Scene 1 · Vector Fields ───────────────────────────────────────────────
    // Demonstrates: brush.listFields(), brush.field(), brush.pick(), brush.circle()
    //
    // Every built-in field is shown in turn so you can compare them.
    if (scene === 1) {
        isBackgroundDrawn = false;
        background("#080f15");

        // brush.listFields() returns an array of every registered field name.
        const flowfields = brush.listFields();

        // Rotate through all fields once per second.
        if (t % 1 === 0) brush.field(flowfields[floor(t % flowfields.length)]);

        // brush.circle() is affected by the active field — its outline bends
        // organically. The last argument (0–1) controls hand-drawn irregularity.
        randomSeed(33213 * seeds[67]);
        brush.set("charcoal", "white", 1);
        brush.circle(300, 300, 180, 0.3);

        // brush.pick() swaps the brush type while keeping the current colour and weight.
        brush.pick("HB");
        randomSeed(33213 * seeds[97]);
        for (let i = 0; i < 30; i++) {
            brush.flowLine(random(width), random(height), 75, 0);
        }

        push();
        noStroke(); fill(210);
        textAlign(CENTER, CENTER); textSize(40);
        text("*field()", 300, 300);
        pop();
    }


    // ── Scene 2 · Brush Wheel ─────────────────────────────────────────────────
    // Demonstrates: brush.flowLine() radiating from a centre, brush.noField()
    //
    // Lines are fired outward from a point on a rotating circle,
    // flowing along the "seabed" field to produce a spinning bloom.
    if (scene === 2) {
        isBackgroundDrawn = false;
        background("#e2e7dc");

        const brushes = ["marker", "marker", "watercolor", "watercolor", "charcoal", "HB", "2B", "rotring"];
        brush.field("seabed");

        const cx = 300, cy = 300;
        for (let i = 0; i < 20; i++) {
            const angle = i * 18 + t * 30;
            randomSeed(33213 * seeds[i]);
            brush.set(random(brushes), random(palette), 1);
            // Start each flowLine on a circle of radius 100 around the centre,
            // firing outward at the same angle — field bending does the rest.
            brush.flowLine(cx + 100 * cos(-angle), cy + 100 * sin(-angle), 320, angle);
        }

        // brush.noField() deactivates the field so the centre circle
        // is drawn without bending.
        brush.noField();
        if ((t * 10) % 5 === 0) rrr = Math.random() * 23122;
        randomSeed(rrr);
        brush.set(random(brushes), random(palette), 1);
        brush.circle(300, 300, 100, 0.2);

        push();
        noStroke(); fill(40);
        textAlign(CENTER, CENTER); textSize(40);
        text("*stroke()", 300, 300);
        pop();
    }


    // ── Scene 3 · Hatches ─────────────────────────────────────────────────────
    // Demonstrates: brush.hatchStyle(), brush.hatch(), brush.polygon(), brush.noHatch()
    //
    // Hatching fills a shape with parallel lines drawn by a brush.
    // The polygon vertices jitter each frame, making the shape feel alive.
    if (scene === 3) {
        isBackgroundDrawn = false;
        background("#ffe6d4");

        // brush.hatchStyle() sets the brush, colour, and weight used for the hatch lines.
        // brush.hatch(spacing, angle) activates hatching — every shape drawn
        // after this call will be filled with parallel lines at `angle` degrees,
        // spaced `spacing` canvas units apart.
        randomSeed(33213 * seeds[35]);
        brush.hatchStyle("HB", "#c76282", 1.3);
        brush.hatch(15, 45);
        brush.polygon([
            [80  + 20 * sin(random(0, 360) + t * 150), 150 + 20 * sin(random(0, 360) + t * 150)],
            [180 + 20 * sin(random(0, 360) + t * 150), 150 + 20 * sin(random(0, 360) + t * 150)],
            [420 + 20 * sin(random(0, 360) + t * 150), 150 + 20 * sin(random(0, 360) + t * 150)],
            [480 + 20 * sin(random(0, 360) + t * 150), 450 + 20 * sin(random(0, 360) + t * 150)],
            [280 + 20 * sin(random(0, 360) + t * 150), 450 + 20 * sin(random(0, 360) + t * 150)],
            [130 + 20 * sin(random(0, 360) + t * 150), 450 + 20 * sin(random(0, 360) + t * 150)],
        ]);

        // A second hatch style on the overlapping triangle — different brush and angle.
        // The { rand } option adds slight randomness to line spacing for a looser look.
        randomSeed(33213 * seeds[75]);
        brush.hatchStyle("marker", "#e0b411", 1.3);
        brush.hatch(10, 130, { rand: 0.1 });
        brush.polygon([
            [250 + 20 * cos(360 * sin(random(0, 360) + t * 120)), 250 + 20 * sin(random(0, 360) + t * 120)],
            [500 + 40 * cos(360 * sin(random(0, 360) + t * 120)), 300 + 50 * sin(random(0, 360) + t * 120)],
            [300 + 10 * cos(360 * sin(random(0, 360) + t * 120)), 520 + 30 * sin(random(0, 360) + t * 120)],
        ]);

        push();
        noStroke(); fill(50);
        textAlign(CENTER, CENTER); textSize(40);
        text("*hatch()", 300, 300);
        pop();

        // Always call noHatch() when you are done so subsequent shapes are not hatched.
        brush.noHatch();
    }


    // ── Scene 4 · Watercolor Fill ─────────────────────────────────────────────
    // Demonstrates: brush.fill(), brush.fillBleed(), brush.fillTexture(), brush.noFill()
    //
    // p5.brush simulates watercolour washes: soft edges, bleed, and paper texture.
    // Shapes accumulate on a fixed background, building up layers over time.
    if (scene === 4) {
        if (!isBackgroundDrawn) {
            background("#fffceb");
            isBackgroundDrawn = true;

            push();
            noStroke(); fill(0);
            translate(-20 + width / 2, -5 + height / 2);
            textAlign(CENTER, CENTER); textSize(40);
            text("*fill()", 0, 0);
            pop();
        }

        const colores = ["#7b4800", "#002185", "#003c32", "#fcd300", "#ff2702", "#6b9404"];
        brush.set("marker", "#e0b411", 1.1);

        if ((10 * t) % 3 === 0) {
            // brush.fill(color, opacity) enables watercolour fill for the next shape.
            // Opacity works on a 0–255 scale — low values let washes build up in layers.
            brush.fill(random(colores), random(60, 110));

            // fillBleed controls how much colour bleeds outside the shape edge (0–1).
            brush.fillBleed(random(0.1, 0.55));

            // fillTexture adds paper grain and a darker border (both 0–1).
            brush.fillTexture(0.4, 0.4);

            brush.rect(random(width), random(height), random(50, 140), random(50, 140), "center");

            // brush.noFill() disables fill so subsequent shapes are stroke-only.
            brush.noFill();
        }
    }


    // ── Scene 5 · Splines ────────────────────────────────────────────────────
    // Demonstrates: brush.spline(), per-point pressure, multiple overlapping curves
    //
    // brush.spline() draws a smooth curve through an array of [x, y, pressure] points.
    // Pressure (0–2) controls stroke thickness at each point along the path.
    if (scene === 5) {
        isBackgroundDrawn = false;
        background("#445e87");
        brush.noField();

        // A circle drawn with the "2B" brush — notice the soft charcoal-like edge.
        randomSeed(33213 * seeds[67]);
        brush.set("2B", "#0e2d58", 2);
        brush.circle(155, 140, 50);

        randomSeed(33213 * seeds[67]);

        // Control points as [x, y, pressure]. The third point animates over time,
        // making the family of curves ripple smoothly.
        const points = [
            [30,  30,  1],
            [250, 100, random(0.8, 1.5)],
            [280 - 150 * cos(360 * sin(random(0, 360) + t * 90)), 300 + 50 * sin(random(0, 360) + t * 90), random(0.8, 1.5)],
            [570, 570, 1],
        ];
        if (points[1][0] === points[1][1]) points[1][0] += 1;

        // The main spine in charcoal white, then four offset copies in lighter pencil
        // — stacking curves builds the sense of a hand-drawn bundle of lines.
        brush.set("charcoal", "white", 1);
        brush.spline(points, 1);

        brush.set("2H", "white", 1);
        for (let i = 1; i <= 4; i++) {
            const p = [
                [points[0][0] + 55 * i, points[0][1], 1],
                [points[1][0] - 3  * i, points[1][1] + 5 * i, 1],
                points[2],
                [points[3][0] - 100 * i, points[3][1], 1],
            ];
            randomSeed(33213 * seeds[62]);
            brush.spline(p, 1);
        }

        push();
        noStroke(); fill(210);
        translate(points[2][0], points[2][1]);
        textAlign(LEFT, CENTER); textSize(40);
        text("*spline()", 0, 0);
        pop();
    }

}


// Click anywhere to pause the animation on the current scene.
function mouseClicked() {
    noLoop();
}
