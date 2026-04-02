import path from "node:path";

import { SchemaRegistry } from "./core/SchemaRegistry.js";
import { SnapshotManager } from "./core/SnapshotManager.js";
import { StreamReader } from "./core/StreamReader.js";
import { StreamWriter } from "./core/StreamWriter.js";
import type { AppendInput, EventEnvelope, SnapshotRecord } from "./core/types.js";
import { createStorePaths } from "./storage/paths.js";

export interface StoolDBOptions {
	rootDir: string;
	schemaDir?: string;
	processId?: string;
	snapshotThreshold?: number;
}

export class StoolDB {
	private readonly schemaRegistry: SchemaRegistry;
	private readonly reader: StreamReader;
	private readonly writer: StreamWriter;
	private readonly snapshots: SnapshotManager;
	private readonly snapshotThreshold: number;

	public constructor(options: StoolDBOptions) {
		const paths = createStorePaths(options.rootDir);
		const processId = options.processId ?? `pid-${process.pid}`;
		const schemaDir = options.schemaDir ?? path.resolve(process.cwd(), "src/storage/schemas");

		this.schemaRegistry = new SchemaRegistry(schemaDir);
		this.reader = new StreamReader(paths);
		this.writer = new StreamWriter(paths, processId, this.schemaRegistry, this.reader);
		this.snapshots = new SnapshotManager(paths, processId);
		this.snapshotThreshold = options.snapshotThreshold ?? 100;
	}

	public async init(): Promise<void> {
		await this.schemaRegistry.loadCoreSchemas();
	}

	public registerEventSchema(eventType: string, schemaVersion: string, schema: unknown): void {
		this.schemaRegistry.registerEventSchema(eventType, schemaVersion, schema);
	}

	public async append(input: AppendInput): Promise<{ ok: boolean; reason?: string; detail?: string }> {
		const result = await this.writer.append(input);

		if (result.ok && result.envelope.sequence % this.snapshotThreshold === 0) {
			// Snapshot creation is explicit in v1 to avoid writing state without a reducer.
		}

		if (result.ok) {
			return { ok: true };
		}

		return {
			ok: false,
			reason: result.reason,
			detail: result.detail
		};
	}

	public async readEvents(streamId: string): Promise<EventEnvelope[]> {
		return this.reader.readEvents(streamId);
	}

	public async replay<TState>(
		streamId: string,
		reducer: (state: TState, event: EventEnvelope) => TState,
		initialState: TState
	): Promise<TState> {
		let state = initialState;
		let fromSequence = 0;

		const snapshot = await this.reader.loadLatestSnapshot<TState>(streamId);
		if (snapshot && this.snapshots.verifySnapshot(snapshot)) {
			state = snapshot.state;
			fromSequence = snapshot.snapshotSequence;
		}

		const tail = await this.reader.readEventsAfter(streamId, fromSequence);
		for (const event of tail) {
			state = reducer(state, event);
		}

		return state;
	}

	public async createSnapshotFromReplay<TState>(
		streamId: string,
		reducer: (state: TState, event: EventEnvelope) => TState,
		initialState: TState
	): Promise<SnapshotRecord<TState> | undefined> {
		const events = await this.reader.readEvents(streamId);
		if (events.length === 0) {
			return undefined;
		}

		let state = initialState;
		for (const event of events) {
			state = reducer(state, event);
		}

		const snapshotSequence = events[events.length - 1].sequence;
		return this.snapshots.createSnapshot(streamId, snapshotSequence, state);
	}
}

export const version = "0.1.0";
