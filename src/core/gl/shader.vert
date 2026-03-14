#version 300 es

uniform bool u_flipOutputY;

out vec2 p;

void main() {
    vec3 v = vec3(-1);
    v[gl_VertexID] = 3.;
    p = v.xy;
    gl_Position = vec4(v.x, u_flipOutputY ? -v.y : v.y, 0, 1);
}