const path = require("path");
const { realpathSync } = require("fs");
const { execSync } = require("child_process");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");
const { InjectManifest } = require("workbox-webpack-plugin");
const { generateThemeCss } = require("./scripts/theme-css");

// Resolve the installed lx_client source through its pnpm symlink so ts-loader
// can transpile the TypeScript modules the app deep-imports.
const lxClientSource = realpathSync(
  path.resolve(__dirname, "node_modules/lx_client/js"),
);

// react-router 7.18's export map points every condition at the development
// build. Production output can use the shipped production bundle directly.
const reactRouterDomDir = realpathSync(
  path.resolve(__dirname, "node_modules/react-router-dom"),
);
const reactRouterDir = path.resolve(reactRouterDomDir, "..", "react-router");

// The generated theme registry stores component CSS in JS strings. Emit it as
// a real stylesheet so the entrypoint only carries application code.
const themeCssPath = path.resolve(
  __dirname,
  "node_modules/.cache/obolargus-theme-registry.css",
);
const themeCss = generateThemeCss(
  path.resolve(__dirname, "../lx_client/js/generated/themeRegistry.ts"),
);
require("fs").mkdirSync(path.dirname(themeCssPath), { recursive: true });
require("fs").writeFileSync(themeCssPath, themeCss.css);

function normalizePath(value, fallback) {
  const raw = (value || fallback).trim();
  if (!raw || raw === "/") return "";
  const withLeading = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeading.replace(/\/+$/, "");
}

function readGitCommit() {
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: __dirname,
      stdio: ["ignore", "pipe", "ignore"],
    })
      .toString()
      .trim();
  } catch {
    return "local";
  }
}

module.exports = (env = {}, argv = {}) => {
  const mode = argv.mode || env.mode || "development";
  const isProduction = mode === "production";
  const basePath = normalizePath(
    process.env.OBOLARGUS_BASE_PATH || process.env.BASE_PATH,
    "/obolargus",
  );
  const apiBaseUrl = normalizePath(
    process.env.OBOLARGUS_API_BASE_URL || process.env.API_BASE_URL,
    `${basePath}/api`,
  );
  const packageVersion = require("./package.json").version;
  const buildId =
    process.env.OBOLARGUS_BUILD_ID ||
    `${packageVersion}-${readGitCommit()}`;

  const plugins = [
    new webpack.DefinePlugin({
      "process.env.BASE_PATH": JSON.stringify(basePath),
      "process.env.API_BASE_URL": JSON.stringify(apiBaseUrl),
      "process.env.OBOLARGUS_BUILD_ID": JSON.stringify(buildId),
      "process.env.NODE_ENV": JSON.stringify(mode),
    }),
    new HtmlWebpackPlugin({
      template: "index.html",
      templateParameters: { basePath },
    }),
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, "public"),
          to: path.resolve(__dirname, "dist"),
          noErrorOnMissing: true,
        },
        {
          from: themeCssPath,
          to: "theme-registry.css",
        },
        {
          from: path.resolve(lxClientSource, "..", "static", "cursor"),
          to: "cursor",
          noErrorOnMissing: true,
        },
      ],
    }),
  ];

  if (isProduction) {
    plugins.push(
      new InjectManifest({
        swSrc: path.resolve(__dirname, "js/service-worker/service-worker.ts"),
        swDest: "service-worker.js",
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        exclude: [
          /\.map$/,
          /\.LICENSE\.txt$/,
          /^docs-runner\//,
          /service-worker\.js$/,
        ],
      }),
    );
  }

  return {
    entry: "./js/index.tsx",
    devtool: "source-map",
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
      alias: {
        "@": path.resolve(__dirname, "js"),
        "react-router$": path.join(
          reactRouterDir,
          "dist/production/index.mjs",
        ),
        "react-router/dom$": path.join(
          reactRouterDir,
          "dist/production/dom-export.mjs",
        ),
        "material-symbols/outlined.css$": path.resolve(
          __dirname,
          "js/styles/material-symbols.css",
        ),
        ...(isProduction
          ? { tslog$: path.resolve(__dirname, "js/shims/tslog.ts") }
          : {}),
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          include: [path.resolve(__dirname, "js/service-worker")],
          use: {
            loader: "ts-loader",
            options: { configFile: path.resolve(__dirname, "tsconfig.sw.json") },
          },
        },
        {
          test: /\.tsx?$/,
          exclude: [path.resolve(__dirname, "js/service-worker")],
          use: {
            loader: "ts-loader",
            options: { allowTsInNodeModules: true },
          },
          include: [path.resolve(__dirname, "js"), lxClientSource],
        },
        // `lx_client` components inline SVG source via `require`, so expose the
        // package's image files as raw strings (and other assets as URLs).
        {
          test: /\.svg$/,
          include: [lxClientSource],
          type: "asset/source",
        },
        {
          test: /\.(webp|cur|ani|jpg|png|gif)$/,
          include: [lxClientSource],
          type: "asset/resource",
        },
      ],
    },
    plugins,
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
      publicPath: `${basePath}/`,
      clean: true,
    },
    performance: isProduction
      ? {
          // Production keeps the budget enabled so a regression warns. The
          // largest asset is main.js at ~470 KiB; the icon font is a 13 KiB
          // subset. Unminified development output is intentionally not
          // measured against these limits.
          hints: "warning",
          maxAssetSize: 2 * 1024 * 1024,
          maxEntrypointSize: 2.25 * 1024 * 1024,
        }
      : { hints: false },
  };
};
