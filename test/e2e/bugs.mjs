// Deterministic bug regressions and unchanged-output checks, using local assets only.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright-chromium';
import { createRequire } from 'node:module';
import { seed, rr, rr2, randInt, randInt2 } from '../../src/core/utils.js';

// B24: compare against the same seeded uniform samples, not a flaky frequency test.
for (const [integer, uniform] of [[randInt, rr], [randInt2, rr2]]) {
  for (const [min, max] of [[-10, 10], [-30, -15], [0, 10], [2 ** 31, 2 ** 31 + 8]]) {
    seed('integer-regression');
    const expected = Array.from({length:256}, () => Math.floor(uniform(min, max)));
    seed('integer-regression');
    const actual = Array.from({length:256}, () => integer(min, max));
    assert.deepEqual(actual, expected, 'integer sampling must floor the unchanged RNG stream');
    assert.ok(actual.every(value => value >= min && value < max));
    assert.ok(actual.includes(min) && actual.includes(max - 1), 'both integer endpoints must be reachable');
  }
}
console.log('PASS B24 unbiased signed integer sampling on both RNG streams');

const root = resolve('.');
const server = createServer(async (req, res) => {
  try {
    const path = resolve(root, '.' + req.url.split('?')[0]);
    if (!path.startsWith(root + '/')) throw Error('outside root');
    const data = await readFile(path);
    res.setHeader('Content-Type', extname(path) === '.js' ? 'application/javascript' : 'text/html');
    res.end(data);
  } catch { res.statusCode = 404; res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const browser = await chromium.launch({args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']});
// Guard against a future regression reintroducing a synchronous infinite loop.
const watchdog = setTimeout(() => { console.error('Bug regressions exceeded 60 seconds'); process.exit(1); }, 60_000);
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/test/index.html`);
  const { hashes, watercolor } = await page.evaluate(async () => {
    const b = await import('/dist/brush.esm.js');
    const { compatibility } = await import('/test/e2e/compatibility.js');
    let watercolor;
    const hashes = await compatibility(b, (name, pixels) => {
      if (name === 'watercolor') watercolor = Array.from(pixels);
    });
    return { hashes, watercolor };
  });
  assert.deepEqual(hashes, JSON.parse(await readFile('test/e2e/legacy-output.json', 'utf8')).hashes, 'valid legacy rendering changed');
  // Even the original fill has tiny native raster/derivative variation at edges.
  // Compare pixels rather than loosening every other scene's exact fingerprint.
  const legacyFill = gunzipSync(await readFile('test/e2e/legacy-watercolor.rgba.gz'));
  let difference = 0, channels = 0;
  for (let i = 0; i < legacyFill.length; i++) {
    const delta = Math.abs(legacyFill[i] - watercolor[i]);
    difference += delta;
    if (delta) channels++;
  }
  assert.ok(difference <= 1024 && channels <= 256, `watercolor changed: ${difference} total / ${channels} channels`);
  console.log('PASS rendering compatibility (B24 field fingerprint intentionally updated)');
  {
    const results = await page.evaluate(async () => {
      const b = await import('/dist/brush.esm.js');
      const { regressions } = await import('/test/e2e/bug-cases.js');
      return regressions(b);
    });
    for (const result of results) {
      console.log(`${result.error ? 'FAIL' : 'PASS'} ${result.name}${result.error ? ': ' + result.error : ''}`);
    }
    assert.equal(results.filter(r => r.error).length, 0, 'bug regressions failed');
    const require = createRequire(import.meta.url);
    for (const name of ['p5.brush', 'p5.brush/standalone']) {
      assert.equal(typeof require(name).set, 'function', `${name} CommonJS API`);
    }
    console.log('PASS CommonJS package exports');
  }
  assert.deepEqual(errors, [], 'uncaught browser errors');
} finally {
  clearTimeout(watchdog);
  await browser.close();
  await new Promise(r => server.close(r));
}
