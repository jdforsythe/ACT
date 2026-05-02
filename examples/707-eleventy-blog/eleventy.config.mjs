// eleventy.config.mjs — PRD-707 reference example (Tinybox Blog).
//
// PRD-707-R1 / R2 / R11 — registers @act-spec/eleventy as the only ACT
// plugin via Eleventy's `addPlugin` API; the @act-spec/markdown-adapter
// is auto-wired by PRD-408-R3 against Eleventy's resolved input dir.
//
// Configuration shape mirrors PRD-707-R11's normative snippet. The
// `urlTemplates` keys use the JS camelCase form (`indexUrl`,
// `nodeUrlTemplate`, `subtreeUrlTemplate`) per the EleventyActOptions
// contract in `@act-spec/eleventy/types`; the snake_case form in the
// PRD-707-R11 prose is the on-wire manifest field name. See A16 in
// docs/amendments-queue.md for the trivial-inline clarification.
//
// PRD-707-R9 — `bindings` MUST NOT be supplied; the field's absence is
// the contract.
// PRD-707-R11 — MUST NOT supply `adapters` (auto-wiring is exercised),
// MUST NOT supply `searchArtifactPath`, MUST NOT enable `incremental`.
import actPlugin from '@act-spec/eleventy';

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(actPlugin, {
    // PRD-707-R11 — declared conformance target.
    conformanceTarget: 'standard',
    // PRD-707-R11 — required deployment origin.
    baseUrl: 'https://example.com',
    // PRD-707-R11 — site identity for the manifest.
    manifest: { site: { name: 'Tinybox Blog' } },
    // PRD-707-R11 — Standard-tier URL templates (Core + subtree).
    // The on-disk emission paths are `_site/act/nodes/<id>.json` and
    // `_site/act/subtrees/<id>.json` per generator-core's emitFiles;
    // the templates here are the manifest-advertised URLs only.
    urlTemplates: {
      indexUrl: '/act/index.json',
      nodeUrlTemplate: '/act/n/{id}.json',
      subtreeUrlTemplate: '/act/sub/{id}.json',
    },
    // PRD-408-R12 / A10 — `parseMode: "fine"` lets the auto-wired
    // PRD-201 adapter declare Standard so the Standard target is
    // admissible (PRD-201-R23 + PRD-200-R24). Mirrors PRD-700's
    // markdown-adapter `mode: "fine"` setting and ADR-004's "where
    // the seams are loose" note (A8). The corpus is plain-prose
    // markdown so coarse-vs-fine emission is practically identical
    // for this example.
    parseMode: 'fine',
  });

  return {
    // PRD-707 implementation-notes layout: input dir is the project root.
    // Eleventy auto-ignores `node_modules` and `_site`; the corpus's
    // `.eleventyignore` adds `README.md` so the example's own README
    // does NOT contribute an ACT node.
    dir: { input: '.', output: '_site' },
    markdownTemplateEngine: 'njk',
  };
}
