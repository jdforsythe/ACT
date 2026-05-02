# PRD-700 — Minimal documentation site (Astro + markdown)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Site description

A minimal API-documentation site built on Astro 4.x with a single English locale and a small markdown corpus. The reference example mirrors the v0.1 draft §8.1 walkthrough — a Tinybox-style API docs site with four top-level pages (`root` index, `quickstart`, `auth`, `endpoints`) and two endpoint detail pages (`endpoints/objects`, `endpoints/buckets`) — totalling roughly 12 nodes after the markdown adapter expands the corpus and synthesises one parent index node per directory. Scale envelope: between 10 and 25 ACT nodes; 1 locale (`en-US`); static delivery only; no runtime endpoints; no i18n; no marketing-namespace blocks; no React islands beyond the optional `<ActSection>` decoration that PRD-301 documents but PRD-700 does not require.

The example exists to (a) prove that the smallest defensible Astro + markdown stack produces a clean ACT artifact set under PRD-401 + PRD-201 + PRD-105 with zero hand-tuning, (b) supply the canonical "minimum credible Standard producer" against which downstream adopters can diff their own builds, and (c) give PRD-600's hosted SPA a reachable public deployment to point at in the README.

### Problem

The v0.1 draft introduces ACT through a worked Tinybox example in §8.1 but does not pin which build stack produces it, what the file-by-file emission target looks like, which PRD-401 / PRD-201 / PRD-600 requirements the example exercises, or what "validates clean" means in operational terms. Phase 4's reference-example brief observes that without a smallest-defensible end-to-end build, every Astro adopter has to relitigate the wiring from scratch — and PRD-401 / PRD-201 lack a downstream consumer that proves their composition is implementable. PRD-700 is that consumer.

### Goals

1. Pin the **stack**: Astro 4.x + `@act/astro` (PRD-401) + `@act/markdown` (PRD-201) + `@act/validator` (PRD-600), with Astro Content Collections as the source surface.
2. Pin the **content shape**: a single `docs` Content Collection under `src/content/docs/` with frontmatter (`title`, `summary`, optional `type`, `parent`, `related`) sufficient for PRD-201's recognized-key set.
3. Pin the **declared conformance level** at **Standard**, with the rationale that subtree emission flows naturally from a docs hierarchy and adds material agent-utility, while NDJSON / search / i18n / marketing blocks would be additive complexity for a 12-node site.
4. Pin the **file-by-file emission target** so the Phase 6 implementer can write a passing build by checking files, not by inspecting code.
5. Pin **acceptance criteria** that bind the example to PRD-600's verdict (zero errors, achieved level matches declared, every cited P2 PRD requirement at least one R-ID exercised).
6. Define the **frontmatter and `act.config.js` shape** the example pins (short snippets, not a full implementation).

### Non-goals

1. **Authoring the implementation.** The implementation lands in Phase 6 against this PRD as the brief.
2. **Defining the wire format.** PRD-100 / PRD-105 own that.
3. **Defining Astro's integration API or the markdown adapter contract.** PRD-401 / PRD-201 own those.
4. **i18n.** Single locale only; the i18n example is PRD-702. Multi-locale Astro is not exercised here.
5. **Marketing-namespace blocks.** Out of scope for a docs site; PRD-702 covers the `marketing:*` surface.
6. **NDJSON index, search endpoint.** Plus-tier capabilities; PRD-700 declares Standard.
7. **Runtime delivery.** PRD-700 is static-only; runtime examples are PRD-705 / PRD-706.
8. **Versioned docs.** PRD-401 (Astro) does not ship versioned-docs mounting in v0.1 (versioning lands via PRD-404 Docusaurus + PRD-701); a versioned Astro docs site is a v0.2 candidate.
9. **Component instrumentation.** PRD-700 does not exercise PRD-301; the optional `<ActSection>` integration is documented as a follow-on but not a Phase 6 requirement.

### Stakeholders / audience

- **Authors of:** Phase 6 implementation team (PRD-700 is the brief).
- **Reviewers required:** BDFL Jeremy Forsythe.
- **Downstream consumers:** PRD-600 hosted SPA (links to PRD-700's deployed manifest); PRD-801 migration playbook (cites PRD-700 as the "smallest target stack").

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The example over-claims Standard while emitting only flat content (no subtree-eligible hierarchy) and PRD-600 downgrades the achieved level. | Medium | Medium | PRD-700-R6 pins a 3-level hierarchy (`root` → section → endpoint) so PRD-201's parent/children derivation produces real subtree-eligible nodes. PRD-700-R12 makes "achieved == declared == Standard" an acceptance criterion. |
| Content corpus drifts above the 25-node envelope as future authors add pages. | Low | Low | PRD-700-R3 caps the canonical fixture corpus at 25 nodes; PRD-700-R13 makes corpus growth a forced revisit of the conformance-level claim. |
| Astro Content Collections schema rejects PRD-201's expected frontmatter (e.g., `summary` not declared in the collection schema). | Medium | Low | PRD-700-R5 specifies the exact collection schema; PRD-401-R7 already mandates a build warning rather than a hard fail when frontmatter mismatches the collection schema. |
| The example pollutes `dist/` paths Astro itself owns (`index.html`, `assets/**`). | Low | Medium | PRD-401-R13 already constrains the integration to ACT-owned paths inside `dist/`; PRD-700-R10 reasserts the contract as an acceptance criterion. |
| Implementer ships an `act.config.js` shape divergent from PRD-401-R19 / PRD-400-R31. | Medium | Medium | PRD-700-R8 reproduces the canonical config shape inline; the implementation is rejected in review if the shape diverges. |

### Open questions

1. Should the example expose the optional `<ActSection>` decoration (PRD-301) on a single page so the example carries a working PRD-301 reference, even though PRD-700 itself doesn't require Standard via component extraction? Tentatively: no. Keeps PRD-700 a pure markdown-driven example; PRD-702 / PRD-705 exercise PRD-301.
2. Should the canonical deployment URL (e.g., `https://act-spec.org/examples/700-tinybox/`) be pinned in this PRD, or left to the deployment configuration? Tentatively: leave to deployment. PRD-700 specifies the relative file layout; absolute URLs are a deployment concern.
3. Should the example carry a CI gate that runs `act-validate --url <deployed-url>` after deployment, or only the local `act-validate --file dist/.well-known/act.json` check? Tentatively: both, with the deployed-URL gate guarded behind a `CI=production` env var so PR CI doesn't block on the deployment. Encoded as PRD-700-R14.

### Acceptance criteria

- [ ] Every normative requirement has an ID `PRD-700-R{n}` and a declared conformance level per PRD-107.
- [ ] The Specification section opens with a table mapping every requirement to PRD-401 / PRD-201 / PRD-600 / 100-series requirements exercised.
- [ ] A canonical content corpus is enumerated by id (10–25 nodes) so the implementation team has a closed test surface.
- [ ] The file-by-file emission target under `dist/` is enumerated.
- [ ] The conformance target is declared as **Standard** with rationale.
- [ ] Acceptance criteria bind the example to PRD-600's verdict (zero errors, achieved == declared, P2-coverage check).
- [ ] An inline `act.config.js` snippet matches PRD-401-R19 / PRD-400-R31 shape.
- [ ] Frontmatter snippets cover one node per recognized PRD-201 key.
- [ ] No new JSON Schemas or fixture files are created.
- [ ] Versioning & compatibility section classifies changes per PRD-108.
- [ ] Security section cites PRD-109 + PRD-401 § Security.
- [ ] Changelog entry dated 2026-05-02 by Jeremy Forsythe is present.

---

## Context & dependencies

### Depends on

- **PRD-401** (Accepted) — Astro plugin; the example's build entry point.
- **PRD-201** (Accepted) — Markdown adapter; the example's source surface.
- **PRD-600** (Accepted) — Validator; the example's gate.
- **PRD-100** (Accepted) — Wire format envelopes the build emits.
- **PRD-102** (Accepted) — Content blocks; the example exercises `markdown`, `prose`, `code`, `callout`.
- **PRD-103** (Accepted) — ETag derivation; PRD-401's pipeline derives ETags per PRD-103.
- **PRD-105** (Accepted) — Static delivery profile; the emission layout.
- **PRD-107** (Accepted) — Conformance levels; PRD-700 declares Standard.
- **PRD-108** (Accepted) — Versioning policy.
- **PRD-109** (Accepted) — Security posture.
- External: [Astro 4.x](https://docs.astro.build/), [Astro Content Collections](https://docs.astro.build/en/guides/content-collections/).

### Blocks

_Not applicable — PRD-700 is a leaf reference example; it blocks no other PRD's authoring._

### References

- v0.1 draft: §8.1 (Tinybox API docs walkthrough — the source for the canonical content shape).
- `prd/000-INDEX.md` 700-series row (PRD-700 entry).
- `docs/workflow.md` Phase 4 (reference-example authoring rules).
- Prior art: [`@astrojs/sitemap`](https://docs.astro.build/en/guides/integrations-guide/sitemap/) (canonical reference for an Astro integration that emits supplementary build-time artefacts; closest precedent to PRD-401).

---

## Specification

This is the normative section. RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) apply as clarified by RFC 8174.

### P2 PRDs the example composes

The table below lists every P2 PRD the example cites and the requirement IDs it exercises. The Phase 6 implementer MUST verify, via PRD-600's reporter, that every cited requirement has at least one corresponding `gaps`-clear or capability-confirmed observation in the run.

| Cited PRD | Requirement IDs exercised | What the example proves |
|---|---|---|
| PRD-401 | R1, R3, R4, R5, R6, R7, R11, R13, R14, R15, R16, R18, R19, R20 | The Astro integration entry point, output-mode restriction, lifecycle hook placement, Content Collections wiring, output emission layout, atomic writes, conformance band auto-detection, build-report writing, adapter pinning, logger plumbing, configuration shape, dev-mode in-memory serving. |
| PRD-201 | R1, R2, R3, R4, R5, R7, R8, R9, R11, R12, R13, R14, R16, R17, R18, R19, R20, R22, R23 | The markdown adapter contract, config schema, YAML frontmatter parser, recognized-key set, path-derived ID strategy, file walk, default coarse `markdown` block emission, `code` and `callout` block recognition, summary derivation (frontmatter wins), `summary_source` stamping, capability declaration, level-aware emission. |
| PRD-600 | R1, R2, R3, R4, R5, R6, R7, R11, R16, R17, R18, R19, R20, R21, R23, R26, R27, R30 | Envelope schema validation, cross-cutting rule checks, ETag value-shape and re-derivation, discovery walk, the reporter output assembly, the `--file` and `--url` CLI modes, default sample, fixture-corpus consumption. |
| PRD-100 | R1, R2, R3, R4, R5, R10, R11, R16, R17, R18, R21, R22, R23, R24, R28, R32, R33, R34 | Manifest required-field set, ID grammar, index envelope, node envelope, content-block discriminator, subtree envelope and depth bounds. |
| PRD-102 | R1, R3, R5, R12, R13, R15, R16, R17, R24, R26 | `markdown` block, `code` block, `callout` block, `summary_source` enum, `summary` required and non-empty, `content` required at Core, block-order preservation, summary-length warning threshold. |
| PRD-103 | R1, R2, R3, R4 | `etag` field present on every envelope, `s256:` admit-list, static derivation re-derivable from canonical bytes. |
| PRD-105 | R1, R2, R4, R6, R8, R10 | Static manifest at `/.well-known/act.json`, index URL reachable, node files reachable, subtree files for advertised IDs, MIME types, no body mutation on rebuild. |
| PRD-107 | R1, R3, R4, R6, R8, R11 | `conformance.level` declaration, `delivery: "static"`, additivity, Core inclusion list, Standard inclusion list. |

### Conformance level

PRD-700 declares the example **Standard**. Rationale: the docs corpus has a natural 3-level hierarchy (`root` → section → endpoint detail) so PRD-201's parent/children derivation produces subtree-eligible nodes that materially help an agent navigate the docs without re-walking the index. The Plus capabilities (NDJSON index, search endpoint, marketing namespace, multi-locale) deliver no proportionate utility on a 12-node single-locale docs site and would inflate the example past "minimal."

Per requirement breakdown (level applies to the requirement itself, not to the producer the example specifies; the producer's effective level is the maximum across requirements):

- **Core:** PRD-700-R1, R2, R3, R4, R5, R7, R8, R9, R10, R11, R12, R13, R14.
- **Standard:** PRD-700-R6 (subtree-eligible hierarchy), PRD-700-R15 (achieved level == Standard).
- **Plus:** _Not applicable — PRD-700 declares Standard._

A producer satisfying PRD-700 satisfies PRD-107-R6 (Core) and PRD-107-R8 (Standard) by additivity.

### Normative requirements

#### Stack

**PRD-700-R1.** The example MUST build with Astro 4.x as the host framework and MUST consume `@act/astro` (PRD-401) as the only ACT integration in `astro.config.mjs` `integrations: [...]`. The example MUST NOT depend on `@act/docusaurus-plugin`, `@act/eleventy`, `@act/next` or any other generator. Conformance: **Core**.

**PRD-700-R2.** The example MUST consume `@act/markdown` (PRD-201) as the source adapter for its docs corpus, wired automatically by `@act/astro` per PRD-401-R6 (Astro Content Collections auto-detection). The example MUST NOT supply a custom `adapters` array; auto-wiring is exercised. Conformance: **Core**.

#### Content corpus

**PRD-700-R3.** The example's canonical content corpus MUST consist of between 10 and 25 ACT nodes after PRD-201 / PRD-401 emission. The corpus MUST include at least:

| Node id | Type | Source path | Children |
|---|---|---|---|
| `root` | `index` | `src/content/docs/index.md` | `quickstart`, `auth`, `endpoints` |
| `quickstart` | `tutorial` | `src/content/docs/quickstart.md` | _(none)_ |
| `auth` | `concept` | `src/content/docs/auth.md` | _(none)_ |
| `endpoints` | `reference` | `src/content/docs/endpoints/index.md` | `endpoints/objects`, `endpoints/buckets` |
| `endpoints/objects` | `reference` | `src/content/docs/endpoints/objects.md` | _(none)_ |
| `endpoints/buckets` | `reference` | `src/content/docs/endpoints/buckets.md` | _(none)_ |

Additional nodes within the 25-node envelope MAY be added (e.g., `errors`, `webhooks`, `rate-limits`) provided each carries the same frontmatter discipline as PRD-700-R5. The corpus MUST be a single locale (`en-US`); multi-locale corpora MUST NOT be used in this example. Conformance: **Core**.

**PRD-700-R4.** Every node in the corpus MUST be authored as a `.md` file under `src/content/docs/` (no `.mdx`; the optional MDX seam is exercised by PRD-702). Markdown-body block emission runs in PRD-201's fine-grained mode (`mode: "fine"` per PRD-201-R12) so that the markdown adapter declares level Standard per PRD-201-R23 and PRD-400-R32's `enforceTargetLevel` admits the Standard target declared in §Conformance level. Coarse mode is the adapter default but declares level Core per PRD-201-R23, which would conflict with the Standard target in §Conformance level — the example MUST therefore set `mode: "fine"`. Note: this is a configuration choice on the example, not a normative wire-format requirement; the example's emitted blocks are still predominantly `markdown` and `prose` blocks since the corpus contains no fenced code, callouts, or `.mdx`. Conformance: **Core**.

#### Frontmatter discipline

**PRD-700-R5.** Every `.md` source file MUST declare YAML frontmatter conforming to the following Astro Content Collection schema:

```ts
// src/content/config.ts
import { defineCollection, z } from "astro:content";

const docs = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string().min(1),
    summary: z.string().min(1).max(280),
    type: z.enum(["index", "tutorial", "concept", "reference"]).optional(),
    parent: z.string().optional(),
    related: z.array(z.string()).optional(),
  }),
});

export const collections = { docs };
```

The PRD-201 adapter MUST consume `title`, `summary`, `type`, `parent`, `related` from this frontmatter per PRD-201-R4. `summary_source` MUST be stamped `"author"` per PRD-201-R20 because the frontmatter `summary` is always present. Conformance: **Core**.

#### Hierarchy and subtree eligibility (Standard)

**PRD-700-R6.** The corpus MUST produce at least one subtree-eligible parent node — that is, a node with two or more `children` whose subtree depth is ≥ 1. The `endpoints` node satisfies this requirement by virtue of its two children (`endpoints/objects`, `endpoints/buckets`). The `root` node MAY also satisfy it. PRD-401's auto-derived subtree emission (per PRD-401-R14 / PRD-400-R17) MUST emit a subtree file for every such parent under `dist/act/sub/{id}.json`. Conformance: **Standard**.

#### Configuration shape

**PRD-700-R7.** The example's `astro.config.mjs` MUST register `@act/astro` with the following minimum options shape (additional fields permitted only insofar as PRD-401-R19 admits them):

```js
// astro.config.mjs
import { defineConfig } from "astro";
import act from "@act/astro";

export default defineConfig({
  site: "https://example.com",
  integrations: [
    act({
      conformanceTarget: "standard",
      manifest: { site: { name: "Tinybox API" } },
      urlTemplates: {
        index_url: "/act/index.json",
        node_url_template: "/act/n/{id}.json",
        subtree_url_template: "/act/sub/{id}.json",
      },
    }),
  ],
});
```

The `conformanceTarget` MUST be `"standard"`. The `urlTemplates` MUST include `subtree_url_template` (Standard-tier required field per PRD-107-R8). The example MUST NOT set `i18n: true`, MUST NOT supply a custom `adapters` array, and MUST NOT enable any Plus-tier configuration (NDJSON, search). Conformance: **Core**.

**PRD-700-R8.** Astro's `output` setting MUST be `"static"` (the Astro default). PRD-401-R3 already rejects `output: "server"`; the example MUST NOT exercise the rejection path. Conformance: **Core**.

#### File-by-file emission target

**PRD-700-R9.** After `astro build`, the resolved `dist/` directory MUST contain at minimum the following ACT-owned paths:

- `dist/.well-known/act.json` — the manifest, declaring `conformance: { level: "standard" }`, `delivery: "static"`, `index_url: "/act/index.json"`, `node_url_template: "/act/n/{id}.json"`, `subtree_url_template: "/act/sub/{id}.json"`, `capabilities: { etag: true, subtree: true }`. Required by PRD-105-R1 / PRD-107-R8.
- `dist/act/index.json` — the index, with one entry per emitted node (10–25 entries). Each entry carries `id`, `type`, `title`, `summary`, `tokens.summary`, `etag`. Required by PRD-100-R16 / PRD-105-R2.
- `dist/act/n/{id}.json` — one node file per index entry. Each node carries `act_version`, `id`, `type`, `title`, `etag`, `summary`, `summary_source: "author"`, `content` (one `markdown` block by default), `tokens`. Required by PRD-100-R21 / PRD-105-R4.
- `dist/act/sub/{id}.json` — at least one subtree file (e.g., `dist/act/sub/endpoints.json`) per PRD-700-R6. Subtree depth MUST default to 3 per PRD-100-R33; the example's hierarchy is shallow enough that no `truncated` flag fires. Required by PRD-100-R32 / PRD-105-R6.
- `dist/.act-build-report.json` — the build report sidecar per PRD-401-R15 / PRD-400-R27. The report MUST NOT be uploaded to a CDN.

The example MUST NOT emit `dist/act/index.ndjson` (Plus-tier; out of scope per PRD-700-R7). The example MUST NOT modify Astro-owned paths under `dist/` (`index.html`, `assets/**`, etc.). Conformance: **Core**.

**PRD-700-R10.** ACT-owned writes MUST be atomic per PRD-401-R13 / PRD-400-R23. The example MUST NOT touch any path outside `dist/.well-known/`, `dist/act/`, and `dist/.act-build-report.json`. Conformance: **Core**.

#### ETag and content stability

**PRD-700-R11.** Every emitted envelope MUST carry an `etag` field whose value matches the regex `^s256:[A-Za-z0-9_-]{22}$` per PRD-103-R3. Re-running `astro build` against an unchanged source corpus MUST produce byte-identical envelopes per PRD-105-R10. The example MUST NOT introduce build-time non-determinism (timestamps, random IDs, locale-default formatting that varies by host). Conformance: **Core**.

#### Validator gate

**PRD-700-R12.** The example MUST validate clean against PRD-600 in CLI mode `--file`. Specifically, running `act-validate --file dist/.well-known/act.json --conformance` MUST produce a reporter object whose `gaps` array is empty and whose `achieved.level` is `"standard"` and whose `achieved.delivery` is `"static"`. Per PRD-600-R26, the default sample of 16 nodes is sufficient; the corpus is below the sample cap. Conformance: **Core**.

**PRD-700-R13.** The example's `declared.level` (in the manifest) MUST equal the reporter's `achieved.level` ("standard"). A discrepancy is an example-level failure even though, per PRD-107-R22, the wire format itself remains well-formed. Conformance: **Core**.

**PRD-700-R14.** The example's CI MUST run `act-validate --file dist/.well-known/act.json --conformance` as a build-gating step. When the example is deployed to a public origin, the CI SHOULD additionally run `act-validate --url <deployed-url> --conformance` as a post-deployment check; the post-deployment check MAY be guarded behind a `CI=production` env var so pull-request CI does not block on the deployed origin. Conformance: **Core**.

**PRD-700-R15.** Every cited P2 PRD requirement listed in the §"P2 PRDs the example composes" table MUST be exercised in at least one observation by PRD-600's reporter — either as a passing schema check, a passing capability probe, or a passing cross-cutting rule check. The Phase 6 implementer MUST cross-reference the reporter output against the table before marking the example complete. Conformance: **Standard**.

### Wire format / interface definition

PRD-700 introduces no new wire format. The example emits per PRD-100 envelopes through PRD-401's pipeline. The interface contract is the source-side surface (Content Collection schema + `astro.config.mjs`) reproduced in PRD-700-R5 and PRD-700-R7 above.

### Errors

| Condition | Behavior | Notes |
|---|---|---|
| Source markdown missing required frontmatter (`title`, `summary`) | Astro Content Collections schema rejects at `astro build`; build fails | PRD-401-R7 surfaces a build warning when adapter input doesn't satisfy PRD-201; the collection schema in PRD-700-R5 is stricter and produces a hard build error before the warning path runs. |
| Adapter emits a duplicate ID (e.g., two files normalize to the same path-derived id) | Hard build error | Per PRD-201-R7. |
| `astro.config.mjs` sets `output: "server"` | Build error | Per PRD-401-R3. |
| `act-validate` reports a non-empty `gaps` array | CI failure | Per PRD-700-R12. |
| Reporter's `achieved.level` is `"core"` (declared `"standard"`) | CI failure | Per PRD-700-R13; root cause is typically a missing subtree file, traceable via the reporter's `gaps` entry citing PRD-107-R8. |

---

## Examples

### Example 1 — Frontmatter on a typical node (`quickstart.md`)

```md
---
title: Quickstart
summary: Send your first request in under a minute.
type: tutorial
parent: root
related:
  - auth
---

## Get a token

Visit your dashboard to mint a workspace token...

```bash
curl -H 'Authorization: Bearer $TOKEN' https://api.tinybox.dev/v1/objects
```

> [!TIP]
> Tokens are scoped to a single workspace.
```

PRD-201 emits a single `markdown` block per the default coarse mode. The GFM-alert (`> [!TIP]`) is preserved inside the markdown block; PRD-201's fine-grained mode (which would split it into a `callout` block) is not enabled. `summary_source` is stamped `"author"` because frontmatter supplies `summary`.

### Example 2 — Expected `dist/.well-known/act.json` (manifest)

```json
{
  "act_version": "0.1",
  "site": { "name": "Tinybox API" },
  "index_url": "/act/index.json",
  "node_url_template": "/act/n/{id}.json",
  "subtree_url_template": "/act/sub/{id}.json",
  "conformance": { "level": "standard" },
  "delivery": "static",
  "capabilities": { "etag": true, "subtree": true }
}
```

### Example 3 — Expected `dist/act/index.json` (excerpt)

```json
{
  "act_version": "0.1",
  "etag": "s256:f7HxQ2pT9jLm0bN1aV8rZc",
  "nodes": [
    {
      "id": "root",
      "type": "index",
      "title": "Tinybox API Documentation",
      "summary": "REST API for the Tinybox storage service.",
      "tokens": { "summary": 9 },
      "etag": "s256:11Aa22Bb33Cc44Dd55Ee66"
    },
    {
      "id": "endpoints",
      "type": "reference",
      "title": "Endpoints",
      "summary": "Full reference for all 18 endpoints.",
      "tokens": { "summary": 8 },
      "etag": "s256:44Aa55Bb66Cc77Dd88Ee99"
    }
  ]
}
```

ETag values are illustrative (the regex shape is normative; the digests come from JCS canonicalization at build time per PRD-103).

### Example 4 — Expected reporter output

```json
{
  "act_version": "0.1",
  "url": "file://dist/.well-known/act.json",
  "declared": { "level": "standard", "delivery": "static" },
  "achieved": { "level": "standard", "delivery": "static" },
  "gaps": [],
  "warnings": [],
  "passed_at": "2026-05-02T15:00:00Z"
}
```

This is the gate PRD-700-R12 requires.

---

## Test fixtures

PRD-700 is a reference example PRD; fixture files land in Phase 6, not in this PRD. The Phase 6 implementer creates the fixtures listed below; the paths are pinned here so PRD-600's fixture-runner can find them.

### Positive

- `fixtures/700/positive/source-corpus/` → the canonical 10–25 node markdown source tree (one `.md` per node) plus `src/content/config.ts`, `astro.config.mjs`, and the minimum `package.json` to install `@act/astro` and `@act/markdown`. Satisfies PRD-700-R1 through R8.
- `fixtures/700/positive/expected-dist/` → the byte-equal expected output of `astro build` against `source-corpus/`, including `.well-known/act.json`, `act/index.json`, every `act/n/{id}.json`, every `act/sub/{id}.json`, and `.act-build-report.json`. Satisfies PRD-700-R9, R10, R11.
- `fixtures/700/positive/expected-reporter.json` → the expected `act-validate --file --conformance` reporter output. Satisfies PRD-700-R12, R13.

### Negative

- `fixtures/700/negative/missing-summary.md` → a single source file lacking the `summary` frontmatter key. The Content Collection schema rejects the file before PRD-201 sees it; expected outcome: non-zero exit from `astro build` with a Zod validation error citing the path. Satisfies the failure mode in §Errors.
- `fixtures/700/negative/duplicate-id.md` → two source files whose path-derived IDs collide (e.g., `endpoints/objects.md` and `endpoints/objects/index.md`). Expected outcome: hard build error per PRD-201-R7.
- `fixtures/700/negative/declared-plus.json` → a manipulated copy of `expected-dist/.well-known/act.json` whose `conformance.level` is `"plus"` (without the corresponding `index_ndjson_url` or `search_url_template`). PRD-600's reporter MUST emit a `gaps` entry citing PRD-107-R10 and report `achieved.level` as `"standard"` (the actual probed level).

---

## Versioning & compatibility

Per PRD-108, classify each kind of change to PRD-700 as MAJOR or MINOR.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a node type to the content corpus while staying under the 25-node cap | MINOR | The example's surface grows but the conformance level and emission shape are unchanged. |
| Promote the example to Plus by adding NDJSON / search artifacts | MAJOR | Changes the example's contract for downstream adopters; declared level rises. |
| Change the canonical stack from Astro to a different framework | MAJOR | Replaces the example entirely; effectively a new PRD. |
| Bump the Astro peer-dependency floor (e.g., 4.x → 5.x) | MAJOR | Tracks PRD-401's own MAJOR bump. |
| Change the frontmatter schema in a backward-incompatible way (e.g., rename `summary` to `excerpt`) | MAJOR | Breaks PRD-201's recognized-key alignment for this example. |
| Add an optional frontmatter key (e.g., `tags`) | MINOR | Per PRD-201's open-key discipline; PRD-700-R5's schema gains an optional field. |
| Tighten the corpus envelope from 25 nodes to 15 nodes | MAJOR | Shrinks the testable surface; downstream test consumers may break. |
| Loosen the corpus envelope above 25 nodes | MAJOR | Forces a re-evaluation of "minimal" and may push the example past Standard. |

### Forward compatibility

Per PRD-108, consumers of PRD-700's emitted artefacts MUST tolerate unknown optional fields. PRD-700 does not introduce its own envelopes; it inherits PRD-100's forward-compatibility rules unchanged.

### Backward compatibility

The example is canonical for v0.1 only. A v0.2 revision of PRD-700 MUST keep the source corpus and `astro.config.mjs` shape stable across the v0.1 → v0.2 boundary unless the corresponding PRD-401 / PRD-201 / PRD-107 PRDs make a MAJOR bump that forces a corpus or config change.

---

## Security considerations

PRD-700 inherits the security posture of PRD-109, PRD-401 § Security, and PRD-201 § Security. The example introduces no new threat surface beyond those:

- **No PII in the source corpus.** The Tinybox example uses fictional API surfaces only. The Phase 6 implementer MUST NOT introduce real customer data, real auth tokens (the `quickstart.md` `curl` snippet uses a `$TOKEN` placeholder, not a literal token), or real proprietary URLs.
- **No HTML injection surface.** PRD-201's markdown adapter operates on source markdown; the rendered HTML is Astro's responsibility. The ACT artefacts are JSON only and carry markdown bodies as text — no script execution surface.
- **`dist/.act-build-report.json` is not deployed.** PRD-401-R15 already mandates the build report stay out of the deployed bundle; PRD-700-R10 reasserts the contract. The build report MAY include local-build paths that are not appropriate to expose.
- **Origin trust on cross-origin discovery is not exercised.** The example is single-origin; cross-origin mounts are a PRD-706 concern.

---

## Implementation notes

The Phase 6 implementer wires the example with the following touchpoints. These are reference snippets for orientation, not full implementations.

### `package.json` minimum

```json
{
  "name": "act-example-700-tinybox",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "astro build",
    "validate": "act-validate --file dist/.well-known/act.json --conformance"
  },
  "dependencies": {
    "astro": "^4.0.0",
    "@act/astro": "^0.1.0",
    "@act/markdown": "^0.1.0"
  },
  "devDependencies": {
    "@act/validator": "^0.1.0"
  }
}
```

### `astro.config.mjs`

See PRD-700-R7 above. The configuration is the entirety of the build-side wiring; the rest of the example is content authoring.

### `src/content/config.ts`

See PRD-700-R5 above. Astro Content Collections enforce the schema; the markdown adapter consumes the same fields without re-validating.

### Repository layout

```
.
├── astro.config.mjs
├── package.json
├── src/
│   ├── content/
│   │   ├── config.ts
│   │   └── docs/
│   │       ├── index.md
│   │       ├── quickstart.md
│   │       ├── auth.md
│   │       └── endpoints/
│   │           ├── index.md
│   │           ├── objects.md
│   │           └── buckets.md
│   └── pages/
│       └── ... (Astro routes; not normative for ACT)
└── (after build)
    └── dist/
        ├── .well-known/act.json
        ├── act/
        │   ├── index.json
        │   ├── n/
        │   │   ├── root.json
        │   │   ├── quickstart.json
        │   │   ├── auth.json
        │   │   ├── endpoints.json
        │   │   ├── endpoints/
        │   │   │   ├── objects.json
        │   │   │   └── buckets.json
        │   └── sub/
        │       └── endpoints.json
        └── .act-build-report.json
```

The implementer MAY introduce additional Astro pages (`src/pages/**.astro`) to render the docs as HTML. Those pages are entirely non-normative for ACT — the ACT artefact set is derived from `src/content/docs/` regardless of whether the human-facing routing exists.

### CI gate (snippet)

```yaml
# .github/workflows/ci.yml (excerpt)
- run: npm ci
- run: npm run build
- run: npm run validate
```

The `validate` script exits non-zero on any `gaps` entry per PRD-600-R27.

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-02 | Jeremy Forsythe | Initial draft. Pins the minimal Astro + markdown documentation site reference example to a Standard conformance target with a 10–25 node corpus, exercises PRD-401 / PRD-201 / PRD-600 / PRD-100–105 / PRD-107, and binds the example to PRD-600's reporter as the gate. Status: Draft → In review. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
| 2026-05-01 | Spec Steward | Inline clarification per amendment A8: PRD-700-R4 now requires `mode: "fine"` on the markdown adapter so the adapter's PRD-201-R23 declared level (Standard) matches the example's declared conformance target (Standard) and PRD-400-R32's `enforceTargetLevel` admits the build. Non-normative: the wire format the example emits is unchanged; only the configuration knob the example pins is restated. PRD-201 and PRD-400 are not touched. |
