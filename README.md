# ACT — Agent Content Tree

Reference implementation monorepo for the **Agent Content Tree** (ACT) v0.1 specification.

> ACT is an open standard for publishing structured, AI-discoverable content trees from any CMS, static site generator, or runtime. The spec lives in `prd/` (57 accepted PRDs); this repo houses the TypeScript reference implementation.

## Status

Phase 6.1 — vertical slice. The monorepo is scaffolded; PRD-600 (validator), PRD-201 (markdown adapter), PRD-401 (Astro generator), and the PRD-700 example land in subsequent steps per `docs/team-blueprint.md`.

## Repo layout

```
act/
  prd/                       # 57 accepted PRDs (the spec)
  schemas/                   # JSON Schemas (locked at G1; Spec Steward owns)
  fixtures/                  # Conformance fixtures (Spec Steward owns)
  packages/
    core/                    # @act-spec/core           — shared types + reporter contract
    validator/               # @act-spec/validator      — PRD-600 (placeholder)
    markdown-adapter/        # @act-spec/markdown-adapter — PRD-201 (placeholder)
    astro/                   # @act-spec/astro          — PRD-401 (placeholder)
  examples/
    700-tinybox/             # PRD-700 reference example (stub)
  docs/
    adr/                     # Architectural Decision Records
    conventions.md           # Cross-package conventions
    workflow.md              # End-to-end project workflow
    team-blueprint.md        # 5-agent team composition
    amendments-queue.md      # Spec ambiguities under triage
  .github/workflows/         # ci.yml, nightly.yml, release.yml, _package.yml
```

## Prerequisites

- Node.js >= 20.18
- pnpm >= 10 (the `packageManager` field pins the exact version)

## Bootstrap

```sh
pnpm install
pnpm -F @act-spec/core codegen   # generate envelope types from schemas/
pnpm -r typecheck
pnpm -r test
pnpm -r build
```

## License

Apache-2.0. See [LICENSE](./LICENSE).
