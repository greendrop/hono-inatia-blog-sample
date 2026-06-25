import { createInertiaApp } from "@ts-76/inertia-hono-jsx";
import { renderToString } from "hono/jsx/dom/server";
import type { PageObject } from "@hono/inertia";
import { resolvePage } from "./resolve";

export async function render(page: PageObject) {
  return createInertiaApp({
    page: page as any,
    resolve: async (name: string) => resolvePage(name),
    render: renderToString, // hono/jsx/dom/server の renderToString
  });
}
