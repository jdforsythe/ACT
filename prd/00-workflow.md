# PRD-04 — Workflow

**Status:** Living document — operational manual for the ACT spec project.
**Last updated:** 2026-05-01

This document is the operating manual for the ACT spec project. It explains how planning artifacts feed into PRD authoring, then PRD implementation via the forge `mission-planner` skill, then TDD-driven code, then acceptance, then publication. It ships 14 copy-paste prompts (W-01 through W-14), each self-contained and pasteable into a fresh Claude Code session.

Read this once; then run the prompts.

## Lifecycle stages

```
[ 0 ] Approve plan & generate planning artifacts
        │
        ▼
[ 1 ] Resolve strategic decisions (ADR-0004 onward)
        │
        ▼
[ 2 ] Author P0/P1 PRDs (00-* meta + 10-series)
        │  each PRD: research → draft → verify → review → accept
        ▼
[ 3 ] Generate per-PRD implementation team via mission-planner
        │
        ▼
[ 4 ] TDD implementation
        │  fixtures-first → unit red→green → integration red→green → e2e
        ▼
[ 5 ] Acceptance gate
        │  fixtures pass + coverage budget met + reviewer signoff
        ▼
[ 6 ] Author P2 PRDs (20/30/40/50/60-series), loop 2–5
        │
        ▼
[ 7 ] Author P3 PRDs (70 examples, 80 ecosystem), loop 2–5
        │
        ▼
[ 8 ] Publication: spec site, npm packages, validator host, RFC submission
```

Each transition has a gate. No PRD moves to Implemented without (a) all conformance fixtures passing, (b) coverage budget met, (c) integration suite green, (d) at least one e2e example exercising its surface.

## Forge integration

The `jdforsythe/forge` plugin provides four skills and three infrastructure agents that this workflow leans on:

- **`mission-planner`** — decomposes a PRD into a team blueprint (one of pipeline / parallel / coordinator / hierarchical topologies).
- **`agent-creator`** — spawns custom domain agents the team blueprint calls for (e.g., a "JSON Schema author", a "tokenizer specialist").
- **`skill-creator`** — adds new skills to the agent library.
- **`librarian`** — surfaces existing agents and skills so we don't duplicate work.

Infrastructure agents:

- **`researcher`** — gathers prior-art context before authoring or implementing.
- **`verifier`** — schema-checks authored PRDs and emitted artifacts.
- **`reviewer`** — critiques drafts before merge.

Forge installation, plugin loading, and skill discovery are covered in the forge README at `github.com/jdforsythe/forge`. This document assumes forge is installed and the plugin is active.

## ADR process

ADRs (Architecture Decision Records) live in `adr/`, numbered sequentially. Format follows Michael Nygard's template (Status → Context → Decision → Consequences → Links), captured in `adr/0000-template.md`.

Lifecycle:

1. Strategic question raised — surfaced in `prd/00-decisions-needed.md` (D-NN), or arises during PRD authoring.
2. User answers the question — optionally with `researcher` agent help to gather comparison data.
3. ADR drafted using `adr/0000-template.md`. Status starts as `Proposed`.
4. `reviewer` agent critiques. ADR moves to `Accepted` or back to `Proposed`.
5. Affected PRDs updated to cite the ADR. The corresponding D-NN in `prd/00-decisions-needed.md` flips status to `Decided in ADR-NNNN`.

ADR-0001 (PRD style), ADR-0002 (output location), ADR-0003 (decision philosophy) are pre-seeded by the planning round. ADR-0004 onward are written as D-01 through D-12 are answered.

## PRD authoring loop

For each PRD:

```
1. Pick next PRD from prd/00-INDEX.md (status: Unauthored, dependencies satisfied)
2. Research:    spawn researcher agent (W-02)
3. Draft:       author PRD using prd/00-template.md (W-03)
4. Verify:      run verifier agent (W-04)
5. Review:      run reviewer agent (W-05)
6. Generate fixtures: run W-06
7. Accept:      flip status to Accepted in INDEX
8. Stage commit: branch, commit, push (only on user signal)
```

Authors do not invent technical resolutions. If a gap is unresolved, it goes in the PRD's "Open questions" section and gets surfaced for ADR creation.

## PRD implementation loop

For each Accepted PRD, `mission-planner` generates a team blueprint. The team executes against the PRD's acceptance criteria.

Recommended topologies:

- **Pipeline** (researcher → fixture-author → implementer → integrator → reviewer → coverage-auditor) — for spec/SDK PRDs.
- **Parallel** (per-language SDK implementer) — for the 50-series.
- **Coordinator** (master agent dispatching to per-example subteams) — for 70-series example builds.
- **Hierarchical** (lead → multiple specialist sub-leads → workers) — for XL PRDs like PRD-72 (corporate marketing example).

The blueprint lives at `teams/PRD-NN.json`. Spawning happens via `agent-creator` (for any custom agents the blueprint requires) plus the standard Task tool for orchestration.

## Testing strategy

TDD-driven, fast feedback, max coverage before diminishing returns. Four layers, written in this order.

### Layer 1: Conformance fixtures (PRD-level, written FIRST)

Every PRD's "Test fixtures" section ships positive and negative inputs/outputs as files under `tests/fixtures/PRD-NN/`. Fixtures are language-agnostic JSON or markdown — implementations in any language consume the same fixtures.

The PRD is "done" only when fixtures pass. This is the TDD red-line for the entire spec ecosystem — no implementation begins without fixtures.

### Layer 2: Unit tests (per-package)

Targets:

- **Core libraries** (manifest builder, index builder, node serializer, ETag computer, ID parser, tokenizer adapters, schema validator): ≥90% line coverage, ≥85% branch.
- **Source adapters**: ≥80% line.

Tools:

- TypeScript: Vitest (preferred) or Jest.
- Python: pytest.
- Ruby: RSpec.

Run on every commit; <30s feedback loop. Faster than that → broken tests; slower → contributor friction.

### Layer 3: Integration tests (per-pipeline)

Each adapter end-to-end:

- Fixture content in → `NodeDraft` out → emitted files out → compared against golden-output fixtures.
- Cross-adapter merge scenarios (CMS + i18n + components, all contributing to the same node).

Per-framework SDK integration:

- Spin up the target framework (Next.js, Express, FastAPI).
- Hit the runtime endpoints with `curl` / `fetch`.
- Validate responses against PRD-10/15/16 JSON Schemas.

Run on every push; <5min feedback.

### Layer 4: E2E tests (per reference example)

Each 70-series example is a real, runnable site/app. The e2e suite:

- Builds it (`npm run build` / equivalent).
- Fetches `/.well-known/act.json` over HTTP.
- Walks the entire tree.
- Validates every node against the published JSON Schema.

For runtime examples (PRD-75, PRD-76):

- Authenticates as fixture users (one per role).
- Verifies per-tenant scoping (user A cannot see user B's content).
- Verifies cache headers, ETag revalidation, 401/404 leak prevention.

Run nightly; <30min feedback.

### Coverage budgets, intentional caps

| Layer | Budget | Rationale |
|---|---|---|
| Core libs | 90% line, 85% branch | Don't chase the last 5% — diminishing returns. |
| Adapters | 80% line | Remaining 20% is CMS-API edge cases caught by integration fixtures. |
| Examples | Smoke + golden-output only | The example IS the test. |
| Generators | 85% line | Build pipelines have lots of glue; over-testing glue is a cost sink. |

### Test data discipline

Every fixture is a real-world-shaped artifact, not a mock:

- A "site" fixture is an actual minimal site that builds.
- A "node" fixture is bytes a server would actually return.
- A "manifest" fixture validates against the published JSON Schema.

Fixtures double as adoption examples. When an adopter asks "what does a real ACT manifest look like?" the answer is `tests/fixtures/PRD-10/manifest-minimal.json`.

### CI gating

PRDs are not marked Implemented unless:

1. All conformance fixtures pass.
2. Coverage budget met for the affected package(s).
3. Integration suite green.
4. At least one e2e example exercises the PRD's surface area.

CI enforces this via per-PRD acceptance scripts under `tests/acceptance/PRD-NN.sh`.

---

## Prompts (W-01 through W-14)

Each prompt below is a self-contained block, ready to paste into a fresh Claude Code session.

### W-01 — Resolve a strategic decision into an ADR

**Purpose:** Convert a D-NN open decision in `prd/00-decisions-needed.md` into an ADR.

**When to run:** When the spec owner is ready to make a strategic call.

**Prompt:**

```
You are working in /home/user/ACT on branch claude/act-spec-planning-sxK1D.

Resolve decision D-NN in prd/00-decisions-needed.md (replace NN with the actual ID, e.g., D-01).

1. Read prd/00-decisions-needed.md and find D-NN.
2. Read adr/0000-template.md for the ADR format.
3. If you need comparison data (e.g., "what governance models do similar specs use?"), spawn the `researcher` agent first. Otherwise proceed.
4. Ask the user (via AskUserQuestion) which option they choose, or accept their explicit answer if they provided one in the prompt.
5. Write adr/NNNN-<slug>.md (next available number, e.g., adr/0004-spec-governance.md). Status: Proposed.
6. Spawn the `reviewer` agent on the new ADR. Iterate based on feedback.
7. When ADR is acceptable, change Status to Accepted.
8. Update prd/00-decisions-needed.md: change D-NN status from "Open" to "Decided in ADR-NNNN". Update the tracking table at the bottom.
9. Identify PRDs that cite this decision (check prd/00-INDEX.md and prd/00-gaps-and-resolutions.md). Flag them so they can be updated next time they're touched.
10. Stage commit: branch, commit, push (only on user signal).
```

### W-02 — Research prior art for a PRD

**Purpose:** Gather context before drafting a PRD.

**When to run:** Stage 2 of the PRD authoring loop, before W-03.

**Prompt:**

```
You are working in /home/user/ACT on branch claude/act-spec-planning-sxK1D.

Research prior art for PRD-NN — <title from prd/00-INDEX.md>.

1. Read prd/00-INDEX.md to find PRD-NN's scope, dependencies, and references.
2. Read DRAFT-spec-v0.1.md sections referenced in PRD-NN's dependencies.
3. Read adr/ directory for any ADRs PRD-NN cites.
4. Read prd/00-gaps-and-resolutions.md for G-NN gaps PRD-NN must resolve.
5. Spawn the `researcher` agent (forge plugin) with this brief:
   - Topic: <PRD topic>
   - Standards to survey: RFC 2119, RFC 7232, RFC 8288, BCP-47, JSON Schema 2020-12, Schema.org, MCP spec, llms.txt, llms-full.txt, NLWeb, OpenAPI 3.1, JSON-LD.
   - Existing implementations to survey: <relevant: e.g., for PRD-12 content blocks, look at MDAST, Portable Text, Slate, ProseMirror, Notion blocks>.
   - Output: notes appended to prd/PRD-NN-<slug>/research.md (create the directory).
6. After the researcher finishes, summarize the top 5 findings in chat for the user to review before W-03.
```

### W-03 — Draft a PRD from the template

**Purpose:** Produce the first complete draft of a PRD.

**When to run:** After W-02, with research notes available.

**Prompt:**

```
You are working in /home/user/ACT on branch claude/act-spec-planning-sxK1D.

Draft PRD-NN — <title> using prd/00-template.md as the section structure.

1. Read prd/00-template.md (canonical structure).
2. Read prd/PRD-NN-<slug>/research.md (research notes from W-02).
3. Read prd/00-INDEX.md row for PRD-NN (dependencies, blocks, scope).
4. Read prd/00-gaps-and-resolutions.md for every G-NN gap that affects this PRD. Cite each in the relevant section.
5. Read adr/ for ADRs PRD-NN must cite.
6. Read DRAFT-spec-v0.1.md sections this PRD supersedes.
7. Write prd/NN-<slug>.md filled per the template.
8. Use RFC 2119 MUST/SHOULD/MAY consistently in the Specification section.
9. Include at least one full worked example.
10. Enumerate test fixtures (positive + negative) under "Test fixtures". Fixtures themselves are written by W-06.
11. Do NOT invent technical resolutions. If a gap is unresolved, leave it in "Open questions" with a TODO and surface it for ADR creation.
12. Set Status: Draft. Set Phase per INDEX. Set Conformance level (Core | Standard | Plus | "Outside conformance levels").
13. Update prd/00-INDEX.md: change PRD-NN status from Unauthored to Draft.
```

### W-04 — Verify a drafted PRD

**Purpose:** Mechanical correctness check before review.

**When to run:** After W-03, before W-05.

**Prompt:**

```
You are working in /home/user/ACT on branch claude/act-spec-planning-sxK1D.

Verify prd/NN-<slug>.md.

Spawn the `verifier` agent (forge plugin) with this checklist:

1. Section structure matches prd/00-template.md (all required sections present in correct order).
2. JSON Schema blocks (inline or referenced) are valid JSON Schema 2020-12.
3. Internal links resolve (other PRDs, ADRs, gap IDs all exist).
4. Every MUST/SHOULD/MAY follows RFC 2119 phrasing (no "must" lowercase as a normative term; no "should" without "SHOULD").
5. Every requirement is testable (cross-reference Test fixtures section).
6. Conformance level declared in Status matches the features specified (Core features only in Core PRDs, etc.).
7. Cited gaps (G-NN) and ADRs all exist.
8. Examples parse as valid JSON / valid code.
9. Acceptance criteria checkboxes are concrete and verifiable.

Output: pass/fail report, fix-list. If fail, edit the PRD to address the fix-list and re-run verifier until green.

When verifier passes, change Status from Draft to In review.
```

### W-05 — Review a drafted PRD

**Purpose:** Adversarial critique pass — what's missing, contradictory, over-engineered.

**When to run:** After W-04, before Acceptance.

**Prompt:**

```
You are working in /home/user/ACT on branch claude/act-spec-planning-sxK1D.

Review prd/NN-<slug>.md.

Spawn the `reviewer` agent (forge plugin) with this brief:

You are reviewing a PRD for the ACT (Agent Content Tree) spec. Read it adversarially:

- What's missing? Look at PRDs in adjacent series for surface area this PRD should address but doesn't.
- What's contradictory? Cross-check against cited ADRs and other Accepted PRDs.
- What's over-engineered? Flag any feature without clear adopter demand.
- What's under-specified? Find every "MAY" — is it truly optional, or under-specified that should be MUST/SHOULD?
- What breaks at scale? Walk through the spec with a 10K-node site, then a 1M-node site.
- What breaks for non-default audiences? React-only spec with Vue/Angular ignored? English-only with i18n ignored?
- What invites adoption-failure? Is there any feature that requires authors to do work they won't do?

Output: review document at prd/NN-<slug>/review.md with prioritized findings (must-fix / should-fix / nice-to-have).

Iterate: address each must-fix and should-fix. Re-run reviewer until clean (or with documented decisions to defer specific points).

When clean, change Status from In review to Accepted. Update prd/00-INDEX.md.
```

### W-06 — Generate test fixtures from a PRD

**Purpose:** Write the conformance fixtures the PRD enumerates.

**When to run:** After W-05, before W-07.

**Prompt:**

```
You are working in /home/user/ACT on branch claude/act-spec-planning-sxK1D.

Generate test fixtures for PRD-NN.

1. Read prd/NN-<slug>.md "Test fixtures" section. Each fixture has a name, what it tests, expected pass/fail.
2. For each fixture:
   - Write the input file(s) at tests/fixtures/PRD-NN/<fixture-name>/input/...
   - Write the expected output file(s) at tests/fixtures/PRD-NN/<fixture-name>/expected/...
   - Write a fixture metadata file at tests/fixtures/PRD-NN/<fixture-name>/fixture.json with { "description", "expected_outcome": "pass"|"fail", "applies_to_conformance_levels": ["Core","Standard","Plus"] }.
3. Fixtures MUST be real-world-shaped: a "site" fixture is an actual minimal site that builds; a "node" fixture is bytes a server would actually return.
4. Negative fixtures (expected_outcome: "fail") MUST include the exact error code from prd/00-gaps-and-resolutions.md G-A4.
5. Add fixtures to the validator's discovery list at tests/fixtures/index.json.
6. Run the validator (`act-validate tests/fixtures/PRD-NN/`) — it should report all fixtures discoverable but unpassable until implementation exists. That's correct (TDD red).
```

### W-07 — Invoke `mission-planner` for PRD implementation

**Purpose:** Generate the team blueprint for implementing a PRD.

**When to run:** After W-06, when PRD is Accepted and fixtures exist.

**Prompt:**

```
You are working in /home/user/ACT on branch claude/act-spec-planning-sxK1D.

Use the `mission-planner` skill (from the forge plugin, jdforsythe/forge).

Mission: implement PRD-NN — <title>. Acceptance criteria are in prd/NN-<slug>.md under "Acceptance criteria" and "Test fixtures".

Constraints:
- Team must include a TDD-driven implementer who runs the failing fixtures from tests/fixtures/PRD-NN/ first and writes code until they pass.
- Team must include a coverage auditor who confirms unit ≥90%, integration ≥80%, e2e smoke + golden-output.
- Use the `verifier` and `reviewer` infrastructure agents as final gates.
- Recommended topology:
  - **Pipeline** (researcher → fixture-validator → implementer → integrator → reviewer → coverage-auditor) for spec/SDK PRDs.
  - **Parallel** (per-language SDK implementer) for the 50-series.
  - **Coordinator** for 70-series example builds (each example is its own subteam).
  - **Hierarchical** for XL PRDs (PRD-72, PRD-75, PRD-76).

Output:
1. Team blueprint at teams/PRD-NN.json (named agents, topology, hand-off contracts).
2. Execution prompt I can paste to spawn the team (call this W-08).
3. Pre-flight checklist: any agents in the blueprint that don't yet exist in the agent library — flag for `agent-creator` (forge skill).

Do not spawn the team in this step. Just plan and emit the blueprint.
```

### W-08 — Spawn implementation team from blueprint

**Purpose:** Realize the team blueprint and start implementation.

**When to run:** After W-07.

**Prompt:**

```
You are working in /home/user/ACT on branch claude/act-spec-planning-sxK1D.

Spawn the implementation team for PRD-NN per teams/PRD-NN.json.

1. Read teams/PRD-NN.json.
2. For each agent in the blueprint:
   - If the agent already exists (check via forge `librarian` skill), reference it.
   - If not, use the forge `agent-creator` skill to spawn it with the role definition from the blueprint.
3. Hand the team the PRD (prd/NN-<slug>.md) and fixtures (tests/fixtures/PRD-NN/).
4. The team executes the topology from the blueprint, with each role producing artifacts as specified.
5. Monitor progress via the team lead's status reports. Surface blockers to the user.

Do NOT bypass the team's process. The team owns the implementation; this prompt orchestrates them.
```

### W-09 — Run TDD red→green→refactor loop

**Purpose:** The implementer's inner loop.

**When to run:** Inside the implementation team, per acceptance criterion.

**Prompt:**

```
You are the implementer agent for PRD-NN. Working directory: /home/user/ACT.

For acceptance criterion AC-X (from prd/NN-<slug>.md):

1. RED: identify the failing fixture(s) at tests/fixtures/PRD-NN/ that prove AC-X. If none exist, write one — fixture-first.
2. RED: run the test suite. The fixture(s) MUST fail. If they pass without any code, the test is wrong; fix it.
3. GREEN: write the minimum code to make the fixture(s) pass. No extra features. No premature abstraction.
4. GREEN: run the test suite. Confirm all fixtures pass and no other tests regressed.
5. REFACTOR: clean up — remove duplication, extract obvious helpers, rename for clarity. Re-run tests after each change.
6. Commit a small, focused commit with message "PRD-NN AC-X: <brief>".

Repeat per criterion until all ACs pass. Do not move to the next criterion until the current one is green.
```

### W-10 — Coverage audit

**Purpose:** Confirm coverage budget is met.

**When to run:** After all ACs green; before W-13.

**Prompt:**

```
You are the coverage-auditor agent for PRD-NN. Working directory: /home/user/ACT.

1. Run the test suite with coverage:
   - TypeScript: `vitest run --coverage`
   - Python: `pytest --cov=<package> --cov-report=html`
   - Ruby: `rspec --format documentation && coverage/`.
2. Check budgets per prd/00-workflow.md "Coverage budgets":
   - Core libs: 90% line / 85% branch.
   - Adapters: 80% line.
   - Generators: 85% line.
   - Examples: smoke + golden-output (no per-line budget).
3. If under budget:
   - Identify uncovered lines/branches.
   - Decide: write tests, OR justify exclusion (rare; document in PRD's "Test fixtures" section).
   - Iterate until budget met.
4. Output: coverage report at tests/coverage/PRD-NN/index.html plus a summary in chat.
```

### W-11 — E2E example build

**Purpose:** For 70-series PRDs, build the example site and run e2e tests against it.

**When to run:** Inside implementation of any 70-series PRD.

**Prompt:**

```
You are the e2e agent for PRD-7N (a 70-series example). Working directory: /home/user/ACT/examples/<example-slug>/.

1. Install dependencies: `npm install` / `pip install -r requirements.txt` / etc.
2. Build the example: `npm run build` / framework-specific build command.
3. For static profile examples: serve the build output via `npx serve` on port 3000.
4. For runtime profile examples: start the runtime app (e.g., `npm run dev` for Next.js).
5. Run the e2e suite at examples/<example-slug>/e2e/:
   - Fetch /.well-known/act.json.
   - Walk the index.
   - For each node in the index, fetch and validate against PRD-10/12 schemas.
   - For runtime examples: authenticate as each fixture user; verify per-tenant scoping; verify ETag revalidation; verify 401/404 leak prevention.
6. Deploy to a preview URL (Vercel preview or Cloudflare Pages preview) so the user can inspect.
7. Output: e2e report at examples/<example-slug>/e2e-report.html plus preview URL.
```

### W-12 — Cross-PRD integration test

**Purpose:** Validate that PRDs sharing surface area interoperate end-to-end.

**When to run:** When two PRDs that depend on each other (e.g., PRD-16 + PRD-51, or PRD-30 + PRD-31 + PRD-45) are both Implemented.

**Prompt:**

```
You are working in /home/user/ACT on branch claude/act-spec-planning-sxK1D.

Run cross-PRD integration test for PRD-NN ↔ PRD-MM.

1. Identify the shared surface from prd/00-INDEX.md dependency graph.
2. Look for an existing example under examples/ that exercises both PRDs. If none, write a minimal one at examples/integration-PRD-NN-PRD-MM/.
3. Build it. Walk it. Validate every artifact.
4. Specifically check:
   - Fixtures from tests/fixtures/PRD-NN/ work against the PRD-MM implementation (e.g., a manifest fixture from PRD-10 is correctly served by the PRD-51 Next.js SDK).
   - Versioning policy (PRD-18) is correctly applied across both.
   - Conformance level (PRD-17) declared in PRD-NN's manifest matches what PRD-MM's implementation actually serves.
5. Output: integration report. If broken, file an issue against the relevant PRD and downgrade its status to "In review" pending fix.
```

### W-13 — Acceptance gate (mark PRD Implemented)

**Purpose:** Final gate before flipping a PRD to Implemented.

**When to run:** After W-09 + W-10 + W-11 (where applicable) all green, plus W-12 for any cross-PRD dependencies.

**Prompt:**

```
You are working in /home/user/ACT on branch claude/act-spec-planning-sxK1D.

Acceptance gate for PRD-NN.

Verify ALL of:
1. All conformance fixtures at tests/fixtures/PRD-NN/ pass against the implementation.
2. Coverage budget met per W-10.
3. Integration suite green (CI: `npm test` or equivalent).
4. At least one e2e example exercises this PRD's surface (W-11 was run for 70-series PRDs; W-12 was run for cross-PRD pairs).
5. Reviewer agent's review.md has no unaddressed must-fix items.

If all true:
- Update prd/NN-<slug>.md Status: Accepted → Implemented.
- Update prd/00-INDEX.md row.
- Add a Changelog entry to the PRD.
- Stage commit.

If any false:
- Document the gap in chat.
- Surface to user. Do not flip to Implemented.
```

### W-14 — Publish

**Purpose:** Ship a release of the spec and reference implementations.

**When to run:** When a coherent set of PRDs is Implemented and the user wants to cut a release.

**Prompt:**

```
You are working in /home/user/ACT on branch claude/act-spec-planning-sxK1D.

Publish ACT v<X.Y>.

1. Confirm with user: which PRDs are in this release? (Check status: Implemented in prd/00-INDEX.md.)
2. Build the spec site:
   - Run the spec-site builder (TBD: PRD-83 or separate tooling).
   - Output: static HTML site under dist/spec-site/.
   - Each PRD becomes a page; cross-references resolve.
   - Validate all internal links.
3. Publish npm packages:
   - Identify packages in this release (under packages/ in the monorepo).
   - Bump versions per spec versioning policy (PRD-18). MAJOR for incompatible changes; MINOR for additive.
   - Run `npm publish` per package (under @act/ scope).
4. Deploy validator:
   - Build the validator UI (PRD-60).
   - Deploy to validator.act-spec.org (or whatever D-08 resolved to).
5. RFC submission (if D-01 governance ADR specifies):
   - Submit to IETF / W3C per the governance process.
6. Announce:
   - Tag the release in git: `git tag -a vX.Y -m "ACT vX.Y"`.
   - Write release notes summarizing PRDs in this release.
   - Push tag.
7. Update prd/00-INDEX.md: add a "Released in vX.Y" column note for each Implemented PRD in this release.
```

---

## Quick start (TL;DR)

For someone returning to the project in a fresh session:

1. **Read** `prd/00-INDEX.md` to find the next Unauthored PRD whose dependencies are Accepted.
2. **Run W-02** to research prior art.
3. **Run W-03** to draft the PRD from `prd/00-template.md`.
4. **Run W-04 + W-05** to verify and review.
5. **Run W-06** to write conformance fixtures.
6. **Run W-07 + W-08** to spawn the implementation team.
7. **Run W-09 → W-10 → W-11/W-12** during implementation.
8. **Run W-13** to mark Accepted/Implemented.
9. **Stage commit and push**.

For strategic decisions (D-01 through D-12 in `prd/00-decisions-needed.md`):

- **Run W-01** per decision. Each produces an ADR-NNNN under `adr/`.

For releases:

- **Run W-14** when ready to cut a version.

## Changelog

- 2026-05-01 — Initial workflow doc. 14 prompts (W-01 through W-14). Lifecycle stages defined. Forge integration documented. TDD strategy with explicit per-layer coverage budgets.
