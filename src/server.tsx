import { Hono } from "hono";
import { inertia } from "@hono/inertia";
import { rootView } from "./root-view";
import { createDb } from "./db";
import { posts } from "./db/schema";
import { desc, eq } from "drizzle-orm";

const app = new Hono<{ Bindings: CloudflareBindings }>();
app.use(inertia({ version: "1", rootView }));

const routes = app
  .get("/", (c) => c.render("Home", { message: "Hono x Inertia" }))
  .get("/posts", async (c) => {
    const db = createDb(c.env.DB);
    const list = await db.select().from(posts).orderBy(desc(posts.createdAt));
    return c.render("Posts/Index", { posts: list });
  })
  .get("/posts/:id", async (c) => {
    const db = createDb(c.env.DB);
    const id = Number(c.req.param("id"));
    const post = await db.select().from(posts).where(eq(posts.id, id)).get();
    if (!post) return c.notFound();
    return c.render("Posts/Show", { post });
  });

export default routes;
