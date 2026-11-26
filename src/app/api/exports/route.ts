import { NextResponse } from 'next/server';
import { getDb, toPlainAll } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { querySessions } from '@/lib/queries';
import { formatISTDateTime } from '@/lib/timezone';
import { buildCsv } from '@/lib/utils';
import type { PaymentRecord } from '@/lib/types';

export async function GET(request: Request) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'sessions';
  const db = getDb();

  let csv = '';
  let filename = `gamezone-${type}.csv`;

  if (type === 'sessions') {
    const sessions = querySessions({
      preset: searchParams.get('preset') || 'all',
      from: searchParams.get('from'),
      to: searchParams.get('to'),
      categoryId: searchParams.get('categoryId'),
      stationId: searchParams.get('stationId'),
      paymentStatus: searchParams.get('paymentStatus'),
      status: searchParams.get('status'),
      search: searchParams.get('search'),
      limit: 2000,
    });

    csv = buildCsv(
      [
        'Session Code',
        'Category',
        'Station',
        'Billing Mode',
        'Status',
        'Started At (IST)',
        'Ended At (IST)',
        'Paused Seconds',
        'Billable Minutes',
        'Base Amount',
        'Add-On Charges',
        'Discount',
        'Final Amount',
        'Paid Amount',
        'Payment Status',
        'Started By',
      ],
      sessions.map((s) => [
        s.session_code,
        s.category_name || '',
        s.station_name || '',
        s.billing_mode,
        s.status,
        formatISTDateTime(s.started_at),
        formatISTDateTime(s.ended_at),
        s.accumulated_paused_seconds,
        s.billable_minutes,
        s.base_amount,
        s.additional_charges,
        s.discount_amount,
        s.final_amount,
        s.paid_amount,
        s.payment_status,
        s.started_by_name || '',
      ])
    );
  } else if (type === 'payments') {
    const rows = toPlainAll<PaymentRecord>(
      db
        .prepare(
          `SELECT p.*, s.session_code, gs.name AS station_name, u.full_name AS received_by_name
           FROM payments p
           JOIN sessions s ON s.id = p.session_id
           JOIN gaming_stations gs ON gs.id = s.station_id
           LEFT JOIN staff st ON st.id = p.received_by
           LEFT JOIN users u ON u.id = st.user_id
           ORDER BY p.paid_at DESC`
        )
        .all() as never
    );

    csv = buildCsv(
      [
        'Receipt Number',
        'Session Code',
        'Station',
        'Amount (INR)',
        'Method',
        'Status',
        'Reference',
        'Received By',
        'Paid At (IST)',
      ],
      rows.map((p) => [
        p.receipt_number,
        p.session_code || '',
        p.station_name || '',
        p.amount,
        p.method.toUpperCase(),
        p.status,
        p.reference_note || '',
        p.received_by_name || '',
        formatISTDateTime(p.paid_at),
      ])
    );
  } else {
    // Revenue by station summary
    filename = 'gamezone-revenue-report.csv';
    const rows = toPlainAll<{
      station_name: string;
      category_name: string;
      sessions: number;
      hours: number;
      revenue: number;
    }>(
      db
        .prepare(
          `SELECT gs.name AS station_name,
                  gc.name AS category_name,
                  COUNT(DISTINCT CASE WHEN s.status = 'completed' THEN s.id END) AS sessions,
                  ROUND(COALESCE(SUM(CASE WHEN s.status = 'completed' THEN s.billable_minutes ELSE 0 END), 0) / 60.0, 2) AS hours,
                  COALESCE(SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END), 0) AS revenue
           FROM gaming_stations gs
           JOIN game_categories gc ON gc.id = gs.category_id
           LEFT JOIN sessions s ON s.station_id = gs.id
           LEFT JOIN payments p ON p.session_id = s.id
           GROUP BY gs.id, gs.name, gc.name
           ORDER BY revenue DESC`
        )
        .all() as never
    );
    csv = buildCsv(
      ['Station', 'Category', 'Completed Sessions', 'Gaming Hours', 'Collected Revenue (INR)'],
      rows.map((r) => [r.station_name, r.category_name, r.sessions, r.hours, r.revenue])
    );
  }

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
