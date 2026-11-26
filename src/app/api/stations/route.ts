import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, toPlain } from '@/lib/db';
import { logActivity, requireAuth } from '@/lib/auth';
import { getAllStationsWithState } from '@/lib/queries';

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  return NextResponse.json({ stations: getAllStationsWithState() });
}

const createStationSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(2).max(60),
  code: z.string().min(2).max(20).optional(),
  equipmentModel: z.string().max(120).optional().nullable(),
  purchaseDate: z.string().max(30).optional().nullable(),
  purchaseCost: z.number().min(0).optional().nullable(),
  notes: z.string().max(300).optional().nullable(),
  customRate30: z.number().min(0).optional().nullable(),
  customRate60: z.number().min(0).optional().nullable(),
});

export async function POST(request: Request) {
  const auth = await requireAuth(['admin', 'manager']);
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const parsed = createStationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid station data' },
        { status: 400 }
      );
    }

    const db = getDb();
    const cat = toPlain<{ id: string; name: string }>(
      db.prepare('SELECT id, name FROM game_categories WHERE id = ?').get(parsed.data.categoryId) as never
    );
    if (!cat) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    const name = parsed.data.name.trim();
    const dup = toPlain<{ id: string }>(
      db.prepare('SELECT id FROM gaming_stations WHERE LOWER(name) = LOWER(?)').get(name) as never
    );
    if (dup) {
      return NextResponse.json({ error: 'A station with this name already exists' }, { status: 409 });
    }

    const maxOrder = toPlain<{ maxOrder: number }>(
      db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM gaming_stations').get() as never
    );

    const id = `stn_${crypto.randomUUID().slice(0, 8)}`;
    const nowIso = new Date().toISOString();
    const code =
      parsed.data.code?.trim().toUpperCase() ||
      name
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .toUpperCase()
        .slice(0, 10);

    db.prepare(
      `INSERT INTO gaming_stations (id, category_id, name, code, status, equipment_model, purchase_date, purchase_cost, notes, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'available', ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      cat.id,
      name,
      code,
      parsed.data.equipmentModel ?? null,
      parsed.data.purchaseDate ?? null,
      parsed.data.purchaseCost ?? null,
      parsed.data.notes ?? null,
      (maxOrder?.maxOrder ?? 0) + 1,
      nowIso,
      nowIso
    );

    if (
      parsed.data.customRate30 !== undefined &&
      parsed.data.customRate30 !== null
    ) {
      const r30 = parsed.data.customRate30;
      const r60 = parsed.data.customRate60 ?? r30 * 2;
      db.prepare(
        `INSERT INTO pricing_rules (id, category_id, station_id, name, rate_30min, rate_60min, custom_hourly_rate, default_billing_mode, billing_increment_minutes, offer_label, offer_discount_percent, is_active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'fixed', 30, NULL, 0, 1, ?, ?)`
      ).run(`prc_${crypto.randomUUID().slice(0, 8)}`, cat.id, id, `${name} Custom Rate`, r30, r60, r60, nowIso, nowIso);
    }

    logActivity({
      staff: auth.staff,
      action: 'station_created',
      entityType: 'gaming_station',
      entityId: id,
      summary: `Added station "${name}" under ${cat.name}`,
    });

    return NextResponse.json({ id, name, code }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create station' }, { status: 500 });
  }
}
