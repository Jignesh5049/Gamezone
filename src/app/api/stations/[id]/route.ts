import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, toPlain } from '@/lib/db';
import { logActivity, requireAuth } from '@/lib/auth';
import type { StationStatus } from '@/lib/types';

const patchStationSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  code: z.string().min(2).max(20).optional(),
  categoryId: z.string().optional(),
  status: z.enum(['available', 'maintenance', 'disabled']).optional(),
  equipmentModel: z.string().max(120).optional().nullable(),
  purchaseDate: z.string().max(30).optional().nullable(),
  purchaseCost: z.number().min(0).optional().nullable(),
  notes: z.string().max(300).optional().nullable(),
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
    const parsed = patchStationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid station update' },
        { status: 400 }
      );
    }

    const db = getDb();
    const station = toPlain<{
      id: string;
      name: string;
      code: string;
      category_id: string;
      status: StationStatus;
      equipment_model: string | null;
      purchase_date: string | null;
      purchase_cost: number | null;
      notes: string | null;
    }>(db.prepare('SELECT * FROM gaming_stations WHERE id = ?').get(id) as never);

    if (!station) {
      return NextResponse.json({ error: 'Station not found' }, { status: 404 });
    }

    if (parsed.data.status && station.status === 'occupied') {
      return NextResponse.json(
        { error: 'Cannot change status while a live session is active on this station' },
        { status: 409 }
      );
    }

    const nowIso = new Date().toISOString();
    const nextName = parsed.data.name?.trim() ?? station.name;
    const nextCode = parsed.data.code?.trim().toUpperCase() ?? station.code;
    const nextCat = parsed.data.categoryId ?? station.category_id;
    const nextStatus = parsed.data.status ?? station.status;
    const nextModel =
      parsed.data.equipmentModel !== undefined
        ? parsed.data.equipmentModel
        : station.equipment_model;
    const nextPurchaseDate =
      parsed.data.purchaseDate !== undefined
        ? parsed.data.purchaseDate
        : station.purchase_date;
    const nextPurchaseCost =
      parsed.data.purchaseCost !== undefined
        ? parsed.data.purchaseCost
        : station.purchase_cost;
    const nextNotes =
      parsed.data.notes !== undefined ? parsed.data.notes : station.notes;

    db.prepare(
      `UPDATE gaming_stations
       SET name = ?, code = ?, category_id = ?, status = ?, equipment_model = ?,
           purchase_date = ?, purchase_cost = ?, notes = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      nextName,
      nextCode,
      nextCat,
      nextStatus,
      nextModel,
      nextPurchaseDate,
      nextPurchaseCost,
      nextNotes,
      nowIso,
      id
    );

    logActivity({
      staff: auth.staff,
      action:
        parsed.data.status && parsed.data.status !== station.status
          ? `station_status_${parsed.data.status}`
          : 'station_updated',
      entityType: 'gaming_station',
      entityId: id,
      summary: `Updated station "${nextName}" (status: ${nextStatus})`,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to update station' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(['admin']);
  if ('error' in auth) return auth.error;

  const { id } = await context.params;
  const db = getDb();
  const station = toPlain<{ id: string; name: string; status: StationStatus }>(
    db.prepare('SELECT id, name, status FROM gaming_stations WHERE id = ?').get(id) as never
  );
  if (!station) {
    return NextResponse.json({ error: 'Station not found' }, { status: 404 });
  }
  if (station.status === 'occupied') {
    return NextResponse.json({ error: 'Cannot delete an occupied station' }, { status: 409 });
  }

  const sessCount = toPlain<{ cnt: number }>(
    db.prepare('SELECT COUNT(*) AS cnt FROM sessions WHERE station_id = ?').get(id) as never
  );
  if ((sessCount?.cnt ?? 0) > 0) {
    db.prepare("UPDATE gaming_stations SET status = 'disabled', updated_at = ? WHERE id = ?").run(
      new Date().toISOString(),
      id
    );
    logActivity({
      staff: auth.staff,
      action: 'station_disabled',
      entityType: 'gaming_station',
      entityId: id,
      summary: `Disabled station "${station.name}" (preserved session history)`,
    });
    return NextResponse.json({ ok: true, disabledInsteadOfDeleted: true });
  }

  db.prepare('DELETE FROM gaming_stations WHERE id = ?').run(id);
  logActivity({
    staff: auth.staff,
    action: 'station_deleted',
    entityType: 'gaming_station',
    entityId: id,
    summary: `Deleted station "${station.name}"`,
  });
  return NextResponse.json({ ok: true });
}
