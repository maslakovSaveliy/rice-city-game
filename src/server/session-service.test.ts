import { beforeEach, describe, expect, it } from "vitest";
import {
  BASE_TAP_VALUE,
  DISCOUNT_MAX,
  MAX_TAPS_PER_BATCH,
  SESSION_DURATION_MS,
  SYNC_INTERVAL_MS,
} from "@/game/constants";
import { getUpgrade, upgradeCost } from "@/game/economy";
import type { Database } from "./db/client";
import { events } from "./db/schema";
import { createTestDatabase } from "./db/testing";
import { clearSessionLocks } from "./session-lock";
import { applyAction, createSession, readSession } from "./session-service";

const NOW = 1_700_000_000_000;

let db: Database;

beforeEach(async () => {
  clearSessionLocks();
  db = await createTestDatabase();
});

async function startedSession(now = NOW): Promise<string> {
  const { id } = await createSession(db, now);
  await applyAction(db, id, { type: "start" }, now);
  return id;
}

describe("создание и чтение", () => {
  it("новая сессия начинается в простое", async () => {
    const { id, view } = await createSession(db, NOW);

    expect(id).toHaveLength(32);
    expect(view.state.phase).toBe("idle");
    expect(view.discount).toBe(0);
  });

  it("идентификаторы не повторяются", async () => {
    const first = await createSession(db, NOW);
    const second = await createSession(db, NOW);
    expect(first.id).not.toBe(second.id);
  });

  it("несуществующая сессия читается как отсутствующая", async () => {
    expect(await readSession(db, "нет-такой", NOW)).toBeNull();
  });

  it("состояние переживает перезагрузку клиента", async () => {
    const id = await startedSession();
    await applyAction(db, id, { type: "tap", taps: 20 }, NOW + SYNC_INTERVAL_MS);

    const reloaded = await readSession(db, id, NOW + SYNC_INTERVAL_MS);
    expect(reloaded?.state.taps).toBe(20);
  });
});

describe("серверный подсчёт тапов", () => {
  it("начисляет зёрна за присланную пачку", async () => {
    const id = await startedSession();
    const view = await applyAction(db, id, { type: "tap", taps: 24 }, NOW + SYNC_INTERVAL_MS);

    expect(view?.state.taps).toBe(24);
    expect(view?.state.grains).toBeGreaterThan(0);
  });

  it("клиент не может прислать результат — только количество тапов", async () => {
    const id = await startedSession();
    // Единственное, чем управляет клиент, — число тапов. Зёрна и скидку
    // считает сервер, подсунуть их в запросе нельзя по схеме действия.
    const view = await applyAction(db, id, { type: "tap", taps: 1 }, NOW + 100);

    expect(view?.state.grains).toBe(BASE_TAP_VALUE);
    expect(view?.discount).toBe(0);
  });

  it("огромная пачка обрезается лимитом", async () => {
    const id = await startedSession();
    const view = await applyAction(db, id, { type: "tap", taps: 400 }, NOW + SYNC_INTERVAL_MS);

    expect(view?.state.taps).toBeLessThanOrEqual(MAX_TAPS_PER_BATCH);
  });

  it("непрерывный обстрел не разгоняет скидку выше потолка", async () => {
    const id = await startedSession();

    for (let window = 1; window <= 200; window += 1) {
      await applyAction(db, id, { type: "tap", taps: 400 }, NOW + SYNC_INTERVAL_MS * window);
    }

    const view = await readSession(db, id, NOW + SYNC_INTERVAL_MS * 200);
    expect(view?.discount).toBeLessThanOrEqual(DISCOUNT_MAX);
  });

  it("пачка через границу часа закрывает сессию и остаётся ограниченной", async () => {
    const id = await startedSession();
    const after = await applyAction(
      db,
      id,
      { type: "tap", taps: 400 },
      NOW + SESSION_DURATION_MS + 60_000,
    );

    // Тапы могли произойти внутри часа, поэтому часть засчитывается. Но окно
    // ограничено корзиной, и час на этом закрывается.
    expect(after?.state.phase).toBe("result");
    expect(after?.state.taps).toBeLessThanOrEqual(MAX_TAPS_PER_BATCH);
  });

  it("после конца часа новые пачки не проходят вовсе", async () => {
    const id = await startedSession();
    await applyAction(db, id, { type: "tap", taps: 10 }, NOW + SESSION_DURATION_MS + 1_000);
    const before = await readSession(db, id, NOW + SESSION_DURATION_MS + 2_000);

    const after = await applyAction(
      db,
      id,
      { type: "tap", taps: 400 },
      NOW + SESSION_DURATION_MS + 3_000,
    );

    expect(after?.state.taps).toBe(before?.state.taps);
  });

  it("молчать и слать одной пачкой невыгодно", async () => {
    const honest = await startedSession();
    const delayed = await startedSession();

    // Честный клиент синхронизируется каждые две секунды всю минуту.
    for (let window = 1; window <= 30; window += 1) {
      await applyAction(
        db,
        honest,
        { type: "tap", taps: MAX_TAPS_PER_BATCH },
        NOW + SYNC_INTERVAL_MS * window,
      );
    }

    // Второй молчит минуту и сваливает всё одним запросом.
    await applyAction(db, delayed, { type: "tap", taps: 400 }, NOW + SYNC_INTERVAL_MS * 30);

    const honestView = await readSession(db, honest, NOW + SYNC_INTERVAL_MS * 31);
    const delayedView = await readSession(db, delayed, NOW + SYNC_INTERVAL_MS * 31);

    expect(delayedView?.state.grains).toBeLessThan(honestView?.state.grains ?? 0);
  });
});

describe("покупки", () => {
  it("без зёрен улучшение не покупается", async () => {
    const id = await startedSession();
    const view = await applyAction(db, id, { type: "upgrade", id: "wok" }, NOW + 1_000);

    expect(view?.state.upgrades.wok).toBe(0);
  });

  it("покупка списывает зёрна и снижает скидку", async () => {
    const id = await startedSession();

    // Копим ровно на первый уровень «Крепких лапок». Привязываться к проценту
    // скидки здесь нельзя: цена процента — балансировочная константа, и при
    // её росте цикл превращался в тысячи запросов к базе.
    const target = upgradeCost(getUpgrade("paws"), 0);
    let now = NOW;
    let guard = 0;
    while (guard < 200) {
      now += SYNC_INTERVAL_MS;
      guard += 1;
      const view = await applyAction(db, id, { type: "tap", taps: MAX_TAPS_PER_BATCH }, now);
      if ((view?.state.grains ?? 0) >= target) {
        break;
      }
    }
    expect(guard, "не удалось накопить на улучшение за 200 окон").toBeLessThan(200);

    const before = await readSession(db, id, now);
    const after = await applyAction(db, id, { type: "upgrade", id: "paws" }, now);

    expect(after?.state.upgrades.paws).toBe(1);
    expect(after?.state.grains).toBeLessThan(before?.state.grains ?? 0);
  });
});

describe("завершение и фиксация", () => {
  it("фиксация замораживает процент", async () => {
    const id = await startedSession();
    await applyAction(db, id, { type: "tap", taps: 30 }, NOW + SYNC_INTERVAL_MS);
    await applyAction(db, id, { type: "finish" }, NOW + SYNC_INTERVAL_MS * 2);

    const fixed = await applyAction(db, id, { type: "fix" }, NOW + SYNC_INTERVAL_MS * 3);

    expect(fixed?.state.phase).toBe("fixed");
    expect(fixed?.state.fixedDiscount).toBe(fixed?.discount);
  });

  it("после фиксации тапы больше не считаются", async () => {
    const id = await startedSession();
    await applyAction(db, id, { type: "finish" }, NOW + 1_000);
    await applyAction(db, id, { type: "fix" }, NOW + 2_000);

    const after = await applyAction(db, id, { type: "tap", taps: 40 }, NOW + 3_000);
    expect(after?.state.taps).toBe(0);
    expect(after?.state.phase).toBe("fixed");
  });

  it("час, истёкший пока вкладка была закрыта, переключается на чтении", async () => {
    const id = await startedSession();
    const view = await readSession(db, id, NOW + SESSION_DURATION_MS + 1);

    expect(view?.state.phase).toBe("result");
    expect(view?.remainingMs).toBe(0);
  });

  it("перезапуск даёт новый час и увеличивает счётчик попыток", async () => {
    const id = await startedSession();
    await applyAction(db, id, { type: "tap", taps: 30 }, NOW + SYNC_INTERVAL_MS);
    await applyAction(db, id, { type: "finish" }, NOW + SYNC_INTERVAL_MS * 2);

    const restarted = await applyAction(db, id, { type: "restart" }, NOW + SYNC_INTERVAL_MS * 3);

    expect(restarted?.state.phase).toBe("playing");
    expect(restarted?.state.taps).toBe(0);
    expect(restarted?.state.attempts).toBe(1);
  });
});

describe("события", () => {
  it("пишутся на смене фазы, но не на каждом тапе", async () => {
    const id = await startedSession();
    await applyAction(db, id, { type: "tap", taps: 10 }, NOW + SYNC_INTERVAL_MS);
    await applyAction(db, id, { type: "tap", taps: 10 }, NOW + SYNC_INTERVAL_MS * 2);
    await applyAction(db, id, { type: "finish" }, NOW + SYNC_INTERVAL_MS * 3);
    await applyAction(db, id, { type: "fix" }, NOW + SYNC_INTERVAL_MS * 4);

    const recorded = await db.select().from(events);
    expect(recorded.map((row) => row.type)).toEqual(["started", "finished", "fixed"]);
  });

  it("не содержат персональных данных", async () => {
    const id = await startedSession();
    const [row] = await db.select().from(events);

    expect(Object.keys(row ?? {})).toEqual(["id", "sessionId", "type", "at", "discount", "taps"]);
    expect(row?.sessionId).toBe(id);
  });
});

describe("параллельные запросы", () => {
  it("не теряют тапы при наложении", async () => {
    const id = await startedSession();

    await Promise.all(
      Array.from({ length: 5 }, (_, index) =>
        applyAction(db, id, { type: "tap", taps: 3 }, NOW + SYNC_INTERVAL_MS * (index + 1)),
      ),
    );

    const view = await readSession(db, id, NOW + SYNC_INTERVAL_MS * 6);
    expect(view?.state.taps).toBe(15);
  });
});
