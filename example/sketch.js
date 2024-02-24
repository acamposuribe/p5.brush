//////////////////////////////////////////////////
// CANVAS SIZE
// Good function to create canvas and resize functions
const C = {
    loaded: false,
    prop() {return this.height/this.width},
    isLandscape() {return window.innerHeight <= window.innerWidth * this.prop()},
    resize () {
        if (this.isLandscape()) {
            document.getElementById(this.css).style.height = "100%";
            document.getElementById(this.css).style.removeProperty('width');
        } else {
            document.getElementById(this.css).style.removeProperty('height');
            document.getElementById(this.css).style.width = "100%";
        }
    },
    setSize(w,h,p,css) {
        this.width = w, this.height = h, this.pD = p, this.css = css;
    },
    createCanvas() {
        this.main = createCanvas(this.width,this.height,WEBGL), pixelDensity(this.pD), this.main.id(this.css), this.resize();
    }
};
// SET CANVAS SIZE: width, height, pixelDensity, html_id for the canvas
// Here I'm working with mm units, so I want a big pixelDensity for high-res.
C.setSize(250,250,8,'mainCanvas')

function windowResized () {
    C.resize();
}

// YOU CAN CREATE YOU OWN BRUSHES
brush.add("watercolor", {
    type: "image",       // this is the TIP TYPE: choose standard / spray / marker / custom / image
    weight: 10,          // Base weight of the brush tip
    vibration: 2,        // Vibration of the lines, spread
    definition: 0.5,     // Between 0 and 1
    quality: 8,          // + quality = more continuous line
    opacity: 20,         // Base opacity of the brush (this will be affected by pressure)
    spacing: 1.5,          // Spacing between the points that compose the brush stroke
    blend: true,         // Activate / Disable realistic color mixing. By default, this is active for marker-custom-image brushes 
    pressure: {
        type: "custom",                       // "standard" or "custom". Use "custom"" for custom pressure curves. Use standard for simple gauss bell curve
        //curve: [0.15,0.2],                  // If "standard", pick a and b values for the gauss curve. a is max horizontal mvt of the bell, b changes the slope
        curve: function (x) {return 1-x},     // If "custom", define the curve function with a curve equation from x = 0 to x = 1, returning values from 0 to 1
        min_max: [0.5,1.2]                    // For both cases, define min and max pressure (reverse for inverted presure)
    },
    // if you select the a custom type brush, define the tip geometry here. Use 0,0 as center of tip. If not, you can remove these lines. 
    tip: function () {
        brush.mask.rotate(45),brush.mask.rect(-1.5,-1.5,3,3),brush.mask.rect(1.5,1.5,1,1); // in this example, the tip would be two squares, rotated 45 degrees
    },
    // if you select the image type brush, link your image below. If not, you can remove these lines.
    image: {
        src: "./brush_tips/brush.jpg",
    },
    // For "custom" and "image" types, you can define the tip angle rotation here.
    rotate: "natural", // "none" disables rotation | "natural" follows the direction of the stroke | "random"
})

//////////////////////////////////////////////////
// P5 FUNCTIONS

function preload() {
    // If you are going to use custom image brush tips, include this in preload!
    brush.preload();
}

let palette = ["#002185", "#fcd300", "#ff2702", "#6b9404"]

let x_values = []
let y_values = []

function setup () {

    randomSeed(12323)
    brush.seed(121233)
    C.createCanvas()
    background("#e2e7dc")
    angleMode(RADIANS)

    translate(-width/2,-height/2)
    
    for (let i = 0; i < 6; i++) {
        x_values[i] = random(width)
        y_values[i] = random(width)
    }
    
    
    /*
    brush.field("seabed")
    // STANDARD PALETTE TEST
    let i = 0
    for (let b of brush.box()) {
            brush.set(b,random(palette),1)
            brush.flowLine(30,60+i*10,195,0)
        i++
    }
    */
    

    brush.noStroke()

    brush.gravity(0,height)

    brush.fill("black", 60)
    
    brush.bleed(0.3)
    brush.beginShape(0.5)
    brush.vertex(50,50)
    brush.vertex(150,50)
    brush.vertex(150,150)
    brush.vertex(50,150)
    brush.endShape(CLOSE)
    
    brush.reBlend()

    brush.fill("blue", 60)
    brush.beginShape(0.5)
    brush.vertex(100,50)
    brush.vertex(200,50)
    brush.vertex(200,150)
    brush.vertex(100,150)
    brush.endShape(CLOSE)
    brush.noFill()
    
    
}

function draw() {

    /*
    //background("#e2e7dc")
    translate(-width/2,-height/2)
    strokeWeight(2)
    brush.set("HB", "black", 1)
    brush.bleed(0.4)
    brush.beginShape(1)
        for (let i = 0; i < 6; i++) {
            stroke(random(palette))
            point(x_values[i],y_values[i])
            brush.vertex(x_values[i],y_values[i])
        }
    randomSeed(12133)
    brush.endShape(CLOSE)

    noLoop()
    */
}

function mouseDragged() {
    loop()
    frameRate(10)
    x_values[0] = mouseX
    y_values[0] = mouseY
}