# PRD-406 — Remix plugin (static export)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

Remix (and the Remix-Vite combination that is the supported v2+ shape) is a JavaScript framework with a meaningful but smaller footprint than Next.js. PRD-406 covers Remix's **static export** mode — `remix vite:build` followed by a documented static-export step that emits prerendered routes. The Remix runtime profile (loaders that resolve per request) is OUT of scope for v0.1 because no Remix runtime SDK ships in v0.1; runtime Remix is deferred to a future PRD-506-equivalent. PRD-406 thus targets the slice of Remix users who prerender their routes (marketing sites, content-driven docs, mostly-static SaaS landing pages) and want ACT files alongside their static deploy.

The integration shape is a **Remix-Vite plugin**: an exported `act()` Vite plugin function that operators add to `vite.config.ts` alongside `vitePlugin` from `@remix-run/dev`. Vite's `closeBundle` hook is the canonical post-build entry point; the plugin invokes PRD-400's `runPipeline` against Remix's resolved build output directory (`build/client/` for the Remix-Vite static export model). The plugin's adapters are configurable: PRD-201 (markdown/MDX in `content/**`), PRD-202–208 (CMS adapters opt-in), PRD-208 (programmatic), PRD-301 (React component contract via `app/routes/**`).

PRD-100 (Accepted) defines the wire-format envelopes. PRD-105 (Accepted) defines the static profile. PRD-301 (In review) defines React component extraction. PRD-400 (In review) defines the canonical pipeline this PRD invokes. No 700-series example currently depends on PRD-406 — the PRD is forward-facing infrastructure for community Remix adopters and a sibling-by-symmetry to PRD-405 (Next.js) and PRD-401 (Astro). PRD-406 keeps the conformance band capped at Standard for v0.1 because the i18n adapter (PRD-207) does not currently document a Remix-specific binding; Plus is achievable per-project but no first-party test fixture exercises it.

The build hook is **Vite's `closeBundle`**, not Remix's own lifecycle: Remix-Vite is the supported shape, and the plugin runs after Vite finalizes the client bundle. Remix's `loader` / `action` runtime concepts are out of scope; the plugin sees only the prerendered output and the build-time route enumeration that Remix-Vite exposes via its plugin API.

### Goals

1. Lock the **integration shape**: `import { act } from '@act/remix'` returning a Vite plugin (`Plugin` from `vite`) added to `vite.config.ts` alongside Remix's `vitePlugin`.
2. Lock the **target**: static export mode (`remix vite:build` + Remix's prerender mechanism). Runtime Remix is OUT of scope for v0.1 — the plugin emits a build error if the operator's `vite.config.ts` does not include Remix's prerender wiring or includes runtime-only configuration.
3. Lock the **post-build invocation**: PRD-400's `runPipeline` runs in Vite's `closeBundle` hook, after Remix-Vite finalizes the client bundle.
4. Lock the **content-source defaults**: Markdown/MDX in `content/**` (configurable), React routes in `app/routes/**` extracted via PRD-301, programmatic adapters opt-in.
5. Lock the **file-set emission**: Static file set written to `build/client/` (Remix-Vite's static output dir for the prerendered build) under `.well-known/act.json` and `act/`.
6. Lock the **page-level contract**: PRD-301-R5 (page-level boundary, const form) — the plugin reads `export const act` from each route module under `app/routes/**`.
7. Lock the **conformance bands**: Core / Standard for v0.1; Plus is achievable but no first-party test fixture wires it for Remix.
8. Lock the **failure surface**: build errors halt `vite build`; build warnings flow through Vite's logger AND the build report sidecar (default at project root).
9. Lock the **dev-mode posture**: `remix vite:dev` does NOT run the canonical pipeline; the plugin is a no-op in dev, mirroring PRD-405-R19's posture.
10. Specify Remix-Vite peer pinning: `@remix-run/dev` `^2.0.0`, `vite` `^5.0.0`. Pre-Remix-Vite (`@remix-run/dev` 1.x with the legacy compiler) is unsupported.
11. Enumerate the **test-fixture matrix** under `fixtures/406/positive/` and `fixtures/406/negative/`.

### Non-goals

1. **Runtime Remix.** Loaders and actions are RUNTIME — out of scope. A future PRD (provisionally PRD-506) will cover Remix runtime.
2. **The legacy Remix Classic Compiler (`@remix-run/dev` 1.x).** Unsupported; only Remix-Vite is in scope.
3. **Defining the React component contract.** Owned by PRD-300 / PRD-301.
4. **Defining the markdown/MDX adapter.** Owned by PRD-201.
5. **Defining the wire format / static profile / conformance levels / versioning / security / validator.** Owned by PRD-100, PRD-105, PRD-107, PRD-108, PRD-109, PRD-600 respectively.
6. **First-class Remix Resource Routes integration.** Resource routes (`*.tsx` exporting only `loader`) are runtime; out of scope for static export.
7. **Plus-tier i18n for v0.1.** PRD-207's binding does not document Remix specifics; an operator MAY wire PRD-207 manually but no first-party fixture exercises it. Plus i18n via PRD-406 is a v0.2 amendment.

### Stakeholders / audience

- **Authors of:** Remix operators building static-exported sites who want ACT alongside their build. No 700-series example currently depends on PRD-406.
- **Consumers of (upstream):** PRD-100, PRD-103, PRD-104, PRD-105, PRD-107, PRD-108, PRD-109, PRD-200, PRD-201, PRD-208, PRD-300, PRD-301, PRD-400.
- **Consumers of (downstream):** PRD-600 (validator).
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Operators run `remix vite:dev` and assume the plugin is producing artifacts; nothing happens. | Medium | Low | PRD-406-R10 makes dev-mode an explicit no-op with a one-time console message. |
| Remix-Vite's plugin API evolves; `closeBundle` hook semantics shift between Remix-Vite minor versions. | Medium | Medium | PRD-406-R2 pins `@remix-run/dev` `^2.0.0` and `vite` `^5.0.0`; future MAJOR bumps trigger a PRD-406 MAJOR. The plugin uses Vite's stable `Plugin.closeBundle` hook rather than Remix-internal hooks. |
| Operators mistake static export for full Remix; loaders run at request time and ACT data drifts. | High | High | PRD-406-R3 detects runtime configuration markers (`loader` exports without `prerender` configuration) and emits a build error citing the runtime-out-of-scope stance. The error documents the v0.2 path. |
| Plugin reads `app/routes/**` modules at build time, but Remix's route conventions (flat routes vs nested folders) produce ambiguous file resolution. | Medium | Medium | PRD-406-R7 delegates route enumeration to Remix-Vite's resolved route tree (exposed via Remix's `getRoutes()` helper at build time); the plugin does not re-implement Remix's route convention parser. |
| `closeBundle` runs once per build target (client + server); the plugin may run twice. | High | Medium | PRD-406-R5 gates the pipeline on the client build by checking Vite's `ssr` build flag; only the client build invocation runs `runPipeline`. |
| Plugin emits ACT files into `build/client/`, which Vite/Remix may have already finalized — race conditions or accidental overwrite. | Low | Medium | PRD-406-R5 relies on `closeBundle`'s post-emit ordering; PRD-406-R12 enforces atomic writes within `build/client/.well-known/`, `build/client/act/`, and the build-report path. The plugin MUST NOT touch any path outside the ACT-owned subtree. |
| `.act-build-report.json` placed inside `build/client/` ships to the CDN. | High | Low | PRD-406-R15 defaults `buildReportPath` to project root; in-`build/client/` overrides receive a build warning. |
| Adapter pinning (Stage 1) clashes with existing Remix project conventions for content fetching. | Low | Low | PRD-406-R17 enforces PRD-400-R29 / PRD-200-R25; standard adapter packages already declare `act_version: "0.1"`. |
| MDX in `app/routes/**` (Remix MDX routes) is parsed twice — once as a route module, once as content. | Medium | Low | PRD-406-R8 specifies that `.mdx` under `app/routes/**` is owned by PRD-301 (treated as a route module); `.mdx` under `content/**` is owned by PRD-201. Distinct IDs avoid collision. |

### Open questions

1. ~~Should the plugin support Remix's resource routes (`*.tsx` files exporting only `loader`)?~~ **Resolved (2026-05-01): No (v0.1).** Resource routes are runtime constructs; routes exporting `prerender = true` would be in scope but are uncommon; skipped for v0.1. (Closes Open Question 1.)
2. ~~Should the plugin honor Remix's "splat routes" (`$.tsx`)?~~ **Resolved (2026-05-01): Yes.** Splat routes that prerender produce concrete URLs which map to ACT IDs per PRD-406-R8. Splat routes that don't prerender are skipped. (Closes Open Question 2.)
3. ~~Should the plugin advertise `subtree_url_template` automatically?~~ **Resolved (2026-05-01): Yes.** When configured to emit subtrees per PRD-400-R13. (Closes Open Question 3.)
4. ~~Should the plugin support PRD-207 i18n auto-wiring?~~ **Resolved (2026-05-01): No first-party auto-wiring (v0.1).** Operators MAY wire PRD-207 explicitly via `act({ adapters: [...] })`. Auto-wiring is a v0.2 amendment — known gap; Plus tier achievable for Remix but unfixtured for v0.1. (Closes Open Question 4.)
5. ~~Should the plugin prerender on-demand routes the operator hasn't pre-declared?~~ **Resolved (2026-05-01): No.** Only routes Remix-Vite's prerender step actually emits become ACT nodes. (Closes Open Question 5.)

### Acceptance criteria

- [ ] Status `In review` is set; changelog entry dated 2026-05-01 by Jeremy Forsythe is present.
- [ ] Every normative requirement has an ID `PRD-406-R{n}` and a declared conformance level.
- [ ] The Specification opens with a table mapping every requirement to PRD-400 + PRD-301 + 100-series requirements implemented.
- [ ] `act()` (Vite plugin) is the public surface; no other top-level export is normative.
- [ ] Static-export-only requirement is pinned with build-error semantics for runtime targets.
- [ ] Vite `closeBundle` hook strategy is documented.
- [ ] `app/routes/**` page-level contract is addressed.
- [ ] Conformance bands described; Plus is acknowledged as achievable but unfixtured for v0.1.
- [ ] Test-fixture path layout enumerated; no fixture files created.
- [ ] Versioning & compatibility section classifies each kind of change.
- [ ] Security section cites PRD-109 and documents Remix-specific deltas.
- [ ] No new JSON Schemas are introduced.

---

## Context & dependencies

### Depends on

- **PRD-100** (Accepted) — wire-format envelopes.
- **PRD-103** (Accepted) — ETag derivation.
- **PRD-104** (Accepted) — i18n.
- **PRD-105** (Accepted) — static delivery profile.
- **PRD-107** (Accepted) — conformance levels.
- **PRD-108** (Accepted) — versioning policy.
- **PRD-109** (Accepted) — security posture.
- **PRD-200** (In review) — adapter framework.
- **PRD-201** (In review) — markdown/MDX adapter.
- **PRD-208** (In review) — programmatic adapter (opt-in).
- **PRD-300** (In review) — component contract.
- **PRD-301** (In review) — React binding.
- **PRD-400** (In review) — generator architecture (parent).
- External: [Remix-Vite docs](https://remix.run/docs/en/main/future/vite), [Vite plugin API](https://vitejs.dev/guide/api-plugin.html), [Remix routing conventions](https://remix.run/docs/en/main/file-conventions/routes), [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174).

### Blocks

- None directly. PRD-406 is forward-facing infrastructure; no 700-series example currently depends on it.

### References

- v0.1 draft: §7 (build integration).
- `prd/000-decisions-needed.md` Q3 (TS-only first-party; PRD-406 ships TS reference impl).
- Prior art: Astro Integrations API (PRD-401), Next.js plugin (PRD-405), Vite plugin pattern.

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords as clarified by RFC 8174.

### PRD-400 + PRD-301 + 100-series requirements implemented

| PRD-406 requirement | Upstream requirement(s) implemented or consumed | Relationship |
|---|---|---|
| R1 (`@act/remix` package + `act()` Vite plugin) | PRD-400-R3 (`GeneratorPlugin`) | Plugin shape; named export `act`. |
| R2 (peer dependencies pinning) | PRD-400-R3 | `@remix-run/dev ^2.0.0`, `vite ^5.0.0`. |
| R3 (static-export-only target) | PRD-105-R1 | Build error when runtime configuration detected. |
| R4 (Vite plugin composability) | PRD-400-R3 | Plugin coexists with Remix's `vitePlugin`. |
| R5 (`closeBundle` post-build invocation) | PRD-400-R1, R23, R24 | Pipeline runs once after the client build. |
| R6 (content-source defaults) | PRD-201, PRD-208 | Adapters configurable; markdown auto-wired for `content/**`. |
| R7 (route enumeration via Remix API) | PRD-301-R5 (page-level boundary) | Plugin uses Remix's resolved route tree. |
| R8 (MDX disambiguation) | PRD-201, PRD-301 | `.mdx` under `app/routes/**` → PRD-301; `.mdx` under `content/**` → PRD-201. |
| R9 (page-level `act` const) | PRD-301-R5, PRD-100-R10 | `export const act` read at build time per route module. |
| R10 (dev-mode no-op) | PRD-400-R24 | `remix vite:dev` runs no canonical pipeline. |
| R11 (file-set emission to `build/client/`) | PRD-400-R9, R10, R11, R12, R13, PRD-105-R1–R7 | Static file set written to Remix-Vite's client output dir. |
| R12 (atomic writes within ACT-owned subtree) | PRD-400-R23, PRD-105-R12 | Tmp-then-rename; never touch Remix-owned paths. |
| R13 (manifest construction) | PRD-400-R10, R18, PRD-100-R4, R6 | Computed from observed emissions. |
| R14 (conformance-level computation) | PRD-400-R17, PRD-107-R6, R8 | Achieved level from observed emissions; capped at Standard for v0.1 first-party fixtures. |
| R15 (build-report sidecar) | PRD-400-R27 | Default at project root; configurable. |
| R16 (`failOnExtractionError`) | PRD-400-R26 | Honors PRD-301-R22 placeholder warnings. |
| R17 (Stage 1 adapter pinning) | PRD-400-R29, PRD-200-R25, PRD-108-R14 | Plugin emits `act_version: "0.1"` only in v0.1. |
| R18 (Vite logger plumbing) | PRD-400-R24 | All output via Vite's logger. |
| R19 (configuration shape) | PRD-400-R31 | `ActRemixOptions` mirrors `GeneratorConfig`. |
| R20 (test-fixture conformance) | PRD-400-R28 | MUST pass `fixtures/400/` and `fixtures/406/`. |

### Conformance level

- **Core:** PRD-406-R1, R2, R3, R4, R5, R6, R7, R8, R10, R11, R12, R13, R14, R17, R18, R19, R20.
- **Standard:** PRD-406-R9 (page-level contract; PRD-301-R5 is Standard), R15, R16.
- **Plus:** Not exercised by first-party fixtures for v0.1; operators MAY wire PRD-207 manually for Pattern 1/2 i18n. A future v0.2 amendment may add first-party Plus support.

### Normative requirements

#### Package shape and integration

**PRD-406-R1.** **(Core)** The integration MUST be published as the npm package `@act/remix`. The package MUST export a named function `act(options?: ActRemixOptions): Plugin` whose returned value satisfies Vite's `Plugin` interface AND wraps a `GeneratorPlugin` (PRD-400-R3) the framework runtime invokes. Operators consume `act()` from `vite.config.ts`:

```ts
import { vitePlugin as remix } from '@remix-run/dev';
import { act } from '@act/remix';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    remix({ /* remix opts */ }),
    act({ conformanceTarget: 'standard' }),
  ],
});
```

**PRD-406-R2.** **(Core)** The package MUST declare the following peer dependencies:

- `@remix-run/dev` `^2.0.0`
- `vite` `^5.0.0`

The plugin MUST emit a build error citing the unsupported version when either peer resolves outside its constraint. Future bumps to Vite 6 or Remix 3 are MAJOR changes per the Versioning table.

**PRD-406-R3.** **(Core)** The integration targets static export only. The plugin MUST inspect, at config-resolve time, whether Remix-Vite is configured for prerendering — specifically, whether the resolved Remix configuration includes a `prerender` directive or whether routes export `prerender: true`. When neither signal is present, the plugin MUST emit a build error citing PRD-105-R1 and the absence of a v0.1 Remix runtime SDK. The error MUST include a remediation hint: "Configure Remix prerendering, or wait for the Remix runtime SDK (deferred to v0.2)."

**Note on detection heuristic.** The specific signals named above (`prerender` directive in Remix configuration; route-level `prerender: true` export) reflect the Remix-Vite API as of v0.1 drafting. Remix-Vite is still stabilizing, and the exact detection mechanism may need a MINOR amendment as the Remix-Vite plugin API evolves. **The normative contract is "static-export-only"** — the plugin MUST determine, by whatever signal Remix-Vite publishes at the time of implementation, that the build will produce prerendered static output, and MUST refuse to run otherwise. Replacing the named signals with an equivalent up-to-date detection mechanism is a MINOR change to PRD-406; weakening the static-export-only requirement is a MAJOR.

**PRD-406-R4.** **(Core)** The Vite plugin MUST coexist with Remix's `vitePlugin` without conflict. The plugin's `name` is `'act/remix'`; Vite resolves plugin order by array position, with `act()` running AFTER `remix()` so Remix-Vite has populated the route tree before the plugin reads it. The plugin MUST NOT call into Remix-internal APIs beyond the documented Remix-Vite plugin surface (`getRoutes()`, `routesManifest`, etc.).

#### Post-build invocation

**PRD-406-R5.** **(Core)** The plugin MUST invoke PRD-400's `runPipeline` exclusively from Vite's `closeBundle` hook AND only on the client build (Vite invokes `closeBundle` once per build target — client AND server bundles for SSR-prerender configurations). The plugin gates on `this.environment?.name === 'client'` (Vite 5+) or the `ssr` build flag for older configurations; the server bundle invocation is a no-op. The plugin's `closeBundle` MUST:

1. Wait for Remix-Vite to write the prerendered HTML to `build/client/`.
2. Read the resolved route enumeration from Remix's plugin API.
3. Construct the PRD-400 `BuildInput` from configured adapters, route enumeration, and resolved options.
4. Invoke `runPipeline(input)`.
5. Write the build report sidecar per PRD-406-R15.

The pipeline writes only to ACT-owned paths under `build/client/` (`build/client/.well-known/`, `build/client/act/`).

#### Content sources

**PRD-406-R6.** **(Core)** The integration MUST, by default, auto-wire one PRD-201 (markdown/MDX) adapter instance for `content/**/*.{md,mdx}` (configurable via `act({ content: { roots: [...] } })`). When the operator supplies an explicit `adapters: [...]` array, auto-wiring is skipped per the explicit-config-wins rule. The integration MUST surface an empty-corpus build warning when no markdown sources AND no other adapters AND no React routes are configured.

**PRD-406-R7.** **(Core)** The plugin MUST enumerate Remix routes via Remix-Vite's published API (`getRoutes()` or equivalent). The plugin MUST NOT re-implement Remix's flat-vs-nested route convention parser. For each route in the resolved tree, the plugin determines whether the route prerenders (Remix's static export emits an HTML file) and, if so, treats the route as a candidate ACT node. Routes that do not prerender are skipped (they are runtime; out of scope for v0.1).

**PRD-406-R8.** **(Core)** The plugin MUST disambiguate `.mdx` files based on filesystem location:

- `.mdx` under `app/routes/**` → owned by PRD-301 (treated as a route module; the React component contract applies via SSR-walk against Remix's prerendered HTML).
- `.mdx` under `content/**` → owned by PRD-201 (treated as markdown with frontmatter).

When the same `.mdx` file appears in both locations (an unusual configuration), each path emits a distinct node with a different ID.

#### Page-level contract

**PRD-406-R9.** **(Standard)** When a route module under `app/routes/**` exports a top-level `act` constant, the plugin MUST read the export at build time and supply it to PRD-301's `extractRoute` per PRD-301-R5 (page-level boundary, const form). The plugin reads via Vite's `import` at build time; a route whose `act` export is a function-call result requiring runtime evaluation is NOT supported in v0.1 — the plugin emits a build warning and skips the page-level contract for that route. ID validation per PRD-301-R7 / PRD-100-R10 happens before extraction.

#### Dev-mode posture

**PRD-406-R10.** **(Core)** The plugin MUST NOT run the canonical pipeline during `remix vite:dev`. The plugin's `closeBundle` hook MUST be a no-op in dev. When invoked in dev, the plugin MAY emit a one-time logger message ("ACT artifacts are produced only by `vite build`; run `remix vite:build` to generate them"). The plugin MUST NOT install dev middleware that synthesizes ACT responses; that is PRD-501-territory and a future Remix runtime SDK.

#### File-set emission

**PRD-406-R11.** **(Core / Standard parameterized)** The plugin MUST emit the static file set per PRD-105 layout into `build/client/`:

- `build/client/.well-known/act.json` (manifest; Core).
- `build/client/act/index.json` (index; Core).
- `build/client/act/<id>.json` (per node; Core).
- `build/client/act/subtree/<id>.json` (Standard, when subtree advertised).
- `build/client/act/index.ndjson` (Plus, when NDJSON advertised; not first-party-fixtured for v0.1).

Per PRD-105-R9, the on-disk extension MAY be `.act.json`. The plugin's default is `.json`.

**PRD-406-R12.** **(Core)** The plugin MUST honor PRD-400-R23's atomic-write contract: every ACT-owned file is written via tmp-then-rename within `build/client/`. The plugin MUST NOT touch Remix-Vite-owned paths (HTML pages, asset bundles, client manifest). The on-error hook (PRD-400-R24) cleans up any lingering `*.tmp.*` files inside the ACT-owned subtree.

#### Manifest construction and conformance

**PRD-406-R13.** **(Core)** The plugin MUST construct the manifest with `delivery: "static"`, `act_version: "0.1"`, and `conformance.level` computed per PRD-406-R14. The manifest's `capabilities` object MUST be populated from observed emissions (PRD-400-R18), not from configuration intent.

**PRD-406-R14.** **(Core)** The plugin MUST compute the achieved conformance band per PRD-400-R17:

- `core` if only the Core file set is emitted.
- `standard` if subtree files are emitted AND every Standard requirement is met.
- `plus` if NDJSON index is emitted AND every Plus requirement is met. PRD-406 v0.1 does not first-party-fixture Plus; operators MAY achieve it with manual configuration.

The plugin MUST NOT inflate the level beyond observed emissions.

#### Build report

**PRD-406-R15.** **(Standard)** The plugin MUST write a build report sidecar per PRD-400-R27. The default `buildReportPath` is `./.act-build-report.json` at the project root (NOT inside `build/client/`) to avoid CDN upload. Operators who override `buildReportPath` to point inside `build/client/` MUST receive a build warning. The build report enumerates every emitted ACT file (Remix-Vite's HTML files are NOT enumerated), every warning, every error, the configured target level, the achieved level, and the build duration.

**PRD-406-R16.** **(Standard)** The plugin MUST honor `act({ failOnExtractionError: boolean })` per PRD-400-R26. Default `false`. When `true`, any PRD-301-R22 placeholder block emitted during component extraction causes `vite build` to exit non-zero after the build report is finalized.

#### Adapter pinning

**PRD-406-R17.** **(Core)** The plugin MUST enforce PRD-400-R29 (Stage 1) before any adapter `init` runs. An adapter package whose declared `act_version` does not equal the build's target (`"0.1"` for v0.1) MUST cause the build to fail with a non-zero exit code.

#### Logger plumbing

**PRD-406-R18.** **(Core)** The plugin MUST plumb Vite's `Logger` (`this.environment?.logger` or the legacy `config.logger`) into PRD-400's `BuildContext.logger`. Every PRD-400 hook receives Vite's logger. The plugin MUST NOT use `console.log` directly; all output goes through the logger so `vite build --silent` and `vite build --debug` work as expected.

#### Configuration shape

**PRD-406-R19.** **(Core)** `act(options)` MUST satisfy PRD-400-R31's `GeneratorConfig` minimum. The `options` parameter (`ActRemixOptions`) carries Remix-specific defaults applied at config-resolve time:

```ts
interface ActRemixOptions {
  conformanceTarget?: 'core' | 'standard' | 'plus';     // default: 'core'
  outputDir?: string;                                     // default: 'build/client'
  buildReportPath?: string;                               // default: './.act-build-report.json'
  content?: { roots?: string[] };                         // default: ['content/**/*.{md,mdx}']
  adapters?: Adapter[];                                   // overrides auto-wiring when set
  bindings?: Binding[];                                   // overrides React auto-detection when set
  extractMode?: 'ssr-walk' | 'static-ast';                // default: 'ssr-walk'
  failOnExtractionError?: boolean;                        // default: false
  mounts?: ManifestMount[];                               // default: []
  manifest?: { siteName?: string; rootId?: string };
}
```

#### Test-fixture conformance

**PRD-406-R20.** **(Core)** The plugin MUST pass the framework conformance fixture corpora at `fixtures/400/positive/` and `fixtures/406/positive/`, producing byte-equivalent output (modulo `generated_at` timestamps) to the TS reference. Negative fixtures MUST surface the documented error or warning.

### Wire format / interface definition

```ts
// @act/remix public surface

import type { Plugin } from 'vite';
import type { Adapter, Binding, ManifestMount } from '@act/core';

export interface ActRemixOptions {
  conformanceTarget?: 'core' | 'standard' | 'plus';
  outputDir?: string;
  buildReportPath?: string;
  content?: { roots?: string[] };
  adapters?: Adapter[];
  bindings?: Binding[];
  extractMode?: 'ssr-walk' | 'static-ast';
  failOnExtractionError?: boolean;
  mounts?: ManifestMount[];
  manifest?: { siteName?: string; rootId?: string };
}

export function act(options?: ActRemixOptions): Plugin;
```

### Errors

| Condition | Severity | Notes |
|---|---|---|
| `@remix-run/dev` resolves to `< 2.0.0` or `>= 3.0.0` | Build error | PRD-406-R2 |
| `vite` resolves to `< 5.0.0` or `>= 6.0.0` | Build error | PRD-406-R2 |
| Remix configured for runtime (no prerender wiring) | Build error | PRD-406-R3; cite future runtime SDK |
| Page-level `act` export is a function call requiring runtime eval | Build warning | Skip extraction; PRD-406-R9 |
| `buildReportPath` inside `build/client/` | Build warning | PRD-406-R15 |
| Adapter `act_version` mismatch (Stage 1) | Build error | PRD-406-R17 |
| Schema validation failure on emitted envelope | Build error | PRD-400-R21 |
| No content sources, no React routes, no adapters | Build warning | Empty-corpus case |
| Plugin runs in `vite:dev` | One-time logger note | PRD-406-R10 |

---

## Examples

### Example 1 — minimal Remix + content (Core)

```ts
// vite.config.ts
import { vitePlugin as remix } from '@remix-run/dev';
import { act } from '@act/remix';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    remix({
      // example prerender configuration; actual API per Remix docs.
      future: { v3_singleFetch: true },
    }),
    act({ conformanceTarget: 'core' }),
  ],
});
```

Source layout:

```
app/routes/
  _index.tsx
  about.tsx
  blog.$slug.tsx        (prerenders one node per slug)
content/
  blog/post-1.md
  blog/post-2.md
```

Emitted (after `remix vite:build`):

```
build/client/.well-known/act.json
build/client/act/index.json
build/client/act/about.json                           (page-level contract from app/routes/about.tsx)
build/client/act/blog/post-1.json                     (from content/blog/post-1.md)
build/client/act/blog/post-2.json
build/client/act/blog/<slug>.json                     (from each prerendered blog.$slug.tsx instance)
.act-build-report.json
```

### Example 2 — Standard with subtree

```ts
export default defineConfig({
  plugins: [
    remix({ /* prerender on */ }),
    act({
      conformanceTarget: 'standard',
      manifest: { siteName: 'Example Co', rootId: 'home' },
      mounts: [
        { path_prefix: '/docs', manifest_url: 'https://docs.example.com/.well-known/act.json' },
      ],
    }),
  ],
});
```

Emitted additionally:

```
build/client/act/subtree/home.json
build/client/act/subtree/blog.json
```

Manifest declares `subtree_url_template: "/act/subtree/{id}.json"` and the mounts array.

---

## Test fixtures

PRD-406 fixtures verify the integration end-to-end. Files are not created by this PRD; they are enumerated for downstream authoring.

### Positive

- `fixtures/406/positive/minimal-prerender-core/` — minimal Remix prerender; `content/` only.
- `fixtures/406/positive/page-contract-app-routes/` — `export const act` from `app/routes/about.tsx`.
- `fixtures/406/positive/splat-route-prerender/` — `app/routes/blog.$slug.tsx` prerenders multiple nodes.
- `fixtures/406/positive/standard-with-subtree/` — Standard band; subtree files emitted.
- `fixtures/406/positive/with-mounts/` — parent manifest declares mounts.
- `fixtures/406/positive/coexistence-with-tailwind-vite/` — `act()` composes with other Vite plugins.
- `fixtures/406/positive/programmatic-adapter/` — PRD-208 adapter wired explicitly.

### Negative

- `fixtures/406/negative/no-prerender/` — Remix configured for runtime only; build error per PRD-406-R3.
- `fixtures/406/negative/remix-1x/` — `@remix-run/dev` 1.x peer; build error per PRD-406-R2.
- `fixtures/406/negative/vite-4x/` — Vite 4 peer; build error per PRD-406-R2.
- `fixtures/406/negative/page-act-runtime-call/` — `export const act = makeAct()`; build warning, skip extraction.
- `fixtures/406/negative/adapter-version-mismatch/` — adapter declares `act_version: "0.2"`; build error per PRD-406-R17.
- `fixtures/406/negative/build-report-inside-client/` — `buildReportPath: "./build/client/.act-build-report.json"`; build warning per PRD-406-R15.
- `fixtures/406/negative/non-conforming-id/` — page contract emits an ID violating PRD-100-R10 grammar; build error.
- `fixtures/406/negative/empty-corpus/` — no content, no routes, no adapters; build warning.

---

## Versioning & compatibility

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a new `ActRemixOptions` field | MINOR | |
| Add support for a new Remix MAJOR (Remix 3) | MAJOR | Peer constraint widens |
| Add support for Vite 6 | MAJOR | |
| Drop support for Remix 2 or Vite 5 | MAJOR | |
| Tighten an SHOULD to a MUST | MAJOR | |
| Loosen a MUST to a SHOULD | MAJOR | |
| Change default `extractMode` | MAJOR | Output may shift |
| Add support for Remix runtime (loaders) | MAJOR | Reverses PRD-406-R3 |
| Add first-party Plus support (i18n auto-wiring) | MINOR | Additive |

### Forward compatibility

The plugin MUST tolerate unknown optional fields on Vite's `Plugin` interface per Vite's own forward-compat rules. Adapter capabilities (PRD-200-R22) follow PRD-200's tolerance rules. PRD-100 envelopes follow PRD-108-R7.

### Backward compatibility

A plugin upgrading from a prior PRD-406 minor MUST emit byte-equivalent output for unchanged source corpora and unchanged adapter sets.

---

## Security considerations

PRD-109 (Accepted) governs the project-wide threat model. PRD-406 deltas:

- **Build environment trust.** `vite build` runs with full filesystem access. The plugin MUST NOT exfiltrate content beyond `outputDir` and `buildReportPath`. The plugin MUST NOT make outbound HTTP requests during the canonical pipeline; CMS adapter network access is the adapter's responsibility.
- **Vite plugin scope.** The plugin MUST observe Vite's bundle metadata read-only on `closeBundle`. Mutating Vite's bundle map could introduce drift.
- **Build-report leakage.** Default `buildReportPath` is at project root, NOT inside `build/client/`, to avoid CDN upload. PRD-406-R15 codifies this.
- **Component extraction trust.** PRD-301's SSR-walk renders user code in Node.js during the build. Operators trust the components they import; PRD-406 inherits PRD-300's component-trust model.
- **Information disclosure (404 vs 403).** Static profile only; no auth boundary applies.
- **DoS / resource bounds.** The plugin MUST respect PRD-301's per-route extraction budget. A misbehaving binding that hangs blocks `vite build`; this is acceptable behavior.

---

## Implementation notes

The TypeScript snippets below show the canonical integration shape. They are normative only insofar as PRD-406's normative requirements pin the behavior; the actual code in `@act/remix` is the implementer's choice.

### Snippet 1 — `act()` Vite plugin shape

```ts
import type { Plugin } from 'vite';
import { runPipeline } from '@act/core';
import type { ActRemixOptions } from './types';

export function act(options: ActRemixOptions = {}): Plugin {
  let resolved: ResolvedActOptions;
  let isClientBuild = false;

  return {
    name: 'act/remix',
    enforce: 'post',                                   // run after Remix's plugin

    config(_config, env) {
      validatePeerVersions();                          // PRD-406-R2
      if (env.command === 'serve') {
        resolved = resolveDevOptions(options);          // PRD-406-R10 no-op
      } else {
        resolved = resolveBuildOptions(options);
      }
    },

    configResolved(config) {
      isClientBuild = config.build?.ssr !== true;
      validatePrerenderConfig(config);                 // PRD-406-R3
    },

    async closeBundle() {
      if (!isClientBuild) return;                       // PRD-406-R5
      if (this.environment?.mode === 'serve') return;   // PRD-406-R10

      const routes = await getResolvedRemixRoutes();    // PRD-406-R7
      const buildInput = {
        outputDir: resolved.outputDir,
        adapters: resolved.adapters,
        bindings: resolved.bindings,
        target: resolved.conformanceTarget,
        routes,
        mounts: resolved.mounts,
        logger: this.environment?.logger ?? console,    // PRD-406-R18
      };
      const report = await runPipeline(buildInput);     // PRD-400-R1
      await writeBuildReport(resolved.buildReportPath, report);  // PRD-406-R15
      if (resolved.failOnExtractionError && hasExtractionPlaceholders(report)) {
        process.exitCode = 1;                           // PRD-406-R16 / PRD-400-R26
      }
    },
  };
}
```

### Snippet 2 — runtime detection (PRD-406-R3)

```ts
function validatePrerenderConfig(config: ResolvedConfig) {
  const remixOpts = readRemixPluginOptions(config);
  const hasPrerenderDirective =
    remixOpts.prerender != null ||
    remixOpts.routes?.some((r) => r.prerender === true);
  if (!hasPrerenderDirective) {
    throw new Error(
      `[act/remix] Static export not detected. ` +
      `Configure Remix prerendering, or wait for the Remix runtime SDK ` +
      `(deferred to v0.2). See PRD-406-R3.`
    );
  }
}
```

### Snippet 3 — page-level contract reader (PRD-406-R9)

```ts
import { pathToFileURL } from 'node:url';

async function readRouteActExport(
  routeFile: string,
  logger: Logger,
): Promise<PageContract | null> {
  const mod = await import(pathToFileURL(routeFile).href);
  if (!('act' in mod)) return null;
  const exp = mod.act;
  if (typeof exp === 'function') {
    logger.warn(
      `[act/remix] Route ${routeFile} exports 'act' as a function call; ` +
      `runtime evaluation is not supported in v0.1. Skipping.`
    );
    return null;                                       // PRD-406-R9
  }
  return exp as PageContract;
}
```

### Snippet 4 — capability advertising (PRD-406-R13 / R14)

```ts
function buildManifest(emitted: EmittedFile[], opts: ResolvedActOptions): Manifest {
  const observed = {
    subtree: emitted.some((f) => f.path.includes('/act/subtree/')),
    ndjson_index: emitted.some((f) => f.path.endsWith('/act/index.ndjson')),
  };
  const level = computeAchievedLevel(observed);        // PRD-406-R14
  return {
    act_version: '0.1',                                 // PRD-406-R17 (Stage 1)
    site: { name: opts.manifest.siteName ?? 'Remix site' },
    delivery: 'static',
    conformance: { level },
    capabilities: {
      subtree: observed.subtree,
      ndjson_index: observed.ndjson_index,
    },
    index_url: '/act/index.json',
    node_url_template: '/act/{id}.json',
    ...(observed.subtree ? { subtree_url_template: '/act/subtree/{id}.json' } : {}),
    ...(observed.ndjson_index ? { index_ndjson_url: '/act/index.ndjson' } : {}),
    mounts: opts.mounts,
  };
}
```

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft; status `In review`. |
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review. Decisions: (Q1) no resource-route support in v0.1; (Q2) splat routes that prerender are in scope; (Q3) `subtree_url_template` advertised when configured; (Q4) no PRD-207 auto-wiring in v0.1 — known gap; Plus tier achievable but unfixtured for Remix v0.1; (Q5) only routes Remix-Vite actually prerenders become ACT nodes. Ratified: Vite `closeBundle` post-build hook is the canonical entry point. **Normative change (PRD-406-R3):** added explicit note that the runtime detection heuristic ("inspect for `prerender` directive") may need a MINOR amendment as Remix-Vite stabilizes — the spec contract is "static-export-only," not the specific signal name. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
