# PRD-801 — Migration playbook (llms.txt → ACT, sitemap-only → ACT, MCP-only → ACT)

## Status

`Accepted`

---

## Engineering preamble

The preamble is for humans deciding whether this PRD belongs in the work queue. It is non-normative. The Specification section below is the contract.

### Problem

A site that is going to adopt ACT today already serves something: a `/llms.txt` file, an XML sitemap, an MCP server, or some combination. The wire-format PRDs (PRD-100 through PRD-109) describe what an ACT producer looks like in steady state, but they do not tell an operator how to **transition** from "what they had before" to "ACT-conformant" without breaking existing consumers. Three transition paths are common enough to need a normative playbook:

- (a) **From `/llms.txt` → ACT.** Sites that already publish a markdown index for LLMs need to enrich into ACT (richer envelope shape, richer node bodies, schema-validated) without breaking any consumer that fetches `/llms.txt` directly.
- (b) **From sitemap-only → ACT.** Sites with no agent-specific surface, where ACT is being introduced as the agent-readable layer in addition to the existing sitemap.
- (c) **From MCP-only → ACT.** SaaS products with an MCP server but no static content surface, where ACT is being added as the static / cacheable read layer alongside the live MCP transport. Pairs with PRD-602 (ACT-MCP bridge).

Without a playbook, each operator reinvents the migration: which signal goes first, when to advertise both, when to turn down the old surface, what happens to consumers caught mid-migration. A bad migration breaks consumers; a slow migration leaves the operator running two surfaces forever; a turn-down before the new surface validates leaves the agent ecosystem with neither.

### Goals

1. Define the three migration paths normatively, each as a sequence of phases (advertise → validate → turn-down) with explicit producer obligations per phase.
2. Pin a minimum dual-publish window of one MINOR cycle (per PRD-108-R12 deprecation window) so consumers have time to migrate.
3. Require PRD-600 conformance ("validator green") as a precondition to turn-down, not a post-hoc check.
4. Specify how producers advertise both surfaces during the migration window (e.g., `/llms.txt` linking to the well-known path; MCP server's resource catalog pointing at the ACT manifest).
5. Provide a recommended timeline for each path with concrete bounds — short enough to not leave the operator in dual-publish forever, long enough that consumers can keep up.
6. Define migration validation criteria: PRD-600 conformance plus a content-equivalence check (the new ACT must cover the same canonical URLs and content the old surface advertised).
7. Reference PRD-602 explicitly for the MCP path, so operators following both PRDs see a coherent picture.

### Non-goals

1. Defining the wire format of ACT itself — that is PRD-100. PRD-801 cites the manifest, index, and node envelopes.
2. Defining the discovery flow — that is PRD-101. PRD-801 cites the well-known path and the runtime hand-off.
3. Defining the validator — that is PRD-600. PRD-801 only requires that PRD-600 returns "no errors" before turn-down.
4. Defining the ACT-MCP bridge — that is PRD-602. PRD-801 references PRD-602 for the MCP-only migration path; it does not redefine the bridge.
5. Defining migrations from any source format other than the three named (e.g., schema.org JSON-LD only, RSS only, OpenAPI only). Those are out of scope for v0.1; future MINOR may add paths.
6. Specifying migration tooling (a `migrate-llms-to-act` CLI, etc.). PRD-801 is policy; tooling is a downstream implementation concern owned by PRD-600 / PRD-601 / community packages.
7. Compelling any producer to migrate. ACT adoption is voluntary; PRD-801 only governs the procedure when an operator has decided to migrate.

### Stakeholders / audience

- **Authors of:** site operators planning to adopt ACT, agent platforms supporting both legacy formats and ACT during the transition, partner ecosystem teams advising customers on the migration.
- **Reviewers required:** BDFL Jeremy Forsythe.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Operators turn down the old surface before the new surface is validated, leaving consumers with broken links. | Medium | High | PRD-801-R3 and per-path R6/R10/R14 require PRD-600 conformance before turn-down. The validator-green signal is a hard prerequisite, not advisory. |
| Operators run dual-publish indefinitely because there's no forcing function. | Medium | Low | PRD-801-R4 sets a recommended turn-down window of one MINOR cycle (per PRD-108-R12 deprecation window). It is SHOULD, not MUST — operators retain discretion — but the recommendation prevents drift. |
| Content drift between the old and new surface during dual-publish (one is updated, the other isn't). | Medium | Medium | PRD-801-R5 requires that during dual-publish, the same canonical URL set is covered by both surfaces. Content body MAY differ in fidelity (richer in ACT) but the URL space MUST overlap. |
| Consumers caught mid-migration follow a stale `/llms.txt` to URLs that no longer resolve. | Medium | Medium | PRD-801-R7's link-from-llms.txt rule keeps `/llms.txt` pointing at the well-known path during the migration so a savvy consumer can hop forward; but the playbook explicitly does not promise zero stale fetches. |
| Migrating from MCP without coordinating PRD-602 produces a bridge that is itself non-conformant. | Medium | Medium | PRD-801-R12 requires the MCP migration path to land PRD-602 (the bridge) as part of the dual-publish setup, not as an afterthought. |
| The minimum window (one MINOR) is too short for downstream consumers with quarterly release trains. | Medium | Low | The window is a recommendation; large producers MAY extend at their discretion. The forcing function is the operator's own appetite for two surfaces, not a spec mandate. |

### Open questions

1. Does PRD-801 need a fourth migration path for sites coming from schema.org JSON-LD only? Tentatively no for v0.1 — schema.org is more often a complement than a precursor; operators add ACT alongside JSON-LD rather than migrating off it. Revisit if a partner with a JSON-LD-only stack asks for guidance.
2. Should the validator-green precondition (R3) include partner-supplied conformance test packs (e.g., a docs-vertical conformance pack) in addition to PRD-600's wire-format suite? Tentatively no — PRD-600 is the single source of truth for v0.1; partner packs are layered concerns. Reconsider in v0.2 if vertical packs become common.
3. Should the dual-publish content-equivalence rule (R5) require byte-equivalent summaries between the old and new surfaces, or only URL coverage? Tentatively only URL coverage — content fidelity differs by design (ACT is richer). Byte-level equivalence would force operators to dumb down ACT content during the window.

### Acceptance criteria

- [ ] Every requirement has an ID of the form `PRD-801-R{n}`.
- [ ] All three migration paths are covered with phase-by-phase requirements.
- [ ] PRD-600 conformance is required before turn-down.
- [ ] Dual-publish window cited per PRD-108-R12.
- [ ] PRD-602 is cited for the MCP path.
- [ ] Conformance level is declared per requirement.
- [ ] Versioning & compatibility table classifies kinds-of-change to PRD-801 per PRD-108.
- [ ] Security section addresses the dual-publish content-leakage surface.
- [ ] Changelog initial entry dated 2026-05-02 is present.

---

## Context & dependencies

### Depends on

- **PRD-100** (Accepted): the wire-format envelopes the migration must produce.
- **PRD-101** (Accepted): the discovery flow and the well-known path the migration advertises.
- **PRD-107** (Accepted): conformance levels — the migration must declare a target level.
- **PRD-108** (Accepted): the MAJOR/MINOR classification rules and the deprecation window (R12) that grounds the recommended dual-publish duration.
- **PRD-600** (Accepted): the validator whose green signal gates turn-down.
- **PRD-602** (Accepted): the ACT-MCP bridge required by the MCP migration path.
- **000-governance** (Accepted): change-control rules for this PRD itself.
- External: the informal [llms.txt convention](https://llmstxt.org/), the [Sitemaps protocol](https://www.sitemaps.org/), the [Model Context Protocol](https://modelcontextprotocol.io/) v1.0 (referenced via PRD-602).

### Blocks

- Operator-facing migration guides (`docs/guides/migrate-from-llms-txt.md`, etc., when authored): cite PRD-801 for the normative process.
- PRD-602's adoption playbook subsection: defers to PRD-801 path (c) for MCP migrations.

### References

- v0.1 draft: §5.1 (well-known manifest), §5.2 (`/llms.txt` linkage), §5.14 (ACT vs. MCP coexistence).
- `000-decisions-needed.md`: Q9 (GitHub Discussions, the announcement channel for migration milestones).
- Prior art: how WHATWG migrated specs from W3C (long deprecation windows + dual-publish), how RSS 1.0 → RSS 2.0 communities handled feed turn-down, how OpenAPI 2.0 → 3.0 producers staged migrations.

---

## Specification

This is the normative section. Everything below MUST use RFC 2119 keywords (MUST, MUST NOT, SHOULD, SHOULD NOT, MAY) where requirements are imposed. Lowercase "must" and "should" are non-normative prose.

### Conformance level

Migration is **Core** — every operator transitioning to ACT, regardless of the conformance level they target, follows the cross-cutting rules in this PRD. A few requirements have a band qualifier:

- **Core (cross-cutting):** R1, R2, R3, R4, R5.
- **Core (path-specific):** R6, R7, R8 (llms.txt path); R9, R10, R11 (sitemap path); R12, R13, R14 (MCP path).
- **No Standard / Plus deltas.** Migration rules apply uniformly across conformance levels of the target ACT deployment.

### Normative requirements

#### Cross-cutting rules

**PRD-801-R1.** A producer adopting ACT MUST stage the migration in three named phases — **Advertise**, **Validate**, **Turn-down** — and MUST NOT skip the Validate phase. The phases run sequentially: Advertise begins when the new ACT surface is reachable on the same origin; Validate is achieved when PRD-600 reports zero errors against the new ACT surface; Turn-down begins only after Validate.

**PRD-801-R2.** During the Advertise phase, the producer MUST continue to serve the existing surface (llms.txt, sitemap, MCP) without functional regression. Specifically, the existing surface's URL set, response shapes, and update cadence MUST remain stable. ACT MUST NOT be introduced by removing or breaking the existing surface.

**PRD-801-R3.** A producer MUST NOT begin Turn-down until PRD-600 reports zero errors against the new ACT surface, exercised at the operator's chosen conformance level (Core / Standard / Plus per PRD-107). PRD-600 warnings are advisory and do not block Turn-down.

**PRD-801-R4.** The dual-publish window — the duration during which both the legacy surface and the ACT surface are reachable — SHOULD be at least one MINOR cycle of the producer's release cadence, or 90 days, whichever is longer. The window is keyed to PRD-108-R12's deprecation discipline: a deprecated surface MAY be removed at the next MAJOR earliest from the consumer's standpoint, but the producer's own dual-publish hygiene takes a softer floor (SHOULD, not MUST) to respect operator discretion.

**PRD-801-R5.** During dual-publish, the legacy surface and the ACT surface MUST cover **the same canonical URL set** of agent-readable content. Specifically: every page advertised in the legacy surface MUST appear (under its same canonical URL) in the ACT index, and vice versa. Content body fidelity MAY differ (ACT MAY carry richer summaries, abstracts, blocks); URL coverage MUST overlap completely. Producers SHOULD synchronize updates to both surfaces; transient drift of a single update cycle is tolerable, persistent drift is a violation.

#### Path (a) — From `/llms.txt` to ACT

**PRD-801-R6.** When migrating from `/llms.txt`, the producer MUST author the ACT manifest, index, and per-node envelopes such that:

- Every entry listed in `/llms.txt` (under any of its sections) appears as a node in the ACT index, keyed by the same canonical URL.
- The node's `summary` field is at least as informative as the corresponding `/llms.txt` link description.
- The node's `type`, `title`, and `etag` are populated per PRD-100.

**PRD-801-R7.** During the dual-publish window, `/llms.txt` MUST link to the ACT well-known path (`/.well-known/act.json`) per PRD-101-R3's recommended SHOULD pattern, with the canonical link line at or near the top of the file. Recommended form:

```
- [ACT manifest](/.well-known/act.json): structured agent-readable index for this site
```

This lets ACT-aware agents that find `/llms.txt` first hop forward to the richer surface.

**PRD-801-R8.** Turn-down of `/llms.txt` is OPTIONAL even after the dual-publish window. Producers MAY keep `/llms.txt` indefinitely as a low-cost discovery aid for non-ACT-aware tooling. If the producer chooses to remove `/llms.txt`:

- The removal MUST be announced via the `000-governance` channel (GitHub Discussions per Q9) at least one MINOR cycle (or 90 days, whichever is longer) in advance.
- The removed `/llms.txt` MAY be replaced by a redirect to `/.well-known/act.json` for one further MINOR cycle as a courtesy to legacy consumers. The redirect SHOULD be a `301 Moved Permanently` so caching consumers update.
- `/llms.txt` is not a normatively required ACT surface; PRD-101-R3 already speaks of it as SHOULD. Removing it is the producer's prerogative, governed by R8's announcement rule.

#### Path (b) — From sitemap-only to ACT

**PRD-801-R9.** When migrating from sitemap-only, the producer MUST author the ACT manifest, index, and per-node envelopes such that:

- Every URL listed in the XML sitemap that represents agent-readable content (i.e., not assets like images, stylesheets, or pure-asset pages) appears as a node in the ACT index, keyed by the same canonical URL.
- Sitemap entries that do not represent agent-readable content (e.g., binary download URLs) MAY be omitted from ACT.
- The sitemap continues to function for general-purpose web crawlers throughout and after migration; ACT does not replace the sitemap, it complements it.

**PRD-801-R10.** Turn-down does NOT apply to the sitemap. The XML sitemap remains in service for non-ACT crawlers (search engines, archival crawlers) and is not a "legacy" surface in the sense of paths (a) or (c). The sitemap-to-ACT migration is therefore an **additive** migration: the producer publishes ACT alongside the sitemap permanently. The Validate phase still applies (PRD-600 zero errors before declaring migration complete); the Turn-down phase is reduced to an announcement that ACT is now available (per `000-governance` channel).

**PRD-801-R11.** During the Advertise phase of the sitemap path, the producer SHOULD:

- Add `<link rel="act" href="/.well-known/act.json">` to the homepage HTML (per PRD-101-R4 — the SHOULD applies for any deployment, not only runtime-only).
- Mention the ACT manifest URL in `robots.txt` as a comment (informational; robots.txt does not parse non-`User-agent` / `Allow` / `Disallow` directives normatively, but the comment is human-readable).

These are SHOULD-language because the sitemap path has no legacy surface to deprecate; the visibility tasks are the migration's main artifact.

#### Path (c) — From MCP-only to ACT (paired with PRD-602)

**PRD-801-R12.** When migrating from an MCP-only deployment, the producer MUST land PRD-602 (the ACT-MCP bridge) before declaring the migration complete. Specifically:

- The Advertise phase begins when both the ACT manifest and a PRD-602-conformant bridge are reachable.
- The bridge MUST expose every MCP resource that represents agent-readable content as an ACT node (subject to the URL coverage rule in R5).
- The MCP server continues to serve all of its existing resources unchanged during dual-publish.

**PRD-801-R13.** Discovery during the MCP path: the ACT manifest MUST declare `delivery: "runtime"` when the underlying MCP server is runtime-only (which it typically is). The runtime hand-off (PRD-101-R5: `Link: rel="act"` on every authenticated response) MUST be added to the existing MCP server's HTTP responses, or to whatever HTTP surface the deployment exposes for discovery. If the MCP server has no HTTP surface (e.g., stdio-only MCP), the producer MUST stand up an HTTP discovery surface as part of the migration; PRD-101-R8 (the consumer discovery flow) requires an HTTP entry point.

**PRD-801-R14.** Turn-down of the MCP server is OPTIONAL. The expected steady state is **coexistence**: ACT serves cacheable read content; MCP serves live tools and side-effectful operations. PRD-602's bridge unifies them. If the producer chooses to turn down MCP after migration:

- The turn-down MUST follow PRD-108's deprecation discipline (announce in MINOR M.n; remove at MAJOR (M+1).0 earliest from MCP consumers' standpoint).
- The turn-down MUST be announced via the `000-governance` channel at least one MINOR cycle in advance.
- MCP-only consumers (those that do not implement the ACT-MCP bridge from the consumer side) MUST be given the dual-publish window in R4 to migrate.

The expected case is that MCP is **kept**; PRD-801 path (c) is therefore most often a non-Turn-down migration, similar to path (b).

### Wire format / interface definition

_Not applicable — non-wire-format PRD; rules are policy, not protocol._

### Errors

| Condition | Producer outcome | Notes |
|---|---|---|
| Producer attempts Turn-down with PRD-600 errors | Migration is non-conformant; producer MUST NOT proceed to Turn-down | Per R3. |
| Producer publishes ACT but breaks `/llms.txt` (path a) | Migration is non-conformant; the legacy surface must remain stable through Validate | Per R2. |
| Dual-publish surfaces drift on URL coverage (path a or b) | Migration is non-conformant per R5 | PRD-600 may probe both surfaces and emit a warning when run with `--migration-check` mode (operational option, not normative). |
| MCP server turned down before PRD-602 lands (path c) | Migration is non-conformant; PRD-602 must be Implemented and reachable before MCP turn-down | Per R12 + R14. |
| Turn-down announced with less than one MINOR cycle (or 90 days) of notice | SHOULD-violation; not a hard rejection but operators are advised against | Per R4 + R8/R14. |

PRD-801 introduces no HTTP responses; failures surface as PRD-600 reports and as community feedback in the `000-governance` channel.

---

## Examples

### Example 1 — Path (a): docs site migrating from `/llms.txt` to ACT (Standard)

A documentation site at `docs.example.com` already serves `/llms.txt` listing 200 pages.

**Advertise (week 0):**
- Operator publishes `/.well-known/act.json` with `conformance.level: "standard"`, `delivery: "static"`.
- Index lists all 200 pages under their existing canonical URLs.
- Subtree endpoint advertised at `/act/sub/{id}.json` (Standard requirement).
- `/llms.txt` is updated with a top-of-file link: `- [ACT manifest](/.well-known/act.json): structured agent-readable index`.
- Both surfaces serve.

**Validate (weeks 1–2):**
- Operator runs `act-validate https://docs.example.com/.well-known/act.json` (PRD-600).
- First run: 12 errors (missing `summary` on five nodes, three malformed ETags, two missing subtree files, two `id` grammar violations). Operator fixes.
- Second run: zero errors, four warnings (summary length over the SHOULD threshold from PRD-102). Operator accepts the warnings.
- Validate phase complete.

**Turn-down (months 3–6):**
- Operator decides to keep `/llms.txt` indefinitely (R8 OPTIONAL turn-down).
- Migration declared complete; announced in the `000-governance` GitHub Discussions channel.

### Example 2 — Path (b): marketing site adding ACT alongside its sitemap (Core)

A marketing site at `acme.example` has `/sitemap.xml` listing 60 pages.

**Advertise (week 0):**
- Operator publishes `/.well-known/act.json` with `conformance.level: "core"`, `delivery: "static"`.
- Index lists the 60 sitemap-listed pages, minus binary downloads.
- Homepage HTML gains `<link rel="act" href="/.well-known/act.json">`.
- Sitemap is unchanged.

**Validate (week 1):**
- Operator runs PRD-600. Zero errors after one pass. Migration is additive — no Turn-down phase.

**Steady state:**
- Sitemap and ACT manifest are both maintained indefinitely.

### Example 3 — Path (c): SaaS workspace migrating MCP-only to MCP + ACT (Standard runtime)

A B2B SaaS at `app.acme.example` runs an MCP server exposing 1,400 documents per workspace.

**Advertise (week 0):**
- Operator stands up the ACT-MCP bridge (PRD-602): a thin layer that translates MCP resource catalog entries into ACT index entries and MCP `resources/get` responses into ACT node envelopes.
- ACT manifest at `/.well-known/act.json` declares `delivery: "runtime"`.
- Authenticated responses gain the `Link: rel="act"` header per PRD-101-R5.
- MCP server unchanged.

**Validate (weeks 1–4):**
- Operator runs PRD-600 against the runtime profile with valid credentials. Iterates through 47 errors (mostly per-tenant ETag determinism issues per PRD-103) and lands at zero errors.
- Validate complete.

**Steady state (R14):**
- MCP server retained (live tools, side-effectful operations).
- ACT serves cacheable reads via the bridge.
- No Turn-down planned.

If the operator later decides to turn down MCP entirely (unusual), they would:
- Announce in `000-governance` channel ≥1 MINOR cycle ahead.
- Provide the dual-publish window per R4.
- Coordinate with MCP-only consumers via the bridge's documentation.

### Example 4 — A non-conformant migration (path a, premature Turn-down)

A docs site removes `/llms.txt` in week 0 of the migration, before publishing ACT. This violates R2 (the legacy surface must remain stable through Validate) and would also violate R3 if Turn-down were claimed without PRD-600 conformance. Consumers fetching `/llms.txt` see 404; consumers fetching `/.well-known/act.json` see 404 too because ACT is not yet up. The migration is non-conformant.

The operator's recovery: restore `/llms.txt`, then follow R1's three-phase sequence in order.

---

## Test fixtures

Process / policy PRD; the rules are partly testable via PRD-600 in a "migration mode" and partly procedural. Fixtures live under `fixtures/801/` and exercise the URL-coverage rule (R5) and the validator-green precondition (R3).

### Positive

- `fixtures/801/positive/llms-txt-with-act-link.txt` → `/llms.txt` snapshot containing the recommended link to `/.well-known/act.json`. Satisfies R7.
- `fixtures/801/positive/url-coverage-overlap.json` → a synthetic dataset listing URLs from a legacy surface and from an ACT index; the two sets are equal. Satisfies R5.
- `fixtures/801/positive/validator-green-then-turndown.json` → a captured PRD-600 report with zero errors, followed by a turn-down announcement timestamp ≥1 MINOR cycle later. Satisfies R3 + R4.

### Negative

- `fixtures/801/negative/turndown-with-validator-errors.json` → a captured PRD-600 report with 3 errors, paired with a turn-down announcement. Violates R3.
- `fixtures/801/negative/url-coverage-gap.json` → a synthetic dataset where the legacy surface lists 50 URLs and ACT lists only 30. Violates R5.
- `fixtures/801/negative/llms-txt-broken-during-advertise.json` → a captured `/llms.txt` returning 404 during the Advertise phase. Violates R2.
- `fixtures/801/negative/mcp-turndown-no-bridge.json` → a captured deployment timeline showing MCP turn-down before PRD-602 implementation. Violates R12 + R14.

---

## Versioning & compatibility

| Kind of change | MAJOR/MINOR | Notes |
|---|---|---|
| Add a new migration path (e.g., from schema.org JSON-LD only) | MINOR | Additive. Existing paths are unchanged. |
| Tighten the dual-publish window from SHOULD to MUST | MAJOR | Per PRD-108-R5(3). Forces operators into a longer dual-publish than they may want. |
| Loosen R3 (validator-green precondition) from MUST to SHOULD | MAJOR | Existing consumers depend on the guarantee that turned-down legacy surfaces had a validated successor. |
| Change the recommended dual-publish duration (one MINOR cycle / 90 days) | MINOR | The recommendation is SHOULD-language; tuning is additive. |
| Add a new phase to the three-phase sequence (e.g., Pre-advertise) | MAJOR | Changes the procedural contract operators rely on. |
| Add a new path-specific requirement that does not apply to existing paths | MINOR | Additive. |
| Change the URL-coverage rule (R5) from "complete overlap" to "≥90% overlap" | MAJOR | Loosens a MUST. |
| Editorial: example URLs, prose clarifications, fixture renames | n/a | Per `000-governance` R18. |

### Forward compatibility

A migration begun under PRD-801 v0.1 remains valid under future MINORs of PRD-801. New paths added in future MINORs do not retroactively constrain ongoing migrations. Operators MAY adopt new SHOULDs added in future MINORs without redoing their migration.

### Backward compatibility

Within a MAJOR, an operator following an earlier MINOR's playbook continues to satisfy PRD-801 against the consumer ecosystem. PRD-801's normative requirements are written as point-in-time obligations on the producer; once a migration completes, the producer is past PRD-801's surface and is governed by the wire-format PRDs alone.

---

## Security considerations

- **Dual-publish content leakage.** During the dual-publish window, both surfaces are reachable. A producer that intends to restrict some content in the ACT surface (e.g., gating behind authentication on the runtime profile) MUST also restrict it on the legacy surface; a path covered by `/llms.txt` is publicly fetchable. Producers SHOULD audit URL coverage for sensitivity before beginning Advertise. Cite PRD-109 for the project-wide non-leak posture.
- **Trust transfer between surfaces.** Consumers that follow `/llms.txt` to a manifest URL inherit the legacy surface's trust posture: if `/llms.txt` was served over HTTPS but the producer accidentally mounted ACT under HTTP, the consumer's trust evaluation may be defeated. Producers MUST serve all surfaces over the same scheme and host during the migration.
- **MCP path: bridge as a blast-radius extender.** The ACT-MCP bridge (PRD-602) re-exposes MCP resources as ACT nodes, which means a previously MCP-only resource becomes cacheable and follows ACT's per-tenant ETag rules (PRD-103). Operators MUST verify that no MCP resource exposed via the bridge contains content that was implicitly relying on MCP's live, non-cacheable nature for security (e.g., a one-time reveal). PRD-602 owns the threat-model details; PRD-801-R12 surfaces the consideration at the migration moment.
- **Robots.txt during turn-down.** When `/llms.txt` is turned down (R8) with a redirect to `/.well-known/act.json`, the producer MUST ensure `robots.txt` permits `/.well-known/act.json`. A redirect to a path disallowed by robots.txt would surprise PRD-800-R4-honoring agents.
- **Announcement spoofing.** R8 / R14 rely on the `000-governance` GitHub Discussions channel for turn-down announcements. PRD-802 (RFC process) covers the authenticity expectations for that channel; PRD-801 inherits.

PRD-801 introduces no new threat surface beyond the items above; its security posture is downstream of PRD-109 (project-wide) and PRD-109's per-PRD inheritance pattern.

---

## Implementation notes

_Not applicable — non-implementation PRD._

---

## Changelog

| Date | Author | Change |
|---|---|---|
| 2026-05-02 | Jeremy Forsythe | Initial draft. Defines three migration paths to ACT — from `/llms.txt`, from sitemap-only, and from MCP-only — each as a three-phase sequence (Advertise → Validate → Turn-down). Pins PRD-600 conformance as the gate before Turn-down (R3); requires URL-coverage overlap during dual-publish (R5); recommends one-MINOR-cycle / 90-day window (R4) keyed to PRD-108-R12. Path (a) requires `/llms.txt` to link to `/.well-known/act.json` during dual-publish (R7); turn-down of `/llms.txt` is optional. Path (b) is additive — sitemap is permanent — and the migration ends at Validate. Path (c) requires PRD-602 (the ACT-MCP bridge) before completion (R12); the expected steady state is MCP + ACT coexistence. Status: Draft → In review. |
| 2026-05-02 | Jeremy Forsythe | Status: In review → Accepted. BDFL sign-off (per 000-governance R11). |
