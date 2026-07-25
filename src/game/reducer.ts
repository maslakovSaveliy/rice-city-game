import {
  EMPTY_UPGRADE_LEVELS,
  HEAT_DECAY_PER_SEC,
  HEAT_MAX,
  HEAT_PER_TAP,
  MAX_ADVANCE_DT_MS,
  PASSIVE_CAP_RATIO,
  SESSION_DURATION_MS,
  TAP_BURST,
  TAP_RATE_LIMIT,
} from "./constants";
import {
  clamp,
  discountFromGrains,
  getUpgrade,
  grainsPerTap,
  passiveRate,
  upgradeCost,
} from "./economy";
import { createInitialState, isSessionExpired, isVisitLocked } from "./session";
import type { GameState, UpgradeId } from "./types";

/**
 * Все переходы состояния — чистые функции вида `(state, now) => state`.
 * Никаких побочных эффектов, никакого `Date.now()`, никакой случайности.
 */

export function startSession(state: GameState, now: number): GameState {
  if (state.phase !== "idle" || isVisitLocked(state, now)) {
    return state;
  }
  return {
    ...state,
    phase: "playing",
    startedAt: now,
    endsAt: now + SESSION_DURATION_MS,
    lastTickAt: now,
    tapBudget: TAP_BURST,
  };
}

/**
 * Продвигает время: пассивный доход, затухание жара, пополнение корзины тапов
 * и проверка окончания часа.
 *
 * Вызывается только при видимой вкладке. Разрыв во времени обрезается
 * `MAX_ADVANCE_DT_MS`, чтобы свёрнутая вкладка не приносила зёрна.
 */
export function advance(state: GameState, now: number): GameState {
  if (state.phase !== "playing" || state.lastTickAt === null) {
    return state;
  }

  const expired = isSessionExpired(state, now);
  const boundary = expired && state.endsAt !== null ? state.endsAt : now;
  const rawDelta = Math.max(0, boundary - state.lastTickAt);
  const deltaSeconds = Math.min(rawDelta, MAX_ADVANCE_DT_MS) / 1000;

  const income = allowedPassiveIncome(state, deltaSeconds);
  const next: GameState = {
    ...state,
    grains: state.grains + income,
    totalGrains: state.totalGrains + income,
    heat: Math.max(0, state.heat - HEAT_DECAY_PER_SEC * deltaSeconds),
    tapBudget: Math.min(TAP_BURST, state.tapBudget + TAP_RATE_LIMIT * deltaSeconds),
    lastTickAt: now,
  };

  return expired ? { ...next, phase: "result" } : next;
}

/**
 * Пассивный доход за интервал с учётом потолка.
 *
 * Помощники за сессию не могут принести больше `PASSIVE_CAP_RATIO` от того,
 * что гость натапал руками. Это и есть гарантия, что оставленный включённым
 * экран не обгонит того, кто играет: пассиву просто нечего умножать, пока
 * нажатий мало.
 */
function allowedPassiveIncome(state: GameState, deltaSeconds: number): number {
  const earnedPassive = state.totalGrains - state.tapGrains;
  const allowance = state.tapGrains * PASSIVE_CAP_RATIO - earnedPassive;
  if (allowance <= 0) {
    return 0;
  }
  return Math.min(passiveRate(state.upgrades) * deltaSeconds, allowance);
}

/**
 * Один тап. Сначала продвигает время, потом начисляет награду — иначе жар и
 * корзина тапов считались бы по устаревшему состоянию.
 *
 * Тап сверх лимита частоты просто не засчитывается: состояние возвращается
 * как есть, без начисления.
 */
export function registerTap(state: GameState, now: number): GameState {
  const advanced = advance(state, now);
  if (advanced.phase !== "playing" || advanced.tapBudget < 1) {
    return advanced;
  }

  const reward = grainsPerTap(advanced.upgrades, advanced.heat);

  return {
    ...advanced,
    grains: advanced.grains + reward,
    totalGrains: advanced.totalGrains + reward,
    tapGrains: advanced.tapGrains + reward,
    taps: advanced.taps + 1,
    heat: clamp(advanced.heat + HEAT_PER_TAP, 0, HEAT_MAX),
    tapBudget: advanced.tapBudget - 1,
  };
}

/** Покупка уровня улучшения. Списывает с баланса, а значит снижает скидку. */
export function purchase(state: GameState, id: UpgradeId): GameState {
  if (state.phase !== "playing") {
    return state;
  }

  const upgrade = getUpgrade(id);
  const level = state.upgrades[id];
  if (level >= upgrade.maxLevel) {
    return state;
  }

  const cost = upgradeCost(upgrade, level);
  if (state.grains < cost) {
    return state;
  }

  return {
    ...state,
    grains: state.grains - cost,
    upgrades: { ...state.upgrades, [id]: level + 1 },
  };
}

/** Гость завершает игру досрочно. */
export function finishSession(state: GameState, now: number): GameState {
  if (state.phase !== "playing") {
    return state;
  }
  return { ...advance(state, now), phase: "result" };
}

/**
 * Фиксация скидки. Терминальное действие визита: процент замораживается,
 * дальнейшая игра закрыта до истечения `FIX_LOCK_MS`.
 */
export function fixDiscount(state: GameState, now: number): GameState {
  if (state.phase !== "result") {
    return state;
  }
  return {
    ...state,
    phase: "fixed",
    fixedAt: now,
    fixedDiscount: discountFromGrains(state.grains),
  };
}

/** Начать заново: новый час, счёт и улучшения обнуляются. */
export function restartSession(state: GameState, now: number): GameState {
  if (state.phase !== "result") {
    return state;
  }
  return {
    ...createInitialState(),
    phase: "playing",
    upgrades: { ...EMPTY_UPGRADE_LEVELS },
    startedAt: now,
    endsAt: now + SESSION_DURATION_MS,
    lastTickAt: now,
    attempts: state.attempts + 1,
  };
}

/**
 * Полный сброс визита.
 *
 * Отбрасывает зафиксированную скидку и снимает блокировку, возвращая гостя в
 * главное меню. Разрешён только из терминальных состояний: посреди игры это
 * было бы способом молча обнулить неудачный час.
 *
 * Технически это означает, что правило «одна скидка на визит» держится не на
 * коде, а на официанте. Так решено осознанно: авторизации нет, и любой запрет
 * всё равно обходится очисткой куки.
 */
export function resetSession(state: GameState): GameState {
  if (state.phase !== "fixed" && state.phase !== "result") {
    return state;
  }
  return { ...createInitialState(), attempts: state.attempts + 1 };
}

/**
 * Возврат из свёрнутой вкладки. Двигает точку отсчёта без начисления, иначе
 * гость получил бы пассив за время, которое он в игре не провёл.
 */
export function resumeAfterHidden(state: GameState, now: number): GameState {
  if (state.phase !== "playing") {
    return state;
  }
  if (isSessionExpired(state, now)) {
    return { ...state, lastTickAt: now, phase: "result" };
  }
  return { ...state, lastTickAt: now, heat: 0 };
}
