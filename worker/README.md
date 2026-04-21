# Time Warp — backend

Single Cloudflare Worker that accepts hourly submissions, stores them in D1,
and publishes hourly aggregates + daily CSV dumps to a public R2 bucket.

Free tier: fine for the first ~100k submissions/day.

## One-time setup

```bash
cd worker
npm install

# Log in Cloudflare (opens a browser).
npx wrangler login

# Provision storage.
npx wrangler d1 create timewarp_db
# → paste the returned database_id into wrangler.toml
npx wrangler r2 bucket create timewarp-public

# Apply the schema.
npm run db:apply

# Deploy the Worker.
npm run deploy
```

In the Cloudflare dashboard, attach a custom domain to the Worker
(`api.<your-domain>`) and another to the R2 bucket (`data.<your-domain>`). Both
can also be left on their `.workers.dev` / `.r2.dev` defaults — the frontend
reads the URLs from `window.TW_API_BASE` / `window.TW_DATA_BASE` with sensible
defaults, so it's a single-file change in `../api.js`.

## Routes

| Method | Path                    | Purpose                                            |
|--------|-------------------------|----------------------------------------------------|
| POST   | `/submit`               | Append one hour-submission. 50-min per-device rate limit. |
| GET    | `/world/latest.json`    | Latest 24h aggregate (also served directly from R2). |
| GET    | `/cohorts/latest.json`  | Latest cohort slices.                              |
| GET    | `/health`               | 200 ok.                                            |

All responses include `Access-Control-Allow-Origin: *` — the data is public.

## Cron

- `0 * * * *` — hourly: recompute `world/latest.json` + `cohorts/latest.json`.
- `5 0 * * *` — daily: dump previous UTC day to `export/YYYY-MM-DD.csv`, refresh `export/index.json`.

Trigger manually while developing:

```bash
npm run agg:test
```

## Local dev

```bash
npm run dev               # runs the Worker on localhost:8787
npm run db:apply:local    # applies schema to the local D1 replica

# From the frontend, serve the static files and point the client at the local worker:
#   window.TW_API_BASE  = 'http://localhost:8787'
#   window.TW_DATA_BASE = 'http://localhost:8787'  # /world/latest.json still works
```
