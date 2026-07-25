import Image from "next/image";
import styles from "./RiceLoader.module.scss";

/**
 * Индикатор загрузки: зёрна прыгают на горячем воке.
 *
 * Пять — рабочий минимум: при трёх волна не читается, при семи ряд шире
 * подписи и перестаёт быть одним объектом.
 */
const GRAIN_COUNT = 5;

/**
 * Сдвиг соседнего зерна. Заметно меньше, чем длительность прыжка: волна должна
 * пробегать по ряду, а не запускать зёрна по очереди с паузами.
 */
const STAGGER_MS = 90;

interface RiceLoaderProps {
  readonly label: string;
}

export function RiceLoader({ label }: RiceLoaderProps) {
  return (
    <div className={styles.root}>
      {/* Знак из официального набора: экран загрузки был единственным без
          единого брендового элемента. Светлая версия — фон тёмный. */}
      <Image
        alt="РИСсити"
        className={styles.mark}
        height={128}
        priority
        src="/brand/logos/logo-mark-light-128.png"
        width={128}
      />

      {/* Ряд декоративен: смысл несёт подпись, и дублировать его для
          скринридера значит читать одно и то же дважды. */}
      <div aria-hidden="true" className={styles.pan}>
        {Array.from({ length: GRAIN_COUNT }, (_, index) => (
          <span
            className={styles.grain}
            key={index * STAGGER_MS}
            style={{ animationDelay: `${index * STAGGER_MS}ms` }}
          />
        ))}
      </div>

      {/* `<output>` — живая область с ролью `status` без ручного ARIA. */}
      <output className={styles.label}>{label}</output>
    </div>
  );
}
