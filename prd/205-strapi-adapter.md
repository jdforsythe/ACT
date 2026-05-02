# PRD-205 — Strapi adapter

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

Strapi is the most popular self-hosted Node.js headless CMS. It exposes content via a REST API (`/api/<plural>`) and an optional GraphQL plugin, organizes content into "content types" with author-defined schemas, and uses **markdown by default for rich-text fields**. Its lifecycle hooks (`afterCreate`, `afterUpdate`, `afterDelete`) and webhooks make incremental rebuilds straightforward. The fact that Strapi rich-text is markdown rather than a custom AST means the adapter's content-block walk is mostly trivial — markdown passes through to ACT `markdown` blocks (PRD-102-R1) — but Strapi's flexible component model (reusable component schemas, dynamic zones containing arbitrary component instances) creates the same `marketing:*` mapping question as the other CMS adapters.

PRD-100, PRD-102, PRD-103, PRD-107, PRD-108, PRD-109 (all Accepted) define the wire-format envelopes, content-block taxonomy, ETag derivation, conformance bands, versioning regime, and security posture this adapter must respect. PRD-200 (in review) defines the framework contract this adapter implements. Per gap E6, CMS DSL unification is deferred to v0.2.

Strapi is operationally distinct from the SaaS-hosted CMSes (Contentful, Sanity, Storyblok, Builder.io) because the operator runs the Strapi server. The adapter must therefore handle a wider range of deployment shapes — local dev instances, self-hosted production, Strapi Cloud — and must NOT assume a fixed base URL. Strapi v4 and v5 differ in API response envelope shape (v4 wraps every entity in `{data, attributes}`; v5 flattens); the adapter targets v5 by default but supports v4 via a config flag.

### Goals

1. Lock the **adapter configuration** schema for Strapi — base URL, API token, content types to include, version (v4 vs v5), GraphQL toggle, type-and-field mapping, populate depth.
2. Lock the **content-type → ACT type mapping** with sensible defaults.
3. Lock the **field mapping** from Strapi entity fields to ACT node fields: title, summary, body (markdown), tags, references → `related`.
4. Lock the **markdown body conversion** — Strapi rich-text fields default to markdown; the adapter passes them through to ACT `markdown` blocks (PRD-102-R1) with optional secondary parsing into `prose`/`code`/`callout` blocks when configured.
5. Lock the **dynamic zones / component instances → `marketing:*`** mapping when configured.
6. Lock the **relation resolution** semantics — Strapi's `populate` parameter; depth-bounded; cycle-tolerant.
7. Lock the **incremental rebuild** path via Strapi lifecycle webhooks (`entry.publish`, `entry.update`, `entry.delete`) — surfaced through the framework's `delta(since)` hook keyed on Strapi's `updatedAt` timestamp.
8. Lock the **locale handling** when Strapi's i18n plugin is in use.
9. Lock the **capability declaration**, **failure modes**, and **conformance** — Standard by default; Plus when component mapping + locale configured.
10. Provide TypeScript implementation-notes snippets and enumerate the test fixture matrix.

### Non-goals

1. Defining the adapter framework — owned by PRD-200.
2. Defining wire format / blocks / ETag / conformance / versioning — owned by PRD-100 / PRD-102 / PRD-103 / PRD-107 / PRD-108.
3. Defining the i18n adapter — owned by PRD-207. The Strapi adapter cooperates via the merge step.
4. Defining component-contract emission — owned by PRD-300. Strapi components are CMS-side data, not React/Vue framework components.
5. Unifying CMS mapping DSL — deferred to v0.2 per gap E6.
6. Authoring a non-TypeScript Strapi adapter — per Q3, v0.1 is TS-only.
7. Specifying Strapi server-side configuration. The adapter is read-only against an existing Strapi deployment.
8. Specifying Strapi Cloud-specific surfaces. The adapter treats Strapi Cloud as a base-URL flavor of self-hosted.
9. Pinning the GraphQL query shape. PRD-205 specifies REST as the canonical path; GraphQL is a configurable alternative whose query shape is the operator's concern.

### Stakeholders / audience

- **Authors of:** sites running Strapi-backed docs / marketing surfaces under any of the 400-series generators.
- **Consumers of:** PRD-400, PRD-401 (Astro), PRD-405 (Next.js), PRD-407 (Nuxt — Vue + Strapi is a popular pairing).
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Strapi v4 vs v5 envelope-shape divergence introduces silent parsing bugs | High | Medium | PRD-205-R3 mandates explicit version pin (default v5); negative fixture catches v4 input parsed as v5 (and vice versa). |
| Self-hosted Strapi base URLs are operator-defined and may use `http` instead of `https` | High | Medium | PRD-205-R23 warns (does not error) when base URL uses `http`; aligns with PRD-109's transport-trust posture. |
| Markdown bodies vary in dialect (Strapi's rich-text editor produces flavor-of-CommonMark; some users disable rich-text and use plain Markdown) | Medium | Low | Default emits a single `markdown` block (PRD-102-R1) preserving source. Optional `parseMarkdown: true` config splits into `prose`/`code`/`callout` blocks. |
| Dynamic-zone components produce arbitrary nesting | Medium | Medium | PRD-205-R10 caps dynamic-zone depth at 3 (Strapi's default UI limit); deeper falls back to partial. |
| `populate=*` in Strapi v5 produces enormous responses for large content types | Medium | High | PRD-205-R4 forbids `populate=*`; the adapter computes the populate string from `fieldMapping.related` and `componentMapping` to bound response size. Negative fixture covers misconfiguration. |
| Strapi API token leakage | Low | High | PRD-205-R23 / R24 prohibit logging and emitting tokens. PRD-109 cited. |
| Strapi rate limits on cloud deployments | Medium | Medium | PRD-205-R20 retries with backoff; `concurrency_max: 4` default. |

### Open questions

1. ~~Should the adapter expose Strapi's **single types** (singletons like a "site config" or "global settings") as separate ACT nodes or as `manifest.policy` / `manifest.site` decoration?~~ **Resolved (2026-05-01): As separate nodes when listed in `contentTypes`.** Operators include / exclude single types via the `contentTypes` filter — uniform treatment with collection types keeps the mapping declarative and avoids inventing a parallel manifest-decoration channel. (Closes Open Question 1.)
2. ~~Should the adapter normalize Strapi's `documentId` (v5) vs numeric `id` (v4) into a unified ACT `source_id`?~~ **Resolved (2026-05-01): Yes.** Prefer `documentId` when present (v5) and fall back to `id` (v4); both are stable across content edits. This is required for cross-version conformance. (Closes Open Question 2.)
3. ~~Should the adapter support the GraphQL plugin as a configurable alternative to REST, or REST-only?~~ **Resolved (2026-05-01): Configurable.** PRD-205-R4 allows `transport: "rest" | "graphql"`; default REST. GraphQL query shape is the operator's concern. (Closes Open Question 3.)

### Acceptance criteria

- [ ] Every normative requirement has an ID `PRD-205-R{n}` and a declared conformance level.
- [ ] The Specification section opens with a table mapping every requirement to PRD-200 + 100-series requirements.
- [ ] Implementation notes contain 3–6 short TypeScript snippets.
- [ ] Test fixture paths under `fixtures/205/positive/` and `fixtures/205/negative/` are enumerated.
- [ ] Versioning & compatibility section per PRD-108.
- [ ] Security section cites PRD-109 and documents Strapi-specific deltas.
- [ ] Changelog entry dated 2026-05-01 by Jeremy Forsythe.

---

## Context & dependencies

### Depends on

- **PRD-200** (in review) — adapter framework.
- **PRD-100** (Accepted) — wire format.
- **PRD-102** (Accepted) — content blocks.
- **PRD-103** (Accepted) — caching / ETag.
- **PRD-107** (Accepted) — conformance.
- **PRD-108** (Accepted) — versioning. Stage 1 pinning per PRD-200-R25.
- **PRD-109** (Accepted) — security.
- **PRD-207** (in flight) — i18n cooperation via merge step.
- External: [Strapi v5 REST API](https://docs.strapi.io/dev-docs/api/rest), [Strapi i18n plugin](https://docs.strapi.io/dev-docs/plugins/i18n), [Strapi webhooks / lifecycle hooks](https://docs.strapi.io/dev-docs/backend-customization/webhooks), [Strapi GraphQL plugin](https://docs.strapi.io/dev-docs/plugins/graphql). Cited for shape.

### Blocks

- None directly; aspirationally enables PRD-702-style examples backed by Strapi.

### References

- v0.1 draft: §5.10 (adapter pipeline).
- `prd/000-gaps-and-resolutions.md` gap **E6** (CMS DSL deferred).
- `prd/000-decisions-needed.md` Q3, Q5, Q7.
- Prior art: [`gatsby-source-strapi`](https://github.com/strapi/gatsby-source-strapi), [`@strapi/sdk-js`](https://github.com/strapi/sdk-js), [`strapi-graphql`](https://docs.strapi.io/dev-docs/plugins/graphql).

---

## Specification

This is the normative section. Every requirement uses RFC 2119 keywords as clarified by RFC 8174.

### Parent + 100-series requirements implemented

| PRD-205 requirement | Parent / 100-series requirement(s) | Relationship |
|---|---|---|
| R1 (interface compliance) | PRD-200-R1 | Implements `Adapter`. |
| R2 (config schema) | PRD-200-R3, R20 | Validated in `init`. |
| R3 (Strapi version pin — v4 vs v5) | PRD-200-R3 | Default v5. |
| R4 (transport — REST vs GraphQL) | PRD-200-R3, R4 | Default REST. |
| R5 (content-types filter) | PRD-200-R4 | `enumerate` per content type. |
| R6 (filter result safety) | PRD-200-R18 | Empty + no `allowEmpty` → warning. |
| R7 (content-type mapping) | PRD-100-R21, PRD-200-R5 | Strapi content-type → ACT `type`. |
| R8 (field mapping) | PRD-100-R21, R22 | Strapi attributes → ACT envelope. |
| R9 (markdown body emission) | PRD-102-R1, R2, R3, R5 | Default: single `markdown` block; optional split. |
| R10 (dynamic-zone bound) | — | Depth ≤ 3; deeper falls back to partial. |
| R11 (component → `marketing:*` — Plus) | PRD-102-R6, R7–R11 | Configured mapping. |
| R12 (relation resolution) | PRD-102-R18, R19, R20 | `populate` + `related[]`. |
| R13 (populate depth) | — | Default 1; max 4. |
| R14 (cycle handling) | PRD-102-R20 | Tolerated; warning emitted. |
| R15 (locale handling) | PRD-100-R22, PRD-104 (in flight) | Strapi i18n plugin. |
| R16 (incremental rebuild via lifecycle webhook) | PRD-200-R9 | `delta(since)` keyed on `updatedAt`. |
| R17 (webhook signature verification) | PRD-109-R5–R9 | HMAC validation helper. |
| R18 (capability declaration) | PRD-200-R22 | `AdapterCapabilities`. |
| R19 (level — Standard) | PRD-107-R8 | Default. |
| R20 (level — Plus) | PRD-107-R10 | Plus when component mapping + locale. |
| R21 (failure mode — rate limit) | PRD-200-R16 | Retry with backoff. |
| R22 (failure mode — auth) | PRD-200-R18 | Throw from `init`. |
| R23 (failure mode — partial) | PRD-200-R16, R17 | `extraction_status: "partial"`. |
| R24 (security — no token in logs / `http://` warning) | PRD-109-R14, R15, R23 | Token redaction + transport warning. |
| R25 (security — no token in envelopes) | PRD-109-R1, R2, R14 | Token never emitted. |
| R26 (provenance — Strapi source_id) | PRD-200-R13 | `source_id` is `documentId` (v5) or `id` (v4). |
| R27 (Stage 1 pinning) | PRD-200-R25, PRD-108-R14 | `act-strapi@0.1.x` → `act_version: "0.1"` only. |
| R28 (test-fixture conformance) | PRD-200-R28 | Adapter passes framework + Strapi corpora. |

### Conformance level

- **Core:** R1, R2, R5, R7, R8, R9 (single-block default), R12 (basic), R18, R19, R22, R24, R25, R26, R27, R28.
- **Standard:** R3, R4, R6, R9 (split-mode), R10, R12 (full), R13, R14, R16, R17, R21, R23.
- **Plus:** R11 (`marketing:*`), R15 (locale), R20.

### Normative requirements

#### Adapter contract

**PRD-205-R1.** The `act-strapi` adapter MUST implement the `Adapter` interface defined in PRD-200-R1. The package's default export MUST satisfy `Adapter<StrapiConfig, StrapiEntity>`. Conformance: **Core**.

#### Configuration

**PRD-205-R2.** The adapter MUST validate its configuration in `init`. Required: `baseUrl` (string, e.g., `"https://cms.acme.example"`), `apiToken` (string OR env-var reference), `contentTypes` (string array — Strapi content-type unique identifiers in their plural form, e.g., `["articles", "tutorials"]`). Optional: `strapiVersion` (`"v4" | "v5"`, default `"v5"`), `transport` (`"rest" | "graphql"`, default `"rest"`), `graphqlEndpoint` (string, default `"/graphql"`; only used when `transport: "graphql"`), `typeMapping` (object), `fieldMapping` (object), `idField` (string, default per R8), `parseMarkdown` (boolean, default `false`), `populateDepth` (integer 0–4, default 1), `componentMapping` (object), `dynamicZoneMax` (integer 1–3, default 3), `locale` (object), `summary` (object), `webhookSecret` (string, optional), `allowEmpty` (boolean, default `false`). Validation failures cause `init` to reject. Conformance: **Core**.

**PRD-205-R3.** The `strapiVersion` config field MUST default to `"v5"`. The adapter MUST handle the response-envelope difference between v4 (`{data: {id, attributes: {...}}}`) and v5 (`{id, documentId, ...}`) per the configured version. Mixing v4 and v5 within one config is a configuration error. The adapter SHOULD probe the Strapi server during `init` (e.g., a `GET /api/users/me` or `GET /admin/init`) to detect a version mismatch and warn (not error) when the server's version differs from the configured one — the warning helps operators catch v4-vs-v5 misconfiguration without breaking builds when the operator knowingly proxies. Conformance: **Standard**.

**PRD-205-R4.** When `transport: "rest"` (default), the adapter's `enumerate` MUST issue paginated `GET /api/<contentType>` requests with `pagination[pageSize]=100&pagination[page]=N` and the computed `populate` query string. The adapter MUST NOT use Strapi's `populate=*` shortcut at any depth — `populate=*` produces unbounded response sizes; the adapter computes a precise populate string from `fieldMapping.related`, `componentMapping`, and the configured `populateDepth`. When `transport: "graphql"`, the adapter MUST issue POST requests against `graphqlEndpoint` carrying a query string the operator MAY override via `graphqlQuery` config; the default GraphQL query mirrors the REST populate strategy. Conformance: **Standard**.

**PRD-205-R5.** The adapter MUST iterate over the configured `contentTypes` array. Each content type's results are concatenated into the `enumerate` AsyncIterable. A content type that does not exist on the server (404) MUST cause `init` to reject (per PRD-205-R22) — silent skipping of misconfigured content types is a build-error-class problem, not a per-item warning. Conformance: **Core**.

**PRD-205-R6.** When the configured `contentTypes` filter returns zero entities across all configured content types AND `allowEmpty: true` is not set, the adapter MUST emit a build warning citing the configuration and the result count. The adapter MUST NOT throw. Conformance: **Standard**.

#### Content-type and field mapping

**PRD-205-R7.** The adapter MUST map Strapi content-type identifiers (singular form, e.g., `"article"` for the plural `"articles"`) to ACT `type` per `typeMapping`. The default mapping is identity. Operators MAY override per-content-type. Conformance: **Core**.

**PRD-205-R8.** The adapter MUST map Strapi attribute fields to ACT envelope fields per `fieldMapping`. The default mapping is:

| ACT field | Strapi source (default) | Notes |
|---|---|---|
| `id` | `slug` if present, else `documentId` (v5) or `id` (v4) | Override via `idField`. Sanitized to ID grammar. |
| `title` | `title` | String required. |
| `summary` | `summary` if present, else first 50 tokens of body extracted to plaintext | When extracted, `summary_source: "extracted"`. |
| `abstract` | `abstract` if present | Optional. |
| `content` | `body` (markdown) | Per PRD-205-R9. |
| `tags` (in `metadata.tags`) | `tags.data[].attributes.name` (v4) / `tags[].name` (v5) — relation to a `tag` content type | Optional. |
| `related` | configured relation fields | Per PRD-205-R12. |
| `updated_at` | `publishedAt` (when published) or `updatedAt` (drafts) | RFC 3339. |
| `metadata.locale` | `locale` (Strapi i18n) | Per PRD-205-R15. |

Operators MAY override any row. The adapter MUST emit a partial node when a required field is unmappable. Conformance: **Core** (defaults), **Standard** (overrides + partial-emission).

#### Markdown body

**PRD-205-R9.** Strapi rich-text fields default to markdown. The adapter MUST emit the body content as ACT content blocks per the configured strategy:

- **Default (`parseMarkdown: false`).** Emit a single `markdown` block (PRD-102-R1) carrying the body's source markdown verbatim. This is the simplest, lowest-loss strategy.
- **Split (`parseMarkdown: true`).** Walk the markdown into individual ACT blocks: paragraphs and inline-formatted prose → `prose` blocks (PRD-102-R2) with `format: "markdown"`; fenced code blocks → `code` blocks (PRD-102-R3) with `language` from the fence; admonition / blockquote markers (`> [!info]` style) → `callout` blocks (PRD-102-R5) with `level` from the marker. Lists are coalesced into single `prose` blocks per list. Headings are merged into the following `prose` block.

Conformance: **Core** (default mode), **Standard** (split mode).

#### Dynamic zones

**PRD-205-R10.** Strapi dynamic zones MAY contain component instances at depth up to **3** (Strapi's default UI cap). Beyond depth 3, the adapter MUST emit a partial-extraction warning AND fall back to a `prose` block whose `text` is `(dynamic-zone depth bound exceeded at depth N)`. Operators MAY tighten via `dynamicZoneMax: 1 | 2 | 3`; they MUST NOT exceed 3. Conformance: **Standard**.

#### Component → `marketing:*` (Plus)

**PRD-205-R11.** When the adapter is configured with `componentMapping`, dynamic-zone component instances whose Strapi component identifier (e.g., `"shared.hero"`, `"marketing.pricing-table"`) matches a key in `componentMapping` MUST be emitted as the corresponding `marketing:*` block per PRD-102-R7–R11. The mapping config takes the same shape as PRD-203-R9 / PRD-204-R10:

```json
{
  "componentMapping": {
    "shared.hero":            { "type": "marketing:hero",         "fields": { "headline": "title", "subhead": "subtitle", "cta": { "label": "ctaLabel", "href": "ctaHref" } } },
    "shared.feature-grid":    { "type": "marketing:feature-grid", "fields": { "features": "items[].{title, description, icon}" } },
    "marketing.pricing-table":{ "type": "marketing:pricing-table","fields": { "tiers": "tiers[].{name, price, features}" } },
    "marketing.testimonial":  { "type": "marketing:testimonial",  "fields": { "quote": "quote", "author": "authorName", "role": "authorRole", "org": "authorOrg" } },
    "marketing.faq":          { "type": "marketing:faq",          "fields": { "items": "items[].{question, answer}" } }
  }
}
```

Components without a mapping fall through to the partial-extraction path. Conformance: **Plus**.

#### Relation resolution

**PRD-205-R12.** The adapter MUST resolve Strapi relations declared in `fieldMapping.related` into ACT `related[]` entries per PRD-102-R18. The default `relation` is `"see-also"`; operators MAY map per-field to other relation values. Cross-content-type relations are permitted. The Strapi `populate` query string MUST include each declared relation field at the configured `populateDepth`. Conformance: **Standard**.

**PRD-205-R13.** Populate depth defaults to **1**. Operators MAY set `populateDepth` between 0 and 4. Beyond 4, response sizes from Strapi tend to exceed practical build-time bounds; `populateDepth > 4` MUST cause `init` to reject. Conformance: **Standard**.

**PRD-205-R14.** Cycles in resolved relation graphs MUST be tolerated. The adapter detects cycles during resolution and stamps `metadata.reference_cycles: <count>` on the affected node. Per PRD-102-R20. Conformance: **Standard**.

#### Locale handling

**PRD-205-R15.** When the adapter's `locale` config is set AND Strapi's i18n plugin is configured server-side, the adapter MUST query each configured locale separately (Strapi's `?locale=<locale>` parameter) and MUST emit `metadata.locale` on every emitted node. Strapi i18n produces sibling entities per locale that share a `localizations` reference array; the adapter MUST emit one ACT node per locale entity and MUST stamp `metadata.translations: [{ locale, id }, ...]` linking to sibling-locale entities — the partial-emission shape PRD-207 (i18n adapter) cooperates with via the merge step. Conformance: **Plus**.

#### Incremental rebuilds

**PRD-205-R16.** The adapter MUST implement `delta(since: string, ctx)` per PRD-200-R9. The `since` marker is an RFC 3339 timestamp. The adapter MUST query each configured content type with a Strapi filter `?filters[updatedAt][$gt]=<since>` and yield matching entities. The adapter MUST persist the new marker (the latest `updatedAt` observed) via `ctx.config.deltaMarkerSink` on `dispose`. Conformance: **Standard**.

**PRD-205-R17.** When the generator wires Strapi webhooks, the adapter MUST expose `verifyWebhookSignature(body, signature, secret)` validating Strapi's HMAC-SHA256 webhook signature (Strapi sends the signature in the `Strapi-Signature` header when a webhook secret is configured server-side). The webhook-receiver implementation is the generator's concern. Conformance: **Standard**.

#### Capability declaration

**PRD-205-R18.** The adapter's `init` MUST return an `AdapterCapabilities`:

```ts
{
  level: "standard" | "plus",
  concurrency_max: 4,
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

**PRD-205-R19.** The adapter MUST declare `level: "standard"` when no `componentMapping` AND no `locale` config are set. Conformance: **Standard**.

**PRD-205-R20.** The adapter MUST declare `level: "plus"` when EITHER `componentMapping` is configured OR `locale` config is set. Conformance: **Plus**.

#### Failure modes

**PRD-205-R21.** Strapi rate-limit responses (HTTP 429) MUST be handled by exponential backoff with at least 3 retries (250ms, 500ms, 1000ms). Persistent failure MUST cause the affected entity to be emitted as a partial node per PRD-205-R23. Conformance: **Standard**.

**PRD-205-R22.** Authentication failure (HTTP 401 or 403 from any API request, or `init`-time validation failure) MUST cause `init` to reject with an unrecoverable error per PRD-200-R18. The error message MUST cite that authentication failed and MUST NOT include the token. A 404 on a configured content type also unrecoverable (a misconfigured content type is operator-error and silent skipping is forbidden per PRD-200-R16 / R18). Conformance: **Core**.

**PRD-205-R23.** Item-level extraction failures (markdown parse error in split mode, unresolvable relation within configured depth, malformed dynamic-zone instance) MUST cause the adapter to emit a partial node with `metadata.extraction_status: "partial"` and `metadata.extraction_error`. The build MUST NOT exit non-zero. Conformance: **Standard**.

#### Security

**PRD-205-R24.** The adapter MUST NOT log the value of `apiToken` at any log level. The adapter SHOULD emit a build warning when `baseUrl` uses the `http://` scheme (rather than `https://`), citing PRD-109's transport-trust posture. The warning MUST include the configured base URL host but MUST NOT include the token. Cites PRD-109-R14 / R15. Conformance: **Core**.

**PRD-205-R25.** The adapter MUST NOT emit the API token (or any prefix longer than 4 characters) into any envelope field. Cites PRD-109-R1, R2, R14. Conformance: **Core**.

#### Provenance

**PRD-205-R26.** The Strapi-specific `source_id` (used in `metadata.source.source_id`) MUST be the Strapi entity's `documentId` (v5) when present, falling back to the numeric `id` (v4) prefixed with `"v4:"` to disambiguate v4 vs v5 source IDs in mixed-source builds. Example v5: `"abc12345-doc-id"`. Example v4: `"v4:42"`. Conformance: **Standard**.

#### Version pinning

**PRD-205-R27.** Per PRD-200-R25 (Stage 1), `act-strapi@0.1.x` emits `act_version: "0.1"` only. Stage 2 migration is per-package opt-in. Conformance: **Core**.

#### Test fixtures

**PRD-205-R28.** The adapter MUST pass the framework conformance corpus per PRD-200-R28 AND the Strapi-specific corpus enumerated in §"Test fixtures." Conformance: **Core**.

### Wire format / interface definition

PRD-205 introduces no new wire format.

#### Configuration schema (TypeScript)

```ts
import type { Adapter } from "@act/adapter-framework";

export interface StrapiConfig {
  baseUrl: string;
  apiToken: string;
  contentTypes: string[];   // plural identifiers, e.g., ["articles", "tutorials"]
  strapiVersion?: "v4" | "v5";
  transport?: "rest" | "graphql";
  graphqlEndpoint?: string;
  graphqlQuery?: string;    // operator-supplied when transport: "graphql"
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
  parseMarkdown?: boolean;     // default false
  populateDepth?: number;      // 0–4; default 1
  componentMapping?: Record<string, { type: `marketing:${string}`; fields: Record<string, string> }>;
  dynamicZoneMax?: number;     // 1–3; default 3
  locale?: { locales: string[]; defaultLocale: string };
  summary?: { strategy: "field" | "extract" | "needs-llm" };
  webhookSecret?: string;
  allowEmpty?: boolean;
}

export type StrapiAdapter = Adapter<StrapiConfig, StrapiEntity>;

export function verifyWebhookSignature(body: string, signature: string, secret: string): boolean;
```

### Errors

| Condition | Adapter behavior | Framework behavior | Exit code |
|---|---|---|---|
| `init` config validation failure | Reject from `init` | Build error | non-zero |
| `init` HTTP 401 / 403 | Reject from `init` per R22 | Build error; token redacted | non-zero |
| `init` 404 on configured content type | Reject from `init` per R22 / R5 | Build error citing missing type | non-zero |
| `init` v4/v5 server mismatch | Warn; continue | Warning | 0 |
| `init` `populateDepth > 4` | Reject from `init` per R13 | Build error | non-zero |
| `init` `dynamicZoneMax > 3` | Reject from `init` per R10 | Build error | non-zero |
| `init` `baseUrl` uses `http://` | Warn; continue per R24 | Warning | 0 |
| `enumerate` zero entities, `allowEmpty != true` | Continue + warn per R6 | Warning | 0 |
| `transform` HTTP 429, retries exhausted | Emit partial per R21 / R23 | Warning | 0 |
| `transform` markdown parse error in split mode | Emit partial per R9 / R23 | Warning | 0 |
| `transform` dynamic-zone exceeds R10 bound | Emit partial per R10 / R23 | Warning | 0 |
| `transform` cycle detected | Tolerate; stamp `metadata.reference_cycles` | No warning | 0 |
| Adapter emits malformed `id` | n/a (framework rejects) | Build error per PRD-100-R10 | non-zero |
| Webhook signature invalid | `verifyWebhookSignature` returns false | Generator's concern | n/a |

---

## Examples

### Example 1 — Standard configuration (REST, v5, no locale)

```ts
export const strapiConfig: StrapiConfig = {
  baseUrl: "https://cms.acme.example",
  apiToken: process.env.STRAPI_API_TOKEN!,
  contentTypes: ["articles", "tutorials", "concepts"],
  strapiVersion: "v5",
  fieldMapping: {
    title:   "title",
    summary: "summary",
    body:    "body",
    related: { related_articles: "see-also", category: "see-also" }
  },
  populateDepth: 1
};
```

Adapter declares `level: "standard"`. Emitted nodes carry a single `markdown` block (default `parseMarkdown: false`); relation fields become `related[]`.

### Example 2 — Plus configuration (split markdown + components + locale)

```ts
export const strapiConfig: StrapiConfig = {
  baseUrl: "https://cms.acme.example",
  apiToken: process.env.STRAPI_API_TOKEN!,
  contentTypes: ["landing-pages", "articles"],
  strapiVersion: "v5",
  parseMarkdown: true,
  locale: { locales: ["en", "de", "fr"], defaultLocale: "en" },
  componentMapping: {
    "shared.hero":            { type: "marketing:hero",         fields: { headline: "title", subhead: "subtitle", cta: { label: "ctaLabel", href: "ctaHref" } } },
    "marketing.pricing-table":{ type: "marketing:pricing-table",fields: { tiers: "tiers[].{name, price, features}" } }
  },
  webhookSecret: process.env.STRAPI_WEBHOOK_SECRET!
};
```

Adapter declares `level: "plus"`. Emitted nodes split markdown into `prose` / `code` / `callout` blocks; landing pages embed `marketing:hero` + `marketing:pricing-table`; per-locale variants stamp `metadata.locale` and `metadata.translations`.

### Example 3 — Emitted Standard-level node (default markdown body)

```json
{
  "act_version": "0.1",
  "id": "act-strapi/articles/installing-acme",
  "type": "article",
  "title": "Installing Acme",
  "summary": "How to install the Acme SDK and get started.",
  "summary_source": "author",
  "content": [
    {
      "type": "markdown",
      "text": "# Installing Acme\n\nFirst, install the SDK:\n\n```bash\nnpm install @acme/sdk\n```\n\n> **Note:** Node 18+ is required.\n\nNext, configure your environment..."
    }
  ],
  "tokens": { "summary": 11, "body": 460 },
  "etag": "<computed by generator>",
  "related": [
    { "id": "act-strapi/concepts/authentication", "relation": "see-also" }
  ],
  "updated_at": "2026-04-22T08:15:00Z",
  "metadata": {
    "tags": ["sdk", "installation"],
    "source": { "adapter": "act-strapi", "source_id": "abc12345-doc-id" }
  }
}
```

### Example 4 — Standard with `parseMarkdown: true` (split blocks)

```json
{
  "act_version": "0.1",
  "id": "act-strapi/articles/installing-acme",
  "type": "article",
  "title": "Installing Acme",
  "summary": "How to install the Acme SDK and get started.",
  "summary_source": "author",
  "content": [
    { "type": "prose", "format": "markdown", "text": "# Installing Acme\n\nFirst, install the SDK:" },
    { "type": "code",  "language": "bash", "text": "npm install @acme/sdk" },
    { "type": "callout", "level": "info", "text": "Node 18+ is required." },
    { "type": "prose", "format": "markdown", "text": "Next, configure your environment..." }
  ],
  "tokens": { "summary": 11, "body": 460 },
  "etag": "<computed by generator>",
  "metadata": { "source": { "adapter": "act-strapi", "source_id": "abc12345-doc-id" } }
}
```

### Example 5 — Plus emission with `marketing:hero` from a dynamic zone

```json
{
  "act_version": "0.1",
  "id": "act-strapi/landing-pages/pricing",
  "type": "landing",
  "title": "Pricing",
  "summary": "Acme pricing tiers.",
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
  "tokens": { "summary": 6, "body": 280 },
  "etag": "<computed by generator>",
  "metadata": {
    "locale": "en",
    "translations": [
      { "locale": "de", "id": "act-strapi/landing-pages/pricing@de" },
      { "locale": "fr", "id": "act-strapi/landing-pages/pricing@fr" }
    ],
    "source": { "adapter": "act-strapi", "source_id": "landing-pricing-doc-id" }
  }
}
```

### Example 6 — Lifecycle webhook receiver wiring

```ts
import { verifyWebhookSignature } from "@act/strapi-adapter";

// In the generator's webhook receiver:
app.post("/webhooks/strapi", async (req, res) => {
  const ok = verifyWebhookSignature(req.rawBody, req.headers["strapi-signature"], process.env.STRAPI_WEBHOOK_SECRET!);
  if (!ok) return res.status(401).end();
  // ... trigger an incremental rebuild via the adapter's delta() path.
});
```

---

## Test fixtures

Fixtures live under `fixtures/205/`.

### Positive

- `fixtures/205/positive/standard-emission-v5-rest.json` → R1, R2, R3, R4, R5, R7, R8, R9 (default), R12, R18, R19, R26.
- `fixtures/205/positive/standard-emission-v4-rest.json` → R3 (v4 envelope handling) + the rest.
- `fixtures/205/positive/standard-emission-graphql.json` → R4 (`transport: "graphql"`).
- `fixtures/205/positive/parse-markdown-split.json` → R9 split mode with `prose` / `code` / `callout`.
- `fixtures/205/positive/plus-emission-with-locale.json` → R15, R20 with `metadata.locale` + `metadata.translations`.
- `fixtures/205/positive/plus-emission-with-component-mapping.json` → R11, R20 with `marketing:hero` + `marketing:pricing-table`.
- `fixtures/205/positive/dynamic-zone-depth-2.json` → R10 (depth 2, no warning).
- `fixtures/205/positive/relation-resolution-depth-1.json` → R12, R13.
- `fixtures/205/positive/relation-cycle-tolerated.json` → R14 with `metadata.reference_cycles: 1`.
- `fixtures/205/positive/delta-incremental.json` → R16 with `updatedAt` marker.
- `fixtures/205/positive/concurrency-limited-to-4.json` → R18.
- `fixtures/205/positive/webhook-signature-valid.json` → R17 with valid HMAC.
- `fixtures/205/positive/idfield-slug-default.json` → R8 default (`slug` over `documentId`).
- `fixtures/205/positive/idfield-documentid-fallback.json` → R8 fallback when `slug` absent.
- `fixtures/205/positive/summary-extracted-fallback.json` → R8 with `summary_source: "extracted"`.
- `fixtures/205/positive/empty-filter-allowed.json` → R6 with `allowEmpty: true`, no warning.

### Negative

- `fixtures/205/negative/init-missing-baseurl.expected.json` → R2.
- `fixtures/205/negative/init-auth-failed.expected.json` → R22; token redacted.
- `fixtures/205/negative/init-content-type-not-found.expected.json` → R5 / R22 (404 on configured content type).
- `fixtures/205/negative/init-populate-depth-exceeds-4.expected.json` → R13.
- `fixtures/205/negative/init-dynamic-zone-max-exceeds-3.expected.json` → R10.
- `fixtures/205/negative/init-http-baseurl-warns.expected.json` → R24 transport warning.
- `fixtures/205/negative/init-v4-vs-v5-mismatch.expected.json` → R3 server-version warning.
- `fixtures/205/negative/init-populate-star-rejected.expected.json` → R4 (operator passes `populate=*`); rejected.
- `fixtures/205/negative/empty-filter-default-warns.expected.json` → R6.
- `fixtures/205/negative/markdown-parse-error.expected.json` → R9 / R23 (split mode encounters malformed markdown).
- `fixtures/205/negative/dynamic-zone-bound-exceeded.expected.json` → R10 / R23 partial node emitted.
- `fixtures/205/negative/rate-limit-exhausted.expected.json` → R21 / R23.
- `fixtures/205/negative/token-in-log.expected.json` → R24 violation detected.
- `fixtures/205/negative/token-in-envelope.expected.json` → R25 violation detected.
- `fixtures/205/negative/component-mapping-malformed.expected.json` → component reference missing required marketing-block fields → partial.
- `fixtures/205/negative/version-pinning-stage-1-mismatch.expected.json` → R27.
- `fixtures/205/negative/webhook-signature-invalid.expected.json` → R17 returns false.
- `fixtures/205/negative/locale-without-i18n-plugin.expected.json` → R15 (locale config without server-side plugin) → init rejects.

---

## Versioning & compatibility

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add an optional field to `StrapiConfig` | MINOR | PRD-108-R4(1). |
| Add a value to `strapiVersion` enum (e.g., `"v6"`) | MAJOR | Closed enum; PRD-108-R5(4). |
| Add a value to `transport` enum | MAJOR | Same. |
| Add new markdown-split rules (e.g., recognize `> [!warning]` as callout) | MINOR | New optional rule. |
| Add a new `componentMapping` target type within `marketing:*` | MINOR | PRD-102-R6 (open namespace). |
| Tighten `populateDepth` cap from 4 to 2 | MAJOR | PRD-108-R5(6). |
| Loosen `populateDepth` cap from 4 to 6 | MAJOR | Same. |
| Tighten `dynamicZoneMax` cap below 3 | MAJOR | Same. |
| Change default `parseMarkdown` from `false` to `true` | MAJOR | PRD-108-R5(2) — changes default emission shape. |
| Change `metadata.source.source_id` formula | MAJOR | Provenance grammar change. |
| Change webhook signature algorithm | MAJOR | Security-relevant; PRD-108-R5(2) + PRD-109. |
| Promote Stage 2 pinning opt-in | MINOR | Per PRD-200-R26. |
| Editorial / prose clarification | n/a | Per `000-governance` R18. |

### Forward compatibility

Generators implementing PRD-205 v0.1 MUST tolerate unknown optional fields per PRD-108-R7. Adapter MUST NOT emit blocks outside its declared `level` per PRD-200-R24.

### Backward compatibility

`act-strapi@0.1.x` emits `act_version: "0.1"` only. Future MINOR bumps require coordinated release per PRD-200-R25.

---

## Security considerations

Cites PRD-109 for the project-wide threat model. Strapi-specific deltas:

**Token handling (T2, T5).** Strapi API tokens are scoped (`Read-only`, `Full-access`, custom). Operators SHOULD use a `Read-only` token for the adapter. PRD-205-R24 / R25 prohibit logging or emitting tokens.

**Self-hosted transport trust (T6 / informational).** Operators may configure `baseUrl` with `http://` for local-dev or behind-VPN deployments. PRD-205-R24 emits a build warning when this happens — not an error, because legitimate dev deployments exist, but a clear signal to migrate to HTTPS for production. The adapter does NOT enforce HTTPS; that decision belongs to the operator.

**Webhook signature verification.** Strapi sends the `Strapi-Signature` header (HMAC-SHA256 over the request body) when a webhook secret is configured server-side. PRD-205-R17 exposes `verifyWebhookSignature` for generator-side receivers. An unauthenticated webhook receiver is a content-defacement vector.

**`populate=*` is a DoS lever.** Strapi's `populate=*` shortcut produces unbounded response sizes for content types with many relations. PRD-205-R4 forbids it; the adapter computes a precise populate string from configured field mappings. A misconfigured operator who bypasses the adapter and queries Strapi directly with `populate=*` is outside the adapter's control, but the adapter MUST NOT emit such a query itself.

**Dynamic-zone recursion bound.** PRD-205-R10 caps depth at 3 to prevent operator-side mistakes from blowing up walker memory.

**Cycles in relations.** Tolerated per PRD-205-R14 / PRD-102-R20. Default `populateDepth: 1` is the primary control.

**Strapi version mismatch (informational).** v4 vs v5 envelope-shape divergence is a common operational issue. PRD-205-R3 warns on mismatch detected at `init` time.

**Draft-mode leakage.** Strapi's "Draft & Publish" feature exposes `publicationState=preview` for draft content. The adapter does NOT support `publicationState=preview` in v0.1 — only published content is fetched. Operators wanting draft content must use a separate adapter run with a token scoped to draft access; that run MUST stamp `metadata.preview: true` (forward-compat with Sanity/Storyblok semantics; the v0.1 default is `metadata.preview: false`).

For all other concerns, cite PRD-109 directly.

---

## Implementation notes

### Snippet 1 — The adapter's `init`

```ts
// packages/strapi-adapter/src/index.ts
import type { Adapter, AdapterCapabilities } from "@act/adapter-framework";
import type { StrapiConfig, StrapiEntity } from "./types.js";

export const strapiAdapter: Adapter<StrapiConfig, StrapiEntity> = {
  name: "act-strapi",

  async init(config, ctx): Promise<AdapterCapabilities> {
    validateConfig(config);  // PRD-205-R2
    if (config.populateDepth !== undefined && (config.populateDepth < 0 || config.populateDepth > 4)) {
      throw new AdapterError({ code: "config_invalid", message: "populateDepth must be 0–4" });
    }
    if (config.dynamicZoneMax !== undefined && (config.dynamicZoneMax < 1 || config.dynamicZoneMax > 3)) {
      throw new AdapterError({ code: "config_invalid", message: "dynamicZoneMax must be 1–3" });
    }
    if (config.baseUrl.startsWith("http://")) {
      ctx.logger.warn("strapi adapter: baseUrl uses http:// — production deployments SHOULD use https://", {
        host: new URL(config.baseUrl).host,
      });
    }
    await verifyAuth(config);  // throws on 401/403 → PRD-205-R22
    await probeContentTypes(config);  // throws on 404 → PRD-205-R5
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
  // ...
};
```

### Snippet 2 — Computing a precise populate string (PRD-205-R4)

```ts
function buildPopulateString(config: StrapiConfig, contentType: string): string {
  const populate: Record<string, unknown> = {};
  // Relation fields → populate at depth 1, recursively up to populateDepth
  for (const fieldName of Object.keys(config.fieldMapping?.related ?? {})) {
    populate[fieldName] = { populate: "*" };  // shallow at depth 1; deeper handled via populateDepth recursion below
  }
  // Component / dynamic-zone fields → populate to the configured depth
  if (config.componentMapping) {
    populate["body"] = { populate: "*" };  // body holds dynamic zones in the typical schema
  }
  return `populate=${encodeURIComponent(JSON.stringify(populate))}`;
}
```

The function never emits `populate=*` — every field is named explicitly.

### Snippet 3 — Markdown body emission (PRD-205-R9, default vs split)

```ts
import { fromMarkdown } from "mdast-util-from-markdown";
import type { ContentBlock } from "@act/wire-format";

export function emitBody(markdown: string, config: StrapiConfig): ContentBlock[] {
  if (!config.parseMarkdown) {
    return [{ type: "markdown", text: markdown }];  // PRD-205-R9 default
  }
  // Split mode: walk the mdast and emit prose/code/callout blocks
  const tree = fromMarkdown(markdown);
  return walkMdast(tree);  // see Snippet 4
}
```

### Snippet 4 — Markdown walk → ACT blocks (split mode, PRD-205-R9)

```ts
function walkMdast(tree: { children: any[] }): ContentBlock[] {
  const out: ContentBlock[] = [];
  let proseBuf: string[] = [];
  const flushProse = () => {
    if (proseBuf.length) {
      out.push({ type: "prose", format: "markdown", text: proseBuf.join("\n\n") });
      proseBuf = [];
    }
  };
  for (const node of tree.children) {
    if (node.type === "code") {
      flushProse();
      out.push({ type: "code", language: node.lang ?? "text", text: node.value });
    } else if (node.type === "blockquote" && isAdmonition(node)) {
      flushProse();
      out.push({ type: "callout", level: admonitionLevel(node), text: admonitionText(node) });
    } else {
      proseBuf.push(stringifyMdast(node));  // headings, paragraphs, lists, hr, image
    }
  }
  flushProse();
  return out;
}
```

### Snippet 5 — Webhook signature verification (PRD-205-R17)

```ts
// packages/strapi-adapter/src/webhook.ts
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

### Snippet 6 — Failure-emission shape (PRD-205-R23)

```ts
function assemblePartialNode(args: {
  entity: StrapiEntity;
  error: unknown;
  config: StrapiConfig;
  ctx: AdapterContext;
}): EmittedNode {
  return {
    act_version: args.ctx.config.actVersion as string,
    id:    resolveId(args.entity, args.config),
    type:  args.config.typeMapping?.[args.entity.__contentType] ?? args.entity.__contentType,
    title: extractTitle(args.entity, args.config) ?? "(untitled)",
    summary: extractSummary(args.entity, args.config) ?? "Content could not be extracted.",
    content: [],
    tokens:  { summary: 8, body: 0 },
    etag:    "",
    metadata: {
      extraction_status: "partial",
      extraction_error:  String(args.error).slice(0, 200),
    },
  };
}
```

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft. Implements the parent PRD-200 contract for Strapi REST (default) and GraphQL (configurable). Configuration (baseUrl / token / contentTypes / strapiVersion / transport / typeMapping / fieldMapping / componentMapping / locale); markdown body emission — single `markdown` block by default (PRD-102-R1), optional `parseMarkdown: true` split into `prose` / `code` / `callout` blocks (Standard); dynamic-zone components → `marketing:*` (Plus) when configured; relation resolution with default `populateDepth: 1`, max 4; cycle tolerance per PRD-102-R20; locale handling cooperating with PRD-207 via merge; incremental rebuild via Strapi `updatedAt` delta marker + lifecycle webhook signature verification (HMAC-SHA256). v4 vs v5 envelope shapes handled. `populate=*` forbidden to bound response size. `http://` baseUrl warning. Conformance: Standard by default; Plus when `componentMapping` OR `locale` is configured. Token never logged or emitted into envelopes per PRD-109. Status: In review. |
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review; no normative changes. Decisions: (1) single types emit as separate ACT nodes when listed in `contentTypes`; (2) Strapi v5 `documentId` is preferred with v4 numeric `id` fallback for unified `source_id`; (3) `transport: "rest" | "graphql"` is configurable, default REST. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
