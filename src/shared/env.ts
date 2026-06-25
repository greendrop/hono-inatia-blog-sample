import type { Db } from "@/db";

export type AppEnv = {
  Bindings: CloudflareBindings;
  Variables: { db: Db };
};
