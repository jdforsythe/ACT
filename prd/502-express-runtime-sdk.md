# PRD-502 — Express runtime SDK

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

PRD-500 (runtime SDK contract, In review) pins the framework-neutral resolver shape, identity / tenancy hooks, capability negotiation, ETag / 304 behavior, auth / error mapping, and the `dispatch` pipeline that every leaf SDK must implement. PRD-501 (Next.js, In review) is the App Router-flavored leaf. Express is the second-most-prevalent server-rendering host in the Node.js ecosystem — it is the reference shape for every middleware-based framework (Koa, Fastify-as-Express-compat, Restify, etc.) — and a large fraction of v0.1 enterprise integrations will land on Express servers. Without a first-party Express adapter, those integrations either depend on PRD-505 (generic WHATWG-fetch handler) and pay the impedance mismatch tax of converting Express's Node-style `req`/`res` to WHATWG `Request`/`Response` on every request, or they reinvent the adapter ad-hoc. Per decision Q3, Express is in scope as a TS-only first-party reference. This PRD specifies the leaf adapter that wires PRD-500's framework-neutral contract onto Express's Router / middleware idiom, with particular attention to (a) Express's path-to-regexp routing of IDs containing `/`, (b) Express's middleware composition for hybrid mounts via `app.use('/sub-prefix', actRouter(...))`, and (c) the impedance with `@types/express` typings for handler signatures.

The leaf is intentionally thin. Per PRD-500-R1 / R11, a leaf adapter is glue between framework-native requests and the SDK's `dispatch` pipeline. PRD-502's normative job is to specify (a) `actRouter(options)` returning an Express `Router` and `createActMiddleware(options)` returning an ad-hoc middleware function, (b) how Express's `req` becomes PRD-500's `ActRequest`, (c) how Express's `res` carries PRD-500's `ActResponse` (including the per-line streaming for NDJSON), (d) the `:id` segment routing rules so an ID like `doc/proj-launch-2026` (containing a `/`) reaches `resolveNode` correctly, (e) the typed handler signatures using `@types/express`, (f) hybrid-mount composability via Express's native `app.use(prefix, router)` pattern.

### Goals

1. Lock the Express integration shape: a primary `actRouter(options)` factory returning an Express `Router` mounted at the configured base path, and a secondary `createActMiddleware(options)` for hosts that need ad-hoc placement (e.g., a single endpoint behind a custom middleware chain).
2. Lock the canonical mount paths and the Express path-to-regexp rules. The default mount is at the root (`/`); when wired with `app.use('/', actRouter())`, the router serves `/.well-known/act.json`, `/act/index.json`, `/act/n/:id(*)`, `/act/sub/:id(*)`, `/act/index.ndjson`, `/act/search`. The `:id(*)` regex form is required to admit IDs containing `/` per PRD-100-R10.
3. Lock the identity / tenancy hooks: middleware-style, taking `(req, res) => Promise<Identity>` and `(req, res, identity) => Promise<Tenant>` over Express's `Request` / `Response` types, with worked patterns for express-session, Passport, JWT in `Authorization`, and header-based service identity.
4. Lock the request normalization: how Express's Node-style `req` (with `req.cookies`, `req.headers`, `req.url`, `req.method`) maps to PRD-500's `ActRequest`. Cookie reading uses `cookie-parser` middleware as the recommended baseline; the SDK does not depend on a specific cookie-parsing library but documents the pattern.
5. Lock the response wiring: how PRD-500's `ActResponse` (status, headers, body string or `AsyncIterable<string>`) maps to Express's `res.status().set().send()` chain, with NDJSON streaming via `res.write()` per line.
6. Lock the auth & error mapping: parallel to PRD-501-R13 / R14 — 401 with one `WWW-Authenticate` per advertised scheme via `res.append('WWW-Authenticate', challenge)`, 404 covering both genuinely-absent and forbidden, 429 with `Retry-After`, 5xx with bounded `details`.
7. Lock hybrid-mount composability via Express's `app.use('/sub-prefix', actRouter({ basePath: '/sub-prefix', ... }))` pattern (PRD-100-R7 / PRD-106-R17–R22 / PRD-500-R26).
8. Lock the structured-logger wiring: Express's logging is conventionally `morgan` for request-line logs and `pino`/`winston` for application logs; the SDK accepts a Logger per PRD-500-R23 / R24 and documents both wiring patterns.
9. Lock typed handler signatures using `@types/express`'s `Request`, `Response`, `NextFunction`, `Router`, `RequestHandler` so host applications get IDE auto-complete on the SDK's public surface.
10. Specify the test-fixture matrix this leaf SDK MUST pass under `fixtures/502/` and align with the shared SDK harness under `fixtures/500/`.

### Non-goals

1. **Re-specifying PRD-500's contract.** The resolver shape, the `Outcome<T>` discriminator, the identity / tenant types, the `EtagComputer` signature, the `Logger` shape, and the `ActRuntime` interface are owned by PRD-500.
2. **Re-specifying PRD-100 envelope shapes, PRD-103 ETag derivation, or PRD-106 status-code semantics.** Cited by reference.
3. **Defining a new auth scheme.** The SDK consumes the host's existing auth (express-session, Passport strategies, custom JWT middleware, mTLS at the edge, etc.). PRD-502 does not authenticate.
4. **Defining the search response envelope.** Per decision Q13, deferred to v0.2; `resolveSearch` returns opaque-but-JSON.
5. **Defining MCP-bridge integration.** PRD-602 is the coexistence neighbor; an Express app MAY expose both an ACT runtime router and an MCP server, but PRD-502 imposes no constraint beyond mountability.
6. **Defining static-export behavior.** ACT's static profile is owned by PRD-105 + the 200-series adapters + the 400-series generators. PRD-502 is runtime-only.
7. **Supporting Express 4 vs Express 5 simultaneously.** The SDK targets Express 4.x as the reference baseline (the dominant version at v0.1 authoring time). Express 5 compatibility is best-effort; both versions share the same `Router` / middleware idiom and the SDK's surface should work on either, but the test matrix runs against Express 4.
8. **Supporting Koa, Fastify, or other middleware-based frameworks directly.** Each framework gets its own leaf if and when prioritized; the v0.1 set is Next.js (PRD-501), Express (this PRD), and the generic WHATWG-fetch handler (PRD-505) which covers Hono and other fetch-native frameworks.
9. **Defining a request-id propagation pattern beyond PRD-500-R25.** The SDK MAY echo `X-Request-Id` if the host's middleware sets it; this is delegated to PRD-500.

### Stakeholders / audience

- **Authors of:** PRD-600 (validator — must probe Express-specific behavior using the harness shared with `fixtures/500/`), implementation team in Phase 6 (the agent role that builds `@act/runtime-express`), any future PRD-700-series example using Express as its host (none currently planned for v0.1, but the shape is here for v0.2).
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Express's path-to-regexp default for `:id` matches a single path segment, dropping the second half of `doc/proj-launch-2026`. | High if `:id` is used naively | High | PRD-502-R4 mandates the `:id(*)` regex form (or a custom regex pattern that admits `/`). The implementation note shows the canonical router. Negative fixture exercises the bug. |
| Express's `res.send()` / `res.json()` defaults set `Content-Type: application/json; charset=utf-8`, conflicting with ACT's MIME types (`application/act-manifest+json`, etc.). | High | Medium | PRD-502-R10 mandates `res.set('Content-Type', actResponse.headers.get('Content-Type'))` BEFORE `res.send()` — the SDK adapter sets explicit Content-Type. |
| Cookie reading varies: `cookie-parser` middleware sets `req.cookies` (object); without it, cookies live in `req.headers.cookie` (string). The SDK can't depend on a specific library. | Medium | Medium | PRD-502-R5 specifies the SDK's `getCookie` accessor MUST tolerate both — preferring `req.cookies` if present, falling back to parsing `req.headers.cookie` directly. The SDK ships its own minimal cookie parser to avoid a dep. |
| Express's middleware ordering means the SDK's router can be placed before or after auth middleware, with different semantics. The host might wire auth AFTER the SDK and expect `IdentityResolver` to read populated `req.user` — but `req.user` won't be populated yet. | Medium | Medium | PRD-502-R6 documents the ordering: auth middleware MUST run BEFORE `actRouter`, OR the `IdentityResolver` MUST read the raw headers / cookies independently of middleware-populated state. The implementation note shows both patterns. |
| Hybrid mount: `app.use('/app', actRouter(...))` Strips `/app` from `req.url` but `req.originalUrl` still has it. The SDK uses `req.url` for dispatch, so the configured `basePath` MUST match what Express strips. | Low | Medium | PRD-502-R8 specifies the SDK uses `req.url` (the path-stripped form) for matching ACT endpoints; the `basePath` in `defineActMount` is the prefix Express uses in `app.use(prefix, router)`. They MUST be consistent; the implementation note pins the relationship. |
| Express's default error handler (a `(err, req, res, next) => ...` four-arg middleware) can intercept the SDK's responses if it's mounted globally and an upstream middleware throws. | Low | Low | PRD-502-R14 ensures the SDK's responses are sent via `res.send()` / `res.end()` directly, never via `next(err)` — Express error handlers don't intercept already-sent responses. |
| NDJSON streaming over Express requires `res.write()` per line + `res.end()`; flushing semantics differ from Next.js's `ReadableStream`. | Low | Medium | PRD-502-R10 specifies the streaming pattern verbatim. The host application's reverse proxy (nginx, Caddy) MUST be configured to disable buffering for the NDJSON endpoint; documented in implementation notes. |

### Open questions

1. ~~Should the SDK expose a separate `actErrorHandler` four-arg middleware for hosts that want to wire ACT errors into their global error chain?~~ **Resolved (2026-05-01): No.** Ratifies tentative answer. The SDK sends responses synchronously per PRD-502-R14; resolver-thrown exceptions are caught inside `dispatch` and mapped to `{ kind: "internal" }` per PRD-500-R4. An external error-handler middleware would only fire if the SDK's own dispatch threw synchronously, which the contract forbids. Adding the helper would imply error semantics the SDK does not have and risk forwarding already-sent responses via `next(err)`. Revisit in v0.2 if implementer feedback signals friction. (Closes Open Question 1.)
2. ~~Should `actRouter` accept an optional `requestNormalizer` for hosts that have already pre-converted `req` to a WHATWG `Request` (e.g., via an adapter middleware)?~~ **Resolved (2026-05-01): No.** Ratifies tentative answer. The SDK's normalizer is internal, consistent, and tested against the shared `fixtures/500/` harness. Allowing a host-supplied normalizer creates a non-trivial divergence surface and weakens the contract guarantees in PRD-500-R2. Hosts that want to share a normalizer across frameworks should use PRD-505's generic WHATWG-fetch handler directly instead of an Express-shaped wrapper. (Closes Open Question 2.)
3. ~~Should the SDK ship an Express 4 adapter and a separate Express 5 adapter with different package paths?~~ **Resolved (2026-05-01): No.** Ratifies tentative answer. The public surface is identical; the small Express 4 vs 5 differences (promise-returning middleware semantics, path-to-regexp default changes) are handled by an internal compatibility shim. Splitting packages would multiply the matrix of `@types/express` peer deps and confuse hosts. One package for both lines. (Closes Open Question 3.)
4. ~~Should the SDK support the `cookie-parser` middleware's signed-cookie API?~~ **Resolved (2026-05-01): No.** Ratifies tentative answer. `Identity.key` resolution is the host's job per PRD-500-R6; the SDK's `getCookie` accessor returns the raw value. Hosts using signed cookies (`cookie-parser`'s `req.signedCookies`) validate the signature inside their `IdentityResolver` before deriving `Identity.key`. Building signed-cookie support into the SDK would couple the contract to a specific cookie-parsing library and conflict with PRD-502-R5's library-agnostic posture. (Closes Open Question 4.)

### Acceptance criteria

- [ ] Specification opens with a table of parent PRD-500 requirements implemented + 100-series + PRD-103/106/109 requirements implemented (Phase 3 addition per workflow.md).
- [ ] Every normative requirement uses RFC 2119 keywords; ID `PRD-502-R{n}`.
- [ ] Conformance level (Core / Standard / Plus) declared per requirement, citing PRD-107.
- [ ] Implementation notes section present with ~5 short TypeScript snippets in idiomatic Express style (factory function shape, identity hook example, hybrid-mount example, error-mapping wiring).
- [ ] Test fixtures enumerated under `fixtures/502/{positive,negative}/`, aligned with `fixtures/500/`.
- [ ] No new JSON Schemas added under `schemas/502/` (the SDK serves PRD-100 envelopes).
- [ ] Open questions ≤ 5.
- [ ] Changelog entry dated 2026-05-01 by Jeremy Forsythe.

---

## Context & dependencies

### Depends on

- **PRD-500** (Runtime SDK contract): In review. Full resolver shape (`ActRuntime`), identity / tenancy hooks (`IdentityResolver` / `TenantResolver`), `Outcome<T>` discriminator, `EtagComputer`, `Logger`, `ActRequest` / `ActResponse`, `dispatch` pipeline (PRD-500-R5). PRD-502 is a leaf adapter under PRD-500-R11.
- **PRD-100** (Wire format & envelope shapes): Accepted. Manifest, index, node, subtree, error envelopes (PRD-100-R3–R8, R10–R15, R16–R20, R21–R27, R32–R36, R37–R40, R41–R44, R46).
- **PRD-103** (Caching, ETags, validators): Accepted. ETag derivation (PRD-103-R1, R6, R7, R8, R9, R10), invoked through PRD-500's `defaultEtagComputer` (PRD-500-R20).
- **PRD-106** (Runtime delivery profile): Accepted. Endpoint set (PRD-106-R1), status codes (PRD-106-R3–R6), auth (PRD-106-R7–R11), caching (PRD-106-R12), URL encoding (PRD-106-R13–R15), per-tenant ID stability (PRD-106-R16), mounts (PRD-106-R17–R22), discovery hand-off (PRD-106-R23–R25), error envelope (PRD-106-R26–R30).
- **PRD-107** (Conformance levels): Accepted.
- **PRD-108** (Versioning policy): Accepted.
- **PRD-109** (Security): Accepted. Existence-non-leak (T1, R3, R4), identity-no-leak (T2, R16, R17), per-tenant scoping (T3, R11, R13), error-message PII (T5, R14, R15).
- **000-governance**: Accepted.
- External: [Express 4 documentation](https://expressjs.com/en/4x/api.html); [`@types/express`](https://www.npmjs.com/package/@types/express) for TypeScript handler signatures; [path-to-regexp](https://github.com/pillarjs/path-to-regexp) (Express's route-matching library); [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174); TypeScript 5.x.

### Blocks

- **PRD-600** (Validator) — incorporates `fixtures/502/` into its runtime probe.

### References

- v0.1 draft: §5.13 (Runtime serving). No specific Express example in the draft; PRD-502 establishes the shape.
- `prd/000-decisions-needed.md`: Q3 (TS-only first-party for v0.1 — PRD-502 is in scope), Q4 (Apache-2.0 for code — applies to `@act/runtime-express` package), Q13 (search-body envelope deferred to v0.2 — applies to `resolveSearch`).
- Prior art: Express's own [Router documentation](https://expressjs.com/en/4x/api.html#router); `apollo-server-express`'s integration shape; tRPC's `@trpc/server/adapters/express`. None directly adopted; cited for shape.

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) where requirements are imposed. Lowercase "must" and "should" are non-normative prose.

### Parent + 100-series requirements implemented

PRD-502 is a faithful adapter of PRD-500's contract onto Express. The table below lists every PRD-500 (parent) and 100-series requirement this PRD implements, the Express mechanism, and the PRD-502 requirement(s) that bind the SDK to the implementation.

| Source requirement | Source PRD | Mechanism (Express) | PRD-502 requirement |
|---|---|---|---|
| Resolver interface (`ActRuntime`) | PRD-500-R3 | Host registers via `actRouter({ runtime })`; SDK wraps in Express middleware functions | PRD-502-R2, R3 |
| Request normalization (`ActRequest`) | PRD-500-R2 | Adapter converts Express `Request` (Node-style) → `ActRequest` | PRD-502-R5 |
| Identity resolver | PRD-500-R6 | Host registers `IdentityResolver`; worked patterns for express-session, Passport, JWT, header service identity | PRD-502-R6 |
| Tenant resolver | PRD-500-R7 | Host registers `TenantResolver`; subdomain / path-prefix / header strategies in implementation notes | PRD-502-R7 |
| Capability negotiation (construction-time) | PRD-500-R10 | `actRouter` validates resolver set vs declared `conformance.level` at construction | PRD-502-R3 |
| Endpoint set per level | PRD-106-R1, PRD-500-R3 | Express Router routes: `GET /.well-known/act.json`, `GET /act/index.json`, `GET /act/n/:id(*)`, `GET /act/sub/:id(*)`, `GET /act/index.ndjson`, `GET /act/search` | PRD-502-R3, R4 |
| ID with `/` (catch-all routing) | PRD-100-R10, PRD-106-R14, R15 | Express `:id(*)` regex form admits `/`; SDK percent-decodes per PRD-106-R15 | PRD-502-R4 |
| `act_version` injection | PRD-100-R1, PRD-108-R1, PRD-500-R12 | Delegated to PRD-500's `dispatch` | PRD-502-R10 |
| MIME types per envelope | PRD-100-R46 | SDK calls `res.set('Content-Type', ...)` per endpoint with `profile=runtime` | PRD-502-R10 |
| `delivery: "runtime"` declaration | PRD-106-R25, PRD-500-R8 | SDK injects on `resolveManifest` output if host omits | PRD-502-R10 |
| Status code mapping | PRD-106-R3–R6, PRD-500-R15, R17, R18 | Delegated to PRD-500's `dispatch`; `res.status(actResponse.status)` carries verbatim | PRD-502-R11, R13, R14 |
| `WWW-Authenticate` per scheme on 401 | PRD-106-R8, PRD-500-R14, PRD-109-R5 | SDK invokes `buildAuthChallenges(manifest)`, calls `res.append('WWW-Authenticate', challenge)` per challenge | PRD-502-R13 |
| ETag derivation (runtime triple) | PRD-103-R6, PRD-500-R20 | Delegated to `defaultEtagComputer`; host MAY override per PRD-500-R21 | PRD-502-R12 |
| `If-None-Match` → 304 | PRD-103-R8, PRD-106-R3, PRD-500-R19 | Delegated; the Express `res` carries 304 with no body | PRD-502-R12 |
| `Cache-Control` + `Vary` per identity | PRD-103-R9, PRD-106-R12, PRD-500-R22 | Delegated; SDK does not override | PRD-502-R12 |
| Existence-non-leak | PRD-106-R6, PRD-109-R3, PRD-500-R18 | Delegated; the `res` body is byte-identical for both branches | PRD-502-R14 |
| Error envelope shape | PRD-100-R41–R44, PRD-106-R26, PRD-500-R17 | Delegated; SDK serializes the envelope from `Outcome<T>` | PRD-502-R14 |
| Discovery hand-off Link header | PRD-106-R23, PRD-500-R29 | SDK calls `res.append('Link', ...)` on every dispatched response; `actLinkHeaderMiddleware()` provided for non-ACT routes | PRD-502-R17 |
| Hybrid mount composability | PRD-100-R7, PRD-106-R17–R22, PRD-500-R26 | `app.use('/sub-prefix', actRouter({ basePath: '/sub-prefix' }))`; effective URLs reflect the prefix | PRD-502-R8, R18 |
| Bounded `act_version` rejection | PRD-108-R8, PRD-500-R30, PRD-109-R20 | Delegated to PRD-500's `dispatch` | PRD-502-R11 |
| Logger no-PII | PRD-109-R14, PRD-500-R23, R24 | Host registers `Logger`; SDK respects PRD-500-R23 redaction; documented patterns for morgan / pino / winston | PRD-502-R16 |
| Standard subtree resolver | PRD-100-R32–R36, PRD-500-R32 | Host registers `resolveSubtree`; route at `/act/sub/:id(*)` | PRD-502-R3, R21 |
| Plus NDJSON resolver | PRD-100-R37, PRD-106-R32, PRD-500-R33 | Host registers `resolveIndexNdjson`; route at `/act/index.ndjson` with `res.write()` per line | PRD-502-R3, R10, R22 |
| Plus search resolver | PRD-100-R39, PRD-106-R33, PRD-500-R34 | Host registers `resolveSearch`; route at `/act/search` reading `?q={query}` | PRD-502-R3, R22 |
| Content negotiation (NDJSON profile) | PRD-500-R16 | Delegated; the index handler routes to `resolveIndexNdjson` when `Accept` carries `profile=ndjson` | PRD-502-R15 |

The remainder of this Specification section binds the SDK to these implementations through normative requirements with PRD-502-R{n} IDs.

### Conformance level

Per PRD-107, PRD-502 requirements are banded:

- **Core:** PRD-502-R1 (the contract is normative), R2 (`actRouter` factory), R3 (`actRouter` returns Express `Router`; capability negotiation at construction), R4 (`:id(*)` regex form for catch-all IDs), R5 (request normalization), R6 (Express identity hook contract), R7 (Express tenant hook contract), R8 (`basePath` configurability), R9 (manifest serving), R10 (response wiring including NDJSON streaming), R11 (status-code mapping delegated to PRD-500), R12 (ETag / 304 / Cache-Control / Vary delegated to PRD-500), R13 (auth challenge wiring), R14 (error envelope delegated; existence-non-leak), R15 (content negotiation delegated), R16 (Logger wiring), R17 (discovery hand-off Link header), R18 (hybrid mount via `app.use(prefix, router)`), R19 (typed handler signatures), R20 (`createActMiddleware` ad-hoc helper), R23 (test fixture conformance).
- **Standard:** PRD-502-R21 (subtree route when manifest declares `conformance.level: "standard" | "plus"`).
- **Plus:** PRD-502-R22 (NDJSON index route + search route when manifest declares `conformance.level: "plus"`).

Auth scoping is orthogonal to level (per PRD-107-R4 / PRD-109-R10).

### Normative requirements

#### Meta

**PRD-502-R1.** This PRD's TypeScript signatures in §"Wire format / interface definition" are normative. The `@act/runtime-express` package MUST expose a public API structurally compatible with these signatures. PRD-502 narrows PRD-500's framework-neutral contract onto Express without widening PRD-500's obligations.

#### Factory shape

**PRD-502-R2.** The SDK MUST expose a public function `actRouter(options): express.Router` that returns an Express `Router` carrying all per-endpoint routes. The Router is mountable at any path via `app.use('/optional-prefix', actRouter(options))`; the configured `basePath` (PRD-502-R8) MUST match the prefix Express strips.

The SDK MUST additionally expose a public function `createActMiddleware(options, endpoint): express.RequestHandler` that returns a single middleware function for one endpoint (`'manifest' | 'index' | 'node' | 'subtree' | 'indexNdjson' | 'search'`). This is the lower-level helper for hosts that want to mount individual endpoints on bespoke paths or compose with custom upstream middleware.

#### Router routes

**PRD-502-R3.** When constructed via `actRouter(options)`, the SDK MUST register the following routes on the returned `Router` (relative to the router's mount point; `basePath` is applied to advertised URLs in the manifest, NOT to the router's internal route definitions):

- `router.get('/.well-known/act.json', manifestHandler)` — Core, REQUIRED.
- `router.get('/act/index.json', indexHandler)` — Core, REQUIRED.
- `router.get('/act/n/:id(*)', nodeHandler)` — Core, REQUIRED. The `:id(*)` regex form admits IDs containing `/` per PRD-502-R4.
- `router.get('/act/sub/:id(*)', subtreeHandler)` — Standard / Plus, REQUIRED when manifest declares `conformance.level: "standard" | "plus"`.
- `router.get('/act/index.ndjson', indexNdjsonHandler)` — Plus, REQUIRED when manifest declares `conformance.level: "plus"`.
- `router.get('/act/search', searchHandler)` — Plus, REQUIRED when manifest declares `conformance.level: "plus"`.

The SDK invokes PRD-500's `createActRuntime(config)` once at router construction and constructs each handler from the resulting `ActRuntimeInstance`. The construction-time validation rules of PRD-500-R10 apply verbatim — mismatch between resolver set and declared level throws synchronously from `actRouter`, before the host's `app.listen()` call.

#### Catch-all `:id(*)` for IDs containing `/`

**PRD-502-R4.** The node and subtree routes MUST use Express's path-to-regexp wildcard form `:id(*)` (or, equivalently, a custom regex segment that admits `/`). Specifically:

- `/act/n/:id(*)` — `req.params.id` becomes the full path-segment string after `/act/n/`, including any embedded `/`. For request `GET /act/n/doc/proj-launch-2026`, `req.params.id` is `"doc/proj-launch-2026"`.
- `/act/sub/:id(*)` — same mechanism.

The single dynamic segment form (`:id`) MUST NOT be used; it would silently truncate to `"doc"` and miss the second segment.

The SDK MUST percent-decode the captured ID per PRD-106-R15 to recover the canonical form. Two requests whose paths decode to the same canonical ID MUST resolve to the same node — the SDK passes the decoded canonical ID as `params.id` (a single string) to `resolveNode` / `resolveSubtree`.

The SDK SHOULD also validate that the decoded ID matches PRD-100-R10's grammar `^[a-z0-9]([a-z0-9._-]|/)*[a-z0-9]$` before invoking the resolver; an invalid ID returns 404 with `error.code: "not_found"` (existence-non-leak — the SDK MUST NOT expose ID-grammar validation as a 400, which would leak that the path matched a route).

#### Request normalization

**PRD-502-R5.** The SDK's adapter MUST convert an Express `Request` to PRD-500's `ActRequest` per PRD-500-R2. Specifically:

- `method` ← `req.method`.
- `url` ← `new URL(req.originalUrl, ${req.protocol}://${req.get('host')})`. The `originalUrl` (NOT `req.url`) is used because Express strips the mount prefix from `req.url` but `originalUrl` preserves it; the SDK needs the full URL for the manifest's effective URL computation. (For routing, the SDK relies on Express's own path matching, which uses the stripped `req.url`.)
- `headers` ← a new `Headers` instance constructed from `req.headers`. The SDK MUST flatten array-valued headers (e.g., `Set-Cookie`) into multiple appends.
- `getCookie(name)` ← reads from `req.cookies?.[name]` (preferred, when `cookie-parser` middleware is registered) OR parses `req.headers.cookie` directly when `req.cookies` is undefined. The SDK ships its own minimal cookie-parsing helper to avoid a dependency on `cookie-parser`.

The SDK MUST NOT mutate the Express `Request` during normalization. The `ActRequest` is a per-request value object and is discarded after dispatch.

#### Identity hook

**PRD-502-R6.** The SDK MUST accept a host-registered `IdentityResolver` of shape `(req: ActRequest) => Promise<Identity>` per PRD-500-R6. The Express host application is responsible for extracting credentials from the `ActRequest` and resolving them to a stable `Identity.key`.

The SDK MUST NOT impose a specific auth library. Worked patterns the SDK documents in implementation notes (non-normative):

- **express-session.** Host reads the session via `actRequest.getCookie("connect.sid")`, validates with the host's session store, and returns `{ kind: "principal", key: session.userId }`.
- **Passport.** Host reads `actRequest.getCookie("connect.sid")` (or whichever Passport uses), validates, returns `{ kind: "principal", key: user.id }`.
- **JWT in `Authorization`.** Host reads `actRequest.headers.get("authorization")`, parses the bearer token, verifies, returns `{ kind: "principal", key: payload.sub }`.
- **Header-based service identity.** Host reads a service-identity header (e.g., `X-Service-Account`), validates, returns `{ kind: "principal", key: serviceAccount.id }`.
- **Anonymous public-tenant.** Host returns `{ kind: "anonymous" }` per PRD-106-R11.

Middleware ordering: the SDK's router MUST be mounted AFTER any auth middleware that populates request-state the `IdentityResolver` depends on. If the host's `IdentityResolver` reads `req.user` (Passport) or `req.session` (express-session), those middlewares MUST run upstream of `actRouter`. If the `IdentityResolver` reads only raw headers / cookies, ordering is irrelevant.

The SDK MUST NOT cache or persist the resolver's return value beyond the request scope; per PRD-500-R5 step 3, every request invokes the resolver fresh.

#### Tenant hook

**PRD-502-R7.** The SDK MUST accept a host-registered `TenantResolver` of shape `(req: ActRequest, identity: Identity) => Promise<Tenant>` per PRD-500-R7. The Express host application derives the tenant via subdomain, path-prefix, or header strategies parallel to PRD-501-R7.

For deployments without tenanting, the host omits `tenantResolver`; the SDK uses `{ kind: "single" }` per PRD-500-R7 default.

The `Tenant.key` MUST be stable per PRD-500-R7 / PRD-100-R15 / PRD-106-R16; the host MUST NOT mint per-request tenant IDs.

#### `basePath` configurability

**PRD-502-R8.** The SDK MUST accept an optional `basePath` configuration parameter on `actRouter(options)` per PRD-500-R26. The default is `""`. When a non-empty `basePath` is supplied, the SDK:

1. Prepends it to every advertised URL in the manifest (`index_url`, `node_url_template`, `subtree_url_template`, `index_ndjson_url`, `search_url_template`).
2. Does NOT modify the router's internal route definitions — Express's `app.use(prefix, router)` already strips the prefix from `req.url` before the router matches, so the router's routes are always relative to the mount point.

The `basePath` MUST match the prefix the host uses in `app.use(prefix, actRouter({ basePath: prefix }))`. Mismatch results in incorrect advertised URLs; the SDK does not validate the relationship at runtime (Express does not expose its mount path to the router during `actRouter` construction), but the test-fixture matrix and implementation notes document the requirement.

#### Manifest serving

**PRD-502-R9.** The manifest handler MUST serve the host-registered `resolveManifest` result per PRD-500-R3, with PRD-502-R8's `basePath` applied to advertised URLs. The SDK MUST honor `delivery: "runtime"` per PRD-501-R9 / PRD-500-R8 / PRD-106-R25, set the `Content-Type: application/act-manifest+json; profile=runtime` per PRD-100-R46, compute and inject `etag` per PRD-103-R6, and apply caching headers per PRD-500-R22.

#### Response wiring

**PRD-502-R10.** The SDK MUST translate PRD-500's `ActResponse` (status, headers, body) into Express's `res` chain. Specifically:

```typescript
res.status(actResponse.status);
actResponse.headers.forEach((value, key) => res.append(key, value));
if (typeof actResponse.body === 'string') {
  res.send(actResponse.body);
} else if (actResponse.body) {
  // NDJSON streaming: write per line, then end.
  res.flushHeaders();  // flush before the stream begins
  for await (const line of actResponse.body) {
    res.write(line);
  }
  res.end();
} else {
  res.end();  // 304 with no body
}
```

The SDK MUST set `Content-Type` via `res.set('Content-Type', ...)` BEFORE `res.send()` to override Express's default `application/json; charset=utf-8`. Express's `res.send()` does not override an explicit `Content-Type` already set on the response — but the SDK's pattern of setting via `actResponse.headers` (which then gets `res.append()`-ed) ensures the right MIME type lands.

For NDJSON streaming, the SDK MUST call `res.flushHeaders()` before the first `res.write()` so intermediaries (CDNs, reverse proxies) see the headers immediately rather than waiting for the full response. Each `res.write(line)` writes one NDJSON line including its trailing `\n`. The final `res.end()` closes the response.

The SDK MUST NOT call `res.json()` (which would stringify-and-set-Content-Type to `application/json`); the body is already a serialized JSON string from PRD-500's `dispatch`.

#### Status-code mapping

**PRD-502-R11.** The SDK MUST honor PRD-500-R15 / R17 / R18's status-code mapping verbatim, transferred to Express's `res.status(...)`. The mapping is identical to PRD-501-R11. The SDK MUST honor PRD-500-R30's bounded `act_version` rejection.

#### ETag / 304 / Cache-Control / Vary

**PRD-502-R12.** The SDK MUST delegate ETag computation, `If-None-Match` matching, 304 responses, `Cache-Control`, and `Vary` to PRD-500-R19 / R20 / R22 verbatim. The Express adapter does not implement these; the headers come from `actResponse.headers` and are set on `res` per PRD-502-R10.

The default `EtagComputer` is PRD-500's `defaultEtagComputer`. A host MAY register a custom `etagComputer` per PRD-500-R21; the override MUST satisfy the determinism rules.

#### Auth challenge wiring

**PRD-502-R13.** When the SDK's dispatch produces a 401 response, the SDK MUST emit one `WWW-Authenticate` HTTP header per advertised scheme in `auth.schemes` order, per PRD-500-R14 / PRD-106-R8 / PRD-109-R5. Express's `res.append('WWW-Authenticate', value)` accepts multiple values for the same header name, satisfying the requirement.

The set of challenges MUST be a function of the manifest, NOT of the request URL. The SDK enforces this by computing the challenges once at `actRouter` construction and reusing them on every 401.

#### Error envelope wiring

**PRD-502-R14.** The SDK MUST delegate error envelope construction to PRD-500-R17. The response body is the JSON string from `actResponse.body`; the `Content-Type` is `application/act-error+json; profile=runtime` per PRD-100-R46.

The existence-non-leak rule (PRD-500-R18 / PRD-109-R3) is honored by construction: both "not found" and "forbidden" branches return identical Express responses (modulo opaque request IDs the SDK MAY echo per PRD-500-R25).

The SDK MUST NOT call `next(err)` to forward to Express's error-handling middleware — the response is already sent, and `next(err)` would either be a no-op (already-sent response) or, worse, attempt to send a duplicate response. The SDK's own catch path inside `dispatch` (PRD-500-R4: thrown exceptions become `{ kind: "internal" }`) handles all error mapping internally.

#### Content negotiation

**PRD-502-R15.** The index handler MUST honor `Accept` per PRD-500-R16. When the request's `Accept` header carries `application/act-index+json; profile=ndjson`, the handler routes to `resolveIndexNdjson` (Plus); otherwise to `resolveIndex`. When `resolveIndexNdjson` is not registered and the client requests the NDJSON variant, the handler returns 406.

The SDK MAY implement the index endpoint and the NDJSON endpoint as separate routes (`/act/index.json` and `/act/index.ndjson`) with distinct paths AND honor `Accept`-based content negotiation on the `/act/index.json` route — both forms are documented in implementation notes.

#### Logger wiring

**PRD-502-R16.** The SDK MUST accept a host-registered `Logger` per PRD-500-R23 / R24. The default Logger is a no-op. Hosts SHOULD wire a real logger:

- **morgan request-line.** Host applies `app.use(morgan('combined'))` BEFORE `actRouter` for HTTP request-line logging; the SDK's `Logger` is for application-level events (identity_resolved, etag_match, etc.) layered on top.
- **pino / winston structured logger.** Host wraps a structured logger with a `Logger` adapter that maps `ActLogEvent` discriminator values to the host's log format.

The SDK MUST NOT pass auth-scoped material to the Logger per PRD-500-R23.

#### Discovery hand-off Link header

**PRD-502-R17.** The SDK MUST emit the discovery hand-off Link header per PRD-106-R23 / PRD-500-R29 on every dispatched response (200 / 304 / 401 / 404 / 429 / 5xx). The header value is:

```
</.well-known/act.json>; rel="act"; type="application/act-manifest+json"; profile="runtime"
```

with the `basePath` prepended if configured.

For non-ACT authenticated responses (the host's HTML routes, app JSON endpoints), the SDK MUST expose a public Express middleware `actLinkHeaderMiddleware(opts)` that the host registers globally:

```typescript
app.use(actLinkHeaderMiddleware({ isAuthenticated: (req) => !!req.session?.userId }));
```

The middleware reads `req`, calls the host-supplied `isAuthenticated` predicate, and conditionally calls `res.append('Link', ...)`. The middleware does NOT enforce auth; auth enforcement is the host's middleware concern.

The middleware helper signature is:

```typescript
export interface ExpressLinkHeaderMiddlewareOptions {
  basePath?: string;
  isAuthenticated: (req: express.Request) => boolean | Promise<boolean>;
}

export function actLinkHeaderMiddleware(
  opts: ExpressLinkHeaderMiddlewareOptions,
): express.RequestHandler;
```

#### Hybrid mount via `app.use`

**PRD-502-R18.** An Express application MAY mount the SDK at any path prefix per PRD-501-R18 / PRD-500-R26. The canonical pattern is:

```typescript
app.use('/app', actRouter({ basePath: '/app', /* ... */ }));
```

The SDK serves the manifest at `/app/.well-known/act.json` and advertises URLs prefixed with `/app`. A parent manifest's `mounts` entry referencing this Express SDK's manifest URL MUST satisfy the same constraints as PRD-501-R18 (matching `prefix`, `delivery: "runtime"`, correct `manifest_url`).

The SDK does not validate the parent manifest; cross-document validation is PRD-600's responsibility.

#### Typed handler signatures

**PRD-502-R19.** The SDK MUST expose its public surface using `@types/express` types for handler signatures, so host applications get IDE autocomplete and type-checking. Specifically:

- `actRouter(options)` returns `express.Router`.
- `createActMiddleware(options, endpoint)` returns `express.RequestHandler`.
- `actLinkHeaderMiddleware(opts)` returns `express.RequestHandler`.
- The internal `IdentityResolver` and `TenantResolver` operate on `ActRequest` per PRD-500-R6 / R7 — NOT on `express.Request` — but the SDK's documented examples show how to extract Express-specific state when needed.

The SDK package MUST declare `@types/express@^4.17.0` (or compatible Express 5 typings) as a peer dependency. Express itself is NOT a hard dependency of the SDK package; hosts install Express directly.

#### Ad-hoc middleware

**PRD-502-R20.** The SDK MUST expose `createActMiddleware(options, endpoint)` returning a single `express.RequestHandler` for one endpoint. This is the lower-level form for hosts that want bespoke routing:

```typescript
app.get('/custom-path/manifest', createActMiddleware(options, 'manifest'));
```

The middleware respects all PRD-500 contract rules (request normalization, identity / tenant resolution, dispatch, response wiring) for its single endpoint. Multiple `createActMiddleware` calls MUST share the same `options` to avoid constructing multiple `ActRuntimeInstance`s — the SDK SHOULD memoize on `options` identity, OR the host SHOULD construct one runtime via PRD-500's `createActRuntime` directly and pass it to each middleware. The implementation note documents the memoization pattern.

`actRouter` is the recommended high-level form; `createActMiddleware` is the escape hatch.

#### Standard

**PRD-502-R21.** When the manifest declares `conformance.level: "standard" | "plus"`, `actRouter` MUST require a registered `resolveSubtree` resolver per PRD-500-R32. The subtree route is registered at `/act/sub/:id(*)` and bounds `depth` to `[0, 8]` per PRD-100-R33. Default depth is `3`.

The handler MUST honor the `?depth=N` query parameter; out-of-range requests return `{ kind: "validation", details: { reason: "depth_out_of_range" } }`.

#### Plus

**PRD-502-R22.** When the manifest declares `conformance.level: "plus"`, `actRouter` MUST require registered `resolveIndexNdjson` and `resolveSearch` resolvers per PRD-500-R33 / R34. The NDJSON route is at `/act/index.ndjson` and streams via `res.write()` per line per PRD-502-R10. The search route is at `/act/search` and reads the query from `?q={query}` (or whichever placeholder the manifest's `search_url_template` declares).

The search response shape is opaque-but-JSON for v0.1 per decision Q13. The SDK serializes the resolver's returned value with `Content-Type: application/json; profile=runtime`.

#### Test fixture conformance

**PRD-502-R23.** The `@act/runtime-express` package MUST pass the test fixture matrix under `fixtures/502/` AND the shared SDK harness under `fixtures/500/` per PRD-500-R31. PRD-600 incorporates both fixture sets into its runtime probe.

### Wire format / interface definition

The contract is a TypeScript interface set extending PRD-500's interfaces. The signatures below are normative per PRD-502-R1.

#### Public types

```typescript
import type { Router, RequestHandler, Request as ExpressRequest, Response as ExpressResponse } from 'express';
import type {
  ActRuntime,
  Identity,
  Tenant,
  IdentityResolver,
  TenantResolver,
  EtagComputer,
  Logger,
  Manifest,
  ActEndpoint,
} from '@act/runtime-core';

// --- Aggregate router factory ---
export interface ActRouterOptions {
  manifest: Manifest;
  runtime: ActRuntime;
  identityResolver: IdentityResolver;
  tenantResolver?: TenantResolver;
  etagComputer?: EtagComputer;
  logger?: Logger;
  basePath?: string;
  anonymousCacheSeconds?: number;
}

export function actRouter(options: ActRouterOptions): Router;

// --- Per-endpoint middleware (lower-level escape hatch) ---
export function createActMiddleware(
  options: ActRouterOptions,
  endpoint: ActEndpoint,
): RequestHandler;

// --- Discovery hand-off middleware (PRD-502-R17) ---
export interface ExpressLinkHeaderMiddlewareOptions {
  basePath?: string;
  isAuthenticated: (req: ExpressRequest) => boolean | Promise<boolean>;
}

export function actLinkHeaderMiddleware(
  opts: ExpressLinkHeaderMiddlewareOptions,
): RequestHandler;
```

#### Recommended host application layout

```typescript
// src/act-mount.ts — central SDK initialization
import { actRouter, actLinkHeaderMiddleware } from '@act/runtime-express';

export function mountAct(app: Express): void {
  app.use(actLinkHeaderMiddleware({
    isAuthenticated: (req) => !!req.session?.userId,
  }));
  app.use('/', actRouter({
    manifest: { /* ... */ },
    runtime: { /* ... */ },
    identityResolver: async (actReq) => { /* ... */ },
    tenantResolver: async (actReq, identity) => { /* ... */ },
  }));
}

// src/server.ts
import express from 'express';
import session from 'express-session';
import { mountAct } from './act-mount';

const app = express();
app.use(session({ secret: process.env.SESSION_SECRET! }));  // upstream of actRouter
mountAct(app);
app.listen(3000);
```

### Errors

The SDK does not introduce new HTTP status codes. The mapping is delegated to PRD-500-R17 / PRD-106-R3–R6 and is identical to PRD-501-R11's table.

Construction-time configuration errors (PRD-500-R10) throw synchronously from `actRouter`, before `app.listen()`. PRD-600 probes both.

---

## Examples

Examples are non-normative but consistent with the Specification.

### Example 1 — Minimum-conformant Core deployment

```typescript
import express from 'express';
import session from 'express-session';
import { actRouter } from '@act/runtime-express';

const app = express();
app.use(session({ secret: process.env.SESSION_SECRET!, resave: false, saveUninitialized: false }));

app.use('/', actRouter({
  manifest: {
    act_version: '0.1',
    site: { name: 'Acme Workspace' },
    delivery: 'runtime',
    conformance: { level: 'core' },
    auth: { schemes: ['cookie', 'bearer'] },
    index_url: '/act/index.json',
    node_url_template: '/act/n/{id}',
  },
  runtime: {
    resolveManifest: async (req, ctx) => ({ kind: 'ok', value: /* manifest */ }),
    resolveIndex: async (req, ctx) => {
      if (ctx.identity.kind !== 'principal') return { kind: 'auth_required' };
      const docs = await db.documents.findMany({ where: { tenantId: ctx.tenant.kind === 'scoped' ? ctx.tenant.key : null } });
      return { kind: 'ok', value: { act_version: '0.1', nodes: docs.map(toIndexEntry) } };
    },
    resolveNode: async (req, ctx, { id }) => {
      if (ctx.identity.kind !== 'principal') return { kind: 'auth_required' };
      const doc = await db.documents.findUnique({ where: { id: id.replace(/^doc\//, ''), tenantId: ctx.tenant.key } });
      if (!doc) return { kind: 'not_found' };  // covers absent and forbidden identically
      return { kind: 'ok', value: toNode(doc) };
    },
  },
  identityResolver: async (actReq) => {
    // express-session: read session cookie, validate.
    const sid = actReq.getCookie('connect.sid');
    if (!sid) return { kind: 'auth_required', reason: 'missing' };
    const session = await sessionStore.get(sid);
    if (!session?.userId) return { kind: 'auth_required', reason: 'invalid' };
    return { kind: 'principal', key: session.userId };  // PRD-103-R6: stable identity key
  },
  tenantResolver: async (actReq, identity) => {
    if (identity.kind !== 'principal') return { kind: 'single' };
    const user = await db.users.findUnique({ where: { id: identity.key } });
    return { kind: 'scoped', key: user!.tenantId };
  },
}));

app.listen(3000);
```

The host writes resolution logic; the SDK handles `act_version` injection, ETag computation, 401 / 404 mapping, the discovery hand-off Link header, and content negotiation.

### Example 2 — Plus deployment with NDJSON streaming and search

```typescript
app.use('/', actRouter({
  manifest: {
    act_version: '0.1',
    site: { name: 'Acme Plus' },
    delivery: 'runtime',
    conformance: { level: 'plus' },
    auth: { schemes: ['bearer', 'oauth2'], oauth2: { /* ... */ } },
    index_url: '/act/index.json',
    index_ndjson_url: '/act/index.ndjson',
    node_url_template: '/act/n/{id}',
    subtree_url_template: '/act/sub/{id}',
    search_url_template: '/act/search?q={query}',
  },
  runtime: {
    resolveManifest: /* ... */,
    resolveIndex: /* ... */,
    resolveNode: /* ... */,
    resolveSubtree: async (req, ctx, { id, depth }) => { /* ... */ },
    resolveIndexNdjson: async (req, ctx) => {
      async function* stream() {
        for await (const doc of db.documents.streamAll({ tenantId: ctx.tenant.key })) {
          yield toIndexEntry(doc);
        }
      }
      return { kind: 'ok', value: stream() };
    },
    resolveSearch: async (req, ctx, { query }) => ({
      kind: 'ok',
      value: await searchEngine.query(query, { tenant: ctx.tenant.key }),
    }),
  },
  identityResolver: /* ... */,
  tenantResolver: /* ... */,
}));
```

The NDJSON streaming uses `res.write()` per line under the hood; nginx / Caddy MUST be configured to disable buffering on `/act/index.ndjson` (documented in implementation notes).

### Example 3 — Hybrid mount via `app.use(prefix, actRouter(...))`

```typescript
// Marketing site at root; Express ACT runtime at /app.
app.use('/app', actRouter({
  manifest: {
    act_version: '0.1',
    site: { name: 'Acme App' },
    delivery: 'runtime',
    conformance: { level: 'standard' },
    auth: { schemes: ['cookie'] },
    index_url: '/act/index.json',
    node_url_template: '/act/n/{id}',
    subtree_url_template: '/act/sub/{id}',
  },
  basePath: '/app',  // PRD-502-R8 / PRD-500-R26
  runtime: { /* ... */ },
  identityResolver: /* ... */,
}));

// Effective served URLs:
//   /app/.well-known/act.json
//   /app/act/index.json
//   /app/act/n/{id}
//   /app/act/sub/{id}
```

A parent manifest at `/.well-known/act.json` (served by a sibling generator) declares the mount per PRD-100-R7 / PRD-106-R17–R22.

### Example 4 — `:id(*)` admits IDs with `/`

```typescript
// router.get('/act/n/:id(*)', nodeHandler) — admitted by Express path-to-regexp.
// Request: GET /act/n/doc/proj-launch-2026
// req.params.id = "doc/proj-launch-2026"
// SDK passes to resolveNode as params.id = "doc/proj-launch-2026"
// (After percent-decoding per PRD-106-R15.)

// The :id form (without (*)) would fail:
// Request: GET /act/n/doc/proj-launch-2026 → no route match → 404
```

### Example 5 — Ad-hoc placement via `createActMiddleware`

```typescript
import { createActMiddleware } from '@act/runtime-express';

const sharedOptions = { /* ActRouterOptions */ };

// Mount the manifest at a custom path
app.get('/custom/well-known/act.json', createActMiddleware(sharedOptions, 'manifest'));

// Mount the index at a different custom path
app.get('/custom/feed', createActMiddleware(sharedOptions, 'index'));

// Mount nodes at a custom path with a catch-all
app.get('/custom/n/:id(*)', createActMiddleware(sharedOptions, 'node'));
```

The escape hatch lets hosts integrate ACT into existing path conventions without using the recommended `actRouter` layout. The SDK memoizes the `ActRuntimeInstance` keyed on `sharedOptions` identity so multiple `createActMiddleware` calls share one runtime.

### Example 6 — 401 with three `WWW-Authenticate` headers

A manifest with `auth.schemes: ["cookie", "bearer", "oauth2"]`. An unauthenticated request to `/act/index.json`:

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/act-error+json; profile=runtime
WWW-Authenticate: Cookie realm="acme.com"
WWW-Authenticate: Bearer realm="acme.com"
WWW-Authenticate: Bearer realm="acme.com", error="invalid_token", scope="act.read", authorization_uri="https://acme.com/oauth/authorize"
Link: </.well-known/act.json>; rel="act"; type="application/act-manifest+json"; profile="runtime"

{"act_version":"0.1","error":{"code":"auth_required","message":"Authentication required to access this resource."}}
```

The set is a function of the manifest, not the request URL (PRD-502-R13 / PRD-106-R8).

---

## Test fixtures

Fixtures live under `fixtures/502/{positive,negative}/` and align with the shared SDK harness under `fixtures/500/`. Each Express-specific fixture exercises an Express framework concern (`:id(*)` routing, middleware ordering, `app.use(prefix, router)` composition, NDJSON streaming with `res.write()`); shared fixtures from `fixtures/500/` cover the framework-neutral contract.

The harness shape: each fixture is a JSON document declaring `(input_request, configured_app, expected_response)`. The harness instantiates `@act/runtime-express` against an in-process Express app via supertest (or equivalent), constructs the request, dispatches, and asserts the response.

### Positive

- `fixtures/502/positive/router-manifest-200.json` → `GET /.well-known/act.json` returns 200 with the manifest envelope, `ETag`, and the discovery hand-off Link header. Satisfies PRD-502-R3, R9, R10, R12, R17.
- `fixtures/502/positive/colon-star-id-with-slash.json` → `GET /act/n/doc/proj-launch-2026` resolves with `req.params.id = "doc/proj-launch-2026"`. Satisfies PRD-502-R4.
- `fixtures/502/positive/colon-star-percent-encoded.json` → `GET /act/n/doc%2Fproj-launch-2026` decodes to the canonical ID and resolves to the same node. Satisfies PRD-502-R4 / PRD-106-R15.
- `fixtures/502/positive/identity-from-express-session.json` → `IdentityResolver` reads session cookie via `actRequest.getCookie('connect.sid')`, validates with the host's session store, returns `{ kind: "principal", key: session.userId }`. Satisfies PRD-502-R6 / PRD-500-R6.
- `fixtures/502/positive/identity-from-jwt-bearer.json` → `IdentityResolver` reads `Authorization: Bearer <jwt>`, verifies, returns `{ kind: "principal", key: payload.sub }`. Satisfies PRD-502-R6.
- `fixtures/502/positive/tenant-from-subdomain.json` → `TenantResolver` extracts tenant from `acme.app.example.com` → `acme`. Satisfies PRD-502-R7.
- `fixtures/502/positive/hybrid-mount-app-use.json` → `app.use('/app', actRouter({ basePath: '/app', ... }))`; well-known URL is `/app/.well-known/act.json`. Satisfies PRD-502-R8 / R18.
- `fixtures/502/positive/middleware-link-header-on-html.json` → `actLinkHeaderMiddleware` augments authenticated HTML response with Link header. Satisfies PRD-502-R17.
- `fixtures/502/positive/standard-subtree-default-depth.json` → `GET /act/sub/doc/parent` returns subtree at default depth 3. Satisfies PRD-502-R21.
- `fixtures/502/positive/plus-ndjson-streaming-write-per-line.json` → `GET /act/index.ndjson` streams via `res.write()` per line; first line received before stream completion. Satisfies PRD-502-R10 / R22.
- `fixtures/502/positive/plus-search-opaque-json.json` → `GET /act/search?q=foo` returns resolver value verbatim with `Content-Type: application/json; profile=runtime`. Satisfies PRD-502-R22 / PRD-500-R34.
- `fixtures/502/positive/ad-hoc-create-act-middleware.json` → `createActMiddleware(options, 'node')` mounted at custom path resolves correctly. Satisfies PRD-502-R20.

### Negative

- `fixtures/502/negative/single-segment-id-truncates.json` → SDK mounted with `:id` (no `(*)`); ID containing `/` doesn't match any route → 404. Validator MUST flag per PRD-502-R4.
- `fixtures/502/negative/identity-uses-session-token-key.json` → `IdentityResolver` returns session cookie value as `Identity.key`; rotates per login, breaking ETag stability. Validator MUST flag per PRD-502-R6 / PRD-500-R6 / PRD-103-R6.
- `fixtures/502/negative/manifest-mismatched-delivery.json` → Host configures `delivery: "static"` on a runtime SDK; `actRouter` MUST throw at construction. Validator MUST flag per PRD-502-R3 / PRD-500-R10 / PRD-106-R25.
- `fixtures/502/negative/level-plus-missing-search.json` → Manifest declares `level: "plus"` but `resolveSearch` is not registered; `actRouter` MUST throw. Validator MUST flag per PRD-502-R3 / PRD-500-R10.
- `fixtures/502/negative/link-header-missing-on-401.json` → 401 response omits the discovery hand-off Link header. Validator MUST flag per PRD-502-R17 / PRD-500-R29.
- `fixtures/502/negative/404-leaks-existence-via-cache-control.json` → 404 for "absent" returns `Cache-Control: public`; 404 for "forbidden" returns `Cache-Control: private`. Validator MUST flag per PRD-502-R14 / PRD-500-R18 / PRD-109-R3.
- `fixtures/502/negative/content-type-overridden-by-res-json.json` → SDK mistakenly calls `res.json()` instead of `res.send()`, overriding Content-Type to `application/json`. Validator MUST flag per PRD-502-R10 / PRD-100-R46.
- `fixtures/502/negative/middleware-ordering-auth-after-act.json` → Host mounts `actRouter` BEFORE auth middleware that populates `req.session`; `IdentityResolver` reads `req.session?.userId` (undefined) and incorrectly returns `auth_required` for an authenticated request. Validator MUST flag per PRD-502-R6.

Each fixture's `_fixture_meta` block names the requirement(s) it satisfies or violates and the expected validator finding.

---

## Versioning & compatibility

Per PRD-108, classify each kind of change to PRD-502.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a new optional field to `ActRouterOptions` with a documented default | MINOR | Per PRD-108-R4(1). |
| Add a new exported helper (e.g., `actSubdomainTenantResolver`) | MINOR | Additive; PRD-108-R4(1). |
| Change the canonical route shape (e.g., move `:id(*)` to `*`) | MAJOR | Routing structure is part of the public API. |
| Change `actRouter`'s return type from `Router` to a custom subclass | MAJOR | Per PRD-108-R5(2). |
| Add a new exported endpoint to the Router (e.g., a future `/act/subscribe`) | MINOR | Per PRD-108-R4(2) — additive endpoint. |
| Tighten `actLinkHeaderMiddleware` from optional to required (auto-applied by `actRouter`) | MAJOR | Tightens host obligation; existing setups break. |
| Change the package layout (e.g., rename `@act/runtime-express` to `@act/express`) | MAJOR | Per PRD-500-R28. |
| Change the discovery hand-off middleware signature | MAJOR | Per PRD-108-R5(2). |
| Bump the minimum Express version requirement (e.g., 4 → 5 with breaking changes) | MAJOR | Peer dependency change; existing installs break. |
| Add a new logger event type | MINOR | Per PRD-500's `ActLogEvent` extension rules. |

### Forward compatibility

Per PRD-108-R7, host applications MUST tolerate unknown optional fields in `ActRouterOptions`. A future MINOR adding a new optional field is ignored by hosts that don't know about it.

The wire surface a Express SDK exposes is owned by PRD-100 / PRD-103 / PRD-106; consumers (agents fetching ACT envelopes) are unaffected by SDK-internal changes.

### Backward compatibility

Within a MAJOR of PRD-502, every MINOR is backward-compatible. Package pinning is staged per PRD-500-R28 / PRD-108-R14 / decision Q5.

---

## Security considerations

Security posture is owned by PRD-109 (Accepted) and inherited through PRD-500. PRD-502 imports the constraints by reference; specific Express-binding points:

- **Existence-non-leak via 404 (T1).** PRD-502-R14 delegates to PRD-500-R18. A common Express anti-pattern is using `res.status(403).send('Forbidden')` for known-private resources and `res.status(404).send('Not Found')` for absent ones; the SDK's `dispatch` produces identical responses for both branches. Negative fixture exercises the rule.
- **Identity-no-leak via ETag (T2).** PRD-502-R12 delegates to PRD-500-R20 / R21. A host using a custom `etagComputer` MUST NOT mix `req.requestId` or `Date.now()` into the input.
- **Cross-tenant cache poisoning (T3).** PRD-502 delegates to PRD-500-R22 — `Vary: Authorization` on identity-scoped responses. A common Express middleware mistake is enabling `etag` on the `res` directly via `app.set('etag', 'strong')` — Express's auto-ETag conflicts with PRD-103's recipe. The SDK MUST prevent this by setting `etag` on `res` directly via `actResponse.headers`, NOT delegating to Express's auto-ETag. The implementation note documents `app.set('etag', false)` as a recommended setting on apps adopting `@act/runtime-express`.
- **PII via free-form error message (T5).** PRD-502-R14 delegates to PRD-500-R17 — fixed messages, no resolver-supplied free-form text. Host resolvers MUST NOT include user input in `details`.
- **Middleware-ordering pitfall.** PRD-502-R6 documents the auth-middleware-before-actRouter requirement when `IdentityResolver` reads `req.session` / `req.user`. Reversed order silently produces `auth_required` for authenticated requests; the SDK does not detect this (Express middleware composition is opaque to runtime introspection).
- **Logger no-PII (T5 reinforcement).** PRD-502-R16 delegates to PRD-500-R23 / R24. Hosts using `morgan('combined')` for HTTP logging produce request-line logs that include the full URL — those logs MUST be sanitized at the morgan level (the SDK doesn't control them); the SDK's own Logger receives only PRD-500-R24 events.
- **Discovery as a feature (T9).** PRD-502-R17 emits the Link header on every dispatched response. Hosts wanting private discovery rely on auth gating the well-known endpoint itself.
- **DoS via unbounded subtree depth (T7).** PRD-502-R21 bounds depth at construction time per PRD-100-R33 / PRD-500-R32.
- **DoS via inflated `act_version` (T7).** PRD-502-R11 delegates to PRD-500-R30 — bounded rejection.
- **Reverse-proxy buffering for NDJSON.** PRD-502-R10's `res.flushHeaders()` plus per-line `res.write()` produces a streaming response, but intermediaries (nginx, Caddy, AWS ALB) may buffer. The implementation note documents the `proxy_buffering off` directive for nginx and equivalent for Caddy.
- **Cross-origin mount trust (T6).** PRD-502-R18 makes the SDK mountable; cross-origin trust is the consumer's job per PRD-109-R21.

The SDK is the security front line for every Express ACT runtime deployment. The contract makes the security-relevant defaults the hard-to-bypass path.

---

## Implementation notes

This section ships canonical TypeScript snippets that the implementation team and consuming host applications use as reference. The snippets are normative as patterns; the exact TypeScript text is illustrative.

### Pattern 1 — `actRouter` factory (PRD-502-R2 / R3 / R10)

```typescript
import { Router, type Request as ExpressRequest, type Response as ExpressResponse } from 'express';
import { createActRuntime, type ActRequest, type ActResponse } from '@act/runtime-core';

export function actRouter(options: ActRouterOptions): Router {
  const router = Router();

  // PRD-500-R10: validate at construction time.
  const runtime = createActRuntime({
    manifest: options.manifest,
    runtime: options.runtime,
    identityResolver: options.identityResolver,
    tenantResolver: options.tenantResolver,
    etagComputer: options.etagComputer,
    logger: options.logger,
    basePath: options.basePath ?? '',
    anonymousCacheSeconds: options.anonymousCacheSeconds ?? 0,
  });

  const dispatch = (endpoint: ActEndpoint) => async (req: ExpressRequest, res: ExpressResponse) => {
    const actRequest = toActRequest(req);  // PRD-502-R5
    const actResponse = await runtime.dispatch(actRequest);
    sendActResponse(res, actResponse);  // PRD-502-R10
  };

  router.get('/.well-known/act.json', dispatch('manifest'));
  router.get('/act/index.json', dispatch('index'));
  router.get('/act/n/:id(*)', dispatch('node'));            // PRD-502-R4
  if (options.runtime.resolveSubtree) {
    router.get('/act/sub/:id(*)', dispatch('subtree'));     // PRD-502-R21
  }
  if (options.runtime.resolveIndexNdjson) {
    router.get('/act/index.ndjson', dispatch('indexNdjson'));  // PRD-502-R22
  }
  if (options.runtime.resolveSearch) {
    router.get('/act/search', dispatch('search'));          // PRD-502-R22
  }

  return router;
}

function sendActResponse(res: ExpressResponse, actResponse: ActResponse): void {
  res.status(actResponse.status);
  actResponse.headers.forEach((value, key) => res.append(key, value));
  if (typeof actResponse.body === 'string') {
    res.send(actResponse.body);  // not res.json() — body is already serialized
  } else if (actResponse.body) {
    res.flushHeaders();
    (async () => {
      for await (const line of actResponse.body!) res.write(line);
      res.end();
    })();
  } else {
    res.end();
  }
}
```

### Pattern 2 — Identity hook with express-session (PRD-502-R6)

```typescript
import type { IdentityResolver } from '@act/runtime-core';

export const identityResolver: IdentityResolver = async (actReq) => {
  const sid = actReq.getCookie('connect.sid');
  if (!sid) return { kind: 'auth_required', reason: 'missing' };
  const session = await sessionStore.get(parseSignedCookie(sid));
  if (!session?.userId) return { kind: 'auth_required', reason: 'invalid' };
  // PRD-103-R6 / PRD-500-R6: stable identity key. session.userId is the user's
  // primary key, NOT the session token (which rotates per login).
  return { kind: 'principal', key: session.userId };
};
```

### Pattern 3 — Hybrid mount via `app.use(prefix, actRouter(...))` (PRD-502-R8 / R18)

```typescript
import express from 'express';
import { actRouter } from '@act/runtime-express';

const app = express();

// Marketing site at root (e.g., served by a static export from PRD-405).
app.use(express.static('public'));

// ACT runtime mounted at /app.
app.use('/app', actRouter({
  manifest: {
    act_version: '0.1',
    site: { name: 'Acme App' },
    delivery: 'runtime',
    conformance: { level: 'standard' },
    auth: { schemes: ['cookie'] },
    index_url: '/act/index.json',
    node_url_template: '/act/n/{id}',
    subtree_url_template: '/act/sub/{id}',
  },
  basePath: '/app',  // MUST match the prefix in app.use
  runtime: { /* ... */ },
  identityResolver,
}));

// Effective URLs: /app/.well-known/act.json, /app/act/index.json, etc.
```

### Pattern 4 — Error-mapping wiring (PRD-502-R13 / R14)

```typescript
// Inside the SDK's dispatch (PRD-500-delegated):
function buildExpressResponseFor401(res: ExpressResponse, manifest: Manifest): void {
  const challenges = buildAuthChallenges(manifest);  // PRD-500-R14
  res.status(401);
  res.set('Content-Type', 'application/act-error+json; profile=runtime');
  res.append('Link', `</.well-known/act.json>; rel="act"; type="application/act-manifest+json"; profile="runtime"`);
  for (const challenge of challenges) {
    res.append('WWW-Authenticate', challenge);  // PRD-502-R13: one per scheme, in order
  }
  res.send(JSON.stringify({
    act_version: '0.1',
    error: { code: 'auth_required', message: 'Authentication required to access this resource.' },
  }));
}
```

### Pattern 5 — Discovery hand-off middleware for non-ACT routes (PRD-502-R17)

```typescript
import express, { type RequestHandler } from 'express';

export function actLinkHeaderMiddleware(opts: ExpressLinkHeaderMiddlewareOptions): RequestHandler {
  const linkValue = `<${(opts.basePath ?? '')}/.well-known/act.json>; rel="act"; type="application/act-manifest+json"; profile="runtime"`;
  return async (req, res, next) => {
    if (await opts.isAuthenticated(req)) {
      res.append('Link', linkValue);
    }
    next();
  };
}

// Usage in the host:
app.use(actLinkHeaderMiddleware({ isAuthenticated: (req) => !!req.session?.userId }));
app.get('/dashboard', /* ... HTML route ... */);  // gets the Link header automatically
```

### Pattern 6 — nginx config for NDJSON streaming

```nginx
location /act/index.ndjson {
    proxy_pass http://localhost:3000;
    proxy_buffering off;          # required for streaming
    proxy_cache off;
    proxy_set_header Connection '';
    proxy_http_version 1.1;
    chunked_transfer_encoding on;
}
```

Without `proxy_buffering off`, nginx buffers the entire response before forwarding, defeating the streaming contract. The SDK can't control this; the host's deployment configuration is the host's responsibility.

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft. Status: In review. Implements PRD-500's runtime SDK contract on Express. Specifies `actRouter(options)` returning an Express `Router`, `createActMiddleware(options, endpoint)` ad-hoc helper, canonical Express routes (`/.well-known/act.json`, `/act/index.json`, `/act/n/:id(*)`, `/act/sub/:id(*)`, `/act/index.ndjson`, `/act/search`), `:id(*)` regex form for IDs containing `/` (PRD-100-R10), identity / tenant hook patterns for express-session / Passport / JWT / header service identity, `basePath` for hybrid mounts via `app.use(prefix, router)` (PRD-100-R7 / PRD-106-R17–R22 / PRD-500-R26), discovery hand-off Link header on every dispatched response + `actLinkHeaderMiddleware` for non-ACT routes (PRD-106-R23 / PRD-500-R29), typed handler signatures via `@types/express`, NDJSON streaming via `res.write()` per line. Cites PRD-500 (parent contract), PRD-100 / PRD-103 / PRD-106 / PRD-107 / PRD-108 / PRD-109. Test fixtures aligned with `fixtures/500/`. No new schemas. Per decision Q3, first-party TS reference impl for v0.1. |
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review. Decisions: (1) no separate `actErrorHandler` four-arg middleware (Q1 no — `dispatch` catches resolver throws internally per PRD-500-R4); (2) no host-supplied `requestNormalizer` (Q2 no — preserves PRD-500-R2 contract; hosts wanting cross-framework normalization use PRD-505); (3) one package supports Express 4 and 5 via internal shim (Q3 no — public surface is identical); (4) no signed-cookie support inside the SDK (Q4 no — `Identity.key` resolution is the host's job, hosts validate signed cookies in `IdentityResolver`). Ratified judgment calls: catch-all `:id(*)` mandatory (R4), `createActMiddleware` ad-hoc helper kept Express-only (not exported in PRD-501/505) to minimize surface area (R20), `basePath` mount mechanism consistent with PRD-500 / PRD-501 / PRD-505 (R8), discovery hand-off Link header on every ACT response + middleware export for non-ACT (R17). No normative requirement text changed; only Open Questions section. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
