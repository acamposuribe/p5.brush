// =============================================================================
// Adapter: Standalone Stroke Hooks
// =============================================================================

import { create2DCanvas, get2DContext } from "../../core/compositor_runtime.js";
import { setStrokeRuntime } from "../../stroke/runtime.js";

function cssColor(value) {
  if (typeof value === "number") {
    const c = Math.max(0, Math.min(255, value));
    return `rgb(${c} ${c} ${c})`;
  }
  return value ?? "black";
}

function buildTipSurface(canvas) {
  const ctx = get2DContext(canvas);
  const surface = {
    canvas,
    drawingContext: ctx,
    width: canvas.width,
    height: canvas.height,
    pixels: null,
    _fillStyle: "#ffffff",
    _strokeStyle: "transparent",
    _lineWidth: 1,

    pixelDensity() {
      return 1;
    },

    background(value) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = cssColor(value);
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    },

    noSmooth() {
      ctx.imageSmoothingEnabled = false;
    },

    push() {
      ctx.save();
    },

    pop() {
      ctx.restore();
    },

    translate(x, y) {
      ctx.translate(x, y);
    },

    scale(x, y = x) {
      ctx.scale(x, y);
    },

    rotate(angle) {
      ctx.rotate(angle);
    },

    noStroke() {
      surface._strokeStyle = "transparent";
    },

    stroke(value) {
      surface._strokeStyle = cssColor(value);
    },

    noFill() {
      surface._fillStyle = "transparent";
    },

    fill(value) {
      surface._fillStyle = cssColor(value);
    },

    strokeWeight(value) {
      surface._lineWidth = value;
    },

    rect(x, y, w, h) {
      ctx.beginPath();
      ctx.rect(x, y, w, h);
      surface._paint();
    },

    circle(x, y, d) {
      ctx.beginPath();
      ctx.arc(x, y, d / 2, 0, Math.PI * 2);
      surface._paint();
    },

    ellipse(x, y, w, h) {
      ctx.beginPath();
      ctx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
      surface._paint();
    },

    line(x1, y1, x2, y2) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = surface._strokeStyle;
      ctx.lineWidth = surface._lineWidth;
      ctx.stroke();
    },

    beginShape() {
      ctx.beginPath();
      surface._shapeStarted = false;
    },

    vertex(x, y) {
      if (!surface._shapeStarted) {
        ctx.moveTo(x, y);
        surface._shapeStarted = true;
      } else {
        ctx.lineTo(x, y);
      }
    },

    endShape(close = false) {
      if (close) ctx.closePath();
      surface._paint();
    },

    loadPixels() {
      surface.pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    },

    updatePixels() {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      imageData.data.set(surface.pixels);
      ctx.putImageData(imageData, 0, 0);
    },

    _paint() {
      if (surface._fillStyle !== "transparent") {
        ctx.fillStyle = surface._fillStyle;
        ctx.fill();
      }
      if (surface._strokeStyle !== "transparent") {
        ctx.strokeStyle = surface._strokeStyle;
        ctx.lineWidth = surface._lineWidth;
        ctx.stroke();
      }
    },
  };

  return surface;
}

function createTipSurface(width, height) {
  return buildTipSurface(create2DCanvas(width, height));
}

function loadImageTip(src, imageToWhite) {
  return new Promise((resolve, reject) => {
    const NativeImage = globalThis.Image;
    if (!NativeImage) {
      reject(new Error("Standalone image brush loading requires Image support."));
      return;
    }

    const nativeImg = new NativeImage();
    nativeImg.onload = () => {
      const surface = buildTipSurface(
        create2DCanvas(nativeImg.naturalWidth, nativeImg.naturalHeight),
      );
      surface.drawingContext.drawImage(nativeImg, 0, 0);
      imageToWhite(surface);
      resolve(surface);
    };
    nativeImg.onerror = () =>
      reject(new Error(`Failed to load image tip: ${src}`));
    nativeImg.crossOrigin = "anonymous";
    nativeImg.src = src;
  });
}

export function initStandaloneStrokeRuntime() {
  setStrokeRuntime({
    createTipSurface,
    loadImageTip,
  });
}
