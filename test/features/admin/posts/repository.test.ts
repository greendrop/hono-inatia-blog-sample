import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "../../../db";
import type { Db } from "../../../../src/db";
import { postFactory } from "../../../factories/post";
import {
  findAll,
  findById,
  create,
  update,
  remove,
} from "../../../../src/features/admin/posts/repository";

let db: Db;
let factory: ReturnType<typeof postFactory>;

beforeEach(async () => {
  db = await createTestDb();
  factory = postFactory(db);
});

describe("admin/posts/repository", () => {
  describe("findAll", () => {
    it("投稿が無い場合は空配列を返す", async () => {
      const result = await findAll(db);
      expect(result).toHaveLength(0);
    });

    it("全件返す", async () => {
      await factory.create({ title: "投稿A" });
      await factory.create({ title: "投稿B" });

      const result = await findAll(db);
      expect(result).toHaveLength(2);
      const titles = result.map((r) => r.title);
      expect(titles).toContain("投稿A");
      expect(titles).toContain("投稿B");
    });
  });

  describe("findById", () => {
    it("存在する id の投稿を返す", async () => {
      const seeded = await factory.create({ title: "取得対象" });

      const result = await findById(db, seeded.id);
      expect(result).toBeDefined();
      expect(result!.title).toBe("取得対象");
    });

    it("存在しない id は undefined を返す", async () => {
      const result = await findById(db, 9999);
      expect(result).toBeUndefined();
    });
  });

  describe("create", () => {
    it("投稿が 1 件増え、値が保存される", async () => {
      await create(db, { title: "新規投稿", body: "本文" });

      const all = await findAll(db);
      expect(all).toHaveLength(1);
      expect(all[0].title).toBe("新規投稿");
      expect(all[0].body).toBe("本文");
    });

    it("複数件作成できる", async () => {
      await create(db, { title: "投稿1", body: "本文1" });
      await create(db, { title: "投稿2", body: "本文2" });

      const all = await findAll(db);
      expect(all).toHaveLength(2);
    });
  });

  describe("update", () => {
    it("title と body が更新される", async () => {
      const seeded = await factory.create({ title: "更新前", body: "旧本文" });

      await update(db, seeded.id, { title: "更新後", body: "新本文" });

      const updated = await findById(db, seeded.id);
      expect(updated!.title).toBe("更新後");
      expect(updated!.body).toBe("新本文");
    });

    it("他の投稿には影響しない", async () => {
      const post1 = await factory.create({ title: "投稿1" });
      const post2 = await factory.create({ title: "投稿2" });

      await update(db, post1.id, { title: "投稿1更新", body: "本文" });

      const unchanged = await findById(db, post2.id);
      expect(unchanged!.title).toBe("投稿2");
    });
  });

  describe("remove", () => {
    it("対象投稿が削除される", async () => {
      const seeded = await factory.create();

      await remove(db, seeded.id);

      const result = await findById(db, seeded.id);
      expect(result).toBeUndefined();
    });

    it("他の投稿には影響しない", async () => {
      const post1 = await factory.create({ title: "削除対象" });
      await factory.create({ title: "残す投稿" });

      await remove(db, post1.id);

      const all = await findAll(db);
      expect(all).toHaveLength(1);
      expect(all[0].title).toBe("残す投稿");
    });
  });
});
