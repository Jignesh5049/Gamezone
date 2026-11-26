import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, toPlain } from '@/lib/db';
import { logActivity, requireAuth } from '@/lib/auth';
import { getAllCategories } from '@/lib/queries';

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  return NextResponse.json({ categories: getAllCategories() });
}

const createCategorySchema = z.object({
  name: z.string().min(2).max(60),
  icon: z.string().min(1).max(40).optional(),
  description: z.string().max(240).optional().nullable(),
  defaultRate30: z.number().min(0).optional(),
  defaultRate60: z.number().min(0).optional(),
});

export async function POST(request: Request) {
  const auth = await requireAuth(['admin', 'manager']);
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const parsed = createCategorySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid category data' },
        { status: 400 }
      );
    }

    const db = getDb();
    const name = parsed.data.name.trim();
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const dup = toPlain<{ id: string }>(
      db
        .prepare('SELECT id FROM game_categories WHERE LOWER(name) = LOWER(?) OR slug = ?')
        .get(name, slug) as never
    );
    if (dup) {
      return NextResponse.json({ error: 'Category already exists' }, { status: 409 });
    }

    const maxOrder = toPlain<{ maxOrder: number }>(
      db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS maxOrder FROM game_categories').get() as never
    );

    const id = `cat_${crypto.randomUUID().slice(0, 8)}`;
    const nowIso = new Date().toISOString();

    db.prepare(
      `INSERT INTO game_categories (id, name, slug, icon, description, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      name,
      slug,
      parsed.data.icon || 'gamepad-2',
      parsed.data.description ?? null,
      (maxOrder?.maxOrder ?? 0) + 1,
      nowIso
    );

    if (parsed.data.defaultRate30 !== undefined) {
      const r30 = parsed.data.defaultRate30;
      const r60 = parsed.data.defaultRate60 ?? r30 * 2;
      db.prepare(
        `INSERT INTO pricing_rules (id, category_id, station_id, name, rate_30min, rate_60min, custom_hourly_rate, default_billing_mode, billing_increment_minutes, offer_label, offer_discount_percent, is_active, created_at, updated_at)
         VALUES (?, ?, NULL, ?, ?, ?, ?, 'fixed', 30, NULL, 0, 1, ?, ?)`
      ).run(`prc_${crypto.randomUUID().slice(0, 8)}`, id, `${name} Standard Rate`, r30, r60, r60, nowIso, nowIso);
    }

    logActivity({
      staff: auth.staff,
      action: 'category_created',
      entityType: 'game_category',
      entityId: id,
      summary: `Added game category "${name}"`,
    });

    return NextResponse.json({ id, name, slug }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}
