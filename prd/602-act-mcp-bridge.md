# PRD-602 — ACT-MCP bridge

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

ACT and MCP solve adjacent problems. ACT is a discovery and content-tree contract — given a site or product, what nodes exist, what summaries describe them, where do consumers fetch full content. MCP (Model Context Protocol) is a bidirectional client/server protocol used by hosts (Claude desktop, IDE integrations) to expose tools and resources to a model. There is meaningful overlap: an MCP server that exposes documentation as `Resource`s effectively answers "what does this product look like?" — exactly what an ACT manifest answers, modulo wire format. SaaS products that ship MCP servers today often want their content tree to be ACT-discoverable too, and ACT producers increasingly want their content reachable by MCP clients. PRD-602 is the bridge: a single TypeScript server that, given an ACT resolver (PRD-500 contract), mounts BOTH (a) ACT runtime endpoints and (b) an MCP server exposing the same content as MCP resources.

The bridge is high-leverage for B2B SaaS adoption (draft Appendix B Front 3) and gates PRD-706 (hybrid static + runtime + MCP example). Without it, operators wire two parallel servers — one ACT (PRD-501) and one MCP — and risk drift between them. With it, the same resolver feeds both surfaces.

Per decision Q6: MCP 1.0 minimum + forward-compat shim. The bridge declares MCP 1.0 as the minimum supported version; it tolerates unknown optional fields per MCP's own forward-compat rules; and it documents an explicit subset of MCP fields it produces and fields it ignores. PRD-602 MUST flag escalation if MCP's versioning posture cannot support the shim safely; in that case, recommend deferring PRD-602 to v0.2.

The mapping from ACT to MCP is the substantive work. ACT node id → MCP resource URI under the canonical scheme `act://<host>/<id>`. ACT manifest capabilities → MCP server capabilities advertised at MCP initialization. ACT search (Plus) → MCP `search` if MCP supports it; otherwise the bridge degrades to client-side filtering. ACT subtree has no exact MCP equivalent; the bridge MAY synthesize an MCP `Resource` whose body is a list of child resource URIs. Identity propagation flows MCP client identity → ACT identity hook (host-supplied resolver), so per-tenant content surfaces correctly on both protocols.

PRD-100 (Accepted) defines the ACT wire format. PRD-106 (Accepted) defines the runtime delivery profile. PRD-109 (Accepted) defines the project-wide threat model. PRD-500 (In review) defines the runtime SDK contract that the bridge consumes for the ACT side. PRD-501 (In review) is the canonical TS leaf SDK an operator could plug into the bridge. PRD-600 (In review) is the validator and a sibling tool. PRD-706 (hybrid example) gates on this PRD.

### Goals

1. State that PRD-602 commits to **MCP 1.0 minimum + forward-compat shim** per decision Q6, with an explicit escalation clause if MCP's versioning posture can't support the shim.
2. Lock the **bridge architecture**: a single TS server (`@act/mcp-bridge`) that, given an `ActRuntime` (PRD-500-R3) and an `McpServer` configuration, mounts ACT runtime endpoints (delegating to a chosen PRD-500 leaf SDK) AND an MCP server exposing each ACT node as an MCP `Resource`.
3. Lock the **ACT → MCP mapping**: ACT node id → MCP resource URI under `act://<host>/<id>`; ACT manifest capabilities → MCP server capabilities; ACT search → MCP `search` (if available) else client-side filtering; ACT subtree → list-of-resources MCP resource.
4. Lock the **identity propagation**: MCP client identity (per MCP's auth contract) → ACT `IdentityResolver` input; the bridge ensures the same principal is seen on both protocols.
5. Lock the **forward-compat shim**: explicit list of MCP 1.0 fields the bridge produces; explicit list of MCP 1.x fields the bridge tolerates as unknown; behavior on receiving an unknown REQUIRED field (reject with documented error).
6. Lock the **failure-mode mapping**: ACT errors (PRD-500's `Outcome` discriminated union) → MCP error envelope. Specifically, ACT's `404` becomes MCP "resource not found"; ACT's `401` becomes MCP "auth required" with a documented hint; ACT's `403` becomes MCP "access denied"; ACT's `500` becomes MCP "internal error".
7. Lock the **conformance bands**: the bridge inherits the ACT producer's declared conformance level; the MCP side advertises capabilities reflecting that level.
8. Lock the **escalation requirement**: PRD-602 MUST be re-reviewed if MCP issues a 1.x MINOR that breaks the documented shim. The escalation path is: surface the breakage in PRD-602's changelog, recommend a v0.2 deferral or a MAJOR PRD-602 amendment, and notify the BDFL.
9. Specify the **manifest discovery path**: an ACT consumer reaching the bridge via `/.well-known/act.json` MUST receive the runtime-profile manifest. An MCP client reaching the bridge via the MCP transport (stdio or HTTP+SSE) MUST receive the MCP initialization handshake.
10. Document the **deployment model**: the bridge runs as a single Node process exposing two transports — HTTP (for ACT runtime) and stdio or HTTP+SSE (for MCP).
11. Enumerate the **test-fixture matrix** under `fixtures/602/positive/` and `fixtures/602/negative/`.

### Non-goals

1. **Defining MCP itself.** MCP is an external protocol owned by Anthropic / the broader MCP working group. PRD-602 consumes MCP 1.0; it does not specify MCP.
2. **Defining the ACT runtime contract.** Owned by PRD-500 and PRD-106.
3. **Defining the ACT wire format.** Owned by PRD-100.
4. **MCP server authentication.** PRD-602 plumbs identity from MCP's auth context to ACT's `IdentityResolver`, but it does not define how MCP authenticates clients (that is MCP's contract).
5. **MCP tool exposition.** PRD-602 v0.1 exposes ACT nodes as MCP **resources** only, not as MCP **tools**. A future v0.2 MAY add `search` as a tool; for v0.1, search is exposed as a resource (via `search_url_template` advertisement) AND optionally as MCP's native search capability when available.
6. **Embeddings / dense retrieval.** Out of scope (PRD-603 deferred to v0.2).
7. **MCP prompts.** Out of scope. PRD-602 surfaces content; prompts are operator-authored.
8. **Hot-reloading the ACT runtime.** The bridge takes the `ActRuntime` at construction; reconfiguring requires server restart.

### Stakeholders / audience

- **Authors of:** PRD-706 (hybrid static + runtime + MCP example). Operators of ACT-runtime SaaS products who want a single MCP-discoverable endpoint.
- **Consumers of (upstream):** PRD-100, PRD-106, PRD-109, PRD-500, PRD-501 (canonical leaf SDK plugged into the bridge), PRD-103 (ETags propagated to MCP resource metadata where applicable).
- **Consumers of (downstream):** PRD-706. Future MCP-aware ACT consumers.
- **External coordination:** MCP working group / spec; PRD-602 commits to MCP 1.0 and tracks 1.x.
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| MCP issues a 1.x MINOR that breaks the bridge's forward-compat shim. | Medium | High | PRD-602-R20 (escalation): MUST re-review PRD-602 on every MCP MINOR; the changelog flags the break and recommends a v0.2 deferral or MAJOR PRD-602 amendment. |
| MCP's versioning posture proves unstable enough that the shim cannot be specified safely. | Low (per Q6 framing) | High | PRD-602-R1 documents the escalation clause: if at PRD-602's next In Review cycle MCP's versioning is unstable, escalate to BDFL to defer PRD-602 to v0.2. |
| ACT and MCP have incompatible identity models — MCP may carry a session token; ACT expects an `Identity` shape. | Medium | High | PRD-602-R10 specifies the `IdentityBridge` adapter the bridge invokes: it receives MCP's auth context and returns an ACT `Identity`. The host implements the bridge; PRD-602 owns only the contract. |
| Resource URIs under `act://<host>/<id>` collide with other URI schemes some MCP client uses. | Low | Medium | PRD-602-R6 fixes the URI scheme; alternative schemes are MAJOR. PRD-602 reserves `act://` for ACT-MCP bridges; MCP clients that want to consume an ACT bridge MUST recognize the scheme. |
| ACT subtree responses don't map cleanly to MCP — MCP resources are flat. | High | Medium | PRD-602-R11 emits a "list resource" whose body is a JSON array of child resource URIs; MCP clients that want the subtree fetch each child resource explicitly. The list resource is the bridge's only structural concession. |
| Per-tenant ETag derivation (PRD-103-R6) requires the tenant-resolved identity at every MCP read; expensive. | Medium | Medium | PRD-602-R12 caches the tenant resolution per MCP session; the cache TTL is documented (default 60s). |
| ACT's `404` and `403` collapse into the same response per PRD-500-R18 (no leak); MCP may surface these distinctly. | High | High | PRD-602-R14 maps both ACT `404` and ACT `403` to MCP "resource not found" with byte-equivalent envelopes (modulo opaque request IDs), preserving PRD-109-R3 / PRD-500-R18. |
| The bridge runs two transports; debugging cross-protocol drift is hard. | Medium | Medium | PRD-602-R18 requires structured logging with a correlation ID per request, plumbed to BOTH protocols via PRD-500-R23's `Logger` interface. |
| MCP clients may not honor cache headers; per-request cost is unbounded. | Medium | Low | PRD-602-R13 attaches the ACT envelope's `etag` as MCP resource metadata; well-behaved clients can use it for caching. The bridge does not enforce MCP-side caching. |
| Search-body envelope is deferred to v0.2 per Q13; PRD-602's MCP search delegate has nothing normative to wrap. | High | Low | PRD-602-R15 wraps the search endpoint as opaque-but-JSON, mirroring PRD-500-R34. Forward-compat: when the search envelope is pinned in v0.2, PRD-602 MAY tighten the mapping in a MINOR. |
| Bridge consumer expects MCP `tools` exposition for search; v0.1 does only resources. | Medium | Low | PRD-602-R16 documents the v0.1 stance (resources only); v0.2 amendment adds tools. |

### Open questions

1. ~~Should the bridge expose MCP "completions" mapping to ACT search results?~~ **Resolved (2026-05-01): No for v0.1.** MCP completions are tool-oriented; ACT search is resource-oriented. Search is exposed as a resource per PRD-602-R15. (Closes Open Question 1.)
2. ~~Should the bridge surface ACT block content (`content[]` array) as MCP resource MIME variants?~~ **Resolved (2026-05-01): No.** Each ACT node maps to one MCP resource; blocks are served inline as part of the node payload. PRD-102 does not define a canonical block-level MIME, and the bridge is content-tree bridging, not block-fetching. Granular block-as-MCP-resource exposition is deferred to v0.2. Encoded normatively at the revised PRD-602-R8. (Closes Open Question 2.)
3. ~~Should the bridge expose a discovery resource `act://manifest` enumerating all known node URIs?~~ **Resolved (2026-05-01): Yes.** MCP clients without subscription support need a way to enumerate. Encoded at PRD-602-R7. (Closes Open Question 3.)
4. ~~Should the bridge support MCP's resource subscriptions (MCP 1.0 has them)?~~ **Resolved (2026-05-01): Yes (Plus / opt-in)** — the bridge emits resource update notifications when its `ActRuntime` raises a change event. Encoded at PRD-602-R17. (Closes Open Question 4.)
5. ~~Should the bridge emit per-MCP-session telemetry to the operator's logger separately from per-ACT-request telemetry?~~ **Resolved (2026-05-01): No.** One logger; correlation ID disambiguates per PRD-602-R18. (Closes Open Question 5.)
6. ~~What is the exact mapping for ACT's `marketing:*` blocks to MCP resource MIME types?~~ **Resolved (2026-05-01): No mapping in v0.1.** `marketing:*` blocks (and all other PRD-102 blocks) are served inline as part of the node payload, not as separate MCP resources. PRD-102 has no canonical block-level MIME, and minting `application/act-block+json; profile=marketing` from PRD-602 alone would invent a contract PRD-102 does not own. Per-block MIMEs and per-block resource URIs are a v0.2 concern that would coordinate with a PRD-102 MIME pin. Encoded at the revised PRD-602-R8. (Closes Open Question 6.)

### Acceptance criteria

- [ ] Status `In review` is set; changelog entry dated 2026-05-01 by Jeremy Forsythe is present.
- [ ] Every normative requirement has an ID `PRD-602-R{n}` and a declared conformance level.
- [ ] The Specification opens with a table mapping every requirement to PRD-500 + PRD-106 + 100-series requirements implemented.
- [ ] MCP 1.0 minimum + forward-compat shim is explicitly stated and the supported subset is documented.
- [ ] The escalation clause (Q6) is pinned: if MCP versioning posture destabilizes, recommend v0.2 deferral.
- [ ] ACT → MCP mapping (id → URI scheme `act://<host>/<id>`, capabilities, search, subtree) is normative.
- [ ] Identity propagation contract (`IdentityBridge`) is documented.
- [ ] Failure-mode mapping table is provided.
- [ ] PRD-109-R3 / PRD-500-R18 (404 vs 403 indistinguishability) is preserved on the MCP side.
- [ ] Test-fixture path layout enumerated; no fixture files created.
- [ ] Versioning & compatibility section classifies each kind of change.
- [ ] Security section cites PRD-109 and documents bridge-specific deltas.
- [ ] No new JSON Schemas are introduced.

---

## Context & dependencies

### Depends on

- **PRD-100** (Accepted) — wire-format envelopes the bridge serves on the ACT side.
- **PRD-103** (Accepted) — ETag derivation; surfaced on MCP resource metadata.
- **PRD-106** (Accepted) — runtime delivery profile; the ACT side of the bridge satisfies PRD-106.
- **PRD-107** (Accepted) — conformance levels.
- **PRD-108** (Accepted) — versioning policy.
- **PRD-109** (Accepted) — security posture; especially R3 (404 vs 403 byte equivalence) and R5 (auth challenges).
- **PRD-500** (In review) — runtime SDK contract; the bridge consumes `ActRuntime` per PRD-500-R3.
- **PRD-501** (In review) — Next.js runtime SDK; the canonical TS leaf SDK an operator might plug into the bridge.
- **PRD-600** (In review) — validator (sibling tool).
- **000-decisions-needed Q6** — MCP 1.0 + forward-compat shim; escalation clause.
- External: [Model Context Protocol specification](https://spec.modelcontextprotocol.io/) v1.0, [JSON-RPC 2.0](https://www.jsonrpc.org/specification) (MCP transport), [RFC 3986](https://www.rfc-editor.org/rfc/rfc3986) (URI grammar for `act://` scheme), [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110) (HTTP semantics for ACT side), [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174).

### Blocks

- **PRD-706** (hybrid static + runtime + MCP bridge example) — depends on PRD-602 directly.

### References

- v0.1 draft: §10 Q15 (streaming deferred); Appendix E (MCP / ACT coexistence patterns).
- `prd/000-decisions-needed.md` Q6 (MCP version range, forward-compat shim, escalation clause).
- Prior art: MCP 1.0 specification; the JSON-RPC 2.0 wire format MCP uses; existing MCP server implementations (e.g., `@modelcontextprotocol/server-filesystem`).

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords as clarified by RFC 8174.

### PRD-500 + PRD-106 + 100-series requirements implemented

| PRD-602 requirement | Upstream requirement(s) implemented or consumed | Relationship |
|---|---|---|
| R1 (MCP 1.0 minimum + escalation) | decision Q6, PRD-108 | Pins the supported MCP version range; escalation clause. |
| R2 (`@act/mcp-bridge` package shape) | PRD-500-R1 | Bridge is a TS package consuming `ActRuntime`. |
| R3 (bridge construction: `createBridge`) | PRD-500-R3, R5 | Bridge wraps the runtime's dispatch pipeline. |
| R4 (ACT side of bridge: PRD-501-or-other leaf SDK) | PRD-500-R11, PRD-501 | The bridge mounts a chosen leaf SDK for ACT HTTP endpoints. |
| R5 (MCP side of bridge: MCP server) | external MCP 1.0 | The bridge mounts an MCP server (stdio or HTTP+SSE transport). |
| R6 (URI scheme: `act://<host>/<id>`) | PRD-100-R10, PRD-106-R14 | Resource URIs are derived from ACT IDs via per-segment percent-encoding. |
| R7 (manifest-as-resource: `act://<host>/manifest`) | PRD-100-R4, R6 | MCP clients enumerate via this resource. |
| R8 (blocks served inline; one node = one MCP resource) | PRD-102, PRD-100-R28..R31 | Node body carries `content[]` as `application/act-node+json; profile=runtime`; no per-block MIME minted in v0.1. |
| R9 (capabilities mapping: ACT → MCP) | PRD-100-R6, PRD-107-R14 | ACT capabilities advertised in MCP server capabilities. |
| R10 (`IdentityBridge` adapter) | PRD-500-R6, PRD-109-R3 | MCP auth context → ACT `Identity`. |
| R11 (subtree → list-of-resources) | PRD-100-R32, R33, PRD-500-R32 | Subtree exposed as a flat list resource. |
| R12 (per-session tenant cache) | PRD-500-R7, PRD-103-R6 | Tenant resolution cached per MCP session; default TTL 60s. |
| R13 (etag → MCP resource metadata) | PRD-103-R5, R6, R10 | The ACT envelope's `etag` is exposed as MCP resource metadata. |
| R14 (failure-mode mapping) | PRD-500-R17, R18, PRD-109-R3 | ACT error envelope → MCP error; 404 and 403 collapse. |
| R15 (search delegation) | PRD-500-R34, decision Q13 | Search is opaque-but-JSON for v0.1; MCP-side wrapper passes through. |
| R16 (resources-only v0.1; tools deferred) | external MCP 1.0 | v0.1 exposes resources; tools is a v0.2 amendment. |
| R17 (resource subscriptions) | external MCP 1.0 | The bridge MAY emit MCP resource update notifications for runtime change events. |
| R18 (correlated logging across protocols) | PRD-500-R23, R24 | One logger; correlation ID per request. |
| R19 (forward-compat shim subset) | decision Q6, PRD-108-R7 | Documented MCP 1.0 fields produced; documented 1.x fields tolerated; reject unknown REQUIRED. |
| R20 (MCP MINOR re-review) | decision Q6 | Every MCP MINOR triggers a PRD-602 re-review; escalation if shim breaks. |
| R21 (test-fixture conformance) | PRD-500-R31 | MUST pass `fixtures/602/`. |
| R22 (deployment model: HTTP + stdio/SSE) | PRD-106 | Bridge exposes ACT over HTTP and MCP over stdio or HTTP+SSE. |
| R23 (manifest serves both protocols) | PRD-101, PRD-106-R23 | ACT consumer hits `/.well-known/act.json`; MCP client hits MCP transport. |
| R24 (configuration shape: `BridgeConfig`) | PRD-500 (config patterns) | Single config object wrapping an `ActRuntime`. |
| R25 (act_version pinning) | PRD-108-R1, R8 | Stage 1 v0.1 pinned. |

### Conformance level

- **Core:** PRD-602-R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R13, R14, R18, R19, R20, R21, R22, R23, R24, R25.
- **Standard:** PRD-602-R12 (per-session tenant cache; relevant when scoped tenants are used).
- **Plus:** PRD-602-R15 (search; Plus per PRD-107-R10), R17 (resource subscriptions; reflects PRD-100/106's runtime-change-feed posture, deferred to a future MINOR).

### Normative requirements

#### MCP version pinning and escalation

**PRD-602-R1.** **(Core)** PRD-602 commits to **MCP 1.0 minimum** with a documented forward-compat shim per decision Q6. The shim:

1. Enumerates the MCP 1.0 fields the bridge produces (PRD-602-R19's "produces" list).
2. Enumerates MCP 1.x fields the bridge tolerates as unknown (PRD-602-R19's "tolerates" list — MCP's own forward-compat rules apply).
3. Specifies behavior on receiving an unknown REQUIRED MCP field: the bridge MUST reject with the documented error (`UNKNOWN_REQUIRED_FIELD`) and surface the field name to the operator's logger.

**Escalation clause.** If, at any PRD-602 In Review cycle, MCP's versioning posture has destabilized to the extent that the shim cannot be specified safely (e.g., MCP 1.x has shipped multiple incompatible MINORs without a tolerance contract), PRD-602 MUST surface this in its changelog and the BDFL MUST be notified. The recommended remediation is to defer PRD-602 to v0.2 and mark PRD-602 status `Deprecated for v0.1`.

#### Package shape

**PRD-602-R2.** **(Core)** The bridge MUST be published as the npm package `@act/mcp-bridge`. The package MUST export a constructor `createBridge(config: BridgeConfig): Bridge` whose returned `Bridge` exposes:

- `httpHandler`: a WHATWG `fetch`-compatible handler for the ACT side (delegating to a chosen PRD-500 leaf SDK per PRD-602-R4).
- `mcpServer`: the constructed MCP server instance (the bridge does not embed a transport — operators choose stdio or HTTP+SSE).
- `start(transport)`: a convenience that wires both the HTTP handler and the MCP transport.
- `dispose()`: shuts down both protocols cleanly.

**PRD-602-R3.** **(Core)** `createBridge` MUST validate at construction time that the supplied `ActRuntime` (PRD-500-R3) satisfies the level the bridge advertises. Specifically: if the bridge is configured to advertise `subtree` (PRD-602-R11), the runtime MUST have `resolveSubtree` registered (PRD-500-R32). Mismatches MUST throw a structured error before any request is served.

#### ACT side of the bridge

**PRD-602-R4.** **(Core)** The ACT side of the bridge MUST be implemented by mounting a PRD-500 leaf SDK chosen by the operator. The bridge MUST NOT re-implement HTTP dispatch logic owned by PRD-500. The canonical leaf SDK for the bridge is PRD-505 (generic WHATWG-fetch handler) because the bridge does not assume a host framework; operators MAY substitute PRD-501 (Next.js) when running in a Next.js app, PRD-502 (Express), or others. The bridge documents the integration shape:

```ts
import { createGenericHandler } from '@act/runtime-core';   // PRD-505
import { createBridge } from '@act/mcp-bridge';

const httpHandler = createGenericHandler({ runtime: actRuntime, basePath: '' });
const bridge = createBridge({ runtime: actRuntime, httpHandler, mcp: { name: 'example', version: '1.0' } });
```

#### MCP side of the bridge

**PRD-602-R5.** **(Core)** The MCP side of the bridge MUST be implemented as an MCP 1.0-conformant server. The bridge MUST advertise itself with the configured `name` and `version` per MCP's initialization handshake. The bridge MUST NOT embed a transport (stdio or HTTP+SSE); the operator wires the transport at start-up time via `bridge.start(transport)`.

#### URI scheme and identity

**PRD-602-R6.** **(Core)** The bridge MUST expose ACT nodes as MCP resources under the URI scheme `act://`. The canonical form is:

```
act://<host>/<percent-encoded-id>
```

where `<host>` is the operator-configured authority component (typically the deployment's primary hostname; e.g., `docs.example.com`) and `<percent-encoded-id>` is the ACT node id with per-segment percent-encoding per PRD-100-R12 / PRD-106-R14 / PRD-500-R13. Per-segment encoding preserves `/` as the segment separator.

Example: ACT id `getting-started/install` deployed under host `docs.example.com` becomes:

```
act://docs.example.com/getting-started/install
```

The `act://` scheme is reserved by this PRD for ACT-MCP bridges. Alternative schemes are MAJOR per the Versioning table.

**PRD-602-R7.** **(Core)** The bridge MUST expose the ACT manifest as a single MCP resource at `act://<host>/manifest`. The resource's body MUST be the runtime-profile manifest (PRD-100-R4 + PRD-106-R25). The MIME type is `application/act-manifest+json; profile=runtime`. MCP clients lacking subscription support enumerate the tree by reading this resource; the manifest's `index_url` and `node_url_template` indicate where to follow.

**PRD-602-R8.** **(Core)** Each ACT node maps to one MCP resource; blocks are not addressable as separate MCP resources in v0.1. Block content is served inline as part of the node payload.

The node resource (the per-id resource) returns the full PRD-100 node envelope as `application/act-node+json; profile=runtime`. The envelope's `content[]` array carries each block in its native PRD-102 shape (`markdown`, `code`, `data`, `callout`, `marketing:*`, etc.); MCP clients receive the blocks as part of the node body and dispatch on each block's `type` discriminator client-side.

PRD-602 does NOT mint a per-block MIME type. PRD-102 (Accepted) does not define a canonical block-level MIME, and the bridge is content-tree bridging, not block-fetching. Granular block-as-MCP-resource exposition (with per-block URIs of the form `act://<host>/<id>#blocks/<index>` and a per-block-kind MIME taxonomy) is deferred to a future v0.2 amendment that would coordinate with a PRD-102 MIME pin if and when one is introduced.

#### Capabilities mapping

**PRD-602-R9.** **(Core)** The bridge MUST advertise MCP server capabilities at MCP initialization. The mapping from ACT manifest capabilities to MCP capabilities:

| ACT capability | MCP capability |
|---|---|
| `delivery: "runtime"` | the bridge advertises `resources: { listChanged: true }` (live tree) |
| `capabilities.subtree = true` | the bridge advertises a list-resource per subtree root (PRD-602-R11) |
| `capabilities.ndjson_index = true` | not directly mapped; MCP clients enumerate via `act://<host>/manifest` + the index resource |
| `capabilities.search.template_advertised = true` | the bridge advertises `resources` with a search delegate AND, when MCP's search capability stabilizes in a future MCP MINOR, advertises native MCP search per PRD-602-R15 |

The bridge MUST NOT advertise an MCP capability whose underlying ACT capability is not present.

#### Identity propagation

**PRD-602-R10.** **(Core)** The bridge MUST invoke an operator-supplied `IdentityBridge` adapter on every MCP request that reaches a per-tenant or per-identity ACT endpoint. The bridge:

1. Receives MCP's auth context (the host's session / token / API key — MCP-side specifics are MCP's responsibility).
2. Invokes `IdentityBridge.resolveAct(mcpContext): Promise<ActRequestLike>` where `ActRequestLike` is a thin shape carrying `headers` (a `Headers` instance) and `getCookie(name)`.
3. Passes the result to the leaf SDK's standard `IdentityResolver` (PRD-500-R6) via the `httpHandler`.

The bridge MUST preserve PRD-500-R18 (404 vs 403 indistinguishability): when the identity bridge resolves to a principal that cannot see a resource, the MCP-side response is identical (modulo opaque request IDs) to the response for a non-existent resource.

#### Subtree mapping

**PRD-602-R11.** **(Standard)** When the runtime advertises `capabilities.subtree`, the bridge MUST expose each subtree-root id as a list-of-resources MCP resource at `act://<host>/<id>?subtree=1`. The body is a JSON array of MCP resource URIs corresponding to the subtree's nodes in depth-first preorder per PRD-100-R35. The bridge MUST honor the depth bound (default 3, max 8) per PRD-100-R33. Truncation per PRD-100-R34 is preserved: when the subtree is elided, the list resource includes a final entry `{ "truncated": true, "elided_root": "<id>" }`. MCP clients that want full subtree traversal MUST fetch each child resource individually (MCP's flat-resource model permits this).

**PRD-602-R12.** **(Standard)** When the bridge serves a multi-tenant runtime (PRD-500-R7), the bridge MUST cache the tenant resolution per MCP session. The cache key is the MCP session ID (per MCP's session model) AND the bridged ACT identity. The default TTL is **60 seconds**; configurable via `BridgeConfig.tenantCacheTtlMs`. Cache eviction MUST occur on session close.

#### ETag propagation

**PRD-602-R13.** **(Core)** The ACT envelope's `etag` field MUST be exposed as MCP resource metadata. MCP 1.0 resources carry a `metadata` object; the bridge MUST set:

```json
{
  "act_etag": "<envelope-etag-value>",
  "act_version": "0.1"
}
```

MCP clients with caching support SHOULD use `act_etag` for resource-level cache validation. The bridge does NOT enforce MCP-side caching — that is the MCP client's responsibility.

#### Failure-mode mapping

**PRD-602-R14.** **(Core)** ACT errors (the leaf SDK's `Outcome` discriminated union per PRD-500-R4) MUST be mapped to MCP errors per the following table. The mapping preserves PRD-109-R3 / PRD-500-R18 byte-equivalence between `404` and `403`:

| ACT outcome | MCP error envelope | Notes |
|---|---|---|
| `{ kind: "ok", value }` | MCP success response | Resource body delivered |
| `{ kind: "not_found" }` | MCP `RESOURCE_NOT_FOUND` | |
| `{ kind: "denied" }` | MCP `RESOURCE_NOT_FOUND` | **Identical envelope to `not_found`** modulo opaque request ID — preserves PRD-500-R18 |
| `{ kind: "unauthenticated" }` | MCP `AUTHENTICATION_REQUIRED` with the configured `WWW-Authenticate` value as a hint per PRD-106-R8 | |
| `{ kind: "validation", details }` | MCP `INVALID_REQUEST` with `details` propagated | |
| `{ kind: "internal" }` | MCP `INTERNAL_ERROR` | No internal details leaked beyond an opaque request ID |

The bridge MUST NOT add MCP-side error fields that would distinguish `not_found` from `denied` (e.g., MUST NOT include an "access denied" reason for `denied` while `not_found` lacks it).

#### Search delegation

**PRD-602-R15.** **(Plus)** When the runtime registers `resolveSearch` (PRD-500-R34) AND the manifest advertises `search_url_template` (PRD-100-R39), the bridge MUST expose a search resource at `act://<host>/search?q={query}`. Per decision Q13, the search response body is opaque-but-JSON in v0.1 — the bridge MUST forward the resolver's JSON-serializable value as-is. MCP MIME type is `application/json; profile=runtime`. A future MCP MINOR that adds native search semantics MAY trigger a PRD-602 MINOR amendment that wraps the search delegate as MCP's native search; for v0.1, the resource exposition is sufficient.

#### Resources-only posture

**PRD-602-R16.** **(Core)** PRD-602 v0.1 exposes ACT nodes as MCP **resources** only, not as MCP **tools**. The rationale: ACT is a content-tree contract; tools are operator-defined verbs over content. A future v0.2 amendment MAY add a search tool when MCP's tool semantics are stable enough to wrap PRD-500-R34's resolver. v0.1 surfaces search as a resource per PRD-602-R15.

#### Resource subscriptions

**PRD-602-R17.** **(Plus)** The bridge MAY expose MCP resource subscriptions when the runtime supports change events. Specifically: when `ActRuntime` exposes an EventEmitter-style `onChange(handler)` (a future PRD-500 amendment; not required by PRD-500-R3 in v0.1), the bridge MUST forward the event as MCP's `notifications/resources/updated` per MCP 1.0. v0.1 runtimes that lack change events MUST NOT advertise the MCP `resources.subscribe` capability. Streaming / change-feed runtime endpoints are deferred per draft §5.13.6 / §10 Q15; PRD-602-R17 is forward-compat scaffolding only.

#### Logging and correlation

**PRD-602-R18.** **(Core)** The bridge MUST plumb a single `Logger` (per PRD-500-R23) to BOTH protocols. Every request MUST carry a correlation ID:

- HTTP requests: `X-Request-Id` header (echoed per PRD-500-R25).
- MCP requests: a bridge-generated UUID, attached to the MCP request frame as a private extension AND included in every log event.

The correlation ID MUST be opaque (UUIDv4) and MUST NOT be derived from identity or tenant per PRD-500-R23.

#### Forward-compat shim

**PRD-602-R19.** **(Core)** The bridge declares the following MCP 1.0 fields it produces (the "produces" list):

- Server initialization: `name`, `version`, `protocolVersion: "2024-11-05"` (or the MCP 1.0-stamped version per the published spec), `capabilities.resources.listChanged`, `capabilities.resources.subscribe` (when PRD-602-R17 applies).
- Resource list: each entry includes `uri`, `name`, `mimeType`, `description`, `metadata.act_etag`, `metadata.act_version`.
- Resource read: `contents` array with one entry of `{ uri, mimeType, text | blob }`.
- Error envelope per PRD-602-R14.

The bridge tolerates the following MCP 1.x fields as unknown (the "tolerates" list per PRD-108-R7):

- Any optional field on MCP request frames whose name is not in the produces list.
- New optional fields under `capabilities` introduced in MCP 1.x MINORs.
- New optional fields under resource metadata.

The bridge MUST reject any incoming MCP frame carrying an unknown REQUIRED field (a field MCP 1.x marks as required that PRD-602 does not recognize). The rejection error code is `UNKNOWN_REQUIRED_FIELD` and the error message names the field.

#### MCP MINOR re-review

**PRD-602-R20.** **(Core)** Every MCP 1.x MINOR release MUST trigger a PRD-602 re-review. The review evaluates whether:

1. The MCP MINOR's new fields are compatible with PRD-602-R19's tolerates list.
2. Any new MCP REQUIRED field can be supported by the bridge in a PRD-602 MINOR amendment.
3. The shim is still safely specifiable.

If any of (1)–(3) fail, PRD-602-R1's escalation clause activates: surface the breakage in PRD-602's changelog, recommend a v0.2 deferral or a MAJOR PRD-602 amendment, and notify the BDFL.

#### Test-fixture conformance

**PRD-602-R21.** **(Core)** The bridge MUST pass the framework conformance fixture corpora at `fixtures/602/positive/` and `fixtures/602/negative/`. Fixtures exercise the ACT-side HTTP probe (delegated to PRD-500-R31's harness for the chosen leaf SDK) AND the MCP-side resource probe (a mock MCP client issued through the bridge's MCP transport).

#### Deployment model

**PRD-602-R22.** **(Core)** The bridge runs as a single Node process exposing two transports:

- ACT HTTP, served by the chosen leaf SDK's `httpHandler` (PRD-602-R4).
- MCP, served via MCP's stdio transport OR HTTP+SSE transport (operator's choice).

The bridge MUST NOT require shared state between transports beyond the `ActRuntime` and the operator-supplied `IdentityBridge`. The bridge SHOULD support being run behind a reverse proxy that splits traffic by URL path (ACT HTTP under one path, MCP HTTP+SSE under another).

#### Manifest discovery

**PRD-602-R23.** **(Core)** ACT consumers reaching the bridge via `/.well-known/act.json` MUST receive the runtime-profile manifest emitted by the leaf SDK (PRD-500-R8). MCP clients reaching the bridge via the MCP transport MUST receive the MCP initialization handshake. The two discovery paths are independent; a consumer of one protocol MUST NOT depend on the other being reachable.

The runtime manifest's `Link` header (PRD-500-R29 / PRD-106-R23) MAY include a hint pointing to the MCP transport endpoint for MCP-aware ACT consumers. The hint format is:

```
Link: <wss://example.com/mcp>; rel="alternate"; type="application/mcp+json"
```

This is OPTIONAL for v0.1 and a candidate for tightening in v0.2 once MCP-aware consumer behavior stabilizes.

#### Configuration shape

**PRD-602-R24.** **(Core)** `BridgeConfig` MUST satisfy the following minimum:

```ts
interface BridgeConfig {
  runtime: ActRuntime;                    // PRD-500-R3
  httpHandler: (req: Request) => Promise<Response>;  // PRD-505 / PRD-501 / etc.
  mcp: {
    name: string;                         // server name in MCP init
    version: string;                      // server version in MCP init
    host: string;                         // authority for act:// URIs
  };
  identityBridge?: IdentityBridge;        // required iff runtime uses IdentityResolver
  tenantCacheTtlMs?: number;              // default 60_000
  logger?: Logger;                        // PRD-500-R23
  features?: {
    subscriptions?: boolean;              // PRD-602-R17; default false
  };
}
```

#### `act_version` pinning

**PRD-602-R25.** **(Core)** The bridge's MCP initialization metadata MUST carry `metadata.act_version: "0.1"` for v0.1. The ACT side of the bridge inherits the leaf SDK's `act_version` per PRD-500-R12. A bridge whose leaf SDK is configured for an `act_version` other than `"0.1"` MUST refuse to start with a structured error.

### Wire format / interface definition

```ts
// @act/mcp-bridge public surface

import type { ActRuntime, Logger } from '@act/runtime-core';

export interface IdentityBridge {
  /**
   * Map an MCP request's auth context into an ACT request-like shape so the
   * leaf SDK's IdentityResolver can run unchanged.
   */
  resolveAct(mcpContext: McpRequestContext): Promise<{
    headers: Headers;
    getCookie: (name: string) => string | undefined;
  }>;
}

export interface BridgeConfig {
  runtime: ActRuntime;
  httpHandler: (req: Request) => Promise<Response>;
  mcp: { name: string; version: string; host: string };
  identityBridge?: IdentityBridge;
  tenantCacheTtlMs?: number;
  logger?: Logger;
  features?: { subscriptions?: boolean };
}

export interface Bridge {
  httpHandler: (req: Request) => Promise<Response>;
  mcpServer: unknown;                    // MCP server instance; concrete shape per @modelcontextprotocol/sdk
  start(transport: 'stdio' | { kind: 'http+sse'; mount: (handler: (req: Request) => Promise<Response>) => void }): Promise<void>;
  dispose(): Promise<void>;
}

export function createBridge(config: BridgeConfig): Bridge;
```

### Errors

| Condition | Response | Notes |
|---|---|---|
| `BridgeConfig.runtime` lacks a registered resolver for an advertised capability | Throw at `createBridge` | PRD-602-R3 |
| Identity bridge throws | MCP `INTERNAL_ERROR`; opaque request ID | No identity details leak |
| ACT outcome `{ kind: "denied" }` | MCP `RESOURCE_NOT_FOUND` byte-equivalent to `not_found` | PRD-602-R14, PRD-500-R18 |
| ACT outcome `{ kind: "unauthenticated" }` | MCP `AUTHENTICATION_REQUIRED` with `WWW-Authenticate`-derived hint | PRD-602-R14 |
| MCP frame with unknown REQUIRED field | MCP error `UNKNOWN_REQUIRED_FIELD` | PRD-602-R19 |
| `act_version` mismatch between bridge config and leaf SDK | Refuse to start | PRD-602-R25 |
| Subtree depth out of `[0, 8]` (request) | MCP `INVALID_REQUEST` with `depth_out_of_range` | PRD-500-R32 |

---

## Examples

### Example 1 — minimal bridge wiring (Core)

```ts
import { createGenericHandler, createActRuntime } from '@act/runtime-core';   // PRD-505
import { createBridge } from '@act/mcp-bridge';
import { StdioTransport } from '@modelcontextprotocol/sdk';

const runtime = createActRuntime({
  manifest: { /* per PRD-100 */ },
  resolveManifest: async () => /* ... */,
  resolveIndex: async () => /* ... */,
  resolveNode: async (req, ctx, { id }) => /* ... */,
  identityResolver: async (req) => /* ... */,
});

const httpHandler = createGenericHandler({ runtime, basePath: '' });

const bridge = createBridge({
  runtime,
  httpHandler,
  mcp: { name: 'docs.example.com', version: '1.0.0', host: 'docs.example.com' },
  logger: console as any,
});

await bridge.start('stdio');
```

ACT HTTP requests at `/.well-known/act.json`, `/act/index.json`, `/act/<id>` are served by the generic handler. MCP clients connecting over stdio see the manifest as `act://docs.example.com/manifest` and each node as `act://docs.example.com/<id>`.

### Example 2 — multi-tenant SaaS with identity bridging (Standard)

```ts
const bridge = createBridge({
  runtime: tenantedRuntime,                  // resolveTenant + resolveIdentity registered
  httpHandler: createGenericHandler({ runtime: tenantedRuntime, basePath: '/api/act' }),
  mcp: { name: 'workspace', version: '0.5', host: 'workspace.example.com' },
  identityBridge: {
    async resolveAct(mcpCtx) {
      // MCP carries an OAuth token in its session; we lift it to an Authorization header.
      const headers = new Headers({ Authorization: `Bearer ${mcpCtx.auth.token}` });
      return { headers, getCookie: () => undefined };
    },
  },
  tenantCacheTtlMs: 30_000,
});
```

Per-tenant ETag derivation runs once per MCP session per cached tenant.

---

## Test fixtures

Files are not created by this PRD; they are enumerated for downstream authoring.

### Positive

- `fixtures/602/positive/minimal-bridge-stdio/` — `createBridge` + stdio transport; manifest + 3 nodes accessible on both ACT HTTP and MCP.
- `fixtures/602/positive/uri-scheme-encoding/` — IDs containing `:` and `/` produce correctly percent-encoded URIs.
- `fixtures/602/positive/capabilities-mapping/` — runtime advertises subtree; MCP capability list reflects.
- `fixtures/602/positive/etag-propagation/` — ACT envelope `etag` surfaces on MCP resource metadata.
- `fixtures/602/positive/identity-bridge-multitenant/` — per-tenant resolution; tenant cache hit on second request within TTL.
- `fixtures/602/positive/subtree-list-resource/` — subtree-root list resource depth-first preorder per PRD-100-R35.
- `fixtures/602/positive/search-passthrough/` — search resource forwards resolver JSON as-is (Q13 deferred body).
- `fixtures/602/positive/correlation-id/` — single correlation ID present in HTTP `X-Request-Id` and MCP frame extension.
- `fixtures/602/positive/forward-compat-tolerates/` — incoming MCP frame with unknown OPTIONAL field is accepted.
- `fixtures/602/positive/discovery-link-header/` — ACT response `Link` header points to MCP transport endpoint.

### Negative

- `fixtures/602/negative/runtime-missing-subtree-resolver/` — `createBridge` throws when subtree advertised but resolver missing (PRD-602-R3).
- `fixtures/602/negative/denied-vs-not-found/` — `denied` outcome produces byte-equivalent MCP envelope to `not_found` (PRD-602-R14 / PRD-500-R18).
- `fixtures/602/negative/unknown-required-field/` — incoming MCP frame with unknown REQUIRED field rejected (PRD-602-R19).
- `fixtures/602/negative/act-version-mismatch/` — leaf SDK configured for `act_version: "0.2"`; bridge refuses to start (PRD-602-R25).
- `fixtures/602/negative/identity-bridge-throws/` — identity bridge throws → MCP `INTERNAL_ERROR` with no identity details leaked.
- `fixtures/602/negative/subtree-depth-out-of-range/` — request depth = 9; MCP `INVALID_REQUEST`.
- `fixtures/602/negative/uri-scheme-collision/` — operator misconfigures `host` with reserved characters; bridge rejects at `createBridge`.

---

## Versioning & compatibility

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a new optional `BridgeConfig` field | MINOR | |
| Add an optional MCP capability advertisement | MINOR | |
| Introduce a per-block MCP resource MIME taxonomy (a future R8 expansion) | MINOR | Additive in v0.2; would coordinate with a PRD-102 MIME pin if one is introduced. |
| Tighten an SHOULD to a MUST | MAJOR | |
| Loosen a MUST to a SHOULD | MAJOR | |
| Change the `act://` URI scheme | MAJOR | |
| Change the failure-mode mapping table | MAJOR | Wire-visible |
| Add MCP tools exposition | MINOR | Additive |
| Bump minimum supported MCP version (1.0 → 1.1) | MAJOR | Tightens the contract |
| Drop support for an MCP version in the previously-supported range | MAJOR | |
| Activate PRD-602-R1 escalation (defer to v0.2) | N/A | Status change to Deprecated for v0.1 |

### Forward compatibility

Per PRD-602-R19, the bridge tolerates unknown OPTIONAL MCP fields and rejects unknown REQUIRED MCP fields. Per PRD-108-R7, ACT envelopes follow the project-wide unknown-field tolerance.

### Backward compatibility

A bridge upgrading from a prior PRD-602 minor MUST preserve URI scheme, manifest-as-resource shape, capability mapping table, and failure-mode mapping. The node-resource MIME (`application/act-node+json; profile=runtime`) is part of this contract; changes to it are MAJOR.

---

## Security considerations

PRD-109 (Accepted) governs the project-wide threat model. PRD-602 deltas:

- **Two protocols, one trust boundary.** ACT HTTP and MCP both reach the same `ActRuntime`. The bridge MUST NOT introduce a privilege gap between protocols — a request that the ACT side rejects MUST be rejected on the MCP side, and vice versa. PRD-602-R10 / R14 enforce this.
- **404 vs 403 byte equivalence (PRD-109-R3 / PRD-500-R18).** MCP allows distinct error codes; the bridge MUST collapse `not_found` and `denied` to the same envelope. Existence leaks via response shape would compromise the trust boundary.
- **Identity-bridge boundary.** The host's `IdentityBridge` is the only point at which MCP auth context crosses into ACT identity. A bug in `IdentityBridge` could elevate a less-privileged MCP client to an ACT principal it shouldn't be. PRD-602 requires the bridge to be operator-provided; PRD-602 does not implement a default.
- **MCP transport attack surface.** stdio transport is local-only; HTTP+SSE transport carries the full HTTP attack surface (TLS, CSRF, etc.). The operator's MCP transport hardening is independent of PRD-602.
- **URI scheme injection.** The `act://` URI is constructed from the operator's `host` config and the ACT id (per-segment percent-encoded). Malformed `host` (containing reserved characters) MUST be rejected at `createBridge`. Malformed IDs are caught by PRD-100-R10's grammar.
- **Tenant cache poisoning.** PRD-602-R12's per-session tenant cache is keyed by MCP session ID + ACT identity. The bridge MUST NOT key the cache on operator-attacker-controllable values (request IDs, headers).
- **Logging boundary.** Per PRD-500-R23, the logger MUST NOT receive raw credentials. PRD-602-R18 plumbs a single logger; the bridge MUST scrub MCP auth tokens before logging.
- **DoS / resource bounds.** MCP clients can issue many resource reads; the bridge inherits PRD-500-R33 / PRD-106's rate-limit / budget contract via the leaf SDK. The bridge does NOT add additional bounds for v0.1; PRD-602-R12's cache TTL implicitly bounds tenant-resolution cost.
- **`act_version` pinning.** Per PRD-602-R25 / PRD-108-R8, the bridge refuses to serve unsupported `act_version` values, preventing MAJOR-spec mixing across protocols.

---

## Implementation notes

The TypeScript snippets below show the canonical bridge shape. They are normative only insofar as PRD-602's normative requirements pin the behavior; the actual code in `@act/mcp-bridge` is the implementer's choice.

### Snippet 1 — bridge factory (PRD-602-R2 / R3)

```ts
import type { ActRuntime } from '@act/runtime-core';
import type { BridgeConfig, Bridge, IdentityBridge } from './types';
import { Server as McpServer } from '@modelcontextprotocol/sdk/server';

export function createBridge(config: BridgeConfig): Bridge {
  validateRuntimeConsistency(config);                  // PRD-602-R3
  validateActVersion(config);                          // PRD-602-R25

  const mcp = new McpServer({
    name: config.mcp.name,
    version: config.mcp.version,
    capabilities: deriveMcpCapabilities(config),       // PRD-602-R9
  });

  registerResourceHandlers(mcp, config);               // PRD-602-R6, R7, R8, R11

  return {
    httpHandler: config.httpHandler,                   // PRD-602-R4
    mcpServer: mcp,
    async start(transport) { /* wire transport */ },
    async dispose() { /* shut down both */ },
  };
}
```

### Snippet 2 — resource enumeration (PRD-602-R6 / R7)

```ts
import { encodeIdForUrl } from '@act/runtime-core';   // PRD-500-R13

function uriFor(host: string, id: string): string {
  return `act://${host}/${encodeIdForUrl(id)}`;       // PRD-602-R6
}

mcp.setRequestHandler(ListResourcesRequestSchema, async (req, mcpCtx) => {
  const actReq = await config.identityBridge.resolveAct(mcpCtx);  // PRD-602-R10
  const indexResult = await config.runtime.resolveIndex(actReq, /* ctx */);
  if (indexResult.kind !== 'ok') return mapToMcpError(indexResult);
  const resources = [
    {
      uri: uriFor(config.mcp.host, 'manifest'),       // PRD-602-R7
      name: 'ACT manifest',
      mimeType: 'application/act-manifest+json; profile=runtime',
      metadata: { act_etag: '<…>', act_version: '0.1' },
    },
    ...indexResult.value.nodes.map((n) => ({
      uri: uriFor(config.mcp.host, n.id),
      name: n.title,
      mimeType: 'application/act-node+json; profile=runtime',
      description: n.summary,
      metadata: { act_etag: n.etag, act_version: '0.1' },  // PRD-602-R13
    })),
  ];
  return { resources };
});
```

### Snippet 3 — ACT → MCP failure-mode mapping (PRD-602-R14)

```ts
function mapToMcpError(outcome: Outcome<unknown>): McpError {
  const requestId = newOpaqueId();                    // PRD-602-R18
  switch (outcome.kind) {
    case 'not_found':
    case 'denied':                                     // PRD-602-R14: byte-equivalent
      return { code: 'RESOURCE_NOT_FOUND', message: 'Resource not found.', data: { request_id: requestId } };
    case 'unauthenticated':
      return { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required.', data: { request_id: requestId, hint: outcome.challenge } };
    case 'validation':
      return { code: 'INVALID_REQUEST', message: 'Invalid request.', data: { request_id: requestId, ...outcome.details } };
    case 'internal':
      return { code: 'INTERNAL_ERROR', message: 'Internal error.', data: { request_id: requestId } };
  }
}
```

### Snippet 4 — identity propagation (PRD-602-R10)

```ts
const tenantCache = new Map<string, { tenant: Tenant; expiresAt: number }>();

async function resolveActFromMcp(
  mcpCtx: McpRequestContext,
  config: BridgeConfig,
): Promise<ActRequestLike> {
  const reqLike = await config.identityBridge!.resolveAct(mcpCtx);  // PRD-602-R10
  const cacheKey = `${mcpCtx.sessionId}|${reqLike.headers.get('Authorization') ?? ''}`;
  const cached = tenantCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...reqLike, _cachedTenant: cached.tenant };
  }
  // tenant resolution happens inside the leaf SDK; we cache after the first resolution.
  return reqLike;
}
```

### Snippet 5 — forward-compat shim configuration (PRD-602-R19)

```ts
const SHIM = {
  produces: {
    initialization: ['name', 'version', 'protocolVersion', 'capabilities.resources.listChanged'],
    resourceMetadata: ['act_etag', 'act_version'],
    errorCodes: ['RESOURCE_NOT_FOUND', 'AUTHENTICATION_REQUIRED', 'INVALID_REQUEST', 'INTERNAL_ERROR', 'UNKNOWN_REQUIRED_FIELD'],
  },
  toleratesUnknownOptional: true,                      // PRD-602-R19
  rejectsUnknownRequired: true,                         // PRD-602-R19
};

function validateIncomingMcpFrame(frame: any) {
  for (const [k, v] of Object.entries(frame)) {
    if (isUnknownField(k) && isMarkedRequired(frame, k)) {
      throw new McpError({ code: 'UNKNOWN_REQUIRED_FIELD', message: `Unknown REQUIRED field: ${k}` });
    }
  }
}
```

### Snippet 6 — capabilities mapping (PRD-602-R9)

```ts
function deriveMcpCapabilities(config: BridgeConfig) {
  const m = config.runtime.manifest;
  const caps: any = { resources: { listChanged: true } };
  if (config.features?.subscriptions && config.runtime.onChange) {
    caps.resources.subscribe = true;                   // PRD-602-R17
  }
  // search exposed as resource (PRD-602-R15); native MCP search deferred until MCP MINOR stabilizes.
  return caps;
}
```

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft; status `In review`. MCP 1.0 minimum + forward-compat shim per Q6. |
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review. Decisions: (1) no MCP completions mapping in v0.1 (Q1); (2) blocks served inline, not as separate MCP resources (Q2; see normative R8 change below); (3) `act://<host>/manifest` enumeration resource confirmed (Q3); (4) resource subscriptions opt-in for runtime change events (Q4); (5) one logger with correlation ID, no separate per-session telemetry sink (Q5); (6) no `marketing:*` block MIME minted in v0.1 (Q6). Ratified: forward-compat shim per Q6 with explicit MCP-MINOR escalation hook (R20); BDFL is the escalation owner; URI scheme `act://<host>/<id>` with per-segment percent-encoding (R6); 404/403 byte-equivalence preserved per PRD-109-R3 / PRD-500-R18 (R14); resources-only posture, MCP tools deferred to v0.2 (R16); operator-supplied `IdentityBridge` adapter (R10). |
| 2026-05-01 | Jeremy Forsythe | **Normative change.** Revised PRD-602-R8: dropped the invented MIME `application/act-block+json; profile=marketing` and the per-block MIME-variants table. R8 now states that each ACT node maps to one MCP resource and blocks are served inline as part of the `application/act-node+json; profile=runtime` node payload. Rationale: PRD-102 (Accepted) defines no canonical block-level MIME, and PRD-602 is content-tree bridging — granular block-as-MCP-resource exposition is a v0.2 feature that would coordinate with a PRD-102 MIME pin if and when one is introduced. Updated the surface-table row for R8 accordingly. No fixture file changes required (no fixtures author block-level URIs). |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
