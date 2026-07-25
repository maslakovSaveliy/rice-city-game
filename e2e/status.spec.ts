import { expect, test } from "@playwright/test";

/**
 * Тупиковые состояния: 404 и отсутствие связи.
 *
 * Проверяется не только текст, но и то, что гость остаётся внутри бренда —
 * страница сервера по умолчанию тут неприемлема.
 */

test("несуществующий адрес отдаёт брендовую страницу", async ({ page }) => {
  const response = await page.goto("/такой-страницы-нет");

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Такой страницы нет");
  await expect(page.getByRole("link", { name: "Вернуться к игре" })).toBeVisible();
  await expect(page.getByText("ООО «Ортус Азия»")).toBeVisible();
});

test("со страницы 404 можно вернуться в игру", async ({ page }) => {
  await page.goto("/нет-такой");
  await page.getByRole("link", { name: "Вернуться к игре" }).tap();

  await expect(page.getByRole("button", { name: "Играть" })).toBeVisible();
});

/**
 * Полностью офлайновый старт здесь не проверить: без сервис-воркера сам
 * документ не загрузится и гость увидит страницу браузера, а не нашу. Реальный
 * случай, который закрывает этот экран, — страница пришла, а запрос к API нет.
 */
test("страница загрузилась, а API недоступен — предлагается повтор", async ({ page }) => {
  await page.route("**/api/session", (route) => route.abort("connectionfailed"));
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Нет связи");
  const retry = page.getByRole("button", { name: "Повторить" });
  await expect(retry).toBeVisible();

  await page.unroute("**/api/session");
  await retry.tap();

  await expect(page.getByRole("button", { name: "Играть" })).toBeVisible();
});

test("обрыв связи в игре не мешает тапать, прогресс догоняет", async ({ page, context }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Играть" }).tap();

  const target = page.getByRole("button", { name: "Тапнуть по Рисинке" });
  const grains = page.locator('[class*="GrainCounter"] [class*="value"]');

  await target.tap();
  await page.waitForTimeout(2_500);
  const synced = Number((await grains.innerText()).replace(/\s/g, ""));

  await context.setOffline(true);
  await expect(page.getByText(/Нет связи/)).toBeVisible();

  // Игра продолжается: предсказание считается локально.
  for (let index = 0; index < 10; index += 1) {
    await target.tap();
  }
  const offlineTotal = Number((await grains.innerText()).replace(/\s/g, ""));
  expect(offlineTotal).toBeGreaterThan(synced);

  // Связь вернулась — очередь уходит на сервер, а не теряется.
  await context.setOffline(false);
  await page.waitForTimeout(3_000);
  await expect(page.getByText(/Нет связи/)).toBeHidden();

  await page.reload();
  await expect(target).toBeVisible();
  const afterReload = Number((await grains.innerText()).replace(/\s/g, ""));
  expect(afterReload).toBeGreaterThanOrEqual(offlineTotal);
});
