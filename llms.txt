# p5.brush

p5.brush is a natural drawing library — pencils, charcoal, markers, watercolor fills, hatch patterns, and vector fields.

---

## ⚠️ TWO BUILDS — READ THIS FIRST

p5.brush ships in **two completely different builds**. Before generating any code, identify which build the user is using. Getting this wrong produces broken code.

| | **p5 build** | **Standalone build** |
|---|---|---|
| File | `dist/p5.brush.js` | `dist/brush.js` / `dist/brush.esm.js` |
| Requires | p5.js 2.x | Nothing — browser WebGL2 only |
| Canvas | `createCanvas(w, h, WEBGL)` — p5 creates it | `brush.createCanvas(w, h)` — brush creates it |
| Transforms | p5's `push()`, `pop()`, `translate()`, `rotate()`, `scale()` | `brush.push()`, `brush.pop()`, `brush.translate()`, `brush.rotate()`, `brush.scale()` |
| Angle mode | p5's `angleMode(DEGREES / RADIANS)` | `brush.angleMode(brush.DEGREES / brush.RADIANS)` |
| Seeding | `randomSeed(n)` / `noiseSeed(n)` | `brush.seed(n)` / `brush.noiseSeed(n)` |
| Frame flush | Automatic — p5 handles it | **Must call `brush.render()`** at end of each frame |
| Clear canvas | p5's `background()` | `brush.clear(color?)` |
| Offscreen targets | `brush.load(p5Graphics \| framebuffer)` | `brush.load(htmlCanvas \| offscreenCanvas)` |

**Do not mix these up.** Using p5 functions (`push`, `background`, `randomSeed`, etc.) in a standalone sketch will break silently or throw errors. Using `brush.render()` or `brush.clear()` in a p5 sketch is unnecessary and wrong.

---

## p5 build

### Installation

```html
<script src="https://cdn.jsdelivr.net/npm/p5@2.2/lib/p5.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/p5.brush@latest"></script>
```

```js
// ESM — p5 build (default)
import * as brush from 'p5.brush'

// ESM — standalone build (no p5.js required)
import * as brush from 'p5.brush/standalone'
```

### Setup

The canvas **must use WEBGL mode**. The library initializes automatically when `createCanvas()` is called — **no `brush.load()` needed for the main canvas**.

```js
function setup() {
  createCanvas(600, 600, WEBGL)
  angleMode(DEGREES)     // brush angle APIs follow p5's angleMode
  brush.scaleBrushes(3)  // scale brushes to canvas size; 3 is a good start for 600×600
}

function draw() {
  background("#fffceb")
  translate(-width/2, -height/2) // WEBGL origin is center — shift to top-left

  brush.set("HB", "#222", 1)
  brush.line(50, 50, 550, 550)
}
```

### p5 integration — what hooks automatically

- `push()` / `pop()` — saves and restores brush stroke, fill, and hatch state
- `translate()`, `rotate()`, `scale()` — all p5 transforms apply to brush strokes
- `randomSeed(n)` — seeds both p5 and the brush library
- `noiseSeed(n)` — seeds both p5 noise and the brush library
- `angleMode(mode)` — all brush angle APIs follow p5's current angle mode

**No separate `brush.push()`, `brush.translate()`, or `brush.seed()` calls are needed or exist in this build.**

### Instance mode

```js
const sketch = (p) => {
  brush.instance(p)  // must be called before setup/draw
  p.setup = () => { p.createCanvas(600, 600, p.WEBGL) }
  p.draw  = () => { ... }
}
new p5(sketch)
```

### Offscreen targets (p5 build)

`brush.load()` is only for redirecting drawing to a secondary surface:

```js
// p5.Graphics
const pg = createGraphics(300, 200, WEBGL)
brush.load(pg)
brush.set("HB", "black", 1)
brush.circle(150, 100, 70)
brush.load()        // restore main canvas
image(pg, 20, 20)

// p5.Framebuffer
const fb = createFramebuffer({ width: 300, height: 200 })
fb.draw(() => {
  brush.load(fb)
  brush.circle(150, 100, 70)
})
brush.load()
image(fb, 20, 240)
```

---

## Standalone build

### Installation

```html
<!-- UMD — exposes global `brush` -->
<script src="path_to/brush.js"></script>
```

```js
// ESM — via npm
import * as brush from 'p5.brush/standalone'

// ESM — local file
import * as brush from './dist/brush.esm.js'
```

### Setup

Use `brush.createCanvas()` — it creates the canvas **and** loads it as the draw target automatically. No separate `brush.load()` needed.

```js
import * as brush from './dist/brush.esm.js'

brush.createCanvas(600, 600, {
  parent: document.body,
  pixelDensity: window.devicePixelRatio,
})
brush.scaleBrushes(3)
brush.angleMode(brush.DEGREES)
brush.seed(42)
```

`brush.load(canvas)` is only needed if you create the canvas yourself:

```js
const canvas = document.createElement('canvas')
canvas.width = 600; canvas.height = 600
document.body.appendChild(canvas)
brush.load(canvas)  // register external canvas as draw target
```

### Frame lifecycle — mandatory

The standalone build does **not** flush or clear automatically. You must do both yourself every frame.

```js
brush.clear('#f5f0e0')     // clear to background color
brush.push()
brush.translate(-W/2, -H/2)  // WEBGL origin is center — shift to top-left

// ... all drawing calls here ...

brush.pop()
brush.render()             // ← REQUIRED: flush compositing to canvas
```

**Forgetting `brush.render()` means nothing appears on screen.**

### Transforms (standalone)

```js
brush.push()           // saves transform + brush state
brush.pop()            // restores
brush.translate(x, y)
brush.rotate(angle)    // angle follows brush.angleMode()
brush.scale(x, y?)     // omit y to scale uniformly
```

### Angle mode (standalone)

```js
brush.angleMode(brush.DEGREES)   // all angle APIs use degrees
brush.angleMode(brush.RADIANS)   // default
```

### Seeding (standalone)

```js
brush.seed(42)
brush.noiseSeed(42)
```

### Standalone example

```js
import * as brush from './dist/brush.esm.js'

const W = 600, H = 600
brush.createCanvas(W, H, { parent: document.body })
brush.scaleBrushes(3)
brush.angleMode(brush.DEGREES)
brush.seed(42)

brush.clear('#f5f0e0')
brush.push()
brush.translate(-W/2, -H/2)

brush.set('HB', '#222', 1)
brush.line(50, 50, 550, 550)

brush.fill('#003c32', 120)
brush.fillBleed(0.15)
brush.noStroke()
brush.circle(300, 300, 120)

brush.pop()
brush.render()  // required
```

---

## Shared API (both builds)

Everything below works identically in both builds. The only differences are setup, transforms, angle mode, seeding, frame flush, and clear — all covered above.

### Configuration

- `brush.scaleBrushes(scale)` — Scale all currently registered brushes. Usually necessary to match canvas size. `3` is a good starting point for a 600×600 canvas; confirm visually. Call before adding custom brushes if you only want built-ins scaled.
- `brush.load(target)` — Redirect drawing to a secondary target. In the **p5 build**: pass a `p5.Graphics` (WEBGL) or active `p5.Framebuffer`; call with no args to restore the main canvas. In the **standalone build**: pass an `HTMLCanvasElement` or `OffscreenCanvas`; call again to switch targets.

---

### Stroke Operations

- `brush.set(name, color, weight)` — Set brush name, color (hex string or p5.Color in p5 build; hex/CSS string in standalone), and weight multiplier. Enables stroke.
- `brush.pick(name)` — Change brush type only, keeping current color and weight.
- `brush.stroke(r, g, b)` or `brush.stroke(color)` — Set stroke color. Enables stroke.
- `brush.strokeWeight(weight)` — Set weight multiplier only.
- `brush.noStroke()` — Disable stroke for subsequent shapes.

---

### Fill Operations

Fill simulates watercolor — soft edges, bleed, texture layering.

- `brush.fill(color, opacity)` or `brush.fill(r, g, b, opacity)` — Set fill color. Opacity 0–255. Enables fill.
- `brush.noFill()` — Disable fill.
- `brush.wash(color, opacity)` — Fast solid fill, no watercolor simulation.
- `brush.noWash()` — Disable wash.
- `brush.fillBleed(strength, direction?)` — Edge bleed 0–1. Direction: `"out"` or `"in"`.
- `brush.fillTexture(textureStrength, borderIntensity, scatter?)` — Texture and border, both 0–1. `scatter` (default `true`) enables the sparse scattered polygon layers; set to `false` for a cleaner gradient trim without edge texture noise.
- For better fill performance, group shapes by fill color/opacity so the library can reuse its internal caching.

---

### Hatch Operations

- `brush.hatch(dist, angle, options?)` — Enable hatching. `dist` = spacing in canvas units. `angle` follows current `angleMode()`. Options: `{rand: 0–1, continuous: bool, gradient: 0–1}`.
- `brush.noHatch()` — Disable hatching.
- `brush.hatchStyle(name, color, weight)` — Set brush used for hatching.
- `brush.mass(brushName, color, options?)` — Dry-media, hand-filled hatched fill. Works best with crayon or pastel brushes. `brushName` is always required explicitly. Options: `precision` 0–1, `strength` 0–1, `gradient` 0–1, `outline` bool.
- `brush.noMass()` — Disable massing.
- `brush.hatchArray(polygons)` — Apply current hatch style directly to a `brush.Polygon` or array of polygons.

---

### Vector Fields

Built-in fields: `"hand"`, `"curved"`, `"zigzag"`, `"waves"`, `"seabed"`, `"spiral"`, `"columns"`.

- `brush.field(name)` — Activate a named field.
- `brush.noField()` — Deactivate.
- `brush.wiggle(intensity)` — Shorthand for `"hand"` field with given wobble strength.
- `brush.listFields()` — Returns array of all field names.
- `brush.refreshField(t)` — Update field with time value. Call in draw loop for animation.
- `brush.addField(name, fn, options?)` — Custom field. `fn(t, field)` fills a 2D angle grid (degrees by default) and returns it. Pass `{ angleMode: "radians" }` if your generator writes radians.

```js
brush.addField("diagonal", (t, field) => {
  for (let col = 0; col < field.length; col++)
    for (let row = 0; row < field[0].length; row++)
      field[col][row] = 45 + t * 10
  return field
})
brush.field("diagonal")
```

---

### Primitives

#### Lines (stroke only)

- `brush.line(x1, y1, x2, y2)`
- `brush.flowLine(x, y, length, dir)` — Follows active vector field. `dir` follows current `angleMode()`.
- `brush.spline(points, curvature?)` — Smooth curve through `[[x,y], [x,y,pressure], ...]`. Curvature 0–1.

#### Manual strokes (stroke only)

```js
brush.beginStroke("curve", x, y)   // or "segments"
brush.move(angle, length, pressure)
brush.endStroke(angle, pressure)
```

#### Shapes (stroke + fill + hatch)

- `brush.rect(x, y, w, h, mode?)` — `mode`: `"corner"` (default) or `"center"`.
- `brush.circle(x, y, radius, r?)` — `r` = hand-drawn irregularity 0–1.
- `brush.arc(x, y, radius, start, end)` — Stroke only. Angles follow current `angleMode()`.
- `brush.polygon(pointsArray)` — Polygon from `[[x,y], ...]`. Not affected by vector fields. Avoid when fills or field-following matter.
- `brush.beginShape(curvature?)` / `brush.vertex(x, y, pressure?)` / `brush.endShape(close?)`

---

### Brush Management

- `brush.box()` — Returns array of all brush names.
- `brush.clip([x1, y1, x2, y2])` — Clip strokes to a rectangle. Transform is captured at call time.
- `brush.noClip()` — Remove clipping.
- `brush.add(name, params)` — Define a custom brush. Use the [Brush Maker](https://acamposuribe.github.io/p5.brush/tools/brush-maker.html) for interactive design.

**`brush.add()` params:**

| Property | Description |
|----------|-------------|
| `type` | `"default"`, `"spray"`, `"marker"`, `"custom"`, `"image"` |
| `weight` | Base thickness in canvas units |
| `scatter` | Sideways spread |
| `sharpness` | Edge softness 0–1 (`"default"` only) |
| `grain` | Texture density (`"default"` only) |
| `opacity` | Mark opacity 0–255 |
| `spacing` | Stamp gap along stroke (1 = no overlap) |
| `pressure` | `[start, end]` or `[start, mid, end]` or `(t) => value` |
| `tip` | `"custom"` type. **p5 build**: `(_m) => { ... }` where `_m` is a `p5.Graphics` — any p5 command works. **Standalone build**: `_m` is a minimal 2D-canvas wrapper — same method names but colors must be a grayscale number or CSS string (no `p5.Color`), and `rotate()` always takes radians. Draw in a 100×100 unit space, origin at centre. Dark = opaque, white = transparent. |
| `image` | `"image"` type: `{ src: "./tip.jpg" }` |
| `rotate` | `"none"`, `"natural"`, `"random"` |
| `markerTip` | `"marker"`, `"custom"`, `"image"` only. Boolean, default `true`. Set `false` to disable soft tip buildup at stroke ends. |
| `noise` | Per-stroke opacity variation. `0` = every stroke identical. `1` = maximum variation. Default `0.3`. |

- Image brushes return a Promise — use `await brush.add(...)` inside `async setup()`.
- Custom brushes do **not** need `await`.

```js
// Custom tip — works in both builds (uses radians, no p5.Color)
brush.add("diamond", {
  type: "custom",
  weight: 5, scatter: 0.08, opacity: 23, spacing: 0.6,
  pressure: [0.5, 1.5, 0.5],
  tip: (_m) => { _m.rotate(Math.PI / 4); _m.rect(-1.5, -1.5, 3, 3) },
  rotate: "natural",
  markerTip: false
})

// Image tip — must await, setup must be async
await brush.add("photo", {
  type: "image",
  weight: 10, scatter: 2, opacity: 30, spacing: 1.5,
  pressure: [1, 0.5],
  image: { src: "./tip.jpg" },
  rotate: "random",
  markerTip: false
})
```

---

### Exposed Classes

#### `brush.Polygon(pointsArray)`

```js
let p = new brush.Polygon([[x1,y1],[x2,y2],[x3,y3]])
p.draw(brushName, color, weight)
p.fill(color, opacity, bleed, texture)
p.wash(color, opacity)
p.hatch(distance, angle, options)
p.mass()
p.intersect(line)  // returns [{x,y}, ...]
// Attributes: p.vertices, p.sides
```

#### `brush.Plot(type)`

```js
let plot = new brush.Plot("curve")
plot.addSegment(angle, length, pressure)
plot.endPlot(angle, pressure)
plot.draw(x, y)
plot.fill(x, y)
plot.wash(x, y)
plot.hatch(x, y)
plot.mass(x, y)
plot.rotate(angle)
plot.genPol(x, y)  // returns a Polygon
```

#### `brush.Position(x, y)`

```js
let pos = new brush.Position(x, y)
pos.moveTo(dir, length, stepLength)  // dir follows current angleMode()
pos.plotTo(plot, length, stepLength, scale)
```

---

## Key Gotchas

### Both builds
- The WebGL canvas origin is at the **center**. Use `translate(-width/2, -height/2)` (p5) or `brush.translate(-W/2, -H/2)` (standalone) to work in top-left coordinates.
- `brush.arc()` is stroke-only. `brush.circle()` supports stroke, fill, and hatch.
- `brush.rect()` mode uses strings: `"corner"` or `"center"` — not p5 constants.
- Fill opacity is 0–255, not 0–100.
- `brush.flowLine()` and `brush.hatch()` angles follow the current `angleMode()`.

### p5 build only
- Canvas must be WEBGL: `createCanvas(w, h, WEBGL)`.
- `brush.load()` is not needed for the main canvas — only for `p5.Graphics` / `p5.Framebuffer` targets.
- `randomSeed()` and `noiseSeed()` seed the brush library automatically.
- For image brushes, `setup()` must be `async` and you must `await brush.add(...)`.

### Standalone build only
- **Always call `brush.render()` at the end of every drawing pass** — nothing appears otherwise.
- Use `brush.clear(color?)` to clear, not `background()`.
- Use `brush.push/pop/translate/rotate/scale`, not p5 equivalents.
- Use `brush.angleMode(brush.DEGREES)`, not `angleMode(DEGREES)`.
- Use `brush.seed(n)` and `brush.noiseSeed(n)`, not `randomSeed()`/`noiseSeed()`.
- In custom tip functions, `rotate()` always takes radians and colors must be numbers or CSS strings.
