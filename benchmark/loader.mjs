/**
 * Custom ESM loader that stubs GLSL shader files and browser-only modules
 * so that source modules can be imported in Node.js without a browser/WebGL context.
 */
export async function load(url, context, nextLoad) {
  // Stub GLSL shader files
  if (url.endsWith('.vert') || url.endsWith('.frag')) {
    return { format: 'module', source: 'export default "";', shortCircuit: true };
  }
  // Stub compositor_runtime — provides GL compositor hooks not needed for pure computation
  if (url.includes('compositor_runtime') || url.includes('renderer_runtime')) {
    return {
      format: 'module',
      source: `
        export const setCompositorRuntime = () => {};
        export const setRendererRuntime = () => {};
        export const clearTarget = () => {};
        export const ensureBlendShaderProgram = () => {};
        export const ensureBlendSourceFramebuffer = () => {};
        export const createFramebuffer = () => null;
        export const runBlendShaderPass = () => {};
        export const blitSourceToFramebuffer = () => {};
        export const blendToTarget = () => {};
        export const composite = () => {};
        export const create2DCanvas = () => null;
        export const get2DContext = () => null;
        export const blitDefaultFramebufferSource = () => {};
        export const beginDirectMaskDraw = () => null;
        export const endDirectMaskDraw = () => {};
        export const resetDirectShaderTracking = () => {};
      `,
      shortCircuit: true,
    };
  }
  return nextLoad(url, context);
}
