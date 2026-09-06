# Beyond the Diagram

An IT fundamentals & troubleshooting platform, built on a simple observation: cloud-native curricula have gotten very good at teaching the portal UI and very quiet about the mechanism underneath it. That produces technicians who can click through a console but can't reason from a vague symptom ("it's slow," "I can't log in") to a root cause — and who don't reflexively check logs, firmware, or basic diagnostic commands before escalating or guessing.

This platform teaches both halves: the *mechanism* (how DHCP, DNS, AD, and the rest actually work — as commands and log lines you'd see in the field, not as a diagram) and the *methodology* (how to reason from symptom to cause) — and tests the second using the first.

## Status

🚧 **Early / under construction, but two real modules now, plus the shared reference material they both lean on.** Tech stack and deploy pipeline are decided (Phase 1); DHCP (Phase 2) and DNS (Phase 4) are each a full Lab + Case + Classification Drill, browsable at `/dhcp/` and `/dns/`; `/concepts/` holds the cross-cutting patterns (Signal vs. Silence, Eventual Consistency, Fail-Open vs. Fail-Closed, Trust-Boundary Flattening) and named diagnostic methodology that both modules link into instead of re-explaining. Six more domains from the concept doc are still unbuilt. See [ROADMAP.md](ROADMAP.md) for the working plan and [it-troubleshooting-platform-concept.md](it-troubleshooting-platform-concept.md) for the full design concept this is built from.

Live at: [beyondthediagram.rosettaskeys.com](https://beyondthediagram.rosettaskeys.com) *(once GitHub Pages' source is switched to "GitHub Actions" in this repo's settings)*

## Structure

- [`it-troubleshooting-platform-concept.md`](it-troubleshooting-platform-concept.md) — the source design doc. Origin/vision, content architecture (Labs / Cases / Classification Drills), cross-cutting concepts, domain modules, and open design questions. This is the canonical reference; other docs here summarize or operationalize it rather than repeating it.
- [`ROADMAP.md`](ROADMAP.md) — phased build plan derived from the concept doc.
- `index.html` — plain static landing page (no build step), deployed as-is via GitHub Pages.
- `assets/site.css` — shared tokens/reset for the hand-written static pages (landing, domain modules, Labs).
- `dhcp/`, `dns/` — domain modules: `index.html` (module landing) plus one page per content item (Lab, Case, Drill). The pattern the rest of Phase 4's domains will follow.
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
