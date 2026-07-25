import { expect, test } from "@playwright/test";

/**
 * Юридический блок. Тесты проверяют не формулировки, а наличие обязательного:
 * реквизитов организатора, маркировки, ссылок и уведомления о cookie.
 */

const DOCUMENTS = [
  { slug: "rules", title: "Правила игры и акции" },
  { slug: "privacy", title: "Политика обработки персональных данных" },
  { slug: "terms", title: "Пользовательское соглашение" },
  { slug: "cookies", title: "Файлы cookie" },
] as const;

for (const document of DOCUMENTS) {
  test(`страница «${document.title}» открывается и содержит реквизиты`, async ({ page }) => {
    await page.goto(`/legal/${document.slug}`);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(document.title);

    // Реквизиты проверяются в подвале: название организатора встречается ещё и
    // в тексте документа, поэтому без сужения область поиска неоднозначна.
    const footer = page.getByRole("contentinfo");
    await expect(footer).toContainText("ООО «Ортус Азия»");
    await expect(footer).toContainText("2465369186");
    await expect(footer).toContainText("1252400017550");
    await expect(footer).toContainText("0+");
  });
}

test("правила называют исключения по алкоголю и табаку", async ({ page }) => {
  await page.goto("/legal/rules");
  await expect(page.getByRole("main")).toContainText("алкогольной и табачной продукции");
});

test("правила называют конкретный срок акции", async ({ page }) => {
  await page.goto("/legal/rules");

  // Без дат правила акции неполны: срок — обязательный элемент.
  const main = page.getByRole("main");
  await expect(main).toContainText("27 июля 2026 года");
  await expect(main).toContainText("27 сентября 2026 года");
});

test("правила заявляют отсутствие случайности", async ({ page }) => {
  await page.goto("/legal/rules");
  // Это не украшение текста: случайность в награде превратила бы акцию
  // в стимулирующую лотерею по 138-ФЗ.
  await expect(page.getByRole("main")).toContainText("случайности при начислении");
});

test("политика сообщает, что IP не сохраняется", async ({ page }) => {
  await page.goto("/legal/privacy");
  await expect(page.getByRole("main")).toContainText("В базу данных он не записывается");
});

test("несогласованные тексты помечены черновиком", async ({ page }) => {
  await page.goto("/legal/rules");
  await expect(page.getByRole("note")).toContainText("Черновик");
});

test("документы связаны между собой ссылками", async ({ page }) => {
  await page.goto("/legal/rules");

  await page.getByRole("link", { name: "Файлы cookie" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Файлы cookie");

  await page.getByRole("link", { name: "← К игре" }).click();
  await expect(page.getByRole("button", { name: "Играть" })).toBeVisible();
});

test("уведомление о cookie показывается и закрывается навсегда", async ({ page }) => {
  await page.goto("/");

  const banner = page.getByRole("complementary", { name: "Уведомление о файлах cookie" });
  await expect(banner).toBeVisible();

  await banner.getByRole("button", { name: "Понятно" }).tap();
  await expect(banner).toBeHidden();

  await page.reload();
  await expect(banner).toBeHidden();
});

test("из меню есть ссылки на правила и обработку данных", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "Правила акции" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Обработка данных" })).toBeVisible();
});
