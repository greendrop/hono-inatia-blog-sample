import { Hono } from "hono";
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

  return app;
}

export default createApp();
