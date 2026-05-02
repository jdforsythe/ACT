# ACT v0.1 — Gap Analysis and Proposed Resolutions

**Status:** Draft (planning)
**Source:** v0.1 working draft at `docs/plan/v0.1-draft.md`
**Last updated:** 2026-04-30

This document catalogues the gaps in the v0.1 draft that, if left unresolved, would be relitigated inside multiple downstream PRDs. Each gap is tiered by what it blocks. Each gap proposes a resolution (mostly technical, written to be defensible) or — when the call is strategic — points to `000-decisions-needed.md`.

Resolutions here are **proposed**, not final. They become normative when picked up into a PRD that reaches `Accepted`.

## Tier legend

- **Tier A** — blocks **all PRD writing**. Resolve before any 100-series PRD enters Draft.
- **Tier B** — blocks the **200-series** (source adapters).
- **Tier C** — blocks the **500-series** (runtime SDK) and PRD-106.
- **Tier D** — blocks the **300-series** (component instrumentation).
- **Tier E** — should resolve but does not block; resolve during P2.
- **Tier F** — deferred to v0.2+; catalogued so we don't lose them.

---

## Tier A — Foundational (blocks all PRD writing)

### A1. Conformance levels are undefined

**Where in draft:** No explicit conformance section. Implied throughout §5.3–§5.13 by capability flags (`subtree`, `ndjson_index`, `etag`, `search`, `change_feed`).
**Impact:** Without conformance levels, every other PRD has to invent its own MUST/SHOULD line, and consumers can't tell what they're getting. This blocks PRD-100 onward.
**Proposed resolution.** Define three named, ordered levels. Producers and consumers declare the level they implement; PRD-600 (validator) reports against levels.

| Level | Includes |
|---|---|
| **Core** | Manifest with required fields; index with summaries + token estimates; node fetch by ID; `etag` field on node and index; `summary` always present; well-known discovery |
| **Standard** | Core + subtree endpoint + `abstract` disclosure + content blocks (markdown, prose, code, data) + `related` cross-refs |
| **Plus** | Standard + ndjson index + `search_url_template` + i18n manifest + multi-block `marketing:*` namespace |

Rules: A producer MUST declare `conformance: { level: "core" \| "standard" \| "plus" }` in the manifest. A consumer MAY require a minimum level and refuse to consume below it. Levels are additive: a Plus producer satisfies Standard and Core consumers automatically.
**Owns:** PRD-107.
**Open subquestions:** Should `runtime` be its own dimension orthogonal to level (`{ level: "standard", profile: "runtime" }`) or roll into the level matrix? Recommendation: orthogonal — see C1.

---

### A2. Versioning policy is hand-waved

**Where in draft:** §4 (table: "`act_version` field at every level"); §5.3 (`act_version: "0.1"`). No semver semantics, no compatibility rules, no deprecation policy.
**Impact:** PRDs cannot classify changes as MAJOR vs MINOR without a policy, and the template's "Versioning & compatibility" section is unwriteable. Blocks every spec PRD.
**Proposed resolution.** Adopt semver-style with an explicit MAJOR.MINOR string in `act_version`.

- `act_version` is `"MAJOR.MINOR"` (no PATCH; spec text revisions don't bump the wire version).
- **MINOR bump** when: adding optional fields, adding optional endpoints, adding values to enums explicitly documented as open, adding new content block types in a documented namespace, adding new conformance capabilities.
- **MAJOR bump** when: removing or renaming required fields, changing the semantics of a required field, narrowing a SHOULD to a MUST or vice versa, adding a value to a closed enum, removing or repurposing a documented endpoint.
- **Consumer rules.** Consumers MUST tolerate unknown optional fields. Consumers MUST reject responses whose `act_version` MAJOR is higher than what they implement (downgrade is undefined). Consumers SHOULD warn on a MINOR mismatch but proceed.
- **Producer rules.** Producers MUST reject input with unknown required fields. Producers MUST NOT silently downgrade a MAJOR (e.g., serve `0.x` to a client that asked for `1.x`).
- **Deprecation window.** A field deprecated in `M.n` MAY be removed in `(M+1).0` at earliest. Deprecation must be documented in the PRD that introduces it and announced via the channel established by `000-governance`.

**Owns:** PRD-108. **Cross-cuts:** every other PRD's "Versioning & compatibility" section.

---

### A3. ID grammar is unspecified

**Where in draft:** §4 (table: "Derived from URL path; overridable"); §5.5 (id field as string); ID strategies §6.4 mention `cms_id`, `route_with_params`, `composite` but never define the resulting string's grammar.
**Impact:** Adapters (200-series) and the runtime profile (16) both use IDs as URL components in `node_url_template: "/act/n/{id}.json"`. Without a grammar, two implementations will produce IDs that pass one validator and fail another, and runtime servers will disagree on whether `/act/n/foo%2Fbar.json` and `/act/n/foo/bar.json` are the same resource.
**Proposed resolution.**
- Grammar: `^[a-z0-9]([a-z0-9._-]|/)*[a-z0-9]$`. Lowercase ASCII alphanumerics, dot, underscore, hyphen, slash. Must start and end with alphanumeric.
- Slash is the path-component separator; segments between slashes follow the same rules and MUST be non-empty.
- Maximum length: 256 bytes UTF-8.
- IDs MUST be percent-encoded when substituted into `node_url_template` and `subtree_url_template`. Specifically: each path segment is encoded with the `pchar` rules of RFC 3986 §3.3, and `/` between segments is preserved verbatim.
- Two IDs that differ only by case are not the same ID; the grammar already excludes uppercase, but adapters MUST normalize on emission.

**Owns:** PRD-100 §IDs. **Blocks:** PRD-106, PRD-200, all 200-series adapters.

---

### A4. Error model is implicit and inconsistent

**Where in draft:** §5.13.2 specifies 401 vs 404 for runtime auth. Nothing for static. No structured error envelope on 4xx/5xx for runtime endpoints. Adapter failure modes mentioned at §10 Q5 but not normalized.
**Impact:** Consumers can't tell "the server is down" from "the resource doesn't exist" from "I'm not allowed to see it" without per-server probing. Adapter authors don't know what to surface as build warnings vs build failures.
**Proposed resolution.**

**Static profile (PRD-105):**
- 200 — file present.
- 304 — `If-None-Match` matches stored ETag.
- 404 — file absent. No body required.
- 5xx — handled by the CDN; ACT does not define a static error envelope.

**Runtime profile (PRD-106):**
- 200 — content returned.
- 304 — ETag match on `If-None-Match`.
- 401 — auth required. MUST include `WWW-Authenticate` per RFC 9110.
- 403 — explicitly forbidden by policy when existence is already known to the requester (rare; usually prefer 404).
- 404 — resource not found OR not accessible to the requester. Both cases return 404 with no distinguishing signal, to avoid leaking existence.
- 410 — resource was previously available and has been deleted. Optional; only when the consumer is expected to drop cached copies.
- 429 — rate-limited; MUST include `Retry-After`.
- 5xx — server error.

**Wire-format error envelope** (runtime, 4xx and 5xx):
```json
{
  "act_version": "0.1",
  "error": {
    "code": "auth_required" | "not_found" | "rate_limited" | "internal" | "validation",
    "message": "human-readable string, no PII",
    "details": { /* optional, code-specific, stable shape */ }
  }
}
```
The `code` enum is closed; new codes require a MINOR bump (A2). `message` is for logging, not for parsing. `details` is optional and per-code.

**Adapter failure modes** (PRD-200 will normalize):
- Recoverable: emit a build warning, mark the affected node `metadata.extraction_status: "partial"` or `"failed"`, continue.
- Unrecoverable: fail the build with a non-zero exit. Adapter MUST NOT silently drop nodes.

**Owns:** PRD-100 (envelope), PRD-105 (static), PRD-106 (runtime), PRD-200 (adapter failure).

---

### A5. Runtime-only discovery has no defined hand-off

**Where in draft:** §10 Q17 explicitly flags this as unresolved. §5.13 assumes the manifest exists at `/.well-known/act.json`, but a pure-SaaS site may serve nothing publicly.
**Impact:** Agents that don't render HTML cannot discover ACT for runtime-only deployments. Blocks PRD-101 and PRD-106.
**Proposed resolution.** Two complementary signals, both REQUIRED for runtime-only deployments:

1. **HTML link element.** Authenticated HTML responses SHOULD include:
   `<link rel="act" href="/.well-known/act.json" type="application/act-manifest+json; profile=runtime">`
2. **HTTP Link header.** Every authenticated response (HTML, JSON, anything) MUST carry:
   `Link: </.well-known/act.json>; rel="act"; type="application/act-manifest+json"; profile="runtime"`

Rationale for both: the HTML link helps tooling that scrapes HTML; the HTTP header is the only universal signal for non-HTML clients. The `profile="runtime"` parameter lets a consumer skip dispatch to a static-only resolver.

The manifest itself MUST set `delivery: "runtime"` to confirm.

**Owns:** PRD-101 (discovery) + PRD-106 (runtime). **Open subquestion:** MIME type registration — see B5.

---

## Tier B — Source-adapter contract (blocks 200-series)

### B1. Adapter lifecycle is informally described

**Where in draft:** §5.10.1 sketches `read()`, `transform()`, `emit()` informally.
**Impact:** Each adapter PRD will reinvent the lifecycle without a normalized framework.
**Proposed resolution.** Define adapter lifecycle in PRD-200 with three required hooks plus three optional ones:

| Hook | When | Purpose |
|---|---|---|
| `init(config, ctx)` | Build start | Validate config, open connections, register ID strategies |
| `enumerate()` | After init | Yield candidate source items (lazy iterator) |
| `transform(item) → Node \| null` | Per item | Map source to ACT Node; null = skip |
| `dispose()` | Build end | Close connections, flush logs |
| `precheck()` (optional) | Before init | Cheap connectivity / credential check, fail fast |
| `delta(since) → AsyncIterator<Item>` (optional) | Incremental builds | Only items changed since last build |

`ctx` provides logger, output sink, ID minter, and the project's resolved config. Hooks are async. Concurrency model: `enumerate` is sequential; `transform` MAY run with bounded concurrency (default 8).
**Owns:** PRD-200.

---

### B2. Multi-source merging is sketched but not specified

**Where in draft:** §5.10.3.
**Impact:** Three reference adapters (CMS + i18n + components) will need to compose per the corporate marketing example (§6.5). Without a defined merge model, each generator will roll its own.
**Proposed resolution.**
- Merge order is configuration order. Last writer wins on collision unless `merge: "error"` is set.
- Collision is detected by ID, not by URL or content hash.
- Each emitted node carries `metadata.source: { adapter: "...", source_id: "..." }` so downstream tools can see provenance.
- An adapter MAY produce *partial* nodes (e.g., the i18n adapter only sets translation fields). The pipeline merges partials by deep-merging objects and concatenating arrays of content blocks (in declared adapter order).
- Conflicts on scalar required fields (e.g., two adapters claim `type`) are errors unless one adapter declares `precedence: "fallback"`.

**Owns:** PRD-200 §Multi-source. **Cross-cuts:** PRD-201–PRD-208.

---

### B3. ID strategies don't compose

**Where in draft:** §6.4 introduces `derived` (URL path), `cms_id`, `route_with_params`, `composite`. No statement about whether two strategies can produce IDs that collide, or how a multi-source build picks one strategy per node.
**Impact:** A site mixing markdown adapter (path-derived IDs) and CMS adapter (`cms_id`) will collide whenever a CMS slug happens to match a path.
**Proposed resolution.** ID strategies are namespaced by adapter unless explicitly declared otherwise. The runtime ID is `{adapter_namespace}/{adapter_id}` by default; configuration can opt out (`namespace: false`) when global stability is required and collisions are guaranteed not to occur.

For the corporate marketing example: markdown adapter emits `docs/getting-started`; CMS adapter emits `cms/page-12345`. The `composite` strategy MAY combine these (`{cms_namespace}/{slug}`). Collision detection runs in the merge step (B2).
**Owns:** PRD-200 + PRD-100 §IDs.

---

### B4. Component contract emission is not normalized

**Where in draft:** §5.11.3 lists three extraction strategies (SSR walking, AST scanning, runtime hooks). No statement of which adapter produces which output, or how the component-extracted blocks attach to the page node.
**Impact:** PRD-300 + PRD-400 + PRD-405 (Next.js generator) all need this defined or they'll diverge.
**Proposed resolution.** Component contracts attach via the page-level contract (§5.11.2):
- Each instrumented component contributes a content block to the page node's `content` array.
- Order in `content` matches the component tree's render order (top-to-bottom, depth-first).
- Adapters MUST set `metadata.extracted_via: "component-contract"` on these blocks.
- If a contract throws or returns malformed data, adapters emit a `marketing:placeholder` block with `metadata.extraction_status: "failed"` and a build warning. (Resolves §10 Q5.)

**Owns:** PRD-300 + PRD-200 (interaction).

---

### B5. MIME types and file extensions are unregistered

**Where in draft:** §1 mentions `.act.json`. No formal MIME type. Discovery (A5) referenced `application/act-manifest+json` speculatively.
**Impact:** Discovery hand-off (A5), PRD-803 naming policy, and any IANA registration work all depend on this.
**Proposed resolution.**
- File extension: `.act.json` for static files (manifest, index, individual nodes). The well-known file is `act.json` (no `.act.` prefix needed; the path establishes intent).
- MIME types (provisional, register via PRD-803):
  - `application/act-manifest+json` — manifest envelope.
  - `application/act-index+json` — index envelope.
  - `application/act-node+json` — single node envelope.
  - `application/act-subtree+json` — subtree envelope.
  - `application/act-error+json` — error envelope per A4.
- All five are subtypes of `+json` so generic JSON tooling continues to work.
- The `profile` MIME parameter carries `static` or `runtime`.

**Owns:** PRD-803. **Blocks:** PRD-101, A5, PRD-600.

---

## Tier C — Runtime profile (blocks 500-series and PRD-106)

### C1. Runtime is a profile, not a level — orthogonality unclear

**Where in draft:** §5.13 introduces "profiles" (static, runtime). §5.13.5 introduces hybrid via `mounts`. The relationship between conformance level (A1) and delivery profile is not stated.
**Impact:** PRD-107 + PRD-500 + PRD-105 + PRD-106 all need this lined up.
**Proposed resolution.** Conformance level and delivery profile are orthogonal. A runtime server can be Core, Standard, or Plus. Manifest declares both:
```json
{
  "conformance": { "level": "standard" },
  "delivery": "runtime"
}
```
For hybrid mounts (§5.13.5), each mount carries its own `delivery` and inherits or overrides level. A consumer that asks "minimum Standard, runtime profile" MUST be served by the runtime mount only; the consumer follows `mounts` to find it.
**Owns:** PRD-107 + PRD-106. **Resolves part of A1's open subquestion.**

---

### C2. ETag derivation under runtime + per-tenant scoping is implementation-defined

**Where in draft:** §5.13.3 says ETag keys off `(content, auth_identity, tenant_id)`. §10 Q16 flags determinism across replicas as a deferred concern.
**Impact:** Without a deterministic recipe, two replicas of the same SaaS will return different ETags for the same content+identity, defeating revalidation.
**Proposed resolution.**
- ETag = `"<algorithm>:<hash>"` where `<algorithm>` is `s256` (SHA-256, base64url, no padding, truncated to 22 chars) for v0.1; new algorithms require MINOR bump.
- Hash input is the canonical JSON encoding (RFC 8785 JCS) of `{ payload, identity, tenant }` where:
  - `payload` is the response envelope minus the `etag` field itself.
  - `identity` is the stable identity key (user ID, principal ID, or null for public-tenant-scoped).
  - `tenant` is the tenant ID or null.
- Servers MUST NOT mix in request-local data (timestamps, request IDs, random nonces).
- Cross-replica determinism is the implementer's responsibility; the recipe makes it possible.

**Owns:** PRD-103 + PRD-109 (security: ETags MUST NOT leak identity).

---

### C3. Auth scheme negotiation is incomplete

**Where in draft:** §5.13.2 lists schemes (cookie, bearer, OAuth 2.0, API key) but doesn't say how a consumer picks one when several are advertised, or what `WWW-Authenticate` headers to send when multiple are accepted.
**Impact:** PRD-500 (SDK contract) needs a deterministic recipe for advertising and selecting auth.
**Proposed resolution.**
- Manifest's `auth.schemes` array is ordered by server preference (most-preferred first).
- 401 responses MUST include one `WWW-Authenticate` header per supported scheme, in the same preference order.
- Consumers SHOULD try schemes in advertised order, falling back on failure.
- For OAuth 2.0, the manifest MUST include both `authorization_endpoint` and `token_endpoint` AND a non-empty `scopes_supported` array. The minimum scope `act.read` is reserved.
- For API keys, the manifest SHOULD declare the header name (default: `Authorization: Bearer <key>` to avoid a custom header proliferation).

**Owns:** PRD-106 + PRD-500.

---

### C4. Per-tenant ID stability across requests is unspecified

**Where in draft:** §5.13.4 says IDs typically use `cms_id` or `(tenant_id, resource_id)` composite "to keep IDs stable across requests for the same user without colliding across tenants." Doesn't pin a rule.
**Impact:** Cache keys depend on this. Without stability, no consumer can revalidate; everything degrades to fresh fetches.
**Proposed resolution.**
- Runtime IDs MUST be stable for a given `(resource, identity, tenant)` triple across the lifetime of that resource.
- Producers MUST NOT mint per-request-unique IDs (e.g., UUIDs minted on each fetch).
- A resource that changes tenancy (rare) is a new resource; the old ID becomes a 404 or 410.
- Identity rotation (token refresh) MUST NOT change IDs as long as the underlying principal is the same.

**Owns:** PRD-106. **Cross-cut:** PRD-109 (security implication: stable IDs are correlatable; the threat model section addresses).

---

### C5. Hybrid `mounts` discovery semantics are loose

**Where in draft:** §5.13.5 example shows `mounts` array with `prefix`, `delivery`, `manifest_url`. No statement on whether `mounts` recurse, how prefix matching works, what happens on overlapping prefixes.
**Impact:** A real corporate site (`acme.com` + `app.acme.com` + `docs.acme.com`) needs deterministic discovery.
**Proposed resolution.**
- `mounts` is a flat array; mounts MUST NOT recurse (a mount manifest MUST NOT itself declare further `mounts`).
- `prefix` is a URL path prefix (origin-relative). Matching is by longest-prefix.
- Overlapping prefixes are a manifest validation error (PRD-600 enforces).
- A consumer fetching `/foo/bar` checks each `prefix`; the longest match wins. Falls through to the parent manifest's index if no mount matches.
- Cross-origin mounts are allowed (`manifest_url` may be absolute); they MUST be on origins the consumer trusts (PRD-109).

**Owns:** PRD-106 + PRD-101.

---

## Tier D — Component instrumentation (blocks 300-series)

### D1. The three declaration patterns aren't pinned to equivalence rules

**Where in draft:** §5.11.1 lists field, decorator, and hook patterns and asserts they're equivalent.
**Impact:** PRD-301/302/303 (framework bindings) need a normative rule for when two patterns produce the same Node.
**Proposed resolution.** All three patterns MUST produce identical content blocks given identical inputs. The bindings expose a shared core that takes `(component, props, contract)` and returns blocks. Patterns differ only in how the contract is associated with the component:
- Field: static class/function property `static act = { ... }`.
- Decorator: `@act({ ... })` annotation.
- Hook: `useActContract({ ... })` inside render.

PRD-300 specifies the canonical contract object shape; PRD-301/302/303 specify only the binding glue. The `extract` function in the contract is identical in all three.
**Owns:** PRD-300.

---

### D2. Variant identity convention is unfixed

**Where in draft:** §5.11.4 + §10 Q6 — proposes `{base_id}@{variant_key}` but flags as needing finalization.
**Impact:** A/B-testing sites with `variants: 'all'` will produce IDs that depend on adapter implementation choices.
**Proposed resolution.** Adopt the proposed convention literally:
- Variant ID format: `{base_id}@{variant_key}`.
- `variant_key` MUST match the ID grammar (A3) restricted to `[a-z0-9-]+`.
- The base node ID `{base_id}` MUST also be emitted, representing the canonical/control variant.
- Each variant node MUST set `metadata.variant: { base_id, key, source: "experiment" | "personalization" | "locale" }`.
- A consumer fetching `{base_id}` gets the canonical; fetching `{base_id}@{key}` gets the variant. Listing variants is via the `related` field on the base node with `relation: "variant_of"` reversed.

**Owns:** PRD-300 + PRD-102.

---

### D3. Build-time extraction safety is unspecified

**Where in draft:** §10 Q5 — sandbox? Recommendation noted (treat failures as warnings).
**Impact:** PRD-300 + PRD-400 (generator) need a stance.
**Proposed resolution.** Adopt the recommendation literally. `extract` runs in the build process's main JS context (no sandbox). Failures are warnings. The placeholder block (B4) carries `metadata.extraction_status: "failed"` and the truncated error message. Generators MUST log the location (file, component, contract).

This intentionally trades safety for simplicity. Sandboxing options (vm2, isolated-vm) are listed in PRD-300's open questions for v0.2 review.
**Owns:** PRD-300 + PRD-400.

---

### D4. Non-SSR-able SPAs lack a defined fallback

**Where in draft:** §10 Q12 — headless rendering via jsdom/Puppeteer noted as "slow and brittle" with no resolution.
**Impact:** PRD-406 (Remix) and PRD-409 (standalone CLI) and any client-only React app needs guidance.
**Proposed resolution.** Two-tier approach:
- **Tier-1 (recommended):** the SPA is rendered via the framework's SSR/SSG path. Generator collects components via `<ActProvider>` during render (per §5.11.3).
- **Tier-2 (fallback):** the SPA is rendered headlessly (Playwright/Puppeteer). Generator MUST mark all extracted nodes with `metadata.extraction_method: "headless-render"` so consumers can apply lower confidence.
- **No tier-3.** "Static AST scan only" is not a supported strategy for component-driven sites because it can't see runtime composition.

PRD-409 (standalone CLI) ships Tier-2 only; framework-specific generators ship Tier-1.
**Owns:** PRD-300 + PRD-400.

---

## Tier E — Should resolve but does not block

### E1. Tokenizer declaration default is unset

**Source:** §10 Q1. Resolution proposed: declare `tokens.tokenizer`. Open: pick a recommended default.
**Proposed:** Recommended default `"o200k"` (OpenAI tiktoken o200k_base, the most current widely-used tokenizer as of 2026). Producers MAY use any tokenizer they declare. Consumers SHOULD treat `"approx"` (character-count / 4) with a 25% confidence band. Move to E because token estimates are hints, not contracts; a wrong default doesn't block anything.

### E2. Versioned docs (multiple `/v1/`, `/v2/` trees)

**Source:** §10 Q2. Resolution proposed: separate manifests under each version path with `supersedes` cross-refs. Solid; flesh out in PRD-100 §Versioned trees. Not blocking because no v0.1 example exercises it.

### E3. Cycle handling in `related`

**Source:** §10 Q8. Resolution proposed: cycles allowed in `related`, never in `children`. Tighten in PRD-102 §related-edges with a normative MUST NOT for `children`-cycles and a producer-side cycle-break recommendation.

### E4. Maximum node body size

**Source:** §10 Q9. Recommendation only — split nodes >10K tokens. Move to a SHOULD in PRD-102 with no hard cap. PRD-600 (validator) emits a warning above 10K tokens, no error.

### E5. Generator-side LLM-written summaries

**Source:** §10 Q10. Resolution proposed: `summary_source: "llm" | "author" | "extracted"`. Adopt as PRD-102 normative.

### E6. CMS schema mapping DSL unification

**Source:** §10 Q7. Defer to v0.2 per draft; document this explicitly in PRD-202/203/204/205/206 as a known divergence.

### E7. ID overrides via frontmatter / config

**Source:** §6.2 mentions overridable IDs but doesn't pin precedence (frontmatter vs config vs default).
**Proposed:** Precedence order: explicit per-node override (frontmatter `id:`) > adapter config glob/rule > default (path-derived for markdown, `cms_id` for CMS, etc.). Document in PRD-200 + PRD-201.

### E8. `summary` length expectations

**Source:** §5.6 lists "summary" as a disclosure level but no length guidance. Proposed: SHOULD be ≤ 50 tokens; if longer, the producer SHOULD use `abstract`. Document in PRD-102 as non-normative guidance with a validator warning above 100 tokens.

---

## Tier F — Deferred to v0.2+ (catalogued only)

### F1. Streaming / change feeds

**Source:** §10 Q3, §10 Q15, §5.13.6. Deferred. Tracked for v0.2.

### F2. Signed manifests / provenance

**Source:** §10 Q4. Wait for trust-layer convergence. Tracked for v0.2+.

### F3. Dataset as a first-class node type

**Source:** §10 Q13. Revisit when adapter signal exists from e-commerce / API-catalog sites. Tracked for v0.2.

### F4. Per-node `agents only` / `no train` flag

**Source:** §10 Q14. Defer to robots.txt + Content-Signal headers (out of scope). Document in PRD-109 as a non-feature with rationale.

### F5. Embeddings sidecar

**Source:** §5.9 search optionality. Deferred per draft; PRD-603 marked deprecated for v0.1 in 000-INDEX.md.

---

## Strategic gaps (cross-reference to 000-decisions-needed.md)

The following gaps require strategic input and cannot be resolved by technical proposal alone.

| Gap | Why it's strategic | Decision question |
|---|---|---|
| Spec governance model | Affects who controls the spec long-term | Q1 |
| Final naming (ACT vs ACG vs AGTREE; `.act` mark) | Trademark and branding implications | Q2 |
| Reference implementation language(s) | TypeScript-only is fastest; polyglot widens adoption but multiplies maintenance | Q3 |
| Spec text license vs reference code license | CC-BY-4.0 + Apache-2.0 is the typical pairing; alternates carry consequences | Q4 |
| Source adapter version pinning | Pinning to spec versions vs floating affects ecosystem churn | Q5 |
| MCP version range commitment for the bridge | Affects PRD-602 scope and ongoing maintenance | Q6 |
| Initial design partners (Astro? Docusaurus? Mintlify?) | Drives which P3 examples land first and which generators get priority | Q7 |
| Hosted validator at launch (yes/no) | Operational commitment vs adoption friction trade-off | Q8 |

See `000-decisions-needed.md` for full framing of each.

---

## What this document is not

- Not a substitute for the v0.1 draft. PRD authors MUST read `docs/plan/v0.1-draft.md` directly.
- Not a commitment. Resolutions here are proposals until ratified by an Accepted PRD.
- Not exhaustive. Authoring P1 PRDs will surface new gaps; add them here, do not bury them inside individual PRDs.
