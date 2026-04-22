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
| GET    | `/me?anon_id=…`         | This device's last 30 days of submissions.         |
| GET    | `/world/latest.json`    | Latest 24h aggregate (also served directly from R2). |
| GET    | `/cohorts/latest.json`  | Latest cohort slices.                              |
| POST   | `/push/subscribe`       | Upsert a Web Push subscription + schedule.         |
| POST   | `/push/unsubscribe`     | Remove this device's subscription.                 |
| GET    | `/health`               | 200 ok.                                            |

All responses include `Access-Control-Allow-Origin: *` — the data is public.

## Cron

- `0 * * * *`   — hourly: recompute `world/latest.json` + `cohorts/latest.json`.
- `5 0 * * *`   — daily: dump previous UTC day to `export/YYYY-MM-DD.csv`, refresh `export/index.json`.
- `*/5 * * * *` — every 5 min: fan out Web Push to subscribers whose local time is inside their wake window.

Trigger manually while developing:

```bash
npm run agg:test
```

## Web Push (VAPID)

Time Warp sends background notifications via the standard [Web Push
protocol](https://datatracker.ietf.org/doc/html/rfc8291), authenticated
with VAPID. It works on Chrome (Android + desktop), Edge, Firefox, and
Safari 16.4+ (iOS installed PWAs). No third-party push service needed.

### 1. Generate a VAPID key pair (one-time)

```bash
npx web-push generate-vapid-keys
```

Copy the two base64url strings it prints.

### 2. Give the Worker its keys

```bash
# Private key — NEVER commit. Stored encrypted in Workers.
npx wrangler secret put VAPID_PRIVATE_KEY
# paste the "Private Key" value

# Public key — also a secret here so the Worker can include it in the
# VAPID Authorization header.
npx wrangler secret put VAPID_PUBLIC_KEY
# paste the "Public Key" value

# Subject — a mailto: URL or https: URL the push service can reach you at.
npx wrangler secret put VAPID_SUBJECT
# e.g. mailto:you@example.com
```

Re-deploy after setting secrets:

```bash
npx wrangler deploy
```

### 3. Give the client the public key

Paste the same **Public Key** into `../index.html`:

```html
<script>
  window.TW_VAPID_PUBLIC_KEY = 'BKx...yourPublicKey...';
</script>
```

Commit + deploy the static site. Existing installs will pick it up on
next page load (the `tw-v*` service-worker cache bump refreshes
`index.html`).

### 4. Verify

1. Open the PWA, Profile → Notifications. The diagnostics card should
   read `WEB PUSH · SUBSCRIBED`.
2. Tap **Send test ping** — immediate notification confirms permissions.
3. Wait for the next top-of-hour (hourly mode) or your deterministic
   daily slot. The Worker's `*/5` cron will send a real push even if
   the app is closed.
4. Check the `push_subscriptions` table:
   ```bash
   npx wrangler d1 execute timewarp_db --remote \
     --command "SELECT anon_id, mode, wake_start, wake_end, tz, daily_hour, daily_minute, last_pinged_at FROM push_subscriptions"
   ```

### Cost

A VAPID push is one outbound `fetch` from the Worker per subscriber per
ping. At 12 pings/day × 10k users that's 120k fetches/day — comfortably
inside Cloudflare's free tier. Each push service (FCM/Apple/Mozilla) is
free.

## Local dev

```bash
npm run dev               # runs the Worker on localhost:8787
npm run db:apply:local    # applies schema to the local D1 replica

# From the frontend, serve the static files and point the client at the local worker:
#   window.TW_API_BASE  = 'http://localhost:8787'
#   window.TW_DATA_BASE = 'http://localhost:8787'  # /world/latest.json still works
```
