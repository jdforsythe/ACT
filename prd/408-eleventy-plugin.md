# PRD-408 — Eleventy plugin

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

PRD-400 (In review) pins the canonical generator pipeline every leaf generator implements — pipeline order, the `GeneratorPlugin` / `GeneratorRuntime` / `GeneratorConfig` interfaces, multi-source merge composition, conformance-level computation, capability-flag emission, atomic writes, build hooks, the staged adapter-pinning regime. PRD-201 (In review) pins the markdown adapter that ingests `.md` / `.mdx` corpora — file-discovery, frontmatter parsing, body-to-block mapping, summary derivation. Eleventy (11ty) is the longest-lived stable static-site generator in the JS ecosystem; it is template-driven (Nunjucks / Liquid / Handlebars / EJS / WebC / 11ty.js — multiple template engines; the user picks per file), not component-driven. Eleventy ships a plugin API (`eleventyConfig.addPlugin`) and a hook surface (`eleventy.before`, `eleventy.after`, `eleventy.beforeWatch`) that other ecosystem plugins (`@11ty/eleventy-plugin-rss`, `@11ty/eleventy-img`) use to integrate against the build's lifecycle.

The Eleventy plugin is the **TS-impl counterpart to the spec-only PRD-402 (Hugo) and PRD-403 (MkDocs)** — Eleventy occupies the same "documentation / blog / minimal site" niche as Hugo and MkDocs, but is in-scope for first-party reference per Q3 because it is a TypeScript-friendly Node.js generator. PRD-408 is the second-most-important leaf in the 400-series for the markdown-only blog use case, and it gates PRD-707 (Eleventy blog example, the TS-side counterpart to the spec-only Hugo blog PRD-703).

The plugin is intentionally narrow: Eleventy is template-driven, so PRD-300 / PRD-301 / PRD-302 / PRD-303 (component instrumentation) do not apply. The plugin treats already-rendered HTML / Markdown as the source of truth post-build, runs PRD-400's pipeline at `eleventy.after` once Eleventy's own build is complete, and emits ACT files into the same output directory. Without this PRD, Eleventy sites shipping ACT roll their own glue: ad-hoc invocations of the markdown adapter against Eleventy's input dir, hand-coded permalink → ID mapping, divergent atomic-write semantics, and an unclear story for `permalink: false` pages that Eleventy excludes from output.

PRD-408 is the **first-party TypeScript reference plugin** for Eleventy per decision Q3.

### Goals

1. Lock the Eleventy plugin integration shape: a `@act/eleventy` package whose default export is a function passed to `eleventyConfig.addPlugin(actPlugin, options)` in `.eleventy.js` / `eleventy.config.mjs` / `eleventy.config.cjs`.
2. Lock the Eleventy lifecycle hook placement: PRD-400's pipeline runs at Eleventy's `eleventy.after` hook, which fires after Eleventy's build is complete and every output file is written. The plugin reads Eleventy's resolved collection metadata (the `results` array Eleventy passes to `after`) and the host's input directory, then invokes the canonical pipeline.
3. Lock the source-discovery defaults: PRD-201's markdown adapter auto-wires to Eleventy's input directory (`config.dir.input`, default `.`) walking `**/*.md{,x}`, with Eleventy's `.eleventyignore` honored. Eleventy's `addCollection`-defined collections are surfaced to the adapter via the `eleventy.after` callback's `results` argument; the adapter consumes them as supplemental enumerate-stage hints (PRD-200-R5 / R8).
4. Lock the templating boundary: Eleventy supports Nunjucks, Liquid, Handlebars, EJS, WebC, 11ty.js, and Markdown (plus mixed mode where `.njk` files render as templates over markdown). The plugin treats already-rendered HTML / Markdown as the source of truth post-build; it does NOT introspect template ASTs. The markdown adapter sees the source `.md` files, not the rendered HTML; component / template-engine introspection is explicitly out of scope.
5. Lock the **permalink → ID mapping**: Eleventy's `permalink` (per-file frontmatter or per-collection config) determines the URL the rendered file serves at; PRD-408 derives the ACT node ID from the source file's path (per PRD-201's default ID strategy), NOT from the permalink. Frontmatter `id:` overrides per PRD-201-R3. Files with `permalink: false` (excluded from Eleventy's output) MUST also be excluded from ACT emission, since they are not publicly addressable.
6. Lock the **no-component-extraction** stance: PRD-300 / PRD-301 / PRD-302 / PRD-303 are NOT consumed by this plugin. Eleventy is template-driven; component instrumentation is conceptually orthogonal to the templating layer. Authors who want component-level extraction should adopt a component-driven framework (Astro / Next.js / Nuxt). Plugin options MUST NOT accept a `bindings` array; if supplied, the plugin surfaces a configuration error.
7. Lock the conformance band: Core floor (markdown corpus → manifest + index + nodes); Standard with subtree emission for hierarchical collections; Plus achievable with NDJSON index emission and the search advertisement (per PRD-105-R7a). The plugin SHOULD NOT advertise Plus when the host has not provided a precomputed search artifact.
8. Lock the failure surface: a plugin invoked outside Eleventy's plugin context surfaces a configuration error; a build whose `eleventy.after` hook is invoked but produces no `results` (zero output files) emits a Core-only manifest with an empty index and a warning; pinning failures (PRD-400-R29) surface before any adapter `init` runs.
9. Enumerate the test-fixture matrix under `fixtures/408/positive/` and `fixtures/408/negative/`. Files NOT created in this PRD.
10. Gate **PRD-707** (the Eleventy blog example, the TS-impl counterpart to spec-only PRD-703 Hugo blog).

### Non-goals

1. **Defining the canonical pipeline.** Owned by PRD-400. PRD-408 specifies how Eleventy's plugin / hook surface composes with the pipeline.
2. **Defining the markdown source adapter.** Owned by PRD-201. PRD-408 wires the adapter against Eleventy's input dir; the adapter's behavior is unchanged.
3. **Component instrumentation.** Owned by PRD-300 / PRD-301 / PRD-302 / PRD-303. Out of scope per Goal 6.
4. **Defining new wire-format envelopes or JSON Schemas.** PRD-408 emits per PRD-100; no schemas under `schemas/408/`.
5. **Template-engine introspection.** The plugin does NOT walk Nunjucks ASTs, Liquid templates, or 11ty.js function bodies. Template-engine output is the rendered HTML / Markdown the host's build produces; ACT's source of truth is the markdown corpus, not the rendered output.
6. **Eleventy 1.x or earlier.** Eleventy 2.0+ only. The `eleventy.after` hook surface stabilized in 2.x; older versions are not in scope.
7. **i18n auto-wiring.** Eleventy does not ship a canonical i18n module. PRD-207 (i18n adapter) MAY be invoked manually via the `act.adapters` escape hatch; the plugin does not auto-detect locale strategies. (Future PRD MAY add `@11ty/eleventy-plugin-i18n` recognition; deferred.)
8. **Defining a CLI mode.** Eleventy runs via its own CLI (`npx @11ty/eleventy`); the plugin integrates with that. A standalone CLI for non-framework workflows is PRD-409.

### Stakeholders / audience

- **Authors of:** PRD-707 (Eleventy blog example) — the primary downstream consumer; the implementation team in Phase 6 building `@act/eleventy`.
- **Consumers of (upstream):** PRD-400 (generator architecture); PRD-201 (markdown adapter).
- **Reviewers required:** Jeremy Forsythe (BDFL).

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Eleventy's `eleventy.after` hook fires multiple times per build (e.g., when Eleventy is invoked with `--watch` and a file changes mid-build), leading to overlapping pipeline runs. | Medium | Medium | PRD-408-R5 specifies a build-scoped re-entry guard: the plugin tracks the in-flight pipeline via a Promise; subsequent `after` invocations await the in-flight build before starting a new one. Watch mode is supported; the guard prevents concurrent runs. |
| Eleventy's `permalink: false` files (excluded from output) are not in the `results` array, but the markdown adapter still walks them from the input dir, producing ACT nodes for files that don't exist on the public site. | High | High | PRD-408-R6 requires the plugin to cross-reference the markdown adapter's enumerate output against Eleventy's `results` array; nodes whose source file maps to a `permalink: false` entry MUST be filtered before the merge stage. The cross-reference is keyed on the source file's path. |
| Eleventy's collection metadata uses `inputPath` / `outputPath` / `url` keys; the plugin's mapping from these to ACT IDs and URLs diverges from Eleventy's runtime URL resolution, causing the manifest's `node_url_template` to not match where the host site actually serves content. | High | Medium | PRD-408-R7 specifies that the plugin emits ACT files at paths derived from the host's `urlTemplates` config (independent of Eleventy's `url`); the ACT manifest declares its own URL space at `/act/...` rather than mirroring Eleventy's site URLs. The host's content URLs are unrelated to the ACT URLs. |
| The plugin runs PRD-201's markdown adapter against the same files Eleventy already processed, leading to redundant frontmatter parsing and possibly inconsistent results if Eleventy's preprocessor injects frontmatter (e.g., `permalink` from a layout-level computed key). | Low | Low | PRD-408-R8 makes the markdown adapter the source of truth for ACT output; Eleventy's frontmatter processing is independent. If the host has Eleventy-specific frontmatter not recognized by PRD-201, those keys are preserved on `metadata` per PRD-201-R3. |
| Eleventy's `eleventy.after` callback gets a `results` array that varies in shape across Eleventy versions (1.x vs 2.x vs 3.x), breaking the plugin's parsing. | Medium | Medium | PRD-408-R2 pins Eleventy 2.0+ as the version floor; the `results` shape is stable from 2.0 onward. The plugin parses defensively (per-entry shape checks) and surfaces a clear error on unrecognized shapes. |
| A host using multiple template engines (e.g., `.njk` for layouts and `.md` for content) inadvertently produces duplicate ACT nodes if the markdown adapter walks both the source `.md` and a rendered `.njk` intermediate. | Low | Medium | PRD-408-R3 requires the markdown adapter to walk only files matching `**/*.md{,x}` per PRD-201's default; intermediate template files (`.njk`, `.liquid`) are not in the adapter's glob. |
| Plugin authors mistakenly try to add component bindings via `act.bindings`. | Medium | Low | PRD-408-R10 surfaces a configuration error if `bindings` is supplied. The error message documents that Eleventy is template-driven and points to PRD-407 / PRD-401 for component-driven options. |

### Open questions

1. ~~Should the plugin auto-detect Eleventy's `addCollection`-defined collections and surface them as PRD-200 capability hints?~~ **Resolved (2026-05-01): Yes — optional, default off (v0.1).** The plugin reads `eleventyConfig.collections` and threads them into the markdown adapter's options as a `collectionHints` field, enabling the adapter to set `parent`/`children` per Eleventy's collection grouping. Default off keeps the surface minimal; revisit when PRD-707 implementer feedback signals friction. (Closes Open Question 1.)
2. ~~Should the plugin support `@11ty/eleventy-plugin-rss` integration to derive `metadata.published`/`metadata.author` from RSS feeds?~~ **Resolved (2026-05-01): No (v0.1).** Author should set those via frontmatter per PRD-201's recognized-key list. "Prefer minimalism" (heuristic 1). (Closes Open Question 2.)
3. ~~Should the plugin surface a watch-mode integration that re-runs PRD-400's pipeline on Eleventy's `eleventy.beforeWatch` hook?~~ **Resolved (2026-05-01): Yes.** PRD-408-R5 specifies that watch-mode rebuilds re-run the pipeline at each `eleventy.after`; the re-entry guard prevents concurrent runs. The host opts in by passing `--watch` to Eleventy's CLI. (Closes Open Question 3.)
4. ~~Should the plugin emit a `_act-build-report.json` excluded from Eleventy's output (so it doesn't ship to the CDN)?~~ **Resolved (2026-05-01): Yes.** The plugin writes the report to the configured `outputDir` per PRD-400-R27 and adds the path to Eleventy's ignore list via the plugin API where possible. Document a manual workaround (e.g., `.gitignore` entry, CDN ignore rule) when the host's Eleventy version doesn't support per-file ignore. Eliminates a credential-leak vector (matches PRD-400-R27, PRD-402-Q3, PRD-403-R23 posture). (Closes Open Question 4.)
5. ~~Should the plugin permit a non-default Eleventy `dir.output` (e.g., `_site/`) to differ from the ACT `outputDir`?~~ **Resolved (2026-05-01): Yes.** `outputDir` defaults to the host's resolved Eleventy output dir, but the host MAY override via `act.outputDir` in plugin options. Diverging dirs are unusual but allowed. (Closes Open Question 5.)

### Acceptance criteria

- [ ] Specification opens with a table of parent (PRD-400, PRD-201) + 100-series + PRD-200 requirements implemented (Phase 3 addition per workflow.md).
- [ ] Every normative requirement uses RFC 2119 keywords; ID `PRD-408-R{n}`.
- [ ] Conformance level (Core / Standard / Plus) declared per requirement, citing PRD-107.
- [ ] Implementation notes section present with ~4 short TypeScript snippets (the plugin factory shape, the `eleventy.after` hook wiring, the permalink-aware filter, the ID derivation pass-through).
- [ ] Test fixtures enumerated under `fixtures/408/{positive,negative}/`.
- [ ] No new JSON Schemas under `schemas/408/`.
- [ ] Open questions ≤ 5.
- [ ] Changelog entry dated 2026-05-01 by Jeremy Forsythe.

---

## Context & dependencies

### Depends on

- **PRD-400** (Generator architecture, In review): the canonical pipeline (R1, R2), `GeneratorPlugin` interface (R3), build hooks (R24), atomic writes (R23), conformance-level computation (R17), capability-flag emission (R18), pinning (R29, R30), configuration shape (R31). PRD-408 is a leaf under PRD-400-R3.
- **PRD-201** (Markdown adapter, In review): file-discovery, frontmatter parsing, ID strategy, body-to-block mapping. PRD-408 auto-wires the adapter against Eleventy's input dir.
- **PRD-200** (Adapter framework, In review): adapter lifecycle (R2), failure modes (R16, R18), pinning (R25, R26), capability declaration (R22, R23). Cited via PRD-201.
- **PRD-100** (Wire format, Accepted): manifest, index, node, subtree envelopes; ID grammar (R10).
- **PRD-103** (Caching/ETags, Accepted): static ETag derivation (R4); the plugin computes via PRD-400's pipeline.
- **PRD-105** (Static delivery, Accepted): file set per level (R1–R7), MIME types (R8), atomic writes (R12).
- **PRD-107** (Conformance levels, Accepted): Core / Standard / Plus.
- **PRD-108** (Versioning policy, Accepted).
- **PRD-109** (Security, Accepted): build-process trust boundary, secret-handling discipline.
- **000-decisions-needed Q3**: TS-only first-party reference impl. `@act/eleventy` ships as a TS package.
- **000-governance** (Accepted).
- External: [Eleventy 2.0+ plugin API](https://www.11ty.dev/docs/plugins/) (`addPlugin`, `eleventyConfig`); [Eleventy events / hooks](https://www.11ty.dev/docs/events/) (`eleventy.before`, `eleventy.after`, `eleventy.beforeWatch`); [Eleventy collections](https://www.11ty.dev/docs/collections/); [Eleventy permalinks](https://www.11ty.dev/docs/permalinks/) (including `permalink: false`); [Eleventy ignore files](https://www.11ty.dev/docs/ignores/); [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174); TypeScript 5.x; Node.js 18+ (Eleventy 2.0+ floor).

### Blocks

- **PRD-707** (Eleventy blog example) — the TS counterpart to PRD-703 (Hugo, spec-only).

### References

- v0.1 draft: §7 (build integration), §3.2 (template-driven critique).
- `prd/000-gaps-and-resolutions.md`: A4 (build error / warning severity, generator-side rule — inherited from PRD-400).
- `prd/000-decisions-needed.md`: Q3 (TS-only first-party — PRD-408 in scope).
- Prior art: [`@11ty/eleventy-plugin-rss`](https://github.com/11ty/eleventy-plugin-rss) (post-build artifact emission shape); [`@11ty/eleventy-plugin-syntaxhighlight`](https://github.com/11ty/eleventy-plugin-syntaxhighlight) (plugin-options shape); [`@11ty/eleventy-img`](https://github.com/11ty/eleventy-img) (filesystem-emitting plugin pattern). None directly adopted; cited for shape.

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords as clarified by RFC 8174.

### Parent + 100-series requirements implemented

PRD-408 is a faithful adapter of PRD-400's `GeneratorPlugin` contract onto Eleventy 2.0+. The table below maps each PRD-408 requirement back to the parent (PRD-400, PRD-201) and 100-series rules it satisfies.

| PRD-408 requirement | Upstream requirement(s) implemented or consumed | Relationship |
|---|---|---|
| R1 (package surface) | PRD-400-R3 (`GeneratorPlugin` interface) | Plugin's exported function wraps a `GeneratorPlugin`. |
| R2 (Eleventy 2.0+ floor) | — | Pinned for hook-surface stability. |
| R3 (markdown adapter auto-wiring) | PRD-201, PRD-200-R2 | Auto-wires `@act/markdown` against `dir.input`. |
| R4 (`addPlugin` integration) | PRD-400-R3 | Plugin function passed to `eleventyConfig.addPlugin`. |
| R5 (`eleventy.after` placement) | PRD-400-R1 | Pipeline runs once per Eleventy build at `after`. |
| R6 (permalink-aware filter) | PRD-201-R3, PRD-200-R5 | Filters nodes whose source maps to `permalink: false`. |
| R7 (URL space independence) | PRD-100-R12, PRD-105-R1 / R4 | ACT URLs derive from `urlTemplates`, independent of Eleventy's `url`. |
| R8 (single source of truth) | PRD-201 | Markdown adapter owns the parsing. |
| R9 (no template-engine introspection) | — | Out-of-scope boundary. |
| R10 (no component bindings) | PRD-300 (out of scope) | Configuration error if `bindings` supplied. |
| R11 (collection hints, optional) | PRD-200-R5 / R8 | Eleventy collections threaded into adapter options. |
| R12 (plugin options shape) | PRD-400-R31 | Subset of `GeneratorConfig`. |
| R13 (output dir default) | PRD-105-R1, PRD-400-R23 | Defaults to Eleventy's resolved `dir.output`. |
| R14 (atomic writes via runtime) | PRD-400-R23 | Delegates to `@act/generator-runtime`. |
| R15 (build report sidecar) | PRD-400-R27 | Writes to `outputDir/.act-build-report.json`. |
| R16 (failure surface) | PRD-400 § Errors | Eleventy-specific error contracts. |
| R17 (conformance band) | PRD-107-R6 / R8 / R10 | Core floor; Plus achievable with precomputed search artifact. |
| R18 (pinning enforcement passthrough) | PRD-400-R29 / R30, PRD-200-R25 / R26 | Adapter pinning enforced before any host build. |
| R19 (watch-mode re-entry guard) | PRD-400-R22 | Watch mode reruns the pipeline; guard prevents concurrent runs. |
| R20 (test-fixture conformance) | PRD-400-R28 | Plugin passes `fixtures/400/` plus Eleventy-specific `fixtures/408/`. |

### Conformance level

Per PRD-107, requirements in this PRD band as follows.

- **Core:** PRD-408-R1, R2, R3, R4, R5, R6, R7, R8, R10, R12, R13, R14, R15, R16, R17 (Core band), R18, R20.
- **Standard:** PRD-408-R11 (collection hints; supports subtree emission), R19 (watch mode is Standard), R17 (Standard band).
- **Plus:** PRD-408-R17 (Plus band achievable when host provides precomputed search artifact).

A plugin declaring Plus satisfies Standard and Core by additivity (PRD-107-R11).

### Normative requirements

#### Package surface

**PRD-408-R1.** The Eleventy plugin MUST be published as the npm package `@act/eleventy`. The package's default export MUST be a function with the Eleventy plugin signature `(eleventyConfig: EleventyConfig, options: EleventyActOptions) => void` so that hosts can call `eleventyConfig.addPlugin(actPlugin, options)` from `.eleventy.js` / `eleventy.config.mjs` / `eleventy.config.cjs`. Internally the plugin MUST wrap a `GeneratorPlugin` (per PRD-400-R3) with `name: "@act/eleventy"` and a `version` matching the package's published version (per PRD-400-R20). Conformance: **Core**.

**PRD-408-R2.** The plugin MUST declare Eleventy 2.0+ as a peer dependency. Eleventy 1.x is out of scope; the plugin MUST surface a configuration error when instantiated against Eleventy < 2.0 (detected via `eleventyConfig.versionCheck` if available, or by probing the resolved Eleventy version at plugin-load time). Eleventy 3.0+ versions that retain the `eleventy.after` hook surface are permitted. Conformance: **Core**.

#### Source-discovery

**PRD-408-R3.** The plugin MUST auto-wire PRD-201's markdown adapter (`@act/markdown`) against Eleventy's resolved input directory. The adapter's `sourceDir` option MUST default to `eleventyConfig.dir.input` (Eleventy's documented `dir.input`, default `.` per Eleventy's plugin contract). The adapter's glob defaults to `**/*.md{,x}` per PRD-201; Eleventy's `.eleventyignore` MUST be honored (the plugin reads the ignore file and threads ignored paths into the adapter's options). The plugin MUST NOT walk template files (`.njk`, `.liquid`, `.hbs`, `.ejs`, `.webc`, `.11ty.js`); template-engine output is post-build, not source. Conformance: **Core**.

#### `addPlugin` integration

**PRD-408-R4.** A host enables the plugin by passing it to `eleventyConfig.addPlugin(actPlugin, options)` in its Eleventy config (`.eleventy.js` / `eleventy.config.mjs` / `eleventy.config.cjs`). The plugin MUST validate its options against the shape pinned in §"Wire format / interface definition" and surface a configuration error before the build hook fires when validation fails. Conformance: **Core**.

#### Lifecycle and re-entry

**PRD-408-R5.** The PRD-400 pipeline MUST run at Eleventy's `eleventy.after` hook, which fires once Eleventy's build is complete (every output file written). The plugin MUST NOT run the pipeline at `eleventy.before` (build hasn't happened), at `eleventy.beforeWatch` (watch mode signal only), or at any per-template hook. Per PRD-408-R19, watch-mode rebuilds re-run the pipeline at each `eleventy.after`; the plugin MUST install a build-scoped re-entry guard (an in-flight `Promise<BuildReport>`) to prevent overlapping pipeline runs when `after` fires concurrently with an in-flight build. Conformance: **Core**.

#### Permalink-aware filtering

**PRD-408-R6.** When Eleventy's `eleventy.after` callback receives a `results` array (per Eleventy 2.0+'s documented signature), the plugin MUST cross-reference each markdown source the adapter enumerated against the `results` array, keyed on the source file's path. Source files NOT present in `results` are excluded from Eleventy's public output (typically due to `permalink: false`, an `eleventyExcludeFromCollections: true` flag, draft-mode filtering, or a host-defined data-cascade exclusion); these sources MUST be filtered from ACT emission BEFORE the merge stage runs. Filtered files do NOT produce ACT nodes; they MAY be reported in the build report's warnings array as `excluded_by_permalink`. Conformance: **Core**.

#### URL space independence

**PRD-408-R7.** The ACT manifest's URL space (the templates declared in `act.urlTemplates`) is INDEPENDENT of the host's site URL space (Eleventy's `permalink` and `url`). The plugin MUST emit ACT files at paths derived from `urlTemplates` per PRD-100-R12 / PRD-105-R1 / R4. Specifically: a markdown source at `posts/2026-05-01-hello.md` whose Eleventy-rendered URL is `/posts/hello/` would emit an ACT node at the path produced by substituting the source-derived ID (per PRD-201's default ID strategy, e.g., `posts/2026-05-01-hello`) into `node_url_template`. The plugin MUST NOT attempt to mirror Eleventy's URL space; the ACT URLs live at `/act/...` (per the host's `urlTemplates`). Conformance: **Core**.

#### Source of truth

**PRD-408-R8.** The plugin MUST treat the source markdown corpus (the `.md` / `.mdx` files in Eleventy's input dir) as the canonical input for ACT, not Eleventy's rendered output. The plugin MUST NOT parse Eleventy's rendered HTML / Markdown to derive ACT content. Frontmatter parsing, body-to-block mapping, summary derivation, ID assignment — all owned by PRD-201's adapter — operate on the source `.md` files directly. Eleventy's frontmatter cascade (data inherited from `*.json` data files, `_data/`, layout chains) is NOT part of the source the adapter sees; if the host wants cascaded frontmatter, they MUST set those keys explicitly in the source `.md` frontmatter. Conformance: **Core**.

#### Out-of-scope boundaries

**PRD-408-R9.** The plugin MUST NOT introspect template-engine ASTs (Nunjucks, Liquid, Handlebars, EJS, WebC, 11ty.js). Template content beyond the markdown body is opaque to ACT under PRD-408. A markdown file with embedded `{% include "header.njk" %}` shortcodes is treated as plain markdown by PRD-201; the shortcode text appears in the markdown source as-is. Authors who need richer extraction must adopt a component-driven framework (PRD-401 Astro, PRD-405 Next.js, PRD-407 Nuxt, PRD-404 Docusaurus). Conformance: **Core**.

**PRD-408-R10.** The plugin's options MUST NOT accept a `bindings` array. If the host supplies `bindings` in plugin options, the plugin MUST surface a configuration error at plugin-load time citing PRD-408-R10 with a message indicating that Eleventy is template-driven and component instrumentation is not supported. The error MUST point the host to PRD-407 (Nuxt) / PRD-401 (Astro) / PRD-405 (Next.js) for component-driven workflows. Conformance: **Core**.

#### Collection hints (optional)

**PRD-408-R11.** When the host has defined Eleventy collections via `eleventyConfig.addCollection(name, fn)`, the plugin MAY thread those collections into PRD-201's adapter options as a `collectionHints` field. Each collection hint MAY drive PRD-201's `parent`/`children` derivation: a node belonging to the collection `"posts"` may have its `parent` set to a synthetic posts-index node when the host opts in via `act.collections.synthesizeIndices: true`. This feature is OPTIONAL in v0.1; default behavior is to ignore Eleventy's collections (the markdown adapter operates on the file corpus alone). Conformance: **Standard**.

#### Plugin options shape

**PRD-408-R12.** The plugin options shape MUST be a strict subset of PRD-400's `GeneratorConfig`. The host supplies (via `eleventyConfig.addPlugin(actPlugin, options)`):

- `conformanceTarget?: "core" | "standard" | "plus"` (default `"core"`).
- `outputDir?: string` (default `eleventyConfig.dir.output`, per R13).
- `baseUrl: string` (the deployment origin).
- `manifest: { site: { name, ... } }`.
- `urlTemplates: { index_url, node_url_template, … }`.
- `failOnExtractionError?: boolean` (default `false`).
- `incremental?: boolean` (default `false` — Eleventy already manages its own incremental rebuild).
- `adapters?: AdapterEntry[]` (escape hatch — replaces auto-wired markdown adapter).
- `collections?: { synthesizeIndices?: boolean }` (per R11).
- `searchArtifactPath?: string` (per R17 Plus band; path to a precomputed search index relative to `outputDir`).
- `hooks?: { preBuild?, postBuild?, onError? }` (per PRD-400-R24).
- `parseMode` (string, OPTIONAL; one of `"coarse"`, `"fine"`; default `"coarse"`) — pass-through to PRD-201's `mode` config (PRD-201-R12). When set, the plugin MUST forward the value to the auto-wired PRD-201 markdown adapter instance. When omitted, the plugin preserves the PRD-201 default (`"coarse"`). The `parseMode` setting is independent of the conformance target (`conformanceTarget`). Setting `parseMode: "fine"` against a `conformanceTarget: "core"` build MUST fail at `init` per PRD-201-R23's level-mismatch rule (the markdown adapter refuses fine-mode emission against a Core target); the plugin surfaces the underlying adapter error verbatim. Conformance: **Core** (the field; **Standard** for the fine-grained behavior the field unlocks per PRD-201-R12). Added per amendment A10 (MINOR bump per PRD-108-R4(1)).

The plugin MUST translate this options block into a fully-formed `GeneratorConfig` before invoking `runPipeline`. The translated config MUST satisfy PRD-400-R31. The plugin MUST reject any `bindings` field per PRD-408-R10. Conformance: **Core**.

#### Output directory and atomic writes

**PRD-408-R13.** The plugin's default `outputDir` MUST be the host's resolved Eleventy output directory (`eleventyConfig.dir.output`, default `_site/`). The plugin MUST resolve this path from Eleventy's internal config rather than hard-coding the literal, so non-default Eleventy configurations work correctly. The host MAY override via `act.outputDir` in plugin options. The output directory MUST be inside the project root; an `outputDir` resolving outside the project root MUST be rejected at config validation per PRD-400-R31 / PRD-109. Conformance: **Core**.

**PRD-408-R14.** The plugin MUST delegate file emission to `@act/generator-runtime` so atomic writes (PRD-400-R23) are inherited unchanged. The plugin MUST NOT write any ACT-protocol file directly bypassing the runtime. Conformance: **Core**.

#### Build report

**PRD-408-R15.** The plugin MUST emit the build report sidecar at `outputDir/.act-build-report.json` per PRD-400-R27. The report's `generator` field MUST be `{ name: "@act/eleventy", version: <package version> }` per PRD-400-R20. The report MUST NOT be uploaded to the CDN; the plugin MUST add the path to Eleventy's ignore list via `eleventyConfig.ignores.add(...)` when the host's Eleventy version supports the API. Conformance: **Standard**.

#### Failure surface

**PRD-408-R16.** Failure surfaces compose with PRD-400 § Errors and PRD-201's failure modes. Eleventy-specific contracts:

| Condition | Plugin response | Build outcome |
|---|---|---|
| Eleventy < 2.0 detected | Configuration error per R2 | Non-zero exit |
| `act.outputDir` resolves outside project root | Configuration error per R13 | Non-zero exit |
| `act.bindings` supplied | Configuration error per R10 | Non-zero exit |
| Plugin options shape invalid | Configuration error per R4 | Non-zero exit |
| Adapter pinning fails | Inherited from PRD-400-R29 / R30 | Non-zero exit |
| `eleventy.after` invoked with empty `results` (zero output files) | Build warning (`empty_build`); pipeline still runs against the (possibly empty) markdown corpus | 0 (warning) |
| `eleventy.after` fires while a pipeline run is in flight | Re-entry guard awaits in-flight per R5 / R19 | 0 |
| Source file in adapter enumerate but absent from `results` | Filter the source per R6; warning `excluded_by_permalink` | 0 (warning) |
| Markdown adapter throws | Inherited from PRD-200-R18 | Non-zero exit |

Conformance: **Core**.

#### Conformance bands

**PRD-408-R17.** The plugin's achieved conformance level is computed by PRD-400-R17 from observed emissions. A Core deployment requires a manifest, an index, and one node file. Standard adds subtree emission for hierarchical content (typically derived from PRD-201's `parent`/`children` rules over the file path or via the optional collection hints from R11). Plus adds NDJSON index emission AND the search advertisement (per PRD-105-R7a). Because Eleventy is template-driven and has no native search backend, Plus requires the host to provide a precomputed search artifact path via `act.searchArtifactPath`; without that, the plugin MUST NOT advertise `search_url_template` in the manifest, and the achieved level MUST NOT exceed Standard even when `conformanceTarget: "plus"` is configured. The plugin MUST surface a build warning when the configured target is Plus but no search artifact is supplied (level downgrade per PRD-400-R17). Conformance: **Core** (the rule itself; bands inherited from PRD-107).

#### Pinning enforcement

**PRD-408-R18.** The plugin MUST inherit PRD-400's pinning enforcement (R29 Stage 1, R30 Stage 2). The plugin MUST NOT bypass pinning even when the host's `act.adapters` specifies adapters explicitly. Conformance: **Core**.

#### Watch mode

**PRD-408-R19.** The plugin MUST support Eleventy's watch mode (`eleventy --watch` / `eleventy --serve`). When Eleventy re-runs a build in response to a file change, the `eleventy.after` hook fires again and the plugin re-runs the canonical pipeline. The re-entry guard from R5 prevents overlapping runs; if a file change triggers `after` while the previous pipeline is still in flight, the plugin MUST wait for the in-flight build to complete and THEN run a fresh pipeline against the new state. The plugin MUST NOT discard pending change signals; rapid successive saves trigger the re-entry guard, not silent dropping. Watch-mode rebuilds SHOULD be incremental on the markdown adapter side (PRD-201 supports incremental enumerate), but the canonical pipeline (PRD-400-R22) is NOT incremental by default for this plugin (incremental rebuilds default to false per R12 because Eleventy already manages its own incremental layer). Conformance: **Standard**.

#### Test-fixture conformance

**PRD-408-R20.** The plugin MUST pass the framework conformance fixture corpus enumerated under `fixtures/400/` per PRD-400-R28, plus the Eleventy-specific corpus under `fixtures/408/`. The Eleventy-specific corpus exercises lifecycle ordering (`eleventy.after` placement), permalink-aware filtering, URL-space independence, and watch-mode re-entry. PRD-600 ships the fixture-runner. Conformance: **Core**.

### Wire format / interface definition

PRD-408 introduces no new wire format. The plugin emits per PRD-100 envelopes through `@act/generator-runtime`. The interface contract is the TypeScript shape below.

#### Plugin options shape

```ts
// @act/eleventy/src/types.ts
import type {
  GeneratorConfig,
  AdapterEntry,
  BuildHooks,
} from "@act/generator-runtime";

/**
 * Plugin options surface in .eleventy.js / eleventy.config.mjs:
 *
 *   import actPlugin from "@act/eleventy";
 *   export default function (eleventyConfig) {
 *     eleventyConfig.addPlugin(actPlugin, {
 *       conformanceTarget: "standard",
 *       baseUrl: "https://example.com",
 *       manifest: { site: { name: "Example Blog" } },
 *       urlTemplates: { index_url: "/act/index.json", node_url_template: "/act/n/{id}.json" },
 *     });
 *   }
 *
 * PRD-408-R4, R12.
 */
export interface EleventyActOptions {
  conformanceTarget?: "core" | "standard" | "plus";   // default "core"
  outputDir?: string;                                  // default Eleventy dir.output
  baseUrl: string;
  manifest: GeneratorConfig["manifest"];
  urlTemplates: GeneratorConfig["urlTemplates"];
  failOnExtractionError?: boolean;                     // default false
  incremental?: boolean;                                // default false (Eleventy manages incremental)
  adapters?: AdapterEntry[];                            // escape hatch (replaces auto-wired markdown)
  collections?: { synthesizeIndices?: boolean };        // per R11
  searchArtifactPath?: string;                          // per R17 Plus band
  hooks?: BuildHooks;                                   // per PRD-400-R24
  /**
   * Body-to-block parse mode forwarded to PRD-201's auto-wired markdown
   * adapter (PRD-201-R12). "coarse" (default) emits one `markdown` block per
   * file; "fine" splits into prose / code / data / callout blocks. Setting
   * "fine" against `conformanceTarget: "core"` fails at init per PRD-201-R23.
   * Added per amendment A10 (MINOR bump per PRD-108-R4(1)).
   */
  parseMode?: "coarse" | "fine";
  // bindings?: never  --- per R10, supplying `bindings` is a configuration error.
}
```

#### Plugin function shape

```ts
// @act/eleventy/src/plugin.ts
// PRD-408-R1, R4, R5.

import type { EleventyConfig } from "@11ty/eleventy";
import type { EleventyActOptions } from "./types";
import { runPipeline } from "@act/generator-runtime";
import { buildGeneratorPlugin } from "./generator-plugin";

export default function actEleventyPlugin(
  eleventyConfig: EleventyConfig,
  options: EleventyActOptions,
): void {
  validateOptions(options);                              // PRD-408-R4, R10, R12
  enforceEleventyVersion(eleventyConfig);                // PRD-408-R2

  let inFlight: Promise<unknown> | undefined;

  eleventyConfig.on("eleventy.after", async ({ dir, results, runMode }) => {
    if (inFlight) await inFlight;                        // PRD-408-R5 / R19
    const plugin = buildGeneratorPlugin({ eleventyConfig, options, dir, results });
    inFlight = runPipeline(plugin, {
      hostContext: await plugin.resolveHostContext({ dir, results }),
    });
    try {
      await inFlight;
    } finally {
      inFlight = undefined;
    }
  });
}
```

### Errors

The plugin surfaces errors along the same axes as PRD-400 (recoverable warning vs unrecoverable error). The build report (PRD-400-R27) enumerates both. The table in §"Failure surface" pins plugin-specific contracts; the union with PRD-400 § Errors and PRD-201's failure modes is the full surface.

| Condition | Plugin behavior | Build outcome |
|---|---|---|
| Eleventy < 2.0 detected | Refuse to load | Non-zero exit |
| `act.bindings` supplied | Refuse to load | Non-zero exit |
| Plugin options invalid | Refuse to load | Non-zero exit |
| `outputDir` outside project root | Refuse to load | Non-zero exit |
| Adapter pinning fails | Inherit PRD-400-R29 / R30 | Non-zero exit |
| Source file in adapter enumerate but absent from `results` | Filter; warn | 0 (warning) |
| `eleventy.after` invoked with no source files | Emit empty manifest + index; warn | 0 (warning) |
| Concurrent `after` invocations | Re-entry guard awaits | 0 |
| Configured target Plus but no `searchArtifactPath` | Downgrade to Standard; warn (per PRD-400-R17) | 0 (warning) |
| Markdown adapter throws on a file | Inherit PRD-200-R18 | Non-zero exit |
| Build report write fails | Inherit PRD-400-R23 / R27 | Non-zero exit |

---

## Examples

Worked examples are non-normative but consistent with the Specification section. Each maps to one or more positive fixtures under `fixtures/408/positive/`.

### Example 1 — Minimum Core blog

A small Eleventy blog has `posts/2026-04-15-hello.md`, `posts/2026-05-01-second-post.md`, and `index.md` in the input directory (default `.`). `.eleventy.js`:

```js
// .eleventy.js
const actPlugin = require("@act/eleventy").default;

module.exports = function (eleventyConfig) {
  eleventyConfig.addPlugin(actPlugin, {
    conformanceTarget: "core",
    baseUrl: "https://example.com",
    manifest: { site: { name: "Example Blog" } },
    urlTemplates: {
      index_url: "/act/index.json",
      node_url_template: "/act/n/{id}.json",
    },
  });
  return { dir: { input: ".", output: "_site" } };
};
```

The build (`npx @11ty/eleventy`) runs:

1. Eleventy walks the input dir; produces three rendered HTML files in `_site/`.
2. `eleventy.after` fires with `results` containing three entries.
3. The plugin invokes the canonical pipeline:
   - Adapters: `@act/markdown` enumerates the three `.md` files (auto-wired per R3).
   - No bindings; component extraction is skipped per R10.
   - Cross-reference per R6: all three files are in `results`; none filtered.
   - Merge: three nodes; no collisions.
   - Validate, ETag, emit.
4. Output: `_site/.well-known/act.json`, `_site/act/index.json`, three node files at `_site/act/n/<id>.json`.

Achieved level: Core. Capabilities: `etag: true`. The build report sidecar is at `_site/.act-build-report.json`. Maps to `fixtures/408/positive/minimum-core-eleventy.json`.

### Example 2 — Permalink-aware filtering

The same blog has a fourth file `drafts/work-in-progress.md` whose frontmatter sets `permalink: false`:

```markdown
---
title: WIP
permalink: false
---
This is a draft.
```

The build runs:

1. Eleventy excludes the draft from `_site/`; `results` contains only three entries (the published files).
2. The plugin's markdown adapter enumerates four files (it walks the source corpus regardless of permalink).
3. Cross-reference per R6: `drafts/work-in-progress.md` is in adapter enumerate but NOT in `results`; the plugin filters the corresponding ACT node before merge.
4. Output: same three ACT files as Example 1, no node for the draft.

The build report includes a warning:

```json
{
  "warnings": [
    {
      "code": "excluded_by_permalink",
      "requirement": "PRD-408-R6",
      "message": "Source 'drafts/work-in-progress.md' has permalink: false; excluded from ACT emission."
    }
  ]
}
```

Maps to `fixtures/408/positive/permalink-false-excluded.json`.

### Example 3 — Component bindings rejected (negative)

A host attempts to supply `bindings`:

```js
eleventyConfig.addPlugin(actPlugin, {
  baseUrl: "https://example.com",
  manifest: { site: { name: "Example" } },
  urlTemplates: { index_url: "/act/index.json", node_url_template: "/act/n/{id}.json" },
  bindings: [{ binding: someReactBinding, options: {} }],   // R10 violation
});
```

Plugin-load fails:

```
error: PRD-408-R10: @act/eleventy does not support component bindings.
       Eleventy is template-driven; component instrumentation is out of scope.
       For component-driven workflows, see @act/astro (PRD-401), @act/next (PRD-405), or @act/nuxt (PRD-407).
```

Maps to `fixtures/408/negative/bindings-supplied.json`.

### Example 4 — Plus target without search artifact (downgrade)

A host configures `conformanceTarget: "plus"` but does not supply `searchArtifactPath`:

```js
eleventyConfig.addPlugin(actPlugin, {
  conformanceTarget: "plus",
  baseUrl: "https://example.com",
  manifest: { site: { name: "Example" } },
  urlTemplates: {
    index_url: "/act/index.json",
    node_url_template: "/act/n/{id}.json",
    subtree_url_template: "/act/sub/{id}.json",
    index_ndjson_url: "/act/index.ndjson",
    search_url_template: "/act/search?q={query}",
  },
});
```

The pipeline emits subtree files and the NDJSON index, but does not advertise `search_url_template` (per R17 / PRD-105-R7a). The achieved level is downgraded to Standard. The build report:

```json
{
  "conformanceTarget": "plus",
  "conformanceAchieved": "standard",
  "warnings": [
    {
      "code": "level_downgraded",
      "requirement": "PRD-408-R17",
      "message": "conformanceTarget: plus but no searchArtifactPath supplied. Plus requires a precomputed search artifact under @act/eleventy."
    }
  ],
  "capabilities": { "etag": true, "subtree": true, "ndjson_index": true, "search": { "template_advertised": false } }
}
```

Maps to `fixtures/408/positive/plus-target-without-search-artifact-downgrades.json`.

---

## Test fixtures

Fixtures live under `fixtures/408/`. The plugin MUST pass PRD-400's framework corpus under `fixtures/400/` plus the Eleventy-specific corpus enumerated below. Files NOT created in this PRD.

### Positive

- `fixtures/408/positive/minimum-core-eleventy/` → satisfies R1, R2, R3, R4, R5, R7, R8, R12, R13, R14, R15, R17 (Core), R18, R20.
- `fixtures/408/positive/permalink-false-excluded/` → satisfies R6.
- `fixtures/408/positive/eleventy-exclude-from-collections/` → satisfies R6 (the `eleventyExcludeFromCollections` flag also excludes from `results`; R6 filter applies).
- `fixtures/408/positive/standard-with-subtree-from-directory-tree/` → satisfies R11, R17 (Standard band).
- `fixtures/408/positive/collection-hints-synthesize-index/` → satisfies R11 (`act.collections.synthesizeIndices: true`).
- `fixtures/408/positive/plus-with-search-artifact/` → satisfies R17 (Plus band) with `searchArtifactPath` supplied.
- `fixtures/408/positive/plus-target-without-search-artifact-downgrades/` → satisfies R17 (downgrade path).
- `fixtures/408/positive/watch-mode-re-entry-guard/` → satisfies R5, R19. Two rapid `after` invocations; guard serializes them.
- `fixtures/408/positive/eleventyignore-respected/` → satisfies R3. Files in `.eleventyignore` are skipped by the adapter.
- `fixtures/408/positive/url-space-independent-of-eleventy-permalinks/` → satisfies R7. Eleventy URLs (`/posts/hello/`) and ACT URLs (`/act/n/posts/2026-04-15-hello.json`) coexist.
- `fixtures/408/positive/explicit-adapters-replace-auto-wiring/` → satisfies R12. Host supplies `act.adapters`; auto-wired markdown adapter is replaced.
- `fixtures/408/positive/output-dir-respects-eleventy-dir-output/` → satisfies R13. Host's `dir.output: "_dist"`; module resolves to `_dist`.
- `fixtures/408/positive/build-report-at-output-dir/` → satisfies R15.

### Negative

- `fixtures/408/negative/bindings-supplied/` → MUST fail. R10.
- `fixtures/408/negative/eleventy-1-x-detected/` → MUST fail. R2.
- `fixtures/408/negative/output-dir-outside-project-root/` → MUST fail. R13.
- `fixtures/408/negative/options-shape-invalid/` → MUST fail. R4. Missing `manifest.site.name`.
- `fixtures/408/negative/adapter-pinning-mismatch/` → MUST fail. Inherited from PRD-400-R29.
- `fixtures/408/negative/source-not-in-results-not-filtered/` → MUST fail. R6 violated by buggy plugin variant; runner detects an ACT node for a `permalink: false` file.
- `fixtures/408/negative/concurrent-after-without-guard/` → MUST recover. Two `after` invocations overlap; guard prevents data races.
- `fixtures/408/negative/empty-build-no-warning/` → MUST fail. R16: empty `results` MUST surface the `empty_build` warning; absence of the warning is non-conformant.
- `fixtures/408/negative/template-engine-introspection-attempted/` → MUST fail. R9 violated by a hypothetical extension that walks Nunjucks ASTs and emits `marketing:*` blocks; runner detects the policy violation.

---

## Versioning & compatibility

Per PRD-108, classify each kind of change to PRD-408 as MAJOR or MINOR.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add an optional field to `EleventyActOptions` (e.g., `act.assetsDir`) | MINOR | PRD-108-R4(1). |
| Add a required field to `EleventyActOptions` | MAJOR | PRD-108-R5(1). |
| Permit a `bindings` field (relax R10) | MAJOR | Reverses an explicit prohibition; affects every existing config that ignores the field. |
| Change which Eleventy hook the pipeline runs at (e.g., move from `eleventy.after` to `eleventy.before`) | MAJOR | PRD-108-R5(7). |
| Drop Eleventy 2.x support in favor of Eleventy 3.x-only | MAJOR | PRD-108-R5(1). |
| Change the default `outputDir` from Eleventy's `dir.output` to a different path | MAJOR | Tooling depends on the path. |
| Add support for a new template-engine introspection mode (relax R9) | MAJOR | Out-of-scope boundary change. |
| Add support for an optional collection-hint feature beyond R11 | MINOR | Additive. |
| Tighten `failOnExtractionError` default from false to true | MAJOR | PRD-108-R5(3). |
| Add a new plugin hook surface | MINOR | PRD-108-R4(1). |
| Change the build-report path from `outputDir/.act-build-report.json` | MAJOR | Inherited from PRD-400-R27. |
| Add auto-detection for `@11ty/eleventy-plugin-i18n` (a future ecosystem plugin) | MINOR | Additive auto-wiring. |

### Forward compatibility

A `@act/eleventy@0.1.x` package runs against any Eleventy 2.x or 3.x release that retains the documented `eleventy.after` hook surface. The plugin tolerates unknown additions to the hook's arguments per PRD-108-R7. Plugin-options consumers tolerate unknown optional fields.

### Backward compatibility

A v0.1 plugin runs against a v0.2 generator-runtime provided no MAJOR change has been made to the `GeneratorPlugin` interface, the `BuildHooks` shape, or the `EleventyActOptions` shape. Adding optional fields is non-breaking.

---

## Security considerations

This section cites PRD-109 for the project-wide threat model and PRD-400 § Security for generator-specific deltas. PRD-408 inherits both and documents only Eleventy-specific posture.

**Build-process trust boundary.** Eleventy builds run in the developer's or CI's Node.js process. The plugin is trusted code per PRD-200's Security section. The trust boundary is the build-input layer: `.eleventy.js` is operator-authored; the markdown corpus is author-authored. PRD-408 does not introduce new code-execution surfaces beyond what PRD-201 already does (PRD-201 reads markdown frontmatter and parses markdown bodies; no shell exec, no template-engine evaluation).

**No template-engine evaluation in the ACT path.** Per PRD-408-R8 / R9, the plugin reads source `.md` files only; it does NOT evaluate Nunjucks / Liquid / Handlebars / EJS / WebC / 11ty.js templates as part of ACT extraction. This isolates the ACT pipeline from any template-engine-specific code-execution risks (Eleventy's own template evaluation runs in the same process, but the ACT plugin does not invoke it).

**Permalink-filtering as information-disclosure boundary.** Files marked `permalink: false` are typically drafts, archived content, or templates the host has explicitly excluded from public output. PRD-408-R6 mandates that these files NOT appear in ACT emission, since ACT's static profile is unauthenticated and would expose the excluded content if it leaked. The plugin's cross-reference between adapter enumerate and Eleventy's `results` IS a security control, not just a correctness control. PRD-109's information-disclosure threat applies; PRD-408-R6 is the mitigation.

**Output-directory permissions.** The plugin's default `outputDir` is Eleventy's `dir.output` — already writable by the build process. The plugin MUST NOT change permissions on existing files. Per R13, `outputDir` paths resolving outside the project root are rejected.

**Build report as observability artifact.** Per PRD-400-R27, the build report is local-only. The plugin MUST add `outputDir/.act-build-report.json` to Eleventy's ignore list via `eleventyConfig.ignores.add(...)` when supported; if not supported on the host's Eleventy version, the plugin MUST surface a build warning advising manual exclusion (e.g., `.gitignore` + CDN-config exclusion).

For all other concerns — auth-scheme negotiation (N/A), ETag determinism (delegated to PRD-103), cross-origin trust (N/A for the generator), PII in error messages (delegated to PRD-109-R14 / R15) — cite PRD-109 directly.

---

## Implementation notes

This section is required for SDK / generator PRDs per workflow.md Phase 3. Snippets show the canonical TypeScript shape; the full implementation lives in the `@act/eleventy` package repo.

### Snippet 1 — The plugin entry point

```ts
// @act/eleventy/src/index.ts
// PRD-408-R1, R4, R5, R10, R19.

import type { EleventyConfig } from "@11ty/eleventy";
import type { EleventyActOptions } from "./types";
import { runPipeline } from "@act/generator-runtime";
import { buildGeneratorPlugin } from "./generator-plugin";

export default function actEleventyPlugin(
  eleventyConfig: EleventyConfig,
  options: EleventyActOptions,
): void {
  if ("bindings" in options) {
    throw new Error(
      "PRD-408-R10: @act/eleventy does not support component bindings. " +
      "Eleventy is template-driven; component instrumentation is out of scope. " +
      "For component-driven workflows, see @act/astro (PRD-401), @act/next (PRD-405), or @act/nuxt (PRD-407).",
    );
  }
  validateOptions(options);                              // PRD-408-R4, R12
  enforceEleventyVersion(eleventyConfig);                // PRD-408-R2

  // Re-entry guard for watch mode (PRD-408-R5 / R19).
  let inFlight: Promise<unknown> | undefined;

  eleventyConfig.on("eleventy.after", async ({ dir, results, runMode }) => {
    if (inFlight) await inFlight;
    const plugin = buildGeneratorPlugin({ eleventyConfig, options, dir, results });
    inFlight = (async () => {
      const hostContext = await plugin.resolveHostContext({ dir, results });
      return runPipeline(plugin, { hostContext });
    })();
    try {
      await inFlight;
    } finally {
      inFlight = undefined;
    }
  });

  // Add the build report path to Eleventy's ignore list when supported.
  // PRD-408-R15.
  try {
    const reportRel = `${options.outputDir ?? "_site"}/.act-build-report.json`;
    eleventyConfig.ignores?.add?.(reportRel);
  } catch { /* best-effort; older Eleventy versions lack ignores.add */ }
}
```

### Snippet 2 — The `GeneratorPlugin` shape (Eleventy-side)

```ts
// @act/eleventy/src/generator-plugin.ts
// PRD-408-R1, R3, R6, R7, R12, R13.

import type { GeneratorPlugin, GeneratorConfig, HostContext } from "@act/generator-runtime";
import { markdownAdapter } from "@act/markdown";
import type { EleventyActOptions } from "./types";

export function buildGeneratorPlugin(args: {
  eleventyConfig: any;
  options: EleventyActOptions;
  dir: { input: string; output: string; data?: string; includes?: string };
  results: Array<{ inputPath: string; outputPath: string; url: string }>;
}): GeneratorPlugin {
  const { eleventyConfig, options, dir, results } = args;

  return {
    name: "@act/eleventy",
    version: "0.1.0",                                   // PRD-400-R20
    async resolveHostContext(): Promise<HostContext> {
      // Auto-wire the markdown adapter against Eleventy's input dir (PRD-408-R3).
      const adapters = options.adapters ?? [
        {
          adapter: markdownAdapter,
          options: {
            sourceDir: dir.input,
            // Threading Eleventy's published-file set into the adapter so PRD-408-R6
            // can filter at merge time:
            includeOnly: results.map((r) => r.inputPath),
            collectionHints: options.collections?.synthesizeIndices
              ? readEleventyCollections(eleventyConfig)
              : undefined,
          },
        },
      ];

      const generatorConfig: GeneratorConfig = {
        actVersion: "0.1",
        conformanceTarget: options.conformanceTarget ?? "core",
        outputDir: options.outputDir ?? dir.output,
        baseUrl: options.baseUrl,
        adapters,
        manifest: options.manifest,
        urlTemplates: options.urlTemplates,
        failOnExtractionError: options.failOnExtractionError ?? false,
        incremental: options.incremental ?? false,       // Eleventy manages incremental on its side
      };

      return {
        projectRoot: process.cwd(),
        routes: [],                                      // No bindings (PRD-408-R10).
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

### Snippet 3 — Permalink-aware filtering

```ts
// @act/eleventy/src/permalink-filter.ts
// PRD-408-R6.

// The markdown adapter walks the input dir and produces a candidate node set.
// We cross-reference against Eleventy's `results` array (the published-file set)
// and filter out nodes whose source file is NOT in `results`.
//
// This runs as part of the adapter's `enumerate` stage via the `includeOnly`
// option threaded in from `buildGeneratorPlugin`. The adapter's enumerate skips
// any source file whose path is not in `includeOnly`.

export function publishedSourcePaths(
  results: Array<{ inputPath: string }>,
): Set<string> {
  // Eleventy's `inputPath` is project-relative (e.g., "./posts/hello.md");
  // PRD-201's adapter normalizes to absolute. We normalize on both sides.
  return new Set(results.map((r) => normalizeRelative(r.inputPath)));
}

function normalizeRelative(p: string): string {
  return p.replace(/^\.\//, "");
}
```

### Snippet 4 — Eleventy version enforcement

```ts
// @act/eleventy/src/version.ts
// PRD-408-R2.

export function enforceEleventyVersion(eleventyConfig: any): void {
  // Eleventy 2.0+ exposes `versionCheck` (a function) that throws on a mismatch.
  if (typeof eleventyConfig?.versionCheck === "function") {
    try {
      eleventyConfig.versionCheck(">=2.0.0");
      return;
    } catch (err) {
      throw new Error(
        "PRD-408-R2: @act/eleventy requires Eleventy 2.0+. " +
        "Detected: " + (err as Error).message,
      );
    }
  }
  // Older Eleventy versions don't have versionCheck — that itself signals < 2.0.
  throw new Error(
    "PRD-408-R2: @act/eleventy requires Eleventy 2.0+. The host's Eleventy version " +
    "does not expose `versionCheck`, indicating a pre-2.0 release.",
  );
}
```

These snippets sketch the canonical shape; the full plugin includes additional setup-time validation, error mapping, observability, and tests.

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review. Decisions: (Q1) `addCollection` hint surface added as optional, default off; (Q2) no `@11ty/eleventy-plugin-rss` metadata derivation in v0.1; (Q3) watch-mode integration via `eleventy.after` with re-entry guard; (Q4) build report excluded from Eleventy's CDN-bound output via ignore-list integration where supported, docs workaround otherwise; (Q5) host MAY override `outputDir` away from Eleventy's resolved `dir.output`. |
| 2026-05-01 | Jeremy Forsythe | Initial draft. Locks the `@act/eleventy` plugin shape under Eleventy 2.0+ (Eleventy 1.x out of scope), the canonical `eleventy.after` hook placement for the PRD-400 pipeline, the auto-wiring of PRD-201's markdown adapter against Eleventy's input directory with `.eleventyignore` honored, the explicit out-of-scope stance on component instrumentation (PRD-300 / 301 / 302 / 303 not consumed; `bindings` field in options is a configuration error per R10), the permalink-aware filter that cross-references the markdown adapter's enumerate output against Eleventy's `results` array (so `permalink: false` files don't leak into ACT emission), the URL-space independence rule (ACT URLs derive from `urlTemplates`, not from Eleventy's `permalink`), the no-template-engine-introspection boundary (Nunjucks / Liquid / Handlebars / EJS / WebC / 11ty.js templates are opaque to ACT), the optional collection-hints feature for subtree emission, the plugin options shape as a strict subset of `GeneratorConfig`, the default `outputDir` of Eleventy's `dir.output`, the inherited atomic-write contract via `@act/generator-runtime`, the inherited build report sidecar with Eleventy ignore-list integration, the inherited pinning enforcement (PRD-400-R29 / R30), the watch-mode re-entry guard, and the conformance-band achievability (Core floor; Plus requires precomputed search artifact via `searchArtifactPath`). Test fixtures enumerated under `fixtures/408/`; no fixture files created. No new JSON Schemas under `schemas/408/`. Cites PRD-100 (Accepted), PRD-103 (Accepted), PRD-105 (Accepted), PRD-107 (Accepted), PRD-108 (Accepted), PRD-109 (Accepted), PRD-200 (In review), PRD-201 (In review), PRD-400 (In review). Status: Draft → In review. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
| 2026-05-02 | Spec Steward | **MINOR bump per PRD-108-R4(1)** (additive optional field). Inline edit per SOP-3 of amendment A10 (sibling sweep of A2; pre-staged for the Adapter/Generator Engineer at Track B PRD-408 entry, accepted by BDFL on 2026-05-02 — landing the spec edit now, ahead of the implementation pickup, since it's purely additive). Added `parseMode` (`"coarse" \| "fine"`, default `"coarse"`) to PRD-408-R12's plugin options shape and to the `EleventyActOptions` TypeScript interface as a pass-through to PRD-201's `mode` config (PRD-201-R12). Default `"coarse"` preserves byte-identical behavior for every pre-amendment deployment; `"fine"` is opt-in. The level-mismatch rule from PRD-201-R23 applies — `parseMode: "fine"` against `conformanceTarget: "core"` fails at adapter `init`. PRD-408 stays Accepted. |
