# PRD-300 — Component contract (declaration patterns, page-level contracts, variant handling)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

Component-driven sites — Next.js / Remix / Gatsby / Nuxt / Angular Universal — do not have content "files." Their content is component props composed at runtime, sourced from CMSes, message catalogues, and feature flags. The v0.1 working draft (`docs/plan/v0.1-draft.md` §3.1, §5.11.1–§5.11.5, §6.4.4, §7.3, §8.4) sketches a component instrumentation API with three "equivalent declaration patterns" (static field, hook, decorator), an `<ActProvider>`-driven build-time render-walk, and a hand-wave at variant handling. None of it is normative. Every detail a binding author needs is either prose (the three patterns are "equivalent" — equivalent how?), missing (what happens when nested ActSections collide on `id`?), or incoherent across the draft (variant handling is "discarded by default" in §5.11.4 but "emitted in parallel with `metadata.variant_of`" two paragraphs later).

The 30x bindings (PRD-301 React, PRD-302 Vue, PRD-303 Angular) and the 40x generators that consume them (PRD-401 Astro, PRD-404 Docusaurus, PRD-405 Next.js, PRD-406 Remix, PRD-407 Nuxt) cannot be authored without a single source of truth for: (a) the canonical declaration shape that all three patterns desugar into, (b) the page-level aggregation rule, (c) the variant identity convention (gap D2 — already pinned by PRD-102 but the component pipeline needs the binding-side rules), (d) the static-vs-runtime extraction contract (gap D4), (e) the build-time safety stance (gap D3), (f) the failure-mode emission contract (gap B4), and (g) the binding-declared capability surface that lets a generator know whether to walk a tree statically, render it via SSR, or fall back to headless. Until PRD-300 lands, every leaf binding has to relitigate the same surface and the generators downstream have to absorb the divergence.

PRD-300 is a **framework-agnostic contract**, not a TypeScript implementation. It defines the canonical declaration object, the binding interface signature, the traversal contract, the extraction emission rules, and the capability matrix that bindings advertise. The leaf PRDs (301/302/303) provide framework-specific glue and idiomatic bindings; this PRD specifies what they MUST agree on.

### Goals

1. Lock the **canonical contract object shape** that all declaration patterns desugar into — `{ type, id?, summary?, related?, variants?, contract_version, extract }` — and enumerate the three syntactic surfaces (component-level, page-level, block-level) that produce it.
2. Specify **page-level contract aggregation**: how a page's `act` declaration composes with its descendant components' contracts; the depth-first render-order rule (gap B4); the `id`-collision policy.
3. Specify the **variant handling protocol**: default-variant-only emission; opt-in `variants` mode; integration with PRD-102's `{base_id}@{variant_key}` convention (gap D2) and `metadata.variant` shape; binding obligations for replaying renders per variant.
4. Specify the **static vs runtime extraction** orthogonality: the contract is inert to where it runs; the binding declares its execution mode via a capability matrix; the generator decides where to walk.
5. Specify the **extraction guarantees** the binding provides on a successful run: emitted nodes/blocks satisfy PRD-100 (envelope shape, ID grammar R10, block discriminator R28–R31, node fields R21–R23) and PRD-102 (content-block taxonomy, the `metadata.extracted_via: "component-contract"` rule R21).
6. Specify the **failure modes** — invalid ID, empty summary, cycle, throw, malformed extract output — and the placeholder-block emission rule (cites PRD-102-R22, PRD-100-R25 for `children` cycles, gap B4 for the placeholder-block contract).
7. Pin the **`contract_version` field** on every declaration; specify how breaking changes to a contract propagate through the binding's MAJOR/MINOR rules (cite PRD-108).
8. Specify the **capability matrix** a binding declares — supports SSR-walk, supports static-AST-scan, requires headless render (jsdom/Playwright), supports server components (RSC), supports streaming, supports `<Suspense>` — so generators can dispatch correctly.
9. Define the **test-fixture surface** under `fixtures/300/` — declaration-and-expected-output tuples that every leaf binding (301/302/303) MUST produce equivalently when run through its glue layer.
10. Specify the **producer-side security posture** for component instrumentation: the contract is content; `extract` runs in the build's main JS context (gap D3, no sandbox); error messages truncated to ≤200 chars; PII not leaked through `metadata.error`.

### Non-goals

1. **Defining the wire format.** PRD-100 owns envelope shapes and the ID grammar. PRD-300 cites PRD-100 R10 / R21–R31 for what the binding's emitted output MUST satisfy.
2. **Defining content-block schemas.** PRD-102 owns the `markdown` / `prose` / `code` / `data` / `callout` / `marketing:*` taxonomy and the variant convention `{base_id}@{variant_key}`. PRD-300 emits blocks per PRD-102 and cites it.
3. **Defining the React / Vue / Angular bindings.** PRDs 301 / 302 / 303 own framework-specific glue. PRD-300 specifies only the contract every binding implements.
4. **Defining the generator pipeline.** PRD-400 owns the pipeline that consumes the binding output and writes static ACT files. PRD-300 specifies the producer side of the binding-generator interface.
5. **Defining build-time sandboxing.** Per gap D3, `extract` runs in the main JS context. Sandbox options (vm2, isolated-vm) are listed in Open questions for v0.2 and explicitly NOT introduced here.
6. **Defining the runtime SDK contract.** PRD-500 owns runtime delivery. The component contract is inert to delivery profile (PRD-300-R8); a runtime SDK that wraps a component-driven app does not change the contract surface — only the dispatch.
7. **Defining the locale model.** PRD-104 owns i18n. PRD-300 references locale only in the variant-source enum (per PRD-102-R31, `source: "locale"` is a permitted variant flavor).
8. **Defining JSON Schemas under `schemas/300/`.** Per the authoring instructions: components emit envelopes per PRD-100; the binding interface is a TypeScript signature, not a JSON envelope. No `schemas/300/` directory.

### Stakeholders / audience

- **Authors of:** PRD-301 (React binding), PRD-302 (Vue binding), PRD-303 (Angular binding), PRD-400 (generator architecture), PRD-401 (Astro plugin), PRD-404 (Docusaurus), PRD-405 (Next.js plugin), PRD-406 (Remix plugin), PRD-407 (Nuxt module), PRD-409 (standalone CLI). Indirectly: PRD-700 (Astro example) and PRD-702 (corporate marketing site) — which are the canonical worked examples this contract has to serve.
- **Reviewers required:** Jeremy Forsythe (BDFL).

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Three declaration patterns drift in subtle semantics across bindings (e.g., field-form runs `extract` once, hook-form runs it on every render) | High | High | PRD-300-R3 is normative: all three patterns desugar to the same canonical contract object and `extract` runs **at most once per (component instance, variant)** during a single extraction pass. Test fixtures require all three patterns to produce byte-identical output. |
| Page-level + component-level contract collisions on `id` produce non-deterministic node graphs across builds | Medium | High | PRD-300-R10 makes `id` collision a hard build error; PRD-300-R11 specifies the deterministic precedence (page > nearest-ancestor > self) when a child block inherits ID context. |
| Variant emission explodes node count (N variants × M routes × L locales = catastrophic) | Medium | Medium | PRD-300-R16 makes variant emission **opt-in per component**, not a global default; PRD-300-R17 caps the variant matrix at 64 variants per base node with a build error above the cap. |
| Build-time `extract` failures swallowed silently — generator emits placeholder, author never notices | High | Medium | PRD-300-R22 mandates the placeholder block AND a build warning AND an exit-code-non-zero option (`--fail-on-extraction-error`) on the generator. PRD-400 inherits the flag. |
| Static AST scan and render-walk produce divergent output for the same component | Medium | High | PRD-300-R28 makes static-only extraction explicitly partial — bindings that ship static-only MUST mark every emitted block with `metadata.extraction_method: "static-ast"` and consumers MUST treat as lower-confidence. The render-walk path is canonical. |
| Headless-render fallback (PRD-300-R29) is slow enough that authors disable it, defeating SPA support | Medium | Low–Medium | Documented as a trade-off; PRD-300-R29 makes headless opt-in via the binding's capability declaration; not the default for any framework that has SSR. |
| Server components (React Server Components) capture different props than the client tree, producing divergent extractions on re-renders | Medium | Medium | PRD-300-R30 requires bindings that support RSC to declare `capability: "rsc"` and to walk the **server tree only** for extraction; client-only components contribute only via their static contract (the `extract` runs against statically-known props). |
| Authors put PII / secrets in `extract` outputs (e.g., dumping `req.user.email` into a summary) | Medium | High | PRD-300-R32 forbids passing request-scoped or user-scoped data into `extract`; the binding MUST surface only props that came from build-time data sources. Cross-cuts PRD-109. |

### Open questions

1. ~~Should the contract object's `extract` function be allowed to return a **Promise** (async extract)?~~ **Resolved (2026-05-01): No.** Synchronous extraction simplifies the page-level aggregation rule and the static-AST path. Async extract is desirable for binding to data sources at extract time, but PRD-200 adapters are the right place for that. Defer to v0.2 if a binding author surfaces a concrete need; making `extract` async-tolerant is MAJOR per the Versioning table. (Closes Open Question 1.)
2. ~~Should the binding emit **block ordering** strictly as render order (top-to-bottom, depth-first per PRD-102-R24) or allow `priority` hints on contracts?~~ **Resolved (2026-05-01): Render-order only.** `priority` hints would let pages reorder content semantically without reordering visually, which makes the canonical extraction non-deterministic across producers. PRD-102-R24 already pins this; PRD-300-R9 inherits. (Closes Open Question 2.)
3. ~~Should there be a binding-level **`onExtractError` hook** that authors can install to customise the placeholder block?~~ **Resolved (2026-05-01): No.** Placeholders are spec-shaped (PRD-102-R22) and customisation belongs in the generator's report tooling, not in the binding contract surface. Per the heuristic to defer additive surface to v0.2 unless a concrete need surfaces. (Closes Open Question 3.)

### Acceptance criteria

- [ ] Every requirement carries an ID of the form `PRD-300-R{n}` and a conformance level (Core / Standard / Plus per PRD-107).
- [ ] The Specification section opens with a table of 100-series requirements implemented (Phase 3 addition per `docs/workflow.md`).
- [ ] The Wire format / interface definition section provides framework-agnostic TypeScript-style interface signatures for: the canonical contract object, the binding interface, the page-level contract, the capability declaration, the extraction context, and the placeholder emission.
- [ ] Implementation notes section ships ~3–10 short TS snippets illustrating: the canonical contract object, a binding interface stub, a page-level contract, the depth-first traversal pseudocode, the variant-replay loop, the placeholder emission helper.
- [ ] Test fixtures enumerated under `fixtures/300/positive/` and `fixtures/300/negative/` with one row per major requirement; fixture files NOT created in this PRD.
- [ ] No JSON Schemas created under `schemas/300/` — the contract is interface-shaped, not envelope-shaped.
- [ ] Cites PRD-100 (envelope, IDs, blocks), PRD-102 (block taxonomy, variants, component-extracted metadata), PRD-107 (conformance bands), PRD-108 (versioning), PRD-109 (security posture).
- [ ] Resolves Tier-D gaps D1, D2, D3, D4 and Tier-B gap B4. Each gap appears in the Versioning & compatibility, Specification, or References section by ID.
- [ ] Open questions ≤ 5; technical questions resolved or queued; strategic questions deferred to `000-decisions-needed.md`.
- [ ] Changelog entry dated 2026-05-01 by Jeremy Forsythe is present.

---

## Context & dependencies

### Depends on

- **PRD-100 (Accepted):** wire format. The binding emits envelopes that satisfy PRD-100-R10 (ID grammar), R21–R23 (node envelope), R24–R26 (parent / children / cycles), R28–R31 (block discriminator and tolerance). Cited per requirement.
- **PRD-102 (Accepted):** content blocks. The binding emits blocks per the canonical taxonomy (R1–R11), the `metadata.extracted_via: "component-contract"` rule (R21), the placeholder-on-failure rule (R22), the partial-extraction rule (R23), block ordering (R24), variant ID grammar (R29), variant emission requirements (R30–R32).
- **PRD-107 (Accepted):** conformance bands. PRD-300 requirements are banded across Core / Standard / Plus per the level a binding declares it supports. Most component-instrumentation features are Plus; a Core binding satisfies the smallest viable subset.
- **PRD-108 (Accepted):** versioning policy. The `contract_version` field on the declaration follows MAJOR/MINOR rules; binding-level capability additions are MINOR per R4(5); changing the canonical contract object's REQUIRED fields is MAJOR per R5(1).
- **PRD-109 (Accepted):** security posture. The build-time safety stance for `extract` (gap D3, no sandbox) is a delta on PRD-109's threat model; PII in `extract` outputs and `metadata.error` truncation rules cross-cut PRD-109's PII-handling section.
- **000-governance (Accepted):** lifecycle and change-control rules.
- **000-gaps-and-resolutions.md:** Tier D gaps D1 (declaration-pattern equivalence rules), D2 (variant identity), D3 (build-time safety), D4 (non-SSR-able SPA fallback). Tier B gap B4 (component-contract emission contract).
- **000-decisions-needed.md:** Q3 (TypeScript-only first-party reference impls). PRD-300 is framework-agnostic in its prose but specifies TypeScript signatures because the leaf bindings (301/302/303) ship as TypeScript packages per Q3.
- External: [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174). React Server Components conventions (informational reference for capability declarations).

### Blocks

- **PRD-301** (React binding) — implements this contract for React; cannot leave Draft until PRD-300 is Accepted.
- **PRD-302** (Vue binding) — implements for Vue.
- **PRD-303** (Angular binding) — implements for Angular.
- **PRD-400** (generator architecture) — consumes binding output; cannot stabilize the pipeline shape until the binding contract is locked.
- **PRD-401** (Astro plugin) — depends on PRD-300 transitively via PRD-301 and PRD-400.
- **PRD-404** (Docusaurus), **PRD-405** (Next.js), **PRD-406** (Remix), **PRD-407** (Nuxt) — same chain.
- **PRD-409** (standalone CLI) — uses PRD-300's headless-render fallback (R29).
- **PRD-700** (Astro docs example), **PRD-702** (corporate marketing site) — exercise the contract end-to-end.

### References

- v0.1 draft: §3.1 (component-driven critique), §5.11.1 (three declaration patterns), §5.11.2 (page-level contracts), §5.11.3 (build-time extraction strategies), §5.11.4 (variant handling), §5.11.5 (Vue and Angular), §6.4.4 (`react-component` adapter config), §7.3 (SPA-specific pipelines), §8.4 (corporate marketing worked example), §8.5 (no-SSR SPA fallback), §10 Q5 (extract sandbox), §10 Q6 (variant identity), §10 Q12 (headless-render fallback).
- `prd/000-gaps-and-resolutions.md` Tier D — gaps **D1** (declaration-pattern equivalence), **D2** (variant identity convention `{base_id}@{variant_key}`), **D3** (build-time extraction safety — no sandbox, failures as warnings), **D4** (non-SSR-able SPA fallback — two-tier approach). Tier B gap **B4** (component-contract emission rules: order, `metadata.extracted_via`, placeholder block).
- `prd/102-content-blocks.md` R1–R11 (block taxonomy), R21 (`extracted_via`), R22 (placeholder), R23 (partial extraction), R24 (block ordering), R29–R32 (variant convention).
- `prd/100-wire-format.md` R10 (ID grammar), R21–R23 (node envelope), R25 (`children` cycle prohibition), R28–R31 (block discriminator and consumer tolerance).
- `prd/107-conformance-levels.md` R6 / R8 / R10 (Core / Standard / Plus bands).
- `prd/108-versioning-policy.md` R4 (MINOR), R5 (MAJOR), R12 (deprecation window).
- `prd/109-security.md` (PII posture, identity-data exclusion).
- Prior art: MDX `meta` exports for page-level metadata; Storyblok block schemas (component-level structure mapped to a CMS block); React 18 Server Components prop-serialization rules (informational); Angular's `@Component` decorator metadata pattern; Vue's `defineProps` + `<script setup>` macros.

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) where requirements are imposed. Lowercase "must" and "should" are non-normative prose.

### 100-series requirements implemented

The component-instrumentation pipeline emits ACT envelopes; the wire format itself is owned by the 100-series. This table maps PRD-300 to the 100-series requirements its output MUST satisfy, so a binding implementer can verify coverage end-to-end.

| 100-series requirement | What it pins | Where PRD-300 enforces |
|---|---|---|
| PRD-100-R10 (ID grammar) | `^[a-z0-9]([a-z0-9._\-]|/)*[a-z0-9]$` for every node `id` | PRD-300-R5 (contract `id` field), PRD-300-R10 (page-level `id`), PRD-300-R15 (variant ID composition) |
| PRD-100-R11 (ID byte length ≤ 256) | UTF-8 byte cap on `id` | PRD-300-R10 (validated at extract time before emission) |
| PRD-100-R21 (node REQUIRED fields) | `act_version`, `id`, `type`, `title`, `etag`, `summary`, `content`, `tokens` | PRD-300-R20 (the binding emits a node envelope; the generator fills `act_version` and `etag`; the contract supplies `type`, `title`, `summary`, `content`, and the `tokens` material) |
| PRD-100-R22 (node OPTIONAL fields) | `parent`, `children`, `related`, `source`, `metadata`, `summary_source`, `abstract` | PRD-300-R12 (page-level contract supplies `related`), PRD-300-R20 (`metadata` populated automatically) |
| PRD-100-R25 (`children` cycle prohibition) | Hard producer obligation | PRD-300-R11 (page-level aggregation MUST NOT produce a child whose subtree references the page) |
| PRD-100-R28 (block discriminator) | Every `content[]` entry has `type` | PRD-300-R20 (binding rejects extracts whose blocks omit `type`) |
| PRD-100-R29 (core block types closed) | `markdown`, `prose`, `code`, `data`, `callout` | PRD-300-R20 (extracts emitting unknown core types are placeholder-substituted) |
| PRD-100-R30 (`marketing:*` namespace open) | Plus-tier; producers MAY emit | PRD-300-R20 (component-extracted blocks predominantly land in `marketing:*`) |
| PRD-100-R31 (consumer tolerance for unknown blocks) | Graceful degradation | PRD-300-R20 (binding emits well-formed envelopes regardless of consumer support) |
| PRD-102-R21 (`metadata.extracted_via`) | All component-extracted blocks set `metadata.extracted_via: "component-contract"` | PRD-300-R23 (binding sets the field on every emitted block automatically) |
| PRD-102-R22 (placeholder on failure) | `marketing:placeholder` with `extraction_status: "failed"` | PRD-300-R22 (the binding emits the placeholder per spec when extract throws) |
| PRD-102-R23 (partial extraction) | `marketing:placeholder` substitution if REQUIRED fields are absent | PRD-300-R22 (partial-extract gating) |
| PRD-102-R24 (block ordering) | Render order, top-to-bottom, depth-first | PRD-300-R9 (page-level aggregation walk) |
| PRD-102-R29–R32 (variant convention) | `{base_id}@{variant_key}`, `metadata.variant`, `variant_of` / `has-variant` relations | PRD-300-R15, R16, R17, R18 |
| PRD-102-R28 (10K-token soft cap) | Producer SHOULD split | PRD-300-R20 (binding warns when emitted node exceeds 10K body tokens) |

### Conformance level

Per PRD-107, requirements in this PRD are banded as follows. Most component-instrumentation features ride at Plus because the `marketing:*` blocks they emit are Plus-tier (PRD-107-R10). Two requirements are Core because they are envelope-shape preconditions every binding must satisfy regardless of declared level. Standard adds the page-level contract aggregation rule and the partial-extraction handling.

- **Core:** PRD-300-R1, R2, R3, R4, R5, R6, R7, R8, R20, R22, R32.
- **Standard:** PRD-300-R9, R10, R11, R12, R13, R23, R24, R25, R26, R31.
- **Plus:** PRD-300-R14, R15, R16, R17, R18, R19, R21, R27, R28, R29, R30.

The level a binding declares determines which requirements apply. A Plus binding satisfies Standard and Core by additivity (PRD-107-R11).

### Normative requirements

#### The canonical contract object

**PRD-300-R1.** Every ACT-instrumented component, page, or block declaration MUST desugar — at the binding's interface boundary — into a single canonical **contract object** with the field shape pinned by PRD-300-R2. The desugaring is the binding's responsibility (per PRD-301 / PRD-302 / PRD-303); PRD-300 specifies what every binding's desugared output MUST look like. (Per gap D1.) Conformance: **Core**.

**PRD-300-R2.** A canonical contract object MUST be a plain JS/TS object with the following field shape:

- `type` (string, REQUIRED): the block type per PRD-102 (e.g., `"markdown"`, `"marketing:hero"`) for component- and block-level contracts, OR the node `type` per PRD-100 (e.g., `"landing"`, `"article"`, `"tutorial"`) for page-level contracts.
- `id` (string, OPTIONAL on component-level; REQUIRED on page-level): a node ID conforming to PRD-100-R10.
- `summary` (string, OPTIONAL): the node or block's one-sentence summary.
- `related` (array of `{ id, relation }`, OPTIONAL): cross-references per PRD-102-R18.
- `variants` (`"default" | "all" | string[]`, OPTIONAL, default `"default"`): variant emission policy per PRD-300-R16.
- `contract_version` (string matching `^[0-9]+\.[0-9]+$`, REQUIRED on every contract object): the version of the contract surface the declaration was authored against. Per PRD-300-R26.
- `extract` (function `(props, ctx) => ContractOutput | ContractOutput[]`, REQUIRED): the function that produces the emitted block(s) from props. Per PRD-300-R7.

Bindings MAY accept additional surface-syntactic conveniences (e.g., a static field `act` vs a hook `useActContract` vs a decorator `@act`) but the desugared object MUST satisfy this shape. Conformance: **Core**.

**PRD-300-R3.** All three declaration patterns (field, hook, decorator) MUST produce identical canonical contract objects given identical authored inputs. The bindings (PRD-301 / PRD-302 / PRD-303) expose a shared core that takes `(component, props, contract)` and returns block(s); the patterns differ ONLY in how the contract is associated with the component. Specifically: the field pattern attaches a static property; the hook pattern registers via a per-render call captured by the binding's provider; the decorator pattern attaches via metadata. After desugaring, the same binding-internal traversal MUST handle all three uniformly. (Per gap D1, resolved.) Conformance: **Core**.

**PRD-300-R4.** A binding MUST guarantee that `extract` runs **at most once per (component instance, variant) tuple** during a single extraction pass. Bindings using the hook pattern MUST NOT re-invoke `extract` on every render; the hook's purpose is registration, not repeated execution. Conformance: **Core**.

#### `id` field — per-level rules

**PRD-300-R5.** When the contract object's `id` field is present, it MUST conform to PRD-100-R10's grammar (`^[a-z0-9]([a-z0-9._\-]|/)*[a-z0-9]$`) and PRD-100-R11's byte length cap (≤ 256 UTF-8 bytes). The binding MUST validate `id` at extract time and emit a placeholder per PRD-300-R22 (with `extraction_status: "failed"` and a clear `metadata.error`) if the ID violates either rule. Validators MUST flag the failure as a build error, not a warning. Conformance: **Core**.

**PRD-300-R6.** A **block-level** or **component-level** contract object MAY omit `id`. Block emissions get their stable identity from the enclosing page-level node's `id` plus their position in the `content[]` array; the binding MUST NOT mint synthetic IDs for individual blocks. Conformance: **Core**.

#### `extract` semantics

**PRD-300-R7.** The `extract` function takes `(props, ctx)` and returns either a single `ContractOutput` or an array of them. `props` is the component's runtime props (or, in static-AST mode, the props the AST scanner can statically resolve). `ctx` is an extraction context object with at minimum:

- `ctx.locale` (string | undefined): the active locale for this extraction pass, populated by the generator per PRD-104; undefined for non-i18n builds.
- `ctx.variant` (string | undefined): the variant key for this extraction pass; undefined for the canonical/default variant.
- `ctx.parentId` (string | undefined): the enclosing page-level node's `id`, undefined when extracting outside a page contract.
- `ctx.binding` (string): the binding name (`"@act/react"`, `"@act/vue"`, `"@act/angular"`, `"@act/headless"`).
- `ctx.warn(message: string)` (function): emits a build warning attached to the current extraction; non-fatal.

`extract` MUST be synchronous in v0.1 (per Open question 1). Returning a Promise is undefined behaviour; bindings MUST emit a placeholder if `extract` returns a Promise-shaped value. Conformance: **Core**.

**PRD-300-R8.** The contract surface (the canonical contract object, the binding interface, the extraction context) is **inert to delivery profile**. A binding's contract MUST behave identically whether the generator runs it at static build time, at runtime via SDK render, or via headless render. The binding declares its **execution mode** capabilities (PRD-300-R28) but the contract surface has no `delivery: "static" | "runtime"` knob. Generators dispatch; the contract does not. (Resolves a sub-question of gap D4.) Conformance: **Core**.

#### Page-level contract aggregation

**PRD-300-R9.** When a page declares a page-level contract (`{ type, id, summary?, related? }`), the binding MUST aggregate descendant component- and block-level contracts into the page node's `content[]` array in **render order, top-to-bottom, depth-first** (per PRD-102-R24, gap B4). The binding MUST NOT reorder, deduplicate, or skip blocks based on visual presentation; the rendered order is the canonical extraction order. Conformance: **Standard**.

**PRD-300-R10.** A page-level contract object MUST include `id`. The `id` MUST conform to PRD-100-R10 and PRD-100-R11. A page-level contract whose `id` is missing or invalid MUST cause the generator to emit a build error and skip the route; no placeholder substitution applies at the page level (placeholders are block-level). Conformance: **Standard**.

**PRD-300-R11.** Two page-level contracts producing the same `id` in a single build MUST cause a build error. The binding MUST surface both source locations (file, route) in the error message. The binding MUST NOT silently merge, last-writer-wins, or de-collide via suffix. (Cross-cuts PRD-200's multi-source merge model — adapter-provided IDs and component-extracted IDs MUST NOT collide; resolution is the generator's responsibility per PRD-400.) Conformance: **Standard**.

**PRD-300-R12.** A page-level contract MAY include a `related` array per PRD-102-R18. The binding MUST emit the `related` array verbatim on the page node. The binding MUST NOT inject implicit `related` entries (e.g., "every variant of this page"); variant relations are emitted only when PRD-300-R18 applies. Conformance: **Standard**.

**PRD-300-R13.** Nested page-level contracts (a page contract whose subtree contains another page contract) MUST cause a build error. Pages do not nest; a route is a single ACT node. Sub-pages are separate routes with their own page-level contracts. Conformance: **Standard**.

#### Variant handling

**PRD-300-R14.** A component- or page-level contract MAY declare `variants`. When omitted, `variants` defaults to `"default"`: the binding extracts the contract once for the canonical (default-audience, default-experiment-arm, default-locale) render and emits one node. Conformance: **Plus**.

**PRD-300-R15.** When `variants` is `"all"` or an array of variant keys, the binding MUST replay the page render once per declared variant, supplying `ctx.variant` set to each variant key in turn. Each replay produces one ACT node whose ID is `{base_id}@{variant_key}` per PRD-102-R29. The base node (canonical/default) MUST also be emitted per PRD-102-R30. Conformance: **Plus**.

**PRD-300-R16.** Variant emission MUST be **opt-in per component**, not a global default. A binding MUST NOT emit variants unless the contract explicitly declares `variants: "all"` or a non-default array. The default (`"default"`) is the only behaviour for sites that have not explicitly authored variant emission. (Risk mitigation: prevents variant explosion in sites with thousands of components and many variant axes.) Conformance: **Plus**.

**PRD-300-R17.** The total number of variants emitted for a single base page node MUST NOT exceed **64** in a single build. Bindings MUST emit a build error when the variant matrix (cardinality of the cross-product of variant axes the page contract declares) exceeds the cap. The cap is informational at v0.1; PRD-400 owns the per-build aggregate cap (across all pages). Conformance: **Plus**.

**PRD-300-R18.** Each emitted variant node MUST set `metadata.variant` per PRD-102-R31 with `{ base_id, key, source }`. The `source` value MUST come from the documented-open enum `{ "experiment", "personalization", "locale" }` per PRD-102-R31. Bindings MUST set `source` to the value the page contract or generator declares; a binding MUST NOT default `source` to `"experiment"` if the variant origin is unknown — the contract MUST be explicit. Conformance: **Plus**.

**PRD-300-R19.** Bindings MUST emit at least one direction of the variant relation per PRD-102-R32 — typically `relation: "variant_of"` from the variant to the base. Bindings MAY also emit `relation: "has-variant"` from the base to each variant. Conformance: **Plus**.

#### Extraction guarantees

**PRD-300-R20.** A binding MUST emit ACT envelopes that satisfy:

- PRD-100-R21 (node envelope REQUIRED fields): the binding supplies `type`, `title`, `summary`, `content`, `tokens`; the generator (PRD-400) supplies `act_version` and `etag`. The binding MUST NOT short-circuit any of its supplied fields (e.g., emit a node with `summary: ""` to satisfy the field's presence at the cost of PRD-100-R19's non-empty constraint).
- PRD-100-R28 (block discriminator): every emitted block has a non-empty `type` string.
- PRD-100-R29 (core block types): blocks claiming `markdown`, `prose`, `code`, `data`, or `callout` MUST satisfy the respective per-type schema in PRD-102-R1–R5; otherwise the binding substitutes a `marketing:placeholder` per PRD-300-R22.
- PRD-100-R30 (`marketing:*` namespace): blocks in this namespace MUST follow the regex `^marketing:[a-z][a-z0-9-]*$` per PRD-102-R6.

The binding MUST validate all four conditions before emitting the envelope; on any violation the binding emits a placeholder per PRD-300-R22 and emits a build warning. Conformance: **Core**.

**PRD-300-R21.** Every block emitted by component-contract extraction MUST set `metadata.extracted_via: "component-contract"` per PRD-102-R21. The binding MUST add this field automatically — authors MUST NOT be required to set it inside `extract`. A block whose extracted output already carries `metadata.extracted_via` set to a different value MUST be rejected and substituted with a placeholder; the field is binding-owned. Conformance: **Plus**.

#### Failure modes

**PRD-300-R22.** When extraction fails — `extract` throws, returns malformed output, returns blocks that violate PRD-300-R20, returns a Promise (per PRD-300-R7), or returns blocks whose REQUIRED fields per the type's schema are absent — the binding MUST emit a `marketing:placeholder` block per PRD-102-R22 with the following metadata:

- `metadata.extracted_via: "component-contract"` (per PRD-300-R21).
- `metadata.extraction_status: "failed"` (per PRD-102-R22).
- `metadata.error` (string, OPTIONAL, ≤ 200 chars, MUST NOT include stack traces, file paths beyond the source file basename, or environment variables; see PRD-300-R32 for PII).
- `metadata.component` (string, OPTIONAL): the component name as known to the binding.
- `metadata.location` (string, OPTIONAL): the source location (file:line) where the contract was declared.

The binding MUST emit a build warning to stderr or the generator's log channel at the same time. The generator (PRD-400) MUST surface the warning to the build log; PRD-400's optional `--fail-on-extraction-error` flag escalates the warning to a non-zero exit code. Conformance: **Core**.

**PRD-300-R23.** When extraction is **partial** — `extract` returns blocks where some OPTIONAL fields are populated but REQUIRED fields per the type's schema are also present (i.e., the block satisfies the schema's REQUIRED set) — the binding MUST emit the partial block with `metadata.extraction_status: "partial"` per PRD-102-R23. If the REQUIRED set is NOT satisfied, the binding falls back to PRD-300-R22 (placeholder). Conformance: **Standard**.

**PRD-300-R24.** A page-level contract whose extraction produces a `children` reference back to itself, transitively, MUST cause a build error per PRD-100-R25 (the `children` cycle prohibition). Bindings MUST detect cycles at extract time, NOT defer to the validator. The generator MUST refuse to emit a node whose `children` array forms a cycle. Conformance: **Standard**.

**PRD-300-R25.** A node whose body tokens — computed per the producer's declared tokenizer (PRD-102 references; no canonical tokenizer is required) — exceed **10000** MUST cause the binding to emit a build warning per PRD-102-R28. The binding MUST NOT split the node automatically; node splitting is the author's call. The warning's message MUST cite the node `id` and the observed body-token estimate. Conformance: **Standard**.

#### Versioning the contract

**PRD-300-R26.** Every canonical contract object MUST include `contract_version` matching `^[0-9]+\.[0-9]+$` (per PRD-108-R2). The value declares the PRD-300 contract surface revision the declaration was authored against. v0.1 contracts use `"0.1"`. Conformance: **Standard**.

**PRD-300-R27.** A binding MUST tolerate contracts whose `contract_version` MINOR is at or below the binding's supported MINOR (within the same MAJOR), per PRD-108-R7. A binding MUST reject contracts whose MAJOR exceeds what the binding implements, emitting a build error. The binding MUST NOT silently downgrade across MAJOR boundaries; the rejection is fast and bounded per PRD-108-R8. Conformance: **Plus**.

#### Capability declaration

**PRD-300-R28.** A binding MUST publish a static **capability declaration** at its package boundary (typically as a TypeScript `const capabilities: BindingCapabilities`). The declaration enumerates which extraction modes the binding supports. The capability surface (closed for v0.1) is:

- `ssr-walk` (boolean): the binding supports walking a server-rendered tree (SSR / SSG path; the `<ActProvider>` collects contracts during render).
- `static-ast` (boolean): the binding supports static AST scanning (babel/SWC-style plugin walks source files).
- `headless-render` (boolean): the binding supports headless render via Playwright or jsdom (gap D4 Tier-2 fallback).
- `rsc` (boolean): the binding supports React Server Components or framework-equivalent server-only trees.
- `streaming` (boolean): the binding supports framework streaming (e.g., React 18 `renderToPipeableStream`); this informs the generator whether to wait for the stream to complete before reading collected contracts.
- `suspense` (boolean): the binding supports `<Suspense>` boundaries during extraction (the binding's extractor must wait for suspended content to resolve before yielding).
- `concurrent` (boolean): the binding supports concurrent extraction across routes (parallelism control owned by PRD-400).

A binding MUST set every flag truthfully. A binding that ships `static-ast: true` but cannot walk the JSX MUST NOT lie about it; the generator's selection logic depends on the flags.

Generators (PRD-400) consume the capability declaration to dispatch extraction. Adding a new capability flag is MINOR per PRD-108-R4(5) (the capability key set is documented-open at the binding-declaration layer; see PRD-300's Versioning & compatibility). Removing a capability is MAJOR per PRD-108-R5(5).

Conformance: **Plus**.

**PRD-300-R29.** A binding declaring `headless-render: true` and no `ssr-walk` MUST mark every emitted block with `metadata.extraction_method: "headless-render"`. Consumers and generators MAY treat these blocks as lower-confidence per gap D4. A binding declaring `ssr-walk: true` MUST mark blocks with `metadata.extraction_method: "ssr-walk"`. A binding declaring both MUST mark blocks with the actual method used for the specific extraction pass. (The `metadata.extraction_method` field is owned by PRD-300; PRD-102 owns `metadata.extracted_via`. The two fields are orthogonal.) Conformance: **Plus**.

**PRD-300-R30.** A binding declaring `rsc: true` MUST walk the **server tree only** when extracting; client-only components contribute via their static contract (i.e., the `extract` is invoked against statically-known props from the AST or against props serialized from the server boundary). Bindings MUST NOT re-invoke `extract` on the client tree; doing so produces non-deterministic extractions across re-renders. The capability flag is the contract; bindings that cannot honor it MUST set `rsc: false`. Conformance: **Plus**.

**PRD-300-R31.** A binding declaring `streaming: true` MUST wait for the stream to fully complete before yielding the collected contracts. The binding MUST NOT yield partial extractions while suspended boundaries are still resolving. (Concretely: a generator that observes `streaming: true` invokes a finalize callback that resolves only when the framework's renderer signals completion.) Conformance: **Standard**.

#### Security posture

**PRD-300-R32.** The `extract` function MUST be supplied only with props that came from build-time data sources (markdown frontmatter, CMS API responses fetched at build time, message catalogues, generator config). The binding MUST NOT pass request-scoped data (cookies, sessions, headers, user IDs, tenant IDs) into `extract`, even when the binding wraps a runtime SDK. Authors MUST NOT pass PII or secrets into `extract`'s output; the binding MUST surface a build warning when `metadata.error` exceeds 200 characters or appears to contain a stack trace, file path beyond the source file basename, or string matching the closed v0.1 secret-pattern set: `Bearer ` (generic), `sk_live_[A-Za-z0-9]+` (Stripe-style live keys), `AKIA[A-Z0-9]{16}` (AWS access key IDs), `ghp_[A-Za-z0-9]{36}` (GitHub personal access tokens), and `xoxb-[A-Za-z0-9-]+` (Slack bot tokens). The binding MUST NOT extend the pattern set at the binding layer; producers MAY register additional generator-side matchers via PRD-400's hook. Adding a pattern to this PRD's set is MINOR per PRD-108-R4(3) (the set is documented-open at the spec layer). Cross-cuts PRD-109's PII posture. Conformance: **Core**.

### Wire format / interface definition

PRD-300 is an **interface PRD**, not a wire-format PRD. The wire envelope a binding emits is the PRD-100 node envelope — the binding does not define new envelopes. The interface specified here is a TypeScript-style signature set that every binding (PRD-301 / PRD-302 / PRD-303) MUST satisfy. No JSON Schemas are produced under `schemas/300/`; PRD-100's schemas are sufficient.

#### The canonical contract object

```ts
// The shape every declaration pattern desugars into.
// Per PRD-300-R2 / R3 / R4.
export interface ActContract<P = unknown> {
  /** Block type (PRD-102) for component/block-level; node type (PRD-100) for page-level. */
  type: string;

  /** REQUIRED on page-level contracts; OPTIONAL on component/block-level (per PRD-300-R5/R6). */
  id?: string;

  /** One-sentence summary; honored on page-level for the node summary. */
  summary?: string;

  /** Cross-references emitted on the page node (per PRD-102-R18). */
  related?: Array<{ id: string; relation: string }>;

  /** Variant emission policy (per PRD-300-R14–R16). */
  variants?: "default" | "all" | string[];

  /** PRD-300-R26: contract surface revision authored against. */
  contract_version: string;

  /** PRD-300-R7: returns one or more block outputs. Synchronous in v0.1. */
  extract: (props: P, ctx: ExtractionContext) => ContractOutput | ContractOutput[];
}

/** A successfully-extracted block, satisfying PRD-100/PRD-102 schemas. */
export type ContractOutput = {
  type: string;
  // Per-type required fields per PRD-102-R1–R11. The binding validates.
  [field: string]: unknown;
};
```

#### The extraction context

```ts
// Per PRD-300-R7. Generators populate this during traversal.
export interface ExtractionContext {
  /** Active locale (PRD-104). undefined for non-i18n builds. */
  locale: string | undefined;

  /** Variant key for this extraction pass (PRD-300-R15). undefined for canonical. */
  variant: string | undefined;

  /** Enclosing page-level node id (PRD-300-R6). undefined outside a page contract. */
  parentId: string | undefined;

  /** The binding name (e.g., "@act/react"). */
  binding: string;

  /** Emit a build warning attached to the current extraction. Non-fatal. */
  warn: (message: string) => void;
}
```

#### The binding interface

```ts
// Every framework binding (PRD-301/302/303) implements this.
// Generators (PRD-400) consume it through the capability declaration.
export interface ActBinding {
  /** Stable name; appears in ExtractionContext.binding. */
  readonly name: string;

  /** Per PRD-300-R28. Static; not a function. Generators read it once at startup. */
  readonly capabilities: BindingCapabilities;

  /** Per PRD-300-R26. The contract MAJOR.MINOR this binding implements. */
  readonly contractVersion: string;

  /**
   * Walk a route and yield zero or more node drafts.
   * Implementation strategy depends on capabilities (SSR walk, static AST, headless).
   * The generator picks the strategy.
   */
  extractRoute(input: ExtractRouteInput): Promise<NodeDraft[]>;
}

export interface BindingCapabilities {
  "ssr-walk": boolean;
  "static-ast": boolean;
  "headless-render": boolean;
  rsc: boolean;
  streaming: boolean;
  suspense: boolean;
  concurrent: boolean;
}

export interface ExtractRouteInput {
  routeId: string;            // page-level id (per PRD-300-R10)
  module: unknown;            // the route module (framework-specific)
  routeProps: unknown;        // props resolved at build time
  locale: string | undefined;
  variant: string | undefined;
}

/**
 * A node draft, before the generator fills act_version/etag.
 * Field shape mirrors PRD-100-R21/R22 minus generator-owned fields.
 */
export interface NodeDraft {
  id: string;
  type: string;
  title: string;
  summary: string;
  content: ContractOutput[];     // already in render order per PRD-300-R9
  related?: Array<{ id: string; relation: string }>;
  parent?: string | null;
  metadata?: {
    variant?: { base_id: string; key: string; source: string };
    [key: string]: unknown;
  };
  tokens?: {
    summary?: number;
    body?: number;
    abstract?: number;
  };
}
```

#### The page-level contract

```ts
// A route declares a page-level contract by exporting `act` (or framework equivalent).
// The binding desugars whatever form the framework uses into this shape.
export interface PageContract extends ActContract<unknown> {
  // `id` is REQUIRED at page level (PRD-300-R10).
  id: string;
}
```

#### The placeholder block (failure mode)

```ts
// Emitted by the binding per PRD-300-R22. Conforms to PRD-102-R6 and R22.
export function buildPlaceholder(opts: {
  error: Error | string;
  component?: string;
  location?: string;
}): ContractOutput {
  const message = typeof opts.error === "string" ? opts.error : opts.error.message;
  const truncated = message.slice(0, 200);
  return {
    type: "marketing:placeholder",
    metadata: {
      extracted_via: "component-contract",
      extraction_status: "failed",
      error: truncated,
      component: opts.component,
      location: opts.location,
    },
  };
}
```

### Errors

The binding surfaces errors as build warnings or build errors; the generator (PRD-400) decides exit code based on the optional `--fail-on-extraction-error` flag. The wire envelope (PRD-100 / PRD-102) is unaffected by binding-side errors: failures emit placeholder blocks per PRD-102-R22, which are well-formed envelopes.

| Condition | Binding response | Generator finding |
|---|---|---|
| `extract` throws | Emit placeholder per PRD-300-R22; warn | Build warning; exit non-zero if `--fail-on-extraction-error` |
| `extract` returns a Promise | Emit placeholder per PRD-300-R7 + R22; warn | Build warning |
| `extract` returns block missing REQUIRED type fields (e.g., `code` without `language`) | Emit placeholder per PRD-300-R20 + R22; warn | Build warning |
| Block type uses `core:*` namespace (closed) with an unknown type | Emit placeholder per PRD-300-R20; warn | Build warning |
| Block type uses `marketing:*` with invalid suffix (per PRD-102-R6) | Emit placeholder; warn | Build warning |
| Page-level `id` missing or invalid per PRD-100-R10/R11 | Skip route, log location; **no placeholder** at page level | Build error; route not emitted |
| Two page-level contracts produce same `id` | Build error per PRD-300-R11 | Build error; both source locations cited |
| Nested page-level contract per PRD-300-R13 | Build error | Build error |
| `children` cycle per PRD-300-R24 | Build error | Build error |
| `contract_version` MAJOR exceeds binding's supported MAJOR | Build error per PRD-300-R27 | Build error |
| Variant matrix exceeds 64 per page per PRD-300-R17 | Build error | Build error |
| `metadata.error` > 200 chars or matches secret pattern per PRD-300-R32 | Truncate / redact and warn | Build warning |
| Node body tokens > 10000 per PRD-300-R25 | Emit normally; warn | Build warning |

PRD-100 and PRD-109 own the wire-format-level and project-level error semantics respectively; this PRD's errors are build-pipeline errors and warnings, not wire errors.

---

## Examples

Examples are non-normative but consistent with the Specification section; PRD-600 (validator) will validate emitted output against PRD-100 / PRD-102 schemas.

### Example 1 — A canonical contract object (component-level)

```ts
// design-system/Hero.tsx (React; pattern 1 — static field)
export function Hero(props: { title: string; subtitle: string; ctaText?: string; ctaUrl?: string }) {
  return <section className="hero">{/* … */}</section>;
}

Hero.act = {
  type: "marketing:hero",
  contract_version: "0.1",
  extract: (props, ctx) => ({
    type: "marketing:hero",
    headline: props.title,
    subhead: props.subtitle,
    cta: props.ctaText ? { label: props.ctaText, href: props.ctaUrl ?? "#" } : undefined,
  }),
} satisfies ActContract<typeof Hero extends (p: infer P) => unknown ? P : never>;
```

The binding desugars this into the canonical `ActContract` shape per PRD-300-R2.

### Example 2 — Hook-form declaration (Vue / React with hooks)

```ts
// PricingTable.tsx (React; pattern 2 — hook)
import { useActContract } from "@act/react";

export function PricingTable({ tiers }: { tiers: Tier[] }) {
  useActContract({
    type: "marketing:pricing-table",
    contract_version: "0.1",
    extract: () => ({
      type: "marketing:pricing-table",
      tiers: tiers.map(t => ({ name: t.name, price: t.price, features: t.features })),
    }),
  });
  return <div className="pricing">{/* … */}</div>;
}
```

Per PRD-300-R3 / R4, the hook desugars to the same `ActContract` and `extract` runs at most once per (instance, variant).

### Example 3 — Page-level contract aggregating descendants

```tsx
// app/pricing/page.tsx
export default function PricingPage() {
  return (
    <>
      <Hero title="Pricing" subtitle="Plans that scale with you" ctaText="Start free" ctaUrl="/signup" />
      <PricingTable tiers={[/* … */]} />
      <FAQAccordion items={[/* … */]} />
    </>
  );
}

PricingPage.act = {
  type: "landing",
  id: "pricing",
  contract_version: "0.1",
  summary: "Acme pricing tiers and plan comparison.",
  related: [
    { id: "products", relation: "see-also" },
    { id: "contact", relation: "see-also" },
  ],
  extract: (_props, _ctx) => ({ type: "landing" }), // page-level extract is typically a stub
} satisfies PageContract;
```

The binding walks the rendered tree (per PRD-300-R9) and aggregates Hero, PricingTable, and FAQAccordion into the page node's `content[]` in render order. The emitted node satisfies PRD-100-R21 (REQUIRED node fields), PRD-102-R7 / R9 / R11 (block shapes), PRD-102-R21 (`metadata.extracted_via: "component-contract"` on every block), and PRD-100-R10 (ID grammar — `pricing` is valid).

### Example 4 — Variant emission

```ts
PricingPage.act = {
  type: "landing",
  id: "pricing",
  contract_version: "0.1",
  variants: ["enterprise-2026q2"],
  summary: "Acme pricing tiers and plan comparison.",
  extract: (_props, _ctx) => ({ type: "landing" }),
} satisfies PageContract;
```

The binding renders the page twice — once for the canonical (no variant set), once with `ctx.variant = "enterprise-2026q2"` — and emits two nodes:

- `pricing` (canonical, per PRD-102-R30).
- `pricing@enterprise-2026q2` with `metadata.variant: { base_id: "pricing", key: "enterprise-2026q2", source: "experiment" }` per PRD-102-R31, plus `related: [{ id: "pricing", relation: "variant_of" }]` per PRD-102-R32.

The variant matrix here is 1; the cap of 64 (PRD-300-R17) is not approached.

### Example 5 — Capability declaration (React binding)

```ts
// @act/react/src/binding.ts
import type { ActBinding, BindingCapabilities } from "@act/core";

const capabilities: BindingCapabilities = {
  "ssr-walk": true,
  "static-ast": true,
  "headless-render": false,
  rsc: true,
  streaming: true,
  suspense: true,
  concurrent: true,
};

export const reactBinding: ActBinding = {
  name: "@act/react",
  contractVersion: "0.1",
  capabilities,
  extractRoute: async (input) => {
    // Implementation per PRD-301; not specified here.
    throw new Error("see PRD-301");
  },
};
```

Generators (PRD-400) inspect `capabilities` to choose between SSR-walk, static-AST, and headless. Per PRD-300-R28, the binding sets each flag truthfully.

### Example 6 — Failure mode (placeholder emission)

If `Hero.act.extract` throws (e.g., `props.title` is undefined because of a CMS schema drift), the binding emits:

```json
{
  "type": "marketing:placeholder",
  "metadata": {
    "extracted_via": "component-contract",
    "extraction_status": "failed",
    "error": "Cannot read properties of undefined (reading 'title')",
    "component": "Hero",
    "location": "design-system/Hero.tsx:14"
  }
}
```

This block satisfies PRD-102-R6 (`marketing:*` namespace), PRD-102-R22 (placeholder shape), and PRD-300-R32 (truncated message, no stack trace, no PII). The generator emits a build warning and, if `--fail-on-extraction-error` is set, exits non-zero.

### Example 7 — Headless-render fallback (legacy SPA)

```ts
// @act/headless/src/binding.ts (PRD-409 standalone CLI uses this)
const capabilities: BindingCapabilities = {
  "ssr-walk": false,
  "static-ast": false,
  "headless-render": true,
  rsc: false,
  streaming: false,
  suspense: false,
  concurrent: false,
};
```

Per PRD-300-R29, every block this binding emits carries `metadata.extraction_method: "headless-render"`. Consumers MAY treat as lower-confidence per gap D4 Tier-2.

---

## Test fixtures

Fixtures live under `fixtures/300/` and are exercised by every leaf binding's test suite (PRD-301 / PRD-302 / PRD-303) plus PRD-600 (validator) for emitted output. Each fixture is a tuple of `(declaration, expected_output)` — bindings MUST produce equivalent expected output regardless of framework. Fixture files are NOT created in this PRD; the layout below is the surface.

### Positive

- `fixtures/300/positive/component-static-field.json` → satisfies R1, R2, R3 (the static-field declaration desugars to the canonical contract object).
- `fixtures/300/positive/component-hook.json` → satisfies R1, R2, R3, R4 (hook-form desugars equivalently; `extract` runs once).
- `fixtures/300/positive/component-decorator.json` → satisfies R1, R2, R3 (decorator-form desugars equivalently).
- `fixtures/300/positive/page-level-aggregates-children.json` → satisfies R9, R10, R11 (page-level contract aggregates descendants in render order).
- `fixtures/300/positive/page-level-with-related.json` → satisfies R12 (page contract emits `related` verbatim).
- `fixtures/300/positive/variant-default.json` → satisfies R14 (default variant only when `variants` omitted).
- `fixtures/300/positive/variant-explicit-array.json` → satisfies R15, R16, R18, R19 (explicit variant array; canonical + each variant; metadata.variant; variant_of relation).
- `fixtures/300/positive/variant-source-locale.json` → satisfies R18 (variant `source: "locale"` integrates with PRD-104).
- `fixtures/300/positive/extracted-via-on-every-block.json` → satisfies R21 (binding sets `metadata.extracted_via` automatically).
- `fixtures/300/positive/extraction-method-ssr-walk.json` → satisfies R29 (binding sets `metadata.extraction_method: "ssr-walk"`).
- `fixtures/300/positive/extraction-method-headless.json` → satisfies R29 (binding sets `metadata.extraction_method: "headless-render"`).
- `fixtures/300/positive/contract-version-tolerated-minor.json` → satisfies R26, R27 (binding tolerates lower-MINOR contract).
- `fixtures/300/positive/capability-declaration-react.json` → satisfies R28 (full capability declaration).
- `fixtures/300/positive/partial-extraction.json` → satisfies R23 (partial extraction emits `extraction_status: "partial"`).
- `fixtures/300/positive/streaming-finalize.json` → satisfies R31 (binding waits for stream completion before yielding).

### Negative

- `fixtures/300/negative/page-id-violates-grammar.json` → MUST be rejected because the page-level `id` `"My-Pricing"` violates PRD-100-R10 (uppercase). Per PRD-300-R5, R10.
- `fixtures/300/negative/page-id-collision.json` → MUST be rejected because two page-level contracts produce `id: "pricing"`. Per PRD-300-R11.
- `fixtures/300/negative/page-nested-contract.json` → MUST be rejected because a page contract's subtree contains another page contract. Per PRD-300-R13.
- `fixtures/300/negative/extract-throws.json` → expected output is a placeholder block per PRD-300-R22; the binding MUST NOT propagate the exception.
- `fixtures/300/negative/extract-returns-promise.json` → expected output is a placeholder per PRD-300-R7 + R22.
- `fixtures/300/negative/extract-emits-malformed-code-block.json` → expected output is a placeholder; `code` block missing `language` is invalid per PRD-102-R3 and rejected per PRD-300-R20.
- `fixtures/300/negative/extract-emits-bad-marketing-suffix.json` → expected output is a placeholder; `marketing:Hero` violates PRD-102-R6.
- `fixtures/300/negative/children-cycle.json` → MUST cause a build error per PRD-300-R24 (which references PRD-100-R25).
- `fixtures/300/negative/contract-version-major-exceeds-binding.json` → MUST cause a build error per PRD-300-R27.
- `fixtures/300/negative/variant-matrix-exceeds-cap.json` → MUST cause a build error per PRD-300-R17 (variant matrix > 64).
- `fixtures/300/negative/extracted-via-overridden-by-author.json` → expected output is a placeholder per PRD-300-R21 (the field is binding-owned; authors cannot override).
- `fixtures/300/negative/error-message-with-pii.json` → expected output has the `metadata.error` redacted per PRD-300-R32 (matched a secret pattern).
- `fixtures/300/negative/extract-async.json` → same as `extract-returns-promise.json`; included separately to test detection at the type-level (TS users) vs at runtime (JS users).
- `fixtures/300/negative/page-level-id-missing.json` → MUST cause a build error per PRD-300-R10 (page contract without `id`); route skipped.

---

## Versioning & compatibility

Per PRD-108, classify each kind of change to PRD-300 as MAJOR or MINOR.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add an optional field to the canonical contract object (e.g., `priority` hint) | MINOR | Per PRD-108-R4(1). Existing producers/consumers tolerate per PRD-108-R7. |
| Add an optional field to the extraction context (e.g., `ctx.tenant`) | MINOR | Per PRD-108-R4(1). |
| Add a new capability flag to `BindingCapabilities` (e.g., `"web-components": boolean`) | MINOR | The capability key set is documented-open per PRD-300-R28. Per PRD-108-R4(5). |
| Add a value to the variant `source` enum (delegated to PRD-102-R31) | MINOR | The enum is documented-open at PRD-102. Per PRD-108-R4(3). |
| Add a new declaration pattern (a fourth alongside field/hook/decorator) | MINOR | Patterns desugar to the canonical contract object; adding one is additive. Per PRD-108-R4(1). |
| Make `extract` async-tolerant (allow Promise return) | MAJOR | Changes the contract surface's REQUIRED return shape; existing bindings would need to await. Per PRD-108-R5(2)/(3). |
| Remove a REQUIRED field from the canonical contract object | MAJOR | Per PRD-108-R5(1). |
| Rename `extract` to `produce` | MAJOR | Per PRD-108-R5(1). |
| Tighten `id` grammar at the contract level | MAJOR | Per PRD-108-R5(6). The grammar is delegated to PRD-100-R10; tightening there is also MAJOR per PRD-100. |
| Increase the variant cap (R17) above 64 | MINOR | Loosening a producer-side bound; existing consumers tolerate. |
| Decrease the variant cap below 64 | MAJOR | Producers may have been emitting up to 64; tightening breaks them. |
| Promote `static-ast` from optional capability to required | MAJOR | Existing bindings without static-AST support become non-conformant. Per PRD-108-R5(3). |
| Change the placeholder block shape (e.g., add a REQUIRED `metadata.code` field) | MAJOR | Delegated to PRD-102-R22; tightening at PRD-102 is MAJOR. |
| Tighten `metadata.error` truncation from ≤200 to ≤100 chars | MAJOR | SHOULD-class threshold change; existing producers may have emitted up to 200. |
| Editorial / prose clarification with no normative effect | n/a | Per 000-governance R18. |

### Forward compatibility

Per PRD-108-R7, bindings tolerate unknown optional fields on the contract object and unknown capability flags. A binding implementing v0.1 that receives a contract authored against v0.2 with a new optional `priority` field MUST tolerate the field (ignore it) and proceed. A consumer (generator) that observes an unknown capability flag MUST ignore it and dispatch using the flags it recognizes.

A binding MUST reject contracts whose `contract_version` MAJOR exceeds the binding's supported MAJOR (per PRD-300-R27 / PRD-108-R8). The rejection is fast and bounded.

### Backward compatibility

Within a v0.1.x line:

- A v0.1 binding's emitted output is valid for a v0.1 generator.
- A v0.2 binding's output is valid for a v0.1 generator as long as the generator tolerates unknown optional fields per PRD-108-R7.
- A v0.1 binding consuming a contract authored against v0.2 (declaring `contract_version: "0.2"` with new optional fields the binding doesn't recognize) MUST tolerate per PRD-108-R7; the unknown fields are ignored.

Across MAJOR boundaries (v0.x → v1.0), no backward compatibility is required. Deprecation per PRD-108-R12 announces the window via the `000-governance` channel.

---

## Security considerations

This section documents the security posture deltas that PRD-300 introduces. The project-wide threat model lives in PRD-109; PRD-300's deltas are around build-time `extract` execution, error-message hygiene, and the data PII surface in component instrumentation.

**Build-time `extract` runs in the main JS context (gap D3, no sandbox).** Per the Tier-D resolution adopted in `000-gaps-and-resolutions.md`, the binding does not sandbox `extract`. A malicious component contract can exfiltrate environment variables, read filesystem paths, or hang the build. This is a deliberate trade-off for v0.1 simplicity; sandbox options (vm2, isolated-vm, worker-thread isolation) are listed in this PRD's Open questions for v0.2 review. Producers are responsible for reviewing the `extract` functions in their codebase the same way they review any other build-time code. Cross-cuts PRD-109's threat model item "build-time code execution."

**`metadata.error` truncation prevents stack-trace and PII leakage in placeholders.** Per PRD-300-R22 and PRD-300-R32, the binding truncates error messages to ≤200 characters and redacts strings matching the v0.1 secret-pattern set: `Bearer `, `sk_live_[A-Za-z0-9]+`, `AKIA[A-Z0-9]{16}`, `ghp_[A-Za-z0-9]{36}` (GitHub PAT), `xoxb-[A-Za-z0-9-]+` (Slack bot token). The set is intentionally small and explicit — auditable, low false-positive — and is documented-open per the Versioning table (adding a pattern is MINOR). This is a SHOULD-shaped recommendation made MUST in this PRD because component-contract failures are emitted into ACT envelopes consumed by agents — leaking a stack trace into `metadata.error` is a direct exfiltration path. Producers MAY add additional pattern matchers in their generator config (PRD-400 provides the hook).

**`extract` MUST NOT receive request-scoped or user-scoped data (PRD-300-R32).** The contract surface is build-time-shaped. A binding wrapping a runtime SDK (a hypothetical "runtime component instrumentation" mode for SaaS apps with per-tenant content) MUST surface only build-time props to `extract`. The binding MUST NOT pass cookies, sessions, headers, user IDs, or tenant IDs into `extract`'s `props` or `ctx`. The risk: an `extract` that accidentally produces a `summary` containing `req.user.email` gets emitted into a static ACT file or, worse, a per-tenant runtime ACT response cached by ETag. Cross-cuts PRD-109-R11 (per-tenant ID stability) and PRD-109-R14 (no PII in error messages).

**Variant identity correlation.** Per PRD-102-R32 / PRD-300-R18, variant nodes carry `metadata.variant` with `base_id`, `key`, and `source`. A producer that emits both the canonical and a variant node tied to a specific identity (e.g., a personalization variant served to one user) leaks the identity-to-variant mapping if both nodes are observable in the same index. PRD-300-R16's opt-in default mitigates accidental emission. Producers serving runtime ACT MUST NOT emit personalization variants in the public-tenant index unless the variant is itself public. Cross-cuts PRD-109's correlation-attack surface.

**Headless-render fallback (PRD-300-R29) trades safety for adoption.** The headless render path runs the SPA in jsdom or Playwright at build time. The site's runtime data fetches happen against whatever endpoints the build environment can reach — typically build-time CMS APIs, but bindings MUST NOT silently allow headless renders to hit production runtime endpoints with build-environment credentials. PRD-300-R29 marks every emitted block with `metadata.extraction_method: "headless-render"` so consumers can apply lower confidence; the field is also a producer-side audit signal that the build crossed a non-deterministic boundary.

**Capability declaration is a producer claim.** Per PRD-300-R28 the binding publishes its capabilities; the generator trusts them. A buggy or hostile binding that claims `rsc: true` while walking the client tree produces non-deterministic extractions (PRD-300-R30 prohibits this but the binding could lie). Consumers / generators that depend on capability claims SHOULD verify by probe — e.g., compare server-tree-only output against client-walk output — at integration time. PRD-300 does not mandate this verification because it is the generator's responsibility (PRD-400 owns capability-flag verification).

PRD-109 owns the project-wide posture; the rules above are deltas, not duplications.

---

## Implementation notes

This section illustrates the canonical implementation shapes a binding follows. Snippets are TypeScript-style for clarity (per Q3, first-party reference impls are TS) but the contract is framework-agnostic.

#### 1. Desugaring three patterns to the canonical contract

```ts
// @act/core/src/desugar.ts
import type { ActContract } from "./types";

// Pattern 1: static field. The framework hands us a component with `.act` set.
export function fromStaticField<P>(component: { act?: ActContract<P> }): ActContract<P> | undefined {
  return component.act;
}

// Pattern 2: hook. The hook calls registerContract during render; the binding's provider collects.
const HOOK_CONTRACTS = new WeakMap<symbol, ActContract<unknown>>();
export function registerHookContract<P>(instance: symbol, contract: ActContract<P>) {
  HOOK_CONTRACTS.set(instance, contract as ActContract<unknown>);
}
export function fromHook<P>(instance: symbol): ActContract<P> | undefined {
  return HOOK_CONTRACTS.get(instance) as ActContract<P> | undefined;
}

// Pattern 3: decorator. The decorator stores the contract on the class.
const DECORATOR_KEY = Symbol.for("@act/contract");
export function fromDecorator<P>(cls: { [DECORATOR_KEY]?: ActContract<P> }): ActContract<P> | undefined {
  return cls[DECORATOR_KEY];
}
```

All three pathways converge on the same `ActContract<P>` shape per PRD-300-R3.

#### 2. The depth-first traversal that aggregates page contributions

```ts
// @act/core/src/traverse.ts
import type { ActContract, ContractOutput, ExtractionContext, NodeDraft } from "./types";

interface CollectInput {
  rootContract: ActContract<unknown>;     // the page-level contract
  rootProps: unknown;
  ctx: ExtractionContext;
  walkChildren: () => Iterable<{ contract: ActContract<unknown>; props: unknown }>;
}

export function aggregatePage(input: CollectInput): NodeDraft {
  const { rootContract, rootProps, ctx, walkChildren } = input;
  if (!rootContract.id) throw new BuildError("page-level contract missing id (PRD-300-R10)");

  // Page-level extract is typically a stub; collect its title/summary/related.
  const pageExtract = invokeExtract(rootContract, rootProps, ctx); // ContractOutput-shaped

  // Aggregate descendants in render order, per PRD-300-R9.
  const blocks: ContractOutput[] = [];
  for (const { contract, props } of walkChildren()) {
    const out = safeExtract(contract, props, ctx);     // PRD-300-R22 placeholder fallback
    const normalized = Array.isArray(out) ? out : [out];
    for (const block of normalized) {
      blocks.push(stampMetadata(block, ctx));          // PRD-300-R21 + R29
    }
  }

  return {
    id: rootContract.id,
    type: rootContract.type,
    title: getTitle(rootContract, pageExtract),
    summary: rootContract.summary ?? getSummary(pageExtract) ?? "",
    content: blocks,
    related: rootContract.related,
    metadata: {},
  };
}
```

#### 3. The placeholder helper (PRD-300-R22)

```ts
// @act/core/src/placeholder.ts
const SECRET_PATTERNS = [
  /Bearer\s+[A-Za-z0-9._-]+/g,
  /sk_live_[A-Za-z0-9]+/g,
  /AKIA[A-Z0-9]{16}/g,
  /ghp_[A-Za-z0-9]{36}/g,            // GitHub personal access token
  /xoxb-[A-Za-z0-9-]+/g,             // Slack bot token
];

function redactSecrets(s: string): string {
  return SECRET_PATTERNS.reduce((acc, re) => acc.replace(re, "[REDACTED]"), s);
}

export function buildPlaceholder(opts: {
  error: Error | string;
  component?: string;
  location?: string;
}): ContractOutput {
  const raw = typeof opts.error === "string" ? opts.error : opts.error.message;
  const redacted = redactSecrets(raw);
  const truncated = redacted.slice(0, 200);
  return {
    type: "marketing:placeholder",
    metadata: {
      extracted_via: "component-contract",
      extraction_status: "failed",
      ...(truncated ? { error: truncated } : {}),
      ...(opts.component ? { component: opts.component } : {}),
      ...(opts.location ? { location: opts.location } : {}),
    },
  };
}

export function safeExtract(
  contract: ActContract<unknown>,
  props: unknown,
  ctx: ExtractionContext,
): ContractOutput | ContractOutput[] {
  try {
    const result = contract.extract(props, ctx);
    if (result && typeof (result as { then?: unknown }).then === "function") {
      // PRD-300-R7: Promise return is undefined behaviour; emit placeholder.
      ctx.warn(`extract returned a Promise; emitting placeholder (PRD-300-R7)`);
      return buildPlaceholder({ error: "extract returned a Promise" });
    }
    return result;
  } catch (e) {
    ctx.warn(`extract threw; emitting placeholder (PRD-300-R22)`);
    return buildPlaceholder({ error: e as Error });
  }
}
```

#### 4. The variant replay loop (PRD-300-R15)

```ts
// @act/core/src/variants.ts
export async function* renderVariants(
  pageContract: PageContract,
  baseRender: (ctx: ExtractionContext) => Promise<NodeDraft>,
  baseCtx: ExtractionContext,
): AsyncIterable<NodeDraft> {
  const variants = pageContract.variants ?? "default";

  // Always emit the canonical / base node (PRD-102-R30).
  yield await baseRender({ ...baseCtx, variant: undefined });

  if (variants === "default") return;

  const keys = variants === "all" ? discoverAllVariants(pageContract) : variants;
  if (keys.length > 64) {
    throw new BuildError(`variant matrix ${keys.length} exceeds cap (PRD-300-R17)`);
  }

  for (const key of keys) {
    const variantId = `${pageContract.id}@${key}`;
    const node = await baseRender({ ...baseCtx, variant: key });
    node.id = variantId;
    node.metadata = {
      ...node.metadata,
      variant: { base_id: pageContract.id, key, source: "experiment" },
    };
    node.related = [
      ...(node.related ?? []),
      { id: pageContract.id, relation: "variant_of" },
    ];
    yield node;
  }
}
```

#### 5. The capability-driven dispatch in the generator (PRD-300-R28)

```ts
// PRD-400 (generator architecture) consumes this. Sketch only.
export function chooseExtractionMode(caps: BindingCapabilities): ExtractionMode {
  if (caps.rsc && caps["ssr-walk"]) return "rsc-ssr";
  if (caps["ssr-walk"]) return "ssr-walk";
  if (caps["static-ast"]) return "static-ast";
  if (caps["headless-render"]) return "headless-render";
  throw new BuildError(`binding declares no usable extraction mode (PRD-300-R28)`);
}
```

The generator's full implementation lives in PRD-400; this snippet shows the dispatch shape PRD-300 enables.

#### 6. The contract-version gate (PRD-300-R27)

```ts
export function gateContractVersion(contract: ActContract<unknown>, bindingVersion: string): void {
  const [contractMajor] = contract.contract_version.split(".").map(Number);
  const [bindingMajor] = bindingVersion.split(".").map(Number);
  if (contractMajor > bindingMajor) {
    throw new BuildError(
      `contract_version ${contract.contract_version} exceeds binding's supported MAJOR ${bindingMajor} (PRD-300-R27)`,
    );
  }
  // MINOR mismatch: tolerate per PRD-108-R7. No-op.
}
```

These snippets are illustrative; full framework-specific implementations live in PRD-301 / PRD-302 / PRD-303. The shared `@act/core` package per Q3's TS-only decision houses the framework-agnostic helpers above.

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft. Pins the canonical contract object shape (`type`, `id`, `summary`, `related`, `variants`, `contract_version`, `extract`), the three-pattern equivalence rule (gap D1), the page-level aggregation in render order with `id`-collision-as-error semantics, the variant emission protocol (opt-in, integrating PRD-102-R29–R32, gap D2), the static-vs-runtime delivery-inert contract surface, the extraction-failure placeholder rule (gap B4 / PRD-102-R22), the build-time safety stance (gap D3, no sandbox, error truncation, secret redaction), the headless-render fallback marking (gap D4 Tier-2), the binding capability matrix (`ssr-walk`, `static-ast`, `headless-render`, `rsc`, `streaming`, `suspense`, `concurrent`), the `contract_version` field with PRD-108-aligned MAJOR/MINOR rules, and the test-fixture surface under `fixtures/300/`. Cites PRD-100 R10/R21–R31, PRD-102 R1–R11/R21–R32, PRD-107 R6/R8/R10, PRD-108 R4/R5/R7, PRD-109 (PII posture). Resolves Tier-D gaps D1, D2, D3, D4 and Tier-B gap B4. Status: In review. |
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review. Decisions: (1) `extract` stays synchronous in v0.1 — async deferred to v0.2 as a MAJOR change; (2) block ordering is render-order-only — no `priority` hints; (3) no binding-level `onExtractError` hook — placeholder customisation belongs in generator report tooling. Ratified judgment calls: variant cap of 64 per page (R17); `metadata.error` 200-char truncation + secret-pattern redaction (R32); capability matrix closed at v0.1; per-contract `contract_version` REQUIRED on every contract (R26); page-level `id` collision as hard build error (R11); static-AST extraction explicitly partial (R28+R29). |
| 2026-05-01 | Jeremy Forsythe | Normative change: PRD-300-R32 secret-pattern set broadened to include `ghp_[A-Za-z0-9]{36}` (GitHub PAT) and `xoxb-[A-Za-z0-9-]+` (Slack bot token). The set remains documented-open at the spec layer; adding a pattern is MINOR per PRD-108-R4(3). Implementation notes' SECRET_PATTERNS list and Security considerations updated to match. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
