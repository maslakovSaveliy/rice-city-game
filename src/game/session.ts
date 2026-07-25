import { EMPTY_UPGRADE_LEVELS, FIX_LOCK_MS, SESSION_DURATION_MS, TAP_BURST } from "./constants";
import type { GameState } from "./types";

/**
 * Время в игровое ядро всегда приходит аргументом. `Date.now()` внутри `src/game`
 * запрещён: иначе экономику невозможно детерминированно симулировать и тестировать.
 */

export function createInitialState(): GameState {
  return {
    phase: "idle",
    grains: 0,
    totalGrains: 0,
    taps: 0,
    upgrades: { ...EMPTY_UPGRADE_LEVELS },
    heat: 0,
    tapBudget: TAP_BURST,
    startedAt: null,
    endsAt: null,
    lastTickAt: null,
    fixedAt: null,
    fixedDiscount: null,
    attempts: 0,
  };
}

/** Сколько миллисекунд осталось до конца часа. Ноль, если сессия не идёт. */
export function remainingMs(state: GameState, now: number): number {
  if (state.endsAt === null) {
    return state.phase === "idle" ? SESSION_DURATION_MS : 0;
  }
  return Math.max(0, state.endsAt - now);
}

/**
 * Час считается по стенным часам и продолжает идти, даже если гость закрыл
 * браузер. Это осознанное правило: одна игра на один поход в заведение.
 */
export function isSessionExpired(state: GameState, now: number): boolean {
  return state.endsAt !== null && now >= state.endsAt;
}

/**
 * После фиксации скидки игра закрыта на шесть часов. Авторизации нет, поэтому
 * это единственный доступный способ отличить новый визит от того же самого.
 */
export function isVisitLocked(state: GameState, now: number): boolean {
  if (state.fixedAt === null) {
    return false;
  }
  return now - state.fixedAt < FIX_LOCK_MS;
}

export function visitUnlocksAt(state: GameState): number | null {
  return state.fixedAt === null ? null : state.fixedAt + FIX_LOCK_MS;
}
