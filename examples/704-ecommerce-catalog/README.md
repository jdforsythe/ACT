# PRD-704 — E-commerce Catalog (programmatic adapter)

The TypeScript reference example for [PRD-704](../../prd/704-ecommerce-catalog.md):
a 500-SKU product catalog emitted via [`@act-spec/programmatic-adapter`](../../packages/programmatic-adapter)
(PRD-208) and [`@act-spec/generator-core`](../../packages/generator-core)'s
`runPipeline` (PRD-400). Validates clean against
[`@act-spec/validator`](../../packages/validator) (PRD-600) at the
**Standard** conformance band.

## Corpus shape

- `data/products.json` — deterministic 500-SKU dataset, sorted by SKU
  (PRD-704-R8 promotes PRD-208-R6's deterministic-enumerate SHOULD to a
  MUST). Regenerate with `pnpm regen-corpus`.
- One synthetic root node, id `catalog` (`type: "index"`), is the parent
  of every product. It exists so the build emits exactly **one** root
  subtree per PRD-704-R2 instead of one subtree per top-level product.
  The synthetic root is not a SKU and is not counted against PRD-704-R3's
  500-2000 envelope.
- 500 product nodes, each `parent: "catalog"`, satisfying PRD-704-R5
  (`type: "product"`, `metadata.schema_org_type: "Product"`,
  `id: "sku-{NNNNNN}"`), PRD-704-R6 (exactly two blocks: a `prose`
  description in markdown + a `data` specs block in JSON), PRD-704-R7
  (`related[]` capped at 8 within-category cross-sells), and PRD-704-R9
  (`metadata.source.adapter: "act-catalog"`).

Total emitted ACT nodes: **501** (1 synthetic root + 500 products);
product count is squarely inside PRD-704-R3's 500-2000 envelope.

## Build and validate

```sh
pnpm -F @act-spec/example-704-ecommerce-catalog conformance
```

This runs `pnpm build` (`scripts/build.ts` → `runPipeline` + `emitFiles`
into `out/`) followed by `pnpm validate` (`scripts/validate.ts`, which
walks `out/` through `@act-spec/validator`'s `walkStatic` and asserts
the PRD-704-R15 acceptance shape).

Expected output (truncated):

```
[act] enumerate + transform via @act-spec/programmatic-adapter
[act] pipeline emitted 501 node(s) + 1 subtree(s); achieved level: standard
[act] wrote 504 file(s) to .../out in <N>ms
[act] achieved.level: standard

PRD-704 conformance — 501 node files (500 products), 1 subtree file(s).
  declared:  standard / static
  achieved:  standard / static
  gaps:      0
  warnings:  0

PRD-704 conformance: OK — gaps: 0; declared.level: standard; achieved.level: standard; delivery: static; products: 500; root subtree: catalog.
```

## File layout

```
out/
├─ .well-known/act.json          (manifest; declares Standard, advertises
│                                 etag + subtree capabilities)
├─ act/
│  ├─ index.json                 (501 entries)
│  ├─ nodes/
│  │  ├─ catalog.json            (synthetic root)
│  │  └─ sku-NNNNNN.json         (× 500)
│  └─ subtrees/
│     └─ catalog.json            (the one root subtree, depth 3)
└─ .act-build-report.json        (PRD-400-R27 sidecar)
```

The manifest's URL templates use the PRD-704-R4 wire-shape
(`/act/n/{id}.json`, `/act/sub/{id}.json`); the on-disk emission paths
use generator-core's `act/nodes/` and `act/subtrees/` (a known, filed
discrepancy — see `docs/amendments-queue.md` A18).

## Notable PRD-704 deviations (filed)

- **A18 — PRD-704-R2 / R11 vs generator-core reality.**
  - PRD-704-R2 enumerates the on-disk paths `out/act/n/<id>.json` and
    `out/act/sub/<id>.json`; `generator-core/emitFiles` writes under
    `act/nodes/` and `act/subtrees/`. The manifest URL templates honor
    the PRD's wire-shape so wire-level conformance is preserved; only
    the literal on-disk paths in PRD-704-R2 differ.
  - PRD-704-R11 says "tokens MUST be populated by the framework's
    tokenizer (default `tiktoken-cl100k`)"; v0.1 generator-core ships
    no built-in tokenizer (PRD-201's markdown adapter computes tokens
    locally with a naive whitespace tokenizer). The example mirrors
    that pattern in its programmatic adapter — operationally identical
    at the wire level, but the responsibility currently lives in the
    adapter, not the framework.

## Scripts

- `pnpm regen-corpus` — re-roll `data/products.json` deterministically
  (LCG-seeded; same seed → byte-equivalent output).
- `pnpm build` — invoke `runPipeline` + `emitFiles` against the catalog
  adapter; writes `out/`.
- `pnpm validate` — run `walkStatic` over `out/` and assert the
  PRD-704-R15 acceptance shape.
- `pnpm conformance` — `build` then `validate`.
- `pnpm typecheck` — `tsc --noEmit` over `scripts/` and `src/`.
