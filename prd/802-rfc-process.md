# PRD-802 — RFC / change-control process (external contributor flow on top of 000-governance)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

`000-governance.md` (Accepted) codifies the **internal** maintainer process: PRD lifecycle (Draft → In review → Accepted → Implemented → Deprecated), BDFL sign-off, change-control rules for Accepted PRDs, deprecation policy. It is written for the ACT spec authors — Jeremy Forsythe and any future Maintainers — who already know the conventions. It does not give an **external contributor** — a community implementer, a partner platform, an end-user with a feature request — a clear, predictable path to propose a change to ACT after v0.1 ships. Without that path, every external proposal becomes ad-hoc: a GitHub issue here, a Discussions thread there, sometimes a pull request directly against an Accepted PRD. Reviewers cannot tell which proposals are formal, contributors cannot tell where their proposal stands, and the BDFL gets pinged on every drive-by suggestion. PRD-802 is the contributor-facing surface. It does not relitigate `000-governance`'s internal lifecycle; it defines a parallel, lighter process for **external** RFCs that funnel into `000-governance` once they are substantive enough to become a PRD or an amendment.

### Goals

1. Define the **external RFC** as an artifact distinct from a PRD: lower bar to file, simpler structure, owned by the proposer, intended to surface ideas before they earn a PRD ID.
2. Mirror the PRD lifecycle for RFCs (Draft → In review → Accepted → Implemented → Deprecated) so contributors recognize the shape from `000-governance`, but fork the process at the boundary where an RFC becomes a PRD.
3. Specify reviewer roles in PRD-802 terms — BDFL is final arbiter (per `000-governance` R21); Maintainers MAY triage; Contributors MAY review and discuss but do not approve.
4. Cite PRD-108's MAJOR/MINOR rules as the trigger criteria — an RFC that proposes a MAJOR change requires a superseding PRD; an RFC that proposes a MINOR change MAY land as an in-place amendment to the existing Accepted PRD.
5. Specify the deprecation window from the contributor's standpoint: an RFC that proposes deprecation MUST give notice (per PRD-108-R12) and MUST keep the deprecated field/endpoint usable for at least one MINOR cycle.
6. Codify conflict resolution: BDFL-final per Q1 (already encoded in `000-governance` R21); PRD-802 specifies the contributor-side escalation path that lands at `000-governance` R20.
7. Heavy cross-reference to `000-governance`: PRD-802 documents the seam between external (here) and internal (`000-governance`) processes; it does NOT duplicate `000-governance`'s rules.

### Non-goals

1. Rewriting `000-governance`. PRD-802 cites `000-governance` for everything internal — lifecycle states, BDFL sign-off, change-control rules for Accepted PRDs, deprecation announcement channel.
2. Defining the wire format of RFCs as a JSON envelope. RFCs are markdown documents; PRD-802 specifies their structure and lifecycle, not a wire format.
3. Establishing a foundation, steering committee, or voting body. `000-governance` R6 prohibits those; PRD-802 inherits.
4. Specifying a tooling pipeline (an RFC tracker bot, automation around state transitions). PRD-802 is process; tooling is a downstream operational concern.
5. Reopening Q1 (governance). Q1 is decided; the BDFL model is the ground truth. PRD-802 builds on top.
6. Speaking to PRD lifecycle for already-Accepted PRDs. `000-governance` R16–R19 own that. PRD-802 only describes how an external proposal enters the queue that eventually triggers `000-governance`-internal action.
7. Defining contributor licensing or DCO. Q4 settled licensing (CC-BY-4.0 spec + Apache-2.0 code); PRD-802 cites by reference.

### Stakeholders / audience

- **Authors of:** external contributors (anyone outside the spec organization who wants to propose a change), partner platforms with RFCs to file, future Maintainers who triage incoming proposals.
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| RFC volume overwhelms BDFL bandwidth. | Medium | Medium | PRD-802-R5 (Maintainer triage) lets Maintainers move RFCs through Draft → In review without BDFL involvement. BDFL only signs off on Accepted (per `000-governance` R11 / R21). |
| Contributors confuse RFCs with PRDs and file PRD-shaped proposals against PRD-802 directly. | Medium | Low | PRD-802-R1 distinguishes the two artifacts; PRD-802-R8 specifies the seam (RFC promotes to PRD). |
| External RFC process creates an expectation that proposals will be accepted on a schedule. | Medium | Low | PRD-802-R12 explicitly states no acceptance SLA; the BDFL response window (per `000-governance` R22) is 14 days target / 30 days silence rule, which PRD-802 inherits without modification. |
| Bikeshed RFCs (rename a field, change a default value with no measurable impact) consume cycles. | High | Low | PRD-802-R7 lets Maintainers / BDFL close RFCs as `Withdrawn` with a reason; the `Withdrawn` outcome is a normal lifecycle state, not a failure. |
| RFCs proposing MAJOR changes go through the lighter RFC review and bypass the PRD discipline. | Medium | High | PRD-802-R8 forces any MAJOR-classified RFC to be promoted to a PRD before acceptance; the RFC alone cannot effect a MAJOR change. |
| Deprecation proposals from external contributors fail to give the required notice. | Low | Medium | PRD-802-R10 cites PRD-108-R12 directly; an RFC that proposes deprecation without sufficient notice is rejected at triage. |
| External contributors fork the spec under a confusable name to pressure acceptance. | Low | Low | `000-governance` R24 permits forking unconditionally; PRD-803 governs naming. PRD-802 does not address forks; the fork right is an explicit safety valve, not a failure mode. |

### Open questions

1. Should there be a periodic "RFC review meeting" (e.g., monthly) where the BDFL and Maintainers triage the RFC queue together? Tentatively no for v0.1 — `000-governance` R29 explicitly disclaims a meeting cadence; async review via GitHub Discussions remains the only required mechanism. Revisit when the project has multiple Maintainers.
2. Should RFCs be filed in the spec repo (next to PRDs) or in a separate `rfcs/` directory? Tentatively `rfcs/` with the same `NNN-slug.md` naming, separate ID space from PRDs to avoid collision; the seam (RFC → PRD) requires renumbering on promotion. Reconsider if the renumbering creates citation friction.
3. Should the RFC document template be inlined into PRD-802 or live separately as `rfcs/000-template.md`? Tentatively separate; PRD-802 specifies the structure and the lifecycle, the template specifies the file shape.

### Acceptance criteria

- [ ] Every requirement has an ID of the form `PRD-802-R{n}`.
- [ ] The seam between external (RFC) and internal (`000-governance`) processes is explicit and cited.
- [ ] The RFC lifecycle mirrors the PRD lifecycle (the same five states plus `Withdrawn`) with promotion criteria to PRD.
- [ ] PRD-108 is cited for MAJOR vs MINOR triggers.
- [ ] The deprecation window rule cites PRD-108-R12.
- [ ] Conflict resolution defers to `000-governance` R20–R23 explicitly.
- [ ] Conformance level declared per requirement.
- [ ] Versioning & compatibility table classifies kinds-of-change to PRD-802 per PRD-108.
- [ ] Security section addresses RFC-channel authenticity (impersonation in GitHub Discussions, BDFL-attribution spoofing).
- [ ] Changelog initial entry dated 2026-05-02 is present.

---

## Context & dependencies

### Depends on

- **000-governance** (Accepted): the internal lifecycle, BDFL role, change-control rules, deprecation channel. PRD-802 cites by ID for every internal-process rule and does NOT duplicate them.
- **PRD-108** (Accepted): MAJOR/MINOR classification rules; deprecation window (R12).
- **PRD-107** (Accepted): conformance levels (so RFCs proposing changes can declare which level they affect).
- **Decision Q1** (`000-decisions-needed.md`, decided 2026-04-30): BDFL model. PRD-802 inherits.
- **Decision Q4** (licensing, decided 2026-04-30): CC-BY-4.0 spec; contributors retain copyright on RFC text but grant the spec license on contribution.
- **Decision Q9** (GitHub Discussions, decided 2026-04-30): the announcement channel for RFC milestones, identical to PRD-level announcements.
- External: [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) (normative keywords); prior art from Python PEP, Rust RFC, IETF process, TC39 stage process.

### Blocks

- The `rfcs/` directory and the RFC template (operational artifacts that ship after PRD-802 reaches Accepted).
- Contributor-facing documentation (a future `CONTRIBUTING.md`, a "How to file an RFC" guide): cites PRD-802 for the normative process.

### References

- `000-governance.md` — heavily, for the internal seam.
- `000-decisions-needed.md` Q1, Q4, Q9.
- Prior art: [Rust RFC process](https://github.com/rust-lang/rfcs), [Python PEP 1](https://peps.python.org/pep-0001/), [IETF RFC 2026](https://www.rfc-editor.org/rfc/rfc2026), [TC39 stage process](https://tc39.es/process-document/). PRD-802 borrows the named-states-with-promotion-to-formal-doc pattern from Python PEP and the lower-bar-to-file pattern from Rust RFC.

---

## Specification

This is the normative section. Everything below MUST use RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) where requirements are imposed. Lowercase "must" and "should" are non-normative prose.

### Conformance level

PRD-802 governs spec **process**, not wire-format conformance. Every requirement here is **Core** in the sense of `000-governance`'s "process Core": the RFC process applies uniformly to every external contributor regardless of their target conformance level, delivery profile, or role. This PRD does not impose runtime conformance bands.

### Normative requirements

#### Artifact distinction: RFCs vs PRDs

**PRD-802-R1.** An **external RFC** ("Request for Comments" — keeping the internet-spec convention) is a markdown document filed by an external contributor proposing a change to the ACT specification. An RFC is distinct from a PRD: PRDs are normative spec artifacts owned by the spec organization (per `000-governance` R3 / R4 / R5); RFCs are proposal artifacts owned by their proposer until promoted (per R8 below). An RFC MUST NOT be cited normatively from another PRD until and unless it is promoted to a PRD.

**PRD-802-R2.** RFCs MUST live under `rfcs/` in the spec repository, named `NNN-slug.md` where `NNN` is the next available RFC ID (separate ID space from PRDs to prevent citation collision). An RFC's ID is reserved by the proposer in `rfcs/000-INDEX.md` (a sibling of `prd/000-INDEX.md`, owned by the same Maintainer / BDFL set). The first RFC accepted under PRD-802 is `RFC-001`.

**PRD-802-R3.** An RFC's structure MUST contain at least: Title, Status, Author(s) (one or more named individuals or organizations), Abstract (3–5 sentences), Motivation, Proposed change, Drawbacks, Alternatives, Backward compatibility (a one-paragraph cross-reference to PRD-108's MAJOR/MINOR classification), and Open questions. The structure mirrors a PRD's preamble but is shorter; the full PRD template applies only after promotion (R8).

#### Lifecycle

**PRD-802-R4.** An RFC's Status MUST be one of: `Draft`, `In review`, `Accepted`, `Implemented`, `Deprecated`, or `Withdrawn`. The first five mirror PRD lifecycle states from `000-governance` R7 verbatim; the sixth (`Withdrawn`) is RFC-specific and represents an RFC that the proposer or the Maintainer set has closed without acceptance. `Withdrawn` MAY be entered from any state at any time, with a one-line rationale recorded in the RFC's Changelog (R11).

**PRD-802-R5.** RFC lifecycle transitions follow `000-governance`'s per-transition checklists (R10 / R11 / R12 / R14) with these contributor-facing differences:

- **Draft → In review.** A Maintainer MAY transition an RFC from `Draft` to `In review` once the proposer signals readiness. BDFL involvement is NOT required for this transition; Maintainer triage is sufficient. (`000-governance` R10 requires Maintainer or BDFL approval for the corresponding PRD transition; PRD-802 inherits.)
- **In review → Accepted.** Per `000-governance` R11, the BDFL signs off explicitly. RFCs that propose any MAJOR change (per PRD-108-R5) cannot reach `Accepted` until promoted to a PRD per R8 below. RFCs proposing MINOR changes MAY reach `Accepted` directly.
- **Accepted → Implemented.** An Accepted MINOR RFC has been implemented when the corresponding in-place edit lands on the affected PRD (per `000-governance` R17) and the spec MINOR is bumped. The RFC's Status moves to `Implemented` automatically; no separate sign-off is required.
- **Any state → Withdrawn.** A Maintainer or the proposer MAY withdraw an RFC at any time. Withdrawn RFCs remain in the repository for historical reference; they are not deleted.

**PRD-802-R6.** An RFC's `In review` state SHOULD NOT exceed 90 days without explicit progress (a Maintainer comment, an updated draft, a BDFL response). RFCs idle past 90 days MAY be moved to `Withdrawn` by a Maintainer with a one-line rationale; the proposer MAY re-open by editing the RFC and requesting a new Maintainer transition to `In review`. This is a SHOULD-language window, not a hard timeout, in keeping with `000-governance` R22's silence-does-not-auto-resolve posture.

**PRD-802-R7.** A Maintainer or the BDFL MAY close an RFC as `Withdrawn` for any of the following reasons, recorded in the RFC's Changelog:

- The proposed change is out of scope for ACT (e.g., proposes a wire-format change unrelated to agent-readable content).
- The proposed change duplicates an existing Accepted PRD or RFC (citing the existing artifact).
- The proposed change is a bikeshed without measurable benefit (e.g., a rename with no functional impact).
- The proposer has explicitly withdrawn the RFC.
- The 90-day idle rule (R6) is invoked.

`Withdrawn` is a normal closure state, not a failure mode. RFCs that are Withdrawn MAY be re-filed under a new RFC ID with substantive changes addressing the reasons for closure.

#### The seam: RFC → PRD promotion

**PRD-802-R8.** An RFC that proposes a **MAJOR** change to any Accepted PRD (per PRD-108-R5's classification) MUST be **promoted to a PRD** before reaching `Accepted` status. Promotion means:

- A new PRD ID is reserved in `prd/000-INDEX.md` per `000-governance` Example 1's flow.
- The PRD is authored from the RFC's content per `000-template.md`, expanding the RFC's preamble into the full PRD structure (Specification, Wire format / interface, Errors, Test fixtures, Versioning & compatibility, Security considerations, Implementation notes if applicable, Changelog).
- The PRD goes through the standard `000-governance` lifecycle (R10 / R11). The originating RFC's Status moves to `Accepted` only when the corresponding PRD reaches `Accepted`; the RFC's Changelog cites the PRD ID as the artifact of its acceptance.
- If the new PRD supersedes an existing Accepted PRD, the supersession follows `000-governance` R16 / R14: old PRD → `Deprecated`, new PRD lists the old under "References / Supersedes."

**PRD-802-R9.** An RFC that proposes a **MINOR** change (per PRD-108-R4) MAY reach `Accepted` without PRD promotion. The change is implemented as an in-place edit to the affected PRD per `000-governance` R17, with the RFC ID cited in the affected PRD's Changelog entry. The RFC itself moves to `Implemented` per R5 above. The spec's `act_version` MINOR is bumped per PRD-108 in the same release.

#### Deprecation proposals

**PRD-802-R10.** An RFC that proposes deprecating an existing field, endpoint, requirement, or behavior MUST satisfy the following:

- The RFC MUST cite PRD-108-R12 (the deprecation window) and explicitly state the earliest version at which removal MAY occur (the next MAJOR from the deprecation's introduction).
- The RFC MUST cite `000-governance` R26 (the announcement channel — GitHub Discussions per Q9) and acknowledge the announcement requirement.
- The RFC MUST list (a) the affected items, (b) the rationale for deprecation, and (c) the proposed earliest removal version, mirroring `000-governance` R27.
- The RFC MUST keep the deprecated field/endpoint/behavior usable for at least one MINOR cycle from the introduction of the deprecation; removal at the same MINOR is forbidden per PRD-108-R12.

**PRD-802-R11.** A deprecation RFC follows the standard MINOR-RFC path (R9) for landing the deprecation marker in the affected PRD; the actual removal of the deprecated artifact (at the next MAJOR earliest) requires a separate, MAJOR-classified RFC + PRD per R8.

#### Conflict resolution

**PRD-802-R12.** Disagreement between the RFC's proposer and a Maintainer SHOULD be resolved by tagging the BDFL in the RFC's GitHub Discussions thread, per `000-governance` R20. The BDFL is the final arbiter per `000-governance` R21. PRD-802 imposes no separate appeal path. There is no acceptance SLA; the BDFL response target is 14 days, with the 30-day silence rule from `000-governance` R22 applying unchanged. RFCs that exceed the silence window do NOT auto-accept and do NOT auto-reject; they remain in their current state and the proposer MAY re-tag.

**PRD-802-R13.** When a Maintainer and the BDFL disagree on classification of an RFC's proposed change as MAJOR vs MINOR, the conservative-default rule from `000-governance` R19 applies: presumption is MAJOR, requiring promotion per R8. The Maintainer MAY argue for MINOR; the BDFL's classification is final per `000-governance` R21.

#### Reviewer roles

**PRD-802-R14.** Reviewer roles for an RFC, mapped to `000-governance` R1–R5:

- **Proposer (R4 Contributor).** Owns the RFC document. Writes drafts; responds to comments; updates the document; MAY withdraw.
- **Maintainer (R3).** MAY review and approve RFCs at the In review stage; MAY transition Draft → In review, In review → Withdrawn; MAY merge editorial edits per R17. MUST NOT transition In review → Accepted without BDFL sign-off.
- **BDFL (R1).** Final approver of all `Accepted` transitions per `000-governance` R11 / R21. MAY delegate review to a Maintainer per R2 but signs off on acceptance explicitly.
- **Other Contributors (R4).** MAY comment, suggest changes, propose alternatives. Hold no acceptance authority.

**PRD-802-R15.** RFC reviewers MUST be named in the RFC's "Reviewers required" line at the time of the Draft → In review transition, mirroring `000-governance` R5 / R10. The BDFL is always implicitly required for any RFC that proposes a MAJOR change (since acceptance is gated by R8). For MINOR-only RFCs, a single Maintainer reviewer is sufficient if BDFL delegates per `000-governance` R2.

#### Cadence

**PRD-802-R16.** RFC review is asynchronous, mirroring `000-governance` R29. No formal meeting cadence is required for v0.1. The BDFL's quarterly status update (per `000-governance` R30) SHOULD include the RFC queue summary alongside the PRD queue summary; this is a SHOULD on the BDFL, not a MUST.

### Wire format / interface definition

_Not applicable — non-wire-format PRD; rules are policy, not protocol._

### Errors

_Not applicable — process PRD; failures surface as RFC closures (`Withdrawn`) with a recorded rationale, not as wire-format errors. The closure rationales enumerated in R7 are the authoritative list of process-level "errors."_

---

## Examples

### Example 1 — A MINOR RFC that lands as an in-place amendment

A community contributor (`@alice`) notices that PRD-103 does not explicitly say what `Cache-Control` directive a runtime producer SHOULD send for tenant-shared content. They file `RFC-007: Recommend Cache-Control: public, max-age=300 for tenant-shared runtime content`.

1. Alice authors `rfcs/007-cache-control-tenant-shared.md` per the structure in R3.
2. Alice sets Status to `Draft`, opens a GitHub Discussions thread, requests transition to `In review`.
3. A Maintainer reviews. The proposed change is additive (a new SHOULD on the producer side) — classified MINOR per PRD-108-R4(7) (loosening producer obligation, additive guidance).
4. Maintainer transitions RFC-007 to `In review`. BDFL Jeremy reviews within 14 days, approves.
5. Status moves to `Accepted` (R5). A pull request edits PRD-103 in place per `000-governance` R17, citing RFC-007 in PRD-103's Changelog. The spec's `act_version` MINOR is bumped (e.g., `0.1` → `0.2`) in the same release.
6. RFC-007's Status moves to `Implemented`.

### Example 2 — A MAJOR RFC that promotes to a PRD

A partner platform proposes a fundamental change: replace the closed `error.code` enum with an open enum to accommodate platform-specific error codes. They file `RFC-014`.

1. Partner author drafts `rfcs/014-open-error-code-enum.md`.
2. Maintainer reviews. The proposal is classified MAJOR per PRD-108-R5(4) (changing a closed enum to open is a semantic change).
3. Per R8, the RFC cannot reach `Accepted` directly. The Maintainer + BDFL recommend promotion.
4. A new PRD ID is reserved: PRD-150 — "Open error-code enum (supersedes PRD-100 §error)." The PRD is authored from RFC-014's content per `000-template.md`.
5. PRD-150 follows `000-governance` R10 / R11. On acceptance, PRD-100's affected requirements are deprecated; PRD-150 lists PRD-100 under "Supersedes."
6. RFC-014's Status moves to `Accepted`, citing PRD-150 as the artifact. A future `act_version` MAJOR (`1.0`) ships PRD-150's open enum; the closed enum remains valid through the deprecation window per PRD-108-R12.

### Example 3 — A deprecation RFC

A contributor proposes deprecating the `policy.contact` field (hypothetical example) on the grounds that it duplicates the manifest's `site.contact_url`. They file `RFC-022`.

Per R10:

- RFC-022 cites PRD-108-R12 and proposes earliest removal at `1.0`.
- RFC-022 acknowledges the GitHub Discussions announcement requirement.
- RFC-022 lists the affected item (`policy.contact`), the rationale (duplication), and the earliest removal version (`1.0`).
- RFC-022 keeps `policy.contact` valid through the rest of the `0.x` cycle.

The deprecation marker lands as a MINOR amendment (R9 / R11) at `act_version 0.3`. The actual removal of the field, when the spec reaches `1.0`, requires a separate MAJOR RFC and PRD per R11.

### Example 4 — A withdrawn RFC

A contributor files `RFC-031: Rename act_version to spec_version`. The Maintainer triages: the change is MAJOR (rename of required field per PRD-108-R5(1)) but provides no functional benefit. The Maintainer marks RFC-031 `Withdrawn` with rationale "bikeshed without measurable benefit" per R7. The RFC remains in the repository for historical reference.

### Example 5 — A conflict escalation

A Maintainer thinks a proposed change is MINOR; the BDFL believes it is MAJOR. Per R13, the conservative-default rule applies and the change is treated as MAJOR (promotion to PRD per R8). The Maintainer's argument is recorded in the RFC's Discussions thread; the BDFL's classification is final per `000-governance` R21. RFC's Changelog gains an entry per `000-governance` R23.

---

## Test fixtures

_Not applicable — process PRD; conformance is procedural, not testable via wire-format fixtures. Compliance with PRD-802 is checked by reviewers against the per-state checklist (mirroring `000-governance`'s checklists), not by an automated validator. A future PRD-set linter MAY validate the RFC document structure (R3) against a JSON Schema, but no fixtures are required for v0.1._

---

## Versioning & compatibility

| Kind of change to PRD-802 | MAJOR/MINOR | Notes |
|---|---|---|
| Add a new lifecycle state (e.g., `Provisional`) | MAJOR | Changes the state machine that contributors and Maintainers rely on. |
| Add a new closure rationale to R7 | MINOR | Additive; existing rationales remain valid. |
| Change the seam between RFC and PRD (e.g., let MAJOR RFCs accept without PRD promotion) | MAJOR | Reverses R8; existing process expectations break. |
| Change the deprecation-notice rule (R10) to require less than one MINOR cycle | MAJOR | Loosens a MUST. Cite PRD-108-R5(3). |
| Tighten the Maintainer-only Draft → In review transition (R5) to require BDFL involvement | MAJOR | Removes a Maintainer prerogative. |
| Add an additional reviewer role (e.g., `Champion`) | MAJOR | Changes who has authority. |
| Change the recommended idle window (R6, 90 days) | MINOR | Recommendation, not a hard timeout; tuning is additive. |
| Add a new optional, non-blocking advisory step (e.g., "Maintainer SHOULD post weekly RFC digest") | MINOR | Additive guidance. |
| Loosen R10's deprecation-window-in-RFC-text MUST to a SHOULD | MAJOR | Per PRD-108-R5(3). |
| Editorial revision (typo, prose clarification) without normative change | n/a | Per `000-governance` R18. |

### Forward compatibility

RFCs filed under an earlier MINOR of PRD-802 remain valid under later MINORs. New requirements (e.g., a new optional section in R3's RFC structure) apply prospectively to RFCs filed after the change.

### Backward compatibility

Within a MAJOR, an RFC that reached `Accepted` under an earlier MINOR remains Accepted; new requirements do not retroactively invalidate past acceptances. The seam in R8 is stable across MINORs: if R8 changes, it is MAJOR per the table above.

---

## Security considerations

- **RFC-channel authenticity.** The GitHub Discussions thread for an RFC is the primary discussion surface. Impersonation of the BDFL or a Maintainer in that thread (e.g., a comment claiming "BDFL approves" without the actual BDFL account) is an attack on the process. PRD-802-R12 requires the BDFL sign-off be explicit; a Maintainer or contributor MUST verify the BDFL's GitHub account identity before treating any sign-off as binding. MFA on the BDFL's and Maintainers' GitHub accounts is recommended (per `000-governance` §Security considerations) but out of scope for this PRD's normative text.
- **BDFL-attribution spoofing.** A contributor who edits the RFC's Changelog to claim BDFL approval without the actual BDFL acting is a Changelog-tampering attack. Reviewers MUST verify that Changelog entries claiming BDFL sign-off correspond to actual BDFL comments / commits / PR approvals on GitHub.
- **Contributor licensing.** Per Q4 (decided 2026-04-30), spec text is CC-BY-4.0. Contributors who file an RFC implicitly grant the CC-BY-4.0 license on the RFC's text on contribution; this is the same posture as PRD authoring. Contributors who do not wish to grant CC-BY-4.0 MUST NOT file RFCs into the spec repository; they MAY discuss in GitHub Discussions without filing a formal RFC artifact.
- **Withdrawn RFCs as historical record.** RFCs marked `Withdrawn` (R7) are not deleted. A withdrawn RFC's content remains visible. Contributors who do not want their proposals preserved publicly SHOULD discuss in the Discussions channel before filing an RFC; once filed, the RFC is part of the spec repository's history.
- **Sensitive content in RFCs.** Contributors MUST NOT include security-sensitive content (zero-day disclosures, credentials, internal infrastructure) in an RFC. The RFC-as-public-artifact model is incompatible with embargoed disclosure. Embargoed security issues SHOULD use the project's security-disclosure channel (when established) rather than the RFC process. This requirement is informational at v0.1 since no separate security-disclosure channel exists; PRD-109 ownership of project-wide security posture applies.

PRD-802 introduces no new wire-format threat surface; the security posture is downstream of `000-governance`'s process-security note and PRD-109's project-wide threat catalog.

---

## Implementation notes

_Not applicable — non-implementation PRD._

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-02 | Jeremy Forsythe | Initial draft. Defines the external-contributor RFC process as a parallel artifact track to internal PRDs: lower bar to file, mirrored lifecycle (Draft → In review → Accepted → Implemented → Deprecated, plus Withdrawn), a documented seam where MAJOR RFCs promote to PRDs (R8) and MINOR RFCs land as in-place amendments (R9). Cites `000-governance` heavily for the internal seam (BDFL final arbiter per R21; deprecation channel per R26; lifecycle states per R7). Cites PRD-108 for MAJOR/MINOR triggers and the deprecation window. Maintainers MAY triage Draft → In review and Withdrawn closures without BDFL involvement; BDFL signs off on Accepted explicitly. No acceptance SLA; 90-day idle SHOULD-language for In review. Status: Draft → In review. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
