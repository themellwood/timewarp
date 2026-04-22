/* Time Warp — API client.
 * Posts hour submissions to the Cloudflare Worker and fetches the public
 * world aggregate from R2. Falls back to the bundled sample data so the UI
 * never breaks offline (first launch, airplane mode, worker down).
 */
(function () {
  // Swap once the custom domain is live. Both defaults work for local dev
  // via the Wrangler `wrangler dev` proxy (uses workers.dev subdomain).
  const API_BASE = (window.TW_API_BASE || 'https://timewarp-api.perky.workers.dev');
  const DATA_BASE = (window.TW_DATA_BASE || 'https://pub-9dffd6c49ad244ce8893f12cdc193bdf.r2.dev');

  const SAMPLE_REGIONS = [
    { name: 'Tokyo',     lat: 35,  lng: 139, s:  0.38 },
    { name: 'Lagos',     lat: 6,   lng: 3,   s: -0.12 },
    { name: 'São Paulo', lat: -23, lng: -46, s:  0.05 },
    { name: 'Berlin',    lat: 52,  lng: 13,  s: -0.30 },
    { name: 'Mumbai',    lat: 19,  lng: 72,  s:  0.22 },
    { name: 'NYC',       lat: 40,  lng: -74, s: -0.20 },
    { name: 'LA',        lat: 34,  lng: -118,s: -0.45 },
    { name: 'Sydney',    lat: -33, lng: 151, s:  0.10 },
    { name: 'Cairo',     lat: 30,  lng: 31,  s:  0.28 },
    { name: 'Moscow',    lat: 55,  lng: 37,  s:  0.48 },
    { name: 'Reykjavík', lat: 64,  lng: -22, s: -0.08 },
    { name: 'Jakarta',   lat: -6,  lng: 106, s:  0.02 },
    { name: 'Buenos Aires', lat: -34, lng: -58, s: -0.05 },
  ];

  const SAMPLE_COHORTS = [
    { label: 'MEN · 25-34',     match: 0.92, s: -0.45, n: '184K' },
    { label: 'WOMEN · 25-34',   match: 0.71, s: -0.15, n: '201K' },
    { label: 'N. HEMISPHERE',   match: 0.84, s: -0.35, n: '1.2M' },
    { label: 'S. HEMISPHERE',   match: 0.41, s:  0.28, n: '410K' },
    { label: 'CREATIVES',       match: 0.88, s: -0.40, n: '67K' },
    { label: 'NIGHT-OWLS',      match: 0.96, s: -0.52, n: '89K' },
  ];

  const QUEUE_KEY = 'tw_pending';

  function loadQueue() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveQueue(q) { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); }

  async function postOnce(body) {
    const r = await fetch(API_BASE + '/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    });
    if (!r.ok) throw new Error('submit failed ' + r.status);
  }

  async function flushQueue() {
    const q = loadQueue();
    if (!q.length) return;
    const keep = [];
    for (const item of q) {
      try { await postOnce(item); } catch (e) { keep.push(item); }
    }
    saveQueue(keep);
  }

  async function submitHour({ stretch, minutes, label }) {
    const P = window.TWProfile;
    const body = {
      anon_id: P.getAnonId(),
      ts: Math.floor(Date.now() / 1000),
      stretch: Math.max(-1, Math.min(1, stretch)),
      minutes,
      label,
      tz: P.getTimezone(),
      hemisphere: P.getHemisphere(),
      age_bucket: P.getProfile().ageBucket || null,
      gender: P.getProfile().gender || null,
      interests: P.getProfile().interests || [],
    };
    try {
      await postOnce(body);
      saveLastSubmit(body);
      // Opportunistic drain — if any earlier submissions failed offline.
      flushQueue().catch(() => {});
      return { ok: true, queued: false };
    } catch (e) {
      const q = loadQueue();
      q.push(body);
      saveQueue(q);
      // Treat queued submissions as the user's logged hour too — they've
      // answered, we just haven't gotten it to the server yet.
      saveLastSubmit(body);
      return { ok: true, queued: true };
    }
  }

  const LAST_KEY = 'tw_last_submit';
  function saveLastSubmit(body) {
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify({
        ts: body.ts, stretch: body.stretch, minutes: body.minutes, label: body.label,
      }));
    } catch (e) {}
  }
  function getLastSubmit() {
    try { return JSON.parse(localStorage.getItem(LAST_KEY)); }
    catch (e) { return null; }
  }
  // Returns the last submission iff it happened within the current local
  // clock hour, otherwise null. Client-side lock that complements the
  // server's 50-minute anti-spam window.
  function loggedThisHour() {
    const last = getLastSubmit();
    if (!last || !last.ts) return null;
    const now = new Date();
    const then = new Date(last.ts * 1000);
    const sameHour = now.getFullYear() === then.getFullYear()
      && now.getMonth() === then.getMonth()
      && now.getDate() === then.getDate()
      && now.getHours() === then.getHours();
    return sameHour ? last : null;
  }

  // Fire-and-forget flush on visibility / online events.
  window.addEventListener('online', () => flushQueue().catch(() => {}));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') flushQueue().catch(() => {});
  });

  // 10-minute in-memory cache, stale-while-revalidate.
  const cache = new Map();
  async function cachedJSON(url, fallback) {
    const hit = cache.get(url);
    const fresh = hit && Date.now() - hit.t < 10 * 60 * 1000;
    if (fresh) return hit.v;
    try {
      const r = await fetch(url, { mode: 'cors' });
      if (!r.ok) throw new Error(r.status);
      const v = await r.json();
      cache.set(url, { v, t: Date.now() });
      return v;
    } catch (e) {
      if (hit) return hit.v;
      return fallback;
    }
  }

  async function fetchWorldAggregate() {
    return cachedJSON(DATA_BASE + '/world/latest.json', {
      feltHours: 26.4,
      totalUsers: 2100000,
      regions: SAMPLE_REGIONS,
      patterns: null, // screens-3 keeps its hard-coded cards when null
    });
  }

  async function fetchCohorts() {
    return cachedJSON(DATA_BASE + '/cohorts/latest.json', {
      cohorts: SAMPLE_COHORTS,
    });
  }

  // Synthetic aggregate — used by the World-screen "demo data" toggle so
  // visitors can see what the app feels like once thousands of hours have
  // been logged, without waiting for the real cohort to grow. All values
  // are deterministic (seeded) so the demo looks the same every render.
  function getDemoAggregate() {
    const seed = (n) => { const x = Math.sin(n * 9301 + 49297) * 233280; return x - Math.floor(x); };

    // ~40 regions spread around the globe. Stretch values are shaped to
    // suggest a mild global "dragged" day with interesting regional swings.
    const cities = [
      { name: 'Tokyo',       lat: 35,  lng: 139 },
      { name: 'Osaka',       lat: 34,  lng: 135 },
      { name: 'Seoul',       lat: 37,  lng: 126 },
      { name: 'Beijing',     lat: 39,  lng: 116 },
      { name: 'Shanghai',    lat: 31,  lng: 121 },
      { name: 'Hong Kong',   lat: 22,  lng: 114 },
      { name: 'Bangkok',     lat: 13,  lng: 100 },
      { name: 'Singapore',   lat: 1,   lng: 103 },
      { name: 'Jakarta',     lat: -6,  lng: 106 },
      { name: 'Manila',      lat: 14,  lng: 120 },
      { name: 'Mumbai',      lat: 19,  lng: 72  },
      { name: 'Delhi',       lat: 28,  lng: 77  },
      { name: 'Karachi',     lat: 24,  lng: 67  },
      { name: 'Dubai',       lat: 25,  lng: 55  },
      { name: 'Istanbul',    lat: 41,  lng: 28  },
      { name: 'Cairo',       lat: 30,  lng: 31  },
      { name: 'Lagos',       lat: 6,   lng: 3   },
      { name: 'Nairobi',     lat: -1,  lng: 36  },
      { name: 'Joburg',      lat: -26, lng: 28  },
      { name: 'Cape Town',   lat: -33, lng: 18  },
      { name: 'Moscow',      lat: 55,  lng: 37  },
      { name: 'Berlin',      lat: 52,  lng: 13  },
      { name: 'Paris',       lat: 48,  lng: 2   },
      { name: 'London',      lat: 51,  lng: 0   },
      { name: 'Madrid',      lat: 40,  lng: -3  },
      { name: 'Rome',        lat: 41,  lng: 12  },
      { name: 'Stockholm',   lat: 59,  lng: 18  },
      { name: 'Reykjavík',   lat: 64,  lng: -22 },
      { name: 'NYC',         lat: 40,  lng: -74 },
      { name: 'Toronto',     lat: 43,  lng: -79 },
      { name: 'Chicago',     lat: 41,  lng: -87 },
      { name: 'LA',          lat: 34,  lng: -118},
      { name: 'Vancouver',   lat: 49,  lng: -123},
      { name: 'Mexico City', lat: 19,  lng: -99 },
      { name: 'Bogotá',      lat: 4,   lng: -74 },
      { name: 'Lima',        lat: -12, lng: -77 },
      { name: 'São Paulo',   lat: -23, lng: -46 },
      { name: 'B. Aires',    lat: -34, lng: -58 },
      { name: 'Sydney',      lat: -33, lng: 151 },
      { name: 'Melbourne',   lat: -37, lng: 145 },
      { name: 'Auckland',    lat: -36, lng: 174 },
    ];
    const regions = cities.map((c, i) => {
      // Base wave by longitude + small random jitter. North tends slightly
      // more "dragged", south a touch "flew" — a plausible Monday-afternoon
      // world.
      const wave = Math.sin((c.lng + 60) / 180 * Math.PI) * 0.35;
      const hemiBias = c.lat >= 0 ? 0.08 : -0.05;
      const jitter = (seed(i + 1) - 0.5) * 0.5;
      const s = Math.max(-0.9, Math.min(0.9, wave + hemiBias + jitter));
      return { name: c.name, lat: c.lat, lng: c.lng, s: Math.round(s * 100) / 100 };
    });

    // Hemisphere split — computed from the regions so the PatternCard math
    // lines up with the visible globe.
    const north = regions.filter(r => r.lat >= 0);
    const south = regions.filter(r => r.lat < 0);
    const nAvg = north.reduce((a, r) => a + r.s, 0) / north.length;
    const sAvg = south.reduce((a, r) => a + r.s, 0) / south.length;
    const hemiDiffPct = Math.round((nAvg - sAvg) * 20);

    // Age / gender / interest cohort aggregates. avg in -1..1, n is count.
    const patterns = {
      age: [
        { key: '<18',   avg: -0.42, n: 12400 },
        { key: '18-24', avg: -0.28, n: 184000 },
        { key: '25-34', avg: -0.05, n: 612000 },
        { key: '35-49', avg:  0.18, n: 498000 },
        { key: '50-64', avg:  0.32, n: 271000 },
        { key: '65+',   avg:  0.48, n: 94000 },
      ],
      gender: [
        { key: 'woman',       avg:  0.06, n: 980000 },
        { key: 'man',         avg: -0.11, n: 812000 },
        { key: 'non-binary',  avg: -0.02, n: 58000 },
      ],
      interests: [
        { key: 'meditation', avg:  0.03, n: 92000 },
        { key: 'creative',   avg: -0.18, n: 140000 },
        { key: 'night-owl',  avg: -0.34, n: 87000 },
        { key: 'parent',     avg:  0.22, n: 210000 },
        { key: 'athlete',    avg: -0.12, n: 76000 },
        { key: 'student',    avg: -0.20, n: 154000 },
        { key: 'remote-work',avg:  0.14, n: 180000 },
        { key: 'commuter',   avg:  0.27, n: 168000 },
        { key: 'shift-work', avg:  0.38, n: 42000 },
        { key: 'caregiver',  avg:  0.25, n: 61000 },
      ],
    };

    const avgS = regions.reduce((a, r) => a + r.s, 0) / regions.length;
    const feltHours = Math.round((24 + avgS * 20) * 10) / 10;

    return {
      demo: true,
      feltHours,
      totalUsers: 2_348_712,
      regions,
      hemisphere: { n: nAvg, s: sAvg, diffPct: hemiDiffPct },
      patterns,
      generatedAt: Date.now(),
    };
  }

  // Per-user history — hits the Worker directly (not the R2 CDN) since the
  // row set is private to this anon_id. No cache: the user expects to see
  // their latest log the moment they open the week screen.
  async function fetchMyHistory({ days = 30 } = {}) {
    const P = window.TWProfile;
    if (!P) return { submissions: [] };
    const anonId = P.getAnonId();
    try {
      const r = await fetch(
        `${API_BASE}/me?anon_id=${encodeURIComponent(anonId)}&days=${days}`,
        { mode: 'cors', cache: 'no-store' },
      );
      if (!r.ok) throw new Error(r.status);
      return await r.json();
    } catch (e) {
      // Offline fallback — merge in any queued-but-not-yet-posted rows so
      // the user sees what they just logged even without a network.
      const pending = loadQueue().map((b) => ({
        ts: b.ts, stretch: b.stretch, minutes: b.minutes, label: b.label,
      }));
      return { submissions: pending, offline: true };
    }
  }

  window.TWApi = {
    submitHour, flushQueue, fetchWorldAggregate, fetchCohorts, fetchMyHistory,
    getLastSubmit, loggedThisHour, getDemoAggregate,
    SAMPLE_REGIONS, SAMPLE_COHORTS,
  };
})();
