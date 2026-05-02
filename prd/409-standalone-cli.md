# PRD-409 — Standalone CLI (no framework)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

The 400-series generator PRDs (PRD-401 Astro, PRD-402 Hugo, PRD-403 MkDocs, PRD-404 Docusaurus, PRD-405 Next.js, PRD-406 Remix, PRD-407 Nuxt, PRD-408 Eleventy) cover the named host frameworks. There is a substantial population of ACT-relevant projects that fit none of them: markdown-only sites built with custom scripts, programmatic-adapter consumers (PRD-208) backing e-commerce or SaaS catalogs, CMSes pushed through CI without a host framework, and hybrid deployments that want a single ACT build pass orchestrated by a standalone tool. Without a CLI for these cases, operators either (1) write their own pipeline orchestration, almost certainly omitting some PRD-400 invariant (atomic writes, conformance computation, capability advertising), or (2) shoehorn their content into one of the host frameworks just to inherit a generator plugin.

PRD-409 fills the gap with a standalone CLI: `npx @act/cli build` (or globally `act build`). The CLI reads `act.config.{js,ts,json}` listing adapters, sources, and an output directory; wraps PRD-400's `runPipeline` directly; and exits zero on success or non-zero on build error. The shape mirrors `eleventy`, `astro` (the CLI), and `vite` — small, explicit, framework-free.

The CLI also supports a `--watch` flag for incremental rebuild on file-system change events (markdown sources only — programmatic adapters cannot be filesystem-watched without their own change signal). An `act init` subcommand scaffolds a starter `act.config.ts` plus an example markdown directory or programmatic-adapter stub. Configured adapters determine the conformance band achievable; the CLI itself is band-agnostic and computes the achieved level per PRD-400-R17.

PRD-100 (Accepted) defines the wire format. PRD-105 (Accepted) defines the static delivery profile. PRD-200 (In review) defines the adapter framework. PRD-208 (In review) is the programmatic adapter that this CLI is the primary consumer for. PRD-300 (In review) is opt-in — a CLI build MAY include component extraction when a binding and a route loader are configured, but most CLI users have content-only builds. PRD-400 (In review) is the parent contract this PRD invokes. PRD-706 (hybrid example) gates on this PRD; that example uses the standalone CLI to build a static portion AND the runtime SDK (PRD-501) to mount a runtime portion at a sibling URL.

### Goals

1. Lock the **package shape**: `@act/cli` ships an executable `act` and a programmatic API (`runBuild(config)`). The default-exported function from a config file matches PRD-400-R31's `GeneratorConfig`.
2. Lock the **subcommand surface**: `act build`, `act build --watch`, `act init`, `act validate` (delegated to PRD-600), `act --help`, `act --version`.
3. Lock the **config-file resolution**: `act.config.ts`, `act.config.js`, `act.config.mjs`, `act.config.cjs`, `act.config.json` — searched in order at the CWD; `--config <path>` overrides. TypeScript configs are loaded via a configurable loader (`tsx`, `jiti`, `bun`); operator's choice.
4. Lock the **canonical pipeline invocation**: `act build` runs PRD-400's `runPipeline` once against the resolved config; the CLI provides no host-framework integration, no dev server, no asset bundling.
5. Lock the **watch behavior**: `act build --watch` watches filesystem paths declared by markdown adapters (PRD-201) AND any path explicitly passed to `--watch-paths`. Programmatic adapters (PRD-208) MAY register a watch hook; if they do, the CLI subscribes. CMS adapters (PRD-202–207) MAY support polling; the CLI surfaces the adapter's declared `capabilities.watch` honestly.
6. Lock the **`act init` scaffold**: three starter templates — `markdown` (default; `content/` directory + `act.config.ts` wiring PRD-201), `programmatic` (no `content/`; PRD-208 stub), `cms-contentful` (PRD-202 stub with env-var-driven config).
7. Lock the **conformance bands**: dependent on configured adapters. The CLI emits Plus only when configured adapters declare Plus capabilities AND the operator opts in via config.
8. Lock the **failure surface**: build errors exit non-zero with a structured error message; build warnings print to stderr but exit zero unless `--fail-on-warning` is set. Build report sidecar at project root (`./.act-build-report.json`) by default, configurable.
9. Lock the **logging posture**: `act build` defaults to a structured-text logger; `--json` switches to NDJSON-on-stdout; `--silent` suppresses non-error output. Verbose mode (`--verbose`) plumbs PRD-400's `BuildContext.logger` at debug level.
10. Specify the **integration with PRD-600**: `act validate <url-or-path>` is a thin wrapper around `@act/validator` that runs the same Core/Standard/Plus probe set PRD-600 documents, with no PRD-600 features re-implemented in the CLI. The CLI's `validate` subcommand is convenience; PRD-600 owns the canonical CLI (`act-validate`).
11. Enumerate the **test-fixture matrix** under `fixtures/409/positive/` and `fixtures/409/negative/`.

### Non-goals

1. **Host-framework integration.** The CLI is framework-free by design. Astro / Next / Docusaurus / etc. users use the matching 400-series plugin.
2. **Dev server.** The CLI does not serve HTTP. Operators serve the output via any static host (`npx serve`, Caddy, S3+CloudFront).
3. **Asset bundling.** The CLI does not transform images, CSS, or JS. ACT operates on JSON envelopes; downstream tooling owns assets.
4. **Defining the wire format / static profile / conformance levels / versioning / security / validator.** Owned elsewhere.
5. **Runtime ACT.** PRD-409 emits static profile only. Runtime ACT is PRD-501–505.
6. **Defining adapters.** PRD-200 owns the framework; PRD-201–208 own the reference implementations.
7. **Defining `runPipeline`.** PRD-400 owns it.
8. **Cross-platform packaging beyond Node.js.** v0.1 ships an npm package only; Deno/Bun support is best-effort but not first-party-tested.

### Stakeholders / audience

- **Authors of:** PRD-706 (hybrid static + runtime + MCP bridge example), PRD-704 (e-commerce catalog example via PRD-208), and any operator without a host framework.
- **Consumers of (upstream):** PRD-100, PRD-103, PRD-104, PRD-105, PRD-107, PRD-108, PRD-109, PRD-200, PRD-201, PRD-208 (primary), PRD-202–207 (opt-in), PRD-300, PRD-301, PRD-400, PRD-600 (delegated `validate` subcommand).
- **Consumers of (downstream):** PRD-600 (validator) — runs against CLI output. PRD-706 (hybrid example).
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Operators expect host-framework features (asset bundling, dev server, route prerendering) and the CLI silently doesn't provide them. | Medium | Medium | PRD-409-R1 documents the framework-free posture in `act --help`, the README, and the build's first log line. PRD-409-R3 errors with a clear remediation hint when the config attempts to declare host-framework-specific options. |
| TypeScript config loading varies by Node version and chosen loader. | High | Medium | PRD-409-R5 documents three supported loaders (`tsx`, `jiti`, `bun`) and falls back to `node --experimental-strip-types` on Node 22+. The CLI surfaces an actionable error when no loader resolves. |
| `--watch` mode rebuilds the full pipeline on every change, exploding build time on large corpora. | High | Medium | PRD-409-R6 implements PRD-400-R22 incremental rebuild semantics: only changed source files re-trigger their adapter's `transform`; the merge step runs once across the contributed delta. The CLI reports per-rebuild duration in watch mode. |
| `act init` writes files into a non-empty CWD and clobbers operator content. | Medium | High | PRD-409-R8 refuses to scaffold into a directory containing `act.config.*` or any of the template's target files unless `--force` is set. |
| Adapters that block on network I/O make the CLI hang in CI. | Medium | Medium | PRD-409-R10 honors a per-build timeout (`--timeout`, default 5 min); on timeout, the CLI emits the partial build report and exits non-zero. |
| Operators run `act build` AND a host-framework plugin (`@act/nextjs`) in the same project; both write to overlapping output directories. | Low | High | PRD-409-R11 emits a build error when the resolved `outputDir` conflicts with paths owned by a sibling host-framework plugin (detected by reading `package.json` for `@act/<framework>` packages and comparing typical output paths). |
| Build-report sidecar inside `outputDir` ships to the deploy target. | High | Low | PRD-409-R13 defaults `buildReportPath` to project root; in-`outputDir` overrides receive a build warning. |
| `--watch` mode misses programmatic-adapter changes (no filesystem signal). | High | Medium | PRD-409-R6 documents the limitation: programmatic adapters MAY implement a `watch(handler)` capability; if they do, the CLI subscribes. Otherwise, programmatic-adapter changes require manual rebuilds or a watcher in the adapter's source. |
| Conflict between adapter pinning (PRD-200-R25) and operator-supplied adapter from a non-canonical source. | Low | Low | PRD-409-R14 enforces PRD-400-R29 / PRD-200-R25 unconditionally; non-canonical adapter sources are operator's responsibility. |

### Open questions

1. ~~Should the CLI support reading config from environment variables (e.g., `ACT_CONFIG`)?~~ **Resolved (2026-05-01): No (v0.1).** Config-file resolution is sufficient; env-var auth credentials for adapters (Contentful tokens, etc.) are the adapter's concern. (Closes Open Question 1.)
2. ~~Should the CLI emit a deterministic build hash for cache-busting integrations?~~ **Resolved (2026-05-01): No.** The build report's per-file ETags suffice. (Closes Open Question 2.)
3. ~~Should the CLI support a `--profile` flag for quick band-targeting (`--profile core | standard | plus`)?~~ **Resolved (2026-05-01): Yes.** Convenience flag that overrides `conformanceTarget` from config. Additive optional surface (heuristic 1, "tentative yes for additive optional = yes"). (Closes Open Question 3.)
4. ~~Should `act init` interactively prompt for adapter choices?~~ **Resolved (2026-05-01): No (v0.1).** Three named templates (`markdown`, `programmatic`, `cms-contentful`) are sufficient. An interactive `act init --interactive` could be a v0.2 amendment. (Closes Open Question 4.)
5. ~~Should the CLI support config inheritance / extends?~~ **Resolved (2026-05-01): No.** Config files are flat. Operators with shared configs use TypeScript modules. (Closes Open Question 5.)

### Acceptance criteria

- [ ] Status `In review` is set; changelog entry dated 2026-05-01 by Jeremy Forsythe is present.
- [ ] Every normative requirement has an ID `PRD-409-R{n}` and a declared conformance level.
- [ ] The Specification opens with a table mapping every requirement to PRD-400 + PRD-200 + 100-series requirements implemented.
- [ ] `act build` is the canonical subcommand; `act init`, `act build --watch`, `act validate` are documented.
- [ ] Config-file resolution (`act.config.{ts,js,mjs,cjs,json}`) is pinned with the CWD-search order.
- [ ] Conformance bands described conceptually with the observed-emission rule.
- [ ] Test-fixture path layout enumerated; no fixture files created.
- [ ] Versioning & compatibility section classifies each kind of change.
- [ ] Security section cites PRD-109 and documents CLI-specific deltas.
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
- **PRD-201** (In review) — markdown/MDX adapter (default in `markdown` template).
- **PRD-202–207** (In review) — CMS adapters (opt-in).
- **PRD-208** (In review) — programmatic adapter (primary CLI consumer).
- **PRD-300** (In review) — component contract (opt-in for component-driven CLI users).
- **PRD-301** (In review) — React binding (opt-in).
- **PRD-400** (In review) — generator architecture (parent).
- **PRD-600** (In review) — validator (delegated `validate` subcommand).
- External: [Node.js fs.watch](https://nodejs.org/api/fs.html#fswatchfilename-options-listener), [chokidar](https://github.com/paulmillr/chokidar) (recommended watcher), [tsx](https://github.com/privatenumber/tsx) / [jiti](https://github.com/unjs/jiti) (TypeScript loaders), [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174).

### Blocks

- **PRD-706** (hybrid static + runtime + MCP bridge example) — depends on PRD-409 for the static-portion build orchestration.
- **PRD-704** (e-commerce catalog via PRD-208) — depends on PRD-409 for orchestration without a host framework.

### References

- v0.1 draft: §7 (build integration).
- `prd/000-decisions-needed.md` Q3 (TS-only first-party; PRD-409 ships TS reference impl).
- Prior art: `eleventy` CLI, `astro` CLI, `vite` CLI, `npx serve`.

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords as clarified by RFC 8174.

### PRD-400 + PRD-200 + 100-series requirements implemented

| PRD-409 requirement | Upstream requirement(s) implemented or consumed | Relationship |
|---|---|---|
| R1 (`@act/cli` package shape) | PRD-400-R3 (`GeneratorPlugin` analog) | CLI wraps `runPipeline`. |
| R2 (subcommand surface) | PRD-400-R1 | `act build` invokes the canonical pipeline. |
| R3 (framework-free posture) | PRD-400 (general) | CLI errors when host-framework-specific options appear. |
| R4 (`runPipeline` invocation) | PRD-400-R1, R2, R23 | Pipeline runs once; output is the static file set. |
| R5 (config-file resolution) | PRD-400-R31 (`GeneratorConfig`) | Default-export from config file matches `GeneratorConfig`. |
| R6 (`--watch` semantics) | PRD-400-R22 (incremental) | Filesystem watcher on declared paths; programmatic adapters opt-in. |
| R7 (file-set emission) | PRD-400-R9, R10, R11, R12, R13, PRD-105-R1–R7a | Static file set written to configured `outputDir`. |
| R8 (`act init` scaffolding) | PRD-201, PRD-208, PRD-202 | Three templates: `markdown`, `programmatic`, `cms-contentful`. |
| R9 (logging modes) | PRD-400-R24 | `--silent`, `--verbose`, `--json` flags. |
| R10 (build timeout) | PRD-400-R24 | `--timeout` flag; partial build report on timeout. |
| R11 (output-dir conflict detection) | PRD-400-R23 | Refuse builds that would conflict with sibling host-framework plugin output. |
| R12 (manifest construction with capabilities) | PRD-400-R10, R18, PRD-100-R4, R6 | Computed from observed emissions. |
| R13 (build-report sidecar) | PRD-400-R27 | Default at project root; configurable. |
| R14 (Stage 1 adapter pinning) | PRD-400-R29, PRD-200-R25, PRD-108-R14 | CLI emits `act_version: "0.1"` only in v0.1. |
| R15 (`act validate` delegation) | PRD-600-R26 | Subcommand wraps `@act/validator`'s API; no re-implementation. |
| R16 (programmatic API: `runBuild`) | PRD-400-R3 | Library users invoke `runBuild(config)` directly. |
| R17 (`--profile` shorthand) | PRD-107 | Convenience flag overriding `conformanceTarget`. |
| R18 (test-fixture conformance) | PRD-400-R28 | MUST pass `fixtures/400/` and `fixtures/409/`. |
| R19 (i18n configuration plumbing) | PRD-400-R14, R15, R16, PRD-104-R5, R6, R7 | Pattern 1 / Pattern 2 selectable from config. |
| R20 (mounts) | PRD-100-R7, PRD-105-R17, PRD-400-R19 | Config declares mounts; emitted in parent manifest. |

### Conformance level

- **Core:** PRD-409-R1, R2, R3, R4, R5, R7, R9, R10, R11, R12, R14, R15, R16, R17, R18, R20.
- **Standard:** PRD-409-R6 (`--watch`), R8 (`act init`), R13 (build report).
- **Plus:** PRD-409-R19 (i18n; Plus per PRD-107-R10). Plus is also reachable via R7 when adapter capabilities and config target it.

### Normative requirements

#### Package shape and commands

**PRD-409-R1.** **(Core)** The CLI MUST be published as the npm package `@act/cli`. The package MUST register a binary named `act` (resolved via `package.json` `bin`) and SHOULD also be invocable via `npx @act/cli`. The package MUST export a programmatic API surface (PRD-409-R16) for library consumers who prefer not to invoke a subprocess.

**PRD-409-R2.** **(Core)** The CLI MUST support the following subcommands at minimum:

- `act build` — invoke the canonical pipeline once against the resolved config; exit zero on success.
- `act build --watch` — invoke the pipeline once, then watch declared paths and rebuild on change.
- `act init [template]` — scaffold a starter project (`template` ∈ `{markdown, programmatic, cms-contentful}`; default `markdown`).
- `act validate <target>` — wrap `@act/validator`'s `validateSite` against `<target>` (URL or local file path); exit code per PRD-600-R27.
- `act --help` — print top-level help.
- `act <subcommand> --help` — print per-subcommand help.
- `act --version` — print package version and `act_version` (the spec version emitted by this CLI build, `"0.1"` for v0.1).

Additional subcommands MAY be added (PRD-108 MINOR per the Versioning table); existing subcommand semantics MUST NOT change without a MAJOR.

**PRD-409-R3.** **(Core)** The CLI is framework-free by design. The CLI MUST emit a build error when the resolved config declares fields keyed to a host framework (e.g., a `next` field, an `astro` field, a `nuxt` field) — those configs belong with the matching 400-series plugin. The error message MUST cite the matching plugin's PRD ID. The CLI's first log line on every build SHOULD include the line `act CLI v<version> (framework-free)` so operators recognize they're not in a host framework.

#### Pipeline invocation

**PRD-409-R4.** **(Core)** `act build` MUST invoke PRD-400's `runPipeline` exactly once against the resolved config. The CLI MUST NOT modify the pipeline's stages, ordering, or output guarantees. Errors thrown by `runPipeline` MUST surface to the user via the configured logger (PRD-409-R9) and cause a non-zero exit. The CLI MUST honor PRD-400-R23's atomic-write contract by relying on `runPipeline`'s implementation; the CLI itself MUST NOT write any output file directly.

#### Config-file resolution

**PRD-409-R5.** **(Core)** The CLI MUST search for a config file in the following order at the resolved CWD:

1. The path supplied via `--config <path>` (absolute or relative; relative is resolved against CWD).
2. `act.config.ts`.
3. `act.config.mts`.
4. `act.config.mjs`.
5. `act.config.cjs`.
6. `act.config.js`.
7. `act.config.json`.

The first file found wins. If none is found, the CLI MUST emit an error citing the search list. TypeScript configs (`*.ts`, `*.mts`) MUST be loaded via a TypeScript loader detected at runtime (probe order: `tsx` resolved in `node_modules` → `jiti` resolved → Node 22+ `--experimental-strip-types` → Bun's native TS loader). When no loader resolves, the CLI MUST emit an actionable error suggesting `npm install -D tsx` or equivalent.

The config file's default export MUST satisfy PRD-400-R31's `GeneratorConfig` interface or be a function returning a `GeneratorConfig` (sync or async).

#### Watch mode

**PRD-409-R6.** **(Standard)** `act build --watch` MUST:

1. Run `act build` once on startup.
2. Subscribe to filesystem change events on every path declared by markdown adapters (PRD-201's `roots`) AND any path passed to `--watch-paths`.
3. Subscribe to programmatic adapter watch hooks (PRD-208 capability `watch(handler: () => void)`) when those adapters declare them.
4. On change, re-run the pipeline incrementally per PRD-400-R22: only the changed file's adapter contribution is re-transformed; the merge step composes the delta with the prior output.
5. Print per-rebuild duration and a summary of changed files via the configured logger.

The CLI MUST debounce filesystem events (default 200ms; configurable via `--watch-debounce <ms>`). The CLI MUST NOT exit on a single rebuild failure; it logs the error and waits for the next change. The CLI exits cleanly on SIGINT / SIGTERM, completing any in-flight rebuild before disposing adapters.

CMS adapters (PRD-202–207) MAY support polling watch via `capabilities.watch_polling: { interval_ms: number }`. The CLI subscribes when the adapter declares it; no first-party CMS adapter is required to ship watch support in v0.1.

#### File-set emission

**PRD-409-R7.** **(Core / Standard / Plus parameterized)** The CLI MUST emit the static file set per PRD-105 layout into the resolved `outputDir`:

- `<outputDir>/.well-known/act.json` (manifest; Core).
- `<outputDir>/act/index.json` (index; Core).
- `<outputDir>/act/<id>.json` (per node; Core).
- `<outputDir>/act/subtree/<id>.json` (Standard, when subtree advertised).
- `<outputDir>/act/index.ndjson` (Plus, when NDJSON advertised).

Per PRD-105-R9, the on-disk extension MAY be `.act.json`. The CLI default is `.json`.

#### `act init` scaffolding

**PRD-409-R8.** **(Standard)** `act init [template]` MUST scaffold a starter project from one of the named templates:

- `markdown` (default): writes `act.config.ts` wiring PRD-201 against `content/`; creates `content/index.md` as a starter file; writes `.gitignore` excluding the build report.
- `programmatic`: writes `act.config.ts` wiring a PRD-208 stub that emits one example node; writes a `.gitignore`.
- `cms-contentful`: writes `act.config.ts` wiring PRD-202 with environment-variable-driven config (`CONTENTFUL_SPACE`, `CONTENTFUL_TOKEN`); writes `.env.example` listing required env vars; writes a `.gitignore` excluding `.env`.

The CLI MUST refuse to scaffold into a directory containing `act.config.*` or any of the template's target files unless `--force` is supplied; on conflict without `--force`, the CLI exits non-zero with the conflicting paths listed.

#### Logging

**PRD-409-R9.** **(Core)** The CLI MUST support these mutually-exclusive logging flags:

- `--silent` / `-s`: suppress non-error output. Errors still print to stderr.
- `--verbose` / `-v`: enable debug-level logs from `BuildContext.logger`.
- `--json`: emit one JSON object per log event on stdout (NDJSON). Each object MUST carry `timestamp` (RFC 3339), `level` (`debug | info | warn | error`), and `message` plus optional structured fields.
- (default): structured-text mode; one line per event with timestamp + level + message.

The CLI MUST NOT mix modes in a single invocation; combining `--silent` with `--verbose` is a usage error and exits non-zero.

#### Build timeout

**PRD-409-R10.** **(Core)** The CLI MUST honor `--timeout <duration>` (default `5m`; accepts suffixes `s`, `m`, `h`). On timeout, the CLI MUST:

1. Cancel any in-flight adapter operations via the AbortController exposed in `BuildContext.signal` (PRD-200-R19).
2. Wait up to 5 seconds for adapters to dispose cleanly.
3. Write a partial build report enumerating completed work and the timeout cause.
4. Exit non-zero with a structured error.

Adapter `dispose` MUST be invoked even on timeout per PRD-200-R7.

#### Output-dir conflict detection

**PRD-409-R11.** **(Core)** Before writing any output, the CLI MUST detect potential conflicts with a sibling host-framework plugin. The detection algorithm:

1. Read the project's `package.json` for installed `@act/<framework>` packages (e.g., `@act/nextjs`, `@act/astro`).
2. For each detected plugin, compute its typical `outputDir` per the plugin's documented default (e.g., `out/` for Next.js, `dist/` for Astro).
3. If the resolved `outputDir` overlaps any detected plugin's typical output, emit a build error citing the conflict and the affected plugin.

Operators MAY override the detection via `--allow-output-conflict` (with a build warning) when their build genuinely intends to interleave plugins.

#### Manifest construction and conformance

**PRD-409-R12.** **(Core)** The CLI MUST construct the manifest with `delivery: "static"`, `act_version: "0.1"`, and `conformance.level` computed from observed emissions per PRD-400-R17. The `capabilities` object MUST be populated from observed emissions per PRD-400-R18, not from configuration intent.

#### Build report

**PRD-409-R13.** **(Standard)** The CLI MUST write a build report sidecar per PRD-400-R27. Default `buildReportPath` is `./.act-build-report.json` at the project root (NOT inside `outputDir`) to avoid CDN upload. Operators who override `buildReportPath` to point inside `outputDir` MUST receive a build warning.

#### Adapter pinning

**PRD-409-R14.** **(Core)** The CLI MUST enforce PRD-400-R29 (Stage 1) before any adapter `init` runs. Adapters whose declared `act_version` differs from the build's target (`"0.1"` for v0.1) MUST cause the build to fail with a non-zero exit code. The CLI surfaces the failing adapter's package name and declared version.

#### `act validate` delegation

**PRD-409-R15.** **(Core)** `act validate <target>` MUST delegate to `@act/validator`'s `validateSite` (PRD-600-R25 / R26) without re-implementing any probe logic. The subcommand SHOULD pass through the `--probe-auth`, `--max-requests`, `--rate-limit` flags PRD-600-R26 documents. The exit codes MUST match PRD-600-R27. PRD-600's canonical CLI is `act-validate`; `act validate` is convenience-only.

#### Programmatic API

**PRD-409-R16.** **(Core)** The package MUST export a programmatic API for library consumers:

```ts
export async function runBuild(config: GeneratorConfig): Promise<BuildReport>;
export async function watchBuild(config: GeneratorConfig, opts?: WatchOptions): Promise<{ close: () => Promise<void> }>;
export async function initProject(template: 'markdown' | 'programmatic' | 'cms-contentful', target: string, opts?: { force?: boolean }): Promise<void>;
```

`runBuild` MUST return the same `BuildReport` shape PRD-400-R27 specifies. Errors thrown by the pipeline propagate to the caller.

#### `--profile` shorthand

**PRD-409-R17.** **(Core)** The CLI MUST honor `--profile <core | standard | plus>` as shorthand for `conformanceTarget`. When supplied, the flag overrides the config's `conformanceTarget`. The CLI MUST surface a build warning when `--profile` is supplied AND the config explicitly sets `conformanceTarget` to a different value.

#### Test-fixture conformance

**PRD-409-R18.** **(Core)** The CLI MUST pass the framework conformance fixture corpora at `fixtures/400/positive/` and `fixtures/409/positive/`, producing byte-equivalent output (modulo `generated_at` timestamps) to the TS reference. Negative fixtures MUST surface the documented error or warning.

#### i18n

**PRD-409-R19.** **(Plus)** The CLI MUST honor `i18n` configuration in the resolved `GeneratorConfig` per PRD-400-R14 / R15 / R16. Supported patterns are PRD-104 Pattern 1 (locale-prefixed IDs in a single manifest) and Pattern 2 (per-locale manifests). The default is Pattern 2 when multiple locales are declared. Per PRD-400-R14, the CLI MUST NOT mix patterns within a single build.

#### Mounts

**PRD-409-R20.** **(Core)** When the config declares `mounts: [...]`, the CLI MUST emit the array in the parent manifest per PRD-100-R7 and PRD-107-R5. The CLI MUST NOT recurse into a mount target (per PRD-400-R19). PRD-706 (hybrid example) is the primary consumer of this requirement: the CLI builds the static parent; a separate runtime SDK serves the runtime mount.

### Wire format / interface definition

```ts
// @act/cli public surface

import type { GeneratorConfig, BuildReport, Adapter, Binding } from '@act/core';

export async function runBuild(config: GeneratorConfig): Promise<BuildReport>;

export interface WatchOptions {
  paths?: string[];
  debounceMs?: number;
  signal?: AbortSignal;
}
export async function watchBuild(
  config: GeneratorConfig,
  opts?: WatchOptions,
): Promise<{ close: () => Promise<void> }>;

export type InitTemplate = 'markdown' | 'programmatic' | 'cms-contentful';
export async function initProject(
  template: InitTemplate,
  target: string,
  opts?: { force?: boolean },
): Promise<void>;

// CLI entry (not normally imported):
export function main(argv?: string[]): Promise<number>;
```

The `act.config.ts` shape mirrors `GeneratorConfig`:

```ts
import { defineConfig } from '@act/cli';
import { markdown } from '@act/markdown';

export default defineConfig({
  conformanceTarget: 'standard',
  outputDir: 'dist',
  buildReportPath: './.act-build-report.json',
  adapters: [markdown({ roots: ['content/**/*.{md,mdx}'] })],
  manifest: { siteName: 'Example', rootId: 'home' },
  mounts: [],
});
```

### Errors

| Condition | Severity | Notes |
|---|---|---|
| No config file found | Error (exit 1) | PRD-409-R5; cite search list |
| TypeScript loader unavailable | Error (exit 1) | PRD-409-R5; suggest `npm install -D tsx` |
| Config declares host-framework-specific fields | Error (exit 1) | PRD-409-R3 |
| `outputDir` conflicts with sibling plugin's typical output | Error (exit 1) | PRD-409-R11; `--allow-output-conflict` to override |
| `act init` target dir contains conflicting files (no `--force`) | Error (exit 1) | PRD-409-R8 |
| Adapter `act_version` mismatch (Stage 1) | Error (exit 1) | PRD-409-R14 |
| Schema validation failure on emitted envelope | Error (exit 1) | PRD-400-R21 |
| Build timeout | Error (exit 124) | PRD-409-R10 |
| `--silent` and `--verbose` both supplied | Usage error (exit 2) | PRD-409-R9 |
| `--profile` conflicts with config `conformanceTarget` | Build warning | PRD-409-R17 |
| `buildReportPath` inside `outputDir` | Build warning | PRD-409-R13 |
| No adapters configured (empty corpus) | Build warning | Manifest emitted with empty index |

---

## Examples

### Example 1 — markdown-only static site (Core)

```ts
// act.config.ts
import { defineConfig } from '@act/cli';
import { markdown } from '@act/markdown';

export default defineConfig({
  outputDir: 'dist',
  adapters: [markdown({ roots: ['content/**/*.md'] })],
  manifest: { siteName: 'Notes', rootId: 'home' },
});
```

Source layout:

```
content/
  index.md
  post-1.md
  guides/getting-started.md
```

Run `act build` →

```
dist/.well-known/act.json
dist/act/index.json
dist/act/index-page.json   (id derived from content/index.md)
dist/act/post-1.json
dist/act/guides/getting-started.json
.act-build-report.json
```

### Example 2 — programmatic adapter for an e-commerce catalog (Standard)

```ts
import { defineConfig } from '@act/cli';
import { programmatic } from '@act/programmatic';

export default defineConfig({
  conformanceTarget: 'standard',
  outputDir: 'public',
  adapters: [
    programmatic({
      async enumerate() {
        const products = await fetch('https://api.example.com/products').then((r) => r.json());
        return products.map((p) => ({
          id: `products/${p.sku}`,
          type: 'product',
          title: p.name,
          summary: p.description,
          summary_source: 'authored',
          metadata: { canonical_url: `https://example.com/products/${p.sku}` },
          content: [{ kind: 'markdown', text: p.body }],
        }));
      },
    }),
  ],
});
```

Run `act build --profile standard` → emits per-product nodes plus subtrees per category root.

### Example 3 — `act init` scaffold

```sh
$ act init markdown my-docs
✓ Created my-docs/act.config.ts
✓ Created my-docs/content/index.md
✓ Created my-docs/.gitignore
✓ Done. Run `cd my-docs && npm install @act/cli @act/markdown && act build`.
```

---

## Test fixtures

PRD-409 fixtures verify the CLI end-to-end. Files are not created by this PRD; they are enumerated for downstream authoring.

### Positive

- `fixtures/409/positive/markdown-only-core/` — `act.config.ts` with PRD-201; `content/` with three pages.
- `fixtures/409/positive/programmatic-only/` — PRD-208 adapter producing five nodes.
- `fixtures/409/positive/multi-adapter-merge/` — PRD-201 + PRD-208; merge per PRD-200-R12.
- `fixtures/409/positive/standard-with-subtree/` — Standard band; subtree advertised.
- `fixtures/409/positive/plus-with-ndjson-and-i18n/` — Plus band; NDJSON + Pattern 2 i18n.
- `fixtures/409/positive/watch-mode-rebuild/` — `act build --watch`; markdown change triggers incremental rebuild.
- `fixtures/409/positive/init-markdown-template/` — `act init markdown` on empty dir scaffolds correctly.
- `fixtures/409/positive/init-programmatic-template/` — `act init programmatic`.
- `fixtures/409/positive/init-cms-contentful-template/` — `act init cms-contentful` writes `.env.example`.
- `fixtures/409/positive/profile-flag-overrides/` — `--profile standard` overrides config `core`.
- `fixtures/409/positive/with-mounts/` — config declares mounts; emitted in parent manifest.
- `fixtures/409/positive/json-logger/` — `--json` emits NDJSON to stdout.

### Negative

- `fixtures/409/negative/no-config-file/` — empty dir; build error per PRD-409-R5.
- `fixtures/409/negative/host-framework-field/` — config declares `next: { ... }`; build error per PRD-409-R3.
- `fixtures/409/negative/output-dir-conflict/` — `outputDir: "out"` with `@act/nextjs` installed; build error per PRD-409-R11.
- `fixtures/409/negative/adapter-version-mismatch/` — adapter declares `act_version: "0.2"`; build error per PRD-409-R14.
- `fixtures/409/negative/build-report-inside-output/` — warning per PRD-409-R13.
- `fixtures/409/negative/init-conflicting-files/` — `act init` into non-empty dir without `--force`; build error per PRD-409-R8.
- `fixtures/409/negative/silent-and-verbose/` — usage error per PRD-409-R9.
- `fixtures/409/negative/timeout/` — adapter that hangs; CLI exits 124 per PRD-409-R10 with partial build report.
- `fixtures/409/negative/typescript-no-loader/` — `act.config.ts` with no TS loader installed; build error per PRD-409-R5.

---

## Versioning & compatibility

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a new subcommand | MINOR | |
| Add a new flag to an existing subcommand | MINOR | |
| Add a new `act init` template | MINOR | |
| Remove or rename a subcommand | MAJOR | |
| Change a flag's default value | MAJOR | Output / behavior diverges |
| Change config-file resolution order | MAJOR | |
| Tighten an SHOULD to a MUST | MAJOR | |
| Loosen a MUST to a SHOULD | MAJOR | |
| Change exit code semantics | MAJOR | |
| Change `runBuild` / `watchBuild` / `initProject` API | MAJOR | |
| Drop Node.js minimum version | MAJOR | |

### Forward compatibility

The CLI MUST tolerate unknown optional fields in `GeneratorConfig` per PRD-400's tolerance rules. The CLI MUST reject unknown required fields. Unknown subcommands exit with usage error.

### Backward compatibility

A CLI upgrading from a prior PRD-409 minor MUST emit byte-equivalent output for unchanged source corpora and unchanged adapter sets. The `act.config.{ts,js,mjs,cjs,json}` resolution order MUST be stable across MINOR bumps.

---

## Security considerations

PRD-109 (Accepted) governs the project-wide threat model. PRD-409 deltas:

- **CLI runs in operator's environment.** `act build` has full filesystem and network access. Adapters configured by the operator MAY perform network I/O during `init` / `enumerate`; that is the adapter's responsibility per PRD-200's lifecycle.
- **Config file is executable code.** `act.config.{ts,js,mjs,cjs}` files execute at config load. The CLI MUST NOT load configs from untrusted sources. Operators are responsible for the integrity of their `act.config.*` file.
- **TypeScript loader supply chain.** The CLI probes `tsx` / `jiti` / Node's experimental loader at runtime. The chosen loader executes the config file. Operators are responsible for loader integrity (lockfile, etc.).
- **Build-report leakage.** Default `buildReportPath` is at project root, NOT inside `outputDir`. PRD-409-R13 codifies this.
- **`act init` writes files.** PRD-409-R8 requires `--force` to overwrite; otherwise refuses. Templates MUST NOT write executable files outside the target directory.
- **Watch mode resource use.** `act build --watch` holds open file descriptors for declared paths. The CLI MUST close watchers on SIGINT / SIGTERM. The CLI MUST bound the watcher count via the OS's filesystem watch limit; on platforms with low limits (macOS default is small), the CLI SHOULD print a warning suggesting `ulimit` adjustment.
- **Information disclosure (404 vs 403).** Static profile only; no auth boundary applies at the CLI layer.
- **Programmatic adapter trust.** PRD-208 adapters execute arbitrary code at build time. PRD-409 inherits PRD-208's trust model; the CLI MUST NOT widen it.

---

## Implementation notes

The TypeScript snippets below show the canonical CLI shape. They are normative only insofar as PRD-409's normative requirements pin the behavior; the actual code in `@act/cli` is the implementer's choice.

### Snippet 1 — `act.config.ts` shape and `defineConfig` helper

```ts
import type { GeneratorConfig } from '@act/core';

export function defineConfig(config: GeneratorConfig): GeneratorConfig {
  return config;                                       // identity; type-narrowing only
}

// Operator's act.config.ts:
// import { defineConfig } from '@act/cli';
// import { markdown } from '@act/markdown';
// export default defineConfig({ /* ... */ });
```

### Snippet 2 — CLI entry point (`act build`)

```ts
import { Command } from 'commander';
import { runBuild } from './run-build';
import { resolveConfig } from './resolve-config';

export async function main(argv = process.argv): Promise<number> {
  const program = new Command()
    .name('act')
    .version(require('../package.json').version)
    .description('act CLI — framework-free ACT generator');

  program
    .command('build')
    .option('-c, --config <path>', 'config file path')
    .option('--profile <level>', 'core | standard | plus', undefined)
    .option('--watch', 'rebuild on filesystem change')
    .option('--timeout <duration>', 'build timeout', '5m')
    .option('--silent')
    .option('--verbose')
    .option('--json')
    .option('--fail-on-warning')
    .option('--allow-output-conflict')
    .action(async (opts) => {
      const config = await resolveConfig(opts.config);  // PRD-409-R5
      applyProfileOverride(config, opts.profile);       // PRD-409-R17
      validateNoHostFrameworkFields(config);             // PRD-409-R3
      validateNoOutputConflict(config, opts);            // PRD-409-R11
      if (opts.watch) {
        await runWatch(config, opts);                    // PRD-409-R6
      } else {
        const report = await runBuild(config);
        if (opts.failOnWarning && report.warnings.length > 0) process.exitCode = 1;
      }
    });

  program.command('init [template]').action(async (template = 'markdown', opts) => {
    await initProject(template, process.cwd(), opts);    // PRD-409-R8
  });

  program.command('validate <target>').action(async (target, opts) => {
    const { validateSite } = await import('@act/validator');  // PRD-409-R15
    const report = await validateSite(target, opts);
    process.exitCode = report.gaps.length > 0 ? 1 : 0;
  });

  await program.parseAsync(argv);
  return process.exitCode ?? 0;
}
```

### Snippet 3 — config-file resolution

```ts
import { existsSync } from 'node:fs';
import path from 'node:path';

const SEARCH_ORDER = [
  'act.config.ts',
  'act.config.mts',
  'act.config.mjs',
  'act.config.cjs',
  'act.config.js',
  'act.config.json',
];

export async function resolveConfig(explicit?: string): Promise<GeneratorConfig> {
  const cwd = process.cwd();
  let configPath = explicit ? path.resolve(cwd, explicit) : null;
  if (!configPath) {
    for (const name of SEARCH_ORDER) {
      const candidate = path.join(cwd, name);
      if (existsSync(candidate)) { configPath = candidate; break; }
    }
  }
  if (!configPath) {
    throw new Error(`No config file found. Searched: ${SEARCH_ORDER.join(', ')}`);
  }
  if (configPath.endsWith('.json')) {
    return JSON.parse(await fs.readFile(configPath, 'utf8'));
  }
  if (/\.(ts|mts)$/.test(configPath)) {
    await ensureTsLoader();                              // probe tsx, jiti, node strip-types
  }
  const mod = await import(pathToFileURL(configPath).href);
  const cfg = typeof mod.default === 'function' ? await mod.default() : mod.default;
  return cfg as GeneratorConfig;
}
```

### Snippet 4 — watch loop (PRD-409-R6)

```ts
import chokidar from 'chokidar';
import { runPipelineIncremental } from '@act/core';

export async function runWatch(config: GeneratorConfig, opts: WatchOpts) {
  const initial = await runBuild(config);
  const watchedPaths = collectWatchedPaths(config, opts);  // markdown roots + --watch-paths
  const watcher = chokidar.watch(watchedPaths, { ignoreInitial: true });
  let queue: string[] = [];
  let timer: NodeJS.Timeout | null = null;
  const debounce = opts.watchDebounce ?? 200;

  watcher.on('all', (event, path) => {
    queue.push(path);
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      const changed = [...new Set(queue)];
      queue = [];
      const start = Date.now();
      try {
        await runPipelineIncremental(config, { changed });    // PRD-400-R22
        log.info(`rebuild done in ${Date.now() - start}ms`);
      } catch (err) {
        log.error(`rebuild failed: ${(err as Error).message}`);
      }
    }, debounce);
  });

  process.on('SIGINT', async () => { await watcher.close(); process.exit(0); });
  return { close: () => watcher.close() };
}
```

### Snippet 5 — `act init` scaffold

```ts
import { promises as fs } from 'node:fs';
import path from 'node:path';

export async function initProject(
  template: InitTemplate,
  targetDir: string,
  opts: { force?: boolean } = {},
): Promise<void> {
  const files = TEMPLATE_FILES[template];               // map of relPath → contents
  const conflicts: string[] = [];
  for (const rel of Object.keys(files)) {
    const abs = path.join(targetDir, rel);
    try { await fs.access(abs); conflicts.push(rel); } catch { /* OK */ }
  }
  if (conflicts.length && !opts.force) {
    throw new Error(`act init conflicts: ${conflicts.join(', ')}. Use --force to overwrite.`);
  }
  for (const [rel, contents] of Object.entries(files)) {
    const abs = path.join(targetDir, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, contents, 'utf8');
  }
}
```

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft; status `In review`. |
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review. Decisions: (Q1) no env-var config (`ACT_CONFIG`) in v0.1 — config-file resolution suffices; (Q2) no deterministic build hash — per-file ETags suffice; (Q3) `--profile` flag added for quick band-targeting (overrides `conformanceTarget`); (Q4) no interactive `act init` in v0.1 — three named templates (`markdown`, `programmatic`, `cms-contentful`) ship; (Q5) no config-inheritance/extends — operators with shared configs use TypeScript modules. Ratified: TS loader probe order `tsx` / `jiti` / Node strip-types / Bun; output-dir conflict detection vs sibling `@act/<framework>` plugins fails loud. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
