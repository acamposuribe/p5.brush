// ============================================================
// p5.brush fill contact sheet
//
// Renders a seeded grid of fills for side-by-side review
// (docs/rendering.md). Not a pixel test: fill changes alter
// pixels by design, so compare sheets by eye.
//
//   rows 1–4  bleed 0.05 / 0.2 / 0.4 / 0.7; columns sweep texture and border
//   row 5     shapes (rect, triangle, concave polygon), an angled bleed,
//             overlapping glazes, and a wash
//
// Run: npm run build && node test/e2e/fill-sheet.mjs [--density=2]
//        [--out=workspace/fill-sheet.png] [--angle=…]
// ============================================================

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { REPO_ROOT, startServer, launchBrowser, newPage } from "./harness.mjs";

const argv = process.argv.slice(2);
const take = (name, fallback) => {
  const i = argv.findIndex((a) => a.startsWith(`--${name}=`));
  if (i < 0) return fallback;
  return argv.splice(i, 1)[0].slice(name.length + 3);
};
const density = Number(take("density", 2));
const out = take("out", `workspace/fill-sheet-d${density}.png`);
const angle = take("angle", "swiftshader");
if (argv.length) throw new Error(`Unknown arguments: ${argv.join(" ")}`);

const COLS = 6;
const ROWS = 5;
const CELL = 200;
const [W, H] = [COLS * CELL, ROWS * CELL];

const server = await startServer();
const browser = await launchBrowser({ angle, headed: false });
let exitCode = 0;

try {
  const page = await newPage(browser, `http://127.0.0.1:${server.address().port}`);
  const png = await page.evaluate(({ W, H, density, COLS, ROWS, CELL }) => {
    const { brush } = window;
    const canvas = brush.createCanvas(W, H, { pixelDensity: density });
    brush.seed(1);
    brush.noiseSeed(1);
    brush.noStroke();

    const cx = (c) => -W / 2 + CELL * (c + 0.5);
    const cy = (r) => -H / 2 + CELL * (r + 0.5);
    const colors = ["#2a6fb0", "#c0392b", "#d9a400", "#2e7d4f", "#333333", "#7b3fa0"];
    const textures = [[0, 0], [0.2, 0.2], [0.4, 0.4], [0.6, 0.4], [0.8, 0.6], [1, 1]];
    const bleeds = [0.05, 0.2, 0.4, 0.7];

    bleeds.forEach((bleed, r) => {
      textures.forEach(([tex, border], c) => {
        brush.fill(colors[c], 150);
        brush.fillBleed(bleed);
        brush.fillTexture(tex, border);
        brush.circle(cx(c), cy(r), CELL * 0.3);
      });
    });

    const r = ROWS - 1;
    brush.fill("#2a6fb0", 150);
    brush.fillBleed(0.3);
    brush.fillTexture(0.5, 0.4);
    brush.rect(cx(0) - 60, cy(r) - 45, 120, 90);
    brush.fill("#c0392b", 150);
    brush.polygon([[cx(1), cy(r) - 65], [cx(1) + 65, cy(r) + 50], [cx(1) - 65, cy(r) + 50]]);
    brush.fill("#2e7d4f", 150);
    brush.polygon([
      [cx(2) - 65, cy(r) - 60], [cx(2) + 65, cy(r) - 60], [cx(2) + 65, cy(r) + 60],
      [cx(2) + 15, cy(r) + 60], [cx(2) + 15, cy(r) - 10], [cx(2) - 15, cy(r) - 10],
      [cx(2) - 15, cy(r) + 60], [cx(2) - 65, cy(r) + 60],
    ]);
    brush.fill("#d9a400", 150);
    brush.fillBleed(0.4, "out", 90);
    brush.circle(cx(3), cy(r), CELL * 0.3);
    brush.fillBleed(0.3);
    brush.fill("#2a6fb0", 130);
    brush.circle(cx(4) - 22, cy(r), CELL * 0.22);
    brush.fill("#c0392b", 130);
    brush.circle(cx(4) + 22, cy(r), CELL * 0.22);
    brush.noFill();
    brush.wash("#7b3fa0", 90);
    brush.circle(cx(5), cy(r), CELL * 0.3);
    brush.noWash();
    brush.render();

    // Device pixels, not a CSS-size screenshot, so density detail survives.
    const gl = canvas.getContext("webgl2");
    const [w, h] = [gl.drawingBufferWidth, gl.drawingBufferHeight];
    const pixels = new Uint8ClampedArray(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    const flipped = new Uint8ClampedArray(pixels.length);
    for (let y = 0; y < h; y++) {
      flipped.set(pixels.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    }
    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    // Flatten onto white paper, as fills are seen in practice.
    const layer = document.createElement("canvas");
    layer.width = w;
    layer.height = h;
    layer.getContext("2d").putImageData(new ImageData(flipped, w, h), 0, 0);
    const ctx = out.getContext("2d");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(layer, 0, 0);
    return out.toDataURL("image/png");
  }, { W, H, density, COLS, ROWS, CELL });
  if (page.harnessErrors.length) throw new Error(page.harnessErrors.join("\n"));

  const path = resolve(REPO_ROOT, out);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, Buffer.from(png.split(",")[1], "base64"));
  console.log(`Wrote ${out}`);
} catch (err) {
  console.error(err);
  exitCode = 1;
} finally {
  await browser.close();
  server.close();
}

process.exit(exitCode);
