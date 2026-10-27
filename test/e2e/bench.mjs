// ============================================================
// p5.brush workload benchmark
//
// Runs the lines, hatch, mass, and fill workloads from
// docs/rendering.md, each on its own page.
// Per workload: WARMUP unmeasured runs, then RUNS measured runs, each
// ending with brush.render() and a synchronous 1×1 readPixels(). Reports
// median and p90 for two intervals, plus WebGL call counts from the final
// measured run:
//   - cpu   — drawing calls through brush.render() returning. WebGL is
//             asynchronous, so this is mostly JavaScript and driver submission.
//   - total — cpu plus the readPixels() wait, which blocks until queued GPU
//             work completes. total − cpu approximates GPU time.
//
// Under the default SwiftShader backend these are software-renderer
// diagnostics, not hardware GPU timings. Pass a hardware backend
// (for example --angle=metal on macOS); see docs/rendering.md.
//
// Run: npm run build && node test/e2e/bench.mjs [--out=<file>] [--angle=…]
// ============================================================

import {
  parseArgs, startServer, launchBrowser, newPage, collectMetadata,
  writeResults, quantile, round,
} from "./harness.mjs";

const CANVAS = [512, 512];
const DENSITY = 1;
const WARMUP = 2;
const RUNS = 10;

// Workload bodies run inside the page, with `brush` in scope. A workload is
// either a body string (drawn on CANVAS at DENSITY) or { canvas, density, body }.
const WORKLOADS = {
  lines: `
    brush.set("2B", "#222", 1);
    for (let i = 0; i < 100; i++) brush.line(-200, -200 + i * 4, 200, -200 + i * 4);
  `,
  hatch: `
    brush.set("HB", "#222", 1);
    brush.hatch(3, 45);
    brush.rect(-200, -200, 400, 400);
    brush.noHatch();
  `,
  mass: `
    brush.noStroke();
    brush.mass("HB", "#222");
    brush.rect(-150, -150, 300, 300);
    brush.noMass();
  `,
  fill: `
    brush.noStroke();
    brush.fill("#2a6fb0", 150);
    brush.fillBleed(0.3);
    brush.fillTexture(0.6, 0.4);
    brush.rect(-150, -150, 300, 300);
    brush.noFill();
  `,
  // Fills: large, many-small, wash, and high-bleed.
  fillLarge: { canvas: [1200, 1200], density: 2, body: `
    brush.noStroke();
    brush.fill("#2a6fb0", 150);
    brush.fillBleed(0.3);
    brush.fillTexture(0.6, 0.4);
    brush.circle(0, 0, 450);
    brush.noFill();
  ` },
  fillMany: { canvas: [1000, 1000], density: 2, body: `
    brush.noStroke();
    brush.fillBleed(0.25);
    brush.fillTexture(0.5, 0.4);
    const colors = ["#2a6fb0", "#d0402a", "#e8b030", "#3a9a50"];
    for (let i = 0; i < 40; i++) {
      brush.fill(colors[i % 4], 120);
      brush.circle(-400 + (i % 8) * 110, -350 + Math.floor(i / 8) * 150, 60);
    }
    brush.noFill();
  ` },
  wash: { canvas: [1200, 1200], density: 2, body: `
    brush.noStroke();
    for (let i = 0; i < 4; i++) {
      brush.wash(i % 2 ? "#2a6fb0" : "#b02a2a", 40);
      brush.circle(0, 0, 450);
    }
    brush.noWash();
  ` },
  fillHighBleed: { canvas: [1000, 1000], density: 2, body: `
    brush.noStroke();
    brush.fillBleed(0.6);
    brush.fillTexture(0.8, 0.6);
    const colors = ["#2a6fb0", "#d0402a", "#e8b030", "#3a9a50"];
    for (let i = 0; i < 8; i++) {
      brush.fill(colors[i % 4], 140);
      brush.rect(-400 + (i % 4) * 200, -300 + Math.floor(i / 4) * 300, 160, 240);
    }
    brush.noFill();
  ` },
};

// The density-2 fill workloads take seconds per run on SwiftShader, so they
// use fewer runs there.
const SOFTWARE_HEAVY = { warmup: 1, runs: 3 };

const workloadSpec = (w) =>
  typeof w === "string" ? { canvas: CANVAS, density: DENSITY, body: w } : w;

async function runWorkload(page, { canvas: CANVAS, density: DENSITY, body }, WARMUP, RUNS) {
  return page.evaluate(({ body, CANVAS, DENSITY, WARMUP, RUNS }) => {
    const { brush } = window;
    const draw = new Function("brush", body);
    const canvas = brush.createCanvas(CANVAS[0], CANVAS[1], { pixelDensity: DENSITY });
    const gl = canvas.getContext("webgl2");
    const pixel = new Uint8Array(4);
    window.__gl.capture = false;

    const cpu = [];
    const total = [];
    let counts = null;
    for (let i = 0; i < WARMUP + RUNS; i++) {
      brush.clear();
      brush.seed(1);
      brush.noiseSeed(1);
      window.__gl.reset();
      const t0 = performance.now();
      draw(brush);
      brush.render();
      const t1 = performance.now();
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
      const t2 = performance.now();
      if (i >= WARMUP) {
        cpu.push(t1 - t0);
        total.push(t2 - t0);
      }
      counts = { ...window.__gl.counts };
    }
    // The timed readPixels is harness work, not library work.
    counts.readPixels = (counts.readPixels ?? 1) - 1;
    return { cpu, total, counts, points: window.__gl.pointCount };
  }, { body, CANVAS, DENSITY, WARMUP, RUNS });
}

const opts = parseArgs();
const server = await startServer();
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await launchBrowser(opts);
let exitCode = 0;

try {
  const probe = await newPage(browser, baseUrl);
  const meta = await collectMetadata(browser, probe, opts);
  await probe.close();

  console.log(`p5.brush ${meta.version} @ ${meta.commit?.slice(0, 7)}${meta.libraryDirty ? " (dirty)" : ""}`);
  console.log(`${meta.browser} · ${meta.gpu?.renderer}\n`);

  const results = {};
  for (const [name, workload] of Object.entries(WORKLOADS)) {
    const page = await newPage(browser, baseUrl);
    try {
      const heavy = opts.angle === "swiftshader" && typeof workload !== "string";
      const { warmup, runs } = heavy ? SOFTWARE_HEAVY : { warmup: WARMUP, runs: RUNS };
      process.stdout.write(`${name} (${warmup}+${runs} runs)… `);
      const t0 = Date.now();
      const r = await runWorkload(page, workloadSpec(workload), warmup, runs);
      console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s`);
      if (page.harnessErrors.length) throw new Error(page.harnessErrors.join("\n"));
      const stats = (xs) => {
        const s = xs.slice().sort((a, b) => a - b);
        return {
          median: round(quantile(s, 0.5), 1),
          p90: round(quantile(s, 0.9), 1),
          min: round(s[0], 1),
          max: round(s[s.length - 1], 1),
        };
      };
      results[name] = {
        cpuMs: stats(r.cpu),
        totalMs: stats(r.total),
        points: r.points,
        counts: r.counts,
      };
    } finally {
      await page.close();
    }
  }

  console.table(Object.fromEntries(Object.entries(results).map(([k, v]) => [k, {
    "cpu med": v.cpuMs.median,
    "cpu p90": v.cpuMs.p90,
    "total med": v.totalMs.median,
    "total p90": v.totalMs.p90,
    points: v.points,
    bufferSubData: v.counts.bufferSubData ?? 0,
    bufferData: v.counts.bufferData ?? 0,
    drawArrays: v.counts.drawArrays ?? 0,
    instanced: v.counts.drawArraysInstanced ?? 0,
    texSubImage2D: v.counts.texSubImage2D ?? 0,
    blit: (v.counts.blitFramebuffer ?? 0) + (v.counts.copyTexSubImage2D ?? 0),
    getParameter: v.counts.getParameter ?? 0,
  }])));

  await writeResults(opts.out, {
    meta,
    setup: { canvas: CANVAS, density: DENSITY, warmup: WARMUP, runs: RUNS, heavyRuns: opts.angle === "swiftshader" ? SOFTWARE_HEAVY : null, seed: 1, noiseSeed: 1, workloads: Object.fromEntries(Object.entries(WORKLOADS).map(([k, w]) => [k, workloadSpec(w)])) },
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
