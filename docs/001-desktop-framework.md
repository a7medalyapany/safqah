# Decision: Desktop Framework

**Date:** Phase 2  
**Status:** Final — do not revisit without a breaking Tauri v2 issue

## Chosen: Tauri v2

## Alternatives Considered

**Electron + React**
- Rejected because: ships its own Chromium (~150MB overhead), heavy RAM usage
  (300MB+ idle), slow cold start. Egyptian shop hardware is often low-spec (4GB RAM,
  spinning HDD) — Electron is a poor fit.

**Next.js desktop (via Tauri or custom)**
- Rejected because: SSR model (server-side rendering) is meaningless for an offline
  desktop app. Next.js adds complexity with no benefit here.

**Pure web app (browser-based)**
- Rejected because: requires a local server process, no native printer access,
  no file system access for backup, more complex deployment.

## Why Tauri v2

- Binary size ~10MB vs Electron's ~150MB
- Uses the OS webview (WebView2 on Windows 10/11 — pre-installed)
- Rust backend handles system calls: printer I/O, file backup, argon2 hashing
- Frontend is plain React — engineers know it, agents generate it well
- Tauri v2 is stable as of 2024, used in production

## Implications (12-18 months)

- WebView2 is always present on Windows 10/11. If a user is on Windows 7/8 (rare
  but possible in Egypt), WebView2 must be manually installed.
- If we ever want a web version of this app, the React frontend is reusable — only
  the `invoke()` calls need to be replaced with HTTP calls.
- Mac/Linux support comes free from Tauri — same codebase, different binary.

## Risks

- WebView2 rendering bugs: rare, usually patched by Microsoft quickly
- Tauri API changes between v2 minor versions: pin versions in Cargo.toml and
  package.json, update deliberately

## Reversibility: Hard
