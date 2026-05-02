# PRD-302 — Vue binding

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

PRD-300 (component contract) pins the framework-agnostic shape every binding must implement: the canonical `ActContract` object, the page-level aggregation rule, the variant emission protocol, the `BindingCapabilities` matrix, the placeholder emission contract, and the `contract_version` versioning rule. PRD-300 is silent — by design — on **how** Vue specifically expresses those rules. Vue's idiom differs from React's in several ways that need pinning before a binding ships: declarations live in single-file components (SFCs) where script and template are syntactically separated; the canonical reactivity surface is the Composition API (`<script setup>` + composables) rather than hooks; SSR uses `@vue/server-renderer` with a different lifecycle from React's; route modules in Nuxt expose page metadata via `definePageMeta` and route-level `definePageMeta`-shaped exports rather than React's free-form module exports.

PRD-302 is the Vue-side leaf of PRD-300. It pins three idiomatic declaration patterns (component static field on the SFC's default export, `useActContract` composable, page-level boundary via `<ActSection>` component or `defineActContract` macro), the SSR-walk strategy that is canonical for Vue (using `@vue/server-renderer.renderToString` plus a provided/inject collector), an opt-in static-AST scanner that walks SFCs (script + template), the binding's package surface (`@act/vue`), the version floor (Vue 3 only — Vue 2 explicitly out of scope), and the conformance band per requirement.

The downstream consumer is PRD-407 (Nuxt module): Nuxt is the Vue equivalent of Next.js for the static + runtime profiles, and the Nuxt module dispatches via `@act/vue.extractRoute()`. No other 400-series generator currently depends on this binding directly; the binding is also useful for any Vite-shaped Vue SPA that wants to opt into ACT via a custom generator.

### Goals

1. Pin the **Vue declaration patterns** that desugar to PRD-300's canonical contract: the SFC default-export static-field pattern, the `useActContract()` composable pattern, and the page-level boundary via either `<ActSection>` component or a top-level `defineActContract({...})` macro on the page SFC.
2. Pin the **collector mechanism** for SSR walk: a `provide`/`inject` pair scoped to a Vue app instance the SSR run creates per route, using Vue's `setup()` lifecycle to register contracts at render time.
3. Pin the **SSR-walk extraction strategy** as canonical: `@vue/server-renderer.renderToString` (or `renderToWebStream` for streaming) wrapped in an app-level `provide` of the collector; the binding consumes the collected contracts after render completion.
4. Pin the **static-AST extraction option** (Plus capability): a Vue SFC parser plugin that reads `<script setup>` macros and the `act` default-export static field; only catches statically-resolvable contracts.
5. Pin the **Vue 3 version floor**: Vue 2 (with the Options API as the dominant surface) is explicitly out of scope for v0.1. The binding errors fast on Vue 2 detection.
6. Pin the **binding capability declaration** (`@act/vue/capabilities`): which flags PRD-300-R28 the binding sets `true`, with rationale per flag.
7. Pin the **Nuxt integration surface**: the route-module conventions PRD-407 consumes; specifically how a Nuxt page declares its `act` (via the SFC or via a `definePageMeta`-adjacent helper).
8. Pin the **failure mode emission** for Vue-specific failures (component throws during render, composable called outside an app provider, template lookup misses) — every failure routes to PRD-300-R22's placeholder block.
9. Pin the **conformance band** for the Vue binding: Core when SSR-walk + page-level + component-level patterns are supported; Standard with `related` aggregation and partial-extraction handling; Plus with `marketing:*` blocks, variants, and i18n.

### Non-goals

1. **Defining the canonical contract object.** PRD-300-R2 owns it; PRD-302 only specifies how Vue syntactic forms desugar to it.
2. **Defining the page-level aggregation rule.** PRD-300-R9 owns it; PRD-302 specifies the Vue-side render walk that produces the depth-first ordering PRD-300 mandates.
3. **Defining the variant emission protocol.** PRD-300-R14–R19 own it; PRD-302 specifies how a Vue binding replays renders per variant.
4. **Defining the wire envelope.** PRD-100 / PRD-102 own the envelopes; the binding emits per PRD-300-R20.
5. **Defining the generator pipeline.** PRD-400 owns build-orchestration; PRD-407 owns the Nuxt-side wiring.
6. **Vue 2 support.** Vue 2 reaches its end-of-life window during the v0.1 development cycle. Supporting Vue 2's Options API would require a separate desugarer for `data`/`methods`/`mounted` and is explicitly deferred. See Open questions.
7. **Nuxt 2.** Nuxt 3+ only. Nuxt 2 ships on Vue 2 and is correspondingly out of scope.
8. **Defining a React-flavoured or Angular-flavoured equivalent.** PRD-301 / PRD-303 own those.
9. **JSON Schemas under `schemas/302/`.** PRD-302 emits PRD-100 / PRD-102 envelopes; the binding interface is a TypeScript signature, not a JSON envelope. No new schemas.

### Stakeholders / audience

- **Authors of:** PRD-407 (Nuxt module), and any future custom Vite-Vue generator. PRD-700 / PRD-702 examples may exercise the Vue binding indirectly if a Vue-based example is added in v0.2 (none in v0.1's PRD-700 series).
- **Reviewers required:** Jeremy Forsythe (BDFL).

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The composable `useActContract()` re-runs on every component setup and emits duplicates | High | High | PRD-302-R8 mandates the composable is registration-only; the collector dedupes via a per-component instance key (`getCurrentInstance().uid`). `extract` is invoked once after SSR completes, per PRD-300-R4. |
| SFC static-field detection misses `<script setup>` (no `default export` syntactically) | Medium | Medium | PRD-302-R3 supports both forms: classic `export default defineComponent({...})` with a sibling `Component.act = {...}` assignment, and `<script setup>` via the `defineActContract({...})` compile-time macro. |
| `@vue/server-renderer` produces strings, not a tree the collector can introspect after render | Low | High | PRD-302-R10 clarifies that the collector accumulates contracts inside `setup()` calls during render; the post-render output is discarded and the collected contract list is the canonical input to PRD-300's traversal. |
| Vue's `<Suspense>` boundaries (experimental) yield incomplete trees | Medium | Low | PRD-302-R11 hooks SSR's `serverPrefetch` lifecycle and waits for `Promise.all(serverPrefetchPromises)` to settle before yielding. Per PRD-300-R31. |
| The SFC parser used for static-AST cannot resolve macros across compilation boundaries | Medium | Low | Documented behaviour: static-AST is partial extraction by design (PRD-300-R28); the SSR-walk path is canonical. The binding warns when static-AST mode is selected and macros are unresolvable. |
| Author confuses Nuxt's `definePageMeta` with `defineActContract` | Medium | Low | PRD-302-R5 clarifies the macros are orthogonal: `definePageMeta` is Nuxt's; `defineActContract` is `@act/vue`'s. PRD-407 documents the integration. |
| Generators dispatch on stale capabilities flags after a binding upgrade | Low | Medium | PRD-302-R20 requires the binding to publish capabilities as a `const` and bump the binding's MINOR per PRD-108-R4(5) when adding a flag; generators (PRD-400) re-read on every build. |

### Open questions

1. ~~Should the binding ship Vue 2 support behind a feature flag for organizations that have not migrated?~~ **Resolved (2026-05-01): No.** Vue 2's official EOL was 2024-12-31; the binding ships in 2026 and targets Vue 3 only per PRD-302-R2. Adding Vue 2 support would require a parallel Options-API desugarer (`data`/`methods`/`mounted` lifecycles); the cost is not justified at v0.1. Adding Vue 2 support later is MINOR per the Versioning table. (Closes Open Question 1.)
2. ~~Should the page-level boundary be `<ActSection>` (a runtime wrapper component) or `defineActContract({...})` (a `<script setup>`-time macro)?~~ **Resolved (2026-05-01): Ship both.** The macro is preferred for Nuxt pages because it integrates with `<script setup>` ergonomics; the wrapper is for non-page boundaries (a layout section declaring its own page scope) and for Options-API authors. PRD-302-R5 already pins both forms. (Closes Open Question 2.)
3. ~~Should the binding follow Nuxt's auto-import convention so authors don't need an explicit `import { useActContract } from "@act/vue"`?~~ **Resolved (2026-05-01): Yes, via PRD-407.** The Nuxt module (PRD-407) wires up the auto-import; the `@act/vue` package itself remains import-explicit so it works outside Nuxt (Vite-shaped Vue SPAs, custom generators). The auto-import is a Nuxt-side ergonomic, not a binding-contract concern. (Closes Open Question 3.)

### Acceptance criteria

- [ ] Every requirement carries an ID `PRD-302-R{n}` and a conformance level (Core / Standard / Plus per PRD-107).
- [ ] The Specification section opens with a table of parent (PRD-300) + 100-series requirements implemented (per docs/workflow.md Phase 3 addition).
- [ ] Implementation notes section ships ~3–6 short TS snippets: declaration patterns (SFC + `<script setup>` + composable), the provide/inject collector, the SSR-walk extraction skeleton, the capability declaration, the variant replay loop adapted for Vue.
- [ ] Test fixtures enumerated under `fixtures/302/positive/` and `fixtures/302/negative/`; fixture files NOT created in this PRD.
- [ ] No JSON Schemas under `schemas/302/`.
- [ ] Cites PRD-300, PRD-100, PRD-102, PRD-107, PRD-108, PRD-109. Acknowledges Q3 (TS-only).
- [ ] Open questions ≤ 5; technical questions resolved or queued; strategic questions deferred to `000-decisions-needed.md`.
- [ ] Changelog entry dated 2026-05-01 by Jeremy Forsythe is present.

---

## Context & dependencies

### Depends on

- **PRD-300 (In review):** the parent component contract. PRD-302 implements PRD-300's contract for Vue. Cited per requirement.
- **PRD-100 (Accepted):** wire format. The binding emits node and block envelopes per PRD-100-R10, R21–R23, R28–R31.
- **PRD-102 (Accepted):** content blocks. The binding emits blocks satisfying R1–R11; component-extracted blocks set `metadata.extracted_via: "component-contract"` per PRD-102-R21; placeholders per R22; partial extractions per R23; variants per R29–R32.
- **PRD-107 (Accepted):** conformance bands.
- **PRD-108 (Accepted):** versioning policy. Adding a capability flag is MINOR per R4(5).
- **PRD-109 (Accepted):** security posture. Build-time `extract` runs in the main JS context per PRD-300 §Security.
- **000-decisions-needed.md Q3:** TypeScript-only first-party reference impls. `@act/vue` ships as a TS package per Q3.
- External: [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174). Vue 3 documentation for `@vue/server-renderer` (`renderToString`, `renderToWebStream`), the Composition API (`setup`, `defineComponent`, `getCurrentInstance`, `provide`, `inject`), `<script setup>` and macro syntax, `<Suspense>` and `serverPrefetch` lifecycle. The `@vue/compiler-sfc` parser (informational reference for static-AST scanning).

### Blocks

- **PRD-407** (Nuxt module) — Nuxt 3 routes are Vue components; the generator dispatches via `@act/vue`.

### References

- v0.1 draft: §3.1 (component-driven critique), §5.11.1 (three declaration patterns — generic), §5.11.2 (page-level contracts), §5.11.3 (build-time extraction strategies), §5.11.4 (variant handling), §5.11.5 (Vue and Angular note), §7.3 (SPA-specific pipelines), §8.5 (no-SSR SPA fallback).
- `prd/300-component-contract.md` R1–R32 (the contract this binding implements).
- `prd/102-content-blocks.md` R1–R11 (block taxonomy), R21 (`extracted_via`), R22 (placeholder), R23 (partial extraction), R24 (block ordering), R29–R32 (variant convention).
- `prd/100-wire-format.md` R10 (ID grammar), R21–R23 (node envelope), R25 (`children` cycle prohibition), R28–R31 (block discriminator and consumer tolerance).
- `prd/107-conformance-levels.md` R6 / R8 / R10.
- `prd/108-versioning-policy.md` R4 / R5 / R7.
- Prior art: Vue 3 SSR APIs (`@vue/server-renderer`); the Composition API; Vue's `provide`/`inject`; `<script setup>` macros (`defineProps`, `defineEmits`, `definePageMeta` from Nuxt — informational); Pinia's plugin pattern (informational, for the binding's app-instance scoping).

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) where requirements are imposed. Lowercase "must" and "should" are non-normative prose.

### Parent + 100-series requirements implemented

This binding implements PRD-300's contract for Vue. The table below maps each PRD-302 requirement back to the parent (PRD-300) and 100-series rules it satisfies.

| Parent / 100-series requirement | What it pins | Where PRD-302 enforces |
|---|---|---|
| PRD-300-R2 (canonical contract object) | `{type, id?, summary?, related?, variants?, contract_version, extract}` | PRD-302-R3, R4, R5 (each Vue pattern desugars to this object) |
| PRD-300-R3 (three patterns equivalent) | Field / hook / decorator desugar identically | PRD-302-R6 (the SFC static field, `useActContract` composable, and `defineActContract` macro / `<ActSection>` patterns desugar through the same internal core) |
| PRD-300-R4 (`extract` once per instance/variant) | Composable is registration-only | PRD-302-R8 (the composable stores the contract via `getCurrentInstance().uid`-keyed map; the binding walks once after render) |
| PRD-300-R7 (`extract` is sync) | Sync return only | PRD-302-R9 (binding rejects async extracts; emits placeholder per PRD-300-R22) |
| PRD-300-R9 (depth-first render-order aggregation) | Page-level walk | PRD-302-R10 (SSR walk uses Vue's render order; the `provide`/`inject` collector records contract registration order = depth-first render order in Vue 3 SSR) |
| PRD-300-R15–R19 (variant emission) | Replay per variant | PRD-302-R13 (variant replay loop creates a fresh app per variant key) |
| PRD-300-R20 (envelope satisfaction) | Block discriminator, REQUIRED fields, etc. | PRD-302-R14 (binding validates each block against PRD-100 / PRD-102 before emitting) |
| PRD-300-R21 (`metadata.extracted_via` set automatically) | Binding-owned metadata | PRD-302-R14 (binding stamps every block) |
| PRD-300-R22 (placeholder on failure) | `marketing:placeholder` block + warning | PRD-302-R16 (binding wraps `extract` and Vue render in error boundaries; emits placeholder; warns the generator) |
| PRD-300-R28 (capability declaration) | Static `BindingCapabilities` | PRD-302-R20 (binding exports `capabilities`; values pinned in this PRD) |
| PRD-300-R29 (`metadata.extraction_method`) | SSR-walk / static-ast | PRD-302-R15 (binding stamps each block with the actual method used) |
| PRD-300-R31 (streaming completion) | Wait for prefetch promises | PRD-302-R11 (binding awaits `serverPrefetch` lifecycle promises) |
| PRD-300-R32 (no PII / request-scoped data in `extract`) | Build-time props only | PRD-302-R17 (route props supplied to `extract` come from generator-supplied loaders, not request scope) |
| PRD-100-R10 / R11 (ID grammar / byte cap) | Per-node IDs | PRD-302-R7 (page-level `id` validated before route extract) |
| PRD-100-R21 / R28–R31 (envelope shape, block discriminator) | Output validity | PRD-302-R14 (validation gate before emission) |
| PRD-102-R21 (`metadata.extracted_via`) | Component-extracted marker | PRD-302-R14 (auto-stamped) |
| PRD-102-R22 / R23 (placeholder / partial) | Failure modes | PRD-302-R16 |

### Conformance level

Per PRD-107, requirements in this PRD band as follows.

- **Core:** PRD-302-R1, R2, R3, R5, R6, R7, R8, R9, R10, R14, R16, R20, R22.
- **Standard:** PRD-302-R4, R11, R17, R18, R19, R21, R23.
- **Plus:** PRD-302-R13, R15, R24, R25.

A binding declaring Plus satisfies Standard and Core by additivity (PRD-107-R11).

### Normative requirements

#### Package surface

**PRD-302-R1.** The Vue binding MUST be published as the npm package `@act/vue`. The package MUST export the symbols required by PRD-300-R28's `ActBinding` interface — at minimum: a `name` (the string `"@act/vue"`), a `contractVersion` matching `^[0-9]+\.[0-9]+$`, a `capabilities` const, and an `extractRoute(input)` async function. Conformance: **Core**.

**PRD-302-R2.** The binding's package MUST declare Vue 3.x as a peer dependency. Vue 2.x is out of scope for v0.1; the binding MUST emit a build error if instantiated against Vue < 3.0 detected via the runtime probe `getVueVersion()` (reading `Vue.version` / `app.version`). Nuxt 2 (which ships on Vue 2) is correspondingly out of scope; PRD-407 enforces the Nuxt 3+ floor. Conformance: **Core**.

#### Declaration patterns

**PRD-302-R3.** The binding MUST recognize the **SFC static-field declaration pattern** in two forms:
- **Classic Options API or `defineComponent` form**: a component module's default export carries an `act` static property (or a sibling `Component.act = {...}` assignment) whose value is an `ActContract<P>` per PRD-300-R2. Example: `export default defineComponent({ name: "Hero", props: {...}, render() {...} }); Hero.act = { type: "marketing:hero", contract_version: "0.1", extract: ... };`
- **`<script setup>` macro form**: the SFC's `<script setup>` block uses the compile-time macro `defineActContract({...})` (which `@act/vue/macros` desugars at compile time to the same canonical contract object).

The binding's desugarer MUST treat either form as the canonical declaration source for the component. Conformance: **Core**.

**PRD-302-R4.** The binding MUST recognize the **composable declaration pattern**: a component invokes `useActContract(contract)` from `@act/vue` during its `setup()` phase. The binding's app-level provider MUST capture the contract at setup time and associate it with the component's instance via `getCurrentInstance().uid`. Per PRD-300-R4, the composable is registration-only — `extract` MUST NOT be invoked from inside the composable; the binding invokes `extract` after SSR render completion. Conformance: **Standard**.

**PRD-302-R5.** The binding MUST recognize the **page-level boundary pattern** in either of two forms:
- **`defineActContract({...})` macro on a page SFC**: a `<script setup>`-based page declares `defineActContract({ type: "landing", id: "pricing", contract_version: "0.1", extract: ... })`. The macro is statically resolvable; the generator (PRD-407) reads it at build time.
- **`<ActSection>` wrapper component**: a Vue component that receives a `contract` prop conforming to `PageContract` and renders its slot inside an `ActProvider`-equivalent scope; the wrapper attaches the page contract to the current route. This form is for non-page boundaries (a layout section declaring its own page scope) and for Options-API authors.

The macro form is preferred for pages because it integrates cleanly with Nuxt's `<script setup>`-first conventions. The binding MUST NOT conflate the macro with Nuxt's `definePageMeta` macro: the two are orthogonal; both MAY appear in the same SFC. Conformance: **Core**.

**PRD-302-R6.** All Vue declaration surfaces (SFC static field in either form, composable, page-level macro / wrapper) MUST desugar to the same internal `ActContract<P>` shape per PRD-300-R3 and pass through the same internal traversal. The binding's tests MUST include the equivalence fixtures enumerated in `fixtures/300/positive/` adapted to Vue (under `fixtures/302/positive/`). Output across the surface forms MUST be byte-identical given identical authored inputs. Conformance: **Core**.

#### Page-level extraction

**PRD-302-R7.** When the generator invokes `extractRoute(input)` with a page-level contract whose `id` violates PRD-100-R10 (grammar) or PRD-100-R11 (byte length), the binding MUST surface the violation as a build error per PRD-300-R10 and skip the route. No placeholder applies at page level. The error MUST cite the route's source file and line where the page contract is declared, when known. Conformance: **Core**.

**PRD-302-R8.** During SSR walk, the binding MUST guarantee `extract` for any registered contract runs **at most once per (component instance, variant)** tuple per PRD-300-R4. The implementation MUST use a per-render scratchpad keyed by `getCurrentInstance().uid` (Vue 3's component-instance identifier); the composable MUST NOT invoke `extract` from inside `setup()`. Conformance: **Core**.

**PRD-302-R9.** The binding MUST detect a `Promise`-returning `extract` per PRD-300-R7 and emit a placeholder per PRD-300-R22. The detection MUST use a `then`-method check on the returned value, not solely `instanceof Promise`. Conformance: **Core**.

**PRD-302-R10.** SSR-walk extraction MUST aggregate descendant contracts in **render order, top-to-bottom, depth-first** per PRD-300-R9 / PRD-102-R24. The collector MUST record contract registration in the order Vue 3's SSR render traverses the component tree; this order equals depth-first render order in Vue 3's synchronous SSR pipeline. The binding MUST NOT reorder, deduplicate, or skip blocks based on visual presentation. Conformance: **Core**.

**PRD-302-R11.** When a component uses Vue's `serverPrefetch` lifecycle (or sits inside a `<Suspense>` boundary that resolves async work at SSR time), the binding MUST await all `serverPrefetch` promises before yielding collected contracts to the generator. Per PRD-300-R31, the binding MUST NOT yield partial extractions while async setup is in flight. The `@vue/server-renderer.renderToString()` API resolves only after `serverPrefetch` settles; the binding's wait-for-completion behaviour follows that contract. Conformance: **Standard**.

> **R12 reserved.** PRD-302 deliberately skips R12 to mirror PRD-301-R12 (the RSC server-tree-only walk). Vue 3 has no first-class RSC equivalent in v0.1 (per PRD-302-R20: `rsc: false`); when a Vue RSC-equivalent ships, its requirement will pick up the R12 slot without renumbering downstream rules.

#### Variant handling

**PRD-302-R13.** When a page-level contract declares `variants` other than `"default"`, the binding MUST replay the SSR walk once per declared variant key, supplying `ctx.variant` set to each key per PRD-300-R15. Each replay MUST instantiate a fresh Vue app instance and a fresh provider; the binding MUST NOT reuse the canonical render's collected contracts for variant emission (variants may produce different component trees). The variant matrix MUST be capped at 64 per PRD-300-R17; the binding emits a build error above the cap. Conformance: **Plus**.

#### Extraction guarantees

**PRD-302-R14.** Every block emitted by the Vue binding MUST satisfy PRD-300-R20: PRD-100-R28 (block discriminator), PRD-100-R29 (core block types), PRD-100-R30 (`marketing:*` namespace regex), PRD-102-R1–R11 (per-type schemas). The binding MUST validate each block against these constraints **before** emitting; any violation produces a placeholder per PRD-300-R22 and a build warning. The binding MUST stamp every emitted block with `metadata.extracted_via: "component-contract"` per PRD-300-R21 / PRD-102-R21; an `extract` whose output already carries `metadata.extracted_via` set to a different value is rejected and substituted with a placeholder per PRD-300-R21. Conformance: **Core**.

**PRD-302-R15.** Every block emitted MUST carry `metadata.extraction_method` per PRD-300-R29 reflecting the actual mode used for that pass: `"ssr-walk"` or `"static-ast"`. The Vue binding does not ship a headless-render mode in v0.1 (Vue 3 SSR is the canonical path; SPAs without SSR can still use static-AST). Conformance: **Plus**.

#### Failure modes

**PRD-302-R16.** Every Vue-side failure during extraction — a component throwing during render or `setup()`, an `extract` throwing, an `extract` returning malformed output, an `extract` returning a Promise per PRD-302-R9, the composable called outside an `ActProvider`-equivalent app context, a block failing PRD-100/PRD-102 validation per PRD-302-R14 — MUST produce a `marketing:placeholder` block per PRD-300-R22 with the metadata fields PRD-300-R22 enumerates (`extracted_via`, `extraction_status: "failed"`, `error` truncated to ≤ 200 chars, `component`, `location`). The binding MUST install Vue's `app.config.errorHandler` to capture render and setup errors so render continues past the failed component and descendants can still contribute their contracts. Conformance: **Core**.

#### Security

**PRD-302-R17.** The binding MUST NOT pass request-scoped or user-scoped data into `extract` per PRD-300-R32 / PRD-109. The binding's `extractRoute(input)` reads `routeProps` from the generator's static-data resolver; the binding MUST NOT read from per-request context (Nuxt's `useRequestEvent()`, Vue's app-level globals tied to the request, etc.) inside `extract`. Authors writing `extract` functions MUST treat the props as build-time-only. Conformance: **Standard**.

**PRD-302-R18.** When the binding is invoked under a hypothetical headless-render mode (not shipped in v0.1; reserved for v0.2), network access from the rendered tree MUST be allowlist-gated by the generator. Per PRD-300 §Security and PRD-109. (Reserved for forward-compat; no normative effect in v0.1 because the v0.1 capability declaration sets `headless-render: false`.) Conformance: **Standard**.

**PRD-302-R19.** The binding MUST truncate `metadata.error` to ≤ 200 characters and redact strings matching the secret patterns enumerated in PRD-300-R32 (v0.1 set: `Bearer `, `sk_live_[A-Za-z0-9]+`, `AKIA[A-Z0-9]{16}`, `ghp_[A-Za-z0-9]{36}`, `xoxb-[A-Za-z0-9-]+`) before emitting placeholder blocks. The binding MUST NOT include raw stack traces in `metadata.error`; only the `Error.message` (truncated, redacted) is emitted. The pattern set is owned by PRD-300; the binding inherits any additions. Conformance: **Standard**.

#### Capability declaration

**PRD-302-R20.** The binding MUST publish a static `capabilities: BindingCapabilities` const at its package boundary per PRD-300-R28, with the following values for v0.1 of `@act/vue`:

| Flag | Value | Rationale |
|---|---|---|
| `ssr-walk` | `true` | The canonical mode; `@vue/server-renderer.renderToString` is the workhorse for the SSR walk. |
| `static-ast` | `true` | The SFC parser (`@vue/compiler-sfc`) supports static-AST scanning for `defineActContract({literal})` macros, `useActContract({literal})` calls, and the SFC's default-export `act` static field. |
| `headless-render` | `false` | Not shipped in v0.1. Vue 3 SSR is the canonical path; SPAs without SSR can use static-AST. |
| `rsc` | `false` | Vue 3 has no first-class equivalent of React Server Components in v0.1; reserved for v0.2 review. |
| `streaming` | `true` | The binding supports `@vue/server-renderer.renderToWebStream`; the binding's wait-for-completion behaviour follows `serverPrefetch` settling. |
| `suspense` | `true` | The streaming path waits for `<Suspense>` boundaries to resolve before yielding. |
| `concurrent` | `true` | The binding is safe to invoke concurrently across distinct routes; per-route state uses `AsyncLocalStorage` plus a per-app-instance provider scope. |

The binding MUST set every flag truthfully (PRD-300-R28). Adding a flag is MINOR per PRD-108-R4(5); removing one is MAJOR per PRD-108-R5(5). Conformance: **Core**.

**PRD-302-R21.** The binding MUST publish its `contractVersion` as a string matching PRD-300-R26's `^[0-9]+\.[0-9]+$`. The v0.1 binding MUST publish `contractVersion: "0.1"`. Conformance: **Standard**.

#### Generator integration

**PRD-302-R22.** The binding MUST expose `extractRoute(input: ExtractRouteInput): Promise<NodeDraft[]>` per PRD-300's interface signature. The `module` field of `ExtractRouteInput` is the route's resolved SFC module (the generator's loader produces this); the `routeProps` field is the build-time-resolved props the generator supplies (e.g., from Nuxt's `nuxt.config` or from a content layer); `locale` and `variant` come from the generator per PRD-104 and PRD-300-R15. Conformance: **Core**.

**PRD-302-R23.** The binding's output `NodeDraft[]` MUST satisfy PRD-300's `NodeDraft` shape. The generator (PRD-407) supplies `act_version` and `etag` per PRD-100. The binding MUST NOT supply `act_version` or `etag`; supplying them is a binding-side error and the generator MUST overwrite. Conformance: **Standard**.

#### Static-AST extraction

**PRD-302-R24.** When the generator dispatches under `static-ast` mode, the binding's static scanner MUST recognize: (a) a default-exported component module with a sibling `Component.act = {object literal}` assignment, where the literal is fully resolvable at parse time; (b) a `<script setup>` block invoking `defineActContract({object literal})` with a fully resolvable literal; (c) a `useActContract({object literal})` call inside `setup()` with a fully resolvable literal; (d) for page modules, a `defineActContract({...})` macro at the top level of the SFC's `<script setup>` block. The scanner MUST emit no contract for declarations whose `extract` function references runtime values that the AST cannot resolve. Per PRD-300-R28 the static-AST capability is partial extraction by design. Conformance: **Plus**.

**PRD-302-R25.** Under `static-ast` mode, the binding MUST stamp every emitted block with `metadata.extraction_method: "static-ast"` per PRD-300-R29. The generator's `--mode` flag (per PRD-400) selects between SSR-walk and static-AST; the binding does not auto-fall-back from SSR-walk to static-AST, but MAY emit a build warning when the SSR-walk path produced fewer blocks than the static-AST path would have for the same route. Conformance: **Plus**.

### Wire format / interface definition

PRD-302 is an **interface PRD**, not a wire-format PRD. The wire envelope is the PRD-100 node envelope; the binding's interface satisfies PRD-300's `ActBinding` signature. No JSON Schemas under `schemas/302/`.

#### Vue-specific declaration types

```ts
// @act/vue/src/types.ts
import type { App, Component, ComponentInternalInstance } from "vue";
import type { ActContract, PageContract } from "@act/core";

/** Static-field pattern. The component carries an `act` property typed as ActContract<P>. */
export type VueComponentWithAct<P> = Component & {
  act?: ActContract<P>;
};

/** Composable signature; per PRD-302-R4. */
export function useActContract<P = unknown>(contract: ActContract<P>): void;

/** `<script setup>` macro form; compile-time only. The macro is processed by
 *  `@act/vue/vite-plugin` (or `@vitejs/plugin-vue` consumer) and desugared to
 *  the equivalent runtime registration. */
export declare function defineActContract<P = unknown>(contract: ActContract<P> | PageContract): void;

/** Page-level boundary wrapper component for non-page contexts; per PRD-302-R5. */
export interface ActSectionProps {
  contract: PageContract;
}
export const ActSection: Component;

/** App-level installation. The Nuxt module installs this; standalone Vue users may install manually. */
export function installActProvider(app: App, opts?: { variant?: string }): void;
```

#### The binding export

```ts
// @act/vue/src/binding.ts
import type { ActBinding, BindingCapabilities, ExtractRouteInput, NodeDraft } from "@act/core";

const capabilities: BindingCapabilities = {
  "ssr-walk": true,
  "static-ast": true,
  "headless-render": false,
  rsc: false,
  streaming: true,
  suspense: true,
  concurrent: true,
};

export const vueBinding: ActBinding = {
  name: "@act/vue",
  contractVersion: "0.1",
  capabilities,
  async extractRoute(input: ExtractRouteInput): Promise<NodeDraft[]> {
    // Implementation per PRD-302-R10 / R11 / R13 / R14 / R16. See Implementation notes.
    throw new Error("see Implementation notes");
  },
};
```

### Errors

The binding surfaces errors as build warnings or build errors per PRD-300-R22 and PRD-300's Errors table. The wire envelope (PRD-100 / PRD-102) is unaffected: failures emit placeholder blocks per PRD-102-R22.

| Condition | Binding response | Generator finding |
|---|---|---|
| `extract` throws | Placeholder per R16 + R14 + PRD-300-R22; warn | Build warning; exit non-zero if `--fail-on-extraction-error` |
| Component throws during render or `setup()` | Capture via `app.config.errorHandler`; emit placeholder for that component's contract; continue render | Build warning |
| `extract` returns Promise | Placeholder per R9 + R16 | Build warning |
| `extract` returns block missing REQUIRED fields | Placeholder per R14 | Build warning |
| Block uses `marketing:*` with invalid suffix | Placeholder per R14 | Build warning |
| Composable called outside an installed `ActProvider`-equivalent app | Placeholder per R16 | Build warning |
| Page-level `id` violates PRD-100-R10 / R11 | Skip route per R7; log location | Build error |
| Two page-level contracts share `id` | Build error per PRD-300-R11 | Build error |
| Vue 2 detected | Build error per R2 | Build error |
| Variant matrix > 64 | Build error per R13 + PRD-300-R17 | Build error |
| `metadata.error` > 200 chars or matches secret pattern | Truncate / redact per R19 | Normal (placeholder still emitted) |
| Streaming yields before `serverPrefetch` settles | Binding awaits per R11; never emits incomplete | Normal |
| `contract_version` MAJOR exceeds binding's MAJOR | Build error per PRD-300-R27 | Build error |
| Binding supplies `act_version` or `etag` | Generator overwrites per R23 (binding-side error logged) | Normal |

PRD-300 owns the canonical error contract; the rows above are Vue-specific instantiations.

---

## Examples

Examples are non-normative but consistent with the Specification section.

### Example 1 — Static-field declaration on a Vue SFC

```vue
<!-- design-system/Hero.vue -->
<script lang="ts">
import { defineComponent, type PropType } from "vue";
import type { ActContract } from "@act/core";

interface HeroProps { title: string; subtitle: string; ctaText?: string; ctaUrl?: string; }

const Hero = defineComponent({
  name: "Hero",
  props: {
    title:    { type: String as PropType<string>, required: true },
    subtitle: { type: String as PropType<string>, required: true },
    ctaText:  { type: String as PropType<string>, required: false },
    ctaUrl:   { type: String as PropType<string>, required: false },
  },
  setup(props) { return () => /* render */ null; },
});

(Hero as VueComponentWithAct<HeroProps>).act = {
  type: "marketing:hero",
  contract_version: "0.1",
  extract: (props) => ({
    type: "marketing:hero",
    headline: props.title,
    subhead: props.subtitle,
    cta: props.ctaText ? { label: props.ctaText, href: props.ctaUrl ?? "#" } : undefined,
  }),
} satisfies ActContract<HeroProps>;

export default Hero;
</script>
```

The `@act/vue` desugarer (per PRD-302-R3) lifts `Hero.act` to PRD-300-R2's canonical shape.

### Example 2 — `<script setup>` macro form

```vue
<!-- design-system/PricingTable.vue -->
<script setup lang="ts">
import { defineActContract } from "@act/vue/macros";

interface Tier { name: string; price: string; features: string[]; }
const props = defineProps<{ tiers: Tier[] }>();

defineActContract({
  type: "marketing:pricing-table",
  contract_version: "0.1",
  extract: (_p) => ({
    type: "marketing:pricing-table",
    tiers: props.tiers.map(t => ({ name: t.name, price: t.price, features: t.features })),
  }),
});
</script>

<template>
  <div class="pricing"><!-- ... --></div>
</template>
```

The `@act/vue/macros` compile-time macro (processed by the binding's Vite plugin) desugars `defineActContract({...})` to the equivalent runtime registration. Per PRD-302-R3, R6.

### Example 3 — Page-level boundary on a Nuxt page

```vue
<!-- pages/pricing.vue -->
<script setup lang="ts">
import { defineActContract } from "@act/vue/macros";

defineActContract({
  type: "landing",
  id: "pricing",
  contract_version: "0.1",
  summary: "Acme pricing tiers and plan comparison.",
  related: [
    { id: "products", relation: "see-also" },
    { id: "contact",  relation: "see-also" },
  ],
  extract: () => ({ type: "landing" }),
});

definePageMeta({ layout: "marketing" }); // Nuxt's macro; orthogonal to defineActContract per R5.
</script>

<template>
  <Hero title="Pricing" subtitle="Plans that scale with you" cta-text="Start free" cta-url="/signup" />
  <PricingTable :tiers="tiers" />
  <FAQAccordion :items="faqs" />
</template>
```

PRD-407 (Nuxt module) reads the macro at build time, calls `vueBinding.extractRoute({ routeId: "pricing", module: pageModule, routeProps: {}, locale: undefined, variant: undefined })`, and the binding aggregates Hero / PricingTable / FAQAccordion per PRD-302-R10.

### Example 4 — Composable form (composition-API component without `<script setup>`)

```ts
// composables/useFAQContract.ts
import { defineComponent } from "vue";
import { useActContract } from "@act/vue";

export default defineComponent({
  name: "FAQAccordion",
  props: { items: { type: Array, required: true } },
  setup(props) {
    useActContract({
      type: "marketing:faq",
      contract_version: "0.1",
      extract: () => ({
        type: "marketing:faq",
        items: (props.items as Array<{ q: string; a: string }>).map(i => ({ question: i.q, answer: i.a })),
      }),
    });
    return () => /* render */ null;
  },
});
```

Per PRD-302-R4 + R8, the composable registers the contract; `extract` runs once after the SSR walk completes.

### Example 5 — Variant emission (locale source)

```vue
<script setup lang="ts">
defineActContract({
  type: "landing",
  id: "pricing",
  contract_version: "0.1",
  variants: ["fr-FR", "de-DE"],
  summary: "Acme pricing tiers and plan comparison.",
  extract: () => ({ type: "landing" }),
});
</script>
```

Per PRD-302-R13, the binding renders the route three times — canonical and per locale — emitting:
- `pricing` (canonical, per PRD-102-R30).
- `pricing@fr-FR` with `metadata.variant: { base_id: "pricing", key: "fr-FR", source: "locale" }`.
- `pricing@de-DE` with the same shape.

Each variant carries `related: [{ id: "pricing", relation: "variant_of" }]` per PRD-102-R32. The `source: "locale"` value is per PRD-102-R31 / PRD-300-R18 (integrates with PRD-104 i18n).

### Example 6 — Failure mode (component throws in `setup()`)

If `<Hero>` throws during `setup()` (e.g., a CMS prop is missing), the binding's `app.config.errorHandler` catches it and emits:

```json
{
  "type": "marketing:placeholder",
  "metadata": {
    "extracted_via": "component-contract",
    "extraction_method": "ssr-walk",
    "extraction_status": "failed",
    "error": "Cannot read properties of undefined (reading 'title')",
    "component": "Hero",
    "location": "design-system/Hero.vue:14"
  }
}
```

per PRD-302-R16 + PRD-300-R22 + PRD-302-R19. The render continues past the failed component so PricingTable and FAQAccordion can still contribute.

---

## Test fixtures

Fixtures live under `fixtures/302/` and are exercised by `@act/vue`'s test suite plus PRD-600 (validator) for emitted output. Fixture files are NOT created in this PRD; the layout below is the surface.

### Positive

- `fixtures/302/positive/component-static-field.json` → satisfies R3, R6 (static field on default export desugars correctly).
- `fixtures/302/positive/component-script-setup-macro.json` → satisfies R3, R6 (`defineActContract({...})` desugars correctly).
- `fixtures/302/positive/component-composable.json` → satisfies R4, R6, R8 (composable registers; extract runs once).
- `fixtures/302/positive/page-boundary-macro-form.json` → satisfies R5, R6 (`defineActContract` on page SFC).
- `fixtures/302/positive/page-boundary-wrapper-form.json` → satisfies R5, R6 (`<ActSection>` wrapper).
- `fixtures/302/positive/ssr-walk-aggregates-children.json` → satisfies R10 (depth-first render-order aggregation).
- `fixtures/302/positive/serverprefetch-completion.json` → satisfies R11 (binding awaits prefetch promises).
- `fixtures/302/positive/variant-replay.json` → satisfies R13 (canonical + each variant emitted; source: "locale" example).
- `fixtures/302/positive/extracted-via-stamped.json` → satisfies R14 (`metadata.extracted_via: "component-contract"`).
- `fixtures/302/positive/extraction-method-ssr-walk.json` → satisfies R15 (`metadata.extraction_method: "ssr-walk"`).
- `fixtures/302/positive/extraction-method-static-ast.json` → satisfies R15, R24, R25 (static-AST stamps method correctly).
- `fixtures/302/positive/capability-declaration.json` → satisfies R20 (full capabilities const).
- `fixtures/302/positive/contract-version-published.json` → satisfies R21.
- `fixtures/302/positive/extract-route-output-shape.json` → satisfies R22, R23.
- `fixtures/302/positive/define-page-meta-orthogonal.json` → satisfies R5 (Nuxt's `definePageMeta` and `defineActContract` coexist without interference).

### Negative

- `fixtures/302/negative/vue-2-detected.json` → MUST cause a build error per R2.
- `fixtures/302/negative/extract-throws.json` → expected output is a placeholder per R16 + PRD-300-R22.
- `fixtures/302/negative/component-throws-setup.json` → expected output is a placeholder for that component; descendants still contribute per R16.
- `fixtures/302/negative/extract-returns-promise.json` → expected output is a placeholder per R9 + R16.
- `fixtures/302/negative/extract-emits-malformed-block.json` → expected output is a placeholder per R14.
- `fixtures/302/negative/composable-outside-app-provider.json` → expected output is a placeholder per R16.
- `fixtures/302/negative/page-id-violates-grammar.json` → MUST cause a build error per R7 + PRD-100-R10.
- `fixtures/302/negative/page-id-collision.json` → MUST cause a build error per PRD-300-R11.
- `fixtures/302/negative/variant-matrix-exceeds-64.json` → MUST cause a build error per R13 + PRD-300-R17.
- `fixtures/302/negative/binding-supplies-act-version.json` → MUST cause the generator to overwrite per R23.
- `fixtures/302/negative/extracted-via-overridden-by-author.json` → expected output is a placeholder per R14 / PRD-300-R21.
- `fixtures/302/negative/error-message-with-secret.json` → expected output has `metadata.error` redacted per R19 / PRD-300-R32.
- `fixtures/302/negative/streaming-yields-before-prefetch.json` → MUST be rejected; binding under test fails the test if it yields early per R11.
- `fixtures/302/negative/macro-mistaken-for-define-page-meta.json` → MUST surface an explanatory error if the author writes `definePageMeta({ id: ... })` instead of `defineActContract({ id: ... })` per R5 (the binding hints at the correct macro).

---

## Versioning & compatibility

Per PRD-108, classify each kind of change to PRD-302 as MAJOR or MINOR. The binding's package version follows MAJOR-pinned / MINOR-floating against PRD-300's `contract_version`.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a new declaration pattern (e.g., a class-decorator form) | MINOR | Per PRD-108-R4(1). |
| Add a new option to the composable signature (e.g., `useActContract(contract, { skip: bool })`) | MINOR | Per PRD-108-R4(1). |
| Add a capability flag to `capabilities` (e.g., `web-components: true`, or `rsc: true` once Vue ships an RSC equivalent) | MINOR | Per PRD-300-R28 + PRD-108-R4(5). |
| Add Vue 2 support behind a feature flag | MINOR | Additive; existing Vue 3 users unaffected. (Currently parked in Open questions.) |
| Drop Vue 3 support in favor of Vue 4+ | MAJOR | Existing Vue 3 consumers break per PRD-108-R5(3). |
| Change the package name `@act/vue` | MAJOR | Per PRD-108-R5(1). |
| Change a capability flag's default value (e.g., flip `headless-render` default to `true`) | MAJOR | Existing generator dispatch logic depends on the flag. Per PRD-108-R5(2). |
| Tighten the static-AST scanner's accepted SFC patterns | MAJOR | Existing SFCs break; per PRD-108-R5(6). |
| Add a recognized SFC pattern to the static-AST scanner | MINOR | Additive. |
| Change the macro name from `defineActContract` to `defineActMeta` | MAJOR | Per PRD-108-R5(1). |
| Editorial / prose clarification with no normative effect | n/a | Per 000-governance R18. |

### Forward compatibility

Per PRD-108-R7, the binding tolerates unknown optional fields on contract objects authored against newer contract MINORs and unknown capability flags. A binding implementing contract `0.1` that receives a contract authored against `0.2` with a new optional `priority` field MUST tolerate the field per PRD-300-R27.

### Backward compatibility

Within a v0.1.x line:
- A v0.1 `@act/vue` binding's emitted `NodeDraft[]` is consumable by a v0.1 generator (PRD-407).
- A v0.2 binding emitting v0.2 contract output remains consumable by a v0.1 generator as long as the generator tolerates unknown optional fields per PRD-108-R7.
- A v0.1 binding consuming a contract authored against v0.2 (declaring `contract_version: "0.2"`) MUST tolerate per PRD-108-R7.

Across MAJOR boundaries (v0.x → v1.0), no backward compatibility is required.

---

## Security considerations

This section documents the security posture deltas PRD-302 introduces over PRD-300 and PRD-109.

**Build-time `extract` runs in the main JS context (PRD-300 §Security, gap D3).** The Vue binding does not sandbox `extract`. A malicious component contract can exfiltrate environment variables, read filesystem paths, or hang the build. Producers SHOULD review `extract` functions in their codebase the same way they review any other build-time code.

**`metadata.error` truncation and secret redaction (PRD-302-R19).** Per PRD-300-R22 / PRD-300-R32 the binding truncates error messages to ≤200 characters and redacts strings matching the v0.1 secret-pattern set (`Bearer `, `sk_live_[A-Za-z0-9]+`, `AKIA[A-Z0-9]{16}`, `ghp_[A-Za-z0-9]{36}`, `xoxb-[A-Za-z0-9-]+`). The binding MUST NOT include raw stack traces in `metadata.error`; only the `Error.message` (truncated, redacted).

**`extract` MUST NOT receive request-scoped or user-scoped data (PRD-302-R17).** The contract surface is build-time-shaped per PRD-300-R8. The binding's `extractRoute(input)` reads `routeProps` from the generator's static-data resolver; the binding MUST NOT read from per-request context (Nuxt's `useRequestEvent()` / `useRequestHeaders()`, Vue app-level globals tied to a request) inside `extract`. Authors writing `extract` functions MUST treat the props as build-time-only and MUST NOT call request-scoped helpers from inside `extract`. Cross-cuts PRD-109-R11 (per-tenant ID stability) and PRD-109-R14 (no PII in error messages).

**Macro processing is a build-time code path.** The `defineActContract({...})` macro is processed by the binding's Vite plugin at compile time. The plugin reads SFC source; it MUST NOT execute arbitrary code from the SFC at compile time. Specifically, the plugin reads the literal AST of the macro's argument; runtime-only values (closures, dynamic imports) are not evaluated at macro-processing time. The macro's `extract` function is captured as a closure and runs at SSR / build time per the standard PRD-300 rules.

**Capability declaration is a producer claim (PRD-300-R28).** The binding publishes capabilities; the generator trusts them. PRD-302 inherits this trust model.

**Variant correlation (PRD-300 §Security).** A producer that emits both the canonical and a variant node tied to a specific identity leaks the identity-to-variant mapping if both nodes are observable in the same index. PRD-300-R16's opt-in default mitigates accidental emission. Producers serving runtime ACT MUST NOT emit personalization variants in the public-tenant index unless the variant is itself public.

PRD-109 owns the project-wide posture; the rules above are Vue-specific deltas, not duplications.

---

## Implementation notes

This section illustrates the canonical implementation shapes a Vue binding follows. Snippets are TypeScript per Q3.

### 1. Declaration patterns desugared through `@act/core`

```ts
// @act/vue/src/desugar.ts
import type { Component, ComponentInternalInstance } from "vue";
import type { ActContract } from "@act/core";
import { fromStaticField, registerHookContract } from "@act/core/desugar";

/** Pattern 1 — SFC static field. */
export function pickStaticContract<P>(
  comp: Component & { act?: ActContract<P> },
): ActContract<P> | undefined {
  return fromStaticField(comp);
}

/** Pattern 2 — composable. */
export function useActContract<P = unknown>(contract: ActContract<P>): void {
  const inst = getCurrentInstance();
  if (!inst) throw new ComposableOutsideSetupError();           // → placeholder per R16
  registerHookContract(Symbol.for(`act:${inst.uid}`), contract as ActContract<unknown>);
}

/** Pattern 3 — `<script setup>` macro (compile-time desugaring). */
//   The `@act/vue/macros` compile-time plugin rewrites `defineActContract({lit})`
//   into `useActContract({lit})` at build time so the runtime is identical.
```

### 2. The provide/inject collector for SSR walk

```ts
// @act/vue/src/provider.ts
import type { App, InjectionKey } from "vue";
import type { ActContract, PageContract } from "@act/core";

interface CollectorState {
  pageContract?: PageContract;
  variant?: string;
  collected: Array<{ instanceUid: number; contract: ActContract<unknown> }>;
}

export const COLLECTOR_KEY: InjectionKey<CollectorState> = Symbol.for("@act/vue/collector");

export function installActProvider(app: App, opts: { pageContract?: PageContract; variant?: string } = {}) {
  const state: CollectorState = {
    pageContract: opts.pageContract,
    variant: opts.variant,
    collected: [],
  };
  app.provide(COLLECTOR_KEY, state);

  // Capture render / setup errors as placeholders (PRD-302-R16).
  app.config.errorHandler = (err, instance, info) => recordError(state, err, instance, info);
  return state;
}
```

### 3. The SSR-walk extraction skeleton (PRD-302-R10 / R11)

```ts
// @act/vue/src/extract.ts
import { createSSRApp } from "vue";
import { renderToString } from "@vue/server-renderer";
import type { ExtractRouteInput, NodeDraft, ExtractionContext } from "@act/core";
import { aggregatePage } from "@act/core/traverse";
import { installActProvider, COLLECTOR_KEY } from "./provider";

export async function extractRoute(input: ExtractRouteInput): Promise<NodeDraft[]> {
  const { module, routeProps, locale, variant } = input;
  const pageContract = readPageContract(module);   // PRD-302-R5
  validatePageId(pageContract);                     // PRD-302-R7

  const variants = pageContract.variants ?? "default";
  const drafts: NodeDraft[] = [];

  drafts.push(await renderOneVariant(module, pageContract, routeProps, locale, undefined));
  if (variants === "default") return drafts;

  const keys = variants === "all" ? discoverAllVariants(pageContract) : variants;
  if (keys.length > 64) {
    throw new BuildError(`variant matrix ${keys.length} exceeds cap (PRD-300-R17)`);
  }
  for (const key of keys) {
    drafts.push(await renderOneVariant(module, pageContract, routeProps, locale, key));
  }
  return drafts;
}

async function renderOneVariant(
  module: any, pageContract: PageContract, routeProps: unknown,
  locale: string | undefined, variant: string | undefined,
): Promise<NodeDraft> {
  const app = createSSRApp(module.default, routeProps as Record<string, unknown>);
  const collector = installActProvider(app, { pageContract, variant });

  // renderToString awaits all serverPrefetch promises (PRD-302-R11).
  await renderToString(app);

  const ctx: ExtractionContext = {
    locale, variant, parentId: pageContract.id, binding: "@act/vue", warn,
  };

  const draft = aggregatePage({
    rootContract: pageContract,
    rootProps: routeProps,
    ctx,
    walkChildren: () => collector.collected.map(({ contract }) => ({ contract, props: undefined })),
  });

  if (variant) {
    draft.id = `${pageContract.id}@${variant}`;
    draft.metadata = {
      ...draft.metadata,
      variant: { base_id: pageContract.id, key: variant, source: inferSource(pageContract, variant) },
    };
    draft.related = [...(draft.related ?? []), { id: pageContract.id, relation: "variant_of" }];
  }
  return draft;
}
```

### 4. The capability declaration (PRD-302-R20)

```ts
// @act/vue/src/capabilities.ts
import type { BindingCapabilities } from "@act/core";

export const capabilities: BindingCapabilities = {
  "ssr-walk": true,
  "static-ast": true,
  "headless-render": false,
  rsc: false,
  streaming: true,
  suspense: true,
  concurrent: true,
};
```

### 5. The `<script setup>` macro plugin (PRD-302-R3, R5)

```ts
// @act/vue/macros/vite-plugin.ts
import type { Plugin } from "vite";

export function actVueMacros(): Plugin {
  return {
    name: "@act/vue/macros",
    enforce: "pre",
    transform(code, id) {
      if (!id.endsWith(".vue")) return;
      // Parse `<script setup>` block; rewrite `defineActContract({...})` calls to
      // `useActContract({...})` so the runtime is identical to Pattern 2 (composable).
      // `defineActContract` itself is a TS-only declaration; the macro is compiled away.
      return rewriteDefineActContractCalls(code);
    },
  };
}
```

### 6. Static-AST scanner (PRD-302-R24 / R25)

```ts
// @act/vue/static-ast/src/scanner.ts
import { parse } from "@vue/compiler-sfc";

export function scanSfc(source: string, file: string): NodeDraft[] {
  const { descriptor } = parse(source, { filename: file });
  const drafts: NodeDraft[] = [];

  // <script setup> macro form: defineActContract({ object literal })
  if (descriptor.scriptSetup) {
    drafts.push(...findDefineActContractMacroCalls(descriptor.scriptSetup, file));
    drafts.push(...findUseActContractCalls(descriptor.scriptSetup, file));
  }
  // <script> form: default export with `.act = { object literal }` sibling assignment.
  if (descriptor.script) {
    drafts.push(...findDefaultExportActAssignments(descriptor.script, file));
  }
  return drafts.map(d => stampStaticAstMethod(d));   // PRD-302-R25
}
```

These snippets are illustrative; full implementation lives in `packages/vue/`. The shared `@act/core` package houses the framework-agnostic helpers PRD-300 specifies.

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft. Pins the Vue binding's three idiomatic declaration patterns (SFC default-export static field; `<script setup>` `defineActContract` macro form; `useActContract` composable; page-level boundary via macro or `<ActSection>` wrapper), the `provide`/`inject`-based collector for SSR walk, the canonical SSR-walk extraction strategy via `@vue/server-renderer.renderToString` (with `serverPrefetch` completion guarantee per PRD-300-R31), the static-AST extraction option (`@vue/compiler-sfc`-driven scanner) marked `metadata.extraction_method: "static-ast"`, the variant replay loop, the placeholder emission contract (truncated and secret-redacted error messages, captured via `app.config.errorHandler`), the package surface (`@act/vue`), the Vue 3-only floor (Vue 2 explicitly out of scope), the `BindingCapabilities` const with values pinned per flag (rsc: false in v0.1), and the generator integration via `extractRoute(input): Promise<NodeDraft[]>` consumed by PRD-407 (Nuxt module). Cites PRD-300 R1–R32, PRD-100 R10/R21–R31, PRD-102 R1–R11/R21–R32, PRD-107 R6/R8/R10, PRD-108 R4/R5/R7, PRD-109 (PII posture). Status: In review. |
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review. Decisions: (1) Vue 2 stays out of scope for v0.1 — adding it later is MINOR; (2) page-level boundary supports both `defineActContract` macro (preferred for Nuxt pages) and `<ActSection>` wrapper (for non-page / Options-API contexts); (3) Nuxt auto-import for `useActContract` lives in PRD-407, not in `@act/vue` itself. Added a one-line note at the R11→R13 jump documenting that R12 is reserved for a future Vue RSC-equivalent (mirrors PRD-301-R12). PRD-302-R19 secret-pattern set updated to track PRD-300-R32's broadened v0.1 set (adds `ghp_…` GitHub PAT and `xoxb-…` Slack bot token). |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
