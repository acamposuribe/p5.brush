# p5.brush.js

p5.brush.js is a versatile library for the p5.js ecosystem, tailored for artists, designers, and hobbyists who wish to explore natural textures in generative art. This library extends the drawing capabilities of p5.js by introducing a rich set of tools that allow for the creation of dynamic and customizable brushes, vector-fields, and fill modes.

With p5.brush.js, you can easily configure and manage intricate drawing systems, inject life into your sketches with organic movements, and apply complex vector fields to control the flow and form of strokes. The library is designed with texture quality in mind, and may only be suitable for high-resolution artworks, not real-time interactive pieces.

Whether you're looking to simulate natural media, create patterned backgrounds, or design intricate particle systems, p5.brush.js offers the functionalities to turn your vision into reality. The API is straightforward and modular, providing both high-level functions for quick setup and in-depth customization options for advanced users.

Embrace the full potential of your creative coding projects with p5.brush.js, where every stroke is a brush with possibility.

(And thanks ChatGPT for helping with the description)

## Table of Contents
- [Installation](#installation)
- [Features](#features)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Contributing](#contributing)
- [License](#license)


## Installation

Before using p5.brush.js, ensure you include **[Spectral.js](https://github.com/rvanwijnen/spectral.js)**, which is a prerequisite library for color mixing features.

### Standard Installation

To set up your project, add both `p5.brush.js` and `Spectral.js` to your HTML file. Place the script tags in the following order:

```html
<!-- Commented version of p5.brush.js, with a Spectral.js dependency -->
<script src="path_to/spectral.js"></script>
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
- **Preloaded Assets**: Optimize your workflow by preloading brush tip assets, ensuring your brushes are ready for use without delay.
- **Interactive Brush Tips**: Utilize pressure-sensitive brush tips for interactive drawing, adding a level of responsiveness to your canvas work.
- **Hatching Patterns**: Implement hatching techniques with precision control over the patterns' density and orientation, enhancing your artwork with automated detailing.
- **Brush and Field Management**: Manage and switch between brushes and vector fields with ease, adapting to the needs of your project seamlessly.
- **Extensibility**: Expand the library's capabilities by integrating your own custom brushes and vector fields, tailoring the toolset to your artistic vision.
- **Intuitive Spline and Curve Generation**: Generate smooth and accurate curves and splines effortlessly, simplifying the process of intricate path creation.
- **Watercolor Fill System**: Achieve the subtle nuances of watercolor with a digital fill system designed to blend and diffuse colors in a naturally fluid way.

With p5.brush.js, your digital canvas becomes a playground for innovation and expression, where each tool is fine-tuned to complement your unique creative process.


## API Reference

p5.brush.js provides a comprehensive API for creating complex drawings and effects. Below are the categorized functions and classes available in the library.

### Table of Contents
- [Vector-Fields](#vector-fields)
- [Optional: Configuration](#optional-configuration)
  
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

- `brush.noField()`
  - **Description**: Deactivates the currently active vector field, returning the drawing behavior to its default state where shapes are not influenced by any vector field. Any shapes drawn after this function call will not be affected by the previously active vector field.
  - **Usage**:
    ```javascript
    // Deactivate the current vector field
    brush.noField();
    ```
    Use this function when you want to draw shapes that are unaffected by the directional flow of any vector field, effectively resetting the drawing behavior to its original state.

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

### Brush Management

Functions for managing brush behaviors and properties.

- `disableBrush()`
  - Disables the stroke for subsequent drawing operations.
- `listOfBrushes()`
  - Retrieves a list of all available brush names.

### Geometry

Tools for creating and manipulating geometric shapes.

*(Insert Geometry related functions here)*

### Stroke Operations

Methods to perform operations related to brush strokes.

- `drawTip(x, y, pressure)`
  - Draws the tip of the selected brush at the specified coordinates with the given pressure.

### Fill Operations

Functions that handle the filling of shapes and areas.

*(Insert Fill Operations related functions here)*

### Hatching Operations

Procedures for applying hatching patterns to areas.

*(Insert Hatching Operations related functions here)*

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


- `brush.load(canvasID)`
  - **Description**: Initializes the drawing system and sets up the environment. If `canvasID` is not provided, the current window is used as the rendering context. If you want to load the library on a custom p5.Graphics element (or instanced canvas), you can do it by executing this function.
  - **Parameters**: 
    - `canvasID` (string): Optional ID of the buffer/canvas element. If false, uses the window's rendering context.


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


- `brush.colorCache(bool = true)`
  - **Description**: Enables or disables color caching for WebGL shaders. Color caching can increase performance but may produce less accurate textures when the same color is used repeatedly. It's set to _true_ by default
  - **Parameters**: 
    - `bool` (boolean): Set to true to enable caching, or false to disable it.

### Exposed Classes

Classes that are exposed for creating and manipulating objects.

- `Position`
  - Represents a point within a two-dimensional space which can interact with a vector field.

*(Insert other Exposed Classes here)*



