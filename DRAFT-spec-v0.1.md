# ACT — Agent Content Tree (v0.1 draft)

**Status:** Source-of-truth for PRD authoring. The full v0.1 draft was authored inline in the planning conversation that produced this repo's `prd/` and `adr/` artifacts. It includes the table of contents above and sections covering: the problem framing, seven design perspectives (Format Architect, LLM Agent, Author/Publisher, Build Engineer, Skeptic, React Marketing Developer, B2B SaaS Engineer), three critique rounds, resolved design decisions, the §5 specification (manifest, index, node format, content blocks, progressive disclosure, bulk operations, caching, search, source adapters, component instrumentation, i18n, runtime serving, ACT-vs-MCP decision matrix), §6 configuration with adapter-specific blocks, §7 build pipeline and reference architecture, §8 worked examples (minimal docs, blog, e-commerce, corporate marketing with React/Contentful/i18n, SPA, B2B SaaS workspace), §9 comparison to alternatives, §10 open questions, §11 reference JSON Schema, and Appendices A–E.

PRD authoring under `prd/` cites this draft by section number (e.g., "draft §5.4" for the index format, "draft §5.13" for the runtime profile). When PRDs are accepted, they supersede the relevant draft sections. The draft will be retired as `DEPRECATED` when PRD-10 through PRD-19 (the 10-series core spec) reach Accepted status.

For section content, refer to the planning conversation transcript or to the PRDs themselves once authored. The taxonomy and gap analysis in `prd/00-INDEX.md` and `prd/00-gaps-and-resolutions.md` cover every section of the draft.

## Table of contents (preserved for reference)

1. The problem we're solving
2. Design exploration: seven perspectives
   - 2.1 Format Architect
   - 2.2 LLM Agent (Consumer)
   - 2.3 Author/Publisher
   - 2.4 Build Engineer
   - 2.5 Skeptic
   - 2.6 React Marketing Developer
   - 2.7 B2B SaaS Engineer
3. Critique rounds (1, 2 component-driven, 3 runtime/MCP)
4. Resolved design decisions (table)
5. Specification
   - 5.1 Overview
   - 5.2 Discovery
   - 5.3 Manifest
   - 5.4 Index
   - 5.5 Node format (5.5.1 required/optional, 5.5.2 content blocks, 5.5.3 node taxonomy)
   - 5.6 Progressive disclosure
   - 5.7 Bulk operations
   - 5.8 Caching & versioning
   - 5.9 Search (optional)
   - 5.10 Source adapters (5.10.1 contract, 5.10.2 reference adapters, 5.10.3 multi-source merging)
   - 5.11 Component instrumentation (5.11.1 three patterns, 5.11.2 page-level contracts, 5.11.3 build-time extraction, 5.11.4 variant handling, 5.11.5 Vue/Angular)
   - 5.12 Internationalization (5.12.1 manifest, 5.12.2 cross-locale refs, 5.12.3 i18n adapter, 5.12.4 untranslated keys)
   - 5.13 Runtime serving (5.13.1 contract, 5.13.2 auth, 5.13.3 caching, 5.13.4 per-tenant scoping, 5.13.5 hybrid sites, 5.13.6 streaming/subscriptions out of scope)
   - 5.14 ACT vs static vs runtime vs MCP decision matrix
6. Configuration (6.1 config file, 6.2 frontmatter, 6.3 strategies, 6.4 adapter-specific config, 6.5 composite example, 6.6 runtime SDK pattern)
7. Build integration (7.1 pipeline, 7.2 reference generator, 7.3 SPA pipelines, 7.4 plugin targets)
8. Examples (8.1 minimal docs, 8.2 blog, 8.3 e-commerce, 8.4 corporate marketing, 8.5 SPA no-SSR, 8.6 B2B SaaS runtime)
9. Comparison to alternatives
10. Open questions (18 items)
11. Reference JSON Schema
12. Appendix A — Why "ACT"?
13. Appendix B — Adoption strategy
14. Appendix C — 10K-node site comparison
15. Appendix D — Why this matters for component-driven sites
16. Appendix E — ACT and MCP: the relationship, plainly
