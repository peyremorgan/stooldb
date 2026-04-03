# Reactive state
Date: 2026-04-02  
Scope: High-level schema-driven reactive state API on top of StoolDB core

## Summary of changes
- Added a state schema DSL supporting primitives, nested objects, and arrays.
- Added derived typing helpers so application state can be inferred from schema definitions.
- Added runtime schema validation with path-specific errors for unsupported or malformed nodes.
- Implemented predefined primitive transitions:
	- number: increment, decrement, set
	- string: append, set
	- boolean: toggle, set
- Implemented collection transitions:
	- push, pop, shift
	- updateWhere (declarative predicate + declarative mutation)
- Implemented immutable recursive reducer that applies path-based updates to composite state.
- Implemented payload-schema generation for state mutation events.
- Added reactive state store using RxJS (state stream + mutation stream), including replay-on-init behavior.
- Exposed high-level API via StoolDB.createStateStore while preserving low-level append/read APIs.
- Added tests for schema validation, accumulators, payload schema generation, reactive replay/updates, and typed schema usage.
- Updated README with high-level API usage and transition reference.

## Lessons learned
- Declarative mutation specs are safer than serializing executable functions; they preserve determinism and replay safety.
- A path-based immutable reducer is a practical bridge between nested schemas and event payloads.
- Reactive streams pair naturally with event-sourced state and simplify downstream UI integration.
- Keeping the high-level API layered on top of the existing core avoids breaking current consumers.
- Tight test loops are essential when adding expressive mutation capabilities (especially arrays).

## Notes for the future
- Add compile-time negative tests (ts-expect-error) for unsupported schema leafs to harden type-level guarantees.
- Expand collection predicates/mutations carefully while preserving deterministic replay semantics.
- Add selector helpers (memoized/selective streams) for large state trees and UI performance.
- Consider operation versioning strategy for schema/mutation evolution over time.
- Integrate filesystem change ingestion with reactive state updates in a later phase.
