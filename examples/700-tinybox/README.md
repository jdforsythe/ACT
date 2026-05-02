# PRD-700 — Tinybox reference example

Minimal Astro 4.x + markdown documentation site that exercises the
ACT v0.1 vertical slice end-to-end:

- `@act-spec/markdown-adapter` (PRD-201) walks `src/content/docs/` and
  produces ACT node envelopes per source file.
- `@act-spec/astro` (PRD-401) wraps the adapter in an Astro integration
  registered via `astro.config.mjs`'s `integrations: [...]`.
- After `astro build` the integration emits the ACT artifact set under
  `dist/.well-known/act.json` and `dist/act/`.
- `scripts/validate.ts` runs `@act-spec/validator` (PRD-600) over the
  emitted bundle and asserts a clean Standard report.

## Running locally

```sh
pnpm -F @act-spec/example-700-tinybox build
pnpm -F @act-spec/example-700-tinybox validate
# Or in one command:
pnpm -F @act-spec/example-700-tinybox conformance
```

The build emits Astro's HTML routes plus the ACT artifact set. The
validate script reads the artifact set, runs PRD-600's static walk, and
asserts:

- `gaps.length === 0`
- `declared.level === "standard"` (PRD-700-R7).
- `achieved.level === "standard"` (PRD-700-R12).
- `delivery === "static"` (PRD-700-R8).
- At least one subtree file emitted (PRD-700-R6).
- 10–25 nodes (PRD-700-R3).

## Source layout

```
.
├── astro.config.mjs              # PRD-700-R7: registers @act-spec/astro
├── src/
│   ├── content/
│   │   ├── config.ts             # PRD-700-R5: collection schema
│   │   └── docs/
│   │       ├── index.md          # id: root  (PRD-700-R3)
│   │       ├── quickstart.md
│   │       ├── auth.md
│   │       ├── errors.md
│   │       ├── pagination.md
│   │       ├── rate-limits.md
│   │       ├── webhooks.md
│   │       └── endpoints/
│   │           ├── index.md      # id: endpoints
│   │           ├── objects.md
│   │           └── buckets.md
│   └── pages/                    # Astro routes (non-normative for ACT)
│       ├── index.astro
│       └── [...slug].astro
└── scripts/
    └── validate.ts               # PRD-700-R12 / R14 conformance gate
```

## Acceptance criteria

PRD-700-R{1…15} are exercised; the per-PRD requirement-to-test mapping
lives in `prd/700-minimal-docs-astro.md` § "P2 PRDs the example composes."

The example is the Phase 6.1 vertical-slice gate (G2) for the ACT v0.1
implementation; ADR-004 captures the slice retro.
