#version 300 es

in vec2 a_position;
in float a_radius;
in float a_alpha;

uniform mat4 u_matrix;

out float v_alpha;

void main() {
    // Transform 2D position into clip space using the matrix
    gl_Position = u_matrix * vec4(a_position, 0.0, 1.0);

    // Pass alpha to the fragment shader
    v_alpha = a_alpha;

    // Set point size (diameter = 2 * radius)
    gl_PointSize = a_radius * 2.0;
}