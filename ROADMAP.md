# Roadmap

A working backlog, not a spec. A lot of this is genuinely undecided per the concept doc's own [Open Design Questions](it-troubleshooting-platform-concept.md#open-design-questions) — this roadmap carries those forward explicitly rather than forcing premature answers.

## Phase 0 — Foundations (done)

- [x] Git repo initialized, wired to `Grey-Literature/Beyond-the-Diagram`
- [x] Repo scaffolding: README, this roadmap, root CLAUDE.md
- [x] Plain static "under construction" landing page (`index.html`), deployable as-is via the existing CNAME
- [x] Vite + React + TypeScript scaffold in `app/` — exploratory, unwired from deployment

## Phase 1 — Tech skeleton

Resolve enough of the stack question to start building for real. Doesn't need to be the final answer, just enough to stop blocking content work.

- [x] Decide: fully static site, fully React app, or hybrid — **hybrid**. Static for anything without state (Labs, concept pages, AI Fluency module — that one's a static prompt-comparison example, no live model call, no backend needed); React only for Cases/Drills/placement quiz, each its own independently-mounted island, not one SPA with a router. Full description in CLAUDE.md.
- [x] Strip `app/`'s stock Vite+React template (counter demo, logos, docs/social links); reconfigure as a multi-entry build — one entry per island — instead of a single-page app
- [x] Build the shared localStorage progress/state wrapper (`src/lib/progress.ts`, browser-scoped, no accounts) that islands import
- [x] First island working end-to-end: **Classification Drill** (`src/islands/drill-401-403/`) — HTTP 401-vs-403 case, verified in-browser including localStorage persistence across reload
- [ ] Second island: a **Case** (investigation path + score, process scored separately from outcome)
- [ ] Third island: the **placement quiz** (behavioral tier inference)
- [ ] Decide on hosting/deploy path now that `app/` produces real build output: still GitHub Pages with built JS committed alongside the hand-written HTML, or a GitHub Action that builds `app/` on push and drops output where the static pages reference it? (Currently on GitHub Pages fronted by Cloudflare proxy/DNS, not Cloudflare Pages.)

## Phase 2 — First vertical slice

Prove the content model works end-to-end before scaling it across domains. DHCP is the most fully fleshed-out domain in the concept doc — good first candidate.

> Note: Phase 1's Classification Drill (HTTP 401 vs. 403) was built to prove the islands mechanism itself, not as this phase's DHCP content — it's from the authn/authz domain, not DHCP. This phase still needs its own DHCP-domain Drill.

- [ ] One **Lab** (e.g. configure a DHCP scope, watch a lease expire, watch APIPA fallback)
- [ ] One **Case** (e.g. not-leasing → APIPA fallback, withheld diagnosis, symptom-only)
- [ ] One DHCP-domain **Classification Drill** (e.g. a verbatim error string classification exercise)
- [ ] Confirm the three content types actually fit a single reusable component/data shape, or diverge enough to need separate ones

## Phase 3 — Placement & tiering

- [ ] Design the behavioral placement quiz (show real symptoms/error strings, infer tier from what the learner reaches for — not self-report)
- [ ] Per-module tiering (not global) — a learner can place as veteran in networking and beginner in AD/GPO
- [x] Tier state persists via localStorage, browser-scoped — decided in Phase 1

## Phase 4 — Scale out content

- [ ] Remaining domain modules from the concept doc: DNS, email auth (SPF/DKIM/DMARC), AD/GPO, cloud identity (Entra/Intune), monitoring, authn/authz, remote access/VPN, abstracted/prosumer networking gear
- [ ] Cross-cutting concepts taught once, referenced everywhere (Signal vs. Silence, Eventual Consistency, Fail-Open vs. Fail-Closed, Trust-Boundary Flattening)
- [ ] Named diagnostic methodology as its own reference material (half-splitting, substitution, top-down/bottom-up, "what changed," behavioral/temporal observation, classify-before-diagnose)

## Phase 5 — AI Fluency module

- [ ] The pull-prompt pattern (interview-style diagnosis, question+verification pairing) — implemented as a static weak-prompt vs. strong-prompt comparison, then "run both yourself"; no live model call, no API key, no backend
- [ ] Anti-easter-egging content angle: simulated AI suggestion as a plausible-but-wrong near-miss
- [ ] Packet capture + browser console log literacy sub-modules

## Phase 6 — Home lab / experimentation track

- [ ] Scope-of-trust checklist content (what stays local, why client creds/topology don't go near a cloud AI)
- [ ] Agent-injected fault sandbox concept — Guided mode (injecting agent stays in the loop) vs. Blind mode (fresh instance, full realism)
- [ ] Explicitly scoped as a bridge/individual-growth track, not a near-term platform priority

## Open questions carried forward (from the concept doc)

- **Tech stack** — resolved (hybrid: static + React islands; see CLAUDE.md). What's still open is the build/deploy mechanics — last bullet of Phase 1.
- **Scope** — internal tool for a specific team/org vs. broader public release. Affects tone, hosting, and whether the "Grey Literature" branding is public-facing.
- **Version/vendor drift strategy** — teach mechanism as timeless with drift as a named side-topic (leaning direction per the concept doc), vs. pinning cases to specific versions. Decide once enough case content exists to see how often drift actually bites.
- **Placement quiz content** — mechanism is decided (behavioral, not self-report); the actual scenario bank still needs writing (Phase 3).
