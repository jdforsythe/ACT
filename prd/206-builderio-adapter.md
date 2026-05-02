# PRD-206 — Builder.io adapter

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

Builder.io is structurally different from the other CMSes covered by the 200-series adapters (Contentful in PRD-202, Sanity in PRD-203, Storyblok in PRD-204, Strapi in PRD-205). The other CMSes model content as **documents with rich-text or markdown bodies** plus optional component blocks. Builder.io models content as **pages that ARE component trees** — a Builder page is a JSON document whose top-level shape is `{ data: { blocks: [<Builder component>, ...] } }` where each Builder component carries `{ '@type': 'BuilderBlock', component: { name, options }, children?: [...], responsiveStyles?: {...} }`. There is no separate body field. There are no markdown blocks. The page IS the component tree.

This shape creates a binary choice for the adapter: emit the entire Builder component tree as a single opaque structured payload that consumers can interpret however they like, or walk the tree extracting recognizable primitives (Text, Button, Image, Section) into ACT prose / marketing blocks per a configured mapping. Both modes have legitimate use cases:

- **Pass-through mode** is right when the consumer is itself a Builder.io renderer (e.g., a Mintlify-style agent that knows Builder's component schema) and wants the raw tree. The adapter emits a single `marketing:builder-page` block carrying the tree verbatim. This is **Plus only** because the `marketing:*` namespace is Plus-tier per PRD-102-R6.
- **Extraction mode** is right when the consumer is a generic LLM agent that wants discrete content blocks. The adapter walks well-known Builder primitives — `Text` → `prose`, `Button` → embedded into `prose` markdown links or surfaced as a `marketing:hero.cta`, `Image` → markdown image syntax in `prose`, `Section` → flattened (the children become siblings), `CustomCode` → `code`, `Symbol` → recursively walked or emitted as a placeholder if depth-bounded. The walk is configurable; unmapped components fall back to partial-extraction warnings.

PRD-100, PRD-102, PRD-103, PRD-107, PRD-108, PRD-109 (all Accepted) define the wire-format envelopes, content-block taxonomy, ETag derivation, conformance bands, versioning regime, and security posture. PRD-200 (in review) defines the framework contract this adapter implements. Per gap E6, CMS DSL unification is deferred to v0.2; this PRD is intentionally distinct from PRD-203 / 204 / 205 because Builder.io's component-tree-as-page model has no equivalent there.

### Goals

1. Lock the **adapter configuration** schema for Builder.io — API key (public read), models to include, mode (pass-through vs extraction), version (draft vs published), preview-mode toggle, locale handling.
2. Lock the **two emission modes**:
   - **Pass-through.** Emit a single `marketing:builder-page` block carrying the raw component tree. Plus-only.
   - **Extraction.** Walk well-known Builder primitives into `prose` / `code` / `marketing:*` blocks per a configured mapping.
3. Lock the **model → ACT type mapping** with sensible defaults (Builder `page` model → ACT `landing` type by default).
4. Lock the **field mapping** from Builder page metadata to ACT envelope fields: title (page name), summary (`data.description` or extracted from first Text component), tags, references → `related`.
5. Lock the **Builder primitive walk** for extraction mode: `Text` → `prose` (markdown), `Image` → markdown image syntax, `Button` → markdown link or `marketing:hero.cta` lift, `CustomCode` → `code`, `Section` → flatten children, `Symbol` → recurse with depth bound, custom components → `componentMapping` lookup or partial.
6. Lock **reference resolution** semantics — Builder.io's `references` field on pages — depth-bounded, cycle-tolerant.
7. Lock the **incremental rebuild** path via Builder.io's webhook surface (`content.publish`, `content.unpublish`, `content.archive`) — surfaced through the framework's `delta(since)` hook.
8. Lock the **locale handling** when Builder.io's targeting (`query` parameter `locale`) is in use.
9. Lock the **capability declaration**, **failure modes**, and **conformance** — Plus required for pass-through mode; Standard or Plus for extraction mode depending on configured mapping + locale.
10. Provide TypeScript implementation-notes snippets and enumerate the test fixture matrix.

### Non-goals

1. Defining the adapter framework — owned by PRD-200.
2. Defining wire format / blocks / ETag / conformance / versioning — owned by PRD-100 / PRD-102 / PRD-103 / PRD-107 / PRD-108.
3. Defining the i18n adapter — owned by PRD-207.
4. Defining component-contract emission — owned by PRD-300. **Builder.io components are CMS-side primitives**, not framework-side React/Vue components instrumented via PRD-300; the adapter does NOT emit `metadata.extracted_via: "component-contract"`.
5. Unifying CMS mapping DSL across PRD-202–206 — deferred to v0.2 per gap E6.
6. Authoring a non-TypeScript Builder.io adapter — per Q3, v0.1 is TS-only.
7. Specifying the `marketing:builder-page` block's per-field schema. The block carries the raw Builder tree as `metadata.builderPage` (or in a `payload` field — pinned by R10); the consumer that interprets it must understand Builder's schema. The schema is documented-open per PRD-102-R6.
8. Specifying the Builder.io Visual Editor preview integration. The adapter consumes the Content API; preview-mode glue (the Builder.io SDK in the consuming app) is the consumer's concern.
9. Pinning Builder.io's `Text` HTML-to-markdown conversion in detail beyond the mark set R8 lists. Builder's Text component contains arbitrary HTML; the walker uses a permissive HTML-to-markdown converter and stamps `metadata.extraction_status: "partial"` when content survives only as plaintext.

### Stakeholders / audience

- **Authors of:** sites running Builder.io-backed marketing or landing surfaces under any of the 400-series generators.
- **Consumers of:** PRD-400, PRD-401 (Astro), PRD-405 (Next.js), PRD-406 (Remix).
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Pass-through mode emits a `marketing:builder-page` block whose payload shape varies across Builder.io's own SDK versions | High | Medium | PRD-206-R10 pins the payload to a single field (`marketing:builder-page.payload`) and stamps `metadata.builderApiVersion` so consumers can branch. Sliding Builder.io SDK shape is the consumer's problem, not the adapter's. |
| Extraction mode loses semantic detail (a Text component's nested formatting, a Button's tracking attributes) | High | Medium | Default extraction maps recognizable primitives; unmapped components fall back to partial-extraction warnings. Operators add to `componentMapping` when they need richer extraction. |
| Operators choose extraction mode but their pages contain mostly custom components → extraction produces sparse output | Medium | Medium | PRD-206-R23 emits a build warning when more than 50% of a page's components are unmapped in extraction mode; the warning suggests pass-through mode. |
| Builder.io API key leakage into envelopes | Low | High | PRD-206-R26 / R27 prohibit logging or emitting keys. PRD-109 cited. |
| Builder.io public read API key is browser-exposable; operators may inadvertently use a privileged key | Medium | Low | PRD-206-R2 documents that the configured API key MUST be a "public" (read-only) key, never a "private" key. The adapter does not write to Builder. |
| `references` resolution explodes — cycles or deep graphs | Medium | High | Default `referenceDepth: 1`; max 3 (tighter than other adapters because Builder's reference field can include arbitrary content models). |
| Symbol recursion (a Symbol containing a Symbol containing the original Symbol) | Medium | High | PRD-206-R12 caps Symbol recursion at depth 3; deeper falls back to partial. Cycles detected and tolerated. |
| Builder.io rate limits during bulk reads | Medium | Medium | PRD-206-R24 retries with backoff; `concurrency_max: 4` default. |

### Open questions

1. ~~Should pass-through mode also emit a synthetic `summary` extracted from the first Text component in the tree, or leave summary to the configured field mapping?~~ **Resolved (2026-05-01): Extract.** `summary` is required at every conformance level (PRD-100-R4 / PRD-102-R15), so the adapter MUST produce one even in pass-through mode. Default: extract from the first Text component capped at 50 tokens, mark `summary_source: "extracted"`. Operators may override via field mapping. (Closes Open Question 1.)
2. ~~Should extraction mode default to mapping `Section` to a `marketing:*` block (e.g., `marketing:section`) or always flatten?~~ **Resolved (2026-05-01): Flatten.** Builder.io's `Section` is structural (a wrapper), not semantic; flattening produces a cleaner ACT shape. Operators wanting `marketing:section` add it to `componentMapping`. (Closes Open Question 2.)
3. ~~Should the adapter expose Builder.io's experiment / variant data as variant nodes per PRD-102-R29?~~ **Resolved (2026-05-01): Opt-in via `experiments: "emit"`.** Default behavior skips variants and emits only the canonical (control) page; setting `experiments: "emit"` emits one node per variant with `id` of the form `{base_id}@{variant_key}`. Skip-by-default keeps the build deterministic for users who haven't reasoned about variants. (Closes Open Question 3.)

### Acceptance criteria

- [ ] Every normative requirement has an ID `PRD-206-R{n}` and a declared conformance level.
- [ ] The Specification section opens with a table mapping every requirement to PRD-200 + 100-series requirements.
- [ ] The two modes (pass-through, extraction) are pinned with explicit conformance bands.
- [ ] Implementation notes contain 3–6 short TypeScript snippets.
- [ ] Test fixture paths under `fixtures/206/positive/` and `fixtures/206/negative/` are enumerated; both modes are exercised.
- [ ] Versioning & compatibility section per PRD-108.
- [ ] Security section cites PRD-109 and documents Builder-specific deltas (API-key kind validation, Symbol recursion, raw-tree emission posture).
- [ ] Changelog entry dated 2026-05-01 by Jeremy Forsythe.

---

## Context & dependencies

### Depends on

- **PRD-200** (in review) — adapter framework.
- **PRD-100** (Accepted) — wire format.
- **PRD-102** (Accepted) — content blocks, especially R6 (`marketing:*` namespace) and the variant convention R29 for experiments.
- **PRD-103** (Accepted) — caching / ETag.
- **PRD-107** (Accepted) — conformance.
- **PRD-108** (Accepted) — versioning.
- **PRD-109** (Accepted) — security.
- **PRD-207** (in flight) — i18n cooperation.
- External: [Builder.io Content API](https://www.builder.io/c/docs/content-api), [Builder.io Webhooks](https://www.builder.io/c/docs/webhooks), [`@builder.io/sdk`](https://www.npmjs.com/package/@builder.io/sdk), [`@builder.io/sdk-react`](https://github.com/BuilderIO/builder/tree/main/packages/sdks/output/react). Cited for shape.

### Blocks

- None directly; aspirationally enables PRD-702-style examples backed by Builder.io.

### References

- v0.1 draft: §5.10 (adapter pipeline), §5.11.3 (component-contract emission — informational; does NOT apply to Builder primitives, see Non-goals #4).
- `prd/000-gaps-and-resolutions.md` gap **E6** (CMS DSL deferred).
- `prd/000-decisions-needed.md` Q3, Q5, Q7.
- Prior art: [`@builder.io/dev-tools`](https://github.com/BuilderIO/builder/tree/main/packages/dev-tools), [`gatsby-source-builder-io`](https://github.com/BuilderIO/builder/tree/main/packages/gatsby), [`@builder.io/utils`](https://github.com/BuilderIO/builder).

---

## Specification

This is the normative section. Every requirement uses RFC 2119 keywords as clarified by RFC 8174.

### Parent + 100-series requirements implemented

| PRD-206 requirement | Parent / 100-series requirement(s) | Relationship |
|---|---|---|
| R1 (interface compliance) | PRD-200-R1 | Implements `Adapter`. |
| R2 (config schema + API-key kind) | PRD-200-R3, R20 | Validated in `init`. |
| R3 (`version` — draft vs published) | PRD-200-R3 | Default `published`. |
| R4 (mode — pass-through vs extraction) | PRD-200-R3 | Default `extraction`. |
| R5 (models filter) | PRD-200-R4 | `enumerate` per model. |
| R6 (filter result safety) | PRD-200-R18 | Empty + no `allowEmpty` → warning. |
| R7 (model → ACT type mapping) | PRD-100-R21, PRD-200-R5 | Builder model → ACT `type`. |
| R8 (field mapping) | PRD-100-R21, R22 | Builder page metadata → ACT envelope. |
| R9 (extraction-mode primitive walk) | PRD-102-R1, R2, R3, R5, R7–R11 | `Text` / `Image` / `Button` / etc. → blocks. |
| R10 (pass-through mode `marketing:builder-page`) | PRD-102-R6 | Single block carrying the raw tree. |
| R11 (mode-driven conformance) | PRD-107-R8, R10 | Pass-through is Plus; extraction is Standard or Plus. |
| R12 (Symbol recursion bound) | — | Depth ≤ 3; deeper falls back to partial. |
| R13 (custom-component → `marketing:*`) | PRD-102-R6, R7–R11 | Configured mapping (extraction mode only). |
| R14 (reference resolution) | PRD-102-R18, R19, R20 | Builder `references` → ACT `related[]`. |
| R15 (resolution depth) | — | Default 1; max 3. |
| R16 (cycle handling) | PRD-102-R20 | Tolerated; warning emitted. |
| R17 (locale handling) | PRD-100-R22, PRD-104 (in flight) | Builder targeting `locale` query param. |
| R18 (experiment / variant emission) | PRD-102-R29, R30, R31 | Variant nodes with `{base_id}@{variant_key}`. |
| R19 (incremental rebuild via webhook) | PRD-200-R9 | `delta(since)` keyed on `lastUpdated`. |
| R20 (webhook signature verification) | PRD-109-R5–R9 | HMAC validation helper. |
| R21 (capability declaration) | PRD-200-R22 | `AdapterCapabilities`. |
| R22 (level — Standard vs Plus) | PRD-107-R8, R10 | Per mode + config. |
| R23 (extraction-mode coverage warning) | — | >50% unmapped → warning suggesting pass-through. |
| R24 (failure mode — rate limit) | PRD-200-R16 | Retry with backoff. |
| R25 (failure mode — auth / wrong-key-kind) | PRD-200-R18 | Throw from `init`. |
| R26 (security — no key in logs) | PRD-109-R14, R15 | Redaction. |
| R27 (security — no key in envelopes) | PRD-109-R1, R2, R14 | Key never emitted. |
| R28 (provenance — Builder source_id) | PRD-200-R13 | `source_id` is Builder content `id`. |
| R29 (Stage 1 pinning) | PRD-200-R25, PRD-108-R14 | `act-builderio@0.1.x` → `act_version: "0.1"` only. |
| R30 (test-fixture conformance) | PRD-200-R28 | Adapter passes both mode corpora. |

### Conformance level

- **Core:** R1, R2, R5, R7, R8, R21, R22, R25, R26, R27, R28, R29, R30.
- **Standard:** R3, R4 (extraction mode), R6, R9, R11 (extraction-only Standard branch), R12, R14, R15, R16, R19, R20, R23, R24.
- **Plus:** R10 (pass-through `marketing:builder-page`), R11 (Plus branch), R13 (custom-component `marketing:*` mapping in extraction mode), R17 (locale), R18 (experiments).

### Normative requirements

#### Adapter contract

**PRD-206-R1.** The `act-builderio` adapter MUST implement the `Adapter` interface defined in PRD-200-R1. The package's default export MUST satisfy `Adapter<BuilderConfig, BuilderContent>` where `BuilderContent` is one Builder.io content entry (a page or other model entry). Conformance: **Core**.

#### Configuration

**PRD-206-R2.** The adapter MUST validate its configuration in `init`. Required: `apiKey` (string OR env-var reference — MUST be a Builder.io **public** read key, not a private key), `models` (string array, e.g., `["page", "section", "symbol"]`). Optional: `mode` (`"pass-through" | "extraction"`, default `"extraction"`), `version` (`"published" | "draft"`, default `"published"`), `query` (object — Builder query params: `urlPath`, `userAttributes`, etc.), `typeMapping` (object), `fieldMapping` (object), `idField` (string, default `"data.url"` falling back to Builder content `id`), `referenceDepth` (integer 0–3, default 1), `componentMapping` (object — extraction mode only), `symbolRecursionMax` (integer 1–3, default 3), `locale` (object), `experiments` (`"skip" | "emit"`, default `"skip"`), `webhookSecret` (string), `summary` (object), `allowEmpty` (boolean), `unmappedComponentWarningThreshold` (number 0–1, default 0.5). Validation failures cause `init` to reject. The adapter MUST detect when the supplied `apiKey` is a private (write) key — typically by attempting a no-op write that should fail for a public key — and reject with a clear error if a private key is detected (privilege-of-least-trust per PRD-109). Conformance: **Core**.

**PRD-206-R3.** The `version` config field MUST default to `"published"`. When `"draft"`, the adapter MUST request the draft perspective and stamp `metadata.preview: true` on every emitted node. Mixing modes within one config is a configuration error. Conformance: **Standard**.

**PRD-206-R4.** The `mode` config field MUST default to `"extraction"`. The two modes are mutually exclusive per adapter run; an operator wanting both pass-through and extraction outputs MUST configure two adapter instances with different namespaces. Conformance: **Standard**.

**PRD-206-R5.** The adapter MUST iterate over the configured `models` array. For each model, the adapter MUST issue paginated `GET /api/v3/content/{model}` requests with the configured `query` parameters, with `limit=100&offset=N` for pagination. A model that does not exist on the server (404) MUST cause `init` to reject (configuration error). Conformance: **Core**.

**PRD-206-R6.** When the configured filter returns zero entries across all configured models AND `allowEmpty: true` is not set, the adapter MUST emit a build warning. Conformance: **Standard**.

#### Content-type and field mapping

**PRD-206-R7.** The adapter MUST map Builder.io model identifiers to ACT `type` per `typeMapping`. The default mapping is:

| Builder model | ACT type (default) |
|---|---|
| `page` | `landing` |
| `section` | `landing` |
| `symbol` | `landing` |
| _other_ | identity |

Operators MAY override per-model. Conformance: **Core**.

**PRD-206-R8.** The adapter MUST map Builder content fields to ACT envelope fields per `fieldMapping`. The default mapping is:

| ACT field | Builder source (default) | Notes |
|---|---|---|
| `id` | `data.url` (URL path slug — sanitized to ID grammar) when present, else the Builder content `id` | Override via `idField`. |
| `title` | `name` (Builder content name) | String required. |
| `summary` | `data.description` if present, else extracted from the first Text component (capped at 50 tokens) | When extracted, `summary_source: "extracted"`. |
| `abstract` | `data.abstract` if present | Optional. |
| `content` | walked per mode (pass-through R10 or extraction R9) | — |
| `tags` (in `metadata.tags`) | `data.tags` (array of strings) | Optional. |
| `related` | `data.references` (Builder native references field) | Per PRD-206-R14. |
| `updated_at` | `lastUpdated` (Unix epoch ms; converted to RFC 3339) | — |
| `metadata.locale` | `data.locale` (when locale config present) | Per PRD-206-R17. |

Operators MAY override any row. The adapter MUST emit a partial node when a required field is unmappable. Conformance: **Core** (defaults), **Standard** (overrides + partial-emission).

#### Extraction mode — primitive walk

**PRD-206-R9.** When `mode: "extraction"`, the adapter MUST walk the Builder page's component tree (`data.blocks`) into ACT content blocks per the following:

- **`Text`** → single `prose` block with `format: "markdown"`. The Text component's HTML content (Builder stores Text as HTML strings) MUST be converted to markdown via a permissive HTML-to-markdown converter handling `<p>`, `<h1>`–`<h6>`, `<ul>`, `<ol>`, `<li>`, `<a>`, `<em>`, `<strong>`, `<code>`, `<blockquote>`, `<br>`. HTML constructs outside this set (e.g., `<table>`, `<details>`) MUST be passed through as raw markdown HTML (CommonMark permits inline HTML). Walker MUST stamp `metadata.extraction_status: "partial"` on the enclosing node when any HTML construct fell back to plaintext (i.e., content was lossy).
- **`Image`** → markdown image syntax (`![alt](src)`) embedded into a `prose` block. When the Image is the only child of a Section, it MAY appear as its own `prose` block.
- **`Button`** → markdown link (`[label](href)`) embedded into the surrounding `prose` block. When `componentMapping` is configured to lift Button into a `marketing:hero.cta` (when wrapped in a Section that maps to `marketing:hero`), the lift takes precedence.
- **`CustomCode`** → `code` block (PRD-102-R3) with `language` from the component's `options.language` field (default `"text"`) and `text` from `options.code`.
- **`Section`** → flatten. The Section's children are walked as siblings of the Section's parent. Operators wanting `marketing:section` semantics add it to `componentMapping`.
- **`Symbol`** → recursively walked as if its referenced content were inlined, with depth bound per PRD-206-R12.
- **Custom components** → looked up in `componentMapping` per PRD-206-R13. Components without a mapping fall back to a partial-extraction warning AND a `prose` block whose `text` is `(unmapped Builder component: <name>)`.

The walker MUST preserve source order. Conformance: **Standard**.

#### Pass-through mode — `marketing:builder-page`

**PRD-206-R10.** When `mode: "pass-through"`, the adapter MUST emit exactly one content block per page, of the form:

```json
{
  "type": "marketing:builder-page",
  "model": "<Builder model name>",
  "payload": { /* the raw Builder content's `data` field, verbatim */ },
  "metadata": {
    "builderApiVersion": "v3",
    "builderModelKind":  "<page | section | symbol | ...>"
  }
}
```

The `payload` field carries Builder's `data` object as-is. The block satisfies PRD-102-R6 (the `marketing:*` namespace pattern) and is documented-open per PRD-102's Plus-tier extension surface. Pass-through mode MUST NOT emit other content blocks alongside `marketing:builder-page` for the same page; the page IS the block. The summary field on the enclosing node MUST still be populated per PRD-206-R8 (extracted from the first Text component or `data.description`); pass-through mode does not relieve the producer of the Core requirement that every node carry a `summary`. Conformance: **Plus**.

**PRD-206-R11.** Pass-through mode is **Plus only**. The `marketing:*` namespace is Plus per PRD-102-R6 / PRD-107-R10. Extraction mode MAY satisfy Standard (when `componentMapping` is not configured AND no `locale` / `experiments`) or Plus (when `componentMapping` is configured OR `locale` / `experiments` is configured). The adapter's `init` MUST declare `level` per the matrix:

| Mode | `componentMapping` | `locale` | `experiments` | Declared level |
|---|---|---|---|---|
| `extraction` | unset | unset | `skip` | `standard` |
| `extraction` | set | * | * | `plus` |
| `extraction` | * | set | * | `plus` |
| `extraction` | * | * | `emit` | `plus` |
| `pass-through` | n/a | * | * | `plus` |

Conformance: **Standard / Plus**.

#### Symbol recursion bound

**PRD-206-R12.** Builder.io Symbols MAY be referenced by other content; the walker MUST recurse into Symbol children up to depth **3**. Beyond depth 3, the walker MUST emit a partial-extraction warning AND fall back to a `prose` block whose `text` is `(symbol recursion bound exceeded at depth N)`. Operators MAY tighten via `symbolRecursionMax: 1 | 2 | 3`; they MUST NOT exceed 3. Cycles in Symbol references MUST be detected and tolerated; the walker tracks visited Symbol IDs across the recursion. Conformance: **Standard**.

#### Custom-component → `marketing:*` mapping (Plus)

**PRD-206-R13.** When the adapter is configured with `componentMapping` (extraction mode only), components in the page tree whose Builder component name (`component.name`) matches a key in `componentMapping` MUST be emitted as the corresponding `marketing:*` block per PRD-102-R7–R11. The mapping config takes the same shape as PRD-203-R9 / PRD-204-R10 / PRD-205-R11:

```json
{
  "componentMapping": {
    "Hero":         { "type": "marketing:hero",         "fields": { "headline": "options.headline", "subhead": "options.subhead", "cta": { "label": "options.ctaLabel", "href": "options.ctaHref" } } },
    "FeatureGrid":  { "type": "marketing:feature-grid", "fields": { "features": "options.features[].{title, description, icon}" } },
    "PricingTable": { "type": "marketing:pricing-table","fields": { "tiers": "options.tiers[].{name, price, features}" } },
    "Testimonial":  { "type": "marketing:testimonial",  "fields": { "quote": "options.quote", "author": "options.authorName", "role": "options.authorRole", "org": "options.authorOrg" } },
    "FAQ":          { "type": "marketing:faq",          "fields": { "items": "options.items[].{question, answer}" } }
  }
}
```

Field paths MAY use dot-notation and array-projection syntax (`features[].{title, description}`). Components without a mapping fall back to the partial-extraction path. Conformance: **Plus**.

#### Reference resolution

**PRD-206-R14.** The adapter MUST resolve Builder.io reference fields (`data.references` array — Builder's native reference field) into ACT `related[]` entries per PRD-102-R18. The default `relation` is `"see-also"`; operators MAY map per-field via `fieldMapping.related`. The referenced content's ACT ID MUST be resolved via the same `idField` rule as the referencing content. Conformance: **Standard**.

**PRD-206-R15.** Reference resolution depth defaults to **1**. Operators MAY set `referenceDepth` between 0 and 3. Beyond 3, response sizes from Builder tend to exceed practical build-time bounds; `referenceDepth > 3` MUST cause `init` to reject. Conformance: **Standard**.

**PRD-206-R16.** Cycles in resolved reference graphs MUST be tolerated. The adapter detects cycles during resolution and stamps `metadata.reference_cycles: <count>` on the affected node. Per PRD-102-R20. Conformance: **Standard**.

#### Locale handling

**PRD-206-R17.** When the adapter's `locale` config is set, the adapter MUST emit `metadata.locale` on every emitted node, populated from Builder.io's targeting `locale` field (set per-content via the Builder Visual Editor's targeting attributes). Builder.io's locale model is **targeting-based** (one content entry can be targeted to multiple locales) rather than **document-per-locale**: the adapter MUST query Builder once per configured locale, sending `userAttributes={ locale: <locale> }` in the query, and emit one ACT node per locale where the targeting selects a different content variant. When the same content is selected for multiple locales (no targeting differentiation), the adapter MUST emit a single ACT node with `metadata.locale` set to the default locale and stamp `metadata.translations: [{ locale, id }, ...]` listing the other locales' selections (which may be the same ID, in which case the entry is `{ locale, id: <same-id> }`). Conformance: **Plus**.

#### Experiment / variant emission

**PRD-206-R18.** When `experiments: "emit"` is set, the adapter MUST emit one ACT node per Builder.io content variant (Builder represents A/B tests as separate `data.variants` entries on a single content document). The base node carries the canonical (control) variant; each variant node has `id` of the form `{base_id}@{variant_key}` per PRD-102-R29, with `variant_key` derived from Builder's variant ID slug-cased. Each variant node MUST stamp `metadata.variant: { base_id, key, source: "experiment" }` per PRD-102-R31, and SHOULD stamp `related: [{ id: base_id, relation: "variant_of" }]` per PRD-102-R32. The default `experiments: "skip"` skips variants entirely. Conformance: **Plus**.

#### Incremental rebuilds

**PRD-206-R19.** The adapter MUST implement `delta(since: string, ctx)` per PRD-200-R9. The `since` marker is a Unix epoch milliseconds timestamp formatted as a decimal string. The adapter MUST query each configured model with the Builder query parameter `query.lastUpdated.$gt=<since>` (Builder's native filter syntax) and yield matching content. The adapter MUST persist the new marker on `dispose` via `ctx.config.deltaMarkerSink`. Conformance: **Standard**.

**PRD-206-R20.** When the generator wires Builder.io webhooks, the adapter MUST expose `verifyWebhookSignature(body, signature, secret)` validating Builder.io's HMAC-SHA256 webhook signature (Builder sends the signature in the `Builder-Signature` header). The webhook-receiver implementation is the generator's concern. Conformance: **Standard**.

#### Capability declaration

**PRD-206-R21.** The adapter's `init` MUST return an `AdapterCapabilities`:

```ts
{
  level: "standard" | "plus",   // per the R11 matrix
  concurrency_max: 4,
  delta: true,
  namespace_ids: true,
  precedence: "primary",
  manifestCapabilities: {
    etag: true, subtree: true, ndjson_index: false,
    search: { template_advertised: false }
  },
  i18n: <true if locale config present>,
  componentContract: false,    // per Non-goals #4 — Builder primitives are not PRD-300 component contracts
  summarySource: "author"
}
```

Conformance: **Core**.

**PRD-206-R22.** The adapter MUST declare `level` per the matrix in PRD-206-R11. Conformance: **Standard / Plus** per matrix.

#### Coverage warning (extraction mode)

**PRD-206-R23.** In extraction mode, when more than the configured `unmappedComponentWarningThreshold` fraction (default 0.5) of components on a single page are unmapped (neither built-in primitives nor in `componentMapping`), the adapter MUST emit a build warning citing the page's ID and the unmapped fraction. The warning's message SHOULD suggest pass-through mode as an alternative ("consider `mode: 'pass-through'` for this content set"). The warning is informational; the build continues. Conformance: **Standard**.

#### Failure modes

**PRD-206-R24.** Builder.io API rate-limit responses (HTTP 429) MUST be handled by exponential backoff with at least 3 retries (250ms, 500ms, 1000ms). Persistent failure MUST cause the affected page to be emitted as a partial node. Conformance: **Standard**.

**PRD-206-R25.** Authentication failure (HTTP 401 / 403) OR detection of a private key supplied where a public key was expected MUST cause `init` to reject with an unrecoverable error per PRD-200-R18. The error message MUST cite that authentication failed (or that a private key was supplied) and MUST NOT include the key value. Conformance: **Core**.

#### Security

**PRD-206-R26.** The adapter MUST NOT log the value of `apiKey` at any log level. The adapter MAY log a fingerprint (first 4 chars) when `config.debugLogging: true` is set. Cites PRD-109-R14 / R15. Conformance: **Core**.

**PRD-206-R27.** The adapter MUST NOT emit the API key (or any prefix longer than 4 characters) into any envelope field. Cites PRD-109-R1, R2, R14. Conformance: **Core**.

#### Provenance

**PRD-206-R28.** The Builder-specific `source_id` (used in `metadata.source.source_id`) MUST be the Builder content's `id` field (a stable identifier across name / URL changes). When emitting per-locale variants via PRD-206-R17 OR experiment variants via PRD-206-R18, `source_id` is `{contentId}#{locale-or-variant-key}` to disambiguate. Conformance: **Standard**.

#### Version pinning

**PRD-206-R29.** Per PRD-200-R25 (Stage 1), `act-builderio@0.1.x` emits `act_version: "0.1"` only. Stage 2 is per-package opt-in. Conformance: **Core**.

#### Test fixtures

**PRD-206-R30.** The adapter MUST pass the framework conformance corpus per PRD-200-R28 AND the Builder-specific corpus enumerated in §"Test fixtures." Both modes (pass-through, extraction) MUST be exercised. Conformance: **Core**.

### Wire format / interface definition

PRD-206 introduces no new wire-format schema. The `marketing:builder-page` block conforms to the `marketing:*` generic schema in PRD-102 (R6); the per-block field shape is documented-open and intentionally not pinned in v0.1.

#### Configuration schema (TypeScript)

```ts
import type { Adapter } from "@act/adapter-framework";

export interface BuilderConfig {
  apiKey: string;                // PUBLIC read key
  models: string[];              // ["page", "section", "symbol", ...]
  mode?: "pass-through" | "extraction";
  version?: "published" | "draft";
  query?: Record<string, unknown>;
  typeMapping?: Record<string, string>;
  fieldMapping?: {
    title?: string;
    summary?: string;
    abstract?: string;
    body?: string;
    tags?: string;
    related?: Record<string, string /* relation */>;
    [actField: string]: unknown;
  };
  idField?: string;
  referenceDepth?: number;          // 0–3; default 1
  componentMapping?: Record<string, { type: `marketing:${string}`; fields: Record<string, string> }>;
  symbolRecursionMax?: number;      // 1–3; default 3
  locale?: { locales: string[]; defaultLocale: string };
  experiments?: "skip" | "emit";
  webhookSecret?: string;
  summary?: { strategy: "field" | "extract" | "needs-llm" };
  allowEmpty?: boolean;
  unmappedComponentWarningThreshold?: number;  // 0–1; default 0.5
}

export type BuilderAdapter = Adapter<BuilderConfig, BuilderContent>;

export function verifyWebhookSignature(body: string, signature: string, secret: string): boolean;
```

### Errors

| Condition | Adapter behavior | Framework behavior | Exit code |
|---|---|---|---|
| `init` config validation failure | Reject from `init` | Build error | non-zero |
| `init` HTTP 401 / 403 OR private-key detected | Reject from `init` per R25 | Build error; key redacted | non-zero |
| `init` 404 on configured model | Reject from `init` per R5 | Build error | non-zero |
| `init` `referenceDepth > 3` | Reject from `init` per R15 | Build error | non-zero |
| `init` `symbolRecursionMax > 3` | Reject from `init` per R12 | Build error | non-zero |
| `init` `mode` outside `{pass-through, extraction}` | Reject from `init` per R4 | Build error | non-zero |
| `enumerate` zero entries, `allowEmpty != true` | Continue + warn per R6 | Warning | 0 |
| `transform` HTTP 429, retries exhausted | Emit partial per R24 | Warning | 0 |
| `transform` extraction mode unmapped component | Emit partial + `prose` placeholder per R9 | Warning | 0 |
| `transform` extraction-mode unmapped fraction > threshold | Emit page; emit additional warning per R23 | Warning | 0 |
| `transform` Symbol recursion exceeds R12 bound | Emit partial per R12 | Warning | 0 |
| `transform` reference cycle | Tolerate; stamp `metadata.reference_cycles` | No warning | 0 |
| Pass-through mode emits a non-`marketing:builder-page` block alongside | n/a (R10 prohibits) | Build error per PRD-100 schema | non-zero |
| Adapter emits malformed `id` | n/a (framework rejects) | Build error per PRD-100-R10 | non-zero |
| Webhook signature invalid | `verifyWebhookSignature` returns false | Generator's concern | n/a |

---

## Examples

### Example 1 — Extraction mode (Standard, no component mapping)

```ts
export const builderConfig: BuilderConfig = {
  apiKey: process.env.BUILDER_PUBLIC_KEY!,
  models: ["page"],
  mode: "extraction",
  fieldMapping: { title: "name", summary: "data.description" },
  referenceDepth: 1
};
```

Adapter declares `level: "standard"`. Emitted nodes carry walked `prose` / `code` blocks from Text and CustomCode primitives; references become `related[]`.

### Example 2 — Extraction mode with component mapping (Plus)

```ts
export const builderConfig: BuilderConfig = {
  apiKey: process.env.BUILDER_PUBLIC_KEY!,
  models: ["page", "section"],
  mode: "extraction",
  componentMapping: {
    Hero:        { type: "marketing:hero",         fields: { headline: "options.headline", subhead: "options.subhead", cta: { label: "options.ctaLabel", href: "options.ctaHref" } } },
    PricingTable:{ type: "marketing:pricing-table",fields: { tiers: "options.tiers[].{name, price, features}" } }
  },
  locale: { locales: ["en", "de"], defaultLocale: "en" },
  experiments: "emit"
};
```

Adapter declares `level: "plus"`. Emitted nodes embed `marketing:hero` + `marketing:pricing-table`; per-locale and per-variant nodes are emitted.

### Example 3 — Pass-through mode (Plus)

```ts
export const builderConfig: BuilderConfig = {
  apiKey: process.env.BUILDER_PUBLIC_KEY!,
  models: ["page"],
  mode: "pass-through"
};
```

Adapter declares `level: "plus"`. Each page is emitted as a single ACT node carrying one `marketing:builder-page` block with the raw Builder tree as its `payload`.

### Example 4 — Emitted Standard-level node (extraction mode, no mapping)

```json
{
  "act_version": "0.1",
  "id": "act-builderio/landing/welcome",
  "type": "landing",
  "title": "Welcome",
  "summary": "Welcome to Acme — get started in minutes.",
  "summary_source": "author",
  "content": [
    { "type": "prose", "format": "markdown", "text": "# Welcome to Acme\n\nGet started in minutes." },
    { "type": "prose", "format": "markdown", "text": "![Acme logo](https://cdn.builder.io/api/v1/image/assets/abc/xyz)" },
    { "type": "code", "language": "javascript", "text": "console.log('hello acme');" }
  ],
  "tokens": { "summary": 12, "body": 92 },
  "etag": "<computed by generator>",
  "related": [
    { "id": "act-builderio/landing/pricing", "relation": "see-also" }
  ],
  "updated_at": "2026-04-25T10:00:00Z",
  "metadata": {
    "source": { "adapter": "act-builderio", "source_id": "builder-content-id-welcome" }
  }
}
```

### Example 5 — Plus extraction emission (with `marketing:hero` from `componentMapping`)

```json
{
  "act_version": "0.1",
  "id": "act-builderio/landing/pricing",
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
        { "name": "Starter", "price": "$0/mo",      "features": ["1,000 requests/mo"] },
        { "name": "Pro",     "price": "$49/mo",     "features": ["100,000 requests/mo", "99.9% SLA"] },
        { "name": "Ent",     "price": "Contact us", "features": ["Unlimited requests", "Custom SLA"] }
      ]
    }
  ],
  "tokens": { "summary": 10, "body": 280 },
  "etag": "<computed by generator>",
  "metadata": {
    "locale": "en",
    "translations": [
      { "locale": "de", "id": "act-builderio/landing/pricing@de" }
    ],
    "source": { "adapter": "act-builderio", "source_id": "builder-content-pricing" }
  }
}
```

### Example 6 — Pass-through emission (Plus, raw tree)

```json
{
  "act_version": "0.1",
  "id": "act-builderio/landing/welcome",
  "type": "landing",
  "title": "Welcome",
  "summary": "Welcome to Acme — get started in minutes.",
  "summary_source": "extracted",
  "content": [
    {
      "type": "marketing:builder-page",
      "model": "page",
      "payload": {
        "blocks": [
          {
            "@type": "@builder.io/sdk:Element",
            "component": { "name": "Text", "options": { "text": "<h1>Welcome to Acme</h1>" } }
          },
          {
            "@type": "@builder.io/sdk:Element",
            "component": { "name": "Hero", "options": { "headline": "Get started", "ctaHref": "/signup" } }
          }
        ]
      },
      "metadata": {
        "builderApiVersion": "v3",
        "builderModelKind": "page"
      }
    }
  ],
  "tokens": { "summary": 12, "body": 280 },
  "etag": "<computed by generator>",
  "metadata": {
    "source": { "adapter": "act-builderio", "source_id": "builder-content-id-welcome" }
  }
}
```

### Example 7 — Variant emission (Plus, `experiments: "emit"`)

Base node:

```json
{
  "act_version": "0.1",
  "id": "act-builderio/landing/pricing",
  "type": "landing",
  "title": "Pricing",
  "summary": "Acme pricing tiers.",
  "content": [{ "type": "marketing:hero", "headline": "Pricing", "subhead": "Plans for every team." }],
  "tokens": { "summary": 6, "body": 40 },
  "etag": "<computed by generator>",
  "metadata": { "source": { "adapter": "act-builderio", "source_id": "builder-content-pricing" } }
}
```

Variant node:

```json
{
  "act_version": "0.1",
  "id": "act-builderio/landing/pricing@enterprise-2026q2",
  "type": "landing",
  "title": "Pricing — Enterprise (2026 Q2)",
  "summary": "Pricing — enterprise variant for the 2026-Q2 experiment arm.",
  "content": [{ "type": "marketing:hero", "headline": "Built for enterprise scale.", "subhead": "SLA-backed, audit-ready." }],
  "tokens": { "summary": 14, "body": 90 },
  "etag": "<computed by generator>",
  "metadata": {
    "variant": { "base_id": "act-builderio/landing/pricing", "key": "enterprise-2026q2", "source": "experiment" },
    "source":  { "adapter": "act-builderio", "source_id": "builder-content-pricing#enterprise-2026q2" }
  },
  "related": [{ "id": "act-builderio/landing/pricing", "relation": "variant_of" }]
}
```

---

## Test fixtures

Fixtures live under `fixtures/206/`.

### Positive

- `fixtures/206/positive/extraction-standard-emission.json` → R1, R2, R5, R7, R8, R9, R14, R21, R22.
- `fixtures/206/positive/extraction-plus-with-component-mapping.json` → R13, R22 (Plus branch) with `marketing:hero` + `marketing:pricing-table`.
- `fixtures/206/positive/extraction-plus-with-locale.json` → R17, R22 with `metadata.locale` + `metadata.translations`.
- `fixtures/206/positive/extraction-plus-with-experiments.json` → R18 with variant nodes.
- `fixtures/206/positive/passthrough-plus-emission.json` → R10, R11, R22 (Plus). Single `marketing:builder-page` block per page.
- `fixtures/206/positive/text-component-walk.json` → R9 (Text → `prose` markdown via HTML conversion).
- `fixtures/206/positive/customcode-component-walk.json` → R9 (CustomCode → `code`).
- `fixtures/206/positive/section-flatten.json` → R9 (Section flattens).
- `fixtures/206/positive/symbol-recursion-depth-2.json` → R12 (depth 2, no warning).
- `fixtures/206/positive/symbol-recursion-cycle-tolerated.json` → R12 cycle detection.
- `fixtures/206/positive/reference-resolution-depth-1.json` → R14, R15.
- `fixtures/206/positive/reference-cycle-tolerated.json` → R16 with `metadata.reference_cycles: 1`.
- `fixtures/206/positive/delta-incremental.json` → R19 with `lastUpdated` marker.
- `fixtures/206/positive/draft-mode.json` → R3 with `metadata.preview: true`.
- `fixtures/206/positive/concurrency-limited-to-4.json` → R21.
- `fixtures/206/positive/webhook-signature-valid.json` → R20 with valid HMAC.
- `fixtures/206/positive/idfield-data-url-default.json` → R8 default (`data.url`).
- `fixtures/206/positive/idfield-content-id-fallback.json` → R8 fallback when `data.url` absent.
- `fixtures/206/positive/summary-extracted-from-text.json` → R8 with `summary_source: "extracted"`.
- `fixtures/206/positive/empty-filter-allowed.json` → R6 with `allowEmpty: true`.

### Negative

- `fixtures/206/negative/init-missing-apikey.expected.json` → R2.
- `fixtures/206/negative/init-private-key-detected.expected.json` → R2 / R25 (private key supplied; reject; key redacted in error).
- `fixtures/206/negative/init-auth-failed.expected.json` → R25; key redacted.
- `fixtures/206/negative/init-model-not-found.expected.json` → R5 (404 on configured model).
- `fixtures/206/negative/init-reference-depth-exceeds-3.expected.json` → R15.
- `fixtures/206/negative/init-symbol-recursion-max-exceeds-3.expected.json` → R12.
- `fixtures/206/negative/init-mode-invalid.expected.json` → R4 (mode outside enum).
- `fixtures/206/negative/empty-filter-default-warns.expected.json` → R6.
- `fixtures/206/negative/extraction-unmapped-component.expected.json` → R9 / R23 partial node + warning.
- `fixtures/206/negative/extraction-coverage-warning.expected.json` → R23 (>50% unmapped → warning suggesting pass-through).
- `fixtures/206/negative/symbol-recursion-bound-exceeded.expected.json` → R12 partial node.
- `fixtures/206/negative/passthrough-emits-extra-block.expected.json` → R10 (pass-through MUST NOT emit alongside `marketing:builder-page`); rejected by schema validation.
- `fixtures/206/negative/rate-limit-exhausted.expected.json` → R24 partial node.
- `fixtures/206/negative/key-in-log.expected.json` → R26 violation detected.
- `fixtures/206/negative/key-in-envelope.expected.json` → R27 violation detected.
- `fixtures/206/negative/component-mapping-malformed.expected.json` → component reference missing required marketing-block fields → partial.
- `fixtures/206/negative/version-pinning-stage-1-mismatch.expected.json` → R29.
- `fixtures/206/negative/webhook-signature-invalid.expected.json` → R20 returns false.

---

## Versioning & compatibility

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add an optional field to `BuilderConfig` | MINOR | PRD-108-R4(1). |
| Add a value to the `mode` enum (e.g., `"hybrid"`) | MAJOR | Closed enum; PRD-108-R5(4). |
| Add a value to the `experiments` enum | MAJOR | Same. |
| Add a new Builder primitive walker rule | MINOR | New optional rule. |
| Add a new `componentMapping` target type within `marketing:*` | MINOR | PRD-102-R6 (open namespace). |
| Tighten `referenceDepth` cap from 3 to 2 | MAJOR | PRD-108-R5(6). |
| Tighten `symbolRecursionMax` cap from 3 to 2 | MAJOR | Same. |
| Change default `mode` from `"extraction"` to `"pass-through"` | MAJOR | PRD-108-R5(2) — changes default emission shape. |
| Change `marketing:builder-page` block field shape (rename `payload` → `tree`) | MAJOR | PRD-108-R5(1) / (2). The field name is part of the documented-open `marketing:*` payload contract. |
| Change `metadata.source.source_id` formula | MAJOR | Provenance grammar change. |
| Change webhook signature algorithm | MAJOR | Security-relevant. |
| Promote Stage 2 pinning opt-in | MINOR | Per PRD-200-R26. |
| Editorial / prose clarification | n/a | Per `000-governance` R18. |

### Forward compatibility

Generators implementing PRD-206 v0.1 MUST tolerate unknown optional fields per PRD-108-R7. Consumers of `marketing:builder-page` blocks MUST treat unknown fields inside `payload` as opaque (the payload is Builder's own data shape and evolves on Builder's release schedule, not ACT's).

### Backward compatibility

`act-builderio@0.1.x` emits `act_version: "0.1"` only. Future MINOR bumps require coordinated release per PRD-200-R25.

---

## Security considerations

Cites PRD-109 for the project-wide threat model. Builder.io-specific deltas:

**API key kind validation (T2).** Builder.io issues two key kinds: **public** (read-only, browser-exposable) and **private** (write, server-only). The adapter is read-only and MUST be configured with a public key. PRD-206-R2 / R25 require detecting a private key (typically by attempting a no-op write that fails for public keys) and rejecting at `init`. Misuse — supplying a private key — would expose write credentials in the build process and risk accidental writes; rejecting at `init` is the simplest defense. The detection is best-effort: Builder.io has not always exposed a clean public-vs-private signal. When detection is ambiguous, the adapter SHOULD emit a warning rather than reject, but MUST log an audit-friendly message.

**Token redaction (T2, T5).** PRD-206-R26 / R27 prohibit logging or emitting the API key. Operators SHOULD reference the key via env var.

**Pass-through mode emits opaque structured payload (T8 analog).** The `marketing:builder-page` block carries Builder's raw component tree. Consumers that render the tree MUST apply Builder's own security posture — Text components contain HTML that consumers MUST sanitize per PRD-109. The adapter does not pre-sanitize the tree because doing so would defeat pass-through's purpose (preserve fidelity for Builder-aware consumers). The wire format permits the block; PRD-109's general "consumers MUST sanitize HTML" rule applies. This is the most security-relevant difference between Builder.io and the other CMS adapters: pass-through mode shifts more responsibility to the consumer than markdown-based bodies do.

**Webhook signature verification (T6 analog).** Builder.io's webhook signature is HMAC-SHA256. PRD-206-R20 exposes `verifyWebhookSignature`.

**Symbol recursion as a complexity vector.** Cycles in Symbol references can cause infinite walker recursion. PRD-206-R12 caps depth at 3 and detects cycles.

**Reference cycles.** Tolerated per PRD-206-R16 / PRD-102-R20. Default `referenceDepth: 1` is the primary control.

**Variant emission as correlation surface (T4 analog).** When `experiments: "emit"` is set, the adapter emits IDs of the form `{base_id}@{variant_key}` per PRD-102-R29. PRD-102's security section warns that variant IDs reveal which experiment arm a piece of content is in. Producers serving variants SHOULD treat them as public information OR exclude experiment variants from public ACT output (default `experiments: "skip"`).

**Builder.io CDN URLs.** Builder.io serves images and assets at `https://cdn.builder.io/...`. The walker emits these URLs verbatim in markdown image syntax in extraction mode and as `payload` data in pass-through mode. Consumers apply normal external-URL hygiene.

For all other concerns, cite PRD-109 directly.

---

## Implementation notes

### Snippet 1 — The adapter's `init` with private-key detection

```ts
// packages/builderio-adapter/src/index.ts
import type { Adapter, AdapterCapabilities } from "@act/adapter-framework";
import type { BuilderConfig, BuilderContent } from "./types.js";

export const builderioAdapter: Adapter<BuilderConfig, BuilderContent> = {
  name: "act-builderio",

  async init(config, ctx): Promise<AdapterCapabilities> {
    validateConfig(config);  // PRD-206-R2
    if (config.referenceDepth !== undefined && (config.referenceDepth < 0 || config.referenceDepth > 3)) {
      throw new AdapterError({ code: "config_invalid", message: "referenceDepth must be 0–3" });
    }
    if (config.symbolRecursionMax !== undefined && (config.symbolRecursionMax < 1 || config.symbolRecursionMax > 3)) {
      throw new AdapterError({ code: "config_invalid", message: "symbolRecursionMax must be 1–3" });
    }
    await verifyKeyKind(config);    // PRD-206-R2 / R25 — reject private keys; redact key in errors
    await probeModels(config);      // PRD-206-R5 — 404s reject
    const mode = config.mode ?? "extraction";
    const level = computeLevel(mode, config);  // PRD-206-R11 matrix
    return {
      level,
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
  // ...
};

function computeLevel(mode: "pass-through" | "extraction", config: BuilderConfig): "standard" | "plus" {
  if (mode === "pass-through") return "plus";  // R11
  if (config.componentMapping) return "plus";
  if (config.locale) return "plus";
  if (config.experiments === "emit") return "plus";
  return "standard";
}
```

### Snippet 2 — Extraction-mode primitive walk (PRD-206-R9)

```ts
// packages/builderio-adapter/src/extract.ts
import type { ContentBlock, AdapterContext } from "@act/wire-format";
import type { BuilderBlock, BuilderConfig } from "./types.js";
import { htmlToMarkdown } from "./html-to-markdown.js";

export function walkBuilderTree(
  blocks: BuilderBlock[],
  config: BuilderConfig,
  ctx: AdapterContext,
  symbolDepth = 0,
  visitedSymbols = new Set<string>(),
): { content: ContentBlock[]; unmapped: number; total: number; partial: boolean } {
  const out: ContentBlock[] = [];
  let unmapped = 0;
  let total = 0;
  let partial = false;
  for (const blk of blocks ?? []) {
    total++;
    const compName = blk.component?.name;
    const opts = blk.component?.options ?? {};
    if (config.componentMapping?.[compName]) {
      out.push(emitMarketingBlock(blk, config.componentMapping[compName]));  // PRD-206-R13
      continue;
    }
    switch (compName) {
      case "Text": {
        const md = htmlToMarkdown(opts.text ?? "");
        if (md.lossy) partial = true;
        out.push({ type: "prose", format: "markdown", text: md.text });
        break;
      }
      case "Image":
        out.push({ type: "prose", format: "markdown", text: `![${opts.altText ?? ""}](${opts.image})` });
        break;
      case "Button":
        out.push({ type: "prose", format: "markdown", text: `[${opts.text ?? ""}](${opts.link ?? "#"})` });
        break;
      case "CustomCode":
        out.push({ type: "code", language: opts.language ?? "text", text: opts.code ?? "" });
        break;
      case "Section": {
        const child = walkBuilderTree(blk.children ?? [], config, ctx, symbolDepth, visitedSymbols);
        out.push(...child.content);
        unmapped += child.unmapped;
        total    += child.total;
        partial = partial || child.partial;
        break;
      }
      case "Symbol": {
        const max = config.symbolRecursionMax ?? 3;
        const symId = blk.symbol?.entry;
        if (symbolDepth >= max || (symId && visitedSymbols.has(symId))) {
          out.push({ type: "prose", format: "markdown", text: `(symbol recursion bound exceeded at depth ${symbolDepth})` });
          partial = true;
          break;
        }
        if (symId) visitedSymbols.add(symId);
        const symBlocks = (blk.symbol?.data?.blocks ?? []) as BuilderBlock[];
        const child = walkBuilderTree(symBlocks, config, ctx, symbolDepth + 1, visitedSymbols);
        out.push(...child.content);
        unmapped += child.unmapped;
        total    += child.total;
        partial = partial || child.partial;
        break;
      }
      default:
        ctx.logger.warn("builder: unmapped component", { component: compName });
        out.push({ type: "prose", format: "markdown", text: `(unmapped Builder component: ${compName})` });
        unmapped++;
        partial = true;
    }
  }
  return { content: out, unmapped, total, partial };
}
```

### Snippet 3 — Pass-through mode (PRD-206-R10)

```ts
export function emitPassThrough(content: BuilderContent, config: BuilderConfig): ContentBlock {
  return {
    type: "marketing:builder-page",
    model: content.modelName ?? "page",
    payload: content.data ?? {},
    metadata: {
      builderApiVersion: "v3",
      builderModelKind:  content.modelName ?? "page",
    },
  };
}
```

### Snippet 4 — Coverage warning (PRD-206-R23)

```ts
function checkCoverage(
  pageId: string,
  unmapped: number,
  total: number,
  threshold: number,
  ctx: AdapterContext,
) {
  if (total === 0) return;
  const ratio = unmapped / total;
  if (ratio > threshold) {
    ctx.logger.warn("builder extraction: high unmapped-component fraction", {
      pageId, unmapped, total, ratio,
      suggestion: "consider mode: 'pass-through' for this content set",
    });
  }
}
```

### Snippet 5 — Webhook signature verification (PRD-206-R20)

```ts
// packages/builderio-adapter/src/webhook.ts
import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyWebhookSignature(body: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(body, "utf8").digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

### Snippet 6 — Variant emission (PRD-206-R18)

```ts
function emitVariants(
  base: EmittedNode,
  variants: BuilderContent["variants"],
  config: BuilderConfig,
): EmittedNode[] {
  if (config.experiments !== "emit" || !variants?.length) return [base];
  const out: EmittedNode[] = [base];
  for (const v of variants) {
    const variantKey = slugCase(v.id ?? v.name ?? "variant");
    out.push({
      ...base,
      id: `${base.id}@${variantKey}`,
      title: `${base.title} (${v.name ?? variantKey})`,
      content: walkBuilderTreeForVariant(v.data?.blocks ?? [], config),
      metadata: {
        ...base.metadata,
        variant: { base_id: base.id, key: variantKey, source: "experiment" },
        source:  { adapter: "act-builderio", source_id: `${base.metadata?.source?.source_id}#${variantKey}` },
      },
      related: [{ id: base.id, relation: "variant_of" }],
    });
  }
  return out;
}
```

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft. Implements the parent PRD-200 contract for Builder.io's Content API. Two emission modes: **pass-through** (a single `marketing:builder-page` block per page carrying the raw Builder tree as `payload` — Plus only) and **extraction** (walk well-known Builder primitives `Text` / `Image` / `Button` / `CustomCode` / `Section` / `Symbol` into ACT `prose` / `code` / `marketing:*` blocks per a configured mapping — Standard or Plus depending on configuration). Configuration validates that the supplied API key is a public read key (rejects private keys); models filter; type-and-field mapping; reference depth (default 1, max 3); Symbol recursion bound (default 3, max 3). Locale handling via Builder targeting (Plus). Experiment / variant emission per PRD-102-R29 (Plus) when `experiments: "emit"`. Coverage warning when extraction-mode unmapped-component fraction exceeds 0.5 — suggests pass-through. Incremental rebuild via `lastUpdated` delta marker + webhook signature verification (HMAC-SHA256). API key never logged or emitted into envelopes per PRD-109. Status: In review. |
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review; no normative changes. Decisions: (1) pass-through mode extracts `summary` from the first Text component (capped at 50 tokens) with `summary_source: "extracted"`; (2) Builder.io `Section` flattens by default — operators opt in via `componentMapping` for `marketing:section`; (3) experiment / variant emission is opt-in via `experiments: "emit"` (skip variants by default). |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
