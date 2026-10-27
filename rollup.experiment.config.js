// EXPERIMENTAL build (experiment/gpu-dots branch): standalone ESM only, written
// to dist-exp/ so the published dist/ is never touched. Uses the production
// plugin chain so timings are comparable with dist/.
import config from "./rollup.config.js";

const standalone = config.find((c) => c.input === "src/index.standalone.js");

export default {
  ...standalone,
  output: { file: "dist-exp/brush.esm.js", format: "esm", sourcemap: true },
};
