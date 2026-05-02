---
goal: Implement ACT v0.1 (Agent Content Tree) per the 57 accepted PRDs across the 100/200/300/400/500/600/700/800 series, TypeScript-only first-party
domain: software
complexity: team
topology: hierarchical
agent_count: 5
estimated_cost_tier: high
phase_in_workflow: Phase 5 — Assemble the implementation team (per docs/workflow.md)
last_updated: 2026-05-02
---

# ACT v0.1 implementation team blueprint

## Goal recap

Implement ACT v0.1 in TypeScript per the 57 accepted PRDs in `prd/`. Ship a vertical slice (PRD-700: Astro + markdown minimal docs site, end-to-end through schemas → validator → markdown adapter → Astro generator → example) before fanning out across four parallel tracks. Every leaf package passes the PRD-600 conformance suite as a CI gate; wire-format core (PRD-100/101/102/103/109, PRD-600) requires 100% line coverage and >=75% mutation score. Strict TDD throughout.

The four spec-only PRDs (402 Hugo, 403 MkDocs, 503 FastAPI, 504 Rails) ship as text only; community ports invited per decision Q3.

## Why this composition (and not the SaaS template)

The Forge `saas-product-team` template (Product Manager, Software Architect, Lead Engineer, QA Engineer) is a poor fit because:

1. **No Product Manager needed** — Phase 0–4 already produced 57 accepted PRDs. Requirements work is closed.
2. **No Architect needed** — `000-decisions-needed.md` Q1–Q12 already pinned governance, naming, language, license, conformance levels, versioning, MAJOR/MINOR rules, etc.
3. **Two distinct implementation domains** — build-time producers (adapters / components / generators) and runtime / tooling (SDKs / validator / MCP bridge / inspector) require different expertise (filesystem & AST traversal vs HTTP / protocols / framework SDK shapes). Splitting across two engineers keeps the leaf-PRD volume tractable.
4. **Spec authority must be its own role** — the amendments queue is non-trivial (4 entries already; more will surface during implementation). Conflating spec stewardship with QA blurs decision authority.

## Topology rationale

**Hierarchical** with one central coordinator (Lead TS Engineer) flanked by upstream and downstream gates (Spec Steward, QA Verifier) and two parallel implementers (Adapter/Generator Engineer, Runtime/Tooling Engineer).

**Alternatives considered:**

- **Sequential pipeline** — fits the vertical slice (Phase 6.1) but breaks for Phase 6.2's parallel expansion across four tracks.
- **Parallel-independent** — fits Phase 6.2 but loses cross-cutting coordination (monorepo layout, shared types, CI). Vertical slice would be uncoordinated.
- **Centralized coordinator** without flanking gates — collapses the spec-authority role into the Lead. Amendment triage becomes a side-of-desk task; coverage / conformance gates lose their independence from the implementer asking to be approved.

Hierarchical resolves both phases: the Lead coordinates the slice and shared infrastructure; the two parallel engineers fan out in Phase 6.2; gates run independently of the coordinator.

## Team roster

| Role | Real-world title | File | Phase 6.1 (slice) | Phase 6.2 (expansion) |
|---|---|---|---|---|
| **Spec Steward** | Spec Authority / Standards Editor | `.claude/agents/spec-steward.md` | Owns schemas; gates JSON-Schema lock; triages A1–A4 amendments | Triages new amendments surfaced during implementation; signs off PRD spec changes |
| **Lead TS Engineer** | Tech Lead / Staff Engineer | `.claude/agents/lead-typescript-engineer.md` | Owns monorepo scaffold + slice delivery; implements PRD-201 + PRD-401 personally | Coordinates cross-track decisions; reviews packaging / shared-types changes |
| **Adapter & Generator Engineer** | Senior Software Engineer (Build-time) | `.claude/agents/adapter-generator-engineer.md` | (Pairs with Lead on slice for PRD-201/401) | Owns 202–208, 301–303, 402–409 leaves |
| **Runtime & Tooling Engineer** | Senior Software Engineer (Runtime) | `.claude/agents/runtime-tooling-engineer.md` | Implements PRD-600 validator with QA on the slice | Owns 500–505, 601, 602 |
| **QA / Conformance Verifier** | QA Engineer / Conformance Lead | `.claude/agents/qa-conformance-verifier.md` | Pairs with Lead on validator TDD; runs slice conformance gate | Runs nightly conformance suite; verifies each leaf PRD via `forge:verifier` |

## Artifact chain

Typed deliverables and explicit handoff formats. Every horizontal arrow has a quality gate.

```
Spec Steward                       Lead TS Engineer            Adapter/Generator        Runtime/Tooling          QA Verifier
─────────────                      ─────────────────           ──────────────────       ────────────────         ─────────────

(reads accepted PRDs)
         │
         ▼
schemas/{100,101,102,103,109}/  ─►  monorepo scaffold     ─►  packages/markdown    ─►  packages/validator   ─►  PRD-600 conformance
   *.schema.json (locked)            (packages/, CI,         packages/astro-gen     packages/runtime-next       on PRD-700 example
   fixtures/{prd-id}/positive/       tsconfig, lint,         packages/...           packages/inspector          ────► VERTICAL SLICE GREEN
   fixtures/{prd-id}/negative/       changesets)             packages/...           packages/mcp-bridge         ────► fans out to Phase 6.2
                                                                                                                ────► nightly conformance
amendments-queue.md                                                                                                  matrix
   (A1–A4 triaged before
    A4-blocked impl starts)
```

### Handoff formats (typed)

- **Spec Steward → Lead/Engineers:** JSON Schema files in `schemas/{100,101,102,103,109}/*.schema.json`, conformance fixtures in `fixtures/{prd-id}/{positive,negative}/`, README index linking each schema to its PRD requirement IDs.
- **Lead → Engineers:** monorepo at `packages/*` with shared `tsconfig.base.json`, `package.json` workspace config (pnpm), CI skeleton at `.github/workflows/`, ADRs at `docs/adr/` for cross-cutting decisions.
- **Engineers → QA:** package directory with passing unit tests, integration tests, and a `pnpm run conformance` script that runs the PRD-600 suite. `Implementation status` row added to `prd/000-INDEX.md`.
- **QA → Spec Steward (loop-back):** amendment requests filed in `docs/amendments-queue.md` when implementation surfaces spec ambiguity.

## Quality gates

Every gate has explicit acceptance criteria. None of them is "review."

### Gate G1 — Schema lock (Spec Steward → Lead)

- [ ] Every requirement ID `PRD-{NNN}-R{n}` in PRD-100/101/102/103/109 has a corresponding constraint expressible in JSON Schema or a documented justification for why not.
- [ ] Every positive fixture validates green; every negative fixture rejects with a documented error code per PRD-600's reporter shape.
- [ ] Schema files live at `schemas/{NNN}/*.schema.json` and are referenced by their `$id`.

### Gate G2 — Vertical slice green (Lead + QA → Steward sign-off)

- [ ] PRD-700 example builds clean (`pnpm -C examples/700-tinybox build`).
- [ ] PRD-600 validator returns `gaps: []` against PRD-700 output.
- [ ] Reported `achieved.level` equals declared `standard`.
- [ ] PRD-100/101/102/103/109 fixtures all pass.
- [ ] Mutation score on wire-format core ≥ 75% (stryker).
- [ ] Coverage: 100% line on PRD-600 validator + wire-format core; ≥85% line on PRD-201 + PRD-401.
- [ ] One ADR landed at `docs/adr/001-monorepo-layout.md` documenting the package layout decision.

### Gate G3 — Amendment triage before A4-blocked work

- [ ] Amendments A1, A3, A4 (trivial / additive clarifications) triaged via `forge:reviewer` and either edited inline or routed through `In review`. **A4 (PRD-602 hybrid bridge) MUST be resolved before PRD-602 / PRD-706 implementation.**
- [ ] A2 (PRD-404 parseMode wiring) triaged but resolution may defer to v0.2 if BDFL decides; the PRD-701 example does not depend on it.

### Gate G4 — Per-leaf-PRD verification (`forge:verifier`)

For each implemented PRD, every criterion APPROVED with evidence:

1. Every `PRD-{NNN}-R{n}` is testable and tested (test cites the requirement ID).
2. All positive fixtures pass.
3. All negative fixtures fail with the documented error code.
4. Coverage targets met per layer (95%/100% wire-format core; 85% elsewhere).
5. Conformance suite (PRD-600) passes against the implementation's example output.
6. Security section addresses the actual implementation surface, not theory-only items.

### Gate G5 — Nightly conformance matrix

QA runs the full PRD-600 suite nightly across every package + every PRD-700-series example. Failures open `docs/amendments-queue.md` entries or implementation tickets.

## Phase 6 task ordering (recommended)

### Phase 6.1 — Vertical slice (sequential)

Single ordered chain. No fan-out until G2 closes.

| Order | Owner | Deliverable | Gate |
|---|---|---|---|
| 1 | Spec Steward | `schemas/{100,101,102,103,109}/` with all 100-series fixtures green | G1 |
| 2 | Lead TS Engineer | Monorepo scaffold (`packages/`, `pnpm-workspace.yaml`, `tsconfig.base.json`, CI skeleton, changesets) | (informal — Steward + QA review) |
| 3 | Lead + QA | `@act/validator` (PRD-600) — TDD against 100-series fixtures, 100% line + branch coverage, stryker ≥75% | (informal — green tests) |
| 4 | Lead | `@act/markdown-adapter` (PRD-201) — implements PRD-200 framework first, then PRD-201 leaf | (informal) |
| 5 | Lead | `@act/astro-generator` (PRD-401) — implements PRD-400 framework, then PRD-401 leaf | (informal) |
| 6 | Lead + QA | `examples/700-tinybox/` — PRD-700 reference build; runs validator end-to-end | **G2** |

When G2 closes, the slice is green and Phase 6.2 fans out.

### Phase 6.2 — Parallel expansion (four tracks)

Tracks run concurrently. Each track picks its next PRD by `prd/000-INDEX.md` dependency order.

#### Track A — Adapters (Adapter/Generator Engineer)

Order: PRD-208 (programmatic, simplest after 201) → PRD-202 (Contentful) → PRD-203 (Sanity) → PRD-204 (Storyblok) → PRD-205 (Strapi) → PRD-206 (Builder) → PRD-207 (i18n; depends on PRD-104). Each closes via G4.

#### Track B — Components + remaining generators (Adapter/Generator Engineer)

Order: PRD-300 (component contract — framework) → PRD-301 (React) → PRD-302 (Vue) → PRD-303 (Angular) → PRD-404 (Docusaurus, after A2 triaged) → PRD-405 (Next.js static) → PRD-406 (Remix) → PRD-407 (Nuxt) → PRD-408 (Eleventy) → PRD-409 (CLI). Each closes via G4.

(PRD-402 Hugo, PRD-403 MkDocs ship as spec text only — not implemented in v0.1.)

#### Track C — Runtime SDK (Runtime/Tooling Engineer)

Order: PRD-500 (runtime contract — framework) → PRD-501 (Next.js runtime) → PRD-502 (Express) → PRD-505 (generic fetch handler — smallest). Each closes via G4.

(PRD-503 FastAPI, PRD-504 Rails ship as spec text only.)

#### Track D — Tooling (Runtime/Tooling Engineer; Lead supports)

Order: PRD-601 (inspector CLI — depends only on PRD-100) → A4 amendment triage → PRD-602 (MCP bridge). PRD-600's hosted-validator UI (per Q8) lands here.

### Phase 6.3 — Examples

After enough leaves are green, the example PRDs land:

| Order | Example | Owner | Depends on |
|---|---|---|---|
| 1 | PRD-700 (already done in slice) | Lead | (slice) |
| 2 | PRD-707 Eleventy blog | Adapter/Generator | PRD-408, PRD-201 |
| 3 | PRD-701 Docusaurus large docs | Adapter/Generator | PRD-404 |
| 4 | PRD-704 e-commerce catalog | Adapter/Generator | PRD-208 |
| 5 | PRD-702 corporate marketing | Adapter/Generator | PRD-405, PRD-202, PRD-207, PRD-301 |
| 6 | PRD-705 SaaS workspace runtime | Runtime/Tooling | PRD-501, PRD-208 |
| 7 | PRD-706 hybrid + MCP | Runtime/Tooling + Adapter/Generator | PRD-409, PRD-501, PRD-602 |

(PRD-703 Hugo ships as spec text only.)

QA runs G5 across all examples nightly once each lands.

## Anti-patterns specific to this project

### Silent PRD amendment

- **Detection:** An engineer modifies code to "make the test pass" by interpreting an Accepted PRD differently than its text says.
- **Why it fails:** Phase 4 closed with PRDs Accepted; silent reinterpretation breaks the spec contract and the validator-as-source-of-truth posture.
- **Resolution:** Any spec ambiguity surfaces as an entry in `docs/amendments-queue.md`. Spec Steward triages via `forge:reviewer`. PRD edits go through the lifecycle. No exceptions.

### Coverage theater

- **Detection:** Tests written to hit lines, not to verify requirements. Coverage at 95% but mutation score below 60%.
- **Why it fails:** False confidence. Requirements drift from tests.
- **Resolution:** Every test cites a `PRD-{NNN}-R{n}` in a comment or test name. Mutation testing (stryker) on wire-format core, score floor 75%. QA rejects any PR where coverage rose without a cited requirement.

### Conformance gate skipping

- **Detection:** A package's CI does not run `pnpm run conformance` against PRD-600. Or the conformance run is allowed to fail.
- **Why it fails:** Defeats the purpose of PRD-600 as the universal gate. Spec drift goes undetected.
- **Resolution:** Repository-wide CI lint enforces `pnpm run conformance` script + non-skip job in every leaf package's workflow. QA owns the lint rule.

### Vertical-slice abandonment

- **Detection:** Engineers start parallel tracks before G2 closes because "the validator is mostly working."
- **Why it fails:** Without a green slice, parallel tracks can't run their conformance gate. Coordination tax explodes.
- **Resolution:** Lead TS Engineer is the single owner of G2 closure. No track starts until Lead announces.

### Adapter/generator leaf overreach

- **Detection:** A leaf adapter (e.g., PRD-204 Storyblok) starts requesting changes to PRD-200 framework "to make implementation cleaner."
- **Why it fails:** Framework changes after the fact ripple through every leaf. Was the issue surfaced too late.
- **Resolution:** PRD-200 is locked at G2 close. Leaf-level discomfort routes through `amendments-queue.md`. Framework edits are a separate review cycle.

### Runtime/static auth confusion

- **Detection:** Runtime SDK (PRD-500/501) mounts that don't enforce per-tenant identity scoping. Cross-tenant 404s that aren't byte-equivalent (per PRD-109-R3/R11/R13).
- **Why it fails:** Security violation; the entire reason PRD-109 exists.
- **Resolution:** PRD-705 example's two-principal probe is a CI-mandatory test for any runtime SDK package. QA owns the gate.

## Estimated cost tier

**High.** Five agents × ~50 PRDs × strict TDD × 100% wire-format coverage × mutation testing implies the highest-volume implementation phase the project will see. The vertical slice alone exercises 5 framework PRDs end-to-end. Forge cost guidance suggests a 5-agent team at 7× single-agent cost; for a 50-PRD implementation surface that cost is justified by the parallelism.

## Sign-off checklist (BDFL)

- [ ] Topology choice (hierarchical, 5 agents) approved.
- [ ] Roster (Spec Steward, Lead TS Engineer, Adapter/Generator Engineer, Runtime/Tooling Engineer, QA/Conformance Verifier) approved.
- [ ] Phase 6.1 vertical slice ordering approved (Steward schemas → Lead scaffold → Lead+QA validator → Lead PRD-201 → Lead PRD-401 → PRD-700 → G2).
- [ ] Phase 6.2 parallel expansion track assignments approved.
- [ ] Phase 6.3 example ordering approved.
- [ ] Quality gates G1–G5 approved.
- [ ] Anti-pattern watchlist approved.

When all items above are checked, Phase 6 begins per the §"vertical slice" prompt block in `docs/workflow.md`.

## G2 sign-off (QA / Conformance Verifier)

Phase 6.1 G2 verdict, dated 2026-05-01 by the QA / Conformance Verifier persona. Per QA SOP-2 the verdict is per-criterion APPROVED with evidence or REJECTED with what's missing. **BDFL sign-off below remains unchecked; the BDFL signs off in the next conversation turn.**

| Criterion | Verdict | Evidence |
|---|---|---|
| PRD-700 example builds clean (`pnpm -C examples/700-tinybox build`). | **APPROVED** | Astro 4.16.19 build emits 11 HTML pages plus the ACT artifact set under `dist/.well-known/act.json` and `dist/act/`. See conformance log in `pnpm -r conformance` output (Phase 6.1 step 6). |
| PRD-600 validator returns `gaps: []` against PRD-700 output. | **APPROVED** | `pnpm -F @act-spec/example-700-tinybox validate` reports `gaps: 0`. The static walk reads manifest + index + 10 nodes + 1 subtree from `dist/`. |
| Reported `achieved.level` equals declared `standard`. | **APPROVED** | Reporter prints `declared: standard / static; achieved: standard / static`. Triggered by the new `probeCapabilityBand` helper in `@act-spec/validator/src/walk.ts` (see ADR-004 § "What was harder #2"). |
| PRD-100/101/102/103/109 fixtures all pass. | **APPROVED** | `pnpm -F @act-spec/validator conformance` sweeps 68 fixtures across 100/101/102/103/109; 23 pass, 0 fail, 45 skipped (integration-only, accounted for in `INTEGRATION_ONLY` set). |
| Mutation score on wire-format core ≥ 75% (stryker). | **APPROVED** | `pnpm -F @act-spec/validator test:mutation` reports 80.53% mutation score on `cycles.ts + etag.ts + mounts.ts + reporter.ts + schemas.ts` (570 mutants total, 457 killed, 2 timeout, 111 survived). Above the 75% G2 floor. |
| Coverage: 100% line on PRD-600 validator + wire-format core; ≥85% line on PRD-201 + PRD-401. | **APPROVED** | `@act-spec/validator` coverage: 100% line / 100% branch / 100% function / 100% statement (LQ-1 closed 2026-05-02 by adding a test that exercises both truthy/falsy states of the walk.ts:604 dedupe predicate). `@act-spec/markdown-adapter` coverage: 90.05% line. `@act-spec/astro` coverage: 95.76% line. Both ≥85%. |
| One ADR landed at `docs/adr/001-monorepo-layout.md` documenting the package layout decision. | **APPROVED** | ADR-001 present at `docs/adr/001-monorepo-layout.md` (Status: Proposed). Three additional ADRs surfaced: ADR-002 (ajv vs zod), ADR-003 (adapter / generator placement), ADR-004 (this slice retro). |

**QA verdict: G2 CLOSED.** All seven criteria APPROVED. Phase 6.2 fan-out unblocks.

## G2 sign-off (BDFL)

- [x] Slice retro (ADR-004) reviewed and accepted. (2026-05-02 — Jeremy Forsythe)
- [x] Validator semantic change (PRD-600-R18 `probeCapabilityBand` + PRD-107-R19 synth) reviewed. (Confirmed via A9 closure — strict reading of spec, no amendment needed.)
- [x] Amendment-queue entry A8 (PRD-700-R4 vs PRD-201-R23) reviewed and routed. (Closed 2026-05-01 via SOP-3 trivial inline edit on PRD-700-R4.)
- [x] ADR-001/002/003/004 promoted from `Proposed` to `Accepted`. (2026-05-02)
- [x] G2 closure announced; Phase 6.2 fan-out begins. (Pending LQ-1 + A1/A2/A3/A4 triage per Phase 6.2 prework checklist.)

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-02 | Jeremy Forsythe (BDFL) via /forge:mission-planner | Initial blueprint. Five-agent hierarchical team, custom topology. Adapted from `saas-product-team` template by replacing PM/Architect with Spec Steward (PRDs already authored, no greenfield architecture work) and splitting Lead into Lead + two parallel implementers (Adapter/Generator vs Runtime/Tooling) given the leaf-PRD volume. Five quality gates (G1 schema lock; G2 slice; G3 amendment triage; G4 per-leaf verification; G5 nightly conformance matrix) and six anti-patterns specific to this project (silent PRD amendment, coverage theater, conformance gate skipping, vertical-slice abandonment, adapter leaf overreach, runtime/static auth confusion). Awaiting BDFL sign-off on the checklist before Phase 6 begins. |
| 2026-05-02 | Jeremy Forsythe (BDFL) | G2 BDFL sign-off complete. ADR-001/002/003/004 promoted to `Accepted`. Slice retro accepted; A8 closed (SOP-3); A9 closed (strict reading). Phase 6.2 fan-out unblocks pending LQ-1 closure and A1/A2/A3/A4 triage per the prework checklist. |
