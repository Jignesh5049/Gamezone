import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { toPlain, withTransaction } from '@/lib/db';
import { logActivity, requireAuth } from '@/lib/auth';
import { getAllPricingRules, getSessionById, resolveEffectivePricing } from '@/lib/queries';
import type { StationStatus } from '@/lib/types';

const transferSchema = z.object({
  targetStationId: z.string().min(1),
  keepOriginalRate: z.boolean().optional().default(true),
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
    const parsed = transferSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Target station is required' }, { status: 400 });
    }

    const session = getSessionById(id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    if (session.status !== 'active' && session.status !== 'paused') {
      return NextResponse.json(
        { error: 'Only active or paused sessions can be transferred' },
        { status: 409 }
      );
    }
    if (parsed.data.targetStationId === session.station_id) {
      return NextResponse.json({ error: 'Select a different target station' }, { status: 400 });
    }

    const allRules = getAllPricingRules();
    const nowIso = new Date().toISOString();

    withTransaction((db) => {
      const target = toPlain<{
        id: string;
        name: string;
        category_id: string;
        status: StationStatus;
      }>(
        db
          .prepare('SELECT id, name, category_id, status FROM gaming_stations WHERE id = ?')
          .get(parsed.data.targetStationId) as never
      );

      if (!target) {
        throw Object.assign(new Error('Target station not found'), { status: 404 });
      }
      if (target.status !== 'available') {
        throw Object.assign(
          new Error(`${target.name} is currently ${target.status}`),
          { status: 409 }
        );
      }

      const activeOnTarget = toPlain<{ id: string }>(
        db
          .prepare("SELECT id FROM sessions WHERE station_id = ? AND status IN ('active', 'paused')")
          .get(target.id) as never
      );
      if (activeOnTarget) {
        throw Object.assign(new Error(`${target.name} already has an active session`), {
          status: 409,
        });
      }

      let nextRate30 = session.rate_30min;
      let nextRate60 = session.rate_60min;
      if (!parsed.data.keepOriginalRate) {
        const rule = resolveEffectivePricing(target.id, target.category_id, allRules);
        if (rule) {
          nextRate30 = rule.rate_30min;
          nextRate60 = rule.rate_60min;
        }
      }

      db.prepare("UPDATE gaming_stations SET status = 'available', updated_at = ? WHERE id = ?").run(
        nowIso,
        session.station_id
      );
      db.prepare("UPDATE gaming_stations SET status = 'occupied', updated_at = ? WHERE id = ?").run(
        nowIso,
        target.id
      );

      db.prepare(
        `UPDATE sessions
         SET station_id = ?, rate_30min = ?, rate_60min = ?, updated_at = ?
         WHERE id = ?`
      ).run(target.id, nextRate30, nextRate60, nowIso, id);

      db.prepare(
        `INSERT INTO session_events (id, session_id, event_type, payload_json, actor_staff_id, created_at)
         VALUES (?, ?, 'transferred', ?, ?, ?)`
      ).run(
        `evt_${crypto.randomUUID().slice(0, 10)}`,
        id,
        JSON.stringify({
          fromStationId: session.station_id,
          fromStationName: session.station_name,
          toStationId: target.id,
          toStationName: target.name,
        }),
        auth.staff.staffId,
        nowIso
      );

      logActivity({
        staff: auth.staff,
        action: 'session_transferred',
        entityType: 'session',
        entityId: id,
        summary: `Transferred ${session.session_code} from ${session.station_name} to ${target.name}`,
        createdAt: nowIso,
      });
    });

    return NextResponse.json({ session: getSessionById(id) });
  } catch (err) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: e.message || 'Failed to transfer session' },
      { status: e.status || 500 }
    );
  }
}
