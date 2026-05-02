# PRD-109 — Security considerations (PII, scoping, auth boundaries, ETag determinism, threat model)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

The v0.1 working draft (`docs/plan/v0.1-draft.md`) sketches authentication (§5.13.2), caching (§5.13.3), and per-tenant scoping (§5.13.4) but treats them as runtime-profile asides rather than as a coherent security posture. As a consequence: (1) the 401-vs-404 distinction is mentioned in passing but never tied to an information-disclosure threat model, (2) ETag derivation under runtime + per-tenant scoping is flagged as deferred (§10 Q16), (3) auth-scheme negotiation has no determinism rule, (4) per-tenant ID stability is suggested but not specified, (5) cross-origin `mounts` trust is implicit, and (6) per-node "agents only" / "no train" controls are listed as open (§10 Q14) without a clear rationale for exclusion. The 100-series PRDs (envelope, discovery, caching, i18n, IDs, runtime) each have a Security section that would otherwise have to relitigate these threats independently. Gaps **A4** (401-vs-404 / no existence leak), **C2** (ETag MUST NOT leak identity), **C3** (auth scheme negotiation), **C4** (per-tenant ID stability + correlation risk), **C5** (cross-origin mount trust), and **F4** (no per-node access flags, by design) all converge here. This PRD owns the project-wide threat catalog and the producer/consumer obligations that flow from it; every other 100-series PRD's Security section MUST cite this PRD by reference rather than redefining the threats locally.

### Goals

1. Establish the project-wide **threat catalog** as a structured table — (threat, attack vector, control) — that every other 100-series PRD's Security section can cite by reference rather than redefine.
2. Lock the **information-disclosure** rules: 401-vs-404 (existence non-leak); ETag-no-identity-cleartext; PII-out-of-error-messages.
3. Lock the **authentication-boundary** rules: ordered `auth.schemes` array, `WWW-Authenticate` per scheme, OAuth 2.0 required-fields, API-key default header, auth orthogonal to conformance level.
4. Lock the **per-tenant scoping** rules: ID stability for `(resource, identity, tenant)`; cross-tenant collision impossible; explicit acknowledgment that stable IDs are correlatable across requests by an observer (rotation strategies are out of scope for v0.1).
5. Lock the **ETag determinism** security constraint that pairs with PRD-103's derivation recipe: hash input MUST NOT mix request-local data; algorithm output is opaque; length is fixed by algorithm (not informative).
6. Lock the **cross-origin mount trust** evaluation algorithm: scheme equivalence, host equivalence (configurable allowlist), MIME validation. Producers MUST NOT mount onto origins they don't control.
7. Lock the **denial-of-service** posture: bounded subtree depth, recommended traversal bounds for `related` graphs, advisory rate limits, constant-time `act_version` rejection.
8. Document **per-node "agents only" / "no train" flags** as a v0.1 **non-feature with rationale** (gap F4): defer to robots.txt + Content-Signal HTTP headers; introducing per-node flags creates a false sense of control because the content was already fetched before the flag could be observed.
9. Provide test fixtures (positive and negative) that exercise each rule, so PRD-600 has a reference test corpus and other 100-series PRDs can borrow patterns.

### Non-goals

1. Defining the wire-format envelopes (manifest, index, node, subtree, error). PRD-100 (envelope) and PRD-106 (runtime) own those shapes; this PRD constrains security-relevant subsets only.
2. Defining the discovery flow. PRD-101 owns it; this PRD only documents the security implication that the well-known path itself reveals ACT support, by design (gap A5).
3. Defining the ETag derivation recipe. PRD-103 owns the recipe; this PRD owns the security constraint on the recipe (no identity leak, no request-local data).
4. Defining the runtime endpoint shapes. PRD-106 owns endpoint shapes; this PRD constrains the security-relevant headers and status codes.
5. Defining a signed-manifest / provenance scheme. Deferred per gap F2 to v0.2+.
6. Defining identity-rotation strategies (token refresh, opaque-handle rotation). Out of scope for v0.1; the correlation risk of stable IDs is documented but not mitigated at the protocol level.
7. Defining a sandbox model for build-time `extract` functions. PRD-300 owns build-time safety per gap D3.

### Stakeholders / audience

- **Authors of:** every PRD with a Security section. The 100-series PRDs (PRD-100 through PRD-106, plus this one) reference this PRD for the threat model; the 200-series, 300-series, 400-series, 500-series, and 600-series cite it for runtime, generator, and validator security posture.
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Producers misinterpret 401-vs-404 and use 401 for known-private-resource paths, leaking existence. | Medium | High | PRD-109-R3 / R4 are MUST-level Core requirements; PRD-600 has a probe (negative fixture `runtime-401-leaks-existence.json`). Worked example shows the symmetric-404 pattern. |
| Per-tenant scoping bug: a runtime server serves Tenant A's content under Tenant B's session due to cache key collision. | Low | Catastrophic | PRD-109-R11 mandates ETag inputs include tenant; PRD-103's recipe enforces it; runtime servers MUST set `Vary: Authorization`/`Vary: Cookie` per draft §5.13.3. PRD-600 probes cross-tenant ETag distinctness. |
| Stable IDs become a correlation vector at scale. | Medium | Medium | Documented as a known property of v0.1 (PRD-109-R12). Rotation is out of scope; consumers gating on identity should not rely on ID opacity. Revisit in v0.2. |
| Producers ship `act_version: "999.0"` to DoS consumers via expensive rejection paths. | Low | Low–Medium | PRD-108-R8 and PRD-109-R17 mandate constant-time bounded rejection. Cross-referenced with PRD-108's identical rule. |
| Consumers walk a hostile `related` graph to exhaustion. | Medium | Medium | PRD-109-R18 recommends depth ≤ 10, breadth ≤ 100 per node. Guidance, not normative. |
| Cross-origin mount points to attacker-controlled manifest claiming Plus conformance. | Low | High | PRD-109-R12 requires consumer-side trust evaluation (scheme equivalence + host equivalence/allowlist + MIME validation) before treating a mounted manifest as binding. |
| Per-node "agents only" flag added by a third party in v0.1 creates false trust. | Medium | Medium | PRD-109-R20 explicitly lists this as a v0.1 non-feature; PRD-600 emits a warning if it sees `agents_only` or `no_train` on a node. |

### Open questions

1. Should the threat-catalog table itself be machine-readable (a YAML/JSON sidecar) so PRD-600 can mechanically check that every other PRD's Security section cites at least one row? Tentatively no for v0.1; the table is small enough for prose review. Revisit when the PRD set grows past ~20 PRDs with Security sections.
2. Should the recommended `related`-graph traversal bounds (depth ≤ 10, breadth ≤ 100) be tightened to MUST? Tentatively no — they are consumer-side defaults that depend on consumer compute budget. PRD-500 may pin specific bounds.
3. Should the spec define a structured `Content-Signal: ai-train=no` interpretation that a producer MAY echo into the manifest for redundancy with the HTTP header? Defer; the IETF Content-Signal draft is still moving.

### Acceptance criteria

- [ ] Every gap PRD-109 owns (A4, C2, C3, C4, C5, F4) is addressed with at least one normative requirement here.
- [ ] Threat-model table present with at minimum the seven threat categories listed in §Specification → §Threat model.
- [ ] All Core requirements have a positive AND a negative fixture under `fixtures/109/`.
- [ ] Inline JSON Schemas under `schemas/109/` (auth.schemes shape, WWW-Authenticate validation contract, cross-origin mount trust verdict shape) validate against their positive fixtures.
- [ ] Versioning & compatibility table classifies kinds-of-change to PRD-109 per PRD-108.
- [ ] Worked examples are consistent with the threat model and with the fixtures.
- [ ] Conformance level annotated per requirement.
- [ ] Changelog entry dated 2026-05-01 by Jeremy Forsythe.

---

## Context & dependencies

### Depends on

- **PRD-107** (Conformance levels): the level annotations for individual requirements use the Core / Standard / Plus bands defined there. PRD-107-R4 (level orthogonal to delivery profile) is the basis for PRD-109-R10 (auth scoping orthogonal to level).
- **PRD-108** (Versioning policy): MAJOR/MINOR classification for changes to this PRD; the constant-time-rejection rule for `act_version` mismatch (PRD-108-R8) is referenced and reinforced by PRD-109-R17.
- **000-governance**: lifecycle and change-control rules; the deprecation-channel forward reference for any future security-deprecation announcements.
- **000-gaps-and-resolutions.md**: gap A4 (error model + 401-vs-404 + non-PII messages), gap C2 (ETag-no-identity-leak), gap C3 (auth scheme negotiation), gap C4 (per-tenant ID stability + correlation risk), gap C5 (cross-origin mount trust), gap F4 (no per-node access flags).
- **000-decisions-needed.md**: Q4 (license — CC-BY-4.0 spec + Apache-2.0 code). Cited for the spec-text license that any reuse of this PRD's threat model in derivative documents must observe.
- **Sibling PRDs (not yet on disk; cited by gap ID and topic):**
  - The envelope sibling (gap A4 — owns the error envelope shape with `error.code` closed enum, `error.message`, `error.details`).
  - The discovery sibling (gap A5 — owns the well-known path and the runtime hand-off).
  - The caching sibling (gap C2 — owns the ETag derivation recipe; this PRD owns the security constraint on it).
  - The runtime sibling (gaps C1/C3/C4/C5 — owns endpoint shapes, auth header handling, mounts traversal; this PRD owns the security-relevant subsets).
- External: [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174), [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) (HTTP semantics — §11 Auth, §15.5.2 401, §15.5.5 404, §11.6.1 WWW-Authenticate), [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) (JCS — JSON Canonicalization Scheme, used in PRD-103's ETag input).

### Blocks

This PRD blocks every PRD with a Security section. Specifically:

- The 100-series envelope, discovery, caching, i18n, IDs, and runtime sibling PRDs each cite this PRD's threat model rather than redefining threats locally.
- PRD-200 (adapter framework) cites this PRD for build-time PII handling guidance.
- PRD-500-series (runtime SDKs) cite this PRD for client-side trust evaluation of mounts and for consumer-side `related`-graph traversal bounds.
- PRD-600 (validator) implements probes for every Core requirement here.

### References

- v0.1 draft: §5.13.2 (auth), §5.13.3 (caching), §5.13.4 (per-tenant scoping), §5.13.5 (mounts), §5.14 (decision matrix), §10 Q4 (signed manifests — deferred), §10 Q14 (no-train flag — deferred), §10 Q16 (ETag determinism), §10 Q17 (runtime discovery).
- Prior art: OAuth 2.0 (RFC 6749), OWASP "Don't leak existence via 401-vs-404" guidance, [RFC 9110 §11.6.1](https://www.rfc-editor.org/rfc/rfc9110#name-www-authenticate) (WWW-Authenticate framing), MCP server auth conventions.

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) where requirements are imposed. Lowercase "must" and "should" are non-normative prose.

### Conformance level

The threat model and the rules below are partitioned by conformance level (per PRD-107). All Core rules apply to every ACT producer and consumer regardless of declared level.

- **Core:** PRD-109-R1 through PRD-109-R17, plus PRD-109-R20, PRD-109-R22, PRD-109-R23.
  - 401-vs-404 existence non-leak (R3, R4).
  - Auth-scheme negotiation and `WWW-Authenticate` (R5–R9).
  - Auth-scoping orthogonal to level (R10).
  - Per-tenant ID stability (R11), correlation risk acknowledgment (R12), tenant-isolation (R13).
  - Error-message and error-details PII prohibition (R14, R15).
  - ETag-no-identity-leak and no request-local input (R16, R17).
  - Bounded `act_version` rejection (R20).
  - Per-node "agents only" / "no train" flag prohibition (R22).
  - Discovery-by-design (R23).
- **Standard:** PRD-109-R18 (subtree depth bound restated as security rationale; the cap value lives in the envelope sibling), PRD-109-R21 (cross-origin mount trust evaluation).
- **Plus:** PRD-109-R19 (NDJSON sharding guidance for sites >10K nodes; rate-limit advisory for the search endpoint).

Auth scoping is orthogonal to level (R10): a runtime server MAY require auth at any conformance level.

### Normative requirements

#### Information disclosure

**PRD-109-R1.** Producers MUST NOT include identity-correlated tokens in the public ID grammar (the `id` field of any envelope). Examples of identity-correlated tokens: a user's email, a session token, a JWT's `sub` claim, an OAuth access token. The ID is treated as a stable opaque identifier (per gap C4); it MUST NOT be a reversible function of the requesting identity. (Core)

**PRD-109-R2.** Producers MUST NOT emit PII in node `summary`, `abstract`, or `content` fields beyond what the source document itself contains. ACT does not redact source content; the producer is responsible for upstream redaction. The optional `metadata.extraction_status: "redacted"` value (per the envelope sibling) is allowed as a producer-side signal but is OPTIONAL in v0.1. (Core)

**PRD-109-R3.** A runtime 404 response MUST NOT distinguish "the resource does not exist" from "the resource exists but the requester is not authorized to know it exists." Both cases MUST collapse to a 404 whose body is byte-for-byte identical (modulo opaque, non-identity-correlated request IDs that the validator treats as a tolerated nonce). (Core)

**PRD-109-R4.** A runtime 401 response MUST be reserved for "authentication is required to access this scope." 401 MUST include one `WWW-Authenticate` header per advertised scheme per RFC 9110 §11.6.1 (see PRD-109-R5). 403 ("explicitly forbidden when existence is already known to the requester") is rare and SHOULD only be used when the requester can already prove the resource's existence by other means; otherwise prefer 404 per PRD-109-R3. (Core)

#### Authentication boundaries

**PRD-109-R5.** When a manifest's `auth.schemes` array advertises N schemes, a runtime 401 response MUST include exactly N `WWW-Authenticate` challenges, one per scheme, in manifest-declared preference order. The validator parses the `WWW-Authenticate` header set into the structured shape defined in `schemas/109/www-authenticate.json` and asserts the 1:1 correspondence with `auth.schemes`. (Core)

**PRD-109-R6.** The manifest's `auth.schemes` array MUST be ordered by server preference, most-preferred first. Consumers SHOULD attempt schemes in advertised order and SHOULD fall back to the next scheme on per-scheme auth failure (not on transport failure). The full security-relevant shape of the array is fixed in `schemas/109/auth-schemes.json`; the envelope sibling owns the non-security-relevant superset. (Core)

**PRD-109-R7.** A scheme entry whose `kind` is `"oauth2"` MUST declare a non-empty `authorization_endpoint`, a non-empty `token_endpoint`, and a non-empty `scopes_supported` array. The minimum scope `act.read` is reserved by this PRD; OAuth schemes MUST advertise either `act.read` or a superset that grants read access to ACT envelopes. (Core)

**PRD-109-R8.** A scheme entry whose `kind` is `"api_key"` SHOULD use the `Authorization: Bearer <key>` HTTP scheme (i.e., `header_name: "Authorization"`) rather than a custom header, to avoid header proliferation across the ecosystem. Custom header names are permitted but are documented as a SHOULD-NOT for new deployments. (Core)

**PRD-109-R9.** A `WWW-Authenticate` challenge's auth-param values (e.g., `realm`, `scope`) MUST NOT include user-identifying tokens, request-local nonces tied to a specific user, or any value that varies across requesting identities for the same protected resource. (Core)

**PRD-109-R10.** Authentication scoping is orthogonal to conformance level (per PRD-107-R4). A runtime server MAY require authentication at Core, Standard, or Plus and MAY refuse unauthenticated requests with the 401-or-404 rules above. The conformance level field MUST NOT be interpreted as an authentication signal. (Core)

#### Per-tenant scoping

**PRD-109-R11.** Runtime IDs MUST be stable for a given `(resource, identity, tenant)` triple across the lifetime of the resource. Producers MUST NOT mint per-request-unique IDs (e.g., a fresh UUID per fetch). A resource that changes tenancy is a new resource — the prior ID becomes a 404 (or, per PRD-100/the envelope sibling's optional extension, a 410 if the consumer is expected to drop a cached copy). Identity rotation (token refresh, OAuth token replacement) MUST NOT change IDs as long as the underlying principal is the same. (Core)

**PRD-109-R12.** Stable IDs are correlatable across requests by an observer who can correlate one identity's traffic over time. This is a known property of v0.1; rotation strategies (opaque-handle rotation, per-session ID derivation) are explicitly out of scope. Implementations that require correlation resistance MUST layer it on top of ACT and MUST NOT expect ACT to provide it. (Core, advisory)

**PRD-109-R13.** A runtime server serving multiple tenants MUST scope every endpoint by the requesting identity's tenant. Cross-tenant ID collisions MUST NOT be reachable: the per-tenant-scoping rule prevents two tenants' resources from sharing an ID-key in the server's response space, and the ETag input (per PRD-103, owned by the caching sibling) includes the tenant in the hash so cross-tenant cache poisoning at intermediaries is impossible when `Vary: Authorization` (or `Vary: Cookie`) is set per draft §5.13.3. (Core)

#### Error envelope content

**PRD-109-R14.** The error envelope's `error.message` field (owned by the envelope sibling per gap A4) MUST NOT contain PII, identity tokens, raw user input, auth secrets (passwords, API keys, tokens, refresh tokens, OAuth client secrets), or any value that varies across identities for the same condition. `error.message` is for human-readable logging and MUST be safe to surface in any consumer log without further redaction. (Core)

**PRD-109-R15.** The error envelope's `error.details` field MAY contain code-specific structured data, but the same prohibitions in PRD-109-R14 apply: no PII, no identity tokens, no raw user input, no auth secrets. Producers SHOULD prefer structured codes (e.g., `details.field: "workspace_name"`) over free-form text. (Core)

#### ETag determinism (security constraint on PRD-103)

**PRD-109-R16.** The `etag` field's value is the output of a cryptographic hash; the hash output MUST be cryptographically opaque (i.e., not invertible to the input under any practical computation). The full derivation recipe — algorithm, canonicalization, input tuple — is owned by the caching sibling (PRD-103) per gap C2. PRD-109 imposes the security constraint that the `etag` MUST NOT include the cleartext identity, tenant, or any PII in the emitted string itself. (Core)

**PRD-109-R17.** Servers MUST NOT mix request-local data (HTTP request timestamps, request IDs, random nonces) into the ETag hash input. The hash input is `{payload, identity, tenant}` per PRD-103. Mixing request-local data into the input both breaks PRD-103 determinism and introduces a measurable side-channel. (Core)

The ETag length is fixed by the algorithm (`s256` → 22 chars of base64url payload, plus the 4-char `s256:` prefix → 26 chars total). Length alone is not informative. Revalidation timing is implementation-bounded; servers SHOULD NOT vary revalidation timing by identity beyond what their ETag-comparison code naturally requires.

#### Denial of service

**PRD-109-R18.** Subtree depth MUST be bounded. The exact cap is owned by the envelope sibling (per gap E4: the v0.1 draft suggests splitting nodes >10K tokens; the envelope sibling pins the depth cap as a normative SHOULD with a PRD-600 warning). The security rationale is that an unbounded subtree is a resource-exhaustion vector for both producers (response payload size) and consumers (parser depth, memory). Index size: producers SHOULD shard via NDJSON for sites >10K nodes (per gap A1 / PRD-107 Plus level, owned there). (Standard for the depth bound; Plus for the NDJSON sharding guidance.)

A consumer walking a `related` graph MUST bound traversal. Recommended defaults: depth ≤ 10, breadth ≤ 100 per node. These are consumer-side defaults, not normative MUSTs; PRD-500 may pin specific values for first-party SDKs. The recommendation prevents a hostile producer from constructing a `related` graph that exhausts a naive consumer.

**PRD-109-R19.** Runtime servers SHOULD rate-limit by identity. The manifest's `policy.rate_limit_per_minute` (per draft §5.3) is advisory only — it informs consumers of the producer's expected limit but does not bind the producer. The search endpoint specifically (Plus) SHOULD apply tighter rate limiting than other endpoints because search is the most expensive path. (Plus)

**PRD-109-R20** (cross-references PRD-108-R8). A consumer rejecting a response on `act_version` MAJOR mismatch MUST do so in bounded time before further parsing of the envelope. Specifically: the rejection path MUST NOT allocate parser state proportional to the response size, MUST NOT execute any user-controlled JSONPath/transform expressions on the rejected envelope, and SHOULD complete in O(1) memory beyond the parsed `act_version` string. This forecloses a hostile-server DoS where `act_version: "999.0"` triggers expensive consumer-side error handling. (Core)

#### Cross-origin mount trust

**PRD-109-R21.** When a parent manifest's `mounts` entry points to a manifest at a different origin (scheme + host + port differing from the parent's origin), the consumer MUST evaluate origin trust before treating the mounted manifest as binding. The trust algorithm is:

1. **Scheme equivalence.** The mount URL's scheme MUST equal the parent's scheme. An `https` parent mounting an `http` manifest is REJECTED.
2. **Host equivalence or allowlist.** The mount URL's host MUST equal the parent's host, OR the mount's origin MUST appear in a consumer-configured allowlist. Consumers SHOULD treat the allowlist as opt-in (default empty); first-party SDKs MAY ship a default allowlist for the consumer's own organization but MUST document that fact.
3. **MIME validation.** The fetched mounted manifest's HTTP `Content-Type` MUST match `application/act-manifest+json` (per gap B5; the MIME-type sibling owns registration). A mismatch indicates a hostile or misconfigured mount and MUST be REJECTED.

The structured input/output of the algorithm is fixed in `schemas/109/cross-origin-mount-trust.json`. Producers MUST NOT mount onto origins they don't control; if a producer mounts onto a third-party origin, the producer MUST document the trust relationship in `manifest.policy` (owned by the envelope sibling). (Standard)

#### Per-node access flags — v0.1 non-feature

**PRD-109-R22.** Per-node "agents only" / "no train" / "no AI training" flags are explicitly **OUT OF SCOPE** for v0.1 (per gap F4 / draft §10 Q14). Producers MUST NOT emit such fields and consumers MUST NOT treat any such field as binding access control. The rationale is twofold:

1. **False sense of control.** By the time a consumer sees a per-node "agents only" flag, the consumer has already fetched the content. The flag cannot retroactively prevent fetching.
2. **Conflicts with already-fetched provenance.** Out-of-band controls (robots.txt, the IETF Content-Signal HTTP header) operate at the fetch boundary and are the appropriate layer.

PRD-600 MUST emit a validator warning (not error) if it encounters `agents_only`, `no_train`, `no_ai_training`, or any synonym on a node envelope. The warning cites this requirement. Consumers tolerate the field as an unknown optional per PRD-108-R7 but treat it as informational only. Revisit this in v0.2 if the IETF Content-Signal draft converges and a manifest-side echo becomes useful for redundancy. (Core)

#### Discovery as a feature, not a secret

**PRD-109-R23.** The well-known discovery path (`/.well-known/act.json`, owned by the discovery sibling per gap A5) reveals that the site supports ACT. This is **by design**: the spec is a public feature, not a secret. Producers wishing to limit ACT discovery to authenticated contexts MUST use the runtime-only discovery hand-off (HTTP `Link` header + HTML `<link rel="act">`, per gap A5) and MUST NOT serve the well-known path publicly. Producers MUST NOT rely on path obscurity for security at any level. (Core)

### Wire format / interface definition

PRD-109 does not introduce its own envelopes. The schemas below are the security-relevant subsets of structures owned by sibling PRDs.

#### `manifest.auth.schemes` — security-relevant shape

The full path is `schemas/109/auth-schemes.json`. Inline summary:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["schemes"],
  "properties": {
    "schemes": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["kind"],
        "properties": {
          "kind": {
            "type": "string",
            "enum": ["cookie", "bearer", "oauth2", "api_key"]
          },
          "header_name":          { "type": "string" },
          "authorization_endpoint": { "type": "string", "format": "uri" },
          "token_endpoint":         { "type": "string", "format": "uri" },
          "scopes_supported": {
            "type": "array",
            "minItems": 1,
            "items": { "type": "string" }
          }
        },
        "allOf": [
          {
            "if": { "properties": { "kind": { "const": "oauth2" } }, "required": ["kind"] },
            "then": { "required": ["authorization_endpoint", "token_endpoint", "scopes_supported"] }
          }
        ]
      }
    }
  }
}
```

The array is ordered (most-preferred first); the conditional schema enforces OAuth's required fields per PRD-109-R7. The envelope sibling MAY add fields to scheme entries; PRD-109's schema fixes only the security-relevant subset.

#### `WWW-Authenticate` validation contract

HTTP headers are not JSON, but PRD-600 (validator) and PRD-500 (consumer SDK) parse them into structured form. The schema at `schemas/109/www-authenticate.json` describes the parsed shape.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["status_code", "headers"],
  "properties": {
    "status_code": { "type": "integer", "const": 401 },
    "headers": {
      "type": "object",
      "required": ["www_authenticate"],
      "properties": {
        "www_authenticate": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "required": ["scheme"],
            "properties": {
              "scheme": { "type": "string" },
              "params": { "type": "object" }
            }
          }
        }
      }
    }
  }
}
```

Per RFC 9110 §11.6.1, multiple challenges MAY be sent as separate header lines or comma-separated within a single line; the validator normalizes both into the array form. PRD-109-R5 requires one challenge per advertised scheme.

#### Cross-origin mount trust algorithm

`schemas/109/cross-origin-mount-trust.json` is the structured input/output of the algorithm in PRD-109-R21:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["input", "verdict"],
  "properties": {
    "input": {
      "type": "object",
      "required": ["parent_manifest_origin", "mount_manifest_url", "consumer_allowlist"],
      "properties": {
        "parent_manifest_origin": { "type": "string", "format": "uri" },
        "mount_manifest_url":     { "type": "string", "format": "uri" },
        "consumer_allowlist":     { "type": "array", "items": { "type": "string" } }
      }
    },
    "verdict": {
      "type": "object",
      "required": ["trusted", "scheme_equivalent", "host_equivalent_or_allowlisted", "mime_validated"],
      "properties": {
        "trusted":                       { "type": "boolean" },
        "scheme_equivalent":             { "type": "boolean" },
        "host_equivalent_or_allowlisted":{ "type": "boolean" },
        "mime_validated":                { "type": "boolean" },
        "rejection_reason":              { "type": "string" }
      }
    }
  }
}
```

`trusted` is true iff all three component checks are true.

### Threat model

This is the catalog every other 100-series PRD's Security section MUST cite by reference rather than redefine. Each row is a tuple of (threat, attack vector, control). PRDs cite by row label (T1, T2, …).

| Label | Threat | Attack vector | Control (PRD-109 requirement) |
|---|---|---|---|
| **T1. Existence leak via 401-vs-404** | An adversary probes `/act/n/secret-id.json` and uses a 401 ("auth required") vs 404 ("not found") signal to confirm the resource exists. | Differential HTTP response codes for unauthenticated requests across known-private and known-absent resource IDs. | R3 (collapse to 404), R4 (401 reserved for "auth required at this scope"), worked example below. |
| **T2. Identity leak via ETag** | An adversary observes a user's ETag and is able to derive the user's identity, tenant, or some hash-revealing property. | Cleartext identity in the ETag string; or a poorly chosen hash that exposes structure (e.g., a non-cryptographic hash). | R16 (cryptographically opaque hash), R17 (no request-local data in input), and PRD-103's recipe (input is JCS({payload, identity, tenant})). |
| **T3. Cross-tenant cache poisoning** | An intermediary (CDN, shared corporate proxy) caches Tenant A's response and serves it to Tenant B because the cache key omits tenant. | Missing `Vary: Authorization` / `Vary: Cookie`, or ETags that don't depend on tenant. | R13 (per-tenant scoping), draft §5.13.3 (Vary headers, owned by the caching sibling), R17 (tenant in ETag input). |
| **T4. Identity correlation via stable ID** | An observer correlates a stable ID across requests and over time to track a single identity's behavior. | The ID grammar is stable for `(resource, identity, tenant)` triples by design (R11), and observers correlate across requests. | R12 — documented as a known property of v0.1; rotation is out of scope. Consumers requiring correlation resistance layer it on top. |
| **T5. PII via free-form error message** | An error response includes a user's email, IP, raw input, or auth secret; consumer logs replicate it; downstream observability tools index it. | Free-form `error.message` populated from upstream exception text. | R14 (no PII / tokens / secrets / raw input in `error.message`), R15 (same prohibition for `error.details`). |
| **T6. Cross-origin mount → trust hijack** | Parent manifest mounts a manifest at attacker-controlled origin; consumer treats the mounted manifest as if it were the parent's content. | Compromised third-party hosting; DNS hijack; unauthorized takeover of the mount target. | R21 (trust-evaluation algorithm: scheme equivalence + host equivalence/allowlist + MIME validation). |
| **T7. DoS via inflated act_version, hostile related graph, or unbounded subtree** | Hostile server returns `act_version: "999.0"` or constructs a deep `related` graph or an unbounded subtree to exhaust consumer compute or memory. | Adversarial server output. | R20 (constant-time bounded rejection on MAJOR mismatch), R18 (subtree depth bound + recommended `related` traversal bounds), R19 (runtime rate-limiting). |
| **T8. False sense of control via per-node "agents only" flag** | A producer emits `agents_only: true` (or similar) and assumes consumers will respect it as access control; consumers fetch the content anyway, and the producer believes content is protected when it is not. | Misuse of unknown optional fields as access control signals. | R22 (v0.1 non-feature; producers MUST NOT emit; consumers MUST NOT treat as binding). |
| **T9. Discovery via well-known path** | An adversary enumerates ACT-supporting sites by probing `/.well-known/act.json`. | The well-known path is publicly fetchable by design. | R23 — by design; the spec is a feature, not a secret. Producers needing private discovery use the runtime hand-off (gap A5). |

Other PRDs cite as: "Mitigates T1, T5 per PRD-109." This keeps the threat catalog single-sourced.

### Errors

PRD-109 imposes constraints on the runtime error envelope owned by the envelope sibling (gap A4). The relevant security-affecting status codes:

| Condition | Response | PRD-109 constraint |
|---|---|---|
| Unauthenticated request for a private resource | 404 | Must be byte-for-byte identical to the "truly absent" 404 (R3). |
| Unauthenticated request, scope requires auth | 401 | One `WWW-Authenticate` per advertised scheme, in `auth.schemes` order (R5). |
| Authenticated requester lacks permission and resource existence is already known to the requester | 403 | Rare. Prefer 404 in ambiguous cases (R4). |
| `act_version` MAJOR mismatch | Consumer rejects | Constant-time bounded rejection (R20). |
| Validation error including user-controlled input | 4xx with error envelope | `error.message` and `error.details` MUST NOT contain PII, raw user input, or secrets (R14, R15). |
| 5xx | Server error envelope | Same PII prohibition applies (R14, R15). Stack traces MUST NOT be surfaced in `error.message`. |

PRD-109 does not introduce new HTTP status codes; the runtime sibling owns the full status-code table.

---

## Examples

Examples are non-normative but consistent with the specification and the threat model.

### Example 1 — Symmetric 404 (T1, R3, R4)

A consumer requests two resources without authentication:

- `GET /act/n/known-secret.json` — resource exists; ACL denies the unauthenticated identity.
- `GET /act/n/never-existed.json` — resource truly absent.

Both responses are byte-for-byte identical (modulo a request ID that is not correlated to identity):

```http
HTTP/1.1 404 Not Found
Content-Type: application/act-error+json

{
  "act_version": "0.1",
  "error": {
    "code": "not_found",
    "message": "The requested resource is not available."
  }
}
```

A separate authenticated request to the same scope, where the request lacks a session cookie or bearer token at all (i.e., the scope itself requires auth and the requester has presented no credentials), receives a 401 with one `WWW-Authenticate` per advertised scheme:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: OAuth realm="acme", scope="act.read"
WWW-Authenticate: Bearer realm="acme"
Content-Type: application/act-error+json

{
  "act_version": "0.1",
  "error": {
    "code": "auth_required",
    "message": "Authentication required."
  }
}
```

The 401 does NOT confirm a specific resource exists; it states that the scope requires auth. Producers serving a resource-specific URL where the resource may or may not exist MUST still return 404 (per R3) when the requester is unauthenticated, NOT 401 with "this resource exists, please log in." See `fixtures/109/negative/runtime-401-leaks-existence.json`.

### Example 2 — ETag with no identity in cleartext (T2, R16, R17)

Per PRD-103, the ETag input is JCS-canonical encoding of:

```json
{
  "identity": "u-7f3c1d2e",
  "payload": {
    "act_version": "0.1",
    "id": "workspace/projects/atlas",
    "title": "Atlas project",
    "summary": "Top-level project record for the Atlas initiative."
  },
  "tenant": "t-acme"
}
```

The hash output (`s256` algorithm: SHA-256, base64url, no padding, truncated to 22 chars) is opaque; the user ID `u-7f3c1d2e` and tenant ID `t-acme` are NOT recoverable from the ETag string. A producer that mistakenly emits `etag: "u-7f3c1d2e:t-acme:abc123"` (with the cleartext identity in the ETag) violates R16 — the validator parses the ETag, observes the identity component, and rejects.

### Example 3 — Auth schemes ordered by preference (R5, R6, R7)

```json
{
  "auth": {
    "schemes": [
      {
        "kind": "oauth2",
        "authorization_endpoint": "https://acme.com/oauth/authorize",
        "token_endpoint": "https://acme.com/oauth/token",
        "scopes_supported": ["act.read", "act.write"]
      },
      { "kind": "bearer" },
      { "kind": "api_key", "header_name": "Authorization" }
    ]
  }
}
```

The 401 response advertises challenges in the same order:

```http
HTTP/1.1 401 Unauthorized
WWW-Authenticate: OAuth realm="acme", scope="act.read"
WWW-Authenticate: Bearer realm="acme"
WWW-Authenticate: ApiKey realm="acme"
```

A consumer SHOULD attempt OAuth first, fall back to Bearer on per-scheme failure, then API key.

### Example 4 — Cross-origin mount trust evaluation (T6, R21)

Parent at `https://acme.com/.well-known/act.json` declares:

```json
{
  "act_version": "0.1",
  "site": { "name": "Acme" },
  "mounts": [
    {
      "prefix": "/marketing",
      "delivery": "static",
      "manifest_url": "https://marketing-cdn.acme.com/.well-known/act.json"
    },
    {
      "prefix": "/partner",
      "delivery": "static",
      "manifest_url": "https://partner-blog.example.org/.well-known/act.json"
    }
  ]
}
```

The first mount is on a different host (`marketing-cdn.acme.com`) but presumably the same logical organization; the consumer evaluates trust:

- Scheme equivalent: `https` == `https` → **true**.
- Host equivalent: `marketing-cdn.acme.com` != `acme.com`. Allowlisted? If the consumer's allowlist includes `*.acme.com`, **true**; otherwise **false**.
- MIME validated: the consumer fetches and observes `Content-Type: application/act-manifest+json` → **true**.

If allowlist matches, `trusted: true`; otherwise the mount is REJECTED.

The second mount points to `partner-blog.example.org` — a different organization. Without an explicit allowlist entry for `partner-blog.example.org`, the consumer REJECTS the mount with `rejection_reason: "host_not_in_allowlist"`. The producer's parent manifest is unaltered; the consumer simply does not follow the mount. A producer that wants this mount to be trusted MUST either own the origin or document the trust relationship in `manifest.policy`.

### Example 5 — Per-node "agents only" flag is a non-feature (T8, R22)

A producer emits:

```json
{
  "act_version": "0.1",
  "id": "internal/proprietary-roadmap",
  "title": "Internal Roadmap",
  "agents_only": true,
  "no_train": true,
  "summary": "..."
}
```

Per PRD-108-R7, consumers tolerate the unknown optional fields (no rejection). Per PRD-109-R22, the consumer treats both as informational only and does NOT use them for access control. PRD-600 emits a warning citing this requirement. The producer that wishes to actually restrict access MUST use auth (R10) or out-of-band controls (robots.txt, Content-Signal HTTP header).

---

## Test fixtures

Fixtures live under `fixtures/109/` and are exercised by PRD-600 (validator). PRD-109 enumerates the canonical fixtures.

### Positive

- `fixtures/109/positive/runtime-404-no-leak.json` → satisfies PRD-109-R3, R4. Demonstrates a 404 envelope identical for "auth-denied existing" and "truly absent" cases.
- `fixtures/109/positive/etag-no-identity-leak.json` → satisfies PRD-109-R16, R17. ETag computed per PRD-103 with no cleartext identity in the emitted string and no request-local data in the hash input.
- `fixtures/109/positive/auth-schemes-ordered.json` → satisfies PRD-109-R6, R7, R8. Manifest with `auth.schemes` correctly ordered by server preference; OAuth entry declares all required fields including `scopes_supported: ["act.read", ...]`.

### Negative

- `fixtures/109/negative/runtime-401-leaks-existence.json` → MUST be rejected. Demonstrates a 401 used to distinguish "exists but auth needed" from "doesn't exist," violating R3. Reporter MUST emit a `gaps` entry citing PRD-109-R3.
- `fixtures/109/negative/etag-mixes-timestamp.json` → MUST be rejected. ETag hash input mixes a request-local timestamp, violating R17. Reporter MUST emit a `gaps` entry citing PRD-109-R17.
- `fixtures/109/negative/error-message-contains-pii.json` → MUST be rejected. Error envelope's `message` contains a user email, violating R14. Reporter MUST emit a `gaps` entry citing PRD-109-R14.
- `fixtures/109/negative/per-node-agents-only-flag.json` → MUST be flagged as a v0.1 non-feature. Reporter MUST emit a warning (not a hard rejection) citing PRD-109-R22, because PRD-108-R7 requires consumers to tolerate unknown optional fields. The warning's purpose is to remind the producer that the field is informational only and creates a false sense of control.

Each fixture's `_fixture_meta` block names the requirement(s) it satisfies or violates and the expected validator finding.

---

## Versioning & compatibility

Per PRD-108, classify each kind of change to PRD-109.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a new threat row to the threat-model table | MINOR (informational) or MAJOR (if it introduces a new MUST) | The table itself is not normative; the requirements it cites are. Adding a row that cross-references existing requirements is MINOR. Adding a row whose only control is a new MUST not yet in the requirements list requires the new MUST and is therefore MAJOR per PRD-108. |
| Add a new normative requirement at SHOULD or below | MINOR | Per PRD-108-R4(5). |
| Add a new normative requirement at MUST | MAJOR | Per PRD-108-R5; producers and consumers gain a new obligation. |
| Tighten a SHOULD to a MUST | MAJOR | Per PRD-108-R5(3). |
| Loosen a MUST to a SHOULD | MAJOR | Per PRD-108-R5(3). |
| Add an `auth.schemes` `kind` value (e.g., `"mtls"`) | MAJOR | The `kind` enum is closed at v0.1. |
| Add an optional field to a scheme entry (e.g., `oauth2.pkce_required`) | MINOR | New optional field; consumers tolerate per PRD-108-R7. |
| Change the cross-origin mount trust algorithm | MAJOR | Changes consumer trust behavior; existing mounts may transition between trusted/untrusted. |
| Promote a per-node "agents only" flag to a normative feature | MAJOR | Reverses R22; cross-cuts with the envelope sibling (new normative field). |
| Add a new error-envelope PII prohibition (e.g., extending to a new field) | MINOR | Tightens the no-PII rule but only at the new field's introduction; existing fields' rules are unchanged. |
| Change the recommended `related` traversal bounds (depth ≤ 10, breadth ≤ 100) | MINOR | Recommendations, not normative MUSTs. |
| Change the `act_version` rejection-bounded rule from SHOULD to MUST (currently MUST) | n/a | Already MUST. |

### Forward compatibility

Per PRD-108-R7, consumers tolerate unknown optional fields. PRD-109-R22 explicitly applies this rule to per-node access flags: consumers tolerate them as unknown optional fields and do NOT treat them as binding access control. Future MAJOR versions MAY introduce a normative manifest-side echo of the IETF Content-Signal HTTP header; that change is gated on the IETF draft converging.

### Backward compatibility

A producer that upgrades from a level lacking the `act.read` scope reservation to a level that includes it (R7) MUST update its OAuth `scopes_supported` array in the same MINOR release. Consumers that previously accepted any scope MUST tolerate the additional reservation (it is additive).

A producer that downgrades — for example, by removing `auth.schemes` advertisement entirely while still requiring auth — violates the orthogonality rule (R10). The producer MUST keep advertising at least one scheme even at Core level.

---

## Security considerations

The Specification section above IS the security considerations section for PRD-109; this PRD's reason for existence is the project-wide security posture. This subsection cross-references rather than restates.

- **Trust boundary on the declared conformance level.** Consumers SHOULD NOT treat a declared `conformance.level` (per PRD-107) as a security-relevant claim. Per PRD-107's own Security section, the level is a content/feature contract, not an authentication assertion. PRD-109-R10 reinforces this from the auth side.
- **Trust boundary on `act_version`.** Per PRD-108-R8, consumers reject MAJOR mismatches; per PRD-109-R20, that rejection MUST be bounded.
- **PRD-109 itself imposes no new auth, scoping, or injection surface beyond what is already documented in the threat model.** The schemas under `schemas/109/` constrain existing surfaces (auth.schemes, WWW-Authenticate, mounts) rather than introduce new wire shapes.
- **PII handling at build time.** The 200-series adapter PRDs (which this PRD blocks via the threat model) cite R14 / R15 for build-time PII handling: an adapter that pulls source content from a CMS MUST surface PII concerns to the producer, not silently emit PII into `summary` / `abstract` / `content`. PRD-200 owns the adapter-side rules.
- **Future signed-manifest provenance** (gap F2) will, when introduced, build on top of the constraints here. The signature scheme MUST NOT alter R3, R4, R14, R15 — it adds authenticity, not a relaxation of disclosure rules.

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft. Status: In review. Owns gaps A4, C2, C3, C4, C5, F4. Establishes the project-wide threat model (T1–T9) cited by every other 100-series PRD's Security section. Inline schemas at `schemas/109/`; positive and negative fixtures at `fixtures/109/`. |
| 2026-05-01 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
