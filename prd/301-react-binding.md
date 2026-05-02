# PRD-301 — React binding

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

PRD-300 (component contract) pins the framework-agnostic shape every binding must implement: the canonical `ActContract` object, the page-level aggregation rule, the variant emission protocol, the `BindingCapabilities` matrix, the placeholder emission contract, and the `contract_version` versioning rule. PRD-300 is silent — by design — on **how** a specific framework expresses those rules: how a page declares its contract, how nested components register their contributions, what `extract` actually walks at build time, and how the binding's package interfaces with the host framework's plugin / provider / hooks surface. Without a binding-specific PRD that pins those answers, the React-targeting generators downstream — PRD-401 (Astro + React islands), PRD-404 (Docusaurus), PRD-405 (Next.js static export), PRD-406 (Remix static export) — each have to relitigate the same surface and risk drifting.

PRD-301 is the React-side leaf of PRD-300. It pins three idiomatic declaration patterns (component static field, hook, page-level boundary), the SSR-walk strategy that is canonical for React (using `react-dom/server` plus a `<ActProvider>` collector), an opt-in static-AST scanner (Babel/SWC plugin that catches statically-resolvable contracts), an optional headless-render fallback (jsdom or Playwright) for legacy SPAs, the React Server Components walk rule (server tree only per PRD-300-R30), and the binding-package surface (`@act/react`) that generators consume. The prose, snippets, and fixtures below let a binding author build a conformant `@act/react` against PRD-300 without re-deriving the contract.

### Goals

1. Pin the **React declaration patterns** that desugar to PRD-300's canonical contract: the component static field (`Hero.act = {…}`), the per-render hook (`useActContract({…})`), and the page-level boundary (a `<ActContract>` wrapper component or an exported `act` const on a route module).
2. Pin the **`<ActProvider>` collector** that the SSR-walk strategy depends on: how it captures contracts during render, how it scopes capture per route, how it interacts with React 18 streaming and `<Suspense>`.
3. Pin the **SSR-walk extraction strategy** as the canonical path: `react-dom/server.renderToString` (or `renderToPipeableStream` for streaming) wrapped in `<ActProvider>`; capture page contract from route module; emit per PRD-300-R9.
4. Pin the **static-AST extraction option** (Plus capability): a Babel/SWC plugin that walks JSX, recognizes `Component.act = {…}` literals and `useActContract({…})` literal arguments, emits PRD-300-stamped blocks marked `metadata.extraction_method: "static-ast"` (PRD-300-R29).
5. Pin the **headless-render fallback** (Plus, optional): when the host generator can't SSR (e.g., a pure-client Vite-style SPA), the binding MAY render under jsdom or Playwright; output is marked `metadata.extraction_method: "headless-render"` per PRD-300-R29.
6. Pin the **React Server Components (RSC) walk rule**: when RSC is in use, the binding extracts only from the server tree; client-only components contribute via their static contract (per PRD-300-R30).
7. Pin the **binding capability declaration** (`@act/react/capabilities`): which flags PRD-300-R28 the binding sets `true`, with rationale per flag.
8. Pin the **generator integration surface**: the `ActBinding` interface exported by `@act/react`, the `extractRoute()` entry point, the route-module conventions PRD-401/404/405/406 consume.
9. Pin the **failure mode emission** for React-specific failures (component throws during render, hook called outside a provider, RSC tree mismatch) — every failure routes to PRD-300-R22's placeholder block.
10. Pin the **conformance band** for the React binding: Core when SSR-walk + page-level + component-level patterns are supported; Standard with `related` aggregation and partial-extraction handling; Plus with `marketing:*` blocks, variants, and i18n.

### Non-goals

1. **Defining the canonical contract object.** PRD-300-R2 owns it; PRD-301 only specifies how React syntactic forms desugar to it.
2. **Defining the page-level aggregation rule.** PRD-300-R9 owns it; PRD-301 specifies the React-side render walk that produces the depth-first ordering PRD-300 mandates.
3. **Defining the variant emission protocol, the variant cap, or the `metadata.variant` shape.** PRD-300-R14–R19 own those rules; PRD-301 specifies how a React binding replays renders per variant.
4. **Defining the wire envelope.** PRD-100 / PRD-102 own the envelopes; the binding emits per PRD-300-R20.
5. **Defining the generator pipeline.** PRD-400 (generator architecture) owns build-orchestration and CLI wiring; PRD-301 specifies what the binding hands to the generator.
6. **Defining the runtime SDK behaviour.** PRD-500-series own the runtime profile; the React binding is build-time/SSR-shaped per PRD-300-R8 (contract surface inert to delivery).
7. **Specifying which Babel or SWC version the static-AST plugin pins to.** Implementation detail; the requirements here are functional.
8. **Defining a Vue-flavoured or Angular-flavoured equivalent.** PRD-302 / PRD-303 own those; PRD-301 is React-only.
9. **JSON Schemas under `schemas/301/`.** PRD-301 emits PRD-100 / PRD-102 envelopes; the binding interface is a TypeScript signature, not a JSON envelope. No new schemas.

### Stakeholders / audience

- **Authors of:** PRD-401 (Astro plugin — React islands), PRD-404 (Docusaurus plugin), PRD-405 (Next.js plugin — App Router and Pages Router), PRD-406 (Remix plugin), PRD-409 (standalone CLI when running over a React app), PRD-700 (minimal Astro docs example), PRD-702 (corporate marketing example using Next.js + Contentful).
- **Reviewers required:** Jeremy Forsythe (BDFL).

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The hook pattern (`useActContract`) re-runs on every render and emits duplicate or stale extractions | High | High | PRD-301-R8 mandates the hook is registration-only; the provider collects once per (instance, variant) per PRD-300-R4. Implementation snippet uses a `WeakMap<Fiber, Contract>` to dedupe. |
| RSC and client-component walking diverge — server walks miss client-side contracts; client walks miss server-side props | Medium | High | PRD-301-R12 follows PRD-300-R30 strictly: server-tree-only walk; client components contribute via their static contract; the hook pattern is unsafe inside RSC and the binding emits a build error if a `useActContract` call is detected in a server component. |
| Streaming SSR (`renderToPipeableStream`) yields contracts before suspended boundaries resolve | Medium | Medium | PRD-301-R11 hooks the stream's `onAllReady` (React 18) callback; the binding does not yield extractions until the stream completes per PRD-300-R31. |
| Static-AST plugin produces partial extractions silently — author thinks they have full coverage | Medium | High | PRD-301-R15 stamps every static-AST extraction with `metadata.extraction_method: "static-ast"` per PRD-300-R29; the binding emits a build warning when the static-AST path produces a block with no SSR-walk counterpart. |
| Headless render hits production endpoints with build credentials | Low | High | PRD-301-R17 requires the binding to gate fetch in headless mode behind an explicit allowlist, defaulting to deny; cross-cuts PRD-300 §Security and PRD-109. |
| Generators dispatch on stale `capabilities` flags after a binding upgrade | Low | Medium | PRD-301-R20 requires the binding to publish capabilities as a `const` and bump the binding's MINOR per PRD-108-R4(5) when adding a flag; generators (PRD-400) re-read on every build. |
| JSX with computed props (`<Hero {...spread} />`) breaks static-AST scanning | Medium | Low | Documented behaviour: static-AST emits no contract for unresolvable JSX; SSR-walk is the canonical fallback. The binding warns when static-AST mode is selected and computed props are detected. |

### Open questions

1. ~~Should the binding ship a TypeScript-only `satisfies ActContract<P>` helper, or expose a runtime validator too?~~ **Resolved (2026-05-01): Ship both.** The TS `satisfies` helper covers authoring ergonomics; the runtime validator (a small function exported by `@act/react`) catches CMS-driven prop drift at extract time and routes to PRD-301-R16's placeholder path on failure. Both are additive and inexpensive. (Closes Open Question 1.)
2. ~~Should the binding support React 17 (no concurrent renderer)?~~ **Resolved (2026-05-01): No.** React 18+ only for v0.1 per PRD-301-R2. React 17 is documented as out-of-scope; adding support would require a parallel non-concurrent code path. Per the heuristic to defer expanded framework-version support to v0.2. (Closes Open Question 2.)
3. ~~Should the page-level boundary use a wrapper component (`<ActContract>{children}</ActContract>`) or only an exported `act` const on the route module?~~ **Resolved (2026-05-01): Both, with the const form preferred.** The const form is statically resolvable, integrates with App Router conventions, and is what PRD-301-R5 names as preferred. The wrapper exists for non-route boundaries (a layout declaring its own page-level scope; rare). PRD-301-R5 already pins both. (Closes Open Question 3.)

### Acceptance criteria

- [ ] Every requirement carries an ID `PRD-301-R{n}` and a conformance level (Core / Standard / Plus per PRD-107).
- [ ] The Specification section opens with a table of parent (PRD-300) + 100-series requirements implemented (per docs/workflow.md Phase 3 addition).
- [ ] Implementation notes section ships ~3–6 short TS snippets: declaration patterns, the `<ActProvider>` collector, the SSR-walk extraction skeleton, the capability declaration, the variant replay loop adapted for React, the placeholder emission helper.
- [ ] Test fixtures enumerated under `fixtures/301/positive/` and `fixtures/301/negative/`; fixture files NOT created in this PRD.
- [ ] No JSON Schemas under `schemas/301/`.
- [ ] Cites PRD-300 (parent contract), PRD-100 (envelope), PRD-102 (block taxonomy), PRD-107 (conformance), PRD-108 (versioning), PRD-109 (security). Acknowledges Q3 (TS-only).
- [ ] Open questions ≤ 5; technical questions resolved or queued; strategic questions deferred to `000-decisions-needed.md`.
- [ ] Changelog entry dated 2026-05-01 by Jeremy Forsythe is present.

---

## Context & dependencies

### Depends on

- **PRD-300 (In review):** the parent component contract. PRD-301 implements PRD-300's contract for React. Cited per requirement.
- **PRD-100 (Accepted):** wire format. The binding emits node and block envelopes per PRD-100-R10, R21–R23, R28–R31.
- **PRD-102 (Accepted):** content blocks. The binding emits blocks satisfying R1–R11; component-extracted blocks set `metadata.extracted_via: "component-contract"` per PRD-102-R21; placeholders per R22; partial extractions per R23; variant convention per R29–R32.
- **PRD-107 (Accepted):** conformance bands. The React binding's requirements are banded across Core / Standard / Plus per the level a generator declares it supports.
- **PRD-108 (Accepted):** versioning policy. Adding a capability flag to the binding's `BindingCapabilities` is MINOR per R4(5); the package follows MAJOR-pinned / MINOR-floating with PRD-300's `contract_version`.
- **PRD-109 (Accepted):** security posture. Build-time `extract` runs in the main JS context per PRD-300 §Security; the headless-render fallback's network gating cross-cuts PRD-109's threat model.
- **000-decisions-needed.md Q3:** TypeScript-only first-party reference impls. `@act/react` ships as a TS package per Q3.
- External: [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174). React 18 documentation for `react-dom/server` (`renderToString`, `renderToPipeableStream`, `renderToReadableStream`), the React Server Components RFC, the `<Suspense>` boundary semantics. Babel and SWC plugin APIs (informational reference for static-AST scanning). jsdom and Playwright (informational for headless render).

### Blocks

- **PRD-401** (Astro plugin) — the React island path consumes `@act/react.extractRoute()`.
- **PRD-404** (Docusaurus plugin) — Docusaurus runs on React; the generator dispatches via `@act/react`.
- **PRD-405** (Next.js plugin) — Next.js App Router (RSC) and Pages Router both depend on `@act/react`'s capability declaration.
- **PRD-406** (Remix plugin) — Remix routes are React; the generator hooks `@act/react`'s SSR walk.
- **PRD-700** (Astro docs example) — exercises the binding via PRD-401.
- **PRD-702** (corporate marketing example) — exercises the binding via PRD-405 with `marketing:*` block emission and variant handling.

### References

- v0.1 draft: §3.1 (component-driven critique), §5.11.1 (three declaration patterns), §5.11.2 (page-level contracts), §5.11.3 (build-time extraction strategies), §5.11.4 (variant handling), §6.4.4 (`react-component` adapter config), §7.3 (SPA-specific pipelines), §8.4 (corporate marketing worked example), §8.5 (no-SSR SPA fallback).
- `prd/300-component-contract.md` R1–R32 (the contract this binding implements).
- `prd/102-content-blocks.md` R1–R11 (block taxonomy), R21 (`extracted_via`), R22 (placeholder), R23 (partial extraction), R24 (block ordering), R29–R32 (variant convention).
- `prd/100-wire-format.md` R10 (ID grammar), R21–R23 (node envelope), R25 (`children` cycle prohibition), R28–R31 (block discriminator and consumer tolerance).
- `prd/107-conformance-levels.md` R6 / R8 / R10 (bands).
- `prd/108-versioning-policy.md` R4 / R5 / R7.
- Prior art: React 18 SSR APIs (`renderToString`, `renderToPipeableStream`); the React Server Components RFC; Next.js App Router metadata (`generateMetadata`) — informational for the page-level pattern; Astro's `getStaticPaths` route-module convention; Docusaurus's plugin lifecycle.

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) where requirements are imposed. Lowercase "must" and "should" are non-normative prose.

### Parent + 100-series requirements implemented

This binding implements PRD-300's contract for React. The table below maps each PRD-301 requirement back to the parent (PRD-300) and 100-series rules it satisfies, so a binding implementer can verify coverage end-to-end without cross-referencing three PRDs by hand.

| Parent / 100-series requirement | What it pins | Where PRD-301 enforces |
|---|---|---|
| PRD-300-R2 (canonical contract object) | `{type, id?, summary?, related?, variants?, contract_version, extract}` | PRD-301-R3, R4, R5 (each React pattern desugars to this object) |
| PRD-300-R3 (three patterns equivalent) | Field / hook / decorator desugar identically | PRD-301-R6 (the static field, hook, and `<ActContract>` boundary patterns desugar through the same internal core) |
| PRD-300-R4 (`extract` once per instance/variant) | Hook pattern is registration-only | PRD-301-R8 (the hook stores the contract via Fiber-keyed `WeakMap`; the provider walks once on render completion) |
| PRD-300-R7 (`extract` is sync) | Sync return only | PRD-301-R9 (the binding rejects async extracts; emits placeholder per PRD-300-R22) |
| PRD-300-R9 (depth-first render-order aggregation) | Page-level walk | PRD-301-R10 (SSR walk uses React commit order; provider records contract registration order, which equals depth-first render order) |
| PRD-300-R15–R19 (variant emission) | Replay per variant; cap; metadata.variant | PRD-301-R13 (variant replay loop wraps `renderToString` per variant key) |
| PRD-300-R20 (envelope satisfaction) | Block discriminator, REQUIRED fields, etc. | PRD-301-R14 (binding validates each block against PRD-100/PRD-102 before emitting) |
| PRD-300-R21 (`metadata.extracted_via` set automatically) | Binding-owned metadata | PRD-301-R14 (binding stamps every block in the SSR walk) |
| PRD-300-R22 (placeholder on failure) | `marketing:placeholder` block + warning | PRD-301-R16 (binding wraps `extract` and React render in try/catch; emits placeholder; warns the generator) |
| PRD-300-R28 (capability declaration) | Static `BindingCapabilities` | PRD-301-R20 (binding exports `capabilities`; values pinned in this PRD) |
| PRD-300-R29 (`metadata.extraction_method`) | SSR-walk / static-ast / headless-render | PRD-301-R15 (binding stamps each block with the actual method used) |
| PRD-300-R30 (RSC walks server tree only) | Server-only walk | PRD-301-R12 (binding refuses to walk client trees when RSC is in use; `useActContract` in a server component is a build error) |
| PRD-300-R31 (streaming completion) | Wait for `onAllReady` | PRD-301-R11 (streaming-SSR path waits for `onAllReady` before yielding) |
| PRD-300-R32 (no PII / request-scoped data in `extract`) | Build-time props only | PRD-301-R18 (route props supplied to `extract` come from generator-supplied loaders, not request scope) |
| PRD-100-R10 / R11 (ID grammar / byte cap) | Per-node IDs | PRD-301-R7 (page-level `id` validated before route extract) |
| PRD-100-R21 / R28–R31 (envelope shape, block discriminator) | Output validity | PRD-301-R14 (validation gate before emission) |
| PRD-102-R21 (`metadata.extracted_via`) | Component-extracted marker | PRD-301-R14 (auto-stamped) |
| PRD-102-R22 / R23 (placeholder / partial) | Failure modes | PRD-301-R16 |

### Conformance level

Per PRD-107, requirements in this PRD band as follows. The React binding's Core surface is the smallest set that lets a generator extract a single page-level contract and its component-level descendants via SSR-walk; Standard adds `related` aggregation and partial-extraction handling; Plus adds `marketing:*` block emission, variant handling, RSC support, streaming, and the static-AST and headless-render extraction modes.

- **Core:** PRD-301-R1, R2, R3, R5, R6, R7, R8, R9, R10, R14, R16, R20, R22.
- **Standard:** PRD-301-R4, R11, R17, R18, R19, R21, R23.
- **Plus:** PRD-301-R12, R13, R15, R24, R25, R26.

A binding declaring Plus satisfies Standard and Core by additivity (PRD-107-R11). A generator that targets Core only (e.g., a documentation-only generator with no `marketing:*` blocks) MAY consume a Plus-capable binding without using its Plus features.

### Normative requirements

#### Package surface

**PRD-301-R1.** The React binding MUST be published as the npm package `@act/react`. The package MUST export the symbols required by PRD-300-R28's `ActBinding` interface — at minimum: a `name` (the string `"@act/react"`), a `contractVersion` (matching PRD-300-R26's `^[0-9]+\.[0-9]+$`), a `capabilities` const, and an `extractRoute(input)` async function. Conformance: **Core**.

**PRD-301-R2.** The binding's package MUST declare React as a peer dependency. The supported React range is React 18.0+ in v0.1. React 17 and earlier are out of scope; the binding MUST emit a build error if instantiated against React < 18 detected via the `React.version` runtime probe. Conformance: **Core**.

#### Declaration patterns

**PRD-301-R3.** The binding MUST recognize the **static field declaration pattern**: a function or class component carries an `act` static property whose value is an `ActContract<P>` per PRD-300-R2. The binding's desugarer MUST treat the static field as the canonical declaration source for that component. Example: `Hero.act = { type: "marketing:hero", contract_version: "0.1", extract: (props) => ({...}) }`. Conformance: **Core**.

**PRD-301-R4.** The binding MUST recognize the **hook declaration pattern**: a component invokes `useActContract(contract)` from `@act/react` during its render. The binding's `<ActProvider>` MUST capture the contract at render time and associate it with the component's React Fiber instance. Per PRD-300-R4, the hook is registration-only — `extract` MUST NOT be invoked from inside the hook; the provider invokes `extract` after render completion. Conformance: **Standard**.

**PRD-301-R5.** The binding MUST recognize the **page-level boundary pattern** in either of two forms:
- **Exported `act` const on a route module**: e.g., `export const act = { type: "landing", id: "pricing", contract_version: "0.1", extract: ... } satisfies PageContract;`. The generator (PRD-400) reads this export from the route module and supplies it to `extractRoute()`. This is the preferred form because it is statically resolvable.
- **`<ActContract>` wrapper component**: a component that receives a `contract` prop conforming to `PageContract` and renders its children inside an `<ActProvider>` scope; the wrapper attaches the page contract to the current route. This form is for non-route boundaries (e.g., a layout component declaring its own page scope). Authors SHOULD prefer the `act` const form when the host framework supports it.

The binding MUST handle both forms equivalently per PRD-300-R3. Conformance: **Core**.

**PRD-301-R6.** All three React declaration surfaces (static field, hook, page-level boundary) MUST desugar to the same internal `ActContract<P>` shape per PRD-300-R3 and pass through the same internal traversal. The binding's tests MUST include the equivalence fixtures enumerated in `fixtures/300/positive/component-static-field.json` and `fixtures/300/positive/component-hook.json` adapted to React, plus `fixtures/301/positive/page-boundary-const-form.json` and `fixtures/301/positive/page-boundary-wrapper-form.json`. Output across the three forms (and across the two page-boundary sub-forms) MUST be byte-identical given identical authored inputs. Conformance: **Core**.

#### Page-level extraction

**PRD-301-R7.** When the generator invokes `extractRoute(input)` with a page-level contract whose `id` violates PRD-100-R10 (grammar) or PRD-100-R11 (byte length), the binding MUST surface the violation as a build error per PRD-300-R10 and skip the route. No placeholder applies at page level (placeholders are block-level only). The error MUST cite the route's source file and line where the page contract is declared, when known. Conformance: **Core**.

**PRD-301-R8.** During SSR walk, the binding MUST guarantee `extract` for any registered contract runs **at most once per (component instance, variant)** tuple per PRD-300-R4. The implementation MUST use a per-render scratchpad keyed by the component's Fiber (or equivalent React-internal instance handle); the hook pattern MUST NOT invoke `extract` from inside the render function. Conformance: **Core**.

**PRD-301-R9.** The binding MUST detect a `Promise`-returning `extract` per PRD-300-R7 and emit a placeholder per PRD-300-R22. The detection MUST use a `then`-method check on the returned value, not solely `instanceof Promise`. Conformance: **Core**.

**PRD-301-R10.** SSR-walk extraction MUST aggregate descendant contracts in **render order, top-to-bottom, depth-first** per PRD-300-R9 / PRD-102-R24. The binding's provider MUST record contract registration in the order React's commit phase produces it; this order equals depth-first render order in React 18+'s synchronous renderer. The binding MUST NOT reorder, deduplicate, or skip blocks based on visual presentation. Conformance: **Core**.

**PRD-301-R11.** When the generator invokes the binding under a streaming SSR API (`renderToPipeableStream` or `renderToReadableStream`), the binding MUST wait for the React 18 `onAllReady` callback (or stream-completion equivalent) before yielding collected contracts to the generator. Per PRD-300-R31, the binding MUST NOT yield partial extractions while suspended boundaries are still resolving. Conformance: **Standard**.

**PRD-301-R12.** When the host framework runs React Server Components, the binding MUST walk the **server tree only**, per PRD-300-R30. Client-only components contribute via their static contract (the `extract` runs against props that the server boundary serialized). The binding MUST emit a build error if `useActContract` is detected inside a component whose module is a server component (per the `"use client"` boundary convention). The binding MUST set `capabilities.rsc: true` only when the binding's RSC walk is implemented; setting `rsc: true` while walking the client tree violates PRD-300-R30. Conformance: **Plus**.

#### Variant handling

**PRD-301-R13.** When a page-level contract declares `variants` other than `"default"`, the binding MUST replay the SSR walk once per declared variant key, supplying `ctx.variant` set to each key per PRD-300-R15. Each replay MUST instantiate a fresh `<ActProvider>` and a fresh React render; the binding MUST NOT reuse the canonical render's collected contracts for variant emission (variants may produce different component trees). The variant matrix MUST be capped at 64 per PRD-300-R17; the binding emits a build error above the cap. Conformance: **Plus**.

#### Extraction guarantees

**PRD-301-R14.** Every block emitted by the React binding MUST satisfy PRD-300-R20: PRD-100-R28 (block discriminator), PRD-100-R29 (core block types), PRD-100-R30 (`marketing:*` namespace regex), PRD-102-R1–R11 (per-type schemas). The binding MUST validate each block against these constraints **before** emitting; any violation produces a placeholder per PRD-300-R22 and a build warning. The binding MUST stamp every emitted block with `metadata.extracted_via: "component-contract"` per PRD-300-R21 / PRD-102-R21; an `extract` whose output already carries `metadata.extracted_via` set to a different value is rejected and substituted with a placeholder per PRD-300-R21. Conformance: **Core**.

**PRD-301-R15.** Every block emitted MUST carry `metadata.extraction_method` per PRD-300-R29 reflecting the actual mode used for that pass: `"ssr-walk"`, `"static-ast"`, or `"headless-render"`. When the generator runs the binding under SSR-walk and a particular block originated from the static-AST scanner (e.g., as a fallback for a sub-tree the SSR walk could not enter), the binding MUST set the field to the actual method, not the binding's preferred method. Conformance: **Plus**.

#### Failure modes

**PRD-301-R16.** Every React-side failure during extraction — a component throwing during render, an `extract` throwing, an `extract` returning malformed output, an `extract` returning a Promise per PRD-301-R9, a hook called outside a provider, a block failing PRD-100/PRD-102 validation per PRD-301-R14 — MUST produce a `marketing:placeholder` block per PRD-300-R22 with the metadata fields PRD-300-R22 enumerates (`extracted_via`, `extraction_status: "failed"`, `error` truncated to ≤ 200 chars, `component`, `location`). The binding MUST NOT propagate the React render error past its own error boundary; React rendering MUST continue past the failed component so that descendants can still contribute their contracts. Conformance: **Core**.

#### Security

**PRD-301-R17.** The binding MUST NOT pass request-scoped or user-scoped data into `extract` per PRD-300-R32 / PRD-109. Specifically: the binding MUST NOT supply `extract` with values derived from cookies, sessions, request headers, user IDs, tenant IDs, or any per-request context. The binding's `extractRoute(input)` reads `routeProps` from the generator's static-data resolver; the binding MUST NOT read from `globalThis` request context, even when the host framework exposes such a context. Conformance: **Standard**.

**PRD-301-R18.** When the generator invokes the binding under `headless-render` mode (jsdom or Playwright), the binding MUST gate network access from the rendered tree behind an explicit allowlist supplied by the generator. The default allowlist is empty (deny all); the generator (PRD-400) is responsible for populating it from its build configuration. The binding MUST NOT silently allow renders to hit production runtime endpoints with build-environment credentials. Per PRD-300 §Security and PRD-109. Conformance: **Standard**.

**PRD-301-R19.** The binding MUST truncate `metadata.error` to ≤ 200 characters and redact strings matching the secret patterns enumerated in PRD-300-R32 (v0.1 set: `Bearer `, `sk_live_[A-Za-z0-9]+`, `AKIA[A-Z0-9]{16}`, `ghp_[A-Za-z0-9]{36}`, `xoxb-[A-Za-z0-9-]+`) before emitting placeholder blocks. The binding MUST NOT include raw stack traces in `metadata.error`; only the `Error.message` (truncated, redacted) is emitted. The pattern set is owned by PRD-300; the binding inherits any additions. Conformance: **Standard**.

#### Capability declaration

**PRD-301-R20.** The binding MUST publish a static `capabilities: BindingCapabilities` const at its package boundary per PRD-300-R28, with the following values for v0.1 of `@act/react`:

| Flag | Value | Rationale |
|---|---|---|
| `ssr-walk` | `true` | The canonical mode; React 18 `react-dom/server` is the workhorse for the SSR walk. |
| `static-ast` | `true` | The Babel/SWC plugin supports static-AST scanning for `Component.act = {literal}` declarations and `useActContract({literal})` calls. Computed props produce no contract; SSR-walk is the fallback. |
| `headless-render` | `false` (default; opt-in via `@act/react/headless` sub-export) | Headless render is opt-in to keep the default install footprint small. The sub-export sets the flag `true`. |
| `rsc` | `true` | The binding implements the server-tree-only walk per PRD-300-R30. |
| `streaming` | `true` | The binding hooks `onAllReady` per PRD-301-R11 / PRD-300-R31. |
| `suspense` | `true` | The streaming path waits for suspended boundaries to resolve before yielding. |
| `concurrent` | `true` | The binding is safe to invoke concurrently across distinct routes; per-route state uses an `AsyncLocalStorage`-backed provider scope. |

The binding MUST set every flag truthfully (PRD-300-R28). Adding a new flag (e.g., `web-components`) is MINOR per PRD-108-R4(5); removing a flag is MAJOR per PRD-108-R5(5). Conformance: **Core**.

**PRD-301-R21.** The binding MUST publish its `contractVersion` as a string matching PRD-300-R26's `^[0-9]+\.[0-9]+$`. The v0.1 binding MUST publish `contractVersion: "0.1"`. A binding MUST NOT advertise a `contractVersion` greater than the PRD-300 contract surface revision it actually implements. Conformance: **Standard**.

#### Generator integration

**PRD-301-R22.** The binding MUST expose `extractRoute(input: ExtractRouteInput): Promise<NodeDraft[]>` per PRD-300's interface signature. The `routeId` field of `ExtractRouteInput` corresponds to the page-level contract `id`; the `module` field is the route module the generator resolved (e.g., the default export of an Astro / Next / Remix / Docusaurus route file); the `routeProps` field is the build-time-resolved props the generator supplies; `locale` and `variant` come from the generator per PRD-104 and PRD-300-R15 respectively. Conformance: **Core**.

**PRD-301-R23.** The binding's output `NodeDraft[]` MUST satisfy PRD-300's `NodeDraft` shape: `{id, type, title, summary, content, related?, parent?, metadata?, tokens?}`. The generator (PRD-400) supplies `act_version` and `etag` per PRD-100. The binding MUST NOT supply `act_version` or `etag`; supplying them is a binding-side error and the generator MUST overwrite. Conformance: **Standard**.

#### Static-AST extraction

**PRD-301-R24.** When the generator dispatches under `static-ast` mode, the binding's static scanner MUST recognize: (a) a default-exported function or class component with a sibling `Component.act = {object literal}` assignment, where the object literal is fully resolvable at parse time; (b) a `useActContract({object literal})` call inside a component body where the literal is fully resolvable; (c) an exported `act` const on a route module whose value is an object literal. The scanner MUST emit no contract for declarations whose `extract` function references runtime values that the AST cannot resolve (e.g., a closure over an imported symbol whose value is module-scope-mutable). Per PRD-300-R28 the static-AST capability is partial extraction by design. Conformance: **Plus**.

**PRD-301-R25.** Under `static-ast` mode, the binding MUST stamp every emitted block with `metadata.extraction_method: "static-ast"` per PRD-300-R29. The generator's `--mode` flag (per PRD-400) selects between SSR-walk and static-AST; the binding does not auto-fall-back from SSR-walk to static-AST, but MAY emit a build warning when the SSR-walk path produced fewer blocks than the static-AST path would have for the same route. Conformance: **Plus**.

#### Headless-render fallback

**PRD-301-R26.** When loaded via the `@act/react/headless` sub-export, the binding sets `capabilities["headless-render"]: true` and uses jsdom (default) or Playwright (opt-in via generator config) to render the route. Every emitted block MUST carry `metadata.extraction_method: "headless-render"` per PRD-300-R29. The headless path is a Tier-2 fallback per PRD-300 gap D4 — it is intended for SPAs that have no SSR pipeline and where neither static-AST nor SSR-walk is viable. Per PRD-301-R18, network access from the rendered tree MUST be allowlist-gated. Conformance: **Plus**.

### Wire format / interface definition

PRD-301 is an **interface PRD**, not a wire-format PRD. The wire envelope is the PRD-100 node envelope; the binding's interface satisfies PRD-300's `ActBinding` signature. No JSON Schemas under `schemas/301/`; the binding emits PRD-100 / PRD-102 envelopes via `NodeDraft[]` per PRD-300.

#### React-specific declaration types

```ts
// @act/react/src/types.ts
import type { ActContract, PageContract } from "@act/core";

/** Static-field pattern. The component carries an `act` property typed as ActContract<P>. */
export type ReactComponentWithAct<P> = React.FunctionComponent<P> & {
  act?: ActContract<P>;
};

/** Hook pattern signature; per PRD-301-R4. */
export function useActContract<P = unknown>(contract: ActContract<P>): void;

/** Page-level boundary wrapper; per PRD-301-R5. */
export interface ActContractWrapperProps {
  contract: PageContract;
  children: React.ReactNode;
}
export function ActContractWrapper(props: ActContractWrapperProps): JSX.Element;

/** Provider component the SSR walk wraps a route in; per PRD-301-R10. */
export interface ActProviderProps {
  children: React.ReactNode;
  /** The page-level contract for the current route, if known. */
  pageContract?: PageContract;
  /** The current variant key for variant replay; per PRD-300-R15. */
  variant?: string;
}
export function ActProvider(props: ActProviderProps): JSX.Element;
```

#### The binding export

```ts
// @act/react/src/binding.ts
import type { ActBinding, BindingCapabilities, ExtractRouteInput, NodeDraft } from "@act/core";

const capabilities: BindingCapabilities = {
  "ssr-walk": true,
  "static-ast": true,
  "headless-render": false, // set true by @act/react/headless sub-export
  rsc: true,
  streaming: true,
  suspense: true,
  concurrent: true,
};

export const reactBinding: ActBinding = {
  name: "@act/react",
  contractVersion: "0.1",
  capabilities,
  async extractRoute(input: ExtractRouteInput): Promise<NodeDraft[]> {
    // Implementation per PRD-301-R10–R16. See Implementation notes.
    throw new Error("see Implementation notes");
  },
};
```

### Errors

The binding surfaces errors as build warnings or build errors per PRD-300-R22 and PRD-300's Errors table. The wire envelope (PRD-100 / PRD-102) is unaffected by binding-side errors: failures emit placeholder blocks per PRD-102-R22, which are well-formed envelopes.

| Condition | Binding response | Generator finding |
|---|---|---|
| `extract` throws | Placeholder per PRD-301-R16 + R14 + PRD-300-R22; warn | Build warning; exit non-zero if `--fail-on-extraction-error` |
| Component throws during render | Wrap in error boundary; emit placeholder for that component's contract; continue render | Build warning |
| `extract` returns Promise | Placeholder per PRD-301-R9 + PRD-300-R7; warn | Build warning |
| `extract` returns block missing REQUIRED fields | Placeholder per PRD-301-R14 + PRD-300-R20; warn | Build warning |
| Block uses `marketing:*` with invalid suffix | Placeholder per PRD-301-R14; warn | Build warning |
| Hook called outside an `<ActProvider>` | Placeholder per PRD-301-R16; warn | Build warning |
| `useActContract` detected in a server component (`"use client"` boundary not present and module is a server module) | Build error per PRD-301-R12 | Build error |
| `useActContract` detected in a client tree under RSC dispatch | Block emitted via the static contract path; no client walk per PRD-301-R12 | Normal |
| Page-level `id` violates PRD-100-R10 / R11 | Skip route per PRD-301-R7; log location | Build error |
| Two page-level contracts share `id` | Build error per PRD-300-R11 | Build error |
| React < 18 detected | Build error per PRD-301-R2 | Build error |
| Variant matrix > 64 | Build error per PRD-300-R17 | Build error |
| `metadata.error` > 200 chars or matches secret pattern | Truncate / redact per PRD-301-R19 | Normal (placeholder still emitted) |
| Streaming SSR yields before `onAllReady` | Binding waits per PRD-301-R11; never emits incomplete | Normal |
| `contract_version` MAJOR exceeds binding's MAJOR | Build error per PRD-300-R27 | Build error |
| Headless render attempts unallowlisted fetch | Block fetch per PRD-301-R18; log; render proceeds with stubbed response | Build warning |

PRD-300 owns the canonical error contract; the rows above are React-specific instantiations of those rules.

---

## Examples

Examples are non-normative but consistent with the Specification section.

### Example 1 — Static-field declaration on a React component

```tsx
// design-system/Hero.tsx
import type { ActContract } from "@act/core";

interface HeroProps { title: string; subtitle: string; ctaText?: string; ctaUrl?: string; }

export function Hero(props: HeroProps) {
  return <section className="hero">{/* ... */}</section>;
}

Hero.act = {
  type: "marketing:hero",
  contract_version: "0.1",
  extract: (props, _ctx) => ({
    type: "marketing:hero",
    headline: props.title,
    subhead: props.subtitle,
    cta: props.ctaText ? { label: props.ctaText, href: props.ctaUrl ?? "#" } : undefined,
  }),
} satisfies ActContract<HeroProps>;
```

The `@act/react` desugarer (per PRD-301-R3) lifts `Hero.act` to the canonical `ActContract` shape PRD-300-R2 specifies.

### Example 2 — Hook declaration

```tsx
// PricingTable.tsx
import { useActContract } from "@act/react";

export function PricingTable({ tiers }: { tiers: Tier[] }) {
  useActContract({
    type: "marketing:pricing-table",
    contract_version: "0.1",
    extract: (_props, _ctx) => ({
      type: "marketing:pricing-table",
      tiers: tiers.map(t => ({ name: t.name, price: t.price, features: t.features })),
    }),
  });
  return <div className="pricing">{/* ... */}</div>;
}
```

Per PRD-301-R4 + R8, the hook registers the contract; `extract` runs once after the SSR walk completes.

### Example 3 — Page-level boundary (Next.js App Router, RSC)

```tsx
// app/pricing/page.tsx
import type { PageContract } from "@act/core";
import { Hero, PricingTable, FAQAccordion } from "@/design-system";

export const act = {
  type: "landing",
  id: "pricing",
  contract_version: "0.1",
  summary: "Acme pricing tiers and plan comparison.",
  related: [
    { id: "products", relation: "see-also" },
    { id: "contact", relation: "see-also" },
  ],
  extract: (_props, _ctx) => ({ type: "landing" }),
} satisfies PageContract;

export default function PricingPage() {
  return (
    <>
      <Hero title="Pricing" subtitle="Plans that scale with you" ctaText="Start free" ctaUrl="/signup" />
      <PricingTable tiers={[/* ... */]} />
      <FAQAccordion items={[/* ... */]} />
    </>
  );
}
```

The generator (PRD-405) reads the `act` export, calls `reactBinding.extractRoute({ routeId: "pricing", module: pageModule, routeProps: {}, locale: undefined, variant: undefined })`, and the binding aggregates Hero / PricingTable / FAQAccordion per PRD-301-R10.

### Example 4 — Variant emission (experiment arm)

```tsx
export const act = {
  type: "landing",
  id: "pricing",
  contract_version: "0.1",
  variants: ["enterprise-2026q2"],
  summary: "Acme pricing tiers and plan comparison.",
  extract: (_props, _ctx) => ({ type: "landing" }),
} satisfies PageContract;
```

Per PRD-301-R13, the binding renders the route twice — canonical (`ctx.variant` undefined) and `ctx.variant: "enterprise-2026q2"` — and emits two nodes:
- `pricing` (canonical, per PRD-102-R30).
- `pricing@enterprise-2026q2` with `metadata.variant: { base_id: "pricing", key: "enterprise-2026q2", source: "experiment" }` and `related: [{ id: "pricing", relation: "variant_of" }]` per PRD-102-R31 / R32.

### Example 5 — Failure mode (component throws)

If `Hero` throws during render (e.g., a CMS prop is missing), the binding's error boundary catches it and emits:

```json
{
  "type": "marketing:placeholder",
  "metadata": {
    "extracted_via": "component-contract",
    "extraction_method": "ssr-walk",
    "extraction_status": "failed",
    "error": "Cannot read properties of undefined (reading 'title')",
    "component": "Hero",
    "location": "design-system/Hero.tsx:14"
  }
}
```

per PRD-301-R16 + PRD-300-R22 + PRD-301-R19. The render continues past the failed component so PricingTable and FAQAccordion can still contribute.

### Example 6 — RSC server-only walk (App Router)

In a Next.js App Router app where `app/pricing/page.tsx` is a server component and `<PricingTable>` is a client component (`"use client"`):

- The binding walks the server tree under `extractRoute()`.
- `<Hero>` (server component) contributes via its static field per PRD-301-R3.
- `<PricingTable>` (client component) contributes via its **static field**; the binding does not walk into the client tree per PRD-301-R12 / PRD-300-R30.
- If `<PricingTable>` used `useActContract` instead of a static field, the binding would emit a build error per PRD-301-R12 (hook calls in client trees under RSC are unsafe; the static field is the supported path).

---

## Test fixtures

Fixtures live under `fixtures/301/` and are exercised by `@act/react`'s test suite plus PRD-600 (validator) for emitted output. Fixture files are NOT created in this PRD; the layout below is the surface.

### Positive

- `fixtures/301/positive/component-static-field.json` → satisfies R3, R6 (static field declaration desugars correctly).
- `fixtures/301/positive/component-hook.json` → satisfies R4, R6, R8 (hook registers; provider walks once).
- `fixtures/301/positive/page-boundary-const-form.json` → satisfies R5, R6 (exported `act` const on route module).
- `fixtures/301/positive/page-boundary-wrapper-form.json` → satisfies R5, R6 (`<ActContract>` wrapper component).
- `fixtures/301/positive/ssr-walk-aggregates-children.json` → satisfies R10 (depth-first render-order aggregation).
- `fixtures/301/positive/streaming-onallready-completion.json` → satisfies R11 (binding waits for stream completion).
- `fixtures/301/positive/rsc-server-tree-only.json` → satisfies R12 (client subtree contributes via static field; no client walk).
- `fixtures/301/positive/variant-replay.json` → satisfies R13 (canonical + each variant emitted).
- `fixtures/301/positive/extracted-via-stamped.json` → satisfies R14 (`metadata.extracted_via: "component-contract"`).
- `fixtures/301/positive/extraction-method-ssr-walk.json` → satisfies R15 (`metadata.extraction_method: "ssr-walk"`).
- `fixtures/301/positive/extraction-method-static-ast.json` → satisfies R15, R24, R25 (static-AST stamps method correctly).
- `fixtures/301/positive/extraction-method-headless.json` → satisfies R15, R26 (headless render stamps method correctly).
- `fixtures/301/positive/capability-declaration.json` → satisfies R20 (full capabilities const).
- `fixtures/301/positive/contract-version-published.json` → satisfies R21 (binding's `contractVersion` matches the contract revision).
- `fixtures/301/positive/extract-route-output-shape.json` → satisfies R22, R23 (`NodeDraft[]` shape; binding does not supply `act_version` / `etag`).

### Negative

- `fixtures/301/negative/react-17-detected.json` → MUST cause a build error per R2.
- `fixtures/301/negative/extract-throws.json` → expected output is a placeholder per R16 + PRD-300-R22; render continues past failed component.
- `fixtures/301/negative/component-throws-render.json` → expected output is a placeholder for that component's contract; descendants still contribute per R16.
- `fixtures/301/negative/extract-returns-promise.json` → expected output is a placeholder per R9 + R16.
- `fixtures/301/negative/extract-emits-malformed-block.json` → expected output is a placeholder per R14.
- `fixtures/301/negative/hook-outside-provider.json` → expected output is a placeholder per R16.
- `fixtures/301/negative/use-act-contract-in-server-component.json` → MUST cause a build error per R12 (server-component module without `"use client"`).
- `fixtures/301/negative/page-id-violates-grammar.json` → MUST cause a build error per R7 + PRD-100-R10.
- `fixtures/301/negative/page-id-collision.json` → MUST cause a build error per PRD-300-R11.
- `fixtures/301/negative/variant-matrix-exceeds-64.json` → MUST cause a build error per R13 + PRD-300-R17.
- `fixtures/301/negative/binding-supplies-act-version.json` → MUST cause the generator to overwrite per R23 (binding-side error logged).
- `fixtures/301/negative/headless-render-fetch-disallowed.json` → fetch blocked per R18; render continues with stubbed response; build warning emitted.
- `fixtures/301/negative/extracted-via-overridden-by-author.json` → expected output is a placeholder per R14 / PRD-300-R21 (the field is binding-owned).
- `fixtures/301/negative/error-message-with-secret.json` → expected output has `metadata.error` redacted per R19 / PRD-300-R32.
- `fixtures/301/negative/streaming-yields-before-onallready.json` → MUST be rejected; binding implementation under test fails the test if it yields early per R11.

---

## Versioning & compatibility

Per PRD-108, classify each kind of change to PRD-301 as MAJOR or MINOR. The binding's package version follows MAJOR-pinned / MINOR-floating against PRD-300's `contract_version`: a `@act/react@1.x` package implements PRD-300 contract MAJOR `1`; a `@act/react@1.x` package tolerates contract MINOR drift within the same MAJOR per PRD-108-R7.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a new declaration pattern (e.g., a fourth class-decorator form) | MINOR | Per PRD-108-R4(1); patterns desugar to PRD-300-R2's canonical object. |
| Add a new option to the hook signature (e.g., `useActContract(contract, { skip: bool })`) | MINOR | Per PRD-108-R4(1); existing call sites tolerate. |
| Add a capability flag to the binding's `capabilities` const (e.g., `web-components: true`) | MINOR | Per PRD-300-R28 + PRD-108-R4(5). |
| Bump the binding's supported React MAJOR (e.g., add React 19 support) | MINOR | New support is additive; existing React 18 users unaffected. |
| Drop React 18 support in favor of React 19+ | MAJOR | Existing React 18 consumers break per PRD-108-R5(3). |
| Change the package name `@act/react` | MAJOR | Per PRD-108-R5(1) (renaming a "required field" of the package surface). |
| Change a capability flag's default value (e.g., flip `headless-render` default from `false` to `true`) | MAJOR | Existing generator dispatch logic depends on the flag's value. Per PRD-108-R5(2). |
| Tighten the static-AST scanner's accepted JSX patterns (reject what was accepted) | MAJOR | Existing source files break; per PRD-108-R5(6). |
| Add a recognized JSX pattern to the static-AST scanner | MINOR | Additive; per PRD-108-R4(1). |
| Promote a Standard requirement here to Core | MAJOR | Existing Core-targeting bindings become non-conformant; per PRD-108-R5(3). |
| Change the placeholder block shape (delegated to PRD-102-R22) | n/a | Tracked in PRD-102's Versioning table; this PRD inherits. |
| Editorial / prose clarification with no normative effect | n/a | Per 000-governance R18. |

### Forward compatibility

Per PRD-108-R7, the binding tolerates unknown optional fields on contract objects authored against newer contract MINORs and unknown capability flags on `BindingCapabilities`. A binding implementing contract `0.1` that receives a contract authored against `0.2` with a new optional `priority` field MUST tolerate the field (ignore it) per PRD-300-R27. A binding MUST reject contracts whose MAJOR exceeds the binding's supported MAJOR per PRD-300-R27 / PRD-108-R8.

### Backward compatibility

Within a v0.1.x line:
- A v0.1 `@act/react` binding's emitted `NodeDraft[]` is consumable by a v0.1 generator (PRD-400).
- A v0.2 binding emitting v0.2 contract output remains consumable by a v0.1 generator as long as the generator tolerates unknown optional fields per PRD-108-R7.
- A v0.1 binding consuming a contract authored against v0.2 (declaring `contract_version: "0.2"` with new optional fields) MUST tolerate per PRD-108-R7; the unknown fields are ignored.

Across MAJOR boundaries (v0.x → v1.0), no backward compatibility is required. Deprecation per PRD-108-R12 announces the window via the `000-governance` channel.

---

## Security considerations

This section documents the security posture deltas PRD-301 introduces over PRD-300 and PRD-109. The project-wide threat model lives in PRD-109; PRD-300 owns the build-time `extract` posture; this PRD's deltas concern React-specific extraction modes.

**Build-time `extract` runs in the main JS context (PRD-300 §Security, gap D3).** The React binding does not sandbox `extract`. A malicious component contract can exfiltrate environment variables, read filesystem paths, or hang the build. Producers SHOULD review `extract` functions in their codebase the same way they review any other build-time code. Cross-cuts PRD-109's threat model item "build-time code execution."

**`metadata.error` truncation and secret redaction (PRD-301-R19).** Per PRD-300-R22 / PRD-300-R32 the binding truncates error messages to ≤200 characters and redacts strings matching the v0.1 secret-pattern set (`Bearer `, `sk_live_[A-Za-z0-9]+`, `AKIA[A-Z0-9]{16}`, `ghp_[A-Za-z0-9]{36}`, `xoxb-[A-Za-z0-9-]+`). The binding MUST NOT include raw stack traces in `metadata.error`; only the `Error.message` (truncated, redacted). This is a SHOULD-shaped recommendation made MUST in this PRD because component-contract failures land in ACT envelopes consumed by agents — leaking a stack trace into `metadata.error` is a direct exfiltration path.

**`extract` MUST NOT receive request-scoped or user-scoped data (PRD-301-R17).** The contract surface is build-time-shaped per PRD-300-R8. The binding's `extractRoute(input)` reads `routeProps` from the generator's static-data resolver; the binding MUST NOT read from `globalThis` request context, even when the host framework exposes such a context (e.g., Next.js's `headers()` / `cookies()` helpers in App Router). Authors writing `extract` functions MUST treat the props as build-time-only and MUST NOT call request-scoped helpers from inside `extract`. Cross-cuts PRD-109-R11 (per-tenant ID stability) and PRD-109-R14 (no PII in error messages).

**Headless-render network gating (PRD-301-R18).** When loaded via the `@act/react/headless` sub-export, the binding renders the route in jsdom or Playwright. The site's runtime data fetches happen against whatever endpoints the build environment can reach. The binding MUST gate fetch behind an explicit allowlist supplied by the generator; the default allowlist is empty. The binding MUST NOT silently allow renders to hit production runtime endpoints with build-environment credentials. Cross-cuts PRD-300-R29 (every block stamped `extraction_method: "headless-render"` so consumers can apply lower confidence) and PRD-109's network-trust posture.

**RSC server-tree walk (PRD-301-R12).** The binding walks the server tree under RSC; client-only components contribute via their static contract. Walking the client tree under RSC produces non-deterministic extractions per PRD-300-R30 — a buggy or malicious binding that lies about `rsc: true` while walking the client tree can produce different output across renders, observable as ETag instability downstream. PRD-300-R28 places the burden on the binding to set `rsc: true` truthfully; PRD-400 (generator) is responsible for verifying via probe.

**Capability declaration is a producer claim (PRD-300-R28).** The binding publishes capabilities; the generator trusts them. PRD-301 inherits this trust model from PRD-300; PRD-400 owns capability-flag verification.

**Variant correlation (PRD-300 §Security).** A producer that emits both the canonical and a variant node tied to a specific identity (e.g., a personalization variant served to one user) leaks the identity-to-variant mapping if both nodes are observable in the same index. PRD-300-R16's opt-in default mitigates accidental emission. Producers serving runtime ACT MUST NOT emit personalization variants in the public-tenant index unless the variant is itself public.

PRD-109 owns the project-wide posture; the rules above are React-specific deltas, not duplications.

---

## Implementation notes

This section illustrates the canonical implementation shapes a React binding follows. Snippets are TypeScript per Q3 (TS-only first-party reference impls).

### 1. Declaration patterns desugared through `@act/core`

```ts
// @act/react/src/desugar.ts
import type { ActContract } from "@act/core";
import { fromStaticField, registerHookContract } from "@act/core/desugar";

/** Pattern 1 — static field. */
export function pickStaticContract<P>(
  comp: React.FunctionComponent<P> & { act?: ActContract<P> },
): ActContract<P> | undefined {
  return fromStaticField(comp);
}

/** Pattern 2 — hook (React 18). */
export function useActContract<P = unknown>(contract: ActContract<P>): void {
  // The provider's collector reads from the current Fiber via React's internal
  // useId-like instance handle. Hook is registration-only; per PRD-301-R8.
  const fiberKey = useFiberKey();
  registerHookContract(fiberKey, contract as ActContract<unknown>);
}
```

### 2. The `<ActProvider>` collector for SSR walk

```tsx
// @act/react/src/provider.tsx
import { createContext, useContext, useMemo } from "react";
import type { ActContract, PageContract } from "@act/core";

interface CollectorState {
  pageContract?: PageContract;
  variant?: string;
  collected: Array<{ fiberKey: symbol; contract: ActContract<unknown> }>;
}

const CollectorCtx = createContext<CollectorState | null>(null);

export function ActProvider(props: {
  children: React.ReactNode;
  pageContract?: PageContract;
  variant?: string;
}): JSX.Element {
  const state = useMemo<CollectorState>(
    () => ({ pageContract: props.pageContract, variant: props.variant, collected: [] }),
    [props.pageContract, props.variant],
  );
  return <CollectorCtx.Provider value={state}>{props.children}</CollectorCtx.Provider>;
}

export function useCollectorState(): CollectorState {
  const s = useContext(CollectorCtx);
  if (!s) throw new HookOutsideProviderError(); // placeholder per PRD-301-R16
  return s;
}
```

### 3. The SSR-walk extraction skeleton (PRD-301-R10 / R11)

```tsx
// @act/react/src/extract.ts
import { renderToString, renderToPipeableStream } from "react-dom/server";
import type { ExtractRouteInput, NodeDraft } from "@act/core";
import { aggregatePage, safeExtract, stampMetadata } from "@act/core/traverse";

export async function extractRoute(input: ExtractRouteInput): Promise<NodeDraft[]> {
  const { module, routeProps, locale, variant } = input;
  const pageContract = readPageContract(module);                // PRD-301-R5
  validatePageId(pageContract);                                  // PRD-301-R7

  const variants = pageContract.variants ?? "default";
  const drafts: NodeDraft[] = [];

  // Always emit canonical (PRD-102-R30).
  drafts.push(await renderOneVariant(pageContract, routeProps, locale, undefined));

  if (variants === "default") return drafts;

  const keys = variants === "all" ? discoverAllVariants(pageContract) : variants;
  if (keys.length > 64) {
    throw new BuildError(`variant matrix ${keys.length} exceeds cap (PRD-300-R17)`);
  }

  for (const key of keys) {
    drafts.push(await renderOneVariant(pageContract, routeProps, locale, key));
  }
  return drafts;
}

async function renderOneVariant(
  pageContract: PageContract,
  routeProps: unknown,
  locale: string | undefined,
  variant: string | undefined,
): Promise<NodeDraft> {
  const collector: CollectorState = { pageContract, variant, collected: [] };
  const tree = (
    <CollectorCtx.Provider value={collector}>
      <RouteRoot pageContract={pageContract} props={routeProps} />
    </CollectorCtx.Provider>
  );

  // Streaming path waits for onAllReady (PRD-301-R11).
  await renderUntilReady(tree);

  const ctx: ExtractionContext = {
    locale, variant, parentId: pageContract.id, binding: "@act/react", warn,
  };

  const draft = aggregatePage({
    rootContract: pageContract,
    rootProps: routeProps,
    ctx,
    walkChildren: () =>
      collector.collected.map(({ contract }) => ({ contract, props: undefined })),
  });

  if (variant) {
    draft.id = `${pageContract.id}@${variant}`;
    draft.metadata = {
      ...draft.metadata,
      variant: { base_id: pageContract.id, key: variant, source: "experiment" },
    };
    draft.related = [...(draft.related ?? []), { id: pageContract.id, relation: "variant_of" }];
  }
  return draft;
}
```

### 4. The capability declaration (PRD-301-R20)

```ts
// @act/react/src/capabilities.ts
import type { BindingCapabilities } from "@act/core";

export const capabilities: BindingCapabilities = {
  "ssr-walk": true,
  "static-ast": true,
  "headless-render": false,
  rsc: true,
  streaming: true,
  suspense: true,
  concurrent: true,
};

// @act/react/headless/src/capabilities.ts
export const headlessCapabilities: BindingCapabilities = {
  ...capabilities,
  "headless-render": true,
};
```

### 5. The variant-replay invocation (PRD-301-R13 wrapping PRD-300-R15)

```ts
// Already shown inside extractRoute() above; the invariants per PRD-300-R15:
//   1) canonical render emits first (no variant set);
//   2) each variant gets a fresh provider scope (NEVER reuse the canonical
//      collector — variant trees may differ);
//   3) variant matrix > 64 throws BuildError per PRD-300-R17.
```

### 6. Static-AST scanner (PRD-301-R24 / R25)

```ts
// @act/react/static-ast/src/plugin.ts
// A Babel plugin (or SWC equivalent) that walks JSX modules and emits NodeDraft[]
// for statically-resolvable contracts. Computed JSX produces no contract;
// SSR-walk is the canonical fallback.
import type { PluginObj } from "@babel/core";

export default function actStaticAstPlugin(): PluginObj {
  return {
    name: "@act/react/static-ast",
    visitor: {
      AssignmentExpression(path) {
        // Match `Component.act = { ... }` literal assignments.
        // Resolve the literal; emit a NodeDraft with metadata.extraction_method: "static-ast".
      },
      CallExpression(path) {
        // Match `useActContract({ ... })` calls with literal arguments.
      },
      ExportNamedDeclaration(path) {
        // Match `export const act = { ... }` on route modules.
      },
    },
  };
}
```

These snippets are illustrative; full implementation lives in `packages/react/` per the team-blueprint phase. The shared `@act/core` package per Q3's TS-only decision houses the framework-agnostic helpers PRD-300 specifies (desugar, traverse, placeholder, variants, capability gate).

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft. Pins the React binding's three idiomatic declaration patterns (static field, hook, page-level boundary in const-form and wrapper-form), the `<ActProvider>` collector for SSR walk, the canonical SSR-walk extraction strategy via `react-dom/server`, the streaming completion rule (`onAllReady` per PRD-300-R31), the React Server Components server-tree-only walk per PRD-300-R30, the static-AST extraction option (Babel/SWC plugin) marked `metadata.extraction_method: "static-ast"`, the headless-render fallback under `@act/react/headless` sub-export marked `metadata.extraction_method: "headless-render"`, the variant replay loop, the placeholder emission contract (truncated and secret-redacted error messages), the package surface (`@act/react`), the React 18+ peer-dependency floor, the `BindingCapabilities` const with values pinned per flag, and the generator integration via `extractRoute(input): Promise<NodeDraft[]>`. Cites PRD-300 R1–R32, PRD-100 R10/R21–R31, PRD-102 R1–R11/R21–R32, PRD-107 R6/R8/R10, PRD-108 R4/R5/R7, PRD-109 (PII posture). Resolves React-side instantiation of PRD-300's contract for PRD-401, PRD-404, PRD-405, PRD-406. Status: In review. |
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review. Decisions: (1) ship both `satisfies ActContract<P>` TS helper and a runtime validator — both inexpensive and additive; (2) React 18+ only for v0.1 — React 17 stays out of scope; (3) page-level boundary supports both forms (exported `act` const preferred; `<ActContract>` wrapper for non-route boundaries). Ratified judgment calls: R12 (RSC server-tree-only walk slot) preserved for cross-binding parity; `headless-render: false` by default, opt-in via `@act/react/headless` sub-export. PRD-301-R19 secret-pattern set updated to track PRD-300-R32's broadened v0.1 set (adds `ghp_…` GitHub PAT and `xoxb-…` Slack bot token). |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
