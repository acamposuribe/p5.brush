const path = require("path")

module.exports = [
  {
    entry: path.resolve(__dirname, "src/index.js"),
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "p5.brush.js",
      library: "$",
      libraryTarget: "umd",
    },
    mode: "development",
    devtool: false,
    optimization: {
      usedExports: true,
    }
  },
  {
    entry: path.resolve(__dirname, "src/standalone.js"),
    output: {
      path: path.resolve(__dirname, "lib"),
      filename: "p5.brush.min.js",
      library: "$",
      libraryTarget: "umd",
    },
    mode: "production",
    optimization: {
      usedExports: true,
    }
  }
]
