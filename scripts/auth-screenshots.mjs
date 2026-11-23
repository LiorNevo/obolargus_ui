#!/usr/bin/env node
/**
 * Captures the spec 034 browser evidence.
 *
 * Runs the UI dev server twice (auth enabled and development mode), stubs
 * Google Identity Services and the API with Playwright routes, and writes
 * PNGs plus a README into specs/034-production-hardening/screenshots.
 *
 * Usage (from the repository root): node obolargus_ui/scripts/auth-screenshots.mjs
 */

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const uiDir = path.resolve(scriptDir, "..");
const repoDir = path.resolve(uiDir, "..");
const outDir = process.env.SCREENSHOT_OUT_DIR
  ? path.resolve(process.env.SCREENSHOT_OUT_DIR)
  : path.resolve(repoDir, "specs/034-production-hardening/screenshots");

async function loadChromium() {
  try {
    const module = await import("playwright");
    return module.chromium;
  } catch {
    const fallback =
      process.env.PLAYWRIGHT_MODULE ??
      path.join(repoDir, "node_modules", "playwright", "index.mjs");
    const module = await import(pathToFileURL(fallback).href);
    return module.chromium;
  }
}

const chromium = await loadChromium();

const AUTH_PORT = 8181;
const DEV_PORT = 8182;

/** Reuse a manually started dev server while iterating on the script. */
const externalDev = process.env.SCREENSHOT_EXTERNAL_DEV ?? null;

/**
 * The dev server serves assets at the root, while the app router keeps its
 * `/obolargus` basename, so pages load through the history fallback.
 */
function appUrl(port, route = "/") {
  if (port === DEV_PORT && externalDev) {
    return `${externalDev.replace(/\/$/, "")}/obolargus${route}`;
  }
  return `http://127.0.0.1:${port}/obolargus${route}`;
}

/** Optional comma-separated subset for re-capturing one state. */
const only = (process.env.SCREENSHOT_ONLY ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const wants = (name) => only.length === 0 || only.includes(name);

const stubGoogleScript = `
window.google = {
  accounts: {
    id: {
      initialize: function (options) { window.__gisCallback = options.callback; },
      renderButton: function (parent) {
        parent.replaceChildren();
        var button = document.createElement("button");
        button.type = "button";
        button.textContent = "Sign in with Google";
        button.setAttribute("data-stub", "google-signin");
        button.style.cssText = "width:280px;height:40px;border:1px solid #747775;border-radius:4px;background:#fff;color:#1f1f1f;font:500 14px Roboto,Arial,sans-serif;cursor:pointer";
        button.addEventListener("click", function () {
          if (window.__gisCallback) window.__gisCallback({ credential: "stub-google-credential" });
        });
        parent.appendChild(button);
      },
      disableAutoSelect: function () {}
    }
  }
};
`;

const session = {
  access_token: "stub-access-token",
  refresh_token: "stub-refresh-token",
  token_type: "Bearer",
  expires_in: 900,
  actor: { id: "11111111-1111-1111-1111-111111111111", email: "owner@example.com" },
};

function startServer(port, env) {
  const child = spawn(
    path.join(uiDir, "node_modules", ".bin", "webpack"),
    ["serve", "--mode", "development", "--port", String(port)],
    {
      cwd: uiDir,
      env: {
        ...process.env,
        OBOLARGUS_BASE_PATH: "/",
        ...env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let log = "";
  child.stdout.on("data", (chunk) => {
    log += chunk;
  });
  child.stderr.on("data", (chunk) => {
    log += chunk;
  });
  child.on("error", (error) => {
    log += `\nspawn error: ${String(error)}\n`;
  });
  child.on("exit", (code, signal) => {
    log += `\ndev server exited (${code ?? signal})\n`;
  });
  return { child, port, log: () => log };
}

function waitForServer(server, timeoutMs = 600_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const probe = () => {
      const request = http.get(
        { host: "127.0.0.1", port: server.port, path: "/", timeout: 2_000 },
        (response) => {
          response.resume();
          resolve();
        },
      );
      request.on("error", () => {
        if (Date.now() > deadline) {
          reject(
            new Error(
              `server on ${server.port} did not start:\n${server.log()}`,
            ),
          );
        } else {
          setTimeout(probe, 500);
        }
      });
      request.on("timeout", () => request.destroy());
    };
    probe();
  });
}

function waitForCompiled(server, timeoutMs = 600_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const probe = () => {
      const log = server.log();
      if (/compiled successfully/i.test(log)) {
        resolve();
        return;
      }
      if (/compiled with \d+ errors/i.test(log)) {
        reject(new Error(`dev server ${server.port} failed to compile:\n${log}`));
        return;
      }
      if (Date.now() > deadline) {
        reject(new Error(`dev server ${server.port} did not finish compiling`));
        return;
      }
      setTimeout(probe, 500);
    };
    probe();
  });
}

async function stopServer(server) {
  if (!server) return;
  server.child.kill("SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      server.child.kill("SIGKILL");
      resolve();
    }, 5_000);
    server.child.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function fulfillJson(route, body, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function stubGoogle(page) {
  await page.route("https://accounts.google.com/gsi/client", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: stubGoogleScript,
    }),
  );
}

async function stubApi(page, overrides = {}) {
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    for (const [pattern, handler] of Object.entries(overrides)) {
      const [method, pathname] = pattern.split(" ");
      if (request.method() === method && url.pathname.endsWith(pathname)) {
        return handler(route, request);
      }
    }
    return fulfillJson(route, {});
  });
}

async function newPage(browser) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(30_000);
  await stubGoogle(page);
  return { context, page };
}

async function shoot(page, name) {
  await page.screenshot({ path: path.join(outDir, name), fullPage: false });
  console.log(`captured ${name}`);
}

async function captureSignIn(browser) {

  const first = await newPage(browser);
  await stubApi(first.page);
  await first.page.goto(appUrl(AUTH_PORT), { waitUntil: "domcontentloaded" });
  await first.page.getByRole("button", { name: "Sign in with Google" }).waitFor();
  await shoot(first.page, "sign-in-default.png");
  await first.context.close();

  const second = await newPage(browser);
  await stubApi(second.page, {
    "POST /api/auth/login": (route) =>
      fulfillJson(
        route,
        {
          error: {
            code: "account_not_allowed",
            message: "account not allowed",
          },
        },
        403,
      ),
  });
  await second.page.goto(appUrl(AUTH_PORT), { waitUntil: "domcontentloaded" });
  await second.page.getByRole("button", { name: "Sign in with Google" }).click();
  await second.page.getByRole("alert").waitFor();
  await shoot(second.page, "sign-in-error.png");
  await second.context.close();

  const third = await newPage(browser);
  await stubApi(third.page, {
    "POST /api/auth/login": (route) => fulfillJson(route, session),
    "GET /api/assets": (route) =>
      fulfillJson(route, {
        items: [
          {
            id: "asset-1",
            display_name: "ACME Corp",
            asset_type: "stock",
            currency: "USD",
            primary_identifier: "ACME",
          },
        ],
      }),
  });
  await third.page.goto(appUrl(AUTH_PORT), { waitUntil: "domcontentloaded" });
  await third.page.getByRole("button", { name: "Sign in with Google" }).click();
  await third.page
    .getByRole("button", { name: /Account menu for owner@example/i })
    .waitFor();
  await third.page
    .getByRole("button", { name: /Account menu for owner@example/i })
    .click();
  await third.page.getByRole("dialog", { name: "Account menu" }).waitFor();
  await shoot(third.page, "user-menu.png");
  await third.context.close();
}

async function captureDevMode(browser) {
  const { context, page } = await newPage(browser);
  await stubApi(page, {
    "GET /api/assets": (route) =>
      fulfillJson(route, {
        items: [
          {
            id: "asset-1",
            display_name: "ACME Corp",
            asset_type: "stock",
            currency: "USD",
            primary_identifier: "ACME",
          },
        ],
      }),
  });
  await page.goto(appUrl(DEV_PORT), { waitUntil: "domcontentloaded" });
  await page.getByTestId("dev-mode-banner").waitFor();
  await page.waitForTimeout(1_000);
  await shoot(page, "dev-mode-banner.png");
  await context.close();
}

async function captureTimeout(browser) {
  const { context, page } = await newPage(browser);
  await stubApi(page, {
    "GET /api/assets": async (route) => {
      // Never answer before the UI's 15 s deadline; the browser aborts first.
      await new Promise((resolve) => setTimeout(resolve, 25_000));
      await route
        .fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: [] }),
        })
        .catch(() => {});
    },
  });
  await page.goto(appUrl(DEV_PORT), { waitUntil: "domcontentloaded" });
  try {
    await page.getByRole("button", { name: "Add widget" }).click();
    const catalog = page.getByRole("dialog", { name: "Add a widget" });
    await catalog
      .getByRole("button", { name: "Add Candlestick chart" })
      .click();
    await catalog.waitFor({ state: "detached" });
    const instrument = page
      .getByRole("combobox", { name: "Instrument" })
      .first();
    await instrument.click();
    await page.getByRole("textbox", { name: "Search options" }).fill("ACME");
    await page
      .getByText(/took too long/i)
      .first()
      .waitFor({ timeout: 30_000 });
    await shoot(page, "timeout-retry.png");
  } catch (error) {
    await page.screenshot({ path: "/tmp/screenshot-debug-timeout.png" });
    throw error;
  }
  await context.close();
}

function dataLoadRoutes(overrides = {}) {
  return {
    "GET /api/data-load/domains": (route) =>
      fulfillJson(route, {
        domains: [
          {
            id: "market_data",
            label: "Market data",
            loadable: true,
            unavailable_reason: null,
          },
        ],
      }),
    "GET /api/data-load/sources": (route) =>
      fulfillJson(route, {
        domain: "market_data",
        sources: [
          {
            source_id: "stooq",
            display_name: "Stooq",
            enabled: true,
            priority: 1,
            supported_schemes: ["TICKER"],
            supported_data_domains: ["market_data"],
            selectable_for_domain: true,
            unavailable_reason: null,
          },
        ],
      }),
    "GET /api/data-load/history": (route) =>
      fulfillJson(route, { entries: [], total: 0, limit: 50, offset: 0 }),
    ...overrides,
  };
}

async function fillAndSubmitLoad(page, mode) {
  await page
    .getByRole("textbox", { name: /Paste identifiers, one per line/i })
    .fill("TICKER:XNAS:AAPL");
  if (mode === "range") {
    await page.getByRole("radio", { name: "Date range" }).check();
  }
  await page.getByRole("button", { name: "Load", exact: true }).click();
  await page.getByText(/Load failed:/i).waitFor({ timeout: 30_000 });
  await page.locator(".obolargus_alert").scrollIntoViewIfNeeded();
}

async function captureLimit(browser) {
  const { context, page } = await newPage(browser);
  await stubApi(
    page,
    dataLoadRoutes({
      "POST /api/market-data/load": (route) =>
        fulfillJson(
          route,
          {
            error: {
              code: "limit_exceeded",
              message:
                "Too many identifier-days: 100,000 allowed, 250,000 requested. Split the range or reduce identifiers.",
              details: {
                field: "identifier_days",
                limit: 100_000,
                actual: 250_000,
              },
            },
          },
          400,
        ),
    }),
  );
  await page.goto(appUrl(DEV_PORT, "/data-load"), { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Data Load" }).waitFor();
  await fillAndSubmitLoad(page, "single");
  await shoot(page, "limit-error.png");
  await context.close();
}

async function captureConflict(browser) {
  const { context, page } = await newPage(browser);
  await stubApi(
    page,
    dataLoadRoutes({
      "POST /api/market-data/load-range/async": (route) =>
        fulfillJson(
          route,
          {
            error: {
              code: "duplicate_group",
              message:
                "A range load with this group already exists (run 8f1c2d3e-0000-4000-8000-000000000001).",
              details: {
                group_id: "8f1c2d3e-0000-4000-8000-000000000001",
              },
            },
          },
          409,
        ),
    }),
  );
  await page.goto(appUrl(DEV_PORT, "/data-load"), { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Data Load" }).waitFor();
  await fillAndSubmitLoad(page, "range");
  await shoot(page, "conflict-error.png");
  await context.close();
}

const screenshotReadme = `# Spec 034 UI evidence

Current Chromium screenshots captured by \`obolargus_ui/scripts/auth-screenshots.mjs\`.
The API and Google Identity Services are Playwright route stubs, so the shots
prove UI states and copy, not provider connectivity.

| File | What it proves |
|------|----------------|
| \`sign-in-default.png\` | An unauthenticated visitor sees the sign-in card and Google button; the workspace is not rendered (FR-001, FR-003). |
| \`sign-in-error.png\` | A 403 \`account_not_allowed\` response renders a non-enumerating error and keeps the workspace hidden (FR-004, US1 scenario 4). |
| \`user-menu.png\` | A signed-in owner sees the account menu with sign-out; the token exchange response is the same shape the server contract defines (FR-003). |
| \`dev-mode-banner.png\` | \`AUTH_ENABLED=false\` renders the persistent development-mode banner above the workspace (FR-008). |
| \`timeout-retry.png\` | A stalled instrument-search request ends with a retryable timeout message within the 15 s UI deadline instead of an indefinite spinner (FR-034, T100). |
| \`limit-error.png\` | A bounded-load rejection surfaces the server message and a Retry action (FR-011, US2). |
| \`conflict-error.png\` | A duplicate range group surfaces the 409 conflict with the existing run id and a Retry action (FR-015, US3). |

Reproduce (the script starts and stops both dev servers itself):

\`\`\`sh
cd <repository root>
pnpm exec playwright install chromium
node obolargus_ui/scripts/auth-screenshots.mjs
\`\`\`

On a Linux host missing Chromium's shared libraries, run
\`pnpm exec playwright install --with-deps chromium\` (or install the equivalent
system packages) first.

The auth screenshots run a dev server built with \`AUTH_ENABLED=true\` and a
placeholder \`GOOGLE_CLIENT_ID\`; the remaining screenshots use
\`AUTH_ENABLED=false\` so the pages behind the gate can be reached without a
real Google account. Both builds still use the production auth gate code.
`;

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const withServer = async (port, env, capture) => {
    const server = startServer(port, env);
    try {
      await waitForServer(server);
      await waitForCompiled(server);
      await capture();
    } finally {
      await stopServer(server);
    }
  };
  try {
    if (wants("sign-in")) {
      await withServer(
        AUTH_PORT,
        {
          AUTH_ENABLED: "true",
          GOOGLE_CLIENT_ID: "stub-client.apps.googleusercontent.com",
        },
        () => captureSignIn(browser),
      );
    }
    if (wants("dev") || wants("timeout") || wants("limit") || wants("conflict")) {
      if (externalDev) {
        if (wants("dev")) await captureDevMode(browser);
        if (wants("timeout")) await captureTimeout(browser);
        if (wants("limit")) await captureLimit(browser);
        if (wants("conflict")) await captureConflict(browser);
      } else {
        await withServer(DEV_PORT, { AUTH_ENABLED: "false" }, async () => {
          if (wants("dev")) await captureDevMode(browser);
          if (wants("timeout")) await captureTimeout(browser);
          if (wants("limit")) await captureLimit(browser);
          if (wants("conflict")) await captureConflict(browser);
        });
      }
    }
    await writeFile(path.join(outDir, "README.md"), screenshotReadme);
    console.log(`screenshots written to ${outDir}`);
  } finally {
    await browser.close();
  }
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
