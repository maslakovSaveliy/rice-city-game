"use client";

import { useEffect } from "react";
import { SYNC_INTERVAL_MS, TICK_INTERVAL_MS } from "@/game/constants";
import { gameStore } from "@/store/use-game-store";

/**
 * Жизненный цикл игры: загрузка состояния, игровой цикл и синхронизация.
 *
 * Здесь ровно один `requestAnimationFrame` на всё приложение. Стор при этом
 * обновляется не каждый кадр, а раз в `TICK_INTERVAL_MS` — 60 обновлений в
 * секунду заставили бы React перерисовывать интерфейс впустую, ведь пассивный
 * доход за один кадр меняет счётчик на неразличимую величину.
 */
export function useGameRuntime(): void {
  useEffect(() => {
    void gameStore.getState().init();
  }, []);

  useEffect(() => {
    let frame = 0;
    let lastTick = 0;
    let lastSync = 0;

    const loop = (timestamp: number) => {
      frame = requestAnimationFrame(loop);

      if (timestamp - lastTick >= TICK_INTERVAL_MS) {
        lastTick = timestamp;
        gameStore.getState().tick();
      }

      if (timestamp - lastSync >= SYNC_INTERVAL_MS) {
        lastSync = timestamp;
        void gameStore.getState().flush();
      }
    };

    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Пока вкладка была скрыта, пассив не начислялся. Сдвигаем точку
        // отсчёта и сверяемся с сервером.
        gameStore.getState().resume();
        void gameStore.getState().flush();
      } else {
        // Уходим — отдаём накопленное, чтобы не потерять при закрытии.
        void gameStore.getState().flush();
      }
    };

    const onPageHide = () => {
      void gameStore.getState().flush();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);
}
