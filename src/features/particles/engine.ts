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
const GRAIN_LIFETIME_MS = 640;
/**
 * Зерно обязано быстро покинуть кремовую подложку Рисинки.
 *
 * Всплеск рождается под пальцем, то есть всегда внутри подложки. На прежних
 * 220 px/с зерно проводило там первые триста миллисекунд и на светлом фоне
 * читалось как мусор поверх лица маскота. Скорость поднята так, чтобы зерно
 * вылетало за пределы подложки примерно за сто миллисекунд.
 */
const GRAIN_SPEED_MIN = 360;
const GRAIN_SPEED_MAX = 640;
const GRAIN_SIZE_MIN = 4;
const GRAIN_SIZE_MAX = 9;
const GRAIN_SPIN = 7;

/**
 * Разброс точки рождения. Намеренно тесный: расходиться зёрна должны
 * скоростью, а не стартовым пятном — иначе всплеск начинается кляксой
 * во всю ширину лица.
 */
const GRAIN_ORIGIN_SPREAD_X = 14;
const GRAIN_ORIGIN_SPREAD_Y = 10;

/**
 * Полный угол веера вокруг вертикали, радианы.
 *
 * Раньше 1.5: зёрна били почти строго вверх. Когда они стали рождаться на
 * кромке подложки, узкий веер собирал их в одну струю над головой. Ширина
 * доведена до ±74°, чтобы рис выходил и с боков.
 */
const GRAIN_FAN = 2.6;

const SCORE_LIFETIME_MS = 700;
/**
 * Подъём «+N». Поднят вместе с общей стартовой линией: числа теперь рождаются
 * на одной высоте, и разводит их только скорость. На прежних 130 px/с с
 * затуханием подряд идущие числа вставали друг на друга.
 */
const SCORE_RISE_SPEED = 230;
const SCORE_SPREAD_X = 110;
const SCORE_DRIFT_X = 40;
const SCORE_OFFSET_Y = 30;
/** Затухание подъёма за секунду. Мягче прежних 2.2: числа успевают разойтись. */
const SCORE_DECAY = 1.2;

/**
 * Больше одного «+N» за это время не показываем: иначе цифры сливаются.
 *
 * Порог поднят вместе с переносом чисел на общую стартовую линию: раньше их
 * разводила по вертикали разная точка касания, теперь — только скорость
 * подъёма. За двести миллисекунд соседние числа расходятся на двадцать шесть
 * пикселей, и это читается.
 */
const SCORE_THROTTLE_MS = 200;

/** Шаг обрезается, чтобы после паузы частицы не улетали одним прыжком. */
const MAX_STEP_MS = 64;

/**
 * Параметры всплеска. Объект, а не позиционные аргументы: холст лежит за
 * Рисинкой, и чтобы всплеск был виден, движку нужна её геометрия — иначе
 * список разросся бы до шести безымянных чисел подряд.
 */
export interface BurstOptions {
  /** Точка касания в системе холста. */
  readonly x: number;
  readonly y: number;
  readonly value: number;
  readonly now: number;
  /**
   * Радиус, на котором рождаются зёрна, считая от точки касания.
   *
   * Ноль — прежнее поведение, всплеск прямо под пальцем. Для игрового экрана
   * сюда идёт полуширина подложки: зёрна появляются сразу на её кромке и
   * летят наружу. Без этого они рождались и гасли под непрозрачной подложкой,
   * не показавшись ни разу.
   */
  readonly spawnRadius?: number;
  /**
   * Высота, на которой рождается «+N». Без неё число встаёт над пальцем —
   * то есть под подложкой, где его не видно.
   */
  readonly scoreY?: number;
}

export interface ParticleEngine {
  burst(options: BurstOptions): void;
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

    burst({ x, y, value, now, spawnRadius = 0, scoreY }) {
      const count = 3 + Math.floor(random() * 3);

      for (let index = 0; index < count; index += 1) {
        const angle = -Math.PI / 2 + (random() - 0.5) * GRAIN_FAN;
        const speed = spread(GRAIN_SPEED_MIN, GRAIN_SPEED_MAX);
        const grain = take();

        grain.active = true;
        grain.kind = "grain";
        // Зерно рождается на радиусе по направлению своего же полёта: так оно
        // выходит из-за подложки ровно с той стороны, куда летит.
        grain.x = x + Math.cos(angle) * spawnRadius + (random() - 0.5) * GRAIN_ORIGIN_SPREAD_X;
        grain.y = y + Math.sin(angle) * spawnRadius + (random() - 0.5) * GRAIN_ORIGIN_SPREAD_Y;
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

      /**
       * Число на экране всегда одно.
       *
       * Все «+N» рождаются на общей линии над подложкой, и дросселирования
       * мало: соседние всё равно наезжали друг на друга и превращались в
       * оранжевую кашу. Одно живое число читается с первого взгляда — это
       * важнее ощущения потока, тем более что поток несут зёрна.
       */
      for (const particle of particles) {
        if (particle.active && particle.kind === "score") {
          particle.active = false;
        }
      }

      const score = take();
      score.active = true;
      score.kind = "score";
      // Разброс обязателен: палец бьёт примерно в одну точку, и без него
      // числа ложатся друг на друга и превращаются в нечитаемое пятно.
      score.x = x + (random() - 0.5) * SCORE_SPREAD_X;
      score.y = scoreY ?? y - SCORE_OFFSET_Y;
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
          particle.vy *= 1 - Math.min(1, delta * SCORE_DECAY);
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
