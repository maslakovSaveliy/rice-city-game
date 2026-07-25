"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { SoundToggle } from "@/features/audio/SoundToggle";
import { Hud } from "@/features/hud/Hud";
import { ParticleCanvas } from "@/features/particles/ParticleCanvas";
import { TapTarget } from "@/features/tap-target/TapTarget";
import { UpgradeList } from "@/features/upgrades/UpgradeList";
import { discountFromGrains } from "@/game/economy";
import { useGameStore } from "@/store/use-game-store";
import styles from "./screens.module.scss";

export function PlayScreen() {
  const [showUpgrades, setShowUpgrades] = useState(false);
  const [confirmingFinish, setConfirmingFinish] = useState(false);
  const finish = useGameStore((state) => state.finish);
  const percent = useGameStore((state) => discountFromGrains(state.local?.grains ?? 0));
  const untouched = useGameStore((state) => (state.local?.taps ?? 0) === 0);

  return (
    // При открытой панели улучшений Рисинке остаётся меньше высоты, поэтому
    // предельный размер цели тапа задаётся здесь, а не внутри компонента.
    <main className={showUpgrades ? `${styles.play} ${styles.playCompact}` : styles.play}>
      {/* Холст растянут на весь экран, чтобы зёрна улетали за пределы поля. */}
      <ParticleCanvas />
      <Hud />

      <div className={styles.playField}>
        <TapTarget />
        {/* Первое, чего игре не хватало: она нигде не говорила, что надо
            делать. Подсказка всегда в разметке и гаснет с первым тапом —
            размонтирование обрывало бы переход, а место она не занимает. */}
        <p
          aria-hidden={!untouched}
          className={untouched ? `${styles.playHint} ${styles.playHintVisible}` : styles.playHint}
        >
          Тапай Рисинку
        </p>
      </div>

      <footer className={styles.playFooter}>
        <SoundToggle />
        <Button
          aria-expanded={showUpgrades}
          onClick={() => setShowUpgrades((open) => !open)}
          variant="secondary"
        >
          {showUpgrades ? "Скрыть" : "Улучшения"}
        </Button>
        <Button onClick={() => setConfirmingFinish(true)} variant="secondary">
          Завершить
        </Button>
      </footer>

      {/* Панель не размонтируется: только так у неё есть и открытие, и
          закрытие. Пока она закрыта, `inert` убирает её содержимое из
          доступности — нулевой высоты для этого мало. */}
      <section
        aria-label="Улучшения"
        className={showUpgrades ? `${styles.sheet} ${styles.sheetOpen}` : styles.sheet}
        inert={!showUpgrades}
      >
        <p className={styles.sheetHint}>
          Улучшения тратят зёрна, поэтому скидка сразу просядет. Зато дальше пойдёт быстрее.
        </p>
        <UpgradeList />
      </section>

      <ConfirmDialog
        cancelLabel="Продолжить игру"
        // Подпись отличается от кнопки в футере намеренно: одинаковые имена
        // делают экран неоднозначным и для человека, и для тестов.
        confirmLabel="Да, завершить"
        description={`Час остановится, и вы перейдёте к результату. Сейчас накоплено ${percent}%.`}
        onCancel={() => setConfirmingFinish(false)}
        onConfirm={() => {
          setConfirmingFinish(false);
          void finish();
        }}
        open={confirmingFinish}
        title="Завершить игру?"
      />
    </main>
  );
}
