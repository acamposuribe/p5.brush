// ==========================================================
//  p5.brush 1.0 (c) 2023.
//  License: MIT License
//  Author: Alejandro Campos (@acamposuribe)
// ==========================================================

(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = global || self, factory(global.brush = {}));
} (this, (function (exports) { 
    'use strict';

    //////////////////////////////////////////////////
    // CONFIG AND LOAD FUNCTIONS
    let _r;
    function _config (objct = {}) {
        if (objct.R) R.source = objct.R // Seed RNG
        if (objct.SVG) S.activate(); // Doesn't work at the moment
    }
    function _load (canvasID = false) {
        _r = (!canvasID) ? window.self : canvasID; // Set buffer
        Mix.load(); // Load Color-Mix system
        FF.create(); // Create flow_field if needed
        globalScale(_r.width / 250) // Adjust standard brushes to match canvas
    }
    function _preload () {
        T.load();  // Load custom image TIPS
    }

    //////////////////////////////////////////////////
    // AUXILIARY FUNCTIONS AND RNG
    const R = {
        source: function () {return random()},
        random(e = 0, r = 1) {
            if (arguments.length === 1) {return this.map(this.source(), 0, 1, 0, e); }
            else {return this.map(this.source(), 0, 1, e, r)}
            },
        randInt(e, r) {return Math.floor(this.random(e,r))},
        weightedRand(e) {
            var r, a, n = [];
            for (r in e)
                for (a = 0; a < 10 * e[r]; a++)
                    n.push(r);
                return n[Math.floor(this.source() * n.length)]
        },
        map(value, a, b, c, d, bool = false) {
            let r = c + (value - a) / (b - a) * (d - c);
            if (!bool) return r;
            if (c < d) {return this.constrain(r, c, d)} 
            else {return this.constrain(r, d, c)}
        },
        constrain (n, low, high) {
            return Math.max(Math.min(n, high), low);
        },
        c: [], s: [],
        cos(a) {return this.c[Math.floor(4 * ((a % 360 + 360) % 360))]},
        sin(a) {return this.s[Math.floor(4 * ((a % 360 + 360) % 360))]},
    }
    // Calculate sin and cos for 1440 angles
    for (let i = 0; i < 1440; i++) {
        const radians = i * Math.PI / 720;
        R.c[i] = Math.cos(radians)
        R.s[i] = Math.sin(radians)
    }
    // Keep track of transformation matrix
    let matrix = [0,0];
    const trans = function () {
        matrix = [_r._renderer.uMVMatrix.mat4[12],_r._renderer.uMVMatrix.mat4[13]]
        return matrix;
    }

    //////////////////////////////////////////////////
    // COLOR-MIX FUNCTIONS (Using Spectral.js right now)
    const Mix = {
        loaded: false,
        load() {
            // Create buffer for mask
            this.mask = _r.createFramebuffer({width: _r.width, height: _r.height, density: _r.pixelDensity()});    
            this.mask.begin(), _r.clear(), this.mask.end();                                                        
            if (!Mix.loaded) {
                this.frag = this.frag.replace('#include "spectral.glsl"', spectral.glsl());
            }
            this.shader = _r.createShader(this.vert, this.frag);
            Mix.loaded = true;
        },
        blend (_c) {
            this.pigment = [float(red(color(_c))),float(green(color(_c))),float(blue(color(_c)))];
            _r.push();
            _r.translate(-trans()[0],-trans()[1])
            // Load shader and send data from canvas
            _r.shader(this.shader);
            this.shader.setUniform('addColor', this.pigment);
            this.shader.setUniform('source', _r._renderer);
            this.shader.setUniform('mask', this.mask);
            // Give geometry to shader
            _r.fill(0,0,0,0);
            _r.noStroke();
            _r.rect(-_r.width/2, -_r.height/2, _r.width, _r.height);
            // Clear Mask to prepare for next colour
            this.mask.draw(function () {_r.clear()})
            _r.pop();
        },
        vert: `precision highp float;attribute vec3 aPosition;attribute vec2 aTexCoord;uniform mat4 uModelViewMatrix,uProjectionMatrix;varying vec2 vVertTexCoord;void main(){gl_Position=uProjectionMatrix*uModelViewMatrix*vec4(aPosition,1);vVertTexCoord=aTexCoord;}`,
        frag: `
        precision highp float;varying vec2 vVertTexCoord;
        uniform sampler2D source;
        uniform sampler2D mask;
        uniform vec4 addColor;
        #include "spectral.glsl"

        vec3 rgb(float r, float g, float b){return vec3(r / 255.0, g / 255.0, b / 255.0);}
        float rand(vec2 co, float a, float b, float c){return fract(sin(dot(co, vec2(a, b))) * c);}
        float map(float value, float min1, float max1, float min2, float max2) {return min2 + (value - min1) * (max2 - min2) / (max1 - min1);}

        void main() {
            vec4 maskColor = texture2D(mask, vVertTexCoord);
            if (maskColor.r > 0.0) {
                float r1 = map(rand(vVertTexCoord,12.9898,78.233,43358.5453),0.0,1.0,-1.0,1.0);
                float r2 = map(rand(vVertTexCoord,7.9898,58.233,43213.5453),0.0,1.0,-1.0,1.0);
                float r3 = map(rand(vVertTexCoord,17.9898,3.233,33358.5453),0.0,1.0,-1.0,1.0);
                float d; 
                vec4 canvasColor = texture2D(source, vVertTexCoord);
                vec3 mixedColor = spectral_mix(vec3(canvasColor.r,canvasColor.g,canvasColor.b), rgb(addColor.r,addColor.g,addColor.b), maskColor.a * 0.7);
                if (maskColor.a > 0.7)  {mixedColor = spectral_mix(mixedColor,vec3(0.0,0.0,0.0),(maskColor.a - 0.7) * 0.7);}
                gl_FragColor = vec4(mixedColor.r + 0.01 * r1 ,mixedColor.g + 0.01 * r2,mixedColor.b + 0.01 * r3,1.0);
            }
            else {
                gl_FragColor = vec4(0.0,0.0,0.0,0.0);
            }
        }
        `
    }
    //////////////////////////////////////////////////
    // SVG mode -> Include p5.svg in the HTML file
    // Not working at the moment !! Broken with p5 1.8
    const S = {
        on: false,
        activate() {
            this.final = createGraphics(_r.width,_r.height,SVG)
            this.on = true;
        },
        b: [],
        export(name) {
            for (let g of this.b) {
                let layerBuffer = createGraphics(_r.width, _r.height,SVG);
                for (let b of g) {
                    layerBuffer.image(b,0,0)
                }
                this.final.image(layerBuffer,0,0)
            }
            this.final.save(name)
        }
    }

    //////////////////////////////////////////////////
    // FLOWFIELD
    function flowField (a) {
        FF.isActive = true
        if (FF.current !== a) FF.current = a;
    }
    function disableField () {FF.isActive = false}
    function newField(name,funct) {
        FF.list.set(name,{gen: funct}); 
        FF.current = name;
        FF.refresh()
    }
    function refreshField(t) {FF.refresh(t)}
    const FF = {
        isActive: false,
        list: new Map(),
        step_length() {return Math.min(_r.width,_r.height) / 1000},
        create() {
            this.R = _r.width * 0.01, this.left_x = -1 * _r.width, this.top_y = -1 * _r.height;
            this.num_columns = Math.round(2 * _r.width / this.R), this.num_rows = Math.round(2 * _r.height / this.R);
            this.addStandard();
        },
        flow_field() {return this.list.get(this.current).field},
        refresh(t = 0) {this.list.get(this.current).field = this.list.get(this.current).gen(t)},
        addStandard() {
            newField("curved", function(t) {
                    let field = []
                    var angleRange = R.randInt(-25,-15);
                    if (R.randInt(0,100)%2 == 0) {angleRange = angleRange * -1}
                    for (var column=0;column<FF.num_columns;column++){
                        field.push([0]);
                        for (var row=0;row<FF.num_rows;row++) {               
                            var noise_val = noise(column * 0.02 + t * 0.03, row * 0.02 + t * 0.03)
                            var angle = R.map(noise_val, 0.0, 1.0, -angleRange, angleRange)
                            field[column][row] = 3 * angle;
                        }
                    }
                    return field;
                })
            newField("truncated", function(t) {
                let field = []
                var angleRange = R.randInt(-25,-15) + 5 * R.sin(t);
                if (R.randInt(0,100)%2 == 0) {angleRange=angleRange*-1}
                var truncate = R.randInt(5,10);
                for (var column=0;column<FF.num_columns;column++){
                    field.push([0]);
                    for (var row=0;row<FF.num_rows;row++) {               
                        var noise_val = noise(column * 0.02, row * 0.02)
                        var angle = Math.round(R.map(noise_val, 0.0, 1.0, -angleRange, angleRange)/truncate)*truncate;
                        field[column][row] = 4 * angle;
                    }
                }
                return field;
            })
            newField("tilted", function(t) {
                let field = []
                var angleRange = R.randInt(-45,-25) + 15 * R.sin(t);
                if (R.randInt(0,100)%2 == 0) {angleRange=angleRange*-1}
                var dif = angleRange;
                for (var column=0;column<FF.num_columns;column++){
                    field.push([0]);
                    var angle = 0;
                    for (var row=0;row<FF.num_rows;row++) {               
                        field[column][row] = angle;
                        angle = angle + dif;
                        dif = -1*dif;
                    }
                }
                return field;
            })
            newField("zigzag", function(t) {   
                let field = []     
                var angleRange = R.randInt(-30,-15) + Math.abs(44 * R.sin(t));
                if (R.randInt(0,100)%2 == 0) {angleRange=angleRange*-1}
                var dif = angleRange;
                var angle = 0;
                for (var column=0;column<FF.num_columns;column++){
                    field.push([0]);
                    for (var row=0;row<FF.num_rows;row++) {               
                        field[column][row] = angle;
                        angle = angle + dif;
                        dif = -1*dif;
                    }
                    angle = angle + dif;
                    dif = -1*dif;
                }
                return field;
            })
            newField("waves", function(t) {
                let field = []
                var sinrange = R.randInt(10,15) + 5 * R.sin(t);
                var cosrange = R.randInt(3,6) + 3 * R.cos(t);
                var baseAngle = R.randInt(20,35);
                for (var column=0;column<FF.num_columns;column++){
                    field.push([0]);
                    for (var row=0;row<FF.num_rows;row++) {               
                        var angle = R.sin(sinrange*column)*(baseAngle * R.cos(row*cosrange)) + R.randInt(-3,3);
                        field[column][row] = angle;
                    }
                }
                return field;
            })
            newField("seabed", function(t) {
                let field = []
                var baseSize = R.random(0.4,0.8)
                var baseAngle = R.randInt(18,26) ;
                for (var column=0;column<FF.num_columns;column++){
                    field.push([0]);
                    for (var row=0;row<FF.num_rows;row++) {       
                        var addition = R.randInt(15,20)        
                        var angle = baseAngle*R.sin(baseSize*row*column+addition);
                        field[column][row] = 1.1*angle * R.cos(t);
                    }
                }
                return field;
            })           
        }
    }
    class Position {
        constructor (x,y) {this.update(x, y), this.plotted = 0;}
        update (x,y) {
            this.x = x , this.y = y;
            if (FF.isActive) {
                this.x_offset = this.x - FF.left_x + trans()[0];
                this.y_offset = this.y - FF.top_y + trans()[1];
                this.column_index = Math.round(this.x_offset / FF.R);
                this.row_index = Math.round(this.y_offset / FF.R);
            }
        }
        reset() {this.plotted = 0}
        isIn() {
            return (FF.isActive) ? ((this.column_index >= 0 && this.row_index >= 0) && (this.column_index < FF.num_columns && this.row_index < FF.num_rows)) : this.isInCanvas();
        }
        isInCanvas() {
            return (this.x >= -0.55 * _r.width - trans()[0] && this.x <= 0.55 * _r.width - trans()[0]) && (this.y >= -0.55 * _r.height - trans()[1] && this.y <= 0.55 * _r.height - trans()[1])
        }
        angle () {
            if (this.isIn() && FF.isActive) {
                return FF.flow_field()[this.column_index][this.row_index];
            } else { 
                return 0;
            }
        }
        moveTo (_length, _dir, _step_length = FF.step_length(), straight = false) {
            if (this.isIn()) {
                for (let i = 0; i < _length / _step_length; i++) {
                    let a = straight? R.cos(-_dir) : R.cos(this.angle() - _dir);
                    let b = straight? R.sin(-_dir) : R.sin(this.angle() - _dir);
                    let x_step = (_step_length * a), y_step = (_step_length * b);
                    this.plotted += _step_length;
                    this.update(this.x + x_step, this.y + y_step);   
                }
            } else {
                this.plotted += _step_length;
            }
        }
        plotTo (_plot, _length, _step_length, _scale) {
            if (this.isIn()) {
                for (let i = 0; i < _length / _step_length; i++) {
                    let x_step = (_step_length * R.cos(this.angle() - _plot.angle(this.plotted)));
                    let y_step = (_step_length * R.sin(this.angle() - _plot.angle(this.plotted)));
                    this.plotted += _step_length / _scale;
                    this.update(this.x + x_step, this.y + y_step);  
                }
            } else {
                this.plotted += _step_length;
            }
        }
    }

    //////////////////////////////////////////////////
    // BRUSHES + HATCH SYSTEM
    function _noStroke() {B.isActive = false}
    const B = {
        isActive: true,
        list: new Map(),
        add(a,b) {
            if (b.type === "image") { // Image tip types
                T.add(b.image.src);
                b.tip = function() {_r.image(T.tips.get(B.p.image.src),-B.p.weight/2,-B.p.weight/2,B.p.weight,B.p.weight)}
            }
            if ((b.blend !== false) && (b.type === "marker" || b.type === "custom" || b.type === "image" )) { b.blend = true } else {b.blend = false}
            B.list.set(a,{param:b,colors:[],buffers:[]})
            if (S.on) S.b.push(B.list.get(a).buffers)
        },
        c: "#000000", w: 1, cr: null, name: "HB",
        set(a,c,w) {B.name = a, B.c = c, B.w = w},
        setBrush(a) {B.name = a},
        setColor(r,g,b) {B.c = (arguments.length < 2) ? r : [r,g,b]; B.isActive = true},
        setWeight(w) {B.w = w},
        spacing() {B.p = B.list.get(B.name).param; return B.p.spacing * B.w},
        clip(a) {B.cr = a},
        line(x1,y1,x2,y2) {
            B.l = dist(x1,y1,x2,y2), B.position = new Position(x1,y1), B.flow = false, B.plot = false;
            B.draw(calcAngle(x1,y1,x2,y2),true)
        },
        flowLine(x,y,length,dir) {
            if (angleMode() === "radians") dir = dir * 180 / Math.PI
            B.l = length, B.position = new Position(x,y), B.flow = true, B.plot = false;
            B.draw(dir,false)
        },
        flowShape(p,x,y,scale) {
            B.l = p.length, B.position = new Position(x,y), B.plot = p, p.calcIndex(0);
            B.push();
            let st = B.p.spacing * B.w
            for (let steps = 0; steps < Math.round(B.l * scale / st); steps++) {
                B.tip(), B.position.plotTo(p,st,st,scale)
            }
            B.pop();
        },
        beginShape() {B.vertices = []},
        vertex(x,y) {B.vertices.push([x,y])},
        endShape(bool = false) {
            if (bool) B.vertices.push(B.vertices[0])
            for (let i = 0; i < B.vertices.length - 1; i++) {B.line(B.vertices[i][0],B.vertices[i][1],B.vertices[i+1][0],B.vertices[i+1][1])}
        },
        draw(dir,bool) {
            B.dir = dir;
            B.push()
            let st = B.p.spacing * B.w
            for (let steps = 0; steps < Math.round(B.l / st); steps++) {
                B.tip(), B.position.moveTo(st,dir,st,bool)
            }
            B.pop()
        },
        push() {
            B.p = B.list.get(B.name).param
            if (B.p.pressure.type !== "custom") {B.a = R.random(-1,1), B.b = R.random(1,1.5), B.cp = R.random(3,3.5);}
            else {B.cp = R.random(-0.2,0.2)}
            B.min = B.p.pressure.min_max[0], B.max = B.p.pressure.min_max[1];
            if (S.on) B.pickBuffer(), B.buffer.beginShape();
            if (B.p.blend) trans(), Mix.mask.begin();
            _r.push(), B.c = _r.color(B.c), _r.noStroke();
            if (B.p.blend) _r.translate(matrix[0],matrix[1]), B.markerTip();
        },
        tip() {
            if (S.on) B.buffer.vertex(B.position.x,B.position.y) // SVG
            let pressure = B.plot ? B.simPressure() * B.plot.pressure(B.position.plotted) : B.simPressure(); // Pressure
            let alpha = Math.floor(B.p.opacity * Math.pow(pressure,B.p.type === "marker" ? 1 : 1.5)); // Alpha
            if (B.p.blend) {_r.fill(255,0,0,alpha/2)} else {B.c.setAlpha(alpha), _r.fill(B.c)}; // Color
            if (B.crop()) {
                if (B.p.type === "spray") { // SPRAY TYPE BRUSHES
                    let vibration = (B.w * B.p.vibration * pressure) + B.w * randomGaussian() * B.p.vibration / 3;
                    let sw = B.p.weight * R.random(0.9,1.1);
                    for (let j = 0; j < B.p.quality / pressure; j++) {
                        let r = R.random(0.9,1.1);
                        let rX = r * vibration * R.random(-1,1);
                        _r.circle(B.position.x + rX, B.position.y + R.random(-1, 1) * Math.sqrt(Math.pow(r * vibration,2) - Math.pow(rX,2)), sw);
                    }
                } else if (B.p.type === "marker") { // MARKER TYPE BRUSHES
                    let vibration = B.w * B.p.vibration;
                    _r.circle(B.position.x + vibration * R.random(-1,1), B.position.y + vibration * R.random(-1,1), B.w * B.p.weight * pressure)
                } else if (B.p.type === "custom" || B.p.type === "image") { // CUSTOM TIP BRUSHES
                    _r.push();
                    let vibration = B.w * B.p.vibration;
                    _r.translate(B.position.x + vibration * R.random(-1,1), B.position.y + vibration * R.random(-1,1)), 
                    B.adjust_tip(B.w * pressure, alpha)
                    B.p.tip();
                    _r.pop();
                } else { // REST OF BRUSHES
                    let vibration = B.w * B.p.vibration * (B.p.definition + (1-B.p.definition) * randomGaussian() * B.gauss(0.5,0.9,5,0.2,1.2) / pressure);
                    if (R.random(0,B.p.quality) > 0.4) {
                        _r.circle(B.position.x + 0.7 * vibration * R.random(-1,1),B.position.y + vibration * R.random(-1,1), pressure * B.p.weight * B.w * R.random(0.85,1.15));
                    }
                }
            }
        },
        adjust_tip(pressure, alpha) {
            _r.scale(pressure);
            if (B.p.type === "image") {
                (B.p.blend) ? _r.tint(255, 0, 0, alpha/2) : _r.tint(_r.red(B.c),_r.green(B.c),_r.blue(B.c),alpha);
            }
            if (B.p.rotate === "random") _r.rotate(R.randInt(0,360));
            if (B.p.rotate === "natural") {
                _r.rotate(((B.plot) ? - B.plot.angle(B.position.plotted) : - B.dir) + (B.flow ? B.position.angle() : 0));
            }
        },
        pop() {
            if (B.p.blend) B.markerTip();
            _r.pop();
            if (B.p.blend) Mix.mask.end(), Mix.blend(B.c);
            if (S.on) B.buffer.endShape();
        },
        markerTip() {
            if (B.crop()) {
                let pressure = B.plot ? B.simPressure() * B.plot.pressure(B.position.plotted) : B.simPressure();
                let alpha = Math.floor(B.p.opacity * Math.pow(pressure,B.p.type === "marker" ? 1 : 1.5)); 
                _r.fill(255, 0, 0, alpha / 1.5);
                for (let s = 0; s < 5; s++) {
                    if (B.p.type === "marker") {
                        _r.circle(B.position.x,B.position.y, s/5 * B.w * B.p.weight * pressure)
                    } else if (B.p.type === "custom" || B.p.type === "image") {
                        _r.push(); 
                        _r.translate(B.position.x, B.position.y), 
                        B.adjust_tip(B.w * s/5 * pressure,alpha)
                        B.p.tip(); 
                        _r.pop();
                    }
                }
            }
        },
        crop() {
            if (B.cr) return B.position.x >= B.cr[0] && B.position.x <= B.cr[2] && B.position.y >= B.cr[1] && B.position.y <= B.cr[3];
            else return true;
        },
        pickBuffer() {
            if (S.on) {
                let c_list = B.list.get(B.name).colors, b_list = B.list.get(B.name).buffers;
                if (c_list.includes(B.c)) {
                    B.buffer = b_list[c_list.indexOf(B.c)]
                } else {
                    let new_b = createGraphics(width, height,SVG);
                    new_b.stroke(B.c), new_b.strokeWeight(B.p.weight), new_b.noFill();
                    c_list.push(B.c)
                    b_list.push(new_b)
                    B.buffer = b_list[c_list.indexOf(B.c)]
                }
            }
        },
        gauss(a = 0.5 + B.p.pressure.curve[0] * B.a, b = 1 - B.p.pressure.curve[1] * B.b, c = B.cp, min = B.min, max = B.max) {
            return R.map((1 / ( 1 + Math.pow(Math.abs( ( B.position.plotted - a * B.l ) / ( b * B.l / 2 ) ), 2 * c))), 0, 1, min, max);
        },
        simPressure () {
            if (B.p.pressure.type === "custom") return R.map(B.p.pressure.curve(B.position.plotted / B.l)+B.cp,0,1,B.min,B.max,true);
            else return this.gauss()
        },
        hatch(polygons, dist, angle, options = {rand: false, continuous: false, gradient: false}) {
            if (angleMode() === "radians") angle = angle * 180 / Math.PI
            angle = angle % 180;
            let dots = [];
            let minX = 999999, maxX = -999999, minY = 999999, maxY = -999999;
            if (!Array.isArray(polygons)) {polygons = [polygons]}
            for (let p of polygons) {
                for (let a of p.a) {
                    minX = Math.min(a[0],minX), maxX = Math.max(a[0],maxX), minY = Math.min(a[1],minY), maxY = Math.max(a[1],maxY)
                }
            }
            minX -= 1, minY -= 1, maxX += 1, maxY += 1;
            let ventana = new Polygon([[minX,minY],[maxX,minY],[maxX,maxY],[minX,maxY]])
            let startY = (angle <= 90 && angle >= 0) ? minY : maxY;
            let i = 0;
            let linea = {
                point1: { x: minX,                  y: startY },
                point2: { x: minX + R.cos(-angle),  y: startY + R.sin(-angle) }
            }
            let dist1 = dist;
            while (ventana.intersect(linea).length > 0) {
                let tempArray = [];
                for (let p of polygons) {tempArray.push(p.intersect(linea))};
                tempArray = tempArray.flat();
                tempArray.sort(function(a,b) {
                    if(a.x == b.x) return a.y-b.y;
                    return a.x-b.x;
                });
                dots[i] = []
                dots[i] = dots[i].concat(tempArray)
                if (options.gradient) dist1 *= map(options.gradient,0,1,1,1.1,true)
                i++
                linea = {
                    point1 : {x: minX + dist1*i*R.cos(-angle+90),                 y: startY + dist1*i*R.sin(-angle+90)},
                    point2 : {x: minX + dist1*i*R.cos(-angle+90)+R.cos(-angle),   y: startY + dist1*i*R.sin(-angle+90)+R.sin(-angle)}
                }
            }
            let gdots = []
            for (let dd of dots) {if (typeof dd[0] !== "undefined") { gdots.push(dd)}}
            for (let j = 0; j < gdots.length; j++) {
                let dd = gdots[j]
                let r = options.rand ? options.rand : 0;
                for (let i = 0; i < dd.length-1; i++) {
                    if (i % 2 == 0) {
                        dd[i].x += r * dist * R.random(-1,1), dd[i].y += r * dist * R.random(-1,1);
                        dd[i+1].x += r * dist * R.random(-1,1), dd[i+1].y += r * dist * R.random(-1,1);
                        B.line(dd[i].x,dd[i].y,dd[i+1].x,dd[i+1].y);
                        if (j > 0 && options.continuous) B.line(gdots[j-1][1].x,gdots[j-1][1].y,dd[i].x,dd[i].y);
                    }
                }
            }
        }
    }
    function brushes() {return Array.from(B.list.keys())}
    //////////////////////////////////////////////////
    // IMAGE TIPS
    const T = {
        tips: new Map(),
        add (src) {
            const myImage = new Image();
            this.tips.set(src,false)
            myImage.onload = function(){
                T.tips.set(src,(T.imageToRed(myImage)))
                };
            myImage.src = src;
        },
        imageToRed (image) {
            let canvas = document.createElement("canvas");
            canvas.width = image.width, canvas.height = image.height;
            let context = canvas.getContext("2d");
            context.drawImage(image,0,0);
            let imageData=context.getImageData(0,0, image.width, image.height);
            for (let i = 0; i < 4 * image.width * image.height; i += 4) {
                let a = (imageData.data[i] + imageData.data[i + 1] + imageData.data[i + 2]) / 3;
                imageData.data[i] = 255;
                imageData.data[i + 1] = 255;
                imageData.data[i + 2] = 255;
                imageData.data[i + 3] = 255 - a;
            }
            context.putImageData(imageData,0,0);
            return canvas.toDataURL();;
        },
        load() {
            if (this.tips.size === 0) return console.log("ojo");
            for (let key of this.tips.keys()){
                this.tips.set(key,loadImage(this.tips.get(key)))
            }
        }
    }
    //////////////////////////////////////////////////
    // OTHER BRUSH FUNCTIONS
    class Polygon {
        constructor (array) {
            this.a = array;
            this.vertices = [];
            this.sides = [];
            for (let a of array) {this.vertices.push({x:a[0],y:a[1]})}
            for (let i = 0; i < this.vertices.length; i++) {
                if (i < this.vertices.length-1) {this.sides[i] = [this.vertices[i],this.vertices[i+1]]} 
                else {this.sides[i] = [this.vertices[i],this.vertices[0]]}
            }
        }
        intersect (line) {
            let points = []
            for (let s of this.sides) {
                let intersection = intersectar(line.point1,line.point2,s[0],s[1])
                if (intersection !== false) {points.push(intersection)}
            }
            return points;
        }
        draw () {
            if (B.isActive) {
                for (let s of this.sides) {B.line(s[0].x,s[0].y,s[1].x,s[1].y)}
            }
        }
        fill () {F.fill(this)}
        hatch (dist, angle, options) {
            B.hatch(this,dist,angle,options)
        }
    }
    // line intercept math by Paul Bourke http://paulbourke.net/geometry/pointlineplane/
    function intersectar(point1,point2,point3,point4,bool = false) {
        var x1 = point1.x, y1 = point1.y, x2 = point2.x, y2 = point2.y, x3 = point3.x, y3 = point3.y, x4 = point4.x, y4 = point4.y;
        if ((x1 === x2 && y1 === y2) || (x3 === x4 && y3 === y4)) return false;
        let denominator = ((y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1));
        if (denominator === 0) return false;
        let ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denominator
        let ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denominator
        if (!bool) if (ub < 0 || ub > 1) return false;
        let x = x1 + ua * (x2 - x1)
        let y = y1 + ua * (y2 - y1)
        return {x: x,y: y}
    }
    function calcAngle(x1,y1,x2,y2) {
        let a = (x2-x1 >= 0) ? Math.atan(-(y2-y1)/(x2-x1)) / (Math.PI / 180) : 180 + Math.atan(-(y2-y1)/(x2-x1)) / (Math.PI / 180)
        return (a % 360 + 360) % 360
    }

    //////////////////////////////////////////////////
    // BASIC GEOMETRIES
    function _rect(x,y,w,h,mode = false) {
        if (mode) x = x - w / 2, y = y - h / 2;
        let p = new Polygon([[x,y],[x+w,y],[x+w,y+h],[x,y+h]])
        p.draw();
        p.fill();
    }
    function _circle(x,y,radius,r = false) {
        let p = new Plot("curve")
        let l = Math.PI * radius / 2;
        let angle = 0
        let rr = function() {return (r ? R.random(-1,1) : 0)}
        p.addSegment(0 + angle + rr(), l + rr(), 1, true)
        p.addSegment(-90 + angle + rr(), l + rr(), 1, true)
        p.addSegment(-180 + angle + rr(), l + rr(), 1, true)
        p.addSegment(-270 + angle + rr(), l + rr(), 1, true)
        let angle2 = r ? R.randInt(-5,5) : 0;
        if (r) p.addSegment(0 + angle, angle2 * (Math.PI/180) * radius, true)
        p.endPlot(angle2 + angle,1, true)
        if (F.isActive) {
            let pol = p.genPol(x - radius * R.sin(angle),y - radius * R.cos(-angle))
            pol.fill()
        }
        if (B.isActive) p.draw(x - radius * R.sin(angle),y - radius * R.cos(-angle),1)
    }
    //////////////////////////////////////////////////
    // PLOT SYSTEM (beginShape + beginStroke)
    class Plot {
        constructor (_type) {
            this.segments = [], this.angles = [], this.pres = [];
            this.type = _type;
            this.dir = 0;
            this.calcIndex(0);
        }
        addSegment (_a = 0,_length = 0,_pres = 1,_degrees = false) {
            if (angleMode() === "radians" && !_degrees) _a = _a * 180 / Math.PI
            if (this.angles.length > 0) {
                this.angles.splice(-1)
            }
            if (_a < 0) {_a = 360+_a} 
            if (_a > 360) {_a = _a - parseInt(_a/360)*360}
            this.angles.push(_a);
            this.pres.push(_pres);
            this.segments.push(_length);
            this.length =  this.segments.reduce((partialSum, a) => partialSum + a, 0);
            this.angles.push(_a)
        }
        endPlot (_a = 0, _pres = 1, _degrees = false) {
            if (angleMode() === "radians" && !_degrees) _a = _a * 180 / Math.PI
            this.angles.splice(-1)
            this.angles.push(_a);
            this.pres.push(_pres);
        }
        rotate (_a) {if (angleMode() === "radians") _a = _a * 180 / Math.PI; this.dir = _a}
        pressure (_d) {
            if (_d > this.length) { return this.pres[this.pres.length-1] }
            return this.curving(this.pres,_d)
        }
        angle (_d) {
            if (_d > this.length) { return this.angles[this.angles.length-1] }
            this.calcIndex(_d);
            return (this.type === "curve") ?  this.curving(this.angles,_d) + this.dir : this.angles[this.index] + this.dir;
        }
        curving (array,_d) {
            let map0 = array[this.index];
            let map1 = array[this.index+1];
            if (typeof map1 == "undefined") { map1 = map0}
            if (Math.abs(map1-map0) > 180) {if (map1 > map0) {map1 = - (360-map1);} else {map0 = - (360-map0);}}
            return R.map(_d-this.suma,0,this.segments[this.index],map0,map1,true);
        }
        calcIndex(_d) {
            this.index = -1, this.suma = 0;
            let d = 0;
            while (d <= _d) {this.suma = d; d += this.segments[this.index+1]; this.index++;}
        }
        genPol (_x,_y) {
            let _step = B.spacing()  // get last spacing
            let vertices = []
            let side = this.length * 0.5 * F.b;
            let linepoint = new Position(_x,_y);
            let numsteps = Math.round(this.length/_step);
            for (let steps = 0; steps < numsteps; steps++) {
                vertices[Math.floor(linepoint.plotted / side)] = [linepoint.x,linepoint.y]
                linepoint.plotTo(this,_step,_step,1)
            }
            this.calcIndex(0);
            return new Polygon(vertices);
        }
        draw (x,y,scale) {
            if (this.origin) x = this.origin[0], y = this.origin[1], scale = 1;
            B.flowShape(this,x,y,scale)
        }
    }
    let strokeArray = false, strokeOption;
    function _beginShape(curvature) {
        strokeOption = curvature;
        strokeArray = [];
    }
    function _vertex(x, y, pressure) {
        strokeArray.push([x,y,pressure])
    }
    function _endShape(a) {
        if (a === CLOSE) strokeArray.push(strokeArray[0])
        let sp = new Spline(strokeArray, strokeOption)
        if (F.isActive) {
            let pol = sp.p.genPol(p.origin[0],p.origin[1])
        }
        if (B.isActive) sp.draw()
        strokeArray = false;
    }
    function _beginStroke(type,x,y) {
        strokeOption = [x,y];
        strokeArray = new Plot(type)
    }
    function _move(angle, length, pressure) {
        strokeArray.addSegment(angle, length, pressure)
    }
    function _endStroke(angle,pressure) {
        strokeArray.endPlot(angle,pressure)
        strokeArray.draw(strokeOption[0],strokeOption[1],1)
        strokeArray = false;
    }

    class Spline {
        constructor (array_points, curvature = 0.5) {
            let p = new Plot((curvature === 0)? "segments" : "curve")
            if (array_points) {
                this.origin = [array_points[0][0],array_points[0][1]]
                p.origin = this.origin
                let done = 0;
                for (let i = 0; i < array_points.length - 1; i++) {
                    if (curvature > 0 && i < array_points.length - 2) {
                        let p1 = array_points[i], p2 = array_points[i+1], p3 = array_points[i+2];
                        let d1 = dist(p1[0],p1[1],p2[0],p2[1]), d2 = dist(p2[0],p2[1],p3[0],p3[1]);
                        let a1 = calcAngle(p1[0],p1[1],p2[0],p2[1]), a2 = calcAngle(p2[0],p2[1],p3[0],p3[1]);
                        let dd = curvature * Math.min(Math.min(d1,d2),0.5 * Math.min(d1,d2)), dmax = Math.max(d1,d2)
                        let s1 = d1 - dd, s2 = d2 - dd;
                        if (Math.floor(a1) === Math.floor(a2)) {
                            p.addSegment(a1,s1,p1[2],true)
                            p.addSegment(a2,d2,p2[2],true)
                        } else {
                            let point1 = {x: p2[0] - dd * R.cos(-a1), y: p2[1] - dd * R.sin(-a1)}
                            let point2 = {x: point1.x + dmax * R.cos(-a1+90), y: point1.y + dmax * R.sin(-a1+90)}
                            let point3 = {x: p2[0] + dd * R.cos(-a2), y: p2[1] + dd * R.sin(-a2)}
                            let point4 = {x: point3.x + dmax * R.cos(-a2+90), y: point3.y + dmax * R.sin(-a2+90)}
                            let int = intersectar(point1,point2,point3,point4,true)
                            let radius = dist(point1.x,point1.y,int.x,int.y)
                            let disti = dist(point1.x,point1.y,point3.x,point3.y)/2
                            let a3 = 2*asin(disti/radius)
                            let s3 = 2 * Math.PI * radius * a3 / 360;
                            p.addSegment(a1,s1-done, p1[2],true)
                            p.addSegment(a1,s3, p1[2],true)
                            p.addSegment(a2,i === array_points.length - 3 ? s2 : 0, p2[2],true)
                            done = dd;
                        }
                        if (i == array_points.length - 3) {
                            p.endPlot(a2,p2[2],true)
                        }
                    } else if (curvature === 0) {
                        let p1 = array_points[i], p2 = array_points[i+1]
                        let d = dist(p1[0],p1[1],p2[0],p2[1]);
                        let a = calcAngle(p1[0],p1[1],p2[0],p2[1]);
                        p.addSegment(a,d,1,true)
                        if (i == array_points.length - 2) {
                            p.endPlot(a,1,true)
                        }
                    }
                }
            }
            this.p = p
        }
        draw () {this.p.draw()}
    }
    
    function _spline(array_points, curvature = 0.5) {
        let p = new Spline(array_points, curvature = 0.5)
        p.draw()
    }

    //////////////////////////////////////////////////
    // FILL SYSTEM
    function _fill(a,b,c,d) {
        F.o = (arguments.length < 4) ? ((arguments.length < 3) ? b : 1) : d;
        F.c = (arguments.length < 3) ? color(a) : color(a,b,c);
        F.isActive = true;
    }
    function _bleed(_i) {F.b = _i > 0.5 ? 0.5 : _i}
    function _noFill() {F.isActive = false}
    const F = {
        isActive: false,
        b: 0.07,
        fill (polygon) {
            if (this.isActive) {
                F.v = []
                for (let vert of polygon.a) {F.v.push(createVector(vert[0],vert[1]))}
                F.m = [];
                let fluid = F.v.length * R.random(0.4)
                // Shift elements randomly without changing order
                let shift = R.randInt(0,F.v.length);
                F.v = F.v.slice(shift,F.v.length).concat(F.v.slice(0,shift));
                for (let i = 0; i < F.v.length; i++) {
                    if (i < fluid) {
                    F.m.push((constrain(R.random(0.8,1.2) * F.b * 2,0,0.9)))
                    } else {
                    F.m.push((R.random(0.8,1.2) * F.b))
                    }
                }
                // Generate polygon for watercolor effect
                let fill = new fillPol (F.v, F.m, F.calcCenter())
                fill.fill(F.c, int(map(F.o,0,255,0,30,true)))
            }
        },
        calcCenter () {
            let midx = 0, midy = 0;
            for(let i = 0; i < this.v.length; ++i) {
              midx += this.v[i].x;
              midy += this.v[i].y;
            }
            midx /= this.v.length, midy /= this.v.length; 
            return createVector(midx,midy)
        }
    }
    class fillPol {
        constructor (_v,_m,_center) {
            this.v = _v;
            this.m = _m;
            this.midP = _center;
            this.size = p5.Vector.sub(this.midP,this.v[0]).mag();
        }
        grow (_a,degrow = false) {
            const newVerts = [];
            const newMods = [];
            var vertixlength = this.v.length;
            if (_a >= 0.2) {vertixlength = int(_a * this.v.length);}
            for (let i = 0; i < vertixlength; i ++) {
              const j = (i + 1) % vertixlength;
              const v1 = this.v[i];
              const v2 = this.v[j];
              let mod = (_a == 0.1) ? 0.75 : this.m[i];
              if (degrow) mod = -0.5;
              const chmod = m => {return m + (randomGaussian(0.5,0.1) - 0.5) * 0.1;}
              newVerts.push(v1);
              newMods.push(chmod(mod));
              const segment = p5.Vector.sub(v2, v1);
              const len = segment.mag();
              segment.mult(constrain(randomGaussian(0.5,0.2),0.1,0.9));
              const v = p5.Vector.add(segment, v1);
              segment.rotate(-90 + (randomGaussian(0,0.4)) * 45);
              segment.setMag(randomGaussian(0.5,0.2) * R.random(0.6,1.4) * len * mod);
              v.add(segment);
              newVerts.push(v);
              newMods.push(chmod(mod));
            }
            return new fillPol (newVerts, newMods, this.midP);
        }
        fill (color, intensity) {
            let pol = this.grow()
            let pol4 = this.grow()
            let pol2 = pol.grow().grow(0.5);
            let pol3 = pol2.grow(0.4);
            let numLayers = 30
            trans();
            Mix.mask.begin();
            push();
            translate(matrix[0],matrix[1])
            for (let i = 0; i < numLayers; i ++) {
                if (i == int(numLayers/4) || i == int(2*numLayers/4) || i == int(3*numLayers/4)) {
                    pol = pol.grow();
                    pol4 = pol4.grow()
                    pol2 = pol2.grow(0.1);
                    pol3 = pol3.grow(0.1);
                }
                pol.grow().layer(i, intensity / 2);
                pol4.grow(0.1,true).layer(i, 2);
                pol2.grow(0.1).layer(i,int(map(i,0,numLayers/2,intensity / 1.5,0)));
                pol3.grow(0.1).layer(i,int(map(i,0,2*numLayers/3,intensity / 1.5,0)));
                pol.grow().grow().grow().erase(intensity);   // Texture light
            }
            pop();
            Mix.mask.end();
            Mix.blend(color)
        }
        layer (_nr,_alpha) {
            fill(255, 0, 0, _alpha)
            stroke(255, 0, 0, int(0.3*_alpha))
            strokeWeight(map(_nr, 0, 25, 1, 3))
            noStroke()
            beginShape();
            for(let v of this.v) {vertex(v.x, v.y);}
            endShape(CLOSE);
        }
        erase (_i) {
            erase(2)
            for(let i = 0; i < R.random(80,150); i++) {
              circle(this.midP.x + randomGaussian(0,this.size / 2), this.midP.y + randomGaussian(0,this.size / 2), R.random(0.030,0.20) * this.size);
            }
            noErase()
        }
    }
    // p5 BUG FIX - erase() + noErase() in WEBGL
    p5.RendererGL.prototype.erase = function(opacityFill, opacityStroke) {
        if (!this._isErasing) {
            this._cachedBlendMode = this.curBlendMode;
            this._isErasing = true;
            this.blendMode('destination-out');
            this._cachedFillStyle = this.curFillColor.slice();
            this.curFillColor = [1, 1, 1, opacityFill / 255];
            this._cachedStrokeStyle = this.curStrokeColor.slice();
            this.curStrokeColor = [1, 1, 1, opacityStroke / 255];
        }
      }
      p5.RendererGL.prototype.noErase = function() {
        if (this._isErasing) {
            this.curFillColor = this._cachedFillStyle.slice();
            this.curStrokeColor = this._cachedStrokeStyle.slice();
            let temp = this.curBlendMode;
            this.blendMode(this._cachedBlendMode);
            this._cachedBlendMode = temp;
            this._isErasing = false;
            this._applyBlendMode();
        }
      }

    //////////////////////////////////////////////////
    // STANDARD BRUSHES
    const standard_brushes = [
        ["pen", { weight: 0.35, vibration: 0.12, definition: 0.5, quality: 8, opacity: 200, spacing: 0.3, pressure: {curve: [0.15,0.2], min_max: [1.3,1]} }],
        ["rotring", { weight: 0.2, vibration: 0.05, definition: 1, quality: 300, opacity: 250, spacing: 0.15, pressure: {curve: [0.05,0.2], min_max: [1.2,0.95]} }],
        ["2B", { weight: 0.4, vibration: 0.45, definition: 0.1, quality: 9, opacity: 160, spacing: 0.2, pressure: {curve: [0.15,0.2], min_max: [1.2,1]} }],
        ["HB", { weight: 0.3, vibration: 0.5, definition: 0.4, quality: 4,  opacity: 180, spacing: 0.25, pressure: {curve: [0.15,0.2], min_max: [1.2,0.9]} }],
        ["2H", { weight: 0.2, vibration: 0.4, definition: 0.3, quality: 2,  opacity: 150, spacing: 0.2, pressure: {curve: [0.15,0.2], min_max: [1.2,0.9]} }],
        ["cpencil", { weight: 0.4, vibration: 0.6, definition: 0.8, quality: 7,  opacity: 120, spacing: 0.15, pressure: {curve: [0.15,0.2], min_max: [0.95,1.15]} }],
        ["charcoal", { weight: 0.45, vibration: 2, definition: 0.7, quality: 300,  opacity: 110, spacing: 0.07, pressure: {curve: [0.15,0.2], min_max: [1.3,0.95]} }],
        ["hatch_brush", { weight: 0.2, vibration: 0.4, definition: 0.3, quality: 2,  opacity: 150, spacing: 0.15, pressure: {curve: [0.5,0.7], min_max: [1,1.5]} }],
        ["spray", { type: "spray", weight: 0.3, vibration: 12, definition: 15, quality: 40,  opacity: 120, spacing: 0.65, pressure: {curve: [0,0.1], min_max: [0.15,1.2]} }],
        ["marker", { type: "marker", weight: 2.5, vibration: 0.08, opacity: 30, spacing: 0.4, pressure: {curve: [0.35,0.25], min_max: [1.35,1]}}],
        ["marker2", { type: "custom", weight: 2.5, vibration: 0.08, opacity: 23, spacing: 0.6, pressure: {curve: [0.35,0.25], min_max: [1.35,1]}, 
            tip: function () { _r.rect(-1.5,-1.5,3,3); _r.rect(1,1,1,1) }, rotate: "natural"
        }],
    ];
    for (let s of standard_brushes) {
        B.add(s[0],s[1])
    }
    function globalScale(_scale) {
        for (let s of standard_brushes) {
            let params = B.list.get(s[0]).param
            params.weight *= _scale, params.vibration *= _scale, params.spacing *= _scale;
        }
    }

    //////////////////////////////////////////////////
    // EXPORTS
    // Basic functions
    exports.config = _config;                // seed RNG generator
    exports.load = _load;                    // load library on selected buffer
    exports.preload = _preload;              // preload function for custom tips

    // FLOWFIELD
    exports.newField = newField;            // add new field
    exports.field = flowField;              // activate / select field
    exports.noField = disableField;         // disable field
    exports.refreshField = refreshField;    // refresh field for animations

    // BRUSHES
    exports.stScale = globalScale;          // rescales standard brushes
    exports.newBrush = B.add;               // add new brush
    exports.box = brushes;                  // get array with existing brushes
    exports.set = B.set;                    // set all brush values
    exports.pick = B.setBrush;              // select brush
    exports.clip = B.clip;                  // clip brushes with rectangle

    // STROKE
    exports.stroke = B.setColor;
    exports.strokeWeight = B.setWeight;
    exports.noStroke = _noStroke;

    // FILL (works with rect, circle, and beginShape)
    exports.fill = _fill
    exports.bleed = _bleed
    exports.noFill = _noFill

    // GEOMETRY
    exports.line = B.line;                  // lines
    exports.flowLine = B.flowLine;          // line in flowfield
    exports.rect = _rect;                   // rectangle
    exports.circle = _circle;               // circle
    exports.spline = _spline;               // spline
    // Equivalent to beginShape
    exports.beginShape =  _beginShape
    exports.vertex = _vertex
    exports.endShape =  _endShape
    // HandStroke
    exports.beginStroke = _beginStroke
    exports.move = _move
    exports.endStroke = _endStroke



    // Hatches
    exports.Polygon = Polygon;
    exports.hatch = B.hatch;

    // Classes
    exports.Plot = Plot;
    exports.Pos = Position;
    
})));