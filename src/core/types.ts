export type EventStoreVersion = "1";

export interface EventEnvelope<TData = unknown> {
  version: EventStoreVersion;
  streamId: string;
  sequence: number;
  timestamp: string;
  processId: string;
  type: string;
  schemaVersion: string;
  data: TData;
  metadata?: Record<string, unknown>;
}

export type RejectReason =
  | "sequence_mismatch"
  | "timestamp_regression"
  | "schema_not_found"
  | "validation_failed"
  | "duplicate_event";

export interface RejectedEventRecord {
  rejectedAt: string;
  rejectedBy: string;
  reason: RejectReason;
  detail: string;
  attemptedSequence?: number;
  acceptedSequence?: number;
  envelope: EventEnvelope;
}

export interface ConflictAuditRecord {
  timestamp: string;
  streamId: string;
  reason: RejectReason;
  detail: string;
  attemptedSequence?: number;
  acceptedSequence?: number;
}

export interface SnapshotRecord<TState = unknown> {
  version: EventStoreVersion;
  streamId: string;
  snapshotSequence: number;
  createdAt: string;
  createdBy: string;
  eventRange: {
    fromSequence: number;
    toSequence: number;
  };
  checksum: string;
  state: TState;
}

export interface AppendInput<TData = unknown> {
  streamId: string;
  type: string;
  schemaVersion: string;
  data: TData;
  metadata?: Record<string, unknown>;
}
