# @act-spec/remix-static

PRD-406 Remix-Vite static-export generator for ACT v0.1. Source of truth: `prd/406-remix-plugin.md` (and the PRD-400 generator framework via `@act-spec/generator-core`).

Public surface: `act(options)` — a Vite plugin that runs the canonical PRD-400 pipeline from Vite's `closeBundle` hook (client build only) after `remix vite:build` finishes prerendering. Operators add it to `vite.config.ts` alongside Remix's `vitePlugin`.
