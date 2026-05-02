# @act-spec/runtime-core

PRD-500 runtime SDK contract for the [ACT (Agent Content Tree) v0.1](https://github.com/act-spec/act) reference implementation.

This package is the **framework PRD** that all first-party runtime SDK leaves
(`@act-spec/runtime-next` per PRD-501, `@act-spec/runtime-express` per PRD-502,
`@act-spec/runtime-fetch` per PRD-505) consume. Per PRD-500-R28, leaf packages
are thin framework adapters; the resolver shape, identity context, capability
negotiation, conditional GET handling, error envelope construction, and
discovery hand-off all live here.

## Public surface

The full TypeScript signatures are normative per PRD-500-R1. The exports group
under three families:

### Resolver contract (PRD-500-R3, R4)

```ts
import type { ActRuntime, Outcome, ActContext } from '@act-spec/runtime-core';
```

A host application implements `ActRuntime` (Core methods `resolveManifest`,
`resolveIndex`, `resolveNode`; Standard `resolveSubtree`; Plus
`resolveIndexNdjson`, `resolveSearch`) and returns an `Outcome<T>`
discriminated union (`ok`, `not_found`, `auth_required`, `rate_limited`,
`validation`, `internal`).

### Identity & tenancy hooks (PRD-500-R6, R7)

```ts
import type { Identity, Tenant, IdentityResolver, TenantResolver } from '@act-spec/runtime-core';
```

`Identity.key` and `Tenant.key` are stable opaque strings — never session
tokens, never per-request values (PRD-100-R15 / PRD-106-R16 / PRD-103-R6).

### Construction & dispatch (PRD-500-R5, R10, R11)

```ts
import { createActRuntime } from '@act-spec/runtime-core';
const runtime = createActRuntime({ manifest, runtime, identityResolver, ... });
const response = await runtime.dispatch(actRequest);
```

`createActRuntime` validates capability negotiation at **construction time**
per PRD-500-R10 — declaring `conformance.level: "plus"` without registering
`resolveSearch` throws synchronously, never at request time.

### Helpers (PRD-500-R13, R14, R20)

- `encodeIdForUrl(id)` — per-segment percent-encoding per PRD-100-R12.
- `buildAuthChallenges(manifest)` — one `WWW-Authenticate` value per advertised
  scheme in `auth.schemes` order per PRD-106-R8.
- `defaultEtagComputer(input)` — PRD-103-R6 runtime triple (JCS + SHA-256 +
  base64url no-pad + truncate to 22 + `s256:` prefix). Re-exports
  `@act-spec/validator`'s implementation per PRD-500 dependency on PRD-103
  (ADR-004 Seam 3).
- `actLinkHeaderMiddleware({ basePath })` — emits the runtime-only `Link
  rel="act"` header per PRD-106-R23 / PRD-500-R29 for non-ACT branches.

## Two-principal probe harness (`@act-spec/runtime-core/test-utils`)

```ts
import { runTwoPrincipalProbe } from '@act-spec/runtime-core/test-utils';

await runTwoPrincipalProbe({
  runtime,
  principalA: { identity: { kind: 'principal', key: 'alice' }, tenant: { kind: 'scoped', key: 'acme' }, visibleNodeIds: ['a-doc'] },
  principalB: { identity: { kind: 'principal', key: 'bob' }, tenant: { kind: 'scoped', key: 'globex' }, visibleNodeIds: ['b-doc'] },
  absentNodeId: 'definitely-not-a-real-doc',
});
```

The harness is **mandatory** for every leaf runtime SDK per PRD-500-R31 +
PRD-705 acceptance criterion (e). It probes:

- **Cross-tenant non-disclosure (PRD-109-R3, PRD-109-R11, PRD-109-R13).**
  Principal A cannot resolve principal B's visible node IDs; the response is
  byte-equivalent to a request for a node that does not exist.
- **Existence-non-leak (PRD-500-R18 / PRD-109-R3).** The cross-tenant 404 has
  identical body, identical headers, and identical `Content-Length` to the
  absent-node 404. The discovery `Link` header is identical (it does not leak
  tenant identity).

The probe accepts a synthetic conformant resolver in this package's tests and
will be wired into PRD-501 / PRD-502 / PRD-505 leaf SDK conformance gates.

## Coverage

This package targets ≥ 85% line / function / statement coverage per the
`docs/workflow.md` testing strategy table. The framework is not wire-format
core (PRD-100 / PRD-103 are); the 85% floor matches `@act-spec/adapter-framework`
per ADR-005.

## Status

Implementing PRD-500 ([prd/500-runtime-sdk-contract.md](../../prd/500-runtime-sdk-contract.md)),
status `Accepted` (2026-05-02). This package is the contract that PRD-501,
PRD-502, and PRD-505 leaf SDKs adapt to their respective frameworks.
