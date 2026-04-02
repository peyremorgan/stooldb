import test from "node:test";
import assert from "node:assert/strict";

import { applyStateMutation } from "../src/state/reducer.js";

test("primitive mutations apply immutably", () => {
  const start = {
    counter: 1,
    text: "a",
    active: false
  };

  const a = applyStateMutation(start, { kind: "number.increment", path: ["counter"], by: 2 });
  const b = applyStateMutation(a, { kind: "string.append", path: ["text"], value: "b" });
  const c = applyStateMutation(b, { kind: "boolean.toggle", path: ["active"] });

  assert.deepEqual(c, { counter: 3, text: "ab", active: true });
  assert.notEqual(start, a);
  assert.notEqual(a, b);
});

test("array operations push pop shift", () => {
  const start = { items: [1, 2] };
  const a = applyStateMutation(start, { kind: "array.push", path: ["items"], value: 3 });
  const b = applyStateMutation(a, { kind: "array.pop", path: ["items"] });
  const c = applyStateMutation(b, { kind: "array.shift", path: ["items"] });

  assert.deepEqual(c.items, [2]);
});

test("array updateWhere applies declarative predicate and mutation", () => {
  const start = {
    users: [
      { id: 1, name: "A", active: false },
      { id: 2, name: "B", active: false }
    ]
  };

  const updated = applyStateMutation(start, {
    kind: "array.updateWhere",
    path: ["users"],
    where: {
      fieldPath: ["id"],
      op: "eq",
      value: 2
    },
    mutate: {
      fieldPath: ["active"],
      action: "toggle"
    }
  });

  assert.equal(updated.users[0].active, false);
  assert.equal(updated.users[1].active, true);
});
