---
name: verify
description: How to verify Safqah UI changes end-to-end without launching the Tauri window — headless Chromium on the built bundle plus SQL against a copy of the real DB.
---

# Verifying Safqah changes

Safqah is Tauri 2 + React 19 + SQLite. Two complementary handles, no Windows or GUI needed:

## 1. Frontend surface: built bundle in headless Chromium

`npm run build`, then serve `dist/` with `vite preview` and drive it with
`playwright-core` + the cached headless shell at
`~/.cache/ms-playwright/chromium_headless_shell-1223/.../chrome-headless-shell`.
Model the script on `scripts/verify-reports-bundle.mjs` (Tauri invoke stub, error-boundary
text as the crash signal).

**Auth gotcha (required since the login feature landed):** the app bootstraps auth from
`localStorage["safqah.auth.token"]` and then calls `get_current_user({ token })`
(`src/store/authSlice.ts`). A stub that only answers `get_current_user` still lands on the
login page. The init script must ALSO do:

```js
localStorage.setItem("safqah.auth.token", "verify-token");
```

This is why `npm run verify:bundle`'s chart assertions fail: its stub predates login and
every route renders the login form instead.

Useful stub tricks:
- Record calls: `window.__INVOKES__.push({ cmd, args })` inside the stub's `invoke`, then
  `page.evaluate(() => window.__INVOKES__)` to assert what the frontend sent (arg names are
  camelCase, e.g. `dateFrom`; Tauri maps them to snake_case Rust params).
- Return fixture rows (millieme integers) per command so tables/KPIs render populated.
- Reports deep-link via `/reports?view=<id>`; an unknown id falls back to the reports home.
- Run scratchpad scripts with `createRequire("<repo>/package.json")("playwright-core")` —
  a plain import won't resolve from outside the repo.

## 2. Backend/SQL: real data, read-only

The live DB is `~/.local/share/pos/pos.db` (WAL — copy the `-wal` file too). Copy both to
the scratchpad and run the exact SQL from `src-tauri/src/commands/reports.rs` with `sqlite3`,
substituting bind values. Cross-check aggregates with an independent per-row query.

`cargo check` in `src-tauri/` covers the command signatures; the sqlx queries are runtime
strings, so executing them against the DB copy is the only pre-launch check of the SQL text.
