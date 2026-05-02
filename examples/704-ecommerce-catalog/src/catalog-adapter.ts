/**
 * PRD-704 — programmatic adapter wiring.
 *
 * Wraps `data/products.json` (the deterministic corpus emitted by
 * `scripts/generate-corpus.ts`) into a PRD-208 programmatic adapter via
 * `defineProgrammaticAdapter`. Every PRD-704-R8 setting is pinned here:
 *
 *  - `name: "act-catalog"`            (PRD-704-R8 #2)
 *  - `namespaceIds: false`            (PRD-704-R8 #3 / PRD-704-R7)
 *  - `validate: "before-emit"`        (PRD-704-R8 #4)
 *  - `strict: true`                   (PRD-704-R8 #5 / PRD-704-R12)
 *  - deterministic enumerate          (PRD-704-R8 #6 — sort by sku)
 *  - capabilities Standard / primary  (PRD-704-R8 #8)
 *
 * Per-node shape satisfies PRD-704-R5 (id grammar, schema_org_type pin),
 * PRD-704-R6 (exactly two blocks: prose + data, in that order, both
 * extracted_via=adapter), PRD-704-R7 (related[] capped at 8), and
 * PRD-704-R9 (metadata.source attribution).
 *
 * Token estimation: PRD-704-R11 prescribes a framework-side tokenizer; the
 * v0.1 generator-core does not implement one (PRD-201's markdown adapter
 * uses a naive whitespace tokenizer locally; this example mirrors the
 * pattern and pre-populates `tokens.{summary,body}` on every node). The
 * gap is filed as `docs/amendments-queue.md` A18.
 */
import { promises as fs } from 'node:fs';

import type { AdapterCapabilities, EmittedNode } from '@act-spec/adapter-framework';
import { defineProgrammaticAdapter } from '@act-spec/programmatic-adapter';

/** Shape of a row in `data/products.json`. */
export interface ProductRow {
  sku: string;
  name: string;
  summary: string;
  description_md: string;
  /** JSON-stringified specs payload — the `data` block's canonical text. */
  specs_json: string;
  /** CSV of sibling SKUs. */
  related_skus: string;
  /** CSV of taxonomy tags. */
  tags: string;
}

export interface CatalogAdapterOptions {
  /** Absolute path to the JSON dataset. */
  databasePath: string;
  /** ID of the synthetic catalog root (PRD-704-R2 root subtree carrier). */
  catalogRootId?: string;
}

const DEFAULT_ROOT_ID = 'catalog' as const;

/** Naive whitespace token estimator (mirrors @act-spec/markdown-adapter pattern). */
function naiveTokenCount(text: string): number {
  if (text.length === 0) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

function buildProductNode(row: ProductRow, rootId: string): EmittedNode {
  let specsValue: unknown;
  try {
    specsValue = JSON.parse(row.specs_json);
  } catch (err) {
    throw new Error(
      `PRD-704-R6: product ${row.sku} has malformed specs_json (${(err as Error).message}); regenerate the corpus`,
    );
  }
  // PRD-704-R7 vs amendments-queue.md A5 / A18 — PRD-704 prescribes
  // `related: string[]` while the post-A5 node schema requires
  // `related: [{id, relation}]`. The example follows the schema (the
  // wire-level contract; PRD-102-R18 is the more specific recent spec)
  // and emits `relation: "see-also"` for cross-sell links. PRD-704-R7's
  // array-of-strings shape is a known PRD vs schema gap (filed as A18).
  const related = row.related_skus
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 8)
    .map((id) => ({ id, relation: 'see-also' as const }));
  const tags = row.tags
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // PRD-704-R6 — exactly two blocks, in this order, both extracted_via=adapter.
  const content = [
    {
      type: 'prose' as const,
      format: 'markdown' as const,
      text: row.description_md,
      metadata: { extracted_via: 'adapter' as const },
    },
    {
      type: 'data' as const,
      format: 'json' as const,
      text: row.specs_json,
      value: specsValue,
      metadata: { extracted_via: 'adapter' as const },
    },
  ];

  // PRD-704-R11 / amendments-queue.md A18 — pre-compute token counts in the
  // adapter (framework tokenizer is not implemented in v0.1 generator-core).
  const summaryTokens = naiveTokenCount(row.summary);
  const bodyTokens =
    naiveTokenCount(row.description_md) + naiveTokenCount(row.specs_json);

  // PRD-103 — etag is a placeholder; runPipeline recomputes deterministically
  // from the canonical envelope (pipeline.ts § "PRD-400-R8 — recompute ETags").
  const etagPlaceholder = 's256:AAAAAAAAAAAAAAAAAAAAAA' as const;

  return {
    act_version: '0.1',
    id: row.sku,
    type: 'product',
    title: row.name,
    summary: row.summary,
    summary_source: 'author', // PRD-100-R23 — DB-supplied row.summary is author-written.
    parent: rootId,
    etag: etagPlaceholder,
    tokens: { summary: summaryTokens, body: bodyTokens },
    content,
    related,
    metadata: {
      schema_org_type: 'Product',
      tags,
      source: { adapter: 'act-catalog', source_id: row.sku },
    },
  } as EmittedNode;
}

function buildCatalogRootNode(rootId: string, productCount: number): EmittedNode {
  const summary =
    'Acme Catalog — root index of every product node enumerated by the act-catalog programmatic adapter.';
  const intro = [
    '# Acme Catalog',
    '',
    `This synthetic root node is the parent of every product in the catalog (${productCount} SKUs at v0.1).`,
    '',
    'It exists so the build emits exactly one root subtree per PRD-704-R2 (Standard requires subtree availability per PRD-107-R8) without forcing 500 separate subtree files (one per top-level product). Categories are not first-class nodes in this example — see PRD-704 §"Open questions" #3.',
  ].join('\n');
  const summaryTokens = naiveTokenCount(summary);
  const bodyTokens = naiveTokenCount(intro);
  return {
    act_version: '0.1',
    id: rootId,
    type: 'index',
    title: 'Acme Catalog',
    summary,
    etag: 's256:AAAAAAAAAAAAAAAAAAAAAA',
    tokens: { summary: summaryTokens, body: bodyTokens },
    content: [
      {
        type: 'prose' as const,
        format: 'markdown' as const,
        text: intro,
        metadata: { extracted_via: 'adapter' as const },
      },
    ],
    metadata: {
      source: { adapter: 'act-catalog', source_id: rootId },
    },
  } as EmittedNode;
}

interface CorpusItem {
  kind: 'root' | 'product';
  row?: ProductRow;
}

/** Adapter capabilities per PRD-704-R8 #8. */
export const CATALOG_CAPABILITIES: AdapterCapabilities = {
  level: 'standard',
  precedence: 'primary',
  concurrency_max: 8,
  namespace_ids: false,
  manifestCapabilities: { etag: true, subtree: true },
};

/**
 * PRD-704-R8 — factory entry. `defineProgrammaticAdapter` returns a
 * PRD-200-conformant Adapter; the build script feeds it to
 * `runPipeline` from `@act-spec/generator-core`.
 */
export function createCatalogAdapter(opts: CatalogAdapterOptions) {
  const rootId = opts.catalogRootId ?? DEFAULT_ROOT_ID;
  let cachedRows: ProductRow[] | undefined;

  async function loadRows(): Promise<ProductRow[]> {
    if (cachedRows) return cachedRows;
    const raw = await fs.readFile(opts.databasePath, 'utf8');
    const parsed = JSON.parse(raw) as ProductRow[];
    if (!Array.isArray(parsed)) {
      throw new Error(
        `PRD-704-R8: ${opts.databasePath} did not contain a JSON array of product rows`,
      );
    }
    // PRD-704-R8 #6 — sort by sku ASC; promotes PRD-208-R6 SHOULD to MUST
    // for this example. Keep the sort here so an operator who hand-edits
    // the file out-of-order still gets deterministic emission.
    cachedRows = [...parsed].sort((a, b) => a.sku.localeCompare(b.sku));
    return cachedRows;
  }

  return defineProgrammaticAdapter<Record<string, unknown>, CorpusItem>({
    name: 'act-catalog',
    namespaceIds: false,
    validate: 'before-emit',
    strict: true,
    capabilities: CATALOG_CAPABILITIES,

    async *enumerate() {
      const rows = await loadRows();
      // Synthetic root first so the index lists it adjacent to its children;
      // emission order is deterministic regardless.
      yield { kind: 'root' };
      for (const row of rows) yield { kind: 'product', row };
    },

    transform(item) {
      if (item.kind === 'root') return buildCatalogRootNode(rootId, (cachedRows ?? []).length);
      // The non-null assertion is safe because `kind: 'product'` is always
      // emitted with a `row` (see enumerate() above).
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return buildProductNode(item.row!, rootId);
    },
  });
}

export const CATALOG_ROOT_ID = DEFAULT_ROOT_ID;
