# ACT amendments queue

**Status:** Active
**Owner:** Jeremy Forsythe (BDFL)
**Last updated:** 2026-05-02

This file tracks proposed amendments to **Accepted** PRDs surfaced during downstream PRD authoring or implementation. Per [docs/workflow.md](workflow.md) §"Reviews and amendments", entries are triaged via `forge:reviewer` during Phase 6:

- **Trivial clarifications** → edited inline on the Accepted PRD with a Changelog entry (PRD stays Accepted).
- **Semantic but additive** changes (new optional field / new SHOULD / new example) → re-enter `In review`, MINOR bump per PRD-108.
- **Semantic and breaking** changes → require a new superseding PRD; old PRD moves to `Deprecated`.

Until Phase 6 starts, entries are queued — **no Accepted PRD is silently amended**. Each entry names the PRD, the section/requirements affected, the observed problem, the proposed fix, and the source P3 PRD that surfaced it.

---

## Open entries

### A1 — PRD-200: dedupe rule for `metadata.translations` array merge

- **PRD:** PRD-200 (Adapter framework)
- **Section / requirement:** PRD-200-R12 (multi-source deep merge)
- **Surfaced by:** PRD-702 Open question #2 (Corporate marketing, Next.js + Contentful + i18n)
- **Observed problem:** When two adapters contribute partial `metadata.translations` arrays for the same node — e.g., PRD-202 (Contentful) populates from CMS-side translation data per PRD-202-R14, and PRD-207 (i18n) populates the same field from message-catalog presence per PRD-207-R5 — PRD-200-R12's deep-merge rule concatenates the arrays. This produces duplicate `(locale, id)` entries on the merged node. PRD-200-R12 is silent on per-array dedupe.
- **Proposed fix (trivial clarification):** Amend PRD-200-R12 to specify that array-typed fields under `metadata.translations` MUST be deduped by `(locale, id)` after merge, with the later-wins precedence rule already in PRD-200-R12 governing per-entry conflicts. Add a positive fixture under `fixtures/200/` exercising the dedupe.
- **Triage call:** Likely trivial-inline; route through `forge:reviewer` to confirm.

### A2 — PRD-404: `parseMode` wiring for Docusaurus generator

- **PRD:** PRD-404 (Docusaurus plugin)
- **Section / requirement:** PRD-404 configuration shape (ref: PRD-404-R16); interaction with PRD-201-R12
- **Surfaced by:** PRD-701 Open question #4 (Large docs, Docusaurus + markdown)
- **Observed problem:** PRD-201-R12 specifies a default coarse mode (one `markdown` block per file) and a fine-grained mode opt-in via a `parseMode` knob. PRD-404 references neither PRD-201's `parseMode` nor an equivalent configuration knob; therefore no PRD-404 deployment can opt into fine-grained mode. Fine-grained-mode-via-Docusaurus is currently unreachable.
- **Proposed fix (semantic / additive):** Add a `parseMode` (or equivalent) configuration field to PRD-404's plugin shape that pass-throughs to the underlying PRD-201 adapter. MINOR bump per PRD-108 (additive optional field, default preserves coarse mode). Sibling generators (PRD-402, 403, 408) likely need the same treatment — `forge:reviewer` should triage scope.
- **Triage call:** Borderline. Either (a) ship the knob now, or (b) document fine-grained-mode-via-generators as a v0.2 scoped enhancement and close the OQ. Default recommendation: ship the knob — the cost is small and the alternative is documenting a permanent v0.1 feature gap. Final call deferred to Phase 6 reviewer.

### A3 — PRD-208: `data` block schema validation under `validate: "before-emit"`

- **PRD:** PRD-208 (Programmatic adapter)
- **Section / requirement:** PRD-208-R3 (pre-emit validation)
- **Surfaced by:** PRD-704 Open question #2 (E-commerce catalog)
- **Observed problem:** PRD-208-R3 cites `schemas/100/node.schema.json` as the validation target when `validate: "before-emit"` is set. PRD-102-R4's `data` block has its own block-level schema that lives separately. PRD-208-R3 does not state whether pre-emit validation also validates content blocks against their applicable PRD-102 schemas. PRD-704's e-commerce catalog example relies on `data`-block validation catching misshaped taxonomies.
- **Proposed fix (trivial clarification):** Amend PRD-208-R3 to state that pre-emit validation MUST validate (a) the node envelope against `schemas/100/node.schema.json`, AND (b) each content block against the applicable PRD-102 block schema for that block type. Add a negative fixture under `fixtures/208/` showing a misshaped `data` block being rejected pre-emit.
- **Triage call:** Trivial-inline.

### A5 — PRD-100 vs PRD-102: shape of node.related conflicts

- **PRD:** PRD-100 (Wire format), PRD-102 (Content blocks)
- **Section / requirement:** PRD-100-R22 (Node optional fields, inline schema's `related` items), PRD-102-R18 (`related` shape)
- **Surfaced by:** Spec Steward / G1 schema lock (2026-05-02). Positive fixtures `fixtures/102/positive/node-with-related-cycle.json`, `node-variant.json`, `node-variant-base.json` use the `[{id, relation}]` form.
- **Observed problem:** PRD-100's inline node schema declares `related` as an array of ID strings (`{ "type": "string", "pattern": "<id-grammar>" }`). PRD-102-R18 says `related` MUST be an array of objects each with REQUIRED `id` (matching the PRD-100 grammar) and REQUIRED `relation` (open enum). PRD-102's shape is what every existing fixture and example uses, but PRD-100's normative inline schema is the array-of-strings form. The two PRDs disagree on a Standard-tier required shape.
- **Proposed fix (trivial clarification):** Amend PRD-100-R22 and the inline node schema in PRD-100 to align with PRD-102-R18: `related` is `array of {id: <id-grammar>, relation: <string>}`. PRD-102 is the more specific/recent specification and PRD-100 already defers per-block-shape questions to PRD-102. The `schemas/100/node.schema.json` file under G1 lock will follow PRD-102-R18 and cite this amendment ID inline; PRD-100 itself remains untouched until G3 amendment triage.
- **Triage call:** Trivial-inline. Single-PRD edit on PRD-100, inline schema correction; defer to G3.

### A6 — PRD-100 vs PRD-102: variant IDs and the node ID grammar

- **PRD:** PRD-100 (Wire format), PRD-102 (Content blocks)
- **Section / requirement:** PRD-100-R10 (ID grammar), PRD-102-R29 (variant ID grammar `{base_id}@{variant_key}`)
- **Surfaced by:** Spec Steward / G1 schema lock (2026-05-02). Positive fixture `fixtures/102/positive/node-variant.json` carries `id: "pricing@enterprise-2026q2"`.
- **Observed problem:** PRD-100-R10's regex `^[a-z0-9]([a-z0-9._\-]|/)*[a-z0-9]$` admits lowercase ASCII alphanumeric, dot, underscore, hyphen, slash — and explicitly nothing else. PRD-102-R29 introduces a variant-ID extension that uses a literal `@` between two grammar-conformant components. A variant node's `id` (which appears at the top-level `id` field of a node envelope) violates PRD-100-R10. PRD-102-R29 itself says only that the `base_id` portion satisfies PRD-100-R10, leaving the full variant ID outside the canonical grammar.
- **Proposed fix (trivial clarification):** Amend PRD-100-R10 to admit a single literal `@` separating two grammar-conformant components when the ID is a variant ID per PRD-102-R29. Concretely: extend the grammar to `^[a-z0-9]([a-z0-9._\-]|/)*[a-z0-9](@[a-z0-9-]+)?$` (the trailing optional `@<variant_key>` matches the variant_key grammar from PRD-102-R29). The `schemas/100/node.schema.json` under G1 lock will use the extended pattern and cite this amendment ID; PRD-100 itself remains untouched until G3 amendment triage. Conservative interpretation in v0.1: schemas accept the extended grammar so existing positive fixtures validate.
- **Triage call:** Trivial-inline. Single-PRD edit on PRD-100; defer to G3. Note that index entries' `parent` and `children` fields and the manifest's `root_id` likely need the same extension since variant nodes can appear anywhere in the children graph; the schema treats the extended grammar uniformly.

### A7 — PRD-103 vs PRD-100: index/subtree top-level etag shape ambiguity

- **PRD:** PRD-103 (Caching/ETags), PRD-100 (Wire format)
- **Section / requirement:** PRD-103-R1, PRD-103-R3 vs the locked `schemas/100/index.schema.json` and `schemas/100/subtree.schema.json` top-level `etag` field shapes
- **Surfaced by:** PRD-600 implementation (Phase 6.1, step 3) — running positive fixtures through `validateIndex` / `validateSubtree`
- **Observed problem:** PRD-103-R1 says every envelope (manifest, index, node, subtree, NDJSON line) MUST carry an `etag`; PRD-103-R3 pins the v0.1 admit-list to `s256:[A-Za-z0-9_-]{22}`. The locked index and subtree schemas declare the top-level `etag` as a freeform `string` (no pattern). Two G1 positive fixtures use top-level etag values that violate the strict admit-list:
  - `fixtures/100/positive/index-minimal.json` — top-level `etag: "s256:9f2c1b8d4a7e3f2a1c5b8e0d4a7f2c1b"` (32 chars after the colon).
  - `fixtures/100/positive/subtree-default-depth.json` — top-level `etag: "s256:sub1234567890abcdef0000"` (23 chars after the colon).

  Either the schemas should pattern-pin the top-level etag (and the fixtures need updating), or PRD-103-R3's "every envelope" reading should explicitly exclude index / subtree top-level etag (and PRD-600's R6 should match).
- **Proposed fix (trivial clarification):** Decide one of:
  - **(a) Tighten the schemas:** add `pattern: "^s256:[A-Za-z0-9_-]{22}$"` to the index and subtree top-level `etag` fields and re-spin the two fixtures' values to conform.
  - **(b) Loosen PRD-103-R3:** restate that the strict admit-list applies only to per-node and per-NDJSON-line etags; index / subtree top-level etag values are free-form (still required by PRD-103-R1, but not pattern-pinned).
- **PRD-600 conservative interpretation in v0.1:** PRD-600 enforces R3 on every node envelope etag and every NDJSON line etag, and **does not** enforce R3 on the index / subtree top-level etag. This matches the locked schemas and keeps the G1 positive fixtures green. Any future tightening is a coordinated PRD-103 + schema + fixture amendment.
- **Triage call:** Trivial-inline. Recommendation is option (a) — tighten and re-spin the two fixtures — once the spec freezes top-level etag derivation. Non-blocking for v0.1; PRD-600 ships with the conservative interpretation.

### A4 — PRD-602: bridge construction shape for hybrid (multi-mount) trees

- **PRD:** PRD-602 (ACT-MCP bridge)
- **Section / requirement:** PRD-602-R3, PRD-602-R4, PRD-602-R5 (bridge construction & level validation)
- **Surfaced by:** PRD-706 Open question #5 (Hybrid static + runtime + MCP bridge)
- **Observed problem:** PRD-602-R3 says the bridge MUST validate at construction time that the supplied `ActRuntime` satisfies the level the bridge advertises. PRD-602-R5 fixes `name` and `version` at construction. Neither addresses the case where the bridge advertises a *hybrid* tree composed of multiple `ActRuntime`s (or a runtime + a static walker), each at a different level. PRD-706's design intent is one bridge per deployment serving multiple mounts, but PRD-602's text only licenses one bridge per `ActRuntime`. PRD-706-R12 / R14 take a position (single bridge wrapping one runtime + a static walker, with per-mount manifest exposition) that is not clearly licensed by PRD-602.
- **Proposed fix (semantic / additive):** Add a `mounts` field (or equivalent composite-source contract) to PRD-602's bridge construction shape, supporting an array of `{ prefix, source }` where `source` is either an `ActRuntime` or a static walker. Restate PRD-602-R3's level-validation rule to apply per-mount: the bridge MUST validate that each mount's source satisfies the level declared in that mount's manifest. The MCP-side resource enumeration (PRD-602-R6 / R7) already supports per-mount surfaces. MINOR bump per PRD-108 (additive optional construction field; single-source construction remains the default).
- **Triage call:** Implementation team will hit this on day one of PRD-602 + PRD-706 work. Recommend resolving before that work begins.

### A8 — PRD-700-R4 vs PRD-201-R23: coarse-mode adapter cannot satisfy a Standard generator target

- **PRD:** PRD-700 (Reference example) and PRD-201 (Markdown adapter); transitively PRD-400 (Generator pipeline).
- **Section / requirement:** PRD-700-R4 (coarse mode is sufficient for Standard); PRD-201-R23 (declared level is `core` when `mode: "coarse"`); PRD-400-R32 (`enforceTargetLevel` refuses target > adapter declared level).
- **Surfaced by:** PRD-700 implementation in `examples/700-tinybox/` (Phase 6.1, step 6 / G2 close).
- **Observed problem:** PRD-700-R4 reads "the example MUST NOT enable PRD-201's fine-grained mode; coarse mode is sufficient for Standard." PRD-201-R23 reads "Core when (a) `mode: "coarse"`, (b) no `.mdx` files matched, (c) the corpus contains no `:::`-style admonitions or GFM alerts that would force `callout` emission." With coarse mode the adapter declares level `core`. PRD-400-R32's `enforceTargetLevel` then refuses a Standard target against a Core-declared adapter (`order["standard"] > order["core"]`). The example as written in PRD-700-R4 cannot reach `achieved.level === 'standard'` (PRD-700-R12) without contradicting one of (a) PRD-700-R4, (b) PRD-201-R23, (c) PRD-400-R32.
- **Pragmatic resolution adopted in v0.1 slice:** `examples/700-tinybox/astro.config.mjs` configures the markdown adapter with `mode: 'fine'` and `targetLevel: 'standard'`, so the adapter declares Standard, the generator's `enforceTargetLevel` admits the Standard target, and the conformance gate passes. ADR-004 documents this decision.
- **Proposed fix (semantic; needs spec-steward triage):** Three candidate edits:
  - **(a) Edit PRD-700-R4** to admit `mode: 'fine'` (or restate that the example's mode is implementer's choice). Smallest blast radius.
  - **(b) Edit PRD-201-R23** so coarse mode declares `Standard` when the source corpus is subtree-eligible (parent / children frontmatter present). Touches the adapter contract; affects Track A leaves.
  - **(c) Edit PRD-400-R32** to accept a target one band above adapter declared level when the generator can supply the missing band (e.g., subtree files derived from the merged node graph). Touches the generator contract.
- **Triage call:** Implementation team's recommended order is (a) → (c) → (b). Option (a) is a one-line PRD-700 edit; option (c) is a generator-contract change that needs ADR review; option (b) ripples into every adapter. Spec-steward triage to pick.

---

## Closed entries

*(none)*

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-02 | Jeremy Forsythe | Initial creation. Filed A1–A4 from P3 Open questions triage at end of Phase 4. Four additional P2 ambiguities (PRD-201-R4 description-alias, PRD-201-R8/PRD-402-R8 section-index ID derivation, PRD-501-R9 manifest identity scope, PRD-106-R17/R18 runtime-served parent manifest) accepted as v0.2 candidates and remain documented in their source P3 PRDs' Open questions sections; not queued here. |
