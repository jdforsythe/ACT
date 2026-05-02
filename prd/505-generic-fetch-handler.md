# PRD-505 — Generic WHATWG-fetch handler

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

PRD-500 (runtime SDK contract, In review) is deliberately framework-neutral: its `dispatch` pipeline takes an `ActRequest` (a thin TypeScript interface over WHATWG `Request`) and returns an `ActResponse` (status, headers, body). PRD-501 (Next.js, In review) and PRD-502 (Express, In review) wrap that pipeline in framework-idiomatic adapters. Many target hosts, however, are themselves WHATWG-fetch-native: they accept and return WHATWG `Request` / `Response` directly. These include Cloudflare Workers, Deno Deploy, Bun's `Bun.serve`, Vercel Edge Functions, Hono (the popular fetch-native framework), the Service Worker spec, and Node.js when used with `undici` or `node:http` wrapped to `Request`/`Response`. For all of these, a Next.js or Express adapter is overkill — the framework already speaks the protocol PRD-500 normalizes onto. What's missing is a single-function adapter that converts a WHATWG `Request` into PRD-500's `ActRequest`, dispatches, and converts the resulting `ActResponse` back into a WHATWG `Response`.

That adapter is PRD-505. It is the **leanest possible leaf** under PRD-500's contract — no Next.js Route Handler conventions, no Express middleware, no path-to-regexp, no per-framework idioms. The whole adapter is a closure with one externally visible function: `(request: Request) => Response | Promise<Response>`, the canonical WHATWG-fetch handler shape.

PRD-505 is also the reference for normalized request / response handling that PRD-501 and PRD-502 internally reuse. Per PRD-500-R2's risk row, "PRD-505 (WHATWG-fetch) is the reference" for normalization — the Next.js and Express adapters delegate to PRD-505's helpers for `ActRequest` construction, freeing each leaf SDK from re-implementing the boundary. This means PRD-505 is **the smallest possible adapter that satisfies PRD-500**: in a Cloudflare Worker, Deno Deploy module, or Hono application, integrating ACT is one function call and one routing decision per endpoint.

### Goals

1. Lock the integration shape: a single public function `createActFetchHandler(options): (request: Request) => Promise<Response>` that returns a WHATWG-fetch handler.
2. Lock the runtime portability: the handler MUST work on any environment that supplies WHATWG `Request` / `Response` / `Headers` / `URL` / `crypto.subtle` — Cloudflare Workers, Deno Deploy, Bun, Vercel Edge, Hono, Service Worker spec, Node.js with `undici`. No Node-only API dependencies.
3. Lock the routing: the handler internally routes incoming requests to the appropriate ACT endpoint by URL path matching against the manifest's advertised paths (`index_url`, `node_url_template`, `subtree_url_template`, `index_ndjson_url`, `search_url_template`, plus the well-known manifest path). Requests that don't match any ACT endpoint return `null` (or, in a "strict" mode, 404) so the host application can fall through to its own routing.
4. Lock the runtime-specific identity hook examples: how `IdentityResolver` plugs into Cloudflare Workers' `KVNamespace` for token verification, Deno Deploy's `Deno.env` for service identity, Bun's `Bun.password.verify` for credential validation. The hook itself is PRD-500's `IdentityResolver`; PRD-505 adds non-normative worked patterns.
5. Lock the runtime-specific tenancy hook examples: subdomain extraction from `request.url`, header-based tenanting, KV-store tenant lookup. Same shape as PRD-500-R7.
6. Lock the response wiring: how PRD-500's `ActResponse` (a JSON string body OR an `AsyncIterable<string>` for NDJSON) becomes a WHATWG `Response` — including using `ReadableStream.from(asyncIterable)` (or a manual `ReadableStream` constructor) for the streaming case.
7. Lock the simplicity: PRD-505 is intentionally short. Target ~250–350 implementation lines (the SDK's whole codebase, not just the public surface). The PRD itself targets ~300–400 lines.
8. Specify the test-fixture matrix this leaf MUST pass under `fixtures/505/`, aligned with the shared SDK harness under `fixtures/500/`.

### Non-goals

1. **Re-specifying PRD-500's contract.** The resolver shape, identity / tenant types, `Outcome<T>`, `EtagComputer`, `Logger`, `ActRuntime` — all owned by PRD-500.
2. **Re-specifying PRD-100 envelopes, PRD-103 ETag derivation, PRD-106 status codes.** Cited by reference.
3. **Defining a new auth scheme.** The SDK consumes the host's existing auth.
4. **Defining the search response envelope.** Per decision Q13, deferred to v0.2.
5. **Implementing per-target framework wrappers.** PRD-505 is the generic WHATWG-fetch handler; specific frameworks (Hono, Itty, etc.) MAY ship their own thin wrappers around PRD-505 if they want framework-idiomatic packaging, but those wrappers are downstream of this PRD and not first-party for v0.1.
6. **Defining a Node.js-only adapter.** Node.js's `node:http` exposes Node-style `req`/`res`, not WHATWG `Request`/`Response` directly. A host wanting to use PRD-505 from `node:http` MUST convert via `undici`'s utilities or write a small bridging adapter; PRD-505 does not ship that bridge. (Hosts running Node.js with the `node:http` API directly should use PRD-502 or write a similar Node-style adapter.)
7. **Defining bundle-size optimization beyond clean implementation.** The SDK SHOULD be tree-shakeable and small (tens of KB), but micro-optimization for sub-10KB bundles is out of scope.
8. **Streaming / subscriptions.** Per PRD-500 non-goal #6, deferred to v0.2.

### Stakeholders / audience

- **Authors of:** PRD-501 (Next.js — internally reuses PRD-505's normalization helpers), PRD-502 (Express — same), PRD-600 (validator — must probe via `fixtures/505/`), implementation team in Phase 6 (the agent role that builds `@act/runtime-fetch`).
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Different WHATWG-fetch runtimes have subtly different `Request` / `Response` / `crypto.subtle` implementations (e.g., Node.js's `undici` vs Cloudflare Workers vs Deno) | Medium | Medium | PRD-505-R3 mandates the SDK's own code uses only the documented WHATWG-fetch standard surface; no host-specific extensions. The implementation note documents the per-runtime quirks. |
| URL routing in PRD-505 conflicts with the host's routing because both want to handle the same request | Medium | High | PRD-505-R5 makes the handler return `null` for non-matching requests (in the default `passthrough` mode) so the host can chain it before its own router. A `strict` mode returns 404 for non-matches; documented as opt-in. |
| Identity hook running in a constrained environment (e.g., Cloudflare Worker with KV-only access, no synchronous crypto) blocks for too long | Low | Low | The hook is async and the host owns its complexity. The SDK does not impose timing constraints. |
| `ReadableStream.from()` is not yet available in all WHATWG-fetch runtimes (Node.js < 22, Bun, etc.) | Medium | Medium | PRD-505-R8 specifies the SDK uses a manual `new ReadableStream({ start(controller) { ... } })` pattern that is portable across all v0.1 target runtimes. |
| Cookie reading from a `Request` lacks a `request.cookies` API in many runtimes — only `Cookie` header parsing is available | High | Low | PRD-505-R6 specifies the SDK's `getCookie` accessor parses the raw `Cookie` header; ships its own minimal parser. Same approach as PRD-501-R5 / PRD-502-R5. |
| Bundle size in worker / edge environments is sensitive; pulling in heavy JCS / SHA-256 implementations bloats deployments | Low | Low | The SDK uses `crypto.subtle.digest('SHA-256', ...)` (built-in to the runtime) and a minimal hand-rolled JCS canonicalizer; no external dependencies. Bundle target <50KB minified. |

### Open questions

1. ~~Should the handler accept a `routes` configuration to override the default URL paths?~~ **Resolved (2026-05-01): No.** Ratifies tentative answer; codified in PRD-505-R4 ("the manifest is the routing source of truth"). The manifest already declares the URL paths via `index_url`, `node_url_template`, `subtree_url_template`, `index_ndjson_url`, `search_url_template`. A separate `routes` configuration would be redundant and would risk drift between the manifest's advertised URLs and the handler's routing logic — a class of bug the PRD-500 contract is designed to prevent. (Closes Open Question 1.)
2. ~~Should the handler accept a separate `manifest_path` configuration distinct from `/.well-known/act.json`?~~ **Resolved (2026-05-01): Yes.** Ratifies tentative answer; codified in PRD-505-R5 as `options.manifestPath`, default `/.well-known/act.json`. Some deployments must serve the manifest at a non-default path (e.g., behind an `/api/` rewrite rule, or where `/.well-known/` is reserved by another protocol). The manifest path is the only fixed URL not declared inside the manifest itself, so it deserves an explicit override. (Closes Open Question 2.)
3. ~~Should the handler emit an `X-Powered-By: act-runtime-fetch` header?~~ **Resolved (2026-05-01): No.** Ratifies tentative answer. `X-Powered-By` is informational and a security smell — it leaks deployment internals (SDK identity, version) without a corresponding consumer use case. The discovery hand-off Link header (PRD-500-R29) is the documented identification mechanism. (Closes Open Question 3.)
4. ~~Should the SDK ship a Hono-specific wrapper?~~ **Resolved (2026-05-01): No.** Ratifies tentative answer. The Hono integration is one line — `app.all('*', createActFetchHandler(opts))` wrapped to fall through on `null` — and adding a Hono-specific package multiplies the leaf-SDK surface without a behavioral benefit. PRD-505 is the reference for normalization that PRD-501 and PRD-502 reuse internally; Hono and other fetch-native frameworks consume PRD-505 directly. A community wrapper MAY ship later. (Closes Open Question 4.)

### Acceptance criteria

- [ ] Specification opens with a table of parent PRD-500 requirements implemented + 100-series + PRD-103/106/109 requirements implemented (Phase 3 addition per workflow.md).
- [ ] Every normative requirement uses RFC 2119 keywords; ID `PRD-505-R{n}`.
- [ ] Conformance level (Core / Standard / Plus) declared per requirement, citing PRD-107.
- [ ] Implementation notes section present with ~3–5 short TypeScript snippets (handler factory, identity hook example for one runtime, routing pattern, NDJSON streaming).
- [ ] Test fixtures enumerated under `fixtures/505/{positive,negative}/`, aligned with `fixtures/500/`.
- [ ] No new JSON Schemas added under `schemas/505/`.
- [ ] Open questions ≤ 5.
- [ ] Total length ~300–400 lines.
- [ ] Changelog entry dated 2026-05-01 by Jeremy Forsythe.

---

## Context & dependencies

### Depends on

- **PRD-500** (Runtime SDK contract): In review. Full resolver shape, identity / tenancy hooks, `Outcome<T>`, `EtagComputer`, `Logger`, `ActRequest` / `ActResponse`, `dispatch` pipeline.
- **PRD-100** (Wire format): Accepted. Manifest, index, node, subtree, error envelopes.
- **PRD-103** (Caching, ETags): Accepted. ETag derivation invoked through PRD-500's `defaultEtagComputer`.
- **PRD-106** (Runtime delivery profile): Accepted. Endpoint set, status codes, auth, mounts, discovery hand-off, error envelope.
- **PRD-107** (Conformance levels): Accepted.
- **PRD-108** (Versioning policy): Accepted.
- **PRD-109** (Security): Accepted.
- **000-governance**: Accepted.
- External: [WHATWG Fetch](https://fetch.spec.whatwg.org/) (`Request`, `Response`, `Headers`, `URL`); [Web Crypto API `crypto.subtle`](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto); [WHATWG Streams](https://streams.spec.whatwg.org/) (`ReadableStream`); [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174); TypeScript 5.x.

### Blocks

- **PRD-501** (Next.js) — internally reuses PRD-505's normalization helpers per PRD-500-R2's risk row.
- **PRD-502** (Express) — same.
- **PRD-600** (Validator) — incorporates `fixtures/505/` into runtime probe.

### References

- v0.1 draft: §5.13 (Runtime serving). No specific WHATWG-fetch example; PRD-505 establishes the shape.
- `prd/000-decisions-needed.md`: Q3 (TS-only first-party for v0.1 — PRD-505 is in scope), Q4 (Apache-2.0 for code), Q13 (search-body deferred).
- Prior art: Hono's `Hono` class shape (`app.fetch: (req: Request) => Promise<Response>`); itty-router's `Router` shape; Cloudflare Workers' `addEventListener('fetch', ...)` pattern; Deno Deploy's default-export-handler convention. None directly adopted; cited for shape.

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) where requirements are imposed.

### Parent + 100-series requirements implemented

PRD-505 is the leanest possible adapter of PRD-500's contract onto the WHATWG-fetch standard surface. The table below lists every PRD-500 (parent) and 100-series requirement this PRD implements, the WHATWG-fetch mechanism, and the PRD-505 requirement(s) that bind the SDK to the implementation.

| Source requirement | Source PRD | Mechanism (WHATWG Fetch) | PRD-505 requirement |
|---|---|---|---|
| Resolver interface (`ActRuntime`) | PRD-500-R3 | Host registers via `createActFetchHandler({ runtime })` | PRD-505-R2 |
| Request normalization (`ActRequest`) | PRD-500-R2 | The WHATWG `Request` is *already* the normalization target — the adapter is a thin wrapper | PRD-505-R6 |
| Identity / tenant resolvers | PRD-500-R6, R7 | Host registers; runtime-specific patterns documented (Workers KV, Deno env, etc.) | PRD-505-R7 |
| Capability negotiation (construction-time) | PRD-500-R10 | `createActFetchHandler` validates resolver set vs declared `conformance.level` | PRD-505-R2 |
| Endpoint set per level | PRD-106-R1, PRD-500-R3 | URL path matching against manifest-advertised paths | PRD-505-R4, R5 |
| ID with `/` | PRD-100-R10, PRD-106-R14, R15 | Path-prefix match against `node_url_template` placeholder; the suffix after the prefix is the encoded ID; SDK percent-decodes | PRD-505-R5 |
| `act_version` injection | PRD-100-R1, PRD-108-R1, PRD-500-R12 | Delegated to PRD-500's `dispatch` | PRD-505-R8 |
| MIME types per envelope | PRD-100-R46 | Set on the WHATWG `Response`'s `headers` | PRD-505-R8 |
| `delivery: "runtime"` declaration | PRD-106-R25, PRD-500-R8 | SDK injects on `resolveManifest` output | PRD-505-R8 |
| Status code mapping | PRD-106-R3–R6, PRD-500-R15, R17, R18 | Delegated to PRD-500's `dispatch`; the WHATWG `Response` status carries verbatim | PRD-505-R8 |
| `WWW-Authenticate` per scheme on 401 | PRD-106-R8, PRD-500-R14, PRD-109-R5 | SDK invokes `buildAuthChallenges`; appends each via `headers.append('WWW-Authenticate', ...)` | PRD-505-R8 |
| ETag derivation (runtime triple) | PRD-103-R6, PRD-500-R20 | Delegated to `defaultEtagComputer`; uses `crypto.subtle.digest('SHA-256', ...)` | PRD-505-R8 |
| `If-None-Match` → 304 | PRD-103-R8, PRD-106-R3, PRD-500-R19 | Delegated | PRD-505-R8 |
| `Cache-Control` + `Vary` | PRD-103-R9, PRD-106-R12, PRD-500-R22 | Delegated | PRD-505-R8 |
| Existence-non-leak | PRD-106-R6, PRD-109-R3, PRD-500-R18 | Delegated | PRD-505-R8 |
| Error envelope shape | PRD-100-R41–R44, PRD-106-R26, PRD-500-R17 | Delegated | PRD-505-R8 |
| Discovery hand-off Link header | PRD-106-R23, PRD-500-R29 | SDK appends `Link` header on every dispatched response; no separate middleware (the host composes its own routing) | PRD-505-R8 |
| Hybrid mount composability | PRD-100-R7, PRD-106-R17–R22, PRD-500-R26 | `basePath` configurable; advertised URLs reflect the prefix | PRD-505-R3 |
| Bounded `act_version` rejection | PRD-108-R8, PRD-500-R30, PRD-109-R20 | Delegated | PRD-505-R8 |
| Logger no-PII | PRD-109-R14, PRD-500-R23, R24 | Host registers `Logger`; SDK respects redaction | PRD-505-R9 |
| Standard subtree resolver | PRD-100-R32–R36, PRD-500-R32 | Host registers `resolveSubtree`; SDK routes when path matches `subtree_url_template` | PRD-505-R5, R10 |
| Plus NDJSON resolver | PRD-100-R37, PRD-106-R32, PRD-500-R33 | Host registers `resolveIndexNdjson`; SDK serves via `ReadableStream` | PRD-505-R5, R10, R11 |
| Plus search resolver | PRD-100-R39, PRD-106-R33, PRD-500-R34 | Host registers `resolveSearch`; SDK routes when path matches `search_url_template` | PRD-505-R5, R10 |
| Content negotiation (NDJSON profile) | PRD-500-R16 | Delegated; the index handler routes to `resolveIndexNdjson` when `Accept` carries `profile=ndjson` | PRD-505-R8 |

The remainder of this Specification section binds the SDK to these implementations through normative requirements with PRD-505-R{n} IDs.

### Conformance level

Per PRD-107, PRD-505 requirements are banded:

- **Core:** PRD-505-R1 (the contract is normative), R2 (`createActFetchHandler` factory), R3 (`basePath` configurability), R4 (manifest is the routing source of truth), R5 (URL routing rules + non-match passthrough), R6 (request normalization), R7 (identity / tenant hooks per PRD-500), R8 (response wiring delegated to PRD-500), R9 (Logger wiring), R12 (test fixture conformance).
- **Standard:** R10 (subtree resolver routing).
- **Plus:** R11 (NDJSON / search routing + streaming response).

Auth scoping is orthogonal to level (per PRD-107-R4 / PRD-109-R10).

### Normative requirements

#### Meta

**PRD-505-R1.** This PRD's TypeScript signatures in §"Wire format / interface definition" are normative. The `@act/runtime-fetch` package MUST expose a public API structurally compatible with these signatures.

#### Factory shape

**PRD-505-R2.** The SDK MUST expose a single public function `createActFetchHandler(options): ActFetchHandler` where `ActFetchHandler` is `(request: Request) => Promise<Response | null>`. The handler is the entire public surface — no separate per-endpoint factories, no router classes, no aggregate helpers. The host invokes it directly with a WHATWG `Request` and receives a WHATWG `Response` (or `null` if the request did not match any ACT endpoint, per PRD-505-R5's passthrough mode).

`createActFetchHandler` MUST invoke PRD-500's `createActRuntime(config)` once at construction and capture the resulting `ActRuntimeInstance`. The construction-time validation rules of PRD-500-R10 — that the resolver set matches the declared `conformance.level`, that OAuth manifest fields are consistent — apply verbatim and MUST throw synchronously from `createActFetchHandler`.

#### `basePath` configurability

**PRD-505-R3.** The SDK MUST accept an optional `basePath` configuration parameter on `createActFetchHandler(options)` per PRD-500-R26. The default is `""`. When a non-empty `basePath` is supplied:

1. The SDK prepends it to every advertised URL in the manifest (`index_url`, `node_url_template`, etc.).
2. The SDK strips it from incoming `request.url` paths before matching (PRD-505-R5).

Hybrid-mount composability per PRD-100-R7 / PRD-106-R17–R22 / PRD-500-R26 is achieved this way. A parent manifest's `mounts` entry MAY reference the SDK's effective well-known URL.

#### Manifest as routing source

**PRD-505-R4.** The SDK MUST derive its URL routing from the manifest. Specifically, the SDK reads the manifest's path templates at construction time and constructs internal route matchers:

- `manifestPath` (default `/.well-known/act.json`; configurable via `options.manifestPath`).
- `index_url` → exact-match route.
- `node_url_template` → prefix-and-suffix-match route. The `{id}` placeholder is replaced with a suffix capture; everything after the prefix is the (URL-encoded) ID.
- `subtree_url_template` → same shape.
- `index_ndjson_url` → exact-match route (Plus only).
- `search_url_template` → prefix-and-suffix-match route on the `{query}` placeholder (Plus only).

The SDK MUST NOT accept a separate `routes` configuration. The manifest is the single source of truth for URL routing, ensuring the served manifest's advertised URLs match the SDK's actual handling.

#### URL routing and passthrough

**PRD-505-R5.** The handler MUST route incoming requests by URL path matching:

1. Strip `basePath` from `request.url`'s pathname per PRD-505-R3.
2. If the path is `manifestPath`, dispatch to `resolveManifest`.
3. If the path equals `index_url`, dispatch to `resolveIndex` (or `resolveIndexNdjson` per content negotiation, PRD-500-R16).
4. If the path matches `node_url_template`'s prefix, capture the suffix as the (URL-encoded) ID, percent-decode per PRD-106-R15, and dispatch to `resolveNode`.
5. If the path matches `subtree_url_template`'s prefix, same mechanism for `resolveSubtree` (Standard).
6. If the path equals `index_ndjson_url`, dispatch to `resolveIndexNdjson` (Plus).
7. If the path matches `search_url_template`'s prefix, extract the query parameter and dispatch to `resolveSearch` (Plus).

For non-matching requests, the SDK MUST return `null` (the default `passthrough` mode) so the host application can fall through to its own routing. Hosts that want strict ACT-only handling MAY pass `options.mode: "strict"`; in strict mode, non-matching requests return a 404 with `error.code: "not_found"` per PRD-100-R41.

The `null` return value is a deliberate design choice: in WHATWG-fetch hosts (Workers, Deno, Hono), the handler is typically chained — `actHandler(req) ?? hostHandler(req)`. Returning `null` for non-matches enables that pattern without forcing the host to inspect a 404.

The SDK MUST decode percent-encoded IDs consistently per PRD-106-R15. The SDK SHOULD validate decoded IDs against PRD-100-R10's grammar; invalid IDs return 404 (existence-non-leak per PRD-501-R4).

#### Request normalization

**PRD-505-R6.** Because the input is already a WHATWG `Request`, normalization to PRD-500's `ActRequest` is a thin shim:

- `method` ← `request.method`.
- `url` ← `new URL(request.url)`.
- `headers` ← `request.headers` (already a `Headers` instance — passed through).
- `getCookie(name)` ← parses `request.headers.get('cookie')` directly. The SDK ships its own minimal cookie parser (no `cookie-parser` dependency, no `request.cookies` API in WHATWG-fetch).

The SDK MUST NOT mutate the input `Request`. The `ActRequest` is a per-request value object discarded after dispatch.

#### Identity and tenant hooks

**PRD-505-R7.** The SDK MUST accept host-registered `IdentityResolver` and `TenantResolver` per PRD-500-R6 / R7. The hooks operate on `ActRequest` and return `Identity` / `Tenant` per PRD-500's discriminated unions.

The SDK does not impose a runtime-specific shape. Worked patterns (non-normative, in implementation notes):

- **Cloudflare Workers + KV.** `IdentityResolver` reads `Authorization: Bearer <jwt>`, validates with a public key fetched from a `KVNamespace` (cached). Returns `{ kind: "principal", key: payload.sub }`.
- **Deno Deploy + env.** `IdentityResolver` reads a service-identity header (`X-Service-Account`), validates against an allowlist in `Deno.env.get("ALLOWED_SERVICES")`. Returns `{ kind: "principal", key: serviceAccount.id }`.
- **Bun + cookie.** `IdentityResolver` reads a session cookie via `actRequest.getCookie("session")`, validates with `Bun.password.verify` against a stored hash. Returns `{ kind: "principal", key: session.userId }`.
- **Anonymous public-tenant.** Returns `{ kind: "anonymous" }` per PRD-106-R11.

The SDK MUST NOT cache the resolver's return value; per PRD-500-R5 step 3, every request invokes the resolver fresh. The host's resolver implementation is the host's caching boundary.

#### Response wiring

**PRD-505-R8.** The SDK MUST translate PRD-500's `ActResponse` into a WHATWG `Response`:

```typescript
function toResponse(actResponse: ActResponse): Response {
  if (typeof actResponse.body === 'string') {
    return new Response(actResponse.body, {
      status: actResponse.status,
      headers: actResponse.headers,
    });
  }
  if (actResponse.body) {
    // NDJSON streaming via ReadableStream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const line of actResponse.body!) {
            controller.enqueue(new TextEncoder().encode(line));
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });
    return new Response(stream, {
      status: actResponse.status,
      headers: actResponse.headers,
    });
  }
  // 304 / no-body
  return new Response(null, {
    status: actResponse.status,
    headers: actResponse.headers,
  });
}
```

The SDK MUST NOT use `ReadableStream.from(asyncIterable)` because it is not yet uniformly available across v0.1 target runtimes (Node.js < 22, Bun, etc.); the manual `new ReadableStream({ start... })` form is portable.

The SDK delegates everything else (status codes, `WWW-Authenticate` headers, `ETag`, `Cache-Control`, `Vary`, the discovery hand-off `Link` header, error envelope construction, content negotiation) to PRD-500's `dispatch`. The `actResponse.headers` instance carries them all; the SDK simply passes the `Headers` object through to the WHATWG `Response` constructor.

#### Logger wiring

**PRD-505-R9.** The SDK MUST accept a host-registered `Logger` per PRD-500-R23 / R24. The default Logger is a no-op. The SDK MUST NOT pass auth-scoped material to the Logger.

Hosts wanting structured logs in their runtime use the runtime-specific facility:

- **Cloudflare Workers:** `console.log` (Workers' `console` is structured-logged in the Cloudflare dashboard).
- **Deno Deploy:** `console.log` (similarly aggregated by Deploy).
- **Bun / Node.js:** `pino` or any structured logger.

#### Standard

**PRD-505-R10.** When the manifest declares `conformance.level: "standard" | "plus"`, `createActFetchHandler` MUST require a registered `resolveSubtree` resolver per PRD-500-R32. The handler routes requests matching `subtree_url_template`'s prefix to `resolveSubtree`, with `depth` extracted from `?depth=N` query parameter (default 3, bounded `[0, 8]` per PRD-100-R33). Out-of-range requests return `{ kind: "validation", details: { reason: "depth_out_of_range" } }`.

#### Plus

**PRD-505-R11.** When the manifest declares `conformance.level: "plus"`, `createActFetchHandler` MUST require registered `resolveIndexNdjson` and `resolveSearch` resolvers per PRD-500-R33 / R34. The NDJSON response is a streaming WHATWG `Response` per PRD-505-R8. The search response is a `Response` whose body is the resolver's value verbatim, with `Content-Type: application/json; profile=runtime` (opaque-but-JSON per Q13).

#### Test fixture conformance

**PRD-505-R12.** The `@act/runtime-fetch` package MUST pass the test fixture matrix under `fixtures/505/` AND the shared SDK harness under `fixtures/500/` per PRD-500-R31. PRD-600 incorporates both fixture sets into its runtime probe.

### Wire format / interface definition

The contract is a TypeScript interface set extending PRD-500's interfaces. The signatures below are normative per PRD-505-R1.

#### Public types

```typescript
import type {
  ActRuntime,
  IdentityResolver,
  TenantResolver,
  EtagComputer,
  Logger,
  Manifest,
} from '@act/runtime-core';

export interface CreateActFetchHandlerOptions {
  manifest: Manifest;
  runtime: ActRuntime;
  identityResolver: IdentityResolver;
  tenantResolver?: TenantResolver;
  etagComputer?: EtagComputer;
  logger?: Logger;
  basePath?: string;
  manifestPath?: string;          // default '/.well-known/act.json'
  anonymousCacheSeconds?: number;
  mode?: 'passthrough' | 'strict'; // default 'passthrough'
}

export type ActFetchHandler = (request: Request) => Promise<Response | null>;

export function createActFetchHandler(
  options: CreateActFetchHandlerOptions,
): ActFetchHandler;
```

In `passthrough` mode (default), non-matching requests return `null` so the host can chain. In `strict` mode, non-matching requests return a 404 with the ACT error envelope.

### Errors

The SDK does not introduce new HTTP status codes. The mapping is delegated to PRD-500-R17 / PRD-106-R3–R6 and is identical to PRD-501-R11's table.

Construction-time configuration errors (PRD-500-R10) throw synchronously from `createActFetchHandler`.

---

## Examples

Examples are non-normative but consistent with the Specification.

### Example 1 — Cloudflare Worker (Core)

```typescript
import { createActFetchHandler } from '@act/runtime-fetch';

interface Env {
  AUTH_KEYS: KVNamespace;
  DB: D1Database;
}

const actHandler = createActFetchHandler({
  manifest: {
    act_version: '0.1',
    site: { name: 'Acme Workspace' },
    delivery: 'runtime',
    conformance: { level: 'core' },
    auth: { schemes: ['bearer'] },
    index_url: '/act/index.json',
    node_url_template: '/act/n/{id}',
  },
  runtime: {
    resolveManifest: async (req, ctx) => ({ kind: 'ok', value: /* manifest */ }),
    resolveIndex: async (req, ctx) => {
      if (ctx.identity.kind !== 'principal') return { kind: 'auth_required' };
      const docs = await env.DB.prepare('SELECT * FROM docs WHERE tenant = ?').bind(ctx.tenant.key).all();
      return { kind: 'ok', value: { act_version: '0.1', nodes: docs.results.map(toIndexEntry) } };
    },
    resolveNode: async (req, ctx, { id }) => {
      if (ctx.identity.kind !== 'principal') return { kind: 'auth_required' };
      const doc = await env.DB.prepare('SELECT * FROM docs WHERE id = ? AND tenant = ?').bind(id, ctx.tenant.key).first();
      if (!doc) return { kind: 'not_found' };  // covers absent and forbidden
      return { kind: 'ok', value: toNode(doc) };
    },
  },
  identityResolver: async (actReq) => {
    const auth = actReq.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) return { kind: 'auth_required', reason: 'missing' };
    const token = auth.slice(7);
    const publicKey = await env.AUTH_KEYS.get('jwt-public-key');
    const claims = await verifyJwt(token, publicKey);
    if (!claims) return { kind: 'auth_required', reason: 'invalid' };
    return { kind: 'principal', key: claims.sub };  // PRD-103-R6: stable identity key
  },
  tenantResolver: async (actReq, identity) => {
    if (identity.kind !== 'principal') return { kind: 'single' };
    return { kind: 'scoped', key: extractTenantFromToken(identity.key) };
  },
});

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const actResponse = await actHandler(request);
    if (actResponse) return actResponse;
    // Fall through to other handlers (HTML pages, app API, etc.)
    return new Response('Not Found', { status: 404 });
  },
};
```

### Example 2 — Hono integration (Plus)

```typescript
import { Hono } from 'hono';
import { createActFetchHandler } from '@act/runtime-fetch';

const actHandler = createActFetchHandler({
  manifest: {
    act_version: '0.1',
    site: { name: 'Acme Plus' },
    delivery: 'runtime',
    conformance: { level: 'plus' },
    auth: { schemes: ['bearer'] },
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
    resolveSubtree: /* ... */,
    resolveIndexNdjson: async (req, ctx) => {
      async function* stream() {
        for await (const doc of streamDocs(ctx.tenant.key)) yield toIndexEntry(doc);
      }
      return { kind: 'ok', value: stream() };
    },
    resolveSearch: async (req, ctx, { query }) => ({
      kind: 'ok',
      value: await search(query, ctx.tenant.key),
    }),
  },
  identityResolver: /* ... */,
  tenantResolver: /* ... */,
});

const app = new Hono();
app.use('*', async (c, next) => {
  const actResponse = await actHandler(c.req.raw);
  if (actResponse) return actResponse;
  await next();
});
app.get('/', (c) => c.html('<h1>Acme</h1>'));

export default app;
```

### Example 3 — Deno Deploy (Standard)

```typescript
import { createActFetchHandler } from '@act/runtime-fetch';

const actHandler = createActFetchHandler({
  manifest: {
    act_version: '0.1',
    site: { name: 'Acme Docs' },
    delivery: 'runtime',
    conformance: { level: 'standard' },
    index_url: '/act/index.json',
    node_url_template: '/act/n/{id}',
    subtree_url_template: '/act/sub/{id}',
  },
  runtime: { /* ... */ },
  identityResolver: async (actReq) => {
    const serviceId = actReq.headers.get('x-service-account');
    if (!serviceId) return { kind: 'anonymous' };  // public access
    const allowed = (Deno.env.get('ALLOWED_SERVICES') ?? '').split(',');
    if (!allowed.includes(serviceId)) return { kind: 'auth_required', reason: 'invalid' };
    return { kind: 'principal', key: serviceId };
  },
});

Deno.serve(async (request) => {
  const actResponse = await actHandler(request);
  return actResponse ?? new Response('Not Found', { status: 404 });
});
```

### Example 4 — Hybrid mount with `basePath`

```typescript
const actHandler = createActFetchHandler({
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
  basePath: '/app',  // PRD-505-R3 / PRD-500-R26
  runtime: { /* ... */ },
  identityResolver: /* ... */,
});

// Effective served URLs:
//   /app/.well-known/act.json
//   /app/act/index.json
//   /app/act/n/{id}
//   /app/act/sub/{id}
```

A parent manifest at `/.well-known/act.json` (served by a sibling generator or a separate static site) declares the mount per PRD-100-R7 / PRD-106-R17–R22.

---

## Test fixtures

Fixtures live under `fixtures/505/{positive,negative}/` and align with the shared SDK harness under `fixtures/500/`. Each fixture is a JSON document declaring `(input_request, configured_handler, expected_response)`. The harness instantiates `@act/runtime-fetch`, constructs a WHATWG `Request`, invokes the handler, and asserts the resulting `Response` matches expectations.

### Positive

- `fixtures/505/positive/manifest-200.json` → `GET /.well-known/act.json` returns 200 with manifest envelope, `ETag`, discovery Link header. Satisfies PRD-505-R2, R5, R8.
- `fixtures/505/positive/node-id-with-slash.json` → `GET /act/n/doc/proj-launch-2026` decodes to `id = "doc/proj-launch-2026"` and resolves. Satisfies PRD-505-R5 / PRD-106-R15.
- `fixtures/505/positive/passthrough-non-match.json` → `GET /api/some-other-route` returns `null` (passthrough mode). Satisfies PRD-505-R5.
- `fixtures/505/positive/strict-non-match-404.json` → `GET /api/some-other-route` with `mode: "strict"` returns 404 with `error.code: "not_found"`. Satisfies PRD-505-R5.
- `fixtures/505/positive/hybrid-mount-basepath.json` → handler with `basePath: "/app"`; well-known URL is `/app/.well-known/act.json`. Satisfies PRD-505-R3.
- `fixtures/505/positive/identity-from-bearer.json` → `IdentityResolver` reads `Authorization: Bearer <jwt>`, returns `{ kind: "principal", key: claims.sub }`. Satisfies PRD-505-R7 / PRD-500-R6.
- `fixtures/505/positive/standard-subtree-default-depth.json` → `GET /act/sub/doc/parent` returns subtree at default depth 3. Satisfies PRD-505-R10.
- `fixtures/505/positive/plus-ndjson-readable-stream.json` → `GET /act/index.ndjson` returns a `ReadableStream`-bodied `Response`; consumer reads line-by-line. Satisfies PRD-505-R8 / R11.
- `fixtures/505/positive/plus-search-opaque-json.json` → `GET /act/search?q=foo` returns resolver value verbatim. Satisfies PRD-505-R11 / PRD-500-R34.
- `fixtures/505/positive/cross-runtime-cf-deno-bun.json` → handler exercises `crypto.subtle.digest('SHA-256', ...)` and the manual `ReadableStream` constructor; runs identically across Cloudflare Workers, Deno, Bun simulated runtimes. Satisfies PRD-505-R6, R8.

### Negative

- `fixtures/505/negative/manifest-mismatched-delivery.json` → host configures `delivery: "static"`; `createActFetchHandler` MUST throw at construction. Validator MUST flag per PRD-505-R2 / PRD-500-R10 / PRD-106-R25.
- `fixtures/505/negative/level-plus-missing-search.json` → manifest declares `level: "plus"` but `resolveSearch` is not registered; construction MUST throw. Validator MUST flag per PRD-505-R2 / PRD-500-R10.
- `fixtures/505/negative/identity-uses-jwt-as-key.json` → `IdentityResolver` returns the raw JWT as `Identity.key` (rotates per re-issuance, breaking ETag stability). Validator MUST flag per PRD-505-R7 / PRD-500-R6 / PRD-103-R6.
- `fixtures/505/negative/link-header-missing-on-401.json` → 401 omits the discovery hand-off Link header. Validator MUST flag per PRD-505-R8 / PRD-500-R29.
- `fixtures/505/negative/404-leaks-existence-via-headers.json` → 404 for "absent" and 404 for "forbidden" carry different cache headers. Validator MUST flag per PRD-505-R8 / PRD-500-R18 / PRD-109-R3.
- `fixtures/505/negative/single-segment-id-routing.json` → handler implementation fails to match path suffix when ID contains `/` (e.g., uses `pathname.split('/').pop()` instead of full prefix-stripping). Validator MUST flag per PRD-505-R5 / PRD-100-R10.

Each fixture's `_fixture_meta` block names the requirement(s) it satisfies or violates and the expected validator finding.

---

## Versioning & compatibility

Per PRD-108, classify each kind of change to PRD-505.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a new optional field to `CreateActFetchHandlerOptions` | MINOR | Per PRD-108-R4(1). |
| Add a new value to the `mode` enum (e.g., `"strict-and-log"`) | MAJOR | The enum is closed; PRD-108-R5(4). |
| Change the handler's return type (e.g., return `Response` instead of `Response | null`) | MAJOR | Per PRD-108-R5(2). The passthrough contract is part of the public surface. |
| Add a new optional helper export | MINOR | Additive. |
| Change `manifestPath` default | MAJOR | Default behavior change; existing deployments break. |
| Tighten passthrough `null` to always-404 | MAJOR | Breaks chained-handler patterns. |
| Add Bun-specific or Deno-specific configuration fields | MAJOR (if required) / MINOR (if optional) | Per PRD-108-R4 / R5. |
| Bump the minimum WHATWG-fetch surface (e.g., require `ReadableStream.from()`) | MAJOR | Excludes Node.js < 22 and other runtimes; breaks deployments. |
| Change the package layout (rename `@act/runtime-fetch`) | MAJOR | Per PRD-500-R28. |

### Forward compatibility

Per PRD-108-R7, host applications MUST tolerate unknown optional fields in `CreateActFetchHandlerOptions`. The wire surface is owned by PRD-100 / PRD-103 / PRD-106; consumers (agents) are unaffected by SDK-internal changes.

### Backward compatibility

Within a MAJOR of PRD-505, every MINOR is backward-compatible. Package pinning is staged per PRD-500-R28 / PRD-108-R14 / decision Q5.

---

## Security considerations

Security posture is owned by PRD-109 (Accepted) and inherited through PRD-500. PRD-505 imports the constraints by reference; specific WHATWG-fetch-binding points:

- **Existence-non-leak via 404 (T1).** PRD-505-R8 delegates to PRD-500-R18. Both "absent" and "forbidden" branches return byte-identical `Response` objects. In `strict` mode, non-matching ACT routes also return 404 — and they MUST use the same body / headers as the in-band 404 to avoid distinguishing "outside ACT" from "inside ACT but invisible."
- **Identity-no-leak via ETag (T2).** PRD-505-R8 delegates to PRD-500-R20 / R21 / PRD-103-R6. The default `EtagComputer` uses `crypto.subtle.digest('SHA-256', ...)` — deterministic, cryptographically opaque.
- **Cross-tenant cache poisoning (T3).** PRD-505-R8 delegates to PRD-500-R22. CDNs in front of WHATWG-fetch hosts (Cloudflare, Vercel Edge) must respect `Vary: Authorization`; the SDK emits the header but cannot enforce upstream behavior. Hosts deploying behind a CDN MUST verify their CDN's Vary handling.
- **PII via free-form error message (T5).** PRD-505-R8 delegates to PRD-500-R17.
- **Logger no-PII (T5 reinforcement).** PRD-505-R9 delegates to PRD-500-R23 / R24. Cloudflare Workers' `console.log` writes to the dashboard; Deno Deploy's writes to its log aggregation. Hosts MUST NOT subscribe to a logger that bypasses PRD-500's redaction.
- **Discovery as a feature (T9).** PRD-505-R8 emits the discovery Link header on every dispatched response. Hosts wanting private discovery rely on auth gating the well-known endpoint itself.
- **DoS via inflated `act_version` (T7).** PRD-505-R8 delegates to PRD-500-R30 — bounded rejection.
- **DoS via unbounded subtree depth (T7).** PRD-505-R10 bounds depth at construction time.
- **Cross-origin mount trust (T6).** PRD-505-R3's `basePath` makes the SDK mountable; cross-origin trust is the consumer's job per PRD-109-R21.
- **Web Crypto availability.** All v0.1 target runtimes (Cloudflare Workers, Deno Deploy, Bun, Vercel Edge, Hono on Workers, Service Workers, Node.js with `undici`) provide `crypto.subtle`. Hosts deploying on older Node.js (< 18) MUST use `--experimental-global-webcrypto` or fall back to PRD-502 (Express).

The SDK is the security front line for every WHATWG-fetch ACT runtime deployment. Its small surface area (one factory, one returned function) means there are few places a host can introduce drift; the contract makes the security-relevant defaults the hard-to-bypass path.

---

## Implementation notes

This section ships canonical TypeScript snippets. The snippets are normative as patterns; the exact text is illustrative.

### Pattern 1 — `createActFetchHandler` factory (PRD-505-R2, R5, R8)

```typescript
import { createActRuntime, type ActRequest, type ActResponse } from '@act/runtime-core';

export function createActFetchHandler(options: CreateActFetchHandlerOptions): ActFetchHandler {
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

  const manifestPath = (options.basePath ?? '') + (options.manifestPath ?? '/.well-known/act.json');
  const indexPath = (options.basePath ?? '') + options.manifest.index_url!;
  const nodePrefix = (options.basePath ?? '') + options.manifest.node_url_template!.replace('{id}', '');
  // ... similar for subtree, ndjson, search

  return async (request: Request): Promise<Response | null> => {
    const url = new URL(request.url);
    const path = url.pathname;

    let endpoint: ActEndpoint | null = null;
    let id: string | null = null;
    if (path === manifestPath) endpoint = 'manifest';
    else if (path === indexPath) endpoint = 'index';
    else if (path.startsWith(nodePrefix)) {
      endpoint = 'node';
      id = decodeURIComponent(path.slice(nodePrefix.length));
    } // ...

    if (!endpoint) {
      if (options.mode === 'strict') {
        return notFoundResponse();
      }
      return null;  // PRD-505-R5: passthrough
    }

    const actRequest: ActRequest = {
      method: request.method as ActRequest['method'],
      url,
      headers: request.headers,
      getCookie: (name) => parseCookieHeader(request.headers.get('cookie'), name),
    };

    const actResponse = await runtime.dispatch(actRequest);
    return toWhatwgResponse(actResponse);  // PRD-505-R8
  };
}
```

### Pattern 2 — Cookie parser (no external dep) (PRD-505-R6)

```typescript
function parseCookieHeader(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  const cookies = header.split(';');
  for (const c of cookies) {
    const [k, ...v] = c.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}
```

### Pattern 3 — NDJSON streaming (PRD-505-R8, R11)

```typescript
function toReadableStream(asyncIter: AsyncIterable<string>): ReadableStream {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const line of asyncIter) {
          controller.enqueue(encoder.encode(line));
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });
}
```

### Pattern 4 — Cloudflare Worker integration (PRD-505-R7)

```typescript
import { createActFetchHandler } from '@act/runtime-fetch';

const actHandler = createActFetchHandler({
  manifest: { /* ... */ },
  runtime: { /* ... */ },
  identityResolver: async (actReq) => {
    const auth = actReq.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) return { kind: 'auth_required', reason: 'missing' };
    const claims = await verifyJwt(auth.slice(7), env.AUTH_KEYS);
    return claims ? { kind: 'principal', key: claims.sub } : { kind: 'auth_required', reason: 'invalid' };
  },
});

export default {
  fetch: async (req: Request) => (await actHandler(req)) ?? new Response('Not Found', { status: 404 }),
};
```

### Pattern 5 — Hono integration via middleware

```typescript
import { Hono } from 'hono';
const app = new Hono();
app.use('*', async (c, next) => {
  const r = await actHandler(c.req.raw);
  if (r) return r;
  await next();
});
```

The handler chains naturally — `null` falls through, a `Response` short-circuits.

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft. Status: In review. Implements PRD-500's runtime SDK contract as the leanest possible WHATWG-fetch handler. Specifies `createActFetchHandler(options): (request: Request) => Promise<Response | null>` — single-function adapter that runs anywhere supporting the WHATWG Fetch API: Cloudflare Workers, Deno Deploy, Bun, Vercel Edge, Hono, Service Workers, Node.js with undici. Manifest is the routing source of truth (PRD-505-R4); URL routing matches manifest-advertised paths. Passthrough mode (`null` for non-matches) enables host-chained handlers; strict mode returns 404. NDJSON streaming via portable `new ReadableStream({ start... })` pattern. Runtime-specific identity hook examples for Workers KV, Deno env, Bun. Lower surface area than PRD-501 / PRD-502 — implementation target ~250–350 lines. Cites PRD-500 (parent contract), PRD-100 / PRD-103 / PRD-106 / PRD-107 / PRD-108 / PRD-109. Test fixtures aligned with `fixtures/500/`. No new schemas. Per decision Q3, first-party TS reference impl for v0.1. |
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review. Decisions: (1) no `routes` configuration override — manifest is routing source of truth (Q1 no, codified in PRD-505-R4); (2) `manifestPath` configurable, default `/.well-known/act.json` (Q2 yes, codified in PRD-505-R5); (3) no `X-Powered-By` header (Q3 no — info-leak smell; discovery Link header is the identification mechanism); (4) no Hono-specific wrapper (Q4 no — one-line integration; PRD-505 is the reference fetch handler that PRD-501/502 reuse internally). Ratified judgment calls: PRD-505 serves as the reference for normalization that PRD-501 / PRD-502 reuse as a shared internal helper per PRD-500-R2; no separate middleware export (single function suffices); `Response \| null` passthrough mode default with opt-in `strict` for 404, matching Workers/Deno/Hono chained-handler pattern; `basePath` consistent with PRD-500 / PRD-501 / PRD-502; catch-all routing for IDs containing `/` mandatory. No normative requirement text changed; only Open Questions section. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
