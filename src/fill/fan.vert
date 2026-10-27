#version 300 es

// Polygon fills, by stencil-then-cover. Each polygon is drawn as a fan of
// triangles (centre, edge start, edge end) twice: first into the stencil,
// counting its winding number at every pixel, then as colour wherever that
// count is non-zero. That is Canvas2D's nonzero fill rule, exactly, with no
// triangulation, for concave and self-intersecting polygons alike. Each
// polygon is drawn at several sub-pixel offsets (u_jitter) to antialias it.

in vec2 a_pos;

uniform mat3 u_matrix; // user space → clip space
uniform vec2 u_jitter; // sub-pixel offset, in clip space

void main() {
    gl_Position = vec4((u_matrix * vec3(a_pos, 1.0)).xy + u_jitter, 0.0, 1.0);
}
