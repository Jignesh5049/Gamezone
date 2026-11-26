import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { toPlainAll, withTransaction } from '@/lib/db';
import { logActivity, requireAuth } from '@/lib/auth';
import { getAllSettings, getSessionById } from '@/lib/queries';
import { calculateRentalAmount, computeSessionMetrics } from '@/lib/timer';
import type { PaymentRecord, PaymentStatus } from '@/lib/types';

export async function GET(
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

  const nowMs = Date.now();
  const metrics = computeSessionMetrics(session, nowMs);
  const calculation = calculateRentalAmount({
    billableElapsedSeconds: metrics.billableElapsedSeconds,
    plannedDurationMinutes: session.planned_duration_minutes,
    billingMode: session.billing_mode,
    billingIncrementMinutes: session.billing_increment_minutes,
    ratePer30Min: session.rate_30min,
    ratePer60Min: session.rate_60min,
    offerDiscountPercent: session.offer_discount_percent,
  });

  return NextResponse.json({
    serverNow: new Date(nowMs).toISOString(),
    session,
    metrics,
    calculation,
  });
}

const checkoutSchema = z.object({
  additionalCharges: z.number().min(0).default(0),
  discountAmount: z.number().min(0).default(0),
  discountReason: z.string().max(200).optional().nullable(),
  paymentMethod: z.enum(['cash', 'upi', 'card', 'other']).default('cash'),
  paidAmount: z.number().min(0),
  referenceNote: z.string().max(200).optional().nullable(),
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
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid checkout payload' },
        { status: 400 }
      );
    }

    const session = getSessionById(id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    if (session.status !== 'active' && session.status !== 'paused') {
      return NextResponse.json(
        { error: `Session is already ${session.status}` },
        { status: 409 }
      );
    }

    const discountAuthorizedBy =
      parsed.data.discountAmount > 0 ? auth.staff.staffId : null;

    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const metrics = computeSessionMetrics(session, nowMs);
    const calculation = calculateRentalAmount({
      billableElapsedSeconds: metrics.billableElapsedSeconds,
      plannedDurationMinutes: session.planned_duration_minutes,
      billingMode: session.billing_mode,
      billingIncrementMinutes: session.billing_increment_minutes,
      ratePer30Min: session.rate_30min,
      ratePer60Min: session.rate_60min,
      offerDiscountPercent: session.offer_discount_percent,
    });

    const finalAmount = Math.max(
      0,
      Math.round(
        calculation.baseAmount +
          parsed.data.additionalCharges -
          parsed.data.discountAmount
      )
    );
    const paidAmount = Math.round(parsed.data.paidAmount);

    let paymentStatus: PaymentStatus = 'unpaid';
    if (finalAmount === 0 || paidAmount >= finalAmount) {
      paymentStatus = 'paid';
    } else if (paidAmount > 0) {
      paymentStatus = 'partial';
    }

    const receiptNumber = `RCP-${new Date().getFullYear()}-${Math.floor(
      10000 + Math.random() * 90000
    )}`;

    const payments = withTransaction((db) => {
      db.prepare(
        `UPDATE sessions
         SET status = 'completed',
             ended_at = ?,
             paused_at = NULL,
             accumulated_paused_seconds = ?,
             billable_minutes = ?,
             base_amount = ?,
             additional_charges = ?,
             discount_amount = ?,
             discount_reason = ?,
             discount_authorized_by = ?,
             final_amount = ?,
             paid_amount = ?,
             payment_status = ?,
             ended_by = ?,
             updated_at = ?
         WHERE id = ?`
      ).run(
        nowIso,
        metrics.totalPausedSeconds,
        calculation.billableMinutes,
        calculation.baseAmount,
        parsed.data.additionalCharges,
        parsed.data.discountAmount,
        parsed.data.discountReason?.trim() || null,
        discountAuthorizedBy,
        finalAmount,
        paidAmount,
        paymentStatus,
        auth.staff.staffId,
        nowIso,
        id
      );

      db.prepare("UPDATE gaming_stations SET status = 'available', updated_at = ? WHERE id = ?").run(
        nowIso,
        session.station_id
      );

      if (paidAmount > 0) {
        const payId = `pay_${crypto.randomUUID().slice(0, 10)}`;
        db.prepare(
          `INSERT INTO payments (id, receipt_number, session_id, customer_id, amount, method, status, reference_note, received_by, paid_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?)`
        ).run(
          payId,
          receiptNumber,
          id,
          session.customer_id,
          paidAmount,
          parsed.data.paymentMethod,
          parsed.data.referenceNote?.trim() || null,
          auth.staff.staffId,
          nowIso,
          nowIso
        );
      }

      if (session.customer_id) {
        db.prepare(
          `UPDATE customers
           SET total_visits = total_visits + 1,
               total_spent = total_spent + ?,
               last_visit_at = ?,
               updated_at = ?
           WHERE id = ?`
        ).run(paidAmount, nowIso, nowIso, session.customer_id);
      }

      db.prepare(
        `INSERT INTO session_events (id, session_id, event_type, payload_json, actor_staff_id, created_at)
         VALUES (?, ?, 'completed', ?, ?, ?)`
      ).run(
        `evt_${crypto.randomUUID().slice(0, 10)}`,
        id,
        JSON.stringify({
          billableMinutes: calculation.billableMinutes,
          finalAmount,
          paidAmount,
          paymentStatus,
          method: parsed.data.paymentMethod,
          receiptNumber: paidAmount > 0 ? receiptNumber : null,
        }),
        auth.staff.staffId,
        nowIso
      );

      logActivity({
        staff: auth.staff,
        action: 'session_completed',
        entityType: 'session',
        entityId: id,
        summary: `Ended ${session.station_name} (${session.session_code}) — Bill ₹${finalAmount}, Paid ₹${paidAmount} (${paymentStatus})`,
        createdAt: nowIso,
      });

      if (parsed.data.discountAmount > 0) {
        logActivity({
          staff: auth.staff,
          action: 'discount_applied',
          entityType: 'session',
          entityId: id,
          summary: `Applied ₹${parsed.data.discountAmount} discount on ${session.session_code}`,
          createdAt: nowIso,
        });
      }

      return toPlainAll<PaymentRecord>(
        db
          .prepare(
            `SELECT p.*, u.full_name AS received_by_name
             FROM payments p
             LEFT JOIN staff st ON st.id = p.received_by
             LEFT JOIN users u ON u.id = st.user_id
             WHERE p.session_id = ?
             ORDER BY p.paid_at ASC`
          )
          .all(id) as never
      );
    });

    const completedSession = getSessionById(id)!;
    const settings = getAllSettings();

    return NextResponse.json({
      session: completedSession,
      payments,
      receipt: {
        zoneName: settings.zone_name || 'Apex Arena Game Zone',
        zoneAddress: settings.zone_address || '',
        zonePhone: settings.zone_phone || '',
        receiptNumber: payments[payments.length - 1]?.receipt_number || receiptNumber,
        issuedAt: nowIso,
        session: completedSession,
        payments,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to complete checkout' }, { status: 500 });
  }
}
