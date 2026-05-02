# `@act-spec/example-705-saas-workspace-runtime`

PRD-705 reference example: a multi-tenant B2B SaaS workspace served via the
ACT runtime profile. Standard tier; runtime delivery; Next.js-shape mount
bridged to a tiny Node HTTP server so the example boots without a full Next
runtime in its dependency tree.

The example is the canonical end-to-end demonstration of:

- `@act-spec/runtime-next` `defineActMount` wiring (PRD-501-R3 layout).
- `@act-spec/programmatic-adapter` materializing the workspace nodes at
  startup (PRD-208 future-seam pattern called for in PRD-705 OQ2).
- Per-tenant identity scoping with cross-tenant 404 byte-equivalence
  (PRD-705-R8 / R17 / R20; PRD-109-R3 / R11 / R13).
- Per-tenant ETag derivation via `defaultEtagComputer` (PRD-705-R10 /
  PRD-103-R6).
- Discovery `Link` hand-off middleware on non-ACT routes (PRD-705-R13 /
  PRD-501-R17).
- `Cache-Control: private, must-revalidate` + `Vary: Cookie` on every
  authenticated response (PRD-705-R11 / PRD-106-R12).
- Two-principal probe per `@act-spec/runtime-core/test-utils`
  (`runTwoPrincipalProbe`) — the mandatory non-negotiable gate from PRD-705
  acceptance criterion (e).

## Layout

```
examples/705-saas-workspace-runtime/
├── package.json
├── tsconfig.json
├── src/
│   ├── lib/
│   │   ├── db.ts                        # tiny in-memory tenants/users/docs
│   │   ├── auth.ts                      # sketch session/bearer validators
│   │   └── act-host/
│   │       ├── identity.ts              # PRD-705-R6 IdentityResolver
│   │       ├── tenant.ts                # PRD-705-R8 TenantResolver
│   │       ├── logger.ts                # PRD-705-R15 Logger (no-PII)
│   │       └── content.ts               # PRD-208 programmatic-adapter
│   │                                    #  materialization at module load
│   ├── lib/act-runtime/index.ts         # ActRuntime impl (manifest/index/
│   │                                    #  node/subtree)
│   └── app/
│       ├── act-mount.ts                 # defineActMount({...})
│       ├── middleware.ts                # actLinkHeaderMiddleware
│       └── server.ts                    # Node HTTP bridge for `pnpm start`
└── scripts/
    ├── serve.ts                         # pnpm start
    ├── probe.ts                         # PRD-705-R18 + R20 security probes
    ├── validate.ts                      # @act-spec/validator runtime walk
    └── conformance.ts                   # validate + probe; CI gate
```

## Scripts

| Script | What it does |
|---|---|
| `pnpm start` | Boots the HTTP bridge on `PORT` (default 3705) for manual smoke-testing. |
| `pnpm probe` | Runs the two-principal probe + the PRD-705-R18 eight-step transcript. |
| `pnpm validate` | Boots the server in-process, runs `@act-spec/validator validateSite` with credentials. |
| `pnpm conformance` | `validate` then `probe`; the CI gate. |
| `pnpm typecheck` | `tsc --noEmit`. |

## Smoke test

```bash
pnpm -F @act-spec/example-705-saas-workspace-runtime start &
PID=$!

# Public landing — anonymous-readable per PRD-705-R12.
curl -i http://127.0.0.1:3705/act/n/public/landing

# Tenant-A document, authenticated as user-A:
curl -i \
  -H "Authorization: Bearer bearer-token-A" \
  http://127.0.0.1:3705/act/n/doc/acme-roadmap-2026

# Cross-tenant access — user-A's document fetched by user-B → 404
# byte-equivalent to a non-existent document.
curl -i \
  -H "Authorization: Bearer bearer-token-B" \
  http://127.0.0.1:3705/act/n/doc/acme-roadmap-2026

curl -i \
  -H "Authorization: Bearer bearer-token-B" \
  http://127.0.0.1:3705/act/n/doc/never-existed

kill "$PID"
```

The two cross-tenant responses MUST be byte-identical (PRD-705-R17 / R20;
PRD-109-R3 / R11 / R13). The conformance gate fails the build otherwise.

## Conformance target

- Level: **Standard**
- Delivery: **runtime**
- Auth: cookie + bearer (advertised in the manifest; PRD-705-R2 / R9)

## Two-principal probe

`@act-spec/runtime-core/test-utils` exports `runTwoPrincipalProbe`, the
shared probe used by every runtime SDK leaf and by every runtime example.
The probe constructs Identity A and Identity B, verifies each can see their
own visible nodes, and then performs the cross-tenant attack: A asks for
B's ID and vice versa. Each MUST return 404, AND the body, headers, and
discovery `Link` header MUST be byte-identical to a request for an absent
node. `scripts/probe.ts` is the example's wiring.

PRD-705-R20 makes this gate a release blocker; the conformance script
exits non-zero on any cross-tenant probe failure.
