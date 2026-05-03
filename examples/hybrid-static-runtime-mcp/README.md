# Hybrid static + runtime + MCP example

A single deployment that combines three ACT delivery profiles into one URI namespace:

- **`/marketing/*`** — public marketing site, served as **pre-built static** ACT files
- **`/app/*`** — multi-tenant SaaS app, served **live at request time** with per-tenant identity scoping
- **MCP bridge** — both mounts also exposed as resources to AI agents over the **Model Context Protocol**

If your product has both a public marketing surface and a logged-in app — and you want both navigable by AI agents — this is the integration shape.

## The stack

- **Static mount** (`/marketing/*`) built by the standalone `act` CLI from a markdown corpus
- **Runtime mount** (`/app/*`) served by `@act-spec/runtime-next` with cookie + bearer auth
- **MCP bridge** via `@act-spec/mcp-bridge`, exposing both mounts under `act://acme.local/...`
- **A parent manifest** at `/.well-known/act.json` advertising both mounts

## How ACT plugs in

Two mounts compose under one origin:

```
your origin
├── /.well-known/act.json     # routing manifest — advertises both mounts
├── /marketing/.well-known/act.json   # public, anonymous-readable
├── /marketing/act/...                # static JSON files on disk
├── /app/.well-known/act.json         # auth-required
└── /app/act/...                      # served by runtime SDK, identity-scoped
```

The MCP bridge wraps both mounts as MCP resources. Anonymous MCP sessions see only the marketing slice; authenticated sessions see marketing + their tenant's app tree. From the agent's perspective, the auth boundary is automatic.

## Auth boundary

| Surface | Auth | Notes |
|---|---|---|
| `/.well-known/act.json` (parent) | none | Routing manifest only — discloses two mounts. |
| `/marketing/*` | none | Public marketing tree. `Cache-Control: public, max-age=300, must-revalidate`. |
| `/app/.well-known/act.json` | required | 401 with `WWW-Authenticate` for cookie + bearer. |
| `/app/act/n/public/landing` | none | Single optional public branch. |
| `/app/act/n/<tenant-doc>` | required + tenant scope | Cross-tenant access returns byte-identical 404. |
| MCP `act://acme.local/manifest` | none | Routing manifest. |
| MCP `act://acme.local/marketing/<id>` | none | Marketing nodes. |
| MCP `act://acme.local/app/<id>` | required via `IdentityBridge` | Tenant-scoped. |

## Run this example

```sh
pnpm install                                                       # from the repo root

# 1. Build the static marketing mount (markdown → ACT files in dist/marketing/)
pnpm -F @act-spec/example-hybrid-static-runtime-mcp build:marketing

# 2. Boot the hybrid HTTP server on http://localhost:3706
pnpm -F @act-spec/example-hybrid-static-runtime-mcp start

# In another terminal — view the parent manifest:
open http://localhost:3706/.well-known/act.json

# Marketing mount (public):
curl -i http://localhost:3706/marketing/.well-known/act.json
curl -i http://localhost:3706/marketing/act/index.json

# App mount (auth required) — tenant A:
curl -i \
  -H 'Authorization: Bearer bearer-token-A' \
  http://localhost:3706/app/act/n/doc/acme-roadmap-2026

# Validate + probes:
pnpm -F @act-spec/example-hybrid-static-runtime-mcp validate
pnpm -F @act-spec/example-hybrid-static-runtime-mcp probe        # two-principal probe on the runtime mount
pnpm -F @act-spec/example-hybrid-static-runtime-mcp probe:mcp    # MCP enumeration probe
pnpm -F @act-spec/example-hybrid-static-runtime-mcp conformance  # all of the above + byte-equality check
```

### Inspecting via MCP

The MCP bridge exposes resources under the `act://acme.local/...` URI scheme. Anonymous MCP clients see the marketing namespace; authenticated clients (via the `IdentityBridge`) see marketing + their tenant's app tree. The included `probe:mcp` script enumerates resources from both an anonymous and an authenticated session and asserts that the auth boundary holds at the MCP layer.

### What the example shows

- **Two delivery profiles, one origin.** Static for content that's safe to cache publicly; runtime for content that varies per identity.
- **Parent + child manifests.** The parent at `/` is a tiny routing document; each mount has its own full manifest.
- **MCP without rewriting.** The bridge consumes the same ACT trees as everything else; AI agents get a navigable surface for free.
- **Byte-equality determinism.** Two consecutive marketing builds produce identical bytes (the conformance script asserts this).
