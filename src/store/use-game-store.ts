"use client";

import { useStore } from "zustand";
import { createHttpSessionApi } from "@/lib/api";
import { createGameStore, type GameStoreState } from "./game-store";

/**
 * Единственный экземпляр стора на вкладку.
 *
 * Создаётся на уровне модуля, потому что сессия одна на устройство и время
 * тикает независимо от того, какой экран смонтирован.
 */
export const gameStore = createGameStore({
  api: createHttpSessionApi(),
  now: () => Date.now(),
});

export function useGameStore<T>(selector: (state: GameStoreState) => T): T {
  return useStore(gameStore, selector);
}
