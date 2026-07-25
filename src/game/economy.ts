import {
  BASE_TAP_VALUE,
  DISCOUNT_COST_GROWTH,
  DISCOUNT_MAX,
  FIRST_PERCENT_COST,
  HEAT_MAX,
  UPGRADE_BY_ID,
  UPGRADES,
} from "./constants";
import type { UpgradeDefinition, UpgradeLevels } from "./types";

/** Гасит накопленную погрешность double на точных границах процентов. */
const FLOAT_EPSILON = 1e-9;

/** Допуск для чисел, которые видит гость. Доли зерна ему ни о чём не говорят. */
const GRAIN_DISPLAY_EPSILON = 1e-6;

/**
 * Сколько зёрен нужно держать на балансе, чтобы получить ровно `percent`.
 * Стоимость каждого следующего процента растёт геометрически, поэтому первые
 * проценты даются за секунды, а последние — практически недостижимы.
 */
export function grainsForDiscount(percent: number): number {
  const clamped = clampPercent(percent);
  if (clamped <= 0) {
    return 0;
  }
  return (FIRST_PERCENT_COST * (DISCOUNT_COST_GROWTH ** clamped - 1)) / (DISCOUNT_COST_GROWTH - 1);
}

/** Обратная функция: какой процент даёт текущий баланс. Всегда целое число. */
export function discountFromGrains(grains: number): number {
  if (!Number.isFinite(grains) || grains < FIRST_PERCENT_COST) {
    return 0;
  }
  const ratio = 1 + (grains * (DISCOUNT_COST_GROWTH - 1)) / FIRST_PERCENT_COST;
  const percent = Math.log(ratio) / Math.log(DISCOUNT_COST_GROWTH);
  return clampPercent(Math.floor(percent + FLOAT_EPSILON));
}

export interface DiscountProgress {
  /** Текущий достигнутый процент. */
  readonly percent: number;
  /** Следующий процент, либо `null`, если достигнут потолок. */
  readonly nextPercent: number | null;
  /** Сколько зёрен не хватает до следующего процента. */
  readonly grainsToNext: number;
  /** Доля пути до следующего процента, 0..1. На потолке равна 1. */
  readonly ratio: number;
}

/** Данные для прогресс-бара «до следующего процента осталось N». */
export function discountProgress(grains: number): DiscountProgress {
  const percent = discountFromGrains(grains);
  if (percent >= DISCOUNT_MAX) {
    return { percent: DISCOUNT_MAX, nextPercent: null, grainsToNext: 0, ratio: 1 };
  }

  const floor = grainsForDiscount(percent);
  const ceiling = grainsForDiscount(percent + 1);
  // Стоимость процента строго возрастает, поэтому интервал всегда положителен.
  const span = ceiling - floor;
  const reached = Math.max(0, grains - floor);

  return {
    percent,
    nextPercent: percent + 1,
    // Округление вверх с допуском: геометрическая сумма оставляет мусор в
    // последнем разряде, и на нулевом балансе `Math.ceil` показывал 751 зерно
    // вместо ровно 750. Сам порог при этом трогать нельзя — сдвинутся проценты.
    grainsToNext: Math.max(0, Math.ceil(ceiling - grains - GRAIN_DISPLAY_EPSILON)),
    ratio: clamp(reached / span, 0, 1),
  };
}

/** Цена следующего уровня улучшения. Уровни считаются с нуля. */
export function upgradeCost(upgrade: UpgradeDefinition, currentLevel: number): number {
  return Math.ceil(upgrade.baseCost * upgrade.costGrowth ** currentLevel);
}

/** Можно ли купить ещё уровень: не упёрлись в максимум и хватает зёрен. */
export function canAffordUpgrade(
  upgrade: UpgradeDefinition,
  currentLevel: number,
  grains: number,
): boolean {
  if (currentLevel >= upgrade.maxLevel) {
    return false;
  }
  return grains >= upgradeCost(upgrade, currentLevel);
}

/** Зёрен за один тап без учёта комбо. */
export function tapValue(levels: UpgradeLevels): number {
  return UPGRADES.reduce((total, upgrade) => {
    if (upgrade.kind !== "tap") {
      return total;
    }
    return total + upgrade.gain * levels[upgrade.id];
  }, BASE_TAP_VALUE);
}

/**
 * Доля силы тапа, которую помощники приносят каждую секунду.
 *
 * Ноль без единого помощника, и не зависит от того, сколько зёрен на счету.
 */
export function passiveShare(levels: UpgradeLevels): number {
  return UPGRADES.reduce((total, upgrade) => {
    if (upgrade.kind !== "passive") {
      return total;
    }
    return total + upgrade.gain * levels[upgrade.id];
  }, 0);
}

/**
 * Зёрен в секунду от помощников. Начисляется только при видимой вкладке.
 *
 * Считается от силы тапа, а не фиксированным числом: см. пояснение к `gain`
 * в `UpgradeDefinition`. Без вложений в нажатие помощники почти бесполезны,
 * и путь «положил телефон и жду» закрывается сам собой.
 */
export function passiveRate(levels: UpgradeLevels): number {
  return tapValue(levels) * passiveShare(levels);
}

/** Множитель комбо: от ×1 в покое до ×2 на полном жаре. */
export function heatMultiplier(heat: number): number {
  return 1 + clamp(heat, 0, HEAT_MAX);
}

/** Итоговая награда за один засчитанный тап. */
export function grainsPerTap(levels: UpgradeLevels, heat: number): number {
  return tapValue(levels) * heatMultiplier(heat);
}

export function getUpgrade(id: UpgradeDefinition["id"]): UpgradeDefinition {
  const upgrade = UPGRADE_BY_ID.get(id);
  if (!upgrade) {
    throw new Error(`Неизвестное улучшение: ${id}`);
  }
  return upgrade;
}

function clampPercent(percent: number): number {
  return clamp(Math.trunc(percent), 0, DISCOUNT_MAX);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
