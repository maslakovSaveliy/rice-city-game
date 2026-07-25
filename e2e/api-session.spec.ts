import { expect, test } from "@playwright/test";

/**
 * Проверки серверной защиты через настоящий HTTP.
 *
 * Смысл: клиент управляет только количеством тапов. Всё остальное — зёрна,
 * скидка, время, лимиты — считает сервер, и подделать это запросом нельзя.
 */

/** Адрес берётся из конфигурации проекта; пустая строка сюда попасть не должна. */
function baseUrl(): string {
  return test.info().project.use.baseURL ?? "";
}

test.describe("серверная сессия", () => {
  test("первый заход выдаёт httpOnly-куку и пустое состояние", async ({ request }) => {
    const response = await request.get("/api/session");
    expect(response.ok()).toBe(true);

    const body = await response.json();
    expect(body.state.phase).toBe("idle");
    expect(body.discount).toBe(0);

    const cookie = response
      .headersArray()
      .find((header) => header.name.toLowerCase() === "set-cookie")
      ?.value.toLowerCase();

    expect(cookie).toContain("rc_sid=");
    expect(cookie).toContain("httponly");
    expect(cookie).toContain("samesite=lax");
  });

  test("тапы считает сервер", async ({ request }) => {
    await request.get("/api/session");
    await request.post("/api/session", { data: { type: "start" } });

    const response = await request.post("/api/session", { data: { type: "tap", taps: 10 } });
    const body = await response.json();

    expect(body.state.taps).toBe(10);
    expect(body.state.grains).toBeGreaterThan(0);
  });

  test("подсунуть зёрна и скидку в запросе не получается", async ({ request }) => {
    await request.get("/api/session");
    await request.post("/api/session", { data: { type: "start" } });

    const response = await request.post("/api/session", {
      data: {
        type: "tap",
        taps: 1,
        grains: 9_999_999,
        discount: 30,
        fixedDiscount: 30,
        phase: "fixed",
      },
    });

    const body = await response.json();
    expect(body.state.grains).toBe(1);
    expect(body.discount).toBe(0);
    expect(body.state.phase).toBe("playing");
  });

  test("несуществующее действие отвергается", async ({ request }) => {
    await request.get("/api/session");

    const response = await request.post("/api/session", { data: { type: "стать-богатым" } });
    expect(response.status()).toBe(400);
  });

  test("отрицательное и дробное количество тапов отвергается", async ({ request }) => {
    await request.get("/api/session");
    await request.post("/api/session", { data: { type: "start" } });

    expect((await request.post("/api/session", { data: { type: "tap", taps: -5 } })).status()).toBe(
      400,
    );
    expect(
      (await request.post("/api/session", { data: { type: "tap", taps: 1.5 } })).status(),
    ).toBe(400);
  });

  test("без куки действие не проходит", async ({ playwright }) => {
    const anonymous = await playwright.request.newContext({ baseURL: baseUrl() });
    const response = await anonymous.post("/api/session", { data: { type: "start" } });

    expect(response.status()).toBe(401);
    await anonymous.dispose();
  });

  test("чужой идентификатор сессии не подходит", async ({ playwright }) => {
    const forged = await playwright.request.newContext({
      baseURL: baseUrl(),
      // Значение куки обязано быть ASCII, иначе запрос не соберётся.
      extraHTTPHeaders: { cookie: "rc_sid=forged-id-that-is-not-in-the-database" },
    });

    const response = await forged.post("/api/session", { data: { type: "start" } });
    expect(response.status()).toBe(404);
    await forged.dispose();
  });

  test("состояние переживает потерю клиента", async ({ request }) => {
    await request.get("/api/session");
    await request.post("/api/session", { data: { type: "start" } });
    await request.post("/api/session", { data: { type: "tap", taps: 7 } });

    const reread = await request.get("/api/session");
    const body = await reread.json();

    expect(body.state.taps).toBe(7);
    expect(body.state.phase).toBe("playing");
  });

  test("частые запросы упираются в ограничитель", async ({ request }) => {
    await request.get("/api/session");
    await request.post("/api/session", { data: { type: "start" } });

    let limited = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const response = await request.post("/api/session", { data: { type: "tap", taps: 1 } });
      if (response.status() === 429) {
        limited = true;
        expect(response.headers()["retry-after"]).toBeDefined();
        break;
      }
    }

    expect(limited).toBe(true);
  });
});
