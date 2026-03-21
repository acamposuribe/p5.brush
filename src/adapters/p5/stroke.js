// =============================================================================
// Adapter: p5 Stroke Hooks
// =============================================================================

import { Renderer, Instance } from "../../core/target.js";
import { setStrokeRuntime } from "../../stroke/runtime.js";

const getP5BrushFactory = () => Renderer ?? Instance ?? window.self?.p5?.instance;

function createTipSurface(width, height) {
  const factory = getP5BrushFactory();
  if (!factory?.createGraphics) {
    throw new Error("p5 stroke tip creation requires an active renderer or instance.");
  }
  return factory.createGraphics(width, height);
}

function loadImageTip(src, imageToWhite) {
  return new Promise((resolve, reject) => {
    const nativeImg = new window.Image();
    nativeImg.onload = () => {
      const factory = getP5BrushFactory();
      if (!factory?.createImage) {
        reject(new Error("p5 image tip loading requires an active renderer or instance."));
        return;
      }
      const p5img = factory.createImage(
        nativeImg.naturalWidth,
        nativeImg.naturalHeight,
      );
      p5img.drawingContext.drawImage(nativeImg, 0, 0);
      imageToWhite(p5img);
      resolve(p5img);
    };
    nativeImg.onerror = () =>
      reject(new Error(`Failed to load image tip: ${src}`));
    nativeImg.crossOrigin = "anonymous";
    nativeImg.src = src;
  });
}

export function initP5StrokeRuntime() {
  setStrokeRuntime({
    createTipSurface,
    loadImageTip,
  });
}
