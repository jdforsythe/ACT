# PRD-100 — Wire format & envelope shapes (manifest, index, node, subtree, error)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

The v0.1 working draft (`docs/plan/v0.1-draft.md` §5.1–§5.9, §5.13, §11) describes the ACT wire format in prose plus a partial JSON Schema fragment, but the envelope shapes are scattered, inconsistent in places, and missing several fields that gap analysis (`prd/000-gaps-and-resolutions.md` A1–A5, B5, C2, C4, E2–E5, E7, E8) flagged as foundational. Specifically: the manifest's `capabilities` is sketched as an array even though PRD-107 already pins per-capability boolean flags; the error envelope (gap A4) is unwritten; the `id` grammar (gap A3) is referenced but not defined; cycles, ID stability, summary length, max body, ID overrides, summary source, and versioned trees (gaps E2–E5, E7, E8, C4) all sit as resolved-in-prose-only items that need to land in normative schema. Until those shapes are pinned, every other 100-, 200-, and 500-series PRD has to relitigate the wire surface, and PRD-600 (validator) cannot ship a stable test corpus.

### Goals

1. Define the exact JSON shape of each canonical envelope: manifest, index (JSON + NDJSON variant), node, subtree, error.
2. Reconcile the v0.1-draft `capabilities: array` form with PRD-107's per-capability flags by adopting a structured object with documented keys, and document the migration in this PRD's changelog.
3. Pin the ID grammar (gap A3) and the percent-encoding rule for substituting IDs into URL templates.
4. Pin the closed-enum `error.code` set (gap A4) and the open structure of `error.details`.
5. Pin the `summary_source` open enum (gap E5), the summary length guidance (gap E8), the max-body guidance (gap E4), the `children`-cycle prohibition (gap E3), the runtime ID-stability rule (gap C4), the ID-override precedence rule (gap E7), and a brief note on versioned trees (gap E2).
6. Cite PRD-103 (sibling, owned by gap C2) for the full ETag derivation; only lock the field shape and the stable-input constraint here.
7. Pin the canonical core block types and the open `marketing:*` namespace, and require consumers to tolerate unknown block types (PRD-108-R7).
8. Pin file extensions and provisional MIME types (gap B5, decision Q2) so PRD-101 and PRD-803 can land cleanly.
9. Ship inline JSON Schemas plus canonical schema files under `schemas/100/` and positive/negative fixtures under `fixtures/100/`.

### Non-goals

1. **Conformance level definitions.** Owned by PRD-107 (Accepted). This PRD references the level rules and ensures the manifest fields PRD-107 pins (`conformance.level`, `delivery`, `mounts`) appear verbatim.
2. **Versioning policy.** Owned by PRD-108 (Accepted). This PRD only carries the `act_version` field shape PRD-108 pinned and applies it to every envelope.
3. **Discovery hand-off.** Owned by PRD-101 (in flight, gap A5). The well-known location is referenced; the link/header signaling is not specified here.
4. **ETag derivation recipe.** Owned by PRD-103 (in flight, gap C2). This PRD locks the field shape and requires stable-input behavior; the canonical hash recipe lives in PRD-103.
5. **Static / runtime endpoint behavior.** Owned by PRD-105 (static) and PRD-106 (runtime). Gap A4's HTTP status mapping lives there.
6. **Search envelope.** The manifest field `search_url_template` is pinned here; the search response envelope is owned by the in-flight Plus-tier search PRD (topic: search response shape) and is intentionally out of scope for v0.1 normative text in this PRD.
7. **i18n manifest extensions.** Owned by the in-flight i18n PRD (topic: locales block). This PRD permits but does not require the `locales` block.
8. **MIME registration.** Owned by PRD-803. This PRD assigns provisional MIME types per gap B5; IANA registration is downstream.
9. **Project-wide security posture.** Owned by PRD-109 (in flight). This PRD's security section is a placeholder threat model bounded to the wire surface.

### Stakeholders / audience

- **Authors of:** every other 100-series PRD; the 200-series adapter PRDs (envelope is the build output); the 500-series runtime SDK PRDs (envelope is the response shape); PRD-600 (validator parses these schemas).
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Capabilities object/array migration breaks existing draft consumers | Low | Medium | The v0.1 draft was never released; the array form was planning prose. Migration is a one-time clean break documented in this PRD's changelog. |
| ID grammar too restrictive (e.g., a real CMS slug fails the regex) | Medium | Medium | Grammar admits `[a-z0-9._\-/]` covering >95% of observed CMS slug spaces; producers SHOULD normalize on emission per gap A3. Override precedence (gap E7) lets authors fix edge cases. |
| Error envelope under-specified for `details` payload | Medium | Low | `details` is intentionally open per A4; per-code stable shape is producer-asserted. Closed top-level enum gives consumers the dispatch key they need. |
| Subtree depth bound becomes a DoS lever if too large or under-constrained | Low | Medium | Default depth 3, max 8; producer MUST set `depth` on every subtree response. Consumers SHOULD reject `depth > 8`. |
| Block-type taxonomy fragmenting because `marketing:*` namespace is open | Medium | Medium | Documented-open namespace per PRD-108-R4(4); validator warns on unrecognized types but does not error (PRD-108-R7). PRD-102 (in flight) will catalogue canonical block types per namespace. |
| Schema and fixture drift across the 100-series | Medium | Low | Canonical schemas live under `schemas/100/` and are referenced (not duplicated) by other PRDs. PRD-600 enforces fixture validity. |

### Open questions

1. Should the subtree envelope carry an explicit `truncated_children: [id, ...]` array listing IDs whose subtrees were elided at the depth bound, or is the boolean `truncated` flag sufficient? Tentative: boolean for v0.1; revisit if consumer telemetry shows demand.
2. Should `summary_source` add `"hybrid"` (LLM rewrite of authored summary) at v0.1 or wait for the worked `0.1 → 0.2` migration narrated in PRD-108? Tentative: wait. Open enum admits the addition as MINOR per PRD-108-R4(3).
3. Should the manifest's structured `capabilities` object reserve a `change_feed` flag at v0.1 even though streaming is deferred (gap F1)? Tentative: yes — reserving the key is cheap and prevents a future MAJOR. See schema.

### Acceptance criteria

- [ ] Every MUST has at least one positive and one negative fixture under `fixtures/100/`.
- [ ] All five JSON Schemas (`manifest`, `index`, `node`, `subtree`, `error`) ship under `schemas/100/` and validate against this PRD's worked examples.
- [ ] The PRD-107 `conformance` + `delivery` + `mounts` fields appear verbatim in the manifest schema.
- [ ] The PRD-108 `act_version` regex appears verbatim on every envelope schema.
- [ ] The ID grammar (gap A3) appears verbatim in a normative requirement and is enforced in the schemas.
- [ ] The `error.code` closed enum (gap A4) is enumerated and tested.
- [ ] The capabilities object/array migration is described in the Changelog.
- [ ] Conformance level (Core / Standard / Plus) is declared per requirement.
- [ ] Security section addresses the threat model items called out in the issue brief.
- [ ] Changelog entry dated 2026-05-01 is present.

---

## Context & dependencies

### Depends on

- **PRD-107** (Accepted) — conformance levels; this PRD ingests the `conformance.level` closed enum, the `delivery` closed enum, and the `mounts` shape verbatim.
- **PRD-108** (Accepted) — versioning policy; this PRD applies `act_version` on every envelope and inherits the MAJOR/MINOR classification rules.
- **000-governance** (Accepted) — lifecycle; this PRD follows R10/R11 transitions and uses R17 for in-place MINOR edits post-acceptance.
- External: [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174), [RFC 3339](https://www.rfc-editor.org/rfc/rfc3339) (timestamps), [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986) §3.3 (`pchar` for URL template substitution), [RFC 6570](https://www.rfc-editor.org/rfc/rfc6570) (URI templates — informational), [RFC 7464](https://www.rfc-editor.org/rfc/rfc7464) / NDJSON convention, [JSON Schema 2020-12](https://json-schema.org/draft/2020-12/release-notes).

### Blocks

- **PRD-101** (discovery hand-off, gap A5) — needs the manifest envelope shape and provisional MIME types.
- **PRD-102** (node taxonomy / disclosure / related — gaps E3, E5, E8) — extends the `type` enum and the block-type catalogue defined here.
- **PRD-103** (caching / ETag derivation — gap C2) — owns the ETag recipe; cites this PRD's `etag` field shape and the stable-input constraint.
- **PRD-104** (i18n locales block) — extends the manifest with the optional `locales` shape.
- **PRD-105** (static profile) and **PRD-106** (runtime profile) — apply the error envelope and HTTP status mapping (gap A4).
- **PRD-109** (security posture, in flight) — subsumes the threat model placeholder here.
- **PRD-200**-series (adapters) — emit envelopes per these schemas.
- **PRD-500**-series (runtime SDKs) — parse and serve envelopes per these schemas.
- **PRD-600** (validator) — exercises these schemas and fixtures.
- **PRD-803** (naming policy / IANA registration) — ratifies the provisional MIME types.

### References

- v0.1 draft: §4 (resolved decisions), §5.1 (overview), §5.3 (manifest), §5.4 (index), §5.5 (node format), §5.5.1 (required vs optional), §5.5.2 (content block types), §5.5.3 (`type` taxonomy), §5.6 (progressive disclosure), §5.7 (subtree envelope), §5.8 (caching field semantics — see PRD-103 for the recipe), §5.13 (runtime profile fields), §11 (reference JSON Schema fragment).
- `prd/000-gaps-and-resolutions.md` gaps **A1** (level fields, owned by PRD-107), **A2** (versioning, owned by PRD-108), **A3** (ID grammar, owned here), **A4** (error envelope, owned here for static/runtime structure), **A5** (discovery, owned by PRD-101), **B5** (MIME / extensions, owned by PRD-803 with provisional values pinned here), **C2** (ETag derivation, owned by PRD-103), **C4** (ID stability, owned here), **E2** (versioned trees, noted here), **E3** (cycles, owned here for `children`), **E4** (max body, owned here as guidance), **E5** (`summary_source` enum, owned here), **E7** (ID override precedence, owned here), **E8** (summary length, owned here as guidance).
- `prd/000-decisions-needed.md` Q2 (name + paths locked: `.act.json`, `/.well-known/act.json`, `application/act-*+json`), Q4 (license — affects spec/repo, not envelope content).
- Prior art: schema.org JSON-LD (closed core types + namespaced extensions), llms.txt (well-known discovery), sitemap.xml (index conventions), Atom (envelope-with-entries shape), MCP resource shapes (open metadata).

---

## Specification

This is the normative section. Every requirement uses RFC 2119 keywords as clarified by RFC 8174.

### Conformance level

Per PRD-107, requirements in this PRD are banded as follows. All envelope-shape rules that gate Core conformance (manifest, index, node, error) are **Core**. The subtree envelope and the optional Standard-tier node fields are **Standard**. The NDJSON index variant, the `marketing:*` block namespace, and the `search_url_template` advertisement are **Plus**.

- **Core:** PRD-100-R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R12, R13, R14, R15, R16, R17, R18, R19, R20, R21, R22, R23, R24, R25, R26, R27, R28, R29, R30, R31.
- **Standard:** PRD-100-R32, R33, R34, R35, R36.
- **Plus:** PRD-100-R37, R38, R39, R40.

PRD-100-R0 (the meta-rule that every envelope schema in this PRD is normative) applies at every level.

### Normative requirements

#### Meta

**PRD-100-R0.** The five JSON Schemas saved at `schemas/100/manifest.schema.json`, `schemas/100/index.schema.json`, `schemas/100/node.schema.json`, `schemas/100/subtree.schema.json`, and `schemas/100/error.schema.json` are normative. The inline schemas in §"Wire format / interface definition" below are reproductions for reading convenience. Where the inline schema and the file disagree, the file in `schemas/100/` is authoritative.

#### `act_version` on every envelope

**PRD-100-R1.** Every ACT envelope (manifest, index entry-set, NDJSON index line, node, subtree, error) MUST carry `act_version` at the top level of the envelope. The value MUST satisfy PRD-108-R2 — i.e., match `^[0-9]+\.[0-9]+$` — and MUST NOT carry a PATCH segment per PRD-108-R3.

**PRD-100-R2.** For the NDJSON index variant (Plus, PRD-100-R37), the envelope is the file as a whole; each line is one index entry and MUST NOT itself carry `act_version`. The file is identified as ACT NDJSON by its declared MIME type and the `index_ndjson_url` advertisement in the manifest.

#### Manifest envelope

**PRD-100-R3.** The manifest MUST be a JSON object satisfying `schemas/100/manifest.schema.json`. The static well-known location is `/.well-known/act.json`; the runtime profile uses the same path served as a JSON response (PRD-106 owns runtime details). File extension for static manifests is `.act.json`; the well-known file is `act.json` (no double extension), per gap B5.

**PRD-100-R4.** The manifest MUST include the following Core fields: `act_version`, `site.name`, `index_url`, `node_url_template`, `conformance.level`, `delivery`. The `conformance.level` and `delivery` field shapes are defined verbatim by PRD-107-R1 / PRD-107-R3 and reproduced inline below.

**PRD-100-R5.** The manifest's `node_url_template` MUST be a string containing the literal placeholder `{id}`. Substitution semantics are defined by PRD-100-R12 (ID percent-encoding).

**PRD-100-R6.** The manifest's `capabilities` field, when present, MUST be a JSON object with boolean (or sub-object) values keyed by capability name. The v0.1 draft's array form (`capabilities: ["subtree", "ndjson_index", "etag"]`) is NOT permitted at the wire layer. Documented capability keys at v0.1: `etag` (boolean), `subtree` (boolean), `ndjson_index` (boolean), `search` (object with `template_advertised: boolean`), `change_feed` (boolean, reserved). Unknown capability keys MUST be tolerated by consumers per PRD-108-R7. Adding a new capability key in a future MINOR is permitted per PRD-108-R4(5).

**PRD-100-R7.** The manifest's `mounts` field, when present, MUST satisfy the shape pinned by PRD-107-R5: an array of objects, each with `prefix` (string), `delivery` (`"static" | "runtime"`), `manifest_url` (URI reference), and an optional `conformance.level`. Hybrid sites use this field per gap C5 (full semantics owned by PRD-106).

**PRD-100-R8.** The manifest MAY include `generated_at` (RFC 3339 timestamp), `generator` (string), `index_ndjson_url` (URI reference), `subtree_url_template` (URI template containing `{id}`), `search_url_template` (URI template containing `{query}`), `root_id` (string conforming to the ID grammar), `stats` (object), `policy` (object), and `site.{description, canonical_url, locale, license}`. Field semantics follow draft §5.3.

**PRD-100-R9.** The manifest MUST NOT introduce required fields beyond those listed in PRD-100-R4 and PRD-107. Adding a new required field in a future revision is MAJOR per PRD-108-R5(1); adding a new optional field is MINOR per PRD-108-R4(1).

#### ID grammar

**PRD-100-R10.** Every node `id`, every `parent` value, every `children[]` entry, every `related[]` entry, and the manifest's `root_id` MUST match the grammar `^[a-z0-9]([a-z0-9._\-]|/)*[a-z0-9]$`. Lowercase ASCII alphanumeric, dot, underscore, hyphen, and slash; first and last characters MUST be alphanumeric. (Single-character IDs are not permitted because the regex requires both anchors.)

**PRD-100-R11.** Every node `id` MUST be at most 256 bytes encoded as UTF-8. (Because the grammar admits only ASCII characters, byte length equals character length here; the explicit byte bound future-proofs against any extension that admits non-ASCII.)

**PRD-100-R12.** When substituting an `id` into a URL template (`node_url_template`, `subtree_url_template`), each path segment between `/` characters MUST be percent-encoded per RFC 3986 §3.3 (`pchar`). The `/` characters between segments MUST be preserved verbatim. Producers and consumers MUST agree on this encoding so that a single ID maps to a single URL.

**PRD-100-R13.** Two IDs that differ only in case are not the same ID. The grammar already excludes uppercase, so adapters MUST normalize on emission. (Cited from gap A3.)

**PRD-100-R14.** Adapter ID-strategy precedence: an explicit per-node override (e.g., frontmatter `id:` for a markdown adapter) MUST win over an adapter configuration rule, which MUST win over the adapter's default strategy. (Cited from gap E7.)

**PRD-100-R15.** Runtime IDs MUST be stable for a given `(resource, identity, tenant)` triple across the lifetime of that resource. Producers MUST NOT mint per-request-unique IDs. Identity rotation (token refresh) MUST NOT change IDs as long as the underlying principal is the same. (Cited from gap C4.)

#### Index envelope

**PRD-100-R16.** The index MUST be a JSON object satisfying `schemas/100/index.schema.json`. It MUST include `act_version` and `nodes` (an array). It MAY include `generated_at` and `etag`.

**PRD-100-R17.** Each entry of `nodes` MUST include `id`, `type`, `title`, `summary`, `tokens.summary`, and `etag`. It MAY include `path`, `tokens.abstract`, `tokens.body`, `updated_at`, `parent`, `children`, and `tags`.

**PRD-100-R18.** The index MUST NOT contain full `content` arrays. Index entries are summary-level metadata only. The full body lives behind `node_url_template`.

**PRD-100-R19.** The `summary` field on every index entry MUST be a non-empty string. (PRD-107-R6 already requires this at Core; PRD-100 restates because the wire schema is the enforcement point.)

**PRD-100-R20.** Index entries' `summary` SHOULD be ≤ 50 tokens (using the producer's declared tokenizer). Validators MUST emit a warning when summary tokens exceed 100; this is non-normative guidance per gap E8 and not an error.

#### Node envelope

**PRD-100-R21.** A node MUST be a JSON object satisfying `schemas/100/node.schema.json`. It MUST include `act_version`, `id`, `type`, `title`, `etag`, `summary`, `content`, and `tokens`.

**PRD-100-R22.** A node MAY include `updated_at`, `abstract`, `summary_source`, `parent`, `children`, `related`, `source` (with `human_url` and `edit_url`), and `metadata` (open object).

**PRD-100-R23.** A node's `summary_source` field, when present, MUST be a string. The well-known values at v0.1 are `"llm"`, `"author"`, `"extracted"`. The enum is **open** per gap E5; adding values is MINOR per PRD-108-R4(3).

**PRD-100-R24.** A node's `parent` MUST either be omitted, be `null`, or be a valid ID per PRD-100-R10. A node's `children[]`, when present, MUST contain only valid IDs.

**PRD-100-R25.** Cycles MUST NOT exist in the `children` graph. A producer MUST NOT emit a node whose `children` (transitively) reach back to itself. Validators MUST treat a `children`-cycle as a hard error. (Cited from gap E3.)

**PRD-100-R26.** Cycles MAY exist in the `related` graph. `related` is a soft cross-reference list and is permitted to be non-acyclic. (Cited from gap E3.)

**PRD-100-R27.** Producers SHOULD split nodes whose `tokens.body` exceeds 10000. Validators MUST emit a warning above 10000 and MUST NOT emit an error; there is no hard cap. (Cited from gap E4.)

#### Content blocks

**PRD-100-R28.** Each entry of `content[]` MUST be a JSON object with a `type` discriminator string. Additional fields are block-type-specific.

**PRD-100-R29.** The canonical core block-type values at v0.1 are: `markdown`, `prose`, `code`, `data`, `callout`. (PRD-102 catalogues per-type field shapes; this PRD pins only the type-string set required for Core/Standard interop.) The `core:*` namespace is reserved and **closed**; adding values to it is MAJOR per PRD-108-R5(4).

**PRD-100-R30.** Block types in the `marketing:*` namespace are **documented-open** and are Plus-tier only at v0.1. Producers at any level MAY emit unknown block types; consumers at any level MUST tolerate unknown block types per PRD-108-R7 (i.e., MUST NOT reject the envelope), and SHOULD treat the block as opaque structured payload (extracting any embedded `text`, `headline`, or `prose` fields where possible).

**PRD-100-R31.** A consumer MUST NOT crash, drop the enclosing node, or surface an error to the application solely because of an unrecognized block type. Degradation is graceful by construction.

#### Subtree envelope (Standard)

**PRD-100-R32.** A subtree MUST be a JSON object satisfying `schemas/100/subtree.schema.json`. It MUST include `act_version`, `root` (the root node ID), `etag`, `depth`, and `nodes` (an array of full node envelopes).

**PRD-100-R33.** `depth` is the number of generations included below `root`. `depth: 0` means the array contains only the root node. `depth: 1` means root plus immediate children. The default depth, when the consumer does not specify, MUST be `3`. The maximum depth a producer may serve in a single subtree response MUST be `8`.

**PRD-100-R34.** When the producer truncates the subtree at the documented maximum depth, the response MUST include `truncated: true`. When the response is complete (no descendants beyond `depth` were elided), `truncated` MAY be omitted or set to `false`.

**PRD-100-R35.** The `nodes[]` array MUST be ordered depth-first pre-order with the root first. Each entry MUST be a complete node envelope satisfying PRD-100-R21. Consumers MUST NOT assume the `nodes[]` array contains exactly `2^depth - 1` entries — actual cardinality depends on the source tree's branching.

**PRD-100-R36.** Producers MAY refuse to serve a subtree whose total `tokens.body` would exceed an implementation-defined limit. In that case the producer MUST respond with an error envelope (PRD-100-R41) carrying `error.code: "validation"` and a `details.reason` explaining the truncation; this is the only documented use of the `validation` error code at this layer.

#### NDJSON index, search advertisement (Plus)

**PRD-100-R37.** When the manifest advertises `index_ndjson_url`, the file at that URL MUST be NDJSON (one JSON object per line, separated by `\n`). Each line MUST match the index-entry schema in `schemas/100/index.schema.json#/$defs/IndexEntry`. The NDJSON file as a whole MUST NOT carry an outer `act_version` or `nodes` wrapper — those live on the JSON variant.

**PRD-100-R38.** The MIME type for the NDJSON variant is `application/act-index+json` with the `profile=ndjson` parameter (provisional, per gap B5).

**PRD-100-R39.** When the manifest advertises `search_url_template`, the template MUST contain the literal placeholder `{query}`. The search response envelope is owned by the in-flight search PRD; this PRD locks only the template advertisement and the Plus-tier band per PRD-107-R10.

**PRD-100-R40.** Block types in the `marketing:*` namespace are Plus-tier per PRD-107-R10. A Core- or Standard-declared producer MAY emit them but consumers MUST NOT infer level promotion from their presence (PRD-107-R14 / PRD-107-R15).

#### Error envelope

**PRD-100-R41.** Runtime endpoints (per PRD-106) that respond with HTTP 4xx or 5xx MUST emit a JSON body satisfying `schemas/100/error.schema.json`. The envelope's `error.code` MUST be one of the closed enum: `"auth_required"`, `"not_found"`, `"rate_limited"`, `"internal"`, `"validation"`. Adding a value to this enum is MAJOR per PRD-108-R5(4).

**PRD-100-R42.** `error.message` MUST be a human-readable string. It MUST NOT carry PII (per PRD-109's pending posture; this PRD defers to that). It is for logging, not parsing — consumers MUST NOT branch on `error.message` content.

**PRD-100-R43.** `error.details`, when present, MUST be a JSON object. Its shape is per-code stable but **open**: producers MAY add fields without a MAJOR bump, and consumers MUST tolerate unknown fields per PRD-108-R7.

**PRD-100-R44.** The HTTP status code mapping is owned by PRD-106 (gap A4). The wire envelope shape is owned here. Static profile (per PRD-105) does not require this envelope; the static failure mode is "file present" / "file absent" with no body required on 404.

#### File extensions, MIME, and naming

**PRD-100-R45.** Static envelope files MUST use the `.act.json` extension, except for the well-known manifest at `/.well-known/act.json` which is named `act.json` (the path establishes intent). Per decision Q2.

**PRD-100-R46.** Provisional MIME types (pending IANA registration via PRD-803) per gap B5:
- `application/act-manifest+json` — manifest envelope
- `application/act-index+json` — index envelope (JSON or NDJSON; the NDJSON variant carries `profile=ndjson`)
- `application/act-node+json` — single node envelope
- `application/act-subtree+json` — subtree envelope
- `application/act-error+json` — error envelope

All five are `+json` subtypes so generic JSON tooling (HTTP middleware, content negotiation, `Content-Type` parsers) continues to work. The `profile` parameter MAY carry `static` or `runtime` to advertise delivery.

#### Versioned trees (note)

**PRD-100-R47.** A site that hosts multiple documentation versions (e.g., `/v1/`, `/v2/`) MAY publish a separate manifest under each version path. Cross-version relationships SHOULD be expressed via per-node `metadata.supersedes` or `metadata.superseded_by` cross-references (open metadata; specific schema TBD by PRD-102). This is the v0.1 pattern per gap E2 and is non-blocking for v0.1.

### Wire format / interface definition

Canonical JSON Schemas live at `schemas/100/*.schema.json`. Each is JSON Schema Draft 2020-12. Reproduced inline for reading convenience; the files are authoritative per PRD-100-R0.

#### Manifest schema (inline)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://act-spec.org/schemas/0.1/manifest.schema.json",
  "title": "ACT Manifest envelope",
  "type": "object",
  "required": [
    "act_version",
    "site",
    "index_url",
    "node_url_template",
    "conformance",
    "delivery"
  ],
  "properties": {
    "act_version": {
      "type": "string",
      "pattern": "^[0-9]+\\.[0-9]+$"
    },
    "site": {
      "type": "object",
      "required": ["name"],
      "properties": {
        "name": { "type": "string", "minLength": 1 },
        "description": { "type": "string" },
        "canonical_url": { "type": "string", "format": "uri" },
        "locale": { "type": "string" },
        "license": { "type": "string" }
      }
    },
    "generated_at": { "type": "string", "format": "date-time" },
    "generator": { "type": "string" },
    "index_url": { "type": "string", "format": "uri-reference" },
    "index_ndjson_url": { "type": "string", "format": "uri-reference" },
    "node_url_template": { "type": "string", "pattern": "\\{id\\}" },
    "subtree_url_template": { "type": "string", "pattern": "\\{id\\}" },
    "search_url_template": { "type": "string", "pattern": "\\{query\\}" },
    "root_id": { "type": "string" },
    "stats": {
      "type": "object",
      "properties": {
        "node_count": { "type": "integer", "minimum": 0 },
        "total_tokens_full": { "type": "integer", "minimum": 0 },
        "total_tokens_summary": { "type": "integer", "minimum": 0 }
      }
    },
    "capabilities": {
      "type": "object",
      "properties": {
        "etag": { "type": "boolean" },
        "subtree": { "type": "boolean" },
        "ndjson_index": { "type": "boolean" },
        "search": {
          "type": "object",
          "properties": { "template_advertised": { "type": "boolean" } }
        },
        "change_feed": { "type": "boolean" }
      }
    },
    "conformance": {
      "type": "object",
      "required": ["level"],
      "additionalProperties": false,
      "properties": {
        "level": {
          "type": "string",
          "enum": ["core", "standard", "plus"]
        }
      }
    },
    "delivery": {
      "type": "string",
      "enum": ["static", "runtime"]
    },
    "mounts": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["prefix", "delivery", "manifest_url"],
        "properties": {
          "prefix": { "type": "string" },
          "delivery": { "type": "string", "enum": ["static", "runtime"] },
          "manifest_url": { "type": "string", "format": "uri-reference" },
          "conformance": {
            "type": "object",
            "required": ["level"],
            "properties": {
              "level": { "type": "string", "enum": ["core", "standard", "plus"] }
            }
          }
        }
      }
    },
    "policy": {
      "type": "object",
      "properties": {
        "robots_respected": { "type": "boolean" },
        "rate_limit_per_minute": { "type": "integer", "minimum": 0 },
        "contact": { "type": "string" }
      }
    }
  }
}
```

#### Index schema (inline)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://act-spec.org/schemas/0.1/index.schema.json",
  "title": "ACT Index envelope",
  "type": "object",
  "required": ["act_version", "nodes"],
  "properties": {
    "act_version": { "type": "string", "pattern": "^[0-9]+\\.[0-9]+$" },
    "generated_at": { "type": "string", "format": "date-time" },
    "etag": { "type": "string" },
    "nodes": {
      "type": "array",
      "items": { "$ref": "#/$defs/IndexEntry" }
    }
  },
  "$defs": {
    "IndexEntry": {
      "type": "object",
      "required": ["id", "type", "title", "summary", "tokens", "etag"],
      "properties": {
        "id": {
          "type": "string",
          "pattern": "^[a-z0-9]([a-z0-9._\\-]|/)*[a-z0-9]$",
          "maxLength": 256
        },
        "type": { "type": "string", "minLength": 1 },
        "title": { "type": "string", "minLength": 1 },
        "path": { "type": "array", "items": { "type": "string" } },
        "summary": { "type": "string", "minLength": 1 },
        "tokens": {
          "type": "object",
          "required": ["summary"],
          "properties": {
            "summary": { "type": "integer", "minimum": 0 },
            "abstract": { "type": "integer", "minimum": 0 },
            "body": { "type": "integer", "minimum": 0 }
          }
        },
        "etag": { "type": "string" },
        "updated_at": { "type": "string", "format": "date-time" },
        "parent": {
          "oneOf": [
            { "type": "string", "pattern": "^[a-z0-9]([a-z0-9._\\-]|/)*[a-z0-9]$" },
            { "type": "null" }
          ]
        },
        "children": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^[a-z0-9]([a-z0-9._\\-]|/)*[a-z0-9]$"
          }
        },
        "tags": { "type": "array", "items": { "type": "string" } }
      }
    }
  }
}
```

NDJSON variant: each line is one `IndexEntry` object as defined in `$defs`. No outer envelope; no `act_version` per line (the file's MIME-typed identity carries the version association via the manifest's `index_ndjson_url` declaration).

#### Node schema (inline)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://act-spec.org/schemas/0.1/node.schema.json",
  "title": "ACT Node envelope",
  "type": "object",
  "required": [
    "act_version", "id", "type", "title", "etag",
    "summary", "content", "tokens"
  ],
  "properties": {
    "act_version": { "type": "string", "pattern": "^[0-9]+\\.[0-9]+$" },
    "id": {
      "type": "string",
      "pattern": "^[a-z0-9]([a-z0-9._\\-]|/)*[a-z0-9]$",
      "maxLength": 256
    },
    "type": { "type": "string", "minLength": 1 },
    "title": { "type": "string", "minLength": 1 },
    "etag": { "type": "string" },
    "updated_at": { "type": "string", "format": "date-time" },
    "summary": { "type": "string", "minLength": 1 },
    "summary_source": { "type": "string" },
    "abstract": { "type": "string" },
    "content": { "type": "array", "items": { "$ref": "#/$defs/ContentBlock" } },
    "tokens": {
      "type": "object",
      "required": ["summary"],
      "properties": {
        "summary": { "type": "integer", "minimum": 0 },
        "abstract": { "type": "integer", "minimum": 0 },
        "body": { "type": "integer", "minimum": 0 }
      }
    },
    "parent": {
      "oneOf": [
        { "type": "string", "pattern": "^[a-z0-9]([a-z0-9._\\-]|/)*[a-z0-9]$" },
        { "type": "null" }
      ]
    },
    "children": {
      "type": "array",
      "items": { "type": "string", "pattern": "^[a-z0-9]([a-z0-9._\\-]|/)*[a-z0-9]$" }
    },
    "related": {
      "type": "array",
      "items": { "type": "string", "pattern": "^[a-z0-9]([a-z0-9._\\-]|/)*[a-z0-9]$" }
    },
    "source": {
      "type": "object",
      "properties": {
        "human_url": { "type": "string", "format": "uri" },
        "edit_url": { "type": "string", "format": "uri" }
      }
    },
    "metadata": { "type": "object", "additionalProperties": true }
  },
  "$defs": {
    "ContentBlock": {
      "type": "object",
      "required": ["type"],
      "properties": { "type": { "type": "string", "minLength": 1 } },
      "additionalProperties": true
    }
  }
}
```

#### Subtree schema (inline)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://act-spec.org/schemas/0.1/subtree.schema.json",
  "title": "ACT Subtree envelope",
  "type": "object",
  "required": ["act_version", "root", "etag", "depth", "nodes"],
  "properties": {
    "act_version": { "type": "string", "pattern": "^[0-9]+\\.[0-9]+$" },
    "root": { "type": "string", "pattern": "^[a-z0-9]([a-z0-9._\\-]|/)*[a-z0-9]$" },
    "etag": { "type": "string" },
    "tokens": {
      "type": "object",
      "properties": {
        "body": { "type": "integer", "minimum": 0 },
        "summary": { "type": "integer", "minimum": 0 }
      }
    },
    "depth": { "type": "integer", "minimum": 0, "maximum": 8 },
    "truncated": { "type": "boolean" },
    "nodes": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "https://act-spec.org/schemas/0.1/node.schema.json" }
    }
  }
}
```

#### Error schema (inline)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://act-spec.org/schemas/0.1/error.schema.json",
  "title": "ACT Error envelope",
  "type": "object",
  "required": ["act_version", "error"],
  "additionalProperties": false,
  "properties": {
    "act_version": { "type": "string", "pattern": "^[0-9]+\\.[0-9]+$" },
    "error": {
      "type": "object",
      "required": ["code", "message"],
      "additionalProperties": false,
      "properties": {
        "code": {
          "type": "string",
          "enum": [
            "auth_required",
            "not_found",
            "rate_limited",
            "internal",
            "validation"
          ]
        },
        "message": { "type": "string" },
        "details": { "type": "object", "additionalProperties": true }
      }
    }
  }
}
```

### Errors

Static profile failure modes (file present / absent) are owned by PRD-105. Runtime status code mapping is owned by PRD-106. The wire envelope shape returned with runtime 4xx/5xx responses is the error envelope above.

| Condition | Wire envelope | Notes |
|---|---|---|
| Required field missing on a parsed envelope | n/a (parse-time rejection) | Producers MUST NOT emit; consumers MUST reject per PRD-108-R10 / PRD-108-R8. |
| `error.code` value outside the closed enum | n/a (rejected as malformed) | Adding a value is MAJOR (PRD-108-R5(4)). |
| Subtree depth exceeds the documented maximum (8) | Reject the response | Validators MUST flag; consumers SHOULD treat as malformed. |
| Producer cannot serve requested subtree size | `error.code: "validation"` | The only wire-format use of `validation` at the envelope layer (PRD-100-R36). |
| Authentication required (runtime) | `error.code: "auth_required"` | HTTP 401; PRD-106 owns the `WWW-Authenticate` header. |
| Resource not found OR forbidden (runtime) | `error.code: "not_found"` | HTTP 404; PRD-106 mandates `not_found` for both real-404 and access-denied to avoid existence leak. |
| Rate limited (runtime) | `error.code: "rate_limited"` | HTTP 429; `details.retry_after_seconds` SHOULD be set when `Retry-After` is sent. |
| Server error (runtime) | `error.code: "internal"` | HTTP 5xx. `details` SHOULD NOT carry stack traces or internal identifiers. |

---

## Examples

Worked examples are non-normative but MUST validate against the schemas in `schemas/100/`. Each maps to a positive fixture under `fixtures/100/positive/`.

### Example 1 — Minimum-conformant Core manifest (static)

Matches `fixtures/100/positive/manifest-minimal-core.json`.

```json
{
  "act_version": "0.1",
  "site": { "name": "Acme Tiny Docs" },
  "index_url": "/act/index.json",
  "node_url_template": "/act/n/{id}.json",
  "conformance": { "level": "core" },
  "delivery": "static",
  "capabilities": { "etag": true }
}
```

Satisfies PRD-100-R3, R4, R5, R6, plus PRD-107-R1 / R3 (level + delivery declarations).

### Example 2 — Full Plus runtime manifest

Matches `fixtures/100/positive/manifest-full-plus-runtime.json`. Demonstrates the structured `capabilities` object replacing the v0.1-draft array form.

```json
{
  "act_version": "0.1",
  "site": {
    "name": "Acme Workspace",
    "canonical_url": "https://app.acme.com",
    "locale": "en-US",
    "license": "CC-BY-4.0"
  },
  "generated_at": "2026-05-01T12:00:00Z",
  "generator": "act-runtime/0.1.0",
  "index_url": "/act/index.json",
  "index_ndjson_url": "/act/index.ndjson",
  "node_url_template": "/act/n/{id}.json",
  "subtree_url_template": "/act/sub/{id}.json",
  "search_url_template": "/act/search?q={query}",
  "root_id": "root",
  "stats": { "node_count": 247, "total_tokens_full": 184320, "total_tokens_summary": 5420 },
  "capabilities": {
    "etag": true,
    "subtree": true,
    "ndjson_index": true,
    "search": { "template_advertised": true }
  },
  "conformance": { "level": "plus" },
  "delivery": "runtime",
  "policy": { "robots_respected": true, "rate_limit_per_minute": 600, "contact": "agents@acme.com" }
}
```

### Example 3 — Index envelope

Matches `fixtures/100/positive/index-minimal.json`.

```json
{
  "act_version": "0.1",
  "generated_at": "2026-05-01T12:00:00Z",
  "etag": "s256:9f2c1b8d4a7e3f2a1c5b8e0d4a7f2c1b",
  "nodes": [
    {
      "id": "intro",
      "type": "article",
      "title": "Introduction",
      "summary": "An overview of Acme widgets and what you can build with them.",
      "tokens": { "summary": 14 },
      "etag": "s256:abc1230000000000000000",
      "parent": null,
      "children": ["intro/getting-started"]
    },
    {
      "id": "intro/getting-started",
      "type": "tutorial",
      "title": "Getting started",
      "summary": "Install the SDK and send your first request in 5 minutes.",
      "tokens": { "summary": 13 },
      "etag": "s256:def4560000000000000000",
      "parent": "intro",
      "children": []
    }
  ]
}
```

### Example 4 — Node envelope (full Plus)

Matches `fixtures/100/positive/node-full-plus.json`. Demonstrates `summary_source`, `marketing:cta`, and `related`.

```json
{
  "act_version": "0.1",
  "id": "intro/getting-started",
  "type": "tutorial",
  "title": "Getting started",
  "etag": "s256:def4560000000000000000",
  "summary": "Install the SDK and send your first request in 5 minutes.",
  "summary_source": "author",
  "content": [
    { "type": "prose", "format": "markdown", "text": "## Install\n\nFirst, install the SDK..." },
    { "type": "code", "language": "bash", "text": "npm install @acme/sdk" },
    { "type": "marketing:cta", "headline": "Sign up", "actions": [{ "label": "Start free", "href": "/signup" }] }
  ],
  "tokens": { "summary": 13, "body": 920 },
  "parent": "intro",
  "related": ["concepts/authentication", "reference/widgets-api"]
}
```

### Example 5 — Subtree envelope (depth 1)

Matches `fixtures/100/positive/subtree-default-depth.json`.

```json
{
  "act_version": "0.1",
  "root": "intro",
  "etag": "s256:sub1234567890abcdef0000",
  "depth": 1,
  "truncated": false,
  "nodes": [
    { "act_version": "0.1", "id": "intro", "type": "article", "title": "Introduction", "etag": "s256:abc...", "summary": "...", "content": [{ "type": "markdown", "text": "..." }], "tokens": { "summary": 14, "body": 480 }, "children": ["intro/getting-started"] },
    { "act_version": "0.1", "id": "intro/getting-started", "type": "tutorial", "title": "Getting started", "etag": "s256:def...", "summary": "...", "content": [{ "type": "markdown", "text": "..." }], "tokens": { "summary": 13, "body": 920 }, "parent": "intro" }
  ]
}
```

### Example 6 — Error envelope

Matches `fixtures/100/positive/error-rate-limited.json`.

```json
{
  "act_version": "0.1",
  "error": {
    "code": "rate_limited",
    "message": "Too many requests; retry after the indicated interval",
    "details": { "retry_after_seconds": 30 }
  }
}
```

### Example 7 — Percent-encoded ID in a URL template (PRD-100-R12)

Given `node_url_template: "/act/n/{id}.json"` and `id: "products/sku.123_a-b/v2"`:

The final URL is `/act/n/products/sku.123_a-b/v2.json`. Each segment is `pchar`-clean already (`pchar` admits `a-z`, `0-9`, `.`, `_`, `-`); slashes between segments are preserved verbatim; no percent-encoding is required for any character in this ID. An ID containing characters outside `pchar` would be invalid per PRD-100-R10 and rejected before URL construction.

---

## Test fixtures

Fixtures live under `fixtures/100/`. Each negative fixture either includes an inline `_negative_reason` field at the top of the JSON or is accompanied by an adjacent sidecar; PRD-600 (validator) consumes both forms.

### Positive

- `fixtures/100/positive/manifest-minimal-core.json` → satisfies R1, R3, R4, R5, R6.
- `fixtures/100/positive/manifest-full-plus-runtime.json` → satisfies R1, R3, R4, R5, R6, R7, R8, plus Plus-tier advertisements (R37, R39, R40).
- `fixtures/100/positive/index-minimal.json` → satisfies R1, R16, R17, R18, R19.
- `fixtures/100/positive/node-minimal-core.json` → satisfies R1, R10, R11, R21, R28, R29.
- `fixtures/100/positive/node-full-plus.json` → satisfies R21, R22, R23, R26, R28, R29, R30, plus the `marketing:cta` block at Plus.
- `fixtures/100/positive/subtree-default-depth.json` → satisfies R32, R33, R34, R35.
- `fixtures/100/positive/error-not-found.json` → satisfies R41, R42, R43.
- `fixtures/100/positive/error-rate-limited.json` → satisfies R41, R43 (with `details.retry_after_seconds`).

### Negative

- `fixtures/100/negative/manifest-missing-act-version.json` → MUST be rejected; violates R1 (and PRD-108-R1).
- `fixtures/100/negative/manifest-act-version-with-patch.json` → MUST be rejected; violates R1 referencing PRD-108-R3 (no PATCH).
- `fixtures/100/negative/manifest-capabilities-array-form.json` → MUST be rejected; violates R6 (legacy array form prohibited).
- `fixtures/100/negative/manifest-node-url-template-missing-id.json` → MUST be rejected; violates R5 (missing `{id}` placeholder).
- `fixtures/100/negative/manifest-conformance-level-invalid.json` → MUST be rejected; violates PRD-107-R2 and the inline schema's closed enum.
- `fixtures/100/negative/index-entry-missing-summary.json` → MUST be rejected; violates R17 / R19 (Core requires `summary`).
- `fixtures/100/negative/node-id-uppercase.json` → MUST be rejected; violates R10 / R13 (lowercase ASCII only).
- `fixtures/100/negative/node-id-leading-slash.json` → MUST be rejected; violates R10 (anchor on `[a-z0-9]`).
- `fixtures/100/negative/node-children-cycle.json` → MUST be rejected; violates R25 (children-cycle).
- `fixtures/100/negative/node-content-block-missing-type.json` → MUST be rejected; violates R28 (block discriminator required).
- `fixtures/100/negative/error-unknown-code.json` → MUST be rejected; violates R41 (closed enum).
- `fixtures/100/negative/error-missing-act-version.json` → MUST be rejected; violates R1.
- `fixtures/100/negative/subtree-depth-exceeds-max.json` → MUST be rejected; violates R33 (max depth 8).

---

## Versioning & compatibility

Per PRD-108, classify each kind of change to PRD-100.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add an optional field to any envelope | MINOR | PRD-108-R4(1). |
| Add an optional capability key (e.g., `capabilities.export`) | MINOR | PRD-108-R4(5); the capability key set is documented-open. |
| Add a value to the `summary_source` open enum | MINOR | PRD-108-R4(3). |
| Add a new content block type in the `marketing:*` namespace | MINOR | PRD-108-R4(4). |
| Add a value to the `error.code` closed enum | MAJOR | PRD-108-R5(4). |
| Add a value to the `core:*` block-type namespace | MAJOR | The `core:*` namespace is closed at v0.1 (PRD-100-R29). |
| Add a value to the `delivery` enum | MAJOR | PRD-107-pinned closed enum; PRD-108-R5(4). |
| Add a value to the `conformance.level` enum | MAJOR | PRD-107-R2; PRD-108-R5(4). |
| Tighten the ID grammar (e.g., remove `.` or `_`) | MAJOR | PRD-108-R5(6) (syntactic constraint change). |
| Loosen the ID grammar (admit uppercase, etc.) | MAJOR | PRD-108-R5(6). |
| Increase the subtree max depth above 8 | MAJOR | Changes a documented bound consumers rely on for DoS protection. |
| Decrease the subtree max depth below 8 | MAJOR | Producers may have been emitting depth=8 responses. |
| Promote `abstract` to required at the node envelope | MAJOR | PRD-108-R5(3) (SHOULD→MUST). |
| Remove the legacy `capabilities: array` form | n/a | Already prohibited at v0.1; not a wire-format-level change. |
| Add a new MIME type to the `application/act-*+json` family | MINOR | New optional content negotiation; existing tooling unaffected. |

### Forward compatibility

Per PRD-108-R7, consumers MUST tolerate unknown optional fields in every envelope. Specifically: unknown keys under `capabilities`, unknown values under `summary_source`, unknown content-block `type` values, and unknown keys under `error.details` MUST NOT cause the consumer to reject the envelope. Unknown values under closed enums (`conformance.level`, `delivery`, `error.code`) MUST be treated as validation errors per PRD-108-R8 / PRD-107-R2.

### Backward compatibility

- A `0.1` producer's output is valid `0.2` (additive MINORs).
- A `0.2` consumer reads `0.1` output by treating absent optional fields as absent.
- A `0.2` producer's output is valid for `0.1` consumers as long as those consumers honor PRD-108-R7.
- Across MAJOR boundaries, no backward compatibility is required; PRD-108-R12 governs the deprecation window.

---

## Security considerations

This section is the v0.1 placeholder threat model for the wire format. PRD-109 (in flight) will subsume the project-wide security posture; consult that PRD as the authoritative source once it reaches Accepted.

**Information disclosure.** Envelope existence is itself an information channel: a 404 vs 200 reveals whether a resource exists. Per gap A4 (resolved here for the envelope and PRD-106 for the HTTP mapping), runtime servers MUST collapse "not found" and "forbidden" into the same `error.code: "not_found"` and HTTP 404 to avoid leaking existence to unauthorized requesters. The error envelope's `error.message` MUST NOT carry PII; `error.details` is open but producers SHOULD audit per-code shapes for inadvertent leaks (e.g., do not include the requested ID in `details` for `not_found`, since echoing the ID confirms existence to a probe). The `etag` field is a stable function of the inputs documented in PRD-103; producers MUST NOT mix in identity material in a way that allows ETag comparison to correlate identities (see PRD-103 / PRD-109 for the canonical recipe).

**Injection.** The wire format's user-controlled fields are `id`, `title`, `summary`, `abstract`, `content[].text`, and `metadata.*`. The ID grammar (PRD-100-R10) restricts `id` to a safe character class that is `pchar`-clean, eliminating URL-injection risk in template substitution (PRD-100-R12). Free-text fields (`title`, `summary`, `abstract`, `content[].text`) carry no markup interpretation at the wire layer; consumers that render them MUST apply their own framework-appropriate escaping. The `content[]` typed-block discriminator allows consumers to dispatch rendering safely; unknown block types are tolerated as opaque structured payload (PRD-100-R31), which means a hostile producer cannot escape a consumer's block-renderer matrix by inventing a type.

**Denial of service.** The subtree depth bound (PRD-100-R33: default 3, max 8) caps the recursion / inlining a single subtree response can carry. The body-size guidance (PRD-100-R27, ≤ 10000 tokens per node SHOULD-split) is non-normative but lets validators warn early. NDJSON line-length and total-file-size limits are owned by PRD-105 (static) and PRD-106 (runtime). The error envelope is intentionally compact — `error.code` and `error.message` are bounded by content; `error.details` is open but producers SHOULD keep it small and stable per code. Consumers MUST be prepared to reject malformed envelopes per PRD-108-R8 in constant-bounded time.

**ID stability.** PRD-100-R15 (cited from gap C4) requires runtime IDs to be stable for `(resource, identity, tenant)`. This is a usability requirement (revalidation depends on it) but has security side effects: stable IDs are correlatable across requests and across the producer's own logs. Producers SHOULD NOT use raw user identifiers as ID material; PRD-109 will address the project-wide PII posture for IDs.

**Trust boundary on the envelope.** Envelopes are content; a producer's claim about itself (capabilities, conformance level, generator string) is unverified at parse time. Consumers gating on capability MUST verify by probe, not by manifest claim alone (PRD-107-R22 already requires this for level; PRD-100 extends the principle to capability flags).

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft. Pins all five envelope shapes (manifest, index, node, subtree, error), the ID grammar (gap A3), the closed `error.code` enum (gap A4), the `summary_source` open enum (gap E5), the `children`-cycle prohibition (gap E3), runtime ID stability (gap C4), the ID-override precedence rule (gap E7), the summary-length guidance (gap E8), the max-body guidance (gap E4), and provisional MIME types (gap B5). Migrates the v0.1-draft `capabilities: array` form to a structured object keyed by capability name, with documented keys `etag`, `subtree`, `ndjson_index`, `search.template_advertised`, and a reserved `change_feed`; the array form is prohibited at the wire layer from v0.1 onward (the draft was never released, so no deprecation window is required). Incorporates the PRD-107 `conformance` / `delivery` / `mounts` shapes verbatim and the PRD-108 `act_version` regex. Schemas saved at `schemas/100/*.schema.json`; positive and negative fixtures at `fixtures/100/`. Status set to `In review`. |
| 2026-05-01 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
