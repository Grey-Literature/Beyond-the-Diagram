# app/ — islands

This is not a single-page app. It's a build tool for **React islands**: small,
independently-mounted bundles for the pieces of the platform that actually
hold state (Cases, Classification Drills, the placement quiz). Everything
else — Labs, concept pages, nav, the landing page — is plain static HTML/CSS
elsewhere in the repo. See the root [`CLAUDE.md`](../CLAUDE.md) for the full
rationale.

## Adding a new island

1. `src/islands/<name>/` — a component plus a `main.tsx` that mounts it into
   `document.getElementById('<name>-root')`. See `drill-401-403/` for the
   pattern.
2. Colocate scoped CSS with the component (`Component.css`, imported by the
   component file) — never write element-level selectors (`body`, `button`,
   ...) that could leak into whatever static page ends up embedding the
   bundle.
3. Register the entry in `vite.config.ts`'s `islands` object.
4. Add a mount div + `<script type="module">` tag to `index.html` so you can
   preview it locally with `npm run dev`. That file is a dev-only sandbox —
   it's not part of the production build and never gets deployed.
5. Use `src/lib/progress.ts` for any state that should survive a reload
   (localStorage-backed, browser-scoped — no accounts, no backend).

## Commands

```bash
npm run dev      # sandbox at index.html, all registered islands mounted
npm run build     # builds each island to dist/islands/<name>.js
npm run preview   # serves the dist/ build
```

## Deploy

`.github/workflows/deploy.yml` builds this on every push to `main` and
assembles the deployed site from the repo root's hand-written pages plus
`dist/islands/`. Nothing here gets committed to git — see root `CLAUDE.md`.
`../islands-demo.html` references the built paths directly, so it's only
meaningful once deployed (or against a local static simulation of the
assembled site) — use `index.html` here for day-to-day dev instead.
