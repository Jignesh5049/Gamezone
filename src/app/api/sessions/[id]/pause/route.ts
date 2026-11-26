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
  if (session.status !== 'active') {
    return NextResponse.json(
      { error: `Cannot pause session in "${session.status}" state` },
      { status: 409 }
    );
  }

  const nowIso = new Date().toISOString();

  withTransaction((db) => {
    db.prepare(
      "UPDATE sessions SET status = 'paused', paused_at = ?, updated_at = ? WHERE id = ?"
    ).run(nowIso, nowIso, id);

    db.prepare(
      `INSERT INTO session_events (id, session_id, event_type, payload_json, actor_staff_id, created_at)
       VALUES (?, ?, 'paused', ?, ?, ?)`
    ).run(
      `evt_${crypto.randomUUID().slice(0, 10)}`,
      id,
      JSON.stringify({ pausedAt: nowIso }),
      auth.staff.staffId,
      nowIso
    );

    logActivity({
      staff: auth.staff,
      action: 'session_paused',
      entityType: 'session',
      entityId: id,
      summary: `Paused timer for ${session.station_name} (${session.session_code})`,
      createdAt: nowIso,
    });
  });

  return NextResponse.json({ session: getSessionById(id) });
}
