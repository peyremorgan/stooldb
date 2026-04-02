import type { StateSchema } from "./schema.js";
import { collectSchemaPaths } from "./schema.js";

export interface JsonSchema {
  type?: string | string[];
  const?: unknown;
  enum?: Array<string | number | boolean>;
  oneOf?: JsonSchema[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  additionalProperties?: boolean;
  minItems?: number;
  minLength?: number;
}

export function generateStateMutationPayloadSchema(schema: StateSchema): JsonSchema {
  const paths = collectSchemaPaths(schema);

  const primitiveMutations: JsonSchema[] = [];
  const arrayMutations: JsonSchema[] = [];

  for (const entry of paths) {
    const pathValues = entry.path;

    if (entry.schema.type === "number") {
      primitiveMutations.push(createNumberIncrement(pathValues));
      primitiveMutations.push(createNumberDecrement(pathValues));
      primitiveMutations.push(createNumberSet(pathValues));
      continue;
    }

    if (entry.schema.type === "string") {
      primitiveMutations.push(createStringAppend(pathValues));
      primitiveMutations.push(createStringSet(pathValues));
      continue;
    }

    if (entry.schema.type === "boolean") {
      primitiveMutations.push(createBooleanToggle(pathValues));
      primitiveMutations.push(createBooleanSet(pathValues));
      continue;
    }

    if (entry.schema.type === "array") {
      arrayMutations.push(createArrayPush(pathValues));
      arrayMutations.push(createArrayPop(pathValues));
      arrayMutations.push(createArrayShift(pathValues));
      arrayMutations.push(createArrayUpdateWhere(pathValues));
    }
  }

  return {
    oneOf: [...primitiveMutations, ...arrayMutations]
  };
}

function createPathConst(path: string[]): JsonSchema {
  return {
    const: path
  };
}

function createBase(kind: string, path: string[]): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    required: ["kind", "path"],
    properties: {
      kind: { const: kind },
      path: createPathConst(path)
    }
  };
}

function createNumberIncrement(path: string[]): JsonSchema {
  const base = createBase("number.increment", path);
  return {
    ...base,
    required: ["kind", "path", "by"],
    properties: {
      ...base.properties,
      by: { type: "number" }
    }
  };
}

function createNumberDecrement(path: string[]): JsonSchema {
  const base = createBase("number.decrement", path);
  return {
    ...base,
    required: ["kind", "path", "by"],
    properties: {
      ...base.properties,
      by: { type: "number" }
    }
  };
}

function createNumberSet(path: string[]): JsonSchema {
  const base = createBase("number.set", path);
  return {
    ...base,
    required: ["kind", "path", "value"],
    properties: {
      ...base.properties,
      value: { type: "number" }
    }
  };
}

function createStringAppend(path: string[]): JsonSchema {
  const base = createBase("string.append", path);
  return {
    ...base,
    required: ["kind", "path", "value"],
    properties: {
      ...base.properties,
      value: { type: "string" }
    }
  };
}

function createStringSet(path: string[]): JsonSchema {
  const base = createBase("string.set", path);
  return {
    ...base,
    required: ["kind", "path", "value"],
    properties: {
      ...base.properties,
      value: { type: "string" }
    }
  };
}

function createBooleanToggle(path: string[]): JsonSchema {
  return createBase("boolean.toggle", path);
}

function createBooleanSet(path: string[]): JsonSchema {
  const base = createBase("boolean.set", path);
  return {
    ...base,
    required: ["kind", "path", "value"],
    properties: {
      ...base.properties,
      value: { type: "boolean" }
    }
  };
}

function createArrayPush(path: string[]): JsonSchema {
  const base = createBase("array.push", path);
  return {
    ...base,
    required: ["kind", "path", "value"],
    properties: {
      ...base.properties,
      value: {}
    }
  };
}

function createArrayPop(path: string[]): JsonSchema {
  return createBase("array.pop", path);
}

function createArrayShift(path: string[]): JsonSchema {
  return createBase("array.shift", path);
}

function createArrayUpdateWhere(path: string[]): JsonSchema {
  const base = createBase("array.updateWhere", path);
  return {
    ...base,
    required: ["kind", "path", "where", "mutate"],
    properties: {
      ...base.properties,
      where: {
        type: "object",
        additionalProperties: false,
        required: ["fieldPath", "op", "value"],
        properties: {
          fieldPath: { type: "array", items: { type: "string" } },
          op: { enum: ["eq", "ne", "gt", "gte", "lt", "lte", "contains"] },
          value: { type: ["number", "string", "boolean"] }
        }
      },
      mutate: {
        type: "object",
        additionalProperties: false,
        required: ["fieldPath", "action"],
        properties: {
          fieldPath: { type: "array", items: { type: "string" } },
          action: { enum: ["set", "increment", "decrement", "append", "toggle"] },
          value: { type: ["number", "string", "boolean"] }
        }
      }
    }
  };
}
