"use client";

import Image from "next/image";
import { type PointerEvent, useCallback, useEffect, useRef } from "react";
import { soundPlayer } from "@/features/audio/sound";
import { burstAt } from "@/features/particles/particles";
import { HEAT_MAX } from "@/game/constants";
import { gameStore, useGameStore } from "@/store/use-game-store";
import styles from "./TapTarget.module.scss";

const SQUASH_DURATION_MS = 170;
const HAPTIC_MS = 8;

/**
 * На сколько «+N» поднимается над верхней кромкой подложки.
 *
 * Холст с частицами лежит за Рисинкой, поэтому у точки касания число было бы
 * не видно. Стартовая линия чуть выше подложки: число сразу оказывается на
 * тёмном поле, где оранжевый читается.
 */
const SCORE_LIFT_PX = 10;

/**
 * Рисинка — цель тапа.
 *
 * Реакция на `pointerdown`, а не на `click`: клик приходит только после отпускания
 * пальца, и на быстром тапе это ощущается как залипание.
 *
 * Анимация сжатия идёт через Web Animations API прямо на узле, минуя React.
 * Пятнадцать перерисовок в секунду ради одного `transform` — впустую.
 */
export function TapTarget() {
  const mascotRef = useRef<HTMLDivElement>(null);
  const tap = useGameStore((state) => state.tap);

  useEffect(() => {
    // iOS Safari игнорирует `user-scalable=no`, поэтому щипок гасится вручную.
    const blockGesture = (event: Event) => event.preventDefault();
    document.addEventListener("gesturestart", blockGesture);
    return () => document.removeEventListener("gesturestart", blockGesture);
  }, []);

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      // Каждое касание считается отдельно: дети тапают двумя пальцами.
      if (!event.isPrimary && event.pointerType !== "touch") {
        return;
      }
      event.preventDefault();

      const before = gameStore.getState().local;
      tap();
      const after = gameStore.getState().local;

      if (after === null || before === null || after.taps === before.taps) {
        return;
      }

      squash(mascotRef.current);
      navigator.vibrate?.(HAPTIC_MS);
      soundPlayer.playTap(after.heat / HEAT_MAX);

      const plate = mascotRef.current?.getBoundingClientRect();
      burstAt({
        clientX: event.clientX,
        clientY: event.clientY,
        value: after.grains - before.grains,
        now: performance.now(),
        // Зерно должно родиться уже за кромкой подложки, а «+N» — над ней.
        ...(plate === undefined
          ? {}
          : { spawnRadius: plate.width / 2, scoreClientY: plate.top - SCORE_LIFT_PX }),
      });
    },
    [tap],
  );

  return (
    <button
      aria-label="Тапнуть по Рисинке"
      className={`${styles.root} rc-tap-surface`}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={handlePointerDown}
      type="button"
    >
      <HeatRing />
      <div className={styles.mascot} ref={mascotRef}>
        <Image
          alt="Рисинка"
          className={styles.image}
          draggable={false}
          height={320}
          priority
          sizes="(max-width: 480px) 62vw, 320px"
          src="/mascot/risinka.png"
          width={320}
        />
      </div>
    </button>
  );
}

/** Ободок вокруг Рисинки показывает набранный жар комбо. */
function HeatRing() {
  const heat = useGameStore((state) => Math.round(((state.local?.heat ?? 0) / HEAT_MAX) * 20) / 20);

  return (
    <span
      aria-hidden="true"
      className={styles.heat}
      style={{ opacity: 0.15 + heat * 0.85, transform: `scale(${1 + heat * 0.04})` }}
    />
  );
}

function squash(node: HTMLDivElement | null): void {
  if (node === null || typeof node.animate !== "function") {
    return;
  }

  node.animate(
    [
      { transform: "scale(1, 1)" },
      { transform: "scale(1.08, 0.9)" },
      { transform: "scale(0.97, 1.04)" },
      { transform: "scale(1, 1)" },
    ],
    {
      duration: SQUASH_DURATION_MS,
      easing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      // Новый тап прерывает предыдущую анимацию, а не встаёт в очередь.
      composite: "replace",
    },
  );
}
