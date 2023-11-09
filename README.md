# p5.brush.js

p5.brush.js is a versatile library for the p5.js ecosystem, tailored for artists, designers, and hobbyists who wish to explore natural textures in generative art. This library extends the drawing capabilities of p5.js by introducing a rich set of tools that allow for the creation of dynamic and customizable brushes, vector-fields, and fill modes.

With p5.brush.js, you can easily configure and manage intricate drawing systems, inject life into your sketches with organic movements, and apply complex vector fields to control the flow and form of strokes. The library is designed with texture quality in mind, and may only be suitable for high-resolution artworks, not real-time interactive pieces.

Whether you're looking to simulate natural media, create patterned backgrounds, or design intricate particle systems, p5.brush.js offers the functionalities to turn your vision into reality. The API is straightforward and modular, providing both high-level functions for quick setup and in-depth customization options for advanced users.

Embrace the full potential of your creative coding projects with p5.brush.js, where every stroke is a brush with possibility.

(And thanks ChatGPG for helping with the description)

## Table of Contents
- [Installation](#installation)
- [Features](#features)
- [API Reference](#api-reference)
- [Examples](#examples)
- [Contributing](#contributing)
- [License](#license)

## Installation

p5.brush.js requires makes use of **[Spectral.js](https://github.com/rvanwijnen/spectral.js)https://github.com/rvanwijnen/spectral.js**, a paint like color mixing library.
To use p5.brush.js in your project, include the following scripts tags in your HTML file:

```html
<script src="path_to/p5.brush.js"></script>
<script src="path_to/spectral.js"></script>
```

You can alternatively use the minified version for improved performance, which comes with spectral.js preinstalled:

```html
<script src="path_to/p5.brush.min.js"></script>
```

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


