/**
 * Звук тапа.
 *
 * Синтезируется на месте через Web Audio, а не грузится файлом. Причин две:
 * в бандл не приезжает ни килобайта, и высоту тона можно связать с комбо —
 * чем горячее серия, тем выше «ток», и разгон слышно.
 *
 * Тембр деревянный и короткий, под тактильный тон бренда. Ничего звонкого и
 * электронного: игра стоит на столе в зале, а не в аркадном автомате.
 */

export interface SoundPlayer {
  /** `heat` от 0 до 1 — поднимает тон вместе с комбо. */
  playTap(heat: number): void;
  setMuted(muted: boolean): void;
  isMuted(): boolean;
}

export interface SoundPlayerOptions {
  readonly createContext?: () => AudioContext | null;
  readonly storage?: Pick<Storage, "getItem" | "setItem"> | null;
  readonly now?: () => number;
}

const STORAGE_KEY = "rc_sound_muted";

/** Тише этого звук теряется, громче — раздражает соседний стол. */
const MASTER_GAIN = 0.09;

const BASE_FREQUENCY = 520;
const HEAT_FREQUENCY_GAIN = 340;
const DECAY_SECONDS = 0.085;

/** Пятнадцать тапов в секунду складывались бы в кашу. */
const MIN_INTERVAL_MS = 45;

export function createSoundPlayer(options: SoundPlayerOptions = {}): SoundPlayer {
  const {
    createContext = defaultContextFactory,
    storage = safeStorage(),
    now = () => performance.now(),
  } = options;

  let context: AudioContext | null = null;
  let muted = storage?.getItem(STORAGE_KEY) === "1";
  let lastPlayedAt = Number.NEGATIVE_INFINITY;

  /**
   * Контекст создаётся лениво, при первом же тапе. Мобильные браузеры не дают
   * запустить звук без жеста пользователя, а тап — как раз он.
   */
  const ensureContext = (): AudioContext | null => {
    if (context === null) {
      context = createContext();
    }
    if (context !== null && context.state === "suspended") {
      void context.resume();
    }
    return context;
  };

  return {
    isMuted: () => muted,

    setMuted(next) {
      muted = next;
      storage?.setItem(STORAGE_KEY, next ? "1" : "0");
    },

    playTap(heat) {
      if (muted) {
        return;
      }

      const at = now();
      if (at - lastPlayedAt < MIN_INTERVAL_MS) {
        return;
      }
      lastPlayedAt = at;

      const audio = ensureContext();
      if (audio === null) {
        return;
      }

      const startedAt = audio.currentTime;
      const clampedHeat = Math.min(1, Math.max(0, heat));

      const oscillator = audio.createOscillator();
      oscillator.type = "triangle";
      oscillator.frequency.setValueAtTime(
        BASE_FREQUENCY + clampedHeat * HEAT_FREQUENCY_GAIN,
        startedAt,
      );
      // Лёгкий спад тона: сухой щелчок вместо длинного писка.
      oscillator.frequency.exponentialRampToValueAtTime(
        BASE_FREQUENCY * 0.62,
        startedAt + DECAY_SECONDS,
      );

      const envelope = audio.createGain();
      envelope.gain.setValueAtTime(MASTER_GAIN, startedAt);
      envelope.gain.exponentialRampToValueAtTime(0.0001, startedAt + DECAY_SECONDS);

      oscillator.connect(envelope);
      envelope.connect(audio.destination);

      oscillator.start(startedAt);
      oscillator.stop(startedAt + DECAY_SECONDS);
    },
  };
}

function defaultContextFactory(): AudioContext | null {
  if (typeof window === "undefined" || typeof AudioContext === "undefined") {
    return null;
  }
  try {
    return new AudioContext();
  } catch {
    // Политика браузера или отсутствие устройства вывода. Молчание — не ошибка.
    return null;
  }
}

function safeStorage(): Pick<Storage, "getItem" | "setItem"> | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export const soundPlayer = createSoundPlayer();
