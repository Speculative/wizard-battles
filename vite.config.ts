import { defineConfig } from "vite";
import { sourceIdentity } from "./scripts/source-id";

export default defineConfig({
  base: "./",
  define: { __BUILD_SOURCE__: JSON.stringify(sourceIdentity()) },
  build: { rollupOptions: { input: { main: "index.html", compare: "compare.html" } } },
});
