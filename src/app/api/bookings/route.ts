import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDb, toPlain, toPlainAll, withTransaction } from '@/lib/db';
import { logActivity, requireAuth } from '@/lib/auth';
import type { BookingRecord } from '@/lib/types';

export async function GET(request: Request) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  const db = getDb();
  const where = status && status !== 'all' ? 'WHERE b.status = ?' : '';
  const params = status && status !== 'all' ? [status] : [];

  const bookings = toPlainAll<BookingRecord>(
    db
      .prepare(
        `SELECT b.*, gs.name AS station_name, gc.name AS category_name, u.full_name AS created_by_name
         FROM bookings b
         JOIN gaming_stations gs ON gs.id = b.station_id
         JOIN game_categories gc ON gc.id = gs.category_id
         LEFT JOIN staff st ON st.id = b.created_by
         LEFT JOIN users u ON u.id = st.user_id
         ${where}
         ORDER BY b.scheduled_start_at ASC`
      )
      .all(...params) as never
  );

  return NextResponse.json({ bookings });
}

const createBookingSchema = z.object({
  stationIds: z.array(z.string().min(1)).min(1),
  customerName: z.string().max(100).optional().nullable(),
  scheduledStartAt: z.string().min(1),
  durationMinutes: z.number().int().min(15).max(480),
  notes: z.string().max(300).optional().nullable(),
});

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const parsed = createBookingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid booking data' },
        { status: 400 }
      );
    }

    const startMs = Date.parse(parsed.data.scheduledStartAt);
    if (Number.isNaN(startMs)) {
      return NextResponse.json({ error: 'Invalid scheduled start time' }, { status: 400 });
    }
    const endMs = startMs + parsed.data.durationMinutes * 60_000;
    const nowIso = new Date().toISOString();
    const groupBookingId =
      parsed.data.stationIds.length > 1
        ? `grp_bkg_${crypto.randomUUID().slice(0, 8)}`
        : null;

    const createdIds = withTransaction((db) => {
      const ids: string[] = [];

      for (const stId of Array.from(new Set(parsed.data.stationIds))) {
        const station = toPlain<{ id: string; name: string; status: string }>(
          db.prepare('SELECT id, name, status FROM gaming_stations WHERE id = ?').get(stId) as never
        );
        if (!station) {
          throw Object.assign(new Error('Station not found'), { status: 404 });
        }
        if (station.status === 'maintenance' || station.status === 'disabled') {
          throw Object.assign(
            new Error(`${station.name} is ${station.status} and cannot be booked`),
            { status: 409 }
          );
        }

        // Check overlapping confirmed bookings
        const existingBookings = toPlainAll<{
          id: string;
          scheduled_start_at: string;
          duration_minutes: number;
        }>(
          db
            .prepare(
              "SELECT id, scheduled_start_at, duration_minutes FROM bookings WHERE station_id = ? AND status = 'confirmed'"
            )
            .all(stId) as never
        );

        for (const b of existingBookings) {
          const bStart = Date.parse(b.scheduled_start_at);
          const bEnd = bStart + b.duration_minutes * 60_000;
          if (startMs < bEnd && endMs > bStart) {
            throw Object.assign(
              new Error(`${station.name} already has a conflicting booking in that slot`),
              { status: 409 }
            );
          }
        }

        const id = `bkg_${crypto.randomUUID().slice(0, 8)}`;
        const code = `BKG-${Math.floor(100 + Math.random() * 900)}-${crypto
          .randomBytes(1)
          .toString('hex')
          .toUpperCase()}`;
        const slotLabel = parsed.data.customerName?.trim() || 'Reserved Slot';

        db.prepare(
          `INSERT INTO bookings (
            id, booking_code, group_booking_id, station_id, customer_id, customer_name, customer_phone,
            scheduled_start_at, duration_minutes, status, notes, created_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, NULL, ?, NULL, ?, ?, 'confirmed', ?, ?, ?, ?)`
        ).run(
          id,
          code,
          groupBookingId,
          stId,
          slotLabel,
          new Date(startMs).toISOString(),
          parsed.data.durationMinutes,
          parsed.data.notes?.trim() || null,
          auth.staff.staffId,
          nowIso,
          nowIso
        );

        logActivity({
          staff: auth.staff,
          action: 'booking_created',
          entityType: 'booking',
          entityId: id,
          summary: `Reserved ${station.name} (${code}) for ${parsed.data.durationMinutes}m`,
          createdAt: nowIso,
        });

        ids.push(id);
      }

      return ids;
    });

    return NextResponse.json({ ids: createdIds, groupBookingId }, { status: 201 });
  } catch (err) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: e.message || 'Failed to create booking' },
      { status: e.status || 500 }
    );
  }
}
