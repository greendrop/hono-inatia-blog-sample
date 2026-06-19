import "./style.css";
import "preline";
import { createInertiaApp } from "@ts-76/inertia-hono-jsx";
import { render } from "hono/jsx/dom";

createInertiaApp({
  resolve: async (name) => {
    const pages = import.meta.glob("./pages/**/*.tsx");
    const page = await pages[`./pages/${name}.tsx`]();
    return (page as { default: unknown }).default;
  },
  setup({ el, App, props }) {
    render(<App {...props} />, el);
  },
});
