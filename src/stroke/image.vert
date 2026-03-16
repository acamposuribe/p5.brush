#version 300 es

// Per-vertex: one of the four unit-quad corners
in vec2 a_corner;

// Per-instance
in vec2  a_pos;    // stamp centre in screen-pixel space
in float a_size;   // half-size in screen pixels (already scaled by Density & matrix)
in float a_angle;  // rotation in radians
in float a_alpha;  // opacity [0..1]

uniform mat4 u_proj;

out vec2  v_uv;
out float v_alpha;

void main() {
    float c = cos(a_angle);
    float s = sin(a_angle);
    vec2 rotated = vec2(
        c * a_corner.x - s * a_corner.y,
        s * a_corner.x + c * a_corner.y
    );
    gl_Position = u_proj * vec4(a_pos + rotated * a_size, 0.0, 1.0);
    // Map corner [-1,1] → uv [0,1]; without UNPACK_FLIP_Y this gives the
    // correct orientation because our projection already has Y increasing downward.
    v_uv    = a_corner * 0.5 + 0.5;
    v_alpha = a_alpha;
}
