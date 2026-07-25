"use client";

import { useGameStore } from "@/store/use-game-store";
import styles from "./screens.module.scss";

/**
 * Экран, который гость показывает официанту. Никаких кнопок: любое действие
 * здесь только сбивало бы с толку.
 */
export function FixedScreen() {
  const percent = useGameStore((state) => state.local?.fixedDiscount ?? 0);

  return (
    <main className={styles.fixed}>
      <p className={styles.kicker}>Покажите официанту</p>

      <p className={styles.bigPercent}>
        {percent}
        <span className={styles.bigPercentSign}>%</span>
      </p>

      <p className={styles.script}>Твой любимый рис теперь здесь</p>

      <p className={styles.menuFinePrint}>
        Скидка действует на весь счёт, кроме алкогольной и табачной продукции. Не выдаётся деньгами.
      </p>
    </main>
  );
}
