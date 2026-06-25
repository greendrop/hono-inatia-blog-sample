import { describe, it, expect, beforeEach } from "vitest";
import { createApp } from "../../../../src/server";
import { createTestDb } from "../../../db";
import { posts } from "../../../../src/db/schema";
import type { Db } from "../../../../src/db";
import type { Post } from "../../../../src/db/schema";
import { inertiaHeaders, type InertiaPage } from "../../../helpers";
import { postFactory } from "../../../factories/post";

let db: Db;
let app: ReturnType<typeof createApp>;
let factory: ReturnType<typeof postFactory>;

beforeEach(async () => {
  db = await createTestDb();
  app = createApp(() => db);
  factory = postFactory(db);
});

describe("admin/posts ルート", () => {
  describe("GET /admin/posts", () => {
    it("200 を返す", async () => {
      const res = await app.request("/admin/posts");
      expect(res.status).toBe(200);
    });

    it("props.posts に全件が含まれる", async () => {
      await factory.createList(2);

      const res = await app.request("/admin/posts", { headers: inertiaHeaders });
      const page = (await res.json()) as InertiaPage<{ posts: Post[] }>;
      expect(page.props.posts).toHaveLength(2);
    });
  });

  describe("GET /admin/posts/new", () => {
    it("200 を返す", async () => {
      const res = await app.request("/admin/posts/new");
      expect(res.status).toBe(200);
    });
  });

  describe("POST /admin/posts", () => {
    it("正しい入力で作成され 303 リダイレクト", async () => {
      const res = await app.request("/admin/posts", {
        method: "POST",
        headers: inertiaHeaders,
        body: JSON.stringify({ title: "テスト投稿", body: "本文です" }),
      });
      expect(res.status).toBe(303);
      expect(res.headers.get("location")).toBe("/admin/posts");

      const all = await db.select().from(posts);
      expect(all).toHaveLength(1);
      expect(all[0].title).toBe("テスト投稿");
    });

    it("タイトル空でバリデーションエラー、保存されない", async () => {
      const res = await app.request("/admin/posts", {
        method: "POST",
        headers: inertiaHeaders,
        body: JSON.stringify({ title: "", body: "本文" }),
      });
      const page = (await res.json()) as InertiaPage<{
        errors?: Record<string, string>;
      }>;
      expect(page.props.errors?.title).toBeTruthy();

      const all = await db.select().from(posts);
      expect(all).toHaveLength(0);
    });

    it("本文が空でバリデーションエラー、保存されない", async () => {
      const res = await app.request("/admin/posts", {
        method: "POST",
        headers: inertiaHeaders,
        body: JSON.stringify({ title: "タイトル", body: "" }),
      });
      const page = (await res.json()) as InertiaPage<{
        errors?: Record<string, string>;
      }>;
      expect(page.props.errors?.body).toBeTruthy();

      const all = await db.select().from(posts);
      expect(all).toHaveLength(0);
    });
  });

  describe("GET /admin/posts/:id/edit", () => {
    it("存在する投稿は 200 を返し props.post が含まれる", async () => {
      const post = await factory.create({ title: "編集対象" });

      const res = await app.request(`/admin/posts/${post.id}/edit`, {
        headers: inertiaHeaders,
      });
      expect(res.status).toBe(200);
      const page = (await res.json()) as InertiaPage<{ post: Post }>;
      expect(page.props.post.title).toBe("編集対象");
    });

    it("存在しない id は 404 を返す", async () => {
      const res = await app.request("/admin/posts/9999/edit");
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /admin/posts/:id", () => {
    it("正しい入力で更新され 303 リダイレクト", async () => {
      const post = await factory.create({ title: "更新前" });

      const res = await app.request(`/admin/posts/${post.id}`, {
        method: "PUT",
        headers: inertiaHeaders,
        body: JSON.stringify({ title: "更新後", body: "更新本文" }),
      });
      expect(res.status).toBe(303);
      expect(res.headers.get("location")).toBe("/admin/posts");

      const all = await db.select().from(posts);
      expect(all[0].title).toBe("更新後");
      expect(all[0].body).toBe("更新本文");
    });

    it("バリデーション失敗で props.errors あり、props.post が再注入され、DB は変わらない", async () => {
      const post = await factory.create({ title: "変更前" });

      const res = await app.request(`/admin/posts/${post.id}`, {
        method: "PUT",
        headers: inertiaHeaders,
        body: JSON.stringify({ title: "", body: "本文" }),
      });
      const page = (await res.json()) as InertiaPage<{
        post?: Post;
        errors?: Record<string, string>;
      }>;
      expect(page.props.errors?.title).toBeTruthy();
      // Edit フォームに表示するため post が再取得されて渡される
      expect(page.props.post?.title).toBe("変更前");

      const all = await db.select().from(posts);
      expect(all[0].title).toBe("変更前");
    });
  });

  describe("DELETE /admin/posts/:id", () => {
    it("削除後 303 リダイレクト、DB から消える", async () => {
      const post = await factory.create();

      const res = await app.request(`/admin/posts/${post.id}`, {
        method: "DELETE",
      });
      expect(res.status).toBe(303);
      expect(res.headers.get("location")).toBe("/admin/posts");

      const all = await db.select().from(posts);
      expect(all).toHaveLength(0);
    });

    it("他の投稿は削除されない", async () => {
      const post1 = await factory.create({ title: "削除対象" });
      await factory.create({ title: "残す投稿" });

      await app.request(`/admin/posts/${post1.id}`, { method: "DELETE" });

      const all = await db.select().from(posts);
      expect(all).toHaveLength(1);
      expect(all[0].title).toBe("残す投稿");
    });
  });
});
