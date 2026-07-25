import { describe, expect, it, vi } from "vitest";
import { createInitialState } from "@/game/session";
import { createHttpSessionApi, SessionApiError } from "./api";

const snapshot = {
  state: createInitialState(),
  serverTime: 1_700_000_000_000,
};

function respond(body: unknown, init: ResponseInit = {}): typeof fetch {
  return vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
        ...init,
      }),
  ) as unknown as typeof fetch;
}

describe("транспорт сессии", () => {
  it("читает состояние методом GET", async () => {
    const fetchImpl = respond(snapshot);
    const api = createHttpSessionApi(fetchImpl);

    await expect(api.read()).resolves.toEqual(snapshot);
    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/session",
      expect.objectContaining({ method: "GET", credentials: "same-origin" }),
    );
  });

  it("отправляет действие телом POST", async () => {
    const fetchImpl = respond(snapshot);
    await createHttpSessionApi(fetchImpl).act({ type: "tap", taps: 5 });

    expect(fetchImpl).toHaveBeenCalledWith(
      "/api/session",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ type: "tap", taps: 5 }) }),
    );
  });

  it("переносит человеческое сообщение об ошибке", async () => {
    const fetchImpl = respond({ error: "Сессия не найдена." }, { status: 404 });

    await expect(createHttpSessionApi(fetchImpl).read()).rejects.toMatchObject({
      status: 404,
      message: "Сессия не найдена.",
      sessionLost: true,
    });
  });

  it("отличает потерю сессии от перегрузки", async () => {
    const throttled = new Response(JSON.stringify({ error: "Слишком часто" }), {
      status: 429,
      headers: { "content-type": "application/json", "retry-after": "3" },
    });
    const fetchImpl = vi.fn(async () => throttled) as unknown as typeof fetch;

    const failure = await createHttpSessionApi(fetchImpl)
      .read()
      .catch((cause: unknown) => cause);

    expect(failure).toBeInstanceOf(SessionApiError);
    expect(failure).toMatchObject({ throttled: true, sessionLost: false, retryAfterMs: 3_000 });
  });

  it("переживает ответ без тела", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("", { status: 500 }),
    ) as unknown as typeof fetch;

    await expect(createHttpSessionApi(fetchImpl).read()).rejects.toMatchObject({
      status: 500,
      message: "Сервер ответил 500",
    });
  });

  it("не пропускает ответ неожиданной формы", async () => {
    // Так проявляется закешированный клиент от прошлого деплоя: лучше упасть
    // громко, чем рисовать неправильное состояние.
    const fetchImpl = respond({ state: { phase: "playing" }, serverTime: "вчера" });

    await expect(createHttpSessionApi(fetchImpl).read()).rejects.toThrow();
  });
});
