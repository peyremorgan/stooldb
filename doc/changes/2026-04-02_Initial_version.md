# Initial version
Date: 2026-04-02
Scope: Initial implementation of StoolDB core (offline-first file-based event store)

## Summary of changes
- Bootstrapped the TypeScript project (build/test tooling, package setup, ignore rules).
- Implemented core event contracts and schema validation plumbing (event envelope + snapshot schema validation).
- Implemented deterministic storage layout and path helpers for per-stream files.
- Added file-based locking for concurrent writers at the stream level.
- Implemented append pipeline with validation, conflict checks, atomic write, quarantine on reject, and audit trail updates.
- Implemented read/replay pipeline and snapshot creation/loading helpers.
- Added baseline tests covering schema validation, locking behavior, path helpers, append/replay, and snapshot flows.
- Documented architecture and usage in README.

## Lessons learned
- Cleaning build output before compile/test is important to avoid stale artifacts causing false failures.
- Keeping one event per file aligns well with cloud-folder sync constraints and reduces conflict blast radius.
- Validation and conflict handling must be deterministic to keep all clients convergent under delayed sync.
- Quarantine + audit is better than silent drops: it preserves debuggability and salvage options.
- Small commits with build+test gates made refactors safer and easier to reason about.

## Notes for the future
- Add stronger multi-process contention tests (stress-level) and stale-lock recovery policy.
- Introduce richer conflict taxonomy and observability metrics around reject reasons.
- Extend schema evolution support and compatibility checks across event versions.
- Add optional background reconciliation tools for quarantine review/reprocessing.
- Improve failure-injection tests around temp-write/rename crash windows.
