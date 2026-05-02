# PRD-501 — Next.js runtime SDK

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

PRD-500 (runtime SDK contract, In review) pins the framework-neutral `ActRuntime` resolver shape, the identity / tenancy hooks, the capability-negotiation rules, the ETag / 304 behavior, and the auth / error mapping that every leaf SDK MUST implement. PRD-500 deliberately stops short of the framework-specific glue: it does not say where a Next.js App Router Route Handler lives, how to translate a Next.js `Request` into PRD-500's `ActRequest`, how to mount the well-known manifest at `/.well-known/act.json` so the App Router serves it, or how to handle catch-all `[...id]` segments so an ID like `doc/proj-launch-2026` (containing a `/`) reaches `resolveNode` correctly. PRD-501 is that glue. It is the **first-party TypeScript reference SDK** for Next.js per decision Q3 (TS-only first-party). It is the SDK PRD-705 (B2B SaaS workspace) and PRD-706 (hybrid static + runtime + MCP bridge) consume directly, and it is the most important leaf in the 50x series for v0.1 because every named B2B SaaS partner candidate (Linear, Notion, etc.) is on Next.js.

The leaf SDK is intentionally thin. Per PRD-500-R1 / R11, a leaf adapter is glue between framework-native requests and the SDK's `dispatch` pipeline. PRD-501's normative job is to specify (a) where the host application mounts handlers in the Next.js App Router, (b) how Next.js's `Request` becomes PRD-500's `ActRequest`, (c) how Next.js's response primitives carry PRD-500's `ActResponse`, (d) how the SDK plugs into Next.js's identity, caching, and middleware idioms without leaking framework state into the resolver layer. Everything below is plumbing for PRD-500's contract; the contract itself is unchanged.

### Goals

1. Lock the Next.js integration shape: a `createActHandler(options)` factory that returns App Router-compatible Route Handlers (one per ACT endpoint), plus an aggregate `defineActMount(options)` helper that lets a host application configure one ACT runtime instance and bind it to all the per-endpoint handlers in a single declaration.
2. Lock the canonical mount paths in the App Router file tree (`app/.well-known/act.json/route.ts`, `app/act/index.json/route.ts`, `app/act/n/[...id]/route.ts`, `app/act/sub/[...id]/route.ts`, `app/act/index.ndjson/route.ts`, `app/act/search/route.ts`) and codify the catch-all `[...id]` requirement so IDs containing `/` (per PRD-100-R10) reach the resolver intact.
3. Lock the Pages Router fallback as a documented escape hatch (`pages/api/act/*` files invoking the same `createActHandler`), without making it a Core requirement — App Router is the v0.1 default.
4. Lock the identity hook shape: a Next.js-specific `IdentityResolver` that takes a Next.js `Request` and resolves to PRD-500's `Identity` discriminated union, with worked patterns for NextAuth session cookies, JWT-in-`Authorization`, and header-based service identity.
5. Lock the tenancy hook shape: a `TenantResolver` that derives tenant from subdomain, path prefix, or arbitrary header, with the host configuring which strategy applies.
6. Lock the caching wiring: the SDK uses Next.js's standard `Response` with `ETag` / `Cache-Control` / `Vary` headers; the SDK delegates ETag computation to PRD-500's `defaultEtagComputer` (which is PRD-103's recipe). The host MAY override via PRD-500's `EtagComputer` but the override MUST satisfy PRD-500-R21.
7. Lock the auth-and-error mapping: 401 with one `WWW-Authenticate` per advertised scheme (PRD-500-R14 helper), 404 covering both genuinely-absent and forbidden (PRD-500-R18), 429 with `Retry-After`, 5xx with bounded `details` per PRD-500-R17 / PRD-109-R14 / R15.
8. Lock hybrid-mount composability: an SDK instance MAY be mounted at any path prefix via PRD-500-R26's `basePath`, and a `defineActMount({ basePath, ... })` helper exposes that for hybrid sites (PRD-100-R7 / PRD-106-R17–R22).
9. Lock the structured-logger wiring: a `Logger` interface that hosts wire to either Next.js's logging (e.g., `console` in dev, structured in prod) or any provider; PRD-500-R23 / R24's no-PII shape applies verbatim.
10. Lock the conformance bands: Core / Standard / Plus achievable with the documented framework defaults; Plus achievable when the host registers `resolveIndexNdjson` and `resolveSearch` (PRD-500-R33 / R34).
11. Explicitly defer streaming, server-sent events, and subscription endpoints per PRD-106 non-goal #7 / PRD-500 non-goal #6. Future MINOR.
12. Specify the test-fixture matrix this leaf SDK MUST pass under `fixtures/501/` and align it with PRD-500's harness fixtures under `fixtures/500/` so the validator (PRD-600) probes both shared and Next.js-specific positives and negatives.

### Non-goals

1. **Re-specifying PRD-500's contract.** The resolver shape, the `Outcome<T>` discriminator, the identity / tenant types, the `EtagComputer` signature, the `Logger` shape, and the `ActRuntime` interface are all owned by PRD-500. PRD-501 maps them onto Next.js without redefinition.
2. **Re-specifying PRD-100 envelope shapes or PRD-103 ETag derivation or PRD-106 status-code semantics.** PRD-501 cites those by reference.
3. **Defining a new auth scheme.** The SDK consumes the host's existing auth (NextAuth, custom JWT, mTLS at the edge, etc.). PRD-501 does not authenticate.
4. **Defining the search response envelope.** Per decision Q13, the search-body envelope is deferred to v0.2; `resolveSearch` returns opaque-but-JSON data per PRD-500-R34. PRD-501 inherits.
5. **Defining MCP-bridge integration.** PRD-602 is the coexistence neighbor for MCP; a Next.js app MAY expose both an ACT runtime and an MCP server, but PRD-501 imposes no constraint on how they coexist beyond mountability.
6. **Defining static-export behavior.** PRD-405 (Next.js static-export plugin) is the static-side counterpart and ships with the 400-series. PRD-501 is runtime-only.
7. **Defining a Next.js Edge Runtime variant.** The handlers in PRD-501 work on both the Node.js runtime and the Edge Runtime as long as the host's `IdentityResolver` and resolver bodies stay within the Edge Runtime's API surface. PRD-501 does not require either runtime; the host opts in via Next.js's standard `export const runtime = "edge"` declaration.
8. **Pages Router as a first-class target.** Pages Router is supported as a documented escape hatch (PRD-501-R20) but is not the recommended path. App Router is the v0.1 reference target.
9. **Defining the React Server Component integration.** ACT runtime endpoints are Route Handlers (server-side, no React rendering); they are unrelated to the RSC tree. The host application's RSC pages MAY embed the discovery hand-off Link header on authenticated HTML responses (PRD-106-R23 / PRD-501-R17), but that is a middleware-level concern documented in implementation notes.

### Stakeholders / audience

- **Authors of:** PRD-705 (B2B SaaS workspace example, primary consumer), PRD-706 (hybrid static + runtime + MCP bridge example, secondary consumer), PRD-600 (validator — must probe Next.js-specific behavior using the harness shared with `fixtures/500/`), implementation team in Phase 6 (the agent role that builds `@act/runtime-next`).
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Next.js App Router conflates the well-known path's segment with a route segment, breaking mounting at `/.well-known/act.json` | Medium | High | PRD-501-R3 specifies the file path `app/.well-known/act.json/route.ts` (Next.js treats path segments containing `.` as route names verbatim — verified across Next.js 14 and 15). The implementation note shows the canonical layout. |
| ID containing `/` (e.g., `doc/proj-launch-2026`) is split by the App Router into a single dynamic segment, dropping the second half | High if `[id]` is used | High | PRD-501-R4 mandates the catch-all `[...id]` segment for node and subtree handlers. The SDK joins the catch-all array back into a canonical ID before invoking `resolveNode` / `resolveSubtree`. Negative fixture exercises the bug. |
| Host wires NextAuth's session token verbatim into `Identity.key`, leaking PII / rotating with session refresh, defeating ETag stability | Medium | High | PRD-501-R6 requires the host to pass the principal's stable identifier (typically the user's `id` from the database or the `sub` claim from the JWT), not the session token. Worked example shows the correct extraction. PRD-500-R6 is cited. |
| Next.js's `request.cookies` API differs between App Router and Pages Router; SDK abstraction leaks one or the other | Medium | Medium | PRD-501-R5 mandates the request-normalization helper read cookies from a unified `getCookie(name)` accessor; the App Router and Pages Router adapters each implement it. PRD-500-R2's `ActRequest` is the boundary. |
| Hybrid-mount `basePath` collides with the host application's existing `/app` prefix | Low | Medium | PRD-501-R8 makes the basePath fully configurable; the default is `""` (root) so existing apps without prefixes work without configuration. PRD-500-R26 is cited. |
| Host omits the discovery hand-off Link header from non-ACT authenticated HTML responses, violating PRD-106-R23's broader intent | Medium | Low | PRD-501-R17 exposes a public middleware `actLinkHeaderMiddleware()` for the host to mount on its non-ACT routes; the implementation note shows the middleware integration with Next.js's `middleware.ts` file. |
| The Edge Runtime's restricted API surface (no Node.js APIs) breaks resolver implementations that use Node-only deps | Medium | Low | PRD-501-R19 documents the Edge / Node.js runtime split and which framework parts of the SDK are runtime-agnostic. The SDK itself is WHATWG-fetch-clean (delegated to PRD-505 patterns), so no Node-only imports. The host's resolver bodies are the host's concern. |
| 304 response under Next.js's caching layer is rewritten to 200 by an over-eager CDN config | Medium | Medium | PRD-501-R12 requires the SDK's 304 path to set explicit `Cache-Control: private, must-revalidate` headers; PRD-103-R8 / PRD-106-R3 are cited. The known-good Vercel deployment recipe is in the implementation notes. |

### Open questions

1. ~~Should the SDK ship a Next.js middleware (`middleware.ts`) helper that auto-applies the discovery hand-off Link header to every authenticated response site-wide?~~ **Resolved (2026-05-01): Yes, with a host-supplied `isAuthenticated` predicate.** Ratifies tentative answer; codified in PRD-501-R17. `actLinkHeaderMiddleware()` is the Next.js-shaped middleware export. The predicate is the host's responsibility (typically a cheap cookie / header presence check), NOT the host's `IdentityResolver` — re-running full identity verification on every page load is prohibitively expensive and unnecessary for a hint header. The host owns the trade-off between predicate cost and hint accuracy. (Closes Open Question 1.)
2. ~~Should the SDK support Next.js's `revalidate` and `tags` cache-invalidation primitives?~~ **Resolved (2026-05-01): No.** Ratifies tentative answer. Next.js's caching primitives operate over its own data layer; ACT's caching is HTTP `ETag` / `If-None-Match` / `Cache-Control` per PRD-103 (and is identity-scoped, which Next.js's data-cache layer is not). Mixing creates two sources of truth and risks cross-tenant cache poisoning if Next.js's data cache is keyed without the identity / tenant triple. Hosts MAY use Next.js's primitives inside resolver implementations; the SDK does not propagate them to the response layer. Revisit in v0.2 if PRD-705 implementer feedback signals friction. (Closes Open Question 2.)
3. ~~Should the SDK auto-detect the host's Next.js version and gate behavior?~~ **Resolved (2026-05-01): No.** Ratifies tentative answer. The SDK targets Next.js 14+ App Router as the reference baseline; older versions are best-effort via the Pages Router escape hatch (PRD-501-R20). Auto-detection adds runtime branching without a clear benefit — version-gated behavior would be a hidden compatibility surface and a maintenance burden. Hosts on older versions migrate or use the documented escape hatch. (Closes Open Question 3.)
4. ~~Should `defineActMount` accept a `runtime: "edge" | "nodejs"` flag?~~ **Resolved (2026-05-01): No.** Ratifies tentative answer. The runtime is a property of the Route Handler file (`export const runtime = "edge"`), not of the SDK; the SDK is WHATWG-fetch-clean per PRD-501-R19 and works on either runtime without configuration. Adding the flag would imply runtime-conditional behavior the SDK does not have. Documented in implementation notes. (Closes Open Question 4.)

### Acceptance criteria

- [ ] Specification opens with a table of parent PRD-500 requirements implemented + 100-series + PRD-103/106/109 requirements implemented (Phase 3 addition per workflow.md).
- [ ] Every normative requirement uses RFC 2119 keywords; ID `PRD-501-R{n}`.
- [ ] Conformance level (Core / Standard / Plus) declared per requirement, citing PRD-107.
- [ ] Implementation notes section present with ~5 short TypeScript snippets (factory function shape, identity hook example, hybrid-mount example, error-mapping wiring, middleware Link-header pattern).
- [ ] Test fixtures enumerated under `fixtures/501/{positive,negative}/`, aligned with `fixtures/500/`.
- [ ] No new JSON Schemas added under `schemas/501/` (the SDK serves PRD-100 envelopes).
- [ ] Open questions ≤ 5.
- [ ] Changelog entry dated 2026-05-01 by Jeremy Forsythe.

---

## Context & dependencies

### Depends on

- **PRD-500** (Runtime SDK contract): In review. The full resolver shape (`ActRuntime`), identity / tenancy hooks (`IdentityResolver` / `TenantResolver`), `Outcome<T>` discriminator, `EtagComputer`, `Logger`, `ActRequest` / `ActResponse`, and the `dispatch` pipeline (PRD-500-R5). PRD-501 is a leaf adapter under PRD-500-R11.
- **PRD-100** (Wire format & envelope shapes): Accepted. Manifest, index, node, subtree, error envelopes (PRD-100-R3–R8, R10–R15, R16–R20, R21–R27, R32–R36, R37–R40, R41–R44, R46).
- **PRD-103** (Caching, ETags, validators): Accepted. ETag derivation under runtime + per-tenant scoping (PRD-103-R1, R6, R7, R8, R9, R10), invoked through PRD-500's `defaultEtagComputer` (PRD-500-R20).
- **PRD-106** (Runtime delivery profile): Accepted. Endpoint set (PRD-106-R1), status codes (PRD-106-R3–R6), auth (PRD-106-R7–R11), caching (PRD-106-R12), URL encoding (PRD-106-R13–R15), per-tenant ID stability (PRD-106-R16), mounts (PRD-106-R17–R22), discovery hand-off (PRD-106-R23–R25), error envelope (PRD-106-R26–R30).
- **PRD-107** (Conformance levels): Accepted. Levels declared per requirement.
- **PRD-108** (Versioning policy): Accepted. Package versioning is staged per PRD-108-R14 / decision Q5 (see PRD-500-R28).
- **PRD-109** (Security): Accepted. Existence-non-leak (T1, R3, R4), identity-no-leak (T2, R16, R17), per-tenant scoping (T3, R11, R13), error-message PII (T5, R14, R15), Logger no-PII (R14).
- **000-governance**: Accepted. Lifecycle for this PRD.
- External: [Next.js App Router Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers); [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware); [WHATWG Fetch](https://fetch.spec.whatwg.org/) `Request` / `Response`; [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174); TypeScript 5.x.

### Blocks

- **PRD-705** (B2B SaaS workspace example) — depends on PRD-501 directly.
- **PRD-706** (Hybrid static + runtime + MCP bridge example) — depends on PRD-501 for the runtime branch.
- **PRD-600** (Validator) — incorporates `fixtures/501/` into its runtime probe.

### References

- v0.1 draft: §5.13 (Runtime serving), §6.6 (Runtime SDK pattern, Next.js example), §8.6 (B2B SaaS workspace example).
- `prd/000-decisions-needed.md`: Q3 (TS-only first-party for v0.1 — PRD-501 is in scope), Q4 (Apache-2.0 for code — applies to `@act/runtime-next` package), Q13 (search-body envelope deferred to v0.2 — applies to `resolveSearch`).
- Prior art: Next.js's own [App Router Route Handler conventions](https://nextjs.org/docs/app/api-reference/file-conventions/route); Apollo Server's `@apollo/server-integration-next` shape; Hono's Next.js integration; tRPC's `createNextApiHandler`. None directly adopted; cited for shape.

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) where requirements are imposed. Lowercase "must" and "should" are non-normative prose.

### Parent + 100-series requirements implemented

PRD-501 is a faithful adapter of PRD-500's contract onto Next.js. The table below lists every PRD-500 (parent) and 100-series requirement this PRD implements, the Next.js mechanism, and the PRD-501 requirement(s) that bind the SDK to the implementation.

| Source requirement | Source PRD | Mechanism (Next.js) | PRD-501 requirement |
|---|---|---|---|
| Resolver interface (`ActRuntime`) | PRD-500-R3 | Host registers via `defineActMount({ runtime })`; SDK wraps in App Router Route Handler factories | PRD-501-R2, R3 |
| Request normalization (`ActRequest`) | PRD-500-R2 | Adapter converts Next.js `Request` (WHATWG `Request` superset) → `ActRequest` | PRD-501-R5 |
| Identity resolver | PRD-500-R6 | Host registers `IdentityResolver` taking Next.js `Request`; worked patterns for NextAuth, JWT, header-based service identity | PRD-501-R6 |
| Tenant resolver | PRD-500-R7 | Host registers `TenantResolver`; subdomain / path-prefix / header strategies in implementation notes | PRD-501-R7 |
| Capability negotiation (construction-time) | PRD-500-R10 | `defineActMount` validates resolver set vs declared `conformance.level` at module load | PRD-501-R3 |
| Endpoint set per level | PRD-106-R1, PRD-500-R3 | App Router file layout: `app/.well-known/act.json/route.ts`, `app/act/index.json/route.ts`, `app/act/n/[...id]/route.ts`, `app/act/sub/[...id]/route.ts`, `app/act/index.ndjson/route.ts`, `app/act/search/route.ts` | PRD-501-R3, R4 |
| Catch-all `[...id]` for IDs containing `/` | PRD-100-R10, PRD-106-R14, R15 | Next.js catch-all segment; SDK joins the array with `/` to recover the canonical ID | PRD-501-R4 |
| `act_version` injection | PRD-100-R1, PRD-108-R1, PRD-500-R12 | Delegated to PRD-500's `dispatch` | PRD-501-R10 |
| MIME types per envelope | PRD-100-R46 | SDK sets `Content-Type` per endpoint with `profile=runtime` | PRD-501-R10 |
| `delivery: "runtime"` declaration | PRD-106-R25, PRD-500-R8 | SDK injects on `resolveManifest` output if host omits | PRD-501-R10 |
| Status code mapping (200/304/401/404/410/429/5xx) | PRD-106-R3–R6, PRD-500-R15, R17, R18 | Delegated to PRD-500's `dispatch`; Next.js `Response` carries the status verbatim | PRD-501-R11, R13, R14 |
| `WWW-Authenticate` per scheme on 401 | PRD-106-R8, PRD-500-R14, PRD-109-R5 | SDK invokes `buildAuthChallenges(manifest)`, appends each as a separate `WWW-Authenticate` header on the Next.js `Response` | PRD-501-R13 |
| ETag derivation (runtime triple) | PRD-103-R6, PRD-500-R20 | Delegated to `defaultEtagComputer`; host MAY override per PRD-500-R21 | PRD-501-R12 |
| `If-None-Match` → 304 | PRD-103-R8, PRD-106-R3, PRD-500-R19 | Delegated to PRD-500's `dispatch`; the Next.js `Response` carries 304 with no body and the `ETag` header echoed | PRD-501-R12 |
| `Cache-Control` + `Vary` per identity | PRD-103-R9, PRD-106-R12, PRD-500-R22 | Delegated; SDK does not override | PRD-501-R12 |
| Existence-non-leak (404 covers both) | PRD-106-R6, PRD-109-R3, PRD-500-R18 | Delegated; the Next.js `Response` body is byte-identical for both branches | PRD-501-R14 |
| Error envelope shape | PRD-100-R41–R44, PRD-106-R26, PRD-500-R17 | Delegated; SDK serializes the envelope from the `Outcome<T>` discriminator | PRD-501-R14 |
| Discovery hand-off Link header | PRD-106-R23, PRD-500-R29 | SDK sets `Link` on every dispatched response; `actLinkHeaderMiddleware()` provided for non-ACT routes via Next.js `middleware.ts` | PRD-501-R17 |
| Hybrid mount composability | PRD-100-R7, PRD-106-R17–R22, PRD-500-R26 | `defineActMount({ basePath })` configures the SDK; effective URLs in the manifest reflect the base path | PRD-501-R8, R18 |
| Bounded `act_version` rejection | PRD-108-R8, PRD-500-R30, PRD-109-R20 | Delegated to PRD-500's `dispatch` | PRD-501-R11 |
| Logger no-PII | PRD-109-R14, PRD-500-R23, R24 | Host registers `Logger` via `defineActMount({ logger })`; the SDK respects PRD-500-R23 redaction | PRD-501-R16 |
| Standard subtree resolver | PRD-100-R32–R36, PRD-500-R32 | Host registers `resolveSubtree`; mounted at `app/act/sub/[...id]/route.ts` | PRD-501-R3, R21 |
| Plus NDJSON resolver | PRD-100-R37, PRD-106-R32, PRD-500-R33 | Host registers `resolveIndexNdjson`; mounted at `app/act/index.ndjson/route.ts` | PRD-501-R3, R22 |
| Plus search resolver | PRD-100-R39, PRD-106-R33, PRD-500-R34 | Host registers `resolveSearch`; mounted at `app/act/search/route.ts` | PRD-501-R3, R22 |
| Content negotiation (NDJSON profile) | PRD-500-R16 | Delegated; the index handler routes to `resolveIndexNdjson` when `Accept` carries `profile=ndjson` | PRD-501-R15 |

The remainder of this Specification section binds the SDK to these implementations through normative requirements with PRD-501-R{n} IDs.

### Conformance level

Per PRD-107, PRD-501 requirements are banded:

- **Core:** PRD-501-R1 (the contract is normative), R2 (`createActHandler` factory), R3 (`defineActMount` and the canonical mount paths), R4 (catch-all `[...id]` for nodes and subtrees), R5 (request normalization for App Router), R6 (Next.js identity hook contract), R7 (Next.js tenant hook contract), R8 (`basePath` configurability), R9 (manifest serving), R10 (envelope serialization delegated to PRD-500), R11 (status-code mapping delegated to PRD-500), R12 (ETag / 304 / Cache-Control / Vary delegated to PRD-500), R13 (auth challenge wiring), R14 (error envelope delegated), R15 (content negotiation delegated), R16 (Logger wiring), R17 (discovery hand-off Link header on every ACT-endpoint response + middleware helper), R18 (hybrid mount), R19 (Edge Runtime / Node.js runtime parity), R20 (Pages Router fallback), R23 (test fixture conformance).
- **Standard:** PRD-501-R21 (subtree handler when manifest declares `conformance.level: "standard" | "plus"`).
- **Plus:** PRD-501-R22 (NDJSON index handler + search handler when manifest declares `conformance.level: "plus"`).

Auth scoping is orthogonal to level (per PRD-107-R4 / PRD-109-R10): a Core SDK MAY be deployed with auth required, and an unauthenticated public-tenant SDK MAY be Plus.

### Normative requirements

#### Meta

**PRD-501-R1.** This PRD's TypeScript signatures in §"Wire format / interface definition" are normative. The `@act/runtime-next` package MUST expose a public API structurally compatible with these signatures. PRD-501 narrows PRD-500's framework-neutral contract onto Next.js without widening PRD-500's obligations.

#### Factory shape

**PRD-501-R2.** The SDK MUST expose a public function `createActHandler(options): NextActHandler` that returns an App Router-compatible Route Handler. The handler is a function `(req: Request, ctx: { params?: Record<string, string | string[]> }) => Promise<Response>` (matching Next.js App Router's Route Handler signature for the `GET` export). For v0.1, only `GET` is generated; future MINOR MAY add `POST` (e.g., for subscriptions).

`createActHandler` is the single per-endpoint factory. The aggregate `defineActMount` helper (PRD-501-R3) calls it internally and also returns the configured runtime instance for re-use.

#### Mount declaration

**PRD-501-R3.** The SDK MUST expose a public function `defineActMount(options): ActMountHandlers` that returns an object whose keys are the per-endpoint Route Handlers the host application re-exports from its App Router files:

```typescript
export interface ActMountHandlers {
  manifest: NextActHandler;        // mount at app/.well-known/act.json/route.ts
  index: NextActHandler;           // mount at app/act/index.json/route.ts
  node: NextActHandler;            // mount at app/act/n/[...id]/route.ts
  subtree?: NextActHandler;        // Standard; mount at app/act/sub/[...id]/route.ts
  indexNdjson?: NextActHandler;    // Plus; mount at app/act/index.ndjson/route.ts
  search?: NextActHandler;         // Plus; mount at app/act/search/route.ts
  // PRD-501-R17 — middleware helper for non-ACT routes.
  linkHeaderMiddleware: NextLinkHeaderMiddleware;
}
```

The aggregate helper invokes PRD-500's `createActRuntime(config)` once at module load and constructs each per-endpoint handler from the resulting `ActRuntimeInstance`. The construction-time validation rules of PRD-500-R10 — that the resolver set matches the declared `conformance.level`, that OAuth manifest fields are consistent — apply here verbatim. Mismatches throw at module load and Next.js fails the build (App Router) or the request boundary (Pages Router escape hatch).

The default mount paths are the values listed in PRD-501-R4 below, with the `basePath` from `options` prepended.

#### Catch-all segment for IDs

**PRD-501-R4.** The node and subtree handlers MUST mount at a Next.js **catch-all** dynamic segment (`[...id]`) and the SDK MUST recover the canonical ID by joining the catch-all parameter array with `/`. Specifically:

- `app/act/n/[...id]/route.ts` → `ctx.params.id` is `string[]`. The SDK joins with `/`, then percent-decodes per PRD-106-R15 to recover the canonical ID; the canonical ID is passed as `params.id` (a single string) to `resolveNode`.
- `app/act/sub/[...id]/route.ts` → same mechanism for `resolveSubtree`.

The single dynamic segment form (`[id]`) MUST NOT be used; IDs containing `/` (per PRD-100-R10) would be silently truncated. The SDK's documented mount paths are the catch-all forms exclusively.

The SDK MUST handle both percent-encoded and decoded forms of the catch-all path consistently per PRD-106-R15 (canonical decoding). Two requests whose paths decode to the same canonical ID MUST resolve to the same node.

#### Request normalization

**PRD-501-R5.** The SDK's adapter MUST convert a Next.js `Request` (which is a WHATWG `Request` superset) to PRD-500's `ActRequest` per PRD-500-R2. Specifically:

- `method` ← `request.method`.
- `url` ← `new URL(request.url)`.
- `headers` ← `request.headers` (already a `Headers` instance in App Router; the SDK passes it through).
- `getCookie(name)` ← reads from `request.cookies.get(name)?.value` (App Router's `Request.cookies` API, which returns a `RequestCookie | undefined`).

The Pages Router escape hatch (PRD-501-R20) implements `getCookie` via `req.cookies?.[name]` on the Node-style `IncomingMessage`-compatible request; the converted `ActRequest` has the same shape as the App Router's.

#### Identity hook

**PRD-501-R6.** The SDK MUST accept a host-registered `IdentityResolver` of shape `(req: ActRequest) => Promise<Identity>` per PRD-500-R6. The Next.js host application is responsible for extracting credentials from the `ActRequest` and resolving them to a stable `Identity.key`.

The SDK MUST NOT impose a specific auth library. Worked patterns the SDK documents in implementation notes (non-normative):

- **NextAuth session cookie.** Host reads the session cookie via `actRequest.getCookie("next-auth.session-token")`, validates with `next-auth/jwt`'s `getToken`, and returns `{ kind: "principal", key: token.sub }`. The `sub` is the stable user ID; the session cookie value MUST NOT be passed as `Identity.key`.
- **JWT in `Authorization`.** Host reads `actRequest.headers.get("authorization")`, parses the bearer token, verifies the JWT, and returns `{ kind: "principal", key: payload.sub }`.
- **Header-based service identity.** Host reads a service-identity header (e.g., `X-Service-Account`), validates against a registry, and returns `{ kind: "principal", key: serviceAccount.id }`.
- **Anonymous public-tenant.** Host returns `{ kind: "anonymous" }` per PRD-106-R11. The SDK then dispatches without auth.

The SDK MUST NOT cache or persist the resolver's return value beyond the request scope — every request invokes the resolver fresh, per PRD-500-R5 step 3. Caching is the host's responsibility (e.g., a JWT verifier may cache its public-key fetch).

#### Tenant hook

**PRD-501-R7.** The SDK MUST accept a host-registered `TenantResolver` of shape `(req: ActRequest, identity: Identity) => Promise<Tenant>` per PRD-500-R7. The Next.js host application derives the tenant via one of three documented strategies:

- **Subdomain.** `host = actRequest.url.hostname; tenant = host.split(".")[0]`. Common for multi-tenant SaaS (`acme.app.example.com` → `acme`). The SDK does not validate; the host MUST sanitize and look up.
- **Path prefix.** `tenant = actRequest.url.pathname.match(/^\/t\/([^/]+)/)?.[1]`. Common for single-domain multi-tenant (`example.com/t/acme/...` → `acme`). The path prefix MUST also be reflected in the `basePath` configuration so the SDK strips it before dispatching.
- **Header.** `tenant = actRequest.headers.get("x-tenant-id")`. Common for B2B service-identity scenarios where a service principal acts on behalf of a tenant.

For deployments without tenanting, the host omits `tenantResolver` entirely; the SDK uses `{ kind: "single" }` per PRD-500-R7 default.

The `Tenant.key` MUST be stable per PRD-500-R7 / PRD-100-R15 / PRD-106-R16; the host MUST NOT mint per-request tenant IDs. Negative fixture exercises this (cross-references `fixtures/500/negative/`).

#### `basePath` configurability

**PRD-501-R8.** The SDK MUST accept an optional `basePath` configuration parameter on `defineActMount(options)` per PRD-500-R26. The default is `""`. When a non-empty `basePath` is supplied, the SDK:

1. Prepends it to every advertised URL in the manifest (`index_url`, `node_url_template`, `subtree_url_template`, `index_ndjson_url`, `search_url_template`).
2. Strips it from incoming request paths before dispatching, so `resolveNode` receives the unprefixed canonical ID.

The host MUST mount each Route Handler at the path `{basePath}{endpoint-path}`. For example, `defineActMount({ basePath: "/app", ... })` results in mount paths `app/app/.well-known/act.json/route.ts`, `app/app/act/index.json/route.ts`, etc. (Next.js's App Router file structure mirrors the URL.)

#### Manifest serving

**PRD-501-R9.** The manifest handler MUST serve the host-registered `resolveManifest` result per PRD-500-R3. The SDK MUST:

1. Honor the manifest's `delivery: "runtime"` declaration; if the host omits `delivery`, the SDK injects `"runtime"` per PRD-500-R8 / PRD-106-R25.
2. Apply `basePath` to advertised URLs per PRD-501-R8.
3. Compute and inject `etag` per PRD-103-R6 over the resolved manifest payload (the manifest itself is identity-independent in most deployments, but PRD-103's recipe still applies; identity is `null` for the manifest endpoint by default unless the host overrides).
4. Set `Content-Type: application/act-manifest+json; profile=runtime` per PRD-100-R46.
5. Apply caching headers per PRD-500-R22 (`Cache-Control: public, max-age=0` is the recommended default for the manifest, since it changes infrequently and is not identity-scoped; the host MAY override).

The manifest endpoint is reachable at `{basePath}/.well-known/act.json` per PRD-100-R3.

#### Envelope serialization

**PRD-501-R10.** The SDK MUST delegate envelope serialization to PRD-500's `dispatch` per PRD-500-R12 / R15. The Next.js adapter takes the resulting `ActResponse.body` (a JSON string for Core / Standard endpoints, an `AsyncIterable<string>` for the NDJSON variant) and constructs a Next.js `Response`:

```typescript
return new Response(actResponse.body, {
  status: actResponse.status,
  headers: actResponse.headers,
});
```

The adapter MUST NOT modify the body or status. It MAY append framework-specific headers (e.g., a CSRF nonce header set by an upstream Next.js middleware) provided they do not conflict with PRD-106-prescribed headers (`ETag`, `Cache-Control`, `Vary`, `WWW-Authenticate`, `Retry-After`, `Link`).

For the NDJSON case, the adapter constructs the Next.js `Response` with a `ReadableStream` whose underlying source is the `AsyncIterable<string>`:

```typescript
const stream = new ReadableStream({
  async start(controller) {
    for await (const line of actResponse.body) controller.enqueue(line);
    controller.close();
  },
});
return new Response(stream, { status: actResponse.status, headers: actResponse.headers });
```

#### Status-code mapping

**PRD-501-R11.** The SDK MUST honor PRD-500-R15 / R17 / R18's status-code mapping verbatim. The Next.js `Response` carries the status from `ActResponse.status`. Specifically:

- 200 (success) and 304 (If-None-Match match) for `{ kind: "ok" }` per PRD-500-R19.
- 401 for `{ kind: "auth_required" }` per PRD-500-R17.
- 404 for `{ kind: "not_found" }` per PRD-500-R17 / R18.
- 410 only when the host explicitly opts in for a deleted resource per PRD-106-R6 (the `Outcome<T>` discriminator does not have a `gone` variant; the host signals 410 via a custom mechanism documented in implementation notes — for v0.1, returning `{ kind: "not_found" }` with the recommended 404 is sufficient).
- 429 for `{ kind: "rate_limited" }` per PRD-500-R17 with `Retry-After`.
- 5xx for `{ kind: "internal" }` per PRD-500-R17.

The SDK MUST NOT introduce Next.js-specific status codes outside this set (e.g., Next.js's own 308 for trailing-slash redirects MUST NOT replace any ACT status code).

The SDK MUST honor PRD-500-R30's bounded `act_version` rejection: if the request's `Accept-Version` or body declares a MAJOR higher than the SDK's configured MAJOR, the SDK responds 400 with `error.code: "validation"` and `details.reason: "act_version_unsupported"` before invoking any resolver.

#### ETag / 304 / Cache-Control / Vary

**PRD-501-R12.** The SDK MUST delegate ETag computation, `If-None-Match` matching, 304 responses, `Cache-Control`, and `Vary` to PRD-500-R19 / R20 / R22 verbatim. The Next.js adapter does not implement these; the headers come back from `ActResponse.headers` and are set on the Next.js `Response` per PRD-501-R10.

The default `EtagComputer` is PRD-500's `defaultEtagComputer` (which implements PRD-103-R6's runtime triple recipe). A host MAY register a custom `etagComputer` per PRD-500-R21; the override MUST be deterministic, MUST NOT mix request-local data, and MUST return a value satisfying PRD-103-R2's value-shape regex.

#### Auth challenge wiring

**PRD-501-R13.** When the SDK's dispatch produces a 401 response, the SDK MUST emit one `WWW-Authenticate` HTTP header per advertised scheme in `auth.schemes` order, per PRD-500-R14 / PRD-106-R8 / PRD-109-R5. The Next.js `Response` constructor accepts a `Headers` instance which supports multiple values for the same header name; the SDK uses `headers.append("WWW-Authenticate", challenge)` per challenge string returned by `buildAuthChallenges(manifest)`.

The set of challenges MUST be a function of the manifest, NOT of the request URL (PRD-106-R8). The SDK enforces this by computing the challenges once at module load and reusing them on every 401 — varying them per request would create an existence oracle (PRD-109-R8).

#### Error envelope wiring

**PRD-501-R14.** The SDK MUST delegate error envelope construction to PRD-500-R17. The Next.js `Response` body is the JSON string from `ActResponse.body`. The `Content-Type` is `application/act-error+json; profile=runtime` per PRD-100-R46. The `error.message` is one of PRD-500-R17's fixed code-specific strings; the SDK MUST NOT propagate Next.js-specific exception text into `error.message`.

The existence-non-leak rule (PRD-500-R18 / PRD-109-R3) is honored by construction: both "not found" and "forbidden" branches return identical Next.js `Response` objects (modulo opaque request IDs the SDK MAY echo per PRD-500-R25).

#### Content negotiation

**PRD-501-R15.** The index handler MUST honor `Accept` per PRD-500-R16. When the request's `Accept` header carries `application/act-index+json; profile=ndjson`, the handler routes to `resolveIndexNdjson` (Plus); otherwise it routes to `resolveIndex` (Core). When `resolveIndexNdjson` is not registered and the client requests the NDJSON variant, the handler returns 406 with `error.code: "validation"` and `details.reason: "ndjson_not_supported"`.

The SDK MAY implement the index endpoint and the NDJSON endpoint as the same Route Handler (when registered together) or as separate handlers (mounted at different file paths); the file-layout choice is implementation-detail.

#### Logger wiring

**PRD-501-R16.** The SDK MUST accept a host-registered `Logger` per PRD-500-R23 / R24. The default Logger is a no-op. Hosts SHOULD wire a real logger:

- **Next.js `console`-shaped logger.** A trivial `console.log`-based logger for development.
- **Structured logger.** A wrapper around `pino`, `winston`, or any structured-logging library that maps `ActLogEvent` to the host's log format.

The SDK MUST NOT pass auth-scoped material to the Logger per PRD-500-R23; the Logger receives the redacted shape. PRD-109-R14 / R15 are the project-wide PII rules; PRD-501 inherits.

#### Discovery hand-off Link header

**PRD-501-R17.** The SDK MUST emit the discovery hand-off Link header per PRD-106-R23 / PRD-500-R29 on every dispatched response (200 / 304 / 401 / 404 / 429 / 5xx). The header value is:

```
</.well-known/act.json>; rel="act"; type="application/act-manifest+json"; profile="runtime"
```

with the `basePath` prepended if configured.

For non-ACT authenticated responses (the host application's HTML pages, app JSON endpoints), the SDK MUST expose a public Next.js middleware helper `actLinkHeaderMiddleware(opts)` that the host registers in `middleware.ts`. The middleware reads the request, calls a host-supplied `isAuthenticated` predicate, and conditionally appends the Link header to the response. The predicate is the host's responsibility — typically a fast cookie / header presence check, NOT a full identity verification (which would be expensive on every page load).

The middleware helper signature is:

```typescript
export interface NextLinkHeaderMiddlewareOptions {
  basePath?: string;
  isAuthenticated: (req: Request) => boolean | Promise<boolean>;
}

export function actLinkHeaderMiddleware(
  opts: NextLinkHeaderMiddlewareOptions,
): (req: Request, res: Response) => Response;
```

The middleware does NOT enforce auth; it only emits the discovery hand-off. Auth enforcement is the host application's middleware concern.

#### Hybrid mount

**PRD-501-R18.** A Next.js application MAY mount the SDK at any `basePath` per PRD-501-R8 to participate in a parent manifest's `mounts` array per PRD-100-R7 / PRD-106-R17–R22. The SDK MUST emit the manifest at `{basePath}/.well-known/act.json` and advertise URLs prefixed with `basePath`.

A parent manifest's `mounts` entry referencing the Next.js SDK's manifest URL MUST satisfy:

- `prefix` matches `basePath`.
- `delivery: "runtime"` per PRD-106-R25 (the SDK is runtime-only).
- `manifest_url` is the effective `{basePath}/.well-known/act.json` URL.

The SDK does not validate the parent manifest; cross-document validation is PRD-600's responsibility.

#### Edge Runtime and Node.js Runtime parity

**PRD-501-R19.** The SDK MUST work on both the Next.js Edge Runtime (`export const runtime = "edge"` in the Route Handler file) and the Node.js Runtime (`export const runtime = "nodejs"`, the App Router default). The SDK's own code MUST NOT import Node.js-specific APIs (`fs`, `crypto.createHash` without a WHATWG `crypto.subtle` fallback, `Buffer` without a Web-standard fallback, `process.*` beyond `process.env` for configuration) — it MUST be WHATWG-fetch-clean.

The host's resolver bodies are the host's concern. A resolver that uses `fs` MUST run on the Node.js Runtime; the SDK does not enforce this but documents the constraint.

`defaultEtagComputer` (per PRD-500-R20) is implemented using `crypto.subtle.digest('SHA-256', ...)` (available on both runtimes). The base64url encoding step uses standard string manipulation. JCS canonicalization uses a Web-standard JSON serializer with manual key sorting.

#### Pages Router fallback

**PRD-501-R20.** The SDK MAY expose a Pages Router-compatible adapter `createActPagesHandler(options)` returning a `(req: NextApiRequest, res: NextApiResponse) => Promise<void>` for hosts that have not migrated to App Router. This is a documented escape hatch; the App Router (PRD-501-R3) is the v0.1 reference.

The Pages Router adapter MUST normalize requests through PRD-500-R2's `ActRequest` and dispatch through PRD-500's `dispatch` identically to the App Router path. The Pages Router's lack of catch-all dynamic segments is addressed by mounting at a single catch-all file (`pages/api/act/[...act].ts`) and dispatching internally based on the URL path; this is implementation-detail and is documented in implementation notes.

#### Standard

**PRD-501-R21.** When the manifest declares `conformance.level: "standard" | "plus"`, `defineActMount` MUST require a registered `resolveSubtree` resolver per PRD-500-R32. The subtree handler is mounted at `app/act/sub/[...id]/route.ts` and bounds `depth` to `[0, 8]` per PRD-100-R33. Default depth when the request omits one is `3` per PRD-100-R33.

The handler MUST honor the `?depth=N` query parameter when present and MUST validate the bound; out-of-range requests return `{ kind: "validation", details: { reason: "depth_out_of_range" } }` per PRD-500-R32.

#### Plus

**PRD-501-R22.** When the manifest declares `conformance.level: "plus"`, `defineActMount` MUST require registered `resolveIndexNdjson` and `resolveSearch` resolvers per PRD-500-R33 / R34. The NDJSON handler is mounted at `app/act/index.ndjson/route.ts` and serves the response as a streaming `ReadableStream` per PRD-501-R10. The search handler is mounted at `app/act/search/route.ts` and reads the query from the URL's `?q={query}` parameter (or whichever placeholder the manifest's `search_url_template` declares).

The search response shape is opaque-but-JSON for v0.1 per decision Q13. The SDK serializes the resolver's returned value verbatim with `Content-Type: application/json; profile=runtime`.

#### Test fixture conformance

**PRD-501-R23.** The `@act/runtime-next` package MUST pass the test fixture matrix under `fixtures/501/` AND the shared SDK harness under `fixtures/500/` per PRD-500-R31. The shared fixtures cover the framework-neutral contract; PRD-501-specific fixtures cover Next.js-specific concerns (catch-all routing, App Router vs Pages Router, Edge Runtime parity, middleware Link-header pattern).

PRD-600 incorporates both fixture sets into its runtime probe.

### Wire format / interface definition

The contract is a TypeScript interface set extending PRD-500's interfaces. The signatures below are normative per PRD-501-R1.

#### Public types

```typescript
import type {
  ActRuntime,
  ActRequest,
  ActResponse,
  Identity,
  Tenant,
  IdentityResolver,
  TenantResolver,
  EtagComputer,
  Logger,
  Manifest,
} from '@act/runtime-core';

// --- Next.js Route Handler shape (App Router) ---
export type NextActHandler = (
  req: Request,
  ctx: { params?: Record<string, string | string[]> },
) => Promise<Response>;

// --- The aggregate mount declaration ---
export interface DefineActMountOptions {
  manifest: Manifest;
  runtime: ActRuntime;
  identityResolver: IdentityResolver;
  tenantResolver?: TenantResolver;
  etagComputer?: EtagComputer;
  logger?: Logger;
  basePath?: string;
  anonymousCacheSeconds?: number;
}

export interface ActMountHandlers {
  manifest: NextActHandler;
  index: NextActHandler;
  node: NextActHandler;
  subtree?: NextActHandler;
  indexNdjson?: NextActHandler;
  search?: NextActHandler;
  linkHeaderMiddleware: NextLinkHeaderMiddleware;
}

export function defineActMount(options: DefineActMountOptions): ActMountHandlers;

// --- Per-endpoint factory (lower-level; defineActMount calls this) ---
export interface CreateActHandlerOptions extends DefineActMountOptions {
  endpoint: 'manifest' | 'index' | 'node' | 'subtree' | 'indexNdjson' | 'search';
}

export function createActHandler(options: CreateActHandlerOptions): NextActHandler;

// --- Discovery hand-off middleware (PRD-501-R17) ---
export interface NextLinkHeaderMiddlewareOptions {
  basePath?: string;
  isAuthenticated: (req: Request) => boolean | Promise<boolean>;
}

export type NextLinkHeaderMiddleware = (
  req: Request,
  res: Response,
) => Response;

export function actLinkHeaderMiddleware(
  opts: NextLinkHeaderMiddlewareOptions,
): NextLinkHeaderMiddleware;

// --- Pages Router escape hatch (PRD-501-R20) ---
import type { NextApiRequest, NextApiResponse } from 'next';

export type NextActPagesHandler = (
  req: NextApiRequest,
  res: NextApiResponse,
) => Promise<void>;

export function createActPagesHandler(
  options: DefineActMountOptions,
): NextActPagesHandler;
```

#### App Router file layout

The recommended file layout for a Next.js App Router host adopting `@act/runtime-next` is:

```
app/
├── .well-known/
│   └── act.json/
│       └── route.ts          # exports GET = handlers.manifest
├── act/
│   ├── index.json/
│   │   └── route.ts          # exports GET = handlers.index
│   ├── index.ndjson/         # Plus only
│   │   └── route.ts          # exports GET = handlers.indexNdjson
│   ├── n/
│   │   └── [...id]/
│   │       └── route.ts      # exports GET = handlers.node
│   ├── sub/                  # Standard / Plus only
│   │   └── [...id]/
│   │       └── route.ts      # exports GET = handlers.subtree
│   └── search/               # Plus only
│       └── route.ts          # exports GET = handlers.search
└── act-mount.ts              # exports handlers from defineActMount({ ... })
```

The host application owns the `act-mount.ts` module that calls `defineActMount`; each Route Handler file is a one-liner re-exporting the appropriate handler. This keeps the SDK initialization in one place and the file tree shallow.

### Errors

The SDK does not introduce new HTTP status codes. The mapping is delegated to PRD-500-R17 and PRD-106-R3–R6:

| Resolver outcome | Status | `error.code` | Notes |
|---|---|---|---|
| `{ kind: "ok" }` | 200 (or 304 on If-None-Match) | n/a | Per PRD-500-R15 |
| `{ kind: "auth_required" }` | 401 | `auth_required` | One `WWW-Authenticate` per advertised scheme (PRD-501-R13) |
| `{ kind: "not_found" }` | 404 | `not_found` | Identical body & headers regardless of "absent" vs "forbidden" (PRD-501-R14) |
| `{ kind: "rate_limited", retryAfterSeconds }` | 429 | `rate_limited` | `Retry-After: <seconds>` |
| `{ kind: "validation", details? }` | 400 (default) or 406 (NDJSON not supported) | `validation` | |
| `{ kind: "internal", details? }` | 500 (default) | `internal` | |

Construction-time configuration errors thrown from `defineActMount` (PRD-500-R10) fail at module load (App Router) or at the first request (Pages Router), surfaced as Next.js build errors or runtime exceptions. PRD-600 probes both.

---

## Examples

Examples are non-normative but consistent with the Specification.

### Example 1 — Minimum-conformant Core deployment (App Router)

```typescript
// app/act-mount.ts
import { defineActMount, defaultEtagComputer } from '@act/runtime-next';
import { getCurrentPrincipal } from '@/lib/auth';
import { db } from '@/lib/db';

export const actMount = defineActMount({
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
    resolveManifest: async (req, ctx) => ({
      kind: 'ok',
      value: /* same manifest as configured */,
    }),

    resolveIndex: async (req, ctx) => {
      if (ctx.identity.kind === 'auth_required') return { kind: 'auth_required' };
      if (ctx.identity.kind === 'anonymous') return { kind: 'auth_required' };
      const docs = await db.documents.findMany({
        where: { tenantId: ctx.tenant.kind === 'scoped' ? ctx.tenant.key : null },
      });
      return {
        kind: 'ok',
        value: {
          act_version: '0.1',
          nodes: docs.map((d) => ({
            id: `doc/${d.id}`,
            type: 'article',
            title: d.title,
            summary: d.summary,
            tokens: { summary: 12 },
            etag: '', // SDK injects via defaultEtagComputer
            updated_at: d.updatedAt.toISOString(),
          })),
        },
      };
    },

    resolveNode: async (req, ctx, { id }) => {
      if (ctx.identity.kind !== 'principal') return { kind: 'auth_required' };
      const doc = await db.documents.findUnique({
        where: { id: id.replace(/^doc\//, ''), tenantId: ctx.tenant.kind === 'scoped' ? ctx.tenant.key : null },
      });
      if (!doc) return { kind: 'not_found' }; // covers "absent" and "forbidden" identically
      return {
        kind: 'ok',
        value: {
          act_version: '0.1',
          id,
          type: 'article',
          title: doc.title,
          summary: doc.summary,
          content: [{ type: 'prose', text: doc.body }],
          tokens: { summary: 12, body: 250 },
          etag: '',
        },
      };
    },
  },

  identityResolver: async (req) => {
    const principal = await getCurrentPrincipal(req);
    if (!principal) return { kind: 'auth_required', reason: 'missing' };
    return { kind: 'principal', key: principal.id };
  },

  tenantResolver: async (req, identity) => {
    if (identity.kind !== 'principal') return { kind: 'single' };
    const principal = await getCurrentPrincipal(req);
    return { kind: 'scoped', key: principal!.tenantId };
  },
});
```

```typescript
// app/.well-known/act.json/route.ts
export { actMount as default } from '@/app/act-mount';
import { actMount } from '@/app/act-mount';
export const GET = actMount.manifest;
```

```typescript
// app/act/index.json/route.ts
import { actMount } from '@/app/act-mount';
export const GET = actMount.index;
```

```typescript
// app/act/n/[...id]/route.ts
import { actMount } from '@/app/act-mount';
export const GET = actMount.node;
```

The host writes resolution logic; the SDK handles `act_version` injection, ETag computation, 401 / 404 mapping, the discovery hand-off Link header, and content negotiation.

### Example 2 — Plus deployment with NDJSON, search, and middleware Link header

```typescript
// app/act-mount.ts
import { defineActMount } from '@act/runtime-next';

export const actMount = defineActMount({
  manifest: {
    act_version: '0.1',
    site: { name: 'Acme Plus Workspace' },
    delivery: 'runtime',
    conformance: { level: 'plus' },
    auth: {
      schemes: ['bearer', 'oauth2'],
      oauth2: {
        authorization_endpoint: 'https://acme.com/oauth/authorize',
        token_endpoint: 'https://acme.com/oauth/token',
        scopes_supported: ['act.read'],
      },
    },
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
          yield {
            id: `doc/${doc.id}`,
            type: 'article',
            title: doc.title,
            summary: doc.summary,
            tokens: { summary: 12 },
            etag: '',
          };
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
});
```

```typescript
// middleware.ts (Next.js root middleware)
import { actLinkHeaderMiddleware } from '@act/runtime-next';

const linkHeader = actLinkHeaderMiddleware({
  isAuthenticated: (req) => req.cookies.has('next-auth.session-token'),
});

export function middleware(req: Request) {
  // Pass through to the route; the response is augmented with the Link header
  // when the request is authenticated.
  const res = NextResponse.next();
  return linkHeader(req, res);
}

export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
};
```

The middleware emits the discovery hand-off Link header on every authenticated HTML page response, satisfying PRD-106-R23's broader scope.

### Example 3 — Hybrid mount under a parent manifest

```typescript
// Mounted at /app — the marketing site is at the root
export const actMount = defineActMount({
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
  basePath: '/app',  // PRD-501-R8
  runtime: { /* ... */ },
  identityResolver: /* ... */,
});
```

The effective URLs in the served manifest become:

```json
{
  "index_url": "/app/act/index.json",
  "node_url_template": "/app/act/n/{id}",
  "subtree_url_template": "/app/act/sub/{id}"
}
```

The parent manifest at `/.well-known/act.json` (served by the marketing site, possibly via PRD-405 static-export) declares:

```json
{
  "mounts": [
    {
      "prefix": "/app",
      "delivery": "runtime",
      "manifest_url": "/app/.well-known/act.json",
      "conformance": { "level": "standard" }
    }
  ]
}
```

A consumer asking for "minimum Standard, runtime profile" follows the mount.

### Example 4 — Catch-all `[...id]` for IDs containing `/`

```typescript
// app/act/n/[...id]/route.ts
import { actMount } from '@/app/act-mount';
export const GET = actMount.node;

// The SDK joins ctx.params.id (an array) with '/' before calling resolveNode.
// Request: GET /act/n/doc/proj-launch-2026
// Next.js: ctx.params.id = ['doc', 'proj-launch-2026']
// SDK:     params.id = 'doc/proj-launch-2026'
// resolveNode receives the canonical ID intact.
```

The single-segment form (`[id]`) MUST NOT be used; it would silently truncate to `doc` and miss the second segment.

### Example 5 — 401 with three `WWW-Authenticate` headers

A manifest with `auth.schemes: ["cookie", "bearer", "oauth2"]` and OAuth fields configured. An unauthenticated request to `/act/index.json` results in:

```http
HTTP/1.1 401 Unauthorized
Content-Type: application/act-error+json; profile=runtime
WWW-Authenticate: Cookie realm="acme.com"
WWW-Authenticate: Bearer realm="acme.com"
WWW-Authenticate: Bearer realm="acme.com", error="invalid_token", scope="act.read", authorization_uri="https://acme.com/oauth/authorize"
Link: </.well-known/act.json>; rel="act"; type="application/act-manifest+json"; profile="runtime"

{"act_version":"0.1","error":{"code":"auth_required","message":"Authentication required to access this resource."}}
```

The set of `WWW-Authenticate` headers is a function of the manifest, not the request URL (PRD-501-R13 / PRD-106-R8 / PRD-109-R5).

---

## Test fixtures

Fixtures live under `fixtures/501/{positive,negative}/` and align with the shared SDK harness under `fixtures/500/`. Each Next.js-specific fixture exercises a Next.js framework concern (catch-all routing, App Router behavior, middleware integration, Edge Runtime parity); shared fixtures from `fixtures/500/` cover the framework-neutral contract.

The harness shape for PRD-501 fixtures: each fixture is a JSON document declaring `(input_request, configured_mount, expected_response)`. The harness instantiates `@act/runtime-next` against an in-process Next.js test bench (`next-test-utils` or equivalent), constructs the fixture's `Request`, dispatches through the mounted handler, and asserts the response matches expectations.

### Positive

- `fixtures/501/positive/app-router-manifest-200.json` → App Router `GET /.well-known/act.json` returns 200 with the manifest envelope, `ETag`, `Cache-Control: public, max-age=0`, and the discovery hand-off Link header. Satisfies PRD-501-R3, R9, R10, R12, R17.
- `fixtures/501/positive/catch-all-id-with-slash.json` → `GET /act/n/doc/proj-launch-2026` resolves with `params.id = "doc/proj-launch-2026"` (the SDK joins the catch-all array). Satisfies PRD-501-R4.
- `fixtures/501/positive/catch-all-percent-encoded.json` → `GET /act/n/doc/proj%2Dlaunch%2D2026` decodes to the canonical ID and resolves to the same node as the un-encoded form. Satisfies PRD-501-R4 / PRD-106-R15.
- `fixtures/501/positive/identity-from-nextauth-session.json` → `IdentityResolver` reads the NextAuth session cookie, validates with `getToken`, returns `{ kind: "principal", key: token.sub }`. Satisfies PRD-501-R6 / PRD-500-R6.
- `fixtures/501/positive/tenant-from-subdomain.json` → `TenantResolver` extracts tenant from `acme.app.example.com` → `acme`. Satisfies PRD-501-R7.
- `fixtures/501/positive/hybrid-mount-basepath-app.json` → SDK constructed with `basePath: "/app"`; well-known URL is `/app/.well-known/act.json`; advertised URLs in manifest carry the prefix. Satisfies PRD-501-R8 / R18.
- `fixtures/501/positive/middleware-link-header-on-html.json` → `actLinkHeaderMiddleware` augments an authenticated HTML response with the discovery Link header. Satisfies PRD-501-R17.
- `fixtures/501/positive/edge-runtime-parity.json` → SDK works under `export const runtime = "edge"`; `defaultEtagComputer` uses `crypto.subtle`. Satisfies PRD-501-R19.
- `fixtures/501/positive/standard-subtree-default-depth.json` → `GET /act/sub/doc/parent` returns the subtree at default depth `3`. Satisfies PRD-501-R21.
- `fixtures/501/positive/plus-ndjson-streaming.json` → `GET /act/index.ndjson` streams NDJSON; each line carries its own `etag` per PRD-103-R12. Satisfies PRD-501-R22.
- `fixtures/501/positive/plus-search-opaque-json.json` → `GET /act/search?q=foo` returns the resolver's value verbatim with `Content-Type: application/json; profile=runtime`. Satisfies PRD-501-R22 / PRD-500-R34.

### Negative

- `fixtures/501/negative/single-segment-id-truncates.json` → SDK mounted with `[id]` (single dynamic segment) instead of `[...id]` catch-all; an ID containing `/` is silently truncated. Validator MUST flag per PRD-501-R4.
- `fixtures/501/negative/identity-uses-session-token-key.json` → `IdentityResolver` returns `{ kind: "principal", key: <session-token> }`; the session token rotates per login, breaking ETag stability across token refreshes. Validator MUST flag per PRD-501-R6 / PRD-500-R6 / PRD-103-R6.
- `fixtures/501/negative/tenant-from-request-id.json` → `TenantResolver` returns a per-request UUID as `Tenant.key`. Validator MUST flag per PRD-501-R7 / PRD-500-R7 / PRD-100-R15.
- `fixtures/501/negative/manifest-mismatched-delivery.json` → Host configures `delivery: "static"` on a runtime SDK; `defineActMount` MUST throw at module load. Validator MUST flag per PRD-501-R3 / PRD-500-R10 / PRD-106-R25.
- `fixtures/501/negative/level-plus-missing-search.json` → Manifest declares `level: "plus"` but `resolveSearch` is not registered; `defineActMount` MUST throw. Validator MUST flag per PRD-501-R3 / PRD-500-R10.
- `fixtures/501/negative/link-header-missing-on-401.json` → 401 response omits the discovery hand-off Link header. Validator MUST flag per PRD-501-R17 / PRD-500-R29.
- `fixtures/501/negative/404-leaks-existence-via-headers.json` → 404 for "absent" and 404 for "forbidden" carry different Next.js cache-control headers. Validator MUST flag per PRD-501-R14 / PRD-500-R18 / PRD-109-R3.
- `fixtures/501/negative/etag-override-uses-timestamp.json` → Host registers a custom `etagComputer` that mixes a request timestamp; two consecutive identical requests produce different ETags. Validator MUST flag per PRD-500-R21 / PRD-103-R7 / PRD-109-R17.

Each fixture's `_fixture_meta` block names the requirement(s) it satisfies or violates and the expected validator finding.

---

## Versioning & compatibility

Per PRD-108, classify each kind of change to PRD-501.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a new optional field to `DefineActMountOptions` with a documented default | MINOR | Per PRD-108-R4(1). |
| Add a new exported helper (e.g., `actSubdomainTenantResolver`) | MINOR | Additive; PRD-108-R4(1). |
| Change the canonical mount path (e.g., move `[...id]` to `[id]`) | MAJOR | The mount path is a structural API; existing host file trees would break. |
| Change `defineActMount`'s return shape (e.g., add a required key to `ActMountHandlers`) | MAJOR | Per PRD-108-R5(2). |
| Add a new optional handler to `ActMountHandlers` (e.g., a future `subscriptions`) | MINOR | Per PRD-108-R4(1) — additive. |
| Tighten Pages Router fallback (PRD-501-R20) from MAY to MUST | MAJOR | Per PRD-108-R5(3). The escape hatch is intentionally optional. |
| Loosen catch-all requirement (PRD-501-R4) from MUST to SHOULD | MAJOR | Per PRD-108-R5(3). The catch-all is the only correct routing for IDs with `/`. |
| Change the package layout (e.g., rename `@act/runtime-next` to `@act/next`) | MAJOR | Per PRD-500-R28. |
| Change the discovery hand-off middleware signature | MAJOR | Per PRD-108-R5(2). The middleware contract is part of the public API. |
| Add a new logger event type (e.g., `nextjs_route_matched`) | MINOR | Per PRD-500's `ActLogEvent` extension rules — additive. |
| Add Edge Runtime-specific configuration (e.g., a runtime-aware ETag override path) | MINOR | Optional configuration; existing hosts unaffected. |
| Bump the minimum Next.js version requirement (e.g., 14 → 15) | MAJOR | The package's `peerDependencies` constraint changes; existing installs would break. |

### Forward compatibility

Per PRD-108-R7, host applications MUST tolerate unknown optional fields in `DefineActMountOptions`. A future MINOR adding a new optional field (e.g., `cacheTier: "edge" | "regional"`) is ignored by hosts that don't know about it.

The wire surface a Next.js SDK exposes is owned by PRD-100 / PRD-103 / PRD-106; host applications consuming the SDK's output (i.e., agents fetching ACT envelopes) are unaffected by SDK-internal changes.

### Backward compatibility

Within a MAJOR of PRD-501, every MINOR is backward-compatible with every prior MINOR. A `@act/runtime-next@0.1` installation continues to work after the package advances to `@act/runtime-next@0.2`, modulo MINOR-additive optional fields the host MAY adopt.

The package's pinning per PRD-500-R28 / PRD-108-R14 / decision Q5 is staged: at v0.1 the SDK is MAJOR.MINOR-pinned to spec `0.1`; once PRD-200 ratifies the staged transition, the SDK MAY transition to MAJOR-pinned / MINOR-floating.

---

## Security considerations

Security posture is owned by PRD-109 (Accepted) and inherited through PRD-500. PRD-501 imports the constraints by reference; specific Next.js-binding points:

- **Existence-non-leak via 404 (T1).** PRD-501-R14 delegates to PRD-500-R18 — both "absent" and "forbidden" branches return byte-identical Next.js `Response` objects. A common Next.js anti-pattern is using `next/error`'s `notFound()` for "absent" and a custom 404 page for "forbidden"; the SDK MUST NOT do this. Negative fixture `404-leaks-existence-via-headers.json` exercises the rule.
- **Identity-no-leak via ETag (T2).** PRD-501-R12 delegates to PRD-500-R20 / R21 / PRD-103-R6. A host that registers a custom `etagComputer` MUST NOT use Next.js's `crypto.randomUUID()` or `Date.now()` in the input. The SDK rejects custom values that fail PRD-103-R2's value-shape regex (PRD-500-R21).
- **Cross-tenant cache poisoning (T3).** PRD-501 delegates to PRD-500-R22 — `Vary: Authorization` (or `Vary: Cookie`) is set on identity-scoped responses. A common Next.js mistake is enabling Vercel's edge cache for an authenticated route without `Vary`; the SDK's emitted headers prevent the wrong-tenant-served pattern when intermediaries respect `Vary`. Vercel-specific deployment guidance is in implementation notes.
- **PII via free-form error message (T5).** PRD-501-R14 delegates to PRD-500-R17 — fixed code-specific messages, no resolver-supplied free-form text. Host resolver bodies MUST NOT include user input or stack traces in `details`.
- **Logger no-PII (T5 reinforcement).** PRD-501-R16 delegates to PRD-500-R23 / R24 — the Logger receives the redacted shape. A common Next.js anti-pattern is wiring the host's `winston` / `pino` logger directly to `console.log(req)`; the SDK's contract prevents this by passing only PRD-500-R24 events.
- **Discovery as a feature (T9).** PRD-501-R17 emits the discovery hand-off Link header on every authenticated response by design (PRD-106-R23 / PRD-109-R23). Hosts wanting private discovery rely on auth gating the well-known endpoint itself; the SDK invokes `IdentityResolver` on the manifest endpoint like every other endpoint.
- **DoS via unbounded subtree depth (T7).** PRD-501-R21 bounds depth at construction time per PRD-100-R33 / PRD-500-R32. A request with `?depth=100` returns 400 with `error.code: "validation"` before invoking the resolver.
- **DoS via inflated `act_version` (T7).** PRD-501-R11 delegates to PRD-500-R30 — bounded rejection before resolver invocation.
- **Edge Runtime cryptographic constraints.** Per PRD-501-R19, the SDK uses `crypto.subtle.digest('SHA-256', ...)` (Web-standard, available on both Edge and Node runtimes). A host's custom `etagComputer` running on Edge MUST also use `crypto.subtle`; the SDK does not enforce this but documents the constraint.
- **Cross-origin mount trust (T6).** PRD-501-R18 makes the SDK mountable; cross-origin trust is the consumer's job per PRD-109-R21. A producer using PRD-501 to mount onto a third-party origin MUST document the trust relationship in `manifest.policy`.

The SDK is the security front line for every Next.js ACT runtime deployment. The contract here makes the security-relevant defaults the hard-to-bypass path: a host application CAN bypass them (custom Route Handlers that skip `defineActMount`, custom Logger that ignores PRD-500-R23), but the bypass is explicit and reviewable.

---

## Implementation notes

This section ships canonical TypeScript snippets that the implementation team and consuming host applications use as reference. The snippets are normative as patterns; the exact TypeScript text is illustrative.

### Pattern 1 — `defineActMount` factory shape (PRD-501-R3)

```typescript
import { createActRuntime } from '@act/runtime-core';
import type { DefineActMountOptions, ActMountHandlers } from './types';

export function defineActMount(options: DefineActMountOptions): ActMountHandlers {
  // PRD-500-R10: validate resolver set vs declared level at construction time.
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

  const buildHandler = (endpoint: ActEndpoint): NextActHandler => {
    return async (req, ctx) => {
      // PRD-501-R5: normalize request.
      const actRequest = toActRequest(req, ctx, options.basePath);
      // PRD-501-R10/R11/R12/R13/R14: delegate to dispatch.
      const response = await runtime.dispatch(actRequest);
      return toNextResponse(response);
    };
  };

  return {
    manifest: buildHandler('manifest'),
    index: buildHandler('index'),
    node: buildHandler('node'),
    subtree: options.runtime.resolveSubtree ? buildHandler('subtree') : undefined,
    indexNdjson: options.runtime.resolveIndexNdjson ? buildHandler('indexNdjson') : undefined,
    search: options.runtime.resolveSearch ? buildHandler('search') : undefined,
    linkHeaderMiddleware: actLinkHeaderMiddleware({ basePath: options.basePath }),
  };
}
```

### Pattern 2 — Identity hook with NextAuth (PRD-501-R6)

```typescript
import { getToken } from 'next-auth/jwt';
import type { IdentityResolver } from '@act/runtime-core';

export const identityResolver: IdentityResolver = async (actRequest) => {
  // Reuse the WHATWG Request for getToken — it expects a Request-like object.
  const token = await getToken({
    req: { headers: Object.fromEntries(actRequest.headers.entries()) } as any,
    secret: process.env.NEXTAUTH_SECRET!,
  });
  if (!token) return { kind: 'auth_required', reason: 'missing' };
  // PRD-103-R6 / PRD-500-R6: stable identity key. The 'sub' claim is the user ID,
  // NOT the session token. The session token rotates on refresh; the user ID does not.
  return { kind: 'principal', key: token.sub! };
};
```

### Pattern 3 — Tenant hook from subdomain (PRD-501-R7)

```typescript
import type { TenantResolver } from '@act/runtime-core';

export const tenantResolver: TenantResolver = async (actRequest, identity) => {
  if (identity.kind !== 'principal') return { kind: 'single' };
  // Subdomain: acme.app.example.com -> 'acme'
  const host = actRequest.url.hostname;
  const subdomain = host.split('.')[0];
  // The host MUST sanitize and validate; here we look up against the tenants table.
  const tenant = await db.tenants.findUnique({ where: { slug: subdomain } });
  if (!tenant) return { kind: 'single' };
  // PRD-500-R7 / PRD-100-R15: stable opaque key.
  return { kind: 'scoped', key: tenant.id };
};
```

### Pattern 4 — Hybrid mount with `basePath` (PRD-501-R8 / R18)

```typescript
// app/app/act-mount.ts (note the duplication: app router 'app/' + URL '/app')
import { defineActMount } from '@act/runtime-next';

export const actMount = defineActMount({
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
  basePath: '/app',
  runtime: { /* ... */ },
  identityResolver: /* ... */,
});
```

```typescript
// app/app/.well-known/act.json/route.ts
import { actMount } from '@/app/app/act-mount';
export const GET = actMount.manifest;
// Effective URL: /app/.well-known/act.json
```

A parent manifest at `/.well-known/act.json` (served by a sibling generator, e.g., PRD-405) declares the mount per PRD-100-R7.

### Pattern 5 — Error-mapping wiring (PRD-501-R13 / R14)

```typescript
import { createActRuntime, buildAuthChallenges } from '@act/runtime-core';

// Inside the SDK's dispatch (delegated to PRD-500's ActRuntimeInstance.dispatch):
function buildNextResponseFor401(manifest: Manifest): Response {
  const challenges = buildAuthChallenges(manifest);  // PRD-500-R14
  const headers = new Headers({
    'Content-Type': 'application/act-error+json; profile=runtime',
    'Link': '</.well-known/act.json>; rel="act"; type="application/act-manifest+json"; profile="runtime"',
  });
  // PRD-501-R13: one WWW-Authenticate per advertised scheme, in order.
  for (const challenge of challenges) {
    headers.append('WWW-Authenticate', challenge);
  }
  return new Response(
    JSON.stringify({
      act_version: '0.1',
      error: {
        code: 'auth_required',
        message: 'Authentication required to access this resource.',
      },
    }),
    { status: 401, headers },
  );
}
```

### Pattern 6 — Discovery hand-off middleware for non-ACT routes (PRD-501-R17)

```typescript
// middleware.ts (Next.js root middleware)
import { NextResponse } from 'next/server';
import { actLinkHeaderMiddleware } from '@act/runtime-next';

const linkHeader = actLinkHeaderMiddleware({
  isAuthenticated: (req) => req.cookies.has('next-auth.session-token'),
});

export function middleware(req: Request) {
  const res = NextResponse.next();
  return linkHeader(req, res);  // appends Link header if isAuthenticated
}

export const config = {
  // Skip ACT endpoints (the SDK already emits the Link header on those) and Next internals.
  matcher: '/((?!\\.well-known/act\\.json|act/|api|_next/static|_next/image|favicon\\.ico).*)',
};
```

The middleware augments authenticated HTML page responses with the Link header so an agent landing on an authenticated page can discover the ACT manifest. PRD-106-R23's broader scope is satisfied without the SDK reaching outside ACT endpoints.

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft. Status: In review. Implements PRD-500's runtime SDK contract on Next.js. Specifies App Router Route Handler factory (`createActHandler`), aggregate mount declaration (`defineActMount`), canonical mount paths (`app/.well-known/act.json/route.ts`, `app/act/n/[...id]/route.ts`, etc.), catch-all `[...id]` requirement for IDs containing `/` (PRD-100-R10), identity / tenant hook patterns for NextAuth / JWT / header-based service identity, `basePath` for hybrid mounts (PRD-100-R7 / PRD-106-R17–R22), discovery hand-off Link header on every dispatched response + `actLinkHeaderMiddleware` for non-ACT routes (PRD-106-R23 / PRD-500-R29), Pages Router fallback as a documented escape hatch (PRD-501-R20), Edge Runtime / Node.js Runtime parity (PRD-501-R19). Cites PRD-500 (parent contract), PRD-100 / PRD-103 / PRD-106 / PRD-107 / PRD-108 / PRD-109. Gates PRD-705 (B2B SaaS workspace) and PRD-706 (hybrid example). Test fixtures aligned with `fixtures/500/`. No new schemas. Per decision Q3, first-party TS reference impl for v0.1. |
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review. Decisions: (1) ratify `actLinkHeaderMiddleware()` Next.js middleware export with host-supplied cheap `isAuthenticated` predicate (Q1 yes); (2) defer Next.js `revalidate`/`tags` cache-primitive integration (Q2 no — two-source-of-truth risk); (3) no Next.js version auto-detection (Q3 no — App Router 14+ is the reference baseline); (4) no `runtime: "edge" \| "nodejs"` flag on `defineActMount` (Q4 no — runtime is a route-file property, SDK is WHATWG-fetch-clean). Ratified judgment calls: catch-all `[...id]` mandatory (R4), `basePath` mount mechanism consistent with PRD-500 / PRD-502 / PRD-505 (R8), discovery hand-off Link header on every ACT response + middleware export for non-ACT (R17). No normative requirement text changed; only Open Questions section. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
