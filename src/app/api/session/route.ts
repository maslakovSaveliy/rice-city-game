import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { MAX_TAPS_PER_BATCH } from "@/game/constants";
import { env } from "@/lib/env";
import { db } from "@/server/db/client";
import { createRateLimiter } from "@/server/rate-limit";
import { attachSessionCookie, SESSION_COOKIE } from "@/server/session-cookie";
import { applyAction, createSession, readSession } from "@/server/session-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Единственная точка входа игры.
 *
 * GET  — прочитать состояние, создав сессию при первом заходе.
 * POST — применить действие. Клиент присылает намерение, считает сервер.
 */

const UPGRADE_IDS = ["paws", "chopsticks", "wok", "cooker", "waiter", "kitchen"] as const;

const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start") }),
  // Верхняя граница щедрая: лишнее отрежет игровое ядро, а отказывать честному
  // клиенту из-за всплеска сети не за что.
  z.object({
    type: z.literal("tap"),
    taps: z
      .int()
      .min(0)
      .max(MAX_TAPS_PER_BATCH * 10),
  }),
  z.object({ type: z.literal("upgrade"), id: z.enum(UPGRADE_IDS) }),
  z.object({ type: z.literal("finish") }),
  z.object({ type: z.literal("fix") }),
  z.object({ type: z.literal("restart") }),
  z.object({ type: z.literal("reset") }),
]);

/** Синхронизация идёт раз в две секунды; запас на повторы и ручные действия. */
const actionLimiter = createRateLimiter({ limit: 20, windowMs: 10_000 });

/**
 * Ограничение на создание сессий с одного адреса.
 *
 * Это защита от обстрела, а не от повторной игры. Порог намеренно очень
 * высокий: весь зал сидит за одним NAT, и в час пик сотня столов легко даёт
 * сотни новых сессий. Прежнее значение в 60 отсекало живых гостей — это
 * поймал прогон тестов, где 86 сессий приходят с одного адреса.
 */
const creationLimiter = createRateLimiter({ limit: 600, windowMs: 60 * 60 * 1000 });

const MAX_BODY_BYTES = 1024;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const now = Date.now();
  const store = await cookies();
  const existing = store.get(SESSION_COOKIE)?.value;

  if (existing) {
    const view = await readSession(db, existing, now);
    if (view) {
      return NextResponse.json(view);
    }
  }

  const address = clientAddress(request);
  if (address && !creationLimiter(address, now).allowed) {
    return problem(429, "Слишком много новых игр с этого адреса.");
  }

  const { id, view } = await createSession(db, now);
  return attachSessionCookie(NextResponse.json(view), id, isSecure());
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const now = Date.now();
  const store = await cookies();
  const sessionId = store.get(SESSION_COOKIE)?.value;

  if (!sessionId) {
    return problem(401, "Сессия не найдена. Обновите страницу.");
  }

  const limit = actionLimiter(sessionId, now);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Слишком часто. Подождите немного." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
  }

  const body = await readBody(request);
  if (body === null) {
    return problem(400, "Некорректный запрос.");
  }

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return problem(400, "Некорректное действие.");
  }

  const view = await applyAction(db, sessionId, parsed.data, now);
  if (!view) {
    return problem(404, "Сессия не найдена. Обновите страницу.");
  }

  return NextResponse.json(view);
}

async function readBody(request: NextRequest): Promise<unknown> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_BODY_BYTES) {
    return null;
  }

  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Адрес берётся только из заголовка обратного прокси. Если его нет, лимит на
 * создание сессий не применяется вовсе — иначе все гости попали бы в одно ведро.
 */
function clientAddress(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || null;
}

function isSecure(): boolean {
  return env.SITE_URL.startsWith("https://");
}

function problem(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}
