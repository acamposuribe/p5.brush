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

let palette = ["#002185", "#003c32", "#fcd300", "#ff2702", "#6b9404"]
let seeds = []
let isBackgroundDrawn = false;
let rrr = 213123;

let font;

async function setup() {
   
    let c = createCanvas(600, 600, WEBGL);
    c.id("main");
    adjustCanvas("main");
    
    // In p5 2.x, loadFont must be awaited in an async setup()
    font = await loadFont('https://fonts.gstatic.com/s/inter/v3/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuGKYMZhrib2Bg-4.ttf')
    angleMode(DEGREES);
    brush.load()
    brush.scaleBrushes(3.5)

    // Custom watercolor brush
    brush.add("watercolor", {
        type: "custom",
        weight: 5,
        scatter: 1,
        sharpness: 0.5,
        grain: 8,
        opacity: 10,
        spacing: 0.4,
        blend: true,
        pressure: [0.78, 1.3],
        tip: (_m) => { _m.rect(-5, -5, 10, 10); _m.rect(5, 5, 4, 4); },
        rotate: "natural"
    })

    for (let i = 0; i < 150; i++) seeds.push(random())
    background("#fffceb")
}

function draw() {

    frameRate(30)
    const t = frameCount / 30
    let scene = floor(t / 5) % 6
    textFont(font)
    translate(-width / 2, -height / 2)


    // --- Scene 0: Brush Rain ---
    if (scene === 0) {

        if (!isBackgroundDrawn) {
            background("#fffceb"), isBackgroundDrawn = true;
        }

        // Title
        push()
        noStroke()
        fill(0)
        translate(-20 + width / 2, -5 + height / 2)
        textAlign(CENTER, CENTER)
        textSize(50)
        text('*p5.brush', 0, 0)
        pop()

        let colores = ["#2c695a", "#4ad6af", "#7facc6", "#4e93cc", "#f6684f", "#ffd300"]
        let brushes = ["marker", "watercolor", "spray", "charcoal", "HB", "2B", "cpencil", "2H", "rotring"]

        brush.field("seabed")
        brush.set(random(brushes), random(colores), random(0.7, 1.6))
        brush.flowLine(random(width), random(height), random(140, 240), random(360))
    }

    // --- Scene 1: Vector Fields ---
    if (scene === 1) {
        isBackgroundDrawn = false;
        background("#080f15");

        let flowfields = brush.listFields()
        if (t % 1 == 0) brush.field(flowfields[floor(t % flowfields.length)])

        randomSeed(33213 * seeds[67])
        brush.set("charcoal", "white", 1)
        brush.circle(300, 300, 180, true)

        brush.pick("HB")
        randomSeed(33213 * seeds[97])
        for (let i = 0; i < 30; i++) {
            brush.flowLine(random(width), random(height), 75, 0)
        }

        push()
        noStroke()
        fill(210)
        textAlign(CENTER, CENTER)
        textSize(40)
        text('*field()', 300, 300)
        pop()
    }

    // --- Scene 2: Brush Wheel ---
    if (scene === 2) {
        isBackgroundDrawn = false;
        background("#e2e7dc");

        let brushes = ["marker", "marker", "watercolor", "watercolor", "charcoal", "HB", "2B", "rotring"]
        brush.field("seabed")

        let cx = 300, cy = 300;
        for (let i = 0; i < 20; i++) {
            let angle = (i * 18 + t * 30)
            randomSeed(33213 * seeds[i])
            brush.set(random(brushes), random(palette), 1)
            brush.flowLine(cx + 100 * cos(-angle), cy + 100 * sin(-angle), 320, angle)
        }

        brush.noField()
        if ((t * 10) % 5 == 0) { rrr = Math.random() * 23122 }
        randomSeed(rrr)
        brush.set(random(brushes), random(palette), 1)
        brush.circle(300, 300, 100, 0.2)

        push()
        noStroke()
        fill(40)
        textAlign(CENTER, CENTER)
        textSize(40)
        text('*stroke()', 300, 300)
        pop()
    }

    // --- Scene 3: Hatches ---
    if (scene === 3) {
        isBackgroundDrawn = false;
        background("#ffe6d4");

        randomSeed(33213 * seeds[56])
        brush.set("cpencil", "#003c32", 1)

        randomSeed(33213 * seeds[35])
        brush.hatchStyle("HB", "#c76282", 1.3)
        brush.hatch(15, 45)
        brush.polygon([
            [80 + 20 * sin(random(0, 360) + t * 150), 150 + 20 * sin(random(0, 360) + t * 150)],
            [180 + 20 * sin(random(0, 360) + t * 150), 150 + 20 * sin(random(0, 360) + t * 150)],
            [420 + 20 * sin(random(0, 360) + t * 150), 150 + 20 * sin(random(0, 360) + t * 150)],
            [480 + 20 * sin(random(0, 360) + t * 150), 450 + 20 * sin(random(0, 360) + t * 150)],
            [280 + 20 * sin(random(0, 360) + t * 150), 450 + 20 * sin(random(0, 360) + t * 150)],
            [130 + 20 * sin(random(0, 360) + t * 150), 450 + 20 * sin(random(0, 360) + t * 150)],
        ])

        randomSeed(33213 * seeds[75])
        brush.hatchStyle("marker", "#e0b411", 1.3)
        brush.hatch(10, 130, { rand: 0.1 })
        brush.polygon([
            [250 + 20 * cos(360 * sin(random(0, 360) + t * 120)), 250 + 20 * sin(random(0, 360) + t * 120)],
            [500 + 40 * cos(360 * sin(random(0, 360) + t * 120)), 300 + 50 * sin(random(0, 360) + t * 120)],
            [300 + 10 * cos(360 * sin(random(0, 360) + t * 120)), 520 + 30 * sin(random(0, 360) + t * 120)],
        ])

        push()
        noStroke()
        fill(50)
        textAlign(CENTER, CENTER)
        textSize(40)
        text('*hatch()', 300, 300)
        pop()

        brush.noHatch()
    }

    // --- Scene 4: Fill ---
    if (scene === 4) {
        if (!isBackgroundDrawn) {
            background("#fffceb"), isBackgroundDrawn = true;
            push()
            noStroke()
            fill(0)
            translate(-20 + width / 2, -5 + height / 2)
            textAlign(CENTER, CENTER)
            textSize(40)
            text('*fill()', 0, 0)
            pop()
        }
        brush.set("marker", "#e0b411", 1.1)
        let colores = ["#7b4800", "#002185", "#003c32", "#fcd300", "#ff2702", "#6b9404"];
        if ((10 * t) % 3 == 0) {
            brush.fill(random(colores), random(60, 110))
            brush.fillBleed(random(0.1, 0.55))
            brush.fillTexture(0.4, 0.4)
            brush.rect(random(width), random(height), random(50, 140), random(50, 140), "center")
            brush.noFill()
        }
    }

    // --- Scene 5: Splines ---
    if (scene === 5) {
        isBackgroundDrawn = false;
        background("#445e87");
        brush.noField()

        brush.set("2B", "#0e2d58", 2)
        randomSeed(33213 * seeds[67])
        brush.circle(155, 140, 50)

        randomSeed(33213 * seeds[67])

        let points = [
            [30, 30, 1],
            [250, 100, random(0.8, 1.5)],
            [280 - 150 * cos(360 * sin(random(0, 360) + t * 90)), 300 + 50 * sin(random(0, 360) + t * 90), random(0.8, 1.5)],
            [570, 570, 1]
        ]
        if (points[1][0] === points[1][1]) points[1][0] += 1;

        brush.set("charcoal", "white", 1)
        brush.spline(points, 1)
        brush.set("2H", "white", 1)
        for (let i = 1; i <= 4; i++) {
            let p = [
                [points[0][0] + 55 * i, points[0][1], 1],
                [points[1][0] - 3 * i, points[1][1] + 5 * i, 1],
                points[2],
                [points[3][0] - 100 * i, points[3][1], 1],
            ]
            randomSeed(33213 * seeds[62])
            brush.spline(p, 1)
        }

        push()
        noStroke()
        fill(210)
        translate(points[2][0], points[2][1])
        textAlign(LEFT, CENTER)
        textSize(40)
        text('*spline()', 0, 0)
        pop()
    }

}

function mouseClicked() {
    noLoop()
}
