# Roadmap

A working backlog, not a spec. A lot of this is genuinely undecided per the concept doc's own [Open Design Questions](it-troubleshooting-platform-concept.md#open-design-questions) — this roadmap carries those forward explicitly rather than forcing premature answers.

## Phase 0 — Foundations (done)

- [x] Git repo initialized, wired to `Grey-Literature/Beyond-the-Diagram`
- [x] Repo scaffolding: README, this roadmap, root CLAUDE.md
- [x] Plain static "under construction" landing page (`index.html`), deployable as-is via the existing CNAME
- [x] Vite + React + TypeScript scaffold in `app/` — exploratory, unwired from deployment

## Phase 1 — Tech skeleton (done)

Resolve enough of the stack question to start building for real. Doesn't need to be the final answer, just enough to stop blocking content work.

- [x] Decide: fully static site, fully React app, or hybrid — **hybrid**. Static for anything without state (Labs, concept pages, AI Fluency module — that one's a static prompt-comparison example, no live model call, no backend needed); React only for Cases/Drills/placement quiz, each its own independently-mounted island, not one SPA with a router. Full description in CLAUDE.md.
- [x] Strip `app/`'s stock Vite+React template (counter demo, logos, docs/social links); reconfigure as a multi-entry build — one entry per island — instead of a single-page app
- [x] Build the shared localStorage progress/state wrapper (`src/lib/progress.ts`, browser-scoped, no accounts) that islands import — extended with a `meta` field (for process-vs-outcome scoring) and per-module tier storage as the second and third islands needed them
- [x] First island: **Classification Drill** (`src/islands/drill-401-403/`) — HTTP 401-vs-403 case
- [x] Second island: a **Case** (`src/islands/case-trust-relationship/`) — "trust relationship" error, investigate-then-diagnose flow, process scored separately from outcome via `Attempt.meta.processGood`
- [x] Third island: the **placement quiz** (`src/islands/placement-quiz/`) — 3 behavioral questions, tallies veteran-vs-less-seasoned signal, persists a per-module tier (`networking-fundamentals` is the only module wired up so far)
- [x] Decide on hosting/deploy path — **GitHub Actions**, not committed build output. `.github/workflows/deploy.yml` builds `app/` on push to `main`, assembles a `_site/` from the root's hand-written `index.html` + `CNAME` plus `app/dist/islands/`, and deploys via `actions/deploy-pages`. Verified locally end-to-end: built the islands, served the repo root as plain static files (no Vite dev server) via `python -m http.server`, and confirmed `islands-demo.html` mounts all three correctly from `/islands/*.js` — proves the actual deploy shape, not just the dev sandbox. Asset filenames are unhashed (`islands/assets/<name>.css`) specifically so a hand-written page can link them by a stable name.
- [ ] **Still needed, not done tonight:** enable GitHub Actions as the Pages source in the repo's own Settings → Pages (currently unset) — the workflow can't actually deploy until that's flipped on.

## Phase 2 — First vertical slice (done)

Prove the content model works end-to-end before scaling it across domains. DHCP is the most fully fleshed-out domain in the concept doc — good first candidate.

- [x] One **Lab** (`dhcp/lab-scope-lease-apipa.html`) — configuring a scope, the full lease renewal cycle (T1/T2), and what APIPA fallback actually means when nothing comes back. Plain static prose + code blocks, no component needed at all.
- [x] One **Case** (`dhcp/case-apipa-fallback.html`, island: `case-dhcp-apipa`) — "everyone on VLAN 20 has a 169 address," symptom-only, investigate-then-diagnose, process scored separately from outcome. Correct root cause is an upstream relay/`ip helper-address` misconfiguration, not the DHCP server itself.
- [x] One DHCP-domain **Classification Drill** (`dhcp/drill-dhcp-1059.html`, island: `drill-dhcp-1059`) — verbatim Event ID 1059 text, classify it as a fail-closed authorization race (correct) vs. a genuine deauthorization vs. an unrelated crash.
- [x] Confirm the three content types actually fit a single reusable component/data shape, or diverge — **they fit**: the DHCP Case and Drill are structurally identical to their Phase 1 proofs (same component shape, different content data — see `case-trust-relationship`/`case-dhcp-apipa` and `drill-401-403`/`drill-dhcp-1059`), while Labs need no component at all, confirming the Phase 1 hybrid split generalizes rather than being a one-off.
- [x] `dhcp/` established as the per-domain-folder convention (module landing page + one page per content item) — Phase 4's other domains should follow the same shape (`dns/`, `ad-gpo/`, ...)
- [x] Landing page (`index.html`) updated to link to the first real module instead of saying "nothing to click yet"
- [x] Caught and fixed a real gap in the Phase 1 deploy workflow: it only copied `index.html`/`CNAME`/built islands, so `assets/`, `dhcp/`, and `islands-demo.html` would have silently 404'd once deployed. Switched the assemble step from an explicit copy-list to an exclude-based `rsync` (skip `.git`, `.github`, `app/`, docs, etc., ship everything else) so a future new content folder ships automatically instead of needing the workflow edited every time. Verified both the exclude logic and the full page-to-page flow (landing → module → Lab → Case → Drill) against a local static-file simulation, not just the dev sandbox.

## Phase 3 — Placement & tiering

- [x] Behavioral placement quiz mechanism built in Phase 1 (`src/islands/placement-quiz/`) — 3 symptom/first-move questions, infers tier from what's chosen, not self-report. Only the **Networking Fundamentals** module is wired up so far.
- [ ] Per-module tiering is supported by the mechanism (`getPlacement`/`setPlacement` take a `moduleId`) but only proven for one module — still need a second module (e.g. AD/GPO) to confirm a learner can genuinely place differently across modules, not just in theory
- [ ] Write the real scenario bank once more domain modules exist (Phase 4) — the 3 questions built so far are a proof, not the final placement content
- [x] Tier state persists via localStorage, browser-scoped — decided in Phase 1

## Phase 4 — Scale out content (in progress)

- [x] Cross-cutting concepts taught once, referenced everywhere — `concepts/cross-cutting-concepts.html` (Signal vs. Silence, Eventual Consistency, Fail-Open vs. Fail-Closed, Trust-Boundary Flattening). Built *before* the next domain module on purpose, per the concept doc's own instruction that these should be taught early and linked from every module rather than re-derived per-protocol.
- [x] Named diagnostic methodology as its own reference material — `concepts/diagnostic-methodology.html` (half-splitting, substitution, top-down/bottom-up, "what changed," symptom vs. root cause, behavioral/temporal observation, classify-before-diagnose)
- [x] Retrofitted the **DHCP** module to actually link into the new concept pages (the Case's zero-DHCPOFFERs feedback now names Signal vs. Silence bucket 1; the Drill's Event 1059 feedback links Fail-Open vs. Fail-Closed) — confirms "referenced from every domain module" isn't just aspirational, it's something older content gets updated for too.
- [x] **DNS** domain module (`dns/`) — one Lab (`lab-resolution-split-horizon.html`: resolution chain, TTL, split-horizon, registrar cutover), one Case (`case-split-horizon-intranet.html`, island `case-dns-split-horizon` — "works from the office, not from home"), one Drill (`drill-dns-nxdomain.html`, island `drill-dns-nxdomain` — classifying NXDOMAIN as real signal, not ambiguous silence, linking directly to Signal vs. Silence)
- [ ] Remaining domain modules from the concept doc, not yet started: email auth (SPF/DKIM/DMARC), AD/GPO, cloud identity (Entra/Intune), monitoring, authn/authz, remote access/VPN, abstracted/prosumer networking gear
- [x] Caught and fixed a second real bug from putting the pieces together, same root cause as Phase 2's deploy-workflow gap (unhashed filenames) but a different asset type: two islands' CSS ended up byte-identical after both got the same `.drill a` link-color rule, and Rollup silently deduped them into one file — `drill-dns-nxdomain.css` would have 404'd on the real page. Fixed properly rather than just renaming around the collision: every island now inlines its CSS via `import styles from './Component.css?raw'` + `<style>{styles}</style>` instead of a linked stylesheet, so no CSS asset is emitted at all and the class of bug can't recur. All seven islands converted, all consuming pages' now-unnecessary `<link rel="stylesheet" href="/islands/assets/...">` tags removed. Caught by the same local dry-run practice as before — assembled `_site/`, served it standalone, clicked through every page — before pushing, not after.

## Phase 5 — AI Fluency module

- [ ] The pull-prompt pattern (interview-style diagnosis, question+verification pairing) — implemented as a static weak-prompt vs. strong-prompt comparison, then "run both yourself"; no live model call, no API key, no backend
- [ ] Anti-easter-egging content angle: simulated AI suggestion as a plausible-but-wrong near-miss
- [ ] Packet capture + browser console log literacy sub-modules

## Phase 6 — Home lab / experimentation track

- [ ] Scope-of-trust checklist content (what stays local, why client creds/topology don't go near a cloud AI)
- [ ] Agent-injected fault sandbox concept — Guided mode (injecting agent stays in the loop) vs. Blind mode (fresh instance, full realism)
- [ ] Explicitly scoped as a bridge/individual-growth track, not a near-term platform priority

## Open questions carried forward (from the concept doc)

- **Tech stack** — fully resolved: hybrid (static + React islands) and the build/deploy mechanics (GitHub Actions → GitHub Pages) both settled in Phase 1. Only remaining step is flipping on the Pages "GitHub Actions" source in repo settings.
- **Scope** — internal tool for a specific team/org vs. broader public release. Affects tone, hosting, and whether the "Grey Literature" branding is public-facing.
- **Version/vendor drift strategy** — teach mechanism as timeless with drift as a named side-topic (leaning direction per the concept doc), vs. pinning cases to specific versions. Decide once enough case content exists to see how often drift actually bites.
- **Placement quiz content** — mechanism is decided (behavioral, not self-report); the actual scenario bank still needs writing (Phase 3).
