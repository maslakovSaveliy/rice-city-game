"use client";

import { useState } from "react";
import styles from "./SoundToggle.module.scss";
import { soundPlayer } from "./sound";

/**
 * Переключатель звука.
 *
 * Состояние хранится в самом проигрывателе — он же переживает перемонтирование
 * и помнит выбор между сессиями. React здесь нужен только чтобы перерисовать
 * значок.
 */
export function SoundToggle() {
  const [muted, setMuted] = useState(() => soundPlayer.isMuted());

  const toggle = () => {
    const next = !muted;
    soundPlayer.setMuted(next);
    setMuted(next);
  };

  return (
    <button
      aria-label={muted ? "Включить звук" : "Выключить звук"}
      aria-pressed={muted}
      className={styles.root}
      onClick={toggle}
      type="button"
    >
      <span aria-hidden="true">{muted ? "🔇" : "🔊"}</span>
    </button>
  );
}
