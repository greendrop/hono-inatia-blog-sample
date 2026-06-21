import { Hono } from "hono";
import { inertia } from "@hono/inertia";
import { rootView } from "./root-view";
import { createDb, type Db } from "./db";
import { posts } from "./db/schema";
import { desc, eq } from "drizzle-orm";
import adminPosts from "./routes/admin/posts";
import { flash } from "./flash";

type Env = {
  Bindings: CloudflareBindings;
  Variables: { db: Db };
};

// dbProvider 省略時は D1 から。テストではインメモリ libsql を渡す。
export function createApp(dbProvider?: (c: any) => Db) {
  const app = new Hono<Env>();

  app.use(inertia({ version: "1", rootView }));
  app.use(flash());
  app.use(async (c, next) => {
    c.set("db", dbProvider ? dbProvider(c) : createDb(c.env.DB));
    await next();
  });

  const routes = app
    .get("/", (c) => c.render("Home", { message: "Hono x Inertia" }))
    .get("/posts", async (c) => {
      const list = await c
        .get("db")
        .select()
        .from(posts)
        .orderBy(desc(posts.createdAt));
      return c.render("Posts/Index", { posts: list });
    })
    .get("/posts/:id", async (c) => {
      const id = Number(c.req.param("id"));
      const post = await c
        .get("db")
        .select()
        .from(posts)
        .where(eq(posts.id, id))
        .get();
      if (!post) return c.notFound();
      return c.render("Posts/Show", { post });
    })
    .route("/admin/posts", adminPosts);

  return app;
}

export default createApp();
