import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, toPlain, toPlainAll, withTransaction } from '@/lib/db';
import { logActivity, requireAuth } from '@/lib/auth';
import type { MaintenanceRecord } from '@/lib/types';

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const db = getDb();
  const records = toPlainAll<MaintenanceRecord>(
    db
      .prepare(
        `SELECT mr.*, gs.name AS station_name, gc.name AS category_name, u.full_name AS recorded_by_name
         FROM maintenance_records mr
         JOIN gaming_stations gs ON gs.id = mr.station_id
         JOIN game_categories gc ON gc.id = gs.category_id
         LEFT JOIN staff st ON st.id = mr.recorded_by
         LEFT JOIN users u ON u.id = st.user_id
         ORDER BY mr.created_at DESC`
      )
      .all() as never
  );

  return NextResponse.json({ records });
}

const createMaintSchema = z.object({
  stationId: z.string().min(1),
  issueTitle: z.string().min(2).max(120),
  description: z.string().max(400).optional().nullable(),
  cost: z.number().min(0).default(0),
  technician: z.string().max(80).optional().nullable(),
  setStationMaintenance: z.boolean().default(true),
});

export async function POST(request: Request) {
  const auth = await requireAuth(['admin', 'manager']);
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const parsed = createMaintSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid maintenance record' },
        { status: 400 }
      );
    }

    const nowIso = new Date().toISOString();
    const id = `mnt_${crypto.randomUUID().slice(0, 8)}`;

    withTransaction((db) => {
      const station = toPlain<{ id: string; name: string; status: string }>(
        db
          .prepare('SELECT id, name, status FROM gaming_stations WHERE id = ?')
          .get(parsed.data.stationId) as never
      );
      if (!station) {
        throw Object.assign(new Error('Station not found'), { status: 404 });
      }
      if (parsed.data.setStationMaintenance && station.status === 'occupied') {
        throw Object.assign(
          new Error(`Cannot place ${station.name} under maintenance while a session is running`),
          { status: 409 }
        );
      }

      db.prepare(
        `INSERT INTO maintenance_records (id, station_id, issue_title, description, status, cost, technician, started_at, completed_at, recorded_by, created_at)
         VALUES (?, ?, ?, ?, 'open', ?, ?, ?, NULL, ?, ?)`
      ).run(
        id,
        station.id,
        parsed.data.issueTitle.trim(),
        parsed.data.description?.trim() || null,
        parsed.data.cost,
        parsed.data.technician?.trim() || null,
        nowIso,
        auth.staff.staffId,
        nowIso
      );

      if (parsed.data.setStationMaintenance) {
        db.prepare("UPDATE gaming_stations SET status = 'maintenance', updated_at = ? WHERE id = ?").run(
          nowIso,
          station.id
        );
      }

      logActivity({
        staff: auth.staff,
        action: 'maintenance_logged',
        entityType: 'maintenance_record',
        entityId: id,
        summary: `Logged maintenance for ${station.name}: ${parsed.data.issueTitle.trim()} (₹${parsed.data.cost})`,
        createdAt: nowIso,
      });
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (err) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: e.message || 'Failed to log maintenance' },
      { status: e.status || 500 }
    );
  }
}
