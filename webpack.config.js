const path = require("path");
const { realpathSync } = require("fs");
const HtmlWebpackPlugin = require("html-webpack-plugin");

// Resolve the installed lx_client source through its pnpm symlink so ts-loader
// can transpile the TypeScript modules the app deep-imports.
const lxClientSource = realpathSync(
  path.resolve(__dirname, "node_modules/lx_client/js"),
);

module.exports = {
  entry: "./js/index.tsx",
  devtool: "source-map",
  resolve: {
    extensions: [".tsx", ".ts", ".js"],
    alias: {
      "@": path.resolve(__dirname, "js"),
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: "ts-loader",
          options: { allowTsInNodeModules: true },
        },
        include: [path.resolve(__dirname, "js"), lxClientSource],
      },
    ],
  },
  plugins: [new HtmlWebpackPlugin({ template: "index.html" })],
  devServer: {
    port: 8081,
    // Deep-link reloads: the browser asks for /obolargus/portfolios, the
    // gateway strips /obolargus, and this fallback serves index.html so the
    // client router can resolve the path from the URL.
    historyApiFallback: true,
    client: {
      overlay: true,
      // Reach HMR through the gateway mount instead of the dev-server
      // port (8081 is not exposed externally). A port of 0 tells the
      // client to reuse the page's own host/port, so this resolves to
      // wss://<page-host>/obolargus/ws behind the gateway and
      // ws://localhost:8080/obolargus/ws locally. The gateway strips
      // the `/obolargus` prefix, forwarding to the dev server's `/ws`.
      webSocketURL: {
        port: 0,
        pathname: "/obolargus/ws",
      },
    },
    allowedHosts: ["liorplayground.mooo.com", "localhost", "127.0.0.1"],
    // The gateway strips the `/obolargus` mount prefix before forwarding,
    // so the dev server must serve assets from the root even though the
    // generated HTML references them under `/obolargus/` (see
    // `output.publicPath`). Keep these two paths deliberately different.
    devMiddleware: { publicPath: "/" },
  },
  output: {
    path: path.resolve(__dirname, "dist"),
    publicPath: "/obolargus/",
    clean: true,
  },
};
