import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // サーバ側モジュールは .tsx 拡張子だが JSX 構文は含まないので念のため設定
  esbuild: { jsx: "automatic", jsxImportSource: "hono/jsx" },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
