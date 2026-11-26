import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, toPlain } from '@/lib/db';
import { logActivity, requireAuth } from '@/lib/auth';
import type { PricingRule } from '@/lib/types';

const patchRuleSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  rate30Min: z.number().min(0).optional(),
  rate60Min: z.number().min(0).optional(),
  customHourlyRate: z.number().min(0).optional().nullable(),
  defaultBillingMode: z.enum(['fixed', 'pay_as_you_play']).optional(),
  billingIncrementMinutes: z.union([z.literal(15), z.literal(30), z.literal(60)]).optional(),
  offerLabel: z.string().max(80).optional().nullable(),
  offerDiscountPercent: z.number().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(['admin']);
  if ('error' in auth) return auth.error;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = patchRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid pricing update' },
        { status: 400 }
      );
    }

    const db = getDb();
    const rule = toPlain<PricingRule>(
      db.prepare('SELECT * FROM pricing_rules WHERE id = ?').get(id) as never
    );
    if (!rule) {
      return NextResponse.json({ error: 'Pricing rule not found' }, { status: 404 });
    }

    const nowIso = new Date().toISOString();
    const nextName = parsed.data.name?.trim() ?? rule.name;
    const nextR30 = parsed.data.rate30Min ?? rule.rate_30min;
    const nextR60 = parsed.data.rate60Min ?? rule.rate_60min;
    const nextCustom =
      parsed.data.customHourlyRate !== undefined
        ? parsed.data.customHourlyRate
        : rule.custom_hourly_rate;
    const nextMode = parsed.data.defaultBillingMode ?? rule.default_billing_mode;
    const nextInc = parsed.data.billingIncrementMinutes ?? rule.billing_increment_minutes;
    const nextOfferLabel =
      parsed.data.offerLabel !== undefined
        ? parsed.data.offerLabel?.trim() || null
        : rule.offer_label;
    const nextOfferPct = parsed.data.offerDiscountPercent ?? rule.offer_discount_percent;
    const nextActive =
      parsed.data.isActive !== undefined ? (parsed.data.isActive ? 1 : 0) : rule.is_active;

    db.prepare(
      `UPDATE pricing_rules
       SET name = ?, rate_30min = ?, rate_60min = ?, custom_hourly_rate = ?,
           default_billing_mode = ?, billing_increment_minutes = ?,
           offer_label = ?, offer_discount_percent = ?, is_active = ?, updated_at = ?
       WHERE id = ?`
    ).run(
      nextName,
      nextR30,
      nextR60,
      nextCustom,
      nextMode,
      nextInc,
      nextOfferLabel,
      nextOfferPct,
      nextActive,
      nowIso,
      id
    );

    logActivity({
      staff: auth.staff,
      action: 'pricing_updated',
      entityType: 'pricing_rule',
      entityId: id,
      summary: `Updated pricing "${nextName}": ₹${nextR30}/30m, ₹${nextR60}/hr, ${nextInc}m increment`,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to update pricing rule' }, { status: 500 });
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
  const rule = toPlain<PricingRule>(
    db.prepare('SELECT * FROM pricing_rules WHERE id = ?').get(id) as never
  );
  if (!rule) {
    return NextResponse.json({ error: 'Pricing rule not found' }, { status: 404 });
  }

  db.prepare('DELETE FROM pricing_rules WHERE id = ?').run(id);
  logActivity({
    staff: auth.staff,
    action: 'pricing_deleted',
    entityType: 'pricing_rule',
    entityId: id,
    summary: `Deleted pricing rule "${rule.name}"`,
  });
  return NextResponse.json({ ok: true });
}
