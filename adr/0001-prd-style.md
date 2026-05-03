# ADR-0001 — PRD style: hybrid engineering preamble plus RFC normative body

## Status

Accepted

## Context

ACT PRDs serve two audiences simultaneously: engineers who need to implement against the spec, and standards readers who expect normative, RFC-shaped documents. Pure RFC style is inscrutable to engineers landing cold — it omits the "why" and forces readers to reverse-engineer goals from MUST/SHOULD prose. Pure PRD style produces internal-feeling documents that cannot be cited as a standard and tend to lack the precision needed to drive interoperable implementations.

The user explicitly chose the hybrid style during the planning round. The bet is that one document carrying both halves is cheaper to maintain and harder to misread than two parallel documents per feature. The cost is longer files and the risk that the preamble and the normative body drift apart.

Related material:

- `DRAFT-spec-v0.1.md` — source draft the PRDs decompose.
- `prd/00-template.md` — canonical section ordering this ADR ratifies.
- `prd/00-INDEX.md` — catalog of all PRDs.

## Decision

We will require every numbered PRD under `prd/` to include both an Engineering preamble (Problem, Goals, Non-goals, Stakeholders, Risks, Open questions, Acceptance criteria) and a Specification section that uses normative RFC 2119 keywords (MUST, SHOULD, MAY, etc.). Smaller PRDs — adapter PRDs, narrow tooling PRDs — may carry brief preambles, but neither half may be omitted entirely. Section ordering is fixed by `prd/00-template.md` and is not negotiable per-PRD.

## Consequences

### Positive

- The spec is implementable from a single document; engineers see context before requirements.
- The same artifact functions as both a published standard and a build-team brief.
- Acceptance criteria sit next to the normative body that satisfies them, making conformance review tractable.

### Negative

- PRDs are longer than either pure form would produce.
- Preamble and spec body can contradict each other if not maintained as a unit; reviewers MUST scan both halves on every change.
- Reviewers used to one tradition or the other may find the hybrid noisy.

### Neutral

- PRDs that exceed roughly 3000 lines may need to be split into companion documents; the split convention is TBD and will be decided when the first PRD crosses that threshold.
- The hybrid style makes it harder to mechanically extract a "pure standard" view; tooling for that is out of scope for v0.1.

## Alternatives considered

- **Pure RFC style.** Rejected: hostile to implementers landing without context; produces high questions-per-PR overhead.
- **Pure PRD style.** Rejected: not publishable as a standard; lacks the precision needed for interoperable implementations.
- **Two documents per feature (PRD plus RFC).** Rejected: doubles the maintenance surface and introduces divergence risk that the hybrid format exists to avoid.

## Links

- Related PRDs: `prd/00-template.md`, `prd/00-INDEX.md`
- Related ADRs: ADR-0002 (output location)
- External references: RFC 2119 (normative keywords); RFC 8174 (ambiguity guidance for 2119 keywords)
- Source: `DRAFT-spec-v0.1.md`

## Changelog

- 2026-05-01 — Proposed
- 2026-05-01 — Accepted
