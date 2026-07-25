import { describe, expect, it } from "vitest";
import { FIX_LOCK_MS, SESSION_DURATION_MS } from "./constants";
import { startSession } from "./reducer";
import {
  createInitialState,
  isSessionExpired,
  isVisitLocked,
  remainingMs,
  visitUnlocksAt,
} from "./session";

const NOW = 1_700_000_000_000;

describe("createInitialState", () => {
  it("отдаёт чистое состояние без начатой сессии", () => {
    const state = createInitialState();
    expect(state.phase).toBe("idle");
    expect(state.grains).toBe(0);
    expect(state.totalGrains).toBe(0);
    expect(state.taps).toBe(0);
    expect(state.startedAt).toBeNull();
    expect(state.endsAt).toBeNull();
    expect(state.fixedAt).toBeNull();
    expect(state.attempts).toBe(0);
  });

  it("не переиспользует объект улучшений между вызовами", () => {
    expect(createInitialState().upgrades).not.toBe(createInitialState().upgrades);
  });
});

describe("remainingMs", () => {
  it("до старта показывает полный час", () => {
    expect(remainingMs(createInitialState(), NOW)).toBe(SESSION_DURATION_MS);
  });

  it("во время игры уменьшается", () => {
    const state = startSession(createInitialState(), NOW);
    expect(remainingMs(state, NOW)).toBe(SESSION_DURATION_MS);
    expect(remainingMs(state, NOW + 60_000)).toBe(SESSION_DURATION_MS - 60_000);
  });

  it("после конца часа равен нулю и не уходит в минус", () => {
    const state = startSession(createInitialState(), NOW);
    expect(remainingMs(state, NOW + SESSION_DURATION_MS + 10_000)).toBe(0);
  });

  it("в терминальной фазе без endsAt равен нулю", () => {
    const fixed = { ...createInitialState(), phase: "fixed" as const };
    expect(remainingMs(fixed, NOW)).toBe(0);
  });
});

describe("isSessionExpired", () => {
  it("незапущенная сессия не истекает", () => {
    expect(isSessionExpired(createInitialState(), NOW + SESSION_DURATION_MS * 10)).toBe(false);
  });

  it("истекает ровно на границе часа", () => {
    const state = startSession(createInitialState(), NOW);
    expect(isSessionExpired(state, NOW + SESSION_DURATION_MS - 1)).toBe(false);
    expect(isSessionExpired(state, NOW + SESSION_DURATION_MS)).toBe(true);
  });
});

describe("блокировка визита", () => {
  it("без фиксации блокировки нет", () => {
    expect(isVisitLocked(createInitialState(), NOW)).toBe(false);
    expect(visitUnlocksAt(createInitialState())).toBeNull();
  });

  it("держится ровно FIX_LOCK_MS после фиксации", () => {
    const state = { ...createInitialState(), fixedAt: NOW };
    expect(isVisitLocked(state, NOW)).toBe(true);
    expect(isVisitLocked(state, NOW + FIX_LOCK_MS - 1)).toBe(true);
    expect(isVisitLocked(state, NOW + FIX_LOCK_MS)).toBe(false);
    expect(visitUnlocksAt(state)).toBe(NOW + FIX_LOCK_MS);
  });
});
