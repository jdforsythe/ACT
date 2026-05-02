# PRD-402 — Hugo module (spec only)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

**Spec only — no v0.1 reference implementation per decision Q3.** Hugo (Go) is one of the four ecosystems explicitly downgraded to spec-only in v0.1 per `prd/000-decisions-needed.md` Q3 (TS-only first-party reference impls). PRD-400 (generator architecture, In review) locks the canonical pipeline, the `GeneratorPlugin` interface, the multi-source merge composition, the conformance-level computation rule, the capability-flag emission rule, the atomic-write contract, the build-hook surface, the build-report sidecar, and the staged adapter-pinning enforcement — all expressed as TypeScript signatures. PRD-400-R33 explicitly carves out spec-only treatment for Hugo and MkDocs: "TS interfaces normative *for TS implementations*; for non-TS, the prose form of each requirement is normative." This PRD is the Hugo-side application of that carve-out.

Hugo is the second-most-deployed static site generator (after Eleventy in the JS ecosystem and broadly comparable to Jekyll in the Ruby ecosystem) and the canonical choice for blogs, marketing sites, and docs that don't want a JavaScript runtime. The 700-series ships PRD-703 (Hugo blog example, also spec-only per Q3) gated by this PRD. Without an authoritative spec for what a Hugo module satisfying PRD-400 must do, three failure modes appear: (1) community implementers reinvent the contract — file-walk rules, frontmatter-key recognition, ID derivation, atomic-write semantics, build-report shape — diverging from the TS reference and producing incompatible output; (2) PRD-703 (Hugo blog example) cannot be specified except hypothetically; (3) PRD-600 (validator) probes byte-level output but can't tell a community Hugo port from a hostile fork without a normative reference for what conformant Hugo output looks like. This PRD pins the contract in framework-agnostic prose backed by idiomatic Go snippets so a community port has an unambiguous target.

PRD-100 (Accepted) defines the wire-format envelopes the Hugo module must emit. PRD-103 (Accepted) defines the ETag derivation. PRD-104 (Accepted) defines the i18n locale layout. PRD-105 (Accepted) defines the static delivery profile (the only profile a Hugo build targets — Hugo is a pure static generator). PRD-107 (Accepted) defines the conformance levels. PRD-108 (Accepted) defines the version-pinning regime. PRD-109 (Accepted) defines the project-wide threat model. PRD-200 (In review) defines the adapter framework — Hugo's own content-walk plays the role of the markdown adapter (PRD-201) here, since Hugo's bundle resolver and front-matter parser already do what `act-markdown` does in the TS pipeline. PRD-400 (In review) is the parent contract this PRD inherits in full. **PRD-600 validates output bytes; the validator is implementation-language-agnostic. A conformant Hugo module passes the same `fixtures/400/` corpus a conformant Astro plugin passes.**

### Goals

1. State that PRD-402 is **spec only** for v0.1 per decision Q3 — no first-party Hugo module ships in v0.1; community ports are invited and the spec is the target.
2. Apply PRD-400's contract (canonical pipeline, capability-flag emission, atomic writes, build-report sidecar, conformance-level computation, adapter pinning) to Hugo's build model in framework-agnostic prose, with idiomatic Go snippets that **demonstrate equivalence**, not normativity-by-syntax.
3. Lock the **integration shape**: a Hugo module published under a stable Go module path (e.g., `github.com/{org}/act-hugo`), consumed via `hugo.toml`'s `[module]` block. The module ships configuration scaffolding under a `[params.act]` namespace.
4. Lock the **build-hook strategy**: Hugo does not expose a true post-build hook in the way Astro / Docusaurus do. The module documents a wrapper-script pattern (`hugo && act-hugo emit`) for v0.1 and notes that a real Hugo build hook is a v0.2 / community-upstream goal. The wrapper is normative for v0.1; it is the contract Hugo modules implementing PRD-402 satisfy.
5. Lock the **content-source mapping**: Hugo's content tree (`content/**/*.md` plus `_index.md` files) maps to ACT nodes per PRD-201's behavioral contract; Hugo's section hierarchy maps to ACT `parent` / `children` per PRD-100; Hugo permalinks map to ACT IDs per PRD-100-R10 (with the same path-derived strategy PRD-201-R8 specifies).
6. Lock the **frontmatter contract**: Hugo's TOML / YAML / JSON front matter is recognized; the same key set PRD-201-R4 recognizes (`id`, `title`, `summary`, `summary_source`, `type`, `tags`, `parent`, `related`, `metadata.*`) is normative here, plus interop with Hugo's existing keys (`slug`, `aliases`, `weight`, `draft`).
7. Lock the **i18n handling**: Hugo's multilingual mode (`languages` table in `hugo.toml`) maps to PRD-104 Pattern 1 or Pattern 2 per configuration; the module honors PRD-400-R14 / R15 / R16.
8. Lock the **conformance bands**: Core by default; Standard when subtree files are emitted; Plus when NDJSON index is emitted. Per PRD-400-R17, the achieved level is computed from observed emissions, not from configuration claims.
9. Specify the **failure surface** in framework-agnostic terms: build errors halt with non-zero exit; build warnings continue; all errors and warnings flow through the build report at `public/.act-build-report.json` (Hugo's default output directory is `public/`, not `dist/`).
10. Enumerate the **test-fixture matrix** Hugo modules MUST satisfy: every positive fixture under `fixtures/400/positive/` and `fixtures/402/positive/` MUST produce equivalent byte output (modulo `generated_at` timestamps); every negative fixture under the same paths MUST surface the documented error / warning.
11. Cite **PRD-400-R33** prominently: the framework-agnostic prose is normative; Go snippets are illustrative.

### Non-goals

1. **Shipping a first-party Hugo module in v0.1.** Decision Q3 downgrades PRD-402 to spec only. Community ports are invited.
2. **Defining a Hugo-specific extension to the wire format.** PRD-100 (Accepted) is the wire format; PRD-402 emits PRD-100 envelopes verbatim.
3. **Defining the markdown adapter contract.** Owned by PRD-201 (In review). PRD-402 inherits PRD-201's behavioral contract for markdown content; a Hugo module's content-walk plays the role of the adapter rather than invoking `act-markdown` (which is TS-only).
4. **Defining the static delivery profile.** Owned by PRD-105 (Accepted). The Hugo module's emission target is the file set PRD-105 specifies.
5. **Defining ETag derivation.** Owned by PRD-103 (Accepted). The module implements PRD-103-R4 (static recipe) in Go.
6. **Defining the i18n manifest layout.** Owned by PRD-104 (Accepted). The module picks Pattern 1 or Pattern 2 from configuration.
7. **Defining the component contract.** Owned by PRD-300 (In review). Hugo has no React-style component model; PRD-402 does not invoke component bindings. Hugo shortcodes are out of scope for v0.1 (a future PRD-402 amendment may add a shortcode-as-component-contract seam).
8. **Defining the validator.** Owned by PRD-600 (In review). PRD-402 is validated by PRD-600 the same way every other generator is.
9. **Authoring the threat model.** Owned by PRD-109 (Accepted). PRD-402's Security section cites PRD-109 and documents Hugo-specific deltas only.
10. **Defining new JSON Schemas.** PRD-402 emits per PRD-100's existing schemas.
11. **Specifying a runtime ACT server in Go.** Hugo is a build-time generator; PRD-503 (FastAPI) and PRD-504 (Rails) cover the spec-only runtime branches. A Go runtime SDK is not in v0.1 scope.

### Stakeholders / audience

- **Authors of:** PRD-703 (Hugo blog example, spec only). Community Hugo module implementers (Go developers who want to ship `act-hugo` against this spec).
- **Consumers of (upstream):** PRD-400 (parent framework), PRD-201 (markdown content-walk behavioral reference, even though PRD-201's TS code is not invoked), PRD-100 (wire format), PRD-103 (ETag derivation), PRD-104 (i18n layout), PRD-105 (static profile), PRD-107 (conformance levels), PRD-108 (versioning), PRD-109 (security).
- **Consumers of (downstream):** PRD-600 (validator) — runs against Hugo module output. PRD-703 (Hugo blog example).
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Community Hugo ports diverge from the TS reference because the spec is prose, not code. | High | Medium | PRD-600 validates byte-level output; any Hugo port that produces byte-equivalent output to the TS reference is conformant. The fixture corpus under `fixtures/400/` is the equivalence harness. PRD-402-R20 requires every Hugo port to publish a self-test against `fixtures/400/positive/spec-only-equivalence-hugo/`. |
| Wrapper-script integration (`hugo && act-hugo emit`) is fragile — operators forget to run `act-hugo` after `hugo`, so deployments ship stale ACT files. | High | Medium | PRD-402-R6 requires the module to detect stale state by comparing Hugo's `public/` mtimes against the build report's `completedAt`; a stale `act-hugo emit` invocation surfaces a build error. PRD-402-R21 documents the wrapper-script as the v0.1 integration; a future Hugo upstream `--post-build` hook would unblock a single-command path. |
| Hugo's content tree has its own `_index.md` semantics that don't map cleanly to ACT's `parent` / `children`. | Medium | Medium | PRD-402-R10 pins the mapping: a section's `_index.md` becomes the section node (carrying the section's children); leaf `*.md` files become child nodes. Worked example covers a three-level section hierarchy. |
| Hugo's permalinks (`permalink` config) and content-path identity diverge — two URLs may map to the same content file. | Medium | Medium | PRD-402-R8 specifies the ID derivation: ID is derived from the content file's path, not from the resolved permalink. Permalinks influence `metadata.canonical_url` only. |
| Hugo modules consume Go module ecosystem; a malicious upstream module could emit hostile build output. | Low | High | PRD-402's Security section cites PRD-109 for the build-process trust boundary (same as PRD-400's). Hugo's module integrity (`go.sum`) is the operator's responsibility; PRD-402 does not introduce a sandbox. |
| Hugo's i18n model (translations as parallel content trees) maps awkwardly to PRD-104 Pattern 1 (locale-prefixed IDs). | Medium | Medium | PRD-402-R13 maps Hugo's `defaultContentLanguage` + per-language content trees to Pattern 2 (per-locale manifests) by default; Pattern 1 is opt-in via `[params.act]` configuration. |
| The build report at `public/.act-build-report.json` gets uploaded to the CDN by accident (Hugo deploys `public/` wholesale). | High | Low | PRD-402-R23 requires the module to either (a) emit the build report outside `public/` (e.g., `./.act-build-report.json` at the project root, mirroring PRD-400-R27's local-only artifact intent), or (b) add `.act-build-report.json` to a documented deploy-ignore pattern. Default is (a). |
| Hugo doesn't natively atomic-write — the writer pattern in Go's `os.WriteFile` is non-atomic on some platforms. | Low | Medium | PRD-402-R16 requires `os.Rename` after write-to-tmp, mirroring PRD-400-R23's tmp-then-rename contract. Go's `os.Rename` is atomic on POSIX; on Windows, `os.Rename` calls `MoveFileEx` with `MOVEFILE_REPLACE_EXISTING` which is atomic per file. |

### Open questions

1. ~~Should the Hugo module support Hugo's `Output Formats` mechanism to emit ACT files alongside HTML in a single `hugo` invocation?~~ **Resolved (2026-05-01): No (v0.1).** `Output Formats` is powerful but complex; the wrapper-script path (`hugo && act-hugo emit`) is operationally simpler and matches the spec-only stance. Defer to v0.2 / community contribution. (Closes Open Question 1.)
2. ~~Should the module honor Hugo shortcodes as a component-contract seam (mapping to PRD-300's contract)?~~ **Resolved (2026-05-01): No (v0.1).** Shortcodes are a Hugo-specific abstraction without a clean cross-implementation analogue, and PRD-300's contract is keyed to React/Vue/Angular component semantics. A v0.2 amendment may add a shortcode-as-component-contract seam. (Closes Open Question 2.)
3. ~~Should the module emit ACT under Hugo's `static/` directory or under `public/act/`?~~ **Resolved (2026-05-01): `public/act/`.** That's the natural emit path; `static/` would require pre-generating ACT before `hugo` runs, breaking the wrapper-script ordering. Already encoded in PRD-402's emission paths. (Closes Open Question 3.)
4. ~~Should the module support Hugo's draft / future / expired content semantics?~~ **Resolved (2026-05-01): Yes.** Drafts excluded by default; `--buildDrafts` includes them; the module honors Hugo's existing flags rather than introducing its own. "Match prior PRD precedent" (heuristic 4) by deferring to host idiom. (Closes Open Question 4.)
5. ~~Should the module track Hugo's build cache (`resources/_gen/`) for incremental rebuilds?~~ **Resolved (2026-05-01): No (v0.1).** Incremental rebuild detection (PRD-400-R22) uses content hashing of source files, not Hugo's resource cache. A future amendment may layer Hugo's cache on top. (Closes Open Question 5.)

### Acceptance criteria

- [ ] Status `In review` is set; changelog entry dated 2026-05-01 by Jeremy Forsythe is present.
- [ ] Every normative requirement has an ID `PRD-402-R{n}` and a declared conformance level per PRD-107.
- [ ] The Specification section opens with a table mapping every requirement to PRD-400 + PRD-200 + 100-series requirements implemented (Phase 3 rule).
- [ ] PRD-400-R33 (spec-only treatment) is cited explicitly in both the Engineering preamble Problem section AND at the start of Implementation notes.
- [ ] The "spec only — no v0.1 reference implementation per decision Q3" note appears prominently in the preamble Problem section AND at the start of Implementation notes.
- [ ] Implementation notes ship 3–6 idiomatic Go snippets (NOT TypeScript) demonstrating equivalence to PRD-400's TS contract.
- [ ] The wrapper-script integration (`hugo && act-hugo emit`) is pinned as the v0.1 integration with a documented future-direction toward a real post-build hook.
- [ ] Content-source mapping (Hugo's content tree → ACT nodes; section hierarchy → `parent` / `children`; permalinks → IDs) is pinned with worked examples.
- [ ] Frontmatter handling (TOML / YAML / JSON) is pinned with the recognized-key set.
- [ ] i18n handling (Hugo's multilingual mode → PRD-104 Pattern 1 or Pattern 2) is pinned with a configuration example.
- [ ] Conformance bands (Core / Standard / Plus) described conceptually with the observed-emission rule.
- [ ] Test-fixture path layout under `fixtures/402/positive/` and `fixtures/402/negative/` is enumerated; equivalence with `fixtures/400/` corpus is asserted; no fixture files created in this PRD.
- [ ] Versioning & compatibility section classifies every kind of change to PRD-402 per PRD-108.
- [ ] Security section cites PRD-109 and documents Hugo-specific deltas (Go module supply chain, wrapper-script ordering, build-report leakage into `public/`).
- [ ] No new JSON Schemas are introduced.

---

## Context & dependencies

### Depends on

- **PRD-100** (Accepted) — wire-format envelopes. The Hugo module emits manifest, index, node, and (Standard / Plus) subtree / NDJSON envelopes that satisfy `schemas/100/*.schema.json`.
- **PRD-103** (Accepted) — ETag derivation. The module implements PRD-103-R4 (static recipe) in Go: JCS canonicalization, SHA-256, base64url no-padding, 22 chars, `s256:` prefix.
- **PRD-104** (Accepted) — i18n. The module emits per-locale layout per Pattern 1 or Pattern 2 based on Hugo's `languages` configuration.
- **PRD-105** (Accepted) — static delivery profile. The module's emission target is the file set PRD-105 enumerates; Hugo is a static-only generator.
- **PRD-107** (Accepted) — conformance levels. The module computes `conformance.level` from observed emissions per PRD-400-R17.
- **PRD-108** (Accepted) — versioning policy. The module honors Stage 1 adapter pinning per PRD-200-R25 (a v0.1 Hugo module emits `act_version: "0.1"` only).
- **PRD-109** (Accepted) — security posture. PRD-402's Security section cites PRD-109 for the project-wide threat model and documents Hugo-specific deltas.
- **PRD-200** (In review) — adapter framework. Hugo's own content-walk plays the role of the adapter; the behavioral contract for markdown processing is PRD-201's, even though `act-markdown` (TS code) is not invoked.
- **PRD-201** (In review) — markdown adapter (behavioral reference). Hugo's content-walk implements PRD-201's frontmatter recognition, ID derivation, body-to-block mapping, and summary derivation rules in Go.
- **PRD-400** (In review) — generator architecture (parent framework). PRD-402 inherits the canonical pipeline, capability-flag emission, atomic-write contract, build-hook surface, build-report sidecar, conformance-level computation, and adapter-pinning enforcement. **PRD-400-R33** carves out spec-only treatment for non-TS implementations: the prose form of every requirement is normative; Go snippets are illustrative.
- **000-governance** (Accepted) — lifecycle of this PRD itself.
- **000-decisions-needed Q3** — TS-only first-party reference impls for v0.1; PRD-402 is spec only.
- External: [Hugo modules](https://gohugo.io/hugo-modules/), [Hugo content organization](https://gohugo.io/content-management/organization/), [Hugo front matter](https://gohugo.io/content-management/front-matter/), [Hugo multilingual mode](https://gohugo.io/content-management/multilingual/), [Go modules](https://go.dev/ref/mod), [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174). [POSIX `rename(2)`](https://pubs.opengroup.org/onlinepubs/9699919799/functions/rename.html); [Go `os.Rename`](https://pkg.go.dev/os#Rename) atomic-rename semantics.

### Blocks

- **PRD-703** (Hugo blog example, spec only per Q3) — depends on PRD-402 for the integration contract its example will demonstrate (also as spec only).

### References

- v0.1 draft: §7 (build integration: pipeline, generator pseudocode, plugin targets — informational here, since PRD-400 supersedes), §6.1–§6.4 (markdown / frontmatter / ID strategies — superseded by PRD-201 for behavioral reference).
- `prd/000-decisions-needed.md` Q3 (TS-only reference impl; PRD-402 spec only).
- `prd/000-gaps-and-resolutions.md` — no PRD-402-specific gap; this PRD is purely a leaf application of PRD-400's contract.
- Prior art: [Hugo modules](https://gohugo.io/hugo-modules/) (the integration shape used here); the broader pattern of "generator hook into static site builder" exemplified by Astro Integrations API (PRD-401), Docusaurus plugin lifecycle (PRD-404), Eleventy plugin API (PRD-408). PRD-402's wrapper-script approach is the lowest-common-denominator pattern when no native post-build hook exists.

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords as clarified by RFC 8174.

### PRD-400 + PRD-200 + 100-series requirements implemented

The table below maps every PRD-402 requirement to the upstream requirement(s) it implements or relies on. This table satisfies the workflow.md Phase 3 rule that every P2 leaf PRD declare the parent + 100-series surface it implements. PRD-402 inherits PRD-400 in full per **PRD-400-R33** (spec-only treatment); the prose form of every PRD-400 requirement is normative for Hugo modules, and the Go snippets in Implementation notes are illustrative.

| PRD-402 requirement | Upstream requirement(s) implemented or consumed | Relationship |
|---|---|---|
| R1 (spec-only treatment, Q3) | PRD-400-R33, decision Q3 | Pins the spec-only stance for v0.1; community ports invited. |
| R2 (canonical pipeline mapping) | PRD-400-R1, R2 | Hugo module honors the pipeline order in Go. |
| R3 (Hugo module integration shape) | PRD-400-R3 (analog of `GeneratorPlugin`) | Module published as Go module; consumed via `hugo.toml`'s `[module]` block. |
| R4 (configuration surface) | PRD-400-R31 (`GeneratorConfig`) | Configuration in `[params.act]` namespace mirrors `GeneratorConfig` fields. |
| R5 (wrapper-script integration) | PRD-400-R24 (build hooks) | Hugo lacks a true post-build hook in v0.1; wrapper script `hugo && act-hugo emit` is the v0.1 integration. |
| R6 (stale-state detection) | PRD-400-R22 (incremental), PRD-400-R23 (atomic) | Module compares Hugo's `public/` mtimes against the build report's `completedAt` to detect stale runs. |
| R7 (content-walk behavioral contract) | PRD-201 (behavioral reference), PRD-200-R5 (transform contract) | Hugo's content tree walked per PRD-201's frontmatter / body-to-block / summary rules. |
| R8 (ID derivation from content path) | PRD-100-R10, PRD-100-R14, PRD-201-R8 | Path-derived ID with `_index.md` collapsing, extension stripping, lowercase normalization. |
| R9 (frontmatter recognition: TOML / YAML / JSON) | PRD-201-R3, R4 | Hugo's three frontmatter formats accepted; same recognized-key set. |
| R10 (Hugo section hierarchy → ACT parent/children) | PRD-100-R24, R25 | Section's `_index.md` is the section node; leaves are children. |
| R11 (permalink-to-canonical-url mapping) | PRD-100-R22 (`metadata` open) | Hugo permalinks emitted as `metadata.canonical_url`; not the ID. |
| R12 (body-to-block mapping coarse vs fine) | PRD-201-R12, PRD-102-R1, R2, R3, R4, R5 | Default coarse `markdown` block; opt-in fine-grained mode. |
| R13 (i18n: Hugo multilingual → Pattern 1 or 2) | PRD-400-R14, R15, R16, PRD-104-R5, R6, R7 | Per-language content trees map to PRD-104 Pattern 2 (default) or Pattern 1 (opt-in). |
| R14 (file-set emission) | PRD-400-R9, R10, R11, R12, R13, PRD-105-R1–R7a | Module writes the static file set parameterized by conformance target. |
| R15 (ETag derivation in Go) | PRD-400-R8, PRD-103-R4 | Module implements the static recipe; Go's `crypto/sha256` + base64url. |
| R16 (atomic writes via `os.Rename`) | PRD-400-R23, PRD-105-R12 | Tmp-then-rename pattern; no half-written files. |
| R17 (conformance-level computation from observed emissions) | PRD-400-R17, PRD-107-R6, R8, R10 | Achieved level computed from emitted files; module MUST NOT inflate. |
| R18 (capability-flag emission) | PRD-400-R18, PRD-200-R23 | Advertised iff observed; never trust configuration alone. |
| R19 (build-report sidecar) | PRD-400-R27 | Module writes the build report; same schema as the TS reference. |
| R20 (test-fixture conformance) | PRD-400-R28 | Hugo module MUST pass `fixtures/400/` and `fixtures/402/` corpora. |
| R21 (wrapper-script as v0.1 integration; future post-build hook) | PRD-400-R24, R25 | Wrapper script normative for v0.1; future Hugo upstream PR for a real post-build hook is the v0.2 path. |
| R22 (Stage 1 adapter pinning enforcement) | PRD-400-R29, PRD-200-R25, PRD-108-R14 | Module emits `act_version: "0.1"` only in v0.1; refuses to run if configuration targets a different version. |
| R23 (build-report path outside `public/`) | PRD-400-R27 | Build report at project root (`./.act-build-report.json`), not `public/.act-build-report.json`, to avoid CDN upload. |
| R24 (Hugo-specific reserved frontmatter keys) | PRD-201-R6 | Hugo's reserved keys (`slug`, `aliases`, `weight`, `draft`, `date`) are honored without conflicting with framework-reserved keys (`metadata.source`, `metadata.locale`, `metadata.translations`, `metadata.extraction_status`, `metadata.extracted_via`). |
| R25 (no component-contract seam in v0.1) | PRD-300-N/A | Hugo has no React-style component model; PRD-402 does not invoke component bindings. Future v0.2 amendment may add Hugo shortcode-as-component-contract. |

### Conformance level

Per PRD-107, every requirement in PRD-402 belongs to one of the conformance bands. Because PRD-402 is a leaf generator PRD, the level annotation indicates *which band of producer output the requirement primarily affects*; a Hugo module targeting Plus must satisfy every Core, Standard, and Plus-banded requirement. Achieved level is computed from observed emissions per PRD-400-R17; the configuration's `conformanceTarget` is a request, not a guarantee.

- **Core:** PRD-402-R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R12 (coarse mode), R14 (Core file set), R15, R16, R17, R18, R19, R20, R21, R22, R23, R24, R25.
- **Standard:** PRD-402-R12 (fine-grained mode), R14 (subtree files; Standard additive).
- **Plus:** PRD-402-R13 (i18n; Plus per PRD-107-R10), R14 (NDJSON index; Plus additive).

A Hugo module targeting Plus satisfies Standard and Core by additivity (PRD-107-R11).

### Normative requirements

#### Spec-only treatment (Q3)

**PRD-402-R1.** **(Core)** PRD-402 is a spec-only PRD per decision Q3; no first-party Hugo module ships in v0.1. The contract below applies at the spec level — a community Hugo module written in Go MUST satisfy every requirement in this PRD's Specification section, expressed in equivalent terms in Go. PRD-400-R33 governs the broader spec-only carve-out: TypeScript signatures in PRD-400's "Wire format / interface definition" are normative for TS implementations only; for Hugo modules, the prose form of each requirement is normative, and the Go snippets in §"Implementation notes" are illustrative, not normative-by-syntax. PRD-600 validates output bytes; the validator is implementation-language-agnostic. A conformant Hugo module passes the same `fixtures/400/` corpus as a conformant Astro plugin (PRD-401).

#### Canonical pipeline mapping (consumes PRD-400-R1 / R2)

**PRD-402-R2.** **(Core)** A Hugo module implementing PRD-402 MUST execute the canonical pipeline order (PRD-400-R1) in equivalent terms:

1. **Discover sources.** The module reads its configuration from `hugo.toml`'s `[params.act]` namespace and resolves Hugo's content tree (the directory rooted at Hugo's configured `contentDir`, default `content/`).
2. **Run adapters.** Hugo's own content-walk plays the role of the adapter (PRD-201's behavioral contract applied in Go). For every content file, the module parses front matter, derives the ID, maps body to blocks, derives the summary, and constructs an ACT node.
3. **Run component extractors.** Skipped — Hugo has no React-style component model in v0.1. (See PRD-402-R25.)
4. **Merge.** Skipped — single-source build (Hugo's content tree is the only source). The merge step is trivial: the node set is the content-walk's output.
5. **Normalize / validate.** The module validates every emitted envelope against PRD-100's schemas (a Go JSON Schema library — `github.com/santhosh-tekuri/jsonschema/v5` or equivalent — is the typical choice).
6. **Compute ETags.** The module runs PRD-103-R4 (static recipe) over every envelope's payload-minus-`etag` and writes the result into the envelope's `etag` field.
7. **Emit files.** The module writes the static file set per PRD-105's directory layout via atomic writes (PRD-402-R16).

The pipeline order MUST NOT be reordered, interleaved, or have stages skipped that apply at the configured conformance target. This mirrors PRD-400-R1's contract.

#### Hugo module integration shape

**PRD-402-R3.** **(Core)** A Hugo module implementing PRD-402 MUST be published as a Go module under a stable module path (e.g., `github.com/{org}/act-hugo`). Operators consume the module via `hugo.toml`'s `[module]` block:

```toml
[module]
  [[module.imports]]
    path = "github.com/example/act-hugo"
```

The module's binary entry point is named `act-hugo` (or `act-hugo-emit`) and is invoked from the wrapper script (PRD-402-R5). The module MAY ship Hugo template partials under `layouts/partials/act/*` for operators who want to embed ACT discovery hand-offs (per PRD-101) into their HTML; that's optional and outside PRD-402's normative surface.

**PRD-402-R4.** **(Core)** The module's configuration MUST live under `hugo.toml`'s `[params.act]` namespace. The configuration shape mirrors PRD-400-R31's `GeneratorConfig`, expressed as TOML keys:

```toml
[params.act]
  actVersion = "0.1"
  conformanceTarget = "core"             # "core" | "standard" | "plus"
  outputDir = "public"                   # Hugo's default output dir
  baseUrl = "https://example.com"        # typically same as Hugo's baseURL
  failOnExtractionError = false
  incremental = true

[params.act.manifest]
  [params.act.manifest.site]
    name = "Example Blog"
    canonical_url = "https://example.com"
    locale = "en-US"
    license = "CC-BY-4.0"

[params.act.urlTemplates]
  index_url = "/act/index.json"
  node_url_template = "/act/n/{id}.json"
  subtree_url_template = "/act/sub/{id}.json"      # optional, Standard+
  index_ndjson_url = "/act/index.ndjson"           # optional, Plus
  search_url_template = "/act/search?q={query}"    # optional, Plus

[params.act.i18n]
  pattern = "2"                          # "1" | "2"
  # locales.default and locales.available read from Hugo's [languages] block
```

The module MUST validate the configuration before invoking the pipeline; validation failure is a build error per PRD-400's R31 contract (mirrored in PRD-402-R14). Adapter-specific options nest under `[params.act.adapters.<name>]`; for v0.1, the module's own content-walk does not require adapter options because it inherits Hugo's `contentDir` configuration directly.

#### Wrapper-script integration (the v0.1 build hook)

**PRD-402-R5.** **(Core)** Hugo does not expose a true post-build hook equivalent to Astro's `astro:build:done` or Docusaurus's `postBuild`. For v0.1, a Hugo module implementing PRD-402 MUST integrate via a wrapper-script pattern:

```
hugo && act-hugo emit
```

The first command runs Hugo's full build, producing `public/`. The second command (`act-hugo emit`) is the module's binary, which reads Hugo's `public/` and `content/` directories, runs the canonical pipeline (PRD-402-R2), and writes the ACT file set under `public/act/` (or wherever `[params.act].urlTemplates` resolves). Operators MAY package the wrapper as a Makefile target, a npm script, or a CI job step; the module MUST document the pattern in its README and MUST NOT silently assume a different integration. Future Hugo upstream work may add a real post-build hook (`--post-build` flag or a module-level lifecycle hook); that path is the v0.2 direction (see PRD-402-R21).

**PRD-402-R6.** **(Core)** The module MUST detect stale state at the start of `act-hugo emit`. Specifically: when a previous build report exists at the build-report path (PRD-402-R23), the module reads the report's `completedAt` timestamp and compares against the most recent mtime of any file under Hugo's `public/`. If the most recent `public/` mtime is older than the report's `completedAt`, the module surfaces a build warning ("Hugo's `public/` is older than the previous ACT build — did `hugo` run after `act-hugo emit`?"). The warning does NOT halt; operators may have intentionally run `act-hugo emit` against a stale `public/` (e.g., during incremental development). A sibling check: when `public/` does NOT exist at all (no Hugo build has ever run), the module surfaces a build error and exits non-zero — `act-hugo emit` requires Hugo's build output as input.

#### Content-walk behavioral contract (consumes PRD-201)

**PRD-402-R7.** **(Core)** A Hugo module implementing PRD-402 MUST implement Hugo's content-walk in Go in a way that produces output behaviorally equivalent to what PRD-201's TypeScript reference (`act-markdown`) would produce for the same content corpus. Equivalence is byte-level on the emitted envelopes (modulo `generated_at` timestamps and the `metadata.source.adapter` value, which for Hugo is `"act-hugo"` rather than `"act-markdown"`). Specifically:

- **File walk.** Walk `contentDir` recursively per Hugo's content rules, including `_index.md` files. Skip drafts unless `--buildDrafts` is set; skip future-dated content unless `--buildFuture` is set; skip expired content unless `--buildExpired` is set. (Hugo's existing flags control inclusion; the module MUST honor them.)
- **Frontmatter parsing.** Per PRD-402-R9.
- **ID derivation.** Per PRD-402-R8.
- **Body-to-block mapping.** Per PRD-402-R12.
- **Summary derivation.** Per PRD-201-R17, R18, R19, R20: frontmatter `summary` wins (`summary_source: "author"`); else extract first non-heading paragraph (`summary_source: "extracted"`); cap at 50 tokens per PRD-100-R20 / PRD-102-R26.
- **Provenance stamping.** Every emitted node MUST carry `metadata.source = { adapter: "act-hugo", source_id: "<contentDir-relative path>" }` per PRD-200-R13.

The behavioral contract is normative; Go is the implementation language. PRD-600 validates output bytes; if a Hugo module's output differs from the TS reference's output for the same source corpus (per `fixtures/400/positive/spec-only-equivalence-hugo/`), the Hugo module is non-conformant.

#### ID derivation from content path

**PRD-402-R8.** **(Core)** The default ID for a content file MUST be derived from the file's path relative to `contentDir`, normalized as follows:

1. Drop the file extension (`.md`, `.markdown`, `.mdx`).
2. Collapse `_index` to its parent directory (so `posts/2026/_index.md` → `posts/2026`).
3. Lowercase ASCII per PRD-100-R10.
4. Replace path separators with `/` (the ID grammar's segment separator).

Frontmatter `id:` overrides the derived ID per PRD-201-R9 / PRD-100-R14. The configuration's `idStrategy.stripPrefix` (under `[params.act]`) overrides the default but loses to frontmatter override per PRD-201-R10. Hugo's `slug` frontmatter key is honored as an *alias* for the derived ID's last segment; explicit `id:` still wins. Hugo's `permalink` configuration does NOT influence the ID — permalinks influence `metadata.canonical_url` only (PRD-402-R11). A content file at `content/posts/2026/intro.md` derives the ID `posts/2026/intro`. A `content/_index.md` derives the empty-string-equivalent root ID `index` (the module MUST emit a non-empty ID; `_index.md` at the content root is mapped to the literal ID `index` per PRD-100-R10's ID grammar).

#### Frontmatter contract

**PRD-402-R9.** **(Core)** The module MUST recognize Hugo's three frontmatter formats: TOML (delimited by `+++`), YAML (delimited by `---`), and JSON (delimited by `{` / `}` at the very start of the file). The recognized ACT keys (per PRD-201-R4) are:

| Key | Type | PRD-100 / PRD-102 mapping | Default if absent |
|---|---|---|---|
| `id` | string | PRD-100-R14 explicit override | derived per PRD-402-R8 |
| `title` | string | PRD-100-R21 required field | derived from first H1 if present, else file stem |
| `summary` | string | PRD-100-R21 required, `summary_source: "author"` | derived per PRD-201-R17 |
| `summary_source` | string | PRD-102-R12 documented-open enum | stamped per PRD-201-R20 |
| `type` | string | PRD-100-R21 required, PRD-102 type taxonomy | `"article"` |
| `tags` | array of strings | PRD-100-R17, R22 | absent |
| `parent` | string (ID) | PRD-100-R24 | absent — derived per PRD-402-R10 |
| `related` | array of objects or strings | PRD-102-R18, R19 | absent |
| `metadata` | object | PRD-100-R22 open metadata | merged with framework metadata |

Hugo's existing keys are honored without conflict:

- `slug` — alias for the ID's last segment (PRD-402-R8); explicit `id:` wins.
- `aliases` — emitted as `metadata.aliases` (open metadata per PRD-100-R22) for consumer consumption.
- `weight` — emitted as `metadata.hugo_weight` (open metadata) for downstream sort hints.
- `draft` — Hugo's draft-exclusion; honored via Hugo's `--buildDrafts` flag.
- `date` — emitted as `metadata.published_at` in RFC 3339 form.
- `lastmod` — emitted as `metadata.modified_at` in RFC 3339 form.

Reserved framework keys (per PRD-201-R6, PRD-200-R13, PRD-104) MUST NOT be settable from frontmatter; an attempt to set `metadata.source`, `metadata.locale`, `metadata.translations`, `metadata.extraction_status`, or `metadata.extracted_via` from frontmatter is a build error per PRD-200-R18.

#### Section hierarchy → ACT parent / children

**PRD-402-R10.** **(Core)** Hugo's section hierarchy MUST map to ACT `parent` / `children` as follows:

- A directory under `contentDir` containing an `_index.md` is a *section*. The `_index.md` becomes the section node; its `id` is derived from the section path (PRD-402-R8 with `_index` collapsing).
- Leaf `*.md` files within a section directory become child nodes; each child node's `parent` field MUST be set to the section's ID.
- A section node's `children` array MUST list the IDs of all leaf `*.md` files immediately within it AND of all subsections (subdirectories with their own `_index.md`).
- Cycle detection per PRD-100-R25: a content file MUST NOT be reachable from itself via the `parent` chain. Hugo's filesystem hierarchy guarantees no cycles in the default mapping; explicit frontmatter `parent:` overrides MAY introduce cycles, which the module MUST detect at validation and surface as a build error.

A directory without an `_index.md` is a logical grouping but not a section node — its leaf files are emitted as children of the nearest ancestor section, or of the synthetic root if no ancestor section exists. The synthetic root's ID is `index` (PRD-402-R8); operators are RECOMMENDED to author a `content/_index.md` to make the root node explicit.

#### Permalinks → canonical URL

**PRD-402-R11.** **(Core)** Hugo's permalinks (configured via `permalinks` in `hugo.toml` and influenced by `slug`, `url`, and section-level rules) define the URL the rendered HTML page serves at. The module MUST emit each node's resolved permalink as `metadata.canonical_url`. Permalinks MUST NOT influence the ACT `id`; the ID is path-derived per PRD-402-R8. This separation is required because Hugo permalinks may include date prefixes, slugs, or URL rewrites that change over time and across configurations, while the ACT ID is meant to be stable across builds for a given content file. A consumer that wants the human-facing URL reads `metadata.canonical_url`; a consumer that wants the stable identity reads `id`.

#### Body-to-block mapping (consumes PRD-201)

**PRD-402-R12.** **(Core)** The module MUST map a content file's body to PRD-102 content blocks per PRD-201-R12. Default mode is **coarse**: the entire body (after frontmatter) becomes a single block of type `markdown` (PRD-102-R1). Opt-in **fine-grained** mode (configured under `[params.act].mode = "fine"`) splits the body into:

- `prose` blocks for paragraphs, headings, and lists (PRD-102-R2).
- `code` blocks for fenced code (PRD-102-R3); the fence info string is the language tag.
- `data` blocks for fenced data (\`\`\`json data, \`\`\`yaml data, etc., PRD-102-R4).
- `callout` blocks for `:::note` / GFM-alert syntax (PRD-102-R5); the trigger keyword maps to the closed `level` enum.

Block ordering MUST preserve source order (PRD-102-R24). Fine-grained mode is Standard-tier per PRD-107-R8; coarse mode is Core. A Core build MUST emit only `markdown` blocks; a Standard or higher build MAY emit fine-grained blocks. A Plus build MAY emit `marketing:*` blocks only when composed with PRD-300's component-contract layer — which Hugo modules do NOT support in v0.1 (PRD-402-R25). A Plus-targeting Hugo module therefore emits Plus-tier output only via the NDJSON index and i18n manifest features, not via component-extracted blocks.

#### i18n handling (consumes PRD-104, PRD-400-R14 / R15 / R16)

**PRD-402-R13.** **(Plus)** When Hugo's `languages` configuration declares more than one language, the module MUST emit per-locale layout per PRD-104. By default, the module uses **Pattern 2** (per-locale manifests):

- The parent manifest at `/.well-known/act.json` advertises `locales.manifest_url_template`.
- Each per-locale manifest at the substituted URL (e.g., `/{locale}/.well-known/act.json`) carries `site.locale` set to the locale per PRD-104-R6.
- Per-locale indexes and per-locale node-sets are emitted under each locale's URL prefix.

The module MAY use **Pattern 1** (locale-prefixed IDs) when configured via `[params.act].i18n.pattern = "1"`. Pattern 1 emits a single manifest covering all locales with locale-prefixed IDs (e.g., `en/intro`, `es/intro`); each emitted node MUST carry `metadata.locale` per PRD-104-R5. The module MUST NOT mix patterns within a single build per PRD-104-R7. Hugo's `defaultContentLanguage` maps to PRD-104's `locales.default`; Hugo's per-language content trees (e.g., `content/en/`, `content/es/` when `languages.contentDir` is configured per language, or filename-based variants like `intro.es.md`) are walked once per language, with `ctx.locale` threaded through the content-walk per PRD-400-R14.

#### File-set emission (consumes PRD-105)

**PRD-402-R14.** **(Core, Standard, Plus per emission)** The module MUST emit the static file set PRD-105 specifies, parameterized by the configured `conformanceTarget`:

- **Core (PRD-105-R1, R2, R4):** `/.well-known/act.json` (manifest); `{index_url}` (index); `{node_url_template[id=N]}` for every node `N`.
- **Standard (PRD-105-R6, additive over Core):** `{subtree_url_template[id=N]}` for every advertised subtree-id.
- **Plus (PRD-105-R7, R7a, additive over Standard):** `{index_ndjson_url}` (NDJSON index); the search-fulfillment artifact per PRD-105-R7a.

URL paths derive from `[params.act].urlTemplates` per PRD-105-R1–R7. The module MUST signal the intended `Content-Type` for every emitted file in the build report (PRD-402-R19); the actual `Content-Type` HTTP header is the CDN's responsibility per PRD-105-R8. A Hugo module deploying to GitHub Pages, Netlify, Cloudflare Pages, or a similar static host typically configures `Content-Type` headers via the host's `_headers` / `_redirects` / `netlify.toml` mechanism; the module MAY emit such a sidecar at the operator's discretion.

The module MUST NOT populate runtime-only manifest fields per PRD-105-R3 (no `auth.schemes`, no runtime-only capability flags). Hugo is a static-only generator; `delivery: "static"` is the only valid value.

#### ETag derivation in Go (consumes PRD-103-R4)

**PRD-402-R15.** **(Core)** The module MUST compute the `etag` for every envelope per PRD-103-R4 (static recipe), implemented in Go:

1. Encode the envelope's payload-minus-`etag` as a JSON object.
2. Canonicalize per JSON Canonicalization Scheme (JCS, RFC 8785). A Go JCS library (`github.com/cyberphone/json-canonicalization`) or equivalent is the typical choice; alternatively, the module MAY implement RFC 8785's lexicographic-sort-and-fixed-encoding rules inline.
3. Compute SHA-256 of the canonicalized bytes (`crypto/sha256`).
4. Encode the digest as base64url with no padding (`encoding/base64.URLEncoding.WithPadding(base64.NoPadding)`).
5. Truncate to the first 22 characters per PRD-103-R3.
6. Prefix with `s256:`.

The module MUST overwrite any pre-populated `etag` value before write; ETag derivation is the module's responsibility. The same recipe applies to manifest, index, node, subtree, and per-NDJSON-line envelopes.

#### Atomic writes via `os.Rename`

**PRD-402-R16.** **(Core)** The module MUST write each output file atomically via the tmp-then-rename pattern, mirroring PRD-400-R23:

1. Compute the canonical JSON bytes (already-canonicalized for ETag derivation; the wire bytes MAY be re-encoded with whitespace for readability, but the bytes used for ETag computation are the canonical bytes).
2. Write to a temporary path adjacent to the target (e.g., `intro.json.tmp.<pid>.<nanos>`) via `os.WriteFile` or `os.Create` + `f.Write` + `f.Sync` + `f.Close`.
3. `os.Rename(tmpPath, targetPath)`. On POSIX, `os.Rename` is atomic within the same filesystem (POSIX `rename(2)`); on Windows, `os.Rename` calls `MoveFileEx` with `MOVEFILE_REPLACE_EXISTING`, which is atomic per file.

The module MUST NOT leave a half-written index, manifest, or NDJSON file even if the build is interrupted. If the build receives `SIGINT` or `SIGTERM`, the module's signal handler MUST clean up any lingering `.tmp.*` files in `outputDir` before exiting.

#### Conformance-level computation from observed emissions (consumes PRD-400-R17)

**PRD-402-R17.** **(Core)** The module MUST compute the manifest's `conformance.level` from observed artifacts, NOT from `[params.act].conformanceTarget` alone:

- **Core** is the floor; every conformant Hugo module output is at least Core.
- **Standard** requires `subtree_url_template` declared AND at least one subtree file emitted.
- **Plus** requires Standard + NDJSON index emitted + (when configured) i18n parent manifest emitted.

If `conformanceTarget` is `"plus"` but the module did not emit an NDJSON file (e.g., because `[params.act].urlTemplates.index_ndjson_url` was omitted), the module MUST emit `conformance.level: "standard"` (or `"core"`) and surface a build warning. The module MUST NOT fabricate Plus claims; this is the producer-side analog of PRD-107-R22.

#### Capability-flag emission (consumes PRD-400-R18, PRD-200-R23)

**PRD-402-R18.** **(Core)** The module MUST populate the manifest's `capabilities` object from observed emissions:

- `capabilities.etag: true` iff every emitted envelope carries a valid `etag` per PRD-103-R2 (always true for conformant Hugo modules).
- `capabilities.subtree: true` iff at least one subtree file was emitted (Standard or higher).
- `capabilities.ndjson_index: true` iff the NDJSON index file was emitted (Plus).
- `capabilities.search.template_advertised: true` iff `search_url_template` is declared in configuration AND the module wrote the search-fulfillment artifact per PRD-105-R7a.
- `capabilities.change_feed` reserved per PRD-100-R6; not emitted in v0.1.

Capability advertisement without backing emission is a build error per PRD-400-R18.

#### Build-report sidecar (consumes PRD-400-R27)

**PRD-402-R19.** **(Standard)** The module MUST write a build report sidecar after every successful build. The report's schema is identical to PRD-400-R27's `BuildReport` shape (the same JSON object an Astro / Docusaurus / Eleventy module produces). The module MUST populate at minimum: `generator: { name: "act-hugo", version: "<module version>" }`, `actVersion`, `conformanceTarget`, `conformanceAchieved`, `delivery: "static"`, `startedAt`, `completedAt`, `durationMs`, `files[]` (path, bytes, etag, contentType, band), `warnings[]`, `errors[]`, `capabilities`, and `contributors[]` (a single entry: `{ kind: "adapter", name: "act-hugo", declaredLevel: "<level>", declaredCapabilities: { /* ... */ } }`).

The build report path is governed by PRD-402-R23 (outside `public/` to avoid CDN upload).

#### Test-fixture conformance (consumes PRD-400-R28)

**PRD-402-R20.** **(Core)** A Hugo module implementing PRD-402 MUST pass the framework conformance fixture corpus enumerated in §"Test fixtures." Conformance is binary: any positive fixture the module fails to produce equivalent output for, or any negative fixture the module emits clean output for (when the framework expects a build error or warning), is a conformance violation. PRD-600 (validator) ships the fixture-runner; the module MAY also ship the runner as a Go test (`go test ./...` invoking the validator against fixture corpora).

#### Wrapper-script as v0.1 integration; future post-build hook

**PRD-402-R21.** **(Core)** The wrapper-script integration (PRD-402-R5) is the v0.1 path. Future direction (non-normative for v0.1): a Hugo upstream change that introduces a real post-build hook (e.g., a `--post-build` flag accepting a command, or a Hugo module lifecycle hook callable from Go) would unblock a single-command path equivalent to Astro's `astro:build:done`. PRD-402's amendment process per PRD-108 admits adding a normative integration alongside the wrapper-script (MINOR change per PRD-108-R4(1)) once such a hook is available upstream. Until then, wrapper-script is normative.

#### Adapter version pinning (consumes PRD-400-R29, PRD-200-R25)

**PRD-402-R22.** **(Core)** A Hugo module implementing PRD-402 inherits Stage 1 adapter pinning per PRD-200-R25 / PRD-400-R29. Concretely: a v0.1 Hugo module emits `act_version: "0.1"` only. The module's binary MUST refuse to run if `[params.act].actVersion` is set to anything other than `"0.1"` in v0.1. A spec MINOR bump to `0.2` requires a coordinated module release. Stage 2 pinning (PRD-200-R26 / PRD-400-R30) applies only post-ratification; it is not active in v0.1.

#### Build-report path outside `public/`

**PRD-402-R23.** **(Standard)** The build report (PRD-402-R19) MUST NOT be written under `public/` (Hugo's default deploy directory). The default path is `./.act-build-report.json` at the project root, mirroring PRD-400-R27's intent that the report is a local artifact for CI integrations and downstream tooling, not for CDN deployment. The module MAY accept a configuration override (e.g., `[params.act].buildReportPath`) for operators with non-default project layouts. Operators who choose to nest the report under `public/` MUST add the report to their deploy ignore list (e.g., `.gitignore` for git-based deploys, `_headers` 404 patterns for Cloudflare Pages); the module's documentation MUST surface this limitation.

#### Hugo-specific reserved frontmatter keys

**PRD-402-R24.** **(Core)** Hugo's existing frontmatter keys (`slug`, `aliases`, `weight`, `draft`, `date`, `lastmod`, `keywords`, `categories`, `series`, `description`, `linkTitle`, `cascade`) are honored without conflicting with framework-reserved keys. Specifically:

- `slug`, `aliases`, `weight`, `date`, `lastmod` are mapped per PRD-402-R9.
- `draft`, `expiryDate`, `publishDate` control inclusion via Hugo's existing flags (PRD-402-R7).
- `keywords` is merged with `tags` (PRD-100-R22 metadata is open) — the module emits the union under `tags`.
- `categories`, `series` are emitted under `metadata.hugo_categories`, `metadata.hugo_series` (open metadata).
- `description` is treated as a synonym for `summary` if `summary` is absent; if both are present, `summary` wins. The module MUST surface a build warning when `description` and `summary` differ.
- `linkTitle` is emitted under `metadata.link_title` (open metadata).
- `cascade` (Hugo's frontmatter inheritance mechanism) is honored in Hugo's content-walk (the module reads cascaded frontmatter the same way Hugo does); cascaded values are applied before the module's own frontmatter parsing.

A frontmatter block attempting to set framework-reserved keys (`metadata.source`, `metadata.locale`, `metadata.translations`, `metadata.extraction_status`, `metadata.extracted_via`) is a build error per PRD-200-R18 / PRD-201-R6.

#### No component-contract seam in v0.1

**PRD-402-R25.** **(Core)** Hugo modules implementing PRD-402 v0.1 MUST NOT invoke component bindings (PRD-300). Hugo has no React-style component model; Hugo shortcodes — the closest analogue — have a different lifecycle and do not expose a clean cross-implementation contract. A future v0.2 amendment MAY add a Hugo-shortcode-as-component-contract seam; until then, Hugo modules emit `markdown` / `prose` / `code` / `data` / `callout` blocks only. A Plus-targeting Hugo module reaches Plus via the NDJSON index and i18n features (PRD-402-R13, PRD-402-R14); the `marketing:*` namespace requires component extraction and is therefore unreachable for v0.1 Hugo modules.

### Wire format / interface definition

There is no JSON wire format introduced by PRD-402 — Hugo modules emit existing PRD-100 envelopes. The contract is the prose form of every PRD-400 requirement, applied to Hugo's build model and expressed in Go. The Go snippets in §"Implementation notes" demonstrate equivalence to PRD-400's TypeScript `GeneratorPlugin` / `GeneratorRuntime` / `GeneratorConfig` / `BuildContext` / `BuildReport` interfaces; per PRD-400-R33, those snippets are illustrative, not normative-by-syntax.

### Errors

The module surfaces errors along the same two axes as PRD-400: recoverable (warning, build continues) and unrecoverable (build fails with non-zero exit). The build report (PRD-402-R19) enumerates both. The table below pins Hugo-specific error contracts; for any condition not listed, the module follows PRD-400's "Errors" table verbatim.

| Condition | Module behavior | Build report severity | Exit code |
|---|---|---|---|
| `[params.act]` configuration missing or malformed | Fail before any pipeline stage | error | non-zero |
| `[params.act].actVersion` ≠ `"0.1"` (Stage 1 pinning) | Refuse to run | error | non-zero |
| Hugo's `public/` does not exist (Hugo build never ran) | Fail at start of `act-hugo emit` | error | non-zero |
| Hugo's `public/` is older than the previous build report's `completedAt` | Surface warning; continue | warning | 0 |
| Frontmatter parse failure (TOML / YAML / JSON malformed) | Hard build error per PRD-200-R18 | error | non-zero |
| Frontmatter sets a framework-reserved key | Hard build error per PRD-201-R6 / PRD-200-R18 | error | non-zero |
| ID grammar violation after derivation and frontmatter override | Hard build error per PRD-100-R10 / PRD-400-R7 | error | non-zero |
| `parent` chain creates a cycle (frontmatter override) | Hard build error per PRD-100-R25 / PRD-402-R10 | error | non-zero |
| Missing required envelope field (`title`, `summary`, etc.) | Hard build error per PRD-100-R21 / PRD-400-R7 | error | non-zero |
| `description` and `summary` both set with different values | Surface warning; `summary` wins | warning | 0 |
| Capability advertised without backing emission | Hard build error per PRD-400-R18 / PRD-402-R18 | error | non-zero |
| `conformanceTarget: plus` but no NDJSON emitted | Downgrade `conformance.level` per PRD-402-R17; warn | warning | 0 |
| Schema validation failure on any envelope | Hard build error per PRD-400-R7 | error | non-zero |
| Atomic write fails (disk full, permission denied) | Hard build error; clean up tmp files | error | non-zero |
| `SIGINT` / `SIGTERM` mid-build | Clean up tmp files; non-zero exit | error | non-zero |
| Build-report write fails | Hard build error | error | non-zero |
| Multilingual config declares `pattern` and `manifest_url_template` mismatch | Hard build error per PRD-104-R7 | error | non-zero |

---

## Examples

Worked examples are non-normative but MUST be consistent with the Specification section.

### Example 1 — Minimum Core Hugo blog

A small blog with three posts under `content/posts/` and a root `_index.md`.

`hugo.toml`:

```toml
baseURL = "https://acme.example/"
title = "Acme Blog"
contentDir = "content"

[module]
  [[module.imports]]
    path = "github.com/example/act-hugo"

[params.act]
  actVersion = "0.1"
  conformanceTarget = "core"
  outputDir = "public"
  baseUrl = "https://acme.example"

[params.act.manifest]
  [params.act.manifest.site]
    name = "Acme Blog"

[params.act.urlTemplates]
  index_url = "/act/index.json"
  node_url_template = "/act/n/{id}.json"
```

Build invocation:

```
hugo && act-hugo emit
```

Pipeline:

1. Discover: reads `[params.act]`; resolves `contentDir` to `./content`.
2. Content-walk: enumerates `content/_index.md`, `content/posts/_index.md`, `content/posts/2026-launch.md`, `content/posts/2026-followup.md`, `content/posts/2026-roadmap.md`. Drafts and future-dated content excluded by default.
3. Per-file: parses frontmatter, derives ID per PRD-402-R8 (`index`, `posts`, `posts/2026-launch`, etc.), maps body to a single `markdown` block (coarse mode), derives summary per PRD-201-R17, stamps `metadata.source = { adapter: "act-hugo", source_id: "<relative path>" }`.
4. Validation: every envelope passes PRD-100 schemas.
5. ETag: computed per PRD-402-R15.
6. Emit: writes `public/.well-known/act.json`, `public/act/index.json`, and five node files at `public/act/n/<id>.json`.

Achieved level: Core. Capabilities advertised: `etag: true`. Build report at `./.act-build-report.json`.

Maps conceptually to `fixtures/402/positive/minimum-core-hugo-blog/` and to `fixtures/400/positive/spec-only-equivalence-hugo/` (the equivalence harness running this corpus through both a TS reference and a Hugo module and asserting byte-equivalent output).

### Example 2 — Multilingual Plus Hugo site (PRD-104 Pattern 2)

A docs site with English and Spanish content, Plus target, NDJSON index advertised.

`hugo.toml` (excerpt):

```toml
defaultContentLanguage = "en"

[languages]
  [languages.en]
    languageName = "English"
    weight = 1
  [languages.es]
    languageName = "EspaΓ±ol"
    weight = 2

[params.act]
  actVersion = "0.1"
  conformanceTarget = "plus"
  outputDir = "public"
  baseUrl = "https://acme.example"

[params.act.urlTemplates]
  index_url = "/act/index.json"
  node_url_template = "/act/n/{id}.json"
  subtree_url_template = "/act/sub/{id}.json"
  index_ndjson_url = "/act/index.ndjson"

[params.act.i18n]
  pattern = "2"
```

The module walks Hugo's per-language content trees once per language (en, es). For each language, it emits a per-locale manifest at `/{locale}/.well-known/act.json`, a per-locale index, per-locale node files, per-locale subtree files for declared subtree-roots, and per-locale NDJSON. The parent manifest at `/.well-known/act.json` advertises `locales.manifest_url_template = "/{locale}/.well-known/act.json"` per PRD-104-R6.

Achieved level: Plus. Capabilities advertised: `etag: true`, `subtree: true`, `ndjson_index: true`.

Maps conceptually to `fixtures/402/positive/multilingual-plus-pattern-2/`.

### Example 3 — Stale-`public/` warning

An operator runs `act-hugo emit` without first running `hugo`. The module reads `./.act-build-report.json` from a previous run (`completedAt: 2026-04-30T18:00:00Z`) and finds the most recent mtime in `public/` is `2026-04-30T17:55:00Z` — older than the report.

The build report shows:

```json
{
  "warnings": [
    {
      "code": "stale_hugo_output",
      "requirement": "PRD-402-R6",
      "message": "Hugo's public/ is older than the previous ACT build's completedAt. Did `hugo` run after `act-hugo emit`? Run `hugo && act-hugo emit` together."
    }
  ]
}
```

The build exits 0 (warning, not error). If `public/` does not exist at all, the module exits non-zero with an error per PRD-402-R6.

Maps conceptually to `fixtures/402/negative/stale-public-no-hugo-build/` and `fixtures/402/positive/stale-public-warning/`.

### Example 4 — Frontmatter override and Hugo-key interop

A content file at `content/about.md`:

```yaml
---
id: about-page
title: "About Acme"
slug: "about-us"
description: "Who we are and what we build."
date: 2026-04-15
weight: 5
aliases:
  - "/old-about"
  - "/company"
---

We build…
```

The module emits a node with:

- `id: "about-page"` (frontmatter override per PRD-402-R8 and PRD-402-R9).
- `title: "About Acme"`.
- `summary: "Who we are and what we build."` (from `description`; `summary` is absent so `description` is used per PRD-402-R24).
- `summary_source: "author"` (PRD-201-R20).
- `metadata.canonical_url: "https://acme.example/about-us/"` (Hugo's permalink resolution; `slug` influences the URL, not the ID, per PRD-402-R11).
- `metadata.published_at: "2026-04-15T00:00:00Z"` (RFC 3339 from `date`).
- `metadata.hugo_weight: 5`, `metadata.aliases: ["/old-about", "/company"]` (open metadata).
- `metadata.source: { adapter: "act-hugo", source_id: "about.md" }`.

Maps conceptually to `fixtures/402/positive/frontmatter-hugo-interop/`.

---

## Test fixtures

Fixtures live under `fixtures/402/`. Hugo modules implementing PRD-402 MUST also produce equivalent output for every applicable positive fixture under `fixtures/400/positive/` (the framework conformance corpus). Per PRD-402-R20, conformance is binary: a Hugo module that fails any positive fixture or accepts any negative fixture is non-conformant. Fixtures are byte-level — the output a conformant Hugo module would produce — and are not implementation-language-specific. PRD-402 enumerates the layout below; fixture files are NOT created in this PRD.

### Positive

- `fixtures/402/positive/minimum-core-hugo-blog/` → satisfies R2, R7, R8, R9, R10, R11, R12 (coarse), R14 (Core), R15, R16, R17, R18, R19. Three posts + `_index.md` files; Core target; no i18n; coarse blocks.
- `fixtures/402/positive/standard-with-subtree/` → satisfies R14 (Standard additive). Adds advertised `subtree_url_template` and emits subtree files.
- `fixtures/402/positive/plus-with-ndjson/` → satisfies R14 (Plus additive). Plus target; NDJSON index emitted.
- `fixtures/402/positive/multilingual-plus-pattern-2/` → satisfies R13 (Pattern 2). Two languages (en, es); per-locale manifests; per-locale indexes; per-locale node files.
- `fixtures/402/positive/multilingual-plus-pattern-1/` → satisfies R13 (Pattern 1). Two languages with locale-prefixed IDs; single parent manifest covers all.
- `fixtures/402/positive/frontmatter-hugo-interop/` → satisfies R9, R24. Hugo's `slug`, `aliases`, `weight`, `date`, `description` keys all honored without conflict.
- `fixtures/402/positive/section-hierarchy-three-deep/` → satisfies R10. Three-level section hierarchy (`/`, `/posts`, `/posts/2026`); section nodes carry correct `parent` / `children`.
- `fixtures/402/positive/permalinks-do-not-influence-id/` → satisfies R11. Custom permalinks configured; ACT IDs remain path-derived; `metadata.canonical_url` reflects permalinks.
- `fixtures/402/positive/coarse-vs-fine-modes/` → satisfies R12. Two builds of the same source corpus; coarse emits `markdown` blocks; fine emits `prose`/`code`/`data`/`callout`.
- `fixtures/402/positive/stale-public-warning/` → satisfies R6. Wrapper-script ordering violated; module surfaces warning but completes.
- `fixtures/402/positive/build-report-outside-public/` → satisfies R23. Build report at `./.act-build-report.json`, not under `public/`.
- `fixtures/402/positive/atomic-write-interrupt-recovery/` → satisfies R16. Behavioral fixture; runner injects a SIGTERM mid-write; the previous index is intact; tmp files are cleaned up.
- `fixtures/402/positive/spec-only-equivalence-hugo/` → satisfies R1, R20. Equivalence harness: a TS reference output and a Hugo-module output produced for the same source corpus; PRD-600 asserts byte-equivalence (modulo `generated_at` and `metadata.source.adapter`). Cross-references `fixtures/400/positive/spec-only-equivalence-hugo/`.

### Negative

- `fixtures/402/negative/stale-public-no-hugo-build/` → MUST fail. Hugo's `public/` does not exist; module exits non-zero per PRD-402-R6.
- `fixtures/402/negative/frontmatter-malformed/` → MUST fail. Malformed YAML frontmatter; module exits non-zero per PRD-200-R18 / PRD-402-R9.
- `fixtures/402/negative/frontmatter-reserved-key-set/` → MUST fail. Frontmatter sets `metadata.source` directly; module exits non-zero per PRD-201-R6.
- `fixtures/402/negative/parent-cycle-via-frontmatter/` → MUST fail. Frontmatter `parent:` creates a cycle; module exits non-zero per PRD-100-R25 / PRD-402-R10.
- `fixtures/402/negative/act-version-mismatch/` → MUST fail. `[params.act].actVersion = "0.2"` in a v0.1 module; refuses to run per PRD-402-R22.
- `fixtures/402/negative/capability-advertised-without-files/` → MUST fail. Manifest declares `capabilities.subtree: true` but no subtree files are emitted; module exits non-zero per PRD-402-R18.
- `fixtures/402/negative/i18n-mixed-patterns/` → MUST fail. `[params.act].i18n.pattern = "1"` but `manifest_url_template` set; module exits non-zero per PRD-104-R7 / PRD-402-R13.
- `fixtures/402/negative/runtime-only-fields-in-static-manifest/` → MUST fail. Configuration attempts to populate `auth.schemes`; module exits non-zero per PRD-105-R3.
- `fixtures/402/negative/atomic-write-half-written-index/` → MUST fail. Runner injects a write failure; the previous valid index remains; build exits non-zero.
- `fixtures/402/negative/build-report-in-public-without-deploy-ignore/` → MUST surface warning. Build report path nested under `public/` without documented deploy-ignore; module warns per PRD-402-R23.

---

## Versioning & compatibility

Per PRD-108, classify each kind of change to PRD-402 as MAJOR or MINOR.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add an optional `[params.act]` configuration field (e.g., `assetsDir`, `buildReportPath`) | MINOR | PRD-108-R4(1). Existing configurations unaffected. |
| Add a required `[params.act]` configuration field | MAJOR | PRD-108-R5(1). Existing configurations become non-conformant. |
| Add a recognized frontmatter key (e.g., `act_summary_source`) | MINOR | PRD-108-R4(1). Existing frontmatter unaffected. |
| Change the meaning of an existing recognized frontmatter key | MAJOR | PRD-108-R5(2). |
| Add a new conformance band emission (e.g., a new Plus capability) | MAJOR | Mirrors PRD-107's closed-enum rule for level. |
| Change the wrapper-script integration to a real post-build hook | MINOR | PRD-108-R4(1). Wrapper-script remains supported as a fallback; new hook is additive. |
| Drop the wrapper-script integration entirely | MAJOR | PRD-108-R5(3). Existing operators depend on it. |
| Add a Hugo-shortcode-as-component-contract seam | MINOR | PRD-108-R4(1). Additive; does not break existing modules that emit no extracted blocks. |
| Promote spec-only treatment to "first-party Go reference impl required" | MAJOR | Reverses Q3. Affects scope of v0.1 deliverables. |
| Change the build-report path default from `./.act-build-report.json` | MAJOR | PRD-108-R5(6). Tooling consumes the path. |
| Change the ID derivation default (e.g., stop collapsing `_index.md`) | MAJOR | PRD-108-R5(2). IDs change across builds. |
| Add support for a new frontmatter format (e.g., HCL) | MINOR | Additive. |
| Tighten a SHOULD to a MUST (e.g., warning → error for `description`-vs-`summary` divergence) | MAJOR | PRD-108-R5(3). |
| Change the default body-to-block mode from coarse to fine | MAJOR | PRD-108-R5(3). Existing builds change emission shape. |
| Add a fixture row to `fixtures/402/` | MINOR | Per PRD-200's pattern; new positive or negative fixture is additive. |

### Forward compatibility

A Hugo module implementing PRD-402 v0.1 MUST tolerate `[params.act]` keys it does not recognize (per PRD-108-R7). Future MINOR additions land cleanly. Closed enums (`conformanceTarget`, `i18n.pattern`) follow PRD-108-R8; an unknown enum value is a build error.

The build-report schema is documented-open per PRD-400-R27; consumers of the report tolerate unknown optional fields.

### Backward compatibility

A v0.1 Hugo module runs against a v0.2 spec only if no MAJOR change has been made to the canonical pipeline order, the build-report schema, the `[params.act]` configuration shape, or the recognized-frontmatter-key set. Adding optional fields, new frontmatter keys, or new severity codes is non-breaking.

For Stage 2 adapter pinning (PRD-200-R26), a future Hugo module version may target multiple spec MINORs by declaring `actSpecMinors: ["1.0", "1.1"]` in its module metadata; v0.1 Hugo modules are pinned to `act_version: "0.1"` only.

---

## Security considerations

This section cites PRD-109 (Accepted) for the project-wide threat model and documents only Hugo-specific deltas. PRD-400's Security section already covers the build-process trust boundary, secret-handling discipline, output-directory permissions, build-report-as-observability, ID-grammar enforcement, and adapter pinning as a security control. PRD-402 inherits all of those.

**Go module supply chain.** A Hugo module implementing PRD-402 is a Go module consumed via `hugo.toml`'s `[module]` block, which resolves through Go's module proxy (`proxy.golang.org` by default). The operator is responsible for verifying `go.sum` integrity and pinning specific versions. PRD-402 introduces no sandbox; a malicious upstream module pulled into a Hugo build can do anything the build process can do. PRD-109's build-process trust boundary applies — this is not a new threat, just one with a Go-module attack surface alongside the npm attack surface PRD-400 already documents.

**Wrapper-script ordering.** The wrapper-script integration (PRD-402-R5) is a sequencing-dependent contract: `hugo` MUST run before `act-hugo emit`. An operator who reverses the order, or who runs `act-hugo emit` against a stale `public/`, produces output that does not reflect the current Hugo state. PRD-402-R6 surfaces a warning when this is detected (most-recent `public/` mtime older than the previous build report's `completedAt`). This is an integrity concern, not a confidentiality concern — stale ACT output may mislead consumers about the site's current state but does not leak protected information.

**Build-report leakage into `public/`.** Hugo deploys `public/` wholesale to the CDN. A naive integration that places the build report at `public/.act-build-report.json` would expose adapter / module configuration metadata, file paths, ETags, and warning / error messages publicly. PRD-402-R23 mitigates by defaulting the report path to `./.act-build-report.json` (project root, outside `public/`). Operators who choose to nest the report under `public/` MUST configure their deploy pipeline to exclude it; the module's documentation MUST surface the limitation. The build report MUST NOT contain credentials per PRD-400's Security section ("Secret-handling discipline"); even on accidental deploy, the report does not leak operator secrets.

**Frontmatter-injected reserved keys.** A content author with write access to `content/` could attempt to set framework-reserved metadata keys (`metadata.source`, `metadata.locale`, `metadata.translations`, `metadata.extraction_status`, `metadata.extracted_via`) in frontmatter to confuse downstream consumers. PRD-402-R24 / PRD-201-R6 prevent this by treating any such attempt as a build error; the threat is contained at build time.

**Path-traversal in derived IDs.** PRD-100-R10's ID grammar forbids `..`, leading slashes, and uppercase. Hugo's content-walk is rooted at `contentDir`; the path-derived ID strategy (PRD-402-R8) operates on `contentDir`-relative paths. The ID grammar's segment-separator (`/`) is the only path character emitted; a hostile content file at `content/../../etc/passwd.md` cannot be reached because Hugo's content-walk does not follow `..` outside `contentDir`. Defense-in-depth: PRD-400-R7's normalize/validate stage re-validates every emitted ID against PRD-100-R10's grammar.

**Hugo's draft / future / expired content.** Hugo's `--buildDrafts`, `--buildFuture`, and `--buildExpired` flags include content that would otherwise be excluded. A Hugo module implementing PRD-402 honors these flags transparently; an operator who runs `hugo --buildDrafts` followed by `act-hugo emit` will emit ACT files for draft content. This is an information-disclosure risk if drafts are sensitive; operators should not run `--buildDrafts` for production deploys. PRD-109 covers the broader trust boundary (the operator authors source content; ACT does not redact).

**Unauthenticated static deployment.** Hugo is a static-only generator; the static profile is unauthenticated by definition. PRD-105 / PRD-109 already cover the trust boundary; PRD-402 adds nothing new here.

For all other concerns — auth-scheme negotiation (N/A for static profile), ETag determinism (delegated to PRD-103, implemented in Go per PRD-402-R15), cross-origin trust (N/A for the module; consumer-side per PRD-109-R21), PII in build messages (delegated to PRD-109-R14 / R15) — cite PRD-109 and PRD-400 directly. PRD-402 introduces no new transport surface and relies entirely on the wire-format and runtime PRDs for those rules.

---

## Implementation notes

**Spec only — no v0.1 reference implementation per decision Q3. PRD-400-R33 governs: TypeScript signatures in PRD-400 are normative for TS implementations only; for Hugo modules, the prose form of every requirement is normative. The Go snippets below demonstrate equivalence to PRD-400's TS contract; they are illustrative, not normative-by-syntax. The behaviour described in normative requirements is the contract.**

These snippets are sketches — full implementations include error handling, observability instrumentation, and the host-framework-specific glue a community Hugo module owns. A community port that produces byte-equivalent output to the TS reference for `fixtures/400/positive/spec-only-equivalence-hugo/` is conformant regardless of the internal Go shape it adopts.

### Snippet 1 — The canonical pipeline orchestration in Go

The Go analogue of PRD-400's `runPipeline` function. The Hugo module's binary entry point (`act-hugo emit`) wraps this orchestration.

```go
// Package acthugo is the v0.1 spec-only sketch of a community Hugo module.
package acthugo

import (
    "context"
    "fmt"
    "os"
)

// Pipeline runs the canonical PRD-400-R1 pipeline against Hugo's content tree.
func Pipeline(ctx context.Context, cfg Config, hostCtx HugoHostContext) (*BuildReport, error) {
    report := newBuildReport(cfg, hostCtx)

    // Stage 1: discover sources + enforce pinning (PRD-402-R22 / PRD-400-R29).
    if err := enforceAdapterPinning(cfg); err != nil {
        return nil, err
    }
    if err := enforceTargetLevel(cfg); err != nil {
        return nil, err
    }

    // Stage 2: content-walk (PRD-402-R7).
    contributions, err := walkHugoContent(ctx, cfg, hostCtx)
    if err != nil {
        return nil, fmt.Errorf("content walk: %w", err)
    }

    // Stage 3: skipped (no component bindings in v0.1; PRD-402-R25).
    // Stage 4: skipped (single source; merge is trivial).

    // Stage 5: validate envelopes against PRD-100 schemas (PRD-400-R7).
    validated, err := validateAgainstSchemas(contributions, cfg)
    if err != nil {
        return nil, fmt.Errorf("validate: %w", err)
    }

    // Stage 6: compute ETags (PRD-402-R15 / PRD-103-R4).
    withEtags := computeEtags(validated)

    // Stage 7: emit files atomically (PRD-402-R16 / PRD-105 layout).
    files, err := emitStaticFileSet(ctx, withEtags, cfg)
    if err != nil {
        return nil, fmt.Errorf("emit: %w", err)
    }

    // Synthesize achieved level + capability flags from observed emissions.
    report.ConformanceAchieved = computeAchievedLevel(files, cfg)  // PRD-402-R17
    report.Capabilities = computeCapabilityFlags(files, cfg)       // PRD-402-R18

    if err := writeBuildReport(report, files, cfg); err != nil {  // PRD-402-R19 / R23
        return nil, fmt.Errorf("write build report: %w", err)
    }

    if cfg.FailOnExtractionError && hasExtractionPlaceholders(report) {
        os.Exit(1)
    }
    return report, nil
}
```

### Snippet 2 — Configuration parsing from `[params.act]`

The Go analogue of PRD-400-R31's `GeneratorConfig`. The module reads Hugo's site configuration via Hugo's exposed APIs (or by re-parsing `hugo.toml`); the `[params.act]` namespace contains the ACT-specific keys.

```go
// Config mirrors PRD-400-R31's GeneratorConfig in Go.
// PRD-402-R4. Field names are TOML-friendly (snake_case in TOML, CamelCase in Go).
type Config struct {
    ActVersion            string         `toml:"actVersion"`
    ConformanceTarget     string         `toml:"conformanceTarget"` // "core" | "standard" | "plus"
    OutputDir             string         `toml:"outputDir"`
    BaseURL               string         `toml:"baseUrl"`
    FailOnExtractionError bool           `toml:"failOnExtractionError"`
    Incremental           bool           `toml:"incremental"`

    Manifest struct {
        Site struct {
            Name         string `toml:"name"`
            CanonicalURL string `toml:"canonical_url"`
            Locale       string `toml:"locale"`
            License      string `toml:"license"`
        } `toml:"site"`
    } `toml:"manifest"`

    URLTemplates struct {
        IndexURL           string `toml:"index_url"`
        NodeURLTemplate    string `toml:"node_url_template"`
        SubtreeURLTemplate string `toml:"subtree_url_template,omitempty"`
        IndexNDJSONURL     string `toml:"index_ndjson_url,omitempty"`
        SearchURLTemplate  string `toml:"search_url_template,omitempty"`
    } `toml:"urlTemplates"`

    I18n *struct {
        Pattern string `toml:"pattern"` // "1" | "2"
    } `toml:"i18n,omitempty"`

    BuildReportPath string `toml:"buildReportPath,omitempty"` // default "./.act-build-report.json"
}
```

### Snippet 3 — ETag derivation per PRD-103-R4 in Go

The static recipe applied to an envelope's payload-minus-`etag`. Equivalent to PRD-400's TS `computeEtags` over a single envelope.

```go
import (
    "crypto/sha256"
    "encoding/base64"
    "encoding/json"

    jcs "github.com/cyberphone/json-canonicalization/go/src/webpki.org/jsoncanonicalizer"
)

// ComputeEtag implements PRD-103-R4 (static recipe) in Go. PRD-402-R15.
func ComputeEtag(envelope map[string]any) (string, error) {
    // Step 1: payload-minus-etag.
    payload := make(map[string]any, len(envelope))
    for k, v := range envelope {
        if k == "etag" {
            continue
        }
        payload[k] = v
    }

    // Step 2: JCS-canonical encoding (RFC 8785).
    raw, err := json.Marshal(payload)
    if err != nil {
        return "", err
    }
    canonical, err := jcs.Transform(raw)
    if err != nil {
        return "", err
    }

    // Step 3-5: SHA-256, base64url no-padding, truncate to 22 chars.
    sum := sha256.Sum256(canonical)
    encoded := base64.RawURLEncoding.EncodeToString(sum[:])
    return "s256:" + encoded[:22], nil
}
```

### Snippet 4 — Atomic write via tmp + `os.Rename`

The Go analogue of PRD-400-R23 / PRD-402-R16. Mirrors the tmp-then-rename pattern.

```go
import (
    "fmt"
    "os"
    "path/filepath"
    "time"
)

// AtomicWrite writes bytes to targetPath via tmp + os.Rename.
// PRD-402-R16 / PRD-400-R23.
func AtomicWrite(targetPath string, bytes []byte) error {
    dir := filepath.Dir(targetPath)
    base := filepath.Base(targetPath)
    tmpPath := filepath.Join(dir, fmt.Sprintf(".%s.tmp.%d.%d", base, os.Getpid(), time.Now().UnixNano()))

    f, err := os.OpenFile(tmpPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o644)
    if err != nil {
        return err
    }

    cleanup := func() {
        _ = f.Close()
        _ = os.Remove(tmpPath)
    }

    if _, err := f.Write(bytes); err != nil {
        cleanup()
        return err
    }
    if err := f.Sync(); err != nil {
        cleanup()
        return err
    }
    if err := f.Close(); err != nil {
        _ = os.Remove(tmpPath)
        return err
    }

    // os.Rename is atomic on POSIX (rename(2)) and on Windows (MoveFileEx with REPLACE_EXISTING).
    return os.Rename(tmpPath, targetPath)
}
```

### Snippet 5 — Stale-`public/` detection

The Hugo-specific check from PRD-402-R6: compare `public/` mtimes against the previous build report's `completedAt`.

```go
import (
    "errors"
    "io/fs"
    "os"
    "path/filepath"
    "time"
)

// CheckStalePublic implements PRD-402-R6.
// Returns ("error", err) if public/ does not exist (Hugo never ran).
// Returns ("warning", nil) if public/ is older than previous build report.
// Returns ("ok", nil) otherwise.
func CheckStalePublic(publicDir string, previousReport *BuildReport) (string, error) {
    info, err := os.Stat(publicDir)
    if errors.Is(err, fs.ErrNotExist) {
        return "error", fmt.Errorf("Hugo's public/ does not exist; run `hugo` before `act-hugo emit`")
    }
    if err != nil {
        return "error", err
    }
    if !info.IsDir() {
        return "error", fmt.Errorf("Hugo's public/ is not a directory")
    }
    if previousReport == nil {
        return "ok", nil // first run; nothing to compare
    }

    var latestMtime time.Time
    _ = filepath.WalkDir(publicDir, func(path string, d fs.DirEntry, err error) error {
        if err != nil || d.IsDir() {
            return nil
        }
        if fi, err := d.Info(); err == nil && fi.ModTime().After(latestMtime) {
            latestMtime = fi.ModTime()
        }
        return nil
    })

    if latestMtime.Before(previousReport.CompletedAt) {
        return "warning", nil
    }
    return "ok", nil
}
```

### Snippet 6 — The wrapper-script invocation (Makefile and shell)

The v0.1 integration shape per PRD-402-R5. Operators MAY package the wrapper as a Makefile target, a shell script, or a CI step. The module's README MUST document the pattern.

```makefile
# Makefile excerpt — the canonical v0.1 integration.
# PRD-402-R5.
.PHONY: build
build:
	hugo
	act-hugo emit

.PHONY: build-drafts
build-drafts:
	hugo --buildDrafts
	act-hugo emit
```

```bash
# Equivalent shell script for CI pipelines.
# Stop on first failure (Hugo's build error must abort before act-hugo emit runs).
set -euo pipefail
hugo
act-hugo emit
```

The future direction (PRD-402-R21) is a Hugo upstream change that admits a real post-build hook — at which point a single `hugo` invocation would suffice. Until that lands, the wrapper is the spec.

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review. Decisions: (Q1) no Hugo `Output Formats` integration in v0.1 — wrapper-script is the canonical path; (Q2) no shortcode-as-component-contract seam in v0.1 — defer to v0.2; (Q3) emit under `public/act/`, not `static/`; (Q4) honor Hugo's draft / future / expired flags (drafts excluded by default; `--buildDrafts` opts in); (Q5) no Hugo `resources/_gen/` cache integration — content hashing per PRD-400-R22. Confirms PRD-400-R33 spec-only treatment per Q3: prose form normative for non-TS impls; community Go ports invited. Confirms build report at project root (not `site_dir`-equivalent) to avoid CDN upload — same posture as PRD-403 mkdocs `gh-deploy` concern. |
| 2026-05-01 | Jeremy Forsythe | Initial draft. Spec only per decision Q3 (no v0.1 reference implementation; community Go ports invited). Locks the Hugo module integration shape (Go module consumed via `hugo.toml`'s `[module]` block; configuration under `[params.act]`), the wrapper-script integration (`hugo && act-hugo emit`) as the v0.1 build-hook strategy with a documented future direction toward a real Hugo post-build hook, the content-walk behavioral contract (Hugo's content tree → ACT nodes per PRD-201's behavioral reference), the section-hierarchy → `parent` / `children` mapping, the path-derived ID strategy with `_index.md` collapsing, the frontmatter contract (TOML / YAML / JSON; same recognized-key set as PRD-201; Hugo-key interop honored), the i18n handling (Hugo multilingual mode → PRD-104 Pattern 2 default, Pattern 1 opt-in), the ETag derivation in Go (`crypto/sha256` + base64url + JCS), the atomic-write contract (tmp + `os.Rename`), the conformance-level computation rule (observed emissions, not configuration claims), the capability-flag emission rule (advertised iff observed), the build-report sidecar at `./.act-build-report.json` (outside `public/` to avoid CDN upload), and the Stage 1 adapter pinning enforcement. Cites PRD-400-R33 (spec-only treatment) prominently in the Engineering preamble Problem section AND at the start of Implementation notes; the prose form of every requirement is normative for Hugo modules, and the Go snippets are illustrative. Test-fixture corpus enumerated under `fixtures/402/positive/` and `fixtures/402/negative/`; equivalence with `fixtures/400/` corpus asserted; no fixture files created. No new JSON Schemas; Hugo modules emit per PRD-100. Cites PRD-100 (Accepted), PRD-103 (Accepted), PRD-104 (Accepted), PRD-105 (Accepted), PRD-107 (Accepted), PRD-108 (Accepted), PRD-109 (Accepted), PRD-200 (In review, behavioral reference), PRD-201 (In review, behavioral reference), PRD-400 (In review, parent framework), and decision Q3. Status: Draft (spec only) → In review (spec only). |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
