# PRD-500 — Runtime SDK contract (resolver shape, capability negotiation)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

PRD-106 (runtime delivery profile, Accepted) pins the wire surface a runtime ACT producer exposes — endpoint set, status codes, auth negotiation, error envelope, hybrid mounts, discovery hand-off — but it does not pin the **library contract** that every framework-specific runtime SDK (PRD-501 Next.js, PRD-502 Express, PRD-503 FastAPI [spec only], PRD-504 Rails [spec only], PRD-505 generic WHATWG-fetch) must expose to host applications. Without a single contract, each leaf SDK will reinvent (a) the resolver function signature, (b) the identity / tenancy extension points, (c) the capability negotiation between the SDK and the host application, (d) ETag computation hooks, (e) auth-mapping helpers, (f) error-envelope construction, and (g) the test-fixture harness used to prove conformance. The 50x SDK leaves are sized M each (PRD-501–505) precisely because they ride on a shared contract; absent that contract, every leaf doubles in scope and the conformance-test matrix forks five ways. This PRD locks the contract that PRD-106 turns into running code, the way PRD-200 locks the adapter contract for the 200-series. Tier C of `prd/000-gaps-and-resolutions.md` (specifically C1, C2, C3, C4, C5) flagged the runtime-side gaps; PRD-106 owns the wire side; PRD-500 owns the library side.

### Goals

1. Lock the **resolver shape**: the canonical TypeScript interface (`ActRuntime`) whose four methods (`resolveManifest`, `resolveIndex`, `resolveNode`, `resolveSubtree`, plus optional `resolveSearch` and `resolveIndexNdjson`) constitute the host application's whole obligation. Every framework adapter is glue between `Request → ActRuntime → Response`.
2. Lock the **identity & tenancy hooks**: framework-neutral interfaces (`IdentityResolver`, `TenantResolver`) that accept a `Request` and return a stable `Identity` and `Tenant` opaque to the SDK. PRD-500 does not authenticate; it consumes the host's existing auth.
3. Lock the **capability negotiation** between the manifest's advertised `capabilities` (per PRD-100-R6) and the SDK's runtime behavior — when the host opts into Standard or Plus, which resolvers MUST be supplied and which are optional.
4. Lock the **caching contract**: the SDK computes `etag` per PRD-103, serves `ETag` headers, honors `If-None-Match` and emits `304 Not Modified`, and emits `Cache-Control` per PRD-103-R9. The host MAY override the ETag computation via a hook; the default uses PRD-103's recipe.
5. Lock the **auth & error mapping**: a single `AuthOutcome` discriminated union returned by `IdentityResolver` is mapped by the SDK to the PRD-106 / PRD-100 error envelope on 401, 404, 429, and 5xx, with the existence-non-leak rule honored by construction.
6. Lock the **endpoint surface**: a Core SDK MUST expose well-known manifest, index, and node handlers; Standard adds subtree; Plus adds NDJSON index and search. Every endpoint goes through the same dispatch pipeline (parse → identify → resolve → encode → cache → discovery hand-off).
7. Lock the **content negotiation** rules: `Accept: application/act-*+json` for the matching envelope MUST be honored when sent; SDKs MUST emit the corresponding `Content-Type` per PRD-100-R46 with a `profile=runtime` parameter.
8. Lock the **hybrid-mount composability**: an SDK instance MAY participate in a parent manifest's `mounts` (PRD-100-R7 / PRD-106-R17–R22) without modification; PRD-500 specifies the configuration shape.
9. Lock the **logging / observability hooks**: an opaque `Logger` interface that the SDK calls on key events (request received, identity resolved, ETag hit, 401/404 emitted, error). The Logger MUST NOT receive PII per PRD-109-R14.
10. Lock the **test fixture harness**: under `fixtures/500/` an SDK harness (mock HTTP request → resolver → response) shared across PRD-501–505 so every leaf SDK is exercised against the same input/output matrix and PRD-600 has a single corpus to probe.

### Non-goals

1. **Defining wire-format envelopes.** Owned by PRD-100. PRD-500 SDKs serialize PRD-100 envelopes; they do not redefine them.
2. **Defining HTTP status-code semantics.** Owned by PRD-106. PRD-500 maps internal outcomes to PRD-106's status codes; it does not invent codes.
3. **Defining ETag derivation.** Owned by PRD-103. PRD-500 calls the recipe; it does not reimplement it.
4. **Defining auth schemes.** Owned by PRD-106 (manifest declaration) and PRD-109 (security posture). PRD-500 consumes the host's auth; it never authenticates.
5. **Implementing leaf SDKs.** PRD-501 (Next.js), PRD-502 (Express), PRD-503 (FastAPI, spec only), PRD-504 (Rails, spec only), PRD-505 (generic WHATWG-fetch). Each leaf adapts the contract here to its framework's request/response idiom.
6. **Streaming and long-lived connections.** Deferred to v0.2 per draft §5.13.6 and PRD-106 non-goal #7. SDKs MAY add streaming under a future MINOR.
7. **Static-profile producers.** Static delivery is owned by PRD-105 + the 200-series adapters. PRD-500 is runtime-only.
8. **Component-extraction at request time.** Component contracts (PRD-300) run at build time; PRD-500 SDKs serve already-extracted nodes.
9. **The MCP bridge.** PRD-602 (ACT-MCP bridge, decision Q6 forward dep) is a coexistence neighbor. PRD-500 SDKs MAY be deployed alongside an MCP server but PRD-500 imposes no constraint on that arrangement.
10. **Search response envelope shape.** Per decision Q13 (2026-05-01), the search-body envelope is deferred to v0.2. PRD-500 SDKs serving Plus expose `resolveSearch` with the request shape pinned and the response body declared as opaque-but-JSON until PRD-100 adds a normative shape.

### Stakeholders / audience

- **Authors of:** PRD-501 (Next.js runtime SDK), PRD-502 (Express runtime SDK), PRD-503 (FastAPI runtime SDK, `(spec only)`), PRD-504 (Rails runtime SDK, `(spec only)`), PRD-505 (Hono / generic WHATWG-fetch runtime SDK), PRD-600 (validator — must probe SDK output via the harness defined here), PRD-705 (B2B SaaS workspace example — primary consumer of PRD-501).
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Resolver interface fragments across leaf SDKs because each framework's request shape differs (Next.js `Request`, Express `req`, FastAPI `Request`, etc.). | Medium | High | PRD-500 fixes the resolver shape on a normalized `ActRequest` (a thin TS interface over WHATWG `Request`); each leaf SDK ships an adapter that maps framework-native requests to `ActRequest`. PRD-505 (WHATWG-fetch) is the reference. |
| Identity / tenancy hooks leak the wrong abstraction — host applications wire raw user objects into the SDK and inadvertently leak PII into ETags or Logger output. | Medium | High | PRD-500-R6 / R7 require Identity / Tenant to be opaque stable strings; the SDK MUST NOT deserialize them. PRD-500-R23 (Logger no-PII) restates PRD-109-R14. Negative fixture `negative/identity-with-pii-shape.json` makes the failure visible. |
| SDK existence-leak: a 404 path that varies by identity (e.g., a different cache header for "exists but forbidden" vs "truly absent") creates a side channel. | Medium | High | PRD-500-R18 routes both branches through the same code path; the response is built from a single `notFoundEnvelope()` helper, with identical headers (modulo `Vary` per PRD-103-R9). PRD-600 probes for differential response. Cite PRD-109-R3. |
| Auth scheme negotiation is inconsistent across leaf SDKs — one SDK emits one `WWW-Authenticate` per advertised scheme, another emits a comma-list, defeating consumer parsers. | Medium | Medium | PRD-500-R14 mandates the helper `buildAuthChallenges()` shared in the contract; each leaf SDK uses it verbatim. Cite PRD-106-R8 and PRD-109-R5. |
| ETag computation hook bypasses PRD-103's recipe, producing non-deterministic ETags across replicas. | Low | High | PRD-500-R20 makes the hook OPT-OUT, not OPT-IN: the default uses PRD-103's recipe; an override MUST also be deterministic given `(payload, identity, tenant)`. PRD-500-R21 forbids request-local data in any override. Cite PRD-103-R7 / PRD-109-R17. |
| Capability over-declaration — a host declares Plus in the manifest but doesn't supply `resolveSearch`, breaking the contract at request time. | Medium | Medium | PRD-500-R10 requires the SDK to validate at construction time that the resolver set matches the declared `conformance.level`; mismatch is a startup error, not a request-time error. PRD-600 probes the manifest's level vs the live endpoint set. |
| Logger receives the requested URL (which may carry tenant-specific identifiers) and writes them to logs that aggregate cross-tenant. | Medium | Medium | PRD-500-R23 forbids passing the raw URL to the Logger when the URL carries scoped identifiers. The Logger receives a redacted form. PRD-109-R14 / R15 own the broader posture. |
| Hybrid-mount composability fails because the SDK assumes it owns the manifest URL and conflicts with a parent manifest's `mounts` entry. | Low | Medium | PRD-500-R26 makes the manifest URL configurable; the SDK MAY be mounted at any path. The default is `/.well-known/act.json` per PRD-100-R3. |

### Open questions

1. ~~Should PRD-500 mandate a specific TS module layout (`@act/runtime-core` + per-framework packages) or leave packaging to leaf PRDs?~~ **Resolved (2026-05-01): Yes.** Ratifies tentative answer. `@act/runtime-core` exports the `ActRuntime` factory and the type exports; leaf packages (`@act/runtime-next`, `@act/runtime-express`, `@act/runtime-fetch`) ship adapters per PRD-500-R28. Pinning the pattern at the contract layer prevents leaf-by-leaf naming drift and gives PRD-503 / PRD-504 a documented convention to mirror. (Closes Open Question 1.)
2. ~~Should `resolveIndex` accept a pagination cursor?~~ **Resolved (2026-05-01): No.** Ratifies tentative answer. The index envelope is intended to be small (Plus producers shard via NDJSON per PRD-107-R10). Adding a cursor expands the resolver surface and conflicts with the deferred-to-v0.2 stance on streaming and long-lived connections (PRD-500 non-goal #6). Revisit in v0.2 if PRD-501 implementer feedback signals friction with large indices. (Closes Open Question 2.)
3. ~~Should the SDK enforce the runtime-only Link header (PRD-106-R23) on every authenticated response, or only on its own ACT endpoints?~~ **Resolved (2026-05-01): ACT endpoints only.** Ratifies tentative answer; codified in PRD-500-R29. The SDK does not own the host's non-ACT response surface; reaching outside ACT endpoints would impose framework-level interception the contract is too narrow to define correctly. The leaf SDKs (PRD-501 / PRD-502 / PRD-505) export an optional `actLinkHeaderMiddleware` helper for hosts that want the broader scope. (Closes Open Question 3.)
4. ~~Should the contract distinguish between "request-time host-supplied tenant" (e.g., from a subdomain) and "identity-derived tenant" (e.g., from a user's primary tenant)?~~ **Resolved (2026-05-01): No.** Ratifies tentative answer. `TenantResolver` returns a single opaque string; how the host derives it (subdomain, path prefix, header, identity-primary-tenant lookup) is the host's concern and is documented as patterns in leaf PRDs. Distinguishing the two would expand `Tenant` into a discriminated union without a behavioral consequence inside the SDK — both forms hash into the ETag triple identically per PRD-103-R6. Revisit in v0.2 if a multi-tenant-per-identity case surfaces. (Closes Open Question 4.)
5. ~~Should the SDK support content negotiation via `Accept` for the NDJSON variant separately from the JSON variant?~~ **Resolved (2026-05-01): Yes.** Ratifies tentative answer; codified in PRD-500-R16. `Accept: application/act-index+json; profile=ndjson` routes to the NDJSON resolver when registered; falls through to JSON otherwise. The profile-parameter form is the cleanest way to disambiguate within a single MIME family without inventing a new top-level type. (Closes Open Question 5.)

### Acceptance criteria

- [ ] Specification opens with a table of 100-series requirements implemented (Phase 3 addition per workflow.md).
- [ ] Every normative requirement uses RFC 2119 keywords; ID `PRD-500-R{n}`.
- [ ] Conformance level (Core / Standard / Plus) declared per requirement, citing PRD-107.
- [ ] The resolver interface (`ActRuntime`) is shown as real TypeScript signatures in §"Wire format / interface definition".
- [ ] Identity and tenancy hooks are framework-neutral and use opaque types.
- [ ] Auth-failure mapping → 401 + `WWW-Authenticate` per scheme is specified end-to-end with a reference helper.
- [ ] Existence-non-leak rule (404 covers "not found" and "forbidden" both) is specified at the SDK layer; cite PRD-109-R3.
- [ ] ETag computation references PRD-103's recipe; override hook is deterministic.
- [ ] Hybrid-mount composability rule is stated.
- [ ] Logging hook is specified; PII restriction cited from PRD-109.
- [ ] Implementation notes section present with ~3-10 short TypeScript snippets.
- [ ] Test fixtures enumerated under `fixtures/500/{positive,negative}/`.
- [ ] No new schemas added under `schemas/500/` (SDKs serve PRD-100 envelopes).
- [ ] Open questions ≤ 5.
- [ ] Changelog entry dated 2026-05-01 by Jeremy Forsythe.

---

## Context & dependencies

### Depends on

- **PRD-100** (Wire format & envelope shapes): Accepted. SDKs serialize manifest, index, node, subtree, and error envelopes per its schemas. Specifically: PRD-100-R1 (`act_version` on every envelope), R3–R8 (manifest fields), R10–R15 (ID grammar + URL encoding), R16–R20 (index entries), R21–R27 (node envelope), R32–R36 (subtree), R37–R40 (Plus advertisements), R41–R44 (error envelope + `not_found` for both genuinely absent and forbidden), R46 (MIME types).
- **PRD-103** (Caching, ETags, validators): Accepted. SDKs compute `etag` per its recipe (R6 runtime triple), serve `ETag` and honor `If-None-Match` (R8), and emit `Cache-Control` / `Vary` per R9. Specifically: PRD-103-R1 (`etag` required on every envelope), R6 (runtime derivation triple `{payload, identity, tenant}`), R7 (no request-local mixing), R8 (`If-None-Match` → 304), R9 (Cache-Control + Vary), R10 (strong validator).
- **PRD-106** (Runtime delivery profile): Accepted. SDKs implement its endpoint set, status codes, auth, mounts, and discovery hand-off. Specifically: PRD-106-R1 (endpoint set per level), R2 (`act_version` injection), R3–R6 (status codes), R7–R11 (auth), R12 (caching), R13–R15 (URL encoding), R16 (per-tenant ID stability), R17–R22 (mounts), R23–R25 (discovery hand-off), R26–R30 (error envelope shape).
- **PRD-107** (Conformance levels): Accepted. The SDK declares its level; resolver requirements depend on level (Core / Standard / Plus per R6 / R8 / R10).
- **PRD-108** (Versioning policy): Accepted. The contract evolves under MAJOR/MINOR rules; package versioning is staged per R14 (Q5).
- **PRD-109** (Security considerations): Accepted. Cite for existence-non-leak (T1, R3, R4), identity-no-leak (T2, R16, R17), per-tenant scoping (T3, R11, R13), error-message PII (T5, R14, R15), and Logger no-PII.
- **000-governance**: Accepted. Lifecycle for this PRD.
- External: [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174); [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) (HTTP semantics); [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288) (Link header); [WHATWG Fetch](https://fetch.spec.whatwg.org/) (`Request` / `Response` interfaces); TypeScript 5.x for interface syntax.

### Blocks

- **PRD-501** (Next.js runtime SDK) — leaf, depends on this PRD's resolver shape and adapter pattern.
- **PRD-502** (Express runtime SDK) — leaf.
- **PRD-503** (FastAPI runtime SDK, `(spec only)`) — leaf, spec-only per Q3.
- **PRD-504** (Rails runtime SDK, `(spec only)`) — leaf, spec-only per Q3.
- **PRD-505** (Hono / generic WHATWG-fetch runtime SDK) — leaf, also serves as the reference for normalized request/response handling.
- **PRD-705** (B2B SaaS workspace example) — depends on PRD-501.
- **PRD-706** (Hybrid static + runtime + MCP bridge) — depends on PRD-501.
- **PRD-600** (Validator) — implements the conformance-test harness using `fixtures/500/`.

### References

- v0.1 draft: §5.13 (Runtime serving), §5.13.1 (Runtime contract), §5.13.2 (Authentication), §5.13.3 (Caching), §5.13.4 (Per-tenant scoping), §5.13.5 (Hybrid mounts), §6.6 (Runtime SDK pattern, Next.js example), §8.6 (B2B SaaS workspace example).
- `prd/000-gaps-and-resolutions.md`: C1 (level/profile orthogonality — owned by PRD-107, cited here), C2 (ETag derivation under runtime + per-tenant — owned by PRD-103, cited here), C3 (auth scheme negotiation — owned jointly by PRD-106 and this PRD), C4 (per-tenant ID stability — owned by PRD-106 and PRD-100, cited here), C5 (hybrid mounts — owned by PRD-106, cited here).
- `prd/000-decisions-needed.md`: Q3 (TS-only first-party for v0.1 — PRD-503 / PRD-504 are spec-only), Q1 (BDFL governance — applies to this PRD's lifecycle), Q4 (Apache-2.0 for code — affects package licensing of the leaf SDKs but not the contract itself), Q13 (search-body envelope deferred to v0.2 — applies to `resolveSearch`).
- Prior art: Next.js Route Handler shape; Express middleware shape; Hono `Handler` shape; Apollo Server's `context` / `dataSources` separation as inspiration for the resolver / hooks split; Astro Integration shape (PRD-401 sibling for the static side); MCP Server SDK contract (paired API, PRD-602 neighbor).

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) where requirements are imposed. Lowercase "must" and "should" are non-normative prose.

### 100-series requirements implemented

The PRD-500 contract is a faithful implementation of the runtime side of the 100-series. The table below lists every 100-series requirement this PRD implements, the mechanism, and the PRD-500 requirement(s) that bind the SDK to the implementation.

| Source requirement | Source PRD | Mechanism | PRD-500 requirement |
|---|---|---|---|
| `act_version` on every envelope | PRD-100-R1, PRD-108-R1 | SDK injects on response serialization | PRD-500-R12 |
| Manifest envelope shape | PRD-100-R3, R4 | `resolveManifest` returns a typed object; SDK serializes | PRD-500-R3 |
| Manifest `capabilities` object (not array) | PRD-100-R6 | SDK type forbids array form; structured object only | PRD-500-R8, R9 |
| Manifest `node_url_template` placeholder | PRD-100-R5 | SDK validates at construction time | PRD-500-R10 |
| Manifest `mounts` (hybrid) | PRD-100-R7, PRD-106-R17–R22 | SDK is mountable at any prefix; participates as a runtime mount | PRD-500-R26 |
| ID grammar | PRD-100-R10, R11 | SDK validates IDs in resolver outputs | PRD-500-R12 |
| ID URL encoding (per-segment `pchar`) | PRD-100-R12, PRD-106-R14, R15 | SDK helper `encodeIdForUrl` + canonical decoding | PRD-500-R13 |
| Per-tenant ID stability | PRD-100-R15, PRD-106-R16 | Contract forbids per-request IDs in resolver outputs | PRD-500-R7 |
| Index envelope shape | PRD-100-R16–R20 | `resolveIndex` returns the entry list; SDK wraps | PRD-500-R3 |
| Node envelope shape | PRD-100-R21–R27 | `resolveNode` returns the node; SDK wraps | PRD-500-R3 |
| Subtree envelope shape | PRD-100-R32–R36 | `resolveSubtree` returns the subtree (Standard) | PRD-500-R3, R10 |
| NDJSON index | PRD-100-R37, PRD-106-R32 | `resolveIndexNdjson` returns an async iterator (Plus) | PRD-500-R3, R10 |
| Search advertisement | PRD-100-R39, PRD-106-R33 | `resolveSearch` (Plus); response shape opaque per Q13 | PRD-500-R3, R10 |
| Error envelope shape | PRD-100-R41–R44 | SDK builds the envelope from `AuthOutcome` / `ResolveOutcome` | PRD-500-R17, R18 |
| Closed `error.code` enum | PRD-100-R41, PRD-106-R27 | SDK never emits a code outside the enum | PRD-500-R17 |
| `error.message` no-PII | PRD-100-R42, PRD-109-R14 | SDK helper `buildErrorEnvelope()` accepts only safe strings | PRD-500-R17 |
| 200 / 304 / 401 / 404 / 410 / 429 / 5xx | PRD-106-R3, R5, R6 | SDK dispatch produces the right code per outcome | PRD-500-R15, R16, R17, R18 |
| `WWW-Authenticate` per scheme on 401 | PRD-106-R8, PRD-109-R5 | Helper `buildAuthChallenges()` reads manifest's ordered schemes | PRD-500-R14 |
| OAuth 2.0 manifest fields | PRD-106-R9, PRD-109-R7 | SDK validates at construction | PRD-500-R10 |
| API key default header | PRD-106-R10, PRD-109-R8 | SDK helper defaults `Authorization: Bearer` | PRD-500-R14 |
| Anonymous public access permitted | PRD-106-R11 | `IdentityResolver` MAY return `{ kind: "anonymous" }` | PRD-500-R6 |
| ETag derivation under runtime triple | PRD-103-R6 | SDK default `EtagComputer` uses JCS + SHA-256 + 22 chars | PRD-500-R20 |
| No request-local data in ETag | PRD-103-R7, PRD-109-R17 | Override hook contract forbids it | PRD-500-R21 |
| `If-None-Match` → 304 | PRD-103-R8, PRD-106-R3 | SDK dispatch checks before resolving body | PRD-500-R19 |
| `ETag` header on 200 / 304 | PRD-103-R8, PRD-106-R4 | SDK always emits | PRD-500-R19 |
| `Cache-Control` + `Vary` per identity | PRD-103-R9, PRD-106-R12 | SDK applies based on identity-null vs non-null | PRD-500-R22 |
| Discovery hand-off Link header | PRD-106-R23 | SDK middleware emits on every ACT-endpoint authenticated response | PRD-500-R29 |
| Manifest declares `delivery: "runtime"` | PRD-106-R25 | SDK injects on `resolveManifest` output | PRD-500-R8 |
| Existence-non-leak (404 covers both) | PRD-106-R6, PRD-109-R3 | Single `notFound()` helper; identical body/headers | PRD-500-R18 |
| Bounded `act_version` rejection | PRD-108-R8, PRD-109-R20 | SDK rejects unknown MAJOR before parsing body | PRD-500-R30 |
| Logger no-PII | PRD-109-R14 | Logger receives redacted shape | PRD-500-R23, R24 |

The remainder of this Specification section binds the SDK to these implementations through normative requirements with PRD-500-R{n} IDs.

### Conformance level

Per PRD-107, PRD-500 requirements are banded:

- **Core:** PRD-500-R1 (the contract is normative), R2 (request normalization), R3 (resolver interface required signatures), R4 (resolver outcomes), R5 (request lifecycle), R6 (identity resolver), R7 (tenant resolver), R8 (manifest resolver constraints), R9 (capability negotiation manifest-side), R10 (capability negotiation construction-time), R11 (host registers leaf adapter), R12 (envelope serialization), R13 (URL encoding helpers), R14 (auth challenge helper), R15 (200 path), R16 (content negotiation), R17 (error envelope construction), R18 (existence-non-leak path), R19 (ETag / 304), R20 (default ETag computer), R21 (override determinism), R22 (Cache-Control / Vary), R23 (Logger no-PII shape), R24 (Logger event set), R25 (request-id propagation), R26 (mountability), R27 (lifetime hooks), R28 (package layout), R29 (discovery hand-off scope), R30 (bounded act_version rejection), R31 (test fixture conformance).
- **Standard:** PRD-500-R32 (subtree resolver supplied when level ≥ Standard).
- **Plus:** PRD-500-R33 (NDJSON index resolver supplied when level = Plus), R34 (search resolver supplied when level = Plus).

Auth scoping is orthogonal to level (per PRD-107-R4 / PRD-109-R10): a Core SDK MAY be deployed with auth required, and an unauthenticated public-tenant SDK MAY be Plus.

### Normative requirements

#### Meta

**PRD-500-R1.** This PRD's TypeScript interface signatures in §"Wire format / interface definition" are **normative**. Each leaf SDK (PRD-501–505) MUST expose a public API that is structurally compatible with these signatures, modulo framework-native request/response types. A leaf SDK MAY widen the public API; it MUST NOT narrow it.

#### Request normalization

**PRD-500-R2.** Every leaf SDK MUST normalize incoming framework-native requests to a common `ActRequest` shape before invoking any resolver. `ActRequest` is a thin TypeScript interface over WHATWG `Request` exposing at minimum: `method`, `url` (parsed), `headers` (a `Headers` instance), and a method `getCookie(name): string | undefined`. The `ActRequest` MUST NOT carry framework-mutable state; it is a per-request value object. The leaf adapter is responsible for the conversion.

#### Resolver interface

**PRD-500-R3.** A host application registers an `ActRuntime` with the SDK. The `ActRuntime` MUST expose at minimum the resolver methods listed below. Each method receives `(ActRequest, ActContext)` where `ActContext` carries the resolved `Identity` and `Tenant` (per PRD-500-R6 / R7). Each method returns an `Outcome<T>` discriminated union (per PRD-500-R4):

- `resolveManifest(req, ctx) → Outcome<Manifest>` — Core, REQUIRED.
- `resolveIndex(req, ctx) → Outcome<Index>` — Core, REQUIRED.
- `resolveNode(req, ctx, { id }) → Outcome<Node>` — Core, REQUIRED.
- `resolveSubtree(req, ctx, { id, depth }) → Outcome<Subtree>` — Standard, REQUIRED when manifest declares `conformance.level: "standard" | "plus"`.
- `resolveIndexNdjson(req, ctx) → Outcome<AsyncIterable<IndexEntry>>` — Plus, REQUIRED when manifest declares `conformance.level: "plus"`.
- `resolveSearch(req, ctx, { query }) → Outcome<unknown>` — Plus, REQUIRED when manifest declares `conformance.level: "plus"`. The response shape is opaque-but-JSON for v0.1 per decision Q13; a future MINOR pins it.

`Manifest`, `Index`, `Node`, `Subtree`, and `IndexEntry` are the TypeScript types corresponding to PRD-100's envelope schemas.

**PRD-500-R4.** The `Outcome<T>` discriminated union MUST have exactly the following variants:

- `{ kind: "ok"; value: T }` — successful resolution; SDK serializes and returns 200 (or 304 if `If-None-Match` matches).
- `{ kind: "not_found" }` — the requested resource does not exist OR is not visible to the identity; SDK returns 404 with `error.code: "not_found"` per PRD-106-R6 / R28 and PRD-109-R3.
- `{ kind: "auth_required" }` — authentication is required to satisfy this request; SDK returns 401 + `WWW-Authenticate` per advertised schemes.
- `{ kind: "rate_limited"; retryAfterSeconds: number }` — the request was rate-limited; SDK returns 429 + `Retry-After` per PRD-106-R6.
- `{ kind: "validation"; details?: Record<string, unknown> }` — the request body or query violated a documented constraint; SDK returns 4xx with `error.code: "validation"`. Used sparingly per PRD-106-R28.
- `{ kind: "internal"; details?: Record<string, unknown> }` — server error; SDK returns 5xx with `error.code: "internal"`.

A resolver MUST NOT return any other discriminator. A resolver throwing an uncaught exception MUST be mapped by the SDK to `{ kind: "internal" }`; the exception's message MUST NOT propagate to the response (PRD-109-R14 / R15).

#### Request lifecycle

**PRD-500-R5.** Every ACT request MUST traverse the SDK's dispatch pipeline in this order:

1. Normalize (PRD-500-R2).
2. Validate `act_version` if the request carries one (PRD-500-R30).
3. Resolve identity via the registered `IdentityResolver` (PRD-500-R6).
4. Resolve tenant via the registered `TenantResolver` (PRD-500-R7) — only if identity is not anonymous AND the manifest declares tenanting; otherwise tenant is `null`.
5. Honor `If-None-Match` early-exit (PRD-500-R19) by computing or looking up the cached ETag for the resource.
6. Invoke the appropriate resolver from PRD-500-R3.
7. Map the `Outcome<T>` to an HTTP response (PRD-500-R15 / R17 / R18).
8. Apply caching headers per PRD-500-R22.
9. Apply discovery hand-off Link header per PRD-500-R29.
10. Log the event via the registered `Logger` per PRD-500-R23 / R24.

The pipeline MUST be deterministic; deviations (e.g., reordering steps 3 and 4, or skipping step 9) are violations.

#### Identity & tenancy hooks

**PRD-500-R6.** A host application MUST register an `IdentityResolver` of shape `(req: ActRequest) → Promise<Identity>` where `Identity` is one of:

- `{ kind: "anonymous" }` — the request carries no identifying credentials, OR the manifest declares no `auth` block per PRD-106-R11.
- `{ kind: "principal"; key: string }` — an authenticated principal whose `key` is the stable identity per PRD-103-R6 (used as the `identity` input to ETag derivation). The `key` MUST be a stable string (UUID, user ID, principal ID); it MUST NOT be a session token, JWT, or any value that rotates within the principal's lifetime.
- `{ kind: "auth_required"; reason?: "missing" | "expired" | "invalid" }` — credentials are required to proceed; the SDK MUST emit 401.

The `IdentityResolver` MUST NOT throw on missing credentials; it returns `auth_required`. The resolver MAY throw on infrastructure errors (e.g., the identity provider is unreachable); the SDK MUST map a thrown error to `{ kind: "internal" }`.

**PRD-500-R7.** A host application MAY register a `TenantResolver` of shape `(req: ActRequest, identity: Identity) → Promise<Tenant>` where `Tenant` is `{ kind: "single" }` for non-tenanted deployments OR `{ kind: "scoped"; key: string }`. The `key` MUST be a stable string per the same constraints as `Identity.key` and is used as the `tenant` input to PRD-103-R6's ETag triple. The `TenantResolver` MUST NOT mint per-request values (cite PRD-100-R15 / PRD-106-R16). For deployments without tenanting, the host omits the resolver and the SDK uses `{ kind: "single" }` by default.

#### Manifest resolver constraints

**PRD-500-R8.** The `resolveManifest` resolver's returned `Manifest` MUST satisfy PRD-100's manifest schema. The SDK is responsible for injecting `act_version` (per PRD-100-R1 / PRD-108-R1) and `delivery: "runtime"` (per PRD-106-R25) if the host omits them; the SDK MUST NOT silently overwrite a host-supplied `delivery: "static"` (mismatch is a startup configuration error per PRD-106-R25).

**PRD-500-R9.** The manifest's `capabilities` field, when emitted by the SDK, MUST be a structured object per PRD-100-R6 — the v0.1-draft array form is forbidden at the wire layer. The SDK SHOULD compute the `capabilities` flags from the registered resolvers: if `resolveSubtree` is registered, set `capabilities.subtree = true`; if `resolveIndexNdjson` is registered, set `capabilities.ndjson_index = true`; if `resolveSearch` is registered, set `capabilities.search.template_advertised = true`. The host MAY override but MUST NOT under-declare (declaring `subtree: true` without registering `resolveSubtree` is a startup error).

#### Capability negotiation (construction time)

**PRD-500-R10.** The SDK's construction function (`createActRuntime(config)` per the implementation pattern) MUST validate, at construction time, that the registered resolver set is consistent with the manifest's declared `conformance.level`:

- Level `"core"` → at minimum `resolveManifest`, `resolveIndex`, `resolveNode` MUST be registered.
- Level `"standard"` → additionally `resolveSubtree` MUST be registered, AND `subtree_url_template` MUST be set on the manifest.
- Level `"plus"` → additionally `resolveIndexNdjson` AND `resolveSearch` MUST be registered, AND `index_ndjson_url` AND `search_url_template` MUST be set on the manifest.

A mismatch MUST throw a configuration error from `createActRuntime`. The SDK MUST NOT defer the check to request time.

The same construction step MUST validate that `auth.schemes` declarations in the manifest are consistent with the host's intent: if `auth.schemes` includes `"oauth2"`, the manifest MUST declare `auth.oauth2.{authorization_endpoint, token_endpoint, scopes_supported}` per PRD-106-R9 / PRD-109-R7. The construction function MUST reject inconsistent manifests.

#### Adapter registration

**PRD-500-R11.** A leaf SDK (PRD-501–505) provides a thin adapter that:

1. Receives the framework-native request.
2. Constructs an `ActRequest` per PRD-500-R2.
3. Routes the request to the appropriate `ActRuntime` method based on URL match — well-known manifest path, index, node template, subtree template, NDJSON URL, search URL.
4. Receives the SDK's `ActResponse` (a thin wrapper carrying status, headers, body).
5. Translates the `ActResponse` to the framework-native response.

The adapter MUST NOT modify the response body or status code computed by the SDK. It MAY add framework-specific headers (e.g., a CSRF token) provided they do not conflict with PRD-106-prescribed headers.

#### Envelope serialization

**PRD-500-R12.** The SDK MUST inject `act_version` at the top of every envelope on the response side, per PRD-100-R1 and PRD-108-R1. The value MUST match the `act_version` the SDK was configured with (canonical form `"0.1"` for v0.1). The SDK MUST validate that resolver-returned envelopes do not carry a conflicting `act_version`; conflict is mapped to `{ kind: "internal" }` and logged.

The SDK MUST validate that resolver-returned IDs match the grammar in PRD-100-R10 before serializing. Invalid IDs are mapped to `{ kind: "internal" }`; the SDK MUST NOT serve a node whose `id` violates the grammar.

#### URL encoding helpers

**PRD-500-R13.** The SDK MUST expose a public helper `encodeIdForUrl(id: string): string` that performs per-segment percent-encoding of an ID per PRD-100-R12 / PRD-106-R14. The helper MUST treat `/` as the segment separator (preserving it verbatim) and percent-encode each segment with the `pchar` rules of RFC 3986 §3.3. The SDK MUST use this helper internally for any URL it emits that substitutes an ID.

The SDK MUST decode incoming request URLs consistently per PRD-106-R15: two URLs that decode to the same canonical ID MUST resolve to the same resource. The SDK's request matcher implements this by canonicalizing the path before invoking the resolver.

#### Auth challenge helper

**PRD-500-R14.** The SDK MUST expose a public helper `buildAuthChallenges(manifest): string[]` that, given the configured manifest, returns one `WWW-Authenticate` header value per advertised scheme in `auth.schemes` order, per PRD-106-R8 and PRD-109-R5. The helper MUST emit:

- For `"cookie"`: `Cookie realm="<site.name>"`.
- For `"bearer"`: `Bearer realm="<site.name>"`.
- For `"oauth2"`: `Bearer realm="<site.name>", error="invalid_token", scope="<scopes joined by space>", authorization_uri="<authorization_endpoint>"`.
- For `"api_key"`: `Bearer realm="<site.name>"` (the default per PRD-106-R10) OR a scheme name reflecting `auth.api_key.header` if the host overrode it.

The set of headers MUST be a function of the manifest, NOT of the request URL (PRD-106-R8 / PRD-109-R5). The SDK MUST use this helper on every 401 response.

#### 200 response path

**PRD-500-R15.** When a resolver returns `{ kind: "ok"; value: T }`, the SDK MUST:

1. Serialize the envelope as JSON per PRD-100's schema for the resource type.
2. Inject `act_version` (PRD-500-R12) and the computed `etag` (PRD-500-R20).
3. Set `Content-Type` per PRD-100-R46 (`application/act-manifest+json`, `application/act-index+json`, `application/act-node+json`, `application/act-subtree+json`, with a `profile=runtime` parameter).
4. Set the `ETag` header per PRD-103-R8 / PRD-106-R4 — the value is the envelope's `etag` field, double-quoted per RFC 9110 §8.8.3, no `W/` prefix.
5. Set `Cache-Control` and `Vary` per PRD-500-R22.
6. Emit the discovery hand-off Link header per PRD-500-R29.

#### Content negotiation

**PRD-500-R16.** The SDK MUST honor `Accept` for the index endpoint:

- `Accept: application/act-index+json` (or `*/*`, or absent) → returns the JSON index variant.
- `Accept: application/act-index+json; profile=ndjson` → returns the NDJSON index variant. This MUST route to `resolveIndexNdjson` (Plus); if the resolver is not registered, the SDK MUST return 406 Not Acceptable with `error.code: "validation"` and `details.reason: "ndjson_not_supported"`.

For other endpoints (manifest, node, subtree, search), `Accept` is informational; the SDK serves the canonical envelope regardless. The SDK MUST NOT serve a different envelope shape based on `Accept` — content negotiation in v0.1 is restricted to the index NDJSON / JSON pair.

#### Error envelope construction

**PRD-500-R17.** The SDK MUST build the error envelope per PRD-100-R41 / PRD-106-R26 from the `Outcome<T>` discriminator. The mapping is:

- `{ kind: "auth_required" }` → 401, `error.code: "auth_required"`, `WWW-Authenticate` per PRD-500-R14.
- `{ kind: "not_found" }` → 404, `error.code: "not_found"` (per PRD-106-R28; same code for genuinely-absent and forbidden).
- `{ kind: "rate_limited"; retryAfterSeconds }` → 429, `error.code: "rate_limited"`, `Retry-After: <seconds>`. `details.retry_after_seconds` MAY be set to the same value.
- `{ kind: "validation"; details? }` → 4xx (default 400 unless the SDK's leaf adapter has stronger framework idioms; e.g., 406 for content-negotiation refusal per PRD-500-R16), `error.code: "validation"`, `details` propagated if provided (subject to PRD-500-R23 redaction).
- `{ kind: "internal"; details? }` → 5xx (default 500), `error.code: "internal"`, `details` MAY be omitted entirely; if provided, MUST NOT include stack traces, request bodies, or auth-scoped material per PRD-109-R14 / R15.

`error.message` is a fixed, code-specific human-readable string emitted by the SDK; the SDK MUST NOT propagate any free-form text from the resolver into `error.message` without sanitization. The default messages per code are:

- `"auth_required"` → `"Authentication required to access this resource."`
- `"not_found"` → `"The requested resource is not available."`
- `"rate_limited"` → `"Too many requests; retry after the indicated interval."`
- `"validation"` → `"The request was rejected by validation."`
- `"internal"` → `"An internal error occurred."`

A host MAY override these via configuration but the SDK MUST validate the override does not contain `{`, `}`, `<`, `>`, or any character class indicative of unredacted source data.

#### Existence-non-leak path

**PRD-500-R18.** The SDK's 404 path MUST be a single code path used for both `{ kind: "not_found" }` and any case where an `IdentityResolver` returns `{ kind: "principal" }` but the resolved principal cannot see the resource. The SDK MUST emit byte-for-byte identical responses for the two cases, modulo opaque non-identity-correlated request IDs (cite PRD-109-R3).

Specifically, the SDK MUST NOT:

- Emit different `Cache-Control` headers based on whether the resource is "absent" vs "present-but-forbidden".
- Emit a different `error.message` based on the same distinction.
- Emit different `Content-Length` (the body is the same byte string in both cases).
- Vary timing in a way correlated with the distinction (the SDK's resolver invocation is the same code path; PRD-600 probes for differential timing as part of its runtime test suite).

A 401, by contrast, MUST be reserved for the case where authentication is missing or invalid at the scope, NOT for a per-resource access-denial (cite PRD-109-R4).

#### ETag and 304

**PRD-500-R19.** Before invoking a resolver for a Core or Standard envelope, the SDK MUST:

1. Compute (or recompute, depending on the configured cache strategy) the resource's current `etag` per PRD-500-R20.
2. If the request carries `If-None-Match` matching the current `etag` byte-for-byte (modulo the double-quote wrapping of the HTTP header form), the SDK MUST emit `304 Not Modified` with the `ETag` header echoed and no body, per PRD-103-R8.
3. On `200`, the SDK MUST emit the `ETag` header per PRD-500-R15(4).

For NDJSON index responses, the SDK MUST emit `ETag` per line (each line carries its own `etag` field per PRD-103-R12). The HTTP-level `ETag` header on the NDJSON response is OPTIONAL; if emitted, it represents the file as a whole and is outside ACT's revalidation contract per PRD-103-R12.

#### Default ETag computer

**PRD-500-R20.** The SDK's default `EtagComputer` MUST implement PRD-103-R6's runtime derivation recipe:

1. Construct `{ identity, payload, tenant }` where:
   - `identity` is the `Identity.key` (or JSON `null` for anonymous).
   - `payload` is the envelope minus its `etag` field.
   - `tenant` is the `Tenant.key` (or JSON `null` for `single`).
2. JCS-canonicalize per RFC 8785.
3. SHA-256.
4. base64url no-padding.
5. Truncate to 22 chars.
6. Prepend `s256:`.

The default computer is exposed as a public helper; leaf SDKs and host applications MUST be able to call it directly for testing.

#### Override determinism

**PRD-500-R21.** A host MAY provide a custom `EtagComputer` of shape `(input: { identity: string | null; payload: unknown; tenant: string | null }) → string` that returns the ACT `etag` value (with the algorithm prefix). The override MUST:

1. Be deterministic given the same input triple — two replicas MUST produce the same output.
2. NOT mix request-local data into the computation (timestamps, request IDs, nonces, replica IDs); cite PRD-103-R7 / PRD-109-R17.
3. Return a value that satisfies PRD-103-R2's value-shape regex `^[a-z0-9]+:[A-Za-z0-9_-]+$`.

The SDK MUST validate the returned value-shape on every override invocation; an invalid value is mapped to `{ kind: "internal" }` and logged.

#### Cache-Control and Vary

**PRD-500-R22.** The SDK MUST set `Cache-Control` per PRD-103-R9 / PRD-106-R12 based on the resolved identity:

- `Identity.kind === "principal"` → `Cache-Control: private, must-revalidate`. The SDK MUST also set `Vary: Authorization` (or `Vary: Cookie` if the manifest's primary scheme is `cookie`).
- `Identity.kind === "anonymous"` AND `Tenant.kind === "single"` → `Cache-Control: public, max-age=<seconds>` where `<seconds>` defaults to 0 (revalidate every request) unless the host overrides it.
- `Identity.kind === "anonymous"` AND `Tenant.kind === "scoped"` → `Cache-Control: public, max-age=<seconds>` AND `Vary: <tenant-disambiguating-header>` per host configuration.

The host MAY override per-endpoint via configuration. The SDK MUST NOT emit `Cache-Control: private` on responses derived with `identity: null` (it would falsely scope a public response).

#### Logger no-PII shape

**PRD-500-R23.** The SDK MUST accept an opaque `Logger` of shape `{ event: (e: ActLogEvent) → void }` where `ActLogEvent` is a discriminated union over the events listed in PRD-500-R24. The SDK MUST NOT pass to the Logger:

- The full request URL when the URL carries auth-scoped identifiers (e.g., a per-tenant subdomain with a tenant ID embedded). The SDK passes the redacted form: `<scheme>://<host><redacted-path>` where path components matching common identifier patterns are replaced with `<id>`.
- Identity tokens, session IDs, raw headers (the SDK passes a header summary: present scheme names, but not values).
- Resolver-returned envelope content beyond `{ id, type }` when the envelope is identity-scoped.
- Error stack traces.

Cite PRD-109-R14 / R15. The SDK's Logger contract is the project's PII firewall for observability.

**PRD-500-R24.** The SDK MUST emit Logger events for at least these conditions:

- `"request_received"` — `{ method, path: <redacted>, has_auth: boolean }`.
- `"identity_resolved"` — `{ kind: "anonymous" | "principal" | "auth_required" }` (no `key`).
- `"tenant_resolved"` — `{ kind: "single" | "scoped" }` (no `key`).
- `"etag_match"` — `{ endpoint: "manifest" | "index" | "node" | "subtree" | "ndjson" | "search" }` (304 emitted).
- `"resolver_invoked"` — `{ endpoint, outcome_kind: "ok" | "not_found" | "auth_required" | "rate_limited" | "validation" | "internal" }`.
- `"response_sent"` — `{ status: number, etag_present: boolean }`.
- `"error"` — `{ stage: "normalize" | "identify" | "tenant" | "resolve" | "encode", message: <safe-string> }`.

The Logger MAY be a no-op. Hosts wanting structured observability SHOULD wire a real logger per their framework's conventions; PRD-501–505 illustrate.

#### Request-ID propagation

**PRD-500-R25.** The SDK MUST tolerate but MUST NOT consume an incoming `X-Request-Id` header for ETag computation (cite PRD-103-R7). The SDK MAY echo `X-Request-Id` on the response for observability convenience; if it does, the value MUST NOT influence the response body or the ETag.

#### Mountability

**PRD-500-R26.** The SDK MUST be mountable at any URL path. The construction function accepts a `basePath` configuration (default `""`) that is prepended to every advertised URL in the manifest (`index_url`, `node_url_template`, etc.) and stripped from incoming request paths before matching. This makes the SDK composable with a parent manifest's `mounts` (PRD-100-R7 / PRD-106-R17–R22).

A leaf SDK MUST NOT hard-code the well-known manifest path; the path MUST be configurable. The default is `/.well-known/act.json` per PRD-100-R3. When mounted under a `basePath` of `/app`, the well-known path becomes `/app/.well-known/act.json` — this is permitted; the parent manifest's `mounts` entry MUST point at the correct effective URL.

#### Lifetime hooks

**PRD-500-R27.** The SDK MAY expose lifetime hooks `init()` and `dispose()` for resource management (e.g., opening a database connection pool, initializing an authentication client). These hooks are OPTIONAL; a leaf SDK MAY omit them if its framework manages resources differently. When present, `init()` MUST be called before the first request is dispatched and `dispose()` MUST be called on shutdown.

#### Package layout

**PRD-500-R28.** First-party PRD-500–505 packages MUST follow the package naming pattern `@act/runtime-<framework>` for leaf SDKs (e.g., `@act/runtime-next`, `@act/runtime-express`, `@act/runtime-hono`) and `@act/runtime-core` for the shared contract (this PRD's TS interfaces and helpers). Per decision Q3, only TS-first-party packages ship in v0.1; PRD-503 (FastAPI) and PRD-504 (Rails) are spec-only and define equivalent package-name conventions in their respective ecosystems but ship no first-party code.

#### Discovery hand-off scope

**PRD-500-R29.** The SDK MUST emit the discovery hand-off `Link` header per PRD-106-R23 on every authenticated response from an ACT endpoint. Specifically:

- On every 200 / 304 / 401 / 404 / 429 / 5xx response from a request that the SDK dispatches.
- The header value is `</.well-known/act.json>; rel="act"; type="application/act-manifest+json"; profile="runtime"` (with the `basePath` prepended if configured).

The SDK MUST NOT emit the Link header on responses outside its dispatch (the host application is responsible for emitting on non-ACT endpoints; PRD-501–505 implementation notes describe a middleware pattern). The SDK MAY expose a public `actLinkHeaderMiddleware()` helper for the host to mount on its non-ACT branches; the helper enforces PRD-106-R23.

#### Bounded act_version rejection

**PRD-500-R30.** The SDK MUST reject requests carrying an `act_version` (in a body, query string, or `Accept-Version` header) whose MAJOR exceeds the SDK's configured MAJOR, per PRD-108-R8 / PRD-109-R20. The rejection MUST be bounded — no resolver invocation, no body parsing beyond the version string itself. The response MUST be 400 + `error.code: "validation"` + `details.reason: "act_version_unsupported"`.

A response with a higher MAJOR is undefined; consumers reject it per PRD-108-R8 — the SDK reciprocates on the producer side by refusing to process requests claiming to speak a future MAJOR.

#### Test fixture conformance

**PRD-500-R31.** Every leaf SDK (PRD-501–505) MUST pass the test fixture matrix under `fixtures/500/` when run via the harness specified in §"Test fixtures". The harness exercises the resolver pipeline end-to-end with mock requests; failure on any positive fixture is a leaf SDK conformance violation. PRD-600 incorporates the harness as part of its runtime probe.

#### Standard

**PRD-500-R32.** When the manifest declares `conformance.level: "standard" | "plus"`, the host MUST register `resolveSubtree`. The resolver receives `(req, ctx, { id, depth })` where `depth` is bounded to `[0, 8]` per PRD-100-R33; the SDK validates the bound before invoking and returns `{ kind: "validation"; details: { reason: "depth_out_of_range" } }` if the request's depth is outside the bound. The SDK MAY supply a default `depth` of `3` per PRD-100-R33 when the request omits one.

#### Plus

**PRD-500-R33.** When the manifest declares `conformance.level: "plus"`, the host MUST register `resolveIndexNdjson`. The resolver returns an `AsyncIterable<IndexEntry>`; the SDK serializes one JSON object per line with `\n` separators, emitting the `Content-Type: application/act-index+json; profile=ndjson; profile=runtime` header. Each line MUST satisfy PRD-100's `IndexEntry` schema, including its own `etag` per PRD-103-R12.

**PRD-500-R34.** When the manifest declares `conformance.level: "plus"`, the host MUST register `resolveSearch`. The resolver receives `(req, ctx, { query })` where `query` is the value extracted from the request's `{query}` placeholder per PRD-100-R39. The response shape is opaque-but-JSON for v0.1 per decision Q13: the SDK serializes whatever JSON-serializable value the resolver returns and emits `Content-Type: application/json; profile=runtime`. A future MINOR pins the response envelope; until then, PRD-500 SDKs MUST NOT impose a shape beyond "must JSON-serialize".

### Wire format / interface definition

The contract is a TypeScript interface set, not a JSON Schema. The signatures below are normative per PRD-500-R1.

#### Core types

```typescript
// --- Request normalization ---
export interface ActRequest {
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';
  readonly url: URL;
  readonly headers: Headers;
  getCookie(name: string): string | undefined;
}

// --- Identity & tenancy ---
export type Identity =
  | { kind: 'anonymous' }
  | { kind: 'principal'; key: string }
  | { kind: 'auth_required'; reason?: 'missing' | 'expired' | 'invalid' };

export type Tenant =
  | { kind: 'single' }
  | { kind: 'scoped'; key: string };

export interface IdentityResolver {
  (req: ActRequest): Promise<Identity>;
}

export interface TenantResolver {
  (req: ActRequest, identity: Identity): Promise<Tenant>;
}

// --- Resolution outcomes ---
export type Outcome<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'not_found' }
  | { kind: 'auth_required' }
  | { kind: 'rate_limited'; retryAfterSeconds: number }
  | { kind: 'validation'; details?: Record<string, unknown> }
  | { kind: 'internal'; details?: Record<string, unknown> };

// --- Per-request context ---
export interface ActContext {
  readonly identity: Identity;
  readonly tenant: Tenant;
}

// --- The resolver interface ---
export interface ActRuntime {
  resolveManifest(req: ActRequest, ctx: ActContext): Promise<Outcome<Manifest>>;
  resolveIndex(req: ActRequest, ctx: ActContext): Promise<Outcome<Index>>;
  resolveNode(req: ActRequest, ctx: ActContext, params: { id: string }): Promise<Outcome<Node>>;
  // Standard
  resolveSubtree?(req: ActRequest, ctx: ActContext, params: { id: string; depth: number }): Promise<Outcome<Subtree>>;
  // Plus
  resolveIndexNdjson?(req: ActRequest, ctx: ActContext): Promise<Outcome<AsyncIterable<IndexEntry>>>;
  resolveSearch?(req: ActRequest, ctx: ActContext, params: { query: string }): Promise<Outcome<unknown>>;
}
```

#### Configuration shape

```typescript
export interface ActRuntimeConfig {
  // The static manifest the SDK serves, pre-validated.
  readonly manifest: Manifest;

  // The resolver implementations (see ActRuntime).
  readonly runtime: ActRuntime;

  // Identity & tenancy hooks.
  readonly identityResolver: IdentityResolver;
  readonly tenantResolver?: TenantResolver;

  // Optional ETag override (defaults to PRD-103-R6 recipe).
  readonly etagComputer?: EtagComputer;

  // Logger hook (defaults to no-op).
  readonly logger?: Logger;

  // Mount path prefix; default "".
  readonly basePath?: string;

  // Default Cache-Control max-age for anonymous responses; default 0.
  readonly anonymousCacheSeconds?: number;
}

export interface EtagComputer {
  (input: { identity: string | null; payload: unknown; tenant: string | null }): string;
}

export interface Logger {
  event(e: ActLogEvent): void;
}

export type ActLogEvent =
  | { type: 'request_received'; method: string; path: string; has_auth: boolean }
  | { type: 'identity_resolved'; kind: Identity['kind'] }
  | { type: 'tenant_resolved'; kind: Tenant['kind'] }
  | { type: 'etag_match'; endpoint: ActEndpoint }
  | { type: 'resolver_invoked'; endpoint: ActEndpoint; outcome_kind: Outcome<unknown>['kind'] }
  | { type: 'response_sent'; status: number; etag_present: boolean }
  | { type: 'error'; stage: 'normalize' | 'identify' | 'tenant' | 'resolve' | 'encode'; message: string };

export type ActEndpoint = 'manifest' | 'index' | 'node' | 'subtree' | 'ndjson' | 'search';
```

#### Construction & dispatch

```typescript
// PRD-500-R10: validates resolver set vs declared level at construction time.
export function createActRuntime(config: ActRuntimeConfig): ActRuntimeInstance;

export interface ActRuntimeInstance {
  // The dispatch entry point for a normalized request.
  // Leaf SDKs invoke this from their framework adapter.
  dispatch(req: ActRequest): Promise<ActResponse>;

  // Optional lifetime hooks (PRD-500-R27).
  init?(): Promise<void>;
  dispose?(): Promise<void>;
}

export interface ActResponse {
  readonly status: number;
  readonly headers: Headers;
  // The body is either a serialized JSON string (manifest, index, node, subtree, error)
  // or an AsyncIterable<string> (NDJSON).
  readonly body: string | AsyncIterable<string> | null;
}
```

#### Helpers

```typescript
// PRD-500-R13.
export function encodeIdForUrl(id: string): string;

// PRD-500-R14.
export function buildAuthChallenges(manifest: Manifest): string[];

// PRD-500-R20: the default ETag computer.
export const defaultEtagComputer: EtagComputer;

// PRD-500-R29: discovery hand-off middleware for non-ACT host paths.
export function actLinkHeaderMiddleware(opts: { basePath?: string }): (req: ActRequest) => Headers;
```

### Errors

The SDK does not introduce new HTTP status codes. It maps `Outcome<T>` to status codes per PRD-106. The mapping:

| Resolver outcome | Status | `error.code` | Headers |
|---|---|---|---|
| `{ kind: "ok" }` | 200 (or 304 on If-None-Match match) | n/a | `ETag`, `Cache-Control`, `Vary`, `Content-Type`, discovery hand-off `Link` |
| `{ kind: "auth_required" }` | 401 | `auth_required` | One `WWW-Authenticate` per advertised scheme (PRD-500-R14) |
| `{ kind: "not_found" }` | 404 | `not_found` | Identical body & headers regardless of "absent" vs "forbidden" (PRD-500-R18) |
| `{ kind: "rate_limited"; retryAfterSeconds }` | 429 | `rate_limited` | `Retry-After: <seconds>` |
| `{ kind: "validation"; details? }` | 400 (default) or 406 (NDJSON not supported) | `validation` | Default headers |
| `{ kind: "internal"; details? }` | 500 (default) | `internal` | Default headers; body MAY be omitted |

Construction-time configuration errors (PRD-500-R10) are thrown synchronously from `createActRuntime` and never reach the wire. PRD-600 probes both: it fetches the live endpoints and asserts the conformance band matches, AND it imports the SDK and constructs a runtime with mismatched configuration to assert the construction error fires.

---

## Examples

Examples are non-normative but consistent with the Specification.

### Example 1 — Minimum-conformant Core SDK construction

```typescript
import { createActRuntime, defaultEtagComputer } from '@act/runtime-core';

const runtime = createActRuntime({
  manifest: {
    act_version: '0.1',
    site: { name: 'Acme Tiny Workspace' },
    delivery: 'runtime',
    conformance: { level: 'core' },
    auth: { schemes: ['cookie'] },
    index_url: '/act/index.json',
    node_url_template: '/act/n/{id}.json',
  },
  runtime: {
    resolveManifest: async (req, ctx) => ({ kind: 'ok', value: /* same as configured manifest */ }),
    resolveIndex: async (req, ctx) => {
      if (ctx.identity.kind === 'auth_required') return { kind: 'auth_required' };
      const docs = await loadDocsFor(ctx);
      return { kind: 'ok', value: { act_version: '0.1', nodes: docs.map(toIndexEntry) } };
    },
    resolveNode: async (req, ctx, { id }) => {
      if (ctx.identity.kind === 'auth_required') return { kind: 'auth_required' };
      const doc = await loadDoc(id, ctx);
      if (!doc) return { kind: 'not_found' }; // PRD-500-R18: same path for absent & forbidden.
      return { kind: 'ok', value: toNode(doc) };
    },
  },
  identityResolver: async (req) => {
    const session = req.getCookie('session');
    if (!session) return { kind: 'auth_required', reason: 'missing' };
    const principal = await verifySession(session);
    if (!principal) return { kind: 'auth_required', reason: 'invalid' };
    return { kind: 'principal', key: principal.id };
  },
  tenantResolver: async (req, identity) => {
    if (identity.kind !== 'principal') return { kind: 'single' };
    const tenant = await lookupTenant(identity.key);
    return { kind: 'scoped', key: tenant.id };
  },
});
```

The construction validates: level `"core"` requires only `resolveManifest`, `resolveIndex`, `resolveNode` (PRD-500-R10); all three are present. Construction succeeds.

### Example 2 — Plus SDK with NDJSON and search

```typescript
const runtime = createActRuntime({
  manifest: {
    act_version: '0.1',
    site: { name: 'Acme Plus Workspace' },
    delivery: 'runtime',
    conformance: { level: 'plus' },
    auth: { schemes: ['bearer', 'oauth2'], oauth2: { /* ... */ } },
    index_url: '/act/index.json',
    index_ndjson_url: '/act/index.ndjson',
    node_url_template: '/act/n/{id}.json',
    subtree_url_template: '/act/sub/{id}.json',
    search_url_template: '/act/search?q={query}',
  },
  runtime: {
    resolveManifest: /* ... */,
    resolveIndex: /* ... */,
    resolveNode: /* ... */,
    resolveSubtree: async (req, ctx, { id, depth }) => { /* Standard */ },
    resolveIndexNdjson: async (req, ctx) => { /* Plus */ },
    resolveSearch: async (req, ctx, { query }) => {
      // Response shape opaque-but-JSON per Q13.
      return { kind: 'ok', value: await runSearch(query, ctx) };
    },
  },
  identityResolver: /* ... */,
});
```

Construction validates that all four optional resolvers are registered for level `"plus"` (PRD-500-R10) and all required URL templates are in the manifest.

### Example 3 — Express-style adapter sketch

```typescript
// @act/runtime-express
import type { Request, Response } from 'express';
import { ActRuntimeInstance, ActRequest } from '@act/runtime-core';

export function actExpressMiddleware(runtime: ActRuntimeInstance, opts: { basePath?: string } = {}) {
  return async (req: Request, res: Response, next: () => void) => {
    if (!matchesActPath(req.path, opts.basePath)) return next();

    // PRD-500-R2: normalize.
    const actRequest: ActRequest = {
      method: req.method as ActRequest['method'],
      url: new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`),
      headers: new Headers(req.headers as Record<string, string>),
      getCookie: (name) => req.cookies?.[name],
    };

    const response = await runtime.dispatch(actRequest);

    res.status(response.status);
    response.headers.forEach((value, key) => res.append(key, value));

    if (typeof response.body === 'string') {
      res.send(response.body);
    } else if (response.body) {
      // NDJSON streaming.
      for await (const line of response.body) res.write(line);
      res.end();
    } else {
      res.end();
    }
  };
}
```

The adapter is ~30 lines. Every leaf SDK has the same shape; differences are in the framework's request-extraction conventions.

### Example 4 — Content negotiation (PRD-500-R16)

```typescript
// Inside the SDK's dispatch logic:
function selectIndexVariant(req: ActRequest, runtime: ActRuntime): 'json' | 'ndjson' | 'invalid' {
  const accept = req.headers.get('accept') ?? '';
  if (accept.includes('profile=ndjson')) {
    if (!runtime.resolveIndexNdjson) return 'invalid'; // 406.
    return 'ndjson';
  }
  return 'json';
}

// On 'invalid':
return {
  status: 406,
  headers: defaultHeaders,
  body: JSON.stringify({
    act_version: '0.1',
    error: {
      code: 'validation',
      message: 'The request was rejected by validation.',
      details: { reason: 'ndjson_not_supported' },
    },
  }),
};
```

### Example 5 — Identity hook pattern (PRD-500-R6)

```typescript
const identityResolver: IdentityResolver = async (req) => {
  const auth = req.headers.get('authorization');
  if (!auth) return { kind: 'anonymous' }; // public-tenant access permitted (PRD-106-R11).
  if (!auth.startsWith('Bearer ')) return { kind: 'auth_required', reason: 'invalid' };
  const token = auth.slice(7);
  const decoded = await verifyJwt(token);
  if (!decoded) return { kind: 'auth_required', reason: 'expired' };
  return { kind: 'principal', key: decoded.sub }; // PRD-103-R6: stable identity key.
};
```

The hook returns a stable string for the principal (`sub` claim, a UUID, etc.) — never a session token, never a value that rotates within the principal's lifetime. PRD-500-R6 / R7 enforce.

### Example 6 — ETag computation (PRD-500-R20)

```typescript
import { defaultEtagComputer } from '@act/runtime-core';

const etag = defaultEtagComputer({
  identity: 'user-42',
  payload: { act_version: '0.1', id: 'intro', /* ... node body minus etag */ },
  tenant: 'acme',
});
// → "s256:iH6ta82PUg0zi0lr_jpCLL"
```

The computer is exported so hosts and tests can use it directly. The runtime envelope's `etag` field MUST match what the computer returns for the same triple.

### Example 7 — Auth challenge helper (PRD-500-R14)

```typescript
import { buildAuthChallenges } from '@act/runtime-core';

const challenges = buildAuthChallenges({
  site: { name: 'app.acme.com' },
  auth: {
    schemes: ['cookie', 'bearer', 'oauth2'],
    oauth2: {
      authorization_endpoint: 'https://app.acme.com/oauth/authorize',
      token_endpoint: 'https://app.acme.com/oauth/token',
      scopes_supported: ['act.read'],
    },
  },
  /* ... */
} as Manifest);

// → [
//     'Cookie realm="app.acme.com"',
//     'Bearer realm="app.acme.com"',
//     'Bearer realm="app.acme.com", error="invalid_token", scope="act.read", authorization_uri="https://app.acme.com/oauth/authorize"',
//   ]
//
// On 401, each entry becomes one `WWW-Authenticate` header per PRD-106-R8 / PRD-500-R14.
```

### Example 8 — Hybrid mount composability (PRD-500-R26)

```typescript
// Mounted at /app:
const runtime = createActRuntime({
  manifest: { /* ... node_url_template: '/act/n/{id}.json' */ },
  basePath: '/app',
  /* ... */
});

// Effective URLs:
//   well-known: /app/.well-known/act.json
//   index:      /app/act/index.json
//   node:       /app/act/n/{id}.json

// Parent manifest at /.well-known/act.json declares:
// {
//   "mounts": [
//     {
//       "prefix": "/app",
//       "delivery": "runtime",
//       "manifest_url": "/app/.well-known/act.json",
//       "conformance": { "level": "standard" }
//     }
//   ]
// }
```

The runtime SDK is mountable; the parent's `mounts` entry references the SDK's effective well-known URL (PRD-100-R7 / PRD-106-R17–R22).

---

## Test fixtures

Fixtures live under `fixtures/500/{positive,negative}/` and are exercised by the SDK harness shared across PRD-501–505 and consumed by PRD-600 (validator) at probe time. PRD-500 enumerates the canonical fixture filenames; PRD-600 owns the actual files.

The harness shape: each fixture is a JSON document declaring `(input_request, configured_manifest, configured_runtime, expected_response)`. The harness:

1. Constructs an SDK instance from `configured_manifest` and `configured_runtime`.
2. Builds an `ActRequest` from `input_request`.
3. Invokes `runtime.dispatch(actRequest)`.
4. Asserts `actual_response` matches `expected_response` byte-for-byte (modulo redacted request IDs).

### Positive

- `fixtures/500/positive/core-manifest-200.json` → Core SDK serves `/.well-known/act.json` with 200 + `act_version` injection + ETag + Link header. Satisfies PRD-500-R3, R5, R8, R12, R15, R29.
- `fixtures/500/positive/core-index-anonymous-200.json` → Anonymous request to `/act/index.json` succeeds; `Cache-Control: public, max-age=0`; no `Vary: Authorization`. Satisfies PRD-500-R3, R6 (`anonymous`), R22.
- `fixtures/500/positive/core-node-principal-200.json` → Authenticated request returns 200 with `Cache-Control: private, must-revalidate` + `Vary: Authorization`. Satisfies PRD-500-R6 (`principal`), R7, R15, R22.
- `fixtures/500/positive/core-node-304-on-if-none-match.json` → Second request with `If-None-Match` matching current ETag returns 304 with no body, `ETag` header echoed. Satisfies PRD-500-R19, R20.
- `fixtures/500/positive/core-401-with-three-www-authenticate.json` → Manifest declares three schemes; 401 emits three `WWW-Authenticate` headers in advertised order. Satisfies PRD-500-R14.
- `fixtures/500/positive/core-existence-non-leak-symmetric-404.json` → Two requests (one for absent ID, one for present-but-forbidden ID) produce byte-for-byte identical 404 responses. Satisfies PRD-500-R17, R18 / PRD-109-R3.
- `fixtures/500/positive/standard-subtree-default-depth.json` → Standard SDK serves `/act/sub/{id}.json` with depth=3 default. Satisfies PRD-500-R3, R32.
- `fixtures/500/positive/plus-ndjson-content-negotiation.json` → `Accept: application/act-index+json; profile=ndjson` routes to `resolveIndexNdjson`; response Content-Type carries the profile parameter. Satisfies PRD-500-R16, R33.
- `fixtures/500/positive/plus-search-opaque-json.json` → `resolveSearch` returns an arbitrary JSON value; SDK serializes verbatim with `Content-Type: application/json; profile=runtime`. Satisfies PRD-500-R34 (Q13).
- `fixtures/500/positive/hybrid-mount-basepath.json` → SDK constructed with `basePath: "/app"`; well-known URL is `/app/.well-known/act.json`. Satisfies PRD-500-R26.
- `fixtures/500/positive/discovery-link-header-present.json` → Every ACT-endpoint response carries the `Link: rel="act"` header per PRD-106-R23. Satisfies PRD-500-R29.
- `fixtures/500/positive/etag-deterministic-across-replicas.json` → Two SDK instances with identical configuration produce byte-identical ETags for the same `(payload, identity, tenant)` triple. Satisfies PRD-500-R20, R21 / PRD-103-R7.

### Negative

- `fixtures/500/negative/level-plus-missing-search-resolver.json` → Manifest declares `conformance.level: "plus"` but `resolveSearch` is not registered. Construction throws an error per PRD-500-R10. Reporter MUST flag.
- `fixtures/500/negative/identity-with-pii-shape.json` → `IdentityResolver` returns `{ kind: "principal", key: "alice@acme.com" }` (an email). Validator emits a warning citing PRD-500-R6 / PRD-109-R14: identity keys SHOULD NOT be PII tokens.
- `fixtures/500/negative/etag-override-with-timestamp.json` → A custom `EtagComputer` mixes a timestamp into the hash input; two consecutive identical requests produce different ETags. Probe detects via two-request diff; flagged per PRD-500-R21 / PRD-103-R7 / PRD-109-R17.
- `fixtures/500/negative/401-www-authenticate-varies-by-url.json` → SDK varies the `WWW-Authenticate` header set based on the requested URL (e.g., includes a different scope on a known-private URL). Flagged per PRD-500-R14 / PRD-106-R8 / PRD-109-R5.
- `fixtures/500/negative/404-leaks-existence-via-cache-control.json` → 404 for "absent" returns `Cache-Control: public`; 404 for "forbidden" returns `Cache-Control: private`. Differential headers leak existence. Flagged per PRD-500-R18 / PRD-109-R3.
- `fixtures/500/negative/error-message-with-pii.json` → A resolver returns `{ kind: "internal", details: { user_email: "alice@acme.com" } }`; SDK propagates `details` into the response. Flagged per PRD-500-R17 / PRD-109-R15.
- `fixtures/500/negative/manifest-capabilities-array-form.json` → Host configures the manifest with `capabilities: ["subtree", "ndjson_index"]` (the legacy v0.1-draft array form). SDK construction rejects per PRD-500-R9 / PRD-100-R6.
- `fixtures/500/negative/logger-receives-raw-token.json` → Logger receives the request's `Authorization: Bearer <token>` header verbatim. Flagged per PRD-500-R23 / PRD-109-R14.
- `fixtures/500/negative/act-version-future-major-not-rejected.json` → Request carries `Accept-Version: 999.0`; SDK proceeds to invoke the resolver instead of bounded-rejecting. Flagged per PRD-500-R30 / PRD-108-R8 / PRD-109-R20.
- `fixtures/500/negative/discovery-link-header-missing-on-401.json` → 401 response omits the discovery hand-off Link header. Flagged per PRD-500-R29 / PRD-106-R23.

Each fixture's `_fixture_meta` block names the requirement(s) it satisfies or violates and the expected validator finding.

---

## Versioning & compatibility

Per PRD-108, classify each kind of change to PRD-500.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a new optional resolver method to `ActRuntime` (e.g., a future `resolveLocale`) | MINOR | PRD-108-R4(1). Existing leaf SDKs do not register the new resolver until they upgrade. |
| Add a new field to `ActRuntimeConfig` with a documented default | MINOR | PRD-108-R4(1). |
| Add a new `Outcome<T>` discriminator value | MAJOR | The discriminator is a closed enum at v0.1; adding a value is per PRD-108-R5(4). |
| Add a new value to `Identity['kind']` | MAJOR | Closed enum; PRD-108-R5(4). |
| Add a new value to `Tenant['kind']` | MAJOR | Same. |
| Add a new value to `ActLogEvent` discriminator | MINOR | The Logger contract is documented as additive; new event types are tolerated by hosts that switch on `type`. |
| Add a new value to `ActEndpoint` (e.g., a future locale-specific endpoint) | MINOR | Endpoint addition is MINOR per PRD-108-R4(2). |
| Tighten an `IdentityResolver` SHOULD to MUST | MAJOR | Per PRD-108-R5(3). |
| Loosen `Logger` no-PII MUSTs to SHOULDs | MAJOR | Per PRD-108-R5(3). Security regression; would not be approved. |
| Change the resolver method signatures (e.g., add a required parameter) | MAJOR | Per PRD-108-R5(2). Existing leaf SDKs and host applications break. |
| Change the package layout (e.g., rename `@act/runtime-core` to `@act/runtime`) | MAJOR | Per decision Q3, package names are part of the contract. |
| Add a new helper export (e.g., `buildVaryHeader`) | MINOR | Additive; PRD-108-R4(1). |
| Change the `EtagComputer` signature | MAJOR | Per PRD-108-R5(2). The override hook is part of the contract. |
| Change the discovery hand-off scope from "ACT endpoints only" to "all responses" | MAJOR | Tightens the SDK's obligation; existing host integrations would need to remove their own middleware. |
| Promote `actLinkHeaderMiddleware` from optional helper to mandatory exposure | MINOR | The middleware is already a public helper; making it mandatory across leaf SDKs is a documentation tightening. |
| Add a normative search response envelope shape (resolves Q13) | MINOR | The current shape is opaque-but-JSON; pinning it is additive — existing producers conform automatically if they emit JSON, and consumers gain a parsing contract. PRD-108-R4(1). |

### Forward compatibility

Per PRD-108-R7, host applications MUST tolerate unknown optional fields in `ActRuntimeConfig`. A leaf SDK upgrading from v0.1 to v0.2 of the contract MUST continue to satisfy v0.1 host applications — config fields the host doesn't know about are ignored. Resolver methods added in a future MINOR are OPTIONAL; the SDK invokes them only when registered.

A consumer of a runtime SDK (i.e., an agent fetching ACT envelopes) is unaffected by SDK-internal contract changes — the wire surface is owned by PRD-100 / PRD-103 / PRD-106. PRD-500 contract changes are visible only to host applications and leaf SDK authors.

### Backward compatibility

Within a MAJOR of PRD-500, every MINOR is backward-compatible with every prior MINOR. A leaf SDK shipped at PRD-500 v0.1 continues to satisfy host applications written against v0.1 even after PRD-500 advances to v0.2 / v0.3. Cross-MAJOR boundaries follow PRD-108-R12's deprecation window.

The package versioning is staged per PRD-108-R14 / decision Q5: at v0.1, leaf SDKs (PRD-501–505) pin to a single spec MINOR; once PRD-200 ratifies the staged transition, leaf SDKs MAY transition to MAJOR-pinned / MINOR-floating.

---

## Security considerations

Security posture is owned by **PRD-109** (Accepted). PRD-500 imports the constraints by reference; specific binding points:

- **Existence-non-leak via 404 (T1).** PRD-500-R18 routes both "absent" and "forbidden" through the same 404 path with byte-identical responses. The single-code-path discipline is the primary defense; PRD-600 probes for differential headers, body length, or timing. Cite PRD-109-R3 / R4.
- **Identity-no-leak via ETag (T2).** PRD-500-R20 / R21 ensure the SDK's default and override ETag computers obey PRD-103-R6 / R7 — the hash output is opaque, identity is hashed not embedded, and request-local data is forbidden as an input. Cite PRD-109-R16 / R17.
- **Cross-tenant cache poisoning (T3).** PRD-500-R22 emits `Vary: Authorization` (or `Vary: Cookie`) on identity-scoped responses; PRD-500-R7's `TenantResolver` ensures the tenant is part of the ETag triple. PRD-103-R6 + PRD-103-R9 own the wire-level rule; PRD-500 binds the SDK to it.
- **Identity correlation via stable ID (T4).** PRD-500-R6 / R7 require stable opaque keys — known property of v0.1; rotation is out of scope per PRD-109-R12.
- **PII via free-form error message (T5).** PRD-500-R17 emits fixed code-specific messages; resolver-supplied `details` are propagated only after the SDK validates per PRD-500-R23. Cite PRD-109-R14 / R15.
- **Logger no-PII (T5 reinforcement).** PRD-500-R23 / R24 explicitly redact URLs, headers, and resolver outputs before passing to the Logger. The Logger is the most common PII leak vector in observability tooling; the SDK's contract makes leaks structurally impossible without an explicit override. Cite PRD-109-R14.
- **Cross-origin mount trust (T6).** PRD-500 SDKs are mountable (PRD-500-R26) but do not themselves enforce cross-origin trust on parent manifests — that is the consumer's job per PRD-109-R21. Producers using PRD-500 to mount onto third-party origins MUST document the trust relationship in `manifest.policy` (owned by PRD-100).
- **DoS via inflated `act_version` (T7).** PRD-500-R30 reciprocates PRD-108-R8: the SDK rejects request-side `act_version` MAJOR mismatches in bounded time, before any resolver invocation. Cite PRD-109-R20.
- **DoS via unbounded subtree depth (T7).** PRD-500-R32 bounds depth at construction time per PRD-100-R33; an out-of-range request returns `validation` without invoking the resolver.
- **Per-node "agents only" non-feature (T8).** PRD-500 SDKs do not consume per-node access flags; the Logger MAY emit a warning if the resolver returns a node carrying such a field, but the SDK serves the node regardless per PRD-108-R7. Cite PRD-109-R22.
- **Discovery as a feature (T9).** The runtime-only Link header (PRD-500-R29) reveals the well-known path on every authenticated response by design. Producers wanting private discovery rely on auth gating the well-known endpoint itself; PRD-500's well-known handler invokes `IdentityResolver` like every other endpoint.

The SDK is the security front line because every runtime ACT response passes through it. The contract here makes the security-relevant defaults the hard-to-bypass path: a host application CAN bypass them (custom adapter, custom Logger), but the bypass is explicit and reviewable. Drift between the contract and the leaf SDK is detected by `fixtures/500/` and PRD-600.

---

## Implementation notes

This section ships canonical TypeScript snippets that leaf SDKs (PRD-501–505) and host applications can use as reference. The snippets are normative as patterns; the exact TypeScript text is illustrative.

### Pattern 1 — The resolver interface (PRD-500-R3)

```typescript
import type { ActRuntime, ActRequest, ActContext, Outcome } from '@act/runtime-core';

const runtime: ActRuntime = {
  resolveManifest: async (req, ctx) => ({
    kind: 'ok',
    value: configuredManifest,
  }),

  resolveIndex: async (req, ctx) => {
    if (ctx.identity.kind === 'auth_required') return { kind: 'auth_required' };
    const nodes = await loadVisibleNodes(ctx);
    return { kind: 'ok', value: { act_version: '0.1', nodes } };
  },

  resolveNode: async (req, ctx, { id }) => {
    if (ctx.identity.kind === 'auth_required') return { kind: 'auth_required' };
    const node = await loadNode(id, ctx);
    if (!node) return { kind: 'not_found' }; // covers "absent" and "forbidden" identically.
    return { kind: 'ok', value: node };
  },
};
```

### Pattern 2 — Leaf adapter (Express-style sketch, PRD-500-R11)

```typescript
import type { Request, Response } from 'express';
import { ActRuntimeInstance, ActRequest } from '@act/runtime-core';

export function actExpressMiddleware(rt: ActRuntimeInstance, opts: { basePath?: string } = {}) {
  return async (req: Request, res: Response, next: () => void) => {
    if (!isActPath(req.path, opts.basePath)) return next();

    const actRequest: ActRequest = {
      method: req.method as ActRequest['method'],
      url: new URL(req.originalUrl, `${req.protocol}://${req.get('host')}`),
      headers: new Headers(Object.entries(req.headers).flatMap(([k, v]) =>
        Array.isArray(v) ? v.map(vv => [k, vv]) : v ? [[k, v]] : []
      ) as [string, string][]),
      getCookie: (name) => req.cookies?.[name],
    };

    const r = await rt.dispatch(actRequest);
    res.status(r.status);
    r.headers.forEach((v, k) => res.append(k, v));
    if (typeof r.body === 'string') res.send(r.body);
    else if (r.body) { for await (const line of r.body) res.write(line); res.end(); }
    else res.end();
  };
}
```

### Pattern 3 — Content negotiation (PRD-500-R16)

```typescript
function selectIndexVariant(req: ActRequest, runtime: ActRuntime): 'json' | 'ndjson' | 'unsupported' {
  const accept = req.headers.get('accept') ?? '';
  if (/profile=ndjson/.test(accept)) {
    return runtime.resolveIndexNdjson ? 'ndjson' : 'unsupported';
  }
  return 'json';
}
```

### Pattern 4 — The auth hook (PRD-500-R6)

```typescript
import type { IdentityResolver } from '@act/runtime-core';

export const identityResolver: IdentityResolver = async (req) => {
  // Step 1: the public-tenant case (PRD-106-R11).
  const auth = req.headers.get('authorization');
  if (!auth) return { kind: 'anonymous' };

  // Step 2: bearer token validation.
  const m = /^Bearer (.+)$/.exec(auth);
  if (!m) return { kind: 'auth_required', reason: 'invalid' };
  const claims = await verifyJwt(m[1]);
  if (!claims) return { kind: 'auth_required', reason: 'expired' };

  // Step 3: stable identity key (PRD-103-R6).
  return { kind: 'principal', key: claims.sub };
};
```

### Pattern 5 — The ETag hook (PRD-500-R20, R21)

```typescript
import { defaultEtagComputer } from '@act/runtime-core';

// Default — this is what the SDK uses if the host omits etagComputer.
const etag = defaultEtagComputer({
  identity: ctx.identity.kind === 'principal' ? ctx.identity.key : null,
  payload: { /* envelope minus etag field */ },
  tenant: ctx.tenant.kind === 'scoped' ? ctx.tenant.key : null,
});

// Custom override — MUST be deterministic, MUST NOT mix request-local data.
import type { EtagComputer } from '@act/runtime-core';
const customEtag: EtagComputer = ({ identity, payload, tenant }) => {
  // e.g., delegate to a cached precomputed table keyed on (identity, tenant, payload-hash):
  return cache.get(stableKey({ identity, payload, tenant })) ?? defaultEtagComputer({ identity, payload, tenant });
};
```

### Pattern 6 — Identity & tenancy scoping (PRD-500-R6, R7, R22)

```typescript
// Per-tenant scoping: a runtime server scopes every endpoint by the requesting identity's tenant.
const tenantResolver: TenantResolver = async (req, identity) => {
  if (identity.kind !== 'principal') return { kind: 'single' };
  // The principal's primary tenant — STABLE per PRD-100-R15 / PRD-106-R16.
  const tenantKey = await tenants.lookupPrimary(identity.key);
  return { kind: 'scoped', key: tenantKey };
};

// Inside the SDK's response builder, given (identity, tenant):
function cacheControlFor(identity: Identity, tenant: Tenant, anonSeconds: number): string {
  if (identity.kind === 'principal') return 'private, must-revalidate';
  if (tenant.kind === 'scoped') return `public, max-age=${anonSeconds}`;
  return `public, max-age=${anonSeconds}`;
}
```

### Pattern 7 — Error mapping (PRD-500-R17, R18)

```typescript
function buildErrorResponse(
  outcome: Exclude<Outcome<unknown>, { kind: 'ok' }>,
  manifest: Manifest,
): { status: number; headers: Headers; body: string } {
  const headers = new Headers({
    'Content-Type': 'application/act-error+json; profile=runtime',
    Link: '</.well-known/act.json>; rel="act"; type="application/act-manifest+json"; profile="runtime"',
  });

  switch (outcome.kind) {
    case 'auth_required': {
      buildAuthChallenges(manifest).forEach((c) => headers.append('WWW-Authenticate', c));
      return { status: 401, headers, body: errorEnvelope('auth_required') };
    }
    case 'not_found':
      // PRD-500-R18: identical body & headers regardless of "absent" vs "forbidden".
      return { status: 404, headers, body: errorEnvelope('not_found') };
    case 'rate_limited':
      headers.set('Retry-After', String(outcome.retryAfterSeconds));
      return { status: 429, headers, body: errorEnvelope('rate_limited', { retry_after_seconds: outcome.retryAfterSeconds }) };
    case 'validation':
      return { status: 400, headers, body: errorEnvelope('validation', outcome.details) };
    case 'internal':
      return { status: 500, headers, body: errorEnvelope('internal') };
  }
}

const ERROR_MESSAGES: Record<string, string> = {
  auth_required: 'Authentication required to access this resource.',
  not_found: 'The requested resource is not available.',
  rate_limited: 'Too many requests; retry after the indicated interval.',
  validation: 'The request was rejected by validation.',
  internal: 'An internal error occurred.',
};

function errorEnvelope(code: string, details?: Record<string, unknown>): string {
  return JSON.stringify({
    act_version: '0.1',
    error: { code, message: ERROR_MESSAGES[code], ...(details ? { details } : {}) },
  });
}
```

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft. Locks the runtime SDK contract (resolver shape, identity/tenancy hooks, capability negotiation, caching contract, auth & error mapping, endpoint surface, content negotiation, hybrid-mount composability, logging hooks, test fixture harness). Cites PRD-100 (envelope shapes), PRD-103 (ETag derivation), PRD-106 (runtime endpoints, status codes, auth, mounts, discovery hand-off), PRD-107 (conformance levels), PRD-108 (versioning), PRD-109 (security threat model). Implements gaps C1–C5 on the SDK side (PRD-106 covers the wire side). TS-only first-party per decision Q3; PRD-503 (FastAPI) and PRD-504 (Rails) leaves are spec-only. Search response envelope opaque-but-JSON per decision Q13 (deferred to v0.2). Status: In review. |
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review. Decisions: (1) ratify `@act/runtime-core` + `@act/runtime-<framework>` package layout (Q1 yes); (2) defer `resolveIndex` pagination cursor to v0.2 (Q2 no — Plus shards via NDJSON); (3) discovery hand-off Link header scoped to ACT endpoints only, leaf SDKs export optional `actLinkHeaderMiddleware` for broader scope (Q3 yes/scoped); (4) `TenantResolver` returns a single opaque string regardless of derivation strategy (Q4 no); (5) NDJSON profile routes via `Accept: application/act-index+json; profile=ndjson` (Q5 yes). Ratified judgment calls: `Outcome<T>` discriminated union (no exceptions), opaque `Identity`/`Tenant` keys, construction-time capability validation (R10), `basePath` mount mechanism (R26), opaque-but-JSON search response per Q13 (R34), structured discriminated-union Logger event stream (R23/R24). No normative requirement text changed; only Open Questions section. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
