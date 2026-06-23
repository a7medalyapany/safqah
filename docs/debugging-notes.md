# Debugging Notes

Running log of non-obvious bugs, their root cause, and the fix.
Add entries as you encounter them. This prevents solving the same problem twice.

Format:
```
## [Date] — [Short description]
**Symptom:** What the user/engineer saw
**Root cause:** Why it actually happened
**Fix:** What resolved it
**Prevention:** How to avoid it next time
```

---

<!-- Entries go below this line as the project progresses -->

## 2026-06-23 — Reports page crashes only on shipped Windows builds

**Symptom:** On Windows installs built by the CI/CD pipeline, navigating to the
Reports page showed the global error screen ("حدث خطأ غير متوقع / يرجى إعادة
تشغيل البرنامج"). Restarting the app did not help. Everything worked in `tauri
dev` on Fedora.

**Root cause:** Two compounding issues, both invisible during `tauri dev` on
Linux:
1. The Reports route is `lazy(() => import("@/modules/reports"))`. When the
   reports chunk fails to load/parse in the client's WebView2, the dynamic
   `import()` rejects. The Reports page's own `ReportsErrorBoundary` lives
   *inside* that chunk, so it never mounts to catch the failure — the rejection
   bubbled up to the global app boundary, which has no working retry
   (`React.lazy` caches the rejected promise), hence "restart doesn't help".
2. The production bundle was built with Linux/dev-only assumptions:
   `vite.config.ts` used `new URL("./src", import.meta.url).pathname` (yields a
   broken `/C:/…` path on Windows) and set no Tauri `build.target` / `minify` /
   `sourcemap`. CI also used `npm install` instead of `npm ci`.

**Fix:**
- Added `src/app/routing/LazyRoute.tsx` — a Suspense + error boundary that lives
  in the always-loaded app shell (outside every lazy chunk). It surfaces the
  real error and offers a retry that rebuilds `lazy()` so the chunk is
  re-fetched (a failed dynamic import is not cached by the module system).
- `vite.config.ts`: `fileURLToPath` for the `@` alias, plus a Tauri `build`
  block (`target` per `TAURI_ENV_PLATFORM`, `minify`, `sourcemap`) and
  `envPrefix`.
- `release.yml`: `npm ci` for reproducible installs.

**Prevention:** Keep route-level error boundaries *outside* the lazy chunk they
guard. Never use `URL.pathname` for filesystem paths — use `fileURLToPath`.
Build/test the production bundle (not just `tauri dev`) on each target OS.
