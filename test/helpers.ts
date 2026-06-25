import { desc } from "drizzle-orm";
import { posts } from "../src/db/schema";
import type { Db } from "../src/db";
import type { Post } from "../src/db/schema";

/**
 * GET リクエストで Inertia JSON レスポンスを得るためのヘッダ。
 * POST/PUT の JSON body を伴うリクエストにも Content-Type を加えて使用する。
 */
export const inertiaHeaders = {
  "Content-Type": "application/json",
  "X-Inertia": "true",
  "X-Inertia-Version": "1",
};

/** Inertia JSON レスポンスの型 */
export type InertiaPage<P = Record<string, unknown>> = {
  component: string;
  props: P & { flash?: string | null };
  url: string;
  version: string;
};

/**
 * テスト用に posts を 1 件挿入して返す。
 * デフォルトは最小限の有効データ。overrides でフィールドを上書きできる。
 */
export async function seedPost(
  db: Db,
  overrides: { title?: string; body?: string } = {},
): Promise<Post> {
  await db
    .insert(posts)
    .values({ title: "テスト投稿", body: "本文です", ...overrides });
  const all = await db.select().from(posts).orderBy(desc(posts.id));
  return all[0];
}
