import * as brush from "../../dist/brush.esm.js";

const host = document.getElementById("canvas-host");
const canvas = document.createElement("canvas");
const pixelDensity = globalThis.devicePixelRatio || 1;

canvas.id = "brush-canvas";
canvas.width = Math.round(600 * pixelDensity);
canvas.height = Math.round(600 * pixelDensity);
canvas.style.width = "600px";
canvas.style.height = "600px";
host.appendChild(canvas);

if (typeof OffscreenCanvas === "undefined") {
  console.warn("OffscreenCanvas is not available in this browser.");
} else {
  const offscreen = new OffscreenCanvas(600, 600);

  brush.load(offscreen);
  brush.clear("#fffceb");
  brush.scaleBrushes(3);
  brush.angleMode(brush.DEGREES);
  brush.set("HB", "#183a52", 1);
  brush.line(-200, -140, 200, 140);
  brush.render();

  const ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(offscreen, 0, 0, canvas.width, canvas.height);
}

console.log("standalone offscreen test executed");
