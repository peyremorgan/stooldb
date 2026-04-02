import test from "node:test";
import assert from "node:assert/strict";

import {
  createStorePaths,
  eventFilePath,
  eventFilePathWithWriter,
  lockFilePath,
  padSequence,
  rejectedFilePathWithWriter
} from "../src/storage/paths.js";

test("padSequence creates lexicographic sequence", () => {
  assert.equal(padSequence(42), "0000000042");
});

test("path helpers resolve event and lock files", () => {
  const paths = createStorePaths("data");
  assert.equal(eventFilePath(paths, "order:1", 7), "data\\streams\\order_1\\events\\0000000007.json");
  assert.equal(lockFilePath(paths, "order:1"), "data\\streams\\order_1\\.lock");
});

test("writer-aware paths include unique suffixes", () => {
  const paths = createStorePaths("data");

  assert.equal(
    eventFilePathWithWriter(paths, "order:1", 7, "client/a", "nonce-1"),
    "data\\streams\\order_1\\events\\0000000007--client_a--nonce-1.json"
  );

  assert.equal(
    rejectedFilePathWithWriter(paths, "order:1", 7, "validation_failed", "client/a", "nonce-1"),
    "data\\streams\\order_1\\quarantine\\rejected-seq-0000000007-validation_failed-client_a-nonce-1.json"
  );
});
