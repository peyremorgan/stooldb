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
- High-level schema-driven state store API with reactive state stream.
- Primitive field transitions with predefined accumulators.
- Collection field transitions including declarative `updateWhere`.

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

## High-Level State API

Define a state schema once, then apply typed, constrained transitions.

```ts
import { StoolDB } from "./src/index.js";
import { defineStateSchema } from "./src/state/schema.js";

const db = new StoolDB({ rootDir: "./data" });
await db.init();

const schema = defineStateSchema({
	type: "object",
	fields: {
		counter: { type: "number" },
		label: { type: "string" },
		enabled: { type: "boolean" },
		users: {
			type: "array",
			items: {
				type: "object",
				fields: {
					id: { type: "number" },
					active: { type: "boolean" }
				}
			}
		}
	}
});

const store = db.createStateStore({
	streamId: "app-state",
	schema,
	initialState: {
		counter: 0,
		label: "",
		enabled: false,
		users: []
	}
});

await store.init();

await store.apply({ kind: "number.increment", path: ["counter"], by: 1 });
await store.apply({ kind: "string.append", path: ["label"], value: "ok" });
await store.apply({ kind: "boolean.toggle", path: ["enabled"] });
await store.apply({ kind: "array.push", path: ["users"], value: { id: 1, active: false } });
await store.apply({
	kind: "array.updateWhere",
	path: ["users"],
	where: { fieldPath: ["id"], op: "eq", value: 1 },
	mutate: { fieldPath: ["active"], action: "toggle" }
});

const snapshot = store.getState();
```

Supported primitive transitions:

- number: `increment`, `decrement`, `set`
- string: `append`, `set`
- boolean: `toggle`, `set`

Supported collection transitions:

- `push`, `pop`, `shift`
- `updateWhere` using declarative predicate and mutation specs

State observability:

- `store.state$` exposes reactive state updates via RxJS.
- `store.mutations$` exposes applied mutation events.

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