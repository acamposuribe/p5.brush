const sketch = (p) => {
  const CANVAS_W = 1360
  const CANVAS_H = 960
  const MARGIN = 36
  const INFO_W = 270
  const PANEL_GAP = 18
  const ROW_H = 250
  const ROW_GAP = 28
  const PANEL_W = CANVAS_W - 2 * MARGIN - INFO_W - PANEL_GAP
  const TARGET_H = ROW_H - 56

  const PAPER = "#fcf7ef"
  const FRAME = "#d1c3b1"
  const INK = "#21313f"
  const MUTED = "#5d6a74"
  const TARGET_BG = [247, 241, 231]
  const BLUE = "#174d71"
  const GREEN = "#4d8b76"
  const OCHRE = "#d38f47"
  const RED = "#8a3d2f"
  const FAIL_FG = "#8b3328"

  const GEOMETRY_SEEDS = {
    line: 101,
    rect: 202,
    arc: 303,
    circle: 404,
  }

  let labelBuf
  let results = []
  let targetDensity = 1

  function prepareBrushRandom(seed) {
    p.randomSeed(seed)
    p.noiseSeed(seed)
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

  function runGraphicsTest() {
    const result = {
      title: "Instance p5.Graphics",
      subtitle: "const pg = p.createGraphics(..., p.WEBGL)",
      note: "Tests brush.load(pg) after brush.instance(p), with the offscreen result presented back on the instance canvas.",
      error: null,
      displayTarget: null,
      renderDirect: null,
    }

    try {
      const pg = p.createGraphics(PANEL_W, TARGET_H, p.WEBGL)
      pg.pixelDensity(targetDensity)
      pg.angleMode(p.DEGREES)
      paintTargetBackground(pg, PANEL_W, TARGET_H)

      brush.load(pg)
      renderSceneOnSurface(pg, -PANEL_W / 2, -TARGET_H / 2, PANEL_W, TARGET_H)
      brush.load()

      result.displayTarget = pg
    } catch (error) {
      result.error = error.message
      try {
        brush.load()
      } catch (_error) {}
    }

    return result
  }

  function runFramebufferTest() {
    const result = {
      title: "Instance Framebuffer",
      subtitle: "const fb = p.createFramebuffer({ width, height })",
      note: "Tests brush.load(fb) inside the active framebuffer scope of the instance sketch, then presents it on the instance canvas.",
      error: null,
      displayTarget: null,
      renderDirect: null,
    }

    try {
      const fb = p.createFramebuffer({
        width: PANEL_W,
        height: TARGET_H,
        density: targetDensity,
      })

      fb.draw(() => {
        p.background(...TARGET_BG)
        brush.load(fb)
        renderSceneOnSurface(p, -PANEL_W / 2, -TARGET_H / 2, PANEL_W, TARGET_H)
      })

      brush.load()
      result.displayTarget = fb
    } catch (error) {
      result.error = error.message
      try {
        brush.load()
      } catch (_error) {}
    }

    return result
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
    labelBuf.textSize(11)
    labelBuf.text(result.subtitle, x + 18, y + 52, w - 36)

    labelBuf.fill(MUTED)
    labelBuf.textFont("Iowan Old Style")
    labelBuf.textSize(13)
    labelBuf.textLeading(18)
    labelBuf.text(result.note, x + 18, y + 98, w - 36)

    if (result.error) {
      labelBuf.fill(FAIL_FG)
      labelBuf.textFont("Menlo")
      labelBuf.textSize(12)
      labelBuf.text(`error: ${result.error}`, x + 18, y + h - 50, w - 36)
    }
  }

  function drawPanelFrame(x, y, w, h) {
    p.stroke(FRAME)
    p.strokeWeight(1)
    p.fill(PAPER)
    p.rect(x, y, w, h, 22)

    p.stroke(230, 223, 211)
    p.line(x + 14, y + 56, x + w - 14, y + 56)
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

  function drawDirectInstanceContent(x, y, w, h) {
    brush.load()

    p.push()
    p.translate(x, y)
    p.noStroke()
    p.fill(...TARGET_BG)
    p.rect(0, 0, w, h)
    p.noFill()
    p.stroke(222, 214, 201)
    p.strokeWeight(1)
    p.rect(10, 10, w - 20, h - 20, 16)
    renderBrushSceneLocal(w, h)
    p.pop()
  }

  function drawTargetPanel(result, x, y, w, h) {
    drawPanelFrame(x, y, w, h)
    drawPanelLabel(x, y, "Instance-mode output", result.subtitle)

    if (result.renderDirect) {
      result.renderDirect(x, y + 56, w, TARGET_H)
    } else if (result.displayTarget) {
      p.image(result.displayTarget, x, y + 56, w, TARGET_H)
    }

    if (result.error) {
      labelBuf.noStroke()
      labelBuf.fill(FAIL_FG)
      labelBuf.textFont("Menlo")
      labelBuf.textSize(12)
      labelBuf.text(result.error, x + 16, y + 84, w - 32)
    }
  }

  p.setup = () => {
    brush.instance(p)

    const canvas = p.createCanvas(CANVAS_W, CANVAS_H, p.WEBGL)
    canvas.parent("instance-mode-app")
    p.imageMode(p.CORNER)
    p.angleMode(p.DEGREES)
    targetDensity = p.pixelDensity()

    labelBuf = p.createGraphics(CANVAS_W, CANVAS_H)
    labelBuf.pixelDensity(targetDensity)

    brush.load()
    brush.scaleBrushes(4)

    results = [
      {
        title: "Instance Canvas",
        subtitle: "brush.instance(p) + brush.load()",
        note: "Tests the direct instance-mode path on the sketch canvas itself, with no intermediate target object.",
        error: null,
        displayTarget: null,
        renderDirect: drawDirectInstanceContent,
      },
      runGraphicsTest(),
      runFramebufferTest(),
    ]

    p.noLoop()
  }

  p.draw = () => {
    p.background(244, 238, 226)
    p.translate(-p.width / 2, -p.height / 2)
    labelBuf.clear()

    const outputX = MARGIN + INFO_W + PANEL_GAP
    let y = MARGIN

    for (const result of results) {
      drawCard(result, MARGIN, y, INFO_W, ROW_H)
      drawTargetPanel(result, outputX, y, PANEL_W, ROW_H)
      y += ROW_H + ROW_GAP
    }

    p.image(labelBuf, 0, 0)
  }
}

new p5(sketch)
