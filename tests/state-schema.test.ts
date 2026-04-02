import test from "node:test";
import assert from "node:assert/strict";

import { defineStateSchema } from "../src/state/schema.js";
import { StateSchemaValidationError, validateStateSchema } from "../src/state/validation.js";

test("validateStateSchema accepts supported nested schema", () => {
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

  assert.doesNotThrow(() => validateStateSchema(schema));
});

test("validateStateSchema rejects unsupported leaf with precise path", () => {
  const schema = {
    type: "object",
    fields: {
      profile: {
        type: "object",
        fields: {
          birthDate: {
            type: "date"
          }
        }
      }
    }
  } as unknown as ReturnType<typeof defineStateSchema>;

  assert.throws(
    () => validateStateSchema(schema),
    (error: unknown) =>
      error instanceof StateSchemaValidationError &&
      error.path === "profile.birthDate" &&
      error.message.includes("unsupported leaf type")
  );
});
