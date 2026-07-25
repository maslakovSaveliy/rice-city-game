import { UPGRADES } from "./constants";
import { canAffordUpgrade, discountFromGrains, discountProgress, upgradeCost } from "./economy";
import { remainingMs } from "./session";
import type { GameState, UpgradeId } from "./types";

/**
 * Представление состояния для клиента.
 *
 * Содержит и сырое состояние, и производные величины. Сырое нужно, чтобы
 * клиент мог предсказывать локально теми же чистыми функциями; производные —
 * чтобы не дублировать вычисления в интерфейсе.
 *
 * Секретов здесь нет: скрывать нечего, вся математика и так лежит в бандле.
 * Защита строится на том, что считает сервер, а не на сокрытии формул.
 */
export interface UpgradeView {
  readonly id: UpgradeId;
  readonly title: string;
  readonly description: string;
  readonly kind: "tap" | "passive";
  readonly gain: number;
  readonly level: number;
  readonly maxLevel: number;
  readonly cost: number;
  readonly affordable: boolean;
  readonly maxed: boolean;
}

export interface PublicGameState {
  readonly state: GameState;
  readonly discount: number;
  readonly progress: ReturnType<typeof discountProgress>;
  readonly remainingMs: number;
  readonly upgrades: readonly UpgradeView[];
  /** Серверное время ответа. Клиент считает по нему смещение своих часов. */
  readonly serverTime: number;
}

export function toPublicState(state: GameState, now: number): PublicGameState {
  return {
    state,
    discount: discountFromGrains(state.grains),
    progress: discountProgress(state.grains),
    remainingMs: remainingMs(state, now),
    upgrades: UPGRADES.map((upgrade) => {
      const level = state.upgrades[upgrade.id];
      return {
        id: upgrade.id,
        title: upgrade.title,
        description: upgrade.description,
        kind: upgrade.kind,
        gain: upgrade.gain,
        level,
        maxLevel: upgrade.maxLevel,
        cost: upgradeCost(upgrade, level),
        affordable: canAffordUpgrade(upgrade, level, state.grains),
        maxed: level >= upgrade.maxLevel,
      };
    }),
    serverTime: now,
  };
}
