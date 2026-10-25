const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

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
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  plugins: [new HtmlWebpackPlugin({ template: "index.html" })],
  devServer: {
    port: 8081,
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
