import { appendJsonLine, ensureStoreDirectories, writeJsonAtomic } from "./fs.js";
import { detectConflict } from "./ConflictDetector.js";
import type {
  AppendInput,
  ConflictAuditRecord,
  EventEnvelope,
  RejectReason,
  RejectedEventRecord
} from "./types.js";
import { SchemaRegistry } from "./SchemaRegistry.js";
import { StreamReader } from "./StreamReader.js";
import { FileLock } from "../locking/FileLock.js";
import type { StorePaths } from "../storage/paths.js";
import {
  auditLogPath,
  eventFilePath,
  lockFilePath,
  rejectedFilePath
} from "../storage/paths.js";

export interface AppendResult {
  ok: true;
  envelope: EventEnvelope;
}

export interface AppendErrorResult {
  ok: false;
  reason: RejectReason;
  detail: string;
}

export class StreamWriter {
  public constructor(
    private readonly paths: StorePaths,
    private readonly processId: string,
    private readonly schemaRegistry: SchemaRegistry,
    private readonly reader: StreamReader
  ) {}

  public async append(input: AppendInput): Promise<AppendResult | AppendErrorResult> {
    await ensureStoreDirectories(this.paths, input.streamId);

    const lock = new FileLock(lockFilePath(this.paths, input.streamId));
    const acquired = await lock.acquire();
    if (!acquired) {
      return { ok: false, reason: "sequence_mismatch", detail: "Failed to acquire lock" };
    }

    try {
      const lastAccepted = await this.reader.readLastEvent(input.streamId);
      const nextSequence = (lastAccepted?.sequence ?? 0) + 1;
      const envelope: EventEnvelope = {
        version: "1",
        streamId: input.streamId,
        sequence: nextSequence,
        timestamp: input.timestamp ?? new Date().toISOString(),
        processId: this.processId,
        type: input.type,
        schemaVersion: input.schemaVersion,
        data: input.data,
        metadata: input.metadata
      };

      const schemaValidation = this.schemaRegistry.validateEventEnvelope(envelope);
      if (!schemaValidation.valid) {
        const reason: RejectReason = schemaValidation.errors.includes("Schema not found")
          ? "schema_not_found"
          : "validation_failed";
        await this.writeReject(input.streamId, envelope, reason, schemaValidation.errors, lastAccepted?.sequence);
        return { ok: false, reason, detail: schemaValidation.errors };
      }

      const conflict = detectConflict(lastAccepted, envelope);
      if (!conflict.accepted) {
        const reason = conflict.reason ?? "sequence_mismatch";
        const detail = conflict.detail ?? "Conflict detected";
        await this.writeReject(input.streamId, envelope, reason, detail, lastAccepted?.sequence);
        return { ok: false, reason, detail };
      }

      await writeJsonAtomic(eventFilePath(this.paths, input.streamId, nextSequence), envelope);
      return { ok: true, envelope };
    } finally {
      await lock.release();
    }
  }

  private async writeReject(
    streamId: string,
    envelope: EventEnvelope,
    reason: RejectReason,
    detail: string,
    acceptedSequence: number | undefined
  ): Promise<void> {
    const rejectedAt = new Date().toISOString();
    const rejected: RejectedEventRecord = {
      rejectedAt,
      rejectedBy: this.processId,
      reason,
      detail,
      attemptedSequence: envelope.sequence,
      acceptedSequence,
      envelope
    };

    const audit: ConflictAuditRecord = {
      timestamp: rejectedAt,
      streamId,
      reason,
      detail,
      attemptedSequence: envelope.sequence,
      acceptedSequence
    };

    await writeJsonAtomic(rejectedFilePath(this.paths, streamId, envelope.sequence, reason), rejected);
    await appendJsonLine(auditLogPath(this.paths, streamId), audit);
  }
}
