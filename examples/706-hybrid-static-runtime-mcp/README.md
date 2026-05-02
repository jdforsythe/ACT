# PRD-706 — Hybrid static + runtime + MCP bridge example

This example composes three Phase 6.2 reference implementations into one
deployment topology:

- **`/marketing/*`** — a Plus-tier static ACT mount built by `@act-spec/cli`
  (PRD-409) from a markdown corpus under `marketing/content/`. Public,
  anonymous-readable. Plus-tier surface includes NDJSON index + a
  search-template-advertised search endpoint (body opaque-but-JSON per
  Q13 / PRD-602-R15).
- **`/app/*`** — a Standard-tier runtime ACT mount served by
  `@act-spec/runtime-next` (PRD-501) with `basePath: "/app"`. Multi-tenant,
  identity-scoped, cross-tenant 404 byte-equivalent. Inherits PRD-705's
  patterns verbatim.
- **MCP bridge** — `@act-spec/mcp-bridge` (PRD-602) wrapping both mounts as
  MCP resources under `act://acme.local/...`. Anonymous MCP sessions see
  only the marketing slice; authenticated sessions see marketing +
  their tenant's app tree.

## Auth boundary

| Surface | Auth | Notes |
|---|---|---|
| `/.well-known/act.json` (parent) | none | Routing manifest only — discloses two mounts and their levels. |
| `/marketing/*` | none | Public marketing tree. `Cache-Control: public, max-age=300, must-revalidate`. |
| `/app/.well-known/act.json` | required | 401 with `WWW-Authenticate` for cookie + bearer. |
| `/app/act/n/public/landing` | none | Single optional public branch (per PRD-705-R12). |
| `/app/act/n/<tenant-doc>` | required + tenant scope | Cross-tenant 404 byte-equivalent. |
| MCP `act://acme.local/manifest` | none | Routing manifest. |
| MCP `act://acme.local/marketing/<id>` | none | Marketing nodes. |
| MCP `act://acme.local/app/<id>` | required via `IdentityBridge` | Tenant-scoped. |

## Layout

```
examples/706-hybrid-static-runtime-mcp/
├── marketing/content/    # markdown corpus consumed by @act-spec/cli
├── src/
│   ├── app/              # runtime mount (defineActMount + HTTP bridge)
│   └── lib/              # identity, tenant, content, db
├── scripts/
│   ├── build-marketing.ts  # PRD-409 pipeline + Plus enrichments + parent manifest
│   ├── serve.ts            # boot the hybrid HTTP server
│   ├── validate.ts         # PRD-706-R19 validator gate (per-mount sub-reports)
│   ├── probe.ts            # PRD-706-R10 two-principal probe + R10 transcript
│   ├── probe-mcp.ts        # PRD-706-R20 MCP enumeration probe
│   └── conformance.ts      # chain all gates + R16 byte-equality check
├── dist/                 # build output (gitignored)
└── package.json
```

## Run

```sh
pnpm -F @act-spec/example-706-hybrid-static-runtime-mcp build:marketing
pnpm -F @act-spec/example-706-hybrid-static-runtime-mcp start
# → curl http://localhost:3706/.well-known/act.json
# → curl http://localhost:3706/marketing/.well-known/act.json
# → curl -H 'Authorization: Bearer bearer-token-A' \
#         http://localhost:3706/app/act/n/doc/acme-roadmap-2026

pnpm -F @act-spec/example-706-hybrid-static-runtime-mcp conformance
# → builds twice (byte-equality); validates per-mount; runs the
#   two-principal probe + the MCP enumeration probe.
```
