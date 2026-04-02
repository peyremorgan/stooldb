import path from "node:path";

export interface StorePaths {
  rootDir: string;
  streamsDir: string;
}

export function createStorePaths(rootDir: string): StorePaths {
  return {
    rootDir,
    streamsDir: path.join(rootDir, "streams")
  };
}

export function streamDir(paths: StorePaths, streamId: string): string {
  return path.join(paths.streamsDir, sanitizeStreamId(streamId));
}

export function eventsDir(paths: StorePaths, streamId: string): string {
  return path.join(streamDir(paths, streamId), "events");
}

export function snapshotsDir(paths: StorePaths, streamId: string): string {
  return path.join(streamDir(paths, streamId), "snapshots");
}

export function quarantineDir(paths: StorePaths, streamId: string): string {
  return path.join(streamDir(paths, streamId), "quarantine");
}

export function auditLogPath(paths: StorePaths, streamId: string): string {
  return path.join(quarantineDir(paths, streamId), "audit.log.jsonl");
}

export function lockFilePath(paths: StorePaths, streamId: string): string {
  return path.join(streamDir(paths, streamId), ".lock");
}

export function eventFilePath(paths: StorePaths, streamId: string, sequence: number): string {
  return path.join(eventsDir(paths, streamId), `${padSequence(sequence)}.json`);
}

export function snapshotFilePath(paths: StorePaths, streamId: string, sequence: number): string {
  return path.join(snapshotsDir(paths, streamId), `snapshot-seq-${padSequence(sequence)}.json`);
}

export function rejectedFilePath(
  paths: StorePaths,
  streamId: string,
  sequence: number,
  reason: string
): string {
  return path.join(quarantineDir(paths, streamId), `rejected-seq-${padSequence(sequence)}-${reason}.json`);
}

export function padSequence(sequence: number): string {
  return sequence.toString().padStart(10, "0");
}

function sanitizeStreamId(streamId: string): string {
  return streamId.replace(/[\\/:*?"<>|]/g, "_");
}
