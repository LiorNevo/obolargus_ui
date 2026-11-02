/**
 * Extracts lx_client's compiled theme CSS into a standalone stylesheet.
 *
 * The generated registry stores every component's CSS in JavaScript strings.
 * Shipping that as a `<link>` asset removes hundreds of KiB from the initial
 * JS parse while keeping the exact same styles.
 */
const fs = require("fs");
const ts = require("typescript");

function generateThemeCss(sourcePath) {
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

  const css = THEME_IDS.map(
    (themeId) => COMPILED_THEMES[themeId]?.css ?? "",
  ).join("\n");
  return { css, themeIds: THEME_IDS };
}

module.exports = { generateThemeCss };
