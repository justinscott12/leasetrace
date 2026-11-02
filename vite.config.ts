import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Static site: relative base so it works on GitHub Pages under /leasetrace/ or at a root domain.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { outDir: "dist", target: "es2022" },
  server: { port: 5178 },
});
