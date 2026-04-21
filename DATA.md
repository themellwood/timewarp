# Time Warp — public dataset

Every hour-submission made through the Time Warp app is anonymized and pooled
into a public dataset. Anyone — journalists, researchers, curious hobbyists —
can download it without signing up, without asking, without an API key.

**Licence:** [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
Use it for anything. Attribution is appreciated but not required.

No account, no tracking, no advertising ID. A submission carries only: an
anonymous per-device UUID (not linked to anything else), the moment it was
submitted, how long the last hour *felt*, and the optional demographics the
user volunteered on first run.

## Endpoints

Hosted on Cloudflare R2. Replace `data.example.com` with the actual data
subdomain once the Worker is deployed (see `worker/README.md`).

| URL                                                 | Refresh    | Format           |
|-----------------------------------------------------|------------|------------------|
| `https://data.example.com/world/latest.json`        | hourly     | JSON aggregate   |
| `https://data.example.com/cohorts/latest.json`      | hourly     | JSON             |
| `https://data.example.com/export/YYYY-MM-DD.csv`    | daily 00:05 UTC | CSV         |
| `https://data.example.com/export/index.json`        | daily      | list of URLs     |

Every response has `Access-Control-Allow-Origin: *`, so you can fetch from a
browser without a proxy.

## Submission row schema (CSV + D1)

| column       | type     | notes                                              |
|--------------|----------|----------------------------------------------------|
| `id`         | int      | monotonic                                          |
| `anon_id`    | string   | 36-char UUID, device-local, rotates if user resets |
| `ts`         | int      | unix seconds (server-stamped)                      |
| `stretch`    | float    | `-1` = hour vanished, `0` = felt like an hour, `+1` = endless |
| `minutes`    | int      | felt duration in minutes                           |
| `label`      | string   | e.g. `Flew by`, `Dragged`, `As it was`             |
| `tz`         | string   | IANA timezone of the device                        |
| `hemisphere` | `N` / `S`| derived from `tz`                                  |
| `age_bucket` | string   | nullable; `<18` `18-24` `25-34` `35-49` `50-64` `65+` |
| `gender`     | string   | nullable; `woman` `man` `non-binary` `prefer not to say` |
| `interests`  | JSON str | array of tags: `meditation` `creative` `shift-work` `night-owl` `parent` `athlete` `student` `caregiver` `remote-work` `commuter` |

## Aggregate JSON shape

```json
{
  "generatedAt": 1712345678901,
  "windowHours": 24,
  "totalUsers": 2100000,
  "feltHours": 26.4,
  "hemisphere": { "northAvg": -0.12, "southAvg": 0.08, "diffPct": -4 },
  "regions": [
    { "name": "Tokyo", "lat": 35, "lng": 139, "s": 0.38 }
  ],
  "patterns": {
    "age":       [{ "key": "50-64", "avg": 0.42, "n": 18420 }],
    "gender":    [{ "key": "woman", "avg": -0.15, "n": 201030 }],
    "interests": [{ "key": "meditation", "avg": 0.02, "n": 12405 }]
  }
}
```

## Quickstart

```bash
# Most recent world aggregate
curl -s https://data.example.com/world/latest.json | jq '.feltHours'

# Yesterday's raw rows
curl -O https://data.example.com/export/$(date -u -d 'yesterday' +%F).csv

# List of every daily dump available
curl -s https://data.example.com/export/index.json | jq '.files'
```

## What's *not* here

- No IP addresses.
- No advertising identifiers.
- No names, emails, or social handles (the app never asks).
- No device fingerprint beyond the per-device UUID.
- No lat/lng. Location is coarsened to IANA timezone / hemisphere only.

If you have questions, or you want to build something on top of this data,
open an issue on the repo.
