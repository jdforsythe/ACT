# @act-spec/i18n-adapter

PRD-207 i18n adapter for ACT v0.1. Reads message catalogs for the
configured i18n library (`next-intl`, `react-intl`, `i18next`) from the
filesystem and emits PRD-200 partial nodes carrying the PRD-104 i18n
metadata block (`metadata.locale`, `metadata.translations`,
`metadata.translation_status`, `metadata.fallback_from`) keyed against IDs
that a primary content adapter (PRD-201 markdown / PRD-202 Contentful /
PRD-208 programmatic) emits.

The adapter declares `precedence: "fallback"` per PRD-200-R15 so the
primary adapter's scalar fields survive the merge step. Filesystem
fixtures only — no live i18n service calls.

## Status

ACT v0.1 internal hand-test candidate. Public release lands at v0.2.

## Install

Unpublished in v0.1. Consume via the workspace:

```jsonc
// package.json
{ "dependencies": { "@act-spec/i18n-adapter": "workspace:*" } }
```

## Usage

```ts
import { createI18nAdapter } from '@act-spec/i18n-adapter';

const adapter = createI18nAdapter({
  config: {
    library: 'next-intl',
    messagesDir: './messages',
    locales: { available: ['en', 'fr', 'de'], default: 'en' },
    targetLevel: 'plus',                 // PRD-207-R16
  },
});
```

The adapter requires `targetLevel: "plus"` (per PRD-107-R10 / PRD-207-R16)
and at least two locales (PRD-207-R14). Catalog detection is exposed
standalone for tests and tooling:

```ts
import { detectLibraryLayout, loadLocaleCatalog } from '@act-spec/i18n-adapter';

const layout = await detectLibraryLayout('./messages', 'next-intl');
const catalog = await loadLocaleCatalog(layout, 'fr');
```

## Conformance / what's tested

Every PRD-207-R{n} requirement has a citing test in `src/i18n.test.ts`,
covering library-layout detection (`next-intl`/`react-intl`/`i18next`),
BCP-47 normalization, fallback derivation, and the merge precedence
contract against the Contentful adapter. The conformance gate runs
`@act-spec/validator` against the bundled fixtures.

```bash
pnpm -F @act-spec/i18n-adapter conformance
```

## Configuration (selected)

| Option | Default | Notes |
| --- | --- | --- |
| `library` | (required) | One of `'next-intl' \| 'react-intl' \| 'i18next'`. |
| `messagesDir` | (required) | Path to the i18n catalog directory. |
| `locales.available` | (required) | Minimum two locales (PRD-207-R14). |
| `locales.default` | (required) | Default locale; used for `fallback_from`. |
| `targetLevel` | (required) | Must be `'plus'` (PRD-207-R16). |
| `concurrency` | `4` | Adapter framework parallelism. |

## Compatibility

Composes with any primary adapter that emits stable IDs. Tested against
`@act-spec/contentful-adapter` (used as a dev-dependency in tests).

## Links

- Leaf PRD: [`prd/207-i18n-adapter.md`](../../prd/207-i18n-adapter.md)
- Framework PRD: [`prd/200-adapter-framework.md`](../../prd/200-adapter-framework.md)
- i18n metadata spec: [`prd/104-i18n.md`](../../prd/104-i18n.md)
- Framework package: [`@act-spec/adapter-framework`](../adapter-framework)
- Repository: <https://github.com/act-spec/act>
