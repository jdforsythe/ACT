# @act-spec/generator-core

PRD-400 generator framework for ACT v0.1. Pipeline orchestration, manifest/index/subtree builders, etag derivation, target-level + adapter-pinning enforcement, file emission, capability backing verification, and build-report shape — shared by every first-party generator.

Extracted from `@act-spec/astro` per ADR-006 (trigger: ADR-004 §"Seam 2" + Phase 6.2 Track B beginning with PRD-404 Docusaurus). New generators (PRD-404 Docusaurus, PRD-405 Next.js, PRD-406 Remix, PRD-407 Nuxt, PRD-408 Eleventy, PRD-409 CLI) import from here directly; the astro generator re-exports the same surface for backward compatibility.

Source of truth: `prd/400-generator-architecture.md`.
