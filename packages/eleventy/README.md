# @act-spec/eleventy

PRD-408 Eleventy plugin for ACT v0.1. Wraps the PRD-400 generator
pipeline (`@act-spec/generator-core`) against Eleventy 2.0+ via the
`addPlugin` API and the `eleventy.after` build hook. Component bindings
are explicitly out of scope for Eleventy (PRD-408-R10) — for
component-driven workflows use `@act-spec/astro`, the Next.js generator,
or `@act-spec/nuxt`. The PRD-201 markdown adapter is consumed unchanged
from `@act-spec/markdown-adapter`.

The amendment A10 `parseMode` opt-in lets operators select
`'eleventy-templates'` to walk Eleventy's template registry as the source
of truth, in addition to the default `'markdown-fs'` mode that delegates
to the PRD-201 markdown adapter.

## Status

ACT v0.1 internal hand-test candidate. Public release lands at v0.2.

## Install

Unpublished in v0.1. Consume via the workspace:

```jsonc
// package.json
{ "dependencies": { "@act-spec/eleventy": "workspace:*" } }
```

## Usage

```js
// .eleventy.js / eleventy.config.mjs
import actPlugin from '@act-spec/eleventy';

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(actPlugin, {
    baseUrl: 'https://example.com',
    manifest: { site: { name: 'Example' } },
    urlTemplates: {
      indexUrl: '/act/index.json',
      nodeUrlTemplate: '/act/n/{id}.json',
    },
    parseMode: 'markdown-fs',     // or 'eleventy-templates' (A10)
    conformanceTarget: 'core',
  });
  return { dir: { input: '.', output: '_site' } };
}
```

The plugin runs after the Eleventy build completes (`eleventy.after`),
emits the ACT file set into the configured output directory, and writes
a `BuildReport` adjacent to the index for downstream gating.

Programmatic API (test harnesses, custom orchestration):

```ts
import { runActBuild, resolveConfig } from '@act-spec/eleventy';

const resolved = resolveConfig(opts, eleventyConfigLike);
const report = await runActBuild(resolved, payload);
```

## Conformance / what's tested

Every PRD-408-R{n} requirement has a citing test in the package's
test suite, including the Eleventy version gate
(`enforceEleventyVersion`), the watch re-entry guard, the
permalink-filtered warnings path, the `parseMode` selector (A10), and
the `bindings` rejection (R10). The conformance gate runs
`@act-spec/validator` against the emitted file set.

```bash
pnpm -F @act-spec/eleventy conformance
```

## Configuration (selected)

| Option | Default | Notes |
| --- | --- | --- |
| `baseUrl` | (required) | Site base URL used in the manifest. |
| `urlTemplates` | (required) | `indexUrl` + `nodeUrlTemplate`. |
| `manifest` | (required) | Manifest seed (site name, etc.). |
| `parseMode` | `'markdown-fs'` | A10: `'eleventy-templates'` walks Eleventy's registry. |
| `conformanceTarget` | `'core'` | `'core' \| 'standard' \| 'plus'`. |
| `outputDir` | Eleventy's `output` dir | Override per `resolveOutputDir`. |
| `bindings` | (rejected) | PRD-408-R10 — Eleventy is template-driven. |

## Peer dependencies

| Peer | Range |
| --- | --- |
| `@11ty/eleventy` | `>=2.0.0 <4.0.0` |

Optional from npm's perspective; the plugin is a no-op without Eleventy.

## Links

- Leaf PRD: [`prd/408-eleventy-plugin.md`](../../prd/408-eleventy-plugin.md)
- Framework PRD: [`prd/400-generator-architecture.md`](../../prd/400-generator-architecture.md)
- Framework package: [`@act-spec/generator-core`](../generator-core)
- Markdown adapter: [`@act-spec/markdown-adapter`](../markdown-adapter)
- Repository: <https://github.com/act-spec/act>
