# PRD-701 — Large documentation site (Docusaurus + markdown)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Site description

A larger documentation site built on Docusaurus 3.x with a single English locale, a single docs instance, a single non-versioned `docs/` content tree, a `sidebars.js` enumerating a 4-level category hierarchy, and a markdown corpus of roughly 200–500 pages. The reference example sits one notch up the scale ladder from PRD-700: where PRD-700 proves "the smallest defensible Astro stack lights up Standard cleanly," PRD-701 proves "PRD-401 / PRD-404 / PRD-201 / PRD-600 / PRD-107 hold up under a non-trivial corpus that an actual product-docs operator would ship." The corpus mirrors what an enterprise SDK reference site looks like in practice — getting-started, concepts, API reference grouped by surface area, recipes, troubleshooting, changelog — rather than the tiny worked example in v0.1 draft §8.1.

Scale envelope: between 200 and 500 ACT nodes after PRD-201 + PRD-404 emission (one node per markdown source file plus synthesized parent nodes for `sidebars.js` categories per PRD-404-R6); 1 locale (`en-US`); static delivery only; no runtime endpoints; no marketing-namespace blocks; no MDX component extraction (the corpus is `.md`-only — an MDX-driven docs site is a v0.2 candidate).

The example exists to (a) prove that PRD-404's sidebar-to-`parent`/`children` derivation produces a correct subtree forest at scale, (b) exercise PRD-201's path-derived ID strategy across a deep hierarchy, (c) stress-test PRD-600's discovery walk and per-PRD-103 ETag derivation against a realistic node count, and (d) supply Phase 6 with a non-trivial CI baseline so regression bugs in the generator pipeline surface against scale, not just toy corpora.

### Problem

PRD-700 proves the smallest viable Astro stack works. It does not prove that PRD-201's path-derived IDs hold up across hundreds of files, that PRD-404's sidebar synthesis correctly emits subtree files for every category, that the build report's per-emission enumeration scales, that PRD-103's ETag determinism holds across rebuilds of a corpus where most files are unchanged, or that PRD-600's default 16-node sample is statistically meaningful when the corpus is two orders of magnitude larger. These are practical questions every Docusaurus-shop adopter asks before commiting their docs site to ACT, and Phase 4's brief specifically calls for a "large documentation site" companion to PRD-700.

### Goals

1. Pin the **stack**: Docusaurus 3.x + `@act/docusaurus-plugin` (PRD-404) + `@act/markdown` (PRD-201, auto-wired) + `@act/validator` (PRD-600).
2. Pin the **content scale**: 200–500 ACT nodes after emission, on a fixed sidebar shape that produces a 4-level category hierarchy.
3. Pin the **declared conformance level** at **Standard**, with rationale: subtree emission flows directly from `sidebars.js` categories per PRD-404-R6 and adds material agent-utility at scale; Plus-tier capabilities (NDJSON, search) deliver real value at this corpus size but require operator-supplied artefacts (PRD-404-R11) that PRD-701 does not commit to authoring as part of the reference example.
4. Pin the **file-by-file emission target** under Docusaurus's `build/` directory.
5. Pin the **acceptance criteria** so the Phase 6 implementer can demonstrate a clean PRD-600 run at scale.
6. Declare **versioned-docs as out of scope** and document why (PRD-404-R8 supports versioning at Plus, but PRD-701 does not exercise it; a versioned reference example is a v0.2 candidate per the §"Out of scope" note).

### Non-goals

1. **Versioned docs.** PRD-404-R8 specifies the contract; PRD-701 does not exercise it. Versioned trees in v0.1 are a Docusaurus-only capability via PRD-404-R8 and are deliberately deferred from PRD-701 to keep the example focused on scale rather than on mounts. A v0.2 example may add versioning.
2. **i18n.** PRD-404-R9 supports it; PRD-701 stays single-locale. Multi-locale large-docs is a Phase 6+ candidate (likely a PRD-708 in v0.2 or a corpus-extension fixture).
3. **MDX component extraction.** The corpus is `.md`-only. PRD-301-driven MDX extraction is exercised by PRD-702 (Next.js + Contentful + i18n).
4. **Search advertisement.** PRD-404-R11 requires an operator-supplied search artefact; PRD-701 declines to commit one. The manifest MUST NOT advertise `search_url_template`.
5. **NDJSON index.** Plus-tier; not required for Standard. PRD-701 may revisit in a v0.2 amendment if telemetry from real-world adopters indicates demand.
6. **Multi-instance Docusaurus.** PRD-404-R3 admits multiple plugin instances; PRD-701 uses one.
7. **Authoring the implementation.** Phase 6 owns the implementation against this PRD as the brief.
8. **Defining the wire format.** PRD-100 / PRD-105 own that.

### Stakeholders / audience

- **Authors of:** Phase 6 implementation team.
- **Reviewers required:** BDFL Jeremy Forsythe.
- **Downstream consumers:** PRD-600's hosted SPA (links to a deployed PRD-701 manifest as the "scale" demo); PRD-801 migration playbook (cites PRD-701 as the "Docusaurus shop" target).

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The 200–500 node corpus pushes PRD-103's ETag re-derivation past PRD-103-R7's 100ms determinism window in some rebuild scenarios. | Low | Medium | PRD-103 / PRD-600 own the prober; PRD-701 does not introduce timing assumptions. The example's CI runs `act-validate --file` (offline) where timing is not a concern; the deployed `--url` check is single-shot per node. |
| Sidebar categories produce ID collisions (e.g., a category labelled "Authentication" alongside a doc whose path-derived id is `authentication`). | Medium | Medium | PRD-404-R6 already pins category-ID lowercasing and grammar normalization with collision detection as a hard error. PRD-701-R5 reasserts the rule and the negative fixture covers the case. |
| The corpus shape drifts as future authors add pages, slipping above the 500-node cap and forcing a Plus declaration via NDJSON. | Medium | Low | PRD-701-R3 caps the canonical fixture corpus at 500 nodes; growth past the cap forces an explicit revisit of the conformance-level claim. |
| PRD-600's default 16-node sample misses regressions on rare-shape nodes (e.g., the one node with a `data` block embedded in markdown). | Medium | Medium | PRD-701-R12 mandates `--sample all` for the CI gate (overriding the default), so every node is probed at least once. The reasoning is encoded as a normative requirement. |
| Build-report enumeration of 200–500 emissions inflates the report past a comfortable size for human inspection. | Low | Low | PRD-400-R27 / PRD-404-R12 already bound report shape; an oversize report is a Phase 6 concern, not a PRD-701 contract. |
| Sidebar orphans (docs not referenced from any sidebar) silently become top-level nodes per PRD-404-R6 and the user does not realize it. | Medium | Low | PRD-404-R6 surfaces orphans as build warnings; PRD-701-R6 makes "zero orphan warnings" an acceptance criterion for the canonical corpus. |

### Open questions

1. Should PRD-701 commit to a specific page count (e.g., exactly 300 nodes) for reproducibility, or admit the 200–500 envelope so the implementer has authoring latitude? Tentatively: keep the envelope. The fixture corpus pins a specific count once Phase 6 authors it; the PRD-701 contract is the envelope and the conformance gate.
2. Should the example wire `@docusaurus/plugin-content-blog` alongside `@docusaurus/plugin-content-docs`, or stay docs-only? Tentatively: docs-only. PRD-707 is the canonical blog example (Eleventy); PRD-701 stays focused on docs scale.
3. Should the example include a `data` block (a JSON table in a recipes page) so PRD-102-R4 has a non-trivial exercise? Tentatively: yes — at least one recipes page should include a fenced `\`\`\`json data` block to round-trip through PRD-201's data-fence mapping. Encoded normatively at PRD-701-R7.
4. **Spec ambiguity** — PRD-201-R12 specifies "default coarse mode" (one `markdown` block per file) but does not state how PRD-404 surfaces the opt-in to fine-grained mode. PRD-404 references neither PRD-201's `parseMode` nor an equivalent configuration knob. Flagged here as an ambiguity in the cited P2 PRDs that the example surfaces; PRD-701 stays in coarse mode (the documented PRD-201 default), so the example does not depend on the resolution. Flag carried in the §Open questions of this PRD per the workflow.md "do not silently amend" rule.

### Acceptance criteria

- [ ] Every normative requirement has an ID `PRD-701-R{n}` and a declared conformance level per PRD-107.
- [ ] The Specification section opens with a table mapping every requirement to PRD-404 / PRD-201 / PRD-600 / 100-series requirements exercised.
- [ ] The corpus envelope (200–500 nodes) and sidebar shape (4-level category hierarchy) are pinned.
- [ ] The file-by-file emission target under `build/` is enumerated.
- [ ] Conformance target is declared as **Standard** with rationale; versioned-docs and search are explicitly carved out.
- [ ] Acceptance criteria bind the example to PRD-600's verdict (zero errors, achieved == declared, P2-coverage check, `--sample all`).
- [ ] An inline `docusaurus.config.js` snippet matches PRD-404-R16 shape.
- [ ] A `sidebars.js` shape snippet covers the canonical 4-level hierarchy.
- [ ] No new JSON Schemas or fixture files are created.
- [ ] Versioning & compatibility section classifies changes per PRD-108.
- [ ] Security section cites PRD-109 + PRD-404 § Security.
- [ ] Open questions flag the PRD-201/PRD-404 fine-grained-mode wiring ambiguity.
- [ ] Changelog entry dated 2026-05-02 by Jeremy Forsythe is present.

---

## Context & dependencies

### Depends on

- **PRD-404** (Accepted) — Docusaurus plugin; the example's build entry point.
- **PRD-201** (Accepted) — Markdown adapter; auto-wired by PRD-404 against the docs corpus.
- **PRD-600** (Accepted) — Validator; the example's gate.
- **PRD-100** (Accepted) — Wire format envelopes the build emits.
- **PRD-102** (Accepted) — Content blocks; the example exercises `markdown` plus one `data` block.
- **PRD-103** (Accepted) — ETag derivation.
- **PRD-105** (Accepted) — Static delivery profile.
- **PRD-107** (Accepted) — Conformance levels; PRD-701 declares Standard.
- **PRD-108** (Accepted) — Versioning policy.
- **PRD-109** (Accepted) — Security posture.
- External: [Docusaurus 3.x](https://docusaurus.io/), [Docusaurus sidebars](https://docusaurus.io/docs/sidebar).

### Blocks

_Not applicable — PRD-701 is a leaf reference example._

### References

- v0.1 draft: §8.1 (the Tinybox API docs walkthrough; PRD-701 generalizes the walkthrough to a much larger corpus).
- `prd/000-INDEX.md` 700-series row (PRD-701 entry).
- `docs/workflow.md` Phase 4 (reference-example authoring rules).
- Prior art: [Docusaurus's own docs site](https://docusaurus.io/docs) (the canonical "large Docusaurus docs site" reference shape; ~250 pages; non-versioned for the v3 docs surface; sidebar-driven).

---

## Specification

This is the normative section. RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) apply as clarified by RFC 8174.

### P2 PRDs the example composes

The table below lists every P2 PRD the example cites and the requirement IDs it exercises. The Phase 6 implementer MUST verify, via PRD-600's reporter, that every cited requirement has at least one corresponding pass observation in the run.

| Cited PRD | Requirement IDs exercised | What the example proves |
|---|---|---|
| PRD-404 | R1, R2, R3, R4, R5, R6, R10, R12, R13, R14, R15, R16, R17 | Plugin module shape, peer-dependency floor, single-instance default, lifecycle hook implementation (`loadContent` / `contentLoaded` / `postBuild`), docs auto-wiring, sidebar-to-parent/children mapping, output emission layout, build-report writing, atomic writes, conformance band auto-detection, adapter pinning, configuration shape, logger plumbing. |
| PRD-201 | R1, R2, R3, R4, R5, R7, R8, R9, R11, R12, R13, R16, R17, R18, R19, R20, R22, R23 | Adapter contract, config schema, YAML frontmatter, recognized-key set, path-derived ID strategy with `index.md` collapsing, file walk over a deep tree, default coarse `markdown` block emission, `code` and `data` fence recognition, summary derivation, capability declaration, level-aware emission. |
| PRD-600 | R1, R2, R3, R4, R5, R6, R7, R11, R13, R14, R15, R16, R17, R18, R19, R20, R21, R23, R26, R27, R30 | Envelope schema validation across hundreds of files, cycle detection over a deep `children` graph, ID grammar checking at scale, subtree depth/order checking, the reporter output, the `--sample all` walk variant, the fixture-corpus consumption. |
| PRD-100 | R1, R2, R3, R4, R5, R10, R11, R12, R16, R17, R18, R21, R22, R23, R24, R25, R28, R32, R33, R34, R35 | Manifest required-field set, ID grammar, percent-encoding on URL substitution, index envelope, node envelope, `children` cycle ban, content-block discriminator, subtree envelope and depth bounds, depth-first ordering, oversize-subtree truncation. |
| PRD-102 | R1, R3, R4, R12, R13, R15, R16, R17, R24, R26 | `markdown`, `code`, `data` blocks, `summary_source` enum, `summary` required and non-empty, `content` required at Core, block-order preservation, summary-length warning. |
| PRD-103 | R1, R2, R3, R4 | `etag` field present, value-shape regex, `s256:` admit-list, static derivation. |
| PRD-105 | R1, R2, R4, R6, R8, R10 | Manifest at `/.well-known/act.json`, index reachable, node files reachable for every emitted ID, subtree files for every advertised parent, MIME types, no body mutation on rebuild. |
| PRD-107 | R1, R3, R4, R6, R8, R11 | `conformance.level` declaration, `delivery: "static"`, additivity, Core inclusion list, Standard inclusion list. |

### Conformance level

PRD-701 declares the example **Standard**. Rationale:

- The corpus naturally produces a 4-level category hierarchy via `sidebars.js`. PRD-404-R6's sidebar-to-`parent`/`children` mapping yields subtree-eligible parents (categories) for every level above the leaf docs. Standard's subtree contract (PRD-107-R8) carries its weight here — agents can fetch a category subtree without re-walking the index.
- Plus-tier capabilities are intentionally avoided. NDJSON would deliver real value at 200–500 nodes for high-throughput consumers, but adds an emission contract that PRD-404 supports unconditionally (`capabilities.ndjson_index`) and is therefore not the bottleneck for "Plus" — the bottleneck is the search artefact (PRD-404-R11). PRD-701 declines to commit to a search backend; therefore Plus is intentionally avoided.
- Versioned-docs (also Plus, via the `mounts` mechanic) is out of scope per the §Non-goals.

Per requirement breakdown:

- **Core:** PRD-701-R1, R2, R3, R4, R5 (clauses on category-ID derivation), R7, R8, R9, R10, R11, R13, R14, R15.
- **Standard:** PRD-701-R6 (subtree emission for every sidebar category), PRD-701-R12 (`--sample all` gate), PRD-701-R16 (achieved == Standard).
- **Plus:** _Not applicable — PRD-701 declares Standard._

A producer satisfying PRD-701 satisfies PRD-107-R6 (Core) and PRD-107-R8 (Standard) by additivity.

### Normative requirements

#### Stack

**PRD-701-R1.** The example MUST build with Docusaurus 3.x as the host framework and MUST consume `@act/docusaurus-plugin` (PRD-404) as the only ACT plugin in `docusaurus.config.js` `plugins: [...]`. The example MUST NOT depend on any other generator. Conformance: **Core**.

**PRD-701-R2.** The example MUST consume `@act/markdown` (PRD-201) as the source adapter for its docs corpus, wired automatically by PRD-404-R5 (docs auto-wiring). The example MUST NOT supply a custom `adapters` array. Conformance: **Core**.

#### Corpus scale and shape

**PRD-701-R3.** The example's canonical content corpus MUST consist of between 200 and 500 ACT nodes after PRD-201 / PRD-404 emission. The count includes both source-file nodes (one per `.md` file under `docs/`) AND synthesized parent nodes (one per `sidebars.js` category per PRD-404-R6). The Phase 6 fixture pins a specific count within the envelope; the PRD-701 contract is the envelope. Conformance: **Core**.

**PRD-701-R4.** The corpus MUST be authored as `.md` files only (no `.mdx`). MDX-driven extraction is out of scope; PRD-301 / PRD-404-R7 are not exercised. The default coarse PRD-201 mode (one `markdown` block per file) MUST be in effect; the example MUST NOT toggle PRD-201's fine-grained mode (see Open Question 4 — the wiring of fine-grained mode through PRD-404 is unresolved upstream). Conformance: **Core**.

**PRD-701-R5.** The example's `sidebars.js` MUST declare a 4-level category hierarchy of the following shape (level names are illustrative; the depth and shape are normative):

```js
// sidebars.js
module.exports = {
  docs: [
    "intro",
    {
      type: "category",
      label: "Getting started",
      items: ["getting-started/install", "getting-started/quickstart", "getting-started/first-project"],
    },
    {
      type: "category",
      label: "Concepts",
      items: [
        "concepts/data-model",
        "concepts/auth",
        { type: "category", label: "Storage", items: ["concepts/storage/buckets", "concepts/storage/objects", "concepts/storage/lifecycle"] },
      ],
    },
    {
      type: "category",
      label: "API reference",
      items: [
        { type: "category", label: "Buckets", items: ["api/buckets/create", "api/buckets/get", "api/buckets/list", "api/buckets/delete"] },
        { type: "category", label: "Objects", items: ["api/objects/upload", "api/objects/download", "api/objects/list", "api/objects/delete"] },
        { type: "category", label: "Webhooks", items: ["api/webhooks/register", "api/webhooks/list", "api/webhooks/delete"] },
      ],
    },
    { type: "category", label: "Recipes", items: [/* … */] },
    { type: "category", label: "Troubleshooting", items: [/* … */] },
    "changelog",
  ],
};
```

PRD-404-R6's sidebar-to-`parent`/`children` derivation MUST produce a synthesized parent node per category (lowercased, grammar-normalised id), with the category's children populated from its `items`. Category-ID collisions with real doc IDs are a hard error per PRD-404-R6 / PRD-200-R10. The Phase 6 implementer MUST verify zero collisions in the canonical corpus. Conformance: **Core** (R5 itself; the subtree emission lands at Standard via R6).

**PRD-701-R6.** Every `sidebars.js` category MUST yield a subtree-eligible parent node, and PRD-404 MUST emit a subtree file per `dist/build/act/sub/{category-id}.json` per PRD-404-R10 / PRD-404-R14. The example's CI MUST observe at least one subtree file per declared category in the canonical sidebar shape. Sidebar orphan docs (docs not referenced from any sidebar entry) MUST NOT exist in the canonical corpus — a build run reporting `excluded_by_permalink` or `sidebar_orphan` warnings is a CI failure for the canonical run. Conformance: **Standard**.

**PRD-701-R7.** At least one node in the corpus MUST embed a fenced `data`-block per PRD-201-R13 / PRD-102-R4 (e.g., a JSON table in a recipes page) so the example exercises the `data` block path. The remainder of the corpus MAY use only the default coarse `markdown` block. Conformance: **Core**.

#### Frontmatter discipline

**PRD-701-R8.** Every `.md` source file MUST declare YAML frontmatter with at minimum `title` and `summary`. Optional keys (`type`, `parent`, `related`, `tags`) MAY be set per PRD-201-R4. Reserved keys (per PRD-201-R6) MUST NOT be set in frontmatter. The PRD-201 adapter stamps `summary_source: "author"` per PRD-201-R20. Conformance: **Core**.

#### Configuration shape

**PRD-701-R9.** The example's `docusaurus.config.js` MUST register `@act/docusaurus-plugin` with the following minimum options shape:

```js
// docusaurus.config.js (excerpt)
module.exports = {
  title: "Tinybox SDK",
  url: "https://example.com",
  baseUrl: "/",
  i18n: { defaultLocale: "en", locales: ["en"] },
  presets: [
    [
      "classic",
      {
        docs: { sidebarPath: require.resolve("./sidebars.js") },
        blog: false,
        theme: { customCss: require.resolve("./src/css/custom.css") },
      },
    ],
  ],
  plugins: [
    [
      "@act/docusaurus-plugin",
      {
        target: "standard",
        urlTemplates: {
          index_url: "/act/index.json",
          node_url_template: "/act/n/{id}.json",
          subtree_url_template: "/act/sub/{id}.json",
        },
      },
    ],
  ],
};
```

The `target` MUST be `"standard"`. The `urlTemplates` MUST include `subtree_url_template`. The example MUST NOT set `i18n: true` on the plugin (single-locale corpus per the i18n auto-wiring rule in PRD-404-R9: locales array length is 1, auto-wiring is skipped). The example MUST NOT supply `searchArtifactPath` or `urlTemplates.search_url_template` (declines Plus per PRD-404-R11). The example MUST NOT exercise versioned-docs; `versions.json` MUST NOT exist. The example MUST NOT supply `bindings` (the `.md`-only corpus does not require PRD-301 wiring). Conformance: **Core**.

#### File-by-file emission target

**PRD-701-R10.** After `npm run build` (Docusaurus's standard build command), the resolved `build/` directory MUST contain at minimum the following ACT-owned paths:

- `build/.well-known/act.json` — manifest declaring `conformance: { level: "standard" }`, `delivery: "static"`, `index_url`, `node_url_template`, `subtree_url_template`, `capabilities: { etag: true, subtree: true }`. Required by PRD-105-R1 / PRD-107-R8.
- `build/act/index.json` — index with one entry per emitted node (200–500 entries). Required by PRD-100-R16 / PRD-105-R2.
- `build/act/n/{id}.json` — one node file per index entry (200–500 files). Required by PRD-100-R21 / PRD-105-R4.
- `build/act/sub/{category-id}.json` — one subtree file per `sidebars.js` category (one for each of `getting-started`, `concepts`, `concepts/storage`, `api-reference`, `api-reference/buckets`, `api-reference/objects`, `api-reference/webhooks`, `recipes`, `troubleshooting`, plus any nested categories declared in the canonical sidebar). Required by PRD-100-R32 / PRD-105-R6 / PRD-404-R6.
- `build/.act-build-report.json` — build report sidecar per PRD-404-R12 / PRD-400-R27. The report MUST NOT be uploaded to a CDN.

The example MUST NOT emit `build/act/index.ndjson`, MUST NOT advertise `search_url_template`, MUST NOT emit per-version directories under `build/v*/`, and MUST NOT emit per-locale directories under `build/{locale}/`. The example MUST NOT modify Docusaurus-owned paths under `build/` (`index.html`, `assets/**`, etc.) per PRD-404-R10. Conformance: **Core**.

**PRD-701-R11.** ACT-owned writes MUST be atomic per PRD-404-R13 / PRD-400-R23. Conformance: **Core**.

#### Validator gate at scale

**PRD-701-R12.** The example MUST validate clean against PRD-600 in CLI mode `--file` with the **non-default** `--sample all` flag, so every emitted node is probed (not the 16-node default per PRD-600-R26). The CI invocation MUST be:

```bash
act-validate --file build/.well-known/act.json --conformance --sample all
```

The reporter output MUST satisfy: `gaps` is empty, `achieved.level` is `"standard"`, `achieved.delivery` is `"static"`, and the reporter's internal walk visits every node ID enumerated in `build/act/index.json`. Conformance: **Standard**.

**PRD-701-R13.** The example's `declared.level` (in the manifest) MUST equal the reporter's `achieved.level` (`"standard"`). A discrepancy is an example-level CI failure per PRD-107-R22 (well-formed, but reportable). Conformance: **Core**.

**PRD-701-R14.** The example's CI MUST run the validator gate from PRD-701-R12 on every pull request that touches the `docs/`, `sidebars.js`, or plugin-options surface. A post-deployment `act-validate --url <deployed-url> --conformance --sample 32` MAY additionally run, with the post-deployment sample reduced to 32 to stay within PRD-600-R20's default request budget. Conformance: **Core**.

**PRD-701-R15.** Every cited P2 PRD requirement listed in the §"P2 PRDs the example composes" table MUST be exercised in at least one observation by PRD-600's reporter on the canonical corpus run. Conformance: **Standard**.

**PRD-701-R16.** The reporter MUST NOT emit any `gaps` entry against the canonical corpus, and MUST NOT emit any `warnings` entry of the following codes: `summary-length` (warning that PRD-100-R20 / PRD-102-R26 thresholds were exceeded), `body-token` (PRD-102-R28 over 10K tokens). Authoring discipline (summaries ≤ 50 tokens, body ≤ 10K tokens per node) is enforced through the canonical corpus's content. Conformance: **Standard**.

### Wire format / interface definition

PRD-701 introduces no new wire format. The example emits per PRD-100 envelopes through PRD-404's pipeline. The interface contracts are the source-side surface (`sidebars.js` shape + `docusaurus.config.js`) reproduced in PRD-701-R5 and PRD-701-R9 above.

### Errors

| Condition | Behavior | Notes |
|---|---|---|
| A `.md` file lacks required frontmatter (`title`, `summary`) | Build error per PRD-201's failure mode (PRD-200-R18 unrecoverable; missing `title` is recoverable per PRD-201's partial-node path; `summary` is derived if absent — but PRD-701-R8 demands frontmatter `summary` for `summary_source: "author"` discipline). | A missing `summary` would not break the build (PRD-201 extracts), but the example's CI lints frontmatter as a project rule. |
| A `sidebars.js` category-id collides with a real doc id | Hard build error per PRD-404-R6. | Phase 6 implementer chooses category labels to avoid this. |
| A doc is not referenced from any sidebar entry | PRD-404-R6 emits `sidebar_orphan` warning; PRD-701-R6 makes a non-zero orphan count a CI failure for the canonical corpus. | The canonical corpus is hand-authored to reach zero orphans. |
| `act-validate` reports a non-empty `gaps` array | CI failure | Per PRD-701-R12. |
| Reporter's `achieved.level` is `"core"` | CI failure | Per PRD-701-R13; root cause is typically a missing subtree file. |
| Reporter walk visits fewer nodes than the index lists | CI failure | Per PRD-701-R12; indicates `--sample all` was not honored, or a node file 404'd. |

---

## Examples

### Example 1 — `sidebars.js` shape (excerpt)

See PRD-701-R5 above. The full canonical sidebar lands as a Phase 6 fixture.

### Example 2 — Frontmatter on a typical doc (`docs/api/buckets/create.md`)

```md
---
title: Create a bucket
summary: Provision a new storage bucket in the workspace.
type: reference
related:
  - api/buckets/list
  - api/buckets/delete
---

## Request

```bash
curl -X POST -H 'Authorization: Bearer $TOKEN' \
  -d '{"name":"my-bucket","region":"us-east-1"}' \
  https://api.tinybox.dev/v1/buckets
```

## Response

The API returns the created bucket descriptor. See [List buckets](/docs/api/buckets/list) for paging.
```

PRD-201 stamps `summary_source: "author"`, the path-derived ID is `api/buckets/create`, and the synthesized PRD-404 parent is `api-reference/buckets`.

### Example 3 — Expected reporter output (excerpt)

```json
{
  "act_version": "0.1",
  "url": "file://build/.well-known/act.json",
  "declared": { "level": "standard", "delivery": "static" },
  "achieved": { "level": "standard", "delivery": "static" },
  "gaps": [],
  "warnings": [],
  "passed_at": "2026-05-02T15:30:00Z"
}
```

### Example 4 — A recipes page exercising a `data` block

```md
---
title: Bucket lifecycle policy reference
summary: Lifecycle rules table for retention configuration.
type: reference
---

The supported lifecycle transitions:

```json data
{
  "transitions": [
    { "from": "STANDARD", "to": "INFREQUENT", "after_days": 30 },
    { "from": "INFREQUENT", "to": "ARCHIVE",   "after_days": 90 },
    { "from": "ARCHIVE",   "to": "DEEP",       "after_days": 365 }
  ]
}
```
```

PRD-201-R13's data-fence recognition emits a `data`-typed block per PRD-102-R4, satisfying PRD-701-R7.

---

## Test fixtures

PRD-701 is a reference example PRD; fixture files land in Phase 6.

### Positive

- `fixtures/701/positive/source-corpus/` → the canonical 200–500 node Docusaurus source tree (`docs/`, `sidebars.js`, `docusaurus.config.js`, `package.json`, no `versioned_docs/`, no `i18n/`). Satisfies PRD-701-R1 through R9.
- `fixtures/701/positive/expected-build-manifest.json` → the byte-equal expected `build/.well-known/act.json`. Satisfies PRD-701-R10.
- `fixtures/701/positive/expected-build-report.json` → the byte-equal expected `build/.act-build-report.json` (with byte-fluctuating fields like timestamps masked). Satisfies PRD-701-R10, R16.
- `fixtures/701/positive/expected-reporter.json` → the expected `act-validate --file --conformance --sample all` reporter output. Satisfies PRD-701-R12, R13, R15.

### Negative

- `fixtures/701/negative/sidebar-collision.js` → a `sidebars.js` whose category label normalises to the same id as a real doc. Expected outcome: hard build error per PRD-404-R6.
- `fixtures/701/negative/sidebar-orphan/` → a corpus where one doc is not referenced from any sidebar entry. Expected outcome: build warning per PRD-404-R6, and a CI failure per PRD-701-R6 against the canonical-corpus contract.
- `fixtures/701/negative/oversize-summary.md` → a single doc whose frontmatter `summary` exceeds 280 characters. Expected outcome: PRD-600 emits a `summary-length` warning; CI fails per PRD-701-R16.
- `fixtures/701/negative/declared-plus-no-ndjson.json` → a manipulated copy of the manifest declaring `level: "plus"` without `index_ndjson_url`. Expected outcome: reporter emits `gaps` entry citing PRD-107-R10 with `achieved.level == "standard"`.

---

## Versioning & compatibility

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a category or doc inside the 200–500 envelope | MINOR | Surface grows; conformance shape unchanged. |
| Promote the example to Plus (add NDJSON / search artefact) | MAJOR | Changes the contract for downstream adopters. |
| Add a versioned-docs surface to the example | MAJOR | Rewrites the emission shape and forces Plus. |
| Bump the Docusaurus peer-dependency floor (3.x → 4.x) | MAJOR | Tracks PRD-404's own MAJOR bump. |
| Add an `.mdx` page (exercising PRD-301) | MAJOR | Adds a new component-extraction surface to the example's contract. |
| Add an optional frontmatter key (`tags`, etc.) | MINOR | Per PRD-201's open-key discipline. |
| Tighten the corpus envelope | MAJOR | Shrinks testable surface. |
| Loosen the corpus envelope above 500 nodes | MAJOR | Forces Plus reconsideration. |

### Forward compatibility

PRD-701 inherits PRD-100 / PRD-107's forward-compatibility rules unchanged.

### Backward compatibility

PRD-701's canonical fixture set is the v0.1 baseline. A v0.2 revision MAY introduce a versioned-docs companion, an MDX companion, or an i18n companion as new PRDs (PRD-708 et seq.); PRD-701 itself remains the docs-at-scale, single-locale, non-versioned, markdown-only baseline.

---

## Security considerations

PRD-701 inherits the security posture of PRD-109, PRD-404 § Security, and PRD-201 § Security.

- **No PII in the source corpus.** The canonical corpus uses fictional API surfaces. The Phase 6 implementer MUST NOT introduce real customer data, real auth tokens, or proprietary URLs.
- **`build/.act-build-report.json` is not deployed.** PRD-404-R12 already mandates the build report stay out of the deployed bundle; PRD-701 reasserts the contract because the report at this scale enumerates 200–500 emissions and may incidentally include local-build paths.
- **Sidebar-driven category IDs may incidentally encode product taxonomy.** That is the intended behavior; the security concern would be encoding internal-only category names. The Phase 6 implementer MUST author categories from the public-docs surface only.
- **No origin-trust surface.** The example is single-origin, no `mounts`. Cross-origin discovery is a PRD-706 concern.
- **`--sample all` enlarges the request budget on the deployed-URL gate.** PRD-701-R14 caps the deployed-URL sample at 32 (well within PRD-600-R20's 64-request default budget per origin) and runs `--sample all` only against the local file path.

---

## Implementation notes

### Repository layout (canonical fixture)

```
.
├── docusaurus.config.js
├── sidebars.js
├── package.json
├── docs/
│   ├── intro.md
│   ├── changelog.md
│   ├── getting-started/
│   │   ├── install.md
│   │   ├── quickstart.md
│   │   └── first-project.md
│   ├── concepts/
│   │   ├── data-model.md
│   │   ├── auth.md
│   │   └── storage/
│   │       ├── buckets.md
│   │       ├── objects.md
│   │       └── lifecycle.md
│   ├── api/
│   │   ├── buckets/
│   │   │   ├── create.md
│   │   │   ├── get.md
│   │   │   ├── list.md
│   │   │   └── delete.md
│   │   ├── objects/
│   │   │   ├── upload.md
│   │   │   ├── download.md
│   │   │   ├── list.md
│   │   │   └── delete.md
│   │   └── webhooks/
│   │       ├── register.md
│   │       ├── list.md
│   │       └── delete.md
│   ├── recipes/
│   │   └── ... (recipes; one MUST embed a `data` block per R7)
│   └── troubleshooting/
│       └── ...
└── (after build)
    └── build/
        ├── .well-known/act.json
        ├── act/
        │   ├── index.json
        │   ├── n/{id}.json (× ~250)
        │   └── sub/{category-id}.json (× ~9 categories)
        └── .act-build-report.json
```

### `package.json` minimum

```json
{
  "name": "act-example-701-tinybox-docs",
  "private": true,
  "scripts": {
    "build": "docusaurus build",
    "validate": "act-validate --file build/.well-known/act.json --conformance --sample all"
  },
  "dependencies": {
    "@docusaurus/core": "^3.0.0",
    "@docusaurus/preset-classic": "^3.0.0",
    "@act/docusaurus-plugin": "^0.1.0"
  },
  "devDependencies": {
    "@act/validator": "^0.1.0"
  }
}
```

### CI gate (snippet)

```yaml
# .github/workflows/ci.yml (excerpt)
- run: npm ci
- run: npm run build
- run: npm run validate
```

The `validate` script's exit code is the CI signal. Per PRD-600-R27, any `gaps` entry produces a non-zero exit. The `--sample all` flag on a 200–500-node corpus completes within PRD-600-R20's request budget when run against `--file` (no network); against `--url`, the deployed-URL gate uses `--sample 32` per PRD-701-R14.

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-02 | Jeremy Forsythe | Initial draft. Pins the large Docusaurus + markdown documentation site reference example to a Standard conformance target with a 200–500 node corpus, exercises PRD-404 / PRD-201 / PRD-600 / PRD-100–105 / PRD-107, mandates `--sample all` as the CI gate, and explicitly carves out versioned-docs, i18n, MDX, and search as out-of-scope for v0.1. Status: Draft → In review. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). PRD-201/PRD-404 fine-grained-mode wiring ambiguity (Open Q4) filed as docs/amendments-queue.md A2; queued for Phase 6 forge:reviewer triage. |
