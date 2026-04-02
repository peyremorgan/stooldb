import type { StateMutation } from "./operations.js";
import { applyMutationSpec, evaluatePredicate, getByPath, setByPath } from "./operations.js";

export function applyStateMutation<TState>(state: TState, mutation: StateMutation): TState {
  const current = getByPath(state, mutation.path);

  switch (mutation.kind) {
    case "number.increment": {
      const next = (typeof current === "number" ? current : 0) + mutation.by;
      return setByPath(state, mutation.path, next);
    }

    case "number.decrement": {
      const next = (typeof current === "number" ? current : 0) - mutation.by;
      return setByPath(state, mutation.path, next);
    }

    case "number.set":
      return setByPath(state, mutation.path, mutation.value);

    case "string.append": {
      const base = typeof current === "string" ? current : "";
      return setByPath(state, mutation.path, `${base}${mutation.value}`);
    }

    case "string.set":
      return setByPath(state, mutation.path, mutation.value);

    case "boolean.toggle": {
      const base = typeof current === "boolean" ? current : false;
      return setByPath(state, mutation.path, !base);
    }

    case "boolean.set":
      return setByPath(state, mutation.path, mutation.value);

    case "array.push": {
      const array = Array.isArray(current) ? current.slice() : [];
      array.push(mutation.value);
      return setByPath(state, mutation.path, array);
    }

    case "array.pop": {
      const array = Array.isArray(current) ? current.slice() : [];
      array.pop();
      return setByPath(state, mutation.path, array);
    }

    case "array.shift": {
      const array = Array.isArray(current) ? current.slice() : [];
      array.shift();
      return setByPath(state, mutation.path, array);
    }

    case "array.updateWhere": {
      const array = Array.isArray(current) ? current : [];
      const updated = array.map((item) => {
        if (!evaluatePredicate(item, mutation.where)) {
          return item;
        }

        return applyMutationSpec(item, mutation.mutate);
      });
      return setByPath(state, mutation.path, updated);
    }

    default:
      return state;
  }
}

export function createStateReducer<TState>(): (state: TState, mutation: StateMutation) => TState {
  return (state, mutation) => applyStateMutation(state, mutation);
}
