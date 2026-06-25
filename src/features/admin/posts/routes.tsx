import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { AppEnv } from "@/shared/env";
import { setFlash, setErrors } from "@/shared/flash";
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
        setErrors(c, toErrors(result.error), result.data as Record<string, unknown>);
        return c.redirect("/admin/posts/new", 303);
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
    zValidator("json", postSchema, (result, c) => {
      if (!result.success) {
        const id = Number(c.req.param("id"));
        setErrors(c, toErrors(result.error), result.data as Record<string, unknown>);
        return c.redirect(`/admin/posts/${id}/edit`, 303);
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
