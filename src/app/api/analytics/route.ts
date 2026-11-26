import { NextResponse } from 'next/server';
import { getDb, toPlain, toPlainAll } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import {
  addDaysToISTDateKey,
  getDateRangeBoundsUTC,
  getISTDateKey,
  getISTDayBoundsUTC,
  getISTHour,
} from '@/lib/timezone';

export async function GET(request: Request) {
  const auth = await requireAuth(['admin', 'manager']);
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const preset = (searchParams.get('preset') || '30d') as
    | 'today'
    | 'yesterday'
    | '7d'
    | '30d'
    | 'custom';
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const db = getDb();
  const nowMs = Date.now();
  const todayKey = getISTDateKey(nowMs);
  const todayBounds = getISTDayBoundsUTC(todayKey);
  const weekBounds = getDateRangeBoundsUTC('7d', null, null, nowMs);
  const monthBounds = getDateRangeBoundsUTC('30d', null, null, nowMs);
  const activeRange = getDateRangeBoundsUTC(preset, from, to, nowMs);

  const sumPayments = (startIso?: string, endIso?: string): number => {
    if (startIso && endIso) {
      const r = toPlain<{ total: number }>(
        db
          .prepare(
            "SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'completed' AND paid_at >= ? AND paid_at <= ?"
          )
          .get(startIso, endIso) as never
      );
      return Math.round(r?.total ?? 0);
    }
    const r = toPlain<{ total: number }>(
      db
        .prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'completed'")
        .get() as never
    );
    return Math.round(r?.total ?? 0);
  };

  const todayRevenue = sumPayments(todayBounds.startIso, todayBounds.endIso);
  const weeklyRevenue = sumPayments(weekBounds.startIso, weekBounds.endIso);
  const monthlyRevenue = sumPayments(monthBounds.startIso, monthBounds.endIso);
  const totalRevenue = sumPayments();
  const rangeRevenue = sumPayments(activeRange.startIso, activeRange.endIso);

  const pendingRow = toPlain<{ count: number; amount: number }>(
    db
      .prepare(
        `SELECT COUNT(*) AS count,
                COALESCE(SUM(MAX(0, final_amount - paid_amount)), 0) AS amount
         FROM sessions
         WHERE status = 'completed' AND payment_status IN ('unpaid', 'partial')`
      )
      .get() as never
  );

  const customersRow = toPlain<{ count: number }>(
    db.prepare('SELECT COUNT(*) AS count FROM customers').get() as never
  );

  const sessionStats = toPlain<{
    totalSessions: number;
    totalMinutes: number;
    avgMinutes: number;
  }>(
    db
      .prepare(
        `SELECT COUNT(*) AS totalSessions,
                COALESCE(SUM(billable_minutes), 0) AS totalMinutes,
                COALESCE(AVG(billable_minutes), 0) AS avgMinutes
         FROM sessions
         WHERE status = 'completed' AND started_at >= ? AND started_at <= ?`
      )
      .get(activeRange.startIso, activeRange.endIso) as never
  );

  const revenueByCategory = toPlainAll<{
    categoryId: string;
    categoryName: string;
    revenue: number;
    sessions: number;
  }>(
    db
      .prepare(
        `SELECT gc.id AS categoryId,
                gc.name AS categoryName,
                COALESCE(SUM(CASE WHEN p.status = 'completed' AND p.paid_at >= ? AND p.paid_at <= ? THEN p.amount ELSE 0 END), 0) AS revenue,
                COUNT(DISTINCT CASE WHEN s.status = 'completed' AND s.started_at >= ? AND s.started_at <= ? THEN s.id END) AS sessions
         FROM game_categories gc
         LEFT JOIN gaming_stations gs ON gs.category_id = gc.id
         LEFT JOIN sessions s ON s.station_id = gs.id
         LEFT JOIN payments p ON p.session_id = s.id
         GROUP BY gc.id, gc.name
         ORDER BY revenue DESC`
      )
      .all(
        activeRange.startIso,
        activeRange.endIso,
        activeRange.startIso,
        activeRange.endIso
      ) as never
  );

  const revenueByStation = toPlainAll<{
    stationId: string;
    stationName: string;
    categoryName: string;
    revenue: number;
    sessions: number;
    hours: number;
  }>(
    db
      .prepare(
        `SELECT gs.id AS stationId,
                gs.name AS stationName,
                gc.name AS categoryName,
                COALESCE((
                  SELECT SUM(p.amount)
                  FROM payments p
                  JOIN sessions s2 ON s2.id = p.session_id
                  WHERE s2.station_id = gs.id AND p.status = 'completed' AND p.paid_at >= ? AND p.paid_at <= ?
                ), 0) AS revenue,
                COALESCE((
                  SELECT COUNT(*)
                  FROM sessions s3
                  WHERE s3.station_id = gs.id AND s3.status = 'completed' AND s3.started_at >= ? AND s3.started_at <= ?
                ), 0) AS sessions,
                ROUND(COALESCE((
                  SELECT SUM(s4.billable_minutes)
                  FROM sessions s4
                  WHERE s4.station_id = gs.id AND s4.status = 'completed' AND s4.started_at >= ? AND s4.started_at <= ?
                ), 0) / 60.0, 1) AS hours
         FROM gaming_stations gs
         JOIN game_categories gc ON gc.id = gs.category_id
         ORDER BY revenue DESC, gs.sort_order ASC`
      )
      .all(
        activeRange.startIso,
        activeRange.endIso,
        activeRange.startIso,
        activeRange.endIso,
        activeRange.startIso,
        activeRange.endIso
      ) as never
  );

  const mostPopularGame =
    [...revenueByCategory].sort((a, b) => b.sessions - a.sessions)[0]?.categoryName || '—';
  const mostProfitableStation =
    revenueByStation[0]?.revenue > 0 ? revenueByStation[0].stationName : '—';

  // Build daily revenue series for last 14 days (IST)
  const dailyPayments = toPlainAll<{ amount: number; paid_at: string }>(
    db
      .prepare(
        "SELECT amount, paid_at FROM payments WHERE status = 'completed' AND paid_at >= ?"
      )
      .all(getISTDayBoundsUTC(addDaysToISTDateKey(todayKey, -29)).startIso) as never
  );

  const dailyMap = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    dailyMap.set(addDaysToISTDateKey(todayKey, -i), 0);
  }
  for (const p of dailyPayments) {
    const k = getISTDateKey(p.paid_at);
    if (dailyMap.has(k)) {
      dailyMap.set(k, (dailyMap.get(k) || 0) + Math.round(p.amount));
    }
  }
  const dailySeries = Array.from(dailyMap.entries()).map(([date, revenue]) => ({
    label: date.slice(5),
    date,
    revenue,
  }));

  // Build weekly series (4 weeks)
  const weeklySeries = [3, 2, 1, 0].map((weeksAgo) => {
    const endKey = addDaysToISTDateKey(todayKey, -weeksAgo * 7);
    const startKey = addDaysToISTDateKey(endKey, -6);
    const sIso = getISTDayBoundsUTC(startKey).startIso;
    const eIso = getISTDayBoundsUTC(endKey).endIso;
    const rev = dailyPayments
      .filter((p) => p.paid_at >= sIso && p.paid_at <= eIso)
      .reduce((acc, p) => acc + Math.round(p.amount), 0);
    return {
      label: `${startKey.slice(5)}..${endKey.slice(5)}`,
      revenue: rev,
    };
  });

  // Build monthly series (last 6 months)
  const allCompletedPayments = toPlainAll<{ amount: number; paid_at: string }>(
    db
      .prepare("SELECT amount, paid_at FROM payments WHERE status = 'completed'")
      .all() as never
  );
  const monthlyMap = new Map<string, number>();
  for (const p of allCompletedPayments) {
    const monthKey = getISTDateKey(p.paid_at).slice(0, 7);
    monthlyMap.set(monthKey, (monthlyMap.get(monthKey) || 0) + Math.round(p.amount));
  }
  const monthlySeries = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)
    .map(([month, revenue]) => ({ label: month, revenue }));

  // Peak Business Hours (0..23 IST)
  const rangeSessions = toPlainAll<{ started_at: string }>(
    db
      .prepare(
        "SELECT started_at FROM sessions WHERE status != 'cancelled' AND started_at >= ? AND started_at <= ?"
      )
      .all(activeRange.startIso, activeRange.endIso) as never
  );
  const hourBuckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}:00`,
    sessions: 0,
  }));
  for (const s of rangeSessions) {
    const h = getISTHour(s.started_at);
    if (hourBuckets[h]) hourBuckets[h].sessions += 1;
  }

  return NextResponse.json({
    summary: {
      todayRevenue,
      weeklyRevenue,
      monthlyRevenue,
      totalRevenue,
      rangeRevenue,
      pendingPaymentsCount: pendingRow?.count ?? 0,
      pendingPaymentsAmount: Math.round(pendingRow?.amount ?? 0),
      totalCustomers: customersRow?.count ?? 0,
      totalSessions: sessionStats?.totalSessions ?? 0,
      totalGamingHours: Number(((sessionStats?.totalMinutes ?? 0) / 60).toFixed(1)),
      avgSessionDurationMinutes: Math.round(sessionStats?.avgMinutes ?? 0),
      mostPopularGame,
      mostProfitableStation,
    },
    revenueByCategory,
    revenueByStation,
    dailySeries,
    weeklySeries,
    monthlySeries,
    peakHours: hourBuckets.filter((b) => b.hour >= 9 && b.hour <= 23),
  });
}
