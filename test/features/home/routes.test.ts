import { describe, it, expect, beforeEach } from "vitest";
import { createApp } from "../../../src/server";
import { createTestDb } from "../../db";
import type { Db } from "../../../src/db";
import { inertiaHeaders, type InertiaPage } from "../../helpers";

let db: Db;
let app: ReturnType<typeof createApp>;

beforeEach(async () => {
  db = await createTestDb();
  app = createApp(() => db);
});

describe("home", () => {
  it("GET / は 200 を返す", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
  });

  it("GET / の Inertia props に message が含まれる", async () => {
    const res = await app.request("/", { headers: inertiaHeaders });
    const page = (await res.json()) as InertiaPage<{ message: string }>;
    expect(page.props.message).toBe("Hono x Inertia");
  });
});
