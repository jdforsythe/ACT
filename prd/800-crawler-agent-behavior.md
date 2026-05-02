# PRD-800 — Crawler & agent behavior (identification, rate limits, robots.txt, caching, error handling)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

The wire-format PRDs (PRD-100 through PRD-109) tell a producer how to emit ACT and a consumer's library author how to parse it. They do not tell the **operator** of an ACT-aware agent or crawler how to behave on the open web: how to identify itself in `User-Agent`, whether to respect `robots.txt` or treat ACT as an override, how to read and honor the manifest's advisory rate limit, when to cache vs. revalidate, and how to back off from server errors. As a result, two well-meaning ACT consumers will fetch a single producer at incompatible cadences — one polling every 30 seconds because nothing told it to slow down, the other never revalidating because nothing told it to use `If-None-Match` — and the producer's operator has no shared expectations to point at when filing a bug or rate-limiting an offender. PRD-101 (discovery), PRD-103 (caching), PRD-106 (runtime), and PRD-109 (security) each touch a slice of this surface, but none of them speaks to the **agent operator** as the audience. PRD-800 is that document. It does not invent new wire-format requirements; it codifies what an ACT-aware crawler/agent MUST and SHOULD do when interacting with a conformant producer over HTTP.

### Goals

1. Define the identification convention an ACT-aware agent uses in `User-Agent` so producers can distinguish it from a browser and apply ACT-aware policies (e.g., the manifest's advisory rate limit).
2. Codify the relationship between ACT and `robots.txt`: ACT does not override robots.txt; if robots.txt disallows the well-known path, an agent MUST NOT fetch.
3. Pin the consumer's interpretation of the manifest's `policy.rate_limit_per_minute` field, including the default (60/min) when the field is unset.
4. Pin the consumer's caching and conditional-request behavior: use `If-None-Match` against PRD-103 ETags; respect `Cache-Control` per RFC 9111.
5. Specify error-handling: back off on 429 / 5xx; do not retry 401 / 403; surface authentication challenges per PRD-106.
6. Establish that these behaviors are normative for ACT-aware agents (Core), regardless of whether the producer is Core / Standard / Plus.
7. Cross-reference PRD-101 for discovery, PRD-103 for caching, PRD-106 for runtime status codes, PRD-109 for security; do not redefine those surfaces here.

### Non-goals

1. Defining the wire-format envelopes or the manifest fields themselves. PRD-100 owns the manifest; PRD-800 references field names.
2. Defining the discovery flow. PRD-101 owns discovery; PRD-800 cites the well-known path and the runtime hand-off.
3. Defining the ETag derivation recipe. PRD-103 owns the recipe; PRD-800 only requires that consumers use the value PRD-103 produces.
4. Defining the runtime error envelope or HTTP status code semantics. PRD-106 owns those; PRD-800 specifies how an agent reacts to them.
5. Defining the project-wide threat model. PRD-109 owns it; PRD-800 cites it for the security implications of `User-Agent` truthfulness and rate-limit honoring.
6. Defining what an ACT producer MUST send (rate-limit headers, etc.). The producer side is mostly owned by PRD-106. PRD-800 refers back to the producer rules where they affect agent behavior.
7. Defining MCP-aware crawler behavior. ACT and MCP are complementary; an MCP-only client is not an ACT consumer and is out of scope for PRD-800. The ACT-MCP bridge (PRD-602) inherits PRD-800 only insofar as the bridge issues HTTP fetches against an ACT producer.
8. Defining agent identity / authentication onto third-party APIs. PRD-800 covers HTTP-level fetch behavior against ACT-conformant origins; agent-level authn / authz against arbitrary services is out of scope.

### Stakeholders / audience

- **Authors of:** ACT-aware agent operators (the people running an ACT crawler), agent SDK authors (PRD-500-series), validator authors (PRD-600), partner platforms running large-scale ingestion against ACT producers.
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Agents impersonate browsers in `User-Agent` to evade rate limits or reach content gated by browser-only paths. | Medium | Medium | PRD-800-R1 makes truthful identification a Core MUST. PRD-109 already names impersonation as an integrity threat. PRD-800-R2 fixes the canonical token (`ACT-Agent/{version}`) so producers can write rate-limit rules deterministically. |
| Agents ignore `robots.txt` because "ACT is a different protocol." | Medium | High — reputational and legal | PRD-800-R3 makes robots.txt honoring a HARD MUST. ACT does not override robots.txt; if the well-known path is disallowed, the agent MUST NOT fetch even though the manifest exists. |
| Producers set unrealistic rate limits (`rate_limit_per_minute: 1`) and crash agent throughput. | Low | Medium | PRD-800-R5 requires the agent to honor the field as advertised; producers that set degenerate values absorb the resulting traffic loss. PRD-800-R6 sets a reasonable default (60/min) when the field is unset. |
| Agents back off too aggressively on 429 and starve the producer's recovery telemetry. | Low | Low | PRD-800-R10 specifies exponential backoff with jitter, anchored at the `Retry-After` value when present; specific bounds reference common practice (initial 1s, cap 5min, factor 2). |
| Conditional requests are sent with the wrong validator (`If-Modified-Since` instead of `If-None-Match`), breaking PRD-103 revalidation. | Medium | Medium | PRD-800-R7 names `If-None-Match` exclusively; ACT does not use date-based validators per PRD-103-R10. |
| Agents retry 401 / 403, treating them as transient. | Medium | Low | PRD-800-R11 forbids retry on 401/403 unless credentials change. |
| Agents disclose internal infrastructure in `User-Agent` (e.g., AWS account IDs, internal hostnames). | Low | Low | PRD-800-R2 fixes the canonical token shape and lists what the contact field MAY include; SHOULD-language steers operators toward an email or homepage URL, not internal identifiers. |

### Open questions

1. Should the canonical `User-Agent` token reserve a sub-token for the agent's role (e.g., `ACT-Agent/0.1 (purpose=crawl)` vs `purpose=runtime`)? Tentatively no for v0.1 — too much granularity for too little value. Producers that need to distinguish can use the contact URL or query the agent out-of-band. Revisit if multi-purpose agents (crawl + runtime) become common.
2. Should PRD-800 specify an `If-Modified-Since` fallback for producers that don't honor `If-None-Match`? Tentatively no — PRD-103 mandates ETag at all conformance levels. A producer that omits ETag is non-conformant; the agent's behavior against non-conformant producers is defined only at the wire-format level (refuse to consume).
3. Should the rate limit be per-host or per-`(host, identity)` for runtime (authenticated) producers? Tentatively per-host for simplicity; runtime producers that want per-identity limits can enforce them server-side and the agent honors 429 + `Retry-After` regardless. Reconsider if PRD-106 evolves identity-scoped limits.

### Acceptance criteria

- [ ] Every requirement has an ID of the form `PRD-800-R{n}`.
- [ ] Identification, rate-limit, robots.txt, caching, and error-handling sections each carry at least one normative requirement.
- [ ] The `policy.rate_limit_per_minute` default (60/min) is pinned for the unset case.
- [ ] PRD-101, PRD-103, PRD-106, PRD-109 are cited for the surfaces they own; PRD-800 does not redefine them.
- [ ] Conformance level is declared per requirement.
- [ ] Versioning & compatibility table classifies kinds-of-change to PRD-800 per PRD-108.
- [ ] Security section addresses `User-Agent` truthfulness and DoS mitigation via rate limits.
- [ ] Changelog initial entry dated 2026-05-02 is present.

---

## Context & dependencies

### Depends on

- **PRD-100** (Accepted): the manifest envelope, including the `policy` object and its `rate_limit_per_minute` field. PRD-800 references the field by name.
- **PRD-101** (Accepted): the discovery flow, the well-known path, the runtime hand-off via `Link` header.
- **PRD-103** (Accepted): the ETag value-shape and the runtime `If-None-Match` / `304` contract.
- **PRD-106** (Accepted): the runtime endpoint set, the closed error-code enum, the `WWW-Authenticate` requirement on 401, the `Retry-After` requirement on 429.
- **PRD-107** (Accepted): conformance levels.
- **PRD-108** (Accepted): versioning policy.
- **PRD-109** (Accepted): the project-wide threat model. PRD-800's `User-Agent` truthfulness rule is a downstream of PRD-109's integrity posture; rate-limit honoring is a DoS-mitigation control.
- **000-governance** (Accepted): change-control rules.
- External: [RFC 7231 §5.5.3](https://www.rfc-editor.org/rfc/rfc7231#section-5.5.3) (`User-Agent` header), [RFC 9111](https://www.rfc-editor.org/rfc/rfc9111) (HTTP caching, `Cache-Control`), [RFC 9110 §15.5.2](https://www.rfc-editor.org/rfc/rfc9110) (401), [§15.5.4](https://www.rfc-editor.org/rfc/rfc9110) (403), [§15.5.16](https://www.rfc-editor.org/rfc/rfc9110) (404), [§15.5.20](https://www.rfc-editor.org/rfc/rfc9110) (410), [§15.5.29](https://www.rfc-editor.org/rfc/rfc9110) (429), [§10.2.3](https://www.rfc-editor.org/rfc/rfc9110) (`Retry-After`), [RFC 9309](https://www.rfc-editor.org/rfc/rfc9309) (Robots Exclusion Protocol).

### Blocks

- PRD-602 (ACT-MCP bridge): bridge implementations issuing ACT fetches inherit PRD-800.
- PRD-500-series runtime SDKs: SDK clients issuing ACT fetches inherit PRD-800.
- PRD-600 (validator): the validator's prober is itself an ACT-aware agent and MUST conform to PRD-800.

### References

- v0.1 draft: §5.13.4 (per-tenant scoping — informs the rate-limit per-host vs per-identity question), §10 Q14 (the deferred per-node "agents only" / "no train" flags — PRD-109 owns the rationale).
- `000-decisions-needed.md`: Q1 (governance — for the contact field's stewardship), Q9 (GitHub Discussions — for the contact escalation path).
- Prior art: GoogleBot's `User-Agent` and rate-limit conventions; the Internet Archive's Heritrix crawler; Common Crawl's published agent identification; the `crawl-delay` directive in robots.txt (informational, not normative here).

---

## Specification

This is the normative section. Everything below MUST use RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) where requirements are imposed. Lowercase "must" and "should" are non-normative prose.

### Conformance level

Crawler/agent behavior is **Core** — every ACT-aware agent at every conformance level honors these rules when interacting with any ACT producer. Two requirements have a band qualifier:

- **Core:** R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R12, R13, R14, R15, R16.
- **Standard:** R7's subtree-revalidation guidance applies to agents that fetch subtree endpoints (Standard or Plus producers). Agents that fetch only Core surfaces apply R7 to manifest, index, and node only.
- **Plus:** No additional Plus-specific requirements; agents that consume Plus surfaces (NDJSON index, search) inherit the Core rate-limit and caching rules without modification.

### Normative requirements

#### Identification

**PRD-800-R1.** An ACT-aware agent or crawler MUST identify itself as an agent (not a browser) on every HTTP request issued against an ACT producer. The agent MUST NOT spoof a browser `User-Agent` string for the purpose of evading rate limits, fetching browser-gated content, or otherwise impersonating end-user traffic.

**PRD-800-R2.** The `User-Agent` header on every ACT request MUST contain the canonical token `ACT-Agent/{version}` (where `{version}` is the agent software's own semver-shaped version string), followed by a parenthesized contact field and any product-specific suffix. The contact field SHOULD be either an email address or a URL the producer's operator can reach to report abuse, request rate-limit relief, or coordinate. Example:

```
User-Agent: ACT-Agent/1.4.2 (+https://example.com/agents/acme-bot; contact=ops@example.com) AcmeBot/1.0
```

The exact format (parenthesized vs. plus-prefixed URL) is producer-tolerant — producers MUST NOT reject requests for cosmetic header variations — but the leading `ACT-Agent/{version}` token is normative. Agents MUST NOT include sensitive infrastructure identifiers (internal hostnames, account IDs, private network addresses) in the `User-Agent` value.

**PRD-800-R3.** An agent MAY also send the `From` header (RFC 9110 §10.1.2) with the same email address as in R2's contact field. If sent, the address SHOULD be monitored by a human or a triage system that can respond to producer complaints within one business day.

#### Robots.txt interaction

**PRD-800-R4.** An ACT-aware agent MUST honor the producer's `robots.txt` (RFC 9309) before fetching any ACT resource. Specifically:

- If `robots.txt` disallows the path `/.well-known/act.json` for the agent's `User-Agent` token (matched against the leading `ACT-Agent` token from R2 or against the standard `*` rule), the agent MUST NOT fetch the manifest, the index, or any node, subtree, or NDJSON-index URL on that origin.
- If `robots.txt` disallows the index URL, a node URL pattern, or the NDJSON index URL specifically, the agent MUST NOT fetch the disallowed paths.
- If `robots.txt` is unreachable (network error, 5xx, or DNS failure), the agent SHOULD treat the origin as **disallowed** until robots.txt becomes reachable. Treating an unreachable robots.txt as "allow-all" is a SHOULD NOT.

ACT does not override `robots.txt`. A producer that wishes to be ACT-discoverable MUST permit the well-known path in its `robots.txt` (or omit the disallow rule for that path).

**PRD-800-R5.** Authenticated runtime profile (PRD-106): when the producer requires authentication, `robots.txt` discipline still applies to the discovery probe (the unauthenticated robots.txt fetch and any unauthenticated probe of `/.well-known/act.json`). Once the agent has authenticated and is following the runtime hand-off (Link header per PRD-101-R5), robots.txt no longer gates the authenticated request set — at that point the producer's authentication scheme is the access control.

#### Rate limits

**PRD-800-R6.** An ACT-aware agent MUST read the manifest's `policy.rate_limit_per_minute` field (PRD-100 / PRD-106) and limit its outgoing request rate to that origin to no more than the advertised value, averaged over any rolling 60-second window. The limit is per-origin (scheme + host + port). When the field is omitted from the manifest, the agent MUST default to **60 requests per minute** per origin.

**PRD-800-R7.** When the producer responds with HTTP `429 Too Many Requests` (per PRD-106-R6), the agent MUST stop issuing further requests to that origin until the duration indicated by the response's `Retry-After` header has elapsed. If `Retry-After` is absent (which violates PRD-106-R6 from the producer side, but the agent handles it gracefully), the agent SHOULD wait at least 60 seconds before retrying.

**PRD-800-R8.** An agent SHOULD apply a **per-origin concurrency cap** in addition to the per-minute rate limit: no more than 4 concurrent in-flight requests against a single origin by default. Operators MAY raise the cap when the producer publishes a higher advertised throughput (e.g., via an out-of-band agreement); the manifest's `policy.rate_limit_per_minute` is the ceiling on average rate, not on burst concurrency.

**PRD-800-R9.** An agent's outgoing rate to a producer SHOULD scale **down**, never up, on observed degradation: persistent 5xx, persistent 429, or median latency growth above 2x baseline. Specific bounds are operator-tunable; the SHOULD covers the spirit (be a good neighbor).

#### Caching and conditional requests

**PRD-800-R10.** An ACT-aware agent MUST issue conditional requests using `If-None-Match` (PRD-103, RFC 9110 §13.1.2) against any ACT resource it has previously fetched and whose ETag it has retained. The agent MUST NOT use `If-Modified-Since` for ACT resources; ACT uses strong validators only per PRD-103-R10.

**PRD-800-R11.** On a `304 Not Modified` response, the agent MUST treat its cached copy as fresh and re-evaluate its TTL per RFC 9111. The agent MUST NOT discard the cached copy on 304.

**PRD-800-R12.** The agent MUST honor the response's `Cache-Control` directives per RFC 9111 §5.2 — specifically `no-store` (do not cache), `no-cache` (revalidate before reuse), `private` (do not store in shared caches), `max-age` (freshness lifetime), and `must-revalidate` (cannot serve stale on origin failure). When a directive conflicts with an in-process cache policy, RFC 9111 wins.

**PRD-800-R13.** The agent SHOULD revalidate before fetching when its cached entry's `max-age` has expired and an ETag is available. The agent SHOULD NOT pre-emptively revalidate for resources within their freshness window, except when explicit user action (e.g., a forced refresh) is requested.

#### Error handling

**PRD-800-R14.** On HTTP `5xx` responses, the agent MUST back off and retry with exponential delay and jitter. The recommended schedule is: initial delay 1 second, multiplier 2, jitter ±25%, cap 300 seconds, give-up after 5 attempts. Operators MAY tune; the spirit is "back off, don't hammer."

**PRD-800-R15.** On HTTP `401 Unauthorized` (PRD-106) the agent MUST NOT retry without changing credentials. The agent MUST surface the `WWW-Authenticate` challenge to its caller (or to the agent's auth subsystem) so the missing or expired credential can be obtained. After credentials are refreshed, the agent MAY retry once; persistent 401 after credential refresh is treated as a hard failure.

**PRD-800-R16.** On HTTP `403 Forbidden` the agent MUST NOT retry. 403 indicates the producer has authoritatively denied access; retrying is wasted effort and may trigger producer-side rate limiting on the abuse pathway. The agent MUST surface 403 to its caller.

**PRD-800-R17.** On HTTP `404 Not Found` the agent MUST treat the resource as absent and MUST NOT retry the same URL within a short interval. A separate, scheduled re-discovery (e.g., a periodic re-fetch of the well-known path) MAY occur per the agent's normal cadence, subject to the rate limits in R6–R9.

**PRD-800-R18.** On HTTP `410 Gone` the agent MUST treat the resource as **permanently absent** and SHOULD remove it from any persisted index it maintains. The agent MUST NOT retry a 410'd URL.

### Wire format / interface definition

_Not applicable — non-wire-format PRD; rules are policy, not protocol._

### Errors

| Condition | Agent behavior | Notes |
|---|---|---|
| `robots.txt` disallows `/.well-known/act.json` | Agent MUST NOT fetch the manifest. Surface to caller as a "disallowed" outcome, distinct from "unreachable." | Per R4. |
| Manifest sets `policy.rate_limit_per_minute: 0` (degenerate) | Agent MUST NOT fetch beyond the manifest itself. Treat as advisory non-availability. | Per R6 (the field is honored verbatim). |
| Manifest omits `policy.rate_limit_per_minute` | Agent applies default 60/min. | Per R6. |
| Producer returns 429 with no `Retry-After` | Agent waits at least 60s before retry. | Per R7. |
| Producer returns 401; agent retries without credential change | Violates R15. | PRD-600 may probe agent behavior in conformance suites. |
| Producer returns 5xx; agent retries with no backoff | Violates R14. | Detectable as observed traffic pattern, not as a wire-format error. |

PRD-800 introduces no HTTP responses of its own; it constrains agent behavior only.

---

## Examples

### Example 1 — Canonical `User-Agent`

A crawler operated by Acme Corp identifies itself on every request:

```
User-Agent: ACT-Agent/0.1 (+https://acme.example/bots; contact=abuse@acme.example) AcmeCrawler/4.7
```

Per R2, the leading `ACT-Agent/0.1` token tells the producer this is an ACT-aware agent; the parenthesized contact provides an abuse channel; the trailing `AcmeCrawler/4.7` is the agent software's own version. Producers may match `ACT-Agent` in their robots.txt rules.

### Example 2 — robots.txt enforcement

A producer publishes:

```
# robots.txt
User-agent: *
Allow: /.well-known/act.json
Allow: /act/

User-agent: ACT-Agent
Allow: /.well-known/act.json
Allow: /act/
Disallow: /act/private/
```

An agent fetches the manifest (allowed), the index (allowed), and a node URL `/act/n/private-roadmap.json` (disallowed by the second block). Per R4, the agent MUST NOT fetch `/act/private/` or `/act/n/private-roadmap.json`; the producer's intent is clear even though the manifest's index might list the node.

### Example 3 — Rate-limit honoring

A manifest declares:

```json
{
  "act_version": "0.1",
  "policy": { "rate_limit_per_minute": 30 }
}
```

The agent caps its outgoing requests to 30/min averaged over any rolling 60-second window. With the per-origin concurrency cap of 4 (R8), the agent might issue 4 parallel fetches in 0.5s, then sleep 1.5s before the next batch — same average rate, observable burstiness.

A second manifest omits the field entirely. The agent applies 60/min by default per R6.

A third manifest sets `rate_limit_per_minute: 1`. The agent fetches the manifest, then sends at most one further request per minute. The producer absorbs the throughput penalty of its own setting.

### Example 4 — Conditional revalidation

The agent has cached a node with `etag: "s256:iH6ta82PUg0zi0lr_jpCLL"` and `max-age=3600`. After 3600 seconds, before re-fetching, the agent issues:

```
GET /act/n/intro.json HTTP/1.1
Host: example.com
User-Agent: ACT-Agent/0.1 (+https://acme.example/bots; contact=abuse@acme.example)
If-None-Match: "s256:iH6ta82PUg0zi0lr_jpCLL"
```

The producer responds `304 Not Modified`. The agent updates its cache TTL per RFC 9111 and reuses the cached body. Per R10–R13.

### Example 5 — 401 + WWW-Authenticate

The agent fetches `/act/n/private-doc.json` on a runtime producer:

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="acme"
Content-Type: application/act-error+json

{ "act_version": "0.1", "error": { "code": "unauthorized", "message": "..." } }
```

Per R15, the agent surfaces the `WWW-Authenticate` challenge to its auth subsystem, obtains a Bearer token, and may retry **once** with the new credential. If the second attempt also returns 401, the agent treats this as a hard failure (no further automatic retry).

### Example 6 — 5xx exponential backoff

The agent fetches the index and gets `503 Service Unavailable` with no `Retry-After`:

| Attempt | Wait before | Outcome |
|---|---|---|
| 1 | 0s | 503 |
| 2 | 1s ± 250ms jitter | 503 |
| 3 | 2s ± 500ms | 503 |
| 4 | 4s ± 1s | 200 |

After attempt 4 succeeds, the agent resumes normal cadence. If attempt 5 had also failed, the agent gives up per R14's recommended cap of 5 attempts and surfaces the failure to its caller.

---

## Test fixtures

Process / behavioral PRD; the rules are testable indirectly via captured HTTP transcripts. Fixtures live under `fixtures/800/` and are exercised by PRD-600 and by agent SDK test suites that simulate a producer.

### Positive

- `fixtures/800/positive/canonical-user-agent.json` → captured request whose `User-Agent` starts with `ACT-Agent/{version}`. Satisfies R2.
- `fixtures/800/positive/robots-allow-then-fetch.json` → captured robots.txt allowing `/.well-known/act.json`, followed by a successful manifest fetch. Satisfies R4.
- `fixtures/800/positive/robots-disallow-no-fetch.json` → captured robots.txt disallowing the well-known path; transcript shows the agent did not subsequently fetch. Satisfies R4.
- `fixtures/800/positive/conditional-revalidate.json` → captured request with `If-None-Match` matching the stored ETag; response is 304. Satisfies R10, R11.
- `fixtures/800/positive/rate-limit-honored.json` → captured request stream showing ≤30 requests/min after a manifest declared `rate_limit_per_minute: 30`. Satisfies R6.
- `fixtures/800/positive/exponential-backoff.json` → captured 5xx + retry stream showing increasing inter-request delay. Satisfies R14.

### Negative

- `fixtures/800/negative/browser-user-agent.json` → captured request with `User-Agent: Mozilla/5.0 ... Chrome/...` and no `ACT-Agent` token. Violates R1, R2.
- `fixtures/800/negative/robots-disallow-but-fetched.json` → captured robots.txt disallowing the well-known path, followed by a manifest fetch. Violates R4.
- `fixtures/800/negative/if-modified-since.json` → captured conditional request using `If-Modified-Since` instead of `If-None-Match`. Violates R10.
- `fixtures/800/negative/rate-limit-exceeded.json` → captured request stream at 120/min against a manifest declaring `rate_limit_per_minute: 30`. Violates R6.
- `fixtures/800/negative/retry-on-401.json` → captured 401 followed by an immediate retry with the same credential. Violates R15.
- `fixtures/800/negative/retry-on-403.json` → captured 403 followed by automatic retry. Violates R16.
- `fixtures/800/negative/no-backoff-on-5xx.json` → captured 5xx burst with constant inter-request delay. Violates R14.

---

## Versioning & compatibility

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a new SHOULD requirement (e.g., suggest emitting `Accept-Encoding: gzip`) | MINOR | Additive guidance. |
| Tighten an existing SHOULD to a MUST | MAJOR | Per PRD-108-R5(3). |
| Loosen an existing MUST to a SHOULD | MAJOR | Per PRD-108-R5(3). |
| Change the canonical `User-Agent` token from `ACT-Agent/{version}` to anything else | MAJOR | Producers' robots.txt and rate-limit rules may key on the token. |
| Change the default `rate_limit_per_minute` (60/min) when the field is unset | MAJOR | Existing agents and producers rely on the floor. |
| Add a new error-handling rule (e.g., behavior on a new status code) | MINOR | Additive. |
| Change the recommended exponential-backoff parameters (initial delay, multiplier, cap) | MINOR | Recommended values are SHOULD-language; tuning them does not break conformance. |
| Forbid retry on a status code currently marked retryable | MAJOR | Tightens behavior. |
| Permit retry on a status code currently marked non-retryable (e.g., 403) | MAJOR | Loosens behavior; existing producers expect agents not to retry. |
| Editorial: example URLs, prose clarifications | n/a | Per `000-governance` R18. |

### Forward compatibility

A future MINOR addition to this PRD (e.g., guidance on `Accept-Encoding`, on connection reuse, or on a new optional manifest field that scopes rate limits per resource family) MUST be additive to existing agent behavior. Agents implementing an earlier MINOR remain conformant; they simply do not implement the new SHOULD.

### Backward compatibility

Within a MAJOR, an agent built against `act_version 0.1` continues to satisfy PRD-800 against producers running `0.1+n` for any MINOR `n`. Producers MUST NOT key rate-limit policy on a future `User-Agent` token shape that has not been defined here.

---

## Security considerations

- **`User-Agent` truthfulness as an integrity control.** R1's prohibition on browser impersonation is an integrity requirement. A producer that allocates rate-limit headroom to ACT agents (because they are advisory) could be exploited by a non-ACT crawler spoofing `ACT-Agent` to consume the budget. Producers SHOULD treat the `User-Agent` as advisory, not authenticatable; PRD-109's broader integrity posture applies. The fact that the `User-Agent` is unauthenticated is not a defect in PRD-800; it is a property of HTTP. Agents that actually identify truthfully gain producer trust over time (operator reputation), which is the intended dynamic.
- **Rate-limit defaults serve a DoS-mitigation purpose.** R6's 60/min default exists so that a producer that omits the field is not pummeled by an agent that interprets "no advertised limit" as "no limit." The default is intentionally conservative.
- **robots.txt as a privacy boundary.** R4's hard MUST keeps ACT from being a backdoor around robots.txt. An operator who wishes to expose content to ACT agents but not to general crawlers can write user-agent-specific rules; an operator who wishes to keep paths private can disallow them, knowing ACT will honor the rule.
- **Contact field and harvesting.** R2's contact field (an email or URL) is publicly visible. Operators SHOULD use a role address (`abuse@`, `bots@`) rather than an individual's email, to reduce harvesting surface.
- **5xx backoff vs. amplification.** R14's exponential-backoff schedule prevents agent retry storms during producer outages from amplifying the outage.
- **Authentication boundary.** R15 forbids retry on 401 without credential change. This prevents agents from inadvertently triggering account-lockout policies on the producer side.
- **Cache poisoning across origins.** R12's RFC 9111 honoring covers `private` (do not store in shared caches). Agents that operate as shared caches MUST honor `private` rigorously to avoid serving one user's authenticated content to another. Cite PRD-109 for the per-tenant scoping posture.

PRD-800 inherits the project-wide threat model from PRD-109 and introduces no new threat surface beyond the items above.

---

## Implementation notes

_Not applicable — non-implementation PRD._

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-02 | Jeremy Forsythe | Initial draft. Pins ACT-aware agent / crawler behavior on the open web: canonical `User-Agent` token (`ACT-Agent/{version}` + contact field), robots.txt as authoritative gate (ACT does not override), `policy.rate_limit_per_minute` honoring with 60/min default, conditional `If-None-Match` revalidation per PRD-103, exponential backoff on 429/5xx with `Retry-After` honored, no retry on 401 (without credential change) or 403. Cites PRD-101 for discovery, PRD-103 for caching, PRD-106 for runtime status codes, PRD-109 for security. Status: Draft → In review. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
