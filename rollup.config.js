// rollup.config.js

import terser from "@rollup/plugin-terser";
import cleanup from "rollup-plugin-cleanup";
import resolve from "@rollup/plugin-node-resolve";
import glslify from "rollup-plugin-glslify";

const config = {
  input: "src/index.js",
  output: [
    {
      file: "dist/p5.brush.js",
      format: "umd",
      name: "brush",
      sourcemap: true,
    },
    {
      file: "dist/p5.brush.esm.js",
      format: "esm",
      sourcemap: true,
    },
  ],
  plugins: [
    resolve({
      browser: true,
    }),
    glslify({
      include: ["**/*.frag", "**/*.vert"],
      compress: true,
      sourceMap: false,
    }),
    terser({
      module: true,
      compress: {
        keep_infinity: true,
        module: true,
        passes: 3,
        toplevel: true,
      },
    }),
    cleanup({
      comments: "none",
    }),
  ],
};

export default config;
