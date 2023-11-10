# p5.brush.js

p5.brush.js is a versatile library for the p5.js ecosystem, tailored for artists, designers, and hobbyists who wish to explore natural textures in generative art. This library extends the drawing capabilities of p5.js by introducing a rich set of tools that allow for the creation of dynamic and customizable brushes, vector-fields, and fill modes.

With p5.brush.js, you can easily configure and manage intricate drawing systems, inject life into your sketches with organic movements, and apply complex vector fields to control the flow and form of strokes. The library is designed with texture quality in mind, and may only be suitable for high-resolution artworks, not real-time interactive pieces.

Whether you're looking to simulate natural media, create patterned backgrounds, or design intricate particle systems, p5.brush.js offers the functionalities to turn your vision into reality. The API is straightforward and modular, providing both high-level functions for quick setup and in-depth customization options for advanced users.

Embrace the full potential of your creative coding projects with p5.brush.js, where every stroke is a brush with possibility.

(And thanks ChatGPT for helping with the description)

## Table of Contents
- [Installation](#installation)
- [Features](#features)
- [Reference](#reference)
- [Examples](#examples)
- [Contributing](#contributing)
- [License](#license)


## Installation

Before using p5.brush.js, ensure you include **[Spectral.js](https://github.com/rvanwijnen/spectral.js)**, which is a prerequisite library for color mixing features.

### Standard Installation

To set up your project, add both `p5.brush.js` and `Spectral.js` to your HTML file. Place the script tags in the following order:

```html
<!-- Commented version of p5.brush.js, with a Spectral.js dependency -->
<script src="path_to/spectral.min.js"></script>
<script src="path_to/p5.brush.js"></script>
```
Replace path_to with the actual path to the minified script in your project directory or the URL if you are using a CDN.

### Minified Version

For improved performance, use the minified version of `p5.brush.js` which bundles `Spectral.js`:

```html
<!-- Minified version of p5.brush.js with Spectral.js included -->
<script src="path_to/p5.brush.min.js"></script>
```
Replace path_to with the actual path to the minified script in your project directory or the URL if you are using a CDN.


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

### Table of Contents

|      Section                            |      Functions      |   | Section                                    |      Functions      |   |
|-----------------------------------------|---------------------|---|--------------------------------------------|---------------------|---|
| [Vector-Fields](#vector-fields)         | brush.field()       |   | [Geometry](#geometry)                      | brush.line()        |   |
|                                         | brush.noField()     |   |                                            | brush.flowLine()    |   |
|                                         | brush.refreshField()|   |                                            | brush.flowShape()   |   |
|                                         | brush.listFields()  |   |                                            | brush.rect()        |   |
|                                         | brush.addField()    |   |                                            | brush.circle()      |   |
| [Brush Management](#brush-management)   | brush.scale()       |   |                                            | brush.polygon()     |   |
|                                         | brush.box()         |   |                                            | brush.spline()      |   |
|                                         | brush.add()         |   |                                            | brush.beginShape()  |   |
|                                         | brush.clip()        |   |                                            | brush.vertex()      |   |
|                                         | brush.noClip()      |   |                                            | brush.endShape()    |   |
| [Stroke Operations](#stroke-operations) | brush.set()         |   |                                            | brush.beginStroke() |   |
|                                         | brush.pick()        |   |                                            | brush.nextStroke()  |   |
|                                         | brush.stroke()      |   |                                            | brush.endStroke()   |   |
|                                         | brush.noStroke()    |   | [Configuration](#optional-configuration)   | brush.config()      |
|                                         | brush.strokeWeight()|   |                                            | brush.load()        |
| [Fill Operations](#fill-operations)     | brush.fill()        |   |                                            | brush.preload()     |
|                                         | brush.noFill()      |   |                                            | brush.colorCache()  | 
|                                         | brush.bleed()       |   | [Classes](#exposed-classes)                | brush.Polygon()     |
| [Hatch Operations](#hatch-operations)   | brush.hatch()       |   |                                            | brush.Plot()        |
|                                         | brush.noHatch()     |   |                                            | brush.Position()    |
|                                         | brush.setHatch()    |   | [Advanced Functions](#advanced-functions)  | brush.tip()         |

---

### Vector Fields

Vector Fields allow for dynamic control over brush stroke behavior, enabling the creation of complex and fluid motion within sketches.


 #### Basic vector-field functions

 
- `brush.field(name)`
  - **Description**: Activates a named vector field. When a vector field is active, it influences the flow and direction of the brush strokes for shapes drawn thereafter. It is important to note that certain shapes may be exempt from this influence; such exceptions will be clearly documented in the API for each specific geometry.
  - **Parameters**:
    - `name` (String): The identifier for the vector field to be activated. This can be a name of one of the predefined fields or a custom field created with `brush.addField()`.
  - **Default Fields**: The library comes with a set of built-in vector fields: `curved`, `truncated`, `zigzag`, `seabed`, and `waves`. These, as well as any custom fields added, can be activated using this function.
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
  - **Description**: Deactivates the currently active vector field, returning the drawing behavior to its default state where shapes are not influenced by any vector field. Any shapes drawn after this function call will not be affected by the previously active vector field.
  - **Usage**:
    ```javascript
    // Deactivate the current vector field
    brush.noField();
    ```
    Use this function when you want to draw shapes that are unaffected by the directional flow of any vector field, effectively resetting the drawing behavior to its original state.

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
  - **Description**: Retrieves an iterator containing the names of all the available vector fields within the system. This includes both the default fields provided by the library and any custom fields that have been added using `brush.addField()`.
  - **Returns**: `Iterator<string>` - An iterator that yields the names of the vector fields.
  - **Usage**:
    ```javascript
    // Get an iterator of all vector field names
    let fieldNames = brush.listFields();
    // Loop through the names using the iterator
    for (let name of fieldNames) {
      console.log(name);
    }
    ```
    Use `brush.listFields()` to access the names of all existing vector fields, which can then be used to activate or modify fields as needed.

---
 
 #### Advanced vector-field functions

 
- `brush.addField(name, generatorFunction)`
  - **Description**: Adds a custom vector field to the list of available fields. This advanced function requires a unique name for the field and a generator function that defines the behavior of the vector field over time.
  - **Parameters**:
    - `name` (String): A unique identifier for the vector field.
    - `generatorFunction` (Function): A function that generates the field values. It takes a time parameter `t`, loops through the vector field cells, assigns angular values based on custom logic, and returns the modified `FF.field` array.
  - **Default Fields**: The library includes several pre-defined vector fields. Users can add their own to extend the functionality.
  - **Usage**: To add a vector field that creates wave-like motions:
    ```javascript
    brush.addField("waves", function(t) {
        let sinrange = R.randInt(10,15) + 5 * R.sin(t);
        let cosrange = R.randInt(3,6) + 3 * R.cos(t);
        let baseAngle = R.randInt(20,35);
        for (let column = 0; column < FF.num_columns; column++) {
            for (let row = 0; row < FF.num_rows; row++) {               
                let angle = R.sin(sinrange * column) * (baseAngle * R.cos(row * cosrange)) + R.randInt(-3,3);
                FF.field[column][row] = angle;
            }
        }
        return FF.field;
    });
    ```
    This `generatorFunction` uses sinusoidal functions to create a time-varying wave pattern within the vector field. Each cell's angle is calculated and assigned, resulting in a dynamic field that can be used to influence brush strokes.

---

### Brush Management

Functions for managing brush behaviors and properties.


- `brush.scale(scale)`
  - **Description**: Adjusts the global scale of all standard brush parameters, including weight, vibration, and spacing, based on the given scaling factor. This function is specifically designed to affect dafault brushes, allowing for uniform scaling across various brush types.
  - **Parameters**:
    - `scale` (Number): The scaling factor to be applied to the brush parameters.
  - **Note**: This function only impacts the default brushes. Custom brushes may not be affected by this scaling, since they are defined per case basis.
  - **Usage**:
    ```javascript
    // Scale all standard brushes by a factor of 1.5
    brush.scale(1.5);
    ```
    Using `brush.scale()`, you can easily adjust the size and spacing characteristics of standard brushes in your project, providing a convenient way to adapt to different canvas sizes or artistic styles.

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

- `brush.add(name, params)`
  - **Description**: Adds a new brush to the brush list with specified parameters, defining the brush's behavior and appearance. This function allows for extensive customization, enabling the creation of unique brush types suited to various artistic needs.
  - **Parameters**:
    - `name` (String): A unique identifier for the brush.
    - `params` (BrushParameters): An object containing the parameters for the brush. The parameters include:
      - `type`: (`standard` | `spray` | `marker` | `custom` | `image`) The tip type. 
      - `weight`: Base size of the brush tip, in canvas units.
      - `vibration`: Vibration of the lines, affecting spread, in canvas units.
      - `definition`: (Number from 0-1) Between 0 and 1, defining clarity. Unnecessary for custom, marker, and image type brushes.
      - `quality`: Higher values lead to a more continuous line. Unnecessary for custom, marker, and image type brushes.
      - `opacity`: (Number from 0-255) Base opacity of the brush (affected by pressure).
      - `spacing`: Spacing between points in the brush stroke, in canvas units.
      - `blend`: (Boolean) Enables or disables realistic color mixing (default true for marker, custom, and image brushes).
      - `pressure`: An object or function defining the pressure sensitivity.
         - `type` : 'standard" or 'custom". Use standard for simple gauss bell curves. Use 'custom' for custom pressure curves.
         - `min_max`: (Array [min, max]) Define min and max pressure (reverse for inverted presure).
         - `curve`: function or array.
            - Standard pressure: [a, b] - If 'standard' pressure curve, pick a and b values for the gauss curve. a is max horizontal mvt of the bell, b changes the slope.
            - Custom pressure: (x) => function - If 'custom' pressure curve, define the curve function with a curve equation receiving values from 0 to 1, returning values from 0 to 1. Use https://mycurvefit.com/
      - `tip`: (For custom types) A function defining the geometry of the brush tip. Remove if unnecessary.
      - `image`: (For image types) The url path to your image, which MUST be in the same baseURL. Remove if unnecessary.
      - `rotate`: (`none` | `natural` | `random`) Defines the tip angle rotation.
  - **Usage**:
    ```javascript
    // You create an image brush like this:
    brush.add("watercolor", {
        type: "image",
        weight: 10,
        vibration: 2,
        opacity: 30,
        spacing: 1.5,
        blend: true,
        pressure: {
            type: "custom",
            min_max: [0.5,1.2],
            // This formula implies that the pressure changes in a linear distribution through the whole length of the line.
            // Minimum pressure at the start, maximum pressure at the end.
            curve: (x) => 1-x
        },
        image: {
            src: "./brush_tips/brush.jpg",
        },
        rotate: "random",
    })
    
    // You create a custom tip brush like this:
    brush.add("watercolor", {
        type: "custom",
        weight: 5,
        vibration: 0.08,
        opacity: 23,
        spacing: 0.6,
        blend: true,
        pressure: {
            type: "custom",
            min_max: [1.35,1],
            curve: [0.35,0.25] // Values for the bell curve
        },
        tip: () => {
           // in this example, the tip is composed of two squares, rotated 45 degrees
           // Always execute drawing functions within the B.mask buffer!
           B.mask.rotate(45), B.mask.rect(-1.5,-1.5,3,3), B.mask.rect(1,1,1,1);
        }
        rotate: "natural",
    })
    ```
    By using `brush.add()`, you can expand your brush collection with custom brushes tailored to specific artistic effects and styles.

---

- `brush.clip(clippingRegion)`
  - **Description**: Sets a rectangular clipping region for all subsequent brush strokes. When this clipping region is active, brush strokes outside this area will not be rendered. This is particularly useful for ensuring that strokes, such as lines and curves, are contained within a specified area. The clipping affects only stroke and hatch operations, not fill operations. The clipping remains in effect for all strokes drawn after the call to `brush.clip()` until `brush.noClip()` is used.
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
    
### Stroke Operations

Stroke Operations encompass methods for manipulating and applying brushes to strokes (aka lines), providing artists with precise control over their brushwork.


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

### Fill Operations

Functions that handle the filling of shapes and areas.

*(Insert Fill Operations related functions here)*

---

### Hatch Operations

Procedures for applying hatching patterns to areas.

*(Insert Hatching Operations related functions here)*

---

### Geometry

Tools for creating and manipulating geometric shapes.

*(Insert Geometry related functions here)*

---

### Optional: Configuration

This section covers functions for initializing the drawing system, preloading required assets, and configuring system behavior. By default, the library works without executing these functions, but you might want to configure them to your liking.

- `brush.config(objct = {})`
  - **Description**: Sets custom configuration for the drawing system. It allows the overriding of the default randomness source by specifying a custom function.
  - **Parameters**: 
    - `objct` (Object): Configuration object with properties. Default is `{}`.
    - `objct.R` (Function): Optional custom random number generator function.
  - **Example**: To use a deterministic random number generator, such as one from a generative art platform like fx(hash), you might configure your system as follows:
    ```javascript
    brush.config({
      R: () => $fx.random()
    });
    ```
    Replace `$fx.random()` with the actual function provided by the platform. By default, if `objct.R` is not provided, `p5.brush.js` uses p5's `random()` function, which allows for the use of `randomSeed()` to set the seed for randomness.

---

- `brush.load(canvasID)`
  - **Description**: Initializes the drawing system and sets up the environment. If `canvasID` is not provided, the current window is used as the rendering context. If you want to load the library on a custom p5.Graphics element (or instanced canvas), you can do it by executing this function.
  - **Parameters**: 
    - `canvasID` (string): Optional ID of the buffer/canvas element. If false, uses the window's rendering context.

---

- `brush.preload()`
  - **Description**: Preloads necessary assets or configurations for brushes. If you are using custom image tip brushes, you need to include this question within the preload() function of your p5 sketch.
  - **Parameters**: None
  - **Example**: To use a deterministic random number generator, such as one from a generative art platform like fx(hash), you might configure your system as follows:
    ```javascript
    // Your p5 preload function
    function preload () {
      brush.preload() // Add this if you want to use custom img brushes
    }
    ```

---

- `brush.colorCache(bool = true)`
  - **Description**: Enables or disables color caching for WebGL shaders. Color caching can increase performance but may produce less accurate textures when the same color is used repeatedly. It's set to _true_ by default
  - **Parameters**: 
    - `bool` (boolean): Set to true to enable caching, or false to disable it.

---

### Exposed Classes

Classes that are exposed for creating and manipulating objects.

- `Position`
  - Represents a point within a two-dimensional space which can interact with a vector field.

*(Insert other Exposed Classes here)*



