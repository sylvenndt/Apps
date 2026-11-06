# sylvenndt/apps

Personal phone apps (PWAs) for the owner, published via GitHub Pages at https://sylvenndt.github.io/Apps/ (branch `main`, root).

Conventions:
- Each app lives in its own folder (`<app-slug>/`) with its own `index.html`, `manifest.json` (start_url/scope `./`), icons and optional `sw.js`, so it can be added to the home screen on its own.
- Register every new app in the `APPS` array in the root `index.html` (path, name, desc, icon, color).
- UI text in Simplified Chinese; mobile-first; no build step — plain static files.
- Commit and push to `main`; Pages redeploys automatically in ~1 minute.
- linking-practice (每日美语): its service worker is cache-first for versioned assets, so after changing any JS/CSS bump the `?v=N` query in `index.html` AND `V`/`CACHE` in `sw.js` together, or phones keep the old files. The SW also adds COOP/COEP headers so the Kokoro AI voice worker gets multithreaded WASM.
