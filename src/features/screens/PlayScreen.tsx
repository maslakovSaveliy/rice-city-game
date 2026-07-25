"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Hud } from "@/features/hud/Hud";
import { ParticleCanvas } from "@/features/particles/ParticleCanvas";
import { TapTarget } from "@/features/tap-target/TapTarget";
import { UpgradeList } from "@/features/upgrades/UpgradeList";
import { useGameStore } from "@/store/use-game-store";
import styles from "./screens.module.scss";

export function PlayScreen() {
  const [showUpgrades, setShowUpgrades] = useState(false);
  const finish = useGameStore((state) => state.finish);

  return (
    <main className={styles.play}>
      {/* Холст растянут на весь экран, чтобы зёрна улетали за пределы поля. */}
      <ParticleCanvas />
      <Hud />

      <div className={styles.playField}>
        <TapTarget />
      </div>

      <footer className={styles.playFooter}>
        <Button
          aria-expanded={showUpgrades}
          onClick={() => setShowUpgrades((open) => !open)}
          variant="secondary"
        >
          {showUpgrades ? "Скрыть" : "Улучшения"}
        </Button>
        <Button onClick={() => void finish()} variant="ghost">
          Завершить
        </Button>
      </footer>

      {showUpgrades && (
        <section aria-label="Улучшения" className={styles.sheet}>
          <p className={styles.sheetHint}>
            Улучшения тратят зёрна, поэтому скидка сразу просядет. Зато дальше пойдёт быстрее.
          </p>
          <UpgradeList />
        </section>
      )}
    </main>
  );
}
