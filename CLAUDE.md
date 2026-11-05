# sylvenndt/apps

Personal phone apps (PWAs) for the owner, published via GitHub Pages at https://sylvenndt.github.io/apps/ (branch `main`, root).

Conventions:
- Each app lives in its own folder (`<app-slug>/`) with its own `index.html`, `manifest.json` (start_url/scope `./`), icons and optional `sw.js`, so it can be added to the home screen on its own.
- Register every new app in the `APPS` array in the root `index.html` (path, name, desc, icon, color).
- UI text in Simplified Chinese; mobile-first; no build step — plain static files.
- Commit and push to `main`; Pages redeploys automatically in ~1 minute.
