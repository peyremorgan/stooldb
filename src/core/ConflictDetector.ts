import type { EventEnvelope, RejectReason } from "./types.js";

export interface ConflictResult {
  accepted: boolean;
  reason?: RejectReason;
  detail?: string;
}

export function detectConflict(
  lastAccepted: EventEnvelope | undefined,
  candidate: EventEnvelope
): ConflictResult {
  if (!lastAccepted) {
    return { accepted: true };
  }

  if (candidate.sequence !== lastAccepted.sequence + 1) {
    return {
      accepted: false,
      reason: "sequence_mismatch",
      detail: `Expected sequence ${lastAccepted.sequence + 1}, got ${candidate.sequence}`
    };
  }

  if (candidate.timestamp < lastAccepted.timestamp) {
    return {
      accepted: false,
      reason: "timestamp_regression",
      detail: `Candidate timestamp ${candidate.timestamp} is older than ${lastAccepted.timestamp}`
    };
  }

  return { accepted: true };
}
