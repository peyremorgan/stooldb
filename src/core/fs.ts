import fs from "node:fs/promises";
import path from "node:path";

import type { StorePaths } from "../storage/paths.js";
import { auditLogPath, eventsDir, quarantineDir, snapshotsDir, streamDir } from "../storage/paths.js";

export async function ensureStoreDirectories(paths: StorePaths, streamId: string): Promise<void> {
  const streamRoot = streamDir(paths, streamId);
  await fs.mkdir(streamRoot, { recursive: true });
  await fs.mkdir(eventsDir(paths, streamId), { recursive: true });
  await fs.mkdir(snapshotsDir(paths, streamId), { recursive: true });
  await fs.mkdir(quarantineDir(paths, streamId), { recursive: true });

  const auditPath = auditLogPath(paths, streamId);
  await fs.mkdir(path.dirname(auditPath), { recursive: true });
  await fs.appendFile(auditPath, "");
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

export async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const tmpPath = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tmpPath, JSON.stringify(value), "utf-8");
  await fs.rename(tmpPath, filePath);
}

export async function appendJsonLine(filePath: string, value: unknown): Promise<void> {
  await fs.appendFile(filePath, `${JSON.stringify(value)}\n`, "utf-8");
}

export async function listJsonFilesSorted(directory: string): Promise<string[]> {
  const dirEntries = await fs.readdir(directory, { withFileTypes: true });
  return dirEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}
