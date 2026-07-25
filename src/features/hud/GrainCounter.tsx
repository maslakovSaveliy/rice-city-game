"use client";

import { memo, useEffect, useRef } from "react";
import { gameStore } from "@/store/use-game-store";
import styles from "./GrainCounter.module.scss";

const formatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

/**
 * Счётчик зёрен обновляется в обход React.
 *
 * Он меняется на каждом тапе — до пятнадцати раз в секунду — и в тике игрового
 * цикла. Прогонять это через рендер React значит перерисовывать поддерево ради
 * одной текстовой строки. Здесь текст пишется прямо в узел, а подписка на стор
 * дросселируется до кадра.
 *
 * `memo` здесь несущий, а не декоративный. Родительский `Hud` перерисовывается
 * десять раз в секунду, и без мемоизации React на каждой перерисовке возвращал
 * бы текстовому узлу литерал из JSX, затирая императивную запись. Пропсов у
 * компонента нет, поэтому мемоизация отсекает перерисовки полностью.
 */
function GrainCounterView() {
  const nodeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let frame = 0;
    let shown = -1;

    const paint = () => {
      frame = 0;
      const grains = Math.floor(gameStore.getState().local?.grains ?? 0);
      if (grains === shown || nodeRef.current === null) {
        return;
      }
      shown = grains;
      nodeRef.current.textContent = formatter.format(grains);
    };

    paint();

    const unsubscribe = gameStore.subscribe(() => {
      if (frame === 0) {
        frame = requestAnimationFrame(paint);
      }
    });

    return () => {
      unsubscribe();
      if (frame !== 0) {
        cancelAnimationFrame(frame);
      }
    };
  }, []);

  return (
    <p className={styles.root}>
      <span aria-hidden="true" className={styles.value} ref={nodeRef}>
        0
      </span>
      <span className={styles.label}>зёрен</span>
    </p>
  );
}

export const GrainCounter = memo(GrainCounterView);
