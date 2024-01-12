// rollup.config.js

import terser from '@rollup/plugin-terser';
import cleanup from 'rollup-plugin-cleanup';
import resolve from '@rollup/plugin-node-resolve';

const config = {
    input: 'src/index.js',
    output: {
      file: 'dist/p5.brush.js',
      format: 'umd',
      name: 'brush',
    },
    plugins: [
      resolve({
        browser: true
      }), 
      terser(), 
      cleanup({
          comments: "none",
      })
    ],
  };
  
  export default config;