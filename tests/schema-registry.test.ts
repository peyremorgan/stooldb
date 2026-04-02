import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

import { SchemaRegistry } from "../src/core/SchemaRegistry.js";
import type { EventEnvelope } from "../src/core/types.js";

test("schema registry validates envelope and payload", async () => {
  const schemaDir = path.resolve(process.cwd(), "src/storage/schemas");
  const registry = new SchemaRegistry(schemaDir);
  await registry.loadCoreSchemas();

  registry.registerEventSchema("AccountCreated", "1", {
    type: "object",
    required: ["accountId"],
    properties: {
      accountId: { type: "string", minLength: 1 }
    },
    additionalProperties: false
  });

  const event: EventEnvelope<{ accountId: string }> = {
    version: "1",
    streamId: "account-1",
    sequence: 1,
    timestamp: new Date().toISOString(),
    processId: "pid-test",
    type: "AccountCreated",
    schemaVersion: "1",
    data: {
      accountId: "a-1"
    }
  };

  const result = registry.validateEventEnvelope(event);
  assert.equal(result.valid, true);
});

test("schema registry rejects unknown event schema", async () => {
  const schemaDir = path.resolve(process.cwd(), "src/storage/schemas");
  const registry = new SchemaRegistry(schemaDir);
  await registry.loadCoreSchemas();

  const event: EventEnvelope = {
    version: "1",
    streamId: "account-1",
    sequence: 1,
    timestamp: new Date().toISOString(),
    processId: "pid-test",
    type: "UnknownEvent",
    schemaVersion: "1",
    data: {}
  };

  const result = registry.validateEventEnvelope(event);
  assert.equal(result.valid, false);
  if (result.valid) {
    throw new Error("Expected invalid result");
  }

  assert.match(result.errors, /Schema not found/);
});
