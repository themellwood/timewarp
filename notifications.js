/* Time Warp — local daily ping scheduler.
 * We don't own a push server — scheduling lives on the device.
 *
 * Preferred: Notification Triggers API (Chrome Android, `showTrigger` with
 * `TimestampTrigger`) — fires even if the PWA isn't running.
 * Fallback: store the next ping timestamp in localStorage, show an in-app
 * nudge when the user returns to the tab after that time.
 */
(function () {
  const PING_KEY = 'tw_next_ping';
  const WAKE_WINDOW = { startHour: 9, endHour: 21 }; // local time

  function nextRandomPing(now = new Date()) {
    // Pick a random minute within the waking window tomorrow (or today if
    // we haven't yet passed the window). Avoid pinging in the middle of
    // the same hour the user just opened the app.
    const d = new Date(now);
    const todayEnd = new Date(d); todayEnd.setHours(WAKE_WINDOW.endHour, 0, 0, 0);
    const tryToday = d.getHours() < WAKE_WINDOW.endHour - 1;
    if (!tryToday) d.setDate(d.getDate() + 1);
    d.setHours(WAKE_WINDOW.startHour, 0, 0, 0);

    const windowStart = tryToday ? Math.max(now.getTime() + 30 * 60 * 1000, d.getTime()) : d.getTime();
    const windowEndDate = new Date(d); windowEndDate.setHours(WAKE_WINDOW.endHour, 0, 0, 0);
    const windowEnd = windowEndDate.getTime();
    const span = Math.max(60 * 1000, windowEnd - windowStart);
    return windowStart + Math.floor(Math.random() * span);
  }

  async function scheduleTrigger(at) {
    const reg = await navigator.serviceWorker.ready;
    if (!('showNotification' in reg)) throw new Error('no-sw-notifications');
    if (typeof TimestampTrigger === 'undefined') throw new Error('no-triggers');
    await reg.showNotification('Time Warp', {
      tag: 'tw-daily',
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
      const existing = await reg.getNotifications({ tag: 'tw-daily', includeTriggered: false });
      existing.forEach((n) => n.close());
    } catch (e) { /* ignore */ }
  }

  async function requestAndSchedule() {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) return { ok: false, reason: 'unsupported' };
    if (Notification.permission === 'denied') return { ok: false, reason: 'denied' };
    if (Notification.permission !== 'granted') {
      const p = await Notification.requestPermission();
      if (p !== 'granted') return { ok: false, reason: 'denied' };
    }
    const at = nextRandomPing();
    localStorage.setItem(PING_KEY, String(at));
    try {
      await clearExistingTriggers();
      await scheduleTrigger(at);
      return { ok: true, at, method: 'trigger' };
    } catch (e) {
      // Fallback: foreground nudge only. No OS-level wake.
      return { ok: true, at, method: 'foreground' };
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
    // Reschedule tomorrow's ping immediately.
    requestAndSchedule().catch(() => {});
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForegroundPing();
  });
  window.addEventListener('load', checkForegroundPing);

  window.TWNotifications = { requestAndSchedule, nextRandomPing };
})();
