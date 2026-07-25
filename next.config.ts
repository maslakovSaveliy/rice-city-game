import path from "node:path";
import type { NextConfig } from "next";

/**
 * Заголовки безопасности. CSP выдаётся отдельно в `proxy.ts` — там доступен
 * per-request nonce, без которого строгий script-src невозможен.
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
] as const;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Родительские каталоги содержат свои lockfile — без явного корня Turbopack
  // уходит вверх по дереву и подхватывает чужой.
  turbopack: {
    root: import.meta.dirname,
  },
  sassOptions: {
    loadPaths: [path.join(import.meta.dirname, "src/styles")],
  },
  /**
   * Миграции кладутся внутрь функции.
   *
   * На своём сервере схему накатывает `pnpm db:migrate` перед стартом. На
   * бессерверном хостинге такого шага нет вообще, и схему приходится
   * поднимать в рантайме — а для этого папка с миграциями должна попасть
   * в бандл функции, иначе `migrate()` не найдёт файлы.
   */
  outputFileTracingIncludes: {
    "/api/session": ["./drizzle/**/*"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [...SECURITY_HEADERS],
      },
    ];
  },
};

export default nextConfig;
