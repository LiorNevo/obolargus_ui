import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * App stylesheets must keep using the themed cursor and corner-radius tokens
 * that `lx_client` defines; literal values bypass the theme.
 *
 * Circles (50%) stay circular by design.
 */
const ROOT = resolve(__dirname, "../..");
const STYLESHEET = /\.(css|scss|sass|less)$/;
const CSS_CURSOR = /cursor:\s*([^;\n]+);/g;
const INLINE_CURSOR = /cursor:\s*["']([^"']+)["']/g;
const CSS_RADIUS = /border-radius:\s*([^;\n]+);/g;
const INLINE_RADIUS = /borderRadius:\s*["']([^"']+)["']/g;
const THEMED_RADIUS =
  /^(0|50%|var\(--border-radius(?:, 0)?\)|var\(--lx-dp-trigger-radius, var\(--border-radius\)\))$/;

function styledSources(): string[] {
  return readdirSync(ROOT, { recursive: true })
    .filter((file): file is string => typeof file === "string")
    .filter((file) => !file.split("/").includes("generated"))
    .filter((file) => !file.split("/").includes("__tests__"))
    .filter((file) => STYLESHEET.test(file) || file.endsWith(".tsx"))
    .map((file) => join(ROOT, file));
}

function values(source: string, file: string, css: RegExp, inline: RegExp): string[] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const pattern = STYLESHEET.test(file) ? css : inline;
  return Array.from(text.matchAll(pattern)).map((match) => match[1].trim());
}

function declarations(css: RegExp, inline: RegExp, property: string): string[] {
  return styledSources().flatMap((file) =>
    values(readFileSync(file, "utf8"), file, css, inline).map(
      (value) => `${file}: ${property}: ${value}`,
    ),
  );
}

describe("theme tokens", () => {
  it("uses themed cursor tokens in every stylesheet and inline style", () => {
    const found = declarations(CSS_CURSOR, INLINE_CURSOR, "cursor");
    const offenders = found.filter(
      (declaration) =>
        !declaration.includes("cursor: var(--cursor-") &&
        !declaration.endsWith("cursor: inherit"),
    );
    expect(found.length).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });

  it("uses the themed border radius everywhere", () => {
    const found = declarations(CSS_RADIUS, INLINE_RADIUS, "border-radius");
    const offenders = found.filter(
      (declaration) =>
        !THEMED_RADIUS.test(
          declaration.slice(declaration.indexOf("border-radius: ") + 15),
        ),
    );
    expect(found.length).toBeGreaterThan(0);
    expect(offenders).toEqual([]);
  });
});
