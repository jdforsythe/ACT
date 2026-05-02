/**
 * `act` CLI argv parsing + dispatch (PRD-409-R1 / R2 / R15 / R17).
 *
 * Library-friendly: {@link runCli} takes argv + an output sink and returns the
 * process exit code. The package's `bin` shim invokes it with
 * `process.argv.slice(2)`.
 *
 * Subcommands per PRD-409-R2:
 *   - `act build` (with `--watch`, `--config`, `--profile`, `--timeout`, …).
 *   - `act init [template]`.
 *   - `act validate <target>` (delegated to @act-spec/validator per PRD-409-R15).
 *   - `act --help` / `act --version`.
 *
 * Exit codes:
 *   0 — success.
 *   1 — build error / non-zero validate findings.
 *   2 — usage error (bad argv, mutually-exclusive flags).
 *   124 — build timeout (PRD-409-R10).
 */
import { parseArgs, type ParseArgsConfig } from 'node:util';
import * as path from 'node:path';

import {
  applyProfileOverride,
  detectHostFrameworkFields,
  loadConfig,
  type ProfileShorthand,
} from './config.js';
import { detectOutputConflicts, formatConflict } from './conflicts.js';
import { parseDuration } from './duration.js';
import { initProject } from './init.js';
import { createLogger, selectLoggerMode, type CliLogger, type LoggerSink } from './logger.js';
import { BuildTimeoutError, runBuild } from './run-build.js';
import { isInitTemplate } from './templates.js';
import { ACT_VERSION, CLI_VERSION } from './version.js';
import { watchBuild } from './watch.js';

export type { LoggerSink } from './logger.js';

const HELP_TEXT = `act ${CLI_VERSION} (act_version ${ACT_VERSION})  framework-free

USAGE
  act build [--config <path>] [--profile <core|standard|plus>] [--watch]
            [--watch-paths <a,b,c>] [--watch-debounce <ms>]
            [--timeout <duration>] [--build-report <path>]
            [--allow-output-conflict] [--fail-on-warning]
            [--silent | --verbose | --json]
  act init [template]                       template ∈ markdown|programmatic|cms-contentful
            [--target <dir>] [--force]
  act validate <target> [...]               delegates to @act-spec/validator
  act --help
  act --version

FLAGS
  --config <path>           explicit config path; overrides CWD search.
  --profile <level>         shorthand for conformanceTarget (PRD-409-R17).
  --watch                   rebuild on filesystem change (PRD-409-R6).
  --watch-paths <list>      extra comma-separated paths to watch.
  --watch-debounce <ms>     debounce delay for filesystem events (default 200).
  --timeout <duration>      build timeout, e.g. 5m, 30s (PRD-409-R10; default 5m).
  --build-report <path>     override build-report sidecar path (PRD-409-R13).
  --allow-output-conflict   bypass PRD-409-R11 outputDir conflict check.
  --fail-on-warning         exit 1 when warnings are present.
  --silent | --verbose | --json   logger mode (PRD-409-R9).
`;

export interface CliOptions {
  /** Working directory. Defaults to process.cwd(). */
  cwd?: string;
}

export async function runCli(
  argv: readonly string[],
  sink: LoggerSink,
  opts: CliOptions = {},
): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();

  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h' || argv[0] === 'help') {
    sink.stdout(HELP_TEXT);
    return 0;
  }
  if (argv[0] === '--version' || argv[0] === '-V') {
    sink.stdout(`${CLI_VERSION} (act_version ${ACT_VERSION})\n`);
    return 0;
  }
  // The CLI's first log line on every build per PRD-409-R3.
  if (argv[0] === 'build') {
    sink.stderr(`act CLI v${CLI_VERSION} (framework-free)\n`);
    return runBuildCommand(argv.slice(1), sink, cwd);
  }
  if (argv[0] === 'init') {
    return runInitCommand(argv.slice(1), sink, cwd);
  }
  if (argv[0] === 'validate') {
    return runValidateCommand(argv.slice(1), sink);
  }
  sink.stderr(`act: unknown subcommand "${String(argv[0])}". Run 'act --help'.\n`);
  return 2;
}

// ----------------------------- build --------------------------------------

const BUILD_OPTIONS = {
  config: { type: 'string', short: 'c' },
  profile: { type: 'string' },
  watch: { type: 'boolean' },
  'watch-paths': { type: 'string' },
  'watch-debounce': { type: 'string' },
  timeout: { type: 'string' },
  'build-report': { type: 'string' },
  'allow-output-conflict': { type: 'boolean' },
  'fail-on-warning': { type: 'boolean' },
  silent: { type: 'boolean', short: 's' },
  verbose: { type: 'boolean', short: 'v' },
  json: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const satisfies ParseArgsConfig['options'];

async function runBuildCommand(
  argv: readonly string[],
  sink: LoggerSink,
  cwd: string,
): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      options: BUILD_OPTIONS,
      strict: true,
      allowPositionals: true,
      args: [...argv],
    });
  } catch (err) {
    sink.stderr(`act build: ${(err as Error).message}\n`);
    return 2;
  }
  const v = parsed.values;
  if (v.help === true) {
    sink.stdout(HELP_TEXT);
    return 0;
  }

  const modeChoice = selectLoggerMode({
    ...(v.silent !== undefined ? { silent: v.silent } : {}),
    ...(v.verbose !== undefined ? { verbose: v.verbose } : {}),
    ...(v.json !== undefined ? { json: v.json } : {}),
  });
  if ('error' in modeChoice) {
    sink.stderr(`act build: ${modeChoice.error}\n`);
    return 2;
  }
  const logger = createLogger(modeChoice.mode, sink);

  // PRD-409-R10 — parse timeout.
  let timeoutMs = 5 * 60_000;
  if (typeof v.timeout === 'string' && v.timeout.length > 0) {
    try {
      timeoutMs = parseDuration(v.timeout);
    } catch (err) {
      sink.stderr(`act build: ${(err as Error).message}\n`);
      return 2;
    }
  }

  // PRD-409-R17 — validate profile shorthand.
  let profile: ProfileShorthand | undefined;
  if (typeof v.profile === 'string') {
    if (v.profile !== 'core' && v.profile !== 'standard' && v.profile !== 'plus') {
      sink.stderr(`act build: --profile must be core|standard|plus (got "${v.profile}")\n`);
      return 2;
    }
    profile = v.profile;
  }

  // PRD-409-R5 — load config.
  let loaded;
  try {
    loaded = await loadConfig(cwd, typeof v.config === 'string' ? v.config : undefined);
  } catch (err) {
    sink.stderr(`act build: ${(err as Error).message}\n`);
    return 1;
  }
  const config = loaded.config;

  // PRD-409-R3 — refuse host-framework fields.
  const hf = detectHostFrameworkFields(config as unknown as Record<string, unknown>);
  if (hf.length > 0) {
    for (const f of hf) {
      sink.stderr(
        `act build: PRD-409-R3 — config field "${f.field}" belongs to host-framework plugin ${f.prd}, not the framework-free CLI.\n`,
      );
    }
    return 1;
  }

  // PRD-409-R17 — apply profile.
  const profileResult = applyProfileOverride(config, profile);
  if (profileResult.conflicted) {
    logger.warn(
      `PRD-409-R17: --profile ${String(profile)} overrides config conformanceTarget "${profileResult.previous}".`,
    );
  }

  // PRD-409-R11 — output-dir conflict detection (unless overridden).
  if (v['allow-output-conflict'] !== true) {
    const conflicts = detectOutputConflicts({ cwd, outputDir: config.outputDir });
    if (conflicts.length > 0) {
      for (const c of conflicts) sink.stderr(`act build: ${formatConflict(c)}\n`);
      return 1;
    }
  } else {
    const conflicts = detectOutputConflicts({ cwd, outputDir: config.outputDir });
    for (const c of conflicts) {
      logger.warn(`PRD-409-R11 (suppressed): ${formatConflict(c)}`);
    }
  }

  // PRD-409-R6 — watch mode.
  if (v.watch === true) {
    const extras =
      typeof v['watch-paths'] === 'string'
        ? v['watch-paths'].split(',').map((s) => s.trim()).filter(Boolean)
        : undefined;
    const debounce =
      typeof v['watch-debounce'] === 'string'
        ? Number.parseInt(v['watch-debounce'], 10)
        : undefined;
    const handle = await watchBuild(config, {
      cwd,
      logger,
      ...(typeof v['build-report'] === 'string' ? { buildReportPath: path.resolve(cwd, v['build-report']) } : {}),
      ...(extras !== undefined ? { paths: extras } : {}),
      ...(debounce !== undefined && Number.isFinite(debounce) ? { debounceMs: debounce } : {}),
    });
    // SIGINT / SIGTERM handlers per PRD-409-R6.
    let closed = false;
    const onSignal = (): void => {
      if (closed) return;
      closed = true;
      void handle.close().then(() => {
        process.exit(0);
      });
    };
    process.once('SIGINT', onSignal);
    process.once('SIGTERM', onSignal);
    // Wait forever (until signal). Tests close via the returned handle.
    return await new Promise<number>(() => {
      /* never resolve */
    });
  }

  // Single build.
  try {
    const report = await runBuild(config, {
      cwd,
      logger,
      timeoutMs,
      ...(typeof v['build-report'] === 'string' ? { buildReportPath: path.resolve(cwd, v['build-report']) } : {}),
    });
    if (v['fail-on-warning'] === true && report.warnings.length > 0) {
      logger.error(`build produced ${report.warnings.length} warning(s); --fail-on-warning set.`);
      return 1;
    }
    return 0;
  } catch (err) {
    if (err instanceof BuildTimeoutError) {
      logger.error(err.message);
      return 124;
    }
    logger.error(`act build: ${(err as Error).message}`);
    return 1;
  }
}

// ----------------------------- init ---------------------------------------

const INIT_OPTIONS = {
  target: { type: 'string' },
  force: { type: 'boolean' },
  help: { type: 'boolean', short: 'h' },
} as const satisfies ParseArgsConfig['options'];

async function runInitCommand(
  argv: readonly string[],
  sink: LoggerSink,
  cwd: string,
): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      options: INIT_OPTIONS,
      strict: true,
      allowPositionals: true,
      args: [...argv],
    });
  } catch (err) {
    sink.stderr(`act init: ${(err as Error).message}\n`);
    return 2;
  }
  const v = parsed.values;
  if (v.help === true) {
    sink.stdout(HELP_TEXT);
    return 0;
  }
  const templateRaw = parsed.positionals[0] ?? 'markdown';
  if (!isInitTemplate(templateRaw)) {
    sink.stderr(`act init: unknown template "${templateRaw}". Choose: markdown, programmatic, cms-contentful.\n`);
    return 2;
  }
  const target = typeof v.target === 'string' ? path.resolve(cwd, v.target) : cwd;
  try {
    const result = await initProject(templateRaw, target, { force: v.force === true });
    for (const w of result.written) {
      sink.stdout(`wrote ${w}\n`);
    }
    return 0;
  } catch (err) {
    sink.stderr(`act init: ${(err as Error).message}\n`);
    return 1;
  }
}

// ----------------------------- validate -----------------------------------

async function runValidateCommand(
  argv: readonly string[],
  sink: LoggerSink,
): Promise<number> {
  if (argv.length === 0) {
    sink.stderr(
      `act validate: PRD-409-R15 — this subcommand delegates to @act-spec/validator. Pass through args, e.g. \`act validate https://example.com\`.\n`,
    );
    return 2;
  }
  // PRD-409-R15 — delegate to @act-spec/validator's runCli; the canonical
  // CLI is `act-validate` and `act validate` is convenience-only.
  let validator: { runCli?: (argv: readonly string[], sink: LoggerSink) => Promise<number> };
  try {
    validator = await import('@act-spec/validator');
  } catch (err) {
    sink.stderr(`act validate: failed to load @act-spec/validator: ${(err as Error).message}\n`);
    return 1;
  }
  if (typeof validator.runCli !== 'function') {
    sink.stderr(`act validate: @act-spec/validator does not export runCli; run \`act-validate\` directly.\n`);
    return 1;
  }
  return validator.runCli(argv, sink);
}

/** Re-export the cli logger for advanced library use. */
export type { CliLogger };
