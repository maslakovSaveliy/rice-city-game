import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import type { Database } from "./client";
import * as schema from "./schema";

/**
 * База в памяти со свежей схемой. Прогоняются настоящие миграции, а не
 * отдельный DDL для тестов — иначе тесты зелёные, а продакшен падает на
 * расхождении схемы.
 */
export async function createTestDatabase(): Promise<Database> {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });
  return db;
}
