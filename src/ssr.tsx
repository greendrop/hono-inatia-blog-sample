import { createInertiaApp } from "@ts-76/inertia-hono-jsx";
import { renderToString } from "hono/jsx/dom/server";
import type { PageObject } from "@hono/inertia";

export async function render(page: PageObject) {
  return createInertiaApp({
    page: page as any,
    // クライアントと同じ解決ロジック（pages/ 配下）
    resolve: async (name: string) => {
      const pages = import.meta.glob("./pages/**/*.tsx");
      const mod = (await pages[`./pages/${name}.tsx`]()) as {
        default: unknown;
      };
      return mod.default;
    },
    render: renderToString, // hono/jsx/dom/server の renderToString
  });
}
