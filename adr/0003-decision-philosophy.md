# ADR-0003 — Decision philosophy: technical resolutions proposed inline; strategic decisions surfaced for the spec owner

## Status

Accepted

## Context

ACT v0.1 surfaced roughly thirty unresolved questions during the seven-perspectives critique in `DRAFT-spec-v0.1.md`. They split, in practice, into two unequal classes:

- **Technical / wire-format gaps.** Questions like the grammar for node IDs, the shape of the error envelope, the rules for deriving ETags, the canonical encoding of variant axes. These usually have a clearly best answer once you stare at the constraints for ten minutes; they are tedious for a spec owner to adjudicate one by one and the cost of getting them slightly wrong early is recoverable.
- **Strategic, positioning, and governance choices.** The product name to ship under, which standards body (if any) to engage, which design partners to court, which vendor to align with first, what license to publish under. Reasonable people disagree on these based on priorities only the spec owner has visibility into, and they shape the project for years.

Treating both classes the same risks one of two failure modes: (a) burning the spec owner's attention on mechanical decisions until they disengage, or (b) the planning author over-reaching into product strategy and quietly making decisions that should have been escalated.

## Decision

We will classify each unresolved question as **technical** or **strategic**, with bias toward strategic when in doubt. Technical questions get a proposed resolution recorded inline in `prd/00-gaps-and-resolutions.md` with rationale; the resolution stands unless the spec owner objects. Strategic questions are listed in `prd/00-decisions-needed.md` with options, tradeoffs, and a recommended default. Each strategic question requires explicit spec-owner sign-off before any PRD that depends on it can be marked Accepted.

## Consequences

### Positive

- Spec-owner attention is rationed to high-leverage decisions where their judgment is load-bearing.
- Mechanical gaps do not bottleneck PRD authoring; the planning author can keep moving.
- Every technical resolution carries written rationale, so disputes later have something to grip.
- Strategic decisions become formal ADRs once made, producing a clean governance record.

### Negative

- Classification itself is a judgment call; the planning author may misclassify a question with strategic dimensions they did not see.
- "Resolution stands unless objected" risks soft consensus where the spec owner skims and a flawed default ships.
- Strategic questions can sit unresolved indefinitely if not actively pulled through; the process does not enforce timeliness on its own.

### Neutral

- Technical resolutions live in the gaps doc and do not require ADRs unless they later become contested.
- The classification can be revised: a technical resolution that turns out to have strategic implications gets escalated and the original entry is annotated.

## Alternatives considered

- **Surface every decision to the spec owner.** Rejected: does not scale past the first dozen questions; spec owner disengages.
- **Auto-resolve every decision.** Rejected: removes the spec owner from strategic loops where their judgment is the whole point.
- **Separate RFC process for each unresolved question.** Rejected: process overhead too high for a pre-v1.0 project with one author and one reviewer.

## Links

- Related PRDs: `prd/00-gaps-and-resolutions.md`, `prd/00-decisions-needed.md`
- Related ADRs: ADR-0001 (PRD style), ADR-0002 (output location)
- Source: `DRAFT-spec-v0.1.md` §10 (open questions)

## Changelog

- 2026-05-01 — Proposed
- 2026-05-01 — Accepted
