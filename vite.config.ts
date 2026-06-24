import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST || "127.0.0.1";
// @ts-expect-error process is a nodejs global
const platform = process.env.TAURI_ENV_PLATFORM;
// @ts-expect-error process is a nodejs global
const isDebug = !!process.env.TAURI_ENV_DEBUG;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Use fileURLToPath, NOT URL.pathname. On Windows `.pathname` yields a
      // malformed drive path like "/C:/…/src", which makes the production
      // bundle resolve "@/…" imports unreliably. fileURLToPath returns a
      // proper, OS-native absolute path on every platform.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  // Only env vars prefixed with these are exposed to the client. Including the
  // TAURI_ENV_* prefix keeps parity with the Tauri tooling.
  envPrefix: ["VITE_", "TAURI_ENV_", "TAURI_PLATFORM", "TAURI_DEV_HOST"],

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  // Build the production bundle for the exact WebView the bundle runs in.
  // Windows ships WebView2 (Chromium), macOS/Linux use WebKit. Leaving this
  // unset lets Vite pick a target the developer's local engine tolerates but a
  // shipped client's WebView may not — a dev-vs-production gap that never shows
  // up under `tauri dev`.
  build: {
    target: platform === "windows" ? "chrome105" : "safari13",
    // Use Terser with identifier mangling DISABLED for the production build.
    //
    // Recharts (>= v3) pulls in CommonJS dependencies whose interop wrappers
    // are emitted by the bundler as a function-scoped `var x = requireX()`,
    // where the local and the outer require binding start out as DISTINCT
    // names. Any identifier mangler (Vite's default oxc minifier AND Terser
    // with mangling on) collapses those two distinct names to the same
    // single-letter identifier, producing self-referential code like
    // `var t = t()`. At runtime `t` is the hoisted, still-undefined local, so
    // the call throws "t is not a function" and the whole reports chunk fails
    // to evaluate. It never shows up under `tauri dev` (unminified) — only in
    // the shipped, minified .msi, and only on the reports page (the one chunk
    // that imports recharts).
    //
    // Disabling mangling keeps every other minification (whitespace + dead-code
    // compression) while preserving the distinct names, which removes the
    // collision. The size cost is irrelevant for a locally-served Tauri app.
    minify: isDebug ? false : "terser",
    terserOptions: { mangle: false },
    sourcemap: isDebug,
  },
}));
