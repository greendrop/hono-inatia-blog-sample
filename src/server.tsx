import { Hono } from "hono";
import { inertia } from "@hono/inertia";
import { rootView } from "./root-view";

const app = new Hono();
app.use(inertia({ version: "1", rootView }));

const routes = app
  .get("/", (c) => c.render("Home", { message: "Hono x Inertia" }))
  .get("/about", (c) => c.render("About", {}));

export default routes;
