import { describe, expect, it } from "vitest";
import { DISCOUNT_MAX, PASSIVE_CAP_RATIO } from "./constants";
import { PERSONAS, type Persona, simulate } from "./simulator";

/**
 * Балансировочные тесты. Это не проверка кода, а проверка ЭКОНОМИКИ:
 * если константы уедут, средний гость перестанет попадать в 11–15% и тест упадёт.
 * Менять коридоры можно только вместе с продуктовым решением.
 */

const BANDS: Record<string, readonly [number, number]> = {
  "kid-casual": [4, 8],
  "average-guest": [11, 15],
  "kid-engaged": [15, 19],
  "kid-hooked": [18, 22],
  "adult-max": [19, 23],
  autoclicker: [22, 26],
  idler: [4, 8],
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

describe("помощники", () => {
  /**
   * Главный инвариант механики помощников: продолжать играть всегда выгоднее,
   * чем положить телефон. Сравниваются персоны с ОДИНАКОВЫМ темпом тапа и
   * одинаковой стратегией покупок — иначе тест мерил бы не простой, а разницу
   * в умении покупать улучшения.
   */
  it("при равном темпе больше игры — больше скидка", () => {
    const sameTempo = ["idler", "kid-engaged", "kid-hooked"].map((id) =>
      PERSONAS.find((persona) => persona.id === id),
    );

    const discounts = sameTempo.map((persona) => {
      expect(persona, "персона исчезла из набора").toBeDefined();
      return persona ? simulate(persona).discount : 0;
    });

    for (let i = 1; i < discounts.length; i += 1) {
      const previous = discounts[i - 1];
      const current = discounts[i];
      if (previous === undefined || current === undefined) {
        continue;
      }
      expect(current).toBeGreaterThan(previous);
    }
  });

  /**
   * Потолок пассива задан долей от натапанного, поэтому его вклад в заработок
   * не может превысить `ratio / (1 + ratio)`. Проверяется на всех персонах:
   * если где-то доля вылезла выше, потолок обходится.
   */
  it("пассив не может стать основным источником зёрен", () => {
    const maxShare = PASSIVE_CAP_RATIO / (1 + PASSIVE_CAP_RATIO);

    for (const persona of PERSONAS) {
      const { state } = simulate(persona);
      const passive = state.totalGrains - state.tapGrains;
      const share = state.totalGrains === 0 ? 0 : passive / state.totalGrains;

      expect(
        share,
        `${persona.label}: пассив дал ${Math.round(share * 100)}% заработка`,
      ).toBeLessThanOrEqual(maxShare + 1e-9);
    }
  });

  it("без вложений в нажатие помощники почти ничего не дают", () => {
    const barelyPlaying: Persona = {
      id: "barely",
      label: "Почти не играл",
      tapsPerSecond: 6,
      activeMinutes: 1,
      strategy: "greedy",
    };

    // Помощники считаются долей силы тапа, поэтому умножать им нечего.
    expect(simulate(barelyPlaying).discount).toBeLessThan(5);
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
