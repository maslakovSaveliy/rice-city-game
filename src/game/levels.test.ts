import { describe, expect, it } from "vitest";
import { DISCOUNT_MAX } from "./constants";
import { MASCOT_LEVELS, mascotLevelFor, SECOND_LEVEL_AT, THIRD_LEVEL_AT } from "./levels";

describe("уровень Рисинки", () => {
  it("ниже второго порога — первый", () => {
    expect(mascotLevelFor(0)).toBe(1);
    expect(mascotLevelFor(SECOND_LEVEL_AT - 1)).toBe(1);
  });

  it("на пороге уже следующий уровень: границы принадлежат старшему", () => {
    expect(mascotLevelFor(SECOND_LEVEL_AT)).toBe(2);
    expect(mascotLevelFor(THIRD_LEVEL_AT - 1)).toBe(2);
  });

  it("третий уровень начинается со своего порога и держится до потолка", () => {
    expect(mascotLevelFor(THIRD_LEVEL_AT)).toBe(3);
    expect(mascotLevelFor(DISCOUNT_MAX)).toBe(3);
  });

  /**
   * Пороги обязаны умещаться в шкалу. Прежде третий уровень стоял на 20% при
   * потолке 30, и при снижении потолка до 15 облик на троне стал недостижим —
   * молча, потому что ни один тест этого не проверял.
   */
  it("оба порога достижимы при текущем потолке", () => {
    expect(SECOND_LEVEL_AT).toBeLessThan(THIRD_LEVEL_AT);
    expect(THIRD_LEVEL_AT).toBeLessThanOrEqual(DISCOUNT_MAX);
  });

  it("значения за пределами шкалы не роняют уровень", () => {
    expect(mascotLevelFor(-5)).toBe(1);
    expect(mascotLevelFor(DISCOUNT_MAX * 10)).toBe(3);
  });

  it("уровень всегда из объявленного набора", () => {
    for (let percent = 0; percent <= DISCOUNT_MAX; percent += 1) {
      expect(MASCOT_LEVELS).toContain(mascotLevelFor(percent));
    }
  });

  it("уровень не понижается с ростом процента", () => {
    let previous = mascotLevelFor(0);
    for (let percent = 1; percent <= DISCOUNT_MAX; percent += 1) {
      const current = mascotLevelFor(percent);
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });
});
