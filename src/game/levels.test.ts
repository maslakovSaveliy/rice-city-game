import { describe, expect, it } from "vitest";
import { DISCOUNT_MAX } from "./constants";
import { MASCOT_LEVELS, mascotLevelFor } from "./levels";

describe("уровень Рисинки", () => {
  it("до десяти процентов — первый", () => {
    expect(mascotLevelFor(0)).toBe(1);
    expect(mascotLevelFor(9)).toBe(1);
  });

  it("десять процентов уже второй: границы принадлежат старшему уровню", () => {
    expect(mascotLevelFor(10)).toBe(2);
    expect(mascotLevelFor(19)).toBe(2);
  });

  it("двадцать процентов — третий, и он же держится до потолка", () => {
    expect(mascotLevelFor(20)).toBe(3);
    expect(mascotLevelFor(DISCOUNT_MAX)).toBe(3);
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
