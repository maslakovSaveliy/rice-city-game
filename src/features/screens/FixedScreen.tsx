"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ORGANIZER } from "@/features/legal/legal-content";
import { useGameStore } from "@/store/use-game-store";
import styles from "./screens.module.scss";

type FixedView = "discount" | "menu";

/**
 * Состояние после фиксации скидки.
 *
 * Два вида одного экрана. Крупный процент — то, что показывают официанту, на
 * нём нет ничего лишнего. Меню нужно, чтобы гость не оказался в тупике: можно
 * перечитать правила и вернуться к своей скидке.
 *
 * Кнопки «Играть» здесь нет намеренно. Сервер закрывает игру на визит, и такая
 * кнопка просто ничего бы не делала — обещать действие, которого не будет,
 * хуже, чем не предлагать его вовсе.
 */
export function FixedScreen() {
  const [view, setView] = useState<FixedView>("discount");
  const percent = useGameStore((state) => state.local?.fixedDiscount ?? 0);

  if (view === "menu") {
    return <FixedMenu onShowDiscount={() => setView("discount")} percent={percent} />;
  }

  return (
    <main className={styles.fixed}>
      <p className={styles.kicker}>Покажите официанту</p>

      <p className={styles.bigPercent}>
        {percent}
        <span className={styles.bigPercentSign}>%</span>
      </p>

      <p className={styles.script}>Твой любимый рис теперь здесь</p>

      <p className={styles.menuFinePrint}>
        Скидка действует на весь счёт, кроме алкогольной и табачной продукции. Не выдаётся деньгами.
      </p>

      <div className={styles.fixedActions}>
        <Button onClick={() => setView("menu")} variant="ghost">
          В меню
        </Button>
      </div>
    </main>
  );
}

function FixedMenu({ percent, onShowDiscount }: { percent: number; onShowDiscount: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const reset = useGameStore((state) => state.reset);

  return (
    <main className={styles.menu}>
      <p className={styles.kicker}>Игра завершена</p>
      <h1 className={styles.wordmark}>
        РИС<span className={styles.wordmarkAccent}>сити</span>
      </h1>

      <Image
        alt="Рисинка"
        className={styles.menuMascot}
        height={180}
        sizes="(max-width: 480px) 42vw, 180px"
        src="/mascot/risinka.png"
        width={180}
      />

      <p className={styles.fixedSummary}>
        Скидка зафиксирована: <strong className={styles.fixedSummaryValue}>{percent}%</strong>
      </p>

      <div className={styles.resultActions}>
        <Button onClick={onShowDiscount} size="lg">
          Показать официанту
        </Button>
        <Button onClick={() => setConfirming(true)} variant="secondary">
          Сыграть ещё раз
        </Button>
      </div>

      <p className={styles.menuFinePrint}>
        Скидка на счёт применяется один раз за визит. Новая игра сотрёт эту.
      </p>

      <ConfirmDialog
        cancelLabel="Оставить скидку"
        confirmLabel="Стереть и начать заново"
        description={`Зафиксированная скидка ${percent}% пропадёт, и её нельзя будет вернуть. Новый час начнётся с нуля.`}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          void reset();
        }}
        open={confirming}
        title="Начать заново?"
      />

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
