# PRD-203 — Sanity adapter

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

Sanity is one of the most widely deployed headless CMSes in the JS ecosystem. Its data model — a Content Lake of structured documents queried via GROQ, with portable-text rich content as the canonical body shape, and a real-time listening API for change feeds — does not map onto ACT trivially. Without a first-party Sanity adapter, every Sanity-backed site that wants to ship ACT has to roll its own GROQ-to-ACT translator, its own portable-text-to-content-block walk, its own reference-resolution depth limits, and its own incremental rebuild glue. Decision Q3 (TS-only first-party reference impls) commits ACT v0.1 to ship a TypeScript Sanity adapter; PRD-200 (`In review`, status carried into v0.1 with this PRD's siblings) defines the framework contract this adapter implements; PRD-100, PRD-102, PRD-103, PRD-107, PRD-108, and PRD-109 (all Accepted) define the wire-format envelopes, content-block taxonomy, ETag derivation, conformance bands, versioning regime, and security posture this adapter must respect. This PRD specifies how a Sanity adapter satisfies all of that.

The aspirational design partner for the CMS profile is Contentful (decision Q7, deferred); Sanity is a sibling adapter exercising the same framework against a different shape (Content Lake + GROQ vs. Delivery API + entries). Both surface the same gap E6 (CMS schema mapping DSL unification) — explicitly deferred to v0.2 — so this PRD documents Sanity's mapping conventions without attempting cross-CMS unification.

### Goals

1. Lock the **adapter configuration** schema for a Sanity adapter — project ID, dataset, API token, API version, GROQ filter, content-type to ACT-type mapping, field mapping rules, reference-resolution depth, locale handling.
2. Lock the **content-type → ACT type mapping** with sensible defaults and per-document-type overrides.
3. Lock the **field mapping** from Sanity document fields to ACT node fields: title, summary, body, tags, references → `related`.
4. Lock the **portable-text → ACT content blocks** walk: portable-text blocks become `prose`/`markdown`/`code`/`callout` blocks per PRD-102; custom block types in the configured `marketing:*` mapping become Plus-tier blocks.
5. Lock **reference resolution** semantics: GROQ `*[_type == ...]` patterns; configurable resolution depth (default 1); cycles tolerated per PRD-102-R20.
6. Lock the **incremental rebuild** path via Sanity's listening API (`client.listen(query)`), surfaced through the adapter framework's `delta(since)` hook (PRD-200-R9). The opaque marker is the latest Sanity transaction ID.
7. Lock the **locale handling** when Sanity's native i18n is in use: emit `metadata.locale`, `metadata.translations` partials that PRD-207 (i18n adapter) cooperates with via the framework's merge step.
8. Lock the **capability declaration** the adapter returns from `init`, including incremental rebuilds, abstract/related support, locale support, and `marketing:*` namespace emission when configured.
9. Lock the **failure modes** — rate limit (recoverable, retry-with-backoff), auth failure (unrecoverable, fail in `init`), partial-extraction warnings (recoverable, `metadata.extraction_status: "partial"`).
10. Declare **conformance**: Standard by default with `abstract` and `related` mapped; Plus when locale is configured AND `marketing:*` blocks are mapped from Sanity custom block types.
11. Provide a TypeScript implementation-notes section with 3–6 short snippets covering the adapter shape, GROQ query construction, portable-text walk, reference resolution, and the listening-API delta path.
12. Enumerate the **test fixture matrix** under `fixtures/203/positive/` and `fixtures/203/negative/`.

### Non-goals

1. **Defining the adapter framework.** Owned by PRD-200 (in review). This PRD inherits PRD-200's contract and only specifies Sanity-specific behavior.
2. **Defining the wire format.** Owned by PRD-100 (Accepted). Adapter output validates against PRD-100's schemas; this PRD does not redefine envelopes.
3. **Defining content blocks.** Owned by PRD-102 (Accepted). The portable-text walk produces blocks per PRD-102's catalog.
4. **Defining ETag derivation.** Owned by PRD-103 (Accepted). The Sanity adapter does NOT compute ETags itself; the generator (PRD-400) computes static ETags per PRD-103-R4 over the merged node payload.
5. **Defining conformance levels.** Owned by PRD-107 (Accepted). This PRD declares which level its emission satisfies.
6. **Defining versioning.** Owned by PRD-108 (Accepted). This PRD applies PRD-108-R14 / R15 staged pinning per PRD-200-R25 / R26.
7. **Defining the i18n adapter.** Owned by PRD-207 (in flight). The Sanity adapter cooperates via the merge step but does not subsume PRD-207.
8. **Defining the component-contract seam.** Owned by PRD-300 (in flight). Sanity is a content adapter, not a component-instrumentation adapter; component contracts arrive from the framework binding (PRD-301), not from the CMS.
9. **Unifying the CMS mapping DSL across PRD-202/203/204/205/206.** Per gap E6, deferred to v0.2.
10. **Authoring a non-TypeScript Sanity adapter.** Per decision Q3, v0.1 is TS-only.

### Stakeholders / audience

- **Authors of:** PRD-702 aspirational example (corporate marketing site — Sanity could substitute for Contentful as the CMS adapter); other 700-series examples that exercise CMS-backed content.
- **Consumers of:** PRD-400 (generator architecture) and the per-framework generators (PRD-401 Astro, PRD-405 Next.js, etc.) when configured with the Sanity adapter.
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| GROQ filter expression flexibility creates a footgun where users emit too-broad or too-narrow result sets and the build silently misses content | Medium | Medium | The default config emits a warning when the GROQ result set is empty AND no explicit `allowEmpty: true` flag is set; PRD-203-R4 / R5 specify the required filter shape. Negative fixture covers the empty-result case. |
| Portable-text → block walk loses semantic detail (e.g., custom marks like `code` inline) | Medium | Medium | The default walk maps all standard portable-text blocks to `prose` with markdown formatting; custom marks are converted to inline markdown syntax. Custom block types fall back to `marketing:*` blocks when configured, otherwise produce `metadata.extraction_status: "partial"` warnings. |
| Reference resolution depth explodes — cycles or deep graphs cause memory blowup at build | Medium | High | Default depth is 1; PRD-203-R12 caps depth at 5; cycles in reference graphs are detected and surface as warnings, not errors (consumers walk `related` per PRD-102-R20). |
| Sanity API token leaks into manifest / index / nodes via misconfigured adapter logging | Low | High | PRD-203-R23 prohibits logging the token (cites PRD-109-R14 / R15); PRD-203-R24 prohibits emitting the token in any envelope field. PRD-600 (validator) probes for high-entropy strings per PRD-200's security posture. |
| Listening API delta marker drift across replicas — different replicas hold different "latest transaction ID" cursors | Low | Medium | The delta marker is opaque to the framework; the adapter persists it in `dispose`-reachable state and reads on next `delta(since)`. Marker collision across replicas is the operator's concern, not the adapter's; documented as a non-goal of v0.1. |
| Sanity dataset includes drafts AND published documents; adapter accidentally emits draft content as published | Medium | High | PRD-203-R3 requires explicit `version: "published" \| "draft" \| "previewDraft"` config (default `"published"`); negative fixture catches misconfiguration. |
| Adapter version pinning surprises users on a spec MINOR bump | Low | Medium | PRD-200-R25 (Stage 1) is in effect at v0.1; an `act-sanity@0.1.x` package emits `act_version: "0.1"` only. Migration to Stage 2 (R26) is per-package and per-decision. |

### Open questions

1. ~~Should the adapter expose a built-in **summary generator** for documents that lack a `summary` field, or always defer to the operator's mapping?~~ **Resolved (2026-05-01): Defer with strategy override.** The adapter emits `summary_source: "extracted"` with first-paragraph extraction (capped at 50 tokens per PRD-102-R26) when no `summary` field is configured, and exposes the `summary: { strategy: "field" | "extract" | "needs-llm" }` config for operators who need explicit control. (Closes Open Question 1.)
2. ~~Should the adapter normalize Sanity slug fields (`{ current: "...", _type: "slug" }`) into ACT IDs automatically, or require explicit field mapping?~~ **Resolved (2026-05-01): Automatic with override.** The adapter recognizes `_type: "slug"` shapes and uses `slug.current` as the ID source by default; explicit `idField` config overrides. (Closes Open Question 2.)
3. ~~Should the adapter emit a synthetic `marketing:*` block for Sanity object-typed fields configured as marketing components, or surface them as opaque structured payload in `metadata`?~~ **Resolved (2026-05-01): Configurable opt-in.** The `componentMapping` config (PRD-203-R8) is opt-in; without it, custom block types become `metadata.extraction_status: "partial"` warnings rather than spurious `marketing:*` emissions. Strict over permissive — silently inventing `marketing:*` blocks would be silent corruption. (Closes Open Question 3.)

### Acceptance criteria

- [ ] Every normative requirement has an ID `PRD-203-R{n}` and a declared conformance level per PRD-107.
- [ ] The Specification section opens with a table mapping every requirement to the parent PRD-200 + 100-series requirement(s) it implements.
- [ ] The Implementation notes section contains 3–6 short TypeScript snippets covering: the `Adapter` shape, the GROQ query construction, the portable-text walk, the reference-resolution helper, the listening-API delta path, and the failure-emission shape.
- [ ] Test fixture paths under `fixtures/203/positive/` and `fixtures/203/negative/` are enumerated; one fixture per major requirement.
- [ ] Versioning & compatibility section classifies kinds-of-change to PRD-203 per PRD-108.
- [ ] Security section cites PRD-109 and documents Sanity-specific deltas (token handling, listening-API webhook trust).
- [ ] Changelog entry dated 2026-05-01 by Jeremy Forsythe is present.

---

## Context & dependencies

### Depends on

- **PRD-200** (in review) — adapter framework. The Sanity adapter implements the `Adapter` interface, the lifecycle, the merge contract, the failure modes, and the capability declaration pinned by PRD-200.
- **PRD-100** (Accepted) — wire format. Every emitted node validates against `schemas/100/node.schema.json`.
- **PRD-102** (Accepted) — content blocks. Portable-text → block walk produces blocks satisfying PRD-102's per-type schemas.
- **PRD-103** (Accepted) — caching / ETag derivation. The adapter does not compute ETags; the generator does.
- **PRD-107** (Accepted) — conformance levels. The adapter declares Standard by default, Plus when locale + `marketing:*` are configured.
- **PRD-108** (Accepted) — versioning. Stage 1 pinning at v0.1 per PRD-200-R25.
- **PRD-109** (Accepted) — security. Threat T2 (token leakage), T5 (PII in error messages), T6 (cross-origin trust for Sanity's CDN-hosted asset URLs) cited.
- **PRD-207** (in flight) — i18n adapter. The Sanity adapter cooperates via PRD-200's merge step when both are configured.
- External: [Sanity Content Lake](https://www.sanity.io/docs/datastore), [GROQ](https://www.sanity.io/docs/groq), [Portable Text](https://github.com/portabletext/portabletext), [Sanity Listening API](https://www.sanity.io/docs/listening), [Sanity JS Client](https://www.sanity.io/docs/js-client). All cited for shape, none normatively adopted beyond the data shapes the adapter consumes.

### Blocks

- No direct blocks. PRD-702 (aspirational corporate-marketing example) MAY use this adapter in lieu of Contentful (PRD-202).

### References

- v0.1 draft: §5.10 (adapter pipeline informal sketch), §5.10.3 (multi-source merge example with CMS contributors).
- `prd/000-gaps-and-resolutions.md` gap **E6** (CMS schema mapping DSL deferred to v0.2 — documented here as a known divergence).
- `prd/000-decisions-needed.md` Q3 (TS-only ref impl), Q5 (adapter pinning, staged), Q7 (design partners, deferred).
- Prior art: [`@sanity/client`](https://www.npmjs.com/package/@sanity/client), [`@portabletext/to-html`](https://github.com/portabletext/to-html), [`@sanity/groq-store`](https://github.com/sanity-io/groq-store), [`gatsby-source-sanity`](https://www.gatsbyjs.com/plugins/gatsby-source-sanity/), [`sanity-codegen`](https://github.com/ricokahler/sanity-codegen). Cited for shape; the adapter's API surface follows `@sanity/client`'s conventions for query construction and listening.

---

## Specification

This is the normative section. Every requirement uses RFC 2119 keywords as clarified by RFC 8174.

### Parent + 100-series requirements implemented

The table maps every PRD-203 requirement to the PRD-200 framework requirement and/or 100-series requirement it implements. This satisfies the workflow.md Phase 3 rule that every P2 leaf PRD declare the parent surface it implements.

| PRD-203 requirement | Parent/100-series requirement(s) | Relationship |
|---|---|---|
| R1 (interface compliance) | PRD-200-R1 | Implements `Adapter`. |
| R2 (config schema) | PRD-200-R3, R20 | Adapter-defined config validated in `init`. |
| R3 (version field — `published` vs `draft`) | PRD-200-R3 | Config-time field; defaults to `published`. |
| R4 (GROQ filter) | PRD-200-R4 | `enumerate` runs the configured GROQ. |
| R5 (filter result safety) | PRD-200-R18 | Empty result + no `allowEmpty` flag → warning. |
| R6 (content-type mapping) | PRD-100-R21 (`type` field), PRD-200-R5 | Maps Sanity `_type` → ACT `type`. |
| R7 (field mapping) | PRD-100-R21, PRD-100-R22 | Maps Sanity fields → ACT envelope fields. |
| R8 (portable-text walk) | PRD-102-R1, R2, R3, R5 | Portable-text → `prose`/`markdown`/`code`/`callout`. |
| R9 (custom block types — Plus) | PRD-102-R6, R7–R11 | Custom Sanity block types → `marketing:*` blocks when configured. |
| R10 (reference resolution) | PRD-102-R18, R19, R20 | Sanity `_ref` → ACT `related[]`. |
| R11 (resolution depth bound) | — | Default 1; max 5. |
| R12 (cycle handling in references) | PRD-102-R20 | Cycles tolerated; warning emitted. |
| R13 (locale handling) | PRD-100-R22, PRD-104 (in flight) | `metadata.locale` set when locale config present. |
| R14 (incremental rebuild via listening API) | PRD-200-R9 | Implements `delta(since)` over Sanity transaction IDs. |
| R15 (delta marker grammar) | PRD-200-R9 | Opaque to framework; Sanity transaction ID. |
| R16 (capability declaration) | PRD-200-R22 | Returns `AdapterCapabilities` from `init`. |
| R17 (level — Standard) | PRD-107-R8 | Default emission satisfies Standard. |
| R18 (level — Plus when configured) | PRD-107-R10 | Plus when `componentMapping` + locale are configured. |
| R19 (failure mode — rate limit) | PRD-200-R16 | Recoverable; retry with exponential backoff. |
| R20 (failure mode — auth) | PRD-200-R18 | Unrecoverable; throw from `init`. |
| R21 (failure mode — partial extraction) | PRD-200-R16, R17 | `metadata.extraction_status: "partial"`. |
| R22 (provenance metadata) | PRD-200-R13, PRD-100-R22 | `metadata.source` populated by framework. |
| R23 (security — no token in logs) | PRD-109-R14, R15 | Token redacted from logs. |
| R24 (security — no token in envelopes) | PRD-109-R1, R2, R14 | Token never emitted into manifest / index / nodes. |
| R25 (provenance — Sanity-specific source_id) | PRD-200-R13 | `source_id` is Sanity document `_id`. |
| R26 (Stage 1 pinning) | PRD-200-R25, PRD-108-R14 | `act-sanity@0.1.x` emits `act_version: "0.1"` only. |
| R27 (test-fixture conformance) | PRD-200-R28 | Adapter passes the framework + Sanity fixture corpora. |

### Conformance level

Per PRD-107. Each requirement is annotated below.

- **Core:** R1, R2, R4, R6, R7, R8 (markdown subset), R10 (basic reference emission), R16, R17, R20, R22, R23, R24, R25, R26, R27.
- **Standard:** R3, R5, R8 (full prose/code/callout walk), R10 (full reference resolution), R11, R12, R19, R21.
- **Plus:** R9 (`marketing:*` namespace emission), R13 (locale), R18.

A producer running this adapter at Plus satisfies all Standard and Core requirements per PRD-107-R11.

### Normative requirements

#### Adapter contract

**PRD-203-R1.** The `act-sanity` adapter MUST implement the `Adapter` interface defined in PRD-200-R1. The package's default export MUST satisfy `Adapter<SanityConfig, SanityDocument>` where `SanityConfig` is the configuration schema pinned by PRD-203-R2 and `SanityDocument` is opaque to the framework. Conformance: **Core**.

#### Configuration

**PRD-203-R2.** The adapter MUST validate its configuration against the schema below in `init` (per PRD-200-R3). Required fields: `projectId` (string), `dataset` (string), `apiToken` (string OR environment-variable reference). Optional fields: `apiVersion` (string, default `"2024-10-01"`), `version` (`"published" | "draft" | "previewDraft"`, default `"published"`), `groqFilter` (string, default `"*"`), `typeMapping` (object), `fieldMapping` (object), `referenceDepth` (integer 0–5, default 1), `componentMapping` (object, optional), `locale` (object, optional), `summary` (object, optional), `idField` (string, optional). Validation failures MUST cause `init` to reject with a structured error. Conformance: **Core**.

**PRD-203-R3.** The `version` config field MUST default to `"published"`. When set to `"draft"` or `"previewDraft"`, the adapter MUST query the corresponding Sanity dataset perspective and MUST stamp `metadata.preview: true` on every emitted node so consumers can distinguish preview content. The adapter MUST NOT emit draft content under a published-mode run; mixing perspectives in one run is a configuration error. Conformance: **Standard**.

**PRD-203-R4.** The adapter's `enumerate` MUST construct a GROQ query of the form `<groqFilter>[<projection>]` where `<projection>` is the projection necessary to fetch the fields named in `fieldMapping`, the `_id`, the `_type`, the `_updatedAt`, and the configured reference fields. The adapter MAY use GROQ's `[]` slicing for pagination. The adapter MUST NOT inject user-supplied strings into the projection without escaping (GROQ-injection avoidance). Conformance: **Core**.

**PRD-203-R5.** When the GROQ filter returns zero results AND the config does not set `allowEmpty: true`, the adapter MUST emit a build warning citing the filter expression and the result count (zero). The adapter MUST NOT throw — empty result sets are valid in some configurations — but the warning prevents silent misconfiguration. Conformance: **Standard**.

#### Content-type and field mapping

**PRD-203-R6.** The adapter MUST map Sanity document `_type` values to ACT `type` values per the `typeMapping` config. The default mapping is identity: a Sanity `_type: "article"` becomes ACT `type: "article"`. Operators MAY override per-`_type`: `typeMapping: { "blogPost": "article", "landingPage": "landing" }`. A document whose `_type` has no mapping entry and is not handled by the identity default (i.e., the default has been disabled) MUST be skipped (transform returns `null`); the adapter MUST emit a debug-log entry citing the skipped document's `_id`. Conformance: **Core**.

**PRD-203-R7.** The adapter MUST map Sanity document fields to ACT node fields per the `fieldMapping` config. The default mapping is:

| ACT field | Sanity source (default) | Notes |
|---|---|---|
| `id` | `slug.current` if present, else `_id` | Override via `idField`. |
| `title` | `title` | String required. |
| `summary` | `summary` if present, else first portable-text block extracted to plaintext (capped at 50 tokens) | When extracted, `summary_source: "extracted"`. |
| `abstract` | `abstract` if present | Otherwise omitted. |
| `content` | `body` (portable-text array) | Walked per PRD-203-R8. |
| `tags` (in `metadata.tags`) | `categories[]->title` (resolved reference) | Optional. |
| `related` | configured reference fields | Per PRD-203-R10. |
| `updated_at` | `_updatedAt` | RFC 3339. |
| `metadata.locale` | `__i18n_lang` or document-level `language` field | Per PRD-203-R13. |

Operators MAY override any row via `fieldMapping`. The adapter MUST emit a partial node with `metadata.extraction_status: "partial"` and an extraction-error message when a required field (`title`, `summary`) is unmappable rather than throwing. Conformance: **Core** (defaults), **Standard** (overrides + partial-emission path).

#### Portable-text walk

**PRD-203-R8.** The adapter MUST walk Sanity portable-text arrays into ACT content blocks per the following mapping:

- A portable-text block whose `_type: "block"` and `style: "normal"` (no list) becomes a single `prose` block with `format: "markdown"` (PRD-102-R2). The walker emits markdown formatting for marks (`em` → `*...*`, `strong` → `**...**`, `code` → `` `...` ``) and for inline links (`[text](href)`).
- A portable-text block with `style: "h1"`–`"h6"` becomes a `prose` block with the corresponding markdown heading level prepended.
- A portable-text block with `listItem: "bullet"` or `"number"` becomes a `prose` block carrying the markdown list syntax. Sequential list items in the same list MUST be coalesced into a single `prose` block per list.
- A portable-text block whose `_type` matches a configured code-block type (default `"code"`) becomes a `code` block (PRD-102-R3) with `language` taken from the document's `language` field (default `"text"`) and `text` from the document's `code` field.
- A portable-text block whose `_type` matches a configured callout/admonition type (default `"callout"`) becomes a `callout` block (PRD-102-R5) with `level` mapped per the document's `tone` field (`info` → `"info"`, `warning` → `"warning"`, `error` → `"error"`, `tip` → `"tip"`).
- A portable-text block whose `_type` does not match any of the above and is not handled by `componentMapping` (PRD-203-R9) MUST cause the adapter to emit a partial-extraction warning and fall back to a `prose` block whose `text` is `(unsupported block type: <_type>)`. Conformance: **Standard**.

The walker MUST preserve the source order of portable-text blocks (PRD-102-R24 — block ordering matches render order).

#### Custom block types — Plus

**PRD-203-R9.** When the adapter is configured with `componentMapping` (an object mapping Sanity custom-block `_type` values to `marketing:*` block types), the walker MUST emit the corresponding `marketing:*` block for any portable-text block whose `_type` matches a key in `componentMapping`. The mapping config takes the shape:

```json
{
  "componentMapping": {
    "heroBlock":     { "type": "marketing:hero",        "fields": { "headline": "title", "subhead": "subtitle", "cta": { "label": "ctaLabel", "href": "ctaHref" } } },
    "featureGrid":   { "type": "marketing:feature-grid", "fields": { "features": "items[].{title, description, icon}" } },
    "pricingTable":  { "type": "marketing:pricing-table","fields": { "tiers": "tiers[].{name, price, features}" } },
    "testimonial":   { "type": "marketing:testimonial",  "fields": { "quote": "quote", "author": "author.name", "role": "author.role", "org": "author.org" } },
    "faq":           { "type": "marketing:faq",          "fields": { "items": "questions[].{question, answer}" } }
  }
}
```

The emitted block MUST satisfy the per-type schema in PRD-102 (R7–R11). Configuring this mapping is the trigger for Plus-tier emission per PRD-203-R18. Conformance: **Plus**.

#### Reference resolution

**PRD-203-R10.** The adapter MUST resolve Sanity `_ref` references in configured `related` source fields into ACT `related[]` entries with shape `{ id, relation }` per PRD-102-R18. The default `relation` is `"see-also"` for unconfigured reference fields; operators MAY map per-field-name to other `relation` values via `fieldMapping.related: { fieldName: relation }`. The adapter MUST resolve the referenced document's ACT ID using the same `idField` strategy applied to the referencing document; cross-type references are permitted. Conformance: **Standard**.

**PRD-203-R11.** Reference resolution depth defaults to **1** (immediate references only; no transitive resolution). Operators MAY set `referenceDepth` between 0 and 5 inclusive. A `referenceDepth: 0` setting means no references are resolved; only the document's own fields are emitted. A value above 5 MUST cause `init` to reject with a configuration error. Each additional depth level multiplies the number of fetched documents; the adapter SHOULD log the cumulative document count after each depth pass. Conformance: **Standard**.

**PRD-203-R12.** Cycles in the resolved reference graph (document A references B, B references A) MUST be tolerated. The adapter MUST detect cycles during resolution and stamp `metadata.reference_cycles: <count>` on the affected node when one or more cycles were observed during its resolution. Per PRD-102-R20, cycles in `related` are permitted; this requirement formalizes Sanity-side detection so consumers walking the graph can apply appropriate cycle-detection bounds. Conformance: **Standard**.

#### Locale handling

**PRD-203-R13.** When the adapter's `locale` config is set, the adapter MUST emit `metadata.locale` on every emitted node, populated from the configured locale field (`__i18n_lang` for plugins like `@sanity/document-internationalization`, or a document-level `language` field). When a single Sanity document carries translations in sibling fields (the "field-level translations" pattern), the adapter MUST emit one ACT node per locale, with IDs of the form `{base_id}@{locale}` per PRD-102-R29 (variant ID grammar). When sibling Sanity documents represent different locales (the "document-level translations" pattern), the adapter MUST emit one ACT node per document and stamp `metadata.translations: [{ locale, id }, ...]` on each, identifying its sibling locale variants — this is the partial-emission shape PRD-207 (i18n adapter) cooperates with via the merge step. Conformance: **Plus**.

#### Incremental rebuilds

**PRD-203-R14.** The adapter MUST implement `delta(since: string, ctx)` per PRD-200-R9 by issuing a Sanity GROQ query of the form `*[_updatedAt > $since && (<groqFilter>)]` and yielding the matching documents. The `since` marker is opaque to the framework and is the adapter's responsibility to interpret. The adapter MUST declare `capabilities.delta: true` in its `init` return value. Conformance: **Standard**.

**PRD-203-R15.** The delta marker grammar is the latest Sanity transaction ID observed during the previous build, formatted as Sanity's native transaction ID string (a 22-char nanoid-like identifier). The adapter MUST persist the marker on `dispose` via `ctx.config.deltaMarkerSink` (a framework-supplied callback when the generator orchestrates incremental builds; absent for non-incremental generator runs). When `deltaMarkerSink` is absent, the adapter MUST NOT emit a marker and the next run MUST be a full rebuild. Conformance: **Standard**.

> Sanity's listening API (`client.listen(query)`) is the canonical change feed; the adapter MAY use it for long-lived dev-mode rebuilds, but for build-time incremental rebuilds the `_updatedAt > $since` query is sufficient and avoids a long-lived connection at build time.

#### Capability declaration

**PRD-203-R16.** The adapter's `init` MUST return an `AdapterCapabilities` (PRD-200-R22) populated as follows:

```ts
{
  level: "standard" | "plus",
  concurrency_max: 4,
  delta: true,
  namespace_ids: true,
  precedence: "primary",
  manifestCapabilities: {
    etag: true,
    subtree: true,
    ndjson_index: false,
    search: { template_advertised: false }
  },
  i18n: <true if locale config present>,
  componentContract: false,
  summarySource: "author"
}
```

The `level` is determined per PRD-203-R17 / R18. The `concurrency_max: 4` value reflects Sanity's default API rate budget; operators MAY override via config. `precedence: "primary"` indicates the adapter is a primary content source; an i18n adapter cooperating via merge declares `precedence: "fallback"` instead. Conformance: **Core**.

**PRD-203-R17.** The adapter MUST declare `level: "standard"` in its capability return value when no `componentMapping` is configured AND no `locale` config is set. Standard satisfies the corporate-marketing baseline when the site is single-locale and uses only canonical content blocks. Conformance: **Standard**.

**PRD-203-R18.** The adapter MUST declare `level: "plus"` when EITHER `componentMapping` is configured (the adapter emits `marketing:*` blocks) OR `locale` config is set (the adapter emits per-locale variants and `metadata.translations`). Both being set is the canonical Plus configuration for the corporate-marketing scenario. Conformance: **Plus**.

#### Failure modes

**PRD-203-R19.** Sanity API rate-limit responses (HTTP 429) MUST be handled by exponential backoff with at least 3 retries (default: 250ms, 500ms, 1000ms) before surfacing as a partial-extraction warning per PRD-203-R21. The adapter MUST honor the `Retry-After` header when present. Persistent rate-limit failure (all retries exhausted) MUST cause the affected document to be emitted as a partial node with `metadata.extraction_status: "partial"` and `metadata.extraction_error: "sanity rate limit exhausted"`. Conformance: **Standard**.

**PRD-203-R20.** Sanity authentication failure (HTTP 401 from any API request, or initial connection failure due to invalid `apiToken`) MUST cause `init` to reject with an unrecoverable error. The adapter MUST NOT continue with empty output; per PRD-200-R18, unrecoverable failures cause the build to exit non-zero. The error message MUST cite that authentication failed and MUST NOT include the token value (per PRD-203-R23). Conformance: **Core**.

**PRD-203-R21.** Item-level extraction failures (a portable-text block walk error, an unresolvable reference within configured depth, a malformed custom block type) MUST cause the adapter to emit a node with `metadata.extraction_status: "partial"` populated with a description of the failure in `metadata.extraction_error`. The build MUST NOT exit non-zero on item-level failures; the warning surfaces per PRD-200-R16. Conformance: **Standard**.

#### Provenance

**PRD-203-R22.** Every emitted node MUST carry `metadata.source` populated by the framework per PRD-200-R13. The adapter does not itself set `metadata.source`; it sets only the source-side identifier returned via the framework's emit path. Conformance: **Core**.

**PRD-203-R25.** The Sanity-specific `source_id` value (used in the framework's `metadata.source.source_id` field) MUST be the Sanity document's `_id`. When the adapter emits a per-locale variant via field-level translations (PRD-203-R13), `source_id` is `{document._id}#{locale}` to disambiguate. Conformance: **Standard**.

#### Security

**PRD-203-R23.** The adapter MUST NOT log the value of `apiToken` at any log level (`debug`, `info`, `warn`, `error`). The adapter MAY log the token's presence (e.g., `"sanity apiToken: present"` or `"sanity apiToken: missing"`) and MAY log the first 4 characters as a fingerprint for debugging if explicitly enabled by config. Cites PRD-109-R14 / R15. Conformance: **Core**.

**PRD-203-R24.** The adapter MUST NOT emit the `apiToken` value (or any prefix longer than 4 characters of it) into any envelope field — manifest, index, node `metadata`, `summary`, `abstract`, `content`. Cites PRD-109-R1 (no identity-correlated tokens in IDs) and PRD-109-R2 (no PII in summary / abstract / content beyond source). The token is build-time configuration only. Conformance: **Core**.

#### Version pinning

**PRD-203-R26.** Per PRD-200-R25 (Stage 1), the `act-sanity` package version MUST pin to a single spec `act_version` MAJOR.MINOR. The v0.1 release of this PRD's reference implementation pins to `act_version: "0.1"`; later spec MINOR bumps require a coordinated adapter MINOR release. Migration to Stage 2 (PRD-200-R26) MAY occur once an adapter author opts in by publishing a release that declares `actSpecMinors`. Conformance: **Core**.

#### Test fixtures

**PRD-203-R27.** The adapter MUST pass the framework conformance corpus enumerated in PRD-200-R28 AND the Sanity-specific corpus enumerated in §"Test fixtures" below. Conformance is binary per PRD-200-R28. Conformance: **Core**.

### Wire format / interface definition

PRD-203 introduces no new wire format. The adapter consumes Sanity's data shapes and emits PRD-100 envelopes. The adapter contract is the TypeScript interface inherited from PRD-200; the adapter-specific configuration shape is described below.

#### Configuration schema (TypeScript)

```ts
import type { Adapter } from "@act/adapter-framework";

export interface SanityConfig {
  /** Sanity project ID (required). */
  projectId: string;

  /** Sanity dataset (required, e.g., "production"). */
  dataset: string;

  /** API token. SHOULD reference an env var; never inline in committed config. */
  apiToken: string;

  /** Sanity API version pin (default "2024-10-01"). */
  apiVersion?: string;

  /** Which dataset perspective to query (default "published"). */
  version?: "published" | "draft" | "previewDraft";

  /** GROQ filter expression (default "*"). */
  groqFilter?: string;

  /** Whether an empty result set is permitted without warning. */
  allowEmpty?: boolean;

  /** Sanity _type → ACT type mapping. Identity by default. */
  typeMapping?: Record<string, string>;

  /** Sanity field → ACT envelope field mapping. */
  fieldMapping?: {
    title?:    string;
    summary?:  string;
    abstract?: string;
    body?:     string;
    tags?:     string;
    related?:  Record<string, string /* relation */>;
    [actField: string]: unknown;
  };

  /** ID field override (default `slug.current` then `_id`). */
  idField?: string;

  /** Reference resolution depth. 0–5; default 1. */
  referenceDepth?: number;

  /** Custom-block-type → marketing:* block mapping (Plus). */
  componentMapping?: Record<
    string,
    { type: `marketing:${string}`; fields: Record<string, string> }
  >;

  /** Locale config (Plus). */
  locale?: {
    field: string;            // e.g. "__i18n_lang" or "language"
    pattern: "field" | "document";  // field-level vs document-level translations
  };

  /** Summary strategy. */
  summary?: { strategy: "field" | "extract" | "needs-llm" };
}

export type SanityAdapter = Adapter<SanityConfig, SanityDocument>;
```

`SanityDocument` is the raw shape returned by `@sanity/client`'s GROQ query — opaque to the framework, walked by the adapter's `transform`.

### Errors

| Condition | Adapter behavior | Framework behavior | Exit code |
|---|---|---|---|
| `init` config validation failure (missing `projectId`, etc.) | Reject from `init` with structured error | Surface as build error | non-zero |
| `init` Sanity HTTP 401 (auth failed) | Reject from `init` per PRD-203-R20 | Surface as build error; do NOT log token | non-zero |
| `enumerate` GROQ returns 0 results, `allowEmpty != true` | Continue with empty output; emit warning per PRD-203-R5 | Surface warning | 0 |
| `transform` Sanity HTTP 429 (rate limit), retries exhausted | Emit partial node per PRD-203-R19 / R21 | Surface warning | 0 |
| `transform` portable-text walk encounters unmapped custom `_type` | Emit partial node per PRD-203-R8 / R21 | Surface warning | 0 |
| `transform` reference cycle detected | Tolerate; stamp `metadata.reference_cycles` per PRD-203-R12 | No warning by default | 0 |
| `transform` reference-resolution depth exceeded | Truncate at configured depth; no warning | No warning | 0 |
| `init` `referenceDepth > 5` | Reject from `init` per PRD-203-R11 | Surface as configuration error | non-zero |
| Adapter emits node with malformed `id` (PRD-100-R10 violation) | n/a (framework rejects) | Surface as build error per PRD-200 negative fixture | non-zero |

For runtime / wire-format errors, cite PRD-100 and PRD-106.

---

## Examples

### Example 1 — Standard configuration (no locale, no custom blocks)

```ts
// act.config.ts
import type { SanityConfig } from "@act/sanity-adapter";

export const sanityConfig: SanityConfig = {
  projectId: "p1q2r3s4",
  dataset: "production",
  apiToken: process.env.SANITY_API_TOKEN!,
  apiVersion: "2024-10-01",
  version: "published",
  groqFilter: '*[_type in ["article", "tutorial", "concept"]]',
  fieldMapping: {
    title:   "title",
    summary: "summary",
    body:    "body",
    related: { categories: "see-also", relatedArticles: "see-also" }
  },
  referenceDepth: 1
};
```

The adapter declares `level: "standard"` in `init`. Emitted nodes carry `prose` and `markdown` blocks from portable-text walks, `related[]` entries with `relation: "see-also"`, and `metadata.source.adapter: "act-sanity"`.

### Example 2 — Plus configuration (locale + custom blocks)

```ts
export const sanityConfig: SanityConfig = {
  projectId: "p1q2r3s4",
  dataset: "production",
  apiToken: process.env.SANITY_API_TOKEN!,
  groqFilter: '*[_type in ["landingPage", "article"]]',
  fieldMapping: { title: "title", summary: "summary", body: "body" },
  locale: { field: "__i18n_lang", pattern: "document" },
  componentMapping: {
    heroBlock: {
      type: "marketing:hero",
      fields: { headline: "headline", subhead: "subhead", cta: { label: "ctaLabel", href: "ctaHref" } }
    },
    pricingTable: {
      type: "marketing:pricing-table",
      fields: { tiers: "tiers[].{name, price, features}" }
    }
  }
};
```

The adapter declares `level: "plus"`. Emitted nodes for landing pages include `marketing:hero` and `marketing:pricing-table` blocks; emitted nodes carry `metadata.locale` and `metadata.translations` arrays linking sibling-locale documents.

### Example 3 — Emitted Standard-level node from a Sanity article

```json
{
  "act_version": "0.1",
  "id": "act-sanity/intro/getting-started",
  "type": "tutorial",
  "title": "Getting started with Acme",
  "summary": "Install the SDK and send your first request in 5 minutes.",
  "summary_source": "author",
  "content": [
    { "type": "prose", "format": "markdown", "text": "## Install\n\nFirst, install the SDK." },
    { "type": "code", "language": "bash", "text": "npm install @acme/sdk" },
    { "type": "callout", "level": "warning", "text": "Node 18 or higher is required." }
  ],
  "tokens": { "summary": 13, "body": 920 },
  "etag": "<computed by generator per PRD-103-R4>",
  "related": [
    { "id": "act-sanity/concepts/authentication", "relation": "see-also" },
    { "id": "act-sanity/reference/widgets-api",   "relation": "see-also" }
  ],
  "updated_at": "2026-04-15T09:32:11Z",
  "metadata": {
    "source": {
      "adapter":   "act-sanity",
      "source_id": "abc123-456-doc-id"
    }
  }
}
```

### Example 4 — Plus-level emission with `marketing:hero` from `componentMapping`

```json
{
  "act_version": "0.1",
  "id": "act-sanity/landing/pricing",
  "type": "landing",
  "title": "Pricing",
  "summary": "Acme pricing tiers and plan comparison.",
  "content": [
    {
      "type": "marketing:hero",
      "headline": "Pricing that scales with you.",
      "subhead": "Start free. Pay as you grow.",
      "cta": { "label": "Start free trial", "href": "/signup" }
    },
    {
      "type": "marketing:pricing-table",
      "tiers": [
        { "name": "Starter", "price": "$0/mo",      "features": ["Up to 1,000 requests/mo"] },
        { "name": "Pro",     "price": "$49/mo",     "features": ["100,000 requests/mo", "99.9% SLA"] },
        { "name": "Ent",     "price": "Contact us", "features": ["Unlimited requests", "Custom SLA"] }
      ]
    }
  ],
  "tokens": { "summary": 10, "body": 260 },
  "etag": "<computed by generator>",
  "metadata": {
    "locale": "en-US",
    "translations": [
      { "locale": "es-ES", "id": "act-sanity/landing/pricing@es-es" }
    ],
    "source": { "adapter": "act-sanity", "source_id": "landing-pricing-doc" }
  }
}
```

### Example 5 — Partial-extraction warning (rate-limit exhausted)

```json
{
  "act_version": "0.1",
  "id": "act-sanity/article/rate-limited-doc",
  "type": "article",
  "title": "Rate-limited document",
  "summary": "Article body could not be fetched due to API rate limits.",
  "content": [],
  "tokens": { "summary": 11, "body": 0 },
  "etag": "<computed by generator>",
  "metadata": {
    "extraction_status": "partial",
    "extraction_error": "sanity rate limit exhausted after 3 retries (last: 250ms, 500ms, 1000ms)",
    "source": { "adapter": "act-sanity", "source_id": "doc-id-rate-limited" }
  }
}
```

The build emits a warning citing this node and exits zero. PRD-600 surfaces the warning in its conformance report.

### Example 6 — Incremental rebuild via delta marker

```ts
// generator orchestrates two consecutive builds:

// Run 1: initial build, no marker.
await runAdapter(sanityAdapter, config, { ...ctx, deltaMarkerSink: writeMarker });
// adapter writes marker = "tx_aBcDeFgHiJkL12345"  (latest Sanity transaction ID seen)

// Run 2: incremental, with the marker.
await runAdapter(sanityAdapter, config, {
  ...ctx,
  previousMarker: "tx_aBcDeFgHiJkL12345",
  deltaMarkerSink: writeMarker
});
// adapter calls delta(since="tx_aBcDeFgHiJkL12345"), yields only documents with _updatedAt > marker
// adapter writes new marker.
```

---

## Test fixtures

Fixtures live under `fixtures/203/`. Each leaf adapter test runs the adapter against a recorded Sanity-API response (Pact-style HTTP cassette or fixture JSON) and asserts the emitted nodes / warnings / errors match.

### Positive

- `fixtures/203/positive/standard-emission.json` → satisfies R1, R2, R4, R6, R7, R8, R10, R16, R17, R22.
- `fixtures/203/positive/plus-emission-with-locale.json` → satisfies R13, R18, R22 with `metadata.locale` and `metadata.translations`.
- `fixtures/203/positive/plus-emission-with-component-mapping.json` → satisfies R9, R18 with `marketing:hero`, `marketing:pricing-table`.
- `fixtures/203/positive/portable-text-walk.json` → satisfies R8 across `prose`, `code`, `callout`, list-coalescing.
- `fixtures/203/positive/reference-resolution-depth-1.json` → satisfies R10, R11 with depth 1.
- `fixtures/203/positive/reference-cycle-tolerated.json` → satisfies R12 with `metadata.reference_cycles: 1`.
- `fixtures/203/positive/delta-incremental.json` → satisfies R14, R15 across two consecutive builds.
- `fixtures/203/positive/draft-mode.json` → satisfies R3 with `metadata.preview: true`.
- `fixtures/203/positive/idfield-slug-default.json` → satisfies R7 (default `slug.current` ID source).
- `fixtures/203/positive/idfield-override.json` → satisfies R7 (explicit `idField` config).
- `fixtures/203/positive/summary-extracted-fallback.json` → satisfies R7 with `summary_source: "extracted"`.
- `fixtures/203/positive/concurrency-limited-to-4.json` → satisfies R16 (`concurrency_max: 4`).
- `fixtures/203/positive/empty-filter-allowed.json` → satisfies R5 (with `allowEmpty: true`, no warning).

### Negative

- `fixtures/203/negative/init-missing-projectid.expected.json` → MUST be rejected because `projectId` is required (R2).
- `fixtures/203/negative/init-auth-failed.expected.json` → MUST throw from `init` per R20; build exits non-zero; token MUST NOT appear in error message.
- `fixtures/203/negative/init-reference-depth-exceeds-5.expected.json` → MUST reject `referenceDepth: 6` per R11.
- `fixtures/203/negative/empty-filter-default-warns.expected.json` → MUST emit a warning per R5 when zero results returned and `allowEmpty` not set.
- `fixtures/203/negative/portable-text-unmapped-type.expected.json` → MUST emit `metadata.extraction_status: "partial"` per R8 / R21 with the unmapped `_type` cited.
- `fixtures/203/negative/rate-limit-exhausted.expected.json` → MUST emit partial node per R19 / R21 after 3 retries.
- `fixtures/203/negative/token-in-log.expected.json` → MUST NOT contain the API token at any log level per R23 (test scrapes captured logs).
- `fixtures/203/negative/token-in-envelope.expected.json` → MUST NOT contain the API token in any emitted envelope field per R24.
- `fixtures/203/negative/component-mapping-malformed-block.expected.json` → MUST emit `marketing:placeholder` (or partial-extraction warning) when `componentMapping` references a block whose required fields are missing in source.
- `fixtures/203/negative/version-pinning-stage-1-mismatch.expected.json` → MUST refuse to run when generator targets a different spec MINOR per R26.
- `fixtures/203/negative/draft-and-published-mixed.expected.json` → MUST reject configs that attempt to mix perspectives in one run per R3.
- `fixtures/203/negative/locale-pattern-invalid.expected.json` → MUST reject `locale.pattern` outside `{field, document}` per R13's grammar.

---

## Versioning & compatibility

Per PRD-108, classify each kind of change to PRD-203 as MAJOR or MINOR.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add an optional field to `SanityConfig` (e.g., `useCdn: boolean`) | MINOR | PRD-108-R4(1). Adapter tolerates absence. |
| Add a new value to a content-type / field-mapping default | MINOR | PRD-108-R4(3). |
| Add a new portable-text-block recognition (e.g., `image` → custom block) | MINOR | New optional walker rule; existing walks unaffected. |
| Add a new `componentMapping` target type within `marketing:*` | MINOR | Per PRD-102-R6 (documented-open namespace). |
| Tighten `referenceDepth` max from 5 to 3 | MAJOR | PRD-108-R5(6) (syntactic constraint on a documented field's value range). |
| Loosen `referenceDepth` max from 5 to 10 | MAJOR | Same — changes the bound consumers may rely on. |
| Change the default `version` from `"published"` to `"draft"` | MAJOR | PRD-108-R5(2) (changing the semantics of a documented default). |
| Promote `summary` to required at the adapter-config level | MAJOR | PRD-108-R5(3). |
| Add a value to the closed `version` enum (e.g., `"raw"`) | MAJOR | PRD-108-R5(4). |
| Change the `metadata.source.adapter` value from `"act-sanity"` to a different string | MAJOR | Provenance grammar change; downstream tooling depends on the literal. |
| Change the delta-marker grammar (e.g., from Sanity transaction ID to RFC 3339 timestamp) | MAJOR | PRD-108-R5(2). |
| Promote Stage 2 pinning (PRD-200-R26) opt-in for this adapter | MINOR | Per PRD-200-R26 — opting into Stage 2 is a per-adapter, per-release decision. |
| Editorial / prose clarification with no normative effect | n/a | Per `000-governance` R18. |

### Forward compatibility

A consumer of the `act-sanity` package implementing v0.1 MUST tolerate unknown optional fields in `AdapterCapabilities` and unknown optional fields in adapter-emitted node `metadata`. The adapter MUST NOT emit fields outside its declared `level`'s permitted block types; level-aware emission per PRD-200-R24 prevents inflation.

### Backward compatibility

A `act-sanity@0.1.x` package emits envelopes whose `act_version: "0.1"`. A future `act-sanity@0.2.x` aligns to spec `0.2`; coordinated release per PRD-200-R25 (Stage 1). Users upgrading their spec also upgrade their adapter version. Adapter-level config additions (R4(1) MINOR changes) preserve previous behavior under default values.

---

## Security considerations

Cites PRD-109 (Accepted) for the project-wide threat model. Sanity-specific deltas:

**Token handling (T2, T5).** The Sanity API token (`apiToken`) is the most sensitive build-time secret. PRD-203-R23 prohibits logging it; PRD-203-R24 prohibits emitting it into any envelope field. Operators SHOULD reference the token via environment variable (e.g., `SANITY_API_TOKEN`) and never inline the value in committed config. The adapter SHOULD validate the token's format (Sanity tokens are typically 30+ ASCII alphanumeric characters) before using it, and SHOULD log a fingerprint (first 4 chars) for debugging only when `config.debugLogging: true` is explicitly set.

**Network fan-out and rate-limit awareness.** Sanity's free-tier rate limits are the most common cause of build failures. The adapter MUST honor `Retry-After` per PRD-203-R19 and SHOULD apply per-build rate-limit budgeting (informational): log the cumulative request count after `enumerate` and after each reference-resolution depth pass. PRD-109 owns the project-wide DoS posture; this PRD only requires adapter-side discipline.

**Reference cycles as a complexity vector.** Cycles in resolved references are tolerated per PRD-203-R12 / PRD-102-R20, but a hostile or buggy CMS structure could create deep cycle webs that exhaust memory during traversal. The default `referenceDepth: 1` is the primary control; PRD-203-R11 caps depth at 5 to prevent operator-side mistakes.

**Sanity asset URLs (T6).** Sanity's CDN serves assets at `https://cdn.sanity.io/...`. When the adapter emits `marketing:hero` blocks with `cta.href` or image URLs sourced from Sanity, those URLs reference a third-party origin from the consumer's perspective. PRD-109-R21 (cross-origin mount trust) does NOT apply here — these are content URLs, not manifest mounts — but consumers rendering them should apply their normal external-URL hygiene. The adapter SHOULD NOT emit raw Sanity CDN asset URLs as `metadata.source.url` (that field is reserved for the source CMS edit URL, not asset URLs).

**Listening API (informational).** Sanity's listening API uses long-lived Server-Sent Events. The adapter does NOT use the listening API at build time (PRD-203-R14 uses a one-shot `_updatedAt > $since` query instead) to avoid network exposure during builds. A future dev-mode integration MAY use the listening API but is out of scope for v0.1.

**Draft content leakage (T1 analog).** When `version: "draft"` is configured, the adapter MUST stamp `metadata.preview: true` on every emitted node per PRD-203-R3. Consumers that ingest the resulting envelope MUST treat preview content as non-public; failure to do so leaks unpublished content. The adapter cannot enforce consumer-side discipline; it can only signal.

**Component-contract `extract` failures (gap D3).** The Sanity adapter does not invoke component contracts (`extract` runs in the framework binding, PRD-301). PRD-203-R9's `componentMapping` is a static field-projection mapping, not an `extract` invocation; no sandbox question arises from this PRD.

For all other concerns, cite PRD-109 directly.

---

## Implementation notes

This section is required for adapter PRDs per the workflow.md Phase 3 addition. Snippets show the canonical TypeScript shape; the full implementation lives at `packages/sanity-adapter/`.

### Snippet 1 — The `Adapter` shape

```ts
// packages/sanity-adapter/src/index.ts
import type { Adapter, AdapterCapabilities, AdapterContext, EmittedNode } from "@act/adapter-framework";
import { createClient, type SanityClient } from "@sanity/client";
import { walkPortableText } from "./portable-text.js";
import { resolveReferences }  from "./references.js";
import type { SanityConfig, SanityDocument } from "./types.js";

export const sanityAdapter: Adapter<SanityConfig, SanityDocument> = {
  name: "act-sanity",

  async init(config, ctx): Promise<AdapterCapabilities> {
    validateConfig(config);  // PRD-203-R2
    const client = createClient({
      projectId:  config.projectId,
      dataset:    config.dataset,
      token:      config.apiToken,
      apiVersion: config.apiVersion ?? "2024-10-01",
      useCdn:     false,  // build-time consistency over CDN edge caching
      perspective: config.version ?? "published",
    });
    await verifyAuth(client);  // throws on 401 → PRD-203-R20
    ctx.config._sanityClient = client;  // stash on ctx for transform/dispose
    const isPlus = !!config.componentMapping || !!config.locale;
    return {
      level: isPlus ? "plus" : "standard",
      concurrency_max: 4,
      delta: true,
      namespace_ids: true,
      precedence: "primary",
      manifestCapabilities: { etag: true, subtree: true, ndjson_index: false, search: { template_advertised: false } },
      i18n: !!config.locale,
      componentContract: false,
      summarySource: "author",
    };
  },

  async *enumerate(ctx) {
    const client = ctx.config._sanityClient as SanityClient;
    const config = ctx.config as unknown as SanityConfig;
    const filter = config.groqFilter ?? "*";
    // PRD-203-R4: bounded projection; never inject user strings.
    const projection = buildProjection(config.fieldMapping);
    const query = `${filter}${projection}`;
    const docs = await client.fetch<SanityDocument[]>(query);
    if (docs.length === 0 && !config.allowEmpty) {
      ctx.logger.warn("sanity GROQ filter returned 0 results", { filter });
    }
    for (const doc of docs) yield doc;
  },

  async transform(item, ctx): Promise<EmittedNode | null> {
    const config = ctx.config as unknown as SanityConfig;
    const targetType = config.typeMapping?.[item._type] ?? item._type;
    if (targetType === undefined) return null;  // skip — PRD-203-R6
    try {
      const id = resolveId(item, config);  // PRD-203-R7
      const content = await walkPortableText(item.body, config, ctx);  // PRD-203-R8 / R9
      const related = await resolveReferences(item, config, ctx);  // PRD-203-R10 / R11 / R12
      return assembleNode({ item, id, type: targetType, content, related, config, ctx });
    } catch (err) {
      ctx.logger.warn("partial extraction", { id: item._id, error: String(err) });
      return assemblePartialNode({ item, error: err, config, ctx });  // PRD-203-R21
    }
  },

  async delta(since, ctx) {
    const client = ctx.config._sanityClient as SanityClient;
    const config = ctx.config as unknown as SanityConfig;
    const filter = config.groqFilter ?? "*";
    const query = `*[_updatedAt > $since && (${filter})]`;
    const docs = await client.fetch<SanityDocument[]>(query, { since });
    yield* docs;
  },

  async dispose(ctx) {
    delete (ctx.config as Record<string, unknown>)._sanityClient;
  },
};
```

### Snippet 2 — Portable-text walk (PRD-203-R8)

```ts
// packages/sanity-adapter/src/portable-text.ts
import type { Block as PtBlock, ContentBlock, AdapterContext } from "@act/wire-format";
import type { SanityConfig } from "./types.js";

export async function walkPortableText(
  body: PtBlock[],
  config: SanityConfig,
  ctx: AdapterContext,
): Promise<ContentBlock[]> {
  const out: ContentBlock[] = [];
  let listBuffer: PtBlock[] = [];
  for (const blk of body ?? []) {
    if (blk._type === "block" && (blk.listItem === "bullet" || blk.listItem === "number")) {
      listBuffer.push(blk);
      continue;
    }
    if (listBuffer.length) {
      out.push(coalesceList(listBuffer));
      listBuffer = [];
    }
    if (config.componentMapping?.[blk._type]) {
      out.push(emitMarketingBlock(blk, config.componentMapping[blk._type]));  // PRD-203-R9
      continue;
    }
    if (blk._type === "block") {
      out.push(blockToProse(blk));  // PRD-203-R8 (markdown serialization of marks)
    } else if (blk._type === "code") {
      out.push({ type: "code", language: blk.language ?? "text", text: blk.code ?? "" });
    } else if (blk._type === "callout") {
      out.push({ type: "callout", level: mapTone(blk.tone), text: blk.text ?? "" });
    } else {
      ctx.logger.warn("portable-text: unmapped _type", { _type: blk._type });
      out.push({ type: "prose", format: "markdown", text: `(unsupported block type: ${blk._type})` });
    }
  }
  if (listBuffer.length) out.push(coalesceList(listBuffer));
  return out;
}
```

### Snippet 3 — Reference resolution with depth + cycle detection (PRD-203-R10–R12)

```ts
// packages/sanity-adapter/src/references.ts
import type { SanityClient } from "@sanity/client";
import type { SanityConfig, SanityDocument, AdapterContext } from "./types.js";

export async function resolveReferences(
  doc: SanityDocument,
  config: SanityConfig,
  ctx: AdapterContext,
): Promise<{ related: { id: string; relation: string }[]; cycles: number }> {
  const client = ctx.config._sanityClient as SanityClient;
  const depth = config.referenceDepth ?? 1;
  const seen = new Set<string>([doc._id]);
  let cycles = 0;
  const related: { id: string; relation: string }[] = [];
  const fields = Object.entries(config.fieldMapping?.related ?? {});
  for (const [fieldName, relation] of fields) {
    const refs = doc[fieldName] as { _ref: string }[] | undefined;
    if (!refs) continue;
    for (const ref of refs) {
      if (seen.has(ref._ref)) { cycles++; continue; }
      seen.add(ref._ref);
      const target = await client.getDocument(ref._ref);
      if (!target) continue;
      related.push({ id: resolveId(target, config), relation });
      if (depth > 1) {
        // recurse — same algorithm, decrement depth, propagate `seen`
      }
    }
  }
  return { related, cycles };
}
```

### Snippet 4 — Failure-emission shape (PRD-203-R21)

```ts
function assemblePartialNode(args: {
  item: SanityDocument;
  error: unknown;
  config: SanityConfig;
  ctx: AdapterContext;
}): EmittedNode {
  return {
    act_version: args.ctx.config.actVersion as string,
    id:    resolveId(args.item, args.config),
    type:  args.config.typeMapping?.[args.item._type] ?? args.item._type,
    title: args.item.title ?? "(untitled)",
    summary: args.item.summary ?? "Content could not be extracted.",
    content: [],
    tokens:  { summary: 8, body: 0 },
    etag:    "",  // generator computes
    metadata: {
      extraction_status: "partial",
      extraction_error:  String(args.error).slice(0, 200),  // bounded; no PII per PRD-109-R14
    },
  };
}
```

### Snippet 5 — Token-redacted logging (PRD-203-R23)

```ts
function logSafeConfig(config: SanityConfig, logger: AdapterContext["logger"]) {
  logger.debug("sanity adapter config", {
    projectId: config.projectId,
    dataset:   config.dataset,
    apiToken:  config.apiToken ? `${config.apiToken.slice(0, 4)}…` : "missing",
    version:   config.version ?? "published",
    groqFilter: config.groqFilter ?? "*",
  });
}
```

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft. Implements the parent PRD-200 contract for Sanity Content Lake + GROQ + Portable Text. Configuration (project / dataset / token / GROQ filter / type-and-field mapping / reference depth / locale / componentMapping); portable-text walk to `prose` / `markdown` / `code` / `callout` (Standard) and `marketing:*` (Plus); reference resolution with default depth 1 and cycle tolerance per PRD-102-R20; locale handling cooperating with PRD-207 via merge; incremental rebuild via Sanity transaction-ID delta marker; failure modes — rate limit (recoverable / partial), auth failure (unrecoverable / fail in init), partial extraction (per-item warning). Conformance: Standard by default (with `abstract`, `related` mapped); Plus when `componentMapping` is configured OR locale is configured. Token never logged or emitted into envelopes per PRD-109. Status: In review. |
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review; no normative changes. Decisions: (1) summary defaults to extracted-from-body with explicit `summary.strategy` override; (2) Sanity `_type: "slug"` fields auto-map to ACT IDs with `idField` override; (3) `componentMapping` is opt-in — without it, custom block types surface as `extraction_status: "partial"` warnings rather than synthesized `marketing:*` blocks. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
