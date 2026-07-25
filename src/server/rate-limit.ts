/**
 * Скользящее окно в памяти процесса.
 *
 * Задача — не «остановить читера», а не дать одному клиенту завалить сервер
 * запросами. От накрутки скидки защищает экономика: лимит частоты тапов внутри
 * игрового ядра работает по серверным часам и не зависит от того, сколько
 * запросов пришло.
 *
 * ОГРАНИЧЕНИЕ: состояние в памяти. Несколько экземпляров приложения будут
 * считать независимо, а перезапуск обнуляет счётчики.
 */

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly retryAfterMs: number;
}

export interface RateLimiterOptions {
  readonly limit: number;
  readonly windowMs: number;
  /** Защита от неограниченного роста при обстреле разными ключами. */
  readonly maxKeys?: number;
}

const DEFAULT_MAX_KEYS = 10_000;

export function createRateLimiter(options: RateLimiterOptions) {
  const { limit, windowMs, maxKeys = DEFAULT_MAX_KEYS } = options;
  const hits = new Map<string, number[]>();

  return function check(key: string, now: number): RateLimitResult {
    const previous = hits.get(key) ?? [];
    const fresh = previous.filter((at) => now - at < windowMs);

    if (fresh.length >= limit) {
      const oldest = fresh[0] ?? now;
      hits.set(key, fresh);
      return { allowed: false, retryAfterMs: Math.max(0, windowMs - (now - oldest)) };
    }

    fresh.push(now);
    hits.set(key, fresh);

    if (hits.size > maxKeys) {
      evictStale(hits, now, windowMs);
    }

    return { allowed: true, retryAfterMs: 0 };
  };
}

function evictStale(hits: Map<string, number[]>, now: number, windowMs: number): void {
  for (const [key, timestamps] of hits) {
    const last = timestamps.at(-1);
    if (last === undefined || now - last >= windowMs) {
      hits.delete(key);
    }
  }
}
