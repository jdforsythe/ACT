# PRD-00 — ACT PRD Index

**Status:** Living document — updated as PRDs are authored, accepted, and implemented.
**Last updated:** 2026-05-01

This is the master catalog of every PRD in the ACT (Agent Content Tree) project. Every PRD that will be authored is listed below with its current status, scope, dependencies, sizing, and authoring phase.

## How to use this index

1. Read this file end-to-end once.
2. Pick the next PRD whose status is **Unauthored** and whose dependencies are **Accepted**.
3. Run the authoring loop in `prd/00-workflow.md` (W-02 → W-05).
4. On Accept, flip the status field below and commit.

This index is the single source of truth for "what's been done, what's next, and what's blocked."

## Status legend

- **Unauthored** — no draft exists yet.
- **In progress** — actively being drafted.
- **Draft** — first complete pass, not yet reviewed.
- **In review** — verifier and reviewer agents are running.
- **Accepted** — passed review; downstream PRDs can depend on it.
- **Implemented** — code shipped; conformance fixtures green; coverage budget met.
- **Deprecated** — superseded by another PRD; retained for history.

## Series overview

| Series | Theme | Count | Notes |
|---|---|---|---|
| 00 | Meta — index, gaps, template, decisions, workflow | 5 | Authored as part of the planning round. |
| 10 | Standard — wire format and core semantics | 10 | The spec proper. P1 work. |
| 20 | Source adapters | 9 | Framework + 8 reference adapters. |
| 30 | Component instrumentation | 4 | Contract + per-framework bindings. |
| 40 | Generators | 10 | Architecture + 9 build-tool integrations. |
| 50 | Runtime SDK | 6 | SDK contract + 5 per-framework SDKs. |
| 60 | Tooling | 4 | Validators, inspectors, ACT-MCP bridge, embeddings (deferred). |
| 70 | Reference example builds | 7 | One per archetype: minimal docs, large docs, marketing, blog, e-commerce, SaaS, hybrid. |
| 80 | Adoption & ecosystem | 4 | Crawler guidance, migration, governance, naming. |
| **Total** | | **57** | |

## Phase plan

### P0 — Foundation

**Scope:** all 00-series meta artifacts, plus PRD-17 (conformance levels) and PRD-18 (versioning policy).

**Why first:** these define the rules every other PRD must satisfy. Conformance level is referenced in every PRD's status block; versioning policy governs every change to every PRD.

**Unblocks:** all P1 work.

**Expected duration:** 1–2 weeks.

**Parallelism:** 5 meta PRDs are written concurrently (already underway). PRD-17 and PRD-18 can start once meta artifacts land.

### P1 — The standard

**Scope:** 10-series (PRDs 10–19, minus 17 and 18 already in P0).

**Why next:** the wire format and core semantics must be settled before any producer (adapter, generator) or consumer (SDK, agent) can be specified.

**Unblocks:** all P2 work.

**Expected duration:** 4–6 weeks.

**Parallelism:** moderate. PRD-10 (wire format) is the trunk; PRDs 11–16 and 19 can fork off it. Authors can split: one on wire/discovery (10/11), one on blocks/caching (12/13), one on i18n (14), one on profiles (15/16), one on security (19).

### P2 — Producers and consumers

**Scope:** 20-, 30-, 40-, 50-, 60-series (28 PRDs).

**Why next:** with the standard pinned, every adapter, generator, runtime SDK, and tool can be specified independently against it.

**Unblocks:** all P3 work.

**Expected duration:** 8–14 weeks.

**Parallelism:** heavy. Adapter PRDs (20-series) are independent of each other once PRD-20 is Accepted. Generator PRDs (40-series) are independent of each other once PRD-40 is Accepted. Runtime SDK PRDs (50-series) are independent of each other once PRD-50 is Accepted. Realistic: 3–4 PRDs in flight simultaneously.

### P3 — Examples and ecosystem

**Scope:** 70-series (reference example builds) and 80-series (adoption, governance, naming).

**Why last:** examples are validation that the spec actually works on real surface area. Ecosystem PRDs codify how the spec evolves post-v0.1.

**Expected duration:** 4–8 weeks.

**Parallelism:** very heavy. Each example is independent. Governance and naming can run in parallel with examples.

## The PRD list

Sizing legend: **S** <500 lines, **M** 500–1500, **L** 1500–3500, **XL** >3500.

### 00 Meta

| ID | Title | Status | Size | Depends on | Blocks | Phase | Scope |
|---|---|---|---|---|---|---|---|
| PRD-00 | PRD index (this file) | In progress | M | — | All PRDs | P0 | Master catalog of every PRD with status, dependencies, sizing. |
| PRD-01 | Gap analysis (`00-gaps-and-resolutions.md`) | In progress | L | — | All PRDs | P0 | Resolutions for ~30 unresolved questions from the v0.1 draft, organized by tier. |
| PRD-02 | PRD template (`00-template.md`) | Accepted | S | ADR-0001 | All PRDs | P0 | Canonical hybrid PRD template every numbered PRD follows. |
| PRD-03 | Strategic decisions log (`00-decisions-needed.md`) | In progress | M | ADR-0003 | PRDs gated by D-NN decisions | P0 | 12+ strategic questions only the spec owner can answer. |
| PRD-04 | Workflow (`00-workflow.md`) | In progress | L | — | Implementation phase | P0 | Lifecycle stages, ADR process, PRD authoring loop, mission-planner integration, TDD strategy, 14 copy-paste prompts. |

### 10 Standard

| ID | Title | Status | Size | Depends on | Blocks | Phase | Scope |
|---|---|---|---|---|---|---|---|
| PRD-10 | Wire format core | Unauthored | XL | PRD-17, PRD-18 | All other PRDs | P1 | Manifest, index, node, subtree envelopes; common fields; ID grammar; ETag rules; tokenizer registry. |
| PRD-11 | Discovery & manifest | Unauthored | M | PRD-10 | PRD-15, PRD-16 | P1 | `.well-known/act.json`, `llms.txt` cross-reference, runtime discovery via Link header + meta tag. |
| PRD-12 | Content blocks | Unauthored | L | PRD-10 | PRDs 21–28, 30, 31–33 | P1 | Block types (prose, code, table, image, video, callout, reference, quote, qa, data, custom); marketing:* namespace; per-block JSON Schemas. |
| PRD-13 | Caching & ETags | Unauthored | M | PRD-10 | PRD-15, PRD-16, PRD-50 | P1 | Deterministic ETag derivation, HTTP semantics, If-None-Match, Vary, replica-stable hashing. |
| PRD-14 | Internationalization | Unauthored | L | PRD-10, PRD-12 | PRD-27, PRD-72 | P1 | Locale model, `translation_of`, fallback chains, RTL, locale negotiation. |
| PRD-15 | Static delivery profile | Unauthored | M | PRD-10, PRD-13 | PRDs 40–49, 70–74 | P1 | File layout, NDJSON variant, subtree bundles, sitemap.xml compatibility. |
| PRD-16 | Runtime delivery profile | Unauthored | L | PRD-10, PRD-13, PRD-19 | PRDs 50–55, 75, 76 | P1 | HTTP endpoints, auth schemes, error envelope, per-tenant scoping, CORS, GET-only requirement. |
| PRD-17 | Conformance levels | Unauthored | M | — | All PRDs | P0 | Core / Standard / Plus levels; producer vs consumer requirements; capability advertisement. |
| PRD-18 | Versioning policy | Unauthored | M | — | All PRDs | P0 | Semver rules, deprecation policy, MUST tolerate unknown optional, MUST reject unknown required. |
| PRD-19 | Security model | Unauthored | L | PRD-10 | PRD-16, PRD-50, PRD-80 | P1 | Auth boundary crossing, CORS, CSRF, rate limiting, agent identification, robots/AI-pref alignment. |

### 20 Source adapters

| ID | Title | Status | Size | Depends on | Blocks | Phase | Scope |
|---|---|---|---|---|---|---|---|
| PRD-20 | Source adapter framework | Unauthored | L | PRD-10, PRD-12 | PRDs 21–28 | P2 | NodeDraft contract, init/collect/watch lifecycle, multi-source merge policies, provenance fields. |
| PRD-21 | Markdown/MDX adapter | Unauthored | M | PRD-20 | PRD-41, PRD-43, PRD-44, PRD-48, PRD-70, PRD-71, PRD-73 | P2 | `.md` and `.mdx` files; frontmatter under `act:` key; MDX JSX strip rules. |
| PRD-22 | Contentful adapter | Unauthored | M | PRD-20 | PRD-72 | P2 | Contentful Delivery API; content-type → ACT mapping; locale mapping. |
| PRD-23 | Sanity adapter | Unauthored | M | PRD-20 | — | P2 | Sanity GROQ queries; schema mapping. |
| PRD-24 | Storyblok adapter | Unauthored | M | PRD-20 | — | P2 | Storyblok CDN; component-aware (Storyblok blocks → ACT blocks). |
| PRD-25 | Strapi adapter | Unauthored | M | PRD-20 | — | P2 | Strapi REST/GraphQL; schema mapping. |
| PRD-26 | Builder.io adapter | Unauthored | M | PRD-20 | — | P2 | Builder.io spaces; visual builder integration. |
| PRD-27 | i18n adapter | Unauthored | L | PRD-20, PRD-14 | PRD-72 | P2 | next-intl, react-intl, i18next, vue-i18n, Angular i18n message catalogs. |
| PRD-28 | Programmatic adapter | Unauthored | S | PRD-20 | Custom integrations | P2 | Escape hatch: arbitrary JS/TS function returning NodeDraft[]. |

### 30 Component instrumentation

| ID | Title | Status | Size | Depends on | Blocks | Phase | Scope |
|---|---|---|---|---|---|---|---|
| PRD-30 | Component instrumentation contract | Unauthored | L | PRD-12, PRD-20 | PRDs 31–33, 45 | P2 | Three patterns (static field, hook, decorator); page-level contracts; variant handling; RSC/server-component handling. |
| PRD-31 | React component adapter | Unauthored | L | PRD-30 | PRD-45, PRD-46, PRD-72 | P2 | React-specific extraction: static analysis + render-time collection via `<ActProvider>`. |
| PRD-32 | Vue component adapter | Unauthored | M | PRD-30 | PRD-47 | P2 | Vue 3 `<script setup>` `defineActBlock`; Composition API. |
| PRD-33 | Angular component adapter | Unauthored | M | PRD-30 | — | P2 | Angular `@ActBlock` decorator; Universal SSR integration. |

### 40 Generators

| ID | Title | Status | Size | Depends on | Blocks | Phase | Scope |
|---|---|---|---|---|---|---|---|
| PRD-40 | Generator architecture | Unauthored | L | PRD-15, PRD-20 | PRDs 41–49 | P2 | Pipeline (collect → merge → normalize → tokenize → hash → emit); CLI contract; partial regeneration. |
| PRD-41 | Astro integration | Unauthored | M | PRD-40, PRD-21 | PRD-70 | P2 | Astro integration package; uses content collections. |
| PRD-42 | Hugo module | Unauthored | M | PRD-40, PRD-21 | PRD-73 | P2 | Hugo module; Go template integration. |
| PRD-43 | MkDocs plugin | Unauthored | M | PRD-40, PRD-21 | — | P2 | MkDocs plugin; Python; reads from `nav` config. |
| PRD-44 | Docusaurus plugin | Unauthored | M | PRD-40, PRD-21 | PRD-71 | P2 | Docusaurus plugin; integrates with sidebar config. |
| PRD-45 | Next.js plugin | Unauthored | L | PRD-40, PRD-30, PRD-31 | PRD-72 | P2 | Next.js plugin (App Router + Pages Router); SSR-time extraction. |
| PRD-46 | Remix / React Router v7 integration | Unauthored | M | PRD-40, PRD-30, PRD-31 | — | P2 | Remix loaders → ACT collection. |
| PRD-47 | Nuxt module | Unauthored | M | PRD-40, PRD-30, PRD-32 | — | P2 | Nuxt 3 module; Vue 3 integration. |
| PRD-48 | 11ty plugin | Unauthored | M | PRD-40, PRD-21 | — | P2 | Eleventy plugin; data-cascade integration. |
| PRD-49 | Standalone CLI (`act-build`) | Unauthored | M | PRD-40 | Manual builds | P2 | Framework-agnostic CLI; reads `act.config.{js,json,yaml}`. |

### 50 Runtime SDK

| ID | Title | Status | Size | Depends on | Blocks | Phase | Scope |
|---|---|---|---|---|---|---|---|
| PRD-50 | Runtime SDK contract | Unauthored | L | PRD-16 | PRDs 51–55, 62 | P2 | Resolver function pattern (manifest, index, node, subtree); ETag computation; cache headers; error responses. |
| PRD-51 | Next.js runtime SDK | Unauthored | M | PRD-50 | PRD-75, PRD-76 | P2 | `@act/runtime/next` route handlers. |
| PRD-52 | Express runtime SDK | Unauthored | M | PRD-50 | — | P2 | `@act/runtime/express` middleware. |
| PRD-53 | FastAPI runtime SDK | Unauthored | M | PRD-50 | — | P2 | `act-runtime-fastapi` Python package. |
| PRD-54 | Rails runtime SDK | Unauthored | M | PRD-50 | — | P2 | Rails engine for ACT runtime. |
| PRD-55 | Generic WHATWG-fetch / Hono SDK | Unauthored | M | PRD-50 | Cloudflare Workers, Bun, Deno | P2 | Provider-agnostic core; works with Hono, itty-router, raw fetch. |

### 60 Tooling

| ID | Title | Status | Size | Depends on | Blocks | Phase | Scope |
|---|---|---|---|---|---|---|---|
| PRD-60 | Validator / conformance suite | Unauthored | L | PRD-10, PRD-17 | PRD-13, all integration tests | P2 | CLI + hosted validator; runs all PRD conformance fixtures against a target site or endpoint. |
| PRD-61 | Inspector CLI / debugger | Unauthored | M | PRD-10 | — | P2 | Walks an ACT tree from a URL; pretty-prints structure, token counts, broken refs. |
| PRD-62 | ACT-MCP bridge reference | Unauthored | L | PRD-50 | — | P2 | One set of resolvers exposed via both ACT runtime endpoints and MCP resources. |
| PRD-63 | Embeddings sidecar | Deferred | — | — | — | v0.2 | Pre-computed embeddings shipped alongside nodes. Placeholder — defer to v0.2. |

### 70 Reference example builds

| ID | Title | Status | Size | Depends on | Blocks | Phase | Scope |
|---|---|---|---|---|---|---|---|
| PRD-70 | Example: minimal docs site | Unauthored | M | PRD-21, PRD-41 | — | P3 | Astro + Markdown; ~20 pages; the "hello world" of ACT. |
| PRD-71 | Example: large docs site | Unauthored | L | PRD-21, PRD-44 | — | P3 | Docusaurus; ~10K nodes; exercises NDJSON index and subtree pagination. |
| PRD-72 | Example: corporate marketing | Unauthored | XL | PRD-22, PRD-27, PRD-31, PRD-45 | — | P3 | Next.js + Contentful + next-intl + design system; 4 locales; A/B variants. |
| PRD-73 | Example: blog | Unauthored | M | PRD-21, PRD-42 | — | P3 | Hugo; chronological feed; year/month hierarchy. |
| PRD-74 | Example: e-commerce catalog | Unauthored | L | PRD-21 or PRD-22, PRD-41 or PRD-45 | — | P3 | Product nodes with `schema_org_type: Product`; specs as `data` blocks. |
| PRD-75 | Example: B2B SaaS workspace | Unauthored | XL | PRD-16, PRD-51, PRD-19 | — | P3 | Next.js app with auth; per-tenant runtime ACT; covers 401/404 leak prevention. |
| PRD-76 | Example: hybrid static + runtime + MCP | Unauthored | XL | PRD-15, PRD-16, PRD-50, PRD-62 | — | P3 | Mature deployment: marketing/docs static, app runtime, actions via MCP. |

### 80 Adoption & ecosystem

| ID | Title | Status | Size | Depends on | Blocks | Phase | Scope |
|---|---|---|---|---|---|---|---|
| PRD-80 | Crawler / agent behavior guide | Unauthored | M | PRD-10, PRD-19 | — | P3 | User-Agent conventions, robots respect, rate limiting, cache revalidation patterns. |
| PRD-81 | Migration playbook | Unauthored | M | PRD-10 | — | P3 | From `llms.txt`, `llms-full.txt`, MCP-only deployments to ACT. |
| PRD-82 | RFC / governance process | Unauthored | M | ADR (D-01 governance) | — | P3 | How ACT changes post-v0.1: proposal workflow, voting, deprecation, RFC submission. |
| PRD-83 | Naming, branding, trademark policy | Unauthored | S | ADR (D-02 naming) | — | P3 | Spec name, logo (if any), domain ownership, npm scope, npm package naming. |

## Dependency graph

The following graph shows the high-level edges. P0/P1 trunk on the left; P2 producers and consumers branching right; P3 examples at the leaves.

```
P0 (foundation)
├── 00-* meta artifacts ─── (this file, gaps, template, decisions, workflow)
├── PRD-17 conformance ─────────────────────────┐
└── PRD-18 versioning ──────────────────────────┤
                                                │ (every PRD references)
P1 (the standard)                               │
├── PRD-10 wire format ◄────────────────────────┤
│     │                                         │
│     ├── PRD-11 discovery                      │
│     ├── PRD-12 content blocks ──┐             │
│     ├── PRD-13 caching/ETags    │             │
│     ├── PRD-14 i18n ────────────┤             │
│     ├── PRD-15 static profile ──┤             │
│     ├── PRD-16 runtime profile ─┤             │
│     └── PRD-19 security ────────┤             │
                                  │             │
P2 (producers & consumers)        │             │
├── PRD-20 adapter framework ◄────┘             │
│     ├── PRD-21 markdown/MDX                   │
│     ├── PRD-22 Contentful                     │
│     ├── PRD-23 Sanity                         │
│     ├── PRD-24 Storyblok                      │
│     ├── PRD-25 Strapi                         │
│     ├── PRD-26 Builder.io                     │
│     ├── PRD-27 i18n ◄──── PRD-14              │
│     └── PRD-28 programmatic                   │
│                                               │
├── PRD-30 component contract ◄─── PRD-12, 20   │
│     ├── PRD-31 React                          │
│     ├── PRD-32 Vue                            │
│     └── PRD-33 Angular                        │
│                                               │
├── PRD-40 generator arch ◄─── PRD-15, 20       │
│     ├── PRD-41 Astro ◄────── PRD-21           │
│     ├── PRD-42 Hugo ◄─────── PRD-21           │
│     ├── PRD-43 MkDocs ◄───── PRD-21           │
│     ├── PRD-44 Docusaurus ◄─ PRD-21           │
│     ├── PRD-45 Next.js ◄──── PRD-30, 31       │
│     ├── PRD-46 Remix ◄────── PRD-30, 31       │
│     ├── PRD-47 Nuxt ◄─────── PRD-30, 32       │
│     ├── PRD-48 11ty ◄─────── PRD-21           │
│     └── PRD-49 CLI act-build                  │
│                                               │
├── PRD-50 runtime SDK contract ◄─── PRD-16     │
│     ├── PRD-51 Next.js                        │
│     ├── PRD-52 Express                        │
│     ├── PRD-53 FastAPI                        │
│     ├── PRD-54 Rails                          │
│     └── PRD-55 generic                        │
│                                               │
└── 60-series tooling                           │
      ├── PRD-60 validator ◄──── PRD-10, 17     │
      ├── PRD-61 inspector ◄──── PRD-10         │
      ├── PRD-62 ACT-MCP bridge ◄ PRD-50        │
      └── PRD-63 embeddings (deferred)          │
                                                │
P3 (examples & ecosystem)                       │
├── PRD-70 minimal docs ◄── PRD-21, 41          │
├── PRD-71 large docs ◄──── PRD-21, 44          │
├── PRD-72 marketing ◄───── PRD-22, 27, 31, 45  │
├── PRD-73 blog ◄────────── PRD-21, 42          │
├── PRD-74 e-commerce ◄──── PRD-21|22, 41|45    │
├── PRD-75 SaaS ◄────────── PRD-16, 51, 19      │
├── PRD-76 hybrid ◄──────── PRD-15, 16, 50, 62  │
│                                               │
├── PRD-80 crawler guide ◄─ PRD-10, 19          │
├── PRD-81 migration       ◄ PRD-10             │
├── PRD-82 governance ◄──── ADR D-01            │
└── PRD-83 naming ◄──────── ADR D-02            │
```

## Sizing summary

| Size | Count | Estimated lines |
|---|---|---|
| S (<500) | 4 | ~1500 |
| M (500–1500) | 32 | ~32000 |
| L (1500–3500) | 16 | ~40000 |
| XL (>3500) | 5 | ~25000 |
| **Total** | **57** | **~98000** |

PRD-63 is deferred and not counted. v1.0 spec is expected to be ~95K–110K lines of normative text plus ~30K lines of fixtures, schemas, and example payloads. Substantial — comparable to the OpenAPI v3 spec plus its extensions ecosystem.

## Cross-references

- ADRs: `adr/` directory. Numbered sequentially. Cited by PRDs that depend on the decision.
- Gaps: `prd/00-gaps-and-resolutions.md`. Every PRD that references an unresolved technical question cites a G-NN gap ID.
- Strategic decisions: `prd/00-decisions-needed.md`. PRDs blocked on a strategic call cite a D-NN decision ID.
- Workflow: `prd/00-workflow.md`. The 14 W-NN prompts are the operational handles.
- Source draft: `DRAFT-spec-v0.1.md`. PRDs cite `draft §X.Y` for source material until they supersede the draft section.

## Changelog

- 2026-05-01 — Initial catalog created during planning round. All 57 PRDs enumerated; statuses set; phase plan defined; dependency graph drawn.
