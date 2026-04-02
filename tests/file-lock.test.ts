import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { FileLock } from "../src/locking/FileLock.js";

test("file lock acquires and releases", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "stooldb-lock-"));
  const lockPath = path.join(root, ".lock");

  const lock = new FileLock(lockPath);
  const acquired = await lock.acquire({ timeoutMs: 300, retryDelayMs: 10 });
  assert.equal(acquired, true);

  const second = new FileLock(lockPath);
  const secondAcquired = await second.acquire({ timeoutMs: 100, retryDelayMs: 10 });
  assert.equal(secondAcquired, false);

  await lock.release();

  const third = new FileLock(lockPath);
  const thirdAcquired = await third.acquire({ timeoutMs: 100, retryDelayMs: 10 });
  assert.equal(thirdAcquired, true);
  await third.release();
});
