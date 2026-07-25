import Image from "next/image";
import type { ReactNode } from "react";
import { ORGANIZER } from "@/features/legal/legal-content";
import styles from "./StatusScreen.module.scss";

export type StatusTone = "neutral" | "trouble";

interface StatusScreenProps {
  readonly title: string;
  readonly description: string;
  /** Кнопка или ссылка. Разная у 404, ошибки и офлайна. */
  readonly action?: ReactNode;
  readonly tone?: StatusTone;
  /** Мелкая техническая строка для поддержки. Гостю не объясняет ничего. */
  readonly reference?: string;
}

/**
 * Один экран для всех тупиков: 404, сбой, потеря сессии, отсутствие связи.
 *
 * Общий компонент не ради экономии кода, а ради узнаваемости: гость, увидевший
 * ошибку, должен понимать, что он всё ещё в игре РИСсити, а не на странице
 * сервера. У бренда одна Рисинка, других её состояний не существует, поэтому
 * при неприятностях она просто приглушается.
 */
export function StatusScreen({
  title,
  description,
  action,
  tone = "neutral",
  reference,
}: StatusScreenProps) {
  return (
    <div className={styles.root}>
      <main className={styles.content}>
        {/* Знак, а не полный логотип: на тупиковом экране главное — заголовок
            и действие, бренду достаточно опознавательного элемента. */}
        <Image
          alt="РИСсити"
          className={styles.mark}
          height={128}
          priority
          src="/brand/logos/logo-mark-light-128.png"
          width={128}
        />

        <Image
          alt=""
          className={tone === "trouble" ? styles.mascotDimmed : styles.mascot}
          height={180}
          priority
          sizes="(max-width: 480px) 44vw, 180px"
          src="/mascot/risinka.png"
          width={180}
        />

        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>

        {action && <div className={styles.action}>{action}</div>}

        {reference && <p className={styles.reference}>Код: {reference}</p>}
      </main>

      <p className={styles.requisites}>
        {ORGANIZER.name} · {ORGANIZER.ageRating}
      </p>
    </div>
  );
}
