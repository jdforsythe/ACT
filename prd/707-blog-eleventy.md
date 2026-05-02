# PRD-707 — Blog (Eleventy + markdown)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Site description

A small chronological blog built on Eleventy 2.x with a single English locale, a markdown-only post corpus under `posts/`, an `index.md` landing page, and an optional `about.md`. The reference example is the TS-implementation counterpart to PRD-703 (Hugo blog, spec-only): both target the same shape (a flat chronological feed of `.md` posts that an agent can scan "what's new on this site?" much like RSS, per v0.1 draft §8.2), but PRD-707 ships a live first-party reference implementation while PRD-703 carries the spec text only.

Scale envelope: between 30 and 100 ACT nodes after PRD-201 + PRD-408 emission (one node per `.md` post under `posts/` plus the landing-page node and a small number of standalone pages); 1 locale (`en-US`); static delivery only; no runtime endpoints; no MDX; no component bindings (PRD-408 explicitly rejects `bindings` per PRD-408-R10); no marketing-namespace blocks; no i18n; no NDJSON / search.

The example exists to (a) prove that PRD-408's lifecycle wiring (`eleventy.after` placement, permalink-aware filtering, URL-space independence) holds against a realistic blog corpus, (b) supply Phase 6 with a working baseline so PRD-408's Eleventy-specific contracts (template-engine opacity, source-of-truth-is-markdown, no-bindings) get exercised end-to-end, (c) give PRD-703's spec-only Hugo counterpart a TS analogue downstream consumers can fork from, and (d) demonstrate that Eleventy's draft-flagging / `permalink: false` mechanics correctly downgrade ACT emission per PRD-408-R6.

### Problem

PRD-703 (Hugo blog, spec-only) describes what a blog producer's manifest, index, and node files look like in the abstract, but ships no first-party implementation a TS-shop adopter can clone. Phase 4's brief specifically calls for PRD-707 as the Eleventy-shop counterpart: a live reference build, in TS, that proves PRD-408's contracts hold against the same content shape PRD-703 specifies. Without PRD-707, PRD-408's permalink-aware filtering, watch-mode re-entry, and template-engine opacity rules have no end-to-end Phase 6 acceptance gate other than synthetic fixtures under `fixtures/408/`.

### Goals

1. Pin the **stack**: Eleventy 2.x + `@act/eleventy` (PRD-408) + `@act/markdown` (PRD-201, auto-wired) + `@act/validator` (PRD-600).
2. Pin the **content shape**: a flat chronological corpus of `.md` posts under `posts/` plus a small set of top-level pages, mirroring v0.1 draft §8.2's blog walkthrough.
3. Pin the **declared conformance level** at **Standard**, with the rationale that subtree emission for a synthetic chronological-index parent (`posts`) gives agents a coherent "what's new" view, and the corpus-side cost is negligible.
4. Pin the **file-by-file emission target** under Eleventy's `_site/` directory.
5. Pin the **acceptance criteria** including PRD-408's specific contracts (permalink filtering, no `bindings`, URL-space independence).
6. Demonstrate that **draft / unpublished posts** (Eleventy's `permalink: false` or `eleventyExcludeFromCollections: true`) are correctly excluded from ACT emission per PRD-408-R6.

### Non-goals

1. **Component bindings.** PRD-408-R10 explicitly forbids `bindings`; PRD-707 does not exercise PRD-301 / PRD-302 / PRD-303.
2. **Template-engine introspection.** PRD-408-R9 forbids it; PRD-707 stays markdown-source-of-truth.
3. **MDX.** Eleventy 2.x does not natively support MDX; PRD-201's MDX seam is exercised by PRD-700 / PRD-702.
4. **i18n.** Single locale; multi-locale is a v0.2 candidate.
5. **NDJSON, search.** Plus-tier capabilities; PRD-707 declares Standard. PRD-408-R17 specifies that Plus on Eleventy requires an operator-supplied search artefact (`act.searchArtifactPath`); PRD-707 declines to commit one.
6. **RSS / Atom feed parity.** Eleventy ships RSS plugins; PRD-707 does not assert any equivalence between the RSS feed and the ACT chronological surface (the two coexist; ACT is structured-content, RSS is full-bodies-for-feed-readers).
7. **Authoring the implementation.** Phase 6 owns the implementation against this PRD as the brief.
8. **Defining the wire format.** PRD-100 / PRD-105 own that.

### Stakeholders / audience

- **Authors of:** Phase 6 implementation team.
- **Reviewers required:** BDFL Jeremy Forsythe.
- **Downstream consumers:** PRD-703 (Hugo blog, spec-only) — referenced as the cross-stack counterpart; PRD-801 (migration playbook) — cites PRD-707 as the "Eleventy blog" on-ramp.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Permalink-aware filtering (PRD-408-R6) drops a post the operator did NOT intend to drop (e.g., a transient `permalink: false` toggle in a draft they meant to publish). | Medium | Medium | PRD-408-R6 surfaces the drop as a build warning (`excluded_by_permalink`); PRD-707-R7 makes "zero unintended `excluded_by_permalink` warnings" an acceptance criterion. The negative fixture covers the warning shape. |
| Path-derived IDs collide on date-prefixed filenames (e.g., `posts/2026-05-01-hello.md` and `posts/2026-05-01-hello/index.md`). | Low | Medium | PRD-707-R5 forbids the second pattern; the canonical corpus uses date-prefixed flat filenames only. |
| The synthetic `posts` parent node collides with a real post titled "Posts." | Low | Low | PRD-707-R6 reserves the `posts` ID for the synthetic chronological-index node and bans real posts at that ID. |
| The corpus grows past 100 posts and forces a reconsideration of the conformance level. | Medium | Low | PRD-707-R3 caps the canonical fixture corpus at 100 posts; growth past the cap is a forced revisit. |
| Eleventy's `eleventy.after` hook fires concurrently in watch mode and the in-flight ACT pipeline is interrupted. | Low | Medium | PRD-408-R5 already mandates a re-entry guard; PRD-707 inherits unchanged. |
| The operator wires component bindings into `act({ bindings: [...] })` despite PRD-408-R10. | Low | Low | PRD-408-R10 already produces a configuration error; PRD-707-R9 reasserts the rejection as a CI-checkable invariant. |

### Open questions

1. Should the synthetic chronological-index parent node be named `posts` (current proposal) or `index` (matches PRD-700's terminology) or `blog` (matches the conventional URL prefix)? Tentatively: `posts`. Matches Eleventy convention; `index` would collide with the landing page; `blog` is a URL-space concept not an ID-space concept. Encoded as PRD-707-R6.
2. Should the post `summary` extraction prefer the frontmatter `description` field (Eleventy / Jekyll convention) over `summary` (ACT convention)? Tentatively: PRD-201 owns this; the canonical recognized key is `summary`. Authors who write Eleventy-shaped frontmatter (`description: "..."`) get `summary_source: "extracted"` because PRD-201's recognized-key list does not include `description` (PRD-201-R4). Open question carried here as guidance for the implementer; PRD-201 amendment is a v0.2 question.
3. Should the example exercise Eleventy collections (`eleventyConfig.addCollection("posts", ...)`) via PRD-408-R11's `collectionHints` opt-in to drive `parent`/`children` derivation? Tentatively: no — keep PRD-707 in the no-collection-hints default so the example proves PRD-201's path-derived ID strategy alone suffices. Encoded as PRD-707-R8.

### Acceptance criteria

- [ ] Every normative requirement has an ID `PRD-707-R{n}` and a declared conformance level per PRD-107.
- [ ] The Specification section opens with a table mapping every requirement to PRD-408 / PRD-201 / PRD-600 / 100-series requirements exercised.
- [ ] Corpus envelope (30–100 nodes) and content shape are pinned.
- [ ] File-by-file emission target under `_site/` is enumerated.
- [ ] Conformance target is declared as **Standard** with rationale.
- [ ] Acceptance criteria bind the example to PRD-600's verdict.
- [ ] An inline `eleventy.config.mjs` (or `.eleventy.js`) snippet matches PRD-408-R12 shape.
- [ ] No new JSON Schemas or fixture files created.
- [ ] Versioning & compatibility section classifies changes per PRD-108.
- [ ] Security section cites PRD-109 + PRD-408 § Security.
- [ ] Changelog entry dated 2026-05-02 by Jeremy Forsythe is present.

---

## Context & dependencies

### Depends on

- **PRD-408** (Accepted) — Eleventy plugin; the example's build entry point.
- **PRD-201** (Accepted) — Markdown adapter; auto-wired against Eleventy's input dir.
- **PRD-600** (Accepted) — Validator; the example's gate.
- **PRD-100** (Accepted) — Wire format envelopes.
- **PRD-102** (Accepted) — Content blocks (`markdown`, optionally `code`).
- **PRD-103** (Accepted) — ETag derivation.
- **PRD-105** (Accepted) — Static delivery profile.
- **PRD-107** (Accepted) — Conformance levels; PRD-707 declares Standard.
- **PRD-108** (Accepted) — Versioning policy.
- **PRD-109** (Accepted) — Security posture.
- External: [Eleventy 2.x](https://www.11ty.dev/), [Eleventy `eleventy.after` hook](https://www.11ty.dev/docs/events/), [Eleventy permalinks](https://www.11ty.dev/docs/permalinks/).

### Blocks

_Not applicable — PRD-707 is a leaf reference example._

### References

- v0.1 draft: §8.2 (blog walkthrough; PRD-707 is the canonical TS-impl realization of that walkthrough).
- `prd/000-INDEX.md` 700-series row (PRD-707 entry as TS-impl counterpart to PRD-703).
- `docs/workflow.md` Phase 4 (reference-example authoring rules).
- Prior art: [Eleventy's own blog starter](https://github.com/11ty/eleventy-base-blog) (canonical Eleventy blog shape; date-prefixed posts; `posts/` directory; permalink mapping); the v0.1 draft §8.2 blog example.

---

## Specification

This is the normative section. RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) apply as clarified by RFC 8174.

### P2 PRDs the example composes

| Cited PRD | Requirement IDs exercised | What the example proves |
|---|---|---|
| PRD-408 | R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R12, R13, R14, R15, R16, R17, R18, R19, R20 | Plugin module shape, Eleventy 2.x peer dep, source-discovery (auto-wired markdown adapter against Eleventy's input dir), `addPlugin` integration, `eleventy.after` lifecycle, permalink-aware filtering (drafts excluded), URL-space independence, source-of-truth-is-markdown, template-engine opacity, no-bindings rejection, plugin options shape, output directory + atomic writes, build report, failure surface, conformance bands, pinning enforcement, watch-mode re-entry guard, fixture-corpus conformance. |
| PRD-201 | R1, R2, R3, R4, R5, R7, R8, R9, R11, R12, R13, R16, R17, R18, R19, R20, R22, R23 | Adapter contract, config schema, YAML frontmatter, recognized-key set, path-derived ID strategy across date-prefixed filenames, file walk over the input dir, default coarse `markdown` block emission, `code` fence recognition, summary derivation (frontmatter when present, else extracted from first paragraph), `summary_source` stamping, capability declaration, level-aware emission. |
| PRD-600 | R1, R2, R3, R4, R5, R6, R7, R11, R13, R14, R15, R16, R17, R18, R19, R20, R21, R23, R26, R27, R30 | Envelope schema validation, ID grammar, the discovery walk, the reporter output, the `--file` CLI mode, default sample, fixture-corpus consumption. |
| PRD-100 | R1, R2, R3, R4, R5, R10, R11, R16, R17, R18, R21, R22, R23, R28, R32, R33, R34 | Manifest required-field set, ID grammar, percent-encoding on URL substitution, index envelope, node envelope, content-block discriminator, subtree envelope and depth bounds. |
| PRD-102 | R1, R3, R12, R13, R15, R16, R17, R24, R26 | `markdown`, `code` blocks, `summary_source` enum (both `"author"` and `"extracted"` exercised — see PRD-707-R10), `summary` required and non-empty, `content` required, block-order preservation, summary-length warning. |
| PRD-103 | R1, R2, R3, R4 | `etag` field present, value-shape regex, `s256:` admit-list, static derivation. |
| PRD-105 | R1, R2, R4, R6, R8, R10 | Manifest at `/.well-known/act.json`, index reachable, node files reachable, subtree file for the synthetic chronological parent, MIME types, no body mutation on rebuild. |
| PRD-107 | R1, R3, R4, R6, R8, R11 | `conformance.level` declaration, `delivery: "static"`, additivity, Core inclusion list, Standard inclusion list. |

### Conformance level

PRD-707 declares the example **Standard**. Rationale:

- The corpus has a natural two-level shape (`posts` synthetic parent → individual posts) that produces one subtree-eligible parent at zero authoring cost. Standard's subtree contract (PRD-107-R8) is satisfied by the chronological-index subtree alone.
- Plus-tier capabilities (NDJSON, search, marketing namespace, multi-locale) deliver no proportionate utility for a 30–100 node single-locale blog. PRD-408-R17's Plus path requires an operator-supplied search artefact; PRD-707 declines.

Per requirement breakdown:

- **Core:** PRD-707-R1, R2, R3, R4, R5, R6 (synthetic-parent ID reservation), R7, R8, R9, R10, R11, R12, R13, R14.
- **Standard:** PRD-707-R15 (achieved == Standard), the implicit subtree emission for the `posts` synthetic parent (folded into PRD-707-R12).
- **Plus:** _Not applicable — PRD-707 declares Standard._

A producer satisfying PRD-707 satisfies PRD-107-R6 (Core) and PRD-107-R8 (Standard) by additivity.

### Normative requirements

#### Stack

**PRD-707-R1.** The example MUST build with Eleventy 2.x as the host framework and MUST consume `@act/eleventy` (PRD-408) as the only ACT plugin in `eleventy.config.mjs` (or `.eleventy.js` / `eleventy.config.cjs`). The plugin is registered via `eleventyConfig.addPlugin(actPlugin, options)` per PRD-408-R4. The example MUST NOT depend on any other generator. Conformance: **Core**.

**PRD-707-R2.** The example MUST consume `@act/markdown` (PRD-201) as the source adapter, auto-wired by PRD-408-R3 against Eleventy's resolved input directory. The example MUST NOT supply a custom `adapters` array; auto-wiring is exercised. Conformance: **Core**.

#### Corpus shape

**PRD-707-R3.** The example's canonical content corpus MUST consist of between 30 and 100 ACT nodes after PRD-201 / PRD-408 emission. The count includes:

- One node per published `.md` post under `posts/` (Eleventy's input dir's `posts/` subtree).
- The landing page node (`index.md`).
- An `about` page (`about.md`) — optional but conventional.
- The synthetic `posts` chronological-index parent node (per PRD-707-R6).

Drafts (posts with `permalink: false` or `eleventyExcludeFromCollections: true` or a `draft: true` filter the operator implements via Eleventy's data cascade) MUST be excluded from the count and from emission per PRD-408-R6. Conformance: **Core**.

**PRD-707-R4.** The corpus MUST be authored as `.md` files only. `.njk`, `.liquid`, `.hbs`, `.ejs`, `.webc`, and `.11ty.js` template files MAY exist in the project for HTML rendering but MUST NOT contribute to ACT emission per PRD-408-R3 / PRD-408-R9. Conformance: **Core**.

**PRD-707-R5.** Posts MUST be authored at flat paths under `posts/` with date-prefixed filenames (e.g., `posts/2026-05-01-launching-tinybox.md`). Posts MUST NOT be authored at directory-index paths (`posts/2026-05-01-launching-tinybox/index.md`) — the directory-index pattern would produce a path-derived ID (`posts/2026-05-01-launching-tinybox`) that collides with a flat-filename ID at the same path; PRD-201-R7 detects the collision but PRD-707 forbids the pattern preemptively. Conformance: **Core**.

#### Synthetic chronological parent

**PRD-707-R6.** The build MUST produce a synthetic parent node with `id: "posts"`, `type: "index"`, `title: "Posts"` (or operator-supplied title via plugin options' `manifest.site.posts_title`), `summary: "Chronological feed of all posts."` (or operator-supplied summary), and a `children` array enumerating every emitted post node ID in reverse-chronological order (newest first). The synthetic parent's emission MAY be wired by the host through PRD-408-R11's `collectionHints` opt-in OR by a host-supplied frontmatter convention on `index.md` that declares `children` explicitly. The Phase 6 implementer chooses one mechanism; the contract is the emitted shape.

The `posts` ID is reserved by this PRD; a real post whose path-derived id would normalize to `posts` is a hard build error. Subtree emission for the `posts` parent satisfies PRD-707-R12's Standard target. Conformance: **Core**.

#### Permalink-aware filtering

**PRD-707-R7.** The canonical corpus MUST include at least one draft post whose source `.md` file lives in `posts/` but whose Eleventy permalink resolution excludes it from public output (e.g., a frontmatter `permalink: false` or `eleventyExcludeFromCollections: true`). PRD-408-R6's filter MUST drop the draft from ACT emission and surface an `excluded_by_permalink` warning in the build report. The CI fixture comparison MUST verify the draft is absent from `act/index.json` and absent from `act/n/`. Conformance: **Core**.

**PRD-707-R8.** The example MUST NOT enable PRD-408-R11's `collectionHints` for any purpose other than the synthetic chronological parent (per R6). Eleventy `addCollection` is allowed for HTML-rendering templates but MUST NOT thread into PRD-201's adapter input as a `collectionHints` field, except as the optional R6 mechanism. Conformance: **Core**.

#### No component bindings

**PRD-707-R9.** The example's plugin options MUST NOT supply a `bindings` field. PRD-408-R10 specifies a configuration error if `bindings` is supplied; PRD-707-R9 reasserts the contract: the canonical corpus is markdown-only, and any future extension that adds component bindings would be a new PRD (effectively a new example). The negative fixture covers the rejection path. Conformance: **Core**.

#### Frontmatter discipline

**PRD-707-R10.** Every post `.md` source file MUST declare YAML frontmatter with at minimum `title`. Posts SHOULD declare `summary` (yielding `summary_source: "author"`); posts MAY omit `summary` (yielding `summary_source: "extracted"` per PRD-201-R20 — extracted from the first non-heading paragraph per PRD-201-R18). The canonical corpus MUST exercise both code paths: at least 80% of posts declare `summary` (`"author"`) and at least one post omits `summary` (`"extracted"`). Reserved metadata keys (per PRD-201-R6) MUST NOT be set. Conformance: **Core**.

#### Configuration shape

**PRD-707-R11.** The example's `eleventy.config.mjs` MUST register `@act/eleventy` with the following minimum options:

```js
// eleventy.config.mjs
import actPlugin from "@act/eleventy";

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(actPlugin, {
    conformanceTarget: "standard",
    baseUrl: "https://example.com",
    manifest: { site: { name: "Tinybox Blog" } },
    urlTemplates: {
      index_url: "/act/index.json",
      node_url_template: "/act/n/{id}.json",
      subtree_url_template: "/act/sub/{id}.json",
    },
  });

  return {
    dir: { input: ".", output: "_site" },
    markdownTemplateEngine: "njk",
  };
}
```

The `conformanceTarget` MUST be `"standard"`. The `urlTemplates` MUST include `subtree_url_template`. The example MUST NOT supply `adapters`, MUST NOT supply `bindings` (per R9), MUST NOT supply `searchArtifactPath`, and MUST NOT enable `incremental: true` (Eleventy already manages incremental rebuilds; PRD-408-R12 default is `false`). Conformance: **Core**.

#### File-by-file emission target

**PRD-707-R12.** After `npx @11ty/eleventy` (Eleventy's standard build command), the resolved `_site/` directory MUST contain at minimum the following ACT-owned paths:

- `_site/.well-known/act.json` — manifest declaring `conformance: { level: "standard" }`, `delivery: "static"`, `index_url`, `node_url_template`, `subtree_url_template`, `capabilities: { etag: true, subtree: true }`. Required by PRD-105-R1 / PRD-107-R8.
- `_site/act/index.json` — index with one entry per emitted node (30–100 entries). The index entries are emitted in reverse-chronological post order with the synthetic `posts` parent first and the landing/about pages last (or in operator-defined order — the chronological ordering applies to posts only). Required by PRD-100-R16 / PRD-105-R2.
- `_site/act/n/{id}.json` — one node file per index entry. Required by PRD-100-R21 / PRD-105-R4.
- `_site/act/sub/posts.json` — the subtree file for the synthetic `posts` parent. Subtree depth defaults to 3; the corpus is shallow (parent → leaf only) so no truncation. Required by PRD-100-R32 / PRD-105-R6.
- `_site/.act-build-report.json` — build report sidecar per PRD-408-R15 / PRD-400-R27.

The example MUST NOT emit `_site/act/index.ndjson`, MUST NOT advertise `search_url_template`, and MUST NOT modify Eleventy-owned paths under `_site/` (rendered HTML, assets, etc.) per PRD-408-R14. Conformance: **Core**.

**PRD-707-R13.** ACT-owned writes MUST be atomic per PRD-408-R14 / PRD-400-R23. The build report MUST be added to Eleventy's ignore list per PRD-408-R15 so Eleventy does not copy it as a passthrough asset. Conformance: **Core**.

#### Validator gate

**PRD-707-R14.** The example MUST validate clean against PRD-600 in CLI mode `--file`:

```bash
act-validate --file _site/.well-known/act.json --conformance
```

The reporter output MUST satisfy: `gaps` is empty, `achieved.level` is `"standard"`, `achieved.delivery` is `"static"`. The default 16-node sample (PRD-600-R26) is sufficient since the corpus is at most 100 nodes; the implementer MAY override with `--sample all` for the canonical CI run. Conformance: **Core**.

**PRD-707-R15.** The example's `declared.level` (in the manifest) MUST equal the reporter's `achieved.level` (`"standard"`). The reporter walk MUST traverse the synthetic `posts` subtree successfully. Every cited P2 PRD requirement listed in the §"P2 PRDs the example composes" table MUST be exercised in at least one observation by PRD-600's reporter. Conformance: **Standard**.

### Wire format / interface definition

PRD-707 introduces no new wire format. The example emits per PRD-100 envelopes through PRD-408's pipeline. The interface contract is the source-side surface (`eleventy.config.mjs` + post frontmatter conventions) reproduced in PRD-707-R10 and PRD-707-R11 above.

### Errors

| Condition | Behavior | Notes |
|---|---|---|
| A post `.md` file lacks `title` frontmatter | PRD-201 emits a partial node per PRD-200-R16 (recoverable); a build warning is recorded. | The canonical corpus does not exercise this path; lint as a project rule. |
| A post path collides with the directory-index pattern (R5) | Hard build error per PRD-201-R7. | Negative fixture. |
| A post normalises to id `posts` | Hard build error per PRD-707-R6 (synthetic parent ID reserved). | Negative fixture. |
| Plugin options supply `bindings: [...]` | Configuration error per PRD-408-R10. | Negative fixture. |
| Eleventy `< 2.0` | Configuration error per PRD-408-R2. | Out of scope for the canonical corpus. |
| `act-validate` reports a non-empty `gaps` array | CI failure | Per PRD-707-R14. |
| Reporter's `achieved.level` is `"core"` | CI failure | Per PRD-707-R15; root cause is typically a missing subtree emission for `posts`. |

---

## Examples

### Example 1 — Frontmatter on a typical post (`posts/2026-05-01-launching-tinybox.md`)

```md
---
title: Launching Tinybox
summary: Tinybox enters public beta — what it is, why it exists, and how to get on the waitlist.
date: 2026-05-01
tags:
  - launch
  - product
---

We're launching Tinybox today. After eighteen months of building...

```bash
curl https://api.tinybox.dev/v1/objects
```

Tinybox is a storage primitive...
```

PRD-201 stamps `summary_source: "author"`. The path-derived id is `posts/2026-05-01-launching-tinybox`.

### Example 2 — A post without frontmatter `summary` (extracted path)

```md
---
title: Field notes from the first week
date: 2026-05-08
---

We shipped the public beta a week ago. Here's what we learned...
```

PRD-201's extraction algorithm (PRD-201-R18) takes the first paragraph as the summary and stamps `summary_source: "extracted"`. The token cap from PRD-201-R19 / PRD-100-R20 applies.

### Example 3 — A draft post that is excluded (`posts/2026-06-01-draft-deep-dive.md`)

```md
---
title: Deep dive on lifecycle policies
permalink: false
---

(Work in progress.)
```

PRD-408-R6 excludes this file; the build report includes a warning of code `excluded_by_permalink` referencing the source path. The post is absent from `_site/act/index.json` and from `_site/act/n/`.

### Example 4 — Expected `_site/.well-known/act.json`

```json
{
  "act_version": "0.1",
  "site": { "name": "Tinybox Blog" },
  "index_url": "/act/index.json",
  "node_url_template": "/act/n/{id}.json",
  "subtree_url_template": "/act/sub/{id}.json",
  "conformance": { "level": "standard" },
  "delivery": "static",
  "capabilities": { "etag": true, "subtree": true }
}
```

### Example 5 — Expected reporter output

```json
{
  "act_version": "0.1",
  "url": "file://_site/.well-known/act.json",
  "declared": { "level": "standard", "delivery": "static" },
  "achieved": { "level": "standard", "delivery": "static" },
  "gaps": [],
  "warnings": [],
  "passed_at": "2026-05-02T16:00:00Z"
}
```

---

## Test fixtures

PRD-707 is a reference example PRD; fixture files land in Phase 6.

### Positive

- `fixtures/707/positive/source-corpus/` → the canonical 30–100 node Eleventy source tree (`eleventy.config.mjs`, `package.json`, `index.md`, `about.md`, `posts/*.md`, plus an explicit draft post excluded by `permalink: false`). Satisfies PRD-707-R1 through R11.
- `fixtures/707/positive/expected-_site-manifest.json` → the byte-equal expected `_site/.well-known/act.json`. Satisfies PRD-707-R12.
- `fixtures/707/positive/expected-_site-index.json` → the byte-equal expected `_site/act/index.json` showing reverse-chronological order with the draft post absent. Satisfies PRD-707-R7, R12.
- `fixtures/707/positive/expected-reporter.json` → the expected `act-validate --file --conformance` reporter output. Satisfies PRD-707-R14, R15.

### Negative

- `fixtures/707/negative/bindings-supplied/eleventy.config.mjs` → a config that supplies `bindings: [...]`. Expected outcome: configuration error per PRD-408-R10.
- `fixtures/707/negative/posts-id-collision/` → a corpus including a post whose path-derived id normalises to `posts`. Expected outcome: hard build error per PRD-707-R6.
- `fixtures/707/negative/directory-index-collision/` → a corpus with both `posts/2026-05-01-hello.md` and `posts/2026-05-01-hello/index.md`. Expected outcome: hard build error per PRD-201-R7 / PRD-707-R5.
- `fixtures/707/negative/eleventy-1.x/` → a corpus pinned to `@11ty/eleventy@^1.0.0`. Expected outcome: configuration error per PRD-408-R2.

---

## Versioning & compatibility

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a post inside the 30–100 envelope | MINOR | Surface grows; conformance shape unchanged. |
| Promote the example to Plus (search artefact) | MAJOR | Changes the contract for downstream adopters. |
| Bump the Eleventy peer-dependency floor (2.x → 3.x) | MINOR if PRD-408 remains 2.x-compatible; MAJOR if PRD-408 itself bumps. | Tracks PRD-408. |
| Add MDX support | MAJOR | Eleventy does not natively support MDX; this would be a new example. |
| Change the synthetic parent ID from `posts` to a different reserved name | MAJOR | Breaks consumer expectations and may collide with a real post. |
| Add an optional frontmatter key (e.g., `tags`, currently already permitted) | MINOR | Per PRD-201's open-key discipline. |
| Tighten the corpus envelope below 30 nodes | MAJOR | Shrinks testable surface. |
| Loosen the corpus envelope above 100 nodes | MAJOR | May force Plus reconsideration. |

### Forward compatibility

PRD-707 inherits PRD-100 / PRD-107's forward-compatibility rules unchanged.

### Backward compatibility

PRD-707's canonical fixture set is the v0.1 baseline. Future v0.2 amendments (e.g., adding multi-locale, adding component-bindings via a non-Eleventy runtime — not via PRD-408) constitute new PRDs, not amendments to PRD-707.

---

## Security considerations

PRD-707 inherits the security posture of PRD-109, PRD-408 § Security, and PRD-201 § Security.

- **No PII in the source corpus.** The canonical posts use fictional product narratives only.
- **`_site/.act-build-report.json` is not deployed.** PRD-408-R15 already mandates Eleventy's ignore list be updated; PRD-707-R13 reasserts the contract.
- **Drafts MUST NOT leak into ACT emission.** PRD-707-R7 makes the test for the canonical excluded-by-permalink path part of the acceptance criteria. A future regression in PRD-408's permalink-aware filtering would be caught by this fixture.
- **No origin-trust surface.** Single-origin, no `mounts`. Cross-origin discovery is a PRD-706 concern.
- **Frontmatter does not control code execution.** PRD-201 parses frontmatter as data; reserved-key violations are a hard error per PRD-201-R6 / PRD-707-R10.

---

## Implementation notes

### Repository layout (canonical fixture)

```
.
├── eleventy.config.mjs
├── package.json
├── index.md
├── about.md
├── posts/
│   ├── 2026-04-15-prelaunch-thoughts.md
│   ├── 2026-05-01-launching-tinybox.md
│   ├── 2026-05-08-field-notes.md
│   ├── 2026-06-01-draft-deep-dive.md   (permalink: false — excluded)
│   └── ... (20–80 more posts)
└── (after build)
    └── _site/
        ├── .well-known/act.json
        ├── act/
        │   ├── index.json
        │   ├── n/
        │   │   ├── posts.json
        │   │   ├── posts/2026-05-01-launching-tinybox.json
        │   │   ├── posts/2026-05-08-field-notes.json
        │   │   └── ...
        │   └── sub/
        │       └── posts.json
        ├── .act-build-report.json
        └── (rendered HTML — Eleventy's own output, not normative for ACT)
```

### `package.json` minimum

```json
{
  "name": "act-example-707-tinybox-blog",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "eleventy",
    "validate": "act-validate --file _site/.well-known/act.json --conformance"
  },
  "dependencies": {
    "@11ty/eleventy": "^2.0.0",
    "@act/eleventy": "^0.1.0",
    "@act/markdown": "^0.1.0"
  },
  "devDependencies": {
    "@act/validator": "^0.1.0"
  }
}
```

### CI gate

```yaml
# .github/workflows/ci.yml (excerpt)
- run: npm ci
- run: npm run build
- run: npm run validate
```

The `validate` script exits non-zero on any `gaps` entry per PRD-600-R27. The default 16-node sample is sufficient for a 30–100 node corpus; the canonical CI run MAY use `--sample all` to exercise every node including the synthetic `posts` parent.

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-02 | Jeremy Forsythe | Initial draft. Pins the Eleventy + markdown blog reference example (TS-impl counterpart to PRD-703 Hugo) to a Standard conformance target with a 30–100 post corpus, a synthetic chronological-index parent, and exercises PRD-408 / PRD-201 / PRD-600 / PRD-100–105 / PRD-107. Carves out component bindings (PRD-408-R10), MDX, i18n, NDJSON, and search as out-of-scope for v0.1. Status: Draft → In review. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). PRD-201-R4 `description`-as-`summary`-alias ambiguity (Open Q2) accepted as v0.2 candidate; OQ retained. |
