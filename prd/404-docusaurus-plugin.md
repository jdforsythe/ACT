# PRD-404 — Docusaurus plugin

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

Docusaurus is the second canonical first-party host framework target for ACT v0.1: PRD-701 (large documentation site) gates on PRD-404, decision Q7's aspirational partner list pairs Docusaurus with Astro on the static-profile dimension, and Docusaurus's enormous existing user base (thousands of OSS projects, every-major-cloud documentation sites) makes it the highest-leverage adoption surface for the static profile. PRD-400 (in review) defines the canonical pipeline; PRD-401 (this leaf's sibling, in review) covers Astro. Docusaurus differs from Astro along three axes that demand a separate leaf:

1. **Docusaurus's plugin lifecycle** uses `loadContent` / `contentLoaded` / `postBuild`, not Astro's `astro:build:*`. The PRD-400 pipeline runs at `postBuild`.
2. **Docusaurus's content model** is multi-source: docs (`docs/**`), blog (`blog/**`), and pages (`src/pages/**`), with sidebars defined separately in `sidebars.js`. Mapping these to ACT's flat node space and the `parent`/`children` relations requires a Docusaurus-specific normalizer.
3. **Docusaurus has first-class versioned docs and i18n** as part of its core feature set, not bolt-on flags. Versioned docs map to PRD-105-R16 / gap E2's versioned-trees layout; locales map to PRD-104 / PRD-207.

Without a leaf PRD pinning the plugin lifecycle hooks, the docs/blog/pages routing into PRD-201 (markdown adapter) plus PRD-301 (React binding for MDX components and React `src/pages` modules), the sidebar-to-`parent`/`children` derivation rule, the versioned-docs mounting model under `mounts`, and the i18n auto-wiring to PRD-207 — every Docusaurus integrator relitigates the same surface. PRD-100 / PRD-103 / PRD-104 / PRD-105 / PRD-107 / PRD-108 / PRD-109 (Accepted) define the wire format, ETag, i18n model, static delivery profile, conformance bands, version-pinning, and security posture. PRD-200 / PRD-300 / PRD-301 / PRD-400 (in review) define the adapter, component contract, React binding, and generator architecture. PRD-201 (Draft) is the markdown adapter wired to docs and blog by default. PRD-207 (Draft) is the i18n adapter wired automatically when Docusaurus's `i18n` config declares additional locales. What's missing is the Docusaurus-specific glue.

### Goals

1. Pin the **plugin module shape**: `@act/docusaurus-plugin` is a Docusaurus plugin module per Docusaurus's plugin API; users register via `docusaurus.config.js` `plugins: [["@act/docusaurus-plugin", { ... }]]`.
2. Pin the **lifecycle hook placement**: implement Docusaurus's `loadContent`, `contentLoaded`, and `postBuild` plugin lifecycle methods. The PRD-400 pipeline runs at `postBuild` (after Docusaurus's static output is in `build/`).
3. Pin the **multi-source content wiring**: PRD-201 (markdown adapter) is wired automatically to docs (`docs/**`) and blog (`blog/**`) content; pages (`src/pages/**`) are component-extracted via PRD-301 (React binding). Users MAY swap or extend.
4. Pin the **sidebar mapping rule**: Docusaurus's `sidebars.js` defines a hierarchy of categories and doc IDs; the plugin auto-derives ACT `parent`/`children` relations from the sidebar tree. A doc nested under a category becomes a child of the category's synthesized parent node; a doc with no sidebar position becomes a top-level node.
5. Pin the **versioned-docs mounting model**: Docusaurus's versioned docs map to PRD-105-R16 / gap E2's versioned-trees layout. The plugin emits one manifest per version under `/v{N}/.well-known/act.json` AND mounts versions in the parent manifest's `mounts` per PRD-107-R5.
6. Pin the **i18n auto-wiring**: when Docusaurus's `i18n.locales` declares more than one locale, the plugin wires PRD-207 (i18n adapter) automatically and emits per PRD-104 (Pattern 2 default — Docusaurus's per-locale routing matches Pattern 2's per-locale manifests cleanly).
7. Pin the **output emission target**: the plugin emits per PRD-105 layout into Docusaurus's `outDir` (default `build/`).
8. Pin the **conformance band auto-detection**: Core by default; Standard when sidebars define a hierarchy (subtree-eligible); Plus when configured for NDJSON / search / marketing namespace OR when i18n is configured.
9. Enumerate the **test fixture layout** under `fixtures/404/positive/` and `fixtures/404/negative/`. No fixture files are created in this PRD.

### Non-goals

1. **Defining the canonical pipeline.** Owned by PRD-400 (in review).
2. **Defining the wire format envelopes.** Owned by PRD-100 (Accepted).
3. **Defining the markdown adapter.** Owned by PRD-201 (Draft).
4. **Defining the React binding.** Owned by PRD-301 (in review).
5. **Defining the i18n adapter.** Owned by PRD-207 (Draft).
6. **Defining Docusaurus's plugin API.** Owned by Docusaurus (external; see [Docusaurus plugin lifecycle](https://docusaurus.io/docs/api/plugin-methods)). PRD-404 conforms to it; it does not redefine it.
7. **Authoring a runtime SDK for Docusaurus.** Docusaurus is build-time-shaped; PRD-404 covers the static profile only. Runtime ACT under Docusaurus is a v0.2 question (no obvious use case — Docusaurus sites are statically deployed by design).
8. **Migration tooling for non-Docusaurus sites.** Out of scope; PRD-801 covers cross-stack migration.
9. **Defining new JSON Schemas.** No new schemas; the plugin emits per PRD-100.
10. **Search-backend integration.** Docusaurus has multiple search-plugin choices (Algolia, local-search); PRD-404's `search_url_template` advertisement (Plus) is opt-in via configuration. Wiring to Algolia or a specific search backend is out of scope; PRD-105-R7a's two patterns apply.

### Stakeholders / audience

- **Authors of:** PRD-701 (large Docusaurus documentation site, blocked by this PRD).
- **Consumers of (upstream):** PRD-400 (generator architecture), PRD-200 (adapter framework), PRD-201 (markdown adapter), PRD-300 (component contract), PRD-301 (React binding for MDX and pages), PRD-207 (i18n adapter, when applicable), PRD-105 (static delivery profile).
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Docusaurus's plugin API changes between major versions, breaking the lifecycle hook placement. | Medium | Medium | PRD-404-R1 pins Docusaurus `^3.0.0` as the supported peer dependency floor. A future Docusaurus 4.x bump is a MAJOR for this PRD. |
| Sidebar mapping produces unexpected `parent`/`children` relations because authors organize sidebars for navigation, not for taxonomy. | High | Medium | PRD-404-R6 documents the mapping rule precisely (categories become synthesized parents; docs nest under categories; sidebars without categories produce flat top-level nodes). Negative fixture `sidebar-orphan-doc.json` covers the orphan case. |
| Versioned docs produce a combinatorial explosion of manifests + mounts. | Medium | Medium | PRD-404-R8 specifies one manifest per version + mounts in parent; the user MAY scope versions emitted via configuration to limit. |
| MDX components in docs are not extractable (the SSR walk via PRD-301 doesn't run because Docusaurus's MDX is processed differently from Astro's SSR). | Medium | Medium | PRD-404-R7 inherits PRD-301-R24 (static-AST extraction) as the default for MDX-embedded React components; SSR-walk is opt-in. The static-AST path is appropriate for docs sites where most contracts are statically resolvable. |
| Per-locale build emits duplicate or conflicting nodes when the same doc is translated across locales but the source ID is shared. | Medium | High | PRD-404-R9 inherits PRD-104's i18n model strictly: Pattern 2 (per-locale manifests) is the default for Docusaurus; the plugin emits each locale into its own manifest space. ID-locale agreement per PRD-400-R16 is enforced. |
| Pages under `src/pages/**` are React components without consistent contract declarations (some `.tsx`, some `.mdx`, mixed conventions). | Medium | Medium | PRD-404-R5 documents the dispatch: `.mdx` pages go through PRD-201 first (markdown extraction) AND then PRD-301 (component extraction for embedded React); pure `.tsx` pages go through PRD-301 only. Authors who need a contract on a `.tsx` page declare it via `export const act = {…}` per PRD-301-R5. |
| Build report path conflicts with Docusaurus's own `build/` output (e.g., a Docusaurus-generated file with the same path). | Low | Low | PRD-404-R12 places the build report at `build/.act-build-report.json` (dot-prefixed, hidden); Docusaurus does not produce dot-prefixed files in `build/`. Atomic-write contract per PRD-400-R23. |
| Search-backend integration is left ambiguous; users who advertise `search_url_template` get a non-conformant Plus deployment. | Medium | Medium | PRD-404-R11 inherits PRD-105-R7a strictly: a producer that advertises `search_url_template` MUST fulfill via one of the two patterns; the plugin SHOULD warn when `search_url_template` is configured but no fulfillment artifact is detected. |

### Open questions

1. ~~Should the plugin auto-wire Algolia (the most common Docusaurus search plugin) when detected?~~ **Resolved (2026-05-01): No (v0.1).** Coupling to a specific search vendor in the spec is out of bounds. The plugin surfaces `search_url_template` advertisement; how the user fulfills it (Algolia, local-search, custom backend) is their choice. Revisit if PRD-701 testing surfaces a strong default. (Closes Open Question 1.)
2. ~~Should the plugin support Docusaurus's `swizzling` (theme component overrides) for surfacing ACT advertisements in the rendered HTML?~~ **Resolved (2026-05-01): No.** Same posture as PRD-401's `<link rel="act">` decision — HTML-mutation surface for low value; the well-known path is canonical discovery per PRD-101. (Closes Open Question 2.)
3. ~~Should the plugin support multi-instance Docusaurus deployments (one plugin instance per docs instance)?~~ **Resolved (2026-05-01): Yes — via the standard plugin-options pattern.** The plugin reads its instance's content via `pluginInstance.contentLoaded`; covered by PRD-404-R3. (Closes Open Question 3.)
4. ~~Should versioned-docs emission use Pattern 1 or Pattern 2 by default?~~ **Resolved (2026-05-01): Pattern 2 (per-version manifests).** Docusaurus's URL routing uses `/v1/...` paths naturally, matching Pattern 2's per-prefix manifest layout. User MAY override; default tracks Docusaurus's URL model. (Closes Open Question 4.)

### Acceptance criteria

- [ ] Every normative requirement has an ID `PRD-404-R{n}` and a declared conformance level per PRD-107.
- [ ] The Specification section opens with a table mapping every requirement to PRD-400 + PRD-200 + PRD-301 + 100-series requirements implemented.
- [ ] Implementation notes ship 3–6 short TypeScript snippets covering: plugin module export, lifecycle hook implementations, sidebar-to-parent/children mapping, versioned-docs mounting, i18n auto-wiring.
- [ ] Test fixture path layout under `fixtures/404/positive/` and `fixtures/404/negative/` is enumerated; one fixture per major requirement; no fixture files created.
- [ ] No new JSON Schemas.
- [ ] Versioning & compatibility section classifies every kind of change to PRD-404 per PRD-108.
- [ ] Security section cites PRD-109 + PRD-400 § Security and documents Docusaurus-specific deltas (versioned-docs trust boundary, MDX evaluation surface).
- [ ] Changelog entry dated 2026-05-01 by Jeremy Forsythe is present.

---

## Context & dependencies

### Depends on

- **PRD-100** (Accepted) — wire-format envelopes the plugin emits.
- **PRD-103** (Accepted) — ETag derivation; delegated to PRD-400's pipeline.
- **PRD-104** (Accepted) — i18n; plugin emits per Pattern 2 by default for Docusaurus locale routing.
- **PRD-105** (Accepted) — static delivery profile; plugin's emission target. PRD-105-R16 (versioned-trees layout) governs the versioned-docs case.
- **PRD-107** (Accepted) — conformance levels; plugin declares level per observed emissions. PRD-107-R5 (`mounts`) governs versioned-docs mounting.
- **PRD-108** (Accepted) — versioning policy.
- **PRD-109** (Accepted) — security posture.
- **PRD-200** (in review) — adapter framework.
- **PRD-201** (Draft) — markdown adapter; default wiring for docs and blog.
- **PRD-207** (Draft) — i18n adapter; auto-wired when Docusaurus's `i18n.locales` is non-trivial.
- **PRD-300** (in review) — component contract.
- **PRD-301** (in review) — React binding; consumed for `src/pages/**` and MDX-embedded React components.
- **PRD-400** (in review) — generator architecture; plugin wraps `runPipeline`.
- External: [Docusaurus plugin API](https://docusaurus.io/docs/api/plugin-methods), [Docusaurus sidebars](https://docusaurus.io/docs/sidebar), [Docusaurus versioning](https://docusaurus.io/docs/versioning), [Docusaurus i18n](https://docusaurus.io/docs/i18n/introduction). Docusaurus `^3.0.0` peer dependency floor.

### Blocks

- **PRD-701** (large Docusaurus documentation site) — direct dependency.

### References

- v0.1 draft: §6.2 (large documentation composite — PRD-701's source), §7 (build integration).
- `prd/000-decisions-needed.md` Q3 (TS-only first-party reference impl), Q7 (Docusaurus is an aspirational partner).
- Prior art: [`@docusaurus/plugin-content-docs`](https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-content-docs) (canonical reference for `loadContent` / `contentLoaded`); [`@docusaurus/plugin-sitemap`](https://docusaurus.io/docs/api/plugins/@docusaurus/plugin-sitemap) (canonical reference for `postBuild`-based static emission).

---

## Specification

This is the normative section. RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) apply as clarified by RFC 8174.

### PRD-400 + PRD-200 + PRD-301 + 100-series requirements implemented

| PRD-404 requirement | Upstream requirement(s) implemented or consumed | Relationship |
|---|---|---|
| R1 (plugin module shape) | PRD-400-R3 (`GeneratorPlugin` interface) | Module export satisfies Docusaurus's plugin contract AND wraps a `GeneratorPlugin`. |
| R2 (Docusaurus 3.x peer dependency) | — | Framework-version floor. |
| R3 (multi-instance support) | — | Docusaurus-specific; the plugin can be instantiated multiple times per site. |
| R4 (lifecycle hook implementation) | PRD-400-R24 (build hooks) | `loadContent` → discover; `contentLoaded` → adapter input; `postBuild` → pipeline run. |
| R5 (multi-source content wiring) | PRD-200-R2 (adapter lifecycle), PRD-201, PRD-301 | Docs/blog go to PRD-201; `src/pages/**` to PRD-301. |
| R6 (sidebar-to-parent/children mapping) | PRD-100-R23 (`parent` / `children` shape) | Plugin auto-derives ACT relations from `sidebars.js`. |
| R7 (MDX component extraction) | PRD-301-R24 (static-AST extraction) | Static-AST is default for MDX; SSR-walk opt-in. |
| R8 (versioned-docs mounting) | PRD-105-R16, PRD-107-R5 | One manifest per version; `mounts` in parent. |
| R9 (i18n auto-wiring) | PRD-104-R5/R6, PRD-207 | Pattern 2 default; plugin reads Docusaurus's `i18n` config. |
| R10 (output emission to `build/`) | PRD-105-R1/R2/R4, PRD-400-R9 | Files emitted under `build/.well-known/act.json`, `build/act/**`. |
| R11 (search advertisement is opt-in) | PRD-105-R7a, PRD-107-R10 | Plugin warns when advertised but unfulfilled. |
| R12 (build report at `build/.act-build-report.json`) | PRD-400-R27 | Sidecar artifact; not deployed. |
| R13 (atomic writes within `build/`) | PRD-400-R23 | Plugin writes only to ACT-owned paths. |
| R14 (conformance band auto-detection) | PRD-400-R17/R18 | From observed emissions. |
| R15 (adapter pinning enforcement) | PRD-400-R29/R30 | Plugin refuses adapters outside target version. |
| R16 (configuration shape) | PRD-400-R31 | Docusaurus-specific options nest under the standard plugin-options object. |
| R17 (logger plumbing) | PRD-400-R24 | Docusaurus's logger plumbed into `BuildContext.logger`. |
| R18 (page-level `export const act`) | PRD-301-R5 | `src/pages/**.tsx` and `.mdx` route modules' `act` export. |

### Conformance level

PRD-404 is a generator leaf; the level annotation indicates which band of producer output the requirement primarily affects. A Docusaurus plugin targeting Plus must satisfy every Core, Standard, and Plus-banded requirement.

- **Core:** PRD-404-R1, R2, R3, R4, R5, R6, R10, R12, R13, R14, R15, R16, R17.
- **Standard:** PRD-404-R7, R18 (component-extraction-related; lands at Standard or higher).
- **Plus:** PRD-404-R8 (versioned-docs mounting; opt-in scenario), R9 (i18n; Plus per PRD-107-R10), R11 (search advertisement; Plus per PRD-107-R10).

### Normative requirements

#### Plugin module shape

**PRD-404-R1.** The plugin MUST be published as the npm package `@act/docusaurus-plugin`. The package's default export MUST be a Docusaurus plugin function `(context, options) => Plugin<LoadedContent>` that satisfies Docusaurus's plugin API AND constructs a PRD-400 `GeneratorPlugin` internally. Users register via `docusaurus.config.js`:

```js
plugins: [["@act/docusaurus-plugin", { /* options */ }]]
```

The plugin MUST set `name: "@act/docusaurus-plugin"` on the returned object so Docusaurus's diagnostic output identifies it. Conformance: **Core**.

**PRD-404-R2.** The package MUST declare `@docusaurus/core ^3.0.0` as a peer dependency. Docusaurus 2.x and earlier are out of scope; the plugin MUST emit a build error if instantiated against a version below the floor. A future Docusaurus 4.x bump is a MAJOR change to PRD-404 per the Versioning table. Conformance: **Core**.

#### Multi-instance support

**PRD-404-R3.** The plugin MUST support multiple instances per Docusaurus site (the canonical `id` plugin-option is honored). When multiple instances are configured (e.g., one per docs instance in a multi-docs deployment), each instance produces its own ACT artifact set under a configurable `urlTemplates` namespace; users MUST set distinct `urlTemplates.index_url` per instance to avoid collision. The default — single instance, default URL templates — is unchanged. Conformance: **Core**.

#### Lifecycle hook implementation

**PRD-404-R4.** The plugin MUST implement Docusaurus's plugin lifecycle methods as follows:

- `loadContent()` — discover content sources. Read configured docs / blog instances, load `sidebars.js`, read versioned-docs metadata, read i18n configuration. Returns a normalized `LoadedContent` object the plugin uses internally.
- `contentLoaded({ content, actions })` — process the loaded content into adapter input. Build the adapter list (PRD-201 instances for docs and blog; PRD-301 binding for `src/pages/**`); build the binding list; resolve URL templates and conformance target.
- `postBuild({ outDir, content })` — invoke PRD-400's `runPipeline` per PRD-400-R1. The pipeline runs to completion before Docusaurus's build returns. The `outDir` is Docusaurus's resolved build directory (default `./build`).

The plugin MUST NOT register hooks Docusaurus does not document; experimental hooks are out of scope. Conformance: **Core**.

#### Multi-source content wiring (consumes PRD-201, PRD-301)

**PRD-404-R5.** Unless explicitly disabled, the plugin MUST auto-wire content sources as follows:

- **Docs** (`docs/**/*.{md,mdx}`) — PRD-201 markdown adapter, one instance per Docusaurus docs-plugin instance. The adapter receives the resolved doc entries (id, frontmatter, parsed body) via Docusaurus's `loadContent` output.
- **Blog** (`blog/**/*.{md,mdx}`) — PRD-201 markdown adapter, one instance for the blog plugin's content.
- **Pages** (`src/pages/**.{tsx,jsx,mdx}`) — PRD-301 React binding. `.tsx` and `.jsx` pages are component-extracted; `.mdx` pages go through PRD-201 first AND then PRD-301 for embedded React components.
- **Static `.md` pages** (`src/pages/**.md`) — PRD-201 markdown adapter (no React extraction needed).

Users MAY override the auto-wiring via the plugin's `adapters` option; in that case auto-detection is skipped. Conformance: **Core**.

#### Sidebar-to-parent/children mapping

**PRD-404-R6.** The plugin MUST auto-derive ACT `parent` / `children` relations (PRD-100-R23) from `sidebars.js`:

- A doc with sidebar position under a `category` becomes a child of the category. The plugin synthesizes a parent node (`type: "section"`, `id: <category-id>`, `title: <category.label>`, `summary: <category.description ?? "">`) for each category that contains docs.
- A doc nested under multiple sidebar categories (rare; e.g., the same doc appears in two sidebars) is a child of the first category encountered in `sidebars.js` traversal order; subsequent occurrences emit a build warning.
- A doc with no sidebar position becomes a top-level node with no `parent`. The build warning recorded in the build report identifies orphan docs (PRD-400-R27).
- A doc whose sidebar entry has `type: "link"` (an external link) is NOT emitted as an ACT node (external links are not ACT-resolvable).

The synthesized category node IDs MUST satisfy PRD-100-R10 (ID grammar); the plugin lowercases category labels and replaces non-grammar characters with hyphens. ID collisions between a synthesized category node and a real doc node are a hard error per PRD-200-R10. Conformance: **Core**.

#### MDX component extraction (Standard)

**PRD-404-R7.** When MDX docs (`*.mdx`) embed React components (e.g., `<Tabs>`, `<TabItem>`, `<Hero>`), the plugin MUST dispatch component extraction per PRD-301. The default extraction mode is `static-ast` (PRD-301-R24): the plugin's Babel/SWC scanner walks each MDX file's compiled output, recognizes component-contract declarations (`Component.act = { … }` literals, `useActContract({ … })` literal arguments, exported `act` const on the module), and emits PRD-300-stamped blocks. SSR-walk extraction (PRD-301-R10) is opt-in via the plugin's `extractMode: "ssr-walk"` option; it requires running Docusaurus's MDX compilation in an SSR context, which is more expensive but catches dynamic contracts. Every emitted block MUST carry `metadata.extraction_method` per PRD-301-R15. Conformance: **Standard**.

#### Versioned-docs mounting (Plus)

**PRD-404-R8.** When Docusaurus's docs plugin has versioned content (a `versions.json` file present and `versioned_docs/`/`versioned_sidebars/` populated), the plugin MUST emit one ACT manifest per version per PRD-105-R16:

- Current (unversioned) docs: emitted at the standard URL templates (`/.well-known/act.json`, `/act/index.json`, `/act/n/{id}.json`). The current-docs version is the canonical "latest" entry.
- Versioned docs (e.g., v1.0, v2.0): each version emitted at `/v{N}/.well-known/act.json`, `/v{N}/act/index.json`, `/v{N}/act/n/{id}.json`. The version path matches Docusaurus's URL routing for that version.
- The parent (current-docs) manifest MUST declare a `mounts` array per PRD-107-R5 with one entry per emitted version; each mount entry sets `prefix: "/v{N}/"`, `delivery: "static"`, `manifest_url: "/v{N}/.well-known/act.json"`, and (when known) `conformance.level` matching the version's achieved level.
- Mounts MUST NOT recurse per gap C5 / PRD-400-R19; a per-version manifest MUST NOT itself declare `mounts`.
- Cross-version `metadata.supersedes` / `metadata.superseded_by` relations on individual nodes are SHOULD per PRD-100-R47 / PRD-105-R16; the plugin MAY auto-derive when a doc with the same slug exists across versions, but MUST NOT silently force the relation if the slugs diverge.

Users MAY scope the version set emitted via `act({ versions: { include: ["current", "1.0"] } })` to limit combinatorial growth on sites with many archived versions. Conformance: **Plus**.

#### i18n auto-wiring (Plus)

**PRD-404-R9.** When Docusaurus's `i18n.locales` declares more than one locale (i.e., the array length is > 1), the plugin MUST automatically:

- Load PRD-207 (i18n adapter) and add it to the adapter list.
- Read Docusaurus's resolved per-locale content (translation strings, per-locale doc directories).
- Emit per PRD-104 Pattern 2: one parent manifest at `/.well-known/act.json` advertising `locales.manifest_url_template`; one per-locale manifest at `/{locale}/.well-known/act.json`; per-locale indexes and node files at the locale prefix.
- Thread the active locale into PRD-300-R7's `ExtractionContext.locale` so component-extracted blocks honor the locale per PRD-400-R14.

Pattern 1 (locale-prefixed IDs in a single manifest) is NOT the default for Docusaurus because Docusaurus's URL routing emits per-locale path prefixes natively; Pattern 2 maps to that routing without ID-grammar contortions. Users MAY override via `act({ i18n: { pattern: "1" } })` but the default tracks Docusaurus's URL model. The plugin MUST NOT mix patterns within a single build per PRD-104-R7 / PRD-400-R14. Conformance: **Plus**.

#### Output emission (consumes PRD-105)

**PRD-404-R10.** The plugin MUST emit the static file set per PRD-105 layout into Docusaurus's resolved `outDir` (default `./build`):

- `{outDir}/.well-known/act.json` — manifest (PRD-105-R1).
- `{outDir}/act/index.json` — index (PRD-105-R2).
- `{outDir}/act/n/{id}.json` — node files (PRD-105-R4).
- `{outDir}/act/sub/{id}.json` — subtree files (PRD-105-R6; Standard only; emitted for sidebar-derived category nodes).
- `{outDir}/act/index.ndjson` — NDJSON index (PRD-105-R7; Plus only).
- `{outDir}/v{N}/...` — per-version artifacts when versioning is active (PRD-404-R8).
- `{outDir}/{locale}/...` — per-locale artifacts when i18n is active (PRD-404-R9).
- `{outDir}/.act-build-report.json` — build report sidecar (PRD-400-R27).

The plugin MUST NOT emit ACT files outside these paths and MUST NOT modify Docusaurus's own emitted files (`index.html`, `assets/**`, etc.). Conformance: **Core**.

#### Search advertisement (Plus, opt-in)

**PRD-404-R11.** When the plugin's configuration declares `urlTemplates.search_url_template`, the plugin MUST verify a fulfillment artifact exists per PRD-105-R7a (a precomputed search-index JSON at a stable URL OR a hosted search backend whose URL substitutes into the template). When no fulfillment artifact is detected and `search_url_template` is configured, the plugin MUST emit a build warning citing PRD-105-R7a and SHOULD downgrade `capabilities.search.template_advertised` to false per PRD-400-R18. Auto-wiring to specific search vendors (Algolia, local-search) is OUT OF SCOPE for v0.1; users MUST configure fulfillment explicitly. Conformance: **Plus**.

#### Build report

**PRD-404-R12.** The plugin MUST write the build report at `{outDir}/.act-build-report.json` per PRD-400-R27. The report enumerates every emitted ACT file (Docusaurus-owned `index.html`, `assets/**`, etc., are NOT enumerated), every warning (sidebar orphans per PRD-404-R6, unfulfilled search advertisement per PRD-404-R11, MDX extraction placeholders per PRD-301-R22), and the achieved conformance level. The build report MUST NOT be uploaded to the CDN per PRD-400-R27. Conformance: **Core**.

#### Atomic writes within `build/`

**PRD-404-R13.** The plugin MUST honor PRD-400-R23's atomic-write contract: every ACT-owned file is written via tmp-then-rename within `outDir`. The plugin MUST NOT touch Docusaurus-owned paths. The on-error hook (PRD-400-R24) cleans up any lingering `*.tmp.*` files inside `outDir/.well-known/`, `outDir/act/`, `outDir/v*/`, `outDir/{locale}/`, and the build-report path. Conformance: **Core**.

#### Conformance band auto-detection

**PRD-404-R14.** The plugin MUST compute the achieved conformance band per PRD-400-R17. Docusaurus-specific signals:

- **Core:** Always achieved when emission completes successfully.
- **Standard:** Achieved iff sidebars produced subtree-eligible categories AND the plugin emitted at least one subtree file. The plugin auto-derives subtree-roots from `sidebars.js` categories (each category becomes a subtree-root candidate; the plugin emits a subtree file when the category contains 2+ child docs).
- **Plus:** Achieved iff Standard + (NDJSON index emitted OR i18n manifests emitted OR versioned-docs mounts emitted). Per PRD-400-R18, the plugin MUST NOT advertise Plus when any of the underlying files is missing.

Conformance: **Core**.

#### Adapter pinning enforcement

**PRD-404-R15.** The plugin MUST enforce PRD-400-R29 (Stage 1) and PRD-400-R30 (Stage 2) adapter pinning before any adapter `init` runs. The plugin surfaces failing adapters via Docusaurus's logger. Conformance: **Core**.

#### Configuration shape

**PRD-404-R16.** The plugin's options object MUST satisfy PRD-400-R31's `GeneratorConfig` minimum, with Docusaurus-specific defaults applied at `loadContent`:

- `actVersion` defaults to the spec MINOR the plugin was built against.
- `conformanceTarget` defaults to `"core"`; users opt up via `target: "standard" | "plus"`.
- `outputDir` defaults to Docusaurus's resolved `outDir` (typically `./build`); users MUST NOT override.
- `baseUrl` defaults to Docusaurus's resolved `siteConfig.url` + `siteConfig.baseUrl`.
- `adapters` defaults to auto-wired PRD-201 instances (one per docs/blog instance) plus PRD-301 for `src/pages/**`; users override via `adapters: [...]`.
- `urlTemplates` defaults to `{ index_url: "/act/index.json", node_url_template: "/act/n/{id}.json" }`.
- `i18n` per PRD-404-R9 (auto-wired when Docusaurus has multiple locales; opt-out via `i18n: false`).
- `versions` per PRD-404-R8 (auto-emitted for versioned-docs sites; opt-out / scope via `versions: { include: [...] }`).
- `failOnExtractionError` defaults to false.
- `incremental` defaults to true.

Docusaurus-specific extensions (e.g., `docsInstance: "docs"` to specify which docs-plugin instance to wire when there are multiple) are scoped under `act({ docusaurus: { ... } })` and are non-normative. Conformance: **Core**.

#### Logger plumbing

**PRD-404-R17.** The plugin MUST plumb Docusaurus's plugin logger (the `context.logger` supplied to plugin functions) into PRD-400's `BuildContext.logger`. All output goes through Docusaurus's logger; the plugin MUST NOT use `console.log` or `process.stderr` directly so that Docusaurus's `--log-level` flag works. Conformance: **Core**.

#### Page-level `export const act` (Standard)

**PRD-404-R18.** When a `src/pages/**.{tsx,jsx,mdx}` route module exports a top-level `act` constant, the plugin MUST read the export at build time per PRD-301-R5 (page-level boundary, const form) and supply it to PRD-301's `extractRoute`. Validation of the page contract's `id` per PRD-301-R7 / PRD-100-R10 happens before extraction. A page whose `act` export references runtime values not resolvable at build time produces a build warning and the plugin skips the page-level contract for that route. Conformance: **Standard**.

### Wire format / interface definition

PRD-404 introduces no JSON wire format; the plugin emits per PRD-100 envelopes through PRD-400's pipeline. The contract is the Docusaurus plugin shape and the plugin's options interface.

```ts
// packages/docusaurus-plugin/src/types.ts

import type { Plugin, LoadContext } from "@docusaurus/types";
import type { GeneratorConfig } from "@act/generator-runtime";

export interface ActDocusaurusOptions extends Partial<Omit<GeneratorConfig, "outputDir" | "baseUrl">> {
  /** Override target conformance level. Default "core". */
  target?: "core" | "standard" | "plus";

  /** Override extraction mode for embedded React. Default "static-ast". */
  extractMode?: "ssr-walk" | "static-ast";

  /** Disable i18n auto-wiring (default: auto-wire when locales > 1). */
  i18n?: boolean | { pattern: "1" | "2" };

  /** Scope versioned-docs emission. */
  versions?: false | { include: string[] };

  /** Docusaurus-specific extensions. */
  docusaurus?: {
    /** Which docs-plugin instance to wire (multi-docs deployments). */
    docsInstance?: string;
    /** Skip blog wiring entirely. */
    skipBlog?: boolean;
  };
}

/**
 * Default export of @act/docusaurus-plugin. Conforms to Docusaurus's plugin API.
 */
export default function actPlugin(
  context: LoadContext,
  options: ActDocusaurusOptions,
): Plugin<LoadedContent>;

export interface LoadedContent {
  docsInstances: ResolvedDocsContent[];
  blogContent?: ResolvedBlogContent;
  pagesContent: ResolvedPagesContent;
  sidebars: ResolvedSidebars;
  versions?: VersionedContent;
  locales: ResolvedLocales;
}
```

### Errors

| Condition | Plugin behavior | Build report severity | Exit code |
|---|---|---|---|
| Docusaurus version `< 3.0.0` | Refuse to load; surface peer-dependency mismatch | error | non-zero |
| Plugin instantiated multiple times with conflicting `urlTemplates` | Build error before pipeline | error | non-zero |
| Sidebar orphan doc (no sidebar position) | Surface warning; emit as top-level node | warning | 0 |
| Sidebar entry references doc ID that does not exist | Surface warning; skip the entry | warning | 0 |
| Synthesized category-node ID collides with a real doc ID | Hard error per PRD-200-R10 | error | non-zero |
| Versioned-docs detected but `versions.json` malformed | Build error before pipeline | error | non-zero |
| Mounts entry's `manifest_url` not reachable post-build | Build warning; mount entry retained | warning | 0 |
| `i18n.locales` declares > 1 locale but i18n adapter (PRD-207) not installed | Build error citing PRD-207 | error | non-zero |
| `search_url_template` configured but no fulfillment artifact detected | Surface warning; downgrade `capabilities.search.template_advertised: false` | warning | 0 |
| MDX page's static-AST extraction fails for a particular block | Placeholder per PRD-301-R22; warning recorded | warning | 0 |
| Page's `act` export references runtime-only values | Surface warning; skip page-level contract for that route | warning | 0 |
| Adapter pinning mismatch (Stage 1 or Stage 2) | Build error per PRD-400-R29/R30 | error | non-zero |
| Pipeline throws during `postBuild` | `onError` hook fires; cleanup; surface to Docusaurus's build error display | error | non-zero |
| `build/` write fails | Hard error after cleanup of tmp files | error | non-zero |
| Build report write fails | Hard error per PRD-400 contract | error | non-zero |
| Capability advertised without backing emission | Hard error per PRD-400-R18 | error | non-zero |

---

## Examples

### Example 1 — Minimum Core Docusaurus docs site (default config)

A docs site uses Docusaurus 3.x with a single docs instance, no blog, simple sidebar. `docusaurus.config.js`:

```js
module.exports = {
  title: "Acme Docs",
  url: "https://docs.acme.com",
  baseUrl: "/",
  presets: [["classic", { docs: { sidebarPath: "./sidebars.js" } }]],
  plugins: [["@act/docusaurus-plugin", {}]],
};
```

The plugin auto-wires PRD-201 to `docs/`, derives parent/children from `sidebars.js`. At `postBuild`, the pipeline emits `build/.well-known/act.json`, `build/act/index.json`, `build/act/n/{id}.json` per doc, plus `build/act/sub/{category}.json` for each category with 2+ children. Achieved level: Standard (sidebar produces categories). Maps to `fixtures/404/positive/minimum-core-default-config/`.

### Example 2 — Versioned-docs site with mounts

A library docs site has v1.0, v2.0, and current docs. The plugin auto-detects `versions.json` and:

- Emits current docs at `build/.well-known/act.json` etc.
- Emits v1.0 at `build/v1.0/.well-known/act.json` etc.
- Emits v2.0 at `build/v2.0/.well-known/act.json` etc.
- Parent manifest declares:

```json
{
  "mounts": [
    { "prefix": "/v1.0/", "delivery": "static", "manifest_url": "/v1.0/.well-known/act.json", "conformance": { "level": "standard" } },
    { "prefix": "/v2.0/", "delivery": "static", "manifest_url": "/v2.0/.well-known/act.json", "conformance": { "level": "standard" } }
  ]
}
```

Achieved level: Plus (versioned-docs mounts trigger Plus per PRD-404-R14). Maps to `fixtures/404/positive/versioned-docs-mounts/`.

### Example 3 — i18n Docusaurus site (Pattern 2, auto-wired)

A docs site has `i18n.locales: ["en", "es", "fr"]`. The plugin auto-wires PRD-207, emits:

- Parent manifest at `build/.well-known/act.json` advertising `locales.manifest_url_template: "/{locale}/.well-known/act.json"`.
- Per-locale manifest at `build/en/.well-known/act.json` (and same for `es`, `fr`).
- Per-locale indexes and node files under each locale prefix.

Achieved level: Plus. Maps to `fixtures/404/positive/i18n-pattern-2-auto/`.

### Example 4 — Sidebar mapping with synthesized categories

`sidebars.js`:

```js
module.exports = {
  docs: [
    { type: "category", label: "Getting started", items: ["intro", "install"] },
    { type: "category", label: "API", items: ["api-overview", "api-reference"] },
  ],
};
```

The plugin synthesizes:

- Node `getting-started` (type `section`, title "Getting started", children `["intro", "install"]`).
- Node `api` (type `section`, title "API", children `["api-overview", "api-reference"]`).
- Each doc carries `parent` set to its category-node ID.

Maps to `fixtures/404/positive/sidebar-mapping-synthesized-categories/`.

### Example 5 — Multi-instance Docusaurus deployment

A platform site has separate docs for `product-a` and `product-b` via two docs-plugin instances. The user registers two plugin instances:

```js
plugins: [
  ["@act/docusaurus-plugin", { id: "act-a", docusaurus: { docsInstance: "product-a" }, urlTemplates: { index_url: "/act/a/index.json", node_url_template: "/act/a/n/{id}.json" } }],
  ["@act/docusaurus-plugin", { id: "act-b", docusaurus: { docsInstance: "product-b" }, urlTemplates: { index_url: "/act/b/index.json", node_url_template: "/act/b/n/{id}.json" } }],
]
```

Each instance emits its own ACT artifact set under distinct URL templates. Maps to `fixtures/404/positive/multi-instance-distinct-namespaces/`.

### Example 6 — Sidebar orphan doc (warning)

A doc at `docs/legacy-feature.md` is not referenced in `sidebars.js`. The plugin emits the doc as a top-level node and records a warning in the build report:

```json
{
  "code": "sidebar_orphan",
  "requirement": "PRD-404-R6",
  "message": "doc 'legacy-feature' has no sidebar position; emitted as top-level node"
}
```

Maps to `fixtures/404/positive/sidebar-orphan-warning/`.

---

## Test fixtures

Fixtures live under `fixtures/404/`. PRD-600 (validator) ships the fixture-runner. No fixture files are created in this PRD.

### Positive

- `fixtures/404/positive/minimum-core-default-config/` → satisfies R1, R2, R4, R5, R6, R10, R12, R13, R14, R16, R17. Single docs instance, default sidebar, no blog.
- `fixtures/404/positive/sidebar-mapping-synthesized-categories/` → satisfies R6. Categories become parent nodes; docs nest as children.
- `fixtures/404/positive/sidebar-deep-hierarchy/` → satisfies R6, R14 (Standard). Three-level category nesting; subtree files emitted for each non-leaf category.
- `fixtures/404/positive/sidebar-orphan-warning/` → satisfies R6 second bullet. Orphan doc emitted top-level; warning in build report.
- `fixtures/404/positive/blog-and-docs-wired/` → satisfies R5. Blog content emitted alongside docs; both go through PRD-201.
- `fixtures/404/positive/pages-tsx-react-extraction/` → satisfies R5, R7. `src/pages/about.tsx` exports React components with contracts; static-AST extraction.
- `fixtures/404/positive/pages-mdx-mixed/` → satisfies R5, R7. `.mdx` page goes through PRD-201 then PRD-301 for embedded React.
- `fixtures/404/positive/page-level-act-export/` → satisfies R18. `src/pages/pricing.tsx` exports `act` const; supplied to `extractRoute`.
- `fixtures/404/positive/versioned-docs-mounts/` → satisfies R8. Multi-version site; per-version manifests + parent `mounts`.
- `fixtures/404/positive/versioned-docs-scope-include/` → satisfies R8. `versions: { include: ["current", "1.0"] }`; archived versions skipped.
- `fixtures/404/positive/i18n-pattern-2-auto/` → satisfies R9. Multi-locale site; auto-wired PRD-207; per-locale Pattern 2 emission.
- `fixtures/404/positive/i18n-disabled-multi-locale/` → satisfies R9. `i18n: false` despite multi-locale Docusaurus config; single-locale emission.
- `fixtures/404/positive/multi-instance-distinct-namespaces/` → satisfies R3. Two plugin instances; distinct URL templates; no collision.
- `fixtures/404/positive/atomic-write-into-build/` → satisfies R13. Pipeline writes only to ACT-owned paths.
- `fixtures/404/positive/conformance-band-standard-from-sidebar/` → satisfies R14. Sidebars produce categories; subtree files emitted; achieved Standard.
- `fixtures/404/positive/build-report-shape/` → satisfies R12. Build report at `build/.act-build-report.json` matches PRD-400-R27 schema.
- `fixtures/404/positive/adapter-pinning-stage-1-match/` → satisfies R15.
- `fixtures/404/positive/search-template-advertised-with-fulfillment/` → satisfies R11. `search_url_template` configured AND fulfillment artifact present.
- `fixtures/404/positive/extract-mode-ssr-walk-opt-in/` → satisfies R7. `extractMode: "ssr-walk"`; SSR-walk dispatched.

### Negative

- `fixtures/404/negative/docusaurus-version-mismatch/` → MUST fail. Docusaurus `< 3.0.0`. R2.
- `fixtures/404/negative/multi-instance-conflicting-urls/` → MUST fail. Two plugin instances with same `index_url`. R3.
- `fixtures/404/negative/sidebar-references-missing-doc/` → MUST surface warning. Sidebar entry's doc ID doesn't exist. R6.
- `fixtures/404/negative/category-id-collides-with-doc/` → MUST fail. Synthesized category-node ID matches a real doc ID. R6 / PRD-200-R10.
- `fixtures/404/negative/versioned-docs-malformed-versions-json/` → MUST fail. `versions.json` not valid JSON. R8.
- `fixtures/404/negative/mounts-recursive/` → MUST fail. A per-version manifest declares its own `mounts`. R8 / gap C5.
- `fixtures/404/negative/i18n-multilocale-no-prd-207-installed/` → MUST fail. `i18n.locales` > 1 but `@act/i18n-adapter` not installed. R9.
- `fixtures/404/negative/i18n-mixed-patterns/` → MUST fail. Pattern 1 declared but `manifest_url_template` configured. R9 / PRD-104-R7.
- `fixtures/404/negative/search-template-no-fulfillment/` → MUST surface warning + downgrade. `search_url_template` advertised but no fulfillment. R11.
- `fixtures/404/negative/adapter-pinning-stage-1-mismatch/` → MUST fail. R15.
- `fixtures/404/negative/output-dir-override-rejected/` → MUST fail. User attempts to override `outputDir`. R16.
- `fixtures/404/negative/page-act-export-runtime-only/` → MUST surface warning. Page's `act` export references runtime values; page-level contract skipped. R18.
- `fixtures/404/negative/non-docusaurus-path-write-attempted/` → MUST fail. Attempt to mutate `build/index.html` rejected. R10 / R13.
- `fixtures/404/negative/capability-advertised-without-files/` → MUST fail. PRD-400-R18 inheritance. R14.

---

## Versioning & compatibility

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add an optional field to plugin options | MINOR | PRD-108-R4(1). |
| Add a required field to plugin options | MAJOR | PRD-108-R5(1). |
| Change Docusaurus peer-dependency floor (e.g., 3.x → 4.x) | MAJOR | Existing 3.x consumers break. |
| Change the sidebar mapping rule (e.g., a different category-to-parent algorithm) | MAJOR | Existing site outputs change. |
| Change the synthesized category-node `type` from `"section"` | MAJOR | Existing index entries' `type` changes; consumers may filter. |
| Change the default extraction mode from `static-ast` to `ssr-walk` | MAJOR | Output `metadata.extraction_method` changes. |
| Change the default i18n pattern from Pattern 2 to Pattern 1 | MAJOR | Per-locale URL paths change. |
| Add support for a new content source (e.g., custom `customDocs/**`) | MINOR | Additive default; opt-in. |
| Change the versioned-docs mount prefix scheme (e.g., `/v{N}/` → `/version/{N}/`) | MAJOR | URL paths change for existing versioned sites. |
| Add a new lifecycle hook implementation (e.g., `extendCli`) | MINOR | Additive. |
| Promote `i18n` auto-wiring from on-by-default-when-multilocale to off-by-default | MAJOR | Existing multi-locale sites break. |
| Change the build report path | MAJOR | Tooling depends. |
| Add a new build warning code | MINOR | Tolerated. |
| Tighten the page-level `act` export evaluation (reject what was previously tolerated) | MAJOR | Existing pages' contracts disappear. |

### Forward compatibility

The plugin tolerates `ActDocusaurusOptions` fields it does not recognize per PRD-108-R7. The build report schema is documented-open.

### Backward compatibility

A v0.1 `@act/docusaurus-plugin` runs against a v0.2 Docusaurus 3.x release provided no MAJOR change has been made to Docusaurus's plugin API. A v0.2 plugin targeting Docusaurus 4.x is a MAJOR.

---

## Security considerations

This section cites PRD-109 (Accepted), PRD-400 § Security, and PRD-301 § Security and documents only Docusaurus-specific deltas.

**Versioned-docs trust boundary.** Versioned docs are typically frozen snapshots of historical content. The plugin reads `versioned_docs/version-X/**` as input to PRD-201; a malicious or tampered versioned-doc directory (introduced via repository compromise) injects content into ACT just as it would into Docusaurus's HTML output. The trust boundary is the source repository; PRD-404 inherits the build-process trust boundary from PRD-400 § Security. The plugin MUST NOT execute code from versioned-doc content beyond what PRD-201's markdown adapter does (markdown parsing, frontmatter evaluation per PRD-201's contract).

**MDX evaluation surface.** When `extractMode: "ssr-walk"` is enabled, the plugin compiles MDX in an SSR context to walk component contracts. MDX compilation evaluates arbitrary JavaScript (component imports, loader hooks). The trust posture matches PRD-301 § Security: MDX content is trusted code authored by site maintainers; third-party MDX should be reviewed before integration. Static-AST mode (the default) does NOT evaluate MDX at all — it walks the compiled AST in the parent process, reducing the threat surface. Authors with security-sensitive content SHOULD prefer the static-AST default.

**Sidebar-driven ID synthesis.** Sidebar category labels are mapped to ACT IDs via lowercasing and non-grammar-character substitution per PRD-404-R6. A category label containing path-traversal-shaped strings (`../`, `..\\`) is sanitized by the lowercase+hyphenate rule (the `.` is replaced with `-`). The resulting synthesized ID is validated against PRD-100-R10 before substitution into URL templates per PRD-100-R12. A category label that produces an empty ID after sanitization causes a build error.

**i18n locale leakage.** Per-locale builds emit per-locale node IDs. The plugin MUST NOT cross-emit content from one locale into another locale's index per PRD-104. A site with private content in one locale (e.g., a beta feature's docs in `en` only) MUST configure the `en` locale's content separately; the plugin honors the per-locale Docusaurus content directories.

**Build report under multi-instance deployments.** When multiple plugin instances are configured, each instance writes its own build report. The plugin MUST avoid writing a report at `{outDir}/.act-build-report.json` if another instance has already written there; the plugin SHOULD write per-instance reports under `{outDir}/.act/{instance-id}-build-report.json` when multi-instance is detected. This prevents the second instance from clobbering the first instance's report.

**Search-backend credential exposure.** Users who fulfill `search_url_template` via a hosted search backend (Pattern (b) of PRD-105-R7a) commonly use API keys. The plugin MUST NOT embed API keys in the manifest's `search_url_template`; the keys belong in the search backend's configuration, not in the publicly-deployed manifest. PRD-109's general "no credentials in deployed artifacts" rule applies.

For all other concerns — ETag determinism (PRD-103), CDN trust (PRD-105 / PRD-109), adapter trust (PRD-200 § Security), binding trust (PRD-301 § Security) — cite the upstream PRDs directly.

---

## Implementation notes

### Snippet 1 — The plugin module export

```ts
// packages/docusaurus-plugin/src/index.ts
// PRD-404-R1, R4.

import type { Plugin, LoadContext } from "@docusaurus/types";
import { runPipeline, type GeneratorPlugin } from "@act/generator-runtime";
import type { ActDocusaurusOptions, LoadedContent } from "./types";

export default function actPlugin(
  context: LoadContext,
  options: ActDocusaurusOptions,
): Plugin<LoadedContent> {
  const resolvedOptions = resolveOptions(options, context);
  const generatorPlugin = buildGeneratorPlugin(resolvedOptions, context);

  return {
    name: "@act/docusaurus-plugin",

    async loadContent() {
      // PRD-404-R4 first bullet
      return await discoverContent(context, resolvedOptions);
    },

    async contentLoaded({ content, actions }) {
      // PRD-404-R4 second bullet — process loaded content into adapter input
      generatorPlugin.contentSnapshot = content;
    },

    async postBuild({ outDir, content }) {
      // PRD-404-R4 third bullet — pipeline runs HERE
      const hostContext = await generatorPlugin.resolveHostContext({ outDir, content, context });
      const report = await runPipeline(generatorPlugin, { hostContext });
      context.siteConfig.markdown; // (illustrative; logger is plumbed elsewhere)
    },
  };
}
```

### Snippet 2 — Sidebar-to-parent/children mapping

```ts
// packages/docusaurus-plugin/src/sidebar-mapping.ts
// PRD-404-R6.

import type { ResolvedSidebars, SidebarItem, SidebarCategory } from "./types";

export function deriveParentChildren(sidebars: ResolvedSidebars): {
  syntheticNodes: NodeDraft[];
  parentMap: Map<string, string>;
} {
  const syntheticNodes: NodeDraft[] = [];
  const parentMap = new Map<string, string>();

  function visit(item: SidebarItem, parentId: string | undefined) {
    if (item.type === "category") {
      const catId = sanitizeCategoryId(item.label);  // lowercase + hyphenate
      validateIdGrammar(catId);                       // PRD-100-R10
      syntheticNodes.push({
        id: catId,
        type: "section",
        title: item.label,
        summary: item.description ?? "",
        parent: parentId,
      });
      for (const child of item.items) visit(child, catId);
    } else if (item.type === "doc") {
      if (parentId) parentMap.set(item.id, parentId);
    }
    // type: "link" — external link, NOT emitted per PRD-404-R6 fourth bullet
  }

  for (const root of sidebars.docs) visit(root, undefined);
  return { syntheticNodes, parentMap };
}
```

### Snippet 3 — Versioned-docs mounting

```ts
// packages/docusaurus-plugin/src/versions.ts
// PRD-404-R8.

import { runPipeline } from "@act/generator-runtime";

export async function emitVersionedDocs(
  versions: VersionedContent,
  resolvedOptions: ResolvedActDocusaurusConfig,
  parentManifestMounts: ParentMount[],
): Promise<void> {
  for (const version of versions.included) {
    const versionConfig = {
      ...resolvedOptions,
      outputDir: `${resolvedOptions.outputDir}/v${version.id}`,
      urlTemplates: {
        index_url: `/v${version.id}/act/index.json`,
        node_url_template: `/v${version.id}/act/n/{id}.json`,
        // versioned manifest must NOT itself declare mounts per gap C5
      },
    };
    const versionPlugin = buildGeneratorPlugin(versionConfig);
    const versionReport = await runPipeline(versionPlugin, { hostContext: version.hostContext });

    parentManifestMounts.push({
      prefix: `/v${version.id}/`,
      delivery: "static",
      manifest_url: `/v${version.id}/.well-known/act.json`,
      conformance: { level: versionReport.conformanceAchieved ?? "core" },
    });
  }
}
```

### Snippet 4 — i18n auto-wiring

```ts
// packages/docusaurus-plugin/src/i18n.ts
// PRD-404-R9.

import { i18nAdapter } from "@act/i18n-adapter";

export function autoWireI18n(
  resolvedOptions: ResolvedActDocusaurusConfig,
  i18nConfig: DocusaurusI18nConfig,
): { adapters: AdapterEntry[]; pattern: "1" | "2" } | undefined {
  if (i18nConfig.locales.length <= 1) return undefined;
  if (resolvedOptions.i18n === false) return undefined;

  const pattern = (typeof resolvedOptions.i18n === "object" && resolvedOptions.i18n.pattern) || "2";
  return {
    adapters: [{
      adapter: i18nAdapter,
      options: {
        defaultLocale: i18nConfig.defaultLocale,
        locales: i18nConfig.locales,
        translationsRoot: "i18n",
      },
    }],
    pattern,
  };
}
```

### Snippet 5 — Multi-source content wiring

```ts
// packages/docusaurus-plugin/src/wiring.ts
// PRD-404-R5.

import { markdownAdapter } from "@act/markdown";
import { reactBinding } from "@act/react";

export async function autoWireContent(
  context: LoadContext,
  resolvedOptions: ResolvedActDocusaurusConfig,
): Promise<{ adapters: AdapterEntry[]; bindings: BindingEntry[] }> {
  const docsInstances = await discoverDocsInstances(context, resolvedOptions);
  const blogContent = resolvedOptions.docusaurus?.skipBlog
    ? undefined
    : await discoverBlogContent(context);
  const pagesContent = await discoverPagesContent(context);

  const adapters: AdapterEntry[] = [];
  for (const instance of docsInstances) {
    adapters.push({ adapter: markdownAdapter, options: { sourceDir: instance.path, instanceId: instance.id } });
  }
  if (blogContent) {
    adapters.push({ adapter: markdownAdapter, options: { sourceDir: blogContent.path, instanceId: "blog" } });
  }

  const bindings: BindingEntry[] = pagesContent.hasReactPages
    ? [{ binding: reactBinding, options: { mode: resolvedOptions.extractMode ?? "static-ast" } }]
    : [];

  return { adapters, bindings };
}
```

### Snippet 6 — Conformance band auto-detection

```ts
// packages/docusaurus-plugin/src/conformance.ts
// PRD-404-R14 — wraps PRD-400-R17 / R18.

export function detectAchievedBand(
  files: EmittedFile[],
  resolvedOptions: ResolvedActDocusaurusConfig,
): "core" | "standard" | "plus" {
  const hasSubtree = files.some(f => f.path.includes("/act/sub/"));
  const hasNdjson = files.some(f => f.path.endsWith(".ndjson"));
  const hasMounts = files.some(f => f.path.match(/\/v[^/]+\/\.well-known\/act\.json$/));
  const hasI18n = files.some(f => f.path.match(/\/[a-z]{2}(-[A-Z]{2})?\/\.well-known\/act\.json$/));
  if (hasNdjson || hasMounts || hasI18n) return "plus";
  if (hasSubtree) return "standard";
  return "core";
}
```

These snippets sketch the canonical shape; full implementations include comprehensive error handling, observability, and the host-framework-specific glue Docusaurus requires.

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review. Decisions: (Q1) no Algolia auto-wiring in v0.1 — `search_url_template` advertisement only; (Q2) no theme-swizzling integration for HTML-side ACT advertisement — well-known path is canonical per PRD-101; (Q3) multi-instance Docusaurus supported via standard plugin-options pattern; (Q4) versioned-docs default to Pattern 2 (per-version manifests) matching Docusaurus's URL routing. |
| 2026-05-01 | Jeremy Forsythe | Initial draft. Pins the Docusaurus plugin module shape `@act/docusaurus-plugin`, the lifecycle implementation across `loadContent` / `contentLoaded` / `postBuild` (canonical pipeline run at `postBuild`), the multi-source content wiring (PRD-201 for docs/blog/static-`.md` pages; PRD-301 for `src/pages/**.{tsx,jsx,mdx}` route modules), the sidebar-to-parent/children mapping rule (categories synthesize parent nodes; orphans become top-level with warning; ID grammar enforced), the versioned-docs mounting model (per-version manifests at `/v{N}/.well-known/act.json` plus `mounts` in parent per PRD-105-R16 / PRD-107-R5), the i18n auto-wiring to PRD-207 with Pattern 2 default (matching Docusaurus's per-locale URL routing), the output emission target (`build/.well-known/act.json`, `build/act/**`, `build/.act-build-report.json`), the search advertisement opt-in with PRD-105-R7a fulfillment requirement, the multi-instance support for multi-docs deployments, the static-AST default extraction mode for MDX (SSR-walk opt-in), the conformance band auto-detection (Standard from sidebar categories; Plus from versioned-docs OR i18n OR NDJSON), the page-level `export const act` reader for `src/pages/**` route modules, and the adapter-pinning enforcement per PRD-400-R29 / R30. Cites PRD-100 / PRD-103 / PRD-104 / PRD-105 / PRD-107 / PRD-108 / PRD-109 (Accepted), PRD-200 / PRD-300 / PRD-301 / PRD-400 (in review), PRD-201 / PRD-207 (Draft, default wiring). Test-fixture corpus enumerated under `fixtures/404/positive/` and `fixtures/404/negative/`; no fixture files created. No new JSON Schemas. Status: Draft → In review. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
