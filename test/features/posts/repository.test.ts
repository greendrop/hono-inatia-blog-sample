import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "../../db";
import type { Db } from "../../../src/db";
import { seedPost } from "../../helpers";
import {
  findAll,
  findById,
} from "../../../src/features/posts/repository";

let db: Db;

beforeEach(async () => {
  db = await createTestDb();
});

describe("posts/repository", () => {
  describe("findAll", () => {
    it("投稿が無い場合は空配列を返す", async () => {
      const result = await findAll(db);
      expect(result).toHaveLength(0);
    });

    it("全件返す", async () => {
      await seedPost(db, { title: "投稿A" });
      await seedPost(db, { title: "投稿B" });

      const result = await findAll(db);
      expect(result).toHaveLength(2);
      const titles = result.map((r) => r.title);
      expect(titles).toContain("投稿A");
      expect(titles).toContain("投稿B");
    });
  });

  describe("findById", () => {
    it("存在する id の投稿を返す", async () => {
      const seeded = await seedPost(db, { title: "取得対象" });

      const result = await findById(db, seeded.id);
      expect(result).toBeDefined();
      expect(result!.title).toBe("取得対象");
    });

    it("存在しない id は undefined を返す", async () => {
      const result = await findById(db, 9999);
      expect(result).toBeUndefined();
    });
  });
});
