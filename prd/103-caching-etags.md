# PRD-103 — Caching, ETags, validators (static + runtime)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

The v0.1 working draft (`docs/plan/v0.1-draft.md`) requires every node and the index to carry an `etag` field (§5.8) and the runtime profile to use HTTP `ETag` / `If-None-Match` revalidation (§5.13.3). It does not pin down (a) the value-shape of the `etag` field; (b) the deterministic recipe by which a static producer or a runtime producer derives that value; or (c) how runtime servers behave on `If-None-Match` matches. Gap **A4** (`prd/000-gaps-and-resolutions.md`) tabulates the static endpoint set as `200 / 304 / 404` and the runtime endpoint set with a `304` row, but it does not specify what makes a `304` correct. Gap **C2** sketches the recipe: `etag = "<algorithm>:<hash>"` over the JCS canonical encoding of `(payload, identity, tenant)` for runtime, with `s256` (SHA-256, base64url, no padding, truncated to 22 chars) as the only algorithm in v0.1. Without this PRD, two runtime replicas will return different ETags for the same content+identity+tenant and consumers will refresh-fetch instead of revalidating; without it, the static profile is similarly underspecified — generators could pick any hash family and still pass the wire schema. PRD-107 (Accepted) already names `etag` and `If-None-Match` honoring as Core requirements, so the contract is load-bearing for every level. The PRD that codifies it is this one.

### Goals

1. Define the value-shape of the `etag` field (algorithm prefix + base64url-safe hash, with v0.1 admitting exactly `s256` of length 22).
2. Define the **static** ETag derivation recipe: JCS canonical encoding of the node payload minus the `etag` field itself; SHA-256; base64url no padding; truncate to 22 characters.
3. Define the **runtime** ETag derivation recipe: JCS canonical encoding of the `{payload, identity, tenant}` triple; same hash chain. Per-tenant scoping is part of the input; request-local data (timestamps, request IDs, nonces) is forbidden.
4. Specify runtime HTTP semantics: server MUST send the `ETag` header matching the envelope's `etag` field; server MUST honor `If-None-Match` and respond `304 Not Modified` on match. Recommend the `Cache-Control` shape per profile.
5. Make cross-replica determinism achievable (it is the implementer's responsibility; the recipe makes it possible) and explicitly forbid the patterns that defeat it.
6. Provide positive worked-example fixtures that compute end-to-end (canonical bytes → SHA-256 → base64url no-pad → truncate) so the validator (PRD-600 sibling, future) can verify a producer mechanically, and negative fixtures that catch the common mistakes.
7. Cite gap C2 + forward-reference PRD-109 for the security posture (ETag MUST NOT leak identity in cleartext; the hash output is the only part of the value-shape that exists outside the producer's process).

### Non-goals

1. **Defining the envelope shapes** (manifest, index, node, subtree, error). Those belong to the PRD-100 sibling (in flight). PRD-103 only owns the `etag` field's value-shape and the derivation contract.
2. **HTTP transport beyond ETag/If-None-Match/304/Cache-Control.** Auth (`WWW-Authenticate`), error envelopes, status-code semantics for non-cache-related responses are owned by PRD-106 (runtime, sibling).
3. **NDJSON index line shape.** The Plus-level NDJSON index is owned by the PRD-100 / index sibling. PRD-103 only requires that, when an NDJSON index exists, each line carries its own `etag` field whose value-shape and derivation match the rules here.
4. **Validator implementation.** PRD-600 (validator, future) implements the prober that exercises the rules in this PRD.
5. **Conformance bands.** PRD-107 (Accepted) owns Core / Standard / Plus. This PRD declares which of its requirements live in which band.
6. **Versioning the algorithm.** Adding a new algorithm prefix beyond `s256` follows PRD-108's enum-extension rules; this PRD only specifies the v0.1 algorithm.

### Stakeholders / audience

- **Authors of:** every PRD that emits an envelope (PRD-100 sibling and dependents); PRD-600 (validator); PRD-500 series (runtime SDKs that implement the runtime profile end of this contract); the 200-series adapters (static producers).
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Cross-replica drift — two replicas of the same SaaS produce different ETags for the same content + identity + tenant despite the recipe | Medium | High (revalidation defeated) | The recipe is fully deterministic given identical inputs; the burden is on the implementer to feed identical inputs (canonical JSON, stable identity, stable tenant). PRD-103-R7 forbids the patterns that cause drift; PRD-600's prober (future) probes for it. |
| Implementer mixes timestamps, request IDs, or random nonces into the hash, defeating revalidation | Medium | High | PRD-103-R7 is a MUST NOT. Negative fixture `runtime-etag-with-request-id-nonce.json` makes the failure mode concrete. |
| Producers use a non-canonical JSON encoding (different key order, whitespace, escape choices) and produce divergent hashes for semantically identical payloads | Medium | High | RFC 8785 (JCS) is required. Worked example pins the canonical bytes for one fixture so an implementer can byte-compare. |
| ETag length / structure leaks tenant or identity to a network observer | Low | Medium | Recipe truncates to a fixed 22-char base64url hash, which is opaque. Tenant and identity are inputs to the hash, never embedded in the output. Forwarded to PRD-109 for the security posture. |
| Consumer caches strong ETags as weak (or vice versa) and breaks revalidation | Low | Low | PRD-103-R10 specifies that ACT ETags are strong validators in the RFC 9110 sense; the `ETag` header value MUST NOT carry the `W/` weak prefix. |
| The 22-char truncation has a higher collision probability than full SHA-256 | Low | Low | 22 base64url chars = 132 bits of entropy. Birthday collision at 2^66 distinct payloads — well above any plausible deployment. Cite the trade-off in §Security. |

### Open questions

1. Should a future Standard-or-Plus extension permit `Last-Modified` / `If-Modified-Since` as a fallback validator alongside ETag? Tentatively: no — strong-validator-only keeps the contract simple and avoids the precision problems (per RFC 9110 §13.1.4) of date-based validators. Reconsider in v0.2 if implementer feedback signals friction.
2. Should a manifest-level capability flag (`capabilities.etag.algorithm: ["s256"]`) be advertised so consumers can detect future algorithm additions before they parse a node? Tentatively: no — the algorithm prefix in each `etag` value is self-describing, and PRD-100 already mandates `act_version`. The closed v0.1 admit-list of `{s256}` keeps the surface tight; if v0.2 admits a second algorithm, that is itself a MINOR-bump signal sufficient for negotiation.
3. Should the runtime `Cache-Control: private, must-revalidate` recommendation be tightened to a SHOULD/MUST? Tentatively SHOULD — the runtime profile spans tenant-shared content (where `public, max-age=0` is acceptable) and per-user content (where `private, must-revalidate` is the safer default). Implementers pick per resource. Cite PRD-109 for the privacy implications.

### Acceptance criteria

- [ ] Every MUST in this PRD has at least one positive fixture (worked example) and at least one negative fixture (failure mode).
- [ ] The `etag.schema.json` fragment validates against every positive fixture's `etag` value and rejects every negative fixture's `etag` value (where the negative fixture has one).
- [ ] The runtime worked example (`runtime-derivation-worked-example.json`) computes end-to-end: a re-implementation reading the input, canonical-JCS-encoding it, SHA-256-ing it, base64url-encoding it without padding, and truncating to 22 chars MUST produce exactly `s256:iH6ta82PUg0zi0lr_jpCLL`.
- [ ] The static worked example (`static-derivation-worked-example.json`) likewise produces exactly `s256:8Z0luYEDvPcDQKLimP55qC`.
- [ ] Conformance level is declared per requirement, citing PRD-107.
- [ ] Versioning & compatibility section classifies every kind of change to this PRD per PRD-108.
- [ ] Security section cites gap C2 and forward-references PRD-109; addresses identity leakage, length-side-channels, and collision resistance.
- [ ] Changelog initial entry dated 2026-05-01 is present.

---

## Context & dependencies

### Depends on

- **PRD-107** (Accepted) — Core mandates `etag` on every node + the index; runtime-profile Core mandates `If-None-Match` honoring + the `ETag` HTTP header. PRD-103 fills in the recipe behind those Core mandates.
- **PRD-108** (Accepted) — versioning. Adding a new algorithm beyond `s256` is a MINOR bump; redefining the `etag` value-shape or the derivation recipe is MAJOR. PRD-103 cites PRD-108 for both classifications.
- **000-governance** (Accepted) — for change-control on this PRD itself.
- External:
  - [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) — JSON Canonicalization Scheme (JCS). The hash input is the JCS canonical encoding.
  - [RFC 4648 §5](https://www.rfc-editor.org/rfc/rfc4648#section-5) — base64url ("base64 URL and Filename safe") encoding. No padding (`=` characters MUST be omitted).
  - [FIPS 180-4](https://csrc.nist.gov/publications/detail/fips/180/4/final) — SHA-256.
  - [RFC 9110 §8.8.3](https://www.rfc-editor.org/rfc/rfc9110#name-etag) — `ETag` HTTP header field.
  - [RFC 9110 §13.1.1](https://www.rfc-editor.org/rfc/rfc9110#name-if-match) and [§13.1.2](https://www.rfc-editor.org/rfc/rfc9110#name-if-none-match) — `If-None-Match` semantics.
  - [RFC 9110 §15.4.5](https://www.rfc-editor.org/rfc/rfc9110#name-304-not-modified) — `304 Not Modified` semantics.
  - [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111) — HTTP caching (for `Cache-Control` directive references).

### Blocks

- **PRD-100** (sibling, in flight) — the manifest, index, node, subtree, and (Plus) NDJSON-index envelope schemas embed `etag` as a required field; the schemas reference PRD-103's `etag.schema.json` for the value-shape.
- **PRD-105** (static profile, sibling) — depends on PRD-103 for the static endpoint set's `304` semantics on `If-None-Match` (where the static origin / CDN supports it; ACT does not require static origins to honor `If-None-Match`, but when they do, the contract is the one in this PRD).
- **PRD-106** (runtime profile, sibling) — depends on PRD-103 for runtime ETag/304/Cache-Control semantics.
- **PRD-109** (security, sibling) — subsumes the §Security placeholder here.
- **PRD-600** (validator, future) — its in-process JS library + client-side hosted validator (per decision Q8) probes ETag stability and `If-None-Match` behavior; PRD-103 specifies the requirements being probed.
- **PRD-500-series** (runtime SDKs, future) — implement the runtime profile end of this contract.
- **200-series adapters** — implement the static profile end (compute and emit `etag` per node and on the index).

### References

- v0.1 draft: §5.8 (Caching & versioning), §5.13.3 (runtime caching), §5.13.4 (per-tenant scoping), §10 Q16 (cross-replica determinism, the original framing).
- `prd/000-gaps-and-resolutions.md` — gap **A4** (304 in static and runtime tables), gap **C2** (ETag derivation recipe — full text adopted here).
- Prior art: HTTP `ETag` per RFC 9110 (the wire-level mechanism this PRD plumbs through). RFC 8785 (JCS) for canonical JSON. SHA-256 truncation as in JWT `kid` thumbprints (RFC 7638) and OCI image-digest short forms.

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) where requirements are imposed. Lowercase "must" and "should" are non-normative prose.

### Conformance level

Per PRD-107, the conformance bands and PRD-103's per-requirement assignment:

- **Core** — applies to every node envelope and the index envelope, in both static and runtime profiles. Specifically: PRD-103-R1, R2, R3, R4 (static derivation), R6 (runtime derivation), R7 (no request-local mixing), R8 (`If-None-Match` honoring + `ETag` header on the runtime profile), R10 (strong validator).
- **Standard** — same Core rules apply to the subtree envelope when present (subtree itself is Standard per PRD-107). Specifically: PRD-103-R11.
- **Plus** — same Core rules apply to NDJSON index lines (each line carries its own `etag`, derived per the static recipe applied to that line's payload). Specifically: PRD-103-R12.

Recommendation-level requirements (PRD-103-R5 — static `Cache-Control`; PRD-103-R9 — runtime `Cache-Control`) are SHOULD across all bands and apply when the producer controls the response headers (i.e., the static origin / CDN, or the runtime server).

### Normative requirements

#### Value-shape of the `etag` field

**PRD-103-R1.** Every ACT node envelope, every ACT index envelope (Core), every ACT subtree envelope when present (Standard), and every line of an ACT NDJSON index when present (Plus), MUST carry an `etag` field at the top level of that envelope or line. The `etag` field is required at all three conformance levels; it has no default and MUST NOT be elided. (This restates and pins down PRD-107-R6's "every node and index MUST carry an `etag`.")

**PRD-103-R2.** The `etag` field's value MUST be a JSON string matching the regular expression `^[a-z0-9]+:[A-Za-z0-9_-]+$`. Concretely: a lowercase ASCII algorithm identifier, a single literal colon, then one or more base64url-safe characters (`A`–`Z`, `a`–`z`, `0`–`9`, `_`, `-`). The value MUST NOT contain whitespace; MUST NOT contain padding (`=`); MUST NOT contain non-base64url characters (`+`, `/`, or any other byte outside the listed set); MUST NOT use an uppercase algorithm prefix.

**PRD-103-R3.** For ACT v0.1 the algorithm identifier MUST be `s256`, and the hash portion MUST be exactly 22 characters drawn from the base64url-safe alphabet. Concretely: `s256:[A-Za-z0-9_-]{22}`. No other algorithm identifier is admitted in v0.1. Adding a new algorithm identifier in a future spec version is a MINOR change per PRD-108-R4(3) (open enum addition); changing or removing `s256` is a MAJOR change per PRD-108-R5.

#### Static profile — derivation recipe

**PRD-103-R4.** A static producer MUST derive the `etag` value of an envelope by:

1. Take the envelope payload — that is, the JSON object the producer is about to emit, in full, **with the `etag` field itself omitted from the input**. (If the producer is computing the `etag` field for an envelope that does not yet have an `etag` field, this is the same as taking the about-to-emit payload as-is. If the producer is recomputing an `etag` for an envelope that already has one, the existing `etag` field MUST be removed from the input before hashing.)
2. Encode the resulting object using RFC 8785 JSON Canonicalization Scheme (JCS). The output is a UTF-8 byte sequence with a deterministic key order (lexicographic by Unicode code point), no insignificant whitespace, and the JCS-mandated number/string serialization rules.
3. Compute SHA-256 over those UTF-8 bytes.
4. Encode the resulting 32-byte digest using base64url (RFC 4648 §5) **without padding** (no trailing `=` characters).
5. Truncate the encoded string to exactly 22 characters by taking the first 22 bytes of the encoded form (which corresponds to the first 132 bits of the digest).
6. Prepend `s256:` to produce the final value.

**PRD-103-R5.** A static producer that controls its response headers (the static origin or the CDN serving the file) SHOULD also send the same value as the HTTP `ETag` response header for parity with the in-envelope value. The HTTP `ETag` header value MUST be a strong validator: the producer MUST NOT prefix it with `W/` (the RFC 9110 weak indicator). The HTTP value MUST be the same byte string as the envelope's `etag` field, wrapped in the double-quotes required by RFC 9110 §8.8.3 for the header form. A static origin that supports `If-None-Match` SHOULD return `304 Not Modified` on match and MUST NOT return `304` for a mismatched `If-None-Match`. A static origin that does not support conditional requests MAY ignore `If-None-Match` and serve `200`.

A static producer that controls its response headers SHOULD send `Cache-Control: public, max-age=<seconds>` for content that is anonymous and cacheable by intermediaries. The static profile is anonymous: there is no identity or tenant. Producers SHOULD NOT send `Cache-Control: private` on the static profile.

#### Runtime profile — derivation recipe

**PRD-103-R6.** A runtime producer MUST derive the `etag` value of an envelope by constructing the object

```
{ "identity": <stable-identity-key>, "payload": <envelope-minus-etag>, "tenant": <tenant-id-or-null> }
```

where:

- `payload` is the response envelope the producer is about to emit, with the `etag` field itself omitted from the input (as in PRD-103-R4 step 1).
- `identity` is the stable identity key for the principal making the request — a user ID, a service-principal ID, or the JSON literal `null` for public (unauthenticated) access. The identity key is at the producer's discretion but MUST be stable for a given principal across requests; the producer MUST NOT use a session-bound or request-bound surrogate (e.g., an opaque session token rotated per login) as the identity key.
- `tenant` is the tenant ID (string) when the producer's deployment is tenanted, or the JSON literal `null` for single-tenant deployments. The tenant ID MUST be stable for the lifetime of the tenant; the producer MUST NOT use a request-bound or rotation-bound surrogate.

The producer then applies steps 2 through 6 of PRD-103-R4 to the constructed object. The result is the runtime `etag` value.

**PRD-103-R7.** Runtime producers MUST NOT mix request-local data into the hash. Specifically, the hash input MUST NOT include: HTTP request timestamps; server wall-clock timestamps; request IDs; correlation IDs; trace IDs; random nonces; per-process or per-replica counters; any value that is not deterministic given a fixed `(payload, identity, tenant)` triple. A producer that violates this is non-conformant; consumers can detect it by issuing two consecutive identical requests and observing the `etag` change with no underlying content change.

Cross-replica determinism is the implementer's responsibility. The recipe makes it possible: any two replicas computing the recipe over the same `(payload, identity, tenant)` triple MUST produce the same `etag` value byte-for-byte. Replicas that fail to converge are not violating PRD-103-R6/R7 if their inputs differ (e.g., one replica has stale content); they are violating the recipe only if their inputs are identical and their outputs are not.

#### Runtime HTTP semantics

**PRD-103-R8.** A runtime server MUST honor the `If-None-Match` request header per RFC 9110 §13.1.2 and respond `304 Not Modified` when the `If-None-Match` value matches the resource's current `etag` (the value that would appear in a `200` response's envelope and `ETag` header). A runtime server MUST send the `ETag` HTTP response header on every `200` and every `304` response, with a value matching the envelope's `etag` field, wrapped in double-quotes per RFC 9110 §8.8.3. The `ETag` header value MUST NOT carry the `W/` weak prefix; ACT `etag` values are strong validators (PRD-103-R10). On `304`, the server MUST NOT include a response body. On `304`, the server SHOULD include the `Cache-Control` header that would have accompanied the corresponding `200` response.

**PRD-103-R9.** A runtime server SHOULD send `Cache-Control: private, must-revalidate` on responses whose `etag` was derived with a non-`null` identity (the response varies by user). A runtime server SHOULD send `Cache-Control: public, max-age=<seconds>` on responses whose `etag` was derived with `identity: null` and `tenant: null` (anonymous public content). For tenant-shared but unauthenticated content (`identity: null`, `tenant != null`), a runtime server SHOULD send `Cache-Control: public, max-age=<seconds>` together with `Vary` headers that disambiguate the tenant (e.g., `Vary: X-Tenant-Id` or whatever header carries tenant on the deployment). A runtime server MAY use `Cache-Control: no-cache` in lieu of `must-revalidate` when origin-revalidation on every request is required.

A runtime server SHOULD send `Vary: Authorization` (or `Vary: Cookie`, depending on the auth scheme) on any response whose `etag` was derived with a non-`null` identity, so that intermediaries do not serve one user's response to another.

#### Strong-validator and edge cases

**PRD-103-R10.** ACT `etag` values are strong validators in the RFC 9110 §8.8.1 sense. A producer MUST NOT advertise an ACT `etag` as weak (no `W/` prefix on the HTTP `ETag` header). Two responses bearing the same ACT `etag` value MUST be byte-equivalent in their envelope payload (modulo the `etag` field itself). Producers that need weak-validator semantics (e.g., to avoid recomputation when only insignificant fields change) MUST NOT use the ACT `etag` mechanism for that purpose; the hash recipe is fixed and includes every payload field other than `etag`.

#### Subtree envelopes (Standard)

**PRD-103-R11.** When a producer emits a subtree envelope (per PRD-107-R8), the subtree envelope MUST carry an `etag` field at the top level whose value is derived by the appropriate recipe — PRD-103-R4 if the deployment is static, PRD-103-R6 if the deployment is runtime — applied to the subtree envelope itself. The hash input is the subtree envelope's full payload minus its own `etag` field; the embedded node payloads inside the subtree envelope are part of the subtree envelope's hash input but the per-node `etag` fields inside the subtree envelope are part of the embedded node payloads (i.e., they are not stripped, only the subtree envelope's own top-level `etag` field is stripped from the hash input).

#### NDJSON index lines (Plus)

**PRD-103-R12.** When a producer emits an NDJSON index (per PRD-107-R10), each line of the NDJSON index MUST be a JSON object carrying an `etag` field at the top level of the line. The line's `etag` MUST be derived by the appropriate recipe — PRD-103-R4 if the deployment is static, PRD-103-R6 if the deployment is runtime — applied to that line's JSON object as the payload. Each line's `etag` is independent of other lines'; an NDJSON index does not have a single overall `etag`. (The advertised `index_ndjson_url` may be served by a static origin that emits its own HTTP `ETag` header for the file as a whole; that file-level HTTP `ETag` is outside ACT and is not subject to PRD-103.)

### Wire format / interface definition

The `etag` field appears at the top level of every node envelope, every index envelope, every subtree envelope (Standard), and every NDJSON-index line (Plus). The full envelope schemas are owned by the PRD-100 sibling; this PRD owns only the `etag` value-shape:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "ACT etag value",
  "type": "string",
  "pattern": "^[a-z0-9]+:[A-Za-z0-9_-]+$",
  "examples": [
    "s256:iH6ta82PUg0zi0lr_jpCLL",
    "s256:8Z0luYEDvPcDQKLimP55qC"
  ]
}
```

For v0.1 the algorithm prefix admit-list is exactly `{s256}` and the hash portion is exactly 22 base64url-safe characters; the tightened v0.1 form is `^s256:[A-Za-z0-9_-]{22}$`. The looser pattern at the schema's top level is intentional: it accommodates future MINOR additions to the algorithm admit-list per PRD-108-R4(3) without invalidating archived envelopes.

The full schema lives at `schemas/103/etag.schema.json` and is incorporated by reference into every envelope schema PRD-100 owns.

The runtime HTTP contract:

| Direction | Header | Value form | Notes |
|---|---|---|---|
| Response (200) | `ETag` | `"<etag-value>"` (double-quoted) | Strong validator. MUST match the envelope's `etag` field byte-for-byte, double-quoted per RFC 9110 §8.8.3. |
| Response (304) | `ETag` | `"<etag-value>"` | Same value as the corresponding 200 would carry. No response body. |
| Request | `If-None-Match` | `"<etag-value>"` (double-quoted) or a comma-separated list of double-quoted values | Server MUST honor per PRD-103-R8. |
| Response (any with private identity) | `Cache-Control` | `private, must-revalidate` (SHOULD) | Per PRD-103-R9. |
| Response (any with non-null identity) | `Vary` | `Authorization` or `Cookie` (SHOULD) | Per PRD-103-R9, prevents intermediary cross-user leakage. |
| Response (anonymous static or anonymous runtime) | `Cache-Control` | `public, max-age=<seconds>` (SHOULD) | Per PRD-103-R5 / R9. |

### Errors

This PRD defines no new HTTP status codes and no new error envelope. The runtime profile's caching surface uses only `200`, `304`, and the codes already enumerated in gap A4 (`401`, `403`, `404`, `410`, `429`, `5xx` — owned by PRD-106). Failure modes specific to PRD-103:

| Condition | Outcome | Notes |
|---|---|---|
| Producer emits an envelope without an `etag` field | Wire-format error | Per PRD-103-R1. Validator (PRD-600) emits a `gaps` entry citing `PRD-103-R1`. |
| Producer emits an `etag` whose value-shape violates `^[a-z0-9]+:[A-Za-z0-9_-]+$` (whitespace, padding, `+`/`/`, uppercase prefix) | Wire-format error | Per PRD-103-R2. |
| Producer emits an `etag` with an algorithm prefix outside the v0.1 admit-list | Wire-format error in v0.1 | Per PRD-103-R3. After a future MINOR bump that admits a new algorithm, this becomes a non-error. |
| Runtime producer's `etag` changes between two consecutive identical requests with no underlying content change | Conformance violation, not a wire-format error | Per PRD-103-R7. The wire format is well-formed; the recipe is broken. Validator detects via probe. |
| Runtime producer omits the `ETag` HTTP header on a `200` or `304` | Conformance violation | Per PRD-103-R8. |
| Runtime producer prefixes the `ETag` HTTP header value with `W/` | Conformance violation | Per PRD-103-R10. |
| Runtime producer returns `304` for an `If-None-Match` that does not match the current `etag` | Conformance violation | Per PRD-103-R8 (last clause). |
| Runtime producer returns a body on `304` | Conformance violation | Per PRD-103-R8. |

The validator (PRD-600 sibling, future) probes each of these and reports them in its `gaps` array.

---

## Examples

### Example 1 — Static node with valid `etag`

```json
{
  "act_version": "0.1",
  "id": "intro",
  "type": "document",
  "title": "Introduction",
  "summary": "A simple introduction.",
  "content": [
    { "type": "prose", "text": "Hello." }
  ],
  "tokens": { "body": 2, "summary": 4 },
  "etag": "s256:8Z0luYEDvPcDQKLimP55qC"
}
```

The `etag` value here was derived by PRD-103-R4 over the payload above with the `etag` field itself omitted. The worked example below verifies it bit-for-bit. See `fixtures/103/positive/node-with-valid-etag.json`.

### Example 2 — Static derivation walkthrough

Step-by-step over the payload from Example 1:

1. **Strip the `etag` field.** Input becomes:

   ```json
   {
     "act_version": "0.1",
     "id": "intro",
     "type": "document",
     "title": "Introduction",
     "summary": "A simple introduction.",
     "content": [{"type": "prose", "text": "Hello."}],
     "tokens": {"body": 2, "summary": 4}
   }
   ```

2. **Apply RFC 8785 JCS.** Keys are sorted lexicographically by Unicode code point at every level; no insignificant whitespace; numbers and strings serialized per JCS rules. The canonical UTF-8 byte sequence is:

   ```
   {"act_version":"0.1","content":[{"text":"Hello.","type":"prose"}],"id":"intro","summary":"A simple introduction.","title":"Introduction","tokens":{"body":2,"summary":4},"type":"document"}
   ```

   (245 bytes; printable as a single line.)

3. **SHA-256 those bytes.** The 32-byte digest, base64url-encoded without padding, is:

   ```
   8Z0luYEDvPcDQKLimP55qCAukbTPXkGsCOYE52y6mO0
   ```

   (43 base64url-safe characters; no `+`, `/`, or `=`.)

4. **Truncate to the first 22 characters.** Result: `8Z0luYEDvPcDQKLimP55qC`.

5. **Prepend `s256:`.** Final value: `s256:8Z0luYEDvPcDQKLimP55qC`.

This matches Example 1's `etag` field. The fixture `fixtures/103/positive/static-derivation-worked-example.json` records the canonical bytes and the expected hash; the validator (PRD-600 sibling) re-derives and asserts equality.

### Example 3 — Runtime derivation walkthrough

Same payload, now served by a runtime server scoped to user `user-42` in tenant `acme`:

1. **Construct the triple.** Strip `etag` from the payload (same as Example 2 step 1). Wrap in:

   ```json
   {
     "identity": "user-42",
     "payload": { /* the stripped payload */ },
     "tenant": "acme"
   }
   ```

2. **Apply JCS.** Keys at the outer level sort to `identity`, `payload`, `tenant`; the `payload` object is canonicalized recursively (same rules, same output as Example 2's canonical bytes embedded in a `"payload":<...>` value):

   ```
   {"identity":"user-42","payload":{"act_version":"0.1","content":[{"text":"Hello.","type":"prose"}],"id":"intro","summary":"A simple introduction.","title":"Introduction","tokens":{"body":2,"summary":4},"type":"document"},"tenant":"acme"}
   ```

3. **SHA-256, base64url no-pad.** Digest →

   ```
   iH6ta82PUg0zi0lr_jpCLLycVgByyH5N-MyxAbCbV9U
   ```

4. **Truncate to 22.** `iH6ta82PUg0zi0lr_jpCLL`.

5. **Prepend.** `s256:iH6ta82PUg0zi0lr_jpCLL`.

The runtime envelope returned to the user is:

```json
{
  "act_version": "0.1",
  "id": "intro",
  "type": "document",
  "title": "Introduction",
  "summary": "A simple introduction.",
  "content": [{"type": "prose", "text": "Hello."}],
  "tokens": {"body": 2, "summary": 4},
  "etag": "s256:iH6ta82PUg0zi0lr_jpCLL"
}
```

The HTTP response carries:

```
HTTP/1.1 200 OK
ETag: "s256:iH6ta82PUg0zi0lr_jpCLL"
Cache-Control: private, must-revalidate
Vary: Authorization
Content-Type: application/act-node+json
```

A second replica computing the same recipe over the same `(payload, identity, tenant)` triple MUST produce the same `etag` byte-for-byte. See `fixtures/103/positive/runtime-derivation-worked-example.json`.

### Example 4 — `If-None-Match` revalidation

A consumer that previously fetched the resource sends a follow-up request:

```
GET /act/n/intro.json HTTP/1.1
If-None-Match: "s256:iH6ta82PUg0zi0lr_jpCLL"
```

If the resource has not changed (same `(payload, identity, tenant)` triple), the server MUST respond:

```
HTTP/1.1 304 Not Modified
ETag: "s256:iH6ta82PUg0zi0lr_jpCLL"
Cache-Control: private, must-revalidate
```

(No body.) See `fixtures/103/positive/if-none-match-304.json`.

If the underlying payload, identity, or tenant changes, the recipe produces a different `etag`, the `If-None-Match` does not match, and the server responds `200` with the new envelope (and the new `ETag` header).

### Example 5 — A negative case the validator catches

A producer derives the runtime `etag` from `(payload, identity, tenant, request_id)` instead of the spec's three-tuple. Two consecutive requests for the same content + same user + same tenant produce different `etag` values:

```
GET /act/n/intro.json HTTP/1.1     →  200 OK; ETag: "s256:iH6ta82PUg0zi0lr_jpCLL"
GET /act/n/intro.json HTTP/1.1     →  200 OK; ETag: "s256:V8nQ4kRz2mP9wL3sBfH7Tx"
```

The wire format is well-formed (both `etag` values pass `etag.schema.json`) but the recipe is broken (PRD-103-R7). The validator's prober detects this by issuing two identical requests and observing the `etag` change without a content change. See `fixtures/103/negative/runtime-etag-with-request-id-nonce.json`.

---

## Test fixtures

Fixtures live under `fixtures/103/`. Each is a self-contained JSON document the validator (PRD-600 sibling, future) ingests; positive fixtures assert the recipe; negative fixtures assert detection of a specific failure mode.

### Positive

- `fixtures/103/positive/node-with-valid-etag.json` — a full node envelope whose `etag` is computed per PRD-103-R4 over the payload-minus-`etag`. Satisfies PRD-103-R1, R2, R3, R4.
- `fixtures/103/positive/static-derivation-worked-example.json` — records the input, the JCS canonical bytes, the SHA-256 digest, and the truncated `s256:` prefix for the static recipe. Lets the validator compute end-to-end and byte-compare. Satisfies PRD-103-R4.
- `fixtures/103/positive/runtime-derivation-worked-example.json` — records the input `(payload, identity, tenant)` triple and the expected runtime `etag`. The expected value `s256:iH6ta82PUg0zi0lr_jpCLL` is reproducible across replicas given the same triple. Satisfies PRD-103-R6, R7.
- `fixtures/103/positive/if-none-match-304.json` — records a request with an `If-None-Match` header matching the server's current `etag` and the expected `304 Not Modified` response (with `ETag` header echoed and no body). Satisfies PRD-103-R8.

### Negative

- `fixtures/103/negative/node-missing-etag.json` — a node envelope omitting the `etag` field. Validator MUST emit a `gaps` entry citing PRD-103-R1.
- `fixtures/103/negative/etag-with-timestamp-suffix.json` — an `etag` whose value is `s256:<22-char-hash>-<unix-timestamp>`, mixing a build-local timestamp into the value. Validator MUST emit a `gaps` entry citing PRD-103-R7 (request-local data prohibited) and PRD-103-R2 (value-shape, since the timestamp suffix breaks the v0.1 22-char form).
- `fixtures/103/negative/runtime-etag-with-request-id-nonce.json` — a runtime producer that derived the `etag` from `(payload, identity, tenant, request_id)` instead of the spec triple. Validator MUST emit a `gaps` entry citing PRD-103-R7. Detected by issuing two identical requests and observing the `etag` change with no content change.
- `fixtures/103/negative/etag-whitespace-and-bad-charset.json` — a collection of `etag` values violating PRD-103-R2's value-shape pattern: leading whitespace, internal whitespace, non-base64url-safe characters (`+`, `/`), padding (`==`), and uppercase algorithm prefix (`S256:`). Validator MUST emit a `gaps` entry citing PRD-103-R2 for each.

The fixtures are exercised by PRD-600's validator suite once that PRD reaches Implemented. PRD-103's acceptance criteria require only that each fixture's expected `etag` value can be re-derived bit-for-bit from the recorded canonical bytes by an independent implementation.

---

## Versioning & compatibility

Per PRD-108, classification of changes to PRD-103:

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a new algorithm prefix to the `etag` value-shape (e.g., admit `b3:` for BLAKE3) | MINOR | The algorithm-prefix admit-list is documented as open in v0.1 (the schema's top-level pattern admits any lowercase alphanumeric prefix). PRD-108-R4(3) classifies adding a value to a documented-open enum as MINOR. Producers continue to emit `s256` until they upgrade. |
| Remove `s256` from the admit-list | MAJOR | Per PRD-108-R5(1) (removing a required value) — every existing envelope's `etag` becomes non-conformant. Requires a deprecation window per PRD-108-R12 and a successor algorithm available for at least one full MAJOR cycle. |
| Change the runtime triple from `(payload, identity, tenant)` to a different shape (e.g., `(payload, identity, tenant, locale)`) | MAJOR | Per PRD-108-R5(2) — changing the semantics of a required field (`etag`'s derivation is the field's semantics). Existing consumers' caches become invalid; existing producers' replicas drift. |
| Change the truncation length from 22 chars to a different value | MAJOR | Per PRD-108-R5(6) — changing a syntactic constraint on a required field's value. Every existing `etag` ceases to validate. |
| Change the canonical encoding from JCS to a different scheme | MAJOR | Per PRD-108-R5(2). Even canonicalization variants that produce the same output for most payloads diverge on edge cases (number precision, string escaping); the change is semantic. |
| Tighten PRD-103-R5 (static `Cache-Control` SHOULD) to a MUST | MAJOR | Per PRD-108-R5(3). |
| Loosen PRD-103-R8 (runtime MUST honor `If-None-Match`) to a SHOULD | MAJOR | Per PRD-108-R5(3). |
| Add a new SHOULD-level recommendation for an additional response header (e.g., recommend `Last-Modified`) | MINOR | Per PRD-108-R4(1) (additive optional behavior). |
| Tighten the etag schema pattern to forbid currently-legal characters (e.g., disallow `_` in the hash portion) | MAJOR | Per PRD-108-R5(6). The base64url alphabet is fixed; tightening would invalidate existing values. |
| Add a manifest-level capability flag advertising the supported algorithm set | MINOR | Per PRD-108-R4(5). The flag is informational; consumers MAY use it but MUST NOT depend on its presence. (See Open question #2.) |
| Editorial revision (clarification of prose, no normative change) | n/a | Per `000-governance` R18. |

### Forward compatibility

A consumer that implements ACT v0.1 — and therefore expects `etag` values to begin with `s256:` and have a 22-char hash — encountering an envelope whose `etag` begins with a different algorithm prefix MUST treat the value as opaque: the value is still a valid revalidation token (the consumer can echo it back in `If-None-Match` and the producer still matches it byte-for-byte), even though the consumer cannot itself recompute it. The consumer SHOULD warn that the algorithm is unrecognized (per PRD-108-R9 MINOR-mismatch warning channel) but MUST proceed. The opacity rule is what makes admitting a new algorithm a MINOR bump.

A consumer that needs to *verify* an `etag` (e.g., to confirm a provider is not lying about content equality across replicas) MUST be able to recompute it; such a consumer MAY refuse unrecognized algorithm prefixes. This is a niche use case (validators, audit tools); ordinary content consumers do not need it.

### Backward compatibility

Within v0.1, every conformant producer emits `s256:`-prefixed values. There is no deprecation window in v0.1; the deprecation window opens the first time a future MINOR adds a second algorithm and a future MAJOR proposes removing `s256`. Per PRD-108-R12, that removal MAY happen no earlier than `(M+1).0` from the MINOR that introduced the deprecation.

A producer that upgrades to a future spec version admitting a second algorithm MUST continue to emit `s256:` values until the spec deprecates `s256`, OR MAY transition to the new algorithm if the manifest's `act_version` reflects the new MINOR. A consumer pinned to a lower MINOR that receives a new-algorithm `etag` follows the forward-compat rule above (treat opaque, warn, proceed).

---

## Security considerations

This section is a placeholder for PRD-109 (security, sibling) to subsume. Notable points specific to PRD-103:

- **ETag MUST NOT leak identity in cleartext.** The recipe's hash output (the 22-char base64url string after `s256:`) is the only part of the value that exits the producer's process. It is cryptographically opaque: a 132-bit truncated SHA-256 digest. Tenant ID and identity key are inputs to the hash, never embedded in the output. A network observer cannot recover identity from the `etag` value. (Cite gap C2; forward to PRD-109 for the project-wide PII posture.)
- **Length / structure side-channels are bounded.** Every conformant ACT v0.1 `etag` value has the exact same byte length: `s256:` (5 bytes) + 22 base64url chars = 27 bytes. There is no length variation that could leak about the underlying payload, identity, or tenant. Once a future MINOR admits a second algorithm with a different length, this property weakens slightly (a network observer could distinguish algorithms by length); the forward-compat opacity rule still holds for value content. PRD-109 owns the deeper threat model.
- **Collision resistance is bounded by the truncation.** 22 base64url-safe characters encode 132 bits. Birthday-collision probability reaches 50% at roughly 2^66 distinct hash inputs. For any plausible deployment (number of distinct `(payload, identity, tenant)` triples a single ACT producer emits), the collision risk is negligible. The trade-off — full SHA-256 (43 chars) vs. truncated-to-22 (22 chars) — was chosen for envelope-size economy at the cost of ~50 bits of pre-image space; pre-image attacks against 132-bit truncated SHA-256 remain computationally infeasible.
- **Strong-validator guarantee.** PRD-103-R10 forbids weak validators. A consumer relying on `If-None-Match` for cache-coherence on security-relevant content (e.g., a server-emitted policy document) can therefore trust that two identical `etag` values mean the same envelope payload. (Caveat: consumers that need *byte-equivalent* envelopes including the `etag` field itself MUST compare envelopes directly; the recipe excludes `etag` from its own input by construction.)
- **No request-local mixing — defense against accidental fingerprinting.** PRD-103-R7's prohibition on timestamps, request IDs, and nonces is a security property as well as a determinism property. A producer that mixed in a request ID would create an `etag` that varies per request even when content does not — defeating revalidation, and as a side effect also creating a per-request fingerprint that consumers might inadvertently log. The prohibition closes both holes.
- **Runtime ETag scoping does not replace authorization.** A consumer that issues `If-None-Match: "s256:..."` against a resource it should not have access to MUST receive a `404 Not Found` (or `401 Unauthorized` per PRD-106's auth rules); the server MUST NOT reveal whether the supplied `etag` matches by treating the request as if the resource exists when it does not. PRD-106 owns this; PRD-103 does not weaken it.
- **`Vary` discipline.** PRD-103-R9's recommendation to send `Vary: Authorization` (or `Vary: Cookie`) on identity-scoped responses is what prevents shared HTTP intermediaries from serving one user's cached response to another. Producers that fail to send `Vary` introduce a cross-user content disclosure vulnerability. Forward to PRD-109 for the threat model.

PRD-109 (security, sibling, in flight) subsumes this section; further security-sensitive interactions (auth scheme negotiation, error envelope leakage, side-channel timing) are owned there.

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft per gap A4 (304/etag in static and runtime endpoint tables) and gap C2 (ETag derivation under runtime + per-tenant scoping — full recipe). Cites PRD-107 (Accepted) for Core/Standard/Plus assignment of `etag` and runtime `If-None-Match` honoring; cites PRD-108 (Accepted) for change-classification of the recipe and the algorithm-prefix admit-list; forwards security posture to PRD-109. Provides positive worked examples for both static and runtime derivation with reproducible expected hashes (`s256:8Z0luYEDvPcDQKLimP55qC` static; `s256:iH6ta82PUg0zi0lr_jpCLL` runtime). Status: In review. |
| 2026-05-01 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
