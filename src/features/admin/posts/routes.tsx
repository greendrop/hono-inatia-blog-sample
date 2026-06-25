import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "@/shared/env";
import { setFlash } from "@/shared/flash";
import { postSchema, toErrors } from "./schema";
import {
  listPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
} from "./service";

const adminPostsRoutes = new Hono<AppEnv>();

adminPostsRoutes
  // 管理一覧
  .get("/", async (c) => {
    const list = await listPosts(c.get("db"));
    return c.render("admin/posts/Index", { posts: list });
  })
  // 新規フォーム
  .get("/new", (c) => c.render("admin/posts/New", {}))
  // 作成
  .post(
    "/",
    zValidator("json", postSchema, (result, c) => {
      if (!result.success) {
        return c.render("admin/posts/New", { errors: toErrors(result.error) });
      }
    }),
    async (c) => {
      await createPost(c.get("db"), c.req.valid("json"));
      setFlash(c, "投稿を作成しました");
      return c.redirect("/admin/posts", 303);
    },
  )
  // 編集フォーム
  .get("/:id/edit", async (c) => {
    const id = Number(c.req.param("id"));
    const post = await getPost(c.get("db"), id);
    if (!post) return c.notFound();
    return c.render("admin/posts/Edit", { post });
  })
  // 更新
  .put(
    "/:id",
    zValidator("json", postSchema, async (result, c) => {
      if (!result.success) {
        // 失敗時、Edit は post prop を必要とするので引き直して渡す
        const id = Number(c.req.param("id"));
        const post = await getPost(c.get("db"), id);
        return c.render("admin/posts/Edit", {
          post,
          errors: toErrors(result.error),
        });
      }
    }),
    async (c) => {
      const id = Number(c.req.param("id"));
      await updatePost(c.get("db"), id, c.req.valid("json"));
      setFlash(c, "投稿を更新しました");
      return c.redirect("/admin/posts", 303);
    },
  )
  // 削除
  .delete("/:id", async (c) => {
    const id = Number(c.req.param("id"));
    await deletePost(c.get("db"), id);
    setFlash(c, "投稿を削除しました");
    return c.redirect("/admin/posts", 303);
  });

export default adminPostsRoutes;
