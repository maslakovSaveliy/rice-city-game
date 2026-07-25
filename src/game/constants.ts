import type { UpgradeDefinition, UpgradeId } from "./types";

/**
 * Константы экономики.
 *
 * ВАЖНО: ни одно значение здесь не подбирается «на глаз». Любое изменение
 * проверяется симулятором персон в `economy.balance.test.ts` — тесты падают,
 * если средний гость перестаёт попадать в коридор 10–16%.
 *
 * ЮРИДИЧЕСКОЕ ОГРАНИЧЕНИЕ: начисление зёрен и расчёт скидки полностью
 * детерминированы. Случайность в награде превращает акцию в стимулирующую
 * лотерею по 138-ФЗ со всеми последствиями. `Math.random()` в этом модуле
 * и во всём `src/game` запрещён.
 */

/** Потолок скидки в процентах. Заведомо недостижим за один час. */
export const DISCOUNT_MAX = 30;

/** Стоимость первого процента в зёрнах. При базовом тапе это ~12 тапов. */
export const FIRST_PERCENT_COST = 12;

/**
 * Каждый следующий процент дороже предыдущего во столько раз.
 *
 * Значение подобрано симулятором, а не интуицией: улучшения компаундируются
 * гораздо сильнее, чем кажется на бумаге, и разрыв между казуалом и
 * автокликером за час достигает четырёх порядков. Кривая с таким основанием
 * укладывает весь этот разброс в 9–29%.
 */
export const DISCOUNT_COST_GROWTH = 1.61;

/** Зёрен за один тап без улучшений и без комбо. */
export const BASE_TAP_VALUE = 1;

/** Длительность сессии. */
export const SESSION_DURATION_MS = 60 * 60 * 1000;

/**
 * Через сколько после фиксации скидки игра снова доступна. Это и есть рабочее
 * определение «нового визита» — авторизации нет, опереться больше не на что.
 */
export const FIX_LOCK_MS = 6 * 60 * 60 * 1000;

/** Прирост жара за один засчитанный тап. */
export const HEAT_PER_TAP = 0.1;

/** Затухание жара в секунду при бездействии. */
export const HEAT_DECAY_PER_SEC = 0.25;

/** Потолок жара. Множитель к тапу равен `1 + heat`, то есть максимум ×2. */
export const HEAT_MAX = 1;

/**
 * Корзина токенов для тапов: пополняется `TAP_RATE_LIMIT` в секунду, ёмкость
 * равна `TAP_BURST`. Быстрый ребёнок на 6–8 тапах в секунду её не исчерпывает,
 * скрипт на 20+ обрезается до 15.
 */
export const TAP_RATE_LIMIT = 15;
export const TAP_BURST = 15;

/** Шаг игрового цикла для пассивного дохода и затухания жара. */
export const TICK_INTERVAL_MS = 100;

/**
 * Максимальный интервал, который засчитывается за один шаг. Защита от «дыр»:
 * если вкладка была свёрнута или процесс подвис, наивный расчёт по разнице
 * времени начислил бы пассив за всё это время. Пассив положен только за
 * реально проведённое в игре время.
 */
export const MAX_ADVANCE_DT_MS = 1_000;

export const UPGRADES: readonly UpgradeDefinition[] = [
  {
    id: "paws",
    kind: "tap",
    title: "Крепкие лапки",
    description: "Рисинка тапает увереннее",
    gain: 1,
    baseCost: 60,
    costGrowth: 1.45,
    maxLevel: 10,
  },
  {
    id: "chopsticks",
    kind: "tap",
    title: "Палочки",
    description: "Ловит по пять зёрен разом",
    gain: 5,
    baseCost: 1_500,
    costGrowth: 1.5,
    maxLevel: 8,
  },
  {
    id: "wok",
    kind: "tap",
    title: "Вок",
    description: "Целый вок за одно касание",
    gain: 25,
    baseCost: 40_000,
    costGrowth: 1.55,
    maxLevel: 6,
  },
  {
    id: "cooker",
    kind: "passive",
    title: "Рисоварка",
    description: "Варит рис, пока ты отдыхаешь",
    gain: 1,
    baseCost: 200,
    costGrowth: 1.4,
    maxLevel: 12,
  },
  {
    id: "waiter",
    kind: "passive",
    title: "Официант",
    description: "Приносит зёрна прямо к столу",
    gain: 8,
    baseCost: 6_000,
    costGrowth: 1.45,
    maxLevel: 10,
  },
  {
    id: "kitchen",
    kind: "passive",
    title: "Кухня",
    description: "Работает вся кухня разом",
    gain: 50,
    baseCost: 120_000,
    costGrowth: 1.5,
    maxLevel: 8,
  },
] as const;

export const UPGRADE_BY_ID: ReadonlyMap<UpgradeId, UpgradeDefinition> = new Map(
  UPGRADES.map((upgrade) => [upgrade.id, upgrade]),
);

export const EMPTY_UPGRADE_LEVELS = Object.freeze({
  paws: 0,
  chopsticks: 0,
  wok: 0,
  cooker: 0,
  waiter: 0,
  kitchen: 0,
});
