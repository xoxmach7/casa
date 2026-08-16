import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Тяжёлые библиотеки — в отдельные кэшируемые чанки, чтобы они не
    // раздували чанк первого экрана и переживали редеплои (долгий кэш).
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("recharts") || id.includes("/d3-")) return "charts";
          if (id.includes("leaflet")) return "maps";
          if (id.includes("framer-motion")) return "motion";
          if (
            id.includes("react-dom") ||
            id.includes("react-router") ||
            id.includes("@tanstack")
          ) {
            return "react-vendor";
          }
          return undefined;
        },
      },
    },
  },
}));
