import { defineConfig } from "vite";
import { sourceIdentity } from "./scripts/source-id";

import { feedbackServer } from "./scripts/feedback-server";

export default defineConfig({
  plugins: [feedbackServer()],
  base: "./",
  define: { __BUILD_SOURCE__: JSON.stringify(sourceIdentity()) },
  build: { rollupOptions: { input: { main: "index.html", watch: "watch.html", compare: "compare.html" } } },
});
