# PRD-703 — Blog (Hugo + markdown) (spec only)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

> **Spec-only PRD.** Per decision Q3 (`prd/000-decisions-needed.md`) and PRD-402 (Hugo module, spec only), no first-party Hugo-based reference build ships in v0.1. PRD-703 specifies what a conformant Hugo + markdown blog site MUST emit; community-authored Hugo modules that satisfy PRD-402's contract produce build artifacts that satisfy PRD-703 as a downstream consequence. PRD-707 (Eleventy + markdown blog) is the v0.1 first-party TS counterpart that exercises the same shape under a TS-implementable generator. Operators who need a TS-impl blog use PRD-707; operators staying on Hugo follow PRD-703 and a community port of PRD-402.

### Problem

Blogs are the simplest end-to-end ACT consumer: a chronological feed of `type: "post"` nodes plus a small site-level shell (about page, archives index, RSS hand-off). The v0.1 working draft §8.2 sketches the shape in two sentences ("`type: post`, `parent: root` (or year-based), `summary` = excerpt, `body` = post content. The index becomes a chronological feed an agent can scan"). PRD-703 turns that sketch into a buildable reference and validates it against PRD-600.

The pragmatic constraint is the toolchain. Hugo is the dominant Go-based static-site generator; it is not a TypeScript runtime, so the v0.1 first-party ACT generator cannot ship under PRD-402's first-party-implementation constraint (decision Q3 — TS-only first-party reference impls). PRD-402 is therefore *spec only*: the contract describes what a conformant Hugo module MUST emit, and the validator (PRD-600) certifies the bytes it produces. PRD-703 inherits that posture: it specifies what a conformant Hugo + markdown blog site emits, but ships no first-party Hugo build of itself.

A community-authored Hugo module satisfying PRD-402 produces, when run against a Hugo blog meeting PRD-703's source conventions, an ACT tree that PRD-703 specifies. PRD-707 is the corresponding first-party TS-implementable example built atop PRD-408 (Eleventy plugin) — operators who want a working blog reference today use PRD-707; operators who want to know what a Hugo blog *would* emit under conformant ACT use PRD-703.

### Site description

- **Stack.** Hugo (community-ported) + markdown frontmatter (TOML, YAML, or JSON; PRD-201 / PRD-402 recognize all three). No JavaScript framework; no CMS.
- **Content scale.** ~30–100 posts. Single locale (`en-US`). No componentized blocks; every post body is markdown rendered to a single `markdown` block (PRD-102-R1) or, in fine-grained mode, to a sequence of `prose` / `code` / `data` blocks per PRD-201-R12.
- **Site shape.** A typical Hugo blog: `content/posts/*.md` for posts, `content/_index.md` for the home page, `content/about/_index.md` for an about section, optional `content/tags/*.md` for tag-archive landing pages.
- **Conformance target.** Standard. The example exercises Standard's additive surface (subtree files at section roots, optional `abstract`, `related` cross-references between posts via tags) but not Plus's `marketing:*` namespace, NDJSON, search, or i18n.
- **Author workflow.** Operators write markdown with frontmatter; Hugo's existing build emits HTML; the community Hugo module emits ACT artifacts under `public/`. PRD-402 documents the wrapper-script integration (`hugo && act-hugo emit`) since Hugo lacks a published post-build hook.

### Goals

1. Specify the canonical emitted ACT shape for a Hugo + markdown blog: per-post nodes of `type: "post"`, a chronological index, section-root subtree files, and a manifest declaring `delivery: "static"` and `conformance.level: "standard"`.
2. Pin the post-node shape: `parent` either `"root"` or a year-derived bucket (`"2025"`, `"2026"`); `summary` derived from frontmatter `summary` or the post's first paragraph; `content[]` from the markdown body.
3. Specify how Hugo's section hierarchy (`content/posts/*` under `content/_index.md`) maps to ACT `parent` / `children` per PRD-402-R10.
4. Specify how Hugo's `tags` taxonomy maps to `metadata.tags[]` and to cross-post `related[]` (siblings sharing a tag).
5. Provide concrete file-by-file emission expectations for a 50-post fixture under the Standard band.
6. Provide sample frontmatter, a sample `hugo.toml` snippet, and an indication of the emitted-output shape — without shipping a working build (per the spec-only posture).

### Non-goals

1. **Authoring a Hugo module.** Owned by a community port of PRD-402.
2. **Defining the markdown adapter contract.** Owned by PRD-201.
3. **Defining the Hugo generator contract.** Owned by PRD-402.
4. **Multi-locale Hugo sites.** PRD-402-R13 documents the Pattern 2 default for multi-locale Hugo; PRD-703 stays single-locale to keep the example small.
5. **RSS / Atom feed integration.** PRD-101 owns the discovery hand-off; the Hugo module emits the `act.json` discovery file; RSS coexistence is operator concern.
6. **Componentized post bodies.** Hugo has no React-style component model in v0.1 (per PRD-402-R25); the example uses markdown bodies only.
7. **Plus-band features.** No `marketing:*`, no NDJSON, no search advertisement, no i18n.
8. **Shipping a first-party Hugo reference.** This PRD is spec only; a community port satisfies the contract.

### Stakeholders / audience

- **Authors of:** community Hugo-module porters who want to verify their port produces a conformant blog; blog operators choosing between Hugo and the v0.1 first-party Eleventy reference (PRD-707); PRD-600 implementers needing a Standard-band fixture corpus that does not depend on TS-only adapters.
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Community Hugo ports diverge in their interpretation of PRD-703's emission expectations, producing slightly different output across ports. | High | Medium | PRD-600 validates byte-level shape; any port producing output that satisfies the cited PRD requirements is conformant regardless of internal differences. The fixture corpus under `fixtures/703/` is the equivalence harness. |
| Operators forking PRD-707 (Eleventy) into a Hugo deployment expect identical output and find divergence. | Medium | Low | Both PRDs target Standard with the same node shape. Differences are limited to (a) `metadata.source.adapter` (`act-hugo` vs `act-eleventy`) and (b) ETag values (deterministic per PRD-103 but content-hash-based, so content changes produce different ETags across implementations only if they emit different bytes). PRD-703-R3 pins the emitted shape to match PRD-707's shape modulo source attribution. |
| Hugo's `_index.md` semantics confuse operators who expect every markdown file to become a node. | Medium | Medium | PRD-703-R5 explicitly maps `_index.md` to section nodes (parent of all content under that section) and leaf `.md` files to child post nodes. Worked in PRD-402-R10. |
| Year-based parent bucketing produces 1–N year-archive nodes that don't have backing markdown content. | Medium | Low | PRD-703-R6 declares year buckets are emitted as synthetic nodes (no source markdown) when `parentStrategy: "by-year"` is configured; their `metadata.source.synthetic: true` makes them auditable. The default strategy is `"flat"` (every post under `parent: "root"`); year bucketing is opt-in. |
| Tag-derived `related[]` produces large fan-out (a post tagged `nodejs` linking to every other post tagged `nodejs`). | Medium | Low | PRD-703-R8 caps `related[]` from tag-derivation at 8 entries per post. Operators wanting larger cross-references author them explicitly in frontmatter. |
| The example's emission expectations drift from PRD-201 / PRD-402's already-Accepted contracts. | Low | Medium | PRD-703 cites both PRDs and specifies only what is downstream of their requirements; conflicts are PRD-201/PRD-402 amendments, not PRD-703 amendments. |

### Open questions

1. **Should year-based parent bucketing be the default, given that chronological feeds are the canonical "agent scans the blog" use case from draft §8.2?** Tentatively: no, flat (`parent: "root"`) is the default because year buckets add a layer of synthetic nodes that complicates the simplest case. Operators with hundreds of posts opt into year bucketing. The `parent` field per node carries year info via `metadata.published_year` regardless. Confirmed.
2. **Should every post carry `abstract` (Standard-tier per PRD-107-R8 / PRD-102's `abstract` capability)?** Tentatively: posts whose body exceeds ~80 tokens of summary-equivalent material SHOULD carry `abstract`; shorter posts MAY omit. The PRD-102 SHOULD threshold governs; PRD-703 does not pin a hard cutoff.
3. **What happens when a Hugo post has `draft: true` in frontmatter?** Tentatively: skipped, matching Hugo's own draft-skipping behavior. PRD-703-R12 documents the skip.
4. **PRD-201's frontmatter contract specifies `slug` as a recognized key (per the markdown-adapter heuristics); PRD-402-R24 lists Hugo's reserved keys (`slug`, `aliases`, `weight`, `draft`, `date`).** PRD-703 inherits PRD-402's reserved-key set. **Potential ambiguity flagged: PRD-201-R6's reserved keys include `id`, but Hugo's `_index.md` files conventionally lack an `id` field.** PRD-201 does not explicitly state whether the markdown-adapter ID-derivation rule (PRD-201-R8) applies when `_index.md` is processed by a section-aware adapter like a Hugo module. **The example interprets PRD-201-R8 + PRD-402-R8 together as "section-node ID is derived from the section path"; the v0.2 RFC may want to make this explicit in PRD-201 or PRD-402.** PRD-201/PRD-402 are NOT amended here.

### Acceptance criteria

- [ ] Status `In review` is set; changelog entry dated 2026-05-02 by Jeremy Forsythe is present.
- [ ] PRD title ends with " (spec only)" matching PRD-402/403/503/504 precedent.
- [ ] Every normative requirement has an ID `PRD-703-R{n}` and a declared conformance level per PRD-107.
- [ ] The Specification opens with a table mapping cited P2 PRDs to the requirements the example exercises.
- [ ] Every cited P2 PRD (PRD-201, PRD-402, PRD-600) has at least one of its requirements exercised.
- [ ] Conformance target Standard is declared and justified.
- [ ] File-by-file emission expectations are enumerated.
- [ ] Acceptance criteria below include: example builds clean (under any conformant Hugo port); PRD-600 reports zero errors; reported `achieved` matches declared target; cited-PRD coverage is non-empty.
- [ ] Versioning & compatibility table is present.
- [ ] Security section addresses static-blog risks.

---

## Context & dependencies

### Depends on

- **PRD-100** (Accepted) — wire-format envelopes.
- **PRD-102** (Accepted) — content blocks; `markdown` (PRD-102-R1) is Core.
- **PRD-103** (Accepted) — ETag derivation.
- **PRD-105** (Accepted) — static delivery profile.
- **PRD-107** (Accepted) — conformance levels.
- **PRD-201** (Accepted) — markdown / MDX adapter behavioral contract.
- **PRD-402** (Accepted, spec only) — Hugo module spec.
- **PRD-600** (Accepted) — validator.
- External: [Hugo content organization](https://gohugo.io/content-management/organization/), [Hugo front matter](https://gohugo.io/content-management/front-matter/), [CommonMark](https://commonmark.org/), [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174).

### Blocks

_Not applicable — examples are leaves of the dependency DAG._

### References

- v0.1 draft: §8.2 (Blog).
- PRD-402 §"Examples" — Hugo content tree → ACT mapping.
- PRD-707 — first-party TS-impl counterpart (Eleventy + markdown blog).
- Prior art: Hugo's `posts/` convention, Jekyll's `_posts/` convention, RSS 2.0 item shape.

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords as clarified by RFC 8174.

### Cited-PRD coverage table

| PRD | Requirement(s) exercised | Where in this example |
|---|---|---|
| PRD-100 | R4 (manifest envelope), R6 (capabilities), R10 (ID grammar — slug-derived), R21 (envelope schema) | Every emitted manifest/index/node passes PRD-100's schemas. |
| PRD-102 | R1 (`markdown` block — Core), R2 (`prose` — Standard, optional fine-grained mode), R3 (`code` — Standard, optional) | Every post body is one or more markdown / prose / code blocks. |
| PRD-103 | R-etag-derivation | Every emitted file carries a content-derived ETag. |
| PRD-105 | R1 (static profile envelope), R7a (static layout) | All emissions are static. |
| PRD-107 | R8 (Standard declaration), R11 (additivity from Core) | `conformance.level: "standard"` declared. |
| PRD-201 | R3 (frontmatter recognition), R4 (recognized key set), R6 (reserved metadata keys), R8 (path-derived ID), R12 (body-to-block mapping; coarse default) | Every post's frontmatter is recognized; body maps to a single `markdown` block by default. |
| PRD-402 | R2 (canonical pipeline order), R8 (ID derivation from content path), R10 (section hierarchy → `parent`/`children`), R12 (body-to-block mapping), R14 (Standard file set), R15–R16 (atomic writes), R23 (build report path), R24 (Hugo reserved keys) | The Hugo module's emission shape is what the example documents. |
| PRD-600 | R-validator-core; reporter `achieved.level === "standard"` | Acceptance criterion (c). |

### Conformance level

This example targets **Standard** (per PRD-107-R8). Justification:

- Posts use `markdown` (Core, PRD-102-R1) blocks by default, with optional fine-grained mapping (Standard, PRD-201-R12 / PRD-402-R12) producing `prose` / `code` blocks.
- The example emits subtree files for section roots (Standard, PRD-107-R8).
- Posts MAY carry `abstract` (Standard-tier capability per PRD-102) and `related[]` (Standard, PRD-107-R8).
- The example does NOT use `marketing:*`, NDJSON, search, or i18n — all of which would push to Plus.

A consumer requiring "minimum Core" is satisfied by additivity (PRD-107-R11). A consumer requiring Plus is NOT satisfied.

Per-requirement conformance bands are annotated inline below.

### Normative requirements

#### Conformance target

**PRD-703-R1.** **(Standard)** A conformant build of this example MUST declare `conformance.level: "standard"` in its manifest. The example MUST NOT advertise Plus capabilities (`index_ndjson_url`, `search_url_template`, `locales` block).

#### File-set emission

**PRD-703-R2.** **(Standard)** A conformant build of this example MUST emit, under Hugo's resolved `public/` directory (or wherever PRD-402-R23 directs the writer), the following file set:

- `public/.well-known/act.json` — manifest.
- `public/act/index.json` — index, listing every post node and section node.
- `public/act/n/{id}.json` — one file per node (~30–100 post nodes plus a small number of section nodes).
- `public/act/sub/root.json` — root subtree.
- `public/act/sub/posts.json` — `posts` section subtree.
- For each non-root section S (e.g., `about`): `public/act/sub/{S}.json`.
- `./.act-build-report.json` — build report at project root, per PRD-402-R23 (NOT inside `public/` to avoid CDN upload).

The example MUST NOT emit `index.ndjson`, `search.json`, or any per-locale fan-out files.

**PRD-703-R3.** **(Standard, advisory)** The example's emission shape SHOULD match PRD-707's emission shape (modulo source attribution and per-implementation ETag values) so operators choosing between Hugo and Eleventy at v0.1 see equivalent ACT trees. The validator's reporter `achieved.level` and the cited-PRD coverage MUST match across the two examples; per-byte equivalence is not required.

#### Manifest construction

**PRD-703-R4.** **(Standard)** The manifest MUST declare:

- `act_version: "0.1"`.
- `site.name`: a non-empty string.
- `delivery: "static"`.
- `conformance.level: "standard"`.
- `index_url: "/act/index.json"`.
- `node_url_template: "/act/n/{id}.json"`.
- `subtree_url_template: "/act/sub/{id}.json"`.
- `capabilities.etag: true`, `capabilities.subtree: true`.

The manifest MUST NOT include `locales`, `index_ndjson_url`, `search_url_template`, or `mounts`.

#### Section hierarchy

**PRD-703-R5.** **(Standard)** The Hugo content hierarchy MUST map to ACT `parent` / `children` per PRD-402-R10:

- `content/_index.md` → root node (`id: "root"`, `type: "site"`).
- `content/posts/_index.md` → section node (`id: "posts"`, `type: "section"`, `parent: "root"`).
- `content/posts/{slug}.md` → post node (`id: <slug-derived>`, `type: "post"`, `parent: "posts"` OR a year bucket per PRD-703-R6).
- `content/about/_index.md` → section node (`id: "about"`, `type: "section"`, `parent: "root"`).
- Other top-level sections → section nodes whose `parent` is `"root"`.

PRD-201-R8's path-derived ID rule applies to leaf files; PRD-402-R8 governs ID derivation for `_index.md` files.

#### Year bucketing

**PRD-703-R6.** **(Standard, opt-in)** When `parentStrategy: "by-year"` is configured (Hugo: `[params.act] parentStrategy = "by-year"`), the example MUST emit synthetic year-bucket section nodes (`id: "{year}"`, `type: "section"`, `parent: "posts"`) and post nodes whose `parent` is the year bucket derived from the post's `date` frontmatter. Synthetic year-bucket nodes MUST carry `metadata.source.synthetic: true` to distinguish them from markdown-backed sections.

When `parentStrategy: "flat"` (default) is configured, every post node has `parent: "posts"` and no year-bucket nodes are emitted. Posts MAY carry `metadata.published_year: "{year}"` for client-side aggregation regardless of strategy.

#### Post node shape

**PRD-703-R7.** **(Standard)** Every post node MUST satisfy:

- `type: "post"`.
- `id`: derived from the post's slug (or path-derived per PRD-201-R8 / PRD-402-R8). The example uses kebab-case slugs.
- `title`: from frontmatter `title`.
- `summary`: from frontmatter `summary` (preferred) OR derived from the post's first paragraph if `summary` is absent. Posts whose summary cannot be derived (empty body) cause a build warning per PRD-402-R18 / PRD-201-R12.
- `parent`: `"posts"` or `"{year}"` per PRD-703-R6.
- `tokens.summary`, `tokens.body`, `etag`: derived per PRD-100 / PRD-103.
- `content[]`: per PRD-703-R9.
- `metadata.published_at`: from frontmatter `date` (RFC 3339 timestamp).
- `metadata.tags[]`: from frontmatter `tags`.
- `metadata.source.adapter`: the implementing adapter's name (typically `"act-hugo"` or equivalent).

#### Tag-derived cross-references

**PRD-703-R8.** **(Standard)** Posts sharing one or more `metadata.tags` MAY carry `related[]` entries linking to sibling posts. The example MUST cap tag-derived `related[]` at 8 entries per post; ranking is by tag-overlap count then by recency (newer first). Operators wanting different ranking author `related[]` explicitly in frontmatter, in which case the explicit list is canonical and tag derivation is suppressed for that post.

#### Body-to-block mapping

**PRD-703-R9.** **(Standard)** Every post node's `content[]` MUST be either:

- (a) **Coarse mode (default).** A single `markdown` block (PRD-102-R1) carrying the entire CommonMark body. Per PRD-201-R12 / PRD-402-R12, this is the default mode and produces Core-tier content.
- (b) **Fine-grained mode (opt-in via `[params.act] blockMapping = "fine"`).** A sequence of `prose` (PRD-102-R2), `code` (PRD-102-R3), `data` (PRD-102-R4), and `callout` blocks per PRD-201-R12's fine-grained rules. Fine mode produces Standard-tier content.

The example MAY ship either mode; PRD-703-R9 documents both. Mode is per-build, not per-post.

#### Optional `abstract`

**PRD-703-R10.** **(Standard, advisory)** Posts whose body exceeds ~80 tokens of summary-equivalent material SHOULD carry `abstract`, populated from frontmatter `abstract` if present, else from the post's first two paragraphs. Posts whose body is shorter MAY omit `abstract`. PRD-102's exact threshold governs.

#### Frontmatter recognition

**PRD-703-R11.** **(Standard)** A conformant Hugo module MUST recognize TOML, YAML, and JSON frontmatter per PRD-201-R3 / PRD-402-R9. The recognized key set is the union of PRD-201-R4's set (`id`, `title`, `summary`, `summary_source`, `type`, `tags`, `parent`, `related`, `metadata.*`) and Hugo's reserved keys (PRD-402-R24: `slug`, `aliases`, `weight`, `draft`, `date`).

The example MAY carry interop with `slug` (used to override the path-derived ID); `aliases` and `weight` are Hugo concerns and do not influence ACT emission.

#### Drafts

**PRD-703-R12.** **(Standard)** Posts with `draft: true` in frontmatter MUST be skipped. Hugo's own draft-skipping behavior matches; the ACT build inherits the skip. Operators previewing drafts MAY pass `--buildDrafts` to Hugo, in which case the ACT module MUST also include the draft per PRD-402's pass-through behavior.

#### ETag derivation

**PRD-703-R13.** **(Core)** Every emitted file MUST carry an `etag` derived per PRD-103. The Hugo module MUST NOT supply ETags directly; the framework computes them from envelope contents. Per-implementation ETag stability is a function of the content-hash determinism guarantee from PRD-103.

#### Build pipeline

**PRD-703-R14.** **(Core)** The build invocation MUST follow PRD-402-R5's wrapper-script pattern: `hugo && act-hugo emit` (or the equivalent single-binary invocation when a community port consolidates them). The act-hugo step MUST run after Hugo's `public/` directory is fully written (PRD-402-R6's stale-state check). The example MUST NOT bypass PRD-402's pipeline.

#### Acceptance criteria for a clean build

**PRD-703-R15.** **(Standard)** A conformant build of this example (under any conformant Hugo port satisfying PRD-402) MUST satisfy all of the following:

- (a) **Builds clean.** `hugo && act-hugo emit` exits with code 0.
- (b) **Validator clean.** `npx @act/validator public/` returns zero errors.
- (c) **Achieved-level match.** PRD-600 reporter's `achieved.level` equals `"standard"` (PRD-107-R18).
- (d) **Cited-PRD coverage.** Every PRD listed in the cited-PRD coverage table has at least one of its requirements exercised by the build's emitted files.

#### Spec-only posture

**PRD-703-R16.** **(Standard)** PRD-703 ships no first-party Hugo build. A community-authored Hugo module satisfying PRD-402's spec produces, when run against a Hugo blog meeting PRD-703's source conventions, an ACT tree that satisfies PRD-703's emission expectations. The validator (PRD-600) certifies the bytes; PRD-703 is the contract a community port targets, not a runnable artifact. Operators needing a runnable v0.1 first-party blog reference use PRD-707.

### Wire format / interface definition

_Not applicable — examples consume but do not define wire formats. PRD-100, PRD-102, PRD-103, PRD-201, PRD-402 own the relevant wire shapes._

### Errors

| Condition | Severity | Notes |
|---|---|---|
| Frontmatter `date` missing | Build warning | PRD-703-R7 — fallback to file mtime per PRD-402's defaults; `metadata.published_at` may be omitted. |
| Frontmatter `title` missing | Build warning + fallback title | PRD-201-R12 / PRD-402's defaults |
| Empty post body | Build warning | PRD-703-R7 (cannot derive summary) |
| Slug collision (two posts with the same `slug`) | Build error | PRD-100-R10 / PRD-200-R12 |
| `draft: true` post | Skip | PRD-703-R12 |
| Validator reports `achieved.level !== "standard"` | Acceptance failure | PRD-703-R15 (c) |

---

## Examples

### Examples are illustrative — no first-party build

The snippets below describe what a conformant Hugo + markdown blog emits. They are illustrative; PRD-703 ships no working Hugo configuration. Operators consult the community-Hugo-port README for the actual build commands and configuration.

### Example 1 — sample post frontmatter (TOML)

```toml
+++
title = "On the small joys of static builds"
slug = "small-joys-of-static-builds"
date = 2025-09-12T08:30:00-04:00
summary = "Why a single command and a CDN beats most things, most of the time."
tags = ["devops", "static-sites", "philosophy"]
draft = false
+++

The first thing I did this morning was…
```

### Example 2 — emitted post node (coarse mode, default)

```json
{
  "act_version": "0.1",
  "id": "small-joys-of-static-builds",
  "type": "post",
  "title": "On the small joys of static builds",
  "summary": "Why a single command and a CDN beats most things, most of the time.",
  "parent": "posts",
  "etag": "sha256:6e0f…",
  "tokens": { "summary": 14, "body": 612 },
  "content": [
    {
      "type": "markdown",
      "text": "The first thing I did this morning was…\n\n## A small build, a small worry\n\n…"
    }
  ],
  "related": ["why-i-still-write-by-hand", "deploy-fridays"],
  "metadata": {
    "published_at": "2025-09-12T08:30:00-04:00",
    "tags": ["devops", "static-sites", "philosophy"],
    "source": { "adapter": "act-hugo", "source_id": "content/posts/small-joys-of-static-builds.md" }
  }
}
```

### Example 3 — emitted manifest

```json
{
  "act_version": "0.1",
  "site": { "name": "Small Joys" },
  "delivery": "static",
  "conformance": { "level": "standard" },
  "index_url": "/act/index.json",
  "node_url_template": "/act/n/{id}.json",
  "subtree_url_template": "/act/sub/{id}.json",
  "capabilities": { "etag": true, "subtree": true }
}
```

### Example 4 — `posts` section subtree (excerpt)

```json
{
  "act_version": "0.1",
  "id": "posts",
  "type": "section",
  "title": "Posts",
  "summary": "Chronological feed of all posts.",
  "children": [
    { "id": "small-joys-of-static-builds", "type": "post", "title": "On the small joys of static builds", "summary": "Why a single command and a CDN beats most things, most of the time.", "etag": "sha256:6e0f…" },
    { "id": "why-i-still-write-by-hand", "type": "post", "title": "Why I still write by hand", "summary": "…", "etag": "sha256:…" }
  ]
}
```

### Example 5 — `hugo.toml` excerpt (illustrative)

```toml
baseURL = "https://example.com"
title = "Small Joys"
theme = "blog"

[module]
[[module.imports]]
path = "github.com/{community}/act-hugo"

[params.act]
parentStrategy = "flat"     # PRD-703-R6
blockMapping = "coarse"     # PRD-703-R9 default
```

---

## Test fixtures

Fixtures live under `fixtures/703/`. PRD-703 enumerates filenames; the validator (PRD-600) and any community Hugo port's CI exercise them.

### Positive

- `fixtures/703/positive/build-output-50/` — complete `public/` from a conformant build of a 50-post sample.
- `fixtures/703/positive/manifest.json` → satisfies PRD-703-R4.
- `fixtures/703/positive/post-coarse-mode.json` → satisfies PRD-703-R7, R9 (coarse).
- `fixtures/703/positive/post-fine-mode.json` → satisfies PRD-703-R9 (fine).
- `fixtures/703/positive/post-with-abstract.json` → satisfies PRD-703-R10.
- `fixtures/703/positive/section-posts-subtree.json` → satisfies PRD-703-R2 subtree requirement.
- `fixtures/703/positive/year-bucketed/` → opt-in `parentStrategy: "by-year"` build, satisfying PRD-703-R6.

### Negative

- `fixtures/703/negative/draft-included/` → `draft: true` post is emitted; build error per PRD-703-R12.
- `fixtures/703/negative/missing-title/` → frontmatter lacks `title`; build warning + fallback title.
- `fixtures/703/negative/slug-collision/` → two posts with the same `slug`; build error.
- `fixtures/703/negative/marketing-block-emitted/` → a post body emits a `marketing:hero` (not legal in Standard); build warning per PRD-102-R6.
- `fixtures/703/negative/level-misdeclared-plus/` → manifest declares `"plus"` but no NDJSON / search / locales. Validator `achieved.level` MUST be `"standard"`.
- `fixtures/703/negative/year-bucket-orphan/` → year-bucket strategy enabled but a post has no `date`; year bucket cannot be derived. Build warning.

---

## Versioning & compatibility

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a recognized frontmatter key | MINOR | Inherits PRD-201-R4 / PRD-402-R24. |
| Add a new optional `metadata.*` field on post nodes | MINOR | Per PRD-108-R7. |
| Change the default `parentStrategy` from `"flat"` to `"by-year"` | MAJOR | Output diverges. |
| Change the default `blockMapping` from `"coarse"` to `"fine"` | MAJOR | Output diverges. |
| Promote `abstract` from advisory to required | MAJOR | Per PRD-108. |
| Add Plus capabilities (NDJSON, search, i18n) | MAJOR | Migrate to a different example or fork. |
| Tighten a SHOULD to a MUST | MAJOR | Per PRD-108. |
| Loosen a MUST to a SHOULD | MAJOR | Per PRD-108. |

### Forward compatibility

A v0.2 producer MAY add optional fields per PRD-108-R7; consumers MUST tolerate unknown optional fields. Community Hugo ports MAY add Plus capabilities in their port-specific configuration without affecting PRD-703's Standard band.

### Backward compatibility

A re-build of the same source corpus under the same conformant port MUST emit byte-equivalent output modulo `generated_at` timestamps. ETags are content-derived per PRD-103 and stable.

---

## Security considerations

PRD-109 (Accepted) governs the project-wide threat model. PRD-703 deltas:

- **Public-by-construction.** Static blogs ship every post to the CDN; operators MUST NOT rely on draft-skipping for confidentiality. PRD-703-R12 inherits Hugo's `draft: true` skip behavior; operators with sensitive drafts MUST keep them out of the source tree.
- **Build report leakage.** Per PRD-402-R23, the build report at `./.act-build-report.json` lives at the project root and MUST NOT ship to the CDN. Operators reviewing community Hugo ports MUST verify the port honors this.
- **Tag leakage.** Per `metadata.tags`, the example exposes the full tag set of every post. Operators with tags carrying internal classification (e.g., `internal-comm-2026-q3`) MUST sanitize before emission.
- **PII in post bodies.** ACT does not introduce new PII surfaces; whatever the markdown body contains, the ACT envelope conveys verbatim. Operators apply existing review processes.
- **Cross-post `related[]` leakage.** Tag-derived `related[]` (PRD-703-R8) may reveal merchandising or editorial relationships. Operators with sensitive cross-references author `related[]` explicitly to override.
- **404-vs-403.** Static profile only; no auth boundary applies.

---

## Implementation notes

_PRD-703 is spec-only. Snippets below describe the emitted-output shape that any conformant Hugo module produces; they are not authoring guidance for the module itself (PRD-402's Implementation notes own that)._

### Snippet — Hugo content tree → ACT mapping

```
content/                                  →  emitted nodes
  _index.md            (site root)        →  id: "root", type: "site"
  posts/
    _index.md          (section root)     →  id: "posts", type: "section", parent: "root"
    small-joys.md      (post)             →  id: "small-joys", type: "post", parent: "posts"
    write-by-hand.md   (post)             →  id: "write-by-hand", type: "post", parent: "posts"
  about/
    _index.md          (section root)     →  id: "about", type: "section", parent: "root"
```

### Snippet — running validation against a community Hugo port's output

```bash
$ hugo
$ act-hugo emit
$ npx @act/validator public/
{ "declared": { "level": "standard", "delivery": "static" },
  "achieved":  { "level": "standard", "delivery": "static" },
  "gaps": [], "warnings": [] }
```

### Snippet — fine-grained block mapping (opt-in)

A post body containing a fenced code block produces, under fine mode, a sequence of `prose` and `code` blocks per PRD-201-R12 / PRD-402-R12:

```json
{
  "content": [
    { "type": "prose", "text": "Here is how I bootstrap a small site." },
    { "type": "code", "language": "bash", "text": "hugo new site small-joys\ncd small-joys\nhugo server -D" },
    { "type": "prose", "text": "And that's enough to get going." }
  ]
}
```

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-02 | Jeremy Forsythe | Initial draft. Spec-only Standard-band reference for a Hugo + markdown blog (~30–100 posts, single locale) targeting PRD-201 + PRD-402 + PRD-600. No first-party Hugo build ships in v0.1; community ports invited per decision Q3. PRD-707 is the v0.1 first-party TS-impl counterpart (Eleventy + markdown). Four open questions flagged: default parent strategy (flat), `abstract` SHOULD threshold, draft handling (skipped), and a potential PRD-201 ambiguity around `_index.md` ID derivation when section-aware adapters interact with PRD-201-R8 (flagged for v0.2 review of PRD-201/PRD-402, NOT amended here). Status: Draft → In review. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). PRD-201-R8 / PRD-402-R8 `_index.md` ID-derivation ambiguity (Open Q4) accepted as v0.2 candidate; OQ retained in this PRD per workflow.md "do not silently amend" rule. |
