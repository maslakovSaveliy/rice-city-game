import type { UpgradeId } from "./types";

/**
 * Действия, которые клиент может запросить у сервера.
 *
 * Здесь намеренно нет ни зёрен, ни скидки, ни времени: клиент сообщает только
 * намерение, всё остальное вычисляет сервер. Тип лежит в `src/game`, потому что
 * нужен обеим сторонам.
 */
export type SessionAction =
  | { readonly type: "start" }
  | { readonly type: "tap"; readonly taps: number }
  | { readonly type: "upgrade"; readonly id: UpgradeId }
  | { readonly type: "finish" }
  | { readonly type: "fix" }
  | { readonly type: "restart" }
  /**
   * Полный сброс визита: зафиксированная скидка отбрасывается, блокировка
   * снимается, гость возвращается в главное меню. Действие разрушительное,
   * поэтому в интерфейсе закрыто подтверждением.
   */
  | { readonly type: "reset" };

export type SessionActionType = SessionAction["type"];
