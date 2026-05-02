# @act-spec/programmatic-adapter

PRD-208 programmatic adapter — the escape hatch for content sources without a
dedicated ACT adapter. A factory (`defineProgrammaticAdapter`) wraps
user-supplied `enumerate` and `transform` functions into a fully
PRD-200-conformant `Adapter`. The factory adds:

- Pre-emit validation against `schemas/100/node.schema.json` and the applicable
  `schemas/102/block-*.schema.json` per content block (PRD-208-R3, amendment A3).
- `Object.freeze` on `ctx.config` to prevent accidental mutation (PRD-208-R4).
- Source attribution: `metadata.source.adapter` defaults to `spec.name`
  (PRD-208-R9).
- Capability sampling probe: every Nth emission is checked against the declared
  level (PRD-208-R8).
- Strict / recoverable failure policies for user-thrown errors (PRD-208-R10/R11).
- Idempotent `dispose` wrapper (PRD-200-R7).
- Tolerates `Iterable | AsyncIterable | Array` returns from `enumerate`
  (PRD-208-R5).

## Install

```bash
pnpm add @act-spec/programmatic-adapter
```

## Quickstart

```ts
import { defineProgrammaticAdapter } from '@act-spec/programmatic-adapter';

export default defineProgrammaticAdapter({
  name: 'fixture-source',
  enumerate: () => [
    { id: 'intro', title: 'Introduction', body: 'Hello, ACT.' },
  ],
  transform: (item) => ({
    act_version: '0.1',
    id: item.id,
    type: 'article',
    title: item.title,
    etag: 's256:AAAAAAAAAAAAAAAAAAAAAA',
    summary: item.body.slice(0, 60),
    content: [{ type: 'markdown', text: item.body }],
    tokens: { summary: 4 },
  }),
});
```

## Convenience: `defineSimpleAdapter`

For the static-array case (PRD-208 implementation note 6):

```ts
import { defineSimpleAdapter } from '@act-spec/programmatic-adapter';

export default defineSimpleAdapter({
  name: 'inline',
  items: [{ id: 'a', title: 'A' }],
  transform: (item) => ({ /* … */ }),
});
```

## Contracts

This package implements PRD-208 and exercises PRD-200 framework conformance.
See `prd/208-programmatic-adapter.md` for the normative spec; every
PRD-208-R{n} requirement has a citing test in `src/programmatic.test.ts`.

## Conformance gate

```bash
pnpm -F @act-spec/programmatic-adapter conformance
```

Runs `@act-spec/validator` against the bundled fixture corpus under
`test-fixtures/` and exits non-zero on any gap.
