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
    minify: !isDebug,
    sourcemap: isDebug,
  },
}));
