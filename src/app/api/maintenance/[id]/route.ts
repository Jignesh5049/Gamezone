import { NextResponse } from 'next/server';
import { z } from 'zod';
import { toPlain, withTransaction } from '@/lib/db';
import { logActivity, requireAuth } from '@/lib/auth';
import type { MaintenanceRecord } from '@/lib/types';

const patchMaintSchema = z.object({
  status: z.enum(['open', 'in_progress', 'completed']),
  cost: z.number().min(0).optional(),
  restoreStationAvailable: z.boolean().optional().default(true),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(['admin', 'manager']);
  if ('error' in auth) return auth.error;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = patchMaintSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid maintenance update' }, { status: 400 });
    }

    const nowIso = new Date().toISOString();

    withTransaction((db) => {
      const rec = toPlain<MaintenanceRecord>(
        db.prepare('SELECT * FROM maintenance_records WHERE id = ?').get(id) as never
      );
      if (!rec) {
        throw Object.assign(new Error('Maintenance record not found'), { status: 404 });
      }

      const completedAt =
        parsed.data.status === 'completed' ? rec.completed_at || nowIso : null;
      const nextCost = parsed.data.cost ?? rec.cost;

      db.prepare(
        'UPDATE maintenance_records SET status = ?, cost = ?, completed_at = ? WHERE id = ?'
      ).run(parsed.data.status, nextCost, completedAt, id);

      if (parsed.data.status === 'completed' && parsed.data.restoreStationAvailable) {
        db.prepare(
          "UPDATE gaming_stations SET status = 'available', updated_at = ? WHERE id = ? AND status = 'maintenance'"
        ).run(nowIso, rec.station_id);
      }

      logActivity({
        staff: auth.staff,
        action: `maintenance_${parsed.data.status}`,
        entityType: 'maintenance_record',
        entityId: id,
        summary: `Updated maintenance "${rec.issue_title}" to ${parsed.data.status}`,
        createdAt: nowIso,
      });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: e.message || 'Failed to update maintenance' },
      { status: e.status || 500 }
    );
  }
}
