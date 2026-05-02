# ACT PRD Index

**Status:** Draft (planning)
**Owner:** Jeremy Forsythe (BDFL; see [000-decisions-needed.md](./000-decisions-needed.md), Q1)
**Last updated:** 2026-05-02 (P3 promoted to Accepted; Phase 4 closed)

This is the master index for the ACT (Agent Content Tree) PRD set. It defines the full taxonomy of PRDs, their dependencies, their authoring order, and what "done" looks like for each.

The canonical v0.1 working draft lives at `docs/plan/v0.1-draft.md`. PRDs in this set normatively supersede the draft once they reach **Accepted** status. Until then, the draft is the source of truth and PRDs cite it as `draft §X.Y`.

## How to read this index

- **Series** (000, 100, 200, …) groups PRDs by concern. The numbering separates change domains: a runtime auth tweak touches PRD-106 + the 500-series, but never the wire format (100-series) or any source adapter (200-series).
- **Status** of each PRD is one of: Draft / In review / Accepted / Implemented / Deprecated. The qualifier **"(spec only)"** means the spec text will be written but no first-party reference implementation ships in v0.1 (community ports invited). See decision Q3.
- **Depends on / Blocks** captures the authoring DAG. Authors should read all "Depends on" PRDs before starting.
- **Size** is a rough estimate of authoring effort: S (≤ 1 day), M (1–3 days), L (3–7 days), XL (multi-week).
- **Phase** is the recommended authoring batch (P0–P3).

## How to author a PRD

1. Confirm the PRD ID is reserved in this index. If you need a new PRD, add a row here first.
2. Read `000-template.md` and copy it to `NNN-slug.md`.
3. Read every PRD listed under "Depends on" and the cited draft sections.
4. Resolve all open questions before moving from Draft → In review. If a question requires a strategic call, add it to `000-decisions-needed.md` rather than guess.
5. Update Status here when the PRD changes state.

## Series overview

| Series | Theme | Count | Phase |
|---|---|---|---|
| 000 | Meta — index, gaps, template, decisions, governance | 5 | P0 |
| 100 | The standard — wire format and core semantics | 9 | P1 |
| 200 | Source-adapter framework + reference adapters | 9 | P2 |
| 300 | Component instrumentation contract + framework bindings | 4 | P2 |
| 400 | Generators (build-tool integrations) | 9 | P2 |
| 500 | Runtime SDK (per framework) | 6 | P2 |
| 600 | Tooling (validators, inspectors, bridges) | 4 | P2 |
| 700 | Reference example builds | 8 | P3 |
| 800 | Adoption & ecosystem | 4 | P3 |
| **Total** | | **58** | |

## Phasing

**P0 — Foundations (must land before any series-10+ PRD writing starts).**
Meta artifacts plus the two PRDs that pin what every other PRD must satisfy: PRD-107 (conformance levels) and PRD-108 (versioning policy). Without these, every other PRD has to relitigate "is this MUST or SHOULD" and "does adding this field break compat."

**P1 — The standard (100-series).**
The wire format and core semantics. Everything downstream is an implementation of this. P1 must be **Accepted** before P2 PRDs leave Draft.

**P2 — Producers, consumers, tools.**
20-, 30-, 40-, 50-, 600-series, in dependency order. The 200-series framework PRD (PRD-200) and the 300-series contract PRD (PRD-300) gate their respective branches. Generators (40) depend on adapters (20) + components (30). Runtime SDK (50) depends on PRD-106 only. Tools (60) depend on the 100-series.

**P3 — Examples and ecosystem.**
700-series reference builds exercise the spec end-to-end and surface bugs. 800-series captures the parts of "shipping ACT into the world" that aren't a wire format: crawler/agent expectations, migration paths, RFC process, naming.

## 000-series — Meta

| ID | Title | Status | Depends on | Blocks | Size | Phase |
|---|---|---|---|---|---|---|
| 000-INDEX | This document | Draft | — | All | S | P0 |
| 000-template | PRD template | Draft | — | All | S | P0 |
| 000-gaps-and-resolutions | Gap analysis with proposed resolutions | Draft | — | 100-, 200-, 300-, 500- | M | P0 |
| 000-decisions-needed | Strategic decisions awaiting input | Draft | — | varies | S | P0 |
| 000-governance | RFC process, change control, deprecation policy | Accepted | Q1 (decided) | 108, 802 | M | P0 |

## 100-series — The standard

The normative wire format. These PRDs collectively define what "an ACT-conformant feed" means. They MUST be internally consistent; conflicts between them are bugs.

The **Impl status** column tracks Phase 6 implementation per `docs/workflow.md` §"Status tracking". `Implemented` = the PRD's reference implementation has shipped and passes the PRD-600 conformance gate. `Not started` = no leaf package owns it yet. Wire-format PRDs are `Spec-only`: they have no leaf package of their own — they are *enforced* by the PRD-600 validator. Marking them `Implemented (via PRD-600)` would double-count; the column reads `Spec-only` for all 100-series PRDs.

| ID | Title | Status | Impl status | Depends on | Blocks | Size | Phase |
|---|---|---|---|---|---|---|---|
| PRD-100 | Wire format & envelope shapes (manifest, index, node, subtree) | Accepted | Spec-only — enforced by PRD-600 | 107, 108 | 101–109, 200, 500 | XL | P1 |
| PRD-101 | Discovery (well-known location, llms.txt linkage, runtime hand-off) | Accepted | Spec-only — enforced by PRD-600 | 100 | 200, 500 | M | P1 |
| PRD-102 | Content blocks (markdown, prose, code, data, marketing:* namespace) | Accepted | Spec-only — enforced by PRD-600 | 100 | 200, 300 | L | P1 |
| PRD-103 | Caching, ETags, validators (static + runtime) | Accepted | Spec-only — enforced by PRD-600 | 100 | 106, 500 | M | P1 |
| PRD-104 | Internationalization (locale model, cross-locale refs, untranslated keys) | Accepted | Spec-only — enforced by PRD-600 (i18n probes deferred to PRD-200) | 100, 102 | 207 | L | P1 |
| PRD-105 | Static delivery profile (build-time files, CDN expectations) | Accepted | Spec-only — enforced by PRD-600 (file-set probe via walkStatic) | 100, 103 | 400 | M | P1 |
| PRD-106 | Runtime delivery profile (HTTP endpoints, auth, hybrid mounts) | Accepted | Spec-only — enforced by PRD-600 (HTTP probes via validateSite) | 100, 103, 109 | 500 | L | P1 |
| PRD-107 | Conformance levels (Core / Standard / Plus) and reporting | Accepted | Spec-only — reporter shape implemented by PRD-600 | — | 100, 600 | M | P0 |
| PRD-108 | Versioning policy (semver of `act_version`, MAJOR/MINOR rules) | Accepted | Spec-only — enforced by PRD-600 (act_version regex) | — | 100, 802 | S | P0 |
| PRD-109 | Security considerations (PII, scoping, auth boundaries, ETag determinism) | Accepted | Spec-only — enforced by PRD-600 (auth probe + ETag determinism prober) | 100, 106 | 106, 500 | M | P1 |

## 200-series — Source adapters

The adapter framework plus six reference adapters that exercise it. The framework PRD (PRD-200) defines the shared contract; the rest are implementations.

| ID | Title | Status | Impl status | Depends on | Blocks | Size | Phase |
|---|---|---|---|---|---|---|---|
| PRD-200 | Adapter framework (contract, lifecycle, multi-source merging) | Accepted | Implemented (via @act-spec/markdown-adapter; framework code per ADR-003) | 100, 102 | 201–208 | L | P2 |
| PRD-201 | Markdown / MDX adapter | Accepted | Implemented (@act-spec/markdown-adapter) | 200 | 400, 700, 701, 703 | M | P2 |
| PRD-202 | Contentful adapter | Accepted | Implemented (@act-spec/contentful-adapter) | 200 | 702 | L | P2 |
| PRD-203 | Sanity adapter | Accepted | Implemented (@act-spec/sanity-adapter) | 200 | — | L | P2 |
| PRD-204 | Storyblok adapter | Accepted | Implemented (@act-spec/storyblok-adapter) | 200 | — | L | P2 |
| PRD-205 | Strapi adapter | Accepted | Implemented (@act-spec/strapi-adapter) | 200 | — | M | P2 |
| PRD-206 | Builder.io adapter | Accepted | Implemented (@act-spec/builder-adapter) | 200 | — | M | P2 |
| PRD-207 | i18n adapter (next-intl, react-intl, i18next) | Accepted | Implemented (@act-spec/i18n-adapter) | 104, 200 | 702 | L | P2 |
| PRD-208 | Programmatic adapter (escape hatch) | Accepted | Implemented (@act-spec/programmatic-adapter) | 200 | 705 | S | P2 |

## 300-series — Component instrumentation

The component contract that lets ACT extract structured content from component-driven sites. PRD-300 defines the contract; the rest are framework bindings.

| ID | Title | Status | Impl status | Depends on | Blocks | Size | Phase |
|---|---|---|---|---|---|---|---|
| PRD-300 | Component contract (declaration patterns, page-level contracts, variant handling) | Accepted | Implemented (@act-spec/component-contract) | 100, 102 | 301, 302, 303, 400 | XL | P2 |
| PRD-301 | React binding | Accepted | Implemented (@act-spec/component-react) | 300 | 401, 404, 405, 406 | L | P2 |
| PRD-302 | Vue binding | Accepted | Implemented (@act-spec/component-vue) | 300 | 407 | L | P2 |
| PRD-303 | Angular binding | Accepted | — | 300 | — | L | P2 |

## 400-series — Generators

Build-tool integrations that take adapter output + component contracts and emit static ACT files conforming to PRD-105.

| ID | Title | Status | Impl status | Depends on | Blocks | Size | Phase |
|---|---|---|---|---|---|---|---|
| PRD-400 | Generator architecture (shared pipeline, plugin targets) | Accepted | Implemented (via @act-spec/astro; pipeline code per ADR-003) | 105, 200, 300 | 401–409 | L | P2 |
| PRD-401 | Astro plugin | Accepted | Implemented (@act-spec/astro) | 400, 301 | 700 | M | P2 |
| PRD-402 | Hugo module | Accepted (spec only) | Spec-only — out of scope for v0.1 TS impl | 400, 201 | 703 | M | P2 |
| PRD-403 | MkDocs plugin | Accepted (spec only) | Spec-only — out of scope for v0.1 TS impl | 400, 201 | — | M | P2 |
| PRD-404 | Docusaurus plugin | Accepted | Not started | 400, 301 | 701 | M | P2 |
| PRD-405 | Next.js plugin (static export) | Accepted | Not started | 400, 301 | 702 | L | P2 |
| PRD-406 | Remix plugin (static export) | Accepted | Not started | 400, 301 | — | L | P2 |
| PRD-407 | Nuxt module | Accepted | Not started | 400, 302 | — | L | P2 |
| PRD-408 | Eleventy plugin | Accepted | Not started | 400, 201 | — | M | P2 |
| PRD-409 | Standalone CLI (no framework) | Accepted | Not started | 400 | 706 | M | P2 |

## 500-series — Runtime SDK

Per-framework bindings that turn an existing app into a runtime ACT server conforming to PRD-106.

| ID | Title | Status | Impl status | Depends on | Blocks | Size | Phase |
|---|---|---|---|---|---|---|---|
| PRD-500 | Runtime SDK contract (resolver shape, capability negotiation) | Accepted | Implemented (@act-spec/runtime-core) | 106, 109 | 501–505 | L | P2 |
| PRD-501 | Next.js runtime SDK | Accepted | Implemented (@act-spec/runtime-next) | 500 | 705, 706 | M | P2 |
| PRD-502 | Express runtime SDK | Accepted | Implemented (@act-spec/runtime-express) | 500 | — | M | P2 |
| PRD-503 | FastAPI runtime SDK | Accepted (spec only) | Not implemented (Q3 — TS only in v0.1) | 500 | — | M | P2 |
| PRD-504 | Rails runtime SDK | Accepted (spec only) | Not implemented (Q3 — TS only in v0.1) | 500 | — | M | P2 |
| PRD-505 | Generic WHATWG-fetch handler | Accepted | Implemented (@act-spec/runtime-fetch) | 500 | — | S | P2 |

## 600-series — Tooling

Validators, inspectors, and bridges to other ecosystems.

| ID | Title | Status | Impl status | Depends on | Blocks | Size | Phase |
|---|---|---|---|---|---|---|---|
| PRD-600 | Validator (TS library + client-side hosted page; level reporting; conformance test harness CLI mode) | Accepted | Implemented (`@act-spec/validator` v0.0.0; vertical-slice library + CLI; SPA pending PRD-700-series) | 100, 107 | 700–707 | L | P2 |
| PRD-601 | Inspector CLI (fetch, walk, diff, token-budget what-ifs) | Accepted | Implemented (`@act-spec/inspector`) | 100 | — | M | P2 |
| PRD-602 | ACT-MCP bridge (paired server exposing same tree as both) | Accepted | Implemented (`@act-spec/mcp-bridge`) | 100, 106 | 706 | L | P2 |
| PRD-603 | Embeddings sidecar (deferred to v0.2) | Deprecated for v0.1 | — | — | — | — | — |

## 700-series — Reference example builds

End-to-end builds that exercise the spec and serve as adoption templates. Each example MUST validate clean against PRD-600.

| ID | Title | Status | Impl status | Depends on | Blocks | Size | Phase |
|---|---|---|---|---|---|---|---|
| PRD-700 | Minimal documentation site (Astro + markdown) | Accepted | Implemented (`examples/700-tinybox/`) | 401, 201, 600 | — | M | P3 |
| PRD-701 | Large documentation site (Docusaurus + markdown) | Accepted | Not started | 404, 201, 600 | — | M | P3 |
| PRD-702 | Corporate marketing site (Next.js + Contentful + i18n) | Accepted | Not started | 405, 202, 207, 301, 600 | — | L | P3 |
| PRD-703 | Blog (Hugo + markdown) | Accepted (spec only) | Spec-only — out of scope for v0.1 TS impl | 402, 201, 600 | — | S | P3 |
| PRD-704 | E-commerce catalog (programmatic adapter) | Accepted | Not started | 208, 600 | — | L | P3 |
| PRD-705 | B2B SaaS workspace (runtime ACT, Next.js) | Accepted | Implemented (examples/705-saas-workspace-runtime) | 501, 208, 109, 600 | — | L | P3 |
| PRD-706 | Hybrid static + runtime + MCP bridge | Accepted | Not started | 409, 501, 602, 600 | — | XL | P3 |
| PRD-707 | Blog (Eleventy + markdown) — TS-impl counterpart to PRD-703 | Accepted | Not started | 408, 201, 600 | — | S | P3 |

## 800-series — Adoption & ecosystem

The non-wire-format parts of shipping ACT into the world.

| ID | Title | Status | Depends on | Blocks | Size | Phase |
|---|---|---|---|---|---|---|
| PRD-800 | Crawler & agent behavior (rate limits, robots.txt interaction, identification) | Accepted | 100, 109 | — | M | P3 |
| PRD-801 | Migration playbook (from llms.txt; from sitemap-only; from MCP-only) | Accepted | 100, 101 | — | M | P3 |
| PRD-802 | RFC / change-control process | Accepted | 108, 000-governance | — | M | P3 |
| PRD-803 | Naming policy (ACT mark, generator name conventions, MIME types) | Accepted | 000-decisions-needed Q2 | — | S | P3 |

## Authoring order (recommended)

Within each phase, follow this order:

**P0:** 000-template → 000-gaps-and-resolutions → 000-decisions-needed → PRD-108 → PRD-107 → 000-governance.

**P1:** PRD-100 → PRD-101 → PRD-102 → PRD-103 → PRD-109 → PRD-105 → PRD-106 → PRD-104. (PRD-104 last because it touches manifest, index, and node shapes that must stabilize first.)

**P2 (parallel branches):**
- Adapters branch: PRD-200 → 201, 202, 207 → 203, 204, 205, 206, 208.
- Components branch: PRD-300 → 301 → 302, 303.
- Generators branch: PRD-400 → 401, 402, 403, 404 → 405, 406, 407, 408, 409.
- Runtime branch: PRD-500 → 501, 502, 503, 504, 505.
- Tooling branch: PRD-600, 601, 602 (any order after their deps).

Hold each branch open for cross-pollination — issues found in 201 (markdown adapter) often surface holes in PRD-200 (framework). Expect to amend P1 PRDs as P2 implementation work uncovers gaps; that's a feature of the staged approach, not a bug.

**P3:** Examples first (700–707) to expose end-to-end issues; ecosystem (800–803) last because they describe the post-launch posture.

## Out of scope for v0.1 (do not write PRDs yet)

- PRD-603 — embeddings sidecar (deferred per draft §5.9 and decision matrix).
- Streaming / change-feed runtime endpoints (deferred per draft §5.13.6 and §10 Q15).
- Signed manifests / provenance (draft §10 Q4 — wait for trust-layer winners).
- Dataset-as-first-class node type (draft §10 Q13 — revisit in v0.2).
- Per-node "agents only" / "no train" flags (draft §10 Q14 — defer to robots.txt + Content-Signal).

If any of these become P0 for an external reason, add a PRD row here first and update the status table.
