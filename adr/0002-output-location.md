# ADR-0002 — PRDs live as numbered markdown files under `prd/` in this repo

## Status

Accepted

## Context

PRDs need a durable, reviewable, Git-tracked home. The serious options were:

1. This repo's `prd/` directory, as plain markdown.
2. A separate documentation-only repository.
3. A docs site (Docusaurus, Mintlify, or similar) backed by a CMS.
4. Per-PRD GitHub issues, with the issue body as the spec.

Each option trades off review ergonomics, version control, portability, and the cost of consuming the PRDs as a coherent unit. The user chose option 1.

## Decision

We will keep PRDs at `/home/user/ACT/prd/NN-<slug>.md`. Numbering follows the series taxonomy in `prd/00-INDEX.md`: 00 meta, 10 standard, 20 source adapters, 30 component instrumentation, 40 generators, 50 runtime SDK, 60 tooling, 70 examples, 80 ecosystem. Schema files and example payloads live alongside the PRD or under `prd/NN-<slug>/` subdirectories when more than one supporting file is needed. ADRs live at `/home/user/ACT/adr/NNNN-<slug>.md`. Test fixtures live at `/home/user/ACT/tests/fixtures/PRD-NN/`.

## Consequences

### Positive

- PRDs version with the spec; a tag captures both spec and PRDs at a known state.
- Pull requests naturally review PRD changes alongside any reference-implementation changes that motivated them.
- CI can lint PRDs (link checking, schema validation, RFC keyword usage) in the same pipeline that lints code.
- Migration to a docs site is trivial later — markdown is portable, and the numbered taxonomy maps cleanly to a sidebar.

### Negative

- Large markdown files render poorly in some GitHub UIs (warnings start near 1MB; navigation breaks near 5MB).
- Diff review for big PRD additions is harder than per-section reviews would be in a CMS.
- Cross-PRD navigation depends on link discipline; without tooling, broken references are easy to introduce.

### Neutral

- The repo grows linearly with the spec. We expect roughly 5–15 MB of markdown by v1.0; this is well within Git's comfortable range.
- Search across PRDs is whatever the developer's editor or `ripgrep` provides; we are not building a hosted search until later.

## Alternatives considered

- **Separate documentation repository.** Rejected: synchronization overhead between spec changes and PRD changes; PRs that touch both become cross-repo dances.
- **Docs site CMS (Docusaurus, Mintlify, Notion).** Rejected: harder review and version control; pulls the source-of-truth out of Git; introduces a hosted-service dependency before v1.0.
- **Per-PRD GitHub issues.** Rejected: poor tooling for reading 50+ PRDs as a coherent unit; issues are optimized for discussion threads, not living standards documents.

## Links

- Related PRDs: `prd/00-INDEX.md`, `prd/00-template.md`
- Related ADRs: ADR-0001 (PRD style)
- Source: `DRAFT-spec-v0.1.md`

## Changelog

- 2026-05-01 — Proposed
- 2026-05-01 — Accepted
