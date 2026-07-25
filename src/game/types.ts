export type UpgradeId = "paws" | "chopsticks" | "wok" | "cooker" | "waiter" | "kitchen";

export type UpgradeKind = "tap" | "passive";

export interface UpgradeDefinition {
  readonly id: UpgradeId;
  readonly kind: UpgradeKind;
  readonly title: string;
  readonly description: string;
  /** Прирост за уровень: зёрен за тап для `tap`, зёрен в секунду для `passive`. */
  readonly gain: number;
  readonly baseCost: number;
  readonly costGrowth: number;
  readonly maxLevel: number;
}

export type UpgradeLevels = Readonly<Record<UpgradeId, number>>;

/**
 * `idle` — игра ещё не начата.
 * `playing` — идёт час.
 * `result` — час вышел или гость завершил сам; можно зафиксировать или начать заново.
 * `fixed` — скидка зафиксирована, показывается официанту. Терминальное состояние визита.
 */
export type SessionPhase = "idle" | "playing" | "result" | "fixed";

export interface GameState {
  readonly phase: SessionPhase;
  /** Текущий баланс. Именно от него считается скидка. */
  readonly grains: number;
  /** Всего заработано за сессию. Только для статистики, на скидку не влияет. */
  readonly totalGrains: number;
  readonly taps: number;
  readonly upgrades: UpgradeLevels;
  /** «Жар» комбо, 0..1. Множитель к тапу равен `1 + heat`. */
  readonly heat: number;
  /** Кредиты корзины токенов для ограничения частоты тапов. */
  readonly tapBudget: number;
  readonly startedAt: number | null;
  readonly endsAt: number | null;
  readonly lastTickAt: number | null;
  readonly fixedAt: number | null;
  readonly fixedDiscount: number | null;
  /** Сколько раз гость начинал заново за этот визит. */
  readonly attempts: number;
}
