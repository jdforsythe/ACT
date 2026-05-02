# PRD-01 — Gap analysis and resolutions

**Status:** Living document — updated as gaps surface during PRD authoring.
**Last updated:** 2026-05-01

This document catalogs the unresolved questions identified in `DRAFT-spec-v0.1.md`, organized by tier (which PRDs each gap blocks). Per ADR-0003, technical gaps get a proposed resolution inline; strategic gaps cross-reference `prd/00-decisions-needed.md`. Every PRD that touches an affected surface MUST cite the relevant gap ID.

## How to use this file

1. PRD authors look up gaps that affect the PRD they're writing.
2. Each gap states a proposed resolution. Authors adopt the resolution unless they object — in which case they raise it for ADR.
3. New gaps surfaced during authoring are appended here, classified by tier, and resolved before the affected PRD can be marked Accepted.

## Tier legend

| Tier | Meaning |
|---|---|
| **A** | Blocks all PRD writing. Must be resolved in P0. |
| **B** | Blocks adapter PRDs (20-series). |
| **C** | Blocks runtime PRDs (16, 50-series). |
| **D** | Blocks component-instrumentation PRDs (30-series). |
| **E** | Should resolve, but doesn't block. |
| **F** | Deferred to v0.2+. |

## Resolution format

Every gap uses this template:

```
### G-NN [Tier X] <Short title>

**Gap:** <description and source>
**Impact:** <which PRDs are blocked or affected>
**Proposed resolution:** <concrete answer using MUST/SHOULD/MAY where appropriate>
**Rationale:** <why this resolution; trade-offs>
**Residual decision:** <D-NN cross-reference or "None">
**Affects:** <PRDs that should cite this gap>
```

---

## Tier A — blocks all PRD writing

### G-A1 [Tier A] Conformance levels

**Gap:** Draft §10 lists "conformance levels" as an open question but does not define what compliance means. Without this, every PRD's "Specification" section has no benchmark to satisfy.

**Impact:** Blocks PRD-17 directly; every other PRD references conformance.

**Proposed resolution:** Define three conformance levels:

- **Core** — manifest + index + node + ETags + summary disclosure level. The minimum viable ACT.
- **Standard** — Core + subtree bundles + abstract disclosure level + the full content-block taxonomy from PRD-12.
- **Plus** — Standard + NDJSON index + search endpoint + i18n.

Producers (generators, runtime SDKs) and consumers (agents, validators) each declare which level they implement. The manifest's `capabilities` array advertises level-specific features. PRD-17 enumerates exactly which features each level requires.

**Rationale:** Three levels balance simplicity (one bit isn't enough; five+ is too many to reason about) with adoption (Core is implementable in a weekend; Plus is a serious project). Mirrors HTTP/1.1 RFC compliance levels and CommonMark "core" vs "extensions" pattern.

**Residual decision:** None.

**Affects:** PRD-17 (defines the levels), PRD-10/11/12/13/14/15/16 (each marks features by level), every adapter/SDK PRD (declares supported level).

### G-A2 [Tier A] Versioning policy

**Gap:** Draft §4 says "version field on every level" but doesn't specify what changes are MAJOR vs MINOR or how clients handle version drift.

**Impact:** Every PRD, because every PRD's "Versioning & compatibility" section needs this rubric.

**Proposed resolution:** Semver-style with two-part versions.

- `act_version` is `MAJOR.MINOR` (no patch). This draft is `0.1`.
- **MINOR** changes: adding optional fields; adding new block types under reserved namespaces; adding new optional capabilities; adding new node types via namespacing.
- **MAJOR** changes: removing or repurposing any field; changing semantics of required fields; changing the required-field set on the manifest, index, or node envelopes; renaming fields; changing the meaning of a status code or error envelope shape.
- Agents MUST tolerate unknown optional fields (forward compatibility).
- Servers MUST reject manifests with unknown required fields with a 400-equivalent error (per G-A4 envelope).
- Per-PRD versioning sections expand on what's MAJOR vs MINOR for that surface.

**Rationale:** Two-part versions are sufficient for a wire format (no hot-fix patches to bytes on the wire). Strict MUST/SHOULD on tolerance prevents the OpenAPI-style ecosystem fragmentation where everyone tolerates extension fields differently.

**Residual decision:** None for the rule; D-05 (adapter version pinning) is a related but separate strategic call.

**Affects:** PRD-18 (defines the policy); every PRD's "Versioning & compatibility" section.

### G-A3 [Tier A] ID grammar

**Gap:** Examples in the draft show IDs like `intro/getting-started`, `endpoints/objects` — using `/` as a separator — but the spec never defines legal characters, length, or whether `/` is structural.

**Impact:** Blocks PRD-10 (IDs are the universal handle); affects every PRD that constructs or parses IDs.

**Proposed resolution:**

- Pattern: `^[a-z0-9]([a-z0-9._-]|/)*[a-z0-9]$`
- Maximum length: 256 chars.
- `/` is the only path separator. No leading or trailing `/`. No double slashes (`//`).
- IDs are case-sensitive.
- IDs are URL-safe by construction — no URL-encoding required for path placeholders.
- Empty path segments are forbidden (no `foo//bar`).
- Reserved suffixes: `@<variant_key>` (per G-D2) and `#<fragment>` (reserved for future use).

**Rationale:** Strict alphabet (lowercase, digits, `.-_/`) avoids ambiguity across filesystems, URL schemes, and storage backends. 256 chars is generous; longer IDs suggest structural problems. Case-sensitivity matches URL semantics on most servers and avoids "Foo" / "foo" collision bugs.

**Residual decision:** None.

**Affects:** PRD-10 (defines grammar); every PRD that constructs IDs.

### G-A4 [Tier A] Error model

**Gap:** Draft §5.13 mentions auth-related status codes loosely (401, 404) but doesn't define a wire-format error envelope or enumerate codes.

**Impact:** Blocks PRD-16 (runtime profile) and PRD-50 (runtime SDK contract). Affects PRD-60 (validator).

**Proposed resolution:**

Runtime endpoints return one of four status codes:

- **200** — OK with body.
- **304** — Not Modified, in response to `If-None-Match` matching the current ETag. No body.
- **401** — Authentication required. Includes `WWW-Authenticate` header.
- **404** — Not found OR not accessible to the requester. Servers MUST NOT distinguish between these to avoid leaking the existence of resources.

All 4xx and 5xx runtime responses (other than 304) MUST carry a JSON body matching this envelope:

```json
{
  "act_version": "0.1",
  "error": {
    "code": "<short-code>",
    "message": "<human-readable>",
    "details": { /* optional, code-specific */ }
  }
}
```

Reserved error codes (extensible via namespacing):

- `unauthorized` — auth required or insufficient.
- `not_found` — resource does not exist or is not accessible.
- `rate_limited` — request rate exceeded; `details.retry_after_seconds` provided.
- `version_mismatch` — agent's `Accept` header requested a version this server does not serve.
- `malformed_request` — bad request shape (missing required header, invalid query param).
- `internal` — server error; agent should retry with backoff.

Static profile: only 404 (file not found) is meaningful. CDNs handle this without an envelope.

**Rationale:** Distinguishing 401 from 404-for-access-denied is a classic info-leak pattern. Standardized envelope means agents can implement one error handler. Code namespace makes future additions safe.

**Residual decision:** None.

**Affects:** PRD-16 (runtime profile), PRD-50 (SDK contract), PRD-60 (validator).

### G-A5 [Tier A] Runtime-only discovery

**Gap:** Draft §5.13 and Open Question 17 acknowledge that authenticated-only sites have no public `.well-known/act.json` to discover. The mechanism is undefined.

**Impact:** Blocks PRD-11 (discovery) and PRD-16 (runtime profile). Without this, runtime-only deployments are undiscoverable.

**Proposed resolution:** A site that only serves authenticated content MUST emit BOTH:

1. An HTML `<link>` element on authenticated pages:
   ```html
   <link rel="act" href="/.well-known/act.json" type="application/act-runtime+json">
   ```
2. An HTTP `Link` header on authenticated responses:
   ```
   Link: </.well-known/act.json>; rel="act"; type="application/act-runtime+json"
   ```

Both are required so agents that don't render HTML (CLI agents, server-side agents) still discover via the header.

The `type` parameter distinguishes profiles:

- `application/act+json` — static profile.
- `application/act-runtime+json` — runtime profile.

Mixed deployments (per draft §5.13.5 `mounts`) MAY emit multiple `Link` headers, one per mount.

**Rationale:** Two channels (HTML + HTTP header) cover both browser and non-browser agents. Reusing `rel="act"` matches existing `rel` registry conventions. The MIME type distinction lets agents pick the right parser without fetching the manifest first.

**Residual decision:** None.

**Affects:** PRD-11 (discovery), PRD-16 (runtime profile), PRD-19 (security — discoverability vs leak).

---

## Tier B — blocks adapter PRDs (20-series)

### G-B1 [Tier B] Adapter contract version negotiation

**Gap:** PRD-20 will define the adapter contract; adapters built today must remain valid against future spec versions.

**Impact:** Blocks PRD-20; every adapter PRD inherits the resolution.

**Proposed resolution:** Each adapter declares a supported spec range using `peerDependency` semantics:

```json
{
  "name": "@act/adapter-contentful",
  "peerDependencies": {
    "@act/spec": ">=0.1 <0.3"
  }
}
```

The generator validates the declared range against its loaded `@act/spec` version at init time. Mismatches fail the build with a clear error pointing to the offending adapter and supported range.

**Rationale:** `peerDependency` matches Node ecosystem conventions; explicit ranges prevent silent breakage on minor bumps that an adapter hasn't been tested against.

**Residual decision:** D-05 (whether ranges are strict or float).

**Affects:** PRD-20 (framework), every adapter PRD (21–28).

### G-B2 [Tier B] Multi-source merging with i18n

**Gap:** Draft §5.10.3 defines merge policies but doesn't specify the precedence order when CMS, i18n, and component-tree adapters all contribute to the same node.

**Impact:** Blocks PRD-20, PRD-27 (i18n adapter), PRD-72 (corporate marketing example).

**Proposed resolution:** The merger applies adapter contributions in this fixed order (lowest precedence first; later overrides earlier):

1. **CMS adapter** — contributes the base content (typed blocks from the CMS schema).
2. **i18n adapter** — layers translated strings on top, keyed by `(locale, namespace, key)`.
3. **Component-tree adapter** — applies last; component contracts override CMS values for marketing block types when both contribute.

Conflicts within a single layer follow the configured `merge_policy` (`error`, `first`, `last`, `merge`). Conflicts across layers always follow the order above.

**Rationale:** CMS is the authoritative content source; i18n is a transformation layer; components are the rendering layer that has final say on structure (since they own the design system). This mirrors how the production page renders.

**Residual decision:** None.

**Affects:** PRD-20, PRD-27, PRD-72.

### G-B3 [Tier B] Provenance fields on nodes/blocks

**Gap:** Build debugging and content trust both need to know which adapter contributed what. The draft doesn't specify a provenance mechanism.

**Impact:** Blocks PRD-20; affects every adapter PRD and PRD-60 (validator).

**Proposed resolution:** Every `NodeDraft` and `ContentBlock` carries an optional `_source` field:

```json
{
  "_source": {
    "adapter": "contentful",
    "id": "abc123",
    "path": "spaces/acme/entries/abc123",
    "line": 42
  }
}
```

`_source` is stripped from emitted node files by default. The generator includes it when run with `--debug` or `--keep-provenance`. The validator uses `_source` to surface "this block came from <adapter X> at <path>" in error messages.

**Rationale:** Underscore prefix is a convention for "build metadata, not user-facing." Stripping by default keeps the wire format clean; opt-in for debugging is essential for catching merge bugs.

**Residual decision:** None.

**Affects:** PRD-20, PRD-60, every adapter PRD (for what to populate).

### G-B4 [Tier B] Adapter precedence with i18n catalogs

**Gap:** PRD-27 will need a precise algorithm for layering i18n strings into nodes contributed by other adapters.

**Impact:** Blocks PRD-27, PRD-72.

**Proposed resolution:** i18n catalogs contribute strings keyed by `(locale, namespace, key)`. The merger applies them after the CMS layer but before the component-tree layer (per G-B2). Algorithm:

1. For each locale `L` in `manifest.locales.available`:
   1. Walk the merged node tree (post-CMS).
   2. For each node with a `metadata.i18n_namespace` field, look up `catalog[L][namespace]`.
   3. For each block in the node, replace any `{i18n:key}` placeholder strings with the resolved value.
   4. If the catalog lacks a key, fall back to the default-locale value and tag the block with `metadata.translation_status: "fallback"` (per G-B6).
2. Component-tree adapter runs last and may override any value.

**Rationale:** Placeholder syntax `{i18n:key}` is explicit and grep-able. Tagging fallbacks lets agents detect translation gaps. Algorithmic ordering prevents "spooky action at a distance" between adapters.

**Residual decision:** None.

**Affects:** PRD-27, PRD-20, PRD-72.

### G-B5 [Tier B] CMS schema mapping vocabulary

**Gap:** Draft §6.4.2 shows a Contentful-specific mapping shape. Sanity, Storyblok, Strapi, Builder all have different shapes. The draft acknowledges (Open Question 7) but does not unify them.

**Impact:** Affects PRD-22 through PRD-26.

**Proposed resolution:** v0.1 does NOT unify CMS mapping into a single DSL. Each CMS adapter ships its own mapping config because each CMS has different content modeling primitives (Contentful's content types vs. Sanity's GROQ vs. Storyblok's components vs. Strapi's content types vs. Builder's visual blocks).

v0.1 mappings MUST share a common conceptual vocabulary (declared per-PRD): `act_type`, `id_field`, `title_field`, `summary_field`, `body_field`, `fields[].block_type`. Adapters MAY add CMS-specific fields under namespaced keys.

**v0.2 candidate:** unified mapping DSL once 3+ CMS adapters ship and patterns are clear. Don't design it on intuition.

**Rationale:** Premature unification of 5 different content models forces awkward compromises in the DSL. Pattern-finding requires real implementations first.

**Residual decision:** None for v0.1.

**Affects:** PRD-22, PRD-23, PRD-24, PRD-25, PRD-26.

### G-B6 [Tier B] Untranslated key behavior

**Gap:** Draft §5.12.4 outlines the behavior but not the exact tagging convention.

**Impact:** Blocks PRD-14, PRD-27.

**Proposed resolution:** When a locale lacks a translation for a given key, the generator falls back to the default-locale value and tags the affected block:

```json
{
  "type": "prose",
  "format": "markdown",
  "text": "<default-locale text>",
  "metadata": {
    "translation_status": "fallback",
    "fallback_from": "en-US"
  }
}
```

Agents MAY use this to:

- Warn the user the content isn't in their locale.
- Prefer fetching the default-locale node directly.
- Surface translation gaps to authors via tooling.

The node-level `metadata` MAY also carry a `translation_completeness: 0.0–1.0` value — fraction of blocks that are not fallbacks.

**Rationale:** Explicit tagging beats silent fallback. Agents that don't care can ignore the metadata; agents that do can reason about it.

**Residual decision:** None.

**Affects:** PRD-14, PRD-27.

---

## Tier C — blocks runtime PRDs (16, 50-series)

### G-C1 [Tier C] Authentication schemes — formal list

**Gap:** Draft §5.13.2 lists "cookie, bearer, oauth2, api-key" prose-style; the manifest's `auth.schemes` field needs an enumerated valid list.

**Impact:** Blocks PRD-16.

**Proposed resolution:** PRD-16 enumerates supported scheme strings:

- `none` — no authentication.
- `cookie` — session cookie (any name; server validates).
- `bearer` — `Authorization: Bearer <token>`.
- `oauth2` — OAuth 2.0 with token endpoint declared in `manifest.auth.oauth2`.
- `api-key` — `X-API-Key: <key>` or query param `?api_key=<key>` (server declares).
- `mtls` — mutual TLS with client certificate.

The `manifest.auth.schemes` array uses these exact strings. New schemes require a PRD update (MINOR version bump per G-A2).

**Rationale:** Closed set lets agents pre-compute their auth strategy from the manifest. Open extension via "future PRD" is more disciplined than a free-form string field.

**Residual decision:** None.

**Affects:** PRD-16.

### G-C2 [Tier C] Permissions model for runtime

**Gap:** Draft §5.13.4 says "scoped to the requester's accessible content" but doesn't prescribe an internal permissions model.

**Impact:** Blocks PRD-16, PRD-50.

**Proposed resolution:** ACT runtime is **capability-shaped at the wire level** but does not prescribe an internal permissions model. The wire format simply:

1. Omits inaccessible nodes from the index.
2. Returns 404 for direct fetches of inaccessible nodes (per G-A4).
3. Carries the same shape regardless of underlying model.

Servers decide per-request what the requester can see. RBAC, ACL, capability-based, ReBAC — all valid implementations. The spec is intentionally silent on this so adopters can wire ACT into existing authorization systems.

**Rationale:** Prescribing an authorization model would force every adopter to map their existing system into the spec's model. Wire-level capability shape gives agents predictable behavior without forcing servers into a particular paradigm.

**Residual decision:** None.

**Affects:** PRD-16, PRD-50.

### G-C3 [Tier C] ETag determinism across replicas

**Gap:** Open Question 16 in the draft. Sharded SaaS deployments must produce the same ETag for the same `(content, user)` from any replica.

**Impact:** Blocks PRD-13, PRD-16, PRD-50.

**Proposed resolution:** Runtime ETag MUST be derived from a deterministic hash of:

```
hash(content_payload || auth_identity_token || tenant_id)
```

Where:

- `content_payload` is the canonical JSON serialization of the response body.
- `auth_identity_token` is a stable hash of the requester's identity (e.g., `sha256(user_id)`), not the auth credential itself (which rotates).
- `tenant_id` is the requester's tenant identifier, omitted (empty string) for non-tenant deployments.

ETags MUST NOT include:

- Request timing.
- Random nonces.
- Replica-local state.
- Anything else that varies between replicas serving the same logical content.

Recommended hash: SHA-256, prefixed `sha256:` in the `etag` field.

**Rationale:** Same content, same user, same ETag — across replicas, across hot reloads, across deploys (until content changes). Without this, `If-None-Match` revalidation breaks under load balancing.

**Residual decision:** None.

**Affects:** PRD-13, PRD-16, PRD-50.

### G-C4 [Tier C] Per-tenant ID strategy

**Gap:** Tenant-aware deployments need IDs stable across requests for the same user, without colliding across tenants.

**Impact:** Blocks PRD-16, PRD-75 (SaaS example).

**Proposed resolution:** Runtime IDs MUST be stable across requests for the same user. Recommended strategies (per `id_strategy` config):

- `cms_id` — use the resource's database/CMS ID. MUST be tenant-scoped (e.g., prefix with tenant slug: `tenant-acme/doc-123`).
- `composite` — hash of `(tenant_id, resource_id)`, deterministic.
- `custom` — application-defined function with the same constraints.

IDs MUST NOT collide across tenants. Servers SHOULD validate this in development by asserting that decoded IDs include tenant scope.

**Rationale:** Stability across requests is essential for caching (G-C3). Collision avoidance prevents one tenant's cache hit from leaking to another tenant's request.

**Residual decision:** None.

**Affects:** PRD-16, PRD-75.

### G-C5 [Tier C] Cross-origin embed (CORS)

**Gap:** Browser-based agents (Claude in Chrome, Copilot extensions) need to fetch ACT endpoints from origins other than the host page's. The draft doesn't address CORS.

**Impact:** Blocks PRD-16, PRD-19.

**Proposed resolution:** Runtime ACT endpoints MUST send CORS headers permissive enough for browser-based agents to fetch them. Two patterns:

1. **Public unauthenticated runtime:** `Access-Control-Allow-Origin: *`, no credentials.
2. **Authenticated runtime:** `Access-Control-Allow-Origin: <agent-origin>` from a configurable allowlist + `Access-Control-Allow-Credentials: true`. Agents originate from known schemes (`chrome-extension://`, `https://claude.ai`, etc.); the server's allowlist is per-deployment.

Servers MUST handle `OPTIONS` preflight for `GET` requests with `Authorization` and `If-None-Match` headers.

**Rationale:** Without permissive CORS, browser agents can't fetch authenticated ACT — defeating the runtime profile's main advantage over MCP. Allowlist (not `*`) for credentialed access avoids opening the door to drive-by content theft.

**Residual decision:** None for the rule. PRD-19 may add an "agent origin registry" recommendation.

**Affects:** PRD-16, PRD-19.

### G-C6 [Tier C] CSRF on runtime endpoints

**Gap:** Authenticated GET endpoints with browser-attached cookies are CSRF-relevant.

**Impact:** PRD-16, PRD-19.

**Proposed resolution:** ACT runtime endpoints are **GET-only and side-effect-free**. CSRF is not a concern because no state changes. PRD-16 includes a normative requirement:

> Servers MUST NOT mutate state on ACT endpoint requests. ACT endpoints MUST use the GET method exclusively. POST/PUT/PATCH/DELETE on ACT endpoints MUST return 405 Method Not Allowed.

Apps that need write semantics expose them via MCP (per Appendix E of the draft) or their own HTTP API — never as ACT endpoints.

**Rationale:** Tying ACT to read-only GET makes the entire CSRF class of vulns inapplicable. This is a deliberate scope boundary, not a limitation.

**Residual decision:** None.

**Affects:** PRD-16, PRD-19.

---

## Tier D — blocks component-instrumentation PRDs (30-series)

### G-D1 [Tier D] Server vs client components (RSC handling)

**Gap:** Draft §5.11 doesn't address React Server Components or Next.js App Router server/client boundaries.

**Impact:** Blocks PRD-30, PRD-31, PRD-45.

**Proposed resolution:** PRD-30/31 specify the React adapter handles RSC boundaries by extracting contracts from BOTH server and client components:

- **Server components:** props are resolved at render time; extraction runs during the server render.
- **Client components:** static analysis fallback (parse the source, evaluate `extract` against statically-known props); render-time only when the component is rendered server-side first.
- **Mixed trees:** the SSR walk extracts server-component contracts; client-component subtrees use the props passed from the server boundary.

For pure-client-component subtrees that never render on the server (e.g., interactive widgets), the headless render fallback (G-D3) applies.

**Rationale:** RSC is the dominant React pattern in 2025+ — ignoring it abandons the largest target ecosystem. Static + render hybrid covers nearly all cases without forcing apps to restructure.

**Residual decision:** None.

**Affects:** PRD-30, PRD-31, PRD-45.

### G-D2 [Tier D] A/B variant ID convention

**Gap:** Draft §5.11.4 mentions variant emission but doesn't pin the ID convention.

**Impact:** Blocks PRD-30.

**Proposed resolution:** Variant IDs follow the pattern `{base_id}@{variant_key}` where:

- `base_id` is the canonical (default-experiment) node ID.
- `variant_key` is a stable, URL-safe slug (e.g., `control`, `experiment-a`, `pricing-v2`). Constrained to `[a-z0-9-]+`, max 64 chars.

Variant nodes carry:

```json
{
  "id": "pricing@experiment-a",
  "metadata": {
    "variant_of": "pricing",
    "variant_key": "experiment-a"
  }
}
```

The default-experiment node uses just `base_id` (no `@<key>` suffix) and is marked as canonical. Agents that don't care about variants fetch the canonical; agents doing variant analysis can enumerate all variants by walking `metadata.variant_of` references.

**Rationale:** `@` is unused in path segments and visually distinguishes variants from path components. Reserved suffix means agents don't need to special-case parsing.

**Residual decision:** None.

**Affects:** PRD-30.

### G-D3 [Tier D] Render-time extraction for non-SSR-able apps

**Gap:** Open Question 12. Apps without SSR (legacy CRA, pure client SPAs) need a fallback.

**Impact:** Blocks PRD-30, PRD-31, PRD-32, PRD-33.

**Proposed resolution:** PRD-30 supports a fallback mode using a headless renderer (Playwright, Puppeteer, or jsdom):

- Slower: ~5–30s per route depending on hydration time.
- Brittle: apps with long async hydration or unmounted-by-default sections may produce incomplete extraction.
- Documented as `fallback_only` extraction mode; emits a build warning encouraging SSR migration.
- Default: SSR-based extraction. Fallback mode is opt-in via `extraction_mode: "headless"` in adapter config.

PRD-31/32/33 each document framework-specific quirks (e.g., React Suspense boundaries, Vue async components, Angular lazy modules).

**Rationale:** Strict SSR-only would lock out legacy SPAs entirely. Documenting the trade-offs honestly — "this works but it's slower and more fragile" — lets adopters make informed choices.

**Residual decision:** None.

**Affects:** PRD-30, PRD-31, PRD-32, PRD-33.

### G-D4 [Tier D] MDX JSX policy

**Gap:** Draft §5.10.2 says "JSX is stripped or rendered to prose" — too vague for an implementer.

**Impact:** Blocks PRD-21.

**Proposed resolution:** PRD-21 specifies MDX handling:

- By default, MDX components in prose are **stripped** — only their text children are extracted into the prose block. Component props are discarded.
- Authors who want richer extraction declare `act` contracts on those components, which then participate in extraction like any React component (per PRD-31).
- Components without `act` contracts are stripped silently (no warning) unless `strict_mdx: true` in adapter config, which warns on every stripped component.

Example: `<Callout type="warning">Don't do X.</Callout>` strips to `Don't do X.` by default. With an `act` contract on `Callout`, it produces a structured `callout` block.

**Rationale:** Default-strip prevents authors from accidentally publishing component noise as content. Opt-in structured extraction matches the React adapter's general philosophy: contracts are explicit.

**Residual decision:** None.

**Affects:** PRD-21, PRD-31.

### G-D5 [Tier D] Component contract evaluation safety

**Gap:** Open Question 5. `extract` functions run at build time; what if they throw or return malformed data?

**Impact:** Blocks PRD-30.

**Proposed resolution:** `extract` function errors are caught and emit a build warning (NOT a build failure). The affected block is emitted as:

```json
{
  "type": "marketing:hero",
  "metadata": {
    "extraction_status": "failed",
    "extraction_error": "TypeError: Cannot read property 'title' of undefined",
    "component": "Hero"
  }
}
```

Malformed return values (missing required fields, wrong types) are coerced where safe (e.g., empty string for missing `summary`) and tagged similarly.

The CLI's `--strict` mode promotes warnings to errors.

**Rationale:** A single bad extraction shouldn't break the entire build. Tagging failures preserves the structural shape while signaling the problem to operators.

**Residual decision:** None.

**Affects:** PRD-30, PRD-31, PRD-32, PRD-33.

---

## Tier E — should resolve, doesn't block

### G-E1 [Tier E] Per-block JSON Schemas

PRD-12 ships a JSON Schema per block type. Custom blocks (`type: "custom"` or namespaced like `acme:thing`) are validated against an open-ended schema only. Affects: PRD-12, PRD-60.

### G-E2 [Tier E] Pagination on large nodes

Recommend splitting nodes >10K tokens into children. Hard limit not specified; servers MAY return 413 if an individual node exceeds an implementation limit. The validator warns at 10K, errors at 50K. Affects: PRD-12, PRD-60.

### G-E3 [Tier E] Subtree size limits

A subtree fetch at the root of a 10K-node site is unwieldy. Resolution: subtree responses MAY include `next_token` for pagination; agents request `?continue=<token>` for the next page. Servers SHOULD limit individual subtree responses to 1MB or 100 nodes, whichever is smaller. Affects: PRD-15.

### G-E4 [Tier E] Search endpoint shape

PRD-10 defines the search response envelope; semantics (BM25? vector? hybrid?) are implementation-defined. Servers declare matching style in the response: `match_type: "lexical" | "semantic" | "hybrid"`. Affects: PRD-10.

### G-E5 [Tier E] Streaming index consumption semantics

NDJSON index: agents MAY parse partial responses. Servers SHOULD send `Content-Length` when complete; absence implies streaming. Agents that need atomicity SHOULD use the JSON variant. Affects: PRD-15.

### G-E6 [Tier E] Tokenizer registry

PRD-10 defines valid `tokens.tokenizer` values: `approx` (chars/3.5), `cl100k`, `o200k`, `claude`, `<custom>`. Custom values MUST be namespaced (e.g., `acme:tok-v2`). Affects: PRD-10.

### G-E7 [Tier E] License granularity

Per-node licenses via `metadata.license` (SPDX identifier or URL). Manifest license is the default; node license overrides. Block-level overrides are not supported (too fine-grained). Affects: PRD-10.

### G-E8 [Tier E] Sitemap.xml compatibility

Generators MAY emit a `sitemap.xml` alongside ACT files for SEO crawler compatibility. Not normative; PRD-15 documents the convention as an optional generator feature. Affects: PRD-15, PRD-40.

---

## Tier F — deferred to v0.2+

| ID | Gap | Why deferred |
|---|---|---|
| **G-F1** | Change feeds / SSE for runtime | Defer to v0.2; v0.1 points to MCP for push semantics. |
| **G-F2** | Signed manifests | Align with whatever LLMFeed / Content-Signal converges on; defer until ecosystem signal. |
| **G-F3** | Embeddings shipping in nodes | Defer to v0.2; placeholder PRD-63. |
| **G-F4** | Federated / cross-origin embeds | Defer until a real federated docs network materializes. |
| **G-F5** | Versioned docs (v1, v2 of a spec) | Defer; recommend interim approach: separate manifests under `/v1/.well-known/act.json` etc., with cross-version `supersedes` references on nodes. |

---

## Cross-reference table

| Gap | Tier | Affected PRDs | Residual decision |
|---|---|---|---|
| G-A1 Conformance levels | A | 17, 10–16 | — |
| G-A2 Versioning policy | A | 18, all | — |
| G-A3 ID grammar | A | 10, all that construct IDs | — |
| G-A4 Error model | A | 16, 50, 60 | — |
| G-A5 Runtime-only discovery | A | 11, 16, 19 | — |
| G-B1 Adapter version negotiation | B | 20, 21–28 | D-05 |
| G-B2 Multi-source merging with i18n | B | 20, 27, 72 | — |
| G-B3 Provenance fields | B | 20, 60, 21–28 | — |
| G-B4 i18n catalog precedence | B | 27, 20, 72 | — |
| G-B5 CMS schema mapping vocabulary | B | 22, 23, 24, 25, 26 | — |
| G-B6 Untranslated key behavior | B | 14, 27 | — |
| G-C1 Auth schemes formal list | C | 16 | — |
| G-C2 Permissions model | C | 16, 50 | — |
| G-C3 ETag determinism | C | 13, 16, 50 | — |
| G-C4 Per-tenant ID strategy | C | 16, 75 | — |
| G-C5 CORS | C | 16, 19 | — |
| G-C6 CSRF (GET-only) | C | 16, 19 | — |
| G-D1 RSC handling | D | 30, 31, 45 | — |
| G-D2 A/B variant IDs | D | 30 | — |
| G-D3 Headless render fallback | D | 30, 31, 32, 33 | — |
| G-D4 MDX JSX policy | D | 21, 31 | — |
| G-D5 Contract evaluation safety | D | 30, 31, 32, 33 | — |
| G-E1 Per-block JSON Schemas | E | 12, 60 | — |
| G-E2 Large node pagination | E | 12, 60 | — |
| G-E3 Subtree size limits | E | 15 | — |
| G-E4 Search endpoint semantics | E | 10 | — |
| G-E5 NDJSON streaming semantics | E | 15 | — |
| G-E6 Tokenizer registry | E | 10 | — |
| G-E7 License granularity | E | 10 | — |
| G-E8 Sitemap.xml compatibility | E | 15, 40 | — |
| G-F1 Change feeds | F | v0.2 | — |
| G-F2 Signed manifests | F | v0.2+ | — |
| G-F3 Embeddings in nodes | F | v0.2 (PRD-63) | — |
| G-F4 Federated embeds | F | v0.3+ | — |
| G-F5 Versioned docs | F | v0.2 | — |

## Changelog

- 2026-05-01 — Initial gap catalog. 30 gaps across 6 tiers. Tier A (5) and Tier B (6) and Tier C (6) and Tier D (5) all resolved. Tier E (8) resolved. Tier F (5) deferred. One residual strategic decision (D-05).
