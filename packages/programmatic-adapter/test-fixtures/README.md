# Test fixtures — `@act-spec/programmatic-adapter`

This directory holds fixture data that the package's `pnpm conformance`
script builds programmatic adapters around. Unlike PRD-201's
`sample-tree/`, the programmatic-adapter has no on-disk source format —
the "fixtures" here are JSON snapshots of expected emitted nodes used by
visual diff during development.

The conformance script in `../conformance.ts` constructs each scenario
inline (matching PRD-208 §"Examples") and feeds the resulting nodes
through `@act-spec/validator`. The scenarios cover:

- PRD-208 Example 1 — minimal Core inline.
- PRD-208 Example 5 — recoverable transform throw → placeholder.
- PRD-208 §"Examples" — Plus-tier emission with a `marketing:hero` block,
  exercising both PRD-208-R3 (block schema validation) and PRD-208-R8
  (sample probe pass).
- `defineSimpleAdapter` convenience (PRD-208 implementation note 6).

Negative fixtures (PRD-208-R12 unrecoverable failures) are exercised by
the unit test suite (`src/programmatic.test.ts`) since they throw before
emission and have no node-shaped output to snapshot.
