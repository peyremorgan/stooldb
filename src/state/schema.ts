export type PrimitiveKind = "number" | "string" | "boolean";

export interface NumberSchema {
  type: "number";
}

export interface StringSchema {
  type: "string";
}

export interface BooleanSchema {
  type: "boolean";
}

export interface ArraySchema<TItem extends StateSchema = StateSchema> {
  type: "array";
  items: TItem;
}

export interface ObjectSchema<TFields extends Record<string, StateSchema> = Record<string, StateSchema>> {
  type: "object";
  fields: TFields;
}

export type PrimitiveSchema = NumberSchema | StringSchema | BooleanSchema;
export type StateSchema = PrimitiveSchema | ArraySchema | ObjectSchema;

export type InferState<TSchema extends StateSchema> =
  TSchema extends NumberSchema ? number :
  TSchema extends StringSchema ? string :
  TSchema extends BooleanSchema ? boolean :
  TSchema extends ArraySchema<infer TItem> ? Array<InferState<TItem>> :
  TSchema extends ObjectSchema<infer TFields> ? { [K in keyof TFields]: InferState<TFields[K]> } :
  never;

export function defineStateSchema<TSchema extends StateSchema>(schema: TSchema): TSchema {
  return schema;
}

export interface SchemaPathInfo {
  path: string[];
  schema: StateSchema;
}

export function getSchemaAtPath(root: StateSchema, path: string[]): StateSchema | undefined {
  let current: StateSchema | undefined = root;

  for (const segment of path) {
    if (!current) {
      return undefined;
    }

    if (current.type === "object") {
      current = current.fields[segment];
      continue;
    }

    if (current.type === "array") {
      current = current.items;
      continue;
    }

    return undefined;
  }

  return current;
}

export function collectSchemaPaths(root: StateSchema): SchemaPathInfo[] {
  const entries: SchemaPathInfo[] = [];

  const walk = (schema: StateSchema, path: string[]): void => {
    entries.push({ path, schema });

    if (schema.type === "object") {
      for (const [key, value] of Object.entries(schema.fields)) {
        walk(value, [...path, key]);
      }
      return;
    }

    if (schema.type === "array") {
      walk(schema.items, [...path, "*"]);
    }
  };

  walk(root, []);
  return entries;
}
