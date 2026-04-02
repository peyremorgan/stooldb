import path from "node:path";

import type { EventEnvelope, SnapshotRecord } from "./types.js";
import { listJsonFilesSorted, readJsonFile } from "./fs.js";
import type { StorePaths } from "../storage/paths.js";
import { eventsDir, snapshotsDir } from "../storage/paths.js";
import { mutationCompatibility } from "../state/compatibility.js";
import type { StateMutation } from "../state/operations.js";

interface EventFileCandidate {
  fileName: string;
  envelope: EventEnvelope;
}

export class StreamReader {
  public constructor(private readonly paths: StorePaths) {}

  public async readEvents(streamId: string): Promise<EventEnvelope[]> {
    const eventDirectory = eventsDir(this.paths, streamId);
    const files = await listJsonFilesSorted(eventDirectory).catch(() => [] as string[]);

    const bySequence = new Map<number, EventFileCandidate[]>();
    for (const file of files) {
      const absolute = path.join(eventDirectory, file);
      const envelope = await readJsonFile<EventEnvelope>(absolute);
      const next: EventFileCandidate = { fileName: file, envelope };
      const existing = bySequence.get(envelope.sequence);
      if (!existing) {
        bySequence.set(envelope.sequence, [next]);
      } else {
        existing.push(next);
      }
    }

    const resolved: EventEnvelope[] = [];
    const sortedSequences = [...bySequence.keys()].sort((left, right) => left - right);

    for (const sequence of sortedSequences) {
      const candidates = bySequence.get(sequence) ?? [];
      const accepted = resolveSequenceCandidates(candidates);
      resolved.push(...accepted.map((candidate) => candidate.envelope));
    }

    return resolved;
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
  const processOrder = left.envelope.processId.localeCompare(right.envelope.processId);
  if (processOrder !== 0) {
    return processOrder;
  }

  const writerSequenceOrder = (left.envelope.writerLocalSequence ?? Number.MAX_SAFE_INTEGER)
    - (right.envelope.writerLocalSequence ?? Number.MAX_SAFE_INTEGER);
  if (writerSequenceOrder !== 0) {
    return writerSequenceOrder;
  }

  const eventIdOrder = (left.envelope.eventId ?? "~").localeCompare(right.envelope.eventId ?? "~");
  if (eventIdOrder !== 0) {
    return eventIdOrder;
  }

  const fileOrder = left.fileName.localeCompare(right.fileName);
  if (fileOrder !== 0) {
    return fileOrder;
  }

  return left.envelope.timestamp.localeCompare(right.envelope.timestamp);
}

function resolveSequenceCandidates(candidates: EventFileCandidate[]): EventFileCandidate[] {
  if (candidates.length <= 1) {
    return candidates;
  }

  const sorted = [...candidates].sort(compareEventCandidates);
  const accepted: EventFileCandidate[] = [];

  for (const candidate of sorted) {
    if (accepted.length === 0 || isCompatibleWithAccepted(candidate, accepted)) {
      accepted.push(candidate);
    }
  }

  return accepted;
}

function isCompatibleWithAccepted(candidate: EventFileCandidate, accepted: EventFileCandidate[]): boolean {
  const candidateMutation = toStateMutation(candidate.envelope);
  if (!candidateMutation) {
    return false;
  }

  for (const existing of accepted) {
    const existingMutation = toStateMutation(existing.envelope);
    if (!existingMutation) {
      return false;
    }

    if (mutationCompatibility(existingMutation, candidateMutation) !== "merge") {
      return false;
    }
  }

  return true;
}

function toStateMutation(envelope: EventEnvelope): StateMutation | undefined {
  if (envelope.type !== "StateMutation" || envelope.schemaVersion !== "1") {
    return undefined;
  }

  const data = envelope.data as { kind?: unknown; path?: unknown } | null;
  if (!data || typeof data !== "object") {
    return undefined;
  }

  if (typeof data.kind !== "string") {
    return undefined;
  }

  if (!Array.isArray(data.path) || !data.path.every((segment) => typeof segment === "string")) {
    return undefined;
  }

  return envelope.data as StateMutation;
}
