import { z } from "zod";
import type { SessionAction } from "@/game/actions";
import type { GameState } from "@/game/types";

/**
 * Транспорт до сервера.
 *
 * Ответ валидируется схемой, хотя приходит от нашего же сервера. Причина
 * практическая: браузер может держать закешированный клиент от прошлого
 * деплоя. Лучше упасть громко с понятной ошибкой, чем тихо рисовать
 * неправильное состояние.
 */

const upgradeLevelsSchema = z.object({
  paws: z.int().min(0),
  chopsticks: z.int().min(0),
  wok: z.int().min(0),
  cooker: z.int().min(0),
  waiter: z.int().min(0),
  kitchen: z.int().min(0),
});

const gameStateSchema = z.object({
  phase: z.enum(["idle", "playing", "result", "fixed"]),
  grains: z.number().min(0),
  totalGrains: z.number().min(0),
  taps: z.int().min(0),
  upgrades: upgradeLevelsSchema,
  heat: z.number().min(0),
  tapBudget: z.number().min(0),
  startedAt: z.number().nullable(),
  endsAt: z.number().nullable(),
  lastTickAt: z.number().nullable(),
  fixedAt: z.number().nullable(),
  fixedDiscount: z.number().nullable(),
  attempts: z.int().min(0),
});

const snapshotSchema = z.object({
  state: gameStateSchema,
  serverTime: z.number(),
});

/** Проверка, что схема и тип ядра не разошлись. */
const _schemaMatchesCore: GameState = {} as z.infer<typeof gameStateSchema>;
void _schemaMatchesCore;

export interface SessionSnapshot {
  readonly state: GameState;
  readonly serverTime: number;
}

/** Сервер отказал по-человечески: истёкшая сессия, перегрузка, неверный запрос. */
export class SessionApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly retryAfterMs = 0,
  ) {
    super(message);
    this.name = "SessionApiError";
  }

  /** Сессии больше нет — нужно начинать с чистого листа. */
  get sessionLost(): boolean {
    return this.status === 401 || this.status === 404;
  }

  get throttled(): boolean {
    return this.status === 429;
  }
}

export interface SessionApi {
  read(): Promise<SessionSnapshot>;
  act(action: SessionAction): Promise<SessionSnapshot>;
}

const ENDPOINT = "/api/session";

export function createHttpSessionApi(fetchImpl: typeof fetch = fetch): SessionApi {
  return {
    read: () => request(fetchImpl, { method: "GET" }),
    act: (action) =>
      request(fetchImpl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action),
        // Без `keepalive` браузер обрывает запрос при уходе со страницы, и
        // последняя пачка тапов, отправляемая на `pagehide`, теряется.
        // Ограничение в 64 КБ на тело нам не мешает: оно здесь крошечное.
        keepalive: true,
      }),
  };
}

async function request(fetchImpl: typeof fetch, init: RequestInit): Promise<SessionSnapshot> {
  const response = await fetchImpl(ENDPOINT, { ...init, credentials: "same-origin" });

  if (!response.ok) {
    throw new SessionApiError(
      response.status,
      await errorMessage(response),
      retryAfterMs(response),
    );
  }

  return snapshotSchema.parse(await response.json());
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (typeof body === "object" && body !== null && "error" in body) {
      const { error } = body as { error: unknown };
      if (typeof error === "string") {
        return error;
      }
    }
  } catch {
    // Тело может быть пустым или не-JSON — это не повод падать иначе.
  }
  return `Сервер ответил ${response.status}`;
}

function retryAfterMs(response: Response): number {
  const header = response.headers.get("retry-after");
  const seconds = header === null ? Number.NaN : Number(header);
  return Number.isFinite(seconds) ? seconds * 1000 : 0;
}
