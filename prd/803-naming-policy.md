# PRD-803 — Naming policy (mark, package names, MIME types, well-known path, IANA plan)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

Decision **Q2** in `000-decisions-needed.md` (decided 2026-04-30) ratified "ACT" / "Agent Content Tree" as the project's name, `.act.json` as its file extension, `/.well-known/act.json` as its discovery path, and `application/act-*+json` as its MIME family. That decision was recorded but never codified into a normative PRD: nothing in the spec set tells a community implementer what package name to choose when shipping an ACT-conformant adapter, what the canonical MIME type for a manifest payload is, what the spec means by "ACT-conformant" as a claim, or when the well-known path could ever change. In parallel, no formal trademark or registry sweep was performed (Q2's recorded rationale: "lead accepts the collision risk"), and IANA has not been notified of any of the MIME types the wire-format PRDs already cite. PRD-100 emits provisional MIME types; PRD-101 carries them through to the discovery hand-off; PRD-103 inherits the NDJSON profile question; PRD-803 is the consolidation point. Without it, two community packages will independently invent `actjs` and `actkit` brand names and three different stringly-typed MIME values for the same envelope, fragmenting the consumer matrix on day one.

### Goals

1. Codify Q2's recorded decision as the normative naming contract for v0.1: name, extension, well-known path, MIME family.
2. Establish what claims like "ACT-conformant" do and do not imply, given that no trademark filing was made (Q2 rationale).
3. Pin the package-name conventions that first-party reference implementations MUST follow and that community packages SHOULD follow.
4. Enumerate the v0.1 MIME types — `application/act-manifest+json`, `application/act-index+json`, `application/act-node+json`, `application/act-subtree+json`, `application/act-error+json`, plus the `+ndjson` profile for the Plus NDJSON index per PRD-103/PRD-105 — as a closed set for v0.1, with rules for adding more.
5. Lock the well-known path `/.well-known/act.json` and state the conditions under which it could change (effectively never within a MAJOR per PRD-108).
6. Pin the IANA registration plan: who, what, when, in what order, with what stewardship — without filing any registration today (Q2 deferred the actual filing).
7. Keep all of the above forward-compatible with a possible future foundation transition (Q1 left that door open) without writing checks the BDFL has not signed.

### Non-goals

1. Filing IANA registrations now. The plan is normative; the filing is operational and out of scope for v0.1 spec text. PRD-803 records the intent and the criteria; the BDFL or a successor maintainer files when those criteria are met.
2. Trademarking "ACT" or "Agent Content Tree". Q2 explicitly accepted the collision risk and did not require a USPTO/EUIPO sweep. PRD-803 documents what the absence of a trademark means for downstream users — it does not impose one.
3. Defining the wire-format envelopes that the MIME types describe. PRD-100 owns the envelopes; PRD-803 only owns the type strings.
4. Defining the discovery flow. PRD-101 owns it; PRD-803 only locks the well-known path string.
5. Picking the canonical domain (`act-spec.org` vs alternatives). Decision Q10 is the parking lot for the domain question; PRD-803 references Q10 by ID without picking.
6. Defining the logo, wordmark style, or brand-asset license. Decision Q11 is the parking lot. PRD-803 only owns the textual mark.
7. Defining how forks or derivative specs are named. Governance R24 (`000-governance.md`) permits forking; downstream naming for forks is left to the fork maintainer subject to the constraints in PRD-803-R3 and PRD-803-R4.

### Stakeholders / audience

- **Authors of:** every package author who ships an ACT-conformant adapter, generator, SDK, validator, or inspector — first-party (`act-*` reference implementations under the BDFL) and community (anyone else).
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| MIME-type confusion attack — a producer serves an `application/json` body that a permissive consumer treats as `application/act-manifest+json` and parses with elevated trust. | Low | Medium | PRD-803-R7 requires the canonical MIME type on every well-known and runtime response; PRD-101 already requires `Content-Type` matching for discovery. PRD-600 probes for the Content-Type. Cite PRD-109 for the project-wide stance on type-confusion. |
| Trademark collision with an existing "ACT" mark surfaces post-launch and the project is forced to rename. | Medium | High — a rename late in v0.1's life touches every PRD's prose, every package name, every MIME type. | Q2's recorded rationale already accepted this risk. PRD-803-R3 makes any rename a MAJOR change to this PRD per §Versioning, which forces a deprecation window and a superseding PRD. The fork right (000-governance R24) means the existing community can continue under the old mark if a rename is contested. |
| Community packages adopt names that imply BDFL endorsement (e.g., `act-official-react`) without actually being first-party. | Medium | Low–Medium | PRD-803-R5 distinguishes first-party (`act-*` published by the spec organization) from community names; BDFL-endorsed lists live in `000-INDEX.md` or a future `MAINTAINERS.md`, not in package names. |
| Producers split the MIME surface — one package emits `application/act-manifest+json`, another emits `application/json+act` or `application/x-act-manifest`. | Medium | Medium | PRD-803-R6 makes the `application/act-*+json` pattern a closed family for v0.1. Adding a new envelope type is MINOR (PRD-108); inventing an alternative naming pattern is MAJOR. Negative fixture covers the `x-` prefix anti-pattern. |
| Well-known path is "improved" later (e.g., `/.well-known/agent-content-tree.json`) for clarity, breaking every consumer that hard-coded `/act.json`. | Low | Catastrophic | PRD-803-R8 declares the path normative and the change frequency "effectively never within a MAJOR" — changing the path is MAJOR per PRD-108 and would need a deprecation window of at least one MINOR cycle, which means a multi-year warning. |
| IANA registration is filed by a third party (squatting) before the BDFL files. | Low | Medium | PRD-803-R10 names the BDFL (and successors) as the only legitimate registrant; a squatted registration would be challengeable on prior-publication grounds (this PRD is dated and public). |
| Future foundation transition (Q1 open question) requires the IANA stewardship to move from BDFL to organization, and the registration entry must be amended. | Low | Low | PRD-803-R10 anticipates this: the registration entry's `Change controller` field starts as "Jeremy Forsythe / ACT spec maintainers" and may be updated via IANA's standard amendment process when (or if) the foundation transition lands. |

### Open questions

1. Does the NDJSON Plus index (per PRD-103 / PRD-105) get its own MIME type (`application/act-index+ndjson`) or share the JSON one with a `profile` parameter? Tentative: dedicated type, because `application/x-ndjson` is the de-facto convention for line-delimited JSON and ACT inheriting the `+ndjson` structured suffix is forward-compatible. PRD-803-R6(f) ratifies the dedicated type for v0.1.
2. Should the search response envelope (deferred per Q13 to v0.2) reserve `application/act-search+json` now, or wait until v0.2 pins the envelope? Tentative: do not reserve at v0.1; PRD-803-R9 specifies that adding a new MIME type for a new envelope (when defined) is a MINOR change to PRD-803.
3. Should community packages that fail PRD-600 conformance be prohibited from using "act" in their package name? Tentative: no. The mark is not trademarked; "ACT-conformant" is a factual claim, not a license. Naming hygiene is enforced by PRD-600 reports and ecosystem norms, not by this PRD.

### Acceptance criteria

- [x] Q2's decision is recorded and cited verbatim.
- [ ] Every normative requirement has an ID of the form `PRD-803-R{n}`.
- [ ] The MIME family is enumerated as a closed v0.1 set with rules for additions.
- [ ] First-party vs community package-name conventions are pinned.
- [ ] The well-known path is locked with a stated change-frequency posture.
- [ ] The IANA registration plan names a registrant, a change controller, criteria for filing, and the subsequent amendment process.
- [ ] Trademark posture is stated explicitly (no filing performed; "ACT-conformant" is a factual claim, not a license).
- [ ] Versioning & compatibility table classifies MIME-string changes, mark changes, and well-known-path changes per PRD-108.
- [ ] Security section addresses MIME-type confusion as a known attack class.
- [ ] Changelog initial entry dated 2026-05-02 is present.

---

## Context & dependencies

### Depends on

- **Decision Q2** (`000-decisions-needed.md`, decided 2026-04-30): the verbatim source of the name, extension, well-known path, and MIME family. PRD-803 is the codification of this decision.
- **PRD-100** (Accepted): the wire-format envelope shapes the MIME types describe.
- **PRD-101** (Accepted): the discovery flow whose well-known path PRD-803 locks; the `profile` MIME parameter (closed enum `static | runtime`) referenced from here.
- **PRD-103** (Accepted): the NDJSON profile and the `+ndjson` structured-suffix question.
- **PRD-105** (Accepted): the static delivery profile that emits files at provisional MIME types.
- **PRD-108** (Accepted): the MAJOR/MINOR classification rules applied to changes in this PRD.
- **000-governance** (Accepted): R24 (forking) bears on naming; R16/R17 govern the change-control of this PRD itself.
- **Decision Q10** (parking lot): the canonical domain question. Cited by ID; not resolved here.
- External: [RFC 6648](https://www.rfc-editor.org/rfc/rfc6648) (deprecation of `x-` prefixes for new MIME types — informational), [RFC 6838](https://www.rfc-editor.org/rfc/rfc6838) (Media Type Specifications and Registration Procedures), [RFC 8615](https://www.rfc-editor.org/rfc/rfc8615) (Well-Known URIs registry), [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288) (Web Linking — for the future `rel="act"` link relation registration).

### Blocks

- The IANA registration filing itself (operational work, not a PRD): blocked on the criteria PRD-803-R10 enumerates.
- Any PRD that defines a new envelope and therefore a new MIME type (e.g., a future v0.2 search-response PRD): MUST cite PRD-803 for the naming convention and add the new type via a MINOR amendment to PRD-803 per the rules below.

### References

- v0.1 draft: §5.1 (well-known manifest), §5.13 (delivery profiles, by reference); §11 (provisional MIME types).
- `000-decisions-needed.md` Q2 (naming, decided 2026-04-30), Q10 (domain, deferred), Q11 (logo/brand, deferred).
- `000-gaps-and-resolutions.md` B5 (MIME types and `profile` parameter — owned by PRD-101 for the parameter, ratified by PRD-803 for the type strings).
- Prior art: how OpenAPI registers `application/vnd.oai.openapi+json`, how MCP names `application/json` payloads with content-typed envelopes, how schema.org chose not to register a MIME family. ACT chooses the structured-suffix `+json` pattern from RFC 6838.

---

## Specification

This is the normative section. Everything below MUST use RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) where requirements are imposed. Lowercase "must" and "should" are non-normative prose.

### Conformance level

Naming is **Core** — every ACT-conformant deployment, regardless of conformance band, observes the mark, the well-known path, and the MIME types defined here. Two requirements have a band qualifier:

- **Core:** R1, R2, R3, R4, R5, R6 (subject to per-clause band notes below), R7, R8, R10, R11.
- **Standard:** R6(d) — the subtree MIME type — applies only to Standard and Plus producers (Core does not require the subtree endpoint per PRD-107-R7).
- **Plus:** R6(f) — the NDJSON-index MIME type — applies only to Plus producers (Plus exposes the NDJSON index per PRD-107-R10).
- **Process / non-Core:** R9 (rules for adding MIME types) and R10 (IANA plan) are procedural; they apply to PRD authoring, not to runtime conformance.

### Normative requirements

#### The mark

**PRD-803-R1.** The project's canonical name is **"ACT"** (uppercase initialism), expanded as **"Agent Content Tree"**. Producers and consumers MUST use one or the other (or both) when referring to the spec; alternative expansions (e.g., "Agent Communication Tree", "Action Content Tree") MUST NOT be used in PRD prose, package descriptions, or fixture data. The mark is recorded in Q2 (`000-decisions-needed.md`, 2026-04-30) and ratified here.

**PRD-803-R2.** The phrase **"ACT-conformant"** (or "Agent Content Tree-conformant") is a **factual claim** about a producer or consumer, not a trademark license or an endorsement. A package, deployment, or document MAY describe itself as ACT-conformant only if it satisfies the conformance level it claims, as verifiable by PRD-600. No formal trademark filing has been performed for v0.1 (Q2 rationale: lead accepts the collision risk); accordingly, the mark is not enforceable as a trademark, and "ACT-conformant" carries no licensing implication.

**PRD-803-R3.** Renaming the project — changing R1's canonical name or its expansion — is a MAJOR change to this PRD per §Versioning and propagates as MAJOR changes to every PRD that uses the name in normative text. A rename MUST go through `000-governance` R16 (superseding PRD) and the deprecation window in PRD-108-R12 (the old name remains usable through the current MAJOR; removal earliest at the next MAJOR).

#### Package-name conventions

**PRD-803-R4.** First-party reference implementations published under the spec organization (the BDFL or appointed Maintainers per `000-governance` R3) MUST use the package-name pattern `act-{kind}-{thing}`, where `{kind}` is one of `adapter`, `generator`, `sdk`, `binding`, `cli`, `validator`, `inspector`, and `{thing}` is the framework, source, or target name in lowercase ASCII (`act-adapter-markdown`, `act-generator-astro`, `act-sdk-nextjs`, `act-binding-react`, `act-cli-validator`). Synonyms or marketing names (e.g., `act-rocket-react`) MUST NOT be used by first-party packages.

**PRD-803-R5.** Community packages — anything not published by the spec organization — MAY use any name permitted by the host registry (npm, crates.io, PyPI, RubyGems, etc.) but SHOULD include the substring `act` (in lowercase or as the `ACT` initialism) somewhere in the package name when the package claims ACT conformance. Community packages MUST NOT use the substrings `act-official`, `act-bdfl`, or `act-spec` in their names — those are reserved for first-party use to avoid implying endorsement. A community package's README MAY state "ACT-conformant" (per R2) regardless of its package name.

#### MIME type family

**PRD-803-R6.** The v0.1 MIME types form a closed family. A producer serving an ACT envelope over HTTP, or a static asset bearing an ACT envelope, MUST use the appropriate type from the list below (and only one); a consumer MUST treat any other type as non-ACT for the purpose of dispatching ACT parsing.

| Envelope (PRD-100) | MIME type | Conformance level | File extension |
|---|---|---|---|
| (a) Manifest | `application/act-manifest+json` | Core | `.act.json` (when served as `act.json` at the well-known path) |
| (b) Index | `application/act-index+json` | Core | `.act.json` |
| (c) Node | `application/act-node+json` | Core | `.act.json` |
| (d) Subtree | `application/act-subtree+json` | Standard / Plus | `.act.json` |
| (e) Error | `application/act-error+json` | Core (runtime) | n/a — runtime response body only |
| (f) NDJSON index | `application/act-index+ndjson` | Plus | `.act.ndjson` |

The structured-suffix forms (`+json` per RFC 6838 §4.2.8; `+ndjson` per the de-facto convention used by `application/x-ndjson` and JSON-Lines tooling) MUST be preserved exactly as written. The `profile` MIME parameter (`profile=static` or `profile=runtime`) defined by PRD-101-R7 applies on top of any of these types and is not part of the type string itself.

**PRD-803-R7.** Producers MUST emit the canonical MIME type from R6 on every response (runtime) or on every static asset whose origin server permits content-type negotiation. Producers MUST NOT use `application/json` as the Content-Type for an ACT envelope unless an upstream proxy or origin server makes the canonical type unreachable, in which case the producer SHOULD document the limitation in the deployment's README or runbook and SHOULD set the file extension to `.act.json` so that consumers performing extension-based content sniffing still recover the type. Consumers SHOULD treat `application/json` at `/.well-known/act.json` as a soft signal that the resource is an ACT manifest, but MUST validate against the manifest schema before relying on the content; PRD-600 emits a warning in this case.

#### Well-known path

**PRD-803-R8.** The well-known discovery path is `/.well-known/act.json`. The string is normative; producers MUST NOT relocate it (e.g., to `/act/manifest.json`, `/.well-known/agent-content-tree.json`, or `/manifest.act.json`) for any reason short of a MAJOR rename per R3. Changing the well-known path is classified MAJOR per §Versioning and triggers the same deprecation cycle as a rename: a deprecated alias MAY ship for one MINOR cycle, removed at the next MAJOR earliest. Within a MAJOR the path is effectively never changed.

#### MIME-type lifecycle

**PRD-803-R9.** Adding a new MIME type to the R6 family for a new envelope (e.g., a future search-response envelope) is a MINOR change to PRD-803. The new type MUST follow the `application/act-{envelope}+json` (or `+ndjson` where line-delimited) pattern. Renaming an existing type (e.g., from `application/act-manifest+json` to `application/act-mfst+json`) is a MAJOR change. Removing a type from the family is a MAJOR change and requires a superseding PRD per `000-governance` R16. Producers MUST NOT define vendor-prefixed types (`application/vnd.example.act-*`) for ACT envelopes; vendor extensions that wrap or enrich an ACT payload SHOULD use a separate type whose body MAY embed an ACT envelope by reference.

#### IANA registration plan

**PRD-803-R10.** The BDFL (currently Jeremy Forsythe per `000-governance` R1) is the named registrant of record for any IANA filing of the MIME types in R6 and the well-known path in R8. No filing is performed at v0.1 acceptance; the plan is:

- **Trigger to file the MIME types:** v0.1 reaches `Implemented` for PRD-100, PRD-101, PRD-103, and PRD-105 — i.e., the first-party reference implementation actually emits the canonical types in production. Filing earlier risks the registration drifting from the spec.
- **Trigger to file the well-known path:** filed alongside the MIME types or immediately after, per RFC 8615.
- **Filer:** the BDFL or an appointed Maintainer (`000-governance` R3) acting on the BDFL's behalf.
- **Registration template:** per RFC 6838 §5 (the standard MIME registration template), one filing per type. Required fields include type/subtype, registrant, change controller, and a stable specification URL (the public PRD set).
- **Change controller:** "Jeremy Forsythe / ACT spec maintainers" at v0.1; updateable via IANA's standard amendment process if the project transitions to a foundation (Q1 open question).
- **Stability:** the registration template MUST cite the PRD set hosted at the canonical domain (Q10 deferred; until resolved, the GitHub Pages URL of the spec repo is the stable reference).

The registration filing itself is operational work; PRD-803 owns the policy and the trigger criteria, not the act of filing.

**PRD-803-R11.** A future link relation registration for `rel="act"` (per PRD-101-R5 and RFC 8288's IANA Link Relation Type registry) is part of the same operational filing batch as the MIME types. The link relation MUST be registered under the same change controller as the MIME types (R10). PRD-803-R11 is informational at v0.1 (no filing performed) and operational once the trigger criteria in R10 are met.

### Wire format / interface definition

_Not applicable — non-wire-format PRD; rules are policy, not protocol._

### Errors

| Condition | Response | Notes |
|---|---|---|
| Producer serves an ACT envelope with `Content-Type: application/json` (no `+json` structured suffix) | PRD-600 warning, not error | Per R7. Consumer MAY proceed; producer is advised to fix. |
| Producer serves an ACT envelope with `Content-Type: application/x-act-manifest` or any `application/vnd.*` form | PRD-600 error | Per R7 + R9 (vendor-prefixed types are disallowed). Consumer MUST treat as non-ACT for dispatch. |
| Manifest reachable at a non-conformant well-known path (e.g., `/act/manifest.json`) | PRD-600 error | Per R8 + PRD-101-R1. Consumer MAY still find the manifest if discovery follows links, but the deployment fails conformance. |
| Community package named `act-official-react` | Naming violation; spec organization MAY request a registry takedown / rename | Per R5. Not enforceable as a trademark per R2; ecosystem norm only. |
| Producer emits an envelope of an unrecognized type (e.g., `application/act-foo+json` not in R6) | PRD-600 warning at v0.1 spec; possible MINOR future amendment | Per R9. Forward-compatible: a future MINOR may add the type. Consumers MUST tolerate unknown types per PRD-108-R7 (they ignore) but MUST NOT dispatch them as ACT envelopes. |

PRD-803 introduces no HTTP status codes of its own; the error envelope itself uses `application/act-error+json` per R6(e), defined in PRD-100 / PRD-106.

---

## Examples

### Example 1 — Canonical responses on the runtime profile

A runtime ACT producer responds to a manifest fetch with:

```
HTTP/1.1 200 OK
Content-Type: application/act-manifest+json; profile="runtime"
ETag: "s256:iH6ta82PUg0zi0lr_jpCLL"
Cache-Control: private, must-revalidate

{ "act_version": "0.1", "site": { "name": "Acme" }, ... }
```

The same producer responds to an unauthenticated index fetch on a private resource with:

```
HTTP/1.1 404 Not Found
Content-Type: application/act-error+json
WWW-Authenticate: Bearer realm="acme"

{ "act_version": "0.1", "error": { "code": "not_found", "message": "..." } }
```

Both `Content-Type` values come from R6.

### Example 2 — Static asset on the static profile

A static generator emits, at the canonical path:

```
GET /.well-known/act.json
Content-Type: application/act-manifest+json; profile="static"
```

Plus, at the NDJSON index URL:

```
GET /act/index.ndjson
Content-Type: application/act-index+ndjson; profile="static"
```

The file extension `.act.json` is preserved on the manifest (R6 row a). The NDJSON index uses `.act.ndjson` (R6 row f).

### Example 3 — First-party package names

The spec organization publishes:

- `act-adapter-markdown` (PRD-201)
- `act-adapter-contentful` (PRD-202)
- `act-generator-astro` (PRD-401)
- `act-sdk-nextjs` (PRD-501)
- `act-binding-react` (PRD-301)
- `act-cli-validator` (PRD-600)
- `act-cli-inspector` (PRD-601)

All match R4's `act-{kind}-{thing}` pattern.

### Example 4 — Community package names (acceptable and unacceptable)

Acceptable:

- `act-helpers` — community utility, contains `act`, no endorsement claim.
- `acme-act-bridge` — community vendor prefix plus `act`.
- `react-act` — community React helper, contains `act`.

Unacceptable (would violate R5):

- `act-official-vue` — implies BDFL endorsement.
- `act-spec-rails` — implies spec-organization authorship.
- `act-bdfl-toolkit` — implies BDFL stewardship.

The maintainer of an acceptable community package MAY add a README badge like "ACT-conformant (Standard, per PRD-600 v0.1)" per R2.

### Example 5 — A hypothetical rename (non-normative thought experiment)

A future trademark conflict is surfaced (the project is contacted about an existing "ACT" mark in a related domain). Per R3:

1. A successor PRD (e.g., PRD-820) is filed proposing `AGT` / "Agent Graph Tree" as the new mark.
2. PRD-820 follows `000-governance` R10/R11 to acceptance.
3. PRD-803 transitions to `Deprecated`.
4. PRD-820 ships with a deprecation window: the old mark, package names, and MIME types remain valid through the current MAJOR. The new MIME family `application/agt-*+json` and the new well-known path `/.well-known/agt.json` ship in parallel.
5. At the next MAJOR (`1.0`), the old MIME types and well-known path may be removed; producers and consumers running `1.x` use the new mark exclusively.

This is illustrative; no rename is contemplated at v0.1 acceptance.

### Example 6 — IANA registration template sketch (non-normative)

Per R10, when the trigger criteria are met, the BDFL files entries shaped like:

```
Type name: application
Subtype name: act-manifest+json
Required parameters: none
Optional parameters: profile (per PRD-101); charset (UTF-8 only)
Encoding considerations: 8bit; binary content (UTF-8 JSON per RFC 8259)
Security considerations: see PRD-109 and PRD-803 §Security considerations
Interoperability considerations: see PRD-100 §Wire format / interface definition
Published specification: https://act-spec.org/prd/100-wire-format (or the GitHub Pages mirror)
Applications that use this media type: ACT-conformant agents, generators, runtime SDKs, validators
Fragment identifier considerations: per RFC 6839
Restrictions on usage: none
Provisional registration: no (this is a permanent registration filed at v0.1 Implemented)
Author: Jeremy Forsythe
Change controller: Jeremy Forsythe / ACT spec maintainers
```

The other five MIME types follow the same template with the appropriate `Subtype name` and `Published specification` URL.

---

## Test fixtures

Process / policy PRD; conformance is mostly procedural. A small set of MIME-type-string fixtures is testable: PRD-600 can exercise R6 and R7 against runtime responses and static assets.

Fixtures live under `fixtures/803/` and are exercised by PRD-600.

### Positive

- `fixtures/803/positive/manifest-content-type.json` → a captured runtime response whose `Content-Type` header equals `application/act-manifest+json; profile="runtime"`. Satisfies R6(a) and R7.
- `fixtures/803/positive/index-ndjson-content-type.json` → a captured response whose `Content-Type` equals `application/act-index+ndjson; profile="static"`. Satisfies R6(f).
- `fixtures/803/positive/wellknown-path.json` → a captured discovery probe at `/.well-known/act.json` returning 200. Satisfies R8.
- `fixtures/803/positive/first-party-package-name.json` → a synthetic `package.json` with `name: "act-adapter-markdown"`. Satisfies R4.

### Negative

- `fixtures/803/negative/vendor-prefix-content-type.json` → a captured response whose `Content-Type` equals `application/vnd.example.act-manifest+json`. PRD-600 emits an error citing R7 + R9.
- `fixtures/803/negative/x-prefix-content-type.json` → a captured response whose `Content-Type` equals `application/x-act-manifest`. PRD-600 emits an error citing R7 + R9.
- `fixtures/803/negative/relocated-wellknown.json` → a captured discovery probe at `/act/manifest.json` returning 200 (with `/.well-known/act.json` returning 404). PRD-600 emits an error citing R8 + PRD-101-R1.
- `fixtures/803/negative/plain-json-content-type.json` → a captured response whose `Content-Type` equals `application/json`. PRD-600 emits a warning citing R7 (downgraded from error per the SHOULD in R7).
- `fixtures/803/negative/forbidden-community-name.json` → a synthetic `package.json` with `name: "act-official-vue"`. PRD-803 documents this as a naming violation; PRD-600 MAY emit a warning if it inspects package metadata, but enforcement is ecosystem-level (R5) not wire-format-level.

---

## Versioning & compatibility

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a new MIME type for a new envelope (e.g., `application/act-search+json`) | MINOR | Per R9. Producers and consumers tolerate unknown types per PRD-108-R7. |
| Rename an existing MIME type (e.g., `application/act-manifest+json` → `application/act-mfst+json`) | MAJOR | Per R9. Consumers depend on the exact string. |
| Remove an existing MIME type from R6 | MAJOR | Per R9. Requires deprecation window per PRD-108-R12 and a superseding PRD per `000-governance` R16. |
| Change the well-known path string | MAJOR | Per R8. Effectively never within a MAJOR; deprecation alias allowed for one MINOR cycle. |
| Rename the project (R1) | MAJOR | Per R3. Cascades to every PRD that uses the name in normative text. |
| Tighten R5 to a MUST that prohibits community names without the `act` substring | MAJOR | Per PRD-108-R5(3) — tightening a SHOULD to a MUST is MAJOR. |
| Add a new package-name `{kind}` to R4 (e.g., `tool`, `examples`) | MINOR | Additive to the first-party convention; existing names remain valid. |
| Reserve a previously-unused community-name substring (e.g., add `act-spec-org` to R5's reserved list) | MAJOR | Tightens permitted naming surface. |
| Update the IANA registration plan in R10 (e.g., trigger criteria) | MINOR | Procedural change; no impact on existing producers or consumers. |
| File the IANA registrations | Operational, not a PRD change | Tracked in this PRD's Changelog; the act of filing is an artifact of R10's plan, not a spec change. |
| Editorial: example URLs, package-name examples, prose clarifications | n/a | Per `000-governance` R18. |

### Forward compatibility

A consumer MUST tolerate `Content-Type` values it does not recognize (per PRD-108-R7) but MUST NOT dispatch them as ACT envelopes. A future MINOR addition to R6 (per R9) is the only mechanism by which a new type joins the family; until that addition, an unknown `application/act-*+json` value is not yet an ACT envelope from this consumer's point of view.

### Backward compatibility

- The mark, the well-known path, and the existing MIME types are stable across all v0.1 MINORs.
- A community package that adopts a name disallowed by a future tightening of R5 (e.g., the spec adds a new reserved substring) MUST be allowed to keep its existing name through the current MAJOR; the tightening is MAJOR per the table above and triggers a deprecation cycle.

---

## Security considerations

- **MIME-type confusion.** Treating an `application/json` body as `application/act-manifest+json` is a known attack class: a server that returns user-controlled JSON at an attacker-influenced URL can be leveraged to feed an ACT consumer a forged manifest. PRD-803-R7 is the lever — consumers SHOULD validate the `Content-Type` before dispatching to ACT parsing, and PRD-600 surfaces non-canonical types. Cite PRD-109 for the project-wide stance on type-confusion.
- **Well-known path discoverability.** The path `/.well-known/act.json` itself signals that a site supports ACT, which is a privacy-relevant disclosure for some operators (see PRD-101 §Security). PRD-803 does not change that posture; locking the path in R8 makes the disclosure predictable and machine-checkable, which is the design intent (it lets agents avoid speculative probes).
- **Trademark absence.** R2 explicitly states that "ACT-conformant" is a factual claim, not a trademark license. A community package falsely claiming ACT-conformance carries no protocol-level consequence; the recourse is a PRD-600 verification report, not a legal claim. Operators who need a stronger guarantee SHOULD verify the package against PRD-600's conformance suite before deploying.
- **Squatting on IANA registrations.** R10 names the BDFL as the registrant of record; if a third party files a registration for `application/act-manifest+json` before the BDFL does, the registration would be challengeable on prior-publication grounds (this PRD is dated and public). The risk is bounded; mitigation is filing under R10's trigger criteria rather than waiting longer than needed.
- **Package-name impersonation.** R5 disallows substrings that imply BDFL endorsement (`act-official`, `act-bdfl`, `act-spec`). A malicious package using one of those substrings on a public registry would be a confused-deputy / supply-chain attack. The recourse is ecosystem-level (registry takedown, security disclosure) rather than wire-format. PRD-803 documents the convention so disputes have a normative anchor.

PRD-803 introduces no new threat surface beyond the items above; the wire-format security posture is owned by PRD-109.

---

## Implementation notes

_Not applicable — non-implementation PRD._

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-02 | Jeremy Forsythe | Initial draft. Codifies decision Q2 (2026-04-30) as the normative naming contract: mark "ACT" / "Agent Content Tree", well-known path `/.well-known/act.json`, file extension `.act.json`, closed v0.1 MIME family `application/act-{manifest,index,node,subtree,error}+json` plus the Plus `application/act-index+ndjson` profile. Pins first-party `act-{kind}-{thing}` package convention; permits community names with the `act` substring SHOULD; reserves `act-official`, `act-bdfl`, `act-spec` substrings. Records IANA filing plan under BDFL stewardship with `Implemented`-state trigger criteria; no filing performed at v0.1 acceptance. Status: Draft → In review. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
