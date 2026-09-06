# Beyond the Diagram

An IT fundamentals & troubleshooting platform, built on a simple observation: cloud-native curricula have gotten very good at teaching the portal UI and very quiet about the mechanism underneath it. That produces technicians who can click through a console but can't reason from a vague symptom ("it's slow," "I can't log in") to a root cause — and who don't reflexively check logs, firmware, or basic diagnostic commands before escalating or guessing.

This platform teaches both halves: the *mechanism* (how DHCP, DNS, AD, and the rest actually work — as commands and log lines you'd see in the field, not as a diagram) and the *methodology* (how to reason from symptom to cause) — and tests the second using the first.

## Status

🚧 **Phases 1–5 are complete.** All nine domain modules from the concept doc are built — DHCP, DNS, Email Authentication, AD/GPO, Cloud Identity, Monitoring, Authn/Authz, Remote Access/VPN, and Abstracted Networking Gear — each a full Lab + Case + Classification Drill, browsable from the landing page. `/concepts/` holds the cross-cutting patterns (Signal vs. Silence, Eventual Consistency, Fail-Open vs. Fail-Closed, Trust-Boundary Flattening) and named diagnostic methodology that every module links into instead of re-explaining. Every module also has its own behavioral placement quiz now, linked from its `index.html` — per-module tiering is proven for real: two different modules' quizzes place a learner into genuinely different, independently-persisted tiers, not one shared global result. The AI-fluency module (`ai-fluency/`) is built too, and it's the largest one — organized around four competencies (Delegation, Description, Discernment, Diligence) rather than prompting alone: six Labs, three Cases, three Drills and its own placement quiz. It covers deciding whether to involve an AI at all, the pull-prompt, judging the answer *and* the reasoning behind it, the agentic boundary between advice and action, and two underlying literacies (packet captures, browser consoles). Nothing in it calls a model: the prompt comparisons are worked examples you then run yourself against your own AI tool. What's left: the home-lab track (Phase 6) hasn't started, and two open product questions (public vs. internal scope, version/vendor-drift strategy) are still unresolved. See [ROADMAP.md](ROADMAP.md) for the working plan and [it-troubleshooting-platform-concept.md](it-troubleshooting-platform-concept.md) for the full design concept this is built from.

Live at: [beyondthediagram.rosettaskeys.com](https://beyondthediagram.rosettaskeys.com) *(once GitHub Pages' source is switched to "GitHub Actions" in this repo's settings)*

## Structure

- [`it-troubleshooting-platform-concept.md`](it-troubleshooting-platform-concept.md) — the source design doc. Origin/vision, content architecture (Labs / Cases / Classification Drills), cross-cutting concepts, domain modules, and open design questions. This is the canonical reference; other docs here summarize or operationalize it rather than repeating it.
- [`ROADMAP.md`](ROADMAP.md) — phased build plan derived from the concept doc.
- `index.html` — plain static landing page (no build step), deployed as-is via GitHub Pages.
- `assets/site.css` — shared tokens/reset for the hand-written static pages (landing, domain modules, Labs).
- `dhcp/`, `dns/`, `email-auth/`, `ad-gpo/`, `cloud-identity/`, `monitoring/`, `authn-authz/`, `remote-access/`, `prosumer-networking/` — the nine domain modules: `index.html` (module landing) plus one page per content item (Lab, Case, Drill, and a `placement-quiz.html` — DHCP and DNS share one, since the concept doc groups them as a single placement tier).
- `ai-fluency/` — same shape, but a meta-skill rather than a tenth domain, and grouped by competency rather than a flat list: six Labs, three Cases, three Drills and a placement quiz.
- `concepts/` — cross-cutting reference material every domain module links into (Signal vs. Silence, Eventual Consistency, Fail-Open vs. Fail-Closed, Trust-Boundary Flattening, named diagnostic methodology) rather than each module re-explaining these from scratch.
- `islands-demo.html` — a QA page referencing every built island bundle directly; only meaningful once deployed (see `.github/workflows/deploy.yml`).
- `app/` — Vite + React + TypeScript islands (see `app/README.md`). Built here, deployed alongside the static pages above by CI — see root `CLAUDE.md` for the full split.
- `.github/workflows/deploy.yml` — builds `app/` and deploys the assembled site to GitHub Pages on every push to `main`.

## Local dev

The landing page needs nothing — open `index.html` directly.

For the app scaffold:

```bash
cd app
npm install
npm run dev
```
