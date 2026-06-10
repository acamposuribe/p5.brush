// ============================================================
// p5.brush Playwright Smoke Test
//
// Loads both visual suites in headless Chromium and asserts:
//   - No uncaught page errors
//   - No unexpected console.error output
//   - A canvas exists (p5 suite)
//   - A WebGL/WebGL2 context is active (standalone suite)
//
// Run: node test/e2e/smoke.mjs  (requires npm run build first)
// ============================================================

import { chromium } from "playwright-chromium";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// ALLOWED_CONSOLE_ERRORS
//
// The visual suites call console.error only when an error-message test
// *fails to throw*. On a correctly-built library, all error tests throw and
// no console.error is produced. This array is intentionally left empty.
// If you see entries appear here, it means a library regression caused an
// expected error to stop being thrown — that is a real failure to fix.
// ---------------------------------------------------------------------------
const ALLOWED_CONSOLE_ERRORS = [];

// ---------------------------------------------------------------------------
// Minimal static file server (serves repo root)
// ---------------------------------------------------------------------------

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), "../../..");

const MIME = {
  ".html": "text/html",
  ".js":   "application/javascript",
  ".mjs":  "application/javascript",
  ".json": "application/json",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".css":  "text/css",
  ".svg":  "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function startServer() {
  return new Promise((res, rej) => {
    const server = createServer(async (req, resp) => {
      const urlPath = req.url.split("?")[0];
      const filePath = join(REPO_ROOT, urlPath);
      try {
        const data = await readFile(filePath);
        const mime = MIME[extname(filePath)] || "application/octet-stream";
        resp.writeHead(200, { "Content-Type": mime });
        resp.end(data);
      } catch {
        resp.writeHead(404);
        resp.end("Not found");
      }
    });
    server.listen(0, "127.0.0.1", () => {
      res(server);
    });
    server.on("error", rej);
  });
}

// ---------------------------------------------------------------------------
// Smoke runner
// ---------------------------------------------------------------------------

const PAGES = [
  {
    name: "p5 adapter",
    path: "test/p5/visual_suite.html",
    checkWebGL: false,
  },
  {
    name: "standalone WebGL2",
    path: "test/standalone/visual_suite.html",
    checkWebGL: true,
  },
];

async function runSuite(page, { name, path, checkWebGL }, baseUrl) {
  const url = `${baseUrl}/${path}`;
  const pageErrors = [];
  const consoleErrors = [];

  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      const allowed = ALLOWED_CONSOLE_ERRORS.some((rx) => rx.test(text));
      if (!allowed) {
        consoleErrors.push(text);
      }
    }
  });

  await page.goto(url, { waitUntil: "load", timeout: 60_000 });

  // Wait for canvas to appear
  await page.waitForSelector("canvas", { timeout: 30_000 });

  // Let the suite draw for a few seconds
  await page.waitForTimeout(5_000);

  const failures = [];

  if (pageErrors.length > 0) {
    failures.push(`Uncaught page errors:\n${pageErrors.map((e) => `  ${e}`).join("\n")}`);
  }

  if (consoleErrors.length > 0) {
    failures.push(`Unexpected console.error messages:\n${consoleErrors.map((e) => `  ${e}`).join("\n")}`);
  }

  if (checkWebGL) {
    // The standalone page has two canvases: the WebGL brush canvas (#brush-canvas)
    // and a 2D label overlay (#label-canvas). We check ALL canvases and pass if
    // any one has a webgl2 or webgl context. (getContext returns null if the
    // canvas already has a different context type, so we try both types on
    // each canvas element.)
    const hasWebGL = await page.evaluate(() => {
      const canvases = Array.from(document.querySelectorAll("canvas"));
      return canvases.some((c) => {
        try {
          return !!(c.getContext("webgl2") || c.getContext("webgl"));
        } catch {
          return false;
        }
      });
    });
    if (!hasWebGL) {
      failures.push("No WebGL/WebGL2 context found on any canvas element.");
    }
  } else {
    // For the p5 suite, just assert a canvas exists with non-zero dimensions
    const canvasOk = await page.evaluate(() => {
      const c = document.querySelector("canvas");
      return c !== null && c.width > 0;
    });
    if (!canvasOk) {
      failures.push("No canvas with non-zero width found.");
    }
  }

  return failures;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let server = null;
let browser = null;
let exitCode = 0;

try {
  server = await startServer();
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  browser = await chromium.launch({
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });

  for (const suite of PAGES) {
    const page = await browser.newPage();
    try {
      const failures = await runSuite(page, suite, baseUrl);
      if (failures.length === 0) {
        console.log(`PASS  ${suite.name}  (${suite.path})`);
      } else {
        console.error(`FAIL  ${suite.name}  (${suite.path})`);
        for (const f of failures) {
          console.error(`  ${f}`);
        }
        exitCode = 1;
      }
    } finally {
      await page.close();
    }
  }
} finally {
  if (browser) await browser.close();
  if (server) server.close();
}

process.exit(exitCode);
