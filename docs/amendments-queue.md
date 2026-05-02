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

### A10 — PRD-408: `parseMode` wiring for Eleventy generator (sibling sweep of A2)

- **PRD:** PRD-408 (Eleventy plugin).
- **Section / requirement:** PRD-408 configuration shape (mirror PRD-404-R16); interaction with PRD-201-R12.
- **Surfaced by:** A2 closure (2026-05-02) — sibling-sweep recommendation accepted by BDFL.
- **Observed problem:** Same as A2: PRD-201-R12's coarse / fine split is normative, but PRD-408 does not currently expose a `parseMode`-equivalent. Without this field, fine-grained-mode-via-Eleventy is unreachable, which is a permanent v0.1 feature gap.
- **Proposed fix (semantic / additive):** Add `parseMode?: "coarse" | "fine"` (default `"coarse"`) to PRD-408's plugin shape as a pass-through to PRD-201's `mode` config. Mirror PRD-404-R16's amended text verbatim, including the level-mismatch rule (PRD-201-R23 applies). MINOR bump per PRD-108-R4(1).
- **Triage call:** Pre-staged for the Adapter/Generator Engineer at Track B PRD-408 entry. Spec Steward to confirm SOP-4 once the engineer reaches the leaf.

### A11 — PRD-402: `parseMode` wiring for Hugo generator (sibling sweep of A2, spec-only)

- **PRD:** PRD-402 (Hugo module, spec-only per Q3).
- **Section / requirement:** PRD-402 configuration shape; interaction with PRD-201-R12.
- **Surfaced by:** A2 closure (2026-05-02) — sibling-sweep recommendation accepted by BDFL.
- **Observed problem:** Same as A2 / A10. PRD-402 ships as spec text only in v0.1 (no first-party impl per Q3); the spec gap nonetheless leaves community ports without a normative knob to expose.
- **Proposed fix (semantic / additive):** Add a `parseMode` (or equivalent) configuration field to PRD-402's plugin shape mirroring A2 / A10. MINOR bump per PRD-108-R4(1).
- **Triage call:** Coordinated pre-ship sweep before v0.1 tag. No implementation gate.

### A12 — PRD-403: `parseMode` wiring for MkDocs plugin (sibling sweep of A2, spec-only)

- **PRD:** PRD-403 (MkDocs plugin, spec-only per Q3).
- **Section / requirement:** PRD-403 configuration shape; interaction with PRD-201-R12.
- **Surfaced by:** A2 closure (2026-05-02) — sibling-sweep recommendation accepted by BDFL.
- **Observed problem:** Same as A2 / A10 / A11. Spec-only PRD; gap is normative and would block community ports from reaching Standard.
- **Proposed fix (semantic / additive):** Add a `parseMode` (or equivalent) configuration field to PRD-403's plugin shape mirroring A2 / A10 / A11. MINOR bump per PRD-108-R4(1).
- **Triage call:** Coordinated pre-ship sweep before v0.1 tag. No implementation gate.

---

## Closed entries

### A1 — PRD-200: dedupe rule for `metadata.translations` array merge

- **PRD:** PRD-200 (Adapter framework)
- **Section / requirement:** PRD-200-R12 (multi-source deep merge)
- **Surfaced by:** PRD-702 Open question #2 (Corporate marketing, Next.js + Contentful + i18n)
- **Verdict (2026-05-02, Spec Steward):** **Trivial inline clarification per SOP-3.** PRD-200 stays Accepted.
- **Rationale:** PRD-200-R12's array-concat rule (3rd bullet) was silent on per-entry identity; the silence let two adapters contributing partial `metadata.translations` (PRD-202 from CMS-side translation data per PRD-202-R14; PRD-207 from message-catalog presence per PRD-207-R5) produce a merged node with duplicate `(locale, id)` rows. The fix names the unique key (`(locale, id)`) PRD-104-R8/R9 already gives every translation entry, picks the later-wins precedence rule already in PRD-200-R12 / R15 for the per-entry collision, and scopes the dedupe to `metadata.translations` only — every other array field (including producer-defined `metadata.*` arrays) keeps the existing concat semantics. The clarification names a concrete identity-keyed sub-case of an existing rule rather than introducing new merge behavior, so PRD-108-R4 / R5 classification stays at "trivial editorial" rather than MINOR or MAJOR. No conformance band changes; no other PRD edits.
- **Action taken:** Edited PRD-200-R12 in `prd/200-adapter-framework.md` to add a 4th bullet specifying `(locale, id)` dedupe with later-wins precedence; the prior `Result MUST satisfy PRD-100-R21` rule renumbered to bullet 5. Added a positive fixture entry under `## Test fixtures > ### Positive` (`fixtures/200/positive/merge-translations-dedupe.json`) and authored the JSON file showing the merged-output node with deduped translations and a populated `metadata.source.contributors` array per PRD-200-R13. Fixture validates clean against `validateNode` (PRD-100 envelope + PRD-103 etag admit-list). Added a Changelog row dated 2026-05-02 citing this amendment ID and SOP-3.
- **BDFL escalation:** None required. SOP-3 trivial inline.
- **Closed:** 2026-05-02.

### A2 — PRD-404: `parseMode` wiring for Docusaurus generator

- **PRD:** PRD-404 (Docusaurus plugin); recommendation flagged for sibling generators PRD-402 (Hugo, spec-only), PRD-403 (MkDocs, spec-only), PRD-408 (Eleventy).
- **Section / requirement:** PRD-404-R16 (configuration shape); interaction with PRD-201-R12.
- **Surfaced by:** PRD-701 Open question #4 (Large docs, Docusaurus + markdown).
- **Verdict (2026-05-02, Spec Steward):** **Semantic-additive amendment per SOP-4 (MINOR bump per PRD-108-R4(1)).** PRD-404 routed Accepted → In review pending BDFL sign-off.
- **Rationale:** The triage queue's two options were (a) ship the knob now or (b) document fine-grained-mode-via-generators as a v0.2 scoped enhancement. Option (a) wins on three grounds: (1) PRD-201-R12's coarse / fine split already exists and is normative; the knob's absence in PRD-404 means PRD-201's Standard-tier behavior is unreachable through the canonical generator path, which is a permanent v0.1 feature gap rather than a deferral; (2) the change is genuinely additive — new optional field, default `"coarse"` preserves every existing PRD-404 deployment's behavior — so it cleanly fits PRD-108-R4(1); (3) the cost of the field is small (a single pass-through into PRD-201's existing config) and the implementation does not require new schema. Per PRD-108's classification rules and the SOP-4 procedure, the additive change rides through `In review` with a MINOR bump rather than landing silently on an Accepted PRD.
- **Action taken:** Edited `prd/404-docusaurus-plugin.md`:
  1. Status header set to `In review` with an HTML comment marking the amendment ID, pending BDFL sign-off.
  2. PRD-404-R16 amended to add `parseMode` (string, OPTIONAL; one of `"coarse"`, `"fine"`; default `"coarse"`) as a pass-through to PRD-201's `mode` config, with the level-mismatch rule (PRD-201-R23) preserved verbatim — `parseMode: "fine"` against `target: "core"` fails at `init`.
  3. The TypeScript `ActDocusaurusOptions` interface in the wire-format / interface section gained a `parseMode?: "coarse" | "fine"` field with a JSDoc citation of PRD-201-R12 / PRD-201-R23 and the amendment ID.
  4. Changelog row dated 2026-05-02 noting the MINOR bump per PRD-108-R4(1) and citing SOP-4.
- **Cross-cutting recommendation (BDFL action):** Sibling generators PRD-402 (Hugo, spec-only), PRD-403 (MkDocs, spec-only), and PRD-408 (Eleventy) each reference PRD-201's behavioral contract but do not currently expose a `parseMode`-equivalent. To prevent an asymmetric ecosystem where only Docusaurus reaches Standard via fine-grained mode, the BDFL should consider sweeping the same additive field through 402 / 403 / 408 in a single coordinated MINOR bump. Each is independently a SOP-4 candidate; bundling them keeps the Phase 6 fan-out reading the same shape across hosts. (PRD-401 / Astro is the vertical-slice owner and already exposes the knob via PRD-700's `mode: "fine"` directive — no edit needed there for v0.1.) **This recommendation is decoupled from the A2 closure:** the BDFL MAY accept A2 in isolation and revisit the sibling sweep separately; A2's closure is conditional on PRD-404 returning to Accepted at next BDFL sweep, not on the sibling decision.
- **BDFL escalation:** Resolved 2026-05-02. BDFL signed off on amendment A2; PRD-404 status `In review → Accepted` (Changelog row landed). Sibling-sweep recommendation accepted: A10 (PRD-408 Eleventy) filed below for Phase 6.2 Track B day-1 pickup; A11 (PRD-402 Hugo, spec-only) and A12 (PRD-403 MkDocs, spec-only) deferred to a coordinated pre-ship sweep.
- **Closed:** 2026-05-02.

### A3 — PRD-208: `data` block schema validation under `validate: "before-emit"`

- **PRD:** PRD-208 (Programmatic adapter).
- **Section / requirement:** PRD-208-R3 (pre-emit validation); interaction with PRD-102-R1 / R2 / R3 / R4 / R5 / R6 block-level schemas.
- **Surfaced by:** PRD-704 Open question #2 (E-commerce catalog).
- **Verdict (2026-05-02, Spec Steward):** **Trivial inline clarification per SOP-3.** PRD-208 stays Accepted.
- **Rationale:** PRD-208-R3 named only `schemas/100/node.schema.json` as the validation target, but the node envelope schema treats `content` as an open array of objects without per-block discrimination — the per-block taxonomy lives in `schemas/102/`. PRD-208-R3's stated purpose (catch malformed-output bugs pre-emit so the framework never sees a broken node) is undermined when the validator stops at the envelope. Tightening R3 to also validate each content block against its applicable PRD-102 schema is a faithful fill-in of the silent gap, not a tightening of contracts: any block that would fail the new check was already non-conformant per PRD-102, and any user code currently emitting valid blocks is unaffected. No PRD-102 / PRD-100 / PRD-200 edits needed; the schema files already exist and have stable `$id`s.
- **Action taken:** Edited PRD-208-R3 in `prd/208-programmatic-adapter.md` to (a) require pre-emit validation of every `content` entry against the applicable PRD-102 schema (markdown / prose / code / data / callout / marketing:*), (b) tabulate the block-type → schema mapping verbatim against PRD-102's requirement IDs, (c) extend partial-emission validation to the `content` array when present, (d) require the error message to cite both the node `id` and the offending block index. Added a negative fixture row under `### Negative` (`fixtures/208/negative/transform-emits-malformed-data-block.expected.json`) and authored the JSON sidecar showing a `data` block missing the required `text` field, with the expected unrecoverable error per PRD-208-R12 + PRD-102-R4. Added a Changelog row dated 2026-05-02 citing this amendment ID and SOP-3.
- **BDFL escalation:** None required. SOP-3 trivial inline (filling silence with the conservative interpretation).
- **Closed:** 2026-05-02.

### A4 — PRD-602: bridge construction shape for hybrid (multi-mount) trees

- **PRD:** PRD-602 (ACT-MCP bridge).
- **Section / requirement:** PRD-602-R3, PRD-602-R4, PRD-602-R5, PRD-602-R6, PRD-602-R10, PRD-602-R11, PRD-602-R24 (bridge construction, URI scheme, identity propagation, subtree mapping, configuration shape).
- **Surfaced by:** PRD-706 Open question #5 (Hybrid static + runtime + MCP bridge).
- **Verdict (2026-05-02, Spec Steward):** **Semantic-additive amendment per SOP-4 (MINOR bump per PRD-108-R4(1)).** PRD-602 routed Accepted → In review pending BDFL sign-off.
- **Rationale:** PRD-706-R12 / R14 take a clear position — one bridge per deployment, wrapping one runtime + a static walker, with per-mount manifest exposition — that PRD-602's pre-amendment text does not license. The triage queue's two options were (a) author the additive multi-mount construction surface PRD-706 already designs against, or (b) defer the hybrid example to v0.2. Option (a) wins on three grounds: (1) the change is genuinely additive — `mounts` is a new optional field on `BridgeConfig`; when omitted, the bridge's behavior is byte-identical to pre-amendment PRD-602; per PRD-108-R4(1) (adding a new optional field to an existing object), this is a textbook MINOR; (2) PRD-706's intent (single MCP server, per-mount manifests, drift-free walker) requires the surface — without it, PRD-706 cannot reach Plus on the marketing mount AND Standard on the app mount through one bridge per deployment, and PRD-706 is the workflow.md-mandated full-surface example; (3) the cost is small — `BridgeConfig.mounts?: BridgeMount[]` plus a minimal `StaticSource` shape (`{ kind, manifestUrl, rootDir? }`) consumed by the same walker PRD-600-R11 / PRD-706-R13 already require. The per-mount restatements of R3 / R5 / R6 / R10 / R11 are layered on top of the existing single-source rules; single-source construction keeps every existing PRD-602 rule verbatim. Per PRD-108's classification rules and SOP-4 procedure, the additive change rides through `In review` with a MINOR bump rather than landing silently on an Accepted PRD. PRD-108-R6 (when in doubt, MAJOR wins) was considered: no MUST is broken, no field is removed, no default behavior changes when `mounts` is omitted — the additive interpretation is structurally clean.
- **Action taken:** Edited `prd/602-act-mcp-bridge.md`:
  1. Status header set to `In review` with an HTML comment marking the amendment ID, pending BDFL sign-off.
  2. PRD-602-R3 restated to apply per-mount when `BridgeConfig.mounts` is supplied: each mount's `source` MUST satisfy the level declared in that mount's manifest (per PRD-107-R6 / R8 / R10); single-source construction keeps the existing rule verbatim.
  3. PRD-602-R5 restated so a single bridge identity (`name` + `version`) covers all mounts: one MCP server, one initialization handshake, regardless of mount count — citing PRD-706-R12 / R14 as the design intent.
  4. PRD-602-R6 restated so multi-mount deployments interleave the mount prefix between `<host>` and the per-mount node id (`act://<host>/<prefix>/<id>`); single-mount deployments retain `act://<host>/<id>`. The MCP-side `ListResources` enumeration MUST surface per-mount manifests (one per mount prefix).
  5. PRD-602-R10 restated so the IdentityBridge applies per-mount; static-source mounts MAY omit IdentityBridge entirely (anonymous reads); runtime-source mounts whose resolver requires identity MUST supply IdentityBridge or fail at construction per PRD-602-R3.
  6. PRD-602-R11 restated so per-mount subtree advertisement is independent: a mount that doesn't advertise `capabilities.subtree` MUST NOT expose any `?subtree=1` resources, regardless of sibling mounts.
  7. PRD-602-R24 amended to add `mounts?: BridgeMount[]` (with `BridgeMount = { prefix, source, identityBridge? }` and `StaticSource = { kind: 'static', manifestUrl, rootDir? }`) and explanatory normative text covering single-source default behavior, multi-mount semantics, prefix-coherence per PRD-106-R20, the minimal `StaticSource` shape rationale (PRD-706-R13 drift prevention), and the additive-only character of the change.
  8. The TypeScript `BridgeConfig` interface in §"Wire format / interface definition" gained `mounts?: BridgeMount[]` plus `BridgeMount` and `StaticSource` interfaces with JSDoc citations of the relevant PRD-706 + PRD-600 + PRD-106 requirements that drove each field choice.
  9. Test-fixture rows added: positive `fixtures/602/positive/hybrid-runtime-plus-static.json` (two-mount config, per-mount manifest enumeration, union of mount node URIs); negative `fixtures/602/negative/mounts-overlap-prefix/` (overlapping prefixes rejected at construction per PRD-106-R20). Files NOT authored — Track D will create the JSON when implementing.
  10. Changelog row dated 2026-05-02 noting the MINOR bump per PRD-108-R4(1) and citing SOP-4. Note that BDFL sign-off is pending.
- **MINOR-bump rationale (cited):** PRD-108-R4(1) — "Adding a new optional field to an existing envelope or object." `BridgeConfig.mounts` is exactly that — an optional field on `BridgeConfig` whose absence yields the historical single-source behavior byte-for-byte. The per-mount restatements of R3 / R5 / R6 / R10 / R11 are layering rules onto the new field's presence; they do not change behavior for any pre-amendment-A4 deployment. No MUST is loosened, no SHOULD tightened, no field removed, no default behavior changed in the `mounts`-omitted path. PRD-108-R6 (MAJOR-wins-when-borderline) does not apply: the change has no plausible MAJOR classification under PRD-108-R5(1)–(7).
- **BDFL escalation:** Resolved 2026-05-02. BDFL signed off on amendment A4; PRD-602 status `In review → Accepted` (Changelog row landed). The per-mount restatements of R3 / R5 / R6 / R10 / R11 are accepted verbatim. PRD-706 unblocks for Track D implementation.
- **Track D unblock:** PRD-602 + PRD-706 implementation is unblocked. The construction surface for PRD-706 is now licensed by PRD-602's text directly; no further amendment-queue entries are needed for the multi-mount path. Track D order: PRD-601 (inspector CLI) → PRD-602 → PRD-706.
- **Closed:** 2026-05-02.

### A8 — PRD-700-R4 vs PRD-201-R23: coarse-mode adapter cannot satisfy a Standard generator target

- **PRD:** PRD-700 (Reference example) and PRD-201 (Markdown adapter); transitively PRD-400 (Generator pipeline).
- **Section / requirement:** PRD-700-R4 (coarse mode is sufficient for Standard); PRD-201-R23 (declared level is `core` when `mode: "coarse"`); PRD-400-R32 (`enforceTargetLevel` refuses target > adapter declared level).
- **Surfaced by:** PRD-700 implementation in `examples/700-tinybox/` (Phase 6.1, step 6 / G2 close).
- **Observed problem:** PRD-700-R4 read "the example MUST NOT enable PRD-201's fine-grained mode; coarse mode is sufficient for Standard." PRD-201-R23 reads "Core when (a) `mode: "coarse"`, (b) no `.mdx` files matched, (c) the corpus contains no `:::`-style admonitions or GFM alerts that would force `callout` emission." With coarse mode the adapter declares level `core`. PRD-400-R32's `enforceTargetLevel` then refuses a Standard target against a Core-declared adapter. The example as previously written in PRD-700-R4 could not reach `achieved.level === 'standard'` (PRD-700-R12) without contradicting one of (a) PRD-700-R4, (b) PRD-201-R23, (c) PRD-400-R32.
- **Verdict (2026-05-01, Spec Steward):** **Trivial inline clarification per SOP-3** on PRD-700 only. Option (a) chosen.
- **Rationale:** PRD-201-R23 and PRD-400-R32 are wire-format / pipeline contracts with many leaf consumers across Tracks A and B. The friction is local to the example's mode-vs-level alignment, not to the adapter or generator contracts. PRD-700 is a reference example whose `mode: "coarse"` directive was a defensible default ("the simplest mode is enough for the simplest example"), but the implication that coarse mode reaches Standard is wrong as PRD-201-R23 reads today. The smallest-blast-radius fix is to clarify PRD-700-R4 to require `mode: "fine"` (which the slice already implements), citing PRD-201-R23 and PRD-400-R32. Options (b) and (c) would each require a MINOR bump per PRD-108-R4 ("adding new optional behaviour" or "loosening a `enforceTargetLevel` MUST"); both are out of scope for v0.1.
- **Action taken:** Edited PRD-700-R4 in `prd/700-minimal-docs-astro.md` to require `mode: "fine"` and explain the PRD-201-R23 → PRD-400-R32 → example-target chain. Added a Changelog row dated 2026-05-01 citing this amendment. The wire format the example emits is unchanged (the corpus contains no fenced code, callouts, or `.mdx`, so fine mode produces predominantly `markdown` / `prose` blocks). PRD-201 and PRD-400 are not touched. ADR-004 in the implementation repo records the configuration decision.
- **BDFL escalation:** None required. This is SOP-3 trivial inline (clarification on a reference-example PRD; non-normative on the wire format).
- **Closed:** 2026-05-01.

### A9 — Validator level-inference: `probeCapabilityBand` is a strict reading of PRD-107-R6/R8/R10 + PRD-600-R18

- **PRD:** PRD-600 (Validator), PRD-107 (Conformance levels). No amendment.
- **Section / requirement:** PRD-600-R18 (achieved level by **probing**, not trusting `conformance.level`); PRD-107-R6 (Core inclusion list — `index_url` + `node_url_template`); PRD-107-R8 (Standard adds `subtree_url_template` / `capabilities.subtree`); PRD-107-R10 (Plus adds `index_ndjson_url` + `search_url_template` / `capabilities.search.template_advertised`).
- **Surfaced by:** Lead+QA pairing at G2 sign-off — open question #3 against the slice. The Lead added `probeCapabilityBand` to `packages/validator/src/walk.ts` to make `inferAchievedLevel` return the correct level for clean Standard manifests instead of defaulting to `plus`.
- **Verdict (2026-05-01, Spec Steward):** **No amendment needed.** The new `probeCapabilityBand` is a strict reading of the spec, not a divergence.
- **Rationale (cited):**
  - PRD-600-R18: "The `achieved` field MUST be populated by **probing**, not by trusting the manifest's `conformance.level`. PRD-600 MUST attempt every Core check; if every Core check passes, `achieved.level` is at least `"core"`. PRD-600 MUST then attempt every Standard check; if every Standard check passes, `achieved.level` is `"standard"`. PRD-600 MUST then attempt every Plus check; if every Plus check passes, `achieved.level` is `"plus"`." A default-to-plus implementation that runs no Plus probe and emits `achieved.level: "plus"` violates the third sentence (Plus checks must pass before Plus is reported).
  - PRD-107-R8 enumerates the Standard-tier capability advertisement: `subtree_url_template` (or `capabilities.subtree = true`). PRD-107-R10 enumerates the Plus-tier capability advertisement: `index_ndjson_url` + `search_url_template` (or `capabilities.search.template_advertised`). A manifest that advertises only the Standard set cannot, under PRD-600-R18's probing rule, achieve Plus.
  - `probeCapabilityBand` walks exactly that ladder: Core (`index_url` + `node_url_template`), Standard (+ `subtree_url_template`), Plus (+ `index_ndjson_url` + `search_url_template`). Each rung mirrors the inclusion list in PRD-107-R6 / R8 / R10 verbatim. The `inferAchievedLevel` cap (lower of gap-derived band, advertised band) is the correct probing semantics PRD-600-R18 requires.
- **Audit trail:** the prior default-to-plus was a permissive bug, not a defensible reading. The slice's correction lands the validator on PRD-600-R18 as written. No PRD edit required.
- **Closed:** 2026-05-01 (filed-and-closed in same triage session per SOP-2).

---

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-02 | Jeremy Forsythe | Initial creation. Filed A1–A4 from P3 Open questions triage at end of Phase 4. Four additional P2 ambiguities (PRD-201-R4 description-alias, PRD-201-R8/PRD-402-R8 section-index ID derivation, PRD-501-R9 manifest identity scope, PRD-106-R17/R18 runtime-served parent manifest) accepted as v0.2 candidates and remain documented in their source P3 PRDs' Open questions sections; not queued here. |
| 2026-05-01 | Spec Steward | Triaged A8 (PRD-700-R4 vs PRD-201-R23 mode-vs-level friction): trivial inline clarification on PRD-700-R4 per SOP-3, option (a) chosen, no PRD-201 / PRD-400 edit. Closed. Filed-and-closed A9 (validator `probeCapabilityBand` is a strict reading of PRD-107-R6/R8/R10 + PRD-600-R18; no amendment needed). LQ-1 (validator branch-coverage relaxation) surfaced to BDFL in `docs/lead-questions.md` — out of Spec Steward scope per role boundary. |
| 2026-05-02 | Spec Steward | Phase 6.2 prework triage. Closed A1 (PRD-200-R12 `metadata.translations` dedupe by `(locale, id)` — SOP-3, PRD stays Accepted, new positive fixture under `fixtures/200/`) and A3 (PRD-208-R3 pre-emit validation extended to PRD-102 block-level schemas — SOP-3, PRD stays Accepted, new negative fixture under `fixtures/208/`). Routed A2 (PRD-404 `parseMode` pass-through to PRD-201) through SOP-4 In review with a MINOR bump per PRD-108-R4(1); PRD-404 status set to `In review` pending BDFL sign-off, with a flagged cross-cutting recommendation that the BDFL consider an aligned MINOR bump on sibling generators PRD-402 / PRD-403 / PRD-408 to keep the parse-mode reach symmetric across hosts. A4 (PRD-602 hybrid mounts) remains open and awaits the BDFL decision in a separate session. A5 / A6 / A7 stay open with documented conservative interpretations and are not Phase-6.2-blocking. No new LQ entries surfaced. |
| 2026-05-02 | Jeremy Forsythe (BDFL) | Signed off A2: PRD-404 `In review → Accepted` (additive `parseMode` field, default `"coarse"` non-breaking; MINOR bump per PRD-108-R4(1)). Sibling-sweep recommendation accepted: filed A10 (PRD-408 Eleventy, Track B day-1 pickup), A11 (PRD-402 Hugo, spec-only, pre-ship sweep), A12 (PRD-403 MkDocs, spec-only, pre-ship sweep) as Open entries. Phase 6.2 Track B starts with PRD-300 → 301 → 302 → 303 then reaches PRD-404 (now Accepted with the new field) before PRD-408. Tracks A and C remain unblocked. Track D still gates on A4. |
| 2026-05-02 | Spec Steward | Routed A4 (PRD-602 hybrid multi-mount construction shape) through SOP-4 In review with a MINOR bump per PRD-108-R4(1). Authored the additive amendment surface on `prd/602-act-mcp-bridge.md`: PRD-602-R24 amended with optional `mounts?: BridgeMount[]` (and a minimal `StaticSource = { kind: 'static', manifestUrl, rootDir? }` shape consumed by the same walker PRD-600-R11 / PRD-706-R13 use); PRD-602-R3 restated to apply level validation per-mount; PRD-602-R5 restated so a single bridge identity covers all mounts (per PRD-706-R12 / R14); PRD-602-R6 restated to interleave the mount prefix into the canonical URI when `mounts` is supplied; PRD-602-R10 restated so per-mount IdentityBridge applies (optional for static-source mounts); PRD-602-R11 restated so per-mount subtree advertisement is independent. Status flipped Accepted → In review pending BDFL sign-off; positive fixture row `fixtures/602/positive/hybrid-runtime-plus-static.json` and negative fixture row `fixtures/602/negative/mounts-overlap-prefix/` enumerated under PRD-602's `## Test fixtures` (files not authored — Track D will create JSON when implementing). A4 moved to Closed. Track D's PRD-602 + PRD-706 implementation unblocked once BDFL signs off and PRD-602 returns to Accepted. No new LQ entries surfaced; the additive interpretation was clean (no MUST broken, no field removed, no `mounts`-omitted default behavior changed) so no escalation under PRD-108-R6 was triggered. |
| 2026-05-02 | Jeremy Forsythe (BDFL) | Signed off A4: PRD-602 `In review → Accepted` (additive `BridgeConfig.mounts` field with minimal `StaticSource` shape; per-mount restatements of R3/R5/R6/R10/R11 accepted verbatim; default-omitted path byte-identical to pre-amendment behavior; MINOR bump per PRD-108-R4(1)). Phase 6.2 Track D fully unblocked: PRD-601 (inspector CLI) → PRD-602 (now with multi-mount surface) → PRD-706 (hybrid example). All Phase 6.2 prework gates now closed: ADRs 001-004 ratified, LQ-1 closed, A1/A2/A3/A4 closed, A8/A9 already closed. A5/A6/A7 remain Open with documented conservative interpretations (non-blocking, deferred to G3 amendment triage). A10/A11/A12 are Open follow-ups for the parseMode sibling sweep (Track B / pre-ship). Phase 6.2 fan-out begins. |
