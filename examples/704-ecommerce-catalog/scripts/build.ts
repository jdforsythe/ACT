/**
 * PRD-704-R13 / R14 — example build entry point.
 *
 * Invokes PRD-400's canonical pipeline (`runPipeline` + `emitFiles` from
 * `@act-spec/generator-core`) against the act-catalog programmatic adapter.
 * Per PRD-704-R13 the example MUST NOT bypass the pipeline — atomic writes
 * (PRD-400-R23) and post-build validation (PRD-400-R24) apply.
 *
 * Cross-sell verification per PRD-704-R12 runs after the pipeline emits
 * nodes but before files are written; dangling `related[]` references are a
 * build error (we run with `strict: true`).
 *
 * Output layout (PRD-704-R2):
 *   out/.well-known/act.json      — manifest
 *   out/act/index.json            — index of every node
 *   out/act/nodes/{id}.json       — one per product (+ synthetic catalog root)
 *   out/act/subtrees/{id}.json    — exactly one root subtree (id=`catalog`)
 *   out/.act-build-report.json    — build report sidecar (PRD-400-R27)
 *
 * Note: PRD-704-R2 enumerates `out/act/n/<id>.json` and
 * `out/act/sub/<id>.json` while generator-core's `emitFiles` writes under
 * `out/act/nodes/` and `out/act/subtrees/` respectively. The discrepancy is
 * filed as docs/amendments-queue.md A18 (the manifest-advertised URL
 * templates `node_url_template` / `subtree_url_template` keep the PRD's
 * `/act/n/{id}.json` / `/act/sub/{id}.json` shape so wire-level conformance
 * is preserved; only the on-disk emission path differs from the PRD's
 * literal text).
 */
/* eslint-disable no-console */
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  emitFiles,
  runPipeline,
  verifyCapabilityBacking,
  type GeneratorConfig,
} from '@act-spec/generator-core';

import { createCatalogAdapter } from '../src/catalog-adapter.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const exampleRoot = path.resolve(here, '..');
const outputDir = path.join(exampleRoot, 'out');
const databasePath = path.join(exampleRoot, 'data', 'products.json');

interface ConsoleLogger {
  debug(msg: string): void;
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

function makeLogger(): ConsoleLogger {
  return {
    debug: (msg) => console.log(`  ${msg}`),
    info: (msg) => console.log(`[act] ${msg}`),
    warn: (msg) => console.warn(`[act][warn] ${msg}`),
    error: (msg) => console.error(`[act][error] ${msg}`),
  };
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const logger = makeLogger();

  // Clean previous build so byte-equivalence checks (PRD-704 §"Backward
  // compatibility") remain valid across re-runs.
  await fs.rm(outputDir, { recursive: true, force: true });

  const config: GeneratorConfig = {
    conformanceTarget: 'standard',
    outputDir,
    site: { name: 'Acme Catalog' },
    urlTemplates: {
      indexUrl: '/act/index.json',
      // PRD-704-R4 — wire-level URL templates per the PRD's literal text.
      nodeUrlTemplate: '/act/n/{id}.json',
      subtreeUrlTemplate: '/act/sub/{id}.json',
    },
    generator: '@act-spec/example-704-ecommerce-catalog@0.0.0',
    adapters: [
      {
        adapter: createCatalogAdapter({ databasePath }),
        config: {},
        // PRD-704-R14 — Stage 1 act_version pinning.
        actVersion: '0.1',
      },
    ],
  };

  logger.info(`enumerate + transform via @act-spec/programmatic-adapter`);
  const outcome = await runPipeline({ config, logger });
  logger.info(
    `pipeline emitted ${outcome.nodes.length} node(s) + ${outcome.subtrees.size} subtree(s); achieved level: ${outcome.achieved}`,
  );

  // PRD-704-R12 — referential integrity for related[] (build-time check).
  const knownIds = new Set(outcome.nodes.map((n) => n.id));
  const dangling: Array<{ from: string; to: string }> = [];
  for (const n of outcome.nodes) {
    const related = (n as { related?: unknown }).related;
    if (!Array.isArray(related)) continue;
    for (const r of related) {
      // post-A5 schema: items are `{id, relation}` objects.
      const targetId =
        typeof r === 'object' && r !== null && typeof (r as { id?: unknown }).id === 'string'
          ? (r as { id: string }).id
          : typeof r === 'string'
            ? r
            : undefined;
      if (targetId === undefined) continue;
      if (!knownIds.has(targetId)) dangling.push({ from: n.id, to: targetId });
    }
  }
  if (dangling.length > 0) {
    const sample = dangling
      .slice(0, 5)
      .map((d) => `${d.from} → ${d.to}`)
      .join(', ');
    throw new Error(
      `PRD-704-R12: ${dangling.length} dangling related[] reference(s) (strict: true). First: ${sample}`,
    );
  }

  const report = await emitFiles({
    outcome,
    outputDir: config.outputDir,
    config,
    startedAt,
  });

  // PRD-400-R18 — capability advertisement must be backed by emitted files.
  verifyCapabilityBacking(outcome.capabilities, report.files);

  logger.info(
    `wrote ${report.files.length} file(s) to ${config.outputDir} in ${report.durationMs}ms`,
  );
  logger.info(`build report sidecar: ${path.join(config.outputDir, '.act-build-report.json')}`);
  logger.info(`achieved.level: ${report.conformanceAchieved}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
