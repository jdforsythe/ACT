# PRD-102 — Content blocks (markdown, prose, code, data, marketing:* namespace), disclosure, related, variants

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

The v0.1 working draft enumerates content block types (`prose`, `code`, `callout`, `marketing:*`, etc.) and disclosure levels (`summary` / `abstract` / `body`) at §5.5–§5.6 in prose, but every detail that a producer or consumer actually needs is missing or contradictory. The block-type table at §5.5.2 lists `prose`, `code`, `data`, `callout` and the `marketing:*` namespace but never says which fields are required, what the canonical enum values are, whether the enums are open or closed, how variants encode their identity, what `summary_source` values mean, or whether `related` accepts cycles. Worse, the simplest case — "a markdown blob attached to a node" — has no canonical block type at all in the draft (it is implied by `prose` with `format: "markdown"`), which forces every adapter and every consumer to relitigate the same surface.

PRD-100 (sibling, in-flight) defines the node envelope itself and the `content` array slot. PRD-107 (Accepted) bands these block types across Core / Standard / Plus. Multiple gaps in `000-gaps-and-resolutions.md` (B4 component-contract emission, D2 variant identity, E3 cycles, E4 size cap, E5 `summary_source`, E8 summary length) name PRD-102 as their owner. Until this PRD lands, the 200-series adapters, the 300-series component instrumentation, and PRD-600 (validator) all have to invent their own block-shape contracts.

### Goals

1. Lock the canonical content-block taxonomy that nodes carry in their `content` array, with required and optional fields per type and explicit open/closed enum classification per PRD-108.
2. Define the three disclosure levels (`summary` / `abstract` / `body`) with length expectations, the `summary_source` enum, and the conformance band each level belongs to.
3. Define the shape of `related` cross-references (open enum of relation kinds, cycles permitted) and the cycle prohibition on `children`.
4. Lock the variant identity convention `{base_id}@{variant_key}`, the `metadata.variant` shape, and the relation conventions that link a base node and its variants.
5. Specify metadata for component-extracted blocks (`metadata.extracted_via`, `extraction_status`) and the placeholder block emitted on extraction failure.
6. Provide JSON Schemas for each canonical block type plus a generic schema for the `marketing:*` namespace, and a fixture corpus that PRD-600 can mechanically validate.
7. Codify the per-node soft size cap (10K body tokens, validator warning) and the producer responsibility to split oversized nodes.

### Non-goals

1. Defining the node envelope itself — its required fields, its `id` grammar, its `etag` field, its `tokens` object structure. That is PRD-100 (sibling, in-flight).
2. Defining the index envelope, the subtree envelope, or any URL-template syntax. PRD-100 owns the index envelope; PRD-105 (static) and PRD-106 (runtime) own the delivery envelopes.
3. Defining the i18n manifest or per-locale node emission. That is PRD-104 (sibling).
4. Specifying caching, ETag derivation, or revalidation semantics. That is PRD-103 (sibling).
5. Authoring the project-wide threat model. PRD-109 owns the security posture; this PRD inlines a minimal placeholder.
6. Specifying every well-known `code.language` or `data.format` value. The schemas list well-known values as documented-open enums; new values are added in MINOR bumps per PRD-108-R4(3).
7. Defining additional `marketing:*` block types beyond the five canonical ones (`hero`, `feature-grid`, `pricing-table`, `testimonial`, `faq`). The namespace is documented-open per PRD-107-R10; new types arrive in MINOR bumps per PRD-108-R4(4).

### Stakeholders / audience

- **Authors of:** PRD-100 (consumes this PRD's `content[]` block taxonomy in the node envelope schema); PRD-200 / 201–208 (every source adapter emits these blocks); PRD-300 (component instrumentation emits component-contract blocks); PRD-400 / 405 (Next.js generator) and other generators; PRD-600 (validator probes block conformance and the soft size cap).
- **Reviewers required:** Jeremy Forsythe (BDFL).

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Block-type sprawl — every adapter author proposes a new block type | High | Medium | The `marketing:*` namespace is the documented-open extension lane; the Core/Standard set is closed. Custom types MUST be namespaced (PRD-100 owns the type field grammar at the node level; for blocks, only `marketing:*` is documented-open in v0.1). |
| `data.value` and `data.text` drift — producers populate one and not the other, consumers can't tell which is canonical | Medium | Medium | PRD-102-R4 makes `text` canonical and `value` advisory. Validator emits a warning if both are present and `value` does not parse-equal `text`. |
| Markdown XSS — consumers naively render markdown blocks containing embedded HTML script tags | Medium | High | §Security calls out that consumers MUST NOT auto-execute scripts; producers SHOULD NOT embed script-bearing HTML. Cross-cuts PRD-109. |
| Variant keys collide with the ID grammar's slash separator | Low | Medium | Variant keys are restricted to `[a-z0-9-]+` (no slash, no dot), strictly tighter than the node ID grammar. The single `@` separator is reserved. |
| Cycle confusion — consumers walk `children` like `related` and never terminate | Medium | Medium | `children` MUST NOT contain cycles (R26). `related` MAY contain cycles; consumers walking `related` MUST detect cycles. Spelled out in §Specification and exercised by negative fixture `node-children-cycle.json`. |
| 10K-token soft cap becomes a hard cap by adapter convention | Low | Low | R30 is SHOULD with a validator warning, not an error. Authors MAY exceed it; the warning is informational. |

### Open questions

1. Should `markdown` and `prose` collapse into a single block type with `format: "markdown" | "plain"`? Today they are separate (markdown is the simplest base; prose is plain prose with an optional format field). Keeping them separate matches the v0.1 draft's intent and keeps the simplest case (`{ "type": "markdown", "text": "..." }`) free of an extra field. Revisit in v0.2 once we have adapter feedback.
2. Should `data.value` be removed entirely and consumers always parse `text`? Today `value` is optional and advisory, with `text` canonical. Keeping `value` as a convenience is producer-friendly and harmless given the canonical rule. Revisit if validator findings show the two routinely diverge.
3. Should component-extracted blocks carry a confidence score in metadata (e.g., headless-render extractions get `metadata.extraction_method: "headless-render"` per gap D4)? PRD-300 owns `extraction_method`; PRD-102 owns `extracted_via` and `extraction_status`. Revisit when PRD-300 lands.

### Acceptance criteria

- [x] Every requirement carries an ID of the form `PRD-102-R{n}` and a conformance level.
- [x] Inline JSON Schemas for `markdown`, `prose`, `code`, `data`, `callout`, and the generic `marketing:*` namespace are present in §Specification AND saved under `/schemas/102/`.
- [x] Positive fixtures cover each canonical block type, the `summary_source` field, the variant convention, and a `related` graph with a cycle.
- [x] Negative fixtures cover: missing required field on `code`, missing `text` on `data`, bad `level` on `callout` (closed-enum violation), bad casing in a `marketing:*` namespace suffix, a `children` cycle, a variant key violating `[a-z0-9-]+`.
- [x] The Versioning & compatibility table classifies block-type additions, `summary_source` enum additions, `code.language` enum additions, `callout.level` additions, `data.format` additions, and `marketing:*` additions per PRD-108.
- [x] Security section calls out: code blocks not executed, markdown not auto-rendering scripts, `data` blocks treated as data not content, PII in summary/abstract.
- [x] Cites PRD-107 R6 / R8 / R10 for the conformance bands.
- [x] Cites gaps B4, D2, E3, E4, E5, E8 for the resolutions adopted.
- [x] Changelog entry dated 2026-05-01 is present.

---

## Context & dependencies

### Depends on

- **PRD-107 (Accepted):** conformance bands. Core permits `markdown`; Standard adds `prose`, `code`, `data`, `callout`, the `abstract` disclosure level, and `related`; Plus adds the `marketing:*` namespace and component-contract metadata. Cited at PRD-107-R6, R8, R10.
- **PRD-108 (Accepted):** versioning policy. Adding a value to a documented-open enum is MINOR per R4(3); adding a value to a closed enum is MAJOR per R5(4); adding a new block type within the `marketing:*` documented-open namespace is MINOR per R4(4). The classification of every enum in this PRD is explicit.
- **PRD-000 (Accepted):** governance. State transitions and change-control rules for this PRD itself.
- **PRD-100 (sibling, in-flight):** node envelope. PRD-100 owns the `id` grammar, the `content` array slot, the `tokens` object, the `metadata` object, the `children` field, and the `related` field's slot in the envelope. PRD-102 specifies what flows through those slots: the block taxonomy, the relation shape, the variant convention, the disclosure semantics. The two PRDs interlock: PRD-100's schema references the block schemas defined here.
- External: [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174); CommonMark for the markdown block format; [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180) (CSV); [RFC 7464](https://www.rfc-editor.org/rfc/rfc7464) / NDJSON convention; YAML 1.2.

### Blocks

- **PRD-100 (sibling, in-flight):** the node envelope schema embeds the block schemas defined here. PRD-100 cannot reach Accepted with a stable `content[]` shape until PRD-102 is Accepted.
- **PRD-200 / 201–208 (adapters):** every adapter emits content blocks; they need the canonical block taxonomy locked.
- **PRD-300 (component instrumentation):** the page-level contract emits component-extracted blocks with `metadata.extracted_via: "component-contract"`, defined here.
- **PRD-400 / 405 (Next.js generator):** consumes the variant convention and the component-contract metadata.
- **PRD-600 (validator):** mechanically checks block schemas, the soft size cap, the variant key grammar, the `children` cycle prohibition, and the `summary` length warning.

### References

- v0.1 draft: §5.5 (Node format intro), §5.5.2 (Content block types), §5.5.3 (`type` taxonomy — node-level, not block-level), §5.6 (Progressive disclosure), §5.11.3 (component-contract emission), §5.11.4 (variant handling), §6.5 (corporate marketing example).
- `prd/000-gaps-and-resolutions.md` gaps B4 (component-contract emission), D2 (variant identity `{base_id}@{variant_key}`), E3 (cycles in `related` vs `children`), E4 (10K-token soft cap), E5 (`summary_source` enum), E8 (summary length).
- `prd/107-conformance-levels.md` R6 (Core block set), R8 (Standard additions), R10 (Plus `marketing:*` additions).
- `prd/108-versioning-policy.md` R4 (MINOR classification), R5 (MAJOR classification).
- Prior art: schema.org `Article` / `WebPage` content models (block-level structure exists but is implicit in HTML); MDX (block authoring with embedded components — orthogonal to wire format); MCP `Resource` content types (`text` / `blob` / `image`; flatter than ACT's typed-block model).

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) where requirements are imposed. Lowercase "must" and "should" are non-normative prose.

### Conformance level

This PRD's requirements are banded across Core / Standard / Plus per PRD-107.

- **Core:** R1 (markdown block), R26 (children cycle prohibition), R27 (summary always present), R29 (summary length SHOULD ≤50, validator warning >100), the disclosure-level definitions (R21–R23), the block ordering rule (R28), R30 (size cap SHOULD).
- **Standard:** R2 (prose), R3 (code), R4 (data), R5 (callout), R12–R14 (`summary_source`), R15–R19 (`related` shape, cycles permitted), R24 (abstract field).
- **Plus:** R6–R11 (`marketing:*` namespace and the five canonical types), R20 (component-extracted block metadata), R31 (variant convention is typically Plus but the convention itself is usable at Standard if the producer wishes; see note in R31).

A producer's declared conformance level (PRD-107-R1) determines which subset of these requirements applies; a Plus producer satisfies all of them by additivity (PRD-107-R11).

### Normative requirements

#### Block types — Core

**PRD-102-R1.** A `markdown` block MUST have shape `{ "type": "markdown", "text": <string> }`. The `text` field carries CommonMark markdown. The `text` field is REQUIRED. Producers MAY include a `metadata` object. Conformance: **Core**.

#### Block types — Standard

**PRD-102-R2.** A `prose` block MUST have shape `{ "type": "prose", "text": <string> }` with optional `format` field. The `format` field, when present, MUST be a string from the documented-open enum `{ "plain", … }`; absence means `"plain"`. Plain prose carries no markdown formatting; consumers MUST NOT apply markdown rendering to a `prose` block regardless of its `text` content. Conformance: **Standard**.

**PRD-102-R3.** A `code` block MUST have shape `{ "type": "code", "language": <string>, "text": <string> }`. The `language` field is REQUIRED and MUST be a string from a documented-open enum of well-known languages: `bash`, `javascript`, `typescript`, `python`, `go`, `rust`, `json`, `yaml`, `html`, `css`, `sql`, `shell`, `text`. Producers SHOULD use lowercase ASCII. Adding a value to this enum is MINOR per PRD-108-R4(3). The `text` field carries the source verbatim; producers MUST NOT transform whitespace. An optional `filename` MAY be present. Conformance: **Standard**.

**PRD-102-R4.** A `data` block MUST have shape `{ "type": "data", "format": <string>, "text": <string> }` with an optional `value` field. The `format` field is REQUIRED and MUST be a string from a documented-open enum: `json`, `csv`, `tsv`, `yaml`, `ndjson`. Adding a value is MINOR per PRD-108-R4(3). The `text` field is **canonical** and REQUIRED — it carries the serialized data exactly as the producer intends to convey it. The `value` field is OPTIONAL convenience; if present, it MUST be the structural equivalent of `text` parsed under `format`. On disagreement between `text` and `value`, `text` wins; PRD-600 emits a warning. Conformance: **Standard**.

**PRD-102-R5.** A `callout` block MUST have shape `{ "type": "callout", "level": <enum>, "text": <string> }`. The `level` field is REQUIRED and MUST be a string from the **documented-closed** enum `{ "info", "warning", "error", "tip" }`. Adding a value is MAJOR per PRD-108-R5(4). The `text` field is REQUIRED; markdown is allowed in `text`. Conformance: **Standard**.

#### Block types — Plus (`marketing:*` namespace)

**PRD-102-R6.** A block whose `type` matches the regex `^marketing:[a-z][a-z0-9-]*$` belongs to the `marketing:*` namespace. The namespace is **documented-open**: new `marketing:*` block types MAY be added in MINOR bumps per PRD-108-R4(4). Block types outside this regex MUST NOT use the `marketing:` prefix. Conformance: **Plus**.

**PRD-102-R7.** A `marketing:hero` block has the canonical shape `{ "type": "marketing:hero", "headline": <string>, "subhead": <string>, "cta": <object>? }`. The `headline` field is REQUIRED. The `subhead` and `cta` fields are OPTIONAL. The `cta` object, when present, has shape `{ "label": <string>, "href": <string> }`. Conformance: **Plus**.

**PRD-102-R8.** A `marketing:feature-grid` block has the canonical shape `{ "type": "marketing:feature-grid", "features": [<feature>, …] }`. The `features` array is REQUIRED. Each `feature` is an object with REQUIRED `title` (string) and `description` (string), and OPTIONAL `icon` (string, free-form identifier or URL). Conformance: **Plus**.

**PRD-102-R9.** A `marketing:pricing-table` block has the canonical shape `{ "type": "marketing:pricing-table", "tiers": [<tier>, …] }`. The `tiers` array is REQUIRED. Each `tier` is an object with REQUIRED `name` (string), REQUIRED `price` (string — opaque, e.g., `"$49/mo"` or `"Contact sales"`), and REQUIRED `features` (array of strings). Conformance: **Plus**.

**PRD-102-R10.** A `marketing:testimonial` block has the canonical shape `{ "type": "marketing:testimonial", "quote": <string>, "author": <string>, "role": <string>?, "org": <string>? }`. The `quote` and `author` fields are REQUIRED; `role` and `org` are OPTIONAL. Conformance: **Plus**.

**PRD-102-R11.** A `marketing:faq` block has the canonical shape `{ "type": "marketing:faq", "items": [<qa>, …] }`. The `items` array is REQUIRED. Each `qa` is an object with REQUIRED `question` (string) and REQUIRED `answer` (string; markdown allowed). Conformance: **Plus**.

#### Disclosure levels and `summary_source`

**PRD-102-R12.** A node MAY carry an OPTIONAL `summary_source` field on the node envelope (slot owned by PRD-100; values defined here). Its value, when present, MUST be a string from the **documented-open** enum `{ "llm", "author", "extracted" }`. Adding a value is MINOR per PRD-108-R4(3). Per gap E5. Conformance: **Standard**.

**PRD-102-R13.** Producers SHOULD declare `summary_source` whenever the producer can attribute the summary to a specific origin. Consumers MAY apply confidence weighting based on the value (e.g., weight `"author"` higher than `"llm"`). Consumers MUST tolerate the field's absence and MUST NOT refuse a node solely because `summary_source` is unset. Conformance: **Standard**.

**PRD-102-R14.** Consumers MUST tolerate unknown values of `summary_source` per PRD-108-R7 (the enum is documented-open). A consumer encountering an unknown value SHOULD treat it as if the field were absent for the purpose of confidence weighting. Conformance: **Standard**.

**PRD-102-R15.** The disclosure level **`summary`** is REQUIRED on every node at every conformance level (per PRD-107-R6 — Core). The `summary` field MUST be a non-empty string. Conformance: **Core**.

**PRD-102-R16.** The disclosure level **`abstract`** MAY appear on a node. When present, it MUST be a non-empty string. The slot is owned by PRD-100; PRD-102 specifies the semantics: an `abstract` is a paragraph-length summary, longer than `summary` but materially shorter than the full body. Conformance: **Standard**.

**PRD-102-R17.** The disclosure level **`body`** is the full `content` array on the node envelope. The `content` field is REQUIRED on every node at Core (slot owned by PRD-100); the block types permitted in it depend on conformance level per R1–R11. Conformance: **Core**.

#### `related` cross-references

**PRD-102-R18.** A node MAY carry a `related` field. The slot is owned by PRD-100; PRD-102 specifies its shape: `related` MUST be an array of objects, each with REQUIRED `id` (a node ID matching the grammar from PRD-100) and REQUIRED `relation` (a string from a documented-open enum). Adding a value to the `relation` enum is MINOR per PRD-108-R4(3). Conformance: **Standard**.

**PRD-102-R19.** Well-known values of `relation` are `"see-also"`, `"supersedes"`, `"variant_of"`, `"child_of"`, `"parent_of"`, `"translation_of"`, `"has-variant"`. Producers MAY use other values from the documented-open enum. Conformance: **Standard**.

**PRD-102-R20.** Cycles in the `related` graph ARE permitted (per gap E3). A node MAY appear in another node's `related` array even if the two nodes form a cycle through any combination of relations. Consumers walking the `related` graph MUST implement cycle detection; cycle-walking is the consumer's responsibility. Producers MUST NOT assume `related` is a tree or DAG. Conformance: **Standard**.

> Cross-cuts PRD-100: the `related` field's existence as a slot on the node envelope is owned by PRD-100; PRD-102 owns the per-element shape `{id, relation}` and the cycle policy.

#### Component-extracted blocks

**PRD-102-R21.** A block emitted by a component contract (per gap B4 and the v0.1 draft §5.11.3) MUST set `metadata.extracted_via: "component-contract"`. The `metadata` object lives on the block envelope (the slot is part of the block's `additionalProperties`; this PRD lifts it to a documented field). Conformance: **Plus**.

**PRD-102-R22.** When component-contract extraction fails, the producer MUST emit a `marketing:placeholder` block in the slot the failed component would have populated. The placeholder block MUST set `metadata.extracted_via: "component-contract"` AND `metadata.extraction_status: "failed"`. The placeholder MAY set `metadata.error` (a truncated error message) and `metadata.component` / `metadata.location` (per the v0.1 draft §5.11.3 logging guidance). Conformance: **Plus**.

**PRD-102-R23.** When component-contract extraction is partial — some fields extracted, others missing — the producer MUST emit the partially-populated block with `metadata.extracted_via: "component-contract"` AND `metadata.extraction_status: "partial"`. The block's REQUIRED fields per its type schema MUST still be present (a partial extraction that cannot satisfy the type's REQUIRED fields MUST be emitted as a `marketing:placeholder` per R22 instead). Conformance: **Plus**.

#### Block ordering

**PRD-102-R24.** The order of elements in a node's `content` array MUST match the render order of the source: top-to-bottom, depth-first per the component tree (per gap B4). Producers MUST NOT reorder blocks. Consumers MUST treat the array order as semantically meaningful. Conformance: **Core**.

#### Children cycle prohibition

**PRD-102-R25.** The `children` field on a node (slot owned by PRD-100) MUST NOT contain cycles. A node's `children` array MUST NOT include the node's own ID, and the transitive closure of `children` walks MUST terminate. This is a hard producer obligation (per gap E3). Validators MUST flag a `children` cycle as an error, not a warning. Conformance: **Core**.

#### Disclosure-level length expectations

**PRD-102-R26.** The `summary` field SHOULD be ≤50 tokens (per gap E8). PRD-600 (validator) MUST emit a warning when the `tokens.summary` value (or, when absent, an estimate) exceeds 100 tokens. The warning is informational and MUST NOT cause the node to be rejected. Conformance: **Core**.

**PRD-102-R27.** The `abstract` field, when present, SHOULD be in the range 80–200 tokens. PRD-600 MAY emit a warning outside that range; no error. Conformance: **Standard**.

#### Body size soft cap

**PRD-102-R28.** A producer SHOULD split a node when its total body tokens would exceed 10,000 (per gap E4). PRD-600 MUST emit a warning when `tokens.body` exceeds 10,000. There is no hard cap — the warning is informational. Producers MAY exceed the cap; consumers MUST handle oversized nodes. Conformance: **Core**.

#### Variants

**PRD-102-R29.** A variant node MUST have an ID of the form `{base_id}@{variant_key}` (per gap D2). The `base_id` portion MUST satisfy the node ID grammar from PRD-100. The `variant_key` portion MUST match `^[a-z0-9-]+$` (a strict subset of the node ID grammar — no slash, no dot, no underscore). The single literal `@` is the separator. Conformance: **Plus** (typically; see note below).

**PRD-102-R30.** When variant nodes are emitted, the **base node** at `{base_id}` MUST also be emitted as the canonical/control variant. A producer that emits `pricing@enterprise-2026q2` MUST also emit `pricing`. Conformance: **Plus**.

**PRD-102-R31.** A variant node MUST set `metadata.variant: { base_id, key, source }` where `base_id` and `key` echo the variant ID's two components and `source` is from the documented-open enum `{ "experiment", "personalization", "locale" }`. Adding a value to `source` is MINOR per PRD-108-R4(3). Conformance: **Plus**.

**PRD-102-R32.** Variant relationships SHOULD be expressed in the `related` graph: a variant points to its base with `relation: "variant_of"`, and a base MAY point to its variants with `relation: "has-variant"`. Producers SHOULD emit at least one direction. Consumers MUST tolerate either direction (or both) per R20's cycle tolerance. Conformance: **Standard**.

> Note: while variant emission is typically a Plus-tier feature (because the corporate-marketing scenarios that drive A/B testing are Plus-shaped), the variant convention itself works at Standard if the producer wishes — Standard producers MAY emit variant nodes following R29–R32 without promoting their declared conformance level. R29 is tagged Plus because the typical workload is Plus; the convention is forward-compatible with Standard adoption.

### Wire format / interface definition

This section inlines the JSON Schemas saved under `/schemas/102/`. Each schema is canonical at its `$id`; the inline copy here is for review convenience.

#### `markdown` block

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://act-spec.org/schemas/0.1/block-markdown.schema.json",
  "title": "ACT content block — markdown",
  "type": "object",
  "required": ["type", "text"],
  "additionalProperties": true,
  "properties": {
    "type": { "type": "string", "const": "markdown" },
    "text": { "type": "string", "minLength": 0 },
    "metadata": { "type": "object", "additionalProperties": true }
  }
}
```

#### `prose` block

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://act-spec.org/schemas/0.1/block-prose.schema.json",
  "title": "ACT content block — prose",
  "type": "object",
  "required": ["type", "text"],
  "additionalProperties": true,
  "properties": {
    "type": { "type": "string", "const": "prose" },
    "text": { "type": "string" },
    "format": { "type": "string", "default": "plain" },
    "metadata": { "type": "object", "additionalProperties": true }
  }
}
```

#### `code` block

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://act-spec.org/schemas/0.1/block-code.schema.json",
  "title": "ACT content block — code",
  "type": "object",
  "required": ["type", "language", "text"],
  "additionalProperties": true,
  "properties": {
    "type": { "type": "string", "const": "code" },
    "language": { "type": "string", "minLength": 1 },
    "text": { "type": "string" },
    "filename": { "type": "string" },
    "metadata": { "type": "object", "additionalProperties": true }
  }
}
```

#### `data` block

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://act-spec.org/schemas/0.1/block-data.schema.json",
  "title": "ACT content block — data",
  "type": "object",
  "required": ["type", "format", "text"],
  "additionalProperties": true,
  "properties": {
    "type": { "type": "string", "const": "data" },
    "format": { "type": "string" },
    "text": { "type": "string" },
    "value": { "type": ["object", "array", "string", "number", "boolean", "null"] },
    "metadata": { "type": "object", "additionalProperties": true }
  }
}
```

#### `callout` block

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://act-spec.org/schemas/0.1/block-callout.schema.json",
  "title": "ACT content block — callout",
  "type": "object",
  "required": ["type", "level", "text"],
  "additionalProperties": true,
  "properties": {
    "type": { "type": "string", "const": "callout" },
    "level": { "type": "string", "enum": ["info", "warning", "error", "tip"] },
    "text": { "type": "string", "minLength": 1 },
    "metadata": { "type": "object", "additionalProperties": true }
  }
}
```

#### `marketing:*` namespace (generic)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://act-spec.org/schemas/0.1/block-marketing-namespace.schema.json",
  "title": "ACT content block — marketing:* namespace (generic)",
  "type": "object",
  "required": ["type"],
  "additionalProperties": true,
  "properties": {
    "type": { "type": "string", "pattern": "^marketing:[a-z][a-z0-9-]*$" },
    "metadata": { "type": "object", "additionalProperties": true }
  }
}
```

The five canonical `marketing:*` types (`hero`, `feature-grid`, `pricing-table`, `testimonial`, `faq`) follow the per-type field shapes specified in R7–R11. Adapter authors MAY emit additional `marketing:*` types within the namespace; PRD-600 validates only the namespace pattern, not per-type field shapes for non-canonical types.

### Errors

This PRD does not introduce wire-format errors of its own; producer-side conditions surface as build warnings or build errors per the adapter conventions in PRD-200. PRD-600 emits the validator findings tabulated below.

| Condition | Producer-side response | Validator finding (PRD-600) |
|---|---|---|
| `code` block missing `language` | Build error | Schema validation error citing PRD-102-R3 |
| `data` block missing `text` | Build error | Schema validation error citing PRD-102-R4 |
| `callout` block with `level` outside the closed enum | Build error | Schema validation error citing PRD-102-R5 |
| `marketing:*` block whose suffix violates `^[a-z][a-z0-9-]*$` | Build error | Schema validation error citing PRD-102-R6 |
| `summary_source` value outside the documented-open enum | Build warning | Validator warning citing PRD-102-R12 (the value is tolerated by consumers per R14) |
| `children` array contains a cycle | Build error | Validator error citing PRD-102-R25 |
| `summary` exceeds 100 tokens | Build warning | Validator warning citing PRD-102-R26 |
| `abstract` outside 80–200 tokens | (none) | Validator MAY emit informational warning per PRD-102-R27 |
| `tokens.body` exceeds 10,000 | Build warning (recommended) | Validator warning citing PRD-102-R28 |
| Variant key violates `^[a-z0-9-]+$` | Build error | Schema/grammar validation error citing PRD-102-R29 |
| Variant node emitted without its base node also being emitted | Build error | Validator error citing PRD-102-R30 |
| `data.text` and `data.value` disagree (when both present) | Build warning | Validator warning citing PRD-102-R4 |

PRD-109 owns project-wide security errors. PRD-100 owns envelope-level errors (e.g., missing `id`, missing `act_version`).

---

## Examples

Examples are non-normative but consistent with the Specification section; PRD-600 will validate them against the schemas above.

### Example 1 — A Core node with a single markdown block

```json
{
  "act_version": "0.1",
  "id": "intro",
  "type": "article",
  "title": "Introduction",
  "etag": "sha256:001",
  "summary": "What Acme is and who it's for.",
  "content": [
    {
      "type": "markdown",
      "text": "# Introduction\n\nAcme orchestrates scheduled work across distributed services."
    }
  ],
  "tokens": { "summary": 9, "body": 36 }
}
```

This satisfies R1, R15, R17, R24, R26.

### Example 2 — A Standard node with mixed block types and `summary_source`

```json
{
  "act_version": "0.1",
  "id": "intro/getting-started",
  "type": "tutorial",
  "title": "Getting started",
  "etag": "sha256:002",
  "summary": "Install the SDK and send your first request in 5 minutes.",
  "summary_source": "author",
  "abstract": "This tutorial walks through installing the Acme SDK in Node.js or Python, configuring authentication, and making your first widget request. Expected time: ~5 minutes.",
  "content": [
    { "type": "markdown", "text": "## Install\n\nFirst, install the SDK." },
    { "type": "code", "language": "bash", "text": "npm install @acme/sdk" },
    { "type": "callout", "level": "warning", "text": "Node 18 or higher is required." },
    {
      "type": "data",
      "format": "json",
      "text": "{\"endpoints\":{\"api\":\"https://api.acme.example\"}}",
      "value": { "endpoints": { "api": "https://api.acme.example" } }
    }
  ],
  "tokens": { "summary": 13, "abstract": 42, "body": 920 },
  "related": [
    { "id": "concepts/authentication", "relation": "see-also" },
    { "id": "reference/widgets-api", "relation": "see-also" }
  ]
}
```

This satisfies R1, R2 (implied — no prose used here, but the markdown could be replaced), R3, R4, R5, R12 (`summary_source: "author"`), R15, R16 (abstract), R18 (`related` with `{id, relation}`), R19 (`see-also` is well-known), R26.

### Example 3 — A Plus pricing landing with `marketing:*` blocks

```json
{
  "act_version": "0.1",
  "id": "pricing",
  "type": "landing",
  "title": "Pricing",
  "etag": "sha256:003",
  "summary": "Acme pricing tiers and plan comparison.",
  "summary_source": "author",
  "content": [
    {
      "type": "marketing:hero",
      "headline": "Pricing that scales with you.",
      "subhead": "Start free. Pay as you grow.",
      "cta": { "label": "Start free trial", "href": "/signup" },
      "metadata": { "extracted_via": "component-contract" }
    },
    {
      "type": "marketing:pricing-table",
      "tiers": [
        { "name": "Starter", "price": "$0/mo", "features": ["Up to 1,000 requests/mo"] },
        { "name": "Pro", "price": "$49/mo", "features": ["Up to 100,000 requests/mo", "99.9% SLA"] },
        { "name": "Enterprise", "price": "Contact sales", "features": ["Unlimited requests", "Custom SLA"] }
      ],
      "metadata": { "extracted_via": "component-contract" }
    },
    {
      "type": "marketing:faq",
      "items": [
        { "question": "Can I self-host?", "answer": "Yes — Enterprise plans include a self-hosted option." }
      ],
      "metadata": { "extracted_via": "component-contract" }
    }
  ],
  "tokens": { "summary": 10, "body": 260 }
}
```

This satisfies R7, R9, R11, R21 (`extracted_via`), R24 (block ordering matches render order top-to-bottom).

### Example 4 — A variant of the Plus pricing page

```json
{
  "act_version": "0.1",
  "id": "pricing@enterprise-2026q2",
  "type": "landing",
  "title": "Pricing — Enterprise (2026 Q2)",
  "etag": "sha256:004",
  "summary": "Pricing — enterprise variant for the 2026-Q2 experiment arm.",
  "summary_source": "author",
  "content": [
    {
      "type": "marketing:hero",
      "headline": "Built for enterprise scale.",
      "subhead": "SLA-backed, audit-ready, and globally distributed.",
      "metadata": { "extracted_via": "component-contract" }
    }
  ],
  "tokens": { "summary": 14, "body": 90 },
  "metadata": {
    "variant": {
      "base_id": "pricing",
      "key": "enterprise-2026q2",
      "source": "experiment"
    }
  },
  "related": [
    { "id": "pricing", "relation": "variant_of" }
  ]
}
```

This satisfies R29 (ID grammar), R30 (the base `pricing` is also emitted — see Example 3), R31 (`metadata.variant` shape), R32 (`variant_of` relation).

### Example 5 — Component-contract extraction failure (placeholder)

```json
{
  "type": "marketing:placeholder",
  "metadata": {
    "extracted_via": "component-contract",
    "extraction_status": "failed",
    "error": "Hero.act.extract threw: Cannot read properties of undefined (reading 'tier')",
    "component": "PricingHero",
    "location": "src/marketing/PricingHero.tsx:42"
  }
}
```

This satisfies R6 (`marketing:placeholder` is a documented-open `marketing:*` type), R22 (placeholder for failed extraction), and the v0.1 draft §5.11.3 logging guidance.

### Example 6 — `related` with a cycle

```json
{
  "act_version": "0.1",
  "id": "concepts/auth",
  "type": "concept",
  "title": "Authentication",
  "etag": "sha256:006",
  "summary": "How Acme verifies callers via API keys and OAuth 2.0.",
  "content": [
    { "type": "markdown", "text": "## Schemes\n\nAcme accepts API keys and OAuth 2.0." }
  ],
  "tokens": { "summary": 13, "body": 40 },
  "related": [
    { "id": "concepts/security", "relation": "see-also" }
  ]
}
```

If `concepts/security` also lists `concepts/auth` in its own `related` array (forming a cycle), this is permitted per R20. Consumers walking the graph implement cycle detection.

---

## Test fixtures

Fixtures live under `/fixtures/102/` and are exercised by PRD-600 (validator) plus the adapter / generator test suites that emit blocks.

### Positive

- `fixtures/102/positive/block-markdown.json` → satisfies PRD-102-R1.
- `fixtures/102/positive/block-prose.json` → satisfies PRD-102-R2.
- `fixtures/102/positive/block-code.json` → satisfies PRD-102-R3.
- `fixtures/102/positive/block-data.json` → satisfies PRD-102-R4 (both `text` and `value` present and parse-equal).
- `fixtures/102/positive/block-callout.json` → satisfies PRD-102-R5.
- `fixtures/102/positive/block-marketing-hero.json` → satisfies PRD-102-R7 and R21.
- `fixtures/102/positive/block-marketing-feature-grid.json` → satisfies PRD-102-R8 and R21.
- `fixtures/102/positive/block-marketing-pricing-table.json` → satisfies PRD-102-R9 and R21.
- `fixtures/102/positive/block-marketing-testimonial.json` → satisfies PRD-102-R10 and R21.
- `fixtures/102/positive/block-marketing-faq.json` → satisfies PRD-102-R11 and R21.
- `fixtures/102/positive/block-marketing-placeholder-failed.json` → satisfies PRD-102-R6 and R22.
- `fixtures/102/positive/node-with-summary-source-author.json` → satisfies PRD-102-R12, R13, R15, R16.
- `fixtures/102/positive/node-with-summary-source-llm.json` → satisfies PRD-102-R12 with a different `summary_source` value.
- `fixtures/102/positive/node-with-related-cycle.json` → satisfies PRD-102-R18, R19, R20 (cycle-tolerant `related`).
- `fixtures/102/positive/node-variant-base.json` → satisfies PRD-102-R30 (base node) and R32 (`has-variant`).
- `fixtures/102/positive/node-variant.json` → satisfies PRD-102-R29 (variant ID), R31 (`metadata.variant`), R32 (`variant_of`).

### Negative

- `fixtures/102/negative/block-code-missing-language.json` → MUST be rejected because the `code` block is missing its REQUIRED `language` field (PRD-102-R3).
- `fixtures/102/negative/block-data-missing-text.json` → MUST be rejected because the `data` block is missing its REQUIRED `text` field; a `value`-only data block is not conformant (PRD-102-R4).
- `fixtures/102/negative/block-callout-bad-level.json` → MUST be rejected because `"danger"` is outside the closed enum `{info, warning, error, tip}` (PRD-102-R5). (Note: `"danger"` was in the v0.1 draft prose but has been replaced by `"error"` in the locked enum here.)
- `fixtures/102/negative/block-marketing-bad-namespace.json` → MUST be rejected because `marketing:Hero` violates the `^marketing:[a-z][a-z0-9-]*$` pattern (PRD-102-R6).
- `fixtures/102/negative/node-children-cycle.json` → MUST be rejected because the `children` array includes the node's own ID, forming a one-step cycle (PRD-102-R25).
- `fixtures/102/negative/node-variant-bad-key.json` → MUST be rejected because the variant key `Enterprise_2026Q2` violates the `^[a-z0-9-]+$` grammar (PRD-102-R29).
- `fixtures/102/negative/block-summary-source-bad-shape.json` → MUST be rejected because `summary_source` MUST be a string, not an array (PRD-102-R12).
- `fixtures/102/negative/block-data-html-as-content.json` → illustrates the security posture: a `data` block whose `text` is `<script>alert('xss')</script>` is wire-format-legal as far as the schema is concerned (the `text` is just a string), but consumers MUST NOT render it as content per §Security. The fixture is in the negative directory because conformant producers MUST NOT use a `data` block this way; PRD-600 emits a validator warning when a `data` block's `text` looks like script-bearing markup.

---

## Versioning & compatibility

Per PRD-108, classify each kind of change to PRD-102 as MAJOR or MINOR.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a new optional field to an existing block type (e.g., `code.line_numbers`) | MINOR | Per PRD-108-R4(1). Existing producers and consumers tolerate it (PRD-108-R7). |
| Add a value to the `code.language` enum | MINOR | The enum is documented-open (R3). Per PRD-108-R4(3). |
| Add a value to the `data.format` enum | MINOR | The enum is documented-open (R4). Per PRD-108-R4(3). |
| Add a value to the `summary_source` enum | MINOR | Documented-open (R12). Per PRD-108-R4(3). |
| Add a value to the `related[].relation` enum | MINOR | Documented-open (R18). Per PRD-108-R4(3). |
| Add a value to the `metadata.variant.source` enum | MINOR | Documented-open (R31). Per PRD-108-R4(3). |
| Add a new block type within the `marketing:*` namespace (e.g., `marketing:cta`) | MINOR | The namespace is documented-open (R6). Per PRD-108-R4(4). |
| Add a value to the `prose.format` enum | MINOR | Documented-open (R2). |
| Add a value to the `callout.level` enum | MAJOR | The enum is documented-closed (R5). Per PRD-108-R5(4). |
| Tighten a SHOULD to a MUST (e.g., make `summary_source` REQUIRED) | MAJOR | Per PRD-108-R5(3). |
| Loosen a MUST to a SHOULD | MAJOR | Per PRD-108-R5(3). |
| Change the variant ID grammar (e.g., allow underscore in `variant_key`) | MAJOR | Changes a syntactic constraint on a required field's value per PRD-108-R5(6). |
| Change the meaning of a REQUIRED block field (e.g., redefine `data.text` semantics) | MAJOR | Per PRD-108-R5(2). |
| Remove a block type (e.g., remove `prose`) | MAJOR | Per PRD-108-R5(1) — though "remove" applies to the block-type registry, the effect is identical: existing producers become non-conformant. Requires deprecation per PRD-108-R12. |
| Promote a block type from Standard to Core (e.g., make `prose` Core-required) | MAJOR | Changes the producer matrix; existing Core producers that omitted `prose` capability fail validation. Cite PRD-107's promotion rule. |
| Change the soft cap value (e.g., 10K → 5K body tokens) | MAJOR | Changes a SHOULD threshold that consumers may rely on for budgeting (per PRD-108-R5(3) by analogy). |
| Change the disclosure-level length expectations (e.g., summary SHOULD ≤30 tokens) | MAJOR | Same reasoning as the size cap. |
| Add a new soft warning threshold for the validator | MINOR | Validator-side warnings are informational; adding one does not change wire-format conformance. |
| Editorial / prose clarification with no normative effect | n/a | Per PRD-000-R18. |

### Forward compatibility

Per PRD-108-R7, consumers MUST tolerate unknown optional fields on any block. A consumer encountering a `marketing:cta` block (a hypothetical future addition under R6's documented-open namespace) MUST treat it as an opaque structured payload and SHOULD attempt to extract any embedded `headline`, `text`, `summary`, or similar string fields it recognizes by convention. A consumer encountering an unknown `code.language` value MUST still consume the block; the language is a hint, not a contract. A consumer encountering an unknown `summary_source` value treats it as if absent (R14).

### Backward compatibility

Within the v0.1 spec MAJOR (i.e., `0.x`), every accepted MINOR addition follows the rules above. A producer that emits only Core block types (`markdown`) and no `marketing:*` blocks remains valid Core forever, regardless of how many block types are added in subsequent MINORs. The `callout.level` closed enum is the one tightening surface that requires a MAJOR bump to extend; all other enums are open and extend in MINOR.

Across MAJOR boundaries, no backward compatibility is guaranteed. A future `1.0` MAY redefine block-type semantics; producers MUST follow the deprecation window in PRD-108-R12.

---

## Security considerations

This section is a **placeholder** that PRD-109 will subsume into the project-wide threat model. Nothing here departs from PRD-109's expected posture; deltas are documented at PRD-109 Accepted time.

- **Code blocks are not executed.** A `code` block carries source verbatim (R3). Consumers MUST NOT execute the contents. Even when `language` is `bash`, `javascript`, or `python`, the consumer's responsibility is to render or extract the text, never to evaluate it. Producers MUST NOT use `code` blocks as a covert execution channel.
- **Markdown blocks MUST NOT auto-execute scripts.** A `markdown` block's `text` is CommonMark; consumers that render it (HTML, terminal, agent context) MUST strip or escape `<script>` tags, `javascript:` URLs, event-handler attributes (`onclick`, `onerror`, etc.), and `data:` URIs containing executable payloads. Consumers SHOULD use a hardened markdown renderer (e.g., one that runs CommonMark with HTML disabled or with a sanitizer like DOMPurify on the rendered output). Producers SHOULD NOT embed script-bearing HTML in markdown blocks.
- **`callout.text` is markdown.** Same rules apply (R5).
- **`data` blocks are data, not content.** A `data` block's `text` is treated as data per its declared `format` (JSON, CSV, YAML, etc.). Consumers MUST NOT render the `text` as markdown, MUST NOT pass it to an HTML renderer, and MUST NOT execute scripts that the data happens to contain. A `data` block whose `text` is `<script>alert('xss')</script>` is wire-format-legal but semantically a data carrier, not content; consumers that mishandle it as content are mis-implementing this PRD. The negative fixture `block-data-html-as-content.json` exists to make this concrete.
- **PII in `summary` / `abstract`.** Producers SHOULD NOT include personally identifying information in summaries or abstracts. Both fields are returned in the index (`summary`) and in every node fetch (`summary` and `abstract`); they are subject to whatever caching and logging the consumer applies. A summary like `"Order #12345 for jane.doe@example.com — $49.00"` leaks identity and transactional data. Producer-side responsibility: redact or generalize before emission. Consumer-side responsibility: log carefully (PRD-109 owns log-line PII guidance).
- **Component-contract metadata.** The `metadata.error` field on a `marketing:placeholder` block (R22) MAY contain a truncated error message. Producers MUST NOT include stack traces, file system paths beyond the source file, or environment variables in `metadata.error`. PRD-300 owns the truncation rule (recommended: ≤200 characters, no inline secrets).
- **Variant identity is correlatable.** Variant IDs of the form `{base_id}@{variant_key}` reveal the experiment / personalization arm. Producers serving a variant to one identity and the canonical to another can leak which arm an identity is in by emitting both IDs. Producers SHOULD NOT emit variant nodes in the public-tenant index unless the experiment is itself public. Cross-cuts PRD-109 (correlation attacks) and PRD-103 (per-tenant ETag scoping).

PRD-109 will subsume these into a unified threat model when it is Accepted.

---

## Implementation notes

_Not applicable — this is a wire-format PRD. Implementation patterns for emitting blocks live in the 200-series adapter PRDs (block emission), the 300-series component-instrumentation PRDs (component-contract extraction and placeholder fallback), and the 400-series generator PRDs (block ordering, variant emission). PRD-600 implements the validator that mechanically checks the schemas and warnings defined here._

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft. Locks the canonical content-block taxonomy (Core: `markdown`; Standard: `prose`, `code`, `data`, `callout`; Plus: `marketing:*` namespace with five canonical types `hero`, `feature-grid`, `pricing-table`, `testimonial`, `faq`), the disclosure-level semantics (`summary` ≤50 tokens SHOULD, `abstract` 80–200 tokens, `body`), the `summary_source` documented-open enum (gap E5), the `related` shape with `{id, relation}` and cycle tolerance (gap E3), the `children` cycle prohibition (gap E3), the `{base_id}@{variant_key}` variant convention (gap D2), the `metadata.extracted_via` / `extraction_status` component-contract metadata (gap B4), and the 10K-token soft body cap (gap E4). Cites PRD-107 R6 / R8 / R10 for conformance bands and PRD-108 R4 / R5 for enum classification. Status: In review. |
| 2026-05-01 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
