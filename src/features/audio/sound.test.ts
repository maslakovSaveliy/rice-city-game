import { describe, expect, it, vi } from "vitest";
import { createSoundPlayer } from "./sound";

/** Минимальная подделка Web Audio: считает, сколько раз звук был извлечён. */
function createFakeAudio() {
  const started: number[] = [];

  const param = () => ({
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  });

  const context = {
    currentTime: 0,
    state: "running" as AudioContextState,
    resume: vi.fn(),
    destination: {},
    createOscillator: () => ({
      type: "sine",
      frequency: param(),
      connect: vi.fn(),
      start: (at: number) => started.push(at),
      stop: vi.fn(),
    }),
    createGain: () => ({ gain: param(), connect: vi.fn() }),
  };

  return { context: context as unknown as AudioContext, started };
}

function createFakeStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    values,
  };
}

describe("звук тапа", () => {
  it("извлекается при тапе", () => {
    const audio = createFakeAudio();
    let time = 0;
    const player = createSoundPlayer({
      createContext: () => audio.context,
      storage: createFakeStorage(),
      now: () => time,
    });

    player.playTap(0);
    time += 100;
    player.playTap(0.5);

    expect(audio.started).toHaveLength(2);
  });

  it("частые тапы не складываются в кашу", () => {
    const audio = createFakeAudio();
    let time = 0;
    const player = createSoundPlayer({
      createContext: () => audio.context,
      storage: createFakeStorage(),
      now: () => time,
    });

    // Пятнадцать тапов в секунду — это интервал около 66 мс, но подряд
    // без паузы звук должен прореживаться.
    for (let index = 0; index < 10; index += 1) {
      player.playTap(0);
      time += 10;
    }

    expect(audio.started.length).toBeLessThan(10);
    expect(audio.started.length).toBeGreaterThan(0);
  });

  it("выключенный звук молчит", () => {
    const audio = createFakeAudio();
    const player = createSoundPlayer({
      createContext: () => audio.context,
      storage: createFakeStorage(),
      now: () => 0,
    });

    player.setMuted(true);
    player.playTap(1);

    expect(audio.started).toHaveLength(0);
  });

  it("выбор запоминается между сессиями", () => {
    const storage = createFakeStorage();
    const first = createSoundPlayer({ createContext: () => null, storage, now: () => 0 });

    expect(first.isMuted()).toBe(false);
    first.setMuted(true);

    const second = createSoundPlayer({ createContext: () => null, storage, now: () => 0 });
    expect(second.isMuted()).toBe(true);
  });

  it("отсутствие Web Audio не роняет игру", () => {
    const player = createSoundPlayer({
      createContext: () => null,
      storage: createFakeStorage(),
      now: () => 0,
    });

    expect(() => player.playTap(0.5)).not.toThrow();
  });

  it("недоступное хранилище не мешает переключать звук", () => {
    const player = createSoundPlayer({ createContext: () => null, storage: null, now: () => 0 });

    expect(() => player.setMuted(true)).not.toThrow();
    expect(player.isMuted()).toBe(true);
  });

  it("контекст создаётся лениво, а не при загрузке модуля", () => {
    const audio = createFakeAudio();
    const createContext = vi.fn(() => audio.context);
    const player = createSoundPlayer({
      createContext,
      storage: createFakeStorage(),
      now: () => 0,
    });

    // Мобильные браузеры не дают завести звук без жеста пользователя.
    expect(createContext).not.toHaveBeenCalled();

    player.playTap(0);
    expect(createContext).toHaveBeenCalledTimes(1);
  });
});
