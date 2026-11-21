// A piece of a stroke's path (see Plot.pieces() and pathPoint() in
// src/core/plot.js): it starts at path.xy heading along the unit vector
// path.zw (y up, so the canvas step is (x, -y)) and turns `turn` radians per
// unit of length: a straight run when 0, a circular arc otherwise.
// Returns the point at distance s along the piece, and sets `dir` to the
// heading there. A straight run needs no trigonometry; an arc needs one
// sine and cosine.
vec2 pathAt(vec4 path, float turn, float s, out vec2 dir) {
    if (turn == 0.0) {
        dir = path.zw;
        return path.xy + s * vec2(path.z, -path.w);
    }
    // The chord to the point turns half as far as the heading.
    float half_turn = 0.5 * turn * s;
    float c = cos(half_turn), sn = sin(half_turn);
    float chord = abs(half_turn) < 1e-3 ? 1.0 - half_turn * half_turn / 6.0 : sn / half_turn;
    vec2 chordDir = vec2(path.z * c - path.w * sn, path.w * c + path.z * sn);
    dir = vec2(chordDir.x * c - chordDir.y * sn, chordDir.y * c + chordDir.x * sn);
    return path.xy + s * chord * vec2(chordDir.x, -chordDir.y);
}

#pragma glslify: export(pathAt)
