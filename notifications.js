/* Time Warp — local ping scheduler.
 * We don't own a push server — scheduling lives on the device.
 *
 * Preferred: Notification Triggers API (Chrome Android, `showTrigger` with
 * `TimestampTrigger`) — fires even if the PWA isn't running.
 * Fallback: store the next ping timestamp in localStorage, show an in-app
 * nudge when the user returns to the tab after that time.
 *
 * Modes (read from TWProfile.getNotifyPrefs):
 *   - 'off':    schedule nothing.
 *   - 'daily':  one ping at a random minute inside the wake window.
 *   - 'hourly': one ping at the top of each wake-window hour, for the
 *               next 24 hours. Re-scheduled whenever the user reopens.
 */
(function () {
  const PING_KEY = 'tw_next_ping';
  const TAG = 'tw-daily';

  function prefs() {
    if (window.TWProfile && window.TWProfile.getNotifyPrefs) {
      return window.TWProfile.getNotifyPrefs();
    }
    return { mode: 'daily', wakeStart: 9, wakeEnd: 21 };
  }

  // Compute the timestamps we want to fire notifications at, starting from
  // `now`. Daily mode returns a single random-inside-window time. Hourly
  // mode returns one per wake-window hour for the next ~24h.
  function computeSchedule(now = new Date()) {
    const { mode, wakeStart, wakeEnd } = prefs();
    if (mode === 'off') return [];

    const atHour = (d, h) => {
      const x = new Date(d); x.setHours(h, 0, 0, 0); return x;
    };

    if (mode === 'hourly') {
      const out = [];
      // Start with today's remaining wake-window hours, then tomorrow.
      for (let dayOffset = 0; dayOffset <= 1 && out.length < 24; dayOffset++) {
        const day = new Date(now); day.setDate(day.getDate() + dayOffset);
        for (let h = wakeStart; h < wakeEnd && out.length < 24; h++) {
          const t = atHour(day, h).getTime();
          // Skip anything in the past or within the next 5 minutes — we
          // don't want to ping the user about this same hour they just
          // opened the app.
          if (t > now.getTime() + 5 * 60 * 1000) out.push(t);
        }
      }
      return out;
    }

    // 'daily' — one ping at a random minute inside today's remaining
    // wake window, or tomorrow's window if we're past it.
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

  async function scheduleTrigger(at, index) {
    const reg = await navigator.serviceWorker.ready;
    if (!('showNotification' in reg)) throw new Error('no-sw-notifications');
    if (typeof TimestampTrigger === 'undefined') throw new Error('no-triggers');
    await reg.showNotification('Time Warp', {
      tag: `${TAG}-${index}`,
      body: 'How long did the last hour take?',
      icon: 'icons/icon.svg',
      badge: 'icons/icon.svg',
      showTrigger: new TimestampTrigger(at),
      data: { route: 'capture' },
    });
  }

  async function clearExistingTriggers() {
    try {
      const reg = await navigator.serviceWorker.ready;
      // Triggered + untriggered, any tag that belongs to us.
      const all = await reg.getNotifications({ includeTriggered: false });
      all.forEach((n) => { if (n.tag && n.tag.startsWith(TAG)) n.close(); });
    } catch (e) { /* ignore */ }
  }

  // Single public entry-point. Re-reads prefs each call and re-schedules
  // from scratch so settings changes take effect immediately.
  async function requestAndSchedule() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      return { ok: false, reason: 'unsupported' };
    }
    const { mode } = prefs();

    // 'off' short-circuits — clear anything already scheduled.
    if (mode === 'off') {
      await clearExistingTriggers();
      localStorage.removeItem(PING_KEY);
      return { ok: true, mode: 'off' };
    }

    if (Notification.permission === 'denied') return { ok: false, reason: 'denied' };
    if (Notification.permission !== 'granted') {
      const p = await Notification.requestPermission();
      if (p !== 'granted') return { ok: false, reason: 'denied' };
    }

    const schedule = computeSchedule();
    if (!schedule.length) {
      return { ok: true, mode, count: 0 };
    }

    // Foreground fallback key is the soonest upcoming ping.
    localStorage.setItem(PING_KEY, String(schedule[0]));

    await clearExistingTriggers();
    try {
      for (let i = 0; i < schedule.length; i++) {
        await scheduleTrigger(schedule[i], i);
      }
      return { ok: true, mode, count: schedule.length, method: 'trigger' };
    } catch (e) {
      // Triggers unsupported — fall back to in-app nudge on the next visit.
      return { ok: true, mode, count: schedule.length, method: 'foreground' };
    }
  }

  // Foreground fallback — if we missed a scheduled ping because triggers
  // are unsupported, show an in-app toast the next time the app is
  // opened after `at`. The shell listens for `tw:daily-ping`.
  function checkForegroundPing() {
    const atStr = localStorage.getItem(PING_KEY);
    if (!atStr) return;
    const at = Number(atStr);
    if (!isFinite(at) || Date.now() < at) return;
    localStorage.removeItem(PING_KEY);
    window.dispatchEvent(new CustomEvent('tw:daily-ping'));
    // Reschedule the next window immediately.
    requestAndSchedule().catch(() => {});
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForegroundPing();
  });
  window.addEventListener('load', checkForegroundPing);

  // Expose `computeSchedule` so the settings UI can preview the next ping.
  window.TWNotifications = { requestAndSchedule, computeSchedule };
})();
