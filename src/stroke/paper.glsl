// Paper tooth: a fixed height map in canvas space shared by every stroke.
// paperContact() returns how much of a mark's ink a fragment keeps.

#pragma glslify: paperHeight = require(./paper_height.glsl)

// paper: (contact strength 0..1, grain size in logical px, pixel density, seed).
// A mark deposits only where the paper rises above a level set by its
// pressure — light pressure catches only the hilltops.
float paperContact(vec4 paper, vec2 fragCoord, float pressure) {
    if (paper.x <= 0.0) return 1.0;
    float h = paperHeight(fragCoord / (paper.z * paper.y), uint(paper.w));
    float level = 0.95 - 0.45 * pressure;
    return mix(1.0, smoothstep(level - 0.25, level + 0.25, h), paper.x);
}

#pragma glslify: export(paperContact)
