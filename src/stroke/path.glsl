// The point at distance s along a piece of path (see Plot.pieces()), and in
// `dir` the heading there. The piece starts at path.xy heading along the unit
// vector path.zw (y up) and turns `turn` radians per unit of length.
vec2 pathAt(vec4 path, float turn, float s, out vec2 dir) {
    if (turn == 0.0) {
        dir = path.zw;
        return path.xy + s * vec2(path.z, -path.w);
    }
    // The chord turns half as far as the heading.
    float half_turn = 0.5 * turn * s;
    float c = cos(half_turn), sn = sin(half_turn);
    float chord = abs(half_turn) < 1e-3 ? 1.0 - half_turn * half_turn / 6.0 : sn / half_turn;
    vec2 chordDir = vec2(path.z * c - path.w * sn, path.w * c + path.z * sn);
    dir = vec2(chordDir.x * c - chordDir.y * sn, chordDir.y * c + chordDir.x * sn);
    return path.xy + s * chord * vec2(chordDir.x, -chordDir.y);
}

#pragma glslify: export(pathAt)
