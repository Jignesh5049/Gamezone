import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, toPlainAll, withTransaction } from '@/lib/db';
import { logActivity, requireAuth } from '@/lib/auth';
import { getSessionById } from '@/lib/queries';
import { calculateRentalAmount, computeSessionMetrics } from '@/lib/timer';
import type { PaymentRecord, SessionEventRecord } from '@/lib/types';

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

  const db = getDb();
  const events = toPlainAll<SessionEventRecord>(
    db
      .prepare(
        `SELECT se.*, u.full_name AS actor_name
         FROM session_events se
         LEFT JOIN staff st ON st.id = se.actor_staff_id
         LEFT JOIN users u ON u.id = st.user_id
         WHERE se.session_id = ?
         ORDER BY se.created_at ASC`
      )
      .all(id) as never
  );

  const payments = toPlainAll<PaymentRecord>(
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
    events,
    payments,
  });
}

const patchSessionSchema = z.object({
  customerId: z.string().optional().nullable(),
  customerName: z.string().max(100).optional().nullable(),
  notes: z.string().max(400).optional().nullable(),
  discountAmount: z.number().min(0).optional(),
  discountReason: z.string().max(200).optional().nullable(),
  action: z.enum(['update', 'cancel']).optional(),
  cancelReason: z.string().max(300).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const { id } = await context.params;
    const body = await request.json();
    const parsed = patchSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid session update' },
        { status: 400 }
      );
    }

    const existing = getSessionById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const nowIso = new Date().toISOString();

    if (parsed.data.action === 'cancel') {
      if (existing.status === 'completed' || existing.status === 'cancelled') {
        return NextResponse.json(
          { error: 'Only active or paused sessions can be cancelled' },
          { status: 409 }
        );
      }
      const reason = parsed.data.cancelReason?.trim();
      if (!reason || reason.length < 3) {
        return NextResponse.json(
          { error: 'A cancellation reason is required' },
          { status: 400 }
        );
      }

      withTransaction((db) => {
        db.prepare(
          `UPDATE sessions
           SET status = 'cancelled', ended_at = ?, cancel_reason = ?, ended_by = ?,
               billable_minutes = 0, base_amount = 0, final_amount = 0, updated_at = ?
           WHERE id = ?`
        ).run(nowIso, reason, auth.staff.staffId, nowIso, id);

        db.prepare("UPDATE gaming_stations SET status = 'available', updated_at = ? WHERE id = ?").run(
          nowIso,
          existing.station_id
        );

        db.prepare(
          `INSERT INTO session_events (id, session_id, event_type, payload_json, actor_staff_id, created_at)
           VALUES (?, ?, 'cancelled', ?, ?, ?)`
        ).run(
          `evt_${crypto.randomUUID().slice(0, 10)}`,
          id,
          JSON.stringify({ reason }),
          auth.staff.staffId,
          nowIso
        );

        logActivity({
          staff: auth.staff,
          action: 'session_cancelled',
          entityType: 'session',
          entityId: id,
          summary: `Cancelled session ${existing.session_code} on ${existing.station_name}: ${reason}`,
          createdAt: nowIso,
        });
      });

      return NextResponse.json({ session: getSessionById(id) });
    }

    // Standard update / discount application
    let authorizedByStaffId = existing.discount_authorized_by;
    if (
      parsed.data.discountAmount !== undefined &&
      parsed.data.discountAmount !== existing.discount_amount &&
      parsed.data.discountAmount > 0
    ) {
      authorizedByStaffId = auth.staff.staffId;
    }

    withTransaction((db) => {
      const nextCustomerId =
        parsed.data.customerId !== undefined ? parsed.data.customerId : existing.customer_id;
      const nextCustomerName =
        parsed.data.customerName !== undefined
          ? parsed.data.customerName?.trim() || null
          : existing.customer_name;
      const nextNotes =
        parsed.data.notes !== undefined ? parsed.data.notes?.trim() || null : existing.notes;
      const nextDiscount =
        parsed.data.discountAmount !== undefined
          ? parsed.data.discountAmount
          : existing.discount_amount;
      const nextDiscountReason =
        parsed.data.discountReason !== undefined
          ? parsed.data.discountReason?.trim() || null
          : existing.discount_reason;

      const nextFinal = Math.max(
        0,
        Math.round(existing.base_amount + existing.additional_charges - nextDiscount)
      );

      let nextPayStatus = existing.payment_status;
      if (existing.status === 'completed') {
        if (existing.paid_amount >= nextFinal && nextFinal > 0) nextPayStatus = 'paid';
        else if (existing.paid_amount > 0) nextPayStatus = 'partial';
        else if (nextFinal === 0) nextPayStatus = 'paid';
        else nextPayStatus = 'unpaid';
      }

      db.prepare(
        `UPDATE sessions
         SET customer_id = ?, customer_name = ?, notes = ?,
             discount_amount = ?, discount_reason = ?, discount_authorized_by = ?,
             final_amount = ?, payment_status = ?, updated_at = ?
         WHERE id = ?`
      ).run(
        nextCustomerId,
        nextCustomerName,
        nextNotes,
        nextDiscount,
        nextDiscountReason,
        authorizedByStaffId,
        nextFinal,
        nextPayStatus,
        nowIso,
        id
      );

      if (
        parsed.data.discountAmount !== undefined &&
        parsed.data.discountAmount !== existing.discount_amount
      ) {
        logActivity({
          staff: auth.staff,
          action: 'discount_applied',
          entityType: 'session',
          entityId: id,
          summary: `Applied ₹${nextDiscount} discount on ${existing.session_code} (${nextDiscountReason || 'No reason'})`,
          createdAt: nowIso,
        });
      } else {
        logActivity({
          staff: auth.staff,
          action: 'session_updated',
          entityType: 'session',
          entityId: id,
          summary: `Updated details for session ${existing.session_code}`,
          createdAt: nowIso,
        });
      }
    });

    return NextResponse.json({ session: getSessionById(id) });
  } catch {
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
}
