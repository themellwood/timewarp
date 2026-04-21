# Time Warp

An installable Android PWA that asks, at a random moment in your day, *how
long did the last hour take?* — then pools every answer into a public dataset
anyone can use.

- **Prototype provenance:** originally designed in [Claude Design](https://claude.ai/design); see git history.
- **Frontend:** static HTML + CSS + React via CDN + JSX via Babel-standalone. No build step.
- **Install:** open the site on an Android phone, tap Chrome menu → *Install app*.
- **Backend:** a single Cloudflare Worker + D1 + R2. See [`worker/`](worker/).
- **Open data:** every submission ends up in public hourly + daily dumps. See [`DATA.md`](DATA.md).

## Run locally

```bash
python3 -m http.server 8000
# visit http://localhost:8000
```

The app runs without a backend — `api.js` falls back to bundled sample data if
the Worker is unreachable, so the World / Cohort screens always render.

## Hosting

- **Frontend:** GitHub Pages (see `.github/workflows/pages.yml`). Free, auto-deploys on push to `main`.
- **Backend:** Cloudflare Workers free tier (see `worker/README.md`).

Both defaults to `$0/mo` at real-world launch volumes.

## Layout

| Path                | Purpose                                          |
|---------------------|--------------------------------------------------|
| `index.html`        | App shell, SW registration, manifest link        |
| `styles.css`        | Neon Dream palette + typography                  |
| `orb.jsx`           | Jelly-orb soft-body capture                      |
| `screens-1.jsx`     | Lock, Onboarding, Demographics step              |
| `screens-2.jsx`     | Capture hero                                     |
| `screens-3.jsx`     | World aggregate, Week history, Cohort insights   |
| `capture-variants.jsx` | 5 alternative capture UIs                     |
| `profile.js`        | Anonymous UUID + demographics helpers            |
| `api.js`            | Submit + fetch public aggregates with fallback   |
| `notifications.js`  | Local daily ping scheduler                       |
| `sw.js`             | Service worker: shell cache + notification click |
| `manifest.webmanifest` | PWA install metadata                          |
| `icons/`            | Plasma-orb SVG icons                             |
| `worker/`           | Cloudflare Worker (D1 + R2 aggregation)          |
| `DATA.md`           | Public dataset docs                              |

## Privacy

No account, no tracking, no ad ID. A device is identified only by a random
UUID kept in `localStorage`; the user can clear it at any time (the app will
mint a new one). Demographics are optional. Data is public and CC0. See
[`DATA.md`](DATA.md).
