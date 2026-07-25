import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const srcAlias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

/**
 * Два проекта, а не один. Игровое ядро — чистый TypeScript без DOM, ему jsdom
 * не нужен и только замедляет прогон. Компоненты живут отдельно.
 */
export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias: srcAlias },
        test: {
          name: "core",
          environment: "node",
          include: ["src/{game,server,lib,store}/**/*.test.ts"],
        },
      },
      {
        plugins: [react()],
        resolve: { alias: srcAlias },
        test: {
          name: "dom",
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          include: ["src/{app,components,features,hooks}/**/*.test.{ts,tsx}"],
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/**/*.d.ts",
        "src/app/**/layout.tsx",
        // Конфигурация и обвязка без собственной логики: покрывать нечего.
        "src/lib/fonts.ts",
        "src/lib/env.ts",
        "src/server/db/client.ts",
        "src/server/db/schema.ts",
        "src/server/db/testing.ts",
        "src/store/use-game-store.ts",
        // Композиция экранов и жизненный цикл на requestAnimationFrame.
        // Проверяются в Playwright: в jsdom кадры не выдаются, и юнит-тест
        // проверял бы моки вместо поведения.
        "src/features/screens/**",
        "src/hooks/**",
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
        // Игровое ядро — чистые функции. Неполное покрытие здесь не оправдано ничем.
        "src/game/**/*.ts": {
          lines: 100,
          functions: 100,
          branches: 100,
          statements: 100,
        },
      },
    },
  },
});
