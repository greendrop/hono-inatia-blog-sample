import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { inertia } from "@hono/inertia";
import { createDb, type Db } from "./db";
import { flash } from "@/shared/flash";
import { rootView } from "@/shared/inertia/root-view";
import type { AppEnv } from "@/shared/env";
import homeRoutes from "@/features/home/routes";
import postsRoutes from "@/features/posts/routes";
import adminPostsRoutes from "@/features/admin/posts/routes";

// dbProvider 省略時は D1 から。テストではインメモリ libsql を渡す。
export function createApp(dbProvider?: (c: any) => Db) {
  const app = new Hono<AppEnv>();

  app.use(inertia({ version: "1", rootView }));
  app.use(flash());
  app.use(async (c, next) => {
    c.set("db", dbProvider ? dbProvider(c) : createDb(c.env.DB));
    await next();
  });

  app
    .route("/", homeRoutes)
    .route("/posts", postsRoutes)
    .route("/admin/posts", adminPostsRoutes);

  app.notFound((c) => {
    c.status(404);
    return c.render("errors/NotFound");
  });

  const ERROR_PAGES: Record<number, string> = {
    400: "errors/BadRequest",
    403: "errors/Forbidden",
    404: "errors/NotFound",
    500: "errors/ServerError",
  };

  app.onError((err, c) => {
    const status = err instanceof HTTPException ? err.status : 500;
    c.status(status);
    const page = ERROR_PAGES[status];
    if (page) return c.render(page);
    return c.render("errors/Error", { status });
  });

  return app;
}

export default createApp();
