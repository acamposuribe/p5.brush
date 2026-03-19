import * as brush from "../../dist/brush.esm.js";

const svg = encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
    <circle cx="40" cy="40" r="24" fill="black"/>
    <rect x="35" y="8" width="10" height="64" fill="black"/>
    <rect x="8" y="35" width="64" height="10" fill="black"/>
  </svg>
`);

brush.createCanvas(600, 600, {
  id: "brush-canvas",
  parent: "#canvas-host",
  pixelDensity: globalThis.devicePixelRatio || 1,
});
brush.clear("#fffceb");
brush.scaleBrushes(3);
brush.angleMode(brush.DEGREES);

await brush.add("standalone-image", {
  type: "image",
  image: { src: `data:image/svg+xml;charset=utf-8,${svg}` },
  weight: 0.8,
  scatter: 0.5,
  sharpness: 1,
  grain: 24,
  opacity: 200,
  spacing: 0.18,
  noise: 0.1,
  rotate: "natural",
  markerTip: false,
  pressure: [1, 1],
});

brush.set("standalone-image", "#305f8a", 1);
brush.line(-200, 120, 200, -120);
brush.render();

console.log("standalone image brush test executed");
