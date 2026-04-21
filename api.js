/* Time Warp — API client.
 * Posts hour submissions to the Cloudflare Worker and fetches the public
 * world aggregate from R2. Falls back to the bundled sample data so the UI
 * never breaks offline (first launch, airplane mode, worker down).
 */
(function () {
  // Swap once the custom domain is live. Both defaults work for local dev
  // via the Wrangler `wrangler dev` proxy (uses workers.dev subdomain).
  const API_BASE = (window.TW_API_BASE || 'https://api.timewarp.app');
  const DATA_BASE = (window.TW_DATA_BASE || 'https://data.timewarp.app');

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
      // Opportunistic drain — if any earlier submissions failed offline.
      flushQueue().catch(() => {});
      return { ok: true, queued: false };
    } catch (e) {
      const q = loadQueue();
      q.push(body);
      saveQueue(q);
      return { ok: true, queued: true };
    }
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

  window.TWApi = {
    submitHour, flushQueue, fetchWorldAggregate, fetchCohorts,
    SAMPLE_REGIONS, SAMPLE_COHORTS,
  };
})();
