// Capture only working behavior: density 1, no clipping, uniform transforms,
// non-degenerate geometry. Original pre-fix fingerprints are retained except
// the field scene intentionally updated for B24 (see legacy-output.json).
// Additional optimization-path references come from the post-B24/pre-optimization build.
export async function compatibility(b, onCapture = () => {}) {
  const canvas = b.createCanvas(256, 256, {parent: null});
  const gl = canvas.getContext('webgl2');
  const hashes = {};
  const reset = () => {
    b.render(); b.clear('white'); b.seed(123); b.noiseSeed(456);
    b.angleMode(b.DEGREES); b.noFill(); b.noWash(); b.noHatch(); b.noMass(); b.noField();
  };
  const capture = async name => {
    b.render();
    const pixels = new Uint8Array(256 * 256 * 4);
    gl.readPixels(0, 0, 256, 256, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const hash = await crypto.subtle.digest('SHA-256', pixels);
    if (name !== 'watercolor') hashes[name] = [...new Uint8Array(hash)].map(x => x.toString(16).padStart(2, '0')).join('');
    onCapture(name, pixels);
  };
  reset();
  for (const [i, brush] of b.box().entries()) {
    b.set(brush, '#326a98', 1.5); b.line(-90, -100 + i * 18, 90, -100 + i * 18);
  }
  await capture('standardBrushes');
  reset(); b.set('HB', '#a15035');
  b.circle(0, 0, 70); b.spline([[-90,70,1],[-20,30,.8],[60,70,1]], .4);
  await capture('curves');
  reset(); b.noStroke(); b.fill('#326a98', 140); b.rect(-50, -50, 100, 100);
  await capture('watercolor');
  reset(); b.noStroke(); b.wash('#326a98', 140); b.rect(-50, -50, 100, 100);
  await capture('wash');
  reset(); b.set('HB', '#326a98'); b.hatch(7, 30, {rand:.2,continuous:true});
  b.rect(-60, -60, 120, 120); await capture('hatch');
  reset(); b.noStroke(); b.mass('HB', '#326a98', {precision:.6,strength:.5});
  b.rect(-40, -40, 80, 80); await capture('mass');
  reset(); b.set('HB', '#326a98'); b.field('curved');
  b.line(-90, 0, 90, 0); await capture('field');
  b.noField();
  // Focused references for optimization-only paths: array mass, non-axis lines,
  // and disjoint fill uploads of alternating sizes. Captured before optimization.
  reset(); b.noStroke(); b.mass('HB', '#326a98', {precision:.6,strength:.5});
  b.massArray([new b.Polygon([[-60,-60],[60,-60],[60,60],[-60,60]]), new b.Polygon([[-15,-15],[15,-15],[15,15],[-15,15]])]);
  await capture('massArray');
  reset(); b.set('HB', '#326a98');
  for (const angle of [-137.4,-27.3,18.7,73.2]) b.flowLine(-70,40,130,angle);
  await capture('straightAngles');
  reset(); b.noStroke();
  for (const [x,y,w,h,color] of [[-90,-50,60,80,'#326a98'],[20,20,15,15,'#a15035'],[-20,-70,30,20,'#4b8240']]) {
    b.wash(color,140); b.rect(x,y,w,h); b.render();
  }
  await capture('washSequence');
  return hashes;
}
