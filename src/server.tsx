import { Hono } from "hono";
import { inertia } from "@hono/inertia";
import { rootView } from "./root-view";
import { createDb } from "./db";
import { posts } from "./db/schema";

const app = new Hono<{ Bindings: CloudflareBindings }>(); // ←手順7で確認した名前に合わせる
app.use(inertia({ version: "1", rootView }));

const routes = app
  .get("/", (c) => c.render("Home", { message: "Hono x Inertia" }))
  // 動作確認用（Phase 5 で消す）
  .get("/api/posts", async (c) => {
    const db = createDb(c.env.DB);
    return c.json(await db.select().from(posts).all());
  });

export default routes;
