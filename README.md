# ACT — Agent Content Tree

**An open standard for publishing structured, AI-discoverable content from any website, CMS, or app.**

The web is full of content that AI agents can read but can't *understand* the structure of: which pages are siblings, what type of content lives where, which version is canonical, what locale a translation falls back to. ACT fixes that by sitting on top of your existing site as a small set of well-known JSON files (or live HTTP endpoints) that any agent can crawl in O(1) lookups instead of brittle HTML scraping.

## Why ACT

- **Zero-friction adoption.** Drop a plugin into your existing build (Astro, Docusaurus, Next.js, Nuxt, Remix, Eleventy, or a standalone CLI) and ACT files emit alongside your normal output. No content rewrites. No new CMS. No runtime cost.
- **Set it and forget it.** ACT is generated from your existing content — markdown, your headless CMS, your database, your i18n catalogs. When your content changes, ACT changes with it. There's nothing to keep in sync by hand.
- **One spec, every stack.** The wire format is just JSON envelopes. Producers (adapters + generators) and consumers (validators, agents, MCP bridges) share one contract — so a single agent can navigate any ACT-compliant site the same way.
- **Static or runtime, your choice.** Ship pre-built JSON to a CDN, serve it live from your app for per-tenant scoping, or do both. The wire format is identical.
- **Conformance is a first-class citizen.** Every adapter and generator passes the same validator. There's a hosted validator SPA so any consumer can check a site without installing anything.

## Try it

The fastest way to see ACT in action is to clone the repo and run an example:

```sh
pnpm install
pnpm -F @act-spec/example-astro-docs conformance
```

That builds the [astro-docs](./examples/astro-docs) example and validates its output. Open `examples/astro-docs/dist/.well-known/act.json` to see what ACT emits.

## Examples

Each example is a real, runnable site that ACT plugs into. Pick the one closest to your stack to see how a few lines of config produce a fully-conformant ACT tree.

| Example | Stack | What it shows |
|---|---|---|
| [astro-docs](./examples/astro-docs) | Astro 4 + markdown | Minimal documentation site — the smallest possible ACT integration. |
| [docusaurus-docs](./examples/docusaurus-docs) | Docusaurus 3 | Large docs site (200–500 pages, deep sidebar hierarchy). |
| [nextjs-marketing](./examples/nextjs-marketing) | Next.js 14 + Contentful + next-intl + React | Localized marketing site pulling from a headless CMS, with React component-level content extraction. |
| [ecommerce-catalog](./examples/ecommerce-catalog) | Programmatic adapter | 500-SKU product catalog generated directly from a database/API — no markdown, no CMS. |
| [nextjs-saas-runtime](./examples/nextjs-saas-runtime) | Next.js runtime | Multi-tenant B2B SaaS workspace serving ACT live, with per-tenant identity scoping. |
| [hybrid-static-runtime-mcp](./examples/hybrid-static-runtime-mcp) | CLI + Next.js runtime + MCP | Marketing site (static) + app (runtime) + an MCP bridge serving both to AI agents. |
| [eleventy-blog](./examples/eleventy-blog) | Eleventy 2 + markdown | Chronological blog with drafts and frontmatter-driven summaries. |

## Packages

ACT ships as a small, focused set of TypeScript packages. Use the ones you need; ignore the rest.

**Build-time integrations** — drop into your existing build to emit static ACT files:

- [`@act-spec/plugin-astro`](./packages/plugin-astro) — Astro integration
- [`@act-spec/plugin-docusaurus`](./packages/plugin-docusaurus) — Docusaurus plugin
- [`@act-spec/plugin-nextjs`](./packages/plugin-nextjs) — Next.js static export
- [`@act-spec/plugin-remix`](./packages/plugin-remix) — Remix static export
- [`@act-spec/plugin-nuxt`](./packages/plugin-nuxt) — Nuxt module
- [`@act-spec/plugin-eleventy`](./packages/plugin-eleventy) — Eleventy plugin
- [`@act-spec/cli`](./packages/cli) — `act` CLI for any framework (or no framework)

**Source adapters** — pull content from where you keep it:

- [`@act-spec/adapter-markdown`](./packages/adapter-markdown) — markdown / MDX
- [`@act-spec/adapter-contentful`](./packages/adapter-contentful) — Contentful
- [`@act-spec/adapter-sanity`](./packages/adapter-sanity) — Sanity
- [`@act-spec/adapter-storyblok`](./packages/adapter-storyblok) — Storyblok
- [`@act-spec/adapter-strapi`](./packages/adapter-strapi) — Strapi
- [`@act-spec/adapter-builder`](./packages/adapter-builder) — Builder.io
- [`@act-spec/adapter-i18n`](./packages/adapter-i18n) — next-intl / react-intl / i18next
- [`@act-spec/adapter-programmatic`](./packages/adapter-programmatic) — your database, API, or anywhere else

**Component-level extraction** — pull structured content out of your React / Vue / Angular components:

- [`@act-spec/component-react`](./packages/component-react)
- [`@act-spec/component-vue`](./packages/component-vue)
- [`@act-spec/component-angular`](./packages/component-angular)

**Runtime SDK** — serve ACT live from your app instead of pre-building:

- [`@act-spec/runtime-next`](./packages/runtime-next) — Next.js
- [`@act-spec/runtime-express`](./packages/runtime-express) — Express
- [`@act-spec/runtime-fetch`](./packages/runtime-fetch) — any WHATWG `fetch`-compatible runtime

**Tooling**:

- [`@act-spec/validator`](./packages/validator) — `act-validate` CLI + library
- [`@act-spec/inspector`](./packages/inspector) — `act-inspect` CLI for crawling and inspecting ACT trees
- [`@act-spec/mcp-bridge`](./packages/mcp-bridge) — expose any ACT site as an MCP server
- [Hosted validator SPA](./apps/validator-web) — drop a manifest into a browser, get a report

## The spec

The normative specification lives in [`prd/`](./prd/). The wire-format JSON Schemas are in [`schemas/`](./schemas/). Conformance fixtures are in [`fixtures/`](./fixtures/).

If you're implementing ACT in a language other than TypeScript, the spec + schemas + fixtures are everything you need.

## Status

ACT v0.1 is a pre-release: the spec is locked and 30 reference packages plus 7 example sites are implemented in this repo. Packages are not yet on npm — install via `pnpm install` from a clone of this repo. v0.2 will be the first npm-published, publicly tagged release.

## Requirements

- Node.js ≥ 20.18
- pnpm ≥ 10

## License

- Code: [Apache-2.0](./LICENSE)
- Specification text: [CC BY 4.0](./LICENSE-spec)
