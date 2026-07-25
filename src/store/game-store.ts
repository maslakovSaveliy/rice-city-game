import { createStore } from "zustand/vanilla";
import type { SessionAction } from "@/game/actions";
import { applyTapBatch } from "@/game/batch";
import { type PublicGameState, toPublicState } from "@/game/public-state";
import { advance, registerTap, resumeAfterHidden } from "@/game/reducer";
import type { GameState, UpgradeId } from "@/game/types";
import { type SessionApi, SessionApiError, type SessionSnapshot } from "@/lib/api";

/**
 * Клиентский стор.
 *
 * Держит две вещи: последнее авторитетное состояние с сервера и локальное
 * предсказание, которое рисуется на экране. Предсказание считается ТЕМИ ЖЕ
 * чистыми функциями из `src/game`, что и на сервере, — поэтому расхождение
 * получается небольшим и счётчик не прыгает.
 *
 * Предсказание — украшение. Источник истины всегда сервер: после каждого ответа
 * локальное состояние заменяется серверным, а сверху доклеиваются тапы, которые
 * успели произойти пока запрос был в пути.
 */

export type StoreStatus = "idle" | "loading" | "ready" | "offline" | "lost";

export interface GameStoreDeps {
  readonly api: SessionApi;
  /** Часы клиента. Инъекция ради детерминированных тестов. */
  readonly now: () => number;
}

export interface GameStoreState {
  readonly status: StoreStatus;
  readonly error: string | null;
  /** Последнее авторитетное состояние. */
  readonly server: GameState | null;
  /** Что рисуем. */
  readonly local: GameState | null;
  /** Тапы, ещё не отправленные. */
  readonly pendingTaps: number;
  /** Тапы, ушедшие в текущем запросе. Вернутся в очередь при ошибке. */
  readonly inFlightTaps: number;
  /** Разница между часами сервера и клиента. */
  readonly clockOffset: number;
  /** До этого момента ничего не отправляем: сервер попросил подождать. */
  readonly throttledUntil: number;

  init: () => Promise<void>;
  start: () => Promise<void>;
  /** Реакция на события `online`/`offline` браузера. */
  setConnection: (online: boolean) => void;
  tap: () => void;
  tick: () => void;
  resume: () => void;
  flush: () => Promise<void>;
  buy: (id: UpgradeId) => Promise<void>;
  finish: () => Promise<void>;
  fix: () => Promise<void>;
  restart: () => Promise<void>;
}

export type GameStore = ReturnType<typeof createGameStore>;

export function createGameStore({ api, now }: GameStoreDeps) {
  return createStore<GameStoreState>()((set, get) => {
    /** Время в шкале сервера. Все игровые расчёты идут только по нему. */
    const serverNow = (): number => now() + get().clockOffset;

    const adopt = (snapshot: SessionSnapshot): void => {
      const offset = snapshot.serverTime - now();
      const { pendingTaps } = get();

      set({
        status: "ready",
        error: null,
        server: snapshot.state,
        local:
          pendingTaps > 0
            ? applyTapBatch(snapshot.state, pendingTaps, snapshot.serverTime)
            : snapshot.state,
        inFlightTaps: 0,
        clockOffset: offset,
      });
    };

    const handleFailure = (cause: unknown): void => {
      const { inFlightTaps, pendingTaps } = get();
      // Отправленные тапы возвращаются в очередь: запрос не дошёл, значит они
      // ещё не учтены сервером.
      const restored = { pendingTaps: pendingTaps + inFlightTaps, inFlightTaps: 0 };

      if (cause instanceof SessionApiError) {
        if (cause.sessionLost) {
          set({ ...restored, status: "lost", error: cause.message, pendingTaps: 0 });
          return;
        }
        if (cause.throttled) {
          set({
            ...restored,
            status: "ready",
            throttledUntil: serverNow() + Math.max(cause.retryAfterMs, 1_000),
          });
          return;
        }
        set({ ...restored, status: "ready", error: cause.message });
        return;
      }

      set({ ...restored, status: "offline", error: "Нет связи с сервером" });
    };

    /** Отправляет действие, предварительно сдав накопленные тапы. */
    const perform = async (action: SessionAction): Promise<void> => {
      await get().flush();
      try {
        adopt(await api.act(action));
      } catch (cause) {
        handleFailure(cause);
      }
    };

    return {
      status: "idle",
      error: null,
      server: null,
      local: null,
      pendingTaps: 0,
      inFlightTaps: 0,
      clockOffset: 0,
      throttledUntil: 0,

      init: async () => {
        set({ status: "loading", error: null });
        try {
          adopt(await api.read());
        } catch (cause) {
          handleFailure(cause);
        }
      },

      start: async () => {
        try {
          adopt(await api.act({ type: "start" }));
        } catch (cause) {
          handleFailure(cause);
        }
      },

      /**
       * Браузер сообщает о пропаже сети раньше, чем упадёт первый запрос.
       * Пользоваться этим стоит только чтобы показать состояние: возврат в
       * «ready» подтверждается настоящим ответом сервера, а не событием.
       */
      setConnection: (online) => {
        const { status } = get();
        if (status === "lost") {
          return;
        }
        if (!online) {
          set({ status: "offline", error: "Нет связи с сервером" });
          return;
        }
        if (status === "offline") {
          set({ throttledUntil: 0 });
        }
      },

      tap: () => {
        const { local } = get();
        if (local === null || local.phase !== "playing") {
          return;
        }

        const next = registerTap(local, serverNow());
        // Если лимит частоты тап не пропустил, в очередь его не кладём: сервер
        // всё равно откажет, а очередь раздувать незачем.
        if (next.taps === local.taps) {
          set({ local: next });
          return;
        }

        set({ local: next, pendingTaps: get().pendingTaps + 1 });
      },

      tick: () => {
        const { local } = get();
        if (local === null || local.phase !== "playing") {
          return;
        }
        set({ local: advance(local, serverNow()) });
      },

      resume: () => {
        const { local } = get();
        if (local !== null && local.phase === "playing") {
          set({ local: resumeAfterHidden(local, serverNow()) });
        }
      },

      flush: async () => {
        const { status, local, pendingTaps, inFlightTaps, throttledUntil } = get();

        if (status === "lost" || local === null || inFlightTaps > 0) {
          return;
        }
        if (serverNow() < throttledUntil) {
          return;
        }
        // Пустая пачка тоже отправляется: так сверяются часы и вовремя
        // подхватывается окончание часа.
        if (pendingTaps === 0 && local.phase !== "playing") {
          return;
        }

        set({ pendingTaps: 0, inFlightTaps: pendingTaps });

        try {
          adopt(await api.act({ type: "tap", taps: pendingTaps }));
        } catch (cause) {
          handleFailure(cause);
        }
      },

      buy: (id) => perform({ type: "upgrade", id }),
      finish: () => perform({ type: "finish" }),
      fix: () => perform({ type: "fix" }),
      restart: () => perform({ type: "restart" }),
    };
  });
}

/** Представление для интерфейса. Считается из локального предсказания. */
export function selectView(state: GameStoreState, now: number): PublicGameState | null {
  return state.local === null ? null : toPublicState(state.local, now + state.clockOffset);
}
