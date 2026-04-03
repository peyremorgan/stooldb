import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { StoolDB } from "../src/index.js";

function incrementedSchema(): unknown {
  return {
    type: "object",
    required: ["delta"],
    properties: {
      delta: { type: "integer" }
    },
    additionalProperties: false
  };
}

async function registerIncremented(db: StoolDB): Promise<void> {
  db.registerEventSchema("Incremented", "1", incrementedSchema());
}

test("concurrent appends from two writers preserve contiguous sequence", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "stooldb-concurrent-"));
  const writerA = new StoolDB({ rootDir: root, processId: "writer-a" });
  const writerB = new StoolDB({ rootDir: root, processId: "writer-b" });

  await Promise.all([writerA.init(), writerB.init()]);
  await Promise.all([registerIncremented(writerA), registerIncremented(writerB)]);

  const writesPerWriter = 8;
  const writeTasks: Array<Promise<{ ok: boolean; reason?: string }>> = [];

  for (let index = 0; index < writesPerWriter; index += 1) {
    writeTasks.push(
      writerA.append({
        streamId: "counter-race",
        type: "Incremented",
        schemaVersion: "1",
        data: { delta: 1 }
      })
    );
    writeTasks.push(
      writerB.append({
        streamId: "counter-race",
        type: "Incremented",
        schemaVersion: "1",
        data: { delta: 1 }
      })
    );
  }

  const results = await Promise.all(writeTasks);
  for (const result of results) {
    assert.equal(result.ok, true);
  }

  const events = await writerA.readEvents("counter-race");
  assert.equal(events.length, writesPerWriter * 2);

  const sequences = events.map((event) => event.sequence);
  assert.deepEqual(
    sequences,
    Array.from({ length: writesPerWriter * 2 }, (_value, index) => index + 1)
  );
});

test("split-brain delayed sync picks deterministic winner for duplicate non-state sequence", async () => {
  const baseRoot = await fs.mkdtemp(path.join(os.tmpdir(), "stooldb-split-brain-"));
  const rootA = path.join(baseRoot, "client-a");
  const rootB = path.join(baseRoot, "client-b");
  const mergedRoot = path.join(baseRoot, "merged");

  await Promise.all([fs.mkdir(rootA, { recursive: true }), fs.mkdir(rootB, { recursive: true })]);

  const clientA = new StoolDB({ rootDir: rootA, processId: "client-a" });
  const clientB = new StoolDB({ rootDir: rootB, processId: "client-b" });

  await Promise.all([clientA.init(), clientB.init()]);
  await Promise.all([registerIncremented(clientA), registerIncremented(clientB)]);

  const appendA = await clientA.append({
    streamId: "counter-1",
    type: "Incremented",
    schemaVersion: "1",
    data: { delta: 2 }
  });
  const appendB = await clientB.append({
    streamId: "counter-1",
    type: "Incremented",
    schemaVersion: "1",
    data: { delta: 9 }
  });

  assert.equal(appendA.ok, true);
  assert.equal(appendB.ok, true);

  const eventsDirA = path.join(rootA, "streams", "counter-1", "events");
  const eventsDirB = path.join(rootB, "streams", "counter-1", "events");
  const mergedEventsDir = path.join(mergedRoot, "streams", "counter-1", "events");
  await fs.mkdir(mergedEventsDir, { recursive: true });

  const [filesA, filesB] = await Promise.all([fs.readdir(eventsDirA), fs.readdir(eventsDirB)]);
  for (const file of [...filesA, ...filesB]) {
    const sourceDir = file.includes("client-a") ? eventsDirA : eventsDirB;
    const source = path.join(sourceDir, file);
    const destination = path.join(mergedEventsDir, file);
    const contents = await fs.readFile(source, "utf-8");
    await fs.writeFile(destination, contents, "utf-8");
  }

  const merged = new StoolDB({ rootDir: mergedRoot, processId: "reader" });
  await merged.init();

  const events = await merged.readEvents("counter-1");
  assert.equal(events.length, 1);
  assert.equal(events[0].processId, "client-a");
  assert.equal((events[0].data as { delta: number }).delta, 2);
});
