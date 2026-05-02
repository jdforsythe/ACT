# PRD-702 — Corporate marketing site (Next.js + Contentful + i18n)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

A corporate marketing site is the highest-surface-area shape in the v0.1 example matrix: it composes CMS-driven copy, design-system component blocks, UI-string microcopy, and four production locales into a single deployed artifact. Every Plus capability the spec defines — the `marketing:*` block namespace (PRD-102), the `locales` manifest block and per-locale fan-out (PRD-104), the NDJSON index, the search-template advertisement, multi-source merging across primary and fallback adapters (PRD-200) — surfaces in this build. If the spec quietly lets two of those compose only on paper, this example exposes it.

The v0.1 working draft sketches the shape across §6.5 (composite Acme config) and §8.4 (the rendered Pricing example with English and Spanish nodes). The draft narrative is correct but non-normative; PRD-702 turns it into a buildable reference that PRD-600 (validator) can certify and that downstream operators can copy. The example targets `next build && next export` (per PRD-405-R3), wires PRD-202 (Contentful) for marketing copy and FAQ entries, wires PRD-207 (`next-intl`) for UI strings, and uses PRD-301's React binding to extract design-system component contracts at SSR-walk time. PRD-104 Pattern 2 (per-locale manifests) is the default for Next.js per PRD-405-R10.

### Site description

- **Stack.** Next.js 15 with App Router, `output: "export"`, `next-intl` for UI strings, Contentful for marketing copy, design-system components instrumented per PRD-301.
- **Locales.** Four: `en-US` (default), `es-ES`, `de-DE`, `ja-JP` — matching the v0.1 draft §6.5 / §8.4 example.
- **Content.** ~24 marketing routes (home, pricing, features, about, contact, ~12 product/solution pages, ~7 legal/policy pages), each rendered per locale. Roughly 96 nodes total (~24 routes × 4 locales). FAQ entries and testimonials live as nested Contentful entries pulled into pages via `marketing:faq` and `marketing:testimonial` blocks; they are not separate nodes.
- **Components.** Five primary `marketing:*` blocks instrumented in the design system: `marketing:hero`, `marketing:feature-grid`, `marketing:pricing-table`, `marketing:testimonial`, `marketing:faq`, plus a generic `marketing:cta`.
- **Scale.** Static build only. No runtime profile. Each locale's manifest, index, and per-node files ship to the CDN under a locale-prefixed path. Total emitted file count: ~500 ACT files (manifest + index + index.ndjson + ~96 nodes + ~24 subtree files per locale × 4 locales, plus the parent root manifest).
- **Search.** Search is advertised via `search_url_template` pointing to a static-prerendered token-prefix endpoint (search payload itself is generated at build time from the index; PRD-100 owns the search-response envelope). The example exercises advertisement, not runtime search semantics.

### Goals

1. Publish a runnable Next.js + Contentful + `next-intl` reference whose `next build` produces an ACT tree that PRD-600 certifies as **Plus**.
2. Exercise every cited P2 PRD's normative surface: at least one PRD-405 requirement, one PRD-202 requirement, one PRD-207 requirement, one PRD-301 requirement, and the manifest/index/node envelopes from PRD-100 + PRD-104.
3. Demonstrate the canonical Pricing route from v0.1 draft §8.4 across all four locales, including the `metadata.translations` dense form (PRD-104-R9) and untranslated-fallback semantics (PRD-104-R10/R11).
4. Demonstrate multi-source merging: a single page's node carries Contentful-sourced scalar fields (title, summary, hero copy) AND `next-intl`-sourced UI-string metadata, merged per PRD-200-R12 with PRD-202 as primary and PRD-207 as fallback (PRD-207-R6).
5. Provide concrete file-by-file emission expectations so the validator's `gaps`-vs-`achieved` reporter can be regression-tested against the example.
6. Provide a sample `next.config.js`, sample Contentful content-model JSON, and sample `next-intl` message catalog snippets — enough to anchor the build, not enough to constitute a full implementation.

### Non-goals

1. **Runtime ACT serving.** This example is static-export only. PRD-705 (B2B SaaS workspace) covers runtime ACT.
2. **Full Contentful content-model authoring.** The example documents enough field shapes for PRD-202 to ingest; bulk content is left to operators.
3. **Search-engine implementation.** The example advertises `search_url_template` and ships a build-time prerendered search payload, but designing a real query engine is out of scope (PRD-100 / PRD-600 own the wire shape).
4. **Defining the `marketing:*` block namespace.** Owned by PRD-102.
5. **Defining i18n patterns.** Owned by PRD-104.
6. **Defining the React component contract.** Owned by PRD-300 / PRD-301.
7. **Authoring the conformance reporter.** Owned by PRD-600.
8. **Cross-locale `id` re-slugging policies** (e.g., emitting `/es-ES/act/n/precios.json` instead of `/es-ES/act/n/pricing.json`). PRD-104 permits both; the example pins per-locale slug stability — the same `id` is reused across locales — for simplicity. The draft §8.4 example shows a re-slugged Spanish ID (`precios`); this example deviates from the draft on that single point and notes it in Open questions.

### Stakeholders / audience

- **Authors of:** marketing-site operators evaluating ACT for a Next.js + Contentful + `next-intl` stack; PRD-405 implementers needing a high-surface integration test; PRD-600 implementers needing a Plus-band end-to-end fixture.
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The example's emitted file set drifts from PRD-405-R11's directory layout. | Medium | High | PRD-702-R1 enumerates the exact emitted file set; the validator regression-tests against that list. |
| Contentful adapter ingests partial entries (untranslated fields) and produces nodes whose locale fallback metadata lies. | Medium | Medium | PRD-702-R8 requires every node missing translations in a non-default locale to carry `metadata.translation_status: "fallback"` AND `metadata.fallback_from: "en-US"` per PRD-104-R10 / R11; PRD-202-R14 already requires this for Contentful-sourced content. |
| `next-intl` and Contentful fight over which adapter contributes the page title (collision on `metadata.locale`). | Medium | High | PRD-702-R7 requires the `next-intl` adapter to declare `precedence: "fallback"` per PRD-207-R6, contributing only `metadata.*` fields. The Contentful adapter is primary. PRD-200-R12's merge step deep-merges; the validator catches scalar collisions. |
| Operators copy-paste the example with `i18n: false` and silently ship a single-locale ACT tree despite Next's multi-locale routing. | Medium | Medium | PRD-702-R2 sets `i18n: { pattern: '2' }` explicitly in the example's `withAct` options. PRD-405-R10's auto-detect would also default to Pattern 2, but explicit > implicit for example code. |
| The `marketing:*` blocks' shape diverges between PRD-102's canonical schemas and the example's React `extract` outputs, producing build warnings under PRD-301-R14's pre-emit validation. | Medium | Medium | PRD-702-R5 pins the example's design-system contracts to the canonical block shapes from PRD-102-R6 through PRD-102-R11; the example's `extract` outputs are the same shape. |
| The build report sidecar (PRD-405-R15) ships to the CDN because operators override its path into `out/`. | Low | Low | PRD-702 keeps the default `./.act-build-report.json` path; PRD-405-R15 already emits a build warning on override. |
| The example exposes an ambiguity in PRD-207's `metadata.translations` shape when a node has zero co-locale translations (an untranslated entry). PRD-207-R5 says "every other locale for which the message catalog has a translation" — but the underlying node may be Contentful-sourced, not catalog-sourced, and Contentful is the primary adapter. The merge produces a node whose `metadata.translations` is empty in the fallback case but non-empty when ≥ 1 sibling locale exists. | Medium | Low | Flagged in Open questions. The example's tests document the chosen behavior; if PRD-207 needs amending, the v0.2 RFC handles it. PRD-207 is not amended here. |

### Open questions

1. The v0.1 draft §8.4 example shows the Spanish Pricing node at `/es-ES/act/n/precios.json` (re-slugged ID). This example pins a single ID per route across locales (e.g., `/es-ES/act/n/pricing.json`), citing operator simplicity and PRD-104-R5/R6 silence on re-slugging. **Should the example demonstrate per-locale re-slugging instead?** Tentatively: no — single-ID-per-route is simpler and PRD-104 permits it; per-locale re-slugging is documented as a deviation pattern operators can choose.
2. The Contentful adapter (PRD-202-R14) populates `metadata.translations` from CMS-side translation data; the i18n adapter (PRD-207-R5) populates the same field from message-catalog presence. **When both adapters contribute partial `translations` arrays for the same node, PRD-200-R12's deep-merge concatenates rather than dedupes.** The example produces test fixtures showing dedupe-by-(locale, id) is the expected behavior; PRD-200's wire-format-level rule on `metadata.translations` array merging is silent. Flagged for v0.2 review of PRD-200; **not amending PRD-200 here.**
3. The example exercises `search_url_template` via a build-time prerendered search payload, but PRD-100's search-response envelope assumes runtime evaluation. **Is a prerendered static search a conformant Plus surface?** Tentatively: yes, since PRD-105 (static profile) makes no statement to the contrary. PRD-600 should still report `achieved: plus` provided the search endpoint actually responds. Confirmed against PRD-107-R10's wording.

### Acceptance criteria

- [ ] Status `In review` is set; changelog entry dated 2026-05-02 by Jeremy Forsythe is present.
- [ ] Every normative requirement has an ID `PRD-702-R{n}` and a declared conformance level per PRD-107.
- [ ] The Specification opens with a table mapping cited P2 PRDs to the requirements the example exercises.
- [ ] Every cited P2 PRD (PRD-405, PRD-202, PRD-207, PRD-301, PRD-600) has at least one of its requirements exercised.
- [ ] Conformance target Plus is declared and justified.
- [ ] File-by-file emission expectations are enumerated.
- [ ] Acceptance criteria below include: example builds clean; PRD-600 reports zero errors; reported `achieved` matches declared target; cited-PRD coverage is non-empty.
- [ ] Versioning & compatibility table is present.
- [ ] Security section cites PRD-109 and documents Next-specific deltas already covered by PRD-405-R *Security considerations*.

---

## Context & dependencies

### Depends on

- **PRD-100** (Accepted) — wire-format envelopes (manifest, index, node).
- **PRD-102** (Accepted) — content blocks, including the `marketing:*` namespace.
- **PRD-104** (Accepted) — i18n: locales block, `metadata.translations`, `metadata.translation_status`, Pattern 1 vs Pattern 2.
- **PRD-105** (Accepted) — static delivery profile.
- **PRD-107** (Accepted) — conformance levels.
- **PRD-200** (Accepted) — adapter framework: multi-source merging, primary vs fallback precedence.
- **PRD-202** (Accepted) — Contentful adapter.
- **PRD-207** (Accepted) — i18n adapter (`next-intl` library).
- **PRD-301** (Accepted) — React binding for component-contract extraction.
- **PRD-405** (Accepted) — Next.js plugin (static export).
- **PRD-600** (Accepted) — validator and conformance reporter.
- External: [Next.js 15 App Router](https://nextjs.org/docs/app), [next-intl](https://next-intl-docs.vercel.app/), [Contentful Content Delivery API](https://www.contentful.com/developers/docs/references/content-delivery-api/), [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174).

### Blocks

_Not applicable — examples are leaves of the dependency DAG; no PRD depends on PRD-702 reaching Accepted._

### References

- v0.1 draft: §6.5 (composite Acme config), §8.4 (Corporate marketing site — Pricing route, four locales).
- PRD-405 §"Examples" Example 2 (Next.js + Contentful + i18n Plus snippet).
- Prior art: Next.js + Contentful starter templates from Vercel; `next-intl` examples; the v0.1 draft's narrative tone for §8.4.

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords as clarified by RFC 8174.

### Cited-PRD coverage table

| PRD | Requirement(s) exercised | Where in this example |
|---|---|---|
| PRD-100 | R4 (manifest envelope), R6 (capabilities), R7 (mounts; not used — single root), R10 (ID grammar), R21 (envelope schema), R28–R31 (block discriminator + canonical types) | Every emitted manifest/index/node passes PRD-100's schemas. |
| PRD-102 | R6–R11 (`marketing:*` canonical types — `hero`, `feature-grid`, `pricing-table`, `testimonial`, `faq`), R20 (component-extracted block metadata) | Every page's `content[]` carries one or more `marketing:*` blocks plus a final `marketing:cta`. |
| PRD-104 | R1, R2, R3, R4, R6 (Pattern 2 — per-locale manifests), R7 (no pattern mixing), R9 (`metadata.translations` dense form), R10, R11 (`translation_status`, `fallback_from`) | Four locales, four per-locale manifests, every node carries `metadata.translations`. |
| PRD-105 | R1 (static profile envelope), R7a (static layout) | All emissions are static files; no runtime endpoints. |
| PRD-107 | R10 (Plus declaration), R11 (additivity) | `conformance.level: "plus"` declared per locale. |
| PRD-200 | R12 (multi-source merge), R13 (`metadata.source.contributors`), R15 (precedence) | Each Pricing-style node carries contributors `["act-contentful", "act-i18n"]`. |
| PRD-202 | R1, R5 (CDA enumeration), R7 (default field heuristics), R10 (Rich Text → blocks), R12 (Pattern 1 multi-locale; this example overrides to Pattern 2 via PRD-202-R13), R14 (cross-locale translations), R20 (`metadata.source`), R22 (manifest capabilities) | The Contentful adapter is the primary content source; landing pages, FAQ entries, and product copy all originate here. |
| PRD-207 | R1, R3 (`next-intl` library format), R4 (partial-node emission), R5 (`metadata.translations`), R6 (`precedence: "fallback"`), R7 (`translation_status`), R15 (capabilities), R17 (`metadata.source`) | UI-string microcopy contributes to `metadata.*` only; never overrides Contentful scalars. |
| PRD-301 | R1 (`@act/react` binding), R3 (static field declaration), R5 (page-level boundary, const form), R10 (depth-first render-order aggregation), R14 (block validation pre-emit), R20 (binding capabilities), R23 (`NodeDraft` shape) | Every `marketing:*` block is extracted via SSR-walk from the design system. |
| PRD-405 | R1, R3 (`output: "export"`), R5 (post-build invocation), R8 (App Router page-level contract), R10 (auto-wired `next-intl` Pattern 2), R11 (file-set emission), R13 (manifest construction), R14 (achieved level computation), R22 (mounts; declared empty) | The build is driven by `withAct(nextConfig, options)`. |
| PRD-600 | R-validator-core (validator returns zero errors); reporter `achieved.level === "plus"` | Acceptance criterion (c). |

### Conformance level

This example targets **Plus** (per PRD-107-R10). Justification:

- Multi-locale (4 locales) requires the `locales` manifest block (PRD-104-R1, Plus-tier per PRD-104's level table).
- Marketing pages render `marketing:*` blocks (PRD-102-R6 through PRD-102-R11, Plus per PRD-102's level table).
- The build emits an NDJSON index per locale (PRD-107-R10's NDJSON-index requirement).
- Search advertisement is set (`search_url_template`) and a build-time-prerendered search payload responds.

A consumer requiring "minimum Standard" is satisfied by additivity (PRD-107-R11). A consumer requiring Plus is satisfied directly.

Per-requirement conformance bands are annotated inline below.

### Normative requirements

#### File-set emission

**PRD-702-R1.** **(Plus)** A conformant build of this example MUST emit, under the resolved `out/` directory of `next build` (per PRD-405-R11), the following file set:

- `out/.well-known/act.json` — root manifest (parent of the four per-locale manifests).
- For each locale L in `{en-US, es-ES, de-DE, ja-JP}`:
  - `out/{L}/.well-known/act.json` — per-locale manifest (Pattern 2, per PRD-104-R6).
  - `out/{L}/act/index.json` — per-locale index.
  - `out/{L}/act/index.ndjson` — per-locale NDJSON index (Plus, per PRD-107-R10).
  - `out/{L}/act/n/{id}.json` — one file per node (~24 routes; counts may vary).
  - `out/{L}/act/sub/{id}.json` — subtree files for top-level navigation roots (Standard, additive at Plus).
  - `out/{L}/act/search.json` — build-time-prerendered search payload reachable via `search_url_template`.
- `./.act-build-report.json` at the project root (NOT inside `out/`), per PRD-405-R15.

Adding or removing locales changes the per-locale fan-out but MUST NOT change the root-manifest shape beyond the `locales.available` array.

**PRD-702-R2.** **(Plus)** The example MUST configure `withAct` with `i18n: { pattern: '2' }` explicitly, even though PRD-405-R10's `i18n: 'auto'` default would also resolve to Pattern 2. Explicit configuration is the documented teaching shape; implicit is the production default.

#### Manifest construction

**PRD-702-R3.** **(Plus)** The root manifest at `out/.well-known/act.json` MUST declare:

- `act_version: "0.1"`.
- `site.name`: a non-empty string (the example uses `"Acme"`).
- `delivery: "static"` (PRD-107-R3).
- `conformance.level: "plus"` (PRD-107-R10).
- `locales.default: "en-US"`.
- `locales.available: ["en-US", "es-ES", "de-DE", "ja-JP"]`.
- `locales.manifest_url_template: "/{locale}/.well-known/act.json"` (PRD-104-R4).
- `capabilities.etag: true`, `capabilities.subtree: true`, `capabilities.ndjson_index: true`, `capabilities.search.template_advertised: true`.

The root manifest MAY omit `index_url`, `node_url_template`, and `subtree_url_template` because Pattern 2 delegates per-locale URLs to per-locale manifests; consumers MUST follow `manifest_url_template` to reach each locale's manifest. (PRD-104-R6 governs this rule.)

**PRD-702-R4.** **(Plus)** Each per-locale manifest at `out/{L}/.well-known/act.json` MUST declare `act_version`, `site.name`, `delivery: "static"`, `conformance.level: "plus"`, `index_url`, `index_ndjson_url`, `node_url_template`, `subtree_url_template`, `search_url_template`, and the same `capabilities.*` flags as the root manifest. The per-locale manifest MUST NOT include `locales.manifest_url_template` (Pattern 2 forbids recursion per PRD-104-R6). Each per-locale manifest MUST declare its own `locales` block with `default` and `available` matching the root manifest, per PRD-104-R6.

#### Component instrumentation

**PRD-702-R5.** **(Plus)** The example's design-system components MUST be instrumented per PRD-301-R3 (static field declaration) using the canonical `marketing:*` block shapes from PRD-102-R6 through PRD-102-R11. The minimum instrumentation set is:

- `Hero` → `marketing:hero` (PRD-102-R7).
- `FeatureGrid` → `marketing:feature-grid` (PRD-102-R8).
- `PricingTable` → `marketing:pricing-table` (PRD-102-R9).
- `Testimonial` → `marketing:testimonial` (PRD-102-R10).
- `FAQAccordion` → `marketing:faq` (PRD-102-R11).
- `CTA` → `marketing:cta` (`marketing:*` namespace per PRD-102-R6 generic).

Each component's `extract` MUST return a single block of the declared type. The block MUST satisfy the canonical schema; PRD-301-R14's pre-emit validation rejects misshaped blocks and substitutes a `marketing:placeholder` per PRD-301-R16. The example MUST NOT ship any component whose `extract` produces placeholders under conformant inputs.

**PRD-702-R6.** **(Plus)** Every page-level route MUST declare a page-level boundary contract via `export const act` from its `app/[locale]/<route>/page.tsx`, per PRD-301-R5 (const form) AND PRD-405-R8 (App Router page-level contract). The `act` export MUST carry `type` (typically `"landing"`), `id` (matching PRD-100-R10 grammar), and OPTIONAL `related: string[]`.

#### Multi-source merging

**PRD-702-R7.** **(Plus)** The example MUST configure two adapters in `withAct({ adapters: [...] })`, in order:

1. `act-contentful` — primary, declaring `precedence: "primary"` per PRD-200-R15 / PRD-202-R22.
2. `act-i18n` (`next-intl` library) — fallback, declaring `precedence: "fallback"` per PRD-200-R15 / PRD-207-R6.

The merge step (PRD-200-R12) MUST produce nodes whose scalar fields (`title`, `summary`, `content[]`) are sourced from the Contentful adapter and whose `metadata.translations`, `metadata.translation_status`, `metadata.fallback_from`, `metadata.source.contributors` are sourced from both. PRD-207 MUST NOT contribute scalar fields per PRD-207-R6.

**PRD-702-R8.** **(Plus)** When a Contentful entry is untranslated for a non-default locale L, the emitted node at `/{L}/act/n/{id}.json` MUST carry:

- `metadata.translation_status: "fallback"` (PRD-104-R10 closed-enum value per PRD-104-R11).
- `metadata.fallback_from: "en-US"` (PRD-104-R10).
- Scalar fields (`title`, `summary`, `content[]`) substituted from the `en-US` entry.

The example's test fixtures MUST cover at least one such untranslated case (e.g., a newly-published `de-DE` legal page that has not yet been translated to `ja-JP`).

#### Cross-locale references

**PRD-702-R9.** **(Plus)** Every emitted node MUST carry `metadata.translations` per PRD-104-R9 in dense form: an array of `{ locale, id }` objects listing every other locale in `locales.available` for which a translation exists. When a translation does not exist for a sibling locale, the entry MUST be omitted from `metadata.translations` (per PRD-104 / PRD-207-R5 dense-form rule). The example MUST NOT emit `null` entries inside `metadata.translations`.

**PRD-702-R10.** **(Plus)** Page IDs MUST be stable across locales. The same route (e.g., `/[locale]/pricing`) MUST emit nodes whose `id` is `"pricing"` in every locale. (See Open question 1; this is the example's chosen pattern.) Operators wishing to re-slug per locale MAY do so but MUST update `metadata.translations` accordingly; PRD-104-R9's dense form supports either choice.

#### Search advertisement

**PRD-702-R11.** **(Plus)** Each per-locale manifest MUST declare `search_url_template: "/{L}/act/search?q={query}"`. A build-time-prerendered `search.json` MUST be reachable at the substituted URL and MUST conform to PRD-100's search-response envelope. The example MAY ship a static prefix-trie payload; the example MUST NOT advertise `search_url_template` without a responding endpoint (PRD-107-R14's capability-vs-level consistency rule).

#### Subtree emission

**PRD-702-R12.** **(Plus)** The example MUST emit subtree files for the navigation roots (typically `home`, `products`, `solutions`, `company`). Subtree files MUST satisfy PRD-100's subtree envelope and MUST be reachable at the URL produced by substituting the navigation root's `id` into `subtree_url_template`. Non-navigation-root pages MAY also have subtree files; the example pins the navigation roots only.

#### Build pipeline

**PRD-702-R13.** **(Core)** The example's `next.config.js` MUST set `output: "export"` per PRD-405-R3. The example MUST NOT use `output: "server"` or `output: "standalone"`; if an operator forks the example for a runtime stack, they MUST migrate to PRD-501.

**PRD-702-R14.** **(Core)** The build MUST be invoked via `next build` only. Operators MUST NOT run `act-hugo`, `act-cli`, or any other generator against the example; PRD-405's `withAct` is the integration shape, and it invokes PRD-400's `runPipeline` post-build per PRD-405-R5.

**PRD-702-R15.** **(Core)** The example MUST honor PRD-405-R17's Stage 1 adapter pinning: every adapter package the example imports (`@act/contentful`, `@act/i18n`, `@act/nextjs`) MUST declare `act_version: "0.1"`. The build MUST fail if any adapter declares a different version.

#### Build report

**PRD-702-R16.** **(Standard)** The build MUST emit a build report at `./.act-build-report.json` per PRD-405-R15 (default path; not inside `out/`). The build report MUST enumerate every emitted ACT file, the achieved conformance level (`"plus"`), every warning, every error, and the build duration. Per PRD-702-R20, a clean build MUST report zero errors and SHOULD report zero warnings (warnings are tolerated; errors are not).

#### Source attribution

**PRD-702-R17.** **(Plus)** Every emitted node MUST carry `metadata.source` per PRD-200-R13 with `metadata.source.contributors` populated to reflect the merge. For nodes contributed by both Contentful and `next-intl`, `contributors` MUST be `["act-contentful", "act-i18n"]` (in primary-then-fallback order). For nodes contributed by Contentful only (e.g., a legal page with no UI-string fallback), `contributors` MUST be `["act-contentful"]`. PRD-207-R17 governs the per-partial source stamping.

#### ID grammar

**PRD-702-R18.** **(Core)** Every emitted ID MUST satisfy PRD-100-R10's grammar. The example uses lowercase ASCII with hyphens (`pricing`, `feature-comparison`, `enterprise-pricing`). IDs MUST NOT carry locale segments under Pattern 2 (per PRD-104-R6); locale segmentation is achieved via per-locale manifests.

#### Component-extracted metadata

**PRD-702-R19.** **(Plus)** Every emitted block originating from a React component contract MUST carry `metadata.extracted_via: "component-contract"` per PRD-102-R20 / PRD-301-R14. Blocks originating from Contentful Rich Text MUST carry `metadata.extracted_via: "rich-text"` (or the equivalent value PRD-202-R10 stamps). Mixing on the same node is permitted; the example exercises both surfaces.

#### Acceptance criteria for a clean build

**PRD-702-R20.** **(Plus)** A conformant build of this example MUST satisfy all of the following:

- (a) **Builds clean.** `next build` exits with code 0.
- (b) **Validator clean.** `npx @act/validator out/` returns zero errors (PRD-600 reporter `gaps` array is empty per PRD-107-R19).
- (c) **Achieved-level match.** PRD-600 reporter's `achieved.level` equals `"plus"` for the root manifest AND each per-locale manifest (PRD-107-R18).
- (d) **Cited-PRD coverage.** Every PRD listed in the cited-PRD coverage table at the top of this Specification has at least one of its requirements exercised by the build's emitted files. PRD-600's coverage report (per its conformance-test-harness CLI mode) MUST confirm.

#### Mounts

**PRD-702-R21.** **(Standard)** The example MUST NOT declare `mounts` in any manifest. Pattern 2's per-locale manifests are NOT mounts in the PRD-100-R7 sense; they are reached via `locales.manifest_url_template`, not via `mounts`. The example pins this distinction so operators forking it for hybrid static + runtime sites do not conflate the two mechanisms.

### Wire format / interface definition

_Not applicable — examples consume but do not define wire formats. The cited PRDs (PRD-100, PRD-102, PRD-104, PRD-202, PRD-207, PRD-301, PRD-405) own their respective wire shapes. PRD-702 only specifies the example's emission expectations._

### Errors

| Condition | Severity | Notes |
|---|---|---|
| `next.config.js` lacks `output: "export"` | Build error | PRD-405-R3 |
| Adapter `act_version` mismatch | Build error | PRD-405-R17 |
| Component `extract` returns malformed `marketing:*` block | Placeholder + build warning | PRD-301-R14 / PRD-301-R16 |
| Contentful API auth failure | Build error | PRD-202-R3 |
| Untranslated locale entry | Fallback emission + build info-log | PRD-104-R10 / PRD-202-R14 |
| `marketing:*` block emitted without canonical fields | Placeholder + build warning | PRD-102-R6 / PRD-301-R14 |
| Validator finds `gaps` entry against PRD-107-R10 | Acceptance failure | PRD-702-R20 (b/c) |

---

## Examples

### Example 1 — `next.config.js` (excerpt)

```js
const { withAct } = require('@act/nextjs');
const { contentful } = require('@act/contentful');
const { intl } = require('@act/i18n');

module.exports = withAct(
  { output: 'export' },
  {
    conformanceTarget: 'plus',
    adapters: [
      contentful({
        space: process.env.CONTENTFUL_SPACE,
        accessToken: { from_env: 'CONTENTFUL_DELIVERY_TOKEN' },
        environment: 'master',
        contentTypes: ['landingPage', 'faqEntry', 'testimonial'],
        locale: {
          available: ['en-US', 'es-ES', 'de-DE', 'ja-JP'],
          default: 'en-US',
          pattern: 2,
        },
      }),
      intl({
        library: 'next-intl',
        messagesDir: 'messages',
        locales: {
          default: 'en-US',
          available: ['en-US', 'es-ES', 'de-DE', 'ja-JP'],
        },
        bindToAdapter: 'act-contentful',
      }),
    ],
    i18n: { pattern: '2' },
  },
);
```

### Example 2 — design-system component instrumentation

```tsx
// design-system/Hero.tsx
import type { ActContract } from '@act/react';

interface HeroProps { headline: string; subhead?: string; cta?: { text: string; to: string } }

export function Hero(props: HeroProps) { /* JSX */ }

Hero.act = {
  type: 'marketing:hero',
  contract_version: '0.1',
  extract: (props) => ({
    type: 'marketing:hero',
    headline: props.headline,
    subhead: props.subhead,
    cta: props.cta,
  }),
} satisfies ActContract<HeroProps>;
```

### Example 3 — page-level boundary

```tsx
// app/[locale]/pricing/page.tsx
import { PageContract } from '@act/react';

export const act: PageContract = {
  type: 'landing',
  id: 'pricing',
  related: ['products', 'contact'],
};

export default function PricingPage({ params }: { params: { locale: string } }) {
  return (
    <>
      <Hero headline="Simple, transparent pricing" subhead="No hidden fees." cta={{ text: 'Start free trial', to: '/signup' }} />
      <PricingTable tiers={[ /* ... */ ]} highlighted="Pro" />
      <FAQAccordion items={[ /* ... */ ]} />
      <CTA headline="Ready to get started?" actions={[ /* ... */ ]} />
    </>
  );
}
```

### Example 4 — emitted English Pricing node (excerpt)

```json
{
  "act_version": "0.1",
  "id": "pricing",
  "type": "landing",
  "title": "Pricing",
  "summary": "Acme pricing tiers, plan comparison, and FAQ.",
  "etag": "sha256:8f4a…",
  "tokens": { "summary": 11, "body": 285 },
  "content": [
    { "type": "marketing:hero", "headline": "Simple, transparent pricing", "subhead": "No hidden fees. Cancel anytime.", "cta": { "text": "Start free trial", "to": "/signup" }, "metadata": { "extracted_via": "component-contract" } },
    { "type": "marketing:pricing-table", "tiers": [ { "name": "Starter", "price": "$9/mo", "features": ["1 user", "10GB"] }, { "name": "Pro", "price": "$29/mo", "features": ["10 users", "1TB"] }, { "name": "Enterprise", "price": "Contact us", "features": ["Unlimited"] } ], "highlighted": "Pro", "metadata": { "extracted_via": "component-contract" } }
  ],
  "related": ["products", "contact"],
  "metadata": {
    "locale": "en-US",
    "translations": [
      { "locale": "es-ES", "id": "pricing" },
      { "locale": "de-DE", "id": "pricing" },
      { "locale": "ja-JP", "id": "pricing" }
    ],
    "translation_status": "complete",
    "source": { "contributors": ["act-contentful", "act-i18n"] }
  }
}
```

### Example 5 — German untranslated-fallback node (excerpt)

```json
{
  "act_version": "0.1",
  "id": "data-processing-addendum",
  "type": "page",
  "title": "Data Processing Addendum",
  "summary": "Acme's data-processing terms for enterprise customers.",
  "metadata": {
    "locale": "de-DE",
    "translation_status": "fallback",
    "fallback_from": "en-US",
    "translations": [ { "locale": "en-US", "id": "data-processing-addendum" } ],
    "source": { "contributors": ["act-contentful"] }
  }
}
```

---

## Test fixtures

Fixtures live under `fixtures/702/`. PRD-702 enumerates filenames; the validator (PRD-600) and the example's CI exercise them.

### Positive

- `fixtures/702/positive/build-output/` — complete `out/` tree from a clean build; ~500 ACT files across four locales.
- `fixtures/702/positive/manifest-root.json` → satisfies PRD-702-R3.
- `fixtures/702/positive/manifest-en-US.json` → satisfies PRD-702-R4.
- `fixtures/702/positive/node-pricing-en-US.json` → satisfies PRD-702-R9, R17, R19.
- `fixtures/702/positive/node-dpa-de-DE-fallback.json` → satisfies PRD-702-R8.
- `fixtures/702/positive/build-report.json` → satisfies PRD-702-R16, R20.

### Negative

- `fixtures/702/negative/missing-locale-manifest/` → root manifest declares `de-DE` but `out/de-DE/.well-known/act.json` is absent. Validator MUST report a `gaps` entry citing PRD-104-R6.
- `fixtures/702/negative/scalar-collision/` → `next-intl` adapter contributes a `title` scalar. Build MUST surface a merge warning per PRD-200-R12 / PRD-207-R6 violation.
- `fixtures/702/negative/marketing-block-misshaped/` → component `extract` returns a `marketing:hero` missing the `headline` field. Build MUST emit placeholder per PRD-301-R16.
- `fixtures/702/negative/output-server/` → `next.config.js` sets `output: "server"`. Build error per PRD-405-R3 / PRD-702-R13.
- `fixtures/702/negative/level-misdeclared/` → `conformance.level: "plus"` but `index.ndjson` absent. Validator `achieved.level` MUST be `"standard"` (or lower); reporter emits a `gaps` entry citing PRD-107-R10.

---

## Versioning & compatibility

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a locale to `locales.available` | MINOR | Operator-side change; example's PRD shape unchanged. |
| Drop a locale from `locales.available` | MAJOR (for the operator) / MINOR (for PRD-702 itself) | Example narrative unchanged. |
| Add a new `marketing:*` block to the design-system instrumentation | MINOR | Per PRD-102-R6 (documented-open namespace). |
| Switch from Pattern 2 to Pattern 1 | MAJOR | Wire shape diverges; consumers' fetch logic breaks. |
| Switch from `output: "export"` to runtime | MAJOR | Migrate to PRD-705 / PRD-501. |
| Change the conformance target from Plus to Standard | MAJOR (operator) / MINOR (PRD) | Plus capabilities (NDJSON, search) drop out. |
| Add a new adapter to the `adapters` array | MINOR | New `metadata.source.contributors` entries. |
| Tighten a SHOULD to a MUST in this PRD | MAJOR | Per PRD-108. |
| Loosen a MUST to a SHOULD in this PRD | MAJOR | Per PRD-108. |

### Forward compatibility

The example's emissions consume the v0.1 wire format. A future v0.2 producer may add optional fields per PRD-108-R7; the example's consumers (PRD-600) MUST tolerate unknown optional fields. The example MUST NOT consume v0.2 features in v0.1 nor advertise capabilities beyond what its emissions actually deliver (PRD-107-R14).

### Backward compatibility

A re-build of the example with unchanged source (Contentful entries, message catalogs, components) MUST emit byte-equivalent output modulo `generated_at` timestamps and ETags. The build report records the `act_version` and the achieved level for regression-testing.

---

## Security considerations

PRD-109 (Accepted) governs the project-wide threat model. PRD-702 deltas:

- **Build environment trust.** The Contentful Delivery API token is a build-time secret. The example MUST source it via `from_env` (per PRD-202-R26) and MUST NOT commit it to source. The example's `.env.example` is committed; the populated `.env` is gitignored.
- **CDN deployment scope.** Per PRD-405-R15, the build report at `./.act-build-report.json` lives at the project root and MUST NOT ship to the CDN. Operators reviewing forks MUST ensure their CI publishes only `out/`.
- **Multi-locale information disclosure.** Per PRD-104's threat model, locale-prefixed URLs do not leak per-tenant identity. The example's per-locale manifests carry the same content fingerprint shape; no per-user dynamic locale switching applies.
- **Component extraction trust.** Per PRD-301's SSR-walk, the binding renders user code in Node during the build. The example's design-system components are first-party; operators forking the example assume responsibility for any third-party component imports.
- **Search payload contents.** The build-time-prerendered search payload contains every node's `summary` and `title` fields. Operators MUST verify that no PII or auth-scoped content reaches the static profile per PRD-109.
- **404-vs-403.** Static profile only; no auth boundary applies.

---

## Implementation notes

The snippets above (Examples 1–3) cover the canonical authoring shape. Additional notes:

### Snippet — Contentful content model (excerpt)

```json
{
  "name": "Landing Page",
  "id": "landingPage",
  "fields": [
    { "id": "title", "type": "Symbol", "required": true, "localized": true },
    { "id": "summary", "type": "Text", "localized": true },
    { "id": "hero", "type": "RichText", "localized": true },
    { "id": "pricingTable", "type": "Object", "localized": true },
    { "id": "faq", "type": "Array", "items": { "type": "Link", "linkType": "Entry", "validations": [{ "linkContentType": ["faqEntry"] }] }, "localized": false },
    { "id": "relatedRoutes", "type": "Array", "items": { "type": "Symbol" }, "localized": false }
  ]
}
```

The Contentful adapter (PRD-202-R7 default heuristics) maps `title` → node title, `summary` → node summary, `hero` → `marketing:hero` block (via PRD-202-R10 Rich Text → block conversion), `pricingTable` → `marketing:pricing-table` (via the `mappings` config from PRD-202-R8), `faq` → `marketing:faq` (linked-entry resolution per PRD-202-R6), `relatedRoutes` → node `related[]`.

### Snippet — `next-intl` message catalog (excerpt)

```json
{
  "common": {
    "buttons": {
      "startTrial": "Start free trial",
      "contactSales": "Contact sales"
    },
    "footer": { "rights": "All rights reserved." }
  }
}
```

PRD-207 ingests `messages/{locale}.json` per PRD-207-R3 (`next-intl` library shape) and emits partial nodes contributing only `metadata.*` fields per PRD-207-R6.

### Snippet — running the validator

```bash
$ npx @act/validator out/
# Exits 0 on a clean build; emits a JSON reporter document per PRD-107-R16.
$ npx @act/validator --reporter json out/.well-known/act.json | jq '.achieved.level'
"plus"
```

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-02 | Jeremy Forsythe | Initial draft. End-to-end Plus-band reference for Next.js + Contentful + `next-intl`, four locales (en-US, es-ES, de-DE, ja-JP), exercising PRD-405 + PRD-202 + PRD-207 + PRD-301 + PRD-100/102/104 across ~500 emitted files. Three open questions flagged: per-locale ID re-slugging deviation from draft §8.4, `metadata.translations` array-merge behavior in PRD-200 (potential v0.2 amendment), and prerendered-static-search conformance under Plus. Status: Draft → In review. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). PRD-200-R12 `metadata.translations` dedupe ambiguity (Open Q2) filed as docs/amendments-queue.md A1; queued for Phase 6 forge:reviewer triage. |
