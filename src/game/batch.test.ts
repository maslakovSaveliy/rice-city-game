import { describe, expect, it } from "vitest";
import { applyTapBatch } from "./batch";
import { MAX_TAPS_PER_BATCH, SYNC_INTERVAL_MS, TAP_RATE_LIMIT } from "./constants";
import { registerTap, startSession } from "./reducer";
import { createInitialState } from "./session";
import type { GameState } from "./types";

const NOW = 1_700_000_000_000;

const playing = (): GameState => startSession(createInitialState(), NOW);

describe("applyTapBatch", () => {
  it("засчитывает всю пачку за окно синхронизации", () => {
    const taps = 24;
    const next = applyTapBatch(playing(), taps, NOW + SYNC_INTERVAL_MS);

    expect(next.taps).toBe(taps);
    expect(next.grains).toBeGreaterThan(0);
  });

  it("честный быстрый темп за окно не теряется", () => {
    // Ребёнок на 12 тапах в секунду: за два секундных окна это 24 тапа.
    const taps = 12 * (SYNC_INTERVAL_MS / 1000);
    expect(applyTapBatch(playing(), taps, NOW + SYNC_INTERVAL_MS).taps).toBe(taps);
  });

  it("режет пачку сверх допустимого размера", () => {
    const next = applyTapBatch(playing(), 100_000, NOW + SYNC_INTERVAL_MS);
    expect(next.taps).toBeLessThanOrEqual(MAX_TAPS_PER_BATCH);
  });

  it("длинная тишина не превращается в пассивный доход за всё это время", () => {
    const withHelpers: GameState = {
      ...playing(),
      upgrades: { ...createInitialState().upgrades, kitchen: 3 },
      // Потолок пассива считается от натапанного: без запаса зёрен помощники
      // не начислили бы ничего и тест сравнивал бы два нуля.
      tapGrains: 100_000_000,
      totalGrains: 100_000_000,
    };

    const afterGap = applyTapBatch(withHelpers, 0, NOW + 10 * 60 * 1000);
    const fair = applyTapBatch(withHelpers, 0, NOW + 1_000);

    expect(afterGap.grains).toBeLessThan(fair.grains * 60);
  });

  it("пустая пачка просто двигает время", () => {
    const next = applyTapBatch(playing(), 0, NOW + 1_000);
    expect(next.taps).toBe(0);
    expect(next.lastTickAt).toBe(NOW + 1_000);
  });

  it("вне игры не начисляет", () => {
    const idle = createInitialState();
    expect(applyTapBatch(idle, 30, NOW + 1_000).taps).toBe(0);
  });

  it("останавливается на границе часа", () => {
    const next = applyTapBatch(playing(), 30, NOW + 61 * 60 * 1000);
    expect(next.phase).toBe("result");
  });

  it("даёт результат, близкий к тапам в реальном времени", () => {
    // Клиент тапает по-настоящему, сервер получает ту же пачку одним запросом.
    // Расхождение должно быть небольшим, иначе счётчик будет прыгать.
    const taps = 20;
    const step = SYNC_INTERVAL_MS / taps;

    let realtime = playing();
    for (let index = 1; index <= taps; index += 1) {
      realtime = registerTap(realtime, NOW + step * index);
    }

    const batched = applyTapBatch(playing(), taps, NOW + SYNC_INTERVAL_MS);

    expect(batched.taps).toBe(realtime.taps);
    expect(batched.grains).toBeCloseTo(realtime.grains, 6);
    expect(batched.heat).toBeCloseTo(realtime.heat, 6);
  });

  it("устойчивый обстрел на пределе не даёт больше лимита частоты", () => {
    let state = playing();
    const windows = 30;

    for (let window = 1; window <= windows; window += 1) {
      state = applyTapBatch(state, MAX_TAPS_PER_BATCH, NOW + SYNC_INTERVAL_MS * window);
    }

    const elapsedSeconds = (SYNC_INTERVAL_MS * windows) / 1000;
    // Ёмкость корзины даёт разовый запас, но средний темп ограничен пополнением.
    expect(state.taps).toBeLessThanOrEqual(TAP_RATE_LIMIT * elapsedSeconds + MAX_TAPS_PER_BATCH);
  });
});
