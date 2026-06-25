import { describe, it, expect, beforeEach } from "vitest";
import { HTTPException } from "hono/http-exception";
import { createApp } from "../../../src/server";
import { createTestDb } from "../../db";
import type { Db } from "../../../src/db";
import { inertiaHeaders, type InertiaPage } from "../../helpers";

let db: Db;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  db = await createTestDb();
  app = createApp(() => db);

  // onError のテスト用にダミールートを後付け登録
  app.get("/__boom500", () => {
    throw new Error("boom");
  });
  app.get("/__boom400", () => {
    throw new HTTPException(400);
  });
  app.get("/__boom403", () => {
    throw new HTTPException(403);
  });
  app.get("/__boom503", () => {
    throw new HTTPException(503);
  });
});

describe("エラーページ", () => {
  describe("404 Not Found", () => {
    it("未定義パスは 404 を返す", async () => {
      const res = await app.request("/this-does-not-exist");
      expect(res.status).toBe(404);
    });

    it("未定義パスは errors/NotFound を描画する", async () => {
      const res = await app.request("/this-does-not-exist", {
        headers: inertiaHeaders,
      });
      const page = (await res.json()) as InertiaPage;
      expect(page.component).toBe("errors/NotFound");
    });

    it("存在しない記事 id も 404 かつ errors/NotFound を描画する（回帰）", async () => {
      const res = await app.request("/posts/9999", {
        headers: inertiaHeaders,
      });
      expect(res.status).toBe(404);
      const page = (await res.json()) as InertiaPage;
      expect(page.component).toBe("errors/NotFound");
    });
  });

  describe("500 Server Error", () => {
    it("未知の例外は 500 を返す", async () => {
      const res = await app.request("/__boom500");
      expect(res.status).toBe(500);
    });

    it("未知の例外は errors/ServerError を描画する", async () => {
      const res = await app.request("/__boom500", {
        headers: inertiaHeaders,
      });
      const page = (await res.json()) as InertiaPage;
      expect(page.component).toBe("errors/ServerError");
    });
  });

  describe("400 Bad Request", () => {
    it("HTTPException(400) は 400 を返す", async () => {
      const res = await app.request("/__boom400");
      expect(res.status).toBe(400);
    });

    it("HTTPException(400) は errors/BadRequest を描画する", async () => {
      const res = await app.request("/__boom400", {
        headers: inertiaHeaders,
      });
      const page = (await res.json()) as InertiaPage;
      expect(page.component).toBe("errors/BadRequest");
    });
  });

  describe("403 Forbidden", () => {
    it("HTTPException(403) は 403 を返す", async () => {
      const res = await app.request("/__boom403");
      expect(res.status).toBe(403);
    });

    it("HTTPException(403) は errors/Forbidden を描画する", async () => {
      const res = await app.request("/__boom403", {
        headers: inertiaHeaders,
      });
      const page = (await res.json()) as InertiaPage;
      expect(page.component).toBe("errors/Forbidden");
    });
  });

  describe("その他 (共通エラーページ)", () => {
    it("HTTPException(503) は 503 を返す", async () => {
      const res = await app.request("/__boom503");
      expect(res.status).toBe(503);
    });

    it("HTTPException(503) は errors/Error を描画し status プロップを持つ", async () => {
      const res = await app.request("/__boom503", {
        headers: inertiaHeaders,
      });
      const page = (await res.json()) as InertiaPage<{ status: number }>;
      expect(page.component).toBe("errors/Error");
      expect(page.props.status).toBe(503);
    });
  });
});
