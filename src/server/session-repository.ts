import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { EMPTY_UPGRADE_LEVELS } from "@/game/constants";
import { createInitialState } from "@/game/session";
import type { GameState } from "@/game/types";
import type { Database } from "./db/client";
import { type EventType, events, type SessionRow, sessions } from "./db/schema";

/**
 * Идентификатор сессии — непредсказуемый случайный токен, а не подписанные
 * данные. Подделать его нельзя: сервер сверяет наличие строки в базе.
 *
 * `randomBytes` из node:crypto, а не `Math.random`. Запрет на `Math.random`
 * касается игровой логики и её юридической квалификации; криптографическая
 * случайность для идентификаторов — обязательна.
 */
export function generateSessionId(): string {
  return randomBytes(24).toString("base64url");
}

export function rowToState(row: SessionRow): GameState {
  return {
    phase: row.phase,
    grains: row.grains,
    totalGrains: row.totalGrains,
    taps: row.taps,
    upgrades: { ...EMPTY_UPGRADE_LEVELS, ...row.upgrades },
    heat: row.heat,
    tapBudget: row.tapBudget,
    startedAt: row.startedAt,
    endsAt: row.endsAt,
    lastTickAt: row.lastTickAt,
    fixedAt: row.fixedAt,
    fixedDiscount: row.fixedDiscount,
    attempts: row.attempts,
  };
}

export async function findSession(db: Database, id: string): Promise<GameState | null> {
  const rows = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  const row = rows.at(0);
  return row ? rowToState(row) : null;
}

export async function insertSession(db: Database, id: string, now: number): Promise<GameState> {
  const state = createInitialState();
  await db.insert(sessions).values({
    id,
    createdAt: now,
    updatedAt: now,
    phase: state.phase,
    grains: state.grains,
    totalGrains: state.totalGrains,
    taps: state.taps,
    heat: state.heat,
    tapBudget: state.tapBudget,
    upgrades: state.upgrades,
    startedAt: state.startedAt,
    endsAt: state.endsAt,
    lastTickAt: state.lastTickAt,
    fixedAt: state.fixedAt,
    fixedDiscount: state.fixedDiscount,
    attempts: state.attempts,
  });
  return state;
}

export async function saveSession(
  db: Database,
  id: string,
  state: GameState,
  now: number,
): Promise<void> {
  await db
    .update(sessions)
    .set({
      updatedAt: now,
      phase: state.phase,
      grains: state.grains,
      totalGrains: state.totalGrains,
      taps: state.taps,
      heat: state.heat,
      tapBudget: state.tapBudget,
      upgrades: state.upgrades,
      startedAt: state.startedAt,
      endsAt: state.endsAt,
      lastTickAt: state.lastTickAt,
      fixedAt: state.fixedAt,
      fixedDiscount: state.fixedDiscount,
      attempts: state.attempts,
    })
    .where(eq(sessions.id, id));
}

export async function recordEvent(
  db: Database,
  sessionId: string,
  type: EventType,
  state: GameState,
  now: number,
): Promise<void> {
  await db.insert(events).values({
    sessionId,
    type,
    at: now,
    discount: state.fixedDiscount,
    taps: state.taps,
  });
}
