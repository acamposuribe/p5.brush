const path = require("path")

module.exports = {
  entry: path.resolve(__dirname, "src/index.js"),
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "p5.brush.js",
    library: "$",
    libraryTarget: "umd",
  },
  mode: "production",
  devtool: false,
  optimization: {
    usedExports: true,
  }
}