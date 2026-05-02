# PRD-504 — Rails runtime SDK (spec only)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

PRD-500 (runtime SDK contract, In review) locks the library-side contract every framework-specific runtime ACT SDK MUST satisfy. Per **decision Q3 (2026-04-30)**, the v0.1 first-party reference implementation is TypeScript-only; PRD-501 (Next.js), PRD-502 (Express), and PRD-505 (Hono / generic WHATWG-fetch) are first-party leaves. PRD-503 (FastAPI) and PRD-504 (Rails) are explicitly downgraded to **spec-only** PRDs — they describe the contract a Python (FastAPI) or Ruby (Rails) implementation MUST satisfy, but no first-party reference Ruby gem ships in v0.1. Community ports are invited.

**Spec only — no v0.1 reference implementation per decision Q3.** This PRD exists so that (a) a community implementer who picks up the Rails port has a normative contract to build against rather than reverse-engineering the TypeScript leaves, (b) operators evaluating ACT for a Ruby stack can see the shape they would adopt, and (c) PRD-600 (validator) can probe a Rails-backed runtime against the same wire surface used by the TS leaves. The PRD describes the equivalent of the PRD-500 TS interfaces in idiomatic Ruby — an `ActsController` base class with `resolve_node` / `resolve_index` / `resolve_subtree` / `resolve_manifest` / `resolve_index_ndjson` / `resolve_search` instance methods returning `Outcome` value objects, identity / tenant resolution as Rails `before_action` callbacks (or controller-level concerns), routing via an `act_routes` macro mounted from `config/routes.rb`, caching via Rails' built-in `stale?` / `fresh_when` conditional GET helpers (with the ETag value derived per PRD-103-R6), and error mapping via `rescue_from` translating Rails-side outcomes to the PRD-100 error envelope.

The Rails ecosystem is conventional enough that the mapping is high-fidelity — `before_action` is one-to-one with PRD-500's identity / tenancy hook contract, `stale?` / `fresh_when` integrate naturally with PRD-103's runtime ETag triple, and `rescue_from` covers the same ground PRD-500's `Outcome` → response mapping covers in TS. Rails is opinionated about MVC; the port adopts those opinions where they don't conflict with the contract. Where Rails idiom and the contract conflict (e.g., Rails' default to render HTML, ACT's default to return JSON), the contract wins and the PRD says so.

### Goals

1. Specify the **conceptual mapping** from PRD-500's TypeScript interfaces (`ActRuntime`, `Outcome<T>`, `Identity`, `Tenant`, `IdentityResolver`, `TenantResolver`, `EtagComputer`, `Logger`) to idiomatic Ruby equivalents.
2. Specify the **identity & tenancy hook pattern** as Rails `before_action` callbacks (or a `Concerns::ActIdentity` module), preserving PRD-500-R6 / R7 opacity and stability rules.
3. Specify the **endpoint registration pattern** as an `act_routes` routing macro consumed in `config/routes.rb`, with one route per Core / Standard / Plus endpoint mapped to `ActsController` (or a host-supplied subclass).
4. Specify the **ETag / caching contract** using Rails' built-in `stale?` / `fresh_when` conditional GET helpers, deriving values per PRD-103-R6 with the same JCS + SHA-256 + 22-char-base64url-truncate recipe used by PRD-500.
5. Specify the **auth & error mapping** using `rescue_from` and `Outcome` value objects (or alternatively a small set of `ActError` subclasses), wired to the closed `error.code` enum.
6. Specify the **hybrid mount pattern** via Rails routing scope blocks and the `act_routes` macro accepting a `path:` prefix, satisfying PRD-500-R26 / PRD-100-R7 / PRD-106-R17–R22.
7. Specify the **content negotiation** for the index endpoint — JSON vs NDJSON profile — using Rails `respond_to do |format|` and a streaming response for NDJSON (`ActionController::Live` or `Rack::Stream`), satisfying PRD-500-R16 / PRD-100-R37.
8. Specify the **discovery hand-off Link header** as a Rails `after_action` callback (or Rack middleware), satisfying PRD-500-R29 / PRD-106-R23.
9. Specify the **construction-time validation** rule (the `act_routes` macro raises a `Act::ConfigurationError` when the controller's resolver set does not match the declared `conformance.level`) per PRD-500-R10.
10. Make the **spec-only posture** unmissable in both the Engineering preamble Problem section and the Implementation notes section opening sentence per the authoring rules in `docs/workflow.md` Phase 3.

### Non-goals

1. **Shipping a Ruby gem in v0.1.** Per decision Q3, no first-party Ruby reference impl. Community ports invited; the gem name `act-runtime-rails` is reserved by convention but not occupied by Anthropic / the spec project.
2. **Defining the wire-format envelopes.** Owned by PRD-100. PRD-504 ports serialize PRD-100 envelopes; they do not redefine them.
3. **Defining HTTP status-code semantics.** Owned by PRD-106.
4. **Defining ETag derivation.** Owned by PRD-103. PRD-504 calls the recipe in idiomatic Ruby; it does not reimplement.
5. **Defining auth schemes.** Owned by PRD-106 (manifest declaration) and PRD-109 (security posture). PRD-504 consumes the host's existing Rails auth (e.g., Devise, Warden, Doorkeeper, raw `before_action :authenticate_user!`); it never authenticates.
6. **Defining the runtime SDK contract itself.** Owned by PRD-500.
7. **Streaming and long-lived connections.** Deferred to v0.2 per PRD-500 non-goal #6.
8. **Static-profile producers.** Static delivery is owned by PRD-105 + the 200-series adapters.
9. **Component-extraction at request time.** Component contracts (PRD-300) run at build time.
10. **Hotwire / Turbo integration.** ACT serves JSON; Hotwire serves HTML over the wire and is irrelevant to the ACT contract. A future v0.2 PRD MAY explore Hotwire-friendly progressive disclosure, but v0.1 is silent.
11. **Rack-only deployment outside Rails.** The PRD title and framing are Rails-specific. A separate community PRD could specify a raw Rack port (sharing the `act_routes` macro and the `ActsController` base class but consumed without `ActionController`); that is community-optional.
12. **Specifying gemspec metadata** (license, runtime dependencies, author). Implementation concern; left to whoever ports.
13. **Search response envelope shape.** Per decision Q13, deferred to v0.2. PRD-504 documents `resolve_search` with the request shape pinned and the response body declared as opaque-but-JSON.

### Stakeholders / audience

- **Authors of:** community Ruby ports (no first-party port exists in v0.1); PRD-600 (validator probes any conforming runtime, including a Rails port, via the wire surface).
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Spec-only PRD is read as a v0.1 deliverable and a community implementer ships a half-conformant gem assuming "spec is law, ergo my port is law." | Medium | Medium | Implementation notes opening sentence and Engineering preamble Problem section both state spec-only. PRD-504-R1 makes the contract normative for any port; PRD-504-R23 requires the port to declare the PRD revision it conforms to in gemspec metadata. |
| Ruby idiom translation drifts the contract — e.g., a port treats `Outcome` as raised exceptions rather than returned values, and the `not_found` vs `auth_required` semantic mapping diverges from PRD-500's discriminated union. | Medium | High | PRD-504-R5 pins the resolver return shape as `Outcome` value objects (small classes mirroring the discriminated union). The port MAY surface a separate exception path internally; the resolver-level contract is by-value. |
| Rails 7 vs 8 split — a community port pins to Rails 7 and is unusable for projects on Rails 8 (or vice versa). | Medium | Medium | PRD-504-R24 mandates the port targets Rails ≥ 7.1 (the line that finalized the Rack 3.0 transition and `ActiveSupport::Notifications` instrumentation primitives PRD-504-R26 leans on). Rails 8 is in flight at 2026-05; the port SHOULD support both lines via standard gemspec ranges. |
| `before_action :authenticate_user!` usage anti-pattern — host wires actual authentication inside the SDK's identity callback, rather than treating identity as host-supplied. | High | Medium | PRD-504-R8 / R9 forbid the port's `IdentityResolver` from authenticating on its own; it consumes the host's already-decoded credentials (`current_user`, `current_principal`, etc.) and translates to an `Identity` value. Implementation notes Pattern 2 illustrates. |
| Cycle in `resolve_subtree` depth bound vs Rails' permissive request-parameter handling — a port lets a query-string `depth` parameter exceed PRD-100-R33 because the controller doesn't constrain it. | Low | Low | PRD-504-R14 pins the depth bound at the resolver entry; the controller MAY use Rails strong-parameter validation but the SDK validates regardless. |
| `stale?` vs `fresh_when` semantics — Ruby Rails developers may use `fresh_when` and skip `stale?`, which short-circuits the response without invoking the resolver, or use `stale?` with the wrong `etag:` value-shape (Rails' default ETag-as-MD5-of-content vs PRD-103's `s256:` prefixed value). | Medium | Medium | PRD-504-R22 pins the ETag value to PRD-103-R2's regex; the port's `stale?`-based dispatch MUST pass the PRD-503-R23-style computed value, not Rails' default. PRD-504-R23 pins the recipe. |
| Spec-only status invites scope drift — a community implementer asks for "just a small change" to the contract because the port is easier to ship that way. | Medium | Medium | PRD-504-R1 makes the contract immutable from this PRD's perspective; changes route through PRD-500 amendments. |
| Cross-cutting concerns vs Rails concerns — Rails `Concerns` are a pattern, not a contract. A port might mix multiple ACT concerns into one `ApplicationController`-level hook and break per-route scoping. | Low | Low | PRD-504-R27 scopes the discovery hand-off Link header to the act router only (mirrors PRD-500-R29); a port that emits the header on non-ACT controllers is non-conformant. |

### Open questions

1. ~~Should the PRD pin a canonical gem name (`act-runtime-rails`)?~~ **Resolved (2026-05-01): Yes.** Ratifies tentative answer. PRD-504-R23 reserves the name on RubyGems by convention even though no v0.1 release lands there. The naming convention parallels PRD-500-R28's `@act/runtime-<framework>` TS pattern and PRD-503's PyPI reservation; preserving it across ecosystems gives community ports a single discoverable namespace. (Closes Open Question 1.)
2. ~~Should the PRD support both Rails 7.x and Rails 8.x?~~ **Resolved (2026-05-01): Yes.** Ratifies tentative answer. The dispatch primitives (`stale?`, `before_action`, `respond_to`, `rescue_from`) are stable across both lines; specifying against either version locks out a substantial host population. The port's gemspec dependency range is left to the implementer; the spec is version-agnostic within the documented primitive set. (Closes Open Question 2.)
3. ~~Should the port wire `ActiveSupport::Notifications` for the Logger contract?~~ **Resolved (2026-05-01): Yes (SHOULD).** Ratifies tentative answer; codified as a SHOULD in PRD-504-R29. `ActiveSupport::Notifications` is the canonical Rails observability primitive and integrates cleanly with `Rails.logger` and downstream APMs (New Relic, Datadog, Skylight). A port MAY wire a custom Logger directly, but the SHOULD documents the idiomatic Rails path. (Closes Open Question 3.)
4. ~~Should the PRD document Sidekiq integration for async tenant resolution?~~ **Resolved (2026-05-01): No.** Ratifies tentative answer. Tenant resolution is synchronous from the resolver's perspective per PRD-500-R5 step 4 (the dispatch pipeline awaits tenant resolution before invoking the body resolver). Sidekiq is a post-response background-job affordance and not in the dispatch path; documenting it would invite misuse. (Closes Open Question 4.)
5. ~~Should the PRD specify a Puma threading expectation?~~ **Resolved (2026-05-01): No.** Ratifies tentative answer. Concurrency model is Rails-host-defined; the resolver contract is thread-safe by construction (no SDK-internal mutable state per PRD-500-R5). Pinning a Puma threading expectation would couple the spec to a specific Rack server when the port works equally well on Falcon, Unicorn, or Iodine. (Closes Open Question 5.)

### Acceptance criteria

- [ ] Specification opens with a table of PRD-500 / PRD-100 / PRD-103 / PRD-106 / PRD-107 / PRD-109 requirements implemented (Phase 3 addition per `docs/workflow.md`).
- [ ] Every normative requirement uses RFC 2119 keywords; ID format `PRD-504-R{n}`.
- [ ] Conformance level (Core / Standard / Plus) declared per requirement, citing PRD-107.
- [ ] The Ruby interface signatures (`ActsController` base class, `Outcome` value object hierarchy, `Identity` / `Tenant` value objects, `IdentityResolver` / `TenantResolver` callable conventions) are shown as real Ruby in §"Wire format / interface definition".
- [ ] Identity and tenancy hooks are framework-neutral (callable shape) and use opaque types.
- [ ] Auth-failure mapping → 401 + `WWW-Authenticate` per scheme is specified end-to-end with a Ruby helper.
- [ ] Existence-non-leak rule (404 covers both "not found" and "forbidden") is specified at the Rails layer; cite PRD-109-R3 / PRD-500-R18.
- [ ] ETag computation references PRD-103's recipe; override hook is deterministic.
- [ ] Hybrid-mount composability rule is stated using the `act_routes path: "/app"` macro.
- [ ] Logger hook is specified; PII restriction cited from PRD-109; canonical mapping to `ActiveSupport::Notifications` documented.
- [ ] Implementation notes section present with 3–5 short Ruby snippets, **opening sentence stating spec-only per Q3**.
- [ ] Test fixtures enumerated under `fixtures/504/` with names paralleling `fixtures/500/`.
- [ ] No new schemas under `schemas/504/` (port serves PRD-100 envelopes).
- [ ] Open questions ≤ 5.
- [ ] Changelog entry dated 2026-05-01 by Jeremy Forsythe.
- [ ] Spec-only posture stated in Engineering preamble Problem section AND Implementation notes opening sentence.

---

## Context & dependencies

### Depends on

- **PRD-500** (Runtime SDK contract): In review. Parent PRD; PRD-504 is one of five framework leaves. The contract is normative; PRD-504 maps it to Ruby / Rails idiom.
- **PRD-100** (Wire format & envelope shapes): Accepted. The Ruby port serializes manifest, index, node, subtree, NDJSON-index, and error envelopes per PRD-100 schemas.
- **PRD-103** (Caching, ETags, validators): Accepted. The Ruby port computes `etag` per PRD-103-R6, serves `ETag` per PRD-103-R8 / PRD-106-R4, honors `If-None-Match` per PRD-103-R8 / PRD-106-R3, and emits `Cache-Control` / `Vary` per PRD-103-R9.
- **PRD-106** (Runtime delivery profile): Accepted. The port implements the endpoint set, status codes, auth, mounts, and discovery hand-off Link header.
- **PRD-107** (Conformance levels): Accepted. The port declares its level; resolver requirements depend on level.
- **PRD-108** (Versioning policy): Accepted. The contract evolves under MAJOR/MINOR rules.
- **PRD-109** (Security considerations): Accepted. Cite for existence-non-leak (T1, R3, R4), identity-no-leak (T2, R16, R17), per-tenant scoping (T3, R11, R13), error-message PII (T5, R14, R15), and Logger no-PII (R14).
- **000-governance**: Accepted. Lifecycle.
- **Decision Q3** (2026-04-30): TypeScript-only first-party reference impls; PRD-504 spec-only.
- **Decision Q13** (2026-05-01): Search response envelope deferred to v0.2.
- External: [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174); [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) (HTTP semantics); [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288) (Link header); [RFC 8785](https://www.rfc-editor.org/rfc/rfc8785) (JCS canonicalization); [Rails 7.1 release notes](https://guides.rubyonrails.org/7_1_release_notes.html) (stable Rack 3.0 baseline); [Rack 3.0](https://github.com/rack/rack/blob/main/SPEC.rdoc); [Rails Routing](https://guides.rubyonrails.org/routing.html) (DSL conventions for `act_routes` macro).

### Blocks

- None directly — PRD-504 is a leaf with no v0.1 downstream. Future PRDs in the v0.2 cycle (e.g., a Ruby-stack adapter or example) MAY depend on PRD-504.

### References

- v0.1 draft: §5.13 (Runtime serving), §5.13.1–§5.13.5 (contract, auth, caching, per-tenant scoping, hybrid mounts), §6.6 (Runtime SDK pattern, Next.js example — TS, mapped to Ruby here).
- `prd/000-decisions-needed.md`: Q3 (TS-only first-party for v0.1; PRD-503 / PRD-504 spec-only), Q13 (search-body envelope deferred to v0.2).
- `prd/000-INDEX.md`: PRD-504 row marked `Draft (spec only)`; this PRD moves it to `In review`.
- Prior art: Rails Engines pattern (mountable from `config/routes.rb`); Devise's `before_action :authenticate_user!`; Doorkeeper's OAuth integration; Pundit's policy concerns (analogous to identity / tenant hooks but inverted — Pundit asks "may this user X?" while ACT asks "what is this user's stable key?"); ActiveModel::Type::Value as inspiration for `Outcome` value objects; the MCP Ruby community implementations as a paired-spec reference.

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) where requirements are imposed. Lowercase "must" and "should" are non-normative prose.

### 100-series and PRD-500 requirements implemented

The PRD-504 contract is the Rails-flavored, Ruby-idiomatic mapping of PRD-500's TypeScript contract. The table below lists every parent requirement this PRD ports to Ruby idiom, the Rails mechanism, and the PRD-504 requirement that binds the port.

| Source requirement | Source PRD | Rails mechanism | PRD-504 requirement |
|---|---|---|---|
| Resolver interface (Core: manifest, index, node) | PRD-500-R3, PRD-106-R1 | `ActsController` instance methods `resolve_manifest` / `resolve_index` / `resolve_node` | PRD-504-R5 |
| Resolver interface (Standard: subtree) | PRD-500-R32, PRD-106-R31 | `ActsController#resolve_subtree(node_id, depth)` | PRD-504-R5, R14 |
| Resolver interface (Plus: NDJSON, search) | PRD-500-R33, R34, PRD-106-R32, R33 | `ActsController#resolve_index_ndjson` returns `Enumerator::Lazy<IndexEntry>`; `ActsController#resolve_search(query)` returns opaque JSON | PRD-504-R5, R15, R16 |
| `Outcome<T>` discriminated union | PRD-500-R4 | `Act::Outcome::Ok` / `NotFound` / `AuthRequired` / `RateLimited` / `Validation` / `Internal` value objects | PRD-504-R6 |
| Identity hook | PRD-500-R6 | `before_action`-style callback (or `Concerns::ActIdentity`) returning `Act::Identity::Anonymous` / `Principal` / `AuthRequired` | PRD-504-R8 |
| Tenant hook | PRD-500-R7 | `before_action`-style callback returning `Act::Tenant::Single` / `Scoped` | PRD-504-R9 |
| Manifest constraints | PRD-500-R8, R9, PRD-100-R3, R4, R6 | `Act::Manifest` value object with validations; SDK validates resolver outputs | PRD-504-R10 |
| Capability negotiation at construction | PRD-500-R10 | `act_routes` macro raises `Act::ConfigurationError` on mismatch | PRD-504-R11 |
| `act_version` injection | PRD-500-R12, PRD-100-R1 | Response builder injects on serialization | PRD-504-R12 |
| ID URL-encoding helper | PRD-500-R13, PRD-100-R12, PRD-106-R14 | `Act.encode_id_for_url(id)` | PRD-504-R13 |
| Auth challenge helper | PRD-500-R14, PRD-106-R8 | `Act.build_auth_challenges(manifest)` | PRD-504-R17 |
| 200 response path | PRD-500-R15 | Controller render with explicit status, headers via `response.headers[...] =` | PRD-504-R18 |
| Content negotiation (JSON / NDJSON) | PRD-500-R16, PRD-100-R37 | `respond_to do |format|` + `format.act_index_ndjson` (custom MIME) → streaming response | PRD-504-R19 |
| Error envelope construction | PRD-500-R17, PRD-100-R41–R44, PRD-106-R26–R30 | `rescue_from Act::Outcome::AuthRequired => :render_auth_required` and similar; or pattern-match dispatch on `Outcome` | PRD-504-R20 |
| Existence-non-leak path | PRD-500-R18, PRD-106-R6, PRD-109-R3 | `render_not_found` private method called for both "absent" and "forbidden" branches | PRD-504-R21 |
| ETag / 304 dispatch | PRD-500-R19, PRD-103-R8, PRD-106-R3 | `stale?(etag: computed_etag, public: false)` dispatch in each action | PRD-504-R22 |
| Default ETag computer | PRD-500-R20, PRD-103-R6 | `Act.default_etag_computer(identity:, payload:, tenant:)` Ruby implementation | PRD-504-R23 |
| Override determinism | PRD-500-R21, PRD-103-R7, PRD-109-R17 | Custom callable; SDK validates returned shape | PRD-504-R24 |
| Cache-Control / Vary | PRD-500-R22, PRD-103-R9, PRD-106-R12 | Response header builder driven by identity / tenant kind | PRD-504-R25 |
| Logger no-PII shape | PRD-500-R23, PRD-109-R14 | `Act::Logger` interface; canonical mapping to `ActiveSupport::Notifications.instrument` | PRD-504-R26 |
| Mountability | PRD-500-R26, PRD-100-R7, PRD-106-R17–R22 | `act_routes path: "/app"` (or routing scope block) | PRD-504-R27 |
| Discovery hand-off Link header | PRD-500-R29, PRD-106-R23 | `after_action :emit_act_link_header` | PRD-504-R28 |
| Bounded `act_version` rejection | PRD-500-R30, PRD-108-R8, PRD-109-R20 | `before_action` checks `act_version` parameter / header | PRD-504-R29 |
| Test fixture conformance | PRD-500-R31 | Port runs `fixtures/500/` JSON harness in `rspec` (or Minitest) | PRD-504-R30 |

The remainder of this Specification section binds a community Ruby port to these implementations through normative requirements with `PRD-504-R{n}` IDs.

### Conformance level

Per PRD-107, PRD-504 requirements are banded:

- **Core:** PRD-504-R1 (the contract is normative for any port), R2 (Ruby version baseline), R3 (Rails version baseline), R4 (request normalization), R5 (resolver method set), R6 (Outcome value-object hierarchy), R7 (request lifecycle), R8 (identity hook), R9 (tenant hook), R10 (manifest validation), R11 (construction-time capability check), R12 (`act_version` injection), R13 (URL encoding helper), R17 (auth challenge helper), R18 (200 path), R19 (content negotiation), R20 (error envelope construction), R21 (existence-non-leak), R22 (ETag / 304 dispatch), R23 (default ETag computer), R24 (override determinism), R25 (Cache-Control / Vary), R26 (Logger no-PII), R27 (mountability), R28 (discovery hand-off), R29 (bounded act_version rejection), R30 (fixture conformance), R31 (gem-name reservation), R32 (Rack version baseline), R33 (declared-conformance metadata).
- **Standard:** PRD-504-R14 (subtree resolver method registration when level ≥ Standard).
- **Plus:** PRD-504-R15 (NDJSON resolver method registration when level = Plus), R16 (search resolver method registration when level = Plus).

Auth scoping is orthogonal to level (per PRD-107-R4 / PRD-109-R10).

### Normative requirements

#### Meta

**PRD-504-R1.** This PRD is **spec-only** per decision Q3; no first-party Ruby reference implementation ships in v0.1. The Ruby interface signatures in §"Wire format / interface definition" are **normative** for any community port that claims Rails runtime SDK conformance. A port MAY widen the public API; it MUST NOT narrow it. A port that does not satisfy every PRD-504 requirement at its declared conformance level MUST NOT advertise itself as PRD-504-conformant. **(Core)**

**PRD-504-R2.** A conforming Ruby port MUST target Ruby ≥ 3.2 (for pattern-matching syntax used in the `Outcome` dispatch idiom and stable `Data.define` value-object support in 3.2+). A port MAY additionally support Ruby 3.1 with caveats; that support is community-optional. **(Core)**

**PRD-504-R3.** A conforming port MUST target Rails ≥ 7.1 (the line that finalized the Rack 3.0 transition and stable `ActiveSupport::Notifications` instrumentation). A port MAY additionally support Rails 8.x; the gemspec dependency range is left to the implementer. **(Core)**

#### Request normalization

**PRD-504-R4.** A port MUST receive incoming `ActionDispatch::Request` objects (Rails' request type) and pass them through to resolvers without re-wrapping. The Ruby port treats `ActionDispatch::Request` as the canonical request shape; the SDK passes it to resolvers via the controller instance (resolvers are instance methods on `ActsController` and access `request` directly). The Ruby port is therefore lighter on adapters than the TS leaves — `ActionDispatch::Request` is itself a normalized framework-neutral primitive. **(Core)**

#### Resolver interface

**PRD-504-R5.** A host application defines a controller subclassing `ActsController` (or includes the `Act::Resolvers` concern in its own controller) that exposes the following instance methods, each returning an `Outcome` value object (PRD-504-R6):

- `resolve_manifest -> Outcome` — Core, REQUIRED.
- `resolve_index -> Outcome` — Core, REQUIRED.
- `resolve_node(node_id) -> Outcome` — Core, REQUIRED.
- `resolve_subtree(node_id, depth) -> Outcome` — Standard, REQUIRED when `conformance.level` ≥ `"standard"`.
- `resolve_index_ndjson -> Outcome` — Plus, REQUIRED when `conformance.level == "plus"`. The wrapped value is an `Enumerator::Lazy` (or any `Enumerable` yielding `IndexEntry` value objects).
- `resolve_search(query) -> Outcome` — Plus, REQUIRED when `conformance.level == "plus"`. The response shape is opaque-but-JSON for v0.1 per decision Q13.

`Manifest`, `Index`, `Node`, `Subtree`, and `IndexEntry` are Ruby value objects (RECOMMENDED: `Data.define(...)`) corresponding to PRD-100's envelope schemas. **(Core)**

**PRD-504-R6.** The `Outcome` value-object hierarchy MUST consist of exactly the following classes (RECOMMENDED: each `Data.define(...)` or a small class with `==` overridden):

- `Act::Outcome::Ok.new(value:)` — successful resolution; SDK serializes and returns 200 (or 304 if `If-None-Match` matches).
- `Act::Outcome::NotFound.new` — resource does not exist OR is not visible to the identity; SDK returns 404 with `error.code: "not_found"` per PRD-504-R21.
- `Act::Outcome::AuthRequired.new` — authentication is required; SDK returns 401 + `WWW-Authenticate`.
- `Act::Outcome::RateLimited.new(retry_after_seconds:)` — rate-limited; SDK returns 429 + `Retry-After`.
- `Act::Outcome::Validation.new(details: nil)` — request body or query violated a documented constraint.
- `Act::Outcome::Internal.new(details: nil)` — server error.

A resolver MUST NOT return any other class. A resolver raising an uncaught exception MUST be mapped by the SDK to `Act::Outcome::Internal.new`; the exception's message MUST NOT propagate to the response (PRD-109-R14 / R15). The port SHOULD wire `rescue_from StandardError` at the controller level to enforce this. **(Core)**

#### Request lifecycle

**PRD-504-R7.** Every ACT request MUST traverse the SDK's dispatch pipeline in this order, mirroring PRD-500-R5:

1. Receive `ActionDispatch::Request` (the Rails router routes to `ActsController#action_name`).
2. Validate `act_version` if the request carries one (PRD-504-R29).
3. Resolve identity via the `before_action` identity callback (PRD-504-R8).
4. Resolve tenant via the `before_action` tenant callback (PRD-504-R9).
5. Honor `If-None-Match` early-exit via `stale?` (PRD-504-R22).
6. Invoke the appropriate resolver method (PRD-504-R5).
7. Map the `Outcome` to a response (PRD-504-R18 / R20 / R21).
8. Apply caching headers (PRD-504-R25).
9. Apply discovery hand-off Link header via `after_action` (PRD-504-R28).
10. Log the event via the registered Logger or `ActiveSupport::Notifications` (PRD-504-R26).

The pipeline MUST be deterministic; deviations are violations. **(Core)**

#### Identity & tenancy hooks

**PRD-504-R8.** A host application MUST register an identity callback as a `before_action` (or include `Act::Concerns::Identity`). The callback MUST set `@act_identity` (or call `set_act_identity(...)`) to one of:

- `Act::Identity::Anonymous.new` — no credentials present, OR manifest declares no `auth` block.
- `Act::Identity::Principal.new(key:)` — authenticated principal whose `key` is stable per PRD-103-R6. The `key` MUST be a stable string (UUID, principal ID, `User#id` cast to string); MUST NOT be a session token, a Rails `signed_id`, or any rotating value.
- `Act::Identity::AuthRequired.new(reason: nil)` — credentials required (`reason` is one of `:missing`, `:expired`, `:invalid` or `nil`); SDK MUST emit 401.

The identity callback MUST NOT raise on missing credentials; it sets `Act::Identity::AuthRequired`. The callback MAY raise on infrastructure errors; the SDK MUST map a raised exception to `Act::Outcome::Internal.new`. The callback MUST NOT authenticate on its own — it consumes the host's existing Rails auth (`current_user`, `current_principal`, Devise / Warden / Doorkeeper) and translates the result. **(Core)**

**PRD-504-R9.** A host application MAY register a tenant callback as a `before_action` (after the identity callback). The callback MUST set `@act_tenant` to `Act::Tenant::Single.new` (non-tenanted) or `Act::Tenant::Scoped.new(key:)`. The `key` MUST be stable per the same constraints as `Act::Identity::Principal#key`. The callback MUST NOT mint per-request values (cite PRD-100-R15 / PRD-106-R16). For deployments without tenanting, the host omits the callback and the SDK uses `Act::Tenant::Single.new` by default. **(Core)**

#### Manifest constraints

**PRD-504-R10.** The `resolve_manifest` resolver's returned `Manifest` MUST satisfy PRD-100's manifest schema. The SDK is responsible for injecting `act_version` and `delivery: "runtime"` if the host omits them; the SDK MUST NOT silently overwrite a host-supplied `delivery: "static"` (mismatch is a startup configuration error per PRD-106-R25). The manifest's `capabilities` field MUST be a Ruby `Hash` (NOT a Ruby `Array`) per PRD-100-R6. **(Core)**

#### Capability negotiation (construction time)

**PRD-504-R11.** The `act_routes` routing macro (defined below) MUST validate, at boot time (when `config/routes.rb` is evaluated), that the controller's resolver method set is consistent with the manifest's declared `conformance.level`:

- Level `"core"` → `resolve_manifest`, `resolve_index`, `resolve_node` MUST be defined on the controller.
- Level `"standard"` → additionally `resolve_subtree` MUST be defined, AND `subtree_url_template` MUST be set on the manifest.
- Level `"plus"` → additionally `resolve_index_ndjson` AND `resolve_search` MUST be defined, AND `index_ndjson_url` AND `search_url_template` MUST be set on the manifest.

A mismatch MUST raise `Act::ConfigurationError` from the macro. The SDK MUST NOT defer the check to request time. The boot step MUST also validate that `auth.schemes` declarations are consistent: if `auth.schemes` includes `"oauth2"`, the manifest MUST declare `auth.oauth2.{authorization_endpoint, token_endpoint, scopes_supported}`. **(Core)**

#### Envelope serialization

**PRD-504-R12.** The SDK MUST inject `act_version` at the top of every envelope on the response side, per PRD-100-R1 and PRD-108-R1. The value MUST match the SDK's configured `act_version` (canonical form `"0.1"` for v0.1). The SDK MUST validate that resolver-returned envelopes do not carry a conflicting `act_version`; conflict is mapped to `Act::Outcome::Internal.new` and logged. The SDK MUST validate resolver-returned IDs against PRD-100-R10's grammar before serializing. **(Core)**

#### URL encoding helpers

**PRD-504-R13.** The port MUST expose a public helper `Act.encode_id_for_url(node_id)` that performs per-segment percent-encoding of an ID per PRD-100-R12 / PRD-106-R14. The helper MUST treat `/` as the segment separator (preserving it verbatim) and percent-encode each segment with the `pchar` rules of RFC 3986 §3.3. Ruby's `ERB::Util.url_encode` is too aggressive (it encodes `:`, `@`, `+`, etc., which `pchar` permits unencoded); the port MUST use `URI.encode_www_form_component` per segment, OR a dedicated `pchar` encoder. **(Core)**

#### Standard

**PRD-504-R14.** When the manifest declares `conformance.level` in `{"standard", "plus"}`, the controller MUST define `resolve_subtree(node_id, depth)`. The method receives a `node_id` and `depth` where `depth` is bounded to `[0, 8]` per PRD-100-R33; the SDK validates the bound before invoking and returns `Act::Outcome::Validation.new(details: { reason: "depth_out_of_range" })` if the request's depth is outside the bound. The SDK MAY supply a default `depth` of `3` per PRD-100-R33. **(Standard)**

#### Plus

**PRD-504-R15.** When the manifest declares `conformance.level == "plus"`, the controller MUST define `resolve_index_ndjson`. The method returns `Act::Outcome::Ok.new(value: enumerator)` where `enumerator` is an `Enumerator::Lazy` (or any `Enumerable`) yielding `IndexEntry` value objects; the SDK serializes one JSON object per line with `\n` separators using `ActionController::Live` or `Rack::Stream`, emitting `Content-Type: application/act-index+json; profile=ndjson; profile=runtime`. Each line MUST satisfy PRD-100's `IndexEntry` schema, including its own `etag` per PRD-103-R12. **(Plus)**

**PRD-504-R16.** When the manifest declares `conformance.level == "plus"`, the controller MUST define `resolve_search(query)`. The response shape is opaque-but-JSON for v0.1 per decision Q13: the SDK serializes whatever JSON-serializable Ruby value the resolver returns (Hash, Array, String, etc.) and emits `Content-Type: application/json; profile=runtime`. **(Plus)**

#### Auth challenge helper

**PRD-504-R17.** The port MUST expose a public helper `Act.build_auth_challenges(manifest)` that returns an `Array<String>` of `WWW-Authenticate` header values, one per advertised scheme in `auth.schemes` order, per PRD-106-R8 and PRD-109-R5. The helper MUST emit:

- For `"cookie"`: `Cookie realm="<site.name>"`.
- For `"bearer"`: `Bearer realm="<site.name>"`.
- For `"oauth2"`: `Bearer realm="<site.name>", error="invalid_token", scope="<scopes joined by space>", authorization_uri="<authorization_endpoint>"`.
- For `"api_key"`: `Bearer realm="<site.name>"` (the default per PRD-106-R10) OR a scheme name reflecting `auth.api_key.header` if the host overrode it.

The set of headers MUST be a function of the manifest, NOT of the request URL. The SDK MUST use this helper on every 401 response; Rails' default behavior of emitting a single `WWW-Authenticate` line MUST be overridden — Rails permits multiple via `response.headers["WWW-Authenticate"]` set to a comma-joined string OR via `response.set_header` repeated calls; the port MUST emit one HTTP header line per scheme. **(Core)**

#### 200 response path

**PRD-504-R18.** When a resolver returns `Act::Outcome::Ok.new(value:)`, the SDK MUST:

1. Serialize the envelope via `value.to_h.to_json` (or the equivalent for the value-object type).
2. Inject `act_version` and the computed `etag`.
3. Set `Content-Type` per PRD-100-R46 (`application/act-manifest+json`, `application/act-index+json`, `application/act-node+json`, `application/act-subtree+json`, with a `profile=runtime` parameter). Custom MIME types are registered via `Mime::Type.register("application/act-node+json", :act_node)` (see Implementation notes Pattern 4).
4. Set the `ETag` header per PRD-103-R8 / PRD-106-R4 — value is the envelope's `etag` field, double-quoted per RFC 9110 §8.8.3, no `W/` prefix. The port MUST NOT use Rails' default ETag (MD5 of body) — Rails' default is overridden by passing `etag:` to `stale?` / `fresh_when`.
5. Set `Cache-Control` and `Vary` per PRD-504-R25.
6. Emit the discovery hand-off Link header per PRD-504-R28.

**(Core)**

#### Content negotiation

**PRD-504-R19.** The SDK MUST honor `Accept` for the index endpoint:

- `Accept: application/act-index+json` (or `*/*`, or absent) → JSON index variant.
- `Accept: application/act-index+json; profile=ndjson` → NDJSON index variant. This MUST route to `resolve_index_ndjson` (Plus); if not defined, the SDK MUST return 406 Not Acceptable with `error.code: "validation"` and `details.reason: "ndjson_not_supported"`.

The port wires this via `respond_to do |format| format.act_index_json { ... }; format.act_index_ndjson { ... } end` after registering the custom MIME types (Pattern 4 in Implementation notes). For other endpoints, `Accept` is informational. The SDK MUST NOT serve a different envelope shape based on `Accept` outside the index NDJSON / JSON pair. **(Core)**

#### Error envelope construction

**PRD-504-R20.** The SDK MUST build the error envelope per PRD-100-R41 / PRD-106-R26 from the `Outcome` value object. The Ruby port implements this via pattern-matched dispatch (recommended) or via `rescue_from` + sentinel exceptions. A canonical pattern-match implementation (Ruby ≥ 3.2):

```ruby
case outcome
in Act::Outcome::Ok(value:)              then render_ok(value)
in Act::Outcome::AuthRequired            then render_auth_required
in Act::Outcome::NotFound                then render_not_found
in Act::Outcome::RateLimited(retry_after_seconds:)
                                         then render_rate_limited(retry_after_seconds)
in Act::Outcome::Validation(details:)    then render_validation(details)
in Act::Outcome::Internal(details:)      then render_internal(details)
end
```

`error.message` is a fixed, code-specific human-readable string; the SDK MUST NOT propagate free-form text from the resolver into `error.message` without sanitization. The default messages per PRD-500-R17 apply verbatim. **(Core)**

#### Existence-non-leak path

**PRD-504-R21.** The SDK's 404 path MUST be a single code path used for both `Act::Outcome::NotFound` and any case where the identity callback has set `Act::Identity::Principal` but the resolved principal cannot see the resource. The SDK MUST emit byte-for-byte identical responses for the two cases, modulo opaque non-identity-correlated request IDs (cite PRD-109-R3). The port MUST implement this as a single `render_not_found` private method on `ActsController` that builds the response from a single `not_found_envelope` helper. Producers using `rescue_from ActiveRecord::RecordNotFound` MUST route those through `render_not_found` rather than letting Rails' default error page render — Rails' default leaks information by varying `Content-Type` (HTML vs JSON) on the existence-vs-forbidden axis. **(Core)**

#### ETag and 304

**PRD-504-R22.** Before invoking a resolver for a Core or Standard envelope, the SDK MUST:

1. Compute (or recompute) the resource's current `etag` per PRD-504-R23.
2. Use Rails' `stale?(etag: computed_etag, last_modified: nil, public: false)` (or `fresh_when`) to honor `If-None-Match`. When the computed ETag matches, Rails emits `304 Not Modified` with the `ETag` header echoed and no body.
3. On `200`, the SDK MUST emit the `ETag` header per PRD-504-R18(4); Rails' `stale?` already does this when passed an explicit `etag:`.

Critical idiom note: Rails' default `fresh_when(record)` computes an ETag from the record's `cache_key`, which is NOT PRD-103's recipe. The port MUST pass an explicit `etag:` derived from PRD-504-R23 — never rely on the Rails default. The port MUST also disable Rails' `etag_with_template` middleware on the act router to prevent Rails from appending its template-derived ETag to the response. **(Core)**

For NDJSON index responses, the SDK MUST emit `etag` per line; the HTTP-level `ETag` header on the NDJSON response is OPTIONAL.

#### Default ETag computer

**PRD-504-R23.** The SDK's `Act.default_etag_computer(identity:, payload:, tenant:)` MUST implement PRD-103-R6's runtime derivation recipe in idiomatic Ruby. A canonical Ruby implementation:

```ruby
def self.default_etag_computer(identity:, payload:, tenant:)
  triple = { "identity" => identity, "payload" => payload, "tenant" => tenant }
  canonical = Act::JCS.canonicalize(triple)              # RFC 8785
  digest = Digest::SHA256.digest(canonical)
  b64 = Base64.urlsafe_encode64(digest, padding: false)
  "s256:#{b64[0, 22]}"
end
```

The default computer MUST be exported as a public class method; community ports and host applications MUST be able to call it directly for testing. A canonical `Act::JCS` module is RECOMMENDED; the port MAY embed an inline JCS implementation if no maintained gem exists at port time. **(Core)**

#### Override determinism

**PRD-504-R24.** A host MAY provide a custom ETag computer as a callable (a `Proc`, lambda, or any object responding to `#call(identity:, payload:, tenant:)`). The override MUST:

1. Be deterministic given the same input triple — two replicas MUST produce the same output.
2. NOT mix request-local data into the computation (timestamps, request IDs, nonces, replica IDs); cite PRD-103-R7 / PRD-109-R17.
3. Return a value satisfying PRD-103-R2's value-shape regex `\A[a-z0-9]+:[A-Za-z0-9_\-]+\z`.

The SDK MUST validate the returned value-shape on every override invocation; an invalid value is mapped to `Act::Outcome::Internal.new` and logged. **(Core)**

#### Cache-Control and Vary

**PRD-504-R25.** The SDK MUST set `Cache-Control` per PRD-103-R9 / PRD-106-R12 based on the resolved identity:

- `Act::Identity::Principal` → `Cache-Control: private, must-revalidate`. The SDK MUST also set `Vary: Authorization` (or `Vary: Cookie` if the manifest's primary scheme is `cookie`).
- `Act::Identity::Anonymous` AND `Act::Tenant::Single` → `Cache-Control: public, max-age=<seconds>` where `<seconds>` defaults to 0 unless the host overrides.
- `Act::Identity::Anonymous` AND `Act::Tenant::Scoped` → `Cache-Control: public, max-age=<seconds>` AND `Vary: <tenant-disambiguating-header>`.

The port MUST override Rails' default `Cache-Control: max-age=0, private, must-revalidate` on anonymous responses where `Act::Tenant::Single` applies. The port MUST NOT emit `Cache-Control: private` on responses with anonymous identity. **(Core)**

#### Logger no-PII

**PRD-504-R26.** The SDK MUST accept an opaque Logger interface (RECOMMENDED: an object responding to `#event(payload)` where `payload` is a Hash). The port SHOULD additionally emit events via `ActiveSupport::Notifications.instrument("event_name.act", payload)` so Rails-native subscribers (StatsD, Datadog, OpenTelemetry exporters) integrate cleanly. The SDK MUST NOT pass to the Logger:

- The full request URL when the URL carries auth-scoped identifiers (passes a redacted form).
- Identity tokens, session IDs, raw headers (passes a header summary: present scheme names, not values).
- Resolver-returned envelope content beyond `{id, type}` when the envelope is identity-scoped.
- Exception backtraces.

The Logger MUST emit events for at least `request_received`, `identity_resolved`, `tenant_resolved`, `etag_match`, `resolver_invoked`, `response_sent`, `error` — same set as PRD-500-R24. **(Core)**

#### Mountability

**PRD-504-R27.** The SDK MUST be mountable at any URL path. The `act_routes` macro accepts a `path:` argument:

```ruby
# config/routes.rb
Rails.application.routes.draw do
  scope "/app" do
    act_routes controller: "workspace_act", manifest: WORKSPACE_MANIFEST
  end
end
```

The well-known path becomes `/app/.well-known/act.json` when the macro is mounted under a `scope`; the parent manifest's `mounts` entry MUST point at the correct effective URL. The port MUST NOT hard-code the well-known path; the path MUST be configurable via a `well_known_path:` argument to the macro. The default is `/.well-known/act.json` per PRD-100-R3. **(Core)**

#### Discovery hand-off

**PRD-504-R28.** The SDK MUST emit the discovery hand-off `Link` header per PRD-106-R23 on every authenticated response from an ACT endpoint. The port wires this as `after_action :emit_act_link_header` on `ActsController`:

- On every 200 / 304 / 401 / 404 / 429 / 5xx response from an action the SDK dispatches.
- Header value: `</.well-known/act.json>; rel="act"; type="application/act-manifest+json"; profile="runtime"` (with the route prefix prepended if configured).

The SDK MUST NOT emit the Link header on responses outside its dispatch (the host application is responsible for non-ACT controllers; PRD-504 implementation notes describe a Rack middleware pattern for hosts that want global emission). The port SHOULD expose a standalone Rack middleware `Act::LinkHeaderMiddleware` for the host to mount on its non-ACT branches. **(Core)**

#### Bounded `act_version` rejection

**PRD-504-R29.** The SDK MUST reject requests carrying an `act_version` (in body, query string, or `Accept-Version` header) whose MAJOR exceeds the SDK's configured MAJOR, per PRD-108-R8 / PRD-109-R20. The rejection MUST be bounded — no resolver invocation, no body parsing beyond the version string itself. The response MUST be 400 + `error.code: "validation"` + `details.reason: "act_version_unsupported"`. The port wires this as a `before_action` running before identity / tenant / resolver. **(Core)**

#### Test fixture conformance

**PRD-504-R30.** A conforming Ruby port MUST pass the test fixture matrix under `fixtures/500/` (the parent fixtures, owned by PRD-500) when run via a Ruby adaptation of the SDK harness — typically RSpec or Minitest parametrized over the JSON fixture inputs, using `Rack::Test` or `ActionDispatch::IntegrationTest` for the HTTP layer. The port MAY additionally publish Ruby-specific fixtures under `fixtures/504/` for Rails-idiomatic edge cases (Rails ETag override, MIME registration, `before_action` ordering); fixture filenames are enumerated below. **(Core)**

#### Package layout & ecosystem

**PRD-504-R31.** A first-party Ruby port (none ships in v0.1) SHOULD use the gem name `act-runtime-rails` on RubyGems, mirroring the TS leaf naming pattern `@act/runtime-<framework>` (PRD-500-R28). A community port that publishes under a different name MAY do so; PRD-504 reserves the canonical name by convention only. **(Core)**

**PRD-504-R32.** A conforming port MUST target Rack ≥ 3.0 (the line that finalized header-as-Array semantics PRD-504-R17 leans on for emitting one `WWW-Authenticate` per scheme). **(Core)**

**PRD-504-R33.** A port MUST declare, in its gemspec metadata (e.g., `spec.metadata["act_spec_version"] = "0.1"`), the PRD-504 revision against which it claims conformance. This value MUST be visible to operators auditing the port for spec-revision parity. **(Core)**

### Wire format / interface definition

The contract is a Ruby interface set, not a JSON Schema. The signatures below are normative per PRD-504-R1.

#### Core types

```ruby
# act-runtime-rails/lib/act/identity.rb
module Act
  module Identity
    Anonymous    = Data.define
    Principal    = Data.define(:key)            # stable per PRD-103-R6
    AuthRequired = Data.define(:reason)         # :missing | :expired | :invalid | nil
  end

  module Tenant
    Single = Data.define
    Scoped = Data.define(:key)                  # stable per PRD-103-R6
  end

  module Outcome
    Ok           = Data.define(:value)
    NotFound     = Data.define
    AuthRequired = Data.define
    RateLimited  = Data.define(:retry_after_seconds)
    Validation   = Data.define(:details)        # Hash | nil
    Internal     = Data.define(:details)        # Hash | nil
  end

  Manifest    = Data.define(:act_version, :site, :delivery, :conformance,
                            :index_url, :node_url_template, :auth, :extras)
  Index       = Data.define(:act_version, :nodes)
  IndexEntry  = Data.define(:id, :type, :title, :summary, :tokens, :etag, :extras)
  Node        = Data.define(:act_version, :id, :type, :title, :etag, :summary,
                            :content, :tokens, :extras)
  Subtree     = Data.define(:act_version, :root_id, :nodes, :depth, :truncated)
end
```

#### Resolver method set

```ruby
# act-runtime-rails/lib/act/resolvers.rb
module Act
  module Resolvers
    extend ActiveSupport::Concern

    # Core (REQUIRED).
    def resolve_manifest;       raise NotImplementedError; end
    def resolve_index;          raise NotImplementedError; end
    def resolve_node(node_id);  raise NotImplementedError; end

    # Standard (REQUIRED when level >= "standard").
    def resolve_subtree(node_id, depth);  raise NotImplementedError; end

    # Plus (REQUIRED when level == "plus").
    def resolve_index_ndjson;             raise NotImplementedError; end
    def resolve_search(query);            raise NotImplementedError; end
  end
end
```

A host's controller `include`s `Act::Resolvers` and overrides the methods at its declared level. The macro `act_routes` validates the method set at boot time per PRD-504-R11.

#### Controller base class

```ruby
# act-runtime-rails/app/controllers/acts_controller.rb
class ActsController < ActionController::API
  include Act::Resolvers

  before_action :reject_future_act_version    # PRD-504-R29
  before_action :resolve_act_identity         # PRD-504-R8 (host overrides)
  before_action :resolve_act_tenant           # PRD-504-R9 (host overrides; default Single)

  after_action  :emit_act_link_header         # PRD-504-R28

  rescue_from StandardError, with: :render_internal_outcome  # PRD-504-R6 last-resort

  # Action methods (manifest, index, node, subtree, ndjson, search) wired in act_routes.
  # Each action invokes the corresponding resolver, dispatches on the Outcome.
end
```

#### Routing macro

```ruby
# act-runtime-rails/lib/act/routing.rb
module Act
  module Routing
    def act_routes(controller:, manifest:, well_known_path: "/.well-known/act.json")
      # PRD-504-R11: validate resolver set vs declared level at boot time.
      Act::ConfigurationCheck.run!(controller: controller, manifest: manifest)

      level = manifest.conformance.fetch(:level)

      get well_known_path, to: "#{controller}#manifest"
      get manifest.index_url, to: "#{controller}#index"
      get manifest.node_url_template.gsub("{id}", "*node_id"), to: "#{controller}#node"

      if %w[standard plus].include?(level)
        get manifest.subtree_url_template.gsub("{id}", "*node_id"),
            to: "#{controller}#subtree"
      end

      if level == "plus"
        get manifest.index_ndjson_url, to: "#{controller}#index_ndjson"
        get manifest.search_url_template.gsub(/\{query\}.*$/, ""),
            to: "#{controller}#search"
      end
    end
  end
end

ActionDispatch::Routing::Mapper.include(Act::Routing)
```

#### Helpers

```ruby
# act-runtime-rails/lib/act/helpers.rb
module Act
  def self.encode_id_for_url(node_id);          end  # PRD-504-R13
  def self.build_auth_challenges(manifest);     end  # PRD-504-R17
  def self.default_etag_computer(identity:, payload:, tenant:); end  # PRD-504-R23

  class LinkHeaderMiddleware                       # PRD-504-R28
    def initialize(app, prefix: "");  end
    def call(env);                    end
  end

  class ConfigurationError < StandardError; end    # PRD-504-R11
end
```

### Errors

The Ruby port maps `Outcome` to HTTP responses identically to PRD-500. The mapping (mirrors PRD-500's table):

| Resolver outcome | Status | `error.code` | Headers |
|---|---|---|---|
| `Act::Outcome::Ok` | 200 (or 304 on If-None-Match match) | n/a | `ETag`, `Cache-Control`, `Vary`, `Content-Type`, discovery hand-off `Link` |
| `Act::Outcome::AuthRequired` | 401 | `auth_required` | One `WWW-Authenticate` per advertised scheme (PRD-504-R17) |
| `Act::Outcome::NotFound` | 404 | `not_found` | Identical body & headers regardless of "absent" vs "forbidden" (PRD-504-R21) |
| `Act::Outcome::RateLimited` | 429 | `rate_limited` | `Retry-After: <seconds>` |
| `Act::Outcome::Validation` | 400 (or 406 for NDJSON refusal) | `validation` | Default headers |
| `Act::Outcome::Internal` | 500 | `internal` | Default headers; body MAY be omitted |

Boot-time configuration errors (PRD-504-R11) raise `Act::ConfigurationError` synchronously when `config/routes.rb` is evaluated; Rails fails to boot with a descriptive message.

---

## Examples

Examples are non-normative but consistent with the Specification.

### Example 1 — Minimum-conformant Core port construction

```ruby
# config/routes.rb
WORKSPACE_MANIFEST = Act::Manifest.new(
  act_version: "0.1",
  site: { name: "Acme Tiny Workspace" },
  delivery: "runtime",
  conformance: { level: "core" },
  index_url: "/act/index.json",
  node_url_template: "/act/n/{id}.json",
  auth: { schemes: ["cookie"] },
  extras: {},
)

Rails.application.routes.draw do
  act_routes controller: "workspace_act", manifest: WORKSPACE_MANIFEST
end
```

```ruby
# app/controllers/workspace_act_controller.rb
class WorkspaceActController < ActsController
  def resolve_manifest
    Act::Outcome::Ok.new(value: WORKSPACE_MANIFEST)
  end

  def resolve_index
    return Act::Outcome::AuthRequired.new if @act_identity.is_a?(Act::Identity::AuthRequired)
    nodes = load_visible_nodes(@act_identity, @act_tenant)
    Act::Outcome::Ok.new(value: Act::Index.new(act_version: "0.1", nodes: nodes))
  end

  def resolve_node(node_id)
    return Act::Outcome::AuthRequired.new if @act_identity.is_a?(Act::Identity::AuthRequired)
    node = load_node(node_id, @act_identity, @act_tenant)
    return Act::Outcome::NotFound.new if node.nil?  # PRD-504-R21: same path absent & forbidden.
    Act::Outcome::Ok.new(value: node)
  end

  private

  # PRD-504-R8: identity callback consumes host's existing auth.
  def resolve_act_identity
    if (user = current_user)
      @act_identity = Act::Identity::Principal.new(key: user.id.to_s)
    elsif session[:user_id]
      @act_identity = Act::Identity::AuthRequired.new(reason: :expired)
    else
      @act_identity = Act::Identity::AuthRequired.new(reason: :missing)
    end
  end

  # PRD-504-R9: tenant callback.
  def resolve_act_tenant
    @act_tenant = if @act_identity.is_a?(Act::Identity::Principal)
                    Act::Tenant::Scoped.new(key: current_user.tenant_id.to_s)
                  else
                    Act::Tenant::Single.new
                  end
  end
end
```

Boot validates: level `"core"` requires `resolve_manifest`, `resolve_index`, `resolve_node` (PRD-504-R11); all three are defined; Rails boots.

### Example 2 — Plus port with NDJSON and search

```ruby
PLUS_MANIFEST = Act::Manifest.new(
  act_version: "0.1",
  site: { name: "Acme Plus Workspace" },
  delivery: "runtime",
  conformance: { level: "plus" },
  index_url:           "/act/index.json",
  index_ndjson_url:    "/act/index.ndjson",
  node_url_template:   "/act/n/{id}.json",
  subtree_url_template:"/act/sub/{id}.json",
  search_url_template: "/act/search?q={query}",
  auth: { schemes: ["bearer", "oauth2"], oauth2: { authorization_endpoint: "...", token_endpoint: "...", scopes_supported: ["act.read"] } },
  extras: {},
)

class PlusActController < ActsController
  # ... resolve_manifest, resolve_index, resolve_node ...

  def resolve_subtree(node_id, depth)
    # ... Standard ...
  end

  def resolve_index_ndjson
    Act::Outcome::Ok.new(value: stream_index(@act_identity, @act_tenant).lazy)
  end

  def resolve_search(query)
    # Response shape opaque-but-JSON per Q13.
    Act::Outcome::Ok.new(value: run_search(query, @act_identity, @act_tenant))
  end
end
```

Boot validates that all four optional resolver methods are defined for level `"plus"` (PRD-504-R11).

### Example 3 — Hybrid mount via routing scope

```ruby
# config/routes.rb
Rails.application.routes.draw do
  # Apex marketing site (static-emitting; not relevant to PRD-504 directly,
  # but the parent manifest at /.well-known/act.json declares the mount):
  get "/.well-known/act.json", to: "marketing_act#manifest"

  # Workspace mount at /app:
  scope "/app" do
    act_routes controller: "workspace_act",
               manifest: WORKSPACE_MANIFEST  # see Example 1
  end
end

# Effective:
#   /app/.well-known/act.json
#   /app/act/index.json
#   /app/act/n/{id}.json
#
# Parent manifest declares:
#   "mounts": [
#     { "prefix": "/app", "delivery": "runtime",
#       "manifest_url": "/app/.well-known/act.json",
#       "conformance": { "level": "standard" } }
#   ]
```

The runtime port is mountable via Rails routing scopes; the parent's `mounts` entry references the port's effective well-known URL (PRD-504-R27 / PRD-100-R7).

### Example 4 — Identity hook reading host-decoded credentials (Devise)

```ruby
class WorkspaceActController < ActsController
  # Devise sets current_user via its own before_action; we DO NOT re-authenticate.
  before_action :authenticate_user!, except: [:manifest]   # Devise's hook
  # Our identity callback runs after Devise's:
  before_action :resolve_act_identity

  private

  def resolve_act_identity
    if user_signed_in?
      @act_identity = Act::Identity::Principal.new(key: current_user.id.to_s)
    else
      @act_identity = Act::Identity::Anonymous.new
    end
  end
end
```

The hook reads the host's decoded credentials (`current_user`); the SDK never authenticates on its own (PRD-504-R8).

### Example 5 — `stale?` integration with PRD-103 ETag

```ruby
class WorkspaceActController < ActsController
  def node
    node_id = params[:node_id]
    outcome = resolve_node(node_id)
    return dispatch_non_ok(outcome) unless outcome.is_a?(Act::Outcome::Ok)

    node = outcome.value
    computed_etag = Act.default_etag_computer(
      identity: identity_key(@act_identity),
      payload:  node.to_h.except(:etag),
      tenant:   tenant_key(@act_tenant),
    )
    node = node.with(etag: computed_etag)

    # PRD-504-R22: stale? handles If-None-Match → 304 with the explicit etag value.
    if stale?(etag: computed_etag, public: false)
      response.content_type = "application/act-node+json; profile=runtime"
      render json: { act_version: "0.1", **node.to_h }
    end
    # When stale? returns false, Rails has already emitted 304 + ETag header.
  end
end
```

The action passes the computed `s256:...` value to Rails' `stale?`; Rails' default cache-key-derived ETag is bypassed (PRD-504-R22).

---

## Test fixtures

A community Ruby port runs the parent `fixtures/500/` corpus via an RSpec or Minitest adapter; it MAY additionally publish `fixtures/504/` for Rails-idiomatic edge cases. PRD-504 enumerates the canonical fixture filenames; the port owns the actual files when authored.

### Positive (parallels `fixtures/500/positive/`)

- `fixtures/504/positive/core-manifest-200.json` → Core port serves `/.well-known/act.json` with 200 + `act_version` injection + ETag + Link header. Satisfies PRD-504-R5, R7, R10, R12, R18, R28.
- `fixtures/504/positive/core-index-anonymous-200.json` → Anonymous request to `/act/index.json` succeeds; `Cache-Control: public, max-age=0`; no `Vary: Authorization`. Satisfies PRD-504-R5, R8 (`Anonymous`), R25.
- `fixtures/504/positive/core-node-principal-200.json` → Authenticated request returns 200 with `Cache-Control: private, must-revalidate` + `Vary: Authorization`. Satisfies PRD-504-R8 (`Principal`), R9, R18, R25.
- `fixtures/504/positive/core-node-304-on-if-none-match.json` → Second request with `If-None-Match` matching current ETag returns 304 with no body via `stale?`. Satisfies PRD-504-R22, R23.
- `fixtures/504/positive/core-401-with-three-www-authenticate.json` → Manifest declares three schemes; 401 emits three `WWW-Authenticate` headers (one HTTP header line each, NOT comma-joined). Satisfies PRD-504-R17.
- `fixtures/504/positive/core-existence-non-leak-symmetric-404.json` → Two requests (absent ID, present-but-forbidden ID) produce byte-for-byte identical 404 responses via `render_not_found`. Satisfies PRD-504-R20, R21.
- `fixtures/504/positive/standard-subtree-default-depth.json` → Standard port serves `/act/sub/{id}.json` with depth=3 default. Satisfies PRD-504-R5, R14.
- `fixtures/504/positive/plus-ndjson-content-negotiation.json` → `Accept: application/act-index+json; profile=ndjson` routes to `resolve_index_ndjson` via `respond_to`. Satisfies PRD-504-R15, R19.
- `fixtures/504/positive/plus-search-opaque-json.json` → `resolve_search` returns arbitrary JSON; SDK serializes verbatim. Satisfies PRD-504-R16 (Q13).
- `fixtures/504/positive/hybrid-mount-routing-scope.json` → Port mounted via `scope "/app" do act_routes ... end`; well-known URL is `/app/.well-known/act.json`. Satisfies PRD-504-R27.
- `fixtures/504/positive/discovery-link-header-on-every-act-response.json` → Every ACT-endpoint response carries the `Link: rel="act"` header via `after_action`. Satisfies PRD-504-R28.
- `fixtures/504/positive/etag-deterministic-across-replicas.json` → Two ports (e.g., two Puma workers) with identical configuration produce byte-identical ETags for the same `(payload, identity, tenant)` triple. Satisfies PRD-504-R23, R24.
- `fixtures/504/positive/etag-overrides-rails-default.json` → Port-supplied ETag (`s256:...`) overrides Rails' default cache-key-derived ETag; HTTP `ETag` header byte-equals the envelope `etag` field. Satisfies PRD-504-R22.

### Negative (parallels `fixtures/500/negative/`)

- `fixtures/504/negative/level-plus-missing-search-resolver.json` → Manifest declares `conformance.level: "plus"` but `resolve_search` is not defined on the controller. `act_routes` raises `Act::ConfigurationError` at boot per PRD-504-R11.
- `fixtures/504/negative/identity-with-pii-shape.json` → Identity callback sets `Act::Identity::Principal.new(key: "alice@acme.com")` (an email). Validator emits a warning citing PRD-504-R8 / PRD-109-R14.
- `fixtures/504/negative/etag-override-with-timestamp.json` → A custom ETag computer mixes `Time.now.to_i` into the hash input; two consecutive identical requests produce different ETags. Flagged per PRD-504-R24 / PRD-103-R7.
- `fixtures/504/negative/401-www-authenticate-comma-joined.json` → Port emits a single `WWW-Authenticate` header with comma-joined challenges (Rails' default header-set behavior) instead of one HTTP header line per scheme. Flagged per PRD-504-R17 / PRD-106-R8.
- `fixtures/504/negative/404-leaks-existence-via-cache-control.json` → 404 for "absent" returns `Cache-Control: public`; 404 for "forbidden" returns `Cache-Control: private`. Flagged per PRD-504-R21 / PRD-109-R3.
- `fixtures/504/negative/error-message-with-pii.json` → A resolver returns `Act::Outcome::Internal.new(details: { user_email: "alice@acme.com" })` and the port propagates `details` into the response. Flagged per PRD-504-R20 / PRD-109-R15.
- `fixtures/504/negative/manifest-capabilities-array-form.json` → Host configures the manifest with `capabilities: ["subtree"]`. SDK boot rejects per PRD-504-R10 / PRD-100-R6.
- `fixtures/504/negative/logger-receives-raw-token.json` → Logger receives the request's `Authorization: Bearer <token>` header verbatim through an `ActiveSupport::Notifications` subscriber. Flagged per PRD-504-R26 / PRD-109-R14.
- `fixtures/504/negative/act-version-future-major-not-rejected.json` → Request carries `Accept-Version: 999.0`; port proceeds to invoke the resolver. Flagged per PRD-504-R29 / PRD-108-R8.
- `fixtures/504/negative/discovery-link-header-missing-on-401.json` → 401 response omits the discovery hand-off Link header (e.g., `after_action` not running on `rescue_from` paths). Flagged per PRD-504-R28 / PRD-106-R23.
- `fixtures/504/negative/rails-default-etag-leaks.json` → Action uses `fresh_when(record)` (Rails default) instead of `stale?(etag: computed_etag)`; HTTP `ETag` header is Rails' MD5-of-body, not the PRD-103-shape `s256:...` value. Flagged per PRD-504-R22 / PRD-103-R3.

---

## Versioning & compatibility

Per PRD-108, classify each kind of change to PRD-504.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a new optional resolver method matching a future PRD-500 addition | MINOR | Existing ports do not define the new method until they upgrade. |
| Add a new keyword argument to `act_routes` with a documented default | MINOR | PRD-108-R4(1). |
| Add a new `Outcome` value-object class | MAJOR | Closed at v0.1; PRD-108-R5(4). |
| Add a new value to the `Identity` or `Tenant` class set | MAJOR | Closed; PRD-108-R5(4). |
| Change resolver method signatures (add a required parameter) | MAJOR | PRD-108-R5(2). |
| Change the canonical Ruby version baseline (3.2 → 3.3+) | MAJOR | Affects existing community ports' supported runtime. |
| Change the canonical Rails baseline (7.1 → 8.0+) | MAJOR | Same. |
| Change the canonical Rack baseline | MAJOR | Same. |
| Add a new helper export | MINOR | Additive; PRD-108-R4(1). |
| Change ETag computer callable signature | MAJOR | PRD-108-R5(2). |
| Pin a normative search response envelope shape (resolves Q13) | MINOR | Currently opaque-but-JSON; pinning is additive — existing producers conform automatically if they emit JSON. PRD-108-R4(1). |
| Demote the gem-name reservation `act-runtime-rails` | MINOR | Naming-policy aside; not normative wire surface. |
| Drop optional Hotwire / Turbo accommodation | n/a | Not part of PRD-504 v0.1 surface. |
| Editorial revision (typo, prose clarification) with no normative change | n/a | Per 000-governance R18. |

### Forward compatibility

A community Ruby port at PRD-504 v0.1 MUST tolerate unknown optional fields in `Manifest` envelopes per PRD-108-R7. A future v0.2 of PRD-504 adding optional macro keyword arguments MUST remain construct-able with v0.1 callers.

A consumer of a Ruby port (i.e., an agent fetching ACT envelopes) is unaffected by SDK-internal contract changes — the wire surface is owned by PRD-100 / PRD-103 / PRD-106. PRD-504 contract changes are visible only to host applications and port maintainers.

### Backward compatibility

Within a MAJOR of PRD-504, every MINOR is backward-compatible with every prior MINOR. A port shipped at PRD-504 v0.1 continues to satisfy host applications written against v0.1 even after PRD-504 advances to v0.2 / v0.3. Cross-MAJOR boundaries follow PRD-108-R12's deprecation window.

The package versioning is staged per PRD-108-R14 / decision Q5: at v0.1 a community port pins to a single spec MINOR; once PRD-200 ratifies the staged transition, ports MAY transition to MAJOR-pinned / MINOR-floating.

---

## Security considerations

Security posture is owned by **PRD-109** (Accepted). PRD-504 imports the constraints by reference; specific binding points (parallel to PRD-500-§Security):

- **Existence-non-leak via 404 (T1).** PRD-504-R21 routes both "absent" and "forbidden" through a single `render_not_found` private method with byte-identical responses. Rails' default `rescue_from ActiveRecord::RecordNotFound` MUST be redirected through this single path; the default behavior leaks `Content-Type` (HTML vs JSON) on the existence-vs-forbidden axis. Cite PRD-109-R3 / R4.
- **Identity-no-leak via ETag (T2).** PRD-504-R23 / R24 ensure the port's default and override ETag computers obey PRD-103-R6 / R7. Critically, Rails' default ETag (MD5 of response body) MUST be overridden — Rails' default does NOT include identity / tenant in the input, so identical responses for two principals would share an ETag, causing cache poisoning. Cite PRD-109-R16 / R17.
- **Cross-tenant cache poisoning (T3).** PRD-504-R25 emits `Vary: Authorization` (or `Vary: Cookie`) on identity-scoped responses; PRD-504-R9's tenant callback ensures the tenant is part of the ETag triple. PRD-103-R6 + PRD-103-R9 own the wire-level rule.
- **Identity correlation via stable ID (T4).** PRD-504-R8 / R9 require stable opaque keys.
- **PII via free-form error message (T5).** PRD-504-R20 emits fixed code-specific messages.
- **Logger no-PII (T5 reinforcement).** PRD-504-R26 explicitly redacts URLs, headers, and resolver outputs. Rails' default `Rails.logger.info { params.inspect }` would be a major leak; ports MUST instrument via the SDK's Logger contract, not via raw `Rails.logger`. The recommended `ActiveSupport::Notifications` integration funnels events through redacting subscribers.
- **Cross-origin mount trust (T6).** Ruby ports are mountable (PRD-504-R27) but do not themselves enforce cross-origin trust on parent manifests — that is the consumer's job per PRD-109-R21.
- **DoS via inflated `act_version` (T7).** PRD-504-R29 reciprocates PRD-108-R8.
- **DoS via unbounded subtree depth (T7).** PRD-504-R14 bounds depth at the resolver entry per PRD-100-R33.
- **Discovery as a feature (T9).** The runtime-only Link header (PRD-504-R28) reveals the well-known path on every authenticated response by design.

A Rails-specific security note: Rails enables CSRF protection by default for non-API controllers via `protect_from_forgery`. ACT endpoints serve JSON to authenticated agents and SHOULD inherit `ActionController::API` (which omits CSRF protection by default). A port that subclasses `ActionController::Base` instead of `ActionController::API` MUST disable CSRF for ACT endpoints (`skip_before_action :verify_authenticity_token`) — otherwise an authenticated agent without a CSRF token receives 422, which is not in the PRD-100 status code set.

---

## Implementation notes

**Spec only — no v0.1 reference implementation per decision Q3.** The snippets below are illustrative Ruby; they show the canonical shape a community port would adopt, not a full implementation. No first-party `act-runtime-rails` gem ships in v0.1; community ports are invited and SHOULD follow the patterns below to maximize structural parity with PRD-500's TS leaves and ease cross-port test sharing via the `fixtures/500/` corpus.

### Pattern 1 — The resolver shape (PRD-504-R5)

```ruby
class WorkspaceActController < ActsController
  def resolve_manifest
    Act::Outcome::Ok.new(value: configured_manifest)
  end

  def resolve_index
    return Act::Outcome::AuthRequired.new if @act_identity.is_a?(Act::Identity::AuthRequired)
    nodes = load_visible_nodes(@act_identity, @act_tenant)
    Act::Outcome::Ok.new(value: Act::Index.new(act_version: "0.1", nodes: nodes))
  end

  def resolve_node(node_id)
    return Act::Outcome::AuthRequired.new if @act_identity.is_a?(Act::Identity::AuthRequired)
    node = load_node(node_id, @act_identity, @act_tenant)
    return Act::Outcome::NotFound.new if node.nil?  # PRD-504-R21: absent & forbidden.
    Act::Outcome::Ok.new(value: node)
  end
end
```

### Pattern 2 — Identity hook reading host-decoded credentials (PRD-504-R8)

```ruby
class ApplicationController < ActionController::API
  before_action :authenticate_with_jwt!  # host's existing auth, sets @current_principal

  def authenticate_with_jwt!
    auth = request.headers["Authorization"]
    @current_principal = decode_jwt(auth&.delete_prefix("Bearer "))
  end
end

class WorkspaceActController < ActsController
  # Note: do NOT re-implement authentication here.
  private

  def resolve_act_identity
    if @current_principal
      @act_identity = Act::Identity::Principal.new(key: @current_principal.id.to_s)
    elsif request.headers["Authorization"]
      @act_identity = Act::Identity::AuthRequired.new(reason: :expired)
    else
      @act_identity = Act::Identity::AuthRequired.new(reason: :missing)
    end
  end
end
```

The hook reads the host's already-decoded credentials; the SDK never authenticates on its own.

### Pattern 3 — Default ETag computer (PRD-504-R23)

```ruby
require "digest"
require "base64"

module Act
  def self.default_etag_computer(identity:, payload:, tenant:)
    triple    = { "identity" => identity, "payload" => payload, "tenant" => tenant }
    canonical = JCS.canonicalize(triple)               # RFC 8785
    digest    = Digest::SHA256.digest(canonical)
    b64       = Base64.urlsafe_encode64(digest, padding: false)
    "s256:#{b64[0, 22]}"
  end
end
```

### Pattern 4 — MIME registration (PRD-504-R19, PRD-504-R18(3))

```ruby
# config/initializers/act_mime_types.rb
Mime::Type.register("application/act-manifest+json", :act_manifest)
Mime::Type.register("application/act-index+json",    :act_index_json)
Mime::Type.register("application/act-index+json; profile=ndjson",
                    :act_index_ndjson)
Mime::Type.register("application/act-node+json",     :act_node)
Mime::Type.register("application/act-subtree+json",  :act_subtree)
Mime::Type.register("application/act-error+json",    :act_error)
```

```ruby
# In ActsController#index:
respond_to do |format|
  format.act_index_json   { render_index_json   }   # PRD-504-R19
  format.act_index_ndjson { render_index_ndjson }   # PRD-504-R15 (Plus only)
  format.any              { head :not_acceptable }
end
```

### Pattern 5 — Existence-non-leak helper (PRD-504-R21)

```ruby
class ActsController < ActionController::API
  private

  def render_not_found
    response.headers["Cache-Control"] = "private, must-revalidate"
    render(
      status: 404,
      content_type: "application/act-error+json; profile=runtime",
      json: {
        act_version: "0.1",
        error: { code: "not_found",
                 message: "The requested resource is not available." },
      },
    )
    # PRD-504-R28 after_action emits the discovery hand-off Link header.
  end

  # Used identically by Outcome::NotFound dispatch AND by per-node
  # forbidden-but-existent branches (the resolver returns NotFound for both).
end
```

The same helper handles "node absent" and "principal cannot see this node"; PRD-600 probes for differential responses and flags any divergence.

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft. Spec-only PRD per decision Q3 (no v0.1 reference Ruby implementation; community ports invited). Maps PRD-500's TypeScript runtime SDK contract to idiomatic Ruby / Rails: `Act::Outcome::*` value objects via `Data.define`, `before_action` callbacks for identity / tenant hooks, `act_routes` routing macro with boot-time capability validation, `rescue_from` + pattern-match dispatch for error envelope, `respond_to` with custom MIME registration for content negotiation, `stale?(etag:)` for ETag / 304, `after_action` for discovery hand-off Link header. Status moved Draft (spec only) → In review. |
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review. Decisions: (1) reserve `act-runtime-rails` RubyGems name by convention (Q1 yes); (2) support Rails 7.x and 8.x (Q2 yes — dispatch primitives stable across lines); (3) `ActiveSupport::Notifications` SHOULD wire the Logger contract (Q3 yes — canonical Rails observability primitive); (4) no Sidekiq integration for tenant resolution (Q4 no — tenant resolution is synchronous in the dispatch pipeline); (5) no Puma threading expectation (Q5 no — host-defined concurrency, resolver contract is thread-safe by construction). No normative requirement text changed; only Open Questions section. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
