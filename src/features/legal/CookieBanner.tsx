"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useGameStore } from "@/store/use-game-store";
import styles from "./CookieBanner.module.scss";

const STORAGE_KEY = "rc_cookie_notice";

/**
 * Информирующий баннер о файлах cookie.
 *
 * Именно информирующий, а не запрашивающий согласие: в игре один строго
 * необходимый файл cookie и ни одного аналитического или рекламного. Согласие
 * на технические cookie не требуется, но уведомить пользователя обязательно.
 *
 * Факт закрытия хранится в localStorage, а не в cookie: плодить cookie ради
 * баннера о cookie — сомнительная идея.
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const playing = useGameStore((state) => state.local?.phase === "playing");

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(STORAGE_KEY) === null);
    } catch {
      // Приватный режим может запрещать хранилище. Тогда просто показываем
      // баннер каждый раз — это лучше, чем падать.
      setVisible(true);
    }
  }, []);

  // Во время игры баннер прячется: он закреплён у нижней кромки и накрывал бы
  // кнопки управления. Гость видит его в меню до начала игры и после неё.
  if (!visible || playing) {
    return null;
  }

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Не смогли запомнить — не страшно.
    }
    setVisible(false);
  };

  return (
    <aside aria-label="Уведомление о файлах cookie" className={styles.root}>
      {/* Коротко: баннер лежит поверх содержимого, и каждая лишняя строка
          закрывает всё больше экрана. Подробности — на странице по ссылке. */}
      <p className={styles.text}>
        Только технические cookie, без аналитики.{" "}
        <Link className={styles.link} href="/legal/cookies">
          Подробнее
        </Link>
      </p>
      <button className={styles.button} onClick={dismiss} type="button">
        Понятно
      </button>
    </aside>
  );
}
