/* Time Warp — Cloudflare Worker.
 * POST /submit  → append one row
 * GET  /world/latest.json → serve the cached aggregate from R2
 * POST /push/subscribe    → store a Web Push subscription + schedule
 * POST /push/unsubscribe  → remove a subscription
 * GET  /health  → 200 ok
 * Cron (hourly): recompute the aggregate.
 * Cron (daily):  dump yesterday's UTC rows to R2 as CSV.
 * Cron (5-min):  fan out Web Push notifications for due subscribers.
 */

import { sendPush, type VapidEnv, type PushSubscriptionRow } from './push';

export interface Env extends VapidEnv {
  DB: D1Database;
  PUBLIC: R2Bucket;
  FRONTEND_ORIGIN?: string;
}

const CORS: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...CORS, ...(init.headers || {}) },
  });
}

function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, n)); }

function stretchToLabelServer(s: number): string {
  if (s <= -0.85) return 'Vanished';
  if (s <= -0.55) return 'Flew by';
  if (s <= -0.2)  return 'Quick';
  if (s <  0.2)   return 'As it was';
  if (s <  0.55)  return 'Lingered';
  if (s <  0.85)  return 'Dragged';
  return 'Endless';
}

function validate(body: any): { ok: true; value: Submission } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'bad body' };
  const { anon_id, stretch, minutes, label, tz, hemisphere, age_bucket, gender, interests } = body;
  if (typeof anon_id !== 'string' || anon_id.length < 8 || anon_id.length > 64) return { ok: false, error: 'anon_id' };
  if (typeof stretch !== 'number' || !Number.isFinite(stretch)) return { ok: false, error: 'stretch' };
  if (typeof minutes !== 'number' || minutes < 0 || minutes > 600) return { ok: false, error: 'minutes' };
  if (typeof label !== 'string' || label.length > 32) return { ok: false, error: 'label' };
  if (typeof tz !== 'string' || tz.length > 64) return { ok: false, error: 'tz' };
  if (hemisphere !== 'N' && hemisphere !== 'S') return { ok: false, error: 'hemisphere' };
  const age = age_bucket == null ? null : String(age_bucket).slice(0, 16);
  const gen = gender == null ? null : String(gender).slice(0, 32);
  const tags: string[] = Array.isArray(interests)
    ? interests.filter((x) => typeof x === 'string').slice(0, 20).map((x) => x.slice(0, 32))
    : [];
  return {
    ok: true,
    value: {
      anon_id,
      stretch: clamp(stretch, -1, 1),
      minutes: Math.round(minutes),
      label: stretchToLabelServer(clamp(stretch, -1, 1)) || label,
      tz,
      hemisphere,
      age_bucket: age,
      gender: gen,
      interests: tags,
    },
  };
}

interface Submission {
  anon_id: string;
  stretch: number;
  minutes: number;
  label: string;
  tz: string;
  hemisphere: 'N' | 'S';
  age_bucket: string | null;
  gender: string | null;
  interests: string[];
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === '/health') return json({ ok: true });

    // Temporary: manually trigger aggregate (remove after first use)
    if (url.pathname === '/admin/aggregate' && req.method === 'POST') {
      await aggregate(env);
      return json({ ok: true, ran: 'aggregate' });
    }

    if (url.pathname === '/submit' && req.method === 'POST') {
      let body: any;
      try { body = await req.json(); }
      catch { return json({ error: 'invalid json' }, { status: 400 }); }

      const v = validate(body);
      if (!v.ok) return json({ error: v.error }, { status: 400 });

      const now = Math.floor(Date.now() / 1000);
      // Per-device rate limit: one submission per 50 minutes.
      const recent = await env.DB
        .prepare('SELECT ts FROM submissions WHERE anon_id = ? ORDER BY ts DESC LIMIT 1')
        .bind(v.value.anon_id).first<{ ts: number }>();
      if (recent && now - recent.ts < 50 * 60) {
        return json({ error: 'too soon' }, { status: 429 });
      }

      await env.DB.prepare(
        `INSERT INTO submissions
          (anon_id, ts, stretch, minutes, label, tz, hemisphere, age_bucket, gender, interests)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        v.value.anon_id, now, v.value.stretch, v.value.minutes, v.value.label,
        v.value.tz, v.value.hemisphere, v.value.age_bucket, v.value.gender,
        JSON.stringify(v.value.interests)
      ).run();

      return new Response(null, { status: 204, headers: CORS });
    }

    if (url.pathname === '/world/latest.json' && req.method === 'GET') {
      const obj = await env.PUBLIC.get('world/latest.json');
      if (!obj) return json({ feltHours: null, regions: [], totalUsers: 0 });
      return new Response(obj.body, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
          ...CORS,
        },
      });
    }

    if (url.pathname === '/cohorts/latest.json' && req.method === 'GET') {
      const obj = await env.PUBLIC.get('cohorts/latest.json');
      if (!obj) return json({ cohorts: [] });
      return new Response(obj.body, {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300',
          ...CORS,
        },
      });
    }

    // Push subscribe — upsert a device's subscription + scheduling prefs.
    // Called every time the user flips notification settings or grants
    // permission, so "re-subscribe" is idempotent. Body shape:
    //   { anon_id, subscription: { endpoint, keys: { p256dh, auth } },
    //     mode: 'daily'|'hourly', wakeStart, wakeEnd, tz }
    if (url.pathname === '/push/subscribe' && req.method === 'POST') {
      let body: any;
      try { body = await req.json(); }
      catch { return json({ error: 'invalid json' }, { status: 400 }); }
      const p = validatePush(body);
      if (!p.ok) return json({ error: p.error }, { status: 400 });

      // Pick a deterministic daily ping slot so the user doesn't get
      // multiple pings per day and it stays stable across re-subscribes.
      const h = await hashToInt(p.value.anon_id + '|daily');
      const span = Math.max(1, p.value.wakeEnd - p.value.wakeStart);
      const dailyHour = p.value.wakeStart + (h % span);
      const dailyMinute = (h >> 8) % 60;

      const now = Math.floor(Date.now() / 1000);
      await env.DB.prepare(
        `INSERT INTO push_subscriptions
          (anon_id, endpoint, p256dh, auth, mode, wake_start, wake_end, tz,
           daily_hour, daily_minute, fail_count, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
         ON CONFLICT(anon_id) DO UPDATE SET
           endpoint = excluded.endpoint,
           p256dh = excluded.p256dh,
           auth = excluded.auth,
           mode = excluded.mode,
           wake_start = excluded.wake_start,
           wake_end = excluded.wake_end,
           tz = excluded.tz,
           daily_hour = excluded.daily_hour,
           daily_minute = excluded.daily_minute,
           fail_count = 0,
           updated_at = excluded.updated_at`
      ).bind(
        p.value.anon_id, p.value.endpoint, p.value.p256dh, p.value.auth,
        p.value.mode, p.value.wakeStart, p.value.wakeEnd, p.value.tz,
        dailyHour, dailyMinute, now,
      ).run();
      return json({ ok: true, dailyHour, dailyMinute });
    }

    if (url.pathname === '/push/unsubscribe' && req.method === 'POST') {
      let body: any;
      try { body = await req.json(); }
      catch { return json({ error: 'invalid json' }, { status: 400 }); }
      const anonId = String(body?.anon_id || '');
      if (anonId.length < 8 || anonId.length > 64) return json({ error: 'anon_id' }, { status: 400 });
      await env.DB.prepare('DELETE FROM push_subscriptions WHERE anon_id = ?').bind(anonId).run();
      return json({ ok: true });
    }

    // Per-user history — last N days of this anon_id's submissions.
    // Not cached at the edge so the caller sees their latest row immediately
    // after posting. anon_id is pseudonymous but treat it as a secret of the
    // device: never log it, never echo it, never index on third parties.
    if (url.pathname === '/me' && req.method === 'GET') {
      const anonId = url.searchParams.get('anon_id') || '';
      if (anonId.length < 8 || anonId.length > 64) {
        return json({ error: 'anon_id' }, { status: 400 });
      }
      const days = Math.min(90, Math.max(1, Number(url.searchParams.get('days') || 30)));
      const since = Math.floor(Date.now() / 1000) - days * 24 * 3600;
      const rows = await env.DB.prepare(
        `SELECT ts, stretch, minutes, label
         FROM submissions WHERE anon_id = ? AND ts >= ?
         ORDER BY ts ASC LIMIT 1000`
      ).bind(anonId, since).all<{ ts: number; stretch: number; minutes: number; label: string }>();
      return json({
        generatedAt: Date.now(),
        days,
        submissions: rows.results || [],
      }, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    return json({ error: 'not found' }, { status: 404 });
  },

  async scheduled(event: ScheduledController, env: Env): Promise<void> {
    // Cron dispatch. We differentiate by the exact cron expression (the
    // most reliable way in Workers) — a */5 tick happens 12× each hour
    // and every hour also has a matching top-of-hour */5 tick, so we
    // explicitly branch on the expression rather than on the minute.
    if (event.cron === '5 0 * * *') { await dumpDaily(env); return; }
    if (event.cron === '0 * * * *') { await aggregate(env); return; }
    if (event.cron === '*/5 * * * *') { await pushSweep(env); return; }
    // Fallback for mis-configured crons — don't hang.
  },
};

// ---- push subscribe body validation ----
function validatePush(body: any):
  | { ok: true; value: { anon_id: string; endpoint: string; p256dh: string; auth: string; mode: 'daily' | 'hourly'; wakeStart: number; wakeEnd: number; tz: string } }
  | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'bad body' };
  const anon_id = String(body.anon_id || '');
  if (anon_id.length < 8 || anon_id.length > 64) return { ok: false, error: 'anon_id' };
  const sub = body.subscription;
  if (!sub || typeof sub !== 'object') return { ok: false, error: 'subscription' };
  const endpoint = String(sub.endpoint || '');
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 2048) return { ok: false, error: 'endpoint' };
  const keys = sub.keys || {};
  const p256dh = String(keys.p256dh || '');
  const auth = String(keys.auth || '');
  if (p256dh.length < 20 || p256dh.length > 200) return { ok: false, error: 'p256dh' };
  if (auth.length < 10 || auth.length > 100) return { ok: false, error: 'auth' };
  const mode = body.mode === 'hourly' ? 'hourly' : 'daily';
  const wakeStart = Math.max(0, Math.min(23, Number(body.wakeStart)));
  const wakeEnd = Math.max(wakeStart + 1, Math.min(24, Number(body.wakeEnd)));
  const tz = String(body.tz || 'UTC').slice(0, 64);
  return { ok: true, value: { anon_id, endpoint, p256dh, auth, mode, wakeStart, wakeEnd, tz } };
}

async function hashToInt(s: string): Promise<number> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  const b = new Uint8Array(buf);
  return (b[0] << 24 | b[1] << 16 | b[2] << 8 | b[3]) >>> 0;
}

// ---- Local-time helpers (tz-aware) ----
// Resolve an IANA zone into the current local hour/minute. We pay for a
// formatter per call — it's fine for a few hundred subs per sweep.
function localHourMinute(tz: string, now = new Date()): { hour: number; minute: number } {
  try {
    const f = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit',
    });
    // en-GB formats "HH:MM" which is easy to parse.
    const parts = f.format(now).split(':');
    return { hour: Number(parts[0]) % 24, minute: Number(parts[1]) };
  } catch {
    return { hour: now.getUTCHours(), minute: now.getUTCMinutes() };
  }
}

// ---- cron: 5-minute push sweep ----
// Invoked on every */5 tick. Pulls everyone who's due for a ping and
// dispatches to each in parallel (capped for backpressure).
async function pushSweep(env: Env) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    // Secrets not configured — silently no-op. The admin is expected to
    // set these via `wrangler secret put`; see worker/README.md.
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const nowMs = now * 1000;
  // Only rows that haven't been pinged in the last 50 minutes, to prevent
  // duplicates if a sweep runs twice (retries, manual invocation).
  const rows = await env.DB.prepare(
    `SELECT anon_id, endpoint, p256dh, auth, mode, wake_start, wake_end,
            tz, daily_hour, daily_minute, last_pinged_at, fail_count
     FROM push_subscriptions
     WHERE fail_count < 5
       AND (last_pinged_at IS NULL OR last_pinged_at < ?)`
  ).bind(now - 50 * 60).all<any>();

  const due = (rows.results || []).filter((r: any) => isDue(r, new Date(nowMs)));

  // Dispatch in batches to keep the Workers CPU budget reasonable.
  const BATCH = 10;
  for (let i = 0; i < due.length; i += BATCH) {
    await Promise.all(due.slice(i, i + BATCH).map((r: any) => dispatchOne(env, r, now)));
  }
}

function isDue(row: any, now: Date): boolean {
  const { hour, minute } = localHourMinute(row.tz, now);
  const within = hour >= row.wake_start && hour < row.wake_end;
  if (!within) return false;
  if (row.mode === 'hourly') {
    // Fire at the top of every wake-window hour, within a 5-minute window
    // so we catch the */5 tick regardless of exact cron drift.
    return minute < 5;
  }
  // 'daily' — only at the deterministic per-user slot.
  if (row.daily_hour == null || row.daily_minute == null) return false;
  if (hour !== row.daily_hour) return false;
  return Math.abs(minute - row.daily_minute) < 5;
}

async function dispatchOne(env: Env, row: any, now: number): Promise<void> {
  const sub: PushSubscriptionRow = {
    endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth,
  };
  try {
    const r = await sendPush(env, sub);
    if (r.ok) {
      await env.DB.prepare(
        `UPDATE push_subscriptions SET last_pinged_at = ?, fail_count = 0 WHERE anon_id = ?`
      ).bind(now, row.anon_id).run();
      return;
    }
    // 404 / 410: subscription is gone. Delete it so we stop trying.
    if (r.status === 404 || r.status === 410) {
      await env.DB.prepare('DELETE FROM push_subscriptions WHERE anon_id = ?').bind(row.anon_id).run();
      return;
    }
    await env.DB.prepare(
      `UPDATE push_subscriptions SET last_failed_at = ?, fail_count = fail_count + 1 WHERE anon_id = ?`
    ).bind(now, row.anon_id).run();
  } catch (e) {
    await env.DB.prepare(
      `UPDATE push_subscriptions SET last_failed_at = ?, fail_count = fail_count + 1 WHERE anon_id = ?`
    ).bind(now, row.anon_id).run();
  }
}

// ---- aggregate: write world/latest.json + cohorts/latest.json ----
async function aggregate(env: Env) {
  const since = Math.floor(Date.now() / 1000) - 24 * 3600;

  const rows = await env.DB.prepare(
    `SELECT stretch, hemisphere, age_bucket, gender, interests, tz
     FROM submissions WHERE ts >= ?`
  ).bind(since).all<any>();

  const list = rows.results || [];
  const total = list.length;

  const avgS = total ? list.reduce((a: number, r: any) => a + (r.stretch || 0), 0) / total : 0;
  const feltHours = Math.round((24 + avgS * 20) * 10) / 10;

  const N = list.filter((r: any) => r.hemisphere === 'N');
  const S = list.filter((r: any) => r.hemisphere === 'S');
  const nAvg = N.length ? N.reduce((a: number, r: any) => a + r.stretch, 0) / N.length : 0;
  const sAvg = S.length ? S.reduce((a: number, r: any) => a + r.stretch, 0) / S.length : 0;
  const hemispherePct = Math.round((nAvg - sAvg) * 20);

  // Group by coarse region — take the first path segment of the IANA tz
  // and map to a representative lat/lng. Keeps the globe/particles/grid
  // visualizations consistent with the prototype.
  const regionMap: Record<string, { lat: number; lng: number; name: string }> = {
    'America/New_York':    { lat: 40, lng: -74, name: 'NYC' },
    'America/Los_Angeles': { lat: 34, lng: -118, name: 'LA' },
    'America/Sao_Paulo':   { lat: -23, lng: -46, name: 'São Paulo' },
    'America/Buenos_Aires':{ lat: -34, lng: -58, name: 'Buenos Aires' },
    'America/Argentina/Buenos_Aires': { lat: -34, lng: -58, name: 'Buenos Aires' },
    'Europe/London':       { lat: 51, lng: 0,   name: 'London' },
    'Europe/Berlin':       { lat: 52, lng: 13,  name: 'Berlin' },
    'Europe/Moscow':       { lat: 55, lng: 37,  name: 'Moscow' },
    'Africa/Lagos':        { lat: 6,  lng: 3,   name: 'Lagos' },
    'Africa/Cairo':        { lat: 30, lng: 31,  name: 'Cairo' },
    'Africa/Johannesburg': { lat: -26, lng: 28, name: 'Johannesburg' },
    'Asia/Tokyo':          { lat: 35, lng: 139, name: 'Tokyo' },
    'Asia/Kolkata':        { lat: 19, lng: 72,  name: 'Mumbai' },
    'Asia/Jakarta':        { lat: -6, lng: 106, name: 'Jakarta' },
    'Australia/Sydney':    { lat: -33, lng: 151, name: 'Sydney' },
    'Atlantic/Reykjavik':  { lat: 64, lng: -22, name: 'Reykjavík' },
  };
  const byRegion = new Map<string, { sum: number; n: number }>();
  for (const r of list) {
    const key = r.tz || 'UTC';
    if (!byRegion.has(key)) byRegion.set(key, { sum: 0, n: 0 });
    const b = byRegion.get(key)!;
    b.sum += r.stretch; b.n += 1;
  }
  const regions = [...byRegion.entries()]
    .filter(([k]) => regionMap[k])
    .map(([k, v]) => ({ ...regionMap[k], s: clamp(v.sum / v.n, -1, 1) }));

  const aggregate = {
    generatedAt: Date.now(),
    windowHours: 24,
    totalUsers: total,
    feltHours,
    hemisphere: { northAvg: nAvg, southAvg: sAvg, diffPct: hemispherePct },
    regions: regions.length ? regions : [],
    patterns: {
      age: bucketAvg(list, 'age_bucket'),
      gender: bucketAvg(list, 'gender'),
      interests: interestAvg(list),
    },
  };

  await env.PUBLIC.put('world/latest.json', JSON.stringify(aggregate, null, 2), {
    httpMetadata: { contentType: 'application/json', cacheControl: 'public, max-age=300' },
  });

  // Cohort rows for the Insights screen. Rank by how close each cohort's
  // stretch is to the caller-agnostic average — the screen renders the
  // caller's % match client-side against their own last submission.
  const cohorts = [
    ...bucketRows(list, 'age_bucket', 'AGE'),
    ...bucketRows(list, 'gender', 'GENDER'),
    ...bucketRows(list, 'hemisphere', 'HEMISPHERE'),
    ...interestRows(list),
  ];
  await env.PUBLIC.put('cohorts/latest.json', JSON.stringify({ generatedAt: Date.now(), cohorts }, null, 2), {
    httpMetadata: { contentType: 'application/json', cacheControl: 'public, max-age=300' },
  });
}

function bucketAvg(list: any[], field: 'age_bucket' | 'gender') {
  const m = new Map<string, { sum: number; n: number }>();
  for (const r of list) {
    const k = r[field];
    if (!k) continue;
    if (!m.has(k)) m.set(k, { sum: 0, n: 0 });
    const v = m.get(k)!;
    v.sum += r.stretch; v.n += 1;
  }
  return [...m.entries()].map(([k, v]) => ({ key: k, avg: v.sum / v.n, n: v.n }));
}

function bucketRows(list: any[], field: 'age_bucket' | 'gender' | 'hemisphere', prefix: string) {
  return bucketAvg(list, field as any).map((b) => ({
    label: `${prefix} · ${b.key.toUpperCase()}`,
    s: clamp(b.avg, -1, 1),
    n: formatN(b.n),
    match: 0.5, // client overrides with a real affinity score
  }));
}

function interestAvg(list: any[]) {
  const m = new Map<string, { sum: number; n: number }>();
  for (const r of list) {
    let tags: string[] = [];
    try { tags = JSON.parse(r.interests || '[]'); } catch { tags = []; }
    for (const t of tags) {
      if (!m.has(t)) m.set(t, { sum: 0, n: 0 });
      const v = m.get(t)!;
      v.sum += r.stretch; v.n += 1;
    }
  }
  return [...m.entries()].map(([k, v]) => ({ key: k, avg: v.sum / v.n, n: v.n }));
}

function interestRows(list: any[]) {
  return interestAvg(list).map((b) => ({
    label: `INTEREST · ${b.key.toUpperCase()}`,
    s: clamp(b.avg, -1, 1),
    n: formatN(b.n),
    match: 0.5,
  }));
}

function formatN(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return Math.round(n / 1_000) + 'K';
  return String(n);
}

// ---- daily CSV dump ----
async function dumpDaily(env: Env) {
  // Previous UTC day.
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  const end = Math.floor(d.getTime() / 1000);
  const start = end - 24 * 3600;
  const dateKey = new Date(start * 1000).toISOString().slice(0, 10);

  const rows = await env.DB.prepare(
    `SELECT id, anon_id, ts, stretch, minutes, label, tz, hemisphere,
            age_bucket, gender, interests
     FROM submissions WHERE ts >= ? AND ts < ? ORDER BY ts`
  ).bind(start, end).all<any>();

  const header = 'id,anon_id,ts,stretch,minutes,label,tz,hemisphere,age_bucket,gender,interests\n';
  const body = (rows.results || []).map((r: any) => [
    r.id, r.anon_id, r.ts, r.stretch, r.minutes,
    csvSafe(r.label), csvSafe(r.tz), r.hemisphere,
    csvSafe(r.age_bucket), csvSafe(r.gender), csvSafe(r.interests),
  ].join(',')).join('\n');

  await env.PUBLIC.put(`export/${dateKey}.csv`, header + body, {
    httpMetadata: { contentType: 'text/csv; charset=utf-8' },
  });

  // Index: list of available daily dumps.
  const listResp = await env.PUBLIC.list({ prefix: 'export/' });
  const files = (listResp.objects || []).map((o) => o.key).sort();
  await env.PUBLIC.put('export/index.json', JSON.stringify({ generatedAt: Date.now(), files }, null, 2), {
    httpMetadata: { contentType: 'application/json' },
  });
}

function csvSafe(v: unknown) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
