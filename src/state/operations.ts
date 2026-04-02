export type PrimitiveValue = number | string | boolean;

export type ComparisonOperator = "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "contains";

export interface PredicateSpec {
  fieldPath: string[];
  op: ComparisonOperator;
  value: PrimitiveValue;
}

export type MutationAction = "set" | "increment" | "decrement" | "append" | "toggle";

export interface MutationSpec {
  fieldPath: string[];
  action: MutationAction;
  value?: PrimitiveValue;
}

export type StateMutation =
  | { kind: "number.increment"; path: string[]; by: number }
  | { kind: "number.decrement"; path: string[]; by: number }
  | { kind: "number.set"; path: string[]; value: number }
  | { kind: "string.append"; path: string[]; value: string }
  | { kind: "string.set"; path: string[]; value: string }
  | { kind: "boolean.toggle"; path: string[] }
  | { kind: "boolean.set"; path: string[]; value: boolean }
  | { kind: "array.push"; path: string[]; value: unknown }
  | { kind: "array.pop"; path: string[] }
  | { kind: "array.shift"; path: string[] }
  | { kind: "array.updateWhere"; path: string[]; where: PredicateSpec; mutate: MutationSpec };

export function evaluatePredicate(item: unknown, predicate: PredicateSpec): boolean {
  const current = getByPath(item, predicate.fieldPath);

  switch (predicate.op) {
    case "eq":
      return current === predicate.value;
    case "ne":
      return current !== predicate.value;
    case "gt":
      return typeof current === "number" && typeof predicate.value === "number" && current > predicate.value;
    case "gte":
      return typeof current === "number" && typeof predicate.value === "number" && current >= predicate.value;
    case "lt":
      return typeof current === "number" && typeof predicate.value === "number" && current < predicate.value;
    case "lte":
      return typeof current === "number" && typeof predicate.value === "number" && current <= predicate.value;
    case "contains":
      if (typeof current === "string" && typeof predicate.value === "string") {
        return current.includes(predicate.value);
      }
      return false;
    default:
      return false;
  }
}

export function applyMutationSpec(item: unknown, mutation: MutationSpec): unknown {
  const current = getByPath(item, mutation.fieldPath);

  if (mutation.action === "set") {
    return setByPath(item, mutation.fieldPath, mutation.value);
  }

  if (mutation.action === "increment") {
    const base = typeof current === "number" ? current : 0;
    const delta = typeof mutation.value === "number" ? mutation.value : 0;
    return setByPath(item, mutation.fieldPath, base + delta);
  }

  if (mutation.action === "decrement") {
    const base = typeof current === "number" ? current : 0;
    const delta = typeof mutation.value === "number" ? mutation.value : 0;
    return setByPath(item, mutation.fieldPath, base - delta);
  }

  if (mutation.action === "append") {
    const base = typeof current === "string" ? current : "";
    const extra = typeof mutation.value === "string" ? mutation.value : "";
    return setByPath(item, mutation.fieldPath, `${base}${extra}`);
  }

  if (mutation.action === "toggle") {
    const base = typeof current === "boolean" ? current : false;
    return setByPath(item, mutation.fieldPath, !base);
  }

  return item;
}

export function getByPath(input: unknown, path: string[]): unknown {
  let current: unknown = input;

  for (const segment of path) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

export function setByPath<T>(input: T, path: string[], value: unknown): T {
  if (path.length === 0) {
    return value as T;
  }

  const [head, ...tail] = path;

  if (Array.isArray(input)) {
    const clone = input.slice();
    const index = Number(head);
    const current = Number.isInteger(index) ? clone[index] : undefined;
    clone[index] = tail.length === 0 ? value : setByPath(current, tail, value);
    return clone as T;
  }

  const base = (input && typeof input === "object") ? (input as Record<string, unknown>) : {};
  const clone: Record<string, unknown> = { ...base };
  const current = clone[head];
  clone[head] = tail.length === 0 ? value : setByPath(current, tail, value);
  return clone as T;
}
