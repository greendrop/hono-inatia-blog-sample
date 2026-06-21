import { describe, it, expect, beforeEach } from "vitest";
import { createApp } from "../src/server";
import { createTestDb } from "./db";
import { posts } from "../src/db/schema";
import type { Db } from "../src/db";

let db: Db;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  db = await createTestDb(); // 毎テスト、新品のインメモリDB
  app = createApp(() => db); // そのDBを注入したアプリ（c.env 不要）
});

const inertiaHeaders = {
  "Content-Type": "application/json",
  "X-Inertia": "true",
  "X-Inertia-Version": "1",
};

describe("ユーザ画面", () => {
  it("GET /posts は 200", async () => {
    const res = await app.request("/posts"); // env を渡さなくてよい
    expect(res.status).toBe(200);
  });
});

describe("管理 CRUD：作成", () => {
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
    const page = (await res.json()) as {
      props: { errors?: Record<string, string> };
    };
    expect(page.props.errors?.title).toBeTruthy();

    const all = await db.select().from(posts);
    expect(all).toHaveLength(0);
  });
});
