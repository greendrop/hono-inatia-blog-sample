import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as schema from "../src/db/schema";
import type { Db } from "../src/db";

const MIGRATIONS_DIR = new URL("../atlas/migrations", import.meta.url).pathname;

export async function createTestDb(): Promise<Db> {
  const client = createClient({ url: ":memory:" }); // 新品のインメモリ
  // Atlas が生成した SQL を名前順（タイムスタンプ昇順）に流す
  for (const f of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    await client.executeMultiple(readFileSync(join(MIGRATIONS_DIR, f), "utf8"));
  }
  return drizzle(client, { schema });
}
