# PRD-101 — Discovery (well-known location, llms.txt linkage, runtime hand-off)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

Across the v0.1 working draft (`docs/plan/v0.1-draft.md`), discovery is sketched only for the static profile: "fetch `/.well-known/act.json`, read manifest, follow `index_url`" (§5.1, §5.2). Two large classes of deployment are left undefined.

First, a **runtime-only deployment** — a B2B SaaS workspace that serves no public HTML and has no anonymous well-known file — has no defined hand-off. Gap A5 in `prd/000-gaps-and-resolutions.md` flags this as Tier-A foundational: agents that don't render HTML have no way to learn that ACT is even available. The draft itself parks this as Q17 (open question §10).

Second, a **hybrid deployment** that combines a static marketing site with a runtime app under one product (the canonical "acme.com + app.acme.com" topology from draft §5.13.5) has only an example of the `mounts` array in the manifest; the resolution algorithm a consumer follows — prefix matching, longest-prefix wins, cross-origin trust — is not pinned. Gap C5 owns the resolution rules, but the discovery entry point that walks them is owned here.

Both gaps block PRD-100 (manifest envelope must define `delivery` and `mounts` field shapes), PRD-106 (runtime profile cannot specify what to serve at the discovery boundary without a discovery rule), PRD-600 (validator cannot probe for ACT without a known discovery flow), and PRD-109 (threat model needs to know what an attacker sees at discovery time).

### Goals

1. Lock the static-profile discovery contract: the well-known path is `/.well-known/act.json`, exact, normative, never relocated.
2. Define the optional `/llms.txt` and HTML link signals that make ACT discoverable to tooling that scans for it.
3. Resolve gap A5: define the runtime-only hand-off (HTML `<link rel="act">` plus HTTP `Link:` header) so a non-HTML, authenticated client can learn the manifest URL.
4. Define the consumer discovery algorithm: the ordered set of probes a client uses to locate an ACT manifest from any starting URL.
5. Pin the closed-enum `profile` MIME parameter so the wire-level signal between static and runtime is machine-comparable rather than implementation-defined.
6. Specify how discovery interacts with the hybrid `mounts` array (gap C5), in particular cross-origin mounts and the longest-prefix match.
7. Specify the consumer-side validation rule that ties discovery context to the manifest's declared `delivery` field, so that producers cannot quietly serve a runtime-shaped manifest from a static path or vice versa.

### Non-goals

1. Defining the manifest envelope or its field shapes. That is **PRD-100** (sibling, in-flight). PRD-101 references manifest fields by name only — `delivery`, `mounts`, `conformance.level` — and treats the envelope as authoritative source of those shapes.
2. Registering MIME types with IANA or finalizing the file-extension policy. That is **PRD-803** (downstream). The MIME types referenced here (`application/act-manifest+json`) and the `rel="act"` link relation are **provisional** until PRD-803 ratifies them; PRD-101 cites them by name and assumes their eventual registration.
3. Defining the runtime profile's request/response shapes (auth schemes, status codes, error envelopes). That is **PRD-106**. PRD-101 specifies only what tells a consumer "an ACT manifest is at this URL"; once the manifest is fetched, PRD-100 and PRD-106 take over.
4. Defining conformance levels themselves. **PRD-107** (Accepted) owns Core/Standard/Plus. PRD-101 declares the level of each requirement using PRD-107's vocabulary.
5. Defining the threat model. **PRD-109** (sibling) owns project-wide security posture; this PRD's §Security considerations notes deltas only and forwards to PRD-109.
6. Defining how `mounts` resolution semantics work in detail (what counts as a prefix collision, what happens on a mount manifest fetch failure). Gap C5 owns those rules; PRD-101 cites them and specifies only the consumer's entry point into the algorithm.
7. Defining MCP discovery. ACT and MCP are complementary (draft §5.14); MCP discovery is out of scope.

### Stakeholders / audience

- **Authors of:** ACT consumers (agent runtimes, crawlers, validators), ACT producers (static-site generators, runtime SDKs), and tooling that scans the open web for ACT support (search engines, agent platforms, the `/llms.txt` ecosystem).
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Producers relocate the well-known path (e.g., to `/act/manifest.json`) for "tidiness" or to avoid the `/.well-known/` directory on cheap hosts | Medium | High — fragments the consumer matrix; every consumer has to implement multiple discovery probes | PRD-101-R1 makes the path normative; PRD-600 (validator) flags any producer reachable at a non-conformant path. Decision Q2 already locked the path. |
| Runtime-only producers omit the Link header from some responses (e.g., on error responses, redirects, OPTIONS preflights) | High | Medium — a consumer that hits the omitted response cannot learn the manifest URL | PRD-101-R5 makes header presence a HARD MUST on every authenticated response, including error responses. Worked examples cover 4xx and 5xx cases. |
| Cross-origin mounts allow a misconfigured or malicious parent manifest to redirect discovery to an attacker-controlled origin | Low | High | PRD-101-R10 requires consumer-side origin trust evaluation, forwarded to PRD-109. Validators warn on cross-origin mounts to a different registrable domain. |
| Information disclosure: the well-known path itself signals "this site supports ACT," which a privacy-sensitive operator might not want | Medium | Low–Medium | Section §Security considerations addresses; PRD-101 does not require ACT support, so an operator that does not want to disclose can simply not publish a manifest. |
| The MIME `profile` parameter enum is misread as "open" and producers ship `profile="hybrid"` or `profile="mcp"` | Medium | Medium | PRD-101-R7 declares the enum CLOSED in line with decision Q2 and gap B5; adding a value is MAJOR per PRD-108. Negative fixture covers the case. |
| `/llms.txt` ecosystem changes its conventions (it is informally specified) and the recommended markdown link format drifts | Low | Low | PRD-101-R3 is SHOULD, not MUST; the markdown link format is the recommended shape but consumers MUST NOT rely on it as the sole signal. |

### Open questions

1. Should `<link rel="act">` in a public homepage HTML — i.e., on a static deployment — be SHOULD, MAY, or unspecified? Currently SHOULD for runtime-only (gap A5) but only MAY for static (the well-known path is the primary signal). Revisit if HTML scanners struggle with the `/.well-known/` probe.
2. For deployments behind a CDN that strips response headers, the runtime-only Link header may not survive in transit. Should PRD-101 say anything about CDN configuration? Tentatively no — that is operator hygiene, not a wire-format concern. Validators MAY flag the apparent absence with a remediation hint pointing at CDN configuration.
3. Is there a need for a `Last-Modified` or `If-Modified-Since` discipline on `/.well-known/act.json` itself? Tentatively no — the manifest carries its own ETag per PRD-103, and discovery is by URL, not by content version. Re-evaluate after PRD-103 is Accepted.

### Acceptance criteria

- [x] Static-profile well-known path is locked to `/.well-known/act.json` (PRD-101-R1).
- [x] `/llms.txt` markdown-link recommendation is captured as SHOULD with the canonical link text (PRD-101-R3).
- [x] HTML `<link rel="act">` is captured as SHOULD for runtime-only deployments (PRD-101-R4).
- [x] HTTP `Link:` header is captured as MUST for every authenticated response on runtime-only deployments (PRD-101-R5).
- [x] MIME `profile` parameter is a closed enum `static | runtime` (PRD-101-R7).
- [x] Consumer discovery flow is fully specified as an ordered algorithm (PRD-101-R8).
- [x] `mounts` resolution entry point is specified, with longest-prefix-match cited from gap C5 (PRD-101-R10, PRD-101-R11).
- [x] Cross-origin mount origin-trust requirement forwarded to PRD-109 (PRD-101-R10 note).
- [x] Discovery-context-vs-`delivery`-declaration consistency rule is specified (PRD-101-R12).
- [x] Conformance level declared per requirement.
- [x] Positive fixtures: static-well-known, runtime-link-header, hybrid-mounts-flow, llms-txt-reference.
- [x] Negative fixtures: runtime-no-link-header, mismatched-delivery, relocated-well-known, invalid-profile-parameter.
- [x] Security section: information disclosure via the well-known path; cross-origin mount trust; forward to PRD-109.
- [x] Versioning & compatibility table classifies discovery-related changes per PRD-108.
- [x] Changelog initial entry dated 2026-05-01.

---

## Context & dependencies

### Depends on

- **PRD-107** (Accepted): conformance-level vocabulary (Core / Standard / Plus). Discovery is **Core** because every conformant producer at every level participates in discovery.
- **PRD-108** (Accepted): MAJOR/MINOR classification. The closed `profile` enum and the well-known-path normative lock both feed §Versioning & compatibility.
- **000-governance** (Accepted): change-control rules. Tightening any SHOULD here to a MUST is MAJOR per `000-governance` R16 and PRD-108.
- **Decision Q2** (`000-decisions-needed.md`, decided 2026-04-30): locks the well-known path `/.well-known/act.json` and the `application/act-*+json` MIME family. PRD-101 imports this decision verbatim.
- **Gap A5** (`prd/000-gaps-and-resolutions.md`): runtime-only discovery hand-off. PRD-101 ratifies the proposed resolution.
- **Gap B5** (`prd/000-gaps-and-resolutions.md`): MIME types and the `profile` parameter. PRD-101 cites the closed enum; PRD-803 will ratify the type registrations.
- **Gap C5** (`prd/000-gaps-and-resolutions.md`): hybrid mounts resolution semantics. PRD-101 imports the entry point; PRD-106 owns the field-level rules.
- External: [RFC 8615](https://www.rfc-editor.org/rfc/rfc8615) (Well-Known URIs); [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288) (Web Linking — Link header and link relations); [RFC 6906](https://www.rfc-editor.org/rfc/rfc6906) (the `profile` MIME parameter); [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) (normative keywords); the informal [llms.txt convention](https://llmstxt.org/).

### Blocks

- **PRD-100** (manifest envelope) — blocked on PRD-101 confirming which manifest fields participate in discovery (`delivery`, `mounts`).
- **PRD-106** (runtime profile) — blocked on PRD-101 specifying the runtime hand-off; PRD-106 owns the request/response shape after discovery.
- **PRD-600** (validator) — must implement the discovery algorithm specified in PRD-101-R8.
- **PRD-803** (naming, IANA registration) — registers the `rel="act"` link relation and the `application/act-*+json` MIME types referenced here.

### References

- v0.1 draft: §5.1 (overview of static deployment), §5.2 (static discovery, `/llms.txt` linkage), §5.13 intro (runtime profiles), §5.13.5 (hybrid mounts), §5.14 (when to use static / runtime / MCP).
- `prd/000-gaps-and-resolutions.md`: A5 (runtime-only discovery hand-off), B5 (MIME types and the `profile` parameter), C5 (hybrid mounts resolution semantics).
- `prd/000-decisions-needed.md`: Q2 (paths and naming locked, 2026-04-30).
- Prior art: [llms.txt](https://llmstxt.org/) (markdown-link convention adopted as SHOULD); [robots.txt](https://www.rfc-editor.org/rfc/rfc9309) (well-known location precedent at the conceptual level, not at the path level); [OpenID Connect Discovery](https://openid.net/specs/openid-connect-discovery-1_0.html) (well-known JSON document precedent — `/.well-known/openid-configuration`); [RFC 5785 / RFC 8615](https://www.rfc-editor.org/rfc/rfc8615) (well-known URI registry).

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) where requirements are imposed. Lowercase "must" and "should" are non-normative prose.

### Conformance level

Discovery is the entry point to ACT and is therefore **Core** in the sense of PRD-107. Every conformant producer at every level (Core, Standard, Plus) and every conformant consumer participates in discovery.

- **Core:** PRD-101-R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R12, R13. (Static well-known location, `/llms.txt` SHOULD, runtime hand-off, the consumer discovery algorithm, mounts entry point, delivery-context consistency.)
- **Standard:** No additional requirements specific to Standard. (Inherits all Core.)
- **Plus:** No additional requirements specific to Plus. (Inherits all Core.)
- **Runtime profile** (orthogonal to level, per PRD-107-R4): PRD-101-R5 (HTTP Link header on every authenticated response) is a HARD MUST per gap A5 and applies to every runtime-only producer regardless of conformance level.

### Normative requirements

#### Static-profile discovery: the well-known path

**PRD-101-R1.** A static-profile ACT producer MUST publish its profile manifest at the absolute path `/.well-known/act.json`, scoped to the producer's origin. The path is normative; producers MUST NOT relocate the manifest to any other path (including but not limited to `/.well-known/act/manifest.json`, `/act/manifest.json`, `/act.json`, or `/.well-known/agent-content-tree.json`). This path is locked by decision Q2 (2026-04-30).

**PRD-101-R2.** The response to a `GET` request for `/.well-known/act.json` from an unauthenticated client SHOULD carry a `Content-Type` of `application/act-manifest+json` (provisional MIME type, owned by PRD-803). The `profile` MIME parameter (RFC 6906) SHOULD be set to `"static"` on a static-profile manifest.

**PRD-101-R3.** A static-profile producer SHOULD reference its ACT manifest from `/llms.txt`, when `/llms.txt` exists, using the markdown link form `[ACT Manifest](/.well-known/act.json)`. The link target MUST be the absolute well-known path locked by PRD-101-R1; producers MUST NOT advertise any relocated path. This requirement is non-normative for tooling that does not consume `/llms.txt`; it is a SHOULD specifically because `/llms.txt` is itself an informal convention.

**PRD-101-R4.** A static-profile producer MAY include in its homepage HTML (or any other public HTML page) a `<link rel="act" href="/.well-known/act.json" type="application/act-manifest+json; profile=\"static\"">` element. This is a MAY, not a SHOULD: the well-known path is the primary signal, and the HTML link is purely an optional aid to HTML-scanning tooling.

#### Runtime-only discovery: HTML link and HTTP Link header

**PRD-101-R5.** A runtime-only ACT producer (a deployment that declares `delivery: "runtime"` in its manifest and does NOT publish a public unauthenticated `/.well-known/act.json`) MUST include the HTTP `Link` header on every authenticated response, of the form:

```
Link: </.well-known/act.json>; rel="act"; type="application/act-manifest+json"; profile="runtime"
```

"Every authenticated response" includes successful responses (2xx), redirections (3xx), client errors (4xx, including 401 and 404), and server errors (5xx) — the header MUST be present even when the response itself is an error. The header MAY also be present on unauthenticated responses (e.g., the 401 challenge), but its absence on unauthenticated responses is not a violation. The `Link` value MAY be relative (as shown above) or an absolute URL; if relative, it is resolved against the request URL per RFC 8288.

This requirement is a HARD MUST per gap A5: the HTTP header is the only universal signal for non-HTML clients, and runtime-only deployments serving any agent traffic without it are non-conformant.

**PRD-101-R6.** A runtime-only ACT producer that serves authenticated HTML responses (e.g., the workspace dashboard) SHOULD include in the HTML `<head>` element:

```html
<link rel="act" href="/.well-known/act.json" type="application/act-manifest+json; profile=\"runtime\"">
```

This is SHOULD rather than MUST because (a) PRD-101-R5 already covers every response via the HTTP header, and (b) some runtime-only deployments serve no HTML at all (pure JSON APIs). Producers that serve HTML SHOULD set both signals; producers that do not serve HTML satisfy this requirement vacuously.

**PRD-101-R7.** The MIME `profile` parameter on the `application/act-manifest+json` media type, and on the `type` attribute of the `<link rel="act">` element, and on the `type` parameter of the `Link:` HTTP header, is a CLOSED enumeration with exactly two valid values:

- `"static"` — the manifest describes a static-profile deployment.
- `"runtime"` — the manifest describes a runtime-profile deployment.

A producer MUST NOT emit any other value. A consumer MUST treat any other value as malformed (PRD-101-R13). Adding a value to this enum is a MAJOR change per PRD-108-R5(4) (closed-enum addition is MAJOR). Hybrid deployments are NOT a third value: a hybrid is a parent manifest (with `mounts`) that itself declares `delivery: "static"` or `delivery: "runtime"`; each individual mount likewise declares one of the two values per PRD-107-R5.

#### The consumer discovery algorithm

**PRD-101-R8.** A consumer attempting to discover whether a given URL or origin supports ACT MUST follow this ordered algorithm. Each step is attempted in order; the first step that yields a manifest URL is followed, and the algorithm stops. A consumer MAY skip steps that are inapplicable to its input (e.g., a consumer given only an origin with no fetched response skips Step 1).

1. **Inspect any in-hand response.** If the consumer was invoked with an HTTP response already in hand (e.g., the consumer is a browser extension reading the response of the page the user is on), the consumer MUST inspect the response's `Link` header for a link with `rel="act"`. If found, the link's target URI is the manifest URL; the consumer MAY also note the `profile` parameter as a hint for what `delivery` the manifest will declare.
2. **Fetch the well-known path.** If Step 1 did not yield a manifest URL, the consumer MUST issue an unauthenticated `GET` to `/.well-known/act.json` at the input origin. If the response is `200 OK` and the body parses as JSON, the manifest URL is the request URL. If the response is `404` (or any 4xx other than 401), proceed to Step 3. If the response is `401`, the consumer MAY retry with credentials per the host application's auth scheme (PRD-106 owns the request shape); on a successful authenticated retry, the manifest URL is the request URL and the consumer SHOULD note that the manifest is auth-gated.
3. **Scan `/llms.txt` and the homepage HTML.** If Step 2 yielded `404` or no JSON body, the consumer MAY (not MUST) issue an unauthenticated `GET` to `/llms.txt` at the input origin and scan its body for a markdown link of the form `[ACT Manifest](...)`. If found, the link's target is the manifest URL. If not found, the consumer MAY also `GET` the input origin's root and scan the returned HTML for a `<link rel="act">` element. If neither yields a result, the consumer concludes that the origin does not support ACT (or supports it via a runtime-only hand-off the consumer has not yet observed).
4. **Resolve the manifest.** Once a manifest URL is located, the consumer fetches it and parses the envelope (per PRD-100). If the envelope contains a `mounts` array, the consumer applies the mount-resolution algorithm in PRD-101-R10 against the consumer's target resource URL, if any.
5. **Validate delivery context.** The consumer MUST apply the discovery-context consistency rule in PRD-101-R12 against the resolved manifest's `delivery` field.

The consumer MUST NOT fall back beyond Step 3. In particular, the consumer MUST NOT probe arbitrary fallback paths (`/manifest.json`, `/act.json`, etc.) — relocating the well-known path is forbidden by PRD-101-R1, and probing those paths would silently reward producers that violate it.

**PRD-101-R9.** The consumer SHOULD cap the discovery probe at a reasonable wall-clock budget (PRD-600 will specify a default; this PRD does not). On timeout, the consumer treats the origin as not supporting ACT for the current request, but MAY retry on a subsequent request.

#### Hybrid `mounts` discovery entry point

**PRD-101-R10.** When a manifest contains a `mounts` array (per PRD-107-R5; field shape owned by PRD-100 / PRD-106 per gap C5), and the consumer has a target resource URL it is trying to consume content for, the consumer MUST apply longest-prefix match against the `mounts[].prefix` values to select the relevant mount. The selected mount's `manifest_url` is fetched as the next manifest. If no mount prefix matches the target resource URL, the parent manifest itself is used. Per gap C5, mounts MUST NOT recurse — a mount manifest that itself contains a `mounts` array is a manifest validation error owned by PRD-100, but PRD-101 reiterates the rule for the consumer's clarity.

**PRD-101-R11.** When a `mounts[].manifest_url` references a different origin than the parent manifest (cross-origin mount), the consumer MUST evaluate origin trust before treating the mount manifest as authoritative for the parent's content. The consumer MUST follow the origin-trust rules in PRD-109 (sibling, in-flight; threat model) and SHOULD warn its caller when a cross-origin mount is followed. Producers that publish cross-origin mounts SHOULD ensure that the mount target's origin is under the same operational control as the parent (e.g., `acme.com` mounting `app.acme.com`); cross-organization mounts are technically allowed but operationally fragile.

#### Discovery-context-vs-`delivery` consistency

**PRD-101-R12.** The `delivery` field declared in a resolved manifest MUST be consistent with the discovery context that located it. Specifically:

- A manifest reached via Step 1 of PRD-101-R8 (the in-hand response's `Link` header) MAY declare either `delivery: "static"` or `delivery: "runtime"`; the consumer SHOULD prefer the `Link` header's `profile` parameter as the expected value and warn on mismatch.
- A manifest reached via Step 2 of PRD-101-R8 (an unauthenticated `GET` to `/.well-known/act.json` returning `200`) MUST declare `delivery: "static"`. A manifest in this discovery context that declares `delivery: "runtime"` is a discovery-mismatch error: the producer is signaling runtime semantics but is reachable as a static file with no hand-off. The consumer MUST NOT use this manifest; PRD-600 (validator) MUST emit a finding.
- A manifest reached via Step 2 with an authenticated retry (a runtime well-known endpoint that returned `401` to the unauthenticated probe) MAY declare `delivery: "runtime"`. This is the canonical runtime-only path; the manifest is at the same well-known location but is auth-gated.
- A mount manifest reached via PRD-101-R10 inherits the discovery context of its mount entry: a mount declaring `delivery: "runtime"` is reached via runtime context, regardless of how the parent was discovered.

**PRD-101-R13.** A consumer MUST treat any of the following as a discovery error and MUST NOT proceed to consume content:

- Manifest fetch returns a status outside `{200, 401}` and the consumer cannot complete an authenticated retry.
- Manifest body is not valid JSON.
- Manifest's `delivery` field is absent or outside the closed enum (per PRD-107-R3).
- Manifest's `delivery` field violates PRD-101-R12 against the discovery context.
- `<link rel="act">` element or HTTP `Link` header carries a `profile` parameter outside the closed enum of PRD-101-R7.

The consumer MUST surface the discovery error to its caller; it MUST NOT attempt to "fall through" to a different discovery path that contradicts the producer's declared signals.

### Wire format / interface definition

PRD-101's discovery contract is HTTP-level rather than JSON-schema-level: the contract is a path (`/.well-known/act.json`), a link relation (`rel="act"`), an HTTP header (`Link:`), an HTML element (`<link>`), and a closed-enum MIME parameter (`profile`). None of these has a JSON envelope shape that PRD-101 owns; the manifest envelope itself is owned by PRD-100.

For the parts of the contract that do have a constrainable shape, the schema fragments live under `/Users/jforsythe/dev/ai/act/schemas/101/`:

- [`schemas/101/profile-parameter.schema.json`](../schemas/101/profile-parameter.schema.json) — the closed enum for the MIME `profile` parameter (PRD-101-R7).
- [`schemas/101/link-header.schema.json`](../schemas/101/link-header.schema.json) — a permissive value pattern for the runtime-profile HTTP `Link` header (PRD-101-R5). The pattern verifies that `rel="act"`, `type="application/act-manifest+json"`, and `profile="static"|"runtime"` are all present in any order; it is intentionally permissive about whitespace and parameter ordering to accommodate RFC 8288's syntax flexibility, while being strict about the closed `profile` enum.

For the manifest fields PRD-101 references — `delivery`, `mounts`, `conformance.level` — see PRD-100 (sibling, in-flight; manifest envelope) and PRD-107-R5 (mount-level conformance and delivery overrides; Accepted).

#### Canonical signal shapes

**Static well-known path (PRD-101-R1).**

```
GET /.well-known/act.json HTTP/1.1
Host: acme.example

HTTP/1.1 200 OK
Content-Type: application/act-manifest+json; profile="static"

{ "act_version": "0.1", "delivery": "static", ... }
```

**`/llms.txt` markdown link (PRD-101-R3).**

```markdown
# Acme Docs

This site provides an ACT (Agent Content Tree) feed:

- [ACT Manifest](/.well-known/act.json)
```

**HTML link element on a static homepage (PRD-101-R4, MAY).**

```html
<link rel="act" href="/.well-known/act.json"
      type="application/act-manifest+json; profile=&quot;static&quot;">
```

**HTML link element on a runtime-authenticated page (PRD-101-R6, SHOULD).**

```html
<link rel="act" href="/.well-known/act.json"
      type="application/act-manifest+json; profile=&quot;runtime&quot;">
```

**HTTP Link header on a runtime-authenticated response (PRD-101-R5, MUST).**

```
Link: </.well-known/act.json>; rel="act"; type="application/act-manifest+json"; profile="runtime"
```

### Errors

| Condition | Response | Notes |
|---|---|---|
| Static producer relocates the manifest off `/.well-known/act.json` | Manifest validation error (PRD-600 finding); discovery fails for clients that follow PRD-101-R8 | Per PRD-101-R1. The producer is silently invisible to conforming consumers. |
| Runtime-only producer omits the `Link` header on an authenticated response | PRD-600 finding citing PRD-101-R5 | Per gap A5; this is a HARD MUST. Validator probes a sample of authenticated endpoints. |
| `<link rel="act">` or `Link:` header carries `profile` outside the closed enum | Discovery error per PRD-101-R13; consumer MUST NOT proceed | Per PRD-101-R7. Validator emits a finding citing PRD-101-R7. |
| Manifest declares `delivery: "runtime"` but is reached via unauthenticated static well-known path | Discovery-mismatch error per PRD-101-R12 | Validator finding; consumer refuses to consume content. |
| Manifest declares `delivery: "static"` but is reached only via `Link` header with `profile="runtime"` | Discovery-mismatch warning per PRD-101-R12 | The header's profile hint mismatches the manifest's declaration; consumer SHOULD warn but MAY proceed using the manifest's declared value. |
| Cross-origin mount references an origin the consumer does not trust | Consumer refuses to follow the mount per PRD-101-R11; reports to caller | Forwarded to PRD-109 for the trust evaluation rules. |
| Manifest fetch times out within the consumer's discovery budget | Consumer treats the origin as not supporting ACT for the current request | Per PRD-101-R9. May retry on subsequent requests. |

PRD-101 does not introduce HTTP status codes of its own. Status-code semantics on the runtime profile (e.g., `404` vs `403` to avoid existence disclosure) are owned by PRD-106 and PRD-109.

---

## Examples

Examples are non-normative but must be consistent with the Specification section. PRD-600 will validate them.

### Example 1 — Static-only public docs (PRD-101-R1, R2, R3)

Acme Docs is a Hugo-built marketing/docs site. The producer publishes:

- `/.well-known/act.json` — a static JSON file served by the CDN.
- `/llms.txt` — a markdown file with a link to the manifest.

```
GET https://acme.example/.well-known/act.json

HTTP/1.1 200 OK
Content-Type: application/act-manifest+json; profile="static"
Cache-Control: public, max-age=300

{
  "act_version": "0.1",
  "site": { "name": "Acme Docs" },
  "index_url": "/act/index.json",
  "node_url_template": "/act/n/{id}.json",
  "conformance": { "level": "core" },
  "delivery": "static",
  "capabilities": { "etag": true }
}
```

```
GET https://acme.example/llms.txt

HTTP/1.1 200 OK
Content-Type: text/markdown; charset=utf-8

# Acme Docs

> Documentation for Acme widgets.

This site provides an ACT (Agent Content Tree) feed:

- [ACT Manifest](/.well-known/act.json)
```

A consumer following PRD-101-R8 hits Step 2, gets `200`, parses the manifest, applies PRD-101-R12 (manifest declares `delivery: "static"`, reached via unauthenticated well-known path → consistent), and proceeds to consume content.

### Example 2 — Runtime-only B2B SaaS (PRD-101-R5, R6)

Acme Workspace is a runtime-only B2B SaaS at `https://app.acme.example`. The application serves no public HTML and no anonymous well-known file. Every authenticated response carries the runtime hand-off.

```
GET https://app.acme.example/api/workspaces/42
Authorization: Bearer ey…

HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: private, no-store
Vary: Authorization
ETag: "s256:9f2c1bAbCdEfGhIjKlMnOp"
Link: </.well-known/act.json>; rel="act"; type="application/act-manifest+json"; profile="runtime"

{ "workspace_id": "ws_42", "name": "Acme Engineering" }
```

A consumer (e.g., a browser-based agent that already has the user's session) reads the `Link` header (Step 1 of PRD-101-R8), follows it to `/.well-known/act.json`, and authenticates against that endpoint:

```
GET https://app.acme.example/.well-known/act.json
Authorization: Bearer ey…

HTTP/1.1 200 OK
Content-Type: application/act-manifest+json; profile="runtime"
Cache-Control: private, no-store
Vary: Authorization
Link: </.well-known/act.json>; rel="act"; type="application/act-manifest+json"; profile="runtime"

{
  "act_version": "0.1",
  "site": { "name": "Acme Workspace" },
  "index_url": "/act/index.json",
  "node_url_template": "/act/n/{id}.json",
  "conformance": { "level": "standard" },
  "delivery": "runtime",
  "capabilities": { "etag": true, "subtree": true }
}
```

PRD-101-R12 holds: discovery context is "Link header with `profile=\"runtime\"`, followed to a `/.well-known/act.json` that required auth," and the manifest's `delivery: "runtime"` matches.

An unauthenticated probe to the same well-known URL returns `401` (or `404`), not the manifest:

```
GET https://app.acme.example/.well-known/act.json

HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="acme-workspace"
Link: </.well-known/act.json>; rel="act"; type="application/act-manifest+json"; profile="runtime"
```

The Link header is still present on the 401 (PRD-101-R5 covers all authenticated responses, and the 401 challenge is part of the auth flow).

### Example 3 — Hybrid: static marketing + runtime app (PRD-101-R10, R11)

Acme runs a static marketing/docs site at the apex `acme.example` and an authenticated runtime app at `app.acme.example`. The parent manifest at the apex declares both via `mounts`.

```
GET https://acme.example/.well-known/act.json

HTTP/1.1 200 OK
Content-Type: application/act-manifest+json; profile="static"

{
  "act_version": "0.1",
  "site": { "name": "Acme" },
  "conformance": { "level": "standard" },
  "delivery": "static",
  "index_url": "/act/index.json",
  "node_url_template": "/act/n/{id}.json",
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
      "manifest_url": "https://app.acme.example/.well-known/act.json",
      "conformance": { "level": "standard" }
    }
  ]
}
```

A consumer trying to consume `https://acme.example/app/workspaces/42`:

1. Per PRD-101-R8 Step 2: fetches `/.well-known/act.json` at the apex; gets the parent manifest above.
2. Per PRD-101-R10: applies longest-prefix match. Target URL path `/app/workspaces/42` matches the `/app` mount prefix.
3. Per PRD-101-R11: the mount is cross-origin (`app.acme.example` vs `acme.example`). The consumer evaluates origin trust per PRD-109; the registrable domain matches (`acme.example`), so the consumer MAY proceed and emits a warning about the cross-origin follow.
4. Fetches the mount manifest at `https://app.acme.example/.well-known/act.json` (with credentials, since the mount declares `delivery: "runtime"`).
5. Per PRD-101-R12: discovery context inherits the mount's `delivery: "runtime"`; the resolved manifest declares the same; consistent.

A consumer trying to consume `https://acme.example/blog/post-12` matches no mount prefix (`/blog` is not in `mounts`). Per PRD-101-R10, the parent manifest itself is used — the consumer reads `index_url` from the parent and proceeds.

### Example 4 — Discovery against an unknown URL

A crawler is given the URL `https://example.org/some/article` with no other context. It runs PRD-101-R8:

1. Step 1: no in-hand response to inspect (the crawler has not yet fetched `/some/article`).
2. Step 2: `GET /.well-known/act.json` at `example.org`. Suppose it returns `200`. Parse the manifest. Suppose the manifest has no `mounts`. Apply PRD-101-R12; suppose `delivery: "static"` matches.
3. The crawler now consumes content via the manifest's `index_url` and `node_url_template`.

If Step 2 had returned `404`, the crawler would proceed to Step 3, scan `/llms.txt` for an ACT link, then optionally scan the homepage HTML. If none yielded a manifest, the crawler concludes `example.org` does not support static ACT. (It might still support runtime ACT, but the crawler needs an authenticated request response to discover that.)

### Example 5 — A producer attempting to relocate (negative)

A producer publishes its manifest at `/act/manifest.json` instead of `/.well-known/act.json`. A conforming consumer following PRD-101-R8 issues `GET /.well-known/act.json`, gets `404`, falls through to Step 3, scans `/llms.txt`, finds nothing useful, and concludes the origin does not support ACT. The relocated manifest is silently invisible.

PRD-600 (validator), when run against this producer, MUST emit a finding citing PRD-101-R1 — even if it can find the relocated file via a separate path probe — because the producer's relocation is itself the violation, regardless of whether the file is reachable.

### Example 6 — Discovery-mismatch (negative)

A producer publishes a manifest at `/.well-known/act.json` that declares `delivery: "runtime"`, but the file is reachable unauthenticated and there is no Link-header runtime hand-off elsewhere. A consumer following PRD-101-R8 reaches the manifest via Step 2 (unauthenticated `200`), applies PRD-101-R12, and detects the mismatch (Step 2 → expected `delivery: "static"`, observed `delivery: "runtime"`). The consumer MUST NOT consume content from this manifest. PRD-600 emits a finding citing PRD-101-R12.

---

## Test fixtures

Fixtures live under `/Users/jforsythe/dev/ai/act/fixtures/101/` and are exercised by PRD-600 (validator) and the consumer/producer test suites of every PRD that depends on PRD-101.

### Positive

- `fixtures/101/positive/static-well-known.json` → a manifest correctly discoverable at `/.well-known/act.json` with `delivery: "static"`, served via unauthenticated `GET`. Satisfies PRD-101-R1, R2, R12.
- `fixtures/101/positive/runtime-link-header.txt` → an HTTP/1.1 response transcript demonstrating a runtime-only authenticated response with the `Link` header set. Satisfies PRD-101-R5, R7.
- `fixtures/101/positive/hybrid-mounts-flow.json` → a parent manifest with a `mounts` array, plus a resolution trace showing the longest-prefix match that selects a runtime mount at a cross-origin manifest URL. Satisfies PRD-101-R10, R11, R12.
- `fixtures/101/positive/llms-txt-reference.md` → a `/llms.txt` body that references the ACT manifest using the recommended markdown link. Satisfies PRD-101-R3.

### Negative

- `fixtures/101/negative/runtime-no-link-header.txt` → a runtime-only authenticated response missing the `Link` header. MUST be flagged per PRD-101-R5.
- `fixtures/101/negative/mismatched-delivery.json` → a manifest at `/.well-known/act.json` declaring `delivery: "runtime"` but reachable unauthenticated with no runtime hand-off. MUST be flagged per PRD-101-R12.
- `fixtures/101/negative/relocated-well-known.json` → a producer publishing the manifest at `/act/manifest.json` instead of `/.well-known/act.json`. MUST be flagged per PRD-101-R1.
- `fixtures/101/negative/invalid-profile-parameter.txt` → a `Link` header with `profile="hybrid"` (outside the closed enum). MUST be flagged per PRD-101-R7.

---

## Versioning & compatibility

Per PRD-108, classify each kind of change to PRD-101 as MAJOR or MINOR.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add an additional optional discovery probe to PRD-101-R8 (e.g., a new `<meta name="act-manifest">` HTML signal that consumers MAY check) | MINOR | Adds an optional capability without removing or weakening any existing one. Consumers that ignore the new signal continue to work. |
| Add a new value to the closed `profile` enum (e.g., `"hybrid"` as a third profile) | MAJOR | Per PRD-108-R5(4); adding a value to a closed enum is MAJOR. The runtime/static dichotomy is intentionally exhaustive in v0.1. |
| Tighten PRD-101-R4 (HTML link on static homepage) from MAY to SHOULD | MAJOR | Per PRD-108-R5(3); tightening a permission to a recommendation is MAJOR. |
| Tighten PRD-101-R6 (HTML link on runtime page) from SHOULD to MUST | MAJOR | Per PRD-108-R5(3); tightening SHOULD to MUST is MAJOR. |
| Loosen PRD-101-R5 (HTTP Link header on every authenticated runtime response) from MUST to SHOULD | MAJOR | Per PRD-108-R5(3); loosening MUST to SHOULD is MAJOR. Existing consumers depend on the guarantee. |
| Add a new optional manifest field that participates in discovery (e.g., a per-mount `auth_hint`) | MINOR | Per PRD-108-R4(1); adding an optional field is MINOR. PRD-100 owns the manifest envelope and would land the field; PRD-101 cites it. |
| Relocate the well-known path from `/.well-known/act.json` to anything else | MAJOR | Per PRD-108-R5(6); changing a syntactic constraint on a required signal is MAJOR. Decision Q2 locked the path; relocating requires a superseding PRD per `000-governance` R16. |
| Change the `rel="act"` link relation to a different token | MAJOR | Per PRD-108-R5(2); semantic change to a documented identifier. |
| Remove the `/llms.txt` recommendation entirely (PRD-101-R3) | MAJOR | Per PRD-108-R5(5); removing a documented signal is MAJOR even though it is SHOULD, because tooling depends on it. Deprecation window per PRD-108-R12. |
| Editorial revision (typo, prose clarification) that changes no normative requirement | n/a | Per `000-governance` R18; no `act_version` bump; tracked in this PRD's Changelog only. |

### Forward compatibility

Per PRD-108-R7, consumers MUST tolerate unknown optional fields in the manifest, including any future discovery-related fields PRD-100 adds. A consumer encountering an unknown `Link` header parameter (e.g., a future `version="0.2"` parameter alongside `rel`, `type`, `profile`) MUST ignore the unknown parameter; it MUST NOT refuse to follow the link. A consumer encountering `rel="act"` on a link with a `type` outside the `application/act-*+json` family MAY warn but MUST NOT refuse — future ACT versions might define additional MIME types.

A consumer encountering a `profile` value outside the closed enum MUST treat the link as malformed (PRD-101-R7, PRD-101-R13). The closed-enum rule is the lever that lets us add a value (e.g., a future `"agent-only"` profile) only as a controlled MAJOR bump, not as silent drift.

### Backward compatibility

A producer that upgrades from one MINOR to the next MUST continue to publish the well-known path at `/.well-known/act.json` and (for runtime-only) the `Link` header on every authenticated response. No deprecation window is permitted on these signals within a MAJOR — they are Core (PRD-107) and removing them would silently break every consumer.

A producer that downgrades from runtime-only to static (or vice versa) MUST update its manifest's `delivery` field and the corresponding discovery signals atomically. Specifically: a producer cannot serve a `delivery: "static"` manifest while still emitting `Link: ...; profile="runtime"` headers, or vice versa. PRD-101-R12 catches this on the consumer side; PRD-600 catches it on the validator side.

---

## Security considerations

PRD-109 (sibling, in-flight) owns the project-wide threat model. PRD-101 documents discovery-specific deltas and forwards everything else.

- **Information disclosure via the well-known path.** The mere existence of `/.well-known/act.json` (or of the runtime-only `Link` header) signals that a site supports ACT. For most operators this is the intended signal — discovery is the entire point. For privacy-sensitive operators (e.g., a security researcher who runs a public site but does not want it indexed by AI agents), the operator's recourse is straightforward: do not publish a manifest. PRD-101 does not require that any site support ACT; the spec's posture is opt-in. There is no separate "soft hide" mode in v0.1; an operator who wants to be discoverable to humans but not to ACT-aware agents simply omits the manifest. (A future v0.2 might define an opt-out signal akin to robots.txt, but this is out of scope.)

- **Existence disclosure on runtime-only deployments.** A runtime-only deployment that emits the `Link` header on every authenticated response — including 401 responses — discloses to any unauthenticated probe that "this origin supports ACT and the manifest is at this URL." This is the intended trade-off (per gap A5: the header is the only universal signal for non-HTML clients). Operators who want to avoid this disclosure on the unauthenticated path MAY omit the `Link` header from unauthenticated 401 challenges; PRD-101-R5 covers only authenticated responses, and the unauthenticated 401 is technically pre-authentication. Validators SHOULD NOT flag absence of the header on unauthenticated responses.

- **Cross-origin mount trust (PRD-101-R11).** A parent manifest's `mounts` array can reference a different origin's manifest URL. A misconfigured (or compromised) parent could redirect a consumer's discovery flow to an attacker-controlled origin. The consumer MUST evaluate origin trust per PRD-109 before treating a cross-origin mount manifest as authoritative for the parent's content. Validators SHOULD warn on any cross-origin mount whose `manifest_url` is on a different registrable domain than the parent's origin.

- **Link header injection via user content.** A runtime application that echoes user-supplied data into response headers must take particular care with the `Link` header — an attacker who can inject a second `Link: <attacker-controlled-url>; rel="act"; ...` header could redirect agent discovery. This is the standard header-injection threat (cf. CRLF injection); PRD-101 does not introduce a new vector but operators MUST sanitize header-bound values per PRD-109's general guidance. Validators MAY flag responses with multiple `rel="act"` Link entries from a single producer as suspicious.

- **MIME `profile` parameter as a coarse trust signal.** The `profile` parameter is a hint about what the manifest will declare; the manifest's `delivery` field is the authoritative value (PRD-101-R12). A consumer MUST NOT trust the `profile` parameter alone for any security-relevant decision; it MUST resolve the manifest and check the manifest's own `delivery`.

- **DoS via malformed Link headers or oversized manifests.** PRD-101-R9 caps discovery at a reasonable wall-clock budget; PRD-100 and PRD-600 cap manifest size. PRD-101 does not introduce a new DoS surface beyond the standard "fetch and parse one JSON document" envelope.

PRD-109 governs the project-wide security posture; cite that PRD for any security-sensitive discovery interaction not covered here.

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft per gap A5 (runtime-only discovery hand-off), gap B5 (MIME `profile` parameter as closed enum), gap C5 (hybrid mounts entry point), and decision Q2 (well-known path locked). Specifies the static well-known location, the `/llms.txt` SHOULD, the runtime-only HTML link / HTTP Link header signals, the consumer discovery algorithm, the longest-prefix mounts entry point, and the discovery-context-vs-`delivery` consistency rule. Cross-references PRD-100 (manifest envelope, in-flight), PRD-106 (runtime profile, in-flight), PRD-107 (conformance levels, Accepted), PRD-108 (versioning policy, Accepted), and PRD-109 (security, in-flight). Status: In review. |
| 2026-05-01 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
