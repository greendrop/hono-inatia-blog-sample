import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { sql, desc, eq } from "drizzle-orm";
import type { Db } from "../../db";
import { posts } from "../../db/schema";
import { setFlash } from "../../flash";

const postSchema = z.object({
  title: z
    .string()
    .min(1, "タイトルは必須です")
    .max(120, "タイトルは120文字以内です"),
  body: z.string().min(1, "本文は必須です"),
});

// ZodError → Inertia の errors prop ( { field: message } )
const toErrors = (err: z.ZodError) => {
  const errors: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "form");
    errors[key] ??= issue.message;
  }
  return errors;
};

const adminPosts = new Hono<{
  Bindings: CloudflareBindings;
  Variables: { db: Db };
}>();

adminPosts
  // 管理一覧
  .get("/", async (c) => {
    const db = c.get("db");
    const list = await db.select().from(posts).orderBy(desc(posts.createdAt));
    return c.render("Admin/Posts/Index", { posts: list });
  })
  // 新規フォーム
  .get("/new", (c) => c.render("Admin/Posts/New", {}))
  // 作成
  .post(
    "/",
    zValidator("json", postSchema, (result, c) => {
      // 'form' → 'json'
      if (!result.success) {
        return c.render("Admin/Posts/New", { errors: toErrors(result.error) });
      }
    }),
    async (c) => {
      const { title, body } = c.req.valid("json"); // 'form' → 'json'
      const db = c.get("db");
      await db.insert(posts).values({ title, body });
      setFlash(c, "投稿を作成しました");
      return c.redirect("/admin/posts", 303);
    },
  )
  // 編集フォーム
  .get("/:id/edit", async (c) => {
    const db = c.get("db");
    const id = Number(c.req.param("id"));
    const post = await db.select().from(posts).where(eq(posts.id, id)).get();
    if (!post) return c.notFound();
    return c.render("Admin/Posts/Edit", { post });
  })
  // 更新
  .put(
    "/:id",
    zValidator("json", postSchema, async (result, c) => {
      if (!result.success) {
        // 失敗時、Edit は post prop を必要とするので引き直して渡す
        const db = c.get("db");
        const id = Number(c.req.param("id"));
        const post = await db
          .select()
          .from(posts)
          .where(eq(posts.id, id))
          .get();
        return c.render("Admin/Posts/Edit", {
          post,
          errors: toErrors(result.error),
        });
      }
    }),
    async (c) => {
      const { title, body } = c.req.valid("json");
      const db = c.get("db");
      const id = Number(c.req.param("id"));
      await db
        .update(posts)
        .set({ title, body, updatedAt: sql`(current_timestamp)` })
        .where(eq(posts.id, id));
      setFlash(c, "投稿を更新しました");
      return c.redirect("/admin/posts", 303);
    },
  )
  // 削除
  .delete("/:id", async (c) => {
    const db = c.get("db");
    const id = Number(c.req.param("id"));
    await db.delete(posts).where(eq(posts.id, id));
    setFlash(c, "投稿を削除しました");
    return c.redirect("/admin/posts", 303);
  });

export default adminPosts;
