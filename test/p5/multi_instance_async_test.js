const suiteEl = document.getElementById("suite");
const pageStatusEl = document.getElementById("page-status");
const stealerHostEl = document.getElementById("stealer-host");
const BG = [247, 241, 231];
const WORKER_W = 180;
const WORKER_H = 120;
const SUITE_TIMEOUT_MS = 9000;
const STEALER_LIFETIME_MS = 80;

let activeRunId = 0;
let activeScenario = null;
let managedInstances = [];
let managedTimeouts = [];
let managedIntervals = [];

function setPageStatus(message, tone = "") {
  pageStatusEl.className = `status ${tone}`.trim();
  pageStatusEl.textContent = message;
}

function rememberTimeout(callback, delay) {
  const id = window.setTimeout(callback, delay);
  managedTimeouts.push(id);
  return id;
}

function rememberInterval(callback, delay) {
  const id = window.setInterval(callback, delay);
  managedIntervals.push(id);
  return id;
}

function cleanupRun() {
  for (const id of managedTimeouts) window.clearTimeout(id);
  for (const id of managedIntervals) window.clearInterval(id);
  managedTimeouts = [];
  managedIntervals = [];

  for (const instance of managedInstances) {
    try {
      instance.remove();
    } catch (_error) {}
  }
  managedInstances = [];

  suiteEl.innerHTML = "";
  stealerHostEl.innerHTML = "";
  activeScenario = null;
}

function colorDistance(sample, expected) {
  return Math.abs(sample[0] - expected[0]) +
    Math.abs(sample[1] - expected[1]) +
    Math.abs(sample[2] - expected[2]);
}

function makeScenarioShell(config) {
  const section = document.createElement("section");
  section.className = "panel scenario";

  const head = document.createElement("div");
  head.className = "scenario-head";

  const title = document.createElement("h2");
  title.textContent = config.label;
  head.appendChild(title);

  const description = document.createElement("p");
  description.textContent = config.description;
  head.appendChild(description);

  const meta = document.createElement("div");
  meta.className = "scenario-meta";
  meta.textContent = "Preparing scenario...";
  head.appendChild(meta);

  const grid = document.createElement("div");
  grid.className = "worker-grid";

  section.appendChild(head);
  section.appendChild(grid);
  suiteEl.appendChild(section);

  return { section, meta, grid };
}

function makeWorkerCard(label) {
  const card = document.createElement("article");
  card.className = "worker";

  const title = document.createElement("h3");
  title.textContent = label;
  card.appendChild(title);

  const subtitle = document.createElement("p");
  subtitle.textContent = "Waiting for setup...";
  card.appendChild(subtitle);

  const canvasShell = document.createElement("div");
  canvasShell.className = "canvas-shell";
  card.appendChild(canvasShell);

  const log = document.createElement("div");
  log.className = "log";
  log.textContent = "Queued";
  card.appendChild(log);

  return { card, subtitle, canvasShell, log };
}

function updateWorkerLog(worker, message, tone = "") {
  worker.dom.log.className = `log ${tone}`.trim();
  worker.dom.log.textContent = message;
}

function updateScenarioMeta(scenario) {
  const completed = scenario.completedPasses;
  const expected = scenario.expectedPasses;
  const failures = scenario.failures.length;
  scenario.dom.meta.textContent =
    `${completed}/${expected} passes complete • ${scenario.stealerCount} stealer sketches created • ${failures} failures`;
}

function releaseScenarioInstances(scenario) {
  for (const stealer of scenario.stealers) {
    try {
      stealer.noLoop?.();
    } catch (_error) {}
    try {
      stealer.remove?.();
    } catch (_error) {}
  }

  for (const worker of scenario.workers) {
    try {
      worker.instance?.noLoop?.();
    } catch (_error) {}
    try {
      worker.instance?.remove?.();
    } catch (_error) {}
    worker.dom.canvasShell.innerHTML = "";
  }
}

function finalizeScenario(scenario) {
  if (scenario.finalized) return;
  scenario.finalized = true;

  if (scenario.timeoutId) window.clearTimeout(scenario.timeoutId);

  if (scenario.failures.length) {
    scenario.dom.meta.textContent =
      `Failed after ${scenario.completedPasses}/${scenario.expectedPasses} passes. ${scenario.failures[0]}`;
  } else {
    scenario.dom.meta.textContent =
      `Completed ${scenario.expectedPasses}/${scenario.expectedPasses} passes with ${scenario.stealerCount} stealer sketches and no detected misrouting.`;
  }

  scenario.resolve({
    label: scenario.label,
    failures: [...scenario.failures],
    completedPasses: scenario.completedPasses,
    expectedPasses: scenario.expectedPasses,
    dispose: () => releaseScenarioInstances(scenario),
  });
}

function failScenario(scenario, message) {
  scenario.failures.push(message);
  updateScenarioMeta(scenario);
  rememberTimeout(() => finalizeScenario(scenario), 120);
}

function maybeCompleteScenario(scenario) {
  if (scenario.finalized || scenario.failures.length) return;
  if (scenario.completedPasses >= scenario.expectedPasses) {
    finalizeScenario(scenario);
  }
}

function sampleBrushPixels(p, points) {
  let maxDistance = 0;

  for (const [x, y] of points) {
    const sample = p.get(Math.round(x), Math.round(y));
    maxDistance = Math.max(maxDistance, colorDistance(sample, BG));
  }

  return maxDistance;
}

function spawnStealer(runId, scenario, worker) {
  if (runId !== activeRunId || scenario.finalized) return null;

  const stealerIndex = scenario.stealerCount + 1;
  const host = document.createElement("div");
  stealerHostEl.appendChild(host);

  const sketch = (p) => {
    brush.instance(p);

    p.setup = () => {
      const canvas = p.createCanvas(8, 8, p.WEBGL);
      canvas.parent(host);
      p.background(0);
      p.noLoop();

      rememberTimeout(() => {
        try {
          p.remove();
        } catch (_error) {}
      }, STEALER_LIFETIME_MS);
    };
  };

  const stealer = new p5(sketch);
  scenario.stealers.push(stealer);
  managedInstances.push(stealer);
  scenario.stealerCount++;
  updateScenarioMeta(scenario);
  return stealerIndex;
}

function createWorker(runId, scenario, index) {
  const dom = makeWorkerCard("Worker");
  scenario.dom.grid.appendChild(dom.card);

  const worker = {
    index,
    dom,
    nextPass: 1,
    pendingSample: null,
    done: false,
  };

  const sketch = (p) => {
    brush.instance(p);

    p.setup = () => {
      try {
        const canvas = p.createCanvas(WORKER_W, WORKER_H, p.WEBGL);
        canvas.parent(dom.canvasShell);
        p.frameRate(30);
        dom.subtitle.textContent = scenario.rebind
          ? "Rebinds with brush.instance(p) before each pass."
          : "Only binds with brush.instance(p) in the sketch function.";
        updateWorkerLog(worker, "Running passes...", "warn");
      } catch (error) {
        updateWorkerLog(worker, `setup failed\n${error.message}`, "bad");
        failScenario(scenario, `Worker ${index + 1} setup failed: ${error.message}`);
        p.noLoop();
      }
    };

    p.draw = () => {
      if (
        runId !== activeRunId ||
        scenario.finalized ||
        worker.done ||
        scenario.failures.length
      ) {
        p.noLoop();
        return;
      }

      try {
        if (worker.pendingSample && p.frameCount >= worker.pendingSample.frame) {
          const distance = sampleBrushPixels(p, worker.pendingSample.points);
          if (distance < 36) {
            throw new Error("brush output did not appear on this worker canvas");
          }

          scenario.completedPasses++;
          if (scenario.completedPasses === 1) {
            window.reportP5FirstFrame?.("multi_instance_async_test");
          }
          worker.nextPass++;
          worker.pendingSample = null;
          updateWorkerLog(
            worker,
            `${worker.nextPass - 1}/${scenario.passCount} passes ok`,
            "ok",
          );

          if (worker.nextPass > scenario.passCount) {
            worker.done = true;
            dom.subtitle.textContent = "Finished without detected async startup errors.";
            p.noLoop();
          }

          updateScenarioMeta(scenario);
          maybeCompleteScenario(scenario);
          return;
        }

        if (worker.pendingSample || worker.nextPass > scenario.passCount) return;

        const firstFrame = 2;
        const frameGap = 8;
        const targetFrame = firstFrame + (worker.nextPass - 1) * frameGap;
        if (p.frameCount < targetFrame) return;

        const stealerId = spawnStealer(runId, scenario, worker);

        if (scenario.rebind) {
          brush.instance(p);
        }

        brush.load();
        brush.noField();
        brush.noHatch();
        brush.noFill();
        brush.noClip();

        const pass = worker.nextPass;
        const x1 = 18;
        const y1 = 18 + pass * 7;
        const x2 = WORKER_W - 18;
        const y2 = WORKER_H - 18 - pass * 5;
        const points = [0.3, 0.5, 0.7].map((t) => [
          x1 + (x2 - x1) * t,
          y1 + (y2 - y1) * t,
        ]);

        p.background(...BG);
        p.push();
        p.translate(-WORKER_W / 2, -WORKER_H / 2);
        brush.set("marker", scenario.color, 3.1);
        brush.line(x1, y1, x2, y2);
        p.pop();

        worker.pendingSample = {
          frame: p.frameCount + 1,
          points,
        };

        updateWorkerLog(
          worker,
          `Checking pass ${pass}/${scenario.passCount} after stealer ${stealerId}...`,
          "warn",
        );
      } catch (error) {
        updateWorkerLog(worker, `render failed\n${error.message}`, "bad");
        failScenario(scenario, `Worker ${index + 1} failed: ${error.message}`);
        p.noLoop();
      }
    };
  };

  const instance = new p5(sketch);
  worker.instance = instance;
  managedInstances.push(instance);
  scenario.workers.push(worker);
}

function runScenario(runId, config, workerCount, passCount) {
  return new Promise((resolve) => {
    const totalPasses = workerCount * passCount;
    const dom = makeScenarioShell(config);
    const scenario = {
      ...config,
      dom,
      workers: [],
      stealers: [],
      stealerCount: 0,
      completedPasses: 0,
      expectedPasses: totalPasses,
      passCount: totalPasses,
      failures: [],
      finalized: false,
      resolve,
    };

    activeScenario = scenario;
    updateScenarioMeta(scenario);

    scenario.timeoutId = rememberTimeout(() => {
      failScenario(
        scenario,
        `Timed out after ${Math.round(SUITE_TIMEOUT_MS / 1000)} seconds`,
      );
    }, SUITE_TIMEOUT_MS);

    createWorker(runId, scenario, 0);
  });
}

async function runAsyncMultiInstanceSuite(workerCount = 6, passCount = 3) {
  cleanupRun();
  activeRunId++;
  const runId = activeRunId;

  setPageStatus(
    `Running 1 worker sketch per scenario with ${workerCount * passCount} total passes...`,
    "warn",
  );

  const scenarios = [
    {
      label: "Reported Pattern",
      description:
        "Matches the old issue report: each sketch calls brush.instance(p) once in the sketch function, then renders later while other instances are still being created.",
      rebind: false,
      color: "#184f72",
    },
    {
      label: "Setup Rebind Control",
      description:
        "Rebinds with brush.instance(p) before every render pass. If only the first scenario fails, the shared instance reference is still the likely culprit.",
      rebind: true,
      color: "#8c5530",
    },
  ];

  const results = [];
  for (const config of scenarios) {
    if (runId !== activeRunId) return;
    const result = await runScenario(runId, config, workerCount, passCount);
    results.push(result);
    result.dispose();
  }

  const failures = results.flatMap((result) =>
    result.failures.map((message) => `${result.label}: ${message}`),
  );

  if (failures.length) {
    setPageStatus(
      `Detected ${failures.length} failure(s).\n${failures.join("\n")}`,
      "bad",
    );
    return;
  }

  setPageStatus(
    `No async multi-instance failures detected across ${results.length} scenarios and ${results.reduce((sum, result) => sum + result.expectedPasses, 0)} checked passes.`,
    "ok",
  );
}

window.addEventListener("error", (event) => {
  if (!activeScenario || activeScenario.finalized) return;

  const message = event.error?.stack || event.message || "Unknown browser error";
  failScenario(activeScenario, `Browser error: ${message}`);
});

window.addEventListener("unhandledrejection", (event) => {
  if (!activeScenario || activeScenario.finalized) return;

  const reason =
    event.reason?.stack || event.reason?.message || String(event.reason);
  failScenario(activeScenario, `Unhandled rejection: ${reason}`);
});
