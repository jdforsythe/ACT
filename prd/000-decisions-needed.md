# ACT — Strategic Decisions Needed

**Status:** Open (planning)
**Last updated:** 2026-05-01

This file collects the calls that **only the project lead** can make. They aren't gaps that more research will close — they're positioning, governance, and resource-allocation questions whose answers shape which PRDs get written and how. Each item below states the question, lays out options, recommends a default, names the consequences, and lists which PRDs cannot finalize until it's resolved.

When you've made a call, edit the **Decision** field below the question and update the affected PRDs' status fields in `000-INDEX.md`.

---

## Q1. Spec governance model

**Question.** Who owns the ACT specification long-term? Who has the right to merge breaking changes? What's the change-control process for v0.2+?

**Options.**
1. **Benevolent dictator (you).** You are the single decision-maker; community input is welcomed but advisory. Fastest decisions, lowest overhead, least durable beyond your involvement.
2. **Small foundation / steering committee.** 3–5 named maintainers. Public RFC process for material changes. Higher overhead, more durable, slower.
3. **IETF or W3C track.** Submit as a draft for formal standardization. Highest legitimacy, slowest by far, requires substantial paperwork; typically pursued only after rough consensus exists in the wild.
4. **Hybrid.** BDFL for v0.1; commit to transitioning to a foundation by v1.0.

**Recommended default.** Option 4 (BDFL → foundation). Rationale: a single voice during the formative period prevents bikeshed paralysis; committing publicly to a transition by v1.0 reassures early adopters they aren't betting on a personal project. Practical milestone: foundation transition triggered by either (a) one major LLM client adopting ACT, or (b) three independent CMSes shipping adapters.

**Consequences of each option.**
- (1) limits enterprise adoption — legal teams flag single-owner specs.
- (2) requires writing bylaws now; not free.
- (3) is unrealistic until there's a working ecosystem; revisit at v1.0+.
- (4) buys time but commits you to delivering on the transition.

**Blocks.** 000-governance, PRD-802 (RFC process). Indirectly: every external partner conversation.

**Decision:** Option 1 — BDFL (Jeremy Forsythe) for the foreseeable future, with no public commitment to a foundation transition. Rationale: lead has explicitly chosen the lowest-overhead path; community input will be advisory, and a future move to a foundation remains possible but is not promised in v0.1 materials.

---

## Q2. Final naming and trademark

**Question.** Is "ACT" / "Agent Content Tree" the final name? Are file extensions `.act.json` and the well-known path `/.well-known/act.json` final?

**Options.**
1. **ACT, final.** Lock in `.act.json`, `act-spec.org`, `act-*` package naming, the MIME type family `application/act-*+json`. Run trademark search; file if clear.
2. **ACG (Agent Content Graph).** Mentioned as fallback in draft Appendix A. Less collision risk but the verb-form pun ("the site ACTs") is lost.
3. **AGTREE.** Also from Appendix A. Less verb-friendly, more descriptive; possibly clearer to non-English readers.
4. **Pick a non-acronym.** E.g., "Branchwire", "Treeline", "Foliage". Unique, googlable, but discards the existing draft's voice.

**Recommended default.** Option 1, with conditions. Run a trademark search across USPTO, EUIPO, and major package registries (npm, crates.io, PyPI) for "act-*" prefixes. If conflicts surface, fall back to Option 2 (ACG) — it preserves draft semantics.

**Consequences.**
- "ACT" is short and memorable but collides with many things outside our space (Microsoft ACT compatibility tooling, ACT testing tools, etc.). Mostly benign because none of them are in this domain, but trademark scope matters.
- Locking the name now de-risks every PRD's prose. Renaming after PRDs land is a multi-week sweep across schemas, MIME types, package names, and example code.

**Blocks.** PRD-803 (naming policy), PRD-101 (well-known path), B5 (MIME registration), every package name in 20-, 30-, 40-, 500-series.

**Decision:** Option 1 — "ACT" / "Agent Content Tree" is final, with `.act.json`, well-known `/.well-known/act.json`, and the `application/act-*+json` MIME family. No formal trademark or package-registry sweep was performed; lead accepts the collision risk. Domain (`act-spec.org` or alternative) deferred to Q10. PRD-803 should perform the IANA / registry registrations downstream.

---

## Q3. Reference implementation language(s)

**Question.** Which language(s) get **first-party** reference implementations of the spec for v0.1?

**Options.**
1. **TypeScript-only.** All adapters, generators, runtime SDKs, validators in TS. Fastest; covers the JS-heavy generator/CMS/runtime space. Excludes Hugo (Go), Jekyll (Ruby), MkDocs (Python), Rails (Ruby), FastAPI (Python).
2. **TypeScript-first, Python second.** Add Python for FastAPI runtime SDK + MkDocs generator + a parallel validator. Roughly doubles maintenance.
3. **Polyglot from day one.** TS + Python + Go + Ruby. Matches the generator surface (Hugo is Go; Jekyll is Ruby). 4× maintenance; 4× chance of spec-implementation drift.
4. **TypeScript-only for spec, community for the rest.** Reference impl in TS; document a porting guide; let the community fill in Hugo/MkDocs/Rails. Lowest cost; slowest non-JS adoption.

**Recommended default.** Option 1 (TypeScript-only) for v0.1, with a published porting guide and a clear invitation for Python/Go/Ruby community ports. Reasoning: the JS ecosystem covers ~80% of the named generator targets (Astro, Docusaurus, Next, Nuxt, 11ty, Remix, MDX). Hugo, MkDocs, Rails are valuable but not on the v0.1 critical path. Defer Python/Ruby to v0.2 unless a design partner explicitly needs it (see Q7).

**Consequences.**
- (1) limits PRD-402 (Hugo), PRD-403 (MkDocs), PRD-503 (FastAPI), PRD-504 (Rails) to "spec-only" PRDs (no reference code) for v0.1. Mark them "spec only, reference impl pending" in their PRDs.
- (3) gives the broadest day-1 footprint at proportional cost. Each language is an additional test matrix and an additional way for the spec to drift from "what implementations actually do."
- (4) is what "official spec" projects often default to. Works best when a strong RFC process is in place, which we don't yet have.

**Blocks.** PRD-402, PRD-403, PRD-503, PRD-504. Also affects scope of PRD-600 (validator).

**Decision:** Option 1 — TypeScript-only first-party reference implementations for v0.1. PRD-402 (Hugo), PRD-403 (MkDocs), PRD-503 (FastAPI), and PRD-504 (Rails) are downgraded to spec-only PRDs (no v0.1 reference code; community ports invited). PRD-600 (validator) ships as TS-only. Downstream example PRD-703 (Hugo blog) is affected — see INDEX for status.

---

## Q4. Licensing — spec text vs reference code

**Question.** What license governs the specification text? What license governs the reference implementations?

**Options.**
1. **CC-BY-4.0 (spec) + Apache-2.0 (code).** The conventional pairing for open standards with permissive ecosystems. Matches MCP, OpenTelemetry, etc.
2. **CC0 (spec) + MIT (code).** Maximally permissive. Some enterprise legal teams are wary of CC0 because it's not a license, it's a public-domain dedication.
3. **W3C Document License + MIT.** Aligns with formal standards-track adoption later (Q1, Option 3) at the cost of slightly less reuse freedom.
4. **Custom or restrictive license.** E.g., trademark-restricted with affirmative license grant. Not recommended.

**Recommended default.** Option 1. Track record across comparable projects is strong; legal review is short; downstream adoption is low-friction.

**Consequences.** Mostly minor at v0.1. The bigger downstream effect is on Q3 — Apache-2.0's patent grant is the standard expectation for reference code that vendors might fold into commercial products.

**Blocks.** Repository setup; package.json `license` fields. Not a hard PRD blocker, but should be set before any code lands.

**Decision:** Option 1 — CC-BY-4.0 for spec text, Apache-2.0 for reference code. Conventional pairing (MCP, OpenTelemetry, OpenAPI); Apache-2.0's patent grant is the standard expectation for code that vendors may fold into commercial products. Apply to the repo before any code lands.

---

## Q5. Source adapter versioning relative to the spec

**Question.** When the wire format bumps (e.g., 0.1 → 0.2), do source adapters pin to a single spec version or float?

**Options.**
1. **Pinned.** Adapter major.minor matches spec major.minor. `act-contentful@0.1.x` emits 0.1; `act-contentful@0.2.x` emits 0.2.
2. **Floating with declared range.** Adapter declares `act_versions_supported: ["0.1", "0.2"]` and emits whichever the generator requests. Higher complexity per adapter but less upgrade churn for users.
3. **Pinned for MAJOR, floating for MINOR.** Adapter `1.x` works with spec `1.0` and `1.1` but not `2.0`. Probably the right shape long-term but requires solid MAJOR/MINOR rules first (A2 in gaps doc).

**Recommended default.** Option 3, contingent on A2 (versioning policy) landing in PRD-108. Until A2 is final, treat adapters as Option 1 (pinned) to keep the matrix small.

**Consequences.**
- (1) means a spec bump triggers a coordinated release across ~10 adapter packages.
- (2) is operationally complex; multiple emission paths in each adapter.
- (3) is the long-term answer but depends on PRD-108.

**Blocks.** PRD-200 §Versioning. All 200-series adapter PRDs need this answered before they leave Draft.

**Decision:** Option 3 (staged) — for v0.1, all adapters are pinned (Option 1) to keep the matrix small; once PRD-108 ratifies the MAJOR/MINOR rules proposed in gap A2, the policy formally becomes MAJOR-pinned / MINOR-floating (`adapter@1.x` works with spec `1.0` and `1.1` but not `2.0`). PRD-200 §Versioning must encode both states and reference the migration trigger.

---

## Q6. MCP version range for the ACT-MCP bridge

**Question.** PRD-602 (ACT-MCP bridge) couples ACT to MCP. Which MCP version range do we commit to supporting at v0.1?

**Options.**
1. **MCP 1.0 only.** Smallest surface, clearest semantics. Risk: MCP is moving fast; a 1.x MINOR bump could break the bridge during v0.1's lifetime.
2. **MCP 1.0 with forward-compat shim.** Bridge declares minimum MCP 1.0; tolerates unknown optional fields and resource shapes per MCP's own forward-compat rules. Recommended if MCP's own versioning policy is solid.
3. **Defer PRD-602 entirely to v0.2.** Ship v0.1 without an MCP bridge; let runtime ACT and MCP coexist via independent server patterns documented in PRD-109 / draft Appendix E.

**Recommended default.** Option 2 if MCP's versioning policy is documented and stable; otherwise Option 3. Open the bridge late in P2 so MCP's state is clearer when we commit. The bridge is high-leverage for SaaS adoption (draft Appendix B Front 3) but low-leverage for the docs/marketing case, so deferring it doesn't hurt the bulk of P3 example builds.

**Consequences.**
- (1) is brittle if MCP iterates.
- (2) is operationally smart but requires care; document the supported subset explicitly.
- (3) costs us the SaaS adoption story for v0.1; revisit when MCP stabilizes.

**Blocks.** PRD-602. PRD-706 (hybrid example) depends on PRD-602 directly.

**Decision:** Option 2 — MCP 1.0 minimum with forward-compat shim (tolerate unknown optional fields and resource shapes per MCP's own forward-compat rules). PRD-602 must document the supported MCP subset explicitly. If, when PRD-602 enters In Review, MCP's versioning posture is still unstable enough that the shim cannot be specified safely, escalate back to lead to consider deferring to v0.2.

---

## Q7. Initial design partners

**Question.** Which 2–4 organizations do we want as named v0.1 launch partners? Adopting ACT in production gives the spec credibility and surfaces real-world bugs early.

**Options.** (Not mutually exclusive — pick 2–4.)
1. **Astro** — JS-heavy docs/marketing site builder; receptive to standards; PRD-401 already on the roadmap.
2. **Docusaurus** — large existing user base; PRD-404 in plan; landing it as a default plugin gets ACT to thousands of docs sites.
3. **Mintlify** — developer-docs-focused commercial product; high quality bar; would push for refinements.
4. **Contentful** — gives CMS credibility; first-party adapter (PRD-202) requires their cooperation or just access to public APIs.
5. **Sanity / Storyblok** — CMS competitors; similar reasoning to Contentful.
6. **A specific large docs site** — e.g., Cloudflare, Stripe, Vercel docs — high-visibility validation.
7. **A B2B SaaS for the runtime profile** — e.g., Linear, Notion, a CRM. Validates PRD-500/501/705 in production.

**Recommended default.** Choose **two from { Astro, Docusaurus }** + **one CMS** + **one B2B SaaS**. Rationale: that mix exercises the static profile (Astro/Docusaurus), the source-adapter framework (CMS), and the runtime profile (SaaS). One partner per dimension keeps coordination tractable.

**Consequences.** Partners shape priority. If Astro is a partner, PRD-401 becomes a P2 high-priority. If Linear is a partner, PRD-501 + PRD-705 jump in priority. Without partners, the example builds (700-series) become hypothetical and the spec evolves in a vacuum.

**Blocks.** Doesn't block any PRD's text directly. Heavily affects authoring order within P2 and P3, and which examples land first.

**Decision:** Deferred — no active partner conversations yet. Aspirational targets (lead to pursue, not commitments): **Astro** + **Docusaurus** (static profile + adapter framework via PRD-201/301), **Contentful** (CMS profile via PRD-202), and **Linear** (B2B SaaS / runtime profile via PRD-501 + PRD-705). **Trigger to revisit:** before PRD-401 or PRD-202 leave Draft, AND before any 700-series example enters In Review — at that point the example builds need real partner data, not hypotheticals.

---

## Q8. Hosted validator at launch

**Question.** Do we ship a hosted validator at `act-spec.org/validate` (or similar) at v0.1 launch, or only a CLI / library?

**Options.**
1. **Hosted at launch.** PRD-600 covers both library and hosted UI. Public validation URL drives adoption (authors can sanity-check by pasting their manifest URL). Operational commitment: uptime, abuse rate-limits, version pinning, support inbox.
2. **CLI / library only at launch.** Ship `npx act-validate <url>` and a JS library. Document a self-hosted recipe. Hosted validator added in v0.2 once adoption justifies the operational cost.
3. **Hosted lite.** Static-site-hosted single-page validator that runs entirely client-side (no backend, no rate-limiting needed). Same UX as Option 1 for many cases; can't fetch from origins that block CORS.

**Recommended default.** Option 3. Rationale: client-side validator gets ~90% of the adoption-driving benefit at near-zero operational cost. CORS limitation is real but acceptable — authors can paste their JSON directly when fetching fails. Upgrade to Option 1 once adoption demands it.

**Consequences.**
- (1) is a real ongoing commitment; budget for it.
- (2) misses the demo opportunity at launch.
- (3) is the pragmatic middle path. Mention CORS limitation prominently.

**Blocks.** PRD-600. Also Appendix B item 12 ("Publish a validator").

**Decision:** Option 3 — client-side single-page validator (no backend). Hosted on **GitHub Pages from within the spec repo**, alongside the spec site and any other static sites the project ships. CORS-restricted origins are addressed by allowing direct paste of JSON. PRD-600 must call out the CORS limitation prominently. Custom domain (Q10) can be wired to GitHub Pages later without changing this decision.

---

## Lower-priority calls (resolve when convenient)

These don't gate v0.1 PRD writing but should be on your radar.

- **Q9. Public communication channel.** GitHub Discussions vs Discord vs mailing list vs Bluesky/Mastodon. Cheap to defer; expensive to migrate later.

  **Decision (2026-04-30):** GitHub Discussions in the spec repo is the primary channel — zero new infra, indexed by search engines, no moderation tooling to set up. Bluesky/Mastodon presence is deferred until v0.1 launch announcement; until then announcements go in the repo's README and release notes.

- **Q10. Domain.** Is `act-spec.org` available and intended? Adjacent domains worth grabbing? Recommend running a sweep before the rename window in Q2 closes.

  **Decision (2026-04-30):** Availability sweep run on 2026-04-30 — `act-spec.org`, `actspec.org`, `actformat.org`, `act-spec.io`, `act-spec.dev`, `actspec.dev`, and `actformat.dev` all returned "domain not found" (whois) or no NS records (DNS). **Primary target: `act-spec.org`** (matches open-spec naming convention used by OpenAPI, OpenTelemetry, MCP). Fallback: `act-spec.dev`. Action item on lead: register before any 700-series example PRD enters In Review, since example URLs will bake in the canonical domain. Wired to GitHub Pages per Q8.

- **Q11. Logo / brand.** Defer until Q2 settles. Don't commission anything until naming is final.

  **Decision (2026-04-30):** Deferred. Wordmark only ("ACT" / "Agent Content Tree") for v0.1; no commissioned logo. Trigger to revisit: a conference talk, partner deck, or post-launch adoption signal that justifies the spend.

- **Q12. Conformance test harness shipping.** PRD-600 covers the validator; do we also ship a runnable conformance suite that producers can run against their own deployments? (Likely yes, but scope and packaging open.)

  **Decision (2026-04-30):** Yes, but **rolled into PRD-600's scope as a CLI mode** (`act-validate --conformance <url>`) rather than spinning a separate PRD-604. Reuses the validator's parsing and level-reporting code. PRD-600 row already sized L; no size bump needed but the row title is updated to reflect the conformance suite scope.

- **Q13. Search response envelope shape — v0.1 vs v0.2.** PRD-100 locks `search_url_template` advertisement and the `capabilities.search.template_advertised` flag, but does NOT define the search **request parameter set** or the **response body envelope**. PRD-107-R10 lists `search_url_template` as Plus. PRD-600 (validator) can therefore validate that the URL template is present, that the endpoint returns 200, and that the response is JSON — but cannot validate the response body against a normative schema until the envelope is pinned. Surfaced during Phase 3 gate verification (2026-05-01).

  **Options.**
  1. **Defer search-body validation to v0.2.** PRD-600 v0.1 ships with the documented limitation; Plus producers are conformant as soon as `search_url_template` is advertised and the endpoint responds 200 with JSON. The search-body shape lands in v0.2 as a MINOR extension to PRD-100 (additive optional fields satisfy PRD-108-R4(1)).
  2. **Extend PRD-100 in a MINOR bump now.** Costs another sub-day of authoring; pulls a v0.2-flavored decision into v0.1.
  3. **Drop search from Plus tier in v0.1.** Promote it to "Plus optional" with a SHOULD. PRD-107-R10 would need a MAJOR amendment per its own Versioning table; expensive.

  **Decision (2026-05-01):** Option 1 — defer to v0.2. PRD-600 v0.1 must call out the limitation prominently in its README and `--conformance` output. **Trigger to revisit:** any Plus-tier reference deployment (PRD-705 hybrid example or earlier) that needs the validator to assert search-body shape, OR a partner CMS shipping a search adapter that wants normative guidance. PRD-100 changelog should note that the search-body envelope is intentionally absent in v0.1; PRD-107-R10's "search endpoint returns the search envelope defined in draft §5.9" prose is forward-compat only and does not impose v0.1 conformance pressure.

---

## How to record decisions

When you make a call:
1. Edit the **Decision** field below the relevant question with the choice and a one-line rationale.
2. If the decision unblocks a PRD, change that PRD's Status in `000-INDEX.md`.
3. If the decision invalidates a proposed resolution in `000-gaps-and-resolutions.md`, update the gap entry too.

Don't delete questions once decided — keep the rationale visible. Future maintainers benefit from seeing why earlier choices were made.
