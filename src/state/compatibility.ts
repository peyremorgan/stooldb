import type { StateMutation } from "./operations.js";

export type CompatibilityOutcome = "merge" | "incompatible";

export interface MutationTraits {
  category: "relative" | "absolute" | "structural";
  commutative: boolean;
  stateDependent: boolean;
  idempotency: "natural" | "requires_dedupe" | "none";
}

export function classifyMutationTraits(mutation: StateMutation): MutationTraits {
  switch (mutation.kind) {
    case "number.increment":
    case "number.decrement":
      return { category: "relative", commutative: true, stateDependent: false, idempotency: "none" };

    case "number.set":
    case "string.set":
    case "boolean.set":
      return { category: "absolute", commutative: false, stateDependent: false, idempotency: "natural" };

    case "string.append":
      return {
        category: "relative",
        commutative: false,
        stateDependent: true,
        idempotency: "requires_dedupe"
      };

    case "boolean.toggle":
      return {
        category: "relative",
        commutative: true,
        stateDependent: false,
        idempotency: "requires_dedupe"
      };

    case "array.push":
      return {
        category: "relative",
        commutative: false,
        stateDependent: true,
        idempotency: "requires_dedupe"
      };

    case "array.pop":
    case "array.shift":
      return { category: "structural", commutative: false, stateDependent: true, idempotency: "none" };

    case "array.updateWhere":
      return {
        category: mutation.mutate.action === "set" ? "absolute" : "relative",
        commutative: mutation.mutate.action === "increment" || mutation.mutate.action === "decrement",
        stateDependent: true,
        idempotency: mutation.mutate.action === "set" ? "natural" : "none"
      };
  }
}

export function mutationCompatibility(left: StateMutation, right: StateMutation): CompatibilityOutcome {
  if (!pathsEqual(left.path, right.path)) {
    return "merge";
  }

  if (isStructural(left) || isStructural(right)) {
    return "incompatible";
  }

  if (isAbsolute(left) || isAbsolute(right)) {
    return "incompatible";
  }

  if (isNumericRelative(left) && isNumericRelative(right)) {
    return "merge";
  }

  if (left.kind === "boolean.toggle" && right.kind === "boolean.toggle") {
    return "merge";
  }

  if (left.kind === "array.push" && right.kind === "array.push") {
    return "merge";
  }

  if (left.kind === "string.append" && right.kind === "string.append") {
    return "merge";
  }

  if (left.kind === "array.updateWhere" && right.kind === "array.updateWhere") {
    if (!pathsEqual(left.mutate.fieldPath, right.mutate.fieldPath)) {
      return "merge";
    }

    if (left.mutate.action === "increment" || left.mutate.action === "decrement") {
      if (right.mutate.action === "increment" || right.mutate.action === "decrement") {
        return "merge";
      }
    }
  }

  return "incompatible";
}

function isAbsolute(mutation: StateMutation): boolean {
  return mutation.kind.endsWith(".set")
    || (mutation.kind === "array.updateWhere" && mutation.mutate.action === "set");
}

function isStructural(mutation: StateMutation): boolean {
  return mutation.kind === "array.pop" || mutation.kind === "array.shift";
}

function isNumericRelative(mutation: StateMutation): boolean {
  return mutation.kind === "number.increment" || mutation.kind === "number.decrement";
}

function pathsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) {
      return false;
    }
  }

  return true;
}