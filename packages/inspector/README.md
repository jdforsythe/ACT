# @act-spec/inspector

PRD-601 inspector CLI + library for the ACT v0.1 wire format. Subcommands:
`fetch`, `walk`, `diff`, `token-budget`. The binary is `act-inspect`; the
library exposes one programmatic function per subcommand.

Two architectural invariants drive the design:

- **PRD-601-R1.** Every envelope this package sees passes through
  `@act-spec/validator`'s per-envelope validators. The inspector never
  ships its own JSON Schema parser.
- **PRD-601-R21.** The inspector emits `findings` — operator-facing
  observations — never `gaps`. Operators wanting a conformance verdict
  run `act-validate` (`@act-spec/validator`).

## Status

ACT v0.1 internal hand-test candidate. Public release lands at v0.2.

## Install

Unpublished in v0.1. Consume via the workspace:

```jsonc
// package.json
{ "devDependencies": { "@act-spec/inspector": "workspace:*" } }
```

For out-of-tree hand-test, run `pnpm pack` inside `packages/inspector`
and install the resulting tarball locally; the `act-inspect` binary is
exposed via the package's `bin` field.

## Usage

CLI:

```bash
act-inspect fetch  https://example.com/act/                # manifest + index summary
act-inspect walk   https://example.com/act/  --max 50       # walk N nodes
act-inspect diff   ./before/index.json ./after/index.json   # ETag-keyed diff
act-inspect token-budget https://example.com/act/  --limit 8000
```

Programmatic:

```ts
import { inspect, walk, diff, budget, node, subtree } from '@act-spec/inspector';

const result = await inspect({ url: 'https://example.com/act/' });
for (const finding of result.findings) {
  console.log(finding.code, finding.message);
}
```

## Conformance / what's tested

Each subcommand cites PRD-601-R{n} in the test suite covering the
validator-reuse invariant, the `findings` reporting contract, etag-keyed
diff semantics, and the token-budget walk policy. The conformance gate
exercises every subcommand against the bundled fixtures.

```bash
pnpm -F @act-spec/inspector conformance
```

## Compatibility

Pure JS, no host-framework peer. Targets Node 20+. Reuses the schema
bundle and per-envelope validators shipped by `@act-spec/validator`;
upgrading the validator picks up new schema versions automatically.

## Links

- Leaf PRD: [`prd/601-inspector-cli.md`](../../prd/601-inspector-cli.md)
- Validator: [`@act-spec/validator`](../validator)
- Repository: <https://github.com/act-spec/act>
