const CANVAS_W = 1360
const CANVAS_H = 780
const MARGIN = 36
const INFO_W = 250
const PANEL_GAP = 18
const ROW_H = 250
const ROW_GAP = 28
const PANEL_W = (CANVAS_W - 2 * MARGIN - INFO_W - PANEL_GAP * 2) / 2
const TARGET_H = ROW_H - 56
const PIXEL_THRESHOLD = Math.round(PANEL_W * TARGET_H * 0.004)

const PAPER = "#fcf7ef"
const FRAME = "#d1c3b1"
const INK = "#21313f"
const MUTED = "#5d6a74"
const TARGET_BG = [247, 241, 231]
const BLUE = "#174d71"
const GREEN = "#4d8b76"
const OCHRE = "#d38f47"
const RED = "#8a3d2f"
const PASS_BG = "#dbe8cf"
const PASS_FG = "#355f27"
const FAIL_BG = "#f2d3cb"
const FAIL_FG = "#8b3328"

let results = []
let labelBuf
let targetDensity = 1

const GEOMETRY_SEEDS = {
  line: 101,
  rect: 202,
  arc: 303,
  circle: 404,
}

function prepareBrushRandom(seed) {
  randomSeed(seed)
  noiseSeed(seed)
}

function renderBrushSceneLocal(w, h) {
  brush.noField()
  brush.noClip()
  brush.noHatch()
  brush.noFill()

  brush.set("marker", BLUE, 1.05)
  prepareBrushRandom(GEOMETRY_SEEDS.line)
  brush.line(26, 32, w - 28, h * 0.36)

  brush.noStroke()
  brush.fill(OCHRE, 86)
  brush.hatch(11, 35, { rand: 0 })
  brush.hatchStyle("pen", RED, 1.05)
  prepareBrushRandom(GEOMETRY_SEEDS.rect)
  brush.rect(38, h * 0.52, w * 0.34, h * 0.22)
  brush.noHatch()

  brush.set("HB", INK, 0.95)
  brush.noFill()
  prepareBrushRandom(GEOMETRY_SEEDS.arc)
  brush.arc(w * 0.72, h * 0.28, Math.min(w, h) * 0.14, 18, 158)

  brush.noStroke()
  brush.fill(GREEN, 92)
  prepareBrushRandom(GEOMETRY_SEEDS.circle)
  brush.circle(w * 0.74, h * 0.64, Math.min(w, h) * 0.23)
}

function renderSceneOnSurface(surface, x, y, w, h) {
  surface.push()
  surface.translate(x, y)
  renderBrushSceneLocal(w, h)
  surface.pop()
}

function paintTargetBackground(surface, w, h) {
  surface.push()
  surface.noStroke()
  surface.background(...TARGET_BG)
  surface.pop()
}

function countChangedPixels(target) {
  target.loadPixels()

  let count = 0
  for (let i = 0; i < target.pixels.length; i += 4) {
    const r = target.pixels[i]
    const g = target.pixels[i + 1]
    const b = target.pixels[i + 2]
    const alpha = target.pixels[i + 3]

    if (
      alpha > 8 &&
      (Math.abs(r - TARGET_BG[0]) +
        Math.abs(g - TARGET_BG[1]) +
        Math.abs(b - TARGET_BG[2]) > 18)
    ) {
      count++
    }
  }

  return count
}

function finalizeResult(result) {
  result.pass = !result.error && result.pixels >= PIXEL_THRESHOLD
  return result
}

function runGraphicsTest() {
  const result = {
    title: "p5.Graphics",
    subtitle: "createGraphics(..., WEBGL)",
    note: "This is the direct offscreen buffer path already documented by brush.load(buffer).",
    pixels: 0,
    error: null,
    target: null,
    displayTarget: null,
  }

  try {
    const pg = createGraphics(PANEL_W, TARGET_H, WEBGL)
    pg.pixelDensity(targetDensity)
    pg.angleMode(DEGREES)
    paintTargetBackground(pg, PANEL_W, TARGET_H)

    brush.load(pg)
    renderSceneOnSurface(pg, -PANEL_W / 2, -TARGET_H / 2, PANEL_W, TARGET_H)
    brush.load()

    result.target = pg
    result.displayTarget = pg
    result.pixels = countChangedPixels(pg)
  } catch (error) {
    result.error = error.message
    try {
      brush.load()
    } catch (_error) {}
  }

  return finalizeResult(result)
}

function runMainFramebufferTest() {
  const result = {
    title: "Main Framebuffer",
    subtitle: "createFramebuffer({ width, height })",
    note: "This row checks the framebuffer adapter on the main canvas, including custom target dimensions.",
    pixels: 0,
    error: null,
    target: null,
    displayTarget: null,
  }

  try {
    const fb = createFramebuffer({
      width: PANEL_W,
      height: TARGET_H,
      density: targetDensity,
    })

    fb.draw(() => {
      background(...TARGET_BG)

      brush.load(fb)
      renderSceneOnSurface(window.self.p5.instance, -PANEL_W / 2, -TARGET_H / 2, PANEL_W, TARGET_H)
    })

    brush.load()

    result.target = fb
    result.displayTarget = fb
    result.pixels = countChangedPixels(fb)
  } catch (error) {
    result.error = error.message
    try {
      brush.load()
    } catch (_error) {}
  }

  return finalizeResult(result)
}

function drawBadge(label, x, y, pass) {
  labelBuf.noStroke()
  labelBuf.fill(pass ? PASS_BG : FAIL_BG)
  labelBuf.rect(x, y, 70, 24, 999)
  labelBuf.fill(pass ? PASS_FG : FAIL_FG)
  labelBuf.textFont("Menlo")
  labelBuf.textSize(11)
  labelBuf.textAlign(CENTER, CENTER)
  labelBuf.text(label, x + 35, y + 12)
  labelBuf.textAlign(LEFT, BASELINE)
}

function drawFittedMonoLine(text, x, y, maxWidth, startSize = 12, minSize = 8) {
  let size = startSize
  labelBuf.textSize(size)

  while (size > minSize && labelBuf.textWidth(text) > maxWidth) {
    size -= 0.5
    labelBuf.textSize(size)
  }

  labelBuf.text(text, x, y)
}

function drawCard(result, x, y, w, h) {
  labelBuf.stroke(FRAME)
  labelBuf.strokeWeight(1)
  labelBuf.fill("#fffaf1")
  labelBuf.rect(x, y, w, h, 22)

  labelBuf.noStroke()
  labelBuf.fill(INK)
  labelBuf.textFont("Iowan Old Style")
  labelBuf.textSize(22)
  labelBuf.text(result.title, x + 18, y + 30)

  labelBuf.fill(MUTED)
  labelBuf.textFont("Menlo")
  drawFittedMonoLine(result.subtitle, x + 18, y + 52, w - 36, 12, 8)

  drawBadge(result.pass ? "PASS" : "FAIL", x + 18, y + 66, result.pass)

  labelBuf.fill(MUTED)
  labelBuf.textFont("Iowan Old Style")
  labelBuf.textSize(12)
  labelBuf.textLeading(17)
  labelBuf.text(result.note, x + 18, y + 110, w - 36, 54)

  labelBuf.textFont("Menlo")
  labelBuf.fill(INK)
  drawFittedMonoLine(`changed pixels: ${result.pixels}`, x + 18, y + h - 54, w - 36, 12, 8.5)
  drawFittedMonoLine(`pass threshold: ${PIXEL_THRESHOLD}`, x + 18, y + h - 34, w - 36, 12, 8.5)

  if (result.error) {
    labelBuf.fill(FAIL_FG)
    labelBuf.text(`error: ${result.error}`, x + 18, y + h - 82, w - 36, 24)
    return
  }
}

function drawPanelFrame(x, y, w, h) {
  stroke(FRAME)
  strokeWeight(1)
  fill(PAPER)
  rect(x, y, w, h, 22)

  stroke(230, 223, 211)
  line(x + 14, y + 56, x + w - 14, y + 56)
}

function drawPanelLabel(x, y, title, subtitle) {
  labelBuf.noStroke()
  labelBuf.fill(INK)
  labelBuf.textFont("Iowan Old Style")
  labelBuf.textSize(18)
  labelBuf.text(title, x + 16, y + 26)

  labelBuf.fill(MUTED)
  labelBuf.textFont("Menlo")
  labelBuf.textSize(11)
  labelBuf.text(subtitle, x + 16, y + 44)
}

function drawReferencePanel(x, y, w, h) {
  drawPanelFrame(x, y, w, h)
  drawPanelLabel(
    x,
    y,
    "Main-canvas reference",
    "Drawn after the offscreen pass with brush.load()",
  )

  brush.load()

  push()
  translate(x, y + 56)
  noStroke()
  fill(...TARGET_BG)
  rect(0, 0, w, TARGET_H)
  noFill()
  stroke(222, 214, 201)
  strokeWeight(1)
  rect(10, 10, w - 20, TARGET_H - 20, 16)
  renderBrushSceneLocal(w, TARGET_H)
  pop()
}

function drawTargetPanel(result, x, y, w, h) {
  drawPanelFrame(x, y, w, h)
  drawPanelLabel(x, y, "Offscreen target output", result.subtitle)
  drawBadge(result.pass ? "PASS" : "FAIL", x + w - 88, y + 16, result.pass)

  if (result.displayTarget || result.target) {
    image(result.displayTarget || result.target, x, y + 56, w, TARGET_H)
  }

  if (result.error) {
    labelBuf.noStroke()
    labelBuf.fill(FAIL_FG)
    labelBuf.textFont("Menlo")
    labelBuf.textSize(12)
    labelBuf.text(result.error, x + 16, y + 84, w - 32)
  }
}

function drawHeader() {
  labelBuf.noStroke()
  labelBuf.fill(INK)
  labelBuf.textFont("Iowan Old Style")
  labelBuf.textSize(34)
  labelBuf.text("Offscreen Target Coverage", MARGIN, 42)

  labelBuf.fill(MUTED)
  labelBuf.textSize(16)
  labelBuf.textLeading(24)
  labelBuf.text(
    "Each row renders the same brush scene offscreen and then composites it back with image(). Matching reference panels and non-zero pixel counts indicate that brush.load() is targeting the correct renderer.",
    MARGIN,
    72,
    CANVAS_W - 2 * MARGIN,
  )
}

function setup() {
  createCanvas(CANVAS_W, CANVAS_H, WEBGL)
  imageMode(CORNER)
  angleMode(DEGREES)
  targetDensity = pixelDensity()

  labelBuf = createGraphics(CANVAS_W, CANVAS_H)
  labelBuf.pixelDensity(targetDensity)

  brush.load()
  brush.scaleBrushes(4)

  results = [
    runGraphicsTest(),
    runMainFramebufferTest(),
  ]

  console.table(
    results.map((result) => ({
      target: result.title,
      pass: result.pass,
      pixels: result.pixels,
      error: result.error ?? "",
    })),
  )

  noLoop()
}

function draw() {
  background(244, 238, 226)
  translate(-width / 2, -height / 2)
  labelBuf.clear()

  drawHeader()

  const referenceX = MARGIN + INFO_W + PANEL_GAP
  const targetX = referenceX + PANEL_W + PANEL_GAP

  let y = 144

  for (const result of results) {
    drawCard(result, MARGIN, y, INFO_W, ROW_H)
    drawReferencePanel(referenceX, y, PANEL_W, ROW_H)
    drawTargetPanel(result, targetX, y, PANEL_W, ROW_H)
    y += ROW_H + ROW_GAP
  }

  image(labelBuf, 0, 0)
}