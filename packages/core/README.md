# @act-spec/core

Shared TypeScript types for the ACT v0.1 reference implementation.

Two surfaces:

- **Hand-written reporter contracts** (`src/conformance-reporter.ts`) for the PRD-600 / PRD-107 conformance reporter (`Gap`, `Warning`, `AchievedLevel`, `ConformanceReport`, `ValidationResult`, `Reporter`). Source of truth is the PRD text; never widen these in a leaf package.
- **Codegen'd envelope types** (`src/generated/`) derived from `schemas/{100,101,102,103,109}/*.schema.json`. Run `pnpm -F @act-spec/core codegen` after schema changes; the output is gitignored and rebuilt on demand.

The codegen entrypoint is `scripts/codegen.ts`. It walks `schemas/`, emits one `.ts` per `.schema.json`, and rewrites the `src/generated/index.ts` barrel.
