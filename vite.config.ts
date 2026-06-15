import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __BUILD_VERSION__: JSON.stringify(
      new Date().toISOString().replace(/[-:]/g, "").slice(0, 13)
    ),
  },
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      devOptions: {
        enabled: false,
      },
      manifest: false,
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
        importScripts: ["/push-sw.js"],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/\~oauth/, /^\/api/, /^\/functions/],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-cache",
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            urlPattern: ({ request }) =>
              ["style", "script", "worker"].includes(request.destination),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "asset-cache" },
          },
          {
            urlPattern: ({ request }) =>
              ["image", "font"].includes(request.destination),
            handler: "CacheFirst",
            options: {
              cacheName: "image-font-cache",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
    mode === "analyze" && visualizer({ filename: "dist/stats.html", template: "treemap", gzipSize: true, brotliSize: true }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    // App code is well under 500KB after splitting vendor chunks below.
    // Bump the warning slightly so the build log stays clean.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split heavy third-party libs into their own long-cacheable chunks
        // so app updates don't bust the vendor cache on every deploy.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("/react-dom/") || id.match(/\/react\/(?!.*react-)/) || id.includes("/scheduler/")) {
            return "react-vendor";
          }
          if (id.includes("react-router") || id.includes("@remix-run/router")) {
            return "router";
          }
          if (id.includes("@supabase")) {
            return "supabase";
          }
          if (id.includes("@radix-ui") || id.includes("@floating-ui")) {
            return "radix";
          }
          if (id.includes("@tanstack")) {
            return "tanstack";
          }
          if (
            id.includes("react-markdown") ||
            id.includes("remark-") ||
            id.includes("micromark") ||
            id.includes("mdast") ||
            id.includes("hast") ||
            id.includes("unified") ||
            id.includes("vfile") ||
            id.includes("property-information") ||
            id.includes("markdown-table")
          ) {
            // Keep the markdown pipeline grouped with its lazy entry chunk.
            return "markdown";
          }
        },
      },
    },
  },
}));
