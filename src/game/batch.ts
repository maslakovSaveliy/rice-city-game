import { MAX_TAPS_PER_BATCH } from "./constants";
import { advance, registerTap } from "./reducer";
import type { GameState } from "./types";

/**
 * Применяет пачку тапов, накопленных клиентом между синхронизациями.
 *
 * Тапы распределяются равномерно по интервалу от `lastTickAt` до `now`, а не
 * применяются все в одну точку времени. Разница существенна: жар между тапами
 * успевает подостыть, а корзина — подпополниться. Если сложить всю пачку в один
 * момент, сервер насчитает заметно больше клиентского предсказания, и счётчик
 * на экране будет прыгать при каждой синхронизации.
 *
 * Функция чистая: сервер и клиент считают одно и то же по одним правилам.
 */
export function applyTapBatch(state: GameState, taps: number, now: number): GameState {
  if (state.phase !== "playing" || state.lastTickAt === null) {
    return advance(state, now);
  }

  const count = Math.min(Math.max(0, Math.floor(taps)), MAX_TAPS_PER_BATCH);
  if (count === 0) {
    return advance(state, now);
  }

  const from = state.lastTickAt;
  const span = Math.max(0, now - from);

  let next = state;
  for (let index = 1; index <= count; index += 1) {
    next = registerTap(next, from + (span * index) / count);
    if (next.phase !== "playing") {
      break;
    }
  }

  return advance(next, now);
}
