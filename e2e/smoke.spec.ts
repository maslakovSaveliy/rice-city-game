import { expect, test } from "@playwright/test";

/**
 * Смоук-проверка каркаса. Расширяется по мере появления экранов:
 * QR → меню → игра → результат → фиксация.
 */

test("главная открывается и отдаёт брендовый заголовок", async ({ page }) => {
  await page.goto("/");

  // Заголовок несёт официальный логотип, а не набранный текст, поэтому имя
  // берётся из доступности — из `alt` картинки, а не из текстового узла.
  await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName("РИСсити");
  await expect(page).toHaveTitle(/РИСсити/);
});

test("страница помечена русским языком", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
});

test("отдаются заголовки безопасности", async ({ page }) => {
  const response = await page.goto("/");
  const headers = response?.headers() ?? {};

  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(headers["x-powered-by"]).toBeUndefined();
});

/**
 * Главный экран не прокручивается — требование продукта. Проверяется на самом
 * тесном реальном телефоне: если помещается там, поместится везде.
 */
test("главный экран помещается целиком и не прокручивается", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Играть" })).toBeVisible();

  const overflow = await page.evaluate(() => {
    const menu = document.querySelector('main[class*="menu"]');
    return {
      menu: menu ? menu.scrollHeight - menu.clientHeight : -1,
      document: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    };
  });

  expect(overflow.menu).toBeLessThanOrEqual(0);
  expect(overflow.document).toBeLessThanOrEqual(0);
});

test("страница не прокручивается по горизонтали", async ({ page }) => {
  await page.goto("/");

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
});
