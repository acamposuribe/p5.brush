// EXPERIMENTAL (experiment/gpu-dots branch): serves the repo root so the
// comparison page can load dist-exp/. Run: npm run build:exp && node test/experiments/serve.mjs
import { startServer } from "../e2e/harness.mjs";

const port = Number(process.env.PORT ?? 8123);
await startServer(port);
console.log(`Open http://127.0.0.1:${port}/test/experiments/gpu-dots.html`);
