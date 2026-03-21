![Teaser](/images/p5brush.gif)

# p5.brush.js

p5.brush.js adds natural drawing tools to p5.js — pencils, charcoal, markers, watercolor fills, hatch patterns, and vector fields that bend strokes organically. It's built for generative art and high-resolution printing.

[Visit the library website here! (more examples soon)](https://p5-brush.cargo.site/)

> 🖌️ **[Try the interactive Brush Maker →](https://acamposuribe.github.io/p5.brush/tools/brush-maker.html)**  
> Design custom brushes with live preview and generate ready-to-paste `brush.add()` code.

> 🌊 **[Try the interactive Flow Field Generator →](https://acamposuribe.github.io/p5.brush/tools/flowfield-maker.html)**
> Design custom vector fields with live preview and generate ready-to-paste `brush.addField()` code.

> ▶️ **[Check the teaser live →](https://editor.p5js.org/acamposuribe/sketches/bkb_CyJyi)**
> Live on the p5.js Web Editor, where you can read and edit code.

## Two builds

p5.brush ships in two flavors:

| | p5 build | Standalone build |
|---|---|---|
| **File** | `dist/p5.brush.js` | `dist/brush.js` |
| **Requires** | p5.js 2.x + WEBGL canvas | Nothing — WebGL2 browser only |
| **Canvas setup** | `createCanvas(w, h, WEBGL)` | `brush.createCanvas(w, h)` |
| **Transforms** | p5's `push/pop`, `translate`, `rotate`, `scale` | `brush.push/pop`, `brush.translate`, etc. |
| **Angle mode** | Follows p5's `angleMode()` | `brush.angleMode(brush.DEGREES \| brush.RADIANS)` |
| **Seeding** | `randomSeed()` / `noiseSeed()` | `brush.seed()` / `brush.noiseSeed()` |
| **Frame flush** | Automatic | `brush.render()` at end of each frame |
| **Clear** | p5's `background()` | `brush.clear(color?)` |

This README covers the **p5 build**. For the standalone build see **[docs/standalone.md](docs/standalone.md)**.

---

## Table of Contents
- [Installation](#installation)
- [Features](#features)
- [Reference](#reference)
- [Examples](#examples)
- [Contributing](#contributing)
- [License](#license)
- [Acknowledgements](#acknowledgements)

## Installation

Important note: p5.brush requires p5.js 2.x or higher.

### Local Installation

To set up your project, add `p5.min.js` `p5.brush.js` to your HTML file. You can download the last version of the p5.brush.js library in the [dist](/dist) folder.
Place the script tags in the following order:

```html
<script src="path_to/p5.min.js"></script>
<script src="path_to/p5.brush.js"></script>
```
Replace path_to with the actual path to the script in your project directory or the URL if you are using a CDN.

### Use a hosted version of the p5.brush.js library 

Alternatively, you can link to a `p5.brush.js` file hosted online. All versions are stored in a CDN (Content Delivery Network). You can find a history of these versions in the p5.js CDN. In this case you can change the link to:

```html
<!-- Online version of p5.brush -->
<script src="https://cdn.jsdelivr.net/npm/p5.brush@latest"></script>
```

### Install with NPM and other modular-based apps

Install the npm package. p5.brush requires p5.js as a peer dependency.

```
npm install p5.brush --save
```

After that, import p5.brush functions to your sketch:

```
import * as brush from 'p5.brush'
```

If you are using p5 and p5.brush as modules, you will need to use instance mode. Read below.


### Note for p5 instance mode

In instance mode, p5 functions are scoped to a variable instead of the global namespace — useful when mixing with other libraries or using p5 as an ES module.

Call `brush.instance(p)` inside your sketch function before `setup` and `draw`. After that, all `brush.*` calls work normally without any `p.` prefix.

```javascript
const sketch = (p) => {
  // Tell p5.brush which p5 instance to use
  brush.instance(p);

  p.setup = () => {
    // Canvas must be in WEBGL mode — brush initializes automatically
    p.createCanvas(700, 410, p.WEBGL);
  };

  p.draw = () => {
    p.background(240);
    brush.set("HB", "#333", 1);
    brush.line(100, 100, 400, 300);
  };
};

new p5(sketch);
```

---

## Features

p5.brush.js enhances the p5.js framework with a set of tools that allow for sophisticated drawing and rendering techniques.

- **Custom Configuration**: Customize your drawing strokes with the ability to select different buffers and leverage a custom random number generator to introduce variability in procedural designs.
- **Vector Field Integration**: Direct the motion of your brush strokes with vector fields, crafting fluid, dynamic visuals within your sketches.
- **Dynamic Brush System**: Select from an array of brushes, each offering distinct characteristics, to create a variety of effects and textures.
- **Brush and Field Management**: Manage and switch between brushes and vector fields with ease, adapting to the needs of your project seamlessly.
- **Extensibility**: Expand the library's capabilities by integrating your own custom brushes and vector fields, tailoring the toolset to your artistic vision.
- **Custom Brush Tips**: Load and use your own custom brush tip assets.
- **Interactive Brush Tips**: Utilize pressure-sensitive brush tips for interactive drawing, adding a level of responsiveness to your canvas work.
- **Hatch Patterns**: Implement hatching techniques with precision control over the patterns' density and orientation, enhancing your artwork with automated detailing.
- **Intuitive Spline and Curve Generation**: Generate smooth and accurate curves and splines effortlessly, simplifying the process of intricate path creation.
- **Watercolor Fill System**: Achieve the subtle nuances of watercolor with a digital fill system designed to blend and diffuse colors in a naturally fluid way.

With p5.brush.js, your digital canvas becomes a playground for innovation and expression, where each tool is fine-tuned to complement your unique creative process.

.

## Reference

p5.brush.js provides a comprehensive API for creating complex drawings and effects. Below are the categorized functions and classes available in the library.

### Table of Functions

|      Section                               |      Functions      |   | Section                                    |      Functions      |
|--------------------------------------------|---------------------|---|--------------------------------------------|---------------------|
| [Utility](#utility-functions)              |                     |   | [Hatch Operations](#hatch-operations)      | brush.hatch()       |
|                                            |                     |   |                                            | brush.noHatch()     |
| [Vector-Fields](#vector-fields)            | brush.field()       |   |                                            | brush.hatchStyle()  |
|                                            | brush.noField()     |   | [Primitives](#primitives)                  | brush.line()        |
|                                            | brush.refreshField()|   |                                            | brush.flowLine()    |
|                                            | brush.listFields()  |   |                                            | brush.beginStroke() |
|                                            | brush.addField()    |   |                                            | brush.move()        |
|                                            | brush.wiggle()      |   |                                            | brush.endStroke()   |
| [Brush Management](#brush-management)      | brush.box()         |   |                                            | brush.spline()      |
|                                            | brush.add()         |   |                                            | brush.rect()        |
|                                            | brush.clip()        |   |                                            | brush.circle()      |
|                                            | brush.noClip()      |   |                                            | brush.arc()         |
| [Stroke Operations](#stroke-operations)    | brush.set()         |   |                                            | brush.beginShape()  |
|                                            | brush.pick()        |   |                                            | brush.vertex()      |
|                                            | brush.stroke()      |   |                                            | brush.endShape()    |
|                                            | brush.noStroke()    |   |                                            | brush.polygon()     |
|                                            | brush.strokeWeight()|   | [Configuration](#optional-configuration)   | brush.load()        |
| [Fill Operations](#fill-operations)        | brush.fill()        |   |                                            |      |
|                                            | brush.noFill()      |   |                                            | brush.scaleBrushes()|
|                                            | brush.wash()        |   |                                            | brush.instance()    |
|                                            | brush.noWash()      |   |                                            |                     |
|                                            | brush.fillBleed()   |   |                                            |                     |
|                                            | brush.fillTexture() |   |                                            |                     |
| [Hatch Operations](#hatch-operations)      | brush.mass()        |   | [Classes](#exposed-classes)                | brush.Polygon()     |
|                                            | brush.noMass()      |   |                                            | brush.Plot()        |
|                                            |                     |   |                                            | brush.Position()    |

---

<sub>[back to table](#table-of-functions)</sub>
### Utility Functions

---
 
> **Note for users upgrading from older versions**: `brush.push()`, `brush.pop()`, `brush.translate()`, `brush.rotate()`, and `brush.scale()` are no longer needed. The library now automatically hooks into p5's `push()` and `pop()`, so brush state (stroke, fill, hatch settings) is saved and restored alongside p5's own state. Likewise, p5's `translate()`, `rotate()`, and `scale()` are automatically inherited by all brush strokes and fills.

> Public brush APIs that accept angles also inherit p5's current `angleMode()`. With no `angleMode()` call, that means radians by default, matching p5 itself. The main exception is `brush.addField(name, fn, { angleMode })`, which lets custom field generators declare how returned angles should be interpreted before they are stored internally in degrees.

---

<sub>[back to table](#table-of-functions)</sub>
### Vector Fields

Vector Fields allow for dynamic control over brush stroke behavior, enabling the creation of complex and fluid motion within sketches.


 #### Basic vector-field functions

---
 
- `brush.field(name)`
  - **Description**: Activates a named vector field. When a vector field is active, it influences the flow and direction of the brush strokes for shapes drawn thereafter. It is important to note that certain shapes may be exempt from this influence; such exceptions will be clearly documented in the API for each specific geometry.
  - **Parameters**:
    - `name` (String): The identifier for the vector field to be activated. This can be a name of one of the predefined fields or a custom field created with `brush.addField()`.
  - **Default Fields**: The library comes with a set of built-in vector fields: `hand`, `curved`, `zigzag`, `waves`, `seabed`, `spiral`, and `columns`. These, as well as any custom fields added, can be activated using this function.
  - **Usage**:
    ```javascript
    // To activate the "waves" vector field
    brush.field("waves");

    // To activate a custom vector field named "myCustomField"
    brush.field("myCustomField");
    ```
    Once a vector field is activated, it affects how the subsequent shapes are drawn, aligning them with its directional flow, unless stated otherwise in the documentation

---

- `brush.noField()`
  - **Description**: Deactivate the currently active vector field, returning the drawing behavior to its default state where shapes are not influenced by any vector field.
  - **Usage**:
    ```javascript
    brush.noField();
    ```

---

- `brush.wiggle(wiggle)`
  - **Description**: Activate the built-in `"hand"` vector field with a given wiggle intensity. A shorthand for adding a subtle hand-drawn wobble to strokes without calling `brush.field("hand")` directly.
  - **Parameters**:
    - `wiggle` (Number): Intensity of the wobble, e.g. 1–10.
  - **Usage**:
    ```javascript
    brush.wiggle(3);
    ```

---

- `brush.refreshField(time)`
  - **Description**: Updates the current vector field values using its time-dependent generator function. Ideal for animations that require the vector field to change over time, influencing the movement of strokes and shapes in a natural way.
  - **Parameters**:
    - `time` (Number): The time input for the vector field generator function, typically related to the frame count.
  - **Usage**:
    ```javascript
    // In the draw loop, refresh the vector field based on the frame count
    function draw() {
      brush.refreshField(frameCount / 10);
      // Additional drawing code
    }
    ```
    This function will invoke the generator function of the active vector field with the provided time argument, allowing the field to evolve and create fluid, dynamic animations in the rendering.

---

- `brush.listFields()`
  - **Description**: Retrieve an array containing the names of all available vector fields, including built-in fields and any custom fields added with `brush.addField()`.
  - **Returns**: `Array<string>` - An array of vector field names.
  - **Usage**:
    ```javascript
    let fieldNames = brush.listFields();
    for (let name of fieldNames) {
      console.log(name);
    }
    ```

---
 
 #### Advanced vector-field functions

---

- `brush.addField(name, generatorFunction, options)`
  - **Description**: Creates your own custom vector field. A vector field is just a grid of angles — each cell tells the brush "point in this direction". You give the field a name and a function that fills the grid. Once added, activate it with `brush.field(name)` just like any built-in field.
  - **Parameters**:
    - `name` (String): Any name you want, e.g. `"myField"`.
    - `generatorFunction` (Function): A function `(t, field) => field` that fills every cell of the grid with an angle and returns it. `t` is a time value you can use for animation (pass it via `brush.refreshField(t)`).
    - `options` (Object): Optional configuration for custom field angles.
      - `angleMode`: `"degrees"` (default) or `"radians"`. This controls how the values written into `field[column][row]` are interpreted.
  - **How the grid works**: `field` is a 2D array — `field[column][row]`. You loop through every column and row and set each cell to an angle. By default those angles are interpreted as degrees. Small angles (±10°) make subtle curves; large ones (±90° or more) make dramatic bends.
  - **Simplest example** — a diagonal flow that slowly rotates over time:
    ```javascript
    brush.addField("diagonal", function(t, field) {
        for (let col = 0; col < field.length; col++) {
            for (let row = 0; row < field[0].length; row++) {
                field[col][row] = 45 + t * 10; // 45° angle, changes with time
            }
        }
        return field; // always return field at the end!
    });

    brush.field("diagonal"); // activate it
    ```
  - **Tip**: You don't have to use `t` at all if you don't need animation. Just fill the grid and return it.


---

<sub>[back to table](#table-of-functions)</sub>
### Brush Management

Functions for managing brush behaviors and properties.

---

- `brush.box()`
  - **Description**: Retrieves an array containing the unique names of all available brushes. This function is useful for accessing the variety of brushes included in the library, which range from different pencil types to markers and specialized brushes like the hatch brush. Of course, the function will also return the custom brushes you've created.
  - **Returns**: `Array<string>` - An array listing the names of all brushes.
  - **Default Brushes**: The library includes a default set of 11 brushes: `2B`, `HB`, `2H`, `cpencil`, `pen`, `rotring`, `spray`, `marker`, `marker2`, `charcoal`, and `hatch_brush` (for clean hatching).
  - **Usage**:
    ```javascript
    // Retrieve a list of all available brush names
    let brushes = brush.box();
    console.log(brushes); // Logs the array of brush names
    ```
    `brush.box()` allows you to explore and select from the various brushes, facilitating the choice of the appropriate brush for different artistic needs.

---

- `brush.add(name, params)` — **[Design your brush visually with the Brush Maker ↗](https://acamposuribe.github.io/p5.brush/tools/brush-maker.html)**
  - **Description**: Creates a new brush with your own settings. Once added, you use it just like any built-in brush with `brush.set("myBrush", color, size)`.
  - **Parameters**:
    - `name` (String): A name for your brush — pick anything you like.
    - `params` (Object): An object with the brush settings:
      - `type`: The kind of brush tip. Choose one: `"default"` (pencil-like), `"spray"` (scattered dots), `"marker"` (flat solid), `"custom"` (you draw the tip shape), `"image"` (use a photo as the tip).
      - `weight`: How thick the brush is, in canvas units.
      - `scatter`: How much the stroke wobbles sideways. Higher = more spread. (in canvas units)
      - `sharpness`: A number from 0 to 1. Lower = softer/fuzzier edge. Only matters for `"default"` type.
      - `grain`: Controls how dense the texture is. Higher = smoother, more continuous line. Only matters for `"default"` and `"spray"` types.
      - `opacity`: How opaque each mark is, from 0 to 255. Pressure also affects this.
      - `spacing`: Gap between brush tip stamps along the stroke. `1` means no overlap, lower values create denser strokes.
      - `pressure`: Controls how the brush size changes from start to end of a stroke. Use a simple array — the easiest way:
         - `[start, end]` — e.g. `[2, 0.5]` starts thick and gets thin.
         - `[start, middle, end]` — e.g. `[0.5, 2, 0.5]` starts thin, swells in the middle, ends thin.
         - Or a function `(t) => value` where `t` goes from 0 (start) to 1 (end), for full control.
         - These simple/custom pressure modes include a subtle amount of per-stroke variation automatically, so repeated strokes feel less mechanical.
         - Advanced option for power users: use the library's built-in Gaussian pressure profile explicitly with an object like `{ mode: "gaussian", curve: [0.15, 0.2], min_max: [1.1, 0.9] }`.
           `curve` adjusts the wobble and asymmetry of the pressure envelope, while `min_max` sets the mapped pressure range. This is the same family of pressure logic used by the built-in brushes.
      - `tip`: Only for `"custom"` type. A function that draws the tip shape — see **Custom tip brushes** note below.
      - `image`: Only for `"image"` type. An object with a `src` property pointing to your image file: `{ src: "./tip.jpg" }`.
      - `rotate`: How the tip rotates as it moves. `"none"` keeps it fixed, `"natural"` follows the stroke direction, `"random"` spins randomly.
      - `markerTip`: Only for `"marker"`, `"custom"`, and `"image"` types. Set to `false` to disable the extra soft tip buildup those brushes add at the start and end of each stroke. Defaults to `true`.
      - `noise`: Controls per-stroke opacity variation. Each time a stroke is drawn, the brush samples a Gaussian to randomly shift the whole stroke slightly lighter or darker than its base alpha — giving repeated strokes an organic, non-mechanical feel. `0` disables the variation (every stroke is identical in opacity). `1` is the maximum variation. Defaults to `0.3`.
  - **Usage**:
    ```javascript
    // Image brush — use a photo as the brush tip.
    // IMPORTANT: use "await" so the image loads before drawing,
    // and make sure your setup() function is declared "async"!
    async function setup() {
        createCanvas(800, 800, WEBGL);
        brush.load();

        await brush.add("watercolor", {
            type: "image",
            weight: 10,
            scatter: 2,
            opacity: 30,
            spacing: 1.5,
            pressure: [1, 0.5],   // starts thick, ends thin
            image: { src: "./brush_tips/brush.jpg" },
            rotate: "random",
            markerTip: false,
        });

        // Now you can draw with it!
        brush.set("watercolor", "blue", 1);
        brush.line(100, 100, 400, 100);
    }

    // Advanced: explicitly use the built-in Gaussian pressure mode
    brush.add("soft-pencil", {
        type: "default",
        weight: 0.3,
        scatter: 0.6,
        sharpness: 0.3,
        grain: 10,
        opacity: 170,
        spacing: 0.1,
        pressure: {
            mode: "gaussian",
            curve: [0.15, 0.2],
            min_max: [1.1, 0.9],
        },
        rotate: "none",
    });
    ```
    **Image brushes only**: `brush.add()` returns a Promise when `type` is `"image"` — you must `await` it so the image finishes loading before you start drawing. For this to work, your `setup()` function must be declared `async`. For all other brush types, no `await` is needed.

    **Custom tip brushes**: The `tip` function receives `_m`, a `p5.Graphics` buffer. You draw inside it using normal p5 commands. The coordinate space is **100×100 units with the origin at the centre**, so shapes are drawn around `(0, 0)` and edges fall around ±50 units. The library converts the result to a mask: **dark fills become opaque, light or white becomes transparent** — so you define the shape in dark tones, and the color from `brush.set()` or `brush.stroke()` is applied at render time. Any p5 drawing command works: `rect`, `circle`, `ellipse`, `line`, `triangle`, `beginShape`/`vertex`/`endShape`, `push`/`pop`, `translate`, `rotate`, `scale`, and so on.
    ```javascript
    brush.add("diamond", {
        type: "custom",
        weight: 5,
        scatter: 0.08,
        opacity: 23,
        spacing: 0.6,
        pressure: [0.5, 1.5, 0.5],   // thin → thick → thin
        tip: (_m) => {
            _m.rotate(45);            // degrees, follows p5 angleMode
            _m.rect(-1.5, -1.5, 3, 3);
        },
        rotate: "natural",
        markerTip: false,
    });
    ```
    **Using the standalone build?** The `tip` function works differently there — `_m` is not a `p5.Graphics`. See [docs/standalone.md → Custom tip brushes](docs/standalone.md#custom-tip-brushes).

---

- `brush.clip(clippingRegion)`
  - **Description**: Sets a rectangular clipping region for all subsequent brush strokes. When this clipping region is active, brush strokes outside this area will not be rendered. This is particularly useful for ensuring that strokes, such as lines and curves, are contained within a specified area. The clipping affects only stroke and hatch operations, not fill operations. The region is interpreted in the same coordinate space as your brush drawing calls, with the current p5 transform captured when `brush.clip()` is called. The clipping remains in effect for all strokes drawn after the call to `brush.clip()` until `brush.noClip()` is used.
  - **Parameters**:
    - `clippingRegion` (Array): An array defining the clipping region as `[x1, y1, x2, y2]`, with `(x1, y1)` and `(x2, y2)` being the corners of the clipping rectangle.
  - **Usage**:
    ```javascript
    // Set a clipping region
    brush.clip([10, 10, 250, 200]);
    // Draw a line - it will be clipped according to the region
    brush.line(100, 90, 300, 40);

    // Remove the clipping region
    brush.noClip();
    // Draw another line - it will not be clipped
    brush.line(0, 0, 200, 300);
    ```

---

- `brush.noClip()`
  - **Description**: Disables the current clipping region, allowing subsequent brush strokes to be drawn across the entire canvas without being clipped. Use this function to revert to the default state where strokes are unrestricted.
  - **Usage**:
    ```javascript
    // Disable the clipping region
    brush.noClip();
    ```

---

<sub>[back to table](#table-of-functions)</sub>
### Stroke Operations

Stroke Operations encompass methods for manipulating and applying brushes to strokes (aka lines), providing artists with precise control over their brushwork.

---

- `brush.set(brushName, color, weight)`
  - **Description**: Selects and sets up the current brush with a specific name, color, and weight. This function is crucial for preparing the brush to draw strokes with the desired characteristics.
  - **Parameters**:
    - `brushName` (String): The name of the brush to be used.
    - `color` (String|p5.Color): The color for the brush, which can be specified as a HEX string or a p5.Color object.
    - `weight` (Number): The weight or size of the brush.
  - **Note**: This function will automatically activate stroke mode for subsequent geometries.
  - **Usage**:
    ```javascript
    // Set the "HB" brush with a specific blue color and weight factor 1
    brush.set("HB", "#002185", 1);
    ```
    By using `brush.set()`, you can quickly switch between different brushes, colors, and sizes, allowing for dynamic and varied stroke applications in your artwork.

---

 - `brush.pick(brushName)`
   - **Description**: Selects the current brush type based on the specified name. This function is used to change the brush type without altering its color or weight.
   - **Parameters**:
     - `brushName` (String): The name of the brush to set as current.
   - **Usage**:
    ```javascript
    // Set the current brush to "charcoal"
    brush.pick("charcoal");
    ```
    Use `brush.pick()` to switch between different brush types while maintaining the current color and weight settings.

---

- `brush.stroke(r, g, b)` or `brush.stroke(color)`
  - **Description**: Sets the color of the current brush. This function can take either RGB color components or a CSS color string/p5.Color object. It also activates stroke mode for subsequent shapes.
  - **Parameters**:
    - `r` (Number|String|p5.Color): The red component of the color, a CSS color string, or a p5.Color object.
    - `g` (Number): Optional. The green component of the color.
    - `b` (Number): Optional. The blue component of the color.
  - **Usage**:
    ```javascript
    // Set the brush color using RGB values
    brush.stroke(105, 111, 34);
    // Or set the brush color using a HEX string
    brush.stroke("#002185");
    ```
    Use `brush.stroke()` to define the color of your brush strokes, enabling a diverse palette for your artwork.

---

- `brush.noStroke()`
  - **Description**: Disables the stroke for subsequent drawing operations. This function is useful when you want to draw shapes without an outline.
  - **Usage**:
    ```javascript
    // Disable stroke for the upcoming shapes
    brush.noStroke();
    ```
    `brush.noStroke()` is essential for creating drawings where only fill and no outline is desired.

---

- `brush.strokeWeight(weight)`
  - **Description**: Sets the weight or size of the current brush. The specified weight acts as a multiplier to the base size of the brush, allowing for dynamic adjustments.
  - **Parameters**:
    - `weight` (Number): The weight to set for the brush.
  - **Returns**: None.
  - **Usage**:
    ```javascript
    // Set the brush stroke weight to 2.3 times the base size
    brush.strokeWeight(2.3);
    ```
    `brush.strokeWeight()` provides the flexibility to easily adjust the thickness of your brush strokes, enhancing the expressiveness of your drawing tools.

---

<sub>[back to table](#table-of-functions)</sub>
### Fill Operations

The Fill Management section focuses on managing fill properties for shapes, enabling complex fill operations with effects like bleeding to simulate watercolor-like textures. These methods set fill colors with opacity, control bleed intensity, and manage fill operations. The watercolor fill effect is inspired by Tyler Hobbs' generative art techniques.

---

- `brush.fill(a, b, c, d)` or `brush.fill(color, opacity)`
  - **Description**: Sets the fill color and opacity for subsequent shapes, activating fill mode. This function can accept either RGB color components with opacity or a CSS color string/p5.Color object with an optional opacity.
  - **Parameters**:
    - `a` (Number|String|p5.Color): The red component of the color or grayscale value, a CSS color string, or a p5.Color object.
    - `b` (Number): Optional. The green component of the color or grayscale opacity if two arguments are used.
    - `c` (Number): Optional. The blue component of the color.
    - `d` (Number): Optional. The opacity of the color, 0 - 255.
  - **Usage**:
    ```javascript
    // Set the fill color using RGB values and opacity
    brush.fill(244, 15, 24, 75);
    // Or set the fill color using a HEX string and opacity
    brush.fill("#002185", 110);
    ```
    `brush.fill()` allows for detailed control over the color and transparency of the fill.

---

- `brush.noFill()`
  - **Description**: Disables the fill for subsequent drawing operations. Useful for creating shapes or lines without a fill.
  - **Usage**:
    ```javascript
    // Disable fill for the upcoming shapes
    brush.noFill();
    ```

---

- `brush.wash(color, opacity)`
  - **Description**: Enables a fast solid fill pass for subsequent shapes. Unlike `fill()`, `wash()` does not simulate watercolor bleed or texture; it draws a direct flat color with the given opacity.
  - **Parameters**:
    - `color` (String|p5.Color): The wash color.
    - `opacity` (Number): Opacity from 0 to 255.
  - **Usage**:
    ```javascript
    brush.wash("#f7e4a0", 255);
    brush.circle(width / 2, height / 2, 180);
    brush.noWash();
    ```

---

- `brush.noWash()`
  - **Description**: Disables wash mode for subsequent geometry.
  - **Usage**:
    ```javascript
    brush.noWash();
    ```

---

- `brush.fillBleed(strength, direction)`
  - **Description**: Adjust the bleed intensity for the fill operation, mimicking the edge diffusion of watercolor paints.
  - **Parameters**:
    - `strength` (Number): The intensity of the bleed effect, ranging from 0 to 1.
    - `direction` (String): Optional. `"out"` or `"in"`. Defines the direction of the bleed effect.
    - `_borderIntensity` (Number): The intensity of the border watercolor effect, ranging from 0 to 1.
  - **Usage**:
    ```javascript
    brush.fillBleed(0.3, "out");
    ```

---

- `brush.fillTexture(textureStrength, borderIntensity)`
  - **Description**: Adjusts the texture levels for the fill operation, mimicking the behavior of watercolor paints. This function adds a natural and organic feel to digital artwork.
  - **Parameters**:
    - `textureStrength` (Number): The texture of the fill effect, ranging from 0 to 1.
    - `borderIntensity` (Number): The intensity of the border watercolor effect, ranging from 0 to 1.
  - **Usage**:
    ```javascript
    // Set the fill texture and border intensity
    brush.fillTexture(0.6, 0.4);
    ```

---

---

<sub>[back to table](#table-of-functions)</sub>
### Hatch Operations

The Hatching section focuses on creating and drawing hatching patterns, which involves drawing closely spaced parallel lines. These functions offer control over the hatching style and application.

---

- `brush.hatch(dist, angle, options)`
  - **Description**: Activates hatching with specified parameters for subsequent geometries. This function enables the drawing of hatching patterns with controlled line spacing, angle, and additional stylistic options.
  - **Parameters**:
    - `dist` (Number): The distance between hatching lines, in canvas units.
    - `angle` (Number): The angle at which hatching lines are drawn. It is interpreted using p5's current `angleMode()` when `brush.hatch()` is called.
    - `options` (Object): Optional settings to affect the hatching style, including:
      - `rand`: Randomness in line placement (0 to 1 or false).
      - `continuous`: Whether to connect the end of a line with the start of the next.
      - `gradient`: Modifies the distance between lines to create a gradient effect (0 to 1 or false).
      - Defaults to `{rand: false, continuous: false, gradient: false}`.
  - **Usage**:
    ```javascript
    // Set hatching with specific distance, angle, and options
    brush.hatch(5, 30, {rand: 0.1, continuous: true, gradient: 0.3});
    ```

---

- `brush.noHatch()`
  - **Description**: Disables hatching for subsequent shapes. Use this function to return to normal drawing modes without hatching.
  - **Usage**:
    ```javascript
    // Disable hatching for upcoming shapes
    brush.noHatch();
    ```

---

- `brush.hatchStyle(brushName, color, weight)`
  - **Description**: Set the brush type, color, and weight specifically for hatching. If not called, hatching will use the parameters defined by the current stroke settings.
  - **Parameters**:
    - `brushName` (String): The name of the brush to use for hatching.
    - `color` (String|p5.Color): The color for the brush, either as a CSS string or a p5.Color object.
    - `weight` (Number): The weight or size of the brush for hatching.
  - **Usage**:
    ```javascript
    brush.hatchStyle("rotring", "green", 1.3);
    ```

---

- `brush.mass(brushName, color, options)`
  - **Description**: Enables massing for subsequent shapes. Massing builds layered hand-filled value using internally generated hatch geometry and curved gestures rather than explicit watercolor fills.
  - **Parameters**:
    - `brushName` (String): Brush used for the mass strokes.
    - `color` (String|p5.Color): Color of the mass.
    - `options` (Object): Optional settings:
      - `precision`: `0` to `1`. Higher values reduce jitter and randomness.
      - `strength`: `0` to `1`. Controls how many of the three internal layers are drawn.
      - `gradient`: `0` to `1`. Passed through to hatch generation for spacing variation.
      - `outline`: `true` or `false`. If true, the first polygon is also outlined.
  - **Usage**:
    ```javascript
    brush.mass("pastel", "#4b6cb7", {
      precision: 0.55,
      strength: 0.9,
      gradient: 0.35,
      outline: true,
    });
    brush.circle(width / 2, height / 2, 180);
    ```

---

- `brush.noMass()`
  - **Description**: Disables massing for subsequent geometry.
  - **Usage**:
    ```javascript
    brush.noMass();
    ```

---
In essence, the hatching system activates hatches for subsequent shapes, similarly to stroke and fill operations. However, you can also directly hatch multiple objects at once (and their intersections), if you proceed as described below
.

- `brush.hatchArray(polygons)`
  - **Description**: Creates a hatching pattern across specified polygons. This function applies the set hatching parameters to a single polygon or an array of polygons.
  - **Parameters**:
    - `polygons` (Array|Object): The polygon(s) to apply the hatching. Can be a single polygon object or an array of polygon objects.
  - **Note**: This is not the main, but an alternative way of applying hatches. Read above.
  - **Usage**:
    ```javascript
    // Define an array of polygons (reference in the classes section)
    let myPolygons = []
    for (let i = 0; i < 10; i++) {
       // We're creating 10 random triangles here
    			let p = new brush.Polygon([
          [random(width), random(height)],
          [random(width), random(height)],
          [random(width), random(height)],  
       ])
       myPolygons.push(p)
    }
    // Create hatching across specified polygons
    brush.hatchArray(myPolygons);
    ```
    `brush.hatchArray()` provides an efficient way to apply complex hatching patterns to a set of defined shapes.


---

<sub>[back to table](#table-of-functions)</sub>
### Primitives

This section details the functions for creating various shapes and strokes with the set brush, fill, and hatch parameters.

#### Lines, Strokes, Splines, and Plots

The following functions are only affected by stroke() operations, completely ignoring fill() and hatch().

---

- `brush.line(x1, y1, x2, y2)`
  - **Description**: Draws a line from one point to another using the current brush settings. This function is affected only by stroke operations and will not produce any drawing if `noStroke()` has been called.
  - **Parameters**:
    - `x1` (Number): The x-coordinate of the start point.
    - `y1` (Number): The y-coordinate of the start point.
    - `x2` (Number): The x-coordinate of the end point.
    - `y2` (Number): The y-coordinate of the end point.
  - **Usage**:
    ```javascript
    // Set the brush color and draw a line
    brush.stroke("red");
    brush.line(15, 10, 200, 10);
    ```

---

- `brush.flowLine(x, y, length, dir)`
  - **Description**: Draws a flow line that adheres to the currently selected vector field. Flow lines are defined by a starting point, length, and direction. They are useful for creating strokes that dynamically follow the flow of the vector field.
  - **Parameters**:
    - `x` (Number): The x-coordinate of the starting point.
    - `y` (Number): The y-coordinate of the starting point.
    - `length` (Number): The length of the line.
    - `dir` (Number): The direction in which to draw the line, measured anticlockwise from the x-axis and interpreted using the current p5 `angleMode()`.
  - **Usage**:
    ```javascript
    // Set a vector field and draw a flow line
    brush.field("seabed");
    brush.flowLine(15, 10, 185, 0);
    ```

---

These three functions provide advanced control over the creation of strokes/paths, allowing for custom pressure and direction at different points along the path. Think of them as bodily movements performed with the hands. You can create two types of strokes: `"curve"` or `"segments"`. For curved strokes, the curvature at any point is interpolated between the nearest control points.

These functions allow for the creation of strokes with varied pressures and directions, mimicking the organic nature of hand-drawn strokes. For an application of these principles, see: [Enfantines II](https://art.arqtistic.com/Enfantines-2)

- `brush.beginStroke(type, x, y)`
  - **Description**: Initializes a new stroke, setting the type and starting position. The type determines the kind of Plot to create, either a "curve" or "segments".
  - **Parameters**:
    - `type` (String): The type of the stroke, either "curve" or "segments".
    - `x` (Number): The x-coordinate of the starting point of the stroke.
    - `y` (Number): The y-coordinate of the starting point of the stroke.
  - **Usage**:
    ```javascript
    // Begin a new curve stroke
    brush.beginStroke("curve", 15, 30);
    ```

- `brush.move(angle, length, pressure)`
  - **Description**: Add a segment to the stroke, defining its path by specifying the angle, length, and pressure. Use between `brush.beginStroke()` and `brush.endStroke()` to outline the stroke's trajectory and characteristics.
  - **Parameters**:
    - `angle` (Number): The initial angle of the segment, relative to the canvas, measured anticlockwise from the x-axis.
    - `length` (Number): The length of the segment.
    - `pressure` (Number): The pressure at the start of the segment, influencing properties like width.
  - **Usage**:
    ```javascript
    brush.move(30, 150, 0.6);
    brush.move(75, 40, 1.1);
    ```

- `brush.endStroke(angle, pressure)`
  - **Description**: Completes the stroke path and triggers its rendering. This function defines the angle and pressure at the last point of the stroke path.
  - **Parameters**:
    - `angle` (Number): The angle of the curve at the end point of the stroke path.
    - `pressure` (Number): The pressure at the end of the stroke.
  - **Usage**:
    ```javascript
    // Complete the stroke with a specific angle and pressure
    brush.endStroke(-45, 0.8);
    ```

---

- `brush.spline(array_points, curvature)`
  - **Description**: Draw a spline curve through a series of control points. The curve connects the start and end points directly, using intermediate points to shape the path. These splines are segmented paths with rounded corners.
  - **Parameters**:
    - `array_points` (Array<Array<number>>): An array of points, where each point is `[x, y]` or `[x, y, pressure]`. The optional pressure value at each point influences brush width along the curve.
    - `curvature` (Number): Optional. The curvature of the spline, ranging from 0 to 1. A value of 0 produces straight segments.
  - **Note**: This is a simplified alternative to beginShape() - endShape() operations, useful for certain stroke() applications.
  - **Usage**:
    ```javascript
    let points = [[30, 70], [85, 20, 1.5], [130, 100], [180, 50]];
    brush.spline(points, 0.5);
    ```

---

#### Shapes and Polygons

The following functions are affected by stroke(), fill() and hatch() operations.

---

- `brush.rect(x, y, w, h, mode)`
  - **Description**: Draw a rectangle on the canvas using the current stroke, fill, and hatch settings. Rectangles are influenced by active vector fields.
  - **Parameters**:
    - `x` (Number): The x-coordinate of the rectangle.
    - `y` (Number): The y-coordinate of the rectangle.
    - `w` (Number): The width of the rectangle.
    - `h` (Number): The height of the rectangle.
    - `mode` (String): Optional. `"corner"` (default) positions `(x, y)` at the top-left corner. `"center"` draws the rectangle centered at `(x, y)`.
  - **Usage**:
    ```javascript
    brush.noStroke();
    brush.noHatch();
    brush.fill("#002185", 75);
    brush.rect(150, 100, 50, 35, "center");
    ```

---

- `brush.circle(x, y, radius, r)`
  - **Description**: Draw a circle using the current stroke, fill, and hatch settings. Circles are affected by vector fields, so their outlines follow the active field just like other field-aware shapes.
  - **Parameters**:
    - `x` (Number): The x-coordinate of the circle's center.
    - `y` (Number): The y-coordinate of the circle's center.
    - `radius` (Number): The radius of the circle.
    - `r` (Number|Boolean): Optional. Hand-drawn irregularity amount. Values around `0` to `1` give subtle variation; `true` behaves like a strong irregularity.
  - **Usage**:
    ```javascript
    brush.circle(100, 150, 75, true);
    ```

---

- `brush.arc(x, y, radius, start, end)`
  - **Description**: Draw an arc (partial circle) using the current brush settings. The arc is drawn as a stroke only — `fill()` is not applied.
  - **Parameters**:
    - `x` (Number): The x-coordinate of the center.
    - `y` (Number): The y-coordinate of the center.
    - `radius` (Number): The radius of the arc.
    - `start` (Number): Start angle interpreted using the current p5 `angleMode()`.
    - `end` (Number): End angle interpreted using the current p5 `angleMode()`.
  - **Usage**:
    ```javascript
    brush.arc(200, 200, 50, 0, Math.PI);
    ```

---

These three functions perform similarly to the p5.js beginShape(), vertex(), and endShape() functions, althouh curvature calculation is very different. These allow you to draw custom shapes, with fine control over brush pressure at the different points of the perimeter.

- `brush.beginShape(curvature)`
  - **Description**: Initiates the creation of a custom shape by starting to record vertices. An optional curvature can be defined for the vertices.
  - **Parameters**:
    - `curvature` (Number): Optional. A value from 0 to 1 that defines the curvature of the shape's edges.
  - **Returns**: None.
  - **Usage**:
    ```javascript
    // Begin defining a custom shape with a specified curvature
    brush.beginShape(0.3);
    ```

- `brush.vertex(x, y, pressure)`
  - **Description**: Adds a vertex to the custom shape currently being defined. The function is used between `brush.beginShape()` and `brush.endShape()` calls. An optional pressure parameter can be applied at each vertex.
  - **Parameters**:
    - `x` (Number): The x-coordinate of the vertex.
    - `y` (Number): The y-coordinate of the vertex.
    - `pressure` (Number): Optional. The pressure at the vertex, affecting properties like width.
  - **Returns**: None.
  - **Usage**:
    ```javascript
    // Add vertices to the custom shape
    brush.vertex(50, 100);
    brush.vertex(100, 150, 0.5);
    brush.vertex(150, 100);
    ```

- `brush.endShape(a)`
  - **Description**: Complete the custom shape, finalizing the recording of vertices, and render it with the current stroke, fill, and hatch settings.
  - **Parameters**:
    - `a` (Boolean): Optional. Pass `true` to close the shape (connect the last vertex back to the first). Pass `false` or omit to leave the shape open.
  - **Returns**: None.
  - **Usage**:
    ```javascript
    // Finish the custom shape and close it
    brush.endShape(true);
    // Or leave it open
    brush.endShape(false);
    ```

---

- `brush.polygon(pointsArray)`
  - **Description**: Creates and draws a polygon based on a provided array of points. This function is useful for drawing shapes that are not affected by vector fields, offering an alternative to the `beginShape()` and `endShape()` approach.
  - **Parameters**:
    - `pointsArray` (Array): An array of points, where each point is an array of two numbers `[x, y]`.
  - **Note**: This is a simplified alternative to beginShape() - endShape() operations, useful for certain fill() and hatch() applications.
  - **Usage**:
    ```javascript
    // Define a polygon using an array of points
    let points = [[x1, y1], [x2, y2], ...];
    brush.polygon(points);
    ```
    `brush.polygon()` is ideal for drawing fixed shapes that remain unaffected by vector fields, providing precise control over their form and appearance.


---

<sub>[back to table](#table-of-functions)</sub>
### Optional: Configuration

This section covers functions for initializing the drawing system and configuring system behavior. By default, the library works without executing these functions, but you might want to configure them to your liking.

> **Seeding**: p5.brush automatically hooks into p5's `randomSeed()` and `noiseSeed()`. Calling either of those functions seeds both p5 and the library simultaneously — no separate `brush.seed()` call is needed.

- `brush.load(buffer)`
  - **Description**: Redirects brush drawing to a secondary canvas target. **Not needed for the main canvas** — the library initializes automatically when `createCanvas()` is called. Pass a `p5.Graphics` buffer or an active `p5.Framebuffer` to draw into that target instead; call `brush.load()` with no argument to switch back to the main canvas. Framebuffers created from `p5.Graphics` are not supported.
  - **Parameters**:
    - `buffer` (p5.Graphics | p5.Framebuffer): Optional. An offscreen target to draw into.
  - **How to use it**:
    - `p5.Graphics`: create it with `WEBGL`, call `brush.load(pg)`, draw with brush functions, then call `brush.load()` to restore the main canvas before presenting it with `image(pg, ...)`.
    - `p5.Framebuffer`: create it from the main sketch with `createFramebuffer(...)`, enter its `draw()` or `begin()` / `end()` scope, call `brush.load(fb)` while it is active, draw with brush functions, then call `brush.load()` again after leaving the framebuffer scope.
    - `brush.load(...)` only changes the target used by p5.brush. If you also use native p5 drawing calls, call them on the same target yourself, for example `pg.background(...)` for `p5.Graphics`.
    - `pg.createFramebuffer()` is not supported.
  - **Example (draw into a buffer)**:
    ```javascript
    function setup() {
      createCanvas(400, 400, WEBGL);
      brush.load();
      brush.set("HB", "black", 1);
      brush.rect(40, 40, 150, 100);

      // Switch to a buffer
      let buffer = createGraphics(200, 300, WEBGL);
      brush.load(buffer);
      brush.set("HB", "black", 1);
      brush.rect(40, 40, 150, 100);
      image(buffer, 20, 40);

      // Switch back to main canvas
      brush.load();
    }
    ```
  - **Example (draw into a framebuffer)**:
    ```javascript
    function setup() {
      createCanvas(400, 400, WEBGL);
      brush.load();

      const layer = createFramebuffer({ width: 200, height: 200 });

      layer.draw(() => {
        brush.load(layer);
        brush.set("HB", "black", 1);
        brush.circle(100, 100, 80);
      });

      brush.load();
      image(layer, 20, 20);
    }
    ```

  - **Typical workflows**:
    ```javascript
    // p5.Graphics
    const pg = createGraphics(300, 200, WEBGL);
    pg.background(250);
    brush.load(pg);
    brush.set("HB", "black", 1);
    brush.circle(150, 100, 70);
    brush.load();
    image(pg, 20, 20);

    // p5.Framebuffer
    const fb = createFramebuffer({ width: 300, height: 200 });
    fb.draw(() => {
      background(250);
      brush.load(fb);
      brush.set("HB", "black", 1);
      brush.circle(150, 100, 70);
    });
    brush.load();
    image(fb, 20, 240);
    ```

---

- `brush.scaleBrushes(scale)`
  - **Description**: Adjusts the global scale of all currently registered brush parameters, including weight, scatter, and spacing, based on the given scaling factor.
  - **Parameters**:
    - `scale` (Number): The scaling factor to be applied to the brush parameters.
  - **Note**: In practice, using `brush.scaleBrushes()` is usually necessary to adapt the built-in brushes to your canvas size. For a `600x600` canvas, `brush.scaleBrushes(3)` is a good starting point, but the final value should still be confirmed visually. This affects the brushes that already exist when you call it. If you only want the built-in brushes scaled, call it before adding custom brushes. If you add custom brushes later, call `brush.scaleBrushes()` again to scale them too.
  - **Usage**:
    ```javascript
    // Good starting point for a 600x600 canvas
    brush.scaleBrushes(3);
    ```
    Using `brush.scaleBrushes()`, you can easily adjust the size and spacing characteristics of brushes in your project, providing a convenient way to adapt to different canvas sizes or artistic styles.
    
---

- `brush.instance(p)`
  - **Description**: Call this inside your sketch function before `setup` and `draw` when using p5 in instance mode. Tells p5.brush which p5 instance to render into. After calling this, all `brush.*` functions work normally — no need to prefix them with `p.`.
  - **Parameters**:
    - `p` (p5): The p5 instance passed as the argument to your sketch function.
  - **Example**:
      ```javascript
      const sketch = (p) => {
        // Must be called before setup/draw
        brush.instance(p);

        p.setup = () => {
          // Canvas must be WEBGL
          p.createCanvas(700, 410, p.WEBGL);
          brush.load();
        };

        p.draw = () => {
          p.background(240);
          brush.set("HB", "#333", 1);
          brush.line(100, 100, 400, 300);
        };
      };

      new p5(sketch);
      ```

---

<sub>[back to table](#table-of-functions)</sub>
### Exposed Classes

Exposed Classes provide foundational elements for creating and manipulating shapes and paths, as well as interacting with vector-fields in a more advanced manner.

---

#### Class: `brush.Polygon`

- **Description**: Represents a polygon defined by a set of vertices. The `Polygon` class is essential for creating and working with multi-sided shapes, offering various methods to manipulate and render these shapes.

- **Constructor**:
  - `brush.Polygon(pointsArray)`
    - `pointsArray` (Array): An array of points, where each point is an array of two numbers `[x, y]`.

- **Methods**:
  - `.intersect(line)`
    - Intersects the polygon with a given line, returning all intersection points.
    - Parameters:
      - `line` (Object): A line object with properties `point1` and `point2`.
    - Returns: `Array` of objects, each with `x` and `y` properties, representing the intersection points.
  - `.draw(brush, color, weight)`
    - Draws the polygon on the canvas, following the current stroke state or the provided params.
  - `.fill(color, opacity, bleed, texture)`
    - Fills the polygon on the canvas, adhering to the current fill state or to the provided params.
  - `.wash(color, opacity)`
    - Washes the polygon on the canvas with the current wash() state or the provided params.
  - `.hatch(distance, angle, options)`
    - Applies hatching to the polygon on the canvas, based on the current hatch state or the provided params.
  - `.mass()`
    - Applies the current mass() state to the polygon.

- **Attributes**:
  - `.vertices`: An array of the polygon's vertices, each vertex being an object with `x` and `y` properties.
  - `.sides`: An array representing the different segments that make up the polygon.

---

#### Class: `brush.Plot`

- **Description**: The `Plot` class is crucial for the plot system, managing a collection of segments to create a variety of shapes and paths. It enables intricate designs, such as curves and custom strokes, by defining each segment with an angle, length, and pressure. `Plot` instances can be transformed through rotation, and their appearance controlled via pressure and angle calculations.

- **Constructor**:
  - `brush.Plot(_type)`
    - `_type` (String): The type of plot, either "curve" or "segments".

- **Methods**:
  - `.addSegment(_a, _length, _pres)`
    - Adds a segment to the plot.
    - Parameters:
      - `_a` (Number): The angle of the segment.
      - `_length` (Number): The length of the segment.
      - `_pres` (Number): The pressure of the segment.
  - `.endPlot(_a, _pres)`
    - Finalizes the plot with the last angle and pressure.
    - Parameters:
      - `_a` (Number): The final angle of the plot.
      - `_pres` (Number): The final pressure of the plot.
  - `.rotate(_a)`
    - Rotates the entire plot by a specified angle.
    - Parameters:
      - `_a` (Number): The angle for rotation.
  - `.genPol(_x, _y)`
    - Generates a polygon based on the plot.
    - Parameters:
      - `_x` (Number): The x-coordinate for the starting point.
      - `_y` (Number): The y-coordinate for the starting point.
    - Returns: `Polygon` - The generated polygon.
  - `.draw(x, y)`
    - Draws the plot on the canvas with current stroke() state.
    - Parameters:
      - `x` (Number): The x-coordinate to draw at.
      - `y` (Number): The y-coordinate to draw at.
  - `.fill(x, y)`
    - Fills the plot on the canvas with current fill() state.
    - Parameters:
      - `x` (Number): The x-coordinate to fill at.
      - `y` (Number): The y-coordinate to fill at.
  - `.wash(x, y)`
    - Washes the plot on the canvas with current wash() state.
    - Parameters:
      - `x` (Number): The x-coordinate to wash at.
      - `y` (Number): The y-coordinate to wash at.
  - `.hatch(x, y)`
    - Hatches the plot on the canvas with current hatch() state.
    - Parameters:
      - `x` (Number): The x-coordinate to hatch at.
      - `y` (Number): The y-coordinate to hatch at.
  - `.mass(x, y)`
    - Applies the current mass() state to the plot.
    - Parameters:
      - `x` (Number): The x-coordinate to mass at.
      - `y` (Number): The y-coordinate to mass at.

- **Attributes**:
  - `.segments`: An array containing the lengths of all segments.
  - `.angles`: An array of angles at the different control points.
  - `.press`: An array with custom brush pressures at the various control points.
  - `.type`: The type of the plot, either "curve" or "segments".
  - `.pol`: Stores the generated polygon object after executing the `.genPol()` method.

---

#### Class: `brush.Position`

- **Description**: The `Position` class represents a point within a two-dimensional space, capable of interacting with a vector field. It includes methods for updating the position based on the field's flow, allowing for movement through the vector field in various ways.

- **Constructor**:
  - `brush.Position(x, y)`
    - `x` (Number): The initial x-coordinate.
    - `y` (Number): The initial y-coordinate.

- **Methods**:
  - `.moveTo(_dir, _length, _step_length)`
    - Moves the position along the flow field by a specified length.
    - Parameters:
      - `_dir` (Number): The direction of movement, with angles measured anticlockwise from the x-axis.
        It is interpreted using the current p5 `angleMode()`.
      - `_length` (Number): The length to move along the field.
      - `_step_length` (Number): The length of each step.
  - `.plotTo(_plot, _length, _step_length, _scale)`
    - Plots a point to another position within the flow field, following a given `Plot` object.
    - Parameters:
      - `_plot` (Position): The `Plot` path object.
      - `_length` (Number): The length to move towards the target position.
      - `_step_length` (Number): The length of each step.
      - `_scale` (Number): The scaling factor for the plotting path.
  - `.angle()`
    - Returns vector-field angle for that position.
  - `.reset()`
    - Resets the `plotted` property to 0. This property tracks the distance moved since the last reset or the creation of the position. Important for consecutive different `Plot` paths.

- **Attributes**:
  - `.x`: The current x-coordinate.
  - `.y`: The current y-coordinate.
  - `.plotted`: Stores the distance moved since the last reset or the creation of the position.


## Examples

- Basic examples: [collection in p5.editor (more soon)](https://editor.p5js.org/acamposuribe/collections/PmyBeAfQP)
- GenArt project 1: [Enfantines I](https://www.fxhash.xyz/generative/20569)
- GenArt project 2: [Enfantines II](https://www.fxhash.xyz/generative/22739)
- GenArt project 3: [Fuga a tientas](https://verse.works/exhibitions/fugaatientas-imperfections)

## Contributing
We welcome contributions from the community. If you find a bug or have a feature request, please open an issue on Github.

## License
p5.brush.js is released under the MIT License. See the LICENSE file for details.

## Acknowledgements
- The fill() operations followed the steps explained by Tyler Hobbs [here](https://tylerxhobbs.com/essays/2017/a-generative-approach-to-simulating-watercolor-paints)
- The realistic color blending is calculated with [spectral.js](https://github.com/rvanwijnen/spectral.js), by Ronald van Wijnen
- Several p5 bugs that impacted the library have been found and solved with the help of [Dave Pagurek](https://twitter.com/davepvm)
