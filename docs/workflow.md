# ACT Implementation Workflow

**Status:** Active
**Owner:** Jeremy Forsythe (BDFL — Q1 closed)
**Last updated:** 2026-05-02 (Phase 6 + 7 closed; v0.1 in internal hand-test)

This is the runbook for taking ACT from "planning artifacts landed" to "v0.1 shipped." It answers **"what's next?"** at any point, names the artifacts each phase produces, includes the prompts to drive each step, and pins the testing strategy. Read top-to-bottom once; afterwards, jump to the phase you're in.

The workflow uses [Forge](https://github.com/jdforsythe/forge) (`/forge:*` skills) to assemble the implementation team once PRDs are accepted. The PRD-authoring phases use Claude directly without Forge — agent teams aren't useful for documents that need a single coherent voice.

---

## Where you are right now

Snapshot of repo state on `master` (2026-05-02):

- ✅ v0.1 working draft preserved at `docs/plan/v0.1-draft.md`
- ✅ PRD taxonomy locked: 57 PRDs across 8 domains in `prd/000-INDEX.md`
- ✅ Gap analysis with proposed resolutions in `prd/000-gaps-and-resolutions.md`
- ✅ Strategic decisions Q1–Q12 closed (Q1 BDFL, Q3 TS-only, Q4 Apache-2.0/CC-BY-4.0, Q8 GitHub Pages SPA, etc.)
- ✅ PRD template in `prd/000-template.md`
- ✅ All 57 PRDs Accepted (PRD-603 Deprecated for v0.1; spec-only PRDs 402, 403, 503, 504, 703 carry `(spec only)` headers)
- ✅ `docs/adr/` populated: ADR-001 monorepo, ADR-002 ajv, ADR-003 adapter/generator placement, ADR-004 vertical-slice retro, ADR-005 adapter-framework extraction, ADR-006 generator-core extraction
- ✅ All non-spec-only leaves Implemented: 30 packages, 7 examples, 1 hosted SPA (`apps/validator-web/`)
- ✅ `pnpm -r typecheck`, `pnpm -r lint`, `pnpm -r test`, `pnpm -r conformance` all green
- ✅ Phase 7 ship pre-flight green per `docs/v0.1-preflight.md`
- ⏳ **v0.1 is in internal hand-test** — Jeremy walks every package + example by hand, files fixes, tags v0.2 as the first public release

**What's next:** internal hand-test pass on every package and example. Use `docs/v0.1-handtest-plan.md` (authored alongside this update) to track per-package smoke tests, install-from-tarball flow, edge-case checks. As fixes land, queue them for the v0.2 release.

**Why no public v0.1:** the spec is reputation-load-bearing for the BDFL; shipping a broken-in-the-corners v0.1 publicly is worse than holding for v0.2. v0.1 is the soak window.

---

## The whole picture

| Phase | Goal | Output | Gate to next phase |
|---|---|---|---|
| **0. Decide** | Resolve strategic blockers | Q1–Q12 answered in `000-decisions-needed.md` | All blocking Qs (Q1, Q2, Q3, Q4, Q5) decided |
| **1. P0 PRDs** | Write meta + PRD-107 + PRD-108 | `000-governance.md`, `107-conformance-levels.md`, `108-versioning-policy.md` accepted | All three at status `Accepted` |
| **2. P1 PRDs** | The wire format | `100`–`109` accepted, schemas in `schemas/`, fixtures in `fixtures/` | Validator (PRD-600) implementable from the spec alone |
| **3. P2 PRDs** | Producers, consumers, tools | `200`-, `300`-, `400`-, `500`-, `600`-series accepted | Reference example builds (P3) implementable |
| **4. P3 PRDs** | Examples + ecosystem | `700`-, `800`-series accepted | Implementation team has unambiguous specs |
| **5. Mission planning** | Forge assembles implementation team | Team blueprint at `docs/team-blueprint.md`, agents in `.claude/agents/` | Each agent owns a clear slice |
| **6. Build** | Implement, test, validate | Packages in `packages/`, fixtures green, conformance suite passing | All P3 example builds validate clean |
| **7. Ship** | Public v0.1 release | Tagged release, npm/crates/etc., hosted validator (per Q8) | — |

Phases 0–4 are linear. Phase 6 is parallel across the agent team. Phases 5 and 6 are where Forge enters.

---

## Phase 0 — Resolve strategic decisions

**Why first.** Q1–Q5 (governance, naming, language, license, adapter versioning) bleed into every downstream PRD. Q6 (MCP version range) gates PRD-602. Q7–Q8 affect priority and operational scope but don't block authoring. Q9–Q12 are deferrable.

**Don't try to answer all twelve in one sitting.** Decide Q1–Q5 first, defer the rest by writing "decide later — won't block X" inline.

**Prompt — start the decisions session:**

```
Walk me through the open decisions in prd/000-decisions-needed.md, one at a time, in order Q1 through Q5. For each:

1. Restate the question, your recommended default, and the consequences in two sentences.
2. Ask me only the questions you genuinely need from me to make the call (don't make me re-read the doc).
3. Once I answer, write the decision into the file under that question's "Decision:" line with a one-sentence rationale.
4. Update affected PRD rows in prd/000-INDEX.md if the decision changes anything (e.g., Q3 may downgrade some 40-series and 50-series PRDs to "spec only, reference impl pending").
5. If a decision invalidates a proposed resolution in prd/000-gaps-and-resolutions.md, edit that gap entry too.

Move to Q6–Q8 only if I say so. Q9–Q12 are deferrable; mark them "decide later" with a note about what would force the call.
```

**Gate to Phase 1:** Q1–Q5 each have a written `Decision:` line. Q6–Q8 either decided or explicitly deferred with a note.

---

## Phase 1 — Author P0 PRDs

**Goal.** Write `000-governance.md`, `107-conformance-levels.md`, `108-versioning-policy.md`. These three are upstream of every other PRD because they pin the rules every later PRD must satisfy:

- **PRD-108 (versioning)** — fixes the MAJOR/MINOR rules so every PRD's "Versioning & compatibility" section can be written.
- **PRD-107 (conformance)** — fixes the Core/Standard/Plus levels so every PRD can declare which level its requirements belong to.
- **000-governance** — fixes how PRDs move from Draft → Accepted, who reviews, and the change-control process.

Authoring order: 108 → 107 → 000-governance. (Versioning is the smallest and unblocks the others; conformance depends on it.)

**Prompt — author PRD-108:**

```
Write prd/108-versioning-policy.md following prd/000-template.md. Source material:

- v0.1 draft section 4 (act_version table entry)
- prd/000-gaps-and-resolutions.md gap A2 (the proposed resolution)
- Decisions Q5 in prd/000-decisions-needed.md (adapter version pinning)

Use RFC 2119 keywords throughout the Specification section. Every requirement gets an ID like PRD-108-R1. Include:
- A test fixture matrix: for each MAJOR-vs-MINOR rule, one positive fixture (a valid bump) and one negative fixture (an invalid bump that the validator would catch).
- A worked example: a hypothetical 0.1 → 0.2 diff showing one MAJOR change rejected and three MINOR changes accepted.
- The deprecation window rule with an example timeline.

When done, update status in prd/000-INDEX.md from Draft to In Review. Ask me to review before changing status to Accepted.
```

**Prompt — author PRD-107:**

```
Write prd/107-conformance-levels.md following prd/000-template.md and using PRD-108 (now Accepted) for versioning rules. Source material:

- prd/000-gaps-and-resolutions.md gap A1 (Core/Standard/Plus levels)
- v0.1 draft sections 5.3 (manifest capabilities), 5.4 (index), 5.6 (disclosure), 5.7 (subtree), 5.9 (search), 5.12 (i18n)

Define the three levels normatively. For each, specify:
- Manifest capability flags that signal it
- Required envelope fields
- Required endpoints (static and runtime)
- The conformance reporter's expected output shape

Cross-reference how level interacts with delivery profile (gap C1: orthogonal). Include a test fixture per level showing a minimum-conformant manifest and one broken-conformance manifest.

Update prd/000-INDEX.md status. Ask me to review.
```

**Prompt — author 000-governance:**

```
Write prd/000-governance.md following prd/000-template.md. Source material:

- The decision recorded for Q1 (governance model) in prd/000-decisions-needed.md
- prd/000-INDEX.md ("How to author a PRD" section) for the existing flow
- PRD-108 (now Accepted) for versioning's role in change control

Cover:
1. Roles (BDFL / maintainers / contributors per the Q1 decision)
2. PRD lifecycle (Draft → In Review → Accepted → Implemented → Deprecated) with required reviewers per state transition
3. Change control: who can change an Accepted PRD; what triggers a MAJOR vs MINOR (cite PRD-108)
4. Deprecation policy: notice window, removal rules, communication channel
5. Conflict resolution: when reviewers disagree, what process resolves
6. Cadence: regular review meetings (or async equivalent), release schedule

This is a process PRD, not a wire-format PRD; the Specification section uses RFC 2119 keywords for the lifecycle requirements (e.g., "An Accepted PRD MUST NOT be modified except via a NEW PRD that supersedes it").
```

**Gate to Phase 2:** PRD-107, PRD-108, 000-governance all at status `Accepted`. The PRD template's "Versioning & compatibility" section now has a referent it can cite.

---

## Phase 2 — Author P1 PRDs (the standard)

**Goal.** Write the 100-series. These are the wire format. Everything downstream is an implementation of them.

**Order** (per `000-INDEX.md`): PRD-100 → 101 → 102 → 103 → 109 → 105 → 106 → 104. Save 104 (i18n) for last because it touches manifest, index, and node shapes that need to stabilize first.

**Per-PRD prompt template** (substitute the bracketed parts):

```
Write prd/{NNN}-{slug}.md following prd/000-template.md. Source material:

- v0.1 draft sections {list the relevant sections}
- prd/000-gaps-and-resolutions.md gaps {list the gap IDs that this PRD resolves}
- prd/000-decisions-needed.md decisions {list any decisions this PRD depends on}
- Already-Accepted PRDs: {list with brief notes on what they pin}

Authoring rules:
1. Every normative requirement uses RFC 2119 keywords and gets an ID like PRD-{NNN}-R{n}.
2. Declare the conformance level (Core/Standard/Plus per PRD-107) for each requirement.
3. For wire-format PRDs, ship the JSON Schema inline in the Specification section. Save the canonical schema to schemas/{prd-id}/ as a separate file.
4. Ship at least one positive and one negative fixture per requirement under fixtures/{prd-id}/.
5. Worked example in the Examples section MUST validate against the schema and pass the positive fixtures.
6. Security section MUST address every relevant threat from PRD-109's threat model (once 109 is accepted; for 100–103 author the threat model inline and migrate to 109 after).

When the PRD is internally consistent and all open questions in its preamble are either resolved or moved to 000-decisions-needed.md, set status to In Review and ask me to review.

After my review:
- If accepted, status to Accepted and update prd/000-INDEX.md.
- If changes requested, address them, bump the changelog, and re-request review.
```

**Special note for PRD-104 (i18n):** Schedule it last in P1 because every locale-related decision depends on what manifest, index, and node already look like. If you author it in parallel, expect rework.

**Gate to Phase 3:** All 10 PRDs in the 100-series at status `Accepted`. The validator (PRD-600) and the inspector CLI (PRD-601) are implementable from the 100-series alone — verify by sketching their interface signatures before declaring the gate cleared.

---

## Phase 3 — Author P2 PRDs (producers, consumers, tools)

**Goal.** Write the 200-, 300-, 400-, 500-, 600-series. These are the implementations of the standard. They're large in count (~32 PRDs) but each is smaller in scope than a 100-series PRD.

**Strategy.** Author the framework PRDs first, then the leaves. Branches can run in parallel; leaves within a branch can also run in parallel. The framework PRDs are:

- PRD-200 (adapter framework) — gates all 20x adapters
- PRD-300 (component contract) — gates all 30x bindings
- PRD-400 (generator architecture) — gates all 40x generators
- PRD-500 (runtime SDK contract) — gates all 50x SDKs
- PRD-600 (validator) — depends only on 100-series; can start as soon as Phase 2 closes

**Per-PRD prompt** (same as Phase 2 template, plus this addition):

```
Additional requirements for P2 PRDs:

- The Implementation notes section is required (this is an SDK/adapter/generator PRD).
- Implementation notes show ~3-10 short snippets in the language picked per Q3. Snippets show the canonical shape; do not paste in full implementations.
- The PRD MUST cite which 100-series requirements it implements — list them as a table at the top of the Specification section.
- Test fixtures from the parent framework PRD (PRD-200, PRD-300, etc.) MUST pass when the leaf adapter/generator/SDK runs against them.
```

**Parallelism advice.** When you sit down to write multiple PRDs in one branch (e.g., 401, 402, 403, 404 after 400 is Accepted), give Claude the whole list in one prompt and let it draft them in sequence — context-locality means a writer who just finished PRD-401 has the framework's nuances loaded and writes PRD-402 faster than starting cold. Limit to ~4 PRDs per session before context drift sets in.

**Prompt — batch P2 PRDs in a branch:**

```
Author the following P2 PRDs in sequence, all in this session, following the Phase 2 per-PRD prompt template:

1. prd/{401}-{slug}.md
2. prd/{402}-{slug}.md
3. prd/{403}-{slug}.md
4. prd/{404}-{slug}.md

Their parent framework PRD is {PRD-400, status: Accepted}. The 100-series PRDs they implement are listed at the top of each one's Specification.
```

**Gate to Phase 4:** Every framework PRD (200, 300, 400, 500, 600) plus its leaves at status `Accepted`. The reference example builds (P3) can be specified by composing existing PRDs without inventing new behavior.

---

## Phase 4 — Author P3 PRDs (examples + ecosystem)

**Goal.** Write the 700- and 800-series. Examples (700) exercise the spec end-to-end. Ecosystem PRDs (800) describe the post-launch posture: crawler behavior, migration playbook, RFC process (cite 000-governance), naming policy.

**Examples-first.** Write 700–706 before 800–803. Building example PRDs surfaces ambiguity in earlier PRDs; you'll discover real bugs that need amendments to 100/200/300 series. Treat amendments as Phase 2/3 reopenings, not as Phase 4 churn.

**Prompt — author one example PRD:**

```
Write prd/{NNN}-{slug}.md following prd/000-template.md. This is a reference example build; the Implementation notes section becomes the spec for the implementation team in Phase 6.

Source material:
- v0.1 draft sections {6.5, 7.x, 8.x — pick what's relevant}
- All P2 PRDs the example uses (cite explicitly)
- PRD-600 (validator) — the example MUST validate clean

Required content beyond the standard template:
- Site description: what's being built, what content exists, expected scale (node count, locale count, runtime vs static).
- File-by-file generated output expectations: e.g., "generates /act/index.json with 247 nodes, /act/n/{id}.json for each, /act/sub/{id}.json for the docs subtree."
- Conformance target: declare Core / Standard / Plus per PRD-107.
- Acceptance criteria include: the example builds clean, validates against PRD-600 with zero errors, every P2 PRD cited has at least one of its requirements exercised.

When done, set status to In Review.
```

**Prompt — author ecosystem PRDs:**

```
Author the 800-series ecosystem PRDs in order: 800, 801, 802, 803.

These are non-wire-format PRDs. The Specification section uses RFC 2119 keywords for the rules they impose (e.g., a crawler MUST identify itself; a migration MUST preserve canonical URLs), but they don't define schemas. Skip the wire-format / interface subsection of the template.

For PRD-803 (naming policy), use the Q2 decision recorded in 000-decisions-needed.md. If Q2 is still TBD, stop and prompt me to decide first.
```

**Gate to Phase 5:** Every PRD in the index at status `Accepted` or `Deprecated`. The implementation team can read any PRD without prerequisites outside the PRD set.

---

## Phase 5 — Assemble the implementation team (Forge)

**Goal.** Use Forge's `mission-planner` skill to decompose "implement ACT v0.1" into a coordinated agent team. Forge produces a team blueprint with role definitions, vocabulary payloads, deliverables, and artifact handoff chains. Save the blueprint to `docs/team-blueprint.md` and the agent definitions to `.claude/agents/`.

**Why Forge here.** The PRD-authoring phases want a single coherent voice; agent teams hurt that. Implementation has natural parallelism — schemas, validators, adapters, SDKs, generators, examples, tests — and decomposes cleanly into roles. Forge's research-backed scaling laws (cap at 3-5 agents per team) prevent the "spawn 20 agents" trap.

**Prompt — invoke mission planner:**

```
/forge:mission-planner

Goal: Implement ACT v0.1 per the accepted PRDs in prd/. The standard (100-series), adapters (200), components (300), generators (400), runtime SDK (500), tooling (600), and reference example builds (700) all need to land. We have ~57 PRDs accepted, ~50 of them needing implementation.

Constraints:
- Reference language: {whatever Q3 decided — likely TypeScript-only}
- Testing posture: TDD throughout (red-green-refactor); unit + integration + e2e; coverage target ~85% line coverage on shipped packages, 100% on the wire-format core (schemas, validators, conformance suite).
- Conformance gate: every leaf package (each adapter, each SDK binding, each generator) MUST pass the PRD-600 conformance suite as part of CI.
- Deliverable cadence: ship one P3 example build (PRD-700, the minimal Astro docs site) end-to-end first as a vertical slice, then expand horizontally.

Source documents Forge should read:
- prd/000-INDEX.md (the work breakdown)
- prd/000-decisions-needed.md (constraints from Q1-Q12)
- All accepted PRDs in prd/ (especially the framework PRDs: 200, 300, 400, 500, 600)
- docs/workflow.md (this document, especially Phase 6)

Output:
- A team blueprint with 3-5 agents, roles named with real-world job titles, vocabulary payloads, and an artifact chain.
- Agent definitions saved to .claude/agents/ (one file per agent).
- A Phase 6 task ordering: which agent owns the vertical slice, which agents work parallel after the slice clears, which agents are gates (reviewer, verifier).

If the goal matches the Software template in Forge's library (Product Manager, Architect, Lead Engineer, QA), adapt that template; otherwise propose a custom topology and explain why.
```

**Forge will likely propose a team like:**

- **Spec Steward** — owns the schemas, conformance suite, and any PRD amendment when implementation surfaces ambiguity. Reads the PRDs as authoritative; flags every place the implementation diverges from the spec.
- **Lead Engineer** — owns architecture decisions across packages, oversees the vertical slice, makes call on implementation patterns shared across producers/consumers.
- **Adapter/Generator Engineer** — builds the producer packages (20x, 30x, 40x). Heavy parallelism inside this role.
- **Runtime/SDK Engineer** — builds the runtime SDK packages (50x) plus tooling (60x).
- **QA / Verifier** — owns the test pyramid: unit, integration, e2e. Owns the PRD-600 conformance suite as a CI gate. Uses Forge's `forge:verifier` for spec-conformance checks.

The exact composition depends on what Forge produces — let it decide, then review.

**Gate to Phase 6:** Team blueprint at `docs/team-blueprint.md`, agents in `.claude/agents/`, and a Phase 6 ordering you've signed off on.

---

## Phase 6 — Implement, test, validate

**Goal.** Land the code. Ship the validator. Ship the vertical slice (PRD-700). Ship the rest in parallel. End state: every P3 example builds clean and validates against PRD-600 with zero errors.

### The vertical slice

Before parallelizing, ship one end-to-end example. This is the canonical sequence:

1. **Schemas** — PRD-100 + PRD-101 + PRD-102 + PRD-103 + PRD-109 land as JSON Schemas under `schemas/`.
2. **Validator** (PRD-600) — implemented against the schemas. Test fixtures from each 100-series PRD pass.
3. **Markdown adapter** (PRD-201) — implemented against PRD-200 framework.
4. **Astro generator** (PRD-401) — implemented against PRD-400 framework, consumes PRD-201.
5. **PRD-700 example** — Astro docs site with a handful of pages, generates `/.well-known/act.json` etc.
6. **Conformance gate** — PRD-700's output passes PRD-600.

Once that vertical slice is green, every parallel branch in Phase 6 has a working reference and a passing CI signal.

**Prompt — kick off the vertical slice:**

```
Begin Phase 6, vertical slice. Use the team blueprint from docs/team-blueprint.md.

Order:
1. Spec Steward: lock JSON Schemas in schemas/100-series/ from the accepted 100-series PRDs. Schemas MUST validate every fixture in fixtures/100-series/.
2. Lead Engineer: scaffold the monorepo (package layout per Q3's language decision, shared tsconfig/Cargo workspace/etc., CI skeleton).
3. Lead Engineer + QA: implement PRD-600 (validator) using strict TDD — write failing tests against the 100-series fixtures, then make them pass. Coverage target 100% line, 100% branch.
4. Adapter/Generator Engineer: implement PRD-201 (markdown adapter) and PRD-401 (Astro generator) in parallel. TDD throughout.
5. QA: build the PRD-700 example. Run validator against output. Vertical slice green when validator returns zero errors and conformance level is reported as Plus.

Each agent posts artifacts to docs/team-blueprint.md's artifact chain. When the slice is green, ping me — Phase 6 expansion starts only after the slice closes.
```

### Parallel expansion

Once the slice is green, the agent team fans out. The four parallel tracks:

| Track | Owner | PRDs in scope | Gate |
|---|---|---|---|
| Adapters | Adapter Engineer | 202–208 | Each adapter passes its fixtures + the framework conformance suite |
| Components + generators | Adapter Engineer + Lead | 300–303, 402–409 | Each generator emits valid ACT for at least one fixture site |
| Runtime SDK | Runtime Engineer | 500–505, 602 | Each SDK passes the runtime conformance suite under PRD-600 |
| Tooling | Lead Engineer | 601 (inspector), 600 hosted UI per Q8 | Inspector runs against the PRD-700 example; hosted UI (if Q8=hosted) is reachable |

Each track produces packages with their own test suites + CI. The QA agent runs the full conformance suite nightly across all packages.

**Prompt — kick off parallel expansion:**

```
Vertical slice is green. Begin Phase 6 parallel expansion across the four tracks (adapters, components+generators, runtime SDK, tooling).

For each track:
- Reference the team-blueprint artifact chain.
- Pick the next PRD by dependency order (already encoded in prd/000-INDEX.md).
- Apply the testing pyramid (see "Testing strategy" below).
- Each PRD implementation closes when: (a) all fixtures pass, (b) the framework conformance suite passes, (c) coverage targets met, (d) the QA agent has signed off via forge:verifier.

Run the four tracks in parallel sessions. Daily standup synthesis: at the end of each working session, post a one-paragraph status to docs/team-blueprint.md noting which PRDs are now Implemented and which moved to In Review for spec changes.
```

### Testing strategy

The testing posture has three layers, each with its own coverage target and time budget. Stop when the next test would assert against framework behavior or a single line of obvious code — that's the diminishing-returns line.

| Layer | What it tests | Time budget per run | Coverage target |
|---|---|---|---|
| **Unit** | One function / one schema rule / one HTTP handler in isolation. Mocked dependencies for everything below the unit. | < 30s for the whole suite | ~95% line, 100% branch on the wire-format core; ~85% line elsewhere |
| **Integration** | Multiple units composed: a full adapter run against fixture content; a full generator run against fixture site; a runtime SDK against an in-process HTTP harness. | < 5min for the whole suite | All adapter / generator / SDK code paths exercised; no mocked I/O for the system under test |
| **E2E (conformance)** | A producer's output run through PRD-600 (validator) end-to-end. The PRD-700–706 example builds are the canonical e2e fixtures. | < 15min for the whole suite | Every PRD-700-series example validates clean, every conformance level reported correctly |

**TDD rules (apply at the unit and integration layers):**

1. Red first. Write the failing test against the requirement (cite the requirement ID, e.g., `// PRD-100-R3`).
2. Green minimal. Make the test pass with the smallest code change. No speculative generality.
3. Refactor. Restructure with tests still green; don't add new behavior.
4. Repeat per requirement, per code path, per fixture.

**Mutation testing for the wire-format core only.** PRD-100 through PRD-103, PRD-109, PRD-600 are high-leverage; mutate them with stryker (TS) / mutmut (Py) / cargo-mutants (Rust) and require the score to be ≥ 75%. Skip mutation for adapters, generators, examples — coverage is enough.

**Diminishing-returns guidance — when to stop adding tests.**

Stop when:
- The next test would assert framework behavior (e.g., "does Express call my handler?"). That's the framework's responsibility.
- The next test exercises code that's a single trivial mapping (e.g., a destructure-and-return function with no logic).
- The next test is a duplicate of an integration test at the unit layer.
- Mutation score on the core is at 75%+ and the surviving mutants are all in argument-name parameters or string literals.

**Prompt — verify a PRD's implementation:**

```
/forge:verifier

Verify the implementation of {PRD-NNN} against its acceptance criteria.

Inputs:
- The PRD: prd/{NNN}-{slug}.md
- The implementation: packages/{package-name}/
- The fixtures: fixtures/{prd-id}/

Acceptance criteria to check:
1. Every requirement ID (PRD-{NNN}-R{n}) is testable and tested.
2. All positive fixtures pass.
3. All negative fixtures fail with the documented error code.
4. Coverage targets met (cite the per-layer targets from docs/workflow.md).
5. The conformance suite (PRD-600) passes when run against the implementation's example output.
6. The PRD's "Security considerations" section addresses the actual implementation's surface (no theory-only items).

Produce a per-criterion verdict: APPROVED / REJECTED with evidence. If REJECTED on any criterion, the implementing agent owns the rework.
```

### Reviews and amendments

Implementation will surface holes in PRDs. Don't paper over them — file an amendment.

**Process for a PRD amendment during implementation:**

1. The implementing agent flags the issue in `docs/amendments-queue.md` with: PRD ID, section, observed problem, proposed fix.
2. The Spec Steward triages: trivial clarifications get edited directly (PRD goes from Accepted → Accepted with a changelog entry); semantic changes go through a new In Review cycle.
3. If the change is MAJOR per PRD-108, it requires a new PRD that supersedes the old one. The old PRD moves to Deprecated.
4. The QA agent re-runs the conformance suite after every accepted amendment.

**Prompt — request a PRD amendment:**

```
/forge:reviewer

Review the proposed amendment to PRD-{NNN} in docs/amendments-queue.md (entry titled "{title}").

Decide:
- Is the proposed change trivial (clarification, typo fix, example update) — if so, accept and edit the PRD inline with a changelog entry.
- Is the change semantic but additive (new optional field, new example, new SHOULD requirement) — if so, route through In Review with a MINOR bump.
- Is the change semantic and breaking (changes a MUST, removes a field, changes default behavior) — if so, this requires a new superseding PRD; explain why and produce the skeleton.

Apply PRD-108's MAJOR/MINOR rules strictly. The implementing agent's convenience is not a tiebreaker; the spec's stability is.
```

---

## Phase 7 — Ship

**Goal (revised 2026-05-02).** Land v0.1 as an **internal hand-test candidate**. The BDFL hand-tests every package and example, files fixes against any rough edges, and only then tags v0.2 as the first public release. v0.1 is the soak window.

**Why not ship v0.1 publicly.** The spec is reputation-load-bearing. Shipping a v0.1 with corner-case bugs in the adapters / generators / runtime SDKs would damage the standard's adoption posture more than holding the public release one cycle. v0.1's job is to catch issues that pre-Phase-7 testing missed; v0.2 is the first artifact published to npm and tagged in the public registry.

**Phase 7 pre-flight checklist (v0.1 internal close):**

- [x] All PRDs at status `Accepted` or `Implemented` (or `Deprecated` for PRD-603).
- [x] PRD-600 (validator) green against every PRD-700-series example.
- [x] CI green on `master` (`pnpm -r typecheck` / `lint` / `test` / `conformance`).
- [x] Hosted validator SPA built (`apps/validator-web/`) and Pages workflow wired (`.github/workflows/pages.yml`); URL pinned at first public deploy in v0.2.
- [x] `CHANGELOG.md` written (v0.1.0 entry).
- [x] License files in every package (Apache-2.0 code per Q4; CC-BY-4.0 spec).
- [x] Package READMEs present.
- [x] Pre-flight report at `docs/v0.1-preflight.md`.
- [x] Release workflow (`.github/workflows/release.yml`) gated to `workflow_dispatch` only — no auto-publish on master push until v0.2.
- [x] No npm changeset authored — v0.1 packages stay at `0.0.0`; v0.2 will be the first version-bumped release.
- [ ] **v0.1 hand-test pass complete** — see `docs/v0.1-handtest-plan.md`. This is the gate to v0.2.
- [ ] *(v0.2 only)* `git tag v0.2.0`, push tag, `pnpm changeset publish` to npm.
- [ ] *(v0.2 only)* Hosted validator URL pinned in `RELEASE_NOTES.md`.
- [ ] *(v0.2 only)* llms.txt updated on the spec-site repo.
- [ ] *(v0.2 only)* Blog post / public announcement drafted.

**Prompt — v0.2 ship checklist (use when v0.1 hand-test closes):**

```
Walk through the Phase 7 pre-flight checklist in docs/workflow.md. The v0.1
internal-candidate items at the top of the checklist should already be [x]
from 2026-05-02; verify they still hold against current master, then drive
the v0.2-only items at the bottom:

1. Verify every v0.1 hand-test fix has landed and `docs/v0.1-handtest-plan.md`
   is fully checked off.
2. Re-run pnpm -r typecheck/lint/test/conformance — green.
3. Author one changeset under .changeset/ marking every publishable
   package as a minor bump (or major if the BDFL prefers).
4. Bump @act-spec/core's exposed `act_version` constant to "0.2.0" if the
   wire format changed; otherwise leave at "0.1.0" with a CHANGELOG note.
5. Re-enable the on-push trigger in .github/workflows/release.yml.
6. Confirm the NPM_TOKEN secret is configured on the repo (BDFL action).
7. Pin the hosted-validator URL in RELEASE_NOTES.md once Pages deploys.
8. Update llms.txt on the spec-site repo if applicable.
9. Draft the public announcement.

When everything green, the BDFL tags v0.2.0 and pushes; the Release workflow
opens the Release PR; merging it triggers the npm publish. Don't tag — that's
the BDFL's call.
```

---

## Cross-cutting concerns

### ADRs (Architectural Decision Records)

PRDs are normative spec documents. ADRs are notes to your future self about choices that aren't normative but that future maintainers will want context on. Live under `docs/adr/`.

**Write an ADR when:**

- An implementation choice spans multiple packages (e.g., "we standardized on zod for runtime validation").
- An implementation choice has clear alternatives that were considered and rejected.
- A bug fix or refactor reverses an earlier design call.

**Don't write an ADR for:**

- Anything that belongs in a PRD's Specification section. PRDs are normative.
- Routine implementation details that follow the framework's conventions.
- Documentation of "what the code does" — that's commit messages and READMEs.

**ADR template** (at `docs/adr/template.md` — create on first use):

```markdown
# ADR-NNN — {Title}

**Status:** Proposed | Accepted | Superseded by ADR-XXX
**Date:** YYYY-MM-DD
**Author:** {agent name or human}

## Context
What's the situation that prompted this?

## Decision
What did we decide?

## Consequences
- Positive
- Negative
- Neutral

## Alternatives considered
- {alt 1} — why rejected
- {alt 2} — why rejected
```

**Prompt — open an ADR:**

```
Open docs/adr/{NNN}-{slug}.md following docs/adr/template.md. Context:

{paste the situation, the decision, the alternatives}

If this ADR contradicts an existing PRD's Specification, stop and route through the amendment process instead — ADRs document non-normative choices, not spec changes.
```

### Documentation

Three layers of documentation:

| Layer | Audience | Lives | Authored when |
|---|---|---|---|
| PRD | Spec implementers, reviewers | `prd/` | Phases 1–4 |
| ADR | Future maintainers | `docs/adr/` | Phase 6, on each cross-cutting choice |
| Package README | Users (developers consuming the package) | `packages/{name}/README.md` | Phase 6, alongside the implementation |
| Cookbook / how-to guides | End-user authors integrating ACT | `docs/guides/` | Phase 7 (post-ship), as adoption requires |

PRDs do not document how to use packages — that's README's job. READMEs do not specify behavior — that's the PRD's job. If a README starts asserting normative requirements, lift them into the PRD.

### Status tracking

The single source of truth for "what's done" is `prd/000-INDEX.md`'s Status column. Update it the same edit as the PRD's status change. Don't track in two places.

For implementation status, add a `Implementation status` column or a parallel section once Phase 6 starts:

| PRD | Spec status | Impl status | Package | Coverage |
|---|---|---|---|---|
| PRD-100 | Accepted | Implemented | @act/core | 98% |
| PRD-201 | Accepted | In progress | @act/markdown-adapter | 67% |

### Review gates summary

| When | What's reviewed | Reviewer | Output |
|---|---|---|---|
| End of Phase 0 | Decisions Q1–Q5 | You | `Decision:` lines filled |
| Each PRD before `Accepted` | The PRD | You + per the governance PRD reviewer list | Status change |
| End of vertical slice (Phase 6.1) | The slice's output through PRD-600 | QA agent + `forge:verifier` | APPROVED verdict |
| Each PRD's implementation | Implementation against PRD acceptance criteria | `forge:verifier` | APPROVED verdict |
| PRD amendment requests | The proposed change | `forge:reviewer` | Accept / refactor as new PRD / reject |
| Pre-Phase 7 ship | Pre-flight checklist | You | Tag |

---

## Quick reference: prompts

### Resolve decisions
```
Walk me through prd/000-decisions-needed.md Q1 through Q5, one at a time. For each: restate, ask only what you need, write the Decision line, update affected PRDs in the index. Then ask whether to continue with Q6–Q8.
```

### Author a PRD (Phase 1–4)
```
Write prd/{NNN}-{slug}.md following prd/000-template.md, sourcing from {draft sections} and {gap IDs} and {decisions}. Apply the Phase {N} rules from docs/workflow.md. Set status to In Review when done.
```

### Assemble the implementation team (Phase 5)
```
/forge:mission-planner

Goal: implement ACT v0.1 per accepted PRDs in prd/. Constraints: {language}, TDD, ~85% coverage / 100% on wire-format core, PRD-600 conformance gate. Output: 3-5 agent team blueprint to docs/team-blueprint.md and agents to .claude/agents/. Read prd/000-INDEX.md, all accepted PRDs, and docs/workflow.md Phase 6 first.
```

### Ship a vertical slice (Phase 6.1)
```
Begin Phase 6 vertical slice per docs/workflow.md. Order: schemas → validator (PRD-600) → markdown adapter (PRD-201) → Astro generator (PRD-401) → PRD-700 example. Strict TDD, 100% coverage on validator. Ping me when slice is green.
```

### Verify a PRD's implementation (Phase 6)
```
/forge:verifier

Verify implementation of PRD-{NNN} against its acceptance criteria. Inputs: PRD, package directory, fixtures. Output: per-criterion APPROVED/REJECTED with evidence.
```

### Request a PRD amendment (Phase 6)
```
/forge:reviewer

Review proposed amendment to PRD-{NNN} in docs/amendments-queue.md ("{title}"). Apply PRD-108 MAJOR/MINOR rules. Output: edit-in-place / route through In Review / require superseding PRD.
```

### Pre-flight ship check (Phase 7)
```
Walk through Phase 7 pre-flight checklist in docs/workflow.md. Run the actual checks. Draft v0.1 release notes when all green. Don't tag — my call.
```

---

## Out of scope for this workflow

- Automated PRD generation. Each PRD is hand-authored against the template; an agent can draft, but a human reviews before `Accepted`.
- Automatic spec amendment from implementation friction. Friction goes through `docs/amendments-queue.md` and `forge:reviewer`, not direct edits.
- Multi-version development (v0.2 work) until v0.1 ships. Once v0.1 is tagged, fork a v0.2 branch and revisit deferred items in Tier F of the gap analysis.
