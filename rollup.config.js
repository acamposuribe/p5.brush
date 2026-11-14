// rollup.config.js

import terser from "@rollup/plugin-terser";
import cleanup from "rollup-plugin-cleanup";
import resolve from "@rollup/plugin-node-resolve";
import glslify from "rollup-plugin-glslify";

const plugins = [
  resolve({
    browser: true,
  }),
  glslify({
    include: ["**/*.frag", "**/*.vert"],
    compress: true,
    sourceMap: false,
  }),
  cleanup({
    comments: "none",
  }),
];

// ESM and CJS outputs have their own module scope, so terser may treat top-level
// bindings as private. The UMD output is loaded as a classic <script>, where a
// top-level `var` is a global: minifying it with `module`/`toplevel` hoisted the
// wrapper's parameters into `var t,e;` and leaked them to every sketch.
const minifyModule = terser({
  module: true,
  compress: {
    keep_infinity: true,
    module: true,
    passes: 3,
    toplevel: true,
  },
});
const minifyScript = terser({
  compress: {
    keep_infinity: true,
    passes: 3,
  },
});

export default [
  {
    input: "src/index.p5.js",
    output: [
      {
        file: "dist/p5.brush.js",
        format: "umd",
        name: "brush",
        sourcemap: true,
        plugins: [minifyScript],
      },
      {
        file: "dist/p5.brush.cjs",
        format: "cjs",
        sourcemap: true,
        plugins: [minifyModule],
      },
      {
        file: "dist/p5.brush.esm.js",
        format: "esm",
        sourcemap: true,
        plugins: [minifyModule],
      },
    ],
    plugins,
  },
  {
    input: "src/index.standalone.js",
    output: [
      {
        file: "dist/brush.js",
        format: "umd",
        name: "brush",
        sourcemap: true,
        plugins: [minifyScript],
      },
      {
        file: "dist/brush.cjs",
        format: "cjs",
        sourcemap: true,
        plugins: [minifyModule],
      },
      {
        file: "dist/brush.esm.js",
        format: "esm",
        sourcemap: true,
        plugins: [minifyModule],
      },
    ],
    plugins,
  },
];
