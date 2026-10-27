// Serves the repo root for the visual test pages. Run: npm run build && npm run serve
import { startServer } from "./e2e/harness.mjs";

const port = Number(process.env.PORT ?? 8123);
await startServer(port);
console.log(`Open http://127.0.0.1:${port}/test/index.html`);
