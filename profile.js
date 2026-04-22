/* Time Warp — device profile.
 * Anonymous: a random UUID kept in localStorage, plus whatever demographics
 * the user opted into on first run. No login. No server-side identity.
 *
 * Classic script: attaches helpers to window to match the prototype's
 * Babel-standalone + window-global pattern used by orb.jsx / screens-*.jsx.
 */
(function () {
  const ANON_KEY = 'tw_anon_id';
  const PROFILE_KEY = 'tw_profile';

  function uuid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  }

  function getAnonId() {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) { id = uuid(); localStorage.setItem(ANON_KEY, id); }
    return id;
  }

  function getProfile() {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; }
    catch (e) { return {}; }
  }

  function setProfile(patch) {
    const next = Object.assign({}, getProfile(), patch);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
    return next;
  }

  function hasOnboarded() {
    const p = getProfile();
    // `onboardedAt` is stamped whenever the user leaves the demographics
    // step (even if they skipped without entering anything) — that's the
    // real signal. The demographic fields are optional.
    return Boolean(p.onboardedAt || p.ageBucket || (p.interests && p.interests.length));
  }

  // Coarse N/S lookup from IANA timezone. Africa straddles the equator so
  // we use an explicit table; everything else falls back to the northern
  // default, which is where ~88% of the world's population lives.
  const SOUTHERN_REGIONS = new Set(['Antarctica']);
  const SOUTHERN_CITIES = new Set([
    'Africa/Johannesburg','Africa/Harare','Africa/Maputo','Africa/Windhoek',
    'Africa/Luanda','Africa/Kinshasa','Africa/Dar_es_Salaam','Africa/Nairobi',
    'America/Sao_Paulo','America/Buenos_Aires','America/Argentina/Buenos_Aires',
    'America/Santiago','America/Montevideo','America/La_Paz','America/Lima',
    'America/Asuncion','America/Bogota',
    'Australia/Sydney','Australia/Melbourne','Australia/Brisbane',
    'Australia/Perth','Australia/Adelaide','Australia/Darwin','Australia/Hobart',
    'Pacific/Auckland','Pacific/Fiji','Pacific/Tongatapu','Pacific/Apia',
    'Indian/Mauritius','Indian/Reunion',
  ]);

  function getHemisphere() {
    try {
      const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || '';
      if (SOUTHERN_CITIES.has(tz)) return 'S';
      const [region] = tz.split('/');
      if (SOUTHERN_REGIONS.has(region)) return 'S';
      return 'N';
    } catch (e) { return 'N'; }
  }

  function getTimezone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
    catch (e) { return 'UTC'; }
  }

  const AGE_BUCKETS = ['<18','18-24','25-34','35-49','50-64','65+'];
  const GENDERS = ['woman','man','non-binary','prefer not to say'];
  const INTERESTS = [
    'meditation','creative','shift-work','night-owl','parent',
    'athlete','student','caregiver','remote-work','commuter',
  ];

  // Notification prefs. 'daily' picks one random minute inside the wake
  // window; 'hourly' pings at the top of every wake-window hour; 'off'
  // schedules nothing.
  const NOTIFY_DEFAULTS = { mode: 'daily', wakeStart: 9, wakeEnd: 21 };
  function getNotifyPrefs() {
    const p = getProfile();
    return {
      mode: p.notifyMode || NOTIFY_DEFAULTS.mode,
      wakeStart: typeof p.wakeStart === 'number' ? p.wakeStart : NOTIFY_DEFAULTS.wakeStart,
      wakeEnd: typeof p.wakeEnd === 'number' ? p.wakeEnd : NOTIFY_DEFAULTS.wakeEnd,
    };
  }
  function setNotifyPrefs(patch) {
    // Keep wake window sane (start < end, within 0..23).
    const next = Object.assign({}, getNotifyPrefs(), patch);
    next.wakeStart = Math.max(0, Math.min(23, next.wakeStart));
    next.wakeEnd = Math.max(next.wakeStart + 1, Math.min(24, next.wakeEnd));
    setProfile({
      notifyMode: next.mode,
      wakeStart: next.wakeStart,
      wakeEnd: next.wakeEnd,
    });
    return next;
  }

  window.TWProfile = {
    getAnonId, getProfile, setProfile, hasOnboarded,
    getHemisphere, getTimezone,
    getNotifyPrefs, setNotifyPrefs,
    AGE_BUCKETS, GENDERS, INTERESTS,
  };
})();
