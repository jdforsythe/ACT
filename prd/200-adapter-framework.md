# PRD-200 — Adapter framework (contract, lifecycle, multi-source merging)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

The v0.1 working draft (`docs/plan/v0.1-draft.md` §5.10) sketches the adapter pipeline informally — `read()` → `transform()` → `emit()` is named, multi-source merging is shown by example, and adapter failure modes are punted to §10 Q5 — but every concrete contract a leaf adapter (PRD-201 markdown, PRD-202 Contentful, PRD-203 Sanity, PRD-204 Storyblok, PRD-205 Strapi, PRD-206 Builder.io, PRD-207 i18n, PRD-208 programmatic) needs to implement is missing. There is no TypeScript interface, no normative lifecycle order, no rule for what happens when two adapters claim the same node ID, no specification of which failures are recoverable vs unrecoverable, no statement of how adapters declare capabilities to the generator, and no specification of what test fixtures every adapter MUST pass to be considered conformant. Gaps **B1** (lifecycle), **B2** (multi-source merging), **B3** (ID composition), **A4** (failure modes), **E7** (ID-override precedence) all converge on this PRD; until it lands, every 20x adapter PRD will reinvent the same surface and the corporate marketing example (draft §6.5, ultimately PRD-702) cannot compose Contentful + i18n + components without a defined merge contract.

PRD-100 (Accepted) defines the wire-format envelopes adapters emit. PRD-102 (Accepted) defines the content-block taxonomy that flows through `node.content[]`. PRD-107 (Accepted) defines the conformance levels adapters' output is banded against. PRD-108 (Accepted) defines the version-pinning regime adapters must follow (decision Q5, staged). What's missing is the framework PRD that ties these into a single TypeScript contract every leaf adapter implements and every generator (PRD-400 series) consumes.

### Goals

1. Lock the **adapter contract** as a TypeScript interface (`Adapter`, plus supporting types) that every 20x leaf adapter implements. Reference language is TS-only per decision Q3.
2. Lock the **lifecycle**: `precheck` (optional) → `init` → `enumerate` → `transform` → `emit` → `dispose`, with concurrency rules and `ctx` shape pinned per gap B1.
3. Specify **multi-source merging** rules — order, collision detection by ID, partial-node deep-merge, scalar-conflict policy, provenance metadata — per gap B2.
4. Specify **failure modes** — recoverable (warn + `metadata.extraction_status: "partial" | "failed"`) vs unrecoverable (non-zero build exit) — per gap A4.
5. Specify the **configuration shape** generators pass to adapters at init time, separating framework-defined fields (logger, ID minter, output sink) from adapter-defined fields.
6. Pin the **output guarantee**: every node and every index entry an adapter emits MUST validate against PRD-100's schemas; PRD-100 is the contract.
7. Encode the **adapter version-pinning regime** from decision Q5 staged in PRD-108-R14: pinned in v0.1, MAJOR-pinned / MINOR-floating once PRD-200 explicitly cites PRD-108's ratified rules (which it does here).
8. Specify the **capability declaration** an adapter exposes to the generator — incremental rebuilds, summary-source policy, i18n awareness, component-contract emission — and how those bubble into the manifest's `capabilities` object via the generator.
9. Enumerate the **test fixture matrix** every leaf adapter MUST pass: positive fixtures cover each requirement; negative fixtures catch each common error mode.

### Non-goals

1. **Defining the wire-format envelopes.** Owned by PRD-100 (Accepted). Adapters emit nodes / index entries that satisfy PRD-100's schemas; this PRD does not redefine those shapes.
2. **Defining the content-block taxonomy.** Owned by PRD-102 (Accepted). Adapters produce `markdown`, `prose`, `code`, `data`, `callout`, and `marketing:*` blocks; PRD-200 references the taxonomy by citation.
3. **Defining individual adapter behavior.** PRD-201–PRD-208 each own their source-system specifics (markdown frontmatter parsing, Contentful query language, Sanity GROQ, etc.). This PRD specifies only the framework contract those PRDs inherit.
4. **Defining the generator pipeline.** Owned by PRD-400 (P2, Draft). PRD-200 specifies what adapters emit and how they are configured; PRD-400 specifies how generators orchestrate the run, write files, and surface errors to the user.
5. **Defining the runtime SDK.** Owned by PRD-500 (P2, Draft). Adapters are build-time producers; runtime servers do not invoke adapters at request time.
6. **Defining component-contract extraction.** Owned by PRD-300 (P2, Draft). PRD-200 only specifies the seam (a block carries `metadata.extracted_via: "component-contract"`) per gap B4; PRD-300 owns the extraction algorithm.
7. **Authoring the project-wide threat model.** Owned by PRD-109 (Accepted). PRD-200's Security section cites PRD-109 and only documents adapter-specific posture deltas.
8. **Defining the JSON Schemas of new envelope shapes.** Adapters emit existing PRD-100 envelopes; no new wire-format schemas are introduced. The TypeScript interface in §Wire format / interface definition is the schema for this PRD.
9. **Specifying a non-TypeScript adapter contract.** Per decision Q3, v0.1 reference adapters are TypeScript-only. A future Python / Go / Ruby contract would be a sibling PRD; the design here is intentionally portable but the normative interface is TS.

### Stakeholders / audience

- **Authors of:** PRD-201 (markdown), PRD-202 (Contentful), PRD-203 (Sanity), PRD-204 (Storyblok), PRD-205 (Strapi), PRD-206 (Builder.io), PRD-207 (i18n), PRD-208 (programmatic). Every leaf adapter PRD declares "implements PRD-200" and inherits this PRD's contract.
- **Consumers of:** PRD-400 (generator architecture), PRD-401 (Astro), PRD-404 (Docusaurus), PRD-405 (Next.js), PRD-406 (Remix), PRD-407 (Nuxt), PRD-408 (Eleventy), PRD-409 (standalone CLI). Generators orchestrate adapter runs.
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The TS interface ossifies before P2 implementation surfaces real ergonomic issues. | Medium | Medium | Mark the interface as v0.1; PRD-200's own Versioning table classifies adding optional methods as MINOR (PRD-108-R4(1)) so amendments during P2 implementation land cleanly. |
| Multi-source merge rules are too strict and block legitimate compositions (e.g., i18n + CMS contributing overlapping `metadata.translations` arrays). | Medium | Medium | Partial-node deep-merge with array concatenation (PRD-200-R12) is permissive by default; opt-in `merge: "error"` is the strict mode. Negative fixtures cover the strict-mode error cases without forcing them on the default. |
| Failure-mode taxonomy too coarse — adapters report "partial" for both "one block extraction failed" and "the source CMS API returned 5xx for one item." | Medium | Low | The `extraction_status` enum is closed at three values (`"complete" \| "partial" \| "failed"`) per PRD-200-R17, but `metadata.extraction_error` is open and producer-defined for diagnostic detail. PRD-600 surfaces both. |
| Capability declarations drift from manifest's structured `capabilities` object (PRD-100-R6). | Medium | Medium | PRD-200-R23 pins the bubble-up: a generator MUST translate adapter capabilities into the manifest's `capabilities.*` shape verbatim. PRD-400 will own the orchestration; PRD-200 owns the per-adapter declaration. |
| Adapter pinning regime (Q5 stage 2) trips on a spec MINOR bump that an adapter's MAJOR doesn't actually support. | Low | High | PRD-200-R26 requires every adapter to declare its supported `act_version` MINOR set explicitly per PRD-108-R15. Generators MUST refuse to run an adapter whose declared range does not cover the spec MINOR they target. |
| ID-collision detection misses cross-adapter overlaps because two adapters use different ID strategies and one happens to produce IDs that match the other's namespace. | Medium | Medium | PRD-200-R10 requires per-adapter namespace by default (`{adapter_namespace}/{adapter_id}`) per gap B3. Opt-out (`namespace: false`) is permitted but the merge step (PRD-200-R12) MUST detect collisions regardless. |
| Test fixtures specified at PRD-200 don't cover an emergent failure mode discovered during PRD-201/202 implementation. | Medium | Low | The fixture corpus is a floor, not a ceiling. PRD-200's Versioning table classifies adding a fixture row as MINOR; adding new conformance probes is non-breaking. |

### Open questions

1. ~~Should the lifecycle expose a `finalize()` hook between `transform` (per item) and `dispose` (build end) for adapters that need a whole-corpus pass (e.g., resolving cross-references that span items)?~~ **Resolved (2026-05-01): No.** Whole-corpus passes belong in `dispose` (or in `init`-allocated state flushed at end-of-run) for v0.1. Adding a new lifecycle hook materially expands the public interface; defer to v0.2 if PRD-202/PRD-203 implementation surfaces concrete friction. (Closes Open Question 1.)
2. ~~Should `transform` be permitted to return an array of nodes (one item → many nodes) instead of just `Node | null`?~~ **Resolved (2026-05-01): No.** v0.1 keeps the 1:1 contract. Fan-out is the adapter's responsibility via `enumerate` (multiple yields) or via `ctx.emit` for mid-`transform` fan-out. Reconsider in v0.2 if a clean use case emerges. (Closes Open Question 2.)
3. ~~Should the adapter declare a `summary_source` policy (`"author" | "extracted" | "needs-llm"`) at registration time, or attach it per-emitted-node?~~ **Resolved (2026-05-01): Per-node, with a capability-level declaration of the highest provenance the adapter can supply.** Different items inside the same source can have different summary provenance (a markdown file with frontmatter `summary:` is `"author"`; one without is `"extracted"`). `AdapterCapabilities.summarySource` declares the highest policy the adapter supports; the actual emission is per-node. (Closes Open Question 3.)
4. ~~Should the merge step be permitted to invoke a user-defined resolver function for scalar conflicts, or is the binary `merge: "last-wins" | "error"` sufficient for v0.1?~~ **Resolved (2026-05-01): Binary only.** A resolver function adds public API surface and a sandbox question; defer to v0.2 if real compositions force the question. The `precedence: "fallback"` mechanism on `AdapterCapabilities` already covers the common asymmetric case (PRD-207 i18n). (Closes Open Question 4.)

### Acceptance criteria

- [ ] Every normative requirement has an ID `PRD-200-R{n}` and a declared conformance level per PRD-107.
- [ ] The Specification section opens with a table mapping every requirement to the 100-series requirement(s) it implements, per the workflow.md Phase 3 addition.
- [ ] The TypeScript interface is reproduced inline in §"Wire format / interface definition" with full type signatures for `Adapter`, `AdapterContext`, `AdapterCapabilities`, `EmittedNode`, `MergeOutcome`, and the lifecycle method signatures.
- [ ] Multi-source merging rules are pinned with a worked example and a fixture pair.
- [ ] Failure modes are pinned with the closed `extraction_status` enum and the recoverable / unrecoverable distinction tied to exit-code behavior.
- [ ] Adapter pinning (PRD-108-R14 / R15) is encoded for both Stage 1 and Stage 2, with the migration trigger documented.
- [ ] Implementation notes ship 3–10 short TypeScript snippets covering: the `Adapter` interface, the `init` hook, a `transform` returning a Standard-tier node, a partial node from a secondary adapter, the merge function's pseudocode, and the failure-warning emission shape.
- [ ] Test fixture path layout under `fixtures/200/positive/` and `fixtures/200/negative/` is enumerated; one fixture per major requirement.
- [ ] Versioning & compatibility section classifies every kind of change to PRD-200 per PRD-108.
- [ ] Security section cites PRD-109 for the project-wide posture and documents adapter-specific deltas (build-time credential handling, network-fetch fan-out).
- [ ] Changelog entry dated 2026-05-01 by Jeremy Forsythe is present.

---

## Context & dependencies

### Depends on

- **PRD-100** (Accepted) — wire format envelopes. Every node and every index entry an adapter emits MUST validate against `schemas/100/node.schema.json` and `schemas/100/index.schema.json`.
- **PRD-102** (Accepted) — content-block taxonomy. Adapters produce blocks of types `markdown`, `prose`, `code`, `data`, `callout`, and (Plus-tier) `marketing:*`.
- **PRD-107** (Accepted) — conformance levels. Adapters declare the highest level their output supports; generators may fan out across adapters of mixed levels.
- **PRD-108** (Accepted) — versioning policy; in particular PRD-108-R14 (staged adapter pinning) and PRD-108-R15 (MINOR support declaration when MAJOR-pinned / MINOR-floating).
- **PRD-109** (Accepted) — security posture. PRD-200's Security section cites PRD-109 for the project-wide threat model.
- **000-governance** (Accepted) — lifecycle of this PRD itself.
- **000-decisions-needed Q3** — TS-only first-party reference impl for v0.1.
- **000-decisions-needed Q5** — staged adapter pinning regime.
- External: [TypeScript 5.x](https://www.typescriptlang.org/) (interface syntax used inline), [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174).

### Blocks

- **PRD-201** (markdown adapter) — implements PRD-200 against filesystem-backed markdown sources.
- **PRD-202** (Contentful adapter) — implements PRD-200 against Contentful's Delivery API.
- **PRD-203** (Sanity adapter) — implements PRD-200 against Sanity's GROQ.
- **PRD-204** (Storyblok adapter) — implements PRD-200 against Storyblok's Stories API.
- **PRD-205** (Strapi adapter) — implements PRD-200 against Strapi's REST/GraphQL.
- **PRD-206** (Builder.io adapter) — implements PRD-200 against Builder's Content API.
- **PRD-207** (i18n adapter) — implements PRD-200 as a *partial* producer that contributes locale-specific fields and `metadata.translations` arrays via the merge step.
- **PRD-208** (programmatic adapter) — implements PRD-200 as a user-driven escape hatch for sources without a dedicated leaf adapter.
- **PRD-400** (generator architecture) — orchestrates adapter runs via this contract; consumes the capability declaration to populate the manifest's `capabilities.*` object.

### References

- v0.1 draft: §5.10.1 (`read()` / `transform()` / `emit()` informal sketch), §5.10.3 (multi-source merging informal example), §6.4 (ID strategies — `derived`, `cms_id`, `route_with_params`, `composite`), §6.5 (corporate marketing worked example: Next.js + Contentful + i18n + components), §10 Q5 (extraction failures — the source for gap A4's adapter section).
- `prd/000-gaps-and-resolutions.md` gaps **B1** (lifecycle, owned here), **B2** (multi-source merging, owned here), **B3** (ID-strategy composition, owned here), **A4** (adapter failure modes section, owned here), **B4** (component-contract seam, references PRD-300), **E7** (ID-override precedence, cited from PRD-100-R14).
- `prd/000-decisions-needed.md` Q3 (TS-only ref impl), Q5 (adapter pinning, staged).
- Prior art: [Gatsby source plugins](https://www.gatsbyjs.com/docs/creating-a-source-plugin/) (lifecycle: sourceNodes / createPages); [Astro content collections](https://docs.astro.build/en/guides/content-collections/) (schema-validated source loaders); [Eleventy data cascade](https://www.11ty.dev/docs/data-cascade/) (multi-source merge by precedence); [Contentlayer](https://contentlayer.dev/) (schema-validated transform); [Sourcebit](https://github.com/stackbit/sourcebit) (multi-source merge with explicit precedence). None directly adopted; cited for shape.

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords as clarified by RFC 8174.

### 100-series requirements implemented

The table below maps every PRD-200 requirement to the 100-series requirement(s) it implements or relies on. This table satisfies the workflow.md Phase 3 rule that every P2 PRD declare the 100-series surface it implements. Where a row says "consumes," the PRD-200 requirement does not redefine the shape — it requires conformance to the cited PRD-100 / PRD-102 / PRD-107 / PRD-108 requirement and adds adapter-specific obligations on top.

| PRD-200 requirement | 100-series requirement(s) implemented or consumed | Relationship |
|---|---|---|
| R1 (interface compliance) | PRD-100-R3, R16, R21 | Adapter output MUST validate against manifest / index / node schemas. |
| R2 (lifecycle order) | — | Framework-internal; no 100-series counterpart. |
| R3 (`init`) | PRD-100-R4, PRD-107-R1, PRD-107-R3 | Resolves config that becomes manifest fields. |
| R4 (`enumerate`) | — | Framework-internal. |
| R5 (`transform`) | PRD-100-R21, PRD-100-R28, PRD-102-R-{markdown,prose,code,data,callout} | Produces a node satisfying PRD-100-R21 with content blocks satisfying PRD-102. |
| R6 (concurrency) | — | Framework-internal. |
| R7 (`dispose`) | — | Framework-internal. |
| R8 (`precheck`) | — | Framework-internal. |
| R9 (incremental rebuilds) | PRD-100-R8 (`generated_at`) | Optional capability surfaced to generator. |
| R10 (ID namespacing) | PRD-100-R10, PRD-100-R14 | Adapter-default IDs MUST satisfy the grammar; per-adapter namespace by default per gap B3. |
| R11 (ID-override precedence) | PRD-100-R14 | Adapter MUST honor explicit-override > config-rule > default. |
| R12 (multi-source merge order, last-writer-wins, partial-node deep-merge) | PRD-100-R10 (collision detection by ID) | Adapter-emitted partials are merged by the framework. |
| R13 (`metadata.source` provenance) | PRD-100-R22 (`metadata` open object) | Adapters MUST stamp provenance on every emitted node. |
| R14 (`merge: "error"` strict mode) | PRD-100-R10 | Opt-in collision = build error. |
| R15 (scalar conflict policy) | — | Framework-internal merge contract. |
| R16 (recoverable failure mode) | PRD-100-R22, PRD-102-R-{extraction-status} | Adapter MUST emit a node with `metadata.extraction_status` on partial failure. |
| R17 (`extraction_status` closed enum) | PRD-102 § extracted-block metadata | Closed three-value enum: `"complete" \| "partial" \| "failed"`. |
| R18 (unrecoverable failure mode) | — | Framework contract: adapter MUST exit non-zero; MUST NOT silently drop nodes. |
| R19 (config shape — framework fields) | PRD-100-R4 | Generator-supplied `ctx` provides logger, output sink, ID minter, resolved config. |
| R20 (config shape — adapter fields) | — | Adapter declares its own config schema. |
| R21 (output guarantee) | PRD-100-R21, PRD-100-R17 | Every emitted node / index entry MUST validate against PRD-100 schemas. |
| R22 (capability declaration) | PRD-100-R6 | Adapter declares an `AdapterCapabilities` object; generator translates into manifest's `capabilities.*`. |
| R23 (capability bubble-up to manifest) | PRD-100-R6 | Generator MUST faithfully translate adapter capabilities; MUST NOT inflate. |
| R24 (level-aware emission) | PRD-107-R6, R8, R10 | Adapter declares the highest level it supports; emitted nodes satisfy that level's requirements. |
| R25 (Stage 1 pinning) | PRD-108-R14 | v0.1: adapter MAJOR.MINOR pinned to spec MAJOR.MINOR. |
| R26 (Stage 2 pinning) | PRD-108-R14, R15 | Post-ratification: adapter MUST declare supported MINOR set. |
| R27 (component-contract seam) | PRD-100-R28 (block discriminator), PRD-102 § component metadata | Adapter MAY emit blocks carrying `metadata.extracted_via: "component-contract"`. |
| R28 (test-fixture conformance) | — | Every leaf adapter MUST pass the framework fixture corpus. |

### Conformance level

Every requirement in PRD-200 belongs to one of the conformance bands defined by PRD-107. Because PRD-200 is a framework PRD (not a wire-format band), the level annotation indicates *which band of producer output the requirement primarily affects*; an adapter targeting Plus must satisfy every Core, Standard, and Plus-banded requirement.

- **Core:** PRD-200-R1, R2, R3, R4, R5, R6, R7, R10, R11, R13, R16, R17, R18, R19, R20, R21, R22, R23, R24, R25, R28.
- **Standard:** PRD-200-R8 (`precheck`), R9 (incremental rebuilds), R12 (multi-source merge — additive over Core because Core may be a single-source build), R14, R15.
- **Plus:** PRD-200-R26 (Stage 2 pinning is Plus-only because no MAJOR ratification has occurred at v0.1), R27 (component-contract seam — only Plus producers emit `marketing:*` and component-extracted blocks).

### Normative requirements

#### The adapter contract

**PRD-200-R1.** A source adapter MUST implement the TypeScript interface `Adapter` defined in §"Wire format / interface definition." Concretely: an adapter package's default export MUST satisfy `Adapter`, and a generator MUST be able to invoke `init`, `enumerate`, `transform`, and `dispose` on it without runtime type errors. Adapter packages MAY ship additional helpers; the contract is the interface only.

**PRD-200-R2.** The lifecycle order is fixed: `precheck` (optional) → `init` → `enumerate` → `transform` (per item, possibly concurrent) → `dispose`. A generator MUST invoke the hooks in this order. An adapter MUST NOT assume any other ordering. `init` MUST complete before `enumerate` begins; `dispose` MUST run exactly once after the last `transform` resolves or rejects, even if `transform` throws.

**PRD-200-R3.** `init(config, ctx)` MUST validate `config` against the adapter's declared config schema and either resolve to an `AdapterCapabilities` object (PRD-200-R22) or reject. `init` MAY open connections, register ID strategies, and allocate state on `ctx`. An adapter that cannot connect or whose credentials are invalid MUST reject in `init` (not in `enumerate` or later). The `ctx` shape is pinned by PRD-200-R19.

**PRD-200-R4.** `enumerate()` MUST return an `AsyncIterable<SourceItem>` (or an array — both are tolerated for ergonomics; the generator normalizes via `for await ... of`). Each yielded `SourceItem` is opaque to the framework — its shape is the adapter's choice — and is passed back to `transform` unchanged. Adapters MUST NOT yield duplicate items unless deliberate (e.g., variant fan-out is the adapter's responsibility, but the framework treats each yield as one `transform` invocation).

**PRD-200-R5.** `transform(item, ctx)` MUST return either a fully-formed `EmittedNode` (one node satisfying PRD-100-R21 and the content-block taxonomy of PRD-102), a *partial* `EmittedNode` (a subset of fields the adapter is responsible for; partial-merge contract per PRD-200-R12), or `null` (skip this item; the framework records the skip but does not surface it as an error). `transform` MUST NOT call back into `enumerate` and MUST NOT mutate other adapters' emitted nodes.

**Returning vs `ctx.emit`.** Adapters have two emission paths. The ergonomic default is to **return** the node (or partial) from `transform`; the framework wires the return value into the merge pipeline. The imperative `ctx.emit(node)` path exists for adapters that need *mid-`transform` fan-out* — i.e., one source item legitimately produces multiple nodes (e.g., a single CMS entry that fans out into one canonical node plus N variant nodes). Adapters SHOULD prefer the return path; `ctx.emit` is reserved for the fan-out case. An adapter that uses both in a single `transform` invocation MUST NOT return a node that duplicates one it has already passed to `ctx.emit`; the framework treats every `ctx.emit` call as a distinct contribution and treats the return value as one additional contribution.

**PRD-200-R6.** The framework MAY invoke `transform` with bounded concurrency. Default concurrency is **8**. Adapters MUST tolerate concurrent invocations against distinct items. Adapters that cannot run concurrently (e.g., a source API with strict per-second rate limits) MUST declare `capabilities.concurrency_max: 1` in the value returned from `init`. The framework MUST NOT exceed the adapter's declared `concurrency_max`.

**PRD-200-R7.** `dispose(ctx)` MUST close all resources the adapter opened (HTTP clients, file handles, child processes, in-memory caches that other tooling assumes are released). `dispose` MUST run idempotently — invoking it twice MUST NOT throw.

**PRD-200-R8.** `precheck(config)` is OPTIONAL. When present, it MUST be a fast (≤1s budget recommended), side-effect-free validation that can answer "would `init` succeed under this config?" without opening connections that have setup cost. Generators MAY skip `precheck` when running in single-adapter mode; multi-adapter generators SHOULD invoke it on every adapter at build start to fail fast.

#### Incremental rebuilds (Standard, optional)

**PRD-200-R9.** An adapter MAY declare `capabilities.delta: true` in its `AdapterCapabilities`. When set, the adapter MUST implement `delta(since: string)` returning an `AsyncIterable<SourceItem>` of items changed since the supplied marker. The marker is opaque to the framework; the adapter defines its grammar (RFC 3339 timestamp, content hash, Sanity transaction ID, etc.). Generators that orchestrate incremental rebuilds MUST persist the marker between runs and pass the previous marker on the next invocation. Adapters that do not implement `delta` MUST NOT declare `capabilities.delta`.

#### IDs and namespacing

**PRD-200-R10.** Adapter-emitted IDs MUST satisfy the grammar pinned by PRD-100-R10. By default, every adapter namespaces its IDs under its declared namespace: the runtime ID is `{adapter_namespace}/{adapter_id}` where `adapter_namespace` is a stable identifier the adapter declares in `init` (matching the ID grammar's path-segment subset, lowercase ASCII). An adapter MAY opt out of namespacing by declaring `capabilities.namespace_ids: false` in `init`; the generator MUST surface a build warning when two non-namespaced adapters are configured in the same run, and the merge step (PRD-200-R12) MUST detect collisions either way.

**PRD-200-R11.** Adapters MUST honor the ID-override precedence pinned by PRD-100-R14: an explicit per-source override (e.g., markdown frontmatter `id:`, CMS field `actId:`, programmatic adapter explicit ID) MUST win over an adapter-config glob/rule, which MUST win over the adapter's default strategy. Adapters MUST emit the resolved ID; the framework does not rewrite IDs after `transform` returns.

#### Multi-source merging (Standard)

**PRD-200-R12.** When two or more adapters contribute nodes whose final IDs collide (post-namespacing per PRD-200-R10), the framework MUST merge them per the following rules:

1. **Order is configuration order.** The generator's adapter list (per PRD-400) defines precedence: earlier adapters lose to later adapters on scalar conflict; later is the "last writer."
2. **Collision detection is by ID.** Two emitted nodes with the same final `id` are colliding regardless of their `path`, `content`, or `etag`.
3. **Partial nodes deep-merge.** When a node is emitted as a *partial* (not all PRD-100-R21 required fields are present) the merge step deep-merges objects (`metadata`, `tokens`, nested objects) and concatenates arrays (`content`, `related`, `children`) in declared adapter order. Scalars are subject to PRD-200-R15.
4. **Identity-keyed array dedupe (`metadata.translations`).** After array concatenation per rule 3, the merge step MUST dedupe `metadata.translations` entries by the `(locale, id)` tuple. When two contributors supply entries with the same `(locale, id)`, the entry from the later contributor (per rule 1's configuration order) wins; earlier-contributor entries with the same key are discarded. The dedupe applies after concatenation and before the `Result MUST satisfy PRD-100-R21` check (rule 5). This rule applies only to `metadata.translations`; other arrays (`content`, `related`, `children`, and any producer-defined `metadata.*` arrays) follow rule 3's plain concatenation. Rationale: PRD-104-R8 / PRD-104-R9 give every translation entry a stable `(locale, id)` identity; concatenating overlapping arrays from a CMS adapter (PRD-202-R14) and an i18n adapter (PRD-207-R5) without dedupe produces duplicate identities on the merged node and breaks consumers walking `translations`. Per-entry conflicts (e.g., differing optional fields under the same `(locale, id)`) collapse to a single entry whose fields follow rule 1's last-wins precedence (or rule 2 of PRD-200-R15 when `precedence: "fallback"` is in effect on the contributing adapter).
5. **Result MUST satisfy PRD-100-R21.** After merge, the resulting node MUST be a fully-formed Node envelope. If any required field is still missing after all contributors have run, the framework MUST raise a build error citing the missing field and the contributing adapters.

**PRD-200-R13.** Every emitted node MUST carry `metadata.source` populated by the framework with the adapter's identity and the source item's identity:

```ts
metadata.source = {
  adapter: "act-markdown",         // adapter's package name or declared id
  source_id: "docs/getting-started.md",  // adapter-defined; opaque to framework
  contributors?: [                  // present after merge if >1 adapter contributed
    { adapter: "act-markdown", source_id: "..." },
    { adapter: "act-i18n",     source_id: "..." }
  ]
};
```

The `contributors` array is omitted when only one adapter contributed and is populated by the merge step otherwise. PRD-100-R22 admits `metadata` as an open object; this PRD reserves the single sub-key `metadata.source` for the framework's exclusive use (and within it, `metadata.source.contributors` is populated only by the framework's merge step — adapters MUST NOT set `metadata.source.contributors` directly). Reserving `metadata.source` does not narrow PRD-100-R22's openness: every other key under `metadata.*` remains producer-defined and open.

**PRD-200-R14.** A generator's adapter configuration MAY set `merge: "error"` on a per-adapter basis (the second adapter's emission is the trigger; the first adapter's emission is the baseline). When set, any ID collision involving that adapter MUST cause the build to fail with a non-zero exit and an error citing the colliding ID and the contributing adapters. The default is `merge: "last-wins"` per PRD-200-R12.

**PRD-200-R15.** When two adapters supply scalar values for the same field on the same node (e.g., both adapters set `title`):

1. If the second adapter declares `precedence: "fallback"` in its capability declaration, the first adapter's value wins (i.e., the second adapter's value is used only when the first's is absent or `null`).
2. Otherwise, last-writer-wins per PRD-200-R12 ordering.
3. If `merge: "error"` is in effect on either adapter, the conflict raises a build error per PRD-200-R14.

The `precedence: "fallback"` mechanism is the primary use case for adapters like the i18n adapter (PRD-207), which fills gaps in a CMS adapter's emission rather than overriding it.

#### Failure modes (gap A4)

**PRD-200-R16.** Recoverable failures during `transform` MUST be signaled by emitting a node whose `metadata.extraction_status` is `"partial"` (some content was extracted, but not all) or `"failed"` (no usable content was extracted, but the node identity was preserved as a placeholder). The framework MUST surface the partial / failed emission as a build warning (non-zero warnings count, but exit code zero unless the generator's policy elevates warnings). Adapters MUST NOT silently drop nodes; an item that cannot be transformed MUST either return a partial / failed node OR return `null` (deliberate skip), never throw "I'll just not emit this one."

**PRD-200-R17.** The `metadata.extraction_status` field is a closed three-value enum: `"complete"` (the default; MAY be omitted to mean complete), `"partial"`, `"failed"`. Adding a value to this enum is MAJOR per PRD-108-R5(4). Adapters MAY additionally set `metadata.extraction_error` to a string describing the underlying cause; this companion field is producer-defined and open per PRD-100-R22.

**PRD-200-R18.** Unrecoverable failures (credentials invalid, source API completely unreachable after retries, malformed config that escaped `init` validation) MUST cause the adapter to throw from `init`, `enumerate`, or `transform`. The framework MUST surface the throw as a build error with a non-zero exit code. Adapters MUST NOT swallow unrecoverable errors and emit empty output; an empty corpus is a valid output, but only when the source genuinely had nothing to emit.

#### Configuration shape

**PRD-200-R19.** The `ctx: AdapterContext` argument supplied to `init`, `transform`, and `dispose` MUST contain at minimum these framework-defined fields:

```ts
interface AdapterContext {
  logger: {
    debug(msg: string, meta?: Record<string, unknown>): void;
    info(msg: string, meta?: Record<string, unknown>): void;
    warn(msg: string, meta?: Record<string, unknown>): void;
    error(msg: string, meta?: Record<string, unknown>): void;
  };
  emit: (node: EmittedNode) => Promise<void>;   // imperative emission path; alt to returning from transform
  idMinter: {
    mint: (parts: string[], opts?: { namespaced?: boolean }) => string;
    validate: (id: string) => boolean;
  };
  config: {
    actVersion: string;             // e.g. "0.1"; from generator
    targetLevel: "core" | "standard" | "plus";
    locales?: { default: string; available: string[] };
    [adapterDefined: string]: unknown;
  };
  signal: AbortSignal;              // build-cancellation
}
```

Generators MUST supply all framework-defined fields. Adapters MUST NOT mutate the `logger`, `emit`, or `idMinter` fields; they MAY read `config` and listen on `signal`.

**PRD-200-R20.** Adapter-defined config (under `ctx.config`) is namespaced under the adapter's package name in the generator's configuration file. Adapters MUST publish a JSON Schema for their config (commonly under the package's `schema/` directory) so generators and tooling can validate user-supplied config before invoking `init`. The framework does not validate adapter-defined config — that is the adapter's `init` responsibility per PRD-200-R3.

#### Output guarantee

**PRD-200-R21.** Every fully-formed node an adapter emits MUST validate against `schemas/100/node.schema.json`. Every index entry an adapter contributes (via the framework's index-aggregation step, owned by PRD-400) MUST validate against `schemas/100/index.schema.json#/$defs/IndexEntry`. PRD-600 (validator) probes adapter output against these schemas as part of the framework conformance suite (PRD-200-R28).

#### Capability declaration

**PRD-200-R22.** The value returned from `init` MUST be an `AdapterCapabilities` object with at minimum the following fields:

```ts
interface AdapterCapabilities {
  // The highest conformance level (PRD-107) this adapter's output satisfies.
  level: "core" | "standard" | "plus";
  // Concurrency limit for transform invocations. Default 8 when omitted.
  concurrency_max?: number;
  // Optional incremental-rebuild support (PRD-200-R9).
  delta?: boolean;
  // Whether this adapter namespaces its IDs (PRD-200-R10). Default true.
  namespace_ids?: boolean;
  // Per-adapter precedence in scalar conflicts (PRD-200-R15).
  precedence?: "primary" | "fallback";
  // Capabilities the adapter contributes to the manifest's `capabilities.*` object.
  manifestCapabilities?: {
    etag?: boolean;
    subtree?: boolean;
    ndjson_index?: boolean;
    search?: { template_advertised: boolean };
  };
  // i18n-awareness: does this adapter emit `metadata.locale` and per-locale variants?
  i18n?: boolean;
  // Component-contract emission (PRD-200-R27, PRD-300 seam).
  componentContract?: boolean;
  // Summary-source policy: highest provenance the adapter can provide.
  summarySource?: "author" | "extracted" | "needs-llm";
}
```

Adapters MUST NOT lie — declared capabilities MUST match the actual emission. PRD-600 probes a representative sample of emitted nodes to verify the declaration.

The `precedence` field is the canonical asymmetric-merge knob used by secondary contributors (notably PRD-207 i18n) to declare "fill gaps but never override." When omitted, scalar conflicts resolve last-writer-wins per PRD-200-R12 / R15. Setting `precedence: "fallback"` is the way an adapter author declares "I am secondary; never overwrite a scalar another adapter has already supplied." Setting `precedence: "primary"` is the explicit form of the default; it has no effect except as documentation. Removing `precedence` is a downgrade-safe no-op for v0.1; future v0.2 expansion of this enum (e.g., `"override-only"`) is MAJOR per PRD-108-R5(4).

**PRD-200-R23.** A generator (PRD-400) MUST translate an adapter's `manifestCapabilities` into the manifest's `capabilities.*` object verbatim. When two adapters' `manifestCapabilities` overlap, the generator MUST take the OR (any adapter declaring a capability is sufficient to advertise it), but MUST verify the underlying endpoint actually responds before publishing — capability advertisement without backing endpoint is a manifest validation error per PRD-107-R14. The generator MUST NOT promote an adapter's declared `level` beyond what the adapter declares; per PRD-107-R14, the level field is the contract.

**PRD-200-R24.** When a generator's target level (per `ctx.config.targetLevel`) exceeds the adapter's declared `level`, the generator MUST refuse to run the adapter and surface a configuration error. When the adapter's declared `level` exceeds the target, the adapter MUST emit only fields and blocks at or below the target level (e.g., a Plus-capable adapter running against a Core target MUST NOT emit `marketing:*` blocks). This is enforced by the adapter, not the generator; the framework does not strip blocks post-emission.

#### Adapter version pinning (Q5 / PRD-108-R14)

**PRD-200-R25.** **Stage 1 (v0.1, current).** Every adapter package version MUST pin to a single spec `act_version` MAJOR.MINOR. The adapter package's `package.json` MUST declare the supported `act_version` as a peer-equivalent constraint (a `peerDependencies` or custom `actSpecVersion` field; PRD-400 owns the exact mechanism for generator-side enforcement). Concretely: `act-markdown@0.1.x` emits envelopes whose `act_version` is `"0.1"` and only `"0.1"`. A spec MINOR bump from `0.1` to `0.2` requires a coordinated adapter MINOR release (`act-markdown@0.2.x`).

**PRD-200-R26.** **Stage 2 (post-ratification).** Once PRD-200 explicitly cites PRD-108's ratified MAJOR/MINOR rules — which it does in this section, satisfying the second prong of PRD-108-R14 — adapters MAY transition to MAJOR-pinned / MINOR-floating per PRD-108-R14 / R15. An adapter operating in Stage 2 MUST declare its supported MINOR set in package metadata under a `actSpecMinors` (or equivalently named) field readable by generators. Example: `act-markdown@1.0.0` declaring `actSpecMinors: ["1.0", "1.1"]` works against spec `1.0` and `1.1` but not `2.0`. Stage 2 is permissive (MAY); individual adapters MAY remain MAJOR.MINOR-pinned for ecosystem-stability reasons. The migration trigger is per-package: an adapter author opts in by publishing a release that declares `actSpecMinors`. Generators MUST refuse to run an adapter whose declared `actSpecMinors` (or pinned `act_version`) does not include the spec MINOR being targeted.

#### Component-contract seam (Plus, PRD-300 interaction)

**PRD-200-R27.** An adapter MAY emit content blocks whose source is a component contract (PRD-300, in flight). When it does, every such block MUST carry `metadata.extracted_via: "component-contract"`. If the contract throws or returns malformed data during build, the adapter MUST emit a `marketing:placeholder` block with `metadata.extraction_status: "failed"` and a build warning, per gap B4. PRD-300 owns the `extract` function semantics; PRD-200 owns only the seam (the metadata key and the placeholder fallback).

#### Test fixture conformance

**PRD-200-R28.** Every leaf adapter (PRD-201–PRD-208) MUST pass the framework conformance fixture corpus enumerated in §"Test fixtures." Conformance is binary: any positive fixture an adapter fails to satisfy or any negative fixture an adapter accepts (when the framework expects rejection) is a conformance violation. PRD-600 (validator) ships the fixture-runner; the framework MAY ship the same runner as a standalone CLI for adapter authors' local CI.

### Wire format / interface definition

There is no JSON wire format introduced by PRD-200 — adapters emit existing PRD-100 envelopes. The contract is the TypeScript interface below.

#### `Adapter` (the core interface)

```ts
/**
 * Every ACT source adapter implements this interface. The package's default
 * export MUST satisfy `Adapter`. A generator (PRD-400) invokes the lifecycle
 * hooks in the order pinned by PRD-200-R2.
 */
export interface Adapter<TConfig = unknown, TItem = unknown> {
  /** Stable identifier for this adapter. Used as the default ID namespace. */
  readonly name: string;

  /**
   * Optional fast precheck. MUST NOT open connections that have setup cost.
   * PRD-200-R8.
   */
  precheck?(config: TConfig): Promise<void>;

  /**
   * Validate config, open connections, allocate state. MUST resolve to an
   * AdapterCapabilities object describing what this adapter supports for this
   * config. PRD-200-R3 / R22.
   */
  init(
    config: TConfig,
    ctx: AdapterContext,
  ): Promise<AdapterCapabilities>;

  /**
   * Yield candidate source items lazily. The framework normalizes arrays via
   * `for await ... of`. PRD-200-R4.
   */
  enumerate(ctx: AdapterContext): AsyncIterable<TItem> | TItem[];

  /**
   * Map one source item to one node (full or partial) or skip. The framework
   * deep-merges partials per PRD-200-R12. PRD-200-R5.
   */
  transform(item: TItem, ctx: AdapterContext): Promise<EmittedNode | null>;

  /**
   * Optional incremental-rebuild path. Only invoked when the adapter declared
   * `capabilities.delta = true` and the generator has a previous marker.
   * PRD-200-R9.
   */
  delta?(since: string, ctx: AdapterContext): AsyncIterable<TItem>;

  /**
   * Release resources. MUST be idempotent. PRD-200-R7.
   */
  dispose(ctx: AdapterContext): Promise<void>;
}
```

#### `EmittedNode` (output shape)

```ts
import type { Node } from "@act/wire-format";  // PRD-100 type definitions

/**
 * What an adapter's `transform` returns. Either a full Node envelope or a
 * partial. Partials are merged by the framework per PRD-200-R12.
 *
 * `_actPartial: true` is a framework-internal marker used to distinguish
 * partials from full nodes during merge; it is stripped before final emission
 * and never appears in the on-the-wire envelope. The `_act` prefix namespaces
 * the discriminator to reduce collision risk against author-defined fields.
 */
export type EmittedNode =
  | (Node & { _actPartial?: false })
  | (Partial<Node> & { id: string; _actPartial: true });
```

The `id` field is required even on partials — collision detection (PRD-200-R12) is by ID. Every other PRD-100-R21 required field MAY be absent on a partial; the merge step assembles the final node from all contributors. The `_actPartial` discriminator is a framework-internal marker (`_act` prefix is reserved for framework-supplied keys); it MUST be stripped by the merge step before final emission and MUST NOT appear in any wire-format envelope. Adapters MUST NOT define their own keys beginning with `_act`.

#### `AdapterCapabilities` (declaration shape)

Reproduced from PRD-200-R22 above for completeness:

```ts
export interface AdapterCapabilities {
  level: "core" | "standard" | "plus";
  concurrency_max?: number;
  delta?: boolean;
  namespace_ids?: boolean;
  precedence?: "primary" | "fallback";
  manifestCapabilities?: {
    etag?: boolean;
    subtree?: boolean;
    ndjson_index?: boolean;
    search?: { template_advertised: boolean };
  };
  i18n?: boolean;
  componentContract?: boolean;
  summarySource?: "author" | "extracted" | "needs-llm";
}
```

#### `AdapterContext` (framework-supplied)

Reproduced from PRD-200-R19 above. The `signal: AbortSignal` field is non-optional; adapters that perform long-running work SHOULD listen for `signal.aborted` and exit cleanly when a build is cancelled.

#### Lifecycle invocation pseudocode

The generator-side invocation is pinned by PRD-400 but the shape every adapter author should expect is:

```ts
async function runAdapter(adapter: Adapter, config: unknown, ctx: AdapterContext) {
  if (adapter.precheck) await adapter.precheck(config);
  const capabilities = await adapter.init(config, ctx);
  // ... generator records capabilities, validates against targetLevel ...
  try {
    const items = adapter.enumerate(ctx);
    const sem = new Semaphore(capabilities.concurrency_max ?? 8);
    for await (const item of items) {
      sem.acquire();
      adapter
        .transform(item, ctx)
        .then((node) => node && ctx.emit(node))
        .finally(() => sem.release());
    }
    await sem.drain();
  } finally {
    await adapter.dispose(ctx);
  }
}
```

The merge step (PRD-200-R12) runs in the generator after every adapter has emitted; it is not part of the per-adapter lifecycle. PRD-400 owns the merge orchestration.

### Errors

Adapters surface failures along two axes (per PRD-200-R16 / R18) — recoverable (warning, build continues) and unrecoverable (build fails with non-zero exit). The table below pins the contract.

| Condition | Adapter behavior | Framework behavior | Exit code |
|---|---|---|---|
| Item-level extraction partial-success (e.g., one block failed to render but others succeeded) | Emit node with `metadata.extraction_status: "partial"`, populate `metadata.extraction_error` | Surface as build warning, increment warning counter | 0 (warnings allowed) |
| Item-level extraction total failure (no usable content) | Emit placeholder node with `metadata.extraction_status: "failed"` | Surface as build warning | 0 (warnings allowed) |
| Item deliberately skipped (e.g., draft content excluded from build) | Return `null` from `transform` | Record skip in adapter telemetry; no warning | 0 |
| `init` config validation failure | Reject from `init` with structured error | Surface as build error citing config field | non-zero |
| `init` connection / credential failure | Reject from `init` | Surface as build error | non-zero |
| `enumerate` source unreachable | Throw from the AsyncIterable | Surface as build error | non-zero |
| `transform` throws unexpectedly | Throw propagates | Surface as build error citing item identity | non-zero |
| ID collision with `merge: "last-wins"` | n/a (merge step handles) | Merge per PRD-200-R12; no warning by default; debug log | 0 |
| ID collision with `merge: "error"` | n/a (merge step handles) | Surface as build error citing colliding ID and contributors | non-zero |
| Partial-merge result missing required PRD-100-R21 field | n/a (merge step handles) | Surface as build error citing missing field and contributors | non-zero |
| Adapter declared `level: "core"` but emitted a `marketing:*` block | n/a (post-emission probe) | PRD-600 surfaces as a level-mismatch warning per PRD-107-R14 | 0 (warning) — PRD-600 owns the probe |
| Adapter pinned to spec `0.1` invoked against spec `0.2` (Stage 1) | n/a (generator-side check) | Generator refuses to run adapter; build error per PRD-200-R25 | non-zero |
| Adapter declares `actSpecMinors: ["1.0"]` but generator targets `1.1` (Stage 2) | n/a (generator-side check) | Generator refuses to run adapter; build error per PRD-200-R26 | non-zero |

The wire-format shape of build errors and warnings — how the generator surfaces them to the user (CLI output, JSON report, log file) — is owned by PRD-400. PRD-200 specifies only the adapter-side obligations.

---

## Examples

Worked examples are non-normative but MUST be consistent with the Specification section. Each maps to one or more positive fixtures under `fixtures/200/positive/`.

### Example 1 — Minimal Core adapter (filesystem-backed)

A trivial adapter that reads a single hand-rolled fixture file and emits one Core node. Demonstrates the lifecycle order, the `AdapterCapabilities` return shape, and the simplest possible `transform`.

```ts
import type { Adapter, EmittedNode } from "@act/adapter-framework";

export const fixtureAdapter: Adapter<{ path: string }, { id: string; title: string; body: string }> = {
  name: "fixture-adapter",
  async init(config, ctx) {
    ctx.logger.info(`fixture-adapter reading ${config.path}`);
    return { level: "core", concurrency_max: 1 };
  },
  async *enumerate(ctx) {
    yield { id: "intro", title: "Introduction", body: "Hello, ACT." };
  },
  async transform(item, ctx): Promise<EmittedNode> {
    return {
      act_version: ctx.config.actVersion,
      id: item.id,
      type: "article",
      title: item.title,
      etag: "s256:placeholder",  // generator typically computes; adapter MAY supply
      summary: item.body.slice(0, 60),
      content: [{ type: "markdown", text: item.body }],
      tokens: { summary: 12 },
    };
  },
  async dispose() { /* no resources to release */ },
};
```

Maps to `fixtures/200/positive/lifecycle-minimal-core.json` (the fixture is the adapter's *output*, not the adapter's source — fixtures live at the wire layer).

### Example 2 — Multi-source merge: CMS + i18n partial

The CMS adapter emits a complete English-locale node; the i18n adapter emits a *partial* node carrying only the Spanish translation under `metadata.translations`. The framework merges them.

CMS adapter emission (full node):

```json
{
  "act_version": "0.1",
  "id": "cms/products/widget-pro",
  "type": "article",
  "title": "Widget Pro",
  "etag": "s256:cms123abc",
  "summary": "The flagship Widget Pro for power users.",
  "content": [{ "type": "prose", "format": "markdown", "text": "..." }],
  "tokens": { "summary": 11, "body": 420 },
  "metadata": { "locale": "en-US", "source": { "adapter": "act-contentful", "source_id": "entry-123" } }
}
```

i18n adapter emission (partial, declared `precedence: "fallback"`):

```json
{
  "id": "cms/products/widget-pro",
  "_actPartial": true,
  "metadata": {
    "translations": [
      { "locale": "es-ES", "id": "cms/products/widget-pro@es-es" }
    ]
  }
}
```

Merged result (what the framework writes):

```json
{
  "act_version": "0.1",
  "id": "cms/products/widget-pro",
  "type": "article",
  "title": "Widget Pro",
  "etag": "s256:cms123abc",
  "summary": "The flagship Widget Pro for power users.",
  "content": [{ "type": "prose", "format": "markdown", "text": "..." }],
  "tokens": { "summary": 11, "body": 420 },
  "metadata": {
    "locale": "en-US",
    "translations": [
      { "locale": "es-ES", "id": "cms/products/widget-pro@es-es" }
    ],
    "source": {
      "adapter": "act-contentful",
      "source_id": "entry-123",
      "contributors": [
        { "adapter": "act-contentful", "source_id": "entry-123" },
        { "adapter": "act-i18n", "source_id": "es-ES:widget-pro" }
      ]
    }
  }
}
```

Note: the `metadata.source.contributors` array is populated by the merge step; individual adapters do NOT set it. The CMS adapter's `metadata.source.adapter` field is preserved as the primary contributor (first in `contributors`); the i18n adapter is appended.

Maps to `fixtures/200/positive/merge-cms-plus-i18n.json`.

### Example 3 — Recoverable failure: partial extraction

The CMS adapter receives an item whose hero-image URL returns 404 during enrichment. The adapter emits a node marked `extraction_status: "partial"` with the rest of the content intact.

```json
{
  "act_version": "0.1",
  "id": "cms/landing/hero-broken",
  "type": "page",
  "title": "Welcome",
  "etag": "s256:partial1",
  "summary": "Landing page; hero image was unavailable at build.",
  "content": [
    { "type": "prose", "format": "markdown", "text": "## Welcome\n\nGet started here." }
  ],
  "tokens": { "summary": 12, "body": 8 },
  "metadata": {
    "extraction_status": "partial",
    "extraction_error": "hero_image_url returned 404 at https://cdn.example.com/hero.png",
    "source": { "adapter": "act-contentful", "source_id": "page-456" }
  }
}
```

The build emits a warning citing `cms/landing/hero-broken` and continues. Exit code zero.

Maps to `fixtures/200/positive/failure-partial-extraction.json`.

### Example 4 — Unrecoverable failure: invalid credentials

```ts
async init(config, ctx) {
  const client = new ContentfulClient(config.spaceId, config.accessToken);
  const ok = await client.verifyCredentials();
  if (!ok) {
    throw new AdapterError({
      code: "credentials_invalid",
      message: "Contentful access token rejected (HTTP 401 from /spaces).",
      remediation: "Set CONTENTFUL_ACCESS_TOKEN and re-run.",
    });
  }
  // ...
}
```

The throw propagates; the generator surfaces the error and exits non-zero. No nodes are emitted. The user-facing error message format is owned by PRD-400 (generator architecture); PRD-200 specifies only the adapter-side obligation to throw with a structured error (`code`, `message`, optional `remediation`).

Maps to `fixtures/200/negative/init-credentials-invalid.json` (a negative fixture is the *expected output of a build that should fail* — the runner asserts the build exited non-zero with the documented error code).

### Example 5 — ID-override precedence (PRD-200-R11)

Three sources, all targeting `intro/getting-started`:

```yaml
# Markdown frontmatter (highest precedence — explicit override)
id: intro/getting-started
title: Getting Started
```

```json
// Adapter config (middle precedence — rule-based)
{
  "act-markdown": {
    "idStrategy": { "rule": "path", "stripPrefix": "/docs/" }
  }
}
```

```text
/docs/intro/getting-started.md  ← default path-derived ID would be `docs/intro/getting-started`
```

The frontmatter override wins: the emitted ID is `intro/getting-started`, not `docs/intro/getting-started`. Per PRD-100-R14, this precedence is part of the wire contract.

Maps to `fixtures/200/positive/id-override-precedence.json`.

---

## Test fixtures

Fixtures live under `fixtures/200/`. Each leaf adapter (PRD-201–PRD-208) MUST produce output that matches every positive fixture and MUST surface the documented error / warning for every negative fixture. PRD-600 (validator) ships the fixture-runner.

Fixtures are wire-format outputs (JSON files validating against PRD-100 schemas). For negative fixtures, PRD-200 follows PRD-100's convention (PRD-100 § Test fixtures): the **primary** marker is an inline `_negative_reason` string at the top of the JSON identifying the requirement violated and the expected build outcome (e.g., `"violates PRD-200-R17: extraction_status enum closed; expected non-zero exit"`). A `.expected.json` sidecar describing the build outcome in structured form (warnings, errors, exit code, error.code) is **permitted as a secondary** form for negative fixtures whose outcome is build-shaped rather than envelope-shaped (e.g., dispose-throws, init-credentials-invalid); when both inline `_negative_reason` and a sidecar are present the sidecar adds detail and MUST NOT contradict the inline reason. The fixture-runner invokes the adapter, captures emitted nodes / warnings / errors, and compares to the fixture (and sidecar when present). PRD-600 (validator) consumes both forms.

### Positive

- `fixtures/200/positive/lifecycle-minimal-core.json` → satisfies R1, R2, R3, R4, R5, R7, R21. The smallest possible adapter run: one item, one node, Core level.
- `fixtures/200/positive/lifecycle-with-precheck.json` → satisfies R8. Adapter declares and implements `precheck`; framework invokes it before `init`.
- `fixtures/200/positive/concurrency-bounded.json` → satisfies R6. 32 items, `concurrency_max: 4`; runner asserts ≤4 concurrent `transform` invocations.
- `fixtures/200/positive/delta-incremental.json` → satisfies R9. Two-run sequence: first run full enumerate, second run via `delta(since)` returns only changed items.
- `fixtures/200/positive/id-namespacing-default.json` → satisfies R10. Adapter declares `name: "act-markdown"`; emitted IDs are `act-markdown/...` by default.
- `fixtures/200/positive/id-namespacing-opt-out.json` → satisfies R10 (opt-out path). Adapter declares `namespace_ids: false`; runner asserts no namespace prefix.
- `fixtures/200/positive/id-override-precedence.json` → satisfies R11. Three sources (frontmatter override, config rule, default); emitted ID matches the frontmatter override.
- `fixtures/200/positive/merge-cms-plus-i18n.json` → satisfies R12, R13, R15 (with `precedence: "fallback"`). Two adapters; partial merge; provenance metadata stamped.
- `fixtures/200/positive/merge-cms-plus-cms-last-wins.json` → satisfies R12 (last-writer-wins for scalar conflicts).
- `fixtures/200/positive/merge-content-array-concat.json` → satisfies R12 (3rd bullet — array concatenation in declared adapter order).
- `fixtures/200/positive/merge-translations-dedupe.json` → satisfies R12 (4th bullet — `metadata.translations` deduped by `(locale, id)` after concat; later-wins precedence on the duplicate). Cites amendment A1 (closed 2026-05-02).
- `fixtures/200/positive/failure-partial-extraction.json` → satisfies R16, R17. Node emitted with `extraction_status: "partial"`; build exits 0 with a warning.
- `fixtures/200/positive/failure-failed-placeholder.json` → satisfies R16, R17, R27 (placeholder uses `marketing:placeholder` block when content was component-extracted).
- `fixtures/200/positive/skip-via-null-return.json` → satisfies R5 (deliberate skip path; no warning).
- `fixtures/200/positive/capability-declaration-full-plus.json` → satisfies R22, R23. Adapter declares Plus-tier capabilities; generator advertises `capabilities.subtree`, `capabilities.search` etc. in the manifest.
- `fixtures/200/positive/level-aware-emission-core-target.json` → satisfies R24. Plus-capable adapter running against Core target; emits no `marketing:*` blocks.
- `fixtures/200/positive/version-pinning-stage-1.json` → satisfies R25. Adapter declares `act_version: "0.1"` only; generator targeting `0.1` accepts.
- `fixtures/200/positive/version-pinning-stage-2.json` → satisfies R26. Adapter declares `actSpecMinors: ["1.0", "1.1"]`; generator targeting `1.1` accepts.
- `fixtures/200/positive/component-contract-block.json` → satisfies R27. Block carries `metadata.extracted_via: "component-contract"`; the rest of the node is well-formed.
- `fixtures/200/positive/provenance-single-adapter.json` → satisfies R13 (single-contributor case; `metadata.source.contributors` omitted).

### Negative

- `fixtures/200/negative/lifecycle-out-of-order.expected.json` → adapter expected `transform` to be called before `init`; framework invokes in correct order. Runner asserts adapter throws (correct behavior), build exits non-zero with a documented error code.
- `fixtures/200/negative/init-credentials-invalid.expected.json` → adapter rejects from `init`; build exits non-zero. Sidecar declares expected error.code.
- `fixtures/200/negative/transform-emits-malformed-node.expected.json` → adapter emits a node missing `tokens.summary`; framework's PRD-100-R21 validation catches it. Build exits non-zero.
- `fixtures/200/negative/transform-emits-id-uppercase.expected.json` → adapter emits `id: "Intro"`; PRD-100-R10 rejects. Build exits non-zero.
- `fixtures/200/negative/transform-silently-drops-node.expected.json` → adapter swallows an exception during transform and emits nothing; runner detects the missing node and asserts a build error per PRD-200-R16 / R18 (silent drops are forbidden).
- `fixtures/200/negative/merge-collision-error-mode.expected.json` → two adapters with `merge: "error"`; runner asserts build exits non-zero with a documented error code citing the colliding ID.
- `fixtures/200/negative/merge-result-missing-required-field.expected.json` → two partials, neither contributes `summary`; merge fails; build exits non-zero.
- `fixtures/200/negative/capability-overdeclares.expected.json` → adapter declares `manifestCapabilities.subtree: true` but does not actually contribute subtree-eligible nodes; PRD-600 prober flags the discrepancy.
- `fixtures/200/negative/capability-level-mismatch-against-target.expected.json` → generator targets Plus; adapter declares `level: "core"`; generator MUST refuse to run; build exits non-zero (or runs with this adapter excluded if generator policy permits).
- `fixtures/200/negative/version-pinning-stage-1-mismatch.expected.json` → adapter pinned to `0.1`; generator targets `0.2`; build exits non-zero per PRD-200-R25.
- `fixtures/200/negative/version-pinning-stage-2-out-of-range.expected.json` → adapter declares `actSpecMinors: ["1.0"]`; generator targets `1.1`; build exits non-zero per PRD-200-R26.
- `fixtures/200/negative/extraction-status-invalid-value.expected.json` → adapter emits `metadata.extraction_status: "degraded"` (not in the closed enum); framework rejects per PRD-200-R17. Build exits non-zero.
- `fixtures/200/negative/dispose-throws.expected.json` → adapter's `dispose` throws; framework still completes the build for already-emitted nodes but surfaces the dispose error as a non-zero exit.

---

## Versioning & compatibility

Per PRD-108, classify each kind of change to PRD-200 as MAJOR or MINOR.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add an optional method to the `Adapter` interface | MINOR | PRD-108-R4(1). Existing adapters do not implement it; the framework checks `adapter.method != null` before invoking. Example: a future `finalize()` hook (deferred to v0.2 per Open Question 1's resolution). |
| Add a required method to the `Adapter` interface | MAJOR | PRD-108-R5(1). All existing adapters become non-conformant. |
| Add an optional field to `AdapterCapabilities` | MINOR | PRD-108-R4(1). Default behavior preserved when omitted. |
| Add a required field to `AdapterCapabilities` | MAJOR | PRD-108-R5(1). |
| Add a value to the closed `extraction_status` enum (PRD-200-R17) | MAJOR | PRD-108-R5(4). |
| Add a value to the open `summarySource` enum (R22) | MINOR | PRD-108-R4(3). The enum is documented-open. |
| Tighten `concurrency_max` default below 8 | MAJOR | PRD-108-R5(6). Producers may have been relying on parallelism. |
| Loosen partial-merge to permit array element-wise resolution (instead of concat) | MAJOR | PRD-108-R5(7) — reordering documented merge precedence. |
| Add a new framework-supplied field to `AdapterContext` | MINOR | PRD-108-R4(1). Adapters that don't read it are unaffected. |
| Remove a framework-supplied field from `AdapterContext` | MAJOR | PRD-108-R5(1). |
| Change the lifecycle order (R2) | MAJOR | PRD-108-R5(7). |
| Add a fixture row to the conformance corpus | MINOR | New positive or negative fixture; existing adapters MUST pass after a deprecation window per PRD-108-R12 if the fixture catches behavior they previously emitted. |
| Promote `precheck` from optional to required | MAJOR | PRD-108-R5(3). |
| Change `metadata.source` shape (rename `adapter` → `producer`, etc.) | MAJOR | PRD-108-R5(1). |
| Promote Stage 2 pinning from "MAY" to "MUST" once the ecosystem has migrated | MAJOR | PRD-108-R5(3). The migration trigger is decoupled from the rule's normative force; tightening to MUST is a future MAJOR. |

### Forward compatibility

A generator implementing PRD-200 v0.1 MUST tolerate adapters declaring fields in `AdapterCapabilities` it does not recognize (per PRD-108-R7). An adapter implementing PRD-200 v0.1 MUST tolerate `AdapterContext` fields it does not read. Both directions are additive within a MAJOR.

### Backward compatibility

A v0.1 adapter package runs against a v0.2 framework provided no MAJOR change has been made to the `Adapter` interface, `AdapterContext`, or the lifecycle order. Adding optional methods / fields is non-breaking; removing or renaming any required member is breaking.

For Stage 2 (PRD-200-R26), a single adapter version may declare support for multiple spec MINORs — `actSpecMinors: ["1.0", "1.1"]`. Generator-side enforcement (PRD-400) ensures the adapter is only invoked for spec MINORs it declares.

---

## Security considerations

This section cites PRD-109 (Accepted) for the project-wide threat model and documents only adapter-specific deltas.

**Build-time credential handling.** Adapters that connect to remote sources (CMS APIs, headless commerce APIs, source-control systems) consume credentials supplied via `ctx.config` or environment variables. PRD-109's information-disclosure rules apply: credentials MUST NOT appear in `logger.{debug,info,warn,error}` output, MUST NOT appear in build artifacts (manifest, index, nodes), and MUST NOT appear in `metadata.source.*` fields. Adapter authors SHOULD redact known-secret fields when logging config and SHOULD prefer environment-variable-based credentials over inline config so accidental commits do not leak. The framework does not enforce this — adapter authors are responsible — but PRD-600 SHOULD probe a sample of emitted nodes for high-entropy strings that resemble keys, as a sanity check.

**Network fan-out.** Adapters that paginate or fetch per-item content (Contentful, Sanity, Storyblok) MAY make hundreds-to-thousands of HTTP requests during one build. Adapters MUST respect `ctx.signal` for cancellation, SHOULD implement bounded retry with exponential backoff for transient failures, and SHOULD honor source-API rate-limit headers. Fan-out without rate-limit awareness becomes a self-DoS against the source. PRD-109 owns the project-wide DoS posture; PRD-200 only requires the adapter-side discipline.

**Multi-source merge as a privilege-escalation vector.** When two adapters contribute to the same node, the merge step (PRD-200-R12) effectively grants each contributor write access to fields it might not have authored. A hostile or buggy secondary adapter could inject arbitrary `metadata`, override `summary`, or append malicious `marketing:*` blocks. The framework cannot prevent this at the language level; PRD-109 documents the trust boundary on adapter packages (treat them as trusted code, since they execute in the build process). The `metadata.source.contributors` array (PRD-200-R13) is the audit trail — consumers and security tooling MAY inspect it to attribute fields back to specific adapters. The framework MUST stamp it accurately on every merged node.

**Component-contract `extract` failures.** Per gap D3 / PRD-300 (in flight), `extract` runs in the build's main JS context with no sandbox. A malicious or buggy contract can read process state, exfiltrate via network, or crash the build. PRD-200's contribution to this posture is the placeholder-fallback (PRD-200-R27): when `extract` fails, the adapter emits a `marketing:placeholder` block rather than crashing or omitting the node. This preserves build stability but does not contain a malicious contract — sandbox is a v0.2 question.

**ID-grammar enforcement.** Adapters MUST validate emitted IDs against PRD-100-R10 before emission. Failing to do so allows a hostile source (a CMS field controlled by a content author who is not the build operator) to inject path-traversal-like IDs (`../foo`, `..%2Ffoo`) that, while rejected by PRD-100's schema, could waste build time or create confusing error reports. The `idMinter.validate` helper on `AdapterContext` provides the canonical check.

**Adapter pinning as a security boundary.** Stage 1 pinning (PRD-200-R25) ensures an adapter built against spec `0.1` cannot be inadvertently run against spec `0.2`, where field semantics may have shifted in MINOR-tracked but consumer-relevant ways. Stage 2 (PRD-200-R26) relaxes this with explicit support declaration, which is itself a security control: a generator MUST refuse adapters whose declared range does not cover the spec being targeted. This prevents a "forgotten adapter" from silently emitting outdated envelope shapes.

For all other concerns — auth-scheme negotiation, ETag determinism, cross-origin trust, PII in error messages — cite PRD-109 directly. PRD-200 introduces no new transport surface and relies entirely on the wire-format and runtime PRDs for those rules.

---

## Implementation notes

This section is required for SDK / framework PRDs per the workflow.md Phase 3 addition. Snippets show the canonical TypeScript shape; full implementations live in the package repos under `packages/adapter-framework/` and the leaf adapter packages.

### Snippet 1 — The `Adapter` interface, full signature

```ts
// packages/adapter-framework/src/types.ts

export interface Adapter<TConfig = unknown, TItem = unknown> {
  readonly name: string;
  precheck?(config: TConfig): Promise<void>;
  init(config: TConfig, ctx: AdapterContext): Promise<AdapterCapabilities>;
  enumerate(ctx: AdapterContext): AsyncIterable<TItem> | TItem[];
  transform(item: TItem, ctx: AdapterContext): Promise<EmittedNode | null>;
  delta?(since: string, ctx: AdapterContext): AsyncIterable<TItem>;
  dispose(ctx: AdapterContext): Promise<void>;
}
```

### Snippet 2 — `AdapterContext` (framework-supplied)

```ts
// packages/adapter-framework/src/context.ts

import type { Node } from "@act/wire-format";

export interface AdapterContext {
  logger: Logger;
  emit(node: EmittedNode): Promise<void>;
  idMinter: {
    mint(parts: string[], opts?: { namespaced?: boolean }): string;
    validate(id: string): boolean;
  };
  config: {
    actVersion: string;
    targetLevel: "core" | "standard" | "plus";
    locales?: { default: string; available: string[] };
    [adapterDefined: string]: unknown;
  };
  signal: AbortSignal;
}

interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
}
```

### Snippet 3 — A minimal `init` implementation

```ts
async init(
  config: { sourceDir: string },
  ctx: AdapterContext,
): Promise<AdapterCapabilities> {
  if (!config.sourceDir) {
    throw new AdapterError("sourceDir is required");
  }
  const stat = await fs.stat(config.sourceDir).catch(() => null);
  if (!stat?.isDirectory()) {
    throw new AdapterError(`sourceDir '${config.sourceDir}' is not a directory`);
  }
  ctx.logger.info(`act-markdown reading from ${config.sourceDir}`);
  return {
    level: "standard",
    concurrency_max: 16,
    namespace_ids: true,
    summarySource: "extracted",
    manifestCapabilities: { etag: true, subtree: true },
  };
}
```

### Snippet 4 — A `transform` returning a Standard-tier node

```ts
async transform(
  item: { path: string; frontmatter: Record<string, unknown>; body: string },
  ctx: AdapterContext,
): Promise<EmittedNode> {
  const id = ctx.idMinter.mint([
    "act-markdown",
    item.path.replace(/\.md$/, "").replace(/\\/g, "/"),
  ]);
  if (!ctx.idMinter.validate(id)) {
    throw new AdapterError(`derived id '${id}' fails PRD-100-R10`);
  }
  return {
    act_version: ctx.config.actVersion,
    id,
    type: (item.frontmatter.type as string) ?? "article",
    title: (item.frontmatter.title as string) ?? "Untitled",
    etag: "",  // generator computes; adapter MAY supply for caching
    summary: (item.frontmatter.summary as string) ?? deriveSummary(item.body),
    summary_source: item.frontmatter.summary ? "author" : "extracted",
    content: [
      { type: "markdown", text: item.body },
    ],
    tokens: { summary: tokens(item.frontmatter.summary as string), body: tokens(item.body) },
    metadata: {
      source: { adapter: "act-markdown", source_id: item.path },
    },
  };
}
```

### Snippet 5 — A partial node (i18n adapter contributing translations)

```ts
async transform(
  item: { baseId: string; locale: string; translations: Translation[] },
  ctx: AdapterContext,
): Promise<EmittedNode> {
  return {
    id: item.baseId,
    _actPartial: true,
    metadata: {
      translations: item.translations.map((t) => ({
        locale: t.locale,
        id: `${item.baseId}@${t.locale.toLowerCase()}`,
      })),
      source: { adapter: "act-i18n", source_id: `${item.locale}:${item.baseId}` },
    },
  };
}
```

### Snippet 6 — The merge function (framework-internal pseudocode)

```ts
// packages/adapter-framework/src/merge.ts

export function mergeNodes(
  contributions: Array<{ adapter: string; node: EmittedNode }>,
  policy: { mode: "last-wins" | "error"; primaryAdapter?: string },
): MergeOutcome {
  if (contributions.length === 1) {
    return { ok: true, node: contributions[0].node };
  }
  if (policy.mode === "error") {
    return {
      ok: false,
      error: {
        code: "merge_collision",
        id: contributions[0].node.id,
        contributors: contributions.map((c) => c.adapter),
      },
    };
  }
  const result: Partial<Node> = {};
  for (const { node } of contributions) {
    deepMergeInto(result, node);  // arrays concat; objects merge; scalars overwrite
  }
  result.metadata = {
    ...result.metadata,
    source: {
      adapter: contributions[0].adapter,
      source_id: contributions[0].node.metadata?.source?.source_id ?? "",
      contributors: contributions.map((c) => ({
        adapter: c.adapter,
        source_id: c.node.metadata?.source?.source_id ?? "",
      })),
    },
  };
  if (!isFullyFormed(result)) {
    return { ok: false, error: { code: "merge_incomplete", id: result.id, missing: missingFields(result) } };
  }
  return { ok: true, node: result as Node };
}
```

### Snippet 7 — Recoverable failure with placeholder

```ts
async transform(item: SourceItem, ctx: AdapterContext): Promise<EmittedNode> {
  try {
    const enriched = await enrichItem(item);
    return buildNode(enriched);
  } catch (err) {
    ctx.logger.warn(`extraction partial for ${item.id}: ${(err as Error).message}`);
    return {
      act_version: ctx.config.actVersion,
      id: deriveId(item),
      type: item.type,
      title: item.title,
      etag: "",
      summary: item.summary ?? "(extraction failed; placeholder)",
      content: [{ type: "marketing:placeholder", reason: (err as Error).message }],
      tokens: { summary: 5 },
      metadata: {
        extraction_status: "partial",
        extraction_error: (err as Error).message,
        source: { adapter: "act-cms", source_id: item.id },
      },
    };
  }
}
```

### Snippet 8 — Capability declaration with i18n

```ts
async init(config: I18nConfig, ctx: AdapterContext): Promise<AdapterCapabilities> {
  return {
    level: "plus",
    concurrency_max: 8,
    namespace_ids: false,    // i18n contributes to base IDs from other adapters
    precedence: "fallback",  // never overrides a CMS-supplied scalar
    i18n: true,
    summarySource: "author",
    manifestCapabilities: {},  // i18n contributes no top-level manifest capabilities
  };
}
```

### Snippet 9 — Adapter package metadata (Stage 2 pinning)

```jsonc
// packages/act-markdown/package.json
{
  "name": "act-markdown",
  "version": "1.0.0",
  "actSpecMinors": ["1.0", "1.1"],
  "peerDependencies": {
    "@act/adapter-framework": "^1.0.0"
  }
}
```

A generator targeting spec `1.1` reads `actSpecMinors`, confirms `"1.1"` is included, and proceeds. A generator targeting `2.0` reads `actSpecMinors`, confirms `"2.0"` is *not* included, and refuses to run the adapter (build error per PRD-200-R26). The exact field name and resolver are owned by PRD-400; PRD-200 specifies only that the declaration MUST exist.

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft. Pins the `Adapter` TypeScript interface, the lifecycle order (precheck → init → enumerate → transform → dispose), the multi-source merge contract (last-writer-wins by default; opt-in `merge: "error"`; partial-node deep-merge with array concatenation; provenance via `metadata.source.contributors`), the recoverable / unrecoverable failure split (`metadata.extraction_status` closed three-value enum, build-warning vs non-zero exit), the `AdapterCapabilities` declaration shape and bubble-up to manifest's `capabilities.*` (per PRD-100-R6 / PRD-107-R14), the `AdapterContext` shape (logger, emit, idMinter, config, signal), the staged adapter version-pinning regime (Stage 1 pinned per PRD-108-R14; Stage 2 MAJOR-pinned / MINOR-floating ratified by this PRD's citation of PRD-108), the component-contract seam (`metadata.extracted_via`), and the test-fixture conformance corpus under `fixtures/200/`. Cites gaps B1, B2, B3, A4, B4, E7. Implementation notes ship 9 short TypeScript snippets covering the contract, lifecycle, partial / merge, failure modes, capability declaration, and Stage 2 package metadata. Status set to `In review`. |
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review; no normative changes other than the resolutions documented inline. Decisions: (1) no `finalize()` hook for v0.1 — whole-corpus passes go in `dispose`; (2) `transform` keeps its 1:1 `Node | null` return — fan-out uses `enumerate` or `ctx.emit`; (3) `summary_source` is per-emitted-node with a capability-level "highest supported" declaration; (4) merge step keeps the binary `last-wins` / `error` policy — no user-defined resolver in v0.1; (5) ratified `metadata.source.contributors` framework-only stamping with explicit note that it reserves a single sub-key under `metadata` without narrowing PRD-100-R22's openness; (6) ratified the `AdapterCapabilities.precedence` field (used by PRD-207); (7) ratified Stage 2 pinning ratification trigger reading; (8) documented the `ctx.emit` vs return-from-`transform` rule (prefer return; `emit` only for mid-`transform` fan-out); (9) aligned negative-fixture convention to PRD-100's inline `_negative_reason` as primary, sidecar `.expected.json` permitted as secondary. |
| 2026-05-01 | Jeremy Forsythe | Non-trivial revision: renamed framework-internal partial-node discriminator from `_partial` to `_actPartial` to namespace the marker under the `_act` prefix and reduce collision risk against author-defined fields. The `_act` prefix is now reserved for framework-supplied keys; adapters MUST NOT define their own keys beginning with `_act`. Marker remains framework-internal (stripped before wire emission). PRD-207 and PRD-208 updated in lockstep. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
| 2026-05-02 | Spec Steward | Inline clarification per amendment A1 (SOP-3): added rule 4 to PRD-200-R12 specifying that `metadata.translations` arrays MUST be deduped by `(locale, id)` after concatenation, with later-wins precedence on duplicates. Closes the silent gap that produced duplicate translation entries on nodes contributed to by both PRD-202 (CMS) and PRD-207 (i18n). New positive fixture `fixtures/200/positive/merge-translations-dedupe.json` exercises the dedupe. PRD remains Accepted; no normative change to the array-concat default for any other field. |
