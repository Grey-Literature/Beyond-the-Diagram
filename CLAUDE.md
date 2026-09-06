# CLAUDE.md — Beyond the Diagram (repo root)

## What this repo is

An IT fundamentals & troubleshooting learning platform — teaches protocol/system mechanism *and* diagnostic methodology, and uses a troubleshooting-game layer (Cases) to test the second using the first. Sibling in spirit to `webApps/portfolio/` (same author, same vault), but a serious standalone educational tool rather than a toy/game portfolio piece — don't carry over portfolio conventions (easter-egg protocol, whimsical tone) here without deliberately deciding to.

## Source of truth

**`it-troubleshooting-platform-concept.md` is canonical.** It's the full design doc — origin/vision, difficulty tiering, the three content types (Labs/Cases/Classification Drills), cross-cutting concepts (Signal vs. Silence, Eventual Consistency, Fail-Open vs. Fail-Closed, Trust-Boundary Flattening), named diagnostic methodology, the AI-fluency module, home-lab track, domain module content, and its own "Open Design Questions" section (scope and version-pinning strategy are still undecided; tech stack is resolved — see Structure section below and ROADMAP.md Phase 1). Don't duplicate its content into other docs; reference it instead. If code/implementation ever disagrees with it, flag the discrepancy rather than silently reconciling.

`ROADMAP.md` translates that concept doc into a phased backlog. Update the roadmap as phases complete or priorities shift; the concept doc itself should stay a stable reference, not a running task list.

## Structure — resolved: static-first with React islands (Phase 1)

Tech stack question is resolved. Not "fully static" or "fully React" — split by whether a piece of content actually holds state:

- **Static, no JS**: everything without a state machine — Labs prose, cross-cutting concept pages, domain module content, nav, landing. Includes the AI Fluency module: it's a paired weak-prompt/strong-pull-prompt example plus "now run both yourself against your own AI tool," never a live model call, so it never needed a backend or API key in the first place. Authored as plain HTML/CSS for now; revisit a static-site generator only once page count makes hand-authoring genuinely painful.
- **React, one isolated component per content type**: only where there's real state to hold — Cases (investigation path + score, process scored separately from outcome), Classification Drills (attempt + feedback), the placement quiz (answers → per-module tier, behavioral not self-reported). Each is a separate Vite entry point mounted into a `<div id="...">` on an otherwise-static page — not one SPA with a router owning the whole site. `app/`'s job is to build these bundles, not to be the app.
- **State persistence**: localStorage only, scoped to the browser. No accounts, no backend, resets on a cleared cache or a new device — that's the deliberate tradeoff for this stage, not an oversight. A shared, small localStorage wrapper module belongs in `app/src/`, imported by whichever island needs it, rather than each island rolling its own key scheme.

The stock Vite+React+TS template (counter demo, logos, docs/social links) has been stripped. `app/` now builds one real island — `src/islands/drill-401-403/` (a Classification Drill on the HTTP 401-vs-403 "label lies to you" case) — as the reference pattern for the rest: a component + `main.tsx` mount entry, colocated scoped CSS (never element-level selectors — the bundle mounts into someone else's page), registered as an entry in `vite.config.ts`, previewable via the dev-only sandbox at `app/index.html`. See `app/README.md` for the exact steps to add another island (Case, placement quiz). `src/lib/progress.ts` is the shared localStorage wrapper every stateful island should use rather than rolling its own key scheme — the Drill island already does.

## Case-sensitivity (deploy-time gotcha)

Same caveat as the portfolio repo: local dev is likely Windows (case-insensitive), GitHub Pages is Linux (case-sensitive). Verify on-disk casing matches link casing exactly before committing.
