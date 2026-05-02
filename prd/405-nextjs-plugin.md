# PRD-405 — Next.js plugin (static export)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

Next.js is the dominant React framework in the JavaScript ecosystem and the canonical choice for corporate marketing sites that combine CMS-driven content (Contentful, Sanity, Storyblok) with hand-authored React components. PRD-702 (corporate marketing example) exercises a Next.js + Contentful + i18n stack and gates on this PRD landing first. Without an authoritative integration, three failure modes appear: (1) operators wire each adapter (PRD-202 Contentful, PRD-207 i18n, PRD-301 React) by hand and silently miss canonical-pipeline guarantees from PRD-400; (2) operators serve runtime-rendered pages while treating the build as ACT-static, producing manifests that lie about delivery; (3) operators emit ACT files into a directory Next.js then overwrites at deploy time.

PRD-405 covers the **static export** target only — `output: "export"`. Runtime Next.js sites use PRD-501 (Next.js runtime SDK) instead. The split mirrors PRD-105 (static profile) vs PRD-106 (runtime profile): PRD-405 builds files, PRD-501 mounts route handlers. A given Next.js project ships one or the other; PRD-405 emits a build error if the operator's `next.config.js` doesn't resolve to `output: "export"` (PRD-405-R3).

The integration shape is `withAct(nextConfig, options)` — a familiar wrap-the-config pattern that mirrors `withMDX`, `withBundleAnalyzer`, and dozens of other Next.js plugins. Inside, the integration registers a `NEXT_BUILD_DONE` post-build hook (via Next's `webpack` config plugin or, on Next 15+, a documented build-event listener) that invokes PRD-400's `runPipeline` with the resolved `out/` directory as the build root. Adapters configurable: PRD-201 (markdown/MDX in `content/**`), PRD-202 (Contentful), PRD-207 (i18n via `next-intl`), PRD-208 (programmatic), PRD-301 (React component contract).

PRD-100 (Accepted) defines the wire-format envelopes. PRD-105 (Accepted) defines the static profile. PRD-301 (In review) defines React component extraction. PRD-400 (In review) defines the canonical pipeline this PRD invokes. PRD-501 (In review) is the runtime sibling — PRD-405 explicitly does NOT cover runtime cases. This PRD gates PRD-702 (corporate marketing example) per the INDEX.

### Goals

1. Lock the **integration shape**: `import { withAct } from '@act/nextjs'` returning a Next.js plugin that wraps `nextConfig`. Default-exported as `withAct(nextConfig, options)`.
2. Lock the **target**: `output: "export"` (static export). Reject `output: "server"` and `output: "standalone"` with a build error citing PRD-501 as the runtime path.
3. Lock the **router-mode posture**: App Router (Next 13+ `app/`) is the preferred path; Pages Router (`pages/`) is supported with a documented escape hatch for the React extraction binding (PRD-301-R5 page-level boundary, const form). Hybrid projects (both `app/` and `pages/`) are supported but the integration runs the binding once per route.
4. Lock the **post-build invocation**: PRD-400's `runPipeline` runs after Next's static export completes, against the resolved `distDir + '/' + 'out'` (Next's static export dir; default `out/`).
5. Lock the **content-source defaults**: Markdown/MDX in `content/**` (configurable), CMS adapters (PRD-202 Contentful etc.) configurable, React components in `app/**` and `pages/**` extracted via PRD-301.
6. Lock the **i18n integration**: When `next-intl` is configured, the integration auto-wires PRD-207 with locale enumeration from Next's resolved i18n config. Per PRD-104 Pattern 2 default for Next.js because Next produces locale-prefixed URLs (`/en/...`, `/fr/...`).
7. Lock the **conformance bands**: Core to Plus parameterized by configured adapters and target. The integration emits Plus only when configured adapters and bindings declare Plus capabilities AND the operator opts into Plus emissions.
8. Lock the **failure surface**: build errors halt `next build`; build warnings flow through Next's logger AND the build report sidecar at `out/.act-build-report.json`. The build report path is ALSO available at project root via configuration to keep it out of the deploy artifact.
9. Specify the **dev-mode posture**: `next dev` does NOT run the canonical pipeline. The integration installs no dev middleware; runtime probing under `next dev` would conflict with PRD-501's runtime SDK design. Operators preview ACT artifacts via `next build && npx serve out/`.
10. Enumerate the **test-fixture matrix** under `fixtures/405/positive/` and `fixtures/405/negative/`.

### Non-goals

1. **Runtime Next.js (`output: "server"` / `output: "standalone"`).** Owned by PRD-501.
2. **Next.js Image Optimization Loader integration.** ACT does not consume Next image bundles; `metadata.image_url` is opaque to ACT.
3. **Defining the React component contract.** Owned by PRD-300 / PRD-301.
4. **Defining the Contentful adapter.** Owned by PRD-202.
5. **Defining the i18n adapter.** Owned by PRD-207.
6. **Defining the wire format.** Owned by PRD-100.
7. **Defining the static delivery profile.** Owned by PRD-105.
8. **Specifying ETag derivation.** Owned by PRD-103.
9. **Specifying the validator.** Owned by PRD-600.
10. **Authoring the threat model.** Owned by PRD-109.
11. **Supporting Next.js < 14.** Next 14 is the minimum; pre-14 sites use a community port or upgrade.
12. **Supporting Vercel-specific build features (ISR, Edge Functions).** ISR is a runtime concept (PRD-501); Edge Functions are out of scope (no v0.1 edge runtime SDK).

### Stakeholders / audience

- **Authors of:** PRD-702 (corporate marketing example), Next.js operators building static-exported marketing/docs sites with mixed CMS and component-driven content.
- **Consumers of (upstream):** PRD-100, PRD-103, PRD-104, PRD-105, PRD-107, PRD-108, PRD-109, PRD-200, PRD-201, PRD-202, PRD-207, PRD-208, PRD-300, PRD-301, PRD-400.
- **Consumers of (downstream):** PRD-600 (validator), PRD-702 (corporate marketing example).
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Operator targets `output: "server"` and assumes the integration handles runtime; ACT silently mounts no runtime endpoints. | Medium | High | PRD-405-R3 emits a build error citing PRD-501 when `output != "export"`. The error documents the runtime path. |
| Next 15's build event API differs from Next 14's; the post-build hook strategy needs version-gated paths. | High | Medium | PRD-405-R2 declares Next.js `^14.0.0 \|\| ^15.0.0` as peer dependency; the integration probes `next/package.json` at config-resolve time and selects the appropriate hook strategy. A future Next 16 is a MAJOR change to PRD-405. |
| App Router vs Pages Router page-level contracts diverge — `export const act = ...` works in `pages/`, but `app/` route segments use `route.ts` / `page.tsx` with no convenient single-export mechanism. | Medium | Medium | PRD-405-R8 documents both: in App Router, the integration looks for `export const act` from `page.tsx`; in Pages Router, from `pages/**.tsx`. Hybrid projects work for either form per route. PRD-301-R5 governs the contract semantics. |
| The integration runs against `out/` but Next has not yet written `out/` when the post-build hook fires (race condition). | Low | High | PRD-405-R5 invokes `runPipeline` only after Next emits its `static-export-complete` event (Next 15) or after the equivalent Next 14 indicator (`webpack`'s done callback resolved AND `out/` exists). The integration polls existence of `out/.next-static-export-marker` (Next-emitted artifact) before proceeding. |
| MDX components rendered with React are parsed twice (once by PRD-201 markdown adapter as text, once by PRD-301 React binding). | Medium | Low | PRD-405-R7 specifies that `.mdx` files under `content/**` are owned by PRD-201 (treated as markdown with frontmatter); MDX components rendered via React route trees fall under PRD-301's component contract. The two paths emit distinct nodes when both apply (different IDs). |
| `withAct` returns a Next config object that breaks if other Next plugins (`withMDX`, `withBundleAnalyzer`) mutate config in conflicting ways. | High | Medium | PRD-405-R4 specifies `withAct` is composable left-of: `withAct(withMDX(withBundleAnalyzer(nextConfig)), options)`. The integration only adds: a webpack plugin entry (post-build hook), a content-source resolver, and an env-var sentinel; it does not mutate Next's resolver chain. |
| ACT files written to `out/` may be overwritten by Next's static export if the hook ordering is wrong. | Medium | High | PRD-405-R5 invokes the pipeline AFTER Next's static export completes; PRD-405-R12 enforces atomic-write within `out/.well-known/`, `out/act/`, and the build-report path. The integration MUST NOT touch any path outside the ACT-owned subtree. |
| A `.act-build-report.json` placed inside `out/` ships to the CDN. | High | Low | PRD-405-R15 defaults `buildReportPath` to project root (`./.act-build-report.json`); operators who override into `out/` get a build warning. |
| Operators with i18n configured but `withAct({ i18n: false })` produce single-locale ACT despite multi-locale Next routing. | Medium | Medium | PRD-405-R10 auto-detects Next's i18n config; `i18n: "auto"` is the default. Explicit `i18n: false` disables auto-wiring; the integration emits a build warning when Next declares > 1 locale and ACT i18n is disabled. |

### Open questions

1. ~~Should the integration support `next export` (deprecated in Next 14) as a fallback when `output: "export"` is unset?~~ **Resolved (2026-05-01): No.** `next export` is removed in Next 15; the integration MUST require `output: "export"` set in `next.config.js`. (Closes Open Question 1.)
2. ~~Should the integration emit ACT for non-prerendered routes (e.g., `dynamic = "force-dynamic"`)?~~ **Resolved (2026-05-01): No.** Non-prerendered routes have no static representation; ACT skips them per PRD-105's static profile. Runtime ACT under Next is PRD-501-territory. (Closes Open Question 2.)
3. ~~Should the integration consume Next's Server Components for content extraction?~~ **Resolved (2026-05-01): Yes — via PRD-301's SSR-walk path.** RSC output is HTML-as-rendered, which PRD-301-R20's binding capabilities can walk. Resolved at PRD-301 level; PRD-405 plumbs through. (Closes Open Question 3.)
4. ~~Should the integration pre-warm Next's Image component cache?~~ **Resolved (2026-05-01): No.** Out of scope; ACT does not consume images. (Closes Open Question 4.)
5. ~~Should the integration emit per-route `act_route_metadata` cookies or headers for downstream tooling?~~ **Resolved (2026-05-01): No.** Static profile is file-only; metadata sidecars would duplicate the build report. (Closes Open Question 5.)

### Acceptance criteria

- [ ] Status `In review` is set; changelog entry dated 2026-05-01 by Jeremy Forsythe is present.
- [ ] Every normative requirement has an ID `PRD-405-R{n}` and a declared conformance level per PRD-107.
- [ ] The Specification opens with a table mapping every requirement to PRD-400 + PRD-301 + 100-series requirements implemented.
- [ ] `withAct(nextConfig, options)` is the public surface; no other top-level export is normative.
- [ ] `output: "export"` requirement is pinned with build-error semantics for runtime targets.
- [ ] App Router and Pages Router page-level contracts are both addressed.
- [ ] Post-build invocation strategy (Next 14 vs Next 15) is documented.
- [ ] CMS adapter wiring (PRD-202 Contentful) is documented as opt-in via `adapters: [...]`.
- [ ] React extraction (PRD-301) is auto-detected when `app/` or `pages/` contain `.tsx`/`.jsx`.
- [ ] i18n integration with `next-intl` is documented (Pattern 2 default).
- [ ] Conformance bands described conceptually with the observed-emission rule.
- [ ] Test-fixture path layout enumerated; no fixture files created.
- [ ] Versioning & compatibility section classifies each kind of change.
- [ ] Security section cites PRD-109 and documents Next-specific deltas.
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
- **PRD-202** (In review) — Contentful adapter (opt-in).
- **PRD-207** (In review) — i18n adapter (opt-in).
- **PRD-208** (In review) — programmatic adapter (opt-in).
- **PRD-300** (In review) — component contract.
- **PRD-301** (In review) — React binding.
- **PRD-400** (In review) — generator architecture (parent).
- External: [Next.js plugin pattern](https://nextjs.org/docs/app/api-reference/config/next-config-js), [Next static export](https://nextjs.org/docs/app/building-your-application/deploying/static-exports), [next-intl](https://next-intl-docs.vercel.app/), [App Router](https://nextjs.org/docs/app), [Pages Router](https://nextjs.org/docs/pages), [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174).

### Blocks

- **PRD-702** (corporate marketing site: Next.js + Contentful + i18n) — depends on PRD-405 for the integration contract.

### References

- v0.1 draft: §7 (build integration).
- `prd/000-decisions-needed.md` Q3 (TS-only first-party; PRD-405 ships TS reference impl).
- Prior art: Astro Integrations API (PRD-401), Docusaurus plugin lifecycle (PRD-404), Nuxt module pattern (PRD-407).

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords as clarified by RFC 8174.

### PRD-400 + PRD-301 + 100-series requirements implemented

The table below maps every PRD-405 requirement to the upstream requirement(s) it implements or relies on. This satisfies the workflow.md Phase 3 rule.

| PRD-405 requirement | Upstream requirement(s) implemented or consumed | Relationship |
|---|---|---|
| R1 (`@act/nextjs` package + `withAct`) | PRD-400-R3 (`GeneratorPlugin`) | Plugin shape; default-export `withAct`. |
| R2 (Next.js peer dependency: `^14.0.0 \|\| ^15.0.0`) | PRD-400-R3 | Peer pinning; Next 13 and earlier rejected. |
| R3 (`output: "export"` requirement) | PRD-105-R1 (static profile) | Build error citing PRD-501 when runtime target detected. |
| R4 (`withAct` composability) | PRD-400-R3 | `withAct` is left-of-composable; doesn't mutate other plugins' config. |
| R5 (post-build invocation strategy) | PRD-400-R1, R23, R24 | `runPipeline` runs after Next's static export emits. |
| R6 (content-source defaults) | PRD-201, PRD-202, PRD-207, PRD-208 | Adapters configurable; markdown auto-wired for `content/**`. |
| R7 (markdown vs MDX-as-React disambiguation) | PRD-201, PRD-301 | `.mdx` under `content/**` → PRD-201; `.mdx` rendered via React routes → PRD-301. |
| R8 (App Router page-level contract) | PRD-301-R5 (page-level boundary, const form) | `export const act` from `app/**/page.tsx` and `pages/**.tsx`. |
| R9 (React island detection) | PRD-301-R20 (binding capabilities) | Auto-detect; load `@act/react` only when React routes exist. |
| R10 (i18n auto-wiring with `next-intl`) | PRD-104-R5, R6, R7, PRD-207, PRD-400-R14, R15, R16 | Pattern 2 default; Pattern 1 opt-in. |
| R11 (file-set emission to `out/`) | PRD-400-R9, R10, R11, R12, R13, PRD-105-R1–R7a | Static file set written to Next's `out/`. |
| R12 (atomic writes within ACT-owned subtree) | PRD-400-R23, PRD-105-R12 | Tmp-then-rename; never touch Next-owned paths. |
| R13 (manifest construction with capabilities) | PRD-400-R10, R18, PRD-100-R4, R6 | Computed from observed emissions. |
| R14 (conformance-level computation) | PRD-400-R17, PRD-107-R6, R8, R10 | Achieved level from observed emissions. |
| R15 (build-report sidecar) | PRD-400-R27 | Default at project root; configurable. |
| R16 (`failOnExtractionError` flag) | PRD-400-R26 | Honors PRD-301-R22 placeholder warnings. |
| R17 (Stage 1 adapter pinning) | PRD-400-R29, PRD-200-R25, PRD-108-R14 | v0.1 plugin emits `act_version: "0.1"` only. |
| R18 (Next.js logger plumbing) | PRD-400-R24 | All output via Next's logger. |
| R19 (dev-mode posture: no pipeline) | PRD-400-R24 (no `pre-build` registered for dev) | `next dev` runs no canonical pipeline. |
| R20 (configuration shape: `ActNextOptions`) | PRD-400-R31 (`GeneratorConfig`) | Mirrors `GeneratorConfig`. |
| R21 (test-fixture conformance) | PRD-400-R28 | MUST pass `fixtures/400/` and `fixtures/405/`. |
| R22 (mounts) | PRD-100-R7, PRD-105-R17, PRD-400-R19 | Plugin emits mounts in parent manifest when configured. |

### Conformance level

- **Core:** PRD-405-R1, R2, R3, R4, R5, R6, R7, R11, R12, R13, R14, R17, R18, R19, R20, R21.
- **Standard:** PRD-405-R8, R9, R15, R16 (Standard per PRD-400-R26 / R27); PRD-405-R22 (mounts).
- **Plus:** PRD-405-R10 (i18n; Plus per PRD-107-R10).

A plugin targeting Plus satisfies Standard and Core by additivity (PRD-107-R11).

### Normative requirements

#### Package shape and integration

**PRD-405-R1.** **(Core)** The integration MUST be published as the npm package `@act/nextjs`. The package MUST default-export a function `withAct(nextConfig: NextConfig, options?: ActNextOptions): NextConfig` whose returned value is a Next.js config that wraps a `GeneratorPlugin` (PRD-400-R3) the framework runtime invokes during `next build`. Operators consume `withAct` from `next.config.js`:

```js
const { withAct } = require('@act/nextjs');
module.exports = withAct({ output: 'export', /* ... */ }, { /* options */ });
```

**PRD-405-R2.** **(Core)** The package MUST declare `next` as a peer dependency with the constraint `^14.0.0 || ^15.0.0`. Next.js 13.x and earlier are out of scope; the integration MUST emit a build error citing the unsupported version when `next/package.json` resolves to `< 14.0.0`. Next.js 16+ support is a future MAJOR change to PRD-405 per the Versioning table.

**PRD-405-R3.** **(Core)** The integration MUST inspect the resolved `nextConfig.output` value at config-resolve time. When `output === "export"`, the integration proceeds. When `output === "server"` or `output === "standalone"` (or when `output` is unset and Next defaults to a non-export build), the integration MUST emit a build error citing PRD-501 (Next.js runtime SDK) as the runtime path and PRD-105-R3's static-profile contract. The error MUST include a remediation hint: "Set `output: 'export'` for static ACT, or migrate to `@act/runtime-next` (PRD-501) for runtime ACT."

**PRD-405-R4.** **(Core)** `withAct` MUST be composable: a Next.js project that already wraps its config with `withMDX`, `withBundleAnalyzer`, or other Next plugins MUST be able to wrap `withAct` around the result without conflict:

```js
module.exports = withAct(withMDX(withBundleAnalyzer(nextConfig)), actOptions);
```

The integration MUST NOT mutate fields owned by other Next plugins (e.g., `webpack` config returned by `withBundleAnalyzer`). The integration adds: a webpack plugin entry (the post-build hook), a content-source resolver under a documented internal namespace, and an env sentinel for the build-event listener. All other config is passed through.

#### Post-build invocation

**PRD-405-R5.** **(Core)** The integration MUST invoke PRD-400's `runPipeline` exclusively after Next's static export completes:

- **Next 15+:** the integration registers the `nextBuildDone` hook (or the published equivalent) and invokes `runPipeline` from there.
- **Next 14:** the integration registers a webpack plugin whose `done` callback fires after the export step; the integration polls for `out/.next-static-export-marker` (Next-emitted artifact) for up to 5 seconds before proceeding. If the marker is absent after the timeout, the integration emits a build warning and proceeds against whatever is in `out/` (with the assumption that Next emitted nothing static).

The hook name `nextBuildDone` above is **illustrative**. The Next.js build-event API has evolved across 14.x and 15.x and may continue to evolve; the implementer MUST verify the current published hook against Next.js documentation at the time of implementation. **The normative contract is "post-build static-export emission"** — the pipeline MUST run after Next's static export to `out/` is complete, and only then. Any post-build entry point Next.js publishes (current or future) that satisfies the post-static-export-emission contract is conformant. A change in the underlying Next.js hook name is NOT a MAJOR change to PRD-405 (the hook name is implementation detail, not a wire-format concern).

The pipeline writes to ACT-owned paths only (`out/.well-known/`, `out/act/`, and the build-report path). The integration MUST NOT touch Next-owned paths (HTML pages, asset bundles, JSON snapshots).

#### Content sources

**PRD-405-R6.** **(Core)** The integration MUST, by default, auto-wire one PRD-201 (markdown/MDX) adapter instance per discovered content directory. The default content roots are `content/**/*.{md,mdx}` (configurable via `withAct({ content: { roots: [...] } })`). When the operator supplies an explicit `adapters: [...]` array, auto-wiring is skipped per the explicit-config-wins rule. The integration MUST surface an empty-corpus build warning when no markdown sources AND no other adapters AND no React routes are configured.

**PRD-405-R7.** **(Core)** The integration MUST disambiguate `.mdx` files based on filesystem location:

- `.mdx` under `content/**` → owned by PRD-201 (treated as markdown with frontmatter; React component imports are stripped to text per PRD-201's MDX handling).
- `.mdx` under `app/**` or `pages/**` → owned by PRD-301 (treated as a route module; the React component contract applies via SSR-walk).

Both paths MAY apply to the same file when present in both locations; each path emits a distinct node with a different ID.

**PRD-405-R8.** **(Standard)** The integration MUST honor PRD-301-R5's page-level boundary (const form):

- **App Router:** when a route's `page.tsx` exports a top-level `act` constant, the integration reads the export at build time and supplies it to PRD-301's `extractRoute`. Route module location is `app/**/page.{tsx,jsx,mdx}`.
- **Pages Router:** when a route's module under `pages/**.{tsx,jsx,mdx}` exports a top-level `act` constant, the integration reads the export at build time. `getStaticProps` / `getStaticPaths` outputs are passed as `routeProps` to PRD-301's `extractRoute`.

A route whose `act` export is a function-call result requiring runtime evaluation is NOT supported in v0.1; the integration emits a build warning and skips the page-level contract for that route. ID validation per PRD-301-R7 / PRD-100-R10 happens before extraction.

**PRD-405-R9.** **(Standard)** The integration MUST detect React routes (`.tsx`/`.jsx` files under `app/`, `pages/`, or `src/components/`). When detected, the integration MUST load `@act/react` (PRD-301-R1) and dispatch component extraction per PRD-301's `extractRoute` via PRD-400-R5. When no React routes are detected (rare for Next.js but possible for content-only projects), the integration SHOULD NOT load the binding. The default extraction mode is SSR-walk (PRD-301-R20); static-AST is opt-in via `withAct({ extractMode: 'static-ast' })`.

#### i18n

**PRD-405-R10.** **(Plus)** When `withAct({ i18n: 'auto' })` (default) AND the resolved `nextConfig` declares `i18n.locales` (Pages Router) OR the project includes `next-intl` (App Router), the integration MUST auto-wire PRD-207 with locale enumeration from the resolved config. PRD-104 emission pattern is **Pattern 2** (per-locale manifests at `/{locale}/.well-known/act.json`) by default — Next.js produces locale-prefixed URLs naturally, so per-locale manifests align with hosting layout. Pattern 1 is opt-in via `withAct({ i18n: { pattern: '1' } })`. Per PRD-400-R14, the integration MUST NOT mix patterns within a single build. When `withAct({ i18n: false })` AND Next declares > 1 locale, the integration emits a build warning ("multi-locale Next config detected; ACT i18n disabled") but proceeds with single-locale emission.

#### File-set emission

**PRD-405-R11.** **(Core / Standard / Plus parameterized)** The integration MUST emit the static file set per PRD-105 layout into the resolved `out/` directory:

- `out/.well-known/act.json` (manifest; Core).
- `out/act/index.json` (index; Core).
- `out/act/<id>.json` (per node; Core).
- `out/act/subtree/<id>.json` (Standard, when subtree advertised).
- `out/act/index.ndjson` (Plus, when NDJSON advertised).

Per PRD-105-R9, the on-disk extension MAY be `.act.json`. The integration's default is `.json` to align with Next's static file naming.

**PRD-405-R12.** **(Core)** The integration MUST honor PRD-400-R23's atomic-write contract: every ACT-owned file is written via tmp-then-rename within `out/`. The integration MUST NOT touch Next-owned paths. The on-error hook (PRD-400-R24) cleans up any lingering `*.tmp.*` files inside `out/.well-known/`, `out/act/`, and the build-report path.

#### Manifest construction and conformance

**PRD-405-R13.** **(Core)** The integration MUST construct the manifest with `delivery: "static"`, `act_version: "0.1"` (Stage 1 pinning per PRD-405-R17), and `conformance.level` computed per PRD-405-R14. The manifest's `capabilities` object MUST be populated from observed emissions (PRD-400-R18), not from configuration intent.

**PRD-405-R14.** **(Core)** The integration MUST compute the achieved conformance band per PRD-400-R17:

- `core` if only the Core file set is emitted.
- `standard` if subtree files are emitted AND every Standard requirement is met.
- `plus` if NDJSON index is emitted AND every Plus requirement is met (including i18n if the project is multi-locale).

The integration MUST NOT inflate the level beyond observed emissions, even if `withAct({ target: 'plus' })` is configured.

#### Build report

**PRD-405-R15.** **(Standard)** The integration MUST write a build report sidecar per PRD-400-R27. The default `buildReportPath` is `./.act-build-report.json` at the project root (NOT inside `out/`) to avoid CDN upload via `next export`. Operators who override `buildReportPath` to point inside `out/` MUST receive a build warning. The build report enumerates every emitted ACT file (Next's HTML files are NOT enumerated), every warning, every error, the configured target level, the achieved level, and the build duration.

**PRD-405-R16.** **(Standard)** The integration MUST honor `withAct({ failOnExtractionError: boolean })` per PRD-400-R26. Default `false`. When `true`, any PRD-301-R22 placeholder block emitted during component extraction causes `next build` to exit non-zero after the build report is finalized.

#### Adapter pinning

**PRD-405-R17.** **(Core)** The integration MUST enforce PRD-400-R29 (Stage 1) before any adapter `init` runs. An adapter package whose declared `act_version` does not equal the build's target (`"0.1"` for v0.1) MUST cause the integration to fail the build with a non-zero exit code. The integration surfaces the failing adapter's package name and declared version via Next's logger.

#### Logger plumbing

**PRD-405-R18.** **(Core)** The integration MUST plumb Next.js's logger (or `console` when no logger is exposed) into PRD-400's `BuildContext.logger`. Every PRD-400 hook receives the Next logger. The integration MUST NOT use `console.log` directly outside the logger; all output goes through the logger so `next build` flag combinations behave as expected.

#### Dev-mode posture

**PRD-405-R19.** **(Core)** The integration MUST NOT run the canonical pipeline during `next dev`. Specifically, when `NODE_ENV !== 'production'` OR when the integration detects `next dev` invocation, the post-build hook MUST be a no-op. Operators preview ACT artifacts via `next build && npx serve out/`. The integration MAY install a documented status check that surfaces a one-time message during `next dev` ("ACT artifacts are produced only by `next build`; run `next build` to generate them").

#### Configuration shape

**PRD-405-R20.** **(Core)** `withAct(nextConfig, options)` MUST satisfy PRD-400-R31's `GeneratorConfig` minimum. The `options` parameter (`ActNextOptions`) carries Next-specific defaults applied at config-resolve time:

```ts
interface ActNextOptions {
  conformanceTarget?: 'core' | 'standard' | 'plus';     // default: 'core'
  outputDir?: string;                                    // default: nextConfig.distDir + '/out'
  buildReportPath?: string;                              // default: './.act-build-report.json'
  content?: { roots?: string[] };                        // default: ['content/**/*.{md,mdx}']
  adapters?: Adapter[];                                  // overrides auto-wiring when set
  bindings?: Binding[];                                  // overrides React auto-detection when set
  extractMode?: 'ssr-walk' | 'static-ast';               // default: 'ssr-walk'
  i18n?: 'auto' | false | { pattern?: '1' | '2' };       // default: 'auto'
  failOnExtractionError?: boolean;                       // default: false
  mounts?: ManifestMount[];                              // default: []
  manifest?: { siteName?: string; rootId?: string };     // observability hints
}
```

#### Test-fixture conformance

**PRD-405-R21.** **(Core)** The integration MUST pass the framework conformance fixture corpora at `fixtures/400/positive/` and `fixtures/405/positive/`, producing byte-equivalent output (modulo `generated_at` timestamps) to the TS reference. Negative fixtures MUST surface the documented error or warning.

#### Mounts

**PRD-405-R22.** **(Standard)** When `withAct({ mounts: [...] })` is set, the integration MUST emit the mounts array in the parent manifest per PRD-100-R7 and PRD-107-R5. The integration MUST NOT recurse into a mount target (per PRD-400-R19). A mount target with `delivery: "runtime"` resolves at consumer-discovery time; PRD-405 only writes the parent manifest.

### Wire format / interface definition

```ts
// @act/nextjs public surface

import type { NextConfig } from 'next';
import type { Adapter, Binding, ManifestMount } from '@act/core';

export interface ActNextOptions {
  conformanceTarget?: 'core' | 'standard' | 'plus';
  outputDir?: string;
  buildReportPath?: string;
  content?: { roots?: string[] };
  adapters?: Adapter[];
  bindings?: Binding[];
  extractMode?: 'ssr-walk' | 'static-ast';
  i18n?: 'auto' | false | { pattern?: '1' | '2' };
  failOnExtractionError?: boolean;
  mounts?: ManifestMount[];
  manifest?: { siteName?: string; rootId?: string };
}

export function withAct(
  nextConfig: NextConfig,
  options?: ActNextOptions,
): NextConfig;
```

### Errors

| Condition | Severity | Notes |
|---|---|---|
| `output: "server"` or `output: "standalone"` | Build error | PRD-405-R3; cite PRD-501 |
| `next` resolves to `< 14.0.0` | Build error | PRD-405-R2 |
| `output` unset (Next defaults to server build) | Build error | PRD-405-R3 |
| Page-level `act` export is a function call requiring runtime eval | Build warning | Skip extraction; PRD-405-R8 |
| Multi-locale Next config but `i18n: false` | Build warning | PRD-405-R10 |
| `buildReportPath` inside `out/` | Build warning | PRD-405-R15 |
| Adapter `act_version` mismatch (Stage 1) | Build error | PRD-405-R17 |
| Schema validation failure on emitted envelope | Build error | PRD-400-R21 |
| No content sources, no React routes, no adapters | Build warning | Empty-corpus case |
| `static-export-marker` absent after timeout | Build warning | PRD-405-R5 |

---

## Examples

### Example 1 — minimal Next.js + markdown (Core)

```js
// next.config.js
const { withAct } = require('@act/nextjs');
module.exports = withAct({ output: 'export' }, { conformanceTarget: 'core' });
```

Source layout:

```
app/
  page.tsx
  about/page.tsx
content/
  blog/post-1.md
  blog/post-2.md
```

Emitted (after `next build`):

```
out/.well-known/act.json
out/act/index.json
out/act/blog/post-1.json
out/act/blog/post-2.json
out/act/about.json                    (from app/about/page.tsx page-level contract, if exported)
.act-build-report.json                (project root)
```

### Example 2 — Next.js + Contentful + i18n (Plus)

```js
const { withAct } = require('@act/nextjs');
const { contentful } = require('@act/contentful');
const { intl } = require('@act/i18n');

module.exports = withAct(
  { output: 'export' },
  {
    conformanceTarget: 'plus',
    adapters: [
      contentful({ space: process.env.CONTENTFUL_SPACE, environment: 'master' }),
      intl({ locales: ['en', 'fr', 'de'], defaultLocale: 'en' }),
    ],
    i18n: { pattern: '2' },
  },
);
```

Emitted (Pattern 2):

```
out/en/.well-known/act.json + act/* (index.json, index.ndjson, per-node, subtrees)
out/fr/.well-known/act.json + act/*
out/de/.well-known/act.json + act/*
.act-build-report.json
```

---

## Test fixtures

PRD-405 fixtures verify the integration end-to-end. Files are not created by this PRD; they are enumerated for downstream authoring.

### Positive

- `fixtures/405/positive/minimal-export-core/` — `output: "export"`, `content/` only.
- `fixtures/405/positive/app-router-page-contract/` — App Router with `export const act` from `page.tsx`.
- `fixtures/405/positive/pages-router-page-contract/` — Pages Router equivalent.
- `fixtures/405/positive/hybrid-app-pages/` — both routers; binding runs once per route.
- `fixtures/405/positive/contentful-adapter/` — PRD-202 wired explicitly.
- `fixtures/405/positive/i18n-pattern2-next-intl/` — auto-wired `next-intl` with Pattern 2.
- `fixtures/405/positive/i18n-pattern1-opt-in/` — Pattern 1 via explicit option.
- `fixtures/405/positive/standard-with-subtree/` — Standard band; subtree files emitted.
- `fixtures/405/positive/plus-with-ndjson/` — Plus band; NDJSON index emitted.
- `fixtures/405/positive/with-mounts/` — parent manifest declares mounts.
- `fixtures/405/positive/composability-with-mdx/` — `withAct(withMDX(...))` composes cleanly.

### Negative

- `fixtures/405/negative/output-server/` — `output: "server"`; build error citing PRD-501.
- `fixtures/405/negative/next-13/` — Next 13 peer; build error per PRD-405-R2.
- `fixtures/405/negative/no-content-no-routes/` — empty corpus; build warning.
- `fixtures/405/negative/page-act-runtime-call/` — `export const act = makeAct()`; build warning, skip extraction.
- `fixtures/405/negative/adapter-version-mismatch/` — adapter declares `act_version: "0.2"`; build error per PRD-405-R17.
- `fixtures/405/negative/build-report-inside-out/` — `buildReportPath: "./out/.act-build-report.json"`; build warning per PRD-405-R15.
- `fixtures/405/negative/i18n-disabled-multilocale/` — Next has `i18n.locales` set; `withAct({ i18n: false })`; build warning per PRD-405-R10.
- `fixtures/405/negative/non-conforming-id/` — page contract emits an ID violating PRD-100-R10 grammar; build error.

---

## Versioning & compatibility

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a new `ActNextOptions` field | MINOR | |
| Add support for a new Next.js MAJOR (e.g., Next 16) | MAJOR | Peer constraint widens; behavior may shift |
| Drop support for a Next.js MAJOR | MAJOR | |
| Tighten an SHOULD to a MUST | MAJOR | |
| Loosen a MUST to a SHOULD | MAJOR | |
| Change default `i18n` behavior from `'auto'` to `false` | MAJOR | Output diverges for multi-locale projects |
| Change default `extractMode` | MAJOR | Output may shift |
| Add support for `output: "server"` | MAJOR | Reverses PRD-405-R3 |

### Forward compatibility

The integration MUST tolerate unknown optional fields on `nextConfig` per Next's own forward-compat rules. Adapter capabilities (PRD-200-R22) follow PRD-200's tolerance rules. Per PRD-108-R7, unknown optional fields in PRD-100 envelopes are tolerated.

### Backward compatibility

A plugin upgrading from a prior PRD-405 minor MUST emit byte-equivalent output for unchanged source corpora and unchanged adapter sets. Source diffs that change defaults (e.g., a default `extractMode` change) are MAJOR.

---

## Security considerations

PRD-109 (Accepted) governs the project-wide threat model. PRD-405 deltas:

- **Build environment trust.** `next build` runs with full filesystem access. The integration MUST NOT exfiltrate content beyond the configured `outputDir` and `buildReportPath`. The integration MUST NOT perform network requests during the canonical pipeline; CMS adapter network access is the adapter's responsibility per PRD-200's `init`/`enumerate` model.
- **Webpack plugin scope.** The integration's webpack plugin MUST observe Next's webpack config without mutating it (read-only on `compilation.hooks.done`). Mutating webpack config could introduce build-output drift.
- **Build-report leakage.** The default `buildReportPath` is at project root, NOT inside `out/`, to avoid CDN upload. PRD-405-R15 codifies this.
- **Component extraction trust.** PRD-301's SSR-walk renders user code in Node.js during the build. Operators trust the components they import; PRD-405 inherits PRD-300's component-trust model. The integration MUST NOT widen the trust boundary.
- **i18n disclosure.** Per PRD-104's threat model, locale-prefixed URLs do not leak per-tenant identity. PRD-405 only emits Pattern 2 manifests for declared locales; no per-user dynamic locale switching.
- **Information disclosure (404 vs 403).** Static profile only; no auth boundary applies.
- **DoS / resource bounds.** The integration MUST respect PRD-301's per-route extraction budget. A misbehaving binding that hangs blocks `next build`; this is acceptable behavior — the operator's CI surfaces the timeout.

---

## Implementation notes

The TypeScript snippets below show the canonical integration shape. They are normative only insofar as PRD-405's normative requirements pin the behavior; the actual code in `@act/nextjs` is the implementer's choice.

### Snippet 1 — `withAct` shape

```ts
import type { NextConfig } from 'next';
import { runPipeline, type GeneratorPlugin } from '@act/core';
import type { ActNextOptions } from './types';

export function withAct(
  nextConfig: NextConfig,
  options: ActNextOptions = {},
): NextConfig {
  validateNextVersion();                 // PRD-405-R2
  validateOutputExport(nextConfig);      // PRD-405-R3
  const resolved = resolveOptions(nextConfig, options);

  return {
    ...nextConfig,
    webpack(config, ctx) {
      const merged = nextConfig.webpack?.(config, ctx) ?? config;
      if (ctx.isServer && !ctx.dev) {
        merged.plugins = [
          ...(merged.plugins ?? []),
          new ActWebpackPostBuildPlugin(resolved),  // PRD-405-R5
        ];
      }
      return merged;
    },
  };
}
```

### Snippet 2 — post-build hook (Next 14 + Next 15 strategy)

```ts
import { promises as fs } from 'node:fs';
import path from 'node:path';

class ActWebpackPostBuildPlugin {
  constructor(private opts: ResolvedActOptions) {}
  apply(compiler: any) {
    compiler.hooks.done.tapPromise('act/nextjs', async () => {
      // PRD-405-R5: wait for static-export-marker (Next 14) or rely on
      // Next 15 build-event.
      await waitForExportMarker(this.opts.outputDir);

      const buildInput = {
        outputDir: this.opts.outputDir,
        adapters: this.opts.adapters,
        bindings: this.opts.bindings,
        target: this.opts.conformanceTarget,
        i18n: this.opts.i18n,
        mounts: this.opts.mounts,
        logger: this.opts.logger,
      };
      const report = await runPipeline(buildInput);   // PRD-400-R1
      await writeBuildReport(this.opts.buildReportPath, report);  // PRD-405-R15
      if (this.opts.failOnExtractionError && hasExtractionPlaceholders(report)) {
        process.exitCode = 1;                          // PRD-405-R16 / PRD-400-R26
      }
    });
  }
}
```

### Snippet 3 — capability advertising (PRD-405-R13 / R14)

```ts
function buildManifest(emitted: EmittedFile[], opts: ResolvedActOptions): Manifest {
  const observed = {
    subtree: emitted.some((f) => f.path.includes('/act/subtree/')),
    ndjson_index: emitted.some((f) => f.path.endsWith('/act/index.ndjson')),
    search: opts.searchTemplate != null,
  };
  const level = computeAchievedLevel(observed);        // PRD-405-R14
  return {
    act_version: '0.1',                                 // PRD-405-R17 (Stage 1)
    site: { name: opts.manifest.siteName ?? inferFromNext() },
    delivery: 'static',
    conformance: { level },
    capabilities: {
      subtree: observed.subtree,
      ndjson_index: observed.ndjson_index,
      ...(observed.search ? { search: { template_advertised: true } } : {}),
    },
    index_url: '/act/index.json',
    node_url_template: '/act/{id}.json',
    ...(observed.subtree ? { subtree_url_template: '/act/subtree/{id}.json' } : {}),
    ...(observed.ndjson_index ? { index_ndjson_url: '/act/index.ndjson' } : {}),
    mounts: opts.mounts,
  };
}
```

### Snippet 4 — App Router page-level contract reader (PRD-405-R8)

```ts
import { pathToFileURL } from 'node:url';

async function readPageActExport(routeFile: string): Promise<PageContract | null> {
  const mod = await import(pathToFileURL(routeFile).href);
  if (!('act' in mod)) return null;
  const exp = mod.act;
  if (typeof exp === 'function') {
    // runtime-call form; not supported in v0.1 (PRD-405-R8)
    return { _unsupported: true };
  }
  return exp as PageContract;                          // const form
}
```

### Snippet 5 — i18n auto-detection (PRD-405-R10)

```ts
function resolveI18n(nextConfig: NextConfig, opt: ActNextOptions['i18n']) {
  if (opt === false) return null;
  // App Router: detect next-intl via package import in middleware/config.
  // Pages Router: read nextConfig.i18n.
  const pagesRouterI18n = nextConfig.i18n;
  const nextIntlConfig = detectNextIntl();
  const locales =
    nextIntlConfig?.locales ?? pagesRouterI18n?.locales ?? null;
  if (!locales || locales.length <= 1) return null;
  return {
    locales,
    defaultLocale: pagesRouterI18n?.defaultLocale ?? nextIntlConfig?.defaultLocale,
    pattern: typeof opt === 'object' && opt.pattern ? opt.pattern : '2', // PRD-405-R10
  };
}
```

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft; status `In review`. |
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review. Decisions: (Q1) no `next export` fallback — `output: "export"` REQUIRED; (Q2) no ACT emission for non-prerendered / `force-dynamic` routes — runtime is PRD-501; (Q3) RSC content extraction goes through PRD-301 SSR-walk; (Q4) no Next Image cache pre-warm; (Q5) no per-route metadata cookies/headers. Ratified: `withAct(nextConfig)` peer-pinned to `next ^14.0.0 || ^15.0.0` (bound but flexible); App Router preferred, Pages Router escape hatch documented. **Normative change (PRD-405-R5):** clarified that the hook name `nextBuildDone` (and Next 14 webpack `done` fallback) is illustrative — the spec contract is "post-build static-export emission," not a specific hook name. Implementer MUST verify the current published Next.js build-event API; a future Next.js hook-name change is NOT a MAJOR change to PRD-405. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
