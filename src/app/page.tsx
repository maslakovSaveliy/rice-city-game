import styles from "./page.module.scss";

export default function HomePage() {
  return (
    <main className={styles.root}>
      <p className={styles.kicker}>Семейный ГастроДом</p>
      {/* Начертание из брендбука: «РИС» тёмный, «сити» оранжевый. */}
      <h1 className={styles.title}>
        РИС<span className={styles.titleAccent}>сити</span>
      </h1>
      <p className={styles.script}>Твой любимый рис теперь здесь</p>
      <p className={styles.note}>
        Каркас проекта собран. Игровые экраны появятся на следующих этапах.
      </p>
    </main>
  );
}
