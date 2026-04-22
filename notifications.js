/* Time Warp — notification scheduler (Web Push).
 *
 * The real background-delivery path is Web Push via the Cloudflare Worker.
 *  - We create a PushSubscription in the browser (signed with the server's
 *    VAPID public key) and POST it — along with the user's wake window and
 *    mode — to /push/subscribe.
 *  - The Worker's 5-minute cron fans out payloadless pushes at the user's
 *    local schedule. The service worker's 'push' handler shows the
 *    notification (see sw.js).
 *
 * Fallbacks, in order:
 *  - Notification Triggers API (showTrigger) — if the browser exposes it,
 *    we also register local triggers as a backup. It's rare to have it
 *    available, but harmless when it is.
 *  - Foreground nudge — if push is blocked or VAPID isn't configured,
 *    we still show an in-app prompt the next time the app is opened
 *    after the scheduled time.
 */
(function () {
  const PING_KEY = 'tw_next_ping';
  const TAG = 'tw-daily';
  const API_BASE = (window.TW_API_BASE || 'https://timewarp-api.perky.workers.dev');
  const VAPID_PUBLIC = window.TW_VAPID_PUBLIC_KEY || '';

  function prefs() {
    if (window.TWProfile && window.TWProfile.getNotifyPrefs) {
      return window.TWProfile.getNotifyPrefs();
    }
    return { mode: 'daily', wakeStart: 9, wakeEnd: 21 };
  }

  function anonId() {
    return window.TWProfile ? window.TWProfile.getAnonId() : null;
  }

  // ---- base64url decode for the VAPID public key ----
  function urlB64ToUint8Array(s) {
    const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
    const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // ---- compute planned schedule (same shape as before, used for UI preview) ----
  function computeSchedule(now = new Date()) {
    const { mode, wakeStart, wakeEnd } = prefs();
    if (mode === 'off') return [];
    const atHour = (d, h) => { const x = new Date(d); x.setHours(h, 0, 0, 0); return x; };
    if (mode === 'hourly') {
      const out = [];
      for (let dayOffset = 0; dayOffset <= 1 && out.length < 24; dayOffset++) {
        const day = new Date(now); day.setDate(day.getDate() + dayOffset);
        for (let h = wakeStart; h < wakeEnd && out.length < 24; h++) {
          const t = atHour(day, h).getTime();
          if (t > now.getTime() + 5 * 60 * 1000) out.push(t);
        }
      }
      return out;
    }
    const todayStart = atHour(now, wakeStart).getTime();
    const todayEnd = atHour(now, wakeEnd).getTime();
    let windowStart, windowEnd;
    if (now.getTime() < todayEnd - 30 * 60 * 1000) {
      windowStart = Math.max(now.getTime() + 30 * 60 * 1000, todayStart);
      windowEnd = todayEnd;
    } else {
      const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
      windowStart = atHour(tomorrow, wakeStart).getTime();
      windowEnd = atHour(tomorrow, wakeEnd).getTime();
    }
    const span = Math.max(60 * 1000, windowEnd - windowStart);
    return [windowStart + Math.floor(Math.random() * span)];
  }

  // ---- Push subscription create/update ----
  async function getOrCreateSubscription() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('push-unsupported');
    }
    if (!VAPID_PUBLIC) throw new Error('vapid-missing');
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC),
      });
    }
    return sub;
  }

  function subscriptionToJson(sub) {
    // sub.toJSON() exists on PushSubscription and is the wire-safe shape.
    return sub.toJSON ? sub.toJSON() : JSON.parse(JSON.stringify(sub));
  }

  async function sendSubscribeToServer(sub) {
    const id = anonId();
    if (!id) return { ok: false, reason: 'no-anon' };
    const { mode, wakeStart, wakeEnd } = prefs();
    const tz = (window.TWProfile && window.TWProfile.getTimezone) ? window.TWProfile.getTimezone() : 'UTC';
    const r = await fetch(API_BASE + '/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        anon_id: id,
        subscription: subscriptionToJson(sub),
        mode, wakeStart, wakeEnd, tz,
      }),
    });
    if (!r.ok) return { ok: false, status: r.status };
    const data = await r.json().catch(() => ({}));
    return { ok: true, data };
  }

  async function sendUnsubscribeToServer() {
    const id = anonId();
    if (!id) return;
    try {
      await fetch(API_BASE + '/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anon_id: id }),
      });
    } catch (e) { /* ignore */ }
  }

  // ---- Optional: still register Triggers if available ----
  async function clearExistingTriggers() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const all = await reg.getNotifications({ includeTriggered: false });
      all.forEach((n) => { if (n.tag && n.tag.startsWith(TAG)) n.close(); });
    } catch (e) { /* ignore */ }
  }
  async function scheduleTriggerIfSupported(schedule) {
    if (typeof TimestampTrigger === 'undefined') return 0;
    const reg = await navigator.serviceWorker.ready;
    let count = 0;
    for (let i = 0; i < schedule.length; i++) {
      try {
        await reg.showNotification('Time Warp', {
          tag: `${TAG}-${i}`,
          body: 'How long did the last hour take?',
          icon: 'icons/icon.svg',
          badge: 'icons/icon.svg',
          showTrigger: new TimestampTrigger(schedule[i]),
          data: { route: 'capture' },
        });
        count++;
      } catch (e) { break; }
    }
    return count;
  }

  // ---- Public entry-point ----
  async function requestAndSchedule() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      return { ok: false, reason: 'unsupported' };
    }
    const { mode } = prefs();

    if (mode === 'off') {
      await clearExistingTriggers();
      localStorage.removeItem(PING_KEY);
      await sendUnsubscribeToServer();
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (sub) await sub.unsubscribe();
      } catch (e) {}
      return { ok: true, mode: 'off' };
    }

    if (Notification.permission === 'denied') return { ok: false, reason: 'denied' };
    if (Notification.permission !== 'granted') {
      const p = await Notification.requestPermission();
      if (p !== 'granted') return { ok: false, reason: 'denied' };
    }

    const schedule = computeSchedule();
    if (schedule.length) localStorage.setItem(PING_KEY, String(schedule[0]));

    await clearExistingTriggers();

    // The real path: register a Web Push subscription and tell the server
    // about our schedule. Server cron fires the actual pings.
    let pushResult = { ok: false, reason: 'not-attempted' };
    try {
      const sub = await getOrCreateSubscription();
      pushResult = await sendSubscribeToServer(sub);
    } catch (e) {
      pushResult = { ok: false, reason: e.message || 'push-error' };
    }

    // Opportunistic local trigger as a secondary belt-and-braces.
    const triggerCount = await scheduleTriggerIfSupported(schedule);

    return {
      ok: true, mode,
      push: pushResult,
      triggerCount,
      method: pushResult.ok ? 'push' : (triggerCount > 0 ? 'trigger' : 'foreground'),
    };
  }

  // ---- Foreground fallback — only relevant when Push is unavailable ----
  function checkForegroundPing() {
    const atStr = localStorage.getItem(PING_KEY);
    if (!atStr) return;
    const at = Number(atStr);
    if (!isFinite(at) || Date.now() < at) return;
    localStorage.removeItem(PING_KEY);
    window.dispatchEvent(new CustomEvent('tw:daily-ping'));
    requestAndSchedule().catch(() => {});
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForegroundPing();
  });
  window.addEventListener('load', checkForegroundPing);

  // SW asks us to re-subscribe (rare — push service rotated our endpoint).
  navigator.serviceWorker?.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'tw:push-resubscribe') {
      requestAndSchedule().catch(() => {});
    }
  });

  // ---- Immediate smoke test ----
  async function testPing() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      return { ok: false, reason: 'unsupported' };
    }
    if (Notification.permission === 'denied') return { ok: false, reason: 'denied' };
    if (Notification.permission !== 'granted') {
      const p = await Notification.requestPermission();
      if (p !== 'granted') return { ok: false, reason: 'denied' };
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification('Time Warp · test', {
        tag: 'tw-test',
        body: 'Notifications are working. This is how the daily ping looks.',
        icon: 'icons/icon.svg',
        badge: 'icons/icon.svg',
        data: { route: 'capture' },
      });
      return { ok: true, method: 'sw' };
    } catch (e) {
      try {
        new Notification('Time Warp · test', {
          body: 'Notifications are working (page scope).',
          icon: 'icons/icon.svg', tag: 'tw-test',
        });
        return { ok: true, method: 'page' };
      } catch (err) {
        return { ok: false, reason: 'error', error: String(err && err.message || err) };
      }
    }
  }

  // ---- Diagnostics for the settings UI ----
  async function diagnostics() {
    const supported = ('Notification' in window) && ('serviceWorker' in navigator);
    const pushAPI = ('PushManager' in window);
    const triggersAPI = typeof window.TimestampTrigger !== 'undefined';
    const permission = supported ? Notification.permission : 'unsupported';
    let registered = 0;
    let pushSubscribed = false;
    let pushEndpointHost = null;
    if (supported) {
      try {
        const reg = await navigator.serviceWorker.ready;
        const all = await reg.getNotifications({ includeTriggered: false });
        registered = all.filter((n) => (n.tag || '').startsWith(TAG)).length;
        if (pushAPI) {
          const sub = await reg.pushManager.getSubscription();
          if (sub) {
            pushSubscribed = true;
            try { pushEndpointHost = new URL(sub.endpoint).hostname; } catch {}
          }
        }
      } catch (e) { /* ignore */ }
    }
    const nextPingTs = Number(localStorage.getItem(PING_KEY)) || null;
    const schedule = computeSchedule();
    return {
      supported, pushAPI, triggersAPI, permission,
      vapidConfigured: Boolean(VAPID_PUBLIC),
      pushSubscribed, pushEndpointHost,
      registered, nextPingTs,
      plannedCount: schedule.length,
      plannedFirst: schedule[0] || null,
    };
  }

  window.TWNotifications = { requestAndSchedule, computeSchedule, testPing, diagnostics };
})();
