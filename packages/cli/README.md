# @act-spec/cli

Standalone CLI for ACT (Agent Content Tree). Framework-free orchestration
of the ACT generator pipeline (`@act-spec/generator-core`): loads
`act.config.{ts,mts,mjs,cjs,js,json}`, instantiates adapters, runs the
pipeline, and writes the static file set. The binary is `act`.

## Status

ACT v0.1 internal hand-test candidate. Public release lands at v0.2.

## Install

Unpublished in v0.1. Consume via the workspace:

```jsonc
// package.json
{ "devDependencies": { "@act-spec/cli": "workspace:*" } }
```

For out-of-tree hand-test, run `pnpm pack` inside `packages/cli` and
install the resulting tarball locally; the `act` binary is exposed via
the package's `bin` field.

## Usage

`act.config.ts`:

```ts
import { defineConfig } from '@act-spec/cli';
import { markdown } from '@act-spec/adapter-markdown';

export default defineConfig({
  output: { dir: 'public/act' },
  manifest: { site: { name: 'Tinybox' } },
  conformanceTarget: 'standard',
  adapters: [markdown({ rootDir: './content' })],
});
```

CLI:

```bash
act build                # one-shot build
act build --watch        # rebuild on adapter source changes
act init tinybox ./site  # scaffold a starter project
```

Programmatic:

```ts
import { runBuild, watchBuild, loadConfig } from '@act-spec/cli';

const config = await loadConfig(process.cwd());
const report = await runBuild(config, { logger: 'json' });
```

## Conformance / what's tested

Every public API has a citing test in the package's test suite, including
config-file resolution order (`CONFIG_SEARCH_ORDER`), profile shorthand
application, output-dir conflict detection, host-framework field detection
(warns when `act.config` is used in a project that should use the
framework's plugin instead), the duration-flag parser, the watch re-entry
guard, and the build-timeout error path. The conformance gate runs
`@act-spec/validator` against the emitted file set.

```bash
pnpm -F @act-spec/cli conformance
```

## Configuration

`GeneratorConfig` is re-exported from `@act-spec/generator-core` so
developers import everything they need from `@act-spec/cli` alone. CLI
flags layer on top:

| Flag | Maps to | Notes |
| --- | --- | --- |
| `--config <path>` | explicit config path | overrides `CONFIG_SEARCH_ORDER`. |
| `--watch` | `watchBuild` | requires a TTY-friendly logger. |
| `--profile <name>` | `applyProfileOverride` | profile shorthand. |
| `--timeout <duration>` | `runBuild({ timeout })` | parsed by `parseDuration`. |
| `--logger <mode>` | `selectLoggerMode` | `'tty' \| 'plain' \| 'json'`. |

## Compatibility

No host-framework peer dependency. For framework-aware integrations,
prefer the dedicated generator (`@act-spec/plugin-astro`, `@act-spec/plugin-eleventy`,
`@act-spec/plugin-nuxt`, etc.).

## Links

- Generator core: [`@act-spec/generator-core`](../generator-core)
- Repository: <https://github.com/act-spec/act>
