# StoolDB
_Offline-first like CouchDB, but shittier_

## What It Is

StoolDB is a file-based, offline-first, event-sourced persistence layer intended for desktop apps that store data in a local folder synchronized by cloud drive clients (Google Drive, Box Drive, OneDrive, etc.).

The design goal is conflict minimization and graceful salvage:

- Persist locally first.
- Write one event per file to reduce sync conflict blast radius.
- Reject incompatible writes deterministically.
- Quarantine rejected writes with an audit trail.
- Reconstruct state from event history or snapshot + tail events.

## Current v1 Implementation

Implemented:

- TypeScript + Node.js runtime.
- Event envelope and snapshot contracts.
- JSON Schema validation with versioned event type registration.
- Per-stream lock files for multi-process writes.
- Atomic file writes (temp file + rename).
- Stream append/read/replay.
- Deterministic conflict rejection + quarantine artifacts.
- Snapshot create/load during replay.

Not yet implemented:

- Filesystem watcher for cloud sync ingestion.
- Advanced query/index projections beyond reducer replay.
- Automated stale lock reclamation policy.

## On-Disk Layout

For a stream id like `counter-1`:

```text
<root>/
	streams/
		counter-1/
			.lock
			events/
				0000000001.json
				0000000002.json
			snapshots/
				snapshot-seq-0000000002.json
			quarantine/
				rejected-seq-0000000001-validation_failed.json
				audit.log.jsonl
```

## Quick Start

```ts
import { StoolDB } from "./src/index.js";

const db = new StoolDB({ rootDir: "./data" });
await db.init();

db.registerEventSchema("Incremented", "1", {
	type: "object",
	required: ["delta"],
	properties: {
		delta: { type: "integer" }
	},
	additionalProperties: false
});

await db.append({
	streamId: "counter-1",
	type: "Incremented",
	schemaVersion: "1",
	data: { delta: 2 }
});

const value = await db.replay(
	"counter-1",
	(state, event) => state + Number((event.data as { delta: number }).delta),
	0
);
```

## Build And Test

```bash
npm install
npm run build
npm test
```

## Notes On Conflict Handling

- Sequence order is authoritative per stream.
- Payloads are validated against registered JSON Schema by `type@schemaVersion`.
- Validation/schema failures are rejected and moved to quarantine.
- Rejections are appended to `audit.log.jsonl` for diagnostics.

This keeps accepted history clean while preserving rejected events for manual recovery.