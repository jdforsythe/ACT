/**
 * @act-spec/markdown-adapter — PRD-200 framework + PRD-201 markdown leaf.
 *
 * Public API. The adapter framework lives in `./framework.ts` (per ADR-003);
 * the PRD-201 leaf in `./markdown.ts`. Both surfaces are re-exported here.
 */
export const MARKDOWN_ADAPTER_PACKAGE_NAME = '@act-spec/markdown-adapter' as const;

// PRD-200 framework — types + lifecycle + multi-source merge.
export type {
  Adapter,
  AdapterCapabilities,
  AdapterContext,
  AdapterLogger,
  AdapterRunResult,
  AdapterSourceStamp,
  EmittedNode,
  IdResolution,
  MergeOptions,
  MergePolicy,
  PartialEmittedNode,
} from './framework.js';
export {
  FRAMEWORK_CONFORMANCE_VERSION,
  bubbleManifestCapabilities,
  checkAdapterPinning,
  mergeContributions,
  mergeRuns,
  namespaceIds,
  resolveId,
  runAdapter,
  stampSource,
} from './framework.js';

// PRD-201 markdown leaf.
export type { MarkdownAdapterConfig, MarkdownItem, BlockEmission, ParsedFrontmatter } from './markdown.js';
export {
  ID_GRAMMAR,
  bodyToBlocks,
  createMarkdownAdapter,
  deriveDefaultId,
  deriveEtag,
  extractSummary,
  listFiles,
  parseFrontmatter,
  parseTomlSubset,
  stripEtag,
  transformOne,
  truncateSummary,
  validateId,
} from './markdown.js';
