# PRD-NNN — {Title}

> **How to use this template.** Copy this file to `NNN-slug.md`, replacing `NNN` with the PRD's reserved ID from `000-INDEX.md`. Fill every section. Delete inline guidance (the indented "Guidance:" blocks) before submitting for review. If a section legitimately doesn't apply, replace it with `_Not applicable — {one-sentence reason}._` rather than deleting the heading; missing headings make diffs across PRDs harder.

## Status

`Draft` | `In review` | `Accepted` | `Implemented` | `Deprecated`

> Guidance: One word. The current state of *this PRD*, not the implementation. Update `000-INDEX.md` in the same change.

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

> Guidance: 2–5 sentences. What is broken or missing today? Who feels the pain? Anchor in concrete scenarios from the v0.1 draft (`docs/plan/v0.1-draft.md`) where possible.

### Goals

> Guidance: Numbered list. Each goal MUST be testable — a reader should be able to point at the spec and say "this satisfies G3." Aim for 3–7 goals. More than that usually means the PRD is doing two things and should be split.

1.
2.
3.

### Non-goals

> Guidance: Numbered list. Things this PRD intentionally doesn't do. This is where you preempt scope creep during review. If something is a non-goal because it lives in another PRD, name that PRD here.

1.
2.

### Stakeholders / audience

> Guidance: Who reads this PRD as authoritative? Who must review it before it ships? Distinguish "consumer of the spec" (e.g., generator authors) from "implementer of the spec" (e.g., adapter authors).

- **Authors of:** {what consumes this PRD}
- **Reviewers required:** {names/roles, or TBD}

### Risks

> Guidance: What could go wrong with this design? Aim for 2–5 risks with at least one mitigation each. Categories worth scanning: forward-compat, performance, security, adoption friction, ecosystem fragmentation.

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| | | | |

### Open questions

> Guidance: Things this PRD does not resolve. If a question is strategic (governance, naming, partner choice), do NOT resolve it here — add it to `000-decisions-needed.md` and reference the question number. If it's technical, leave it here and resolve before moving Status to `Accepted`.

1.
2.

### Acceptance criteria

> Guidance: A checklist that determines when this PRD is "done" enough to move to `Accepted`. Acceptance criteria are about the PRD as a document, not about an implementation. Common items: every MUST has a test fixture; every JSON Schema validates against the examples; conformance level is declared per requirement; security section addresses every threat in the threat model.

- [ ]
- [ ]

---

## Context & dependencies

### Depends on

> Guidance: List PRD IDs whose Specification sections must be read and understood before this one. List external standards (RFCs, JSON Schema drafts, MIME registrations) that this PRD relies on.

- {PRD-XX}: {what it provides}
- External: {RFC ####, etc.}

### Blocks

> Guidance: PRDs that cannot reach `Accepted` until this one does.

- {PRD-YY}

### References

> Guidance: Pointers to the v0.1 draft and any prior art. Use the form `draft §X.Y` for the v0.1 draft. Use stable URLs for external prior art.

- v0.1 draft: §{section number(s)}
- Prior art: {llms.txt, MCP, schema.org, sitemap, etc.}

---

## Specification

This is the normative section. Everything below MUST use RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) where requirements are imposed. Lowercase "must" and "should" are non-normative prose.

### Conformance level

> Guidance: Declare which conformance level (Core / Standard / Plus, per PRD-107) every requirement in this PRD belongs to. If a single PRD spans levels (e.g., the i18n PRD), break it into subsections by level.

- Core: {requirements that fall here}
- Standard: {…}
- Plus: {…}

### Normative requirements

> Guidance: Numbered list. Each requirement gets an ID of the form `{PRD-NNN}-R{n}` so test fixtures and other PRDs can cite it. Group related requirements with subheadings, but keep the IDs flat.

**{PRD-NNN}-R1.** Producers MUST …

**{PRD-NNN}-R2.** Consumers SHOULD …

**{PRD-NNN}-R3.** A {field/endpoint/envelope} MAY …

### Wire format / interface definition

> Guidance: For 100-series PRDs, this is JSON Schema (inline or linked from `schemas/`). For SDK PRDs, this is an interface signature (TypeScript or pseudocode). For generator/adapter PRDs, this is the contract with the framework: lifecycle hooks, configuration shape, output guarantees.

```json
{
  "// ...": "..."
}
```

### Errors

> Guidance: For runtime PRDs, list HTTP status codes used and the error envelope shape. For static PRDs, list the failure modes that producers must surface (build warnings vs. errors). Cite PRD-109 for any security-sensitive error semantics (e.g., 404-vs-403 to avoid leaking existence).

| Condition | Response | Notes |
|---|---|---|
| | | |

---

## Examples

> Guidance: At least one full worked example per major requirement. Examples are non-normative but must be consistent with the Specification section — automated checks will validate them.
>
> For wire-format PRDs, examples ship as JSON files under `examples/{prd-id}/`. Inline a representative one here and link the rest.

### Example 1 — {short name}

```json
{
}
```

---

## Test fixtures

> Guidance: Pointers to (or inline definitions of) the test inputs and expected outputs that prove conformance. Required for any PRD with normative requirements. Negative tests (inputs that MUST be rejected) carry equal weight to positive tests.
>
> Fixtures live under `fixtures/{prd-id}/` and get exercised by PRD-600 (validator) and the adapter/generator/SDK test suites.

### Positive

- `fixtures/{prd-id}/positive/{name}.json` → satisfies R{n}

### Negative

- `fixtures/{prd-id}/negative/{name}.json` → MUST be rejected because {reason}

---

## Versioning & compatibility

> Guidance: Per PRD-108, classify each kind of change to this PRD as MAJOR or MINOR. Be specific. "Adding an optional field to the manifest" is MINOR. "Changing the meaning of a required field" is MAJOR. "Removing the requirement to send ETag" is MAJOR even though it relaxes a constraint, because consumers depend on it.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add an optional field | MINOR | |
| Add an optional endpoint | MINOR | |
| Add a value to a closed enum | MAJOR | Unless the enum was documented as open |
| Tighten a SHOULD to a MUST | MAJOR | |
| Loosen a MUST to a SHOULD | MAJOR | |
| Change required field semantics | MAJOR | |

### Forward compatibility

> Guidance: How should consumers handle data they don't recognize? (Default per PRD-108: tolerate unknown optional fields; reject unknown required fields.)

### Backward compatibility

> Guidance: What must old producers / old consumers continue to support after this PRD changes? Spell out the deprecation window if any.

---

## Security considerations

> Guidance: Required for every PRD, even ones that seem benign — runtime profile changes, ID grammars, and i18n have all surfaced security issues in adjacent specs. Cite PRD-109 for the project-wide security posture and only document deltas here.
>
> Cover at minimum: information disclosure (does this leak existence/identity?), injection (any user-controlled fields rendered or interpreted?), auth scoping (does this PRD assume scoping done elsewhere?), denial of service (size limits, rate limits, recursion depth).

---

## Implementation notes

_For SDK / generator / example PRDs only — delete this section for wire-format PRDs._

> Guidance: Runnable code patterns the implementer should follow. Not full implementation. Aim for ~3–10 short snippets that show the canonical shape; leave actual coding to the implementation repo. Cite the framework's own conventions (Astro integration shape, Express middleware shape, etc.).

---

## Changelog

> Guidance: Version history of *this PRD*, not the implementation. Bump the PRD's own minor version each time you ship a non-trivial revision after `Accepted`. Pre-acceptance, just keep a list of dated entries.

| Date | Author | Change |
|---|---|---|
| YYYY-MM-DD | {name} | Initial draft |
