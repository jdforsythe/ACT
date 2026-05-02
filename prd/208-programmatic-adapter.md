# PRD-208 — Programmatic adapter (escape hatch)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

PRD-201 (markdown), PRD-202 (Contentful), PRD-203/204/205/206 (Sanity / Storyblok / Strapi / Builder.io), and PRD-207 (i18n) cover the named source systems planned for v0.1. But every real ACT deployment will eventually hit content that lives outside these systems — a hand-curated e-commerce catalog (PRD-704) where each product is computed from a SKU file plus inventory data plus a CMS reference, a sitemap of dynamic pages whose URLs are produced by a custom routing function, a SaaS-internal data source (PRD-705 hybrid example) whose backing store is a proprietary database, an in-process build-time computation that derives content from a generative pipeline. Without a programmatic escape hatch, every such case forces either (a) writing a full custom adapter from scratch (high friction, low reuse), (b) fork-and-patch one of the existing adapters (drift over time), or (c) skipping ACT for that content (lost coverage).

PRD-200 (in review) pins the framework contract; the natural seam for an escape hatch is "let the user provide their own `enumerate` and `transform` directly to the framework, without wrapping in a source-system-specific adapter package." The escape hatch's value is shape: it MUST satisfy PRD-200's contract (so the generator can compose it with other adapters in a multi-source build), it MUST validate emitted nodes against PRD-100 (so user code cannot ship malformed output silently), and it MUST stamp provenance (PRD-200-R13) so downstream tools know which content came from user code vs. from a packaged adapter.

PRD-208 owns this escape hatch. It is the smallest of the 200-series adapter PRDs because the user supplies most of the behavior; PRD-208's contract is mostly about the wrapper that turns user-supplied functions into a conformant `Adapter`.

### Goals

1. Lock the **factory API**: `defineProgrammaticAdapter({ name, enumerate, transform, ... })` returns an `Adapter` per PRD-200-R1.
2. Lock the **author guarantees**: every node the user's `transform` returns is validated against `schemas/100/node.schema.json` before emission. Schema failures are surfaced with a clear "your code emitted a malformed node" error pointing at the offending node ID.
3. Lock the **error-handling policy**: by default, errors thrown from user code are recoverable (build warning, partial-node placeholder); `strict: true` config promotes them to unrecoverable per PRD-200-R18.
4. Lock the **source attribution**: nodes emitted by a programmatic adapter carry `metadata.source.adapter: "programmatic"` (or a user-provided label via `name:`); this lets the framework's `metadata.source.contributors` audit trail (PRD-200-R13) attribute fields back to user code.
5. Lock the **capability declaration**: the user supplies an `AdapterCapabilities` object (or the factory derives one from defaults). The factory MUST NOT auto-promote level — the user declares what their content satisfies.
6. Lock the **typing**: full TypeScript generics on the user's item shape and the user's config; the factory preserves type information across `enumerate` → `transform`.
7. Lock the **failure surface**: user code throwing during `enumerate` is unrecoverable (no items can be processed); user code throwing during `transform` is recoverable by default (placeholder node) or unrecoverable if `strict: true`.
8. Specify the **conformance band**: depends entirely on emitted content. The factory accepts a user-declared `level` and validates that emission is consistent with it during a sample probe (PRD-600 owns the deeper probe).
9. Enumerate the **test fixture matrix** under `fixtures/208/`.

### Non-goals

1. **Defining the adapter framework contract.** Owned by PRD-200.
2. **Defining the wire format.** Owned by PRD-100.
3. **Defining content blocks.** Owned by PRD-102.
4. **Sandboxing user code.** Per gap D3 / PRD-300's stance, v0.1 runs `extract` (and by extension, any user-supplied build-time code including PRD-208's user functions) in the build's main JS context with no sandbox. Sandboxing is a v0.2 concern for both PRD-300 and PRD-208.
5. **Replacing the named adapters.** PRD-208 is for content sources without a dedicated adapter. Operators with Contentful content SHOULD use PRD-202 even though PRD-208 could technically wrap a Contentful client; PRD-208 lacks the field-mapping / Rich Text / sync / locale-fan-out semantics PRD-202 provides.
6. **Defining a runtime-mode programmatic adapter.** Build-time only per PRD-200's framework. Runtime emission is owned by PRD-500/501.
7. **Specifying a non-TypeScript surface.** TS-only per Q3.

### Stakeholders / audience

- **Authors of:** PRD-704 (e-commerce catalog example) — the canonical PRD-208 user. PRD-705 (B2B SaaS hybrid) and PRD-706 (hybrid static + runtime + MCP bridge) also depend on programmatic emission for their dynamic-data slices. PRD-409 (standalone CLI) ships a recipe pointing at PRD-208 for users without a packaged adapter.
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| User code emits malformed nodes that crash downstream tools (validator, generator) when slipped through the factory's validation. | Medium | High | PRD-208-R3 requires every emitted node to pass `schemas/100/node.schema.json` validation in the factory; a failure throws with an error citing the node's ID and the schema violation. The factory's validator is the same one PRD-600 ships, ensuring consistent semantics. |
| User code declares `level: "plus"` but emits only Core-shaped content; the manifest advertises Plus capabilities the producer doesn't actually meet. | High | Medium | PRD-208-R8 requires the factory to sample-probe (every Nth node, default N=20) for level consistency: if a Plus-declared adapter emits zero `marketing:*` blocks across the sample, the factory emits a build warning citing PRD-107-R14. PRD-600 owns the deeper probe. |
| User code holds resources (DB connections, file handles) and forgets to clean up in `dispose`. | Medium | Medium | PRD-208-R5 makes `dispose` optional and the factory wraps it with a no-op default. Users explicitly opting into resource ownership ship a `dispose` function. The factory MUST invoke it idempotently per PRD-200-R7. |
| User-supplied `enumerate` is non-deterministic, breaking fixture stability across runs. | High | Low | PRD-208-R6 documents a SHOULD on determinism. The factory does NOT enforce — the user owns determinism. PRD-600's fixture-runner reports per-run drift; user remediation is to make their `enumerate` deterministic. |
| User code mutates `ctx.config`, breaking framework invariants. | Low | Medium | PRD-208-R4 reproduces PRD-200-R19's "MUST NOT mutate" requirement and the factory `Object.freeze`s the `ctx.config` object before passing to user code, surfacing a runtime error if user code attempts mutation. |
| User code calls back into the framework's emit / merge step from inside `transform`, breaking the lifecycle. | Low | Medium | PRD-208-R4 reproduces PRD-200-R5's "MUST NOT call back into enumerate / mutate other adapters' emitted nodes" rule. The factory does NOT expose `ctx.emit` to user code by default — emission is via the `transform` return value. (`ctx.emit` is available for advanced cases per PRD-200-R19, but PRD-208-R4 strongly recommends against calling it.) |
| Programmatic adapter is composed with other adapters and produces ID collisions because user code fails to namespace. | Medium | Medium | PRD-208-R7 declares `namespace_ids: true` by default; the factory namespaces user-emitted IDs under the adapter's `name` (default `"programmatic"`). Users opt out via `namespace_ids: false` AND accept responsibility for collision avoidance. |

### Open questions

1. ~~Should the factory expose a built-in helper for the common pattern "enumerate over an array, transform each via a single function"?~~ **Resolved (2026-05-01): Yes, as a documented convenience.** `defineSimpleAdapter({ name, items, transform })` shorthand for cases where `enumerate` returns a static array; documented in implementation notes as a convenience, not a separate normative API. The normative factory remains `defineAdapter`. (Closes Open Question 1.)
2. ~~Should the factory accept a `validate` hook for user-side custom validation before the framework's PRD-100 schema check?~~ **Resolved (2026-05-01): No for v0.1.** Keep the validation surface single; users who need extra checks throw from `transform`. Adding an optional `validate` hook later is MINOR per PRD-108-R4(1). (Closes Open Question 2.)
3. ~~Should `strict: true` (PRD-208-R10) elevate ALL warnings, or only `transform` errors?~~ **Resolved (2026-05-01): Only `transform` errors.** Other warning sources (capability mismatch, ID drift) stay informational so `strict: true` cannot mask configuration mistakes that need human attention. (Closes Open Question 3.)
4. ~~Should the factory expose a `delta` shorthand (e.g., comparing item arrays from one run to the next)?~~ **Resolved (2026-05-01): No.** `delta` is opt-in per PRD-200-R9; the user supplies their own implementation when needed. The factory passes through. (Closes Open Question 4.)
5. ~~Should the factory automatically populate `metadata.extracted_via: "programmatic"` on every emitted block?~~ **Resolved (2026-05-01): No.** `metadata.extracted_via` is reserved for the component-contract seam (PRD-102-R21 / PRD-200-R27). Programmatic emission is signaled via `metadata.source.adapter` instead. (Closes Open Question 5.)

### Acceptance criteria

- [ ] Every normative requirement has an ID `PRD-208-R{n}` and a declared conformance level per PRD-107.
- [ ] The Specification section opens with a table mapping every requirement to PRD-200 / PRD-100 requirements implemented.
- [ ] The factory API is reproduced inline with full TypeScript generics.
- [ ] Schema-validation behavior is pinned with one positive fixture and one negative fixture (user code emits a malformed node).
- [ ] Default error policy is pinned with a fixture showing recoverable failures producing partial nodes.
- [ ] `strict: true` mode is pinned with a fixture showing the same failure unrecoverable.
- [ ] Source attribution is pinned with a fixture showing `metadata.source.adapter: "programmatic"` (default) and one with a user-supplied `name`.
- [ ] Capability declaration is pinned with a fixture showing user-supplied `AdapterCapabilities` flowing through.
- [ ] Failure modes pinned: enumerate throws (unrecoverable); transform throws (recoverable by default, unrecoverable in strict); user code violates ID grammar (unrecoverable); user code emits scalar value of wrong type (caught by schema validation).
- [ ] Implementation notes ship 4–6 TS snippets covering: factory shape; user-supplied enumerate + transform; schema validation in the wrapper; strict-mode error handling; the e-commerce catalog use case.
- [ ] Test fixture path layout under `fixtures/208/` is enumerated.
- [ ] Versioning & compatibility section classifies every kind of change to PRD-208 per PRD-108.
- [ ] Security section cites PRD-109 and documents adapter-specific deltas (user code as trusted code, no sandbox, filesystem and network access posture).
- [ ] Changelog entry dated 2026-05-01 by Jeremy Forsythe is present.

---

## Context & dependencies

### Depends on

- **PRD-100** (Accepted) — wire format envelopes. Every emitted node MUST validate against `schemas/100/node.schema.json`.
- **PRD-102** (Accepted) — content blocks. User code emits PRD-102 blocks.
- **PRD-107** (Accepted) — conformance levels.
- **PRD-108** (Accepted) — versioning policy.
- **PRD-109** (Accepted) — security; cited for the user-code-as-trusted-code posture.
- **PRD-200** (In review) — adapter framework. The factory returns an `Adapter` per PRD-200-R1.
- **000-decisions-needed Q3** — TS-only first-party reference impl.
- External: [TypeScript 5.x generics](https://www.typescriptlang.org/), [Ajv](https://ajv.js.org/) (or equivalent JSON-Schema validator; the factory's validator dependency is owned by the package's `package.json`), [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

### Blocks

- **PRD-704** (e-commerce catalog) — the canonical user.
- **PRD-705** (B2B SaaS workspace) — uses programmatic emission for dynamic-data slices.
- **PRD-706** (hybrid static + runtime + MCP bridge) — uses programmatic emission for build-time-computed content alongside other adapters.

### References

- v0.1 draft: §5.10 (adapter pipeline), §6.4 (ID strategies — `composite`), §10 Q5 (extraction failure mapping).
- `prd/000-gaps-and-resolutions.md` gaps **B1** (lifecycle), **A4** (failure modes), **B3** (ID composition — programmatic adapters MUST follow the same namespacing rules), **D3** (build-time extraction safety — no sandbox).
- Prior art: [Astro content collections — `loader` API](https://docs.astro.build/en/reference/content-loader-reference/) (programmatic loaders that return entry objects), [Gatsby `sourceNodes`](https://www.gatsbyjs.com/docs/reference/config-files/gatsby-node/#sourceNodes) (programmatic node creation), [Eleventy `addCollection`](https://www.11ty.dev/docs/collections/#advanced-custom-filtering-and-sorting) (custom collection emitters), [Sourcebit](https://github.com/stackbit/sourcebit) (plugin-style source authoring).

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords as clarified by RFC 8174.

### Parent + 100-series requirements implemented

| PRD-208 requirement | Parent / 100-series requirement(s) | Relationship |
|---|---|---|
| R1 (factory returns `Adapter`) | PRD-200-R1, R2 | The result of `defineProgrammaticAdapter` satisfies `Adapter`. |
| R2 (config and user-function shape) | PRD-200-R20 | User supplies functions; factory wraps. |
| R3 (per-emission schema validation) | PRD-100-R21, PRD-200-R21 | Every emitted node validated against PRD-100 schema before passing to the framework. |
| R4 (mutation / re-entry guards) | PRD-200-R5, PRD-200-R19 | User code MUST NOT mutate `ctx.config` or call back into `enumerate`. |
| R5 (lifecycle wrappers) | PRD-200-R3, R4, R5, R7 | Factory wraps user-supplied functions with idempotent dispose, default precheck, etc. |
| R6 (determinism — SHOULD) | — | User-side advice; not enforceable. |
| R7 (namespace by default) | PRD-200-R10 | `namespace_ids: true` default; user can opt out. |
| R8 (capability sampling probe) | PRD-200-R22, PRD-107-R14 | Factory samples every Nth emission for level consistency. |
| R9 (source attribution) | PRD-200-R13 | `metadata.source.adapter: "programmatic"` (or user-supplied label). |
| R10 (`strict: true` mode) | PRD-200-R16, PRD-200-R18 | Promotes recoverable to unrecoverable. |
| R11 (recoverable failures — default) | PRD-200-R16 | User-thrown errors during transform → partial nodes. |
| R12 (unrecoverable failures) | PRD-200-R18 | Enumerate throws; init throws; user code emits malformed node; ID grammar violation. |
| R13 (level declaration) | PRD-200-R22, R24 | User declares; factory passes through; sample probe surfaces drift. |
| R14 (Stage-1 version pinning) | PRD-200-R25, PRD-108-R14 | Pinned to spec `0.1`. |
| R15 (test-fixture conformance) | PRD-200-R28 | Factory ships its own fixtures; user-authored programmatic adapters run additional fixtures user-side. |

### Conformance level

PRD-208 is a **wrapper**; the level the resulting adapter declares is determined entirely by the user-supplied content. The factory's own normative requirements (R1–R15) apply at every level the user might target — Core, Standard, or Plus — because the factory's invariants (schema validation, source attribution, mutation guards) are level-agnostic.

For documentation symmetry with the other 200-series leaves:

- **Core:** PRD-208-R1, R2, R3, R4, R5, R6, R7, R9, R11, R12, R14, R15.
- **Standard:** PRD-208-R8 (capability sampling becomes more meaningful when the user declares Standard or higher).
- **Plus:** PRD-208-R10 (`strict: true` is most often used for high-stakes Plus deployments where partial-output silence is undesirable).
- **All levels:** PRD-208-R13.

### Normative requirements

#### Factory API

**PRD-208-R1.** *(Core)* The package `act-programmatic` MUST export a function `defineProgrammaticAdapter` whose return value satisfies the `Adapter` interface from PRD-200-R1. The signature is:

```ts
export function defineProgrammaticAdapter<TConfig = void, TItem = unknown>(
  spec: ProgrammaticAdapterSpec<TConfig, TItem>,
): Adapter<TConfig, TItem>;
```

The returned adapter's `name` property MUST be the user-supplied `spec.name` (default `"programmatic"`). Every method on the returned adapter MUST honor PRD-200-R2's lifecycle order, with the wrappers documented in PRD-208-R5.

**PRD-208-R2.** *(Core)* The `ProgrammaticAdapterSpec` shape is:

```ts
export interface ProgrammaticAdapterSpec<TConfig = void, TItem = unknown> {
  name?: string;                                 // default "programmatic"
  precheck?(config: TConfig): Promise<void>;     // optional
  init?(config: TConfig, ctx: AdapterContext): Promise<AdapterCapabilities>;
  enumerate(ctx: AdapterContext): AsyncIterable<TItem> | TItem[] | Iterable<TItem>;
  transform(item: TItem, ctx: AdapterContext): Promise<EmittedNode | null> | EmittedNode | null;
  delta?(since: string, ctx: AdapterContext): AsyncIterable<TItem>;
  dispose?(ctx: AdapterContext): Promise<void> | void;
  capabilities?: AdapterCapabilities;            // declared once; `init` may override
  strict?: boolean;                              // PRD-208-R10
  namespaceIds?: boolean;                        // PRD-208-R7
  validate?: "before-emit" | "off";              // PRD-208-R3 — default "before-emit"
}
```

The user supplies AT LEAST `enumerate` and `transform`. All other fields are optional. When `init` is omitted, the factory's `init` returns `spec.capabilities` (or a default `AdapterCapabilities` per PRD-208-R13). When `dispose` is omitted, the factory's `dispose` is a no-op.

#### Schema validation

**PRD-208-R3.** *(Core)* By default, the factory MUST validate every emitted node against `schemas/100/node.schema.json` before passing it to the framework. Validation runs inside the factory's `transform` wrapper, after the user-supplied `transform` returns and before the framework receives the node:

- For full-node emissions (per PRD-200-R5), validate against `node.schema.json`.
- For partial emissions (per PRD-200-R5 with `_actPartial: true`), validate that `id` is present and conforms to PRD-100-R10; defer full-shape validation to the merge step (PRD-200-R12).
- For `null` (deliberate skip per PRD-200-R5), no validation — the framework records the skip.

Validation failure produces an unrecoverable error per PRD-208-R12, with the error message citing the node's `id` (when present) and the specific JSON-Schema violation. When `validate: "off"` is set, the factory MUST skip validation but MUST emit a build warning at `init` citing the operator's opt-out and the resulting risk surface.

#### Mutation and re-entry guards

**PRD-208-R4.** *(Core)* The factory's `transform` wrapper MUST:

- `Object.freeze` the `ctx.config` object before calling user-supplied `transform` (a shallow freeze; the framework's other ctx fields like `logger`, `idMinter`, `signal` are pre-frozen by the framework).
- NOT expose `ctx.emit` directly inside the user-callable surface; user code returns nodes from `transform` per the canonical path. Operators who explicitly need imperative emission MUST set `useImperativeEmit: true` in `spec` (a v0.2 candidate; v0.1 omits the flag entirely).
- Record an error when user code throws during `transform` (handled per PRD-208-R10 / R11).
- Catch synchronous throws and rejected Promises uniformly — both are mapped to the same recoverable / unrecoverable path.

User code MUST NOT call `ctx.emit`, MUST NOT mutate `ctx.config`, MUST NOT call back into `enumerate`, and MUST NOT mutate the items yielded by other adapters (the framework does not expose other adapters' items).

#### Lifecycle wrappers

**PRD-208-R5.** *(Core)* The factory's lifecycle implementation MUST:

- **`precheck` wrapper.** When `spec.precheck` is supplied, the factory's `precheck` calls it and surfaces any throw. When omitted, the factory's `precheck` is absent (the optional method is not on the returned adapter, per PRD-200-R8 which makes precheck optional).
- **`init` wrapper.** When `spec.init` is supplied, the factory's `init` calls it; the user's `init` MUST return an `AdapterCapabilities` object. When `spec.init` is omitted, the factory's `init` returns `spec.capabilities` if set, else a default object per PRD-208-R13.
- **`enumerate` wrapper.** Calls `spec.enumerate`. The factory tolerates three return shapes: `AsyncIterable<TItem>`, `Iterable<TItem>` (sync), and `TItem[]`. The factory normalizes to `AsyncIterable` for downstream uniformity. Errors thrown from `spec.enumerate` (or from the iterator's `.next()`) are unrecoverable per PRD-208-R12.
- **`transform` wrapper.** Calls `spec.transform`, validates the result per PRD-208-R3, stamps source attribution per PRD-208-R9, applies the strict / non-strict failure policy per PRD-208-R10 / R11, and returns the (possibly amended) node.
- **`delta` wrapper.** When `spec.delta` is supplied, the factory's `delta` calls it. Same error-handling model as `enumerate`.
- **`dispose` wrapper.** When `spec.dispose` is supplied, the factory calls it idempotently per PRD-200-R7 (the factory tracks whether dispose has run; subsequent invocations are no-ops). When omitted, the factory's `dispose` is a no-op.

The factory MUST NOT add observable behavior beyond these wrappers. Specifically, the factory MUST NOT log emissions to telemetry beyond what `ctx.logger` does, MUST NOT cache emitted nodes between runs, and MUST NOT modify the user's emitted nodes apart from source-attribution stamping (PRD-208-R9).

#### Determinism

**PRD-208-R6.** *(Core, advisory)* User-supplied `enumerate` SHOULD yield items in a deterministic order across runs to enable stable test fixtures and reproducible builds. The factory does NOT enforce determinism (it cannot, without comparing across runs); operators are responsible for sorting / seeding. PRD-600's fixture-runner reports per-run drift if it sees inconsistent emission order across runs. This requirement is non-normative because the framework cannot enforce it, but is documented for operator awareness.

#### ID namespacing

**PRD-208-R7.** *(Core)* The factory's default declared `namespace_ids` is `true`, meaning the framework prepends `<spec.name>/` to every emitted ID per PRD-200-R10. Operators MAY opt out via `spec.namespaceIds: false`; when they do, the user is responsible for ensuring no ID collisions across adapters (the framework still detects collisions per PRD-200-R12 and surfaces them as build errors). The factory MUST emit a build warning at `init` when `namespaceIds: false` is set AND a sibling adapter is also declared `namespace_ids: false` — both opt-outs together are a configuration smell.

The user's `transform` SHOULD return IDs that satisfy PRD-100-R10 directly; the factory does not pre-normalize. ID-grammar violations after the framework's namespacing pass are unrecoverable per PRD-208-R12.

#### Capability sampling

**PRD-208-R8.** *(Standard)* The factory MUST sample every Nth emission (default N=20, configurable via `spec.capabilitySampleEvery`) to verify the declared `level` is consistent with the actual content:

- For a declared `level: "core"`, the sample probe verifies that emitted blocks are all `markdown` (PRD-102-R1) and no `marketing:*` blocks are present (PRD-102-R6); a mismatch surfaces a build warning citing PRD-107-R14.
- For a declared `level: "standard"`, the sample probe verifies that `marketing:*` blocks are absent.
- For a declared `level: "plus"`, no probe (Plus is the highest band; everything passes).

The probe is a sample, not exhaustive; PRD-600 owns the exhaustive level probe across the full corpus. The probe's purpose is to surface common misdeclarations early in the build (e.g., a user who copy-pasted a Plus example but configured `level: "core"`).

#### Source attribution

**PRD-208-R9.** *(Core)* The factory's `transform` wrapper MUST stamp `metadata.source` per PRD-200-R13 if not already set by the user:

```ts
metadata.source = metadata.source ?? {
  adapter: spec.name ?? "programmatic",
  source_id: `${itemIndex}-${idHash}`,    // factory-generated when user did not supply
};
```

When the user explicitly sets `metadata.source.adapter`, the factory MUST NOT overwrite it — but the factory MUST emit a build warning if `metadata.source.adapter` differs from `spec.name`, because such a mismatch breaks the framework's contributors-merge audit trail (PRD-200-R13). The framework's merge step (PRD-200-R12) populates `metadata.source.contributors` with both the programmatic adapter's identity and any other adapters that contribute to the same node.

#### Strict mode

**PRD-208-R10.** *(Plus, advisory across all levels)* When `spec.strict: true` (default `false`), the factory's `transform` wrapper MUST treat user-thrown errors as unrecoverable per PRD-200-R18 — the factory throws, the build exits non-zero. When `strict: false` (default), user-thrown errors are recoverable per PRD-208-R11. Strict mode is RECOMMENDED for Plus-tier production deployments where silent partial-emission is operationally undesirable.

`strict: true` does NOT promote PRD-208-R3 schema-validation failures (those are always unrecoverable per PRD-208-R12) NOR PRD-208-R7 ID-grammar failures (also always unrecoverable). It promotes only `transform`-throw errors.

#### Failure modes

**PRD-208-R11.** *(Core)* Recoverable failures (default mode, `strict: false`) per PRD-200-R16 / R17:

| Condition | Status | Behavior |
|---|---|---|
| User-supplied `transform` throws (any error) | `"failed"` | Emit a placeholder node with `id` derived from the item index (when `id` cannot be inferred), `metadata.extraction_status: "failed"`, `metadata.extraction_error` set to the truncated error message, `content: []`. Build warning. |
| User-supplied `transform` returns a partial node (`_actPartial: true`) | n/a | Pass through to the framework's merge step per PRD-200-R12. |
| User-supplied `transform` returns `null` | n/a | Pass through; framework records skip per PRD-200-R5. |
| Capability-sampling drift detected (PRD-208-R8) | n/a | Build warning citing the discrepancy. |

**PRD-208-R12.** *(Core)* Unrecoverable failures per PRD-200-R18:

| Condition | Behavior |
|---|---|
| User-supplied `enumerate` throws (or its iterator throws on `.next()`) | Throw from `enumerate` wrapper; build error citing the offending iterator state. |
| User-supplied `init` throws | Throw from `init` wrapper; build error. |
| User-supplied `precheck` throws | Throw from `precheck` wrapper; build error. |
| User-supplied `transform` returns a node failing PRD-100-R21 schema validation | Throw with error citing the node's ID and the schema violation. |
| User-supplied `transform` returns a node whose ID fails PRD-100-R10 grammar (after framework namespacing) | Throw with error citing the node's emitted ID. |
| User-supplied `transform` throws AND `strict: true` | Throw; build error. |
| User-supplied `transform` returns a value that is neither `EmittedNode` nor `null` (e.g., `undefined`, a non-object) | Throw. |
| User-supplied `transform` returns a node with `metadata.source.adapter !== spec.name` AND warnings-as-errors policy is in effect at the generator level | (Not unrecoverable in PRD-208 itself; surfaced as warning per PRD-208-R9; the generator's policy can elevate.) |
| Factory's PRD-100 validator dependency throws an internal error | Treated as factory bug; surfaced as unrecoverable build error with stack. |

#### Capability declaration

**PRD-208-R13.** *(All levels)* The user supplies `AdapterCapabilities` via:

1. `spec.init`'s return value (highest precedence).
2. `spec.capabilities` field on the spec object.
3. Default factory object: `{ level: "core", concurrency_max: 8, namespace_ids: true, precedence: "primary", summarySource: "extracted", manifestCapabilities: {} }`.

The factory MUST NOT modify the user-declared capabilities except for the documented defaults. PRD-208-R8's sampling probe operates after declaration; mismatches surface as warnings, not as silent capability rewrites.

The user MAY declare `i18n: true` if the programmatic adapter handles locale fan-out; the factory does not enforce locale-shape consistency (PRD-104 owns the wire shape; the validator catches violations).

#### Version pinning

**PRD-208-R14.** *(Core)* `act-programmatic@0.1.x` is pinned to ACT spec `0.1` per PRD-200-R25. The factory's PRD-100 schema validator (PRD-208-R3) MUST reference the schemas under `schemas/100/` from the v0.1 release.

#### Test-fixture conformance

**PRD-208-R15.** *(Core)* The factory MUST pass:

1. Applicable PRD-200 framework fixtures under `fixtures/200/` per PRD-200-R28. The factory ships a "fixture adapter" (`defineProgrammaticAdapter` configured to emit the fixture's expected nodes) for each applicable framework fixture.
2. PRD-208 fixtures enumerated in §"Test fixtures."

User-authored programmatic adapters built ON TOP of the factory ship their own fixtures; PRD-208 specifies only the factory's correctness, not user-side conformance.

### Wire format / interface definition

PRD-208 introduces no new JSON wire shapes. The contract is the TypeScript factory API.

#### Factory API (TypeScript)

```ts
import type {
  Adapter, AdapterContext, AdapterCapabilities, EmittedNode,
} from "@act/adapter-framework";

export interface ProgrammaticAdapterSpec<TConfig = void, TItem = unknown> {
  name?: string;
  precheck?(config: TConfig): Promise<void>;
  init?(config: TConfig, ctx: AdapterContext): Promise<AdapterCapabilities>;
  enumerate(ctx: AdapterContext): AsyncIterable<TItem> | TItem[] | Iterable<TItem>;
  transform(item: TItem, ctx: AdapterContext): Promise<EmittedNode | null> | EmittedNode | null;
  delta?(since: string, ctx: AdapterContext): AsyncIterable<TItem>;
  dispose?(ctx: AdapterContext): Promise<void> | void;
  capabilities?: AdapterCapabilities;
  strict?: boolean;
  namespaceIds?: boolean;
  validate?: "before-emit" | "off";
  capabilitySampleEvery?: number;     // default 20
}

export function defineProgrammaticAdapter<TConfig = void, TItem = unknown>(
  spec: ProgrammaticAdapterSpec<TConfig, TItem>,
): Adapter<TConfig, TItem>;
```

There is no JSON config schema for PRD-208 itself — the user's `TConfig` generic is the schema, and the user is responsible for documenting it. (Contrast with PRD-201 / PRD-202 which publish concrete config schemas.)

### Errors

| Condition | Adapter behavior | Framework behavior | Exit |
|---|---|---|---|
| User `enumerate` throws | Throw from wrapper | Build error citing iterator state | non-zero |
| User `init` throws | Throw from wrapper | Build error | non-zero |
| User `precheck` throws | Throw from wrapper | Build error | non-zero |
| User `transform` returns malformed node (PRD-100 schema violation) | Throw from wrapper | Build error citing node ID + schema path | non-zero |
| User `transform` returns ID failing PRD-100-R10 | Throw from wrapper | Build error citing ID | non-zero |
| User `transform` throws AND `strict: true` | Throw from wrapper | Build error | non-zero |
| User `transform` throws AND `strict: false` | Emit placeholder with `extraction_status: "failed"` | Build warning | 0 |
| User `transform` returns non-`EmittedNode`/non-`null` | Throw from wrapper | Build error | non-zero |
| Capability sampling drift | Emit warning | Build warning | 0 |
| `metadata.source.adapter` mismatch | Emit warning | Build warning | 0 |
| `validate: "off"` opt-out | Emit warning at init | Build warning | 0 |

---

## Examples

### Example 1 — Minimal Core escape hatch (in-memory items)

```ts
import { defineProgrammaticAdapter } from "act-programmatic";

export default defineProgrammaticAdapter({
  name: "fixture-source",
  enumerate: () => [
    { id: "intro", title: "Introduction", body: "Hello, ACT." },
    { id: "guide", title: "Guide", body: "How to use ACT." },
  ],
  transform: (item) => ({
    act_version: "0.1",
    id: item.id,
    type: "article",
    title: item.title,
    etag: "",
    summary: item.body.slice(0, 60),
    content: [{ type: "markdown", text: item.body }],
    tokens: { summary: 4, body: 12 },
  }),
});
```

The factory wraps these into a full `Adapter`, namespaces emitted IDs as `fixture-source/intro` and `fixture-source/guide` per PRD-208-R7, validates each node against `schemas/100/node.schema.json` per PRD-208-R3, and stamps `metadata.source.adapter: "fixture-source"` per PRD-208-R9. Maps to `fixtures/208/positive/minimal-core-inline.json`.

### Example 2 — E-commerce catalog (PRD-704 use case)

```ts
import { defineProgrammaticAdapter } from "act-programmatic";
import { loadProducts, fetchInventory, fetchCMSCopy } from "./catalog-source";

interface CatalogConfig {
  productCsvPath: string;
  inventoryApiUrl: string;
  cmsSpaceId: string;
}

export default defineProgrammaticAdapter<CatalogConfig, ProductRow>({
  name: "act-catalog",
  async init(config, ctx) {
    ctx.logger.info(`act-catalog reading products from ${config.productCsvPath}`);
    return {
      level: "plus",                              // emits marketing:pricing-table per product
      concurrency_max: 8,
      namespace_ids: true,
      precedence: "primary",
      summarySource: "author",
      manifestCapabilities: { etag: true, subtree: true },
    };
  },
  async *enumerate(ctx) {
    const products = await loadProducts(this.config.productCsvPath);
    for (const p of products) {
      if (ctx.signal.aborted) return;
      yield p;
    }
  },
  async transform(item, ctx) {
    const inventory = await fetchInventory(item.sku, this.config.inventoryApiUrl);
    const copy = await fetchCMSCopy(item.cmsRef, this.config.cmsSpaceId);
    return {
      act_version: "0.1",
      id: `products/${item.sku.toLowerCase()}`,
      type: "product",
      title: copy.name,
      etag: "",
      summary: copy.shortDescription,
      summary_source: "author",
      content: [
        { type: "prose", format: "markdown", text: copy.longDescription },
        {
          type: "marketing:pricing-table",
          tiers: [
            { name: "List", price: `$${item.listPrice}`, features: ["full warranty", "30-day returns"] },
            ...(inventory.discount > 0 ? [{
              name: "Sale", price: `$${(item.listPrice * (1 - inventory.discount)).toFixed(2)}`,
              features: [`${(inventory.discount * 100).toFixed(0)}% off`, "limited time"],
            }] : []),
          ],
        },
      ],
      tokens: { summary: 12, body: 240 },
      metadata: { sku: item.sku, in_stock: inventory.qty > 0 },
    };
  },
  capabilitySampleEvery: 50,
});
```

The user's adapter declares Plus and emits `marketing:pricing-table` blocks per product. The factory's sample probe (every 50 emissions) verifies that the Plus declaration is consistent. Maps to `fixtures/208/positive/ecommerce-catalog.json`.

### Example 3 — `strict: true` for high-stakes deployment

The same adapter as Example 2 but configured with `strict: true`. When `fetchInventory` throws (e.g., the inventory API returns 500 for one SKU), the factory promotes the throw to unrecoverable per PRD-208-R10. The build exits non-zero rather than emitting a placeholder for that product. Maps to `fixtures/208/positive/strict-mode-promotes.json`.

### Example 4 — Schema-validation rejection (negative)

User code returns a node with `id: "Foo Bar"` (uppercase, space — fails PRD-100-R10). The factory's validator catches the grammar violation and throws per PRD-208-R12 citing the offending node ID. Maps to `fixtures/208/negative/transform-malformed-id.expected.json`.

### Example 5 — Recoverable transform throw (default mode)

User code's `transform` calls a service that throws on one item. With `strict: false` (default), the factory emits a placeholder:

```json
{
  "act_version": "0.1",
  "id": "act-catalog/products/widget-pro",
  "type": "product",
  "title": "Widget Pro (extraction failed)",
  "etag": "",
  "summary": "(extraction failed; placeholder)",
  "content": [],
  "tokens": { "summary": 4 },
  "metadata": {
    "extraction_status": "failed",
    "extraction_error": "fetchInventory: timeout after 5s",
    "source": { "adapter": "act-catalog", "source_id": "55-widget-pro" }
  }
}
```

Build exits zero with a warning. Maps to `fixtures/208/positive/recoverable-transform-throw.json`.

### Example 6 — User-supplied `metadata.source.adapter` mismatch (warning)

User code's `transform` explicitly sets `metadata.source.adapter: "external-feed"` while `spec.name` is `"act-catalog"`. The factory does NOT overwrite (PRD-208-R9), but emits a build warning citing the inconsistency. The `metadata.source.contributors` audit trail will list `"external-feed"` rather than `"act-catalog"`, breaking attribution if the operator later queries by `spec.name`. Maps to `fixtures/208/positive/source-adapter-mismatch-warning.json`.

---

## Test fixtures

Fixtures live under `fixtures/208/`. Per PRD-208-R15, applicable framework fixtures under `fixtures/200/` MUST also pass.

### Positive

- `fixtures/208/positive/minimal-core-inline.json` → R1, R2, R3, R5, R7, R9, R13. Example 1.
- `fixtures/208/positive/ecommerce-catalog.json` → R1, R2, R3, R8, R9, R13 (Plus). Example 2.
- `fixtures/208/positive/strict-mode-promotes.json` → R10. Example 3.
- `fixtures/208/positive/recoverable-transform-throw.json` → R11. Example 5.
- `fixtures/208/positive/source-adapter-mismatch-warning.json` → R9. Example 6.
- `fixtures/208/positive/precheck-implemented.json` → R5. User-supplied `precheck` runs before `init`.
- `fixtures/208/positive/dispose-idempotent.json` → R5, PRD-200-R7. User-supplied `dispose` runs once even if invoked twice.
- `fixtures/208/positive/enumerate-async-iterable.json` → R5. User returns an `AsyncIterable<TItem>`.
- `fixtures/208/positive/enumerate-array.json` → R5. User returns a `TItem[]` synchronously.
- `fixtures/208/positive/enumerate-iterable.json` → R5. User returns a sync `Iterable<TItem>` (e.g., a generator).
- `fixtures/208/positive/transform-returns-partial.json` → R3, PRD-200-R12. User returns `{ id, _actPartial: true, ... }`; factory passes through.
- `fixtures/208/positive/transform-returns-null.json` → PRD-200-R5. User returns `null`; framework records skip; no warning.
- `fixtures/208/positive/capability-sampling-plus-ok.json` → R8. Plus-declared adapter emits `marketing:*` blocks; sample passes.
- `fixtures/208/positive/capability-sampling-core-warns.json` → R8. Core-declared adapter emits a `marketing:hero` block; sample emits warning.
- `fixtures/208/positive/namespace-ids-default-true.json` → R7. Emitted IDs prefixed with `<spec.name>/`.
- `fixtures/208/positive/namespace-ids-opt-out.json` → R7. `namespaceIds: false`; emitted IDs not prefixed; warning emitted at init when sibling adapters also opt out.
- `fixtures/208/positive/delta-implemented.json` → R5, PRD-200-R9. User-supplied `delta(since)` yields only changed items.
- `fixtures/208/positive/spec-init-overrides-capabilities.json` → R13. User's `init` returns capabilities; takes precedence over `spec.capabilities`.
- `fixtures/208/positive/no-init-default-capabilities.json` → R13. Neither `init` nor `capabilities` supplied; factory uses default Core capabilities.
- `fixtures/208/positive/freeze-config-prevents-mutation.json` → R4. User code attempting to mutate `ctx.config` throws.
- `fixtures/208/positive/validate-off-warns.json` → R3. `validate: "off"` is honored; warning emitted at init.

### Negative

- `fixtures/208/negative/transform-malformed-id.expected.json` → R3, R12. Example 4.
- `fixtures/208/negative/transform-missing-required-field.expected.json` → R3, R12. User returns a node missing `tokens`.
- `fixtures/208/negative/transform-wrong-type-value.expected.json` → R3, R12. User returns `tokens: "not-an-object"`.
- `fixtures/208/negative/transform-returns-undefined.expected.json` → R12. User returns `undefined`; factory throws.
- `fixtures/208/negative/transform-throws-strict.expected.json` → R10, R12. User throws; `strict: true`; build error.
- `fixtures/208/negative/enumerate-throws.expected.json` → R12. User's enumerate throws.
- `fixtures/208/negative/init-throws.expected.json` → R12. User's `init` throws.
- `fixtures/208/negative/precheck-throws.expected.json` → R12. User's `precheck` throws.
- `fixtures/208/negative/transform-mutates-ctx-config.expected.json` → R4, R12. User code attempts `ctx.config.foo = "bar"`; freeze trap throws.
- `fixtures/208/negative/transform-emits-id-grammar-violation-after-namespace.expected.json` → R7, R12. User returns `id: "MY-ID"` and `namespaceIds: false`; the resulting ID fails PRD-100-R10.
- `fixtures/208/negative/factory-validator-internal-error.expected.json` → R12. Synthetic test where the validator's internal error path is triggered; surfaced as build error.

---

## Versioning & compatibility

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add an optional field to `ProgrammaticAdapterSpec` | MINOR | PRD-108-R4(1). Existing user code unaffected. |
| Add a required field to `ProgrammaticAdapterSpec` | MAJOR | PRD-108-R5(1). |
| Change default `validate` from `"before-emit"` to `"off"` | MAJOR | PRD-108-R5(7). Default-shape change; previously-validated user code now silently emits malformed nodes. |
| Change default `namespaceIds` from `true` to `false` | MAJOR | PRD-108-R5(7). Same risk as above. |
| Change default `capabilitySampleEvery` | MINOR | PRD-108-R4(1). Probing density adjustment; non-breaking. |
| Add a `useImperativeEmit` flag | MINOR | PRD-108-R4(1). Optional opt-in. |
| Tighten `strict: true` to also promote PRD-208-R3 violations | MAJOR | PRD-108-R5(7). Behavior change for previously-passing strict builds — strictly tighter, but existing strict deployments DO want this; argue for next MAJOR. |
| Loosen schema validation to "shape only, no enum check" | MAJOR | PRD-108-R5(7). |
| Promote `precheck` to mandatory | MAJOR | PRD-108-R5(3). |
| Add a `validate` enum value (e.g., `"shape-only"`) | MAJOR | PRD-108-R5(4). Closed enum. |
| Add a fixture row to the conformance corpus | MINOR | PRD-108-R4(2). |

### Forward compatibility

A v0.1 user-authored programmatic adapter built on `defineProgrammaticAdapter@0.1.x` runs against a v0.2 factory provided no MAJOR change has been made to `ProgrammaticAdapterSpec` or to PRD-200's `Adapter` interface. The factory tolerates unknown spec fields per PRD-108-R7.

### Backward compatibility

A v0.1 factory run against a v0.2 framework is unaffected provided the framework's `AdapterContext` shape and lifecycle order are unchanged. Stage 2 pinning (PRD-200-R26) opens the door for a single factory version to support spec `0.1` and `0.2`; the factory's PRD-100 schema validator (PRD-208-R3) will need to load schemas matching the spec version the framework targets.

---

## Security considerations

Cite PRD-109 (Accepted) for the project-wide threat model. PRD-208-specific deltas:

**User code as trusted code.** PRD-208 runs user-supplied JavaScript in the build process's main JS context with no sandbox (per gap D3 and PRD-300's stance). The threat model treats user code as trusted — the operator authored it or pulled it from a package they vetted. PRD-109 documents the trust boundary on adapter packages; PRD-208 inherits it. Operators consuming user-supplied programmatic adapters from third parties (e.g., via npm) MUST apply the same vetting they would to any build-time dependency: pin versions, review changelogs, audit dependencies. The factory does NOT add isolation; sandboxing options (vm2, isolated-vm) are listed for v0.2.

**Filesystem and network access.** User code in `enumerate` / `transform` / `init` may read files, fetch URLs, run subprocesses, etc. The factory does not restrict; the build environment's existing posture (CI permissions, file-system layout) bounds the surface. Operators MUST treat `act-programmatic` users with the same access controls they apply to other build scripts.

**Schema-validation as a safety net, not a trust boundary.** PRD-208-R3's schema validation catches malformed-output bugs but does NOT prevent malicious user code from emitting valid-but-misleading nodes (e.g., a hostile programmatic adapter could emit a node with `metadata.source.adapter: "act-contentful"` to forge provenance). The factory's source-adapter-mismatch warning (PRD-208-R9) surfaces such forgeries when `metadata.source.adapter !== spec.name`. PRD-200's `metadata.source.contributors` audit trail (populated by the merge step, not by user code) is the canonical attribution; user-supplied `metadata.source.adapter` is informational. Consumers and security tooling SHOULD verify by walking `contributors`, not by trusting the top-level `source.adapter`.

**Frozen `ctx.config` (PRD-208-R4).** `Object.freeze` on `ctx.config` is a defense-in-depth control. It prevents accidental mutation that could cascade across `transform` invocations (e.g., user code that rewrites `ctx.config.locales` mid-build). It does NOT prevent user code from cloning the config and operating on the clone, nor from holding mutable per-adapter state inside the adapter's closure. The freeze is a hint, not a guarantee; the canonical control is the trust boundary.

**Capability over-declaration as a trust signal.** PRD-208-R8's sampling probe surfaces declared-vs-actual level mismatches. A hostile programmatic adapter declaring Plus to advertise capabilities it doesn't meet is detected as a warning, not blocked. PRD-600 owns the deeper probe; consumers SHOULD probe via PRD-600 before trusting a producer's declared level (per PRD-107-R22).

**No credential handling by the factory.** PRD-208 itself consumes no credentials. User-supplied code MAY consume them (e.g., reading API tokens from env). The factory's logging surface (PRD-208-R5's wrappers) does NOT log user-supplied function arguments, return values, or thrown errors' full stacks beyond what `ctx.logger` records. User code SHOULD redact secrets in any errors thrown; PRD-109's redaction posture applies.

**ID-grammar enforcement (PRD-208-R7 / R12).** User code that produces grammar-violating IDs is caught before emission. This prevents a hostile content source (a CSV file controlled by an untrusted upstream) from injecting path-traversal-like IDs (`../foo`, `..%2Ffoo`) that, while caught by the framework's downstream schema, could waste build time or create confusing error reports.

**Determinism and reproducible builds.** PRD-208-R6 is advisory; non-deterministic user code can produce different outputs across runs, complicating supply-chain-security verification (e.g., reproducible-build attestations). Operators with reproducible-build requirements SHOULD pin user code to deterministic seeds and verify per-run-stable enumeration.

**Build-time only.** PRD-208 does not introduce a runtime endpoint. PRD-109's runtime auth surface does not apply.

---

## Implementation notes

Snippets show the canonical TypeScript shape; full implementation lives in `packages/act-programmatic/`.

### Snippet 1 — Factory implementation (PRD-208-R1, R5)

```ts
// packages/act-programmatic/src/index.ts

import Ajv from "ajv";
import nodeSchema from "@act/wire-format/schemas/100/node.schema.json";
import type {
  Adapter, AdapterContext, AdapterCapabilities, EmittedNode,
} from "@act/adapter-framework";

const validateNode = new Ajv({ allErrors: true }).compile(nodeSchema);

export function defineProgrammaticAdapter<TConfig = void, TItem = unknown>(
  spec: ProgrammaticAdapterSpec<TConfig, TItem>,
): Adapter<TConfig, TItem> {
  const name = spec.name ?? "programmatic";
  const sampleEvery = spec.capabilitySampleEvery ?? 20;
  let disposed = false;
  let itemIndex = 0;
  let declaredLevel: "core" | "standard" | "plus" = "core";

  return {
    name,

    ...(spec.precheck ? { precheck: (config) => spec.precheck!(config) } : {}),

    async init(config, ctx): Promise<AdapterCapabilities> {
      if (spec.validate === "off") {
        ctx.logger.warn(
          `act-programmatic: validate=off opts out of PRD-100 schema validation (PRD-208-R3); the operator accepts the risk of malformed envelopes`,
        );
      }
      const caps =
        spec.init ? await spec.init(config, ctx)
        : spec.capabilities ?? {
            level: "core",
            concurrency_max: 8,
            namespace_ids: spec.namespaceIds ?? true,
            precedence: "primary",
            summarySource: "extracted",
            manifestCapabilities: {},
          };
      declaredLevel = caps.level;

      if (rankOf(declaredLevel) > rankOf(ctx.config.targetLevel)) {
        throw new AdapterError({
          code: "level_mismatch",
          message: `target '${ctx.config.targetLevel}' below declared level '${declaredLevel}' (PRD-200-R24)`,
        });
      }
      return { ...caps, namespace_ids: spec.namespaceIds ?? caps.namespace_ids ?? true };
    },

    async *enumerate(ctx) {
      const out = spec.enumerate(ctx);
      try {
        if (Array.isArray(out)) {
          for (const item of out) yield item;
        } else if (Symbol.asyncIterator in (out as object)) {
          yield* (out as AsyncIterable<TItem>);
        } else {
          yield* (out as Iterable<TItem>);
        }
      } catch (err) {
        throw new AdapterError({
          code: "enumerate_threw",
          message: `programmatic enumerate threw: ${(err as Error).message}`,
        });
      }
    },

    async transform(item, ctx): Promise<EmittedNode | null> {
      const i = itemIndex++;
      const frozenCtx = { ...ctx, config: Object.freeze({ ...ctx.config }) };  // PRD-208-R4

      let result: EmittedNode | null;
      try {
        result = await spec.transform(item, frozenCtx);
      } catch (err) {
        if (spec.strict) {
          throw new AdapterError({
            code: "transform_threw_strict",
            message: `programmatic transform threw (strict): ${(err as Error).message}`,
          });
        }
        return placeholder(name, i, err as Error, ctx);          // PRD-208-R11
      }

      if (result === null) return null;
      if (typeof result !== "object") {
        throw new AdapterError({
          code: "transform_invalid_return",
          message: `programmatic transform returned ${typeof result}; expected EmittedNode | null`,
        });
      }

      // PRD-208-R3: validate before emit
      if (spec.validate !== "off" && !(result as { _actPartial?: boolean })._actPartial) {
        if (!validateNode(result)) {
          throw new AdapterError({
            code: "transform_malformed_node",
            message: `programmatic transform returned malformed node id='${(result as EmittedNode).id ?? "<unknown>"}': ${ajvErrorsToString(validateNode.errors)}`,
          });
        }
      }

      // PRD-208-R7: ID grammar
      const id = (result as EmittedNode).id;
      if (typeof id !== "string" || !ctx.idMinter.validate(id)) {
        throw new AdapterError({
          code: "transform_id_grammar",
          message: `programmatic transform emitted id '${id}' fails PRD-100-R10`,
        });
      }

      // PRD-208-R9: source attribution
      stampSource(result, name, i);

      // PRD-208-R8: capability sampling
      if (i % sampleEvery === 0) probeLevel(result, declaredLevel, ctx);

      return result;
    },

    ...(spec.delta ? { delta: (since, ctx) => spec.delta!(since, ctx) } : {}),

    async dispose(ctx) {
      if (disposed) return;             // PRD-200-R7 idempotent
      disposed = true;
      if (spec.dispose) await spec.dispose(ctx);
    },
  };
}
```

### Snippet 2 — Source-attribution stamping (PRD-208-R9)

```ts
// packages/act-programmatic/src/source.ts

export function stampSource(node: EmittedNode, name: string, itemIndex: number): void {
  if (!node.metadata) node.metadata = {};
  if (!node.metadata.source) {
    node.metadata.source = {
      adapter: name,
      source_id: `${itemIndex}-${(node as EmittedNode).id}`,
    };
  } else if (node.metadata.source.adapter !== name) {
    // Don't overwrite — but this is a smell.
    // Caller's logger surfaces the warning (the factory ctx is in scope at the call site).
  }
}
```

### Snippet 3 — Placeholder for recoverable transform throws (PRD-208-R11)

```ts
// packages/act-programmatic/src/placeholder.ts

export function placeholder(
  name: string,
  itemIndex: number,
  err: Error,
  ctx: AdapterContext,
): EmittedNode {
  ctx.logger.warn(`programmatic transform threw at item ${itemIndex}: ${err.message} (PRD-208-R11)`);
  return {
    act_version: ctx.config.actVersion as string,
    id: `${name}/__placeholder__/${itemIndex}`,
    type: "article",
    title: `(extraction failed at item ${itemIndex})`,
    etag: "",
    summary: "(extraction failed; placeholder)",
    content: [],
    tokens: { summary: 4 },
    metadata: {
      extraction_status: "failed",
      extraction_error: truncate(err.message, 500),
      source: { adapter: name, source_id: `${itemIndex}-failed` },
    },
  };
}
```

### Snippet 4 — Capability sampling (PRD-208-R8)

```ts
// packages/act-programmatic/src/probe.ts

export function probeLevel(
  node: EmittedNode,
  declared: "core" | "standard" | "plus",
  ctx: AdapterContext,
): void {
  const blocks = (node as EmittedNode).content ?? [];
  const hasMarketing = blocks.some((b) => typeof b.type === "string" && b.type.startsWith("marketing:"));
  const hasNonMarkdown = blocks.some((b) => typeof b.type === "string" && b.type !== "markdown" && !b.type.startsWith("marketing:"));

  if (declared === "core" && (hasMarketing || hasNonMarkdown)) {
    ctx.logger.warn(
      `programmatic capability sampling: declared level "core" but emitted '${blocks[0].type}' block (PRD-107-R14 / PRD-208-R8)`,
    );
  } else if (declared === "standard" && hasMarketing) {
    ctx.logger.warn(
      `programmatic capability sampling: declared level "standard" but emitted 'marketing:*' block (PRD-107-R14 / PRD-208-R8)`,
    );
  }
}
```

### Snippet 5 — User-side: e-commerce catalog (Example 2 abridged)

```ts
// user-code: packages/my-shop/act-catalog.ts

import { defineProgrammaticAdapter } from "act-programmatic";

export default defineProgrammaticAdapter({
  name: "act-catalog",
  async init(config, ctx) {
    return {
      level: "plus",
      concurrency_max: 8,
      namespace_ids: true,
      precedence: "primary",
      summarySource: "author",
      manifestCapabilities: { etag: true, subtree: true },
    };
  },
  async *enumerate(ctx) {
    for (const sku of await loadSkus()) {
      if (ctx.signal.aborted) return;
      yield sku;
    }
  },
  async transform(sku, ctx) {
    return await buildProductNode(sku);    // returns a fully-formed PRD-100 node
  },
  async dispose() { await closeDbPool(); },
});
```

### Snippet 6 — `defineSimpleAdapter` convenience (open question 1)

The package MAY also export a thin convenience wrapper for the static-array case:

```ts
// packages/act-programmatic/src/simple.ts (illustrative)

export function defineSimpleAdapter<TItem>(spec: {
  name?: string;
  items: TItem[];
  transform: (item: TItem, ctx: AdapterContext) => EmittedNode;
  capabilities?: AdapterCapabilities;
}): Adapter<void, TItem> {
  return defineProgrammaticAdapter({
    name: spec.name ?? "programmatic",
    enumerate: () => spec.items,
    transform: spec.transform,
    capabilities: spec.capabilities,
  });
}
```

Callers using `defineSimpleAdapter` get the same factory invariants (schema validation, source attribution, namespace defaults) for the trivial case.

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft. Pins the programmatic-adapter escape hatch on top of PRD-200's framework. Locks: factory API `defineProgrammaticAdapter<TConfig, TItem>(spec): Adapter<TConfig, TItem>` returning a fully PRD-200-R1-conformant adapter (R1); `ProgrammaticAdapterSpec` shape with optional `precheck` / `init` / `delta` / `dispose` / `capabilities` / `strict` / `namespaceIds` / `validate` / `capabilitySampleEvery` and required `enumerate` / `transform`, with full TypeScript generic preservation across the lifecycle (R2); per-emission PRD-100 schema validation (`schemas/100/node.schema.json`) before passing to the framework, with explicit `validate: "off"` opt-out and at-init warning (R3); mutation and re-entry guards including `Object.freeze` on `ctx.config` and the prohibition on calling `ctx.emit` from user code (R4); lifecycle wrappers normalizing AsyncIterable / Iterable / Array enumerate returns, idempotent dispose, and uniform error capture (R5); determinism SHOULD with operator responsibility for stable enumerate ordering (R6); default `namespace_ids: true` with opt-out warning when sibling adapters also opt out (R7); capability-sampling probe every Nth emission verifying declared level is consistent with emitted block types (R8); source-attribution stamping `metadata.source.adapter` to `spec.name` (default `"programmatic"`) without overwriting user-supplied values, with mismatch warning (R9); `strict: true` mode promoting transform throws to unrecoverable per PRD-200-R18 (R10); the recoverable failure path emitting a placeholder node with `extraction_status: "failed"` for transform throws under default mode (R11); the unrecoverable failure set covering enumerate/init/precheck throws, malformed-node validation failures, ID-grammar violations, non-`EmittedNode`/non-`null` return values, transform throws under strict, and factory-validator internal errors (R12); user-driven capability declaration with `init` > `spec.capabilities` > factory default precedence (R13); Stage-1 version pinning (R14); test-fixture conformance (R15). 21 positive fixtures and 11 negative fixtures enumerated under `fixtures/208/`. Implementation notes ship 6 short TS snippets covering the factory's own implementation (init / enumerate / transform / dispose wrappers with frozen ctx and validation), source-attribution stamping, placeholder for recoverable throws, capability-sampling probe, an end-to-end e-commerce catalog user adapter, and a `defineSimpleAdapter` convenience for the static-array case. Cites PRD-200 (in review) for framework; PRD-100 / PRD-102 / PRD-107 / PRD-108 / PRD-109 (Accepted) for envelopes / blocks / level / versioning / security. Status set to `In review`. |
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review; minor normative rename in lockstep with PRD-200. Decisions: (1) `defineSimpleAdapter` ships as a documented convenience, not a separate normative API; (2) no `validate` hook for v0.1 — users throw from `transform`; (3) `strict: true` elevates only `transform` errors (capability mismatch / ID drift remain informational); (4) no `delta` shorthand — pass-through to user-supplied implementation; (5) factory does NOT auto-populate `metadata.extracted_via: "programmatic"` (that key is reserved for the component-contract seam). Renamed framework-internal partial-node discriminator from `_partial` to `_actPartial` in lockstep with PRD-200's `_act` namespace reservation. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
