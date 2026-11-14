// p5 build: brush work drawn into an offscreen target must land in that target.
//
// Strokes, hatches and washes are queued and composited at the next flush. Switching
// targets with brush.load(), or ending a framebuffer scope, must flush that queue into
// the target being left; otherwise it is composited into the next target (usually the
// main canvas). Watercolour fills composite immediately, so each scene here avoids
// fills: a trailing fill would flush the queue and hide the bug.
//
// Run: node test/e2e/offscreen.mjs  (requires npm run build first)
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright-chromium';

const root = resolve('.');
const server = createServer(async (req, res) => {
  try {
    const path = resolve(root, '.' + req.url.split('?')[0]);
    if (!path.startsWith(root + '/')) throw Error('outside root');
    const data = await readFile(path);
    // p5.min.js contains non-ASCII regular expressions: the charset matters.
    res.setHeader('Content-Type', extname(path) === '.js' ? 'application/javascript; charset=utf-8' : 'text/html; charset=utf-8');
    res.end(data);
  } catch { res.statusCode = 404; res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));

// Each scene draws into `target` (a p5.Graphics or a p5.Framebuffer) using the documented
// targeting pattern for that kind, then shows it on the left half of a white main canvas.
const SCENES = {
  'graphics: stroke only': ['graphics', `brush.set('marker', '#174d71', 1); brush.line(-70, -70, 70, 70);`],
  'graphics: wash only': ['graphics', `brush.noStroke(); brush.wash('#bc4749', 255); brush.rect(-60, -40, 120, 80); brush.noWash();`],
  'graphics: hatch only': ['graphics', `brush.set('pen', '#222', 1); brush.hatch(6, 0.8); brush.rect(-60, -60, 120, 120); brush.noHatch();`],
  'framebuffer: stroke only': ['framebuffer', `brush.set('marker', '#174d71', 1); brush.line(-70, -70, 70, 70);`],
  'framebuffer: wash only': ['framebuffer', `brush.noStroke(); brush.wash('#bc4749', 255); brush.rect(-60, -40, 120, 80); brush.noWash();`],
};

function page(kind, paint) {
  const draw = kind === 'graphics'
    ? `brush.load(target); target.background(255); ${paint} brush.load();`
    : `target.draw(() => { background(255); brush.load(target); ${paint} }); brush.load();`;
  return `<!doctype html><html><body>
<script src="/node_modules/p5/lib/p5.min.js"></script>
<script src="/dist/p5.brush.js"></script>
<script>
let target;
function setup() {
  createCanvas(400, 200, WEBGL);
  pixelDensity(1);
  brush.scaleBrushes(1.5);
  target = ${kind === 'graphics' ? 'createGraphics(180, 180, WEBGL)' : 'createFramebuffer({ width: 180, height: 180, density: 1 })'};
  ${kind === 'graphics' ? 'target.pixelDensity(1);' : ''}
  noLoop();
}
function draw() {
  randomSeed(1); noiseSeed(1);
  ${draw}
  background(255);
  translate(-width / 2, -height / 2);
  image(target, 10, 10);
  window.__done = true;
}
</script></body></html>`;
}

const browser = await chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
const watchdog = setTimeout(() => { console.error('Offscreen regressions exceeded 60 seconds'); process.exit(1); }, 60_000);
let failed = 0;
try {
  for (const [name, [kind, paint]] of Object.entries(SCENES)) {
    const p = await browser.newPage();
    const errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.route('**/__offscreen.html', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: page(kind, paint) }));
    await p.goto(`http://127.0.0.1:${server.address().port}/__offscreen.html`);
    await p.waitForFunction(() => window.__done === true);
    // Let p5's post-draw hook flush, then count inked pixels in each half of the main canvas.
    await p.evaluate(() => new Promise(r => requestAnimationFrame(() => r())));
    const { left, right } = await p.evaluate(() => {
      const c = document.querySelector('canvas');
      const copy = document.createElement('canvas');
      copy.width = c.width; copy.height = c.height;
      const ctx = copy.getContext('2d');
      ctx.drawImage(c, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let left = 0, right = 0;
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        if (765 - d[i] - d[i + 1] - d[i + 2] > 60) x < c.width / 2 ? left++ : right++;
      }
      return { left, right };
    });
    try {
      assert.deepEqual(errors, []);
      assert.ok(left > 200, `expected ink inside the ${kind} (left half), found ${left} px`);
      assert.equal(right, 0, `brush work leaked onto the main canvas (right half): ${right} px`);
      console.log(`PASS ${name}`);
    } catch (e) {
      failed++;
      console.log(`FAIL ${name}: ${e.message.split('\n')[0]}`);
    }
    await p.close();
  }
} finally {
  clearTimeout(watchdog);
  await browser.close();
  server.close();
}
if (failed) process.exit(1);
