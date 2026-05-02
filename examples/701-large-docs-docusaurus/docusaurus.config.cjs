// docusaurus.config.js — PRD-701 reference example.
//
// Reproduces the canonical config shape from PRD-701-R9. The plugin
// registration matches PRD-404-R16 verbatim: `target: "standard"`,
// `urlTemplates` covering the Standard-tier surface (Core + subtree),
// no `searchArtifactPath`, no versioned-docs, no `bindings`.
//
// The example's CI invokes the plugin's pipeline programmatically via
// scripts/build.ts (mirrors `packages/docusaurus/conformance.ts`); this
// config file is the canonical source-of-truth shape for downstream
// adopters who use the full Docusaurus CLI.
//
// CJS: Docusaurus's config loader expects either CJS `module.exports` or
// `export default`. Per the team-blueprint constraint "Docusaurus's own
// config may be CJS — use whatever Docusaurus expects".
module.exports = {
  title: 'Tinybox SDK',
  url: 'https://example.com',
  baseUrl: '/',
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },
  presets: [
    [
      'classic',
      {
        docs: { sidebarPath: require.resolve('./sidebars.cjs') },
        blog: false,
        theme: { customCss: require.resolve('./src/css/custom.css') },
      },
    ],
  ],
  plugins: [
    [
      '@act-spec/docusaurus',
      {
        target: 'standard',
        urlTemplates: {
          indexUrl: '/act/index.json',
          nodeUrlTemplate: '/act/n/{id}.json',
          subtreeUrlTemplate: '/act/sub/{id}.json',
        },
        docusaurus: {
          skipBlog: true,
        },
      },
    ],
  ],
};
