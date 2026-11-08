/**
 * Extracts lx_client's compiled theme CSS into a standalone stylesheet.
 *
 * The generated registry stores every component's CSS in JavaScript strings.
 * Shipping that as a `<link>` asset removes hundreds of KiB from the initial
 * JS parse while keeping the exact same styles.
 */
const fs = require("fs");
const path = require("path");

// TypeScript 7 is the native compiler and does not expose the JavaScript
// compiler API (ModuleKind/ScriptTarget/transpileModule). The workspace also
// contains a JavaScript TypeScript 6 build, which this script uses.
function loadTypeScript() {
  const store = path.join(__dirname, "..", "node_modules", ".pnpm");
  try {
    const candidate = fs
      .readdirSync(store)
      .filter((entry) => /^typescript@6\./.test(entry))
      .sort()
      .pop();
    if (candidate) {
      return require(path.join(store, candidate, "node_modules", "typescript"));
    }
  } catch {
    // Fall through to the workspace resolution.
  }
  const fallback = require("typescript");
  if (!fallback.ModuleKind) {
    throw new Error(
      "theme-css requires the JavaScript TypeScript 6 compiler API; " +
        "install typescript@6 alongside the native TypeScript 7 compiler",
    );
  }
  return fallback;
}

const ts = loadTypeScript();

function generateThemeCss(sourcePath, options = {}) {
  const source = fs.readFileSync(sourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2021,
    },
    fileName: sourcePath,
  }).outputText;

  const module = { exports: {} };
  new Function("exports", "module", output)(module.exports, module);
  const { COMPILED_THEMES, THEME_IDS } = module.exports;

  if (!COMPILED_THEMES || !THEME_IDS) {
    throw new Error(
      `theme registry did not export COMPILED_THEMES/THEME_IDS: ${sourcePath}`,
    );
  }

  const basePath = (options.basePath ?? "").replace(/\/+$/, "");
  const css = THEME_IDS.map(
    (themeId) => COMPILED_THEMES[themeId]?.css ?? "",
  )
    .join("\n")
    // Cursor images live under `<basePath>/cursor`. Absolute URLs keep them
    // resolvable even when the stylesheet is injected inline on a deep route.
    .replace(/url\("cursor\//g, `url("${basePath}/cursor/`)
    .replace(/url\('cursor\//g, `url('${basePath}/cursor/`);
  return { css, themeIds: THEME_IDS };
}

module.exports = { generateThemeCss };
