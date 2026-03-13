#version 300 es
out vec2 p;
void main() {
    vec3 v = vec3(-1);
    v[gl_VertexID] = 3.;
    gl_Position = vec4(p=v.xy, 0, 1);
}