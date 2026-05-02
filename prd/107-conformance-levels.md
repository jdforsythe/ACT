# PRD-107 — Conformance levels (Core / Standard / Plus) and reporting

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

The v0.1 working draft (`docs/plan/v0.1-draft.md`) introduces a wire format with many optional capabilities — `subtree`, `ndjson_index`, `etag`, `search`, `change_feed`, the `marketing:*` namespace, the i18n manifest, the `abstract` disclosure, the `related` cross-reference graph — without any banding to tell a producer "the bare minimum you must ship" or a consumer "the floor you can rely on." The result is that every other PRD has to relitigate which of its requirements are mandatory and which are optional, and consumers have no way to advertise a minimum version they will accept. Gap **A1** in `prd/000-gaps-and-resolutions.md` flags this as foundational. Gap **C1** in the same document additionally observes that the draft conflates the "runtime" *delivery profile* with a conformance band, when in fact a runtime server can be any level. Until both are pinned, PRD-100, PRD-105, PRD-106, PRD-600, and the entire 200/300/400/500-series cannot stabilize.

### Goals

1. Define exactly three named, ordered conformance levels — **Core**, **Standard**, **Plus** — each with a closed inclusion list of manifest fields, capability flags, envelope fields, and required endpoints.
2. Make conformance level **declarable** in the manifest under a single closed-enum field (`conformance.level`).
3. Make conformance level **orthogonal** to delivery profile (static vs runtime), so a consumer can require either dimension without dragging the other.
4. Specify the **additivity rule**: a Plus producer satisfies any Standard or Core consumer automatically.
5. Specify the **expected output shape** of the conformance reporter (declared vs achieved level, gap enumeration). PRD-600 implements; PRD-107 specifies.
6. Provide minimum-conformant and broken-conformance manifest fixtures per level so PRD-600's test corpus has a normative reference.
7. Define how level-related changes are versioned (in coordination with PRD-108) so future levels do not silently break consumers.

### Non-goals

1. **Defining the wire format itself.** That is PRD-100. This PRD only references existing fields and capability flags by name.
2. **Specifying the validator's implementation.** PRD-600 implements the conformance reporter; PRD-107 only specifies the JSON shape of its output and the criteria the reporter uses.
3. **Defining versioning rules.** That is PRD-108. This PRD cites the rules PRD-108 establishes.
4. **Defining the change-control process** for adding a fourth level or moving requirements between levels. That is `000-governance` (RFC / change-control process), with the MAJOR/MINOR classification deferred to PRD-108.
5. **Defining a sub-Core "Trace" level** for crawler-only minimal manifests. Parked as an open question for v0.2; do not introduce in v0.1.

### Stakeholders / audience

- **Authors of:** every PRD that imposes requirements with conformance bands — PRD-100, PRD-101, PRD-102, PRD-103, PRD-104, PRD-105, PRD-106, PRD-109, PRD-200, PRD-300, PRD-400-series generators, and PRD-500-series runtime SDKs (each PRD declares which level its requirements belong to under its "Conformance level" subsection).
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Levels too coarse — Standard becomes a dumping ground for "everything except search and i18n," and consumers can't ask for finer-grained capabilities. | Medium | Medium | Capability flags continue to exist as the fine-grained signal; level is a coarse contract. Consumers needing specifics inspect `capabilities.*`. |
| Levels too fine — three levels becomes five levels becomes ten, fragmenting the producer matrix. | Low | High | Closed enum (PRD-107-R1). Adding a fourth value is a MAJOR bump per PRD-108. The bar is intentionally high. |
| Producers game the declared level — claim Plus while missing required pieces. | Medium | Medium | The reporter's `achieved` vs `declared` mechanic (PRD-107-R20) is the antidote: the validator probes capabilities; it does not trust the manifest field. Consumers SHOULD verify with PRD-600 before relying on a declared level. |
| Future level redefinition (e.g., promoting `abstract` from Standard to Core) breaks every Core producer that previously passed. | Medium | High | Such a promotion is explicitly classified MAJOR in §"Versioning & compatibility". Governance per `000-governance` controls when MAJOR bumps land; deprecation window per PRD-108. |
| Orthogonality overlooked — implementers conflate "Plus" with "runtime" because most plus features were sketched in the runtime examples of the draft. | Medium | Medium | Spec section §"Orthogonality with delivery profile" makes this explicit with a worked hybrid-mounts example, and the reporter output (PRD-107-R20) carries `delivery` separately from `level`. |

### Open questions

1. Should there be a **sub-Core "Trace" level** for crawler-only minimal manifests (no index, just a discovery hand-off and a `human_url`)? Parked for v0.2 review. Not introduced in v0.1; leaving the door open requires no spec change because adding a level value is a MAJOR bump regardless.
2. Does `conformance.level` need a `version` qualifier (e.g., `level: "standard@0.2"`) so that a future redefinition of "Standard" can be advertised distinctly from `act_version`? Tentatively: no — `act_version` already disambiguates the spec revision the level definitions are drawn from. Reconsider if level redefinitions become frequent.
3. Should the reporter emit a numeric **`level_index`** (0/1/2) alongside the string for easier comparison in consumers? Tentatively: no — string-comparison-by-known-order is sufficient and avoids drift between the integer and the spec text. Reconsider after PRD-600 is built.

### Acceptance criteria

- [ ] All three levels are defined normatively, with the inclusion table from gap A1 reproduced and pinned to capability flags from §5.3 of the v0.1 draft.
- [ ] `conformance.level` is specified as a closed enum with values `"core" | "standard" | "plus"`.
- [ ] `delivery` is specified as orthogonal, with values `"static" | "runtime"`, and the hybrid `mounts` rule is restated.
- [ ] The reporter output JSON shape is specified, including `declared`, `achieved`, `gaps`, `warnings`, `passed_at`.
- [ ] One minimum-conformant manifest fixture is provided per level.
- [ ] One broken-conformance manifest fixture is provided per level, each illustrating a different failure mode.
- [ ] Test fixture file paths under `fixtures/107/` are enumerated.
- [ ] Versioning & compatibility table classifies the level-related change kinds per PRD-108.
- [ ] Security section documents the trust boundary on the declared level.
- [ ] Changelog initial entry dated 2026-04-30 is present.

---

## Context & dependencies

### Depends on

- **PRD-108**: versioning policy. PRD-107 cites PRD-108 for MAJOR/MINOR classification of changes to the level definitions and to the `conformance.level` enum.
- **000-governance**: RFC / change-control process. PRD-107 cites 000-governance for the procedural rules that gate any change to the level definitions (promoting a Standard requirement to Core, adding a fourth level, etc.).
- External: RFC 2119 (normative keywords); RFC 8174 (clarification of 2119 keywords in lowercase form).

### Blocks

- **PRD-100** — the manifest envelope must include the `conformance` and `delivery` fields specified here.
- **PRD-600** — the validator implements the conformance reporter whose output shape is specified here.
- **PRD-101, PRD-102, PRD-103, PRD-104, PRD-105, PRD-106, PRD-109** — each declares which conformance level its individual requirements belong to, using the bands defined here.

### References

- v0.1 draft: §5.3 (manifest capability flags), §5.4 (index — summaries + token estimates), §5.6 (disclosure levels), §5.7 (subtree endpoint), §5.9 (search and `search_url_template`), §5.12 (i18n manifest), §5.13 (delivery profiles: static / runtime / hybrid via `mounts`).
- `prd/000-gaps-and-resolutions.md` gap **A1** (conformance levels), gap **C1** (level/profile orthogonality).
- Prior art: levels-as-banding from WCAG (A / AA / AAA), schema.org core-vs-extended bands, OpenAPI `info.x-conformance` patterns. None directly adopted; cited for shape.

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) where requirements are imposed. Lowercase "must" and "should" are non-normative prose.

### Conformance level

This PRD defines the conformance level system itself. Every requirement here is **Core** in the sense that any ACT-conformant producer at any level MUST honor the level-declaration mechanism (PRD-107-R1 through PRD-107-R5). The level-specific requirements (PRD-107-R6 through PRD-107-R18) are by construction layered: Core requirements apply to any producer; Standard requirements apply additionally to Standard and Plus producers; Plus requirements apply only to Plus producers.

### Normative requirements

#### Level declaration and the closed enum

**PRD-107-R1.** A producer MUST declare its conformance level in the manifest under the field `conformance.level`. The value MUST be one of the closed enum `"core"`, `"standard"`, `"plus"` (lowercase ASCII).

**PRD-107-R2.** A consumer MUST treat any value of `conformance.level` outside the closed enum as a manifest validation error. Adding a fourth value to the enum is a MAJOR change per PRD-108.

**PRD-107-R3.** A producer MUST also declare its delivery profile in the manifest under `delivery`. The value MUST be one of `"static"`, `"runtime"`. (For hybrid sites, see PRD-107-R5.)

**PRD-107-R4.** Conformance level and delivery profile are orthogonal. A producer MAY declare any combination: `{ "level": "core", "delivery": "runtime" }` is as valid as `{ "level": "plus", "delivery": "static" }`.

**PRD-107-R5.** When a manifest declares a `mounts` array (per draft §5.13.5), each mount entry MUST carry its own `delivery` value and MAY carry its own `conformance.level`. A mount that omits `conformance.level` inherits the parent manifest's level. A consumer that requires "minimum Standard, runtime profile" MUST be served by mounts whose effective level is Standard or higher AND whose `delivery` is `"runtime"`; mounts that fail either dimension MUST NOT be used to satisfy the consumer's requirement.

#### The Core level

**PRD-107-R6.** A producer declaring `conformance.level: "core"` MUST satisfy all of the following.

**Manifest requirements (Core).**

- The manifest MUST include `act_version`, `site.name`, `index_url`, `node_url_template`, `conformance.level`, and `delivery`.
- The manifest MUST set `capabilities.etag = true` (or omit the flag and observe the default per PRD-100; either way, every node and the index MUST carry an `etag` field).

**Index requirements (Core).**

- The index MUST contain a `nodes` array.
- Every entry in `nodes` MUST carry `id`, `type`, `title`, `summary`, `tokens.summary`, `etag`.
- The `summary` field MUST be present on every node (no nulls, no omissions).

**Node-envelope requirements (Core).**

- Every node MUST carry `act_version`, `id`, `type`, `title`, `etag`, `summary`, `content`, `tokens`.

**Endpoint requirements — static profile (Core).**

- The well-known manifest MUST be reachable at `/.well-known/act.json` and respond `200` with the manifest envelope (or per the discovery hand-off in PRD-101 for runtime-only deployments).
- The index MUST be reachable at the URL declared by `index_url`.
- Every node referenced in the index MUST be reachable at the URL produced by substituting its `id` into `node_url_template`.

**Endpoint requirements — runtime profile (Core).**

- All static-profile Core endpoints, plus:
- The server MUST honor `If-None-Match` and respond `304 Not Modified` when the request's `If-None-Match` matches the resource's current ETag.
- The server MUST send the `ETag` HTTP header matching the envelope's `etag` field.

**PRD-107-R7.** A Core producer MUST NOT be required to expose the subtree endpoint, the NDJSON index, the search endpoint, the `marketing:*` block namespace, the i18n manifest, the `abstract` disclosure, or the `related` cross-reference graph. Core is the floor.

#### The Standard level

**PRD-107-R8.** A producer declaring `conformance.level: "standard"` MUST satisfy every Core requirement (PRD-107-R6) AND all of the following additional requirements.

**Manifest requirements (Standard, additive over Core).**

- The manifest MUST include `subtree_url_template`.
- The manifest MUST set `capabilities.subtree = true` (or, equivalently, declare the subtree endpoint via `subtree_url_template` per PRD-100's capability-flag conventions; PRD-600 treats either signal as authoritative for Standard probing).

**Node-envelope requirements (Standard, additive over Core).**

- A node MAY carry an `abstract` field. When the node's body content totals more than the threshold defined in PRD-102 (Tier-E recommendation: ~80 tokens of summary-equivalent material), the node SHOULD carry an `abstract`. PRD-102 owns the exact threshold; PRD-107 only requires that the *capability* — the ability for a node to carry an `abstract` — is part of Standard.
- A node MAY carry a `related` field listing cross-reference IDs.
- The `content` array MAY contain blocks of type `prose`, `code`, `data`, in addition to whatever Core permits. (PRD-102 enumerates the canonical block types; PRD-107 requires only that Standard producers support emitting those block types and that Standard consumers MUST tolerate them.)

**Endpoint requirements — static profile (Standard, additive).**

- A subtree file MUST be reachable at the URL produced by substituting an ID into `subtree_url_template`, for every node ID for which the producer claims subtree availability.

**Endpoint requirements — runtime profile (Standard, additive).**

- All static-profile Standard endpoints, plus the runtime ETag/304 behavior already required by Core.

**PRD-107-R9.** A Standard producer MUST NOT be required to expose the NDJSON index, the search endpoint, the `marketing:*` namespace, or the i18n manifest. Standard is the middle band.

#### The Plus level

**PRD-107-R10.** A producer declaring `conformance.level: "plus"` MUST satisfy every Standard requirement (PRD-107-R8, transitively including Core) AND all of the following additional requirements.

**Manifest requirements (Plus, additive over Standard).**

- The manifest MUST include `index_ndjson_url`.
- The manifest MUST include `search_url_template`.
- The manifest MUST set `capabilities.ndjson_index = true`.
- The manifest MUST set `capabilities.search.template_advertised = true` (or, per PRD-100's capability-flag conventions, declare the search endpoint via `search_url_template`; PRD-600 treats either signal as authoritative for Plus probing).
- If the producer's content includes more than one locale, the manifest MUST include the `locales` block defined in draft §5.12.1 (`locales.default`, `locales.available`, `locales.manifest_url_template`). A single-locale Plus producer MAY omit `locales`; PRD-104 owns the precise rule.

**Node-envelope requirements (Plus, additive over Standard).**

- The `content` array MAY contain blocks in the `marketing:*` namespace (e.g., `marketing:hero`, `marketing:feature-grid`, `marketing:pricing-table`, `marketing:testimonial`, `marketing:faq`). PRD-102 enumerates the canonical block types in this namespace.

**Endpoint requirements — static profile (Plus, additive).**

- An NDJSON index MUST be reachable at `index_ndjson_url`, with one node-index entry per line.
- A search endpoint MUST be reachable at the URL produced by substituting a query into `search_url_template`, returning the search envelope defined in draft §5.9.

**Endpoint requirements — runtime profile (Plus, additive).**

- All static-profile Plus endpoints, plus the runtime ETag/304 behavior inherited from Core.

#### Additivity

**PRD-107-R11.** Levels are additive in the consumer-facing direction. A producer declaring Plus MUST satisfy every requirement of Standard and Core. A producer declaring Standard MUST satisfy every requirement of Core. This is a normative consequence of PRD-107-R8 and PRD-107-R10, restated here for clarity.

**PRD-107-R12.** A consumer that asks for "minimum Standard or higher" MUST accept any producer declaring `conformance.level` of either `"standard"` or `"plus"`. A consumer MUST NOT refuse a Plus producer when its requirement is Standard.

**PRD-107-R13.** A consumer MAY refuse to consume from a producer whose declared level is below the consumer's minimum requirement. The consumer SHOULD surface the reason (declared level vs required level) in any error reported to its caller.

#### Capability flags vs level

**PRD-107-R14.** The `capabilities.*` flags defined by PRD-100 are the fine-grained signal. The `conformance.level` field is a coarse contract that bundles a known set of capability flags into a single named band. A producer MUST NOT set `capabilities.*` flags inconsistently with its declared level — for example, a `core` producer MUST NOT set `capabilities.subtree = true` unless it actually serves the subtree endpoint, but doing so does not promote the producer to Standard (the level field is the contract).

**PRD-107-R15.** A consumer that needs a capability beyond what the declared level guarantees (e.g., a Standard producer that happens to advertise `capabilities.search.template_advertised = true`) MAY use that capability, but MUST NOT rely on the level field alone to indicate its presence.

#### The reporter output shape

**PRD-107-R16.** A conformance reporter (implemented by PRD-600) MUST emit a JSON object with at least the following fields: `act_version`, `url`, `declared`, `achieved`, `gaps`, `warnings`, `passed_at`.

**PRD-107-R17.** The `declared` field MUST be an object with at least `level` and `delivery`, populated from the manifest's `conformance.level` and `delivery` values respectively. If the manifest omits one of these fields, the corresponding value in `declared` MUST be `null` and the reporter MUST emit a `gaps` entry citing the missing field.

**PRD-107-R18.** The `achieved` field MUST be an object with at least `level` and `delivery`. The `level` value MUST be the highest level (in the order `core < standard < plus`) the producer actually meets when probed; if the producer fails Core, `achieved.level` MUST be `null`. The `delivery` value MUST be the profile the producer was probed under.

**PRD-107-R19.** The `gaps` field MUST be an array. Each entry MUST be an object with at least `level`, `requirement`, `missing`. The `level` field is the level at which the gap was observed (i.e., the lowest declared-or-required level for which this gap matters). The `requirement` field is the PRD requirement ID (e.g., `"PRD-107-R8"` or `"PRD-102-R12"`). The `missing` field is a human-readable string describing what was probed and what the prober found instead. Each declared-but-not-achieved level MUST result in at least one `gaps` entry.

**PRD-107-R20.** The `warnings` field MUST be an array of objects with at least `level`, `code`, `message`. Warnings are non-blocking observations (e.g., "summary length exceeds the SHOULD threshold from PRD-102"); they MUST NOT cause `achieved` to differ from `declared`.

**PRD-107-R21.** The `passed_at` field MUST be an RFC 3339 timestamp at which the reporter completed its probe.

**PRD-107-R22.** A producer that declares a level it does not meet is **not** producing a wire-format error; the wire format is well-formed. The discrepancy is a validator finding emitted under `gaps`. Consumers that probe via PRD-600 SHOULD treat such producers as effectively at their `achieved` level for the purpose of the consumer's minimum-level check, and SHOULD log the discrepancy.

### Wire format / interface definition

#### `manifest.conformance` (JSON Schema fragment)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "ACT Manifest — conformance and delivery fields",
  "type": "object",
  "required": ["conformance", "delivery"],
  "properties": {
    "conformance": {
      "type": "object",
      "required": ["level"],
      "additionalProperties": false,
      "properties": {
        "level": {
          "type": "string",
          "enum": ["core", "standard", "plus"],
          "description": "Closed enum. Adding a value is a MAJOR change per PRD-108."
        }
      }
    },
    "delivery": {
      "type": "string",
      "enum": ["static", "runtime"],
      "description": "Delivery profile. Orthogonal to conformance.level."
    },
    "mounts": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["prefix", "delivery", "manifest_url"],
        "properties": {
          "prefix": { "type": "string" },
          "delivery": { "type": "string", "enum": ["static", "runtime"] },
          "manifest_url": { "type": "string", "format": "uri-reference" },
          "conformance": {
            "type": "object",
            "properties": {
              "level": { "type": "string", "enum": ["core", "standard", "plus"] }
            }
          }
        }
      }
    }
  }
}
```

#### Conformance reporter output (JSON Schema fragment)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "ACT conformance reporter output",
  "type": "object",
  "required": ["act_version", "url", "declared", "achieved", "gaps", "warnings", "passed_at"],
  "additionalProperties": false,
  "properties": {
    "act_version": { "type": "string", "description": "Spec version the reporter probed against, e.g. \"0.1\"." },
    "url": { "type": "string", "format": "uri", "description": "The well-known manifest URL probed." },
    "declared": {
      "type": "object",
      "required": ["level", "delivery"],
      "properties": {
        "level": {
          "oneOf": [
            { "type": "string", "enum": ["core", "standard", "plus"] },
            { "type": "null" }
          ]
        },
        "delivery": {
          "oneOf": [
            { "type": "string", "enum": ["static", "runtime"] },
            { "type": "null" }
          ]
        }
      }
    },
    "achieved": {
      "type": "object",
      "required": ["level", "delivery"],
      "properties": {
        "level": {
          "oneOf": [
            { "type": "string", "enum": ["core", "standard", "plus"] },
            { "type": "null" }
          ]
        },
        "delivery": {
          "oneOf": [
            { "type": "string", "enum": ["static", "runtime"] },
            { "type": "null" }
          ]
        }
      }
    },
    "gaps": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["level", "requirement", "missing"],
        "properties": {
          "level": { "type": "string", "enum": ["core", "standard", "plus"] },
          "requirement": { "type": "string", "pattern": "^PRD-[0-9]{3}-R[0-9]+$" },
          "missing": { "type": "string" }
        }
      }
    },
    "warnings": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["level", "code", "message"],
        "properties": {
          "level": { "type": "string", "enum": ["core", "standard", "plus"] },
          "code": { "type": "string" },
          "message": { "type": "string" }
        }
      }
    },
    "passed_at": { "type": "string", "format": "date-time" }
  }
}
```

### Errors

| Condition | Response | Notes |
|---|---|---|
| Manifest declares a `conformance.level` value outside the closed enum | Manifest validation error (build-time for static; configuration error at startup for runtime) | Per PRD-107-R2. Emitted as a `gaps` entry by PRD-600. |
| Manifest omits `conformance.level` or `delivery` | Manifest validation error | Per PRD-107-R1, PRD-107-R3. Reporter emits `declared.level: null` and a `gaps` entry. |
| Producer declares a level higher than it actually achieves (e.g., declares `"standard"` but the subtree endpoint returns 404) | Validator finding, not a wire-format error | Per PRD-107-R22. Reporter emits `achieved.level` lower than `declared.level` and one or more `gaps` entries. The wire format itself remains well-formed. |
| Mount entry has `conformance.level` outside the enum | Manifest validation error on the mount | Per PRD-107-R5; treated identically to a top-level invalid level. |
| Capability flag set inconsistently with level (e.g., `level: "core"` but `capabilities.subtree = true` and the subtree endpoint actually responds) | Warning, not error | Per PRD-107-R14. The level field is the contract; the capability flag is informational at sub-level granularity. |

ACT runtime endpoints follow the error envelope defined by PRD-100/PRD-106. PRD-107 does not introduce new HTTP status codes.

---

## Examples

### Example 1 — Minimum-conformant Core manifest (static)

```json
{
  "act_version": "0.1",
  "site": { "name": "Acme Tiny Docs" },
  "index_url": "/act/index.json",
  "node_url_template": "/act/n/{id}.json",
  "conformance": { "level": "core" },
  "delivery": "static",
  "capabilities": { "etag": true }
}
```

Notes: every Core manifest field is present. No `subtree_url_template`, `search_url_template`, `index_ndjson_url`, or `locales`. Every node served by this manifest carries `summary` and `etag`. This manifest passes Core when probed.

### Example 2 — Minimum-conformant Standard manifest (static)

```json
{
  "act_version": "0.1",
  "site": { "name": "Acme Standard Docs" },
  "index_url": "/act/index.json",
  "node_url_template": "/act/n/{id}.json",
  "subtree_url_template": "/act/sub/{id}.json",
  "conformance": { "level": "standard" },
  "delivery": "static",
  "capabilities": { "etag": true, "subtree": true }
}
```

Notes: adds `subtree_url_template` and `capabilities.subtree`. Nodes MAY carry `abstract` and `related`; the index MUST still carry `summary` per Core. The subtree endpoint actually responds for every advertised ID.

### Example 3 — Minimum-conformant Plus manifest (runtime, single-locale)

```json
{
  "act_version": "0.1",
  "site": { "name": "Acme Plus Workspace" },
  "index_url": "/act/index.json",
  "index_ndjson_url": "/act/index.ndjson",
  "node_url_template": "/act/n/{id}.json",
  "subtree_url_template": "/act/sub/{id}.json",
  "search_url_template": "/act/search?q={query}",
  "conformance": { "level": "plus" },
  "delivery": "runtime",
  "capabilities": {
    "etag": true,
    "subtree": true,
    "ndjson_index": true,
    "search": { "template_advertised": true }
  }
}
```

Notes: includes every Plus-required manifest field. NDJSON index, search endpoint, and subtree all respond. Nodes MAY use `marketing:*` blocks. Single-locale, so `locales` is omitted.

### Example 4 — Hybrid mounts: orthogonality of level and profile

```json
{
  "act_version": "0.1",
  "site": { "name": "Acme" },
  "conformance": { "level": "standard" },
  "delivery": "static",
  "mounts": [
    {
      "prefix": "/marketing",
      "delivery": "static",
      "manifest_url": "/marketing/.well-known/act.json",
      "conformance": { "level": "plus" }
    },
    {
      "prefix": "/app",
      "delivery": "runtime",
      "manifest_url": "/app/.well-known/act.json",
      "conformance": { "level": "standard" }
    }
  ]
}
```

A consumer asking "minimum Standard, runtime profile" follows the second mount only. A consumer asking "minimum Plus, static profile" follows the first mount only.

### Example 5 — Reporter output (declared Standard, achieved Core)

```json
{
  "act_version": "0.1",
  "url": "https://example.com/.well-known/act.json",
  "declared": { "level": "standard", "delivery": "static" },
  "achieved": { "level": "core", "delivery": "static" },
  "gaps": [
    {
      "level": "standard",
      "requirement": "PRD-107-R8",
      "missing": "subtree endpoint absent; GET /act/sub/intro.json returned 404 with no body"
    }
  ],
  "warnings": [],
  "passed_at": "2026-04-30T12:00:00Z"
}
```

This is the exact shape called out in the issue brief. The producer declared Standard but failed the subtree probe; the reporter records both the declared and achieved levels, plus one gap citing PRD-107-R8.

### Example 6 — Reporter output, all-passes Plus

```json
{
  "act_version": "0.1",
  "url": "https://example.com/.well-known/act.json",
  "declared": { "level": "plus", "delivery": "static" },
  "achieved": { "level": "plus", "delivery": "static" },
  "gaps": [],
  "warnings": [
    {
      "level": "plus",
      "code": "summary-length",
      "message": "Node 'pricing/enterprise' has summary length 132 tokens; PRD-102 SHOULD ≤ 50."
    }
  ],
  "passed_at": "2026-04-30T12:01:00Z"
}
```

---

## Test fixtures

Fixtures live under `fixtures/107/` and are exercised by PRD-600 (validator) plus the level-aware test suites of every PRD that references this one. PRD-107 enumerates the fixture filenames; PRD-600 owns the actual files.

### Positive

- `fixtures/107/positive/core-minimum.json` → manifest declaring `level: "core"`, `delivery: "static"`, with the smallest possible passing field set. Satisfies PRD-107-R1, R3, R6.
- `fixtures/107/positive/standard-minimum.json` → manifest declaring `level: "standard"`, `delivery: "static"`, with subtree advertised. Satisfies PRD-107-R8 (and transitively R6).
- `fixtures/107/positive/plus-minimum.json` → manifest declaring `level: "plus"`, `delivery: "runtime"`, with NDJSON index and search advertised. Satisfies PRD-107-R10 (and transitively R8, R6).
- `fixtures/107/positive/hybrid-mounts.json` → manifest with `mounts` array, parent at Standard/static, marketing mount at Plus/static, app mount at Standard/runtime. Satisfies PRD-107-R5.

### Negative

- `fixtures/107/negative/core-broken-missing-summary.json` → manifest declares `level: "core"` but the index entry for at least one node is missing its `summary` field. Reporter MUST emit a `gaps` entry citing PRD-107-R6 ("index entry lacks `summary`").
- `fixtures/107/negative/standard-broken-no-subtree.json` → manifest declares `level: "standard"` but `subtree_url_template` is absent. Reporter MUST emit a `gaps` entry citing PRD-107-R8 ("manifest declares Standard but omits `subtree_url_template`"), and `achieved.level` MUST be `"core"` (or `null` if Core also fails).
- `fixtures/107/negative/plus-broken-no-ndjson.json` → manifest declares `level: "plus"` but `index_ndjson_url` is missing OR the URL is present but the endpoint returns 404. Reporter MUST emit a `gaps` entry citing PRD-107-R10, and `achieved.level` MUST be `"standard"` (assuming Standard probes pass).
- `fixtures/107/negative/invalid-level-enum.json` → manifest declares `conformance.level: "premium"`. Reporter MUST emit a manifest validation `gaps` entry citing PRD-107-R2.
- `fixtures/107/negative/missing-delivery.json` → manifest declares `conformance.level: "standard"` but omits `delivery`. Reporter MUST emit `declared.delivery: null` and a `gaps` entry citing PRD-107-R3.
- `fixtures/107/negative/mount-overrides-bad.json` → parent declares Plus/static, mount entry declares `level: "showcase"`. Reporter MUST emit a `gaps` entry citing PRD-107-R5 with a sub-pointer to PRD-107-R2.

---

## Versioning & compatibility

Per PRD-108, classify each kind of change to PRD-107 as MAJOR or MINOR.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add an optional field inside a manifest section already required at level *L* | MINOR | E.g., adding a new optional `policy.contact` field at Core. Producers and consumers treat it per PRD-108's "tolerate unknown optional fields" rule. |
| Add an optional endpoint (e.g., a new `taxonomy_url_template`) inside an existing level | MINOR | Cite PRD-108. The level's required-endpoint set is unchanged; the new endpoint is optional. |
| Add a new capability flag inside an existing level (e.g., add `capabilities.export` as optional within Plus) | MINOR | The level's contract is unchanged; the flag is informational. |
| Add a value to the `conformance.level` closed enum (e.g., a future `"trace"` or `"deluxe"`) | MAJOR | The enum is closed (PRD-107-R1, R2). Adding a value redefines the universe of valid manifests. Cite PRD-108. |
| Add a value to the `delivery` closed enum | MAJOR | Same logic as above. |
| Promote a Standard requirement to Core (e.g., make `abstract` mandatory at Core) | MAJOR for the producer matrix | Existing Core producers that lacked the requirement become non-conformant. Deprecation window per PRD-108 (deprecate in MAJOR.MINOR; remove tolerance in (MAJOR+1).0 at earliest). Governance per `000-governance` controls when this lands. |
| Promote a Plus requirement to Standard | MAJOR for the producer matrix | Same logic. |
| Demote a Core requirement to Standard (relax the floor) | MAJOR | Loosening a MUST is MAJOR per PRD-108 because consumers depend on the constraint. |
| Tighten a SHOULD to a MUST inside a level | MAJOR | Per PRD-108. |
| Loosen a MUST to a SHOULD inside a level | MAJOR | Per PRD-108. |
| Change the reporter output JSON shape in a backward-incompatible way (rename a field, change a type) | MAJOR | Tools downstream of PRD-600 parse this shape; renames break them. |
| Add an optional field to the reporter output JSON shape | MINOR | E.g., adding a `level_index` numeric alongside the string. |
| Change the meaning of `achieved` (e.g., to mean "best level the producer claims to achieve" rather than "best level the prober verified") | MAJOR | Semantic change to a required field. |

### Forward compatibility

Per PRD-108, consumers MUST tolerate unknown optional fields in the manifest, in the reporter output, and in node envelopes. A consumer encountering an unrecognized capability flag MUST ignore it; the consumer MUST NOT infer level promotion from unrecognized flags. A consumer encountering a `conformance.level` value outside the enum MUST treat the manifest as invalid (PRD-107-R2) — the closed-enum rule is the lever that lets us add levels later as a controlled MAJOR bump rather than as silent drift.

### Backward compatibility

- A producer that upgrades from level *L* to level *L+1* MUST continue to satisfy level *L* (additivity, PRD-107-R11). No deprecation window is required for upgrades.
- A producer that wishes to **downgrade** its declared level (e.g., drop from Standard to Core because it can no longer host the subtree endpoint) MUST update its declared `conformance.level` in the manifest. Consumers that asked for "minimum Standard" will then be refused per PRD-107-R13. There is no deprecation window for declared-level downgrades; consumers handle it by re-probing.
- The `delivery` value MUST NOT change without a corresponding update to the manifest's discovery hand-off (PRD-101 owns that). A producer cannot advertise `static` and serve runtime, or vice versa, even transiently.

---

## Security considerations

The conformance level mechanism has limited security exposure on its own; security is mostly downstream in PRD-109. Notable points:

- **Trust boundary on the declared level.** Consumers SHOULD NOT trust a producer-declared `conformance.level` for any security-relevant decision without independently verifying capability flags or endpoint behavior. The reporter's `achieved` field (PRD-107-R18) is the verified value; the `declared` field (PRD-107-R17) is an unverified claim. Consumers that gate on level (e.g., "only consume Plus producers") SHOULD verify with PRD-600 or an equivalent prober before relying on the claim.
- **Producers SHOULD NOT use a consumer's declared minimum-level requirement as a trust signal.** A consumer asking for "minimum Standard" is asserting a content/feature requirement, not an authentication assertion. Per PRD-109, authentication and authorization remain orthogonal to level negotiation.
- **No information disclosure beyond the manifest itself.** The `conformance.level` and `delivery` fields, and the reporter output, do not leak resource existence beyond what PRD-100 already exposes. The reporter's `gaps` entries SHOULD avoid embedding response bodies or auth-scoped IDs verbatim — they MAY cite endpoint URLs and HTTP status codes. PRD-600 owns this guidance in its implementation.
- **Mounts and origin trust.** When a parent manifest's `mounts` entry points to a manifest at a different origin, the consumer MUST evaluate origin trust per PRD-109 before treating the mount's declared level as binding. This PRD does not relax that requirement.
- **No DoS surface.** The reporter is invoked offline or on demand against a single producer; it is not part of the runtime response path. PRD-600 owns reporter-side rate limits when run against third-party producers.

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-04-30 | Jeremy Forsythe | Initial draft per gap A1 and gap C1. |
| 2026-05-01 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
