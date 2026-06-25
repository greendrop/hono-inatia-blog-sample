import { describe, it, expect } from "vitest";
import {
  postSchema,
  toErrors,
} from "../../../../src/features/admin/posts/schema";

describe("admin/posts/schema", () => {
  describe("postSchema", () => {
    it("有効な入力は成功する", () => {
      const result = postSchema.safeParse({ title: "タイトル", body: "本文" });
      expect(result.success).toBe(true);
    });

    it("title が空文字はエラー", () => {
      const result = postSchema.safeParse({ title: "", body: "本文" });
      expect(result.success).toBe(false);
    });

    it("title が 121 文字はエラー", () => {
      const result = postSchema.safeParse({
        title: "あ".repeat(121),
        body: "本文",
      });
      expect(result.success).toBe(false);
    });

    it("title が 120 文字はOK", () => {
      const result = postSchema.safeParse({
        title: "あ".repeat(120),
        body: "本文",
      });
      expect(result.success).toBe(true);
    });

    it("body が空文字はエラー", () => {
      const result = postSchema.safeParse({ title: "タイトル", body: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("toErrors", () => {
    it("ZodError を { field: message } に変換する", () => {
      const result = postSchema.safeParse({ title: "", body: "" });
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = toErrors(result.error);
        expect(errors.title).toBe("タイトルは必須です");
        expect(errors.body).toBe("本文は必須です");
      }
    });

    it("エラーの無いフィールドはキーが含まれない", () => {
      const result = postSchema.safeParse({ title: "", body: "本文あり" });
      expect(result.success).toBe(false);
      if (!result.success) {
        const errors = toErrors(result.error);
        expect(errors.title).toBeTruthy();
        expect(errors.body).toBeUndefined();
      }
    });
  });
});
