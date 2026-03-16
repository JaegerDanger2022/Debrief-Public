import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { copyFileSync } from "fs";

// Plugin: copy pcm-processor.js verbatim into dist/ so it can be loaded
// via new URL("./pcm-processor.js", import.meta.url) from the sidepanel.
const copyWorklet = {
  name: "copy-worklet",
  closeBundle() {
    copyFileSync(
      resolve(__dirname, "src/pcm-processor.js"),
      resolve(__dirname, "dist/pcm-processor.js"),
    );
  },
};

export default defineConfig({
  plugins: [react(), copyWorklet],
  root: "src",
  base: "./",
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: { sidepanel: resolve(__dirname, "src/sidepanel.html") },
      output: { entryFileNames: "[name].js", chunkFileNames: "[name].js", assetFileNames: "[name].[ext]" },
    },
  },
});
