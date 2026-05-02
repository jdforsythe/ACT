# PRD-108 — Versioning policy (semver of `act_version`, MAJOR/MINOR rules)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

The v0.1 draft (`docs/plan/v0.1-draft.md` §4 and §5.3) declares an `act_version` string on every envelope but never defines the semantics of bumping it. Without a written policy, every other PRD has to guess whether adding a field, narrowing a SHOULD, or removing an endpoint counts as a MAJOR or MINOR change. Worse, consumer behavior on version mismatch is undefined: a consumer that implements `0.1` cannot safely decide what to do when it receives a `0.2` or `1.0` document. Gap A2 in `000-gaps-and-resolutions.md` flags this as Tier-A foundational; nothing downstream can stabilize without it. Adapter authors (decision Q5, 2026-04-30) are particularly exposed — until this PRD lands they must pin to a single spec version, which forces a coordinated release across the entire 200-series for every spec bump.

### Goals

1. Define the syntactic shape of `act_version` (a `MAJOR.MINOR` string, no PATCH, regex-validated, required at envelope root).
2. Enumerate the kinds of changes that constitute a MINOR bump versus a MAJOR bump, exhaustively enough that a PRD reviewer can classify any proposed change without escalation.
3. Specify consumer behavior on version match, MINOR mismatch, and MAJOR mismatch, including the rejection rule for higher-MAJOR responses.
4. Specify producer behavior on receiving requests or input bearing unknown required fields and on the prohibition of silent MAJOR downgrade.
5. Define the deprecation window for fields, endpoints, and behaviors removed across MAJOR boundaries.
6. Codify the staged adapter pinning rule from decision Q5 — pinned during v0.1, MAJOR-pinned / MINOR-floating once this PRD reaches Accepted and PRD-200 cites it.
7. Provide a test fixture matrix that PRD-600 (validator) can use to mechanically check whether a proposed cross-version diff is a valid MINOR bump.

### Non-goals

1. Defining the wire format itself — that is PRD-100.
2. Defining conformance levels — that is PRD-107. (Versioning rules apply at all conformance levels; level transitions are not version transitions.)
3. Defining the RFC / change-control process — that is PRD-802 working from `000-governance`.
4. Defining the deprecation announcement channel — that is `000-governance`. This PRD references the channel by forward reference only.
5. Defining a PATCH version. PATCH is intentionally absent from `act_version`; spec-text editorial revisions do not bump the wire version. (See Open questions.)
6. Specifying error-envelope shape on version-rejection — error shape comes from gap A4 (PRD-100 / PRD-106). This PRD specifies the rejection rule, not the wire format of the rejection response.

### Stakeholders / audience

- **Authors of:** every other PRD in this set. PRD-108 is a P0 foundation; every PRD must read its Specification section to fill in its own "Versioning & compatibility" section.
- **Reviewers required:** Jeremy Forsythe (BDFL, per decision Q1).

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Classification ambiguity — a proposed change is genuinely on the boundary between MINOR and MAJOR | Medium | Medium | The test-fixture matrix below is exhaustive for v0.1 categories. Boundary cases escalate to BDFL review per `000-governance`. |
| Producers silently downgrade MAJOR to keep older clients working | Medium | High (security and confusion) | PRD-108-R10 makes silent downgrade a MUST NOT; PRD-600 (validator) flags any producer that returns a lower-MAJOR response than the requested `act_version`. |
| Adapter ecosystem churn from MINOR bumps if MAJOR-pinned / MINOR-floating misfires | Low | Medium | PRD-108-R14 stages the transition: adapters stay pinned (Q5 default) until PRD-200 explicitly cites this PRD's ratified rules. |
| `act_version` higher-MAJOR rejection becomes a denial-of-service vector if a hostile server claims `act_version: "999.0"` | Low | Low–Medium | Consumers reject and stop processing; rejection is fast and bounded. Note in Security considerations. |
| The MINOR/MAJOR table omits a category that surfaces during P1 PRD authoring | Medium | Low | Treat the table as living for v0.1; amendments to PRD-108 itself follow PRD-108's own rules (recursive application, see Versioning & compatibility section). |

### Open questions

1. Does PATCH ever make sense for editorial-only spec text revisions (typo fixes, clarifications that change no normative requirement)? Today PATCH is absent. Revisit in v0.2 review; if introduced, PATCH MUST never appear in `act_version` on the wire — it would only number spec-text revisions in `000-INDEX.md`.
2. Should consumers expose the MINOR-mismatch warning through a structured signal (header, log key) rather than free-form? Deferred to PRD-500 / PRD-600 review.

### Acceptance criteria

- [ ] Every MUST in this PRD has at least one row in the test-fixture matrix.
- [ ] The test-fixture matrix covers at minimum: add optional field, add optional endpoint, add to open enum, add to closed enum, tighten SHOULD→MUST, rename required field, remove endpoint, loosen MUST→SHOULD.
- [ ] The worked `0.1 → 0.2` example narrates at least 3 MINOR-accepted changes plus 1 MAJOR-rejected change.
- [ ] Cross-references to PRD-107 (conformance) and `000-governance` (deprecation channel) resolve once those PRDs reach Accepted.
- [ ] Recursive self-application: a future change to this PRD's Specification can be classified MINOR vs MAJOR using the rules it defines.
- [ ] The adapter pinning subsection (R14) cites decision Q5 by ID and matches the staged rule recorded in `000-decisions-needed.md`.

---

## Context & dependencies

### Depends on

- None. PRD-108 is foundational — it has no spec-internal dependencies. It is authored in P0 alongside PRD-107 (conformance) and `000-governance`.
- External: [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) for normative keyword semantics. [Semantic Versioning 2.0.0](https://semver.org/) as inspiration; this PRD is semver-*shaped* but explicitly omits PATCH and adds wire-format rules semver does not specify.

### Blocks

This PRD blocks every PRD that ships an envelope or otherwise carries an `act_version` value, plus every PRD whose authoring requires classifying changes:

- 100-series spec PRDs: PRD-100, PRD-101, PRD-102, PRD-103, PRD-104, PRD-105, PRD-106, PRD-109. (PRD-107 is also P0 but does not depend on PRD-108; the two are siblings.)
- 200-series adapter PRDs (entire range), via decision Q5: PRD-200 §Versioning encodes both the v0.1 pinned state and the post-ratification MAJOR-pinned / MINOR-floating state defined here. PRDs 201–208 inherit.
- PRD-802 (RFC / change-control process): PRD-802 specifies the procedural side of bumps; this PRD specifies the technical classification.
- `000-governance` (change-control rules): governance describes the deprecation announcement channel; this PRD's R12 (deprecation window) refers to that channel by forward reference.

### References

- v0.1 draft: §4 (table entry "`act_version` field at every level"), §5.3 (`act_version: "0.1"` in manifest), §5.5 (node envelope), §1923–§1927 (existing JSON Schema fragment for `act_version`).
- Gap analysis: `000-gaps-and-resolutions.md` §A2 ("Versioning policy is hand-waved"). This PRD codifies the proposed resolution there verbatim with the additions required by Q5.
- Decision context: `000-decisions-needed.md` §Q5 (adapter pinning, decided 2026-04-30).
- Prior art: [Semantic Versioning 2.0.0](https://semver.org/), [RFC 9110 §15.5.6](https://www.rfc-editor.org/rfc/rfc9110#name-not-acceptable) (a precedent for content-version negotiation), JSON Schema Draft 2020-12's own MINOR-bump policy.

---

## Specification

This is the normative section. Everything below MUST use RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) where requirements are imposed. Lowercase "must" and "should" are non-normative prose.

### Conformance level

Versioning is not optional. Every ACT producer and consumer, regardless of conformance level (Core / Standard / Plus, per PRD-107), MUST satisfy the requirements in this PRD that apply to them.

- **Core:** PRD-108-R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R12, R13, R15. (Field shape, classification rules, consumer rules, producer rules, deprecation window.)
- **Standard:** No additional requirements specific to Standard. (Inherits all Core.)
- **Plus:** No additional requirements specific to Plus. (Inherits all Core.)
- **Adapter pinning (R14)** is normative for the 200-series adapter ecosystem rather than for envelope producers per se. It applies to every adapter at every conformance level, but is gated by PRD-200 citation per the staged rule.

### Normative requirements

#### `act_version` field shape

**PRD-108-R1.** Every ACT envelope (manifest, index, node, subtree, error) MUST include an `act_version` field at the top level of the envelope.

**PRD-108-R2.** The `act_version` field MUST be a JSON string matching the regular expression `^[0-9]+\.[0-9]+$`. Specifically: one or more ASCII digits, a single literal dot, one or more ASCII digits. No leading zeros are required (`0.1` and `00.01` are both syntactically legal, but producers SHOULD emit the canonical form without leading zeros).

**PRD-108-R3.** The `act_version` field MUST NOT include a PATCH segment, build metadata, or pre-release identifier. `0.1.0`, `0.1-beta`, `0.1+build.42` are all invalid.

#### Classification rules — MINOR bump

**PRD-108-R4.** A change to the spec is classified MINOR (the new spec version increments the right-hand integer of `act_version`, leaving MAJOR unchanged) if and only if it falls into one of these categories:

1. Adding a new optional field to an existing envelope or object.
2. Adding a new optional endpoint to a delivery profile (static or runtime).
3. Adding a value to an enum that is documented as **open** at the point of definition.
4. Adding a new content block type within a documented namespace (e.g., `marketing:cta_block` added to the `marketing:*` namespace).
5. Adding a new conformance capability that consumers MAY require but are not required to implement (e.g., a new optional capability flag).
6. Adding a new error code, provided the error-code enum is documented as open at the point of definition. (If the error-code enum is closed, adding a value is MAJOR per R5(4).)
7. Loosening a producer obligation in a way that does not break existing consumers — e.g., declaring that a previously required field is now optional, *only when* every existing consumer was already required to tolerate its absence by an existing SHOULD or MAY. Edge case; see Open questions.

#### Classification rules — MAJOR bump

**PRD-108-R5.** A change to the spec is classified MAJOR (the new spec version increments the left-hand integer of `act_version`, resetting MINOR to `0`) if it falls into any of these categories:

1. Removing or renaming a required field.
2. Changing the semantics of a required field (e.g., redefining what `etag` covers, redefining what `id` means).
3. Narrowing a SHOULD to a MUST, or loosening a MUST to a SHOULD. Both directions are MAJOR — the first breaks producers that complied with the older SHOULD by occasionally omitting the field; the second breaks consumers that depended on the field always being present.
4. Adding a value to an enum that is documented as **closed** at the point of definition.
5. Removing or repurposing a documented endpoint.
6. Changing the regex, character set, length bound, or other syntactic constraint on a required field's value.
7. Reordering the precedence of any documented procedure (e.g., changing how multi-source merging breaks ties — see PRD-200 §Multi-source).

**PRD-108-R6.** When a change could plausibly be classified under both R4 and R5, the MAJOR classification MUST win. PRD reviewers MUST NOT pick the MINOR interpretation to avoid a MAJOR bump.

#### Consumer rules

**PRD-108-R7.** Consumers MUST tolerate unknown optional fields in any envelope they receive. A consumer that rejects a response solely because it contains a field the consumer does not recognize is non-conformant.

**PRD-108-R8.** Consumers MUST reject any response whose `act_version` declares a MAJOR higher than the MAJOR the consumer implements. "Reject" means: do not parse the envelope further, do not surface partial data to the application, surface the rejection to the caller. Downgrade behavior across MAJOR boundaries is undefined — a consumer that implements `1.x` and receives `2.0` MUST NOT attempt to interpret the `2.0` payload as if it were `1.x`.

**PRD-108-R9.** Consumers SHOULD warn (log, emit telemetry, or otherwise surface to the caller) on a MINOR mismatch where the response declares a higher MINOR than the consumer implements, but MUST proceed with normal processing. The warning is informational; it allows operators to track upgrade pressure without breaking interoperability.

#### Producer rules

**PRD-108-R10.** Producers MUST reject input (e.g., an incoming JSON document submitted by a tool, an adapter input, a configuration file) that contains unknown **required** fields. Required fields are the ones the producer's `act_version` declares as required. Unknown required fields signal that the input is from a future MAJOR the producer does not understand.

**PRD-108-R11.** Producers MUST NOT silently downgrade `act_version` MAJOR. Specifically: if a consumer requests version `1.x` (via Accept header, capability negotiation, or explicit configuration) and the producer cannot serve `1.x`, the producer MUST signal the mismatch (per the error-envelope shape defined in PRD-100 / PRD-106) rather than serve `0.x` content with `act_version: "1.0"` claimed in the envelope or vice versa. Serving content of one MAJOR while claiming a different MAJOR in the envelope is a hard violation.

#### Deprecation window

**PRD-108-R12.** A field, endpoint, behavior, or enum value deprecated in spec version `M.n` MAY be removed in spec version `(M+1).0` at earliest. Removal at any version `M.k` (same MAJOR) is forbidden — removal is a MAJOR-classified change (R5(1) or R5(5)). Deprecation MUST be documented in the PRD that introduces it and announced via the channel established by `000-governance`. (Forward reference: `000-governance` is being authored in parallel; this PRD assumes its announcement channel exists.)

**PRD-108-R13.** A producer MAY continue to emit a deprecated field across multiple MINOR releases of the same MAJOR. A consumer MUST tolerate the field's continued presence (it is still in the spec until the MAJOR boundary). A consumer SHOULD NOT depend on a deprecated field for new code.

#### Adapter version pinning (Q5)

**PRD-108-R14.** Source-adapter (200-series) version-pinning policy is **staged**:

- **State 1 (current, v0.1).** Adapters MUST pin to a single `act_version` MAJOR.MINOR. Concretely: an adapter package `act-foo@0.1.x` emits `act_version: "0.1"` only. A spec MINOR bump from `0.1` to `0.2` requires a coordinated adapter MINOR release (`act-foo@0.2.x`).
- **State 2 (post-ratification).** Once **both** of the following are true — (a) this PRD-108 reaches Accepted, **and** (b) PRD-200 (adapter framework) cites this PRD-108's ratified MAJOR/MINOR rules in its §Versioning section — adapters MAY transition to MAJOR-pinned / MINOR-floating: `act-foo@1.x` works with spec `1.0` and `1.1` but not `2.0`. State 2 is permissive (MAY), not mandatory (MUST); individual adapters MAY remain MAJOR.MINOR-pinned for ecosystem-stability reasons.

**PRD-108-R15.** When an adapter operates in State 2 (MAJOR-pinned / MINOR-floating), the adapter MUST declare the spec MINORs it supports in its package manifest (specific mechanism is PRD-200's concern; this PRD requires that the declaration exist). The adapter MUST emit envelopes whose `act_version` matches a declared supported MINOR. The adapter MUST NOT emit `act_version` outside its declared support range.

R14 cross-references decision Q5 in `000-decisions-needed.md` (decided 2026-04-30) verbatim.

### Wire format / interface definition

The `act_version` field appears at the top level of every envelope. JSON Schema fragment:

```json
{
  "type": "object",
  "required": ["act_version"],
  "properties": {
    "act_version": {
      "type": "string",
      "pattern": "^[0-9]+\\.[0-9]+$",
      "description": "ACT spec version as MAJOR.MINOR. No PATCH segment. Required at envelope root. See PRD-108."
    }
  }
}
```

This fragment is incorporated by reference into every other 100-series PRD's envelope schema. It supersedes the partial fragment at v0.1 draft lines 1923–1927 once PRD-100 cites this PRD.

### Errors

_Not applicable — this PRD defines no error responses. Error envelope shape comes from gap A4 (PRD-100 / PRD-106). This PRD specifies the rejection rule (R8, R10, R11); the wire-format encoding of a rejection is normalized in PRD-100._

---

## Examples

Examples are non-normative but must be consistent with the Specification section above; PRD-600 will validate them.

### Example 1 — A minimal manifest carrying `act_version`

```json
{
  "act_version": "0.1",
  "site": "https://example.com",
  "index_url": "https://example.com/.well-known/act/index.json",
  "node_url_template": "https://example.com/act/n/{id}.json"
}
```

Satisfies PRD-108-R1 and R2.

### Example 2 — Consumer behavior on MINOR mismatch (R9)

A consumer that implements spec `0.1` receives a response with `act_version: "0.2"`. Per R9 the consumer SHOULD warn (e.g., `console.warn("ACT MINOR mismatch: server 0.2, client 0.1")`) and MUST proceed with normal processing. Unknown optional fields in the response are tolerated (R7).

### Example 3 — Consumer behavior on MAJOR mismatch (R8)

A consumer that implements spec `0.x` receives a response with `act_version: "1.0"`. Per R8 the consumer MUST reject the response without further parsing. The application sees a structured error from the consumer library; no envelope fields are surfaced to application logic.

### Worked example — hypothetical `0.1 → 0.2` diff

This narrates a plausible MINOR bump from spec `0.1` to spec `0.2`, drawing on resolutions from `000-gaps-and-resolutions.md` Tier E. Three changes are MINOR-accepted; one attempted change is correctly rejected as MAJOR.

**MINOR change A — add `summary_source` enum value to an open enum.**
Per gap E5, PRD-102 introduces `summary_source: "llm" | "author" | "extracted"` as an open enum on the node envelope. In `0.2` we add `"hybrid"` (LLM-rewrite of an authored summary) as a fourth value. R4(3) classifies this MINOR because the enum was documented as open at definition time. Older `0.1` consumers tolerate the unknown value because it sits inside an open enum (and they were obliged to be permissive there). Diff sketch:

```diff
  "summary_source": {
    "type": "string",
-   "enum": ["llm", "author", "extracted"],
+   "enum": ["llm", "author", "extracted", "hybrid"],
    "x-act-enum-policy": "open"
  }
```

**MINOR change B — add optional `auth.scopes_supported` field.**
Per gap C3 / Q3, the manifest's `auth` block in `0.2` gains an optional `scopes_supported` array describing OAuth 2.0 scopes the server accepts. R4(1) classifies adding an optional field MINOR. Older `0.1` consumers ignore it (R7).

```diff
  "auth": {
    "schemes": ["bearer", "oauth2"],
+   "scopes_supported": ["act.read"]
  }
```

**MINOR change C — add a new content block type in a documented namespace.**
Per gap E (and the v0.1 draft §5.11.3 marketing namespace), PRD-102 declares `marketing:*` as a namespace open to additions. In `0.2` we add `marketing:cta_block` (a call-to-action block carrying button labels and target URLs). R4(4) classifies adding a new block type within a documented-open namespace as MINOR. Older `0.1` consumers MUST tolerate the unknown block type (R7); they MAY render it as plain text or skip it.

```diff
  "content": [
+   { "type": "marketing:cta_block", "label": "Buy now", "href": "/checkout" }
  ]
```

**MAJOR change D — proposed but rejected: remove the `etag` field from the node envelope.**
A reviewer proposes removing `etag` from the node envelope on the grounds that runtime ETags are problematic to derive deterministically (gap C2). This change MUST be classified MAJOR per R5(1) (removing a required field) and rejected as a MINOR. `etag` is required by PRD-103 at all conformance levels for cache validation; removing it would silently break every consumer that revalidates. The change can land only at `1.0` or later, after a deprecation window starting in some `0.n` (R12) — and even then, only if the spec authors first introduce a viable alternative validator. The MINOR-vs-MAJOR rule (R6) requires that when in doubt, the MAJOR classification wins.

### Deprecation timeline example

A hypothetical deprecation walks through the full window per R12 and R13.

| Spec version | Date (illustrative) | Event |
|---|---|---|
| `0.3` | 2026-Q3 | `legacy_summary` is added as a deprecated alias for `summary`. Deprecation is documented in PRD-102's changelog and announced via the `000-governance` channel. Producers MAY emit `legacy_summary`; consumers MUST tolerate it. |
| `0.4` | 2027-Q1 (illustrative) | `legacy_summary` remains in the spec. Producers SHOULD migrate; consumers SHOULD NOT depend on it for new code (R13). |
| `0.5` | 2027-Q3 (illustrative) | Same — still deprecated, still present. |
| `1.0` | 2028 (illustrative, earliest possible) | `legacy_summary` MAY be removed. Removal is a MAJOR change (R5(1)) and MUST coincide with the MAJOR boundary. Per R12 it could not have been removed at any `0.k`. |

The table illustrates two rules at once: (1) R12's "MAY be removed in `(M+1).0` at earliest" and (2) R13's "consumers tolerate the field across the deprecation window."

---

## Test fixtures

This PRD's fixtures are illustrative for the v0.1 draft of the matrix; concrete files under `fixtures/108/` are produced as part of PRD-600's validator work and are out of scope here. The matrix below is the authoritative classification table.

### Test fixture matrix

Each row is a kind of change, its MAJOR/MINOR classification, a positive fixture (a valid example diff that the validator accepts as that classification), and a negative fixture (an invalid bump the validator catches — typically a producer claiming the wrong classification).

| Kind of change | Classification | Positive fixture (valid bump) | Negative fixture (validator rejects) |
|---|---|---|---|
| Add optional field | MINOR | Spec 0.1 → 0.2 adds `auth.scopes_supported` (optional). Diff: `+ "scopes_supported": ["act.read"]`. Validator accepts as MINOR. | Spec 0.1 → 0.1 (no version bump) adds the same field. Validator rejects: any spec change requires at least a MINOR bump. |
| Add optional endpoint | MINOR | Spec 0.1 → 0.2 adds an optional `/act/search` endpoint (capability advertised in manifest). Validator accepts as MINOR per R4(2). | Spec 0.1 → 0.2 adds the endpoint AND removes `/act/index` in the same diff. Validator rejects: combined change is MAJOR (R6 — MAJOR wins on combination). |
| Add to open enum | MINOR | Spec 0.1 → 0.2 adds `"hybrid"` to `summary_source` (open enum). Validator accepts per R4(3). | Spec 0.1 → 0.2 changes the enum policy from open to closed in the same diff. Validator rejects: tightening an open enum to closed is a semantic narrowing classified MAJOR per R5(2)/R5(3). |
| Add to closed enum | MAJOR | Spec 0.x → 1.0 adds `"rate_limited"` to a closed `error.code` enum. Diff: `enum: [..., "rate_limited"]`. Validator accepts as MAJOR per R5(4). | Spec 0.1 → 0.2 adds the same value to the closed enum. Validator rejects: MINOR bump cannot accommodate closed-enum addition. |
| Tighten SHOULD → MUST | MAJOR | Spec 0.x → 1.0 changes "Producers SHOULD send `etag`" to "Producers MUST send `etag`". Validator accepts as MAJOR per R5(3). | Spec 0.1 → 0.2 makes the same change. Validator rejects: SHOULD→MUST is MAJOR even though it tightens. |
| Loosen MUST → SHOULD | MAJOR | Spec 0.x → 1.0 changes "Producers MUST send `etag`" to "Producers SHOULD send `etag`". Validator accepts as MAJOR per R5(3). | Spec 0.1 → 0.2 makes the same change. Validator rejects: loosening a MUST is MAJOR (existing consumers depended on the guarantee). |
| Rename required field | MAJOR | Spec 0.x → 1.0 renames `id` to `node_id`. Validator accepts as MAJOR per R5(1). | Spec 0.1 → 0.2 renames `id` to `node_id`. Validator rejects: rename of required field is MAJOR. |
| Remove endpoint | MAJOR | Spec 0.x → 1.0 removes `/act/subtree` (with a deprecation that started in 0.k). Validator accepts as MAJOR per R5(5). | Spec 0.1 → 0.2 removes `/act/subtree` directly. Validator rejects: endpoint removal must wait for MAJOR boundary AND requires prior deprecation per R12. |
| Add new content block in documented namespace | MINOR | Spec 0.1 → 0.2 adds `marketing:cta_block` to the `marketing:*` namespace. Validator accepts per R4(4). | Spec 0.1 → 0.2 adds `core:cta_block` (the `core:*` namespace is documented as closed). Validator rejects: only documented-open namespaces accept additions in MINOR. |
| Change required-field semantics | MAJOR | Spec 0.x → 1.0 redefines `etag` from "covers payload" to "covers payload + identity + tenant" (gap C2). Validator accepts as MAJOR per R5(2). | Spec 0.1 → 0.2 makes the same redefinition. Validator rejects: semantic change to required field is MAJOR. |

Real fixture files (positive `*.json` and negative `*.json` per row) live under `fixtures/108/positive/` and `fixtures/108/negative/` once PRD-600 is implemented. Each fixture is a tuple of (before-spec-snapshot, after-spec-snapshot, claimed-classification) where the validator computes the actual classification and asserts it matches.

### Positive

- `fixtures/108/positive/add-optional-field.json` → satisfies R4(1) and R9.
- `fixtures/108/positive/add-open-enum-value.json` → satisfies R4(3).
- `fixtures/108/positive/add-namespace-block.json` → satisfies R4(4).
- `fixtures/108/positive/major-rename-required-field.json` → satisfies R5(1).

### Negative

- `fixtures/108/negative/minor-claims-removed-field.json` → MUST be rejected because removing a required field requires MAJOR (R5(1)).
- `fixtures/108/negative/silent-major-downgrade.json` → MUST be rejected because the producer served `0.x` content with `act_version: "1.0"` claimed (R11).
- `fixtures/108/negative/patch-segment.json` → MUST be rejected because `act_version: "0.1.0"` violates R3.
- `fixtures/108/negative/closed-enum-addition-as-minor.json` → MUST be rejected because adding to a closed enum requires MAJOR (R5(4)).

---

## Versioning & compatibility

This PRD defines its own versioning rules; those rules apply recursively to changes to this PRD. The table below classifies kinds of change to PRD-108 itself.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a new requirement ID (e.g., R16) tagged Core that producers MUST satisfy | MAJOR | Adds a producer obligation; older producers fail validation. |
| Add a new requirement ID tagged optional / MAY | MINOR | Adds capability without obligation. |
| Tighten an existing SHOULD to MUST in this PRD | MAJOR | Per R5(3), recursively. |
| Loosen an existing MUST to SHOULD in this PRD | MAJOR | Per R5(3), recursively. |
| Add a kind-of-change row to the test-fixture matrix | MINOR | Provided the new row's classification is consistent with R4/R5 already; otherwise the underlying classification rule itself is changing, which is MAJOR. |
| Editorial revision (typo, clarification) that changes no normative requirement | Spec-text revision only | Does NOT bump `act_version`. Tracked in this PRD's Changelog and `000-INDEX.md`. See Open question #1 about a future PATCH lane. |
| Change the staged adapter pinning rule (R14) | MAJOR | Affects the adapter ecosystem's compatibility model directly. |

### Forward compatibility

Per R7 and R9, consumers tolerate unknown optional fields and proceed on MINOR mismatch. This is the primary forward-compat mechanism — the spec evolves by accretion within a MAJOR.

### Backward compatibility

Within a MAJOR, every MINOR is backward-compatible with every prior MINOR of the same MAJOR. Specifically:

- A `0.1` producer's output is valid `0.2` (older producers do not have to re-emit; consumers tolerate missing optional fields).
- A `0.2` consumer can read `0.1` output (treating absent optional fields as absent).
- A `0.2` producer's output is valid for `0.1` consumers as long as those consumers tolerate unknown optional fields per R7.

Across MAJOR boundaries, no backward compatibility is required. The deprecation window (R12) exists to give the ecosystem warning of upcoming MAJOR changes, but does not constitute a compatibility guarantee.

---

## Security considerations

Versioning policy is not itself a security boundary; this section calls out the second-order security implications.

- **Confusion / DoS via inflated MAJOR.** A hostile or buggy server could declare `act_version: "999.0"` to cause every consumer that implements `0.x` or `1.x` to reject the response per R8. This is not an information-disclosure issue (no data is parsed), but it is a denial-of-service vector if the consumer's rejection path is expensive or if the application has no fallback. Mitigation: R8 mandates that rejection happens before further parsing; consumer libraries SHOULD implement rejection as a constant-time bounded operation. Applications SHOULD treat MAJOR-rejection identically to a network error for retry / fallback purposes.
- **Silent MAJOR downgrade as confused-deputy.** If a producer were permitted to silently serve `0.x` content claiming `act_version: "1.0"`, a consumer that asked for `1.x` and trusted the version label would parse the payload under the wrong schema. R11 forbids this outright. PRD-600 (validator) MUST flag any producer whose served `act_version` differs from the producer's own declared support range.
- **MINOR-mismatch warning channel.** The R9 warning is informational; producers SHOULD NOT include sensitive material in any free-form text that consumers might log on warning. Cite PRD-109 for the project-wide PII posture.
- **Deprecation announcement spoofing.** R12 references the `000-governance` announcement channel for deprecations. PRD-802 specifies the cryptographic / authenticity expectations for that channel; this PRD does not duplicate them.

This PRD does not introduce any new auth, scoping, or injection surface. PRD-109 governs the project-wide security posture; cite that PRD for any security-sensitive interaction.

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-04-30 | Jeremy Forsythe | Initial draft per gap A2 and decision Q5. |
| 2026-05-01 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
