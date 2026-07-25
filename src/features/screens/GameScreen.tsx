"use client";

import { Button } from "@/components/ui/Button";
import { StatusScreen } from "@/features/status/StatusScreen";
import { useGameRuntime } from "@/hooks/use-game-runtime";
import { useGameStore } from "@/store/use-game-store";
import { FixedScreen } from "./FixedScreen";
import { MenuScreen } from "./MenuScreen";
import { PlayScreen } from "./PlayScreen";
import { ResultScreen } from "./ResultScreen";
import styles from "./screens.module.scss";

/**
 * Один маршрут, экран выбирается по фазе сессии.
 *
 * Отдельные маршруты под каждый экран потребовали бы охраны и редиректов:
 * фазу знает сервер, и при несовпадении гость видел бы мигание. Для игры
 * состояние — это и есть экран.
 */
export function GameScreen() {
  useGameRuntime();

  const status = useGameStore((state) => state.status);
  const phase = useGameStore((state) => state.local?.phase ?? null);
  const init = useGameStore((state) => state.init);

  if (status === "lost") {
    return (
      <StatusScreen
        action={
          <Button onClick={() => window.location.reload()} size="lg">
            Обновить страницу
          </Button>
        }
        description="Игровая сессия больше не действует. Обновите страницу, чтобы начать заново."
        title="Игра потерялась"
        tone="trouble"
      />
    );
  }

  // Связи нет и загрузиться не удалось: играть не во что, нужен повтор.
  if (phase === null && status === "offline") {
    return (
      <StatusScreen
        action={
          <Button onClick={() => void init()} size="lg">
            Повторить
          </Button>
        }
        description="Игра не смогла загрузиться. Проверьте подключение и попробуйте ещё раз."
        title="Нет связи"
        tone="trouble"
      />
    );
  }

  if (phase === null) {
    return (
      <div className={styles.notice}>
        <p className={styles.noticeText}>Готовим рис…</p>
      </div>
    );
  }

  return (
    // Ключ по фазе перезапускает анимацию появления при каждой смене экрана.
    <div className={styles.stage} key={phase}>
      {/* `<output>` вместо `<p role="status">`: живая область с той же
          семантикой, но нативным элементом. */}
      {status === "offline" && (
        <output className={styles.offline}>
          Нет связи — тапы сохранятся и уйдут, когда интернет вернётся
        </output>
      )}
      {phase === "idle" && <MenuScreen />}
      {phase === "playing" && <PlayScreen />}
      {phase === "result" && <ResultScreen />}
      {phase === "fixed" && <FixedScreen />}
    </div>
  );
}
