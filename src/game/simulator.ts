import { SESSION_DURATION_MS, TICK_INTERVAL_MS, UPGRADES } from "./constants";
import { canAffordUpgrade, discountFromGrains, upgradeCost } from "./economy";
import { advance, purchase, registerTap, startSession } from "./reducer";
import { createInitialState } from "./session";
import type { GameState, UpgradeDefinition, UpgradeId } from "./types";

/**
 * Детерминированный симулятор часа игры.
 *
 * Существует ради балансировки: константы экономики настраиваются не на глаз,
 * а прогоном персон через реальный редьюсер с проверкой попадания в коридоры.
 * Ни времени, ни случайности внутри — те же входные данные всегда дают тот же
 * результат.
 */

export type BuyStrategy = "none" | "greedy" | "smart";

export interface Persona {
  readonly id: string;
  readonly label: string;
  /** Темп тапа в секунду в моменты активной игры. */
  readonly tapsPerSecond: number;
  /** Сколько минут из шестидесяти гость реально тапает. */
  readonly activeMinutes: number;
  readonly strategy: BuyStrategy;
}

export interface SimulationResult {
  readonly persona: Persona;
  readonly discount: number;
  readonly grains: number;
  readonly taps: number;
  readonly state: GameState;
}

/** Гость играет вспышками: поел — потапал — поел. Блок задаёт длину цикла. */
const ACTIVITY_BLOCK_MS = 120_000;

/** В последние минуты покупать бессмысленно: улучшение не успеет окупиться. */
const SMART_STOP_BUYING_BEFORE_END_MS = 10 * 60 * 1000;

/** Произвольная фиксированная точка отсчёта. Абсолютное значение неважно. */
const SIMULATION_EPOCH = 1_700_000_000_000;

export function simulate(persona: Persona): SimulationResult {
  let state = startSession(createInitialState(), SIMULATION_EPOCH);
  let tapDebt = 0;

  const dutyCycle = persona.activeMinutes / 60;
  const activeWindowMs = ACTIVITY_BLOCK_MS * dutyCycle;
  const stepSeconds = TICK_INTERVAL_MS / 1000;

  for (
    let elapsed = TICK_INTERVAL_MS;
    elapsed <= SESSION_DURATION_MS;
    elapsed += TICK_INTERVAL_MS
  ) {
    const now = SIMULATION_EPOCH + elapsed;

    if (elapsed % ACTIVITY_BLOCK_MS < activeWindowMs) {
      tapDebt += persona.tapsPerSecond * stepSeconds;
      while (tapDebt >= 1) {
        state = registerTap(state, now);
        tapDebt -= 1;
      }
    }

    state = advance(state, now);
    if (state.phase !== "playing") {
      break;
    }

    state = applyStrategy(state, persona, elapsed);
  }

  return {
    persona,
    discount: discountFromGrains(state.grains),
    grains: state.grains,
    taps: state.taps,
    state,
  };
}

function applyStrategy(state: GameState, persona: Persona, elapsed: number): GameState {
  switch (persona.strategy) {
    case "none":
      return state;
    case "greedy":
      return buyCheapestAffordable(state);
    case "smart":
      return buyBestValue(state, persona, elapsed);
  }
}

/** Покупает всё, что по карману, начиная с самого дешёвого. */
function buyCheapestAffordable(state: GameState): GameState {
  let next = state;
  let bought = true;

  while (bought) {
    bought = false;
    const candidate = affordable(next)
      .sort((a, b) => costOf(next, a) - costOf(next, b))
      .at(0);

    if (candidate) {
      next = purchase(next, candidate.id);
      bought = true;
    }
  }

  return next;
}

/**
 * Считает, сколько зёрен улучшение принесёт до конца часа, и берёт лучшее
 * по отношению отдачи к цене. Ближе к концу перестаёт покупать вовсе.
 */
function buyBestValue(state: GameState, persona: Persona, elapsed: number): GameState {
  const remainingMs = SESSION_DURATION_MS - elapsed;
  if (remainingMs <= SMART_STOP_BUYING_BEFORE_END_MS) {
    return state;
  }

  const remainingSeconds = remainingMs / 1000;
  const expectedTaps = persona.tapsPerSecond * (persona.activeMinutes / 60) * remainingSeconds;

  let next = state;
  let bought = true;

  while (bought) {
    bought = false;
    let best: { id: UpgradeId; score: number } | null = null;

    for (const upgrade of affordable(next)) {
      const volume = upgrade.kind === "tap" ? expectedTaps : remainingSeconds;
      const score = (upgrade.gain * volume) / costOf(next, upgrade);
      if (score > 1 && (best === null || score > best.score)) {
        best = { id: upgrade.id, score };
      }
    }

    if (best) {
      next = purchase(next, best.id);
      bought = true;
    }
  }

  return next;
}

function affordable(state: GameState): UpgradeDefinition[] {
  return UPGRADES.filter((upgrade) =>
    canAffordUpgrade(upgrade, state.upgrades[upgrade.id], state.grains),
  );
}

function costOf(state: GameState, upgrade: UpgradeDefinition): number {
  return upgradeCost(upgrade, state.upgrades[upgrade.id]);
}

export const PERSONAS: readonly Persona[] = [
  {
    id: "kid-casual",
    label: "Ребёнок-казуал",
    tapsPerSecond: 3,
    activeMinutes: 8,
    strategy: "none",
  },
  {
    id: "average-guest",
    label: "Средний гость",
    tapsPerSecond: 4,
    activeMinutes: 15,
    strategy: "greedy",
  },
  {
    id: "kid-engaged",
    label: "Увлечённый ребёнок",
    tapsPerSecond: 6,
    activeMinutes: 30,
    strategy: "greedy",
  },
  {
    id: "adult-max",
    label: "Взрослый-максималист",
    tapsPerSecond: 8,
    activeMinutes: 45,
    strategy: "smart",
  },
  {
    id: "autoclicker",
    label: "Автокликер",
    tapsPerSecond: 20,
    activeMinutes: 60,
    strategy: "smart",
  },
] as const;
