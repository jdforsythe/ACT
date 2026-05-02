# PRD-601 — Inspector CLI (fetch, walk, diff, token-budget what-ifs)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

PRD-600 (validator) is the conformance gate — it answers "does this site conform to PRD-100/103/106/107?" and emits the verdict shape PRD-107-R16 pins. What it deliberately is not is an **inspection** tool: a developer integrating ACT into their generator, a content-engineering reviewer auditing how an LLM agent would walk a docs site, or an agent author building a runtime that consumes ACT all need a different surface — fetch any envelope, walk the tree to a chosen depth, diff two trees, and ask "if I have a 32K-token context budget and start at root, which subtree fits?" Today none of those exist; the alternative is `curl | jq` recipes that re-derive the discovery walk every time and have no shared notion of "ACT tree."

PRD-601 ships an **inspector CLI** — `act inspect`, `act walk`, `act diff`, `act node`, `act subtree`, `act budget` — plus a programmatic library (`@act/inspector`) exporting the same operations as TypeScript functions. The CLI is **not** a validator (that is PRD-600). It is sibling-tooling: same TS package conventions, same `fetch`-adapter pattern for credentials, same per-origin rate limit, but the output is human-readable summaries and machine-readable JSON / TSV designed for piping, not a conformance verdict. PRD-601 deliberately leaves PRD-600 the conformance gate — when the inspector encounters something that looks broken (e.g., a 404 on a node that the index advertises), it reports it as a finding for the human, but it does not produce a `gaps[]` array against PRD-107's reporter shape. That is PRD-600's job.

The CLI design is shaped by three concrete user journeys.

1. **The integration developer.** "I just wired up the ACT generator for our docs site. Let me see what it produced." — `act inspect https://localhost:4321` prints the manifest, samples 16 nodes, and shows the tree shape. No flags needed; sensible defaults.

2. **The content reviewer.** "Marketing wants to know what an LLM agent sees when it lands on the homepage with a 16K token budget." — `act budget https://acme.example --max-tokens 16000` reports the inclusion order and which subtrees fit.

3. **The CI gate.** "I want my generator's output to be diffable across runs so we catch unintended regressions in node text." — `act diff <prev-build-url> <current-build-url> --json | tee diff.json` produces a structured diff suitable for pasting into a PR comment.

The inspector reuses PRD-600's parser and discovery-walk implementation (sibling `@act/validator` package), so the two tools always stay in lockstep on PRD-101's discovery semantics, PRD-103's ETag rules, and PRD-100's envelope shapes. This sharing is documented in PRD-600's blocks list ("PRD-601 (inspector CLI) — reuses PRD-600's parser, schema bundle, and discovery walk").

### Goals

1. Lock the **CLI surface**: subcommands `inspect`, `walk`, `diff`, `node`, `subtree`, `budget`, plus a top-level `--help`. Each subcommand has a clear contract for inputs, outputs, exit codes, and the relationship to other subcommands.
2. Lock the **programmatic API** (`@act/inspector`): TypeScript functions matching every subcommand, returning structured results (no console output coupling).
3. Lock the **output formats** (per subcommand): human-readable (color, tree-drawing, TTY-aware), JSON (machine-parseable, stable shape), TSV (for piping; column set documented per subcommand).
4. Lock the **auth model**: same as PRD-600. Operator injects credentials via the `fetch` adapter; CLI never authenticates on its own. Document this prominently — the inspector probes whatever the operator points it at, and authentication is the operator's responsibility.
5. Lock the **caching contract**: respect PRD-103 ETags via `If-None-Match` on every fetch; honor a `--no-cache` override for forced revalidation; never cache cross-invocation in v0.1 (no on-disk cache).
6. Lock the **token-budget semantics** for `act budget`: deterministic inclusion order (deepest-first OR breadth-first per a flag), and a clear shape for the budget report (which nodes fit, total tokens, which were excluded).
7. Lock the **diff semantics** for `act diff`: comparison by node `id`; classifies each pair as added / removed / etag-changed / token-changed / structurally-changed (parent reassignment, children rearrangement); emits per-node changes with a stable shape.
8. Specify the **request budget** (max requests per origin, default rate limit) so the inspector does not get blocked by WAFs; matches PRD-600 defaults.
9. Specify the **conformance-level reporting** scope: the inspector reports the manifest's *declared* `conformance.level` and identifies obvious gaps (e.g., level=Plus but `search_url_template` absent), but does **not** produce a PRD-107-shaped report. That is PRD-600's job.
10. Specify **test fixtures** under `fixtures/601/`: sample sites + expected output shapes per subcommand.

### Non-goals

1. **Validation / conformance reporting.** Owned by PRD-600. PRD-601 reports findings to a human; it does not emit a PRD-107 reporter shape.
2. **Wire-format definition.** Owned by PRD-100. PRD-601 ingests `schemas/100/*.schema.json` for parsing.
3. **Discovery flow.** Owned by PRD-101. PRD-601 implements PRD-101-R8 by reusing PRD-600's walk module.
4. **Authentication.** Per PRD-600 / PRD-109, the CLI never authenticates. The operator's `fetch` adapter is the auth boundary.
5. **Shipping a hosted SPA equivalent.** PRD-600 ships a hosted validator SPA (Q8); PRD-601 is CLI-and-library only. A future v0.2 might ship a hosted inspector; v0.1 is silent.
6. **Modifying the producer.** The inspector is read-only. It does not write back to a runtime endpoint, mutate a manifest file, or trigger any side effect on the producer.
7. **Streaming SSE / change feeds.** Out of v0.1 per draft §5.13.6 and PRD-106 non-goal.
8. **Search query workflow.** The inspector's `node`, `subtree`, `walk`, `budget` commands cover content fetch and disclosure. A search-driven `act search` subcommand is deferred to v0.2 alongside Q13 (search response envelope).
9. **Visualization beyond tree-drawing.** No graphviz output, no HTML report. JSON / TSV is the integration target; humans get tree-drawn console output.
10. **The ACT-MCP bridge.** PRD-602.

### Stakeholders / audience

- **Authors of:** integrators wiring ACT into a generator pipeline (PRD-201 / PRD-401 / PRD-405 implementers); content reviewers running token-budget what-ifs; CI scripts diffing tree outputs across builds; the implementation team building PRD-700-series example builds (the inspector is the developer-facing complement to the validator).
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Inspector and validator drift on parser / discovery walk semantics, leading to "the inspector sees the manifest fine but the validator says it's broken" (or vice versa). | Medium | High | PRD-601-R1 mandates that the inspector imports the parser and discovery walk from `@act/validator` (PRD-600's package); the parser is a shared dependency, not duplicated. CI runs both packages' fixture suites against each other on every change to PRD-100 schemas. |
| `act budget` semantics are unclear ("deepest-first" vs "breadth-first" produces wildly different inclusion sets), and operators get inconsistent answers depending on flag default. | High | Medium | PRD-601-R12 defines the two strategies precisely (`--strategy deepest-first` walks the tree by depth-decreasing token-cost-per-bytes; `--strategy breadth-first` walks layer-by-layer). Defaults to `breadth-first` (matches the LLM-agent convention of starting at root and descending). Output declares the strategy used. |
| `act diff` chokes on large trees (10K+ nodes); diff time becomes O(N²) and the CLI hangs. | Medium | Medium | PRD-601-R13 specifies an O(N) diff algorithm: build node-id → entry maps for both trees, walk both maps once, classify each id; structural changes detected by comparing `parent` and `children[]` sorted-id strings. |
| The inspector's request budget (PRD-601-R20) is overly generous for `walk` against a Plus producer (10K nodes), exhausting the operator's API quota before the walk completes. | High | Medium | Default budget caps the walk at 256 requests; sample-mode walks default to 16 nodes. Operator overrides via `--max-requests` but the default is conservative. |
| Output format drift — JSON shape changes between MINOR releases break CI scripts that parse it. | Medium | High | PRD-601-R14 anchors the JSON output shape per-subcommand; renaming a field or removing one is MAJOR per PRD-108-R5. The TSV column set is similarly pinned. |
| `act inspect` against an authenticated runtime origin without `--fetch-adapter` confusingly returns "tree is empty" because every endpoint 401s; user thinks the producer is broken. | Medium | Low | PRD-601-R6 surfaces 401 responses prominently in the `inspect` summary; under `--verbose`, the CLI prints the `WWW-Authenticate` headers received and a hint pointing at the `--fetch-adapter` flag. |
| Cross-origin mounts in a hybrid site cause the inspector to follow links to third-party origins the operator did not intend to probe. | Low | Medium | PRD-601-R8 requires the inspector to log every cross-origin fetch (origin different from the input URL's registrable domain) and offer a `--no-follow-cross-origin` flag. |
| ETag respect is too aggressive — `--no-cache` is needed for every nontrivial use case because runtime producers always emit the same ETag for a stable resource, and the operator wants a forced refetch to detect a producer-side cache-poisoning issue. | Low | Low | PRD-601-R9 makes `--no-cache` the canonical flag; the default behavior (respect `If-None-Match`) is documented as the "I trust the producer's ETag" mode. |

### Open questions

1. ~~Should `act walk` default to a sample (e.g., 16 nodes) or a full walk?~~ **Resolved (2026-05-01): No — `act walk` defaults to `--sample all` (full walk).** PRD-601-R7 already specifies "walk every node in the index by default," and PRD-601-R17 pins the `walk` default at `all`. The sample-16 default applies to `act inspect`, not `act walk`. Operators wanting a sampled walk pass `--sample N` explicitly. (Closes Open Question 1.)
2. ~~Should the inspector expose a `--json-stream` mode for `walk` that emits NDJSON of nodes as they are fetched?~~ **Resolved (2026-05-01): No — defer to v0.2.** Adds output-format surface area without clear v0.1 demand; full JSON object at end of walk is sufficient. (Closes Open Question 2.)
3. ~~Should `act budget` accept a token-cost callback (custom tokenizer)?~~ **Resolved (2026-05-01): Yes via the programmatic API only** (`tokenizer?: (text: string) => number` already on `BudgetOptions` per PRD-601-R15); not via CLI flags in v0.1. CLI defaults to the producer's declared `tokens.{summary,abstract,body}` values, treating them as authoritative. (Closes Open Question 3.)
4. ~~Should the CLI persist a small on-disk cache of fetched envelopes by ETag?~~ **Resolved (2026-05-01): No for v0.1.** Adds operational complexity (cache eviction, locking, multi-process safety); per-invocation request budget is small enough that re-fetching is acceptable. PRD-601-R9 already specifies no cross-invocation caching. (Closes Open Question 4.)
5. ~~Should `act diff` accept a `--ignore-fields <list>` to suppress noise (e.g., `updated_at` differences)?~~ **Resolved (2026-05-01): Yes — already specified normatively at PRD-601-R10 / R17.** No spec change required. (Closes Open Question 5.)

### Acceptance criteria

- [ ] Specification opens with a table of 100-series and PRD-600 requirements implemented (Phase 3 addition per `docs/workflow.md`).
- [ ] Every normative requirement uses RFC 2119 keywords; ID format `PRD-601-R{n}`.
- [ ] Conformance level (Core / Standard / Plus per PRD-107) declared per requirement *for the producers the inspector probes*; PRD-601 itself does not introduce new conformance bands but declares which producer level each operation requires.
- [ ] CLI subcommand surface (`inspect`, `walk`, `diff`, `node`, `subtree`, `budget`) is enumerated with flags, exit codes, and output formats.
- [ ] Programmatic API (`@act/inspector`) is specified with concrete TypeScript signatures.
- [ ] Output formats (human, JSON, TSV) are pinned per subcommand.
- [ ] The auth model (operator-supplied `fetch` adapter; CLI never authenticates) is stated explicitly.
- [ ] Caching contract (respects PRD-103 ETags; `--no-cache` override) is stated.
- [ ] Request budget (default 256 requests, 1 req/sec/origin) is specified, paralleling PRD-600-R33.
- [ ] Token-budget semantics (`deepest-first` vs `breadth-first`) are pinned.
- [ ] Diff semantics (added / removed / etag-changed / token-changed / structurally-changed) are pinned.
- [ ] Test fixtures path layout under `fixtures/601/positive/` and `fixtures/601/negative/` is enumerated.
- [ ] Implementation notes section includes 3–10 short TS snippets showing the public API, subcommand wiring, the budget walker, the diff algorithm, and the human/TSV/JSON renderers.
- [ ] Versioning & compatibility table classifies every change kind per PRD-108.
- [ ] Security section addresses: probing third-party origins; auth-credential handling; rate-limiting; cross-origin mount following.
- [ ] Changelog entry dated 2026-05-01 is present.

---

## Context & dependencies

### Depends on

- **PRD-100** (Accepted) — wire-format envelope schemas (`schemas/100/*.schema.json`); the inspector parses every envelope it fetches against these. Specifically: PRD-100-R3 (manifest), R16–R20 (index), R21–R27 (node), R32–R36 (subtree), R37 (NDJSON), R39 (`search_url_template`), R41–R44 (error envelope), R46 (MIME types).
- **PRD-101** (Accepted) — discovery algorithm (PRD-101-R8); the inspector implements it via the shared `@act/validator` walk module. PRD-101-R10 (longest-prefix mounts) and PRD-101-R11 (cross-origin trust) apply on hybrid trees.
- **PRD-103** (Accepted) — ETag value-shape and `If-None-Match` semantics. Specifically: PRD-103-R2 / R3 (value-shape), R8 (`If-None-Match` → 304), R10 (no `W/` prefix on HTTP `ETag`), R12 (NDJSON line ETag).
- **PRD-106** (Accepted) — runtime endpoint set, status codes, error envelope, mounts. The inspector probes runtime producers per the PRD-106-R1 endpoint set.
- **PRD-107** (Accepted) — conformance levels. The inspector reads the manifest's declared `conformance.level` and reports it; it does NOT compute an `achieved` level (that is PRD-600's job).
- **PRD-108** (Accepted) — versioning policy. The inspector tolerates unknown optional fields per PRD-108-R7 and rejects unknown MAJOR `act_version` per PRD-108-R8.
- **PRD-109** (Accepted) — security posture; PRD-601 imports for auth-credential handling and origin-trust evaluation on cross-origin mounts.
- **PRD-600** (Validator): In review. **Sibling tool**; PRD-601 reuses PRD-600's parser, schema bundle, and discovery walk. PRD-601 is NOT downstream of PRD-600 in the conformance sense — both depend only on the 100-series — but PRD-601 reuses the implementation to avoid drift.
- **000-governance** (Accepted) — lifecycle.
- **Decision Q3** (decided 2026-04-30): TypeScript-only first-party reference impl; PRD-601 ships as `@act/inspector` in TS only.
- External: [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174); [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) (HTTP semantics for the runtime probe); [RFC 8785 JCS](https://www.rfc-editor.org/rfc/rfc8785) (re-derivation hint for ETag debugging — informational); [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) (JSON Pointer, used in diff output).

### Blocks

- **PRD-602** (ACT-MCP bridge) — the bridge implementer reuses the inspector's walk to enumerate ACT resources for MCP `Resource` exposure (informational reuse, not a hard block).
- **PRD-700–707** — the example builds use the inspector for ad-hoc verification during development; not a hard CI gate (the validator is).

### References

- v0.1 draft: §5 (envelope shapes — referenced via PRD-100), §5.6 (progressive disclosure — relevant to `act budget`), §5.13 (runtime profile — referenced via PRD-106).
- `prd/000-decisions-needed.md`: Q3.
- `prd/000-INDEX.md` 600-series row.
- `docs/workflow.md` Phase 2 §Gate to Phase 3 ("PRD-601 implementable from the 100-series alone — verify by sketching their interface signatures before declaring the gate cleared").
- Prior art: `curl` (the canonical "fetch a URL" tool — UX baseline for `act node` / `act subtree`); [`jq`](https://jqlang.github.io/jq/) (JSON pipeline tool — composes with `--json` output); [`tree`](https://linux.die.net/man/1/tree) (the directory-tree-drawing UX adopted for `act inspect` and `act walk`); [`diff`](https://www.gnu.org/software/diffutils/manual/diffutils.html) (canonical pair-comparison UX adapted for `act diff`); the `tiktoken` family of token counters (informs how `act budget` reasons about producer-declared `tokens.*` values).

---

## Specification

This is the normative section. Every requirement uses RFC 2119 keywords as clarified by RFC 8174.

### Conformance level

PRD-601 is a consumer of every 100-series PRD. The inspector itself does not introduce new conformance bands, but its operations impose minimum producer-level requirements:

- **Probes any Core producer:** `act inspect`, `act walk`, `act node` — work against any producer at `conformance.level` ≥ Core. PRD-601-R1 through R10, R14 through R18, R20 through R24 are the relevant requirements.
- **Probes any Standard producer:** `act subtree` (substring) — requires the producer to declare and serve `subtree_url_template` (PRD-100-R32 / PRD-107-R8). PRD-601-R11.
- **Probes any Plus producer:** `act walk --use-ndjson` and `act diff --use-ndjson` — exploit NDJSON index for efficiency when the producer is Plus (PRD-100-R37 / PRD-107-R10). PRD-601-R19.
- **Tooling-only requirements:** PRD-601-R12 (token-budget strategies), R13 (diff classification), R14 (output format anchoring), R15 (programmatic API), R20 (request budget), R21 (conformance-level reporting scope), R22 (CLI exit codes), R23 (test-fixture corpus), R24 (mount following).

PRD-601 does not introduce new envelope-level requirements; it consumes the envelopes PRD-100 defines.

### 100-series requirements implemented

| Source PRD | Requirements consumed | Inspector mechanism |
|---|---|---|
| PRD-100 | R3 (manifest), R16–R20 (index), R21–R27 (node), R32–R36 (subtree), R37 (NDJSON), R39 (search template advertised — read-only inspection), R41–R44 (error envelope), R46 (MIME types) | Schema-driven parsing via `@act/validator`'s schema bundle; envelope-shape errors are reported as `findings` (NOT as `gaps` — the inspector is not a validator). |
| PRD-101 | R1 (well-known path), R8 (consumer discovery algorithm), R10 (longest-prefix mounts), R11 (cross-origin trust), R12 (delivery consistency) | Implemented by reusing `@act/validator`'s `validateSite` walk module's discovery primitives. |
| PRD-103 | R2 / R3 (etag value-shape), R8 (`If-None-Match` → 304), R10 (no `W/` prefix), R12 (NDJSON line etag) | Inspector emits `If-None-Match` on every fetch; reports `304` cache hits in human / JSON output; does NOT validate ETag determinism (that is PRD-600). |
| PRD-106 | R1 (endpoint set), R3 (304), R4 (`ETag` header), R5 (401 challenge), R6 (status codes), R12 (caching), R23 (Link header — read-only confirmation) | Inspector probes endpoints per the manifest; on 401, surfaces the challenge and offers `--fetch-adapter` hint. |
| PRD-107 | R1 / R3 (level / delivery declared values) | Inspector reports declared values; does NOT compute achieved level. |
| PRD-108 | R7 (tolerate unknown optional fields), R8 (reject unknown MAJOR `act_version` in bounded time) | Inspector tolerates unknown fields (passes through to JSON output); rejects unknown MAJOR with a clear error message. |
| PRD-109 | R3 / R4 (existence-non-leak — inspector does NOT differentiate 404-absent from 404-forbidden in its output, matching the producer's intentional opacity), R14 (no PII in inspector logs / output), R20 (bounded MAJOR rejection), R21 (cross-origin mount trust) | Operator-driven trust; cross-origin mount fetches surfaced and gateable. |
| PRD-600 | (sibling reuse) — `validateManifest`, `validateNode`, `validateIndex`, `validateSubtree`, `validateNdjsonIndex` for envelope parsing; `validateSite`'s walk primitives (request budget, rate-limit, fetch adapter) | Inspector imports these from `@act/validator`. The inspector wraps the parser results to produce `findings` rather than `gaps`. |

### Normative requirements

#### Architecture and parser reuse

**PRD-601-R1.** The inspector MUST import its envelope parsers and discovery walk module from `@act/validator` (PRD-600's package), NOT re-implement them. The shared dependency ensures parser parity with the conformance gate. **(Tooling)**

**PRD-601-R2.** The inspector MUST tolerate unknown optional fields per PRD-108-R7 — unknown fields appear in JSON output verbatim and in human output as `<extra: <field-name>>` annotations. **(Tooling)**

**PRD-601-R3.** The inspector MUST reject unknown MAJOR `act_version` per PRD-108-R8 / PRD-109-R20. The rejection MUST be bounded in O(parsed-version-string) time. The CLI MUST exit with a clear message ("Manifest reports `act_version: 999.0`; this inspector supports `0.1`.") and exit code 4. **(Tooling)**

#### CLI surface — subcommands

**PRD-601-R4.** The CLI binary MUST be named `act` (with `act-validate` already reserved by PRD-600 — a separate binary). The `act` binary MUST accept the following subcommands as positional first arguments. Each subcommand MAY accept additional flags described below.

- `act inspect <url>` — Full discovery walk + manifest pretty-print + sample N nodes + tree-shape summary.
- `act walk <url>` — Walk the entire tree (or to a configured depth); report node count, total tokens, fanout distribution, optional per-node JSON.
- `act diff <url-a> <url-b>` — Diff two trees by node `id`; classify each node as added / removed / etag-changed / token-changed / structurally-changed.
- `act node <url> <id>` — Fetch and pretty-print (or JSON-serialize) a single node.
- `act subtree <url> <id> [--depth N]` — Fetch and pretty-print (or JSON-serialize) a subtree; default depth 3 per PRD-100-R33.
- `act budget <url> --max-tokens N` — What-if: which subtree fits in N tokens? Reports inclusion order per `--strategy` flag.

A subcommand that requires a producer level above Core (e.g., `act subtree` requiring Standard, `act walk --use-ndjson` requiring Plus) MUST emit a clear error if the manifest's `conformance.level` declares a lower level OR if the corresponding endpoint returns 404. **(Tooling)**

#### `act inspect`

**PRD-601-R5.** `act inspect <url>` MUST execute the following sequence:

1. Discovery walk per PRD-101-R8 (reusing `@act/validator`).
2. Fetch and parse the manifest; report parse errors as `findings`.
3. Report the manifest's `conformance.level`, `delivery`, advertised endpoints, and `auth.schemes` (without attempting to authenticate).
4. Fetch the index; sample up to 16 nodes by default (configurable via `--sample N`).
5. For each sampled node, report `id`, `type`, `title`, `tokens.summary`, `tokens.body`, `etag` value-shape (`s256:...` format-check only, not derivation).
6. Render a tree summary: total node count from the index, unique types and their counts, fanout distribution (min / max / mean / median children per node), max depth observed in the sampled set.
7. Identify any obvious gaps the inspector saw — e.g., manifest declares `subtree_url_template` but a sampled subtree URL returns 404; manifest declares `conformance.level: "plus"` but `index_ndjson_url` is unreachable. These are reported as `findings`, NOT as `gaps`. The inspector MUST NOT produce a PRD-107-shaped report (PRD-601-R21).

Output formats: human (default), JSON (`--json`), TSV (`--tsv` — one row per sampled node). **(Tooling)**

**PRD-601-R6.** When any fetch in `act inspect` returns 401 with `WWW-Authenticate` headers, the CLI MUST surface the challenge in the output AND emit a remediation hint pointing to `--fetch-adapter` (programmatic API) or `--header 'Authorization: ...'` (CLI flag). The CLI MUST NOT attempt to authenticate. **(Tooling)**

#### `act walk`

**PRD-601-R7.** `act walk <url>` MUST walk every node in the index by default (subject to `--max-requests`), or sample N via `--sample N`. The walk MUST:

1. Fetch the manifest and index.
2. For each node in the index (or each sampled node), fetch the node envelope.
3. Aggregate: total node count, total `tokens.summary` + `tokens.body`, fanout distribution per parent, max observed depth (computed from the `parent` chain), unique types and their counts.
4. Emit per-node entries in `--json` mode: `{ id, type, parent, children, tokens: { summary, body }, etag, status: "ok" | "error", findings?: [...] }`.
5. Honor `--use-ndjson` (Plus only): when set, fetch the NDJSON index instead of the JSON index. The walk consumes one entry per line and parses each line independently.

`--depth N` limits the walk to nodes whose `parent` chain length from `root_id` is at most N. **(Tooling — Core; `--use-ndjson` requires Plus)**

**PRD-601-R8.** The walk MUST log every cross-origin fetch (a fetch whose origin differs from the input URL's registrable domain). The CLI's `--no-follow-cross-origin` flag MUST suppress cross-origin fetches and emit a `findings` entry citing PRD-101-R11 / PRD-109-R21 for each suppressed mount. **(Tooling)**

#### Caching

**PRD-601-R9.** The inspector MUST emit `If-None-Match` on every fetch when a prior fetch in the same invocation returned a `200` with an `ETag` header, per PRD-103-R8 / PRD-106-R3. The inspector MUST report `304` cache hits in human output as `(304 cached)` annotations and in JSON output as `"cache_hit": true` per fetch entry. The `--no-cache` flag MUST disable `If-None-Match` emission entirely. The inspector MUST NOT persist caches across invocations in v0.1 (no on-disk cache); cross-invocation cache reuse is a v0.2 concern. **(Tooling)**

#### `act diff`

**PRD-601-R10.** `act diff <url-a> <url-b>` MUST classify each node `id` present in either tree into exactly one of:

- `added` — `id` present in B, absent from A.
- `removed` — `id` present in A, absent from B.
- `etag_unchanged` — same `id` in both, same `etag` value.
- `etag_changed` — same `id` in both, different `etag` values; the inspector MUST also report `token_delta: { summary, body }` (B - A) and a JSON-pointer-keyed change set when `--include-content` is set.
- `structural_change` — same `id` in both, same `etag`, but `parent` differs OR `children[]` (sorted) differs. (This is rare because a `parent` or `children` change SHOULD shift the `etag`, but it is detectable independently and useful for catching ETag-derivation bugs in the producer.)

The diff is by `id`, NOT by structural similarity (no fuzzy matching). The inspector MUST tolerate trees with different `root_id` values; the diff proceeds by id-set. **(Tooling)**

The `--ignore-fields <field-list>` flag MUST suppress per-field changes inside `etag_changed` entries (e.g., `--ignore-fields updated_at,metadata.last_indexed_at`). The classification ID itself is NOT affected — the entry remains `etag_changed` but the inner change set excludes the listed fields. **(Tooling)**

#### `act subtree`

**PRD-601-R11.** `act subtree <url> <id> [--depth N]` MUST fetch the subtree from the producer's `subtree_url_template` substituted with `<id>`, with `--depth` defaulting to 3 per PRD-100-R33 and bounded to `[0, 8]`. The CLI MUST emit a clear error if the producer's `conformance.level` is `"core"` (subtree is Standard-tier). Output formats: human (tree-drawing), JSON (`--json`), TSV (`--tsv` — one row per node). **(Tooling — requires Standard producer)**

#### `act budget`

**PRD-601-R12.** `act budget <url> --max-tokens N [--strategy <breadth-first|deepest-first>] [--start-id <id>]` MUST compute which subset of nodes fits within an `N`-token budget, using the producer's declared `tokens.summary` and `tokens.body` fields as authoritative (per PRD-100-R17, PRD-100-R21).

The two strategies:

- **`breadth-first` (default).** Start at `root_id` (or `--start-id`). Include the start node. Walk children layer by layer, including each child node (full body) until adding the next would exceed `N`. This matches the canonical LLM-agent pattern of "start at root, descend on demand."
- **`deepest-first`.** Walk the tree; include each leaf node first, then ascend, including each parent only when all its descendants up to the current cutoff have been included. Stops when adding the next node would exceed `N`.

The output MUST include:

- The `--strategy` value used.
- The `--max-tokens` value supplied.
- An ordered list of `(id, tokens, cumulative_tokens)` triples in the order nodes were included.
- A summary: `nodes_included`, `nodes_excluded`, `tokens_used`, `tokens_remaining`.

The inspector MUST clearly document that `tokens.*` values are producer-declared and NOT validated by the inspector — a producer that mis-declares its tokens will produce a misleading budget. **(Tooling — requires Core)**

#### Diff algorithm

**PRD-601-R13.** The diff algorithm MUST be O(N + M) where N is the number of nodes in tree A and M in tree B. Implementation outline:

1. Walk A; build `mapA: Map<id, IndexEntry>`.
2. Walk B; build `mapB: Map<id, IndexEntry>`.
3. For each `id` in `mapA ∪ mapB`, classify per PRD-601-R10.
4. For `etag_changed` entries with `--include-content`, fetch both nodes' full envelopes and compute the per-field changeset.

The implementation MUST NOT do all-pairs comparison or fuzzy-match. **(Tooling)**

#### Output format anchoring

**PRD-601-R14.** Each subcommand's `--json` output MUST follow a stable shape pinned in §"Wire format / interface definition" below. Renaming or removing a documented field is MAJOR per PRD-108-R5(2). Adding a new optional field is MINOR per PRD-108-R4(1). The same MAJOR/MINOR rule applies to the TSV column set. Human-readable output is NOT pinned (it is for human consumption); changes to it are at most MINOR. **(Tooling)**

#### Programmatic API

**PRD-601-R15.** The `@act/inspector` TypeScript package MUST export the following functions from its package entry point, paralleling the CLI surface:

- `inspect(url: string, opts?: InspectOptions): Promise<InspectResult>`
- `walk(url: string, opts?: WalkOptions): Promise<WalkResult>`
- `diff(urlA: string, urlB: string, opts?: DiffOptions): Promise<DiffResult>`
- `node(url: string, id: string, opts?: NodeOptions): Promise<NodeResult>`
- `subtree(url: string, id: string, opts?: SubtreeOptions): Promise<SubtreeResult>`
- `budget(url: string, maxTokens: number, opts?: BudgetOptions): Promise<BudgetResult>`

Each function MUST accept a `fetch?: typeof globalThis.fetch` option per `WalkOptions`-style for credential injection (mirroring PRD-600-R32). The functions MUST NOT log or mutate global state; results are returned by value. **(Tooling)**

#### CLI flags (shared across subcommands)

**PRD-601-R16.** The following flags MUST be accepted by every subcommand that fetches network content (`inspect`, `walk`, `diff`, `node`, `subtree`, `budget`):

- `--header <"Name: value">` (repeatable) — inject HTTP request headers (e.g., `Authorization: Bearer ...`); the inspector MUST NOT log values.
- `--max-requests <N>` — total HTTP request budget per invocation; default 256 (per PRD-601-R20). For `inspect`, default 32 (smaller because `inspect` samples).
- `--rate-limit <N>` — per-origin requests per second; default 1.
- `--no-cache` — disable `If-None-Match` emission per PRD-601-R9.
- `--no-follow-cross-origin` — suppress cross-origin mount fetches per PRD-601-R8.
- `--json` — emit JSON to stdout per PRD-601-R14.
- `--tsv` — emit TSV to stdout per the per-subcommand column set.
- `--verbose` — emit human-readable debug to stderr.
- `--version` — print binary version + bundled `act_version`; exit 0.
- `--help` — print usage; exit 0.

The CLI MUST treat `--json` and `--tsv` as mutually exclusive; supplying both MUST exit 2. **(Tooling)**

**PRD-601-R17.** The following flags are subcommand-specific:

- `act inspect`: `--sample <N>` (default 16).
- `act walk`: `--sample <N|all>` (default `all`); `--depth <N>` (default unbounded); `--use-ndjson` (Plus only).
- `act diff`: `--include-content` (fetch full envelopes for `etag_changed` entries); `--ignore-fields <list>` per PRD-601-R10.
- `act subtree`: `--depth <N>` (default 3, bounded `[0, 8]`).
- `act budget`: `--max-tokens <N>` (REQUIRED); `--strategy <breadth-first|deepest-first>` (default `breadth-first`); `--start-id <id>` (default `root_id`).

**(Tooling)**

#### Auth model

**PRD-601-R18.** The inspector MUST NOT authenticate on its own. Operators inject credentials via:

- The CLI's `--header 'Authorization: Bearer ...'` flag (repeatable).
- The programmatic API's `fetch` option (a custom `fetch` adapter).

The inspector MUST NOT log credential bytes anywhere — not in `--verbose` output, not in JSON, not in TSV. Implementation-level requirement enforced via code review and unit tests asserting no credential bytes appear in any sink. **(Tooling)**

#### NDJSON acceleration

**PRD-601-R19.** `act walk` and `act diff` MAY accept `--use-ndjson`; when set, the inspector requests `Accept: application/act-index+json; profile=ndjson` (per PRD-100-R37 / PRD-500-R16). When the producer is Plus, the inspector consumes one entry per line, reducing total request count by an order of magnitude on large trees. When the producer is below Plus (no `index_ndjson_url`), the inspector MUST exit with code 3 and a hint pointing to the producer's declared level. **(Tooling — requires Plus producer)**

#### Request budget

**PRD-601-R20.** The inspector's request budget MUST default to 256 total HTTP requests per invocation (or 32 for `inspect` per PRD-601-R16) and MUST default to no more than 1 request per second per origin. The defaults are overridable via `--max-requests` and `--rate-limit`. Exceeding the budget MUST terminate the operation with a `findings` entry coded `request_budget_exceeded` and a partial report. **(Tooling)**

#### Conformance-level reporting scope

**PRD-601-R21.** The inspector MUST report the manifest's `conformance.level` and `delivery` values verbatim. The inspector MUST NOT compute an `achieved.level` — that computation is PRD-600's responsibility (PRD-600-R18). When the inspector observes an obvious gap (e.g., `level: "plus"` but `search_url_template` absent), it emits a `findings` entry pointing at the inconsistency and SHOULD recommend running `act-validate` for a full conformance verdict. The inspector MUST NOT produce a JSON object whose top-level shape matches PRD-107-R16 (`declared`, `achieved`, `gaps`, `warnings`, `passed_at`); doing so would invite confusion with the validator's output. **(Tooling)**

#### CLI exit codes

**PRD-601-R22.** The CLI's exit codes MUST be:

- **Exit 0** — success.
- **Exit 1** — invocation succeeded but produced findings (e.g., `act inspect` saw a 404 on an indexed node, or `act diff` found differences). The presence of differences in `act diff` MUST exit 1 unless `--no-fail-on-diff` is set.
- **Exit 2** — invocation error (bad argv, file unreadable, network unreachable for the initial well-known fetch).
- **Exit 3** — subcommand requires a higher-level producer than the manifest declares (e.g., `act subtree` against a Core producer, `act walk --use-ndjson` against a non-Plus producer).
- **Exit 4** — `act_version` MAJOR mismatch per PRD-601-R3.

The default `act diff` posture (exit 1 on any difference) makes the CLI suitable as a CI gate. **(Tooling)**

#### Test fixtures

**PRD-601-R23.** The inspector's test corpus MUST consume relevant fixtures from `fixtures/100/`, `fixtures/101/`, `fixtures/103/`, `fixtures/106/` for envelope parsing parity with PRD-600. The inspector's own additional fixtures live under `fixtures/601/` and cover end-to-end subcommand behavior the per-PRD fixtures do not exercise. Filenames are enumerated below. **(Tooling)**

#### Mount following

**PRD-601-R24.** The inspector MUST honor `mounts` per PRD-101-R10 (longest-prefix match). When a request URL falls under a mount's `prefix`, the inspector follows the mount's `manifest_url` and walks the mount tree; cross-origin mounts trigger PRD-601-R8 logging. The inspector emits a per-mount sub-summary in its JSON output. **(Tooling)**

### Wire format / interface definition

The "wire format" of the inspector is its programmatic TypeScript API plus its CLI argv plus its JSON output shapes per subcommand.

#### TypeScript API

```typescript
// @act/inspector public surface
import type { Manifest, Index, IndexEntry, Node, Subtree } from '@act/validator';

export interface InspectOptions {
  fetch?: typeof globalThis.fetch;
  maxRequests?: number;     // default 32 for inspect
  rateLimit?: number;       // default 1 req/sec/origin
  sample?: number;          // default 16
  noCache?: boolean;
  noFollowCrossOrigin?: boolean;
  headers?: Record<string, string>;
}

export interface InspectResult {
  url: string;
  manifest: { value: Manifest; findings: Finding[] } | { value: null; findings: Finding[] };
  declared: { level: 'core' | 'standard' | 'plus' | null; delivery: 'static' | 'runtime' | null };
  endpoints: {
    well_known: string;
    index: string;
    node_template: string;
    subtree_template?: string;
    index_ndjson?: string;
    search_template?: string;
  };
  auth: { schemes: string[]; oauth2?: { authorization_endpoint: string } };
  sampled_nodes: Array<{
    id: string; type: string; title: string;
    tokens: { summary: number; abstract?: number; body?: number };
    etag: string;
    cache_hit: boolean;
  }>;
  tree_summary: {
    total_nodes: number;            // from index
    types: Record<string, number>;
    fanout: { min: number; max: number; mean: number; median: number };
    max_depth_observed: number;
  };
  findings: Finding[];
  walk_summary: { requests_made: number; elapsed_ms: number };
}

export interface Finding {
  code: string;          // "endpoint-404", "auth-required", "cross-origin-mount", ...
  message: string;
  pointer?: string;      // RFC 6901 JSON Pointer when applicable
  severity: 'info' | 'warn' | 'error';
}

export function inspect(url: string, opts?: InspectOptions): Promise<InspectResult>;

// --- walk ---

export interface WalkOptions extends InspectOptions {
  sample?: number | 'all';   // default 'all'
  depth?: number;            // default unbounded
  useNdjson?: boolean;       // requires Plus producer
}

export interface WalkResult {
  url: string;
  manifest: Manifest;
  nodes: Array<{
    id: string; type: string; parent?: string | null; children?: string[];
    tokens: { summary: number; abstract?: number; body?: number };
    etag: string;
    status: 'ok' | 'error';
    findings?: Finding[];
  }>;
  tree_summary: InspectResult['tree_summary'];
  findings: Finding[];
  walk_summary: { requests_made: number; elapsed_ms: number };
}

export function walk(url: string, opts?: WalkOptions): Promise<WalkResult>;

// --- diff ---

export interface DiffOptions extends InspectOptions {
  includeContent?: boolean;
  ignoreFields?: string[];   // e.g., ["updated_at", "metadata.last_indexed_at"]
}

export interface DiffResult {
  url_a: string;
  url_b: string;
  added:    Array<{ id: string }>;
  removed:  Array<{ id: string }>;
  etag_unchanged:    Array<{ id: string }>;
  etag_changed:      Array<{
    id: string;
    token_delta: { summary: number; body: number };
    changes?: Array<{ pointer: string; before: unknown; after: unknown }>;
  }>;
  structural_change: Array<{
    id: string;
    parent_change?: { before: string | null; after: string | null };
    children_change?: { added: string[]; removed: string[] };
  }>;
  findings: Finding[];
  walk_summary: { requests_made: number; elapsed_ms: number };
}

export function diff(urlA: string, urlB: string, opts?: DiffOptions): Promise<DiffResult>;

// --- node, subtree ---

export interface NodeOptions extends InspectOptions { /* inherits */ }
export interface NodeResult { url: string; node: Node | null; findings: Finding[]; }
export function node(url: string, id: string, opts?: NodeOptions): Promise<NodeResult>;

export interface SubtreeOptions extends InspectOptions { depth?: number; }
export interface SubtreeResult { url: string; subtree: Subtree | null; findings: Finding[]; }
export function subtree(url: string, id: string, opts?: SubtreeOptions): Promise<SubtreeResult>;

// --- budget ---

export interface BudgetOptions extends InspectOptions {
  strategy?: 'breadth-first' | 'deepest-first';   // default 'breadth-first'
  startId?: string;                                // default manifest.root_id
  tokenizer?: (text: string) => number;            // optional override
}

export interface BudgetResult {
  url: string;
  strategy: 'breadth-first' | 'deepest-first';
  max_tokens: number;
  start_id: string;
  inclusion_order: Array<{ id: string; tokens: number; cumulative_tokens: number }>;
  summary: {
    nodes_included: number;
    nodes_excluded: number;
    tokens_used: number;
    tokens_remaining: number;
  };
  findings: Finding[];
}

export function budget(url: string, maxTokens: number, opts?: BudgetOptions): Promise<BudgetResult>;
```

#### TSV column sets (per subcommand)

- `act inspect --tsv`: `id  type  title  tokens_summary  tokens_body  etag  cache_hit` — one row per sampled node.
- `act walk --tsv`: same column set as `inspect`, one row per walked node, plus `parent` and `depth` columns.
- `act diff --tsv`: `id  classification  tokens_summary_delta  tokens_body_delta` — one row per non-`etag_unchanged` entry.
- `act subtree --tsv`: same as `walk`, one row per subtree node.
- `act budget --tsv`: `order  id  tokens  cumulative_tokens` — one row per included node.

The first TSV row MUST be a header line listing the columns; downstream tools (awk, cut, miller) rely on it.

### Errors

The inspector itself does not run as a server. Failure modes:

| Condition | Outcome | Notes |
|---|---|---|
| Initial well-known fetch unreachable | CLI exit 2; stderr message naming the URL probed | PRD-601-R22. |
| Manifest JSON parse failure | CLI exit 1; `findings` entry coded `manifest-parse-error`; partial output | PRD-601-R5(2). |
| Producer's `act_version` is unknown MAJOR | CLI exit 4; clear error message | PRD-601-R3. |
| 401 on a probed endpoint | CLI exit 1 (or 0 if `--no-fail-on-auth`); `findings` entry surfaces challenge + `--fetch-adapter` hint | PRD-601-R6. |
| Cross-origin mount encountered without `--no-follow-cross-origin` | Walk continues; `findings` entry coded `cross-origin-mount` | PRD-601-R8 / PRD-101-R11. |
| `act subtree` against Core producer | CLI exit 3; clear error message | PRD-601-R11 / PRD-601-R22. |
| `act walk --use-ndjson` against non-Plus producer | CLI exit 3 | PRD-601-R19. |
| `act diff` finds differences | CLI exit 1 (default); exit 0 with `--no-fail-on-diff` | PRD-601-R22. |
| Request budget exceeded | Partial output emitted; `findings` entry coded `request_budget_exceeded` | PRD-601-R20. |
| `--json` and `--tsv` both supplied | CLI exit 2; argv error | PRD-601-R16. |

---

## Examples

Examples are non-normative but consistent with the Specification.

### Example 1 — `act inspect` against a Standard static site

```
$ act inspect https://acme.example
ACT Inspector 0.1.0  (act_version 0.1)
Target:    https://acme.example/.well-known/act.json
Declared:  standard / static
Endpoints:
  index:     /act/index.json
  node:      /act/n/{id}.json
  subtree:   /act/sub/{id}.json
Auth:      (none)

Tree summary:
  Total nodes:    247
  Types:          page (180), section (50), feature (17)
  Fanout:         min 0, max 31, mean 4.2, median 3
  Max depth:      6  (sampled)

Sampled (16 of 247):
  intro                            page         12 / 412 tokens   s256:iH6ta8…
  pricing/enterprise               page         18 / 1830 tokens  s256:7zKqVx…
  ...

Findings: (none)
```

Exit 0.

### Example 2 — `act diff --json`

```
$ act diff https://prev.acme.example https://current.acme.example --json
```

```json
{
  "url_a": "https://prev.acme.example/.well-known/act.json",
  "url_b": "https://current.acme.example/.well-known/act.json",
  "added": [{"id": "blog/2026-04-29-launch"}],
  "removed": [{"id": "blog/draft-internal"}],
  "etag_unchanged": [{"id": "intro"}, {"id": "pricing/starter"}],
  "etag_changed": [
    {
      "id": "pricing/enterprise",
      "token_delta": {"summary": 0, "body": 22}
    }
  ],
  "structural_change": [],
  "findings": [],
  "walk_summary": {"requests_made": 19, "elapsed_ms": 2410}
}
```

Exit 1 (differences found). `--no-fail-on-diff` would force exit 0.

### Example 3 — `act budget` with breadth-first strategy

```
$ act budget https://acme.example --max-tokens 12000 --strategy breadth-first --start-id intro
```

```
Strategy:     breadth-first
Max tokens:   12000
Start id:     intro

Included (8 nodes, 11842 tokens):
   1.  intro                              412 tokens   (cumulative   412)
   2.  intro/getting-started              810 tokens   (cumulative  1222)
   3.  intro/concepts                    1290 tokens   (cumulative  2512)
   4.  intro/concepts/manifest           2105 tokens   (cumulative  4617)
   5.  intro/concepts/index              1920 tokens   (cumulative  6537)
   6.  intro/concepts/discovery          1840 tokens   (cumulative  8377)
   7.  intro/concepts/conformance        1762 tokens   (cumulative 10139)
   8.  intro/concepts/etags              1703 tokens   (cumulative 11842)

Excluded:        239 nodes
Tokens used:     11842 / 12000  (98.7%)
Tokens remaining: 158
```

Exit 0.

### Example 4 — Programmatic API: walk a runtime origin with credentials

```ts
import { walk } from '@act/inspector';

const result = await walk('https://app.acme.example', {
  fetch: (url, init) => globalThis.fetch(url, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${process.env.ACME_TOKEN}` },
  }),
  sample: 'all',
  useNdjson: true,
});

console.log(`Walked ${result.nodes.length} nodes; ${result.findings.length} findings.`);
for (const finding of result.findings) {
  console.warn(`[${finding.severity}] ${finding.code}: ${finding.message}`);
}
```

The inspector never logs the `Authorization` header per PRD-601-R18; the operator's `fetch` adapter is the boundary.

### Example 5 — `act node` JSON output

```
$ act node https://acme.example pricing/enterprise --json
```

```json
{
  "url": "https://acme.example/act/n/pricing/enterprise.json",
  "node": {
    "act_version": "0.1",
    "id": "pricing/enterprise",
    "type": "page",
    "title": "Enterprise pricing",
    "etag": "s256:7zKqVxL2pNm3rB8cFhZdTw",
    "summary": "Volume pricing for teams of 100+...",
    "content": [...]
  },
  "findings": []
}
```

Exit 0.

### Example 6 — Reusing PRD-600's parser

```ts
// @act/inspector/src/manifest.ts
import { validateManifest } from '@act/validator';

export function parseManifest(json: unknown): { value: Manifest | null; findings: Finding[] } {
  const result = validateManifest(json);
  return {
    value: result.ok ? (json as Manifest) : null,
    findings: result.errors.map(toFinding('error'))
              .concat(result.warnings.map(toFinding('warn'))),
  };
}
```

The inspector wraps validator results into `findings` (its own shape) rather than `gaps` (the validator's shape). PRD-601-R1 + PRD-601-R21 in action.

---

## Test fixtures

Fixtures live under `fixtures/601/{positive,negative}/` and exercise the per-subcommand surface end-to-end.

### Foundational corpus (consumed, not authored, by PRD-601)

- `fixtures/100/positive/`, `fixtures/100/negative/` — envelope shape parsing.
- `fixtures/101/positive/`, `fixtures/101/negative/` — discovery flow.
- `fixtures/103/positive/`, `fixtures/103/negative/` — etag value-shape.
- `fixtures/106/positive/`, `fixtures/106/negative/` — runtime endpoint set, status codes.

For each fixture, the inspector's expected behavior is:

- **Positive** → no `findings`; subcommand exits 0; output matches the recorded shape.
- **Negative** → at least one `findings` entry citing the spec requirement called out in the fixture's filename or sidecar.

### PRD-601-specific corpus

#### Positive

- `fixtures/601/positive/inspect-static-core.json` — `act inspect` against a static Core site; recorded human and JSON output.
- `fixtures/601/positive/inspect-runtime-plus.json` — `act inspect` against a runtime Plus site (with `--header 'Authorization: Bearer <token>'`); recorded JSON output.
- `fixtures/601/positive/walk-full-static-standard.json` — `act walk --sample all` against a Standard static site (50 nodes); recorded JSON output.
- `fixtures/601/positive/walk-ndjson-runtime-plus.json` — `act walk --use-ndjson` against a Plus runtime site (1K nodes); recorded JSON output (truncated to 100-node sample for fixture).
- `fixtures/601/positive/diff-no-changes.json` — `act diff` between two builds with no content changes; expected `etag_unchanged` for every id, exit 0.
- `fixtures/601/positive/diff-content-update.json` — `act diff` between two builds where one node's body was edited; expected one `etag_changed` entry, exit 1.
- `fixtures/601/positive/diff-added-removed-nodes.json` — `act diff` adding two nodes and removing one; expected the `added` / `removed` arrays populated.
- `fixtures/601/positive/budget-breadth-first.json` — `act budget --max-tokens 12000 --strategy breadth-first`; recorded inclusion order matching Example 3.
- `fixtures/601/positive/budget-deepest-first.json` — `act budget --max-tokens 12000 --strategy deepest-first`; recorded inclusion order (different from breadth-first on the same tree).
- `fixtures/601/positive/node-fetch-static.json` — `act node` returning a single node; recorded output.
- `fixtures/601/positive/subtree-default-depth.json` — `act subtree` with default depth=3; recorded output.
- `fixtures/601/positive/cache-hit-after-first-fetch.json` — recorded walk where the inspector emits `If-None-Match` on the second fetch and the producer returns 304; `cache_hit: true` per node.
- `fixtures/601/positive/hybrid-mount-walk.json` — `act walk` against a hybrid (apex static + `app.acme` runtime); per-mount sub-summary.

#### Negative

- `fixtures/601/negative/manifest-parse-error.json` — manifest body is invalid JSON; CLI exit 1, `findings` coded `manifest-parse-error`.
- `fixtures/601/negative/act-version-future-major.json` — manifest declares `act_version: "999.0"`; CLI exit 4 per PRD-601-R3.
- `fixtures/601/negative/subtree-against-core.json` — `act subtree` against a Core producer; exit 3 with hint.
- `fixtures/601/negative/walk-ndjson-against-standard.json` — `act walk --use-ndjson` against a Standard producer; exit 3.
- `fixtures/601/negative/auth-required-no-fetch-adapter.json` — `act inspect` against a runtime origin with no headers; CLI surfaces the 401 challenge and points to `--header` / `--fetch-adapter`. Exit 1.
- `fixtures/601/negative/cross-origin-mount-followed.json` — manifest declares a mount on a different registrable domain; walk follows it; `findings` coded `cross-origin-mount`. Exit 1.
- `fixtures/601/negative/cross-origin-mount-blocked.json` — same as above but with `--no-follow-cross-origin`; mount is suppressed; `findings` coded `cross-origin-mount-suppressed`. Exit 1.
- `fixtures/601/negative/request-budget-exceeded.json` — walk against a 1K-node tree with `--max-requests 32`; `findings` coded `request_budget_exceeded`; partial output. Exit 1.
- `fixtures/601/negative/diff-structural-change-stable-etag.json` — same `id` in both trees, same `etag`, but `parent` field changed; classified as `structural_change`. Exit 1.
- `fixtures/601/negative/json-and-tsv-both-supplied.json` — CLI invoked with both `--json` and `--tsv`; exit 2; argv error message.
- `fixtures/601/negative/budget-no-max-tokens.json` — `act budget` invoked without `--max-tokens`; exit 2; argv error.

---

## Versioning & compatibility

Per PRD-108, classify each kind of change to PRD-601.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a new subcommand | MINOR | Additive; existing CLI invocations unaffected. PRD-108-R4(2). |
| Add a flag to an existing subcommand | MINOR | Additive. |
| Rename or remove a subcommand | MAJOR | CI scripts depend on the argv. |
| Rename or remove a CLI flag | MAJOR | Same. |
| Change a flag default (e.g., `--sample 16` → `--sample 32` for `inspect`) | MAJOR | Two CI runs against the same producer would yield different results. |
| Add an envelope-level field to a `Result` JSON shape | MINOR | PRD-601-R14; PRD-108-R4(1). |
| Rename or remove a `Result` JSON field | MAJOR | Downstream tools parse the JSON. |
| Add a TSV column | MAJOR | TSV columns are positional; downstream `awk` / `cut` consumers depend on positions. |
| Change a TSV column's name in the header line | MAJOR | Same. |
| Add a new `Finding.code` value | MINOR | The `code` enum is documented-open. |
| Add a new `--strategy` value to `act budget` | MINOR | The strategy enum is documented-open. |
| Tighten an existing finding to an exit-1-causing severity | MAJOR | Producers passing today fail tomorrow. |
| Loosen an existing finding | MAJOR | Per PRD-108-R5(3); loosening MUST → SHOULD is MAJOR. |
| Change the parser dependency from `@act/validator` to a fork | MAJOR | PRD-601-R1 mandates the shared dependency. |
| Editorial revision (typo, prose clarification) with no normative change | n/a | Per 000-governance R18. |

### Forward compatibility

The inspector MUST tolerate unknown optional fields per PRD-108-R7 in every envelope it parses. Downstream consumers parsing the inspector's JSON output MUST tolerate unknown envelope-level fields PRD-601 may emit.

A target producer ahead of the inspector's bundled `act_version` (e.g., target advertises `act_version: "0.2"` while inspector was built for 0.1) MUST cause the inspector to emit a `findings` entry coded `version-mismatch` and proceed with best-effort parsing. Hard rejection on minor-version mismatch would defeat the inspector's "explore unknown producers" use case.

### Backward compatibility

A target producer behind the inspector's bundled `act_version` MUST be parsed against the rules of the lower version. The inspector's parser bundle (inherited from `@act/validator`) MUST retain prior-version schemas for at least one full MAJOR cycle per PRD-108-R12.

The CLI's argv surface MUST remain stable across MINORs of PRD-601 (additive only).

---

## Security considerations

PRD-109 owns the project-wide threat model. PRD-601 imports and notes the following deltas specific to a tool that probes third-party origins on operator command.

- **Probing third-party origins.** The inspector issues HTTP requests against URLs supplied by the operator. It is the operator's responsibility to have authorization to probe; PRD-601 imposes no consent check. The default request budget (PRD-601-R20: 256 requests per invocation, 1 req/sec/origin; 32 for `inspect`) is set conservatively to avoid producer-side rate-limit retaliation. Operators running large audits SHOULD coordinate with target operators per PRD-800 (crawler) guidance once that PRD lands.

- **Auth-credential handling.** PRD-601-R18 forbids the inspector from authenticating on its own. The `--header` flag and the programmatic `fetch` adapter are the only injection points. The inspector MUST NOT log credential bytes anywhere — `--verbose` output, JSON output, TSV output, error messages, and `findings.message` strings are all subject to the no-credentials rule. Implementation enforces via unit tests that grep recorded test outputs for known-credential-shaped strings (Bearer-prefixed tokens, JWT-shaped strings).

- **Cross-origin mount following.** When the inspector follows a cross-origin mount, the operator's credentials (e.g., a Bearer token for `acme.com`) MAY be sent to the mount's origin (e.g., `cdn.partner.example`). This is operator-controlled — the `--header` flag injects on every fetch — and operator-visible (PRD-601-R8 logs every cross-origin fetch). Operators running with sensitive credentials SHOULD set `--no-follow-cross-origin` by default.

- **Information disclosure via `findings`.** Inspector findings MUST NOT echo response bodies verbatim (a malicious target could embed PII or secrets in a `summary` field hoping the inspector would log it). The inspector MUST truncate quoted content to short, structural snippets and SHOULD NOT include full body excerpts in `findings.message`. Cross-reference PRD-109-R14 / R15.

- **DoS via hostile target.** A hostile target that responds with multi-gigabyte JSON bodies could exhaust inspector memory. The inspector SHOULD impose a per-response body cap (default 16 MiB; configurable via `--max-body-bytes`) and emit a `findings` entry coded `body-too-large` on overflow. The MAJOR-mismatch bounded-time rejection rule (PRD-109-R20) applies — rejection of a target's `act_version` higher than the bundled version MUST complete in O(parsed-version-string) memory.

- **Existence-non-leak posture.** The inspector inherits PRD-109-R3 / R4 by construction: it does NOT differentiate "absent" from "forbidden" 404s in its output, mirroring the producer's intentional opacity. An operator who needs to distinguish them does so out-of-band (e.g., with the producer's own auditing tools).

- **No privilege escalation.** The inspector reads; it does not write. There is no subcommand that mutates a manifest, edits a node, or triggers a producer-side side effect. Operators auditing the inspector's behavior MAY rely on this read-only invariant.

---

## Implementation notes

This section ships canonical TypeScript snippets that the inspector maintainer (and PRD-700-series example authors who script against the programmatic API) can use as reference. The first-party reference impl ships at `packages/inspector/`; the snippets here reproduce the public surface.

### Snippet 1 — Public API entry point

```ts
// packages/inspector/src/index.ts
export { inspect } from './inspect';
export { walk }    from './walk';
export { diff }    from './diff';
export { node, subtree } from './fetch';
export { budget } from './budget';
export type {
  InspectOptions, InspectResult,
  WalkOptions, WalkResult,
  DiffOptions, DiffResult,
  NodeOptions, NodeResult,
  SubtreeOptions, SubtreeResult,
  BudgetOptions, BudgetResult,
  Finding,
} from './types';

// Bundled spec version this inspector was built against.
export { ACT_VERSION } from './version';
```

### Snippet 2 — Reuse PRD-600's parser (PRD-601-R1)

```ts
// packages/inspector/src/parsers.ts
import {
  validateManifest, validateIndex, validateNode,
  validateSubtree, validateNdjsonIndex,
} from '@act/validator';

export function parseManifest(json: unknown) {
  const r = validateManifest(json);
  return r.ok ? { value: json as Manifest, findings: [] }
              : { value: null, findings: r.errors.map(toFinding('error')) };
}
// ... parseIndex, parseNode, parseSubtree, parseNdjsonIndex follow the same shape.
```

The inspector wraps validator results as `findings`, never as `gaps`; PRD-601-R21 is enforced by the wrapper.

### Snippet 3 — `walk` skeleton (PRD-601-R7)

```ts
// packages/inspector/src/walk.ts (excerpt)
import { discoverManifest } from '@act/validator';   // PRD-101-R8 implementation

export async function walk(url: string, opts: WalkOptions = {}): Promise<WalkResult> {
  const fetcher = opts.fetch ?? globalThis.fetch;
  const budget  = new RequestBudget(opts.maxRequests ?? 256, opts.rateLimit ?? 1);

  const { manifest, manifestUrl, findings: discFindings } =
    await discoverManifest(url, { fetch: budget.wrap(fetcher) });

  const indexUrl = useNdjsonIfPlus(opts, manifest);
  const indexEntries = await fetchIndex(indexUrl, budget, opts);

  const sampled = sample(indexEntries, opts.sample ?? 'all');
  const nodes = await Promise.all(sampled.map(e => fetchNode(e, manifest, budget, opts)));

  return {
    url: manifestUrl,
    manifest,
    nodes,
    tree_summary: computeSummary(indexEntries, nodes),
    findings: [...discFindings, ...nodes.flatMap(n => n.findings ?? [])],
    walk_summary: budget.summary(),
  };
}
```

### Snippet 4 — `diff` algorithm (PRD-601-R10, R13)

```ts
// packages/inspector/src/diff.ts (excerpt)
export async function diff(urlA: string, urlB: string, opts: DiffOptions = {}): Promise<DiffResult> {
  const [a, b] = await Promise.all([walk(urlA, opts), walk(urlB, opts)]);

  const mapA = new Map(a.nodes.map(n => [n.id, n]));
  const mapB = new Map(b.nodes.map(n => [n.id, n]));

  const added: DiffResult['added'] = [];
  const removed: DiffResult['removed'] = [];
  const etag_unchanged: DiffResult['etag_unchanged'] = [];
  const etag_changed: DiffResult['etag_changed'] = [];
  const structural_change: DiffResult['structural_change'] = [];

  for (const id of new Set([...mapA.keys(), ...mapB.keys()])) {
    const ea = mapA.get(id), eb = mapB.get(id);
    if (!ea && eb)        added.push({ id });
    else if (ea && !eb)   removed.push({ id });
    else if (ea && eb) {
      if (ea.etag === eb.etag) {
        // Same etag — verify structural fields are also unchanged.
        const struct = detectStructuralChange(ea, eb);
        if (struct) structural_change.push({ id, ...struct });
        else        etag_unchanged.push({ id });
      } else {
        const tokenDelta = {
          summary: (eb.tokens.summary ?? 0) - (ea.tokens.summary ?? 0),
          body:    (eb.tokens.body    ?? 0) - (ea.tokens.body    ?? 0),
        };
        const changes = opts.includeContent
          ? await fetchAndDiffContent(id, urlA, urlB, opts)
          : undefined;
        etag_changed.push({ id, token_delta: tokenDelta, changes });
      }
    }
  }

  return { url_a: urlA, url_b: urlB, added, removed,
           etag_unchanged, etag_changed, structural_change,
           findings: [...a.findings, ...b.findings],
           walk_summary: { /* combined */ } };
}
```

### Snippet 5 — `budget` strategy (PRD-601-R12)

```ts
// packages/inspector/src/budget.ts (excerpt)
export async function budget(url: string, maxTokens: number, opts: BudgetOptions = {}): Promise<BudgetResult> {
  const w = await walk(url, opts);
  const startId = opts.startId ?? w.manifest.root_id;
  const strategy = opts.strategy ?? 'breadth-first';

  const order = strategy === 'breadth-first'
    ? walkBreadthFirst(w.nodes, startId)
    : walkDeepestFirst(w.nodes, startId);

  const inclusion: BudgetResult['inclusion_order'] = [];
  let cumulative = 0;
  let excluded = 0;

  for (const node of order) {
    const cost = (node.tokens.summary ?? 0) + (node.tokens.body ?? 0);
    if (cumulative + cost > maxTokens) { excluded += 1; continue; }
    cumulative += cost;
    inclusion.push({ id: node.id, tokens: cost, cumulative_tokens: cumulative });
  }

  return {
    url: w.manifest.site?.canonical_url ?? url,
    strategy, max_tokens: maxTokens, start_id: startId,
    inclusion_order: inclusion,
    summary: {
      nodes_included: inclusion.length,
      nodes_excluded: w.nodes.length - inclusion.length,
      tokens_used: cumulative,
      tokens_remaining: maxTokens - cumulative,
    },
    findings: w.findings,
  };
}
```

### Snippet 6 — CLI argv parsing (PRD-601-R4 / R16 / R17)

```ts
// packages/inspector-cli/src/cli.ts (excerpt)
import { parseArgs } from 'node:util';
import { inspect, walk, diff, node, subtree, budget } from '@act/inspector';

const subcommand = process.argv[2];
const rest = process.argv.slice(3);

switch (subcommand) {
  case 'inspect': return runInspect(rest);
  case 'walk':    return runWalk(rest);
  case 'diff':    return runDiff(rest);
  case 'node':    return runNode(rest);
  case 'subtree': return runSubtree(rest);
  case 'budget':  return runBudget(rest);
  case '--help':
  case undefined: return printHelp();
  default:        stderr(`Unknown subcommand: ${subcommand}`); process.exit(2);
}

async function runInspect(argv: string[]) {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      sample:   { type: 'string' },
      'no-cache': { type: 'boolean' },
      'no-follow-cross-origin': { type: 'boolean' },
      header:   { type: 'string', multiple: true },
      json:     { type: 'boolean' },
      tsv:      { type: 'boolean' },
      verbose:  { type: 'boolean' },
    },
  });
  if (values.json && values.tsv) { stderr('--json and --tsv mutually exclusive'); process.exit(2); }
  const url = positionals[0];
  if (!url) { stderr('Usage: act inspect <url>'); process.exit(2); }

  const result = await inspect(url, optsFrom(values));
  if (values.json)      stdout(JSON.stringify(result, null, 2));
  else if (values.tsv)  stdout(renderTsv(result));
  else                  stdout(renderHuman(result));

  process.exit(result.findings.length === 0 ? 0 : 1);
}
```

### Snippet 7 — Cross-origin mount logging (PRD-601-R8)

```ts
// packages/inspector/src/mounts.ts (excerpt)
function isSameRegistrableDomain(a: string, b: string): boolean { /* ... */ }

export async function followMount(parentUrl: string, mount: Mount, opts: WalkOptions, findings: Finding[]) {
  if (!isSameRegistrableDomain(parentUrl, mount.manifest_url)) {
    findings.push({
      severity: 'warn',
      code: 'cross-origin-mount',
      message: `Cross-origin mount: ${parentUrl} → ${mount.manifest_url}. Set --no-follow-cross-origin to suppress.`,
    });
    if (opts.noFollowCrossOrigin) {
      findings.push({
        severity: 'info', code: 'cross-origin-mount-suppressed',
        message: `Mount ${mount.prefix} → ${mount.manifest_url} not followed.`,
      });
      return null;
    }
  }
  return await walk(mount.manifest_url, opts);
}
```

### Snippet 8 — Human renderer for `inspect` (excerpt)

```ts
// packages/inspector-cli/src/renderers/human.ts (excerpt)
import chalk from 'chalk';

export function renderHuman(r: InspectResult): string {
  const lines = [
    chalk.bold(`ACT Inspector ${ACT_VERSION_LINE}`),
    `Target:    ${r.url}`,
    `Declared:  ${r.declared.level ?? '(unknown)'} / ${r.declared.delivery ?? '(unknown)'}`,
    `Endpoints:`,
    `  index:     ${r.endpoints.index}`,
    `  node:      ${r.endpoints.node_template}`,
    r.endpoints.subtree_template ? `  subtree:   ${r.endpoints.subtree_template}` : '',
    r.endpoints.index_ndjson    ? `  ndjson:    ${r.endpoints.index_ndjson}` : '',
    r.endpoints.search_template ? `  search:    ${r.endpoints.search_template}` : '',
    `Auth:      ${(r.auth.schemes ?? []).join(', ') || '(none)'}`,
    ``,
    `Tree summary:`,
    `  Total nodes:    ${r.tree_summary.total_nodes}`,
    `  Types:          ${formatTypes(r.tree_summary.types)}`,
    `  Fanout:         min ${r.tree_summary.fanout.min}, max ${r.tree_summary.fanout.max}, mean ${r.tree_summary.fanout.mean.toFixed(1)}, median ${r.tree_summary.fanout.median}`,
    `  Max depth:      ${r.tree_summary.max_depth_observed}  (sampled)`,
    ``,
    `Sampled (${r.sampled_nodes.length} of ${r.tree_summary.total_nodes}):`,
    ...r.sampled_nodes.map(formatSampledNode),
    ``,
    `Findings: ${r.findings.length === 0 ? '(none)' : ''}`,
    ...r.findings.map(formatFinding),
  ].filter(Boolean);
  return lines.join('\n');
}
```

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft. Specifies the `act` inspector CLI (subcommands `inspect`, `walk`, `diff`, `node`, `subtree`, `budget`) and the paired `@act/inspector` TypeScript library. Reuses PRD-600's parser and discovery walk to avoid drift; produces `findings` (developer-facing) rather than `gaps` (conformance-facing — PRD-600's job). Pins token-budget strategies (`breadth-first` default, `deepest-first` opt-in), diff classification (`added`, `removed`, `etag_unchanged`, `etag_changed`, `structural_change`), output formats (human, JSON, TSV), credential handling (operator-supplied `fetch` adapter; CLI never authenticates), and request budget (256 default, 32 for `inspect`, 1 req/sec/origin) paralleling PRD-600. Status moved Draft → In review. |
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review. Decisions: (1) `act walk` defaults to full walk (`--sample all`); the sample-16 default applies to `act inspect` only (Q1); (2) `--json-stream` NDJSON walk output deferred to v0.2 (Q2); (3) custom tokenizer available via programmatic API only, not CLI in v0.1 (Q3); (4) no on-disk cache for v0.1 (Q4); (5) `--ignore-fields` already specified at PRD-601-R10 / R17 (Q5). No normative changes. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
