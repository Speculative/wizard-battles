import { readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import { sourceIdentity } from "./scripts/source-id";

import { feedbackServer } from "./scripts/feedback-server";

export default defineConfig({
  plugins: [feedbackServer(), {
    name: "experiment-metadata-coverage",
    configResolved(config) {
      for (const entry of readdirSync(resolve(config.root, "public/experiments"), { withFileTypes: true })) {
        if (entry.isDirectory() && !existsSync(resolve(config.root, "src/experiments", `${entry.name}.ts`))) {
          throw new Error(`Published experiment ${entry.name} needs typed metadata in src/experiments/${entry.name}.ts`);
        }
      }
    },
  }],
  base: "./",
  define: { __BUILD_SOURCE__: JSON.stringify(sourceIdentity()) },
  build: { rollupOptions: { input: { main: "index.html", watch: "watch.html", compare: "compare.html" } } },
});
