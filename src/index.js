/**
 * @fileoverview p5.brush - A comprehensive toolset for brush management in p5.js.
 * @version 1.1.3
 * @license MIT
 * @author Alejandro Campos Uribe
 * 
 * @description
 * p5.brush is a p5.js library dedicated to the creation and management of custom brushes.
 * It extends the drawing capabilities of p5.js by allowing users to simulate a wide range
 * of brush strokes, vector fields, hatching patterns, and fill textures. These features
 * are essential for emulating the nuanced effects found in traditional sketching and painting.
 * Whether for digital art applications or procedural generation of graphics, p5.brush provides
 * a robust framework for artists and developers to create rich, dynamic, and textured visuals.
 *
 * @example
 * // Basic usage:
 * brush.pick('marker'); // Select brush type
 * brush.stroke(255, 0, 0); // Set brush color
 * brush.strokeWeight(10); // Set brush size
 * brush.line(25, 25, 75, 75); // Draw a line
 * 
 * // Add a new brush type:
 * brush.add('customBrush', { /* parameters for the brush *\/ });
 * brush.pick('customBrush');
 * 
 * // Use the custom brush for a vector-field line:
 * brush.field('field_name') // Pick a flowfield
 * brush.flowLine(50, 50, 100, PI / 4); // Draw a line within the vector-field
 *
 * // Fill textures:
 * brush.noStroke();
 * brush.fill('#FF0000', 90); // Set fill color to red and opacity to 90
 * brush.bleed(0.3); // Set bleed effect for a watercolor-like appearance
 * brush.rect(100, 100, 50, 50); // Fill a rectangle with the bleed effect
 * 
 * @license
 * MIT License
 * 
 * Copyright (c) 2023-2024 Alejandro Campos Uribe
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

// =============================================================================
// Section: Configure and Initiate
// =============================================================================
/**
 * This section contains functions for setting up the drawing system. It allows 
 * for configuration with custom options, initialization of the system, preloading
 * necessary assets, and a check to ensure the system is ready before any drawing 
 * operation is performed.
 */

    /**
     * Reference to the renderer or canvas object.
     * @type {Object}
     */
    let _r;

    /**
     * Flag to indicate if the system is ready for rendering.
     * @type {boolean}
     */
    let _isReady = false;
    let _isLoaded = false;

    /**
     * Flag to indicate if p5 is instanced or global mode.
     * @type {boolean}
     */
    let _isInstanced = false;
    let _inst = false;

    /**
     * Initializes the drawing system and sets up the environment.
     * @param {string|boolean} [canvasID=false] - Optional ID of the canvas element to use.
     *                                            If false, it uses the current window as the rendering context.
     */
    export function load (canvasID = false) {
        let inst = (_isInstanced && canvasID) ? _inst : false;
        if (_isReady) remove(false)
        // Set the renderer to the specified canvas or to the window if no ID is given
        if (!canvasID && _isInstanced) canvasID = _inst;
        _r = (!canvasID) ? window.self : canvasID;
        
        // Load color blending
        Mix.load(inst);
        _isLoaded = true;
    }

    /**
     * Removes brush buffers
     */
    export function remove (a = true) {
        if (_isReady) {
            Mix.masks[0].remove()
            Mix.masks[0] = null;
            Mix.masks[1].remove()
            Mix.masks[1] = null;
            Mix.masks[2].remove()
            Mix.masks[2] = null;
            if (a) brush.load()
        }
    }

    /**
     * Preloads necessary assets or configurations.
     * This function should be called before setup to ensure all assets are loaded.
     */
    export function preload () {
        // Load custom image tips
        T.load();
    }

    /**
     * Ensures that the drawing system is ready before any drawing operation.
     * Loads the system if it hasn't been loaded already.
     */
    function _ensureReady () {
        if (!_isReady) {
            if (!_isLoaded) load();
            FF.create(); // Load flowfield system
            scaleBrushes(_r.width / 250) // Adjust standard brushes to match canvas
            _isReady = true;
        }
    }

// =============================================================================
// Section: Randomness and other auxiliary functions
// =============================================================================
/**
 * This section includes utility functions for randomness, mapping values, 
 * constraining numbers within a range, and precalculated trigonometric values 
 * to optimize performance. Additionally, it provides auxiliary functions for 
 * geometric calculations such as translation extraction, line intersection, 
 * and angle calculation.
 */

    import { prng_alea } from 'esm-seedrandom';

    /**
     * The basic source of randomness, can be seeded for determinism.
     * @returns {number} A random number between 0 and 1.
     */
    let rng = new prng_alea(Math.random())
    export function seed (s) {
        rng = new prng_alea(s)
    }

    /**
     * Object for random number generation and related utility functions.
     * @property {function} source - Function that returns a random number from the base random generator.
     * @property {function} random - Function to generate a random number within a specified range.
     * @property {function} randInt - Function to generate a random integer within a specified range.
     * @property {function} weightedRand - Function to generate a random value based on weighted probabilities.
     * @property {function} map - Function to remap a number from one range to another.
     * @property {function} constrain - Function to constrain a number within a range.
     * @property {function} cos - Function to get the cosine of an angle from precalculated values.
     * @property {function} sin - Function to get the sine of an angle from precalculated values.
     * @property {boolean} isPrecalculationDone - Flag to check if precalculation of trigonometric values is complete.
     * @property {function} preCalculation - Function to precalculate trigonometric values.
     */
    const R = {

        /**
         * Generates a random number within a specified range.
         * @param {number} [min=0] - The lower bound of the range.
         * @param {number} [max=1] - The upper bound of the range.
         * @returns {number} A random number within the specified range.
         */
        random(e = 0, r = 1) {
            return e + rng() * (r - e);
        },

        /**
         * Generates a random integer within a specified range.
         * @param {number} min - The lower bound of the range.
         * @param {number} max - The upper bound of the range.
         * @returns {number} A random integer within the specified range.
         */
        randInt(e, r) {
            return Math.floor(this.random(e,r))
        },

        /**
         * Generates a random gaussian.
         * @param {number} mean - Mean.
         * @param {number} stdev - Standard deviation.
         * @returns {number} A random number following a normal distribution.
         */
        gaussian(mean = 0, stdev = 1) {
            const u = 1 - rng();
            const v = rng();
            const z = Math.sqrt( -2.0 * Math.log( u ) ) * Math.cos( 2.0 * Math.PI * v );
            return z * stdev + mean;
        },

        /**
         * Generates a random value based on weighted probabilities.
         * @param {Object} weights - An object containing values as keys and their probabilities as values.
         * @returns {string} A key randomly chosen based on its weight.
         */
        weightedRand(e) {
            let r, a, n = [];
            for (r in e)
                for (a = 0; a < 10 * e[r]; a++)
                    n.push(r);
                return n[Math.floor(rng() * n.length)]
        },

        /**
         * Remaps a number from one range to another.
         * @param {number} value - The number to remap.
         * @param {number} a - The lower bound of the value's current range.
         * @param {number} b- The upper bound of the value's current range.
         * @param {number} c - The lower bound of the value's target range.
         * @param {number} d - The upper bound of the value's target range.
         * @param {boolean} [withinBounds=false] - Whether to constrain the value to the target range.
         * @returns {number} The remapped number.
         */
        map(value, a, b, c, d, withinBounds = false) {
            let r = c + (value - a) / (b - a) * (d - c);
            if (!withinBounds) return r;
            if (c < d) {return this.constrain(r, c, d)} 
            else {return this.constrain(r, d, c)}
        },

        /**
         * Constrains a number to be within a range.
         * @param {number} n - The number to constrain.
         * @param {number} low - The lower bound of the range.
         * @param {number} high - The upper bound of the range.
         * @returns {number} The constrained number.
         */
        constrain (n, low, high) {
            return Math.max(Math.min(n, high), low);
        },

        /**
         * Calculates the cosine for a given angle using precalculated values.
         * @param {number} angle - The angle in degrees.
         * @returns {number} The cosine of the angle.
         */
        cos(angle) {
            return this.c[Math.floor(4 * ((angle % 360 + 360) % 360))];
        },

        /**
         * Calculates the sine for a given angle using precalculated values.
         * @param {number} angle - The angle in degrees.
         * @returns {number} The sine of the angle.
         */
        sin(angle) {
            return this.s[Math.floor(4 * ((angle % 360 + 360) % 360))];
        },
        // Flag to indicate if the trigonometric tables have been precalculated
        isPrecalculationDone: false,
        
        /**
         * Precalculates trigonometric values for improved performance.
         * This function should be called before any trigonometric calculations are performed.
         */
        preCalculation() {
            if (this.isPrecalculationDone) return;
            const totalDegrees = 1440;
            const radiansPerIndex = 2 * Math.PI / totalDegrees;
            this.c = new Float64Array(totalDegrees);
            this.s = new Float64Array(totalDegrees);
            for (let i = 0; i < totalDegrees; i++) {
                const radians = i * radiansPerIndex;
                R.c[i] = Math.cos(radians);
                R.s[i] = Math.sin(radians);
            }
            this.isPrecalculationDone = true;
        },

        /**
         * Checks if value is numeric
         */
        isNumber: (a) => !isNaN(a),

        /**
         * Changes angles to degrees and between 0-360
         */
        toDegrees: (a) => (((_r.angleMode() === "radians") ? a * 180 / Math.PI : a) % 360 + 360) % 360,

        /**
         * Calculates distance between two 2D points
         */
        dist: (x1,y1,x2,y2) => Math.hypot(x2-x1, y2-y1)
    }
    // Perform the precalculation of trigonometric values for the R object
    R.preCalculation();

    /**
     * Calculates the intersection point between two line segments if it exists.
     * 
     * @param {Object} seg1Start - The start point of the first line segment.
     * @param {Object} seg1End - The end point of the first line segment.
     * @param {Object} seg2Start - The start point of the second line segment.
     * @param {Object} seg2End - The end point of the second line segment.
     * @param {boolean} [includeSegmentExtension=false] - Whether to include points of intersection not lying on the segments.
     * @returns {Object|boolean} The intersection point as an object with 'x' and 'y' properties, or 'false' if there is no intersection.
     */
    function _intersectLines(seg1Start, seg1End, seg2Start, seg2End, includeSegmentExtension = false) {
        // Extract coordinates from points
        let x1 = seg1Start.x, y1 = seg1Start.y;
        let x2 = seg1End.x, y2 = seg1End.y;
        let x3 = seg2Start.x, y3 = seg2Start.y;
        let x4 = seg2End.x, y4 = seg2End.y;
        // Early return if line segments are points or if the lines are parallel
        if ((x1 === x2 && y1 === y2) || (x3 === x4 && y3 === y4)) {
            return false; // Segments are points
        }
        let deltaX1 = x2 - x1, deltaY1 = y2 - y1;
        let deltaX2 = x4 - x3, deltaY2 = y4 - y3;
        let denominator = (deltaY2 * deltaX1 - deltaX2 * deltaY1);
        if (denominator === 0) {
            return false; // Lines are parallel
        }
        // Calculate the intersection point
        let ua = (deltaX2 * (y1 - y3) - deltaY2 * (x1 - x3)) / denominator;
        let ub = (deltaX1 * (y1 - y3) - deltaY1 * (x1 - x3)) / denominator;
        // Check if the intersection is within the bounds of the line segments
        if (!includeSegmentExtension && (ub < 0 || ub > 1)) {
            return false;
        }
        // Calculate the intersection coordinates
        let x = x1 + ua * deltaX1;
        let y = y1 + ua * deltaY1;
        return { x: x, y: y };
    }

    /**
     * Calculates the angle in degrees between two points in 2D space.
     * The angle is measured in a clockwise direction from the positive X-axis.
     *
     * @param {number} x1 - The x-coordinate of the first point.
     * @param {number} y1 - The y-coordinate of the first point.
     * @param {number} x2 - The x-coordinate of the second point.
     * @param {number} y2 - The y-coordinate of the second point.
     * @returns {number} The angle in degrees between the two points.
     */
    function _calculateAngle(x1,y1,x2,y2) {
        // Calculate the angle based on the quadrant in which the second point lies
        let angleRadians = Math.atan2(-(y2 - y1), (x2 - x1));
        // Convert radians to degrees and normalize the angle between 0 and 360
        let angleDegrees = angleRadians * (180 / Math.PI);
        return (angleDegrees % 360 + 360) % 360;
    }

    /**
     * Object that saves the current p5.brush state for push and pop operations
     */
    const _saveState = {
        field: {},
        stroke: {},
        hatch: {},
        fill: {},
        others: {},
    }

    /**
     * Saves current state to object
     */
    export function push () {
        // Field
        _saveState.field.isActive = FF.isActive;
        _saveState.field.current = FF.current;
        
        // Stroke
        _saveState.stroke.isActive = B.isActive;
        _saveState.stroke.name = B.name;
        _saveState.stroke.color = B.c;
        _saveState.stroke.weight = B.w;
        _saveState.stroke.clip = B.cr;

        // Hatch
        _saveState.hatch.isActive = H.isActive;
        _saveState.hatch.hatchingParams = H.hatchingParams;
        _saveState.hatch.hatchingBrush = H.hatchingBrush;

        // Fill
        _saveState.fill.isActive = F.isActive;
        _saveState.fill.color = F.color;
        _saveState.fill.opacity = F.opacity;
        _saveState.fill.bleed_strength = F.bleed_strength;
        _saveState.fill.texture_strength = F.texture_strength;
        _saveState.fill.border_strength = F.border_strength;

        // Rotate
        _saveState.others.rotate = Matrix.rotation;
    }

    /**
     * Restores previous state from object
     */
    export function pop() {
        // Field
        FF.isActive = _saveState.field.isActive;
        FF.current = _saveState.field.current;
        
        // Stroke
        B.isActive = _saveState.stroke.isActive;
        B.name = _saveState.stroke.name;
        B.c = _saveState.stroke.color;
        B.w = _saveState.stroke.weight;
        B.cr = _saveState.stroke.clip;

        // Hatch
        H.isActive = _saveState.hatch.isActive;
        H.hatchingParams = _saveState.hatch.hatchingParams;
        H.hatchingBrush = _saveState.hatch.hatchingBrush;

        // Fill
        F.isActive = _saveState.fill.isActive;
        F.color = _saveState.fill.color;
        F.opacity = _saveState.fill.opacity;
        F.bleed_strength = _saveState.fill.bleed_strength;
        F.texture_strength = _saveState.fill.texture_strength;
        F.border_strength = _saveState.fill.border_strength;

        // Rotate
        Matrix.rotation = _saveState.others.rotate;
    }

    /**
     * Object to perform matrix translation and rotation operations
     */
    const Matrix = {
        translation: [0, 0],
        rotation: 0,
        /**
         * Captures the current translation values from the renderer's transformation matrix.
         * 
         * Assumes that the renderer's transformation matrix (`uMVMatrix`) is a 4x4 matrix
         * where the translation components are in the 13th (index 12) and 14th (index 13) positions.
         * 
         * @returns {number[]} An array containing the x (horizontal) and y (vertical) translation values.
         */
        trans () {
            // Access the renderer's current model-view matrix and extract the translation components
            this.translation = [_r._renderer.uMVMatrix.mat4[12],_r._renderer.uMVMatrix.mat4[13]];
            // Return the translation components as a two-element array
            return this.translation
        }
    }

    /**
     * Captures the desired rotation.
     */
    export function rotate (a = 0) {
        Matrix.rotation = R.toDegrees(a)
    }

    /**
     * Object to perform scale operations
     */
    let _curScale = 1;
    export function scale (a) {
        _curScale *= a
    }
    

// =============================================================================
// Section: Color Blending - Uses spectral.js as a module
// =============================================================================
/**
 * The Mix object is responsible for handling color blending operations within 
 * the rendering context. It utilizes WebGL shaders to apply advanced blending 
 * effects based on Kubelka-Munk theory. It depends on spectral.js for the 
 * blending logic incorporated into its fragment shader.
 */

    /**
     * Enables/Disables color caching for WebGL Shaders.
     * Color caching increases performance but might produce worse textures 
     * when using the same colour repeteadly.
     * @param {bool} bool
     * 
     */
    export function colorCache(bool = true) {
        Mix.isCaching = bool;
    }

    /**
     * Object handling blending operations with WebGL shaders.
     * @property {boolean} loaded - Flag indicating if the blend shaders have been loaded.
     * @property {boolean} isBlending - Flag indicating if the blending has been initiated.
     * @property {boolean} isCaching - Flag indicating if the color caching is active.
     * @property {Float32Array} currentColor - Typed array to hold color values for shaders.
     * @property {function} load - Loads resources and initializes blend operations.
     * @property {function} blend - Applies blending effects using the initialized shader.
     * @property {string} vert - Vertex shader source code.
     * @property {string} frag - Fragment shader source code with blending logic.
     */
    const Mix = {
        loaded: false,
        isBlending: false,
        isCaching: true,
        currentColor: new Float32Array(3),

        /**
         * Loads necessary resources and prepares the mask buffer and shader for colour blending.
         */
        load(inst) {
            this.type = (_isInstanced && !inst) ? 0 : (!inst ? 1 : 2)
            this.masks = []
            // Create a buffer to be used as a mask for blending
            // WEBGL buffer for img brushes (image() is much quicker like this)
            // Create a buffer for noBlend brushes
            for (let i = 0; i < 3; i++) {
                switch(this.type) {
                    case 0:
                        this.masks[i] = _r.createGraphics(_r.width,_r.height, i == 1 ? _r.WEBGL : _r.P2D)
                        break;
                    case 1:
                        this.masks[i] = createGraphics(_r.width,_r.height, i == 1 ? WEBGL : P2D)
                        break;
                    case 2:
                        this.masks[i] = inst.createGraphics(inst.width, inst.height, i == 1 ? inst.WEBGL : inst.P2D)
                        break;
                }
            }

            for (let mask of this.masks) {
                mask.pixelDensity(_r.pixelDensity());
                mask.clear();
                mask.angleMode(_r.DEGREES);
                mask.noSmooth();
            }

            // Create the shader program from the vertex and fragment shaders
            this.shader = _r.createShader(this.vert, this.frag);
            Mix.loaded = true;
        },

        /**
         * Converts a color object with RGB levels to a Float32Array representation.
         * The RGB levels are normalized to a range of 0.0 to 1.0.
         * @param {object} _color - A p5 color object representing a color, containing an 'levels' property.
         * @returns {Float32Array} A Float32Array with three elements, each representing the normalized levels of red, green, and blue.
         */
        getPigment(_color) {
            let currentLevels = _color.levels;
            let colorArray = new Float32Array(3);
            colorArray[0] = currentLevels[0] / 255.0;
            colorArray[1] = currentLevels[1] / 255.0;
            colorArray[2] = currentLevels[2] / 255.0;
            return colorArray;
        },

        /**
         * There are two parallel blender instances: one uses the 2D mask, the other the WEBGL mask
         * 2D Canvas API mask: for basi geometry (circles, polygons, etc), which is much faster with the 2D API
         * WEBGL mask: for image-type brushes. p5 image() is much faster in WEBGL mode
         */
        color1: new Float32Array(3),
        color2: new Float32Array(3),
        blending1: false,
        blending2: false,

        /**
         * Applies the blend shader to the current rendering context.
         * @param {string} _c - The color used for blending, as a p5.Color object.
         * @param {boolean} _isLast - Indicates if this is the last blend after setup and draw.
         * @param {boolean} _isLast - Indicates if this is the last blend after setup and draw.
         */
        blend (_color = false, _isLast = false, webgl_mask = false) {

            _ensureReady();

            // Select between the two options:
            this.isBlending = webgl_mask ? this.blending1 : this.blending2;
            this.currentColor = webgl_mask ? this.color1 : this.color2;

            // Check if blending is initialised
            if(!this.isBlending) {
                // If color has been provided, we initialise blending
                if (_color) {
                    this.currentColor = this.getPigment(_color);
                    if (webgl_mask) this.blending1 = true, this.color1 = this.currentColor;
                    else this.blending2 = true, this.color2 = this.currentColor;
                } else if (_isLast) {
                    if (!webgl_mask) reDraw()
                    return
                }
            }
            
            // Checks if newColor is the same than the cadhedColor
            // If it is the same, we wait before applying the shader for color mixing
            // If it's NOT the same, we apply the shader and cache the new color
            let newColor = !_color ? this.currentColor : this.getPigment(_color);

            if (newColor.toString() !== this.currentColor.toString() || _isLast || !this.isCaching) {
                // Paste info from noBlend buffer
                reDraw()

                if (this.isBlending) {
                    _r.push();
                    _r.translate(-Matrix.trans()[0],-Matrix.trans()[1])
                    // Use the blend shader for rendering
                    _r.shader(this.shader);
                    // Set shader uniforms
                    // Color to blend
                    this.shader.setUniform('addColor', this.currentColor);
                    // Source canvas
                    this.shader.setUniform('source', _r._renderer);
                    // Bool to active watercolor blender vs marker blenderd
                    this.shader.setUniform('active', Mix.watercolor);
                    // Random values for watercolor blender
                    this.shader.setUniform('random', [R.random(),R.random(),R.random()]);
                    // We select and apply the correct mask here
                    let mask = webgl_mask ? this.masks[1] : this.masks[0];
                    this.shader.setUniform('mask', mask);
                    // Draw a rectangle covering the whole canvas to apply the shader
                    _r.fill(0,0,0,0);
                    _r.noStroke();
                    _r.rect(-_r.width/2, -_r.height/2, _r.width, _r.height);
                    _r.pop();
                    // Clear the mask after drawing
                    mask.clear()
                }
                // We cache the new color here
                if (!_isLast) {
                    this.currentColor = this.getPigment(_color);
                    if (webgl_mask) this.color1 = this.currentColor;
                    else this.color2 = this.currentColor;
                }
            }

            if (_isLast) {
                this.isBlending = false;
                if (webgl_mask) this.blending1 = this.isBlending
                else this.blending2 = this.isBlending
            }
        },

        // Vertex shader source code
        vert: `precision highp float;attribute vec3 aPosition;attribute vec2 aTexCoord;uniform mat4 uModelViewMatrix,uProjectionMatrix;varying vec2 vVertTexCoord;void main(){gl_Position=uProjectionMatrix*uModelViewMatrix*vec4(aPosition,1);vVertTexCoord=aTexCoord;}`,
        
        // Fragment shader source code with blending operations
        // For unminified shader see shader_unminified.frag
        frag: `precision highp float;varying vec2 vVertTexCoord;uniform sampler2D source,mask;uniform vec4 addColor;uniform vec3 random;uniform bool active;
        #ifndef SPECTRAL
        #define SPECTRAL
        float x(float v){return v<.04045?v/12.92:pow((v+.055)/1.055,2.4);}float v(float v){return v<.0031308?v*12.92:1.055*pow(v,1./2.4)-.055;}vec3 m(vec3 v){return vec3(x(v[0]),x(v[1]),x(v[2]));}vec3 f(vec3 f){return clamp(vec3(v(f[0]),v(f[1]),v(f[2])),0.,1.);}void f(vec3 v,out float m,out float f,out float x,out float y,out float z,out float i,out float r){m=min(v.x,min(v.y,v.z));v-=m;f=min(v.y,v.z);x=min(v.x,v.z);y=min(v.x,v.y);z=min(max(0.,v.x-v.z),max(0.,v.x-v.y));i=min(max(0.,v.y-v.z),max(0.,v.y-v.x));r=min(max(0.,v.z-v.y),max(0.,v.z-v.x));}void f(vec3 v,inout float i[38]){float x,y,d,z,o,m,e;f(v,x,y,d,z,o,m,e);i[0]=max(1e-4,x+y*.96853629+d*.51567122+z*.02055257+o*.03147571+m*.49108579+e*.97901834);i[1]=max(1e-4,x+y*.96855103+d*.5401552+z*.02059936+o*.03146636+m*.46944057+e*.97901649);i[2]=max(1e-4,x+y*.96859338+d*.62645502+z*.02062723+o*.03140624+m*.4016578+e*.97901118);i[3]=max(1e-4,x+y*.96877345+d*.75595012+z*.02073387+o*.03119611+m*.2449042+e*.97892146);i[4]=max(1e-4,x+y*.96942204+d*.92826996+z*.02114202+o*.03053888+m*.0682688+e*.97858555);i[5]=max(1e-4,x+y*.97143709+d*.97223624+z*.02233154+o*.02856855+m*.02732883+e*.97743705);i[6]=max(1e-4,x+y*.97541862+d*.98616174+z*.02556857+o*.02459485+m*.013606+e*.97428075);i[7]=max(1e-4,x+y*.98074186+d*.98955255+z*.03330189+o*.0192952+m*.01000187+e*.96663223);i[8]=max(1e-4,x+y*.98580992+d*.98676237+z*.05185294+o*.01423112+m*.01284127+e*.94822893);i[9]=max(1e-4,x+y*.98971194+d*.97312575+z*.10087639+o*.01033111+m*.02636635+e*.89937713);i[10]=max(1e-4,x+y*.99238027+d*.91944277+z*.24000413+o*.00765876+m*.07058713+e*.76070164);i[11]=max(1e-4,x+y*.99409844+d*.32564851+z*.53589066+o*.00593693+m*.70421692+e*.4642044);i[12]=max(1e-4,x+y*.995172+d*.13820628+z*.79874659+o*.00485616+m*.85473994+e*.20123039);i[13]=max(1e-4,x+y*.99576545+d*.05015143+z*.91186529+o*.00426186+m*.95081565+e*.08808402);i[14]=max(1e-4,x+y*.99593552+d*.02912336+z*.95399623+o*.00409039+m*.9717037+e*.04592894);i[15]=max(1e-4,x+y*.99564041+d*.02421691+z*.97137099+o*.00438375+m*.97651888+e*.02860373);i[16]=max(1e-4,x+y*.99464769+d*.02660696+z*.97939505+o*.00537525+m*.97429245+e*.02060067);i[17]=max(1e-4,x+y*.99229579+d*.03407586+z*.98345207+o*.00772962+m*.97012917+e*.01656701);i[18]=max(1e-4,x+y*.98638762+d*.04835936+z*.98553736+o*.0136612+m*.9425863+e*.01451549);i[19]=max(1e-4,x+y*.96829712+d*.0001172+z*.98648905+o*.03181352+m*.99989207+e*.01357964);i[20]=max(1e-4,x+y*.89228016+d*8.554e-5+z*.98674535+o*.10791525+m*.99989891+e*.01331243);i[21]=max(1e-4,x+y*.53740239+d*.85267882+z*.98657555+o*.46249516+m*.13823139+e*.01347661);i[22]=max(1e-4,x+y*.15360445+d*.93188793+z*.98611877+o*.84604333+m*.06968113+e*.01387181);i[23]=max(1e-4,x+y*.05705719+d*.94810268+z*.98559942+o*.94275572+m*.05628787+e*.01435472);i[24]=max(1e-4,x+y*.03126539+d*.94200977+z*.98507063+o*.96860996+m*.06111561+e*.01479836);i[25]=max(1e-4,x+y*.02205445+d*.91478045+z*.98460039+o*.97783966+m*.08987709+e*.0151525);i[26]=max(1e-4,x+y*.01802271+d*.87065445+z*.98425301+o*.98187757+m*.13656016+e*.01540513);i[27]=max(1e-4,x+y*.0161346+d*.78827548+z*.98403909+o*.98377315+m*.22169624+e*.01557233);i[28]=max(1e-4,x+y*.01520947+d*.65738359+z*.98388535+o*.98470202+m*.32176956+e*.0156571);i[29]=max(1e-4,x+y*.01475977+d*.59909403+z*.98376116+o*.98515481+m*.36157329+e*.01571025);i[30]=max(1e-4,x+y*.01454263+d*.56817268+z*.98368246+o*.98537114+m*.4836192+e*.01571916);i[31]=max(1e-4,x+y*.01444459+d*.54031997+z*.98365023+o*.98546685+m*.46488579+e*.01572133);i[32]=max(1e-4,x+y*.01439897+d*.52110241+z*.98361309+o*.98550011+m*.47440306+e*.01572502);i[33]=max(1e-4,x+y*.0143762+d*.51041094+z*.98357259+o*.98551031+m*.4857699+e*.01571717);i[34]=max(1e-4,x+y*.01436343+d*.50526577+z*.98353856+o*.98550741+m*.49267971+e*.01571905);i[35]=max(1e-4,x+y*.01435687+d*.5025508+z*.98351247+o*.98551323+m*.49625685+e*.01571059);i[36]=max(1e-4,x+y*.0143537+d*.50126452+z*.98350101+o*.98551563+m*.49807754+e*.01569728);i[37]=max(1e-4,x+y*.01435408+d*.50083021+z*.98350852+o*.98551547+m*.49889859+e*.0157002);}vec3 t(vec3 x){mat3 i;i[0]=vec3(3.24306333,-1.53837619,-.49893282);i[1]=vec3(-.96896309,1.87542451,.04154303);i[2]=vec3(.05568392,-.20417438,1.05799454);float v=dot(i[0],x),y=dot(i[1],x),o=dot(i[2],x);return f(vec3(v,y,o));}vec3 d(float m[38]){vec3 i=vec3(0);i+=m[0]*vec3(6.469e-5,1.84e-6,.00030502);i+=m[1]*vec3(.00021941,6.21e-6,.00103681);i+=m[2]*vec3(.00112057,3.101e-5,.00531314);i+=m[3]*vec3(.00376661,.00010475,.01795439);i+=m[4]*vec3(.01188055,.00035364,.05707758);i+=m[5]*vec3(.02328644,.00095147,.11365162);i+=m[6]*vec3(.03455942,.00228226,.17335873);i+=m[7]*vec3(.03722379,.00420733,.19620658);i+=m[8]*vec3(.03241838,.0066888,.18608237);i+=m[9]*vec3(.02123321,.0098884,.13995048);i+=m[10]*vec3(.01049099,.01524945,.08917453);i+=m[11]*vec3(.00329584,.02141831,.04789621);i+=m[12]*vec3(.00050704,.03342293,.02814563);i+=m[13]*vec3(.00094867,.05131001,.01613766);i+=m[14]*vec3(.00627372,.07040208,.0077591);i+=m[15]*vec3(.01686462,.08783871,.00429615);i+=m[16]*vec3(.02868965,.09424905,.00200551);i+=m[17]*vec3(.04267481,.09795667,.00086147);i+=m[18]*vec3(.05625475,.09415219,.00036904);i+=m[19]*vec3(.0694704,.08678102,.00019143);i+=m[20]*vec3(.08305315,.07885653,.00014956);i+=m[21]*vec3(.0861261,.0635267,9.231e-5);i+=m[22]*vec3(.09046614,.05374142,6.813e-5);i+=m[23]*vec3(.08500387,.04264606,2.883e-5);i+=m[24]*vec3(.07090667,.03161735,1.577e-5);i+=m[25]*vec3(.05062889,.02088521,3.94e-6);i+=m[26]*vec3(.03547396,.01386011,1.58e-6);i+=m[27]*vec3(.02146821,.00810264,0);i+=m[28]*vec3(.01251646,.0046301,0);i+=m[29]*vec3(.00680458,.00249138,0);i+=m[30]*vec3(.00346457,.0012593,0);i+=m[31]*vec3(.00149761,.00054165,0);i+=m[32]*vec3(.0007697,.00027795,0);i+=m[33]*vec3(.00040737,.00014711,0);i+=m[34]*vec3(.00016901,6.103e-5,0);i+=m[35]*vec3(9.522e-5,3.439e-5,0);i+=m[36]*vec3(4.903e-5,1.771e-5,0);i+=m[37]*vec3(2e-5,7.22e-6,0);return i;}float d(float y,float m,float v){float z=m*pow(v,2.);return z/(y*pow(1.-v,2.)+z);}vec3 f(vec3 v,vec3 y,float z){vec3 x=m(v),o=m(y);float i[38],a[38];f(x,i);f(o,a);float r=d(i)[1],e=d(a)[1];z=d(r,e,z);float s[38];for(int u=0;u<38;u++){float p=(1.-z)*(pow(1.-i[u],2.)/(2.*i[u]))+z*(pow(1.-a[u],2.)/(2.*a[u]));s[u]=1.+p-sqrt(pow(p,2.)+2.*p);}return t(d(s));}vec4 f(vec4 v,vec4 x,float y){return vec4(f(v.xyz,x.xyz,y),mix(v.w,x.w,y));}
        #endif
        float d(vec2 m,vec2 v,float y,out vec2 i){vec2 f=vec2(m.x+m.y*.5,m.y),x=floor(f),o=fract(f);float z=step(o.y,o.x);vec2 d=vec2(z,1.-z),r=x+d,e=x+1.,a=vec2(x.x-x.y*.5,x.y),p=vec2(a.x+d.x-d.y*.5,a.y+d.y),s=vec2(a.x+.5,a.y+1.),w=m-a,g=m-p,k=m-s;vec3 u,c,t,A;if(any(greaterThan(v,vec2(0)))){t=vec3(a.x,p.x,s);A=vec3(a.y,p.y,s.y);if(v.x>0.)t=mod(vec3(a.x,p.x,s),v.x);if(v.y>0.)A=mod(vec3(a.y,p.y,s.y),v.y);u=floor(t+.5*A+.5);c=floor(A+.5);}else u=vec3(x.x,r.x,e),c=vec3(x.y,r.y,e.y);vec3 S=mod(u,289.);S=mod((S*51.+2.)*S+c,289.);S=mod((S*34.+10.)*S,289.);vec3 b=S*.07482+y,C=cos(b),D=sin(b);vec2 h=vec2(C.x,D),B=vec2(C.y,D.y),E=vec2(C.z,D.z);vec3 F=.8-vec3(dot(w,w),dot(g,g),dot(k,k));F=max(F,0.);vec3 G=F*F,H=G*G,I=vec3(dot(h,w),dot(B,g),dot(E,k)),J=G*F,K=-8.*J*I;i=10.9*(H.x*h+K.x*w+(H.y*B+K.y*g)+(H.z*E+K.z*k));return 10.9*dot(H,I);}vec4 d(vec3 v,float x){return vec4(mix(v,vec3(dot(vec3(.299,.587,.114),v)),x),1);}float f(vec2 v,float x,float y,float f){return fract(sin(dot(v,vec2(x,y)))*f);}void main(){vec4 v=texture2D(mask,vVertTexCoord);if(v.x>0.){vec2 x=vec2(12.9898,78.233),o=vec2(7.9898,58.233),m=vec2(17.9898,3.233);float y=f(vVertTexCoord,x.x,x.y,43358.5453)*2.-1.,z=f(vVertTexCoord,o.x,o.y,43213.5453)*2.-1.,e=f(vVertTexCoord,m.x,m.y,33358.5453)*2.-1.;const vec2 i=vec2(0);vec2 s;vec4 r;if(active){float a=d(vVertTexCoord*5.,i,10.*random.x,s),p=d(vVertTexCoord*5.,i,10.*random.y,s),g=d(vVertTexCoord*5.,i,10.*random.z,s),k=.25+.25*d(vVertTexCoord*4.,i,3.*random.x,s);r=vec4(d(addColor.xyz,k).xyz+vec3(a,p,g)*.03*abs(addColor.x-addColor.y-addColor.z),1);}else r=vec4(addColor.xyz,1);if(v.w>.7){float a=.5*(v.w-.7);r=r*(1.-a)-vec4(.5)*a;}vec3 a=f(texture2D(source,vVertTexCoord).xyz,r.xyz,.9*v.w);gl_FragColor=vec4(a+.01*vec3(y,z,e),1);}}`
    }

    /**
     * This function forces standard-brushes to be updated into the canvas
     */
    export function reDraw() {
        _r.push();
        _r.translate(-Matrix.trans()[0],-Matrix.trans()[1])
        _r.image(Mix.masks[2], -_r.width/2, -_r.height/2)
        Mix.masks[2].clear()
        _r.pop();
    }

    /**
     * This function forces marker-brushes and fills to be updated into the canvas
     */
    export function reBlend() {
        Mix.blend(false, true)
        Mix.blend(false, true, true)
    }

    /**
     * Register methods after setup() and post draw() for belding last buffered color
     */
    function _registerMethods (p5p) {
        p5p.registerMethod('afterSetup', () => Mix.blend(false, true));
        p5p.registerMethod('afterSetup', () => Mix.blend(false, true, true));
        p5p.registerMethod('post', () => Mix.blend(false, true));
        p5p.registerMethod('post', () => Mix.blend(false, true, true));
    }
    if (typeof p5 !== "undefined") _registerMethods(p5.prototype);
    
    export function instance (inst) {
        _isInstanced = true;
        _inst = inst;
        _r = inst;
        _registerMethods(inst)
    }

// =============================================================================
// Section: FlowField
// =============================================================================
/**
 * The FlowField (FF) section includes functions and objects for creating and managing vector fields.
 * These fields can guide the motion of particles or brush strokes in a canvas, creating complex and
 * dynamic visual patterns.
 */

    /**
     * Activates a specific vector field by name, ensuring it's ready for use.
     * @param {string} a - The name of the vector field to activate.
     */
    export function field (a) {
        _ensureReady();
        // Check if field exists
        FF.isActive = true; // Mark the field framework as active
        FF.current = a; // Update the current field
    }

    /**
     * Deactivates the current vector field.
     */
    export function noField () {
        _ensureReady();
        FF.isActive = false;
    }

    /**
     * Adds a new vector field to the field list with a unique name and a generator function.
     * @param {string} name - The unique name for the new vector field.
     * @param {Function} funct - The function that generates the field values.
     */
    export function addField(name,funct) {
        FF.list.set(name,{gen: funct}); // Map the field name to its generator function
        FF.current = name; // Set the newly added field as the current one to be used
        FF.refresh(); // Refresh the field values using the generator function
    }

    /**
     * Refreshes the current vector field based on the generator function, which can be time-dependent.
     * @param {number} [t=0] - An optional time parameter that can affect field generation.
     */
    export function refreshField(t) {
        FF.refresh(t)
    }

    /**
     * Retrieves a list of all available vector field names.
     * @returns {Iterator<string>} An iterator that provides the names of all the fields.
     */
    export function listFields() {return Array.from(FF.list.keys())}

    /**
     * Represents a framework for managing vector fields used in dynamic simulations or visualizations.
     * @property {boolean} isActive - Indicates whether any vector field is currently active.
     * @property {Map} list - A map associating field names to their respective generator functions and current states.
     * @property {Array} field - An array representing the current vector field grid with values.
     */
    const FF = {
        isActive: false,
        list: new Map(),
        current: '',

        /**
         * Calculates a relative step length based on the renderer's dimensions, used in field grid calculations.
         * @returns {number} The relative step length value.
         */
        step_length() {
            return Math.min(_r.width,_r.height) / 1000
        },

        /**
         * Initializes the field grid and sets up the vector field's structure based on the renderer's dimensions.
         */
        create() {
            this.R = _r.width * 0.01; // Determine the resolution of the field grid
            this.left_x = -1 * _r.width; // Left boundary of the field
            this.top_y = -1 * _r.height; // Top boundary of the field
            this.num_columns = Math.round(2 * _r.width / this.R); // Number of columns in the grid
            this.num_rows = Math.round(2 * _r.height / this.R); // Number of columns in the grid
            this.addStandard(); // Add default vector fields
        },

        /**
         * Retrieves the field values for the current vector field.
         * @returns {Float64Array[]} The current vector field grid.
         */
        flow_field() {
            return this.list.get(this.current).field
        },

        /**
         * Regenerates the current vector field using its associated generator function.
         * @param {number} [t=0] - An optional time parameter that can affect field generation.
         */
        refresh(t = 0) {
            this.list.get(this.current).field = this.list.get(this.current).gen(t,this.genField())
        },

        /**
         * Generates empty field array using its associated generator function.
         * @returns {Float64Array[]} Empty vector field grid.
         */
        genField() {
            let grid = new Array(this.num_columns); // Initialize the field array
            for (let i = 0; i < this.num_columns; i++) {
                grid[i] = new Float64Array(this.num_rows);
            }
            return grid;
        },

        /**
         * Adds standard predefined vector fields to the list with unique behaviors.
         */
        addStandard() {
            addField("curved", function(t,field) {
                let angleRange = R.randInt(-25,-15);
                if (R.randInt(0,100)%2 == 0) {angleRange = angleRange * -1}
                for (let column=0;column<FF.num_columns;column++){
                    for (let row=0;row<FF.num_rows;row++) {               
                        let noise_val = _r.noise(column * 0.02 + t * 0.03, row * 0.02 + t * 0.03)
                        let angle = R.map(noise_val, 0.0, 1.0, -angleRange, angleRange)
                        field[column][row] = 3 * angle;
                    }
                }
                return field;
            })
            addField("truncated", function(t,field) {
                let angleRange = R.randInt(-25,-15) + 5 * R.sin(t);
                if (R.randInt(0,100)%2 == 0) {angleRange=angleRange*-1}
                let truncate = R.randInt(5,10);
                for (let column=0;column<FF.num_columns;column++){
                    for (let row=0;row<FF.num_rows;row++) {               
                        let noise_val = _r.noise(column * 0.02, row * 0.02)
                        let angle = Math.round(R.map(noise_val, 0.0, 1.0, -angleRange, angleRange)/truncate)*truncate;
                        field[column][row] = 4 * angle;
                    }
                }
                return field;
            })
            addField("zigzag", function(t,field) {   
                let angleRange = R.randInt(-30,-15) + Math.abs(44 * R.sin(t));
                if (R.randInt(0,100)%2 == 0) {angleRange=angleRange*-1}
                let dif = angleRange;
                let angle = 0;
                for (let column=0;column<FF.num_columns;column++){
                    for (let row=0;row<FF.num_rows;row++) {               
                        field[column][row] = angle;
                        angle = angle + dif;
                        dif = -1*dif;
                    }
                    angle = angle + dif;
                    dif = -1*dif;
                }
                return field;
            })
            addField("waves", function(t,field) {
                let sinrange = R.randInt(10,15) + 5 * R.sin(t);
                let cosrange = R.randInt(3,6) + 3 * R.cos(t);
                let baseAngle = R.randInt(20,35);
                for (let column=0;column<FF.num_columns;column++){
                    for (let row=0;row<FF.num_rows;row++) {               
                        let angle = R.sin(sinrange*column)*(baseAngle * R.cos(row*cosrange)) + R.randInt(-3,3);
                        field[column][row] = angle;
                    }
                }
                return field;
            })
            addField("seabed", function(t,field) {
                let baseSize = R.random(0.4,0.8)
                let baseAngle = R.randInt(18,26) ;
                for (let column=0;column<FF.num_columns;column++){
                    for (let row=0;row<FF.num_rows;row++) {       
                        let addition = R.randInt(15,20)        
                        let angle = baseAngle*R.sin(baseSize*row*column+addition);
                        field[column][row] = 1.1*angle * R.cos(t);
                    }
                }
                return field;
            })           
        }
    }

    /**
     * The Position class represents a point within a two-dimensional space, which can interact with a vector field.
     * It provides methods to update the position based on the field's flow and to check whether the position is
     * within certain bounds (e.g., within the field or canvas).
     */
    export class Position {

        /**
         * Constructs a new Position instance.
         * @param {number} x - The initial x-coordinate.
         * @param {number} y - The initial y-coordinate.
         */
        constructor (x,y) {
            this.update(x, y);
            this.plotted = 0;
        }

        /**
         * Updates the position's coordinates and calculates its offsets and indices within the flow field if active.
         * @param {number} x - The new x-coordinate.
         * @param {number} y - The new y-coordinate.
         */
        update (x,y) {
            this.x = x , this.y = y;
            if (FF.isActive) {
                this.x_offset = this.x - FF.left_x + Matrix.trans()[0];
                this.y_offset = this.y - FF.top_y + Matrix.trans()[1];
                this.column_index = Math.round(this.x_offset / FF.R);
                this.row_index = Math.round(this.y_offset / FF.R);
            }
        }

        /**
         * Resets the 'plotted' property to 0.
         */
        reset() {
            this.plotted = 0;
        }

        /**
         * Checks if the position is within the active flow field's bounds.
         * @returns {boolean} - True if the position is within the flow field, false otherwise.
         */
        isIn() {
            return (FF.isActive) ? ((this.column_index >= 0 && this.row_index >= 0) && (this.column_index < FF.num_columns && this.row_index < FF.num_rows)) : this.isInCanvas()
        }

        /**
         * Checks if the position is within reasonable bounds (+ half canvas on each side). 
         * @returns {boolean} - True if the position is within bounds, false otherwise.
         */
        isInCanvas() {
            let w = _r.width, h = _r.height;
            return (this.x >= -w - Matrix.trans()[0] && this.x <= w - Matrix.trans()[0]) && (this.y >= -h - Matrix.trans()[1] && this.y <= h - Matrix.trans()[1])
        }

        /**
         * Calculates the angle of the flow field at the position's current coordinates.
         * @returns {number} - The angle in radians, or 0 if the position is not in the flow field or if the flow field is not active.
         */
        angle () {
            return (this.isIn() && FF.isActive) ? FF.flow_field()[this.column_index][this.row_index] : 0
        }

        /**
         * Moves the position along the flow field by a certain length.
         * @param {number} _length - The length to move along the field.
         * @param {number} _dir - The direction of movement.
         * @param {number} _step_length - The length of each step.
         * @param {boolean} isFlow - Whether to use the flow field for movement.
         */
        moveTo (_length, _dir, _step_length = B.spacing(), isFlow = true) {
            if (this.isIn()) {
                let a, b;
                if (!isFlow) {
                    a = R.cos(-_dir);
                    b = R.sin(-_dir);
                }
                for (let i = 0; i < _length / _step_length; i++) {
                    if (isFlow) {
                        let angle = this.angle();
                        a = R.cos(angle - _dir);
                        b = R.sin(angle - _dir);
                    }
                    let x_step = (_step_length * a), y_step = (_step_length * b);
                    this.plotted += _step_length;
                    this.update(this.x + x_step, this.y + y_step);   
                }
            } else {
                this.plotted += _step_length;
            }
        }

        /**
         * Plots a point to another position within the flow field, following a Plot object
         * @param {Position} _plot - The Plot path object.
         * @param {number} _length - The length to move towards the target position.
         * @param {number} _step_length - The length of each step.
         * @param {number} _scale - The scaling factor for the plotting path.
         */
        plotTo (_plot, _length, _step_length, _scale) {
            if (this.isIn()) {
                const inverse_scale = 1 / _scale;
                for (let i = 0; i < _length / _step_length; i++) {
                    let current_angle = this.angle();
                    let plot_angle = _plot.angle(this.plotted);
                    let x_step = (_step_length * R.cos(current_angle - plot_angle));
                    let y_step = (_step_length * R.sin(current_angle - plot_angle));
                    this.plotted += _step_length * inverse_scale;
                    this.update(this.x + x_step, this.y + y_step);
                }
            } else {
                this.plotted += _step_length / scale;
            }
        }
    }


// =============================================================================
// Section: Brushes
// =============================================================================
/**
 * The Brushes section provides tools for drawing with various brush types. Each brush
 * can simulate different materials and techniques, such as spray, marker, or custom
 * image stamps. The 'B' object is central to this section, storing brush properties
 * and methods for applying brush strokes to the canvas.
 *
 * The 'B' object contains methods to control the brush, including setting the brush
 * type, color, weight, and blending mode. It also handles the application of the brush
 * to draw lines, flow lines, and shapes with specific behaviors defined by the brush type.
 * Additionally, it provides a mechanism to clip the drawing area, ensuring brush strokes
 * only appear within the defined region.
 *
 * Brush tips can vary from basic circles to complex patterns, with support for custom
 * pressure curves, opacity control, and dynamic size adjustments to simulate natural
 * drawing tools. The brush engine can create effects like variable line weight, texture,
 * and color blending, emulating real-world drawing experiences.
 *
 * The brush system is highly customizable, allowing users to define their own brushes
 * with specific behaviors and appearances. By extending the brush types and parameters,
 * one can achieve a wide range of artistic styles and techniques.
 */

    /**
     * Adjusts the global scale of brush parameters based on the provided scale factor.
     * This affects the weight, vibration, and spacing of each standard brush.
     * 
     * @param {number} _scale - The scaling factor to apply to the brush parameters.
     */
    export function scaleBrushes(_scale) {
        for (let s of _standard_brushes) {
            let params = B.list.get(s[0]).param
            params.weight *= _scale, params.vibration *= _scale, params.spacing *= _scale;
        }
        _gScale = _scale
    }
    let _gScale = 1;

    /**
     * Disables the stroke for subsequent drawing operations.
     * This function sets the brush's `isActive` property to false, indicating that no stroke
     * should be applied to the shapes drawn after this method is called.
     */
    export function noStroke() {
        B.isActive = false;
    }

    /**
     * Retrieves a list of all available brush names from the brush manager.
     * @returns {Array<string>} An array containing the names of all brushes.
     */
    export function box() {
        return Array.from(B.list.keys())
    }

    /**
     * The B object, representing a brush, contains properties and methods to manipulate
     * the brush's appearance and behavior when drawing on the canvas.
     * @type {Object}
     */
    const B = {
        isActive: true, // Indicates if the brush is active.
        list: new Map(), // Stores brush definitions by name.
        c: "#000000", // Current color of the brush.
        w: 1, // Current weight (size) of the brush.
        cr: null, // Clipping region for brush strokes.
        name: "HB", // Name of the current brush.

        /**
         * Calculates the tip spacing based on the current brush parameters.
         * @returns {number} The calculated spacing value.
         */
        spacing() {
            this.p = this.list.get(this.name).param
            if (this.p.type === "default" || this.p.type === "spray") return this.p.spacing / this.w;
            return this.p.spacing;
        },

        /**
         * Initializes the drawing state with the given parameters.
         * @param {number} x - The x-coordinate of the starting point.
         * @param {number} y - The y-coordinate of the starting point.
         * @param {number} length - The length of the line to draw.
         * @param {boolean} flow - Flag indicating if the line should follow the vector-field.
         * @param {Object|boolean} plot - The shape object to be used for plotting, or false if not plotting a shape.
         */
        initializeDrawingState(x, y, length, flow, plot) {
            this.position = new Position(x, y);
            this.length = length;
            this.flow = flow;
            this.plot = plot;
            if (plot) plot.calcIndex(0);
        },

        /**
         * Executes the drawing operation for lines or shapes.
         * @param {number} angle_scale - The angle or scale to apply during drawing.
         * @param {boolean} isPlot - Flag indicating if the operation is plotting a shape.
         */
        draw(angle_scale, isPlot) {
            if (!isPlot) this.dir = angle_scale;
            this.pushState();
                const st = this.spacing();
                const total_steps = isPlot ? Math.round(this.length * angle_scale / st) : Math.round(this.length / st);
                for (let steps = 0; steps < total_steps; steps++) {
                    this.tip(); 
                    if (isPlot) {
                        this.position.plotTo(this.plot, st, st, angle_scale);
                    } else {
                        this.position.moveTo(st, angle_scale, st, this.flow);
                    }
                }
            this.popState();
        },

        /**
         * Executes the drawing operation for a single tip.
         * @param {number} pressure - The desired pressure value.
         */
        drawTip(pressure) {
            this.pushState(true);
            this.tip(pressure)
            this.popState(true);
        },

        /**
         * Sets up the environment for a brush stroke.
         */
        pushState(isTip = false) {
            this.p = this.list.get(this.name).param
            // Pressure values for the stroke
            if (!isTip) {
                this.a = this.p.pressure.type !== "custom" ? R.random(-1, 1) : 0;
                this.b = this.p.pressure.type !== "custom" ? R.random(1, 1.5) : 0;
                this.cp = this.p.pressure.type !== "custom" ? R.random(3, 3.5) : R.random(-0.2, 0.2);
                const [min, max] = this.p.pressure.min_max;
                this.min = min;
                this.max = max;
            }
            // Blend Mode
                this.c = _r.color(this.c);
                // Select mask buffer for blend mode
                this.mask = this.p.blend ? ((this.p.type === "image") ? Mix.masks[1] : Mix.masks[0]) : Mix.masks[2];
                Matrix.trans()
                // Set the blender
                this.mask.push(); 
                this.mask.noStroke();
                (this.p.type === "image") ? this.mask.translate(Matrix.translation[0],Matrix.translation[1]) : this.mask.translate(Matrix.translation[0] + _r.width/2,Matrix.translation[1] + _r.height/2); 
                this.mask.rotate(-Matrix.rotation)
                this.mask.scale(_curScale)
                if (this.p.blend) {
                    Mix.watercolor = false;
                    if (this.p.type !== "image") Mix.blend(this.c);
                    else Mix.blend(this.c,false,true)
                    if (!isTip) this.markerTip()
                }
                this.alpha = this.calculateAlpha(); // Calcula Alpha
                this.applyColor(this.alpha); // Apply Color
        },

        /**
         * Restores the drawing state after a brush stroke is completed.
         */
        popState(isTip = false) {
            if (this.p.blend && !isTip) this.markerTip();
            this.mask.pop();
        },
        
        /**
         * Draws the tip of the brush based on the current pressure and position.
         * @param {number} pressure - The desired pressure value.
         */
        tip(custom_pressure = false) {
            let pressure = custom_pressure ? custom_pressure : this.calculatePressure(); // Calculate Pressure
            if (this.isInsideClippingArea()) { // Check if it's inside clipping area
                switch (this.p.type) { // Draw different tip types
                    case "spray":
                        this.drawSpray(pressure);
                        break;
                    case "marker":
                        this.drawMarker(pressure);
                        break;
                    case "custom":
                    case "image":
                        this.drawCustomOrImage(pressure, this.alpha);
                        break;
                    default:
                        this.drawDefault(pressure);
                        break;
                }
            }
        },

        /**
         * Calculates the pressure for the current position in the stroke.
         * @returns {number} The calculated pressure value.
         */
        calculatePressure() {
            return this.plot
            ? this.simPressure() * this.plot.pressure(this.position.plotted)
            : this.simPressure();
        },

        /**
         * Simulates brush pressure based on the current position and brush parameters.
         * @returns {number} The simulated pressure value.
         */
        simPressure () {
            if (this.p.pressure.type === "custom") {
                return R.map(this.p.pressure.curve(this.position.plotted / this.length) + this.cp, 0, 1, this.min, this.max, true);
            }
            return this.gauss()
        },

        /**
         * Generates a Gaussian distribution value for the pressure calculation.
         * @param {number} a - Center of the Gaussian bell curve.
         * @param {number} b - Width of the Gaussian bell curve.
         * @param {number} c - Shape of the Gaussian bell curve.
         * @param {number} min - Minimum pressure value.
         * @param {number} max - Maximum pressure value.
         * @returns {number} The calculated Gaussian value.
         */
        gauss(a = 0.5 + B.p.pressure.curve[0] * B.a, b = 1 - B.p.pressure.curve[1] * B.b, c = B.cp, min = B.min, max = B.max) {
            return R.map((1 / ( 1 + Math.pow(Math.abs( ( this.position.plotted - a * this.length ) / ( b * this.length / 2 ) ), 2 * c))), 0, 1, min, max);
        },

        /**
         * Calculates the alpha (opacity) level for the brush stroke based on pressure.
         * @param {number} pressure - The current pressure value.
         * @returns {number} The calculated alpha value.
         */
        calculateAlpha() {
            let opacity = (this.p.type !== "default" && this.p.type !== "spray") ? this.p.opacity / this.w : this.p.opacity;
            return opacity;
        },

        /**
         * Applies the current color and alpha to the renderer.
         * @param {number} alpha - The alpha (opacity) level to apply.
         */
        applyColor(alpha) {
            if (this.p.blend) {
                this.mask.fill(255, 0, 0, alpha / 2);
            } else {
                this.c.setAlpha(alpha);
                this.mask.fill(this.c);
            }
        },

        /**
         * Checks if the current brush position is inside the defined clipping area.
         * @returns {boolean} True if the position is inside the clipping area, false otherwise.
         */
        isInsideClippingArea() {
            if (B.cr) return this.position.x >= B.cr[0] && this.position.x <= B.cr[2] && this.position.y >= B.cr[1] && this.position.y <= B.cr[3];
            else {
                let w = 0.55 * _r.width, h = 0.55 * _r.height;
                return (this.position.x >= -w - Matrix.trans()[0] && this.position.x <= w - Matrix.trans()[0]) && (this.position.y >= -h - Matrix.trans()[1] && this.position.y <= h - Matrix.trans()[1])
            }
        },

        /**
         * Draws the spray tip of the brush.
         * @param {number} pressure - The current pressure value.
         */
        drawSpray(pressure) {
            let vibration = (this.w * this.p.vibration * pressure) + this.w * R.gaussian() * this.p.vibration / 3;
            let sw = this.p.weight * R.random(0.9,1.1);
            const iterations = this.p.quality / pressure;
            for (let j = 0; j < iterations; j++) {
                let r = R.random(0.9,1.1);
                let rX = r * vibration * R.random(-1,1);
                let yRandomFactor = R.random(-1, 1);
                let rVibrationSquared = Math.pow(r * vibration, 2);
                let sqrtPart = Math.sqrt(rVibrationSquared - Math.pow(rX, 2));
                this.mask.circle(this.position.x + rX, this.position.y + yRandomFactor * sqrtPart, sw);
            }
        },

        /**
         * Draws the marker tip of the brush.
         * @param {number} pressure - The current pressure value.
         * @param {boolean} [vibrate=true] - Whether to apply vibration effect.
         */
        drawMarker(pressure, vibrate = true) {
            let vibration = vibrate ? this.w * this.p.vibration : 0;
            let rx = vibrate ? vibration * R.random(-1,1) : 0;
            let ry = vibrate ? vibration * R.random(-1,1) : 0;
            this.mask.circle(this.position.x + rx, this.position.y + ry, this.w * this.p.weight * pressure)
        },

        /**
         * Draws the custom or image tip of the brush.
         * @param {number} pressure - The current pressure value.
         * @param {number} alpha - The alpha (opacity) level to apply.
         * @param {boolean} [vibrate=true] - Whether to apply vibration effect.
         */
        drawCustomOrImage(pressure, alpha, vibrate = true) {
            this.mask.push();
            let vibration = vibrate ? this.w * this.p.vibration : 0;
            let rx = vibrate ? vibration * R.random(-1,1) : 0;
            let ry = vibrate ? vibration * R.random(-1,1) : 0;
            this.mask.translate(this.position.x + rx, this.position.y + ry);
            this.adjustSizeAndRotation(this.w * pressure, alpha)
            this.p.tip(this.mask);
            this.mask.pop();
        },

        /**
         * Draws the default tip of the brush.
         * @param {number} pressure - The current pressure value.
         */
        drawDefault(pressure) {
            let vibration = this.w * this.p.vibration * (this.p.definition + (1-this.p.definition) * R.gaussian() * this.gauss(0.5,0.9,5,0.2,1.2) / pressure);
            if (R.random(0, this.p.quality * pressure) > 0.4) {
                this.mask.circle(this.position.x + 0.7 * vibration * R.random(-1,1),this.position.y + vibration * R.random(-1,1), pressure * this.p.weight * R.random(0.85,1.15));
            }
        },

        /**
         * Adjusts the size and rotation of the brush tip before drawing.
         * @param {number} pressure - The current pressure value.
         * @param {number} alpha - The alpha (opacity) level to apply.
         */
        adjustSizeAndRotation(pressure, alpha) {
            this.mask.scale(pressure);
            if (this.p.type === "image") (this.p.blend) ? this.mask.tint(255, 0, 0, alpha / 2) : this.mask.tint(this.mask.red(this.c), this.mask.green(this.c), this.mask.blue(this.c), alpha);
            if (this.p.rotate === "random") this.mask.rotate(R.randInt(0,360));
            else if (this.p.rotate === "natural") {
                let angle = ((this.plot) ? - this.plot.angle(this.position.plotted) : - this.dir) + (this.flow ? this.position.angle() : 0)
                this.mask.rotate(angle)
            }
        },

        /**
         * Draws the marker tip with a blend effect.
         */
        markerTip() {
            if (this.isInsideClippingArea()) {
                let pressure = this.calculatePressure();
                let alpha = this.calculateAlpha(pressure);
                this.mask.fill(255, 0, 0, alpha / 1.5);
                if (B.p.type === "marker") {
                    for (let s = 1; s < 5; s++) {
                        this.drawMarker(pressure * s/5, false)
                    }
                } else if (B.p.type === "custom" || B.p.type === "image") {
                    for (let s = 1; s < 5; s++) {
                        this.drawCustomOrImage(pressure * s/5, alpha, false)
                    }
                }
            }
        },
    }

    /**
     * Adds a new brush with the specified parameters to the brush list.
     * @param {string} name - The unique name for the new brush.
     * @param {BrushParameters} params - The parameters defining the brush behavior and appearance.
     */
    export function add (a, b) {
        const isBlendableType = b.type === "marker" || b.type === "custom" || b.type === "image";
        if (!isBlendableType  && b.type !== "spray") b.type = "default";
        if (b.type === "image") {
            T.add(b.image.src);
            b.tip = () => B.mask.image(T.tips.get(B.p.image.src), -B.p.weight / 2, -B.p.weight / 2, B.p.weight, B.p.weight);
        }
        b.blend = ((isBlendableType && b.blend !== false) || b.blend) ? true : false;
        B.list.set(a, { param: b, colors: [], buffers: [] });
    }

    /**
     * Sets the current brush with the specified name, color, and weight.
     * @param {string} brushName - The name of the brush to set as current.
     * @param {string|p5.Color} color - The color to set for the brush.
     * @param {number} weight - The weight (size) to set for the brush.
     */  
    export function set(brushName, color, weight = 1) {
        pick(brushName);
        B.c = color;
        B.w = weight;
        B.isActive = true;
    }

    /**
     * Sets only the current brush type based on the given name.
     * @param {string} brushName - The name of the brush to set as current.
     */
    export function pick(brushName) {
        B.name = brushName;
    }

    /**
     * Sets the color of the current brush.
     * @param {number|string|p5.Color} r - The red component of the color, a CSS color string, or a p5.Color object.
     * @param {number} [g] - The green component of the color.
     * @param {number} [b] - The blue component of the color.
     */        
    export function stroke(r,g,b) {
        if (arguments.length > 0) B.c = (arguments.length < 2) ? r : [r,g,b]; 
        B.isActive = true;
    }

    /**
     * Sets the weight (size) of the current brush.
     * @param {number} weight - The weight to set for the brush.
     */        
    export function strokeWeight(weight) {
        B.w = weight;
    }

    /**
     * Defines a clipping region for the brush strokes.
     * @param {number[]} clippingRegion - An array defining the clipping region as [x1, y1, x2, y2].
     */
    export function clip(clippingRegion) {
        B.cr = clippingRegion;
    }

    /**
     * Disables clipping region.
     */
    export function noClip() {
        B.cr = null;
    }

    /**
     * Draws a line using the current brush from (x1, y1) to (x2, y2).
     * @param {number} x1 - The x-coordinate of the start point.
     * @param {number} y1 - The y-coordinate of the start point.
     * @param {number} x2 - The x-coordinate of the end point.
     * @param {number} y2 - The y-coordinate of the end point.
     */        
    export function line(x1,y1,x2,y2) {
        _ensureReady();
        let d = R.dist(x1,y1,x2,y2)
        if (d == 0) return;
        B.initializeDrawingState(x1, y1, d, false, false);
        let angle = _calculateAngle(x1,y1,x2,y2);
        B.draw(angle, false);
    }

    /**
     * Draws a flow line with the current brush from a starting point in a specified direction.
     * @param {number} x - The x-coordinate of the starting point.
     * @param {number} y - The y-coordinate of the starting point.
     * @param {number} length - The length of the line to draw.
     * @param {number} dir - The direction in which to draw the line. Angles measured anticlockwise from the x-axis
     */
    export function flowLine(x,y,length,dir) {
        _ensureReady();
        B.initializeDrawingState(x, y, length, true, false);
        B.draw(R.toDegrees(dir), false);
    }

    /**
     * Draws a predefined shape/plot with a flowing brush stroke.
     * @param {Object} p - An object representing the shape to draw.
     * @param {number} x - The x-coordinate of the starting position to draw the shape.
     * @param {number} y - The y-coordinate of the starting position to draw the shape.
     * @param {number} scale - The scale at which to draw the shape.
     */
    export function plot(p,x,y,scale) {
        _ensureReady();
        B.initializeDrawingState(x, y, p.length, true, p);
        B.draw(scale, true);
    }

// =============================================================================
// Section: Loading Custom Image Tips
// =============================================================================
/**
 * This section defines the functionality for managing the loading and processing of image tips.
 * Images are loaded from specified source URLs, converted to a white tint for visual effects,
 * and then stored for future use. It includes methods to add new images, convert their color
 * scheme, and integrate them into the p5.js graphics library.
 */

    /**
     * A utility object for loading images, converting them to a red tint, and managing their states.
     */
    const T = {
        tips: new Map(),

        /**
         * Adds an image to the tips Map and sets up loading and processing.
         * 
         * @param {string} src - The source URL of the image to be added and processed.
         */
        add (src) {
            // Initially set the source as not processed
            this.tips.set(src,false)
        },

        /**
         * Converts the given image to a white tint by setting all color channels to white and adjusting the alpha channel.
         * 
         * @param {Image} image - The image to be converted.
         */
        imageToWhite (image) {
            image.loadPixels()
            // Modify the image data to create a white tint effect
            for (let i = 0; i < 4 * image.width * image.height; i += 4) {
                // Calculate the average for the grayscale value
                let average = (image.pixels[i] + image.pixels[i + 1] + image.pixels[i + 2]) / 3;
                // Set all color channels to white
                image.pixels[i] = image.pixels[i + 1] = image.pixels[i + 2] = 255;
                // Adjust the alpha channel to the inverse of the average, creating the white tint effect
                image.pixels[i + 3] = 255 - average;
            }
            image.updatePixels()
        },
        /**
         * Loads all processed images into the p5.js environment.
         * If no images are in the tips Map, logs a warning message.
         */
        load() {
            for (let key of this.tips.keys()){
                let _r = _isInstanced ? _inst : window.self;
                let image = _r.loadImage(key, () => T.imageToWhite(image))
                this.tips.set(key, image)
            }
        }
    }

// =============================================================================
// Section: Hatching
// =============================================================================
/**
 * The Hatching section of the code is responsible for creating and drawing hatching patterns.
 * Hatching involves drawing closely spaced parallel lines.
 */

    /**
     * Activates hatching for subsequent geometries, with the given params.
     * @param {number} dist - The distance between hatching lines.
     * @param {number} angle - The angle at which hatching lines are drawn.
     * @param {Object} options - An object containing optional parameters to affect the hatching style:
     *                           - rand: Introduces randomness to the line placement.
     *                           - continuous: Connects the end of a line with the start of the next.
     *                           - gradient: Changes the distance between lines to create a gradient effect.
     *                           Defaults to {rand: false, continuous: false, gradient: false}.
     */
    export function hatch(dist = 5, angle = 45, options = {rand: false, continuous: false, gradient: false}) {
        H.isActive = true;
        H.hatchingParams = [dist, angle, options]
    }

    /**
     * Sets the brush type, color, and weight for subsequent hatches.
     * If this function is not called, hatches will use the parameters from stroke operations.
     * @param {string} brushName - The name of the brush to set as current.
     * @param {string|p5.Color} color - The color to set for the brush.
     * @param {number} weight - The weight (size) to set for the brush.
     */  
    export function setHatch(brush, color = "black", weight = 1) {
        H.hatchingBrush = [brush, color, weight]
    }

    /**
     * Disables hatching for subsequent shapes
     */
    export function noHatch() {
        H.isActive = false;
        H.hatchingBrush = false;
    }

    /**
     * Object to hold the current hatch state and to perform hatch calculation
     */
    const H = {
        isActive: false,
        hatchingParams: [5,45,{}],
        hatchingBrush: false,

        /**
         * Creates a hatching pattern across the given polygons.
         * 
         * @param {Array|Object} polygons - A single polygon or an array of polygons to apply the hatching.
         */
        hatch(polygons) {

            let dist = H.hatchingParams[0];
            let angle = H.hatchingParams[1];
            let options = H.hatchingParams[2];
    
            // Save current stroke state
            let strokeColor = B.c, strokeBrush = B.name, strokeWeight = B.w, strokeActive = B.isActive;
            // Change state if hatch has been set to different params than stroke
            if (H.hatchingBrush) set(H.hatchingBrush[0],H.hatchingBrush[1],H.hatchingBrush[2])
            
            // Transform to degrees and between 0-180
            angle = R.toDegrees(angle) % 180;

            // Calculate the bounding area of the provided polygons
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            let processPolygonPoints = (p) => {
                for (let a of p.a) {
                    // (process points of a single polygon to find bounding area)
                    minX = a[0] < minX ? a[0] : minX;
                    maxX = a[0] > maxX ? a[0] : maxX;
                    minY = a[1] < minY ? a[1] : minY;
                    maxY = a[1] > maxY ? a[1] : maxY;
                }
            };

            // Ensure polygons is an array and find overall bounding area
            if (!Array.isArray(polygons)) {polygons = [polygons]}
            for (let p of polygons) {processPolygonPoints(p);}

            // Create a bounding polygon
            let ventana = new Polygon([[minX,minY],[maxX,minY],[maxX,maxY],[minX,maxY]])

            // Set initial values for line generation
            let startY = (angle <= 90 && angle >= 0) ? minY : maxY;
            let gradient = options.gradient ? R.map(options.gradient,0,1,1,1.1,true) : 1
            let dots = [];
            let i = 0;
            let dist1 = dist;
            let linea = (i) => {
                return {
                    point1 : { x: minX + dist1 * i * R.cos(-angle+90),                   y: startY + dist1 * i * R.sin(-angle+90) },
                    point2 : { x: minX + dist1 * i * R.cos(-angle+90) + R.cos(-angle),   y: startY + dist1 * i * R.sin(-angle+90) + R.sin(-angle) }
                }
            }

            // Generate lines and calculate intersections with polygons
            // Loop through the lines based on the distance and angle to calculate intersections with the polygons
            // The loop continues until a line does not intersect with the bounding window polygon
            // Each iteration accounts for the gradient effect by adjusting the distance between lines
            while (ventana.intersect(linea(i)).length > 0) {
                let tempArray = [];
                for (let p of polygons) {tempArray.push(p.intersect(linea(i)))};
                dots[i] = tempArray.flat().sort((a, b) => (a.x === b.x) ? (a.y - b.y) : (a.x - b.x));
                dist1 *= gradient
                i++
            }

            // Filter out empty arrays to avoid drawing unnecessary lines
            let gdots = []
            for (let dd of dots) {if (typeof dd[0] !== "undefined") { gdots.push(dd)} }

            // Draw the hatching lines using the calculated intersections
            // If the 'rand' option is enabled, add randomness to the start and end points of the lines
            // If the 'continuous' option is set, connect the end of one line to the start of the next
            let r = options.rand ? options.rand : 0;
            for (let j = 0; j < gdots.length; j++) {
                let dd = gdots[j]
                let shouldDrawContinuousLine = j > 0 && options.continuous;
                for (let i = 0; i < dd.length-1; i += 2) {
                    if (r !== 0) {
                        dd[i].x += r * dist * R.random(-10, 10);
                        dd[i].y += r * dist * R.random(-10, 10);
                        dd[i + 1].x += r * dist * R.random(-10, 10);
                        dd[i + 1].y += r * dist * R.random(-10, 10);
                    }
                    line(dd[i].x, dd[i].y, dd[i + 1].x, dd[i + 1].y);
                    if (shouldDrawContinuousLine) {
                        line(gdots[j - 1][1].x, gdots[j - 1][1].y, dd[i].x, dd[i].y);
                    }
                }
            }

            // Change state back to previous
            set(strokeBrush, strokeColor, strokeWeight)
            B.isActive = strokeActive;
        }
    }

    export const hatchArray = H.hatch;
    
// =============================================================================
// Section: Polygon management. Basic geometries
// =============================================================================
/**
 * This section includes the Polygon class for managing polygons and functions for drawing basic geometries
 * like rectangles and circles. It provides methods for creating, intersecting, drawing, and filling polygons,
 * as well as hatching them with a given distance and angle. Additional functions leverage the Polygon class
 * to draw rectangles with options for randomness and different drawing modes.
 */

    /**
     * Represents a polygon with a set of vertices.
     */
    export class Polygon {

        /**
         * Constructs the Polygon object from an array of points.
         * 
         * @param {Array} pointsArray - An array of points, where each point is an array of two numbers [x, y].
         */
        constructor (array , bool = false) {
            this.a = array;
            this.vertices = array.map(a => ({ x: a[0], y: a[1] }));
            if (bool) this.vertices = array;
            this.sides = this.vertices.map((v, i, arr) => [v, arr[(i + 1) % arr.length]]);
        }
        /**
         * Intersects a given line with the polygon, returning all intersection points.
         * 
         * @param {Object} line - The line to intersect with the polygon, having two properties 'point1' and 'point2'.
         * @returns {Array} An array of intersection points (each with 'x' and 'y' properties) or an empty array if no intersections.
         */
        intersect (line) {
            // Check if the result has been cached
            let cacheKey = `${line.point1.x},${line.point1.y}-${line.point2.x},${line.point2.y}`;
            if (this._intersectionCache && this._intersectionCache[cacheKey]) {
                return this._intersectionCache[cacheKey];
            }
            let points = []
            for (let s of this.sides) {
                let intersection = _intersectLines(line.point1,line.point2,s[0],s[1])
                if (intersection !== false) {points.push(intersection)}
            }
            // Cache the result
            if (!this._intersectionCache) this._intersectionCache = {};
            this._intersectionCache[cacheKey] = points;

            return points;
        }
        /**
         * Draws the polygon by iterating over its sides and drawing lines between the vertices.
         */
        draw (_brush = false, _color, _weight) {
            let curState = B.isActive;
            if (_brush) set(_brush, _color, _weight)
            if (B.isActive) {
                _ensureReady();
                for (let s of this.sides) {line(s[0].x,s[0].y,s[1].x,s[1].y)}
            }
            B.isActive = curState;
        }
        /**
         * Fills the polygon using the current fill state.
         */
        fill (_color = false, _opacity, _bleed, _texture, _border, _direction) {
            let curState = F.isActive;
            if (_color) {
                fill(_color, _opacity)
                bleed(_bleed, _direction)
                fillTexture(_texture, _border)
            }
            if (F.isActive) {
                _ensureReady();
                F.fill(this);
            }
            F.isActive = curState;
        }
        /**
         * Creates hatch lines across the polygon based on a given distance and angle.
         */
        hatch (_dist = false, _angle, _options) {
            let curState = H.isActive;
            if (_dist) hatch(_dist, _angle, _options)
            if (H.isActive) {
                _ensureReady();
                H.hatch(this)
            }
            H.isActive = curState;
        }

        erase (c = false, a = E.a) {
            if (E.isActive || c) {
                Mix.masks[2].push()
                Mix.masks[2].noStroke()
                let ccc = _r.color(c ? c : E.c)
                ccc.setAlpha(a)
                Mix.masks[2].fill(ccc)
                Mix.masks[2].beginShape()
                for (let p of this.vertices) {
                    Mix.masks[2].vertex(p.x,p.y)
                }
                Mix.masks[2].endShape(_r.CLOSE)
                Mix.masks[2].pop()
            }
        }

        show () {
            this.fill();
            this.hatch();
            this.draw();
            this.erase();
        }
    }

    /**
     * Creates a Polygon from a given array of points and performs drawing and filling
     * operations based on active states.
     * 
     * @param {Array} pointsArray - An array of points where each point is an array of two numbers [x, y].
     */
    export function polygon(pointsArray) {
        // Create a new Polygon instance
        let polygon = new Polygon(pointsArray);
        polygon.show()
    }

    /**
     * Draws a rectangle on the canvas and fills it with the current fill color.
     * 
     * @param {number} x - The x-coordinate of the rectangle.
     * @param {number} y - The y-coordinate of the rectangle.
     * @param {number} w - The width of the rectangle.
     * @param {number} h - The height of the rectangle.
     * @param {boolean} [mode=CORNER] - If CENTER, the rectangle is drawn centered at (x, y).
     */
    export function rect(x,y,w,h,mode = _r.CORNER) {
        if (mode == _r.CENTER) x = x - w / 2, y = y - h / 2;
        if (FF.isActive) {
            beginShape(0);
            vertex(x,y);
            vertex(x+w,y);
            vertex(x+w,y+h);
            vertex(x,y+h);
            endShape(_r.CLOSE)
        } else {
            let p = new Polygon([[x,y],[x+w,y],[x+w,y+h],[x,y+h]])
            p.show()
        }
    }


// =============================================================================
// Section: Shape, Stroke, and Spline. Plot System
// =============================================================================
/**
 * This section defines the functionality for creating and managing plots, which are used to draw complex shapes,
 * strokes, and splines on a canvas. It includes classes and functions to create plots of type "curve" or "segments",
 * manipulate them with operations like adding segments and applying rotations, and render them as visual elements
 * like polygons or strokes. The spline functionality allows for smooth curve creation using control points with 
 * specified curvature, which can be rendered directly or used as part of more complex drawings.
 */

    /**
     * The Plot class is central to the plot system, serving as a blueprint for creating and manipulating a variety
     * of shapes and paths. It manages a collection of segments, each defined by an angle, length, and pressure,
     * allowing for intricate designs such as curves and custom strokes. Plot instances can be transformed by rotation,
     * and their visual representation can be controlled through pressure and angle calculations along their length.
     */
    export class Plot {

        /**
         * Creates a new Plot.
         * @param {string} _type - The type of plot, "curve" or "segments"
         */
        constructor (_type) {
            this.segments = [], this.angles = [], this.pres = [];
            this.type = _type;
            this.dir = 0;
            this.calcIndex(0);
            this.pol = false;
        }

        /**
         * Adds a segment to the plot with specified angle, length, and pressure.
         * @param {number} _a - The angle of the segment.
         * @param {number} _length - The length of the segment.
         * @param {number} _pres - The pressure of the segment.
         * @param {boolean} _degrees - Whether the angle is in degrees.
         */
        addSegment (_a = 0,_length = 0,_pres = 1,_degrees = false) {
            // Remove the last angle if the angles array is not empty
            if (this.angles.length > 0) {
                this.angles.splice(-1)
            }
            // Convert to degrees and normalize between 0 and 360 degrees
            _a = (_degrees) ? (_a % 360 + 360) % 360 : R.toDegrees(_a);
            // Store the angle, pressure, and segment length
            this.angles.push(_a);
            this.pres.push(_pres);
            this.segments.push(_length);
            // Calculate the total length of the plot
            this.length =  this.segments.reduce((partialSum, a) => partialSum + a, 0);
            // Push the angle again to prepare for the next segment
            this.angles.push(_a)
        }

        /**
         * Finalizes the plot by setting the last angle and pressure.
         * @param {number} _a - The final angle of the plot.
         * @param {number} _pres - The final pressure of the plot.
         * @param {boolean} _degrees - Whether the angle is in degrees.
         */
        endPlot (_a = 0, _pres = 1, _degrees = false) {
            // Convert angle to degrees if necessary
            _a = (_degrees) ? (_a % 360 + 360) % 360 : R.toDegrees(_a);
            // Replace the last angle with the final angle
            this.angles.splice(-1)
            this.angles.push(_a);
            // Store the final pressure
            this.pres.push(_pres);
        }

        /**
         * Rotates the entire plot by a given angle.
         * @param {number} _a - The angle to rotate the plot.
         */
        rotate (_a) {
            this.dir = R.toDegrees(_a);
        }

        /**
         * Calculates the pressure at a given distance along the plot.
         * @param {number} _d - The distance along the plot.
         * @returns {number} - The calculated pressure.
         */
        pressure (_d) {
            // If the distance exceeds the plot length, return the last pressure
            if (_d > this.length) return this.pres[this.pres.length-1];
            // Otherwise, calculate the pressure using the curving function
            return this.curving(this.pres,_d);
        }

        /**
         * Calculates the angle at a given distance along the plot.
         * @param {number} _d - The distance along the plot.
         * @returns {number} - The calculated angle.
         */
        angle (_d) {
            // If the distance exceeds the plot length, return the last angle
            if (_d > this.length) return this.angles[this.angles.length-1];
            // Calculate the index for the given distance
            this.calcIndex(_d);
            // Return the angle, adjusted for the plot type and direction
            return (this.type === "curve") ?
            this.curving(this.angles, _d) + this.dir :
            this.angles[this.index] + this.dir;
        }

        /**
         * Interpolates values between segments for smooth transitions.
         * @param {Array<number>} array - The array to interpolate within.
         * @param {number} _d - The distance along the plot.
         * @returns {number} - The interpolated value.
         */
        curving (array,_d) {
            let map0 = array[this.index];
            let map1 = array[this.index+1];
            if (typeof map1 == "undefined") { map1 = map0}
            if (Math.abs(map1-map0) > 180) {if (map1 > map0) {map1 = - (360-map1);} else {map0 = - (360-map0);}}
            return R.map(_d-this.suma,0,this.segments[this.index],map0,map1,true);
        }

        /**
         * Calculates the current index of the plot based on the distance.
         * @param {number} _d - The distance along the plot.
         */
        calcIndex(_d) {
            this.index = -1, this.suma = 0;
            let d = 0;
            while (d <= _d) {this.suma = d; d += this.segments[this.index+1]; this.index++;}
            return this.index
        }

        /**
         * Generates a polygon based on the plot.
         * @param {number} _x - The x-coordinate for the starting point of the polygon.
         * @param {number} _y - The y-coordinate for the starting point of the polygon.
         * @returns {Polygon} - The generated polygon.
         */
        genPol (_x,_y,_scale = 1, isHatch = false) {
            _ensureReady(); // Ensure that the drawing environment is prepared
            const step = 0.5;
            const vertices = []
            const numSteps = Math.round(this.length/step);
            const pos = new Position(_x,_y)
            let side = isHatch ? 0.15 : F.bleed_strength * 3;
            let pside = 0;
            let prevIdx = 0
            for (let i = 0; i < numSteps; i++) {
                pos.plotTo(this, step, step, 1)
                let idx = this.calcIndex(pos.plotted)
                pside += step;
                if ((pside >= this.segments[idx] * side * R.random(0.7,1.3) || idx >= prevIdx) && pos.x) {
                    vertices.push([pos.x,pos.y])
                    pside = 0;
                    if (idx >= prevIdx) prevIdx++
                }
            }
            return new Polygon(vertices);
        }

        /**
         * Draws the plot on the canvas.
         * @param {number} x - The x-coordinate to draw at.
         * @param {number} y - The y-coordinate to draw at.
         * @param {number} scale - The scale to draw with.
         */
        draw (x, y, scale) {
            if (B.isActive) {
                _ensureReady(); // Ensure that the drawing environment is prepared
                if (this.origin) x = this.origin[0], y = this.origin[1], scale = 1;
                plot(this,x,y,scale)
            }
        }

        /**
         * Fill the plot on the canvas.
         * @param {number} x - The x-coordinate to draw at.
         * @param {number} y - The y-coordinate to draw at.
         */
        fill (x, y, scale) {
            if (F.isActive) {
                _ensureReady(); // Ensure that the drawing environment is prepared
                if (this.origin) x = this.origin[0], y = this.origin[1], scale = 1;
                this.pol = this.genPol(x, y, scale)
                this.pol.fill()
            }
        }

        /**
         * Hatch the plot on the canvas.
         * @param {number} x - The x-coordinate to draw at.
         * @param {number} y - The y-coordinate to draw at.
         */
        hatch (x, y, scale) {
            if (H.isActive) {
                _ensureReady(); // Ensure that the drawing environment is prepared
                if (this.origin) x = this.origin[0], y = this.origin[1], scale = 1;
                this.pol = this.genPol(x, y, scale, true)
                this.pol.hatch()
            }
        }

        erase(x, y, scale) {
            if (E.isActive) {
                if (this.origin) x = this.origin[0], y = this.origin[1], scale = 1;
                this.pol = this.genPol(x, y, scale, true)
                Mix.masks[2].push()
                Mix.masks[2].noStroke()
                let ccc = _r.color(E.c)
                ccc.setAlpha(E.a)
                Mix.masks[2].fill(ccc)
                Mix.masks[2].beginShape()
                for (let p of this.pol.vertices) {
                    Mix.masks[2].vertex(p.x,p.y)
                }
                Mix.masks[2].endShape(_r.CLOSE)
                Mix.masks[2].pop()
            }
        }

        show(x, y, scale = 1) {
            this.draw(x, y, scale)
            this.fill(x, y, scale)
            this.hatch(x, y, scale)
            this.erase(x, y, scale)
        }
    }

    /**
     * Draws a circle on the canvas and fills it with the current fill color.
     * 
     * @param {number} x - The x-coordinate of the center of the circle.
     * @param {number} y - The y-coordinate of the center of the circle.
     * @param {number} radius - The radius of the circle.
     * @param {boolean} [r=false] - If true, applies a random factor to the radius for each segment.
     */
    export function circle(x,y,radius,r = false) {
        _ensureReady();
        // Create a new Plot instance for a curve shape
        let p = new Plot("curve")
        // Calculate the length of the arc for each quarter of the circle
        let l = Math.PI * radius / 2;
        // Initialize the angle for the drawing segments
        let angle = R.random(0,360)
        // Define a function to optionally add randomness to the segment length
        let rr = () => (r ? R.random(-1,1) : 0)
        // Add segments for each quarter of the circle with optional randomness
        p.addSegment(0 + angle + rr(), l + rr(), 1, true)
        p.addSegment(-90 + angle + rr(), l + rr(), 1, true)
        p.addSegment(-180 + angle + rr(), l + rr(), 1, true)
        p.addSegment(-270 + angle + rr(), l + rr(), 1, true)
        // Optionally add a random final angle for the last segment
        let angle2 = r ? R.randInt(-5,5) : 0;
        if (r) p.addSegment(0 + angle, angle2 * (Math.PI/180) * radius, true)
        // Finalize the plot
        p.endPlot(angle2 + angle,1, true)
        // Fill / hatch / draw
        let o = [x - radius * R.sin(angle),y - radius * R.cos(-angle)]
        p.show(o[0],o[1],1)
    }

    export function arc(x,y,radius,start,end) {
        _ensureReady();
        // Create a new Plot instance for a curve shape
        let p = new Plot("curve")
        // Calculate start angle and end angle
        let a1 = 270 - R.toDegrees(start), a2 = 270 - R.toDegrees(end);
        // Calculate length arc
        let arcAngle = R.toDegrees(end - start);
        let l = Math.PI * radius * arcAngle / 180;
        // Add segments to plot
        p.addSegment(a1, l, 1, true)
        p.endPlot(a2, 1, true)
        // Draw from starting point
        p.draw(x + radius * R.cos(- a1 - 90),y + radius * R.sin(- a1 - 90),1)
    }
    
    // Holds the array of vertices for the custom shape being defined. Each vertex includes position and optional pressure.
    let _strokeArray = false;
    // Holds options for the stroke, such as curvature, that can influence the shape's rendering.
    let _strokeOption;

    /**
     * Starts recording vertices for a custom shape. Optionally, a curvature can be defined.
     * @param {number} [curvature] - From 0 to 1. Defines the curvature for the vertices being recorded (optional).
     */
    export function beginShape(curvature = 0) {
        _strokeOption = R.constrain(curvature,0,1); // Set the curvature option for the shape
        _strokeArray = []; // Initialize the array to store vertices
    }

    /**
     * Records a vertex in the custom shape being defined between beginShape and endShape.
     * @param {number} x - The x-coordinate of the vertex.
     * @param {number} y - The y-coordinate of the vertex.
     * @param {number} [pressure] - The pressure at the vertex (optional).
     */
    export function vertex(x, y, pressure) {
        _strokeArray.push([x, y, pressure]); // Add the vertex to the array
    }

    /**
     * Finishes recording vertices for a custom shape and either closes it or leaves it open.
     * It also triggers the drawing of the shape with the active stroke(), fill() and hatch() states.
     * @param {string} [a] - An optional argument to close the shape if set to _r.CLOSE.
     */
    export function endShape(a) {
        _ensureReady();
        if (a === _r.CLOSE) {
            _strokeArray.push(_strokeArray[0]); // Close the shape by connecting the last vertex to the first
            _strokeArray.push(_strokeArray[1]);
        }
        // Create a new Plot with the recorded vertices and curvature option
        let plot = (_strokeOption == 0 && !FF.isActive) ? new Polygon(_strokeArray) : _createSpline(_strokeArray, _strokeOption, a === _r.CLOSE ? true : false);
        plot.show();
        _strokeArray = false; // Clear the array after the shape has been drawn
    }
    
    /**
     * Begins a new stroke with a given type and starting position. This initializes
     * a new Plot to record the stroke's path.
     * @param {string} type - The type of the stroke, which defines the kind of Plot to create.
     * @param {number} x - The x-coordinate of the starting point of the stroke.
     * @param {number} y - The y-coordinate of the starting point of the stroke.
     */
    export function beginStroke(type, x, y) {
        _strokeOption = [x, y]; // Store the starting position for later use
        _strokeArray = new Plot(type); // Initialize a new Plot with the specified type
    }

    /**
     * Adds a segment to the stroke with a given angle, length, and pressure. This function
     * is called between beginStroke and endStroke to define the stroke's path.
     * @param {number} angle - The initial angle of the segment, relative to the canvas.
     * @param {number} length - The length of the segment.
     * @param {number} pressure - The pressure at the start of the segment, affecting properties like width.
     */
    export function segment(angle, length, pressure) {
        _strokeArray.addSegment(angle, length, pressure); // Add the new segment to the Plot
    }

    /**
     * Completes the stroke path and triggers the rendering of the stroke.
     * @param {number} angle - The angle of the curve at the last point of the stroke path.
     * @param {number} pressure - The pressure at the end of the stroke.
     */
    export function endStroke(angle, pressure) {
        _strokeArray.endPlot(angle, pressure); // Finalize the Plot with the end angle and pressure
        _strokeArray.draw(_strokeOption[0], _strokeOption[1], 1); // Draw the stroke using the stored starting position
        _strokeArray = false; // Clear the _strokeArray to indicate the end of this stroke
    }
    
    /**
     * Creates a new Plot object.
     * @param {Array<Array<number>>} array_points - An array of points defining the spline curve.
     * @param {number} [curvature=0.5] - The curvature of the spline curve, beterrn 0 and 1. A curvature of 0 will create a series of straight segments.
     */
    function _createSpline (array_points, curvature = 0.5, _close = false) {

        // Initialize the plot type based on curvature
        let plotType = (curvature === 0) ? "segments" : "curve";
        let p = new Plot(plotType);

        // Proceed only if there are points provided
        if (array_points && array_points.length > 0) {
            // Add each segment to the plot
            let done = 0;
            let pep, tep, pep2;
            for (let i = 0; i < array_points.length - 1; i++) {
                if (curvature > 0 && i < array_points.length - 2) {
                    // Get the current and next points
                    let p1 = array_points[i], p2 = array_points[i+1], p3 = array_points[i+2];
                    // Calculate distances and angles between points 
                    let d1 = R.dist(p1[0],p1[1],p2[0],p2[1]), d2 = R.dist(p2[0],p2[1],p3[0],p3[1]);
                    let a1 = _calculateAngle(p1[0],p1[1],p2[0],p2[1]), a2 = _calculateAngle(p2[0],p2[1],p3[0],p3[1]);
                    // Calculate curvature based on the minimum distance
                    let dd = curvature * Math.min(Math.min(d1,d2),0.5 * Math.min(d1,d2)), dmax = Math.max(d1,d2)
                    let s1 = d1 - dd, s2 = d2 - dd;
                    // If the angles are approximately the same, create a straight segment
                    if (Math.floor(a1) === Math.floor(a2)) {
                        let temp = _close ? (i === 0 ? 0 : d1 - done) : d1 - done;
                        let temp2 = _close ? (i === 0 ? 0 : d2 - pep2) : d2;
                        p.addSegment(a1,temp,p1[2],true)
                        if (i === array_points.length - 3) p.addSegment(a2,temp2,p2[2],true);
                        done = 0;
                        if (i === 0) pep = d1, pep2 = dd, tep = array_points[1], done = 0;
                    } else {
                    // If the angles are not the same, create curves, etc (this is a too complex...)
                        let point1 = {x: p2[0] - dd * R.cos(-a1), y: p2[1] - dd * R.sin(-a1)}
                        let point2 = {x: point1.x + dmax * R.cos(-a1+90), y: point1.y + dmax * R.sin(-a1+90)}
                        let point3 = {x: p2[0] + dd * R.cos(-a2), y: p2[1] + dd * R.sin(-a2)}
                        let point4 = {x: point3.x + dmax * R.cos(-a2+90), y: point3.y + dmax * R.sin(-a2+90)}
                        let int = _intersectLines(point1,point2,point3,point4,true)
                        let radius = R.dist(point1.x,point1.y,int.x,int.y)
                        let disti = R.dist(point1.x,point1.y,point3.x,point3.y)/2
                        let a3 = 2 * Math.asin( disti/radius ) * (180 / Math.PI);
                        let s3 = 2 * Math.PI * radius * a3 / 360;
                        let temp = _close ? (i === 0 ? 0 : s1-done) : s1-done;
                        let temp2 = (i === array_points.length - 3) ? (_close ? pep - dd : s2) : 0;
                        p.addSegment(a1,temp, p1[2],true)
                        p.addSegment(a1,isNaN(s3) ? 0 : s3, p1[2],true)
                        p.addSegment(a2,temp2, p2[2],true)
                        done = dd;
                        if (i === 0) pep = s1, pep2 = dd, tep = [point1.x,point1.y];
                    }
                    if (i == array_points.length - 3) {
                        p.endPlot(a2,p2[2],true)
                    }
                } else if (curvature === 0) {
                    // If curvature is 0, simply create segments
                    if (i === 0 && _close) array_points.pop()
                    let p1 = array_points[i], p2 = array_points[i+1]
                    let d = R.dist(p1[0],p1[1],p2[0],p2[1]);
                    let a = _calculateAngle(p1[0],p1[1],p2[0],p2[1]);
                    p.addSegment(a,d,1,true)
                    if (i == array_points.length - 2) {
                        p.endPlot(a,1,true)
                    }
                }
            }
            // Set the origin point from the first point in the array
            p.origin = (_close && curvature !== 0) ? tep : array_points[0]
        }
        return p;
        
    }

    /**
     * Creates and draws a spline curve with the given points and curvature.
     * @param {Array<Array<number>>} array_points - An array of points defining the spline curve.
     * @param {number} [curvature=0.5] - The curvature of the spline curve, between 0 and 1. A curvature of 0 will create a series of straight segments.
     */
    export function spline(array_points, curvature = 0.5) {
        let p = _createSpline(array_points, curvature); // Create a new Plot-spline instance
        p.draw(); // Draw the Plot
    }

// =============================================================================
// Section: Fill Management
// =============================================================================
/**
 * The Fill Management section contains functions and classes dedicated to handling
 * the fill properties of shapes within the drawing context. It supports complex fill
 * operations with effects such as bleeding to simulate watercolor-like textures. The
 * methods provided allow for setting the fill color with opacity, controlling the
 * intensity of the bleed effect, and enabling or disabling the fill operation.
 *
 * The watercolor effect implementation is inspired by Tyler Hobbs' generative art
 * techniques for simulating watercolor paints.
 */

    // No docs for now
    const E = { }
    export function erase(color = "white", alpha = 255) {
        E.isActive = true
        E.c = color; E.a = alpha;
    }
    export function noErase() {
        E.isActive = false
    }

    /**
     * Sets the fill color and opacity for subsequent drawing operations.
     * @param {number|p5.Color} a - The red component of the color or grayscale value, a CSS color string, or a p5.Color object.
     * @param {number} [b] - The green component of the color or the grayscale opacity if two arguments.
     * @param {number} [c] - The blue component of the color.
     * @param {number} [d] - The opacity of the color.
     */
    export function fill(a,b,c,d) {
        _ensureReady()
        F.opacity = (arguments.length < 4) ? ((arguments.length < 3) ? b : 1) : d;
        F.color = (arguments.length < 3) ? _r.color(a) : _r.color(a,b,c);
        F.isActive = true;
    }

    /**
     * Sets the bleed and texture levels for the fill operation, simulating a watercolor effect.
     * @param {number} _i - The intensity of the bleed effect, capped at 0.5.
     * @param {number} _texture - The texture of the watercolor effect, from 0 to 1.
     */
    export function bleed(_i, _direction = "out") {
        _ensureReady()
        F.bleed_strength = R.constrain(_i,0,0.6);
        F.direction = _direction
    }

    export function fillTexture(_texture = 0.4, _border = 0.4) {
        _ensureReady()
        F.texture_strength = R.constrain(_texture, 0, 1);
        F.border_strength = R.constrain(_border, 0, 1);
    }

    export function gravity(x, y) {
        _ensureReady()
        F.light_source = {x: x, y: y}
    }
    export function noGravity() {
        F.light_source = false;
    }

    /**
     * Disables the fill for subsequent drawing operations.
     */
    export function noFill() {
        F.isActive = false;
    }

    /**
     * Disables some operations in order to guarantee a consistent bleed efect for animations (at different bleed levels)
     */
    export function fillAnimatedMode(bool) {
        F.isAnimated = bool;
    }

    /**
     * Object representing the fill state and operations for drawing.
     * @property {boolean} isActive - Indicates if the fill operation is active.
     * @property {boolean} isAnimated - Enable or disable animation-mode
     * @property {Array} v - Array of p5.Vector representing vertices of the polygon to fill.
     * @property {Array} m - Array of multipliers for the bleed effect on each vertex.
     * @property {p5.Color} color - Current fill color.
     * @property {p5.Color} opacity - Current fill opacity.
     * @property {number} bleed_strength - Base value for bleed effect.
     * @property {number} texture_strength - Base value for texture strength.
     * @property {number} border_strength - Base value for border strength.
     * @property {function} fill - Method to fill a polygon with a watercolor effect.
     * @property {function} calcCenter - Method to calculate the centroid of the polygon.
     */
    const F = {
        isActive: false,
        isAnimated: false,
        color: "#002185",
        opacity: 80,
        bleed_strength: 0.07,
        texture_strength: 0.4,
        border_strength: 0.4,

        /**
         * Fills the given polygon with a watercolor effect.
         * @param {Object} polygon - The polygon to fill.
         */
        fill (polygon) {
            // Store polygon
            this.polygon = polygon;
            // Map polygon vertices to p5.Vector objects
            this.v = [...polygon.vertices];
            // Calculate fluidity once, outside the loop
            const fluid = this.v.length * R.random(0.4);
            // Map vertices to bleed multipliers with more intense effect on 'fluid' vertices
            F.m = this.v.map((_, i) => {
                let multiplier = R.random(0.8, 1.2) * this.bleed_strength;
                return i < fluid ? R.constrain(multiplier * 2, 0, 0.9) : multiplier;
            });
            // Shift vertices randomly to create a more natural watercolor edge
            let shift = R.randInt(0, this.v.length);
            // If light source, look for closest
            if (F.light_source) {
                for (let i = 0; i < this.v.length; i ++) {
                    if (R.dist(this.v[i].x,this.v[i].y,F.light_source.x,F.light_source.y) < R.dist(this.v[shift].x,this.v[shift].y,F.light_source.x,F.light_source.y)) shift = i
                }
            }
            this.v = [...this.v.slice(shift), ...this.v.slice(0, shift)];
            // Create and fill the polygon with the calculated bleed effect
            let pol = new FillPolygon (this.v, this.m, this.calcCenter(),[],true)
            pol.fill(this.color, Math.floor(R.map(this.opacity,0,155,0,20,true)), this.texture_strength)
        },

        /**
         * Calculates the center point of the polygon based on the vertices.
         * @returns {p5.Vector} A vector representing the centroid of the polygon.
         */
        calcCenter () {
            let midx = 0, midy = 0;
            for(let i = 0; i < this.v.length; ++i) {
                midx += this.v[i].x;
                midy += this.v[i].y;
            }
            midx /= this.v.length, midy /= this.v.length; 
            return {x: midx, y: midy}
        }
    }

    function _rotate(cx, cy, x, y, angle) {
        let cos = R.cos(angle), sin = R.sin(angle),
        nx = (cos * (x - cx)) + (sin * (y - cy)) + cx,
        ny = (cos * (y - cy)) - (sin * (x - cx)) + cy;
        return { x: nx, y: ny };
    }

    /**
     * The FillPolygon class is used to create and manage the properties of the polygons that produces
     * the watercolor effect. It includes methods to grow (expand) the polygon and apply layers
     * of color with varying intensity and erase parts to simulate a natural watercolor bleed.
     * The implementation follows Tyler Hobbs' guide to simulating watercolor: 
     * https://tylerxhobbs.com/essays/2017/a-generative-approach-to-simulating-watercolor-paints
     */
    class FillPolygon {

        /**
         * The constructor initializes the polygon with a set of vertices, multipliers for the bleed effect, and a center point.
         * @param {p5.Vector[]} _v - An array of p5.Vector objects representing the vertices of the polygon.
         * @param {number[]} _m - An array of numbers representing the multipliers for the bleed effect at each vertex.
         * @param {p5.Vector} _center - A p5.Vector representing the calculated center point of the polygon.
         * @param {boolean[]} dir - An array of booleans representing the bleed direction.
         * @param {boolean} isFirst - Boolean = true for initial fill polygon
         */
        constructor (_v,_m,_center,dir,isFirst = false) {
            this.pol = new Polygon(_v, true)
            this.v = _v;
            this.dir = dir;
            this.m = _m;
            this.midP = _center;
            this.size = -Infinity;
            for (let v of this.v) {
                let temp_size = R.dist(this.midP.x,this.midP.y,v.x,v.y)
                if (temp_size > this.size) this.size = temp_size;
            }
            // This calculates the bleed direction for the initial shape, for each of the vertices.
            if (isFirst) {
                for (let i = 0; i < this.v.length; i++) {
                    const v1 = this.v[i]
                    const v2 = this.v[(i + 1) % this.v.length];
                    const side = { x: v2.x - v1.x, y: v2.y - v1.y }
                    const rt = _rotate(0,0,side.x,side.y,90)
                    let linea = {
                        point1 : {x: v1.x + side.x / 2, y: v1.y + side.y / 2},
                        point2 : {x: v1.x + side.x / 2 + rt.x, y: v1.y + side.y / 2 + rt.y},
                    }
                    const isLeft = (a, b, c) => {
                        return (b.x - a.x)*(c.y - a.y) - (b.y - a.y)*(c.x - a.x) > 0.01;
                    }
                    let d1 = 0;
                    for (let int of F.polygon.intersect(linea)) {if (isLeft(v1,v2,int)) d1++;}
                    this.dir[i] = (d1 % 2 === 0) ? true : false;
                }
            }
        }

        trim (factor) {
            let v = [...this.v], m = [...this.m], dir = [...this.dir];
            if (this.v.length > 10 && factor >= 0.2) {
                let numTrim = ~~((1 - factor) * this.v.length);
                let sp = ~~this.v.length/2 - ~~numTrim/2;
                v.splice(sp, numTrim)
                m.splice(sp, numTrim)
                dir.splice(sp, numTrim)
            }
            return {v: v, m: m, dir: dir}
        }

        /**
         * Grows the polygon's vertices outwards to simulate the spread of watercolor.
         * Optionally, can also shrink (degrow) the polygon's vertices inward.
         * @param {number} _a - The growth factor.
         * @param {boolean} [degrow=false] - If true, vertices will move inwards.
         * @returns {FillPolygon} A new `FillPolygon` object with adjusted vertices.
         */
        grow (growthFactor, degrow = false) {
            const newVerts = [];
            const newMods = [];
            const newDirs = [];
            // Determine the length of vertices to process based on growth factor
            let tr = this.trim(growthFactor)
            // Pre-compute values that do not change within the loop
            const modAdjustment = degrow ? -0.5 : 1;
            // Inline changeModifier to reduce function calls
            const changeModifier = (modifier) => {
                const gaussianVariation = R.gaussian(0.5, 0.1);
                return modifier + (gaussianVariation - 0.5) * 0.1;
            };
            // Loop through each vertex to calculate the new position based on growth
            for (let i = 0; i < tr.v.length; i++) {
                const currentVertex = tr.v[i];
                const nextVertex = tr.v[(i + 1) % tr.v.length];
                // Determine the growth modifier
                let mod = (growthFactor === 0.1) ? (F.bleed_strength <= 0.1 ? 0.25 : 0.75) : tr.m[i];
                mod *= modAdjustment;
                // Add the current vertex and its modified value
                newVerts.push(currentVertex);
                newMods.push(changeModifier(mod));
                
                // Calculate side
                let side = {x: nextVertex.x - currentVertex.x, y: nextVertex.y - currentVertex.y}

                // Make sure that we always bleed in the selected direction
                let dir = tr.dir[i];
                let bleed = (F.direction == "out") ? -90 : 90;
                let rotationDegrees = ((dir) ? bleed : -bleed) + (R.gaussian(0,0.4)) * 45;

                // Calculate the middle vertex position
                let lerp = R.constrain(R.gaussian(0.5,0.2),0.1,0.9)
                let newVertex = {x: currentVertex.x + side.x * lerp, y: currentVertex.y + side.y * lerp}

                // Calculate the new vertex position
                let mult = R.gaussian(0.5, 0.2) * R.random(0.6, 1.4) * mod;
                let direction = _rotate(0,0,side.x,side.y,rotationDegrees)
                newVertex.x += direction.x * mult
                newVertex.y += direction.y * mult

                // Add the new vertex and its modifier
                newVerts.push(newVertex);
                newMods.push(changeModifier(mod));
                newDirs.push(dir,dir)
            }
            return new FillPolygon (newVerts, newMods, this.midP, newDirs);
        }

        /**
         * Fills the polygon with the specified color and intensity.
         * It uses layered growth to simulate watercolor paper absorption and drying patterns.
         * @param {p5.Color|string} color - The fill color.
         * @param {number} intensity - The opacity of the color layers.
         */
        fill (color, intensity, tex) {
            let bleed = R.map(F.bleed_strength,0,0.15,0.6,1,true)
            // Precalculate stuff
            const numLayers = 24 * bleed;
            const intensityThird = intensity / 5 + tex * intensity / 6;
            const intensityQuarter = intensity / 4 + tex * intensity / 3;
            const intensityFifth = intensity / 7 + tex * intensity / 3;
            const intensityHalf = intensity / 5 ;
            const texture = tex * 3;

            // Perform initial setup only once
            Mix.watercolor = true;
            Matrix.trans();
            Mix.blend(color,false,false,true)
            Mix.masks[0].push();
            Mix.masks[0].noStroke();
            Mix.masks[0].translate(Matrix.translation[0] + _r.width/2, Matrix.translation[1] + _r.height/2);
            Mix.masks[0].rotate(Matrix.rotation)
            Mix.masks[0].scale(_curScale)

            // Set the different polygons for texture
            let pol = this.grow()
            let pol2 = pol.grow().grow(0.9);
            let pol3 = pol2.grow(0.75);
            let pol4 = this.grow(0.6)

            for (let i = 0; i < numLayers; i ++) {
                if (i === Math.floor(numLayers / 4) || i === Math.floor(numLayers / 2) || i === Math.floor(3 * numLayers / 4)) {
                    // Grow the polygon objects once per fourth of the process
                    pol = pol.grow();
                    // Grow the texture polygons if conditions are met
                    if (bleed === 1 || i === Math.floor(numLayers / 2)) {
                        pol2 = pol2.grow(0.75);
                        pol3 = pol3.grow(0.75);
                        pol4 = pol4.grow(0.1,true);
                    }
                }
                // Draw layers
                pol.grow().layer(i, intensityHalf);
                pol4.grow(0.1, true).grow(0.1).layer(i, intensityFifth, false);
                pol2.grow(0.1).grow(0.1).layer(i, intensityQuarter, false);
                pol3.grow(0.8).grow(0.1).layer(i, intensityThird, false);
                // Erase after each set of layers is drawn
                if (texture !== 0) pol.erase(texture, intensity);
            }
            Mix.masks[0].pop();
        }

        /**
         * Adds a layer of color to the polygon with specified opacity.
         * It also sets a stroke to outline the layer edges.
         * @param {number} _nr - The layer number, affecting the stroke and opacity mapping.
         * @param {number} _alpha - The opacity of the layer.
         * @param {boolean} [bool=true] - If true, adds a stroke to the layer.
         */
        layer (_nr, _alpha, bool = true) {
            // Set fill and stroke properties once
            Mix.masks[0].fill(255, 0, 0, _alpha);
            if (bool) {
                Mix.masks[0].stroke(255, 0, 0, 0.5 + 1.5 * F.border_strength);
                Mix.masks[0].strokeWeight(R.map(_nr, 0, 24, 6, 0.5));
            } else {
                Mix.masks[0].noStroke();
            }
            Mix.masks[0].beginShape();
            for(let v of this.v) {             
                Mix.masks[0].vertex(v.x, v.y);
            }
            Mix.masks[0].endShape(_r.CLOSE);
        }

        /**
         * Erases parts of the polygon to create a more natural, uneven watercolor texture.
         * Uses random placement and sizing of circles to simulate texture.
         */
        erase (texture, intensity) {
            const numCircles = R.random(130, 200);
            const halfSize = this.size / 2;
            const minSizeFactor = 0.025 * this.size;
            const maxSizeFactor = 0.19 * this.size;
            Mix.masks[0].erase(3.5 * texture - R.map(intensity, 80, 120, 0.3, 1, true),0);
            for (let i = 0; i < numCircles; i++) {
                const x = this.midP.x + R.gaussian(0, halfSize);
                const y = this.midP.y + R.gaussian(0, halfSize);
                const size = R.random(minSizeFactor, maxSizeFactor);
                Mix.masks[0].circle(x, y, size);
            }
            Mix.masks[0].noErase();
        }
    }

// =============================================================================
// Section: Standard Brushes
// =============================================================================
    
    /**
     * Defines a set of standard brushes with specific characteristics. Each brush is defined
     * with properties such as weight, vibration, definition, quality, opacity, spacing, and
     * pressure sensitivity. Some brushes have additional properties like type, tip, and rotate.
     */
    const _vals = ["weight", "vibration", "definition", "quality", "opacity", "spacing", "pressure", "type", "tip", "rotate"]
    const _standard_brushes = [
        // Define each brush with a name and a set of parameters
        // For example, the "pen" brush has a weight of 0.35, a vibration of 0.12, etc.
        // The "marker2" brush has a custom tip defined by a function that draws rectangles.
        ["pen", [ 0.35, 0.12, 0.5, 8, 200, 0.3, {curve: [0.15,0.2], min_max: [1.4,0.9]} ] ],
        ["rotring", [ 0.2, 0.05, 1, 3, 250, 0.15, {curve: [0.05,0.2], min_max: [1.7,0.8]} ]],
        ["2B", [ 0.35, 0.5, 0.1, 8, 180, 0.2, {curve: [0.15,0.2], min_max: [1.3,1]} ]],
        ["HB", [ 0.3, 0.5, 0.4, 4,  180, 0.25, {curve: [0.15,0.2], min_max: [1.2,0.9]} ]],
        ["2H", [ 0.2, 0.4, 0.3, 2,  150, 0.2, {curve: [0.15,0.2], min_max: [1.2,0.9]} ]],
        ["cpencil", [ 0.4, 0.6, 0.8, 7,  120, 0.15, {curve: [0.15,0.2], min_max: [0.95,1.2]} ]],
        ["charcoal", [ 0.5, 2, 0.8, 300,  110, 0.06, {curve: [0.15,0.2], min_max: [1.3,0.8]} ]],
        ["hatch_brush", [ 0.2, 0.4, 0.3, 2,  150, 0.15, {curve: [0.5,0.7], min_max: [1,1.5]} ]],
        ["spray", [ 0.3, 12, 15, 40, 80, 0.65, {curve: [0,0.1], min_max: [0.15,1.2]}, "spray" ]],
        ["marker", [ 2.5, 0.12, null, null, 25, 0.4, {curve: [0.35,0.25], min_max: [1.5,1]}, "marker" ]],
        ["marker2", [ 2.5, 0.12, null, null, 25, 0.35, {curve: [0.35,0.25], min_max: [1.3,0.95]}, "custom",  
            function (t) { 
                let scale = _gScale;
                t.rect(-1.5 * scale,-1.5 * scale,3 * scale,3 * scale); t.rect(1 * scale,1 * scale,1 * scale,1 * scale) 
            }, "natural"
        ]],
    ];
    /**
     * Iterates through the list of standard brushes and adds each one to the brush manager.
     * The brush manager is assumed to be a global object `B` that has an `add` method.
     */
    for (let s of _standard_brushes) {
        let obj = {}
        for (let i = 0; i < s[1].length; i++) obj[_vals[i]] = s[1][i]
        add(s[0],obj)
    }
