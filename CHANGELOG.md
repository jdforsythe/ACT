# Changelog

All notable changes to ACT (Agent Content Tree) — both spec and reference
implementation — are recorded in this file. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) per
PRD-108.

The repository ships two artifacts at versions that may diverge:

- **The ACT specification** (PRDs in `prd/`, schemas in `schemas/`,
  fixtures in `fixtures/`). Versioned via `act_version` per PRD-108;
  current spec version is **0.1.0**.
- **The TypeScript reference implementation** (packages in `packages/`,
  examples in `examples/`). Versioned per-package via Changesets. v0.1
  packages stay at `0.0.0` for the internal hand-test pass; v0.2 will
  be the first version-bumped, npm-published cohort.

## [0.1.0] — 2026-05-02 — Internal hand-test candidate

**This is not a public release.** v0.1 lands the full v0.1 spec and
TypeScript reference implementation in the repository for the BDFL to
hand-test end-to-end. Packages are NOT published to npm in v0.1; no
public git tag; no announcement. v0.2 is the first public release.

Why: the spec is reputation-load-bearing for the BDFL. v0.1 exists to
catch issues that pre-Phase-7 testing missed (corner-case bugs in
adapters, generators, runtime SDKs, examples). v0.2 ships once the
hand-test plan in `docs/v0.1-handtest-plan.md` is fully checked off.

The Added / Changed / Deprecated / Open follow-ups sections below
describe what's IN the v0.1 internal candidate; the v0.2 public release
will inherit this surface plus any fixes the hand-test pass surfaces.

### Added

#### Specification (PRDs)

- **000-series (Meta).** PRD-template, 000-INDEX, 000-gaps-and-resolutions,
  000-decisions-needed, 000-governance — all Accepted. Establishes the
  PRD lifecycle, the BDFL governance model (Q1), and the change-control
  process anchored on PRD-108.
- **100-series (Wire format).** PRD-100 through PRD-109 Accepted.
  Defines the manifest / index / node / subtree envelopes
  (PRD-100), discovery and the well-known location (PRD-101), the
  content-block universe including the `marketing:*` namespace
  (PRD-102), caching and ETag determinism (PRD-103), i18n locale model
  (PRD-104), static delivery profile (PRD-105), runtime delivery profile
  (PRD-106), conformance levels Core/Standard/Plus and reporting
  (PRD-107), the versioning policy (PRD-108), and security
  considerations including the two-principal probe surface (PRD-109).
- **200-series (Source adapters).** PRD-200 framework + PRD-201
  (markdown/MDX), PRD-202 (Contentful), PRD-203 (Sanity), PRD-204
  (Storyblok), PRD-205 (Strapi), PRD-206 (Builder.io), PRD-207 (i18n),
  PRD-208 (programmatic). All Accepted.
- **300-series (Component instrumentation).** PRD-300 contract +
  PRD-301 (React), PRD-302 (Vue), PRD-303 (Angular). All Accepted.
- **400-series (Generators).** PRD-400 architecture + PRD-401
  (Astro), PRD-402 (Hugo, spec only), PRD-403 (MkDocs, spec only),
  PRD-404 (Docusaurus), PRD-405 (Next.js static), PRD-406 (Remix
  static), PRD-407 (Nuxt), PRD-408 (Eleventy), PRD-409 (standalone
  CLI). All Accepted.
- **500-series (Runtime SDKs).** PRD-500 contract + PRD-501 (Next.js),
  PRD-502 (Express), PRD-503 (FastAPI, spec only), PRD-504 (Rails,
  spec only), PRD-505 (WHATWG-fetch). All Accepted.
- **600-series (Tooling).** PRD-600 (validator), PRD-601 (inspector
  CLI), PRD-602 (ACT-MCP bridge). All Accepted. PRD-603 (embeddings
  sidecar) is Deprecated for v0.1; deferred to v0.2.
- **700-series (Reference example builds).** PRD-700 through
  PRD-707 Accepted. Includes PRD-703 (Hugo blog) as spec only and
  PRD-707 (Eleventy blog) as the v0.1 first-party TS counterpart.
- **800-series (Adoption & ecosystem).** PRD-800 (crawler & agent
  behavior), PRD-801 (migration playbook), PRD-802 (RFC / change
  control), PRD-803 (naming policy). All Accepted.
- **JSON Schemas.** Wire-format schemas under `schemas/100/` cover
  manifest, index, node, subtree, and well-known shapes. Validate every
  positive fixture under `fixtures/100/`–`fixtures/109/`.
- **Conformance fixtures.** Positive + negative fixtures across the
  100-, 102-, 103-, 109-, 200-, 207-, 300-, and 301-/302-/303-series
  drive the validator and binding conformance gates.

#### Reference implementation (TypeScript packages)

Published from the `act-spec` npm scope. Every package below is built,
tested, and conformance-gated in CI.

- `@act-spec/core` — shared envelope types + utilities. Single source
  of truth derived from the JSON Schemas.
- `@act-spec/_test-utils` — internal fixture loader, two-principal probe
  harness, conformance helper APIs (consumed by leaf packages, not
  published).
- `@act-spec/validator` — PRD-600 validator library + CLI binary
  (`act-validate`). Static and runtime walks; gap-aware reporter;
  achieved-vs-declared level inference per PRD-107.
- `@act-spec/adapter-framework` — PRD-200 framework (extracted from
  `@act-spec/markdown-adapter` per ADR-005). Lifecycle, contribution
  ordering, multi-source merge, capability negotiation.
- `@act-spec/markdown-adapter` — PRD-201 markdown / MDX adapter
  (coarse + fine modes via `parseMode`).
- `@act-spec/contentful-adapter` — PRD-202 Contentful adapter.
- `@act-spec/sanity-adapter` — PRD-203 Sanity adapter.
- `@act-spec/storyblok-adapter` — PRD-204 Storyblok adapter.
- `@act-spec/strapi-adapter` — PRD-205 Strapi adapter.
- `@act-spec/builder-adapter` — PRD-206 Builder.io adapter.
- `@act-spec/i18n-adapter` — PRD-207 i18n adapter (next-intl, react-intl,
  i18next).
- `@act-spec/programmatic-adapter` — PRD-208 escape-hatch adapter.
- `@act-spec/component-contract` — PRD-300 framework. Page-level
  contract, declaration patterns, variant handling, capability matrix.
- `@act-spec/component-react` — PRD-301 React binding.
- `@act-spec/component-vue` — PRD-302 Vue binding.
- `@act-spec/component-angular` — PRD-303 Angular binding.
- `@act-spec/generator-core` — PRD-400 pipeline (extracted from
  `@act-spec/astro` per ADR-006). `runPipeline`, `emitFiles`,
  manifest assembly, NDJSON support, search-payload assembly.
- `@act-spec/astro` — PRD-401 Astro plugin.
- `@act-spec/docusaurus` — PRD-404 Docusaurus plugin (with
  `parseMode` per A2).
- `@act-spec/nextjs-static` — PRD-405 Next.js static plugin.
- `@act-spec/remix-static` — PRD-406 Remix static plugin.
- `@act-spec/nuxt` — PRD-407 Nuxt module.
- `@act-spec/eleventy` — PRD-408 Eleventy plugin (with `parseMode`
  per A10).
- `@act-spec/cli` — PRD-409 standalone CLI.
- `@act-spec/runtime-core` — PRD-500 runtime SDK contract + dispatch
  primitives.
- `@act-spec/runtime-next` — PRD-501 Next.js runtime SDK; passes the
  two-principal probe.
- `@act-spec/runtime-express` — PRD-502 Express runtime SDK; passes the
  two-principal probe.
- `@act-spec/runtime-fetch` — PRD-505 generic WHATWG-fetch handler;
  passes the two-principal probe.
- `@act-spec/inspector` — PRD-601 inspector CLI (`act-inspect`).
- `@act-spec/mcp-bridge` — PRD-602 ACT ⇄ MCP bridge (multi-mount per A4).

#### Reference example builds

Each example builds clean and the PRD-600 validator returns `gaps: 0`
against its output. Achieved level / delivery profile in parens.

- `examples/700-tinybox/` — PRD-700 minimal Astro docs site
  (Standard / static).
- `examples/701-large-docs-docusaurus/` — PRD-701 large Docusaurus docs
  site (Standard / static; 383 nodes; 7 subtrees).
- `examples/702-corporate-marketing-nextjs/` — PRD-702 corporate
  marketing site (Plus / static; Next.js + Contentful + i18n + React
  component contracts; 24 nodes × 4 locales; 52 component-extracted
  marketing blocks; A1 dedupe asserted).
- `examples/704-ecommerce-catalog/` — PRD-704 e-commerce catalog
  (Standard / static; programmatic adapter; 500 product nodes + root
  subtree).
- `examples/705-saas-workspace-runtime/` — PRD-705 B2B SaaS workspace
  (Standard / runtime; PRD-501 + PRD-208; full two-principal probe).
- `examples/706-hybrid-static-runtime-mcp/` — PRD-706 hybrid build
  (PRD-409 CLI + PRD-501 runtime + PRD-602 MCP bridge; byte-equality
  determinism asserted under PRD-706-R16; in-script
  `manifest.generated_at` overwrite per A19 conservative interpretation).
- `examples/707-eleventy-blog/` — PRD-707 Eleventy blog (Standard /
  static; first-party TS counterpart to spec-only PRD-703 Hugo).

(`examples/703-*` is intentionally absent: PRD-703 Hugo ships as spec
text only per Q3.)

#### Architectural Decision Records

All ADRs are at status **Accepted**:

- **ADR-001** — Monorepo layout (pnpm workspaces, packages + examples
  + apps).
- **ADR-002** — Validation library: Ajv 8 over hand-rolled / zod.
- **ADR-003** — Adapter framework + generator pipeline placement and
  library choices.
- **ADR-004** — Vertical slice retro (Phase 6.1 G2 close).
- **ADR-005** — Extract `@act-spec/adapter-framework` from
  `@act-spec/markdown-adapter` (PRD-200).
- **ADR-006** — Extract `@act-spec/generator-core` from
  `@act-spec/astro` (PRD-400).

#### Tooling, governance, and process

- **CHANGELOG.md** (this file).
- **LICENSE** (Apache-2.0) for code; **LICENSE-spec** (CC BY 4.0) for
  spec text. Per Q4. Per-package `LICENSE` files reference the root.
- **RELEASE_NOTES.md** — v0.1 release narrative, scope, posture.
- **docs/v0.1-preflight.md** — Phase 7 ship pre-flight checklist with
  per-item evidence and the READY-TO-SHIP verdict.
- **docs/team-blueprint.md**, **docs/workflow.md** — implementation
  governance from Phases 5–7.
- **docs/amendments-queue.md** — open + closed PRD amendment ledger.
- Hosted client-side validator SPA in `apps/validator-web/` (per Q8
  Option 3) — landing in parallel under a sibling commit; deploys to
  GitHub Pages.

### Changed

The following amendments closed during Phase 6.1–6.3 implementation
land as edits to Accepted PRDs. Each is a trivial-inline clarification
or a semantic-additive MINOR bump per PRD-108-R4. None changed the
wire format's normative shape.

- **A1 (CLOSED 2026-05-02).** PRD-200 dedupe rule for
  `metadata.translations` array merge — implemented in
  `mergeContributions`; PRD-702 conformance asserts the dedupe
  invariant.
- **A2 (CLOSED 2026-05-02).** PRD-404 `parseMode` wiring for
  Docusaurus — semantic-additive MINOR per PRD-108-R4(1).
- **A3 (CLOSED 2026-05-02).** PRD-208 `data` block schema validation
  under `validate: "before-emit"`.
- **A4 (CLOSED 2026-05-02).** PRD-602 bridge construction shape for
  hybrid (multi-mount) trees.
- **A8 (CLOSED 2026-05-02).** PRD-700-R4 vs PRD-201-R23 — coarse-mode
  adapter level mismatch resolved via `conformanceTarget` semantics.
- **A9 (CLOSED 2026-05-02).** Validator level-inference semantics —
  `probeCapabilityBand` strict reading of PRD-107-R6/R8/R10 +
  PRD-600-R18.
- **A10 / A11 / A12 (CLOSED 2026-05-02).** Sibling-sweep parseMode
  amendments for PRD-408 (Eleventy), PRD-402 (Hugo, spec-only),
  PRD-403 (MkDocs, spec-only). All MINOR additive.
- **A13 / A14 (CLOSED 2026-05-02).** PRD-503 (FastAPI) and PRD-504
  (Rails) parseMode-equivalent review — N/A; closed without spec edit.

### Deprecated

- **PRD-603 — Embeddings sidecar.** Deferred to v0.2; not implemented
  in v0.1. Out-of-scope rationale captured in `prd/000-INDEX.md` and
  the v0.1 draft §5.9.

### Known limitations / Open follow-ups for v0.2

The following amendments remain **Open** at ship; each carries a
documented conservative interpretation that keeps v0.1 conformance and
implementations green. None blocks the v0.1 release.

- **A5** — `node.related` shape ambiguity between PRD-100 and
  PRD-102. Schemas and fixtures align with PRD-102's
  `[{id, relation}]` form; PRD-100 inline schema text to be aligned at
  G3 amendment triage.
- **A6** — Variant ID grammar in PRD-100 vs PRD-102. Schemas accept
  the extended `^[a-z0-9]([a-z0-9._\-]|/)*[a-z0-9](@[a-z0-9-]+)?$`
  pattern; PRD-100-R10 text to be aligned at G3.
- **A7** — Top-level `etag` shape on index / subtree envelopes.
  Validator's conservative reading: strict admit-list applies to per-
  node and per-NDJSON-line ETags only. Coordinated PRD-103 + schema
  + fixture amendment deferred.
- **A15** — PRD-301-R20 capability matrix vs v0.1 React binding's
  shipped surface. Trivial-inline qualification accepted; binding
  truthfully publishes false on `streaming` / `suspense` /
  `static-ast` / `headless-render` until follow-up implementation
  milestones land (each a MINOR bump per PRD-108-R4(5)).
- **A16** — PRD-707-R11 `urlTemplates` snake_case vs camelCase API.
  Trivial-inline; the example uses the camelCase `EleventyActOptions`
  shape consistent with PRD-700.
- **A17** — PRD-404-R6 sidebar synthesis not auto-applied inside
  `runActBuild`. PRD-701 example composes the building-block exports
  manually; framework-side wiring lands in v0.2.
- **A18** — PRD-704 file-set paths, framework tokenizer gap,
  `related[]` shape vs A5 schema, and `summarySource` capability slip.
  All four worked around inline in PRD-704; trivial-inline cluster
  scheduled for G3.
- **A19** — PRD-409 / PRD-400 `manifest.generated_at` is wall-clock-
  derived in `runPipeline`. PRD-706 worked around in-script with a
  fixed ISO timestamp; framework-side `GeneratorConfig.generatedAt`
  follow-up is a MINOR additive change for v0.2.
- **A20** — PRD-104-R6 / PRD-400 per-locale manifest fan-out
  (Pattern 2) not implemented in `runPipeline`. PRD-702 ships
  Pattern 1 (locale-prefixed IDs in one manifest); MINOR additive
  `GeneratorConfig.i18n.pattern` follow-up scheduled for v0.2.
- **A21** — PRD-200-R13 / PRD-400 `metadata.source.contributors`
  not synthesized by `mergeContributions`. PRD-702 carries inline
  post-merge synthesis; framework-side step is a MINOR additive
  change for v0.2.

[0.1.0]: https://github.com/act-spec/act/releases/tag/v0.1.0
