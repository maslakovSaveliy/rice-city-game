import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionAction } from "@/game/actions";
import { applyTapBatch } from "@/game/batch";
import { SESSION_DURATION_MS, TAP_BURST } from "@/game/constants";
import { getUpgrade, upgradeCost } from "@/game/economy";
import { advance, purchase, startSession } from "@/game/reducer";
import { createInitialState } from "@/game/session";
import type { GameState } from "@/game/types";
import { type SessionApi, SessionApiError, type SessionSnapshot } from "@/lib/api";
import { createGameStore, type GameStore } from "./game-store";

/** Часы сервера намеренно смещены — так проверяется выравнивание. */
const CLOCK_OFFSET = 37_000;
const START_TIME = 1_700_000_000_000;

let clientTime = START_TIME;
const now = () => clientTime;
const advanceClock = (ms: number) => {
  clientTime += ms;
};

/**
 * Упрощённый сервер: применяет те же чистые функции, что настоящий.
 * Полный серверный путь проверяется в `session-service.test.ts` и e2e.
 */
function createFakeServer() {
  let state = createInitialState();
  const calls: SessionAction[] = [];
  let failure: unknown = null;

  const snapshot = (): SessionSnapshot => ({
    state,
    serverTime: clientTime + CLOCK_OFFSET,
  });

  const api: SessionApi = {
    read: async () => {
      if (failure) {
        throw failure;
      }
      state = advance(state, clientTime + CLOCK_OFFSET);
      return snapshot();
    },
    act: async (action) => {
      calls.push(action);
      if (failure) {
        throw failure;
      }
      const at = clientTime + CLOCK_OFFSET;
      switch (action.type) {
        case "start":
          state = startSession(state, at);
          break;
        case "tap":
          state = applyTapBatch(state, action.taps, at);
          break;
        case "upgrade":
          state = purchase(advance(state, at), action.id);
          break;
        default:
          state = advance(state, at);
      }
      return snapshot();
    },
  };

  return {
    api,
    calls,
    get state(): GameState {
      return state;
    },
    fail(cause: unknown) {
      failure = cause;
    },
    recover() {
      failure = null;
    },
  };
}

let server: ReturnType<typeof createFakeServer>;
let store: GameStore;

beforeEach(() => {
  clientTime = START_TIME;
  server = createFakeServer();
  store = createGameStore({ api: server.api, now });
});

async function started(): Promise<void> {
  await store.getState().init();
  await store.getState().start();
}

describe("инициализация", () => {
  it("принимает состояние сервера и выравнивает часы", async () => {
    await store.getState().init();

    expect(store.getState().status).toBe("ready");
    expect(store.getState().local?.phase).toBe("idle");
    expect(store.getState().clockOffset).toBe(CLOCK_OFFSET);
  });

  it("при обрыве связи уходит в офлайн, но не падает", async () => {
    server.fail(new TypeError("Failed to fetch"));
    await store.getState().init();

    expect(store.getState().status).toBe("offline");
    expect(store.getState().error).toBe("Нет связи с сервером");
  });
});

describe("локальное предсказание", () => {
  it("тап сразу виден на экране, не дожидаясь сервера", async () => {
    await started();
    store.getState().tap();

    expect(store.getState().local?.taps).toBe(1);
    expect(store.getState().local?.grains).toBeGreaterThan(0);
    // Сервер о нём ещё не знает.
    expect(server.state.taps).toBe(0);
    expect(store.getState().pendingTaps).toBe(1);
  });

  it("тапы сверх лимита частоты не попадают в очередь", async () => {
    await started();

    for (let index = 0; index < TAP_BURST + 30; index += 1) {
      store.getState().tap();
    }

    expect(store.getState().pendingTaps).toBe(TAP_BURST);
  });

  it("вне игры тап игнорируется", async () => {
    await store.getState().init();
    store.getState().tap();

    expect(store.getState().pendingTaps).toBe(0);
  });

  it("тик двигает время предсказания", async () => {
    await started();
    const before = store.getState().local?.lastTickAt;

    advanceClock(500);
    store.getState().tick();

    expect(store.getState().local?.lastTickAt).toBeGreaterThan(before ?? 0);
  });

  it("возврат из свёрнутой вкладки сбрасывает жар", async () => {
    await started();
    for (let index = 0; index < 10; index += 1) {
      store.getState().tap();
    }
    expect(store.getState().local?.heat).toBeGreaterThan(0);

    advanceClock(60_000);
    store.getState().resume();

    expect(store.getState().local?.heat).toBe(0);
  });
});

describe("синхронизация", () => {
  it("отправляет накопленные тапы и принимает серверный итог", async () => {
    await started();
    for (let index = 0; index < 12; index += 1) {
      store.getState().tap();
    }

    advanceClock(2_000);
    await store.getState().flush();

    expect(server.state.taps).toBe(12);
    expect(store.getState().pendingTaps).toBe(0);
    expect(store.getState().server?.taps).toBe(12);
    expect(store.getState().local?.taps).toBe(12);
  });

  it("серверное состояние побеждает предсказание", async () => {
    await started();
    store.getState().tap();

    advanceClock(2_000);
    await store.getState().flush();

    // Локальное состояние после синхронизации — это ровно серверное.
    expect(store.getState().local?.grains).toBe(server.state.grains);
  });

  it("тапы во время запроса не теряются", async () => {
    await started();
    for (let index = 0; index < 5; index += 1) {
      store.getState().tap();
    }

    advanceClock(2_000);
    const inFlight = store.getState().flush();
    // Гость продолжает тапать, пока запрос в пути.
    store.getState().tap();
    store.getState().tap();
    await inFlight;

    expect(server.state.taps).toBe(5);
    expect(store.getState().pendingTaps).toBe(2);
    expect(store.getState().local?.taps).toBe(7);
  });

  it("при ошибке тапы возвращаются в очередь", async () => {
    await started();
    for (let index = 0; index < 8; index += 1) {
      store.getState().tap();
    }

    server.fail(new TypeError("Failed to fetch"));
    advanceClock(2_000);
    await store.getState().flush();

    expect(store.getState().status).toBe("offline");
    expect(store.getState().pendingTaps).toBe(8);

    server.recover();
    await store.getState().flush();

    expect(server.state.taps).toBe(8);
    expect(store.getState().status).toBe("ready");
  });

  it("параллельные вызовы не отправляют одно дважды", async () => {
    await started();
    store.getState().tap();

    advanceClock(2_000);
    await Promise.all([store.getState().flush(), store.getState().flush()]);

    const tapCalls = server.calls.filter((call) => call.type === "tap");
    expect(tapCalls).toHaveLength(1);
  });
});

describe("сервер просит подождать", () => {
  it("после 429 отправка приостанавливается, а тапы сохраняются", async () => {
    await started();
    store.getState().tap();

    server.fail(new SessionApiError(429, "Слишком часто", 3_000));
    advanceClock(2_000);
    await store.getState().flush();

    expect(store.getState().pendingTaps).toBe(1);
    expect(store.getState().throttledUntil).toBeGreaterThan(0);

    server.recover();
    const callsBefore = server.calls.length;
    await store.getState().flush();
    expect(server.calls).toHaveLength(callsBefore);

    advanceClock(4_000);
    await store.getState().flush();
    expect(server.state.taps).toBe(1);
  });
});

describe("события сети", () => {
  it("пропажа сети переводит в офлайн сразу, не дожидаясь падения запроса", async () => {
    await started();
    store.getState().setConnection(false);

    expect(store.getState().status).toBe("offline");
    expect(store.getState().error).toBe("Нет связи с сервером");
  });

  it("возврат сети снимает паузу отправки", async () => {
    await started();
    store.getState().setConnection(false);
    store.setState({ throttledUntil: Number.MAX_SAFE_INTEGER });

    store.getState().setConnection(true);
    expect(store.getState().throttledUntil).toBe(0);
  });

  it("в офлайне тапы продолжают считаться локально", async () => {
    await started();
    store.getState().setConnection(false);

    store.getState().tap();
    store.getState().tap();

    expect(store.getState().local?.taps).toBe(2);
    expect(store.getState().pendingTaps).toBe(2);
  });

  it("потерянную сессию события сети не воскрешают", async () => {
    await started();
    server.fail(new SessionApiError(404, "Сессия не найдена."));
    await store.getState().flush();
    expect(store.getState().status).toBe("lost");

    store.getState().setConnection(true);
    expect(store.getState().status).toBe("lost");
  });
});

describe("отказ на старте", () => {
  it("не оставляет гостя на бесконечной загрузке", async () => {
    // Сервер может отказать и без обрыва связи — например, ограничителем.
    server.fail(new SessionApiError(429, "Слишком много новых игр с этого адреса.", 2_000));
    await store.getState().init();

    // Состояния нет, значит показывать «подождите» негде: нужен экран с повтором.
    expect(store.getState().local).toBeNull();
    expect(store.getState().status).toBe("offline");
    expect(store.getState().error).toContain("Слишком много");
  });

  it("повтор после отказа поднимает игру", async () => {
    server.fail(new SessionApiError(429, "Слишком часто", 1_000));
    await store.getState().init();
    expect(store.getState().status).toBe("offline");

    server.recover();
    await store.getState().init();

    expect(store.getState().status).toBe("ready");
    expect(store.getState().local?.phase).toBe("idle");
  });

  it("во время игры отказ не выбивает на экран загрузки", async () => {
    await started();
    store.getState().tap();

    server.fail(new SessionApiError(429, "Слишком часто", 1_000));
    advanceClock(2_000);
    await store.getState().flush();

    // Состояние уже есть — играть можно дальше, экран менять незачем.
    expect(store.getState().status).toBe("ready");
    expect(store.getState().local).not.toBeNull();
  });
});

describe("потеря сессии", () => {
  it("переводит стор в состояние «нужно обновить страницу»", async () => {
    await started();
    store.getState().tap();

    server.fail(new SessionApiError(404, "Сессия не найдена. Обновите страницу."));
    advanceClock(2_000);
    await store.getState().flush();

    expect(store.getState().status).toBe("lost");
    expect(store.getState().error).toContain("Обновите страницу");
    expect(store.getState().pendingTaps).toBe(0);
  });

  it("в потерянном состоянии больше ничего не отправляет", async () => {
    await started();
    server.fail(new SessionApiError(401, "Сессия не найдена."));
    await store.getState().flush();

    server.recover();
    const callsBefore = server.calls.length;
    await store.getState().flush();

    expect(server.calls).toHaveLength(callsBefore);
  });
});

describe("действия", () => {
  it("покупка сначала сдаёт накопленные тапы", async () => {
    await started();

    // Копим на сервере с запасом, чтобы проверка не зависела от округлений.
    // Цена берётся из экономики, а не числом: она балансировочная константа.
    const cost = upgradeCost(getUpgrade("paws"), 0);
    let guard = 0;
    while (server.state.grains < cost * 3 && guard < 50) {
      for (let index = 0; index < TAP_BURST; index += 1) {
        store.getState().tap();
        advanceClock(100);
        store.getState().tick();
      }
      await store.getState().flush();
      guard += 1;
    }
    expect(server.state.grains).toBeGreaterThanOrEqual(cost);

    // Ещё пара тапов, которые сервер пока не видел.
    const tapsOnServer = server.state.taps;
    store.getState().tap();
    store.getState().tap();
    expect(store.getState().pendingTaps).toBe(2);

    advanceClock(2_000);
    await store.getState().buy("paws");

    const types = server.calls.map((call) => call.type);
    expect(types.at(-1)).toBe("upgrade");
    expect(types.at(-2)).toBe("tap");
    expect(server.state.taps).toBe(tapsOnServer + 2);
    expect(server.state.upgrades.paws).toBe(1);
    expect(store.getState().pendingTaps).toBe(0);
  });

  it("окончание часа приходит с сервера, а не решается на клиенте", async () => {
    await started();

    advanceClock(SESSION_DURATION_MS + 60_000);
    await store.getState().flush();

    expect(store.getState().local?.phase).toBe("result");
  });
});

describe("устойчивость", () => {
  it("неожиданная форма ответа не остаётся незамеченной", async () => {
    const broken: SessionApi = {
      read: vi.fn(async () => ({ state: null, serverTime: 0 }) as unknown as SessionSnapshot),
      act: vi.fn(),
    };
    const brokenStore = createGameStore({ api: broken, now });

    await brokenStore.getState().init();

    // Схема ответа проверяется в транспорте; здесь важно, что стор не считает
    // сломанный ответ рабочим состоянием.
    expect(brokenStore.getState().local?.phase).not.toBe("playing");
  });
});
