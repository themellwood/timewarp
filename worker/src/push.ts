/* Time Warp — Web Push (VAPID) helpers.
 *
 * We send *payloadless* pushes: the service worker's push handler picks
 * a generic body. This avoids RFC 8291 aes128gcm payload encryption,
 * which is a lot of code for no UX gain here.
 *
 * VAPID (RFC 8292):
 *   Authorization: vapid t=<JWT>, k=<base64url-raw-pubkey>
 *   where JWT is ES256-signed with header {alg:"ES256",typ:"JWT"} and
 *   payload {aud: "<push service origin>", exp, sub: "mailto:..."}.
 */

export interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface VapidEnv {
  VAPID_PUBLIC_KEY: string;   // base64url, raw 65-byte P-256 pubkey
  VAPID_PRIVATE_KEY: string;  // base64url, 32-byte P-256 private scalar
  VAPID_SUBJECT: string;      // "mailto:you@example.com"
}

// ---- base64url helpers ----
function b64urlEncode(buf: ArrayBuffer | Uint8Array) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(pad);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---- JWK construction from VAPID raw keys ----
// VAPID private key is the 32-byte scalar `d`. Public key is the 65-byte
// uncompressed P-256 point (0x04 || X || Y). WebCrypto wants a JWK with d,
// x, y — we reconstruct that JWK from the raw bytes.
function toJwkPrivate(privRawB64: string, pubRawB64: string): JsonWebKey {
  const d = b64urlDecode(privRawB64);
  const pub = b64urlDecode(pubRawB64);
  if (d.length !== 32) throw new Error('vapid private key must be 32 bytes');
  if (pub.length !== 65 || pub[0] !== 0x04) throw new Error('vapid public key must be 65-byte uncompressed point');
  const x = pub.slice(1, 33);
  const y = pub.slice(33, 65);
  return {
    kty: 'EC', crv: 'P-256',
    d: b64urlEncode(d),
    x: b64urlEncode(x),
    y: b64urlEncode(y),
    ext: true,
  };
}

async function importSigningKey(env: VapidEnv): Promise<CryptoKey> {
  const jwk = toJwkPrivate(env.VAPID_PRIVATE_KEY, env.VAPID_PUBLIC_KEY);
  return crypto.subtle.importKey(
    'jwk', jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['sign'],
  );
}

// ---- sign a VAPID JWT targeting a given push service ----
export async function signVapidJwt(env: VapidEnv, pushEndpoint: string, ttlSeconds = 12 * 3600) {
  const aud = new URL(pushEndpoint).origin;
  const header = { alg: 'ES256', typ: 'JWT' };
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = { aud, exp, sub: env.VAPID_SUBJECT };

  const enc = (o: unknown) => b64urlEncode(new TextEncoder().encode(JSON.stringify(o)));
  const signingInput = `${enc(header)}.${enc(payload)}`;
  const key = await importSigningKey(env);
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${b64urlEncode(sig)}`;
}

// ---- send a single push ----
// Returns { ok, status }. If status is 404 or 410 the subscription is dead
// and the caller should delete the row.
export async function sendPush(env: VapidEnv, sub: PushSubscriptionRow): Promise<{ ok: boolean; status: number; body?: string }> {
  const jwt = await signVapidJwt(env, sub.endpoint);
  const r = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
      'TTL': '60',
      'Content-Length': '0',
      'Urgency': 'normal',
    },
  });
  if (r.ok) return { ok: true, status: r.status };
  let body: string | undefined;
  try { body = (await r.text()).slice(0, 200); } catch {}
  return { ok: false, status: r.status, body };
}
