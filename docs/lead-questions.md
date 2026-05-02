# Open questions for the Lead TS Engineer / QA / BDFL

**Owner:** BDFL (routes to Lead / QA / ADR-005 author).
**Filed by:** Spec Steward (out-of-scope items surfaced during amendment triage).

This file captures questions that fell out of Phase 6.1 amendment triage but are **outside the Spec Steward's decision boundary** (per `agents/spec-steward.md` — "Out of scope: setting coverage targets (already pinned in `docs/workflow.md`; QA enforces)"). The Spec Steward surfaces them; the BDFL routes them.

---

## LQ-1 — Validator branch-coverage threshold relaxed from 100% → 99 (slice 5411f4d)

**Surfaced from:** A9 triage (2026-05-01). Lead+QA pairing at G2 sign-off, open question #3.

**What changed:**
- The Lead added `probeCapabilityBand` to `packages/validator/src/walk.ts` to make the validator's level-inference correct per PRD-600-R18 / PRD-107-R6/R8/R10 (filed and closed as A9 — **strict reading of the spec, no amendment needed**).
- Side effect: branch coverage dropped 100% → 99.83% with one uncovered branch at `walk.ts:604` (the `gaps.some((g) => g.level === band)` early-return inside `synthesizeUnmetBandGaps`).
- The Lead lowered the threshold in `packages/validator/vitest.config.ts` from 100 → 99 with an inline comment.

**Why it's surfaced here:**

`docs/workflow.md`'s testing-strategy table pins **100% branch on the wire-format core** (the validator is wire-format core). That's a workflow constraint, not a normative PRD requirement, so the Spec Steward has no authority to either bless or block the relaxation. But A9's resolution depends on `probeCapabilityBand` shipping, and `probeCapabilityBand` is the proximate cause of the threshold change — so the audit trail needs the question to land somewhere.

**Three options for the Lead / QA / BDFL:**

1. **Cover the missing branch.** Write a test that exercises the dedup short-circuit in `synthesizeUnmetBandGaps` (a manifest where Core + Standard both fail and a per-band gap is already in the list before the synthesizer runs). Restores 100% branch coverage and reverts the vitest.config change. Smallest blast radius.
2. **Raise the threshold-change to ADR-005.** Document why one branch in a defensive dedup is acceptably uncovered, pin the new threshold (99 or 99.5) in workflow.md alongside an exception list, and amend ADR-004 to cite ADR-005. Higher cost; durable answer.
3. **Revert `probeCapabilityBand` if it can't be tested.** Last-resort. Restores the prior behaviour (default-to-plus) which A9 documents as a divergence from PRD-600-R18, so this option blocks the slice on a separate spec-conformance fix. Don't pick this without a replacement strategy for level-inference.

**Recommendation (Spec Steward, advisory):** option 1. The uncovered branch is a single dedup guard whose contract is "don't double-emit a gap"; that's testable in two lines. Falling back to option 2 is fine if the Lead has a deeper reason to keep the helper as-is. Option 3 should be off the table — the strict reading of PRD-600-R18 is mandatory and the Lead's probe is correct.

**Resolution (2026-05-02, BDFL → Lead):** option 1 chosen.

- New test added at `packages/validator/src/walk.test.ts` ("PRD-107-R19 dedupe predicate: exercises BOTH truthy and falsy states of `g.level === band`"). The test drives `pushDeclaredButNotAchievedGaps` with declared='plus' and a single pre-existing standard-band gap so `unmetBands = ['standard', 'plus']`; iteration 1 fires the predicate's truthy state (continue), iteration 2 fires the falsy state (push synth gap). One walkStatic call hits both branches.
- Side note recorded inline: the older "PRD-107-R19 dedupe SKIP branch" test that immediately precedes it was producing additional core-band schema gaps (single-char id violations of PRD-100-R10) that sink `inferAchievedLevel` to `null` and short-circuit the synth function — so it never actually exercised the predicate. The new test does. The old test still passes its own assertions and stays as documentation of the dedupe SKIP design intent.
- `packages/validator/vitest.config.ts` `branches` threshold restored to 100. `pnpm -F @act-spec/validator test:coverage` now reports 100% line / 100% branch / 100% function / 100% statement on every file in `src/`. 211 tests pass (210 → 211).
- No PRD edit and no ADR-005 needed; the strict reading of PRD-600-R18 (`probeCapabilityBand`) ships unchanged.

**Status:** Closed 2026-05-02.

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Spec Steward | Initial creation. Filed LQ-1 from A9 triage; Spec Steward declines to set coverage targets (per role boundary) and routes to BDFL. |
| 2026-05-02 | Jeremy Forsythe (BDFL) → Lead | Closed LQ-1 via option 1 (covered the missing branch). New test exercises both truthy/falsy states of the dedupe predicate; vitest branch threshold restored to 100. |
