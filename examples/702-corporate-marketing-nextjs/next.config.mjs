// next.config.mjs — PRD-702 reference shape (operator-facing).
//
// This file documents the canonical `withAct` composition for PRD-702.
// The example's actual build runs through `scripts/build.ts` (a
// programmatic invocation of `runPipeline` over the same composition),
// not via `next build`, because the v0.1 reference does not ship a real
// Next.js install — see scripts/build.ts header for the rationale.
//
// PRD-702-R2 — `i18n: { pattern: '2' }` set explicitly per the
// "explicit > implicit for example code" rule. PRD-405-R10's auto-detect
// would land on the same value here (the Pages Router `i18n.locales`
// list has > 1 entry).
//
// PRD-702-R7 — adapters declared in primary-then-fallback order:
//   1. @act-spec/contentful-adapter (precedence: 'primary')
//   2. @act-spec/i18n-adapter      (precedence: 'fallback')
// PRD-202 contributes scalar fields (title, summary, content); PRD-207
// contributes only metadata.* (PRD-207-R6 / R17). The framework's
// mergeContributions dedupes metadata.translations by (locale, id) per
// docs/amendments-queue.md A1 (CLOSED).
//
// PRD-702-R13 — output: 'export' is mandatory; the static-export marker
// is what PRD-405-R5's webpack post-build hook waits for.
import { withAct } from '@act-spec/nextjs-static';
import { createContentfulAdapter, corpusProvider } from '@act-spec/contentful-adapter';
import { createI18nAdapter } from '@act-spec/i18n-adapter';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const corpusJson = JSON.parse(readFileSync(path.join(here, 'corpus', 'contentful-corpus.json'), 'utf8'));

export default withAct(
  {
    output: 'export',
    // PRD-405-R10 — Pages Router locale list; auto-detect resolves to
    // Pattern 2 here, but PRD-702-R2 sets the override explicitly anyway.
    i18n: {
      defaultLocale: 'en-US',
      locales: ['en-US', 'es-ES', 'de-DE', 'ja-JP'],
    },
  },
  {
    conformanceTarget: 'plus',
    manifest: { siteName: 'Acme' },
    urlTemplates: {
      indexUrl: '/act/index.json',
      nodeUrlTemplate: '/act/n/{id}.json',
      subtreeUrlTemplate: '/act/sub/{id}.json',
      indexNdjsonUrl: '/act/index.ndjson',
    },
    i18n: { pattern: '2' },
    adapters: [
      // PRD-702-R7 — Contentful primary; multi-locale corpus per
      // PRD-202-R12 / R14, marketing namespace per PRD-202-R8.
      {
        adapter: createContentfulAdapter({ corpus: corpusJson }),
        config: {
          spaceId: 'acme-marketing',
          environment: 'master',
          accessToken: { from_env: 'CONTENTFUL_DELIVERY_TOKEN' },
          contentTypes: ['landingPage'],
          locale: {
            available: ['en-US', 'es-ES', 'de-DE', 'ja-JP'],
            default: 'en-US',
            pattern: 1,
          },
          idStrategy: { from: 'slug', namespace: 'cms' },
          mappings: {
            landingPage: {
              type: 'landing',
              title: 'title',
              summary: 'subhead',
              body: 'body',
            },
          },
        },
        actVersion: '0.1',
      },
      // PRD-702-R7 — i18n fallback; contributes metadata.* only per
      // PRD-207-R6. Bound to the Contentful adapter via shared namespace.
      {
        adapter: createI18nAdapter(),
        config: {
          library: 'next-intl',
          messagesDir: path.join(here, 'messages'),
          locales: {
            default: 'en-US',
            available: ['en-US', 'es-ES', 'de-DE', 'ja-JP'],
          },
          bindToAdapter: 'act-contentful',
          // PRD-207-R5 — Pattern 1 (locale-prefixed IDs match contentful's).
          idTransform: { pattern: 1, namespace: 'cms' },
        },
        actVersion: '0.1',
      },
    ],
  },
);
