/**
 * Последовательное выполнение операций над одной сессией.
 *
 * Клиент шлёт пачку тапов раз в две секунды, но при плохой сети запросы легко
 * наложатся. Без сериализации получится классическая гонка «прочитал —
 * посчитал — записал», и один из результатов молча потеряется.
 *
 * ОГРАНИЧЕНИЕ: блокировка живёт в памяти процесса. При запуске нескольких
 * экземпляров приложения потребуется внешняя блокировка или транзакции с
 * условным обновлением. Для одного ресторана на одном сервере этого достаточно.
 */
const chains = new Map<string, Promise<unknown>>();

export function withSessionLock<T>(key: string, task: () => Promise<T>): Promise<T> {
  const previous = chains.get(key) ?? Promise.resolve();
  const run = previous.then(task, task);

  const settled = run.then(
    () => undefined,
    () => undefined,
  );
  chains.set(key, settled);

  void settled.then(() => {
    if (chains.get(key) === settled) {
      chains.delete(key);
    }
  });

  return run;
}

/** Только для тестов: сбрасывает накопленные цепочки. */
export function clearSessionLocks(): void {
  chains.clear();
}
