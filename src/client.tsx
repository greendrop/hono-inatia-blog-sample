import "@/style.css";
import { createInertiaApp } from "@ts-76/inertia-hono-jsx";
import { render } from "hono/jsx/dom";
import { resolvePage } from "@/shared/inertia/resolve";

createInertiaApp({
  resolve: async (name) => resolvePage(name),
  setup({ el, App, props }) {
    render(<App {...props} />, el);
  },
});
