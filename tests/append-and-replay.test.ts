import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { StoolDB } from "../src/index.js";

test("append events and replay state", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "stooldb-append-"));
  const db = new StoolDB({ rootDir: root, processId: "pid-test" });
  await db.init();

  db.registerEventSchema("Incremented", "1", {
    type: "object",
    required: ["delta"],
    properties: {
      delta: { type: "integer" }
    },
    additionalProperties: false
  });

  const first = await db.append({
    streamId: "counter-1",
    type: "Incremented",
    schemaVersion: "1",
    data: { delta: 2 }
  });
  assert.equal(first.ok, true);

  const second = await db.append({
    streamId: "counter-1",
    type: "Incremented",
    schemaVersion: "1",
    data: { delta: 3 }
  });
  assert.equal(second.ok, true);

  const events = await db.readEvents("counter-1");
  assert.equal(events.length, 2);
  assert.equal(events[0].sequence, 1);
  assert.equal(events[1].sequence, 2);

  const replayed = await db.replay(
    "counter-1",
    (state: number, event) => state + Number((event.data as { delta: number }).delta),
    0
  );
  assert.equal(replayed, 5);
});

test("invalid payload is quarantined with deterministic reject", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "stooldb-reject-"));
  const db = new StoolDB({ rootDir: root, processId: "pid-test" });
  await db.init();

  db.registerEventSchema("Incremented", "1", {
    type: "object",
    required: ["delta"],
    properties: {
      delta: { type: "integer" }
    },
    additionalProperties: false
  });

  const result = await db.append({
    streamId: "counter-1",
    type: "Incremented",
    schemaVersion: "1",
    data: { delta: "oops" }
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "validation_failed");
});
