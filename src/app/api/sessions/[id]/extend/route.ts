import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withTransaction } from '@/lib/db';
import { logActivity, requireAuth } from '@/lib/auth';
import { getSessionById } from '@/lib/queries';
import { calculateRentalAmount, computeSessionMetrics } from '@/lib/timer';

const extendSchema = z.object({
  minutes: z.number().int().min(5).max(600),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = extendSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid extension duration' },
        { status: 400 }
      );
    }

    const session = getSessionById(id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    if (session.status !== 'active' && session.status !== 'paused') {
      return NextResponse.json(
        { error: 'Only active or paused sessions can be extended' },
        { status: 409 }
      );
    }

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const metrics = computeSessionMetrics(session, nowMs);
    const currentPlanned =
      session.planned_duration_minutes ??
      Math.max(30, Math.ceil(metrics.billableElapsedSeconds / 60 / 30) * 30);
    const nextPlanned = currentPlanned + parsed.data.minutes;

    const startMs = Date.parse(session.started_at);
    const nextExpectedEnd = new Date(
      startMs + (nextPlanned * 60 + metrics.totalPausedSeconds) * 1000
    ).toISOString();

    const updatedBase = calculateRentalAmount({
      billableElapsedSeconds: nextPlanned * 60,
      plannedDurationMinutes: nextPlanned,
      billingMode: 'fixed',
      billingIncrementMinutes: session.billing_increment_minutes,
      ratePer30Min: session.rate_30min,
      ratePer60Min: session.rate_60min,
      offerDiscountPercent: session.offer_discount_percent,
    }).baseAmount;

    withTransaction((db) => {
      db.prepare(
        `UPDATE sessions
         SET billing_mode = 'fixed', planned_duration_minutes = ?, expected_end_at = ?,
             base_amount = ?, final_amount = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        nextPlanned,
        nextExpectedEnd,
        updatedBase,
        Math.max(0, updatedBase + session.additional_charges - session.discount_amount),
        nowIso,
        id
      );

      db.prepare(
        `INSERT INTO session_events (id, session_id, event_type, payload_json, actor_staff_id, created_at)
         VALUES (?, ?, 'extended', ?, ?, ?)`
      ).run(
        `evt_${crypto.randomUUID().slice(0, 10)}`,
        id,
        JSON.stringify({ addedMinutes: parsed.data.minutes, newPlannedMinutes: nextPlanned }),
        auth.staff.staffId,
        nowIso
      );

      logActivity({
        staff: auth.staff,
        action: 'session_extended',
        entityType: 'session',
        entityId: id,
        summary: `Extended ${session.station_name} (${session.session_code}) by +${parsed.data.minutes}m (total ${nextPlanned}m)`,
        createdAt: nowIso,
      });
    });

    return NextResponse.json({ session: getSessionById(id) });
  } catch {
    return NextResponse.json({ error: 'Failed to extend session' }, { status: 500 });
  }
}
