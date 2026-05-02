/**
 * @act-spec/astro — PRD-400 generator pipeline + PRD-401 Astro integration.
 *
 * The pipeline (PRD-400) lives in `./pipeline.ts`; the Astro plugin
 * (PRD-401) wraps it in `./integration.ts`. Per ADR-003 we keep the
 * pipeline code in this package for now (one consumer); promote to
 * `@act-spec/generator-core` when a second TS leaf generator lands.
 */
export const ASTRO_PACKAGE_NAME = '@act-spec/astro' as const;

// PRD-400 framework exports.
export type {
  BuildContext,
  BuildReport,
  GeneratorConfig,
  GeneratorPlugin,
  PipelineOutcome,
  PipelineRun,
} from './pipeline.js';
export {
  PIPELINE_FRAMEWORK_VERSION,
  VERSIONED_TREES_SUPPORTED,
  atomicWrite,
  buildIndex,
  buildManifest,
  buildSubtree,
  cleanupTmp,
  computeEtag,
  emitFiles,
  enforceAdapterPinning,
  enforceTargetLevel,
  inferAchievedLevel,
  runPipeline,
  verifyCapabilityBacking,
} from './pipeline.js';

// PRD-401 leaf exports.
export type { ActAstroOptions, ActIntegration, RouteActExport } from './integration.js';
export {
  actIntegration,
  debounce,
  detectAchievedBand,
  detectsReactIslands,
  isAstroVersionSupported,
  isOutputEligibleForStatic,
  readRouteActExport,
  resolveConfig,
  runActBuild,
} from './integration.js';
export { default } from './integration.js';
