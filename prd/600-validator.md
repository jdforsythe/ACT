# PRD-600 — Validator (TS library + client-side hosted page; level reporting; conformance test harness CLI mode)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

Every PRD in the 100-series enumerates normative requirements, schemas, and test fixtures, and every PRD downstream of the 100-series cites PRD-600 as the gate that proves their producer outputs conform. Today that gate does not exist: there is no executable that ingests a manifest URL or a JSON file and reports "this is Core" or "this declared Standard but achieves only Core because the subtree endpoint 404s." Generator authors (PRD-400 series), runtime SDK authors (PRD-500 series), adapter authors (PRD-200 series), and example-site authors (PRD-700 series) all need the same tool, and PRD-107-R20 already pins the JSON shape its output MUST take. PRD-700 through PRD-707 each list "validates clean against PRD-600" as an acceptance criterion. Without PRD-600 there is no objective signal for "v0.1 is shippable"; with it, every PRD in the index acquires a green-or-red signal anyone can run.

PRD-600 is also the project's public face for non-implementer adopters. Decision Q8 (2026-04-30) committed the project to a client-side hosted single-page validator on GitHub Pages so that an author writing a manifest by hand, or an operator wanting to sanity-check a production deployment, can paste JSON or a URL and see the same conformance verdict CI sees. Decision Q12 rolled the conformance test harness into PRD-600's CLI mode rather than opening a separate PRD-604 — same parser, same level reporter, same fixture corpus, three packagings (library, hosted SPA, CLI). Decision Q13 deferred the search-body envelope to v0.2; PRD-600 must call out the limitation prominently so authors are not surprised when their search response passes "endpoint returns 200 JSON" but the body itself is unspecified.

The TypeScript-only constraint (Q3, decided 2026-04-30) shapes the deliverable: `@act/validator` is a TypeScript package consumable from any TS or JS host, the SPA is a thin wrapper around it, and the CLI is `act-validate` shipping from the same package. Non-TS validators (a future Python port, a Go port) are explicitly out of v0.1 scope and are community work.

### Goals

1. Specify the validator's **validation surface** for every envelope shape in the 100-series: schema conformance against `schemas/100/*.schema.json`, cross-cutting rules (cycles in `children`, ID grammar, ID stability, max depth, MIME types), and PRD-103 ETag stability.
2. Specify the validator's **discovery walk**: given a base URL, walk `/.well-known/act.json` → `index_url` → sample N nodes → optional subtree → produce a report.
3. Pin the validator's **conformance reporter output shape** to PRD-107-R16 through PRD-107-R22 (`declared`, `achieved`, `gaps`, `warnings`, `passed_at`, plus the `act_version` and `url` envelope fields). The `achieved` value is computed by **probing**, not by trusting `conformance.level`.
4. Surface the **search-body envelope limitation** per Q13: validator asserts presence of `search_url_template`, asserts the endpoint returns 200 JSON, but does NOT validate the response body against any normative schema. Limitation appears in the README, in `--conformance` output, and in the SPA's UI.
5. Surface the **CORS limitation** per Q8: the hosted client-side SPA cannot fetch from origins that block CORS. The fallback is direct paste of JSON; the SPA UX must surface CORS failures with the remediation hint.
6. Specify the **programmatic TypeScript API** (`validateManifest`, `validateNode`, `validateIndex`, `validateSubtree`, `validateSite`) and the input/output types each takes.
7. Specify the **CLI surface**: flags, exit codes, output formats (human-readable + JSON), and the relationship between `--file`, `--url`, and `--conformance` modes.
8. Specify the **test fixtures**: PRD-600's own fixture suite consumes every existing fixture under `fixtures/100/` through `fixtures/109/` plus per-leaf-PRD fixtures, and adds end-to-end discovery-walk fixtures under `fixtures/600/`.
9. Specify the **hosted-page operational contract**: static SPA at a `/validator/` path on the spec's GitHub Pages site, no backend, version pinned to a specific `act_version`, deploys via the same CI that builds the spec.

### Non-goals

1. **Defining the wire format itself.** PRD-100 owns envelope shapes. PRD-600 ingests `schemas/100/*.schema.json` as its authoritative source for envelope structure.
2. **Defining conformance levels or the reporter shape.** PRD-107 owns both. PRD-600 implements the reporter; the JSON shape is PRD-107-R16 through PRD-107-R22.
3. **Defining the discovery flow.** PRD-101 owns the consumer discovery algorithm (PRD-101-R8). PRD-600 implements it; it does not redefine it.
4. **Defining the ETag derivation recipe.** PRD-103 owns it. PRD-600 implements the prober that detects determinism violations (PRD-103-R7); the recipe itself is normative there.
5. **Defining auth.** PRD-106 owns auth scheme negotiation. PRD-600 implements `--probe-auth` mode that exercises the 401 / `WWW-Authenticate` contract (PRD-106-R5, R8); the authentication itself is the consumer's responsibility (the validator does not log into anyone's SaaS).
6. **Validating the search response body.** Per Q13, the search envelope shape is deferred to v0.2. PRD-600 v0.1 validates only that `search_url_template` is present (PRD-107-R10) and, when probed, returns 200 with a valid JSON body. Body validation is explicitly out of scope.
7. **Defining a hosted backend / API service.** Per Q8, the hosted validator is client-side only. A future v0.2 `act-spec.org/validate` backend (Q8 Option 1) is out of scope for v0.1; PRD-600 specifies only the static SPA.
8. **Validating non-TS implementations.** Per Q3, first-party reference impl is TS-only. Community ports are welcome and should reuse PRD-600's fixture corpus, but PRD-600 specifies only the TS implementation contract.
9. **Inspector-style tooling** (interactive walk, diff, token-budget what-ifs). That is PRD-601. PRD-600 is the conformance gate; PRD-601 is the interactive tool. They share the parser and the discovery walk but ship as distinct packages.
10. **The ACT-MCP bridge.** PRD-602.

### Stakeholders / audience

- **Consumers of:** every PRD-700-series example author (validation is a P3 acceptance criterion); every PRD-200/300/400/500 implementer (CI gate); every external producer who wants to sanity-check their deployment (hosted SPA + CLI); the Spec Steward agent in Phase 6.
- **Authors of:** PRD-700–707 acceptance criteria depend on PRD-600's report shape; PRD-601 (inspector) reuses PRD-600's parser; PRD-803 (naming policy) cites PRD-600's MIME-type assertions.
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Hosted SPA cannot fetch arbitrary author URLs because of CORS, and authors interpret "fetch failed" as a producer bug rather than a CORS limitation. | High | Medium | PRD-600-R23 makes the CORS limitation a UX requirement: SPA MUST surface CORS failures with a structured remediation hint pointing to direct-paste mode. README and `--conformance` output state the limitation prominently per Q8 / Q13's "call it out" mandate. |
| Search-body validation absence is read as "search is unvalidated" rather than "search-body envelope is deferred to v0.2." | Medium | Low | PRD-600-R24 mandates that every conformance report whose target advertises `search_url_template` carries a `warnings` entry citing PRD-600-R24 with the v0.2-deferral language verbatim. SPA renders the warning prominently. |
| Validator probes a runtime origin too aggressively (no rate limit) and gets the user blacklisted by the target's WAF. | Medium | Medium | PRD-600-R20 specifies a default request budget (max 64 requests for a site walk; max 1 request/second per origin). CLI flag `--max-requests` overrides. SPA hard-caps at the default — operators of public deployments are not the people running the SPA. |
| ETag-determinism prober (PRD-600-R12) misfires on legitimate per-request variation (e.g., a producer that legitimately revalidates between two probe calls because the underlying content actually changed). | Low | Low | PRD-600-R12 issues two consecutive identical requests within a 100ms window and tolerates a single change (warning, not error) when content materially differs; flags only when content is byte-identical and ETag differs. |
| Reporter output shape drifts from PRD-107-R16 through R22, breaking downstream tools that parse the JSON. | Low | High | PRD-600-R31 anchors the output shape to PRD-107's schema fragment; PRD-600 does not extend it without a coordinated PRD-107 amendment. The `additionalProperties` allowance in PRD-107's schema lets PRD-600 add envelope-level fields (e.g., `validator_version`) without breaking the contract. |
| Hosted SPA's bundled `act_version` drifts behind the live spec, validating against an outdated rule set. | Medium | Medium | PRD-600-R28 makes the bundled `act_version` visible in the SPA UI and in CLI output; CI rebuilds the SPA on every spec change; PRD-600-R29 specifies a top-banner notice when the spec has changed since the SPA's build timestamp. |

### Open questions

1. ~~Should the CLI default to walking the full site (every node) or sample a fixed number (default `--sample 16`)?~~ **Resolved (2026-05-01): Sample 16 by default; full walk via `--sample all`.** Rationale: a complete walk on a 10K-node Plus deployment is operationally expensive; CI usage typically wants the sample, comprehensive audit wants `all`. Encoded normatively at PRD-600-R26. (Closes Open Question 1.)
2. ~~Should the validator gate be **strict** (any warning fails CI under `--strict-warnings`) or **lenient** (only errors fail) by default?~~ **Resolved (2026-05-01): Lenient default; strict via `--strict-warnings`.** Most warnings (`summary` length over 50 tokens, `tokens.body` over 10K) are non-blocking by spec design (PRD-100-R20, PRD-100-R27, PRD-102-R26). Encoded at PRD-600-R26 / R27. (Closes Open Question 2.)
3. ~~Should the SPA support **deep-linking** to a report (e.g., `/validator/?url=https://...`) so users can share a verdict?~~ **Resolved (2026-05-01): Yes for the URL form; no for the paste form** (paste content may be private). Implementation note only; not normative. (Closes Open Question 3.)
4. ~~Should the CLI support a **`--watch`** mode that re-validates a local generator's output on change?~~ **Resolved (2026-05-01): No — defer to PRD-601 (inspector).** PRD-600 is the one-shot gate; an interactive watch loop is out of scope. (Closes Open Question 4.)
5. ~~Should `validateSite` walk **mounts** recursively, or treat each mount as an independent target requiring its own `validateSite` invocation?~~ **Resolved (2026-05-01): Walk mounts as part of a single invocation**, producing one top-level report with per-mount sub-reports. The sub-report shape is an envelope-level extension (PRD-107 schema permits via `additionalProperties`). Non-blocking; revisit during implementation. (Closes Open Question 5.)

### Acceptance criteria

- [ ] Every requirement has an ID of the form `PRD-600-R{n}`.
- [ ] Conformance level (Core / Standard / Plus per PRD-107) is declared per requirement.
- [ ] The validation-surface table at the top of §Specification enumerates every 100-series requirement PRD-600 validates, by R-ID.
- [ ] The reporter output shape is anchored to PRD-107-R16 through PRD-107-R22; any deviation is flagged.
- [ ] The CORS limitation (Q8) and the search-body limitation (Q13) are stated prominently in §Specification, in the implementation-notes README sketch, and in the `--conformance` output sample.
- [ ] The TS programmatic API is specified with concrete TypeScript signatures.
- [ ] The CLI flags, exit codes, and output formats are enumerated.
- [ ] The SPA operational contract (path, version pinning, no backend, deploys with the spec) is specified.
- [ ] Test fixtures path layout under `fixtures/600/positive/` and `fixtures/600/negative/` is enumerated; existing 100-series fixtures are referenced as the validator's foundational corpus.
- [ ] The Implementation notes section includes 3–10 short TS snippets showing the public API, the reporter assembly, the discovery walk, the SPA wiring, and the CLI argv parsing.
- [ ] Versioning & compatibility table classifies every change kind per PRD-108.
- [ ] Security section addresses: probing third-party origins; hosted SPA threat surface; auth-probe scope; rate-limiting.
- [ ] Changelog entry dated 2026-05-01 is present.

---

## Context & dependencies

### Depends on

- **PRD-100** (Accepted) — wire-format envelope schemas (`schemas/100/*.schema.json`); PRD-600 ingests them as the authoritative envelope source.
- **PRD-101** (Accepted) — discovery algorithm (PRD-101-R8); PRD-600 implements it.
- **PRD-102** (Accepted) — content-block taxonomy; PRD-600 enforces block-shape rules per type.
- **PRD-103** (Accepted) — ETag derivation and stability; PRD-600 implements both the value-shape check (PRD-103-R2, R3) and the determinism prober (PRD-103-R7).
- **PRD-104** (Accepted) — i18n locales block; PRD-600 validates `locales` shape and Pattern 1/2 selection (PRD-104-R1 through R7).
- **PRD-105** (Accepted) — static profile file set, MIME types, CDN expectations; PRD-600's static probe checks file presence and `Content-Type` headers per PRD-105-R1 through R8 and R10.
- **PRD-106** (Accepted) — runtime profile endpoint set, status codes, error envelope, `mounts`, runtime-only Link header; PRD-600's runtime probe asserts the contract.
- **PRD-107** (Accepted) — conformance levels and the reporter output shape; PRD-600 implements the reporter whose output is normatively defined there.
- **PRD-108** (Accepted) — versioning policy; PRD-600 enforces `act_version` regex and tolerates unknown optional fields per PRD-108-R7.
- **PRD-109** (Accepted) — security posture; PRD-600 cites PRD-109 for auth-probe scope, existence-non-leak rules, and origin-trust evaluation on cross-origin mounts.
- **000-governance** (Accepted) — lifecycle.
- **Decision Q3** (decided 2026-04-30): TypeScript-only first-party reference impl; PRD-600 ships as `@act/validator` in TS only.
- **Decision Q8** (decided 2026-04-30): client-side hosted SPA on GitHub Pages from the spec repo; CORS limitation called out.
- **Decision Q12** (decided 2026-04-30): conformance test harness rolled into PRD-600 as a CLI mode.
- **Decision Q13** (decided 2026-05-01): search-body envelope deferred to v0.2; PRD-600 must call out the limitation.
- External: [JSON Schema 2020-12](https://json-schema.org/draft/2020-12/release-notes), [Ajv](https://ajv.js.org/) (the recommended TS schema validator — see Implementation notes; not normative), [RFC 8785 JCS](https://www.rfc-editor.org/rfc/rfc8785) (for ETag re-derivation in the determinism prober), [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) (HTTP semantics for the runtime probe).

### Blocks

- **PRD-700–707** (reference example builds) — every example's acceptance criterion includes "validates clean against PRD-600."
- **PRD-200, 300, 400, 500-series** — CI gate per package; every leaf adapter / generator / SDK uses PRD-600 to verify its emitted output.
- **PRD-601** (inspector CLI) — reuses PRD-600's parser, schema bundle, and discovery walk.
- **PRD-602** (ACT-MCP bridge) — bridge output is validated against PRD-600.
- **PRD-803** (naming policy) — PRD-600's MIME-type assertions feed the IANA registration text.

### References

- v0.1 draft: §5 (envelope shapes — referenced via PRD-100), §5.13 (runtime profile — referenced via PRD-106), Appendix B item 12 ("Publish a validator").
- `prd/000-decisions-needed.md`: Q3, Q8, Q12, Q13.
- `prd/000-INDEX.md` 600-series row.
- `docs/workflow.md` Phase 2 §Gate to Phase 3 ("PRD-600 implementable from the 100-series alone — verify by sketching their interface signatures before declaring the gate cleared") and Phase 3 §Special note ("each P2 PRD MUST cite which 100-series requirements it implements — list them as a table at the top of the Specification section").
- Prior art: [Ajv](https://ajv.js.org/) (JSON Schema validator), [Spectral](https://stoplight.io/open-source/spectral) (OpenAPI / AsyncAPI linter — closest analog to ACT validator in shape), [HTML Validator](https://validator.w3.org/) (W3C Markup Validation Service — the canonical "paste a URL, get a verdict" UX).

---

## Specification

This is the normative section. Every requirement uses RFC 2119 keywords as clarified by RFC 8174.

### Conformance level

PRD-600 is a consumer of every 100-series PRD. Its requirements band as follows:

- **Core:** PRD-600-R1 through PRD-600-R10 (envelope validation surface and ETag stability), R11 (discovery walk), R12 (reserved), R13 (cycle detection), R14 (ID grammar), R15 (subtree depth and order), R16 through R22 (reporter assembly per PRD-107-R16–R22), R23 (CORS limitation surfacing), R24 (search-body limitation surfacing), R25 (programmatic API surface), R26 (CLI flags), R27 (output formats and exit codes), R28 (hosted SPA path and version pinning), R29 (SPA stale-build banner), R30 (test-fixture corpus), R31 (output-shape anchoring to PRD-107), R32 (auth probe scope), R33 (request budget).
- **Standard:** No additional requirements; PRD-600 validates Standard-tier producers using the same Core requirements applied to the Standard envelopes (subtree, `abstract`, `related`).
- **Plus:** No additional requirements; PRD-600 validates Plus-tier producers using the same Core requirements applied to the Plus envelopes (NDJSON index, `marketing:*` blocks, `locales`, `search_url_template`).

PRD-600 does not introduce new conformance bands; it implements verification of the bands defined by PRD-107.

### Validation surface — what PRD-600 validates from the 100-series

The validator validates the following 100-series requirements. Each row names the source PRD requirement; PRD-600 implements the check and emits a `gaps` entry citing the source R-ID when the check fails.

| Source PRD | Requirement IDs validated | What PRD-600 checks |
|---|---|---|
| PRD-100 | R1, R2, R3, R4, R5, R6, R7, R8, R9 | Envelope `act_version` regex, manifest required-field set, `node_url_template` `{id}` placeholder, structured `capabilities` object (legacy array form rejected), `mounts` shape, optional-field shapes, no extra required fields. |
| PRD-100 | R10, R11, R12, R13, R14, R15 | ID grammar regex, ID byte length, percent-encoding on URL substitution, ID case rule, override-precedence enforcement (build-time for static; PRD-600 reports on emitted output, not on adapter internals), runtime ID stability across two probes. |
| PRD-100 | R16, R17, R18, R19, R20 | Index envelope shape, per-entry required fields, no `content` array in index entries, `summary` non-empty, summary-length warning at 100 tokens. |
| PRD-100 | R21, R22, R23, R24, R25, R26, R27 | Node envelope required fields, optional fields, `summary_source` open enum (warn on unknown), parent/children ID-grammar conformance, `children`-cycle hard error, `related`-cycle tolerance, body-token warning at 10000. |
| PRD-100 | R28, R29, R30, R31 | Content block `type` discriminator, canonical `core:*` namespace closed, `marketing:*` namespace open at Plus, unknown block types tolerated. |
| PRD-100 | R32, R33, R34, R35, R36 | Subtree envelope shape, depth bounds (default 3, max 8), `truncated` flag, depth-first pre-order, oversize-subtree error mapping. |
| PRD-100 | R37, R38, R39, R40 | NDJSON index format (one entry per line, no outer wrapper), NDJSON MIME parameter, `search_url_template` `{query}` placeholder presence, `marketing:*` band annotation. |
| PRD-100 | R41, R42, R43, R44, R45, R46, R47 | Error envelope shape on runtime 4xx/5xx, closed `error.code` enum, `error.details` open structure, file extension `.act.json` for static, provisional MIME types per resource, versioned-trees layout note. |
| PRD-101 | R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R12, R13 | Well-known path `/.well-known/act.json` presence, MIME parameter `profile=static\|runtime`, `/llms.txt` link reference (warning if absent), HTML `<link rel="act">` presence, runtime-only `Link` header on every authenticated response, MIME `profile` closed enum, consumer-side discovery algorithm (the validator IS a consumer; it follows R8), discovery-context-vs-`delivery` consistency, mounts longest-prefix matching, cross-origin trust warning. |
| PRD-102 | R1, R2, R3, R4, R5, R6 through R11 | Block-shape rules per type: `markdown`, `prose`, `code`, `data`, `callout`, `marketing:*` (hero, feature-grid, pricing-table, testimonial, faq); required fields, enum constraints, `marketing:*` regex. |
| PRD-102 | R12, R13, R14, R15, R16, R17 | `summary_source` enum, `summary` required and non-empty, `abstract` shape, `content` required at Core. |
| PRD-102 | R18, R19, R20 | `related` array shape, `relation` open enum, `related`-cycle tolerance with consumer-side cycle detection. |
| PRD-102 | R21, R22, R23 | Component-contract `metadata.extracted_via` markers, `marketing:placeholder` block on extraction failure, `extraction_status` partial/failed values. |
| PRD-102 | R24, R25, R26, R27, R28 | `content` order preservation, `children`-cycle hard error, summary length warning at 100 tokens, abstract length warning outside 80–200, body-token warning at 10000. |
| PRD-102 | R29, R30, R31, R32 | Variant ID grammar `{base_id}@{variant_key}`, base node existence requirement, `metadata.variant` shape, variant `related` direction tolerance. |
| PRD-103 | R1, R2, R3, R4, R6, R7, R8, R10, R11, R12 | `etag` required on every envelope, value-shape regex, `s256:` v0.1 admit-list, static derivation re-deriveable from canonical bytes, runtime determinism via two consecutive identical requests, `If-None-Match` honored with 304, no `W/` prefix on HTTP `ETag`, subtree etag shape, NDJSON line etag shape. |
| PRD-104 | R1 through R16 | `locales` block presence on multi-locale Plus producers, BCP-47 regex, `default` is in `available`, Pattern 1 vs Pattern 2 detection, `manifest_url_template` `{locale}` placeholder, `translation_status` closed enum, no `null` for missing translations, `metadata.translations` shape, locale-variant ID convention. |
| PRD-105 | R1 through R8, R10, R12, R13, R14, R15, R17 | Static manifest at `/.well-known/act.json`, index URL reachable, no runtime-only fields on a static manifest, every index-listed node ID has a reachable file, subtree files for advertised IDs, NDJSON index reachable, `Content-Type` per resource, `If-None-Match`/304 honored, no body mutation (canonical-bytes byte-equality on re-fetch), CORS header presence, build-time guarantees not directly probable but error/warning emission tested via fixtures, mounts hierarchy. |
| PRD-106 | R1 through R34 | Runtime endpoint set per level, `act_version` on every JSON body, `If-None-Match`/304, `ETag` header, 401 with `WWW-Authenticate` per scheme, status-code mapping, auth scheme advertisement order, OAuth `authorization_endpoint`/`token_endpoint`/`scopes_supported`, API-key `Authorization: Bearer`, anonymous public access, runtime `Cache-Control`/`Vary`, ID URL-encoding consistency, per-tenant ID stability across two probes, `mounts` validation (no recursion, longest-prefix, no overlaps, cross-origin trust), runtime-only `Link` header on every authenticated response, manifest `delivery: "runtime"`, error envelope shape, closed `error.code` enum, runtime status-code-to-code mapping, subtree at Standard, NDJSON at Plus, search at Plus (template only — body deferred per Q13), per-locale endpoints at Plus. |
| PRD-107 | R1 through R22 | `conformance.level` closed enum, `delivery` closed enum, level/profile orthogonality, mount-level overrides, Core/Standard/Plus required-field sets, additivity, capability-flag-vs-level rule, **and the reporter output shape itself (R16–R22)**, which PRD-600 emits. |
| PRD-109 | R1, R3, R4, R5, R10, R11, R13, R14, R15, R16, R17, R18, R20, R21, R23 | No identity-correlated tokens in IDs (heuristic — flag well-known shapes like email-like, JWT-like), 404 collapses unauthorized + nonexistent, 401 with `WWW-Authenticate`, level/auth orthogonality, runtime ID stability, per-tenant scoping, no PII in `error.message`, no PII in `error.details`, ETag opacity (length and structure), no request-local data in ETag input, subtree depth bound, MAJOR-mismatch bounded-time rejection, cross-origin mount trust evaluation, well-known path discloses ACT support (informational, not a finding). |

The table above is exhaustive at the time of PRD-600 entering In review. When a new requirement lands in any 100-series PRD via a MINOR bump, PRD-600 MUST add the corresponding check before that PRD's bumped revision is considered fully implementable.

### Normative requirements

#### Envelope validation surface

**PRD-600-R1.** PRD-600 MUST validate every JSON envelope (manifest, index, NDJSON-index line, node, subtree, error) against the JSON Schema files at `schemas/100/*.schema.json`. The schemas are authoritative per PRD-100-R0; PRD-600 MUST NOT carry a parallel inline schema that could drift. **(Core)**

**PRD-600-R2.** When schema validation fails, PRD-600 MUST emit a `gaps` entry citing the source PRD-100 requirement (e.g., `PRD-100-R4` for a missing manifest-required field), with `missing` set to a human-readable description that includes the JSON Pointer of the failing path. **(Core)**

**PRD-600-R3.** Cross-cutting rules not expressible in JSON Schema MUST be checked separately. Specifically: cycle detection in the `children` graph (PRD-100-R25), runtime ID stability across two probes (PRD-100-R15, PRD-106-R16), `mounts` no-recursion (PRD-106-R18), `mounts` no-overlapping-prefixes (PRD-106-R20), `Content-Type` byte-string parity with the envelope contract (PRD-105-R8), HTTP `ETag` header byte-equality with the envelope's `etag` field (PRD-103-R5, PRD-103-R8), and the discovery-context-vs-`delivery` consistency rule (PRD-101-R12). **(Core)**

**PRD-600-R4.** PRD-600 MUST tolerate unknown optional fields per PRD-108-R7. Unknown fields MUST NOT cause a `gaps` entry; they MAY produce a `warnings` entry tagged `code: "unknown-field"` when the field name does not match any documented-open enum. **(Core)**

**PRD-600-R5.** PRD-600 MUST treat any value of a closed enum (`conformance.level`, `delivery`, `error.code`, `summary_source` is open per PRD-102-R12, NDJSON `profile` parameter) outside the documented set as a hard validation error and emit a `gaps` entry citing the relevant PRD requirement. **(Core)**

#### ETag derivation and stability

**PRD-600-R6.** PRD-600 MUST validate the `etag` field's value-shape per PRD-103-R2 (regex `^[a-z0-9]+:[A-Za-z0-9_-]+$`) and per PRD-103-R3 (v0.1 admit-list `^s256:[A-Za-z0-9_-]{22}$`). A value outside the admit-list MUST emit a `gaps` entry citing PRD-103-R3. **(Core)**

**PRD-600-R7.** When a positive fixture under `fixtures/103/positive/` records the canonical-JCS-bytes input alongside the expected `etag` value, PRD-600 MUST re-derive the `etag` (JCS-canonicalize the input, SHA-256, base64url no padding, truncate to 22 chars, prepend `s256:`) and assert byte-for-byte equality with the fixture's recorded value. A mismatch MUST emit a `gaps` entry citing PRD-103-R4 (static) or PRD-103-R6 (runtime). **(Core)**

**PRD-600-R8.** PRD-600 MUST implement an ETag determinism prober for runtime targets per PRD-103-R7. The prober issues two consecutive identical requests against the same node URL within a 100ms window, with the same `Authorization` (or `Cookie`) credential, and asserts that the two responses' `etag` field values are byte-identical when the response payloads (envelope minus `etag`) are byte-identical. When payloads differ, the prober tolerates the change and emits no finding (the underlying content materially changed); when payloads are byte-identical and `etag` differs, the prober MUST emit a `gaps` entry citing PRD-103-R7. **(Core)**

**PRD-600-R9.** PRD-600 MUST validate that runtime 200 responses carry the HTTP `ETag` header with byte-equality (modulo the RFC 9110 §8.8.3 double-quoting) to the envelope's `etag` field, and that the `ETag` header value MUST NOT carry the `W/` weak prefix. Mismatches MUST emit a `gaps` entry citing PRD-103-R5 (static) or PRD-103-R10 / PRD-106-R4 (runtime). **(Core)**

**PRD-600-R10.** PRD-600 MUST validate that runtime servers honor `If-None-Match` per PRD-103-R8 and PRD-106-R3 by issuing a follow-up request with `If-None-Match: "<etag-from-prior-200>"` and asserting `304 Not Modified` with no body and the same `ETag` header. A producer that returns `200` with a body when the ETag matches MUST emit a `gaps` entry citing PRD-103-R8. **(Core)**

#### Discovery walk

**PRD-600-R11.** PRD-600 MUST implement the consumer discovery algorithm specified in PRD-101-R8. Specifically, given a base URL or origin, the validator follows steps 1–5 of PRD-101-R8 in order, stopping at the first step that yields a manifest URL. The validator MUST apply PRD-101-R12 (discovery-context-vs-`delivery` consistency) on the resolved manifest, MUST apply PRD-101-R10 (longest-prefix `mounts` matching) when the manifest declares `mounts`, and MUST evaluate cross-origin trust per PRD-101-R11 / PRD-109-R21 when a mount targets a different origin. **(Core)**

**PRD-600-R12.** Reserved (formerly: per-tenant ID stability prober — folded into PRD-600-R8 above). R12 reserved post-merge of an earlier per-tenant ID-stability probe into R8's ETag determinism probe; kept as a placeholder so requirement IDs remain stable if revived.

**PRD-600-R13.** PRD-600 MUST detect cycles in the `children` graph (PRD-100-R25, PRD-102-R25) by traversing every node's transitive `children` set and asserting termination. A cycle MUST emit a `gaps` entry citing PRD-100-R25 (or PRD-102-R25 for the same constraint as restated in the block PRD). **(Core)**

**PRD-600-R14.** PRD-600 MUST validate the ID grammar (PRD-100-R10, regex `^[a-z0-9]([a-z0-9._\-]|/)*[a-z0-9]$`) for every ID-bearing field: node `id`, `parent`, every entry of `children[]`, every entry of `related[]`'s `id` sub-field (per PRD-102-R18), the manifest's `root_id`. A non-conforming ID MUST emit a `gaps` entry citing PRD-100-R10. **(Core)**

**PRD-600-R15.** PRD-600 MUST validate subtree depth (PRD-100-R33: default 3, max 8) and emit a `gaps` entry when a subtree response carries `depth > 8`. PRD-600 MUST also assert that `nodes[]` is depth-first pre-order with the root first (PRD-100-R35). **(Core)**

#### Reporter assembly (anchored to PRD-107-R16 through R22)

**PRD-600-R16.** PRD-600 MUST emit a JSON object with at least the fields specified by PRD-107-R16: `act_version`, `url`, `declared`, `achieved`, `gaps`, `warnings`, `passed_at`. The validator MAY add additional envelope-level fields (e.g., `validator_version`, `target` for non-URL inputs, `walk_summary`) per PRD-107's `additionalProperties` allowance, but MUST NOT remove or rename the seven PRD-107-required fields. **(Core)**

**PRD-600-R17.** The `declared` field MUST be populated from the manifest's `conformance.level` and `delivery` values. When the manifest is unreachable or unparseable, `declared.level` and `declared.delivery` MUST both be `null` and the reporter MUST emit a `gaps` entry citing PRD-107-R17. **(Core)**

**PRD-600-R18.** The `achieved` field MUST be populated by **probing**, not by trusting the manifest's `conformance.level`. PRD-600 MUST attempt every Core check; if every Core check passes, `achieved.level` is at least `"core"`. PRD-600 MUST then attempt every Standard check; if every Standard check passes, `achieved.level` is `"standard"`. PRD-600 MUST then attempt every Plus check; if every Plus check passes, `achieved.level` is `"plus"`. When Core checks fail, `achieved.level` MUST be `null`. The `achieved.delivery` value MUST be the profile under which the validator probed (the resolved manifest's `delivery` field, after the discovery-context-vs-`delivery` consistency check). **(Core)**

**PRD-600-R19.** Each entry of `gaps` MUST carry `level` (the band at which the gap matters), `requirement` (the source PRD R-ID, matching `^PRD-[0-9]{3}-R[0-9]+[a-z]?$`), and `missing` (a human-readable description of what was probed and what was found). PRD-600 MUST emit at least one `gaps` entry for every declared-but-not-achieved level (PRD-107-R19). **(Core)**

**PRD-600-R20.** Each entry of `warnings` MUST carry `level`, `code`, `message`. Warnings MUST NOT cause `achieved` to differ from `declared` (PRD-107-R20). The `code` field is a documented-open enum; v0.1 well-known codes include `summary-length`, `body-tokens`, `unknown-field`, `cors-blocked`, `cross-origin-mount`, `search-body-deferred`, `cdn-stripped-etag`, `auth-probe-skipped`. **(Core)**

**PRD-600-R21.** The `passed_at` field MUST be an RFC 3339 timestamp at which the reporter completed its probe (PRD-107-R21). **(Core)**

**PRD-600-R22.** A producer that declares a level it does not meet is **not** a wire-format error per PRD-107-R22. PRD-600 MUST report `declared.level` and `achieved.level` separately and MUST NOT alter the manifest's claim. A consumer of the report SHOULD treat the producer as effectively at `achieved.level` for minimum-level negotiation purposes. **(Core)**

#### Limitations: CORS and search-body envelope

**PRD-600-R23.** PRD-600's hosted client-side SPA cannot fetch from origins that block CORS preflight or that deny `Access-Control-Allow-Origin: *` (or that do not allow the SPA's origin). When a fetch fails for CORS reasons, the SPA MUST surface the failure as a `warnings` entry with `code: "cors-blocked"` AND a UI-level remediation banner directing the author to the **direct-paste fallback** (paste manifest JSON / node JSON / index JSON into the SPA's textarea). The SPA MUST NOT silently report "unreachable" without surfacing CORS as the likely cause. The README and the CLI's `--help` MUST document the CORS limitation prominently per Q8. **(Core)**

**PRD-600-R24.** PRD-600 v0.1 does NOT validate the search response **body** against any normative schema. It validates only that (a) the manifest's `search_url_template` is present and contains `{query}` (per PRD-100-R39 / PRD-107-R10), and (b) when probed with a sample query, the endpoint returns HTTP 200 with a body that parses as JSON. PRD-600 MUST emit, for every conformance report whose target advertises `search_url_template`, a `warnings` entry with `code: "search-body-deferred"` and `message` of: `"search response body envelope is deferred to v0.2 per Q13; PRD-600 v0.1 validates only template presence and that the endpoint returns 200 JSON. The body's shape is not asserted."` This warning MUST appear regardless of whether other Plus checks pass, because the limitation is structural to v0.1. The CLI's `--conformance` output MUST render this warning prominently; the SPA MUST render it adjacent to the Plus-level verdict. **(Core)**

#### Programmatic API surface

**PRD-600-R25.** PRD-600's TypeScript library MUST export the following functions from its package entry point:

- `validateManifest(input: string | object, options?: ValidateOptions): ValidationResult` — validates a manifest envelope.
- `validateNode(input: string | object, options?: ValidateOptions): ValidationResult` — validates a single node envelope.
- `validateIndex(input: string | object, options?: ValidateOptions): ValidationResult` — validates a JSON index envelope.
- `validateNdjsonIndex(input: string, options?: ValidateOptions): ValidationResult` — validates an NDJSON index file.
- `validateSubtree(input: string | object, options?: ValidateOptions): ValidationResult` — validates a subtree envelope.
- `validateError(input: string | object, options?: ValidateOptions): ValidationResult` — validates an error envelope.
- `validateSite(url: string, options?: ValidateSiteOptions): Promise<ConformanceReport>` — performs a full discovery walk + report assembly.

`ValidationResult` is the per-envelope check shape (errors + warnings, no `declared`/`achieved`); `ConformanceReport` is the full PRD-107-R16 shape. The Wire format / interface section below pins both. **(Core)**

#### CLI surface

**PRD-600-R26.** PRD-600's CLI binary MUST be named `act-validate` and MUST accept the following flags:

- `--url <url>` — target a live deployment (triggers discovery walk).
- `--file <path>` — target a single envelope file on disk.
- `--conformance` — emit the full PRD-107-shaped conformance report (only valid with `--url`).
- `--level <core|standard|plus>` — assert a minimum level; non-zero exit if `achieved` is below.
- `--profile <static|runtime>` — assert a delivery profile; non-zero exit on mismatch.
- `--probe-auth` — when probing a runtime origin that requires auth, exercise the 401 + `WWW-Authenticate` contract (PRD-106-R5 / R8 / PRD-109-R5). Without this flag, the validator skips auth-protected endpoints with a `warnings` entry coded `auth-probe-skipped`.
- `--ignore-warning <code>` — suppress a specific warning code (repeatable).
- `--strict-warnings` — exit non-zero on any warning (default: warnings do not fail the exit).
- `--max-requests <N>` — cap total HTTP requests during a site walk (default 64; see PRD-600-R33).
- `--sample <N|all>` — node-sample size for the site walk (default 16; `all` walks every index entry).
- `--json` — emit the report as JSON to stdout (machine-readable; required for CI consumption).
- `--verbose` — emit human-readable debug output to stderr.
- `--version` — print the bundled `act_version` and validator package version, exit 0.
- `--help` — print usage, exit 0.

The CLI MUST treat `--file` as mutually exclusive with `--url`; supplying both MUST exit 2 with an argv error. **(Core)**

**PRD-600-R27.** The CLI's exit codes and output formats MUST be:

- **Exit 0** — pass. All checks passed, no errors, and (in lenient mode) any warnings are non-blocking. In `--strict-warnings` mode, exit 0 only when the `warnings` array is empty.
- **Exit 1** — validation errors. The `gaps` array is non-empty.
- **Exit 2** — invocation error (bad argv, network unreachable, file unreadable). This is distinct from a validation failure.
- **Exit 3** — under `--level` or `--profile` assertion, target's `achieved.level` is below the requested level OR `achieved.delivery` does not match the requested profile.

Output formats:

- Default: human-readable, color-coded (TTY-detection), with per-gap PRD R-ID citations.
- `--json`: a single JSON object on stdout matching the `ConformanceReport` shape (PRD-107-R16). Stderr remains free for `--verbose` debug output.

The CLI's `--help` output MUST document the CORS limitation (PRD-600-R23) and the search-body limitation (PRD-600-R24) verbatim. **(Core)**

#### Hosted SPA operational contract

**PRD-600-R28.** The hosted SPA MUST be served from the path `/validator/` on the spec project's GitHub Pages site (the canonical domain is set by Q10; today the `act-spec.org` target is unregistered, so the SPA URL is `https://<gh-pages-host>/validator/` until DNS lands). The SPA is fully client-side: no backend requests other than the user-driven probe to the target manifest URL. The SPA MUST display, in its footer or sidebar:

- the bundled `act_version` (the spec version the SPA validates against),
- the validator package version,
- the SPA build timestamp,
- a permalink to PRD-600 in the spec repo.

**(Core)**

**PRD-600-R29.** The SPA MUST display a top-banner notice when the spec repo's `master` branch has changed since the SPA's build timestamp. The check is a one-time fetch of a stable JSON file (e.g., `https://<gh-pages-host>/spec-version.json`) on SPA load; the banner reads "The ACT spec has been updated since this validator was built. Refresh to load the latest, or rebuild from source for guaranteed parity." This protects authors who keep the SPA tab open across spec MINOR bumps. **(Core)**

#### Test fixtures

**PRD-600-R30.** PRD-600's test corpus MUST consume every existing fixture under `fixtures/100/`, `fixtures/101/`, `fixtures/102/`, `fixtures/103/`, `fixtures/104/`, `fixtures/105/`, `fixtures/106/`, and `fixtures/109/` as its primary unit-test corpus. Positive fixtures MUST validate clean (zero `gaps`); negative fixtures MUST produce at least one `gaps` entry citing the PRD requirement called out in the fixture's filename or sidecar. PRD-600's own additional fixtures, under `fixtures/600/`, cover end-to-end discovery walks and SPA / CLI flag combinations the per-PRD fixtures do not exercise. **(Core)**

#### Output-shape anchoring and request budget

**PRD-600-R31.** The reporter's JSON output MUST validate against the schema fragment in PRD-107's "Conformance reporter output (JSON Schema fragment)" section. PRD-600 MUST NOT emit a report whose top-level shape diverges from that schema. Adding envelope-level fields permitted by PRD-107's `additionalProperties` is allowed; renaming or removing a PRD-107-required field is not. **(Core)**

**PRD-600-R32.** PRD-600's auth probe (`--probe-auth`) MUST be scoped to the 401 + `WWW-Authenticate` contract (PRD-106-R5 / R8 / PRD-109-R5). PRD-600 MUST NOT attempt to authenticate (no token submission, no OAuth flow, no API-key submission) — the probe asserts only that an unauthenticated request returns 401 with the correctly-shaped challenge. Authenticated probing is the responsibility of an operator running the CLI with their own credential and PRD-600's `validateSite` accepting a pre-built `fetch` adapter (per the Implementation notes section). PRD-600 MUST NOT log credentials supplied via a custom fetch. **(Core)**

**PRD-600-R33.** PRD-600's request budget MUST default to 64 total HTTP requests per `validateSite` invocation and MUST default to no more than 1 request per second per origin. The defaults are overridable via `--max-requests` and `--rate-limit` (the latter accepts a per-second rate). Exceeding the budget MUST terminate the walk with a `warnings` entry coded `request-budget-exceeded` and the partial report rendered with whatever data was collected (`achieved.level: null` if Core checks did not complete). **(Core)**

### Wire format / interface definition

PRD-600's "wire format" is its programmatic TypeScript API plus its CLI argv plus its JSON output (the conformance report). The conformance report's shape is owned by PRD-107; this section pins the TypeScript API.

#### TypeScript API (excerpt — full types in `@act/validator`)

```ts
// The seven envelope check entry points.
export interface ValidateOptions {
  /** When true, schema warnings are upgraded to errors. */
  strictWarnings?: boolean;
  /** Suppress these warning codes. */
  ignoreWarnings?: string[];
  /** Pin the validator to an explicit act_version; defaults to bundled. */
  actVersion?: string;
}

export interface ValidationResult {
  ok: boolean;                 // false if errors[] is non-empty
  errors: ValidationError[];   // citing PRD-NNN-Rn
  warnings: ValidationWarning[];
}

export interface ValidationError {
  requirement: string;         // "PRD-100-R10"
  pointer: string;             // RFC 6901 JSON Pointer, e.g. "/nodes/0/id"
  missing: string;             // human-readable
}

export interface ValidationWarning {
  code: string;                // documented-open enum, see PRD-600-R20
  pointer?: string;
  message: string;
}

export function validateManifest(input: string | object, opts?: ValidateOptions): ValidationResult;
export function validateNode(input: string | object, opts?: ValidateOptions): ValidationResult;
export function validateIndex(input: string | object, opts?: ValidateOptions): ValidationResult;
export function validateNdjsonIndex(input: string, opts?: ValidateOptions): ValidationResult;
export function validateSubtree(input: string | object, opts?: ValidateOptions): ValidationResult;
export function validateError(input: string | object, opts?: ValidateOptions): ValidationResult;

// The full discovery-walk + reporter entry point.
export interface ValidateSiteOptions extends ValidateOptions {
  /** Custom fetch adapter (e.g., to inject Authorization). */
  fetch?: typeof globalThis.fetch;
  /** Total request cap; default 64. */
  maxRequests?: number;
  /** Per-origin rate limit (requests/sec); default 1. */
  rateLimit?: number;
  /** Sample N nodes from the index ('all' for full walk); default 16. */
  sample?: number | 'all';
  /** Probe 401/WWW-Authenticate without authenticating. */
  probeAuth?: boolean;
  /** Required minimum level; non-conformant target lowers exit code in CLI. */
  minLevel?: 'core' | 'standard' | 'plus';
  /** Required delivery profile. */
  expectProfile?: 'static' | 'runtime';
}

export interface ConformanceReport {
  act_version: string;
  url: string;
  declared: { level: 'core' | 'standard' | 'plus' | null; delivery: 'static' | 'runtime' | null };
  achieved: { level: 'core' | 'standard' | 'plus' | null; delivery: 'static' | 'runtime' | null };
  gaps: Array<{ level: 'core' | 'standard' | 'plus'; requirement: string; missing: string }>;
  warnings: Array<{ level: 'core' | 'standard' | 'plus'; code: string; message: string }>;
  passed_at: string; // RFC 3339
  // Optional, PRD-600 envelope-level extensions (per PRD-107 additionalProperties allowance):
  validator_version?: string;
  walk_summary?: {
    requests_made: number;
    nodes_sampled: number;
    sample_strategy: 'random' | 'all' | 'first-n';
    elapsed_ms: number;
  };
}

export function validateSite(url: string, opts?: ValidateSiteOptions): Promise<ConformanceReport>;
```

The package's authoritative type definitions ship at `packages/validator/src/index.ts`; the excerpts above are the public surface PRD-600 pins normatively. Any breaking change to these signatures is MAJOR per PRD-108-R5(2).

### Errors

PRD-600 itself does not run as a server; it has no HTTP error envelope. The error surface is:

| Condition | Outcome | Notes |
|---|---|---|
| Schema validation fails on an envelope | Reporter `gaps` entry citing the source PRD-100-Rn / PRD-102-Rn / etc. | Per PRD-600-R2. |
| Network timeout during a site walk | `warnings` entry coded `network-timeout`; partial report; `achieved.level: null` if Core not reached | Per PRD-600-R33. |
| CORS blocks a SPA fetch | `warnings` entry coded `cors-blocked`; SPA UI prompts direct-paste | Per PRD-600-R23. |
| Producer declares Plus and `search_url_template` is unreachable | `gaps` entry citing PRD-107-R10 | Standard-or-lower achievement; `achieved.level` is `"standard"` (or below). |
| Producer advertises `search_url_template` and endpoint returns 200 JSON | `warnings` entry coded `search-body-deferred` | Per PRD-600-R24. The body shape is not asserted in v0.1. |
| Cross-origin mount on a different registrable domain | `warnings` entry coded `cross-origin-mount` | Per PRD-101-R11 / PRD-109-R21. Validator follows the mount per origin-trust rules and warns. |
| Auth probe without `--probe-auth` | `warnings` entry coded `auth-probe-skipped` | Validator skips auth-protected endpoints by default per PRD-600-R32. |
| ETag determinism violation (two identical requests, identical payload, different ETag) | `gaps` entry citing PRD-103-R7 | Per PRD-600-R8. |
| Invocation error (bad argv, file unreadable) | CLI exit 2, stderr message | Per PRD-600-R27. |

---

## Examples

Examples are non-normative but MUST be consistent with the Specification section.

### Example 1 — CLI conformance report against a Standard static site

```
$ act-validate --url https://acme.example --conformance --json
```

```json
{
  "act_version": "0.1",
  "url": "https://acme.example/.well-known/act.json",
  "declared": { "level": "standard", "delivery": "static" },
  "achieved": { "level": "standard", "delivery": "static" },
  "gaps": [],
  "warnings": [
    {
      "level": "standard",
      "code": "summary-length",
      "message": "Node 'pricing/enterprise' has summary length 132 tokens; PRD-100-R20 SHOULD ≤ 50; warning threshold is 100."
    }
  ],
  "passed_at": "2026-05-01T12:00:00Z",
  "validator_version": "0.1.0",
  "walk_summary": { "requests_made": 19, "nodes_sampled": 16, "sample_strategy": "random", "elapsed_ms": 2410 }
}
```

Exit 0 (lenient mode). Maps to PRD-107 Example 6 in shape.

### Example 2 — CLI report when declared > achieved

```
$ act-validate --url https://example.com --conformance
```

```
ACT Validator 0.1.0  (act_version 0.1)
Target: https://example.com/.well-known/act.json
Declared:  standard / static
Achieved:  core      / static
Gaps:
  [standard] PRD-107-R8: subtree endpoint absent; GET /act/sub/intro.json returned 404 with no body.
Warnings:
  (none)
PASSED AT: 2026-05-01T12:01:00Z
```

Exit 1 (gaps non-empty). Maps to PRD-107 Example 5.

### Example 3 — Plus producer with search-body-deferred warning

```
$ act-validate --url https://acme-workspace.example --conformance --probe-auth --json
```

```json
{
  "act_version": "0.1",
  "url": "https://acme-workspace.example/.well-known/act.json",
  "declared": { "level": "plus", "delivery": "runtime" },
  "achieved": { "level": "plus", "delivery": "runtime" },
  "gaps": [],
  "warnings": [
    {
      "level": "plus",
      "code": "search-body-deferred",
      "message": "search response body envelope is deferred to v0.2 per Q13; PRD-600 v0.1 validates only template presence and that the endpoint returns 200 JSON. The body's shape is not asserted."
    }
  ],
  "passed_at": "2026-05-01T12:02:00Z"
}
```

Exit 0. PRD-600-R24 in action.

### Example 4 — SPA paste-mode after CORS failure

User pastes `https://locked-cors.example` into the SPA URL input. The SPA's fetch fails with a CORS error. The SPA renders:

```
[!] Cross-Origin Restriction
This origin denied the validator's fetch (CORS). Without a backend, the
hosted validator cannot bypass CORS.

Try one of:
  • Run `act-validate --url https://locked-cors.example` from your terminal
    (CLI is not subject to CORS).
  • Paste your manifest JSON directly into the textarea below to validate
    the envelope shape only (no live endpoint probing).

[textarea: Paste manifest JSON here ...]
```

PRD-600-R23 in action.

### Example 5 — Programmatic API: validateSite with a custom fetch (auth)

```ts
import { validateSite } from '@act/validator';

const report = await validateSite('https://app.acme.example', {
  // Custom fetch injects the user's Bearer token; the validator NEVER logs it.
  fetch: (url, init) => globalThis.fetch(url, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${process.env.ACME_TOKEN}` },
  }),
  minLevel: 'standard',
  expectProfile: 'runtime',
  probeAuth: false,  // We're already authenticated; skip the unauth probe.
});

if (report.achieved.level !== 'plus' && report.achieved.level !== 'standard') {
  throw new Error(`Expected at least Standard, got ${report.achieved.level}`);
}
```

### Example 6 — `validateNode` on an in-memory envelope

```ts
import { validateNode } from '@act/validator';

const node = JSON.parse(await fs.readFile('./build/act/n/intro.json', 'utf-8'));
const result = validateNode(node);

if (!result.ok) {
  for (const err of result.errors) {
    console.error(`${err.requirement} at ${err.pointer}: ${err.missing}`);
  }
  process.exit(1);
}
```

---

## Test fixtures

PRD-600's fixture corpus is **the union of all 100-series PRD fixtures** plus PRD-600-specific end-to-end fixtures.

### Foundational corpus (consumed, not authored, by PRD-600)

PRD-600 MUST consume every fixture under:

- `fixtures/100/positive/`, `fixtures/100/negative/` — envelope shape coverage.
- `fixtures/101/positive/`, `fixtures/101/negative/` — discovery flow coverage.
- `fixtures/102/positive/`, `fixtures/102/negative/` — block-shape coverage.
- `fixtures/103/positive/`, `fixtures/103/negative/` — etag value-shape and derivation.
- `fixtures/104/positive/`, `fixtures/104/negative/` — locales coverage.
- `fixtures/105/positive/`, `fixtures/105/negative/` — static-profile file-set coverage.
- `fixtures/106/positive/`, `fixtures/106/negative/` — runtime-profile coverage.
- `fixtures/109/positive/`, `fixtures/109/negative/` — security-rule coverage.
- `fixtures/107/positive/`, `fixtures/107/negative/` (when authored under PRD-107's enumeration) — minimum-conformant and broken-conformance manifests per level.

For each fixture, the validator's expected output is:

- **Positive** → `gaps.length === 0` and the fixture's declared band's checks all pass.
- **Negative** → `gaps[]` includes an entry citing the requirement called out in the fixture's filename or sidecar `_negative_reason`.

### PRD-600-specific corpus

#### Positive

- `fixtures/600/positive/discovery-walk-static-core.json` — a recorded full discovery walk against a static Core site (manifest, index, 16 sampled nodes, all reachable, all schema-valid). Expected report: `declared.level: "core"`, `achieved.level: "core"`, no gaps, no warnings.
- `fixtures/600/positive/discovery-walk-runtime-plus.json` — recorded walk against a runtime Plus site (with auth probe), exercising NDJSON index, search template (with `search-body-deferred` warning emitted per PRD-600-R24), subtree, mounts. Expected report: `achieved.level: "plus"`, `warnings: [{code: "search-body-deferred", ...}]`.
- `fixtures/600/positive/hybrid-mounts-walk.json` — recorded walk against the canonical hybrid (apex static + `app.acme` runtime) per PRD-101 Example 3, exercising longest-prefix matching and cross-origin-trust evaluation.
- `fixtures/600/positive/etag-redoer-derivation.json` — fixture that bundles a node payload, the canonical-JCS-bytes input, and the expected `s256:...` value. The validator recomputes per PRD-600-R7 and asserts byte-equality.
- `fixtures/600/positive/cli-json-output-shape.json` — sample CLI `--json` output; consumers of the report (downstream CI integrations) MUST validate against this shape.

#### Negative

- `fixtures/600/negative/declared-plus-achieved-standard.json` — recorded walk against a target that declares Plus but lacks a reachable NDJSON index. Expected: `declared.level: "plus"`, `achieved.level: "standard"`, gap citing PRD-107-R10.
- `fixtures/600/negative/etag-determinism-violation.json` — recorded pair of consecutive identical requests where the producer mixed a request ID into the etag input. Expected: gap citing PRD-103-R7.
- `fixtures/600/negative/runtime-no-link-header.json` — runtime-only origin missing the `Link: rel="act"` header on an authenticated 200 response. Expected: gap citing PRD-101-R5 / PRD-106-R23.
- `fixtures/600/negative/cors-blocked-spa.json` — a recorded SPA paste-mode session where a fetch failed for CORS. Expected: warning coded `cors-blocked`, no fetch-derived gaps, partial report restricted to the pasted JSON.
- `fixtures/600/negative/cycles-in-children.json` — node envelope whose `children` set contains a cycle. Expected: gap citing PRD-100-R25.
- `fixtures/600/negative/mounts-overlapping-prefix.json` — manifest with two `mounts[]` entries whose `prefix` values overlap. Expected: gap citing PRD-106-R20.
- `fixtures/600/negative/mismatched-delivery-static-runtime.json` — manifest declares `delivery: "runtime"` but is reachable unauthenticated at `/.well-known/act.json`. Expected: gap citing PRD-101-R12.
- `fixtures/600/negative/cli-bad-argv.txt` — CLI invocation transcript with both `--url` and `--file`. Expected: exit 2, stderr message.
- `fixtures/600/negative/strict-warnings-summary-length.json` — Standard target with a 132-token summary; under `--strict-warnings`, exit 1 (warnings as errors).

---

## Versioning & compatibility

Per PRD-108, classify each kind of change to PRD-600.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a new check that probes a newly-added 100-series MINOR field | MINOR | The new check is additive; existing producers remain conformant against the old check set. The validator's bundled `act_version` bumps in step. |
| Add a new envelope-level field to `ConformanceReport` (e.g., `walk_summary.cdn_vendor`) | MINOR | PRD-107's `additionalProperties` allowance covers this; downstream consumers tolerate per PRD-108-R7. |
| Rename a field on `ConformanceReport` that PRD-107 requires (e.g., `gaps` → `findings`) | MAJOR | Requires a coordinated PRD-107 amendment; downstream tools parse the JSON. |
| Add a flag to the CLI (e.g., `--report-format html`) | MINOR | Additive; existing invocations unaffected. |
| Rename or remove a CLI flag | MAJOR | CI scripts depend on the argv. |
| Change the default `--sample` from 16 to a different number | MAJOR | Two CI runs against the same producer would yield non-deterministic differences; observable behavior change. |
| Change the default `--strict-warnings` posture | MAJOR | Same reason. |
| Add a new well-known warning `code` value | MINOR | The `code` enum is documented-open per PRD-600-R20. |
| Change the SPA path from `/validator/` to a different path | MAJOR | Bookmarks and external documentation depend on the URL. |
| Drop the bundled v0.1 spec version from the SPA (e.g., bump SPA to validate against 0.2 only) | MAJOR | SPA users targeting 0.1 producers would see false-negative gaps. The SPA SHOULD support multi-version validation by `?act_version=0.1`; absent that, dropping v0.1 is MAJOR. |
| Tighten an existing warning to an error (e.g., `summary-length` becomes a hard gap) | MAJOR | Producers passing today fail tomorrow. |
| Loosen an existing error to a warning | MAJOR | Per PRD-108-R5(3); loosening MUST → SHOULD is MAJOR. |
| Editorial revision (typo, prose clarification) with no normative change | n/a | Per 000-governance R18. |

### Forward compatibility

PRD-600 MUST tolerate unknown optional fields per PRD-108-R7 in every envelope it validates. A consumer parsing PRD-600's JSON output MUST tolerate unknown envelope-level fields PRD-600 may emit (e.g., a future `walk_summary.cdn_vendor`).

A target producer ahead of the validator's bundled `act_version` (e.g., target advertises `act_version: "0.2"` while the SPA was built against 0.1) MUST cause the validator to emit a top-level `warnings` entry coded `version-mismatch` and proceed with best-effort validation against the bundled rules. Hard rejection on version mismatch would defeat the SPA's "paste-and-go" UX for forward-leaning producers.

### Backward compatibility

A target producer behind the validator's bundled `act_version` (e.g., target on 0.1, SPA bundled with 0.2) MUST validate against the rules of the lower version. The validator's schema bundle MUST retain prior-version schemas for at least one full MAJOR cycle per PRD-108-R12.

The CLI's argv surface MUST remain stable across MINORs of PRD-600 (additive only).

---

## Security considerations

PRD-109 owns the project-wide threat model. PRD-600 imports and notes the following deltas specific to a tool that probes third-party origins.

- **Probing third-party origins.** The validator issues HTTP requests against URLs supplied by its operator. It is the operator's responsibility to have authorization to probe; PRD-600 imposes no consent check. The default request budget (PRD-600-R33: 64 requests, 1 req/sec/origin) is set conservatively to avoid producer-side rate-limit retaliation. Operators running large audits SHOULD coordinate with target operators per the PRD-800 (crawler) guidance once that PRD lands.
- **Auth probe scope.** PRD-600-R32 forbids the validator from authenticating on its own. The `--probe-auth` flag exercises only the unauthenticated 401 path (PRD-106-R5 / R8). Authenticated probing is a deliberate operator action via the programmatic API's custom-fetch hook (Example 5). The validator MUST NOT log credentials supplied via the custom fetch — implementation-level requirement enforced via code review and a unit test that asserts no credential bytes appear in any log sink.
- **Hosted SPA threat surface.** The SPA is a static site served from GitHub Pages; it has no backend, no database, no server-side execution. Its only network surface is the user-driven probe. Risks are bounded by the browser's same-origin policy and CORS (PRD-600-R23). The SPA MUST NOT submit pasted user content (potentially proprietary manifests) to any third-party endpoint; all parsing is in-browser. The SPA's deploy pipeline (GitHub Actions) MUST sign artifacts in the standard GitHub Pages way; supply-chain integrity is GitHub's responsibility.
- **Cross-origin mount trust.** When the validator follows a cross-origin mount, it forwards trust evaluation to PRD-101-R11 / PRD-109-R21. The default behavior is to follow same-registrable-domain mounts and warn on different-registrable-domain mounts. Operators MAY override via a future `--no-cross-origin-mounts` flag (deferred; not v0.1).
- **Information disclosure via warnings/gaps.** Reporter messages MUST NOT echo response bodies verbatim (a malicious target could embed PII or secrets in a `summary` field hoping the validator would log it). PRD-600's reporter MUST truncate quoted content to short, structural snippets (e.g., "id field is uppercase") and SHOULD NOT include full body excerpts. Cross-reference PRD-109-R14 / R15.
- **DoS via hostile target.** A hostile target that responds with multi-gigabyte JSON bodies could exhaust validator memory. The validator SHOULD impose a per-response body cap (default 16 MiB; configurable via `--max-body-bytes`) and emit a `warnings` entry coded `body-too-large` on overflow. The MAJOR-mismatch bounded-time rejection rule (PRD-109-R20) applies here too: rejection of a target's `act_version` higher than the validator's bundled version MUST complete in O(1) memory beyond the parsed `act_version` string.
- **Existence disclosure on the SPA.** The SPA's URL form accepts `https://example.com` and probes the well-known path. A user who pastes a URL learns whether ACT is supported there. This is the same disclosure surface the well-known path itself creates (PRD-101 §Security); the SPA does not amplify it.

---

## Implementation notes

This section is required for SDK / generator / example PRDs (per docs/workflow.md Phase 3 rules). The snippets below show canonical shape, not full implementation. The first-party reference impl ships at `packages/validator/`; the snippets here reproduce the public surface.

### Snippet 1 — Public API entry point

```ts
// packages/validator/src/index.ts
export { validateManifest, validateNode, validateIndex,
         validateNdjsonIndex, validateSubtree, validateError } from './envelopes';
export { validateSite } from './walk';
export type { ValidateOptions, ValidationResult, ValidationError, ValidationWarning,
              ValidateSiteOptions, ConformanceReport } from './types';

// Bundled spec version this validator was built against.
export { ACT_VERSION } from './version';
```

### Snippet 2 — Schema bundle loader (Ajv recommended; not normative)

```ts
// packages/validator/src/schemas.ts
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import manifestSchema from '../../../schemas/100/manifest.schema.json' assert { type: 'json' };
import indexSchema   from '../../../schemas/100/index.schema.json' assert { type: 'json' };
import nodeSchema    from '../../../schemas/100/node.schema.json' assert { type: 'json' };
import subtreeSchema from '../../../schemas/100/subtree.schema.json' assert { type: 'json' };
import errorSchema   from '../../../schemas/100/error.schema.json' assert { type: 'json' };

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
ajv.addSchema(nodeSchema);  // referenced by subtree
export const validators = {
  manifest: ajv.compile(manifestSchema),
  index:    ajv.compile(indexSchema),
  node:     ajv.compile(nodeSchema),
  subtree:  ajv.compile(subtreeSchema),
  error:    ajv.compile(errorSchema),
};
```

### Snippet 3 — Reporter assembly (anchors to PRD-107-R16)

```ts
// packages/validator/src/reporter.ts
import type { ConformanceReport } from './types';
import { ACT_VERSION } from './version';

export function buildReport(input: {
  url: string;
  declared: ConformanceReport['declared'];
  achieved: ConformanceReport['achieved'];
  gaps: ConformanceReport['gaps'];
  warnings: ConformanceReport['warnings'];
  walkSummary?: ConformanceReport['walk_summary'];
}): ConformanceReport {
  return {
    act_version: ACT_VERSION,
    url: input.url,
    declared: input.declared,
    achieved: input.achieved,
    gaps: input.gaps,
    warnings: input.warnings,
    passed_at: new Date().toISOString(),
    validator_version: '0.1.0',
    walk_summary: input.walkSummary,
  };
}
```

### Snippet 4 — Discovery walk skeleton (PRD-600-R11; PRD-101-R8)

```ts
// packages/validator/src/walk.ts (excerpt)
export async function validateSite(url: string, opts: ValidateSiteOptions = {}): Promise<ConformanceReport> {
  const fetcher = opts.fetch ?? globalThis.fetch;
  const budget = new RequestBudget(opts.maxRequests ?? 64, opts.rateLimit ?? 1);

  // PRD-101-R8 step 2: fetch the well-known manifest.
  const manifestUrl = new URL('/.well-known/act.json', url).toString();
  const manifestRes = await budget.fetch(fetcher, manifestUrl);
  // ... handle 401/auth probe per PRD-600-R32 ...

  const manifest = await manifestRes.json();
  const declared = { level: manifest?.conformance?.level ?? null, delivery: manifest?.delivery ?? null };

  // PRD-101-R12: discovery-context-vs-delivery consistency.
  const contextErrors = checkDeliveryConsistency(manifestRes, declared);

  // PRD-600-R18: probe per level, in order.
  const probe = new LevelProbe({ manifest, fetcher: budget.fetch.bind(budget), opts });
  const achieved = await probe.run();

  return buildReport({
    url: manifestUrl,
    declared,
    achieved: { level: achieved.level, delivery: declared.delivery },
    gaps: [...contextErrors, ...achieved.gaps],
    warnings: [...probe.warnings, ...searchBodyDeferredWarning(manifest)],  // PRD-600-R24
    walkSummary: budget.summary(),
  });
}
```

### Snippet 5 — The mandatory search-body-deferred warning (PRD-600-R24)

```ts
// packages/validator/src/warnings/search-body-deferred.ts
import type { ConformanceReport } from '../types';

export function searchBodyDeferredWarning(manifest: any): ConformanceReport['warnings'] {
  if (!manifest?.search_url_template) return [];
  return [{
    level: 'plus',
    code: 'search-body-deferred',
    message: "search response body envelope is deferred to v0.2 per Q13; "
           + "PRD-600 v0.1 validates only template presence and that the endpoint "
           + "returns 200 JSON. The body's shape is not asserted.",
  }];
}
```

### Snippet 6 — ETag determinism prober (PRD-600-R8 / PRD-103-R7)

```ts
// packages/validator/src/probes/etag-determinism.ts
export async function probeEtagDeterminism(url: string, fetcher: typeof fetch): Promise<EtagFinding[]> {
  const a = await fetcher(url);
  const aJson = await a.json();
  const aEtag = aJson.etag;

  // Issue the second request inside a tight window per PRD-600-R8.
  await new Promise(r => setTimeout(r, 50));
  const b = await fetcher(url);
  const bJson = await b.json();
  const bEtag = bJson.etag;

  // Strip etag from each payload, JCS-canonicalize, byte-compare.
  const aBytes = jcs(stripEtag(aJson));
  const bBytes = jcs(stripEtag(bJson));

  if (aBytes === bBytes && aEtag !== bEtag) {
    return [{ requirement: 'PRD-103-R7',
              missing: 'two consecutive identical requests produced identical payloads but different etag values; recipe is non-deterministic (likely request-local data mixed in).' }];
  }
  return [];
}
```

### Snippet 7 — CLI argv parsing (PRD-600-R26)

```ts
// packages/validator/src/cli.ts (excerpt)
import { parseArgs } from 'node:util';
import { validateSite, validateManifest, validateNode } from './index';

const { values } = parseArgs({
  options: {
    url:            { type: 'string' },
    file:           { type: 'string' },
    conformance:    { type: 'boolean' },
    level:          { type: 'string' },
    profile:        { type: 'string' },
    'probe-auth':   { type: 'boolean' },
    'ignore-warning': { type: 'string', multiple: true },
    'strict-warnings': { type: 'boolean' },
    'max-requests': { type: 'string' },
    sample:         { type: 'string' },
    json:           { type: 'boolean' },
    verbose:        { type: 'boolean' },
    version:        { type: 'boolean' },
    help:           { type: 'boolean' },
  },
});

if (values.url && values.file) { stderr('--url and --file are mutually exclusive'); process.exit(2); }
// ... dispatch to validateSite or per-envelope validator; emit per --json or human-readable; exit per PRD-600-R27.
```

### Snippet 8 — SPA wiring (PRD-600-R28 / R29)

```tsx
// packages/validator-spa/src/App.tsx (excerpt)
import { validateSite, validateManifest, ACT_VERSION } from '@act/validator';

export function App() {
  const [report, setReport] = useState<ConformanceReport | null>(null);
  const [staleSpec, setStaleSpec] = useState(false);

  useEffect(() => {
    // PRD-600-R29: top-banner stale-build check.
    fetch('/spec-version.json').then(r => r.json()).then(latest => {
      if (latest.commit !== BUILD_COMMIT) setStaleSpec(true);
    });
  }, []);

  async function onProbeUrl(url: string) {
    try {
      setReport(await validateSite(url));
    } catch (e) {
      // PRD-600-R23: surface CORS as the likely cause + offer paste fallback.
      if (isCorsError(e)) showCorsPasteFallback(url);
    }
  }

  function onPasteManifest(json: string) {
    const result = validateManifest(json);
    setReport({ /* synthesize a partial ConformanceReport from the in-memory check */ });
  }

  return (
    <Layout actVersion={ACT_VERSION} buildTimestamp={BUILD_TIMESTAMP}>
      {staleSpec && <Banner>The ACT spec has been updated since this validator was built. ...</Banner>}
      {/* URL form, paste textarea, report renderer */}
    </Layout>
  );
}
```

### README sketch (PRD-600-R23 + R24 surface in plain text)

```
@act/validator — ACT v0.1 conformance validator (TS library + CLI + hosted SPA)

USAGE
  npx act-validate --url https://your-site.example --conformance
  npx act-validate --file ./build/.well-known/act.json
  Hosted SPA: https://<gh-pages-host>/validator/

LIMITATIONS (v0.1)
  • CORS — the hosted SPA cannot fetch from origins that block CORS. When this
    happens, the SPA prompts you to paste your manifest JSON directly. The CLI
    is not subject to CORS; prefer it for live audits.
  • Search body — v0.1 validates that `search_url_template` is present and the
    endpoint returns 200 JSON. The response body envelope is deferred to v0.2
    (Q13). Plus producers will see a `search-body-deferred` warning.

SEE ALSO
  prd/600-validator.md (this validator's spec)
  prd/107-conformance-levels.md (the report shape this tool emits)
```

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft. Specifies the TypeScript validator library `@act/validator`, the client-side hosted SPA at `/validator/` on GitHub Pages, and the `act-validate` CLI (with `--conformance` mode rolling in the conformance test harness per Q12). Pins the validation surface as a table covering every requirement from PRD-100, 101, 102, 103, 104, 105, 106, 107, and 109. Anchors the reporter output shape to PRD-107-R16 through PRD-107-R22 (`declared`, `achieved`, `gaps`, `warnings`, `passed_at`) and the `achieved` value is computed by probing rather than by trusting the declared level. Surfaces the CORS limitation (Q8) as a UX requirement (PRD-600-R23) and the search-body-envelope deferral (Q13) as a structural warning emitted on every Plus target (PRD-600-R24). Specifies the programmatic API (`validateManifest`, `validateNode`, `validateIndex`, `validateNdjsonIndex`, `validateSubtree`, `validateError`, `validateSite`), the CLI flag set, the exit-code mapping, the request-budget defaults (64 requests; 1 req/sec/origin), and the auth-probe scope (PRD-600 NEVER authenticates on its own — operators inject credentials via custom fetch). Reuses the entire 100-series fixture corpus as the validator's foundational test suite and adds discovery-walk and SPA / CLI-flag fixtures under `fixtures/600/`. Implementation notes provide eight short TypeScript snippets covering the public API entry, the schema bundle loader, reporter assembly, discovery walk, the search-body-deferred warning, the ETag determinism prober, CLI argv parsing, and the SPA wiring with stale-spec banner. Status set to In review. |
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review. Decisions: (1) `--sample 16` default, full walk via `--sample all` (Q1); (2) lenient warnings default, `--strict-warnings` opt-in (Q2); (3) SPA deep-linking yes for URL form, no for paste form (Q3); (4) `--watch` deferred to PRD-601 (Q4); (5) `validateSite` walks mounts recursively in one invocation (Q5). Ratified: 9-PRD validation-surface table; PRD-600-R23 CORS limitation; PRD-600-R24 mandatory `search-body-deferred` warning on every Plus target; PRD-600-R31 reporter-shape anchoring with `additionalProperties` extensions allowed; PRD-600-R32 auth-probe scope (validator never authenticates; operator injects credentials via `validateSite` `fetch` adapter); PRD-600-R33 budget defaults (64 requests, 1 req/sec/origin). Added one-line rationale note to R12 explaining the placeholder. No normative changes. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
