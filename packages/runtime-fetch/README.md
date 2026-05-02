# @act-spec/runtime-fetch

PRD-505 generic WHATWG-fetch handler for the [ACT (Agent Content Tree) v0.1](https://github.com/act-spec/act) reference implementation.

This package is the **leanest possible leaf** over [`@act-spec/runtime-core`](../runtime-core) (PRD-500). The whole adapter is one closure exposing one function:

```ts
(request: Request) => Promise<Response | null>
```

Because the input is already a WHATWG `Request` and the output is a WHATWG `Response`, this handler runs unchanged on every fetch-native runtime: Cloudflare Workers, Deno Deploy, Bun's `Bun.serve`, Vercel Edge Functions, Hono, Service Workers, and Node.js 20+ (where `Request` / `Response` are global). No Node-only API dependencies; no framework SDK.

## Install

```sh
pnpm add @act-spec/runtime-fetch
```

This package has zero peer dependencies. It depends only on `@act-spec/runtime-core` (which depends on `@act-spec/core` + `@act-spec/validator`); the dispatch pipeline, ETag computation, conditional GET, content negotiation, identity / tenant resolution, and discovery `Link` header all live in runtime-core.

## Quick start (Cloudflare Worker)

```ts
import { createActFetchHandler } from '@act-spec/runtime-fetch';

const actHandler = createActFetchHandler({
  manifest: {
    act_version: '0.1',
    site: { name: 'Acme Workspace' },
    delivery: 'runtime',
    conformance: { level: 'core' },
    auth: { schemes: ['bearer'] },
    index_url: '/act/index.json',
    node_url_template: '/act/n/{id}',
  },
  runtime: {
    async resolveManifest(req, ctx) { /* ... */ },
    async resolveIndex(req, ctx) { /* ... */ },
    async resolveNode(req, ctx, { id }) { /* ... */ },
  },
  identityResolver: async (actReq) => {
    const auth = actReq.headers.get('authorization');
    if (!auth?.startsWith('Bearer ')) return { kind: 'auth_required', reason: 'missing' };
    const claims = await verifyJwt(auth.slice(7));
    return claims ? { kind: 'principal', key: claims.sub } : { kind: 'auth_required', reason: 'invalid' };
  },
});

export default {
  fetch: async (req: Request): Promise<Response> => {
    const actResponse = await actHandler(req);
    if (actResponse) return actResponse;
    // Fall through to other handlers (HTML pages, app API, etc.)
    return new Response('Not Found', { status: 404 });
  },
};
```

## Routing

Per PRD-505-R4 the manifest is the routing source of truth. The handler reads the manifest's URL templates at construction time and routes incoming requests against them:

| Path | Endpoint | Level |
|---|---|---|
| `manifestPath` (default `/.well-known/act.json`) | manifest | Core |
| `index_url` | index | Core |
| `node_url_template` (with `{id}` capture) | node — IDs MAY contain `/` | Core |
| `subtree_url_template` | subtree | Standard / Plus |
| `index_ndjson_url` | NDJSON-streamed index | Plus |
| `search_url_template` | search | Plus |

The `manifestPath` is the only URL not declared inside the manifest itself. Override via `options.manifestPath` for deployments where `/.well-known/` is reserved by another protocol or rewritten by the host (PRD-505-R5 / OQ2).

### Passthrough vs strict mode

Per PRD-505-R5:

- **`passthrough`** (default) — non-matching requests resolve to `null`. The host chains its own router: `actHandler(req) ?? hostHandler(req)`. This is the common pattern in Workers / Deno / Hono / Bun.
- **`strict`** — non-matching requests resolve to a 404 with the ACT error envelope (byte-identical to the in-band 404 per PRD-109-R3 / PRD-500-R18). Use when the deployment is ACT-only and the host wants no fall-through.

```ts
const handler = createActFetchHandler({
  /* ... */,
  mode: 'strict', // 404 instead of null for non-ACT paths
});
```

## Hybrid mounts (`basePath`)

PRD-505-R3 / PRD-500-R26 — set `basePath` to mount the handler under a sub-path; advertised URLs in the served manifest are prefixed automatically:

```ts
const handler = createActFetchHandler({
  manifest: { /* ... */ },
  basePath: '/app',
  runtime: { /* ... */ },
  identityResolver: /* ... */,
});

// Effective served URLs:
//   /app/.well-known/act.json
//   /app/act/index.json
//   /app/act/n/{id}
```

A parent manifest at the root `/.well-known/act.json` (typically served by a sibling static-export build) declares the mount per PRD-100-R7 / PRD-106-R17–R22.

## Hono integration

```ts
import { Hono } from 'hono';
import { createActFetchHandler } from '@act-spec/runtime-fetch';

const actHandler = createActFetchHandler({ /* ... */ });

const app = new Hono();
app.use('*', async (c, next) => {
  const r = await actHandler(c.req.raw);
  if (r) return r;
  await next();
});
app.get('/', (c) => c.html('<h1>Acme</h1>'));

export default app;
```

The handler chains naturally — `null` falls through, a `Response` short-circuits.

## Deno Deploy

```ts
import { createActFetchHandler } from '@act-spec/runtime-fetch';

const actHandler = createActFetchHandler({
  manifest: { /* ... */ },
  runtime: { /* ... */ },
  identityResolver: async (actReq) => {
    const serviceId = actReq.headers.get('x-service-account');
    if (!serviceId) return { kind: 'anonymous' }; // public access
    const allowed = (Deno.env.get('ALLOWED_SERVICES') ?? '').split(',');
    if (!allowed.includes(serviceId)) return { kind: 'auth_required', reason: 'invalid' };
    return { kind: 'principal', key: serviceId };
  },
});

Deno.serve(async (request) => {
  const actResponse = await actHandler(request);
  return actResponse ?? new Response('Not Found', { status: 404 });
});
```

## Two-principal probe (cross-tenant non-disclosure)

This package wires the **mandatory** two-principal probe from [`@act-spec/runtime-core/test-utils`](../runtime-core/src/test-utils) against an in-process synthetic resolver. The probe verifies that:

1. Each principal can resolve their own visible nodes (sanity baseline).
2. Cross-tenant requests (principal A asks for principal B's node, and vice versa) return 404.
3. The cross-tenant 404 is **byte-equivalent** to an absent-node 404 (status, body, every header — `Content-Type`, `Cache-Control`, `Link`).
4. The discovery `Link` header is present and identical across both 404 paths (does not leak tenant identity in error cases).

The probe is in `src/probe.test.ts` and runs as part of `pnpm test`. It is a **CI-mandatory test** per the runtime-tooling-engineer's anti-pattern watchlist ("Runtime/static auth confusion") and PRD-705 acceptance criterion (e). Do not skip; do not weaken.

## NDJSON streaming portability

Per PRD-505-R8 the handler streams NDJSON via the manual `new ReadableStream({ start(controller) { … } })` form. We deliberately do **not** use `ReadableStream.from(asyncIterable)` because it is not yet uniformly available across v0.1 target runtimes (Node.js < 22, some Bun versions). The manual form runs on every WHATWG-fetch host.

Reverse proxies in front of fetch-native deployments (nginx, Caddy) MUST be configured to disable buffering on `/act/index.ndjson` so clients see lines incrementally.

## Web Crypto availability

The default ETag computer uses `crypto.subtle.digest('SHA-256', ...)` via `@act-spec/runtime-core`. All v0.1 target runtimes (Cloudflare Workers, Deno Deploy, Bun, Vercel Edge, Hono on Workers, Service Workers, Node.js 20+) provide `crypto.subtle`. Hosts deploying on older Node.js (< 18) must use `--experimental-global-webcrypto` or fall back to [`@act-spec/runtime-express`](../runtime-express).

## Conformance

`pnpm -F @act-spec/runtime-fetch conformance` runs `@act-spec/validator` in `validateSite` runtime-walk mode against an in-process Standard handler via a synthetic fetcher (no real HTTP server). Pass criterion: 0 gaps; achieved level == declared level.

## License

Apache-2.0. See [LICENSE](../../LICENSE).
