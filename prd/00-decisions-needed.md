# ACT Spec — Strategic Decisions Needed

This file lists strategic, positioning, and governance choices that the spec owner must make. Technical and wire-format gaps live in `prd/00-gaps-and-resolutions.md`. Each item below stays Open until a corresponding ADR is written. The intent is to make decisions visible, reviewable, and reversible — not to defer them indefinitely. Per ADR-0003 (Decision Philosophy), unresolved strategic questions block downstream PRDs from finalizing, so resolving these is a prerequisite for declaring v0.1 stable.

The questions here are the ones only the spec owner can answer. They concern positioning, naming, governance, licensing, partner selection, and the social contract with adopters. Engineers can implement around almost any technical ambiguity; they cannot pick the spec's name or its first design partner.

---

## How to resolve a decision

The workflow for closing out any item below is deliberately lightweight and append-only:

1. **Pick a decision** from the list. Read the options and the recommended default.
2. **Answer the question.** Either accept the recommendation or pick a different option (or propose a new one — the options are not exhaustive).
3. **Write `adr/NNNN-<slug>.md`** following `adr/0000-template.md`. The ADR captures context, the decision, and consequences. It is the canonical record; this file is just an index.
4. **Update the Status field** here from `Open` to `Decided in ADR-NNNN`. Fill in the resolution column at the bottom of this document.
5. **Update affected PRDs** to cite the ADR. PRDs should not duplicate the rationale — they should link to it.

Reversing a decision is the same workflow: write a new ADR that supersedes the old one, then update this index. Do not edit closed ADRs.

---

## The decisions

### D-01 — Spec governance model

**Question:** Who has final say on what goes into the ACT spec, and how does that authority evolve as the project matures?

**Why this matters:** Governance shapes velocity, credibility, and the size of the contributor pool. Get it wrong early and you either move too slowly to ship anything (committee paralysis) or scare off serious adopters who need to see a stable, multi-stakeholder process before betting their roadmap on you.

**Options:**

1. **Benevolent dictator (you) for v0.1–v0.5, small steering committee at v1.0** *(Recommended)* — Single decider while the spec is volatile and decisions are cheap to reverse. Transition to a 3–5 person steering committee once the wire format stabilizes and external implementers exist. Defer any foundation discussion (OpenJS, CNCF, OASIS) until post-v1.0. Trade-off: requires explicit handoff plan; reversal is high-effort once a committee forms.
2. **Small steering committee from day one** — 3–5 people, including yourself and one or two early design partners. Slower but more legitimate-looking to enterprise adopters. Trade-off: forces you to recruit committee members before you have leverage to attract good ones.
3. **IETF working group or W3C community group** — Maximum legitimacy, glacial pace. Appropriate only if you are willing to spend two years before v1.0. Trade-off: kills momentum; appropriate for protocols, overkill for a content spec at this stage.
4. **Independent foundation (OpenJS / CNCF / OASIS TC)** — Donate the spec to a neutral home. Strongest signal of vendor neutrality. Trade-off: premature; foundations want to inherit working projects, not bootstrap them.

**Recommended default:** Option 1. The spec is too young and the design space too unsettled to share authority. A single decider with a public ADR trail is faster and more honest than a committee that rubber-stamps your proposals. Plan the v1.0 handoff explicitly so it does not look like a power grab in retrospect.

**Affects:** ADR-0003 (decision philosophy), PRD-90 (governance), every PRD that requires a `Decided by:` field.

**Status:** Open

---

### D-02 — Spec name and branding

**Question:** Do we keep the name "ACT" given existing collisions, or rebrand before we have meaningful adoption?

**Why this matters:** "ACT" collides with Anthropic's Computer Use Tool messaging, several US federal acts, the ACT standardized test, and at least two existing npm packages. Renaming after v0.1 ships is expensive — adapters, READMEs, search rankings, and conference talks all carry the old name. Renaming before v0.1 is essentially free.

**Options:**

1. **Keep ACT, contingent on trademark and namespace availability** *(Recommended)* — Run a USPTO trademark search, an EUIPO search, and an `npm`/`pypi`/`crates.io`/`rubygems` availability check. If `act` is taken on npm (it is — currently a small CLI), reserve `@act-spec/*` scope instead. If trademark conflicts exist in the content/agent space, fall back to ACG. Trade-off: name has gravity already; collisions are manageable with scope discipline.
2. **Switch to ACG (Agent Content Graph)** — Less collision, weaker brand. "Graph" overpromises — the model is a tree with cross-links, not a general graph. Trade-off: more accurate to some users, less accurate to the data model.
3. **Switch to AGTREE** — Unambiguous, ugly, hard to say. Trade-off: nobody will love it but nobody will confuse it.
4. **One-week naming sprint with stakeholders** — Open the question to design partners and pick by vote. Trade-off: bikeshedding risk; delays v0.1.

**Recommended default:** Option 1, but do the availability checks this week and document the fallback to ACG explicitly. Name decisions get harder every month.

**Affects:** Every PRD, every README, the spec URL, the npm scope, the GitHub org name.

**Status:** Open

---

### D-03 — Reference implementation language strategy

**Question:** Which languages get first-class reference implementations at v0.1, and which are deferred?

**Why this matters:** Reference implementations are how a spec gets adopted. No reference implementation means every adopter writes their own and disagrees about edge cases. Too many reference implementations means you maintain N codebases and ship slowly. The first language you pick disproportionately shapes who adopts.

**Options:**

1. **TypeScript-first for SDK and generators; Python runtime SDK at v0.2** *(Recommended)* — TS covers Astro, Next.js, Docusaurus, Remix, Nuxt, SvelteKit, and most static-site generators in the target ecosystem (~80% by adoption). Python SDK at v0.2 unlocks FastAPI and Django for runtime profile. Ruby and Go deferred to community contribution or v0.3+. Trade-off: leaves Rails and Go-native shops without official support for 6+ months.
2. **Polyglot from day one (TS + Python + Ruby + Go)** — Maximum reach, maximum maintenance burden. Requires a contributor for each language who is willing to track spec changes in lockstep. Trade-off: you do not have those contributors yet; quality will suffer.
3. **Spec-only, no reference implementations** — Pure standards-body posture. Forces adopters to build everything. Trade-off: nobody adopts a content spec without a working SDK; this is how specs die.

**Recommended default:** Option 1. Ship one excellent TypeScript implementation, prove the spec works end-to-end, add Python once the wire format is stable enough that porting is mechanical rather than design work.

**Affects:** PRD-30 (SDK), PRD-40 (generators), PRD-50 (runtime profile), PRD-62 (MCP bridge).

**Status:** Open

---

### D-04 — Spec text license vs reference code license

**Question:** What licenses govern the spec document itself versus the reference implementation code?

**Why this matters:** Licensing determines who can implement the spec, fork it, embed it in proprietary products, and contribute back. Mismatched licensing between text and code is a common footgun that creates ambiguity for enterprise legal review.

**Options:**

1. **CC-BY-4.0 for spec text; Apache-2.0 for reference code** *(Recommended)* — CC-BY-4.0 is standard practice for technical specifications (W3C, IETF, CNCF all use variants). Apache-2.0 for code provides a permissive license with an explicit patent grant, which is the modern enterprise-friendly default. Trade-off: two licenses to explain; minor cognitive overhead for contributors.
2. **MIT for both** — Simpler, but no patent grant. Trade-off: enterprise legal teams increasingly require explicit patent grants; MIT alone is a minor friction.
3. **Apache-2.0 for both** — Simpler than option 1, but Apache-2.0 on prose has awkward attribution requirements (NOTICE files for documentation reads strange).
4. **CC0 for spec text, Apache-2.0 for code** — Maximum permissiveness on text. Trade-off: no attribution requirement means forks can rebrand silently, which weakens the spec's identity.

**Recommended default:** Option 1. Match standards-body practice for the text, modern enterprise practice for the code.

**Affects:** Every file in the repo, contributor agreement, README, PRD-90 (governance).

**Status:** Open

---

### D-05 — Source adapter version pinning

**Question:** How do source adapters declare which spec version they implement, and how strict is that declaration?

**Why this matters:** Adapters are the integration surface. If they pin too tightly, the ecosystem fragments at every minor release. If they float, breaking changes cascade silently into production sites and agents start hallucinating against stale schemas.

**Options:**

1. **Declare a range with peer-dependency style** *(Recommended)* — Adapters declare `act@>=0.1 <0.3` or similar. Spec releases follow semver: minor versions add fields, major versions can remove or rename. Tooling resolves and warns on conflicts. Document an upgrade path for each minor version. Trade-off: requires disciplined semver from the spec maintainers.
2. **Pin to exact spec version (`act@0.1.0`)** — Maximum predictability, maximum churn. Every spec patch release forces an adapter republish. Trade-off: high maintenance burden on adapter authors.
3. **Float (track latest, break loudly)** — Adapters always target latest. Easy to write, brutal to operate. Trade-off: zero stability guarantees; not viable for anything past hobby use.

**Recommended default:** Option 1. Range declarations are the standard mechanism in npm, pip, and cargo for a reason.

**Affects:** PRD-20 (adapters), PRD-30 (SDK), PRD-40 (generators), every adapter README.

**Status:** Open

---

### D-06 — MCP version commitment

**Question:** Which MCP spec version does the ACT-MCP bridge target at v0.1, and how is that updated?

**Why this matters:** PRD-62 (ACT-MCP bridge) needs a concrete target. MCP itself is moving; pinning loosely means the bridge breaks on every MCP minor release, pinning tightly means we cannot ship MCP improvements to ACT users without a coordinated release.

**Options:**

1. **Pin to current MCP spec version, document upgrade cadence** *(Recommended)* — Bridge ships against the current MCP spec at v0.1. Each subsequent ACT release explicitly states which MCP version it tracks. Major MCP upgrades get their own ADR. Trade-off: requires periodic catch-up work; predictable for adopters.
2. **Pin to a range** — Bridge accepts any MCP version in a declared window. Trade-off: shifts compatibility burden to runtime; harder to reason about.
3. **Track latest stable** — Bridge always targets the newest MCP release. Trade-off: every MCP breaking change becomes an ACT breaking change.

**Recommended default:** Option 1. Treat MCP version like a peer dependency with explicit pinning per ACT release.

**Affects:** PRD-62 (MCP bridge), runtime profile PRDs.

**Status:** Open

---

### D-07 — Initial design partners

**Question:** Which 3–5 organizations do we recruit as named design partners for v0.1?

**Why this matters:** Design partners shape what ships. Pick all docs-tooling vendors and the spec ends up biased toward static content; pick all SaaS vendors and it ends up biased toward live application data. The first cohort also provides the launch case studies, which disproportionately shape adoption.

**Options:**

1. **One from each tier: docs, marketing, B2B SaaS** *(Recommended)* — Astro for docs (already TS, friendly to specs, content collections fit ACT's model). Vercel + Contentful for marketing/CMS (covers static and headless). One B2B SaaS partner willing to ship runtime profile early (Linear, Notion, or Asana — pick whichever you have a warm intro to). Trade-off: requires actively recruiting three distinct stakeholders before v0.1 freezes.
2. **Docs-first (Astro, Docusaurus, MkDocs)** — Easier to recruit, narrower validation. Trade-off: spec ends up shaped for static content; runtime profile gets weak early signal.
3. **Marketing-first (Vercel, Contentful, Sanity)** — High-visibility logos, strong CMS validation. Trade-off: leaves docs and SaaS unrepresented in v0.1 design.
4. **SaaS-first (Linear, Notion, Asana)** — Best validation of runtime profile; hardest to recruit without prior relationships. Trade-off: complex partners; long sales cycles even for free design partnerships.

**Recommended default:** Option 1. Diversity of pressure on the spec is more valuable than depth in any single tier.

**Affects:** PRD-50 (runtime profile), PRD-70–76 (examples), launch comms.

**Status:** Open

---

### D-08 — Hosted validator at launch

**Question:** Do we ship a hosted web-based validator at v0.1, or stick to a CLI-only tool?

**Why this matters:** A hosted validator is the single highest-leverage adoption tool — paste a URL, see whether your site is ACT-valid, get a shareable badge. No installation friction. The cost is ongoing hosting and an attack surface we now have to defend.

**Options:**

1. **Yes, hosted on Vercel/Cloudflare static + edge functions** *(Recommended)* — Deploy as part of PRD-60. Static frontend, edge function backend, no persistent storage, rate-limited by IP. Cost is negligible at expected v0.1 traffic. Trade-off: ongoing operational responsibility; abuse mitigation needed.
2. **No, CLI only** — Lower operational burden, higher adopter friction. Trade-off: every demo at every conference now requires an install step.
3. **Yes, but defer to v0.2** — Ship CLI at v0.1, hosted validator once we have traction. Trade-off: launch moment is exactly when you need the hosted validator most.

**Recommended default:** Option 1. The validator is your best demo and your best onboarding tool. Pay the hosting cost.

**Affects:** PRD-60 (validator), launch plan, ops runbook.

**Status:** Open

---

### D-09 — ACT-MCP bridge: same package or separate?

**Question:** Does the ACT-MCP bridge ship as part of the core SDK, or as a separate package with independent versioning?

**Why this matters:** Bundling means one install, one version, simpler onboarding. Separating means MCP's version churn does not force ACT releases, and adopters who do not use MCP do not pay for code they do not run.

**Options:**

1. **Separate package, co-versioned at major releases** *(Recommended)* — `@act-spec/mcp-bridge` ships as its own package. Major versions stay aligned with `@act-spec/sdk`; minor and patch can diverge. Trade-off: two packages to install for MCP users; cleaner dependency graph.
2. **Bundled in core SDK** — One install, simpler tutorial. Trade-off: every MCP patch becomes a core SDK release; bloats install size for non-MCP users.
3. **Separate package, fully independent versioning** — Maximum decoupling. Trade-off: harder for adopters to know which versions work together; needs a compatibility matrix.

**Recommended default:** Option 1. Co-versioning at majors gives adopters a clear compatibility story without coupling release cadence.

**Affects:** PRD-30 (SDK), PRD-62 (MCP bridge), npm scope layout.

**Status:** Open

---

### D-10 — Public examples hosting

**Question:** Where do the example sites in PRD-70–76 actually live, and how are they organized in the repo?

**Why this matters:** Examples are how adopters evaluate the spec. They need to be deployed, kept current, and trivially clonable. Where they live and how they are deployed determines the friction of keeping them green.

**Options:**

1. **Vercel for all examples; one directory per example under `examples/<slug>/` in the main repo** *(Recommended)* — Single deployment platform, single repo, single CI pipeline. Each example has its own README and a deployed URL in the main spec README. Trade-off: vendor concentration on Vercel; mitigated by examples being trivially portable.
2. **Multiple platforms (Vercel, Cloudflare, Netlify) to demonstrate portability** — Stronger neutrality signal. Trade-off: triples the operational surface; CI complexity multiplies.
3. **Separate repo per example** — Clean isolation, harder discovery. Trade-off: examples drift out of sync with spec changes; nobody finds them.

**Recommended default:** Option 1. Optimize for keeping examples green; portability can be demonstrated by documentation rather than by spreading the operational burden.

**Affects:** PRD-70–76 (examples), CI configuration, main README.

**Status:** Open

---

### D-11 — Telemetry / phone-home from generators or SDKs

**Question:** Do we ship any form of telemetry, anonymous usage stats, or phone-home behavior from the generators or SDKs?

**Why this matters:** Telemetry is a trust question, not a technical one. The agent-content space is adjacent to advertising, tracking, and AI training data — all of which adopters are skeptical of. Shipping any phone-home behavior, however benign, gives the spec a political problem on launch day.

**Options:**

1. **Explicit NO. "We will never ship telemetry" line in every README and the governance ADR** *(Recommended)* — Makes the commitment public and load-bearing. Treats telemetry as a category we do not enter. Adopters who care will notice; adopters who do not care will not be harmed. Trade-off: gives up usage data we might otherwise collect for prioritization.
2. **Opt-in telemetry, off by default** — Allows usage measurement for engaged adopters. Trade-off: even opt-in telemetry creates a trust surface; the maintenance and policy burden is real.
3. **Anonymous metrics with no PII** — Industry-standard middle ground. Trade-off: definitions of "anonymous" are contested; the politics outweigh the data value at this stage.

**Recommended default:** Option 1. The trust win is larger than any usage-data benefit. Get prioritization signal from issues, design partners, and conference conversations.

**Affects:** Every README, PRD-90 (governance), every SDK and generator package.

**Status:** Open

---

### D-12 — Spec text storage strategy

**Question:** Does the spec text, adapters, runtime, and examples all live in one repo, or do we split as the project grows?

**Why this matters:** Monorepos optimize for atomic changes across components and easy onboarding; multi-repos optimize for independent release cadence and contributor focus. The wrong choice early costs migration work later.

**Options:**

1. **Monorepo until v0.5; split when file count or release cadence justifies it** *(Recommended)* — One repo for spec text, SDK, generators, adapters, validator, and examples through v0.5. Document split criteria up front: split when (a) a component releases more than monthly out of step with the rest, or (b) the repo crosses 10k files, or (c) a component requires fundamentally different CI tooling. Trade-off: one heavy CI pipeline; mitigated by path-based filtering.
2. **Split from day one** — Spec text in `act-spec/spec`, SDK in `act-spec/sdk`, etc. Trade-off: cross-cutting changes require coordinated PRs across repos; high friction at exactly the stage when changes are most cross-cutting.
3. **Always monorepo** — Never split. Trade-off: works for small projects; becomes painful past a certain scale that we cannot predict precisely.

**Recommended default:** Option 1. Monorepo while the spec is volatile, with documented criteria for when to split. Premature splitting is a common and expensive mistake.

**Affects:** Repo layout, CI, contributor docs, every PRD that touches multiple components.

**Status:** Open

---

## Open decision tracking table

| ID    | Title                                          | Status | Resolution | Decision date |
| ----- | ---------------------------------------------- | ------ | ---------- | ------------- |
| D-01  | Spec governance model                          | Open   |            |               |
| D-02  | Spec name and branding                         | Open   |            |               |
| D-03  | Reference implementation language strategy     | Open   |            |               |
| D-04  | Spec text license vs reference code license    | Open   |            |               |
| D-05  | Source adapter version pinning                 | Open   |            |               |
| D-06  | MCP version commitment                         | Open   |            |               |
| D-07  | Initial design partners                        | Open   |            |               |
| D-08  | Hosted validator at launch                     | Open   |            |               |
| D-09  | ACT-MCP bridge: same package or separate       | Open   |            |               |
| D-10  | Public examples hosting                        | Open   |            |               |
| D-11  | Telemetry / phone-home from generators or SDKs | Open   |            |               |
| D-12  | Spec text storage strategy                     | Open   |            |               |
