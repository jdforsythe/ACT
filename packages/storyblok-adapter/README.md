# @act-spec/storyblok-adapter

PRD-204 Storyblok adapter for ACT v0.1. Consumes the Storyblok Content
Delivery API (stories + TipTap-derived rich text + component blocks) and
emits PRD-100 / PRD-102 envelopes against the PRD-200 framework
(`@act-spec/adapter-framework`). Supports content-type and field mapping,
rich-text → block conversion, story-link resolution with cycle tolerance,
locale fan-out (folder + field strategies), `cv`-marker delta, and
HMAC-SHA256 webhook signature verification.

## Status

ACT v0.1 internal hand-test candidate. Public release lands at v0.2.

## Install

Unpublished in v0.1. Consume via the workspace:

```jsonc
// package.json
{ "dependencies": { "@act-spec/storyblok-adapter": "workspace:*" } }
```

## Usage

```ts
import { createStoryblokAdapter } from '@act-spec/storyblok-adapter';

const adapter = createStoryblokAdapter({
  config: {
    accessToken: { from_env: 'STORYBLOK_TOKEN' },
    spaceId: 12345,
    region: 'eu',
    version: 'published',                  // or 'draft'
    linkResolutionDepth: 2,                // 0–5
    componentRecursionMax: 2,              // 1–4
    mappings: {
      article: {
        type: 'article',
        title: 'title',
        body: { from: 'body', as: 'richtext' },
      },
    },
  },
});
```

Webhook signatures (PRD-204 security section):

```ts
import { verifyWebhookSignature } from '@act-spec/storyblok-adapter';

const ok = verifyWebhookSignature(rawBody, headers['webhook-signature'], secret);
```

## Conformance / what's tested

Every PRD-204-R{n} requirement has a citing test in
`src/storyblok.test.ts` covering TipTap richtext walks, component-block
recursion bounds, story-link cycles, and the `cv`-marker delta path. The
conformance gate runs `@act-spec/validator` against the bundled fixtures.

```bash
pnpm -F @act-spec/storyblok-adapter conformance
```

## Configuration (selected)

| Option | Default | Notes |
| --- | --- | --- |
| `accessToken` | (required) | Inline string OR `{ from_env: 'NAME' }`. |
| `spaceId` | (required) | Storyblok space ID. |
| `region` | `'eu'` | Or `'us'` / `'ap'` / `'ca'` / `'cn'`. |
| `version` | `'published'` | `'draft'` requires a preview token. |
| `linkResolutionDepth` | `2` | Range 0–5. |
| `componentRecursionMax` | `2` | Range 1–4. |
| `mappings` | `{}` | Content-type → field-mapping DSL. |
| `concurrency` | `4` | Adapter framework parallelism. |

## Peer dependencies

Optional peer; install when wiring the live Storyblok client:

| Peer | Range |
| --- | --- |
| `storyblok-js-client` | `^6.0.0` |

## Links

- Leaf PRD: [`prd/204-storyblok-adapter.md`](../../prd/204-storyblok-adapter.md)
- Framework PRD: [`prd/200-adapter-framework.md`](../../prd/200-adapter-framework.md)
- Framework package: [`@act-spec/adapter-framework`](../adapter-framework)
- Repository: <https://github.com/act-spec/act>
