# @act-spec/validator-web

Hosted client-side ACT validator SPA for v0.1 (PRD-600-R28 / decision Q8
Option 3). Wraps `@act-spec/validator` for browser consumption: schemas
are bundled at build time via Vite's `?raw` import and handed to
`compileSchemasFromRaw`; the validator's Node-only `loadSchemas()` is
never called in this build. The SPA validates manifests, indexes, nodes,
NDJSON indexes, subtrees, and error envelopes entirely in-browser — no
network call leaves the operator's machine.

Deployed to GitHub Pages at `/validator/` from within the spec repo.

## Status

ACT v0.1 internal hand-test candidate. Public release lands at v0.2.

## Develop

```bash
pnpm -F @act-spec/validator-web dev        # vite dev server on :5174
pnpm -F @act-spec/validator-web build      # static SPA in apps/validator-web/dist
pnpm -F @act-spec/validator-web preview    # serve the built SPA
pnpm -F @act-spec/validator-web typecheck  # tsc --noEmit
pnpm -F @act-spec/validator-web test       # vitest
```

The dev server hosts the SPA at `http://localhost:5174/validator/`.
`VALIDATOR_WEB_BASE` overrides the asset base path at build time
(default `/validator/`).

## What's tested

`detect.test.ts` covers the envelope-kind detector that picks the right
per-envelope validator from `@act-spec/validator`. `validate.test.ts`
covers the SPA's wrapper around the validator's `compileSchemasFromRaw`
+ envelope-validator surface and the report rendering shape.

```bash
pnpm -F @act-spec/validator-web conformance
```

## Build metadata

The footer surfaces the `BUILD_SHA` and `BUILD_TIMESTAMP` constants
required by PRD-600-R28 / R29, derived in `vite.config.ts` via
`git rev-parse --short HEAD` at build time.

## Compatibility

Modern browsers (ES2022 baseline). The bundle is sourcemapped; the
`schemas/` JSON files at the repo root are inlined as raw strings, so
SPA size scales with schema count.

## Links

- Validator PRD: [`prd/600-validator.md`](../../prd/600-validator.md)
- Validator package: [`@act-spec/validator`](../../packages/validator)
- Hosting (decision Q8 Option 3): client-side SPA on GitHub Pages.
- Repository: <https://github.com/act-spec/act>
