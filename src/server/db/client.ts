import "server-only";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
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
