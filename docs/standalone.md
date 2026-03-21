# p5.brush — Standalone Build

The standalone build (`dist/brush.js` / `dist/brush.esm.js`) runs without p5.js. It needs nothing beyond a WebGL2-capable browser.

For the p5 build see the main [README](../README.md).

---

## Table of Contents
- [Installation](#installation)
- [Custom tip brushes](#custom-tip-brushes)
- [Setup](#setup)
- [Frame lifecycle](#frame-lifecycle)
- [Transforms](#transforms)
- [Angle mode](#angle-mode)
- [Seeding](#seeding)
- [API reference](#api-reference)
- [Differences from the p5 build](#differences-from-the-p5-build)

---

## Installation

### Script tag (UMD)

Download `dist/brush.js` from this repository and include it in your HTML. It exposes a global `brush` object.

```html
<script src="path_to/brush.js"></script>
```

### ESM module

```js
import * as brush from './dist/brush.esm.js';
```

---

## Setup

### Using `brush.createCanvas()`

The simplest path. Creates a `<canvas>` element, attaches it to the DOM, and automatically loads it as the draw target — no separate `brush.load()` call needed.

```js
brush.createCanvas(width, height, options?)
```

**Options:**

| Property | Description |
|---|---|
| `pixelDensity` | Backing resolution multiplier. Defaults to `1`. Pass `window.devicePixelRatio` for sharp output on HiDPI screens. |
| `parent` | CSS selector string or DOM element to append the canvas to. |
| `id` | `id` attribute for the created `<canvas>`. |

```js
import * as brush from './dist/brush.esm.js';

brush.createCanvas(800, 600, {
  parent: '#sketch-container',
  pixelDensity: window.devicePixelRatio,
});

brush.scaleBrushes(4);
brush.angleMode(brush.DEGREES);
```

### Bringing your own canvas

If you create the canvas element yourself (or use an `OffscreenCanvas`), call `brush.load(canvas)` once to register it as the draw target.

```js
const canvas = document.createElement('canvas');
canvas.width  = 800;
canvas.height = 600;
document.body.appendChild(canvas);

brush.load(canvas);
```

`brush.load()` also lets you **switch between multiple canvases** at runtime — call it again with a different canvas whenever you want to redirect drawing.

> **WebGL2 required.** Both `brush.createCanvas()` and `brush.load()` require the canvas to support a WebGL2 context. Make sure the browser supports it before calling either.

---

## Frame lifecycle

Unlike the p5 build (where p5 handles compositing automatically), the standalone build requires you to explicitly flush and clear each frame.

### `brush.render()`

Flushes any pending stroke and fill compositing into the active canvas. Call this **at the end of each drawing pass** — once per frame if you are animating, or once after a static draw.

```js
brush.clear('#f5f0e0');
brush.push();
brush.translate(-W / 2, -H / 2);

brush.set('HB', '#333', 1);
brush.line(100, 100, 700, 500);

brush.pop();
brush.render(); // ← flush to canvas
```

### `brush.clear(color?)`

Clears the active canvas. Without arguments, clears to transparent. With a color argument, clears to that color at full opacity.

```js
brush.clear();            // transparent
brush.clear('#f5f0e0');   // off-white background
brush.clear(240, 235, 220); // RGB
```

---

## Transforms

The standalone build manages its own transform stack, independent of any external library.

```js
brush.push()           // save current transform + brush state
brush.pop()            // restore
brush.translate(x, y)
brush.rotate(angle)    // angle follows current angleMode
brush.scale(x, y?)     // omit y to scale uniformly
```

These work exactly like p5's equivalents. `push()` and `pop()` save and restore both the transform matrix and brush state (stroke, fill, hatch settings).

### Origin

The WebGL canvas origin is at the **center** of the canvas. To work in top-left coordinates, shift the origin at the start of each frame:

```js
brush.push();
brush.translate(-W / 2, -H / 2);

// draw everything here...

brush.pop();
brush.render();
```

---

## Angle mode

```js
brush.angleMode(brush.DEGREES);  // all angle inputs in degrees
brush.angleMode(brush.RADIANS);  // all angle inputs in radians (default)
```

The exported constants are `brush.DEGREES` and `brush.RADIANS`. The mode affects every API that accepts an angle: `brush.rotate()`, `brush.hatch()`, `brush.flowLine()`, `brush.arc()`, `brush.move()`, `brush.addField()`, and `brush.Position.moveTo()`.

```js
brush.angleMode(brush.DEGREES);
brush.hatch(8, 45);        // 45°
brush.flowLine(x, y, 100, 90); // pointing down
```

For custom vector fields, pass `{ angleMode: 'radians' }` if your generator writes radians:

```js
brush.addField('myField', (t, field) => {
  for (let c = 0; c < field.length; c++)
    for (let r = 0; r < field[0].length; r++)
      field[c][r] = Math.sin(c * 0.3 + t) * Math.PI;
  return field;
}, { angleMode: 'radians' });
```

---

## Seeding

```js
brush.seed(n)        // seed the internal RNG
brush.noiseSeed(n)   // seed the internal noise generator
```

Call before drawing to get reproducible results. Both accept any number.

```js
brush.seed(42);
brush.noiseSeed(42);
```

---

## API reference

All stroke, fill, hatch, primitive, field, and class APIs are **identical** to the p5 build. See the [p5 API reference in README.md](../README.md#reference) for the full documentation of every function.

The sections below list only what is **different or exclusive** to the standalone build.

---

### Configuration

#### `brush.createCanvas(width, height, options?)`

Creates a `<canvas>` element and loads it as the draw target. Returns the canvas element.

See [Setup](#setup) above for the full option list and examples.

---

#### `brush.load(canvas)`

Loads an existing `HTMLCanvasElement` or `OffscreenCanvas` as the draw target. Only needed when you create the canvas yourself or want to switch targets.

```js
// External canvas
const canvas = document.createElement('canvas');
canvas.width = 800; canvas.height = 600;
brush.load(canvas);

// OffscreenCanvas (e.g. in a Web Worker)
const offscreen = new OffscreenCanvas(800, 600);
brush.load(offscreen);
```

---

#### `brush.render()`

Flushes compositing. Must be called at the end of every drawing pass. See [Frame lifecycle](#frame-lifecycle).

---

#### `brush.clear(color?)`

Clears the canvas to transparent (no args) or to a solid color. See [Frame lifecycle](#frame-lifecycle).

---

### Transforms

#### `brush.push()` / `brush.pop()`

Save and restore the current transform matrix and all brush state (stroke, fill, hatch).

#### `brush.translate(x, y)`

#### `brush.rotate(angle)`

Angle follows the current `brush.angleMode()`.

#### `brush.scale(x, y?)`

Omit `y` to scale uniformly.

---

### Angle mode

#### `brush.angleMode(mode)`

Set to `brush.DEGREES` or `brush.RADIANS`. Default is `brush.RADIANS`.

#### `brush.DEGREES` / `brush.RADIANS`

Exported string constants used with `brush.angleMode()`.

---

### Seeding

#### `brush.seed(n)`

Seed the internal RNG.

#### `brush.noiseSeed(n)`

Seed the internal noise generator.

---

## Custom tip brushes

In the p5 build, the `tip` function receives a real `p5.Graphics` object so any p5 drawing command works. In the standalone build it receives a **minimal 2D-canvas-backed surface** that deliberately mirrors the same method names, so most tip functions are portable between builds.

### Available methods

| Method | Notes |
|---|---|
| `push()` / `pop()` | Save / restore transform and state |
| `translate(x, y)` | |
| `scale(x, y?)` | |
| `rotate(angle)` | **Always radians** — ignores `brush.angleMode()` |
| `fill(value)` | Grayscale number `0–255` or CSS color string |
| `noFill()` | |
| `stroke(value)` | Grayscale number `0–255` or CSS color string |
| `noStroke()` | |
| `strokeWeight(value)` | |
| `rect(x, y, w, h)` | |
| `circle(x, y, diameter)` | |
| `ellipse(x, y, w, h)` | |
| `line(x1, y1, x2, y2)` | |
| `beginShape()` / `vertex(x, y)` / `endShape(close?)` | |
| `loadPixels()` / `updatePixels()` / `pixels` | Raw pixel access |

### Coordinate space

The tip surface is 500×500 px internally but the user-facing coordinate space is **100×100 units with the origin at the centre** (the library applies a ×5 scale and a translate to the centre automatically). Draw within roughly ±50 units.

**Dark fills → high opacity. Light/white → transparent.** The library converts the tip to a white-tinted mask so it can be tinted with any brush color at draw time.

### Colors

Colors accept a **grayscale number** (0 = black/opaque, 255 = white/transparent) or any **CSS color string** (`'red'`, `'#3a2f1e'`, `'rgb(60, 47, 30)'`). `p5.Color` objects are not supported.

```js
// ✓ works in both builds
brush.add('diamond', {
  type: 'custom',
  weight: 5,
  scatter: 0.08,
  opacity: 23,
  spacing: 0.6,
  pressure: [0.5, 1.5, 0.5],
  tip: (_m) => {
    _m.rotate(Math.PI / 4); // radians — works in both builds
    _m.rect(-1.5, -1.5, 3, 3);
  },
  rotate: 'natural',
  markerTip: false,
});
```

```js
// ✗ p5 build only — p5.Color and angleMode-aware rotate
brush.add('p5only', {
  type: 'custom',
  tip: (_m) => {
    _m.fill(color(30, 20, 10)); // p5.Color — standalone will break
    _m.rotate(45);              // degrees via angleMode — standalone always uses radians
    _m.rect(-2, -2, 4, 4);
  },
});
```

---

## Differences from the p5 build

| | p5 build | Standalone build |
|---|---|---|
| Canvas creation | `createCanvas(w, h, WEBGL)` | `brush.createCanvas(w, h)` |
| Loading an existing canvas | `brush.load(p5Graphics\|framebuffer)` for offscreen targets | `brush.load(htmlCanvas\|offscreenCanvas)` for external canvases |
| Compositing flush | Automatic | `brush.render()` required each frame |
| Clearing | `background()` | `brush.clear(color?)` |
| Transforms | p5's `push/pop`, `translate`, `rotate`, `scale` | `brush.push/pop`, `brush.translate`, `brush.rotate`, `brush.scale` |
| Angle mode | p5's `angleMode()` | `brush.angleMode(brush.DEGREES \| brush.RADIANS)` |
| Seeding | `randomSeed()` / `noiseSeed()` seed the library too | `brush.seed()` / `brush.noiseSeed()` |
| Instance mode | `brush.instance(p)` | Not applicable (`brush.instance()` is a no-op) |
| Framebuffer targets | Supported via `brush.load(framebuffer)` | Not supported |

---

## Full example

```js
import * as brush from './dist/brush.esm.js';

const W = 800, H = 600;

// Create and load the canvas in one call
brush.createCanvas(W, H, {
  parent: document.body,
  pixelDensity: window.devicePixelRatio,
});

brush.scaleBrushes(4);
brush.angleMode(brush.DEGREES);
brush.seed(42);

// Draw
brush.clear('#f5f0e0');
brush.push();
brush.translate(-W / 2, -H / 2);

brush.set('HB', '#1a2a3a', 1);
brush.line(80, 80, 720, 520);

brush.fill('#003c32', 110);
brush.fillBleed(0.2);
brush.noStroke();
brush.circle(W / 2, H / 2, 120);

brush.hatchStyle('HB', '#1a2a3a', 0.8);
brush.hatch(6, 45, { rand: 0.05 });
brush.noFill();
brush.rect(100, 100, 200, 160, 'corner');
brush.noHatch();

brush.pop();
brush.render(); // flush to canvas
```
