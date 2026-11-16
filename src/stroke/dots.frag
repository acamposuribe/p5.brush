#version 300 es
precision highp float;

in float v_alpha;
in float v_rest;
in vec2 v_dir;
flat in uint v_seed;
out vec4 outColor;

uniform vec4 u_color;
uniform bool u_affineCircle;
uniform mat2 u_tipInverse;

uniform vec3 u_nib;        // markers: flat nib (cos, sin of its angle, thickness); thickness 1 is round
uniform float u_specks;     // markers: extra ink in the paper's pits and where the nib rests (0 off)
uniform uint u_paperSeed;
uniform float u_density;
uniform mat3 u_paperInverse; // device px -> drawing space (inverse of the stroke's transform)
uniform float u_paperPx;     // one device px, in drawing units

uniform bool u_clipEnabled;
uniform mat3 u_clipMatrix;
uniform vec4 u_clipBounds;

uint pcg(uint v) {
    uint state = v * 747796405u + 2891336453u;
    uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
    return (word >> 22u) ^ word;
}

float cellHash(ivec2 c, uint s) {
    return float(pcg(uint(c.x) * 1597334677u ^ pcg(uint(c.y) ^ s)) >> 8) * (1.0 / 16777216.0);
}

// The paper's pits: sparse spots fixed in drawing space that soak up more of
// a marker's ink. They follow brush.seed() like the fills' paper, so every
// stroke darkens the same ones, and they scale, rotate and move with the
// transform like the line does. No two are alike: their size, their streak
// along the stroke (ink dragged past) and their depth vary, most are faint
// and a few strong, and each is deepest at its core.
float paperSpeck() {
    const float CELL = 2.0; // drawing units (logical px at scale 1)
    vec2 q = (u_paperInverse * vec3(gl_FragCoord.xy, 1.0)).xy / CELL;
    ivec2 id = ivec2(floor(q));
    if (cellHash(id, u_paperSeed + 21u) > 0.08) return 0.0;
    vec2 centre = vec2(id) + 0.3 + 0.4 * vec2(cellHash(id, u_paperSeed + 22u), cellHash(id, u_paperSeed + 23u));
    float size = cellHash(id, u_paperSeed + 24u);
    float radius = mix(0.25, 0.7, size * size);                       // drawing units
    float stretch = mix(1.2, 2.8, cellHash(id, u_paperSeed + 26u));
    float depth = pow(cellHash(id, u_paperSeed + 25u), 2.0);          // mostly faint
    vec2 rel = (q - centre) * CELL;
    vec2 dir = v_dir;
    float d = length(vec2(dot(rel, dir) / stretch, dot(rel, vec2(-dir.y, dir.x))));
    // Deepest at the core, fading out over the radius plus about a device
    // pixel, so it reads as a soft spot rather than a flat one.
    float core = 1.0 - smoothstep(0.0, radius + 0.7 * u_paperPx, d);
    // A transform that shrinks a speck below about a device pixel fades it
    // out rather than let it flicker. Specks already that small at scale 1
    // (low pixel density) fade only as the transform shrinks them further.
    float shrink = 1.0 / (u_paperPx * u_density);                     // transform scale
    float fade = smoothstep(0.5, 1.0, max(2.0 * radius / u_paperPx, shrink));
    return core * core * mix(0.15, 1.0, depth) * fade;
}

void main() {
    if (u_clipEnabled) {
        vec2 p = (u_clipMatrix * vec3(gl_FragCoord.xy, 1.0)).xy;
        if (p.x < u_clipBounds.x || p.y < u_clipBounds.y ||
            p.x > u_clipBounds.z || p.y > u_clipBounds.w) discard;
    }
    // Point coordinate centered around (0.0, 0.0)
    vec2 v = gl_PointCoord - vec2(0.5);
    if (u_affineCircle) v = u_tipInverse * vec2(v.x, -v.y);

    // Distance from center
    float f = length(v);

    if (u_nib.z < 1.0) {
        // A flat nib held at a fixed angle on the paper: a stadium as long as
        // the dot is wide and `thickness` of that across. Its signed distance
        // takes the circle's place, so the edge is antialiased the same way.
        vec2 n = vec2(u_nib.x * v.x + u_nib.y * v.y, -u_nib.y * v.x + u_nib.x * v.y);
        float half_t = 0.5 * u_nib.z;
        f = length(vec2(max(abs(n.x) - (0.5 - half_t), 0.0), n.y)) - half_t + 0.5;
    }

    // Antialiasing factor
    float a = fwidth(f);

    // Soft circular mask (1.0 at center, 0.0 outside radius ~0.5)
    f = 1.0 - smoothstep(0.5 - a, 0.5 + a, f);

    // Discard nearly transparent fragments
    if (f < 0.01) {
        discard;
    }

    // Coverage goes in alpha, as always. Red carries a marker's extra ink,
    // added up rather than saturating: the paper's pits soak up more, and so
    // does the spot where the nib rests. The composite darkens by it, so it
    // shows even where the line is already dense.
    // The nib is rounded, so where it rests the ink is deepest under its
    // middle: the resting dots add extra ink on a dome profile.
    float dome = clamp(1.0 - dot(v, v) * 4.0, 0.0, 1.0);
    float extra = u_specks > 0.0 ? v_alpha * f * (3.0 * v_rest * dome * dome + 1.4 * paperSpeck()) : 0.0;
    // The mask is 8-bit and one dot's share of a faint speck is below one
    // step, so it is rounded up or down at random in proportion: summed over
    // the many dots that overlap, the extra ink comes out right on average.
    if (extra > 0.0) {
        uint h = pcg(v_seed ^ (uint(gl_FragCoord.x) * 73856093u) ^ (uint(gl_FragCoord.y) * 19349663u));
        float e = extra * 255.0;
        extra = (floor(e) + step(float(h >> 8) * (1.0 / 16777216.0), fract(e))) / 255.0;
    }
    outColor = vec4(extra, 0.0, 0.0, v_alpha * f);
}