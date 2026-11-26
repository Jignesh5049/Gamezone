import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { toPlainAll, withTransaction } from '@/lib/db';
import { logActivity, requireAuth } from '@/lib/auth';
import { getAllSettings, getSessionById } from '@/lib/queries';
import type { PaymentRecord, PaymentStatus } from '@/lib/types';

const settleSchema = z.object({
  amount: z.number().positive(),
  method: z.enum(['cash', 'upi', 'card', 'other']).default('cash'),
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
    const parsed = settleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Valid positive payment amount required' }, { status: 400 });
    }

    const session = getSessionById(id);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    if (session.status !== 'completed') {
      return NextResponse.json(
        { error: 'Payments can only be settled on completed sessions' },
        { status: 409 }
      );
    }

    const nowIso = new Date().toISOString();
    const amount = Math.round(parsed.data.amount);
    const nextPaid = Math.round(session.paid_amount + amount);
    const nextStatus: PaymentStatus =
      nextPaid >= session.final_amount ? 'paid' : 'partial';
    const receiptNumber = `RCP-${new Date().getFullYear()}-${Math.floor(
      10000 + Math.random() * 90000
    )}`;

    const payments = withTransaction((db) => {
      db.prepare(
        `INSERT INTO payments (id, receipt_number, session_id, customer_id, amount, method, status, reference_note, received_by, paid_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?)`
      ).run(
        `pay_${crypto.randomUUID().slice(0, 10)}`,
        receiptNumber,
        id,
        session.customer_id,
        amount,
        parsed.data.method,
        parsed.data.referenceNote?.trim() || null,
        auth.staff.staffId,
        nowIso,
        nowIso
      );

      db.prepare(
        'UPDATE sessions SET paid_amount = ?, payment_status = ?, updated_at = ? WHERE id = ?'
      ).run(nextPaid, nextStatus, nowIso, id);

      if (session.customer_id) {
        db.prepare(
          'UPDATE customers SET total_spent = total_spent + ?, updated_at = ? WHERE id = ?'
        ).run(amount, nowIso, session.customer_id);
      }

      logActivity({
        staff: auth.staff,
        action: 'payment_settled',
        entityType: 'payment',
        entityId: id,
        summary: `Recorded ₹${amount} (${parsed.data.method.toUpperCase()}) for ${session.session_code}`,
        createdAt: nowIso,
      });

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

    const updatedSession = getSessionById(id)!;
    const settings = getAllSettings();

    return NextResponse.json({
      session: updatedSession,
      payments,
      receipt: {
        zoneName: settings.zone_name || 'Apex Arena Game Zone',
        zoneAddress: settings.zone_address || '',
        zonePhone: settings.zone_phone || '',
        receiptNumber,
        issuedAt: nowIso,
        session: updatedSession,
        payments,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to settle payment' }, { status: 500 });
  }
}
