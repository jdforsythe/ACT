# @act-spec/strapi-adapter

PRD-205 Strapi adapter for ACT v0.1. Consumes the Strapi v4 / v5 REST
(default) or GraphQL Content API and emits PRD-100 / PRD-102 envelopes
against the PRD-200 framework (`@act-spec/adapter-framework`). Supports
content-type and field mapping, markdown body emission with optional
split into `prose` / `code` / `callout` blocks, dynamic-zone components →
`marketing:*`, relation resolution with cycle tolerance, locale fan-out
via the Strapi i18n plugin, `updatedAt`-marker delta, and HMAC-SHA256
webhook signature verification.

## Status

ACT v0.1 internal hand-test candidate. Public release lands at v0.2.

## Install

Unpublished in v0.1. Consume via the workspace:

```jsonc
// package.json
{ "dependencies": { "@act-spec/strapi-adapter": "workspace:*" } }
```

## Usage

```ts
import { createStrapiAdapter } from '@act-spec/strapi-adapter';

const adapter = createStrapiAdapter({
  config: {
    baseUrl: 'https://cms.example.com',         // https in prod (PRD-205-R22)
    apiToken: { from_env: 'STRAPI_TOKEN' },
    apiVersion: 'v5',                           // or 'v4'
    transport: 'rest',                          // or 'graphql'
    populateDepth: 2,                           // 0–4
    dynamicZoneMax: 2,                          // 1–3
    mappings: {
      article: {
        type: 'article',
        title: 'title',
        body: { from: 'body', as: 'markdown', split: true },
      },
    },
  },
});
```

Webhook signatures (PRD-205 security section):

```ts
import { verifyWebhookSignature } from '@act-spec/strapi-adapter';

const ok = verifyWebhookSignature(rawBody, headers['x-strapi-signature'], secret);
```

## Conformance / what's tested

Every PRD-205-R{n} requirement has a citing test in `src/strapi.test.ts`
covering REST and GraphQL transports, dynamic-zone walks, relation
cycle tolerance, locale fan-out, and the `updatedAt` delta path. The
conformance gate runs `@act-spec/validator` against the bundled fixtures.

```bash
pnpm -F @act-spec/strapi-adapter conformance
```

## Configuration (selected)

| Option | Default | Notes |
| --- | --- | --- |
| `baseUrl` | (required) | Strapi base URL; `http://` triggers a warning. |
| `apiToken` | (required) | Inline string OR `{ from_env: 'NAME' }`. |
| `apiVersion` | `'v5'` | `'v4'` selects v4 response normalization. |
| `transport` | `'rest'` | Or `'graphql'`. |
| `populateDepth` | `2` | Range 0–4. |
| `dynamicZoneMax` | `2` | Range 1–3. |
| `mappings` | `{}` | Content-type → field-mapping DSL. |
| `concurrency` | `4` | Adapter framework parallelism. |

## Compatibility

No Strapi SDK peer dependency; the adapter speaks HTTP / GraphQL to the
configured `baseUrl` directly. Tested against Strapi v4 and v5 response
shapes (v4 `data.attributes` envelope is normalized via
`normalizeEntity`).

## Links

- Leaf PRD: [`prd/205-strapi-adapter.md`](../../prd/205-strapi-adapter.md)
- Framework PRD: [`prd/200-adapter-framework.md`](../../prd/200-adapter-framework.md)
- Framework package: [`@act-spec/adapter-framework`](../adapter-framework)
- Repository: <https://github.com/act-spec/act>
