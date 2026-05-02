# PRD-207 — i18n adapter (next-intl, react-intl, i18next)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

PRD-104 (Accepted) pins the per-locale wire shape — manifest `locales` block, per-node `metadata.locale`, cross-locale references via `related.relation: "translation_of"` and `metadata.translations`, the closed `metadata.translation_status` enum, the no-`null`-on-required-strings contract. PRD-200 (in review) pins the multi-source merge contract — partial nodes from secondary adapters deep-merge with primary-adapter output; `precedence: "fallback"` lets a secondary adapter fill gaps without overriding. The corporate marketing example (PRD-702, depending on PRD-405 + PRD-202 + PRD-207) is the canonical Plus i18n deployment that exercises both.

What's missing is the adapter that bridges three popular JavaScript i18n libraries — `next-intl`, `react-intl`, `i18next` — into ACT's per-locale wire shape. This adapter is structurally different from PRD-201 (markdown) and PRD-202 (Contentful):

1. **It does not discover content.** It reads message catalogs (translation key → translated string maps) keyed by locale. The "content" is the catalog itself, plus translation-status metadata, but no node IDs originate from this adapter.
2. **It composes via PRD-200's multi-source merge.** It declares `precedence: "fallback"` per PRD-200-R15 so a primary content adapter (PRD-201 markdown, PRD-202 Contentful, PRD-208 programmatic) emits the canonical content and PRD-207 contributes translation-status metadata, `metadata.translations` arrays, and per-locale message-catalog payloads keyed against the primary adapter's emitted IDs.
3. **It produces partial nodes.** Per PRD-200-R12 partial nodes deep-merge: PRD-207 emits `{ id, _actPartial: true, metadata: { translations: [...], translation_status: "complete" } }`-shaped partials, never full envelopes.

Until this PRD lands, sites using `next-intl` / `react-intl` / `i18next` for runtime translation cannot expose locale awareness via ACT — their message catalogs sit entirely client-side and ACT's `metadata.locale` / `metadata.translations` would be unpopulated even when the translations exist.

### Goals

1. Lock the **adapter config**: which i18n library; message-catalog file paths; default locale; supported locales; fallback chain.
2. Lock the **message-catalog ingestion** for each library:
   - `next-intl`: per-locale JSON files in `messages/{locale}.json` with namespaced keys.
   - `react-intl`: per-locale JSON files (FormatJS extracted-messages format) with `id` / `defaultMessage` / `description` per entry.
   - `i18next`: per-locale per-namespace JSON files in `locales/{locale}/{namespace}.json`.
3. Lock the **per-locale partial emission**: for each (id, locale) where the primary adapter has emitted a node, PRD-207 contributes a partial node carrying `metadata.locale`, `metadata.translation_status`, and `metadata.fallback_from` (when applicable). PRD-207 does NOT emit base nodes; it only contributes to nodes another adapter has emitted.
4. Lock the **cross-locale `metadata.translations` population**: PRD-207 enumerates the cross-locale ID mapping per node and contributes the dense `[{ locale, id }]` form per PRD-104-R9.
5. Lock the **fallback policy** when a key is untranslated: emit `metadata.translation_status: "fallback"` per PRD-104-R10 / R11; populate `metadata.fallback_from`. The actual content substitution happens during merge with the primary adapter's default-locale partial, NOT inside PRD-207.
6. Lock the **`precedence: "fallback"` declaration** so PRD-207 never overrides a primary adapter's scalar fields per PRD-200-R15.
7. Lock the **failure surface**: missing locale file → recoverable warning per PRD-200-R16; malformed message file → unrecoverable per PRD-200-R18; ID-binding failure (PRD-207 emits a partial whose ID has no primary contributor) → recoverable warning with the partial preserved (the merge step will produce a missing-required-fields error per PRD-200-R12 if no primary ever lands).
8. Specify the **conformance band**: Plus per PRD-107-R10 (i18n is Plus-tier).
9. Enumerate the **test fixture matrix** under `fixtures/207/`.

### Non-goals

1. **Defining the adapter framework contract.** Owned by PRD-200.
2. **Defining the wire format.** Owned by PRD-100 / PRD-102.
3. **Defining the i18n wire shape.** Owned by PRD-104. PRD-207 emits per PRD-104; it does not redefine `metadata.translations` / `translation_status`.
4. **Discovering content.** PRD-207 does NOT walk a content directory. PRD-201 / PRD-202 / PRD-208 own content discovery; PRD-207 enumerates over the locale × ID matrix the framework already knows about.
5. **Translating content.** PRD-207 does NOT translate strings. It surfaces translation status from existing message catalogs that humans (or other tools) have authored.
6. **Defining a runtime translation flow.** PRD-207 is build-time only. Runtime locale negotiation is owned by PRD-106.
7. **Authoring the unified locale-prefixed-IDs / per-locale-manifests choice.** PRD-104 owns Pattern 1 vs Pattern 2; PRD-207 supports both via config but does not redefine.
8. **Bridging non-listed i18n libraries** (`@vue/i18n`, `nuxt-i18n`, `lingui`, etc.). PRD-207 v0.1 covers `next-intl`, `react-intl`, `i18next`. Adding a library is MINOR per PRD-108-R4(1).

### Stakeholders / audience

- **Authors of:** PRD-405 (Next.js plugin) — the canonical pairing for `next-intl`. PRD-401 (Astro), PRD-404 (Docusaurus), PRD-407 (Nuxt) are secondary consumers.
- **Consumers of:** PRD-702 (corporate marketing example) — the canonical end-to-end Plus deployment composing PRD-202 (CMS) + PRD-207 (i18n) + PRD-405 (Next.js).
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `precedence: "fallback"` semantics drift across the merge implementation, causing PRD-207 to occasionally override CMS scalar fields. | Medium | High | PRD-207-R6 explicitly enumerates the field set PRD-207 contributes (`metadata.locale`, `metadata.translations`, `metadata.translation_status`, `metadata.fallback_from`, plus per-key catalog payloads on a reserved sub-object); scalar fields like `title` / `summary` are NOT in PRD-207's contribution surface, so the merge path simply has no opportunity to override them. |
| The three i18n library file formats drift in shape across versions, breaking ingestion. | Medium | Medium | PRD-207-R3 specifies the parser contract per library (FormatJS shape vs flat-key-namespace shape vs per-namespace files) and pins the supported format version. New format versions are recoverable warnings (the adapter falls back to legacy shape detection). |
| Multi-source merge produces a partial-node-only result (no primary adapter ever contributed) for an ID PRD-207 binds to. | Medium | Medium | PRD-207-R10 surfaces a recoverable warning per orphaned partial; PRD-200-R12's missing-required-fields check turns this into an unrecoverable error if the orphan persists post-merge. The warning gives operators a chance to fix configuration before the build fails. |
| Translation-status reporting is wrong because PRD-207 doesn't see the primary adapter's emission and can't tell which keys are actually used. | High | Medium | PRD-207-R7 specifies that translation status is reported at the node level (the file or entry as a whole) using catalog completeness as a proxy, not at the per-key level. Per-key fallback metadata is emitted only when the primary adapter explicitly cooperates by emitting per-key markers (e.g., a markdown file referencing `{t.button.label}`); the v0.1 default is node-level only. Per-key tracking is a v0.2 candidate. |
| Multiple locales' message files for the same locale (e.g., from different libraries running together) collide and produce inconsistent translation status. | Low | Medium | PRD-207-R11 forbids running two PRD-207 instances for the same locale in a single build. Operators composing two i18n libraries are an edge case; the framework's multi-source merge step would surface the collision via PRD-200-R12. |
| Fallback chain configurations (e.g., `de-AT` falls back to `de` falls back to `en-US`) produce inconsistent emitted `fallback_from` values. | Medium | Medium | PRD-207-R8 fixes the rule: `fallback_from` is the FIRST locale in the fallback chain that actually had the key. The chain is configured; the adapter walks it deterministically. |
| BCP-47 locale strings in message catalogs use case forms inconsistent with PRD-104's subset regex (`en_US` vs `en-US`). | Medium | Low | PRD-207-R3 normalizes all incoming locale strings to PRD-104-R2's regex; mismatched forms are auto-corrected with a warning. Underscore separators (e.g., `en_US`) are accepted and normalized to hyphens. Case is auto-corrected (`en-us` → `en-US`). |

### Open questions

1. ~~Should per-key translation tracking be added in v0.1 to handle component-driven sites where individual `<FormattedMessage id=...>` calls map to specific node sub-trees?~~ **Resolved (2026-05-01): No, defer to v0.2.** Per-key tracking requires the primary adapter (PRD-201 / PRD-202 / PRD-300 component contract) to emit translation-key markers, which v0.1's contracts do not. Adding optional metadata fields later is MINOR per PRD-108-R4(1). (Closes Open Question 1.)
2. ~~Should PRD-207 support TOML message catalogs (some `i18next` users prefer TOML over JSON)?~~ **Resolved (2026-05-01): No for v0.1.** JSON is the canonical format across all three supported libraries. Adding TOML is MINOR per PRD-108-R4(1). (Closes Open Question 2.)
3. ~~Should the adapter expose a `fallback_chain` config that overrides the per-locale fallback chain inferred from the i18n library config?~~ **Resolved (2026-05-01): Yes.** PRD-207-R8 specifies the override. Operators sometimes need to deviate from the library's fallback for ACT-specific reasons (e.g., website uses `de` as a fallback but ACT consumers want `en-US` as the canonical fallback for content not yet localized). (Closes Open Question 3.)
4. ~~Should `metadata.translations` enumerate every locale in `locales.available` (per PRD-104-R9 open question 1) or only locales for which the entry has a translation?~~ **Resolved (2026-05-01): Only locales that exist.** PRD-207-R5 implements PRD-104's accepted resolution: dense form lists only locales for which a translation exists. (Closes Open Question 4.)
5. ~~When the i18n library and the primary content adapter disagree on which locales exist, which wins?~~ **Resolved (2026-05-01): The primary content adapter wins.** Message catalogs without corresponding content are a translation-readiness signal that does not surface in ACT. PRD-207-R12 documents this explicitly. (Closes Open Question 5.)

### Acceptance criteria

- [ ] Every normative requirement has an ID `PRD-207-R{n}` and a declared conformance level per PRD-107.
- [ ] The Specification section opens with a table mapping every requirement to PRD-200 / PRD-100 / PRD-102 / PRD-104 requirements implemented.
- [ ] The TypeScript adapter shape is reproduced inline.
- [ ] Per-library ingestion is pinned with a positive fixture for each of `next-intl`, `react-intl`, `i18next`.
- [ ] Partial-node emission shape is pinned with one fixture showing the canonical merge with a primary adapter's full-node emission.
- [ ] `metadata.translations` population is pinned with a fixture covering the dense form across 3+ locales.
- [ ] Fallback policy is pinned with a fixture showing both per-key and per-node fallback emission, plus the `fallback_from` walk down the fallback chain.
- [ ] `precedence: "fallback"` declaration is pinned with a fixture demonstrating that scalar fields the CMS adapter sets are NOT overridden by PRD-207's partial.
- [ ] Failure modes pinned: missing locale file (recoverable), malformed message file (unrecoverable), orphaned partial (warning, escalates to error post-merge).
- [ ] Implementation notes ship 5–7 TS snippets covering: adapter skeleton; per-library catalog parser; partial-node emission; `metadata.translations` population; fallback chain walk; `precedence: "fallback"` declaration in `init`.
- [ ] Test fixture path layout under `fixtures/207/` is enumerated.
- [ ] Versioning & compatibility section classifies every kind of change to PRD-207 per PRD-108.
- [ ] Security section cites PRD-109 and documents adapter-specific deltas (catalog-file path traversal, locale-string normalization, `Accept-Language` non-trust).
- [ ] Changelog entry dated 2026-05-01 by Jeremy Forsythe is present.

---

## Context & dependencies

### Depends on

- **PRD-100** (Accepted) — wire format envelopes.
- **PRD-102** (Accepted) — content blocks; PRD-207 does not introduce new block types.
- **PRD-104** (Accepted) — i18n wire shape. PRD-207 emits per `metadata.locale`, `metadata.translations`, `metadata.translation_status`, `metadata.fallback_from`.
- **PRD-107** (Accepted) — conformance levels.
- **PRD-108** (Accepted) — versioning.
- **PRD-109** (Accepted) — security.
- **PRD-200** (In review) — adapter framework. The default export of `act-i18n` MUST satisfy `Adapter`, declares `precedence: "fallback"`, and emits partial nodes that the framework's merge step deep-merges with primary contributors.
- **000-decisions-needed Q3** — TS-only first-party reference impl.
- External: [next-intl](https://next-intl-docs.vercel.app/), [react-intl / FormatJS](https://formatjs.io/docs/react-intl/), [i18next](https://www.i18next.com/), [BCP 47](https://www.rfc-editor.org/info/bcp47), [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).

### Blocks

- **PRD-405** (Next.js plugin) — the canonical pairing for `next-intl`.
- **PRD-702** (corporate marketing example) — composes PRD-202 + PRD-207 + PRD-405.

### References

- v0.1 draft: §5.12 (Internationalization), §5.12.3 (i18n source adapter informational sketch), §6.4.3 (i18n adapter config informational), §6.5 (corporate marketing example).
- `prd/000-gaps-and-resolutions.md` gaps **B2** (multi-source merging — PRD-207 is THE canonical secondary adapter that exercises this), **A4** (failure modes), **B1** (lifecycle).
- Prior art: [next-intl messages](https://next-intl-docs.vercel.app/docs/usage/messages), [FormatJS extracted messages](https://formatjs.io/docs/getting-started/message-extraction/), [i18next backends](https://www.i18next.com/overview/plugins-and-utils#backends), [Crowdin / Lokalise / Phrase](https://crowdin.com/) (translation management platforms whose JSON exports match the libraries' formats).

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords as clarified by RFC 8174.

### Parent + 100-series requirements implemented

| PRD-207 requirement | Parent / 100-series requirement(s) | Relationship |
|---|---|---|
| R1 (adapter implements PRD-200 contract) | PRD-200-R1, R2 | Default export satisfies `Adapter`. |
| R2 (config schema) | PRD-200-R20 | Adapter publishes JSON Schema. |
| R3 (per-library catalog ingestion) | — | Adapter-internal. |
| R4 (per-locale partial emission) | PRD-200-R5, PRD-200-R12, PRD-104-R5 | Partial nodes deep-merge with primary contributors. |
| R5 (`metadata.translations` population) | PRD-104-R9 | Dense `[{ locale, id }]` form. |
| R6 (`precedence: "fallback"` declaration) | PRD-200-R15 | Scalar fields from primary adapter never overridden. |
| R7 (translation-status emission) | PRD-104-R10, R11, R13 | Closed enum `complete` / `partial` / `fallback` / `missing`; node-level only in v0.1. |
| R8 (fallback chain walk) | PRD-104-R10 | `fallback_from` is the first chain locale that has the key. |
| R9 (recoverable failures) | PRD-200-R16, R17 | Missing locale file → warning. |
| R10 (orphan partial — recoverable) | PRD-200-R12, R16 | Partial without primary contributor → warning at adapter level; merge-step error if persistent. |
| R11 (single instance per locale) | PRD-200-R12 | Two PRD-207 instances for one locale = collision. |
| R12 (locale-set arbitration) | PRD-104-R6 | Primary adapter's locale set wins. |
| R13 (locale-string normalization) | PRD-104-R2 | BCP-47 subset; underscore → hyphen; case auto-correction. |
| R14 (unrecoverable failures) | PRD-200-R18 | Malformed message file, missing required config. |
| R15 (capability declaration) | PRD-200-R22 | `level: "plus"`, `precedence: "fallback"`, `i18n: true`, `manifestCapabilities: {}` (PRD-207 contributes nothing top-level). |
| R16 (level-aware) | PRD-200-R24, PRD-107-R10 | Plus only. |
| R17 (provenance) | PRD-200-R13 | `metadata.source.adapter: "act-i18n"`. |
| R18 (Stage-1 version pinning) | PRD-200-R25, PRD-108-R14 | Pinned to spec `0.1`. |
| R19 (test-fixture conformance) | PRD-200-R28 | Pass framework + PRD-207 fixtures. |
| R20 (no `null` in required fields) | PRD-104-R12 | PRD-207 never emits `null` in required-string fields; fallback substitution is the contract. |

### Conformance level

PRD-207 is **Plus**-only per PRD-107-R10. All requirements apply at Plus; no Core or Standard tier exists for this adapter.

### Normative requirements

#### Adapter shape and config

**PRD-207-R1.** *(Plus)* The default export of the `act-i18n` package MUST satisfy `Adapter` per PRD-200-R1. `name` MUST be `"act-i18n"`. The adapter MUST implement `init`, `enumerate`, `transform`, `dispose`; it MAY implement `precheck` and `delta`.

**PRD-207-R2.** *(Plus)* The config MUST satisfy the schema at `packages/act-i18n/schema/config.schema.json`, which defines at least:

- `library` (string, REQUIRED, enum `"next-intl"` / `"react-intl"` / `"i18next"`) — the source library format.
- `messagesDir` (string, REQUIRED) — the path to the message-catalog root.
- `locales.default` (string, REQUIRED, BCP-47 subset per PRD-104-R2) — the default locale.
- `locales.available` (array of strings, REQUIRED, non-empty, BCP-47 subset) — the supported locales. MUST include `locales.default`.
- `locales.fallback_chain` (object, OPTIONAL) — per-locale fallback chains; `{ "de-AT": ["de", "en-US"] }`. When omitted, the chain is `[locale, locales.default]`.
- `bindToAdapter` (string, REQUIRED) — the name of the primary adapter PRD-207 binds to. PRD-207 emits partials only for IDs that this primary adapter is expected to emit.
- `idTransform` (object, OPTIONAL) — when Pattern 1 is in use AND the primary adapter does NOT prefix locale into IDs, PRD-207 transforms primary-IDs into locale-prefixed IDs per the configured rule. Default: assume the primary adapter is locale-aware (PRD-202's Pattern 1 mode) and bind 1:1.
- `keyMapping` (object, OPTIONAL) — for `react-intl` and `i18next`, an optional map from message-catalog key → ACT node ID, when keys aren't 1:1 with node IDs. The default is identity (key === ID).
- `library_options` (object, OPTIONAL) — library-specific options passed through. For `i18next`: `namespaces` (array of string). For `react-intl`: `messageFormat` (`"flat" | "nested"`, default `"flat"`).

#### Catalog ingestion

**PRD-207-R3.** *(Plus)* The adapter MUST recognize message-catalog formats per the configured `library`:

- **`next-intl`.** Per-locale JSON file at `<messagesDir>/<locale>.json`. The file is a single object whose keys are message IDs (typically dotted namespaces like `"home.hero.headline"`). Values are strings or nested objects. The adapter MUST flatten nested objects to dotted keys before binding.
- **`react-intl`.** Per-locale JSON file at `<messagesDir>/<locale>.json`. The file is either:
  - **Flat shape** (default): `{ "<message-id>": { "defaultMessage": "<text>", "description": "<text>" } }` per the FormatJS extracted-messages format. The translation key is the entry's outer key. The translated string is the entry's `defaultMessage` value (in non-default locales the value reflects the translation, despite the field name).
  - **Nested shape**: `{ "<message-id>": "<translated text>" }` (a simple key-to-string map). Less common but supported.
- **`i18next`.** Per-locale per-namespace JSON file at `<messagesDir>/<locale>/<namespace>.json`. The file is a nested object; the adapter flattens to dotted keys with the namespace as the root segment (e.g., `<namespace>.<key>.<subkey>`).

The adapter MUST treat unreadable files (file not present, permission denied) as recoverable per PRD-207-R9. The adapter MUST treat parse failures (invalid JSON) as unrecoverable per PRD-207-R14.

#### Per-locale partial emission

**PRD-207-R4.** *(Plus)* For each locale L in `locales.available` and each message-catalog entry whose ID corresponds to a node the primary adapter (`bindToAdapter`) is expected to emit, PRD-207 emits one *partial* node:

```ts
{
  id: "<bound-id>",                                   // primary adapter's emitted ID for this (locale, key)
  _actPartial: true,                                     // PRD-200-R5 partial marker
  metadata: {
    locale: "<L>",                                    // PRD-104-R5 (Pattern 1 — when adapter is locale-aware)
                                                      // OR omitted when Pattern 2 (per-locale manifest carries it)
    translation_status: <"complete" | "partial" | "fallback" | "missing">,
    fallback_from: "<source-locale>",                 // present iff translation_status === "fallback"
    translations: [                                   // dense form per PRD-104-R9
      { locale: "<L'>", id: "<id-for-L'>" },
      ...
    ],
    source: { adapter: "act-i18n", source_id: "<L>:<message-key-or-doc-id>" }
  }
}
```

PRD-207 MUST NOT emit any field outside `metadata.*` (no `title`, `summary`, `content`, etc.). The framework merge step (PRD-200-R12) deep-merges this partial with the primary adapter's full-node emission for the same ID; scalar conflicts are decided by `precedence: "fallback"` per PRD-200-R15 (PRD-207 always loses on scalar conflict, but PRD-207 contributes no scalars at the top level, so this is moot in practice).

#### Cross-locale references

**PRD-207-R5.** *(Plus)* PRD-207 MUST populate `metadata.translations` per PRD-104-R9 with one entry per *other* locale in `locales.available` for which the message catalog has a translation. Entries point to the corresponding node IDs in those other locales.

The ID-to-locale binding rule:

- **When the primary adapter is locale-aware (Pattern 1 with locale-prefixed IDs).** PRD-207 inspects the primary adapter's emitted IDs (or, equivalently, applies the same `idTransform` rule the primary adapter uses) and computes the cross-locale ID directly. For PRD-202 Pattern 1, this is `cms/<locale-lower>/<entry-derived-id>` per PRD-202-R12. For PRD-201 with frontmatter `id:` overrides, PRD-207 cannot infer the cross-locale ID without explicit per-key mapping — see `keyMapping` in R2.
- **When the primary adapter is locale-agnostic (Pattern 2).** PRD-207 emits the same `id` across all locales (no transform); `metadata.translations` is omitted because cross-locale references happen at the manifest layer (per-locale manifests reference each other via `manifest_url_template`).

When PRD-207 cannot determine the cross-locale ID for a given (id, locale) pair, it MUST omit that entry from `translations` AND emit a recoverable warning per PRD-207-R9.

#### `precedence: "fallback"` declaration

**PRD-207-R6.** *(Plus)* The adapter MUST declare `precedence: "fallback"` in the `AdapterCapabilities` object returned from `init`, per PRD-200-R15. Practically:

- PRD-207 contributes only `metadata.*` fields per PRD-207-R4. PRD-207 MUST NOT contribute `title`, `summary`, `content`, `etag`, `tokens`, `type`, or any other top-level node field.
- The framework's merge step (PRD-200-R12) deep-merges PRD-207's `metadata.*` contributions with the primary adapter's `metadata.*` contributions. Where the primary adapter sets `metadata.locale: "en-US"` and PRD-207 sets `metadata.locale: "en-US"`, the result is `"en-US"` (no conflict).
- Where the primary adapter sets `metadata.locale: "en-US"` and PRD-207 sets `metadata.locale: "es-ES"` for a partial keyed against the same ID, this is a configuration error (the adapter's `bindToAdapter` and `idTransform` are misconfigured); the framework MUST raise this as a build error per PRD-200-R12 / PRD-200-R15.

#### Translation status

**PRD-207-R7.** *(Plus)* The `metadata.translation_status` field on every PRD-207-emitted partial MUST be set per the following rules:

- **`"complete"`** — the requested locale L has all keys associated with this node in its message catalog. (For `next-intl` / `i18next`, the per-locale file exists and contains every key present in the default-locale file under the relevant namespace. For `react-intl`, every entry's translated value is non-empty.)
- **`"partial"`** — the requested locale L has SOME but not all keys for this node. The partial flag triggers consumers to expect mixed-language content if they walk into this node's content blocks.
- **`"fallback"`** — the requested locale L has NO keys for this node. The partial signals that all content for this node should be sourced from a fallback locale per `metadata.fallback_from`.
- **`"missing"`** — used per PRD-104-R11 only when the producer chooses to emit the node anyway with the missing-marker (rare; the canonical PRD-207 path uses `"fallback"` instead, because PRD-104-R11 forbids `"missing"` blocks with `null` required strings, and PRD-207 emits no required strings to begin with).

**v0.1 scope (gap from open question 1):** translation status is reported at the node level, not per-key. The status is computed against the catalog's coverage of the *namespace* (i18next) or the entire file (next-intl / react-intl). Per-key tracking is deferred to v0.2.

#### Fallback chain

**PRD-207-R8.** *(Plus)* When `metadata.translation_status: "fallback"`, the `metadata.fallback_from` field MUST be set to the first locale in the configured fallback chain (per `locales.fallback_chain`, or the implicit `[locale, locales.default]` when unset) that has a non-empty translation for this node. The walk:

1. Take the per-locale chain `[L, F1, F2, …, locales.default]`.
2. Skip L itself (L has no keys; that's why we're in fallback).
3. For each F in the chain in order, check the message catalog for F.
4. The first F whose catalog has the keys for this node is the `fallback_from` value.
5. If no F in the chain has the keys, the partial is `"missing"` (the rare case per PRD-207-R7 last bullet).

PRD-207 does NOT emit content via fallback — the primary adapter's default-locale emission is the actual content source. PRD-207 only stamps the `fallback_from` field; the merge step then combines PRD-207's metadata with the primary's content.

#### Failure modes

**PRD-207-R9.** *(Plus)* Recoverable failures are mapped per PRD-200-R16 / R17:

| Condition | Status | Behavior |
|---|---|---|
| Locale file missing for a configured locale (e.g., `messages/de-DE.json` not present, but `de-DE` is in `locales.available`) | n/a (file-level) | Emit a build warning; no partials emitted for that locale. PRD-104-R11 then implicitly treats the locale as untranslated for every node when the consumer probes. |
| Specific keys missing from a locale file (e.g., `de-DE.json` exists but lacks the keys for one node) | `"partial"` or `"fallback"` per PRD-207-R7 | Emit partial with the appropriate status; populate `fallback_from` per PRD-207-R8 when status is `"fallback"`. |
| Cross-locale ID computation failure (PRD-207-R5) | Partial emitted with `metadata.translations` truncated | Build warning citing the (id, locale) pair and the ID-derivation failure. |
| Orphaned partial — PRD-207 emitted a partial whose ID has no primary contributor by end of build (PRD-207-R10) | n/a (partial-level) | Build warning at adapter level; PRD-200-R12's missing-required-fields check converts to error if persistent post-merge. |
| Locale-string normalization needed (PRD-207-R13) — input was `en_US`, normalized to `en-US` | n/a | Build warning citing the original and normalized form. |

**PRD-207-R10.** *(Plus)* PRD-207 emits partials only for IDs the primary adapter is expected to emit. When PRD-207 cannot verify in advance whether the primary adapter will emit a given ID (typical: the primary adapter is run after PRD-207 in a streaming pipeline), it emits the partial speculatively and surfaces a recoverable warning when, post-merge, the partial has no primary contributor. The framework's merge step (PRD-200-R12) then surfaces a `merge_incomplete` error if the orphaned partial cannot be elevated to a full node by other contributors.

**PRD-207-R11.** *(Plus)* Two PRD-207 adapter instances MUST NOT be configured for the same locale in a single build. The framework's merge step (PRD-200-R12) surfaces this as a `merge_collision` error when both partials reach the same ID. Operators composing two i18n libraries (rare) MUST run them under distinct locale subsets or distinct `bindToAdapter` targets.

**PRD-207-R12.** *(Plus)* When the primary adapter declares a locale set (e.g., PRD-202's `locale.available`) different from PRD-207's `locales.available`, the primary adapter's locale set wins. PRD-207 MUST emit partials only for the intersection. Locales in PRD-207's set but not the primary's are dropped with a build warning. Locales in the primary's set but not PRD-207's result in `"missing"`-status partials only when PRD-207 has been configured to cover them; otherwise PRD-207 emits no partial and the primary adapter's per-locale emission stands alone (the consumer sees no PRD-207 contribution for those locales).

**PRD-207-R13.** *(Plus)* Locale strings ingested from message-catalog filenames or library config MUST be normalized to the BCP-47 subset of PRD-104-R2:

- Underscore separators (e.g., `en_US`) become hyphens (`en-US`).
- The primary subtag is lowercased (`EN-US` → `en-US`).
- The script subtag (4 letters) is title-cased (`zh-hant` → `zh-Hant`).
- The region subtag (2 letters) is uppercased (`pt-br` → `pt-BR`).

A normalization that changes the input emits a build warning. A locale string that fails to parse to the subset regex even after normalization is unrecoverable per PRD-207-R14.

**PRD-207-R14.** *(Plus)* Unrecoverable failures are mapped per PRD-200-R18:

| Condition | Behavior |
|---|---|
| Config schema validation failure | Throw from `init` (`config_invalid`). |
| Missing required config field (`library`, `messagesDir`, `locales.default`, `locales.available`, `bindToAdapter`) | Throw from `init`. |
| `messagesDir` does not exist or is not a directory | Throw from `init`. |
| Locale string in config or filename fails BCP-47 normalization | Throw from `init` or `enumerate` citing the offending string. |
| Message-catalog file fails JSON parse | Throw from `enumerate` citing file and parse error. |
| `library` value not in the closed enum | Throw from `init` (config schema enforces). |
| Per-locale fallback chain references a locale not in `locales.available` | Throw from `init`. |
| Single-locale build configured (PRD-207 is Plus-only and i18n contributions over a single locale are degenerate) | Throw from `init` citing PRD-107-R10. |

#### Capability declaration and provenance

**PRD-207-R15.** *(Plus)* The `AdapterCapabilities` returned from `init` MUST be:

```ts
{
  level: "plus",
  concurrency_max: 8,
  delta: false,                          // v0.1: i18n catalogs are typically small; full re-parse per build is cheap
  namespace_ids: false,                  // PRD-207 binds to other adapters' IDs and MUST NOT prefix
  precedence: "fallback",                // critical per PRD-200-R15 / PRD-207-R6
  i18n: true,
  summarySource: "author",               // catalog content is authored, even when extracted from source
  manifestCapabilities: {}               // PRD-207 contributes nothing top-level
}
```

`namespace_ids: false` is critical because PRD-207 binds to IDs the primary adapter has already namespaced. Setting `namespace_ids: true` would prefix `act-i18n/` in front of the IDs, breaking the merge.

**PRD-207-R16.** *(Plus)* When `ctx.config.targetLevel` is below `"plus"`, the adapter MUST refuse from `init` per PRD-200-R24. PRD-207 has no Core or Standard mode; i18n is Plus per PRD-107-R10.

**PRD-207-R17.** *(Plus)* Every emitted partial MUST carry `metadata.source` per PRD-200-R13:

```ts
metadata.source = {
  adapter: "act-i18n",
  source_id: `${locale}:${primaryKeyOrId}`
};
```

Where `primaryKeyOrId` is the message-catalog key (for `next-intl` / `i18next`) or the primary adapter's ID (when the catalog does not have a separate key, e.g., a markdown-driven build where each file is one node). The framework's merge step populates `metadata.source.contributors` with both PRD-207's and the primary adapter's `metadata.source` records when merging.

**PRD-207-R18.** *(Plus)* `act-i18n@0.1.x` is pinned to ACT spec `0.1` per PRD-200-R25. The adapter MUST emit partials whose `act_version` (when present — partials don't carry it; only fully-formed nodes do per PRD-100-R1) matches the framework's resolved spec version.

**PRD-207-R19.** *(Plus)* The adapter MUST pass:

1. Applicable PRD-200 framework fixtures under `fixtures/200/` per PRD-200-R28.
2. PRD-207 fixtures enumerated in §"Test fixtures."

**PRD-207-R20.** *(Plus)* PRD-207 MUST NOT emit `null` for any required-string field per PRD-104-R12. Because PRD-207 emits only `metadata.*` partials and never sets required-string fields, this requirement is structurally satisfied — PRD-207 has no opportunity to violate. The requirement is restated for clarity: a future PRD-207 amendment that contributes content fields would need to honor PRD-104-R12.

### Wire format / interface definition

PRD-207 introduces no new JSON wire shapes. The contract is the TypeScript adapter shape and the config schema.

#### Adapter shape (TypeScript)

```ts
import type {
  Adapter, AdapterContext, AdapterCapabilities, EmittedNode,
} from "@act/adapter-framework";

export type I18nLibrary = "next-intl" | "react-intl" | "i18next";

export interface I18nAdapterConfig {
  library: I18nLibrary;
  messagesDir: string;
  locales: {
    default: string;                     // BCP-47 subset
    available: string[];                 // non-empty, includes default
    fallback_chain?: Record<string, string[]>;
  };
  bindToAdapter: string;                 // e.g. "act-contentful" or "act-markdown"
  idTransform?: {
    pattern?: 1 | 2;                     // default 1
    namespace?: string;                  // default = bindToAdapter's namespace
  };
  keyMapping?: Record<string, string>;   // catalog-key → ACT id (when not 1:1)
  library_options?: {
    namespaces?: string[];               // i18next
    messageFormat?: "flat" | "nested";   // react-intl
  };
}

export const i18nAdapter: Adapter<I18nAdapterConfig, I18nItem> = {
  name: "act-i18n",
  async init(config, ctx): Promise<AdapterCapabilities> { /* PRD-207-R3, R6, R12, R13, R14, R15, R16 */ },
  async *enumerate(ctx): AsyncIterable<I18nItem> { /* PRD-207-R3, R7 */ },
  async transform(item, ctx): Promise<EmittedNode | null> { /* PRD-207-R4, R5, R7, R8, R10, R17 */ },
  async dispose(ctx) { /* close any open catalog file handles */ },
};

interface I18nItem {
  locale: string;             // normalized BCP-47
  bindingId: string;          // resolved ACT ID we contribute the partial to
  status: "complete" | "partial" | "fallback" | "missing";
  fallback_from?: string;
  translations: Array<{ locale: string; id: string }>;
  catalogKey: string;         // for source_id stamping
}
```

#### Config schema (JSON Schema, abridged)

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://act-spec.org/schemas/207/config.schema.json",
  "title": "act-i18n adapter config",
  "type": "object",
  "required": ["library", "messagesDir", "locales", "bindToAdapter"],
  "additionalProperties": false,
  "properties": {
    "library": { "type": "string", "enum": ["next-intl", "react-intl", "i18next"] },
    "messagesDir": { "type": "string", "minLength": 1 },
    "locales": {
      "type": "object",
      "required": ["default", "available"],
      "additionalProperties": false,
      "properties": {
        "default": { "type": "string", "pattern": "^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$" },
        "available": {
          "type": "array",
          "minItems": 1,
          "uniqueItems": true,
          "items": { "type": "string", "pattern": "^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$" }
        },
        "fallback_chain": {
          "type": "object",
          "additionalProperties": {
            "type": "array",
            "items": { "type": "string", "pattern": "^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$" }
          }
        }
      }
    },
    "bindToAdapter": { "type": "string", "minLength": 1 },
    "idTransform": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "pattern": { "type": "integer", "enum": [1, 2] },
        "namespace": { "type": "string" }
      }
    },
    "keyMapping": { "type": "object", "additionalProperties": { "type": "string" } },
    "library_options": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "namespaces": { "type": "array", "items": { "type": "string" } },
        "messageFormat": { "type": "string", "enum": ["flat", "nested"] }
      }
    }
  }
}
```

### Errors

| Condition | Adapter behavior | Framework behavior | Exit |
|---|---|---|---|
| Config schema invalid | Throw from `init` (`config_invalid`) | Build error | non-zero |
| `messagesDir` missing or not a directory | Throw from `init` | Build error | non-zero |
| Locale string fails BCP-47 normalization | Throw | Build error | non-zero |
| Catalog file fails JSON parse | Throw from `enumerate` | Build error | non-zero |
| Single-locale build (`available.length === 1`) | Throw from `init` (PRD-207-R14) | Build error | non-zero |
| Locale file missing for a configured locale | Emit warning; no partials for that locale | Build warning | 0 |
| Per-key mismatch within a locale | Emit `"partial"` or `"fallback"` partials | Build warning (informational) | 0 |
| Cross-locale ID computation failure | Truncate `translations`; warn | Build warning | 0 |
| Orphan partial post-merge | (framework merge converts to error) | Build error per PRD-200-R12 | non-zero |
| Two PRD-207 instances for one locale | (framework merge surfaces) | Build error per PRD-200-R12 | non-zero |
| Locale-string normalization changed input | Emit warning citing original / normalized | Build warning | 0 |

---

## Examples

### Example 1 — `next-intl` integration with PRD-202 (Pattern 1 multi-locale)

Project layout:

```text
messages/
  en-US.json
  es-ES.json
  de-DE.json
```

`messages/en-US.json`:

```json
{
  "home.hero.headline": "Build with ACT",
  "home.hero.subhead": "Open agent content tree",
  "pricing.headline": "Simple, transparent pricing"
}
```

`messages/es-ES.json` (FAQ block intentionally untranslated to demonstrate fallback):

```json
{
  "home.hero.headline": "Construye con ACT",
  "home.hero.subhead": "Árbol de contenido abierto para agentes",
  "pricing.headline": "Precios simples y transparentes"
}
```

Config:

```ts
{
  library: "next-intl",
  messagesDir: "./messages",
  locales: { default: "en-US", available: ["en-US", "es-ES", "de-DE"] },
  bindToAdapter: "act-contentful",
  idTransform: { pattern: 1, namespace: "cms" }
}
```

PRD-202 (CMS) emits a node `cms/es-es/landing/pricing` (Pattern 1). PRD-207 emits a partial:

```json
{
  "id": "cms/es-es/landing/pricing",
  "_actPartial": true,
  "metadata": {
    "locale": "es-ES",
    "translation_status": "complete",
    "translations": [
      { "locale": "en-US", "id": "cms/en-us/landing/pricing" },
      { "locale": "de-DE", "id": "cms/de-de/landing/pricing" }
    ],
    "source": { "adapter": "act-i18n", "source_id": "es-ES:cms/landing/pricing" }
  }
}
```

The framework's merge step (PRD-200-R12) deep-merges with PRD-202's full-node emission. The combined node carries CMS-sourced content AND PRD-207's translation metadata. PRD-207 contributed no scalar fields per PRD-207-R6, so the CMS adapter's `title` / `summary` / `content` survive untouched.

Maps to `fixtures/207/positive/next-intl-pattern-1-with-cms.json`.

### Example 2 — `react-intl` extracted-messages format

`messages/en-US.json`:

```json
{
  "home.hero.headline": {
    "defaultMessage": "Build with ACT",
    "description": "Hero headline on the homepage"
  },
  "home.hero.subhead": {
    "defaultMessage": "Open agent content tree",
    "description": "Hero subhead"
  }
}
```

`messages/de-DE.json`:

```json
{
  "home.hero.headline": {
    "defaultMessage": "Mit ACT entwickeln"
  }
}
```

(The German translator hasn't yet localized `home.hero.subhead`.)

PRD-207 emits for the German node bound to the `home` namespace:

```json
{
  "id": "cms/de-de/landing/home",
  "_actPartial": true,
  "metadata": {
    "locale": "de-DE",
    "translation_status": "partial",
    "translations": [
      { "locale": "en-US", "id": "cms/en-us/landing/home" }
    ],
    "source": { "adapter": "act-i18n", "source_id": "de-DE:home" }
  }
}
```

The status is `"partial"` because the German catalog has the headline but not the subhead. Maps to `fixtures/207/positive/react-intl-extracted-partial.json`.

### Example 3 — `i18next` per-namespace files with fallback chain

Project layout:

```text
locales/
  en-US/
    common.json
    home.json
  de-AT/
    common.json
  de/
    common.json
    home.json
```

Config:

```ts
{
  library: "i18next",
  messagesDir: "./locales",
  locales: {
    default: "en-US",
    available: ["en-US", "de", "de-AT"],
    fallback_chain: { "de-AT": ["de", "en-US"] }
  },
  bindToAdapter: "act-markdown",
  library_options: { namespaces: ["common", "home"] }
}
```

For the `home` namespace + locale `de-AT`: the de-AT catalog has no `home.json`. The fallback chain is `[de, en-US]`. The `de/home.json` exists and contains the keys. PRD-207 emits:

```json
{
  "id": "act-markdown/de-at/home",
  "_actPartial": true,
  "metadata": {
    "locale": "de-AT",
    "translation_status": "fallback",
    "fallback_from": "de",
    "translations": [
      { "locale": "en-US", "id": "act-markdown/en-us/home" },
      { "locale": "de", "id": "act-markdown/de/home" }
    ],
    "source": { "adapter": "act-i18n", "source_id": "de-AT:home" }
  }
}
```

Maps to `fixtures/207/positive/i18next-fallback-chain.json`.

### Example 4 — Pattern 2 (per-locale manifests)

Config sets `idTransform.pattern: 2`. PRD-207 emits partials whose IDs match the primary adapter's locale-bare IDs (no locale prefix), and `metadata.locale` is omitted because each per-locale manifest carries its own `site.locale`. Cross-locale references are NOT carried in `metadata.translations` (the manifest layer's `manifest_url_template` does the cross-locale routing). PRD-207 still stamps `metadata.translation_status` and `metadata.fallback_from`. Maps to `fixtures/207/positive/pattern-2-per-locale-manifests.json`.

### Example 5 — Orphan partial (recoverable warning)

PRD-207 is configured to bind to `act-contentful` for locales `[en-US, es-ES]`, but the CMS deletes the `pricing` entry between builds. PRD-207 emits its partial speculatively for `cms/es-es/pricing`; PRD-202 does not. The framework's merge step finds the partial has no primary contributor; PRD-200-R12 surfaces a `merge_incomplete` error citing the missing required fields. PRD-207 surfaced an earlier warning at the adapter level (per PRD-207-R10) hinting that the binding might be stale.

Maps to `fixtures/207/negative/orphan-partial-no-primary.expected.json`.

### Example 6 — `precedence: "fallback"` does not override CMS scalars

The CMS adapter (PRD-202) emits a full node with `title: "Pricing"`. PRD-207 emits a partial that ALSO sets `title: "Pricing-i18n-bug"` (this would be a misconfiguration in PRD-207's user code; the canonical PRD-207 contributes only `metadata.*`). The framework's merge step applies PRD-200-R15's `precedence: "fallback"` rule: PRD-207's `title` is ignored because PRD-202's value is non-null. The resulting node has `title: "Pricing"`.

Maps to `fixtures/207/positive/precedence-fallback-respected.json` (the misconfiguration is repaired by precedence; the build emits a warning per PRD-207's R6 about the cross-field violation but produces correct output).

---

## Test fixtures

Fixtures live under `fixtures/207/`. Per PRD-207-R19, applicable framework fixtures under `fixtures/200/` MUST also pass.

### Positive

- `fixtures/207/positive/next-intl-pattern-1-with-cms.json` → R1, R3 (next-intl), R4, R5, R6, R7, R15, R17. Example 1.
- `fixtures/207/positive/react-intl-extracted-partial.json` → R3 (react-intl), R7 (partial status). Example 2.
- `fixtures/207/positive/i18next-fallback-chain.json` → R3 (i18next), R7 (fallback), R8. Example 3.
- `fixtures/207/positive/pattern-2-per-locale-manifests.json` → R5 (Pattern 2). Example 4.
- `fixtures/207/positive/precedence-fallback-respected.json` → R6. Example 6.
- `fixtures/207/positive/translations-dense-form.json` → R5. Three locales; each partial enumerates the other two in `metadata.translations`.
- `fixtures/207/positive/locale-normalization-warned.json` → R13. Catalog filename `en_us.json` accepted, normalized to `en-US`, warning emitted.
- `fixtures/207/positive/locale-set-arbitration.json` → R12. Primary adapter has locales `[en-US, es-ES]`; PRD-207 has `[en-US, es-ES, ja-JP]`; only intersection bound; `ja-JP` dropped with warning.
- `fixtures/207/positive/missing-locale-file.json` → R9. `messages/de-DE.json` absent; warning emitted; no partials for `de-DE`.
- `fixtures/207/positive/key-mapping-explicit.json` → R2 (`keyMapping`). Catalog key `home.hero` maps to ID `landing/home` per config.
- `fixtures/207/positive/i18next-multi-namespace.json` → R3 (i18next). Three namespaces; partials emitted with namespace-prefixed source_id.
- `fixtures/207/positive/capability-declaration-plus.json` → R15.
- `fixtures/207/positive/provenance-source-id.json` → R17.
- `fixtures/207/positive/skip-non-bound-id.json` → R5. PRD-207's catalog has a key bound to ID `cms/some-id`, but PRD-202 emitted no node with that ID; PRD-207 emits the partial speculatively; merge step fires R10 warning.

### Negative

- `fixtures/207/negative/init-config-invalid.expected.json` → R14. Empty `locales.available`.
- `fixtures/207/negative/init-single-locale.expected.json` → R14. `available: ["en-US"]`. PRD-207 is Plus-only (i18n by definition is multi-locale).
- `fixtures/207/negative/init-target-level-mismatch.expected.json` → R16. Target `"standard"`; adapter throws.
- `fixtures/207/negative/init-messagesdir-missing.expected.json` → R14. `messagesDir` does not exist.
- `fixtures/207/negative/init-locale-not-bcp47.expected.json` → R13, R14. Locale `"x-private"` cannot be normalized.
- `fixtures/207/negative/init-fallback-chain-references-unknown-locale.expected.json` → R14. `fallback_chain.de-AT: ["fr-FR"]` but `fr-FR` not in `available`.
- `fixtures/207/negative/transform-malformed-json.expected.json` → R14. `messages/es-ES.json` contains invalid JSON.
- `fixtures/207/negative/init-default-not-in-available.expected.json` → R2 (schema-level via PRD-104 inheritance). Schema rejects.
- `fixtures/207/negative/orphan-partial-no-primary.expected.json` → R10. Example 5.
- `fixtures/207/negative/two-instances-same-locale.expected.json` → R11. Two PRD-207 instances bound to same locale; framework merge raises collision.

---

## Versioning & compatibility

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a recognized i18n library (`vue-i18n`, `lingui`) | MINOR | PRD-108-R4(1). Adds a value to the `library` enum which is intentionally extensible. (Note: the schema's `enum` keyword admits values; treating it as documented-open per PRD-108-R4(3).) |
| Change which library is the default (no default exists today; this is N/A unless one is added) | MAJOR | PRD-108-R5(7). |
| Add per-key translation tracking | MINOR | PRD-108-R4(1). v0.2 candidate per open question 1. New optional metadata fields. |
| Promote per-key tracking from optional to required | MAJOR | PRD-108-R5(3). |
| Tighten `precedence: "fallback"` to "MUST never set any field outside metadata" | MAJOR | PRD-108-R5(3). The current spec already requires this; tightening would close the rare cross-field-warning case. |
| Add a value to `translation_status` enum | MAJOR | PRD-104-R11 closed enum; cited here. |
| Add an OPTIONAL config field | MINOR | PRD-108-R4(1). |
| Drop a recognized library | MAJOR | PRD-108-R5(1). |
| Loosen orphan-partial handling from "warning" to "silent" | MAJOR | PRD-108-R5(7). |
| Add a fixture row to the conformance corpus | MINOR | PRD-108-R4(2). |

### Forward compatibility

A v0.1 PRD-207 adapter contributes only `metadata.*` per PRD-207-R6. A future PRD-207 that adds new optional `metadata.*` fields (e.g., `metadata.translation_method: "machine" | "human"`) is additive — older consumers ignore unknown fields per PRD-108-R7.

### Backward compatibility

A v0.1 `act-i18n` adapter run against a v0.2 framework is unaffected provided the merge step's partial-deep-merge contract (PRD-200-R12) is preserved and PRD-104's locale shape is unchanged. Stage 2 pinning (PRD-200-R26) opens cross-version support.

---

## Security considerations

Cite PRD-109 (Accepted) for the project-wide threat model. PRD-207-specific deltas:

**Catalog-file path traversal.** PRD-207-R3 reads files under `messagesDir`. The adapter MUST refuse to read files whose resolved absolute path lies outside `messagesDir` (canonicalize with `fs.realpath` and compare against `messagesDir`'s canonicalized prefix). The threat: a content author with write access to a locale-named symlink target outside `messagesDir` could inject arbitrary catalog content. The control: same rule as PRD-201-R8's path-traversal guard, applied to the catalog directory.

**Locale-string normalization as a security control.** PRD-207-R13's normalization closes a class of injection attacks where a malformed locale string in a config or filename could be reflected into emitted IDs (Pattern 1 locale-prefixed IDs include the locale segment). By normalizing to the BCP-47 subset before emission, the adapter ensures the locale segment in any emitted ID conforms to the PRD-100-R10 grammar — there's no path-traversal-via-locale-string surface.

**`Accept-Language` non-trust.** PRD-104's security section already documents this: `Accept-Language` is informational only. PRD-207 reinforces by NOT consulting `Accept-Language` at any point. The locale set is configuration-driven (PRD-207-R2's `locales.available`); the adapter does NOT negotiate locales at runtime.

**Catalog content as untrusted.** Translation strings are author-controlled. PRD-207 does NOT emit them as content blocks (per PRD-207-R6, it contributes only `metadata.*`). The actual translated strings flow through the primary adapter's content blocks, where PRD-201's / PRD-202's content sanitization posture applies. PRD-207's contribution is metadata only, which is a much smaller injection surface — `metadata.fallback_from` is a BCP-47 string (re-validated), `metadata.translations` IDs are re-validated against PRD-100-R10, and `metadata.translation_status` is a closed enum (PRD-104-R11).

**No credential handling.** PRD-207 reads filesystem files and consumes no remote APIs. No tokens, no auth surface. PRD-109's credential-redaction rules apply trivially.

**Partial nodes as a privilege-escalation surface.** PRD-200's security section notes that any adapter contributing to a node grants that adapter "write access" to the node's fields. PRD-207 limits its contribution to `metadata.*` per PRD-207-R6, which constrains the surface area; the framework's merge step (PRD-200-R12) enforces per the merge rule. The `metadata.source.contributors` array (PRD-200-R13) is the audit trail; consumers can verify which fields PRD-207 contributed via `metadata.source.contributors[].adapter === "act-i18n"`.

**Per-tenant scoping interaction with locale-prefixed IDs.** PRD-104 already documents that locale prefixes MUST NOT bypass per-tenant scoping. PRD-207 inherits this verbatim — when binding to a primary adapter that is per-tenant aware (e.g., a runtime-mounted PRD-501 SDK serving per-tenant content), the partials PRD-207 emits MUST be bound only to IDs the requester would be authorized to see. PRD-207 itself is build-time; this concern surfaces at the generator (PRD-400) level when assembling the manifest.

**No DoS surface.** PRD-207 reads N message-catalog files (one per locale, possibly per namespace for i18next). The adapter's resource budget is bounded by the user's locale and namespace counts, which are configuration-controlled. There is no recursion, no unbounded fan-out.

---

## Implementation notes

Snippets show the canonical TypeScript shape; full implementation lives in `packages/act-i18n/`.

### Snippet 1 — Adapter init with capability declaration (PRD-207-R6, R15, R16)

```ts
// packages/act-i18n/src/init.ts

export async function init(
  config: I18nAdapterConfig,
  ctx: AdapterContext,
): Promise<AdapterCapabilities> {
  if (ctx.config.targetLevel !== "plus") {
    throw new AdapterError({
      code: "level_mismatch",
      message: `act-i18n requires targetLevel "plus" (PRD-107-R10 / PRD-207-R16); got "${ctx.config.targetLevel}"`,
    });
  }
  if (config.locales.available.length < 2) {
    throw new AdapterError({
      code: "config_invalid",
      message: "act-i18n requires at least 2 locales in locales.available (PRD-207-R14)",
    });
  }
  const stat = await fs.stat(config.messagesDir).catch(() => null);
  if (!stat?.isDirectory()) {
    throw new AdapterError({ code: "config_invalid", message: `messagesDir '${config.messagesDir}' is not a directory` });
  }

  // Normalize locales (PRD-207-R13)
  config.locales.default = normalizeLocale(config.locales.default, ctx);
  config.locales.available = config.locales.available.map((l) => normalizeLocale(l, ctx));
  for (const [target, chain] of Object.entries(config.locales.fallback_chain ?? {})) {
    config.locales.fallback_chain![normalizeLocale(target, ctx)] = chain.map((l) => normalizeLocale(l, ctx));
    for (const c of chain) {
      if (!config.locales.available.includes(normalizeLocale(c, ctx))) {
        throw new AdapterError({
          code: "config_invalid",
          message: `fallback_chain.${target} references '${c}' not in available`,
        });
      }
    }
  }

  return {
    level: "plus",
    concurrency_max: 8,
    delta: false,
    namespace_ids: false,           // critical: bind to primary adapter's IDs (PRD-207-R15)
    precedence: "fallback",         // critical: never override primary scalars (PRD-207-R6)
    i18n: true,
    summarySource: "author",
    manifestCapabilities: {},
  };
}

function normalizeLocale(s: string, ctx: AdapterContext): string {
  let n = s.replace("_", "-");
  const parts = n.split("-");
  parts[0] = parts[0].toLowerCase();
  if (parts[1]?.length === 4) parts[1] = parts[1][0].toUpperCase() + parts[1].slice(1).toLowerCase();
  if (parts[parts.length - 1].length === 2) parts[parts.length - 1] = parts[parts.length - 1].toUpperCase();
  n = parts.join("-");
  if (n !== s) ctx.logger.warn(`locale '${s}' normalized to '${n}' (PRD-207-R13)`);
  if (!/^[a-z]{2,3}(-[A-Z][a-z]{3})?(-[A-Z]{2})?$/.test(n)) {
    throw new AdapterError({ code: "config_invalid", message: `locale '${s}' fails BCP-47 subset (PRD-104-R2)` });
  }
  return n;
}
```

### Snippet 2 — Per-library catalog loader (PRD-207-R3)

```ts
// packages/act-i18n/src/catalog.ts

export async function loadCatalogs(
  config: I18nAdapterConfig,
  ctx: AdapterContext,
): Promise<Map<string, FlatCatalog>> {
  const out = new Map<string, FlatCatalog>();
  for (const locale of config.locales.available) {
    try {
      switch (config.library) {
        case "next-intl":
          out.set(locale, await loadNextIntl(config.messagesDir, locale));
          break;
        case "react-intl":
          out.set(locale, await loadReactIntl(config.messagesDir, locale, config.library_options?.messageFormat ?? "flat"));
          break;
        case "i18next":
          out.set(locale, await loadI18next(config.messagesDir, locale, config.library_options?.namespaces ?? []));
          break;
      }
    } catch (err) {
      if ((err as { code?: string }).code === "ENOENT") {
        ctx.logger.warn(`catalog file for locale '${locale}' missing (PRD-207-R9)`);
        continue;
      }
      throw new AdapterError({
        code: "catalog_parse",
        message: `failed to parse catalog for locale '${locale}': ${(err as Error).message}`,
      });
    }
  }
  return out;
}

async function loadNextIntl(dir: string, locale: string): Promise<FlatCatalog> {
  const raw = await fs.readFile(path.join(dir, `${locale}.json`), "utf8");
  return flattenObject(JSON.parse(raw));
}

async function loadReactIntl(dir: string, locale: string, format: "flat" | "nested"): Promise<FlatCatalog> {
  const raw = await fs.readFile(path.join(dir, `${locale}.json`), "utf8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const flat: FlatCatalog = new Map();
  for (const [k, v] of Object.entries(parsed)) {
    if (format === "flat" && typeof v === "object" && v && "defaultMessage" in v) {
      flat.set(k, (v as { defaultMessage: string }).defaultMessage);
    } else if (typeof v === "string") {
      flat.set(k, v);
    }
  }
  return flat;
}

async function loadI18next(dir: string, locale: string, namespaces: string[]): Promise<FlatCatalog> {
  const flat: FlatCatalog = new Map();
  for (const ns of namespaces) {
    const raw = await fs.readFile(path.join(dir, locale, `${ns}.json`), "utf8");
    const parsed = JSON.parse(raw);
    for (const [k, v] of flattenObject(parsed)) {
      flat.set(`${ns}.${k}`, v);
    }
  }
  return flat;
}
```

### Snippet 3 — Partial-node emission (PRD-207-R4, R7)

```ts
// packages/act-i18n/src/transform.ts

export async function transform(
  this: I18nAdapter,
  item: I18nItem,
  ctx: AdapterContext,
): Promise<EmittedNode | null> {
  return {
    id: item.bindingId,
    _actPartial: true,
    metadata: {
      ...(this.config.idTransform?.pattern !== 2 ? { locale: item.locale } : {}),
      translation_status: item.status,
      ...(item.fallback_from ? { fallback_from: item.fallback_from } : {}),
      ...(this.config.idTransform?.pattern !== 2 && item.translations.length > 0
        ? { translations: item.translations }
        : {}),
      source: { adapter: "act-i18n", source_id: `${item.locale}:${item.catalogKey}` },
    },
  };
}
```

### Snippet 4 — Fallback chain walk (PRD-207-R8)

```ts
// packages/act-i18n/src/fallback.ts

export function determineStatus(
  locale: string,
  catalogKey: string,
  catalogs: Map<string, FlatCatalog>,
  fallbackChain: string[],     // [locale, F1, F2, …, default]
): { status: "complete" | "partial" | "fallback" | "missing"; fallback_from?: string } {
  if (catalogs.get(locale)?.has(catalogKey)) {
    // Could still be partial if other keys in this node are missing — caller computes node-level status.
    return { status: "complete" };
  }
  for (const f of fallbackChain.slice(1)) {
    if (catalogs.get(f)?.has(catalogKey)) {
      return { status: "fallback", fallback_from: f };
    }
  }
  return { status: "missing" };
}

export function nodeLevelStatus(
  perKeyStatuses: Array<ReturnType<typeof determineStatus>>,
): { status: "complete" | "partial" | "fallback"; fallback_from?: string } {
  const completes = perKeyStatuses.filter((s) => s.status === "complete").length;
  const fallbacks = perKeyStatuses.filter((s) => s.status === "fallback");
  const missings = perKeyStatuses.filter((s) => s.status === "missing").length;

  if (completes === perKeyStatuses.length) return { status: "complete" };
  if (completes > 0) return { status: "partial" };
  if (fallbacks.length > 0) {
    // All keys are fallback → node is fallback. Pick the first fallback_from.
    return { status: "fallback", fallback_from: fallbacks[0].fallback_from };
  }
  // Every key is missing — node is fallback to default if available
  return { status: "fallback", fallback_from: perKeyStatuses[0]?.fallback_from };
}
```

### Snippet 5 — Cross-locale ID resolution (PRD-207-R5)

```ts
// packages/act-i18n/src/cross-locale.ts

export function resolveCrossLocaleId(
  baseLocale: string,
  baseId: string,
  targetLocale: string,
  config: I18nAdapterConfig,
  ctx: AdapterContext,
): string | null {
  if (config.idTransform?.pattern === 2) {
    return baseId;       // Pattern 2: same id across locales (per-locale manifest layer differentiates)
  }

  // Pattern 1: locale-prefixed IDs. Replace the locale segment.
  // Heuristic: if baseId starts with `<namespace>/<locale-lower>/`, swap the locale.
  const ns = config.idTransform?.namespace ?? config.bindToAdapter.replace(/^act-/, "");
  const baseLocLower = baseLocale.toLowerCase();
  const targetLocLower = targetLocale.toLowerCase();
  const prefix = `${ns}/${baseLocLower}/`;
  if (baseId.startsWith(prefix)) {
    return `${ns}/${targetLocLower}/${baseId.slice(prefix.length)}`;
  }

  // Fall back to keyMapping if configured
  const mapped = config.keyMapping?.[`${targetLocale}:${baseId}`];
  if (mapped) return mapped;

  ctx.logger.warn(`cross-locale id resolution failed for ${baseLocale}:${baseId} → ${targetLocale} (PRD-207-R5)`);
  return null;
}
```

### Snippet 6 — Enumerate over (locale × node) matrix (PRD-207-R4, R12)

```ts
// packages/act-i18n/src/enumerate.ts

export async function* enumerate(this: I18nAdapter, ctx: AdapterContext): AsyncIterable<I18nItem> {
  const catalogs = await loadCatalogs(this.config, ctx);
  const nodeKeys = inferNodeKeys(catalogs, this.config);  // catalog keys grouped by node
  const allLocales = this.config.locales.available;

  for (const locale of allLocales) {
    if (ctx.signal.aborted) return;
    for (const { nodeKey, catalogKey } of nodeKeys) {
      const bindingId = computeBindingId(nodeKey, locale, this.config);
      const fallbackChain = this.config.locales.fallback_chain?.[locale] ?? [locale, this.config.locales.default];
      const perKey = determineStatus(locale, catalogKey, catalogs, [locale, ...fallbackChain.filter((c) => c !== locale)]);
      const nodeStatus = nodeLevelStatus([perKey]);

      const translations = allLocales
        .filter((l) => l !== locale)
        .map((l) => ({ locale: l, id: resolveCrossLocaleId(locale, bindingId, l, this.config, ctx) }))
        .filter((t): t is { locale: string; id: string } => t.id !== null);

      yield {
        locale,
        bindingId,
        status: nodeStatus.status,
        fallback_from: nodeStatus.fallback_from,
        translations,
        catalogKey,
      };
    }
  }
}
```

### Snippet 7 — Composing with PRD-202 in a generator config (illustrative)

```ts
// example next-config consumer (informational; the generator owns this orchestration per PRD-400)

import { contentfulAdapter } from "act-contentful";
import { i18nAdapter } from "act-i18n";

export default {
  adapters: [
    {
      adapter: contentfulAdapter,
      config: {
        spaceId: process.env.CF_SPACE_ID!,
        accessToken: { from_env: "CONTENTFUL_DELIVERY_TOKEN" },
        contentTypes: ["landingPage", "blogPost"],
        locale: { available: ["en-US", "es-ES", "de-DE"], default: "en-US", pattern: 1 },
      },
    },
    {
      adapter: i18nAdapter,
      config: {
        library: "next-intl",
        messagesDir: "./messages",
        locales: { default: "en-US", available: ["en-US", "es-ES", "de-DE"] },
        bindToAdapter: "act-contentful",
        idTransform: { pattern: 1, namespace: "cms" },
      },
    },
  ],
  targetLevel: "plus",
};
```

The framework's merge step (PRD-200-R12) deep-merges the two adapters' contributions per node, with PRD-202 as the primary (`precedence: "primary"`) and PRD-207 as the fallback (`precedence: "fallback"`). Each emitted node has CMS-sourced content + i18n-sourced translation metadata.

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft. Pins the `act-i18n` adapter as a Plus-only secondary contributor on top of PRD-200's framework. Locks: config schema (R2) covering `library` (`next-intl` / `react-intl` / `i18next`), `messagesDir`, `locales.{default,available,fallback_chain}`, `bindToAdapter`, `idTransform`, `keyMapping`, `library_options`; per-library catalog ingestion (R3) covering `next-intl` flat-or-nested JSON, `react-intl` FormatJS extracted-messages flat-or-nested, `i18next` per-namespace JSON files; per-locale partial-node emission (R4) shaped strictly as `{ id, _actPartial: true, metadata: {...} }` with NO scalar contributions, deep-merged by the framework with the primary adapter's full-node emission per PRD-200-R12; cross-locale `metadata.translations` dense form per PRD-104-R9 (R5); the critical `precedence: "fallback"` declaration per PRD-200-R15 (R6) — PRD-207 contributes only `metadata.*` so scalar conflict is structurally impossible; node-level translation-status emission (`complete` / `partial` / `fallback` / `missing`) deferring per-key tracking to v0.2 (R7); fallback-chain walk per PRD-104-R10 with `fallback_from` set to the first chain locale that has the keys (R8); recoverable failure mapping covering missing catalog files, per-key gaps, cross-locale ID resolution failures, and orphan partials (R9, R10); single-instance-per-locale rule (R11); locale-set arbitration where the primary adapter's set wins (R12); BCP-47 subset normalization with underscore-to-hyphen and case auto-correction (R13); unrecoverable failure mapping covering config invalid, malformed JSON, single-locale builds, locale strings that fail BCP-47 normalization (R14); the canonical capability declaration with `level: "plus"`, `precedence: "fallback"`, `namespace_ids: false`, `i18n: true`, empty `manifestCapabilities` (R15); level-aware refusal at non-Plus targets (R16); provenance stamping with `act-i18n` adapter and `<locale>:<catalogKey>` source_id (R17); Stage-1 version pinning (R18); test-fixture conformance (R19); the no-`null` invariant per PRD-104-R12 (R20). 14 positive fixtures and 10 negative fixtures enumerated under `fixtures/207/`. Implementation notes ship 7 short TS snippets covering init with locale normalization and capability declaration, per-library catalog loaders, partial-node emission, fallback-chain walk, cross-locale ID resolution, the (locale × node) enumerate matrix, and an illustrative generator-config composition with PRD-202. Cites PRD-200 (in review) for framework + merge contract; PRD-100 / PRD-102 / PRD-104 / PRD-107 / PRD-108 / PRD-109 (Accepted) for envelopes / blocks / i18n shape / level / versioning / security. Status set to `In review`. |
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review; minor normative rename in lockstep with PRD-200. Decisions: (1) per-key translation tracking deferred to v0.2; (2) TOML message catalogs deferred to v0.2 (JSON-only for v0.1); (3) operator-supplied `fallback_chain` override is in scope (PRD-207-R8); (4) `metadata.translations` enumerates only locales that have a translation (per PRD-104-R9 resolution); (5) primary content adapter wins when locale sets disagree. Renamed framework-internal partial-node discriminator from `_partial` to `_actPartial` in lockstep with PRD-200's `_act` namespace reservation. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
