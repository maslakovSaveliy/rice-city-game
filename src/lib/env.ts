import "server-only";
import { z } from "zod";

/**
 * Переменные окружения валидируются один раз при старте. Приложение должно
 * падать сразу и громко, а не через час работы на первом запросе к базе.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  /** Строка подключения libsql. Для локального файла нужен префикс `file:`. */
  DATABASE_URL: z
    .string()
    .min(1)
    .startsWith("file:", "Локальная база указывается как file:./data/app.db")
    .default("file:./data/app.db"),
  /** Публичный адрес игры. Нужен для CSP, canonical и текста правил акции. */
  SITE_URL: z.url().default("http://localhost:3000"),
});

const parsed = serverEnvSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = z.prettifyError(parsed.error);
  throw new Error(`Некорректные переменные окружения:\n${issues}`);
}

export const env = parsed.data;
export type ServerEnv = typeof env;
