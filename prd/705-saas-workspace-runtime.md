# PRD-705 — B2B SaaS workspace (runtime ACT, Next.js)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

Every named B2B SaaS partner candidate for ACT (Linear, Notion, Front, Intercom-style products) has the same shape: a workspace per customer tenant, private documents addressable by stable IDs, an authenticated session driving every page load, and content that cannot be statically prebuilt because the per-user view is a function of (a) the tenant the principal belongs to, (b) the principal's role within that tenant, and (c) document-level ACLs computed at fetch time. The static-export PRDs (PRD-105, PRD-401–PRD-409) cannot serve this shape — there is no public surface to enumerate. The runtime profile (PRD-106), the runtime SDK contract (PRD-500), and its Next.js leaf (PRD-501) collectively *can* serve this shape, and the security PRD (PRD-109) constrains how. But there is no reference example tying them together: no end-to-end build that demonstrates a Next.js App Router host wiring `defineActMount`, an `IdentityResolver` driven by NextAuth-style cookies, a `TenantResolver` deriving the tenant from the principal's database row, ETag derivation that includes the tenant key per PRD-103-R6, `Cache-Control: private, must-revalidate` per PRD-106-R12, and the cross-tenant scoping invariant from PRD-109-R11 / R13 verified end-to-end. PRD-700–704 are static-only; PRD-707 is also static. PRD-705 is the first runtime example, and it is the one PRD-706 (hybrid) builds on.

The example serves a small Notion-style workspace: each customer tenant has a flat list of documents (10–500 per tenant, typical), each document has a title, summary, and prose body. The site is exclusively runtime-served — there is no static portion. A handful of programmatic-adapter-emitted nodes (PRD-208) cover deployment-wide reference content (a public "what is this workspace" landing node served unauthenticated to anonymous principals); the bulk of content is per-tenant private. Conformance: **Standard** — the example exercises the runtime auth surface, per-tenant ETag derivation, and the subtree endpoint, but does NOT mint NDJSON, search, or `marketing:*` blocks (which would push it to Plus). The runtime profile is what's exercised; the level is Standard, demonstrating PRD-107-R4's orthogonality.

### Site description

- **What's being built.** A reference Next.js 14 App Router application named `act-saas-workspace` that runs as a multi-tenant document workspace. Each tenant has 10–500 private documents. There is one public landing node (the "About this workspace" page) served unauthenticated.
- **Content shape.** Per-tenant private nodes of type `article` (PRD-100), with `title`, `summary`, and a single `prose` content block (PRD-102). One public-tenant node served anonymously. No `marketing:*` blocks, no NDJSON index, no search.
- **Scale.** Expected 10–500 documents per tenant, 10–1,000 tenants per deployment. Expected runtime traffic per replica: 5–20 RPS sustained for ACT endpoints, occasional bursts to 50 RPS during agent crawl. Each authenticated request goes through `IdentityResolver` (cookie validation, ~5ms) + `TenantResolver` (DB lookup, cached per request, ~1ms after warm cache) + `resolveNode` (DB lookup, ~3–10ms). Total per-request budget: ~15–25ms p50 cold, <5ms when 304-cacheable.
- **Static vs runtime.** Runtime only. No build-time static ACT files emitted. `delivery: "runtime"` per PRD-106-R25.
- **Conformance target.** Standard (justified below).

### Goals

1. Demonstrate end-to-end PRD-501 wiring: `defineActMount`, the canonical App Router file layout (`app/.well-known/act.json/route.ts`, `app/act/index.json/route.ts`, `app/act/n/[...id]/route.ts`, `app/act/sub/[...id]/route.ts`), and the catch-all `[...id]` segment for IDs containing `/` (PRD-501-R4).
2. Demonstrate per-tenant scoping: `TenantResolver` derives the tenant from the authenticated principal's database row; every `resolveIndex` / `resolveNode` / `resolveSubtree` query is filtered by `(identity, tenant)`; cross-tenant reads return `{ kind: "not_found" }` per PRD-500-R18 / PRD-109-R3.
3. Demonstrate per-tenant ETag derivation: ETags incorporate the tenant key per PRD-103-R6 so the same document ID under different tenants yields different ETags, and a 304 response under tenant A cannot be replayed under tenant B.
4. Demonstrate `Cache-Control: private, must-revalidate` per PRD-106-R12 with `Vary: Cookie` so intermediaries do not cross-pollute principals.
5. Demonstrate the discovery hand-off Link header on every authenticated page response via `actLinkHeaderMiddleware()` per PRD-501-R17, mounted in `middleware.ts`.
6. Demonstrate the security-test acceptance criterion: validator-driven probe that user A cannot resolve user B's nodes, with the probe wired against `fixtures/705/`.
7. Validate clean against PRD-600 in runtime-walk mode with credentials injected, with `achieved.level` matching `declared.level: "standard"`.

### Non-goals

1. **NDJSON index, search, marketing blocks, or i18n.** Plus territory; PRD-706 covers the full Plus surface.
2. **Static export of any portion.** Runtime-only.
3. **Hybrid mounts.** Single mount at root. PRD-706 covers `mounts`.
4. **MCP bridge.** PRD-706 covers it.
5. **Defining the runtime SDK contract or the security threat model.** Owned by PRD-500 and PRD-109.
6. **Demonstrating subscription / change-feed runtime endpoints.** Deferred per PRD-106 non-goal #7.
7. **A real production-grade auth implementation.** The example uses a sketch NextAuth-style cookie validator. Real deployments substitute their own auth.
8. **Validating the search response body.** Out of scope per decision Q13; the example does not advertise `search_url_template`.

### Stakeholders / audience

- **Authors of:** the implementer in Phase 6 who builds `examples/705-saas-workspace` from this PRD; PRD-706's author who composes 705's runtime patterns with static and MCP surfaces.
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The example wires `Identity.key` to the session cookie value rather than the principal's stable user ID, defeating ETag stability and leaking PII into ETag inputs. | Medium | High | PRD-705-R6 mandates the canonical NextAuth-style `Identity.key = token.sub` pattern; PRD-501-R6 and PRD-500-R6 are cited. The negative fixture `fixtures/705/negative/identity-key-leaks-cookie.json` demonstrates the failure mode. |
| Cross-tenant scoping bug: the example's `resolveNode` query forgets to filter by `tenantId`, allowing a tenant-A principal to read tenant-B documents. | Medium | Catastrophic | PRD-705-R8 mandates that every `resolveIndex` / `resolveNode` / `resolveSubtree` query include `tenantId` in its WHERE clause; PRD-705-R20 is the security-test acceptance criterion citing PRD-109-R11 / R13. |
| ETag derivation includes `principal.id` (rather than `tenant.key`) and becomes a cross-user correlation vector. | Medium | High | PRD-705-R10 mandates ETag input is `(content, tenant.key)`, NOT `(content, principal.id)`. Two principals in the same tenant viewing the same document MUST receive byte-identical ETags. PRD-103-R6 / PRD-109-R11 cited. |
| `Cache-Control: public` accidentally set on auth-scoped responses, allowing CDN cross-tenant pollution. | Medium | Catastrophic | PRD-705-R11 mandates `Cache-Control: private, must-revalidate` and `Vary: Cookie` on every authenticated response; PRD-501-R12 delegates to PRD-500-R22; the example's `act-mount.ts` does NOT override the default. |
| Anonymous public-tenant node leaks through the auth-required code path. | Low | Medium | PRD-705-R12 mandates a single explicit branch in `resolveNode` for the public landing node ID, returning `{ kind: "ok" }` without invoking the tenant filter; the path is fixture-tested. |
| The discovery hand-off Link header's `isAuthenticated` predicate runs full identity verification on every page load (expensive). | Medium | Medium | PRD-705-R13 mandates the predicate is a fast cookie-presence check; PRD-501-R17 is cited. |
| Auth challenge headers vary by request, leaking existence. | Low | Medium | PRD-705-R9 mandates the auth challenge set is computed once at module load (PRD-501-R13 / PRD-106-R8); the example registers `auth.schemes: ["cookie", "bearer"]` and the SDK builds challenges from the manifest. |
| The validator's runtime-walk mode cannot probe per-tenant scoping without credentials. | High | Medium | PRD-705-R18 mandates the example ships a fixture-injection harness (`scripts/probe.ts`) that issues authenticated requests with two distinct test-principal cookies (representing tenants A and B) and verifies cross-tenant 404 byte-equivalence; PRD-600-R32 is cited. |

### Open questions

1. Should the example include a `resolveSubtree` implementation? **Tentative yes (Standard).** A Standard-target example with no subtree resolver would fail `PRD-501-R21` at module load. Encoded at PRD-705-R14. Resolved here.
2. Should the example demonstrate a programmatic adapter (PRD-208) for the public landing node, or hand-code it inline in `resolveNode`? **Tentative inline.** The runtime resolver already has full control over the response; introducing a build-time programmatic adapter for one node muddles the example. PRD-208 is the dependency only insofar as the resolver borrows the `defineProgrammaticAdapter` shape; the example does not invoke a build-time pipeline. Resolved at PRD-705-R12.
3. Should the example expose a `resolveManifest` that varies by identity (e.g., omitting `subtree_url_template` for unauthenticated callers)? **Tentative no.** The manifest is identity-independent in v0.1; capability advertisement is global per PRD-501-R9. Per-identity manifest variation would be a Plus-shaped extension and is out of scope. Resolved.
4. **Possible PRD-501 ambiguity.** PRD-501-R9 step 3 says "identity is `null` for the manifest endpoint by default unless the host overrides," but does not specify *how* the host overrides — there is no documented `manifestIdentityScope` config knob, and `resolveManifest` itself receives an `Identity` per PRD-500-R3. The implication is that to make the manifest identity-scoped a host returns different `value` objects from `resolveManifest` based on `ctx.identity`, but that is not stated normatively. Flagging here for the BDFL; the example does NOT exercise this corner. Not resolved in PRD-705.
5. Should the example honor `act_version: "0.1"` strictly and reject `act_version: "0.2"` requests with 400 per PRD-501-R11? **Tentative yes (delegated).** PRD-501 already delegates to PRD-500's bounded rejection; the example does not need to add code. Resolved at PRD-705-R7.

### Acceptance criteria

- [ ] Status `In review`; changelog entry dated 2026-05-02 by Jeremy Forsythe is present.
- [ ] Every normative requirement has an ID `PRD-705-R{n}` and a declared conformance level per PRD-107.
- [ ] The Specification section opens with a table citing every P2 PRD this example exercises and the requirement IDs touched.
- [ ] (a) The example builds clean (`pnpm build`) and the runtime serves green (`pnpm start` followed by an authenticated probe of `/.well-known/act.json` returning 200 with `delivery: "runtime"`).
- [ ] (b) PRD-600 validator returns zero `gaps` against the running deployment in `validateSite` runtime-walk mode with credentials injected.
- [ ] (c) The validator's reported `achieved.level` is `"standard"` and matches `declared.level: "standard"`.
- [ ] (d) Every cited P2 PRD has at least one of its requirements exercised (the citation table makes the mapping explicit).
- [ ] (e) **Security-test acceptance.** A two-principal probe demonstrates user A cannot resolve user B's nodes: principal A's request for `doc/{id}` from tenant B's namespace returns 404 with a body byte-identical to a 404 for a non-existent document. Cites PRD-109-R3 / R11 / R13.
- [ ] Implementation notes ship 5–7 short TypeScript snippets (manifest declaration, identity resolver, tenant resolver, resolveIndex with tenant filter, resolveNode with public-node branch, middleware Link header, fixture-driven probe).
- [ ] Test-fixture path layout under `fixtures/705/` enumerated.
- [ ] Versioning & compatibility section classifies each kind of change.
- [ ] Security section cites PRD-109 and documents example-specific deltas.
- [ ] No new JSON Schemas introduced.

---

## Context & dependencies

### Depends on

- **PRD-100** (Accepted) — wire-format envelopes; the example serves manifest, index, node, subtree.
- **PRD-103** (Accepted) — ETag derivation under runtime + per-tenant scoping; the example's ETag inputs include `tenant.key` per PRD-103-R6.
- **PRD-106** (Accepted) — runtime delivery profile; the example satisfies PRD-106-R1 (Core + Standard endpoints), R3–R6 (status codes), R7–R11 (auth), R12 (caching), R13–R15 (URL encoding), R16 (per-tenant ID stability), R23–R25 (discovery hand-off + `delivery: "runtime"`), R26–R30 (error envelope), R31 (Standard subtree).
- **PRD-107** (Accepted) — conformance levels.
- **PRD-108** (Accepted) — versioning policy.
- **PRD-109** (Accepted) — security; especially R3 (404-vs-403 indistinguishability), R5 (auth challenges), R10 (auth orthogonal to level), R11 (per-tenant ETag inputs), R13 (tenant isolation), R14–R15 (no PII in error envelope).
- **PRD-208** (Accepted) — programmatic adapter; cited as a future seam for build-time content but NOT invoked at runtime in v0.1 of this example (per Open Question 2).
- **PRD-500** (Accepted) — runtime SDK contract; the example implements `ActRuntime`.
- **PRD-501** (Accepted) — Next.js runtime SDK; the example consumes `defineActMount` and `actLinkHeaderMiddleware`.
- **PRD-600** (Accepted) — validator; runs against the live runtime in CI per acceptance criterion (b).
- External: [Next.js 14 App Router](https://nextjs.org/docs/app), [NextAuth](https://next-auth.js.org/) (sketched as the auth pattern; not a hard dependency), [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

### Blocks

- **PRD-706** — composes 705's runtime patterns with static and MCP surfaces.

### References

- v0.1 draft: §6.6 (Runtime SDK pattern, Next.js example), §8.6 (B2B SaaS workspace example).
- `prd/000-decisions-needed.md`: Q3 (TS-only first-party for v0.1).
- Prior art: Notion's authenticated workspace shape; Linear's per-workspace API; Front's per-tenant inbox model. None directly adopted; cited for shape.

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) where requirements are imposed. Lowercase "must" and "should" are non-normative prose.

### P2 PRDs cited and exercised

The example composes the following P2 PRDs. Each row names the source PRD, the source requirement IDs the example exercises, and the PRD-705 requirement(s) that bind the example to the implementation.

| Source PRD | Source requirement IDs exercised | Mechanism (this example) | PRD-705 requirement |
|---|---|---|---|
| PRD-100 | R1, R3–R8, R10, R16–R20, R21–R27, R32–R36, R41–R44, R46 | Manifest, index, node, subtree, error envelopes serialized by the SDK; the example registers resolvers that return PRD-100-shaped values. | PRD-705-R3, R5, R14, R16 |
| PRD-103 | R2, R3, R6, R7, R8, R10 | `defaultEtagComputer` over `(content, tenant.key)`; runtime determinism preserved across two probes. | PRD-705-R10 |
| PRD-106 | R1, R3–R6, R7–R11, R12, R13–R15, R16, R23–R25, R26–R30, R31 | Endpoints mounted via `defineActMount`; `WWW-Authenticate` per scheme; `Cache-Control: private, must-revalidate`; `Vary: Cookie`; per-tenant ID stability; runtime Link header; subtree at Standard. | PRD-705-R3, R7, R9, R11, R13, R14, R15 |
| PRD-107 | R1, R3, R4, R6, R8 | `conformance.level: "standard"`, `delivery: "runtime"`; level/profile orthogonality. | PRD-705-R2, R5 |
| PRD-108 | R1, R7, R8 | `act_version: "0.1"`; bounded MAJOR-mismatch rejection delegated to SDK. | PRD-705-R7 |
| PRD-109 | R3, R5, R10, R11, R13, R14, R15 | 404 collapses unauthorized + nonexistent; auth challenges; per-tenant ETag inputs; tenant isolation; no PII in error envelope. | PRD-705-R8, R9, R10, R12, R17, R20 |
| PRD-208 | (cited as future seam; not invoked at runtime) | The example documents how a build-time programmatic adapter could replace the inline public-landing-node branch in v0.2; v0.1 does not invoke. | PRD-705-R12 (note) |
| PRD-500 | R3, R5, R6, R7, R10, R12, R14, R15, R17, R18, R19, R20, R22, R23, R26, R29, R32 | `ActRuntime` registered via `defineActMount`; identity / tenant resolvers; outcome discriminator; ETag computer; Logger; subtree resolver. | PRD-705-R3, R6, R8, R12, R14, R16, R17 |
| PRD-501 | R2, R3, R4, R5, R6, R7, R8, R9, R12, R13, R14, R17, R21, R23 | `defineActMount`; canonical App Router file layout; catch-all `[...id]`; identity / tenant hooks; `actLinkHeaderMiddleware`; subtree handler; fixture-suite parity. | PRD-705-R3, R4, R6, R8, R13, R14, R18 |
| PRD-600 | R1, R3, R8, R9, R10, R11, R32, R33 | Validator runs in `validateSite` runtime-walk mode with credentials injected; per-tenant scoping probed via two-principal harness. | PRD-705-R18, R19, R20 |

### Conformance level

This example targets **Standard**, with `delivery: "runtime"`. Per PRD-107-R4, level and delivery are orthogonal: Standard runtime is a valid combination. The example exercises every Core requirement of PRD-100/103/106/107/109 and the Standard subtree endpoint (PRD-100-R32–R36, PRD-106-R31). It does NOT advertise NDJSON, search, locales, or `marketing:*` blocks.

**Justification for Standard (not Plus):** Plus would require `index_ndjson_url`, `search_url_template`, and (when multi-locale) the `locales` block. The example workspace's content shape — a flat tenant-scoped document list, no search, no marketing surface, single locale — does not justify Plus. The runtime profile is what's being exercised end-to-end; the level is calibrated to the actual content surface. PRD-107-R10 makes the Plus criteria explicit; the example's content surface does not meet them, and inflating the declared level to satisfy a checkbox would violate PRD-107-R14 / R22 (declared > achieved is a validator finding, not a wire-format error, but the example MUST avoid declaring above what it serves). Standard is the smallest band that exercises the runtime auth surface plus subtree.

Per-requirement banding:

- **Core:** PRD-705-R1 (the example's contract is normative), R2 (manifest declaration), R3 (canonical mount layout), R4 (catch-all `[...id]`), R5 (`delivery: "runtime"`), R6 (identity resolver), R7 (act_version pinning), R8 (tenant resolver + filter), R9 (auth challenge wiring), R10 (per-tenant ETag input), R11 (caching headers), R12 (public-tenant branch), R13 (Link header middleware), R15 (Logger no-PII), R16 (error envelope), R17 (404 byte equivalence), R18 (validator probe harness), R19 (acceptance gate: zero gaps), R20 (security-test acceptance).
- **Standard:** PRD-705-R14 (subtree resolver registered).
- **Plus:** _Not applicable — example is Standard._

### Normative requirements

#### Meta

**PRD-705-R1.** **(Core)** This PRD's normative requirements bind the implementer of `examples/705-saas-workspace` to the contract below. The example MUST satisfy every requirement here AND every cited requirement in the table above. The example MUST NOT widen any cited PRD's obligations; conflicts are reported as ambiguities (Open questions §4).

#### Manifest declaration

**PRD-705-R2.** **(Core)** The example's manifest MUST declare:

- `act_version: "0.1"` per PRD-108-R1.
- `site.name` (any non-empty string).
- `delivery: "runtime"` per PRD-106-R25 / PRD-107-R3.
- `conformance: { level: "standard" }` per PRD-107-R1.
- `auth: { schemes: ["cookie", "bearer"] }` per PRD-106-R7. The cookie scheme is the primary path; the bearer scheme is documented for service-identity probes (and for the validator's runtime-walk mode per PRD-600-R32).
- `index_url: "/act/index.json"`, `node_url_template: "/act/n/{id}"`, `subtree_url_template: "/act/sub/{id}"` per PRD-100-R3 / PRD-501-R3.

The manifest MUST NOT declare `index_ndjson_url`, `search_url_template`, or `locales` — those are Plus.

**PRD-705-R3.** **(Core)** The example MUST mount `defineActMount` with `basePath: ""` (root mount) per PRD-501-R3 / R8. The canonical App Router file layout is:

```
app/
├── .well-known/act.json/route.ts   # GET = handlers.manifest
├── act/
│   ├── index.json/route.ts         # GET = handlers.index
│   ├── n/[...id]/route.ts          # GET = handlers.node
│   └── sub/[...id]/route.ts        # GET = handlers.subtree
├── act-mount.ts                    # defineActMount({ ... })
└── middleware.ts                   # actLinkHeaderMiddleware
```

The single-segment dynamic form (`[id]`) MUST NOT be used per PRD-501-R4.

**PRD-705-R4.** **(Core)** The example's node IDs MUST follow the form `doc/{database-uuid}` for tenant-private documents and `public/landing` for the single anonymous-readable node. IDs are stable per PRD-106-R16 / PRD-100-R15: the database UUID is the persistent primary key; tenancy moves are NEW IDs (the old ID becomes 404 per PRD-106-R16).

**PRD-705-R5.** **(Core)** The manifest's `delivery` field MUST be `"runtime"` and MUST NOT be omitted; if the host's `resolveManifest` omits `delivery`, the SDK injects `"runtime"` per PRD-501-R9 / PRD-500-R8, but the example MUST set it explicitly to make the contract self-evident in code review.

#### Identity and tenant resolution

**PRD-705-R6.** **(Core)** The example's `IdentityResolver` MUST satisfy PRD-501-R6 / PRD-500-R6:

- Read the session cookie via `req.getCookie("session")` (the example uses a sketch NextAuth-style cookie; real deployments substitute their own).
- Validate the cookie against a session store and recover the principal's stable database `user.id`.
- Return `{ kind: "principal", key: principal.id }` on success, `{ kind: "auth_required", reason: "missing" }` when the cookie is absent, `{ kind: "auth_required", reason: "invalid" }` when the cookie fails validation.
- For the bearer-scheme path, read `req.headers.get("authorization")`, parse the `Bearer <token>` form, validate against the session store, and return the same shape.

The `Identity.key` MUST be the principal's stable database `user.id` (or the JWT `sub` claim), NOT the session cookie value or the bearer token. PRD-501-R6 risk row + PRD-500-R6 + PRD-109-R11 are cited.

**PRD-705-R7.** **(Core)** The example MUST honor PRD-501-R11's bounded MAJOR-mismatch rejection: when a request declares an `act_version` whose MAJOR exceeds 0, the SDK returns 400 with `error.code: "validation"` and `details.reason: "act_version_unsupported"` per PRD-500-R30 / PRD-108-R8. The example does not add code for this — the behavior is delegated entirely to the SDK — but the example's runtime probe (PRD-705-R18) MUST exercise the path.

**PRD-705-R8.** **(Core)** The example's `TenantResolver` MUST satisfy PRD-501-R7 / PRD-500-R7:

- For `{ kind: "principal" }` identities: look up the principal's tenancy in the database (`SELECT tenant_id FROM users WHERE id = $1`); return `{ kind: "scoped", key: tenant_id }`.
- For `{ kind: "anonymous" }` identities (unauthenticated calls allowed for the public landing node): return `{ kind: "single" }` per PRD-500-R7's anonymous default.

Every `resolveIndex`, `resolveNode`, `resolveSubtree` query MUST filter by `tenantId = ctx.tenant.kind === "scoped" ? ctx.tenant.key : null`. Forgetting the filter is the catastrophic-impact risk; PRD-705-R20 is the acceptance criterion that proves the filter is in place. PRD-109-R11 / R13 cited.

#### Authentication challenges

**PRD-705-R9.** **(Core)** The 401 response MUST emit one `WWW-Authenticate` header per advertised scheme in `auth.schemes` order, computed once at module load per PRD-501-R13 / PRD-106-R8. The example's manifest declares `auth.schemes: ["cookie", "bearer"]`, so a 401 carries:

```
WWW-Authenticate: Cookie realm="acme-workspace"
WWW-Authenticate: Bearer realm="acme-workspace"
```

The set MUST NOT vary per request URL — varying would create an existence oracle (PRD-109-R8). The SDK enforces this by computing the challenge set once at `defineActMount` construction.

#### ETag derivation and caching

**PRD-705-R10.** **(Core)** The example MUST use `defaultEtagComputer` per PRD-501-R12 / PRD-500-R20 / PRD-103-R6, which derives the ETag from the canonical-JCS bytes of `(payload, tenant.key)`. The example MUST NOT register a custom `etagComputer`. The implication:

- Two principals in the same tenant viewing the same document receive byte-identical ETags (the principal ID is NOT in the input).
- The same document viewed under different tenants yields different ETags (the tenant key IS in the input).
- A 304 response under tenant A MUST NOT validate under tenant B; the validator's runtime-walk mode probes this per PRD-705-R18.

PRD-103-R6 / PRD-109-R11 cited.

**PRD-705-R11.** **(Core)** Every authenticated response MUST carry `Cache-Control: private, must-revalidate` and `Vary: Cookie` per PRD-501-R12 / PRD-106-R12. The example MUST NOT register a custom `Cache-Control` override. The public landing node response MAY carry `Cache-Control: public, max-age=300` (the only place where public caching is permitted per PRD-106-R11), but for v0.1 simplicity the example keeps the same `private, must-revalidate` posture for the public node — which is conservative and safe.

#### Public-tenant branch

**PRD-705-R12.** **(Core)** The example's `resolveNode` MUST handle the public landing node ID (`public/landing`) as a single explicit branch BEFORE the tenant filter:

```ts
if (id === 'public/landing') {
  return { kind: 'ok', value: makePublicLandingNode() };
}
// All other branches require an authenticated principal AND tenant scope.
```

The branch MUST NOT invoke any tenant-filtered query; it returns a hard-coded node per PRD-500-R3. The path is fixture-tested under `fixtures/705/positive/public-landing-anonymous.json`. PRD-208 is cited as the future seam where this branch could be replaced by a build-time programmatic adapter; v0.1 keeps it inline.

#### Discovery hand-off Link header

**PRD-705-R13.** **(Core)** The example's `middleware.ts` MUST register `actLinkHeaderMiddleware` per PRD-501-R17 with an `isAuthenticated` predicate that performs a **fast cookie-presence check only** — `req.cookies.has("session")` — NOT a full session validation. The Link header is a hint, not a security boundary; running full identity verification on every page load would be prohibitively expensive (PRD-501-R17 risk row).

#### Standard tier — subtree

**PRD-705-R14.** **(Standard)** The example MUST register `resolveSubtree` per PRD-501-R21 / PRD-500-R32. The resolver:

- Bounds depth to `[0, 8]` per PRD-100-R33 (default 3 when `?depth=N` is omitted).
- Filters by `tenantId` per PRD-705-R8.
- Returns the subtree envelope per PRD-100-R32–R36.

The example's content tree is shallow (every per-tenant document is a sibling of every other tenant document; depth 1 is the practical maximum), so subtree responses are typically small. The implementation MUST nonetheless honor the depth bound.

#### Logger and structured logging

**PRD-705-R15.** **(Core)** The example MUST register a `Logger` per PRD-501-R16 / PRD-500-R23 / R24 that respects PRD-109-R14 / R15 — no PII (no email addresses, no auth tokens, no cookie values, no node body content) reaches the log. The recommended logger for the example is a `pino`-shaped wrapper.

#### Error envelope shape

**PRD-705-R16.** **(Core)** The example MUST emit error envelopes per PRD-100-R41–R44 / PRD-106-R26–R30 / PRD-501-R14. The SDK serializes the envelope from the `Outcome<T>` discriminator; the example MUST NOT propagate Next.js-specific exception text into `error.message`. The fixed code-specific strings of PRD-500-R17 are used verbatim.

**PRD-705-R17.** **(Core)** The example MUST preserve PRD-109-R3 / PRD-500-R18: a 404 response for a non-existent document and a 404 response for a tenant-B document accessed by a tenant-A principal MUST be byte-identical (modulo the opaque request ID the SDK MAY echo per PRD-500-R25). The fixture under `fixtures/705/positive/cross-tenant-404-byte-equivalence.json` records the expected response bytes; the validator probe in PRD-705-R18 verifies.

#### Validator probe harness

**PRD-705-R18.** **(Core)** The example MUST ship a probe harness at `examples/705-saas-workspace/scripts/probe.ts` that:

1. Boots the Next.js runtime locally (`pnpm start &`).
2. Issues a request against `/.well-known/act.json` with no credentials, asserts 401 with two `WWW-Authenticate` headers per PRD-705-R9. (Note: the manifest endpoint itself MAY be served unauthenticated per the example operator's choice; the example serves it authenticated to keep the surface uniformly auth-scoped, except for the public landing node fetched via `/act/n/public/landing`.)
3. Issues a request against `/act/n/public/landing` with no credentials, asserts 200 with the public landing payload.
4. Issues an authenticated request as principal A (tenant A), retrieves a document ID, asserts 200, captures the ETag.
5. Issues an `If-None-Match` follow-up as principal A with the captured ETag, asserts 304 with no body and the same ETag.
6. Issues a request as principal B (tenant B) for principal A's document ID, asserts 404 with body byte-identical to a 404 for a non-existent ID.
7. Issues a request as principal A for a non-existent document ID, asserts 404 with body byte-identical to step 6.
8. Issues a request as principal B (tenant B) with principal A's captured ETag in `If-None-Match`, asserts the response is NOT a 304 (the ETag MUST NOT validate under tenant B per PRD-705-R10).

The harness drives `@act/validator`'s `validateSite` in runtime-walk mode per PRD-600-R11 / R32, with credentials injected via the `--bearer` or `--cookie` flag per PRD-600-R26.

**PRD-705-R19.** **(Core)** The example MUST gate CI on `validateSite` returning zero `gaps` AND `achieved.level: "standard"` AND `achieved.delivery: "runtime"` AND `declared` matching `achieved`. PRD-107-R16–R22 cited.

**PRD-705-R20.** **(Core)** The example's CI MUST gate on the security-test from PRD-705-R18 steps 6, 7, 8 passing — the cross-tenant 404 byte-equivalence probe AND the cross-tenant ETag non-validation probe. Failure of any step is a release blocker. PRD-109-R3 / R11 / R13 cited. **This is the security-test acceptance criterion for PRD-705 per the workflow.md Phase 4 prompt.**

### Wire format / interface definition

_Not applicable — PRD-705 is a reference example consuming the wire formats defined by PRD-100, PRD-106, PRD-107, and the SDK contracts of PRD-500 / PRD-501. No new schemas or interfaces are introduced._

### Errors

The example inherits the runtime error envelope from PRD-100-R41–R44 / PRD-106-R26–R30 verbatim. The mapping below restates the relevant subset for the example's surface:

| Condition | Status | `error.code` | Notes |
|---|---|---|---|
| Authenticated principal reads own-tenant document | 200 | n/a | Honors `If-None-Match` → 304 per PRD-501-R12 |
| Unauthenticated request to `/act/index.json` or `/act/n/{tenant-id}` | 401 | `auth_required` | Two `WWW-Authenticate` headers per PRD-705-R9 |
| Unauthenticated request to `/act/n/public/landing` | 200 | n/a | Public-tenant branch per PRD-705-R12 |
| Authenticated principal A reads tenant-B document ID | 404 | `not_found` | Byte-identical to non-existent-document 404 per PRD-705-R17 |
| Authenticated principal A reads non-existent document ID | 404 | `not_found` | |
| Request with `act_version: "1.0"` (or any future MAJOR > 0) | 400 | `validation` | `details.reason: "act_version_unsupported"` per PRD-705-R7 |
| Server error in resolver | 500 | `internal` | No PII in `error.message` per PRD-705-R15 / R16 |

---

## Examples

Examples are non-normative but consistent with the Specification.

### Example 1 — Manifest declaration

```ts
// app/act-mount.ts
import { defineActMount } from '@act/runtime-next';
import { runtime } from '@/lib/act-runtime';
import { identityResolver, tenantResolver, logger } from '@/lib/act-host';

export const actMount = defineActMount({
  manifest: {
    act_version: '0.1',
    site: { name: 'Acme Workspace' },
    delivery: 'runtime',
    conformance: { level: 'standard' },
    auth: { schemes: ['cookie', 'bearer'] },
    index_url: '/act/index.json',
    node_url_template: '/act/n/{id}',
    subtree_url_template: '/act/sub/{id}',
    capabilities: { etag: true, subtree: true },
  },
  runtime,
  identityResolver,
  tenantResolver,
  logger,
});
```

### Example 2 — Identity resolver (NextAuth-style)

```ts
// lib/act-host/identity.ts
import type { IdentityResolver } from '@act/runtime-core';
import { validateSession } from '@/lib/auth';

export const identityResolver: IdentityResolver = async (req) => {
  const cookie = req.getCookie('session');
  if (!cookie) return { kind: 'auth_required', reason: 'missing' };
  const session = await validateSession(cookie);
  if (!session) return { kind: 'auth_required', reason: 'invalid' };
  return { kind: 'principal', key: session.userId };
};
```

### Example 3 — Tenant resolver

```ts
// lib/act-host/tenant.ts
import type { TenantResolver } from '@act/runtime-core';
import { db } from '@/lib/db';

export const tenantResolver: TenantResolver = async (req, identity) => {
  if (identity.kind !== 'principal') return { kind: 'single' };
  const user = await db.users.findUnique({ where: { id: identity.key } });
  if (!user) return { kind: 'single' };
  return { kind: 'scoped', key: user.tenantId };
};
```

### Example 4 — `resolveNode` with public-tenant branch

```ts
// lib/act-runtime/resolve-node.ts
export const resolveNode: ActRuntime['resolveNode'] = async (req, ctx, { id }) => {
  if (id === 'public/landing') {
    return { kind: 'ok', value: PUBLIC_LANDING_NODE };
  }
  if (ctx.identity.kind !== 'principal') return { kind: 'auth_required' };
  if (ctx.tenant.kind !== 'scoped') return { kind: 'not_found' };
  const dbId = id.replace(/^doc\//, '');
  const doc = await db.documents.findUnique({
    where: { id: dbId, tenantId: ctx.tenant.key }, // PRD-705-R8 — tenant filter MUST be present
  });
  if (!doc) return { kind: 'not_found' }; // covers absent + forbidden identically (PRD-705-R17)
  return {
    kind: 'ok',
    value: {
      act_version: '0.1',
      id,
      type: 'article',
      title: doc.title,
      summary: doc.summary,
      content: [{ type: 'prose', text: doc.body }],
      tokens: { summary: 12, body: estimateTokens(doc.body) },
      etag: '', // SDK injects via defaultEtagComputer over (payload, tenant.key)
    },
  };
};
```

### Example 5 — Discovery hand-off middleware

```ts
// middleware.ts
import { actLinkHeaderMiddleware } from '@act/runtime-next';
import { NextResponse } from 'next/server';

const linkHeader = actLinkHeaderMiddleware({
  isAuthenticated: (req) => req.cookies.has('session'), // fast presence check, NOT validation
});

export function middleware(req: Request) {
  const res = NextResponse.next();
  return linkHeader(req, res);
}

export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
};
```

### Example 6 — Cross-tenant 404 byte-equivalence (probe transcript)

```http
# Principal A (tenant A) reads tenant-B document ID:
GET /act/n/doc/bbbb-tenant-b-document HTTP/1.1
Cookie: session=principal-a

HTTP/1.1 404 Not Found
Content-Type: application/act-error+json; profile=runtime
Link: </.well-known/act.json>; rel="act"; type="application/act-manifest+json"; profile="runtime"

{"act_version":"0.1","error":{"code":"not_found","message":"Resource not found."}}
```

```http
# Principal A reads a non-existent document ID:
GET /act/n/doc/zzzz-does-not-exist HTTP/1.1
Cookie: session=principal-a

HTTP/1.1 404 Not Found
Content-Type: application/act-error+json; profile=runtime
Link: </.well-known/act.json>; rel="act"; type="application/act-manifest+json"; profile="runtime"

{"act_version":"0.1","error":{"code":"not_found","message":"Resource not found."}}
```

The two response bodies MUST be byte-identical. PRD-705-R20 gates CI on this.

---

## Test fixtures

Fixtures live under `fixtures/705/` and are exercised by the validator (PRD-600) plus the example's own probe harness (PRD-705-R18).

### Positive

- `fixtures/705/positive/manifest-standard-runtime.json` → manifest declaring `level: "standard"`, `delivery: "runtime"`, with the example's full field set. Satisfies PRD-705-R2.
- `fixtures/705/positive/index-tenant-a.json` → index envelope as seen by principal A (tenant A), listing tenant-A documents only. Satisfies PRD-705-R8.
- `fixtures/705/positive/index-tenant-b.json` → index envelope as seen by principal B (tenant B), listing tenant-B documents only. Disjoint from tenant-A.
- `fixtures/705/positive/node-tenant-a-doc.json` → node envelope for a tenant-A document fetched by principal A. ETag is a function of `(payload, "tenant-a-key")`.
- `fixtures/705/positive/public-landing-anonymous.json` → node envelope for `public/landing` fetched without credentials. Satisfies PRD-705-R12.
- `fixtures/705/positive/subtree-tenant-a.json` → subtree envelope at depth 1 from a tenant-A root. Satisfies PRD-705-R14.
- `fixtures/705/positive/304-tenant-a.txt` → HTTP transcript: principal A's `If-None-Match` against the prior ETag returns 304 with the same `ETag` and no body. Satisfies PRD-705-R10.
- `fixtures/705/positive/cross-tenant-404-byte-equivalence.json` → recorded byte-identical 404 bodies for the two probe paths in Example 6. Satisfies PRD-705-R17 / R20.

### Negative

- `fixtures/705/negative/identity-key-leaks-cookie.json` → an `IdentityResolver` that returns the session cookie value as `Identity.key`. The validator's runtime-walk mode SHOULD detect that two consecutive requests yield different ETags despite identical content (cookie rotation rotates the ETag input). MUST emit a `gaps` entry citing PRD-103-R6 / PRD-109-R11.
- `fixtures/705/negative/cross-tenant-leak.json` → a `resolveNode` that omits the `tenantId` filter. Principal A's request for `doc/{tenant-b-id}` returns 200 with tenant-B content. MUST emit a `gaps` entry citing PRD-705-R8 / PRD-109-R13.
- `fixtures/705/negative/cache-control-public.json` → an authenticated response with `Cache-Control: public, max-age=300`. MUST emit a `gaps` entry citing PRD-705-R11 / PRD-106-R12.
- `fixtures/705/negative/etag-validates-cross-tenant.json` → principal B's `If-None-Match` against principal A's ETag returns 304. MUST emit a `gaps` entry citing PRD-705-R10 / PRD-103-R6.
- `fixtures/705/negative/missing-subtree-resolver.json` → manifest declares `level: "standard"` but `defineActMount` is constructed without `resolveSubtree`. The SDK MUST throw at module load per PRD-501-R21 / PRD-500-R10. The fixture asserts the build fails.
- `fixtures/705/negative/identity-leaks-into-error.json` → an `error.message` containing the principal's email address. MUST emit a `gaps` entry citing PRD-705-R15 / PRD-109-R14.

---

## Versioning & compatibility

Per PRD-108, classify each kind of change to PRD-705 as MAJOR or MINOR.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a new normative requirement (e.g., a new acceptance criterion) | MINOR if additive optional; MAJOR if it widens the example's contract | Per PRD-108. Most additions to an example PRD are optional surface. |
| Promote the example from Standard to Plus | MAJOR | The declared level is part of the example's contract. |
| Demote the example from Standard to Core | MAJOR | Same reasoning. |
| Remove a cited P2 PRD from the example (e.g., drop PRD-208 entirely) | MAJOR if the citation was load-bearing | PRD-208 is cited as a future seam only; removing the citation is MINOR. |
| Add a new test fixture | MINOR | Fixtures are additive. |
| Change the manifest field set in the worked example | MAJOR if it changes the declared level's contract; MINOR otherwise | Adding optional fields is MINOR. |
| Tighten a SHOULD to a MUST | MAJOR | Per PRD-108. |
| Loosen a MUST to a SHOULD | MAJOR | Per PRD-108. |
| Update the example to a newer Next.js major version | MAJOR if it requires example consumers to migrate; MINOR if it's source-compatible | Next.js 14 is the v0.1 reference baseline; consumers on Next.js 15 are best-effort. |

### Forward compatibility

A future ACT MINOR (e.g., the addition of an optional manifest field) does not require the example to change. Per PRD-108-R7, consumers tolerate unknown optional fields; the example's manifest does not introduce any.

### Backward compatibility

The example pins `act_version: "0.1"`. A future v0.2 example would supersede this PRD; the v0.1 example remains as a reference for the v0.1 spec revision. There is no deprecation window for example-PRD changes — examples are reference-only and not part of the wire-format compatibility surface.

---

## Security considerations

Security is the dominant concern of PRD-705. The example exists to demonstrate that PRD-109's threat model is satisfiable in a realistic Next.js runtime deployment. PRD-109 is the project-wide reference; the deltas below are example-specific.

- **Per-tenant scoping (PRD-109-R11 / R13).** The dominant threat. PRD-705-R8 and PRD-705-R20 (the security-test acceptance criterion) collectively prove that the `tenantId` filter is present in every tenant-scoped resolver query AND that the validator's two-principal probe verifies cross-tenant 404 byte-equivalence. Failure of any probe is a release blocker.
- **ETag inputs (PRD-109-R11 / PRD-103-R6).** The ETag input MUST include `tenant.key` and MUST NOT include `principal.id`. PRD-705-R10 is the binding requirement; the negative fixture `etag-validates-cross-tenant.json` proves a faulty implementation is detected.
- **404-vs-403 indistinguishability (PRD-109-R3 / PRD-500-R18).** PRD-705-R17 binds the example to byte-equivalence; the fixture `cross-tenant-404-byte-equivalence.json` records the exact response bytes.
- **Auth challenge determinism (PRD-109-R5 / PRD-106-R8).** PRD-705-R9 binds the example to a manifest-derived challenge set computed once at module load. Per-request challenge variation is forbidden.
- **PII in errors (PRD-109-R14 / R15).** PRD-705-R15 / R16 forbid PII in `error.message` and `error.details`. The Logger receives the redacted shape per PRD-500-R23.
- **Session cookie as Identity.key (PRD-109-R11 + PRD-501-R6 risk).** The example's `IdentityResolver` MUST extract the principal's stable database `user.id` from the session, NOT the cookie value. The negative fixture `identity-key-leaks-cookie.json` proves a faulty implementation rotates ETags on every session refresh.
- **Cache-Control on auth-scoped responses (PRD-109-R11 + PRD-106-R12).** PRD-705-R11 binds the example to `private, must-revalidate` + `Vary: Cookie`. The negative fixture `cache-control-public.json` proves a faulty implementation.
- **Discovery-hint Link header (PRD-501-R17).** The header is a hint, not a security boundary. PRD-705-R13 binds the predicate to a fast cookie-presence check; running full identity verification on every page load is forbidden as a performance footgun (and would be a self-DoS).
- **Anonymous public-tenant branch.** The single explicit branch in `resolveNode` for `public/landing` is the only path that bypasses the tenant filter. PRD-705-R12 requires the branch to return a hard-coded node, not to invoke any database query — which forecloses a SQL-injection-style escape from the public branch into tenant-scoped data.
- **No information disclosure in `error.details`.** The example MUST NOT echo request paths, IDs, or tenant keys in `error.details`; PRD-109-R15 cited.
- **Origin trust for `mounts`.** The example does not declare `mounts`; the threat is not in scope here. PRD-706 covers it.

---

## Implementation notes

The TypeScript snippets above (Examples 1–5) cover the canonical wiring. Additional implementation notes:

- **Database schema sketch.** The example assumes a `users` table with `(id, tenant_id, email_hash)` and a `documents` table with `(id, tenant_id, title, summary, body, updated_at)`. Indexes on `(tenant_id, id)` for both tables. Real deployments substitute their own schema.
- **`pnpm` scripts.** `pnpm dev` runs Next.js dev; `pnpm build && pnpm start` runs production; `pnpm probe` runs `scripts/probe.ts` (the validator-driven harness from PRD-705-R18); `pnpm test:security` runs the security-test subset (PRD-705-R20 gating).
- **CI integration.** GitHub Actions workflow runs `pnpm build`, boots the runtime in the background, runs `pnpm probe`, and asserts zero `gaps` and `achieved.level: "standard"`. Probe credentials (two test-principal cookies) are seeded into a SQLite test database and rotated per CI run.
- **Validator invocation.** `act-validate site http://localhost:3000 --bearer "$TEST_PRINCIPAL_A_TOKEN" --probe-cross-tenant --bearer-b "$TEST_PRINCIPAL_B_TOKEN"`. The `--probe-cross-tenant` flag is a PRD-600 extension PRD-705-R18 expects (PRD-600-R32 admits it; the deeper schema is implementation-detail).
- **Edge Runtime vs Node.js Runtime.** The example uses the Node.js Runtime (default) because the database client (`@prisma/client` or equivalent) requires Node APIs. PRD-501-R19 documents the trade-off; switching to Edge requires an Edge-compatible database client (e.g., `@neondatabase/serverless`).
- **Subtree implementation note.** The example's content tree is shallow: every per-tenant document is a sibling. The subtree resolver returns at most depth 1 in practice. The implementation still honors the `[0, 8]` bound per PRD-501-R21 — out-of-range requests return `validation: depth_out_of_range` per PRD-500-R32.

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-02 | Jeremy Forsythe | Initial draft. Reference example for the Standard runtime profile on Next.js: a multi-tenant B2B SaaS workspace demonstrating per-tenant scoping, per-tenant ETag derivation, cross-tenant 404 byte-equivalence, and the discovery hand-off Link header, with PRD-600 validator gating in CI. Composes PRD-100, PRD-103, PRD-106, PRD-107, PRD-109, PRD-208 (cited as future seam), PRD-500, PRD-501, PRD-600. Conformance: Standard. Status: Draft → In review. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). PRD-501-R9 manifest identity-scoping ambiguity (Open Q4) accepted as v0.2 candidate; OQ retained in this PRD. |
