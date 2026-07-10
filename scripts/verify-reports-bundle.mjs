// Verifies that the PRODUCTION bundle (the bytes shipped inside the .msi) loads
// the reports page without the module-evaluation crash that only appears in the
// built artifact (e.g. "require_get is not a function" / "t is not a function").
//
// Why this catches the Windows-only bug WITHOUT Windows: Windows WebView2 IS
// Chromium — the same engine this script drives via a headless Chrome. The crash
// is a deterministic JavaScript error baked into the minified, code-split bundle;
// it does not depend on the OS or the WebView2 version. `tauri dev` never
// reproduces it because the dev server does not code-split — only the built
// bundle does. So we build, serve `dist/` with `vite preview`, drive the real
// lazy-loaded routes in headless Chromium, and fail if the reports chunk crashes.
//
// The crash is swallowed by the app's React error boundaries, so the reliable
// failure signal is the boundary's on-screen text — not an uncaught pageerror.
//
// Run: node scripts/verify-reports-bundle.mjs   (expects an existing `dist/`)

import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { chromium } from "playwright-core";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4173;
const BASE = `http://localhost:${PORT}`;

const HEADLESS_SHELL = path.join(
  process.env.HOME ?? "",
  ".cache/ms-playwright/chromium_headless_shell-1223/chrome-headless-shell-linux64/chrome-headless-shell",
);

// Text rendered by the two error boundaries when a chunk fails to load/evaluate
// or a report view throws during render.
const LAZY_BOUNDARY = "تعذّر تحميل الصفحة"; // src/app/routing/LazyRoute.tsx
const REPORTS_BOUNDARY = "حدث خطأ في صفحة التقارير"; // src/modules/reports/.../ReportsPage.tsx
const FATAL = /is not a function|is not defined|before initialization/i;

// Each reports view renders a recharts chart unconditionally, so a healthy build
// must show `.recharts-responsive-container`. The dashboard charts depend on data
// (which we don't provide), so we only assert "no crash" there.
const ROUTES = [
  { path: "/", label: "dashboard", expectChart: false },
  { path: "/reports?view=profit", label: "reports · profit (PieChart)", expectChart: true },
  { path: "/reports?view=period-month", label: "reports · period (LineChart)", expectChart: true },
  { path: "/reports?view=top-items", label: "reports · top-items (BarChart)", expectChart: true },
  { path: "/reports?view=expenses", label: "reports · expenses (PieChart)", expectChart: true },
];

// Minimal Tauri shim so the SPA boots all the way to the routed content:
//  - get_current_user → admin (unlocks the `reports` feature via authSlice)
//  - is_first_launch  → false (otherwise AppLayout renders a blank loader)
//  - everything else  → null/[] so queries resolve and charts render empty.
const TAURI_STUB = `
  window.__TAURI_INTERNALS__ = {
    transformCallback: (cb) => cb,
    invoke: (cmd) => {
      switch (cmd) {
        case "get_current_user":
          return Promise.resolve({ id: 1, name: "Verify", username: "admin", role: "admin", is_active: 1, created_at: "2024-01-01" });
        case "is_first_launch":
          return Promise.resolve(false);
        default:
          return Promise.resolve(null);
      }
    },
  };
  window.__TAURI_OS_PLUGIN_INTERNALS__ = { platform: "windows" };
`;

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        if ((await fetch(url)).ok) return resolve();
      } catch {
        /* not up yet */
      }
      if (Date.now() - start > timeoutMs) return reject(new Error("vite preview did not start in time"));
      setTimeout(tick, 250);
    };
    tick();
  });
}

async function main() {
  if (!existsSync(path.join(ROOT, "dist", "index.html"))) {
    console.error("✗ dist/index.html not found — run `vite build` first.");
    process.exit(2);
  }
  if (!existsSync(HEADLESS_SHELL)) {
    console.error(`✗ headless chromium not found at ${HEADLESS_SHELL}`);
    process.exit(2);
  }

  const reportsChunk = readdirSync(path.join(ROOT, "dist", "assets")).find((f) => /^reports-.*\.js$/.test(f));
  console.log(`• reports chunk: ${reportsChunk ?? "(none)"}\n`);

  const preview = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
    cwd: ROOT,
    stdio: "ignore",
  });

  let browser;
  const failures = [];
  try {
    await waitForServer(BASE);
    browser = await chromium.launch({ executablePath: HEADLESS_SHELL, headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(TAURI_STUB);

    for (const route of ROUTES) {
      const page = await context.newPage();
      const pageErrors = [];
      page.on("pageerror", (err) => pageErrors.push(err.message));

      await page.goto(`${BASE}${route.path}`, { waitUntil: "networkidle", timeout: 20000 });
      await page.waitForTimeout(1000); // let the lazy chunk mount / boundary settle

      const lazyHit = await page.getByText(LAZY_BOUNDARY).count().catch(() => 0);
      const reportsHit = await page.getByText(REPORTS_BOUNDARY).count().catch(() => 0);
      const charts = await page.locator(".recharts-responsive-container").count().catch(() => 0);
      const fatal = pageErrors.filter((m) => FATAL.test(m));

      // The boundary renders the underlying error in a <details><pre> — surface it.
      let boundaryMsg = "";
      if (lazyHit || reportsHit) {
        boundaryMsg = (await page.locator("details pre").first().innerText().catch(() => "")).split("\n")[0];
      }

      const crashed = lazyHit > 0 || reportsHit > 0 || fatal.length > 0;
      const chartMissing = route.expectChart && charts === 0 && !crashed;
      const ok = !crashed && !chartMissing;

      console.log(
        `${ok ? "✓" : "✗"} ${route.label} — boundary:${lazyHit + reportsHit} charts:${charts} pageerrors:${fatal.length}`,
      );
      if (boundaryMsg) console.log(`    ↳ ${boundaryMsg}`);
      for (const m of fatal) console.log(`    ↳ ${m}`);
      if (chartMissing) console.log(`    ↳ expected a chart to render but found none`);

      if (!ok) failures.push(route.label);
      await page.close();
    }
  } finally {
    if (browser) await browser.close();
    preview.kill("SIGTERM");
  }

  if (failures.length > 0) {
    console.error(`\n✗ FAILED: ${failures.length} route(s) crashed/regressed in the production bundle.`);
    process.exit(1);
  }
  console.log("\n✓ PASSED: reports + dashboard chunks evaluate and charts render with no fatal errors.");
}

main().catch((err) => {
  console.error("verify script error:", err);
  process.exit(2);
});
