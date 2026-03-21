import { chromium } from 'playwright-chromium';
import { fileURLToPath } from 'url';
import path from 'path';
import http from 'http';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir   = path.resolve(__dirname, '..');

function startServer() {
  const mimeTypes = { '.html':'text/html', '.js':'application/javascript', '.mjs':'application/javascript', '.map':'application/json', '.json':'application/json' };
  const server = http.createServer((req, res) => {
    const filePath = path.join(rootDir, req.url.split('?')[0]);
    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); res.end('Not found'); return; }
      res.writeHead(200, { 'Content-Type': mimeTypes[path.extname(filePath)] ?? 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port })));
}

const { server, port } = await startServer();
const browser = await chromium.launch({ headless: true, args: ['--enable-webgl','--use-gl=angle','--disable-gpu-sandbox','--no-sandbox'] });
const page = await browser.newPage();

page.on('console', msg => {
  const text = msg.text();
  if (msg.type() === 'error') process.stderr.write(`[profile] ${text}\n`);
  else if (!text.startsWith('METRIC')) process.stdout.write(text + '\n');
});

await page.goto(`http://127.0.0.1:${port}/benchmark/bench_mass_profile.html`, { waitUntil: 'domcontentloaded' });

try {
  await page.waitForFunction(() => window.__profileDone !== undefined, { timeout: 120_000 });
} catch {
  process.stderr.write('timed out\n');
  await browser.close(); server.close(); process.exit(1);
}

await browser.close();
server.close();
