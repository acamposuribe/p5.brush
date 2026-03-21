/**
 * Custom ESM loader that stubs .vert and .frag GLSL files so that
 * source modules can be imported in Node.js without a browser/WebGL context.
 */
export async function load(url, context, nextLoad) {
  if (url.endsWith('.vert') || url.endsWith('.frag')) {
    return { format: 'module', source: 'export default "";', shortCircuit: true };
  }
  return nextLoad(url, context);
}
