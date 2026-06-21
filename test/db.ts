import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "../src/db/schema";
import type { Db } from "../src/db";

export async function createTestDb(): Promise<Db> {
  const client = createClient({ url: ":memory:" }); // 新品のインメモリ
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle/migrations" }); // 本番と同じ migration を適用
  return db;
}
