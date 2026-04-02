import type { StateSchema } from "./schema.js";

export class StateSchemaValidationError extends Error {
  public constructor(public readonly path: string, message: string) {
    super(`${path || "<root>"}: ${message}`);
    this.name = "StateSchemaValidationError";
  }
}

export function validateStateSchema(schema: StateSchema): void {
  validateNode(schema, []);
}

function validateNode(node: unknown, path: string[]): void {
  if (!node || typeof node !== "object") {
    throw new StateSchemaValidationError(pathToString(path), "schema node must be an object");
  }

  const typed = node as Partial<StateSchema> & Record<string, unknown>;

  if (typed.type === "number" || typed.type === "string" || typed.type === "boolean") {
    return;
  }

  if (typed.type === "array") {
    if (!("items" in typed)) {
      throw new StateSchemaValidationError(pathToString(path), "array schema must define items");
    }

    validateNode((typed as { items: unknown }).items, [...path, "[]"]);
    return;
  }

  if (typed.type === "object") {
    const fields = (typed as { fields?: unknown }).fields;
    if (!fields || typeof fields !== "object" || Array.isArray(fields)) {
      throw new StateSchemaValidationError(pathToString(path), "object schema must define fields object");
    }

    for (const [key, value] of Object.entries(fields)) {
      validateNode(value, [...path, key]);
    }
    return;
  }

  throw new StateSchemaValidationError(
    pathToString(path),
    `unsupported leaf type ${(typed.type as string | undefined) ?? "undefined"}`
  );
}

function pathToString(path: string[]): string {
  if (path.length === 0) {
    return "<root>";
  }
  return path.join(".");
}
