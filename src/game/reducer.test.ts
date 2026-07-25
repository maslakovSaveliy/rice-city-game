import { describe, expect, it } from "vitest";
import {
  BASE_TAP_VALUE,
  HEAT_DECAY_PER_SEC,
  HEAT_MAX,
  HEAT_PER_TAP,
  MAX_ADVANCE_DT_MS,
  SESSION_DURATION_MS,
  TAP_BURST,
} from "./constants";
import { discountFromGrains, getUpgrade, grainsForDiscount, upgradeCost } from "./economy";
import {
  advance,
  finishSession,
  fixDiscount,
  purchase,
  registerTap,
  resetSession,
  restartSession,
  resumeAfterHidden,
  startSession,
} from "./reducer";
import { createInitialState, isVisitLocked } from "./session";
import type { GameState } from "./types";

const NOW = 1_700_000_000_000;

const playing = (overrides: Partial<GameState> = {}): GameState => ({
  ...startSession(createInitialState(), NOW),
  ...overrides,
});

/** Много тапов подряд в одну и ту же миллисекунду времени. */
const tapTimes = (state: GameState, times: number, at: number): GameState => {
  let next = state;
  for (let i = 0; i < times; i += 1) {
    next = registerTap(next, at);
  }
  return next;
};

describe("startSession", () => {
  it("запускает час и наполняет корзину тапов", () => {
    const state = startSession(createInitialState(), NOW);
    expect(state.phase).toBe("playing");
    expect(state.startedAt).toBe(NOW);
    expect(state.endsAt).toBe(NOW + SESSION_DURATION_MS);
    expect(state.lastTickAt).toBe(NOW);
    expect(state.tapBudget).toBe(TAP_BURST);
  });

  it("повторный запуск во время игры ничего не меняет", () => {
    const started = startSession(createInitialState(), NOW);
    expect(startSession(started, NOW + 5_000)).toBe(started);
  });

  it("не запускается, пока визит заблокирован фиксацией", () => {
    const locked = { ...createInitialState(), fixedAt: NOW };
    expect(startSession(locked, NOW + 1_000)).toBe(locked);
  });
});

describe("advance", () => {
  it("вне игры не делает ничего", () => {
    const idle = createInitialState();
    expect(advance(idle, NOW + 10_000)).toBe(idle);
  });

  it("начисляет пассивный доход помощников", () => {
    const state = playing({ upgrades: { ...createInitialState().upgrades, cooker: 5 } });
    const next = advance(state, NOW + 1_000);

    expect(next.grains).toBeCloseTo(5, 6);
    expect(next.totalGrains).toBeCloseTo(5, 6);
  });

  it("гасит жар со временем и не уводит его в минус", () => {
    const hot = playing({ heat: 0.5 });
    expect(advance(hot, NOW + 1_000).heat).toBeCloseTo(0.5 - HEAT_DECAY_PER_SEC, 6);

    const barelyWarm = playing({ heat: 0.1 });
    expect(advance(barelyWarm, NOW + 1_000).heat).toBe(0);
  });

  it("пополняет корзину тапов, но не выше ёмкости", () => {
    const drained = playing({ tapBudget: 0 });
    expect(advance(drained, NOW + 1_000).tapBudget).toBeLessThanOrEqual(TAP_BURST);
    expect(advance(drained, NOW + 1_000).tapBudget).toBeGreaterThan(0);
  });

  it("обрезает разрыв во времени: свёрнутая вкладка не приносит зёрна", () => {
    const state = playing({ upgrades: { ...createInitialState().upgrades, cooker: 10 } });
    const afterGap = advance(state, NOW + 10 * 60 * 1000);

    // Начислено не за десять минут, а максимум за MAX_ADVANCE_DT_MS.
    expect(afterGap.grains).toBeLessThanOrEqual((10 * MAX_ADVANCE_DT_MS) / 1000);
  });

  it("по истечении часа переводит в результат", () => {
    const next = advance(playing(), NOW + SESSION_DURATION_MS + 60_000);
    expect(next.phase).toBe("result");
  });

  it("не начисляет пассив за время после конца часа", () => {
    const state = playing({ upgrades: { ...createInitialState().upgrades, cooker: 10 } });
    const overshoot = advance(state, NOW + SESSION_DURATION_MS + 60_000);
    const fair = advance(state, NOW + MAX_ADVANCE_DT_MS);

    expect(overshoot.grains).toBeLessThanOrEqual(fair.grains);
  });
});

describe("registerTap", () => {
  it("начисляет зёрна, считает тап и разогревает комбо", () => {
    const next = registerTap(playing(), NOW);

    expect(next.grains).toBe(BASE_TAP_VALUE);
    expect(next.totalGrains).toBe(BASE_TAP_VALUE);
    expect(next.taps).toBe(1);
    expect(next.heat).toBeCloseTo(HEAT_PER_TAP, 6);
    expect(next.tapBudget).toBe(TAP_BURST - 1);
  });

  it("учитывает множитель комбо", () => {
    const hot = playing({ heat: HEAT_MAX });
    expect(registerTap(hot, NOW).grains).toBe(BASE_TAP_VALUE * 2);
  });

  it("не даёт жару превысить потолок", () => {
    const almost = playing({ heat: HEAT_MAX });
    expect(registerTap(almost, NOW).heat).toBe(HEAT_MAX);
  });

  it("тапы сверх лимита частоты не засчитываются", () => {
    const spam = tapTimes(playing(), TAP_BURST + 25, NOW);
    expect(spam.taps).toBe(TAP_BURST);
    expect(spam.tapBudget).toBeLessThan(1);
  });

  it("корзина восстанавливается со временем", () => {
    const drained = tapTimes(playing(), TAP_BURST + 5, NOW);
    const later = registerTap(drained, NOW + 1_000);
    expect(later.taps).toBe(TAP_BURST + 1);
  });

  it("вне игры не начисляет", () => {
    const idle = createInitialState();
    expect(registerTap(idle, NOW).grains).toBe(0);
  });
});

describe("purchase", () => {
  it("списывает цену и повышает уровень", () => {
    const paws = getUpgrade("paws");
    const rich = playing({ grains: 10_000 });
    const next = purchase(rich, "paws");

    expect(next.upgrades.paws).toBe(1);
    expect(next.grains).toBe(10_000 - upgradeCost(paws, 0));
  });

  it("покупка снижает скидку — это осознанная дилемма, а не баг", () => {
    // Ровно на пороге двенадцати процентов: любая трата роняет процент.
    const onThreshold = playing({ grains: grainsForDiscount(12) });
    const before = discountFromGrains(onThreshold.grains);
    const after = discountFromGrains(purchase(onThreshold, "paws").grains);

    expect(before).toBe(12);
    expect(after).toBe(11);
  });

  it("без денег ничего не происходит", () => {
    const poor = playing({ grains: 1 });
    expect(purchase(poor, "paws")).toBe(poor);
  });

  it("выше максимального уровня не поднимается", () => {
    const paws = getUpgrade("paws");
    const maxed = playing({
      grains: Number.MAX_SAFE_INTEGER,
      upgrades: { ...createInitialState().upgrades, paws: paws.maxLevel },
    });
    expect(purchase(maxed, "paws")).toBe(maxed);
  });

  it("вне игры покупка недоступна", () => {
    const idle = createInitialState();
    expect(purchase(idle, "paws")).toBe(idle);
  });
});

describe("завершение и фиксация", () => {
  it("досрочное завершение переводит в результат", () => {
    expect(finishSession(playing(), NOW + 60_000).phase).toBe("result");
  });

  it("завершать можно только идущую игру", () => {
    const idle = createInitialState();
    expect(finishSession(idle, NOW)).toBe(idle);
  });

  it("фиксация замораживает процент и закрывает визит", () => {
    const result = finishSession(playing({ grains: 5_000 }), NOW + 60_000);
    const fixed = fixDiscount(result, NOW + 61_000);

    expect(fixed.phase).toBe("fixed");
    expect(fixed.fixedAt).toBe(NOW + 61_000);
    expect(fixed.fixedDiscount).toBe(discountFromGrains(result.grains));
  });

  it("фиксировать можно только из экрана результата", () => {
    const inGame = playing();
    expect(fixDiscount(inGame, NOW)).toBe(inGame);
  });
});

describe("restartSession", () => {
  it("даёт новый час и обнуляет прогресс", () => {
    const result = finishSession(playing({ grains: 5_000, taps: 100 }), NOW + 60_000);
    const restarted = restartSession(result, NOW + 61_000);

    expect(restarted.phase).toBe("playing");
    expect(restarted.grains).toBe(0);
    expect(restarted.taps).toBe(0);
    expect(restarted.upgrades.paws).toBe(0);
    expect(restarted.endsAt).toBe(NOW + 61_000 + SESSION_DURATION_MS);
    expect(restarted.attempts).toBe(1);
  });

  it("перезапуск считается: попытки накапливаются", () => {
    let state = finishSession(playing(), NOW + 1_000);
    state = restartSession(state, NOW + 2_000);
    state = finishSession(state, NOW + 3_000);
    state = restartSession(state, NOW + 4_000);

    expect(state.attempts).toBe(2);
  });

  it("перезапускать можно только из экрана результата", () => {
    const inGame = playing();
    expect(restartSession(inGame, NOW)).toBe(inGame);
  });
});

describe("resetSession", () => {
  const fixedState = (): GameState => {
    const result = finishSession(playing({ grains: 5_000, taps: 80 }), NOW + 60_000);
    return fixDiscount(result, NOW + 61_000);
  };

  it("возвращает в главное меню и стирает скидку", () => {
    const next = resetSession(fixedState());

    expect(next.phase).toBe("idle");
    expect(next.fixedDiscount).toBeNull();
    expect(next.fixedAt).toBeNull();
    expect(next.grains).toBe(0);
    expect(next.taps).toBe(0);
  });

  it("снимает блокировку визита, чтобы можно было начать заново", () => {
    const next = resetSession(fixedState());

    expect(isVisitLocked(next, NOW + 62_000)).toBe(false);
    expect(startSession(next, NOW + 62_000).phase).toBe("playing");
  });

  it("отказ от скидки остаётся в счётчике попыток", () => {
    expect(resetSession(fixedState()).attempts).toBe(1);
  });

  it("работает и с экрана результата", () => {
    const result = finishSession(playing(), NOW + 60_000);
    expect(resetSession(result).phase).toBe("idle");
  });

  it("посреди игры не срабатывает: это не способ обнулить неудачный час", () => {
    const inGame = playing({ grains: 1_000 });
    expect(resetSession(inGame)).toBe(inGame);
  });
});

describe("resumeAfterHidden", () => {
  it("двигает точку отсчёта без начисления", () => {
    const state = playing({ upgrades: { ...createInitialState().upgrades, kitchen: 8 } });
    const resumed = resumeAfterHidden(state, NOW + 30 * 60 * 1000);

    expect(resumed.grains).toBe(0);
    expect(resumed.lastTickAt).toBe(NOW + 30 * 60 * 1000);
  });

  it("сбрасывает жар: за время отсутствия комбо остыло", () => {
    expect(resumeAfterHidden(playing({ heat: 1 }), NOW + 5_000).heat).toBe(0);
  });

  it("если за это время час вышел — сразу результат", () => {
    const resumed = resumeAfterHidden(playing(), NOW + SESSION_DURATION_MS + 1);
    expect(resumed.phase).toBe("result");
  });

  it("вне игры не делает ничего", () => {
    const idle = createInitialState();
    expect(resumeAfterHidden(idle, NOW)).toBe(idle);
  });
});
