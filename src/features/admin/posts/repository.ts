import type { Db } from "@/db";
import { posts } from "@/db/schema";
import { sql, desc, eq } from "drizzle-orm";
import type { PostInput } from "./schema";

export const findAll = (db: Db) =>
  db.select().from(posts).orderBy(desc(posts.createdAt));

export const findById = (db: Db, id: number) =>
  db.select().from(posts).where(eq(posts.id, id)).get();

export const create = (db: Db, input: PostInput) =>
  db.insert(posts).values(input);

export const update = (db: Db, id: number, input: PostInput) =>
  db
    .update(posts)
    .set({ ...input, updatedAt: sql`(current_timestamp)` })
    .where(eq(posts.id, id));

export const remove = (db: Db, id: number) =>
  db.delete(posts).where(eq(posts.id, id));
