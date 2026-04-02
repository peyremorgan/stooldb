import path from "node:path";

import type { EventEnvelope, SnapshotRecord } from "./types.js";
import { listJsonFilesSorted, readJsonFile } from "./fs.js";
import type { StorePaths } from "../storage/paths.js";
import { eventsDir, snapshotsDir } from "../storage/paths.js";

interface EventFileCandidate {
  fileName: string;
  envelope: EventEnvelope;
}

export class StreamReader {
  public constructor(private readonly paths: StorePaths) {}

  public async readEvents(streamId: string): Promise<EventEnvelope[]> {
    const eventDirectory = eventsDir(this.paths, streamId);
    const files = await listJsonFilesSorted(eventDirectory).catch(() => [] as string[]);

    const bySequence = new Map<number, EventFileCandidate>();
    for (const file of files) {
      const absolute = path.join(eventDirectory, file);
      const envelope = await readJsonFile<EventEnvelope>(absolute);
      const next: EventFileCandidate = { fileName: file, envelope };
      const existing = bySequence.get(envelope.sequence);
      if (!existing || compareEventCandidates(next, existing) < 0) {
        bySequence.set(envelope.sequence, next);
      }
    }

    return [...bySequence.values()]
      .sort((left, right) => left.envelope.sequence - right.envelope.sequence)
      .map((candidate) => candidate.envelope);
  }

  public async readEventsAfter(streamId: string, afterSequence: number): Promise<EventEnvelope[]> {
    const events = await this.readEvents(streamId);
    return events.filter((event) => event.sequence > afterSequence);
  }

  public async readLastEvent(streamId: string): Promise<EventEnvelope | undefined> {
    const events = await this.readEvents(streamId);
    return events.at(-1);
  }

  public async getLastSequence(streamId: string): Promise<number> {
    const last = await this.readLastEvent(streamId);
    return last?.sequence ?? 0;
  }

  public async loadLatestSnapshot<TState>(streamId: string): Promise<SnapshotRecord<TState> | undefined> {
    const directory = snapshotsDir(this.paths, streamId);
    const files = await listJsonFilesSorted(directory).catch(() => [] as string[]);
    const latest = files.at(-1);
    if (!latest) {
      return undefined;
    }

    return readJsonFile<SnapshotRecord<TState>>(path.join(directory, latest));
  }
}

function compareEventCandidates(left: EventFileCandidate, right: EventFileCandidate): number {
  const timestampOrder = left.envelope.timestamp.localeCompare(right.envelope.timestamp);
  if (timestampOrder !== 0) {
    return timestampOrder;
  }

  const processOrder = left.envelope.processId.localeCompare(right.envelope.processId);
  if (processOrder !== 0) {
    return processOrder;
  }

  return left.fileName.localeCompare(right.fileName);
}
