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
  assert.equal(typeof events[0].eventId, "string");
  assert.equal(typeof events[1].eventId, "string");
  assert.equal(events[0].writerLocalSequence, 1);
  assert.equal(events[1].writerLocalSequence, 2);

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

test("append accepts delayed timestamps", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "stooldb-delayed-ts-"));
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
    timestamp: "2026-04-02T12:00:00.000Z",
    data: { delta: 1 }
  });
  assert.equal(first.ok, true);

  const delayed = await db.append({
    streamId: "counter-1",
    type: "Incremented",
    schemaVersion: "1",
    timestamp: "2026-04-01T12:00:00.000Z",
    data: { delta: 4 }
  });
  assert.equal(delayed.ok, true);
});

test("read path merges compatible duplicate sequence events", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "stooldb-duplicate-seq-"));
  const db = new StoolDB({ rootDir: root, processId: "pid-test" });
  await db.init();

  const eventsPath = path.join(root, "streams", "counter-1", "events");
  await fs.mkdir(eventsPath, { recursive: true });

  const first = {
    version: "1",
    streamId: "counter-1",
    sequence: 1,
    timestamp: "2026-04-02T10:00:01.000Z",
    processId: "client-a",
    type: "StateMutation",
    schemaVersion: "1",
    data: { kind: "number.increment", path: ["count"], by: 2 }
  };

  const second = {
    version: "1",
    streamId: "counter-1",
    sequence: 1,
    timestamp: "2026-04-02T10:00:00.000Z",
    processId: "client-b",
    type: "StateMutation",
    schemaVersion: "1",
    data: { kind: "number.increment", path: ["count"], by: 9 }
  };

  await fs.writeFile(
    path.join(eventsPath, "0000000001--client-b--nonce-2.json"),
    JSON.stringify(second),
    "utf-8"
  );
  await fs.writeFile(
    path.join(eventsPath, "0000000001--client-a--nonce-1.json"),
    JSON.stringify(first),
    "utf-8"
  );

  const events = await db.readEvents("counter-1");
  assert.equal(events.length, 2);
  assert.equal(events[0].processId, "client-a");
  assert.equal(events[1].processId, "client-b");

  const replayed = await db.replay(
    "counter-1",
    (state: number, event) => state + Number((event.data as { by: number }).by),
    0
  );
  assert.equal(replayed, 11);
});

test("read path keeps deterministic winner for incompatible duplicate sequence events", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "stooldb-duplicate-incompatible-"));
  const db = new StoolDB({ rootDir: root, processId: "pid-test" });
  await db.init();

  const eventsPath = path.join(root, "streams", "counter-1", "events");
  await fs.mkdir(eventsPath, { recursive: true });

  const first = {
    version: "1",
    streamId: "counter-1",
    sequence: 1,
    timestamp: "2026-04-02T10:00:01.000Z",
    processId: "client-a",
    type: "StateMutation",
    schemaVersion: "1",
    data: { kind: "number.set", path: ["count"], value: 2 }
  };

  const second = {
    version: "1",
    streamId: "counter-1",
    sequence: 1,
    timestamp: "2026-04-02T08:00:00.000Z",
    processId: "client-b",
    type: "StateMutation",
    schemaVersion: "1",
    data: { kind: "number.set", path: ["count"], value: 9 }
  };

  await fs.writeFile(
    path.join(eventsPath, "0000000001--client-b--nonce-2.json"),
    JSON.stringify(second),
    "utf-8"
  );
  await fs.writeFile(
    path.join(eventsPath, "0000000001--client-a--nonce-1.json"),
    JSON.stringify(first),
    "utf-8"
  );

  const events = await db.readEvents("counter-1");
  assert.equal(events.length, 1);
  assert.equal(events[0].processId, "client-a");
  assert.equal((events[0].data as { value: number }).value, 2);
});
