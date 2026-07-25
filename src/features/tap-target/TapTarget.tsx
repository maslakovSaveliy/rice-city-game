"use client";

import Image from "next/image";
import { type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { soundPlayer } from "@/features/audio/sound";
import { burstAt } from "@/features/particles/particles";
import { HEAT_MAX } from "@/game/constants";
import { discountFromGrains } from "@/game/economy";
import { MASCOT_LEVELS, type MascotLevel, mascotLevelFor } from "@/game/levels";
import { gameStore, useGameStore } from "@/store/use-game-store";
import styles from "./TapTarget.module.scss";

const SQUASH_DURATION_MS = 170;
const HAPTIC_MS = 8;

/**
 * Облик Рисинки по уровню. Сам уровень считает `src/game/levels.ts`; здесь
 * только сопоставление с файлами — путям к картинкам в чистой логике не место.
 */
const MASCOT_SOURCE: Record<MascotLevel, string> = {
  1: "/mascot/levels/risinka-level-1.png",
  2: "/mascot/levels/risinka-level-2.png",
  3: "/mascot/levels/risinka-level-3.png",
};

const MASCOT_ALT: Record<MascotLevel, string> = {
  1: "Рисинка",
  2: "Рисинка в косухе",
  3: "Рисинка на троне",
};

/** Куда поехал уровень. `null` — первый рендер, анимировать нечего. */
type LevelChange = "up" | "down" | null;

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
  // Селекторы отдают примитивы, а не объекты: производные величины на объектах
  // ломают кеш снимка в zustand.
  const untouched = useGameStore((state) => (state.local?.taps ?? 0) === 0);

  const { level, change, clearChange } = useMascotLevel();

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
      <div
        className={untouched ? `${styles.mascot} ${styles.idle}` : styles.mascot}
        ref={mascotRef}
      >
        {/* Все три облика лежат в разметке и переключаются прозрачностью.
            Смена `src` на повышении уровня давала бы вспышку пустоты, пока
            грузится новый файл, — ровно в тот момент, который должен быть
            наградой. Заодно получается кросс-фейд вместо подмены кадра. */}
        {MASCOT_LEVELS.map((current) => (
          <Image
            alt={current === level ? MASCOT_ALT[current] : ""}
            aria-hidden={current !== level}
            className={imageClass(current === level, change)}
            draggable={false}
            height={340}
            key={current}
            priority={current === 1}
            sizes="(max-width: 480px) 76vw, 340px"
            src={MASCOT_SOURCE[current]}
            width={340}
          />
        ))}
      </div>

      {/* Вспышка по контуру кнопки на повышении. Отдельный узел, потому что
          `.mascot` занят сквошем через WAAPI: две анимации на одном
          `transform` подрались бы за него на каждом тапе. */}
      {change !== null && (
        <span
          aria-hidden="true"
          className={change === "up" ? styles.burstUp : styles.burstDown}
          onAnimationEnd={clearChange}
        />
      )}
    </button>
  );
}

/**
 * Уровень, который видит гость, и направление его последней смены.
 *
 * Считается от текущего баланса — то есть ровно от той скидки, которая
 * показана в панели. Купил улучшение, скидка просела — облик откатывается
 * вместе с ней. Так гость видит цену решения, а не только его выгоду.
 *
 * Защёлки на максимум здесь намеренно нет. Клиент предсказывает тапы наперёд,
 * и сверка с сервером может отнять несколько сотен зёрен, но между девятью и
 * десятью процентами лежат десятки тысяч — на настоящих порогах такая правка
 * границу не пересекает. Мигание ловилось только на искусственно заниженных
 * порогах во время проверки.
 */
function useMascotLevel(): {
  level: MascotLevel;
  change: LevelChange;
  clearChange: () => void;
} {
  const level = useGameStore((state) =>
    mascotLevelFor(discountFromGrains(state.local?.grains ?? 0)),
  );

  const [change, setChange] = useState<LevelChange>(null);
  const seen = useRef(level);

  useEffect(() => {
    if (seen.current === level) {
      return;
    }
    // Первый рендер сюда не попадает: `seen` заводится текущим уровнем,
    // поэтому загрузка страницы не проигрывает награду задним числом.
    setChange(level > seen.current ? "up" : "down");
    seen.current = level;
  }, [level]);

  const clearChange = useCallback(() => setChange(null), []);

  return { level, change, clearChange };
}

/**
 * Классы облика: активный слой на смене уровня получает свою анимацию.
 *
 * Повышение и понижение звучат по-разному намеренно. Вверх — с перелётом,
 * это награда и её надо заметить. Вниз — короткое оседание без отскока:
 * потеря не должна праздноваться.
 */
function imageClass(active: boolean, change: LevelChange): string {
  // Собирается списком, а не ветками с шаблонными строками: при
  // `noUncheckedIndexedAccess` обращение к модулю стилей даёт `string |
  // undefined`, и `join` — единственный способ свести это к строке, ничего
  // не утверждая про типы.
  const parts = [styles.image];

  if (active) {
    parts.push(styles.imageActive);
  }
  if (active && change === "up") {
    parts.push(styles.imageUp);
  }
  if (active && change === "down") {
    parts.push(styles.imageDown);
  }

  return parts.join(" ");
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
