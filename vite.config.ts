import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import dts from "vite-plugin-dts";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    dts({
      insertTypesEntry: true,
    }),
  ],
  build: {
    lib: {
      entry: "src/index.ts",
      name: "@vittelgroup/vwebphone",
      formats: ["es", "cjs", "umd"],
      fileName: (format) => `index.${format}.js`,
    },
  },
});
