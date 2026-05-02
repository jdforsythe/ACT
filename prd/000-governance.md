# PRD-000 — Governance: roles, lifecycle, change control, deprecation

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

The ACT PRD set is being authored under an informal lifecycle described as prose in `000-INDEX.md` ("How to author a PRD") and an undocumented assumption that the project lead arbitrates. The status taxonomy (`Draft / In review / Accepted / Implemented / Deprecated`, with the `(spec only)` qualifier from decision Q3) appears in the index legend, but the transition rules — who approves what, what counts as "review," when a change to an Accepted PRD requires a new PRD vs. an in-place edit — are nowhere written down. Without that text, contributors cannot tell when a PRD is safe to cite from another PRD, reviewers cannot tell when their sign-off is binding, and external readers cannot tell whether ACT is one person's draft or a maintained spec. Strategic decision Q1 (decided 2026-04-30) settled the governance model — Benevolent Dictator for Life, Jeremy Forsythe — but that decision is recorded only in `000-decisions-needed.md` and has not yet been codified as normative process.

### Goals

1. Codify the BDFL governance model decided in Q1 (2026-04-30) so external readers can determine, from the spec repo alone, who has authority to accept and deprecate PRDs.
2. Make the PRD state machine unambiguous: define `Draft`, `In review`, `Accepted`, `Implemented`, `Deprecated` and the `(spec only)` qualifier with explicit pre-conditions for every transition.
3. Give contributors a clear path to propose changes — drafting, review, escalation — without requiring out-of-band knowledge.
4. Define change-control rules for Accepted PRDs that interlock with the versioning policy in PRD-108: MAJOR changes require a superseding PRD; MINOR changes MAY be in-place but MUST appear in the Changelog and bump the spec MINOR.
5. Codify the deprecation announcement venue (GitHub Discussions, per Q9) and the relationship between PRD-level deprecation and spec-level version removal windows.
6. Preempt governance debate during review by making the BDFL model explicit and disclaiming the structures the project is *not* adopting (foundation, steering committee, voting).

### Non-goals

1. This PRD does NOT establish a foundation, steering committee, or voting process. Q1 explicitly rejected those.
2. This PRD does NOT specify the wire format — that lives in the 100-series, anchored by PRD-100.
3. This PRD does NOT define the external RFC process for community-driven change proposals. That is PRD-802, which builds on this PRD's internal lifecycle.
4. This PRD does NOT define MAJOR/MINOR semantics — those live in PRD-108. This PRD references PRD-108's classification and applies it to the lifecycle.
5. This PRD does NOT define conformance level semantics for the wire format — that is PRD-107. The "Conformance level" subsection here speaks only to *process* conformance.

### Stakeholders / audience

- **Authors of:** every PRD in the ACT set. Every PRD's Status field, Changelog, and acceptance flow are governed by this document.
- **Reviewers required:** BDFL — Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| BDFL bus factor — single point of failure for acceptance | Medium | High | This PRD permits but does not require maintainer appointment (R3); the fork right is preserved (R23); a future PRD MAY transition off BDFL without violating this one (changing the model is itself a MAJOR change to this PRD per §Versioning). |
| Community frustration if the BDFL is unresponsive | Medium | Medium | R20 sets a 14-day target response and a 30-day silence rule (PRD remains in current state, no auto-acceptance); R22 records escalation outcomes in the Changelog so the pattern is visible. |
| Ambiguity about when `(spec only)` PRDs can advance to Implemented | Medium | Low | R13 makes Implemented N/A for `(spec only)` PRDs until a community port lands and the BDFL ratifies it; the qualifier is preserved through Accepted state. |
| Editorial drift — small "fix-up" edits to Accepted PRDs accumulating without traceability | Medium | Low | R17 permits editorial edits without a Changelog entry but R18 requires they be batched into a single quarterly commit. |
| Single-channel dependency on GitHub Discussions for deprecation announcements | Low | Medium | Q9 already deferred Bluesky/Mastodon to launch announcement; if Discussions becomes unavailable, a successor channel is itself a MINOR change to this PRD per §Versioning and announced in the same way. |

### Open questions

1. What triggers a transition off the BDFL model? Currently, no explicit trigger is defined; Q1's decision intentionally omitted one. Revisit if external pressure (a foundation partner, an enterprise legal blocker) or scale (multiple maintainers wanting binding votes) demands it. Changing the model is itself a MAJOR change to this PRD.
2. Should there be a maximum review window for `In review` before a PRD is auto-returned to `Draft`? Currently no — reviewers may sit on PRDs indefinitely. Likely fine while the author surface is small; revisit when contributor count grows.
3. How are maintainer appointments and removals recorded? This PRD permits maintainer appointment (R3) but does not specify the artifact. Probable answer: a `MAINTAINERS.md` at repo root, but that is out of scope until the first appointment is made.

### Acceptance criteria

- [x] Q1 decision recorded and cited.
- [ ] Every normative requirement has an ID of the form `PRD-000-R{n}`.
- [ ] State machine covers all five statuses plus the `(spec only)` qualifier.
- [ ] Per-transition checklist is present for all four transitions.
- [ ] Change-control rules interlock with PRD-108 (cited by ID; specific rules summarized).
- [ ] Deprecation announcement venue cites Q9 (GitHub Discussions).
- [ ] Conflict resolution procedure names the BDFL as final arbiter and documents the escalation path.
- [ ] No requirements assume a foundation, steering committee, or voting body.

---

## Context & dependencies

### Depends on

- **PRD-108** (Versioning policy): This PRD's change-control rules (R14–R18) cite PRD-108's MAJOR/MINOR classification. The rules summarized here — MAJOR change to an Accepted PRD requires a superseding PRD; MINOR MAY be in-place — are derived from gap A2's resolution as it will be ratified in PRD-108.
- **Decision Q1** (`000-decisions-needed.md`, decided 2026-04-30): Selected Option 1 — BDFL (Jeremy Forsythe) for the foreseeable future, with no committed transition to a foundation. Community input is advisory.
- **Decision Q3** (`000-decisions-needed.md`, decided 2026-04-30): Defines the `(spec only)` qualifier — spec text is normative but no first-party reference implementation ships in v0.1.
- **Decision Q9** (`000-decisions-needed.md`, decided 2026-04-30): Selected GitHub Discussions in the spec repo as the primary communication channel.
- External: [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174) for normative keyword usage.

### Blocks

- **PRD-802** (RFC / change-control process): codifies the external contributor flow on top of this PRD's internal lifecycle.

### References

- v0.1 draft: §10 Q1 (governance question, since decided as Q1 in `000-decisions-needed.md`).
- `000-INDEX.md` — "How to author a PRD" prose list, given normative force here.
- `000-decisions-needed.md` Q1, Q3, Q9.
- `000-gaps-and-resolutions.md` A2 (versioning policy whose change-control rules are imported by reference).
- Prior art: Python PEP process (PEP 1), Rust RFC process, IETF process (RFC 2026), TC39 stage process. ACT borrows the named-states-with-explicit-approver pattern from PEPs and the BDFL pattern from Python prior to PEP 8016.

---

## Specification

This is the normative section. Everything below MUST use RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) where requirements are imposed. Lowercase "must" and "should" are non-normative prose.

### Conformance level

Every requirement in this PRD is **Core** — the lifecycle and governance model are fundamental to the ACT project and apply uniformly to every PRD in the set.

Note: "Core" here describes *process* conformance — every implementer of the spec follows this process when authoring or modifying PRDs. It does NOT mean these requirements appear in any wire-format conformance flag. Wire-format conformance levels (Core / Standard / Plus per PRD-107) are an orthogonal concept that applies to runtime envelopes, not to authoring process.

### Normative requirements

#### Roles

**PRD-000-R1.** A single named individual, the **Benevolent Dictator For Life (BDFL)**, MUST hold final authority on PRD acceptance, change-control decisions, and conflict resolution. As of this PRD's acceptance, the BDFL is **Jeremy Forsythe**.

**PRD-000-R2.** The BDFL MAY delegate review of specific PRDs to others but MUST sign off explicitly on the state transitions `In review → Accepted` and `Implemented → Deprecated` (or `Accepted → Deprecated` where applicable per R13).

**PRD-000-R3.** The BDFL MAY appoint **Maintainers** with merge rights on the spec repository. Maintainers MAY review and approve PRDs and MAY merge editorial changes per R17, but MUST NOT mark a PRD `Accepted` without explicit BDFL sign-off. As of v0.1 there are zero appointed Maintainers; the BDFL operates solo.

**PRD-000-R4.** **Contributors** are anyone proposing changes via PRDs, issues, or pull requests. Contributors MAY draft PRDs and request review. Contributors hold no acceptance authority.

**PRD-000-R5.** **Reviewers** are named per-PRD in that PRD's "Stakeholders / audience" section under "Reviewers required." A Reviewer is named by the PRD's author and confirmed by the BDFL on the transition `Draft → In review`.

**PRD-000-R6.** This PRD MUST NOT be interpreted to establish a foundation, steering committee, voting body, or any decision authority other than the BDFL. Decision Q1 (2026-04-30) explicitly rejected those structures for v0.1.

#### Lifecycle states

**PRD-000-R7.** Every PRD MUST occupy exactly one of the following statuses at any time: `Draft`, `In review`, `Accepted`, `Implemented`, `Deprecated`.

**PRD-000-R8.** A PRD in `Draft`, `In review`, `Accepted`, or `Implemented` MAY additionally carry the qualifier `(spec only)`, written as a parenthetical suffix to the status (e.g., `Accepted (spec only)`). The qualifier means the spec text is normative but no first-party reference implementation ships in v0.1, per decision Q3. Community ports are invited.

**PRD-000-R9.** A PRD's Status MUST appear both in the PRD file's `## Status` section and in the corresponding row of `000-INDEX.md`. Both locations MUST be updated in the same change that performs a state transition.

#### Lifecycle transitions

**PRD-000-R10. (Draft → In review)** A PRD MAY move from `Draft` to `In review` when ALL of the following hold:

- The PRD's "Reviewers required" section names at least one reviewer (the BDFL is always implicitly required; additional reviewers MAY be listed).
- Every item in the PRD's "Acceptance criteria" checklist is *checkable* (the criterion is concrete enough to be evaluated). Items need not be checked off yet.
- The PRD's listed reviewers are notified, either via the GitHub Discussions thread for the PRD or via the pull request that proposes the transition.

**PRD-000-R11. (In review → Accepted)** A PRD MAY move from `In review` to `Accepted` when ALL of the following hold:

- Every item in the PRD's "Acceptance criteria" checklist is checked off.
- Every reviewer listed in "Reviewers required" has responded with either approval or an explicit "no objection."
- The BDFL has signed off explicitly (a comment, commit message, or PR approval that states acceptance).
- The PRD's Changelog has gained an entry dated to the acceptance, naming the author of the change and summarizing the PRD content as accepted.

**PRD-000-R12. (Accepted → Implemented)** A PRD MAY move from `Accepted` to `Implemented` when ALL of the following hold:

- A reference implementation in TypeScript exists (per decision Q3).
- The implementation passes the PRD's Test fixtures (where applicable; process PRDs without fixtures use this PRD's per-transition checklist as the conformance check).

**PRD-000-R13. (`(spec only)` PRDs and Implemented)** A PRD that carries the `(spec only)` qualifier MUST NOT transition to `Implemented` on the basis of a first-party reference implementation alone, because by definition none exists. Such a PRD remains `Accepted (spec only)` until a community port is contributed and the BDFL ratifies it as the de-facto reference implementation; at that point the qualifier is dropped and the PRD MAY transition to `Implemented` per R12.

**PRD-000-R14. (Implemented → Deprecated, and Accepted → Deprecated)** A PRD MAY move to `Deprecated` only when EITHER:

- A superseding PRD has reached `Accepted` status and lists this PRD under its "References / Supersedes," OR
- The BDFL records a reasoned decision in this PRD's Changelog explaining why the PRD is being deprecated without a successor (e.g., the feature it specified has been removed from scope).

In both cases, deprecation triggers the deprecation window defined by PRD-108: the deprecated requirements remain valid through the current MAJOR and MAY be removed at the next MAJOR release at earliest.

**PRD-000-R15.** Backward transitions (e.g., `In review → Draft`) MAY occur if review surfaces issues that require substantial rework. The reverting transition MUST be recorded in the Changelog with a one-line rationale. Backward transitions out of `Accepted` MUST NOT occur — once Accepted, a PRD is changed only via the change-control rules in R16–R18 below.

#### Change control

**PRD-000-R16.** An `Accepted` PRD is normatively frozen at the level of its MUST/SHOULD/MAY requirements. Any change classified as MAJOR per PRD-108's MAJOR/MINOR rules MUST be made by authoring a NEW PRD that supersedes the existing one. The old PRD's status moves to `Deprecated`; the new PRD MUST list the old PRD under "References / Supersedes."

**PRD-000-R17.** A change classified as MINOR per PRD-108 MAY be made in place to an `Accepted` (or `Implemented`) PRD, provided that ALL of the following hold:

- The PRD's Changelog gains an entry with date, author, and a one- or two-line summary of the change.
- The spec's `act_version` MINOR is bumped per PRD-108 in the same release that ships the change.
- The change is announced in the GitHub Discussions thread for the PRD (Q9 channel).

**PRD-000-R18.** Editorial changes — typo fixes, formatting, prose clarifications that do not change any MUST/MUST NOT/SHOULD/SHOULD NOT/MAY — MAY be made without a Changelog entry. Editorial changes SHOULD be batched into a single commit per quarter to preserve traceability.

**PRD-000-R19.** The classification of a change as MAJOR vs MINOR vs editorial is, in case of dispute, decided by the BDFL per the conflict-resolution rule below (R21). The default presumption when the classification is ambiguous is MAJOR — i.e., authors SHOULD prefer the more conservative path and supersede rather than edit in place.

#### Conflict resolution

**PRD-000-R20.** Reviewer disagreement that cannot be resolved among reviewers SHOULD be escalated by tagging the BDFL in the GitHub Discussions thread or pull request for the PRD.

**PRD-000-R21.** The BDFL is the final arbiter on all PRD-related decisions: acceptance, change classification, deprecation, conformance interpretation, and any disagreement on the meaning of normative text in this PRD itself.

**PRD-000-R22.** The BDFL SHOULD respond to an escalation within 14 days. If the BDFL is silent for 30 days following an escalation, the PRD remains in its current state — no auto-acceptance, no auto-rejection. The PRD's author MAY re-tag and re-escalate.

**PRD-000-R23.** Conflict-resolution decisions MUST be recorded in the affected PRD's Changelog as a dated entry naming the BDFL, summarizing the disputed issue, and stating the resolution and rationale.

**PRD-000-R24.** Contributors who disagree with a BDFL decision MAY fork the spec. This PRD does not block forking and does not impose any naming or trademark restrictions on forks beyond those that apply to derivative works under the spec's license (decided in Q4: CC-BY-4.0 for spec text). Naming-policy rules for forks are out of scope here; see PRD-803.

#### Deprecation policy

**PRD-000-R25.** A field, endpoint, or requirement deprecated in spec version `M.n` MAY be removed at `(M+1).0` at earliest, per PRD-108's deprecation window.

**PRD-000-R26.** Deprecation MUST be announced in the spec repository's GitHub Discussions channel (per Q9) at the time of the MINOR release that introduces the deprecation. The announcement MUST link to the PRD that introduces the deprecation.

**PRD-000-R27.** A PRD that introduces a deprecation MUST list (a) the affected items, (b) the rationale, and (c) the earliest removal version.

**PRD-000-R28.** Consumers SHOULD treat deprecated items as still-valid until the removal version actually ships. Producers SHOULD migrate before the next MAJOR release.

#### Cadence

**PRD-000-R29.** For v0.1, no formal review meeting cadence is required. Asynchronous review via GitHub Discussions and pull-request comments is the only required mechanism.

**PRD-000-R30.** The BDFL SHOULD post a quarterly status update to the GitHub Discussions repo channel, covering open PRDs, recent acceptances, and the deprecation timeline. This is a SHOULD, not a MUST — missing a quarter does not invalidate any acceptance or deprecation.

**PRD-000-R31.** Spec releases are event-driven, not calendar-driven: a `0.x` MINOR release ships when there are accepted MINOR changes ready and an `M.0` MAJOR release ships when accepted MAJOR changes have completed their PRD-108 deprecation window.

### Lifecycle definition

This section defines the PRD lifecycle: state machine, per-transition checklists, and an optional metadata shape that future tooling MAY lint against. It replaces the template's "Wire format / interface definition" section because this PRD has no wire surface — its artifacts are PRD documents, not JSON envelopes.

#### State diagram

```
                         (R10: reviewers notified;
                          AC checkable)
   +---------+ ----------------------------------> +-----------+
   | Draft   |                                     | In review |
   +---------+ <---------------------------------- +-----------+
        ^         (R15: backward transition;            |
        |          rationale in Changelog)              |
        |                                               | (R11: AC checked off;
        |                                               |  reviewers approved;
        |                                               |  BDFL sign-off;
        |                                               |  Changelog entry)
        |                                               v
        |                                         +-----------+
        |   (R14: superseding PRD Accepted        | Accepted  |
        |    OR BDFL reasoned decision)           +-----------+
        |                                               |
        |                                               | (R12: TS reference impl
        |                                               |  exists; passes fixtures)
        |                                               | (R13: N/A for `(spec only)`
        |                                               |  until community port +
        |                                               |  BDFL ratification)
        |                                               v
        |                                         +-------------+
        |   (R14: superseding PRD Accepted        | Implemented |
        |    OR BDFL reasoned decision)           +-------------+
        |                                               |
        |                                               | (R14: superseded
        |                                               |  or BDFL decision)
        |                                               v
        |                                         +-------------+
        +---------------------------------------- | Deprecated  |
                                                  +-------------+

    Qualifier: any of {Draft, In review, Accepted, Implemented} MAY carry
    "(spec only)" per R8. Qualifier is dropped when a community port
    lands and the BDFL ratifies it (R13).

    All transitions: BDFL is the implicit final approver (R2, R21).
    Forward arrows out of "Accepted" do not pass back through "In review";
    in-place changes follow the change-control rules R16-R19, not state
    transitions.
```

#### Per-transition checklists

**Draft → In review.** Pre-conditions:

- [ ] PRD names at least one reviewer in "Reviewers required" (BDFL is implicit).
- [ ] All "Acceptance criteria" items are written and concrete (checkable).
- [ ] PRD has a corresponding row in `000-INDEX.md` with Status `Draft`.

Required artifacts:

- [ ] GitHub Discussions thread (or PR) notifying reviewers.
- [ ] Index row updated to `In review`.
- [ ] PRD's `## Status` updated to `In review`.

**In review → Accepted.** Pre-conditions:

- [ ] All "Acceptance criteria" items checked off.
- [ ] All listed reviewers responded (approval or stated no objection).
- [ ] BDFL sign-off explicit (PR approval, comment, or commit message).
- [ ] All "Depends on" PRDs are themselves `Accepted` (or `Implemented`).

Required artifacts:

- [ ] Changelog entry dated to acceptance.
- [ ] Index row updated to `Accepted`.
- [ ] PRD's `## Status` updated to `Accepted`.

**Accepted → Implemented.** Pre-conditions (skip and remain `Accepted (spec only)` if R13 applies):

- [ ] TypeScript reference implementation merged in the implementation repo.
- [ ] Implementation passes the PRD's Test fixtures (or the per-transition checklist for process PRDs).
- [ ] Implementation version pinned to a spec `act_version` per PRD-108.

Required artifacts:

- [ ] Changelog entry naming the implementation version and date.
- [ ] Index row updated to `Implemented`.
- [ ] PRD's `## Status` updated to `Implemented`.

**Implemented → Deprecated** (and **Accepted → Deprecated**). Pre-conditions:

- [ ] Either (a) a superseding PRD has reached `Accepted` and lists this PRD under "References / Supersedes," OR (b) the BDFL has recorded a reasoned no-successor deprecation decision in the Changelog.
- [ ] The deprecating PRD (or this PRD's no-successor entry) lists affected items, rationale, and earliest removal version.

Required artifacts:

- [ ] Changelog entry dated to deprecation.
- [ ] Announcement in the GitHub Discussions channel per R26.
- [ ] Index row updated to `Deprecated`.
- [ ] PRD's `## Status` updated to `Deprecated`.

#### Optional metadata shape

Tooling (e.g., a future PRD-set linter) MAY validate per-PRD metadata against the following shape. This is non-normative for v0.1 — no PRD is required to embed machine-readable metadata; the prose `## Status` heading remains authoritative.

```json
{
  "id": "PRD-000",
  "slug": "000-governance",
  "status": "In review",
  "status_qualifier": null,
  "accepted_at": null,
  "implemented_at": null,
  "deprecated_at": null,
  "supersedes": [],
  "superseded_by": null,
  "spec_act_version_introduced": "0.1",
  "spec_act_version_removed_earliest": null
}
```

Field semantics:

- `status` — one of the five values in R7.
- `status_qualifier` — `"spec only"` per R8, or `null`.
- `accepted_at` / `implemented_at` / `deprecated_at` — ISO 8601 dates, or `null` if the transition has not yet occurred.
- `supersedes` — array of PRD IDs this PRD replaces (per R16); empty unless this PRD was authored as a superseding successor.
- `superseded_by` — PRD ID of the successor, or `null`.
- `spec_act_version_introduced` — the `act_version` in which the requirements first appear.
- `spec_act_version_removed_earliest` — the `act_version` at which deprecated items MAY be removed (per R25); `null` until deprecation.

### Conflict resolution

This PRD has no wire surface and therefore no HTTP error codes. Disputes about PRD content, classification, or transitions are governed by the conflict-resolution requirements in R20–R24 above. In summary:

- Reviewer disagreement → escalate to BDFL via GitHub Discussions thread (R20).
- BDFL is final arbiter (R21).
- BDFL target response: 14 days; silence past 30 days does not auto-resolve (R22).
- All resolutions recorded in the affected PRD's Changelog (R23).
- Forking is a permitted last resort (R24).

---

## Examples

### Example 1 — A new PRD reaches Accepted

The author of PRD-201 (Markdown / MDX adapter) follows this flow:

1. Reserves the PRD ID in `000-INDEX.md` (already done — row exists with Status `Draft`).
2. Copies `000-template.md` to `prd/201-markdown-mdx-adapter.md`.
3. Reads PRD-200 (the dependency) and the cited draft sections.
4. Drafts the PRD; lists reviewers in "Stakeholders / audience" (BDFL Jeremy Forsythe plus a Maintainer if any are appointed by the time the PRD is drafted).
5. When draft is complete, opens a PR and a GitHub Discussions thread, transitions to `In review` (R10), and notifies reviewers.
6. Addresses review comments. Once all Acceptance Criteria checkboxes are checked and all reviewers have approved, requests BDFL sign-off (R11).
7. BDFL approves; author adds a Changelog entry dated to acceptance, updates the PRD's `## Status` to `Accepted`, updates the index row to `Accepted`, and merges.
8. When a TypeScript reference implementation lands and passes the PRD's fixtures, author transitions the PRD to `Implemented` (R12) with a Changelog entry naming the implementation version.

### Example 2 — A MINOR change to an Accepted PRD

A bug surfaces in PRD-103 (Caching, ETags) after acceptance: a previously-undocumented optional field needs to be added. Per PRD-108, adding an optional field is a MINOR change.

1. Author opens a PR that:
   - Edits PRD-103 in place to document the new optional field.
   - Adds a Changelog entry to PRD-103 with the date, author, and a one-line summary (R17).
   - Bumps the spec's `act_version` MINOR per PRD-108 in the same release.
2. Author posts an announcement in the GitHub Discussions thread for PRD-103 (R17, third bullet).
3. PR is reviewed by the BDFL and merged. PRD-103 remains `Accepted` — no state transition occurs.

### Example 3 — A MAJOR change requires a successor

A breaking redesign of the manifest envelope is needed: the `act_version` field needs to be moved from the manifest root into a header object. Per PRD-108, changing the location of a required field is a MAJOR change.

1. Author reserves a new PRD ID in `000-INDEX.md` (e.g., PRD-150 — "Manifest envelope v2") with Status `Draft`.
2. Author drafts PRD-150 and lists PRD-100 (the original manifest PRD) under "References / Supersedes."
3. PRD-150 follows the normal Draft → In review → Accepted path (R10–R11).
4. On PRD-150's acceptance, PRD-100's status moves to `Deprecated` (R14, first clause). PRD-100's Changelog gains an entry naming PRD-150 as the successor.
5. The deprecation announcement goes out in GitHub Discussions per R26, listing affected items (the manifest envelope), rationale, and earliest removal version (the next MAJOR per R25).

### Example 4 — A `(spec only)` PRD remains Accepted indefinitely

PRD-503 (FastAPI runtime SDK) is marked `(spec only)` per Q3 — no first-party TypeScript reference implementation exists, and no Python implementation ships in v0.1.

1. PRD-503 follows the normal Draft → In review → Accepted path. On acceptance, its status becomes `Accepted (spec only)`.
2. The `(spec only)` qualifier persists. PRD-503 does NOT transition to `Implemented` per R13.
3. A community contributor lands a Python FastAPI implementation that passes PRD-503's fixtures.
4. The BDFL ratifies the community port as the de-facto reference implementation. The qualifier is dropped; PRD-503 transitions to `Implemented` (R12).

### Example 5 — Conflict escalation

Two reviewers disagree on whether a proposed change to PRD-104 is MAJOR or MINOR. Per R19, the conservative default is MAJOR, but the author argues MINOR.

1. Author tags the BDFL in the GitHub Discussions thread (R20).
2. BDFL responds within 14 days (R22 SHOULD), classifies the change, and posts the rationale.
3. Author adds a Changelog entry to PRD-104 recording the conflict, the BDFL's decision, and the rationale (R23).
4. Either the in-place MINOR path (R17) or the supersede-with-new-PRD MAJOR path (R16) is taken based on the classification.

---

## Test fixtures

_Not applicable — process PRD; lifecycle compliance is checked by reviewers against the per-transition checklist, not by an automated validator. A future PRD-set linter MAY validate the optional metadata shape under "Lifecycle definition," but no fixtures are required for v0.1._

---

## Versioning & compatibility

This PRD describes a process, not a wire format. Most rows of the standard versioning table do not apply. The relevant change classifications are:

| Kind of change to this PRD | MAJOR/MINOR | Notes |
|---|---|---|
| Add a new role (e.g., promote Maintainers to a binding-vote group) | MAJOR | Changes who has authority. |
| Change the BDFL identity | MAJOR | The named individual in R1 is part of the normative text. |
| Transition off the BDFL model (foundation, steering committee) | MAJOR | Reverses the explicit non-goal in §Non-goals and R6. Requires a superseding PRD per R16. |
| Add or remove a state in the lifecycle | MAJOR | Changes the state machine. |
| Change a transition's required approver | MAJOR | E.g., letting a Maintainer accept without BDFL sign-off. |
| Add an optional, non-blocking advisory step (e.g., "BDFL SHOULD post quarterly update") | MINOR | Already present as R30. Adding similar SHOULDs is MINOR. |
| Change the announcement venue (e.g., add a second channel) | MINOR | Q9's GitHub Discussions remains primary; adding a mirror is additive. |
| Tighten a SHOULD to a MUST (or vice versa) | MAJOR | Per PRD-108 default. |
| Editorial / prose clarification with no normative effect | n/a | Per R18. |

### Forward compatibility

PRDs accepted under earlier versions of this governance PRD remain Accepted under later versions; new requirements apply prospectively. If a future version of this PRD changes the per-transition checklist, PRDs already in `In review` at the time of the change MAY complete their transition under the rules in effect when they entered `In review`.

### Backward compatibility

Changing the BDFL model, the state machine, or the approver requirements is itself a MAJOR change to this PRD per the table above and MUST be enacted via a superseding PRD per R16. Forks remain permissible per R24.

---

## Security considerations

_Not applicable — process PRD; security posture is set by PRD-109. Note: governance posture itself is a soft target (social-engineering attacks against the BDFL identity, repository takeover, impersonation in GitHub Discussions). MFA on the BDFL's GitHub account and on any appointed Maintainer's account is recommended but out of scope for this PRD._

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-04-30 | Jeremy Forsythe | Initial draft per decision Q1 (BDFL governance, decided 2026-04-30) and codification of the existing `000-INDEX.md` "How to author a PRD" flow as normative process. Cites PRD-108 (versioning) for change-control rules and Q9 (GitHub Discussions) for the announcement channel. |
| 2026-05-01 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off; first PRD accepted under its own R11 process. |
