# PRD-202 — Contentful adapter

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

Contentful is the canonical headless CMS for Plus-tier marketing-and-docs sites — the corporate marketing example in the v0.1 draft (§6.5, ultimately PRD-702) is Next.js + Contentful + `next-intl`, and PRD-200's design contemplates this composition explicitly. PRD-200 (in review) pins the adapter contract; PRD-100 / PRD-102 (Accepted) pin the envelopes and the block taxonomy; PRD-104 (Accepted) pins the per-locale wire shape. What's missing is the concrete CMS adapter that consumes Contentful's Content Delivery API (CDA) and emits PRD-100 envelopes — config shape (space ID, environment, delivery token, content-type-to-ACT-type mapping), CDA query construction with linked-entry depth control, Contentful Rich Text → PRD-102 block conversion, asset reference handling, locale fan-out for Plus deployments per PRD-104, sync-API-driven incremental rebuilds, and the failure surface (rate-limit backoff vs auth failure vs content-type mismatch).

Until this PRD lands, PRD-702 cannot define its build pipeline, design partners evaluating ACT against a CMS-backed site cannot assess fit, and the `marketing:*` block emission path that gives Plus its narrative weight has no end-to-end CMS demonstration.

### Goals

1. Lock the **adapter config shape**: space ID, environment, CDA token, content types to include, content-type → ACT-type field-mapping, link-resolution depth, locale set.
2. Lock the **CDA query construction**: which entries are fetched, with what `include` depth, how content types are filtered, how locales are fanned out.
3. Lock the **field-mapping DSL**: how a Contentful content type's fields populate ACT node fields. Defaults per common Contentful patterns (a `blogPost` content type with `title`/`slug`/`excerpt`/`body`/`heroImage` maps cleanly without per-site configuration).
4. Lock the **Rich Text → block conversion**: Contentful's Rich Text JSON AST node types map to PRD-102 block types. Embedded entries / assets become `marketing:*` placeholders that the configured field-mapping can promote to typed blocks (`marketing:hero`, `marketing:cta`).
5. Lock the **asset handling**: Contentful assets referenced from Rich Text or fields are emitted as block-level references (URL + content-type + alt text), not inlined.
6. Lock the **localization model**: when the Contentful environment advertises locales and the config requests multiple, the adapter emits one node per (entry, locale) pair following PRD-104 (Pattern 1 with locale-prefixed IDs by default; Pattern 2 via per-locale config).
7. Lock the **incremental rebuild path**: sync-API-driven `delta(since)` per PRD-200-R9, where the marker is the Contentful sync token.
8. Lock the **failure surface**: 401 → unrecoverable per PRD-200-R18; 429 → exponential backoff with bounded retries, then unrecoverable; per-entry transform error → recoverable partial node per PRD-200-R16; content-type mismatch (a configured field path missing on an entry) → recoverable warning.
9. Specify the **conformance bands the adapter advertises**: Standard by default (emits `abstract` from a configured field, `related` from references); Plus when locales are configured AND `marketing:*` mappings are configured.
10. Enumerate the **test fixture matrix** under `fixtures/202/positive/` and `fixtures/202/negative/`.

### Non-goals

1. **Defining the adapter framework contract.** Owned by PRD-200. PRD-202 implements PRD-200 against Contentful's CDA.
2. **Defining the wire format.** Owned by PRD-100 / PRD-102. The adapter emits PRD-100 envelopes.
3. **Defining the i18n wire shape.** Owned by PRD-104. PRD-202 emits per-locale nodes; cross-locale references via `metadata.translations` per PRD-104-R9.
4. **Defining the i18n translation source.** Owned by PRD-207. When PRD-207 is composed in the same build (corporate marketing example), PRD-207 contributes message-catalog translations via the multi-source merge step (PRD-200-R12); PRD-202 emits CMS-sourced content per locale that Contentful itself stores.
5. **Defining a CMS schema mapping DSL across CMS adapters.** Per gap E6, a unified DSL is deferred to v0.2. PRD-202's mapping shape is bespoke; PRD-203/204/205/206 will define their own and converge later.
6. **Defining the Contentful Management API surface.** PRD-202 is read-only; it consumes the CDA only. Producers MUST NOT use the management token.
7. **Defining a Contentful preview-API mode.** Preview mode (draft content) is an open question (see Open questions); the canonical flow is the published-content CDA.

### Stakeholders / audience

- **Authors of:** PRD-405 (Next.js plugin) — the canonical Contentful pairing. Other generators (PRD-401 Astro, PRD-407 Nuxt) MAY also compose this adapter.
- **Consumers of:** PRD-702 (corporate marketing example) — the canonical end-to-end Plus deployment.
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Contentful's Rich Text AST changes shape across SDK versions, breaking the adapter's block conversion. | Medium | Medium | The adapter pins a CDA SDK version range in `peerDependencies`. Rich-text node-type-to-block mapping is a single function (Snippet 5) so a new node type is one bug fix. |
| The default field-mapping is too opinionated and no real Contentful site fits without configuration. | Medium | Medium | Defaults are documented; users SHOULD provide an explicit `mappings` config for non-default content types. The adapter ships sensible heuristics (any field named `title` populates `title`; any field named `excerpt` or `summary` populates `summary`) that cover the common cases. |
| Linked-entry resolution at depth >1 hits CDA's 1000-link limit on a single response. | Medium | Medium | Default depth is 1; users opting into deeper resolution MUST configure the bound and accept the partition cost. Adapter MUST split queries when depth × estimated-entry count exceeds the CDA's `include` cap. |
| Per-locale fan-out multiplies CDA requests by the locale count, exhausting rate limits on large catalogs. | High | Medium | Adapter declares `concurrency_max: 4` to the framework; respects 429 with exponential backoff; `delta(since)` via sync API reduces fan-out for incremental rebuilds. |
| Content authors set `metadata.*` reserved keys on entries (e.g., a content type with a `locale` field) and the adapter's mapping would clobber framework metadata. | Medium | Medium | PRD-202-R8 forbids field-mappings that target reserved metadata keys (same set as PRD-201-R6); attempted reserved mappings are unrecoverable per PRD-200-R18 at `init`. |
| 429 retry storm if multiple Contentful adapters run concurrently against the same space. | Low | Medium | Default `concurrency_max: 4` is per-adapter; operators running multiple instances against one space SHOULD coordinate via shared rate-limit state (out of scope for v0.1; documented as a known limitation). |
| Asset URLs change when Contentful rotates its asset CDN, invalidating cached links across the ACT corpus. | Low | Low | Asset references are emitted as URLs; consumers MUST treat URLs as opaque and re-fetch via the manifest's `node_url_template` for canonical content. The asset-URL change is a CDA concern, not an ACT concern. |

### Open questions

1. ~~Should the adapter support Contentful's preview API alongside the CDA?~~ **Resolved (2026-05-01): No for v0.1.** Canonical flow is published content; users needing preview can fall back to PRD-208 (programmatic). Adding preview mode in v0.2 is MINOR per PRD-108-R4(1) (additive optional config field). (Closes Open Question 1.)
2. ~~Should the field-mapping DSL support transforms (e.g., `summary: { from: "excerpt", transform: "truncate(50)" }`)?~~ **Resolved (2026-05-01): No for v0.1.** Mapping stays declarative; transforms expand the DSL surface and invite a sandbox question. Operators needing transforms can use PRD-208. Reconsider in v0.2 once user friction is observed. (Closes Open Question 2.)
3. ~~Should the adapter resolve linked entries that are themselves outside the configured `contentTypes` whitelist?~~ **Resolved (2026-05-01): Yes, by default, with opt-out.** Linked-entry resolution is the realistic CMS expectation; opt-out via `resolveLinks.scope: "whitelist-only"` covers the strict case. (Closes Open Question 3.)
4. ~~Should the adapter expose a `taxonomies` mapping for Contentful's Tags API (separate from the legacy `tags` field on entries)?~~ **Resolved (2026-05-01): Defer to v0.2.** Tags API is recent and adoption is low; adding it later is MINOR per PRD-108-R4(1). (Closes Open Question 4.)
5. ~~Should the localization model default to Pattern 1 (locale-prefixed IDs) or Pattern 2 (per-locale manifests)?~~ **Resolved (2026-05-01): Pattern 1 is the default.** Composes cleaner with single-pipeline generators (PRD-405). Operators needing Pattern 2 set `locale.pattern: 2` in config; the adapter then declares `manifestCapabilities.manifest_url_template: true`. (Closes Open Question 5.)

### Acceptance criteria

- [ ] Every normative requirement has an ID `PRD-202-R{n}` and a declared conformance level per PRD-107.
- [ ] The Specification section opens with a table mapping every requirement to PRD-200 / PRD-100 / PRD-102 / PRD-104 requirements implemented.
- [ ] The TypeScript adapter shape is reproduced inline in §"Wire format / interface definition."
- [ ] CDA query construction is pinned with one positive fixture per major path (single-content-type, multi-content-type, with-locales, with-include-depth).
- [ ] Field-mapping DSL is pinned with the default heuristics enumerated and a fixture showing user-supplied overrides.
- [ ] Rich Text → block conversion is pinned with one fixture per Rich Text top-level node type.
- [ ] Locale fan-out is pinned with a fixture covering Pattern 1 and one covering Pattern 2.
- [ ] Failure surface is pinned with explicit mapping to PRD-200-R16 (recoverable) vs PRD-200-R18 (unrecoverable) — 401, 403 (forbidden but enumerable), 404 (entry deleted between query and per-entry fetch), 429, 5xx.
- [ ] Implementation notes ship 5–8 TS snippets covering: adapter skeleton, init with credential redaction, CDA query construction, Rich Text → blocks, locale fan-out, sync-token-based delta, failure mapping.
- [ ] Test fixture path layout under `fixtures/202/` is enumerated.
- [ ] Versioning & compatibility section classifies every kind of change to PRD-202 per PRD-108.
- [ ] Security section cites PRD-109 and documents adapter-specific deltas (CDA token redaction, asset-URL trust, linked-entry recursion bounds).
- [ ] Changelog entry dated 2026-05-01 by Jeremy Forsythe is present.

---

## Context & dependencies

### Depends on

- **PRD-100** (Accepted) — wire format envelopes.
- **PRD-102** (Accepted) — content blocks.
- **PRD-104** (Accepted) — i18n wire shape; PRD-202 emits per-locale nodes per Pattern 1 by default.
- **PRD-107** (Accepted) — conformance levels.
- **PRD-108** (Accepted) — versioning policy; Stage 1 pinning per PRD-200-R25.
- **PRD-109** (Accepted) — security; cited for token redaction, network egress posture, linked-entry recursion guards.
- **PRD-200** (In review) — adapter framework. Default export of `act-contentful` MUST satisfy `Adapter`.
- **000-decisions-needed Q3** — TS-only first-party reference impl for v0.1.
- External: [Contentful Content Delivery API](https://www.contentful.com/developers/docs/references/content-delivery-api/), [Contentful Rich Text](https://www.contentful.com/developers/docs/concepts/rich-text/), [Contentful Sync API](https://www.contentful.com/developers/docs/references/content-delivery-api/#/reference/synchronization), [`contentful` JS SDK](https://github.com/contentful/contentful.js) (peer dependency, version range pinned in `package.json`), [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [BCP 47](https://www.rfc-editor.org/info/bcp47).

### Blocks

- **PRD-405** (Next.js plugin) — the primary generator pairing for Contentful sites.
- **PRD-702** (corporate marketing example) — depends on this adapter directly.

### References

- v0.1 draft: §5.10 (adapter pipeline), §6.4 (ID strategies — `cms_id`, `composite`), §6.5 (corporate marketing worked example), §10 Q5 (extraction failure mapping), §10 Q7 (CMS schema-mapping DSL — gap E6, deferred to v0.2).
- `prd/000-gaps-and-resolutions.md` gaps **B1** (lifecycle, owned by PRD-200), **B2** (multi-source merging, primarily relevant when composed with PRD-207), **B3** (ID composition, `cms/<entry-id>` namespacing), **A4** (failure modes), **E6** (CMS DSL deferred — documented as a known divergence).
- Prior art: [Contentlayer's Contentful source](https://contentlayer.dev/docs/sources/contentful) (declarative content-type registration), [Gatsby's `gatsby-source-contentful`](https://www.gatsbyjs.com/plugins/gatsby-source-contentful/) (graphql-driven, deeper integration), [Astro's Contentful loader](https://docs.astro.build/en/guides/cms/contentful/) (lightweight CDA wrapper).

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords as clarified by RFC 8174.

### Parent + 100-series requirements implemented

| PRD-202 requirement | Parent / 100-series requirement(s) | Relationship |
|---|---|---|
| R1 (adapter implements PRD-200 contract) | PRD-200-R1, R2 | Default export satisfies `Adapter`. |
| R2 (config schema) | PRD-200-R20 | Adapter publishes JSON Schema for config. |
| R3 (`init` validates credentials) | PRD-200-R3, PRD-200-R18 | Auth failure unrecoverable from `init`. |
| R4 (`precheck` fast credential probe) | PRD-200-R8 | Optional 1s budget probe. |
| R5 (CDA query construction) | — | Adapter-internal. |
| R6 (linked-entry depth) | — | Adapter-internal config bound. |
| R7 (default field heuristics) | PRD-100-R21 | Heuristic mapping populates required envelope fields. |
| R8 (user-supplied `mappings`) | PRD-100-R21, PRD-100-R22, PRD-102 | Authoritative when present. Reserved metadata keys forbidden. |
| R9 (content-type → ACT type) | PRD-100-R21 | Closed-default mapping; per-CT override via config. |
| R10 (Rich Text → block conversion) | PRD-102-R1, R2, R3, R5, R6, R7, R10, R11 | Rich Text AST → ACT block taxonomy. |
| R11 (asset reference) | PRD-102 (block metadata, image asset spec) | Assets emitted as references with URL + content-type + alt. |
| R12 (locale fan-out — Pattern 1 default) | PRD-104-R5, R7 | Locale-prefixed IDs by default. |
| R13 (locale fan-out — Pattern 2 opt-in) | PRD-104-R6 | Per-locale manifest URL template advertised. |
| R14 (cross-locale `metadata.translations`) | PRD-104-R9 | Adapter populates the dense form. |
| R15 (entry → ACT ID strategy) | PRD-100-R10, PRD-100-R14, PRD-200-R10 | Default `cms/<entry-id>`; configurable to slug-based. |
| R16 (incremental via sync token) | PRD-200-R9 | `delta(since)` consumes Contentful sync token. |
| R17 (concurrency / rate-limit handling) | PRD-200-R6, PRD-200-R22 | `concurrency_max: 4` default; 429 with backoff. |
| R18 (recoverable failures) | PRD-200-R16, R17 | Per-entry mismatch, asset 404, partial linked resolution. |
| R19 (unrecoverable failures) | PRD-200-R18 | 401, exhausted retries on 429, malformed config, sustained 5xx. |
| R20 (provenance metadata) | PRD-200-R13 | `metadata.source.adapter: "act-contentful"`, `source_id: "<space>/<env>/<entry-id>"`. |
| R21 (level declaration) | PRD-200-R22, PRD-200-R24, PRD-107-R8, R10 | Standard by default; Plus when locales + `marketing:*` mappings. |
| R22 (manifest capabilities bubble-up) | PRD-200-R23, PRD-100-R6 | Adapter declares `etag: true`, `subtree: true`, `i18n: true` (when locales configured). |
| R23 (Stage-1 version pinning) | PRD-200-R25, PRD-108-R14 | `act-contentful@0.1.x` emits `act_version: "0.1"`. |
| R24 (test-fixture conformance) | PRD-200-R28 | Pass framework fixtures + PRD-202 fixtures. |
| R25 (CMS DSL divergence flag) | — | Documented per gap E6. |

### Conformance level

- **Core:** Not declared by this adapter — Contentful integrations always emit at least `abstract` (Standard) and frequently `related` cross-references.
- **Standard:** PRD-202-R1, R2, R3, R5, R7, R8, R9, R10 (where Rich Text maps only to Core/Standard blocks), R11, R15, R17, R18, R19, R20, R22 (Standard subset), R23, R24, R25.
- **Plus:** PRD-202-R4 (precheck is a Standard feature in PRD-200; cited here for completeness), R6 (deeper linked-entry resolution is a Plus feature when it enables `marketing:*` block emission), R10 (Plus subset — Rich Text mapping to `marketing:*` blocks via `mappings`), R12, R13, R14 (locale fan-out is Plus per PRD-104), R21 (Plus declaration), R22 (Plus subset).

A producer's declared `targetLevel` (PRD-200-R19) determines which subset applies.

### Normative requirements

#### Adapter shape and configuration

**PRD-202-R1.** *(Standard)* The default export of the `act-contentful` package MUST satisfy the `Adapter` interface from PRD-200-R1. The adapter's `name` property MUST be the string `"act-contentful"`. The adapter MUST implement `init`, `enumerate`, `transform`, and `dispose`; it SHOULD implement `precheck` (PRD-202-R4) and MAY implement `delta` (PRD-202-R16).

**PRD-202-R2.** *(Standard)* The adapter's config MUST satisfy the schema published at `packages/act-contentful/schema/config.schema.json`. The schema MUST define at least:

- `spaceId` (string, REQUIRED) — Contentful space identifier.
- `environment` (string, OPTIONAL; default `"master"`) — Contentful environment.
- `accessToken` (string, REQUIRED) — Content Delivery API token. The adapter MUST treat this as a secret per PRD-202-R26 / PRD-109.
- `contentTypes` (array of strings, REQUIRED) — content type IDs to include. Empty array is invalid.
- `mappings` (object, OPTIONAL) — per-content-type field-mapping override (PRD-202-R8).
- `defaults` (object, OPTIONAL) — per-content-type ACT-type defaults (`{ blogPost: "article", landingPage: "page" }`).
- `resolveLinks` (object, OPTIONAL) — link-resolution config: `depth` (integer, 0–4, default 1), `scope` (`"all" | "whitelist-only"`, default `"all"`).
- `locale` (object, OPTIONAL) — locale config: `available` (array of BCP-47 strings; defaults to the space's advertised locales), `default` (BCP-47 string; defaults to the space's default), `pattern` (`1 | 2`, default `1` — see PRD-202-R12 / R13).
- `host` (string, OPTIONAL; default `"cdn.contentful.com"`) — CDA host. `preview.contentful.com` is permitted but emits a build warning.
- `idStrategy` (object, OPTIONAL) — ID derivation: `from` (`"id" | "slug" | "composite"`, default `"id"`), `field` (string, used when `from === "slug"`; default `"slug"`), `namespace` (string, default `"cms"`).

**PRD-202-R3.** *(Standard)* `init(config, ctx)` MUST validate the config against the published schema. On schema failure, `init` MUST throw with `code: "config_invalid"` per PRD-200-R18. After schema validation, `init` MUST verify the `accessToken` by issuing a single CDA request to `/spaces/<spaceId>/environments/<environment>` (the cheapest authenticated probe). HTTP 401 → unrecoverable per PRD-202-R19; HTTP 200 → continue. The adapter MUST NOT proceed to `enumerate` if the auth probe fails.

**PRD-202-R4.** *(Standard)* The adapter SHOULD implement `precheck(config)` per PRD-200-R8. The precheck MUST:

- Validate the config shape (re-using the schema).
- Issue a single HEAD request (or equivalent low-cost probe) against the CDA root.
- Complete in ≤1s on a healthy network.
- Throw on auth failure or sustained connection failure.

`precheck` MUST NOT open long-lived connections, allocate caches, or fan out across content types.

#### Enumerate and CDA query construction

**PRD-202-R5.** *(Standard)* `enumerate()` MUST yield candidate entries by querying the CDA for each entry of each `contentTypes` value, paginating with `skip` / `limit` until the response's `total` is exhausted. Default `limit` per page is 100 (CDA's max is 1000; the lower default reduces 5xx surface and improves backpressure). Yield order MUST be deterministic per content type (sorted by `sys.id`); the adapter MUST NOT depend on Contentful's default ordering. When multiple content types are configured, all entries of one content type yield before the next type starts.

**PRD-202-R6.** *(Standard / Plus)* The CDA query MUST set the `include` parameter to the configured `resolveLinks.depth` value (default 1, max 4). When `resolveLinks.scope: "whitelist-only"`, the adapter MUST drop linked-entry resolution for entries whose content type is not in `contentTypes`; their fields are emitted as bare ID references (`{ id: "<linked-id>", type: "<linked-type>" }` on the appropriate ACT field) instead of the full payload. When `scope: "all"` (default), all linked entries are resolved up to `depth`, regardless of whitelist membership.

#### Field mapping

**PRD-202-R7.** *(Standard)* When `mappings` is absent for a given content type, the adapter MUST apply the following default heuristics, in order:

- `title` ← first present of: `title`, `name`, `headline`. If none present, the entry is recoverable-failed per PRD-202-R18 with `extraction_status: "partial"` and a `extraction_error` citing the missing field; a fallback title of `"Untitled <content-type-id> <sys.id>"` is emitted.
- `summary` ← first present of: `summary`, `excerpt`, `description`, `subhead`. If none present, the adapter extracts the first prose paragraph from the body (per PRD-201-R18 reused). `summary_source` is stamped `"author"` if a frontmatter field was found, `"extracted"` otherwise.
- `abstract` ← first present of: `abstract`, `intro`, `lede`. Optional; absence is silent.
- `body` (the content array) ← Rich Text fields are converted per PRD-202-R10; long-text fields are emitted as `prose` (PRD-102-R2) or `markdown` (PRD-102-R1) depending on whether a `format: "markdown"` heuristic applies (a long-text field whose value contains `\n#`-style markdown headings or fenced code triggers `markdown` mode).
- `tags` ← Contentful's per-entry `metadata.tags` array of `{ sys: { id, type } }`, flattened to an array of tag IDs.
- `related` ← Reference fields (single or array reference) that link to other in-corpus entries: emitted as `{ id, relation }` per PRD-102-R18 with default `relation: "see-also"`.

**PRD-202-R8.** *(Standard / Plus)* When `mappings.<contentTypeId>` is supplied, it MUST be an object with at least the following shape:

```ts
{
  type?: string;                          // ACT node `type`; default per `defaults` config or "article"
  title?: string;                          // Contentful field name → ACT title
  summary?: string | { from: string; source?: "author" | "extracted" };
  abstract?: string;
  body?: string | string[];                // Field(s) to convert into `content[]` blocks
  tags?: string;                           // Field whose value is an array of strings
  parent?: string;                         // Reference field → ACT parent
  related?: Array<{ from: string; relation?: string }>;
  blocks?: Array<{                         // Plus-tier: emit specific marketing:* blocks from named fields
    when: { field: string; equals?: unknown; ofType?: string };
    type: string;                          // e.g. "marketing:hero", "marketing:cta"
    fields: Record<string, string>;        // ACT block-field name → Contentful field name
  }>;
  metadata?: Record<string, string>;       // Contentful field name → metadata key
}
```

The `mappings.<contentTypeId>.metadata` field MUST NOT target reserved metadata keys (the same set as PRD-201-R6: `source`, `extraction_status`, `extraction_error`, `extracted_via`, `locale`, `translations`, `translation_status`, `fallback_from`, `variant`, `contributors`). A configuration violating this MUST be unrecoverable from `init` per PRD-200-R18.

**PRD-202-R9.** *(Standard)* The ACT node `type` is determined by:

1. `mappings.<contentTypeId>.type` (highest precedence).
2. `defaults.<contentTypeId>` from config.
3. `"article"` (lowest precedence; Contentful default).

The adapter MUST emit a `type` value satisfying PRD-100-R21.

#### Rich Text conversion

**PRD-202-R10.** *(Standard / Plus)* Contentful's Rich Text JSON AST MUST be converted to PRD-102 content blocks per the following table. Top-level Rich Text node types map to ACT blocks in source order; nested formatting (bold, italic, links) is preserved within `prose` and `markdown` blocks.

| Rich Text node type | ACT block | PRD-102 reference |
|---|---|---|
| `paragraph` | `prose` (with `format: "markdown"` if any nested mark or link present; else plain `format: "plain"`) | PRD-102-R2 |
| `heading-{1..6}` | `prose` with leading `#` markers in `text` and `format: "markdown"` | PRD-102-R2 |
| `unordered-list`, `ordered-list` | `prose` with markdown list syntax in `text` and `format: "markdown"` | PRD-102-R2 |
| `blockquote` | `prose` with markdown `>` quoting; `format: "markdown"` | PRD-102-R2 |
| `hr` | `prose` with `text: "---"` and `format: "markdown"` | PRD-102-R2 |
| `embedded-asset-block` | block with `type` per asset MIME (image: `marketing:image` if Plus; else asset reference inline in `prose` as a markdown image link) | PRD-202-R11 |
| `embedded-entry-block` | If the embedded entry's content type matches a `mappings.<...>.blocks[*].when` rule → emit the configured block. Else → `marketing:placeholder` (Plus) or skip with a warning (Standard). | PRD-202-R11, PRD-102-R22 |
| `embedded-entry-inline` | Inline reference text inside surrounding `prose`; the entry ID is preserved as a markdown link target. | PRD-102-R2 |
| `hyperlink`, `entry-hyperlink`, `asset-hyperlink` | Markdown link inside the surrounding `prose`. | PRD-102-R2 |
| Code blocks (Contentful 2024+ Rich Text extension) | `code` block per PRD-102-R3 | PRD-102-R3 |
| Tables (Contentful 2024+ Rich Text extension) | `prose` with markdown table syntax; `format: "markdown"` | PRD-102-R2 |

Adapters MAY skip empty paragraphs (whitespace-only text). Adapters MUST preserve block order matching the Rich Text source (PRD-102-R24).

**PRD-202-R11.** *(Standard / Plus)* Embedded assets and embedded entries are handled as follows:

- An embedded asset whose MIME type is `image/*` and whose target level is Plus emits a `marketing:image` block (a documented-open `marketing:*` block per PRD-102-R6 / PRD-100-R30; the canonical shape is `{ type: "marketing:image", url, alt, width?, height? }`). At Standard, the asset is inlined as a markdown image link (`![alt](url)`) inside the surrounding `prose` block instead.
- An embedded asset whose MIME type is non-image is emitted as a `marketing:asset` block at Plus (`{ type: "marketing:asset", url, content_type, filename, size? }`) or skipped at Standard with a build warning.
- An embedded entry that matches a `mappings.<...>.blocks` rule is emitted as the configured block type with fields populated from the configured `fields` map. Adapters MUST validate that REQUIRED fields per the block's PRD-102 schema are present; missing required fields fall back to `marketing:placeholder` per PRD-102-R22.
- An embedded entry that does NOT match any rule is emitted as a `marketing:placeholder` block at Plus (per PRD-102-R22 with `metadata.extracted_via: "component-contract"` and `metadata.extraction_status: "partial"`) or skipped with a warning at Standard.

#### Localization

**PRD-202-R12.** *(Plus)* When `locale` config requests >1 locale (or the space advertises >1 locale and `locale.available` is unset), the adapter operates in Pattern 1 by default (per PRD-104-R5). Concretely:

- The adapter fans out one node per (entry, locale) pair.
- Each emitted node's `id` is `<idStrategy.namespace>/<locale-lower>/<entry-derived-id>` (e.g., `cms/en-us/products/widget-pro`). The locale segment matches the BCP-47 subset regex from PRD-104-R2 with hyphens lowercased.
- Each node carries `metadata.locale` set to the BCP-47 locale (e.g., `"en-US"`).
- The CDA query MUST issue per-locale requests (Contentful's `?locale=<locale>` parameter); the adapter MUST NOT use Contentful's `*` wildcard locale because per-locale ETag derivation depends on per-locale field values.

**PRD-202-R13.** *(Plus)* When `locale.pattern: 2` is set, the adapter operates in Pattern 2 (per PRD-104-R6):

- One adapter run emits N parallel sub-corpora (one per locale), each with locale-bare IDs.
- The adapter declares `manifestCapabilities.manifest_url_template: true` to the framework so the generator advertises `locales.manifest_url_template` per PRD-104-R4.
- Generator-side composition (PRD-400 / PRD-405) combines per-locale outputs into per-locale manifests; the framework merge step (PRD-200-R12) does NOT deduplicate across locale boundaries because IDs are bare.

**PRD-202-R14.** *(Plus)* For every emitted node, when the underlying entry is translated into other configured locales, the adapter MUST populate `metadata.translations` per PRD-104-R9 with the dense `[{ locale, id }]` form listing every other locale's emitted node. When an entry is missing a locale (untranslated), the adapter MUST emit `metadata.translation_status: "fallback"` AND `metadata.fallback_from: <locale>` per PRD-104-R10 / R11, and substitute default-locale field values into the affected fields.

#### IDs

**PRD-202-R15.** *(Standard)* The default ID-derivation is:

- `idStrategy.from: "id"` (default) — `<idStrategy.namespace>/<sys.id-lowercased>`. Example: `cms/3xkpqd0lf2y8ujivn7qmre`.
- `idStrategy.from: "slug"` — `<idStrategy.namespace>/<entry.fields[<idStrategy.field>]-normalized>`. The slug field's value is normalized per the same algorithm as PRD-201-R8 step 4 (lowercase, replace non-grammar chars with `-`, collapse runs).
- `idStrategy.from: "composite"` — `<idStrategy.namespace>/<contentTypeId>/<sys.id-lowercased>` for namespace-by-type stability.

In all cases the resulting ID MUST satisfy PRD-100-R10 after normalization. A frontmatter-equivalent override (`fields[idStrategy.overrideField]`, default field name `actId`) wins over the strategy per PRD-100-R14 / PRD-200-R11. When the entry's chosen field is missing, the adapter falls back to `from: "id"` with a build warning.

#### Incremental rebuilds

**PRD-202-R16.** *(Standard)* The adapter MAY implement `delta(since)` per PRD-200-R9 backed by Contentful's Sync API:

- The `since` marker is the Contentful `nextSyncToken` from the previous run.
- `delta(since)` calls `/spaces/<spaceId>/environments/<environment>/sync?sync_token=<since>` and yields entries whose `sys.type` is `"Entry"` (not `"DeletedEntry"` — deletions are signaled by yielding `null` from `transform` per PRD-200-R5 with a `metadata.tombstone: true` marker in a partial node, OR by the generator handling deletion via PRD-400's deletion path).
- The adapter declares `capabilities.delta: true` from `init` only when `init` successfully obtains an initial sync token (a one-time `?initial=true&type=Entry` call performed during the first run).

If the adapter encounters a sync error (token expired, sync replayable from beginning required), `delta` MUST fall back to a full enumerate and emit a build warning citing the rebase.

#### Concurrency and rate limiting

**PRD-202-R17.** *(Standard)* The adapter declares `concurrency_max: 4` by default in its `AdapterCapabilities` (PRD-200-R22). A user MAY raise via `concurrency.transform` config (max 16; CDA's per-second rate limits make higher values self-defeating). The adapter MUST honor 429 responses with exponential backoff:

- Initial backoff 1 second; double each retry; cap at 32 seconds.
- Maximum 6 retries per request.
- Honor `X-Contentful-RateLimit-Reset` / `Retry-After` when present (overrides the exponential schedule).
- After 6 retries, the request fails unrecoverable per PRD-202-R19.

The adapter MUST NOT log full token values during retry; remediation hints in error messages MUST cite environment variables, not the token.

#### Failure modes

**PRD-202-R18.** *(Standard)* Recoverable failures map per PRD-200-R16 / R17 to partial nodes:

| Condition | Status | Behavior |
|---|---|---|
| Entry missing a configured field path (not in PRD-202-R7 heuristics, not in `mappings`) | `"partial"` | Emit node with the field absent; populate `metadata.extraction_error` citing the missing path. |
| Linked entry returns 404 mid-resolution (entry deleted between query and link follow) | `"partial"` | Emit node with the link as a bare-ID reference; populate `metadata.extraction_error`. |
| Linked entry resolution exceeds `resolveLinks.depth` (truncated) | `"partial"` | Emit node with the truncated linked-entry as a bare reference; populate `metadata.extraction_error: "linked-entry depth truncated at N"`. |
| Asset URL returns 404 during enrichment | `"partial"` | Emit asset block with `url` set but a `metadata.asset_status: "missing"`; populate `metadata.extraction_error`. |
| Rich Text contains an unknown node type the adapter doesn't recognize | `"partial"` | Emit a `prose` block with the source-equivalent markdown if extractable, else a `marketing:placeholder` (at Plus) or skip with warning (at Standard). |
| Per-locale variant missing for a configured locale | `"fallback"` per PRD-104-R10 | Substitute default-locale content with `metadata.translation_status: "fallback"`. |

**PRD-202-R19.** *(Standard)* Unrecoverable failures map per PRD-200-R18:

| Condition | Behavior |
|---|---|
| Config schema validation failure | Throw from `init` with `code: "config_invalid"`. |
| `accessToken` rejected (HTTP 401) at probe | Throw from `init` with `code: "auth_failed"`. Remediation message cites the env variable name, never the token. |
| `spaceId` not found (HTTP 404) at probe | Throw from `init` with `code: "space_not_found"`. |
| Configured `contentTypes` includes an ID not present in the space | Throw from `init` with `code: "content_type_not_found"`. |
| `mappings.<contentTypeId>.metadata` targets a reserved key | Throw from `init` with `code: "reserved_metadata_key"`. |
| Sustained 5xx (>3 consecutive 5xx after exhausted retries on the same request) | Throw from `transform` or `enumerate`; build error. |
| 429 retries exhausted (PRD-202-R17) | Throw with `code: "rate_limit_exhausted"`. |
| Locale config requests a locale the space does not advertise | Throw from `init` with `code: "locale_not_in_space"`. |

#### Provenance

**PRD-202-R20.** *(Standard)* Every emitted node MUST carry `metadata.source` per PRD-200-R13:

```ts
metadata.source = {
  adapter: "act-contentful",
  source_id: `${spaceId}/${environment}/${entrySysId}${locale ? `@${locale}` : ""}`
};
```

The locale suffix is included when the adapter emits multiple locales for the same entry (Pattern 1 or Pattern 2); for single-locale runs the suffix is omitted.

#### Capabilities

**PRD-202-R21.** *(Standard / Plus)* The level the adapter declares is determined by:

- **Standard** when (a) `locale.available` resolves to a single locale AND (b) no `mappings.<...>.blocks` rules emit `marketing:*` blocks.
- **Plus** when (a) `locale.available` resolves to >1 locale OR (b) any `mappings.<...>.blocks` rule emits `marketing:*` blocks.

Per PRD-200-R24, when `ctx.config.targetLevel` is below the level the adapter would otherwise declare, the adapter MUST refuse from `init` with a level-mismatch error. Specifically, a Standard target with multi-locale config or `marketing:*` mappings MUST fail.

**PRD-202-R22.** *(Standard / Plus)* The `manifestCapabilities` returned from `init` MUST advertise:

- `etag: true` — every emitted node carries an etag.
- `subtree: true` — Contentful's hierarchical content (parent / children references) is amenable to subtree assembly by the generator.
- `ndjson_index: true` (Plus) — only when `ctx.config.targetLevel === "plus"`.
- `search: { template_advertised: false }` — Contentful CDA does not expose a full-text search endpoint that conforms to PRD-100-R39's template shape; the generator may add search separately (out of scope for this adapter).

The framework's bubble-up rule (PRD-200-R23) takes the OR with other adapters; a Plus generator with this adapter and a search-providing adapter (e.g., Algolia adapter, future PRD) advertises `search.template_advertised: true` based on the search adapter's declaration.

#### Version pinning

**PRD-202-R23.** *(Standard)* `act-contentful@0.1.x` is pinned to ACT spec `0.1` per PRD-200-R25 (Stage 1). The adapter MUST emit envelopes whose `act_version` is `"0.1"`. The package's `package.json` declares the supported `act_version` via the mechanism owned by PRD-400.

#### Test fixtures

**PRD-202-R24.** *(Standard)* The adapter MUST pass:

1. Applicable PRD-200 framework fixtures under `fixtures/200/` per PRD-200-R28.
2. PRD-202 fixtures enumerated in §"Test fixtures."

#### CMS DSL divergence

**PRD-202-R25.** *(Standard, advisory)* Per gap E6, a unified CMS schema-mapping DSL across PRD-202/203/204/205/206 is deferred to v0.2. PRD-202's `mappings` shape (PRD-202-R8) is bespoke to Contentful's content-type and field model. Operators expecting cross-CMS portability of mapping configs SHOULD wait for v0.2; v0.1's `mappings` schema is stable within `act-contentful@0.1.x` per PRD-202-R23.

#### Token redaction

**PRD-202-R26.** *(Standard)* The CDA `accessToken` MUST NOT appear in:

- `ctx.logger.{debug,info,warn,error}` output.
- Any emitted node, index entry, or build artifact.
- Error messages surfaced to the generator.
- HTTP retry / backoff diagnostics.

The adapter SHOULD prefer environment-variable references over inline config (e.g., `accessToken: { from_env: "CONTENTFUL_DELIVERY_TOKEN" }` per PRD-202-R2's optional shape — config schema permits either a string or a `{ from_env }` object). When inline strings are used, the adapter MUST log a warning citing the environmental-variable best practice and MUST redact the value in any echoed config.

### Wire format / interface definition

PRD-202 introduces no new JSON wire shapes. The contract is the TypeScript adapter shape and the config schema.

#### Adapter shape (TypeScript)

```ts
import type {
  Adapter, AdapterContext, AdapterCapabilities, EmittedNode,
} from "@act/adapter-framework";
import type { ContentfulClientApi } from "contentful";

export interface ContentfulAdapterConfig {
  spaceId: string;
  environment?: string;                 // default "master"
  accessToken: string | { from_env: string };
  contentTypes: string[];               // non-empty
  defaults?: Record<string, string>;    // contentTypeId → ACT type
  mappings?: Record<string, ContentTypeMapping>;
  resolveLinks?: { depth?: 0 | 1 | 2 | 3 | 4; scope?: "all" | "whitelist-only" };
  locale?: { available?: string[]; default?: string; pattern?: 1 | 2 };
  host?: string;                         // default "cdn.contentful.com"
  idStrategy?: { from?: "id" | "slug" | "composite"; field?: string; namespace?: string; overrideField?: string };
  concurrency?: { transform?: number };  // default 4
}

export interface ContentTypeMapping {
  type?: string;
  title?: string;
  summary?: string | { from: string; source?: "author" | "extracted" };
  abstract?: string;
  body?: string | string[];
  tags?: string;
  parent?: string;
  related?: Array<{ from: string; relation?: string }>;
  blocks?: Array<{
    when: { field: string; equals?: unknown; ofType?: string };
    type: string;
    fields: Record<string, string>;
  }>;
  metadata?: Record<string, string>;
}

export const contentfulAdapter: Adapter<ContentfulAdapterConfig, ContentfulItem> = {
  name: "act-contentful",
  async precheck(config) { /* PRD-202-R4 */ },
  async init(config, ctx): Promise<AdapterCapabilities> { /* PRD-202-R3, R21, R22 */ },
  async *enumerate(ctx): AsyncIterable<ContentfulItem> { /* PRD-202-R5, R6, R12 */ },
  async transform(item, ctx): Promise<EmittedNode | null> { /* PRD-202-R7-R11, R14, R18, R20 */ },
  async delta(since, ctx): AsyncIterable<ContentfulItem> { /* PRD-202-R16 */ },
  async dispose(ctx) { /* close client */ },
};

interface ContentfulItem {
  entry: ContentfulEntry;
  contentTypeId: string;
  locale: string | null;        // null = single-locale build
}
```

#### Config schema (JSON Schema, abridged)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://act-spec.org/schemas/202/config.schema.json",
  "title": "act-contentful adapter config",
  "type": "object",
  "required": ["spaceId", "accessToken", "contentTypes"],
  "additionalProperties": false,
  "properties": {
    "spaceId": { "type": "string", "minLength": 1 },
    "environment": { "type": "string", "minLength": 1 },
    "accessToken": {
      "oneOf": [
        { "type": "string", "minLength": 1 },
        { "type": "object", "required": ["from_env"], "additionalProperties": false,
          "properties": { "from_env": { "type": "string", "minLength": 1 } } }
      ]
    },
    "contentTypes": { "type": "array", "minItems": 1, "items": { "type": "string", "minLength": 1 } },
    "defaults": { "type": "object", "additionalProperties": { "type": "string" } },
    "mappings": { "type": "object", "additionalProperties": { "$ref": "#/$defs/ContentTypeMapping" } },
    "resolveLinks": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "depth": { "type": "integer", "minimum": 0, "maximum": 4 },
        "scope": { "type": "string", "enum": ["all", "whitelist-only"] }
      }
    },
    "locale": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "available": { "type": "array", "items": { "type": "string" } },
        "default": { "type": "string" },
        "pattern": { "type": "integer", "enum": [1, 2] }
      }
    },
    "host": { "type": "string", "enum": ["cdn.contentful.com", "preview.contentful.com"] },
    "idStrategy": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "from": { "type": "string", "enum": ["id", "slug", "composite"] },
        "field": { "type": "string" },
        "namespace": { "type": "string", "pattern": "^[a-z0-9]([a-z0-9._\\-]|/)*[a-z0-9]$" },
        "overrideField": { "type": "string" }
      }
    },
    "concurrency": {
      "type": "object",
      "additionalProperties": false,
      "properties": { "transform": { "type": "integer", "minimum": 1, "maximum": 16 } }
    }
  }
}
```

### Errors

| Condition | Adapter behavior | Framework behavior | Exit |
|---|---|---|---|
| Config schema invalid | Throw from `init` (`config_invalid`) | Build error | non-zero |
| `accessToken` rejected at probe | Throw from `init` (`auth_failed`) | Build error | non-zero |
| `spaceId` not found | Throw from `init` (`space_not_found`) | Build error | non-zero |
| Configured content type not found | Throw from `init` (`content_type_not_found`) | Build error | non-zero |
| `mappings.metadata` targets reserved key | Throw from `init` (`reserved_metadata_key`) | Build error | non-zero |
| 429 retries exhausted | Throw from `transform` (`rate_limit_exhausted`) | Build error | non-zero |
| Sustained 5xx | Throw from `enumerate` or `transform` (`upstream_unavailable`) | Build error | non-zero |
| Locale not in space | Throw from `init` (`locale_not_in_space`) | Build error | non-zero |
| Field heuristic miss / mapping miss | Emit partial node | Build warning | 0 |
| Linked entry 404 mid-resolution | Emit partial node with bare reference | Build warning | 0 |
| Linked-entry depth truncated | Emit partial node with bare reference | Build warning | 0 |
| Asset URL 404 | Emit partial node with `asset_status: "missing"` | Build warning | 0 |
| Rich Text node type unrecognized | Emit `prose` fallback or placeholder | Build warning | 0 |
| Locale untranslated for entry | Emit fallback per PRD-104-R10/R11 | Build warning | 0 |
| Sync token expired (delta path) | Fall back to full enumerate; warn | Build warning | 0 |

---

## Examples

### Example 1 — Single-content-type Standard build

Config:

```ts
{
  spaceId: "abc123",
  accessToken: { from_env: "CONTENTFUL_DELIVERY_TOKEN" },
  contentTypes: ["blogPost"],
  defaults: { blogPost: "article" }
}
```

A `blogPost` entry in Contentful:

```jsonc
{
  "sys": { "id": "5xq0dpjt7l", "contentType": { "sys": { "id": "blogPost" } } },
  "fields": {
    "title": "Welcome to ACT",
    "slug": "welcome-to-act",
    "excerpt": "A brief intro to the spec.",
    "body": { /* Rich Text AST: one paragraph + one code block */ }
  }
}
```

Emitted node (Standard target, no locales):

```json
{
  "act_version": "0.1",
  "id": "cms/5xq0dpjt7l",
  "type": "article",
  "title": "Welcome to ACT",
  "etag": "",
  "summary": "A brief intro to the spec.",
  "summary_source": "author",
  "content": [
    { "type": "prose", "format": "markdown", "text": "ACT is an open standard for agent-readable content trees." },
    { "type": "code", "language": "typescript", "text": "import { actAdapter } from 'act-contentful';" }
  ],
  "tokens": { "summary": 7, "body": 24 },
  "metadata": {
    "source": { "adapter": "act-contentful", "source_id": "abc123/master/5xq0dpjt7l" }
  }
}
```

Maps to `fixtures/202/positive/standard-blog-post.json`.

### Example 2 — Plus marketing landing page with `marketing:hero` mapping

Config:

```ts
{
  spaceId: "abc123",
  accessToken: { from_env: "CONTENTFUL_DELIVERY_TOKEN" },
  contentTypes: ["landingPage", "blogPost"],
  defaults: { landingPage: "page", blogPost: "article" },
  mappings: {
    landingPage: {
      title: "title",
      summary: "subhead",
      blocks: [
        {
          when: { field: "type", equals: "hero" },
          type: "marketing:hero",
          fields: { headline: "headline", subhead: "subhead", cta: "cta" }
        }
      ]
    }
  }
}
```

The adapter declares `level: "plus"` because of the `marketing:*` mapping. Emitted node carries a `marketing:hero` block populated from the `landingPage`'s configured fields. Maps to `fixtures/202/positive/plus-marketing-hero.json`.

### Example 3 — Pattern 1 multi-locale

Config:

```ts
{
  spaceId: "abc123",
  accessToken: { from_env: "CONTENTFUL_DELIVERY_TOKEN" },
  contentTypes: ["landingPage"],
  locale: { available: ["en-US", "es-ES", "de-DE"], default: "en-US", pattern: 1 }
}
```

For one `landingPage` entry, the adapter emits three nodes:

```json
[
  { "id": "cms/en-us/landing/pricing", "metadata": { "locale": "en-US", "translations": [
      { "locale": "es-ES", "id": "cms/es-es/landing/pricing" },
      { "locale": "de-DE", "id": "cms/de-de/landing/pricing" }
    ], "source": { "adapter": "act-contentful", "source_id": "abc123/master/4qm@en-US" } } },
  { "id": "cms/es-es/landing/pricing", "metadata": { "locale": "es-ES", "translations": [
      { "locale": "en-US", "id": "cms/en-us/landing/pricing" },
      { "locale": "de-DE", "id": "cms/de-de/landing/pricing" }
    ], "source": { "adapter": "act-contentful", "source_id": "abc123/master/4qm@es-ES" } } },
  { "id": "cms/de-de/landing/pricing", "metadata": { "locale": "de-DE", "translations": [
      { "locale": "en-US", "id": "cms/en-us/landing/pricing" },
      { "locale": "es-ES", "id": "cms/es-es/landing/pricing" }
    ], "source": { "adapter": "act-contentful", "source_id": "abc123/master/4qm@de-DE" } } }
]
```

Maps to `fixtures/202/positive/plus-multi-locale-pattern-1.json`.

### Example 4 — Locale fallback (es-ES untranslated)

The same `landingPage` entry has been authored only in `en-US`. The adapter still emits three nodes; the es-ES and de-DE nodes carry `metadata.translation_status: "fallback"` and `metadata.fallback_from: "en-US"` per PRD-104-R10 / R11, with default-locale field values substituted. Maps to `fixtures/202/positive/plus-multi-locale-fallback.json`.

### Example 5 — Auth failure (negative)

The adapter is configured with an invalid `accessToken`. `init` issues the auth probe; CDA returns 401. The adapter throws with `code: "auth_failed"` and a remediation message: `"CDA token rejected. Set CONTENTFUL_DELIVERY_TOKEN and re-run; do not commit tokens."` The token value is NOT logged. Maps to `fixtures/202/negative/init-auth-failed.expected.json`.

### Example 6 — 429 rate-limit exhausted (negative)

The adapter encounters 429 on a `transform` request and retries 6 times with exponential backoff; CDA continues to 429. The adapter throws with `code: "rate_limit_exhausted"` citing the request and elapsed retry time. Maps to `fixtures/202/negative/transform-rate-limit-exhausted.expected.json`.

---

## Test fixtures

Fixtures live under `fixtures/202/`. Per PRD-202-R24, applicable framework fixtures under `fixtures/200/` MUST also pass.

### Positive

- `fixtures/202/positive/standard-blog-post.json` → R1, R3, R5, R7, R9, R10, R15, R20, R21 (Standard), R23, R24. Example 1.
- `fixtures/202/positive/plus-marketing-hero.json` → R8, R10, R11, R21 (Plus). Example 2.
- `fixtures/202/positive/plus-multi-locale-pattern-1.json` → R12, R14, R21 (Plus). Example 3.
- `fixtures/202/positive/plus-multi-locale-fallback.json` → R12, R14 (fallback path). Example 4.
- `fixtures/202/positive/plus-multi-locale-pattern-2.json` → R13. `locale.pattern: 2` emits per-locale sub-corpora.
- `fixtures/202/positive/standard-rich-text-mixed.json` → R10. Rich Text with paragraph + heading + list + blockquote + code + asset.
- `fixtures/202/positive/embedded-asset-image-plus.json` → R11. Image asset → `marketing:image` block.
- `fixtures/202/positive/embedded-asset-image-standard-fallback.json` → R11. Image asset → markdown image inside `prose` at Standard.
- `fixtures/202/positive/linked-entry-resolved.json` → R6, R7. `blogPost` with `author` reference resolved at `depth: 1`.
- `fixtures/202/positive/linked-entry-truncated.json` → R6, R18. Reference at `depth: 2` exceeds configured `depth: 1`; emitted as bare reference with partial status.
- `fixtures/202/positive/whitelist-only-bare-ref.json` → R6. `resolveLinks.scope: "whitelist-only"` emits non-whitelisted links as bare references.
- `fixtures/202/positive/idstrategy-slug.json` → R15. `idStrategy.from: "slug"` derives ID from `slug` field.
- `fixtures/202/positive/idstrategy-override-field.json` → R15. `actId` field overrides the strategy.
- `fixtures/202/positive/delta-sync-token.json` → R16. Two-run sequence; second run via `delta(since)` returns only changed entries.
- `fixtures/202/positive/concurrency-bounded.json` → R17. 32 entries, `concurrency_max: 4`; runner asserts ≤4 concurrent transforms.
- `fixtures/202/positive/rate-limit-recovery.json` → R17. CDA returns 429 once, adapter retries with backoff, succeeds.
- `fixtures/202/positive/capability-declaration-standard.json` → R21, R22. Standard target.
- `fixtures/202/positive/capability-declaration-plus.json` → R21, R22. Plus target with locales + `marketing:*` mappings.
- `fixtures/202/positive/provenance-source-id.json` → R20.
- `fixtures/202/positive/from-env-token.json` → R26. `accessToken: { from_env: "CONTENTFUL_DELIVERY_TOKEN" }`; runner asserts no token in logs.
- `fixtures/202/positive/sync-token-expired-fallback.json` → R16. Sync token expired → adapter falls back to full enumerate with warning.

### Negative

- `fixtures/202/negative/init-auth-failed.expected.json` → R3, R19. Example 5.
- `fixtures/202/negative/init-config-invalid.expected.json` → R19. Empty `contentTypes` array.
- `fixtures/202/negative/init-space-not-found.expected.json` → R19. CDA returns 404 at probe.
- `fixtures/202/negative/init-content-type-not-found.expected.json` → R19. Configured content type not present in space.
- `fixtures/202/negative/init-reserved-metadata-key.expected.json` → R8, R19. `mappings.<...>.metadata` targets `extraction_status`.
- `fixtures/202/negative/transform-rate-limit-exhausted.expected.json` → R17, R19. Example 6.
- `fixtures/202/negative/transform-sustained-5xx.expected.json` → R19. CDA returns 502 on >3 consecutive retries.
- `fixtures/202/negative/init-locale-not-in-space.expected.json` → R19. Config requests `fr-FR` but space advertises only `en-US, es-ES`.
- `fixtures/202/negative/inline-token-warning.expected.json` → R26. Config has `accessToken: "CFPAT-..."` (inline string). Adapter emits a warning citing best practice; build proceeds.
- `fixtures/202/negative/preview-host-warning.expected.json` → R2. `host: "preview.contentful.com"` emits a warning that preview mode is not the canonical flow.

---

## Versioning & compatibility

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add an optional config field (e.g., `cdaTimeout`) | MINOR | PRD-108-R4(1). |
| Add a Rich Text node-type mapping (Contentful adds a new RT extension) | MINOR | PRD-108-R4(1). Adapter handles previously-unknown types as recoverable. |
| Tighten default `concurrency_max` from 4 to 2 | MAJOR | PRD-108-R5(6). Reduces throughput user expects. |
| Add a recognized field name to PRD-202-R7 heuristics | MINOR | PRD-108-R4(1). |
| Drop a recognized field name from PRD-202-R7 heuristics | MAJOR | PRD-108-R5(7). |
| Add a value to `idStrategy.from` enum | MAJOR | PRD-108-R5(4). Closed enum. |
| Promote `precheck` to required | MAJOR | PRD-108-R5(3). |
| Change default `locale.pattern` from 1 to 2 | MAJOR | PRD-108-R5(7). Default-shape change. |
| Add a value to error `code` set | MAJOR | PRD-108-R5(4). Closed enum (treated as such for stability). |
| Loosen rate-limit handling to "best-effort" (drop the 6-retry guarantee) | MAJOR | PRD-108-R5(3). |
| Add a `mappings.<...>.blocks` matcher type beyond `equals` / `ofType` | MINOR | Additive optional shape. |

### Forward compatibility

A future PRD-202 version that adds Rich Text node-type handlers is non-breaking; older adapters emit `partial` for unknown types (PRD-202-R18). A consumer reading PRD-202 v0.1 output MUST tolerate unknown `metadata.*` keys per PRD-108-R7.

### Backward compatibility

A v0.1 `act-contentful` adapter run against a v0.2 framework is unaffected provided no MAJOR change has been made to the `Adapter` interface, the wire envelopes, or PRD-104's locale shape. Stage 2 pinning (PRD-200-R26) opens the path for spec `0.1` and `0.2` co-support.

---

## Security considerations

Cite PRD-109 (Accepted) for the project-wide threat model. PRD-202-specific deltas:

**CDA token redaction.** PRD-202-R26 is the security primary: tokens MUST NOT appear in logs, errors, build artifacts, or echoed config. The reference implementation MUST hash-or-mask any token field when echoing the resolved config (the canonical pattern is `accessToken: "<from CONTENTFUL_DELIVERY_TOKEN>"` — value never stringified).

**Network egress posture.** The adapter performs network egress to Contentful's CDA host (default `cdn.contentful.com`). Operators in restricted-egress environments MUST allow-list the CDA host in their build network policy. The adapter's `host` config permits override but only to the closed set `{ "cdn.contentful.com", "preview.contentful.com" }` per the schema; operators using a self-hosted Contentful proxy MUST modify the schema (and re-validate per PRD-202-R23).

**Linked-entry recursion bounds.** PRD-202-R6 caps `resolveLinks.depth` at 4. Without a cap, a hostile content author could construct a circular reference graph that drives the CDA to fan out exponentially. The cap, plus the CDA's own `include` parameter limits, prevents resource exhaustion on the build host.

**Asset-URL trust.** The adapter emits asset URLs verbatim from CDA. Consumers MUST treat asset URLs as untrusted resources subject to consumer-side fetch policy. PRD-109 documents the project-wide content-trust posture; PRD-202 contributes only the data flow.

**Content-author-controlled fields.** Contentful entries are authored by content editors; field values flow into the emitted node. A content editor with write access can populate `tags`, `title`, `summary`, body fields. The trust boundary is "Contentful authoring access" — operators MUST treat the corpus as authored by everyone with content-edit permission. Reserved-metadata-key protection (PRD-202-R8) prevents content editors from forging framework metadata even when they control `mappings.<...>.metadata` (because the operator authors the mapping config, not the content editor).

**Per-locale data leakage.** When `locale.pattern: 1` (Pattern 1, locale-prefixed IDs), each locale's nodes are first-class IDs in the same corpus. PRD-104's per-tenant scoping requirements apply: a runtime ACT server serving Pattern 1 with locale-prefixed IDs MUST apply per-tenant authorization checks to all locale-prefixed IDs uniformly. Per-locale CDA calls MUST use the same `accessToken`; the adapter MUST NOT switch tokens per locale (which would imply per-locale auth boundaries the spec does not contemplate).

**Build-time-only.** The adapter runs at build time. It does not introduce a runtime endpoint. PRD-109's runtime auth surface (auth scheme negotiation, per-tenant scoping at request time) does not apply.

**Sync-token persistence.** PRD-202-R16's `delta(since)` requires the sync token to persist across builds. The token is OPAQUE but is functionally a long-lived auth-equivalent: holding a sync token for a space lets an attacker learn the space's recent history. The token SHOULD be stored alongside the build's CI secrets (not in source control). Operators MUST treat the sync token with the same care as the access token.

**Preview-mode warning.** `host: "preview.contentful.com"` exposes draft content. The adapter emits a warning per PRD-202-R2 to make this misuse more visible. Operators MUST NOT publish preview-mode output as if it were canonical.

---

## Implementation notes

Snippets show the canonical TypeScript shape; full implementation lives in `packages/act-contentful/`.

### Snippet 1 — Adapter init with credential redaction

```ts
// packages/act-contentful/src/init.ts

export async function init(
  config: ContentfulAdapterConfig,
  ctx: AdapterContext,
): Promise<AdapterCapabilities> {
  // Resolve token without logging.
  const token = typeof config.accessToken === "string"
    ? config.accessToken
    : process.env[config.accessToken.from_env];
  if (!token) {
    throw new AdapterError({
      code: "config_invalid",
      message: typeof config.accessToken === "object"
        ? `env var '${config.accessToken.from_env}' is not set`
        : "accessToken is empty",
    });
  }
  if (typeof config.accessToken === "string") {
    ctx.logger.warn("accessToken supplied inline; prefer { from_env: '<NAME>' } per PRD-202-R26");
  }

  // Reject reserved-key targets in mappings (PRD-202-R8).
  for (const [ctId, m] of Object.entries(config.mappings ?? {})) {
    for (const key of Object.keys(m.metadata ?? {})) {
      if (RESERVED_METADATA_KEYS.has(key)) {
        throw new AdapterError({
          code: "reserved_metadata_key",
          message: `mappings.${ctId}.metadata.${key} targets reserved framework key (PRD-202-R8)`,
        });
      }
    }
  }

  // Auth probe (PRD-202-R3).
  this.client = createClient({
    space: config.spaceId,
    environment: config.environment ?? "master",
    accessToken: token,
    host: config.host ?? "cdn.contentful.com",
  });
  try {
    await this.client.getSpace();
  } catch (err) {
    const code = (err as ContentfulError).response?.status === 401 ? "auth_failed" : "space_not_found";
    throw new AdapterError({
      code,
      message: code === "auth_failed"
        ? "CDA token rejected. Set CONTENTFUL_DELIVERY_TOKEN and re-run; do not commit tokens."
        : `space '${config.spaceId}' not found`,
    });
  }

  // Verify content types exist (PRD-202-R19).
  const types = await this.client.getContentTypes({ limit: 1000 });
  const ids = new Set(types.items.map((t) => t.sys.id));
  for (const ctId of config.contentTypes) {
    if (!ids.has(ctId)) {
      throw new AdapterError({ code: "content_type_not_found", message: `contentType '${ctId}' not in space` });
    }
  }

  // Locale validation (PRD-202-R12 / R13).
  const space = await this.client.getSpace();
  const spaceLocales = (space.locales ?? []).map((l) => l.code);
  const requestedLocales = config.locale?.available ?? spaceLocales;
  for (const loc of requestedLocales) {
    if (!spaceLocales.includes(loc)) {
      throw new AdapterError({ code: "locale_not_in_space", message: `locale '${loc}' not advertised by space` });
    }
  }
  const isMultiLocale = requestedLocales.length > 1;
  const hasMarketingBlocks = Object.values(config.mappings ?? {}).some(
    (m) => (m.blocks ?? []).some((b) => b.type.startsWith("marketing:")),
  );
  const declaredLevel = (isMultiLocale || hasMarketingBlocks) ? "plus" : "standard";

  if (rankOf(declaredLevel) > rankOf(ctx.config.targetLevel)) {
    throw new AdapterError({
      code: "level_mismatch",
      message: `target '${ctx.config.targetLevel}' below adapter level '${declaredLevel}' (PRD-202-R21)`,
    });
  }

  return {
    level: declaredLevel,
    concurrency_max: config.concurrency?.transform ?? 4,
    delta: true,
    namespace_ids: true,
    precedence: "primary",
    summarySource: "author",
    i18n: isMultiLocale,
    manifestCapabilities: {
      etag: true,
      subtree: true,
      ndjson_index: declaredLevel === "plus",
      search: { template_advertised: false },
    },
  };
}
```

### Snippet 2 — CDA query with locale fan-out (PRD-202-R5, R12)

```ts
// packages/act-contentful/src/enumerate.ts

export async function* enumerate(this: ContentfulAdapter, ctx: AdapterContext) {
  const locales = this.config.locale?.available ?? [null];
  for (const ctId of this.config.contentTypes) {
    for (const loc of locales) {
      let skip = 0;
      for (;;) {
        if (ctx.signal.aborted) return;
        const params: any = {
          content_type: ctId,
          skip,
          limit: 100,
          include: this.config.resolveLinks?.depth ?? 1,
          order: "sys.id",
        };
        if (loc !== null) params.locale = loc;

        const res = await retry429(() => this.client.getEntries(params), ctx);
        for (const entry of res.items) {
          yield { entry, contentTypeId: ctId, locale: loc };
        }
        skip += res.items.length;
        if (skip >= res.total) break;
      }
    }
  }
}
```

### Snippet 3 — Rate-limit retry with backoff (PRD-202-R17)

```ts
// packages/act-contentful/src/retry.ts

export async function retry429<T>(fn: () => Promise<T>, ctx: AdapterContext): Promise<T> {
  let attempt = 0;
  let delay = 1000;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      const status = (err as ContentfulError).response?.status;
      if (status !== 429 || attempt >= 6) {
        if (status === 429) {
          throw new AdapterError({
            code: "rate_limit_exhausted",
            message: `429 retries exhausted after ${attempt} attempts`,
          });
        }
        throw err;
      }
      const resetHeader = (err as ContentfulError).response?.headers?.["x-contentful-ratelimit-reset"];
      const wait = resetHeader ? Number(resetHeader) * 1000 : delay;
      ctx.logger.warn(`429 from CDA; waiting ${wait}ms (attempt ${attempt + 1}/6)`);
      await new Promise((r) => setTimeout(r, wait));
      attempt += 1;
      delay = Math.min(delay * 2, 32000);
    }
  }
}
```

### Snippet 4 — Field heuristics + mapping resolution (PRD-202-R7, R8)

```ts
// packages/act-contentful/src/transform/resolve.ts

const TITLE_FIELDS = ["title", "name", "headline"];
const SUMMARY_FIELDS = ["summary", "excerpt", "description", "subhead"];
const ABSTRACT_FIELDS = ["abstract", "intro", "lede"];

export function resolveCoreFields(
  fields: Record<string, unknown>,
  mapping: ContentTypeMapping | undefined,
): { title: string; summary: string; summary_source: "author" | "extracted"; abstract?: string; partial?: { error: string } } {
  const titleField = mapping?.title ?? firstPresent(fields, TITLE_FIELDS);
  const title = titleField && typeof fields[titleField] === "string" ? (fields[titleField] as string) : null;

  let summary: string | null = null;
  let summary_source: "author" | "extracted" = "extracted";
  if (mapping?.summary) {
    const from = typeof mapping.summary === "string" ? mapping.summary : mapping.summary.from;
    if (typeof fields[from] === "string") {
      summary = fields[from] as string;
      summary_source = (typeof mapping.summary === "object" && mapping.summary.source) || "author";
    }
  }
  if (!summary) {
    const sumField = firstPresent(fields, SUMMARY_FIELDS);
    if (sumField && typeof fields[sumField] === "string") {
      summary = fields[sumField] as string;
      summary_source = "author";
    }
  }

  return {
    title: title ?? `Untitled ${mapping?.type ?? "entry"}`,
    summary: summary ?? "(extraction pending)",
    summary_source,
    ...(mapping?.abstract && typeof fields[mapping.abstract] === "string"
      ? { abstract: fields[mapping.abstract] as string }
      : {}),
    ...(title === null ? { partial: { error: "no title field present" } } : {}),
  };
}
```

### Snippet 5 — Rich Text → blocks (PRD-202-R10)

```ts
// packages/act-contentful/src/transform/richtext.ts

import type { Document, Block, Inline } from "@contentful/rich-text-types";
import { BLOCKS, INLINES } from "@contentful/rich-text-types";

export function richTextToBlocks(
  doc: Document,
  ctx: { targetLevel: "core" | "standard" | "plus"; mappings: Record<string, ContentTypeMapping> },
): ContentBlock[] {
  const out: ContentBlock[] = [];
  for (const node of doc.content) {
    switch (node.nodeType) {
      case BLOCKS.PARAGRAPH:
      case BLOCKS.HEADING_1: case BLOCKS.HEADING_2: case BLOCKS.HEADING_3:
      case BLOCKS.HEADING_4: case BLOCKS.HEADING_5: case BLOCKS.HEADING_6:
      case BLOCKS.UL_LIST: case BLOCKS.OL_LIST:
      case BLOCKS.QUOTE: case BLOCKS.HR:
        out.push({ type: "prose", format: "markdown", text: nodeToMarkdown(node) });
        break;
      case BLOCKS.EMBEDDED_ASSET:
        out.push(assetToBlock(node, ctx));   // R11
        break;
      case BLOCKS.EMBEDDED_ENTRY:
        out.push(embeddedEntryToBlock(node, ctx));   // R11
        break;
      default: {
        // Unknown node type → recoverable partial (R18)
        const fallback = nodeToMarkdownLossy(node);
        out.push({
          type: "prose", format: "markdown", text: fallback,
          metadata: { extraction_status: "partial", extraction_error: `unknown rich-text node type: ${node.nodeType}` },
        });
      }
    }
  }
  return out;
}
```

### Snippet 6 — Sync-token-based delta (PRD-202-R16)

```ts
// packages/act-contentful/src/delta.ts

export async function* delta(this: ContentfulAdapter, since: string, ctx: AdapterContext) {
  let res;
  try {
    res = await this.client.sync({ syncToken: since });
  } catch (err) {
    if (isSyncTokenExpired(err)) {
      ctx.logger.warn("sync token expired; rebasing to full enumerate");
      yield* enumerate.call(this, ctx);
      return;
    }
    throw err;
  }
  for (const entry of res.entries) {
    if (ctx.signal.aborted) return;
    yield { entry, contentTypeId: entry.sys.contentType.sys.id, locale: this.config.locale?.default ?? null };
  }
  // Persist next sync token via ctx.config (generator-owned persistence path)
  ctx.logger.info(`sync delta yielded ${res.entries.length} entries; next token=${res.nextSyncToken}`);
}
```

### Snippet 7 — Provenance and locale stamping (PRD-202-R20, R12, R14)

```ts
// packages/act-contentful/src/transform/finalize.ts

export function finalize(
  partial: Partial<EmittedNode>,
  item: ContentfulItem,
  config: ContentfulAdapterConfig,
  allLocales: string[],
): EmittedNode {
  const { entry, locale } = item;
  const id = deriveId(entry, config, locale);

  const translations = locale && allLocales.length > 1
    ? allLocales.filter((l) => l !== locale).map((l) => ({ locale: l, id: deriveId(entry, config, l) }))
    : undefined;

  return {
    act_version: "0.1",
    id,
    type: partial.type ?? "article",
    title: partial.title!,
    etag: "",
    summary: partial.summary!,
    summary_source: partial.summary_source,
    content: partial.content ?? [],
    tokens: partial.tokens!,
    ...(partial.related ? { related: partial.related } : {}),
    metadata: {
      ...(locale ? { locale } : {}),
      ...(translations ? { translations } : {}),
      ...(partial.metadata ?? {}),
      source: {
        adapter: "act-contentful",
        source_id: `${config.spaceId}/${config.environment ?? "master"}/${entry.sys.id}${locale ? `@${locale}` : ""}`,
      },
    },
  };
}
```

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft. Pins the Contentful CDA adapter on top of PRD-200's framework. Locks: config schema (R2) covering `spaceId`, `environment`, `accessToken` (string OR `{ from_env }`), `contentTypes`, `mappings`, `defaults`, `resolveLinks`, `locale`, `host`, `idStrategy`, `concurrency`; init flow (R3) with credential probe + content-type-presence verification + locale-presence verification + level-mismatch check + reserved-metadata-key check (R8); optional 1-second `precheck` (R4); CDA enumerate via paginated `getEntries` with deterministic ordering (R5) and `include` depth control with whitelist scope (R6); default field-mapping heuristics covering `title` / `summary` / `abstract` / `body` / `tags` / `related` (R7) plus user `mappings` shape with `type` / `summary` / `body` / `tags` / `parent` / `related` / `blocks` for `marketing:*` block emission / `metadata` open object — reserved-metadata-key violations are unrecoverable (R8); content-type → ACT type via `mappings` > `defaults` > `"article"` (R9); Rich Text JSON AST → PRD-102 block taxonomy mapping covering paragraph / headings / lists / blockquote / hr / embedded-asset / embedded-entry / hyperlinks / code / tables (R10); embedded-asset / embedded-entry handling with Plus-tier `marketing:image` / `marketing:asset` / `marketing:placeholder` and Standard-tier inline-markdown fallback (R11); locale fan-out Pattern 1 (locale-prefixed IDs, default) and Pattern 2 (per-locale manifests) per PRD-104-R5 / R6 (R12, R13); cross-locale `metadata.translations` dense form per PRD-104-R9 plus fallback handling per PRD-104-R10 / R11 (R14); ID derivation (R15) with `from: "id" | "slug" | "composite"` and `actId` per-entry override; sync-API-driven `delta(since)` with token-expiry rebase (R16); concurrency default 4 with 429 exponential backoff up to 6 retries honoring `X-Contentful-RateLimit-Reset` (R17); recoverable / unrecoverable failure split (R18, R19) tied verbatim to PRD-200-R16 / R18; provenance stamping (R20) including locale suffix on `source_id`; Standard-vs-Plus level declaration based on locale count + `marketing:*` mappings (R21); manifest-capability bubble-up `etag` / `subtree` / `ndjson_index` (Plus) / `search.template_advertised: false` (R22); Stage-1 version pinning (R23); test-fixture conformance (R24); CMS DSL divergence flag per gap E6 (R25); CDA token redaction across logs / artifacts / errors with `from_env` preference (R26). 22 positive fixtures and 10 negative fixtures enumerated under `fixtures/202/`. Implementation notes ship 7 short TS snippets covering init with redaction, locale-fan-out enumerate, 429 retry, field heuristic resolver, Rich Text → blocks, sync-delta with rebase, and finalize with provenance + translations. Cites PRD-200 (in review) for framework; PRD-100 / PRD-102 / PRD-104 / PRD-107 / PRD-108 / PRD-109 (Accepted) for envelopes / blocks / i18n / level / versioning / security. Status set to `In review`. |
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review; no normative changes. Decisions: (1) preview API deferred to v0.2 (operators use PRD-208 in the meantime); (2) field-mapping DSL stays declarative — no transforms in v0.1; (3) linked-entry resolution defaults to all entries with opt-out via `resolveLinks.scope: "whitelist-only"`; (4) Tags API mapping deferred to v0.2; (5) Pattern 1 (locale-prefixed IDs) is the default localization model. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
