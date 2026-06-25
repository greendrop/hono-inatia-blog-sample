import { Factory } from "fishery";
import { faker } from "@faker-js/faker";
import { posts } from "../../src/db/schema";
import type { Db } from "../../src/db";
import type { NewPost, Post } from "../../src/db/schema";

/**
 * posts ファクトリ。
 * db はテストごとに作り直されるため、引数で受け取る。
 *
 * @example
 * const factory = postFactory(db);
 * const post  = await factory.create();                    // 1 件挿入
 * const posts = await factory.createList(3);              // 3 件挿入
 * const attrs = factory.build({ title: "上書き" });       // 未挿入の属性オブジェクト
 */
export const postFactory = (db: Db) =>
  Factory.define<NewPost, unknown, Post>(({ sequence, onCreate }) => {
    onCreate(async (attrs) => {
      const [row] = await db.insert(posts).values(attrs).returning();
      return row;
    });

    return {
      title: `投稿${sequence}`,
      body: faker.lorem.paragraph(),
    };
  });
