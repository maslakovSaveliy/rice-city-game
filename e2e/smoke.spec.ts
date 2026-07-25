import { expect, test } from "@playwright/test";

/**
 * Смоук-проверка каркаса. Расширяется по мере появления экранов:
 * QR → меню → игра → результат → фиксация.
 */

test("главная открывается и отдаёт брендовый заголовок", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("РИСсити");
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

test("страница не прокручивается по горизонтали", async ({ page }) => {
  await page.goto("/");

  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflows).toBe(false);
});
