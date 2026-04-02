import test from "node:test";
import assert from "node:assert/strict";

import { defineStateSchema } from "../src/state/schema.js";
import { generateStateMutationPayloadSchema } from "../src/state/payloadSchema.js";

test("payload schema includes primitive and array transition variants", () => {
  const schema = defineStateSchema({
    type: "object",
    fields: {
      count: { type: "number" },
      title: { type: "string" },
      enabled: { type: "boolean" },
      users: {
        type: "array",
        items: {
          type: "object",
          fields: {
            id: { type: "number" },
            active: { type: "boolean" }
          }
        }
      }
    }
  });

  const payloadSchema = generateStateMutationPayloadSchema(schema);
  assert.ok(Array.isArray(payloadSchema.oneOf));

  const oneOf = payloadSchema.oneOf ?? [];
  const kinds = oneOf
    .map((entry) => entry.properties?.kind?.const)
    .filter((value): value is string => typeof value === "string");

  assert.ok(kinds.includes("number.increment"));
  assert.ok(kinds.includes("string.append"));
  assert.ok(kinds.includes("boolean.toggle"));
  assert.ok(kinds.includes("array.updateWhere"));
});
