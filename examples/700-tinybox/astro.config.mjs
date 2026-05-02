// astro.config.mjs — PRD-700 reference example.
//
// Per PRD-700-R1 / PRD-700-R7 the integration list contains exactly one
// ACT integration (`@act-spec/astro`) configured for the Standard
// conformance level. The site advertises the Core + Standard URL templates;
// Plus-tier capabilities (NDJSON, search) are intentionally absent — PRD-700
// declares Standard.
//
// PRD-700-R7 reproduces the canonical config shape inline. This file matches
// that shape; it adds a `subtreeUrlTemplate` URL template (Standard-tier
// required field per PRD-107-R8). It does NOT enable i18n, custom adapters,
// or any Plus-tier configuration.
//
// Per PRD-700-R8 Astro's `output` setting is `static` (the default).
import { defineConfig } from 'astro/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import act from '@act-spec/astro';
import { createMarkdownAdapter } from '@act-spec/markdown-adapter';

const here = path.dirname(fileURLToPath(import.meta.url));
const contentDir = path.join(here, 'src', 'content', 'docs');

export default defineConfig({
  site: 'https://example.com',
  output: 'static',
  integrations: [
    act({
      // PRD-700-R7 — declared conformance target.
      level: 'standard',
      site: { name: 'Tinybox API' },
      // PRD-700-R7 — Standard-tier URL templates (Core + subtree).
      urlTemplates: {
        indexUrl: '/act/index.json',
        nodeUrlTemplate: '/act/n/{id}.json',
        subtreeUrlTemplate: '/act/sub/{id}.json',
      },
      // PRD-700 implementer note + ADR-004 retro:
      // PRD-700-R4 nominates coarse mode but PRD-201-R23's level-inference
      // rule means coarse mode declares Core. The Astro generator's
      // `enforceTargetLevel` would then refuse the Standard target. We
      // configure the markdown adapter in `fine` mode so the adapter
      // declares Standard and the Standard target is admissible. The
      // PRD-700-R4 ↔ PRD-201-R23 friction is documented in
      // docs/amendments-queue.md (A8) and ADR-004 § "Where the seams are
      // loose."
      adapters: [
        {
          adapter: createMarkdownAdapter(),
          config: {
            sourceDir: contentDir,
            mode: 'fine',
            // The adapter inherits ctx.targetLevel from the generator config.
            // We pin it explicitly here for clarity.
            targetLevel: 'standard',
          },
          actVersion: '0.1',
        },
      ],
    }),
  ],
});
