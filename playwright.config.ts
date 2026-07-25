import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * Игра существует только на телефонах, поэтому десктопных проектов здесь нет
 * намеренно. `hasTouch` обязателен: без него Playwright шлёт мышиные события,
 * а вся механика тапа построена на pointer-событиях с касанием.
 */
export default defineConfig({
  testDir: "./e2e",
  /**
   * Стандартных 30 секунд не хватает. Первый процент скидки стоит несколько
   * десятков настоящих касаний, а каждое `tap()` проходит полную проверку
   * доступности элемента; под параллельной нагрузкой это уходит за минуту.
   */
  timeout: 90_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Спред, а не `undefined`: при exactOptionalPropertyTypes явный undefined
  // не то же самое, что отсутствие ключа.
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    locale: "ru-RU",
    timezoneId: "Asia/Krasnoyarsk",
  },
  projects: [
    {
      name: "android",
      use: { ...devices["Pixel 7"], hasTouch: true, isMobile: true },
    },
    {
      name: "ios",
      use: { ...devices["iPhone 14"], hasTouch: true, isMobile: true },
    },
  ],
  webServer: {
    // Отдельный файл базы, чтобы прогон не затирал данные разработки.
    command: "mkdir -p data && pnpm build && pnpm db:migrate && pnpm start",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: { DATABASE_URL: "file:./data/e2e.db" },
  },
});
