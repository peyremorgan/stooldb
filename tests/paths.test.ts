import test from "node:test";
import assert from "node:assert/strict";

import { createStorePaths, eventFilePath, lockFilePath, padSequence } from "../src/storage/paths.js";

test("padSequence creates lexicographic sequence", () => {
  assert.equal(padSequence(42), "0000000042");
});

test("path helpers resolve event and lock files", () => {
  const paths = createStorePaths("data");
  assert.equal(eventFilePath(paths, "order:1", 7), "data\\streams\\order_1\\events\\0000000007.json");
  assert.equal(lockFilePath(paths, "order:1"), "data\\streams\\order_1\\.lock");
});
