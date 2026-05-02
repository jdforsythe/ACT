# PRD-407 — Nuxt module

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

PRD-400 (In review) pins the framework-agnostic generator pipeline every leaf generator implements: canonical stage order, the `GeneratorPlugin` / `GeneratorRuntime` / `GeneratorConfig` interfaces, multi-source merge composition, conformance-level computation, capability-flag emission, atomic writes, build hooks, and the staged adapter-pinning regime. PRD-302 (In review) pins the Vue-side component-extraction binding (`@act/vue`) every Vue-tree generator dispatches into. PRD-400 deliberately stops short of every host-framework specific (where to mount the module hook, how to read framework config, how to enumerate routes); PRD-302 deliberately stops short of how a Nuxt build actually invokes `extractRoute`. PRD-407 is the leaf that closes the gap for the Vue ecosystem's flagship meta-framework. Nuxt is the Vue equivalent of Next.js for the static-export use case (`nuxt generate`); it ships Nuxt Content for markdown sources, Nuxt i18n for locale layouts, and a module API (`nitro:build:before`, `build:done`) the generator integrates against.

Without this PRD, every Nuxt site shipping ACT rolls its own glue: ad-hoc invocations of `@act/markdown`, manual route enumeration into `@act/vue`'s `extractRoute`, hand-coded ETag derivation, divergent atomic-write semantics. Nuxt-flavored sites — high-traffic marketing builds, Vue-based docs sites, the Nuxt Content blog template family — therefore cannot validate clean against PRD-600, and the canonical Vue static-export workflow (`nuxt generate` against a content-rich site) is an open question for adopters.

PRD-407 is the **first-party TypeScript reference module** for Nuxt per decision Q3 (TS-only first-party). The module is intentionally thin: per PRD-400-R3 it provides framework-specific glue (Nuxt's module API, hook placement, Nuxt Content / Nuxt i18n integration, route enumeration from Nuxt's pages directory) and delegates the canonical pipeline to `@act/generator-runtime`. The 700-series consumes PRD-407 indirectly: a future Vue-flavored docs example would land here, and PRD-407 is the upstream surface that makes such an example trivial. This PRD is **runtime-out-of-scope**: only static-export builds (`nuxt generate`) are covered in v0.1; SSR mode is a future PRD.

### Goals

1. Lock the Nuxt module integration shape: a `@act/nuxt` module declared in `nuxt.config.ts`'s `modules: ["@act/nuxt"]`, with module options surfaced via the `act: { … }` block in `nuxt.config.ts` (the canonical Nuxt module-options pattern).
2. Lock the Nuxt lifecycle hook placement: PRD-400's pipeline runs at Nuxt's `build:done` hook, which fires after Nitro has produced the static export tree (`nuxt generate`), so the generator's emit stage writes alongside the host build's static output. The `nitro:build:before` hook is reserved for module-side preparation (e.g., registering a virtual import for the route manifest); the canonical pipeline does not run there.
3. Lock the Nuxt source-discovery defaults: Nuxt Content (`content/**/*.md{,x}`) auto-wires PRD-201's markdown adapter against the host's content directory; Vue components in `pages/**` and `components/**` are walked by PRD-302's Vue binding via Nuxt's route enumeration.
4. Lock the **Nuxt i18n auto-wiring**: when the `@nuxtjs/i18n` module is detected in the host's `nuxt.config.ts`, the generator threads its declared `locales` into PRD-400-R31's `i18n.locales` and dispatches PRD-207 (i18n adapter, in flight) automatically. The default emission pattern is Pattern 2 (per-locale manifests) when `@nuxtjs/i18n`'s `strategy: "prefix"` is configured; Pattern 1 (locale-prefixed IDs) when `strategy: "no_prefix"` is configured with a `defaultLocale`.
5. Lock the static-export target: `nuxt generate` invokes the generator at `build:done`; the generator's `outputDir` defaults to the same `.output/public/` directory Nitro produces, so the ACT files sit alongside the host's static export and ship as one deployable.
6. Lock the SSR scope explicitly as **out of scope** for this PRD. A runtime ACT server on top of Nuxt is the responsibility of a future PRD (a Vue-flavored sibling of PRD-501); the module ships static-only in v0.1. A host using `nuxt build` (full Node.js server) without `nuxt generate` MUST receive a clear "static export not produced" build error from the module.
7. Lock route enumeration for component extraction: the module reads Nuxt's resolved page routes via the `pages:extend` hook, filters to routes whose host SFC declares either an `act` static field, a `defineActContract({...})` macro, or a `<ActSection>` boundary (per PRD-302-R3 / R5), and dispatches `@act/vue`'s `extractRoute` per route per locale per variant.
8. Lock the conformance band: Core (markdown via PRD-201 + PRD-100 envelope satisfaction) is the floor; Standard adds subtree emission for content with declared `parent`/`children` graphs; Plus when Nuxt i18n + Nuxt Content + the Vue binding compose under the canonical multi-source merge for the marketing-site template family.
9. Lock the failure surface: a Nuxt build that produces no static-export tree (e.g., `nuxt build` instead of `nuxt generate`) is a hard module error; a route whose component contract throws at extraction time emits a placeholder per PRD-302-R16 / PRD-300-R22; pinning failures (PRD-400-R29) surface before any adapter `init` runs.
10. Enumerate the test fixture matrix under `fixtures/407/positive/` and `fixtures/407/negative/`. Files NOT created in this PRD.

### Non-goals

1. **Defining the canonical pipeline.** Owned by PRD-400 (R1, R2). PRD-407 only specifies how Nuxt's module hooks compose with the pipeline.
2. **Defining the Vue component contract.** Owned by PRD-300 (in review) and PRD-302 (in flight at the time of this PRD). PRD-407 dispatches `@act/vue`'s `extractRoute`; the contract surface is unchanged.
3. **Defining the markdown source adapter.** Owned by PRD-201. PRD-407 wires the adapter against Nuxt Content's input dir; the adapter's behavior is unchanged.
4. **Defining the i18n adapter.** Owned by PRD-207 (in flight). PRD-407 detects `@nuxtjs/i18n` and threads its locales into PRD-207's input; the adapter's behavior is unchanged.
5. **SSR or runtime ACT delivery.** Out of scope per Goal 6. A future runtime PRD will own the Nuxt + Nitro server-side surface.
6. **Nuxt 2 support.** Nuxt 2 ships on Vue 2 (out of scope per PRD-302-R2). Nuxt 3+ only.
7. **Defining new wire-format envelopes or JSON Schemas.** PRD-407 emits per PRD-100; no schemas under `schemas/407/`.
8. **Nitro plugin / runtime hook authoring.** PRD-407 uses Nuxt's published hook surface (`build:done`, `pages:extend`, `nitro:build:before`); it does NOT inject Nitro plugins or middleware. Static export only.
9. **Content layer authoring** (Nuxt Content's own collections / queries). The module reads Nuxt Content's resolved input directory; it does not introspect Content's query API.

### Stakeholders / audience

- **Authors of:** future Vue-flavored 700-series example builds (no v0.1 example; deferred to v0.2 — PRD-407 is the upstream that makes one trivial); the implementation team in Phase 6 building `@act/nuxt`.
- **Consumers of (upstream):** PRD-400 (generator architecture) — PRD-407 is a leaf; PRD-302 (Vue binding) — PRD-407 dispatches it; PRD-201 (markdown adapter) — PRD-407 auto-wires it for Nuxt Content; PRD-207 (i18n adapter, in flight) — PRD-407 auto-wires it when `@nuxtjs/i18n` is detected.
- **Reviewers required:** Jeremy Forsythe (BDFL).

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Nuxt's `build:done` hook fires before Nitro's static-export tree is fully written, leaving the generator's emit stage racing with the host build's writes. | Low | High | PRD-407-R5 specifies that `build:done` fires AFTER Nitro's output is finalized in `nuxt generate` mode (verified against Nuxt 3.10+ documented hook ordering). The module checks for the presence of `.output/public/` before invoking the generator pipeline; if absent, the build aborts with an error citing the missing static-export tree. |
| A host using `nuxt build` (server output) instead of `nuxt generate` (static export) silently produces no ACT files. | Medium | Medium | PRD-407-R6 mandates the module detect `nuxt._generate === true` (or equivalent for the Nuxt 3.x stable API) at `build:done` and surface an explicit error when invoked under `nuxt build`. |
| Route enumeration via `pages:extend` misses dynamic routes that depend on Nuxt Content collections (`/[...slug].vue` resolves at runtime). | High | Medium | PRD-407-R8 specifies dual route discovery: the static page-route list from `pages:extend` PLUS the Nuxt Content adapter's enumerate stage (PRD-201 / PRD-200 lifecycle), which produces nodes for every Markdown source. Components consume `pages:extend`; markdown content consumes the adapter. The `[...slug]` template itself is not extractable; the underlying markdown sources are. |
| Nuxt i18n's locale strategies (`prefix`, `prefix_except_default`, `no_prefix`, `prefix_and_default`) don't all map cleanly to PRD-104's Pattern 1 / Pattern 2. | Medium | Medium | PRD-407-R10 maps each strategy to a Pattern explicitly: `prefix` and `prefix_except_default` → Pattern 2; `no_prefix` → Pattern 1; `prefix_and_default` → Pattern 2 (with the default locale also prefixed). Strategies the module cannot map (custom or future Nuxt i18n strategies) cause a configuration error. |
| Vue binding's `<script setup>` macro (`defineActContract`) is processed by `@act/vue/macros` but Nuxt's auto-import behavior conflicts with the macro's compile-time scope. | Medium | Low | PRD-407-R12 specifies that `@act/nuxt` registers the macro as a Nuxt auto-import per Nuxt's `imports` module surface, AND adds `@act/vue/macros` to the Vite plugin chain so the macro is desugared at SFC compile time. |
| `nuxt generate` re-runs PRD-400's pipeline twice when the host has both `prerender: true` config and an explicit `nuxt generate` invocation. | Low | Low | PRD-407-R5 ensures the generator runs exactly once per `build:done` invocation; the module installs a build-scoped guard to prevent double-execution. |
| Nuxt module options shape diverges from `GeneratorConfig`, requiring a translation layer that drifts from PRD-400's source of truth. | Medium | Medium | PRD-407-R13 specifies the module options ARE a strict subset of `GeneratorConfig`'s `manifest`, `urlTemplates`, `conformanceTarget`, and `failOnExtractionError` fields; the `adapters` and `bindings` lists are auto-wired by the module from Nuxt's detected modules and configured options. Manual override is supported via an `act.adapters` / `act.bindings` escape hatch. |
| Composable users on Vue's Composition API (`useActContract`) inside a Nuxt page that uses `<script setup>` may register contracts but the SSR walk's collector is not provided. | Medium | Medium | PRD-407-R11 specifies the module installs PRD-302's `installActProvider(app)` at Nuxt's `app:created` hook so every per-route SSR app instance has the collector; SSR walks fed into PRD-302's `extractRoute` therefore see registered contracts. |

### Open questions

1. ~~Should the module support Nuxt's `@nuxt/content` v2 query layer directly, or only the underlying markdown corpus?~~ **Resolved (2026-05-01): Only the corpus (v0.1).** PRD-201's adapter walks `content/**/*.md{,x}` directly; Nuxt Content's query layer is opt-in at the host level. Revisit if a v0.2 example needs it. (Closes Open Question 1.)
2. ~~Should the module emit a Nitro plugin for runtime ACT serving?~~ **Resolved (2026-05-01): No.** Runtime is explicitly out of scope per Goal 6; runtime ACT under Nuxt is a future PRD-500-series question. (Closes Open Question 2.)
3. ~~Should the module accept a `routeFilter(route)` option?~~ **Resolved (2026-05-01): Yes.** Optional callback in module options; negative filtering by glob (`exclude`) also supported per PRD-407-R8. Additive optional surface (heuristic 1, "tentative yes for additive optional = yes"). (Closes Open Question 3.)
4. ~~Should the module auto-wire `@vueuse/head` or Nuxt's built-in `useHead` for ACT-derived metadata propagation back into the host pages?~~ **Resolved (2026-05-01): No (v0.1).** Crosses into runtime SEO territory and isn't in scope; the build report (PRD-400-R27) is the canonical observability surface. (Closes Open Question 4.)
5. ~~Should `nuxt dev` (development mode) trigger the generator pipeline in watch mode, or only `nuxt generate`?~~ **Resolved (2026-05-01): `nuxt generate` only (v0.1).** `nuxt dev` does not produce a static-export tree, so there's nothing for the generator to emit alongside. Watch mode is provided by PRD-409 (standalone CLI) for content-only workflows. (Closes Open Question 5.)

### Acceptance criteria

- [ ] Specification opens with a table of parent (PRD-400, PRD-302) + 100-series + PRD-200 + PRD-201 / PRD-207 requirements implemented (Phase 3 addition per workflow.md).
- [ ] Every normative requirement uses RFC 2119 keywords; ID `PRD-407-R{n}`.
- [ ] Conformance level (Core / Standard / Plus) declared per requirement, citing PRD-107.
- [ ] Implementation notes section present with ~5 short TypeScript snippets (the Nuxt module factory, the `build:done` hook wiring, the Nuxt i18n auto-detection, the route-enumeration pass via `pages:extend`, the SSR walk per route).
- [ ] Test fixtures enumerated under `fixtures/407/{positive,negative}/`.
- [ ] No new JSON Schemas under `schemas/407/`.
- [ ] Open questions ≤ 5.
- [ ] Changelog entry dated 2026-05-01 by Jeremy Forsythe.

---

## Context & dependencies

### Depends on

- **PRD-400** (Generator architecture, In review): the canonical pipeline (R1, R2), `GeneratorPlugin` interface (R3), build hooks (R24, R25), atomic writes (R23), conformance-level computation (R17), capability-flag emission (R18), pinning (R29, R30), configuration shape (R31). PRD-407 is a leaf under PRD-400-R3.
- **PRD-302** (Vue binding, In review): the binding's `extractRoute` (R22), declaration patterns (R3, R4, R5), provider installation (`installActProvider`), capability declaration (R20), `contract_version` (R21). The Nuxt module dispatches `@act/vue`'s binding for component extraction.
- **PRD-300** (Component contract, In review): `BindingCapabilities` (R28), the placeholder rule (R22), page-level boundaries (R10, R11). Cited via PRD-302.
- **PRD-201** (Markdown adapter, In review): file-discovery contract, frontmatter recognition, body-to-block mapping. The Nuxt module auto-wires this against Nuxt Content's input dir.
- **PRD-207** (i18n adapter, in flight): cited as the locale-source-of-truth when `@nuxtjs/i18n` is configured. PRD-407 auto-wires the adapter; the adapter's contract is unchanged.
- **PRD-200** (Adapter framework, In review): adapter lifecycle (R2), multi-source merge (R12, R13), capability declaration (R22, R23), pinning (R25, R26), failure modes (R16, R18). Cited via the adapters PRD-407 dispatches.
- **PRD-100** (Wire format, Accepted): manifest, index, node, subtree envelopes; ID grammar (R10); per-locale ID rules (in conjunction with PRD-104).
- **PRD-103** (Caching/ETags, Accepted): static ETag derivation (R4); the module computes per PRD-103 via PRD-400's pipeline.
- **PRD-104** (i18n, Accepted): Pattern 1 (R5) and Pattern 2 (R6); pattern-mixing prohibition (R7).
- **PRD-105** (Static delivery, Accepted): file set per level (R1–R7), MIME types (R8), atomic writes (R12).
- **PRD-107** (Conformance levels, Accepted): Core / Standard / Plus.
- **PRD-108** (Versioning policy, Accepted).
- **PRD-109** (Security, Accepted): build-process trust boundary, secret-handling discipline.
- **000-decisions-needed Q3**: TS-only first-party reference impl. `@act/nuxt` ships as a TS package.
- **000-governance** (Accepted).
- External: [Nuxt 3 module author guide](https://nuxt.com/docs/guide/going-further/modules) (`defineNuxtModule`, hook surface); [Nuxt build hooks](https://nuxt.com/docs/api/advanced/hooks) (`build:done`, `nitro:build:before`, `pages:extend`, `app:created`); [Nuxt Content](https://content.nuxt.com/) (markdown corpus path); [@nuxtjs/i18n](https://i18n.nuxtjs.org/) (locale strategies); [Nitro static export](https://nitro.unjs.io/deploy/providers/static); [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174); TypeScript 5.x.

### Blocks

- A future Vue-flavored 700-series example (deferred to v0.2; not blocked at v0.1).

### References

- v0.1 draft: §7 (build integration: pipeline, generator pseudocode, plugin targets), §3.1 (component-driven critique — Vue subset), §5.11 (component-extraction strategies — Vue subset).
- `prd/000-gaps-and-resolutions.md`: A4 (build-time error / warning severity, generator-side rule — inherited from PRD-400), B2 (multi-source merging composition — inherited), B4 (component-contract emission seam, consumer side — inherited via PRD-302).
- `prd/000-decisions-needed.md`: Q3 (TS-only first-party for v0.1 — PRD-407 is in scope).
- Prior art: [`@nuxtjs/sitemap`](https://sitemap.nuxtjs.org/) module shape (post-build artifact emission); [`@nuxtjs/robots`](https://nuxtseo.com/robots/getting-started/introduction) (config-driven static file emission); [`@vueuse/head`](https://github.com/vueuse/head) (Nuxt module integration shape). None directly adopted; cited for shape.

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords as clarified by RFC 8174.

### Parent + 100-series requirements implemented

PRD-407 is a faithful adapter of PRD-400's `GeneratorPlugin` contract onto Nuxt 3+. The table below maps each PRD-407 requirement back to the parent (PRD-400, PRD-302) and 100-series rules it satisfies. Where a row says "consumes", PRD-407 does not redefine the cited PRD's requirement — it requires conformance to that requirement and adds Nuxt-specific obligations on top.

| PRD-407 requirement | Upstream requirement(s) implemented or consumed | Relationship |
|---|---|---|
| R1 (module package surface) | PRD-400-R3 (`GeneratorPlugin` interface) | The module's exported `defineNuxtModule` wraps a `GeneratorPlugin`. |
| R2 (Nuxt 3+ floor) | PRD-302-R2 (Vue 3 floor) | Nuxt 2 ships on Vue 2; out of scope. |
| R3 (`nuxt.config.ts` integration) | PRD-400-R31 (configuration shape) | Module options translate to `GeneratorConfig`. |
| R4 (module hook surface) | PRD-400-R24 (build hooks) | The module's plugin registers `preBuild` / `postBuild` / `onError`. |
| R5 (`build:done` placement) | PRD-400-R1 (canonical pipeline order) | The pipeline runs once at `build:done`. |
| R6 (`nuxt generate` required) | PRD-105-R1 (static manifest) | Static export is the only delivery profile in scope. |
| R7 (markdown adapter auto-wiring) | PRD-201 (markdown adapter), PRD-200-R2 | Auto-wires `@act/markdown` for `content/**/*.md{,x}`. |
| R8 (route enumeration via `pages:extend`) | PRD-302-R10 / R22, PRD-300-R10 | Dispatches `@act/vue.extractRoute` per route. |
| R9 (component-extraction dispatch) | PRD-302-R10 / R22, PRD-300-R28 | Generator selects extraction mode per binding capabilities. |
| R10 (Nuxt i18n auto-detection) | PRD-104-R5 / R6 / R7, PRD-207, PRD-400-R14 | Maps `@nuxtjs/i18n` strategies to Pattern 1 / Pattern 2. |
| R11 (provider installation) | PRD-302-R4 (composable provider), PRD-302-R10 | Installs `installActProvider(app)` at `app:created`. |
| R12 (macro registration) | PRD-302-R3 / R5 | Registers `defineActContract` as a Nuxt auto-import + Vite macro. |
| R13 (module options shape) | PRD-400-R31 | A strict subset of `GeneratorConfig`. |
| R14 (output dir default) | PRD-105-R1, PRD-400-R23 | Defaults to `.output/public/`. |
| R15 (atomic writes via runtime) | PRD-400-R23 | Delegates to `@act/generator-runtime`. |
| R16 (build report sidecar) | PRD-400-R27 | Writes to `outputDir/.act-build-report.json`. |
| R17 (failure surface) | PRD-400 § Errors, PRD-302-R16 | Per-route placeholders + module-level errors. |
| R18 (conformance band) | PRD-107-R6 / R8 / R10 | Core floor; Plus achievable with i18n + components. |
| R19 (capability declaration) | PRD-400-R18, PRD-200-R23 | Module advertises only what the pipeline emits. |
| R20 (pinning enforcement passthrough) | PRD-400-R29 / R30, PRD-200-R25 / R26 | Adapter and binding pinning enforced before any host build. |
| R21 (Vite macro plugin chain) | PRD-302-R3 | `@act/vue/vite-plugin` is added to Nuxt's Vite plugin list. |
| R22 (test-fixture conformance) | PRD-400-R28 | Module passes `fixtures/400/` plus Nuxt-specific `fixtures/407/`. |

### Conformance level

Per PRD-107, requirements in this PRD band as follows.

- **Core:** PRD-407-R1, R2, R3, R4, R5, R6, R7, R8, R13, R14, R15, R16, R17, R19, R20, R22.
- **Standard:** PRD-407-R9, R11, R12, R18 (Standard band achievable with subtree emission), R21.
- **Plus:** PRD-407-R10 (i18n auto-wiring; Plus per PRD-107-R10), R18 (Plus band achievable with i18n + Plus capabilities).

A Nuxt module declaring Plus satisfies Standard and Core by additivity (PRD-107-R11).

### Normative requirements

#### Package surface

**PRD-407-R1.** The Nuxt module MUST be published as the npm package `@act/nuxt`. The package's default export MUST be a Nuxt module produced by Nuxt's `defineNuxtModule` factory; the module's underlying ACT generator-plugin object MUST satisfy PRD-400's `GeneratorPlugin` interface. The module MUST declare a `name: "@act/nuxt"` and a `version` matching the package's published version per PRD-400-R20. Conformance: **Core**.

**PRD-407-R2.** The module MUST declare Nuxt 3.x (and any forward-compatible Nuxt 4.x once released that retains the `defineNuxtModule` / `build:done` / `pages:extend` surface) as a peer dependency. The module MUST surface a build-time error if instantiated under Nuxt 2.x; detection is via Nuxt's runtime `nuxt._version` or equivalent stable API. Vue 2 (the engine of Nuxt 2) is out of scope per PRD-302-R2. Conformance: **Core**.

#### `nuxt.config.ts` integration

**PRD-407-R3.** A host enables the module by listing it in `nuxt.config.ts`'s `modules` array (or its programmatic equivalent), e.g., `modules: ["@act/nuxt"]`. Module options MUST be supplied via the top-level `act` key in `nuxt.config.ts`. The module MUST validate the options against the shape pinned in §"Wire format / interface definition" and surface a configuration error before any build hook fires when validation fails. Conformance: **Core**.

#### Module hooks and lifecycle

**PRD-407-R4.** The module MUST register its underlying `GeneratorPlugin` (per PRD-400-R3) and bind PRD-400's `BuildHooks` (`preBuild`, `postBuild`, `onError`) to the module's invocation context. The module's `preBuild` hook fires after `nitro:build:before` but before the generator's adapter `init` stage; the module's `postBuild` hook fires after the build report is finalized; the module's `onError` hook fires on any unrecoverable pipeline error. Hosts MAY extend any hook by passing `act.hooks: { preBuild?, postBuild?, onError? }` in module options; host hooks run AFTER the module's own. Conformance: **Core**.

**PRD-407-R5.** The PRD-400 pipeline MUST run exactly once per Nuxt build, at the host's `build:done` hook. The module MUST install a build-scoped re-entry guard to prevent double-execution if `build:done` fires more than once (e.g., if `prerender: true` config and an explicit `nuxt generate` invocation overlap). The pipeline MUST NOT run at `nitro:build:before` (that hook is reserved for module-side preparation: registering virtual imports, installing the Vue provider, registering the Vite macro plugin). The pipeline MUST NOT run at `app:created` or any per-request hook (the static profile is build-time only). Conformance: **Core**.

**PRD-407-R6.** The module MUST detect at `build:done` whether Nuxt is producing a static-export tree (`nuxt generate`, equivalently `_generate === true` or the Nuxt 3.x stable API for the same signal). When the host build is `nuxt build` (full Node.js server output) instead of `nuxt generate`, the module MUST surface an explicit error citing the missing static-export tree and abort. SSR / runtime ACT delivery is out of scope for v0.1 per Goal 6; a future PRD will cover the runtime profile for Nuxt. Conformance: **Core**.

#### Source-discovery defaults

**PRD-407-R7.** When the host has Nuxt Content (`@nuxt/content`) installed and configured, the module MUST auto-wire PRD-201's markdown adapter (`@act/markdown`) against Nuxt Content's resolved input directory (typically `content/`, configurable via Nuxt Content's own options). The adapter's options MUST default to walking `content/**/*.md{,x}`; the host MAY override via `act.adapters` to add explicit adapter entries, in which case the auto-wired adapter is replaced by the host's explicit list. When Nuxt Content is NOT installed, the auto-wiring is a no-op; the host configures adapters explicitly. Conformance: **Core**.

**PRD-407-R8.** The module MUST enumerate the host's Vue route surface via Nuxt's `pages:extend` hook. The hook fires after Nuxt's pages directory is scanned and before route generation; the module captures the resolved route list (route IDs, file paths, dynamic-segment metadata) and threads them into PRD-400-R5's binding-extraction stage as the route enumeration. Routes whose host SFC declares either an `act` static field, a `defineActContract({...})` macro at the top of `<script setup>`, or an `<ActSection>` boundary (per PRD-302-R3 / R5) are eligible for component extraction; routes without any declaration emit no component-extracted nodes (markdown content sourced via PRD-201 still emits independently). The module MUST honor an optional `act.routeFilter(route)` callback in module options to exclude subsets of routes. Dynamic routes (`/[...slug].vue`) MAY appear in the enumeration but the underlying parameterized values come from the markdown adapter's enumerate stage, not from the route template itself. Conformance: **Core**.

#### Component extraction

**PRD-407-R9.** When a route is eligible for component extraction (per R8), the module MUST dispatch PRD-302's `@act/vue.extractRoute(input)` per route, supplying the resolved page module, the route's build-time-resolved props, the active locale (per R10 when i18n is configured; the default locale otherwise), and each declared variant (per PRD-300-R15 / PRD-302-R13). The dispatch MUST honor PRD-302-R20's capability declaration: SSR-walk is the canonical default; `static-ast` is selected only when explicitly opted in via `act.extractionMode: "static-ast"`. Conformance: **Standard**.

#### Nuxt i18n auto-wiring

**PRD-407-R10.** When the host has `@nuxtjs/i18n` installed and configured, the module MUST auto-detect its `locales` array and `strategy` and thread them into PRD-400-R31's `i18n.locales` and `i18n.pattern` per the mapping below. The module MUST also auto-wire PRD-207 (the i18n adapter) when its package is resolvable and the host has not explicitly disabled it via `act.i18n: false`.

| `@nuxtjs/i18n` strategy | PRD-407 maps to | Reason |
|---|---|---|
| `prefix` | Pattern 2 (per-locale manifests) | Every URL is locale-prefixed; per-locale roots align with PRD-104-R6. |
| `prefix_except_default` | Pattern 2 | Default locale is unprefixed but other locales are; the module emits Pattern 2 with the default locale's manifest at the root. |
| `prefix_and_default` | Pattern 2 | Every locale is prefixed including default; aligned with PRD-104-R6. |
| `no_prefix` | Pattern 1 (locale-prefixed IDs) | URLs are not locale-prefixed; locale lives on `metadata.locale` per PRD-104-R5. |

Strategies the module cannot map (custom strategies, future Nuxt i18n features) MUST surface a configuration error citing PRD-407-R10. The module threads each declared locale into PRD-302-R10's `ExtractionContext.locale` so component extraction honors the active locale per call. Conformance: **Plus** (i18n is Plus per PRD-107-R10).

#### Vue provider and macro registration

**PRD-407-R11.** The module MUST install PRD-302's `installActProvider(app)` at Nuxt's `app:created` hook for every per-route SSR app instance. This guarantees that any `useActContract(contract)` composable invocation during a route's SSR walk has the provider available. Failure to install the provider before extraction begins is a module-level error per PRD-302-R16's "composable called outside an installed `ActProvider`-equivalent app" condition. Conformance: **Standard**.

**PRD-407-R12.** The module MUST register `@act/vue`'s `defineActContract` macro and `useActContract` composable as Nuxt auto-imports via Nuxt's `imports` module API, so authors do not need explicit `import { defineActContract } from "@act/vue"` or `import { useActContract } from "@act/vue"` in SFCs. The auto-import MUST NOT extend to the `<ActSection>` wrapper component (component imports follow Nuxt's `components` module convention; the host opts in by listing `@act/vue/components` in `nuxt.config.ts`'s `components` array). The auto-imports MUST NOT collide with Nuxt's own `definePageMeta` (per PRD-302-R5). Conformance: **Standard**.

#### Module options shape

**PRD-407-R13.** The module options shape MUST be a strict subset of PRD-400's `GeneratorConfig`. The host supplies (via `act: { … }` in `nuxt.config.ts`):

- `conformanceTarget: "core" | "standard" | "plus"` (default `"core"`).
- `outputDir?: string` (default `.output/public/`, per R14).
- `baseUrl: string` (the deployment origin).
- `manifest: { site: { name, ... } }` (per `GeneratorConfig.manifest`).
- `urlTemplates: { index_url, node_url_template, … }` (per `GeneratorConfig.urlTemplates`).
- `failOnExtractionError?: boolean` (default `false`).
- `incremental?: boolean` (default `true`).
- `adapters?: AdapterEntry[]` (escape hatch — replaces auto-wiring per R7).
- `bindings?: BindingEntry[]` (escape hatch — replaces the default `@act/vue` binding).
- `routeFilter?: (route) => boolean` (per R8).
- `extractionMode?: "ssr-walk" | "static-ast"` (per R9; default `"ssr-walk"`).
- `i18n?: false` (per R10; explicit opt-out of auto-wiring).
- `hooks?: { preBuild?, postBuild?, onError? }` (per R4).

The module MUST translate this options block into a fully-formed `GeneratorConfig` before invoking `runPipeline`. The translated config MUST satisfy PRD-400-R31. Conformance: **Core**.

#### Output directory and atomic writes

**PRD-407-R14.** The module's default `outputDir` MUST be the host's Nitro static-export directory — `.output/public/` for default Nuxt 3.x configurations. The module MUST resolve this path from Nuxt's internal config rather than hard-coding the literal, so non-default Nitro configurations (e.g., `nitro.output.publicDir` overrides) work correctly. The host MAY override via `act.outputDir` in module options. The output directory MUST be inside the Nuxt project root; an `outputDir` path resolving outside the project root MUST be rejected at config validation per PRD-400-R31 / PRD-109. Conformance: **Core**.

**PRD-407-R15.** The module MUST delegate file emission to `@act/generator-runtime` so atomic writes (PRD-400-R23) and emission ordering (PRD-400-R9) are inherited unchanged. The module MUST NOT write any ACT-protocol file directly bypassing the runtime; doing so would break the atomic-write guarantee. The module MAY write Nuxt-flavored sidecar files (e.g., a Nuxt-specific build summary in module-private state) but MUST NOT place them in `outputDir`. Conformance: **Core**.

#### Build report

**PRD-407-R16.** The module MUST emit the build report sidecar at `outputDir/.act-build-report.json` per PRD-400-R27. The report's `generator` field MUST be `{ name: "@act/nuxt", version: <package version> }` per PRD-400-R20. The build report MUST NOT be uploaded to the CDN (per PRD-400-R27 last sentence); the module MUST add the path to Nitro's static-export ignore list when supported by the host's Nitro config. Conformance: **Standard**.

#### Failure surface

**PRD-407-R17.** Failure surfaces compose with PRD-400 § Errors, PRD-302-R16, and PRD-200's failure modes. Nuxt-specific contracts:

| Condition | Module response | Build outcome |
|---|---|---|
| `nuxt build` invoked instead of `nuxt generate` | Module-level error per R6 | Non-zero exit |
| Nuxt < 3.0 detected | Module-level error per R2 | Non-zero exit |
| `act.outputDir` resolves outside project root | Configuration error per R14 | Non-zero exit |
| `@nuxtjs/i18n` strategy unmappable | Configuration error per R10 | Non-zero exit |
| `act` options shape invalid | Configuration error per R3 | Non-zero exit |
| Adapter pinning fails | Inherited from PRD-400-R29 / R30 | Non-zero exit |
| Component extraction throws | Placeholder per PRD-302-R16 | Build warning (non-zero with `failOnExtractionError`) |
| Provider not installed before extraction | Inherited from PRD-302-R16 | Build warning |
| `pages:extend` enumerate fails | Module-level error | Non-zero exit |
| Static-export directory missing at `build:done` | Module-level error per R6 | Non-zero exit |

Conformance: **Core**.

#### Conformance bands

**PRD-407-R18.** The module's achieved conformance level is computed by PRD-400-R17 from observed emissions, not from the configured target. A Core deployment requires a manifest, an index, and one node file; Standard adds subtree files for content with declared `parent`/`children` graphs (typically Nuxt Content's directory hierarchy); Plus adds NDJSON index emission, the search advertisement (per PRD-105-R7a), `marketing:*` blocks (via PRD-302's component extraction), and i18n manifests when configured. The module MUST NOT inflate the manifest's `conformance.level` above the achieved level. Conformance: **Core** (the rule itself; the bands are inherited from PRD-107).

#### Capability declaration

**PRD-407-R19.** The module MUST advertise capabilities only for files actually emitted, per PRD-400-R18. Specifically: `capabilities.subtree` is set true iff at least one subtree file was emitted; `capabilities.ndjson_index` is set true iff the NDJSON index file was emitted; `capabilities.search.template_advertised` is set true iff `search_url_template` is in the urlTemplates AND the precomputed search-fulfilment artifact was written per PRD-105-R7a. The host's `act.urlTemplates` configuration is an INPUT to this rule, not a guarantee of advertisement. Conformance: **Core**.

#### Pinning enforcement

**PRD-407-R20.** The module MUST inherit PRD-400's pinning enforcement (R29 Stage 1, R30 Stage 2). The module MUST NOT bypass pinning even when the host's `act` options specify adapters or bindings explicitly; pinning checks run before any adapter `init` and before any binding's `extractRoute`. Conformance: **Core**.

#### Vite plugin chain

**PRD-407-R21.** The module MUST register `@act/vue/vite-plugin` (the `defineActContract` macro desugarer per PRD-302-R3) in Nuxt's resolved Vite plugin chain via Nuxt's `vite:extendConfig` hook. The plugin MUST run before Vue's SFC compiler; the module MUST NOT register the plugin if the host has already done so explicitly (deduplication by plugin name). When `@nuxt/content` is also installed, the module MUST place its plugin BEFORE Content's MDC plugin so macro desugaring happens before MDC transforms the SFC. Conformance: **Standard**.

#### Test-fixture conformance

**PRD-407-R22.** The module MUST pass the framework conformance fixture corpus enumerated under `fixtures/400/` per PRD-400-R28, plus the Nuxt-specific corpus under `fixtures/407/`. The Nuxt-specific corpus exercises lifecycle ordering (`build:done` placement), `nuxt generate` vs `nuxt build` detection, Nuxt Content auto-wiring, route enumeration via `pages:extend`, i18n strategy mapping, and provider installation. PRD-600 (validator) ships the fixture-runner. Conformance: **Core**.

### Wire format / interface definition

PRD-407 introduces no new wire format. The module emits per PRD-100 envelopes through `@act/generator-runtime`. The interface contract is the TypeScript shape below.

#### Module options shape

```ts
// @act/nuxt/src/types.ts
import type {
  GeneratorConfig,
  AdapterEntry,
  BindingEntry,
  BuildHooks,
} from "@act/generator-runtime";

/**
 * Module options surface in nuxt.config.ts:
 *
 *   modules: ["@act/nuxt"],
 *   act: { conformanceTarget: "plus", baseUrl: "https://acme.com", manifest: { … }, urlTemplates: { … } }
 *
 * PRD-407-R3, R13.
 */
export interface NuxtActOptions {
  conformanceTarget?: "core" | "standard" | "plus";   // default "core"
  outputDir?: string;                                  // default Nitro publicDir
  baseUrl: string;
  manifest: GeneratorConfig["manifest"];
  urlTemplates: GeneratorConfig["urlTemplates"];
  failOnExtractionError?: boolean;                     // default false
  incremental?: boolean;                                // default true
  adapters?: AdapterEntry[];                            // escape hatch (replaces auto-wiring per R7)
  bindings?: BindingEntry[];                            // escape hatch (replaces default @act/vue)
  routeFilter?: (route: NuxtRoute) => boolean;          // per R8
  extractionMode?: "ssr-walk" | "static-ast";           // per R9; default "ssr-walk"
  i18n?: false;                                         // per R10; opt out of auto-wiring
  hooks?: BuildHooks;                                   // per R4
}

export interface NuxtRoute {
  /** Route id (matches Nuxt's resolved route object). */
  id: string;
  /** Filesystem path to the page SFC. */
  file: string;
  /** Dynamic-segment metadata, if any. */
  dynamic?: Array<{ name: string; rest: boolean }>;
}
```

#### Module factory shape

```ts
// @act/nuxt/src/module.ts
import { defineNuxtModule, addImportsDir, addVitePlugin, addComponentsDir } from "@nuxt/kit";
import type { NuxtActOptions } from "./types";
import type { GeneratorPlugin } from "@act/generator-runtime";

export default defineNuxtModule<NuxtActOptions>({
  meta: {
    name: "@act/nuxt",
    configKey: "act",
    compatibility: { nuxt: "^3.0.0" },                  // PRD-407-R2
  },
  defaults: { conformanceTarget: "core", incremental: true },
  setup(options, nuxt) {
    /*
     * 1. Validate options (PRD-407-R3).
     * 2. Detect Nuxt Content + @nuxtjs/i18n (PRD-407-R7, R10).
     * 3. Register the Vite plugin chain (PRD-407-R21).
     * 4. Register auto-imports for `defineActContract` / `useActContract` (PRD-407-R12).
     * 5. Hook `pages:extend` for route enumeration (PRD-407-R8).
     * 6. Hook `app:created` for provider installation (PRD-407-R11).
     * 7. Hook `build:done` for the canonical pipeline (PRD-407-R5).
     */
  },
});
```

### Errors

The module surfaces errors along the same axes as PRD-400 (recoverable warning vs unrecoverable error). The build report (PRD-400-R27) enumerates both. The table in §"Failure surface" pins module-specific contracts; the union with PRD-400 § Errors and PRD-302's failure modes is the full surface.

| Condition | Module behavior | Build outcome |
|---|---|---|
| Nuxt 2 detected | Refuse to load | Non-zero exit |
| `nuxt build` invoked (not `nuxt generate`) | Surface error at `build:done` | Non-zero exit |
| `act` options invalid | Refuse to load | Non-zero exit |
| `outputDir` outside project root | Refuse to load | Non-zero exit |
| `@nuxtjs/i18n` strategy unmappable | Surface error before pipeline | Non-zero exit |
| Adapter / binding pinning fails | Inherit PRD-400-R29 / R30 | Non-zero exit |
| Per-route extraction throws | Inherit PRD-302-R16 (placeholder + warn) | 0 (or non-zero with `failOnExtractionError`) |
| Macro / auto-import collision with `definePageMeta` | Refuse to load (per PRD-302-R5) | Non-zero exit |
| Vite plugin chain rejects (`@act/vue/vite-plugin` not resolvable) | Refuse to load | Non-zero exit |
| `pages:extend` enumerate misses every page (empty list) | Build warning; pipeline still runs against markdown adapter alone | 0 (warning) |

---

## Examples

Worked examples are non-normative but consistent with the Specification section. Each maps to one or more positive fixtures under `fixtures/407/positive/`.

### Example 1 — Minimum Core Nuxt Content site

A small Nuxt Content site has `content/index.md`, `content/getting-started.md`, and `content/guide/intro.md`. No components declare `act`. `nuxt.config.ts`:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["@nuxt/content", "@act/nuxt"],
  act: {
    conformanceTarget: "core",
    baseUrl: "https://example.com",
    manifest: { site: { name: "Example Docs" } },
    urlTemplates: {
      index_url: "/act/index.json",
      node_url_template: "/act/n/{id}.json",
    },
  },
});
```

The build (`nuxt generate`) runs:

1. `nitro:build:before` — module installs auto-imports + Vite plugin chain.
2. `pages:extend` — module captures route enumeration (no eligible component declarations; the route list is empty for component extraction).
3. `app:created` — module installs `installActProvider(app)` (no contracts will register, but the provider is in place).
4. Nitro produces the static-export tree at `.output/public/`.
5. `build:done` — module invokes PRD-400's pipeline:
   - Adapters: `@act/markdown` enumerates three markdown files (auto-wired per R7).
   - Bindings: no eligible routes; component extraction is a no-op.
   - Merge: three nodes; no collisions.
   - Validate: every node passes PRD-100 schemas.
   - ETags: computed per PRD-103-R4.
   - Emit: writes `.output/public/.well-known/act.json`, `.output/public/act/index.json`, three node files at `.output/public/act/n/<id>.json`.

Achieved level: Core. Capabilities: `etag: true` only. The build report sidecar is at `.output/public/.act-build-report.json`. Maps to `fixtures/407/positive/minimum-core-nuxt-content.json`.

### Example 2 — Plus marketing site composing components + i18n

A Nuxt site has `pages/index.vue` (declaring a `defineActContract({ type: "landing", id: "home", … })`), `pages/pricing.vue` (`defineActContract` for `id: "pricing"`), several `<Hero>` / `<PricingTable>` components in `components/marketing/` declaring component-level `act` static fields, and `@nuxtjs/i18n` configured with `strategy: "prefix"` and locales `["en-US", "es-ES", "de-DE"]`.

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["@nuxt/content", "@nuxtjs/i18n", "@act/nuxt"],
  i18n: {
    strategy: "prefix",
    locales: ["en-US", "es-ES", "de-DE"],
    defaultLocale: "en-US",
  },
  act: {
    conformanceTarget: "plus",
    baseUrl: "https://acme.com",
    manifest: { site: { name: "Acme", canonical_url: "https://acme.com" } },
    urlTemplates: {
      index_url: "/act/index.json",
      node_url_template: "/act/n/{id}.json",
      subtree_url_template: "/act/sub/{id}.json",
      index_ndjson_url: "/act/index.ndjson",
      search_url_template: "/act/search?q={query}&locale={locale}",
    },
  },
});
```

The pipeline (per locale, per PRD-407-R10's mapping `prefix` → Pattern 2):

1. Module detects `@nuxtjs/i18n` and threads `i18n.locales = { default: "en-US", available: [...] }`, `i18n.pattern = "2"`.
2. `pages:extend` captures three page routes; both `pages/index.vue` and `pages/pricing.vue` declare page-level contracts.
3. Per locale (3 locales × 2 eligible page routes = 6 SSR walks): the binding's `extractRoute` runs against a fresh Vue app instance with `installActProvider`; `<Hero>` and `<PricingTable>` register contracts; per-component `extract` produces `marketing:hero` and `marketing:pricing-table` blocks.
4. Markdown adapter enumerates `content/**/*.md{,x}` per locale (i18n adapter merges per-locale catalogues for the markdown set).
5. Merge: adapter output + component-extracted nodes; no ID collisions.
6. Validate, ETag, emit per locale.
7. Output: parent manifest at `.output/public/.well-known/act.json`; per-locale manifests at `.output/public/{locale}/.well-known/act.json`; per-locale indexes; per-locale node files; per-locale NDJSON; subtree files for the page-level contracts.

Achieved level: Plus. Capabilities: `etag: true`, `subtree: true`, `ndjson_index: true`, `search.template_advertised: true`. Maps to `fixtures/407/positive/plus-i18n-and-components.json`.

### Example 3 — `nuxt build` instead of `nuxt generate` (negative)

A host invokes `nuxt build` (server output) with `@act/nuxt` installed. The module's `build:done` hook detects the absence of the static-export tree and surfaces:

```
error: PRD-407-R6: @act/nuxt requires static-export mode (`nuxt generate`).
       Detected: server build (`nuxt build`).
       Switch to `nuxt generate` or remove @act/nuxt from modules.
```

The build exits non-zero. Maps to `fixtures/407/negative/nuxt-build-instead-of-generate.json`.

### Example 4 — i18n strategy unmappable (negative)

A host configures `@nuxtjs/i18n` with a hypothetical custom strategy not in PRD-407-R10's mapping table. The module surfaces a configuration error before the pipeline starts:

```
error: PRD-407-R10: @nuxtjs/i18n strategy 'custom-domain-strategy' is not mappable to a PRD-104 layout pattern.
       Supported: prefix, prefix_except_default, prefix_and_default, no_prefix.
```

Maps to `fixtures/407/negative/i18n-strategy-unmappable.json`.

---

## Test fixtures

Fixtures live under `fixtures/407/`. The module MUST pass PRD-400's framework corpus under `fixtures/400/` plus the Nuxt-specific corpus enumerated below. Files are NOT created in this PRD.

### Positive

- `fixtures/407/positive/minimum-core-nuxt-content/` → satisfies R1, R2, R3, R5, R6, R7, R13, R14, R15, R16, R19. A single-locale Nuxt Content site with no component contracts.
- `fixtures/407/positive/standard-with-subtree-content-tree/` → satisfies R7, R18 (Standard band). Nuxt Content with hierarchical directory layout produces subtree-eligible parent/child relations.
- `fixtures/407/positive/plus-i18n-and-components/` → satisfies R8, R9, R10, R11, R12, R18 (Plus band), R19. Three locales, page-level + component-level contracts, NDJSON, search advertisement.
- `fixtures/407/positive/i18n-strategy-prefix/` → satisfies R10 (Pattern 2 mapping).
- `fixtures/407/positive/i18n-strategy-no-prefix/` → satisfies R10 (Pattern 1 mapping).
- `fixtures/407/positive/i18n-strategy-prefix-except-default/` → satisfies R10 (Pattern 2 mapping with default at root).
- `fixtures/407/positive/route-filter-excludes-routes/` → satisfies R8. `act.routeFilter(route)` excludes a subset; excluded routes produce no component-extracted nodes but markdown adapter still enumerates.
- `fixtures/407/positive/macro-auto-import/` → satisfies R12. `defineActContract` is used in a page SFC without an explicit import; the macro desugars correctly.
- `fixtures/407/positive/provider-installed-at-app-created/` → satisfies R11. `useActContract` composable invocations register; SSR walk collects them.
- `fixtures/407/positive/host-hooks-extend-module-hooks/` → satisfies R4. Host-supplied `act.hooks.postBuild` runs after the module's own `postBuild`; build report contains both.
- `fixtures/407/positive/explicit-adapters-replace-auto-wiring/` → satisfies R7, R13. Host supplies `act.adapters` explicitly; auto-wired markdown adapter is replaced.
- `fixtures/407/positive/build-report-at-output-dir/` → satisfies R16. Build report at `.output/public/.act-build-report.json` matches PRD-400-R27 schema.
- `fixtures/407/positive/output-dir-respects-nitro-override/` → satisfies R14. Host overrides Nitro's `output.publicDir`; module resolves to the override.
- `fixtures/407/positive/static-ast-extraction-mode/` → satisfies R9. `act.extractionMode: "static-ast"` selects the static-AST path; PRD-302-R24 fixtures pass.
- `fixtures/407/positive/host-disables-i18n-auto-wiring/` → satisfies R10. `act.i18n: false` prevents auto-wiring even when `@nuxtjs/i18n` is installed.

### Negative

- `fixtures/407/negative/nuxt-build-instead-of-generate/` → MUST fail. Host invokes `nuxt build`; module surfaces R6 error.
- `fixtures/407/negative/nuxt-2-detected/` → MUST fail. Host runs Nuxt 2.x; R2 error.
- `fixtures/407/negative/output-dir-outside-project-root/` → MUST fail. R14 / R3.
- `fixtures/407/negative/i18n-strategy-unmappable/` → MUST fail. R10.
- `fixtures/407/negative/act-options-shape-invalid/` → MUST fail. Missing `manifest.site.name`. R3.
- `fixtures/407/negative/adapter-pinning-mismatch/` → MUST fail. Inherited from PRD-400-R29.
- `fixtures/407/negative/binding-pinning-mismatch/` → MUST fail. Inherited from PRD-400-R29 (applies to bindings via PRD-302).
- `fixtures/407/negative/build-done-fires-twice-without-guard/` → MUST recover. Re-entry guard per R5 prevents double-execution.
- `fixtures/407/negative/static-export-tree-missing-at-build-done/` → MUST fail. R5 / R6.
- `fixtures/407/negative/page-extend-throws/` → MUST fail. Module-level error per R8.
- `fixtures/407/negative/provider-not-installed-extraction-fails/` → MUST emit placeholder. Inherited from PRD-302-R16 / PRD-300-R22.
- `fixtures/407/negative/macro-collides-with-define-page-meta/` → MUST fail. Per PRD-302-R5; the auto-import collision rule from R12.
- `fixtures/407/negative/vite-plugin-not-resolvable/` → MUST fail. R21.
- `fixtures/407/negative/component-id-collides-with-adapter-id/` → MUST fail. Inherited from PRD-300-R11 / PRD-400-R6.

---

## Versioning & compatibility

Per PRD-108, classify each kind of change to PRD-407 as MAJOR or MINOR.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add an optional field to `NuxtActOptions` (e.g., `act.assetsDir`) | MINOR | PRD-108-R4(1). Existing configs unaffected. |
| Add a required field to `NuxtActOptions` | MAJOR | PRD-108-R5(1). |
| Add a new auto-wired adapter (e.g., a future Nuxt-flavored CMS module) | MINOR | PRD-108-R4(1). New auto-wiring is additive; explicit `act.adapters` overrides. |
| Change which Nuxt hook the pipeline runs at (e.g., move from `build:done` to a Nitro hook) | MAJOR | PRD-108-R5(7). Hook placement is a behavioral contract. |
| Drop Nuxt 3.x support in favor of Nuxt 4.x-only | MAJOR | PRD-108-R5(1). |
| Change the i18n strategy mapping table (R10) | MAJOR | Affects per-locale URL layout consumers depend on. |
| Add a new strategy to the R10 mapping table (e.g., a future Nuxt i18n strategy) | MINOR | Additive table entry. |
| Change the default `outputDir` from Nitro's publicDir to a different path | MAJOR | Tooling depends on the path. |
| Change the default `extractionMode` from `"ssr-walk"` to `"static-ast"` | MAJOR | Affects what gets extracted; behavior change. |
| Add a new module hook the host may extend | MINOR | PRD-108-R4(1). |
| Tighten `failOnExtractionError` default from false to true | MAJOR | PRD-108-R5(3). |
| Add support for SSR / runtime ACT delivery (a future runtime PRD covers this — would be a separate package) | N/A | Out of scope for PRD-407; a sibling PRD owns the runtime profile. |
| Change the build-report path from `outputDir/.act-build-report.json` | MAJOR | Inherited from PRD-400-R27; a change here propagates. |

### Forward compatibility

A `@act/nuxt@0.1.x` package runs against any Nuxt 3.x release that retains the documented hook surface (`build:done`, `pages:extend`, `nitro:build:before`, `app:created`, `vite:extendConfig`). The module tolerates unknown additions to those hooks' arguments per PRD-108-R7. Module-options consumers tolerate unknown optional fields.

### Backward compatibility

A v0.1 module package runs against a v0.2 generator-runtime and v0.2 PRD-302 binding provided no MAJOR change has been made to the `GeneratorPlugin` interface, the `BuildHooks` shape, the `ActBinding` interface, or the `NuxtActOptions` shape. Adding optional fields, hooks, or auto-wirings is non-breaking.

---

## Security considerations

This section cites PRD-109 for the project-wide threat model and PRD-400 § Security for generator-specific deltas. PRD-407 inherits both and documents only Nuxt-specific posture.

**Build-process trust boundary.** Nuxt builds run in the developer's or CI's Node.js process. The module is trusted code per PRD-200's Security section and PRD-300-R32. The trust boundary is the build-input layer: `nuxt.config.ts` is operator-authored; the content corpus and component sources are author-authored. A malicious page SFC's `extract` function can do anything the build process can do (read env, exfiltrate via network); PRD-302-R17 requires authors to treat extract as build-time-only and forbids reading per-request scope. PRD-407 inherits this stance; the module does not sandbox extraction.

**Secret-handling discipline.** Nuxt's runtime config (`runtimeConfig` in `nuxt.config.ts`) commonly carries secrets (CMS tokens, search-API keys). The module MUST NOT log `nuxt.options.runtimeConfig` in the build report or in any module-emitted log line; the build report's free-form messages MUST be redacted per PRD-400 § Security and PRD-109-R14 / R15. The module MUST NOT thread `runtimeConfig` into adapter `init` unless the host explicitly passes it via `act.adapters`'s `options` field; auto-wired adapters receive only the public configuration the module discovered (e.g., the resolved Nuxt Content directory).

**Output-directory permissions.** The module's default `outputDir` is `.output/public/` — already writable by the Nuxt build process. The module MUST NOT change permissions on existing files in `outputDir`. Per PRD-407-R14, `outputDir` paths resolving outside the project root are rejected at config validation; this prevents a malicious or buggy config from writing ACT files to system paths.

**Auto-import collision disclosure.** The module's auto-imports (`defineActContract`, `useActContract`) run in the same compile-time scope as Nuxt's own auto-imports. A name collision (e.g., a host-side `defineActContract` shadow) is a configuration issue, not a security issue, but the module MUST surface it as an error per PRD-407-R12 to prevent silent shadowing.

**Nuxt i18n auto-detection trust.** The module reads `nuxt.options.i18n` directly to determine locales. A malicious or compromised `@nuxtjs/i18n` config would propagate into the generator's locale list; this is the same trust boundary as `nuxt.config.ts` itself. The module does NOT sanitize `i18n.locales` beyond shape validation; the host operator owns config integrity.

**Build report as observability artifact, not security artifact.** Per PRD-400-R27, the build report is local-only. The module MUST add `outputDir/.act-build-report.json` to Nitro's static-export ignore list when supported; if Nitro's API does not support per-file ignore at the host's Nuxt version, the module MUST surface a build warning recommending the host add the path manually to their CDN ignore configuration.

For all other concerns — auth-scheme negotiation (N/A for static profile), ETag determinism (delegated to PRD-103), cross-origin trust (N/A for the generator), PII in error messages (delegated to PRD-109-R14 / R15) — cite PRD-109 directly. PRD-407 introduces no new transport surface beyond what PRD-400 / PRD-302 / PRD-201 inherit.

---

## Implementation notes

This section is required for SDK / generator PRDs per workflow.md Phase 3. Snippets show the canonical TypeScript shape; the full implementation lives in the `@act/nuxt` package repo.

### Snippet 1 — The Nuxt module factory

```ts
// @act/nuxt/src/module.ts
// PRD-407-R1, R2, R3, R4, R5.

import {
  defineNuxtModule,
  addImportsDir,
  addVitePlugin,
  resolvePath,
} from "@nuxt/kit";
import { runPipeline } from "@act/generator-runtime";
import type { NuxtActOptions } from "./types";
import { buildGeneratorPlugin } from "./plugin";
import { detectI18n } from "./i18n";
import { detectContent } from "./content";
import { resolveNitroPublicDir } from "./output";

export default defineNuxtModule<NuxtActOptions>({
  meta: {
    name: "@act/nuxt",
    configKey: "act",
    compatibility: { nuxt: "^3.0.0" },
  },
  defaults: { conformanceTarget: "core", incremental: true } as NuxtActOptions,
  async setup(options, nuxt) {
    if (parseFloat(nuxt._version ?? "0") < 3) {
      throw new Error("PRD-407-R2: @act/nuxt requires Nuxt 3+; detected " + nuxt._version);
    }

    // PRD-407-R12: register auto-imports for `defineActContract` / `useActContract`.
    addImportsDir(await resolvePath("@act/vue/imports"));

    // PRD-407-R21: register the SFC-macro Vite plugin chain.
    addVitePlugin(await import("@act/vue/vite-plugin").then((m) => m.default()));

    // PRD-407-R7 / R10: detect Nuxt Content and @nuxtjs/i18n; auto-wire.
    const contentInfo = detectContent(nuxt);
    const i18nInfo = options.i18n === false ? null : detectI18n(nuxt);

    // PRD-407-R8: capture the route enumeration via pages:extend.
    let routes: Array<{ id: string; file: string }> = [];
    nuxt.hook("pages:extend", (pages) => {
      routes = pages.map((p) => ({ id: p.path, file: p.file ?? "" }));
    });

    // PRD-407-R11: install the Vue provider at app:created.
    nuxt.hook("app:created", async (vueApp) => {
      const { installActProvider } = await import("@act/vue");
      installActProvider(vueApp);
    });

    // PRD-407-R5 / R6: the canonical pipeline runs at build:done.
    nuxt.hook("build:done", async () => {
      if (!nuxt.options._generate) {
        throw new Error("PRD-407-R6: @act/nuxt requires `nuxt generate` (static export).");
      }
      const plugin = buildGeneratorPlugin({
        options,
        contentInfo,
        i18nInfo,
        routes,
        outputDir: options.outputDir ?? resolveNitroPublicDir(nuxt),
        nuxt,
      });
      await runPipeline(plugin, {
        hostContext: await plugin.resolveHostContext(nuxt),
      });
    });
  },
});
```

### Snippet 2 — The `GeneratorPlugin` shape (Nuxt-side)

```ts
// @act/nuxt/src/plugin.ts
// PRD-407-R1, R3, R4, R13.

import type { GeneratorPlugin, GeneratorConfig, HostContext } from "@act/generator-runtime";
import { markdownAdapter } from "@act/markdown";
import { vueBinding } from "@act/vue";
import type { NuxtActOptions } from "./types";

export function buildGeneratorPlugin(args: {
  options: NuxtActOptions;
  contentInfo: { contentDir: string } | null;
  i18nInfo: { locales: { default: string; available: string[] }; pattern: "1" | "2" } | null;
  routes: Array<{ id: string; file: string }>;
  outputDir: string;
  nuxt: unknown;
}): GeneratorPlugin {
  const { options, contentInfo, i18nInfo, routes, outputDir } = args;

  return {
    name: "@act/nuxt",
    version: "0.1.0",                                     // PRD-400-R20
    async resolveHostContext(): Promise<HostContext> {
      const adapters = options.adapters ?? (contentInfo
        ? [{ adapter: markdownAdapter, options: { sourceDir: contentInfo.contentDir } }]
        : []);
      const bindings = options.bindings ?? [{ binding: vueBinding, options: {} }];

      const generatorConfig: GeneratorConfig = {
        actVersion: "0.1",
        conformanceTarget: options.conformanceTarget ?? "core",
        outputDir,
        baseUrl: options.baseUrl,
        adapters,
        bindings,
        manifest: options.manifest,
        urlTemplates: options.urlTemplates,
        i18n: i18nInfo ?? undefined,
        failOnExtractionError: options.failOnExtractionError ?? false,
        incremental: options.incremental ?? true,
      };

      return {
        projectRoot: process.cwd(),
        routes: routes
          .filter((r) => options.routeFilter?.(r as any) ?? true)
          .map((r) => ({ id: r.id, module: r.file, props: undefined })),
        generatorConfig,
      };
    },
    hooks: {
      preBuild: options.hooks?.preBuild,
      postBuild: options.hooks?.postBuild,
      onError: options.hooks?.onError,
    },
  };
}
```

### Snippet 3 — Nuxt i18n strategy mapping

```ts
// @act/nuxt/src/i18n.ts
// PRD-407-R10.

export function detectI18n(nuxt: { options: any }):
  | { locales: { default: string; available: string[] }; pattern: "1" | "2" }
  | null {
  const i18n = nuxt.options.i18n;
  if (!i18n) return null;

  const strategy = i18n.strategy ?? "no_prefix";
  const available = (i18n.locales ?? []).map((l: any) => typeof l === "string" ? l : l.code);
  const def = i18n.defaultLocale ?? available[0];

  let pattern: "1" | "2";
  switch (strategy) {
    case "prefix":
    case "prefix_except_default":
    case "prefix_and_default":
      pattern = "2";
      break;
    case "no_prefix":
      pattern = "1";
      break;
    default:
      throw new Error(
        `PRD-407-R10: @nuxtjs/i18n strategy '${strategy}' is not mappable to a PRD-104 layout pattern. ` +
        `Supported: prefix, prefix_except_default, prefix_and_default, no_prefix.`,
      );
  }
  return { locales: { default: def, available }, pattern };
}
```

### Snippet 4 — Route enumeration via `pages:extend`

```ts
// @act/nuxt/src/routes.ts
// PRD-407-R8.

// Inside the module's setup, this hook captures the resolved route list:
//
//   nuxt.hook("pages:extend", (pages) => {
//     routes = pages.map((p) => ({
//       id: p.path,                       // e.g. "/pricing"
//       file: p.file ?? "",                // absolute path to the SFC
//       dynamic: extractDynamicSegments(p.path),
//     }));
//   });
//
// At build:done, the module threads `routes` into the generator's HostContext.
// The generator's binding-extraction stage (PRD-400-R5) iterates `routes`, loads
// each module, and invokes `@act/vue.extractRoute({ routeId, module, routeProps,
// locale, variant })`. Routes without a declared `act` / `defineActContract` /
// `<ActSection>` produce no component-extracted nodes — the binding skips them.
//
// `routeFilter(route)` from module options excludes routes before the dispatch.
```

### Snippet 5 — Output-directory resolution from Nitro

```ts
// @act/nuxt/src/output.ts
// PRD-407-R14.

import { resolve } from "node:path";

export function resolveNitroPublicDir(nuxt: { options: any; _nitro?: any }): string {
  // Nitro exposes the public directory at `nuxt._nitro.options.output.publicDir`
  // once it has bootstrapped. Before that, we read the configured value from
  // `nuxt.options.nitro.output.publicDir` if set, falling back to the default.
  const configured = nuxt.options.nitro?.output?.publicDir;
  const resolved = configured ?? `${nuxt.options.rootDir ?? process.cwd()}/.output/public`;
  const absolute = resolve(resolved);

  // Reject paths outside the project root (PRD-407-R14, PRD-109).
  const root = resolve(nuxt.options.rootDir ?? process.cwd());
  if (!absolute.startsWith(root)) {
    throw new Error(`PRD-407-R14: outputDir '${absolute}' resolves outside project root '${root}'.`);
  }
  return absolute;
}
```

### Snippet 6 — Detecting `nuxt generate` vs `nuxt build`

```ts
// @act/nuxt/src/setup.ts
// PRD-407-R6.

// Inside the module's setup, the `build:done` hook checks Nuxt's generate flag:
//
//   nuxt.hook("build:done", async () => {
//     // Nuxt 3.x stable: nuxt.options._generate === true under `nuxt generate`.
//     if (!nuxt.options._generate) {
//       throw new ActModuleError({
//         code: "static_export_required",
//         requirement: "PRD-407-R6",
//         message: "@act/nuxt requires `nuxt generate` (static export). Detected `nuxt build`.",
//       });
//     }
//     // ... continue to runPipeline
//   });
//
// The check is on the `_generate` flag rather than the absence of `.output/public/`
// because the directory may legitimately not exist yet at the moment the hook
// fires (Nitro writes asynchronously). The flag is the authoritative signal.
```

These snippets sketch the canonical shape; the full module includes additional setup-time validation, error mapping, observability, and tests.

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review. Decisions: (Q1) corpus-only (no Nuxt Content query-layer integration); (Q2) no Nitro runtime plugin in v0.1 — runtime out of scope; (Q3) `routeFilter` callback added as optional module option; (Q4) no `useHead` / `@vueuse/head` auto-wiring — runtime SEO out of scope; (Q5) `nuxt generate` only — no `nuxt dev` watch-mode pipeline (PRD-409 covers content-only watch). |
| 2026-05-01 | Jeremy Forsythe | Initial draft. Locks the `@act/nuxt` module shape under Nuxt 3+ (Nuxt 2 out of scope per PRD-302-R2), the canonical `build:done` hook placement for the PRD-400 pipeline, the `nuxt generate` static-export-only scope (SSR / runtime out of scope per Goal 6), the auto-wiring of PRD-201's markdown adapter against Nuxt Content, the auto-detection of `@nuxtjs/i18n` and its strategy → PRD-104 Pattern mapping (`prefix` / `prefix_except_default` / `prefix_and_default` → Pattern 2; `no_prefix` → Pattern 1), the route enumeration via Nuxt's `pages:extend` hook, the dispatch of PRD-302's `@act/vue.extractRoute`, the provider installation at `app:created`, the macro auto-import and Vite plugin chain registration, the module options shape as a strict subset of `GeneratorConfig`, the default `outputDir` of Nitro's publicDir, the inherited atomic-write contract via `@act/generator-runtime`, the inherited build report sidecar, the inherited pinning enforcement (PRD-400-R29 / R30), and the conformance-band achievability (Core floor; Plus with i18n + components). Test fixtures enumerated under `fixtures/407/`; no fixture files created. No new JSON Schemas under `schemas/407/`. Cites PRD-100 (Accepted), PRD-103 (Accepted), PRD-104 (Accepted), PRD-105 (Accepted), PRD-107 (Accepted), PRD-108 (Accepted), PRD-109 (Accepted), PRD-200 (In review), PRD-201 (In review), PRD-207 (in flight), PRD-300 (In review), PRD-302 (In review), PRD-400 (In review). Status: Draft → In review. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
