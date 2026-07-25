export type UpgradeId =
  | "paws"
  | "chopsticks"
  | "ladle"
  | "wok"
  | "kazan"
  | "cooker"
  | "waiter"
  | "kitchen";

export type UpgradeKind = "tap" | "passive";

export interface UpgradeDefinition {
  readonly id: UpgradeId;
  readonly kind: UpgradeKind;
  readonly title: string;
  readonly description: string;
  /**
   * Прирост за уровень. Единица зависит от вида:
   *
   * - `tap` — зёрен за одно нажатие;
   * - `passive` — ДОЛЯ силы тапа, начисляемая в секунду. `0.05` значит, что
   *   уровень даёт пять процентов текущей силы тапа каждую секунду.
   *
   * Пассив считается от силы тапа намеренно. Фиксированное число сделало бы
   * помощников самоокупающимися: дешёвая рисоварка оплачивала бы официанта,
   * тот — кухню, и гость получал бы проценты, положив телефон на стол. Доля
   * от силы тапа без вложений в нажатие почти ничего не даёт, а вместе с ними
   * растёт и остаётся осмысленной покупкой.
   */
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
  /**
   * Сколько из заработанного пришло именно с нажатий.
   *
   * Нужно для потолка пассивного дохода: помощники не могут принести больше
   * доли от натапанного. Без этого гость, оставивший экран включённым, обгонял
   * ребёнка, который честно тапал, — это ломало саму идею игры.
   */
  readonly tapGrains: number;
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
