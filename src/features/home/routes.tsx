import { Hono } from "hono";
import type { AppEnv } from "@/shared/env";

const homeRoutes = new Hono<AppEnv>();

homeRoutes.get("/", (c) => c.render("home/Home", { message: "Hono x Inertia" }));

export default homeRoutes;
