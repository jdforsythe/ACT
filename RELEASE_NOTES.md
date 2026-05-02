# ACT v0.1: spec, validator, adapters, generators, runtime SDKs, examples

**Release date:** 2026-05-02
**Status:** READY-TO-SHIP (pending BDFL git tag + npm publish)
**Spec version:** `act_version: "0.1.0"`
**License — code:** Apache-2.0 — **License — spec text:** CC BY 4.0

ACT (Agent Content Tree) is an open standard for agent-friendly content
delivery: a stable, cacheable, conformance-graded wire format that lets
LLM-driven agents discover, walk, and reason over a website's structured
content without screen-scraping HTML. v0.1 ships the full spec, a
TypeScript reference implementation across every layer (adapters,
component contracts, generators, runtime SDKs, tooling), seven worked
example builds, and a hosted client-side validator.

## What ships

### The spec

- **57 PRDs accepted** across the 000-, 100-, 200-, 300-, 400-, 500-,
  600-, 700-, and 800-series. PRD-603 (embeddings sidecar) is
  deprecated for v0.1; deferred to v0.2.
- **JSON Schemas** under `schemas/100/` for every wire-format envelope.
- **Conformance fixtures** (positive + negative) under `fixtures/`
  driving the validator and binding gates.

### Reference implementation (TypeScript)

Per Q3, v0.1 ships first-party reference implementations in TypeScript
only. PRD-402 (Hugo), PRD-403 (MkDocs), PRD-503 (FastAPI), PRD-504
(Rails), and PRD-703 (Hugo blog example) are spec-only; community
ports are invited.

#### Packages (29 total, all conformance-gated)

- **Core / contract.** `@act-spec/core`, `@act-spec/component-contract`
  (PRD-300), `@act-spec/runtime-core` (PRD-500), `@act-spec/adapter-framework`
  (PRD-200), `@act-spec/generator-core` (PRD-400).
- **Validators / tooling.** `@act-spec/validator` (PRD-600 library +
  CLI), `@act-spec/inspector` (PRD-601 CLI), `@act-spec/mcp-bridge`
  (PRD-602).
- **Adapters.** `@act-spec/markdown-adapter` (PRD-201),
  `@act-spec/contentful-adapter` (PRD-202), `@act-spec/sanity-adapter`
  (PRD-203), `@act-spec/storyblok-adapter` (PRD-204),
  `@act-spec/strapi-adapter` (PRD-205), `@act-spec/builder-adapter`
  (PRD-206), `@act-spec/i18n-adapter` (PRD-207),
  `@act-spec/programmatic-adapter` (PRD-208).
- **Component bindings.** `@act-spec/component-react` (PRD-301),
  `@act-spec/component-vue` (PRD-302), `@act-spec/component-angular`
  (PRD-303).
- **Generators.** `@act-spec/astro` (PRD-401), `@act-spec/docusaurus`
  (PRD-404), `@act-spec/nextjs-static` (PRD-405),
  `@act-spec/remix-static` (PRD-406), `@act-spec/nuxt` (PRD-407),
  `@act-spec/eleventy` (PRD-408), `@act-spec/cli` (PRD-409).
- **Runtime SDKs.** `@act-spec/runtime-next` (PRD-501),
  `@act-spec/runtime-express` (PRD-502), `@act-spec/runtime-fetch`
  (PRD-505). Each ships with the two-principal probe wired in CI.

#### Worked examples (7 total, every one validates clean)

- **`examples/700-tinybox/`** (PRD-700) — minimal Astro docs site;
  Standard / static.
- **`examples/701-large-docs-docusaurus/`** (PRD-701) — Docusaurus at
  scale; Standard / static; 383 nodes; 7 subtrees.
- **`examples/702-corporate-marketing-nextjs/`** (PRD-702) — Plus-band
  Next.js + Contentful + i18n + React contracts; 24 nodes × 4 locales;
  52 component-extracted marketing blocks; A1 dedupe asserted.
- **`examples/704-ecommerce-catalog/`** (PRD-704) — programmatic
  adapter, 500 product nodes; Standard / static.
- **`examples/705-saas-workspace-runtime/`** (PRD-705) — runtime
  SDK with the full PRD-109 two-principal probe (cross-tenant 404
  byte-equivalence, ETag tenant-scope holds).
- **`examples/706-hybrid-static-runtime-mcp/`** (PRD-706) — hybrid
  static + runtime + MCP bridge; build-determinism asserted under
  PRD-706-R16.
- **`examples/707-eleventy-blog/`** (PRD-707) — Eleventy blog;
  Standard / static; first-party TS counterpart to spec-only PRD-703.

### Hosted validator (Q8 Option 3)

A client-side single-page application — `apps/validator-web/` — wraps
`@act-spec/validator` for browser consumption and deploys to GitHub
Pages alongside the spec site. **Hosted URL:** _TBD — pinned at the
GitHub Pages deploy in the BDFL's tag step._

## Key decisions (recap)

- **Q1 — Governance:** BDFL model. Jeremy Forsythe is the sole
  maintainer for v0.1. PRDs require BDFL acceptance; amendments route
  through `docs/amendments-queue.md`.
- **Q3 — Reference language:** TypeScript only for v0.1 first-party
  implementations. Hugo / MkDocs / FastAPI / Rails ship as spec only.
- **Q4 — License:** Apache-2.0 for reference code; CC BY 4.0 for spec
  text. Per-package `LICENSE` files reference the root.
- **Q8 — Validator hosting:** Option 3 — hosted client-side SPA on
  GitHub Pages. Same code as the library; no server.

## Conformance posture (per PRD-107)

ACT defines three conformance levels — **Core**, **Standard**, **Plus**
— each a strict superset of the previous. PRD-600's reporter publishes
both `declared.level` and `achieved.level` per build; a build passes
when `achieved >= declared` and `gaps: []`.

The v0.1 reference implementations span the full band:

- **Core only.** `@act-spec/cli`, `@act-spec/astro` (default),
  `@act-spec/nextjs-static` (default), `@act-spec/nuxt`,
  `@act-spec/remix-static` — minimal manifest + index + nodes.
- **Standard.** PRD-700, PRD-701, PRD-704, PRD-705, PRD-707 — adds
  subtrees, search payload, llms.txt linkage, locale block.
- **Plus.** PRD-702, PRD-706 — adds NDJSON streaming index, search
  payload at scale, MCP bridge enumeration parity.

## Known limitations / v0.2 candidates

The following amendments remain **Open** at ship; each carries a
documented conservative interpretation that keeps every v0.1 conformance
gate green. None blocks the release.

- **A5 / A6 / A7** — wire-format clarifications. Schemas + fixtures are
  the source of truth; PRD-100 inline text alignment lands at the next
  G3 amendment triage.
- **A15** — PRD-301-R20 capability matrix qualification. React binding
  ships truthful `false` flags; subsequent capability flips are MINOR
  per PRD-108-R4(5).
- **A16** — PRD-707-R11 snake_case vs camelCase typo in the docs
  snippet. Trivial.
- **A17** — PRD-404-R6 sidebar synthesis auto-wiring inside
  `runActBuild`. PRD-701 composes manually; framework-side wiring is a
  v0.2 polish.
- **A18** — PRD-704 cluster (file-set paths, framework tokenizer,
  `related[]` shape per A5, `summarySource` capability slip). All
  worked around inline.
- **A19** — `manifest.generated_at` determinism. PRD-706 worked around
  with a fixed ISO timestamp; v0.2 adds
  `GeneratorConfig.generatedAt` (additive, MINOR).
- **A20** — PRD-104-R6 Pattern 2 per-locale manifest fan-out. PRD-702
  ships Pattern 1; v0.2 adds `GeneratorConfig.i18n.pattern` (additive,
  MINOR).
- **A21** — `metadata.source.contributors` synthesis in
  `mergeContributions`. PRD-702 carries the synthesis inline; v0.2
  lifts it into the framework (additive, MINOR).

A consolidated v0.2 backlog will fork from `master` once v0.1 is
tagged.

## Acknowledgments and governance

- **BDFL:** Jeremy Forsythe (`jdforsythe@gmail.com`). Sole maintainer
  for v0.1 per Q1.
- **Implementation team (Phase 6):** Spec Steward, Lead TypeScript
  Engineer, Adapter & Generator Engineer, Runtime & Tooling Engineer,
  QA / Conformance Verifier — agent personas under `.claude/agents/`,
  driven by Forge.
- **Spec authoring:** Hand-authored by the BDFL across Phases 0–4 with
  Claude as drafting partner.

## What's next

- v0.2 picks up the open amendments above plus the Tier-F items from
  `prd/000-gaps-and-resolutions.md` (signed manifests, dataset-as-
  first-class node type, streaming change-feed runtime endpoints,
  per-node `agents only` flags).
- Community ports (Hugo, MkDocs, FastAPI, Rails) are invited per the
  spec-only PRDs already Accepted.
- The crawler / agent posture documented in PRD-800 is the contract
  with the consumer side; PRD-801 is the migration playbook for sites
  moving from llms.txt / sitemap-only / MCP-only.

## Resources

- **Specification:** `prd/` (this repo). Index at `prd/000-INDEX.md`.
- **Workflow:** `docs/workflow.md`.
- **ADRs:** `docs/adr/`.
- **Pre-flight report:** `docs/v0.1-preflight.md`.
- **Hosted validator (TBD):** GitHub Pages deploy URL pinned at tag.
- **Repository:** https://github.com/act-spec/act
