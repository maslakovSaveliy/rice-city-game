import "server-only";
import type { NextResponse } from "next/server";

export const SESSION_COOKIE = "rc_sid";

/**
 * Кука переживает закрытие браузера — это требование продукта: час идёт
 * независимо от того, открыта вкладка или нет. `httpOnly` закрывает доступ из
 * JavaScript, поэтому подменить идентификатор через консоль нельзя.
 *
 * `sameSite: "lax"` вместо `strict`: гость приходит по QR-коду, то есть
 * переходом снаружи, и при `strict` первый запрос остался бы без куки.
 */
const MAX_AGE_SECONDS = 12 * 60 * 60;

export function attachSessionCookie(
  response: NextResponse,
  sessionId: string,
  secure: boolean,
): NextResponse {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: sessionId,
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return response;
}
