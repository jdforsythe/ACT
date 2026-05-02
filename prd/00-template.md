# PRD-NN — <Title>

> This file is the canonical template for every numbered PRD under `prd/`. Copy
> it, rename to `prd/NN-<slug>.md`, and fill in. Per ADR-0001, ACT PRDs use a
> HYBRID style: an engineering preamble followed by an RFC-style normative
> body. Keep RFC 2119 keywords in **bold uppercase** inside the Specification
> section. Examples below use a fictional `PRD-XX — Example feature` so the
> shape is visible at a glance.

---

## Status

- **Status:** Draft <!-- Draft | In review | Accepted | Implemented | Deprecated -->
- **Last updated:** 2026-05-01
- **Phase:** P1 <!-- P0 (foundations) | P1 (core) | P2 (standard) | P3 (plus) -->
- **Conformance level:** Standard <!-- Core | Standard | Plus | Outside conformance levels -->

---

## Engineering preamble

### Problem

ACT-conformant generators today emit a flat list of content nodes with no
machine-checkable assertion about which nodes an agent is permitted to mutate.
Downstream SDKs therefore re-derive permissions from heuristics (filename
prefixes, mime type), producing inconsistent behaviour across implementations
and silent data loss when a generator changes conventions.

This PRD specifies a normative `mutability` field on every Content Node, plus
a deterministic algorithm SDKs use to resolve effective mutability when nodes
are nested. The design draws on RFC 7232 conditional-request semantics so
agents can negotiate writes without a server round-trip.

### Goals

- **G1.** An ACT-conformant generator **MUST** emit a `mutability` token on
  every Content Node in O(1) per node.
- **G2.** An ACT-conformant SDK **MUST** resolve effective mutability for any
  node in O(depth) without network I/O.
- **G3.** A conformance test suite **MUST** be able to detect a non-conformant
  generator in ≤100 ms across the reference fixture set (≤10 000 nodes).

### Non-goals

- **NG1.** This PRD does not define the wire format for mutation requests. See
  PRD-23 (Mutation envelope).
- **NG2.** This PRD does not specify per-field ACLs inside a node. See PRD-31
  (Field-level access control).
- **NG3.** This PRD does not address transport authentication. See PRD-19
  (Transport security).

### Stakeholders

- Spec authors — own the normative text.
- Generator implementers — emit `mutability` per §5.2.
- SDK implementers — implement the resolution algorithm in §5.4.
- Agent implementers — consume resolved mutability via the SDK API.
- Content authors — read the human-readable summary in §6.

### Risks

- **R1 (High).** A naïve resolution algorithm is O(n·depth) and dominates SDK
  cold-start. *Mitigation:* §5.4 prescribes memoisation; AC4 enforces the
  bound under benchmark.
- **R2 (Med).** Generators may emit legacy documents without `mutability`.
  *Mitigation:* §8 defines a MINOR-compatible default of `inherit` and a
  deprecation window of two MINOR releases.
- **R3 (Low).** The token vocabulary may need extension for streaming nodes.
  *Mitigation:* §5.3 reserves the `x-` prefix for vendor extensions.

### Open questions

- **Q1.** Should `mutability=append-only` imply ordering guarantees? *Resolved
  by ADR-0007.*
- **Q2.** TODO: confirm interaction with PRD-31 field-level ACLs before moving
  to In review.

### Acceptance criteria

- [ ] **AC1.** JSON Schema at `prd/NN-mutability/schema.json` validates all
  positive fixtures and rejects all negative fixtures under
  `tests/fixtures/PRD-NN/`.
- [ ] **AC2.** Reference SDK passes the conformance suite at Standard level.
- [ ] **AC3.** Spec text contains no unresolved `TODO` markers.
- [ ] **AC4.** SDK resolution benchmark completes the 10 000-node fixture in
  ≤50 ms on the reference hardware profile.
- [ ] **AC5.** Two independent implementations interoperate per the round-trip
  fixture.

---

## Context & dependencies

### Depends on

- **PRD-01 — Content Node core** (Accepted) — defines the node shape this PRD
  extends.
- **PRD-04 — Conformance levels** (Accepted) — defines Core/Standard/Plus.

### Blocks

- **PRD-23 — Mutation envelope** — needs the resolved-mutability API.
- **PRD-31 — Field-level access control** — refines the model defined here.

### References

- `DRAFT-spec-v0.1.md` §3.2 (Content Node), §7 (Conformance).
- RFC 2119 — keyword semantics.
- RFC 7232 — conditional requests; informs token vocabulary.
- BCP-47 — language tag handling for human-readable summaries.
- Schema.org `CreativeWork.editor` — prior art for permission expression.
- ADR-0001 — PRD style.
- ADR-0007 — `append-only` ordering decision.

---

## Specification

This section is normative. Keywords **MUST**, **MUST NOT**, **SHOULD**,
**SHOULD NOT**, **MAY** are interpreted per RFC 2119.

### 5.1 Terminology

- **Content Node** — as defined in PRD-01 §2.
- **Effective mutability** — the mutability of a node after applying §5.4.
- **Mutability token** — one of the strings enumerated in §5.3.

### 5.2 Requirements

- **REQ-1.** A Content Node **MUST** carry a `mutability` field of type
  `string`.
- **REQ-2.** The value **MUST** be one of the tokens enumerated in §5.3 or a
  vendor extension matching `^x-[a-z0-9-]+$`.
- **REQ-3.** Generators **MUST NOT** emit unknown tokens outside the `x-`
  prefix.
- **REQ-4.** SDKs **MUST** treat unknown `x-` tokens as `immutable` for safety.
- **REQ-5.** Agents **SHOULD** surface a warning when encountering an unknown
  `x-` token.

### 5.3 Token vocabulary

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://act.dev/prd/NN-mutability/schema.json",
  "title": "MutabilityToken",
  "type": "string",
  "enum": ["immutable", "mutable", "append-only", "inherit"],
  "patternProperties": {
    "^x-[a-z0-9-]+$": {}
  }
}
```

For larger schemas, ship as `prd/NN-<slug>/schema.json` and reference it here.

### 5.4 Resolution algorithm

Given a node `n` with ancestor chain `[root, ..., parent, n]`:

1. If `n.mutability != "inherit"`, return `n.mutability`.
2. Else recurse into `parent`.
3. The root node **MUST NOT** declare `inherit`; generators emitting such a
   document are non-conformant (REQ-1 violation).

SDKs **MUST** memoise per resolved-id to satisfy G2.

### 5.5 Conformance (Standard level)

A Standard-conformant implementation **MUST** satisfy REQ-1 through REQ-5 and
**MUST** pass every fixture marked `level: standard` in §7. Plus-level
implementations **MUST** additionally honour vendor extensions registered in
the IANA-style table maintained at `prd/NN-mutability/extensions.md`.

---

## Examples

### Example 1 — minimal node

```json
{
  "id": "node-001",
  "kind": "paragraph",
  "mutability": "mutable",
  "body": "Hello, world."
}
```

### Example 2 — inheritance

```json
{
  "id": "doc-001",
  "kind": "document",
  "mutability": "immutable",
  "children": [
    { "id": "node-002", "kind": "paragraph", "mutability": "inherit",
      "body": "Locked by parent." }
  ]
}
```

Effective mutability of `node-002` resolves to `immutable` per §5.4.

Larger payloads (>50 lines) **MUST** ship as files under
`prd/NN-<slug>/examples/` and be referenced by relative path.

---

## Test fixtures

Fixtures live under `tests/fixtures/PRD-NN/` and are authored per workflow
W-06. The PRD enumerates them; the implementation team writes them.

| Fixture                          | What it tests                              | Expected |
|----------------------------------|--------------------------------------------|----------|
| `pos/01-minimal.json`            | REQ-1 with each enumerated token           | pass     |
| `pos/02-inherit-chain.json`      | §5.4 resolution across 4 levels of nesting | pass     |
| `pos/03-vendor-extension.json`   | REQ-2 `x-` prefix accepted                 | pass     |
| `neg/01-missing-field.json`      | REQ-1 violation                            | fail     |
| `neg/02-unknown-token.json`      | REQ-3 violation                            | fail     |
| `neg/03-root-inherit.json`       | §5.4 step 3                                | fail     |
| `bench/10k-nodes.json`           | AC4 benchmark input                        | pass     |

---

## Versioning & compatibility

- **MAJOR** — removing a token from §5.3, changing resolution semantics in
  §5.4, or tightening REQ-4.
- **MINOR** — adding a token to §5.3, adding a new vendor-extension registry
  entry, relaxing a SHOULD to MAY.
- **PATCH** — editorial changes only; no normative effect.

Forward compatibility: SDKs **MUST** accept unknown `x-` tokens per REQ-4.
Backward compatibility: documents authored against PRD-NN v1.x **MUST** parse
under v1.y for y > x.

---

## Security considerations

- **Untrusted input.** `mutability` is consumed by SDKs that mediate writes;
  an attacker who can inject `mutable` into an otherwise-immutable node
  obtains write access. SDKs **MUST** verify document signatures (PRD-19 §4)
  before trusting the field.
- **Auth boundaries.** This PRD does not cross new auth boundaries beyond
  those enumerated in PRD-19 §3.
- **Denial of service.** The resolution algorithm is O(depth); generators
  **MUST NOT** emit documents with depth >64 (PRD-01 §5.6). SDKs **MUST**
  reject deeper documents.
- **Information leakage.** The `mutability` token is non-sensitive; no
  additional leakage vectors are introduced.

---

## Implementation notes

*Skip this section for pure-spec PRDs. Include for SDK, generator, or example
PRDs.*

Reference resolution sketch (pseudocode, not normative):

```python
def effective_mutability(node, ancestors, cache):
    if node.id in cache:
        return cache[node.id]
    m = node.mutability
    if m == "inherit":
        if not ancestors:
            raise ConformanceError("root may not inherit")
        m = effective_mutability(ancestors[-1], ancestors[:-1], cache)
    cache[node.id] = m
    return m
```

SDKs **SHOULD** expose `resolveMutability(nodeId) -> Token` as the sole public
API for this feature.

---

## Changelog

- **2026-05-01** — Initial draft (PRD-NN). Author: <name>.
- **YYYY-MM-DD** — <change summary>.
