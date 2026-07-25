import "server-only";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * Одно соединение на процесс. Next в разработке перезагружает модули, поэтому
 * клиент кладётся в globalThis — иначе на каждом hot reload открывается новый
 * дескриптор файла базы.
 */
const globalForDb = globalThis as unknown as {
  rcDbClient?: ReturnType<typeof createClient>;
};

const client = globalForDb.rcDbClient ?? createClient({ url: env.DATABASE_URL });

if (env.NODE_ENV !== "production") {
  globalForDb.rcDbClient = client;
}

export const db = drizzle(client, { schema });
export type Database = typeof db;

/**
 * Поднимает схему, если её ещё нет.
 *
 * На своём сервере это лишнее: там перед стартом выполняется `pnpm db:migrate`,
 * и первый же вызов увидит готовую базу. Нужно это для бессерверного хостинга,
 * где отдельного шага деплоя просто нет, а файл базы живёт во временном
 * каталоге и исчезает вместе с инстансом.
 *
 * Обещание кладётся в модульную переменную: параллельные запросы в одном
 * процессе должны ждать одну миграцию, а не запускать по своей.
 */
let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  schemaReady ??= migrate(db, { migrationsFolder: "./drizzle" });
  return schemaReady;
}
