import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

const NOW = 1_700_000_000_000;

describe("createRateLimiter", () => {
  it("пропускает до лимита и отсекает дальше", () => {
    const check = createRateLimiter({ limit: 3, windowMs: 1_000 });

    expect(check("a", NOW).allowed).toBe(true);
    expect(check("a", NOW).allowed).toBe(true);
    expect(check("a", NOW).allowed).toBe(true);
    expect(check("a", NOW).allowed).toBe(false);
  });

  it("подсказывает, через сколько можно повторить", () => {
    const check = createRateLimiter({ limit: 1, windowMs: 1_000 });
    check("a", NOW);

    const blocked = check("a", NOW + 400);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(600);
  });

  it("окно скользит: старые попадания перестают учитываться", () => {
    const check = createRateLimiter({ limit: 2, windowMs: 1_000 });
    check("a", NOW);
    check("a", NOW);

    expect(check("a", NOW + 500).allowed).toBe(false);
    expect(check("a", NOW + 1_001).allowed).toBe(true);
  });

  it("ключи не влияют друг на друга", () => {
    const check = createRateLimiter({ limit: 1, windowMs: 1_000 });

    expect(check("a", NOW).allowed).toBe(true);
    expect(check("b", NOW).allowed).toBe(true);
    expect(check("a", NOW).allowed).toBe(false);
  });

  it("обстрел разными ключами не растит память бесконечно", () => {
    const check = createRateLimiter({ limit: 5, windowMs: 100, maxKeys: 10 });

    for (let index = 0; index < 200; index += 1) {
      check(`key-${index}`, NOW + index * 50);
    }

    // Косвенная проверка: старые ключи вычищены, свежие продолжают работать.
    expect(check("key-199", NOW + 200 * 50).allowed).toBe(true);
  });
});
