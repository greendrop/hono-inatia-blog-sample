import { describe, it, expect, beforeEach } from "vitest";
import { createApp } from "../../../src/server";
import { createTestDb } from "../../db";
import type { Db } from "../../../src/db";
import type { Post } from "../../../src/db/schema";
import { inertiaHeaders, type InertiaPage } from "../../helpers";
import { postFactory } from "../../factories/post";

let db: Db;
let app: ReturnType<typeof createApp>;
let factory: ReturnType<typeof postFactory>;

beforeEach(async () => {
  db = await createTestDb();
  app = createApp(() => db);
  factory = postFactory(db);
});

describe("ユーザ画面 /posts", () => {
  describe("GET /posts", () => {
    it("200 を返す", async () => {
      const res = await app.request("/posts");
      expect(res.status).toBe(200);
    });

    it("props.posts に全件が含まれる", async () => {
      await factory.createList(2);

      const res = await app.request("/posts", { headers: inertiaHeaders });
      const page = (await res.json()) as InertiaPage<{ posts: Post[] }>;
      expect(page.props.posts).toHaveLength(2);
    });
  });

  describe("GET /posts/:id", () => {
    it("200 を返し、props.post に該当投稿が入る", async () => {
      const post = await factory.create({ title: "詳細テスト" });

      const res = await app.request(`/posts/${post.id}`, {
        headers: inertiaHeaders,
      });
      expect(res.status).toBe(200);
      const page = (await res.json()) as InertiaPage<{ post: Post }>;
      expect(page.props.post.title).toBe("詳細テスト");
    });

    it("存在しない id は 404 を返す", async () => {
      const res = await app.request("/posts/9999");
      expect(res.status).toBe(404);
    });
  });
});
