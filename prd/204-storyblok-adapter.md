# PRD-204 — Storyblok adapter

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

Storyblok is a headless CMS that organizes content as **stories** (documents at routable paths) composed of **components** (reusable nbloks like hero, cta, feature-grid, accordion). Its Content Delivery API exposes both a JSON view of the published or draft tree and a webhook surface for build invalidation. Storyblok's component-block model is naturally aligned with ACT's `marketing:*` namespace — a Storyblok hero component maps cleanly to `marketing:hero` (PRD-102-R7) — and its rich-text format maps to portable prose. Without a first-party adapter, every Storyblok-backed site has to re-derive the component-to-block mapping, the rich-text walk, the version (draft vs published) toggle, and the webhook glue. Decision Q3 commits ACT v0.1 to TS-only first-party reference impls; this PRD specifies the Storyblok adapter against the parent PRD-200 framework contract.

PRD-100, PRD-102, PRD-103, PRD-107, PRD-108, PRD-109 (all Accepted) define the wire-format envelopes, content-block taxonomy, ETag derivation, conformance bands, versioning regime, and security posture this adapter must respect. PRD-200 (in review) defines the framework contract this adapter implements. Gap E6 (CMS schema mapping DSL unification) is explicitly deferred to v0.2; this PRD documents Storyblok's mapping conventions as a sibling to Sanity (PRD-203), Strapi (PRD-205), and Builder.io (PRD-206) rather than attempting cross-CMS unification.

### Goals

1. Lock the **adapter configuration** schema for Storyblok — space ID, access token, version (draft vs published), components/stories filter, story type mapping, field mapping rules.
2. Lock the **story-type → ACT type mapping** with sensible defaults and per-content-type overrides.
3. Lock the **field mapping** from Storyblok story fields to ACT node fields: title (story `name`), summary, body, tags (Storyblok `tag_list`), references → `related`.
4. Lock the **rich-text → ACT content blocks** walk for Storyblok's rich-text JSON (TipTap-derived schema): paragraphs/headings → `prose` (markdown); lists → `prose` (markdown lists); code blocks → `code`; blockquotes → `callout`.
5. Lock the **component blocks → `marketing:*`** mapping when configured: Storyblok components named `hero`, `cta`, `feature-grid`, `pricing-table`, `testimonial`, `faq` map to the corresponding `marketing:*` block types per PRD-102-R7–R11; custom mappings opt in via config.
6. Lock the **reference resolution** semantics for Storyblok story refs (`{linktype: "story", id, slug}`) — depth-bounded, cycle-tolerant.
7. Lock the **incremental rebuild** path via Storyblok webhook events — `story.published`, `story.unpublished`, `story.deleted` — surfaced through the framework's `delta(since)` hook.
8. Lock the **locale handling** when Storyblok's native i18n is in use (`language` URL parameter or per-locale folders).
9. Lock the **capability declaration**, **failure modes**, and **conformance** — Standard by default; Plus when component mapping + locale are configured.
10. Provide TypeScript implementation-notes snippets (3–6) and enumerate the test fixture matrix.

### Non-goals

1. Defining the adapter framework — owned by PRD-200.
2. Defining wire format / blocks / ETag / conformance / versioning — owned by PRD-100 / PRD-102 / PRD-103 / PRD-107 / PRD-108.
3. Defining the i18n adapter — owned by PRD-207. The Storyblok adapter cooperates via the merge step.
4. Defining component-contract emission — owned by PRD-300. Storyblok components are CMS-side data, not framework-side React/Vue components; the adapter does NOT emit `metadata.extracted_via: "component-contract"`.
5. Unifying CMS mapping DSL — deferred to v0.2 per gap E6.
6. Authoring a non-TypeScript Storyblok adapter — per decision Q3, v0.1 is TS-only.
7. Defining Storyblok's Visual Editor / preview integration. The adapter consumes the Content Delivery API; preview-mode glue (Storyblok bridge JS) is the consumer's concern.

### Stakeholders / audience

- **Authors of:** sites running Storyblok-backed marketing or docs surfaces under any of the 400-series generators.
- **Consumers of:** PRD-400 (generator architecture), PRD-401 (Astro), PRD-405 (Next.js).
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Storyblok component-block sprawl — sites with hundreds of custom components produce unmappable bodies | High | Medium | The default behavior emits a partial-extraction warning per unmapped component; PRD-204-R10 documents the explicit `componentMapping` opt-in path. Operators see warnings early and add mappings. |
| `version: "draft"` accidentally leaks unpublished content | Medium | High | PRD-204-R3 mandates explicit version config (default `"published"`); `metadata.preview: true` stamped on every draft-mode emission. |
| Rich-text walk loses TipTap-specific marks (e.g., text-color, anchor) | Medium | Low | Default walk maps standard marks; non-canonical marks pass through as plaintext with a partial warning when configured. PRD-204-R8 lists the canonical mark set. |
| Webhook-driven delta misses race-condition between webhook and CDN eventual consistency | Medium | Medium | PRD-204-R14 specifies the `cv` (cache version) query parameter for cache-busting; PRD-204-R15 documents the webhook → marker translation. |
| Access token leaks into envelopes | Low | High | PRD-204-R23 / R24 prohibit logging or emitting the token. PRD-109 cited. |
| Storyblok rate limits during full crawls of large spaces | Medium | Medium | PRD-204-R19 specifies retry-with-backoff per PRD-200's recoverable-failure path. `concurrency_max: 6` default reflects Storyblok's CDN-tier rate budget. |
| Component-block recursion depth (a `feature-grid` containing `cta` containing `feature-grid`) | Low | Medium | PRD-204-R9 caps component-block recursion at depth 4; deeper structures fall back to opaque `metadata` payloads with a partial warning. |

### Open questions

1. ~~Should the adapter expose Storyblok's **datasource** entries (key/value pairs hosted in Storyblok and referenced by stories) as separate ACT nodes, as `metadata` decoration, or skip them?~~ **Resolved (2026-05-01): Skip in v0.1.** Datasources are config, not content. Revisit in v0.2 if a real-world site needs them; adding emission is MINOR per PRD-108-R4(1). (Closes Open Question 1.)
2. ~~Should the adapter normalize Storyblok's `_uid` (per-component random ID) into ACT block-level `metadata.source.block_uid`?~~ **Resolved (2026-05-01): Yes, but stamp it at `metadata.block_uid` on the block (not under `metadata.source.*`).** Per PRD-200's reservation of `metadata.source.*` for framework provenance, the adapter emits the Storyblok component UID at `metadata.block_uid` (block-level, producer-defined, open per PRD-100-R22). Provenance-friendly without leaking sensitive identifiers. PRD-204's body and fixtures should reflect the `metadata.block_uid` placement. (Closes Open Question 2.)
3. ~~Should the webhook payload include an HMAC signature verification helper exposed by the adapter for generators wiring incremental rebuilds?~~ **Resolved (2026-05-01): Yes.** PRD-204-R16 specifies the verification hook; the actual webhook receiver is the generator's concern (PRD-400). (Closes Open Question 3.)

### Acceptance criteria

- [ ] Every normative requirement has an ID `PRD-204-R{n}` and a declared conformance level per PRD-107.
- [ ] The Specification section opens with a table mapping every requirement to PRD-200 + 100-series requirement(s).
- [ ] Implementation notes contain 3–6 short TypeScript snippets.
- [ ] Test fixture paths under `fixtures/204/positive/` and `fixtures/204/negative/` are enumerated.
- [ ] Versioning & compatibility section classifies kinds-of-change per PRD-108.
- [ ] Security section cites PRD-109 and documents Storyblok-specific deltas (token handling, webhook signature verification).
- [ ] Changelog entry dated 2026-05-01 by Jeremy Forsythe is present.

---

## Context & dependencies

### Depends on

- **PRD-200** (in review) — adapter framework.
- **PRD-100** (Accepted) — wire format. Emitted nodes validate against `schemas/100/node.schema.json`.
- **PRD-102** (Accepted) — content blocks. Storyblok rich-text → `prose` / `markdown` / `code` / `callout`; component blocks → `marketing:*`.
- **PRD-103** (Accepted) — caching / ETag. Generator computes ETags; adapter does not.
- **PRD-107** (Accepted) — conformance. Standard by default; Plus when component mapping + locale configured.
- **PRD-108** (Accepted) — versioning. Stage 1 pinning per PRD-200-R25.
- **PRD-109** (Accepted) — security. T2 (token handling), T5 (PII in errors), T6 (webhook signature verification).
- **PRD-207** (in flight) — i18n adapter. Cooperates via merge step.
- External: [Storyblok Content Delivery API](https://www.storyblok.com/docs/api/content-delivery/v2), [Storyblok webhooks](https://www.storyblok.com/docs/guide/in-depth/webhooks), [`storyblok-js-client`](https://github.com/storyblok/storyblok-js-client), [`@storyblok/richtext`](https://github.com/storyblok/richtext) (TipTap-derived schema).

### Blocks

- None directly; aspirationally feeds PRD-702-style examples that use Storyblok in lieu of Contentful.

### References

- v0.1 draft: §5.10 (adapter pipeline), §5.10.3 (multi-source merge with CMS).
- `prd/000-gaps-and-resolutions.md` gap **E6** (CMS DSL deferred to v0.2 — documented here as a known divergence).
- `prd/000-decisions-needed.md` Q3, Q5, Q7.
- Prior art: [`storyblok-nuxt`](https://github.com/storyblok/storyblok-nuxt), [`@storyblok/astro`](https://github.com/storyblok/storyblok-astro), [`gridsome-source-storyblok`](https://github.com/storyblok/gridsome-source-storyblok). Cited for shape.

---

## Specification

This is the normative section. Every requirement uses RFC 2119 keywords as clarified by RFC 8174.

### Parent + 100-series requirements implemented

| PRD-204 requirement | Parent / 100-series requirement(s) | Relationship |
|---|---|---|
| R1 (interface compliance) | PRD-200-R1 | Implements `Adapter`. |
| R2 (config schema) | PRD-200-R3, R20 | Validated in `init`. |
| R3 (`version` field — draft vs published) | PRD-200-R3 | Default `published`. |
| R4 (story filter) | PRD-200-R4 | `enumerate` paginates Storyblok's `cdn/stories`. |
| R5 (filter result safety) | PRD-200-R18 | Empty result + no `allowEmpty` → warning. |
| R6 (story-type mapping) | PRD-100-R21, PRD-200-R5 | Storyblok content type → ACT `type`. |
| R7 (field mapping) | PRD-100-R21, R22 | Storyblok story fields → ACT envelope fields. |
| R8 (rich-text walk) | PRD-102-R1, R2, R3, R5 | TipTap-derived JSON → `prose` / `markdown` / `code` / `callout`. |
| R9 (component-block recursion bound) | — | Depth ≤ 4; deeper falls back to partial. |
| R10 (component → `marketing:*` — Plus) | PRD-102-R6, R7–R11 | Configured component mapping. |
| R11 (story-link resolution) | PRD-102-R18, R19, R20 | Storyblok `{linktype: "story"}` → `related`. |
| R12 (resolution depth) | — | Default 1; max 5. |
| R13 (cycle handling) | PRD-102-R20 | Tolerated; warning emitted. |
| R14 (locale handling) | PRD-100-R22, PRD-104 (in flight) | `metadata.locale`; per-locale story IDs. |
| R15 (incremental rebuild via webhook) | PRD-200-R9 | `delta(since)` keyed on Storyblok `cv`. |
| R16 (webhook signature verification) | PRD-109-R5–R9 | HMAC validation helper exposed by the adapter. |
| R17 (capability declaration) | PRD-200-R22 | `AdapterCapabilities` from `init`. |
| R18 (level — Standard) | PRD-107-R8 | Default. |
| R19 (level — Plus when configured) | PRD-107-R10 | Plus when component mapping + locale. |
| R20 (failure mode — rate limit) | PRD-200-R16 | Retry with backoff. |
| R21 (failure mode — auth) | PRD-200-R18 | Throw from `init`. |
| R22 (failure mode — partial extraction) | PRD-200-R16, R17 | `metadata.extraction_status: "partial"`. |
| R23 (security — no token in logs) | PRD-109-R14, R15 | Redaction. |
| R24 (security — no token in envelopes) | PRD-109-R1, R2, R14 | Token never emitted. |
| R25 (provenance — Storyblok source_id) | PRD-200-R13 | `source_id` is Storyblok story `uuid`. |
| R26 (Stage 1 pinning) | PRD-200-R25, PRD-108-R14 | `act-storyblok@0.1.x` → `act_version: "0.1"` only. |
| R27 (test-fixture conformance) | PRD-200-R28 | Adapter passes framework + Storyblok corpora. |

### Conformance level

- **Core:** R1, R2, R4, R6, R7, R8 (markdown subset), R11 (basic story-link emission), R17, R18, R21, R23, R24, R25, R26, R27.
- **Standard:** R3, R5, R8 (full rich-text walk), R9, R11 (full link resolution), R12, R13, R15, R16, R20, R22.
- **Plus:** R10 (component → `marketing:*`), R14 (locale), R19.

### Normative requirements

#### Adapter contract

**PRD-204-R1.** The `act-storyblok` adapter MUST implement the `Adapter` interface defined in PRD-200-R1. The package's default export MUST satisfy `Adapter<StoryblokConfig, StoryblokStory>` where `StoryblokConfig` is the configuration schema in PRD-204-R2. Conformance: **Core**.

#### Configuration

**PRD-204-R2.** The adapter MUST validate its configuration against the schema below in `init`. Required: `spaceId` (number or string), `accessToken` (string OR env-var reference). Optional: `region` (`"eu" | "us" | "cn" | "ap"`, default `"eu"`), `version` (`"published" | "draft"`, default `"published"`), `cv` (number, optional cache version), `storyFilter` (object — Storyblok query params like `starts_with`, `filter_query`, `by_uuids`), `typeMapping` (object), `fieldMapping` (object), `idField` (string, default `"slug"`), `linkResolutionDepth` (integer 0–5, default 1), `componentMapping` (object, optional), `locale` (object, optional), `summary` (object, optional). Validation failures cause `init` to reject. Conformance: **Core**.

**PRD-204-R3.** The `version` config field MUST default to `"published"`. When set to `"draft"`, the adapter MUST request the draft perspective and MUST stamp `metadata.preview: true` on every emitted node. Mixing `version` modes within one run is a configuration error. Conformance: **Standard**.

**PRD-204-R4.** The adapter's `enumerate` MUST issue paginated requests against Storyblok's `cdn/stories` endpoint, applying the configured `storyFilter` query parameters. The adapter MUST request `resolve_links: "url"` (or `"link"` when `linkResolutionDepth >= 1`) and MUST request `resolve_relations` for every story-reference field declared under `fieldMapping.related`. Pagination MUST use Storyblok's `per_page` (default 100, max 100) and `page` parameters. Conformance: **Core**.

**PRD-204-R5.** When the configured filter returns zero stories AND `allowEmpty: true` is not set, the adapter MUST emit a build warning citing the filter and the result count. The adapter MUST NOT throw — empty result sets are valid in some configurations. Conformance: **Standard**.

#### Content-type and field mapping

**PRD-204-R6.** The adapter MUST map Storyblok story content-type values (the story's `content.component` field) to ACT `type` per the `typeMapping` config. The default mapping is identity: a story with `content.component: "page"` becomes ACT `type: "page"`. Operators MAY override per-component-name. A story whose component has no mapping AND identity default has been disabled MUST be skipped (`transform` returns `null`); the adapter MUST emit a debug-log entry citing the skipped story's `uuid`. Conformance: **Core**.

**PRD-204-R7.** The adapter MUST map Storyblok story fields to ACT envelope fields per the `fieldMapping` config. The default mapping is:

| ACT field | Storyblok source (default) | Notes |
|---|---|---|
| `id` | `full_slug` (slash-separated path) | Override via `idField`. Sanitized to ID grammar (PRD-100-R10). |
| `title` | `name` (story title) | String required. |
| `summary` | `content.summary` if present, else first rich-text paragraph extracted to plaintext (capped at 50 tokens) | When extracted, `summary_source: "extracted"`. |
| `abstract` | `content.abstract` if present | Optional. |
| `content` | `content.body` (rich text + component blocks) | Walked per PRD-204-R8 / R10. |
| `tags` (in `metadata.tags`) | `tag_list` (Storyblok native) | Optional. |
| `related` | configured story-reference fields | Per PRD-204-R11. |
| `updated_at` | `published_at` (when `version: published`) or `updated_at` (when draft) | RFC 3339. |
| `metadata.locale` | `lang` (Storyblok i18n) | Per PRD-204-R14. |

Operators MAY override any row via `fieldMapping`. The adapter MUST emit a partial node with `metadata.extraction_status: "partial"` when a required field is unmappable rather than throwing. Conformance: **Core** (defaults), **Standard** (overrides + partial-emission).

#### Rich-text walk

**PRD-204-R8.** The adapter MUST walk Storyblok rich-text JSON (TipTap-derived schema; node types `paragraph`, `heading`, `bullet_list`, `ordered_list`, `list_item`, `code_block`, `blockquote`, `horizontal_rule`, `image`, `blok`) into ACT content blocks per the following:

- `paragraph` and `heading` (levels 1–6) → single `prose` block with `format: "markdown"`. Heading level prepended as markdown (`#` to `######`). Marks: `bold` → `**...**`, `italic` → `*...*`, `code` → `` `...` ``, `link` → `[text](href)`, `strike` → `~~...~~`.
- `bullet_list` / `ordered_list` → single `prose` block coalesced from list items (PRD-102-R24 ordering).
- `code_block` → `code` block (PRD-102-R3) with `language` from the node's `attrs.class` (e.g., `language-bash` → `bash`; default `text`) and `text` from the node's text content.
- `blockquote` → `callout` block (PRD-102-R5) with `level: "info"` (default; configurable via `fieldMapping.calloutLevel`).
- `horizontal_rule` → `prose` block with `format: "markdown"` and `text: "---"`.
- `image` → `prose` block with markdown image syntax `![alt](src)`. The image's `src` field is preserved verbatim (not re-hosted).
- `blok` (an embedded component) → handled per PRD-204-R10 / R9.

The walker MUST preserve source order. Unknown node types MUST cause a partial-extraction warning and produce a `prose` block with `text: "(unsupported rich-text node: <type>)"`. Conformance: **Standard**.

#### Component-block recursion bound

**PRD-204-R9.** Storyblok component blocks (`blok` nodes embedding nested components) MAY recurse to depth **4**. Beyond depth 4, the adapter MUST emit a partial-extraction warning AND fall back to a single `prose` block whose `text` is `(component recursion bound exceeded at depth N: <component-name>)`. Operators MAY tighten the bound via `componentRecursionMax` config (range 1–4); they MUST NOT loosen it above 4. Conformance: **Standard**.

#### Component → `marketing:*` mapping (Plus)

**PRD-204-R10.** When the adapter is configured with `componentMapping`, embedded `blok` nodes whose Storyblok component name matches a key in `componentMapping` MUST be emitted as the corresponding `marketing:*` block (PRD-102-R7–R11). The mapping config takes the shape:

```json
{
  "componentMapping": {
    "hero":           { "type": "marketing:hero",        "fields": { "headline": "headline", "subhead": "subhead", "cta": { "label": "ctaLabel", "href": "ctaHref" } } },
    "feature-grid":   { "type": "marketing:feature-grid","fields": { "features": "features[].{title, description, icon}" } },
    "pricing-table":  { "type": "marketing:pricing-table","fields": { "tiers": "tiers[].{name, price, features}" } },
    "testimonial":    { "type": "marketing:testimonial", "fields": { "quote": "quote", "author": "author", "role": "role", "org": "organization" } },
    "faq":            { "type": "marketing:faq",         "fields": { "items": "items[].{question, answer}" } }
  }
}
```

The emitted block MUST satisfy the per-type schema in PRD-102. Configuring this mapping is the trigger for Plus-tier emission per PRD-204-R19. Components without a mapping fall through to the partial-extraction path (R8 / R22). Conformance: **Plus**.

#### Story-link resolution

**PRD-204-R11.** The adapter MUST resolve Storyblok story-link fields (`{linktype: "story", id, slug, uuid}`) into ACT `related[]` entries with shape `{ id, relation }` per PRD-102-R18. The default `relation` is `"see-also"`; operators MAY map per-field-name via `fieldMapping.related: { fieldName: relation }`. The referenced story's ACT ID MUST be resolved via the same `idField` rule as the referencing story. Cross-content-type references are permitted. URL-link fields (`linktype: "url"`) MUST NOT produce `related[]` entries — they are external links and MAY be embedded in markdown content if a field mapping requests it. Conformance: **Standard**.

**PRD-204-R12.** Link resolution depth defaults to **1**. Operators MAY set `linkResolutionDepth` between 0 and 5. The adapter MUST request `resolve_links` and `resolve_relations` Storyblok query parameters consistent with the configured depth. A depth above 5 MUST cause `init` to reject. Conformance: **Standard**.

**PRD-204-R13.** Cycles in resolved story-link graphs MUST be tolerated. The adapter MUST detect cycles during resolution and stamp `metadata.reference_cycles: <count>` on the affected node. Conformance: **Standard**.

#### Locale handling

**PRD-204-R14.** When the adapter's `locale` config is set, the adapter MUST emit `metadata.locale` on every emitted node, populated from Storyblok's `lang` field (set per-story by Storyblok when i18n is configured at the space level). Storyblok's two locale patterns are supported:

- **Folder-based locales.** Sibling stories at `/en/...`, `/de/...`, etc. The adapter emits one ACT node per story with its `lang` mapped to `metadata.locale`, and stamps `metadata.translations: [{ locale, id }, ...]` linking to sibling-locale stories with the same translatable-slug grouping (Storyblok's `translated_slugs` field).
- **Field-level translations.** A single Storyblok story with per-field translation arrays. The adapter emits one ACT node per locale, with IDs of the form `{base_id}@{locale}` per PRD-102-R29.

Conformance: **Plus**.

#### Incremental rebuilds

**PRD-204-R15.** The adapter MUST implement `delta(since: string, ctx)` per PRD-200-R9. The `since` marker is the Storyblok `cv` (cache version) integer from the previous build, formatted as a decimal string. The adapter MUST query `cdn/stories?cv={since}` and yield only stories whose `published_at` (or `updated_at` in draft mode) is greater than the marker's timestamp equivalent. The adapter MUST persist the new `cv` value via `ctx.config.deltaMarkerSink` on `dispose`. Conformance: **Standard**.

**PRD-204-R16.** When the generator wires Storyblok webhooks for incremental rebuild (e.g., `story.published` triggers a rebuild), the adapter MUST expose a `verifyWebhookSignature(body, signature, secret)` helper that validates the HMAC-SHA256 signature Storyblok ships in the `webhook-signature` header. The helper MUST return a boolean (signature valid / invalid) and MUST NOT throw on invalid input. The webhook-receiver implementation is the generator's concern (PRD-400); the adapter contributes only the verification primitive. Conformance: **Standard**.

#### Capability declaration

**PRD-204-R17.** The adapter's `init` MUST return an `AdapterCapabilities`:

```ts
{
  level: "standard" | "plus",
  concurrency_max: 6,
  delta: true,
  namespace_ids: true,
  precedence: "primary",
  manifestCapabilities: {
    etag: true, subtree: true, ndjson_index: false,
    search: { template_advertised: false }
  },
  i18n: <true if locale config present>,
  componentContract: false,
  summarySource: "author"
}
```

Conformance: **Core**.

**PRD-204-R18.** The adapter MUST declare `level: "standard"` when no `componentMapping` AND no `locale` config are set. Conformance: **Standard**.

**PRD-204-R19.** The adapter MUST declare `level: "plus"` when EITHER `componentMapping` is configured OR `locale` config is set. Conformance: **Plus**.

#### Failure modes

**PRD-204-R20.** Storyblok API rate-limit responses (HTTP 429) MUST be handled by exponential backoff with at least 3 retries (default: 250ms, 500ms, 1000ms). Persistent rate-limit failure MUST cause the affected story to be emitted as a partial node per PRD-204-R22. Conformance: **Standard**.

**PRD-204-R21.** Authentication failure (HTTP 401 or 403 from any API request) MUST cause `init` to reject with an unrecoverable error per PRD-200-R18. The error message MUST cite that authentication failed and MUST NOT include the access token (per PRD-204-R23). Conformance: **Core**.

**PRD-204-R22.** Item-level extraction failures (a rich-text walk error, an unresolvable link within configured depth, a malformed component blok) MUST cause the adapter to emit a partial node with `metadata.extraction_status: "partial"` and `metadata.extraction_error`. The build MUST NOT exit non-zero on item-level failures. Conformance: **Standard**.

#### Security

**PRD-204-R23.** The adapter MUST NOT log the value of `accessToken` at any log level. The adapter MAY log a fingerprint (first 4 chars) when `config.debugLogging: true` is set. Cites PRD-109-R14 / R15. Conformance: **Core**.

**PRD-204-R24.** The adapter MUST NOT emit the access token (or any prefix longer than 4 characters) into any envelope field. Cites PRD-109-R1, R2, R14. Conformance: **Core**.

#### Provenance

**PRD-204-R25.** The Storyblok-specific `source_id` (used in `metadata.source.source_id`) MUST be the Storyblok story's `uuid` (a stable identifier across slug changes). When emitting per-locale variants via field-level translations, `source_id` is `{uuid}#{locale}`. Conformance: **Standard**.

#### Version pinning

**PRD-204-R26.** Per PRD-200-R25 (Stage 1), `act-storyblok@0.1.x` emits `act_version: "0.1"` only. Migration to Stage 2 is per-package opt-in. Conformance: **Core**.

#### Test fixtures

**PRD-204-R27.** The adapter MUST pass the framework conformance corpus per PRD-200-R28 AND the Storyblok-specific corpus enumerated in §"Test fixtures." Conformance: **Core**.

### Wire format / interface definition

PRD-204 introduces no new wire format. The adapter consumes Storyblok's data shapes and emits PRD-100 envelopes.

#### Configuration schema (TypeScript)

```ts
import type { Adapter } from "@act/adapter-framework";

export interface StoryblokConfig {
  spaceId: number | string;
  accessToken: string;
  region?: "eu" | "us" | "cn" | "ap";
  version?: "published" | "draft";
  cv?: number;
  storyFilter?: {
    starts_with?:    string;
    by_uuids?:       string;
    filter_query?:   Record<string, unknown>;
    [param: string]: unknown;
  };
  allowEmpty?:           boolean;
  typeMapping?:          Record<string, string>;
  fieldMapping?: {
    title?:    string;
    summary?:  string;
    abstract?: string;
    body?:     string;
    tags?:     string;
    related?:  Record<string, string /* relation */>;
    [actField: string]: unknown;
  };
  idField?:              string;
  linkResolutionDepth?:  number;
  componentMapping?:     Record<string, { type: `marketing:${string}`; fields: Record<string, string> }>;
  componentRecursionMax?: number;
  locale?: {
    pattern: "folder" | "field";
    field?:  string;        // "lang" by default
  };
  summary?:               { strategy: "field" | "extract" | "needs-llm" };
  webhookSecret?:         string;       // for verifyWebhookSignature
}

export type StoryblokAdapter = Adapter<StoryblokConfig, StoryblokStory>;

/** Helper exposed for generator-side webhook receivers. */
export function verifyWebhookSignature(body: string, signature: string, secret: string): boolean;
```

### Errors

| Condition | Adapter behavior | Framework behavior | Exit code |
|---|---|---|---|
| `init` config validation failure | Reject from `init` | Build error | non-zero |
| `init` HTTP 401 / 403 | Reject from `init` per R21 | Build error; token redacted | non-zero |
| `enumerate` zero stories, `allowEmpty != true` | Continue + warn per R5 | Warning | 0 |
| `transform` HTTP 429, retries exhausted | Emit partial per R20 / R22 | Warning | 0 |
| `transform` rich-text unmapped node type | Emit partial per R8 / R22 | Warning | 0 |
| `transform` component recursion exceeds R9 bound | Emit partial per R9 / R22 | Warning | 0 |
| `transform` link resolution cycle | Tolerate; stamp `metadata.reference_cycles` | No warning by default | 0 |
| `init` `linkResolutionDepth > 5` | Reject from `init` per R12 | Build error | non-zero |
| `init` `componentRecursionMax > 4` | Reject from `init` per R9 | Build error | non-zero |
| Mixed `version` modes within one config | Reject from `init` per R3 | Build error | non-zero |
| Adapter emits malformed `id` | n/a (framework rejects) | Build error per PRD-100-R10 | non-zero |
| Webhook signature invalid | `verifyWebhookSignature` returns false | Generator's concern (PRD-400) | n/a |

---

## Examples

### Example 1 — Standard configuration (no locale, no component mapping)

```ts
export const storyblokConfig: StoryblokConfig = {
  spaceId: 12345,
  accessToken: process.env.STORYBLOK_TOKEN!,
  region: "eu",
  version: "published",
  storyFilter: { starts_with: "blog/" },
  fieldMapping: {
    title:   "name",
    summary: "content.summary",
    body:    "content.body",
    related: { related_articles: "see-also" }
  },
  linkResolutionDepth: 1
};
```

Adapter declares `level: "standard"`. Emitted nodes carry `prose` / `markdown` / `code` / `callout` blocks from rich-text walks; story-link references become `related[]` entries.

### Example 2 — Plus configuration (component mapping + locale)

```ts
export const storyblokConfig: StoryblokConfig = {
  spaceId: 12345,
  accessToken: process.env.STORYBLOK_TOKEN!,
  storyFilter: { starts_with: "marketing/" },
  fieldMapping: { title: "name", summary: "content.summary", body: "content.body" },
  locale: { pattern: "folder" },
  componentMapping: {
    hero:          { type: "marketing:hero",         fields: { headline: "headline", subhead: "subhead", cta: { label: "ctaLabel", href: "ctaHref" } } },
    "feature-grid":{ type: "marketing:feature-grid", fields: { features: "features[].{title, description, icon}" } },
    "pricing-table":{ type: "marketing:pricing-table", fields: { tiers: "tiers[].{name, price, features}" } }
  }
};
```

Adapter declares `level: "plus"`. Emitted landing-page nodes embed `marketing:hero` and `marketing:pricing-table`; nodes carry `metadata.locale` and `metadata.translations`.

### Example 3 — Emitted Standard-level node from a Storyblok blog post

```json
{
  "act_version": "0.1",
  "id": "act-storyblok/blog/launching-acme",
  "type": "post",
  "title": "Launching Acme",
  "summary": "We are excited to announce the launch of Acme.",
  "summary_source": "author",
  "content": [
    { "type": "prose", "format": "markdown", "text": "## Why we built it\n\nThe market needed..." },
    { "type": "code", "language": "bash", "text": "curl https://api.acme.example/v1" },
    { "type": "callout", "level": "info", "text": "Acme is generally available in the EU and US." }
  ],
  "tokens": { "summary": 12, "body": 540 },
  "etag": "<computed by generator>",
  "related": [
    { "id": "act-storyblok/blog/our-mission", "relation": "see-also" }
  ],
  "updated_at": "2026-04-20T14:00:00Z",
  "metadata": {
    "tags": ["product", "launch"],
    "source": { "adapter": "act-storyblok", "source_id": "uuid-12345-abcde" }
  }
}
```

### Example 4 — Plus-level emission with `marketing:*` blocks from `componentMapping`

```json
{
  "act_version": "0.1",
  "id": "act-storyblok/marketing/pricing",
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
      "type": "marketing:feature-grid",
      "features": [
        { "title": "Fast",    "description": "Sub-second response times.", "icon": "lightning" },
        { "title": "Secure",  "description": "SOC 2 Type II certified.",   "icon": "shield" },
        { "title": "Global",  "description": "Multi-region by default.",   "icon": "globe" }
      ]
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
  "tokens": { "summary": 10, "body": 290 },
  "etag": "<computed by generator>",
  "metadata": {
    "locale": "en",
    "translations": [
      { "locale": "de", "id": "act-storyblok/marketing/pricing@de" }
    ],
    "source": { "adapter": "act-storyblok", "source_id": "uuid-pricing-page" }
  }
}
```

### Example 5 — Component-recursion bound exceeded (partial)

```json
{
  "act_version": "0.1",
  "id": "act-storyblok/over-nested-page",
  "type": "page",
  "title": "Over-nested page",
  "summary": "Page with deeply nested components.",
  "content": [
    { "type": "prose", "format": "markdown", "text": "## Intro\n\nSome content." },
    { "type": "prose", "format": "markdown", "text": "(component recursion bound exceeded at depth 5: feature-grid)" }
  ],
  "tokens": { "summary": 7, "body": 80 },
  "etag": "<computed by generator>",
  "metadata": {
    "extraction_status": "partial",
    "extraction_error": "component recursion exceeded depth 4 in component 'feature-grid'",
    "source": { "adapter": "act-storyblok", "source_id": "uuid-overnested" }
  }
}
```

### Example 6 — Webhook signature verification

```ts
import { verifyWebhookSignature } from "@act/storyblok-adapter";

// In the generator's webhook receiver (PRD-400 owns the receiver):
app.post("/webhooks/storyblok", async (req, res) => {
  const ok = verifyWebhookSignature(req.rawBody, req.headers["webhook-signature"], process.env.STORYBLOK_WEBHOOK_SECRET!);
  if (!ok) return res.status(401).end();
  // ... trigger an incremental rebuild via the adapter's delta() path.
});
```

---

## Test fixtures

Fixtures live under `fixtures/204/`. Each adapter test runs against a recorded Storyblok-API response cassette and asserts the emission.

### Positive

- `fixtures/204/positive/standard-emission.json` → R1, R2, R4, R6, R7, R8, R11, R17, R18, R25.
- `fixtures/204/positive/plus-emission-with-locale-folder.json` → R14, R19 with folder-pattern locales.
- `fixtures/204/positive/plus-emission-with-locale-field.json` → R14 with field-level translations.
- `fixtures/204/positive/plus-emission-with-component-mapping.json` → R10, R19 with `marketing:hero` + `marketing:pricing-table`.
- `fixtures/204/positive/richtext-walk.json` → R8 across `prose`, `code`, `callout`, list-coalescing, image markdown.
- `fixtures/204/positive/component-recursion-depth-3.json` → R9 (depth 3, no warning).
- `fixtures/204/positive/link-resolution-depth-1.json` → R11, R12.
- `fixtures/204/positive/link-cycle-tolerated.json` → R13 with `metadata.reference_cycles: 1`.
- `fixtures/204/positive/delta-incremental.json` → R15 with `cv` marker.
- `fixtures/204/positive/draft-mode.json` → R3 with `metadata.preview: true`.
- `fixtures/204/positive/concurrency-limited-to-6.json` → R17.
- `fixtures/204/positive/webhook-signature-valid.json` → R16 with valid HMAC.
- `fixtures/204/positive/idfield-fullslug-default.json` → R7 default.
- `fixtures/204/positive/summary-extracted-fallback.json` → R7 with `summary_source: "extracted"`.
- `fixtures/204/positive/empty-filter-allowed.json` → R5 with `allowEmpty: true`, no warning.

### Negative

- `fixtures/204/negative/init-missing-spaceid.expected.json` → R2 (missing required field).
- `fixtures/204/negative/init-auth-failed.expected.json` → R21; token redacted in error.
- `fixtures/204/negative/init-link-resolution-depth-exceeds-5.expected.json` → R12.
- `fixtures/204/negative/init-component-recursion-max-exceeds-4.expected.json` → R9.
- `fixtures/204/negative/empty-filter-default-warns.expected.json` → R5.
- `fixtures/204/negative/richtext-unmapped-node.expected.json` → R8 / R22.
- `fixtures/204/negative/component-recursion-bound-exceeded.expected.json` → R9 / R22 with partial node emitted.
- `fixtures/204/negative/rate-limit-exhausted.expected.json` → R20 / R22.
- `fixtures/204/negative/token-in-log.expected.json` → R23 violation detected.
- `fixtures/204/negative/token-in-envelope.expected.json` → R24 violation detected.
- `fixtures/204/negative/component-mapping-malformed.expected.json` → component reference missing required marketing-block fields → partial / placeholder.
- `fixtures/204/negative/version-pinning-stage-1-mismatch.expected.json` → R26 mismatch.
- `fixtures/204/negative/webhook-signature-invalid.expected.json` → R16 returns false; generator rejects.
- `fixtures/204/negative/locale-pattern-invalid.expected.json` → R14 grammar violation.

---

## Versioning & compatibility

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add an optional field to `StoryblokConfig` | MINOR | PRD-108-R4(1). |
| Add a new value to `region` enum (e.g., `"latam"`) | MAJOR | Closed enum per Storyblok API surface; PRD-108-R5(4). |
| Add a new richtext node-type recognition | MINOR | Walker rule; existing walks unaffected. |
| Add a new `componentMapping` target type within `marketing:*` | MINOR | PRD-102-R6 (open namespace). |
| Tighten `componentRecursionMax` cap from 4 to 3 | MAJOR | PRD-108-R5(6). |
| Loosen `componentRecursionMax` cap from 4 to 6 | MAJOR | Same. |
| Change default `version` from `"published"` to `"draft"` | MAJOR | PRD-108-R5(2). |
| Change `metadata.source.source_id` from Storyblok `uuid` to story `id` | MAJOR | Provenance grammar change; downstream tooling depends on uuid stability across slug changes. |
| Change delta-marker grammar from `cv` to a different field | MAJOR | PRD-108-R5(2). |
| Change webhook signature algorithm from HMAC-SHA256 | MAJOR | Security-relevant; per PRD-108-R5(2) and PRD-109. |
| Promote Stage 2 pinning opt-in for this adapter | MINOR | Per PRD-200-R26. |
| Editorial / prose clarification | n/a | Per `000-governance` R18. |

### Forward compatibility

A generator implementing PRD-204 v0.1 MUST tolerate unknown optional fields in `AdapterCapabilities` and unknown optional fields in adapter-emitted node `metadata`. The adapter MUST NOT emit fields outside its declared `level`'s permitted block types per PRD-200-R24.

### Backward compatibility

`act-storyblok@0.1.x` emits `act_version: "0.1"`; future MINOR bumps require coordinated release per PRD-200-R25. Adapter-config additions (R4(1) MINOR changes) preserve previous behavior under defaults.

---

## Security considerations

Cites PRD-109 for the project-wide threat model. Storyblok-specific deltas:

**Token handling (T2, T5).** Storyblok access tokens (preview vs public) are the most sensitive build-time secret. Operators SHOULD use the public token for `version: "published"` and the preview token for `version: "draft"`; mixing tokens is a configuration smell. PRD-204-R23 / R24 prohibit logging or emitting tokens. The adapter SHOULD log a fingerprint (first 4 chars) only when `config.debugLogging: true` is set explicitly.

**Webhook signature verification (T6 analog).** Storyblok webhooks ship an HMAC-SHA256 signature in the `webhook-signature` header. PRD-204-R16 requires the adapter to expose `verifyWebhookSignature(body, signature, secret)`; receivers (PRD-400) MUST validate before triggering rebuilds. An unauthenticated webhook receiver is a content-defacement vector — an attacker forces a rebuild with stale or hostile content. The adapter does not own the receiver (that's the generator's concern) but provides the verification primitive.

**Network fan-out and rate-limit awareness.** Storyblok's CDN tier rate limits are generous but bounded. PRD-204-R20 mandates retry with backoff; `concurrency_max: 6` is the default reflecting CDN-tier capacity. PRD-109 owns the project-wide DoS posture.

**Draft-mode leakage.** When `version: "draft"`, the adapter MUST stamp `metadata.preview: true` per PRD-204-R3. Consumers ingesting the envelope MUST treat preview content as non-public. The adapter cannot enforce consumer-side discipline; it can only signal.

**Component recursion as a complexity vector.** Hostile or buggy CMS content with deep component nesting can blow up walker memory. PRD-204-R9 caps recursion at depth 4; deeper structures fall back to partial extractions.

**Story-link cycles.** Tolerated per PRD-204-R13 / PRD-102-R20. The adapter detects cycles during resolution and stamps `metadata.reference_cycles`. Default `linkResolutionDepth: 1` is the primary control; PRD-204-R12 caps depth at 5.

**Asset URLs.** Storyblok serves assets at `https://a.storyblok.com/...`. Asset URLs in emitted markdown content reference a third-party origin from the consumer's perspective; consumers apply normal external-URL hygiene. The adapter SHOULD NOT emit raw asset URLs as `metadata.source.url`.

For all other concerns, cite PRD-109 directly.

---

## Implementation notes

### Snippet 1 — The adapter's `init` and capability declaration

```ts
// packages/storyblok-adapter/src/index.ts
import StoryblokClient from "storyblok-js-client";
import type { Adapter, AdapterCapabilities } from "@act/adapter-framework";
import type { StoryblokConfig, StoryblokStory } from "./types.js";

export const storyblokAdapter: Adapter<StoryblokConfig, StoryblokStory> = {
  name: "act-storyblok",

  async init(config, ctx): Promise<AdapterCapabilities> {
    validateConfig(config);  // PRD-204-R2
    if (config.linkResolutionDepth !== undefined && config.linkResolutionDepth > 5) {
      throw new AdapterError({ code: "config_invalid", message: "linkResolutionDepth must be 0–5" });
    }
    if (config.componentRecursionMax !== undefined && config.componentRecursionMax > 4) {
      throw new AdapterError({ code: "config_invalid", message: "componentRecursionMax must be 1–4" });
    }
    const client = new StoryblokClient({
      accessToken: config.accessToken,
      region: config.region ?? "eu",
      cache: { type: "memory" },
    });
    await verifyAuth(client, config.spaceId);  // throws on 401/403 → PRD-204-R21
    ctx.config._storyblokClient = client;
    const isPlus = !!config.componentMapping || !!config.locale;
    return {
      level: isPlus ? "plus" : "standard",
      concurrency_max: 6,
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
```

### Snippet 2 — Rich-text walk with TipTap-derived nodes (PRD-204-R8)

```ts
// packages/storyblok-adapter/src/richtext.ts
import type { ContentBlock, AdapterContext } from "@act/wire-format";
import type { StoryblokConfig, RichtextNode } from "./types.js";

export function walkRichtext(
  doc: { type: "doc"; content: RichtextNode[] },
  config: StoryblokConfig,
  ctx: AdapterContext,
  depth = 0,
): ContentBlock[] {
  const out: ContentBlock[] = [];
  let listBuffer: RichtextNode[] = [];
  for (const node of doc.content ?? []) {
    if (node.type === "bullet_list" || node.type === "ordered_list") {
      out.push(listToProse(node));
      continue;
    }
    if (node.type === "blok") {
      out.push(...walkBlok(node, config, ctx, depth));  // PRD-204-R9 / R10
      continue;
    }
    switch (node.type) {
      case "paragraph": out.push({ type: "prose", format: "markdown", text: serializeMarks(node) }); break;
      case "heading":   out.push({ type: "prose", format: "markdown", text: `${"#".repeat(node.attrs.level)} ${serializeMarks(node)}` }); break;
      case "code_block": out.push({ type: "code", language: codeBlockLanguage(node), text: node.content?.[0]?.text ?? "" }); break;
      case "blockquote": out.push({ type: "callout", level: "info", text: serializeMarks(node) }); break;
      case "horizontal_rule": out.push({ type: "prose", format: "markdown", text: "---" }); break;
      case "image":      out.push({ type: "prose", format: "markdown", text: `![${node.attrs.alt ?? ""}](${node.attrs.src})` }); break;
      default:
        ctx.logger.warn("storyblok richtext: unmapped node", { type: node.type });
        out.push({ type: "prose", format: "markdown", text: `(unsupported rich-text node: ${node.type})` });
    }
  }
  return out;
}
```

### Snippet 3 — Component-block walk with recursion bound (PRD-204-R9, R10)

```ts
function walkBlok(
  node: { type: "blok"; attrs: { body: { component: string; [field: string]: unknown }[] } },
  config: StoryblokConfig,
  ctx: AdapterContext,
  depth: number,
): ContentBlock[] {
  const max = config.componentRecursionMax ?? 4;
  if (depth >= max) {
    const componentNames = node.attrs.body.map((b) => b.component).join(", ");
    ctx.logger.warn("component recursion bound exceeded", { depth, components: componentNames });
    return [{ type: "prose", format: "markdown", text: `(component recursion bound exceeded at depth ${depth}: ${componentNames})` }];
  }
  const out: ContentBlock[] = [];
  for (const blok of node.attrs.body) {
    const mapping = config.componentMapping?.[blok.component];
    if (mapping) {
      out.push(emitMarketingBlock(blok, mapping));  // PRD-204-R10
    } else {
      ctx.logger.warn("storyblok blok: no component mapping", { component: blok.component });
      // partial-extraction fallback per PRD-204-R8 / R22
      out.push({ type: "prose", format: "markdown", text: `(unmapped component: ${blok.component})` });
    }
  }
  return out;
}
```

### Snippet 4 — Webhook signature verification (PRD-204-R16)

```ts
// packages/storyblok-adapter/src/webhook.ts
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

The `timingSafeEqual` call defends against timing side-channels per PRD-109.

### Snippet 5 — Failure-emission shape (PRD-204-R22)

```ts
function assemblePartialNode(args: {
  story: StoryblokStory;
  error: unknown;
  config: StoryblokConfig;
  ctx: AdapterContext;
}): EmittedNode {
  return {
    act_version: args.ctx.config.actVersion as string,
    id:    resolveId(args.story, args.config),
    type:  args.config.typeMapping?.[args.story.content?.component] ?? args.story.content?.component ?? "page",
    title: args.story.name ?? "(untitled)",
    summary: args.story.content?.summary ?? "Content could not be extracted.",
    content: [],
    tokens:  { summary: 8, body: 0 },
    etag:    "",
    metadata: {
      extraction_status: "partial",
      extraction_error:  String(args.error).slice(0, 200),  // bounded; no PII per PRD-109-R14
    },
  };
}
```

### Snippet 6 — Token-redacted logging (PRD-204-R23)

```ts
function logSafeConfig(config: StoryblokConfig, logger: AdapterContext["logger"]) {
  logger.debug("storyblok adapter config", {
    spaceId:     config.spaceId,
    region:      config.region ?? "eu",
    accessToken: config.accessToken ? `${config.accessToken.slice(0, 4)}…` : "missing",
    version:     config.version ?? "published",
    storyFilter: config.storyFilter,
  });
}
```

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft. Implements the parent PRD-200 contract for Storyblok Content Delivery API + Stories. Configuration (space / token / region / version / storyFilter / componentMapping / locale); rich-text walk to `prose` / `markdown` / `code` / `callout` (Standard); component blocks → `marketing:*` (Plus); story-link resolution with default depth 1 and cycle tolerance per PRD-102-R20; component-recursion bound at depth 4; locale handling cooperating with PRD-207 via merge for both folder-pattern and field-pattern translations; incremental rebuild via Storyblok `cv` marker; webhook signature verification primitive (HMAC-SHA256) exposed for generator-side receivers; failure modes — rate limit (recoverable / partial), auth failure (unrecoverable / fail in init), partial extraction (per-item warning). Conformance: Standard by default; Plus when `componentMapping` OR `locale` is configured. Token never logged or emitted into envelopes per PRD-109. Status: In review. |
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review; minor normative clarification on block-level UID placement. Decisions: (1) Storyblok datasources skipped in v0.1; (2) Storyblok component `_uid` is normalized to block-level `metadata.block_uid` (NOT `metadata.source.block_uid` — `metadata.source.*` is reserved by PRD-200 for framework provenance); (3) HMAC signature verification helper is in scope (PRD-204-R16). |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
