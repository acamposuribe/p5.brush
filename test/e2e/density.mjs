// ============================================================
// p5.brush density-invariance measurement
//
// For every built-in brush, draws one seeded horizontal line at several
// pixel densities and reports, per density:
//   - points     — circles submitted as gl.POINTS
//   - diameter   — intended device-px point diameter (p10 / median / p90)
//   - subpixel   — fraction of points with intended diameter below 1 device px
//   - darkness   — sum((255 − R) / 255) over white, divided by density²
//   - width      — logical-px width where the averaged vertical darkness
//                  profile is at least half its peak
//
// See docs/rendering-model-audit.md §3.1 and docs/rendering-plan.md step 1.
// Measurement only: this script makes no pass/fail assertions yet.
//
// Run: npm run build && node test/e2e/density.mjs [--out=<file>] [--angle=…]
// ============================================================

import {
  parseArgs, startServer, launchBrowser, newPage, collectMetadata,
  writeResults, quantile, round,
} from "./harness.mjs";

const DENSITIES = [1, 2, 3];
const CANVAS = [400, 120];
const LINE = [-180, 0, 180, 0];
const WEIGHT = 1;

async function measure(page, brushName, density) {
  return page.evaluate(({ brushName, density, CANVAS, LINE, WEIGHT }) => {
    const { brush } = window;
    const canvas = brush.createCanvas(CANVAS[0], CANVAS[1], { pixelDensity: density });
    brush.seed(1);
    brush.noiseSeed(1);
    window.__gl.reset();
    brush.set(brushName, "#000", WEIGHT);
    brush.line(...LINE);
    brush.render();

    const read = document.createElement("canvas");
    read.width = canvas.width;
    read.height = canvas.height;
    const ctx = read.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, read.width, read.height);
    ctx.drawImage(canvas, 0, 0);
    const { data } = ctx.getImageData(0, 0, read.width, read.height);

    // Integrated darkness, plus a vertical profile over the middle of the
    // line (away from the end caps) for a width estimate.
    const W = read.width, H = read.height;
    const x0 = Math.round(W * 0.2), x1 = Math.round(W * 0.8);
    const profile = new Float64Array(H);
    let darkness = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const v = (255 - data[(y * W + x) * 4]) / 255;
        darkness += v;
        if (x >= x0 && x < x1) profile[y] += v;
      }
    }
    let peak = 0;
    for (let y = 0; y < H; y++) peak = Math.max(peak, profile[y]);
    let rows = 0;
    if (peak > 0) for (let y = 0; y < H; y++) if (profile[y] >= peak / 2) rows++;

    const d = window.__gl.diameters.slice().sort((a, b) => a - b);
    canvas.remove();
    return {
      points: window.__gl.pointCount,
      pointDraws: window.__gl.pointDraws,
      diameters: d,
      darkness: darkness / (density * density),
      width: rows / density,
    };
  }, { brushName, density, CANVAS, LINE, WEIGHT });
}

const opts = parseArgs();
const server = await startServer();
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await launchBrowser(opts);
let exitCode = 0;

try {
  const probe = await newPage(browser, baseUrl);
  const meta = await collectMetadata(browser, probe, opts);
  const brushes = await probe.evaluate(() => window.brush.box());
  await probe.close();

  console.log(`p5.brush ${meta.version} @ ${meta.commit?.slice(0, 7)}${meta.libraryDirty ? " (dirty)" : ""}`);
  console.log(`${meta.browser} · ${meta.gpu?.renderer} · point size ${JSON.stringify(meta.gpu?.pointSizeRange)}\n`);

  const results = [];
  for (const name of brushes) {
    const row = { brush: name, densities: {} };
    for (const density of DENSITIES) {
      // A fresh page per measurement keeps module-level brush state isolated.
      const page = await newPage(browser, baseUrl);
      try {
        const m = await measure(page, name, density);
        if (page.harnessErrors.length) throw new Error(page.harnessErrors.join("\n"));
        const d = m.diameters;
        row.densities[density] = {
          points: m.points,
          pointDraws: m.pointDraws,
          diameterP10: round(quantile(d, 0.1)),
          diameterMedian: round(quantile(d, 0.5)),
          diameterP90: round(quantile(d, 0.9)),
          subpixelFraction: d.length ? round(d.filter((x) => x < 1).length / d.length) : null,
          darkness: round(m.darkness, 1),
          width: round(m.width, 2),
        };
      } finally {
        await page.close();
      }
    }
    const d1 = row.densities[1].darkness;
    row.darknessRatio = Object.fromEntries(
      DENSITIES.slice(1).map((k) => [`d1/d${k}`, round(d1 / row.densities[k].darkness, 2)]),
    );
    results.push(row);
  }

  const table = results.flatMap((r) => DENSITIES.map((k) => {
    const v = r.densities[k];
    return {
      brush: k === 1 ? r.brush : "",
      density: k,
      points: v.points,
      "diam p10/med/p90": `${v.diameterP10} / ${v.diameterMedian} / ${v.diameterP90}`,
      "<1px": v.subpixelFraction,
      darkness: v.darkness,
      width: v.width,
      "d1/dk": k === 1 ? "" : r.darknessRatio[`d1/d${k}`],
    };
  }));
  console.table(table);

  await writeResults(opts.out, {
    meta,
    setup: { canvas: CANVAS, line: LINE, weight: WEIGHT, seed: 1, noiseSeed: 1, densities: DENSITIES },
    results,
  });
} catch (err) {
  console.error(err);
  exitCode = 1;
} finally {
  await browser.close();
  server.close();
}

process.exit(exitCode);
