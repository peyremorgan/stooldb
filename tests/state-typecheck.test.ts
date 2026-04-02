import test from "node:test";
import assert from "node:assert/strict";

import { defineStateSchema } from "../src/state/schema.js";

test("defineStateSchema supports nested composites and arrays of primitives", () => {
  const schema = defineStateSchema({
    type: "object",
    fields: {
      counter: { type: "number" },
      profile: {
        type: "object",
        fields: {
          name: { type: "string" },
          active: { type: "boolean" }
        }
      },
      tags: {
        type: "array",
        items: { type: "string" }
      }
    }
  });

  assert.equal(schema.type, "object");
  assert.equal(schema.fields.counter.type, "number");
});
