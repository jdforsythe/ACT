# @act-spec/validator

PRD-600 conformance validator for ACT v0.1. **Scaffold only** at this point — PRD-600 implementation lands in Phase 6.1 step 3 (`docs/team-blueprint.md`).

When implemented, this package will ship:

- `validateManifest`, `validateNode`, `validateIndex`, `validateNdjsonIndex`, `validateSubtree`, `validateError`, `validateSite` (TypeScript library).
- `act-validate` CLI (PRD-600-R26 / R27).
- A static SPA at `/validator/` on the spec's GitHub Pages site (PRD-600-R28).

Source of truth: `prd/600-validator.md`. Reporter shape: `@act-spec/core`'s `ConformanceReport`.
