# PRD-706 — Hybrid static + runtime + MCP bridge

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

The runtime SDK PRDs (PRD-500 / PRD-501) and the runtime profile (PRD-106) make a runtime ACT deployment achievable, and the static profile + generators (PRD-105 / PRD-401–PRD-409) make a static deployment achievable, but the most realistic real-world topology is neither: it is **hybrid**. A single product surface — say, `acme.com` — has a public marketing site at `/marketing/*` whose content is authored by a content team in a CMS plus markdown files and built at deploy time, and an authenticated app at `/app/*` whose content is per-tenant and resolved per request. Both surfaces should be ACT-discoverable under one well-known manifest. PRD-100-R7 / PRD-106-R17–R22 / PRD-107-R5 collectively pin the `mounts` mechanism that makes this composable: the parent manifest declares two mounts — one `static` over `/marketing`, one `runtime` over `/app` — and consumers select the appropriate mount via longest-prefix matching. Additionally, PRD-602 (ACT-MCP bridge) defines how the same content tree is exposed to MCP clients via a paired server. Operators of B2B SaaS products who already ship MCP servers want the SAME content tree reachable on BOTH protocols without running two parallel implementations and risking drift.

PRD-706 is the reference example tying all three together: a single repository whose deploy artifact is (a) a static ACT for `/marketing/*` built by the standalone CLI (PRD-409) from CMS content + markdown, (b) a runtime ACT for `/app/*` served by the Next.js runtime SDK (PRD-501) on the same hostname, (c) a top-level manifest at `/.well-known/act.json` that declares the two `mounts`, and (d) the MCP bridge (PRD-602) exposing the same tree as MCP resources. PRD-705 is the runtime-only precedent; PRD-706 composes 705's runtime patterns with the static pipeline and the MCP surface. The example exists to prove that the three mechanisms — `mounts`, runtime, MCP — actually compose without conflict, that auth boundaries are coherent across the static (unauthenticated public) and runtime (authenticated tenant-scoped) regions, and that the MCP bridge surfaces the same tree the static + runtime do.

### Site description

- **What's being built.** A reference monorepo named `act-hybrid-saas` with three deployable artifacts:
  1. A static ACT under `/marketing/*` built at deploy time by `@act/cli` (PRD-409) from a Contentful + markdown source set, hosted on the same origin as the runtime app (e.g., on the Next.js host's `public/` directory or as a sibling deployment behind the same CDN).
  2. A runtime ACT under `/app/*` served by `@act/runtime-next` (PRD-501) inside a Next.js 14 App Router application, with `basePath: "/app"` per PRD-501-R8.
  3. An MCP bridge (PRD-602) running as a separate Node process (`@act/mcp-bridge`) that consumes the same `ActRuntime` configured for the runtime app AND a static walker for the marketing tree, exposing both as MCP resources under the `act://` URI scheme.
- **Top-level manifest.** A small parent manifest at `/.well-known/act.json` declares `mounts` for `/marketing` (static) and `/app` (runtime); the parent itself has no `index_url` — it is purely a routing manifest per PRD-100-R7 / PRD-106-R17.
- **Content shape.**
  - **Marketing (static, public, unauthenticated):** ~50–500 nodes — landing pages, feature pages, pricing, blog posts, customer stories. `marketing:*` blocks (hero, feature-grid, pricing-table, testimonial, faq) per PRD-102. NDJSON index emitted. Search endpoint emitted (deferred body envelope per Q13). Single locale for v0.1; multi-locale is a v0.2 amendment.
  - **App (runtime, authenticated, tenant-scoped):** per-tenant private documents (10–500 per tenant). Same shape as PRD-705's workspace. No `marketing:*` blocks, no search, no NDJSON.
- **Scale.** Marketing: build-time emission of 50–500 nodes; CDN-cached; expected agent crawl traffic 10–100 RPS sustained. App: 5–20 RPS sustained per replica, 50 RPS bursts. MCP bridge: 1–10 concurrent MCP sessions (operator-owned scale, not user-driven).
- **Static vs runtime split.** Hybrid via `mounts`. The static portion is `delivery: "static"`; the runtime portion is `delivery: "runtime"`; the parent manifest itself is `delivery: "static"` (a build-time-emitted JSON file).
- **MCP surface.** The bridge exposes the union of marketing nodes and app nodes via `act://acme.com/{id}`. Marketing nodes are public — anonymous MCP clients receive them. App nodes require authenticated MCP sessions; the `IdentityBridge` (PRD-602-R10) maps MCP auth context to ACT identity and tenant.
- **Conformance target.** **Plus** for the marketing static mount; **Standard** for the app runtime mount; the parent manifest inherits no level (it is a routing manifest only). The bridge inherits each mount's level per PRD-602-R9. Plus is the workflow.md-mandated declared target for the hybrid example, justified below.

### Goals

1. Demonstrate `mounts` composability per PRD-100-R7 / PRD-106-R17–R22 / PRD-107-R5: one parent manifest, two mounts (static `/marketing` Plus + runtime `/app` Standard), longest-prefix selection, no overlapping prefixes, no recursion.
2. Demonstrate the static side: PRD-409 (`@act/cli`) builds the marketing tree from PRD-201 (markdown) + PRD-202 (Contentful) adapter outputs, emits Plus-shaped envelopes (NDJSON, search template, `marketing:*` blocks), and ships under `/marketing/*` per PRD-105.
3. Demonstrate the runtime side: PRD-501 (`@act/runtime-next`) serves the app tree per-request with `basePath: "/app"`, per-tenant scoping, ETag derivation per PRD-103-R6, `Cache-Control: private, must-revalidate` per PRD-106-R12 — composing PRD-705's patterns under the `/app` mount.
4. Demonstrate the MCP bridge: PRD-602 (`@act/mcp-bridge`) wraps the same `ActRuntime` plus a static walker for the marketing tree, exposing both as MCP resources under the `act://` URI scheme; resources from the static side are anonymous-readable, resources from the runtime side are auth-gated via `IdentityBridge`.
5. Demonstrate the auth boundary: the static side is unauthenticated (no `auth` block on the marketing mount manifest per PRD-106-R11); the runtime side requires authentication (`auth.schemes: ["cookie", "bearer"]`); the parent manifest is unauthenticated and reveals only routing data; the MCP bridge surfaces both, with anonymous MCP sessions seeing only the static slice.
6. Demonstrate that the static + runtime mounts compose at the top-level manifest without conflict: validator's runtime-walk mode (PRD-600-R11) follows the parent → mounts → leaf manifests path, validates each leaf against its declared level, and reports `achieved.level` per mount.
7. Demonstrate that the MCP bridge surfaces the same tree the static + runtime do: a separate MCP-side probe enumerates resources via `act://acme.com/manifest` (PRD-602-R7) and verifies the union of resource URIs equals the union of static + runtime IDs.
8. Validate clean against PRD-600 with `achieved.level: "plus"` for the marketing mount AND `achieved.level: "standard"` for the app mount, and validate the MCP bridge surfaces the same tree.

### Non-goals

1. **i18n.** Single locale for v0.1. Multi-locale would push the marketing mount's Plus surface to also include the `locales` block (PRD-104); v0.2 amendment.
2. **MCP tools, prompts, completions, subscriptions.** Resources only per PRD-602-R16 / R17 (subscriptions deferred).
3. **Cross-origin mounts.** Both mounts are same-origin under `acme.com`; PRD-106-R22 / PRD-109-R21's cross-origin trust rules are out of example scope.
4. **Defining the wire format, runtime profile, MCP bridge, validator.** Owned by PRD-100, PRD-106, PRD-602, PRD-600.
5. **Defining the static-export pipeline or the standalone CLI.** Owned by PRD-105 / PRD-409.
6. **Defining a real production-grade auth implementation.** The example uses sketch NextAuth-style cookies on the runtime side and a sketch MCP auth context on the bridge side. Real deployments substitute their own.
7. **Validating the search response body.** Out of scope per Q13. The marketing mount advertises `search_url_template` and the endpoint returns 200 JSON; the body itself is opaque-but-JSON per PRD-602-R15 / PRD-501-R22.
8. **Demonstrating PRD-705's full surface a second time.** PRD-706's runtime mount inherits PRD-705's patterns by reference; the requirements below cite PRD-705 rather than restate.

### Stakeholders / audience

- **Authors of:** the implementer in Phase 6 who builds `examples/706-hybrid-saas` from this PRD; partner SaaS adopters evaluating ACT as a single-manifest replacement for ad-hoc llms.txt + MCP server pairs.
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Overlapping mount prefixes — operator declares both `/app` and `/app/admin` as separate mounts. | Medium | High | PRD-706-R5 mandates two mount prefixes only (`/marketing`, `/app`); validator gates per PRD-106-R20. |
| Mount recursion — the marketing leaf manifest itself declares `mounts`. | Low | Medium | PRD-706-R5 mandates leaf manifests have no `mounts`; PRD-106-R18 + PRD-600 enforce. |
| Auth boundary leak — the parent manifest declares `auth` and accidentally requires authentication for unauthenticated marketing access. | Low | Medium | PRD-706-R3 mandates the parent manifest omit the `auth` block (it is a routing manifest only); PRD-706-R7 mandates the marketing leaf manifest omit `auth` per PRD-106-R11. |
| MCP bridge exposes runtime resources to anonymous MCP sessions. | Medium | Catastrophic | PRD-706-R12 binds the bridge's `IdentityBridge` to map anonymous MCP context to anonymous ACT identity, which the runtime resolver rejects with `auth_required`; the bridge maps that to MCP `AUTHENTICATION_REQUIRED` per PRD-602-R14. Validator MCP-side probe (PRD-706-R20) verifies. |
| Drift between static-emitted IDs and MCP-bridge-walked IDs. | Medium | Medium | PRD-706-R13 mandates the bridge consume the static tree via the SAME walker `@act/validator` uses (PRD-600-R11), not a separately-implemented walker. |
| `act://` URI scheme collides with another scheme an MCP client uses. | Low | Medium | PRD-602-R6 reserves `act://`; the example does not introduce additional schemes. |
| Static build pipeline emits Plus-shaped content but the manifest declares Core. | Medium | Low | PRD-706-R8 mandates the marketing manifest declares `level: "plus"`; PRD-409-R2 / PRD-400-R17 compute the achieved level from emitted content; the validator (PRD-600) probes both declared and achieved. |
| Marketing mount's `Cache-Control` is too permissive and CDN caches stale builds for too long. | Medium | Medium | PRD-706-R9 mandates the marketing mount serves `Cache-Control: public, max-age=300, must-revalidate` (5 minute freshness, mandatory revalidation) per PRD-105 — this is a deployment guideline, not a wire-format requirement. |
| Cross-mount linking — a marketing node's `related` array references an app-tree node (or vice versa). | Medium | Low | PRD-706-R17 forbids cross-mount `related` references in v0.1; cross-mount linking is a v0.2 capability. The validator emits a warning if it sees one. |
| MCP bridge advertises Plus capabilities for the marketing mount but Standard for the app mount; clients may receive inconsistent capability flags. | High | Low | PRD-706-R14 mandates the bridge advertise per-mount capabilities by mounting two MCP resources at `act://acme.com/manifest` and `act://acme.com/app/manifest` (or follow the parent manifest's `mounts` array as the bridge's resource graph). Clients reach the per-mount manifest to learn each mount's level. |
| The static marketing build emits ETags that differ between two builds of identical content (e.g., because timestamps leak into the JCS input). | Medium | Medium | PRD-706-R16 mandates PRD-103-R4's static-determinism rule — the JCS input MUST be deterministic across builds. PRD-201 / PRD-202 / PRD-409 each enforce; PRD-706 is the integration test. |

### Open questions

1. Should the example expose a single MCP bridge for both mounts, or two separate bridges? **Tentative single.** PRD-602's bridge consumes one `ActRuntime` plus optionally a static walker; running two bridges would split the resource graph for MCP clients. Encoded at PRD-706-R12. Resolved.
2. How does the bridge handle the parent manifest itself? **Tentative as `act://acme.com/manifest` per PRD-602-R7.** The parent is a routing manifest with no nodes, so the MCP resource at the parent path is the routing manifest itself; clients enumerate per-mount manifests via the `mounts` array. Encoded at PRD-706-R14.
3. Does the static build emit a build-time copy of the parent manifest, or does the runtime application serve it? **Tentative static — emitted by `@act/cli` as part of the marketing build.** The parent manifest is small (a few hundred bytes), changes rarely, and is a build-time artifact. The runtime application has no reason to serve it. Encoded at PRD-706-R3.
4. Should the bridge's MCP-side capability advertisement reflect the union of mount levels (`plus`) or the minimum (`standard`)? **Tentative per-mount, not unified.** A client reading the parent MCP resource sees a routing-manifest shape; clients reading per-mount MCP manifests see each mount's level. Encoded at PRD-706-R14.
5. **Possible PRD-602 ambiguity.** PRD-602-R3 says the bridge MUST validate at construction time that the supplied `ActRuntime` satisfies the level the bridge advertises. But PRD-602 does not normatively address the case where the bridge advertises a *hybrid* tree composed of multiple `ActRuntime`s (or a runtime + a static walker), each at a different level. The bridge's `name` and `version` are configured at construction (PRD-602-R5), but there is no documented `mounts` field on the bridge construction shape. The implication is that the bridge construction must be repeated per mount (one bridge per mount), but PRD-706's intent is one bridge per deployment. Flagging here for the BDFL; PRD-706-R12 / R14 take a position (single bridge wrapping one runtime + a static walker, with per-mount manifest exposition) but it is not clearly licensed by PRD-602's text. Not resolved in PRD-706.
6. **Possible PRD-106 ambiguity.** PRD-106-R17 / R18 say the parent's `mounts` array MAY be declared and child manifests MUST NOT declare further `mounts`. The validator probe (PRD-600-R11 / R3) walks mounts. But neither PRD-106 nor PRD-101 normatively addresses whether the parent's manifest can itself be served by the runtime (i.e., dynamically generated per-request). For PRD-706 the parent is a static file (per Open Q3 above), but a runtime-served parent (e.g., generated by Next.js middleware) would be useful for operators wanting to gate the manifest itself. Flagging for the BDFL; PRD-706 takes the static position.
7. Should the example demonstrate a programmatic adapter (PRD-208) on the static side? **Tentative no.** The static side composes PRD-201 (markdown) + PRD-202 (Contentful) via PRD-409; introducing PRD-208 would bloat the example without exercising new surface. PRD-704 is the canonical PRD-208 example.

### Acceptance criteria

- [ ] Status `In review`; changelog entry dated 2026-05-02 by Jeremy Forsythe is present.
- [ ] Every normative requirement has an ID `PRD-706-R{n}` and a declared conformance level per PRD-107.
- [ ] The Specification section opens with a table citing every P2 PRD this example exercises and the requirement IDs touched.
- [ ] (a) The example builds clean: `pnpm -C examples/706-hybrid-saas build` produces the static marketing tree under `dist/marketing/`, the parent manifest at `dist/.well-known/act.json`, and a runnable Next.js app for the runtime mount; the runtime serves green (`pnpm start`).
- [ ] (b) PRD-600 validator returns zero `gaps` against the running deployment in `validateSite` runtime-walk mode with credentials injected for the runtime mount; the validator follows `mounts` per PRD-600-R11 / Open-Q5 (resolved 2026-05-01: walk mounts in a single invocation).
- [ ] (c) The validator's reported `achieved.level` is `"plus"` for the marketing mount AND `"standard"` for the app mount, both matching the declared values.
- [ ] (d) Every cited P2 PRD has at least one of its requirements exercised (citation table makes the mapping explicit).
- [ ] (e) **MCP bridge surface acceptance.** A separate MCP-side probe enumerates resources via `act://acme.com/manifest`, follows the per-mount manifests, and verifies the union of MCP resource URIs equals the union of static-emitted node IDs + runtime-served node IDs (modulo per-tenant scoping for the runtime mount). Cites PRD-602-R6 / R7 / R10.
- [ ] (f) **Mount composition acceptance.** The static and runtime mounts compose at the top-level manifest without conflict: the parent manifest validates against `schemas/100/manifest.schema.json`, the two mount entries have non-overlapping prefixes (`/marketing` vs `/app`), neither leaf manifest declares further `mounts`. Cites PRD-100-R7 / PRD-106-R17–R22.
- [ ] Implementation notes ship 6–10 short snippets (parent manifest, marketing mount config for `@act/cli`, runtime mount `defineActMount`, MCP bridge wiring, MCP `IdentityBridge`, mount-walking probe, deployment topology sketch).
- [ ] Test-fixture path layout under `fixtures/706/` enumerated.
- [ ] Versioning & compatibility section classifies each kind of change.
- [ ] Security section cites PRD-109 thoroughly and documents the static-vs-runtime auth-boundary deltas.
- [ ] No new JSON Schemas introduced.

---

## Context & dependencies

### Depends on

- **PRD-100** (Accepted) — wire-format envelopes; `mounts` shape per PRD-100-R7.
- **PRD-101** (Accepted) — discovery; the validator follows the parent manifest → mounts path per PRD-101-R8 / R10.
- **PRD-102** (Accepted) — content blocks; `marketing:*` namespace exercised on the static side.
- **PRD-103** (Accepted) — ETag derivation; static derivation per PRD-103-R4 + runtime per PRD-103-R6.
- **PRD-105** (Accepted) — static delivery profile; the marketing mount conforms.
- **PRD-106** (Accepted) — runtime delivery profile; the app mount conforms; `mounts` semantics per PRD-106-R17–R22.
- **PRD-107** (Accepted) — conformance levels; per-mount level declaration per PRD-107-R5.
- **PRD-108** (Accepted) — versioning policy.
- **PRD-109** (Accepted) — security; especially R3 (404 byte-equivalence on the runtime side), R5 (auth challenges on the runtime side), R10 (auth orthogonal to level), R11 / R13 (per-tenant scoping on the runtime side), R21 (cross-origin mount trust — not exercised; same-origin mounts only in v0.1).
- **PRD-201** (Accepted) — markdown adapter; consumed by the marketing build.
- **PRD-202** (Accepted) — Contentful adapter; consumed by the marketing build.
- **PRD-208** (Accepted) — programmatic adapter; cited but not exercised (per Open Q7).
- **PRD-400** (Accepted) — generator architecture; the marketing build invokes `runPipeline`.
- **PRD-405** (Accepted) — Next.js static-export plugin; cited as an alternative; v0.1 example uses PRD-409 instead for the static side.
- **PRD-409** (Accepted) — standalone CLI; the marketing build invokes `act build`.
- **PRD-500** (Accepted) — runtime SDK contract; the runtime mount implements `ActRuntime`.
- **PRD-501** (Accepted) — Next.js runtime SDK; the runtime mount consumes `defineActMount` with `basePath: "/app"`.
- **PRD-505** (Accepted) — generic WHATWG-fetch handler; the MCP bridge's HTTP side uses this per PRD-602-R4.
- **PRD-600** (Accepted) — validator; runs against the live deployment in CI per acceptance criteria (b)/(c)/(e)/(f).
- **PRD-602** (Accepted) — ACT-MCP bridge; the MCP surface consumes this.
- **PRD-705** (In review) — runtime SaaS workspace; the app mount inherits 705's patterns.
- External: [Model Context Protocol 1.0](https://spec.modelcontextprotocol.io/), [Next.js 14 App Router](https://nextjs.org/docs/app), [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

### Blocks

_Not applicable — no downstream PRDs gate on PRD-706. PRD-706 is the most ambitious P3 example and is the terminal node of the example DAG._

### References

- v0.1 draft: §6.6 (Runtime SDK pattern), §6.6.3 (Mixing static and runtime), §8.6 (B2B SaaS workspace), Appendix E (ACT and MCP relationship).
- `prd/000-decisions-needed.md`: Q3 (TS-only first-party), Q6 (MCP 1.0 + forward-compat shim), Q13 (search-body envelope deferred).
- Prior art: hybrid CMS+SaaS deployments (Notion's `notion.so` + `notion.so/{workspace}`), the prevailing "marketing site + auth app" topology used by Linear, Front, Intercom, Stripe.

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) where requirements are imposed. Lowercase "must" and "should" are non-normative prose.

### P2 PRDs cited and exercised

The example composes the following P2 PRDs. Each row names the source PRD, the source requirement IDs the example exercises, and the PRD-706 requirement(s) that bind the example to the implementation.

| Source PRD | Source requirement IDs exercised | Mechanism (this example) | PRD-706 requirement |
|---|---|---|---|
| PRD-100 | R3, R4, R5, R6, R7, R8, R10, R16–R20, R21–R27, R28–R31 (`marketing:*`), R32–R36, R37–R40 (NDJSON + search), R41–R44, R46 | Parent manifest with `mounts`; per-mount leaf manifests; static node + index + NDJSON envelopes; runtime envelopes; error envelopes. | PRD-706-R2, R3, R5, R7, R8, R10, R11 |
| PRD-101 | R1, R8, R10 | Well-known parent manifest at `/.well-known/act.json`; consumer discovery follows mounts via longest-prefix. | PRD-706-R3, R5, R19 |
| PRD-102 | R1–R11, R12–R15, R26 (block-shape rules; `marketing:*` namespace) | Static marketing nodes ship `marketing:hero`, `marketing:feature-grid`, `marketing:pricing-table`, `marketing:testimonial`, `marketing:faq` blocks. | PRD-706-R8 |
| PRD-103 | R2, R3, R4 (static derivation), R6 (runtime derivation), R8, R10 | Static ETags re-derivable from JCS bytes; runtime ETags scoped by tenant. | PRD-706-R10, R16 |
| PRD-105 | R1, R2, R3, R5, R7, R8, R10, R12 (NDJSON), R13 (search) | Static marketing files emitted under `dist/marketing/`; CDN expectations honored. | PRD-706-R7, R8, R9 |
| PRD-106 | R1, R3–R6, R7–R12, R13–R15, R16, R17–R22 (mounts), R23–R25, R26–R30, R31 (subtree at Standard) | Runtime app mount; mount semantics; per-tenant ETag; runtime Link header. | PRD-706-R5, R6, R10, R11 |
| PRD-107 | R1, R3, R4, R5 (per-mount level), R6, R8, R10 | Plus marketing + Standard app; per-mount levels declared; orthogonality. | PRD-706-R3, R5, R7, R11 |
| PRD-108 | R1, R7 | `act_version: "0.1"` everywhere; tolerate unknown optional fields. | PRD-706-R2 |
| PRD-109 | R3, R5, R10, R11, R13, R14, R15, R21 (origin-trust noted as not exercised) | 404 byte-equivalence on the runtime side; auth challenges; per-tenant scoping; no PII in errors; same-origin mounts only. | PRD-706-R6, R10, R11, R18 |
| PRD-201 | (consumed via PRD-409) | Markdown source files for marketing nodes. | PRD-706-R8 |
| PRD-202 | (consumed via PRD-409) | Contentful CMS source for marketing nodes. | PRD-706-R8 |
| PRD-400 | R17 (achieved-level computation), R31 (`GeneratorConfig`) | Marketing build invokes `runPipeline` via `@act/cli`. | PRD-706-R8 |
| PRD-409 | R1, R2, R3 (config resolution), R4 (canonical pipeline), R10 (validate subcommand) | `act build` produces the marketing tree; `act validate` smokes the output. | PRD-706-R8, R19 |
| PRD-500 | R3, R5, R6, R7, R10, R12, R14, R15, R17, R18, R19, R20, R22, R23, R26, R32 | Runtime mount's `ActRuntime`. | PRD-706-R6, R10, R11 |
| PRD-501 | R2, R3, R4, R5, R6, R7, R8 (`basePath`), R9, R12, R13, R14, R17, R18, R21 | Runtime mount with `basePath: "/app"`; subtree resolver; Link header middleware. | PRD-706-R6, R10, R11 |
| PRD-505 | (cited; consumed by the bridge per PRD-602-R4) | Generic WHATWG-fetch handler used by the MCP bridge's HTTP side. | PRD-706-R12 |
| PRD-600 | R1, R3, R8, R9, R10, R11 (mount walk), R32, R33; Open-Q5 (walk mounts in a single invocation) | Validator runs against the live hybrid deployment; per-mount sub-reports. | PRD-706-R19, R20 |
| PRD-602 | R1, R2, R3, R4, R5, R6 (`act://`), R7 (manifest-as-resource), R8, R9, R10 (`IdentityBridge`), R11 (subtree-as-list), R13, R14, R18 (correlated logging), R22, R23 | Bridge wraps the runtime + a static walker; MCP resources for the union of static + runtime IDs. | PRD-706-R12, R13, R14, R15, R20 |
| PRD-705 | (entire requirement set, by reference) | The runtime mount inherits 705's patterns: identity / tenant resolvers, public-tenant branch (adapted), ETag inputs, `Cache-Control: private`, cross-tenant 404 byte-equivalence. | PRD-706-R6, R11, R18 |

### Conformance level

This example targets **Plus** as the workflow.md-mandated declared target for the hybrid example. The Plus declaration applies to the marketing mount; the app mount declares Standard (inherited from PRD-705's pattern). The parent manifest itself does NOT declare a top-level `conformance.level` in the strict-Plus sense — it is a routing manifest only — but PRD-107-R1 requires every manifest to declare a level. The parent declares `level: "plus"` to signal the highest-level mount it composes; consumers asking "minimum Plus" follow only the `/marketing` mount (the `/app` mount is Standard and would not satisfy them). Per PRD-107-R5: each mount carries its own `conformance.level`; consumers select per their requirement.

**Justification for Plus (full surface):** The hybrid example is the workflow.md-prompt-mandated full-surface exercise. It exists to prove that `mounts`, runtime, and MCP compose without conflict. Plus is required to:

- Demonstrate the `marketing:*` block namespace (Plus-only per PRD-107-R10 / PRD-100-R31).
- Demonstrate the NDJSON index endpoint (Plus per PRD-106-R32).
- Demonstrate the search endpoint (Plus per PRD-106-R33; body deferred per Q13).
- Exercise PRD-602-R15 (search delegation) on the MCP side.

Anything less than Plus would skip the Plus-specific surface that PRD-706 is uniquely positioned to demonstrate (PRD-700–705 each cover Core / Standard surfaces).

Per-requirement banding:

- **Core:** PRD-706-R1 (the example's contract is normative), R2 (manifest declaration), R3 (parent manifest shape), R4 (top-level routing), R5 (`mounts` invariants), R6 (runtime mount inherits PRD-705), R10 (runtime mount auth + ETag), R12 (MCP bridge construction), R13 (bridge walks the same tree), R14 (per-mount MCP manifests), R15 (MCP `IdentityBridge`), R16 (build determinism), R17 (no cross-mount `related`), R18 (security boundary documentation), R19 (acceptance gate: zero gaps), R20 (MCP-surface acceptance).
- **Standard:** PRD-706-R11 (subtree on the app mount).
- **Plus:** PRD-706-R7 (parent declares `level: "plus"`), R8 (marketing mount Plus surface — `marketing:*` blocks, NDJSON, search), R9 (marketing mount caching).

### Normative requirements

#### Meta

**PRD-706-R1.** **(Core)** This PRD's normative requirements bind the implementer of `examples/706-hybrid-saas` to the contract below. The example MUST satisfy every requirement here AND every cited requirement in the table above. The example MUST NOT widen any cited PRD's obligations; conflicts are reported as ambiguities (Open questions §5, §6).

#### Top-level manifest

**PRD-706-R2.** **(Core)** The example's parent manifest at `/.well-known/act.json` MUST declare:

- `act_version: "0.1"` per PRD-108-R1.
- `site.name` (any non-empty string).
- `delivery: "static"` per PRD-107-R3 (the parent manifest is a build-time-emitted JSON file).
- `conformance: { level: "plus" }` per PRD-706-R7.
- `mounts: [...]` per PRD-100-R7 / PRD-106-R17 with the two entries pinned in PRD-706-R5.

The parent manifest MUST NOT declare `index_url`, `node_url_template`, `subtree_url_template`, `index_ndjson_url`, `search_url_template`, or `auth`. The parent is a routing manifest only — consumers following a specific resource path MUST follow a mount per PRD-106-R19 (longest-prefix selection).

**PRD-706-R3.** **(Core)** The parent manifest MUST be a static build-time artifact emitted by `@act/cli` (PRD-409) as part of the marketing build. The runtime application MUST NOT serve the parent manifest. The build emits to `dist/.well-known/act.json`; the deployment topology serves `dist/` from a CDN at the origin's root, with the Next.js runtime app mounted at `/app/*` via the same CDN's request routing (e.g., a Vercel `vercel.json` with `routes` directives, or a CloudFront behavior). PRD-101-R8's discovery algorithm (consumer fetches `/.well-known/act.json` first) finds the parent manifest at the CDN's root.

**PRD-706-R4.** **(Core)** The example's deployment topology MUST route requests by URL prefix:

- `/.well-known/act.json` → static (parent manifest).
- `/marketing/*` → static (marketing tree, served from `dist/marketing/`).
- `/app/*` → runtime (Next.js application; `defineActMount` with `basePath: "/app"`).

Other paths (e.g., `/`, `/about`, `/api/*` for non-ACT API endpoints) are owned by the Next.js application and are NOT part of the ACT surface. The Link header middleware (PRD-501-R17) emits `Link: rel="act"` on authenticated HTML responses pointing to `/.well-known/act.json`.

#### Mounts composition

**PRD-706-R5.** **(Core)** The parent manifest's `mounts` array MUST contain exactly two entries with the following shape:

```json
{
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
      "manifest_url": "/app/.well-known/act.json",
      "conformance": { "level": "standard" }
    }
  ]
}
```

- The two prefixes MUST NOT overlap per PRD-106-R20 (`/marketing` and `/app` are disjoint).
- Neither leaf manifest (`/marketing/.well-known/act.json` or `/app/.well-known/act.json`) MAY itself declare `mounts` per PRD-106-R18.
- Both `manifest_url` values MUST be origin-relative (same-origin mounts) per PRD-706-R18; the example does not exercise cross-origin trust per PRD-109-R21.
- The mounts MUST be reachable: the marketing leaf manifest is a static file at `dist/marketing/.well-known/act.json`; the app leaf manifest is served by `defineActMount` at `/app/.well-known/act.json` per PRD-501-R3 with `basePath: "/app"`.

#### Runtime mount

**PRD-706-R6.** **(Core)** The runtime mount MUST inherit PRD-705's full normative surface, with the following adaptations:

- `basePath: "/app"` per PRD-501-R8 (PRD-705 used root mount; the app mount is non-root).
- The leaf manifest is at `/app/.well-known/act.json` (advertised URLs in the leaf manifest are prefixed with `/app` per PRD-501-R8).
- The leaf manifest declares `level: "standard"`, `delivery: "runtime"`, `auth.schemes: ["cookie", "bearer"]` per PRD-705-R2.
- Identity resolution, tenant resolution, ETag derivation, `Cache-Control`, error envelope shape, and 404 byte-equivalence are inherited from PRD-705-R6 / R8 / R10 / R11 / R16 / R17 unchanged.
- The app mount MAY drop the public-tenant branch from PRD-705-R12 — the parent manifest's marketing mount covers the unauthenticated public surface — OR retain it. The example retains it for symmetry with PRD-705 (so the same code patterns apply); the public landing node is reachable at `/app/n/public/landing` AND at `/marketing/landing` (a static-emitted analog), with the app's runtime version returning identical content.

#### Plus marketing mount

**PRD-706-R7.** **(Plus)** The marketing leaf manifest at `/marketing/.well-known/act.json` MUST declare:

- `act_version: "0.1"`, `site.name`, `delivery: "static"`, `conformance: { level: "plus" }` per PRD-107-R10.
- `index_url: "/marketing/act/index.json"`, `node_url_template: "/marketing/act/n/{id}.act.json"`, `subtree_url_template: "/marketing/act/sub/{id}.act.json"`.
- `index_ndjson_url: "/marketing/act/index.ndjson"` per PRD-107-R10 / PRD-100-R37.
- `search_url_template: "/marketing/act/search?q={query}"` per PRD-107-R10 / PRD-100-R39.
- `capabilities: { etag: true, subtree: true, ndjson_index: true, search: { template_advertised: true } }` per PRD-107-R10.
- The marketing manifest MUST NOT declare `auth`; the marketing surface is anonymous-public per PRD-106-R11.

**PRD-706-R8.** **(Plus)** The marketing build MUST be invoked via `@act/cli` (PRD-409) with the canonical pipeline (PRD-409-R4 / PRD-400-R31). The build composes:

- PRD-201 (markdown adapter) over a `content/marketing/` directory of markdown files.
- PRD-202 (Contentful adapter) over a Contentful space (env-var-driven config per PRD-202).
- The merged tree emits Plus-shaped envelopes: every node's `content[]` array MAY include `marketing:hero`, `marketing:feature-grid`, `marketing:pricing-table`, `marketing:testimonial`, `marketing:faq` blocks per PRD-102-R6–R11 / PRD-100-R31; the index is mirrored as NDJSON per PRD-100-R37 / PRD-105-R12; the search endpoint is emitted as a static file or a server-side function per PRD-105-R13 (the example uses a static lunr-style index emitted at build time, with the search endpoint served as a Vercel Edge function reading the index — body envelope opaque-but-JSON per Q13).

The static build MUST emit deterministically per PRD-103-R4 (re-running the build with identical inputs produces byte-identical outputs).

**PRD-706-R9.** **(Plus)** The marketing CDN response MUST carry:

- `Cache-Control: public, max-age=300, must-revalidate` (5 minute freshness, mandatory revalidation).
- `Vary: Accept` (so NDJSON-content-negotiated requests are cached separately from JSON requests per PRD-105 / PRD-100-R37).
- `ETag` matching the envelope's `etag` field per PRD-103-R5 / PRD-105-R8.

The marketing surface is NOT auth-scoped; `Cache-Control: public` is correct here per PRD-106-R11. (Contrast with PRD-706-R10 / PRD-705-R11's `private, must-revalidate` on the runtime mount.)

#### Runtime mount caching and security

**PRD-706-R10.** **(Core)** The runtime app mount MUST honor PRD-705-R10 (per-tenant ETag input) and PRD-705-R11 (`Cache-Control: private, must-revalidate` + `Vary: Cookie`) verbatim. Cross-tenant 404 byte-equivalence per PRD-705-R17 / R20 applies. The negative fixture `fixtures/706/negative/runtime-cross-tenant-leak.json` exercises the failure mode.

#### Subtree

**PRD-706-R11.** **(Standard)** The runtime app mount MUST register `resolveSubtree` per PRD-501-R21 / PRD-705-R14. The marketing mount MAY emit subtree files (the static profile's Standard surface per PRD-105-R7); the example emits them so consumers asking for "minimum Standard, static profile" can follow the marketing mount. Subtree depth bounds per PRD-100-R33 apply on both sides.

#### MCP bridge

**PRD-706-R12.** **(Core)** The example MUST ship a single MCP bridge process built on `@act/mcp-bridge` (PRD-602) that exposes BOTH mounts as MCP resources under the `act://acme.com/...` URI scheme per PRD-602-R6.

The bridge construction:

- Wraps a single `ActRuntime` (the same one configured for the runtime app mount) per PRD-602-R3 / PRD-602-R4.
- Additionally wraps a static walker for the marketing tree. The static walker reads the deployed marketing static files (or the build's `dist/marketing/` output during local development) and surfaces each node as an MCP resource. The bridge MUST consume the SAME walker `@act/validator` uses (PRD-600-R11) — no separately-implemented walker — to foreclose drift between MCP-surfaced and validator-walked trees per PRD-706-R13.
- The bridge's HTTP side uses `@act/runtime-core`'s generic WHATWG-fetch handler (PRD-505) per PRD-602-R4, NOT the Next.js leaf SDK directly. The Next.js application owns the `/app/*` HTTP surface; the bridge owns the MCP transport (stdio or HTTP+SSE per PRD-602-R22) and consumes the runtime resolver via the generic handler.

The MCP server's `name` and `version` (per PRD-602-R5) are operator-configured; `name: "acme-act-bridge"`, `version: "0.1.0"` are the example values.

**PRD-706-R13.** **(Core)** The bridge MUST consume the marketing tree via the same walker `@act/validator` uses per PRD-600-R11 — specifically, by following `/marketing/.well-known/act.json` → its `index_url` → each node's URL — rather than by re-parsing the markdown / Contentful sources. This foreclosure is critical: it ensures that what the validator sees, the MCP bridge surfaces, and what end users fetch from the CDN are byte-identical.

**PRD-706-R14.** **(Core)** The bridge MUST expose:

- `act://acme.com/manifest` → the parent manifest at `/.well-known/act.json` per PRD-602-R7. The body is the parent's runtime-or-static manifest (`delivery: "static"` with `mounts`).
- `act://acme.com/marketing/manifest` → the marketing leaf manifest. (Per Open Q4: per-mount manifests are exposed as MCP resources so clients can read each mount's level.)
- `act://acme.com/app/manifest` → the app leaf manifest.
- `act://acme.com/{node-id}` for every static-tree node ID (anonymous-readable).
- `act://acme.com/{node-id}` for every runtime-tree node ID, gated by the `IdentityBridge` per PRD-706-R15.

Per PRD-602-R6, IDs containing `/` are encoded segment-wise. The bridge resolves the URI to the appropriate mount (longest-prefix on the ID's path-shape, or by inspecting the parent manifest's `mounts` array) and dispatches to either the static walker or the runtime resolver.

**PRD-706-R15.** **(Core)** The bridge's `IdentityBridge` per PRD-602-R10 MUST:

1. Receive the MCP auth context (the operator's configured MCP authentication: typically a session token in the MCP transport's authorization channel).
2. For anonymous MCP sessions, return an `ActRequestLike` whose headers contain no auth credentials. The runtime resolver receives `{ kind: "anonymous" }` per PRD-500-R6 and rejects per-tenant reads with `auth_required` per PRD-705-R6.
3. For authenticated MCP sessions, exchange the MCP auth token for the example's session cookie format (or pass through a bearer token), populate `ActRequestLike.headers` with `Authorization: Bearer <token>` or `Cookie: session=<value>`, and return.
4. The runtime resolver's `IdentityResolver` (PRD-705-R6) processes the headers identically to a direct HTTP request.

PRD-602-R14's failure-mode mapping applies: ACT `not_found` and `denied` collapse to MCP `RESOURCE_NOT_FOUND` with byte-identical envelopes (modulo opaque request IDs) per PRD-602-R10 / PRD-109-R3.

#### Determinism and cross-mount linking

**PRD-706-R16.** **(Core)** The marketing static build MUST be deterministic per PRD-103-R4: re-running `act build` with identical adapter inputs produces byte-identical static files including ETags. The example's CI MUST run the build twice and assert byte-equality of `dist/marketing/`.

**PRD-706-R17.** **(Core)** Cross-mount `related` references — a marketing node citing an app-tree node ID, or vice versa — are forbidden in v0.1. Each mount's `related` graph stays within the mount. The validator MUST emit a warning if it sees a cross-mount reference (warning, not error, because v0.2 may license the pattern). This forecloses an entire class of auth-boundary confusion: a marketing-tree node MUST NOT link a logged-out reader into the auth-required app tree via `related`.

#### Security boundary

**PRD-706-R18.** **(Core)** The example MUST document the auth boundary explicitly in its README and in the Security section of this PRD:

- The parent manifest is unauthenticated; it discloses only the existence of the two mounts and their levels.
- The marketing mount is unauthenticated; all marketing nodes are public per PRD-106-R11.
- The app mount is authenticated; every node (except the public landing branch) requires a valid session cookie or bearer token per PRD-705-R6.
- The MCP bridge surfaces both; anonymous MCP sessions see only the marketing tree; authenticated MCP sessions see marketing + their tenant's app tree.
- Cross-origin mount trust (PRD-109-R21) is NOT exercised — both mounts are same-origin under `acme.com`. PRD-706 v0.1 is intentionally same-origin-only.

#### Acceptance and probes

**PRD-706-R19.** **(Core)** The example MUST gate CI on `act-validate site http://localhost:3000` (PRD-600-R11) returning:

- Zero `gaps` for the parent manifest.
- Zero `gaps` for each leaf manifest (mounts walked per Open Q5 — single invocation, per-mount sub-reports).
- `achieved.level: "plus"` for the marketing mount (matching declared).
- `achieved.level: "standard"` for the app mount (matching declared).
- `achieved.delivery: "static"` for the parent and marketing; `achieved.delivery: "runtime"` for the app.

The validator's Q13 (search-body deferred) warning is expected for the marketing mount and does NOT block the gate; PRD-600-R24 cited.

**PRD-706-R20.** **(Core)** The example MUST gate CI on the MCP-side probe demonstrating that the bridge surfaces the same tree the static + runtime do. The probe:

1. Boots the bridge locally (`pnpm bridge:start`).
2. Connects an MCP client (anonymous session) and reads `act://acme.com/manifest`; asserts the parent manifest with the two mounts.
3. Reads `act://acme.com/marketing/manifest`; asserts the marketing Plus manifest.
4. Enumerates marketing nodes via the marketing index resource; asserts the set equals the static-emitted node IDs.
5. Attempts to read `act://acme.com/app/{some-id}` anonymously; asserts MCP `RESOURCE_NOT_FOUND` (PRD-602-R14, byte-equivalent to a not-found marketing node).
6. Reconnects with an authenticated session (test principal A, tenant A); reads `act://acme.com/app/{principal-A's-doc-id}`; asserts 200 with the runtime envelope.
7. Asserts the union of MCP-surfaced node IDs equals the union of static-emitted IDs + runtime-tenant-A IDs (modulo per-tenant scoping).

Failure of any step is a release blocker. **This is the MCP-bridge surface acceptance criterion for PRD-706 per the workflow.md Phase 4 prompt.**

### Wire format / interface definition

_Not applicable — PRD-706 is a reference example consuming the wire formats defined by PRD-100, PRD-105, PRD-106, PRD-107, the SDK contracts of PRD-500 / PRD-501 / PRD-505, and the MCP bridge contract of PRD-602. No new schemas or interfaces are introduced._

### Errors

The example inherits error envelopes from PRD-100-R41–R44 / PRD-106-R26–R30 (runtime side) and PRD-105 (static side, where errors are surfaced as build warnings or missing files rather than HTTP errors). The MCP-side error mapping is owned by PRD-602-R14. The mapping below restates the relevant subset:

| Condition | Surface | Status / MCP code | Notes |
|---|---|---|---|
| Anonymous fetch of `/.well-known/act.json` | Static (CDN) | 200 | Parent manifest, no auth |
| Anonymous fetch of `/marketing/act/n/{id}.act.json` | Static (CDN) | 200 (or 404 if id absent) | Public marketing |
| Anonymous fetch of `/app/act/index.json` | Runtime (Next.js) | 401 | Two `WWW-Authenticate` headers per PRD-705-R9 |
| Anonymous MCP read of `act://acme.com/app/{id}` | MCP bridge | `AUTHENTICATION_REQUIRED` | Per PRD-602-R14 |
| Authenticated principal A reads tenant-B doc via MCP or HTTP | Both | 404 / `RESOURCE_NOT_FOUND` | Byte-equivalent to non-existent per PRD-705-R17 / PRD-602-R14 |
| Mount overlap or recursion | Build / validator | Build error / validator `gaps` | Per PRD-106-R20 / R18 |
| Cross-mount `related` reference | Validator | Warning | Per PRD-706-R17 |
| Build non-deterministic (two runs differ) | CI | Hard fail | Per PRD-706-R16 / PRD-103-R4 |

---

## Examples

Examples are non-normative but consistent with the Specification.

### Example 1 — Parent manifest (`dist/.well-known/act.json`)

```json
{
  "act_version": "0.1",
  "site": { "name": "Acme" },
  "delivery": "static",
  "conformance": { "level": "plus" },
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
      "manifest_url": "/app/.well-known/act.json",
      "conformance": { "level": "standard" }
    }
  ]
}
```

### Example 2 — Marketing build config (`act.config.ts` for `@act/cli`)

```ts
// examples/706-hybrid-saas/marketing/act.config.ts
import { defineMarkdownAdapter } from '@act/adapter-markdown'; // PRD-201
import { defineContentfulAdapter } from '@act/adapter-contentful'; // PRD-202
import type { GeneratorConfig } from '@act/generator-core'; // PRD-400

const config: GeneratorConfig = {
  outputDir: '../dist',
  basePath: '/marketing',
  manifest: {
    act_version: '0.1',
    site: { name: 'Acme Marketing' },
    delivery: 'static',
    conformance: { level: 'plus' },
    capabilities: {
      etag: true,
      subtree: true,
      ndjson_index: true,
      search: { template_advertised: true },
    },
  },
  adapters: [
    defineMarkdownAdapter({ root: './content' }),
    defineContentfulAdapter({
      space: process.env.CONTENTFUL_SPACE!,
      accessToken: process.env.CONTENTFUL_DELIVERY_TOKEN!,
    }),
  ],
  conformanceTarget: 'plus',
};

export default config;
```

The marketing build is invoked at deploy time: `pnpm -C marketing exec act build`. The output ships to `dist/marketing/`.

### Example 3 — Runtime app mount (`app/act-mount.ts` with `basePath: "/app"`)

```ts
// examples/706-hybrid-saas/app/app/act-mount.ts
import { defineActMount } from '@act/runtime-next';
import { runtime } from '@/lib/act-runtime';
import { identityResolver, tenantResolver, logger } from '@/lib/act-host';

export const actMount = defineActMount({
  manifest: {
    act_version: '0.1',
    site: { name: 'Acme App' },
    delivery: 'runtime',
    conformance: { level: 'standard' },
    auth: { schemes: ['cookie', 'bearer'] },
    index_url: '/app/act/index.json',
    node_url_template: '/app/act/n/{id}',
    subtree_url_template: '/app/act/sub/{id}',
    capabilities: { etag: true, subtree: true },
  },
  basePath: '/app', // PRD-501-R8 / PRD-706-R6
  runtime,
  identityResolver,
  tenantResolver,
  logger,
});
```

Patterns inherited from PRD-705 (identity resolver, tenant resolver, ETag inputs, public-tenant branch, Cache-Control) apply unchanged.

### Example 4 — MCP bridge wiring

```ts
// examples/706-hybrid-saas/bridge/src/main.ts
import { createBridge } from '@act/mcp-bridge';                  // PRD-602
import { createGenericHandler } from '@act/runtime-core';        // PRD-505
import { createActWalker } from '@act/validator';                // PRD-600 walker reused
import { runtime } from '@/lib/act-runtime';
import { identityBridge } from './identity-bridge';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';

const httpHandler = createGenericHandler({ runtime, basePath: '/app' });

// Static walker reuses PRD-600's tree walker — PRD-706-R13.
const staticWalker = createActWalker({
  baseUrl: process.env.MARKETING_BASE_URL ?? 'http://localhost:3000/marketing',
});

const bridge = createBridge({
  runtime,
  httpHandler,
  staticWalker, // bridge's documented escape hatch for hybrid trees (per Open Q5 ambiguity)
  identityBridge,
  mcp: { name: 'acme-act-bridge', version: '0.1.0' },
});

await bridge.start(new StdioServerTransport());
```

Note: the `staticWalker` field is the example's interpretation of how a single bridge wraps both a runtime resolver and a static tree. PRD-602-R3 / R4 do not normatively address this composition; see Open Q5. The example implementer SHOULD coordinate with the BDFL before finalizing this surface.

### Example 5 — `IdentityBridge` mapping MCP auth to ACT identity

```ts
// examples/706-hybrid-saas/bridge/src/identity-bridge.ts
import type { IdentityBridge } from '@act/mcp-bridge';

export const identityBridge: IdentityBridge = {
  resolveAct: async (mcpContext) => {
    const headers = new Headers();
    const cookies = new Map<string, string>();

    if (mcpContext.session?.token) {
      headers.set('Authorization', `Bearer ${mcpContext.session.token}`);
    }
    // For MCP transports that carry a session cookie equivalent:
    if (mcpContext.session?.cookie) {
      cookies.set('session', mcpContext.session.cookie);
      headers.set('Cookie', `session=${mcpContext.session.cookie}`);
    }

    return {
      headers,
      getCookie: (name: string) => cookies.get(name),
    };
  },
};
```

### Example 6 — Mount-walking probe (`scripts/probe.ts`)

```ts
// examples/706-hybrid-saas/scripts/probe.ts
import { validateSite } from '@act/validator';

const report = await validateSite({
  baseUrl: 'http://localhost:3000',
  walkMounts: true,                             // Open-Q5 (resolved): single invocation
  credentials: {
    '/app': { bearer: process.env.TEST_PRINCIPAL_A_TOKEN! },
  },
});

console.log(JSON.stringify(report, null, 2));

if (report.gaps.length > 0) process.exit(1);
if (report.mounts['/marketing'].achieved.level !== 'plus') process.exit(1);
if (report.mounts['/app'].achieved.level !== 'standard') process.exit(1);
```

The `mounts` field on the report is the per-mount sub-report shape PRD-600 emits per Open Q5 (resolved 2026-05-01: walk mounts in a single invocation).

### Example 7 — MCP-side enumeration probe

```ts
// examples/706-hybrid-saas/scripts/probe-mcp.ts
import { Client } from '@modelcontextprotocol/sdk/client';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';

const client = new Client({ name: 'probe', version: '0.1.0' }, { capabilities: {} });
await client.connect(new StdioClientTransport({ command: 'pnpm', args: ['bridge:start'] }));

const parent = await client.readResource({ uri: 'act://acme.com/manifest' });
const marketing = await client.readResource({ uri: 'act://acme.com/marketing/manifest' });
const app = await client.readResource({ uri: 'act://acme.com/app/manifest' });

// Enumerate marketing nodes via the marketing index resource:
const marketingIndex = await client.readResource({
  uri: 'act://acme.com/marketing/act/index.json',
});

// Attempt anonymous read of an app node — expect RESOURCE_NOT_FOUND:
try {
  await client.readResource({ uri: 'act://acme.com/app/doc/some-id' });
  throw new Error('Anonymous app read should have failed');
} catch (e) {
  // expected — PRD-602-R14
}

await client.close();
```

---

## Test fixtures

Fixtures live under `fixtures/706/` and are exercised by the validator (PRD-600), the bridge probe (PRD-706-R20), and the example's own build harness (PRD-706-R16).

### Positive

- `fixtures/706/positive/parent-manifest.json` → parent manifest with two mounts. Satisfies PRD-706-R2 / R5.
- `fixtures/706/positive/marketing-manifest-plus.json` → marketing leaf manifest declaring Plus / static. Satisfies PRD-706-R7.
- `fixtures/706/positive/app-manifest-standard.json` → app leaf manifest declaring Standard / runtime, advertised URLs prefixed with `/app`. Satisfies PRD-706-R6.
- `fixtures/706/positive/marketing-node-with-marketing-blocks.json` → a marketing node whose `content[]` includes `marketing:hero`, `marketing:feature-grid`, `marketing:pricing-table`. Satisfies PRD-706-R8.
- `fixtures/706/positive/marketing-ndjson.txt` → NDJSON index transcript. Satisfies PRD-706-R8 / PRD-100-R37.
- `fixtures/706/positive/marketing-search.json` → search response (opaque-but-JSON per Q13). Satisfies PRD-706-R8.
- `fixtures/706/positive/build-determinism.txt` → SHA-256 hashes of `dist/marketing/` from two consecutive builds, byte-identical. Satisfies PRD-706-R16.
- `fixtures/706/positive/mcp-enumeration.json` → recorded MCP-client transcript: parent → marketing → app manifest reads + marketing index enumeration. Satisfies PRD-706-R20 steps 2–4.
- `fixtures/706/positive/mcp-app-authenticated.json` → recorded MCP-client transcript with authenticated session reading a tenant-A document. Satisfies PRD-706-R20 step 6.
- (Inherited from PRD-705) `fixtures/706/positive/runtime-cross-tenant-404-byte-equivalence.json` → runtime probe confirming tenant-A and tenant-B 404 byte-equivalence. Satisfies PRD-706-R10 / PRD-705-R17.

### Negative

- `fixtures/706/negative/overlapping-mounts.json` → parent manifest with mounts `/marketing` and `/marketing/blog`. MUST emit a `gaps` entry citing PRD-106-R20.
- `fixtures/706/negative/recursive-mounts.json` → marketing leaf manifest with its own `mounts` array. MUST emit a `gaps` entry citing PRD-106-R18.
- `fixtures/706/negative/parent-declares-auth.json` → parent manifest with an `auth.schemes` block. MUST emit a `gaps` entry citing PRD-706-R2 / PRD-106-R11 (the parent is a routing manifest only; declaring auth defeats anonymous discovery).
- `fixtures/706/negative/cross-mount-related.json` → a marketing node's `related` array referencing an app-tree node ID. MUST emit a `warnings` entry citing PRD-706-R17.
- `fixtures/706/negative/marketing-cache-control-private.json` → marketing CDN response with `Cache-Control: private`. MUST emit a `gaps` entry citing PRD-706-R9 / PRD-106-R12 (the marketing surface is public; `private` defeats CDN caching).
- `fixtures/706/negative/runtime-cache-control-public.json` → runtime app response with `Cache-Control: public`. MUST emit a `gaps` entry citing PRD-706-R10 / PRD-705-R11.
- `fixtures/706/negative/mcp-anonymous-app-read-leaks.json` → MCP-client transcript where anonymous read of an app node returns 200. MUST emit a `gaps` entry citing PRD-706-R20 / PRD-602-R14 / PRD-109-R3.
- `fixtures/706/negative/build-nondeterministic.txt` → two consecutive builds with differing SHA-256 hashes. MUST emit a `gaps` entry citing PRD-706-R16 / PRD-103-R4.
- `fixtures/706/negative/mcp-bridge-walker-drift.json` → MCP-bridge-surfaced marketing IDs differ from validator-walked IDs (e.g., the bridge re-parses sources rather than walking the deployed tree). MUST emit a `gaps` entry citing PRD-706-R13.

---

## Versioning & compatibility

Per PRD-108, classify each kind of change to PRD-706 as MAJOR or MINOR.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a new normative requirement (additive optional surface) | MINOR | Per PRD-108. |
| Promote either mount's declared level | MAJOR | Per-mount level is part of the contract. |
| Demote either mount's declared level | MAJOR | Same reasoning. |
| Add a third mount (e.g., `/api`) | MAJOR | The `mounts` array shape is the contract for v0.1 of this example. |
| Add an i18n surface (multi-locale marketing) | MAJOR | Per PRD-104; v0.2 amendment. |
| Add MCP tools or completions | MAJOR | Per PRD-602-R16; v0.2 amendment. |
| Allow cross-origin mounts | MAJOR | Same-origin is the v0.1 contract per PRD-706-R18 / PRD-109-R21. |
| Allow cross-mount `related` references | MAJOR | Per PRD-706-R17; v0.2 amendment. |
| Change the MCP `act://` URI scheme | MAJOR | Per PRD-602-R6. |
| Add a new test fixture | MINOR | Fixtures are additive. |
| Update Next.js major version | MAJOR if migration required; MINOR if source-compatible | Per PRD-501. |
| Update MCP minimum version | MAJOR if PRD-602's shim breaks | Per PRD-602-R20's escalation clause. |

### Forward compatibility

A future ACT MINOR (e.g., a new optional manifest field) does not require the example to change. Per PRD-108-R7, consumers tolerate unknown optional fields; the example's manifests do not introduce any. A future MCP MINOR that breaks PRD-602's shim triggers PRD-602-R20's escalation clause and MAY block the example until the shim is reconciled.

### Backward compatibility

The example pins `act_version: "0.1"`. A future v0.2 example would supersede this PRD; the v0.1 example remains as a reference for the v0.1 spec revision.

---

## Security considerations

Security is the dominant concern of the hybrid example because it crosses two auth boundaries (unauthenticated public marketing + authenticated tenant-scoped app) AND two protocols (HTTP + MCP). PRD-109 is the project-wide reference; the deltas below are example-specific.

- **Auth boundary explicitness (PRD-109).** Per PRD-706-R18, the auth boundary MUST be documented. The parent manifest is public; the marketing mount is public; the app mount is auth-required; the MCP bridge surfaces both with anonymous MCP sessions seeing only the marketing slice. README and this PRD explicitly enumerate the boundary.
- **Anonymous MCP read of app nodes (PRD-602-R14 / PRD-109-R3).** The dominant cross-protocol threat. PRD-706-R15 binds the `IdentityBridge` to map anonymous MCP context to anonymous ACT identity, which the runtime resolver rejects. PRD-706-R20 step 5 verifies in CI; the negative fixture `mcp-anonymous-app-read-leaks.json` proves a faulty implementation is detected.
- **Per-tenant scoping (PRD-109-R11 / R13).** Inherited from PRD-705-R8 / R20. Cross-tenant 404 byte-equivalence applies on both the HTTP and MCP surfaces (PRD-706-R10 + PRD-602-R14).
- **`related`-graph cross-mount references (PRD-706-R17).** Forbidden in v0.1 to foreclose the threat of a marketing node luring a logged-out reader into the auth-required app via `related`.
- **Build determinism (PRD-103-R4 / PRD-706-R16).** Non-deterministic builds destabilize ETags, which destabilizes 304 caching, which can desynchronize CDN edges. CI gates on byte-equality.
- **Same-origin mounts only (PRD-109-R21).** Cross-origin mounts require consumer-side trust evaluation; the example does NOT exercise this in v0.1. Future deployments mounting cross-origin manifests (e.g., a marketing site at `marketing.acme.com`) MUST evaluate origin trust per PRD-109. PRD-706 v0.1 keeps both mounts under `acme.com`.
- **MCP `IdentityBridge` token handling (PRD-109-R14 / R15 + PRD-501-R6 risk).** The `IdentityBridge` MUST NOT log MCP auth tokens, MUST NOT cache them across MCP sessions beyond what PRD-602-R12's tenant cache permits, and MUST NOT pass them as `Identity.key` (the principal's stable database `user.id` is the key per PRD-705-R6).
- **Marketing CDN cache poisoning.** The marketing surface is `Cache-Control: public`; an upstream cache misconfiguration could cross-pollute. PRD-706-R9 mandates `Vary: Accept` so NDJSON-content-negotiated responses do not pollute JSON cache entries. The example's CDN config (Vercel `vercel.json` or CloudFront behavior) MUST honor `Vary` per PRD-105.
- **Runtime CDN cache poisoning.** Inherited from PRD-705-R11: `Cache-Control: private, must-revalidate` + `Vary: Cookie`. Intermediaries MUST NOT serve one principal's content to another.
- **Search-body opacity (Q13).** The search endpoint returns opaque-but-JSON per PRD-501-R22 / PRD-602-R15. The MCP bridge passes through. v0.2 will pin the search envelope; until then, the validator (PRD-600-R24) emits a warning citing the deferral, NOT a `gaps` entry.
- **Logger hygiene across protocols (PRD-602-R18 / PRD-500-R23).** The example's logger MUST use the correlation-ID pattern per PRD-602-R18 — one log stream covering both HTTP-side ACT and MCP-side dispatches, correlated by request ID. The Logger MUST NOT receive PII per PRD-109-R14 / R15.

---

## Implementation notes

The TypeScript snippets above (Examples 1–7) cover the canonical wiring. Additional notes:

- **Repository layout.**
  ```
  examples/706-hybrid-saas/
  ├── package.json                # workspace root
  ├── pnpm-workspace.yaml
  ├── marketing/                  # static build via @act/cli
  │   ├── act.config.ts
  │   ├── content/                # markdown source
  │   └── package.json
  ├── app/                        # Next.js 14 runtime app
  │   ├── app/
  │   │   ├── .well-known/act.json/route.ts
  │   │   ├── act/index.json/route.ts
  │   │   ├── act/n/[...id]/route.ts
  │   │   ├── act/sub/[...id]/route.ts
  │   │   ├── act-mount.ts
  │   │   └── middleware.ts
  │   └── package.json
  ├── bridge/                     # MCP bridge process
  │   ├── src/main.ts
  │   ├── src/identity-bridge.ts
  │   └── package.json
  ├── dist/                       # build output: parent manifest + marketing tree
  │   └── (generated)
  └── scripts/
      ├── probe.ts                # validator-driven HTTP probe
      └── probe-mcp.ts            # MCP-client probe
  ```
- **Deployment topology.** The example targets Vercel (Next.js host) with the `dist/` directory served as static assets. The `vercel.json` declares routes:
  ```json
  {
    "routes": [
      { "src": "/.well-known/act.json", "dest": "/dist/.well-known/act.json" },
      { "src": "/marketing/(.*)", "dest": "/dist/marketing/$1" },
      { "src": "/app/(.*)", "dest": "/app/$1" }
    ]
  }
  ```
- **MCP bridge runtime.** The bridge runs as a separate Node process (operator-managed) — typically as a sidecar to the Next.js deployment. The bridge's stdio transport supports local MCP clients (Claude desktop); the HTTP+SSE transport supports remote MCP clients per PRD-602-R22. The example's `pnpm bridge:start` defaults to stdio; HTTP+SSE is documented in the bridge's README.
- **CI matrix.** GitHub Actions runs:
  1. `pnpm -C marketing build` — build determinism check (run twice, diff `dist/marketing/`).
  2. `pnpm -C app build && pnpm -C app start &` — boot the runtime.
  3. `pnpm exec act validate http://localhost:3000` — full mount walk per PRD-706-R19.
  4. `pnpm probe` — runtime probe with two test principals per PRD-705-R18.
  5. `pnpm probe:mcp` — MCP enumeration per PRD-706-R20.
- **Validator invocation.** `act-validate site http://localhost:3000 --walk-mounts --bearer-app "$TEST_PRINCIPAL_A_TOKEN"`. The `--walk-mounts` flag is licensed by Open-Q5 (resolved 2026-05-01). Per-mount credentials are scoped via `--bearer-{prefix}` per PRD-600-R32.
- **Static walker reuse (PRD-706-R13).** The bridge consumes `@act/validator`'s tree walker by importing `createActWalker` from `@act/validator`. PRD-600 owns the walker; PRD-706 binds the bridge to use it rather than reimplementing. This is the foreclosure that prevents drift.

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-02 | Jeremy Forsythe | Initial draft. Reference example for the full hybrid surface: a single deployment composing a static Plus marketing mount (built by `@act/cli` from markdown + Contentful), a runtime Standard app mount (served by `@act/runtime-next` with `basePath: "/app"`, inheriting PRD-705's per-tenant patterns), and an MCP bridge surfacing the union of both trees under the `act://` URI scheme. Demonstrates `mounts` composability, per-mount level declaration, cross-protocol auth boundaries (anonymous public marketing + authenticated tenant-scoped app + auth-bridged MCP), and validator gating across the full surface. Composes PRD-100, PRD-101, PRD-102, PRD-103, PRD-105, PRD-106, PRD-107, PRD-108, PRD-109, PRD-201, PRD-202, PRD-208 (cited only), PRD-400, PRD-409, PRD-500, PRD-501, PRD-505, PRD-600, PRD-602, PRD-705 (inherited). Conformance: Plus (marketing) + Standard (app); declared target Plus per workflow.md. Two PRD ambiguities flagged (Open Qs §5 PRD-602 hybrid bridge construction, §6 PRD-106 runtime-served parent manifest). Status: Draft → In review. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). PRD-602-R3/R4 hybrid-bridge construction ambiguity (Open Q5) filed as docs/amendments-queue.md A4; queued for Phase 6 forge:reviewer triage before PRD-602/PRD-706 implementation. PRD-106-R17/R18 runtime-served parent-manifest ambiguity (Open Q6) accepted as v0.2 candidate; OQ retained. |
