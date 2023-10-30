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
C.setSize(250,280,10,'mainCanvas')

function windowResized () {
    C.resize();
}

let palette = ["#7b4800", "#002185", "#003c32", "#fcd300", "#ff2702", "#6b9404"]



//////////////////////////////////////////////////
// p5.brush

// YOU CAN SEED THE BRUSHBOX RANDOM NUMBER GENERATOR for determinism
brush.config({
    // R: function () { return YOUR_RNG() },
})

// YOU CAN CREATE YOU OWN BRUSHES
brush.newBrush("watercolor", {
    type: "image",       // this is the TIP TYPE: choose standard / spray / marker / custom / image
    weight: 17,          // Base weight of the brush tip
    vibration: 2,        // Vibration of the lines, spread
    definition: 0.5,     // Between 0 and 1
    quality: 8,          // + quality = more continuous line
    opacity: 10,         // Base opacity of the brush (this will be affected by pressure)
    spacing: 1,          // Spacing between the points that compose the brush stroke
    blend: true,         // Activate / Disable realistic color mixing. By default, this is active for marker-custom-image brushes 
    pressure: {
        type: "custom",                       // "standard" or "custom". Use "custom"" for custom pressure curves. Use standard for simple gauss bell curve
        //curve: [0.15,0.2],                  // If "standard", pick a and b values for the gauss curve.
        curve: function (x) {return 1-x},     // If "custom", define the curve function with a curve equation from x = 0 to x = 1, returning values from 0 to 1
        min_max: [0.5,1.2]                    // For both cases, define min and max pressure (reverse for inverted presure)
    },
    // if you select the a custom type brush, define the tip geometry here. Use 0,0 as center of tip. If not, you can remove these lines.
    tip: function () {
        rotate(45),rect(-1.5,-1.5,3,3),rect(1.5,1.5,1,1); // in this example, the tip would be two squares, rotated 45 degrees
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

function setup () {

    C.createCanvas()
    background("#e2e7dc")

    angleMode(DEGREES) // Because I'm an architect

    // USE BRUSHBOX LIBRARY
    // Load BrushBox: load(BUFFER) -> Leave empty if you want to draw to the main p5 canvas
    brush.load();
    // Set your brush name, color, and weight. There are 9 standard brushes to select from.
    // Select colors with HEX codes, arrays of [r,g,b] or names
    brush.set("marker","black",1)
    // Translate(x,y) - here I'm translating, so to draw like a 2D canvas
    brush.translate(-width/2,-height/2)
    // Draw a line (x1,y1,x2,y2)
    brush.line(20,20,200,20)
    // Change the color or weight scale. Use hex color codes
    brush.color("#002185")
    brush.strokeWeight(1.2)
    // You can also draw flowlines (x1,y1,distance,angle)
    // If you want to draw flowLines, you need to select one of the provided flow_fields.
    brush.flowField("seabed");
    brush.flowLine(20,40,180,0)
    // You can also clip all following lines with a rectangle (x1,y1,x2,y2)
    brush.clip([30,10,100,100]);
    brush.flowLine(20,60,100,0)
    // And remove the clip
    brush.clip(false);
    // You can set a different brush
    brush.pick("marker")
    // You can create and draw polygons
    brush.strokeWeight(1)
    let polygon = new brush.Polygon([
        [20,80],
        [100,80],
        [100,120],
        [30,140],
    ]);
    //polygon.draw();
    brush.set("rotring","#9c2128",1)
    // You can also atch these polygons .hath(distance_between_lines, angle_of_lines, 0-1.0 for % precission)
    //polygon.hatch(2,45,0.05)
    // You can also hatch arrays of polygons brush.hatch(ARRAY WITH POLS, distance_between_lines, angle_of_lines, 0-1.0 for % precission)
    brush.color("#080f15")
    let pol_array = []
    for (let i = 0; i < 5; i++) {
        pol_array.push(new brush.Polygon([
            [random(width),random(height)],
            [random(width),random(height)],
            [random(width),random(height)],
            [random(width),random(height)]
        ]));
    }
    brush.hatch(pol_array,3,0)
    // You can draw rectangles (x,y,width,height,mode) - mode is optional, you can set it to "center"
    brush.set("charcoal","#6b9404",1)
    //brush.rect(100,100,100,100,"center")
    // You can draw ricles (x,y,radius)
    brush.color("#002185")
    brush.circle(100,100,50)
    brush.color("#fcd300")
    brush.circle(102,100,50)
    // You can create curves/plots (here I'm creating 4 spirals). This offers full control of the brush pressure, though it's a tad more complicated
    brush.pick("watercolor")
    brush.flowField("seabed")
    for (let j = 0; j < 4; j++) {
        let plot = new brush.Plot("curve")
        for (let i = 0; i < Math.floor(random(40,90)); i++) {
            plot.addSegment(0,1+i*4,random(1.2))
            plot.addSegment(90,2+i*4,random(1.2))
            plot.addSegment(180,3+i*4,random(1.2))
            plot.addSegment(270,4+i*4,random(1.2))
        }
        plot.endPlot(0,1)
        plot.rotate(Math.floor(random(0,180)))
        brush.color(random(palette))
        //brush.flowShape(plot,width*random(0.3,0.7),height*random(0.1,0.9),random(0.5,1))
    }

    brush.disableField()
    brush.pick("HB")
    // A different way of creating curves, by an array of points [x, y, brush pressure at that point]
    let points = []
    for (let i = 0; i < 55; i++) {
        points.push([random(width),random(height),random(0.7,1.2)])
    }
    // brush.spline(array_points, curvature) curvature is a value 0-1. Use 0 for a truncated line
    // The curve will go from the first point to the last one, using the rest as control points
    //brush.spline(points,1)

    brush.flowField("seabed")
}

function draw() {
    brush.set(random(brush.box()),random(palette),random(1,1.5))
    brush.flowLine(width*random(0,1),height*random(0,1),width*random(0.5,0.8),random(0,360))

    /*
    let polygon = new brush.Polygon([
        [random(width),random(height)],
        [random(width),random(height)],
        [random(width),random(height)],
        [random(width),random(height)]
    ])
    brush.hatch(polygon,random(1,5),random(0,180))  
    */  
    
}

function mouseClicked() {
    noLoop();
}