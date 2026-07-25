import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { grainsForDiscount } from "@/game/economy";
import { startSession } from "@/game/reducer";
import { createInitialState } from "@/game/session";
import type { GameState } from "@/game/types";
import { gameStore } from "@/store/use-game-store";
import { Hud } from "./Hud";

const NOW = 1_700_000_000_000;

/** Компоненты читают из синглтон-стора, поэтому состояние задаётся напрямую. */
function setPlaying(overrides: Partial<GameState> = {}): void {
  const base = startSession(createInitialState(), NOW);
  gameStore.setState({
    status: "ready",
    clockOffset: 0,
    server: base,
    local: { ...base, ...overrides },
  });
}

beforeEach(() => {
  gameStore.setState({ server: null, local: null, status: "idle", clockOffset: 0 });
});

describe("Hud", () => {
  it("показывает полный час в начале сессии", () => {
    setPlaying();
    render(<Hud />);

    expect(screen.getByText("60:00")).toBeInTheDocument();
  });

  it("считает остаток по игровому времени, а не по часам браузера", () => {
    setPlaying({ lastTickAt: NOW + 90_000 });
    render(<Hud />);

    expect(screen.getByText("58:30")).toBeInTheDocument();
  });

  it("на исходе часа показывает нули, а не отрицательное время", () => {
    setPlaying({ lastTickAt: NOW + 60 * 60 * 1000 + 5_000 });
    render(<Hud />);

    expect(screen.getByText("0:00")).toBeInTheDocument();
  });

  it("показывает достигнутый процент скидки", () => {
    setPlaying({ grains: grainsForDiscount(7) });
    render(<Hud />);

    expect(screen.getByText("7%")).toBeInTheDocument();
  });

  it("подсказывает, сколько осталось до следующего процента", () => {
    setPlaying({ grains: grainsForDiscount(3) });
    render(<Hud />);

    expect(screen.getByText(/До 4% осталось/)).toBeInTheDocument();
  });

  it("на потолке сообщает о максимуме вместо следующего процента", () => {
    setPlaying({ grains: grainsForDiscount(30) });
    render(<Hud />);

    expect(screen.getByText("Максимум достигнут")).toBeInTheDocument();
    expect(screen.getByText("30%")).toBeInTheDocument();
  });

  it("счётчик зёрен обновляется вслед за состоянием", async () => {
    setPlaying({ grains: 0 });
    render(<Hud />);

    setPlaying({ grains: 1234 });

    // Счётчик пишется в DOM императивно и дросселируется до кадра.
    await waitFor(() => {
      expect(screen.getByText("1 234")).toBeInTheDocument();
    });
  });
});
