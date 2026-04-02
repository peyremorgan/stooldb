import { BehaviorSubject, Observable, Subject } from "rxjs";

import type { AppendInput, EventEnvelope } from "../core/types.js";
import type { InferState, StateSchema } from "./schema.js";
import { validateStateSchema } from "./validation.js";
import type { StateMutation } from "./operations.js";
import { applyStateMutation } from "./reducer.js";
import { generateStateMutationPayloadSchema } from "./payloadSchema.js";

export interface StateStoreBackend {
  append(input: AppendInput): Promise<{ ok: boolean; reason?: string; detail?: string }>;
  readEvents(streamId: string): Promise<EventEnvelope[]>;
  registerEventSchema(eventType: string, schemaVersion: string, schema: unknown): void;
}

export interface CreateStateStoreOptions<TSchema extends StateSchema> {
  streamId: string;
  schema: TSchema;
  initialState: InferState<TSchema>;
}

export class ReactiveStateStore<TSchema extends StateSchema> {
  public readonly state$: Observable<InferState<TSchema>>;
  public readonly mutations$: Observable<StateMutation>;

  private readonly stateSubject: BehaviorSubject<InferState<TSchema>>;
  private readonly mutationSubject = new Subject<StateMutation>();

  public constructor(
    private readonly backend: StateStoreBackend,
    private readonly options: CreateStateStoreOptions<TSchema>
  ) {
    validateStateSchema(options.schema);

    const payloadSchema = generateStateMutationPayloadSchema(options.schema);
    this.backend.registerEventSchema("StateMutation", "1", payloadSchema);

    this.stateSubject = new BehaviorSubject<InferState<TSchema>>(options.initialState);
    this.state$ = this.stateSubject.asObservable();
    this.mutations$ = this.mutationSubject.asObservable();
  }

  public async init(): Promise<void> {
    const events = await this.backend.readEvents(this.options.streamId);

    let currentState = this.options.initialState;
    for (const event of events) {
      if (event.type !== "StateMutation" || event.schemaVersion !== "1") {
        continue;
      }

      currentState = applyStateMutation(currentState, event.data as StateMutation);
    }

    this.stateSubject.next(currentState);
  }

  public getState(): InferState<TSchema> {
    return this.stateSubject.getValue();
  }

  public async apply(mutation: StateMutation): Promise<{ ok: true } | { ok: false; reason: string; detail?: string }> {
    const result = await this.backend.append({
      streamId: this.options.streamId,
      type: "StateMutation",
      schemaVersion: "1",
      data: mutation
    });

    if (!result.ok) {
      return {
        ok: false,
        reason: result.reason ?? "unknown",
        detail: result.detail
      };
    }

    const nextState = applyStateMutation(this.stateSubject.getValue(), mutation);
    this.stateSubject.next(nextState);
    this.mutationSubject.next(mutation);
    return { ok: true };
  }
}
