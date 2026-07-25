"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ORGANIZER } from "@/features/legal/legal-content";
import { DISCOUNT_MAX, SESSION_DURATION_MS } from "@/game/constants";
import { useGameStore } from "@/store/use-game-store";
import styles from "./screens.module.scss";

const MINUTES = SESSION_DURATION_MS / 60_000;

/**
 * Коротко: главный экран не должен прокручиваться, а на 320×568 каждая
 * лишняя строка выталкивает кнопку за пределы экрана.
 */
const RULES_TEXT =
  `Тапай Рисинку и копи зёрна — до ${DISCOUNT_MAX}% скидки на счёт. ` + `На игру ${MINUTES} минут.`;

export function MenuScreen() {
  const start = useGameStore((state) => state.start);
  const attempts = useGameStore((state) => state.local?.attempts ?? 0);

  return (
    <main className={styles.menu}>
      {/* Строка «Семейный ГастроДом» убрана: на узких экранах она вставала
          впритык к логотипу и отнимала высоту у главного действия. */}
      <h1 className={styles.wordmark}>
        <Image
          alt="РИСсити"
          className={styles.wordmarkImage}
          height={79}
          priority
          sizes="(max-width: 480px) 66vw, 300px"
          src="/brand/logos/logo-horizontal-light-512.png"
          width={512}
        />
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

      <p className={styles.menuFinePrint}>Покажи скидку официанту до расчёта</p>

      <nav aria-label="Документы" className={styles.menuLegal}>
        <Link className={styles.menuLegalLink} href="/legal/rules">
          Правила акции
        </Link>
        <Link className={styles.menuLegalLink} href="/legal/privacy">
          Обработка данных
        </Link>
      </nav>

      <p className={styles.menuFinePrint}>
        {ORGANIZER.name} · {ORGANIZER.ageRating}
      </p>
    </main>
  );
}
