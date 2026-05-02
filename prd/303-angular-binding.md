# PRD-303 — Angular binding

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

PRD-300 (component contract) pins the framework-agnostic shape every binding must implement. PRD-300 is silent — by design — on **how** Angular specifically expresses the rules. Angular's idiom is materially different from React's and Vue's: components are decorated classes (`@Component({...})`); composition happens via dependency injection rather than hooks or `provide`/`inject`; SSR uses Angular Universal (`@angular/platform-server`'s `renderApplication` / `renderModule`); template syntax is its own language with structural directives (`*ngIf`, `*ngFor`); the natural way to register cross-cutting concerns is a service plus a module/standalone-component import.

PRD-303 is the Angular-side leaf of PRD-300. It pins three idiomatic declaration patterns (component-level static-field decorator metadata, an `ActContractService` injected at route level, and a structural directive `*actSection` for in-template page-level boundaries), the SSR-walk strategy that is canonical for Angular (using `@angular/platform-server.renderApplication`), an opt-in static-AST scanner that uses Angular's compiler API (`@angular/compiler-cli`), the binding's package surface (`@act/angular`), and the conformance band per requirement.

A note on scope: **no leaf 400-series generator currently depends on PRD-303 in v0.1**. The PRD index notes Angular as "future-facing" — there is no Angular generator (no `@act/angular-cli-plugin`, no `@act/analog-plugin`) in the v0.1 roadmap. PRD-303 nonetheless ships a complete binding so that:
1. PRD-300's three-binding promise (React, Vue, Angular) is met, anchoring the contract's framework-agnostic claim;
2. integration via the standalone CLI (PRD-409) using `@act/angular`'s `extractRoute()` is feasible without a custom generator;
3. a community-authored Angular generator can be wired against a stable contract.

The integration story for Angular is therefore at the framework boundary only — the binding is a TypeScript package consumable by any generator that satisfies PRD-400. Concrete generator integration is deferred to v0.2.

### Goals

1. Pin the **Angular declaration patterns** that desugar to PRD-300's canonical contract: the **component static-field pattern** (a static class member `static act: ActContract<P>` on the component class), the **service-based pattern** (`ActContractService.register({...})` invoked from a component's constructor or an `inject(ActContractService)`-driven setup), and the **structural directive pattern** for page-level boundaries (`*actSection="contract"`).
2. Pin the **collector mechanism** for SSR walk: an Angular service (`ActCollectorService`) provided at the standalone-component level, scoped per-render via a fresh injector tree per route.
3. Pin the **SSR-walk extraction strategy** as canonical: `@angular/platform-server.renderApplication` (or `renderModule` for legacy NgModule apps) wrapped in the binding's standalone-component bootstrap; the binding consumes the collected contracts after render completion.
4. Pin the **static-AST extraction option** (Plus capability): an Angular compiler-API-driven scanner that walks `@Component` decorators, structural directive usages, and explicit static-field assignments; only catches statically-resolvable contracts.
5. Pin the **Angular version floor**: Angular 17.0+ in v0.1 (Angular 17 introduced standalone components as the default and `provideServerRendering()` for SSR). Angular 16 and earlier are explicitly out of scope.
6. Pin the **binding capability declaration** (`@act/angular/capabilities`): which flags PRD-300-R28 the binding sets `true`, with rationale per flag (no RSC equivalent; no streaming SSR equivalent; static-AST yes).
7. Pin the **failure mode emission** for Angular-specific failures (component throws during render, directive used outside an installed `ActCollectorService`, malformed `@Component` metadata) — every failure routes to PRD-300-R22's placeholder block.
8. Pin the **conformance band** for the Angular binding: Core when SSR-walk + page-level + component-level patterns are supported; Standard with `related` aggregation and partial-extraction handling; Plus with `marketing:*` blocks, variants, and i18n.
9. Document the **integration story at the framework boundary**: PRD-303 provides a complete `ActBinding` but does not have a paired v0.1 generator; the PRD-409 (standalone CLI) path is the documented integration route until an Angular-native generator lands in v0.2.

### Non-goals

1. **Defining the canonical contract object.** PRD-300-R2 owns it.
2. **Defining the page-level aggregation rule.** PRD-300-R9 owns it; PRD-303 specifies the Angular-side render walk.
3. **Defining the variant emission protocol.** PRD-300-R14–R19 own it.
4. **Defining the wire envelope.** PRD-100 / PRD-102 own the envelopes.
5. **Defining the generator pipeline.** PRD-400 owns build-orchestration; PRD-303 has no v0.1 paired generator (see Goal 9).
6. **Angular ≤ 16.** Standalone components and the modern injection / SSR APIs land cleanly in 17+; supporting older versions doubles the desugarer surface and is deferred.
7. **AngularJS (Angular 1.x).** Out of scope; AngularJS is a different framework with a separate end-of-life trajectory.
8. **An Angular-native generator.** Out of scope for v0.1. PRD-409 (standalone CLI) is the documented integration route. A future PRD (e.g., a `PRD-410` Analog or `PRD-411` Angular Universal generator) would land in v0.2.
9. **Defining a React-flavoured or Vue-flavoured equivalent.** PRD-301 / PRD-302 own those.
10. **JSON Schemas under `schemas/303/`.** PRD-303 emits PRD-100 / PRD-102 envelopes. No new schemas.

### Stakeholders / audience

- **Authors of:** PRD-409 (standalone CLI when running over an Angular app); a future Angular generator (out of v0.1 scope). Indirectly: anyone authoring an Angular Universal app that wants ACT support without writing their own extractor.
- **Reviewers required:** Jeremy Forsythe (BDFL).

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| The service-based pattern (`ActContractService.register({...})`) is invoked from a constructor and re-runs per instance, producing duplicates | High | High | PRD-303-R8 mandates the service is registration-only; the collector dedupes via a per-component-instance key (the component class plus its `ɵcmp` definition pointer). `extract` runs once after SSR completes per PRD-300-R4. |
| Static-field detection misses Angular's tree-shakeable component metadata layout | Medium | Medium | PRD-303-R3 documents the static-field expectation: `static act: ActContract<P>` is a class member that survives Angular's compiler transformations, including the Ivy compilation pipeline's tree-shaking. The static-AST scanner uses `@angular/compiler-cli`'s `Decorator` / `ClassMemberDeclaration` introspection to find the field. |
| `@angular/platform-server.renderApplication` resolves before all `APP_INITIALIZER` providers settle | Low | High | PRD-303-R10 awaits Angular's `ApplicationRef.isStable` Observable's first `true` emission before yielding collected contracts; this is the documented "all-async-bootstrap-work-complete" signal. Per PRD-300-R31 streaming-equivalent semantics. |
| The structural directive `*actSection="contract"` has no obvious anchor for nested page boundaries | Low | Low | PRD-303-R11 forbids nested page-level contracts per PRD-300-R13: the directive emits a build error if used inside a subtree that already has an enclosing page-level `*actSection`. Same as the React/Vue rules. |
| Angular's hierarchical injection makes "scope per render" subtle — a singleton-provided service leaks state across SSR runs | Medium | High | PRD-303-R7 mandates the binding installs the collector at the `Component`-level (`providers: [ActCollectorService]`) per the binding's bootstrap, never at root. PRD-303-R10's render path creates a fresh injector tree per route per variant. |
| The compiler-API static-AST scanner is heavy (full TS program build) compared to React's Babel plugin | Medium | Low | Documented behaviour: SSR-walk is canonical; static-AST is opt-in. The binding's static-AST mode pays the compiler-API cost only when explicitly selected. |
| No paired generator means the binding ships untested against a real build pipeline | High | Medium | PRD-303-R23 mandates `@act/angular`'s tests include integration with PRD-409 (standalone CLI) plus a fixture Angular Universal app. Goal 9 acknowledges the v0.1 limitation. |

### Open questions

1. ~~Should the structural directive be `*actSection` (template-side) or a component `<act-section>` (component-side)?~~ **Resolved (2026-05-01): Ship both.** The structural directive is preferred for in-template page boundaries; the component form is preferred for layout components that wrap routed content. PRD-303-R5 already pins both. The directive name `actSection` (camelCase per Angular conventions) is reserved at the spec layer. (Closes Open Question 1.)
2. ~~Should the binding ship a decorator (`@ActContract({...})`) atop the `static act` field for ergonomics?~~ **Resolved (2026-05-01): No.** Angular's decorator metadata is tied to the compiler; a custom decorator would require either a binding-side compiler hook or `experimentalDecorators` reflection metadata, which Angular is deprecating. The `static act` form works without compiler hooks and is the canonical pattern. Adding a decorator pattern later is MINOR per the Versioning table. (Closes Open Question 2.)
3. ~~Should the binding require standalone components (Angular 17+) and refuse NgModule apps?~~ **Resolved (2026-05-01): Support both, standalone preferred.** PRD-303-R22's `module` field accepts either a standalone-component bootstrap or an `NgModule` reference. The static-AST scanner handles both forms. Standalone is preferred because Angular 17+ defaults to it and the binding's collector scope rules (PRD-303-R7) compose more cleanly with standalone providers. (Closes Open Question 3.)
4. ~~Should the binding ship a paired Analog generator in v0.1?~~ **Resolved (2026-05-01): No, deferred to v0.2.** Per Goal 9, no Angular-native generator ships in v0.1; PRD-409 (standalone CLI) is the documented integration route. Analog is a candidate for the first v0.2 Angular generator. (Closes Open Question 4.)

### Acceptance criteria

- [ ] Every requirement carries an ID `PRD-303-R{n}` and a conformance level (Core / Standard / Plus per PRD-107).
- [ ] The Specification section opens with a table of parent (PRD-300) + 100-series requirements implemented.
- [ ] Implementation notes section ships ~3–6 short TS snippets: declaration patterns (static field + service + directive), the collector service, the SSR-walk extraction skeleton, the capability declaration, the variant replay loop adapted for Angular.
- [ ] Test fixtures enumerated under `fixtures/303/positive/` and `fixtures/303/negative/`; fixture files NOT created in this PRD.
- [ ] No JSON Schemas under `schemas/303/`.
- [ ] Cites PRD-300, PRD-100, PRD-102, PRD-107, PRD-108, PRD-109. Acknowledges Q3 (TS-only).
- [ ] The "no v0.1 paired generator" limitation is called out in the preamble (Goal 9) and in §Implementation notes.
- [ ] Changelog entry dated 2026-05-01 by Jeremy Forsythe is present.

---

## Context & dependencies

### Depends on

- **PRD-300 (In review):** the parent component contract. PRD-303 implements PRD-300's contract for Angular. Cited per requirement.
- **PRD-100 (Accepted):** wire format. The binding emits node and block envelopes per PRD-100-R10, R21–R23, R28–R31.
- **PRD-102 (Accepted):** content blocks. The binding emits blocks satisfying R1–R11; component-extracted blocks set `metadata.extracted_via: "component-contract"` per PRD-102-R21; placeholders per R22; partial extractions per R23; variants per R29–R32.
- **PRD-107 (Accepted):** conformance bands.
- **PRD-108 (Accepted):** versioning policy.
- **PRD-109 (Accepted):** security posture.
- **000-decisions-needed.md Q3:** TypeScript-only first-party reference impls. `@act/angular` ships as a TS package per Q3.
- External: [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119), [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174). Angular 17+ documentation for `@angular/platform-server` (`renderApplication`, `renderModule`), `@angular/core` (`inject`, `Injectable`, `ApplicationRef`, `EnvironmentInjector`, `runInInjectionContext`), standalone components, structural directives. The `@angular/compiler-cli` / `ts-morph`-style introspection APIs (informational reference for static-AST scanning).

### Blocks

- **PRD-409** (standalone CLI) — the documented v0.1 integration route for Angular apps; consumes `@act/angular.extractRoute()`.

(No other 400-series generator currently depends on PRD-303 in v0.1 per the index. A future Angular-native generator would block on PRD-303 once authored.)

### References

- v0.1 draft: §3.1 (component-driven critique), §5.11.1 (three declaration patterns — generic), §5.11.2 (page-level contracts), §5.11.3 (build-time extraction strategies), §5.11.4 (variant handling), §5.11.5 (Vue and Angular note), §7.3 (SPA-specific pipelines), §8.5 (no-SSR SPA fallback).
- `prd/300-component-contract.md` R1–R32.
- `prd/102-content-blocks.md` R1–R11 (block taxonomy), R21 (`extracted_via`), R22 (placeholder), R23 (partial extraction), R24 (block ordering), R29–R32 (variant convention).
- `prd/100-wire-format.md` R10, R21–R23, R25, R28–R31.
- `prd/107-conformance-levels.md` R6 / R8 / R10.
- `prd/108-versioning-policy.md` R4 / R5 / R7.
- Prior art: Angular Universal (`@nguniversal/express-engine` and the modern `@angular/ssr`); Angular's structural-directive pattern (`*ngIf`, `*ngFor`); the `@angular/compiler-cli`'s decorator-introspection API; Analog's file-based routing (informational, for the future generator).

---

## Specification

This is the normative section. Everything below uses RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) where requirements are imposed. Lowercase "must" and "should" are non-normative prose.

### Parent + 100-series requirements implemented

This binding implements PRD-300's contract for Angular. The table below maps each PRD-303 requirement back to the parent (PRD-300) and 100-series rules it satisfies.

| Parent / 100-series requirement | What it pins | Where PRD-303 enforces |
|---|---|---|
| PRD-300-R2 (canonical contract object) | `{type, id?, summary?, related?, variants?, contract_version, extract}` | PRD-303-R3, R4, R5 (each Angular pattern desugars to this object) |
| PRD-300-R3 (three patterns equivalent) | Field / hook / decorator desugar identically | PRD-303-R6 (the static field, service registration, and structural directive patterns desugar through the same internal core) |
| PRD-300-R4 (`extract` once per instance/variant) | Service registration is registration-only | PRD-303-R8 (binding dedupes via component-instance key; `extract` invoked once after render) |
| PRD-300-R7 (`extract` is sync) | Sync return only | PRD-303-R9 (binding rejects async extracts; emits placeholder per PRD-300-R22) |
| PRD-300-R9 (depth-first render-order aggregation) | Page-level walk | PRD-303-R10 (SSR walk uses Angular's render order; collector records contract registration order = depth-first render order in Angular's SSR pipeline) |
| PRD-300-R13 (no nested page contracts) | Pages don't nest | PRD-303-R11 (the structural directive emits a build error when nested) |
| PRD-300-R15–R19 (variant emission) | Replay per variant | PRD-303-R13 (variant replay creates a fresh injector tree per variant key) |
| PRD-300-R20 (envelope satisfaction) | Block discriminator, REQUIRED fields | PRD-303-R14 (binding validates each block before emitting) |
| PRD-300-R21 (`metadata.extracted_via` set automatically) | Binding-owned metadata | PRD-303-R14 (binding stamps every block) |
| PRD-300-R22 (placeholder on failure) | `marketing:placeholder` block + warning | PRD-303-R16 (binding wraps `extract` and Angular render in error handlers; emits placeholder; warns the generator) |
| PRD-300-R28 (capability declaration) | Static `BindingCapabilities` | PRD-303-R20 |
| PRD-300-R29 (`metadata.extraction_method`) | SSR-walk / static-ast | PRD-303-R15 |
| PRD-300-R30 (RSC walks server tree only) | Server-only walk | n/a — Angular has no RSC equivalent; binding sets `rsc: false` |
| PRD-300-R31 (streaming completion) | Wait for stable signal | PRD-303-R10 (binding awaits `ApplicationRef.isStable` first-`true` emission) |
| PRD-300-R32 (no PII / request-scoped data in `extract`) | Build-time props only | PRD-303-R17 |
| PRD-100-R10 / R11 (ID grammar / byte cap) | Per-node IDs | PRD-303-R7 |
| PRD-100-R21 / R28–R31 (envelope shape, block discriminator) | Output validity | PRD-303-R14 |
| PRD-102-R21 (`metadata.extracted_via`) | Component-extracted marker | PRD-303-R14 |
| PRD-102-R22 / R23 (placeholder / partial) | Failure modes | PRD-303-R16 |

### Conformance level

Per PRD-107, requirements in this PRD band as follows.

- **Core:** PRD-303-R1, R2, R3, R5, R6, R7, R8, R9, R10, R11, R14, R16, R20, R22.
- **Standard:** PRD-303-R4, R17, R18, R19, R21, R23.
- **Plus:** PRD-303-R13, R15, R24, R25.

A binding declaring Plus satisfies Standard and Core by additivity (PRD-107-R11).

### Normative requirements

#### Package surface

**PRD-303-R1.** The Angular binding MUST be published as the npm package `@act/angular`. The package MUST export the symbols required by PRD-300-R28's `ActBinding` interface — at minimum: a `name` (the string `"@act/angular"`), a `contractVersion` matching `^[0-9]+\.[0-9]+$`, a `capabilities` const, and an `extractRoute(input)` async function. Conformance: **Core**.

**PRD-303-R2.** The binding's package MUST declare Angular 17.x or higher as a peer dependency. Angular 16 and earlier are out of scope for v0.1; the binding MUST emit a build error if instantiated against Angular < 17.0 detected via `VERSION.major` (read from `@angular/core`). AngularJS (Angular 1.x) is out of scope and the binding MUST NOT install on it. Conformance: **Core**.

#### Declaration patterns

**PRD-303-R3.** The binding MUST recognize the **component static-field declaration pattern**: an Angular component class declares a `static act: ActContract<P>` member whose value conforms to PRD-300-R2. Example: `@Component({...}) class HeroComponent { static act: ActContract<HeroProps> = {...}; }`. The static-field form survives Angular's Ivy compilation pipeline and is the canonical declaration source. The binding's desugarer MUST treat the static field as the canonical declaration for that component. Conformance: **Core**.

**PRD-303-R4.** The binding MUST recognize the **service-based declaration pattern**: a component injects `ActContractService` (provided by the binding) and calls `service.register(contract)` during construction. The binding's collector MUST capture the contract at registration time and associate it with the component's instance via the component class plus the instance handle. Per PRD-300-R4, `service.register()` is registration-only — `extract` MUST NOT be invoked from inside `register()`; the binding invokes `extract` after SSR render completion. Conformance: **Standard**.

**PRD-303-R5.** The binding MUST recognize the **structural directive declaration pattern** for page-level boundaries: `*actSection="contract"` (or the component-form `<act-section [contract]="...">`) where `contract` resolves to a `PageContract` per PRD-300. The directive captures the page contract on its host element's lifecycle init and provides the collector scope to its descendants. The directive form is preferred for routes that aren't standalone components (e.g., a layout component owning its page scope); the static-field form `static act` on a route component is preferred for standalone-component routes.

The binding MUST NOT permit the directive to nest: `*actSection` inside a subtree that already has an enclosing `*actSection` MUST cause a build error per PRD-303-R11 / PRD-300-R13.

Conformance: **Core**.

**PRD-303-R6.** All Angular declaration surfaces (component static field, service `register()` call, structural directive, component form) MUST desugar to the same internal `ActContract<P>` shape per PRD-300-R3 and pass through the same internal traversal. The binding's tests MUST include the equivalence fixtures enumerated in `fixtures/303/positive/`. Output across the surface forms MUST be byte-identical given identical authored inputs. Conformance: **Core**.

#### Page-level extraction

**PRD-303-R7.** When the generator invokes `extractRoute(input)` with a page-level contract whose `id` violates PRD-100-R10 (grammar) or PRD-100-R11 (byte length), the binding MUST surface the violation as a build error per PRD-300-R10 and skip the route. No placeholder applies at page level. The error MUST cite the route's source file and line where the page contract is declared, when known. The binding MUST install the `ActCollectorService` at the **component-level providers** (`providers: [ActCollectorService]`) of its bootstrap component, never at root, so per-render state cannot leak across SSR runs. Conformance: **Core**.

**PRD-303-R8.** During SSR walk, the binding MUST guarantee `extract` for any registered contract runs **at most once per (component instance, variant)** tuple per PRD-300-R4. The implementation MUST use a per-render scratchpad keyed by the component class plus the instance handle (Angular's component-tree position is the canonical instance identifier in the absence of a public Fiber-equivalent); the service's `register()` method MUST NOT invoke `extract`. Conformance: **Core**.

**PRD-303-R9.** The binding MUST detect a `Promise`-returning `extract` per PRD-300-R7 and emit a placeholder per PRD-300-R22. The detection MUST use a `then`-method check on the returned value, not solely `instanceof Promise`. Conformance: **Core**.

**PRD-303-R10.** SSR-walk extraction MUST aggregate descendant contracts in **render order, top-to-bottom, depth-first** per PRD-300-R9 / PRD-102-R24. The collector MUST record contract registration in the order Angular's SSR pipeline traverses the component tree. The binding MUST await `ApplicationRef.isStable`'s first `true` emission before yielding collected contracts; this is the documented "all-async-bootstrap-work-complete" signal in Angular and satisfies PRD-300-R31's streaming-completion requirement for frameworks without a stream API. The binding MUST NOT reorder, deduplicate, or skip blocks based on visual presentation. Conformance: **Core**.

**PRD-303-R11.** Nested page-level contracts (a route subtree containing a second `*actSection` or a route-component with `static act` whose subtree contains another route-component with `static act`) MUST cause a build error per PRD-300-R13. Pages do not nest; sub-pages are separate routes with their own page-level contracts. The binding's collector detects nesting at registration time and surfaces the error before SSR completion. Conformance: **Core**.

> **R12 reserved.** PRD-303 deliberately skips R12 to mirror PRD-301-R12 (the RSC server-tree-only walk). Angular has no first-class RSC equivalent in v0.1 (per PRD-303-R20: `rsc: false`); when an Angular RSC-equivalent ships, its requirement will pick up the R12 slot without renumbering downstream rules.

#### Variant handling

**PRD-303-R13.** When a page-level contract declares `variants` other than `"default"`, the binding MUST replay the SSR walk once per declared variant key, supplying `ctx.variant` set to each key per PRD-300-R15. Each replay MUST instantiate a fresh `ApplicationRef` and a fresh `EnvironmentInjector` (Angular's term for the route-scoped injector tree); the binding MUST NOT reuse the canonical render's collected contracts for variant emission. The variant matrix MUST be capped at 64 per PRD-300-R17; the binding emits a build error above the cap. Conformance: **Plus**.

#### Extraction guarantees

**PRD-303-R14.** Every block emitted by the Angular binding MUST satisfy PRD-300-R20: PRD-100-R28 (block discriminator), PRD-100-R29 (core block types), PRD-100-R30 (`marketing:*` namespace regex), PRD-102-R1–R11 (per-type schemas). The binding MUST validate each block against these constraints **before** emitting; any violation produces a placeholder per PRD-300-R22 and a build warning. The binding MUST stamp every emitted block with `metadata.extracted_via: "component-contract"` per PRD-300-R21 / PRD-102-R21; an `extract` whose output already carries `metadata.extracted_via` set to a different value is rejected and substituted with a placeholder per PRD-300-R21. Conformance: **Core**.

**PRD-303-R15.** Every block emitted MUST carry `metadata.extraction_method` per PRD-300-R29 reflecting the actual mode used for that pass: `"ssr-walk"` or `"static-ast"`. The Angular binding does not ship a headless-render mode in v0.1. Conformance: **Plus**.

#### Failure modes

**PRD-303-R16.** Every Angular-side failure during extraction — a component throwing during construction or change detection, an `extract` throwing, an `extract` returning malformed output, an `extract` returning a Promise per PRD-303-R9, the structural directive used outside an installed `ActCollectorService` scope, the service called outside an injection context, a block failing PRD-100/PRD-102 validation per PRD-303-R14 — MUST produce a `marketing:placeholder` block per PRD-300-R22 with the metadata fields PRD-300-R22 enumerates. The binding MUST install Angular's `ErrorHandler` provider to capture render and lifecycle errors so render continues past the failed component and descendants can still contribute their contracts. Conformance: **Core**.

#### Security

**PRD-303-R17.** The binding MUST NOT pass request-scoped or user-scoped data into `extract` per PRD-300-R32 / PRD-109. The binding's `extractRoute(input)` reads `routeProps` from the generator's static-data resolver; the binding MUST NOT read from per-request injection tokens (e.g., a custom `REQUEST` token in Angular Universal that exposes the underlying `IncomingMessage`) inside `extract`. Authors writing `extract` functions MUST treat the props as build-time-only. Conformance: **Standard**.

**PRD-303-R18.** When the binding is invoked under a hypothetical headless-render mode (not shipped in v0.1; reserved for v0.2), network access from the rendered tree MUST be allowlist-gated by the generator. (Reserved for forward-compat; no normative effect in v0.1.) Conformance: **Standard**.

**PRD-303-R19.** The binding MUST truncate `metadata.error` to ≤ 200 characters and redact strings matching the secret patterns enumerated in PRD-300-R32 (v0.1 set: `Bearer `, `sk_live_[A-Za-z0-9]+`, `AKIA[A-Z0-9]{16}`, `ghp_[A-Za-z0-9]{36}`, `xoxb-[A-Za-z0-9-]+`) before emitting placeholder blocks. The binding MUST NOT include raw stack traces in `metadata.error`; only the `Error.message` (truncated, redacted) is emitted. The pattern set is owned by PRD-300; the binding inherits any additions. Conformance: **Standard**.

#### Capability declaration

**PRD-303-R20.** The binding MUST publish a static `capabilities: BindingCapabilities` const at its package boundary per PRD-300-R28, with the following values for v0.1 of `@act/angular`:

| Flag | Value | Rationale |
|---|---|---|
| `ssr-walk` | `true` | The canonical mode; `@angular/platform-server.renderApplication` is the workhorse for the SSR walk. |
| `static-ast` | `true` | The `@angular/compiler-cli`-driven scanner supports static-AST scanning for `@Component` decorator metadata, `static act` field assignments, and template-side `*actSection` directive arguments where the bound expression is statically resolvable. Computed expressions produce no contract; SSR-walk is the fallback. |
| `headless-render` | `false` | Not shipped in v0.1. Angular Universal SSR is the canonical path. |
| `rsc` | `false` | Angular has no first-class RSC equivalent in v0.1. The flag is reserved for a future Angular feature. |
| `streaming` | `false` | Angular's SSR pipeline does not expose a public streaming API in v0.1; `renderApplication` returns a fully-rendered string. The binding's "wait for stable" behaviour (PRD-303-R10) satisfies PRD-300-R31 even with `streaming: false`. |
| `suspense` | `false` | No first-class equivalent in Angular's public API in v0.1. (Angular's `defer` block is template-side and resolves before `isStable` emits.) |
| `concurrent` | `true` | The binding is safe to invoke concurrently across distinct routes; per-route state uses a fresh `ApplicationRef` plus a fresh `EnvironmentInjector` per render. |

The binding MUST set every flag truthfully (PRD-300-R28). Adding a flag is MINOR per PRD-108-R4(5); removing one is MAJOR per PRD-108-R5(5). Conformance: **Core**.

**PRD-303-R21.** The binding MUST publish its `contractVersion` as a string matching PRD-300-R26's `^[0-9]+\.[0-9]+$`. The v0.1 binding MUST publish `contractVersion: "0.1"`. Conformance: **Standard**.

#### Generator integration

**PRD-303-R22.** The binding MUST expose `extractRoute(input: ExtractRouteInput): Promise<NodeDraft[]>` per PRD-300's interface signature. The `module` field of `ExtractRouteInput` is the route's bootstrap component (standalone form) or the route's `NgModule` reference (legacy form); the `routeProps` field is the build-time-resolved input bindings the generator supplies; `locale` and `variant` come from the generator per PRD-104 and PRD-300-R15. Conformance: **Core**.

**PRD-303-R23.** The binding's output `NodeDraft[]` MUST satisfy PRD-300's `NodeDraft` shape. The generator (when authored — see Goal 9) supplies `act_version` and `etag` per PRD-100. The binding MUST NOT supply `act_version` or `etag`; supplying them is a binding-side error and the generator MUST overwrite. The binding's test suite MUST include integration tests against PRD-409 (standalone CLI) running over a fixture Angular Universal app, since no Angular-native generator ships in v0.1. Conformance: **Standard**.

#### Static-AST extraction

**PRD-303-R24.** When the generator dispatches under `static-ast` mode, the binding's static scanner MUST recognize: (a) a class declaration carrying a `static act = { object literal }` member where the literal is fully resolvable at parse time; (b) a constructor body invoking `<service>.register({ object literal })` where the literal is fully resolvable and the service is identifiable as `ActContractService` by import-trace; (c) a template using `*actSection="<expression>"` where the expression resolves to a class member that is itself a static literal. The scanner MUST emit no contract for declarations whose `extract` function references runtime values that the AST cannot resolve. Per PRD-300-R28 the static-AST capability is partial extraction by design. Conformance: **Plus**.

**PRD-303-R25.** Under `static-ast` mode, the binding MUST stamp every emitted block with `metadata.extraction_method: "static-ast"` per PRD-300-R29. The generator's `--mode` flag (per PRD-400) selects between SSR-walk and static-AST; the binding does not auto-fall-back from SSR-walk to static-AST, but MAY emit a build warning when the SSR-walk path produced fewer blocks than the static-AST path would have. Conformance: **Plus**.

### Wire format / interface definition

PRD-303 is an **interface PRD**, not a wire-format PRD. The wire envelope is the PRD-100 node envelope; the binding's interface satisfies PRD-300's `ActBinding` signature. No JSON Schemas under `schemas/303/`.

#### Angular-specific declaration types

```ts
// @act/angular/src/types.ts
import type { Type } from "@angular/core";
import type { ActContract, PageContract } from "@act/core";

/** Static-field pattern. The component class carries a `static act` member. */
export type AngularComponentWithAct<P> = Type<unknown> & {
  act?: ActContract<P>;
};

/** The collector service (provided component-locally; never at root). */
export declare class ActContractService {
  register<P = unknown>(contract: ActContract<P>): void;
}
export declare class ActCollectorService { /* internal — owns the per-render state */ }

/** The structural directive for page-level boundaries. */
export declare class ActSectionDirective {
  // Selector: '[actSection]'
  // @Input() actSection!: PageContract;
}

/** The component form for layouts that prefer a wrapping element. */
export declare class ActSectionComponent {
  // Selector: 'act-section'
  // @Input() contract!: PageContract;
  // <ng-content></ng-content>
}
```

#### The binding export

```ts
// @act/angular/src/binding.ts
import type { ActBinding, BindingCapabilities, ExtractRouteInput, NodeDraft } from "@act/core";

const capabilities: BindingCapabilities = {
  "ssr-walk": true,
  "static-ast": true,
  "headless-render": false,
  rsc: false,
  streaming: false,
  suspense: false,
  concurrent: true,
};

export const angularBinding: ActBinding = {
  name: "@act/angular",
  contractVersion: "0.1",
  capabilities,
  async extractRoute(input: ExtractRouteInput): Promise<NodeDraft[]> {
    // Implementation per PRD-303-R10 / R13 / R14 / R16. See Implementation notes.
    throw new Error("see Implementation notes");
  },
};
```

### Errors

The binding surfaces errors as build warnings or build errors per PRD-300-R22. The wire envelope (PRD-100 / PRD-102) is unaffected: failures emit placeholder blocks per PRD-102-R22.

| Condition | Binding response | Generator finding |
|---|---|---|
| `extract` throws | Placeholder per R16 + R14 + PRD-300-R22; warn | Build warning; exit non-zero if `--fail-on-extraction-error` |
| Component throws during construction or change detection | Capture via `ErrorHandler` provider; emit placeholder; continue render | Build warning |
| `extract` returns Promise | Placeholder per R9 + R16 | Build warning |
| `extract` returns block missing REQUIRED fields | Placeholder per R14 | Build warning |
| Block uses `marketing:*` with invalid suffix | Placeholder per R14 | Build warning |
| Service `register()` called outside an injection context | Placeholder per R16 | Build warning |
| `*actSection` directive used outside an installed collector scope | Placeholder per R16 | Build warning |
| `*actSection` nested inside another `*actSection` | Build error per R11 + PRD-300-R13 | Build error |
| Page-level `id` violates PRD-100-R10 / R11 | Skip route per R7; log location | Build error |
| Two page-level contracts share `id` | Build error per PRD-300-R11 | Build error |
| Angular < 17 detected | Build error per R2 | Build error |
| Variant matrix > 64 | Build error per R13 + PRD-300-R17 | Build error |
| `metadata.error` > 200 chars or matches secret pattern | Truncate / redact per R19 | Normal (placeholder still emitted) |
| `ApplicationRef.isStable` never emits `true` (e.g., a runaway zone task) | Binding times out after the generator's configured deadline; emits the partial contracts; warns | Build warning |
| `contract_version` MAJOR exceeds binding's MAJOR | Build error per PRD-300-R27 | Build error |
| Binding supplies `act_version` or `etag` | Generator overwrites per R23 | Normal |

PRD-300 owns the canonical error contract; the rows above are Angular-specific instantiations.

---

## Examples

Examples are non-normative but consistent with the Specification section.

### Example 1 — Static-field declaration on an Angular standalone component

```ts
// design-system/hero.component.ts
import { Component, Input } from "@angular/core";
import type { ActContract } from "@act/core";

interface HeroProps { title: string; subtitle: string; ctaText?: string; ctaUrl?: string; }

@Component({
  selector: "app-hero",
  standalone: true,
  template: `<section class="hero"><!-- ... --></section>`,
})
export class HeroComponent {
  @Input() title!: string;
  @Input() subtitle!: string;
  @Input() ctaText?: string;
  @Input() ctaUrl?: string;

  static act: ActContract<HeroProps> = {
    type: "marketing:hero",
    contract_version: "0.1",
    extract: (props) => ({
      type: "marketing:hero",
      headline: props.title,
      subhead: props.subtitle,
      cta: props.ctaText ? { label: props.ctaText, href: props.ctaUrl ?? "#" } : undefined,
    }),
  };
}
```

The `@act/angular` desugarer (per PRD-303-R3) lifts `HeroComponent.act` to PRD-300-R2's canonical shape.

### Example 2 — Service-based declaration

```ts
// design-system/pricing-table.component.ts
import { Component, Input, inject } from "@angular/core";
import { ActContractService } from "@act/angular";

interface Tier { name: string; price: string; features: string[]; }

@Component({
  selector: "app-pricing-table",
  standalone: true,
  template: `<div class="pricing"><!-- ... --></div>`,
})
export class PricingTableComponent {
  @Input() tiers!: Tier[];
  private readonly contracts = inject(ActContractService);

  constructor() {
    this.contracts.register({
      type: "marketing:pricing-table",
      contract_version: "0.1",
      extract: () => ({
        type: "marketing:pricing-table",
        tiers: this.tiers.map(t => ({ name: t.name, price: t.price, features: t.features })),
      }),
    });
  }
}
```

Per PRD-303-R4 + R8, the service registers the contract; `extract` runs once after the SSR walk completes.

### Example 3 — Page-level boundary via the structural directive

```ts
// pages/pricing/pricing.component.ts
import { Component } from "@angular/core";
import { ActSectionDirective } from "@act/angular";
import type { PageContract } from "@act/core";

const pricingPageContract: PageContract = {
  type: "landing",
  id: "pricing",
  contract_version: "0.1",
  summary: "Acme pricing tiers and plan comparison.",
  related: [
    { id: "products", relation: "see-also" },
    { id: "contact", relation: "see-also" },
  ],
  extract: () => ({ type: "landing" }),
};

@Component({
  selector: "app-pricing-page",
  standalone: true,
  imports: [ActSectionDirective, /* HeroComponent, PricingTableComponent, FAQAccordionComponent */],
  template: `
    <ng-container *actSection="contract">
      <app-hero [title]="'Pricing'" [subtitle]="'Plans that scale with you'" [ctaText]="'Start free'" [ctaUrl]="'/signup'" />
      <app-pricing-table [tiers]="tiers" />
      <app-faq-accordion [items]="faqs" />
    </ng-container>
  `,
})
export class PricingPageComponent {
  contract = pricingPageContract;
  tiers = [/* ... */];
  faqs = [/* ... */];
}
```

PRD-409 (standalone CLI) reads the route's bootstrap component, calls `angularBinding.extractRoute({ routeId: "pricing", module: PricingPageComponent, routeProps: {}, locale: undefined, variant: undefined })`, and the binding aggregates Hero / PricingTable / FAQAccordion per PRD-303-R10.

### Example 4 — Page-level boundary via static field on a route component

```ts
// pages/pricing/pricing.component.ts
@Component({
  selector: "app-pricing-page",
  standalone: true,
  /* ... */
})
export class PricingPageComponent {
  static act = {
    type: "landing",
    id: "pricing",
    contract_version: "0.1",
    summary: "Acme pricing tiers and plan comparison.",
    extract: () => ({ type: "landing" }),
  } as const;
  /* ... */
}
```

Per PRD-303-R5, both the directive form and the static-field form are supported equivalently.

### Example 5 — Variant emission

```ts
const pricingPageContract: PageContract = {
  type: "landing",
  id: "pricing",
  contract_version: "0.1",
  variants: ["enterprise-2026q2"],
  summary: "Acme pricing tiers and plan comparison.",
  extract: () => ({ type: "landing" }),
};
```

Per PRD-303-R13, the binding renders the route twice — canonical and `ctx.variant: "enterprise-2026q2"` — emitting:
- `pricing` (canonical, per PRD-102-R30).
- `pricing@enterprise-2026q2` with `metadata.variant: { base_id: "pricing", key: "enterprise-2026q2", source: "experiment" }` and `related: [{ id: "pricing", relation: "variant_of" }]` per PRD-102-R31 / R32.

### Example 6 — Failure mode (component throws in constructor)

If `HeroComponent`'s constructor throws (e.g., a CMS prop is missing), the binding's `ErrorHandler` provider catches it and emits:

```json
{
  "type": "marketing:placeholder",
  "metadata": {
    "extracted_via": "component-contract",
    "extraction_method": "ssr-walk",
    "extraction_status": "failed",
    "error": "Cannot read properties of undefined (reading 'title')",
    "component": "HeroComponent",
    "location": "design-system/hero.component.ts:14"
  }
}
```

per PRD-303-R16 + PRD-300-R22 + PRD-303-R19. The render continues past the failed component so PricingTable and FAQAccordion can still contribute.

---

## Test fixtures

Fixtures live under `fixtures/303/` and are exercised by `@act/angular`'s test suite plus PRD-600 (validator) for emitted output. Fixture files are NOT created in this PRD; the layout below is the surface.

### Positive

- `fixtures/303/positive/component-static-field.json` → satisfies R3, R6 (static field on component class desugars correctly).
- `fixtures/303/positive/component-service-register.json` → satisfies R4, R6, R8 (service registers; extract runs once).
- `fixtures/303/positive/page-boundary-directive-form.json` → satisfies R5, R6 (`*actSection` directive).
- `fixtures/303/positive/page-boundary-component-form.json` → satisfies R5, R6 (`<act-section>` component).
- `fixtures/303/positive/page-boundary-static-field-on-route-component.json` → satisfies R5, R6.
- `fixtures/303/positive/ssr-walk-aggregates-children.json` → satisfies R10 (depth-first render-order aggregation).
- `fixtures/303/positive/wait-for-isstable.json` → satisfies R10 (binding awaits `ApplicationRef.isStable` first-`true` emission).
- `fixtures/303/positive/variant-replay.json` → satisfies R13 (canonical + each variant emitted).
- `fixtures/303/positive/extracted-via-stamped.json` → satisfies R14 (`metadata.extracted_via: "component-contract"`).
- `fixtures/303/positive/extraction-method-ssr-walk.json` → satisfies R15 (`metadata.extraction_method: "ssr-walk"`).
- `fixtures/303/positive/extraction-method-static-ast.json` → satisfies R15, R24, R25 (static-AST stamps method correctly).
- `fixtures/303/positive/capability-declaration.json` → satisfies R20 (full capabilities const; rsc / streaming / suspense / headless-render are false).
- `fixtures/303/positive/contract-version-published.json` → satisfies R21.
- `fixtures/303/positive/extract-route-output-shape.json` → satisfies R22, R23.
- `fixtures/303/positive/standalone-cli-integration.json` → satisfies R23 (binding integrates with PRD-409 over a fixture Angular Universal app).

### Negative

- `fixtures/303/negative/angular-16-detected.json` → MUST cause a build error per R2.
- `fixtures/303/negative/extract-throws.json` → expected output is a placeholder per R16 + PRD-300-R22.
- `fixtures/303/negative/component-throws-constructor.json` → expected output is a placeholder for that component; descendants still contribute per R16.
- `fixtures/303/negative/extract-returns-promise.json` → expected output is a placeholder per R9 + R16.
- `fixtures/303/negative/extract-emits-malformed-block.json` → expected output is a placeholder per R14.
- `fixtures/303/negative/service-register-outside-injection-context.json` → expected output is a placeholder per R16.
- `fixtures/303/negative/directive-outside-collector-scope.json` → expected output is a placeholder per R16.
- `fixtures/303/negative/nested-actsection-directives.json` → MUST cause a build error per R11 + PRD-300-R13.
- `fixtures/303/negative/page-id-violates-grammar.json` → MUST cause a build error per R7 + PRD-100-R10.
- `fixtures/303/negative/page-id-collision.json` → MUST cause a build error per PRD-300-R11.
- `fixtures/303/negative/variant-matrix-exceeds-64.json` → MUST cause a build error per R13 + PRD-300-R17.
- `fixtures/303/negative/binding-supplies-act-version.json` → MUST cause the generator to overwrite per R23.
- `fixtures/303/negative/extracted-via-overridden-by-author.json` → expected output is a placeholder per R14 / PRD-300-R21.
- `fixtures/303/negative/error-message-with-secret.json` → expected output has `metadata.error` redacted per R19 / PRD-300-R32.
- `fixtures/303/negative/isstable-never-emits.json` → binding times out after the generator's deadline and emits the partial contracts with a build warning per the Errors table.
- `fixtures/303/negative/collector-provided-at-root.json` → MUST cause a build error per R7 (collector MUST be component-local, not root-level).

---

## Versioning & compatibility

Per PRD-108, classify each kind of change to PRD-303 as MAJOR or MINOR. The binding's package version follows MAJOR-pinned / MINOR-floating against PRD-300's `contract_version`.

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a new declaration pattern (e.g., a `@ActContract({...})` decorator form) | MINOR | Per PRD-108-R4(1). |
| Add a new option to `service.register()` (e.g., a `skip` flag) | MINOR | Per PRD-108-R4(1). |
| Add a capability flag to `capabilities` | MINOR | Per PRD-300-R28 + PRD-108-R4(5). |
| Bump the binding's supported Angular MAJOR (e.g., add Angular 18 support) | MINOR | Additive. |
| Drop Angular 17 support | MAJOR | Existing Angular 17 consumers break per PRD-108-R5(3). |
| Change the package name `@act/angular` | MAJOR | Per PRD-108-R5(1). |
| Change a capability flag's default value | MAJOR | Per PRD-108-R5(2). |
| Tighten the static-AST scanner's accepted patterns | MAJOR | Per PRD-108-R5(6). |
| Add a recognized pattern to the static-AST scanner | MINOR | Additive. |
| Promote `streaming` from `false` to `true` in `capabilities` (e.g., once Angular ships a public streaming SSR API) | MINOR | Additive — generators that depend on `streaming: true` start to take advantage; existing generators unaffected. |
| Promote `rsc` from `false` to `true` (once an Angular RSC equivalent ships) | MINOR | Additive. |
| Editorial / prose clarification with no normative effect | n/a | Per 000-governance R18. |

### Forward compatibility

Per PRD-108-R7, the binding tolerates unknown optional fields on contract objects authored against newer contract MINORs and unknown capability flags. A binding implementing contract `0.1` that receives a contract authored against `0.2` with a new optional `priority` field MUST tolerate the field per PRD-300-R27.

### Backward compatibility

Within a v0.1.x line:
- A v0.1 `@act/angular` binding's emitted `NodeDraft[]` is consumable by a v0.1 generator (PRD-409 standalone CLI in v0.1; future Angular generator in v0.2).
- A v0.2 binding emitting v0.2 contract output remains consumable by a v0.1 generator as long as the generator tolerates unknown optional fields per PRD-108-R7.
- A v0.1 binding consuming a contract authored against v0.2 (declaring `contract_version: "0.2"`) MUST tolerate per PRD-108-R7.

Across MAJOR boundaries (v0.x → v1.0), no backward compatibility is required.

---

## Security considerations

This section documents the security posture deltas PRD-303 introduces over PRD-300 and PRD-109.

**Build-time `extract` runs in the main JS context (PRD-300 §Security, gap D3).** The Angular binding does not sandbox `extract`. A malicious component contract can exfiltrate environment variables, read filesystem paths, or hang the build. Producers SHOULD review `extract` functions in their codebase the same way they review any other build-time code.

**Component-level provider scope (PRD-303-R7).** The collector service MUST be installed at the component-level (`providers: [ActCollectorService]` on the binding's bootstrap component), never at root. Installing at root would leak per-render state across SSR runs, producing non-deterministic extractions across builds. The binding's bootstrap helper enforces this; authors using the binding manually MUST follow the documented installation path.

**`metadata.error` truncation and secret redaction (PRD-303-R19).** Per PRD-300-R22 / PRD-300-R32 the binding truncates error messages to ≤200 characters and redacts strings matching the v0.1 secret-pattern set (`Bearer `, `sk_live_[A-Za-z0-9]+`, `AKIA[A-Z0-9]{16}`, `ghp_[A-Za-z0-9]{36}`, `xoxb-[A-Za-z0-9-]+`). The binding MUST NOT include raw stack traces in `metadata.error`; only the `Error.message` (truncated, redacted).

**`extract` MUST NOT receive request-scoped or user-scoped data (PRD-303-R17).** The contract surface is build-time-shaped per PRD-300-R8. The binding's `extractRoute(input)` reads `routeProps` from the generator's static-data resolver; the binding MUST NOT read from per-request injection tokens (e.g., a custom `REQUEST` token in Angular Universal) inside `extract`. Authors writing `extract` functions MUST treat the props as build-time-only.

**`isStable` deadline (PRD-303-R10 / Errors table).** The binding awaits `ApplicationRef.isStable` first-`true` emission, but a runaway zone task (a setInterval that never settles, an unsettled microtask) can prevent stability from emitting. The generator MUST supply a deadline; on timeout the binding emits whatever contracts it has collected plus a build warning. This is a denial-of-service mitigation for buggy or hostile component code.

**Capability declaration is a producer claim (PRD-300-R28).** The binding publishes capabilities; the generator trusts them. PRD-303 inherits this trust model.

**Variant correlation (PRD-300 §Security).** A producer that emits both the canonical and a variant node tied to a specific identity leaks the identity-to-variant mapping if both nodes are observable in the same index. PRD-300-R16's opt-in default mitigates accidental emission.

PRD-109 owns the project-wide posture; the rules above are Angular-specific deltas, not duplications.

---

## Implementation notes

**Caveat on integration.** Per Goal 9, no v0.1 leaf 400-series generator depends on PRD-303. The binding's documented integration path is via PRD-409 (standalone CLI) running over an Angular Universal app. The snippets below illustrate the binding's internal shape; a future Angular-native generator (deferred to v0.2) would consume the same `extractRoute()` API.

This section illustrates the canonical implementation shapes an Angular binding follows. Snippets are TypeScript per Q3.

### 1. Declaration patterns desugared through `@act/core`

```ts
// @act/angular/src/desugar.ts
import type { Type } from "@angular/core";
import type { ActContract } from "@act/core";
import { fromStaticField, registerHookContract } from "@act/core/desugar";

/** Pattern 1 — static field on the component class. */
export function pickStaticContract<P>(
  comp: Type<unknown> & { act?: ActContract<P> },
): ActContract<P> | undefined {
  return fromStaticField(comp);
}

/** Pattern 2 — service registration (registration-only; extract runs after SSR). */
import { Injectable, inject } from "@angular/core";
import { ActCollectorService } from "./collector";

@Injectable({ providedIn: "any" /* never "root" — see PRD-303-R7 */ })
export class ActContractService {
  private readonly collector = inject(ActCollectorService);
  register<P = unknown>(contract: ActContract<P>): void {
    this.collector.register(contract);          // dedupe via instance key
  }
}
```

### 2. The collector service for SSR walk

```ts
// @act/angular/src/collector.ts
import { Injectable, ErrorHandler } from "@angular/core";
import type { ActContract, PageContract } from "@act/core";

@Injectable({ providedIn: "any" })
export class ActCollectorService {
  pageContract?: PageContract;
  variant?: string;
  collected: Array<{ key: symbol; contract: ActContract<unknown> }> = [];

  register(contract: ActContract<unknown>) {
    const key = Symbol("act:instance");
    this.collected.push({ key, contract });
  }

  recordError(err: unknown, component?: string, location?: string) {
    // emits a placeholder per PRD-303-R16 / PRD-300-R22
  }
}

@Injectable()
export class ActErrorHandler implements ErrorHandler {
  constructor(private readonly collector: ActCollectorService) {}
  handleError(err: unknown): void {
    this.collector.recordError(err);
    // do NOT re-throw — render continues per PRD-303-R16
  }
}
```

### 3. The SSR-walk extraction skeleton (PRD-303-R10)

```ts
// @act/angular/src/extract.ts
import { renderApplication } from "@angular/platform-server";
import { ApplicationRef, EnvironmentInjector, ErrorHandler, importProvidersFrom } from "@angular/core";
import { firstValueFrom } from "rxjs";
import type { ExtractRouteInput, NodeDraft, ExtractionContext } from "@act/core";
import { aggregatePage } from "@act/core/traverse";
import { ActCollectorService, ActErrorHandler } from "./collector";

export async function extractRoute(input: ExtractRouteInput): Promise<NodeDraft[]> {
  const { module, routeProps, locale, variant } = input;
  const pageContract = readPageContract(module);          // PRD-303-R5
  validatePageId(pageContract);                            // PRD-303-R7

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
  rootComponent: any, pageContract: PageContract, routeProps: unknown,
  locale: string | undefined, variant: string | undefined,
): Promise<NodeDraft> {
  let collector!: ActCollectorService;

  await renderApplication(rootComponent, {
    document: "<app-root></app-root>",
    platformProviders: [
      { provide: ErrorHandler, useClass: ActErrorHandler },
      ActCollectorService,                    // component-local per PRD-303-R7
      ActContractService,
    ],
    appProviders: [
      // Inject pageContract / variant via tokens; the bootstrap reads them.
      { provide: PAGE_CONTRACT, useValue: pageContract },
      { provide: VARIANT, useValue: variant },
      { provide: ROUTE_PROPS, useValue: routeProps },
    ],
  });

  // After renderApplication resolves, ApplicationRef.isStable has emitted true at least once.
  // The collector now holds every register()-ed contract in render order (PRD-303-R10).
  // Fetch via DI lookup or the binding's well-known accessor (omitted for brevity).

  const ctx: ExtractionContext = {
    locale, variant, parentId: pageContract.id, binding: "@act/angular", warn,
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

### 4. The capability declaration (PRD-303-R20)

```ts
// @act/angular/src/capabilities.ts
import type { BindingCapabilities } from "@act/core";

export const capabilities: BindingCapabilities = {
  "ssr-walk": true,
  "static-ast": true,
  "headless-render": false,
  rsc: false,
  streaming: false,
  suspense: false,
  concurrent: true,
};
```

### 5. The structural directive (PRD-303-R5)

```ts
// @act/angular/src/act-section.directive.ts
import { Directive, Input, OnInit, inject } from "@angular/core";
import { ActCollectorService } from "./collector";
import type { PageContract } from "@act/core";

@Directive({
  selector: "[actSection]",
  standalone: true,
})
export class ActSectionDirective implements OnInit {
  @Input("actSection") contract!: PageContract;
  private readonly collector = inject(ActCollectorService);

  ngOnInit(): void {
    if (this.collector.pageContract) {
      // PRD-303-R11: pages do not nest.
      throw new BuildError(`*actSection nested inside another *actSection (PRD-300-R13)`);
    }
    this.collector.pageContract = this.contract;
  }
}
```

### 6. Static-AST scanner (PRD-303-R24 / R25)

```ts
// @act/angular/static-ast/src/scanner.ts
import * as ts from "typescript";

export function scanProgram(program: ts.Program, file: string): NodeDraft[] {
  const drafts: NodeDraft[] = [];
  const sf = program.getSourceFile(file);
  if (!sf) return drafts;
  ts.forEachChild(sf, function visit(node) {
    // (a) class decl with `static act = { object literal }`
    if (ts.isClassDeclaration(node)) {
      drafts.push(...findStaticActMember(node, file));
    }
    // (b) constructor body: `<service>.register({ object literal })` where service is ActContractService
    if (ts.isClassDeclaration(node)) {
      drafts.push(...findRegisterCallsInConstructor(node, file, program));
    }
    // (c) template-side `*actSection="..."` requires template parsing via @angular/compiler;
    //     covered by the binding's static-AST companion that walks `templateUrl` / inline templates.
    ts.forEachChild(node, visit);
  });
  return drafts.map(d => stampStaticAstMethod(d));         // PRD-303-R25
}
```

These snippets are illustrative; full implementation lives in `packages/angular/`. The shared `@act/core` package houses the framework-agnostic helpers PRD-300 specifies.

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-01 | Jeremy Forsythe | Initial draft. Pins the Angular binding's three idiomatic declaration patterns (component static-field `static act`; service-based via `ActContractService.register({...})`; structural directive `*actSection="contract"` and `<act-section>` component for page-level boundaries), the collector service installed at component-level (never root) per PRD-303-R7, the canonical SSR-walk extraction strategy via `@angular/platform-server.renderApplication` waiting for `ApplicationRef.isStable` (satisfying PRD-300-R31's streaming-completion requirement for frameworks without a stream API), the static-AST extraction option (`@angular/compiler-cli` / TypeScript-compiler-API-driven scanner) marked `metadata.extraction_method: "static-ast"`, the variant replay loop with fresh `ApplicationRef` + `EnvironmentInjector` per variant, the placeholder emission contract (truncated and secret-redacted error messages, captured via Angular's `ErrorHandler` provider), the package surface (`@act/angular`), the Angular 17+ floor (Angular 16 and earlier and AngularJS explicitly out of scope), the `BindingCapabilities` const (rsc / streaming / suspense / headless-render: false; ssr-walk / static-ast / concurrent: true), and a deliberate "no v0.1 paired generator" framing — the binding integrates via PRD-409 (standalone CLI) until an Angular-native generator lands in v0.2. Cites PRD-300 R1–R32, PRD-100 R10/R21–R31, PRD-102 R1–R11/R21–R32, PRD-107 R6/R8/R10, PRD-108 R4/R5/R7, PRD-109 (PII posture). Status: In review. |
| 2026-05-01 | Jeremy Forsythe | Open questions resolved post-review. Decisions: (1) ship both `*actSection` structural directive and `<act-section>` component — directive preferred in templates, component preferred in layout-wrapping contexts; (2) no `@ActContract` decorator pattern in v0.1 — `static act` form works without compiler hooks; adding the decorator later is MINOR; (3) support both standalone components (preferred) and `NgModule` apps; (4) no paired Analog generator in v0.1 — deferred to v0.2 per Goal 9. Ratified judgment calls: no v0.1 paired Angular generator (binding integrates via PRD-409 standalone CLI); `rsc: false` / `streaming: false` / `suspense: false` capability flags (no first-class Angular equivalents in v0.1). Added a one-line note at the R11→R13 jump documenting that R12 is reserved for a future Angular RSC-equivalent (mirrors PRD-301-R12). PRD-303-R19 secret-pattern set updated to track PRD-300-R32's broadened v0.1 set (adds `ghp_…` GitHub PAT and `xoxb-…` Slack bot token). |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
