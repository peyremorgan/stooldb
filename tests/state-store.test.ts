import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { StoolDB } from "../src/index.js";
import { defineStateSchema } from "../src/state/schema.js";

test("ReactiveStateStore replays and emits updates", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "stooldb-state-store-"));
  const db = new StoolDB({ rootDir: root, processId: "pid-state-store" });
  await db.init();

  const schema = defineStateSchema({
    type: "object",
    fields: {
      counter: { type: "number" },
      label: { type: "string" },
      enabled: { type: "boolean" },
      users: {
        type: "array",
        items: {
          type: "object",
          fields: {
            id: { type: "number" },
            active: { type: "boolean" }
          }
        }
      }
    }
  });

  const store = db.createStateStore({
    streamId: "app-state",
    schema,
    initialState: {
      counter: 0,
      label: "",
      enabled: false,
      users: []
    }
  });

  await store.init();

  const seen: Array<ReturnType<typeof store.getState>> = [];
  const subscription = store.state$.subscribe((state) => {
    seen.push(state);
  });

  const a = await store.apply({ kind: "number.increment", path: ["counter"], by: 5 });
  const b = await store.apply({ kind: "string.append", path: ["label"], value: "hi" });
  const c = await store.apply({ kind: "boolean.toggle", path: ["enabled"] });
  const d = await store.apply({ kind: "array.push", path: ["users"], value: { id: 1, active: false } });
  const e = await store.apply({
    kind: "array.updateWhere",
    path: ["users"],
    where: { fieldPath: ["id"], op: "eq", value: 1 },
    mutate: { fieldPath: ["active"], action: "toggle" }
  });

  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.equal(c.ok, true);
  assert.equal(d.ok, true);
  assert.equal(e.ok, true);

  const finalState = store.getState();
  assert.deepEqual(finalState, {
    counter: 5,
    label: "hi",
    enabled: true,
    users: [{ id: 1, active: true }]
  });

  assert.ok(seen.length >= 2);
  subscription.unsubscribe();

  const reloaded = db.createStateStore({
    streamId: "app-state",
    schema,
    initialState: {
      counter: 0,
      label: "",
      enabled: false,
      users: []
    }
  });

  await reloaded.init();
  assert.deepEqual(reloaded.getState(), finalState);
});
