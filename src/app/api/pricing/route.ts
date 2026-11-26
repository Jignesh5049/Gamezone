import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, toPlain } from '@/lib/db';
import { logActivity, requireAuth } from '@/lib/auth';
import { getAllPricingRules } from '@/lib/queries';

export async function GET() {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;
  return NextResponse.json({ rules: getAllPricingRules() });
}

const createRuleSchema = z.object({
  categoryId: z.string().min(1),
  stationId: z.string().optional().nullable(),
  name: z.string().min(2).max(100),
  rate30Min: z.number().min(0),
  rate60Min: z.number().min(0),
  customHourlyRate: z.number().min(0).optional().nullable(),
  defaultBillingMode: z.enum(['fixed', 'pay_as_you_play']).default('fixed'),
  billingIncrementMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]).default(30),
  offerLabel: z.string().max(80).optional().nullable(),
  offerDiscountPercent: z.number().min(0).max(100).default(0),
});

export async function POST(request: Request) {
  const auth = await requireAuth(['admin']);
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const parsed = createRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid pricing rule' },
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

    const id = `prc_${crypto.randomUUID().slice(0, 8)}`;
    const nowIso = new Date().toISOString();

    db.prepare(
      `INSERT INTO pricing_rules (
        id, category_id, station_id, name, rate_30min, rate_60min, custom_hourly_rate,
        default_billing_mode, billing_increment_minutes, offer_label, offer_discount_percent,
        is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    ).run(
      id,
      parsed.data.categoryId,
      parsed.data.stationId || null,
      parsed.data.name.trim(),
      parsed.data.rate30Min,
      parsed.data.rate60Min,
      parsed.data.customHourlyRate ?? parsed.data.rate60Min,
      parsed.data.defaultBillingMode,
      parsed.data.billingIncrementMinutes,
      parsed.data.offerLabel?.trim() || null,
      parsed.data.offerDiscountPercent,
      nowIso,
      nowIso
    );

    logActivity({
      staff: auth.staff,
      action: 'pricing_created',
      entityType: 'pricing_rule',
      entityId: id,
      summary: `Created pricing rule "${parsed.data.name}" (₹${parsed.data.rate30Min}/30m, ₹${parsed.data.rate60Min}/hr)`,
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create pricing rule' }, { status: 500 });
  }
}
