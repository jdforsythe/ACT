# @act-spec/component-angular

PRD-303 Angular binding for the ACT v0.1 component contract (PRD-300).
Bridges Angular component trees to the framework-agnostic `NodeDraft`
shape exported by `@act-spec/component-contract`.

Implements the three Angular declaration patterns:

- component static field — `static act = { … }`,
- service-based — `ActContractService.register({ … })`,
- page-level boundary — `*actSection="contract"` structural directive
  or the `<act-section>` component form.

The `ActCollectorService` is provided component-locally (never `'root'`,
per PRD-303-R7) for SSR-walk extraction. The canonical SSR walker uses
`@angular/platform-server.renderApplication` and waits for
`ApplicationRef.isStable`. Variant replay constructs a fresh
`ApplicationRef` + `EnvironmentInjector` per variant. Render-time errors
surface through Angular's `ErrorHandler` provider as truncated +
secret-redacted placeholders. The `BindingCapabilities` const reflects
PRD-303-R20 + the A15 truthfulness amendment (only what v0.1 ships).

**Caveat (PRD-303 Goal 9).** No v0.1 leaf 400-series generator depends
on PRD-303. The documented integration path is via PRD-409
(`@act-spec/cli`) running over an Angular Universal app. A future
Angular-native generator (deferred to v0.2) would consume the same
`extractRoute()` API.

## Status

ACT v0.1 internal hand-test candidate. Public release lands at v0.2.

## Install

Unpublished in v0.1. Consume via the workspace:

```jsonc
// package.json
{ "dependencies": { "@act-spec/component-angular": "workspace:*" } }
```

## Usage

Static field on a component class:

```ts
import { Component } from '@angular/core';
import type { AngularComponentWithAct } from '@act-spec/component-angular';

@Component({ selector: 'pricing-table', templateUrl: './pricing.html' })
export class PricingTable implements AngularComponentWithAct {
  static act = {
    type: 'marketing:pricing',
    title: (p: Inputs) => p.heading,
    contentBlocks: (p: Inputs) => p.tiers.map(toBlock),
  };
}
```

Service-based registration:

```ts
import { Component, inject } from '@angular/core';
import { ActContractService } from '@act-spec/component-angular';

@Component({ selector: 'faq-section', templateUrl: './faq.html' })
export class FaqSection {
  private readonly act = inject(ActContractService);
  constructor() {
    this.act.register({
      type: 'marketing:faq',
      contentBlocks: () => this.items.map(toBlock),
    });
  }
}
```

Generators (PRD-409 CLI in v0.1) call `extractRoute`:

```ts
import { extractRoute, angularBinding } from '@act-spec/component-angular';

const drafts = await extractRoute({
  pageContract: { /* … */ },
  appModule: AppModule,
  variants: [/* … */],
});
```

## Conformance / what's tested

Every PRD-303-R{n} requirement has a citing test in the package's
test suite, including the Angular 17+ floor (`assertAngular17Plus`),
the collector scope check, contract-version pinning, and the
placeholder + redaction contract. The conformance gate runs
`@act-spec/validator` against the extracted nodes.

```bash
pnpm -F @act-spec/component-angular conformance
```

## Peer dependencies

| Peer | Range |
| --- | --- |
| `@angular/core` | `>=17 <21` |
| `@angular/platform-server` | `>=17 <21` |

Both peers are optional from npm's perspective; the binding only requires
them at extraction time.

## Links

- Leaf PRD: [`prd/303-angular-binding.md`](../../prd/303-angular-binding.md)
- Framework PRD: [`prd/300-component-contract.md`](../../prd/300-component-contract.md)
- Framework package: [`@act-spec/component-contract`](../component-contract)
- Repository: <https://github.com/act-spec/act>
