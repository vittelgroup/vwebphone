import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import dts from "vite-plugin-dts";
import mkcert from "vite-plugin-mkcert";

// https://vitejs.dev/config/
export default defineConfig({
  root: "./src/example",
  publicDir: "./src/example",
  plugins: [
    vue(),
    mkcert({
      autoUpgrade: true,
      hosts: ["localhost", "127.0.0.1"],
    }),
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
