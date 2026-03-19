// =============================================================================
// Adapter: p5 Compositor Hooks
// =============================================================================

import {
  setCompositorRuntime,
  blitDefaultFramebufferSource,
} from "../../core/compositor_runtime.js";

function clearTarget(renderer, target, isFramebufferTarget) {
  if (!target) return;

  if (isFramebufferTarget(target)) {
    target.draw(() => renderer.clear());
    return;
  }

  const ctx = target.drawingContext;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, target.width, target.height);
  ctx.restore();
}

function ensureBlendShaderProgram(renderer, vertSrc, fragSrc) {
  if (!renderer.loaded) {
    renderer.loaded = true;
    renderer.shaderProgram ??= renderer.createShader(vertSrc, fragSrc);
  }
  return renderer.shaderProgram;
}

function ensureBlendSourceFramebuffer(
  renderer,
  currentFramebuffer,
  width,
  height,
  density,
) {
  if (currentFramebuffer?.remove) currentFramebuffer.remove();
  return renderer.createFramebuffer({
    width,
    height,
    density,
    antialias: false,
    depth: false,
    stencil: false,
  });
}

const createFramebuffer = (renderer, options) =>
  renderer.createFramebuffer(options);

function runBlendShaderPass({
  renderer,
  shader,
  source,
  mask,
  color,
  isBrushMask,
  Cwidth,
  Cheight,
  dirtyRect,
  targetIsFramebuffer,
  withScissor,
}) {
  const gl = renderer.drawingContext;
  const hadDepthTest = gl.getParameter(gl.DEPTH_TEST);

  gl.disable(gl.DEPTH_TEST);

  renderer.push();
  renderer.translate(0, 0);
  renderer.shader(shader);

  shader.setUniform("u_source", source);
  shader.setUniform("u_targetIsFramebuffer", targetIsFramebuffer);
  shader.setUniform("u_isBrush", isBrushMask);
  shader.setUniform("u_mask", mask);
  shader.setUniform("u_color", color);

  withScissor(
    gl,
    dirtyRect,
    () => {
      renderer.fill(0, 0, 0, 0);
      renderer.noStroke();
      renderer.rect(-Cwidth / 2, -Cheight / 2, Cwidth, Cheight);
    },
    !targetIsFramebuffer,
  );

  renderer.pop();
  renderer.resetShader();
  if (hadDepthTest) gl.enable(gl.DEPTH_TEST);
}

function blitSourceToFramebuffer(args) {
  if (args.isFramebufferTarget(args.sourceTarget)) {
    (args.sourceTarget.renderer ?? args.renderer)._renderer?.flushDraw?.();
    args.sourceFramebuffer.draw(() => {
      args.withScissor(
        args.renderer.drawingContext,
        args.dirtyRect,
        () => {
          args.renderer.clear();
          args.renderer.push();
          args.renderer.imageMode(args.renderer.CENTER);
          args.renderer.image(
            args.sourceTarget,
            0,
            0,
            args.Cwidth,
            args.Cheight,
          );
          args.renderer.pop();
        },
        false,
      );
    });
    return args.sourceFramebuffer;
  }

  args.renderer._renderer?.flushDraw?.();
  return blitDefaultFramebufferSource(args);
}

export function initP5CompositorRuntime() {
  setCompositorRuntime({
    clearTarget,
    ensureBlendShaderProgram,
    ensureBlendSourceFramebuffer,
    createFramebuffer,
    runBlendShaderPass,
    blitSourceToFramebuffer,
  });
}
