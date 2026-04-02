import fs from "node:fs/promises";

import type { ValidateFunction } from "ajv";
import AjvModule from "ajv";

import type { EventEnvelope, SnapshotRecord } from "./types.js";

export class SchemaRegistry {
  private readonly ajv: {
    compile: (schema: unknown) => ValidateFunction;
    errorsText: (errors: unknown) => string;
  };
  private readonly eventValidators = new Map<string, ValidateFunction>();
  private snapshotValidator?: ValidateFunction;

  public constructor(private readonly schemaDirectory: string) {
    const AjvCtor = AjvModule as unknown as new (options: Record<string, unknown>) => {
      compile: (schema: unknown) => ValidateFunction;
      errorsText: (errors: unknown) => string;
    };
    this.ajv = new AjvCtor({ allErrors: true, strict: false });
  }

  public async loadCoreSchemas(): Promise<void> {
    const envelopeSchema = await this.loadSchemaFile("event-envelope.v1.schema.json");
    this.eventValidators.set("__envelope__", this.ajv.compile(envelopeSchema));

    const snapshotSchema = await this.loadSchemaFile("snapshot.v1.schema.json");
    this.snapshotValidator = this.ajv.compile(snapshotSchema);
  }

  public registerEventSchema(eventType: string, schemaVersion: string, schema: unknown): void {
    const key = this.getEventSchemaKey(eventType, schemaVersion);
    this.eventValidators.set(key, this.ajv.compile(schema));
  }

  public validateEventEnvelope(envelope: EventEnvelope): { valid: true } | { valid: false; errors: string } {
    const envelopeValidator = this.eventValidators.get("__envelope__");
    if (!envelopeValidator) {
      throw new Error("Core envelope schema has not been loaded.");
    }

    if (!envelopeValidator(envelope)) {
      return { valid: false, errors: this.ajv.errorsText(envelopeValidator.errors) };
    }

    const eventSchemaKey = this.getEventSchemaKey(envelope.type, envelope.schemaVersion);
    const eventValidator = this.eventValidators.get(eventSchemaKey);
    if (!eventValidator) {
      return { valid: false, errors: `Schema not found for ${eventSchemaKey}` };
    }

    if (!eventValidator(envelope.data)) {
      return { valid: false, errors: this.ajv.errorsText(eventValidator.errors) };
    }

    return { valid: true };
  }

  public validateSnapshot(snapshot: SnapshotRecord): { valid: true } | { valid: false; errors: string } {
    if (!this.snapshotValidator) {
      throw new Error("Core snapshot schema has not been loaded.");
    }

    if (!this.snapshotValidator(snapshot)) {
      return { valid: false, errors: this.ajv.errorsText(this.snapshotValidator.errors) };
    }

    return { valid: true };
  }

  private async loadSchemaFile(fileName: string): Promise<unknown> {
    const schemaPath = `${this.schemaDirectory}/${fileName}`;
    const contents = await fs.readFile(schemaPath, "utf-8");
    return JSON.parse(contents) as unknown;
  }

  private getEventSchemaKey(eventType: string, schemaVersion: string): string {
    return `${eventType}@${schemaVersion}`;
  }
}
