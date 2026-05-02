# PRD-704 — E-commerce catalog (programmatic adapter)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

E-commerce is the canonical case where ACT's content tree is sourced not from a CMS or a markdown tree but from an internal product catalog — usually a database, a PIM (Product Information Management) system, or an ERP export. None of the v0.1 first-party adapters fit: PRD-201 (markdown) wants files; PRD-202–PRD-206 want named CMS APIs; PRD-207 wants message catalogs. The v0.1 spec's escape hatch is PRD-208 (programmatic adapter): a TypeScript factory operators wire to whatever data source they have, exposing `enumerate` and `transform` functions and inheriting framework guarantees (validation, atomic writes, ETag derivation, level reporting).

PRD-704 is the canonical example of that pattern. The v0.1 working draft §8.3 sketches the shape: each product is a node of `type: product`; `metadata.schema_org_type` is `"Product"`; the body carries descriptions plus a `data` block for specs; cross-sell relationships are encoded via `related` IDs. The example exists to prove that PRD-208's `defineProgrammaticAdapter` factory plus PRD-100/PRD-102/PRD-103 envelopes are enough — without any CMS adapter — to ship a 500–2000-SKU catalog as ACT.

PRD-705 (B2B SaaS workspace) is the runtime sibling of this static example. PRD-704 is **static-export only**; an operator who wants a runtime catalog endpoint pairs PRD-208 with PRD-501 (Next.js runtime SDK) instead. PRD-704 deliberately stays at the smaller surface so operators can read it as "the simplest possible programmatic build."

### Site description

- **Stack.** TypeScript build script (`@act/cli` per PRD-409, or any Node.js entry point) invoking PRD-400's `runPipeline` with one PRD-208 programmatic adapter. No Next.js, no Astro, no React; the example is intentionally framework-agnostic.
- **Content source.** A products table (the example uses a SQLite snapshot for reproducibility; operators substitute their own DB, PIM, or JSON export).
- **Catalog scale.** The example fixture ships 500 SKUs. The PRD documents that the same shape scales to 2000+ SKUs without change; performance characteristics are governed by PRD-200 (concurrency, backpressure) and PRD-208 (the factory does not introduce overhead beyond per-node validation).
- **Locales.** Single locale (`en-US`). The example does not exercise i18n; operators with multi-locale catalogs add PRD-207 or run the programmatic adapter once per locale.
- **Body content per node.** Description (a `prose` block in `format: "markdown"`) plus a `data` block carrying structured specs (dimensions, weight, certifications) in `format: "json"` per PRD-102-R4. Optional images live in `metadata.image_url` (opaque to ACT).
- **Cross-sell.** Each product carries `related[]` with up to 8 sibling product IDs (the example uses category-mate cross-sell). Categories are not first-class nodes in this example — categories are encoded as taxonomy tags on `metadata.tags[]`.
- **Search.** Not exercised. The example targets Standard, not Plus; operators wanting search advertise it via PRD-409's CLI flag and a separate prerendered payload (out of scope here).

### Goals

1. Publish a runnable PRD-208-based reference whose build produces an ACT tree that PRD-600 certifies as **Standard**.
2. Demonstrate the canonical product-node shape from v0.1 draft §8.3: `type: "product"`, `metadata.schema_org_type: "Product"`, body with `prose` description + `data` specs block, `related[]` cross-sell.
3. Exercise PRD-208's factory contract end-to-end: `defineProgrammaticAdapter` with user-supplied `enumerate` / `transform`, factory-supplied validation (PRD-208-R3), source attribution (PRD-208-R9), and namespace handling (PRD-208-R7).
4. Show `data`-block taxonomy as the primary structured-data carrier (vs. `marketing:*` blocks, which the example does not use). PRD-102-R4 (`data` block) is the load-bearing block type.
5. Provide concrete file-by-file emission expectations for a 500-SKU catalog, including ETag derivation per PRD-103.
6. Provide a sample `act.config.ts`, a sample programmatic-adapter spec, and a tiny SQLite schema — enough to anchor the build, not a full storefront implementation.

### Non-goals

1. **Storefront UI.** The example is data-only; PRD-704 ships no React, no Astro, no HTML.
2. **Runtime catalog endpoint.** Owned by PRD-705 + PRD-501.
3. **Multi-locale catalog.** Operators add PRD-207 or fan out the programmatic adapter; PRD-704 stays single-locale.
4. **Search.** Out of scope; would push the example to Plus.
5. **Inventory / stock tracking.** ACT is content; inventory is operational state. `metadata.in_stock` is OPTIONAL and ADVISORY; PRD-704 does not mandate it.
6. **Pricing currency negotiation.** The example pins a single currency (USD); operators with multi-currency catalogs MAY add `metadata.price_currencies[]` but PRD-704 does not specify the shape.
7. **Defining the programmatic adapter factory.** Owned by PRD-208.
8. **Defining schema.org integration.** PRD-100 owns `metadata.schema_org_type`; PRD-704 only consumes the field.

### Stakeholders / audience

- **Authors of:** e-commerce operators evaluating ACT for a non-CMS, DB-backed catalog; PRD-208 implementers needing a high-volume integration test; PRD-600 implementers needing a Standard-band end-to-end fixture without `marketing:*` or i18n.
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Operators conflate the example's `data` block taxonomy with `marketing:*` blocks and overshoot to Plus unnecessarily. | Medium | Low | PRD-704-R1 declares Standard explicitly; PRD-704-R6 forbids `marketing:*` blocks in the example's emission set. |
| The 500-SKU sample blows past PRD-600's default validation budget when run via `npx @act/validator`. | Low | Medium | PRD-600 owns validator scalability; PRD-704 documents the catalog size and notes that operators with 5000+ SKUs SHOULD run validation in CI with extended budget per PRD-600 guidance. |
| User-supplied `enumerate` is non-deterministic across builds (DB ORDER BY default), producing fixture instability. | High | Medium | PRD-704-R8 mandates `ORDER BY sku ASC` (or equivalent) in the example's `enumerate`. PRD-208-R6 documents the SHOULD; PRD-704 promotes it to MUST for the example. |
| `metadata.schema_org_type` drift — operators emit `"Product"` vs `"product"` vs `"https://schema.org/Product"`. | Medium | Low | PRD-704-R5 pins the value to `"Product"` (PascalCase, bare term) per schema.org convention; PRD-100-R-schema-org-type owns the field grammar. |
| `data` block payload size for spec-heavy products (e.g., complex industrial equipment) inflates token counts past PRD-100's per-node `tokens.body` SHOULD threshold. | Medium | Low | PRD-704-R10 documents that `tokens.body` reflects actual size; operators with very large spec sheets SHOULD consider subtree emission (PRD-100 owns the threshold). |
| Cross-sell `related[]` produces cycles (A → B → A). PRD-100 tolerates cycles in `related`; some consumers may not. | Low | Low | PRD-704-R9 documents that cycles are permitted; the example's data has none, but the spec doesn't forbid them. PRD-100 owns the rule. |
| The example's user-supplied `transform` emits IDs that collide after PRD-208's namespace prefix is applied (`programmatic/sku-001`). | Low | Medium | PRD-704-R7 sets `namespaceIds: false` and pins SKU as the bare ID; the example's SKUs are guaranteed unique by the source DB. PRD-208-R7's collision detection still applies. |

### Open questions

1. **Should the example exercise progressive disclosure (subtree emission) on category roots, even though there are no first-class category nodes?** Tentatively: no — categories are tags in this example; subtree emission requires nodes. An operator forking the example with first-class category nodes would emit subtrees naturally. Confirmed: example stays at Standard without subtree emission. (See PRD-704-R1 justification.)
2. **Does PRD-208's factory correctly handle the `data` block when `validate: "before-emit"` is set?** PRD-208-R3 cites `schemas/100/node.schema.json`; PRD-102-R4's `data` block schema lives separately. **The example's tests verify that PRD-208's pre-emit validation catches a misshaped `data` block; if it does not, this is a PRD-208 ambiguity flagged for v0.2.** PRD-208 is not amended here.
3. **Should `metadata.tags[]` carry taxonomy categorization, or should categories be first-class nodes?** Tentatively: tags. First-class category nodes is a v0.2 catalog pattern (when subtree-of-category becomes useful). PRD-704 stays minimalist.

### Acceptance criteria

- [ ] Status `In review` is set; changelog entry dated 2026-05-02 by Jeremy Forsythe is present.
- [ ] Every normative requirement has an ID `PRD-704-R{n}` and a declared conformance level per PRD-107.
- [ ] The Specification opens with a table mapping cited P2 PRDs to the requirements the example exercises.
- [ ] Every cited P2 PRD (PRD-208, PRD-600) has at least one of its requirements exercised; PRD-100 and PRD-102 envelope/block requirements are also exercised.
- [ ] Conformance target Standard is declared and justified.
- [ ] File-by-file emission expectations are enumerated.
- [ ] Acceptance criteria below include: example builds clean; PRD-600 reports zero errors; reported `achieved` matches declared target; cited-PRD coverage is non-empty.
- [ ] Versioning & compatibility table is present.
- [ ] Security section addresses data-leakage risks (PII in product metadata).

---

## Context & dependencies

### Depends on

- **PRD-100** (Accepted) — wire-format envelopes; `metadata.schema_org_type` field.
- **PRD-102** (Accepted) — content blocks, especially `prose` (PRD-102-R2) and `data` (PRD-102-R4).
- **PRD-103** (Accepted) — ETag derivation.
- **PRD-105** (Accepted) — static delivery profile.
- **PRD-107** (Accepted) — conformance levels; Standard band.
- **PRD-200** (Accepted) — adapter framework.
- **PRD-208** (Accepted) — programmatic adapter (the example's primary integration surface).
- **PRD-400** (Accepted) — generator architecture (the build pipeline this example invokes).
- **PRD-409** (Accepted) — standalone CLI (the example's recommended entry point; operators MAY use `@act/core`'s `runPipeline` directly).
- **PRD-600** (Accepted) — validator and conformance reporter.
- External: [schema.org Product](https://schema.org/Product), [SQLite](https://www.sqlite.org/), [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174).

### Blocks

_Not applicable — examples are leaves of the dependency DAG; no PRD depends on PRD-704 reaching Accepted._

### References

- v0.1 draft: §8.3 (E-commerce catalog).
- PRD-208 §"Examples" — the factory's canonical usage shape.
- Prior art: schema.org `Product` type; OpenGraph product extensions; Shopify Storefront API as a comparable schema.

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords as clarified by RFC 8174.

### Cited-PRD coverage table

| PRD | Requirement(s) exercised | Where in this example |
|---|---|---|
| PRD-100 | R4 (manifest envelope), R6 (capabilities), R10 (ID grammar — SKUs), R21 (envelope schema), `metadata.schema_org_type` field | Every product node carries `metadata.schema_org_type: "Product"`. |
| PRD-102 | R2 (`prose` block), R4 (`data` block — JSON specs), R20 (block metadata) | Every node body has one `prose` description + one `data` specs block. |
| PRD-103 | R-etag-derivation | Every emitted file carries an ETag derived from envelope contents. |
| PRD-105 | R1 (static profile envelope), R7a (static layout), R-subtree-template-when-advertised (subtree section absent — Standard without subtree files for non-navigation nodes is permitted) | All emissions are static; subtree files emitted for the manifest's root only. |
| PRD-107 | R8 (Standard declaration), R11 (additivity from Core) | `conformance.level: "standard"` declared. |
| PRD-200 | R12 (single-source emission, no merge collisions), R13 (`metadata.source`) | Single adapter; no multi-source merge. |
| PRD-208 | R1 (`defineProgrammaticAdapter`), R2 (spec shape), R3 (pre-emit validation), R5 (lifecycle wrappers), R6 (deterministic enumerate — promoted to MUST for this example), R7 (namespacing), R9 (source attribution), R13 (capability declaration), R14 (Stage 1 pinning), R15 (fixture conformance) | The example's adapter is built via the factory. |
| PRD-400 | R1 (canonical pipeline), R23 (atomic writes) | The build invokes `runPipeline` post-source-enumeration. |
| PRD-409 | R-cli-shape | The example invokes `act build` from a Node script. |
| PRD-600 | R-validator-core; reporter `achieved.level === "standard"` | Acceptance criterion (c). |

### Conformance level

This example targets **Standard** (per PRD-107-R8). Justification:

- The example exercises the `data` block (PRD-102-R4, Standard-tier) and `prose` block (PRD-102-R2, Standard-tier).
- The example exercises `related[]` cross-references (PRD-107-R8 includes `related` at Standard).
- The example emits one subtree file (the root subtree), satisfying PRD-107-R8's subtree availability requirement at minimum.
- The example does NOT use `marketing:*` blocks, NDJSON index, search advertisement, or i18n manifest — all of which would push to Plus.

A consumer requiring "minimum Core" is satisfied by additivity (PRD-107-R11). A consumer requiring Plus is NOT satisfied; the validator's reporter MUST report `achieved.level: "standard"`.

Per-requirement conformance bands are annotated inline below.

### Normative requirements

#### Conformance target

**PRD-704-R1.** **(Standard)** A conformant build of this example MUST declare `conformance.level: "standard"` in its manifest. The example MUST NOT advertise Plus capabilities (`index_ndjson_url`, `search_url_template`, `locales` block); operators wishing to upgrade to Plus migrate to a different example or fork PRD-704 with explicit deviations.

#### File-set emission

**PRD-704-R2.** **(Standard)** A conformant build MUST emit, under the configured `outputDir` (typically `out/` or `public/`), the following file set:

- `out/.well-known/act.json` — manifest.
- `out/act/index.json` — index, listing every product node.
- `out/act/n/{sku}.json` — one file per product (~500 SKUs in the example fixture; scales to 2000+).
- `out/act/sub/root.json` — root subtree file (Standard requires subtree availability per PRD-107-R8; the example pins one subtree at the root level enumerating top-level navigation aggregates).
- `./.act-build-report.json` — build report at project root, per PRD-400-R27.

The example MUST NOT emit `index.ndjson`, `search.json`, or any per-locale fan-out files.

**PRD-704-R3.** **(Standard)** Catalog scale of 500–2000 SKUs is the documented operating range. Operators with > 2000 SKUs MAY use the same example shape; PRD-704 makes no explicit performance commitment beyond what PRD-200's concurrency contract delivers. PRD-208-R6's deterministic-enumerate SHOULD (promoted to MUST in PRD-704-R8) keeps fixture stability across runs at any scale.

#### Manifest construction

**PRD-704-R4.** **(Standard)** The manifest MUST declare:

- `act_version: "0.1"`.
- `site.name`: a non-empty string (the example uses `"Acme Catalog"`).
- `delivery: "static"`.
- `conformance.level: "standard"`.
- `index_url: "/act/index.json"`.
- `node_url_template: "/act/n/{id}.json"`.
- `subtree_url_template: "/act/sub/{id}.json"`.
- `capabilities.etag: true`, `capabilities.subtree: true`.

The manifest MUST NOT include `locales`, `index_ndjson_url`, `search_url_template`, or `mounts`. The manifest MUST NOT set `capabilities.ndjson_index` or `capabilities.search.template_advertised`.

#### Product node shape

**PRD-704-R5.** **(Standard)** Every product node MUST satisfy:

- `type: "product"`.
- `metadata.schema_org_type: "Product"` (PascalCase, bare term — NOT `"https://schema.org/Product"`, NOT `"product"`, NOT lowercase). PRD-100 owns the field grammar; PRD-704 pins the value the example emits.
- `id`: the product SKU. SKUs MUST satisfy PRD-100-R10's grammar (lowercase ASCII, hyphens permitted, no slashes). The example's SKUs are of the form `sku-{6-digit-number}` (e.g., `sku-001234`).
- `title`: the product display name.
- `summary`: a 1–2 sentence product summary (≤ 50 tokens per PRD-102's SHOULD).
- `tokens.summary`, `tokens.body`: derived per PRD-100.
- `etag`: derived per PRD-103.

**PRD-704-R6.** **(Standard)** Every product node's `content[]` MUST consist of exactly two blocks, in this order:

1. A `prose` block (PRD-102-R2) carrying the product description in `format: "markdown"`. The block's `text` field carries CommonMark; the block's `metadata.extracted_via` MUST be `"adapter"` (PRD-208-emitted blocks are not component-extracted).
2. A `data` block (PRD-102-R4) carrying structured specs in `format: "json"`. The block's `text` field carries the canonical JSON serialization; the block's `value` field MAY carry the parsed object (PRD-102-R4 permits both, with `text` canonical). The block's `metadata.extracted_via` MUST be `"adapter"`.

The example MUST NOT emit `marketing:*` blocks, `code` blocks, or `callout` blocks. Additional `prose` or `data` blocks MAY be emitted by operators forking the example; the canonical shape is exactly two.

#### Cross-sell

**PRD-704-R7.** **(Standard)** Every product node MAY carry `related: string[]`, a list of sibling product IDs (SKUs) for cross-sell. The example caps `related[]` at 8 entries per node. Cycles are permitted per PRD-100. `related[]` entries MUST refer to products that exist in the same build's index; the framework's merge step (PRD-200-R12) does not enforce this, but PRD-704-R12 promotes it to a build-time check.

#### Adapter shape

**PRD-704-R8.** **(Standard)** The example's programmatic adapter MUST:

- Be constructed via `defineProgrammaticAdapter` per PRD-208-R1.
- Set `name: "act-catalog"` (overriding the factory default `"programmatic"`).
- Set `namespaceIds: false` per PRD-208-R7 (SKUs are globally unique by source-DB constraint; the example accepts responsibility for collision avoidance).
- Set `validate: "before-emit"` (the PRD-208-R3 default; pinned for clarity).
- Set `strict: true` per PRD-208-R10 (production-grade catalogs reject silent partial-emissions).
- Provide a deterministic `enumerate` (e.g., `SELECT * FROM products ORDER BY sku ASC`). Per PRD-208-R6 this is a SHOULD; PRD-704 promotes it to MUST for example reproducibility.
- Provide a `transform` that emits a node satisfying PRD-704-R5 / R6 / R7.
- Declare `AdapterCapabilities` with `level: "standard"`, `precedence: "primary"`, `summarySource: "extracted"`.

#### Source attribution

**PRD-704-R9.** **(Standard)** Every emitted node MUST carry `metadata.source` per PRD-200-R13 / PRD-208-R9 with `metadata.source.adapter: "act-catalog"` and a `metadata.source.source_id` carrying the underlying DB row identifier (typically the SKU itself). Multi-source merging is not exercised; `metadata.source.contributors` MAY be `["act-catalog"]` or omitted (per PRD-200-R13's single-contributor rule).

#### ETag derivation

**PRD-704-R10.** **(Core)** Every emitted file MUST carry an `etag` derived per PRD-103. The example's adapter MUST NOT supply `etag` directly; the framework computes it from the envelope contents per PRD-103-R-etag-derivation. PRD-208's factory does not override this behavior. Operators with stable upstream ETags (e.g., a CMS provides them) MAY substitute via PRD-103's documented escape hatch; the example does not.

#### Token estimation

**PRD-704-R11.** **(Standard)** Every emitted node MUST carry `tokens.summary` and `tokens.body` populated by the framework's tokenizer (default `tiktoken-cl100k` per PRD-400). The adapter MUST NOT supply token counts; the framework computes them post-`transform`. Per PRD-100, `tokens.body` SHOULD reflect the sum of all blocks' rendered token counts including the `data` block's `text` payload.

#### Cross-sell validation

**PRD-704-R12.** **(Standard)** The example's build MUST verify that every `related[]` entry refers to a product enumerated in the same build. Dangling references MUST cause a build warning; the example MAY promote to error via `strict: true` per PRD-208-R10 (the example's default). PRD-100 does not require referential integrity for `related[]`; PRD-704 promotes the check to a build-time discipline because dangling cross-sell links are operationally undesirable.

#### Build pipeline

**PRD-704-R13.** **(Core)** The example's build entry point MUST invoke PRD-400's `runPipeline`, either via `@act/cli` (PRD-409) or via a Node script importing `@act/core`. The example MUST NOT bypass the pipeline. Atomic writes (PRD-400-R23) and post-build validation (PRD-400-R24) apply.

**PRD-704-R14.** **(Core)** The example MUST honor PRD-208-R14's Stage 1 pinning: `act-programmatic@0.1.x`, `@act/core@0.1.x`, `@act/cli@0.1.x` all align on `act_version: "0.1"`.

#### Acceptance criteria for a clean build

**PRD-704-R15.** **(Standard)** A conformant build of this example MUST satisfy all of the following:

- (a) **Builds clean.** `npx @act/cli build` (or the equivalent `runPipeline` invocation) exits with code 0.
- (b) **Validator clean.** `npx @act/validator out/` returns zero errors (PRD-600 reporter `gaps` array is empty).
- (c) **Achieved-level match.** PRD-600 reporter's `achieved.level` equals `"standard"` (PRD-107-R18).
- (d) **Cited-PRD coverage.** Every PRD listed in the cited-PRD coverage table has at least one of its requirements exercised by the build's emitted files.

Operators forking the example MUST re-run validation after any change to the adapter spec or the source data.

#### Inventory and pricing fields

**PRD-704-R16.** **(Standard, advisory)** Operators MAY include `metadata.in_stock: boolean` and `metadata.price: { amount, currency }` on product nodes. PRD-704 does NOT specify the shape; operators forking the example with these fields document them in their own consumer contracts. PRD-100's tolerate-unknown-optional-fields rule (PRD-108-R7) covers consumer compatibility.

### Wire format / interface definition

_Not applicable — examples consume but do not define wire formats. PRD-100, PRD-102, PRD-103, PRD-208 own the relevant wire shapes._

### Errors

| Condition | Severity | Notes |
|---|---|---|
| User-supplied `enumerate` throws | Build error | PRD-208-R12 |
| `transform` returns malformed product node | Build error (under `strict: true`) | PRD-208-R3, PRD-208-R10 |
| `metadata.schema_org_type` value other than `"Product"` | Build warning | PRD-704-R5 — PRD-100 owns the field; the example's value pin is local |
| Dangling `related[]` reference | Build warning (or error under strict) | PRD-704-R12 |
| `marketing:*` block emitted | Build warning | PRD-704-R6 |
| `data` block missing `text` field | Build error | PRD-102-R4 / PRD-208-R3 |
| Validator reports `achieved.level !== "standard"` | Acceptance failure | PRD-704-R15 (c) |

---

## Examples

### Example 1 — `act.config.ts`

```ts
import { defineConfig } from '@act/cli';
import { catalogAdapter } from './src/adapters/catalog';

export default defineConfig({
  outputDir: 'out',
  manifest: { siteName: 'Acme Catalog' },
  conformanceTarget: 'standard',
  adapters: [catalogAdapter({ database: 'data/catalog.sqlite' })],
});
```

### Example 2 — programmatic adapter spec

```ts
import { defineProgrammaticAdapter } from '@act/programmatic';
import Database from 'better-sqlite3';

interface ProductRow {
  sku: string;
  name: string;
  summary: string;
  description_md: string;
  specs_json: string;
  related_skus: string;  // CSV
  tags: string;          // CSV
}

export function catalogAdapter(opts: { database: string }) {
  const db = new Database(opts.database, { readonly: true });

  return defineProgrammaticAdapter({
    name: 'act-catalog',
    namespaceIds: false,
    validate: 'before-emit',
    strict: true,
    capabilities: {
      level: 'standard',
      precedence: 'primary',
      summarySource: 'extracted',
      concurrency_max: 8,
      manifestCapabilities: { subtree: true, etag: true },
    },
    async *enumerate() {
      const rows = db.prepare('SELECT * FROM products ORDER BY sku ASC').all() as ProductRow[];
      for (const row of rows) yield row;
    },
    transform(row) {
      const specs = JSON.parse(row.specs_json);
      return {
        id: row.sku,
        type: 'product',
        title: row.name,
        summary: row.summary,
        content: [
          { type: 'prose', text: row.description_md, format: 'markdown', metadata: { extracted_via: 'adapter' } },
          { type: 'data', format: 'json', text: row.specs_json, value: specs, metadata: { extracted_via: 'adapter' } },
        ],
        related: row.related_skus.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 8),
        metadata: {
          schema_org_type: 'Product',
          tags: row.tags.split(',').map((s) => s.trim()).filter(Boolean),
        },
      };
    },
    async dispose() {
      db.close();
    },
  });
}
```

### Example 3 — emitted product node

```json
{
  "act_version": "0.1",
  "id": "sku-001234",
  "type": "product",
  "title": "Heritage Leather Boot — Walnut",
  "summary": "Hand-stitched leather boot with Goodyear welt construction; walnut full-grain upper, oak-tanned sole.",
  "etag": "sha256:c2a1…",
  "tokens": { "summary": 26, "body": 412 },
  "content": [
    {
      "type": "prose",
      "format": "markdown",
      "text": "Built for daily wear and refinishing. The Heritage Leather Boot uses…",
      "metadata": { "extracted_via": "adapter" }
    },
    {
      "type": "data",
      "format": "json",
      "text": "{\"weight_g\":845,\"sizes_us\":[8,8.5,9,9.5,10,10.5,11,11.5,12,13],\"materials\":{\"upper\":\"full-grain leather\",\"sole\":\"oak-tanned leather\",\"lining\":\"vegetable-tanned calfskin\"},\"care\":\"condition every 60 days\",\"made_in\":\"Portugal\"}",
      "value": {
        "weight_g": 845,
        "sizes_us": [8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5, 12, 13],
        "materials": { "upper": "full-grain leather", "sole": "oak-tanned leather", "lining": "vegetable-tanned calfskin" },
        "care": "condition every 60 days",
        "made_in": "Portugal"
      },
      "metadata": { "extracted_via": "adapter" }
    }
  ],
  "related": ["sku-001233", "sku-001235", "sku-002001"],
  "metadata": {
    "schema_org_type": "Product",
    "tags": ["footwear", "leather", "made-in-portugal"],
    "source": { "adapter": "act-catalog", "source_id": "sku-001234" }
  }
}
```

### Example 4 — emitted manifest

```json
{
  "act_version": "0.1",
  "site": { "name": "Acme Catalog" },
  "delivery": "static",
  "conformance": { "level": "standard" },
  "index_url": "/act/index.json",
  "node_url_template": "/act/n/{id}.json",
  "subtree_url_template": "/act/sub/{id}.json",
  "capabilities": { "etag": true, "subtree": true }
}
```

---

## Test fixtures

Fixtures live under `fixtures/704/`. PRD-704 enumerates filenames; the validator (PRD-600) and the example's CI exercise them.

### Positive

- `fixtures/704/positive/build-output-500/` — complete `out/` from a clean build of the 500-SKU sample.
- `fixtures/704/positive/manifest.json` → satisfies PRD-704-R4.
- `fixtures/704/positive/node-sku-001234.json` → satisfies PRD-704-R5, R6, R9.
- `fixtures/704/positive/index.json` → enumerates all 500 products.
- `fixtures/704/positive/subtree-root.json` → satisfies PRD-704-R2's subtree requirement.
- `fixtures/704/positive/build-report.json` → satisfies PRD-704-R15.

### Negative

- `fixtures/704/negative/marketing-block-emitted/` → adapter `transform` returns a node containing a `marketing:hero` block. Build MUST surface a warning per PRD-704-R6.
- `fixtures/704/negative/dangling-related/` → product references a SKU not in the catalog. Build MUST warn (or error under `strict: true`) per PRD-704-R12.
- `fixtures/704/negative/wrong-schema-org-type/` → node carries `metadata.schema_org_type: "product"` (lowercase). Build MUST warn per PRD-704-R5.
- `fixtures/704/negative/data-block-missing-text/` → `data` block missing `text` field. Build error per PRD-102-R4 / PRD-208-R3.
- `fixtures/704/negative/non-deterministic-enumerate/` → `enumerate` lacks `ORDER BY`. Two consecutive builds produce diverging fixtures; the validator's fixture-runner reports per-run drift.
- `fixtures/704/negative/level-misdeclared-plus/` → manifest declares `"plus"` but no NDJSON / search / locales. Validator `achieved.level` MUST be `"standard"`; reporter emits `gaps` citing PRD-107-R10.

---

## Versioning & compatibility

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add an optional field on product nodes (e.g., `metadata.in_stock`) | MINOR | Per PRD-108-R7. |
| Add a third block type to the canonical body shape | MAJOR | PRD-704-R6 pins exactly two blocks; loosening is a contract change. |
| Drop the `data` block from canonical shape | MAJOR | Removes the example's primary structured-data carrier. |
| Add a new conformance target (Plus) | MAJOR | Changes the example's identity; operators forking for Plus deviate explicitly. |
| Change `metadata.schema_org_type` value | MAJOR | Consumers may dispatch on the field. |
| Tighten a SHOULD to a MUST | MAJOR | Per PRD-108. |
| Loosen a MUST to a SHOULD | MAJOR | Per PRD-108. |

### Forward compatibility

The example consumes the v0.1 wire format. A future v0.2 producer may add optional fields per PRD-108-R7; the example's consumers (PRD-600) MUST tolerate unknown optional fields. The example MUST NOT consume v0.2 features in v0.1.

### Backward compatibility

A re-build of the example with unchanged source data MUST emit byte-equivalent output modulo `generated_at` timestamps and ETags. The build report records the `act_version` and the achieved level.

---

## Security considerations

PRD-109 (Accepted) governs the project-wide threat model. PRD-704 deltas:

- **Catalog data leakage.** Product catalogs may contain pre-launch SKUs, regional pricing, or supplier-confidential specs. The example's `enumerate` MUST filter out non-public products. PRD-704 MUST NOT rely on consumer-side filtering; the static build profile is public-by-construction.
- **PII in product metadata.** Product reviews, customer ratings, or seller identities MUST NOT enter `metadata.*` without explicit sanitization. The example does not emit reviews; operators forking the example with reviews MUST review against PRD-109's PII threat model.
- **DB credentials.** Build-time DB access uses read-only credentials. The example uses SQLite (file-based, no credentials); operators with networked DBs source credentials via environment variables and MUST NOT commit them.
- **`data` block payload size.** Very large spec payloads (multi-megabyte data sheets) inflate node size. PRD-103's ETag derivation handles arbitrary size; CDN egress costs are operator concern. PRD-704 documents the 500-SKU baseline; operators with much larger catalogs SHOULD profile.
- **Cross-sell graph leakage.** `related[]` cross-sell links may reveal merchandising intent (which products are cross-promoted). Operators with sensitive merchandising relationships MUST omit or shuffle `related[]` per their threat model.
- **404-vs-403.** Static profile only; no auth boundary applies.

---

## Implementation notes

The snippets above (Examples 1–2) cover the canonical authoring shape. Additional notes:

### Snippet — SQLite schema

```sql
CREATE TABLE products (
  sku TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  summary TEXT NOT NULL,
  description_md TEXT NOT NULL,
  specs_json TEXT NOT NULL,
  related_skus TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT ''
);
CREATE INDEX products_sku ON products(sku);
```

### Snippet — running the build

```bash
$ npx @act/cli build --config act.config.ts
[act] enumerate: 500 products from data/catalog.sqlite
[act] transform: 500 / 500 (0 warnings, 0 errors)
[act] emit: 503 files written to out/ (manifest, index, 500 nodes, root subtree, build-report)
[act] achieved level: standard
$ npx @act/validator out/
{ "declared": { "level": "standard", "delivery": "static" },
  "achieved":  { "level": "standard", "delivery": "static" },
  "gaps": [], "warnings": [] }
```

### Snippet — deterministic enumeration

```ts
// Promotes PRD-208-R6 SHOULD to MUST for this example (PRD-704-R8).
async *enumerate() {
  const rows = db.prepare('SELECT * FROM products ORDER BY sku ASC').all();
  for (const row of rows) yield row;
}
```

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-02 | Jeremy Forsythe | Initial draft. Standard-band reference for a 500–2000-SKU e-commerce catalog using PRD-208's programmatic adapter, with `data`-block taxonomy as the structured-data carrier. Single locale, no `marketing:*` blocks, no NDJSON/search. Three open questions flagged: subtree on category roots (deferred), PRD-208 `data`-block validation interaction (potential ambiguity flagged for v0.2), and tags-vs-first-class-categories (deferred). Status: Draft → In review. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). PRD-208-R3 `data`-block schema-validation ambiguity (Open Q2) filed as docs/amendments-queue.md A3; queued for Phase 6 forge:reviewer triage. |
