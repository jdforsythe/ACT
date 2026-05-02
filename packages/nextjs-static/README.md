# @act-spec/nextjs-static

PRD-405 Next.js static-export generator for ACT v0.1. Source of truth: `prd/405-nextjs-plugin.md` (and the PRD-400 generator framework via `@act-spec/generator-core`).

Public surface: `withAct(nextConfig, options)` — a `next.config.js` wrapper that registers a post-build webpack hook to invoke the canonical PRD-400 pipeline against Next's static-export output (`out/`).
