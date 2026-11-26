import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, toPlain } from '@/lib/db';
import { logActivity, requireAuth } from '@/lib/auth';
import type { BookingRecord } from '@/lib/types';

const patchBookingSchema = z.object({
  status: z.enum(['confirmed', 'checked_in', 'cancelled', 'completed']),
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
    const parsed = patchBookingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid booking status' }, { status: 400 });
    }

    const db = getDb();
    const booking = toPlain<BookingRecord>(
      db.prepare('SELECT * FROM bookings WHERE id = ?').get(id) as never
    );
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    db.prepare('UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?').run(
      parsed.data.status,
      new Date().toISOString(),
      id
    );

    logActivity({
      staff: auth.staff,
      action: `booking_${parsed.data.status}`,
      entityType: 'booking',
      entityId: id,
      summary: `Marked booking ${booking.booking_code} as ${parsed.data.status}`,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 });
  }
}
