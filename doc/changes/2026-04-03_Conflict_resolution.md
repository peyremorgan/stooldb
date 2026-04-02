# Conflict resolution
Date: 2026-04-03  
Scope: Partition-tolerant conflict handling for duplicate sequence events and offline/cloud-sync writes

## Summary of changes
- Reworked conflict handling away from a pure winner-take-all duplicate-sequence policy for `StateMutation` events.
- Added a category-based mutation compatibility classifier to group operations by semantic behavior instead of relying on a full handwritten pairwise matrix.
- Classified operations into practical semantic buckets such as relative, absolute, and structural, with compatibility outcomes driven by those traits.
- Updated stream read resolution so duplicate same-sequence `StateMutation` events are grouped and evaluated together.
- Changed replay behavior for compatible duplicate same-sequence state mutations so all compatible operations are preserved and replayed in deterministic order.
- Kept deterministic single-winner behavior for incompatible same-sequence state mutations rather than replaying both.
- Removed write-time timestamp regression rejection so delayed or offline clients are not rejected simply because their wall clock or sync latency is behind.
- Added optional event identity metadata (`eventId`, `writerLocalSequence`) to the event envelope to support deterministic ordering and future deduplication/resequencing work.
- Updated event ordering tie-breaks to prefer writer identity metadata over wall-clock timestamp when possible.
- Preserved compatibility with legacy event files and existing sequence-prefixed filenames.
- Expanded tests to cover:
	- compatibility classification rules
	- delayed timestamp acceptance
	- compatible duplicate-sequence merge behavior (`+2` and `+9` => `11`)
	- incompatible duplicate-sequence deterministic winner behavior
- Updated README notes to describe the new replay/conflict semantics.

## Lessons learned
- A full 2D compatibility matrix is not the right primary abstraction here; semantic categories plus a small number of overrides are easier to scale and reason about.
- Wall-clock time is a poor source of authority in an offline-first, cloud-synced system. It is useful as a fallback signal, but not as the main conflict decision mechanism.
- Reject-late-write logic is fundamentally mismatched with long partitions and slow sync; acceptance plus deterministic replay resolution is much more robust.
- Replay semantics matter as much as write semantics. The system only becomes partition-tolerant once read/replay can preserve compatible intent instead of collapsing conflicts too early.
- Stable per-event identity is necessary even before a full causal protocol is implemented; it provides a clean foundation for future dedupe and resequencing work.
- Small commits with build/test verification after each step made it practical to refactor behavior without losing confidence.

## Notes for the future
- Extend the compatibility engine beyond `StateMutation` so other event types can opt into custom merge semantics.
- Add explicit conflict artifacts for incompatible same-sequence events so loser selection is auditable instead of only being implicit in replay behavior.
- Introduce a proper v2 envelope with stronger causal metadata (for example stable writer id plus causal frontier or logical clock) instead of continuing to evolve v1 opportunistically.
- Revisit `string.append`, `boolean.toggle`, `array.push`, and `array.updateWhere` semantics for stronger dedupe/idempotency guarantees under repeated delivery.
- Add a resolver API or plugin hook so application domains can define their own compatibility/merge rules for custom event types.
- Consider producing a canonical merged view or synthetic resequenced stream for diagnostics, not just resolved replay behavior.
- Add stress tests simulating long offline periods, out-of-order file arrival, duplicate delivery, and mixed-version streams.
