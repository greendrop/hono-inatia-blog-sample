import { defineConfig } from "vitest/config";

export default defineConfig({
  // サーバ側モジュールは .tsx 拡張子だが JSX 構文は含まないので念のため設定
  esbuild: { jsx: "automatic", jsxImportSource: "hono/jsx" },
});
