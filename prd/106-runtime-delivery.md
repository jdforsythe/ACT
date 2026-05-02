# PRD-106 — Runtime delivery profile (HTTP endpoints, auth, hybrid mounts)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

The v0.1 working draft (`docs/plan/v0.1-draft.md` §5.13) sketches a "runtime profile" — an ACT producer that responds to HTTP requests with the same JSON envelopes the static profile writes to a CDN — but leaves the contract loose: the endpoint table is illustrative, the `auth` block is sketched without a negotiation rule, the per-tenant scoping mechanism is a paragraph of intent, ETag derivation under auth is hand-waved, hybrid `mounts` semantics are demonstrated by example but not specified, and there is no defined discovery hand-off for runtime-only deployments that serve nothing publicly. Every gap in the C-tier of `prd/000-gaps-and-resolutions.md` (C1–C5) plus A3 (URL encoding of IDs at the runtime substitution boundary), A4 (runtime status codes and error envelope), and A5 (runtime-only discovery hand-off via Link header) is downstream of this PRD. Until the runtime contract is locked, PRD-500 (runtime SDK) cannot stabilize, PRD-501 (Next.js runtime SDK) and PRD-505 (Hono) cannot specify their handler shapes, PRD-705 (B2B SaaS workspace example) has no shape to populate, and PRD-602 (ACT-MCP bridge) has no neighbor to coexist with.

### Goals

1. Lock the runtime endpoint set (well-known manifest, index, NDJSON index, node, subtree, search) and the HTTP status codes each may return, including the closed error-code enum and the `WWW-Authenticate` requirement on 401.
2. Specify auth scheme negotiation (ordered preference; one `WWW-Authenticate` per advertised scheme; OAuth 2.0 endpoint and scope requirements; API key conventions; anonymous public access permitted).
3. Pin per-tenant ID stability across requests so cache keys are usable, and forbid silent ID rotation across token refreshes.
4. Specify URL-encoding rules for IDs substituted into `node_url_template` and `subtree_url_template`, so two clients computing the same URL always reach the same resource.
5. Lock hybrid `mounts` discovery semantics: flat array, no recursion, longest-prefix matching, overlapping prefixes are validation errors, cross-origin mounts permitted with consumer-side trust.
6. Specify the runtime-only discovery hand-off: `Link: rel="act"` HTTP header on every authenticated response, the optional `<link rel="act">` HTML element, manifest sets `delivery: "runtime"` to confirm.
7. Define how runtime-profile requirements are banded across Core / Standard / Plus per PRD-107, so consumers can ask for "minimum Standard, runtime profile" and have a concrete contract to verify.

### Non-goals

1. Defining the wire-format envelope shapes (manifest, index, node, subtree, search). That is owned by the wire-format PRD (gap A4 sibling, PRD-100). PRD-106 references envelope shapes but does not redefine them.
2. Defining ETag derivation under runtime + per-tenant scoping. That is owned by gap C2 sibling (PRD-103). PRD-106 only requires that consumers honor `If-None-Match` and that servers send `ETag`, citing PRD-103 for the recipe.
3. Defining the discovery flow itself (well-known URL, content negotiation, fallback rules). That is owned by the discovery sibling (PRD-101). PRD-106 references the hand-off and the `Link` header; PRD-101 specifies the discovery flow.
4. Defining the static profile (file layout, CDN posture, build-time invariants). That is owned by the static-profile sibling (PRD-105). PRD-106 covers runtime exclusively.
5. Defining i18n (per-locale endpoints, `locales` block). That is owned by the i18n sibling (PRD-104). PRD-106 mentions locale endpoints as a Plus capability and defers shape to PRD-104.
6. Defining block taxonomy (`marketing:*` namespace, `abstract`, `related`). That is owned by the disclosure / blocks sibling (PRD-102). PRD-106 cites PRD-102 by topic for capability bands but does not respecify any block.
7. Streaming, subscriptions, and change feeds. Explicitly deferred to v0.2 per draft §5.13.6 and gap F1.
8. Defining the ACT-MCP bridge. That is PRD-602; coexistence is acknowledged but not specified here.
9. Defining the security threat model (existence-non-leak rules, identity-handling on ETags, origin trust on cross-origin mounts). That is the security sibling (PRD-109). PRD-106 imports requirements by reference.

### Stakeholders / audience

- **Authors of:** PRD-500 (runtime SDK contract), PRD-501 (Next.js runtime SDK), PRD-503 (FastAPI runtime SDK, `(spec only)`), PRD-504 (Rails runtime SDK, `(spec only)`), PRD-505 (Hono / generic WHATWG runtime SDK), PRD-602 (ACT-MCP bridge — coexistence neighbor), PRD-705 (B2B SaaS workspace example), PRD-600 (validator — must implement runtime probes against this PRD's requirements).
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Auth scheme advertisement order is misinterpreted as a security signal rather than a preference order, leading consumers to refuse otherwise-acceptable schemes lower in the list. | Medium | Medium | PRD-106-R7 defines `schemes` as preference, not policy. PRD-106-R8 makes consumer fallback explicit. PRD-109 owns the trust posture. |
| Existence-leak via timing or differential WWW-Authenticate handling — the header set on a 401 for a real-but-protected resource differs from the set on a 401 for a non-existent resource. | Medium | High | PRD-106-R6 requires that 404 covers both "not present" and "present-but-not-accessible" identically; PRD-106-R8 fixes the WWW-Authenticate set as a function of the manifest's advertised schemes, not the requested URL. Cross-cuts PRD-109. |
| ETag carries identity material (e.g., `etag = sha256(content + user_id)`) in a way that allows offline correlation across users sharing the same ETag input space. | Low | High | PRD-106-R12 cites PRD-103 for derivation. PRD-103 + PRD-109 own the no-leak rule. PRD-106 forbids servers from mixing request-local data into ETags directly here as a belt-and-suspenders measure (cross-reference). |
| Hybrid `mounts` overlap detection is implementer-defined and producers ship overlapping prefixes that "happen to work" on one consumer and fail on another. | Medium | Medium | PRD-106-R20 makes overlapping prefixes a validation error; PRD-600 enforces. The longest-prefix rule (PRD-106-R19) is pinned. |
| The runtime-only Link header (PRD-106-R23) is a privacy footgun if it leaks `/.well-known/act.json` to unauthenticated requesters whose authenticated response surface is not yet decided. | Low | Medium | PRD-106-R23 scopes the requirement to *authenticated* responses; unauthenticated branches MAY omit. PRD-101 owns broader discovery. |
| Subtle URL-encoding mismatches between adapters and consumers (e.g., one encodes `/`, the other does not) break per-tenant cache reuse. | Medium | Medium | PRD-106-R14 fixes the encoding rule (RFC 3986 §3.3 `pchar` per segment, `/` preserved). PRD-106-R15 mandates that two URLs decoding to the same canonical ID MUST resolve to the same resource. PRD-600 enforces. |

### Open questions

1. **Streaming / subscriptions.** v0.1 explicitly defers (draft §5.13.6, gap F1). The deferral is restated in this PRD's §"Streaming and subscriptions" subsection of Non-goals. Revisit in v0.2 review, likely as a sibling PRD specifying SSE.
2. **Forward dependency on PRD-602 (ACT-MCP bridge).** A runtime ACT server may coexist with an MCP server; this PRD does not specify the bridge or any shared transport. PRD-602's MCP version range is decision Q6 (decided 2026-04-30: MCP 1.0 minimum + forward-compat shim). Forward reference only.
3. **Q6: should runtime ACT formally co-declare an MCP discovery hand-off?** Tentatively no for v0.1 — that is PRD-602's surface — but flagging here so PRD-602 authors do not have to reopen this question. (See "Proposed new questions" in changelog notes.)
4. **Optional `Retry-After` semantics on 429.** RFC 9110 permits both delta-seconds and HTTP-date. PRD-106-R6 requires `Retry-After`; the choice between forms is left to the producer. Revisit if PRD-600 surfaces interop bugs.
5. **`Cache-Control: private, must-revalidate` as default.** PRD-106-R12 makes this a SHOULD. Some operators may want `no-store` for highly sensitive tenants. Revisit if PRD-109 escalates.

### Acceptance criteria

- [ ] Endpoint set is enumerated with conformance band per endpoint.
- [ ] HTTP status codes (200, 304, 401, 403, 404, 410, 429, 5xx) are defined with response-shape and header requirements per code.
- [ ] Error envelope JSON Schema fragment is inlined and cross-references PRD-100.
- [ ] Auth scheme negotiation is specified end-to-end (manifest declaration, 401 response, consumer fallback, OAuth 2.0 fields, API key conventions, anonymous access).
- [ ] ID URL-encoding rules are pinned (RFC 3986 §3.3 `pchar` per segment).
- [ ] Per-tenant ID stability is pinned (stable across token refresh; new resource on tenancy change).
- [ ] Hybrid `mounts` semantics are pinned (flat, no recursion, longest-prefix, overlapping = validation error, cross-origin permitted with consumer-side trust).
- [ ] Discovery hand-off requirement is pinned (Link header on authenticated responses; HTML link element on authenticated HTML; manifest `delivery: "runtime"`).
- [ ] Streaming / subscriptions explicitly deferred.
- [ ] Schemas saved under `schemas/106/`; fixtures under `fixtures/106/{positive,negative}/`.
- [ ] Worked examples replicate draft §6.6 (Next.js runtime SDK) and §8.6 (B2B SaaS workspace).
- [ ] Security section cross-references PRD-109 explicitly.
- [ ] Changelog entry dated 2026-05-01 is present.

---

## Context & dependencies

### Depends on

- **PRD-107** (Conformance levels): Accepted. Owns the level/profile orthogonality rule (R4) and the `mounts` shape (R5) that PRD-106 extends with runtime-specific constraints.
- **PRD-108** (Versioning policy): Accepted. Owns the `act_version` field shape and the closed-enum-bump rule. PRD-106's error-code enum is closed per PRD-108-R5(4).
- **000-governance**: Accepted. Owns the lifecycle rules under which this PRD transitions Draft → In review → Accepted.
- **Wire-format sibling (gap A4 owner, PRD-100)**: in-flight (sibling). Owns envelope shapes referenced here.
- **Discovery sibling (PRD-101)**: in-flight. Owns the well-known URL semantics and the broader discovery flow into which the runtime-only Link header (PRD-106-R23) plugs.
- **Disclosure / blocks sibling (PRD-102)**: in-flight. Owns the block taxonomy referenced by the conformance-band table.
- **Caching sibling (gap C2 owner, PRD-103)**: in-flight. Owns ETag derivation under runtime + per-tenant scoping. PRD-106 cites for ETag/304 behavior.
- **i18n sibling (PRD-104)**: in-flight (expected last). Owns per-locale endpoints; PRD-106 cites for the Plus locale endpoint requirement.
- **Static-profile sibling (PRD-105)**: in-flight. Symmetric counterpart to this PRD; together they cover the two delivery profiles.
- **Security sibling (PRD-109)**: in-flight. Owns existence-non-leak posture, ETag-no-leak-identity rule, origin trust on cross-origin mounts, PII posture.
- External: [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) (normative keywords); [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986) (URI generic syntax — `pchar` rules at §3.3 govern path-segment encoding); [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) (HTTP semantics — `WWW-Authenticate`, `Retry-After`, `If-None-Match`, `ETag`, `Cache-Control`, `Vary`); [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288) (HTTP `Link` header).

### Blocks

- **PRD-500** (Runtime SDK contract) — depends on this PRD's endpoint set and auth negotiation rules.
- **PRD-501** (Next.js runtime SDK).
- **PRD-503** (FastAPI runtime SDK, `(spec only)`).
- **PRD-504** (Rails runtime SDK, `(spec only)`).
- **PRD-505** (Hono / generic WHATWG runtime SDK).
- **PRD-602** (ACT-MCP bridge) — coexistence neighbor; not strictly blocked but co-authored.
- **PRD-705** (B2B SaaS workspace example) — depends on the runtime contract for its sample server.
- **PRD-600** (Validator) — must implement runtime probes against this PRD's requirements.

### References

- v0.1 draft: §5.13 (Runtime serving), §5.13.1 (Runtime contract), §5.13.2 (Authentication), §5.13.3 (Caching), §5.13.4 (Per-tenant scoping), §5.13.5 (Hybrid mounts), §5.13.6 (Streaming — deferred), §6.6 (Runtime SDK pattern, Next.js example), §8.6 (B2B SaaS workspace example).
- `prd/000-gaps-and-resolutions.md`: A3 (ID grammar; runtime URL component encoding), A4 (runtime error envelope and status codes), A5 (runtime-only discovery hand-off — Link header + HTML link), C1 (level/profile orthogonality), C2 (ETag derivation under runtime + per-tenant), C3 (auth scheme negotiation), C4 (per-tenant ID stability), C5 (hybrid mounts discovery semantics).
- `prd/000-decisions-needed.md`: Q6 (MCP version range — decided 2026-04-30; relevant to PRD-602, mentioned here as forward dep for hybrid runtime+MCP scenarios).
- Prior art: REST best-practice 401-vs-404 patterns (Roy Fielding's REST APIs must be hypertext-driven discussion); GitHub API and Stripe API existence-non-leak conventions (404 for both "not found" and "no permission"); RFC 7807 problem-details (NOT adopted — PRD-100's error envelope is the chosen shape, simpler and `+json` rather than `+json` problem); OAuth 2.0 [RFC 6749](https://www.rfc-editor.org/rfc/rfc6749) and OAuth 2.1 (in flight).

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) where requirements are imposed. Lowercase "must" and "should" are non-normative prose.

### Conformance level

Per PRD-107, runtime-profile requirements are banded:

- **Core:** PRD-106-R1 (well-known + index + node endpoints), R2 (`act_version` on every response per PRD-108), R3 (200, 304), R4 (`ETag` header), R5 (manifest declares `auth` block when authentication is required, OR omits `auth` for anonymous public-tenant runtime access), R6 (status codes 401/403/404/410/429/5xx), R7 (auth scheme advertisement order), R8 (one WWW-Authenticate per scheme), R9 (OAuth 2.0 manifest fields), R10 (API key default), R11 (anonymous public access permitted), R12 (caching: ETag/304/Cache-Control), R13–R15 (ID grammar URL-encoding), R16 (per-tenant ID stability), R17 (`delivery: "runtime"` declaration), R23 (Link header on authenticated responses), R24 (HTML link element on authenticated HTML — SHOULD, not MUST), R25 (manifest sets `delivery: "runtime"` to confirm), R26–R30 (error envelope shape + the closed code enum).
- **Standard:** PRD-106-R31 (subtree endpoint reachable for declared subtree IDs).
- **Plus:** PRD-106-R32 (NDJSON index endpoint), R33 (search endpoint), R34 (per-locale endpoints — defers to PRD-104).

`mounts`-related requirements (PRD-106-R17–R22) apply at any level; per PRD-107-R5, each mount entry independently declares its own `delivery` and MAY declare its own `conformance.level`.

### Normative requirements

#### Endpoint set

**PRD-106-R1.** A runtime ACT producer MUST expose the following Core endpoints:

- `GET <well_known_url>` — the well-known ACT manifest URL (per PRD-101). Returns the manifest envelope.
- `GET <index_url>` — the index endpoint declared by the manifest. Returns the index envelope, scoped to nodes the requester is authorized to see per the `(identity, tenant)` resolution (PRD-106-R16, PRD-109).
- `GET <node_url_template>` substituted per node ID — the node endpoint. Returns the node envelope.

A runtime ACT producer at Standard MUST additionally expose:

- `GET <subtree_url_template>` substituted per node ID — the subtree endpoint. Returns the subtree envelope.

A runtime ACT producer at Plus MUST additionally expose:

- `GET <index_ndjson_url>` — the NDJSON index endpoint. Returns the NDJSON-encoded index, one node-index entry per line.
- `GET <search_url_template>` substituted with a query string — the search endpoint. Returns the search envelope (shape defined in draft §5.9; PRD-100 owns the schema).

**PRD-106-R2.** Every successful (`2xx`) response and every error (`4xx`/`5xx`) response with a JSON body MUST include `act_version` at the top of the JSON body, per PRD-108-R1. This applies to envelopes, NDJSON entries (each line's object), and the runtime error envelope.

#### Status codes

**PRD-106-R3.** Producers MUST honor `If-None-Match` and respond `304 Not Modified` when the request's `If-None-Match` value matches the resource's current ETag. The 304 response MUST carry the `ETag` header but no JSON body.

**PRD-106-R4.** Successful (`200`) responses MUST include the `ETag` HTTP header whose value matches the envelope's `etag` field (PRD-103 owns the derivation; PRD-106 only requires presence and parity).

**PRD-106-R5.** When authentication is required to satisfy a request, the producer MUST respond `401 Unauthorized` and MUST include at least one `WWW-Authenticate` header per RFC 9110 §11.6.1. The headers' values are constrained by PRD-106-R7 and PRD-106-R8.

**PRD-106-R6.** Producers MUST distinguish the following client-error conditions exactly as follows:

- **401 Unauthorized.** Authentication is required and was not supplied (or was supplied and rejected). MUST include `WWW-Authenticate`. The set of `WWW-Authenticate` headers MUST be a function of the manifest's advertised auth schemes (PRD-106-R8), NOT of whether the requested resource exists. This is the existence-non-leak rule for 401.
- **403 Forbidden.** The requester is authenticated and the producer has a *policy* reason to reject the request that does not depend on the existence of the resource — e.g., a quota violation, a tenant-policy rule, a feature flag — and the existence of the resource is already known to the requester through some other channel. SHOULD be rare; producers SHOULD prefer 404 over 403 to avoid leaking existence (cite PRD-109).
- **404 Not Found.** The resource is not found OR the requester is authenticated but not authorized to access it. Both cases MUST return 404 with no distinguishing signal in status code, headers, or body. This is the existence-non-leak rule for 404.
- **410 Gone.** A resource that previously existed at this ID has been deleted, AND the producer wishes consumers to evict cached copies. Optional; producers MAY return 404 instead. When 410 is used, the producer SHOULD ensure consistency across replicas (the same deletion produces 410 from every replica, not 410 from one and 404 from another).
- **429 Too Many Requests.** Rate-limited. MUST include the `Retry-After` header per RFC 9110 §10.2.3.
- **5xx.** Server error. SHOULD return the runtime error envelope (PRD-106-R26) with `error.code: "internal"`. Producers MAY omit the body when no usable detail is available; consumers MUST tolerate either case.

#### Authentication

**PRD-106-R7.** When the manifest declares `auth.schemes`, the array MUST be ordered most-preferred-first. Consumers SHOULD attempt schemes in advertised order, falling back on failure.

**PRD-106-R8.** A 401 response MUST include exactly one `WWW-Authenticate` header per advertised scheme in `auth.schemes`, in the same preference order. The `WWW-Authenticate` value for each scheme MUST conform to the relevant scheme's RFC (Bearer per RFC 6750; OAuth 2.0 challenge fields per RFC 6750 §3 and RFC 9110 §11.6.1; cookie auth's WWW-Authenticate value SHOULD reflect the host's session realm). The set of headers MUST NOT vary by requested URL — varying it would leak existence (cite PRD-109).

**PRD-106-R9.** When `auth.schemes` contains `"oauth2"`, the manifest's `auth.oauth2` object MUST include all of: `authorization_endpoint`, `token_endpoint`, and a non-empty `scopes_supported` array. The minimum scope `act.read` is reserved by this PRD; producers SHOULD include `act.read` in `scopes_supported` when read access maps to OAuth scopes.

**PRD-106-R10.** When `auth.schemes` contains `"api_key"`, the manifest SHOULD declare the request header carrying the key. The default and RECOMMENDED form is `Authorization: Bearer <key>` to avoid custom-header proliferation. Producers that diverge MUST advertise `auth.api_key.header` in the manifest.

**PRD-106-R11.** Anonymous public access is permitted. A producer that requires no authentication for any endpoint MAY omit the `auth` block from the manifest entirely OR supply an empty object. In both cases, 401 MUST NOT be returned for any endpoint, and `WWW-Authenticate` MUST NOT be sent.

#### Caching

**PRD-106-R12.** Runtime producers MUST honor `If-None-Match` per PRD-106-R3 and MUST send `ETag` per PRD-106-R4. The ETag derivation is owned by the caching sibling (PRD-103); PRD-106 does not respecify it. Producers SHOULD send `Cache-Control: private, must-revalidate` for auth-scoped responses and MAY send `public, max-age=...` only for unauthenticated public-tenant responses (PRD-106-R11). When auth-scoped responses are served, producers SHOULD include `Vary: Authorization` (or `Vary: Cookie` for cookie auth) so intermediaries do not serve the wrong principal's content.

#### URL encoding of IDs

**PRD-106-R13.** The ID grammar is owned by the wire-format sibling (PRD-100, gap A3). For the runtime profile's URL substitution, IDs match `^[a-z0-9]([a-z0-9._-]|/)*[a-z0-9]$` per gap A3.

**PRD-106-R14.** When substituting an ID into `node_url_template` or `subtree_url_template`, each path segment of the ID (segments delimited by `/`) MUST be percent-encoded with the `pchar` rules of RFC 3986 §3.3 (unreserved + sub-delims + `:` + `@`, with all other octets percent-encoded). The `/` between segments MUST be preserved verbatim (NOT percent-encoded as `%2F`). Producers MUST emit URLs that follow this rule; consumers MUST follow this rule when constructing requests.

**PRD-106-R15.** Servers MUST decode percent-encoding consistently. Two URLs that decode to the same canonical ID MUST resolve to the same resource. A server MUST NOT accept `/act/n/foo%2Fbar.json` and `/act/n/foo/bar.json` as distinct resources when both decode to the canonical ID `foo/bar`; they are the same ID and MUST yield the same response (subject to auth scoping, ETag freshness, etc.).

#### Per-tenant ID stability

**PRD-106-R16.** A runtime ID MUST be stable across the lifetime of the underlying resource, for a given `(resource, identity, tenant)` triple. Specifically:

- Producers MUST NOT mint per-request-unique IDs (e.g., UUIDs minted at fetch time).
- Identity rotation (token refresh, session renewal) MUST NOT change the ID as long as the underlying principal is the same.
- A resource that changes tenancy is a NEW resource: the old ID becomes 404 (or, if the producer wishes consumers to evict, 410 per PRD-106-R6).

PRD-106-R16 is a content-stability rule; security implications (correlatable IDs) are owned by PRD-109.

#### Hybrid mounts

**PRD-106-R17.** A producer MAY declare a `mounts` array on the manifest envelope per PRD-107-R5. Each entry MUST conform to the mounts-entry schema below.

**PRD-106-R18.** Mounts MUST NOT recurse. A manifest reached via a parent's `mounts` entry MUST NOT itself declare further `mounts`. Producers that violate this rule produce a manifest that PRD-600 MUST flag as invalid.

**PRD-106-R19.** `prefix` is an origin-relative URL path prefix. When a consumer fetches a path, the consumer MUST select the mount whose `prefix` is the **longest prefix** of the request path. If no mount's `prefix` matches, the request falls through to the parent manifest's index (or to a 404 if the parent has no matching coverage).

**PRD-106-R20.** Overlapping prefixes within a single `mounts` array — i.e., two entries where one entry's `prefix` is a prefix of the other's, OR where two entries share an identical `prefix` — are a manifest validation error. Producers MUST NOT emit overlapping prefixes; PRD-600 MUST reject them. Note: a parent's coverage and a mount's `prefix` are NOT "overlapping" in this sense — the parent's coverage is the fall-through and the mount is the override; that hierarchy is permitted by PRD-106-R19.

**PRD-106-R21.** Each mount entry MUST carry its own `delivery` value (`"static"` or `"runtime"`) per PRD-107-R5 and MAY carry its own `conformance.level`. A mount that omits `conformance.level` inherits the parent's level per PRD-107-R5.

**PRD-106-R22.** `manifest_url` on a mount entry MAY be absolute (cross-origin) or origin-relative (same-origin). When cross-origin, the consumer MUST evaluate origin trust before honoring the mount; the trust rule is owned by PRD-109. PRD-106 imposes no additional constraint beyond well-formed URI.

#### Discovery hand-off (runtime-only)

**PRD-106-R23.** A runtime-only deployment — one that does not serve a public static manifest at the discoverable path — MUST emit, on every authenticated response (regardless of media type), the HTTP header:

```
Link: </.well-known/act.json>; rel="act"; type="application/act-manifest+json"; profile="runtime"
```

The path component of the Link target MAY be relative or absolute. The `profile="runtime"` parameter is REQUIRED.

**PRD-106-R24.** A runtime-only deployment SHOULD additionally emit, on every authenticated HTML response, the HTML link element:

```html
<link rel="act" href="/.well-known/act.json" type="application/act-manifest+json; profile=runtime">
```

This is a SHOULD, not a MUST: HTML responses are a subset of authenticated responses, and the HTTP `Link` header from PRD-106-R23 already covers them.

**PRD-106-R25.** The manifest MUST set `delivery: "runtime"` to confirm the runtime profile per PRD-107-R3. A producer that emits the discovery hand-off Link header but whose manifest declares `delivery: "static"` is a profile-declaration mismatch; PRD-600 MUST flag it.

#### Error envelope

**PRD-106-R26.** Runtime 4xx and 5xx responses MUST return the runtime error envelope, defined as:

```json
{
  "act_version": "<MAJOR.MINOR>",
  "error": {
    "code": "<closed-enum-value>",
    "message": "<human-readable, no PII>",
    "details": { "/* optional, code-specific */": "..." }
  }
}
```

The shape is owned by PRD-100 (gap A4); PRD-106 re-emits it for self-containment in `schemas/106/error-envelope.schema.json`.

**PRD-106-R27.** `error.code` is a **closed enum**: `"auth_required"`, `"not_found"`, `"rate_limited"`, `"internal"`, `"validation"`. Adding a value is a MAJOR change per PRD-108-R5(4).

**PRD-106-R28.** `error.code` mapping per status code:

- 401 → `"auth_required"`
- 404 → `"not_found"` (regardless of whether the resource was authentication-blocked or genuinely missing — PRD-106-R6)
- 410 → `"not_found"` (no separate `"gone"` code; the 410 status is the distinguisher)
- 429 → `"rate_limited"`
- 5xx → `"internal"`
- 4xx other than the above (when used at all by the producer) → `"validation"`

A 403, when used per PRD-106-R6, SHOULD use code `"not_found"` to align with the existence-non-leak posture (the consumer is being told "there is no resource here for you" without finer granularity); producers MAY use `"validation"` if the rejection is genuinely a validation issue.

**PRD-106-R29.** `error.message` MUST NOT contain PII (e.g., email addresses, IP addresses of other users, raw tokens, session IDs). Producers MUST NOT include the requested URL or query parameters in `error.message` if those carry auth-scoped identifiers.

**PRD-106-R30.** `error.details` is OPTIONAL. When present, it MUST be a JSON object with a code-specific stable shape. Producers MUST NOT embed request bodies, identity material, or auth-scoped IDs inside `details`. PRD-100 owns the per-code `details` shapes (none required for v0.1; future MINOR bumps MAY add them).

#### Standard-level endpoint

**PRD-106-R31.** A Standard runtime producer MUST expose `<subtree_url_template>` substituted per node ID, returning the subtree envelope. The shape is owned by PRD-100 (subtree envelope) and PRD-102 (block taxonomy inside subtrees).

#### Plus-level endpoints

**PRD-106-R32.** A Plus runtime producer MUST expose `<index_ndjson_url>`, returning the NDJSON index. Each line MUST be a single node-index entry as a JSON object, with `act_version` per line per PRD-108-R1 (NDJSON line-as-document semantics).

**PRD-106-R33.** A Plus runtime producer MUST expose `<search_url_template>` substituted with the query string, returning the search envelope. The search envelope shape is owned by PRD-100 (search envelope) and draft §5.9.

**PRD-106-R34.** A Plus runtime producer with multi-locale content MUST expose per-locale endpoints per PRD-104. PRD-106 imposes no shape here; the requirement is restated for the conformance band only.

### Wire format / interface definition

#### `manifest.auth` (JSON Schema fragment)

The full schema is at `schemas/106/auth-block.schema.json`; the runtime-relevant fragment is inlined here for reference.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "ACT Manifest — auth block (runtime profile)",
  "type": "object",
  "additionalProperties": false,
  "required": ["schemes"],
  "properties": {
    "schemes": {
      "type": "array",
      "minItems": 1,
      "uniqueItems": true,
      "items": { "type": "string", "enum": ["cookie", "bearer", "oauth2", "api_key"] },
      "description": "Ordered, most-preferred-first. PRD-106-R7."
    },
    "oauth2": {
      "type": "object",
      "additionalProperties": false,
      "required": ["authorization_endpoint", "token_endpoint", "scopes_supported"],
      "properties": {
        "authorization_endpoint": { "type": "string", "format": "uri" },
        "token_endpoint": { "type": "string", "format": "uri" },
        "scopes_supported": {
          "type": "array", "minItems": 1, "uniqueItems": true,
          "items": { "type": "string" }
        }
      }
    },
    "api_key": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "header": { "type": "string", "default": "Authorization" },
        "format": { "type": "string", "enum": ["bearer", "raw"], "default": "bearer" }
      }
    }
  },
  "allOf": [
    {
      "if": { "properties": { "schemes": { "contains": { "const": "oauth2" } } } },
      "then": { "required": ["oauth2"] }
    }
  ]
}
```

#### `manifest.mounts[*]` (JSON Schema fragment, runtime-extended)

The full schema is at `schemas/106/mounts-entry.schema.json`; PRD-107-R5 already pinned the basic shape, extended below for runtime-specific constraints.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "ACT Manifest — single mounts entry (runtime + hybrid)",
  "type": "object",
  "additionalProperties": false,
  "required": ["prefix", "delivery", "manifest_url"],
  "properties": {
    "prefix": {
      "type": "string",
      "pattern": "^/([A-Za-z0-9._~!$&'()*+,;=:@%-]+(/[A-Za-z0-9._~!$&'()*+,;=:@%-]+)*)?/?$"
    },
    "delivery": { "type": "string", "enum": ["static", "runtime"] },
    "manifest_url": { "type": "string", "format": "uri-reference" },
    "conformance": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "level": { "type": "string", "enum": ["core", "standard", "plus"] }
      }
    },
    "mounts": false
  }
}
```

`"mounts": false` enforces the in-entry no-recursion rule (PRD-106-R18). The cross-document check — that a mount's *referenced manifest* MUST NOT itself declare `mounts` — is enforced by PRD-600 at probe time.

#### Runtime error envelope (JSON Schema fragment)

The full schema is at `schemas/106/error-envelope.schema.json`. The shape is owned by PRD-100; this PRD re-emits for self-containment.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "ACT Runtime — error envelope",
  "type": "object",
  "additionalProperties": false,
  "required": ["act_version", "error"],
  "properties": {
    "act_version": { "type": "string", "pattern": "^[0-9]+\\.[0-9]+$" },
    "error": {
      "type": "object",
      "additionalProperties": false,
      "required": ["code", "message"],
      "properties": {
        "code": {
          "type": "string",
          "enum": ["auth_required", "not_found", "rate_limited", "internal", "validation"]
        },
        "message": { "type": "string", "minLength": 1 },
        "details": { "type": "object" }
      }
    }
  }
}
```

### Errors

| Condition | Response | Notes |
|---|---|---|
| Unauthenticated request reaches a Core endpoint that requires auth | `401` + `WWW-Authenticate` per scheme + error envelope `code: "auth_required"` | PRD-106-R5, R8, R28. WWW-Authenticate set is a function of manifest-advertised schemes, not request URL. |
| Authenticated request reaches a resource the principal cannot see | `404` + error envelope `code: "not_found"` | PRD-106-R6, R28. Existence-non-leak: same response as a genuinely missing resource. Cite PRD-109. |
| Authenticated request reaches a resource that has been deleted | `410` (optional) + error envelope `code: "not_found"`, OR `404` | PRD-106-R6, R28. Producer's choice; consumers MUST tolerate either. |
| Rate limit exceeded | `429` + `Retry-After` + error envelope `code: "rate_limited"` | PRD-106-R6, R28. `Retry-After` MUST be present per RFC 9110 §10.2.3. |
| Server error | `5xx` + error envelope `code: "internal"` (body MAY be omitted) | PRD-106-R6, R28. |
| Manifest declares `auth.schemes` with `"oauth2"` but lacks `oauth2.authorization_endpoint`, `oauth2.token_endpoint`, or `oauth2.scopes_supported` | Manifest validation error at load time | PRD-106-R9. PRD-600 emits a `gaps` entry per PRD-107-R19. |
| Manifest declares `delivery: "static"` but the deployment serves only via runtime (no public static manifest) | Manifest validation error | PRD-106-R25. Profile-declaration mismatch. |
| `mounts` array contains overlapping prefixes | Manifest validation error | PRD-106-R20. |
| A mount's referenced manifest itself declares `mounts` | Manifest validation error at probe time | PRD-106-R18. |
| `node_url_template` substitution does not percent-encode reserved characters per RFC 3986 §3.3 | Producer validation error | PRD-106-R14. PRD-600 enforces. |

---

## Examples

Examples are non-normative but consistent with the Specification section. PRD-600 will validate them at probe time.

### Example 1 — Next.js runtime SDK pattern (replicates draft §6.6)

```typescript
// app/.well-known/act.json/route.ts
import { actManifestHandler } from '@act/runtime/next';

export const GET = actManifestHandler({
  resolveManifest: async (req) => ({
    act_version: '0.1',
    site: { name: 'Acme Workspace' },
    delivery: 'runtime',
    conformance: { level: 'core' },
    auth: {
      schemes: ['cookie', 'bearer'],
    },
    index_url: '/act/index.json',
    node_url_template: '/act/n/{id}.json',
  }),
});
```

```typescript
// app/act/index.json/route.ts
import { actIndexHandler } from '@act/runtime/next';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

export const GET = actIndexHandler({
  resolveIndex: async (req) => {
    const user = await getCurrentUser(req);
    if (!user) return { unauthorized: true }; // SDK emits 401 + WWW-Authenticate per advertised schemes (PRD-106-R5, R8).

    const docs = await db.documents.findMany({
      where: { tenantId: user.tenantId, accessibleTo: user.id },
      select: { id: true, title: true, summary: true, updatedAt: true, parentId: true },
    });

    return {
      nodes: docs.map((d) => ({
        id: `doc/${d.id}`,                      // ID grammar per gap A3 / PRD-106-R13.
        type: 'article',
        title: d.title,
        summary: d.summary,
        tokens: { summary: estimateTokens(d.summary), body: 0 },
        etag: hashFor(d, user),                 // ETag derivation per PRD-103.
        updated_at: d.updatedAt.toISOString(),
        parent: d.parentId ? `doc/${d.parentId}` : null,
        children: [],
      })),
    };
  },
});
```

```typescript
// app/act/n/[...id]/route.ts
// Note: the catch-all [...id] segment is required because IDs may contain `/`
// (e.g., "doc/proj-launch-2026"). The SDK's helpers handle PRD-106-R14 (per-segment
// percent-encoding with `/` preserved) and PRD-106-R15 (canonical decoding).
import { actNodeHandler } from '@act/runtime/next';

export const GET = actNodeHandler({
  resolveNode: async (req, { id }) => { /* ... */ },
});
```

The SDK handles PRD-106-R2 (`act_version` injection), PRD-106-R3/R4 (ETag / 304), PRD-106-R5/R8 (401 with WWW-Authenticate), PRD-106-R12 (Cache-Control / Vary), PRD-106-R14/R15 (URL encoding), PRD-106-R23 (Link header on every authenticated response), and PRD-106-R26 (error envelope on 4xx/5xx). The application code only writes resolution logic.

### Example 2 — B2B SaaS workspace (replicates draft §8.6)

```
acme.com (marketing)              → static ACT  (PRD-105 — sibling)
docs.acme.com                     → static ACT  (PRD-105)
app.acme.com (authenticated)      → runtime ACT (this PRD)
```

A user (`alex@acme.com`) signs into the app. Their browser-based agent (Claude in Chrome) fetches `https://app.acme.com/.well-known/act.json` carrying the existing session cookie. Manifest:

```json
{
  "act_version": "0.1",
  "site": { "name": "Acme — alex@acme.com's workspace" },
  "delivery": "runtime",
  "conformance": { "level": "standard" },
  "auth": { "schemes": ["cookie", "bearer"] },
  "index_url": "/act/index.json",
  "node_url_template": "/act/n/{id}.json",
  "subtree_url_template": "/act/sub/{id}.json",
  "policy": { "rate_limit_per_minute": 120 }
}
```

The agent then `GET`s `/act/index.json`. The server scopes to documents Alex can access in their tenant, returns 200 with `ETag: "s256:8a..."`, `Cache-Control: private, must-revalidate`, `Vary: Cookie`, and the discovery hand-off `Link: </.well-known/act.json>; rel="act"; type="application/act-manifest+json"; profile="runtime"`.

Five minutes later, Alex updates the launch date for `doc/proj-launch-2026`. The agent's next `GET /act/n/doc/proj-launch-2026.json` carries `If-None-Match: "s256:7c..."`. The server's ETag is now `s256:9e...`, mismatch, returns 200 with the new content. The agent re-summarizes.

If Alex *also* asks the agent to **create** a new section, the agent must use a tool — ACT does not do actions. The same SaaS exposes an MCP server for tool-calling (PRD-602; coexistence neighbor). ACT runtime served the read; MCP handled the write. The user connected once (browser session) and got both.

### Example 3 — Hybrid mounts: longest-prefix selection

```json
{
  "act_version": "0.1",
  "site": { "name": "Acme" },
  "conformance": { "level": "standard" },
  "delivery": "static",
  "mounts": [
    {
      "prefix": "/marketing",
      "delivery": "static",
      "manifest_url": "/marketing/.well-known/act.json",
      "conformance": { "level": "plus" }
    },
    {
      "prefix": "/app",
      "delivery": "runtime",
      "manifest_url": "https://app.acme.com/.well-known/act.json",
      "conformance": { "level": "standard" }
    }
  ]
}
```

A consumer asking "minimum Standard, runtime profile" follows the second mount only. A consumer fetching `/marketing/pricing` selects the `/marketing` mount (longest match). A consumer fetching `/blog/post-1` finds no mount match and falls through to the parent (PRD-106-R19).

### Example 4 — Anonymous public-tenant runtime endpoint

```json
{
  "act_version": "0.1",
  "site": { "name": "Acme Status" },
  "delivery": "runtime",
  "conformance": { "level": "core" },
  "index_url": "/act/index.json",
  "node_url_template": "/act/n/{id}.json"
}
```

No `auth` block. Per PRD-106-R11, anonymous public access. Every endpoint is reachable without credentials; 401 is never returned. `Cache-Control: public, max-age=60` is permissible. The Link header (PRD-106-R23) MUST still be emitted on every authenticated response if the deployment grows an authenticated branch later; for now, it MAY be emitted unconditionally.

### Example 5 — 401 with three WWW-Authenticate headers in advertised order

Manifest declares `auth.schemes: ["cookie", "bearer", "oauth2"]`. An unauthenticated `GET /act/index.json` returns:

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Cookie realm="app.acme.com"
WWW-Authenticate: Bearer realm="app.acme.com"
WWW-Authenticate: Bearer realm="app.acme.com", error="invalid_token", scope="act.read", authorization_uri="https://app.acme.com/oauth/authorize"
Content-Type: application/act-error+json; profile=runtime
Link: </.well-known/act.json>; rel="act"; type="application/act-manifest+json"; profile="runtime"

{"act_version":"0.1","error":{"code":"auth_required","message":"Authentication required to access this resource."}}
```

Consumers SHOULD try Cookie first, fall back to Bearer, then to OAuth 2.0 challenge handling.

---

## Test fixtures

Fixtures live under `fixtures/106/{positive,negative}/` and are exercised by PRD-600 (validator) plus the runtime-SDK test suites of PRD-501/503/504/505.

### Positive

- `fixtures/106/positive/200-with-etag.json` → 200 OK on a node fetch with `ETag` header set; satisfies PRD-106-R1, R3, R4, R12.
- `fixtures/106/positive/304-not-modified.json` → 304 on `If-None-Match` match; satisfies PRD-106-R3, R12.
- `fixtures/106/positive/401-three-www-authenticate.json` → 401 with three `WWW-Authenticate` headers in advertised order; satisfies PRD-106-R5, R7, R8.
- `fixtures/106/positive/hybrid-two-mounts.json` → parent manifest with two mounts (static marketing + runtime app), longest-prefix examples; satisfies PRD-106-R17, R18, R19, R20, R22.
- `fixtures/106/positive/runtime-only-link-header.json` → runtime-only deployment's HTTP responses carrying `Link: rel="act"`; satisfies PRD-106-R23, R24, R25.

### Negative

- `fixtures/106/negative/401-leaks-existence.json` → server distinguishes "exists but auth needed" from "doesn't exist" via different status codes; flagged per PRD-106-R6 and PRD-109.
- `fixtures/106/negative/runtime-no-link-header.json` → runtime-only authenticated response missing the `Link` header; flagged per PRD-106-R23 (gap A5).
- `fixtures/106/negative/mount-with-nested-mounts.json` → a mount's referenced manifest itself declares `mounts`; forbidden per PRD-106-R18 (gap C5).
- `fixtures/106/negative/bad-id-encoding-in-template.json` → `node_url_template` substitution fails to percent-encode reserved characters in the ID; flagged per PRD-106-R14, R15 (gap A3).

---

## Versioning & compatibility

Per PRD-108, classify each kind of change to PRD-106 as MAJOR or MINOR.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add an optional auth scheme value (e.g., `"mtls"`) | MAJOR | `auth.schemes` items are a closed enum per PRD-106-R7. Adding a value is MAJOR per PRD-108-R5(4). |
| Add an optional `auth.api_key.format` value beyond `"bearer"`/`"raw"` | MAJOR | Closed enum; same logic. |
| Add an optional new field inside `auth.oauth2` (e.g., `userinfo_endpoint`) | MINOR | Optional field addition per PRD-108-R4(1). |
| Add a new HTTP status code to the runtime contract (e.g., 451 Unavailable for Legal Reasons) | MAJOR | Adds a new producer obligation (or new consumer-tolerated case). |
| Add a new optional `Retry-After` semantics (delta-seconds vs HTTP-date refinement) | MINOR | Already permissible per RFC 9110; clarification is editorial. |
| Add a new value to the `error.code` enum | MAJOR | Closed enum per PRD-106-R27, PRD-108-R5(4). |
| Add an optional `details` schema for an existing `error.code` | MINOR | Adding optional structured detail. |
| Tighten `auth.schemes` SHOULD ordering (PRD-106-R7) to MUST ordering | MAJOR | Per PRD-108-R5(3). The current rule is already MUST for the manifest representation; the consumer-side SHOULD remains a SHOULD. |
| Loosen the existence-non-leak MUST (PRD-106-R6) | MAJOR | Per PRD-108-R5(3). Major security regression; would not be approved without compelling rationale. |
| Add a new mount-entry field (e.g., `mounts[*].priority` to disambiguate equal-length prefixes — though PRD-106-R20 forbids them) | MINOR | Optional field addition. |
| Add the streaming/subscriptions endpoint set (deferred to v0.2 per draft §5.13.6) | MINOR | New optional endpoints per PRD-108-R4(2), provided the conformance band is set to a new optional capability rather than promoting an existing requirement. |
| Promote `<link rel="act">` HTML element from SHOULD (PRD-106-R24) to MUST | MAJOR | Tightening SHOULD → MUST per PRD-108-R5(3). |
| Change the URL-encoding rule for IDs (PRD-106-R14) | MAJOR | Changes a syntactic constraint on a required substitution per PRD-108-R5(6). |

### Forward compatibility

Per PRD-108-R7, consumers MUST tolerate unknown optional fields. A consumer that encounters `auth.schemes: ["mtls"]` (a hypothetical future scheme) on a current-MAJOR producer MUST either treat it as an unrecognized scheme (and fall through) or reject the manifest as malformed; consumers MUST NOT crash. Consumers that encounter unknown values in `error.code` MUST treat them as `"internal"` and surface the response to the caller as a generic server error.

### Backward compatibility

Producers that upgrade `act_version` MINOR MUST continue to satisfy older MINOR consumers. Specifically: a `0.2` producer MUST continue to advertise the same auth-scheme set or a superset; MUST NOT remove the discovery hand-off Link header; MUST NOT change the URL-encoding rule. Within a MAJOR, runtime endpoints are stable.

A producer that downgrades its declared `conformance.level` (e.g., Standard → Core because the subtree endpoint is being decommissioned) MUST update the manifest in lockstep with the endpoint removal. Consumers asking for "minimum Standard, runtime profile" will then be refused per PRD-107-R13. A deprecation window per PRD-108-R12 applies to endpoint removal across MAJOR boundaries.

---

## Security considerations

Security posture for the runtime profile is owned by **PRD-109** (sibling, in-flight). PRD-106 imports the following constraints by reference and inlines the minimum set so this PRD is self-contained for review.

- **Auth boundary.** The runtime profile assumes the host application's existing authentication. PRD-106 does NOT define a new auth scheme. Authentication is the consumer's first-class concern; PRD-106's job is to expose the host's auth capabilities (advertisement order, scheme set, OAuth scopes) without leaking. Cite PRD-109.
- **Existence-non-leak via 404.** PRD-106-R6 requires that a resource the requester is not authorized to see returns `404` indistinguishable from a genuinely missing resource. This is the project-wide posture from PRD-109; PRD-106 enforces it at the runtime status-code layer. Producers MUST NOT add headers, body fields, or timing signals that distinguish the two cases. PRD-600 SHOULD probe for differential timing as part of its runtime test suite (out of scope for this PRD's normative text; flagged for PRD-600).
- **Existence-non-leak via 401.** PRD-106-R8 requires that the `WWW-Authenticate` header set on a 401 is a function of the manifest, not of the requested URL. A producer MUST NOT vary `WWW-Authenticate` content (realm, scope, etc.) by whether the requested resource exists; doing so creates an existence oracle.
- **ETag does not leak identity.** PRD-103 owns the ETag derivation rule; PRD-109 owns the no-leak requirement. PRD-106 forbids producers from mixing request-local data (request IDs, timestamps) into ETags here as a belt-and-suspenders restatement of PRD-103's no-leak posture (cross-reference). The hash input includes identity and tenant per PRD-103, but the resulting ETag MUST NOT permit recovering identity by offline analysis.
- **Per-tenant ID stability vs correlatability.** PRD-106-R16 makes IDs stable for `(resource, identity, tenant)`. Stable IDs are by construction correlatable across requests by the same principal; this is a property the consumer (the agent) needs for revalidation. PRD-109 owns the threat model that addresses cross-principal correlation (e.g., one user's ID bleeding into another's response). PRD-106 reaffirms: a producer MUST NOT include another principal's IDs in any response (e.g., in `related` cross-refs).
- **Origin trust on cross-origin mounts.** When a mount's `manifest_url` is absolute and points to a different origin than the parent manifest's origin (PRD-106-R22), the consumer MUST evaluate origin trust before honoring the mount. PRD-109 owns the trust rule (typically: explicit consumer config, or matching public-suffix-list scope, or a known trust list). PRD-106 imposes no constraint here beyond well-formed URI.
- **Discovery hand-off Link header.** PRD-106-R23 requires the Link header on authenticated responses. The header reveals the existence of an ACT manifest; that is intentional — agents need the discovery hand-off. The header MUST NOT include any auth-scoped material (no per-user paths, no tenant-specific manifest URLs that would not be reachable by other principals; the well-known path is the same for all). Authenticated branches that genuinely vary the manifest URL per principal — e.g., a per-tenant subdomain — SHOULD use the `<link rel="act">` HTML element (PRD-106-R24) and a host-scoped canonical Link target.
- **Rate-limiting and `Retry-After`.** 429 + `Retry-After` (PRD-106-R6) is the defense against high-volume probing, including existence-oracle attacks. PRD-109 owns abuse-detection guidance; PRD-106 only requires the surface.
- **Streaming / subscriptions (deferred).** Streaming endpoints carry distinct auth and replay-attack considerations (long-lived connections, partial state delivery). Not specified in v0.1; revisit in v0.2.

---

## Implementation notes

_For SDK / generator / example PRDs only — kept here because PRD-106 is consumed directly by PRD-500–PRD-505 and the implementation patterns these PRDs ratify deserve early treatment._

### Pattern 1 — Endpoint dispatch (generic SDK)

```typescript
import { createActRuntime } from '@act/runtime';

const runtime = createActRuntime({
  resolveManifest: async (request) => { /* ... */ },
  resolveIndex: async (request) => { /* ... */ },
  resolveNode: async (request, { id }) => { /* ... */ },
  resolveSubtree: async (request, { id }) => { /* ... */ },
  resolveSearch: async (request, { query }) => { /* Plus only */ },
  tokenizer: 'o200k',
  cacheControl: { default: 'private, must-revalidate' },
});

// Use with any WHATWG-fetch-compatible framework
app.use('/.well-known/act.json', (req, res) => runtime.manifest(req).then(send(res)));
app.use('/act/index.json',       (req, res) => runtime.index(req).then(send(res)));
app.use('/act/n/*',              (req, res) => runtime.node(req).then(send(res)));
app.use('/act/sub/*',            (req, res) => runtime.subtree(req).then(send(res)));
app.use('/act/search',           (req, res) => runtime.search(req).then(send(res)));
```

### Pattern 2 — 401 with auth-scheme-aware WWW-Authenticate

```typescript
function buildWwwAuthenticate(manifest) {
  // PRD-106-R8: one header per advertised scheme, in order.
  const schemes = manifest.auth?.schemes ?? [];
  return schemes.map((scheme) => {
    switch (scheme) {
      case 'cookie': return `Cookie realm="${manifest.site.name}"`;
      case 'bearer': return `Bearer realm="${manifest.site.name}"`;
      case 'oauth2': {
        const oauth = manifest.auth.oauth2;
        return `Bearer realm="${manifest.site.name}", error="invalid_token", scope="${oauth.scopes_supported.join(' ')}", authorization_uri="${oauth.authorization_endpoint}"`;
      }
      case 'api_key': {
        const header = manifest.auth.api_key?.header ?? 'Authorization';
        return `Bearer realm="${manifest.site.name}", header="${header}"`;
      }
    }
  });
}
```

### Pattern 3 — Discovery hand-off middleware

```typescript
// PRD-106-R23: emit Link on every authenticated response.
function actLinkHeaderMiddleware(req, res, next) {
  if (isAuthenticated(req)) {
    res.appendHeader(
      'Link',
      `</.well-known/act.json>; rel="act"; type="application/act-manifest+json"; profile="runtime"`,
    );
  }
  next();
}
```

### Pattern 4 — Per-segment URL encoding for IDs

```typescript
// PRD-106-R14: per-segment pchar encoding, `/` preserved.
function encodeIdForUrl(id: string): string {
  return id.split('/').map(encodeURIComponent).join('/');
}

const url = manifest.node_url_template.replace('{id}', encodeIdForUrl(node.id));
```

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft per gaps A3 (URL encoding), A4 (status codes + error envelope), A5 (runtime-only discovery hand-off), C1 (level/profile orthogonality), C2 (ETag derivation cite), C3 (auth scheme negotiation), C4 (per-tenant ID stability), C5 (hybrid mounts semantics). Cites PRD-107 (Accepted) and PRD-108 (Accepted) for orthogonality and versioning rules. References Q6 (decided 2026-04-30; MCP 1.0 + forward-compat shim) as forward dep for PRD-602. Status: In review. |
| 2026-05-01 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
