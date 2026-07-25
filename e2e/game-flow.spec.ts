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

/**
 * Ждёт ответ, в котором сервер уже насчитал нужное число тапов.
 *
 * Ждать «любую успешную отправку» недостаточно: синхронизация идёт по таймеру,
 * и в момент ожидания вполне может лететь запрос, отправленный ДО последних
 * тапов. Тест на этом плавал.
 */
function waitForServerTaps(page: Page, atLeast: number): Promise<unknown> {
  return page.waitForResponse(async (response) => {
    if (
      !response.url().includes("/api/session") ||
      response.request().method() !== "POST" ||
      !response.ok()
    ) {
      return false;
    }
    const body: { state?: { taps?: number } } = await response.json();
    return (body.state?.taps ?? 0) >= atLeast;
  });
}

/** Завершение теперь закрыто подтверждением: два нажатия вместо одного. */
async function finishGame(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Завершить" }).tap();
  await page.getByRole("button", { name: "Да, завершить" }).tap();
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

  const synced = waitForServerTaps(page, 20);
  await tapMascot(page, 20);
  const before = await grainsOf(page);
  await synced;

  await page.reload();
  await expect(page.getByRole("button", { name: TAP_TARGET })).toBeVisible();

  /**
   * Точного совпадения быть не может, и это не баг. Клиент начисляет тапы в
   * реальном времени, сервер применяет ту же пачку распределённой по интервалу,
   * поэтому жар между тапами эволюционирует чуть иначе — расхождение в
   * единицы зёрен. Проверяется главное: прогресс сохранился на сервере,
   * а не откатился к нулю.
   */
  const afterReload = await grainsOf(page);
  expect(afterReload).toBeGreaterThan(0);
  expect(afterReload).toBeGreaterThanOrEqual(before - 3);
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

  const synced = waitForServerTaps(page, 25);
  await tapMascot(page, 25);
  await synced;

  await finishGame(page);

  const result = page.getByRole("button", { name: "Зафиксировать" });
  await expect(result).toBeVisible();
  await expect(result).toBeEnabled();

  await result.tap();

  await expect(page.getByText("Покажите официанту")).toBeVisible();
  // Игра закрыта: тапать больше нечего.
  await expect(page.getByRole("button", { name: TAP_TARGET })).toHaveCount(0);
});

test("после фиксации можно уйти в меню и вернуться к скидке", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Играть" }).tap();

  const synced = waitForServerTaps(page, 25);
  await tapMascot(page, 25);
  await synced;

  await finishGame(page);
  await page.getByRole("button", { name: "Зафиксировать" }).tap();
  await expect(page.getByText("Покажите официанту")).toBeVisible();

  await page.getByRole("button", { name: "В меню" }).tap();
  await expect(page.getByText("Игра завершена")).toBeVisible();
  await expect(page.getByText(/Скидка зафиксирована/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Правила акции" })).toBeVisible();

  // Кнопки «Играть» здесь быть не должно: сервер закрыл игру на визит,
  // и она бы просто ничего не делала.
  await expect(page.getByRole("button", { name: "Играть" })).toHaveCount(0);

  await page.getByRole("button", { name: "Показать официанту" }).tap();
  await expect(page.getByText("Покажите официанту")).toBeVisible();
});

test("отказ от скидки требует подтверждения и возвращает в главное меню", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Играть" }).tap();

  const synced = waitForServerTaps(page, 25);
  await tapMascot(page, 25);
  await synced;

  await finishGame(page);
  await page.getByRole("button", { name: "Зафиксировать" }).tap();
  await page.getByRole("button", { name: "В меню" }).tap();

  // Отмена ничего не ломает: скидка остаётся на месте.
  await page.getByRole("button", { name: "Сыграть ещё раз" }).tap();
  await expect(page.getByText("Начать заново?")).toBeVisible();
  await page.getByRole("button", { name: "Оставить скидку" }).tap();
  await expect(page.getByText(/Скидка зафиксирована/)).toBeVisible();

  // Подтверждение сбрасывает сессию на сервере.
  await page.getByRole("button", { name: "Сыграть ещё раз" }).tap();
  await page.getByRole("button", { name: "Стереть и начать заново" }).tap();

  await expect(page.getByRole("button", { name: "Играть" })).toBeVisible();

  // Сброс настоящий: новая игра действительно запускается.
  await page.getByRole("button", { name: "Играть" }).tap();
  await expect(page.getByRole("button", { name: TAP_TARGET })).toBeVisible();
  expect(await grainsOf(page)).toBe(0);
});

test("сброс переживает перезагрузку: сервер знает, что скидки больше нет", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Играть" }).tap();

  const synced = waitForServerTaps(page, 25);
  await tapMascot(page, 25);
  await synced;

  await finishGame(page);
  await page.getByRole("button", { name: "Зафиксировать" }).tap();
  await page.getByRole("button", { name: "В меню" }).tap();
  await page.getByRole("button", { name: "Сыграть ещё раз" }).tap();
  await page.getByRole("button", { name: "Стереть и начать заново" }).tap();
  await expect(page.getByRole("button", { name: "Играть" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Играть" })).toBeVisible();
  await expect(page.getByText("Покажите официанту")).toHaveCount(0);
});

test("после перезагрузки гость снова видит свою скидку", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Играть" }).tap();

  const synced = waitForServerTaps(page, 25);
  await tapMascot(page, 25);
  await synced;

  await finishGame(page);
  await page.getByRole("button", { name: "Зафиксировать" }).tap();
  const percent = await page.locator('[class*="bigPercent"]').first().innerText();

  await page.reload();

  await expect(page.getByText("Покажите официанту")).toBeVisible();
  expect(await page.locator('[class*="bigPercent"]').first().innerText()).toBe(percent);
});

test("завершение закрыто подтверждением: случайный тап не обрывает игру", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Играть" }).tap();
  await tapMascot(page, 5);

  await page.getByRole("button", { name: "Завершить" }).tap();
  await expect(page.getByText("Завершить игру?")).toBeVisible();

  await page.getByRole("button", { name: "Продолжить игру" }).tap();

  // Игра продолжается, тапать по-прежнему можно.
  await expect(page.getByRole("button", { name: TAP_TARGET })).toBeVisible();
  const before = await grainsOf(page);
  await tapMascot(page, 3);
  expect(await grainsOf(page)).toBeGreaterThan(before);
});

test("звук можно выключить, и выбор запоминается", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Играть" }).tap();

  await page.getByRole("button", { name: "Выключить звук" }).tap();
  await expect(page.getByRole("button", { name: "Включить звук" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("button", { name: "Включить звук" })).toBeVisible();
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
