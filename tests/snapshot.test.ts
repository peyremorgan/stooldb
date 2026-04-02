import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { StoolDB } from "../src/index.js";

test("snapshot can be created and replay still matches", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "stooldb-snapshot-"));
  const db = new StoolDB({ rootDir: root, processId: "pid-test", snapshotThreshold: 2 });
  await db.init();

  db.registerEventSchema("Incremented", "1", {
    type: "object",
    required: ["delta"],
    properties: {
      delta: { type: "integer" }
    },
    additionalProperties: false
  });

  await db.append({ streamId: "counter-1", type: "Incremented", schemaVersion: "1", data: { delta: 1 } });
  await db.append({ streamId: "counter-1", type: "Incremented", schemaVersion: "1", data: { delta: 4 } });

  const snapshot = await db.createSnapshotFromReplay(
    "counter-1",
    (state: number, event) => state + Number((event.data as { delta: number }).delta),
    0
  );

  assert.ok(snapshot);
  assert.equal(snapshot?.snapshotSequence, 2);

  const replayed = await db.replay(
    "counter-1",
    (state: number, event) => state + Number((event.data as { delta: number }).delta),
    0
  );
  assert.equal(replayed, 5);
});
