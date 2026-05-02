# PRD-707 — Tinybox Blog (Eleventy + markdown)

The TS-implementation reference example for [PRD-707](../../prd/707-blog-eleventy.md):
a flat chronological Eleventy 2.x blog that wires
[`@act-spec/eleventy`](../../packages/eleventy) (PRD-408) +
[`@act-spec/markdown-adapter`](../../packages/markdown-adapter) (PRD-201)
and validates clean against [`@act-spec/validator`](../../packages/validator)
(PRD-600) at the **Standard** conformance band.

## Corpus shape

- `index.md` — landing page (root node, id `index`).
- `about.md` — about page (root node, id `about`).
- `posts.md` — synthetic chronological-index parent (root node,
  id `posts`, type `index`) per PRD-707-R6. The frontmatter `children`
  array enumerates the 30 published post IDs in reverse-chronological
  order.
- `posts/YYYY-MM-DD-slug.md` — 30 published posts, each `parent: posts`,
  spanning April through September 2026.
- `posts/2026-06-01-draft-deep-dive.md` — one draft post with
  `permalink: false`. PRD-408-R6's permalink filter drops it from ACT
  emission per PRD-707-R7; the validator gate asserts its absence
  from `act/index.json` and `act/nodes/`.

Total emitted ACT nodes: **33** (within PRD-707-R3's 30-100 envelope).
Frontmatter-summary distribution: **28 `author`** / **2 `extracted`**
(PRD-707-R10 requires ≥80% `author` and ≥1 `extracted`).

## Build and validate

```sh
pnpm -F @act-spec/example-707-eleventy-blog conformance
```

This runs `pnpm build` (Eleventy CLI → `_site/`) followed by
`pnpm validate` (`scripts/validate.ts`, which walks `_site/` through
`@act-spec/validator`'s `walkStatic` and asserts the PRD-707 acceptance
shape).

Expected output:

```
PRD-707 conformance: OK -- gaps: 0; declared.level: standard; achieved.level: standard; delivery: static; synthetic posts subtree: present; draft excluded.
```

## Wire-format paths

The manifest URL templates advertise `/act/index.json`,
`/act/n/{id}.json`, and `/act/sub/{id}.json` per PRD-707-R11. The
on-disk emission paths under `_site/` are `act/index.json`,
`act/nodes/<id>.json`, and `act/subtrees/<id>.json` per
`@act-spec/generator-core`'s `emitFiles`. Static-walk validation does
not dereference URLs in `walkStatic`, so the manifest-vs-disk path
divergence is benign in v0.1.

## Out of scope (per PRD-707 § Non-goals)

Component bindings (PRD-408-R10 forbids them; the negative case is
exercised by the `@act-spec/eleventy` test suite), MDX, i18n, NDJSON,
search, and RSS/Atom feed parity.
