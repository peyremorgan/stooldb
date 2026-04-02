import test from "node:test";
import assert from "node:assert/strict";

import { classifyMutationTraits, mutationCompatibility } from "../src/state/compatibility.js";
import type { StateMutation } from "../src/state/operations.js";

test("classifies mutation traits by semantic category", () => {
  const incrementTraits = classifyMutationTraits({ kind: "number.increment", path: ["count"], by: 1 });
  assert.equal(incrementTraits.category, "relative");
  assert.equal(incrementTraits.commutative, true);

  const setTraits = classifyMutationTraits({ kind: "string.set", path: ["label"], value: "x" });
  assert.equal(setTraits.category, "absolute");
  assert.equal(setTraits.idempotency, "natural");

  const popTraits = classifyMutationTraits({ kind: "array.pop", path: ["items"] });
  assert.equal(popTraits.category, "structural");
  assert.equal(popTraits.stateDependent, true);
});

test("numeric relative ops on same path are compatible", () => {
  const a: StateMutation = { kind: "number.increment", path: ["count"], by: 2 };
  const b: StateMutation = { kind: "number.decrement", path: ["count"], by: 1 };
  assert.equal(mutationCompatibility(a, b), "merge");
});

test("absolute or structural ops on same path are incompatible", () => {
  const setA: StateMutation = { kind: "number.set", path: ["count"], value: 2 };
  const setB: StateMutation = { kind: "number.set", path: ["count"], value: 9 };
  assert.equal(mutationCompatibility(setA, setB), "incompatible");

  const push: StateMutation = { kind: "array.push", path: ["items"], value: 1 };
  const pop: StateMutation = { kind: "array.pop", path: ["items"] };
  assert.equal(mutationCompatibility(push, pop), "incompatible");
});

test("disjoint paths are merge-compatible", () => {
  const a: StateMutation = { kind: "number.set", path: ["count"], value: 2 };
  const b: StateMutation = { kind: "number.set", path: ["other"], value: 9 };
  assert.equal(mutationCompatibility(a, b), "merge");
});