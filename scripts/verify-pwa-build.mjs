#!/usr/bin/env node
/**
 * Verifies that the production build emitted an installable, offline-capable
 * bundle with a base-path-scoped precache.
 *
 * This script reads only build output; it never mutates `dist/`.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST = join(process.cwd(), "dist");
const BASE_PATH = normalize(process.env.OBOLARGUS_BASE_PATH ?? "/obolargus");

function normalize(value) {
  if (!value || value === "/") return "";
  const withLeading = value.startsWith("/") ? value : `/${value}`;
  return withLeading.replace(/\/+$/, "");
}

function fail(message) {
  console.error(`verify-pwa-build: ${message}`);
  process.exitCode = 1;
}

function requireFile(relative) {
  const path = join(DIST, relative);
  if (!existsSync(path)) {
    fail(`missing ${relative}`);
    return null;
  }
  return readFileSync(path, "utf8");
}

const worker = requireFile("service-worker.js");
const manifestSource = requireFile("manifest.webmanifest");
const html = requireFile("index.html");

for (const icon of [
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "icons/apple-touch-icon-180.png",
]) {
  if (!existsSync(join(DIST, icon))) fail(`missing ${icon}`);
}

if (!existsSync(join(DIST, "theme-registry.css"))) {
  fail("missing theme-registry.css");
}

const fontFiles = readdirSync(DIST).filter((name) => name.endsWith(".woff2"));
if (fontFiles.length === 0) {
  fail("missing the subset Material Symbols font");
} else {
  const fontBytes = fontFiles.reduce(
    (total, name) => total + statSync(join(DIST, name)).size,
    0,
  );
  if (fontBytes > 128 * 1024) {
    fail(
      `icon font is not subset: ${fontBytes} bytes (run pnpm subset:icons)`,
    );
  }
}

if (manifestSource) {
  try {
    const manifest = JSON.parse(manifestSource);
    if (manifest.start_url !== "./" || manifest.scope !== "./") {
      fail("manifest start_url and scope must be relative (./)");
    }
    if (manifest.display !== "standalone") {
      fail("manifest display must be standalone");
    }
    const sizes = new Set((manifest.icons ?? []).map((icon) => icon.sizes));
    for (const required of ["192x192", "512x512"]) {
      if (!sizes.has(required)) fail(`manifest is missing a ${required} icon`);
    }
    if (!(manifest.icons ?? []).some((icon) => icon.purpose === "maskable")) {
      fail("manifest is missing a maskable icon");
    }
  } catch (error) {
    fail(`manifest is not valid JSON: ${error.message}`);
  }
}

if (html) {
  if (!html.includes(`${BASE_PATH}/manifest.webmanifest`)) {
    fail("index.html does not link the base-path manifest");
  }
  if (!html.includes(`${BASE_PATH}/icons/apple-touch-icon-180.png`)) {
    fail("index.html does not link the base-path Apple touch icon");
  }
  if (!html.includes(`${BASE_PATH}/theme-registry.css`)) {
    fail("index.html does not link the theme registry stylesheet");
  }
  if (!html.includes('name="theme-color"')) {
    fail("index.html is missing the theme-color metadata");
  }
  if (!html.includes('name="mobile-web-app-capable"')) {
    fail("index.html is missing the standard mobile-web-app-capable metadata");
  }
}

if (worker) {
  if (worker.includes("clientsClaim")) {
    fail("service worker must not call clientsClaim()");
  }
  if (worker.includes("skipWaiting") && !worker.includes("SKIP_WAITING")) {
    fail("service worker calls skipWaiting() without a SKIP_WAITING message gate");
  }

  const urls = [
    ...worker.matchAll(/['"]?url['"]?\s*:\s*['"]([^'"]+)['"]/g),
  ].map((match) => match[1]);
  if (urls.length === 0) {
    fail("service worker contains no precache manifest entries");
  }
  for (const url of urls) {
    if (BASE_PATH && !url.startsWith(`${BASE_PATH}/`)) {
      fail(`precache URL ${url} does not start with ${BASE_PATH}/`);
    }
    if (/\.map$|\.LICENSE\.txt$|^docs-runner\/|service-worker\.js$/.test(url)) {
      fail(`precache URL ${url} is excluded from precaching`);
    }
  }
  if (!urls.some((url) => /(?:^|\/)index\.html$/.test(url))) {
    fail("precache does not include index.html");
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}
console.log("verify-pwa-build: OK");
