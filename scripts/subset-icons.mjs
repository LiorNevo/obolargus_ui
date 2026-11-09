#!/usr/bin/env node
/**
 * Regenerates the Material Symbols subset used by the application.
 *
 * The full variable font is ~3.8 MiB and its ligature closure reaches every
 * icon. This script derives the private-use codepoint for each icon the app
 * renders, then subsets only those glyphs plus the letters needed for their
 * ligature names (`noLayoutClosure` prevents the whole icon set from being
 * pulled back in).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const subsetFont = require("subset-font");
const fontverter = require(
  require.resolve("fontverter", {
    paths: [require.resolve("subset-font")],
  }),
);
const hbPath = require.resolve("harfbuzzjs", {
  paths: [require.resolve("subset-font")],
});
const hb = await import(hbPath);

const ICONS = [
  "account_tree",
  "add",
  "arrow_drop_down",
  "article",
  "bolt",
  "bug_report",
  "calendar_today",
  "call_split",
  "center_focus_strong",
  "check",
  "check_circle",
  "chevron_left",
  "chevron_right",
  "close",
  "content_copy",
  "database",
  "date_range",
  "delete",
  "download",
  "edit",
  "error",
  "info",
  "login",
  "logout",
  "map",
  "monitor_heart",
  "more_vert",
  "notifications",
  "output",
  "pause",
  "play_arrow",
  "redo",
  "remove",
  "restart_alt",
  "rule",
  "schedule",
  "search",
  "settings",
  "task_alt",
  "transform",
  "tune",
  "undo",
  "unfold_less",
  "unfold_more",
  "upload",
  "warning",
  "zoom_in",
  "zoom_out",
];

const scriptDir = dirname(fileURLToPath(import.meta.url));
const uiRoot = resolve(scriptDir, "..");
const lxRoot = resolve(uiRoot, "../lx_client");
const packageCss = require.resolve("material-symbols/outlined.css", {
  paths: [lxRoot],
});
const sourceFont = join(
  dirname(packageCss),
  "material-symbols-outlined.woff2",
);
const outputFont = resolve(
  uiRoot,
  "js/styles/fonts/material-symbols-outlined-subset.woff2",
);

function shape(font, text) {
  const buffer = new hb.Buffer();
  buffer.addText(text);
  buffer.guessSegmentProperties();
  hb.shape(font, buffer);
  return buffer.getGlyphInfos().map((glyph) => glyph.codepoint);
}

function makeFont(sfnt) {
  const arrayBuffer = sfnt.buffer.slice(
    sfnt.byteOffset,
    sfnt.byteOffset + sfnt.byteLength,
  );
  return new hb.Font(new hb.Face(new hb.Blob(arrayBuffer)));
}

const source = readFileSync(sourceFont);
const sourceSfnt = await fontverter.convert(source, "sfnt");
const sourceHbFont = makeFont(sourceSfnt);

const iconGlyphs = new Map();
for (const icon of ICONS) {
  const glyphs = shape(sourceHbFont, icon);
  if (glyphs.length !== 1 || glyphs[0] === 0) {
    throw new Error(`icon '${icon}' does not resolve to one glyph: ${glyphs}`);
  }
  iconGlyphs.set(icon, glyphs[0]);
}

const codepoints = [];
const glyphToCodepoint = new Map();
for (const codepoint of Array.from(sourceHbFont.face.collectUnicodes())) {
  if (codepoint < 0xe000 || codepoint > 0xf8ff) continue;
  const glyphs = shape(sourceHbFont, String.fromCodePoint(codepoint));
  if (glyphs.length === 1 && glyphs[0] !== 0) {
    glyphToCodepoint.set(glyphs[0], codepoint);
  }
}

for (const [icon, glyph] of iconGlyphs) {
  const codepoint = glyphToCodepoint.get(glyph);
  if (codepoint === undefined) {
    throw new Error(`no private-use codepoint found for icon '${icon}'`);
  }
  codepoints.push(codepoint);
}

const text = `${ICONS.join(" ")} ${codepoints
  .map((codepoint) => String.fromCodePoint(codepoint))
  .join("")}`;
const subset = await subsetFont(source, text, {
  targetFormat: "woff2",
  noLayoutClosure: true,
  preserveNameIds: [1, 2],
});
mkdirSync(dirname(outputFont), { recursive: true });
writeFileSync(outputFont, subset);

// Verify the final WOFF2 through an SFNT round-trip.
const subsetSfnt = await fontverter.convert(subset, "sfnt");
const subsetHbFont = makeFont(subsetSfnt);
for (const icon of ICONS) {
  const glyphs = shape(subsetHbFont, icon);
  if (glyphs.length !== 1 || glyphs[0] === 0) {
    throw new Error(
      `subset icon '${icon}' did not shape to one glyph: ${glyphs}`,
    );
  }
}

console.log(
  `subset icons: ${source.length} -> ${subset.length} bytes (${ICONS.length} glyph names verified)`,
);
