/**
 * Система частиц: зёрна риса и всплывающее «+N».
 *
 * Живёт вне React полностью. При пятнадцати тапах в секунду это семьдесят пять
 * рождений частиц в секунду — прогонять такое через рендер бессмысленно.
 *
 * Пул объектов преаллоцирован: в разгар игры сборщик мусора не должен получать
 * повода просыпаться посреди анимации.
 *
 * Случайность здесь допустима. Запрет на `Math.random` касается `src/game`, где
 * рандом в награде превратил бы акцию в лотерею по 138-ФЗ. Разлёт зёрен на
 * начисление не влияет никак. Источник случайности инъектируется, чтобы тесты
 * оставались детерминированными.
 */

export type ParticleKind = "grain" | "score";

export interface Particle {
  active: boolean;
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Прожитое время в миллисекундах. */
  age: number;
  lifetime: number;
  size: number;
  rotation: number;
  spin: number;
  /** Для «+N»: сколько зёрен принёс тап. */
  value: number;
}

export interface ParticleEngineOptions {
  readonly capacity?: number;
  readonly random?: () => number;
}

const DEFAULT_CAPACITY = 240;

const GRAVITY = 1_600;
const GRAIN_LIFETIME_MS = 720;
const GRAIN_SPEED_MIN = 220;
const GRAIN_SPEED_MAX = 460;
const GRAIN_SIZE_MIN = 4;
const GRAIN_SIZE_MAX = 9;
const GRAIN_SPIN = 7;

const SCORE_LIFETIME_MS = 820;
const SCORE_RISE_SPEED = 130;
const SCORE_SPREAD_X = 110;
const SCORE_DRIFT_X = 40;
const SCORE_OFFSET_Y = 30;

/** Больше одного «+N» за это время не показываем: иначе цифры сливаются. */
const SCORE_THROTTLE_MS = 140;

/** Шаг обрезается, чтобы после паузы частицы не улетали одним прыжком. */
const MAX_STEP_MS = 64;

export interface ParticleEngine {
  /** Всплеск от тапа. Координаты — в системе холста. */
  burst(x: number, y: number, value: number, now: number): void;
  step(now: number): void;
  readonly particles: readonly Particle[];
  activeCount(): number;
  clear(): void;
}

export function createParticleEngine(options: ParticleEngineOptions = {}): ParticleEngine {
  const { capacity = DEFAULT_CAPACITY, random = Math.random } = options;

  const particles: Particle[] = Array.from({ length: capacity }, () => ({
    active: false,
    kind: "grain",
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    age: 0,
    lifetime: 0,
    size: 0,
    rotation: 0,
    spin: 0,
    value: 0,
  }));

  let cursor = 0;
  let lastStep: number | null = null;
  let lastScoreAt = Number.NEGATIVE_INFINITY;

  /**
   * Кольцевой поиск свободного слота. Если свободных нет, переиспользуется
   * самая старая частица: пропавшее зерно заметить нельзя, а просадку кадров —
   * можно.
   */
  const take = (): Particle => {
    for (let probe = 0; probe < capacity; probe += 1) {
      const candidate = particles[(cursor + probe) % capacity];
      if (candidate && !candidate.active) {
        cursor = (cursor + probe + 1) % capacity;
        return candidate;
      }
    }

    const fallback = particles[cursor] as Particle;
    cursor = (cursor + 1) % capacity;
    return fallback;
  };

  const spread = (min: number, max: number): number => min + random() * (max - min);

  return {
    particles,

    burst(x, y, value, now) {
      const count = 3 + Math.floor(random() * 3);

      for (let index = 0; index < count; index += 1) {
        const angle = -Math.PI / 2 + (random() - 0.5) * 1.5;
        const speed = spread(GRAIN_SPEED_MIN, GRAIN_SPEED_MAX);
        const grain = take();

        grain.active = true;
        grain.kind = "grain";
        grain.x = x + (random() - 0.5) * 26;
        grain.y = y + (random() - 0.5) * 18;
        grain.vx = Math.cos(angle) * speed;
        grain.vy = Math.sin(angle) * speed;
        grain.age = 0;
        grain.lifetime = GRAIN_LIFETIME_MS * spread(0.8, 1.2);
        grain.size = spread(GRAIN_SIZE_MIN, GRAIN_SIZE_MAX);
        grain.rotation = random() * Math.PI;
        grain.spin = (random() - 0.5) * GRAIN_SPIN;
        grain.value = 0;
      }

      if (now - lastScoreAt < SCORE_THROTTLE_MS) {
        return;
      }
      lastScoreAt = now;

      const score = take();
      score.active = true;
      score.kind = "score";
      // Разброс обязателен: палец бьёт примерно в одну точку, и без него
      // числа ложатся друг на друга и превращаются в нечитаемое пятно.
      score.x = x + (random() - 0.5) * SCORE_SPREAD_X;
      score.y = y - SCORE_OFFSET_Y;
      score.vx = (random() - 0.5) * SCORE_DRIFT_X;
      score.vy = -SCORE_RISE_SPEED;
      score.age = 0;
      score.lifetime = SCORE_LIFETIME_MS;
      score.size = 0;
      score.rotation = 0;
      score.spin = 0;
      score.value = value;
    },

    step(now) {
      const previous = lastStep ?? now;
      lastStep = now;

      const deltaMs = Math.min(Math.max(0, now - previous), MAX_STEP_MS);
      if (deltaMs === 0) {
        return;
      }
      const delta = deltaMs / 1000;

      for (const particle of particles) {
        if (!particle.active) {
          continue;
        }

        particle.age += deltaMs;
        if (particle.age >= particle.lifetime) {
          particle.active = false;
          continue;
        }

        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;

        if (particle.kind === "grain") {
          particle.vy += GRAVITY * delta;
          particle.rotation += particle.spin * delta;
        } else {
          // «+N» замедляется к концу подъёма, а не летит равномерно.
          particle.vy *= 1 - Math.min(1, delta * 2.2);
        }
      }
    },

    activeCount() {
      return particles.reduce((total, particle) => total + (particle.active ? 1 : 0), 0);
    },

    clear() {
      for (const particle of particles) {
        particle.active = false;
      }
      lastStep = null;
      lastScoreAt = Number.NEGATIVE_INFINITY;
    },
  };
}
