"use client";

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
  const error = useGameStore((state) => state.error);

  if (status === "lost") {
    return (
      <Notice title="Игра потерялась">{error ?? "Обновите страницу, чтобы продолжить."}</Notice>
    );
  }

  if (phase === null) {
    return (
      <Notice title="Готовим рис">
        {status === "offline" ? "Нет связи. Проверьте интернет." : "Секунду…"}
      </Notice>
    );
  }

  return (
    // Ключ по фазе перезапускает анимацию появления при каждой смене экрана.
    <div className={styles.stage} key={phase}>
      {status === "offline" && <p className={styles.offline}>Нет связи — прогресс сохранится</p>}
      {phase === "idle" && <MenuScreen />}
      {phase === "playing" && <PlayScreen />}
      {phase === "result" && <ResultScreen />}
      {phase === "fixed" && <FixedScreen />}
    </div>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.notice}>
      <h1 className={styles.noticeTitle}>{title}</h1>
      <p className={styles.noticeText}>{children}</p>
    </div>
  );
}
