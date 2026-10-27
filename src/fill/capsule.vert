#version 300 es

// Polygon borders and erase circles. One instance per capsule: the set of
// points within a radius of a segment. A border is one capsule per polygon
// edge, which together give a round-joined stroke; an erase circle is a
// capsule whose ends coincide.

in vec2 a_start;
in vec2 a_end;
in vec4 a_info; // radius, paint weight, erase weight, depth

uniform mat3 u_matrix; // user space → clip space
uniform float u_pixel;  // device pixels per user unit

out vec2 v_pos;
flat out vec2 v_start;
flat out vec2 v_end;
flat out vec3 v_info;

void main() {
    // Grow the quad by half a pixel for the antialiased edge.
    float r = a_info.x + 0.5 / u_pixel;
    vec2 d = a_end - a_start;
    float len = length(d);
    vec2 u = len > 1e-6 ? d / len : vec2(1.0, 0.0);
    vec2 n = vec2(-u.y, u.x);

    // Triangle strip: (start, -n), (start, +n), (end, -n), (end, +n).
    vec2 base = gl_VertexID < 2 ? a_start - u * r : a_end + u * r;
    v_pos = base + n * r * ((gl_VertexID & 1) == 0 ? -1.0 : 1.0);
    v_start = a_start;
    v_end = a_end;
    v_info = vec3(a_info.x * u_pixel, a_info.yz);

    // Every capsule of one polygon's border shares a depth, and the depth test
    // passes only the first of them at each pixel: the border paints a pixel
    // once however many capsules cover it, as Canvas2D strokes do.
    gl_Position = vec4((u_matrix * vec3(v_pos, 1.0)).xy, a_info.w * 2.0 - 1.0, 1.0);
}
