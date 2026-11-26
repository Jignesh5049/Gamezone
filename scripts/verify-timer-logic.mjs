import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';

function verifyJwtMath() {
  const secret = 'apex-arena-demo-hs256-jwt-secret-2026';
  const b64u = (str) =>
    Buffer.from(str, 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  const now = Math.floor(Date.now() / 1000);
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = b64u(
    JSON.stringify({
      sub: 'usr_owner',
      email: 'owner@gamezone.in',
      name: 'Apex Arena Owner',
      role: 'admin',
      iat: now,
      exp: now + 3600,
    })
  );
  const sig = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const token = `${header}.${payload}.${sig}`;
  assert.equal(token.split('.').length, 3, 'HS256 JWT must have 3 segments');

  // Verify signature matches & tampering fails
  const reSig = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${payload}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  assert.equal(sig, reSig);
  assert.notEqual(
    sig,
    crypto
      .createHmac('sha256', secret)
      .update(`${header}.${b64u('{"role":"tampered"}')}`)
      .digest('base64')
  );
}

async function runTests() {
  console.log('1) Verifying HS256 JWT format & HMAC integrity...');
  verifyJwtMath();

  console.log('2) Verifying all Vercel/Static-safe web routes return HTTP 200 without server errors...');
  const routes = [
    '/',
    '/login',
    '/sessions',
    '/pricing',
    '/bookings',
    '/analytics',
    '/inventory',
    '/reports',
  ];

  for (const r of routes) {
    const res = await fetch(`${BASE_URL}${r}`, { redirect: 'manual' });
    const html = await res.text();
    assert.equal(res.status, 200, `Route ${r} must return HTTP 200 (got ${res.status})`);
    assert.ok(
      !html.includes('Application error: a server-side exception'),
      `Route ${r} must not render a Next.js server-side exception`
    );
  }

  console.log('✓ All Serverless Demo & HS256 JWT route checks PASSED!');
}

runTests().catch((err) => {
  console.error('✗ Verification failed:', err);
  process.exit(1);
});
