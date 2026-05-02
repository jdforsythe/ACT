# PRD-401 — Astro plugin

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

PRD-400 (in review) pins the canonical generator pipeline, the `GeneratorPlugin` interface, the `BuildReport` shape, and the staged adapter pinning regime — but it is intentionally framework-agnostic. Astro is the canonical first-party host framework target for ACT v0.1: PRD-700 (minimal documentation site) gates on PRD-401, decision Q7's aspirational partner list names Astro first, and PRD-201 (markdown adapter) is the reference adapter Astro Content Collections wire to. Without a leaf PRD pinning **how** PRD-400's pipeline plugs into Astro's integration API, **when** in Astro's `astro:build:*` lifecycle the pipeline runs, **how** Astro Content Collections map onto PRD-201's adapter contract, **how** `<ActSection>` and the React-binding's static-AST scanner (PRD-301) compose with Astro's `.astro` and `.tsx` component frontmatter, and **how** dev-server reloads incrementally rebuild ACT artifacts, every Astro-shop integrator has to relitigate the same surface — risking drift between PRD-401 and the Docusaurus / Next.js / Remix leaves.

PRD-100 / PRD-103 / PRD-105 / PRD-107 / PRD-108 / PRD-109 (all Accepted) define the wire format, ETag derivation, static delivery profile, conformance bands, version-pinning regime, and security posture this leaf inherits. PRD-200 (in review) defines the adapter framework Astro consumes (PRD-201 is the markdown adapter wired to Content Collections by default). PRD-300 (in review) defines the component contract; PRD-301 (in review) defines the React binding (`@act/react`) the Astro plugin consumes for `.tsx` islands and for the page-level boundary pattern when an Astro page declares `export const act = {…}`. What's missing is the Astro-specific instantiation: the `act()` integration entry point, the lifecycle hook placement, the Content Collections wiring, and the conformance-band auto-detection that Astro's existing layered config can drive.

### Goals

1. Pin the **integration entry point**: `act()` Astro integration consumed via `astro.config.mjs` `integrations: [act({ ... })]`. The integration MUST satisfy Astro's `AstroIntegration` interface and PRD-400's `GeneratorPlugin` interface.
2. Pin the **lifecycle hook placement**: the integration registers `astro:config:setup`, `astro:build:start`, `astro:build:setup`, `astro:build:done`, and `astro:server:setup` / `astro:server:start`. The PRD-400 pipeline runs at `astro:build:done` (after Astro's static output is in `dist/`). Dev-mode runs on a watcher hooked to `astro:server:start`.
3. Pin the **Content Collections wiring**: the integration auto-detects collections under `src/content/{collection}/` and wires PRD-201 (markdown adapter) per collection. Collections defined in `src/content/config.ts` are read via Astro's `getCollection()` from inside the integration.
4. Pin the **component-extraction wiring**: when React islands are detected (any `.tsx` route component or any `client:*` directive on a React component), the integration loads PRD-301's `@act/react` binding and dispatches per PRD-400-R5. `.astro` route files MAY declare a page-level boundary via `export const act = {…}` in the frontmatter; the integration reads the export and supplies it to `extractRoute()`.
5. Pin the **output emission target**: the integration emits per PRD-105 layout into Astro's `outDir` (default `dist/`): `dist/.well-known/act.json`, `dist/act/index.json`, `dist/act/n/{id}.json`, `dist/act/sub/{id}.json` (Standard), `dist/act/index.ndjson` (Plus). Atomic writes per PRD-400-R23.
6. Pin the **dev-server integration**: the integration installs a watcher on `src/content/**`, `src/pages/**`, and `src/components/**`; on file change, it re-runs the pipeline (incremental per PRD-400-R22) and updates the dev-server's served ACT artifacts in-place.
7. Pin the **conformance band auto-detection**: Core by default; Standard when the integration detects subtree-eligible content (sidebar / hierarchy markers in collections); Plus when configuration enables NDJSON, search, or marketing-namespace blocks.
8. Pin the **build report surface**: the integration writes the build report at `dist/.act-build-report.json` per PRD-400-R27 and exposes a CLI summary via Astro's logger.
9. Enumerate the **test fixture layout** under `fixtures/401/positive/` and `fixtures/401/negative/`. No fixture files are created in this PRD.
10. Encode the **adapter-pinning enforcement**: the integration refuses to run an adapter whose declared `act_version` (Stage 1) or `actSpecMinors` (Stage 2) does not include the build's target per PRD-400-R29 / R30.

### Non-goals

1. **Defining the canonical pipeline.** Owned by PRD-400 (in review). PRD-401 wraps PRD-400's `runPipeline` in Astro idiom.
2. **Defining the wire format envelopes.** Owned by PRD-100 (Accepted).
3. **Defining the static delivery profile.** Owned by PRD-105 (Accepted).
4. **Defining the markdown adapter.** Owned by PRD-201 (Draft). PRD-401 wires PRD-201 by default; users MAY swap in a different adapter.
5. **Defining the React binding.** Owned by PRD-301 (in review). PRD-401 dispatches PRD-301's `extractRoute` per the binding's `BindingCapabilities` (PRD-300-R28).
6. **Defining the Astro integration API.** Owned by Astro (external; see [Astro Integrations API](https://docs.astro.build/en/reference/integrations-reference/)). PRD-401 conforms to Astro's API; it does not redefine it.
7. **Authoring a runtime SDK for Astro.** Astro is build-time-shaped (static + SSR); PRD-401 covers the static profile. Astro's SSR path is out of scope for v0.1; runtime ACT under Astro is a v0.2 question.
8. **Defining new JSON Schemas.** No new schemas; the integration emits per PRD-100.
9. **Migration tooling for non-Astro sites.** Out of scope; PRD-801 (migration playbook) covers cross-stack migration.
10. **i18n adapter wiring beyond what Astro Content Collections expose.** PRD-207 (i18n adapter) is the canonical surface; PRD-401 surfaces a config hook that wires PRD-207 when Astro's `i18n` config is set, but does not redefine the i18n model.

### Stakeholders / audience

- **Authors of:** PRD-700 (minimal Astro docs site, blocked by this PRD).
- **Consumers of (upstream):** PRD-400 (generator architecture), PRD-200 (adapter framework), PRD-201 (markdown adapter — default wiring), PRD-300 (component contract), PRD-301 (React binding for `.tsx` islands), PRD-105 (static delivery profile).
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Astro's integration API changes between minor versions, breaking the lifecycle hook placement. | Medium | Medium | PRD-401-R1 pins Astro 4.x as the supported peer dependency floor. Astro's API is stable across 4.x; a 5.x upgrade is a MAJOR for this PRD. |
| Content Collections schema mismatches with PRD-201 expectations (e.g., a collection's `schema` rejects `summary` field that PRD-201 assumes). | High | Medium | PRD-401-R7 surfaces a build warning when a Content Collection's resolved entries do not satisfy PRD-201's input expectations; the integration supplies defaults rather than failing. |
| Dev-server incremental rebuilds get out of sync — the user edits a markdown file but the served `index.json` still reflects the previous build. | Medium | High | PRD-401-R12 mandates the watcher invalidates and re-emits the index on every node change per PRD-400-R22; the dev-server holds the in-memory index until the rebuild completes. |
| `.astro` page-level `export const act = {…}` is read at build time but the export's `extract` references runtime values that don't resolve at SSG time. | Medium | Medium | PRD-401-R10 inherits PRD-301-R7's grammar validation and PRD-300-R32's "no request-scoped data in extract" rule. The integration evaluates `extract` against PRD-301-R22's `routeProps` (build-time only); a runtime-only reference produces a placeholder per PRD-301-R16. |
| Astro's `output: "server"` (SSR) mode invalidates the static-emission assumptions of PRD-105. | Medium | Medium | PRD-401-R3 restricts the integration to `output: "static"` (default) and `output: "hybrid"` (where prerendered routes are static). `output: "server"` is rejected with a build error referencing PRD-501 (Next.js runtime SDK; future Astro runtime SDK is a v0.2 question). |
| Auto-detected conformance band over-claims (advertises Plus when no NDJSON file is actually emitted). | Medium | High | PRD-401-R14 inherits PRD-400-R17 / R18 strictly: capabilities are computed from observed emissions, not from configuration intent. Negative fixture `astro-plus-claimed-no-ndjson.json` covers the failure mode. |
| React island extraction misses contracts on islands that hydrate with `client:only` (the SSR walk has no server tree to traverse). | Medium | Low | PRD-401-R10 documents the limitation: `client:only` islands contribute via PRD-301-R3 (static field) or PRD-301-R24 (static-AST scanner) only; the SSR walk does not enter `client:only` boundaries by design. |
| Atomic-write contract conflicts with Astro's own write-to-`dist/` step (race between Astro's `astro:build:done` write and the integration's emission). | Low | Medium | PRD-401-R13 places the pipeline invocation at `astro:build:done` AFTER Astro's static output is finalized; the integration writes only into `dist/.well-known/`, `dist/act/`, and `dist/.act-build-report.json` — paths Astro's own build does not touch. |

### Open questions

1. ~~Should the integration auto-wire PRD-207 (i18n adapter) when Astro's `i18n` config is set, or only when the user opts in via `act({ i18n: true })`?~~ **Resolved (2026-05-01): Opt-in.** Astro's i18n is feature-gated in 4.x and silently consuming it surprises users who configured it for routing only. Encoded normatively in PRD-401-R17 (opt-in via `act({ i18n: true })`). Revisit when PRD-207 lands and PRD-700 / PRD-701's i18n stories firm up. (Closes Open Question 1.)
2. ~~Should the integration support custom output paths (e.g., emit `dist/api/act/index.json` instead of `dist/act/index.json`)?~~ **Resolved (2026-05-01): Yes — via `urlTemplates`.** The Astro plugin passes through `GeneratorConfig.urlTemplates` (PRD-400-R31); no Astro-specific special-casing. Already covered by PRD-401-R19. (Closes Open Question 2.)
3. ~~Should the integration emit a `<link rel="act">` tag into Astro pages' `<head>` for discovery?~~ **Resolved (2026-05-01): No.** PRD-101 defines the well-known path as canonical discovery; a `<link>` tag is supplementary, adds HTML-mutation surface for low value. "Prefer minimalism" (heuristic 1). Revisit in v0.2 if PRD-700 testing surfaces a need. (Closes Open Question 3.)
4. ~~Should `astro:server:start` re-emission update the in-memory index AND write to `dist/`, or only the in-memory copy?~~ **Resolved (2026-05-01): In-memory only.** Writing to `dist/` during `astro dev` pollutes the build artifact directory; the dev server serves from memory; `astro build` produces the canonical on-disk artifact. Encoded normatively in PRD-401-R20. (Closes Open Question 4.)

### Acceptance criteria

- [ ] Every normative requirement has an ID `PRD-401-R{n}` and a declared conformance level per PRD-107.
- [ ] The Specification section opens with a table mapping every requirement to PRD-400 + PRD-200 + PRD-301 + 100-series requirements implemented.
- [ ] Implementation notes ship 3–6 short TypeScript snippets covering: integration registration, lifecycle hook placement, Content Collections wiring, React-binding dispatch, capability computation, dev-server watcher.
- [ ] Test fixture path layout under `fixtures/401/positive/` and `fixtures/401/negative/` is enumerated; one fixture per major requirement; no fixture files created.
- [ ] No new JSON Schemas.
- [ ] Versioning & compatibility section classifies every kind of change to PRD-401 per PRD-108.
- [ ] Security section cites PRD-109 + PRD-400 § Security and documents Astro-specific deltas (dev-server exposure, `.astro` frontmatter evaluation surface).
- [ ] Changelog entry dated 2026-05-01 by Jeremy Forsythe is present.

---

## Context & dependencies

### Depends on

- **PRD-100** (Accepted) — wire-format envelopes the integration emits.
- **PRD-103** (Accepted) — ETag derivation; integration delegates to PRD-400's pipeline.
- **PRD-105** (Accepted) — static delivery profile; integration's emission target.
- **PRD-107** (Accepted) — conformance levels; integration declares level per observed emissions.
- **PRD-108** (Accepted) — versioning policy; integration inherits Stage 1 / Stage 2 pinning per PRD-400.
- **PRD-109** (Accepted) — security posture; integration cites PRD-109 + PRD-400 § Security and documents Astro-specific deltas.
- **PRD-200** (in review) — adapter framework; integration orchestrates adapters per PRD-200 lifecycle through PRD-400's pipeline.
- **PRD-201** (Draft) — markdown adapter; default wiring for Astro Content Collections.
- **PRD-300** (in review) — component contract; integration consumes via PRD-301.
- **PRD-301** (in review) — React binding; integration loads `@act/react` for `.tsx` islands and `.astro` page-level boundaries.
- **PRD-400** (in review) — generator architecture; integration wraps `runPipeline` in Astro's `AstroIntegration` shape.
- External: [Astro Integrations API](https://docs.astro.build/en/reference/integrations-reference/) (lifecycle hooks: `astro:config:setup`, `astro:build:start`, `astro:build:setup`, `astro:build:done`, `astro:server:setup`, `astro:server:start`); [Astro Content Collections](https://docs.astro.build/en/guides/content-collections/) (collection schema, `getCollection`); Astro 4.x peer-dependency floor.

### Blocks

- **PRD-700** (minimal Astro documentation site) — direct dependency; the example's build pipeline is this integration.

### References

- v0.1 draft: §7 (build integration), §6.1 (documentation site composite — PRD-700's source).
- `prd/000-decisions-needed.md` Q3 (TS-only first-party reference impl), Q7 (Astro is an aspirational partner).
- Prior art: [Astro RSS integration](https://docs.astro.build/en/guides/rss/) (similar build-time emission pattern); [`@astrojs/sitemap`](https://docs.astro.build/en/guides/integrations-guide/sitemap/) (canonical reference for `astro:build:done` static-output emission); [`@astrojs/mdx`](https://docs.astro.build/en/guides/integrations-guide/mdx/) (precedent for `.mdx` route handling).

---

## Specification

This is the normative section. RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) apply as clarified by RFC 8174.

### PRD-400 + PRD-200 + PRD-301 + 100-series requirements implemented

The table below maps every PRD-401 requirement to the upstream requirement(s) it implements or relies on. Where a row says "consumes," the PRD-401 requirement does not redefine the shape — it requires conformance to the cited requirement and adds Astro-specific obligations on top.

| PRD-401 requirement | Upstream requirement(s) implemented or consumed | Relationship |
|---|---|---|
| R1 (integration entry point) | PRD-400-R3 (`GeneratorPlugin` interface) | The exported `act()` function returns an `AstroIntegration` whose underlying `GeneratorPlugin` satisfies PRD-400-R3. |
| R2 (Astro 4.x peer dependency) | — | Framework-version floor; outside PRD-400. |
| R3 (output mode restriction) | PRD-105-R3 (static manifest cannot carry runtime fields) | `output: "server"` is rejected because PRD-105 forbids runtime-only fields in a static manifest. |
| R4 (lifecycle hook registration) | PRD-400-R24 (build hooks: pre/post/on-error) | Astro's `astro:build:start` maps to `preBuild`; `astro:build:done` to the pipeline run + `postBuild`; uncaught throws to `onError`. |
| R5 (pipeline placement at `astro:build:done`) | PRD-400-R1 (canonical pipeline order), PRD-400-R23 (atomic writes) | Pipeline runs after Astro's static output is finalized; emission paths do not collide. |
| R6 (Content Collections wiring) | PRD-200-R2 (lifecycle), PRD-201 § markdown adapter | Auto-detects `src/content/{collection}/` and supplies entries via PRD-201's adapter input shape. |
| R7 (collection-schema tolerance) | PRD-200-R5 (`transform` may return partial node) | Schema mismatches surface as build warnings; integration supplies defaults. |
| R8 (page-level `export const act`) | PRD-301-R5 (page-level boundary, const form), PRD-301-R7 (page-id grammar) | `.astro` and `.tsx` page modules' `act` export is read and supplied to `extractRoute`. |
| R9 (React island detection) | PRD-301-R3 / R4 / R5 (declaration patterns), PRD-300-R28 (binding capability) | When `.tsx` route or `client:*` directive is present, `@act/react` is loaded and dispatched. |
| R10 (extraction-mode dispatch) | PRD-400-R5 (extraction-mode selection), PRD-301-R20 (capability values) | Default SSR-walk; static-AST opt-in via config; `client:only` islands fall back to static-AST. |
| R11 (output emission to `dist/`) | PRD-105-R1 / R2 / R4, PRD-400-R9 | Files emitted under `dist/.well-known/act.json`, `dist/act/index.json`, `dist/act/n/{id}.json`. |
| R12 (dev-server watcher) | PRD-400-R22 (incremental rebuilds) | Watcher invalidates index and re-emits affected nodes; in-memory only. |
| R13 (atomic writes within `dist/`) | PRD-400-R23 | Integration writes only to ACT-owned paths inside `dist/`. |
| R14 (conformance band auto-detection) | PRD-400-R17 / R18 (achieved level + capability flags from observed emissions) | Plugin observes file set; never inflates. |
| R15 (build report at `dist/.act-build-report.json`) | PRD-400-R27 | Report is finalized after the pipeline; not uploaded to CDN. |
| R16 (adapter pinning enforcement) | PRD-400-R29 / R30 | Plugin refuses adapters outside the build's target version. |
| R17 (i18n opt-in wiring) | PRD-104-R5 / R6 | When `act({ i18n: true })`, integration reads Astro's `i18n` config and wires PRD-207. |
| R18 (Astro logger plumbing) | PRD-400-R24 (hook surface) | Integration plumbs Astro's `AstroIntegrationLogger` into `BuildContext.logger`. |
| R19 (configuration shape) | PRD-400-R31 (`GeneratorConfig`) | Astro options object satisfies the `GeneratorConfig` minimum plus Astro-specific extensions. |
| R20 (dev mode does not write to `dist/`) | PRD-400-R23 | In dev, ACT artifacts are served from in-memory; `astro build` is the canonical write path. |

### Conformance level

PRD-401 is a generator leaf; per PRD-400's banding model, the level annotation indicates which band of producer output the requirement primarily affects. An Astro plugin targeting Plus must satisfy every Core, Standard, and Plus-banded requirement.

- **Core:** PRD-401-R1, R2, R3, R4, R5, R6, R7, R11, R13, R14, R15, R16, R18, R19, R20.
- **Standard:** PRD-401-R8, R9, R10, R12 (component-extraction wiring lands at Standard or higher per PRD-300; dev-server incremental rebuild is part of the Standard producer experience).
- **Plus:** PRD-401-R17 (i18n is Plus per PRD-107-R10).

A plugin targeting Plus satisfies Standard and Core by additivity (PRD-107-R11).

### Normative requirements

#### Integration entry point

**PRD-401-R1.** The integration MUST be published as the npm package `@act/astro`. The package MUST default-export a function `act(options?: ActAstroOptions): AstroIntegration` whose returned value satisfies Astro's `AstroIntegration` interface AND wraps a `GeneratorPlugin` (PRD-400-R3) that the framework runtime invokes. The exported `act()` is the only public surface; users consume it via `astro.config.mjs` `integrations: [act({ ... })]`. Conformance: **Core**.

**PRD-401-R2.** The package MUST declare Astro `^4.0.0` as a peer dependency. Astro 3.x and earlier are out of scope; the integration MUST emit a build error if instantiated against Astro `< 4.0.0` detected via Astro's own version probe. A future Astro 5.x bump is a MAJOR change to PRD-401 per the Versioning table. Conformance: **Core**.

#### Output mode restriction

**PRD-401-R3.** The integration MUST inspect Astro's resolved `output` setting at `astro:config:setup`. When `output: "static"` (default) or `output: "hybrid"` (the integration treats hybrid sites as static for prerendered routes only), the integration proceeds. When `output: "server"`, the integration MUST emit a build error citing PRD-105-R3 and the absence of a v0.1 Astro runtime SDK. Conformance: **Core**.

#### Lifecycle hook registration

**PRD-401-R4.** The integration MUST register the following Astro lifecycle hooks:

- `astro:config:setup` — read user options, validate, merge with PRD-400-R31 defaults, register the integration's logger.
- `astro:build:start` — invoke PRD-400 `preBuild` hook (PRD-400-R24).
- `astro:build:setup` — register Astro's Vite plugin shim if static-AST extraction is enabled (PRD-301-R24).
- `astro:build:done` — invoke PRD-400's canonical pipeline (`runPipeline`) per PRD-400-R1; the pipeline runs to completion before the Astro build returns.
- `astro:server:setup` — install dev-mode middleware that serves in-memory ACT artifacts on the dev server (paths matching `/.well-known/act.json`, `/act/**`).
- `astro:server:start` — install a chokidar (or Vite-supplied) watcher on `src/content/**`, `src/pages/**`, `src/components/**`; on change, re-run the pipeline incrementally per PRD-401-R12.

The integration MUST NOT register hooks Astro does not document; experimental hooks are out of scope for v0.1. Conformance: **Core**.

**PRD-401-R5.** The PRD-400 pipeline (`runPipeline`) MUST be invoked exclusively from `astro:build:done`. The hook receives Astro's `dir` (the resolved output directory, typically `dist/`), `routes` (the route enumeration), and `pages` (the resolved page output). The integration constructs PRD-400's `HostContext` from these inputs and passes the constructed `BuildInput` to `runPipeline`. Per PRD-400-R23, the pipeline writes only to `outputDir` paths owned by ACT (`.well-known/act.json`, `act/**`, `.act-build-report.json`); the integration MUST NOT write outside these paths. Conformance: **Core**.

#### Content Collections wiring (consumes PRD-201)

**PRD-401-R6.** Unless explicitly disabled, the integration MUST auto-detect Astro Content Collections under `src/content/{collection}/` and wire one PRD-201 (markdown) adapter instance per collection. The integration calls Astro's `getCollection(name)` from inside the integration to enumerate entries; each entry's `id`, `slug`, `data` (frontmatter), and `body` (parsed content) is supplied to PRD-201's input shape. The integration MUST honor `src/content/config.ts` collection definitions: a collection's `schema` informs PRD-201's expected frontmatter shape. Users MAY override the auto-wiring via `act({ adapters: [...] })` to swap in different adapters; in that case auto-detection is skipped per the explicit-config-wins rule. Conformance: **Core**.

**PRD-401-R7.** When a Content Collection's resolved entry does not satisfy PRD-201's input expectations (e.g., missing a `title` field PRD-201 expects in frontmatter), the integration MUST surface a build warning citing the offending entry's slug and the PRD-201 requirement. The integration MAY supply a default value (e.g., the slug as the title) so the build continues; the warning is recorded in the build report (PRD-400-R27). The integration MUST NOT silently fail — every defaulted field MUST be visible to the build operator. Conformance: **Core**.

#### Page-level boundary pattern (Standard, consumes PRD-301)

**PRD-401-R8.** When a route module (`src/pages/**.astro`, `src/pages/**.tsx`, or `src/pages/**.mdx`) exports a top-level `act` constant, the integration MUST read the export at build time and supply it to PRD-301's `extractRoute` per PRD-301-R5 (page-level boundary, const form). The export is read via Astro's static module-resolution path (Vite's `import` at integration time); a route whose `act` export is a function-call result that requires runtime evaluation is NOT supported in v0.1 (the integration emits a build warning and skips the page-level contract for that route). Validation of the page contract's `id` per PRD-301-R7 / PRD-100-R10 happens before extraction. Conformance: **Standard**.

#### React island detection (Standard, consumes PRD-301)

**PRD-401-R9.** The integration MUST detect whether a build includes React islands. Detection signals (any one is sufficient): a `.tsx` or `.jsx` file under `src/pages/` or `src/components/`; an Astro page using `<Component client:load|client:idle|client:visible|client:media|client:only="react">`; an explicit `import` of a React component in any `.astro` page. When React islands are detected, the integration MUST load `@act/react` (PRD-301-R1) and dispatch component extraction per PRD-301's `extractRoute`. When no React islands are detected, the integration SHOULD NOT load the binding (avoiding cold-start cost on docs sites with no components). Conformance: **Standard**.

**PRD-401-R10.** The integration MUST dispatch React-binding extraction per PRD-400-R5 — it inspects `@act/react`'s `BindingCapabilities` (PRD-301-R20) and picks the canonical SSR-walk path by default. Static-AST extraction (PRD-301-R24) MAY be opted into via `act({ extractMode: "static-ast" })` for faster builds. Headless-render (PRD-301-R26) is NOT auto-dispatched in v0.1 — Astro's SSR pipeline is sufficient for `client:load` / `client:idle` / `client:visible` / `client:media`, and `client:only` islands fall back to static-AST per PRD-301-R24. The integration MUST stamp every emitted block with `metadata.extraction_method` matching the actual mode used per PRD-301-R15. Conformance: **Standard**.

#### Output emission (consumes PRD-105)

**PRD-401-R11.** The integration MUST emit the static file set per PRD-105 layout into Astro's resolved `outDir` (default `./dist`):

- `{outDir}/.well-known/act.json` — manifest (PRD-105-R1).
- `{outDir}/act/index.json` — index (PRD-105-R2; path templated by `urlTemplates.index_url` defaulting to `/act/index.json`).
- `{outDir}/act/n/{id}.json` — node files (PRD-105-R4; path templated by `urlTemplates.node_url_template`).
- `{outDir}/act/sub/{id}.json` — subtree files (PRD-105-R6; Standard only).
- `{outDir}/act/index.ndjson` — NDJSON index (PRD-105-R7; Plus only).
- `{outDir}/.act-build-report.json` — build report sidecar (PRD-400-R27).

The integration MUST NOT emit ACT files outside these paths; the integration MUST NOT modify Astro's own emitted files (HTML pages, `_astro/**` assets). The integration's emission step is dispatched through PRD-400's atomic-write contract per PRD-400-R23. Conformance: **Core**.

#### Atomic writes within `dist/`

**PRD-401-R13.** The integration MUST honor PRD-400-R23's atomic-write contract: every ACT-owned file is written via tmp-then-rename within `outDir`. The integration MUST NOT touch Astro-owned paths (Astro's HTML pages and asset bundles are written by Astro before `astro:build:done` fires). The on-error hook (PRD-400-R24) cleans up any lingering `*.tmp.*` files inside `outDir/.well-known/`, `outDir/act/`, and the build-report path. Conformance: **Core**.

#### Dev-server watcher (Standard)

**PRD-401-R12.** When the integration is loaded under `astro dev`, it MUST install a watcher that observes `src/content/**`, `src/pages/**`, and `src/components/**` for changes. On a change event:

1. The integration triggers an incremental pipeline run per PRD-400-R22, supplying the previous in-memory `BuildReport` as `BuildInput.previousBuildReport`.
2. The pipeline re-runs only the affected nodes; the index is always re-emitted (PRD-400-R22 second bullet).
3. The integration updates its in-memory cache; the dev-server middleware (registered at `astro:server:setup`) serves the updated artifacts on the next request.
4. The integration MUST NOT write to `outDir` during dev; in-memory only per PRD-401-R20.

Watcher debounce SHOULD be at least 100ms to coalesce burst edits. Conformance: **Standard**.

#### Conformance band auto-detection

**PRD-401-R14.** The integration MUST compute the achieved conformance band per PRD-400-R17 (observed emissions, not configuration intent). Auto-detection signals:

- **Core:** Always achieved when emission completes successfully.
- **Standard:** Achieved iff `urlTemplates.subtree_url_template` is configured AND at least one subtree file was emitted. The integration auto-derives subtree-eligible content from Content Collections that declare a hierarchical schema (a `parent` or `section` field in the collection schema).
- **Plus:** Achieved iff Standard + NDJSON index emitted + (when `i18n: true`) per-locale manifests emitted. The integration MUST NOT advertise Plus when any of the underlying files is missing per PRD-400-R18.

The integration's resolved `conformance.level` reflects the achieved band. A configuration that targets Plus but produces only Core artifacts emits a build warning per PRD-400-R17 and downgrades to the achieved level. Conformance: **Core**.

#### Build report

**PRD-401-R15.** The integration MUST write the build report at `{outDir}/.act-build-report.json` per PRD-400-R27. The report enumerates every emitted ACT file (including Astro's HTML files are NOT enumerated — the report covers only ACT-owned artifacts), every warning (including PRD-401-R7 collection-schema warnings), and the achieved conformance level. The build report MUST NOT be uploaded to the CDN per PRD-400-R27; it is a local artifact. Conformance: **Core**.

#### Adapter pinning enforcement

**PRD-401-R16.** The integration MUST enforce PRD-400-R29 (Stage 1) and PRD-400-R30 (Stage 2) adapter pinning before any adapter `init` runs. An adapter package whose declared `act_version` (Stage 1) does not match the build's target — or whose declared `actSpecMinors` (Stage 2) does not include the build's target MINOR — MUST cause the integration to fail the build with a non-zero exit code. The integration surfaces the failing adapter's package name and declared version via Astro's logger. Conformance: **Core**.

#### i18n opt-in wiring (Plus, consumes PRD-104 / PRD-207)

**PRD-401-R17.** When `act({ i18n: true })` is set AND Astro's resolved `i18n` config declares more than one locale, the integration MUST wire PRD-207 (i18n adapter) into the adapter list automatically. The integration reads Astro's `i18n.locales` and `i18n.defaultLocale` and supplies them to PRD-207's input. The PRD-104 emission pattern (Pattern 1 vs Pattern 2) is selected by `act({ i18n: { pattern: "1" | "2" } })`; default is Pattern 2 (per-locale manifests) for Astro because Astro's routing model produces locale-prefixed URLs naturally. Per PRD-400-R14, the integration MUST NOT mix patterns within a single build. When `act({ i18n: false })` or omitted, the integration treats the build as single-locale even when Astro's `i18n` config declares multiple locales. Conformance: **Plus**.

#### Astro logger plumbing

**PRD-401-R18.** The integration MUST plumb Astro's `AstroIntegrationLogger` into PRD-400's `BuildContext.logger`. Every PRD-400 hook (`preBuild`, `postBuild`, `onError`) receives the Astro logger as the canonical logging surface. The integration MUST NOT use `console.log` or `process.stderr` directly; all output goes through Astro's logger so that `astro build --silent` and `astro build --verbose` work as expected. Conformance: **Core**.

#### Configuration shape

**PRD-401-R19.** The `act()` integration's options object (`ActAstroOptions`) MUST satisfy PRD-400-R31's `GeneratorConfig` minimum, with Astro-specific defaults applied at `astro:config:setup`:

- `actVersion` defaults to the spec MINOR the integration was built against (`"0.1"` in v0.1).
- `conformanceTarget` defaults to `"core"`; users opt up via `act({ target: "standard" | "plus" })`.
- `outputDir` defaults to Astro's resolved `outDir` (typically `dist/`); users MUST NOT override (the integration writes inside Astro's output dir by contract).
- `baseUrl` defaults to Astro's resolved `site` config; build error if `site` is unset and Plus features are requested.
- `adapters` defaults to auto-detected Content Collections wired via PRD-201; users override via `act({ adapters: [...] })`.
- `bindings` defaults to auto-detected `@act/react` per PRD-401-R9; users override via `act({ bindings: [...] })`.
- `urlTemplates` defaults to `{ index_url: "/act/index.json", node_url_template: "/act/n/{id}.json" }`; Standard adds `subtree_url_template`; Plus adds `index_ndjson_url`.
- `i18n` per PRD-401-R17.
- `failOnExtractionError` defaults to false; CI builds SHOULD set to true.
- `incremental` defaults to true.

Astro-specific extensions to the canonical config (e.g., `ignoreCollections: string[]` to skip auto-detection) are scoped under `act({ astro: { ... } })` and are non-normative. Conformance: **Core**.

#### Dev mode does not write to `dist/`

**PRD-401-R20.** When the integration runs under `astro dev`, it MUST NOT write to `outDir` (`dist/`). The dev-server middleware serves ACT artifacts from in-memory caches per PRD-401-R12. The canonical on-disk artifact is produced exclusively by `astro build`. This separation prevents dev-mode rebuilds from polluting the build artifact directory and ensures that `dist/` is consistent with the most recent `astro build` invocation. Conformance: **Core**.

### Wire format / interface definition

PRD-401 introduces no JSON wire format; the integration emits per PRD-100 envelopes through PRD-400's pipeline. The contract is the Astro integration shape and the `ActAstroOptions` TypeScript interface.

```ts
// packages/astro-plugin/src/types.ts

import type { AstroIntegration } from "astro";
import type { GeneratorConfig } from "@act/generator-runtime";

/**
 * The user-facing options object passed to act() in astro.config.mjs.
 * A superset of PRD-400-R31's GeneratorConfig with Astro-specific extensions.
 */
export interface ActAstroOptions extends Partial<Omit<GeneratorConfig, "outputDir" | "baseUrl">> {
  /** Override target conformance level. Default "core". */
  target?: "core" | "standard" | "plus";

  /** Enable i18n wiring. Default false. */
  i18n?: boolean | { pattern: "1" | "2" };

  /** Override extraction mode for React islands. Default "ssr-walk". */
  extractMode?: "ssr-walk" | "static-ast";

  /** Astro-specific: collections to skip during auto-detection. */
  astro?: {
    ignoreCollections?: string[];
    /** Skip React-island detection entirely (for non-React Astro sites). */
    skipReactBinding?: boolean;
  };
}

/**
 * The integration entry point. Default export of @act/astro.
 */
export default function act(options?: ActAstroOptions): AstroIntegration;
```

### Errors

The integration surfaces errors along PRD-400's two axes — recoverable (warning, build continues) and unrecoverable (build fails with non-zero exit). Astro-specific contracts:

| Condition | Integration behavior | Build report severity | Exit code |
|---|---|---|---|
| Astro version `< 4.0.0` | Refuse to load; surface peer-dependency mismatch | error | non-zero |
| `output: "server"` | Refuse to run; cite PRD-105-R3 + absence of v0.1 Astro runtime SDK | error | non-zero |
| Astro's `site` config unset AND Plus features requested | Build error before pipeline starts | error | non-zero |
| Content Collection's `schema` mismatch with PRD-201 expectations | Surface warning; supply default; record in build report | warning | 0 |
| `.astro` page's `act` export references runtime values not resolvable at build time | Surface warning; skip page-level contract for that route | warning | 0 |
| React island detected but `@act/react` not installed | Surface error citing PRD-301-R1 | error | non-zero |
| Adapter pinning mismatch (Stage 1 or Stage 2) | Build error per PRD-400-R29 / R30 | error | non-zero |
| Watcher fails to install (e.g., chokidar errors) under `astro dev` | Log error via Astro's logger; dev-server continues serving stale artifacts; surface dev warning | warning | 0 |
| Pipeline throws during `astro:build:done` | `onError` hook fires; cleanup; surface to Astro's build error display | error | non-zero |
| `dist/` write fails (disk full, permission denied) | Atomic write fails; cleanup tmp files | error | non-zero |
| Build report write fails | Hard build error per PRD-400 contract | error | non-zero |
| Capability advertised without backing emission | Hard build error per PRD-400-R18 | error | non-zero |
| `<link rel="act">` injection (out of scope for v0.1) | N/A — not implemented | — | — |

For all other error conditions, PRD-400's Errors table applies; the integration surfaces them via Astro's logger.

---

## Examples

Worked examples are non-normative but consistent with the Specification section. Each maps to one or more positive fixtures under `fixtures/401/positive/`.

### Example 1 — Minimum Core Astro docs site (single collection, no components)

A docs site uses a single Content Collection at `src/content/docs/` with markdown files and frontmatter `title`, `summary`, `parent`. `astro.config.mjs`:

```js
import { defineConfig } from "astro/config";
import act from "@act/astro";

export default defineConfig({
  site: "https://docs.acme.com",
  integrations: [act()],
});
```

The integration:

1. At `astro:config:setup`, validates `output: "static"` (default), reads `src/content/config.ts`, auto-detects the `docs` collection.
2. At `astro:build:done`, invokes PRD-400's `runPipeline` with PRD-201 wired to the `docs` collection. Pipeline runs adapters, validates envelopes, computes ETags, emits files atomically.
3. Writes `dist/.well-known/act.json`, `dist/act/index.json`, `dist/act/n/{id}.json` for each entry, `dist/.act-build-report.json`.

Achieved level: Core. Capabilities: `etag: true`. Maps to `fixtures/401/positive/minimum-core-single-collection/`.

### Example 2 — Standard Astro docs site with subtree (sidebar-driven hierarchy)

The same site adds a hierarchical sidebar driven by collection schema:

```ts
// src/content/config.ts
const docs = defineCollection({
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    parent: z.string().optional(),
    section: z.string().optional(),
  }),
});
```

`astro.config.mjs`:

```js
integrations: [act({
  target: "standard",
  urlTemplates: { subtree_url_template: "/act/sub/{id}.json" },
})],
```

The integration auto-derives subtree-roots from collection entries whose `section` field is set. The pipeline emits `dist/act/sub/{section}.json` for each subtree-root. Achieved level: Standard. Capabilities: `etag: true`, `subtree: true`. Maps to `fixtures/401/positive/standard-with-subtree/`.

### Example 3 — Plus Astro marketing site with React islands and i18n

A marketing site mixes Astro pages with React `<Hero>` and `<PricingTable>` islands. Astro 4.x i18n config declares `["en-US", "es-ES"]`. `astro.config.mjs`:

```js
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import act from "@act/astro";

export default defineConfig({
  site: "https://acme.com",
  i18n: { defaultLocale: "en-US", locales: ["en-US", "es-ES"] },
  integrations: [
    react(),
    act({
      target: "plus",
      i18n: { pattern: "2" },
      urlTemplates: {
        subtree_url_template: "/act/sub/{id}.json",
        index_ndjson_url: "/act/index.ndjson",
        search_url_template: "/act/search?q={query}&locale={locale}",
      },
    }),
  ],
});
```

The integration auto-detects React islands, loads `@act/react`, dispatches SSR-walk extraction per PRD-301. PRD-207 (i18n adapter) is wired automatically per PRD-401-R17. The pipeline emits per-locale manifests at `dist/en-US/.well-known/act.json` and `dist/es-ES/.well-known/act.json`, plus per-locale indexes, NDJSON, and search artifacts. Achieved level: Plus. Maps to `fixtures/401/positive/plus-react-islands-i18n/`.

### Example 4 — Page-level `export const act` from a `.astro` page

A pricing page declares its contract directly in frontmatter:

```astro
---
// src/pages/pricing.astro
export const act = {
  type: "landing",
  id: "pricing",
  contract_version: "0.1",
  extract: () => ({
    title: "Pricing",
    summary: "Tiers, plans, and FAQs",
    tokens: { summary: 8 },
  }),
};
---
<MainLayout>...</MainLayout>
```

At build, the integration reads the `act` export per PRD-401-R8 and supplies it to PRD-301's `extractRoute`. The page-level contract becomes the parent node for any nested React-island contracts. Maps to `fixtures/401/positive/page-level-act-export-astro/`.

### Example 5 — Dev-server incremental rebuild (positive)

Under `astro dev`, the user edits `src/content/docs/intro.md`. The integration's chokidar watcher fires; PRD-400's incremental-rebuild logic re-emits only the `intro` node and the index. The dev-server middleware serves the updated artifacts on the next request. The on-disk `dist/` is unchanged (PRD-401-R20). Maps to `fixtures/401/positive/dev-server-incremental-rebuild/`.

### Example 6 — `output: "server"` rejection (negative)

A site sets `output: "server"`. At `astro:config:setup`, the integration emits a build error citing PRD-105-R3 and refuses to register subsequent hooks. Build exits non-zero. Maps to `fixtures/401/negative/output-server-rejected/`.

---

## Test fixtures

Fixtures live under `fixtures/401/`. PRD-600 (validator) ships the fixture-runner; PRD-401 enumerates the layout below. No fixture files are created in this PRD.

### Positive

- `fixtures/401/positive/minimum-core-single-collection/` → satisfies R1, R3, R4, R5, R6, R11, R13, R14, R15, R19. Single Content Collection; markdown adapter; Core target; `dist/` layout asserted.
- `fixtures/401/positive/standard-with-subtree/` → satisfies R14 (Standard band). Sidebar-driven subtree; `subtree_url_template` advertised; subtree files emitted.
- `fixtures/401/positive/plus-react-islands-i18n/` → satisfies R9, R10, R14 (Plus band), R17. React islands; `@act/react` SSR-walk; PRD-207 i18n; per-locale emission.
- `fixtures/401/positive/page-level-act-export-astro/` → satisfies R8. `.astro` page exports `act` const; page-level contract supplied to extractRoute.
- `fixtures/401/positive/page-level-act-export-tsx/` → satisfies R8. `.tsx` route exports `act` const; equivalent to the `.astro` form.
- `fixtures/401/positive/react-binding-static-ast/` → satisfies R10. `extractMode: "static-ast"`; binding loaded; per-block `metadata.extraction_method: "static-ast"`.
- `fixtures/401/positive/dev-server-incremental-rebuild/` → satisfies R12. Two-event sequence; in-memory cache updated; `dist/` untouched.
- `fixtures/401/positive/dev-server-watcher-coalesce/` → satisfies R12. Multiple rapid edits; debounce coalesces into single rebuild.
- `fixtures/401/positive/atomic-write-into-dist/` → satisfies R13. Pipeline writes only to `.well-known/act.json`, `act/**`, `.act-build-report.json`; Astro-owned files untouched.
- `fixtures/401/positive/conformance-band-core-default/` → satisfies R14. No `target` set; achieved Core; capabilities advertise `etag: true` only.
- `fixtures/401/positive/build-report-shape/` → satisfies R15. `dist/.act-build-report.json` matches PRD-400-R27 schema.
- `fixtures/401/positive/adapter-pinning-stage-1-match/` → satisfies R16. Adapter declares `act_version: "0.1"`; build targets `0.1`; runs.
- `fixtures/401/positive/i18n-pattern-2-default/` → satisfies R17. Astro `i18n` configured; `act({ i18n: true })`; Pattern 2 emission per-locale.
- `fixtures/401/positive/output-hybrid-prerendered/` → satisfies R3. `output: "hybrid"`; prerendered routes processed; SSR-only routes excluded with informational note.
- `fixtures/401/positive/collection-schema-warning-defaulted/` → satisfies R7. Entry missing `summary`; integration supplies default; warning recorded.
- `fixtures/401/positive/skip-react-binding-flag/` → satisfies R9. `astro.skipReactBinding: true`; binding NOT loaded; React islands present but no extraction attempted.
- `fixtures/401/positive/no-react-no-binding-load/` → satisfies R9. No React islands; binding NOT loaded; no cold-start cost.
- `fixtures/401/positive/astro-logger-plumbed/` → satisfies R18. Hook output goes through Astro's logger; `--verbose` and `--silent` honored.
- `fixtures/401/positive/dev-mode-no-dist-writes/` → satisfies R20. `astro dev` run; `dist/` unchanged after multiple edits.

### Negative

- `fixtures/401/negative/astro-version-mismatch/` → MUST fail. Astro `< 4.0.0`; integration refuses to load. R2.
- `fixtures/401/negative/output-server-rejected/` → MUST fail. `output: "server"`; build error before pipeline. R3.
- `fixtures/401/negative/site-unset-plus-requested/` → MUST fail. Plus features requested but `site` unset. R19.
- `fixtures/401/negative/react-binding-not-installed/` → MUST fail. React islands detected; `@act/react` missing. R9.
- `fixtures/401/negative/adapter-pinning-stage-1-mismatch/` → MUST fail. Adapter declares `act_version: "1.0"`; build targets `0.1`. R16.
- `fixtures/401/negative/page-act-export-runtime-only/` → MUST surface warning. `act` export references value not resolvable at build time; page-level contract skipped; warning in build report. R8.
- `fixtures/401/negative/output-dir-override-rejected/` → MUST fail. User attempts to override `outputDir` away from Astro's `outDir`; integration refuses. R19.
- `fixtures/401/negative/capability-advertised-without-files/` → MUST fail. `target: "plus"` but no NDJSON; PRD-400-R18 inheritance. R14.
- `fixtures/401/negative/i18n-mixed-patterns/` → MUST fail. `act({ i18n: { pattern: "1" } })` AND a `manifest_url_template` declared. R17 + PRD-104-R7.
- `fixtures/401/negative/dev-mode-writes-to-dist/` → MUST fail. Test harness asserts the integration does NOT touch `dist/` under `astro dev`; an implementation that writes during dev is non-conformant. R20.
- `fixtures/401/negative/page-id-collision-with-collection/` → MUST fail. `.astro` page exports `act.id: "intro"`; markdown collection emits node `id: "intro"`. PRD-300-R11 / PRD-400-R6.
- `fixtures/401/negative/non-astro-path-write-attempted/` → MUST fail. Mocked test asserts integration only writes to ACT-owned paths; an attempt to mutate `dist/_astro/**` is rejected. R11 / R13.

---

## Versioning & compatibility

Per PRD-108, classify each kind of change to PRD-401 as MAJOR or MINOR.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add an optional field to `ActAstroOptions` | MINOR | PRD-108-R4(1). |
| Add a required field to `ActAstroOptions` | MAJOR | PRD-108-R5(1). All existing configs become non-conformant. |
| Change Astro peer-dependency floor (e.g., 4.x → 5.x) | MAJOR | Existing Astro 4.x consumers break. |
| Add a new conformance-target value | MAJOR | Mirrors PRD-107's closed-enum rule. |
| Auto-detect a new content source (e.g., JSON-frontmatter `.json` files in `src/content/`) | MINOR | Additive default behavior; users override. |
| Change the default extraction mode from `ssr-walk` to `static-ast` | MAJOR | Output `metadata.extraction_method` changes for existing builds. |
| Change the default `outputDir` away from Astro's `outDir` | MAJOR | Existing deployments break. |
| Change auto-wired adapter from PRD-201 to a different markdown adapter | MAJOR | Changes default behavior; users may rely on PRD-201 features. |
| Change the dev-server watcher from chokidar to a Vite-supplied API | MINOR | Internal implementation detail; user-visible behavior unchanged. |
| Promote `i18n` from opt-in to opt-out (`true` by default) | MAJOR | PRD-108-R5(3); existing single-locale builds become Plus claimants. |
| Change the auto-detected subtree-root signal (e.g., `section` field → `parent` field) | MAJOR | Changes which content becomes subtree-eligible. |
| Add a new lifecycle hook (e.g., register `astro:build:generated`) | MINOR | Hook surface is additive. |
| Add a new build warning code | MINOR | Warnings tolerated. |
| Tighten `failOnExtractionError` default from false to true | MAJOR | PRD-108-R5(3). |

### Forward compatibility

The integration tolerates `ActAstroOptions` fields it does not recognize (per PRD-108-R7). The `BuildReport` schema is documented-open; consumers of the report tolerate unknown optional fields.

### Backward compatibility

A v0.1 `@act/astro` package runs against a v0.2 Astro 4.x release provided no MAJOR change has been made to Astro's `AstroIntegration` interface or the lifecycle hook contract. A v0.2 `@act/astro` package targeting Astro 5.x is a MAJOR per the Versioning table above.

---

## Security considerations

This section cites PRD-109 (Accepted), PRD-400 § Security, and PRD-301 § Security and documents only Astro-specific deltas.

**Dev-server exposure.** Under `astro dev`, the integration's middleware serves ACT artifacts at `/.well-known/act.json` and `/act/**` from in-memory caches. The dev-server is bound to localhost by default; an operator who exposes `astro dev` to the network (e.g., via `--host 0.0.0.0`) accepts that ACT artifacts are reachable from any client on the network. The integration MUST NOT serve dev-mode ACT to a different host header than the dev-server itself responds on; per PRD-109's CORS posture, the dev-server's existing CORS configuration applies.

**`.astro` frontmatter evaluation surface.** An `.astro` page's `export const act = {…}` is evaluated at build time via Vite's module-resolution path. A malicious `extract` function in a frontmatter export can read process state, exfiltrate via network, or crash the build — same threat surface as PRD-300-R32 / PRD-301 § Security. The integration does NOT sandbox frontmatter evaluation; users authoring `.astro` pages MUST treat their own frontmatter as trusted code. Authors importing third-party Astro components MUST inspect any `act` export those components add.

**Content Collections schema disclosure.** Astro Content Collections may include private fields (e.g., `draft: true`, `authorEmail`) that the integration MUST NOT emit into ACT envelopes unless the collection schema explicitly maps them to ACT-relevant fields. PRD-201's contract owns the field-projection rule; PRD-401 inherits it. The integration MUST NOT emit raw collection entries — only the PRD-201-projected node shape.

**Secret handling under `astro dev`.** When `act({ adapters: [...] })` includes a CMS adapter (e.g., PRD-202 Contentful), the adapter's credentials are commonly supplied via environment variables. The integration MUST treat these as sensitive per PRD-400 § Security: credentials MUST NOT appear in the build report, MUST NOT be logged via Astro's logger at `info` level, and MUST NOT be embedded in any emitted envelope. PRD-200 § Security already requires this for adapters; PRD-401 reiterates for the integration's own log surface.

**`dist/` write boundary.** Per PRD-401-R11 / R13, the integration writes only to ACT-owned paths inside `dist/`: `.well-known/act.json`, `act/**`, `.act-build-report.json`. A malicious or buggy plugin that writes outside these paths could clobber Astro-owned files and break the deployment. The integration's atomic-write helper validates the target path against the ACT-owned set before writing; an attempt to write outside is a hard error.

**Vite plugin shim for static-AST extraction.** When `extractMode: "static-ast"` is set, the integration registers a Vite plugin that scans `.tsx` modules at build time. The Vite plugin MUST NOT execute arbitrary code; it walks the AST in the parent process per PRD-301-R24. The Babel/SWC scanner is supplied by `@act/react` and is the same scanner Next.js / Remix / Docusaurus consume — the threat surface is centralized.

For all other concerns — ETag determinism (PRD-103), cross-origin trust (PRD-109-R21), PII in error messages (PRD-109-R14 / R15), adapter trust (PRD-200 § Security), binding trust (PRD-301 § Security) — cite the upstream PRDs directly.

---

## Implementation notes

This section is required for SDK / generator PRDs. Snippets show the canonical TypeScript shape; the full implementation lives in `packages/astro-plugin/`.

### Snippet 1 — The `act()` integration entry point

```ts
// packages/astro-plugin/src/index.ts
// PRD-401-R1, R4.

import type { AstroIntegration } from "astro";
import { runPipeline } from "@act/generator-runtime";
import type { GeneratorPlugin } from "@act/generator-runtime";
import type { ActAstroOptions } from "./types";

export default function act(options: ActAstroOptions = {}): AstroIntegration {
  let resolvedConfig: ResolvedActAstroConfig;
  let plugin: GeneratorPlugin;
  let watcher: FSWatcher | undefined;
  let inMemoryCache: InMemoryActCache;

  return {
    name: "@act/astro",
    hooks: {
      "astro:config:setup": ({ config, logger, updateConfig }) => {
        // PRD-401-R3: reject output: "server"
        if (config.output === "server") {
          throw new Error(
            `@act/astro: output: "server" is not supported in v0.1 (PRD-105-R3).`,
          );
        }
        // PRD-401-R2: assert Astro 4.x peer
        assertAstroVersion(config);
        // Resolve options against PRD-400-R31 defaults + Astro context
        resolvedConfig = resolveOptions(options, config);
        plugin = buildGeneratorPlugin(resolvedConfig, logger);
      },
      "astro:server:setup": ({ server, logger }) => {
        // Install dev-mode middleware (PRD-401-R12, R20)
        inMemoryCache = createInMemoryCache();
        server.middlewares.use(actDevMiddleware(inMemoryCache));
      },
      "astro:server:start": async ({ logger }) => {
        // Install watcher (PRD-401-R12)
        watcher = installWatcher(resolvedConfig, async (changedPaths) => {
          await runIncrementalRebuild(plugin, resolvedConfig, inMemoryCache, changedPaths);
        });
      },
      "astro:build:done": async ({ dir, routes, pages, logger }) => {
        // Pipeline runs HERE per PRD-401-R5
        const hostContext = await plugin.resolveHostContext({ dir, routes, pages });
        const report = await runPipeline(plugin, { hostContext });
        logger.info(
          `ACT build: ${report.files.length} files, achieved ${report.conformanceAchieved}`,
        );
      },
    },
  };
}
```

### Snippet 2 — Content Collections wiring to PRD-201

```ts
// packages/astro-plugin/src/collections.ts
// PRD-401-R6, R7.

import { getCollection } from "astro:content";
import { markdownAdapter } from "@act/markdown";
import type { AdapterEntry } from "@act/generator-runtime";

export async function autoWireCollections(
  resolvedConfig: ResolvedActAstroConfig,
): Promise<AdapterEntry[]> {
  const collections = await discoverCollections(resolvedConfig.projectRoot);
  return collections
    .filter(name => !resolvedConfig.astro?.ignoreCollections?.includes(name))
    .map(name => ({
      adapter: markdownAdapter,
      options: {
        sourceDir: `src/content/${name}`,
        collectionName: name,
        // PRD-201's input shape; the adapter reads via getCollection at init.
        loader: () => getCollection(name),
      },
    }));
}
```

### Snippet 3 — React-binding dispatch

```ts
// packages/astro-plugin/src/react-binding.ts
// PRD-401-R9, R10.

import { reactBinding } from "@act/react";
import type { BindingEntry } from "@act/generator-runtime";

export async function autoWireReactBinding(
  resolvedConfig: ResolvedActAstroConfig,
): Promise<BindingEntry[]> {
  if (resolvedConfig.astro?.skipReactBinding) return [];
  const hasReact = await detectReactIslands(resolvedConfig.projectRoot);
  if (!hasReact) return [];
  return [{
    binding: reactBinding,
    options: {
      mode: resolvedConfig.extractMode ?? "ssr-walk",
    },
  }];
}
```

### Snippet 4 — Dev-server watcher invalidation

```ts
// packages/astro-plugin/src/watcher.ts
// PRD-401-R12, R20.

import chokidar from "chokidar";
import { runPipeline } from "@act/generator-runtime";

export function installWatcher(
  resolvedConfig: ResolvedActAstroConfig,
  onRebuild: (paths: string[]) => Promise<void>,
): chokidar.FSWatcher {
  const watcher = chokidar.watch(
    ["src/content/**", "src/pages/**", "src/components/**"],
    { cwd: resolvedConfig.projectRoot, ignoreInitial: true },
  );
  let timer: NodeJS.Timeout | undefined;
  let pending: string[] = [];
  watcher.on("all", (_event, path) => {
    pending.push(path);
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const paths = pending; pending = [];
      await onRebuild(paths);  // in-memory only per PRD-401-R20
    }, 100);  // debounce per PRD-401-R12
  });
  return watcher;
}
```

### Snippet 5 — Conformance band auto-detection

```ts
// packages/astro-plugin/src/conformance.ts
// PRD-401-R14 — wraps PRD-400-R17 / R18.

export function detectAchievedBand(
  files: EmittedFile[],
  resolvedConfig: ResolvedActAstroConfig,
): "core" | "standard" | "plus" {
  const hasSubtree = files.some(f => f.path.includes("/act/sub/"));
  const hasNdjson = files.some(f => f.path.endsWith(".ndjson"));
  const hasI18n = files.some(f => /\/[a-z]{2}(-[A-Z]{2})?\/\.well-known\/act\.json$/.test(f.path));
  if (hasNdjson && (resolvedConfig.i18n ? hasI18n : true)) return "plus";
  if (hasSubtree) return "standard";
  return "core";
}
```

### Snippet 6 — `.astro` frontmatter `act` export reader

```ts
// packages/astro-plugin/src/page-act-export.ts
// PRD-401-R8.

import { resolveModule } from "vite";

export async function readPageActExport(
  routePath: string,
  projectRoot: string,
): Promise<PageContract | undefined> {
  try {
    const mod = await resolveModule(routePath, projectRoot);
    if (mod.act && typeof mod.act === "object") {
      // Validate id grammar per PRD-301-R7 / PRD-100-R10
      validatePageId(mod.act.id);
      return mod.act as PageContract;
    }
  } catch (err) {
    // Runtime-only reference; surface warning per PRD-401-R8 second sentence
    return undefined;
  }
}
```

These snippets sketch the canonical shape; full implementations include comprehensive error handling, observability, and the host-framework-specific glue Astro requires. The integration package's tests live in `packages/astro-plugin/test/` and exercise the fixture corpus enumerated in §"Test fixtures."

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review. Decisions: (Q1) PRD-207 i18n auto-wiring is opt-in via `act({ i18n: true })`; (Q2) custom output paths supported via `urlTemplates` passthrough — no Astro-specific special-casing; (Q3) no `<link rel="act">` HTML injection in v0.1 — well-known path is canonical per PRD-101; (Q4) `astro dev` re-emission is in-memory only, never writes `dist/`. |
| 2026-05-01 | Jeremy Forsythe | Initial draft. Pins the Astro integration entry point `act()` consumed via `astro.config.mjs`, the lifecycle hook placement (`astro:config:setup`, `astro:build:start`, `astro:build:setup`, `astro:build:done` for the canonical pipeline run, `astro:server:setup` / `astro:server:start` for dev-mode), the Content Collections auto-wiring to PRD-201 (markdown adapter), the page-level `export const act` reader for `.astro` and `.tsx` route modules, the React-binding auto-detection and dispatch via PRD-301 (`@act/react`) with SSR-walk default and static-AST opt-in, the output emission target (`dist/.well-known/act.json`, `dist/act/**`, `dist/.act-build-report.json`), the dev-server watcher with in-memory artifact updates (no `dist/` writes during `astro dev`), the conformance band auto-detection (Core default; Standard with subtree; Plus with NDJSON / i18n / search), the i18n opt-in wiring to PRD-207, the Astro logger plumbing through `BuildContext`, the adapter-pinning enforcement per PRD-400-R29 / R30, and the `output: "server"` rejection (deferring runtime ACT under Astro to v0.2). Cites PRD-100 / PRD-103 / PRD-105 / PRD-107 / PRD-108 / PRD-109 (Accepted), PRD-200 / PRD-300 / PRD-301 / PRD-400 (in review), PRD-201 (Draft, default markdown wiring). Test-fixture corpus enumerated under `fixtures/401/positive/` and `fixtures/401/negative/`; no fixture files created. No new JSON Schemas. Status: Draft → In review. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
