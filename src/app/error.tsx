"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { StatusScreen } from "@/features/status/StatusScreen";

/**
 * Граница ошибок для всего приложения.
 *
 * Гостю показывается человеческое объяснение и одна кнопка. Текст самой ошибки
 * не выводится намеренно: он ничего не объяснит ребёнку за столом, зато может
 * раскрыть внутренние детали. В интерфейс попадает только `digest` — короткий
 * идентификатор, по которому запись находится в серверных журналах.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Сбой в интерфейсе игры:", error);
  }, [error]);

  return (
    <StatusScreen
      action={
        <>
          <Button onClick={reset} size="lg">
            Попробовать снова
          </Button>
          <Button onClick={() => window.location.reload()} variant="secondary">
            Перезагрузить страницу
          </Button>
        </>
      }
      description="Игра споткнулась. Прогресс хранится на сервере, поэтому счёт и время не потеряются."
      title="Что-то пошло не так"
      tone="trouble"
      // Спред, а не `?? undefined`: при exactOptionalPropertyTypes явный
      // undefined не то же самое, что отсутствие свойства.
      {...(error.digest ? { reference: error.digest } : {})}
    />
  );
}
