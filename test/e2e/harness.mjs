// ============================================================
// p5.brush measurement harness helpers
//
// Shared by density.mjs and bench.mjs. Serves the repo root, launches
// headless Chromium, records run metadata, and installs WebGL
// instrumentation before any page script runs.
// ============================================================

import { chromium } from "playwright-chromium";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "../../..");
// BRUSH_BUNDLE overrides the bundle (e.g. dist-exp/brush.esm.js on the
// experiment/gpu-dots branch); BRUSH_GPU_DOTS=1 enables experimental GPU dots.
export const BUNDLE_PATH = process.env.BRUSH_BUNDLE ?? "dist/brush.esm.js";
const GPU_DOTS = process.env.BRUSH_GPU_DOTS === "1";
const GPU_SUBSTEPS = process.env.BRUSH_GPU_SUBSTEPS ? Number(process.env.BRUSH_GPU_SUBSTEPS) : undefined;

const MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".json": "application/json",
};

const BLANK_PAGE = "<!doctype html><html><body style=\"margin:0\"></body></html>";

// ---------------------------------------------------------------------------
// CLI options
//
//   --out=<file>     write JSON results to <file> (relative to repo root)
//   --angle=<name>   ANGLE backend passed to --use-angle: "swiftshader"
//                    (default, software), or a hardware backend such as
//                    "metal" (macOS), "d3d11" (Windows), "vulkan" or "gl".
//                    Headless Chromium has no hardware WebGL unless one
//                    is named explicitly.
//   --headed         run with a visible browser window
// ---------------------------------------------------------------------------

export function parseArgs(argv = process.argv.slice(2)) {
  const opts = { out: null, angle: "swiftshader", headed: false };
  for (const arg of argv) {
    if (arg.startsWith("--out=")) opts.out = arg.slice(6);
    else if (arg.startsWith("--angle=")) opts.angle = arg.slice(8);
    else if (arg === "--headed") opts.headed = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return opts;
}

export function startServer(port = 0) {
  return new Promise((res, rej) => {
    const server = createServer(async (req, resp) => {
      const urlPath = req.url.split("?")[0];
      if (urlPath === "/__blank") {
        resp.writeHead(200, { "Content-Type": "text/html" });
        resp.end(BLANK_PAGE);
        return;
      }
      const filePath = join(REPO_ROOT, urlPath);
      try {
        const data = await readFile(filePath);
        resp.writeHead(200, { "Content-Type": MIME[extname(filePath)] || "application/octet-stream" });
        resp.end(data);
      } catch {
        resp.writeHead(404);
        resp.end("Not found");
      }
    });
    server.listen(port, "127.0.0.1", () => res(server));
    server.on("error", rej);
  });
}

export function launchBrowser({ angle, headed }) {
  const args = [`--use-angle=${angle}`];
  if (angle === "swiftshader") args.push("--enable-unsafe-swiftshader");
  return chromium.launch({ headless: !headed, args });
}

// ---------------------------------------------------------------------------
// WebGL instrumentation (runs in the page before any other script)
//
// window.__gl.counts      — call counts per wrapped method
// window.__gl.points      — per POINTS draw: intended device-px diameters
//                           (read from the last uploaded circle buffer)
// window.__gl.reset()     — clear counts and captured points
// window.__gl.capture     — set false to skip diameter capture (benchmarks)
// ---------------------------------------------------------------------------

function installInstrumentation() {
  const proto = WebGL2RenderingContext.prototype;
  const state = {
    counts: {},
    diameters: [],
    pointDraws: 0,
    pointCount: 0,
    capture: true,
    lastUpload: null,
    reset() {
      this.counts = {};
      this.diameters = [];
      this.pointDraws = 0;
      this.pointCount = 0;
      this.lastUpload = null;
    },
  };
  window.__gl = state;

  const counted = [
    "bufferData", "bufferSubData", "drawArrays", "drawArraysInstanced",
    "drawElements", "texImage2D", "texSubImage2D", "copyTexSubImage2D",
    "blitFramebuffer", "getParameter", "readPixels", "useProgram",
    "bindFramebuffer",
  ];
  for (const name of counted) {
    const orig = proto[name];
    proto[name] = function (...args) {
      state.counts[name] = (state.counts[name] ?? 0) + 1;
      if ((name === "bufferData" || name === "bufferSubData") &&
          args[0] === this.ARRAY_BUFFER) {
        const data = name === "bufferData" ? args[1] : args[2];
        if (data instanceof Float32Array) state.lastUpload = data;
      }
      if (name === "drawArrays" && args[0] === this.POINTS) {
        const count = args[2];
        state.pointDraws++;
        state.pointCount += count;
        // Circle layout: x, y, radius (device px), alpha — 4 floats per point.
        if (state.capture && state.lastUpload) {
          const d = state.lastUpload;
          for (let i = 0; i < count; i++) state.diameters.push(d[i * 4 + 2] * 2);
        }
      }
      return orig.apply(this, args);
    };
  }
}

export async function newPage(browser, baseUrl) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.addInitScript(installInstrumentation);
  await page.goto(`${baseUrl}/__blank`);
  await page.evaluate(async ({ bundle, gpuDots, substeps }) => {
    window.brush = await import(`/${bundle}`);
    if (gpuDots) window.brush.experimentalGpuDots(true, substeps ? { substeps } : {});
  }, { bundle: BUNDLE_PATH, gpuDots: GPU_DOTS, substeps: GPU_SUBSTEPS });
  page.harnessErrors = errors;
  return page;
}

// ---------------------------------------------------------------------------
// Run metadata
// ---------------------------------------------------------------------------

async function readGpuInfo(page) {
  return page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    if (!gl) return null;
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      pointSizeRange: Array.from(gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)),
      timerQuery: !!gl.getExtension("EXT_disjoint_timer_query_webgl2"),
    };
  });
}

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

export async function collectMetadata(browser, page, opts) {
  const bundle = await readFile(join(REPO_ROOT, BUNDLE_PATH));
  const pkg = JSON.parse(await readFile(join(REPO_ROOT, "package.json"), "utf8"));
  // Only library inputs count as dirty; docs and harness edits do not affect output.
  const dirty = git("status --porcelain -- src dist rollup.config.js package.json");
  return {
    date: new Date().toISOString(),
    version: pkg.version,
    commit: git("rev-parse HEAD"),
    libraryDirty: dirty === null ? null : dirty.length > 0,
    bundle: BUNDLE_PATH,
    gpuDots: GPU_DOTS,
    gpuSubsteps: GPU_DOTS ? (GPU_SUBSTEPS ?? 10) : null,
    bundleSha256: createHash("sha256").update(bundle).digest("hex"),
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    browser: `chromium ${browser.version()}`,
    angle: opts.angle,
    gpu: await readGpuInfo(page),
  };
}

export async function writeResults(outPath, results) {
  if (!outPath) return;
  const full = resolve(REPO_ROOT, outPath);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, JSON.stringify(results, null, 2) + "\n");
  console.log(`\nWrote ${outPath}`);
}

export function quantile(sorted, q) {
  if (sorted.length === 0) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export const round = (x, digits = 3) =>
  x === null || x === undefined ? x : Number(x.toFixed(digits));
