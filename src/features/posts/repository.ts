import type { Db } from "@/db";
import { posts } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

export const findAll = (db: Db) =>
  db.select().from(posts).orderBy(desc(posts.createdAt));

export const findById = (db: Db, id: number) =>
  db.select().from(posts).where(eq(posts.id, id)).get();
