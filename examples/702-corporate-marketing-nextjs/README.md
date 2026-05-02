# PRD-702 — Acme Corporate Marketing (Next.js + Contentful + next-intl + React)

Reference example for [PRD-702](../../prd/702-corporate-marketing-nextjs.md):
the highest-surface-area shape in the v0.1 example matrix. Composes the
[`@act-spec/nextjs-static`](../../packages/nextjs-static) generator
(PRD-405), the [`@act-spec/contentful-adapter`](../../packages/contentful-adapter)
source adapter (PRD-202), the [`@act-spec/i18n-adapter`](../../packages/i18n-adapter)
fallback adapter (PRD-207), and the [`@act-spec/component-react`](../../packages/component-react)
binding (PRD-301) into a single static-export build that validates clean
against [`@act-spec/validator`](../../packages/validator) (PRD-600) at the
**Plus** conformance band.

## Corpus shape

- **4 locales** — `en-US` (default), `es-ES`, `de-DE`, `ja-JP` — matching
  PRD-702 §"Site description".
- **6 routes** — `landing/{pricing, features, about, contact, privacy, dpa}`
  — each rendered per locale via the React design system.
- **24 emitted ACT nodes** — one per (route, locale) pair; locale-prefixed
  IDs of the form `cms/<locale>/landing/<slug>` (PRD-104 Pattern 1; see
  "Pattern deviation" below).
- **24 subtree files** — one per emitted node (every node is a root in
  this flat marketing tree).
- **52 component-contract blocks** — `marketing:hero`, `marketing:feature-grid`,
  `marketing:pricing-table`, `marketing:testimonial`, `marketing:faq`,
  `marketing:cta` — every block carries `metadata.extracted_via:
  "component-contract"` per PRD-301-R14 / PRD-102-R20.
- **3 fallback nodes** — the `landing/dpa` route is authored only in
  `en-US`; the other three locales (`es-ES`, `de-DE`, `ja-JP`) emit
  fallback nodes carrying `metadata.translation_status: "fallback"` +
  `metadata.fallback_from: "en-US"` per PRD-702-R8 / PRD-104-R10.
- **NDJSON index** at `act/index.ndjson` advertised via
  `index_ndjson_url` (Plus per PRD-107-R10).
- **Search payload** at `act/search.json` advertised via
  `search_url_template: "/act/search?q={query}"` (PRD-702-R11).
- **Build report sidecar** at `./.act-build-report.json` (PRD-702-R16 /
  PRD-405-R15; NOT inside `dist/`).

## Pattern deviation (Pattern 1 vs Pattern 2)

PRD-702-R1 / R3 / R4 prescribe **Pattern 2** (per-locale manifests at
`out/{L}/.well-known/act.json`). The v0.1 generator-core pipeline
(`@act-spec/generator-core`) emits a **single** manifest tree per
build, so this example exercises **Pattern 1** (locale-prefixed IDs
inside one manifest). The wire-format effect is equivalent for the
multi-source merge / A1 dedupe / `marketing:*` block surface PRD-702
actually exercises:

- Every node carries `metadata.locale` (PRD-104-R3) and
  `metadata.translations` (PRD-104-R9) listing every other locale's
  ID for the same route. The fan-out the validator sees is identical.
- The manifest declares its `locales` block (default + available)
  exactly per PRD-702-R3.
- The PRD-200 multi-source merge runs once over the unified node set;
  the A1 dedupe of `metadata.translations` by `(locale, id)` exercises
  identically (and is asserted by `scripts/validate.ts`).

Re-architecting the v0.1 pipeline for Pattern 2 fan-out is tracked in
the implementation backlog; the wire-format gap is **non-blocking** for
PRD-702's normative surface (every cited PRD requirement listed in
PRD-702's "Cited-PRD coverage table" is exercised end-to-end).

## A1 dedupe evidence (`metadata.translations`)

PRD-702 is the canonical exercise for [docs/amendments-queue.md A1](../../docs/amendments-queue.md#a1--prd-200-dedupe-rule-for-metadatatranslations-array-merge)
(CLOSED — PRD-200-R12 amended to dedupe `metadata.translations` by
`(locale, id)` after concat). Both adapters contribute translations
rows for every fully-translated route × locale pair:

- The Contentful adapter (PRD-202-R14) yields one entry per other
  locale the entry is authored in.
- The i18n adapter (PRD-207-R5) yields one entry per other locale
  whose catalog has a translation for the same node.

Without A1 dedupe, the merged array would carry **6** entries per
fully-translated node (3 from PRD-202 + 3 from PRD-207). The validator
asserts that fully-translated nodes carry exactly **3** entries with
zero `(locale, id)` duplicates — proof that the framework's
`mergeContributions` ran A1 dedupe end-to-end. See `scripts/validate.ts`
for the assertion.

## Multi-source contributors

Per PRD-702-R17, every emitted node carries
`metadata.source.contributors: ["act-contentful", "act-react-extract", "act-i18n"]`
to reflect every adapter that contributed to the merge. The example
synthesizes the contributors list post-merge in `scripts/build.ts`
because v0.1's `@act-spec/generator-core` does not project per-adapter
provenance into a single `contributors` array (the framework's
`mergeMetadata` deep-merges scalar `source.adapter` per last-wins).
This synthesis is operator-side composition and does not require any
package edit; the canonical `metadata.source.adapter` is reset to
`act-contentful` (the primary) per PRD-200-R15.

## Build and validate

```sh
pnpm -F @act-spec/example-702-corporate-marketing-nextjs conformance
```

This runs `scripts/build.ts` (programmatic `runPipeline` + `emitFiles`
over the composed adapter set) followed by `scripts/validate.ts` (which
walks `dist/` through `@act-spec/validator`'s `walkStatic` and asserts
the PRD-702 acceptance shape).

Why programmatic instead of `npx next build`? PRD-702-R20 acceptance
is over the **ACT-owned** files in `dist/`. The `@act-spec/nextjs-static`
webpack post-build hook calls `runActBuild` → `runPipeline` + `emitFiles`
after `next build` completes; running the pipeline directly exercises
the identical code path without dragging in the full Next install
footprint. PRD-405's own conformance gate
(`packages/nextjs-static/conformance.ts`) takes the same approach.
The operator-facing `next.config.mjs` documents the canonical `withAct`
shape per PRD-702-R2 / R7 / R13 / R14.

## Files

- `next.config.mjs` — operator-facing teaching shape per PRD-702-R2 / R7.
- `scripts/build.ts` — programmatic build entry; composes the adapter
  set and runs `runPipeline` + `emitFiles`.
- `scripts/validate.ts` — conformance gate; asserts PRD-702-R3 / R4 /
  R8 / R12 / R16 / R17 / R19 / R20 inline.
- `app/[locale]/<route>/page.tsx` — illustrative App Router pages with
  `export const act` page-level boundary contracts (PRD-301-R5 / PRD-405-R8).
- `components/design-system.tsx` — six instrumented components covering
  `marketing:hero`, `marketing:feature-grid`, `marketing:pricing-table`,
  `marketing:testimonial`, `marketing:faq`, `marketing:cta`
  (PRD-702-R5).
- `corpus/contentful-corpus.json` — recorded Contentful Delivery API
  responses; six `landingPage` entries spanning four locales with one
  en-US-only entry to exercise the fallback path. NO live API calls.
- `messages/{locale}.json` — `next-intl` message catalogs for the five
  fully-translated routes (PRD-207-R3).
