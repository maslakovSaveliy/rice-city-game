import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { TAP_BURST } from "@/game/constants";
import { startSession } from "@/game/reducer";
import { createInitialState } from "@/game/session";
import { gameStore } from "@/store/use-game-store";
import { TapTarget } from "./TapTarget";

/**
 * Компонент берёт время из `Date.now()` через стор, поэтому фикстура тоже
 * строится от реального времени. С фиксированной датой из прошлого сессия
 * оказывалась просроченной ещё до первого тапа.
 */
function setPlaying(): void {
  const base = startSession(createInitialState(), Date.now());
  gameStore.setState({
    status: "ready",
    clockOffset: 0,
    server: base,
    local: base,
    pendingTaps: 0,
    inFlightTaps: 0,
  });
}

function tapOnce(): void {
  // Реакция навешена на pointerdown, а не на click: клик приходит только после
  // отпускания пальца и на быстром тапе ощущается как залипание.
  fireEvent.pointerDown(screen.getByRole("button", { name: "Тапнуть по Рисинке" }), {
    isPrimary: true,
    pointerType: "touch",
  });
}

beforeEach(() => {
  gameStore.setState({ server: null, local: null, status: "idle", pendingTaps: 0 });
});

describe("TapTarget", () => {
  it("реагирует на pointerdown, а не на click", () => {
    setPlaying();
    render(<TapTarget />);

    fireEvent.click(screen.getByRole("button", { name: "Тапнуть по Рисинке" }));
    expect(gameStore.getState().local?.taps).toBe(0);

    tapOnce();
    expect(gameStore.getState().local?.taps).toBe(1);
  });

  it("копит тапы в очереди на отправку", () => {
    setPlaying();
    render(<TapTarget />);

    tapOnce();
    tapOnce();
    tapOnce();

    expect(gameStore.getState().pendingTaps).toBe(3);
  });

  it("тапы сверх лимита частоты не попадают в очередь", () => {
    setPlaying();
    render(<TapTarget />);

    for (let index = 0; index < TAP_BURST + 20; index += 1) {
      tapOnce();
    }

    expect(gameStore.getState().pendingTaps).toBe(TAP_BURST);
  });

  it("вне игры тап ничего не делает", () => {
    render(<TapTarget />);

    tapOnce();
    expect(gameStore.getState().pendingTaps).toBe(0);
  });

  it("имеет доступное имя для скринридера", () => {
    setPlaying();
    render(<TapTarget />);

    expect(screen.getByRole("button", { name: "Тапнуть по Рисинке" })).toBeInTheDocument();
  });
});
