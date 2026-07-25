"use client";

import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { DISCOUNT_MAX, SESSION_DURATION_MS } from "@/game/constants";
import { useGameStore } from "@/store/use-game-store";
import styles from "./screens.module.scss";

const MINUTES = SESSION_DURATION_MS / 60_000;

const RULES_TEXT =
  `Тапай Рисинку и копи зёрна. Чем больше зёрен, тем больше скидка на счёт — ` +
  `до ${DISCOUNT_MAX}%. На игру есть ${MINUTES} минут.`;

export function MenuScreen() {
  const start = useGameStore((state) => state.start);
  const attempts = useGameStore((state) => state.local?.attempts ?? 0);

  return (
    <main className={styles.menu}>
      <p className={styles.kicker}>Семейный ГастроДом</p>
      <h1 className={styles.wordmark}>
        РИС<span className={styles.wordmarkAccent}>сити</span>
      </h1>

      <Image
        alt="Рисинка приветствует гостей"
        className={styles.menuMascot}
        height={260}
        priority
        sizes="(max-width: 480px) 58vw, 260px"
        src="/mascot/risinka.png"
        width={260}
      />

      <p className={styles.script}>Помнишь, как в детстве?</p>

      {/* Строка собирается заранее: при разбиении JSX форматтером между числом
          и знаком процента появлялся пробел. */}
      <p className={styles.menuText}>{RULES_TEXT}</p>

      <Button onClick={() => void start()} size="lg">
        {attempts > 0 ? "Играть снова" : "Играть"}
      </Button>

      <p className={styles.menuFinePrint}>
        Скидку нужно показать официанту до расчёта. Один раз за визит.
      </p>
    </main>
  );
}
