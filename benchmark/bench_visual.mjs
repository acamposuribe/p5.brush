#!/usr/bin/env node
// Playwright-based visual benchmark for p5.brush
// Runs bench_visual.html in headless Chromium with real WebGL, captures METRIC lines.

import { chromium } from 'playwright-chromium';
import { fileURLToPath } from 'url';
import path from 'path';
import http from 'http';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir   = path.resolve(__dirname, '..');

// Minimal static file server — serves the project root so relative imports work
function startServer() {
  const mimeTypes = {
    '.html': 'text/html',
    '.js':   'application/javascript',
    '.mjs':  'application/javascript',
    '.map':  'application/json',
    '.json': 'application/json',
  };
  const server = http.createServer((req, res) => {
    const filePath = path.join(rootDir, req.url.split('?')[0]);
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      const ext  = path.extname(filePath);
      const mime = mimeTypes[ext] ?? 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      res.end(data);
    });
  });
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

const { server, port } = await startServer();
const benchUrl = `http://127.0.0.1:${port}/benchmark/bench_visual.html`;

const browser = await chromium.launch({
  headless: true,
  args: [
    '--enable-webgl',
    '--use-gl=angle',
    '--disable-gpu-sandbox',
    '--no-sandbox',
  ],
});

const page = await browser.newPage();

// Relay console output → stdout so autoresearch.sh can grep METRIC lines
page.on('console', msg => {
  const text = msg.text();
  if (msg.type() === 'error') {
    process.stderr.write(`[bench_visual] ${text}\n`);
  } else {
    // Pass METRIC lines straight through; suppress noise from the brush lib
    if (text.startsWith('METRIC ')) {
      process.stdout.write(text + '\n');
    }
  }
});

page.on('pageerror', err => {
  process.stderr.write(`[bench_visual] page error: ${err.message}\n`);
});

await page.goto(benchUrl, { waitUntil: 'domcontentloaded' });

// Wait up to 120s for the benchmark to finish (mass pass is slow per iteration)
try {
  await page.waitForFunction(
    () => window.__benchDone !== undefined || window.__benchError !== undefined,
    { timeout: 120_000 },
  );
} catch {
  process.stderr.write('[bench_visual] timed out waiting for benchmark\n');
  await browser.close();
  server.close();
  process.exit(1);
}

const error = await page.evaluate(() => window.__benchError);
if (error) {
  process.stderr.write(`[bench_visual] benchmark failed: ${error}\n`);
  await browser.close();
  server.close();
  process.exit(1);
}

await browser.close();
server.close();
