import { createHash } from "node:crypto";

import type { SnapshotRecord } from "./types.js";
import { writeJsonAtomic } from "./fs.js";
import type { StorePaths } from "../storage/paths.js";
import { snapshotFilePath } from "../storage/paths.js";

export class SnapshotManager {
  public constructor(private readonly paths: StorePaths, private readonly processId: string) {}

  public async createSnapshot<TState>(
    streamId: string,
    snapshotSequence: number,
    state: TState
  ): Promise<SnapshotRecord<TState>> {
    const snapshot: SnapshotRecord<TState> = {
      version: "1",
      streamId,
      snapshotSequence,
      createdAt: new Date().toISOString(),
      createdBy: this.processId,
      eventRange: {
        fromSequence: 1,
        toSequence: snapshotSequence
      },
      checksum: computeChecksum(state),
      state
    };

    await writeJsonAtomic(snapshotFilePath(this.paths, streamId, snapshotSequence), snapshot);
    return snapshot;
  }

  public verifySnapshot(snapshot: SnapshotRecord): boolean {
    return snapshot.checksum === computeChecksum(snapshot.state);
  }
}

function computeChecksum(value: unknown): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify(value));
  return `sha256:${hash.digest("hex")}`;
}
