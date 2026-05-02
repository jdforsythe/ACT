# PRD-403 — MkDocs plugin (spec only)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

**Spec only — no v0.1 reference implementation per decision Q3.** MkDocs (Python) is one of the four ecosystems explicitly downgraded to spec-only in v0.1 per `prd/000-decisions-needed.md` Q3 (TS-only first-party reference impls). PRD-400 (generator architecture, In review) locks the canonical pipeline, the `GeneratorPlugin` interface, the multi-source merge, the conformance-level computation rule, the capability-flag emission rule, the atomic-write contract, the build-hook surface, the build-report sidecar, and the staged adapter-pinning enforcement — all expressed as TypeScript signatures. PRD-400-R33 explicitly carves out spec-only treatment for Hugo and MkDocs: "TS interfaces normative *for TS implementations*; for non-TS, the prose form of each requirement is normative." This PRD is the MkDocs-side application of that carve-out.

MkDocs is the canonical Python documentation generator. Material for MkDocs is the most-deployed docs theme in the Python ecosystem and has substantial reach into Go, Rust, and polyglot project docs that prefer not to run a JavaScript build. Without an authoritative spec for what an MkDocs plugin satisfying PRD-400 must do, three failure modes appear: (1) community implementers reinvent the contract — file-walk rules, frontmatter-key recognition, ID derivation, atomic-write semantics, build-report shape — and produce divergent output; (2) PRD-700-series cannot reasonably gate a Python-stack docs example because there is no normative target; (3) PRD-600 (validator) probes byte-level output but cannot tell a community MkDocs port from a hostile fork without a normative reference for what conformant MkDocs output looks like.

PRD-100 (Accepted) defines the wire-format envelopes the MkDocs plugin must emit. PRD-103 (Accepted) defines the ETag derivation. PRD-104 (Accepted) defines the i18n locale layout. PRD-105 (Accepted) defines the static delivery profile (the only profile a MkDocs build targets). PRD-107 (Accepted) defines the conformance levels. PRD-108 (Accepted) defines the version-pinning regime. PRD-109 (Accepted) defines the project-wide threat model. PRD-200 (In review) defines the adapter framework — MkDocs's own content-walk plays the role of the markdown adapter (PRD-201) here, since MkDocs's `Files` collection and Markdown rendering pipeline already perform what `act-markdown` does in the TS pipeline. PRD-400 (In review) is the parent contract this PRD inherits in full. **PRD-600 validates output bytes; the validator is implementation-language-agnostic. A conformant MkDocs plugin passes the same `fixtures/400/` corpus a conformant Astro plugin passes.**

### Goals

1. State that PRD-403 is **spec only** for v0.1 per decision Q3 — no first-party MkDocs plugin ships in v0.1; community ports are invited.
2. Apply PRD-400's contract to MkDocs's plugin model in framework-agnostic prose, with idiomatic Python snippets that **demonstrate equivalence**, not normativity-by-syntax.
3. Lock the **integration shape**: a PyPI package (e.g., `act-mkdocs`), configured in `mkdocs.yml`'s `plugins:` list. The plugin ships a `mkdocs.plugins` entry point and a configuration schema satisfying MkDocs's `BasePlugin` `config_scheme`.
4. Lock the **lifecycle hook strategy**: the canonical pipeline runs at `on_post_build` — MkDocs's documented post-write hook. Auxiliary hooks (`on_files`, `on_nav`, `on_config`) are used only for read-only inspection of MkDocs's resolved state to populate the build inputs.
5. Lock the **content-source mapping**: Markdown in MkDocs's resolved `docs_dir` (default `docs/`) maps to ACT nodes per PRD-201's behavioral contract; MkDocs's `nav` configuration (or computed nav when `nav` is absent) maps to ACT `parent`/`children` per PRD-100; permalinks (the resolved page URL) inform `metadata.canonical_url`.
6. Lock the **frontmatter contract**: MkDocs's YAML front matter is recognized; the same key set PRD-201-R4 recognizes (`id`, `title`, `summary`, `summary_source`, `type`, `tags`, `parent`, `related`, `metadata.*`) is normative here, plus interop with MkDocs Material's existing meta keys (`description`, `tags`, `hide`, `template`).
7. Lock the **i18n handling**: `mkdocs-static-i18n` is the de facto i18n plugin. When configured, the ACT plugin consumes its per-locale `Files` collections and emits per-locale ACT trees per PRD-104 Pattern 1 or Pattern 2.
8. Lock the **search interop**: MkDocs's bundled `search` plugin produces a `search_index.json`; when present, the ACT plugin MAY advertise `search_url_template` and emit a static-search wrapper consumer-side per PRD-105-R7a Pattern (a). When absent, the plugin MUST omit `search_url_template`.
9. Lock the **conformance bands**: Core by default; Standard when subtree files are emitted; Plus when NDJSON index and/or search are emitted. Per PRD-400-R17, the achieved level is computed from observed emissions, not from configuration claims.
10. Specify the **failure surface**: build errors raise from the plugin (MkDocs surfaces non-zero exit); build warnings flow through MkDocs's `logging` integration AND through the build report at `<site_dir>/.act-build-report.json` (with the same exclude-from-deploy concern PRD-402 documents for Hugo's `public/`).
11. Cite **PRD-400-R33** prominently: framework-agnostic prose is normative; Python snippets are illustrative.

### Non-goals

1. **Shipping a first-party MkDocs plugin in v0.1.** Decision Q3 downgrades PRD-403 to spec only.
2. **Defining a MkDocs-specific extension to the wire format.** PRD-100 (Accepted) is the wire format; PRD-403 emits PRD-100 envelopes verbatim.
3. **Defining the markdown adapter contract.** Owned by PRD-201 (In review). PRD-403 inherits PRD-201's behavioral contract for markdown content; the plugin's content-walk plays the role of the adapter rather than invoking `act-markdown` (which is TS-only).
4. **Defining the static delivery profile.** Owned by PRD-105 (Accepted).
5. **Defining ETag derivation.** Owned by PRD-103 (Accepted). The plugin implements PRD-103-R4 (static recipe) in Python.
6. **Defining the i18n manifest layout.** Owned by PRD-104 (Accepted).
7. **Defining the component contract.** Owned by PRD-300 (In review). MkDocs has no React-style component model; PRD-403 does not invoke component bindings.
8. **Defining the validator.** Owned by PRD-600 (In review).
9. **Authoring the threat model.** Owned by PRD-109 (Accepted).
10. **Defining new JSON Schemas.** PRD-403 emits per PRD-100's existing schemas.
11. **Specifying a Python runtime ACT server.** PRD-503 (FastAPI, also spec-only per Q3) covers that branch.

### Stakeholders / audience

- **Authors of:** Community MkDocs plugin implementers (Python developers who want to ship `act-mkdocs` against this spec).
- **Consumers of (upstream):** PRD-400 (parent), PRD-201 (behavioral reference), PRD-100, PRD-103, PRD-104, PRD-105, PRD-107, PRD-108, PRD-109.
- **Consumers of (downstream):** PRD-600 (validator) — runs against MkDocs plugin output.
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Community MkDocs ports diverge because the spec is prose, not code. | High | Medium | PRD-600 validates byte-level output; any port producing byte-equivalent output to the TS reference fixtures is conformant. PRD-403-R20 requires every port to publish a self-test against `fixtures/400/positive/` and `fixtures/403/positive/`. |
| MkDocs's `on_post_build` runs after `site_dir` is fully written; an in-place mutation pattern could race a deploy step. | Medium | Medium | PRD-403-R5 requires atomic writes via `os.replace` (POSIX atomic, Windows MoveFileEx semantics). PRD-403-R6 forbids modifying any file outside the ACT-owned subtree (`<site_dir>/.well-known/`, `<site_dir>/act/`, `<site_dir>/.act-build-report.json`). |
| The build report at `<site_dir>/.act-build-report.json` gets uploaded to the deployment target. | High | Low | PRD-403-R23 requires either (a) emitting the build report outside `site_dir` (e.g., `./.act-build-report.json` at the project root, mirroring PRD-400-R27's local-only intent), or (b) writing a `.gitignore`-style hint and documenting deploy-step exclusion. Default is (a). |
| MkDocs's `nav` configuration can omit pages or include external URLs; mapping to `parent`/`children` is ambiguous. | Medium | Medium | PRD-403-R10 specifies the precedence: explicit `nav:` entries form the parent/children tree; pages absent from `nav:` become orphan top-level children of the root; external URL entries are ignored for ACT (they have no source content). |
| `mkdocs-static-i18n` has multiple operating modes (folder structure vs suffix structure); mapping to PRD-104 patterns is mode-dependent. | Medium | Medium | PRD-403-R13 documents both modes. Folder mode (`docs/{en,fr}/...`) maps naturally to Pattern 2 (per-locale manifests); suffix mode (`page.en.md`, `page.fr.md`) MAY also map to Pattern 2 by synthesizing per-locale `Files` views. Pattern 1 is opt-in. |
| Plugin dependency on Python typing or yaml libraries differs across user environments. | Low | Low | PRD-403-R3 requires only Python ≥ 3.9 and `mkdocs >= 1.5`. JSON serialization uses the stdlib; YAML parsing reuses MkDocs's parsed config. |
| MkDocs plugin ordering matters — running before `mkdocs-static-i18n` produces single-locale output even when i18n is configured. | High | High | PRD-403-R13 requires the plugin to declare a documented load-order constraint: it MUST load after `mkdocs-static-i18n`, after `search`, and after `mkdocs-material/blog` (which produces dynamic pages). The plugin SHOULD detect mis-ordering and emit a build error. |
| MkDocs renders Markdown to HTML; ACT wants source Markdown for the `markdown` block. | High | Medium | PRD-403-R12 requires the plugin to consume the source Markdown (the `Page.markdown` attribute MkDocs exposes pre-render), not the rendered HTML. |
| Python supply-chain risk via PyPI. | Low | High | PRD-403's Security section cites PRD-109; PyPI integrity is the operator's responsibility. PRD-403 introduces no new attack surface beyond MkDocs itself. |

### Open questions

1. ~~Should the plugin honor MkDocs's `site_url` for `metadata.canonical_url`?~~ **Resolved (2026-05-01): Yes.** MkDocs's `site_url + Page.url` is the canonical URL pattern; honor host idiom (heuristic 4). Already covered by PRD-403's mapping rules. (Closes Open Question 1.)
2. ~~Should the plugin consume MkDocs's auto-generated nav when `nav:` is absent in `mkdocs.yml`?~~ **Resolved (2026-05-01): Yes.** MkDocs's default nav is filename-ordered and cleanly maps to ACT children; covered by PRD-403-R10. (Closes Open Question 2.)
3. ~~Should the plugin support the MkDocs Material `meta.tags` plugin's tag aggregation pages?~~ **Resolved (2026-05-01): No (v0.1).** Tag aggregation pages are derived, not source content; ACT treats their child references via the source pages. "Prefer minimalism" (heuristic 1). (Closes Open Question 3.)
4. ~~Should the plugin emit per-section `_index.json` analogues for Material's section landing pages?~~ **Resolved (2026-05-01): No.** ACT's parent node carries section identity; MkDocs's section pages are parents in `parent`/`children`. (Closes Open Question 4.)
5. ~~Should the plugin attempt to detect template-driven content (e.g., `mkdocs-macros-plugin` outputs)?~~ **Resolved (2026-05-01): No (v0.1).** Template expansion is out of band; the plugin reads source markdown only. Defer to v0.2 / community contribution. (Closes Open Question 5.)

### Acceptance criteria

- [ ] Status `In review` is set; changelog entry dated 2026-05-01 by Jeremy Forsythe is present.
- [ ] Every normative requirement has an ID `PRD-403-R{n}` and a declared conformance level per PRD-107.
- [ ] The Specification opens with a table mapping every requirement to PRD-400 + PRD-200 + 100-series requirements implemented.
- [ ] PRD-400-R33 (spec-only treatment) is cited explicitly in the Engineering preamble Problem section AND at the start of Implementation notes.
- [ ] The "spec only — no v0.1 reference implementation per Q3" note appears prominently in the preamble Problem section AND at the start of Implementation notes.
- [ ] Implementation notes ship 3–5 idiomatic Python snippets (NOT TypeScript) demonstrating equivalence.
- [ ] The `on_post_build` integration is pinned with a documented load-order constraint relative to `search` and `mkdocs-static-i18n`.
- [ ] Content-source mapping (`docs/` + `nav:` → ACT nodes) is pinned with a worked example.
- [ ] Frontmatter handling (YAML) is pinned with the recognized-key set.
- [ ] i18n handling (`mkdocs-static-i18n` → PRD-104 Pattern 1 or 2) is pinned.
- [ ] Conformance bands described conceptually with the observed-emission rule.
- [ ] Test-fixture path layout under `fixtures/403/positive/` and `fixtures/403/negative/` is enumerated; equivalence with `fixtures/400/` is asserted.
- [ ] Versioning & compatibility section classifies every kind of change to PRD-403.
- [ ] Security section cites PRD-109 and documents MkDocs-specific deltas.
- [ ] No new JSON Schemas are introduced.

---

## Context & dependencies

### Depends on

- **PRD-100** (Accepted) — wire-format envelopes.
- **PRD-103** (Accepted) — ETag derivation. Plugin implements PRD-103-R4 (static recipe) in Python via `hashlib.sha256` + `base64.urlsafe_b64encode`.
- **PRD-104** (Accepted) — i18n.
- **PRD-105** (Accepted) — static delivery profile.
- **PRD-107** (Accepted) — conformance levels.
- **PRD-108** (Accepted) — versioning policy. Plugin honors Stage 1 adapter pinning per PRD-200-R25.
- **PRD-109** (Accepted) — security posture.
- **PRD-200** (In review) — adapter framework. The plugin's content-walk plays the role of the adapter.
- **PRD-201** (In review) — markdown adapter (behavioral reference). MkDocs's `Page.markdown` and `Page.meta` are the inputs the plugin processes per PRD-201's frontmatter / body / summary rules.
- **PRD-400** (In review) — generator architecture (parent). PRD-400-R33 carves out spec-only treatment for non-TS implementations.
- **000-governance** (Accepted).
- **000-decisions-needed Q3** — TS-only first-party reference impls; PRD-403 spec only.
- External: [MkDocs plugins](https://www.mkdocs.org/dev-guide/plugins/), [MkDocs configuration](https://www.mkdocs.org/user-guide/configuration/), [mkdocs-static-i18n](https://github.com/ultrabug/mkdocs-static-i18n), [PEP 621 packaging](https://peps.python.org/pep-0621/), [Python `os.replace`](https://docs.python.org/3/library/os.html#os.replace), [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174).

### Blocks

- None directly. PRD-403 unblocks community Python-ecosystem docs adoption but does not gate any 700-series PRD in v0.1.

### References

- v0.1 draft: §7 (build integration), §6.1–§6.4 (markdown / frontmatter / ID strategies — superseded by PRD-201 for behavioral reference).
- `prd/000-decisions-needed.md` Q3.
- Prior art: [MkDocs plugin lifecycle](https://www.mkdocs.org/dev-guide/plugins/#events), Hugo module pattern (PRD-402) for spec-only carve-out structure.

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords as clarified by RFC 8174.

### PRD-400 + PRD-200 + 100-series requirements implemented

The table below maps every PRD-403 requirement to the upstream requirement(s) it implements or relies on. PRD-403 inherits PRD-400 in full per **PRD-400-R33** (spec-only treatment).

| PRD-403 requirement | Upstream requirement(s) implemented or consumed | Relationship |
|---|---|---|
| R1 (spec-only treatment, Q3) | PRD-400-R33, decision Q3 | Pins the spec-only stance for v0.1; community ports invited. |
| R2 (canonical pipeline mapping) | PRD-400-R1, R2 | Plugin honors the pipeline order in Python. |
| R3 (PyPI plugin integration shape) | PRD-400-R3 (analog of `GeneratorPlugin`) | PyPI package; consumed via `mkdocs.yml` `plugins:`. |
| R4 (configuration surface) | PRD-400-R31 (`GeneratorConfig`) | Plugin's `config_scheme` mirrors `GeneratorConfig` fields. |
| R5 (lifecycle hook strategy: `on_post_build`) | PRD-400-R24 (build hooks) | Pipeline runs in `on_post_build`; `on_files` / `on_nav` / `on_config` are read-only inspections. |
| R6 (write boundary discipline) | PRD-400-R23 (atomic) | Plugin only writes within ACT-owned subtrees; never mutates MkDocs-owned paths. |
| R7 (content-walk behavioral contract) | PRD-201 (behavioral reference), PRD-200-R5 | MkDocs's resolved `Files` collection walked per PRD-201's rules in Python. |
| R8 (ID derivation from page src_path) | PRD-100-R10, PRD-100-R14, PRD-201-R8 | Path-derived ID with `index.md` collapsing, extension stripping, lowercase. |
| R9 (YAML frontmatter recognition) | PRD-201-R3, R4 | `Page.meta` parsed by MkDocs; plugin reads recognized-key set. |
| R10 (`nav:` config → ACT parent/children) | PRD-100-R24, R25 | Explicit `nav:` entries form the tree; absent pages become root children. |
| R11 (canonical URL from `site_url` + `Page.url`) | PRD-100-R22 (`metadata` open) | URLs emitted as `metadata.canonical_url`. |
| R12 (body-to-block mapping coarse vs fine) | PRD-201-R12, PRD-102-R1, R2, R3, R4, R5 | Default coarse `markdown` block from `Page.markdown`; opt-in fine-grained mode. |
| R13 (i18n: `mkdocs-static-i18n` → Pattern 1 or 2) | PRD-400-R14, R15, R16, PRD-104-R5, R6, R7 | Per-locale `Files` views map to PRD-104 Pattern 2 default; Pattern 1 opt-in. |
| R14 (file-set emission) | PRD-400-R9, R10, R11, R12, R13, PRD-105-R1–R7a | Plugin writes the static file set parameterized by conformance target. |
| R15 (ETag derivation in Python) | PRD-400-R8, PRD-103-R4 | Plugin implements the static recipe via `hashlib.sha256` + `base64.urlsafe_b64encode`. |
| R16 (atomic writes via `os.replace`) | PRD-400-R23, PRD-105-R12 | Tmp-then-replace pattern; no half-written files. |
| R17 (conformance-level computation from observed emissions) | PRD-400-R17, PRD-107-R6, R8, R10 | Achieved level computed from emitted files. |
| R18 (capability-flag emission) | PRD-400-R18, PRD-200-R23 | Advertised iff observed. |
| R19 (build-report sidecar) | PRD-400-R27 | Plugin writes the build report; same schema as TS reference. |
| R20 (test-fixture conformance) | PRD-400-R28 | MkDocs plugin MUST pass `fixtures/400/` and `fixtures/403/`. |
| R21 (load-order constraint) | PRD-400-R24 | Plugin MUST load after `mkdocs-static-i18n`, `search`, and other content-mutating plugins. |
| R22 (Stage 1 adapter pinning) | PRD-400-R29, PRD-200-R25, PRD-108-R14 | Plugin emits `act_version: "0.1"` only in v0.1. |
| R23 (build-report path outside `site_dir`) | PRD-400-R27 | Build report at project root by default to avoid CDN upload. |
| R24 (MkDocs-specific reserved keys interop) | PRD-201-R6 | MkDocs Material's `description`, `tags`, `hide`, `template` honored without conflicting with framework-reserved keys. |
| R25 (search interop with MkDocs `search`) | PRD-105-R7a, PRD-107-R10 | Plugin MAY advertise `search_url_template` when MkDocs `search` plugin produces `search_index.json` and a static-search wrapper is emitted. |
| R26 (no component-contract seam in v0.1) | PRD-300-N/A | MkDocs has no component model; future v0.2 may consider macros. |

### Conformance level

Per PRD-107, every requirement in PRD-403 belongs to one of the conformance bands. Achieved level is computed from observed emissions per PRD-400-R17.

- **Core:** PRD-403-R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R12 (coarse mode), R14 (Core file set), R15, R16, R17, R18, R19, R20, R21, R22, R23, R24, R26.
- **Standard:** PRD-403-R12 (fine-grained mode), R14 (subtree files; Standard additive).
- **Plus:** PRD-403-R13 (i18n; Plus per PRD-107-R10), R14 (NDJSON index; Plus additive), R25 (search advertisement).

A plugin targeting Plus satisfies Standard and Core by additivity (PRD-107-R11).

### Normative requirements

#### Spec-only treatment (Q3)

**PRD-403-R1.** **(Core)** PRD-403 is a spec-only PRD per decision Q3; no first-party MkDocs plugin ships in v0.1. A community MkDocs plugin written in Python MUST satisfy every requirement in this PRD's Specification section, expressed in equivalent terms. PRD-400-R33 governs the broader spec-only carve-out: TypeScript signatures in PRD-400 are normative for TS implementations only; for MkDocs plugins, the prose form of each requirement is normative, and the Python snippets in §"Implementation notes" are illustrative. PRD-600 validates output bytes; the validator is implementation-language-agnostic.

#### Canonical pipeline mapping (consumes PRD-400-R1 / R2)

**PRD-403-R2.** **(Core)** A MkDocs plugin implementing PRD-403 MUST execute the canonical pipeline order (PRD-400-R1) in equivalent Python terms:

1. **Discover sources.** The plugin reads its configuration from `mkdocs.yml`'s `plugins:` entry and resolves MkDocs's `Files` collection at `on_post_build` time.
2. **Run adapters.** The plugin's content-walk plays the role of the adapter (PRD-201's behavioral contract applied to `Page.markdown` + `Page.meta`). For every Markdown page, the plugin parses front matter, derives the ID, maps body to blocks, derives the summary, and constructs an ACT node.
3. **Run component extractors.** Skipped — MkDocs has no React-style component model.
4. **Merge.** Skipped — single-source build (MkDocs's `Files` is the only source).
5. **Normalize / validate.** The plugin validates every emitted envelope against PRD-100's schemas using `jsonschema` or equivalent.
6. **Compute ETags.** The plugin runs PRD-103-R4 (static recipe) over every envelope's payload-minus-`etag` and writes the result.
7. **Emit files.** The plugin writes the static file set per PRD-105's directory layout via atomic writes (PRD-403-R16).

The pipeline order MUST NOT be reordered, interleaved, or have stages skipped that apply at the configured conformance target.

#### MkDocs plugin integration shape

**PRD-403-R3.** **(Core)** A MkDocs plugin implementing PRD-403 MUST be published as a PyPI package (the canonical name is `act-mkdocs`; community ports MAY use other names). The package MUST register a `mkdocs.plugins` entry point (e.g., `act = act_mkdocs.plugin:ActPlugin`). Operators consume the plugin by adding it to `mkdocs.yml`'s `plugins:` list:

```yaml
plugins:
  - search
  - i18n:
      docs_structure: folder
      languages: [{ locale: en, default: true }, { locale: fr }]
  - act:
      conformance_target: standard
      output_dir: site
```

The plugin class MUST inherit from `mkdocs.plugins.BasePlugin` and declare a `config_scheme` mirroring PRD-400-R31's `GeneratorConfig` fields.

**PRD-403-R4.** **(Core)** The plugin's `config_scheme` MUST satisfy PRD-400-R31's `GeneratorConfig` minimum, with MkDocs-specific defaults applied at `on_config`:

- `conformance_target` (default `"core"`; one of `"core" | "standard" | "plus"`).
- `i18n` (object; `enabled`, `pattern: "1" | "2"`; defaults `enabled=auto`, `pattern="2"`).
- `output_dir` (default MkDocs's resolved `site_dir`).
- `fail_on_extraction_error` (default `False`; per PRD-400-R26).
- `build_report_path` (default `./.act-build-report.json` at project root, NOT inside `site_dir`; per PRD-403-R23).
- `id_strategy` (default `"path"`; opt-in `"frontmatter"` for explicit `id:` keys per PRD-100-R14).

#### Lifecycle hooks (PRD-400-R24)

**PRD-403-R5.** **(Core)** The plugin MUST register the following MkDocs lifecycle hooks:

- `on_config(config)`: validate the plugin's own config; surface any version-pinning conflicts (PRD-403-R22) before any other hook runs.
- `on_files(files, config)`: capture a read-only reference to the resolved `Files` collection. The plugin MUST NOT mutate `files` here.
- `on_nav(nav, config, files)`: capture a read-only reference to the resolved nav tree. The plugin MUST NOT mutate `nav` here.
- `on_page_markdown(markdown, page, config, files)`: optional; used to capture `page.markdown` per page if the plugin's load-order would otherwise cause it to read post-render HTML.
- `on_post_build(config)`: invoke the canonical pipeline (PRD-400-R1) using the captured files / nav / per-page markdown, validate envelopes, derive ETags, and write the static file set atomically.

The pipeline MUST run exclusively in `on_post_build`. The plugin MUST NOT write any ACT-owned file in any earlier hook.

**PRD-403-R6.** **(Core)** The plugin MUST NOT modify any file outside the ACT-owned subtree under `<site_dir>`. ACT-owned paths are: `<site_dir>/.well-known/act.json`, `<site_dir>/act/**`, `<site_dir>/<index_url>`, and (only when `build_report_path` is unset and the operator opts in) `<site_dir>/.act-build-report.json`. The plugin MUST NOT alter MkDocs-owned HTML, asset, or theme files. Any `os.write`-class call outside the ACT-owned path set is a conformance violation.

#### Content-source mapping (consumes PRD-201, PRD-100)

**PRD-403-R7.** **(Core)** The plugin MUST walk MkDocs's resolved `Files` collection. For each `File` whose `is_documentation_page()` is `True` AND whose `Page.markdown` attribute is non-empty post-`on_page_markdown`, the plugin constructs one ACT node by applying PRD-201's behavioral contract: parse front matter, derive ID, map body to blocks, derive summary, validate against `schemas/100/node.schema.json`. Pages excluded from MkDocs's nav (`hide: true` in front matter) MAY be either included (as orphans of the root) or skipped per the plugin's `include_hidden` config (default `False`). External-URL nav entries MUST be skipped — they have no source content.

**PRD-403-R8.** **(Core)** The plugin MUST derive node IDs from each page's `src_path` (the path relative to `docs_dir`):

1. Strip the `.md` extension.
2. Lowercase the path.
3. Collapse `index` to its parent directory (`getting-started/index` → `getting-started`).
4. Replace any non-conforming character per PRD-100-R10 grammar (lowercase ASCII, digits, `.`, `_`, `-`, `/`).

Front matter MAY override via an explicit `id:` key per PRD-100-R14 / PRD-201-R8 when the plugin's `id_strategy` is `"frontmatter"`. The framework-derived ID is the default; the explicit override wins per PRD-200-R11.

**PRD-403-R9.** **(Core)** The plugin MUST recognize MkDocs's YAML front matter (the `Page.meta` attribute that MkDocs parses). The recognized-key set is PRD-201-R4's: `id`, `title`, `summary`, `summary_source`, `type`, `tags`, `parent`, `related`, `metadata.*`. Unknown keys are tolerated (not an error). Conflicts with framework-reserved keys (`metadata.source`, `metadata.locale`, `metadata.translations`, `metadata.extraction_status`, `metadata.extracted_via`) MUST surface a build error per PRD-201-R6.

**PRD-403-R10.** **(Core)** The plugin MUST construct ACT `parent`/`children` from MkDocs's resolved nav tree (`on_nav`). Mapping rules:

1. Each MkDocs `Section` becomes a node only if a corresponding `index.md` (or `_index.md` per Material conventions) exists in `docs_dir`; otherwise the section is a virtual grouping that contributes `children` to the closest existing parent.
2. Each MkDocs `Page` is a node; its `parent` is the nearest enclosing `Section` with a backing `index.md`, or the root node when none exists.
3. Pages absent from the resolved nav (orphans) become children of the root node, in `Files`-iteration order.
4. External-URL nav entries (`Link` items) are ignored — no ACT node is emitted.

The plugin MUST detect cycles (a page declaring `parent: X` in front matter where X transitively claims this page as a child) and surface a build error per PRD-100-R25.

**PRD-403-R11.** **(Core)** The plugin SHOULD populate `metadata.canonical_url` for every emitted node by joining MkDocs's resolved `site_url` with `Page.url`. When `site_url` is unset, the plugin SHOULD omit `metadata.canonical_url` and surface a build warning recommending `site_url` configuration.

**PRD-403-R12.** **(Core for coarse, Standard for fine-grained)** The plugin MUST consume each page's source Markdown (`Page.markdown` post-`on_page_markdown`). The default body-to-block strategy is coarse: emit a single `markdown` block whose payload is the page's source markdown verbatim, per PRD-201-R12. Opt-in fine-grained mode (`block_strategy: "fine"`) splits the markdown into structural blocks per PRD-102-R1 / R2 / R3 / R4 / R5; this mode is Standard-band per PRD-107-R8. The plugin MUST NOT use the rendered HTML — the rendered form is theme-dependent, and ACT consumers expect source Markdown.

#### i18n (consumes PRD-104, PRD-400-R14 / R15 / R16)

**PRD-403-R13.** **(Plus)** When the operator's `mkdocs.yml` includes the `mkdocs-static-i18n` plugin AND the ACT plugin's `i18n.enabled` resolves to `True`, the plugin MUST emit per-locale ACT trees per PRD-104. The default emission pattern is **Pattern 2** (per-locale manifests at `/{locale}/.well-known/act.json`); Pattern 1 (locale-prefixed IDs in a single manifest) is opt-in via `i18n.pattern: "1"`. The plugin MUST consume `mkdocs-static-i18n`'s per-locale `Files` views; it MUST NOT re-walk `docs_dir` directly. Two operating modes are supported:

- **Folder mode** (`docs_structure: folder`; `docs/{en,fr}/...`): each locale's `Files` view maps to one per-locale ACT tree.
- **Suffix mode** (`docs_structure: suffix`; `page.en.md`, `page.fr.md`): the plugin synthesizes per-locale views from `mkdocs-static-i18n`'s reconciled file set.

Per PRD-400-R14, the plugin MUST NOT mix Pattern 1 and Pattern 2 within a single build.

#### File-set emission and atomic writes (consumes PRD-400-R9 / R23, PRD-105)

**PRD-403-R14.** **(Core / Standard / Plus parameterized)** The plugin MUST emit the static file set per PRD-105 layout into the resolved `output_dir` (default MkDocs's `site_dir`):

- `<output_dir>/.well-known/act.json` (manifest; Core).
- `<output_dir>/act/index.json` (index; Core).
- `<output_dir>/act/<id>.json` (per node; Core).
- `<output_dir>/act/subtree/<id>.json` (Standard, when subtree advertised).
- `<output_dir>/act/index.ndjson` (Plus, when NDJSON advertised).

The on-disk extension MAY be `.act.json` per PRD-105-R9; the URL path is what matters per PRD-105-R8.

**PRD-403-R15.** **(Core)** The plugin MUST implement PRD-103-R4 (static ETag recipe) using Python stdlib: JCS-canonical JSON encoding (community library `jsoncanon` or equivalent — implementer's choice) of the envelope's payload-minus-`etag`, `hashlib.sha256` of the canonical bytes, `base64.urlsafe_b64encode` no padding, truncated to 22 chars, prefixed `s256:`.

**PRD-403-R16.** **(Core)** The plugin MUST write each output file atomically: write to a temporary path adjacent to the target (e.g., `intro.json.tmp.<pid>`), `os.fsync`, then `os.replace` to the final path. `os.replace` is atomic on POSIX and uses `MoveFileEx` with `MOVEFILE_REPLACE_EXISTING` semantics on Windows. The plugin MUST NOT leave a half-written file even if the build is interrupted.

#### Conformance-level computation and capabilities (consumes PRD-400-R17 / R18)

**PRD-403-R17.** **(Core)** The plugin MUST compute the manifest's `conformance.level` from observed artifacts (PRD-400-R17): set to `"plus"` only if NDJSON index AND search advertisement (when applicable) AND i18n requirements are emitted; set to `"standard"` if subtree files are emitted but Plus emissions are not; otherwise `"core"`. The plugin MUST NOT inflate the level beyond observed emissions.

**PRD-403-R18.** **(Core)** The plugin MUST populate the manifest's `capabilities` object based on observed emissions (PRD-400-R18), not on configuration alone: `capabilities.subtree = true` iff subtree files exist, `capabilities.ndjson_index = true` iff `index.ndjson` exists, `capabilities.search.template_advertised = true` iff `search_url_template` is set per PRD-403-R25.

#### Build report sidecar (consumes PRD-400-R27)

**PRD-403-R19.** **(Standard)** The plugin MUST write a build report sidecar at the configured `build_report_path` (default `./.act-build-report.json` at project root). The report enumerates every emitted file, every warning, every error, the configured target level, the achieved level, and the build duration, per PRD-400-R27's schema. The report MUST NOT be uploaded to a CDN.

**PRD-403-R23.** **(Standard)** The plugin's default `build_report_path` is OUTSIDE `site_dir` (project root) to avoid accidental upload via `mkdocs gh-deploy` or equivalent. When the operator overrides `build_report_path` to point inside `site_dir`, the plugin MUST surface a build warning recommending the report be excluded from deploy.

#### Test-fixture conformance and adapter pinning

**PRD-403-R20.** **(Core)** A MkDocs plugin implementing PRD-403 MUST pass the framework conformance fixture corpora at `fixtures/400/positive/` and `fixtures/403/positive/`, producing byte-equivalent output (modulo `generated_at` timestamps) to the TS reference. Negative fixtures under `fixtures/400/negative/` and `fixtures/403/negative/` MUST surface the documented error or warning.

**PRD-403-R21.** **(Core)** The plugin MUST declare a documented load-order constraint in its README: it MUST load AFTER `mkdocs-static-i18n`, AFTER `search`, and AFTER any plugin that mutates `Page.markdown` or `Files` at a later stage. The plugin SHOULD detect mis-ordering at `on_config` (e.g., by inspecting the `config["plugins"]` list ordering) and surface a build error before the build proceeds.

**PRD-403-R22.** **(Core)** The plugin MUST honor Stage 1 adapter pinning per PRD-400-R29 / PRD-200-R25 / PRD-108-R14: a v0.1 plugin emits `act_version: "0.1"` only and MUST refuse to run if the build's target `act_version` differs.

**PRD-403-R24.** **(Core)** MkDocs Material's reserved front-matter keys (`description`, `tags`, `hide`, `template`) MUST be honored without conflicting with ACT framework-reserved keys per PRD-201-R6. Specifically: Material's `description` MAY map to ACT's `summary` when the front matter does not set `summary` explicitly (with `summary_source: "frontmatter"`).

#### Search interop

**PRD-403-R25.** **(Plus)** When the operator's `mkdocs.yml` includes MkDocs's bundled `search` plugin AND the plugin's `search.advertise` config is `True` (default `False`), the plugin MAY advertise `search_url_template` in the manifest, paired with a static-search wrapper per PRD-105-R7a Pattern (a). The plugin MUST verify `<site_dir>/search/search_index.json` exists before advertising; if absent, the plugin MUST omit `search_url_template`. When advertised, the plugin MUST emit a small static-search wrapper page at `/act/search/?q={query}` that performs client-side filtering against `search_index.json`.

#### No component-contract seam

**PRD-403-R26.** **(Core)** PRD-403 v0.1 does NOT integrate with PRD-300's component contract — MkDocs has no React-style component model. A future v0.2 amendment MAY add a macros (`mkdocs-macros-plugin`) seam if community demand emerges.

### Wire format / interface definition

PRD-403 introduces no new envelopes. The plugin emits PRD-100 envelopes verbatim. The plugin's `config_scheme` is described prosaically below; a Python implementer SHOULD encode it via `mkdocs.config.config_options`:

```
config_scheme = (
    ('conformance_target', config_options.Choice(['core', 'standard', 'plus'], default='core')),
    ('output_dir', config_options.Optional(config_options.Dir(exists=False))),
    ('build_report_path', config_options.Optional(config_options.File(exists=False))),
    ('i18n', config_options.SubConfig(
        ('enabled', config_options.Choice(['auto', True, False], default='auto')),
        ('pattern', config_options.Choice(['1', '2'], default='2')),
    )),
    ('id_strategy', config_options.Choice(['path', 'frontmatter'], default='path')),
    ('block_strategy', config_options.Choice(['coarse', 'fine'], default='coarse')),
    ('fail_on_extraction_error', config_options.Type(bool, default=False)),
    ('search', config_options.SubConfig(
        ('advertise', config_options.Type(bool, default=False)),
    )),
    ('include_hidden', config_options.Type(bool, default=False)),
)
```

### Errors

| Condition | Severity | Notes |
|---|---|---|
| Page front-matter sets a framework-reserved `metadata.*` key | Build error | Per PRD-201-R6 |
| `parent` declared in front matter targets a non-existent ID | Build error | Per PRD-100-R24 |
| `children` cycle detected via `parent`-chain traversal | Build error | Per PRD-100-R25 |
| Schema validation failure on emitted envelope | Build error | Per PRD-400-R21 |
| Plugin loaded BEFORE `mkdocs-static-i18n` or `search` when those are configured | Build error | Per PRD-403-R21 |
| Page absent from nav but present under `docs_dir` (orphan) | Build warning | Becomes child of root |
| `site_url` unset (no canonical URL emitted) | Build warning | Per PRD-403-R11 |
| `search.advertise: True` but no `search_index.json` exists | Build warning | `search_url_template` omitted |
| `act_version` mismatch (Stage 1 pinning) | Build error | Per PRD-403-R22 |
| `build_report_path` inside `site_dir` | Build warning | Per PRD-403-R23 |

---

## Examples

### Example 1 — minimal docs site (Core)

```yaml
# mkdocs.yml
site_name: Example Project
site_url: https://docs.example.com
plugins:
  - search
  - act:
      conformance_target: core
nav:
  - Home: index.md
  - Getting Started: getting-started/index.md
  - API: api/reference.md
```

Source layout:

```
docs/
  index.md
  getting-started/index.md
  api/reference.md
```

Emitted artifacts (under `site/`):

```
site/.well-known/act.json
site/act/index.json
site/act/index-page.json    (id derived from index.md → site root node)
site/act/getting-started.json
site/act/api/reference.json
.act-build-report.json     (project root, per PRD-403-R23)
```

The manifest declares `conformance.level: "core"`, `delivery: "static"`, `act_version: "0.1"`.

### Example 2 — i18n with `mkdocs-static-i18n` (Plus)

```yaml
plugins:
  - search
  - i18n:
      docs_structure: folder
      languages:
        - locale: en
          default: true
        - locale: fr
  - act:
      conformance_target: plus
      i18n:
        enabled: true
        pattern: "2"
```

Emitted (Pattern 2):

```
site/en/.well-known/act.json
site/en/act/index.json + index.ndjson + per-node files + subtree files
site/fr/.well-known/act.json
site/fr/act/index.json + index.ndjson + per-node files + subtree files
```

---

## Test fixtures

PRD-403 fixtures verify behavioral equivalence with PRD-400's TS reference. Files are not created by this PRD; they are enumerated for downstream authoring.

### Positive

- `fixtures/403/positive/minimal-core/` — three pages in `docs/`, no `nav:`; achieved level = `core`.
- `fixtures/403/positive/explicit-nav/` — `nav:` declared; section/page mapping per PRD-403-R10.
- `fixtures/403/positive/frontmatter-id-override/` — explicit `id:` keys win per PRD-403-R8.
- `fixtures/403/positive/i18n-folder-pattern2/` — `mkdocs-static-i18n` folder mode, Pattern 2.
- `fixtures/403/positive/i18n-suffix-pattern2/` — `mkdocs-static-i18n` suffix mode, Pattern 2.
- `fixtures/403/positive/i18n-folder-pattern1/` — folder mode, Pattern 1.
- `fixtures/403/positive/standard-with-subtree/` — Standard band; subtree files emitted.
- `fixtures/403/positive/plus-with-search/` — Plus band; `search_url_template` advertised; static wrapper emitted.
- `fixtures/403/positive/material-meta-interop/` — MkDocs Material's `description` + `tags` honored.
- `fixtures/403/positive/spec-only-equivalence-mkdocs/` — byte-equivalence harness against `fixtures/400/positive/spec-only-equivalence/`.

### Negative

- `fixtures/403/negative/reserved-key-conflict/` — front-matter sets `metadata.source`; build error.
- `fixtures/403/negative/parent-cycle/` — `parent`-chain cycle; build error per PRD-100-R25.
- `fixtures/403/negative/missing-parent/` — `parent: nonexistent`; build error per PRD-100-R24.
- `fixtures/403/negative/load-order-before-i18n/` — `act` loaded before `mkdocs-static-i18n`; build error per PRD-403-R21.
- `fixtures/403/negative/version-mismatch/` — config targets `act_version: "0.2"`; build error per PRD-403-R22.
- `fixtures/403/negative/search-advertise-no-index/` — `search.advertise: true` but no `search_index.json`; build warning AND `search_url_template` omitted.
- `fixtures/403/negative/build-report-inside-site-dir/` — `build_report_path` configured inside `site_dir`; build warning per PRD-403-R23.
- `fixtures/403/negative/non-conforming-id/` — page path produces an ID violating PRD-100-R10 grammar; build error.

---

## Versioning & compatibility

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add an optional `config_scheme` field | MINOR | |
| Add a new opt-in body-to-block strategy | MINOR | |
| Tighten an SHOULD to a MUST | MAJOR | Per PRD-108 |
| Loosen a MUST to a SHOULD | MAJOR | |
| Change the default body-to-block strategy from coarse to fine | MAJOR | Existing builds change output |
| Change `id_strategy` default | MAJOR | IDs would shift |
| Change `build_report_path` default to inside `site_dir` | MAJOR | Deploy implications |
| Move from spec-only to first-party reference impl | MINOR | Adds an implementation; the spec is unchanged |
| Adopt a Hugo/MkDocs upstream-provided post-build hook in lieu of `on_post_build` | MINOR | Plugin shape is internal; output unchanged |

### Forward compatibility

Plugins MUST tolerate unknown optional fields in PRD-100 envelopes per PRD-108-R7. Plugins MUST reject unknown required fields in adapter capabilities (consistent with PRD-200-R3 / R22).

### Backward compatibility

A plugin upgrading from a prior PRD-403 minor MUST emit byte-equivalent output for unchanged source corpora. Source-corpus diffs that would produce divergent IDs (e.g., a default `id_strategy` change) are MAJOR per PRD-108-R5(4).

---

## Security considerations

PRD-109 (Accepted) governs the project-wide threat model. PRD-403 deltas:

- **Build process trust boundary.** MkDocs runs in the operator's build environment with full filesystem access. The plugin MUST NOT exfiltrate content outside `<site_dir>` and the configured `build_report_path`. The plugin MUST NOT make outbound HTTP requests during the pipeline; ACT generation is offline-only.
- **Build report leakage.** `<site_dir>/.act-build-report.json` (when configured inside `site_dir`) WOULD be uploaded by `mkdocs gh-deploy` or any deploy target that mirrors `site_dir`. PRD-403-R23 defaults the report to project root; operators who override MUST exclude the path from deploy.
- **PyPI supply chain.** MkDocs plugins are PyPI packages; integrity is the operator's responsibility (hash pinning, lockfiles). PRD-403 introduces no new attack surface beyond MkDocs itself.
- **Information disclosure.** Static profile only — no auth, no per-identity content. PRD-109's static-profile threat model applies unchanged.
- **DoS / resource bounds.** The plugin MUST NOT recurse unboundedly into nav structures; PRD-403-R10 enforces cycle detection. Subtree depth is bounded per PRD-100-R33.

---

## Implementation notes

**Spec only — no v0.1 reference implementation per Q3.** The Python snippets below are illustrative; behaviour described in normative requirements is the contract; PRD-600 validates output bytes.

PRD-400-R33 governs the carve-out: TypeScript signatures in PRD-400's "Wire format / interface definition" are normative for TS implementations only; for MkDocs plugins, the prose form of each requirement is normative.

### Snippet 1 — plugin class skeleton

```python
from mkdocs.plugins import BasePlugin
from mkdocs.config import config_options

class ActPlugin(BasePlugin):
    config_scheme = (
        ('conformance_target', config_options.Choice(
            ['core', 'standard', 'plus'], default='core')),
        ('output_dir', config_options.Optional(
            config_options.Dir(exists=False))),
        ('build_report_path', config_options.Optional(
            config_options.File(exists=False))),
        # ... (full set per PRD-403-R4)
    )

    def on_config(self, config):
        self._validate_load_order(config)              # PRD-403-R21
        self._validate_act_version_pin(config)          # PRD-403-R22
        return config

    def on_files(self, files, config):
        self._files = files                             # capture only; PRD-403-R5
        return files

    def on_nav(self, nav, config, files):
        self._nav = nav
        return nav

    def on_page_markdown(self, markdown, page, config, files):
        page.act_source_markdown = markdown            # PRD-403-R12
        return markdown

    def on_post_build(self, config):
        run_pipeline(self.config, self._files, self._nav, config)  # PRD-403-R2
```

### Snippet 2 — canonical pipeline (Python equivalent of PRD-400-R1)

```python
def run_pipeline(plugin_config, files, nav, mkdocs_config):
    # 1. Adapter walk (PRD-201 behavioral contract in Python)
    nodes = []
    for file in files.documentation_pages():
        page = file.page
        node = build_node(
            page=page,
            id=derive_id(file.src_path, page.meta, plugin_config),  # PRD-403-R8
            front_matter=page.meta,                                  # PRD-403-R9
            body_markdown=page.act_source_markdown,                  # PRD-403-R12
        )
        nodes.append(node)

    # 2. Build parent/children from nav (PRD-403-R10)
    nodes = wire_parent_children(nodes, nav)

    # 3. Validate envelopes (PRD-400-R21)
    for n in nodes:
        validate_against_schema(n, 'node.schema.json')

    # 4. Compute ETags (PRD-103-R4)
    for n in nodes:
        n['etag'] = compute_static_etag(n)              # PRD-403-R15

    # 5. Emit files atomically (PRD-403-R14, R16)
    output_dir = resolve_output_dir(plugin_config, mkdocs_config)
    write_atomically(f'{output_dir}/.well-known/act.json', build_manifest(nodes))
    write_atomically(f'{output_dir}/act/index.json', build_index(nodes))
    for n in nodes:
        write_atomically(f'{output_dir}/act/{n["id"]}.json', n)

    # 6. Build report sidecar (PRD-403-R19, R23)
    write_build_report(plugin_config['build_report_path'], ...)
```

### Snippet 3 — static ETag derivation (PRD-103-R4 in Python)

```python
import hashlib, base64
import jsoncanon  # third-party JCS library

def compute_static_etag(envelope: dict) -> str:
    payload = {k: v for k, v in envelope.items() if k != 'etag'}
    canonical = jsoncanon.canonicalize(payload)         # JCS bytes
    digest = hashlib.sha256(canonical).digest()
    b64 = base64.urlsafe_b64encode(digest).decode('ascii').rstrip('=')
    return f's256:{b64[:22]}'                            # 22-char truncation
```

### Snippet 4 — atomic write (PRD-403-R16)

```python
import os, json
from pathlib import Path

def write_atomically(target: str, data: dict) -> None:
    p = Path(target)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(p.suffix + f'.tmp.{os.getpid()}')
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, p)                                   # atomic POSIX/Windows
```

### Snippet 5 — load-order detection (PRD-403-R21)

```python
def _validate_load_order(self, config):
    plugins = list(config['plugins'].keys())
    act_idx = plugins.index('act')
    for blocker in ('search', 'i18n', 'macros'):
        if blocker in plugins and plugins.index(blocker) > act_idx:
            raise PluginError(
                f"act plugin must load AFTER '{blocker}' "
                f"(per PRD-403-R21). Reorder mkdocs.yml plugins:."
            )
```

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft; status `In review` (spec only). |
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review. Decisions: (Q1) honor `site_url` for `metadata.canonical_url`; (Q2) consume MkDocs auto-nav when `nav:` absent; (Q3) no Material `meta.tags` aggregation page support in v0.1; (Q4) no per-section `_index.json` analogues — ACT's parent node carries section identity; (Q5) no template-driven content (e.g., `mkdocs-macros-plugin`) integration in v0.1 — read source markdown only. Confirms PRD-403-R23 build report defaults to project root (not `site_dir`) to avoid `mkdocs gh-deploy` upload — eliminates a credential-leak vector and matches PRD-400-R27's local-only intent. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
