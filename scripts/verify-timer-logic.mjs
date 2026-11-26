import assert from 'node:assert/strict';

/**
 * End-to-end verification script for Solo-Owner Game Zone Management Dashboard:
 * - Zero login/RBAC friction
 * - Independent live station timers, pause/resume, extend, transfer, checkout
 * - Maintenance lock, analytics, daily closing, CSV exports, and all 8 page routes
 */

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3000';

async function req(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
    redirect: 'manual',
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // non-JSON (HTML/CSV)
  }
  return { status: res.status, headers: res.headers, text, json };
}

async function runTests() {
  console.log('1) Testing Solo-Owner API Endpoints & Business Rules...');

  // Bootstrap works directly without login
  const boot = await req('/api/bootstrap');
  assert.equal(boot.status, 200, 'Bootstrap must return 200 directly without login');
  assert.ok(boot.json.stations.length >= 9, 'Should have seeded gaming stations');

  const pool2 = boot.json.stations.find((s) => s.id === 'stn_pool_2');
  const pool3 = boot.json.stations.find((s) => s.id === 'stn_pool_3');
  const tt2 = boot.json.stations.find((s) => s.id === 'stn_tt_2');
  assert.ok(pool2 && pool2.status === 'available', 'Pool Table 02 should be available');
  assert.ok(pool3 && pool3.status === 'available', 'Pool Table 03 should be available');

  // Rule #1: Start session on Pool Table 02 (without customer details), then block duplicate active session
  const startRes = await req('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({
      stationId: pool2.id,
      billingMode: 'fixed',
      plannedDurationMinutes: 60,
    }),
  });
  assert.equal(startRes.status, 201, 'Starting session on available station should return 201');
  const sesId = startRes.json.session.id;

  const dupRes = await req('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({
      stationId: pool2.id,
      customerName: 'Duplicate Player',
      billingMode: 'fixed',
      plannedDurationMinutes: 30,
    }),
  });
  assert.equal(dupRes.status, 409, 'Double-booking occupied station must return 409');

  // Rule #4: Pause & Resume
  const pauseRes = await req(`/api/sessions/${sesId}/pause`, { method: 'POST' });
  assert.equal(pauseRes.status, 200);
  assert.equal(pauseRes.json.session.status, 'paused');
  assert.ok(pauseRes.json.session.paused_at, 'paused_at must be set');

  await new Promise((r) => setTimeout(r, 1200));
  const resumeRes = await req(`/api/sessions/${sesId}/resume`, { method: 'POST' });
  assert.equal(resumeRes.status, 200);
  assert.equal(resumeRes.json.session.status, 'active');
  assert.ok(
    resumeRes.json.session.accumulated_paused_seconds >= 1,
    'accumulated_paused_seconds must persist pause duration'
  );

  // Rule #5: Extend session (+15m)
  const extendRes = await req(`/api/sessions/${sesId}/extend`, {
    method: 'POST',
    body: JSON.stringify({ minutes: 15 }),
  });
  assert.equal(extendRes.status, 200);
  assert.equal(extendRes.json.session.planned_duration_minutes, 75);

  // Transfer station Pool Table 02 -> Pool Table 03
  const transferRes = await req(`/api/sessions/${sesId}/transfer`, {
    method: 'POST',
    body: JSON.stringify({ targetStationId: pool3.id, keepOriginalRate: true }),
  });
  assert.equal(transferRes.status, 200);
  assert.equal(transferRes.json.session.station_id, pool3.id);

  // Checkout directly with discount (no PIN needed in solo-owner mode)
  const checkoutRes = await req(`/api/sessions/${sesId}/checkout`, {
    method: 'POST',
    body: JSON.stringify({
      additionalCharges: 0,
      discountAmount: 20,
      discountReason: 'Owner promo',
      paymentMethod: 'upi',
      paidAmount: 230,
    }),
  });
  assert.equal(checkoutRes.status, 200, 'Solo-owner checkout with discount must succeed without PIN');
  assert.equal(checkoutRes.json.session.status, 'completed');
  assert.equal(checkoutRes.json.session.payment_status, 'paid');
  assert.ok(checkoutRes.json.receipt.receiptNumber.startsWith('RCP-'));

  // Rule #9: Station under maintenance cannot be rented
  const maintRes = await req(`/api/stations/${tt2.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'maintenance' }),
  });
  assert.equal(maintRes.status, 200);

  const rentMaintRes = await req('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({
      stationId: tt2.id,
      billingMode: 'fixed',
      plannedDurationMinutes: 30,
    }),
  });
  assert.equal(rentMaintRes.status, 409, 'Station under maintenance must reject rental (409)');

  // Restore TT-02 to available
  await req(`/api/stations/${tt2.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'available' }),
  });

  // Rule #11: Analytics, Daily Closing, Bookings without customer info, CSV Export
  const bookingRes = await req('/api/bookings', {
    method: 'POST',
    body: JSON.stringify({
      stationIds: [tt2.id],
      scheduledStartAt: new Date(Date.now() + 3600_000).toISOString(),
      durationMinutes: 60,
    }),
  });
  assert.equal(bookingRes.status, 201, 'Booking without customer details must succeed');

  const analyticsRes = await req('/api/analytics?preset=today');
  assert.equal(analyticsRes.status, 200);
  assert.ok(analyticsRes.json.summary.todayRevenue >= 230);

  const closingRes = await req('/api/reports/daily-closing');
  assert.equal(closingRes.status, 200);
  assert.ok(closingRes.json.upiReceived >= 230);

  const csvRes = await req('/api/exports?type=sessions');
  assert.equal(csvRes.status, 200);
  assert.ok(csvRes.headers.get('content-type').includes('text/csv'));
  assert.ok(csvRes.text.includes('Session Code'));

  // Verify all 7 active routes return HTTP 200 directly
  const routes = [
    '/',
    '/sessions',
    '/pricing',
    '/bookings',
    '/analytics',
    '/inventory',
    '/reports',
  ];
  for (const r of routes) {
    const pageRes = await req(r);
    assert.equal(pageRes.status, 200, `Route ${r} must return 200 (got ${pageRes.status})`);
  }

  // Verify removed routes return 404
  const removedRoutes = [
    '/dashboard',
    '/stations',
    '/customers',
    '/staff',
    '/live',
    '/expenses',
    '/settings',
    '/login',
  ];
  for (const r of removedRoutes) {
    const res404 = await req(r);
    assert.equal(res404.status, 404, `Removed route ${r} must return 404 (got ${res404.status})`);
  }

  console.log('✓ All Solo-Owner E2E API, Timer, Checkout, Maintenance, 7 Active Routes, and 404 Checks PASSED!');
}

runTests().catch((err) => {
  console.error('✗ Verification failed:', err);
  process.exit(1);
});
