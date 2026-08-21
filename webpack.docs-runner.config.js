const path = require("path");

/**
 * Builds the docs-runner bundle: a standalone progressive-enhancement script
 * injected by the gateway into /readme/{id} pages. It scans the rendered
 * docs for lx_engine example blocks and mounts interactive run/edit panels
 * built from the live lx_client sources (sibling submodule).
 */
module.exports = {
  entry: "./js/docsRunner/index.tsx",
  devtool: "source-map",
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    alias: {
      "@": path.resolve(__dirname, "js"),
      lx_client: path.resolve(__dirname, "..", "lx_client"),
      // Pin React to this project's copy so lx_client sources and the runner
      // share a single React instance (duplicate copies break hooks/context).
      react: path.resolve(__dirname, "node_modules", "react"),
      "react-dom": path.resolve(__dirname, "node_modules", "react-dom"),
    },
  },
  experiments: {
    // The lx_engine WASM runtime is imported dynamically inside the engine
    // worker (lx_client/js/wasm/LxEngineWorker.js → pkg/index.js).
    asyncWebAssembly: true,
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: "ts-loader",
          options: { configFile: "tsconfig.docs-runner.json" },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
      {
        // lx_client's Image component requires SVGs inline (same loader it
        // uses in its own build).
        test: /\.svg$/,
        loader: "svg-inline-loader",
      },
    ],
  },
  plugins: [],
  output: {
    filename: "docs-runner.js",
    path: path.resolve(__dirname, "dist", "docs-runner"),
    publicPath: "/docs-runner/",
    clean: true,
  },
};
