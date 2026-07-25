import { describe, expect, it } from "vitest";
import { createParticleEngine } from "./engine";

/** Детерминированный источник «случайности» вместо Math.random. */
function sequence(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[index % values.length] ?? 0.5;
    index += 1;
    return value;
  };
}

const NOW = 1_700_000_000_000;

function engine(capacity = 64) {
  return createParticleEngine({ capacity, random: sequence([0.5, 0.2, 0.8, 0.35, 0.65]) });
}

describe("создание частиц", () => {
  it("тап рождает зёрна и одно число", () => {
    const particles = engine();
    particles.burst(100, 100, 7, NOW);

    const alive = particles.particles.filter((particle) => particle.active);
    expect(alive.filter((particle) => particle.kind === "grain").length).toBeGreaterThanOrEqual(3);
    expect(alive.filter((particle) => particle.kind === "score")).toHaveLength(1);
  });

  it("число несёт величину награды", () => {
    const particles = engine();
    particles.burst(0, 0, 42, NOW);

    const score = particles.particles.find((particle) => particle.kind === "score");
    expect(score?.value).toBe(42);
  });

  it("частые тапы не заваливают экран числами", () => {
    const particles = engine();
    const scores = () =>
      particles.particles.filter((particle) => particle.active && particle.kind === "score").length;

    // Десять тапов внутри одного окна дросселирования дают одно число.
    for (let index = 0; index < 10; index += 1) {
      particles.burst(0, 0, 1, NOW + index * 10);
    }
    expect(scores()).toBe(1);

    // За пределами окна появляется следующее.
    particles.burst(0, 0, 1, NOW + 400);
    expect(scores()).toBe(2);
  });

  it("зёрна летят вверх", () => {
    const particles = engine();
    particles.burst(0, 0, 1, NOW);

    for (const particle of particles.particles) {
      if (particle.active && particle.kind === "grain") {
        expect(particle.vy).toBeLessThan(0);
      }
    }
  });
});

describe("жизненный цикл", () => {
  it("частицы гаснут по истечении срока", () => {
    const particles = engine();
    particles.burst(0, 0, 1, NOW);
    expect(particles.activeCount()).toBeGreaterThan(0);

    particles.step(NOW);
    for (let elapsed = 16; elapsed <= 2_000; elapsed += 16) {
      particles.step(NOW + elapsed);
    }

    expect(particles.activeCount()).toBe(0);
  });

  it("гравитация тянет зёрна вниз", () => {
    const particles = engine();
    particles.burst(0, 0, 1, NOW);
    particles.step(NOW);

    const grain = particles.particles.find(
      (particle) => particle.active && particle.kind === "grain",
    );
    const initialVy = grain?.vy ?? 0;

    particles.step(NOW + 32);
    expect(grain?.vy).toBeGreaterThan(initialVy);
  });

  it("длинная пауза не телепортирует частицы", () => {
    const particles = engine();
    particles.burst(0, 500, 1, NOW);
    particles.step(NOW);

    const grain = particles.particles.find(
      (particle) => particle.active && particle.kind === "grain",
    );
    const startY = grain?.y ?? 0;

    // Вкладка была свёрнута десять секунд.
    particles.step(NOW + 10_000);

    expect(Math.abs((grain?.y ?? 0) - startY)).toBeLessThan(100);
  });
});

describe("пул объектов", () => {
  it("не выходит за отведённый размер", () => {
    const capacity = 32;
    const particles = createParticleEngine({ capacity, random: sequence([0.5]) });

    for (let index = 0; index < 200; index += 1) {
      particles.burst(0, 0, 1, NOW + index * 500);
    }

    expect(particles.particles).toHaveLength(capacity);
    expect(particles.activeCount()).toBeLessThanOrEqual(capacity);
  });

  it("переиспользует слоты после угасания", () => {
    const particles = engine(16);
    particles.burst(0, 0, 1, NOW);
    particles.step(NOW);

    for (let elapsed = 16; elapsed <= 2_000; elapsed += 16) {
      particles.step(NOW + elapsed);
    }
    expect(particles.activeCount()).toBe(0);

    particles.burst(0, 0, 1, NOW + 3_000);
    expect(particles.activeCount()).toBeGreaterThan(0);
    expect(particles.particles).toHaveLength(16);
  });

  it("сброс гасит всё разом", () => {
    const particles = engine();
    particles.burst(0, 0, 1, NOW);
    particles.clear();

    expect(particles.activeCount()).toBe(0);
  });
});
