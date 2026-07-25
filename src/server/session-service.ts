import { applyTapBatch } from "@/game/batch";
import { type PublicGameState, toPublicState } from "@/game/public-state";
import {
  advance,
  finishSession,
  fixDiscount,
  purchase,
  restartSession,
  startSession,
} from "@/game/reducer";
import type { GameState, UpgradeId } from "@/game/types";
import type { Database } from "./db/client";
import type { EventType } from "./db/schema";
import { withSessionLock } from "./session-lock";
import {
  findSession,
  generateSessionId,
  insertSession,
  recordEvent,
  saveSession,
} from "./session-repository";

export type SessionAction =
  | { readonly type: "start" }
  | { readonly type: "tap"; readonly taps: number }
  | { readonly type: "upgrade"; readonly id: UpgradeId }
  | { readonly type: "finish" }
  | { readonly type: "fix" }
  | { readonly type: "restart" };

/**
 * Сервер — единственный источник истины.
 *
 * Клиент присылает только намерение («я натапал N раз»), а не результат.
 * Время берётся серверное: клиентские часы не участвуют в расчётах вообще,
 * поэтому перевод времени на телефоне ничего не даёт.
 */

export async function createSession(
  db: Database,
  now: number,
): Promise<{ id: string; view: PublicGameState }> {
  const id = generateSessionId();
  const state = await insertSession(db, id, now);
  return { id, view: toPublicState(state, now) };
}

export async function readSession(
  db: Database,
  id: string,
  now: number,
): Promise<PublicGameState | null> {
  return withSessionLock(id, async () => {
    const stored = await findSession(db, id);
    if (!stored) {
      return null;
    }

    // Даже на чтении время двигаем: иначе истёкший час не переключится в
    // результат, пока гость не сделает действие.
    const advanced = advance(stored, now);
    if (advanced !== stored) {
      await saveSession(db, id, advanced, now);
      await recordTransition(db, id, stored, advanced, now);
    }

    return toPublicState(advanced, now);
  });
}

export async function applyAction(
  db: Database,
  id: string,
  action: SessionAction,
  now: number,
): Promise<PublicGameState | null> {
  return withSessionLock(id, async () => {
    const stored = await findSession(db, id);
    if (!stored) {
      return null;
    }

    const next = reduce(stored, action, now);
    await saveSession(db, id, next, now);
    await recordTransition(db, id, stored, next, now);

    return toPublicState(next, now);
  });
}

function reduce(state: GameState, action: SessionAction, now: number): GameState {
  switch (action.type) {
    case "start":
      return startSession(state, now);
    case "tap":
      return applyTapBatch(state, action.taps, now);
    case "upgrade":
      return purchase(advance(state, now), action.id);
    case "finish":
      return finishSession(advance(state, now), now);
    case "fix":
      return fixDiscount(advance(state, now), now);
    case "restart":
      return restartSession(advance(state, now), now);
  }
}

/** Пишет событие только когда фаза действительно сменилась. */
async function recordTransition(
  db: Database,
  id: string,
  before: GameState,
  after: GameState,
  now: number,
): Promise<void> {
  if (before.phase === after.phase && before.attempts === after.attempts) {
    return;
  }

  const type = eventTypeFor(before, after);
  if (type) {
    await recordEvent(db, id, type, after, now);
  }
}

function eventTypeFor(before: GameState, after: GameState): EventType | null {
  if (after.attempts > before.attempts) {
    return "restarted";
  }
  if (before.phase === "idle" && after.phase === "playing") {
    return "started";
  }
  if (after.phase === "result") {
    return "finished";
  }
  if (after.phase === "fixed") {
    return "fixed";
  }
  return null;
}
