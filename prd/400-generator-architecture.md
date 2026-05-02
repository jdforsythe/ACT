# PRD-400 — Generator architecture (shared pipeline, plugin targets)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

The v0.1 working draft (`docs/plan/v0.1-draft.md` §7 "Build integration") sketches a generator pipeline informally — adapters run, content gets normalized, files get written — but every concrete contract a leaf generator (PRD-401 Astro, PRD-402 Hugo, PRD-403 MkDocs, PRD-404 Docusaurus, PRD-405 Next.js, PRD-406 Remix, PRD-407 Nuxt, PRD-408 Eleventy, PRD-409 standalone CLI) needs to implement is missing. There is no canonical pipeline order, no plugin/target interface, no rule for how adapter output composes with component-extracted content, no specification of how the manifest's `capabilities` object gets populated from observed emissions, no rule for incremental rebuilds, no atomic-write guarantee, no `--fail-on-extraction-error` flag, no statement of which test fixtures every generator MUST produce equivalently. Gaps that converge here include **A4** (build-time error / warning severity, owned jointly with PRD-105 / PRD-200 / PRD-300), **B2** (composing adapter merges with component-extracted content), **B4** (component-contract emission seam, the consumer of the seam owned by PRD-200/PRD-300 is the generator), **C5** (hybrid `mounts` and how the static parent fits with runtime mounts), and **E2** (versioned trees layout). Until this PRD lands, the nine 40x leaf PRDs cannot leave Draft; the static profile (PRD-105 Accepted) has a build target only in prose; and the corporate-marketing composite from draft §6.5 / §8.4 — the canonical exercise that crosses Contentful + i18n + components + Next.js — has no normative pipeline binding it together.

PRD-100 (Accepted) defines the wire-format envelopes the generator emits. PRD-103 (Accepted) defines the ETag derivation the generator runs at build time. PRD-104 (Accepted) defines the i18n locale layout the generator must honor. PRD-105 (Accepted) defines the static delivery profile the generator targets. PRD-107 (Accepted) defines the conformance levels the manifest declares. PRD-108 (Accepted) defines the version-pinning regime the generator inherits from PRD-200. PRD-109 (Accepted) defines the project-wide threat model. PRD-200 (In review) defines the adapter framework the generator orchestrates. PRD-300 (In review) defines the component-instrumentation contract the generator consumes. What's missing is the framework PRD that ties these into a single TypeScript pipeline every leaf generator implements as a plugin target, framework-agnostic enough that PRD-402 (Hugo, spec-only per Q3) and PRD-403 (MkDocs, spec-only per Q3) can describe equivalent behavior in their host languages.

### Goals

1. Lock the **canonical pipeline shape** as an ordered sequence of stages: discover sources → run adapters (PRD-200 lifecycle) → run component extractors (PRD-300 lifecycle, optional) → merge → normalize/validate → compute ETags (PRD-103) → emit files (PRD-105 directory layout). Each stage has explicit inputs and outputs.
2. Lock the **plugin/target interface** as a TypeScript interface (`GeneratorPlugin`, `GeneratorRuntime`, supporting types) that every leaf generator implements. Reference language is TS-only per decision Q3; PRD-402 and PRD-403 describe equivalent behavior in their host languages without a TS reference impl.
3. Specify **multi-source merging composition**: the framework runs PRD-200's adapter merge across all configured adapters, then composes the result with PRD-300's component-extracted nodes. Cite PRD-200's merge rules; do not redefine them.
4. Specify **i18n handling**: the generator invokes the i18n adapter (PRD-207) when locales are configured, emits per-locale manifests / indexes per PRD-104 (Pattern 1 or Pattern 2), and threads `ctx.locale` through PRD-300's extraction context.
5. Specify **conformance level computation**: the generator computes the manifest's `conformance.level` from declared adapter capabilities (PRD-200-R22) plus declared binding capabilities (PRD-300-R28) plus emitted artifacts; per PRD-107-R22's spirit, the achieved level is what the prober verifies, not what adapters claim.
6. Specify **capability flag emission**: the generator populates the manifest's `capabilities` object based on what files it actually emitted (e.g., emitted NDJSON → `capabilities.ndjson_index: true`), per PRD-200-R23. Adapter-declared capabilities are inputs; observed emission is the gating signal.
7. Specify the **static output layout build process**: defers to PRD-105 for the directory layout but specifies how the generator builds it — incremental rebuilds (re-emit only changed nodes), atomic writes (no half-written index), build-time validation against PRD-100 schemas.
8. Specify the **configuration shape**: a TypeScript interface for generator config (adapter list with options, component bindings, output directory, base URL, advertised capabilities, conformance target, i18n locales, optional `ndjson_index` / `subtree_url_template` / `search_url_template` advertisements).
9. Specify **build hooks**: `pre-build`, `post-build`, `on-error`. Plugin authors can extend; the hosted-validator integration (PRD-600) attaches to `post-build`.
10. Encode the **adapter version pinning regime** the generator enforces: pinned in v0.1 per PRD-200-R25, MAJOR-pinned / MINOR-floating per PRD-200-R26 once PRD-108's stage 2 unlocks (which it has, in PRD-200's Specification — PRD-400 enforces stage-2 readiness checks).
11. Specify **spec-only leaf treatment**: PRD-402 (Hugo) and PRD-403 (MkDocs) are spec-only per Q3. The framework contract still applies at the spec level even though no TS reference impl ships in v0.1; the contract is framework-agnostic enough that a Hugo module or MkDocs plugin can describe equivalent behavior in their host language.
12. Specify **failure modes**: build errors vs warnings, exit codes, partial-output behavior (atomic writes preferred — never leave a corrupt index or a half-written manifest); the `--fail-on-extraction-error` flag escalates PRD-300-R22 placeholder warnings to non-zero exit.
13. Enumerate the **test-fixture matrix** under `fixtures/400/positive/` and `fixtures/400/negative/` — synthetic source corpora and expected output trees that every leaf generator MUST produce equivalently.

### Non-goals

1. **Defining the wire-format envelopes.** Owned by PRD-100 (Accepted). The generator emits envelopes that satisfy PRD-100's schemas; this PRD does not redefine those shapes.
2. **Defining the static delivery profile.** Owned by PRD-105 (Accepted). The generator's emission target is the file set PRD-105 specifies; this PRD only specifies how the generator builds it.
3. **Defining ETag derivation.** Owned by PRD-103 (Accepted). The generator computes ETags per PRD-103-R4 (static recipe) and emits them on every envelope.
4. **Defining the i18n manifest layout.** Owned by PRD-104 (Accepted). The generator picks Pattern 1 or Pattern 2 per config and emits accordingly.
5. **Defining the adapter framework.** Owned by PRD-200 (In review). The generator orchestrates adapters per PRD-200's lifecycle; this PRD specifies the orchestration, not the adapter contract.
6. **Defining the component contract.** Owned by PRD-300 (In review). The generator invokes binding extraction per PRD-300's `extractRoute` interface; this PRD specifies the invocation, not the contract.
7. **Defining individual generator behavior.** PRD-401 through PRD-409 each own their host-framework specifics (Astro integration shape, Docusaurus plugin shape, Next.js custom server hook, etc.). This PRD specifies only the framework contract those PRDs inherit.
8. **Defining the runtime SDK.** Owned by PRD-500 (In review). Generators are build-time emitters; runtime servers do not invoke generators at request time.
9. **Defining the validator.** Owned by PRD-600 (In review). The generator's post-build hook MAY invoke the validator; this PRD specifies the hook surface, not the validator's implementation.
10. **Authoring the project-wide threat model.** Owned by PRD-109 (Accepted). PRD-400's Security section cites PRD-109 and only documents generator-specific posture deltas.
11. **Defining new JSON Schemas.** The generator emits per PRD-100's schemas; no new wire-format schemas are introduced. The TypeScript interface in §"Wire format / interface definition" is the contract for this PRD.
12. **Specifying a non-TypeScript generator runtime.** Per decision Q3, v0.1 reference generators are TypeScript-only. PRD-402 (Hugo) and PRD-403 (MkDocs) are spec-only PRDs that describe equivalent behavior in their host languages; this PRD's contract is framework-agnostic enough to admit those descriptions.

### Stakeholders / audience

- **Authors of:** PRD-401 (Astro), PRD-402 (Hugo, spec-only), PRD-403 (MkDocs, spec-only), PRD-404 (Docusaurus), PRD-405 (Next.js), PRD-406 (Remix), PRD-407 (Nuxt), PRD-408 (Eleventy), PRD-409 (standalone CLI). Every leaf generator PRD declares "implements PRD-400" and inherits this PRD's contract.
- **Consumers of (upstream):** PRD-200 (adapter framework — produces what generators consume), PRD-300 (component contract — produces what generators consume).
- **Consumers of (downstream):** PRD-600 (validator — runs against generator output), PRD-700-series (reference example builds — every example uses a generator).
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The pipeline shape ossifies before P2 implementation surfaces real ergonomic issues. | Medium | Medium | Mark the interface as v0.1; PRD-400's Versioning table classifies adding optional pipeline hooks as MINOR per PRD-108-R4(1). Amendments during P2 implementation land cleanly. |
| Capability advertisement inflation — generator advertises `capabilities.subtree: true` but never emits subtree files. | Medium | Medium | PRD-400-R18 forbids advertisement without emission; PRD-600 probes for parity. Negative fixture `capability-advertised-without-files.json` covers the failure mode. |
| Hugo / MkDocs spec-only treatment drifts from what the TS reference would produce. | Medium | Medium | PRD-400's contract is intentionally framework-agnostic; the TS interface is the normative form, but every requirement is stated in framework-agnostic prose first. Spec-only generators (PRD-402 / PRD-403) describe equivalent behavior. PRD-600 validates output, not the implementation language; a conformant Hugo module is conformant the same way a conformant Astro plugin is. |
| Atomic-write guarantee is hard to honor across hosting platforms (some build systems write directly to S3 buckets, where there is no atomic dir-rename). | Low | Medium | PRD-400-R23 specifies atomic writes within the generator's working directory (the `outputDir`); the deploy step (CDN sync, S3 push) is outside ACT's scope. PRD-105-R12 covers the CDN side. |
| Incremental rebuilds produce stale manifests because the generator doesn't recompute the index when only a few nodes changed. | Medium | High | PRD-400-R22 requires that any change to the node set (add, remove, modify) invalidates the index's ETag and triggers index re-emission. Incremental applies to nodes, not to the index. Negative fixture `incremental-stale-index.json` covers the failure mode. |
| Component-extraction failures cascade: one broken page contract takes down the whole build. | Medium | Medium | PRD-300-R22's placeholder substitution prevents cascade by design; PRD-400 inherits the rule. The optional `--fail-on-extraction-error` flag (PRD-400-R26) lets strict-CI builds elevate placeholders to errors. |
| Plugin authors override the canonical pipeline order. | Low | High | The pipeline order is normative (PRD-400-R1 / R2). Plugins extend hooks; they do not reorder stages. A plugin that needs to interleave (e.g., wants to extract components before adapters run) MUST escalate to a v0.2 spec change, not implement it locally. |
| Two leaf generators produce different output for the same source corpus due to under-specification. | High | Medium | PRD-400-R28 mandates the `fixtures/400/` corpus: every leaf generator MUST produce equivalent output. PRD-600 runs the corpus across all generators in CI. Discrepancies are spec bugs, surfaced via amendments per workflow.md §Reviews and amendments. |
| Hosted-validator integration coupling — PRD-400's `post-build` hook gets called with state that's specific to the validator's needs, leaking PRD-600 concerns into PRD-400. | Low | Low | PRD-400-R25 keeps the hook surface generic (the validator is one of many post-build consumers); the validator integrates via a published interface, not via PRD-400 special-casing. |

### Open questions

1. ~~Should the pipeline expose a **pre-emit hook** between normalize/validate and write (so plugins can transform envelopes before they hit disk)?~~ **Resolved (2026-05-01): No.** A pre-emit hook opens a surface where plugins could violate PRD-100 schemas after validation; "strict over permissive when failure mode is silent corruption" (heuristic 3). The hook surface remains pre-build / post-build / on-error per PRD-400-R24. Revisit in v0.2 if a real use case emerges (e.g., a custom hash algorithm needing different ETag derivation). (Closes Open Question 1.)
2. ~~Should incremental rebuilds use **content hashing** (input fingerprint) or **timestamps** (mtime) as the change detector?~~ **Resolved (2026-05-01): Content hashing.** Timestamps are unreliable across CI runs and source-control checkouts. The hash material is the adapter's `delta(since)` marker (PRD-200-R9) when available, or the generator's own input-set hash otherwise. Encoded normatively in PRD-400-R22. (Closes Open Question 2.)
3. ~~Should the generator surface a **structured build report** (machine-readable JSON describing every emitted file, every warning, every error) alongside the human-readable log?~~ **Resolved (2026-05-01): Yes.** PRD-600's `--conformance` mode and CI integrations both want it; the shape is small (file path, byte size, ETag, severity); a sidecar at `outputDir/.act-build-report.json`. The report MUST NOT be uploaded to the CDN per PRD-400-R27 (eliminates a credential-leak vector). Encoded normatively in PRD-400-R27. (Closes Open Question 3.)
4. ~~Should plugins be permitted to **register additional adapters or bindings dynamically** at `pre-build` time, or must the full set be declared in config?~~ **Resolved (2026-05-01): Config-only.** Dynamic registration creates surprises in `--dry-run` and conformance reporting; "prefer minimalism" (heuristic 1) and "strict over permissive" (heuristic 3) both point this way. Plugins MAY emit additional source-discovery hints that the user-supplied config picks up, but MUST NOT mutate the adapter list at runtime. (Closes Open Question 4.)
5. ~~Should the generator emit a **generator-name capability hint** in the manifest (e.g., `generator: "@act/astro@0.1.0"`) so downstream tooling can correlate output to its producer?~~ **Resolved (2026-05-01): Yes, SHOULD (not MUST).** PRD-100-R8 already permits the optional `generator` field; PRD-400-R20 SHOULD-populates it. Observability hint, not a conformance requirement. (Closes Open Question 5.)

### Acceptance criteria

- [ ] Every normative requirement has an ID `PRD-400-R{n}` and a declared conformance level per PRD-107.
- [ ] The Specification section opens with a table mapping every requirement to the 100-series + PRD-200 + PRD-300 requirement(s) it implements (Phase 3 addition per `docs/workflow.md`).
- [ ] The TypeScript interface is reproduced inline in §"Wire format / interface definition" with full type signatures for `GeneratorPlugin`, `GeneratorRuntime`, `GeneratorConfig`, `BuildContext`, `BuildHooks`, `BuildReport`, and the pipeline-stage signatures.
- [ ] Multi-source merging composition is pinned with a worked example combining adapter merge (PRD-200-R12) and component-extracted content (PRD-300-R9).
- [ ] Conformance-level computation rule is pinned (declared vs achieved, mirrors PRD-107-R22's spirit).
- [ ] Capability-flag emission rule is pinned (advertised iff emitted, per PRD-200-R23).
- [ ] Adapter pinning enforcement (PRD-200-R25 / R26) is encoded for both Stage 1 and Stage 2; the generator MUST refuse to run an adapter outside the supported MINOR set.
- [ ] Implementation notes ship 3–10 short TypeScript snippets covering: pipeline orchestration, plugin interface, an Astro-style plugin sketch, capability-flag computation, atomic write, incremental rebuild detection, build-hook invocation.
- [ ] Test fixture path layout under `fixtures/400/positive/` and `fixtures/400/negative/` is enumerated; one fixture per major requirement; no fixture files created in this PRD.
- [ ] No new JSON Schemas under `schemas/400/` — generators emit per PRD-100 schemas.
- [ ] Versioning & compatibility section classifies every kind of change to PRD-400 per PRD-108.
- [ ] Security section cites PRD-109 for the project-wide posture and documents generator-specific deltas (build-process trust boundary, secret-handling discipline, output-directory permissions).
- [ ] Spec-only treatment for PRD-402 / PRD-403 is documented; the contract is framework-agnostic enough to admit Hugo / MkDocs implementations.
- [ ] Changelog entry dated 2026-05-01 by Jeremy Forsythe is present.

---

## Context & dependencies

### Depends on

- **PRD-100** (Accepted) — wire-format envelopes. The generator emits manifest, index, node, subtree, and (Plus) NDJSON-index envelopes that satisfy `schemas/100/*.schema.json`.
- **PRD-103** (Accepted) — ETag derivation. The generator runs PRD-103-R4 (static recipe) over every envelope's payload-minus-`etag` and emits the resulting `s256:`-prefixed value.
- **PRD-104** (Accepted) — i18n. The generator emits per-locale manifests and indexes per Pattern 1 (locale-prefixed IDs) or Pattern 2 (per-locale manifests) based on configuration.
- **PRD-105** (Accepted) — static delivery profile. The generator's emission target is the file set PRD-105 specifies; this PRD specifies how the generator builds it.
- **PRD-107** (Accepted) — conformance levels. The generator declares the manifest's `conformance.level`; the level reflects observed emissions, not adapter claims.
- **PRD-108** (Accepted) — versioning policy. The generator inherits PRD-108's MAJOR/MINOR rules and enforces PRD-200's staged adapter pinning (R14 / R15).
- **PRD-109** (Accepted) — security posture. PRD-400's Security section cites PRD-109 for the project-wide threat model and documents generator-specific deltas.
- **PRD-200** (In review) — adapter framework. The generator orchestrates adapters per the lifecycle pinned by PRD-200-R2 (`precheck` → `init` → `enumerate` → `transform` → `dispose`); merges adapter contributions per PRD-200-R12; translates adapter capabilities into manifest `capabilities.*` per PRD-200-R23; refuses to run adapters that fail PRD-200-R25 / R26 pinning checks.
- **PRD-300** (In review) — component contract. The generator invokes binding `extractRoute` per PRD-300's interface; consumes the binding's `BindingCapabilities` (PRD-300-R28) to dispatch extraction; surfaces placeholder warnings (PRD-300-R22).
- **000-governance** (Accepted) — lifecycle of this PRD itself.
- **000-decisions-needed Q3** — TS-only first-party reference impl for v0.1; PRD-402 / PRD-403 are spec-only.
- **000-decisions-needed Q5** — staged adapter pinning regime.
- External: [TypeScript 5.x](https://www.typescriptlang.org/) (interface syntax used inline), [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174). Atomic write semantics on POSIX (`rename(2)`); equivalent on Windows (`MoveFileEx` with `MOVEFILE_REPLACE_EXISTING`).

### Blocks

- **PRD-401** (Astro plugin) — implements PRD-400 against Astro's integration API.
- **PRD-402** (Hugo module, spec-only per Q3) — describes equivalent behavior for Hugo's module system.
- **PRD-403** (MkDocs plugin, spec-only per Q3) — describes equivalent behavior for MkDocs' plugin system.
- **PRD-404** (Docusaurus plugin) — implements PRD-400 against Docusaurus' lifecycle API.
- **PRD-405** (Next.js plugin, static export) — implements PRD-400 against Next.js' static export.
- **PRD-406** (Remix plugin, static export) — implements PRD-400 against Remix's static-export path.
- **PRD-407** (Nuxt module) — implements PRD-400 against Nuxt's module API.
- **PRD-408** (Eleventy plugin) — implements PRD-400 against Eleventy's plugin API.
- **PRD-409** (standalone CLI) — implements PRD-400 as a framework-less CLI; consumes the headless binding (PRD-300-R29) for SPAs without SSR.
- **PRD-700-series** (reference example builds) — every example builds via a leaf generator and exercises this contract end-to-end.

### References

- v0.1 draft: §7 (build integration: pipeline, generator pseudocode, plugin targets), §6.5 (corporate marketing composite — the canonical Plus generator exercise), §8.4 (corporate marketing site worked example, Plus i18n + Next.js + Contentful + components), §5.10 (adapter pipeline informal sketch — superseded by PRD-200), §5.11.3 (component-extraction strategies — superseded by PRD-300).
- `prd/000-gaps-and-resolutions.md` gaps **A4** (build error / warning severity, jointly owned with PRD-105 / PRD-200 / PRD-300; PRD-400 owns the generator-side rule), **B2** (multi-source merging, composes with PRD-300 component output here), **B4** (component-contract emission seam, the consumer side), **C5** (hybrid mounts and the static parent's responsibilities), **E2** (versioned trees layout — informational here), **D3** (build-time `extract` safety, no sandbox; PRD-400 inherits PRD-300's stance), **D4** (non-SSR-able SPA fallback; PRD-409 ships Tier-2 only).
- `prd/000-decisions-needed.md` Q3 (TS-only reference impl; PRD-402 / PRD-403 spec-only), Q5 (adapter pinning, staged).
- Prior art: [Astro Integrations API](https://docs.astro.build/en/reference/integrations-reference/) (lifecycle hooks, capability declaration); [Docusaurus plugin lifecycle](https://docusaurus.io/docs/api/plugin-methods) (loadContent / contentLoaded / postBuild); [Next.js static export](https://nextjs.org/docs/app/building-your-application/deploying/static-exports); [Eleventy plugin API](https://www.11ty.dev/docs/plugins/); [Hugo modules](https://gohugo.io/hugo-modules/) (informational for PRD-402); [MkDocs plugin events](https://www.mkdocs.org/dev-guide/plugins/) (informational for PRD-403).

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords as clarified by RFC 8174.

### 100-series + parent-framework requirements implemented

The table below maps every PRD-400 requirement to the upstream requirement(s) it implements or relies on. This table satisfies the workflow.md Phase 3 rule that every P2 PRD declare the 100-series and parent-framework surface it implements. Where a row says "consumes," the PRD-400 requirement does not redefine the shape — it requires conformance to the cited PRD-100 / PRD-103 / PRD-104 / PRD-105 / PRD-107 / PRD-108 / PRD-109 / PRD-200 / PRD-300 requirement and adds generator-specific obligations on top.

| PRD-400 requirement | Upstream requirement(s) implemented or consumed | Relationship |
|---|---|---|
| R1 (canonical pipeline order) | PRD-200-R2 (adapter lifecycle), PRD-300 § extractRoute | Composes adapter and binding lifecycles into a single ordered pipeline. |
| R2 (stage I/O contract) | — | Framework-internal. |
| R3 (`GeneratorPlugin` interface compliance) | — | Framework-internal; the TS interface is normative for TS impls. |
| R4 (multi-adapter orchestration) | PRD-200-R2, PRD-200-R12 | Generator invokes each adapter's lifecycle and feeds emissions to the merge step. |
| R5 (component-extraction orchestration) | PRD-300-R8, PRD-300-R28 | Generator dispatches extraction per the binding's capability declaration. |
| R6 (multi-source merge composition) | PRD-200-R12, PRD-200-R13, PRD-200-R15, PRD-300-R9, PRD-300-R11 | Adapter merge runs first; component merge composes; generator surfaces collisions. |
| R7 (normalize / validate) | PRD-100-R3, R16, R21, R28, R29 | Generator validates every emitted envelope against PRD-100 schemas before write. |
| R8 (compute ETag) | PRD-103-R4 | Generator runs the static derivation recipe over every envelope. |
| R9 (emit static file set) | PRD-105-R1, R2, R4, R5, R6, R7 | Generator writes the file set PRD-105 enumerates. |
| R10 (manifest emission) | PRD-100-R3, R4, R5, R6, R7, R8, PRD-107-R1, R3 | Generator constructs the manifest from observed emissions and config. |
| R11 (index emission) | PRD-100-R16, R17, R18, R19 | Generator aggregates per-node summaries into the index. |
| R12 (NDJSON index emission) | PRD-100-R37, R38, PRD-105-R7, PRD-107-R10 | Plus only; one entry per line. |
| R13 (subtree emission) | PRD-100-R32, R33, R34, R35, PRD-105-R6, PRD-107-R8 | Standard or higher; emitted for every advertised subtree-id. |
| R14 (i18n layout dispatch) | PRD-104-R1, R5, R6, R7 | Generator picks Pattern 1 or Pattern 2 from config. |
| R15 (per-locale manifest emission, Pattern 2) | PRD-104-R6 | Generator writes per-locale manifests at templated URLs. |
| R16 (locale-prefixed IDs, Pattern 1) | PRD-104-R5 | Generator threads `metadata.locale` and validates ID-locale agreement. |
| R17 (conformance-level computation) | PRD-107-R1, R6, R8, R10, R14, R22 | Generator computes `conformance.level` from observed artifacts; SHOULD NOT inflate adapter claims. |
| R18 (capability-flag emission) | PRD-100-R6, PRD-200-R23 | Advertised iff observed; never trust adapter declaration alone. |
| R19 (mounts emission) | PRD-100-R7, PRD-107-R5, gap C5 | Generator emits `mounts` from configuration when declared. |
| R20 (`generator` and `generated_at` fields) | PRD-100-R8 | Generator SHOULD populate these for observability. |
| R21 (validation before emission) | PRD-100-R0, PRD-100-R3, R16, R21, R32, R41 | Build error on schema validation failure; no partial output. |
| R22 (incremental rebuild rule) | — | Framework-internal; index ETag invalidates on any node-set change. |
| R23 (atomic writes) | PRD-105-R12 | Generator writes to a tmp path then renames; no half-written index. |
| R24 (build hooks) | — | Framework-internal; pre-build / post-build / on-error. |
| R25 (post-build hook surface for downstream tools) | PRD-600 § hosted UI | Validator integrates via the published hook surface. |
| R26 (`--fail-on-extraction-error` flag) | PRD-300-R22 | Escalates placeholder warnings to non-zero exit. |
| R27 (build report sidecar) | — | Framework-internal observability artifact. |
| R28 (test-fixture conformance) | — | Every leaf generator MUST pass `fixtures/400/`. |
| R29 (Stage 1 adapter pinning enforcement) | PRD-200-R25, PRD-108-R14 | Generator refuses adapters whose `act_version` doesn't match the target. |
| R30 (Stage 2 adapter pinning enforcement) | PRD-200-R26, PRD-108-R14, R15 | Generator refuses adapters whose `actSpecMinors` doesn't include the target. |
| R31 (configuration shape) | PRD-200-R19 (`AdapterContext.config`) | Generator's config is the source of `ctx.config` for adapters. |
| R32 (target-level enforcement) | PRD-107-R14, PRD-200-R24 | Generator rejects adapters whose declared `level` is below the target. |
| R33 (spec-only leaf treatment) | Q3 | Framework-agnostic prose admits non-TS implementations. |
| R34 (versioned-trees layout, optional) | PRD-105-R16, gap E2 | Generator MAY emit per-version manifests; non-blocking. |

### Conformance level

Every requirement in PRD-400 belongs to one of the conformance bands defined by PRD-107. Because PRD-400 is a framework PRD (not a wire-format band), the level annotation indicates *which band of producer output the requirement primarily affects*; a generator targeting Plus must satisfy every Core, Standard, and Plus-banded requirement.

- **Core:** PRD-400-R1, R2, R3, R4, R7, R8, R9, R10, R11, R17, R18, R20, R21, R22, R23, R24, R25, R28, R29, R31, R32, R33.
- **Standard:** PRD-400-R5, R6, R13, R26 (`--fail-on-extraction-error`; Standard because component-extraction lands at Standard or higher), R27.
- **Plus:** PRD-400-R12 (NDJSON), R14, R15, R16 (i18n; Plus per PRD-107-R10), R19 (mounts; Standard/Plus mix), R30 (Stage 2 pinning is Plus-only because no MAJOR ratification has occurred at v0.1), R34 (versioned trees, optional).

A generator targeting Plus satisfies Standard and Core by additivity (PRD-107-R11).

### Normative requirements

#### Canonical pipeline order

**PRD-400-R1.** A generator MUST execute the canonical pipeline in the following order, with no reordering, no interleaving, and no skipping of stages that apply at the configured conformance target:

1. **Discover sources.** The generator resolves the user-supplied configuration (PRD-400-R31) and confirms every declared adapter package and component binding is loadable.
2. **Run adapters.** For each configured adapter, the generator invokes the PRD-200 lifecycle: `precheck` (optional) → `init` → `enumerate` → `transform` (per item, possibly concurrent per PRD-200-R6) → `dispose`. Adapters emit nodes (full or partial) to the framework's collection sink.
3. **Run component extractors.** When component bindings are configured (PRD-400-R5), the generator invokes each binding's `extractRoute` for every route advertised by the host framework. Extractions emit nodes to the collection sink.
4. **Merge.** The generator runs the multi-source merge step described by PRD-200-R12 across adapter contributions, then composes with component-extracted nodes per PRD-400-R6.
5. **Normalize / validate.** The generator validates every merged node and the synthesized index against PRD-100's schemas (PRD-400-R7 / R21).
6. **Compute ETags.** The generator runs PRD-103-R4 over every envelope's payload-minus-`etag` and writes the result into the envelope's `etag` field (PRD-400-R8).
7. **Emit files.** The generator writes the static file set per PRD-105's directory layout (PRD-400-R9), via atomic writes (PRD-400-R23).

Conformance: **Core**.

**PRD-400-R2.** Each pipeline stage has explicit inputs and outputs:

| Stage | Inputs | Outputs |
|---|---|---|
| Discover sources | `GeneratorConfig` | Resolved adapter list, resolved binding list, build context |
| Run adapters | Adapter list, build context | Adapter contributions (collection of nodes, partials, warnings) |
| Run component extractors | Binding list, route enumeration, build context | Binding contributions (collection of node drafts, warnings) |
| Merge | Adapter contributions, binding contributions | Merged node set (one node per ID), provenance metadata |
| Normalize / validate | Merged node set | Validated node set, synthesized index, build-error-or-clean signal |
| Compute ETags | Validated envelopes (manifest, index, nodes, subtrees, NDJSON lines) | Envelopes with `etag` populated |
| Emit files | Envelopes with ETags, output directory | Files written atomically to `outputDir`; build report (PRD-400-R27) |

A generator MUST NOT pass data between stages outside this contract. Plugins extend via build hooks (PRD-400-R24), not by side-channel mutation. Conformance: **Core**.

#### `GeneratorPlugin` interface and runtime

**PRD-400-R3.** A leaf generator (Astro plugin, Docusaurus plugin, etc.) MUST implement the TypeScript interface `GeneratorPlugin` defined in §"Wire format / interface definition." The plugin provides framework-specific glue (where the build root is, when in the host framework's lifecycle to run, how to read framework config); the framework provides the canonical pipeline (PRD-400-R1). The generator runtime (`GeneratorRuntime`) is the framework's invocation of the pipeline; the plugin wraps the runtime in host-framework idiom. Conformance: **Core**.

#### Multi-adapter orchestration (consumes PRD-200)

**PRD-400-R4.** When two or more adapters are configured, the generator MUST invoke each adapter's lifecycle (PRD-200-R2) sequentially per adapter (different adapters' lifecycles MUST NOT interleave). Within a single adapter, `transform` MAY run concurrently per the adapter's declared `concurrency_max` (PRD-200-R6). Adapters' contributions are pooled into a single collection sink keyed by node ID; the merge step (PRD-400-R6) runs after every adapter has disposed. Conformance: **Core**.

#### Component-extraction orchestration (Standard, consumes PRD-300)

**PRD-400-R5.** When component bindings are configured, the generator MUST inspect each binding's `BindingCapabilities` (PRD-300-R28) and dispatch extraction accordingly. The generator picks among `ssr-walk`, `static-ast`, and `headless-render` per the binding's declared support; the binding's preferred path (the first truthy capability in the order `ssr-walk → static-ast → headless-render`) is the default. The generator MAY override via configuration (PRD-400-R31) for testing or for SPA fallback (PRD-300-R29). For each route, the generator invokes `extractRoute({ routeId, module, routeProps, locale, variant })` and pools the returned `NodeDraft[]` into the collection sink alongside adapter contributions. Conformance: **Standard**.

#### Multi-source merge composition (consumes PRD-200, PRD-300)

**PRD-400-R6.** The merge step composes adapter contributions and component-extracted contributions in a defined order:

1. Run PRD-200-R12's adapter merge across all adapter contributions for each ID. The result is a single merged node per ID (or a build error per PRD-200-R14 / R200-R15 when `merge: "error"` is in effect).
2. Pool each component-extracted `NodeDraft` (PRD-300) into the merged set. A `NodeDraft` whose `id` matches an adapter-merged ID MUST cause a build error per PRD-300-R11 (page-level ID collisions are hard errors); component bindings MUST NOT silently merge with adapter output.
3. Stamp `metadata.source.contributors` per PRD-200-R13. When a node is component-extracted (no adapter contributed), `metadata.source.adapter` is the binding name (e.g., `"@act/react"`), and `source_id` is the route's `routeId`. When both adapters and bindings contribute (rare; only via the explicit `metadata.translations` partial-merge pattern), the generator MUST cite all contributors in the array.

The generator MUST NOT redefine the merge rules; PRD-200's contract is canonical. PRD-400's contribution is the composition order and the rule that adapter-extracted IDs and component-extracted IDs are not silently merged. Conformance: **Standard**.

#### Normalize / validate

**PRD-400-R7.** Before emitting any file, the generator MUST validate every envelope against PRD-100's schemas:

- Manifest against `schemas/100/manifest.schema.json`.
- Index against `schemas/100/index.schema.json` (and each NDJSON line against `#/$defs/IndexEntry` when the Plus tier emits NDJSON).
- Each node against `schemas/100/node.schema.json`.
- Each subtree (Standard or higher) against `schemas/100/subtree.schema.json`.

A validation failure MUST cause the build to fail with a non-zero exit code; the generator MUST NOT emit a partial deployment. The validator surfaces the offending field path and the schema rule. Conformance: **Core**.

**PRD-400-R8.** After validation and before write, the generator MUST compute the `etag` for every envelope per PRD-103-R4 (static recipe): JCS-canonical encoding of the envelope's payload-minus-`etag`, SHA-256, base64url no-padding, truncated to 22 chars, prefixed with `s256:`. The generator MUST overwrite any `etag` value an adapter or binding pre-populated; ETag derivation is the generator's responsibility, not the adapter's. (Adapters MAY supply an `etag` for caching purposes — see PRD-200 Snippet 4 — but the framework recomputes.) Conformance: **Core**.

#### Static output emission (consumes PRD-105)

**PRD-400-R9.** The generator MUST emit the static file set PRD-105 specifies, parameterized by the configured conformance level:

- **Core:** `/.well-known/act.json`, `/{index_url}`, `/{node_url_template[id=N]}` for every node `N`.
- **Standard:** Core + `/{subtree_url_template[id=N]}` for every advertised subtree-id.
- **Plus:** Standard + `/{index_ndjson_url}` (NDJSON index) + the search advertisement per PRD-105-R7a.

URL paths are derived from the manifest's templates per PRD-105-R1 through PRD-105-R7. The generator MUST emit `Content-Type` metadata per PRD-105-R8 either in a sidecar (e.g., `_headers` for Cloudflare Pages, `_redirects` for Netlify) or in the build report (PRD-400-R27); the actual `Content-Type` header is the CDN's responsibility per PRD-105-R8, but the generator MUST signal the intended type in machine-readable form. Conformance: **Core** (Standard and Plus add their respective files).

**PRD-400-R10.** The generator MUST construct the manifest from observed emissions and configuration, populating at minimum the Core-required fields (PRD-100-R4): `act_version`, `site.name`, `index_url`, `node_url_template`, `conformance.level`, `delivery`. The generator MUST set `delivery: "static"` for static-profile builds (this PRD's primary surface); a runtime-profile manifest is the runtime SDK's concern (PRD-500). The generator MUST NOT populate runtime-only manifest fields per PRD-105-R3. Conformance: **Core**.

**PRD-400-R11.** The generator MUST aggregate per-node summary metadata into the index per PRD-100-R16 / R17. Each index entry MUST carry `id`, `type`, `title`, `summary`, `tokens.summary`, and `etag`. The generator MUST NOT include full `content` arrays in the index per PRD-100-R18. The generator MUST emit a non-empty `summary` per PRD-100-R19; a node whose source produced no summary is a build error (per PRD-105-R15 build-error severity). Conformance: **Core**.

**PRD-400-R12.** When the configured conformance target is Plus, the generator MUST emit an NDJSON index file per PRD-100-R37 / PRD-105-R7. Each line is one `IndexEntry` per `schemas/100/index.schema.json#/$defs/IndexEntry`; the file MUST NOT carry an outer `act_version` or `nodes` wrapper per PRD-100-R37. Each line carries its own `etag` derived per PRD-103-R12. Conformance: **Plus**.

**PRD-400-R13.** When the configured conformance target is Standard or higher AND the manifest advertises `subtree_url_template`, the generator MUST emit a subtree file at the URL produced by substituting each subtree-root id into `subtree_url_template`. The subtree envelope is per PRD-100-R32 / R33 with default depth 3 and maximum 8. The generator MUST emit `truncated: true` when the subtree is elided at the maximum depth per PRD-100-R34. Conformance: **Standard**.

#### i18n handling (Plus, consumes PRD-104)

**PRD-400-R14.** When the configuration declares more than one locale (PRD-400-R31's `i18n.locales`), the generator MUST emit per the layout pattern declared in config:

- **Pattern 1 (locale-prefixed IDs):** one manifest at `/.well-known/act.json` covering all locales; one index at the configured `index_url`; node files at locale-prefixed paths per PRD-104-R5.
- **Pattern 2 (per-locale manifests):** one parent manifest at `/.well-known/act.json` advertising `locales.manifest_url_template`; one per-locale manifest at the substituted URL per PRD-104-R6; one per-locale index and one per-locale node-set per locale.

The generator MUST NOT mix patterns within a single build per PRD-104-R7. The generator threads the active locale into PRD-300-R7's `ExtractionContext.locale` so component-extracted blocks honor the locale. Conformance: **Plus**.

**PRD-400-R15.** Pattern 2 emission: the generator MUST write each per-locale manifest with `site.locale` set to the locale per PRD-104-R6 first bullet. The per-locale manifest's `index_url` and `node_url_template` MUST reflect the per-locale URL prefix (e.g., `/es-ES/act/index.json`). Conformance: **Plus**.

**PRD-400-R16.** Pattern 1 emission: the generator MUST set `metadata.locale` on every emitted node per PRD-104-R5 second bullet. The generator MUST validate ID-locale agreement per PRD-104-R5 third bullet (e.g., an `id` of `en/pricing` MUST carry `metadata.locale` whose primary subtag is `en`). A mismatch is a build error. Conformance: **Plus**.

#### Conformance-level computation (consumes PRD-107)

**PRD-400-R17.** The generator MUST compute the manifest's `conformance.level` from observed artifacts, not from adapter or binding declarations alone:

- **Core** is the floor; every conformant generator output is at least Core.
- **Standard** requires `subtree_url_template` declared AND at least one subtree file emitted.
- **Plus** requires Standard + NDJSON index emitted + (when configured) i18n manifest emitted.

The configuration declares a **target level** (PRD-400-R31's `conformanceTarget`). The generator MUST refuse to emit a manifest claiming a level higher than the observed level. Specifically: if the configuration targets Plus but the build produced no NDJSON file (e.g., because the `index_ndjson_url` was misconfigured), the generator MUST emit `conformance.level: "standard"` (or `"core"`) and surface a build warning. The generator MUST NOT fabricate Plus claims; this is the producer-side analog of PRD-107-R22 (declared vs achieved discrepancy is a validator finding, not a wire-format error, but the generator's job is to emit truthful declarations in the first place). Conformance: **Core**.

#### Capability-flag emission (consumes PRD-200-R23)

**PRD-400-R18.** The generator MUST populate the manifest's `capabilities` object based on what files it actually emitted, not on what adapters declared:

- `capabilities.etag: true` iff every emitted envelope carries a valid `etag` per PRD-103-R2. (Always true for conformant generators; no adapter declaration controls this.)
- `capabilities.subtree: true` iff at least one subtree file was emitted (Standard or higher).
- `capabilities.ndjson_index: true` iff the NDJSON index file was emitted (Plus).
- `capabilities.search.template_advertised: true` iff `search_url_template` is declared in config AND the generator wrote the search-fulfilment artifact per PRD-105-R7a.
- `capabilities.change_feed` reserved per PRD-100-R6; not emitted in v0.1.

Adapter `manifestCapabilities` declarations (PRD-200-R22) are inputs to the configuration step (they inform the generator that an adapter intends to contribute subtree-eligible nodes, for example), but the generator MUST verify the underlying emission before publishing the flag. Capability advertisement without backing emission is a build error. Conformance: **Core**.

#### Mounts (consumes PRD-107-R5, gap C5)

**PRD-400-R19.** When the configuration declares `mounts`, the generator MUST emit them in the parent manifest per PRD-100-R7 / PRD-107-R5. The generator MUST NOT recurse into a mount's manifest (per gap C5; mounts MUST NOT recurse). The static parent manifest's responsibilities — its own index, its own node files — MUST satisfy PRD-105-R1 through PRD-105-R15 regardless of the mounts declared. A mount whose `delivery: "static"` and whose `manifest_url` is within the same `outputDir` MUST itself be emitted by this generator (as a sub-build) or by a separate generator invocation; PRD-400 MUST NOT silently produce a mount target without explicit configuration. Conformance: **Standard**.

#### Generator metadata

**PRD-400-R20.** The generator SHOULD populate the manifest's optional `generator` field (PRD-100-R8) with its own package name and version (e.g., `"@act/astro@0.1.0"`). The generator SHOULD populate `generated_at` with the build's start timestamp in RFC 3339 form. These are observability hints; they do not affect conformance. Conformance: **Core** (SHOULD).

#### Validation before emission

**PRD-400-R21.** The generator MUST validate every envelope against PRD-100's schemas before writing any file. A validation failure MUST cause the build to fail with a non-zero exit code; the generator MUST NOT emit a partial output. Validation failures include: missing required field (PRD-100-R4 / R17 / R21), invalid ID grammar (PRD-100-R10), invalid `etag` shape (PRD-103-R2), `marketing:*` block with invalid suffix (PRD-102-R6), `children`-cycle (PRD-100-R25). Conformance: **Core**.

#### Incremental rebuilds

**PRD-400-R22.** A generator MAY support incremental rebuilds. When supported:

- The generator MUST detect which nodes have changed since the previous build using a stable change-detection mechanism: content-hash-based (input fingerprint), not timestamp-based, in the canonical TS reference impl; spec-only generators (PRD-402, PRD-403) MAY use their host framework's idiomatic detector. Resolved per Open question 2.
- For unchanged nodes, the generator MAY skip re-emitting the node file; the generator MUST still re-emit the index when any node's index-relevant fields (`id`, `type`, `title`, `summary`, `tokens.summary`, `etag`, `parent`, `children`, `tags`) changed, OR when any node was added or removed from the set.
- The index's `etag` MUST be recomputed per PRD-103-R4 whenever any index entry is added, removed, or modified. A stale index ETag with a refreshed node file is a build error.
- The NDJSON index MUST be re-emitted whenever any line changes; partial NDJSON updates are not supported.
- The manifest's `etag` MUST be recomputed on every build (the manifest carries its own ETag per the static recipe applied to its payload-minus-`etag`).

Generators MUST document whether they support incremental rebuilds; PRD-401 / PRD-404 / PRD-405 typically do, PRD-409 (standalone CLI) does not in v0.1. Conformance: **Core** (the rule itself; incremental support is optional).

#### Atomic writes

**PRD-400-R23.** The generator MUST write each output file atomically: write to a temporary path adjacent to the target (e.g., `intro.json.tmp.<pid>`), `fsync`, then rename to the final path. On POSIX, `rename(2)` is atomic within the same filesystem; on Windows, the equivalent is `MoveFileEx` with `MOVEFILE_REPLACE_EXISTING`. The generator MUST NOT leave a half-written index, manifest, or NDJSON file even if the build is interrupted. The atomic-write guarantee applies within the generator's `outputDir`; the deploy step (CDN sync, S3 push) is outside ACT's scope per PRD-105-R12. Conformance: **Core**.

#### Build hooks

**PRD-400-R24.** The generator MUST expose three named hooks at well-defined points in the pipeline:

- `pre-build` — invoked after configuration is resolved and before any adapter `init` runs. Plugin authors use this to register additional source-discovery hints, set up watchers, or prepare host-framework state.
- `post-build` — invoked after every file has been written and the build report (PRD-400-R27) is finalized. Plugin authors use this to invoke downstream tools (validator, deploy, compression).
- `on-error` — invoked when any pipeline stage throws an unrecoverable error. Plugin authors use this for cleanup and for surfacing the error to host-framework error-reporting tooling.

Hooks receive a `BuildContext` (read-only after configuration is resolved) and MAY return a Promise. Hooks MUST NOT mutate the pipeline order or skip stages. A hook that throws causes the build to fail with a non-zero exit code; `on-error` is the only hook permitted to throw without escalating, and even then the generator surfaces the original error preferentially. Conformance: **Core**.

**PRD-400-R25.** The `post-build` hook is the integration point for downstream tools, including the hosted validator (PRD-600 per Q8) and the conformance reporter. The hook surface MUST be generic — PRD-400 MUST NOT special-case the validator. Specifically: the hook receives the `BuildReport` (PRD-400-R27) and the `outputDir` path; it does not receive validator-specific state. The validator (PRD-600) registers as a `post-build` hook via its published interface; it has no privileged access to the pipeline. Conformance: **Core**.

#### Failure-on-extraction-error flag

**PRD-400-R26.** A generator MUST honor an optional `failOnExtractionError` configuration flag (default false). When false, PRD-300-R22 placeholder warnings do not cause a non-zero exit; when true, any placeholder emitted during the component-extraction stage causes the build to exit non-zero after the build report is finalized. The flag does NOT short-circuit the build at the moment of extraction; the generator finishes the pipeline (so that the build report enumerates every placeholder) and then exits non-zero. CI builds SHOULD set the flag to true; local development builds SHOULD leave it false. Conformance: **Standard**.

#### Build report sidecar

**PRD-400-R27.** A generator MUST write a build report sidecar to `outputDir/.act-build-report.json` after every successful build. The build report enumerates every emitted file (path, byte size, ETag, conformance band), every warning, every error, the configured target level, the achieved level (per PRD-400-R17), and the build duration. The schema is fixed in §"Wire format / interface definition." Downstream tools (PRD-600 validator, CI integrations, dashboards) consume the report; the generator MUST NOT include it in the deployable static set (the report is local artifact only and MUST NOT be uploaded to the CDN). Conformance: **Standard**.

#### Test-fixture conformance

**PRD-400-R28.** Every leaf generator (PRD-401–PRD-409) MUST pass the framework conformance fixture corpus enumerated in §"Test fixtures." Conformance is binary: any positive fixture a generator fails to produce equivalent output for, or any negative fixture a generator emits clean output for (when the framework expects a build error or warning), is a conformance violation. PRD-600 (validator) ships the fixture-runner; the framework MAY ship the same runner as a standalone CLI for generator authors' local CI. Conformance: **Core**.

#### Adapter version pinning enforcement (consumes PRD-200-R25 / R26, PRD-108-R14 / R15)

**PRD-400-R29.** **Stage 1 (v0.1, current).** The generator MUST refuse to run any adapter whose declared `act_version` (per PRD-200-R25) does not exactly match the build's target `act_version`. The match is on MAJOR.MINOR; a mismatch is a build error before any adapter `init` runs. The generator surfaces the failing adapter's package name, declared version, and the build's target version. Conformance: **Core**.

**PRD-400-R30.** **Stage 2 (post-ratification).** The generator MUST refuse to run any adapter whose declared `actSpecMinors` array (per PRD-200-R26) does not include the build's target `act_version` MINOR. The check is by string membership; a mismatch is a build error before any adapter `init` runs. Generators MAY support both Stage 1 (pinned) and Stage 2 (range) adapters in the same build, picking per adapter — an adapter that declares `act_version: "0.1"` is checked per Stage 1, and an adapter that declares `actSpecMinors: ["1.0", "1.1"]` is checked per Stage 2. Conformance: **Plus** (Stage 2 is post-ratification per PRD-200-R26).

#### Configuration shape

**PRD-400-R31.** The generator's configuration MUST satisfy the TypeScript interface `GeneratorConfig` defined in §"Wire format / interface definition." At minimum:

- `actVersion`: target spec version (string matching `^[0-9]+\.[0-9]+$`).
- `conformanceTarget`: `"core" | "standard" | "plus"`.
- `outputDir`: filesystem path to write the static file set.
- `baseUrl`: the deployment origin (used for substituting `{id}` into URL templates).
- `adapters`: ordered array of `{ adapter, options }` pairs.
- `bindings`: optional ordered array of `{ binding, options }` pairs.
- `manifest`: object declaring `site.name`, optional `site.canonical_url`, optional `site.locale`, optional `site.license`, optional `policy`.
- `urlTemplates`: object declaring `index_url`, `node_url_template`, optional `subtree_url_template`, optional `index_ndjson_url`, optional `search_url_template`.
- `i18n`: optional object declaring `locales.default`, `locales.available`, `pattern: "1" | "2"`.
- `mounts`: optional array of mount entries per PRD-107-R5.
- `failOnExtractionError`: optional boolean (default false) per PRD-400-R26.
- `incremental`: optional boolean (default true) per PRD-400-R22.

The configuration is the source of `AdapterContext.config` for adapters per PRD-200-R19. Adapter-specific options nest under each adapter's package name. Generators MAY accept additional host-framework-specific configuration; the canonical shape above is the minimum. Conformance: **Core**.

#### Target-level enforcement (consumes PRD-107-R14, PRD-200-R24)

**PRD-400-R32.** When the configuration's `conformanceTarget` exceeds an adapter's declared `level` (PRD-200-R22), the generator MUST refuse to run the adapter and surface a configuration error per PRD-200-R24. When the binding's capability declaration (PRD-300-R28) does not advertise an extraction mode the generator can dispatch (e.g., the binding declares only `headless-render: true` but the configuration disables headless), the generator MUST surface a configuration error before extraction begins. Conformance: **Core**.

#### Spec-only leaf treatment (Q3)

**PRD-400-R33.** PRD-402 (Hugo module) and PRD-403 (MkDocs plugin) are spec-only PRDs per decision Q3; no first-party TypeScript reference impl ships in v0.1. PRD-400's contract applies at the spec level even though no TS impl exists for those leaves: a Hugo module or MkDocs plugin MUST satisfy every requirement in this PRD's Specification section, expressed in equivalent terms in the host language. Specifically: the canonical pipeline order (PRD-400-R1) MUST be honored; the file set (PRD-400-R9) MUST match what a TS impl would produce for the same source corpus; the conformance-level computation (PRD-400-R17) MUST be observed. PRD-600 validates output, not implementation language; a conformant Hugo or MkDocs generator is conformant the same way a conformant Astro plugin is. Bare TypeScript signatures in §"Wire format / interface definition" are normative for TS impls; for non-TS impls, the prose form of each requirement is normative. Conformance: **Core**.

#### Versioned trees (optional, gap E2)

**PRD-400-R34.** A generator MAY emit per-version manifests for sites that publish multiple documentation versions per PRD-105-R16 / gap E2. When supported, the generator emits one manifest per version path (e.g., `/v1/.well-known/act.json`, `/v2/.well-known/act.json`); each per-version manifest satisfies PRD-105 in full. Cross-version references SHOULD use `metadata.supersedes` / `metadata.superseded_by` per PRD-100-R47. PRD-400 does not specify the multi-version layout in detail; the gap E2 resolution is informational for v0.1 and not blocking. Conformance: **Plus** (the scenario is opt-in).

### Wire format / interface definition

There is no JSON wire format introduced by PRD-400 — generators emit existing PRD-100 envelopes. The contract is the TypeScript interface below.

#### `GeneratorPlugin` (the leaf-generator interface)

```ts
/**
 * Every leaf generator (Astro plugin, Docusaurus plugin, etc.) implements this
 * interface. The plugin wraps the framework's `GeneratorRuntime` in
 * host-framework idiom (Astro integration, Docusaurus plugin object, etc.) and
 * provides framework-specific glue for source discovery and lifecycle
 * placement. PRD-400-R3.
 */
export interface GeneratorPlugin {
  /** Stable name; used in build reports and error messages. */
  readonly name: string;

  /** Plugin version; threaded into manifest.generator per PRD-400-R20. */
  readonly version: string;

  /**
   * Resolve the host framework's project root, route enumeration, and
   * configuration. The runtime calls this once at build start.
   */
  resolveHostContext(hostInput: unknown): Promise<HostContext>;

  /** Build hooks per PRD-400-R24. All optional. */
  hooks?: BuildHooks;
}

export interface HostContext {
  /** Filesystem path to the host project root. */
  projectRoot: string;
  /** Routes the host framework knows about (used for component extraction). */
  routes: Array<{ id: string; module: unknown; props: unknown }>;
  /** Host-framework-resolved generator config. Merged with PRD-400-R31 default. */
  generatorConfig: GeneratorConfig;
}
```

#### `GeneratorRuntime` (the framework-supplied pipeline)

```ts
/**
 * The framework's invocation of the canonical pipeline (PRD-400-R1). Plugins
 * do NOT implement this; they construct an instance and call `build`.
 */
export interface GeneratorRuntime {
  /** Run the canonical pipeline end-to-end. */
  build(plugin: GeneratorPlugin, input: BuildInput): Promise<BuildReport>;
}

export interface BuildInput {
  hostContext: HostContext;
  /** Optional override for incremental-rebuild detection state. */
  previousBuildReport?: BuildReport;
  /** Cancellation signal honored by adapters and bindings. */
  signal?: AbortSignal;
}
```

#### `GeneratorConfig` (configuration shape)

```ts
/**
 * Generator configuration. Per PRD-400-R31. Plugins extend with
 * host-framework-specific fields; this is the canonical minimum.
 */
export interface GeneratorConfig {
  actVersion: string;                                    // "0.1"
  conformanceTarget: "core" | "standard" | "plus";
  outputDir: string;
  baseUrl: string;
  adapters: AdapterEntry[];
  bindings?: BindingEntry[];
  manifest: {
    site: {
      name: string;
      canonical_url?: string;
      locale?: string;
      license?: string;
    };
    policy?: Record<string, unknown>;
  };
  urlTemplates: {
    index_url: string;                                    // "/act/index.json"
    node_url_template: string;                            // "/act/n/{id}.json"
    subtree_url_template?: string;                        // "/act/sub/{id}.json"
    index_ndjson_url?: string;                            // "/act/index.ndjson"
    search_url_template?: string;                         // "/act/search?q={query}"
  };
  i18n?: {
    locales: { default: string; available: string[] };
    pattern: "1" | "2";
  };
  mounts?: Array<{
    prefix: string;
    delivery: "static" | "runtime";
    manifest_url: string;
    conformance?: { level: "core" | "standard" | "plus" };
  }>;
  failOnExtractionError?: boolean;                        // default false
  incremental?: boolean;                                  // default true
}

export interface AdapterEntry {
  /** Adapter package import (e.g., the default export of @act/markdown). */
  adapter: import("@act/adapter-framework").Adapter;
  /** Adapter-specific options; passed to adapter.init(config, ctx). */
  options: unknown;
  /** Optional per-adapter merge mode override per PRD-200-R14. */
  merge?: "last-wins" | "error";
}

export interface BindingEntry {
  binding: import("@act/component-contract").ActBinding;
  options?: unknown;
}
```

#### `BuildContext` and `BuildHooks`

```ts
/**
 * Read-only build context surfaced to hooks. Per PRD-400-R24.
 */
export interface BuildContext {
  config: GeneratorConfig;
  hostContext: HostContext;
  outputDir: string;
  /** Mutable build report; hooks MAY read but MUST NOT modify. */
  readonly report: Readonly<BuildReport>;
  /** AbortSignal for build cancellation. */
  signal: AbortSignal;
  /** Logger plumbed from the host framework. */
  logger: Logger;
}

export interface BuildHooks {
  /** Invoked after configuration is resolved; before adapter init. */
  preBuild?(ctx: BuildContext): Promise<void>;
  /** Invoked after every file is written; build report finalized. */
  postBuild?(ctx: BuildContext): Promise<void>;
  /** Invoked when an unrecoverable error occurs in any stage. */
  onError?(ctx: BuildContext, err: Error): Promise<void>;
}
```

#### `BuildReport` (sidecar artifact, PRD-400-R27)

```ts
/**
 * Written to outputDir/.act-build-report.json after every successful build.
 * Per PRD-400-R27. Local artifact; MUST NOT be uploaded to the CDN.
 */
export interface BuildReport {
  generator: { name: string; version: string };
  actVersion: string;
  conformanceTarget: "core" | "standard" | "plus";
  conformanceAchieved: "core" | "standard" | "plus" | null;
  delivery: "static" | "runtime";
  startedAt: string;             // RFC 3339
  completedAt: string;           // RFC 3339
  durationMs: number;
  files: Array<{
    path: string;                // outputDir-relative path
    bytes: number;
    etag: string;                // s256:... per PRD-103-R3
    contentType: string;         // per PRD-105-R8
    band: "core" | "standard" | "plus";
  }>;
  warnings: Array<{
    code: string;
    requirement?: string;        // PRD-NNN-R{n} when applicable
    message: string;
    location?: { adapter?: string; binding?: string; nodeId?: string };
  }>;
  errors: Array<{                // present only on failed builds
    code: string;
    requirement?: string;
    message: string;
    location?: { adapter?: string; binding?: string; nodeId?: string };
  }>;
  capabilities: {
    etag: boolean;
    subtree: boolean;
    ndjson_index: boolean;
    search: { template_advertised: boolean };
  };
  contributors: Array<{
    kind: "adapter" | "binding";
    name: string;
    version?: string;
    declaredLevel: "core" | "standard" | "plus";
    declaredCapabilities: Record<string, unknown>;
  }>;
}
```

#### Pipeline orchestration pseudocode

The framework-supplied invocation (per PRD-400-R1, R2). Leaf generators do not implement this; they construct it.

```ts
async function runPipeline(
  plugin: GeneratorPlugin,
  input: BuildInput,
): Promise<BuildReport> {
  const hostContext = input.hostContext;
  const config = hostContext.generatorConfig;
  const ctx = createBuildContext(plugin, hostContext, config, input.signal);

  // Stage 1: discover sources (validate config, resolve adapters, check pinning)
  enforceAdapterPinning(config);                          // PRD-400-R29 / R30
  enforceTargetLevel(config);                             // PRD-400-R32

  await plugin.hooks?.preBuild?.(ctx);                    // PRD-400-R24

  try {
    // Stage 2: run adapters (PRD-400-R4)
    const adapterContributions = await runAdapters(config.adapters, ctx);

    // Stage 3: run component extractors (PRD-400-R5)
    const bindingContributions = config.bindings
      ? await runBindings(config.bindings, hostContext.routes, ctx)
      : [];

    // Stage 4: merge (PRD-400-R6)
    const merged = mergeContributions(adapterContributions, bindingContributions);

    // Stage 5: normalize / validate (PRD-400-R7 / R21)
    const validated = validateAgainstSchemas(merged, config.actVersion);

    // Stage 6: compute ETags (PRD-400-R8)
    const withEtags = computeEtags(validated);

    // Stage 7: emit files (PRD-400-R9 / R23)
    const files = await emitStaticFileSet(withEtags, config);

    // Compute achieved level and capabilities from observed emissions
    ctx.report.conformanceAchieved = computeAchievedLevel(files, config);  // PRD-400-R17
    ctx.report.capabilities = computeCapabilityFlags(files, config);       // PRD-400-R18

    await writeBuildReport(ctx, files);                                    // PRD-400-R27
    await plugin.hooks?.postBuild?.(ctx);                                  // PRD-400-R24 / R25

    if (config.failOnExtractionError && ctx.report.warnings.some(w => w.code === "extraction_failed")) {
      process.exit(1);                                                     // PRD-400-R26
    }
    return ctx.report;
  } catch (err) {
    await plugin.hooks?.onError?.(ctx, err as Error);                      // PRD-400-R24
    throw err;
  }
}
```

The merge step (PRD-400-R6) calls `mergeContributions`, which composes PRD-200-R12's adapter merge with the component-extracted contributions per PRD-300-R11's collision rule. PRD-400 does not redefine the merge algorithm; PRD-200 owns it.

### Errors

The generator surfaces errors along the same two axes as PRD-200 and PRD-300 — recoverable (warning, build continues) and unrecoverable (build fails with non-zero exit). The build report (PRD-400-R27) enumerates both. The table below pins generator-specific contracts.

| Condition | Generator behavior | Build report severity | Exit code |
|---|---|---|---|
| Configuration invalid (missing `outputDir`, malformed `urlTemplates`, etc.) | Fail before any pipeline stage | error | non-zero |
| Adapter declared `act_version` doesn't match target (Stage 1) | Refuse to run; surface adapter package + version | error | non-zero |
| Adapter declared `actSpecMinors` doesn't include target MINOR (Stage 2) | Refuse to run | error | non-zero |
| Adapter declared `level` below `conformanceTarget` | Refuse to run per PRD-200-R24 | error | non-zero |
| Adapter `init` rejects | Surface adapter error per PRD-200-R18 | error | non-zero |
| Adapter `transform` throws | Surface adapter error per PRD-200-R18 | error | non-zero |
| Adapter emits node missing required fields | Caught at validation stage per PRD-400-R7 | error | non-zero |
| Adapter emits node with invalid ID grammar | Caught at validation stage | error | non-zero |
| Adapter emits node with `metadata.extraction_status: "partial"` | Collected; build continues per PRD-200-R16 | warning | 0 |
| Component extraction throws | Binding emits placeholder per PRD-300-R22 | warning | 0 (or non-zero with `failOnExtractionError`) |
| Page-level ID collision (component-extracted vs adapter-extracted, PRD-300-R11) | Hard build error | error | non-zero |
| Adapter-merge collision with `merge: "error"` | Hard build error per PRD-200-R14 | error | non-zero |
| Manifest declares `conformance.level: "plus"` but no NDJSON file emitted | Generator downgrades to achieved level per PRD-400-R17 | warning | 0 |
| Capability advertised without backing emission (e.g., `subtree: true` but no subtree files) | Hard build error per PRD-400-R18 | error | non-zero |
| Pattern 1 / Pattern 2 i18n config mixed | Hard build error per PRD-104-R7 / PRD-400-R14 | error | non-zero |
| Pattern 1 ID-locale mismatch | Hard build error per PRD-400-R16 | error | non-zero |
| Schema validation failure on any envelope | Hard build error per PRD-400-R7 / R21 | error | non-zero |
| Atomic write fails (disk full, permission denied) | Hard build error; clean up tmp files | error | non-zero |
| Build interrupted (SIGINT, AbortSignal) | Clean up tmp files; do not leave half-written outputs | error | non-zero (or signal-specific) |
| Build report write fails | Hard build error (the report itself is part of the build's success criteria) | error | non-zero |
| Static manifest with runtime-only fields (PRD-105-R3) | Hard build error before write | error | non-zero |

The wire-format shape of build errors and warnings — how the generator surfaces them to the user beyond the build report (CLI output, JSON stream to a CI logger) — is plugin-specific. PRD-400 specifies only the build-report shape (PRD-400-R27) and the severity contract above.

---

## Examples

Worked examples are non-normative but MUST be consistent with the Specification section. Each maps to one or more positive fixtures under `fixtures/400/positive/`.

### Example 1 — Minimum Core static build (single-adapter, single-locale)

A documentation site uses the markdown adapter (PRD-201) with the standalone CLI (PRD-409). Configuration:

```ts
const config: GeneratorConfig = {
  actVersion: "0.1",
  conformanceTarget: "core",
  outputDir: "./dist",
  baseUrl: "https://acme.com",
  adapters: [
    { adapter: markdownAdapter, options: { sourceDir: "./docs" } },
  ],
  manifest: {
    site: { name: "Acme Tiny Docs" },
  },
  urlTemplates: {
    index_url: "/act/index.json",
    node_url_template: "/act/n/{id}.json",
  },
};
```

The pipeline runs:

1. Discover: resolves the markdown adapter; checks `act_version: "0.1"` matches the adapter's pin (PRD-400-R29). Pass.
2. Adapters: invokes `markdownAdapter.init` → enumerate three markdown files → transform each into a `Node` (PRD-200-R5).
3. (No bindings configured, so component-extraction stage is skipped.)
4. Merge: three nodes, no collisions; provenance stamped per PRD-200-R13.
5. Validate: every node passes `schemas/100/node.schema.json`; the synthesized index passes `schemas/100/index.schema.json`.
6. ETags: computed per PRD-103-R4 over each envelope's payload-minus-`etag`.
7. Emit: writes `/.well-known/act.json`, `/act/index.json`, three node files at `/act/n/<id>.json`.

Achieved level: Core. Capabilities advertised: `etag: true` (the only Core flag).

Build report (excerpt, written to `./dist/.act-build-report.json`):

```json
{
  "generator": { "name": "@act/cli", "version": "0.1.0" },
  "actVersion": "0.1",
  "conformanceTarget": "core",
  "conformanceAchieved": "core",
  "delivery": "static",
  "files": [
    { "path": ".well-known/act.json", "bytes": 247, "etag": "s256:abc1234567890123456789", "contentType": "application/act-manifest+json; profile=static", "band": "core" },
    { "path": "act/index.json", "bytes": 1854, "etag": "s256:def1234567890123456789", "contentType": "application/act-index+json", "band": "core" },
    { "path": "act/n/intro.json", "bytes": 4120, "etag": "s256:ghi1234567890123456789", "contentType": "application/act-node+json", "band": "core" }
  ],
  "warnings": [],
  "errors": [],
  "capabilities": { "etag": true, "subtree": false, "ndjson_index": false, "search": { "template_advertised": false } }
}
```

Maps to `fixtures/400/positive/minimum-core-single-adapter.json`.

### Example 2 — Plus build composing CMS + i18n + components (corporate marketing composite, draft §6.5 / §8.4)

The canonical Plus deployment from PRD-105 Example 2 is the composite. Configuration:

```ts
const config: GeneratorConfig = {
  actVersion: "0.1",
  conformanceTarget: "plus",
  outputDir: "./dist",
  baseUrl: "https://acme.com",
  adapters: [
    { adapter: contentfulAdapter, options: { spaceId: "...", accessToken: "..." } },
    { adapter: i18nAdapter,       options: { catalogue: "./messages" }, merge: "last-wins" },
  ],
  bindings: [
    { binding: reactBinding, options: {} },
  ],
  manifest: {
    site: { name: "Acme", locale: "en-US", canonical_url: "https://acme.com" },
  },
  urlTemplates: {
    index_url: "/act/index.json",
    node_url_template: "/act/n/{id}.json",
    subtree_url_template: "/act/sub/{id}.json",
    index_ndjson_url: "/act/index.ndjson",
    search_url_template: "/act/search?q={query}&locale={locale}",
  },
  i18n: {
    locales: { default: "en-US", available: ["en-US", "es-ES", "de-DE", "ja-JP"] },
    pattern: "2",
  },
};
```

The pipeline runs:

1. Discover: resolves Contentful, i18n, and React binding; all pinned to `act_version: "0.1"`.
2. Adapters: Contentful enumerates pages → transforms; i18n enumerates message catalogues → transforms partial nodes per PRD-200 Snippet 5.
3. Bindings: React binding's `extractRoute` walks each route's SSR tree, collecting component contracts per PRD-300-R9. Per locale (Pattern 2), the binding is invoked four times per route — once per locale — with `ctx.locale` set.
4. Merge: Contentful + i18n merge per PRD-200-R12 (i18n is `precedence: "fallback"`); component-extracted nodes pool alongside adapter-merged nodes; collisions are page-level errors per PRD-300-R11.
5. Validate: every envelope passes PRD-100 schemas; every locale-prefixed ID per Pattern 1 (if configured) is validated for ID-locale agreement per PRD-400-R16. Pattern 2 in this example: nothing prefixed; per-locale manifests carry the locale.
6. ETags: computed per locale.
7. Emit: writes the parent manifest at `/.well-known/act.json`; per-locale manifests at `/{locale}/.well-known/act.json`; per-locale indexes; per-locale node files; per-locale NDJSON.

Achieved level: Plus. Capabilities advertised: `etag: true`, `subtree: true`, `ndjson_index: true`, `search.template_advertised: true`.

The build report enumerates 4 locales × ~40 pages = ~160 nodes + 4 indexes + 4 NDJSON + 4 manifests + 1 parent manifest. Total ~175 files across all bands.

Maps to `fixtures/400/positive/plus-composite-corporate-marketing.json`.

### Example 3 — Capability-flag emission discrepancy (negative)

A configuration declares `conformanceTarget: "plus"` and advertises `index_ndjson_url`, but the markdown adapter doesn't emit NDJSON-compatible content (the field name is misconfigured in the adapter). The build's emit stage writes the JSON index but not the NDJSON file.

Per PRD-400-R17, the generator computes `conformanceAchieved` from observed emissions. Since no NDJSON file was written, the achieved level is Standard (or Core). Per PRD-400-R18, the generator MUST NOT emit `capabilities.ndjson_index: true`.

The build report shows:

```json
{
  "conformanceTarget": "plus",
  "conformanceAchieved": "standard",
  "warnings": [
    {
      "code": "level_downgraded",
      "requirement": "PRD-400-R17",
      "message": "conformanceTarget: plus but achieved: standard. Plus requires NDJSON index emission; no NDJSON file was written. Either fix the adapter configuration or lower the target."
    }
  ],
  "capabilities": { "etag": true, "subtree": true, "ndjson_index": false, "search": { "template_advertised": false } }
}
```

The build exits 0 (the warning is non-fatal) but the manifest declares `conformance.level: "standard"`, not `"plus"`. This is the producer-side analog of PRD-107-R22's declared-vs-achieved discrepancy.

Maps to `fixtures/400/negative/capability-advertised-without-files.json`.

### Example 4 — Adapter pinning enforcement (Stage 2)

A build targets `act_version: "1.1"`. The adapter list includes:

```ts
adapters: [
  { adapter: contentfulAdapter, options: {/* ... */} },   // declares actSpecMinors: ["1.0", "1.1"]
  { adapter: legacyAdapter,     options: {/* ... */} },   // declares act_version: "1.0" (Stage 1 pinning)
],
```

Per PRD-400-R30, `contentfulAdapter` passes the Stage 2 check (`"1.1"` is in its declared minors). Per PRD-400-R29, `legacyAdapter` fails the Stage 1 check (its single declared version is `"1.0"`, not `"1.1"`). The build fails before any adapter `init` runs:

```
error: PRD-400-R29: adapter 'legacyAdapter@0.3.0' declares act_version: "1.0" but build targets "1.1".
       Upgrade the adapter or downgrade the build target.
```

Maps to `fixtures/400/negative/adapter-pinning-stage-1-mismatch.json`.

### Example 5 — Incremental rebuild (positive)

The generator stores a previous build report at `./dist/.act-build-report.json`. On the next build, the configuration is unchanged but one source markdown file's content changed.

The generator compares input fingerprints (content hashing per PRD-400-R22, resolved per Open question 2). One adapter contribution differs from the previous build's record. The pipeline:

1. Discover: same configuration; pinning checks pass.
2. Adapters: full enumerate (adapters always enumerate; their `delta(since)` hook would let the generator skip enumeration entirely, but the markdown adapter doesn't declare `delta` capability in v0.1).
3. Validate: only the changed node is recomputed; unchanged nodes' ETags are still valid (PRD-103 derivation is deterministic).
4. ETags: only the changed node's ETag changes; the index entry for that node also changes (its `etag` field updates), so the index's overall ETag changes.
5. Emit: write only the changed node file and the new index. The other ~40 node files are not re-written; their ETags didn't change.

The build report reflects only the changed file; the others are listed but marked unchanged. Per PRD-400-R22, the index ETag invalidates whenever any index entry changes — even just one — so the index file is always re-emitted.

Maps to `fixtures/400/positive/incremental-rebuild-single-node-change.json`.

### Example 6 — Atomic write contract (positive)

The generator's `emitStaticFileSet` stage writes `./dist/act/index.json` by:

1. Compute the canonical JSON bytes.
2. Open `./dist/act/index.json.tmp.<pid>` for write.
3. Write bytes; `fsync`.
4. `rename(2)` to `./dist/act/index.json`.

If the build is interrupted between steps 2 and 4, the tmp file remains but the real `index.json` is unchanged from the previous build (or absent on first build). At no point is the consumer-visible `index.json` half-written. The clean-up step in `on-error` removes any lingering tmp files.

Maps to `fixtures/400/positive/atomic-write-interrupt-recovery.json` (the fixture is a behavioral spec, not a wire output).

### Example 7 — Hugo / MkDocs spec-only equivalence (PRD-402, PRD-403, R33)

A Hugo module implementing PRD-400 is not written in TypeScript; it's written in Go. The module:

- Reads its configuration from `config.toml` or `hugo.toml`'s `[params.act]` namespace, marshalling into a Go struct equivalent to `GeneratorConfig`.
- Implements the canonical pipeline (PRD-400-R1) using Hugo's content lifecycle: source discovery via Hugo's bundle resolver; "adapter" stage absorbed into Hugo's existing markdown processing; component extraction is N/A for Hugo (no React); merge step is trivial (single source); normalize/validate via a Go JSON Schema library; ETag derivation per PRD-103-R4 (Go's `crypto/sha256` and base64 encoding); atomic write via `os.Rename` after `os.WriteFile` to a tmp path.
- Emits the same file set a TypeScript reference impl would produce for an equivalent source corpus.
- Writes the build report at `./public/.act-build-report.json` matching the schema in §"Wire format / interface definition."

The spec is the contract; the language is implementation detail. PRD-600 validates the output bytes; the validator does not inspect the implementation. A conformant Hugo module passes the same `fixtures/400/` corpus as a conformant Astro plugin.

PRD-402 (Hugo) and PRD-403 (MkDocs) are spec-only PRDs in v0.1 per Q3; they describe equivalent behavior but no first-party implementation ships. Community implementations are invited.

---

## Test fixtures

Fixtures live under `fixtures/400/`. Each leaf generator (PRD-401–PRD-409) MUST produce equivalent output for every positive fixture and MUST surface the documented error / warning for every negative fixture. PRD-600 (validator) ships the fixture-runner.

Fixtures are tuples of `(source corpus, expected output tree)`. The source corpus is a synthetic input set (markdown files, mock CMS responses, mock route enumeration). The expected output tree enumerates every emitted file with its byte-equivalent content (modulo `generated_at` timestamps, which the runner normalizes). PRD-400 enumerates the layout below; fixture files are NOT created in this PRD.

### Positive

- `fixtures/400/positive/minimum-core-single-adapter/` → satisfies R1, R2, R7, R8, R9, R10, R11, R17, R18, R20, R21, R23. Three markdown files, single adapter, Core target, no bindings.
- `fixtures/400/positive/standard-with-subtree/` → satisfies R13. Same source, Standard target, advertises `subtree_url_template`, emits subtree files for two subtree-roots.
- `fixtures/400/positive/plus-with-ndjson-and-search/` → satisfies R12, R18 (Plus). Plus target; emits NDJSON index; advertises search.
- `fixtures/400/positive/multi-adapter-cms-plus-i18n/` → satisfies R4, R6 (composing PRD-200-R12 and partial-merge). Two adapters; `merge: "last-wins"`; provenance stamped.
- `fixtures/400/positive/component-extraction-react/` → satisfies R5, R6. React binding; mock route enumeration; component contracts emit `marketing:hero` and `marketing:pricing-table` blocks.
- `fixtures/400/positive/i18n-pattern-1/` → satisfies R14, R16. Two locales; Pattern 1 (locale-prefixed IDs); single manifest.
- `fixtures/400/positive/i18n-pattern-2/` → satisfies R14, R15. Two locales; Pattern 2 (per-locale manifests); parent + per-locale manifests.
- `fixtures/400/positive/conformance-level-computation/` → satisfies R17. Mixed-capability adapter set; achieved level computed from observed emissions.
- `fixtures/400/positive/capability-flag-emission/` → satisfies R18. Generator advertises only flags backed by emission; adapter declarations cross-checked against emitted files.
- `fixtures/400/positive/mounts-static-static/` → satisfies R19. Parent manifest declares one static mount; both manifests (parent + mount) satisfy PRD-105 in full.
- `fixtures/400/positive/build-hooks-pre-post-on-error/` → satisfies R24, R25. Plugin registers all three hooks; build report records hook invocations.
- `fixtures/400/positive/incremental-rebuild-single-node-change/` → satisfies R22. Two-run sequence; second run re-emits one node + the index.
- `fixtures/400/positive/incremental-rebuild-no-changes/` → satisfies R22. Second run is a no-op; build report shows zero file changes.
- `fixtures/400/positive/atomic-write-interrupt-recovery/` → satisfies R23. Behavioral fixture; runner injects a SIGTERM mid-write and asserts the previous index is intact.
- `fixtures/400/positive/build-report-shape/` → satisfies R27. Asserts the build report at `outputDir/.act-build-report.json` matches the schema.
- `fixtures/400/positive/fail-on-extraction-error-true/` → satisfies R26 (positive: a clean build with no placeholders exits 0 even when the flag is true).
- `fixtures/400/positive/fail-on-extraction-error-false-with-placeholders/` → satisfies R26 (positive: placeholders are emitted, build exits 0 because flag is false).
- `fixtures/400/positive/adapter-pinning-stage-1-match/` → satisfies R29. Adapter declares `act_version: "0.1"`; build targets `0.1`; runs.
- `fixtures/400/positive/adapter-pinning-stage-2-match/` → satisfies R30. Adapter declares `actSpecMinors: ["1.0", "1.1"]`; build targets `1.1`; runs.
- `fixtures/400/positive/target-level-enforcement-success/` → satisfies R32. Configuration's target equals or below adapter's declared level; runs.
- `fixtures/400/positive/spec-only-equivalence-hugo/` → satisfies R33. Equivalence harness: a TS reference output and a hand-authored Hugo-equivalent output, both passing PRD-600 against the same source corpus.
- `fixtures/400/positive/versioned-trees-multi-version/` → satisfies R34. Two-version manifest set under `/v1/.well-known/act.json` and `/v2/.well-known/act.json`.

### Negative

- `fixtures/400/negative/capability-advertised-without-files/` → MUST fail. Manifest declares `capabilities.subtree: true` but no subtree files exist. PRD-400-R18.
- `fixtures/400/negative/level-claimed-above-achieved/` → MUST fail OR downgrade with warning per R17. Configuration targets Plus; no NDJSON emitted; generator downgrades and warns.
- `fixtures/400/negative/incremental-stale-index/` → MUST fail. Generator skips index re-emission after a node changed; runner detects mismatch between node ETag and index entry's `etag` field.
- `fixtures/400/negative/atomic-write-half-written-index/` → MUST fail. Runner injects a write failure; index file is NOT replaced (the previous valid index remains); the build exits non-zero. PRD-400-R23.
- `fixtures/400/negative/schema-validation-fails/` → MUST fail. Adapter emits a node missing `tokens.summary`; generator's validation stage rejects per PRD-100-R21. PRD-400-R7 / R21.
- `fixtures/400/negative/etag-mismatch-with-envelope/` → MUST fail. Generator's emit stage writes a node whose `ETag` HTTP header (per PRD-105-R10) differs from the envelope's `etag` field. PRD-105-R8 / R10.
- `fixtures/400/negative/adapter-pinning-stage-1-mismatch/` → MUST fail. Adapter declares `act_version: "1.0"`; build targets `1.1`. PRD-400-R29.
- `fixtures/400/negative/adapter-pinning-stage-2-out-of-range/` → MUST fail. Adapter declares `actSpecMinors: ["1.0"]`; build targets `1.1`. PRD-400-R30.
- `fixtures/400/negative/adapter-level-below-target/` → MUST fail. Adapter declares `level: "core"`; configuration targets Plus. PRD-400-R32.
- `fixtures/400/negative/i18n-mixed-patterns/` → MUST fail. Configuration sets `pattern: "1"` but supplies `manifest_url_template`. PRD-104-R7 / PRD-400-R14.
- `fixtures/400/negative/i18n-pattern-1-locale-id-mismatch/` → MUST fail. Pattern 1 ID `en/pricing` but the node's `metadata.locale: "es-ES"`. PRD-400-R16.
- `fixtures/400/negative/component-extracted-id-collides-with-adapter/` → MUST fail. Page-level component contract emits `id: "pricing"`; CMS adapter emits a node with the same ID. PRD-300-R11 / PRD-400-R6.
- `fixtures/400/negative/runtime-only-fields-in-static-manifest/` → MUST fail. Manifest declares `delivery: "static"` but populates `auth.schemes`. PRD-105-R3.
- `fixtures/400/negative/build-interrupted-leaves-tmp-files/` → MUST recover. Build is interrupted; runner re-runs and asserts no `.tmp.*` files remain. PRD-400-R23.
- `fixtures/400/negative/post-build-hook-throws/` → MUST fail. A registered `post-build` hook throws; the build exits non-zero AFTER the build report is finalized (the hook runs after emit, so files are on disk; the exit code reflects the hook failure). PRD-400-R24.
- `fixtures/400/negative/manifest-missing-required-field/` → MUST fail. Configuration omits `manifest.site.name`; generator's normalize stage rejects per PRD-100-R4. PRD-400-R10.
- `fixtures/400/negative/mounts-recursive/` → MUST fail. A mount's manifest declares its own `mounts`. PRD-100-R7 / gap C5 (mounts MUST NOT recurse).

---

## Versioning & compatibility

Per PRD-108, classify each kind of change to PRD-400 as MAJOR or MINOR.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add an optional field to `GeneratorConfig` (e.g., `assetsDir` for non-ACT static assets) | MINOR | PRD-108-R4(1). Existing configs unaffected. |
| Add a required field to `GeneratorConfig` | MAJOR | PRD-108-R5(1). All existing configs become non-conformant. |
| Add an optional method to `GeneratorPlugin` (e.g., `validateHostContext`) | MINOR | PRD-108-R4(1). Existing plugins do not implement it. |
| Add a required method to `GeneratorPlugin` | MAJOR | PRD-108-R5(1). |
| Add a new build hook (e.g., `pre-emit` between validate and write; deferred to v0.2 per Open question 1) | MINOR | PRD-108-R4(1). The hook surface is documented-open. |
| Reorder the canonical pipeline (R1) — e.g., run extractors before adapters | MAJOR | PRD-108-R5(7) (reordering documented procedure). |
| Add a stage to the canonical pipeline (e.g., a `transform-final` stage between merge and validate) | MAJOR | Affects every plugin's expectation. |
| Add an optional capability to the build report (e.g., `bytesPerLevel` aggregates) | MINOR | PRD-108-R4(1). Consumers tolerate. |
| Change the build-report file path from `.act-build-report.json` | MAJOR | PRD-108-R5(6). Tooling consumes the path. |
| Change the build-report schema (rename a field, change a type) | MAJOR | PRD-108-R5(2). |
| Add a new conformance-target value (e.g., `"plus-experimental"`) | MAJOR | Mirrors PRD-107's closed-enum rule. |
| Tighten `failOnExtractionError` default from false to true | MAJOR | PRD-108-R5(3). |
| Change atomic-write semantics (e.g., drop the `fsync` requirement) | MAJOR | Consumers depend on the atomicity guarantee. |
| Promote spec-only treatment for PRD-402 / PRD-403 to "first-party TS impl required" | MAJOR | Reverses Q3; affects the entire 40x branch. |
| Promote `--fail-on-extraction-error` from optional flag to default behavior | MAJOR | PRD-108-R5(3). |
| Add a new severity to the build-report taxonomy (currently `warning` and `error`) | MINOR | New optional severity; consumers tolerate. |
| Add a fixture row to the conformance corpus | MINOR | Per PRD-200's pattern; new positive or negative fixture is additive. |
| Change the adapter-pinning enforcement from refusal to warn | MAJOR | PRD-108-R5(3); loosening a MUST. |
| Change the canonical incremental change-detection mechanism from content-hash to mtime | MAJOR | Producers may have built tooling around the hash. |

### Forward compatibility

A generator implementing PRD-400 v0.1 MUST tolerate `GeneratorConfig` fields it does not recognize (per PRD-108-R7). A plugin implementing PRD-400 v0.1 MUST tolerate `BuildContext` fields it does not read. Both directions are additive within a MAJOR.

The build-report schema is documented-open: consumers tolerate unknown optional fields. Closed enums (`conformanceTarget`, `band`, `delivery`) follow PRD-108-R8; an unknown enum value is a parser-side rejection.

### Backward compatibility

A v0.1 generator package runs against a v0.2 framework provided no MAJOR change has been made to the `GeneratorPlugin` interface, the canonical pipeline order, the build-report schema, or the configuration shape. Adding optional fields, optional hooks, or new severity codes is non-breaking.

For Stage 2 adapter pinning (PRD-400-R30), a single generator version may target multiple spec MINORs by passing the appropriate `actVersion` in `GeneratorConfig`; the generator itself does not need to be re-released for each spec MINOR within the supported MAJOR. Per-package `actSpecMinors` is the adapter's responsibility, not the generator's.

---

## Security considerations

This section cites PRD-109 (Accepted) for the project-wide threat model and documents only generator-specific deltas.

**Build-process trust boundary.** The generator runs in the build process. Adapters, bindings, and plugins are all trusted code per PRD-200's Security section and PRD-300-R32; the generator does not sandbox any of them (per gap D3). The trust boundary is the build-input layer: the generator's configuration (`GeneratorConfig`) is authored by the build operator; the source corpus is authored by content authors. A hostile content author cannot escalate to arbitrary code execution because adapters and bindings constrain extraction (PRD-200-R5, PRD-300-R7). A hostile adapter or binding package can do anything the build process can do; PRD-109 documents this.

**Secret-handling discipline.** The generator's configuration (`GeneratorConfig`) commonly contains adapter-specific credentials (CMS API tokens, Sanity project IDs, service-account JSON paths). The generator MUST treat the configuration as sensitive: it MUST NOT log credentials in the build report, MUST NOT embed credentials in any emitted envelope (per PRD-109-R14 / R15), MUST NOT include credentials in `metadata.source.*` fields. The generator SHOULD redact known-secret-shaped strings (`Bearer `, `sk_live_`, `AKIA[A-Z0-9]+`, `ya29.`, JWT-like `eyJ.*\\..*\\..*`) from log output and the build report's free-form message strings. PRD-200-R Security section already requires this for adapters; PRD-400 reiterates it for the generator-supplied surfaces.

**Output-directory permissions.** The generator writes to `outputDir`. The atomic-write contract (PRD-400-R23) implies the directory must be writable by the build process. The generator MUST NOT change permissions on existing files in `outputDir` (e.g., via `chmod`); it overwrites contents only. The generator MUST NOT write outside `outputDir` (no `..` traversal in node IDs reaches the filesystem, because the ID grammar — PRD-100-R10 — forbids `..` and the generator validates IDs before substituting into URL templates per PRD-100-R12, then applies normal filesystem-path joining). A configuration whose `outputDir` is `/` or another protected path is rejected at config validation per PRD-400-R31 (the generator MAY refuse `outputDir` paths that don't appear to be inside the project root).

**Build report as observability artifact, not security artifact.** The build report (PRD-400-R27) is a local artifact for CI integrations and downstream tooling. It MUST NOT contain credentials (per "Secret-handling discipline" above). It MAY contain file paths under `outputDir`, file sizes, and ETags; none of these leak operator secrets. PRD-400 explicitly forbids uploading the build report to the CDN — the local sidecar is for the build operator, not for ACT consumers.

**Component-extraction safety.** Per gap D3 / PRD-300-R32, `extract` runs in the build process's main JS context with no sandbox. PRD-400 inherits this stance: the generator does NOT sandbox component extraction. A malicious or buggy contract can read process state, exfiltrate via network, or crash the build. The placeholder-block fallback (PRD-300-R22) limits one cause of crashes (extract-throws) but does not contain a malicious contract. Sandbox is a v0.2 question.

**ID-grammar enforcement at the generator layer.** Adapters MUST validate emitted IDs per PRD-100-R10 (PRD-200's responsibility). The generator MUST re-validate at the normalize/validate stage (PRD-400-R7); a defense-in-depth check ensures that an adapter that bypasses its own validation cannot reach the file-emission stage with a path-traversal-shaped ID. The grammar itself forbids `..`, leading slashes, and uppercase, so the URL-substitution-to-filesystem-path step (PRD-100-R12) is path-safe by construction.

**Adapter pinning as a security control.** PRD-400-R29 / R30 enforce PRD-200's pinning regime. A generator MUST refuse adapters whose declared `act_version` (Stage 1) or `actSpecMinors` (Stage 2) does not include the build's target. This prevents a "forgotten adapter" from silently emitting outdated envelope shapes that consumers might misinterpret. Cross-references PRD-108-R10 (silent MAJOR downgrade is forbidden).

**Build report write fails leave atomic-write tmp files behind.** Per PRD-400-R23, the generator writes via tmp-then-rename. If the build is interrupted between the tmp-write and the rename, tmp files remain in `outputDir`. The on-error hook (PRD-400-R24) MUST clean these up; if cleanup itself fails, the build operator may need to manually remove `*.tmp.*` files before the next build. PRD-400 documents this limitation; the alternative (committing unwritten content) is worse.

For all other concerns — auth-scheme negotiation (N/A for static profile), ETag determinism (delegated to PRD-103), cross-origin trust (N/A for the generator; consumer-side per PRD-109-R21), PII in error messages (delegated to PRD-109-R14 / R15) — cite PRD-109 directly. PRD-400 introduces no new transport surface and relies entirely on the wire-format and runtime PRDs for those rules.

---

## Implementation notes

This section is required for SDK / framework / generator PRDs per the workflow.md Phase 3 addition. Snippets show the canonical TypeScript shape; full implementations live in the package repos under `packages/generator-runtime/` and the leaf generator packages.

### Snippet 1 — The canonical pipeline orchestration

```ts
// packages/generator-runtime/src/pipeline.ts

export async function runPipeline(
  plugin: GeneratorPlugin,
  input: BuildInput,
): Promise<BuildReport> {
  const ctx = createBuildContext(plugin, input);

  // Stage 1: discover sources + enforce pinning before any adapter init.
  // PRD-400-R29 / R30 / R32.
  enforceAdapterPinning(ctx.config);
  enforceTargetLevel(ctx.config);

  await plugin.hooks?.preBuild?.(ctx);

  try {
    // Stage 2: run adapters per PRD-200 lifecycle.
    const adapterContribs = await runAdapters(ctx.config.adapters, ctx);

    // Stage 3: run component extractors per PRD-300.
    const bindingContribs = ctx.config.bindings
      ? await runBindings(ctx.config.bindings, ctx.hostContext.routes, ctx)
      : [];

    // Stage 4: merge per PRD-200-R12 + PRD-300-R11.
    const merged = mergeContributions(adapterContribs, bindingContribs);

    // Stage 5: validate envelopes against PRD-100 schemas.
    const validated = validateAgainstSchemas(merged, ctx.config);

    // Stage 6: compute ETags per PRD-103-R4.
    const withEtags = computeEtags(validated);

    // Stage 7: emit files atomically per PRD-105 layout + PRD-400-R23.
    const files = await emitStaticFileSet(withEtags, ctx);

    // Synthesize achieved level + capability flags from observed emissions.
    ctx.report.conformanceAchieved = computeAchievedLevel(files, ctx.config);
    ctx.report.capabilities = computeCapabilityFlags(files, ctx.config);

    await writeBuildReport(ctx, files);
    await plugin.hooks?.postBuild?.(ctx);

    if (ctx.config.failOnExtractionError && hasExtractionPlaceholders(ctx.report)) {
      process.exitCode = 1;
    }
    return ctx.report;
  } catch (err) {
    await plugin.hooks?.onError?.(ctx, err as Error);
    throw err;
  }
}
```

### Snippet 2 — The `GeneratorPlugin` interface, full signature

```ts
// packages/generator-runtime/src/types.ts

export interface GeneratorPlugin {
  readonly name: string;
  readonly version: string;
  resolveHostContext(hostInput: unknown): Promise<HostContext>;
  hooks?: BuildHooks;
}

export interface BuildHooks {
  preBuild?(ctx: BuildContext): Promise<void>;
  postBuild?(ctx: BuildContext): Promise<void>;
  onError?(ctx: BuildContext, err: Error): Promise<void>;
}
```

### Snippet 3 — An Astro-style plugin sketch (PRD-401's surface, illustrative)

```ts
// packages/astro-plugin/src/index.ts (sketch only; full impl lives in PRD-401)

import type { AstroIntegration } from "astro";
import { runPipeline } from "@act/generator-runtime";
import type { GeneratorPlugin } from "@act/generator-runtime";

export function actAstroPlugin(userOptions: ActAstroOptions): AstroIntegration {
  const plugin: GeneratorPlugin = {
    name: "@act/astro",
    version: "0.1.0",
    async resolveHostContext(astroBuildInput) {
      // Inspect Astro's build input: project root, route enumeration, content collections.
      return {
        projectRoot: astroBuildInput.config.root.pathname,
        routes: astroBuildInput.routes.map(r => ({ id: r.route, module: r.component, props: undefined })),
        generatorConfig: mergeWithDefaults(userOptions, astroBuildInput),
      };
    },
    hooks: {
      async postBuild(ctx) {
        ctx.logger.info(`ACT build complete: ${ctx.report.files.length} files, achieved ${ctx.report.conformanceAchieved}`);
      },
    },
  };

  return {
    name: "@act/astro",
    hooks: {
      "astro:build:done": async (astroBuildInput) => {
        const hostContext = await plugin.resolveHostContext(astroBuildInput);
        await runPipeline(plugin, { hostContext, signal: undefined });
      },
    },
  };
}
```

The shape above sketches how an Astro integration wraps the generator runtime; PRD-401 owns the complete contract. Note the plugin is intentionally thin: it threads Astro's build input through `resolveHostContext` and lets `runPipeline` do the actual work.

### Snippet 4 — Capability-flag computation from observed emissions

```ts
// packages/generator-runtime/src/capabilities.ts
// PRD-400-R18.

export function computeCapabilityFlags(
  files: EmittedFile[],
  config: GeneratorConfig,
): BuildReport["capabilities"] {
  const has = (substr: string) => files.some(f => f.path.includes(substr));
  return {
    etag: files.every(f => /^s256:[A-Za-z0-9_-]{22}$/.test(f.etag)),  // PRD-103-R3
    subtree: has("/sub/"),                                              // observed subtree files
    ndjson_index: has(".ndjson"),                                       // observed NDJSON file
    search: {
      template_advertised:
        Boolean(config.urlTemplates.search_url_template) &&
        // For static profile, search is fulfilled by a precomputed index per PRD-105-R7a.
        files.some(f => f.path.includes("search-index")),
    },
  };
}
```

### Snippet 5 — Atomic write with tmp + rename

```ts
// packages/generator-runtime/src/atomic-write.ts
// PRD-400-R23.

import { open, rename, unlink } from "node:fs/promises";
import { dirname, basename } from "node:path";

export async function atomicWrite(targetPath: string, bytes: Uint8Array): Promise<void> {
  const dir = dirname(targetPath);
  const base = basename(targetPath);
  const tmpPath = `${dir}/.${base}.tmp.${process.pid}.${Date.now()}`;
  let fh;
  try {
    fh = await open(tmpPath, "w", 0o644);
    await fh.writeFile(bytes);
    await fh.sync();
    await fh.close();
    fh = undefined;
    await rename(tmpPath, targetPath);
  } catch (err) {
    if (fh) await fh.close().catch(() => {});
    await unlink(tmpPath).catch(() => {});
    throw err;
  }
}
```

### Snippet 6 — Incremental rebuild detection (content-hash)

```ts
// packages/generator-runtime/src/incremental.ts
// PRD-400-R22.

import { createHash } from "node:crypto";

export function changedNodeIds(
  current: NodeMap,
  previous: BuildReport | undefined,
): Set<string> {
  if (!previous) return new Set(Object.keys(current));   // first build: all changed
  const previousByPath = new Map(previous.files.map(f => [f.path, f.etag]));
  const changed = new Set<string>();
  for (const [id, node] of Object.entries(current)) {
    const path = pathForNodeId(id);
    if (previousByPath.get(path) !== node.etag) changed.add(id);
  }
  // Index always recomputes if any node changed (PRD-400-R22 second bullet).
  return changed;
}
```

### Snippet 7 — Build hook invocation order

```ts
// PRD-400-R24 / R25.
// preBuild before any adapter init; postBuild after files written; onError on throw.

await plugin.hooks?.preBuild?.(ctx);
try {
  await runStages(ctx);                                  // adapters → bindings → merge → ... → emit
  await plugin.hooks?.postBuild?.(ctx);
} catch (err) {
  // onError is the only hook permitted to throw without escalating beyond the
  // original error; the framework surfaces err preferentially.
  await plugin.hooks?.onError?.(ctx, err as Error).catch(() => {});
  throw err;
}
```

### Snippet 8 — Adapter pinning enforcement

```ts
// packages/generator-runtime/src/pinning.ts
// PRD-400-R29 / R30.

export function enforceAdapterPinning(config: GeneratorConfig): void {
  for (const { adapter } of config.adapters) {
    const meta = readAdapterMetadata(adapter);                    // package.json sniff
    if (meta.actSpecMinors) {
      // Stage 2 path
      if (!meta.actSpecMinors.includes(config.actVersion)) {
        throw new GeneratorError({
          code: "adapter_pinning_stage_2",
          requirement: "PRD-400-R30",
          message: `adapter '${adapter.name}' declares actSpecMinors=${JSON.stringify(meta.actSpecMinors)} but build targets ${config.actVersion}`,
        });
      }
    } else if (meta.actVersion) {
      // Stage 1 path
      if (meta.actVersion !== config.actVersion) {
        throw new GeneratorError({
          code: "adapter_pinning_stage_1",
          requirement: "PRD-400-R29",
          message: `adapter '${adapter.name}' declares act_version='${meta.actVersion}' but build targets '${config.actVersion}'`,
        });
      }
    } else {
      throw new GeneratorError({
        code: "adapter_pinning_missing",
        requirement: "PRD-400-R29",
        message: `adapter '${adapter.name}' declares neither act_version nor actSpecMinors`,
      });
    }
  }
}
```

### Snippet 9 — Build report writer

```ts
// packages/generator-runtime/src/report.ts
// PRD-400-R27.

import { atomicWrite } from "./atomic-write";

export async function writeBuildReport(
  ctx: BuildContext,
  files: EmittedFile[],
): Promise<void> {
  const report: BuildReport = {
    ...ctx.report,
    completedAt: new Date().toISOString(),
    durationMs: Date.now() - ctx.startMs,
    files: files.map(f => ({
      path: f.path,
      bytes: f.bytes,
      etag: f.etag,
      contentType: f.contentType,
      band: f.band,
    })),
  };
  const reportPath = `${ctx.outputDir}/.act-build-report.json`;
  await atomicWrite(reportPath, new TextEncoder().encode(JSON.stringify(report, null, 2)));
}
```

These snippets sketch the canonical shape; full implementations include error handling, observability instrumentation, and the host-framework-specific glue each leaf generator owns.

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft per gap A4 (build error/warning severity, generator-side rule), gap B2 (multi-source merging composition with PRD-300), gap B4 (component-contract emission seam, consumer side), gap C5 (hybrid mounts, static parent), gap E2 (versioned trees, optional). Locks the canonical pipeline order, the `GeneratorPlugin` / `GeneratorRuntime` / `GeneratorConfig` / `BuildContext` / `BuildReport` TypeScript interfaces, the multi-source merge composition (PRD-200 then PRD-300), the conformance-level computation rule (observed emissions, not adapter claims), the capability-flag emission rule (advertised iff observed), the atomic-write contract (tmp + rename), the build-hook surface (pre-build / post-build / on-error), the `--fail-on-extraction-error` flag, the build-report sidecar at `outputDir/.act-build-report.json`, and the staged adapter-pinning enforcement (Stage 1 strict pin, Stage 2 MINOR-range). Spec-only treatment for PRD-402 (Hugo) and PRD-403 (MkDocs) per Q3: contract is framework-agnostic; non-TS implementations satisfy the same Specification at the spec level. Test-fixture corpus enumerated under `fixtures/400/positive/` and `fixtures/400/negative/`; no fixture files created. No new JSON Schemas; generators emit per PRD-100. Cites PRD-100 (Accepted), PRD-103 (Accepted), PRD-104 (Accepted), PRD-105 (Accepted), PRD-107 (Accepted), PRD-108 (Accepted), PRD-109 (Accepted), PRD-200 (In review), PRD-300 (In review). Status: Draft → In review. |
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review. Decisions: (Q1) no pre-emit hook in v0.1 — deferred to v0.2; (Q2) incremental rebuilds use content hashing in the canonical TS reference; (Q3) build report sidecar at `outputDir/.act-build-report.json` is normative and forbidden from CDN upload; (Q4) plugins MAY NOT dynamically register adapters/bindings at pre-build — config-only; (Q5) `generator` and `generated_at` manifest fields remain SHOULD (observability, not conformance). Ratified flagged judgment calls: pipeline order normative and immutable (R1), `delivery: "static"` mandatory (R10), ETag derivation is generator's responsibility (R8; adapter `etag` per PRD-200 Snippet 4 is a caching hint that the framework recomputes), component vs adapter ID collisions are hard build error (R6), build report local-only and forbidden from CDN upload (R27), `--fail-on-extraction-error` flag escalating PRD-300-R22 placeholders (R26), spec-only treatment for PRD-402/403 (R33; TS interfaces normative for TS impls, prose form normative for non-TS), `generator`/`generated_at` SHOULD not MUST (R20), atomic writes within `outputDir` only (R23). |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
