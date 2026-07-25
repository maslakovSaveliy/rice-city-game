"use client";

import { Button } from "@/components/ui/Button";
import { discountFromGrains } from "@/game/economy";
import { useGameStore } from "@/store/use-game-store";
import styles from "./screens.module.scss";

const formatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

export function ResultScreen() {
  const percent = useGameStore((state) => discountFromGrains(state.local?.grains ?? 0));
  const taps = useGameStore((state) => state.local?.taps ?? 0);
  const fix = useGameStore((state) => state.fix);
  const restart = useGameStore((state) => state.restart);

  return (
    <main className={styles.result}>
      <p className={styles.kicker}>Час прошёл</p>

      <p className={styles.bigPercent}>
        {percent}
        <span className={styles.bigPercentSign}>%</span>
      </p>

      <p className={styles.resultText}>
        {percent === 0
          ? "Зёрен не хватило даже на один процент. Попробуй ещё — первый даётся быстро."
          : `Это твоя скидка на счёт. Тапов: ${formatter.format(taps)}.`}
      </p>

      <div className={styles.resultActions}>
        <Button disabled={percent === 0} onClick={() => void fix()} size="lg">
          Зафиксировать
        </Button>
        <Button onClick={() => void restart()} variant="secondary">
          Начать сначала
        </Button>
      </div>

      <p className={styles.menuFinePrint}>
        Фиксация — один раз за визит. После неё игра закроется.
      </p>
    </main>
  );
}
