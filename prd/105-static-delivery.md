# PRD-105 — Static delivery profile (build-time files, CDN expectations)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

The v0.1 working draft introduces "static" as one of two delivery profiles (`docs/plan/v0.1-draft.md` §5.13 intro and §5.14) but never pins the operational contract: what files exist on disk, what URL paths they serve at, what HTTP semantics the CDN is required to provide, what the producer MUST guarantee at build time. The §5.13 sketch reads as if static is "everything you've already seen in §5.10–§5.12" — but that prose covers source adapters, not the file-set/HTTP-layer contract a CDN operator and a generator implementer need to agree on. Two consumers fetching the same static deployment cannot today agree on whether `/act/n/intro.json` MUST be present, what `Content-Type` it MUST carry, what 304 means, or what 5xx means. Three of the resolutions in `000-gaps-and-resolutions.md` (A4 static error model, B5 MIME types and file extensions, E2 versioned trees) are claimed by this PRD; without it, PRD-400 (the generator series) cannot specify a build target, and the PRD-600 validator cannot decide whether a static site is conformant. PRD-107 already settles `delivery: "static"` as the relevant manifest enum value and enumerates which endpoints are required at each conformance band; PRD-105 picks up the operational details PRD-107 deliberately deferred.

### Goals

1. Lock the file set every static-profile generator MUST emit, parameterized by conformance level (Core / Standard / Plus per PRD-107).
2. Pin the URL path each file serves at, deriving from the manifest's `index_url`, `node_url_template`, `subtree_url_template`, `index_ndjson_url`, and `search_url_template`.
3. Specify the file extension and MIME types per gap B5, restating the provisional values pending PRD-803 IANA registration.
4. Specify the HTTP status semantics the CDN MUST or MUST NOT provide — 200 / 304 / 404 are the static-profile codes; 5xx is a CDN-operator concern outside ACT's contract.
5. State the CDN expectations with respect to ETag, `If-None-Match`, `Cache-Control`, body-mutation, and compression — explicitly delegating ETag *derivation* to PRD-103.
6. State the build-time guarantees a generator MUST or SHOULD enforce (every node referenced has a file; missing summary is a build error; over-100-token summary is a build warning) — owned more deeply by PRD-400, but stated here so PRD-105 has a complete operational picture.
7. Acknowledge versioned-trees layout (per gap E2) and hybrid `mounts` interaction with the runtime profile (per gap C5 and PRD-107-R5) without claiming responsibility for either's full contract.

### Non-goals

1. **Defining the wire envelopes themselves.** That is PRD-100 (manifest, index, node, subtree, error envelope shapes). This PRD only references envelope fields by name.
2. **Defining the runtime profile.** That is PRD-106 (in-flight). This PRD's only claim about runtime is the orthogonality re-stated in PRD-107 and the `mounts`-interaction note in §"Hybrid sites".
3. **Defining ETag derivation.** That is PRD-103 (in-flight). This PRD requires the CDN to *honor* `ETag` / `If-None-Match`; how the etag is computed is PRD-103's contract.
4. **Defining the discovery hand-off.** That is PRD-101 (in-flight). This PRD restates the well-known location for completeness but does not specify discovery linkage (HTML `<link rel>`, HTTP `Link` header).
5. **Defining the i18n file-set extension.** That is PRD-104 (in-flight). Per-locale roots emitted by a multi-locale producer extend this PRD's file set; the precise layout is PRD-104's.
6. **Defining MIME-type IANA registration.** That is PRD-803. This PRD restates the provisional values from gap B5 and freezes them pending registration.
7. **Defining error-envelope shapes for static.** Per gap A4, the static profile does not define a wire-format error envelope — 404 carries no body; 5xx is CDN-controlled. The error envelope shape that PRD-100 defines applies to runtime (PRD-106) only.

### Stakeholders / audience

- **Authors of:** PRD-400 (generator architecture), PRD-401–409 (per-framework generators), PRD-600 (validator's static-profile probe), PRD-700-series (reference example builds that ship as static deployments).
- **Reviewers required:** Jeremy Forsythe (BDFL).

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| CDN configurations vary widely; some auto-minify JSON or auto-inject headers, breaking ETag agreement when consumer-received bytes differ from producer-emitted bytes. | Medium | Medium | PRD-105-R12 prohibits body mutation; PRD-103's etag is computed over canonical JSON, which absorbs whitespace differences from minification but not field-injection. PRD-105 fixture `cdn-mutates-json-body.json` enumerates the failure mode for PRD-600. |
| Producers conflate "static" with "minimum capability" and ship a Core static site when they could meet Standard or Plus; consumers ask for "minimum Plus" and find no static deployments to consume. | Low | Low | Orthogonality is settled by PRD-107 (level and profile are independent); PRD-105 is permissive — Core, Standard, and Plus are all valid static deployments. The corporate-marketing example documents a Plus static deployment to make the high band visible. |
| Hosting platforms (GitHub Pages, S3+CloudFront, Cloudflare Pages, Netlify, Vercel) differ in whether they preserve `ETag` headers from upstream or compute their own. | Medium | Medium | PRD-105-R10 requires the CDN to serve `ETag` matching the envelope's `etag` field; if the platform recomputes, the producer's deployment is non-conformant. PRD-600 probes for byte-equality between header `ETag` and envelope `etag` and emits a gap when they diverge. |
| Decision Q8 commits the project to hosting the validator on GitHub Pages from the spec repo — PRD-105's contract bound on that deployment is itself an example of the static profile. If GitHub Pages changes its serving behavior (e.g., introduces auto-minification), the validator's own deployment becomes non-conformant. | Low | Low | Validator deployment is monitored manually; if GitHub Pages adds mutation, fall back to a static-host alternative (Cloudflare Pages, Netlify) per the platform-list in §"Hosting deployment patterns". |
| Static profile is unauthenticated by definition; producers may inadvertently bake auth-scoped data into the build (e.g., a markdown adapter pulls a draft-only doc). | Low | High (information disclosure) | This is a source-adapter / build-time concern, not a CDN concern; cite PRD-109 for the trust boundary. PRD-105 states the boundary and points to PRD-109 for handling. |

### Open questions

1. Does a static-profile producer that wishes to advertise `search_url_template` in the manifest have any mechanism beyond client-side query substitution against a precomputed index? Today the only options are (a) a precomputed JSON the consumer fetches and queries client-side, or (b) omit the field entirely (PRD-107-R10 explicitly permits omission). A "static search backend" (e.g., a separate hosted search service whose URL is interpolated into the template) is allowed by the manifest but pushes the producer into hybrid territory under `mounts`. Resolution is informational, not normative; revisit if PRD-104 (i18n) or PRD-700-series examples surface a stronger pattern.
2. Should static deployments be REQUIRED to set `Cache-Control: public` (i.e., MUST), or only RECOMMENDED (SHOULD)? Today PRD-105-R11 says SHOULD. A MUST would simplify CDN configuration but would invalidate use cases like a private-network static deployment served by an authenticating proxy where `Cache-Control: private` is intentional. SHOULD is the right band for v0.1.
3. PRD-104 (i18n) will extend the file-set to per-locale roots (`/en-US/act/...`, `/es-ES/act/...`). PRD-105 notes the extension exists but does not specify the layout. Reconcile when PRD-104 lands.

### Acceptance criteria

- [x] Every requirement has an ID of the form `PRD-105-R{n}`.
- [x] Conformance level (Core / Standard / Plus per PRD-107) is declared per requirement.
- [x] Static file set enumerated for each level (Core / Standard / Plus).
- [x] MIME types enumerated per gap B5.
- [x] HTTP status semantics enumerated per gap A4 (200 / 304 / 404).
- [x] CDN expectations cover ETag/304, Cache-Control, body-mutation, compression.
- [x] Build-time guarantees stated (with cross-reference to PRD-400).
- [x] Versioned-trees mention (per gap E2) and hybrid mounts mention (per gap C5).
- [x] At least one positive fixture (file-set listing for Core minimum); at least one negative fixture (static manifest with runtime-only fields).
- [x] Worked example incorporates the corporate-marketing composite from draft §6.5 / §8.4.
- [x] Security section cites PRD-109 as the owner of the source-adapter / build-time information-disclosure boundary.
- [x] Changelog initial entry dated 2026-05-01 is present.

---

## Context & dependencies

### Depends on

- **PRD-100** — wire-format envelopes (manifest, index, node, subtree). PRD-105 references these by field name; the file shapes themselves are PRD-100's contract.
- **PRD-103** — caching, ETags, validators. PRD-105 requires the CDN to honor `ETag` and `If-None-Match`; the etag *value* comes from PRD-103.
- **PRD-107** (Accepted) — conformance levels and `delivery: "static"`. PRD-105 inherits the file-set decomposition by level (Core / Standard / Plus) directly from PRD-107 and re-states the operational details.
- **PRD-108** (Accepted) — versioning policy. PRD-105's "Versioning & compatibility" section classifies changes per PRD-108.
- **000-governance** (Accepted) — change-control rules and the `In review → Accepted` transition.
- External: [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174). [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) §15.4.5 for `304 Not Modified`, §13 for conditional requests, §8.8 for ETag. [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259) for JSON. [RFC 4329](https://www.rfc-editor.org/rfc/rfc4329) and [RFC 6839](https://www.rfc-editor.org/rfc/rfc6839) for `+json` structured-syntax suffix.

### Blocks

- **PRD-400** (generator architecture) and **PRD-401–409** (per-framework generators) — they emit the file set this PRD specifies.
- **PRD-600** (validator) — its static-profile probe checks for the file set, MIME types, and CDN behavior this PRD specifies.
- **PRD-700–707** (reference example builds) — every static-profile example must validate clean against this PRD.

### References

- v0.1 draft: §5.13 intro (static profile mention as one of two delivery profiles), §5.14 (when to use static), §6.5 (corporate-marketing composite — the canonical Plus static example), §7 (build integration: pipeline, generator pseudocode, plugin targets), §8.4 (corporate marketing site worked example).
- `prd/000-gaps-and-resolutions.md`: A4 (static error model), B5 (file extension `.act.json`, MIME types), C5 (hybrid `mounts` discovery, the static parent's responsibilities), E2 (versioned trees).
- `prd/000-decisions-needed.md`: Q2 (final naming — `.act.json` extension, well-known path), Q8 (validator hosted on GitHub Pages from the spec repo — itself a worked example of the static profile).
- Sibling PRDs (in-flight, cited by gap ID and topic, not by `PRD-Rn` IDs): PRD-100 (envelope shapes), PRD-101 (discovery and well-known location), PRD-102 (block taxonomy and `related` shape), PRD-103 (ETag derivation and 304 semantics), PRD-104 (i18n file-set extension), PRD-106 (runtime profile), PRD-109 (security and build-time information disclosure).
- Prior art: GitHub Pages hosting (the validator deployment per Q8); RFC 5785 / RFC 8615 for `/.well-known/`; sitemap.xml's prior-art pattern of static-file enumeration; `llms.txt` as a discovery-time hand-off precedent.

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) where requirements are imposed. Lowercase "must" and "should" are non-normative prose.

### Conformance level

The static delivery profile is available at every conformance level — Core, Standard, and Plus per PRD-107. PRD-105 inherits PRD-107's level decomposition: a Core static deployment ships fewer files than a Standard or Plus one, but the operational contract (URL paths, MIME types, HTTP semantics, CDN expectations) is the same at every level.

- **Core:** PRD-105-R1, R2, R3, R4, R5, R8, R9, R10, R11, R12, R13.
- **Standard:** Adds PRD-105-R6 (subtree files for every advertised subtree-id).
- **Plus:** Adds PRD-105-R7 (NDJSON index) and PRD-105-R7a (search endpoint or its consistent omission).

Build-time guarantees (PRD-105-R14, R15) are normative for any producer at any level; their *enforcement* is PRD-400's concern, but their existence and content are pinned here.

### Normative requirements

#### File set and URL paths

**PRD-105-R1.** A producer declaring `delivery: "static"` MUST emit a manifest file reachable at the URL path `/.well-known/act.json` relative to the deployment origin. The well-known path is unprefixed (the file is `act.json`, not `act.act.json`); the path itself establishes intent. The manifest's `Content-Type` MUST be `application/act-manifest+json; profile=static` per PRD-105-R8. **(Core)**

**PRD-105-R2.** A producer declaring `delivery: "static"` MUST emit an index file reachable at the URL path declared by the manifest's `index_url` field. The index file contains the index envelope shape defined by PRD-100. The index file's `Content-Type` MUST be `application/act-index+json` per PRD-105-R8. **(Core)**

**PRD-105-R3.** A static-profile manifest MUST NOT populate fields that are exclusively meaningful under the runtime profile. Specifically: the manifest MUST NOT carry an `auth.schemes` array (auth scheme negotiation is PRD-106's contract); the manifest MUST NOT carry runtime-only capability flags (PRD-100 enumerates which flags are runtime-only). A manifest that violates this rule is a build-time error and PRD-600 MUST emit a `gaps` entry citing PRD-105-R3. **(Core)**

**PRD-105-R4.** For every node id `N` listed in the index's `nodes` array, the producer MUST emit a node file reachable at the URL path produced by substituting `N` into the manifest's `node_url_template`. The substitution rules are PRD-100's (per-segment percent-encoding per RFC 3986 §3.3). The node file's `Content-Type` MUST be `application/act-node+json` per PRD-105-R8. **(Core)**

**PRD-105-R5.** Every node id referenced in the index MUST have a corresponding node file reachable at the substituted URL. A static deployment whose index lists an id for which no file exists is non-conformant; PRD-600's static probe MUST fetch every index-listed id and MUST emit a `gaps` entry citing PRD-105-R5 for any 404 response. **(Core)**

**PRD-105-R6.** A producer declaring `conformance.level: "standard"` (or `"plus"`) and advertising subtree availability via `subtree_url_template` MUST emit a subtree file reachable at the URL path produced by substituting each subtree-root id into `subtree_url_template`. The subtree file's `Content-Type` MUST be `application/act-subtree+json` per PRD-105-R8. Subtree availability is per PRD-107-R8 — Standard producers advertise via `subtree_url_template` (and/or `capabilities.subtree`), and a producer MAY claim subtree availability for a subset of node ids. The producer MUST emit a subtree file for every id for which availability is claimed. **(Standard)**

**PRD-105-R7.** A producer declaring `conformance.level: "plus"` MUST emit an NDJSON index file reachable at the URL path declared by the manifest's `index_ndjson_url` field. The NDJSON index is one node-index entry per line (per PRD-100's NDJSON shape). The NDJSON file's `Content-Type` MUST be `application/act-index+json` (the same MIME type as the JSON index; consumers disambiguate by URL or by content shape — line-delimited vs single object). **(Plus)**

**PRD-105-R7a.** A producer declaring `conformance.level: "plus"` and advertising `search_url_template` in the manifest MUST fulfill the template under one of two patterns: (a) a precomputed search-index JSON hosted at a stable URL, paired with a client-side wrapper that performs query substitution at consumer request time; or (b) a hosted search backend at a different origin or path whose URL substitutes into the template. If the producer cannot fulfill query-substitution semantics under the static profile (i.e., neither pattern is feasible), the producer MUST omit `search_url_template` from the manifest entirely; PRD-107-R10 governs the omission. A producer that advertises `search_url_template` but cannot serve any query is non-conformant; PRD-600 MUST emit a `gaps` entry citing PRD-105-R7a. **(Plus)**

#### File extension and MIME types

**PRD-105-R8.** The CDN MUST serve each static-profile resource with the corresponding `Content-Type` value from the closed list below. The values are provisional pending PRD-803 IANA registration; producers and consumers MUST use these exact strings in the interim per gap B5.

| Resource | Content-Type |
|---|---|
| Manifest | `application/act-manifest+json; profile=static` |
| Index (JSON) | `application/act-index+json` |
| Index (NDJSON) | `application/act-index+json` |
| Node | `application/act-node+json` |
| Subtree | `application/act-subtree+json` |
| Error envelope (rare) | `application/act-error+json` |

Adding a new MIME type to the closed list is a MAJOR change per PRD-108 (R5(4)). Removing or renaming an existing one is also MAJOR. The schema fragment in §"Wire format / interface definition" pins the exact strings. The `; profile=static` parameter on the manifest is REQUIRED for static-profile manifests; PRD-106 owns the runtime variant. **(Core)**

**PRD-105-R9.** Individual node files, index files, and subtree files written to disk MAY use the `.act.json` extension (e.g., `intro.act.json`) per gap B5 and decision Q2. The well-known manifest file at `/.well-known/act.json` is unprefixed. The extension is MAY, not MUST: the operational contract is the URL path the CDN serves at and the `Content-Type` it returns; the on-disk filename is implementation detail and consumers MUST NOT depend on a particular extension. A consumer that relies on URL extension to determine resource shape is non-conformant. **(Core)**

#### HTTP semantics

**PRD-105-R10.** The CDN MUST honor conditional requests per RFC 9110 §13. Specifically:

- The CDN MUST send the `ETag` HTTP header on every 200 response, with a value byte-equal to the resource envelope's `etag` field. (ETag derivation is PRD-103's contract; PRD-105 only requires that the header value matches the envelope value.)
- The CDN MUST return `304 Not Modified` with no body when an `If-None-Match` request header matches the resource's current ETag.
- The CDN MUST return `200 OK` with the resource body when no `If-None-Match` is sent or when the sent value does not match.
- The CDN MUST return `404 Not Found` when the resource does not exist on disk. A 404 response under the static profile carries no body; ACT does not define a static error envelope. PRD-600 MUST treat a 404 with a non-empty body as non-conformant per PRD-105-R10.
- 5xx responses are CDN-operator concerns and outside the static-profile contract. ACT does not define a static error envelope; consumers MUST treat 5xx as a transport failure (retry per PRD-103, fall back per consumer policy).

The full status table is restated in §"Errors" below for ergonomics. **(Core)**

**PRD-105-R11.** The CDN SHOULD set `Cache-Control: public, max-age=N` on every 200 response, with `N` chosen by the producer in the range 300 to 3600 seconds (5 to 60 minutes) for production deployments. Smaller values are permitted for development; larger values are permitted for content the producer expects to be effectively immutable (e.g., archival builds). The CDN MAY include additional `Cache-Control` directives (`stale-while-revalidate`, `immutable`) at the producer's discretion. The recommendation is SHOULD rather than MUST so that private-network or authenticating-proxy deployments may use `Cache-Control: private` intentionally. **(Core)**

**PRD-105-R12.** The CDN MUST NOT mutate the JSON body in transit. Specifically:

- The CDN MUST NOT minify JSON in a way that injects, removes, or reorders fields (whitespace normalization is permitted because PRD-103's etag is computed over canonical JSON, but field-level mutation breaks the consumer's ability to verify byte-equivalence with the producer's intent).
- The CDN MUST NOT auto-inject comments, BOMs, metadata fields, or any other content the producer did not author.
- The CDN MUST NOT transform the JSON shape in any way (no field renaming, no schema rewriting, no auto-translation).

Wire-layer compression (gzip, brotli, zstd) is permitted per RFC 9110 §8.4 because it is reversed transparently by the consumer; the decoded bytes MUST match the producer-emitted bytes. PRD-600 probes for body-mutation by fetching with `Accept-Encoding: identity` and comparing to the generator's output; mismatches MUST emit a `gaps` entry citing PRD-105-R12. **(Core)**

**PRD-105-R13.** The CDN MAY add HTTP headers that do not conflict with PRD-105-R10 or PRD-105-R12 — security headers (`Strict-Transport-Security`, `Content-Security-Policy`), CORS headers (`Access-Control-Allow-Origin`), edge-cache hint headers (`X-Cache`, `Vary`), and routing headers are all permitted. The CDN MUST NOT remove or rewrite the `ETag` or `Content-Type` headers per PRD-105-R8 and PRD-105-R10. The CDN SHOULD send `Access-Control-Allow-Origin: *` on all static-profile resources because static ACT is unauthenticated and CORS-restricting it serves no purpose; producers that intentionally restrict CORS (private-network deployments) MAY override the SHOULD. **(Core)**

#### Build-time guarantees

**PRD-105-R14.** A generator (PRD-400 series) emitting a static-profile build MUST guarantee the following at build time:

- **File-set completeness.** Every node id referenced in the emitted index has a corresponding node file. Every subtree-root id for which subtree availability is claimed has a corresponding subtree file. (This is the build-time mirror of PRD-105-R5 and PRD-105-R6; PRD-400 enforces in-process before the build completes.)
- **Manifest consistency.** The emitted manifest's `index_url`, `node_url_template`, `subtree_url_template`, `index_ndjson_url`, and `search_url_template` resolve to URL paths the build emits files at; templates that interpolate ids MUST produce paths the generator actually wrote.
- **Multi-source ID consistency.** When two source adapters produce nodes with the same id (per gap B2 and PRD-200's multi-source merging), the generator MUST emit a single node file with the merged content, not two files with the same id at colliding paths. (Multi-source merging itself is PRD-200's contract; PRD-105 only requires that the file set on disk be consistent.)

A build that violates any of these guarantees MUST fail with a non-zero exit code; the generator MUST NOT emit a partial deployment. **(Core)**

**PRD-105-R15.** Build-time per-node validation MUST emit one of two severities:

- **Build error (exit non-zero, no files emitted):** missing `summary` field on a node (the index lists the id but the source produced no summary); missing required envelope field (`act_version`, `id`, `type`, `title`, `etag` — PRD-100's required set); ID grammar violation per gap A3.
- **Build warning (exit zero with warnings printed; files emitted):** `summary` field present but exceeds 100 tokens (per gap E8 and PRD-102's recommendation); node body exceeds 10K tokens (per gap E4); deprecated field used.

The classification list above is illustrative; PRD-400 owns the full enumeration. PRD-105's contract is that the two severities exist and that build errors halt the deployment while build warnings do not. **(Core)**

#### Versioned trees and hybrid mounts

**PRD-105-R16.** A site that publishes multiple versioned documentation trees (e.g., `/v1/`, `/v2/` per gap E2) MAY emit one static manifest per version path, each at its own well-known location relative to the version prefix (e.g., `/v1/.well-known/act.json`, `/v2/.well-known/act.json`). Cross-version references SHOULD use `supersedes` / `succeeded_by` relations in the node `related` arrays (cite the in-flight sibling PRD owning the `related` shape — PRD-102 — for relation semantics). PRD-105 does not specify the multi-version layout in detail; the gap E2 resolution is informational for v0.1 and not blocking. **(Core, but the scenario itself is optional)**

**PRD-105-R17.** A static parent manifest MAY declare `mounts` per PRD-107-R5 and per gap C5. PRD-105's responsibility extends only to the static parent: the parent manifest, parent index, and parent node files MUST satisfy PRD-105-R1 through PRD-105-R15. A mount entry whose `delivery` is `"runtime"` is the responsibility of the in-flight runtime-profile sibling PRD; a mount entry whose `delivery` is `"static"` (a static-to-static mount) MUST itself satisfy PRD-105 in full at the mounted prefix, with its own well-known manifest. Longest-prefix matching applies per PRD-107-R5 and gap C5. **(Core)**

### Wire format / interface definition

This PRD's contract is HTTP/file-system-level, not envelope-level. The wire envelopes themselves (manifest, index, node, subtree, error) are PRD-100's contract; PRD-105 only references their fields by name and pins the operational layer around them.

Two JSON Schema fragments under `schemas/105/` formalize the operational layer:

1. **`schemas/105/static-file-set.schema.json`** — describes the build-time enumeration of static files a generator MUST emit. This is a generator-↔-validator contract, not a wire envelope; the validator MAY consume it as input to predict crawl targets.
2. **`schemas/105/mime-types.schema.json`** — pins the closed list of `Content-Type` values the CDN MUST serve per PRD-105-R8. Provisional pending PRD-803 IANA registration.

#### Static-deliverable file-set manifest (excerpt)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "ACT static-deliverable file set (excerpt)",
  "type": "object",
  "required": ["manifest_path", "well_known_path", "index_path", "node_paths", "conformance_level"],
  "properties": {
    "manifest_path":      { "type": "string", "format": "uri-reference" },
    "well_known_path":    { "type": "string", "const": "/.well-known/act.json" },
    "index_path":         { "type": "string", "format": "uri-reference" },
    "index_ndjson_path":  { "oneOf": [{ "type": "string", "format": "uri-reference" }, { "type": "null" }] },
    "node_paths":         { "type": "array", "items": { "type": "string", "format": "uri-reference" } },
    "subtree_paths":      { "type": "array", "items": { "type": "string", "format": "uri-reference" } },
    "search_path":        { "oneOf": [{ "type": "string", "format": "uri-reference" }, { "type": "null" }] },
    "conformance_level":  { "type": "string", "enum": ["core", "standard", "plus"] }
  }
}
```

Full schema: `schemas/105/static-file-set.schema.json`.

#### MIME-type closed list (excerpt)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "ACT static-profile MIME types (excerpt)",
  "type": "object",
  "properties": {
    "manifest":      { "const": "application/act-manifest+json; profile=static" },
    "index":         { "const": "application/act-index+json" },
    "index_ndjson":  { "const": "application/act-index+json" },
    "node":          { "const": "application/act-node+json" },
    "subtree":       { "const": "application/act-subtree+json" },
    "error":         { "const": "application/act-error+json" }
  }
}
```

Full schema: `schemas/105/mime-types.schema.json`.

### Errors

The static-profile error model is shallow by design. Per gap A4, ACT does not define a wire-format error envelope under the static profile; the producer's contract is "the file is there or it isn't," and 5xx is a CDN-operator concern outside ACT's purview.

| Condition | Response | Notes |
|---|---|---|
| File present, no `If-None-Match` (or `If-None-Match` does not match) | `200 OK` with body and `ETag` header | PRD-105-R10. `Content-Type` per PRD-105-R8. `Cache-Control` per PRD-105-R11. |
| File present, `If-None-Match` matches the current ETag | `304 Not Modified`, no body | PRD-105-R10. The 304 response SHOULD echo `ETag`, `Cache-Control`, and `Content-Type` headers per RFC 9110 §15.4.5 conventions. |
| File absent on disk | `404 Not Found`, no body | PRD-105-R10. ACT does not define a static error envelope; the 404 body MUST be empty (or a CDN's default error page that ACT does not control — but PRD-600 MUST flag a non-empty ACT-shaped body). |
| Server / CDN error | `5xx`, body is CDN-controlled | PRD-105 does not constrain this. Consumers treat 5xx as a transport failure. |
| Manifest declares `delivery: "static"` but populates runtime-only fields (`auth.schemes`, etc.) | Build-time error | PRD-105-R3. The build MUST fail; a deployed manifest in this state is non-conformant and PRD-600 emits a `gaps` entry citing PRD-105-R3. |
| Index references an id with no node file on disk | Build-time error AND runtime 404 | PRD-105-R5 + PRD-105-R14. The build SHOULD fail before deployment; if a deployment slips through, PRD-600's probe catches it via the 404 and emits a `gaps` entry. |

PRD-105 introduces no new HTTP status codes. The runtime-profile error model is owned by the in-flight runtime sibling PRD.

---

## Examples

Examples are non-normative but consistent with the Specification section above; PRD-600 will validate them.

### Example 1 — Minimum Core static deployment

A documentation site with three pages publishes a Core static deployment. The manifest:

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

The build emits the following file set:

```
/.well-known/act.json
/act/index.json
/act/n/intro.json
/act/n/install.json
/act/n/configuration.json
```

Every node file is reachable at `Content-Type: application/act-node+json`; the index at `application/act-index+json`; the manifest at `application/act-manifest+json; profile=static`. The CDN sends `ETag` matching each envelope's `etag` field and honors `If-None-Match` per PRD-105-R10. No subtree files are emitted (Core). No NDJSON, no search. This is the floor.

Fixture: `fixtures/105/positive/static-file-set-core-minimum.json`.

### Example 2 — Plus static deployment (the corporate-marketing composite)

The canonical Plus static deployment follows the v0.1 draft §6.5 / §8.4 composite — a Next.js + Contentful + i18n marketing site with React component instrumentation. The single `act.config.js` covers every content source on the site (markdown, CMS, i18n, Storyblok blog). The build emits per-locale ACT trees with cross-locale `translation_of` references (PRD-104 owns the i18n layout); the en-US root is shown here:

```
/.well-known/act.json
/act/index.json
/act/index.ndjson
/act/n/home.json
/act/n/pricing.json
/act/n/products.json
/act/n/contact.json
/act/n/blog/launch-announcement.json
/act/n/blog/q3-roadmap.json
/act/sub/home.json
/act/sub/blog.json
/act/search-index.json
```

The manifest declares `conformance.level: "plus"`, `delivery: "static"`, advertises `subtree_url_template`, `index_ndjson_url`, and `search_url_template` (the last fulfilled by a precomputed JSON at `/act/search-index.json` plus a client-side wrapper). The pricing node body matches the worked example at draft §8.4 — `marketing:hero`, `marketing:pricing-table`, `marketing:faq`, `marketing:cta` blocks composed by the design system. The team writes zero JSON; the build produces everything as a side effect of the existing Next.js + Contentful + next-intl pipeline. When marketing edits a Contentful entry, the next build produces an updated ACT node with a new ETag; agents see the change on their next revalidation per PRD-105-R10.

Fixture: `fixtures/105/positive/static-file-set-plus-corporate-marketing.json`.

### Example 3 — A 304 response trace

A consumer revalidates a previously fetched node:

```
GET /act/n/intro.json HTTP/1.1
Host: acme.com
If-None-Match: "s256:8Z0luYEDvPcDQKLimP55qC"
Accept: application/act-node+json
```

The CDN responds:

```
HTTP/1.1 304 Not Modified
ETag: "s256:8Z0luYEDvPcDQKLimP55qC"
Cache-Control: public, max-age=600
Content-Type: application/act-node+json

(no body)
```

PRD-105-R10 governs. The etag value is computed by PRD-103 (over the canonical JSON of the node payload minus the etag field itself); PRD-105 only requires that the CDN's `ETag` header byte-matches the envelope value. Fixture: `fixtures/105/positive/cdn-304-response-trace.json`.

### Example 4 — Hosting on GitHub Pages (per decision Q8)

The validator hosted at GitHub Pages from the spec repo (per decision Q8) is itself a worked example of the static profile. The repo's `docs/` directory contains the validator's web app; GitHub Pages serves it at `https://<org>.github.io/<repo>/` (or the project's custom domain — `act-spec.org` per Q10 once registered). The validator's manifest is at `/.well-known/act.json` relative to the deployment origin; the validator's own ACT tree (a single node describing the validator UI, plus any embedded examples) follows PRD-105-R1 through PRD-105-R15. CORS-restricted origins are addressed by allowing direct paste of JSON, per Q8 — that aspect is the validator's UI concern, not PRD-105's.

Other static-friendly hosting platforms work the same way:

- **S3 + CloudFront** — origin is the S3 bucket; CloudFront sets `ETag` automatically (matches S3's, which derives from object content); `Cache-Control` configurable per behavior. Watch for CloudFront's optional response-header transformations (PRD-105-R12 prohibits body mutation; CloudFront's default does not mutate, but Lambda@Edge customizations can).
- **Cloudflare Pages** — `_headers` and `_redirects` files configure response headers; ETag is preserved by default.
- **Netlify** — similar to Cloudflare Pages; `_headers` configures `Cache-Control` and CORS; ETag preserved.
- **Vercel** — `vercel.json`'s `headers` array configures response headers; `Cache-Control` defaults are conservative and producer-tunable.

This list is informational and not an endorsement; any platform that satisfies PRD-105-R10 through PRD-105-R13 is acceptable. The point is that the static profile's contract is hosting-agnostic.

### Example 5 — A negative case: static manifest with auth fields

A producer hand-writes a manifest declaring `delivery: "static"` but also populates `auth.schemes`, copy-pasted from a runtime example:

```json
{
  "act_version": "0.1",
  "site": { "name": "Acme Confused Docs" },
  "index_url": "/act/index.json",
  "node_url_template": "/act/n/{id}.json",
  "conformance": { "level": "core" },
  "delivery": "static",
  "auth": { "schemes": ["bearer", "oauth2"] }
}
```

This is a build-time error per PRD-105-R3. The static profile is unauthenticated by definition; auth scheme negotiation is the runtime profile's contract (in-flight sibling). PRD-600's static probe MUST emit a `gaps` entry citing PRD-105-R3. The producer either removes the `auth` block (the manifest is then valid Core static) or switches to `delivery: "runtime"` (the manifest is then evaluated against the runtime sibling).

Fixture: `fixtures/105/negative/static-manifest-with-auth-block.json`.

---

## Test fixtures

Fixtures live under `fixtures/105/` and are exercised by PRD-600 (validator) plus PRD-400 (generator)'s test suite. Each fixture is a single JSON file enumerating either a file-set listing, a response trace, or a manifest example.

### Positive

- `fixtures/105/positive/static-file-set-core-minimum.json` → enumerates the file paths for a minimum Core static deployment with three nodes. Satisfies PRD-105-R1, R2, R4, R5.
- `fixtures/105/positive/static-file-set-plus-corporate-marketing.json` → the Plus deployment from Example 2 / draft §6.5 / §8.4. Satisfies PRD-105-R6, R7, R7a (the search pattern); referenced by PRD-700-series.
- `fixtures/105/positive/manifest-static-no-runtime-fields.json` → a manifest declaring `delivery: "static"` with no runtime-only fields populated. Satisfies PRD-105-R3.
- `fixtures/105/positive/cdn-304-response-trace.json` → a request/response trace demonstrating correct 304 handling per PRD-105-R10.

### Negative

- `fixtures/105/negative/static-manifest-with-auth-block.json` → a static manifest that populates `auth.schemes`. PRD-600 MUST emit a `gaps` entry citing PRD-105-R3.
- `fixtures/105/negative/index-references-missing-node-file.json` → an index entry whose node file does not exist on disk. PRD-600's probe fetches and gets 404; MUST emit a `gaps` entry citing PRD-105-R5.
- `fixtures/105/negative/cdn-mutates-json-body.json` → a CDN that injects a `_cdn_meta` field into responses, breaking byte-equivalence between producer-emitted and consumer-received bytes. PRD-600 MUST emit a `gaps` entry citing PRD-105-R12.

Schemas for static-file-set and MIME-type validation live under `schemas/105/`:

- `schemas/105/static-file-set.schema.json`
- `schemas/105/mime-types.schema.json`

---

## Versioning & compatibility

Per PRD-108, classify each kind of change to PRD-105 as MAJOR or MINOR.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a new optional MIME-type value (e.g., introduce `application/act-changefeed+json` for a future change-feed endpoint) | MINOR | Adding to the MIME-type list, provided the new value is informational and not a rename of an existing one. New `+json` subtypes are additive. |
| Rename or remove an existing MIME-type value in the closed list | MAJOR | PRD-108-R5(4) — closed-enum modification. The list at PRD-105-R8 is closed. |
| Change the `; profile=static` parameter convention (e.g., replace with a separate header) | MAJOR | Changes how the profile is signaled on the wire. |
| Add an optional response header the CDN MAY set | MINOR | E.g., recommending `X-Content-Type-Options: nosniff`. Producers and consumers ignore unknown optional headers. |
| Change the well-known manifest path from `/.well-known/act.json` | MAJOR | PRD-101 owns the well-known location; if it ever changes, that's MAJOR for PRD-105 too. |
| Tighten PRD-105-R11 (`Cache-Control SHOULD`) to MUST | MAJOR | Per PRD-108-R5(3) — SHOULD-to-MUST is MAJOR even though it tightens. |
| Add a new conformance level requirement (e.g., a hypothetical "Plus+" with a new file type) | MAJOR | Per PRD-107's versioning — adding a level is MAJOR. PRD-105 follows. |
| Add a new build-time guarantee (PRD-105-R14, R15) classified as a SHOULD | MINOR | Provided it is genuinely advisory and not a hidden MUST. |
| Add a new build-time guarantee classified as a MUST | MAJOR | Per PRD-108-R5(3). |
| Specify a versioned-trees layout (per gap E2) normatively | MAJOR or MINOR depending on whether existing producers' layouts are valid under the new rule | Defer until a v0.x example exercises versioned trees; the gap E2 resolution is informational for v0.1. |
| Change the on-disk file extension recommendation from `.act.json` to something else | MAJOR | Producers may have built tooling around the extension; PRD-105-R9 says MAY but a MUST-not-`.act.json` is a wider semantic shift. |

### Forward compatibility

Per PRD-108-R7, consumers tolerate unknown optional fields and headers. A consumer that probes a static deployment and finds an unfamiliar `Content-Type` on a node file MUST treat it as a non-conformant deployment under PRD-105-R8 (the MIME-type list is closed); but a consumer that finds an unfamiliar `Cache-Control` directive or an unfamiliar HTTP header (e.g., a CDN-specific `X-Cache-Status`) MUST ignore it. The closed-MIME-type rule is the lever that lets us add new resource types later as a controlled MAJOR (or MINOR, for additions) bump rather than as silent drift.

### Backward compatibility

Within a MAJOR, every MINOR is backward-compatible per PRD-108. A static deployment built against PRD-105 v0.1 remains valid under v0.2; consumers tolerate any added optional headers or new optional resource types per PRD-108-R7. Across MAJOR boundaries, no backward compatibility is required; the deprecation window per PRD-108-R12 gives the ecosystem warning. PRD-105 introduces no deprecations in v0.1.

---

## Security considerations

PRD-109 is the project-wide security PRD; PRD-105 documents only the deltas specific to the static profile.

The static profile minimizes attack surface by construction:

- **No authentication.** Static content is served anonymously; there is no per-request derivation, no user-scoped data, no token handling, no session boundary. This eliminates entire classes of vulnerability that affect the runtime profile (auth bypass, token leakage, session fixation). PRD-105-R3 enforces this by prohibiting auth fields in static manifests.
- **No per-request computation.** Every byte the consumer fetches was written at build time. There is no template injection surface, no SQL-like injection surface, no server-side template evaluation. The CDN is a dumb file server.
- **CDN-level caching of stale auth-scoped data is non-applicable.** Because there is no auth scoping, there is no risk of one user seeing another user's cached content. The `Vary: Authorization` / `Vary: Cookie` concerns that affect runtime caching (per the in-flight runtime sibling PRD) are inapplicable here.

The remaining attack surface is at the **source-adapter / build-time layer**, owned by PRD-109:

- **Information disclosure via build inputs.** A markdown adapter that pulls draft-only docs into the build, a CMS adapter that includes unpublished entries, an i18n adapter that exposes internal-only translation keys — all of these are *adapter* (PRD-200 series) misconfigurations whose consequences land in the static deployment but whose root cause is upstream. PRD-109 owns the trust boundary at the adapter and the build-time configuration layer; PRD-105 only requires that the deployment, once built, faithfully serves what the adapter produced. A compromised adapter produces a compromised deployment; PRD-105 cannot detect this.
- **Build-pipeline integrity.** If an attacker compromises the build pipeline (poisoned npm dependency, compromised CI runner), they can inject content into the static deployment. The deployment will still be PRD-105-conformant; the integrity issue is upstream. PRD-109 owns supply-chain considerations.
- **CDN configuration drift.** A CDN reconfiguration that violates PRD-105-R12 (auto-injects metadata, auto-mutates JSON) is a configuration error, not a wire-format vulnerability. PRD-600 detects this; PRD-105 prohibits it. The remediation is a CDN configuration change, not a spec change.

Cite PRD-109 (the in-flight sibling) for the project-wide PII posture, the source-adapter trust boundary, and the supply-chain integrity rules. PRD-105 introduces no new PII handling; the static profile inherits whatever the producer's content-curation process authorized for public exposure.

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft per gap A4 (static error model: 200/304/404 only), gap B5 (file extension `.act.json` and provisional MIME types), gap C5 (hybrid mounts, static parent's responsibilities), gap E2 (versioned trees, informational). Cites PRD-107 (Accepted) for the conformance-level decomposition, PRD-108 (Accepted) for the versioning classification table, and PRD-103 (in-flight) for ETag derivation. Status: In review. |
| 2026-05-01 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
