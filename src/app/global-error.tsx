"use client";

import { useEffect } from "react";
import { fontVariables } from "@/lib/fonts";
import "@/styles/global.scss";
import styles from "./global-error.module.scss";

/**
 * Последний рубеж: сюда попадают сбои самого корневого макета.
 *
 * Этот компонент заменяет всю разметку целиком, поэтому обязан отрисовать
 * `<html>` и `<body>` сам и не может опираться ни на общий макет, ни на
 * компоненты, которые от него зависят. Разметка здесь намеренно минимальная —
 * чем меньше в ней движущихся частей, тем выше шанс, что она отрисуется.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    console.error("Критический сбой:", error);
  }, [error]);

  return (
    <html className={fontVariables} lang="ru">
      <body>
        <div className={styles.root}>
          <h1 className={styles.title}>Игра недоступна</h1>
          <p className={styles.text}>
            Произошёл сбой. Перезагрузите страницу — прогресс хранится на сервере и не потеряется.
          </p>
          <button className={styles.button} onClick={() => window.location.reload()} type="button">
            Перезагрузить
          </button>
          {error.digest && <p className={styles.reference}>Код: {error.digest}</p>}
        </div>
      </body>
    </html>
  );
}
