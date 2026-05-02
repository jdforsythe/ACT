# PRD-201 — Markdown / MDX adapter

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

The most common ACT input is a directory of `.md` / `.mdx` files in a Git-tracked content tree (Astro / Docusaurus / Next.js / Eleventy / VitePress sites; technical-docs and developer-blog use cases). PRD-200 (in review) pins the adapter contract — `Adapter`, lifecycle, `AdapterCapabilities`, multi-source merge, failure modes — but every concrete behavior an adapter author writing a markdown loader needs to nail down is open: which file globs to walk, which frontmatter formats to accept, which frontmatter keys to recognize, how to derive an ID from a path, how to map markdown body constructs to PRD-102 content blocks, how to handle MDX components without introspecting React/Vue/Angular at adapter time, how to derive `summary` and stamp `summary_source`, and what the failure surface looks like when frontmatter is malformed or a required field is missing. Until this PRD lands, every generator (PRD-401 Astro, PRD-404 Docusaurus, PRD-408 Eleventy) that wants to ingest a markdown corpus rolls its own loader, the test fixtures diverge across implementations, and the simplest 700-series example builds (PRD-700 minimal Astro docs site, PRD-701 Docusaurus large docs site, PRD-703 Hugo blog spec-only counterpart) cannot validate clean against PRD-600.

PRD-100 (Accepted) defines the node and index envelopes the adapter emits. PRD-102 (Accepted) defines the content-block taxonomy (`markdown`, `prose`, `code`, `data`, `callout`, `marketing:*`). PRD-200 (in review) defines the framework-level interface and the merge / failure / capability contracts. PRD-201 inherits all three and pins the markdown-specific surface: file walk + frontmatter + body-to-blocks + MDX seam + summary derivation + failure mapping.

### Goals

1. Lock the **file-discovery contract**: glob patterns, ignore rules, `.mdx` recognition, stable ordering, watch-mode hand-off for incremental rebuilds.
2. Lock the **frontmatter parser**: YAML and TOML accepted; recognized keys (`id`, `title`, `summary`, `summary_source`, `tags`, `parent`, `related`, `type`, `metadata.*`); unknown keys preserved on `metadata`.
3. Lock the **default ID strategy**: derived from path, with the file extension and an optional shared root prefix dropped, normalized to PRD-100-R10 grammar; per-PRD-100-R14 / PRD-200-R11, frontmatter `id:` overrides the default; adapter-config `idStrategy.stripPrefix` overrides the default but loses to frontmatter.
4. Lock the **markdown-body → content-blocks mapping**: prose paragraphs / headings / lists round-trip as `markdown` blocks (PRD-102-R1) by default, with optional fine-grained mode that splits into `prose` + `code` + `data` + `callout`. Code fences map to `code` blocks (PRD-102-R3); data fences (\`\`\`json data, \`\`\`yaml data, etc.) map to `data` blocks (PRD-102-R4); admonition / callout syntax (`:::note`, GFM-alerts) map to `callout` blocks (PRD-102-R5).
5. Lock the **MDX seam**: imports and component tags inside MDX are passed through as opaque placeholders; the adapter does NOT introspect React / Vue / Angular. The placeholder block carries `metadata.extracted_via: "component-contract"` per PRD-200-R27 / PRD-102-R21 so PRD-300's component-contract layer can merge real extracted blocks via PRD-200's multi-source merge.
6. Lock the **summary-derivation rule**: frontmatter `summary` wins (`summary_source: "author"` per PRD-102-R12); else first non-heading paragraph (`summary_source: "extracted"`); summary length tracked per PRD-100-R20 / PRD-102-R26.
7. Lock the **failure surface**: malformed frontmatter is unrecoverable per PRD-200-R18; missing optional recognized keys are silent; missing required envelope fields surface a partial node per PRD-200-R16 / R17 with `metadata.extraction_status: "partial"`.
8. Specify the **conformance band the adapter advertises**: Core by default (emits `markdown` blocks plus required envelope fields); Standard when frontmatter `summary` enables a clean `summary_source: "author"` chain AND the adapter is configured for fine-grained block splitting (`prose` / `code` / `data` / `callout`); Plus only when the adapter is composed with PRD-300's component-contract layer or PRD-207's i18n adapter under PRD-200-R12 multi-source merge.
9. Enumerate the **test fixture matrix** under `fixtures/201/positive/` and `fixtures/201/negative/`, and demonstrate which PRD-200 framework fixtures this adapter MUST also pass.

### Non-goals

1. **Defining the adapter framework contract.** Owned by PRD-200 (in review). PRD-201 implements PRD-200 against a markdown corpus; it does not redefine `Adapter`, lifecycle, merge, capabilities, or failure semantics.
2. **Defining the wire format envelopes.** Owned by PRD-100 (Accepted). The adapter emits PRD-100 envelopes; this PRD does not redefine them.
3. **Defining the content-block taxonomy.** Owned by PRD-102 (Accepted). PRD-201 specifies how markdown source maps to PRD-102 block types; the block schemas are unchanged.
4. **Defining the component contract.** Owned by PRD-300 (in review). MDX component placeholders are an inert seam in PRD-201; PRD-300 owns the actual `extract` semantics.
5. **Defining the generator pipeline.** Owned by PRD-400 (Draft). PRD-201's output flows into a generator; the generator owns ID minting helpers, file writing, manifest assembly, and orchestration of the merge step.
6. **Defining MDX → React component bindings.** Owned by PRD-301 (Draft, depends on PRD-300). PRD-201 emits placeholders only.
7. **Authoring an i18n loader.** Owned by PRD-207 (this batch). PRD-201 emits a single locale per file; per-locale variants come from PRD-207 via the multi-source merge step.
8. **Defining a programmatic loader.** Owned by PRD-208 (this batch). Custom in-process emission paths route through PRD-208, not PRD-201.
9. **Pinning a specific markdown parser.** PRD-201 specifies the *behavior* the parser MUST exhibit; the reference implementation will pick `remark` / `unified` (per Q3 TS-only), but this PRD does not bind the choice. Any parser meeting the behavioral contract suffices.

### Stakeholders / audience

- **Authors of:** PRD-401 (Astro), PRD-402 (Hugo, spec-only), PRD-403 (MkDocs, spec-only), PRD-404 (Docusaurus), PRD-408 (Eleventy), PRD-409 (standalone CLI). Each generator that ingests a markdown corpus invokes this adapter.
- **Consumers of:** PRD-700 (minimal Astro docs site), PRD-701 (Docusaurus large docs site), PRD-703 (Hugo blog, spec-only), PRD-707 (Eleventy blog) — every 700-series example whose source is `.md` / `.mdx` files.
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Frontmatter-parser divergence across reference impl and community ports leads to "works in Astro, breaks in Docusaurus." | Medium | Medium | PRD-201-R3 specifies the exact YAML 1.2 / TOML 1.0 dialect and pins the recognized-key list. Negative fixtures cover the common malformed-frontmatter cases. |
| Path-derived ID strategy collides with frontmatter-driven IDs at scale (e.g., a file at `docs/intro/getting-started.md` and a sibling whose frontmatter says `id: docs/intro/getting-started`). | Medium | Medium | PRD-201-R7 forbids dual emission of the same ID within a single adapter run; collision is an unrecoverable error. Multi-adapter collisions are PRD-200-R12's concern. |
| Naive markdown→`markdown`-block emission loses the granularity downstream consumers want (e.g., summary extraction over a `markdown` blob is harder than over a `prose` block). | Medium | Medium | PRD-201-R12 specifies a default coarse mode (one `markdown` block per document) and an opt-in fine-grained mode that splits into `prose`/`code`/`data`/`callout`. Fine-grained mode is Standard-tier; coarse is Core-tier. |
| MDX components silently swallowed when no PRD-300 layer composes with the build, leading to user confusion ("my hero component disappeared"). | High | Medium | PRD-201-R15 requires the adapter to emit a `marketing:placeholder` block per unresolved MDX component, with `metadata.component` set to the component's tag name and `metadata.extraction_status: "partial"`. PRD-600 surfaces a per-build summary of unresolved components. |
| Summary extraction emits HTML / front-matter scraps when the first paragraph is a comment or a YAML stray. | Low | Low | PRD-201-R18 specifies the extraction algorithm: skip frontmatter, skip HTML comments, skip headings, take the first contiguous paragraph; trim. PRD-201-R19 caps the extracted summary at 50 tokens (PRD-100-R20). |
| `metadata.*` frontmatter keys collide with framework-reserved keys (`metadata.source`, `metadata.extraction_status`, `metadata.locale`, `metadata.translations`). | Medium | Medium | PRD-201-R6 reserves the framework keys and rejects frontmatter that attempts to set them. Reserved-key violations are unrecoverable per PRD-200-R18. |

### Open questions

1. ~~Should the adapter accept JSON frontmatter (some Hugo / Eleventy users use `{ ... }` JSON blocks instead of YAML / TOML)?~~ **Resolved (2026-05-01): No.** YAML and TOML are the canonical pair for v0.1. JSON frontmatter is a v0.2 candidate; adding it is MINOR per PRD-108-R4(1). (Closes Open Question 1.)
2. ~~Should the path-derived ID strategy collapse `index.md` to its parent directory (so `docs/intro/index.md` → `docs/intro` rather than `docs/intro/index`)?~~ **Resolved (2026-05-01): Yes.** Collapsing matches web-routing convention and is what every reference generator (Astro, Docusaurus, Eleventy) expects. PRD-201-R8 already enumerates the rule. (Closes Open Question 2.)
3. ~~Should fine-grained block splitting (Standard mode) be the default rather than coarse mode?~~ **Resolved (2026-05-01): No.** Coarse (single `markdown` block) is the lowest-friction default for v0.1 adopters. Operators opt in to Standard splitting via config; revisit the default in v0.2 if generator authors signal a strong preference. (Closes Open Question 3.)
4. ~~Should the MDX seam preserve component prop literals as a JSON blob on `metadata.props`, or strip them entirely?~~ **Resolved (2026-05-01): Preserve as `metadata.props`.** PRD-201-R15 already emits the prop set as a structured field so PRD-300's `extract` can correlate. The metadata is producer-defined and PRD-300 will consume it when it lands. (Closes Open Question 4.)
5. ~~Should GFM-alerts (`> [!NOTE]` syntax) and `:::note` admonition syntax both map to `callout` blocks, or only one?~~ **Resolved (2026-05-01): Both.** Both are widespread; `level` is mapped per the trigger keyword and PRD-201-R14 lists the recognized triggers. (Closes Open Question 5.)

### Acceptance criteria

- [ ] Every normative requirement has an ID `PRD-201-R{n}` and a declared conformance level per PRD-107.
- [ ] The Specification section opens with a table mapping every requirement to PRD-200 / PRD-100 / PRD-102 requirements implemented.
- [ ] The TypeScript adapter shape (config interface, `Adapter` implementation skeleton) is reproduced inline in §"Wire format / interface definition."
- [ ] Frontmatter recognition rules are pinned with a positive fixture and a negative fixture per recognized key.
- [ ] Path-derived ID strategy is pinned with worked examples covering `index.md` collapsing, extension stripping, prefix stripping, frontmatter override, and config-rule override.
- [ ] Body-to-block mapping is pinned with one positive fixture per block type and a coarse-vs-fine mode example.
- [ ] MDX seam is pinned with a fixture showing one MDX component round-tripped as a placeholder with `metadata.props`.
- [ ] Summary derivation rule is pinned with a positive fixture for each `summary_source` value (`"author"`, `"extracted"`).
- [ ] Failure modes are pinned with explicit mapping to PRD-200-R16 (recoverable) vs PRD-200-R18 (unrecoverable).
- [ ] Implementation notes ship 5–8 short TypeScript snippets covering: the adapter skeleton, file-walk implementation, frontmatter parsing, ID derivation, body-to-block mapping, summary extraction, MDX placeholder emission.
- [ ] Test fixture path layout under `fixtures/201/positive/` and `fixtures/201/negative/` is enumerated; one fixture per major requirement.
- [ ] Versioning & compatibility section classifies every kind of change to PRD-201 per PRD-108.
- [ ] Security section cites PRD-109 and documents adapter-specific deltas (path-traversal in derived IDs, frontmatter-injected reserved keys, MDX prop sanitization).
- [ ] Changelog entry dated 2026-05-01 by Jeremy Forsythe is present.

---

## Context & dependencies

### Depends on

- **PRD-100** (Accepted) — wire format envelopes. Every emitted node MUST validate against `schemas/100/node.schema.json`.
- **PRD-102** (Accepted) — content blocks. Adapter emits `markdown`, `prose`, `code`, `data`, `callout`, and (when composed with PRD-300) `marketing:*` blocks.
- **PRD-107** (Accepted) — conformance levels.
- **PRD-108** (Accepted) — versioning policy; PRD-201 inherits Stage-1 pinning per PRD-200-R25.
- **PRD-109** (Accepted) — security; cited for credential handling, path-traversal, and content sanitization deltas.
- **PRD-200** (In review) — adapter framework. PRD-201 implements `Adapter` and inherits lifecycle, merge, capability, and failure contracts. The default export of `act-markdown` MUST satisfy `Adapter` per PRD-200-R1.
- **000-governance** (Accepted) — lifecycle of this PRD.
- **000-decisions-needed Q3** — TS-only first-party reference impl for v0.1.
- External: [CommonMark 0.31](https://spec.commonmark.org/0.31/) (markdown grammar), [GFM](https://github.github.com/gfm/) (tables, alerts, task lists), [MDX 3.x](https://mdxjs.com/) (component embedding), [YAML 1.2](https://yaml.org/spec/1.2.2/), [TOML 1.0](https://toml.io/en/v1.0.0), [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174).

### Blocks

- **PRD-400** (generator architecture) — generators that ingest a markdown corpus invoke this adapter.
- **PRD-401** (Astro plugin), **PRD-404** (Docusaurus plugin), **PRD-408** (Eleventy plugin), **PRD-409** (standalone CLI) — directly compose this adapter.
- **PRD-402** (Hugo, spec-only), **PRD-403** (MkDocs, spec-only) — non-TS counterparts whose porting guides will reference this adapter's behavior.
- **PRD-700** (minimal Astro docs site), **PRD-701** (Docusaurus large docs site), **PRD-703** (Hugo blog, spec-only), **PRD-707** (Eleventy blog) — every 700-series markdown-driven example.

### References

- v0.1 draft: §5.10 (adapter pipeline informal sketch), §6.1 (markdown adapter introductory walkthrough), §6.2 (frontmatter recognition), §6.4 (ID strategies — `derived` from URL path), §10 Q5 (extraction failure mapping).
- `prd/000-gaps-and-resolutions.md` gaps **B1** (lifecycle, owned by PRD-200), **B3** (ID-strategy composition, owned by PRD-200), **A4** (failure modes, owned by PRD-200), **B4** (component-contract seam, referenced via MDX), **E5** (`summary_source` enum, owned by PRD-102), **E7** (ID-override precedence, owned by PRD-100).
- Prior art: [Astro content collections](https://docs.astro.build/en/guides/content-collections/) (schema-validated frontmatter loaders), [Contentlayer](https://contentlayer.dev/) (MDX + frontmatter pipeline), [Eleventy data cascade](https://www.11ty.dev/docs/data-cascade/), [Hugo front matter](https://gohugo.io/content-management/front-matter/), [Docusaurus markdown features](https://docusaurus.io/docs/markdown-features), [VitePress markdown extensions](https://vitepress.dev/guide/markdown).

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords as clarified by RFC 8174.

### Parent + 100-series requirements implemented

The table below maps every PRD-201 requirement to the parent (PRD-200) and 100-series requirement(s) it implements or relies on. This satisfies the workflow.md Phase 3 rule that every P2 leaf PRD declare the parent + 100-series surface it implements.

| PRD-201 requirement | Parent / 100-series requirement(s) | Relationship |
|---|---|---|
| R1 (adapter implements PRD-200 contract) | PRD-200-R1, PRD-200-R2 | Default export satisfies `Adapter`; lifecycle order honored. |
| R2 (config schema) | PRD-200-R20 | Adapter publishes JSON Schema for its config under the package's `schema/` directory. |
| R3 (frontmatter parser) | — | Adapter-internal. |
| R4 (recognized frontmatter keys) | PRD-100-R14, PRD-100-R22, PRD-102-R12 | `id`, `title`, `summary`, `summary_source`, `tags`, `parent`, `related`, `type`, `metadata.*`. |
| R5 (unknown frontmatter keys preserved on metadata) | PRD-100-R22 | Open `metadata` object. |
| R6 (reserved metadata keys) | PRD-200-R13, PRD-102-R21, PRD-104-R(metadata.locale) | Framework keys (`metadata.source`, `metadata.extraction_status`, `metadata.extracted_via`, `metadata.locale`, `metadata.translations`) reserved. |
| R7 (no within-adapter ID collisions) | PRD-100-R10, PRD-200-R10 | Adapter MUST detect dup IDs in its own corpus. |
| R8 (path-derived ID strategy) | PRD-100-R10, PRD-200-R11 | Default ID derivation with `index.md` collapsing, extension stripping, lowercase normalization. |
| R9 (frontmatter `id:` override) | PRD-100-R14, PRD-200-R11 | Per-node override wins. |
| R10 (config `idStrategy.stripPrefix` override) | PRD-100-R14, PRD-200-R11 | Adapter-config rule wins over default; loses to frontmatter override. |
| R11 (file walk + glob + ignore) | PRD-200-R4 | Adapter's `enumerate` implementation. |
| R12 (body → blocks: coarse vs fine) | PRD-102-R1, PRD-102-R2, PRD-102-R3, PRD-102-R4, PRD-102-R5 | Default coarse `markdown` block; opt-in fine-grained mode. |
| R13 (code-fence → `code` block; data fence → `data` block) | PRD-102-R3, PRD-102-R4 | Fence info string drives the block type. |
| R14 (admonition → `callout` block) | PRD-102-R5 | `:::note` / GFM-alert syntax mapped to closed `level` enum. |
| R15 (MDX component → `marketing:placeholder` block with `metadata.extracted_via`) | PRD-102-R21, PRD-102-R22, PRD-200-R27 | Adapter emits placeholder; PRD-300's component-contract merge populates real content. |
| R16 (block ordering preserved) | PRD-102-R24 | Source order = emission order. |
| R17 (summary derivation) | PRD-102-R12, PRD-100-R19, PRD-100-R20, PRD-102-R26 | Frontmatter wins; else first paragraph extracted. |
| R18 (extraction algorithm) | PRD-102-R26 | Skip frontmatter / comments / headings; first paragraph; trim. |
| R19 (summary token cap) | PRD-100-R20, PRD-102-R26 | Validator-warning threshold honored on emission. |
| R20 (`summary_source` stamping) | PRD-102-R12 | `"author"` when frontmatter, `"extracted"` otherwise. |
| R21 (incremental rebuild via mtime) | PRD-200-R9 | Optional `delta(since)` based on file mtime. |
| R22 (capability declaration) | PRD-200-R22 | Adapter declares `level`, `concurrency_max`, `delta`, `summarySource`. |
| R23 (level-aware emission) | PRD-200-R24, PRD-107-R6, PRD-107-R8 | Core target → `markdown` blocks only; Standard target → fine-grained allowed. |
| R24 (recoverable failure → partial node) | PRD-200-R16, PRD-200-R17 | Per-file extraction failure → partial node, build warning. |
| R25 (unrecoverable failure → throw) | PRD-200-R18 | Malformed frontmatter, reserved-key violation, ID grammar violation that survives normalization. |
| R26 (provenance metadata) | PRD-200-R13 | `metadata.source.adapter: "act-markdown"`, `metadata.source.source_id: <relative path>`. |
| R27 (Stage-1 version pinning) | PRD-200-R25, PRD-108-R14 | `act-markdown@0.1.x` emits `act_version: "0.1"` only. |
| R28 (test-fixture conformance) | PRD-200-R28 | Adapter MUST pass framework fixtures in `fixtures/200/` plus its own under `fixtures/201/`. |

### Conformance level

Per PRD-107, requirements in PRD-201 are banded as follows.

- **Core:** PRD-201-R1, R2, R3, R4 (the recognized-key set), R5, R6, R7, R8, R9, R10, R11, R12 (coarse mode), R13 (code-fence → `code` block — Standard semantically but the adapter MUST handle the fence even in Core mode by passing it through inside `markdown`), R16, R17, R18, R19, R20, R22, R23, R24, R25, R26, R27, R28.
- **Standard:** PRD-201-R12 (fine-grained mode), R14 (`callout` block emission requires PRD-102-R5 which is Standard), R21 (`delta` incremental rebuild — Standard per PRD-200-R9).
- **Plus:** PRD-201-R15 (MDX → `marketing:placeholder` requires PRD-102-R22 which is Plus). Note: an adapter MAY ship the MDX seam at any level if it stays purely in placeholder mode; the actual block emitted (`marketing:placeholder`) is Plus-tier, so a Core-targeting build MUST refuse `.mdx` inputs (PRD-201-R23 enforces).

A producer's declared level (per `ctx.config.targetLevel`, PRD-200-R19) determines which subset applies; a Plus producer satisfies all by additivity (PRD-107-R11).

### Normative requirements

#### Adapter shape

**PRD-201-R1.** *(Core)* The default export of the `act-markdown` package MUST satisfy the `Adapter` interface from PRD-200-R1. The adapter's `name` property MUST be the string `"act-markdown"`. The adapter MUST implement `init`, `enumerate`, `transform`, and `dispose`; it MAY implement `precheck` and `delta`.

**PRD-201-R2.** *(Core)* The adapter's config type, supplied as the first argument to `init` per PRD-200-R3, MUST be a JSON object satisfying the schema published under the package's `schema/config.schema.json`. The schema MUST define at least the following properties:

- `sourceDir` (string, REQUIRED) — absolute or build-relative path to the markdown corpus root.
- `include` (array of glob strings, OPTIONAL; default `["**/*.md", "**/*.mdx"]`) — file globs to include, relative to `sourceDir`.
- `exclude` (array of glob strings, OPTIONAL; default `["**/node_modules/**", "**/.git/**", "**/.act/**"]`) — file globs to exclude.
- `idStrategy` (object, OPTIONAL) — see PRD-201-R8 / R10.
- `mode` (string, OPTIONAL; one of `"coarse"`, `"fine"`; default `"coarse"`) — body-to-block mapping mode (PRD-201-R12).
- `frontmatter` (object, OPTIONAL) — parser options. `format` (one of `"yaml"`, `"toml"`, `"auto"`; default `"auto"`); `strict` (boolean; default `false`).
- `mdx` (object, OPTIONAL) — MDX handling. `enabled` (boolean; default `true` if any `**/*.mdx` glob matches).

#### Frontmatter

**PRD-201-R3.** *(Core)* The adapter MUST recognize frontmatter blocks delimited by either `---` (YAML) or `+++` (TOML) at the very start of the file. YAML frontmatter MUST conform to YAML 1.2; TOML frontmatter MUST conform to TOML 1.0. When `frontmatter.format: "auto"`, the delimiter dictates the parser (`---` → YAML, `+++` → TOML). When `frontmatter.format` is explicit, a delimiter mismatch MUST be unrecoverable per PRD-200-R18.

**PRD-201-R4.** *(Core)* The adapter MUST recognize the following frontmatter keys at the top level of the frontmatter block. All are OPTIONAL; defaults are applied per the cited rules.

| Key | Type | PRD-100 / PRD-102 mapping | Default if absent |
|---|---|---|---|
| `id` | string | PRD-100-R14 explicit override | derived per PRD-201-R8 |
| `title` | string | PRD-100-R21 required field | derived from first H1 if present, else file stem |
| `summary` | string | PRD-100-R21 required field, `summary_source: "author"` per PRD-102-R12 | derived per PRD-201-R17 |
| `summary_source` | string | PRD-102-R12 documented-open enum | stamped per PRD-201-R20 |
| `type` | string | PRD-100-R21 required field; PRD-102 type taxonomy | `"article"` |
| `tags` | array of strings | node-level `tags` field per PRD-100-R17 (index entry) / PRD-100-R22 (node) | absent |
| `parent` | string (ID) | PRD-100-R24 | absent |
| `related` | array of `{ id, relation }` objects OR plain ID strings | PRD-102-R18, PRD-102-R19 | absent |
| `metadata` | object | PRD-100-R22 open metadata | merged with framework metadata per PRD-201-R5 |

When `related` is an array of plain strings, the adapter MUST upgrade each entry to `{ id: <string>, relation: "see-also" }` per PRD-102-R19's well-known default.

**PRD-201-R5.** *(Core)* Frontmatter keys not listed in PRD-201-R4 MUST be preserved on the emitted node's `metadata` object verbatim, under their original frontmatter key name. The adapter MUST NOT silently drop unrecognized keys. Example: a frontmatter `author: "Jane Doe"` becomes `metadata.author: "Jane Doe"` on the emitted node.

**PRD-201-R6.** *(Core)* The following metadata keys are **reserved** by the framework or by other PRDs and MUST NOT be set via frontmatter:

- `metadata.source` (PRD-200-R13)
- `metadata.extraction_status` (PRD-102-R22 / PRD-200-R17)
- `metadata.extraction_error` (PRD-200-R17)
- `metadata.extracted_via` (PRD-102-R21)
- `metadata.locale` (PRD-104-R5; framework reserves regardless of i18n adapter presence)
- `metadata.translations` (PRD-104-R9)
- `metadata.translation_status` (PRD-104-R11)
- `metadata.fallback_from` (PRD-104-R10)
- `metadata.variant` (PRD-102-R31)
- `metadata.contributors` (reserved within `metadata.source.contributors` per PRD-200-R13)

A frontmatter block that attempts to set any reserved key under `metadata:` MUST be rejected as an unrecoverable error per PRD-200-R18, citing the offending key.

#### IDs and file discovery

**PRD-201-R7.** *(Core)* Within a single adapter run, two emitted nodes MUST NOT share the same final `id`. When the adapter detects a duplicate (e.g., one file's frontmatter override matches another file's path-derived ID), the adapter MUST throw from `transform` per PRD-200-R18, citing both source paths and the duplicate ID. Multi-adapter ID collisions are PRD-200-R12's concern; PRD-201-R7 covers the within-adapter case only.

**PRD-201-R8.** *(Core)* The default ID strategy is path-derived. For a file at `<sourceDir>/<relPath>.<ext>` (where `<ext>` is `md` or `mdx`), the default `id` is computed as:

1. Take `<relPath>` (the path relative to `sourceDir`, with forward-slash separators).
2. If the basename is `index` (i.e., `<relPath>` ends in `/index`), drop the trailing `/index`. A file at `<sourceDir>/index.md` (whose `<relPath>` is just `index`) maps to the manifest's `root_id` (PRD-100-R8); the adapter declares the value via `ctx.config` or via the absent-`relPath` collapsing to the empty string, which the adapter MUST translate to the configured root ID (default `"index"`).
3. Lowercase the result. The grammar (PRD-100-R10) requires lowercase ASCII; producers MUST normalize on emission per PRD-100-R13.
4. Replace any character outside the grammar (`[a-z0-9._\-/]`) with `-`, then collapse runs of `-`. This handles spaces, accented characters, and other punctuation. The adapter MUST NOT silently drop characters; replacement is the single normalization rule.
5. Validate the result against `ctx.idMinter.validate` (PRD-200-R19). A validation failure that survives normalization MUST be unrecoverable per PRD-200-R18.

**PRD-201-R9.** *(Core)* When the file's frontmatter sets `id:`, the frontmatter value MUST win over the default strategy and over any adapter-config rule, per PRD-100-R14 / PRD-200-R11. The frontmatter `id:` value is subject to the same normalization-and-validation pass (PRD-201-R8 steps 3–5); if normalization changes the value, the adapter MUST emit a build warning citing the original and normalized forms. A frontmatter `id:` that fails grammar validation after normalization MUST be unrecoverable.

**PRD-201-R10.** *(Core)* The adapter's config MAY include `idStrategy.stripPrefix` (string), which removes the given prefix from `<relPath>` before applying step 1 of PRD-201-R8. The adapter's config MAY include `idStrategy.namespace` (string), which, when set, prepends `<namespace>/` to the derived ID before normalization. Adapter-config rules MUST win over the default strategy and MUST lose to a frontmatter override per PRD-100-R14.

**PRD-201-R11.** *(Core)* The adapter's `enumerate` MUST yield one item per file matching the configured `include` globs and not matching the `exclude` globs. Yield order MUST be deterministic and MUST match the file path's lexicographic order under `Intl.Collator` with `sensitivity: "base"` and `numeric: true`. Determinism enables stable test fixtures; unstable enumeration is a recoverable failure (the build still succeeds, but the order of `metadata.source.contributors` and any deterministic-output downstream consumer becomes undefined). Symlinks MUST be followed by default; a configurable `followSymlinks: false` MAY be exposed.

#### Body to blocks

**PRD-201-R12.** *(Core for coarse mode; Standard for fine mode)* The adapter's body-to-block mapping is governed by the `mode` config field:

- **Coarse mode (default).** The adapter MUST emit exactly one `markdown` block per source file, whose `text` is the source body verbatim (frontmatter stripped, MDX components substituted with placeholder markers per PRD-201-R15). The block is shaped per PRD-102-R1.
- **Fine mode.** The adapter MUST split the body into a sequence of `prose` (PRD-102-R2), `code` (PRD-102-R3), `data` (PRD-102-R4), and `callout` (PRD-102-R5) blocks per the rules in PRD-201-R13 / R14. Plain markdown paragraphs and headings flow into `prose` blocks with `format: "markdown"`. The token-budget gain from fine mode is the primary motivator; coarse mode preserves source fidelity at the cost of larger downstream parsing.

A target level (`ctx.config.targetLevel`) of `"core"` permits only coarse mode (PRD-102-R1's `markdown` block is Core; `prose`/`code`/`data`/`callout` are Standard). A target level of `"standard"` or `"plus"` permits either mode; the adapter follows the user's `mode` config.

**PRD-201-R13.** *(Standard)* In fine mode, a fenced code block in the source body becomes a content block per the fence's info string:

- Fence info string of the form `<language>` (no `data` suffix) → `code` block per PRD-102-R3, with `language: <language>` (lowercased) and `text: <fence body>`. Recognized languages are PRD-102-R3's documented-open enum; unknown languages are passed through verbatim.
- Fence info string of the form `<format> data` (e.g., `json data`, `yaml data`, `csv data`, `tsv data`, `ndjson data`) → `data` block per PRD-102-R4, with `format: <format>` (lowercased) and `text: <fence body>`. The trailing `data` keyword is the discriminator; producers MUST use it to opt into `data` block emission.
- Fence info string with no language (just `\`\`\``) → `code` block per PRD-102-R3 with `language: "text"` (the catch-all from PRD-102-R3's enum).
- Fence info strings combining a language and `data` (e.g., `json data filename=config.json`) → `data` block; additional space-separated tokens are parsed as `key=value` pairs and passed through on the block's `metadata.fence_attrs`. Unparseable tokens are preserved verbatim under `metadata.fence_attrs._raw`.

**PRD-201-R14.** *(Standard)* In fine mode, the adapter MUST recognize two callout syntaxes and map both to `callout` blocks per PRD-102-R5:

- **GFM-alert syntax** (`> [!NOTE]`, `> [!WARNING]`, `> [!IMPORTANT]`, `> [!TIP]`, `> [!CAUTION]`). The keyword maps to the closed `level` enum: `NOTE`/`IMPORTANT`/`TIP` → `"info"`, `WARNING` → `"warning"`, `CAUTION` → `"error"`. The blockquote body becomes the callout's `text`.
- **MDX-style admonition** (`:::note`, `:::warning`, `:::error`, `:::tip`, `:::info`, optionally followed by a label, terminated by `:::`). The directive name maps to the closed `level` enum verbatim where it matches; `note` and `important` map to `"info"`. The block body (everything between the opening and closing fences) becomes the callout's `text`. Markdown formatting inside the body is preserved as markdown, per PRD-102-R5.

A directive whose keyword is not in the closed enum MUST be emitted as a `prose` block with `format: "markdown"` (i.e., the adapter does NOT silently drop unrecognized directives).

#### MDX seam

**PRD-201-R15.** *(Plus)* For each MDX component tag in the source body (a JSX element whose tag name starts with an uppercase ASCII letter, per MDX 3.x convention), the adapter MUST emit a placeholder block in the slot the component would have occupied, shaped per PRD-102-R22:

```ts
{
  type: "marketing:placeholder",
  metadata: {
    extracted_via: "component-contract",
    extraction_status: "partial",
    component: "Hero",                  // the JSX tag name
    props: { /* parsed prop literals */ },
    location: { file: "<relPath>", line: <number>, col: <number> }
  }
}
```

The `metadata.props` field MUST contain the prop set, with literal values (strings, numbers, booleans, JSON-compatible objects/arrays) preserved verbatim. Non-literal expressions (e.g., `<Hero title={someVar} />`) MUST be preserved as the source-text string under a `_expr` key (e.g., `props: { title: { _expr: "someVar" } }`). The `_expr` form signals to PRD-300's `extract` layer that this prop is non-static and the contract should resolve it at component-extraction time.

When the adapter runs against a Core or Standard target (PRD-200-R24), MDX inputs MUST be rejected unrecoverably per PRD-200-R18 — the placeholder block (`marketing:placeholder`) is Plus-tier and emitting it at lower targets is a level-mismatch. PRD-201-R23 specifies the rejection.

**PRD-201-R16.** *(Core)* The order of blocks in a node's `content` array MUST match the source's render order, top-to-bottom, per PRD-102-R24. Coarse mode emits a single block (no ordering question). Fine mode emits one block per source-body construct in source order. MDX placeholders are emitted in the position of the JSX element in the source — between the markdown blocks that flank it.

#### Summary derivation

**PRD-201-R17.** *(Core)* The emitted node's `summary` field MUST be set per the following precedence:

1. If frontmatter `summary:` is present and non-empty, use it. Stamp `summary_source: "author"` per PRD-201-R20.
2. Otherwise, extract per PRD-201-R18. Stamp `summary_source: "extracted"`.
3. If extraction yields an empty string (e.g., the file has no body paragraph), the adapter MUST emit a partial node per PRD-200-R16 with `metadata.extraction_status: "partial"` and `metadata.extraction_error: "summary extraction yielded empty"`. The `summary` field MUST still be a non-empty string per PRD-100-R19; the adapter MUST substitute the file stem (the basename without extension, title-cased) as a fallback summary.

**PRD-201-R18.** *(Core)* The summary-extraction algorithm:

1. Strip frontmatter (the leading `---`-or-`+++` block).
2. Skip leading whitespace and HTML comments (`<!-- ... -->`).
3. Skip leading headings (`#`, `##`, etc.) and their immediately-following blank line.
4. Take the next contiguous text block (paragraph). A paragraph terminates at the next blank line or the next non-prose construct (heading, fence, MDX component, callout).
5. If the paragraph contains markdown formatting (bold, italic, links), strip it to plain text. Preserve link text but drop link targets. Preserve emphasis text but drop the emphasis markers.
6. Trim leading and trailing whitespace; collapse internal whitespace to single spaces.
7. Truncate to 50 tokens per PRD-201-R19.

**PRD-201-R19.** *(Core)* The extracted summary MUST be truncated to 50 tokens (PRD-100-R20's SHOULD threshold). The adapter's `tokens.summary` field MUST report the actual token count after truncation, computed via the tokenizer declared by the manifest's `tokens.tokenizer` field (default `o200k` per gap E1). When truncation occurs, the adapter MUST end the summary with an ellipsis (`…`, U+2026) inside the 50-token budget; the ellipsis itself is one token.

**PRD-201-R20.** *(Core)* The emitted node's `summary_source` field (PRD-102-R12) MUST be set to:

- `"author"` when frontmatter `summary:` was present.
- `"extracted"` when PRD-201-R18 was used.
- The frontmatter-supplied value when frontmatter `summary_source:` is present (this allows authors to attribute, e.g., `summary_source: "llm"` for an authored-but-LLM-rewritten summary). When frontmatter `summary_source:` is set without frontmatter `summary:`, the adapter MUST treat it as a configuration error and emit unrecoverable per PRD-200-R18.

#### Incremental rebuilds

**PRD-201-R21.** *(Standard)* The adapter MAY implement `delta(since)` per PRD-200-R9 using the file mtime as the marker. The `since` value is the RFC 3339 timestamp the previous build completed; `delta` yields only files whose mtime is strictly greater than `since`. The adapter MUST persist no state of its own — the marker is opaque, supplied and stored by the generator. When `delta` is invoked, the adapter declares `capabilities.delta: true` from `init` per PRD-200-R22.

#### Capability declaration

**PRD-201-R22.** *(Core)* The `AdapterCapabilities` object returned from `init` MUST include at minimum:

```ts
{
  level: <"core" | "standard" | "plus">,    // determined per PRD-201-R23
  concurrency_max: 16,                       // markdown is CPU-bound; default 16
  delta: <boolean>,                          // true iff the adapter implements delta()
  namespace_ids: <boolean>,                  // default true; opt-out via config
  precedence: "primary",                     // markdown is a primary content source, never fallback
  summarySource: "extracted",                // the highest provenance the adapter can autonomously provide
  manifestCapabilities: {
    etag: true                               // adapter contributes etag-eligible nodes
  }
}
```

The `level` value is determined by the actual emission per PRD-201-R23; the adapter MUST NOT declare a level higher than what it emits.

**PRD-201-R23.** *(Core)* The level the adapter declares depends on its configuration and the source corpus:

- **Core** when (a) `mode: "coarse"`, (b) no `.mdx` files matched, and (c) the corpus contains no `:::`-style admonitions or GFM alerts that would force `callout` emission. (Coarse mode emits only `markdown` blocks per PRD-102-R1, plus the required envelope fields.)
- **Standard** when (a) `mode: "fine"` (which permits `prose`/`code`/`data`/`callout`) OR (b) the corpus contains callouts that would force fine-mode block emission, AND no `.mdx` is present.
- **Plus** when MDX inputs are present (because `marketing:placeholder` blocks are Plus per PRD-102-R22).

When `ctx.config.targetLevel` is below the level the adapter would otherwise declare, the adapter MUST refuse with an unrecoverable error per PRD-200-R24 — the adapter does NOT silently downgrade by stripping fine-mode blocks or MDX placeholders. Specifically:

- A Core-targeted build with `.mdx` files in the matched glob set MUST throw from `init` with an error citing the first MDX file. The remediation is either (a) exclude `.mdx` from `include`/`exclude`, (b) raise the target level, or (c) configure `mdx.enabled: false` (which causes the adapter to ignore `.mdx` files entirely; this is a documented opt-out).
- A Core-targeted build with `mode: "fine"` MUST throw from `init` citing the mode config.

#### Failure modes

**PRD-201-R24.** *(Core)* Recoverable failures in PRD-201 are mapped per PRD-200-R16 / PRD-200-R17:

| Failure | Status | Behavior |
|---|---|---|
| Summary extraction yields empty (file has no body paragraph) | `"partial"` | Substitute file-stem fallback; populate `metadata.extraction_error`. |
| MDX component prop expression contains a syntax the adapter cannot parse | `"partial"` | Emit placeholder with `metadata.props: { _raw: "<source text>" }`; populate `metadata.extraction_error`. |
| A `data` fence's body fails to parse under its declared format | `"partial"` | Emit `data` block with `text` set to the raw fence body and `value` omitted; populate `metadata.extraction_error`. |
| A file's body is empty (frontmatter only, no body) | `"partial"` | Emit a node with a single empty `markdown` block (coarse) or no body blocks (fine); summary extraction substitutes file-stem fallback per PRD-201-R17. |

In each case the adapter emits the partial node and surfaces a build warning per PRD-200-R16; exit code remains zero unless the generator's policy elevates warnings.

**PRD-201-R25.** *(Core)* Unrecoverable failures in PRD-201 are mapped per PRD-200-R18:

| Failure | Behavior |
|---|---|
| Malformed frontmatter (YAML / TOML parse error) | Throw from `transform` citing file and parse error. |
| Frontmatter sets a reserved metadata key (PRD-201-R6) | Throw citing the offending key. |
| Frontmatter sets `summary_source:` without `summary:` (PRD-201-R20) | Throw citing the file. |
| Frontmatter `id:` fails grammar validation after normalization (PRD-201-R9) | Throw citing the file and the rejected ID. |
| Default-derived `id` fails grammar validation after normalization (PRD-201-R8 step 5) | Throw citing the file and the rejected ID. |
| Within-adapter ID collision (PRD-201-R7) | Throw citing both source paths and the duplicate ID. |
| Target level mismatch (PRD-201-R23) | Throw from `init` citing the offending file or config. |
| `sourceDir` does not exist or is not a directory | Throw from `init`. |

The adapter MUST NOT silently drop a node on any of these conditions per PRD-200-R18.

#### Provenance

**PRD-201-R26.** *(Core)* Every emitted node MUST carry `metadata.source` populated per PRD-200-R13:

```ts
metadata.source = {
  adapter: "act-markdown",
  source_id: "<relPath>"     // file path relative to sourceDir, forward slashes
};
```

The framework's merge step (PRD-200-R12) populates `metadata.source.contributors` when other adapters merge into the same node.

#### Version pinning

**PRD-201-R27.** *(Core)* `act-markdown@0.1.x` is pinned to ACT spec `0.1` per PRD-200-R25 (Stage 1). The adapter MUST emit envelopes whose `act_version` is `"0.1"` and only `"0.1"`. The package's `package.json` MUST declare the supported `act_version` per PRD-400's mechanism (the exact field name — `actSpecVersion` / `peerDependencies` / etc. — is owned by PRD-400). When PRD-200 transitions to Stage 2 and `act-markdown` rebases on a Stage-2 release, the adapter MUST declare its `actSpecMinors` array per PRD-200-R26.

#### Test-fixture conformance

**PRD-201-R28.** *(Core)* The adapter MUST pass:

1. Every applicable PRD-200 framework fixture under `fixtures/200/` (PRD-200-R28). The applicable subset includes: `lifecycle-minimal-core.json`, `lifecycle-with-precheck.json`, `concurrency-bounded.json`, `id-namespacing-default.json`, `id-override-precedence.json`, `failure-partial-extraction.json`, `skip-via-null-return.json` (when the adapter is configured to drop drafts), `version-pinning-stage-1.json`, and the relevant negative fixtures (`init-credentials-invalid.expected.json` is N/A; `transform-emits-malformed-node.expected.json` and `transform-emits-id-uppercase.expected.json` apply).
2. Every PRD-201-specific fixture under `fixtures/201/`, enumerated in §"Test fixtures."

### Wire format / interface definition

PRD-201 introduces no new JSON wire shapes — every emitted envelope satisfies PRD-100. The contract is the TypeScript adapter shape and the config schema.

#### Adapter shape (TypeScript)

```ts
import type { Adapter, AdapterContext, AdapterCapabilities, EmittedNode } from "@act/adapter-framework";

export interface MarkdownAdapterConfig {
  sourceDir: string;
  include?: string[];          // default ["**/*.md", "**/*.mdx"]
  exclude?: string[];          // default ["**/node_modules/**", "**/.git/**", "**/.act/**"]
  idStrategy?: {
    stripPrefix?: string;
    namespace?: string;
  };
  mode?: "coarse" | "fine";    // default "coarse"
  frontmatter?: {
    format?: "yaml" | "toml" | "auto";   // default "auto"
    strict?: boolean;                     // default false
  };
  mdx?: {
    enabled?: boolean;                    // default true if any **/*.mdx glob matches
  };
  followSymlinks?: boolean;               // default true
}

export const markdownAdapter: Adapter<MarkdownAdapterConfig, MarkdownItem> = {
  name: "act-markdown",
  async init(config, ctx): Promise<AdapterCapabilities> { /* PRD-201-R1, R2, R22, R23 */ },
  async *enumerate(ctx): AsyncIterable<MarkdownItem> { /* PRD-201-R11 */ },
  async transform(item, ctx): Promise<EmittedNode | null> { /* PRD-201-R12-R20, R24-R26 */ },
  async delta(since, ctx): AsyncIterable<MarkdownItem> { /* PRD-201-R21 */ },
  async dispose(ctx) { /* PRD-200-R7 */ },
};

interface MarkdownItem {
  absPath: string;
  relPath: string;
  body: string;
  frontmatter: Record<string, unknown>;
  hasMdx: boolean;
}
```

#### Config schema (JSON Schema, abridged)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://act-spec.org/schemas/201/config.schema.json",
  "title": "act-markdown adapter config",
  "type": "object",
  "required": ["sourceDir"],
  "additionalProperties": false,
  "properties": {
    "sourceDir": { "type": "string", "minLength": 1 },
    "include": { "type": "array", "items": { "type": "string" } },
    "exclude": { "type": "array", "items": { "type": "string" } },
    "idStrategy": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "stripPrefix": { "type": "string" },
        "namespace": { "type": "string", "pattern": "^[a-z0-9]([a-z0-9._\\-]|/)*[a-z0-9]$" }
      }
    },
    "mode": { "type": "string", "enum": ["coarse", "fine"] },
    "frontmatter": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "format": { "type": "string", "enum": ["yaml", "toml", "auto"] },
        "strict": { "type": "boolean" }
      }
    },
    "mdx": {
      "type": "object",
      "additionalProperties": false,
      "properties": { "enabled": { "type": "boolean" } }
    },
    "followSymlinks": { "type": "boolean" }
  }
}
```

The full schema is published at `packages/act-markdown/schema/config.schema.json`.

### Errors

| Condition | Adapter behavior | Framework behavior | Exit |
|---|---|---|---|
| Malformed YAML / TOML frontmatter | Throw from `transform` | Build error, cite file + parse error | non-zero |
| Frontmatter sets reserved metadata key (R6) | Throw from `transform` | Build error, cite file + key | non-zero |
| Frontmatter `summary_source` without `summary` (R20) | Throw from `transform` | Build error, cite file | non-zero |
| Frontmatter `id:` fails grammar validation (R9) | Throw from `transform` | Build error, cite file + rejected ID | non-zero |
| Path-derived ID fails grammar validation after normalization (R8) | Throw from `transform` | Build error, cite file + rejected ID | non-zero |
| Within-adapter ID collision (R7) | Throw from `transform` | Build error, cite both files + ID | non-zero |
| `sourceDir` missing or not a directory | Throw from `init` | Build error | non-zero |
| Target-level mismatch — Core target with MDX or fine mode (R23) | Throw from `init` | Build error, cite file or config | non-zero |
| Empty body (frontmatter-only file) | Emit partial node, summary fallback to file stem | Build warning | 0 |
| Summary extraction yields empty (R17) | Emit partial node, summary fallback to file stem | Build warning | 0 |
| Data fence body fails to parse (R13 / R24) | Emit `data` block with `text` only, omit `value`, partial status | Build warning | 0 |
| MDX prop expression unparseable (R15 / R24) | Emit placeholder with `_raw` prop blob, partial status | Build warning | 0 |
| File's mtime regression breaks `delta` ordering | Adapter falls back to full enumerate; warns | Build warning | 0 |

The wire-format shape of build errors and warnings — how the generator surfaces them to the user — is owned by PRD-400. PRD-201 specifies only the adapter-side obligations.

---

## Examples

Worked examples are non-normative but MUST be consistent with the Specification section. Each maps to one or more positive fixtures under `fixtures/201/positive/`.

### Example 1 — Minimal Core file (path-derived ID, extracted summary)

Source file at `<sourceDir>/intro/getting-started.md`:

```markdown
---
title: Getting Started
tags: [intro, onboarding]
---

# Getting Started

Welcome to ACT. This guide walks you through your first integration.

## Prerequisites

You will need Node.js 20+ and a content directory.
```

Emitted node (coarse mode, target Core):

```json
{
  "act_version": "0.1",
  "id": "intro/getting-started",
  "type": "article",
  "title": "Getting Started",
  "etag": "",
  "summary": "Welcome to ACT. This guide walks you through your first integration.",
  "summary_source": "extracted",
  "tags": ["intro", "onboarding"],
  "content": [
    { "type": "markdown", "text": "# Getting Started\n\nWelcome to ACT. This guide walks you through your first integration.\n\n## Prerequisites\n\nYou will need Node.js 20+ and a content directory.\n" }
  ],
  "tokens": { "summary": 11, "body": 38 },
  "metadata": {
    "source": { "adapter": "act-markdown", "source_id": "intro/getting-started.md" }
  }
}
```

Maps to `fixtures/201/positive/core-coarse-extracted-summary.json`.

### Example 2 — Frontmatter override + author summary (Standard, fine mode)

Source file at `<sourceDir>/guides/auth.md`:

```markdown
---
id: auth
title: Authentication
summary: How ACT runtime endpoints negotiate authentication.
tags: [security, runtime]
related:
  - { id: tokens, relation: "see-also" }
  - core/concepts
---

ACT runtime endpoints support cookie, bearer, and OAuth 2.0.

```bash
curl -H "Authorization: Bearer $TOKEN" https://example.com/act/n/auth.json
```

> [!WARNING]
> Never commit your bearer token to source control.
```

Emitted node (fine mode, target Standard):

```json
{
  "act_version": "0.1",
  "id": "auth",
  "type": "article",
  "title": "Authentication",
  "etag": "",
  "summary": "How ACT runtime endpoints negotiate authentication.",
  "summary_source": "author",
  "tags": ["security", "runtime"],
  "related": [
    { "id": "tokens", "relation": "see-also" },
    { "id": "core/concepts", "relation": "see-also" }
  ],
  "content": [
    { "type": "prose", "format": "markdown", "text": "ACT runtime endpoints support cookie, bearer, and OAuth 2.0." },
    { "type": "code", "language": "bash", "text": "curl -H \"Authorization: Bearer $TOKEN\" https://example.com/act/n/auth.json" },
    { "type": "callout", "level": "warning", "text": "Never commit your bearer token to source control." }
  ],
  "tokens": { "summary": 9, "body": 52 },
  "metadata": {
    "source": { "adapter": "act-markdown", "source_id": "guides/auth.md" }
  }
}
```

Notes: frontmatter `id: auth` overrides the path-derived `guides/auth`; `related` array's plain string entry was upgraded to `{ id, relation: "see-also" }` per PRD-201-R4; the GFM-alert `[!WARNING]` mapped to `level: "warning"` per PRD-201-R14. Maps to `fixtures/201/positive/standard-fine-author-summary.json`.

### Example 3 — Data fence emission

Source body excerpt:

```markdown
The default config:

```json data filename=defaults.json
{ "concurrency_max": 8, "namespace_ids": true }
```
```

Emitted block (fine mode):

```json
{
  "type": "data",
  "format": "json",
  "text": "{ \"concurrency_max\": 8, \"namespace_ids\": true }",
  "value": { "concurrency_max": 8, "namespace_ids": true },
  "metadata": { "fence_attrs": { "filename": "defaults.json" } }
}
```

Maps to `fixtures/201/positive/data-fence-with-attrs.json`.

### Example 4 — MDX placeholder (Plus)

Source MDX at `<sourceDir>/landing.mdx`:

```mdx
---
title: Landing
---

import { Hero } from "../components/Hero";

# Welcome

<Hero headline="Build with ACT" subhead="Open agent content tree" cta={{ label: "Start", href: "/start" }} />

ACT is an open standard for agent-readable content trees.
```

Emitted node (Plus target, fine mode):

```json
{
  "act_version": "0.1",
  "id": "landing",
  "type": "article",
  "title": "Landing",
  "etag": "",
  "summary": "ACT is an open standard for agent-readable content trees.",
  "summary_source": "extracted",
  "content": [
    { "type": "prose", "format": "markdown", "text": "# Welcome" },
    {
      "type": "marketing:placeholder",
      "metadata": {
        "extracted_via": "component-contract",
        "extraction_status": "partial",
        "component": "Hero",
        "props": {
          "headline": "Build with ACT",
          "subhead": "Open agent content tree",
          "cta": { "label": "Start", "href": "/start" }
        },
        "location": { "file": "landing.mdx", "line": 7, "col": 1 }
      }
    },
    { "type": "prose", "format": "markdown", "text": "ACT is an open standard for agent-readable content trees." }
  ],
  "tokens": { "summary": 11, "body": 28 },
  "metadata": {
    "source": { "adapter": "act-markdown", "source_id": "landing.mdx" }
  }
}
```

When PRD-300's component-contract layer composes via PRD-200-R12 multi-source merge, the placeholder is replaced by a fully-extracted `marketing:hero` block emitting from the `Hero` component's `extract` function. The merge step replaces the placeholder in-place and preserves the `metadata.location` for diagnostics. Maps to `fixtures/201/positive/mdx-placeholder.json`.

### Example 5 — Reserved-key violation (negative)

Source file's frontmatter:

```yaml
---
title: Bad
metadata:
  source:
    adapter: my-fake-adapter
---
```

The adapter throws from `transform` per PRD-201-R6 / PRD-201-R25, citing the file path and the reserved key `metadata.source`. Build exits non-zero. Maps to `fixtures/201/negative/reserved-key-metadata-source.expected.json`.

---

## Test fixtures

Fixtures live under `fixtures/201/`. Per PRD-200-R28, every applicable framework fixture under `fixtures/200/` MUST also pass.

### Positive

- `fixtures/201/positive/core-coarse-extracted-summary.json` → satisfies R1, R3, R4, R8, R12 (coarse), R17, R18, R20, R26, R27, R28. Example 1.
- `fixtures/201/positive/standard-fine-author-summary.json` → satisfies R3, R4, R9, R12 (fine), R13, R14, R17 (author path), R20, R26. Example 2.
- `fixtures/201/positive/data-fence-with-attrs.json` → satisfies R13. Example 3.
- `fixtures/201/positive/mdx-placeholder.json` → satisfies R15, R16, R23 (Plus path). Example 4.
- `fixtures/201/positive/index-md-collapses-to-parent.json` → satisfies R8. A file at `<sourceDir>/intro/index.md` emits ID `intro`.
- `fixtures/201/positive/path-derived-special-chars.json` → satisfies R8 step 4. A file at `<sourceDir>/Hello World — Notes.md` emits ID `hello-world-notes`.
- `fixtures/201/positive/frontmatter-id-override.json` → satisfies R9. A file at `<sourceDir>/old/path.md` with frontmatter `id: new-canonical` emits ID `new-canonical`.
- `fixtures/201/positive/config-stripprefix.json` → satisfies R10. Config `idStrategy.stripPrefix: "docs/"` strips the `docs/` prefix from path-derived IDs.
- `fixtures/201/positive/related-string-array-upgrade.json` → satisfies R4. Frontmatter `related: [foo, bar]` emits `[{ id: "foo", relation: "see-also" }, { id: "bar", relation: "see-also" }]`.
- `fixtures/201/positive/unknown-frontmatter-key-preserved.json` → satisfies R5. Frontmatter `author: "Jane Doe"` emits `metadata.author: "Jane Doe"`.
- `fixtures/201/positive/admonition-mdx-style.json` → satisfies R14 (`:::warning ... :::`).
- `fixtures/201/positive/gfm-alert-callout.json` → satisfies R14 (`> [!NOTE]`).
- `fixtures/201/positive/empty-body-partial.json` → satisfies R17, R24. Frontmatter-only file emits a partial node with file-stem fallback summary.
- `fixtures/201/positive/delta-incremental.json` → satisfies R21. Two-run sequence: full enumerate, then `delta(since)` returns only the file whose mtime advanced.
- `fixtures/201/positive/capability-declaration-core.json` → satisfies R22, R23. Coarse + no MDX → declared `level: "core"`.
- `fixtures/201/positive/capability-declaration-plus.json` → satisfies R22, R23. MDX present → declared `level: "plus"`.
- `fixtures/201/positive/provenance-source-id.json` → satisfies R26. Emitted node carries `metadata.source.adapter: "act-markdown"` and `metadata.source.source_id` matching the relative path.
- `fixtures/201/positive/lexicographic-enumerate-order.json` → satisfies R11. Files emitted in `Intl.Collator` order; reproducible across runs.

### Negative

- `fixtures/201/negative/malformed-yaml-frontmatter.expected.json` → R3, R25. Frontmatter `---` block with invalid YAML. Adapter throws; build exits non-zero.
- `fixtures/201/negative/reserved-key-metadata-source.expected.json` → R6, R25. Frontmatter sets `metadata.source.adapter`. Adapter throws.
- `fixtures/201/negative/reserved-key-extraction-status.expected.json` → R6. Frontmatter sets `metadata.extraction_status: "complete"`.
- `fixtures/201/negative/reserved-key-locale.expected.json` → R6. Frontmatter sets `metadata.locale: "en-US"`. (PRD-104 / PRD-207 own locale provenance; the markdown adapter MUST NOT.)
- `fixtures/201/negative/summary-source-without-summary.expected.json` → R20, R25. Frontmatter sets `summary_source: "llm"` without `summary:`.
- `fixtures/201/negative/frontmatter-id-uppercase.expected.json` → R9, R25. Frontmatter `id: "Foo-Bar"` fails grammar validation after normalization (the normalization is not a silent lowercase — it warns per R9 — but a frontmatter ID containing characters the grammar disallows after normalization throws).
- `fixtures/201/negative/within-adapter-id-collision.expected.json` → R7, R25. Two files whose default-derived IDs collide.
- `fixtures/201/negative/core-target-with-mdx.expected.json` → R23, R25. Target `"core"` with `.mdx` files in `include`. Adapter throws from `init`.
- `fixtures/201/negative/core-target-with-fine-mode.expected.json` → R23, R25. Target `"core"` with `mode: "fine"`. Adapter throws from `init`.
- `fixtures/201/negative/sourcedir-missing.expected.json` → R25. `sourceDir` does not exist. Adapter throws from `init`.
- `fixtures/201/negative/data-fence-malformed-but-recoverable.expected.json` → R24. Data fence with declared `format: "json"` but malformed body. Emits partial node (recoverable).

PRD-600's fixture-runner exercises every entry above plus the framework subset cited in R28.

---

## Versioning & compatibility

Per PRD-108, classify each kind of change to PRD-201 as MAJOR or MINOR.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a recognized frontmatter key (e.g., `canonical_url`) | MINOR | PRD-108-R4(1). Existing adapters preserve unknown keys on `metadata` per R5; promoting one to a recognized key is additive. |
| Add a value to the `mode` enum (e.g., `"hybrid"`) | MAJOR | PRD-108-R5(4). Closed enum. |
| Add a recognized fence info language (e.g., `kotlin`) | MINOR | PRD-108-R4(3). PRD-102-R3's `language` is documented-open. |
| Change the default `mode` from `"coarse"` to `"fine"` | MAJOR | PRD-108-R5(7). Default-behavior change. |
| Add a reserved metadata key (extending R6) | MAJOR | PRD-108-R5(7). Producers' frontmatter that previously round-tripped now throws. |
| Drop a recognized frontmatter key | MAJOR | PRD-108-R5(1). |
| Add an optional config field | MINOR | PRD-108-R4(1). |
| Change ID-derivation rules (e.g., stop collapsing `index.md`) | MAJOR | PRD-108-R5(7). |
| Tighten unknown-key preservation to "MUST drop" | MAJOR | PRD-108-R5(3). |
| Add an admonition keyword (e.g., `:::success`) | MINOR | PRD-108-R4(1). |
| Add a value to the GFM-alert keyword set (`[!ANNOUNCEMENT]`) | MINOR | Maps to existing closed `level` enum (PRD-102-R5); enum unchanged. |
| Promote `delta` from optional to required | MAJOR | PRD-108-R5(3). |
| Loosen YAML 1.2 / TOML 1.0 to "any reasonable parser" | MAJOR | PRD-108-R5(7). Parser determinism is consumer-affecting. |

### Forward compatibility

A consumer reading PRD-201 v0.1 output MUST tolerate unknown `metadata.*` keys per PRD-108-R7. A future version of PRD-201 that adds recognized frontmatter keys or admonition keywords is additive — output emitted by older adapters continues to validate.

### Backward compatibility

A v0.1 PRD-201 adapter run against a v0.2 framework is unaffected provided no MAJOR change has been made to the `Adapter` interface (PRD-200) or to PRD-100's node envelope. Stage 2 pinning (PRD-200-R26) opens the path for a single adapter version to support spec `0.1` and `0.2` once Stage 2 is in effect.

---

## Security considerations

This section cites PRD-109 (Accepted) for the project-wide threat model and documents only adapter-specific deltas.

**Path-traversal in derived IDs.** The default ID strategy (PRD-201-R8) derives IDs from filesystem paths under `sourceDir`. The adapter MUST refuse to process files whose resolved absolute path does not lie within `sourceDir` (i.e., MUST detect symlink escape). When `followSymlinks: true` (default), the adapter MUST canonicalize each resolved path with `fs.realpath` and compare against `sourceDir`'s canonicalized prefix; mismatches are unrecoverable per PRD-200-R18. This prevents a content-author with write access to a symlink target outside `sourceDir` from injecting nodes whose `metadata.source.source_id` claims an in-corpus path while the actual content lives outside.

**Frontmatter-injected reserved keys.** PRD-201-R6 reserves a fixed set of `metadata.*` keys (framework + i18n). A content author who controls frontmatter but not the build pipeline MUST NOT be able to inject `metadata.source.adapter` (forging provenance), `metadata.locale` (forging i18n attribution), or `metadata.extraction_status` (faking partial-extraction badging). The reserved-key check (PRD-201-R25) is the security control; PRD-600's fixture corpus exercises each reserved key as a negative fixture.

**MDX prop sanitization.** PRD-201-R15 emits MDX component prop literals on `metadata.props`. The literals are author-controlled JSX expressions; the adapter MUST NOT execute them and MUST NOT trust them as structural inputs to PRD-300's `extract` without re-validation. The `_expr` form (for non-literal props) is a string passthrough; PRD-300's `extract` is responsible for treating it as untrusted source. PRD-201 does not introspect JSX expressions and does not execute any embedded code.

**Markdown-embedded HTML.** CommonMark permits raw HTML, including `<script>` and `<iframe>`. PRD-201 does NOT sanitize HTML on emission — the `markdown`-block `text` is the source verbatim per PRD-102-R1. Consumers (renderers, agent runtimes, downstream tooling) MUST sanitize per their threat model. PRD-109 documents the project-wide posture; PRD-201's contribution is to NOT pre-sanitize, so consumers receive faithful source rather than a falsely-safe rendering. The PRD-102 security section also calls this out.

**File-content size DoS.** A pathologically large `.md` file (e.g., 10MB of generated text) can blow up token counting and downstream parsing. The adapter MUST refuse files larger than 2MB by default; a configurable `maxFileSize` MAY relax. Files exceeding the limit emit a partial node per PRD-201-R24 with `metadata.extraction_error` set; the partial node has a single empty `markdown` block and a file-stem fallback summary. (This is a recoverable failure rather than unrecoverable to keep oversize source files from breaking the build for legitimate large content like generated API references.)

**Frontmatter-as-config-injection.** Frontmatter keys flow into the emitted node. A content author with frontmatter access can populate any non-reserved field — including `tags`, `related`, `parent`. PRD-201 trusts the corpus author for these fields; the trust boundary is "filesystem write access to `sourceDir`." Operators serving content from untrusted authors MUST apply upstream review (CODEOWNERS, PR review) before frontmatter reaches the build.

**Credential handling.** PRD-201 does not consume credentials. There are no secrets in the adapter's config (per PRD-201-R2). PRD-109's credential-redaction rules apply trivially. Operators MUST NOT layer credential-bearing frontmatter into the corpus and SHOULD treat the corpus as world-readable from a security perspective.

For all other concerns — runtime auth, ETag determinism, cross-origin trust, PII in error messages — cite PRD-109 directly. PRD-201 introduces no new transport surface and runs entirely at build time.

---

## Implementation notes

This section is required for adapter PRDs per the workflow.md Phase 3 addition. Snippets show the canonical TypeScript shape; full implementations live in `packages/act-markdown/`.

### Snippet 1 — Adapter skeleton

```ts
// packages/act-markdown/src/index.ts

import type { Adapter, AdapterContext, AdapterCapabilities, EmittedNode } from "@act/adapter-framework";
import { walkSource, parseFrontmatter, parseBody, deriveId, deriveSummary } from "./internal";

export const markdownAdapter: Adapter<MarkdownAdapterConfig, MarkdownItem> = {
  name: "act-markdown",

  async init(config, ctx): Promise<AdapterCapabilities> {
    const stat = await fs.stat(config.sourceDir).catch(() => null);
    if (!stat?.isDirectory()) {
      throw new AdapterError(`sourceDir '${config.sourceDir}' is not a directory`);
    }
    const hasMdx = config.include?.some((g) => g.endsWith(".mdx")) ?? true;
    const mode = config.mode ?? "coarse";
    const level = hasMdx ? "plus" : mode === "fine" ? "standard" : "core";
    if (level !== ctx.config.targetLevel && rankOf(level) > rankOf(ctx.config.targetLevel)) {
      throw new AdapterError(
        `target level '${ctx.config.targetLevel}' is below adapter's emission level '${level}' (PRD-201-R23)`,
      );
    }
    return {
      level,
      concurrency_max: 16,
      delta: true,
      namespace_ids: true,
      precedence: "primary",
      summarySource: "extracted",
      manifestCapabilities: { etag: true },
    };
  },

  async *enumerate(ctx) {
    yield* walkSource(this.config!, ctx.signal);  // R11
  },

  async transform(item, ctx): Promise<EmittedNode | null> {
    return buildNode(item, this.config!, ctx);
  },

  async delta(since, ctx) {
    yield* walkSource(this.config!, ctx.signal, { sinceMtime: since });
  },

  async dispose() { /* nothing to release */ },
};

export default markdownAdapter;
```

### Snippet 2 — File walk (PRD-201-R11)

```ts
// packages/act-markdown/src/internal/walk.ts

import { Collator } from "intl";
import { glob } from "fast-glob";

export async function* walkSource(
  config: MarkdownAdapterConfig,
  signal: AbortSignal,
  opts: { sinceMtime?: string } = {},
): AsyncIterable<MarkdownItem> {
  const include = config.include ?? ["**/*.md", "**/*.mdx"];
  const exclude = config.exclude ?? ["**/node_modules/**", "**/.git/**", "**/.act/**"];
  const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
  const paths = (await glob(include, {
    cwd: config.sourceDir,
    ignore: exclude,
    followSymbolicLinks: config.followSymlinks ?? true,
    onlyFiles: true,
  })).sort(collator.compare);

  for (const relPath of paths) {
    if (signal.aborted) return;
    const absPath = path.resolve(config.sourceDir, relPath);
    if (!isUnderRoot(absPath, config.sourceDir)) {
      throw new AdapterError(`path-traversal: '${relPath}' resolves outside sourceDir`);
    }
    const stat = await fs.stat(absPath);
    if (opts.sinceMtime && stat.mtime.toISOString() <= opts.sinceMtime) continue;

    const raw = await fs.readFile(absPath, "utf8");
    const { frontmatter, body } = parseFrontmatter(raw, config.frontmatter);
    yield { absPath, relPath, body, frontmatter, hasMdx: relPath.endsWith(".mdx") };
  }
}
```

### Snippet 3 — Frontmatter parsing with reserved-key check (PRD-201-R3, R6)

```ts
// packages/act-markdown/src/internal/frontmatter.ts

const RESERVED_METADATA_KEYS = new Set([
  "source", "extraction_status", "extraction_error", "extracted_via",
  "locale", "translations", "translation_status", "fallback_from",
  "variant", "contributors",
]);

export function parseFrontmatter(raw: string, opts: { format?: "yaml" | "toml" | "auto" }): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const m = raw.match(/^(---|\+\+\+)\s*\r?\n([\s\S]*?)\r?\n\1\s*\r?\n?/);
  if (!m) return { frontmatter: {}, body: raw };

  const delim = m[1] as "---" | "+++";
  const declared = opts.format ?? "auto";
  if (declared !== "auto" && ((declared === "yaml" && delim !== "---") || (declared === "toml" && delim !== "+++"))) {
    throw new AdapterError(`frontmatter delimiter '${delim}' does not match declared format '${declared}'`);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = delim === "---" ? yaml.parse(m[2]) : toml.parse(m[2]);
  } catch (err) {
    throw new AdapterError(`malformed ${delim === "---" ? "YAML" : "TOML"} frontmatter: ${(err as Error).message}`);
  }

  const md = (parsed.metadata as Record<string, unknown> | undefined) ?? {};
  for (const key of Object.keys(md)) {
    if (RESERVED_METADATA_KEYS.has(key)) {
      throw new AdapterError(`frontmatter sets reserved metadata key 'metadata.${key}' (PRD-201-R6)`);
    }
  }

  if (parsed.summary_source !== undefined && parsed.summary === undefined) {
    throw new AdapterError(`frontmatter sets 'summary_source' without 'summary' (PRD-201-R20)`);
  }

  return { frontmatter: parsed, body: raw.slice(m[0].length) };
}
```

### Snippet 4 — ID derivation (PRD-201-R8, R9, R10)

```ts
// packages/act-markdown/src/internal/id.ts

export function deriveId(
  relPath: string,
  frontmatter: Record<string, unknown>,
  config: MarkdownAdapterConfig,
  ctx: AdapterContext,
): string {
  // Frontmatter override wins (PRD-201-R9 / PRD-100-R14).
  if (typeof frontmatter.id === "string") {
    const normalized = normalize(frontmatter.id);
    if (normalized !== frontmatter.id) {
      ctx.logger.warn(`frontmatter id '${frontmatter.id}' normalized to '${normalized}'`);
    }
    if (!ctx.idMinter.validate(normalized)) {
      throw new AdapterError(`frontmatter id '${frontmatter.id}' fails PRD-100-R10 grammar`);
    }
    return normalized;
  }

  // Default path-derived (PRD-201-R8) with config rules (PRD-201-R10).
  let stem = relPath.replace(/\.(md|mdx)$/i, "");
  if (config.idStrategy?.stripPrefix) {
    stem = stem.startsWith(config.idStrategy.stripPrefix)
      ? stem.slice(config.idStrategy.stripPrefix.length)
      : stem;
  }
  if (stem.endsWith("/index")) stem = stem.slice(0, -"/index".length);
  if (stem === "" || stem === "index") stem = "index";  // root_id default
  if (config.idStrategy?.namespace) stem = `${config.idStrategy.namespace}/${stem}`;

  const id = normalize(stem);
  if (!ctx.idMinter.validate(id)) {
    throw new AdapterError(`derived id '${id}' from path '${relPath}' fails PRD-100-R10 grammar`);
  }
  return id;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9._\-/]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}
```

### Snippet 5 — Body to blocks (coarse + fine, PRD-201-R12, R13, R14)

```ts
// packages/act-markdown/src/internal/blocks.ts

import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkDirective from "remark-directive";

export function bodyToBlocks(body: string, hasMdx: boolean, mode: "coarse" | "fine"): ContentBlock[] {
  if (mode === "coarse" && !hasMdx) {
    return [{ type: "markdown", text: body }];
  }

  const tree = unified().use(remarkParse).use(remarkGfm).use(remarkDirective).parse(body);
  const blocks: ContentBlock[] = [];

  for (const node of tree.children) {
    if (node.type === "code") {
      const info = (node.lang ?? "") + (node.meta ? ` ${node.meta}` : "");
      blocks.push(parseFenceInfo(info, node.value));     // R13
    } else if (node.type === "containerDirective" || node.type === "leafDirective") {
      blocks.push(directiveToCallout(node));             // R14
    } else if (node.type === "blockquote" && isGfmAlert(node)) {
      blocks.push(gfmAlertToCallout(node));              // R14
    } else if (isMdxJsxElement(node)) {
      blocks.push(mdxToPlaceholder(node));               // R15
    } else {
      blocks.push({ type: "prose", format: "markdown", text: nodeToMarkdownSource(node) });
    }
  }
  return blocks;
}

function parseFenceInfo(info: string, text: string): ContentBlock {
  const tokens = info.trim().split(/\s+/);
  const language = (tokens[0] ?? "").toLowerCase();
  const isData = tokens[1] === "data";
  if (isData) {
    const fenceAttrs = parseAttrs(tokens.slice(2));
    let value: unknown;
    let extraction_status: "complete" | "partial" = "complete";
    let extraction_error: string | undefined;
    try {
      value = parseDataFormat(language, text);
    } catch (err) {
      extraction_status = "partial";
      extraction_error = (err as Error).message;
    }
    return {
      type: "data",
      format: language || "text",
      text,
      ...(value !== undefined ? { value } : {}),
      metadata: {
        ...(Object.keys(fenceAttrs).length ? { fence_attrs: fenceAttrs } : {}),
        ...(extraction_error ? { extraction_status, extraction_error } : {}),
      },
    };
  }
  return { type: "code", language: language || "text", text };
}
```

### Snippet 6 — Summary derivation (PRD-201-R17, R18, R19, R20)

```ts
// packages/act-markdown/src/internal/summary.ts

export function deriveSummary(
  body: string,
  frontmatter: Record<string, unknown>,
  tokenizer: Tokenizer,
): { summary: string; summary_source: string; partial?: { status: "partial"; error: string } } {
  if (typeof frontmatter.summary === "string" && frontmatter.summary.trim() !== "") {
    return {
      summary: frontmatter.summary.trim(),
      summary_source: typeof frontmatter.summary_source === "string"
        ? frontmatter.summary_source
        : "author",
    };
  }
  const extracted = extractFirstParagraph(body);     // R18
  if (!extracted) {
    return {
      summary: "(extraction failed)",                 // caller substitutes file-stem fallback
      summary_source: "extracted",
      partial: { status: "partial", error: "summary extraction yielded empty" },
    };
  }
  const truncated = truncateToTokens(extracted, 50, tokenizer);  // R19
  return { summary: truncated, summary_source: "extracted" };
}
```

### Snippet 7 — MDX placeholder emission (PRD-201-R15)

```ts
// packages/act-markdown/src/internal/mdx.ts

import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";

export function mdxToPlaceholder(node: MdxJsxFlowElement, file: string): ContentBlock {
  const props: Record<string, unknown> = {};
  for (const attr of node.attributes ?? []) {
    if (attr.type !== "mdxJsxAttribute") continue;
    if (typeof attr.value === "string" || attr.value === null) {
      props[attr.name] = attr.value;
    } else if (attr.value?.type === "mdxJsxAttributeValueExpression") {
      props[attr.name] = parseExprLiteral(attr.value.value) ?? { _expr: attr.value.value };
    }
  }
  return {
    type: "marketing:placeholder",
    metadata: {
      extracted_via: "component-contract",
      extraction_status: "partial",
      component: node.name ?? "<anonymous>",
      props,
      location: { file, line: node.position?.start.line ?? 0, col: node.position?.start.column ?? 0 },
    },
  };
}

function parseExprLiteral(src: string): unknown | undefined {
  // Try parsing as a JSON-compatible literal; return undefined if non-static.
  try { return JSON.parse(src); } catch { return undefined; }
}
```

### Snippet 8 — Composing transform (the canonical flow)

```ts
// packages/act-markdown/src/internal/transform.ts

export async function buildNode(
  item: MarkdownItem,
  config: MarkdownAdapterConfig,
  ctx: AdapterContext,
): Promise<EmittedNode> {
  const id = deriveId(item.relPath, item.frontmatter, config, ctx);
  const { summary, summary_source, partial } = deriveSummary(item.body, item.frontmatter, ctx.tokenizer);
  const finalSummary = partial ? fileStemFallback(item.relPath) : summary;

  const blocks = bodyToBlocks(item.body, item.hasMdx, config.mode ?? "coarse");

  const node: EmittedNode = {
    act_version: ctx.config.actVersion,
    id,
    type: (item.frontmatter.type as string | undefined) ?? "article",
    title: (item.frontmatter.title as string | undefined) ?? deriveTitleFromBody(item.body) ?? deriveTitleFromStem(item.relPath),
    etag: "",
    summary: finalSummary,
    summary_source,
    content: blocks,
    tokens: {
      summary: ctx.tokenizer.count(finalSummary),
      body: ctx.tokenizer.count(item.body),
    },
    ...(item.frontmatter.tags ? { tags: item.frontmatter.tags as string[] } : {}),
    ...(item.frontmatter.parent ? { parent: item.frontmatter.parent as string } : {}),
    ...(item.frontmatter.related ? { related: normalizeRelated(item.frontmatter.related) } : {}),
    metadata: {
      ...preservedMetadata(item.frontmatter),
      source: { adapter: "act-markdown", source_id: item.relPath },
      ...(partial ? { extraction_status: partial.status, extraction_error: partial.error } : {}),
    },
  };

  return node;
}
```

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft. Pins the markdown / MDX adapter behavior on top of PRD-200's framework: file-discovery via globs (R11) with deterministic Intl.Collator ordering, YAML 1.2 / TOML 1.0 frontmatter parsing (R3) with a recognized-key set covering `id`, `title`, `summary`, `summary_source`, `tags`, `parent`, `related`, `type`, `metadata.*` (R4), unknown-key preservation on `metadata` (R5), reserved-key rejection covering `metadata.source` / `metadata.extraction_status` / `metadata.extracted_via` / `metadata.locale` / `metadata.translations` / `metadata.translation_status` / `metadata.fallback_from` / `metadata.variant` (R6), within-adapter ID-collision detection (R7), the path-derived ID strategy with `index.md` collapsing and Unicode-safe normalization (R8), the frontmatter-overrides-config-overrides-default ID precedence per PRD-100-R14 (R9, R10), the coarse-vs-fine body-to-blocks mode (R12) with code-fence → `code` / data-fence → `data` (R13) and admonition → `callout` (R14, GFM-alerts AND `:::`-style), the MDX seam emitting `marketing:placeholder` blocks per PRD-102-R22 / PRD-200-R27 with `metadata.props` preserved (R15), block-order preservation (R16), the summary-derivation rule (R17, R18, R19, R20) with frontmatter wins → first-paragraph extraction → file-stem fallback, mtime-based `delta(since)` (R21), the capability-declaration shape (R22) and level-aware-emission rule that refuses Core target with MDX or fine mode (R23), the recoverable / unrecoverable failure split (R24, R25) tied verbatim to PRD-200-R16 / R18, the provenance-stamping rule (R26), Stage-1 version pinning (R27) per PRD-200-R25, and the test-fixture conformance rule (R28). Test fixtures enumerated under `fixtures/201/positive/` (18 entries) and `fixtures/201/negative/` (11 entries). Implementation notes ship 8 short TS snippets covering the adapter skeleton, file walk with path-traversal guard, frontmatter parsing with reserved-key check, ID derivation, body-to-blocks with code / data / callout / MDX paths, summary derivation, MDX placeholder emission, and the composed `transform` flow. Cites PRD-200 (in review) for the framework contract; PRD-100, PRD-102, PRD-107, PRD-108, PRD-109 (Accepted) for the wire-format / block-taxonomy / level / versioning / security obligations. Status set to `In review`. |
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review; no normative changes. Decisions: (1) JSON frontmatter deferred to v0.2; (2) `index.md` collapses to parent directory in path-derived IDs; (3) coarse single-`markdown`-block mode remains the default; (4) MDX preserves component prop literals on `metadata.props`; (5) callouts recognize both GFM-alerts (`> [!NOTE]`) and `:::note` admonitions. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
