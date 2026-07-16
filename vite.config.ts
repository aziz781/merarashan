import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __BUILD_VERSION__: JSON.stringify(
      new Date().toISOString().replace(/[-:]/g, "").slice(0, 13)
    ),
    __APP_VERSION_NAME__: JSON.stringify(process.env.APP_VERSION_NAME || "1.0.0"),
    __APP_VERSION_CODE__: JSON.stringify(process.env.APP_VERSION_CODE || "22"),
    __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString()),
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
    mcpPlugin(),
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
          // Offline support: cache GET responses from our Supabase proxy
          // (cards, transactions, statements, customers). NetworkFirst so
          // online users get fresh data; offline users get last-known data.
          {
            urlPattern: ({ url, request }) =>
              request.method === "GET" &&
              url.pathname.includes("/functions/v1/merarashan-proxy"),
            handler: "NetworkFirst",
            options: {
              cacheName: "merarashan-api-cache",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
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
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Conservative vendor splitting. React + jsx-runtime MUST stay
        // together or Capacitor's WebView throws "Invalid hook call" on
        // startup. Router stays with React because it imports hooks at
        // module scope. Everything else is safe to split.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/") ||
            id.includes("/react-router") ||
            id.includes("/@remix-run/router/")
          ) {
            return "react-vendor";
          }
          if (id.includes("/@supabase/")) return "supabase";
          if (
            id.includes("/@tanstack/react-query") ||
            id.includes("/@tanstack/query-core") ||
            id.includes("/@tanstack/query-sync-storage-persister") ||
            id.includes("/@tanstack/react-query-persist-client")
          ) {
            return "query";
          }
          if (id.includes("/@radix-ui/")) return "radix";
          if (id.includes("/lucide-react/")) return "icons";
          return undefined;
        },
      },
    },
  },
}));
