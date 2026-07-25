import { describe, expect, it } from "vitest";
import {
  BASE_TAP_VALUE,
  DISCOUNT_MAX,
  EMPTY_UPGRADE_LEVELS,
  FIRST_PERCENT_COST,
  HEAT_MAX,
  UPGRADES,
} from "./constants";
import {
  canAffordUpgrade,
  clamp,
  discountFromGrains,
  discountProgress,
  getUpgrade,
  grainsForDiscount,
  grainsPerTap,
  heatMultiplier,
  passiveRate,
  tapValue,
  upgradeCost,
} from "./economy";
import type { UpgradeId, UpgradeLevels } from "./types";

const levels = (overrides: Partial<UpgradeLevels> = {}): UpgradeLevels => ({
  ...EMPTY_UPGRADE_LEVELS,
  ...overrides,
});

describe("grainsForDiscount", () => {
  it("нулевая скидка не стоит ничего", () => {
    expect(grainsForDiscount(0)).toBe(0);
    expect(grainsForDiscount(-5)).toBe(0);
  });

  it("первый процент стоит ровно FIRST_PERCENT_COST", () => {
    expect(grainsForDiscount(1)).toBeCloseTo(FIRST_PERCENT_COST, 6);
  });

  it("строго возрастает", () => {
    for (let percent = 1; percent <= DISCOUNT_MAX; percent += 1) {
      expect(grainsForDiscount(percent)).toBeGreaterThan(grainsForDiscount(percent - 1));
    }
  });

  it("обрезается потолком", () => {
    expect(grainsForDiscount(999)).toBe(grainsForDiscount(DISCOUNT_MAX));
  });
});

describe("discountFromGrains", () => {
  it("до первого порога скидки нет", () => {
    expect(discountFromGrains(0)).toBe(0);
    expect(discountFromGrains(FIRST_PERCENT_COST - 0.01)).toBe(0);
  });

  it("на пороге даёт ровно один процент", () => {
    expect(discountFromGrains(FIRST_PERCENT_COST)).toBe(1);
  });

  it("обратна grainsForDiscount на всех порогах", () => {
    for (let percent = 1; percent <= DISCOUNT_MAX; percent += 1) {
      expect(discountFromGrains(grainsForDiscount(percent))).toBe(percent);
    }
  });

  it("не пробивает потолок даже на абсурдном балансе", () => {
    expect(discountFromGrains(1e18)).toBe(DISCOUNT_MAX);
  });

  it("устойчива к нечисловым значениям", () => {
    expect(discountFromGrains(Number.NaN)).toBe(0);
    expect(discountFromGrains(Number.POSITIVE_INFINITY)).toBe(0);
    expect(discountFromGrains(-100)).toBe(0);
  });
});

describe("discountProgress", () => {
  it("на нуле показывает путь к первому проценту", () => {
    const progress = discountProgress(0);
    expect(progress.percent).toBe(0);
    expect(progress.nextPercent).toBe(1);
    expect(progress.grainsToNext).toBe(FIRST_PERCENT_COST);
    expect(progress.ratio).toBe(0);
  });

  it("на середине интервала отдаёт долю от нуля до единицы", () => {
    const floor = grainsForDiscount(3);
    const ceiling = grainsForDiscount(4);
    const progress = discountProgress((floor + ceiling) / 2);

    expect(progress.percent).toBe(3);
    expect(progress.ratio).toBeGreaterThan(0.4);
    expect(progress.ratio).toBeLessThan(0.6);
    expect(progress.grainsToNext).toBeGreaterThan(0);
  });

  it("на потолке следующего процента нет", () => {
    const progress = discountProgress(grainsForDiscount(DISCOUNT_MAX) * 2);
    expect(progress.percent).toBe(DISCOUNT_MAX);
    expect(progress.nextPercent).toBeNull();
    expect(progress.grainsToNext).toBe(0);
    expect(progress.ratio).toBe(1);
  });
});

describe("улучшения", () => {
  it("цена растёт с уровнем", () => {
    const paws = getUpgrade("paws");
    expect(upgradeCost(paws, 0)).toBe(paws.baseCost);
    expect(upgradeCost(paws, 1)).toBeGreaterThan(upgradeCost(paws, 0));
    expect(upgradeCost(paws, 5)).toBeGreaterThan(upgradeCost(paws, 4));
  });

  it("цена всегда целая", () => {
    for (const upgrade of UPGRADES) {
      for (let level = 0; level < upgrade.maxLevel; level += 1) {
        expect(Number.isInteger(upgradeCost(upgrade, level))).toBe(true);
      }
    }
  });

  it("на максимальном уровне купить нельзя ни за какие зёрна", () => {
    const paws = getUpgrade("paws");
    expect(canAffordUpgrade(paws, paws.maxLevel, Number.MAX_SAFE_INTEGER)).toBe(false);
  });

  it("без денег купить нельзя", () => {
    const paws = getUpgrade("paws");
    expect(canAffordUpgrade(paws, 0, paws.baseCost - 1)).toBe(false);
    expect(canAffordUpgrade(paws, 0, paws.baseCost)).toBe(true);
  });

  it("неизвестный идентификатор — это ошибка, а не тихий undefined", () => {
    // Приведение намеренное: проверяем защиту от рассинхрона данных и типов.
    expect(() => getUpgrade("nope" as UpgradeId)).toThrow(/Неизвестное улучшение/);
  });
});

describe("производство", () => {
  it("без улучшений тап стоит базовую величину", () => {
    expect(tapValue(levels())).toBe(BASE_TAP_VALUE);
    expect(passiveRate(levels())).toBe(0);
  });

  it("тап-улучшения складываются, пассивные на тап не влияют", () => {
    expect(tapValue(levels({ paws: 3, chopsticks: 2 }))).toBe(BASE_TAP_VALUE + 3 * 1 + 2 * 5);
    expect(tapValue(levels({ cooker: 10 }))).toBe(BASE_TAP_VALUE);
  });

  it("пассивные улучшения складываются, тап-улучшения на пассив не влияют", () => {
    expect(passiveRate(levels({ cooker: 4, waiter: 2 }))).toBe(4 * 1 + 2 * 8);
    expect(passiveRate(levels({ paws: 10 }))).toBe(0);
  });
});

describe("комбо", () => {
  it("в покое множителя нет, на полном жаре он двойной", () => {
    expect(heatMultiplier(0)).toBe(1);
    expect(heatMultiplier(HEAT_MAX)).toBe(2);
  });

  it("выход за границы обрезается", () => {
    expect(heatMultiplier(-1)).toBe(1);
    expect(heatMultiplier(99)).toBe(2);
  });

  it("награда за тап учитывает и улучшения, и жар", () => {
    expect(grainsPerTap(levels({ paws: 1 }), HEAT_MAX)).toBe((BASE_TAP_VALUE + 1) * 2);
  });
});

describe("clamp", () => {
  it("зажимает значение между границами", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
  });
});
