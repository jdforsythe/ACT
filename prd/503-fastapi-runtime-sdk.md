# PRD-503 — FastAPI runtime SDK (spec only)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

PRD-500 (runtime SDK contract, In review) locks the library-side contract every framework-specific runtime ACT SDK MUST satisfy: the resolver shape, the identity / tenant hooks, capability negotiation, ETag derivation, auth & error mapping, the dispatch pipeline, and the test fixture harness. PRD-500 is expressed in TypeScript because the v0.1 first-party reference implementation is TypeScript-only per **decision Q3 (2026-04-30)**. PRD-501 (Next.js), PRD-502 (Express), and PRD-505 (Hono / generic WHATWG-fetch) are TS-first-party leaves; PRD-503 (FastAPI) and PRD-504 (Rails) are explicitly downgraded to **spec-only** PRDs — they describe the contract a Python (FastAPI) or Ruby (Rails) implementation MUST satisfy, but no first-party reference Python package ships in v0.1. Community ports are invited.

**Spec only — no v0.1 reference implementation per decision Q3.** This PRD exists so that (a) a community implementer who picks up the FastAPI port has a normative contract to build against rather than reverse-engineering the TypeScript leaves, (b) operators evaluating ACT for a Python stack can see the shape they would adopt, and (c) PRD-600 (validator) and PRD-705 (B2B SaaS workspace example) can reference the FastAPI surface without ambiguity. The PRD describes the equivalent of the PRD-500 TS interfaces in idiomatic Python — `async def` resolvers, `pydantic` models for `Identity` / `Tenant` / capabilities, FastAPI dependency injection (`Depends(...)`) for identity / tenant hooks, an `APIRouter` for mountable endpoint registration, FastAPI's response model + ETag middleware for caching, and `HTTPException`-derived classes wired to the PRD-100 / PRD-106 error envelope. The contract is specified at the same granularity as PRD-501 / PRD-502 so that a port arriving in 2026-08 or 2027-01 is structurally indistinguishable from the TS leaves at the wire layer.

The FastAPI ecosystem is concentrated and idiomatic enough that the mapping is high-fidelity — `async def` is one-to-one with TS `async`, `pydantic` models cover the `Manifest` / `Index` / `Node` / `Subtree` / `IndexEntry` envelope shapes that PRD-100 schemas already pin, and `Depends(...)` is the canonical hook point for identity / tenancy. The mapping is therefore about *naming and idiom*, not about restructuring the contract. A community implementer reading this PRD alongside PRD-500 should be able to start from the TS interfaces and translate without re-deriving any normative behavior.

### Goals

1. Specify the **conceptual mapping** from PRD-500's TypeScript interfaces (`ActRuntime`, `Outcome<T>`, `Identity`, `Tenant`, `IdentityResolver`, `TenantResolver`, `EtagComputer`, `Logger`) to idiomatic Python equivalents using `pydantic` models and `async def` callables.
2. Specify the **identity & tenancy hook pattern** as FastAPI `Depends(...)` callables, preserving PRD-500-R6 / R7 opacity and stability rules.
3. Specify the **endpoint registration pattern** as a mountable `APIRouter` returned from a `create_act_router(...)` factory, with one route per Core / Standard / Plus endpoint.
4. Specify the **ETag / caching contract** using FastAPI's response model and the standard `ETag` / `If-None-Match` headers, deriving values per PRD-103-R6 with the same JCS + SHA-256 + 22-char-base64url-truncate recipe used by PRD-500's `default_etag_computer`.
5. Specify the **auth & error mapping** using `HTTPException`-derived classes (`ActAuthRequired`, `ActNotFound`, `ActRateLimited`, `ActValidation`, `ActInternal`) wired to the closed `error.code` enum from PRD-100-R41 / PRD-106-R27 with PRD-500-R17's fixed messages.
6. Specify the **hybrid mount pattern** via `app.include_router(act_router, prefix="/app")`, satisfying PRD-500-R26 / PRD-100-R7 / PRD-106-R17–R22.
7. Specify the **content negotiation** for the index endpoint — JSON vs NDJSON profile — using FastAPI's `Accept` header parsing and a `StreamingResponse` for NDJSON, satisfying PRD-500-R16 / PRD-100-R37.
8. Specify the **discovery hand-off Link header** as FastAPI middleware on the act router, satisfying PRD-500-R29 / PRD-106-R23.
9. Specify the **construction-time validation** rule (`create_act_router` raises a `ConfigurationError` when the resolver set does not match the declared `conformance.level`) per PRD-500-R10.
10. Make the **spec-only posture** unmissable in both the Engineering preamble Problem section and the Implementation notes section opening sentence per the authoring rules in `docs/workflow.md` Phase 3.

### Non-goals

1. **Shipping a Python package in v0.1.** Per decision Q3, no first-party Python reference impl. Community ports invited; the package name `act-runtime-fastapi` is reserved by convention but not occupied by Anthropic / the spec project.
2. **Defining the wire-format envelopes.** Owned by PRD-100. PRD-503 SDKs serialize PRD-100 envelopes via `pydantic` models; they do not redefine them.
3. **Defining HTTP status-code semantics.** Owned by PRD-106. PRD-503 maps internal outcomes to PRD-106's status codes.
4. **Defining ETag derivation.** Owned by PRD-103. PRD-503 calls the recipe in idiomatic Python; it does not reimplement.
5. **Defining auth schemes.** Owned by PRD-106 (manifest declaration) and PRD-109 (security posture). PRD-503 consumes the host's existing FastAPI auth (e.g., `OAuth2PasswordBearer`, `APIKeyHeader`); it never authenticates.
6. **Defining the runtime SDK contract itself.** Owned by PRD-500. PRD-503 is one of five framework leaves under PRD-500.
7. **Streaming and long-lived connections.** Deferred to v0.2 per PRD-500 non-goal #6.
8. **Static-profile producers.** Static delivery is owned by PRD-105 + the 200-series adapters. PRD-503 is runtime-only.
9. **Component-extraction at request time.** Component contracts (PRD-300) run at build time.
10. **Specifying packaging metadata** (PyPI classifiers, version pins beyond `fastapi>=0.110`, license, etc.). Implementation concern; left to whoever ports.
11. **Search response envelope shape.** Per decision Q13, deferred to v0.2. PRD-503 documents `resolve_search` with the request shape pinned and the response body declared as opaque-but-JSON.

### Stakeholders / audience

- **Authors of:** community Python ports (no first-party port exists in v0.1); PRD-705 (B2B SaaS workspace example — primary consumer is PRD-501, but a Python-stack equivalent example is plausible in v0.2); PRD-600 (validator probes any conforming runtime, including a FastAPI port, via the wire surface).
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Spec-only PRD is read as a v0.1 deliverable and a community implementer ships a half-conformant port assuming "spec is law, ergo my port is law." | Medium | Medium | Implementation notes opening sentence and Engineering preamble Problem section both state spec-only. PRD-503-R1 makes the contract normative for any port, and PRD-503-R23 requires the port to declare the PRD revision it conforms to in package metadata. |
| Python idiom translation drifts the contract — e.g., a port treats `Outcome` as raised exceptions rather than returned values, and the `not_found` vs `auth_required` semantic mapping diverges from PRD-500's discriminated union. | Medium | High | PRD-503-R5 pins the resolver return shape as a `pydantic.BaseModel` discriminated union with the same six variants as PRD-500-R4. The port MAY surface a separate exception path internally; the resolver-level contract is by-value. |
| `pydantic` v1 vs v2 split — a community port pins to v1 and is unusable for projects on v2 (or vice versa). | Medium | Medium | PRD-503-R24 mandates the port targets `pydantic>=2.0` (the current line at 2026-05). v1 support is community-optional. The structural mapping is identical at v2. |
| FastAPI's `Depends(...)` is misused as the auth point — a port wires actual auth (e.g., decoding a JWT) inside the identity dependency, rather than treating identity as host-supplied. | High | Medium | PRD-503-R8 / R9 forbid the port's `IdentityResolver` from authenticating on its own; the resolver receives host-decoded credentials (e.g., a `Depends(oauth2_scheme)` consumed at the host layer, not at the SDK). PRD-503-R26 surfaces this as the canonical Python pattern in Implementation notes. |
| Cycle in `resolveSubtree` depth bound vs FastAPI's path parameter validation — a port lets a query-string `depth` parameter exceed PRD-100-R33 because FastAPI's `Field(le=8)` is not enforced. | Low | Low | PRD-503-R14 pins the depth bound at the resolver entry; the host's FastAPI route signature MAY use `Field(le=8)` but the SDK validates regardless. |
| Async ecosystem split — `asyncio` vs `trio`. FastAPI is `asyncio`-native via Starlette; a `trio`-only port is theoretical but would not run unmodified on standard FastAPI. | Low | Low | PRD-503-R25 declares `asyncio` is canonical for v0.1. A `trio`-based port is community-optional and out of scope. |
| Spec-only status invites scope drift — a community implementer asks for "just a small change" to the contract because the port is easier to ship that way. | Medium | Medium | PRD-503-R1 makes the contract immutable from this PRD's perspective; changes route through PRD-500 amendments per the workflow's amendment process. |

### Open questions

1. ~~Should the PRD pin a canonical Python package name (`act-runtime-fastapi`) or leave it to the implementer?~~ **Resolved (2026-05-01): Yes.** Ratifies tentative answer. PRD-503-R23 reserves `act-runtime-fastapi` on PyPI by convention even though no v0.1 release lands there. The naming convention parallels PRD-500-R28's `@act/runtime-<framework>` TS pattern; preserving it across ecosystems gives community ports a single discoverable namespace. Community ports under different names MAY exist but lose the convention's discoverability benefit. (Closes Open Question 1.)
2. ~~Should `pydantic` v1 support be normative (i.e., a port MUST support both)?~~ **Resolved (2026-05-01): No.** Ratifies tentative answer. `pydantic` v2 is canonical per PRD-503-R24. v1 ports are community-optional and not first-party-style. Mandating both would expand the port's contract surface (different `BaseModel` semantics, different validator decorator shapes) without clear benefit; v2 has been GA for over a year and is the dominant version at v0.1 authoring time. (Closes Open Question 2.)
3. ~~Should the PRD specify ASGI-level integration outside FastAPI (raw Starlette, Quart, Sanic)?~~ **Resolved (2026-05-01): No.** Ratifies tentative answer. The PRD title and framing are FastAPI-specific. A separate community PRD could cover Starlette / Quart / Sanic in v0.2; carrying them in v0.1 expands the matrix of dispatch primitives the spec must define and ports must implement. Out of v0.1 scope. (Closes Open Question 3.)
4. ~~Should the PRD document `BackgroundTasks` integration for async tenant resolution?~~ **Resolved (2026-05-01): No.** Ratifies tentative answer. Tenant resolution is synchronous from the resolver's perspective per PRD-500-R5 step 4 (the dispatch pipeline awaits tenant resolution before invoking the body resolver). `BackgroundTasks` is a post-response affordance and not in the dispatch path; documenting it would invite misuse. (Closes Open Question 4.)
5. ~~Should the PRD specify `pytest` fixture conventions for the `fixtures/500/` harness?~~ **Resolved (2026-05-01): No.** Ratifies tentative answer. PRD-500 owns the harness shape (JSON-document fixtures); the Python port is responsible for adapting `fixtures/500/` inputs to a `pytest`-friendly form. Pinning `pytest` conventions in PRD-503 would couple the spec to a specific test runner; community ports MAY use `unittest`, `pytest`, or any equivalent. Documented as a community-port checklist item. (Closes Open Question 5.)

### Acceptance criteria

- [ ] Specification opens with a table of PRD-500 / PRD-100 / PRD-103 / PRD-106 / PRD-107 / PRD-109 requirements implemented (Phase 3 addition per `docs/workflow.md`).
- [ ] Every normative requirement uses RFC 2119 keywords; ID format `PRD-503-R{n}`.
- [ ] Conformance level (Core / Standard / Plus) declared per requirement, citing PRD-107.
- [ ] The Python interface signatures (`ActRuntime` Protocol, `Outcome` discriminated union, `Identity` / `Tenant` `pydantic` models, `IdentityResolver` / `TenantResolver` callables) are shown as real Python in §"Wire format / interface definition".
- [ ] Identity and tenancy hooks are framework-neutral (callable shape) and use opaque types.
- [ ] Auth-failure mapping → 401 + `WWW-Authenticate` per scheme is specified end-to-end with a Python helper.
- [ ] Existence-non-leak rule (404 covers both "not found" and "forbidden") is specified at the FastAPI layer; cite PRD-109-R3 / PRD-500-R18.
- [ ] ETag computation references PRD-103's recipe; override hook is deterministic.
- [ ] Hybrid-mount composability rule is stated using `include_router(prefix=...)`.
- [ ] Logger hook is specified; PII restriction cited from PRD-109.
- [ ] Implementation notes section present with 3–5 short Python snippets, **opening sentence stating spec-only per Q3**.
- [ ] Test fixtures enumerated under `fixtures/503/` with names paralleling `fixtures/500/`.
- [ ] No new schemas under `schemas/503/` (port serves PRD-100 envelopes).
- [ ] Open questions ≤ 5.
- [ ] Changelog entry dated 2026-05-01 by Jeremy Forsythe.
- [ ] Spec-only posture stated in Engineering preamble Problem section AND Implementation notes opening sentence.

---

## Context & dependencies

### Depends on

- **PRD-500** (Runtime SDK contract): In review. Parent PRD; PRD-503 is one of five framework leaves. The contract — resolver shape, capability negotiation, identity / tenancy hooks, ETag computation, auth & error mapping, dispatch pipeline, hybrid mounts, Logger no-PII — is normative; PRD-503 maps it to Python idiom.
- **PRD-100** (Wire format & envelope shapes): Accepted. The Python port serializes manifest, index, node, subtree, NDJSON-index, and error envelopes per PRD-100 schemas. `pydantic` models in PRD-503 mirror those schemas.
- **PRD-103** (Caching, ETags, validators): Accepted. The Python port computes `etag` per PRD-103-R6 (runtime triple of `{identity, payload, tenant}` JCS-canonicalized, SHA-256, base64url no-padding, truncated to 22 chars, `s256:` prefix), serves the `ETag` header per PRD-103-R8 / PRD-106-R4, honors `If-None-Match` per PRD-103-R8 / PRD-106-R3, and emits `Cache-Control` / `Vary` per PRD-103-R9.
- **PRD-106** (Runtime delivery profile): Accepted. The port implements the endpoint set, status codes, auth, mounts, and discovery hand-off Link header. Specifically: PRD-106-R1 (endpoint set per level), R2 (`act_version` injection), R3–R6 (status codes), R7–R11 (auth), R12 (caching), R13–R15 (URL encoding), R16 (per-tenant ID stability), R17–R22 (mounts), R23 (discovery hand-off Link header), R26–R30 (error envelope shape).
- **PRD-107** (Conformance levels): Accepted. The port declares its level; resolver requirements depend on level (Core / Standard / Plus per R6 / R8 / R10).
- **PRD-108** (Versioning policy): Accepted. The port evolves under MAJOR/MINOR rules; the contract is pinned to `act_version: "0.1"` for v0.1.
- **PRD-109** (Security considerations): Accepted. Cite for existence-non-leak (T1, R3, R4), identity-no-leak (T2, R16, R17), per-tenant scoping (T3, R11, R13), error-message PII (T5, R14, R15), and Logger no-PII (R14).
- **000-governance**: Accepted. Lifecycle for this PRD.
- **Decision Q3** (2026-04-30): TypeScript-only first-party reference impls; PRD-503 is downgraded to spec-only with no v0.1 reference Python code.
- **Decision Q13** (2026-05-01): Search response envelope deferred to v0.2; the Python port's `resolve_search` returns opaque-but-JSON.
- External: [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174); [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) (HTTP semantics); [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288) (Link header); [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) (JCS canonicalization); [PEP 484](https://peps.python.org/pep-0484/) (type hints); [PEP 544](https://peps.python.org/pep-0544/) (`Protocol`); [pydantic v2](https://docs.pydantic.dev/2.0/); [FastAPI](https://fastapi.tiangolo.com/); [Starlette](https://www.starlette.io/).

### Blocks

- None directly — PRD-503 is a leaf with no v0.1 downstream. Future PRDs in the v0.2 cycle (e.g., a Python-stack analogue to PRD-705) MAY depend on PRD-503.

### References

- v0.1 draft: §5.13 (Runtime serving), §5.13.1 (Runtime contract), §5.13.2 (Authentication), §5.13.3 (Caching), §5.13.4 (Per-tenant scoping), §5.13.5 (Hybrid mounts), §6.6 (Runtime SDK pattern, Next.js example — TS, mapped to Python here).
- `prd/000-decisions-needed.md`: Q3 (TS-only first-party for v0.1; PRD-503 / PRD-504 spec-only), Q13 (search-body envelope deferred to v0.2).
- `prd/000-INDEX.md`: PRD-503 row marked `Draft (spec only)`; this PRD moves it to `In review`.
- Prior art: FastAPI patterns from the FastAPI tutorial (Depends, APIRouter, BackgroundTasks); the Sanic ASGI shape; Starlette routing primitives; the MCP Python SDK as a paired-spec / paired-port example of "TS-first, Python community port."

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) where requirements are imposed. Lowercase "must" and "should" are non-normative prose.

### 100-series and PRD-500 requirements implemented

The PRD-503 contract is the FastAPI-flavored, Python-idiomatic mapping of PRD-500's TypeScript contract. The table below lists every parent requirement this PRD ports to Python idiom, the Python mechanism, and the PRD-503 requirement that binds the port.

| Source requirement | Source PRD | Python mechanism | PRD-503 requirement |
|---|---|---|---|
| Resolver interface (Core: manifest, index, node) | PRD-500-R3, PRD-106-R1 | `ActRuntime` `typing.Protocol` with `async def` methods | PRD-503-R5 |
| Resolver interface (Standard: subtree) | PRD-500-R32, PRD-106-R31 | `async def resolve_subtree` registered on the runtime | PRD-503-R5, R14 |
| Resolver interface (Plus: NDJSON, search) | PRD-500-R33, R34, PRD-106-R32, R33 | `async def resolve_index_ndjson` returns `AsyncIterator[IndexEntry]`; `async def resolve_search` returns opaque JSON | PRD-503-R5, R15, R16 |
| `Outcome<T>` discriminated union | PRD-500-R4 | `pydantic` discriminated union with `kind` literal field | PRD-503-R6 |
| Identity hook | PRD-500-R6 | FastAPI `Depends(...)` returning `Identity` `pydantic` model | PRD-503-R8 |
| Tenant hook | PRD-500-R7 | FastAPI `Depends(...)` returning `Tenant` `pydantic` model | PRD-503-R9 |
| Manifest constraints | PRD-500-R8, R9, PRD-100-R3, R4, R6 | `Manifest` `pydantic` model; SDK validates resolver outputs | PRD-503-R10 |
| Capability negotiation at construction | PRD-500-R10 | `create_act_router` raises `ActConfigurationError` on mismatch | PRD-503-R11 |
| `act_version` injection | PRD-500-R12, PRD-100-R1 | Response middleware injects on serialization | PRD-503-R12 |
| ID URL-encoding helper | PRD-500-R13, PRD-100-R12, PRD-106-R14 | `encode_id_for_url(id: str) -> str` per-segment `pchar` | PRD-503-R13 |
| Auth challenge helper | PRD-500-R14, PRD-106-R8 | `build_auth_challenges(manifest) -> list[str]` | PRD-503-R17 |
| 200 response path | PRD-500-R15 | FastAPI route handlers compose `Response` with `ETag`, `Cache-Control`, `Vary`, `Content-Type` | PRD-503-R18 |
| Content negotiation (JSON / NDJSON) | PRD-500-R16, PRD-100-R37 | `Accept` header parsing + `StreamingResponse` for NDJSON | PRD-503-R19 |
| Error envelope construction | PRD-500-R17, PRD-100-R41–R44, PRD-106-R26–R30 | `HTTPException`-derived classes (`ActAuthRequired`, `ActNotFound`, `ActRateLimited`, `ActValidation`, `ActInternal`); FastAPI exception handler builds the envelope | PRD-503-R20 |
| Existence-non-leak path | PRD-500-R18, PRD-106-R6, PRD-109-R3 | `not_found_response()` helper used for both "absent" and "forbidden" branches | PRD-503-R21 |
| ETag / 304 dispatch | PRD-500-R19, PRD-103-R8, PRD-106-R3 | Middleware checks `If-None-Match` before invoking resolver | PRD-503-R22 |
| Default ETag computer | PRD-500-R20, PRD-103-R6 | `default_etag_computer(...)` Python implementation of JCS + SHA-256 + 22-char-base64url | PRD-503-R23 |
| Override determinism | PRD-500-R21, PRD-103-R7, PRD-109-R17 | Custom `EtagComputer` callable; SDK validates returned shape | PRD-503-R24 |
| Cache-Control / Vary | PRD-500-R22, PRD-103-R9, PRD-106-R12 | Response header builder driven by `Identity.kind` / `Tenant.kind` | PRD-503-R25 |
| Logger no-PII shape | PRD-500-R23, PRD-109-R14 | `Logger` `Protocol` with `event(e: ActLogEvent)` method; SDK redacts before passing | PRD-503-R26 |
| Mountability | PRD-500-R26, PRD-100-R7, PRD-106-R17–R22 | `app.include_router(act_router, prefix=...)` | PRD-503-R27 |
| Discovery hand-off Link header | PRD-500-R29, PRD-106-R23 | FastAPI middleware on the act router | PRD-503-R28 |
| Bounded `act_version` rejection | PRD-500-R30, PRD-108-R8, PRD-109-R20 | Request-side `act_version` check in dispatch | PRD-503-R29 |
| Test fixture conformance | PRD-500-R31 | Port runs `fixtures/500/` JSON harness in `pytest` | PRD-503-R30 |

The remainder of this Specification section binds a community Python port to these implementations through normative requirements with `PRD-503-R{n}` IDs.

### Conformance level

Per PRD-107, PRD-503 requirements are banded:

- **Core:** PRD-503-R1 (the contract is normative for any port), R2 (Python version baseline), R3 (FastAPI version baseline), R4 (request normalization), R5 (resolver Protocol), R6 (Outcome discriminated union), R7 (request lifecycle), R8 (identity hook), R9 (tenant hook), R10 (manifest validation), R11 (construction-time capability check), R12 (`act_version` injection), R13 (URL encoding helper), R17 (auth challenge helper), R18 (200 path), R19 (content negotiation), R20 (error envelope construction), R21 (existence-non-leak), R22 (ETag / 304 dispatch), R23 (default ETag computer), R24 (override determinism), R25 (Cache-Control / Vary), R26 (Logger no-PII), R27 (mountability), R28 (discovery hand-off), R29 (bounded act_version rejection), R30 (fixture conformance), R31 (package-name reservation), R32 (pydantic version baseline), R33 (asyncio canonical), R34 (declared-conformance metadata).
- **Standard:** PRD-503-R14 (subtree resolver registration when level ≥ Standard).
- **Plus:** PRD-503-R15 (NDJSON resolver registration when level = Plus), R16 (search resolver registration when level = Plus).

Auth scoping is orthogonal to level (per PRD-107-R4 / PRD-109-R10): a Core Python port MAY be deployed with auth required, and an unauthenticated public-tenant port MAY be Plus.

### Normative requirements

#### Meta

**PRD-503-R1.** This PRD is **spec-only** per decision Q3; no first-party Python reference implementation ships in v0.1. The Python interface signatures in §"Wire format / interface definition" are **normative** for any community port that claims FastAPI runtime SDK conformance. A port MAY widen the public API; it MUST NOT narrow it. A port that does not satisfy every PRD-503 requirement at its declared conformance level MUST NOT advertise itself as PRD-503-conformant. **(Core)**

**PRD-503-R2.** A conforming Python port MUST target Python ≥ 3.10 (for `match` statements on the `Outcome` discriminator and PEP 604 union syntax). A port MAY additionally support older Python versions; that support is community-optional. **(Core)**

**PRD-503-R3.** A conforming port MUST target FastAPI ≥ 0.110 (the line that finalized the `lifespan` API and stable `Depends` semantics). A port MAY additionally support older FastAPI lines; that support is community-optional. **(Core)**

#### Request normalization

**PRD-503-R4.** A port MUST receive incoming Starlette `Request` objects (FastAPI's request type) and pass them through to resolvers without re-wrapping. Unlike PRD-500's TS leaves which normalize to `ActRequest`, the Python port treats Starlette `Request` as the canonical request shape; the SDK passes it to resolvers via the `ActContext` (described in PRD-503-R7). The Python port is therefore lighter on adapters than the TS leaves — Starlette `Request` is itself a normalized framework-neutral primitive. **(Core)**

#### Resolver interface

**PRD-503-R5.** A host application registers an `ActRuntime` with the SDK. The `ActRuntime` is a Python `typing.Protocol` exposing the following `async def` methods, each returning an `Outcome[T]` (PRD-503-R6):

- `async def resolve_manifest(self, request: Request, ctx: ActContext) -> Outcome[Manifest]` — Core, REQUIRED.
- `async def resolve_index(self, request: Request, ctx: ActContext) -> Outcome[Index]` — Core, REQUIRED.
- `async def resolve_node(self, request: Request, ctx: ActContext, node_id: str) -> Outcome[Node]` — Core, REQUIRED.
- `async def resolve_subtree(self, request: Request, ctx: ActContext, node_id: str, depth: int) -> Outcome[Subtree]` — Standard, REQUIRED when `conformance.level` ≥ `"standard"`.
- `async def resolve_index_ndjson(self, request: Request, ctx: ActContext) -> Outcome[AsyncIterator[IndexEntry]]` — Plus, REQUIRED when `conformance.level == "plus"`.
- `async def resolve_search(self, request: Request, ctx: ActContext, query: str) -> Outcome[Any]` — Plus, REQUIRED when `conformance.level == "plus"`. The response shape is opaque-but-JSON for v0.1 per decision Q13.

`Manifest`, `Index`, `Node`, `Subtree`, and `IndexEntry` are `pydantic.BaseModel` classes corresponding to PRD-100's envelope schemas. **(Core)**

**PRD-503-R6.** The `Outcome[T]` discriminated union MUST have exactly the following variants (each a `pydantic.BaseModel` with a `kind: Literal[...]` discriminator):

- `OutcomeOk(kind: Literal["ok"], value: T)` — successful resolution; SDK serializes and returns 200 (or 304 if `If-None-Match` matches).
- `OutcomeNotFound(kind: Literal["not_found"])` — resource does not exist OR is not visible to the identity; SDK returns 404 with `error.code: "not_found"` per PRD-503-R21.
- `OutcomeAuthRequired(kind: Literal["auth_required"])` — authentication is required to satisfy this request; SDK returns 401 + `WWW-Authenticate` per advertised schemes.
- `OutcomeRateLimited(kind: Literal["rate_limited"], retry_after_seconds: int)` — rate-limited; SDK returns 429 + `Retry-After`.
- `OutcomeValidation(kind: Literal["validation"], details: dict[str, Any] | None = None)` — request body or query violated a documented constraint.
- `OutcomeInternal(kind: Literal["internal"], details: dict[str, Any] | None = None)` — server error.

A resolver MUST NOT return any other discriminator. A resolver raising an uncaught exception MUST be mapped by the SDK to `OutcomeInternal()`; the exception's message MUST NOT propagate to the response (PRD-109-R14 / R15). **(Core)**

#### Request lifecycle

**PRD-503-R7.** Every ACT request MUST traverse the SDK's dispatch pipeline in this order, mirroring PRD-500-R5:

1. Receive Starlette `Request` (the FastAPI route handler is the entry point).
2. Validate `act_version` if the request carries one (PRD-503-R29).
3. Resolve identity via the registered `IdentityResolver` `Depends(...)` (PRD-503-R8).
4. Resolve tenant via the registered `TenantResolver` `Depends(...)` if registered (PRD-503-R9).
5. Construct an `ActContext` carrying `identity`, `tenant`, and a reference to the request.
6. Honor `If-None-Match` early-exit (PRD-503-R22).
7. Invoke the appropriate resolver (PRD-503-R5).
8. Map the `Outcome[T]` to a `Response` (PRD-503-R18 / R20 / R21).
9. Apply caching headers (PRD-503-R25).
10. Apply discovery hand-off Link header (PRD-503-R28).
11. Log the event via the registered `Logger` (PRD-503-R26).

The pipeline MUST be deterministic; deviations are violations. **(Core)**

#### Identity & tenancy hooks

**PRD-503-R8.** A host application MUST register an `IdentityResolver` as a FastAPI `Depends(...)` callable returning an `Identity` `pydantic` model. `Identity` is a discriminated union of three variants:

- `IdentityAnonymous(kind: Literal["anonymous"])` — no credentials present, OR manifest declares no `auth` block.
- `IdentityPrincipal(kind: Literal["principal"], key: str)` — authenticated principal whose `key` is stable per PRD-103-R6. The `key` MUST be a stable string (UUID, user ID, principal ID); MUST NOT be a session token, JWT, or rotating value.
- `IdentityAuthRequired(kind: Literal["auth_required"], reason: Literal["missing", "expired", "invalid"] | None = None)` — credentials required; SDK MUST emit 401.

The `IdentityResolver` MUST NOT raise on missing credentials; it returns `IdentityAuthRequired`. The resolver MAY raise on infrastructure errors; the SDK MUST map a raised exception to `OutcomeInternal()`. The resolver MUST NOT authenticate on its own — it consumes the host's existing FastAPI auth (e.g., a `Depends(oauth2_scheme)` consumed at the host layer) and translates the result to an `Identity`. **(Core)**

**PRD-503-R9.** A host application MAY register a `TenantResolver` as a FastAPI `Depends(...)` callable receiving the resolved `Identity` and returning a `Tenant` `pydantic` model. `Tenant` is `TenantSingle(kind: Literal["single"])` for non-tenanted deployments OR `TenantScoped(kind: Literal["scoped"], key: str)`. The `key` MUST be stable per the same constraints as `Identity.key`. The `TenantResolver` MUST NOT mint per-request values (cite PRD-100-R15 / PRD-106-R16). For deployments without tenanting, the host omits the resolver and the SDK uses `TenantSingle()` by default. **(Core)**

#### Manifest constraints

**PRD-503-R10.** The `resolve_manifest` resolver's returned `Manifest` MUST satisfy PRD-100's manifest schema. The SDK is responsible for injecting `act_version` and `delivery: "runtime"` if the host omits them; the SDK MUST NOT silently overwrite a host-supplied `delivery: "static"` (mismatch is a startup configuration error per PRD-106-R25). The manifest's `capabilities` field MUST be a structured object per PRD-100-R6; the v0.1-draft array form is forbidden. **(Core)**

#### Capability negotiation (construction time)

**PRD-503-R11.** The factory function `create_act_router(config: ActRuntimeConfig) -> APIRouter` MUST validate, at construction time, that the registered resolver set is consistent with the manifest's declared `conformance.level`:

- Level `"core"` → at minimum `resolve_manifest`, `resolve_index`, `resolve_node` MUST be registered.
- Level `"standard"` → additionally `resolve_subtree` MUST be registered, AND `subtree_url_template` MUST be set on the manifest.
- Level `"plus"` → additionally `resolve_index_ndjson` AND `resolve_search` MUST be registered, AND `index_ndjson_url` AND `search_url_template` MUST be set on the manifest.

A mismatch MUST raise `ActConfigurationError` from `create_act_router`. The SDK MUST NOT defer the check to request time. The construction step MUST also validate that `auth.schemes` declarations in the manifest are consistent: if `auth.schemes` includes `"oauth2"`, the manifest MUST declare `auth.oauth2.{authorization_endpoint, token_endpoint, scopes_supported}` per PRD-106-R9 / PRD-109-R7. **(Core)**

#### Envelope serialization

**PRD-503-R12.** The SDK MUST inject `act_version` at the top of every envelope on the response side, per PRD-100-R1 and PRD-108-R1. The value MUST match the SDK's configured `act_version` (canonical form `"0.1"` for v0.1). The SDK MUST validate that resolver-returned envelopes do not carry a conflicting `act_version`; conflict is mapped to `OutcomeInternal()` and logged. The SDK MUST validate resolver-returned IDs against PRD-100-R10's grammar before serializing. **(Core)**

#### URL encoding helpers

**PRD-503-R13.** The port MUST expose a public helper `encode_id_for_url(node_id: str) -> str` that performs per-segment percent-encoding of an ID per PRD-100-R12 / PRD-106-R14. The helper MUST treat `/` as the segment separator (preserving it verbatim) and percent-encode each segment with the `pchar` rules of RFC 3986 §3.3. Python's `urllib.parse.quote(segment, safe="!$&'()*+,;=:@")` covers `pchar`; the port MUST use this or an equivalent. The SDK MUST decode incoming request URLs consistently per PRD-106-R15. **(Core)**

#### Standard

**PRD-503-R14.** When the manifest declares `conformance.level` in `{"standard", "plus"}`, the host MUST register `resolve_subtree`. The resolver receives `(request, ctx, node_id, depth)` where `depth` is bounded to `[0, 8]` per PRD-100-R33; the SDK validates the bound before invoking and returns `OutcomeValidation(details={"reason": "depth_out_of_range"})` if the request's depth is outside the bound. The SDK MAY supply a default `depth` of `3` per PRD-100-R33 when the request omits one. **(Standard)**

#### Plus

**PRD-503-R15.** When the manifest declares `conformance.level == "plus"`, the host MUST register `resolve_index_ndjson`. The resolver returns an `AsyncIterator[IndexEntry]`; the SDK serializes one JSON object per line with `\n` separators using a Starlette `StreamingResponse`, emitting `Content-Type: application/act-index+json; profile=ndjson; profile=runtime`. Each line MUST satisfy PRD-100's `IndexEntry` schema, including its own `etag` per PRD-103-R12. **(Plus)**

**PRD-503-R16.** When the manifest declares `conformance.level == "plus"`, the host MUST register `resolve_search`. The resolver receives `(request, ctx, query)` where `query` is the value extracted from the request's `{query}` placeholder per PRD-100-R39. The response shape is opaque-but-JSON for v0.1 per decision Q13: the SDK serializes whatever JSON-serializable value the resolver returns and emits `Content-Type: application/json; profile=runtime`. A future MINOR pins the response envelope. **(Plus)**

#### Auth challenge helper

**PRD-503-R17.** The port MUST expose a public helper `build_auth_challenges(manifest: Manifest) -> list[str]` that, given the configured manifest, returns one `WWW-Authenticate` header value per advertised scheme in `auth.schemes` order, per PRD-106-R8 and PRD-109-R5. The helper MUST emit:

- For `"cookie"`: `Cookie realm="<site.name>"`.
- For `"bearer"`: `Bearer realm="<site.name>"`.
- For `"oauth2"`: `Bearer realm="<site.name>", error="invalid_token", scope="<scopes joined by space>", authorization_uri="<authorization_endpoint>"`.
- For `"api_key"`: `Bearer realm="<site.name>"` (the default per PRD-106-R10) OR a scheme name reflecting `auth.api_key.header` if the host overrode it.

The set of headers MUST be a function of the manifest, NOT of the request URL. The SDK MUST use this helper on every 401 response. **(Core)**

#### 200 response path

**PRD-503-R18.** When a resolver returns `OutcomeOk(value=...)`, the SDK MUST:

1. Serialize the envelope via `model_dump_json` on the `pydantic` model corresponding to PRD-100's schema for the resource type.
2. Inject `act_version` and the computed `etag`.
3. Set `Content-Type` per PRD-100-R46 (`application/act-manifest+json`, `application/act-index+json`, `application/act-node+json`, `application/act-subtree+json`, with a `profile=runtime` parameter).
4. Set the `ETag` header per PRD-103-R8 / PRD-106-R4 — value is the envelope's `etag` field, double-quoted per RFC 9110 §8.8.3, no `W/` prefix.
5. Set `Cache-Control` and `Vary` per PRD-503-R25.
6. Emit the discovery hand-off Link header per PRD-503-R28.

**(Core)**

#### Content negotiation

**PRD-503-R19.** The SDK MUST honor `Accept` for the index endpoint:

- `Accept: application/act-index+json` (or `*/*`, or absent) → JSON index variant.
- `Accept: application/act-index+json; profile=ndjson` → NDJSON index variant. This MUST route to `resolve_index_ndjson` (Plus); if not registered, the SDK MUST return 406 Not Acceptable with `error.code: "validation"` and `details.reason: "ndjson_not_supported"`.

For other endpoints, `Accept` is informational; the SDK serves the canonical envelope regardless. The SDK MUST NOT serve a different envelope shape based on `Accept` — content negotiation in v0.1 is restricted to the index NDJSON / JSON pair. **(Core)**

#### Error envelope construction

**PRD-503-R20.** The SDK MUST build the error envelope per PRD-100-R41 / PRD-106-R26 from the `Outcome[T]` discriminator. The Python port implements this via FastAPI exception handlers wired to a small class hierarchy:

- `ActAuthRequired` extends `HTTPException(status_code=401)` → emits `WWW-Authenticate` per PRD-503-R17.
- `ActNotFound` extends `HTTPException(status_code=404)` → `error.code: "not_found"`.
- `ActRateLimited` extends `HTTPException(status_code=429)` → emits `Retry-After`.
- `ActValidation` extends `HTTPException(status_code=400)` (or 406 for NDJSON refusal) → `error.code: "validation"`.
- `ActInternal` extends `HTTPException(status_code=500)` → `error.code: "internal"`.

`error.message` is a fixed, code-specific human-readable string; the SDK MUST NOT propagate free-form text from the resolver into `error.message` without sanitization. The default messages per PRD-500-R17 apply verbatim. **(Core)**

#### Existence-non-leak path

**PRD-503-R21.** The SDK's 404 path MUST be a single code path used for both `OutcomeNotFound` and any case where an `IdentityResolver` returns `IdentityPrincipal` but the resolved principal cannot see the resource. The SDK MUST emit byte-for-byte identical responses for the two cases, modulo opaque non-identity-correlated request IDs (cite PRD-109-R3). The Python port implements this via a single `not_found_response()` helper that builds the response from `not_found_envelope()`. **(Core)**

#### ETag and 304

**PRD-503-R22.** Before invoking a resolver for a Core or Standard envelope, the SDK MUST:

1. Compute (or recompute) the resource's current `etag` per PRD-503-R23.
2. If the request carries `If-None-Match` matching the current `etag` byte-for-byte (modulo the double-quote wrapping of the HTTP header form), the SDK MUST emit `304 Not Modified` with the `ETag` header echoed and no body.
3. On `200`, the SDK MUST emit the `ETag` header per PRD-503-R18(4).

For NDJSON index responses, the SDK MUST emit `etag` per line; the HTTP-level `ETag` header on the NDJSON response is OPTIONAL. **(Core)**

#### Default ETag computer

**PRD-503-R23.** The SDK's `default_etag_computer(*, identity: str | None, payload: Any, tenant: str | None) -> str` MUST implement PRD-103-R6's runtime derivation recipe in idiomatic Python:

```python
def default_etag_computer(*, identity, payload, tenant):
    triple = {"identity": identity, "payload": payload, "tenant": tenant}
    canonical = jcs.canonicalize(triple)             # RFC 8785
    digest = hashlib.sha256(canonical).digest()
    b64 = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return f"s256:{b64[:22]}"
```

The default computer MUST be exported as a public symbol; community ports and host applications MUST be able to call it directly for testing. A canonical `jcs` library (e.g., `python-jcs`) is RECOMMENDED; the port MAY embed an inline JCS implementation if no maintained library exists. **(Core)**

#### Override determinism

**PRD-503-R24.** A host MAY provide a custom `EtagComputer` callable of shape `Callable[[str | None, Any, str | None], str]`. The override MUST:

1. Be deterministic given the same input triple — two replicas MUST produce the same output.
2. NOT mix request-local data into the computation (timestamps, request IDs, nonces, replica IDs); cite PRD-103-R7 / PRD-109-R17.
3. Return a value satisfying PRD-103-R2's value-shape regex `^[a-z0-9]+:[A-Za-z0-9_-]+$`.

The SDK MUST validate the returned value-shape on every override invocation; an invalid value is mapped to `OutcomeInternal()` and logged. **(Core)**

#### Cache-Control and Vary

**PRD-503-R25.** The SDK MUST set `Cache-Control` per PRD-103-R9 / PRD-106-R12 based on the resolved identity:

- `Identity.kind == "principal"` → `Cache-Control: private, must-revalidate`. The SDK MUST also set `Vary: Authorization` (or `Vary: Cookie` if the manifest's primary scheme is `cookie`).
- `Identity.kind == "anonymous"` AND `Tenant.kind == "single"` → `Cache-Control: public, max-age=<seconds>` where `<seconds>` defaults to 0 unless the host overrides.
- `Identity.kind == "anonymous"` AND `Tenant.kind == "scoped"` → `Cache-Control: public, max-age=<seconds>` AND `Vary: <tenant-disambiguating-header>`.

The SDK MUST NOT emit `Cache-Control: private` on responses derived with `identity is None`. **(Core)**

#### Logger no-PII

**PRD-503-R26.** The SDK MUST accept an opaque `Logger` `typing.Protocol` with method `event(self, e: ActLogEvent) -> None`. The SDK MUST NOT pass to the Logger:

- The full request URL when the URL carries auth-scoped identifiers (passes a redacted form).
- Identity tokens, session IDs, raw headers (passes a header summary: present scheme names, not values).
- Resolver-returned envelope content beyond `{id, type}` when the envelope is identity-scoped.
- Exception traceback strings.

The Logger MUST emit events for at least `request_received`, `identity_resolved`, `tenant_resolved`, `etag_match`, `resolver_invoked`, `response_sent`, `error` — same set as PRD-500-R24. The Logger MAY be a no-op. **(Core)**

#### Mountability

**PRD-503-R27.** The SDK MUST be mountable at any URL path. `create_act_router` returns a Starlette `APIRouter`; the host application mounts it via `app.include_router(act_router, prefix="/app")`. The well-known path becomes `/app/.well-known/act.json` when prefixed; the parent manifest's `mounts` entry MUST point at the correct effective URL. The port MUST NOT hard-code the well-known path; the path MUST be configurable. The default is `/.well-known/act.json` per PRD-100-R3. **(Core)**

#### Discovery hand-off

**PRD-503-R28.** The SDK MUST emit the discovery hand-off `Link` header per PRD-106-R23 on every authenticated response from an ACT endpoint via FastAPI middleware on the act router:

- On every 200 / 304 / 401 / 404 / 429 / 5xx response from a request the SDK dispatches.
- Header value: `</.well-known/act.json>; rel="act"; type="application/act-manifest+json"; profile="runtime"` (with `prefix` prepended if configured).

The SDK MUST NOT emit the Link header on responses outside its dispatch. The port SHOULD expose a standalone middleware (`act_link_header_middleware(*, prefix: str = "")`) the host can mount on its non-ACT branches. **(Core)**

#### Bounded `act_version` rejection

**PRD-503-R29.** The SDK MUST reject requests carrying an `act_version` (in body, query string, or `Accept-Version` header) whose MAJOR exceeds the SDK's configured MAJOR, per PRD-108-R8 / PRD-109-R20. The rejection MUST be bounded — no resolver invocation, no body parsing beyond the version string itself. The response MUST be 400 + `error.code: "validation"` + `details.reason: "act_version_unsupported"`. **(Core)**

#### Test fixture conformance

**PRD-503-R30.** A conforming Python port MUST pass the test fixture matrix under `fixtures/500/` (the parent fixtures, owned by PRD-500) when run via a Python adaptation of the SDK harness — typically `pytest` parametrized over the JSON fixture inputs. The port MAY additionally publish Python-specific fixtures under `fixtures/503/` for FastAPI-idiomatic edge cases (Starlette `Request` shaping, `Depends` interactions, `BackgroundTasks` ordering); fixture filenames are enumerated below. **(Core)**

#### Package layout & ecosystem

**PRD-503-R31.** A first-party Python port (none ships in v0.1) SHOULD use the package name `act-runtime-fastapi` on PyPI, mirroring the TS leaf naming pattern `@act/runtime-<framework>` (PRD-500-R28). A community port that publishes under a different name MAY do so; PRD-503 reserves the canonical name by convention only. **(Core)**

**PRD-503-R32.** A conforming port MUST target `pydantic >= 2.0`. Support for `pydantic v1` is community-optional and not first-party-style. The structural mapping of `Manifest` / `Index` / `Node` / `Subtree` / `IndexEntry` / `Outcome` is identical at v2; v1 ports MUST still satisfy the contract. **(Core)**

**PRD-503-R33.** The canonical async runtime is `asyncio` (FastAPI / Starlette default). A `trio`-based port is community-optional and out of v0.1 scope. **(Core)**

**PRD-503-R34.** A port MUST declare, in its package metadata (e.g., `pyproject.toml` `[project.metadata]` or a top-level `__act_spec_version__` constant), the PRD-503 revision against which it claims conformance. This value MUST be visible to operators auditing the port for spec-revision parity. **(Core)**

### Wire format / interface definition

The contract is a Python interface set, not a JSON Schema. The signatures below are normative per PRD-503-R1.

#### Core types

```python
# act_runtime_fastapi/types.py
from typing import Annotated, Any, AsyncIterator, Literal, Protocol, TypeVar
from pydantic import BaseModel, Field

# --- Identity & tenancy ---

class IdentityAnonymous(BaseModel):
    kind: Literal["anonymous"] = "anonymous"

class IdentityPrincipal(BaseModel):
    kind: Literal["principal"] = "principal"
    key: str  # stable per PRD-103-R6; not a token, not rotating.

class IdentityAuthRequired(BaseModel):
    kind: Literal["auth_required"] = "auth_required"
    reason: Literal["missing", "expired", "invalid"] | None = None

Identity = Annotated[
    IdentityAnonymous | IdentityPrincipal | IdentityAuthRequired,
    Field(discriminator="kind"),
]

class TenantSingle(BaseModel):
    kind: Literal["single"] = "single"

class TenantScoped(BaseModel):
    kind: Literal["scoped"] = "scoped"
    key: str

Tenant = Annotated[TenantSingle | TenantScoped, Field(discriminator="kind")]

# --- Resolution outcomes ---

T = TypeVar("T")

class OutcomeOk(BaseModel):
    kind: Literal["ok"] = "ok"
    value: Any  # narrowed per resolver

class OutcomeNotFound(BaseModel):
    kind: Literal["not_found"] = "not_found"

class OutcomeAuthRequired(BaseModel):
    kind: Literal["auth_required"] = "auth_required"

class OutcomeRateLimited(BaseModel):
    kind: Literal["rate_limited"] = "rate_limited"
    retry_after_seconds: int

class OutcomeValidation(BaseModel):
    kind: Literal["validation"] = "validation"
    details: dict[str, Any] | None = None

class OutcomeInternal(BaseModel):
    kind: Literal["internal"] = "internal"
    details: dict[str, Any] | None = None

Outcome = Annotated[
    OutcomeOk | OutcomeNotFound | OutcomeAuthRequired
    | OutcomeRateLimited | OutcomeValidation | OutcomeInternal,
    Field(discriminator="kind"),
]

# --- Per-request context ---

class ActContext(BaseModel):
    identity: Identity
    tenant: Tenant
    model_config = {"arbitrary_types_allowed": True}
```

#### Resolver Protocol

```python
# act_runtime_fastapi/runtime.py
from typing import Protocol, runtime_checkable
from starlette.requests import Request

@runtime_checkable
class ActRuntime(Protocol):
    async def resolve_manifest(
        self, request: Request, ctx: ActContext,
    ) -> Outcome: ...

    async def resolve_index(
        self, request: Request, ctx: ActContext,
    ) -> Outcome: ...

    async def resolve_node(
        self, request: Request, ctx: ActContext, node_id: str,
    ) -> Outcome: ...

    # Standard
    async def resolve_subtree(
        self, request: Request, ctx: ActContext, node_id: str, depth: int,
    ) -> Outcome: ...

    # Plus
    async def resolve_index_ndjson(
        self, request: Request, ctx: ActContext,
    ) -> Outcome: ...

    async def resolve_search(
        self, request: Request, ctx: ActContext, query: str,
    ) -> Outcome: ...
```

Standard / Plus methods MAY be omitted from a port-specific implementation; the runtime checker validates presence at construction time per PRD-503-R11.

#### Configuration shape

```python
# act_runtime_fastapi/config.py
from typing import Callable
from pydantic import BaseModel

class Manifest(BaseModel):
    # mirrors schemas/100/manifest.schema.json
    act_version: str
    site: dict
    delivery: Literal["static", "runtime"]
    conformance: dict
    index_url: str
    node_url_template: str
    # ... see PRD-100 for the full set
    model_config = {"extra": "allow"}

EtagComputer = Callable[[str | None, Any, str | None], str]

class Logger(Protocol):
    def event(self, e: "ActLogEvent") -> None: ...

class ActRuntimeConfig(BaseModel):
    manifest: Manifest
    runtime: ActRuntime
    identity_resolver: Callable[..., Identity]    # FastAPI Depends-callable
    tenant_resolver: Callable[..., Tenant] | None = None
    etag_computer: EtagComputer | None = None     # default: PRD-503-R23
    logger: Logger | None = None                  # default: no-op
    base_path: str = ""                           # PRD-503-R27
    anonymous_cache_seconds: int = 0
    model_config = {"arbitrary_types_allowed": True}
```

#### Construction & dispatch

```python
# act_runtime_fastapi/factory.py
from fastapi import APIRouter

class ActConfigurationError(ValueError):
    """Raised at construction time when resolver set ≠ declared level."""

def create_act_router(config: ActRuntimeConfig) -> APIRouter:
    """
    Validates the resolver set against the manifest's conformance.level
    (PRD-503-R11) and returns a mountable APIRouter wired to:
      GET <base_path>/.well-known/act.json   -> resolve_manifest
      GET <base_path>/<index_url>            -> resolve_index
      GET <base_path>/<node_url_template>    -> resolve_node
      GET <base_path>/<subtree_url_template> -> resolve_subtree (Standard)
      GET <base_path>/<index_ndjson_url>     -> resolve_index_ndjson (Plus)
      GET <base_path>/<search_url_template>  -> resolve_search (Plus)
    """
    ...
```

#### Helpers

```python
# act_runtime_fastapi/helpers.py
def encode_id_for_url(node_id: str) -> str: ...                 # PRD-503-R13
def build_auth_challenges(manifest: Manifest) -> list[str]: ... # PRD-503-R17
def default_etag_computer(*, identity, payload, tenant) -> str: ...  # PRD-503-R23
def act_link_header_middleware(*, prefix: str = ""): ...        # PRD-503-R28
```

### Errors

The Python port maps `Outcome` to HTTP responses identically to PRD-500. The mapping (mirrors PRD-500's table):

| Resolver outcome | Status | `error.code` | Headers |
|---|---|---|---|
| `OutcomeOk` | 200 (or 304 on If-None-Match match) | n/a | `ETag`, `Cache-Control`, `Vary`, `Content-Type`, discovery hand-off `Link` |
| `OutcomeAuthRequired` | 401 | `auth_required` | One `WWW-Authenticate` per advertised scheme (PRD-503-R17) |
| `OutcomeNotFound` | 404 | `not_found` | Identical body & headers regardless of "absent" vs "forbidden" (PRD-503-R21) |
| `OutcomeRateLimited` | 429 | `rate_limited` | `Retry-After: <seconds>` |
| `OutcomeValidation` | 400 (or 406 for NDJSON refusal) | `validation` | Default headers |
| `OutcomeInternal` | 500 | `internal` | Default headers; body MAY be omitted |

Construction-time configuration errors (PRD-503-R11) raise `ActConfigurationError` synchronously from `create_act_router` and never reach the wire.

---

## Examples

Examples are non-normative but consistent with the Specification.

### Example 1 — Minimum-conformant Core port construction

```python
from act_runtime_fastapi import (
    create_act_router, ActRuntimeConfig, Manifest,
    OutcomeOk, OutcomeNotFound, OutcomeAuthRequired,
    IdentityAnonymous, IdentityPrincipal, IdentityAuthRequired,
    TenantSingle, TenantScoped,
)
from fastapi import Depends, FastAPI, Request

manifest = Manifest(
    act_version="0.1",
    site={"name": "Acme Tiny Workspace"},
    delivery="runtime",
    conformance={"level": "core"},
    auth={"schemes": ["cookie"]},
    index_url="/act/index.json",
    node_url_template="/act/n/{id}.json",
)

class MyRuntime:
    async def resolve_manifest(self, request, ctx):
        return OutcomeOk(value=manifest.model_dump())

    async def resolve_index(self, request, ctx):
        if ctx.identity.kind == "auth_required":
            return OutcomeAuthRequired()
        nodes = await load_visible_nodes(ctx)
        return OutcomeOk(value={"act_version": "0.1", "nodes": nodes})

    async def resolve_node(self, request, ctx, node_id):
        if ctx.identity.kind == "auth_required":
            return OutcomeAuthRequired()
        node = await load_node(node_id, ctx)
        if node is None:
            return OutcomeNotFound()  # PRD-503-R21: same path absent & forbidden.
        return OutcomeOk(value=node)

async def identity_resolver(request: Request):
    session = request.cookies.get("session")
    if not session:
        return IdentityAuthRequired(reason="missing")
    principal = await verify_session(session)
    if not principal:
        return IdentityAuthRequired(reason="invalid")
    return IdentityPrincipal(key=principal.id)

async def tenant_resolver(request: Request, identity: Identity = Depends(identity_resolver)):
    if identity.kind != "principal":
        return TenantSingle()
    tenant = await lookup_tenant(identity.key)
    return TenantScoped(key=tenant.id)

router = create_act_router(ActRuntimeConfig(
    manifest=manifest,
    runtime=MyRuntime(),
    identity_resolver=identity_resolver,
    tenant_resolver=tenant_resolver,
))

app = FastAPI()
app.include_router(router)
```

Construction validates: level `"core"` requires `resolve_manifest`, `resolve_index`, `resolve_node` (PRD-503-R11); all three are present; construction succeeds.

### Example 2 — Plus port with NDJSON and search

```python
manifest = Manifest(
    act_version="0.1",
    site={"name": "Acme Plus Workspace"},
    delivery="runtime",
    conformance={"level": "plus"},
    auth={"schemes": ["bearer", "oauth2"], "oauth2": {...}},
    index_url="/act/index.json",
    index_ndjson_url="/act/index.ndjson",
    node_url_template="/act/n/{id}.json",
    subtree_url_template="/act/sub/{id}.json",
    search_url_template="/act/search?q={query}",
)

class PlusRuntime(MyRuntime):
    async def resolve_subtree(self, request, ctx, node_id, depth):
        # ... Standard ...
        ...

    async def resolve_index_ndjson(self, request, ctx):
        async def gen():
            async for entry in stream_index(ctx):
                yield entry
        return OutcomeOk(value=gen())

    async def resolve_search(self, request, ctx, query):
        # Response shape opaque-but-JSON per Q13.
        return OutcomeOk(value=await run_search(query, ctx))

router = create_act_router(ActRuntimeConfig(
    manifest=manifest,
    runtime=PlusRuntime(),
    identity_resolver=identity_resolver,
))
```

Construction validates that all four optional resolvers are registered for level `"plus"` (PRD-503-R11).

### Example 3 — Hybrid mount via `include_router(prefix=...)`

```python
# Workspace app at /app:
workspace_router = create_act_router(ActRuntimeConfig(
    manifest=workspace_manifest,
    runtime=WorkspaceRuntime(),
    identity_resolver=workspace_identity_resolver,
    base_path="/app",
))

app = FastAPI()
app.include_router(workspace_router, prefix="/app")
# Effective: /app/.well-known/act.json, /app/act/index.json, /app/act/n/{id}.json

# Parent manifest at /.well-known/act.json declares:
# {
#   "mounts": [
#     {"prefix": "/app", "delivery": "runtime",
#      "manifest_url": "/app/.well-known/act.json",
#      "conformance": {"level": "standard"}}
#   ]
# }
```

The runtime port is mountable; the parent's `mounts` entry references the port's effective well-known URL (PRD-503-R27 / PRD-100-R7).

### Example 4 — Identity hook reading host-decoded credentials

```python
# Host's existing auth:
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/oauth/token")

async def identity_resolver(
    request: Request,
    token: str = Depends(oauth2_scheme),  # host-supplied: SDK does NOT authenticate.
):
    if not token:
        return IdentityAuthRequired(reason="missing")
    claims = await verify_jwt(token)
    if not claims:
        return IdentityAuthRequired(reason="expired")
    # Stable per PRD-103-R6:
    return IdentityPrincipal(key=claims["sub"])
```

The hook reads the host's decoded credentials; the SDK never authenticates on its own (PRD-503-R8).

### Example 5 — Custom ETag computer (deterministic)

```python
from act_runtime_fastapi import default_etag_computer

# Pre-computed table keyed on (identity, tenant, payload-hash):
def custom_etag_computer(identity, payload, tenant):
    cached = etag_cache.get(stable_key(identity, payload, tenant))
    return cached or default_etag_computer(
        identity=identity, payload=payload, tenant=tenant,
    )

router = create_act_router(ActRuntimeConfig(
    ...,
    etag_computer=custom_etag_computer,  # PRD-503-R24: deterministic, no request-local data.
))
```

---

## Test fixtures

A community Python port runs the parent `fixtures/500/` corpus via a `pytest`-friendly adapter; it MAY additionally publish `fixtures/503/` for FastAPI-idiomatic edge cases. PRD-503 enumerates the canonical fixture filenames; the port owns the actual files when authored.

### Positive (parallels `fixtures/500/positive/`)

- `fixtures/503/positive/core-manifest-200.json` → Core port serves `/.well-known/act.json` with 200 + `act_version` injection + ETag + Link header. Satisfies PRD-503-R5, R7, R10, R12, R18, R28.
- `fixtures/503/positive/core-index-anonymous-200.json` → Anonymous request to `/act/index.json` succeeds; `Cache-Control: public, max-age=0`; no `Vary: Authorization`. Satisfies PRD-503-R5, R8 (`anonymous`), R25.
- `fixtures/503/positive/core-node-principal-200.json` → Authenticated request returns 200 with `Cache-Control: private, must-revalidate` + `Vary: Authorization`. Satisfies PRD-503-R8 (`principal`), R9, R18, R25.
- `fixtures/503/positive/core-node-304-on-if-none-match.json` → Second request with `If-None-Match` matching current ETag returns 304 with no body. Satisfies PRD-503-R22, R23.
- `fixtures/503/positive/core-401-with-three-www-authenticate.json` → Manifest declares three schemes; 401 emits three `WWW-Authenticate` headers. Satisfies PRD-503-R17.
- `fixtures/503/positive/core-existence-non-leak-symmetric-404.json` → Two requests (absent ID, present-but-forbidden ID) produce byte-for-byte identical 404 responses. Satisfies PRD-503-R20, R21.
- `fixtures/503/positive/standard-subtree-default-depth.json` → Standard port serves `/act/sub/{id}.json` with depth=3 default. Satisfies PRD-503-R5, R14.
- `fixtures/503/positive/plus-ndjson-content-negotiation.json` → `Accept: application/act-index+json; profile=ndjson` routes to `resolve_index_ndjson`. Satisfies PRD-503-R15, R19.
- `fixtures/503/positive/plus-search-opaque-json.json` → `resolve_search` returns arbitrary JSON; SDK serializes verbatim. Satisfies PRD-503-R16 (Q13).
- `fixtures/503/positive/hybrid-mount-include-router-prefix.json` → Port mounted via `include_router(prefix="/app")`; well-known URL is `/app/.well-known/act.json`. Satisfies PRD-503-R27.
- `fixtures/503/positive/discovery-link-header-on-every-act-response.json` → Every ACT-endpoint response carries the `Link: rel="act"` header. Satisfies PRD-503-R28.
- `fixtures/503/positive/etag-deterministic-across-replicas.json` → Two ports with identical configuration produce byte-identical ETags for the same `(payload, identity, tenant)` triple. Satisfies PRD-503-R23, R24.

### Negative (parallels `fixtures/500/negative/`)

- `fixtures/503/negative/level-plus-missing-search-resolver.json` → Manifest declares `conformance.level: "plus"` but `resolve_search` is not registered. `create_act_router` raises `ActConfigurationError` per PRD-503-R11.
- `fixtures/503/negative/identity-with-pii-shape.json` → `IdentityResolver` returns `IdentityPrincipal(key="alice@acme.com")` (an email). Validator emits a warning citing PRD-503-R8 / PRD-109-R14.
- `fixtures/503/negative/etag-override-with-timestamp.json` → A custom `etag_computer` mixes a timestamp into the hash input; two consecutive identical requests produce different ETags. Flagged per PRD-503-R24 / PRD-103-R7.
- `fixtures/503/negative/401-www-authenticate-varies-by-url.json` → Port varies `WWW-Authenticate` set based on requested URL. Flagged per PRD-503-R17 / PRD-106-R8.
- `fixtures/503/negative/404-leaks-existence-via-cache-control.json` → 404 for "absent" returns `Cache-Control: public`; 404 for "forbidden" returns `Cache-Control: private`. Flagged per PRD-503-R21 / PRD-109-R3.
- `fixtures/503/negative/error-message-with-pii.json` → A resolver returns `OutcomeInternal(details={"user_email": "alice@acme.com"})` and the port propagates `details` into the response. Flagged per PRD-503-R20 / PRD-109-R15.
- `fixtures/503/negative/manifest-capabilities-array-form.json` → Host configures the manifest with `capabilities: ["subtree"]`. SDK construction rejects per PRD-503-R10 / PRD-100-R6.
- `fixtures/503/negative/logger-receives-raw-token.json` → Logger receives the request's `Authorization: Bearer <token>` header verbatim. Flagged per PRD-503-R26 / PRD-109-R14.
- `fixtures/503/negative/act-version-future-major-not-rejected.json` → Request carries `Accept-Version: 999.0`; port proceeds to invoke the resolver. Flagged per PRD-503-R29 / PRD-108-R8.
- `fixtures/503/negative/discovery-link-header-missing-on-401.json` → 401 response omits the discovery hand-off Link header. Flagged per PRD-503-R28 / PRD-106-R23.

---

## Versioning & compatibility

Per PRD-108, classify each kind of change to PRD-503.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a new optional resolver method matching a future PRD-500 addition | MINOR | Existing ports do not register the new resolver until they upgrade. |
| Add a new field to `ActRuntimeConfig` with a documented default | MINOR | PRD-108-R4(1). |
| Add a new `Outcome` discriminator value | MAJOR | Closed at v0.1; PRD-108-R5(4). |
| Add a new value to `Identity.kind` or `Tenant.kind` | MAJOR | Closed enum; PRD-108-R5(4). |
| Change resolver method signatures | MAJOR | PRD-108-R5(2). Existing ports break. |
| Change the canonical Python version baseline (3.10 → 3.11+) | MAJOR | Affects existing community ports' supported runtime. |
| Change the FastAPI version baseline | MAJOR | Same. |
| Change `pydantic` v2 to a future v3 | MAJOR | Structural migration affects every port. |
| Add a new helper export | MINOR | Additive; PRD-108-R4(1). |
| Change `EtagComputer` callable signature | MAJOR | PRD-108-R5(2). |
| Pin a normative search response envelope shape (resolves Q13) | MINOR | Currently opaque-but-JSON; pinning is additive — existing producers conform automatically if they emit JSON. PRD-108-R4(1). |
| Demote the package-name reservation `act-runtime-fastapi` | MINOR | Naming-policy aside; not normative wire surface. |
| Editorial revision (typo, prose clarification) with no normative change | n/a | Per 000-governance R18. |

### Forward compatibility

A community Python port at PRD-503 v0.1 MUST tolerate unknown optional fields in `ActRuntimeConfig` and in `Manifest` envelopes per PRD-108-R7. A future v0.2 of PRD-503 adding optional config fields MUST remain construct-able with v0.1 config dicts.

A consumer of a Python port (i.e., an agent fetching ACT envelopes) is unaffected by SDK-internal contract changes — the wire surface is owned by PRD-100 / PRD-103 / PRD-106. PRD-503 contract changes are visible only to host applications and port maintainers.

### Backward compatibility

Within a MAJOR of PRD-503, every MINOR is backward-compatible with every prior MINOR. A port shipped at PRD-503 v0.1 continues to satisfy host applications written against v0.1 even after PRD-503 advances to v0.2 / v0.3. Cross-MAJOR boundaries follow PRD-108-R12's deprecation window.

The package versioning is staged per PRD-108-R14 / decision Q5: at v0.1 a community port pins to a single spec MINOR; once PRD-200 ratifies the staged transition, ports MAY transition to MAJOR-pinned / MINOR-floating.

---

## Security considerations

Security posture is owned by **PRD-109** (Accepted). PRD-503 imports the constraints by reference; specific binding points (parallel to PRD-500-§Security):

- **Existence-non-leak via 404 (T1).** PRD-503-R21 routes both "absent" and "forbidden" through a single `not_found_response()` helper with byte-identical responses. PRD-600 probes for differential headers, body length, or timing. Cite PRD-109-R3 / R4.
- **Identity-no-leak via ETag (T2).** PRD-503-R23 / R24 ensure the port's default and override ETag computers obey PRD-103-R6 / R7 — the hash output is opaque, identity is hashed not embedded, and request-local data is forbidden as input. Cite PRD-109-R16 / R17.
- **Cross-tenant cache poisoning (T3).** PRD-503-R25 emits `Vary: Authorization` (or `Vary: Cookie`) on identity-scoped responses; PRD-503-R9's `TenantResolver` ensures the tenant is part of the ETag triple. PRD-103-R6 + PRD-103-R9 own the wire-level rule.
- **Identity correlation via stable ID (T4).** PRD-503-R8 / R9 require stable opaque keys.
- **PII via free-form error message (T5).** PRD-503-R20 emits fixed code-specific messages; resolver-supplied `details` are propagated only after the SDK validates per PRD-503-R26.
- **Logger no-PII (T5 reinforcement).** PRD-503-R26 explicitly redacts URLs, headers, and resolver outputs before passing to the Logger. The Python port's Logger is the most common PII leak vector via FastAPI's structured logging integrations (e.g., `structlog`); the SDK contract makes leaks structurally impossible without an explicit override.
- **Cross-origin mount trust (T6).** Python ports are mountable (PRD-503-R27) but do not themselves enforce cross-origin trust on parent manifests — that is the consumer's job per PRD-109-R21.
- **DoS via inflated `act_version` (T7).** PRD-503-R29 reciprocates PRD-108-R8.
- **DoS via unbounded subtree depth (T7).** PRD-503-R14 bounds depth at the resolver entry per PRD-100-R33.
- **Discovery as a feature (T9).** The runtime-only Link header (PRD-503-R28) reveals the well-known path on every authenticated response by design.

A Python-specific security note: FastAPI's `Depends(...)` with `use_cache=True` (the default) caches the dependency result for the duration of the request. Identity / tenant dependencies SHOULD use the default caching to avoid re-deriving on every middleware step; ports MUST NOT cache across requests (which would break per-request identity resolution). The `IdentityResolver` MUST be a fresh `Depends` per request.

---

## Implementation notes

**Spec only — no v0.1 reference implementation per decision Q3.** The snippets below are illustrative Python; they show the canonical shape a community port would adopt, not a full implementation. No first-party `act-runtime-fastapi` package ships in v0.1; community ports are invited and SHOULD follow the patterns below to maximize structural parity with PRD-500's TS leaves and ease cross-port test sharing via the `fixtures/500/` corpus.

### Pattern 1 — The resolver shape (PRD-503-R5)

```python
from act_runtime_fastapi.types import (
    ActContext, OutcomeOk, OutcomeNotFound, OutcomeAuthRequired,
)

class MyRuntime:
    async def resolve_manifest(self, request, ctx: ActContext):
        return OutcomeOk(value=configured_manifest.model_dump())

    async def resolve_index(self, request, ctx: ActContext):
        if ctx.identity.kind == "auth_required":
            return OutcomeAuthRequired()
        nodes = await load_visible_nodes(ctx)
        return OutcomeOk(value={"act_version": "0.1", "nodes": nodes})

    async def resolve_node(self, request, ctx: ActContext, node_id: str):
        if ctx.identity.kind == "auth_required":
            return OutcomeAuthRequired()
        node = await load_node(node_id, ctx)
        if node is None:
            return OutcomeNotFound()  # PRD-503-R21: same path absent & forbidden.
        return OutcomeOk(value=node)
```

### Pattern 2 — Identity hook reading host-decoded credentials (PRD-503-R8)

```python
from fastapi import Depends, Request
from fastapi.security import OAuth2PasswordBearer
from act_runtime_fastapi.types import (
    IdentityAnonymous, IdentityAuthRequired, IdentityPrincipal,
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/oauth/token", auto_error=False)

async def identity_resolver(
    request: Request,
    token: str | None = Depends(oauth2_scheme),
):
    if token is None:
        # Public-tenant access permitted (PRD-106-R11).
        return IdentityAnonymous()
    claims = await verify_jwt(token)
    if claims is None:
        return IdentityAuthRequired(reason="expired")
    return IdentityPrincipal(key=claims["sub"])  # stable per PRD-103-R6.
```

### Pattern 3 — `create_act_router` factory (PRD-503-R11)

```python
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from act_runtime_fastapi import default_etag_computer

class ActConfigurationError(ValueError):
    pass

def create_act_router(config: ActRuntimeConfig) -> APIRouter:
    # PRD-503-R11: validate resolver set vs declared level.
    level = config.manifest.conformance["level"]
    rt = config.runtime
    if not all(hasattr(rt, m) for m in ("resolve_manifest", "resolve_index", "resolve_node")):
        raise ActConfigurationError("Core resolvers missing")
    if level in ("standard", "plus") and not hasattr(rt, "resolve_subtree"):
        raise ActConfigurationError("Standard requires resolve_subtree")
    if level == "plus":
        for m in ("resolve_index_ndjson", "resolve_search"):
            if not hasattr(rt, m):
                raise ActConfigurationError(f"Plus requires {m}")
        for f in ("index_ndjson_url", "search_url_template"):
            if not getattr(config.manifest, f, None):
                raise ActConfigurationError(f"Plus manifest missing {f}")

    router = APIRouter()

    @router.get("/.well-known/act.json")
    async def manifest_endpoint(
        request: Request,
        identity = Depends(config.identity_resolver),
        tenant = Depends(config.tenant_resolver) if config.tenant_resolver else None,
    ):
        ctx = ActContext(identity=identity, tenant=tenant or TenantSingle())
        outcome = await rt.resolve_manifest(request, ctx)
        return _build_response(outcome, ctx, config, endpoint="manifest")

    # ... index, node, subtree, ndjson, search routes wired similarly ...

    router.middleware("http")(act_link_header_middleware(prefix=config.base_path))
    return router
```

### Pattern 4 — Default ETag computer (PRD-503-R23)

```python
import base64, hashlib
import jcs  # python-jcs or equivalent RFC 8785 implementation

def default_etag_computer(*, identity: str | None, payload, tenant: str | None) -> str:
    triple = {"identity": identity, "payload": payload, "tenant": tenant}
    canonical = jcs.canonicalize(triple)
    digest = hashlib.sha256(canonical).digest()
    b64 = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return f"s256:{b64[:22]}"
```

### Pattern 5 — Existence-non-leak helper (PRD-503-R21)

```python
import json
from starlette.responses import Response

def not_found_response(*, manifest, base_path: str = "") -> Response:
    """The single 404 path, used identically for absent and forbidden."""
    body = json.dumps({
        "act_version": "0.1",
        "error": {
            "code": "not_found",
            "message": "The requested resource is not available.",
        },
    })
    return Response(
        content=body,
        status_code=404,
        media_type="application/act-error+json; profile=runtime",
        headers={
            "Cache-Control": "private, must-revalidate",
            "Link": f'<{base_path}/.well-known/act.json>; rel="act"; '
                    f'type="application/act-manifest+json"; profile="runtime"',
        },
    )
```

The same helper is called from the "node absent" branch and the "principal cannot see this node" branch; PRD-600 probes for differential responses and flags any divergence.

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft. Spec-only PRD per decision Q3 (no v0.1 reference Python implementation; community ports invited). Maps PRD-500's TypeScript runtime SDK contract to idiomatic Python / FastAPI: `pydantic` `Outcome` discriminated union, FastAPI `Depends(...)` for identity / tenant hooks, `APIRouter` factory with construction-time capability validation, `HTTPException`-derived classes for error envelope, `StreamingResponse` for NDJSON content negotiation, ASGI middleware for discovery hand-off Link header. Status moved Draft (spec only) → In review. |
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review. Decisions: (1) reserve `act-runtime-fastapi` PyPI name by convention parallel to `@act/runtime-<framework>` (Q1 yes); (2) `pydantic` v2 canonical, v1 community-optional (Q2 no); (3) no Starlette / Quart / Sanic coverage in v0.1 (Q3 no — defer to v0.2 community PRD if interest surfaces); (4) no `BackgroundTasks` integration for tenant resolution (Q4 no — tenant resolution is synchronous in the dispatch pipeline); (5) no `pytest`-specific fixture conventions (Q5 no — PRD-500 owns the harness shape, runner choice is community-port concern). No normative requirement text changed; only Open Questions section. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
