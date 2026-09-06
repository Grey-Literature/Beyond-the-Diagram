# Beyond the Diagram

An IT fundamentals & troubleshooting platform, built on a simple observation: cloud-native curricula have gotten very good at teaching the portal UI and very quiet about the mechanism underneath it. That produces technicians who can click through a console but can't reason from a vague symptom ("it's slow," "I can't log in") to a root cause — and who don't reflexively check logs, firmware, or basic diagnostic commands before escalating or guessing.

This platform teaches both halves: the *mechanism* (how DHCP, DNS, AD, and the rest actually work — as commands and log lines you'd see in the field, not as a diagram) and the *methodology* (how to reason from symptom to cause) — and tests the second using the first.

## Status

🚧 **Early / under construction.** Repo scaffolding is in place; content and app haven't been built yet. See [ROADMAP.md](ROADMAP.md) for the working plan and [it-troubleshooting-platform-concept.md](it-troubleshooting-platform-concept.md) for the full design concept this is built from.

Live at: *(domain pending — see `CNAME`)*

## Structure

- [`it-troubleshooting-platform-concept.md`](it-troubleshooting-platform-concept.md) — the source design doc. Origin/vision, content architecture (Labs / Cases / Classification Drills), cross-cutting concepts, domain modules, and open design questions. This is the canonical reference; other docs here summarize or operationalize it rather than repeating it.
- [`ROADMAP.md`](ROADMAP.md) — phased build plan derived from the concept doc.
- `index.html` — plain static landing page (no build step), deployed as-is via GitHub Pages.
- `app/` — Vite + React + TypeScript scaffold. Exploratory; not yet wired into the deployed site.

## Local dev

The landing page needs nothing — open `index.html` directly.

For the app scaffold:

```bash
cd app
npm install
npm run dev
```
