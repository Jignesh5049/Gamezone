import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { withTransaction } from '@/lib/db';
import { logActivity, requireAuth } from '@/lib/auth';
import { getSessionById } from '@/lib/queries';

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const { id } = await context.params;
  const session = getSessionById(id);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }
  if (session.status !== 'paused' || !session.paused_at) {
    return NextResponse.json(
      { error: `Cannot resume session in "${session.status}" state` },
      { status: 409 }
    );
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const pausedDeltaSeconds = Math.max(
    0,
    Math.floor((now.getTime() - Date.parse(session.paused_at)) / 1000)
  );
  const newAccumulatedPaused =
    (session.accumulated_paused_seconds || 0) + pausedDeltaSeconds;

  let nextExpectedEnd: string | null = session.expected_end_at;
  if (session.billing_mode === 'fixed' && session.planned_duration_minutes) {
    const startMs = Date.parse(session.started_at);
    nextExpectedEnd = new Date(
      startMs + (session.planned_duration_minutes * 60 + newAccumulatedPaused) * 1000
    ).toISOString();
  }

  withTransaction((db) => {
    db.prepare(
      `UPDATE sessions
       SET status = 'active', paused_at = NULL, accumulated_paused_seconds = ?,
           expected_end_at = ?, updated_at = ?
       WHERE id = ?`
    ).run(newAccumulatedPaused, nextExpectedEnd, nowIso, id);

    db.prepare(
      `INSERT INTO session_events (id, session_id, event_type, payload_json, actor_staff_id, created_at)
       VALUES (?, ?, 'resumed', ?, ?, ?)`
    ).run(
      `evt_${crypto.randomUUID().slice(0, 10)}`,
      id,
      JSON.stringify({ pausedDeltaSeconds, totalPausedSeconds: newAccumulatedPaused }),
      auth.staff.staffId,
      nowIso
    );

    logActivity({
      staff: auth.staff,
      action: 'session_resumed',
      entityType: 'session',
      entityId: id,
      summary: `Resumed timer for ${session.station_name} (+${pausedDeltaSeconds}s paused excluded)`,
      createdAt: nowIso,
    });
  });

  return NextResponse.json({ session: getSessionById(id) });
}
