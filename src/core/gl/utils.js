/**
 * Compiles a shader program from the given vertex and fragment sources.
 * @param {WebGL2RenderingContext} gl - The WebGL2 context.
 * @param {string} vert - Vertex shader source.
 * @param {string} frag - Fragment shader source.
 * @returns {WebGLProgram} The compiled and linked program.
 */
export const createProgram = (gl, vert, frag) => {
    const p = gl.createProgram();
    for (let [t, src] of [
        [gl.VERTEX_SHADER, vert],
        [gl.FRAGMENT_SHADER, frag],
    ]) {
        const s = gl.createShader(t);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    return p;
};