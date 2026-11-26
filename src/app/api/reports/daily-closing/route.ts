import { NextResponse } from 'next/server';
import { getDb, toPlain, toPlainAll } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getISTDateKey, getISTDayBoundsUTC } from '@/lib/timezone';
import type { PaymentRecord } from '@/lib/types';

export async function GET(request: Request) {
  const auth = await requireAuth(['admin', 'manager']);
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const dateKey = searchParams.get('date') || getISTDateKey();
  const { startIso, endIso } = getISTDayBoundsUTC(dateKey);

  const db = getDb();

  const payments = toPlainAll<PaymentRecord>(
    db
      .prepare(
        `SELECT p.*, s.session_code, gs.name AS station_name, s.customer_name, u.full_name AS received_by_name
         FROM payments p
         JOIN sessions s ON s.id = p.session_id
         JOIN gaming_stations gs ON gs.id = s.station_id
         LEFT JOIN staff st ON st.id = p.received_by
         LEFT JOIN users u ON u.id = st.user_id
         WHERE p.status = 'completed' AND p.paid_at >= ? AND p.paid_at <= ?
         ORDER BY p.paid_at DESC`
      )
      .all(startIso, endIso) as never
  );

  let cashReceived = 0;
  let upiReceived = 0;
  let cardReceived = 0;
  let otherReceived = 0;

  for (const p of payments) {
    if (p.method === 'cash') cashReceived += p.amount;
    else if (p.method === 'upi') upiReceived += p.amount;
    else if (p.method === 'card') cardReceived += p.amount;
    else otherReceived += p.amount;
  }

  const totalCollected = Math.round(
    cashReceived + upiReceived + cardReceived + otherReceived
  );

  const sessionAgg = toPlain<{
    totalSessions: number;
    totalMinutes: number;
    totalDiscounts: number;
    pendingAmount: number;
    pendingCount: number;
  }>(
    db
      .prepare(
        `SELECT COUNT(*) AS totalSessions,
                COALESCE(SUM(billable_minutes), 0) AS totalMinutes,
                COALESCE(SUM(discount_amount), 0) AS totalDiscounts,
                COALESCE(SUM(CASE WHEN payment_status IN ('unpaid', 'partial') THEN MAX(0, final_amount - paid_amount) ELSE 0 END), 0) AS pendingAmount,
                SUM(CASE WHEN payment_status IN ('unpaid', 'partial') THEN 1 ELSE 0 END) AS pendingCount
         FROM sessions
         WHERE status = 'completed' AND ended_at >= ? AND ended_at <= ?`
      )
      .get(startIso, endIso) as never
  );

  return NextResponse.json({
    date: dateKey,
    cashReceived: Math.round(cashReceived),
    upiReceived: Math.round(upiReceived),
    cardReceived: Math.round(cardReceived),
    otherReceived: Math.round(otherReceived),
    totalCollected,
    pendingPaymentsAmount: Math.round(sessionAgg?.pendingAmount ?? 0),
    pendingPaymentsCount: sessionAgg?.pendingCount ?? 0,
    totalSessions: sessionAgg?.totalSessions ?? 0,
    totalGamingHours: Number(((sessionAgg?.totalMinutes ?? 0) / 60).toFixed(2)),
    totalDiscounts: Math.round(sessionAgg?.totalDiscounts ?? 0),
    netRevenue: totalCollected,
    payments,
  });
}
