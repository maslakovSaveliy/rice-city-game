"use client";

import { discountFromGrains, discountProgress } from "@/game/economy";
import type { GameState } from "@/game/types";
import { useGameStore } from "@/store/use-game-store";
import { GrainCounter } from "./GrainCounter";
import styles from "./Hud.module.scss";

/**
 * Верхняя панель: сколько осталось времени, сколько зёрен и какая уже скидка.
 *
 * Селекторы отдают ТОЛЬКО примитивы. Если вернуть объект — например, результат
 * `discountProgress` — ссылка будет новой на каждом вызове, и `useStore`
 * зациклится с ошибкой «getSnapshot should be cached». Производные величины
 * считаются в рендере, а не в селекторе.
 *
 * Таймер подписан на целые секунды, поэтому перерисовывается раз в секунду,
 * а не десять.
 */
export function Hud() {
  const secondsLeft = useGameStore((state) => secondsLeftOf(state.local));
  const grains = useGameStore((state) => state.local?.grains ?? 0);

  const percent = discountFromGrains(grains);
  const progress = discountProgress(grains);

  return (
    <header className={styles.root}>
      <div className={styles.timer}>
        <span className={styles.timerValue}>{formatClock(secondsLeft)}</span>
        <span className={styles.caption}>осталось</span>
      </div>

      <GrainCounter />

      <div className={styles.discount}>
        <span className={styles.discountValue}>{percent}%</span>
        <span className={styles.caption}>скидка</span>
      </div>

      <div className={styles.progress}>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ transform: `scaleX(${progress.ratio})` }} />
        </div>
        {/* Ярлык и число — отдельные узлы, прибитые к краям шкалы. Одной
            строкой по центру подпись дёргалась: смена разрядов меняла её
            ширину, и текст ездил при каждом тапе. */}
        {progress.nextPercent === null ? (
          <p className={`${styles.progressHint} ${styles.progressHintDone}`}>Максимум достигнут</p>
        ) : (
          <p className={styles.progressHint}>
            <span>До {progress.nextPercent}% осталось</span>
            <span>{grainFormatter.format(progress.grainsToNext)}</span>
          </p>
        )}
      </div>
    </header>
  );
}

const grainFormatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Остаток считается от `lastTickAt`, а не от `Date.now()`.
 *
 * Во-первых, `lastTickAt` уже в серверной шкале времени. Во-вторых, селектор
 * остаётся чистой функцией состояния: игровой цикл обновляет `lastTickAt` десять
 * раз в секунду, и перерисовка происходит ровно при смене секунды на табло.
 */
function secondsLeftOf(state: GameState | null): number {
  if (state?.endsAt == null || state.lastTickAt === null) {
    return 0;
  }
  return Math.max(0, Math.ceil((state.endsAt - state.lastTickAt) / 1000));
}
