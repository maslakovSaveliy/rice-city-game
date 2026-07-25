import { describe, expect, it } from "vitest";
import { DISCOUNT_MAX } from "./constants";
import { PERSONAS, type Persona, simulate } from "./simulator";

/**
 * Балансировочные тесты. Это не проверка кода, а проверка ЭКОНОМИКИ:
 * если константы уедут, средний гость перестанет попадать в 10–16% и тест упадёт.
 * Менять коридоры можно только вместе с продуктовым решением.
 */

const BANDS: Record<string, readonly [number, number]> = {
  "kid-casual": [6, 12],
  "average-guest": [10, 16],
  "kid-engaged": [16, 22],
  "adult-max": [23, 28],
  autoclicker: [26, 30],
};

describe("баланс экономики по персонам", () => {
  for (const persona of PERSONAS) {
    it(`${persona.label} укладывается в коридор`, () => {
      const band = BANDS[persona.id];
      expect(band, `нет коридора для персоны ${persona.id}`).toBeDefined();
      if (!band) {
        return;
      }

      const result = simulate(persona);
      const [min, max] = band;

      expect(
        result.discount,
        `${persona.label}: получено ${result.discount}%, ожидалось ${min}–${max}%. ` +
          `Зёрен: ${Math.round(result.grains)}, тапов: ${result.taps}`,
      ).toBeGreaterThanOrEqual(min);
      expect(result.discount).toBeLessThanOrEqual(max);
    });
  }
});

describe("потолок скидки", () => {
  it("ни одна персона не пробивает 30%", () => {
    for (const persona of PERSONAS) {
      expect(simulate(persona).discount).toBeLessThanOrEqual(DISCOUNT_MAX);
    }
  });

  it("нереалистичный темп тапа всё равно упирается в потолок", () => {
    const cheater: Persona = {
      id: "impossible",
      label: "Невозможный темп",
      tapsPerSecond: 200,
      activeMinutes: 60,
      strategy: "smart",
    };
    expect(simulate(cheater).discount).toBeLessThanOrEqual(DISCOUNT_MAX);
  });
});

describe("монотонность", () => {
  it("больше активной игры — не меньше скидки", () => {
    const base: Omit<Persona, "activeMinutes" | "id"> = {
      label: "Проба",
      tapsPerSecond: 5,
      strategy: "none",
    };

    const results = [10, 20, 30, 40].map((activeMinutes) =>
      simulate({ ...base, id: `probe-${activeMinutes}`, activeMinutes }),
    );

    for (let i = 1; i < results.length; i += 1) {
      const previous = results[i - 1];
      const current = results[i];
      expect(previous).toBeDefined();
      expect(current).toBeDefined();
      if (!previous || !current) {
        continue;
      }
      expect(current.discount).toBeGreaterThanOrEqual(previous.discount);
    }
  });
});
