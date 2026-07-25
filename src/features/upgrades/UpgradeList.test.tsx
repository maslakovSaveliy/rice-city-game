import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getUpgrade, upgradeCost } from "@/game/economy";
import { startSession } from "@/game/reducer";
import { createInitialState } from "@/game/session";
import type { GameState } from "@/game/types";
import { gameStore } from "@/store/use-game-store";
import { UpgradeList } from "./UpgradeList";

const NOW = 1_700_000_000_000;
const paws = getUpgrade("paws");

function setPlaying(overrides: Partial<GameState> = {}): void {
  const base = startSession(createInitialState(), NOW);
  gameStore.setState({ status: "ready", server: base, local: { ...base, ...overrides } });
}

beforeEach(() => {
  gameStore.setState({ server: null, local: null, status: "idle" });
});

describe("UpgradeList", () => {
  it("показывает все улучшения с ценами", () => {
    setPlaying();
    render(<UpgradeList />);

    expect(screen.getByText("Крепкие лапки")).toBeInTheDocument();
    expect(screen.getByText("Вок")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: String(paws.baseCost) })).toBeInTheDocument();
  });

  it("кнопка заблокирована, пока не хватает зёрен", () => {
    setPlaying({ grains: paws.baseCost - 1 });
    render(<UpgradeList />);

    expect(screen.getByRole("button", { name: String(paws.baseCost) })).toBeDisabled();
  });

  it("кнопка доступна ровно на пороге цены", () => {
    setPlaying({ grains: paws.baseCost });
    render(<UpgradeList />);

    expect(screen.getByRole("button", { name: String(paws.baseCost) })).toBeEnabled();
  });

  it("на максимальном уровне вместо цены написано «макс.»", () => {
    setPlaying({
      grains: Number.MAX_SAFE_INTEGER,
      upgrades: { ...createInitialState().upgrades, paws: paws.maxLevel },
    });
    render(<UpgradeList />);

    expect(screen.getAllByRole("button", { name: "макс." }).length).toBeGreaterThan(0);
  });

  it("показывает текущий уровень купленного улучшения", () => {
    setPlaying({ upgrades: { ...createInitialState().upgrades, paws: 3 } });
    render(<UpgradeList />);

    expect(screen.getByText("ур. 3")).toBeInTheDocument();
  });

  it("цена растёт вместе с уровнем", () => {
    setPlaying({ upgrades: { ...createInitialState().upgrades, paws: 2 } });
    render(<UpgradeList />);

    const expected = upgradeCost(paws, 2);
    expect(screen.getByRole("button", { name: String(expected) })).toBeInTheDocument();
    expect(expected).toBeGreaterThan(paws.baseCost);
  });

  it("нажатие запрашивает покупку у стора", async () => {
    const buy = vi.fn(async () => undefined);
    setPlaying({ grains: paws.baseCost });
    gameStore.setState({ buy });

    render(<UpgradeList />);
    await userEvent.click(screen.getByRole("button", { name: String(paws.baseCost) }));

    expect(buy).toHaveBeenCalledWith("paws");
  });
});
