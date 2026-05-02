/**
 * PRD-201 markdown-adapter tests. Every requirement R1–R28 has at least one
 * citing test. The fixture corpus at `test-fixtures/sample-tree/` is
 * exercised end-to-end here and via `conformance.ts`.
 */
import { describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ID_GRAMMAR,
  bodyToBlocks,
  createMarkdownAdapter,
  deriveDefaultId,
  extractSummary,
  listFiles,
  parseFrontmatter,
  parseTomlSubset,
  truncateSummary,
  validateId,
} from './markdown.js';
import { runAdapter, type AdapterContext } from './framework.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.resolve(here, '..', 'test-fixtures', 'sample-tree');

const noopLogger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

function ctx(over: Partial<AdapterContext> = {}): AdapterContext {
  return {
    config: { sourceDir: fixtureDir },
    targetLevel: 'core',
    actVersion: '0.1',
    logger: noopLogger,
    signal: new AbortController().signal,
    state: {},
    ...over,
  };
}

describe('PRD-201 markdown adapter', () => {
  it('PRD-201-R1: default export satisfies Adapter; name === "act-markdown"', () => {
    const a = createMarkdownAdapter();
    expect(a.name).toBe('act-markdown');
  });

  it('PRD-201-R2: precheck rejects config without sourceDir', () => {
    const a = createMarkdownAdapter();
    expect(() => a.precheck!({})).toThrow(/PRD-201-R2/);
  });

  it('PRD-201-R3: parseFrontmatter recognizes YAML (---) and TOML (+++); mismatch in explicit mode is unrecoverable', () => {
    const yaml = parseFrontmatter('---\ntitle: hi\n---\nbody', 'auto');
    expect(yaml.format).toBe('yaml');
    expect(yaml.data['title']).toBe('hi');
    const toml = parseFrontmatter('+++\ntitle = "hi"\n+++\nbody', 'auto');
    expect(toml.format).toBe('toml');
    expect(toml.data['title']).toBe('hi');
    expect(() => parseFrontmatter('---\nx: 1\n---\n', 'toml')).toThrow(/PRD-201-R3/);
  });

  it('PRD-201-R4: recognized frontmatter keys map to envelope fields; related-string upgrades to {id, relation}', async () => {
    const a = createMarkdownAdapter();
    const c = ctx();
    await a.init(c.config, c);
    const items: Array<{ relPath: string }> = [];
    for await (const it of a.enumerate(c)) items.push(it);
    const deploy = items.find((i) => i.relPath === 'guides/deployment.md');
    expect(deploy).toBeDefined();
    const node = await a.transform(deploy as never, c);
    expect(node!.related).toEqual([{ id: 'guides/getting-started', relation: 'see-also' }]);
    await a.dispose(c);
  });

  it('PRD-201-R5: unrecognized frontmatter keys preserved on metadata verbatim', async () => {
    const tmpDir = await fs.mkdtemp(path.join(here, '..', 'test-tmp-r5-'));
    try {
      await fs.writeFile(
        path.join(tmpDir, 'a.md'),
        '---\ntitle: t\nauthor: Jane Doe\n---\nbody',
      );
      const a = createMarkdownAdapter();
      const c = ctx({ config: { sourceDir: tmpDir } });
      const r = await runAdapter(a, c.config, c);
      const meta = r.nodes[0]!.metadata as Record<string, unknown>;
      expect(meta['author']).toBe('Jane Doe');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('PRD-201-R6: reserved metadata keys in frontmatter are unrecoverable', async () => {
    const tmpDir = await fs.mkdtemp(path.join(here, '..', 'test-tmp-r6-'));
    try {
      await fs.writeFile(
        path.join(tmpDir, 'a.md'),
        '---\ntitle: t\nmetadata:\n  source:\n    adapter: spoofed\n---\nbody',
      );
      const a = createMarkdownAdapter();
      const c = ctx({ config: { sourceDir: tmpDir } });
      await expect(runAdapter(a, c.config, c)).rejects.toThrow(/PRD-201-R6/);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('PRD-201-R7: within-adapter ID collision is detectable via mergeRuns / runAdapter outputs', async () => {
    // Two files that collapse to the same path-derived ID via the index-collapse rule:
    const tmpDir = await fs.mkdtemp(path.join(here, '..', 'test-tmp-r7-'));
    try {
      await fs.mkdir(path.join(tmpDir, 'docs'));
      await fs.writeFile(path.join(tmpDir, 'docs', 'index.md'), '---\ntitle: A\n---\nbody');
      await fs.writeFile(path.join(tmpDir, 'docs.md'), '---\nid: docs\ntitle: B\n---\nbody');
      const a = createMarkdownAdapter();
      const c = ctx({ config: { sourceDir: tmpDir } });
      const r = await runAdapter(a, c.config, c);
      // Both yield the id "docs" — within-adapter collision; the framework surfaces both,
      // and the duplicate is observable to the caller (PRD-201-R7 is the per-leaf check;
      // we assert the duplicate IDs are present so a generator can flag).
      const ids = r.nodes.map((n) => n.id);
      expect(ids.filter((i) => i === 'docs').length).toBe(2);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('PRD-201-R8: path-derived default ID strips ext, collapses /index, lowercases', () => {
    expect(deriveDefaultId('docs/intro/getting-started.md', 'md')).toBe('docs/intro/getting-started');
    expect(deriveDefaultId('docs/intro/index.md', 'md')).toBe('docs/intro');
    expect(deriveDefaultId('Index.md', 'md')).toBe('');
    expect(deriveDefaultId('a/b/MIXED.md', 'md', 'a/')).toBe('b/mixed');
  });

  it('PRD-201-R9: frontmatter id wins over path-derived default', async () => {
    const a = createMarkdownAdapter();
    const c = ctx();
    const r = await runAdapter(a, c.config, c);
    const ids = r.nodes.map((n) => n.id);
    expect(ids).toContain('guides/deploy'); // overridden via frontmatter `id: guides/deploy`
    expect(ids).not.toContain('guides/deployment'); // path-derived default suppressed
  });

  it('PRD-201-R10: idStrategy.namespace prepends and stripPrefix removes', async () => {
    const a = createMarkdownAdapter();
    const c = ctx({
      config: { sourceDir: fixtureDir, idStrategy: { namespace: 'site', stripPrefix: '' } },
    });
    const r = await runAdapter(a, c.config, c);
    expect(r.nodes.every((n) => n.id.startsWith('site/') || n.id === 'site' || n.id === 'guides/deploy')).toBe(true);
  });

  it('PRD-201-R11: enumerate yield order is deterministic and lexicographic (Intl.Collator)', async () => {
    const a = createMarkdownAdapter();
    const c = ctx();
    await a.init(c.config, c);
    const order: string[] = [];
    for await (const it of a.enumerate(c)) order.push(it.relPath);
    const sorted = [...order].sort((x, y) => new Intl.Collator(undefined, { sensitivity: 'base', numeric: true }).compare(x, y));
    expect(order).toEqual(sorted);
    await a.dispose(c);
  });

  it('PRD-201-R12 coarse: emits exactly one markdown block per file (default)', async () => {
    const a = createMarkdownAdapter();
    const c = ctx();
    const r = await runAdapter(a, c.config, c);
    for (const n of r.nodes) {
      const md = (n.content as Array<{ type: string }>).filter((b) => b.type === 'markdown');
      expect(md.length).toBe(1);
    }
  });

  it('PRD-201-R12 fine: splits body into prose/code/data/callout per construct', () => {
    const body = '# Title\n\nIntro paragraph.\n\n```ts\nconst x = 1;\n```\n\n> [!NOTE]\n> Heads up.\n\n```yaml\nkey: value\n```';
    const out = bodyToBlocks(body, 'md', 'fine', 'standard');
    const types = out.blocks.map((b) => b.type);
    expect(types).toContain('prose');
    expect(types).toContain('code');
    expect(types).toContain('data');
    expect(types).toContain('callout');
  });

  it('PRD-201-R13: fenced code block info string drives code vs data block selection', () => {
    const out = bodyToBlocks('```json\n{"a":1}\n```', 'md', 'fine', 'standard');
    expect(out.blocks[0]).toMatchObject({ type: 'data', format: 'json' });
    const out2 = bodyToBlocks('```ts\nconst x=1;\n```', 'md', 'fine', 'standard');
    expect(out2.blocks[0]).toMatchObject({ type: 'code', language: 'ts' });
  });

  it('PRD-201-R14: GFM-alert and ::: admonition both map to callout with mapped level', () => {
    const gfm = bodyToBlocks('> [!WARNING]\n> Hot stove.', 'md', 'fine', 'standard');
    const cal = gfm.blocks.find((b) => b.type === 'callout');
    expect(cal).toMatchObject({ level: 'warning' });
    const adm = bodyToBlocks(':::tip\nUse sharp knives.\n:::', 'md', 'fine', 'standard');
    const cal2 = adm.blocks.find((b) => b.type === 'callout');
    expect(cal2).toMatchObject({ level: 'info' });
  });

  it('PRD-201-R15: MDX uppercase JSX components emit marketing:placeholder when target=plus', () => {
    const out = bodyToBlocks('Some text\n\n<Hero title="Hi" count={3} />\n\nMore text', 'mdx', 'coarse', 'plus');
    const ph = out.blocks.find((b) => b.type === 'marketing:placeholder');
    expect(ph).toBeDefined();
    const meta = (ph as Record<string, unknown>)['metadata'] as Record<string, unknown>;
    expect(meta['component']).toBe('Hero');
    expect(meta['extraction_status']).toBe('partial');
  });

  it('PRD-201-R16: block order in content matches source render order', () => {
    const body = '# Header\n\nFirst paragraph.\n\n```js\ncode();\n```\n\nSecond paragraph.';
    const out = bodyToBlocks(body, 'md', 'fine', 'standard');
    const seq = out.blocks.map((b) => b.type).join(',');
    expect(seq).toBe('prose,prose,code,prose');
  });

  it('PRD-201-R17: frontmatter summary wins; otherwise extracted', async () => {
    const a = createMarkdownAdapter();
    const c = ctx();
    const r = await runAdapter(a, c.config, c);
    const start = r.nodes.find((n) => n.id === 'guides/getting-started');
    expect(start!.summary).toMatch(/60-second tour/);
    expect(start!.summary_source).toBe('author');
    const home = r.nodes.find((n) => n.id === 'index');
    expect(home?.summary_source).toBe('extracted');
  });

  it('PRD-201-R18: extractSummary skips frontmatter / comments / headings; takes first paragraph', () => {
    const body = '<!-- a comment -->\n\n# Title\n\nThe summary paragraph here.\n\nNot included.';
    expect(extractSummary(body)).toBe('The summary paragraph here.');
  });

  it('PRD-201-R19: truncateSummary caps at 50 tokens with ellipsis', () => {
    const long = Array.from({ length: 80 }, (_, i) => `w${i}`).join(' ');
    const out = truncateSummary(long);
    expect(out.tokens).toBe(50);
    expect(out.text.endsWith('…')).toBe(true);
  });

  it('PRD-201-R20: summary_source: "extracted" when fallback used; "author" when frontmatter summary supplied', async () => {
    const a = createMarkdownAdapter();
    const c = ctx();
    const r = await runAdapter(a, c.config, c);
    const cli = r.nodes.find((n) => n.id === 'reference/cli');
    expect(cli!.summary_source).toBe('extracted');
  });

  it('PRD-201-R21: delta yields only files modified since the marker', async () => {
    const tmpDir = await fs.mkdtemp(path.join(here, '..', 'test-tmp-r21-'));
    try {
      await fs.writeFile(path.join(tmpDir, 'old.md'), '---\ntitle: old\n---\nbody');
      // Wait so the new file's mtime is after the marker.
      await new Promise((r) => setTimeout(r, 50));
      const marker = new Date().toISOString();
      await new Promise((r) => setTimeout(r, 50));
      await fs.writeFile(path.join(tmpDir, 'new.md'), '---\ntitle: new\n---\nbody');

      const a = createMarkdownAdapter();
      const c = ctx({ config: { sourceDir: tmpDir } });
      await a.init(c.config, c);
      const seen: string[] = [];
      for await (const it of a.delta!(marker, c)) seen.push(it.relPath);
      expect(seen).toEqual(['new.md']);
      await a.dispose(c);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('PRD-201-R22: AdapterCapabilities returned from init has required level field', async () => {
    const a = createMarkdownAdapter();
    const c = ctx();
    const caps = await a.init(c.config, c);
    expect(caps.level).toBeDefined();
    expect(['core', 'standard', 'plus']).toContain(caps.level);
    await a.dispose(c);
  });

  it('PRD-201-R23: MDX inputs at non-Plus target are unrecoverable', () => {
    expect(() => bodyToBlocks('<Hero/>', 'mdx', 'coarse', 'core')).toThrow(/PRD-201-R23/);
  });

  it('PRD-201-R24: empty-body file emits a node with extraction_status: "partial"', async () => {
    const tmpDir = await fs.mkdtemp(path.join(here, '..', 'test-tmp-r24-'));
    try {
      await fs.writeFile(path.join(tmpDir, 'empty.md'), '---\ntitle: empty\n---\n');
      const a = createMarkdownAdapter();
      const c = ctx({ config: { sourceDir: tmpDir } });
      const r = await runAdapter(a, c.config, c);
      const meta = r.nodes[0]!.metadata as Record<string, unknown>;
      expect(meta['extraction_status']).toBe('partial');
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('PRD-201-R25: malformed frontmatter (e.g., reserved key) throws unrecoverable', async () => {
    const tmpDir = await fs.mkdtemp(path.join(here, '..', 'test-tmp-r25-'));
    try {
      await fs.writeFile(
        path.join(tmpDir, 'a.md'),
        '---\nsummary_source: author\n---\nbody',
      );
      const a = createMarkdownAdapter();
      const c = ctx({ config: { sourceDir: tmpDir } });
      await expect(runAdapter(a, c.config, c)).rejects.toThrow(/PRD-201-R20/);
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('PRD-201-R26: every emitted node carries metadata.source.{adapter,source_id,source_path}', async () => {
    const a = createMarkdownAdapter();
    const c = ctx();
    const r = await runAdapter(a, c.config, c);
    for (const n of r.nodes) {
      const meta = n.metadata as Record<string, unknown>;
      const src = meta['source'] as Record<string, unknown>;
      expect(src['adapter']).toBe('act-markdown');
      expect(typeof src['source_id']).toBe('string');
      expect(typeof src['source_path']).toBe('string');
    }
  });

  it('PRD-201-R27: emitted envelopes have act_version === "0.1" (Stage 1 pin)', async () => {
    const a = createMarkdownAdapter();
    const c = ctx();
    const r = await runAdapter(a, c.config, c);
    for (const n of r.nodes) expect(n.act_version).toBe('0.1');
  });

  it('PRD-201-R28: every node validates against PRD-100-R21 (id grammar, required fields)', async () => {
    const a = createMarkdownAdapter();
    const c = ctx();
    const r = await runAdapter(a, c.config, c);
    for (const n of r.nodes) {
      expect(validateId(n.id)).toBe(true);
      expect(typeof n.title).toBe('string');
      expect(typeof n.summary).toBe('string');
      expect(Array.isArray(n.content)).toBe(true);
      expect(n.tokens.summary).toBeGreaterThanOrEqual(0);
    }
  });

  it('listFiles + parseTomlSubset cover support paths exercised by PRD-201-R3 / R11', async () => {
    const items = await listFiles(fixtureDir, ['**/*.md', '**/*.mdx'], []);
    expect(items.length).toBeGreaterThan(3);
    const parsed = parseTomlSubset('a = "x"\nb = 1\nc = true\nd = [1, 2]\n# comment');
    expect(parsed).toEqual({ a: 'x', b: 1, c: true, d: [1, 2] });
  });

  it('ID_GRAMMAR admits PRD-100-R10 + PRD-102-R29 variant suffix', () => {
    expect(ID_GRAMMAR.test('docs/intro')).toBe(true);
    expect(ID_GRAMMAR.test('pricing@enterprise-2026q2')).toBe(true);
    expect(ID_GRAMMAR.test('UPPER')).toBe(false);
  });
});
