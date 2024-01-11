// rollup.config.js

import terser from '@rollup/plugin-terser';
import cleanup from 'rollup-plugin-cleanup';

const config = {
    input: 'src/index.js',
    output: {
      file: 'dist/p5.brush.js',
      format: 'umd',
      name: 'brush',
    },
    plugins: [terser(), cleanup({
        comments: "none",
    })],
  };
  
  export default config;