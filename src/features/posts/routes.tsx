import { Hono } from "hono";
import type { AppEnv } from "@/shared/env";
import { listPosts, getPost } from "./service";

const postsRoutes = new Hono<AppEnv>();

postsRoutes
  .get("/", async (c) => {
    const list = await listPosts(c.get("db"));
    return c.render("posts/Index", { posts: list });
  })
  .get("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const post = await getPost(c.get("db"), id);
    if (!post) return c.notFound();
    return c.render("posts/Show", { post });
  });

export default postsRoutes;
