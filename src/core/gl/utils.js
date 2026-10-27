/**
 * Compiles a shader program from the given vertex and fragment sources.
 * @param {WebGL2RenderingContext} gl - The WebGL2 context.
 * @param {string} vert - Vertex shader source.
 * @param {string} frag - Fragment shader source.
 * @returns {WebGLProgram} The compiled and linked program.
 */
export const createProgram = (gl, vert, frag) => {
  const p = gl.createProgram();
  const shaders = [];
  try {
    for (const [type, source] of [[gl.VERTEX_SHADER, vert], [gl.FRAGMENT_SHADER, frag]]) {
      const shader = gl.createShader(type);
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(`Brush shader compilation failed: ${gl.getShaderInfoLog(shader)}`);
      }
      gl.attachShader(p, shader);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(`Brush shader linking failed: ${gl.getProgramInfoLog(p)}`);
    }
    for (const shader of shaders) gl.detachShader(p, shader);
    return p;
  } catch (error) {
    gl.deleteProgram(p);
    throw error;
  } finally {
    for (const shader of shaders) gl.deleteShader(shader);
  }
};
