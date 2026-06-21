import { drizzle } from "drizzle-orm/d1";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import * as schema from "./schema";

// D1版・libsql版どちらの drizzle インスタンスもこの型に代入できる（検証済み）
export type Db = BaseSQLiteDatabase<"async", any, typeof schema>;

export const createDb = (d1: D1Database): Db => drizzle(d1, { schema });
