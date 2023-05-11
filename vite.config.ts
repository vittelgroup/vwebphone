import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    lib: {
      entry: "src/index.ts",
      name: "@vittelgroup/vwebphone",
      formats: ["es", "cjs", "umd"],
      fileName: (format) => `index.${format}.js`,
    },
  },
});
