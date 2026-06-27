import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [],
      manifest: {
        name: "DuctManage — MVAC Air Duct Progress",
        short_name: "DuctManage",
        description: "Record MVAC air-duct installation progress on drawings (local-first).",
        theme_color: "#0B2545",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "any",
        icons: [],
      },
      workbox: {
        // PDFs and the app shell are cached for offline use; large by design.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      },
    }),
  ],
  worker: { format: "es" },
  // react-konva pulls react-reconciler; force a single React instance to avoid
  // "Invalid hook call / more than one copy of React".
  resolve: { dedupe: ["react", "react-dom"] },
  optimizeDeps: { include: ["react", "react-dom", "react/jsx-runtime", "react-konva"] },
});
