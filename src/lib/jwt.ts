export interface DemoJwtPayload {
  sub: string;
  email: string;
  name: string;
  role: 'admin';
  iat: number;
  exp: number;
}

const JWT_STORAGE_KEY = 'gz_demo_jwt';
const DEMO_JWT_SECRET = 'apex-arena-demo-hs256-jwt-secret-2026';

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(bytes).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
  if (typeof atob === 'function') {
    const bin = atob(padded);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      out[i] = bin.charCodeAt(i);
    }
    return out;
  }
  return new Uint8Array(Buffer.from(padded, 'base64'));
}

function encodeUtf8(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

// Pure-JS SHA-256 + HMAC-SHA256 fallback for environments without crypto.subtle
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function sha256Pure(data: Uint8Array): Uint8Array {
  const bitLen = data.length * 8;
  const padLen = ((data.length + 9 + 63) >> 6) << 6;
  const padded = new Uint8Array(padLen);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(padLen - 4, bitLen >>> 0, false);

  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

  for (let i = 0; i < padLen; i += 64) {
    for (let j = 0; j < 16; j++) w[j] = view.getUint32(i + j * 4, false);
    for (let j = 16; j < 64; j++) {
      const s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3);
      const s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10);
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let j = 0; j < 64; j++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + SHA256_K[j] + w[j]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  for (let i = 0; i < 8; i++) outView.setUint32(i * 4, h[i], false);
  return out;
}

function hmacSha256Pure(key: Uint8Array, msg: Uint8Array): Uint8Array {
  const k = key.length > 64 ? sha256Pure(key) : key;
  const oKeyPad = new Uint8Array(64);
  const iKeyPad = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    const kb = i < k.length ? k[i] : 0;
    oKeyPad[i] = kb ^ 0x5c;
    iKeyPad[i] = kb ^ 0x36;
  }
  const inner = new Uint8Array(64 + msg.length);
  inner.set(iKeyPad);
  inner.set(msg, 64);
  const innerHash = sha256Pure(inner);
  const outer = new Uint8Array(64 + 32);
  outer.set(oKeyPad);
  outer.set(innerHash, 64);
  return sha256Pure(outer);
}

async function hmacSha256(secret: string, signingInput: string): Promise<Uint8Array> {
  const keyBytes = encodeUtf8(secret);
  const msgBytes = encodeUtf8(signingInput);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    try {
      const cryptoKey = await globalThis.crypto.subtle.importKey(
        'raw',
        keyBytes.buffer as ArrayBuffer,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const sig = await globalThis.crypto.subtle.sign(
        'HMAC',
        cryptoKey,
        msgBytes.buffer as ArrayBuffer
      );
      return new Uint8Array(sig);
    } catch {
      // Fallback to pure JS
    }
  }
  return hmacSha256Pure(keyBytes, msgBytes);
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function signDemoJwt(
  user: { sub: string; email: string; name: string },
  ttlSeconds: number = 7 * 24 * 60 * 60
): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const header = bytesToBase64Url(encodeUtf8(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payloadObj: DemoJwtPayload = {
    sub: user.sub,
    email: user.email,
    name: user.name,
    role: 'admin',
    iat: nowSec,
    exp: nowSec + ttlSeconds,
  };
  const payload = bytesToBase64Url(encodeUtf8(JSON.stringify(payloadObj)));
  const signingInput = `${header}.${payload}`;
  const sigBytes = await hmacSha256(DEMO_JWT_SECRET, signingInput);
  const signature = bytesToBase64Url(sigBytes);
  return `${signingInput}.${signature}`;
}

export async function verifyDemoJwt(token: string | null): Promise<DemoJwtPayload | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  if (!header || !payload || !sig) return null;

  try {
    const headerJson = JSON.parse(decodeUtf8(base64UrlToBytes(header))) as {
      alg?: string;
    };
    if (headerJson.alg !== 'HS256') return null;

    const expectedSigBytes = await hmacSha256(DEMO_JWT_SECRET, `${header}.${payload}`);
    const expectedSig = bytesToBase64Url(expectedSigBytes);
    if (!timingSafeEqualStr(sig, expectedSig)) return null;

    const parsed = JSON.parse(decodeUtf8(base64UrlToBytes(payload))) as DemoJwtPayload;
    if (!parsed.sub || !parsed.exp || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getStoredJwt(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(JWT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredJwt(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(JWT_STORAGE_KEY, token);
  } catch {
    // ignore storage quota errors
  }
}

export function clearStoredJwt(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(JWT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export async function authenticateDemoCredentials(
  email: string,
  password: string
): Promise<{ token: string; payload: DemoJwtPayload } | null> {
  const normalized = email.trim().toLowerCase();
  const valid =
    (normalized === 'owner@gamezone.in' && password === 'demo123') ||
    (normalized === 'admin@gamezone.in' && password === 'admin123');

  if (!valid) return null;

  const user = {
    sub: 'usr_owner',
    email: normalized,
    name: normalized === 'admin@gamezone.in' ? 'Arjun Mehta' : 'Apex Arena Owner',
  };
  const token = await signDemoJwt(user);
  const payload = (await verifyDemoJwt(token))!;
  return { token, payload };
}

export async function issueQuickDemoJwt(): Promise<{
  token: string;
  payload: DemoJwtPayload;
}> {
  const token = await signDemoJwt({
    sub: 'usr_owner',
    email: 'owner@gamezone.in',
    name: 'Apex Arena Owner',
  });
  const payload = (await verifyDemoJwt(token))!;
  return { token, payload };
}
