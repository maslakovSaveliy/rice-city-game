import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { SessionPhase, UpgradeLevels } from "@/game/types";

/**
 * Игровые сессии. Это авторитетное состояние: клиент только предсказывает,
 * считает всегда сервер.
 *
 * Персональных данных здесь нет намеренно — ни IP, ни user-agent, ни отпечатка
 * устройства. Идентификатор сессии случайный и ни с чем не связан. Это упрощает
 * и политику обработки данных, и жизнь.
 */
export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),

  phase: text("phase").$type<SessionPhase>().notNull(),
  grains: real("grains").notNull(),
  totalGrains: real("total_grains").notNull(),
  tapGrains: real("tap_grains").notNull().default(0),
  taps: integer("taps").notNull(),
  heat: real("heat").notNull(),
  tapBudget: real("tap_budget").notNull(),
  upgrades: text("upgrades", { mode: "json" }).$type<UpgradeLevels>().notNull(),

  startedAt: integer("started_at"),
  endsAt: integer("ends_at"),
  lastTickAt: integer("last_tick_at"),
  fixedAt: integer("fixed_at"),
  fixedDiscount: integer("fixed_discount"),
  attempts: integer("attempts").notNull(),
});

/** Обезличенные события для отчётов: сколько начали, сколько дошли до конца. */
export const events = sqliteTable("events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: text("session_id").notNull(),
  type: text("type").$type<EventType>().notNull(),
  at: integer("at").notNull(),
  discount: integer("discount"),
  taps: integer("taps"),
});

export type EventType = "started" | "finished" | "fixed" | "restarted" | "reset";

export type SessionRow = typeof sessions.$inferSelect;
export type NewSessionRow = typeof sessions.$inferInsert;
