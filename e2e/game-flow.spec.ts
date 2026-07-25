import { expect, type Page, test } from "@playwright/test";

/**
 * Полный путь гостя: QR → меню → игра → результат → фиксация.
 *
 * Проверяется в настоящем браузере с касаниями. Часть игрового цикла живёт на
 * `requestAnimationFrame`, поэтому headless-панели предпросмотра для этого
 * недостаточно: при скрытой вкладке кадры не выдаются вовсе.
 */

const TAP_TARGET = "Тапнуть по Рисинке";

async function tapMascot(page: Page, times: number): Promise<void> {
  const target = page.getByRole("button", { name: TAP_TARGET });
  for (let index = 0; index < times; index += 1) {
    await target.tap();
  }
}

function grainsOf(page: Page): Promise<number> {
  return page
    .locator('[class*="GrainCounter"] [class*="value"]')
    .innerText()
    .then((text) => Number(text.replace(/\s/g, "")));
}

test("меню открывается и предлагает играть", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText("РИС");
  await expect(page.getByRole("button", { name: "Играть" })).toBeVisible();
});

test("тапы копят зёрна и поднимают скидку", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Играть" }).tap();

  await expect(page.getByRole("button", { name: TAP_TARGET })).toBeVisible();
  expect(await grainsOf(page)).toBe(0);

  await tapMascot(page, 25);

  expect(await grainsOf(page)).toBeGreaterThan(0);
  await expect(page.locator('[class*="discountValue"]')).not.toHaveText("0%");
});

test("прогресс живёт на сервере и переживает перезагрузку", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Играть" }).tap();
  await tapMascot(page, 20);

  const before = await grainsOf(page);
  // Ждём окно синхронизации, чтобы тапы дошли до сервера.
  await page.waitForTimeout(2_500);

  await page.reload();

  await expect(page.getByRole("button", { name: TAP_TARGET })).toBeVisible();
  expect(await grainsOf(page)).toBeGreaterThanOrEqual(before);
});

test("таймер идёт вниз", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Играть" }).tap();

  const timer = page.locator('[class*="timerValue"]');
  const first = await timer.innerText();

  await page.waitForTimeout(1_500);
  expect(await timer.innerText()).not.toBe(first);
});

test("улучшение недоступно, пока не хватает зёрен", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Играть" }).tap();
  await page.getByRole("button", { name: "Улучшения" }).tap();

  await expect(page.getByRole("button", { name: "60" })).toBeDisabled();
});

test("результат и фиксация скидки", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Играть" }).tap();
  await tapMascot(page, 25);
  await page.waitForTimeout(2_500);

  await page.getByRole("button", { name: "Завершить" }).tap();

  const result = page.getByRole("button", { name: "Зафиксировать" });
  await expect(result).toBeVisible();
  await expect(result).toBeEnabled();

  await result.tap();

  await expect(page.getByText("Покажите официанту")).toBeVisible();
  // Игра закрыта: тапать больше нечего.
  await expect(page.getByRole("button", { name: TAP_TARGET })).toHaveCount(0);
});

test("двойной тап по Рисинке не масштабирует страницу", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Играть" }).tap();

  const target = page.getByRole("button", { name: TAP_TARGET });
  await target.tap();
  await target.tap();

  const scale = await page.evaluate(() => window.visualViewport?.scale ?? 1);
  expect(scale).toBe(1);
});
