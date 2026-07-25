"use client";

import { UPGRADES } from "@/game/constants";
import { canAffordUpgrade, upgradeCost } from "@/game/economy";
import type { UpgradeDefinition } from "@/game/types";
import { useGameStore } from "@/store/use-game-store";
import styles from "./UpgradeList.module.scss";

const formatter = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

export function UpgradeList() {
  return (
    <ul className={styles.root}>
      {UPGRADES.map((upgrade, index) => (
        <UpgradeRow index={index} key={upgrade.id} upgrade={upgrade} />
      ))}
    </ul>
  );
}

/**
 * Помощники приносят долю силы тапа в секунду, а не фиксированное число зёрен.
 * Показывать «+0,12 в секунду» было бы прямым обманом: без вложений в нажатие
 * эта доля почти ничего не значит, а с ними — очень много.
 */
function formatGain(upgrade: UpgradeDefinition): string {
  if (upgrade.kind === "tap") {
    return `+${formatter.format(upgrade.gain)} за тап`;
  }
  return `+${Math.round(upgrade.gain * 100)}% силы тапа в секунду`;
}

function UpgradeRow({ upgrade, index }: { upgrade: UpgradeDefinition; index: number }) {
  const level = useGameStore((state) => state.local?.upgrades[upgrade.id] ?? 0);
  const affordable = useGameStore((state) =>
    canAffordUpgrade(upgrade, state.local?.upgrades[upgrade.id] ?? 0, state.local?.grains ?? 0),
  );
  const buy = useGameStore((state) => state.buy);

  const maxed = level >= upgrade.maxLevel;
  const cost = upgradeCost(upgrade, level);

  return (
    <li
      className={styles.row}
      // Появление списка со сдвигом: строки въезжают друг за другом.
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <div className={styles.info}>
        <p className={styles.title}>
          {upgrade.title}
          {level > 0 && <span className={styles.level}>ур. {level}</span>}
        </p>
        <p className={styles.description}>
          {upgrade.description} · {formatGain(upgrade)}
        </p>
      </div>

      <button
        className={styles.buy}
        disabled={maxed || !affordable}
        onClick={() => void buy(upgrade.id)}
        type="button"
      >
        {maxed ? "макс." : formatter.format(cost)}
      </button>
    </li>
  );
}
