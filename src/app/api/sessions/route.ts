import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { toPlain, withTransaction } from '@/lib/db';
import { logActivity, requireAuth } from '@/lib/auth';
import {
  getAllPricingRules,
  getSessionById,
  querySessions,
  resolveEffectivePricing,
} from '@/lib/queries';
import { calculateRentalAmount } from '@/lib/timer';
import type { BillingMode, StationStatus } from '@/lib/types';

export async function GET(request: Request) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const sessions = querySessions({
    preset: searchParams.get('preset'),
    from: searchParams.get('from'),
    to: searchParams.get('to'),
    categoryId: searchParams.get('categoryId'),
    stationId: searchParams.get('stationId'),
    paymentStatus: searchParams.get('paymentStatus'),
    status: searchParams.get('status'),
    search: searchParams.get('search'),
    limit: Number(searchParams.get('limit') || 200),
  });

  return NextResponse.json({ sessions });
}

const startSessionSchema = z.object({
  stationId: z.string().optional(),
  stationIds: z.array(z.string().min(1)).optional(),
  customerId: z.string().optional().nullable(),
  customerName: z.string().max(100).optional().nullable(),
  customerPhone: z.string().max(30).optional().nullable(),
  saveCustomer: z.boolean().optional(),
  billingMode: z.enum(['fixed', 'pay_as_you_play']).default('fixed'),
  plannedDurationMinutes: z.number().int().min(5).max(1440).optional().nullable(),
  notes: z.string().max(400).optional().nullable(),
  bookingId: z.string().optional().nullable(),
});

export async function POST(request: Request) {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();
    const parsed = startSessionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid session start payload' },
        { status: 400 }
      );
    }

    const targetIds = Array.from(
      new Set([
        ...(parsed.data.stationIds ?? []),
        ...(parsed.data.stationId ? [parsed.data.stationId] : []),
      ])
    );

    if (targetIds.length === 0) {
      return NextResponse.json({ error: 'Select at least one gaming station' }, { status: 400 });
    }

    if (
      parsed.data.billingMode === 'fixed' &&
      (!parsed.data.plannedDurationMinutes || parsed.data.plannedDurationMinutes < 5)
    ) {
      return NextResponse.json(
        { error: 'Planned duration (minimum 5 minutes) is required for fixed billing' },
        { status: 400 }
      );
    }

    const allRules = getAllPricingRules();
    const now = new Date();
    const nowIso = now.toISOString();
    const groupBookingId =
      targetIds.length > 1 ? `grp_${crypto.randomUUID().slice(0, 8)}` : null;

    const createdIds = withTransaction((db) => {
      // Optional customer creation/resolution
      let resolvedCustomerId = parsed.data.customerId ?? null;
      let resolvedCustomerName = parsed.data.customerName?.trim() || null;

      if (resolvedCustomerId) {
        const cust = toPlain<{ id: string; name: string }>(
          db.prepare('SELECT id, name FROM customers WHERE id = ?').get(resolvedCustomerId) as never
        );
        if (cust) {
          resolvedCustomerName = resolvedCustomerName || cust.name;
        } else {
          resolvedCustomerId = null;
        }
      } else if (
        resolvedCustomerName &&
        (parsed.data.saveCustomer || (parsed.data.customerPhone && parsed.data.customerPhone.trim()))
      ) {
        const phone = parsed.data.customerPhone?.trim() || null;
        if (phone) {
          const existingByPhone = toPlain<{ id: string; name: string }>(
            db.prepare('SELECT id, name FROM customers WHERE phone = ?').get(phone) as never
          );
          if (existingByPhone) {
            resolvedCustomerId = existingByPhone.id;
          }
        }
        if (!resolvedCustomerId) {
          resolvedCustomerId = `cust_${crypto.randomUUID().slice(0, 8)}`;
          db.prepare(
            `INSERT INTO customers (id, name, phone, notes, total_visits, total_spent, last_visit_at, created_at, updated_at)
             VALUES (?, ?, ?, NULL, 0, 0, NULL, ?, ?)`
          ).run(resolvedCustomerId, resolvedCustomerName, phone, nowIso, nowIso);
        }
      }

      const ids: string[] = [];

      for (const stId of targetIds) {
        const station = toPlain<{
          id: string;
          name: string;
          category_id: string;
          status: StationStatus;
        }>(
          db
            .prepare('SELECT id, name, category_id, status FROM gaming_stations WHERE id = ?')
            .get(stId) as never
        );

        if (!station) {
          throw Object.assign(new Error(`Station not found: ${stId}`), { status: 404 });
        }

        if (station.status === 'maintenance' || station.status === 'disabled') {
          throw Object.assign(
            new Error(`${station.name} is currently ${station.status} and cannot be rented`),
            { status: 409 }
          );
        }

        const activeExisting = toPlain<{ id: string }>(
          db
            .prepare("SELECT id FROM sessions WHERE station_id = ? AND status IN ('active', 'paused')")
            .get(stId) as never
        );
        if (station.status === 'occupied' || activeExisting) {
          throw Object.assign(
            new Error(`${station.name} already has an active session running`),
            { status: 409 }
          );
        }

        const rule = resolveEffectivePricing(station.id, station.category_id, allRules);
        const rate30 = rule?.rate_30min ?? 100;
        const rate60 = rule?.rate_60min ?? rate30 * 2;
        const increment = rule?.billing_increment_minutes ?? 30;
        const offerPct = rule?.offer_discount_percent ?? 0;

        const plannedMins =
          parsed.data.billingMode === 'fixed'
            ? parsed.data.plannedDurationMinutes!
            : null;

        const expectedEndAt =
          plannedMins !== null
            ? new Date(now.getTime() + plannedMins * 60_000).toISOString()
            : null;

        const initialEstimate =
          plannedMins !== null
            ? calculateRentalAmount({
                billableElapsedSeconds: plannedMins * 60,
                plannedDurationMinutes: plannedMins,
                billingMode: parsed.data.billingMode as BillingMode,
                billingIncrementMinutes: increment,
                ratePer30Min: rate30,
                ratePer60Min: rate60,
                offerDiscountPercent: offerPct,
              }).baseAmount
            : 0;

        const sessionId = `ses_${crypto.randomUUID().slice(0, 10)}`;
        const sessionCode = `SES-${Math.floor(1000 + Math.random() * 9000)}-${crypto
          .randomBytes(2)
          .toString('hex')
          .toUpperCase()}`;

        db.prepare(
          `INSERT INTO sessions (
            id, session_code, group_booking_id, station_id, customer_id, customer_name,
            status, billing_mode, billing_increment_minutes, rate_30min, rate_60min, offer_discount_percent,
            planned_duration_minutes, started_at, expected_end_at, ended_at, paused_at, accumulated_paused_seconds,
            billable_minutes, base_amount, additional_charges, discount_amount, discount_reason, discount_authorized_by,
            final_amount, paid_amount, payment_status, notes, cancel_reason, started_by, ended_by, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, 0, 0, ?, 0, 0, NULL, NULL, ?, 0, 'unpaid', ?, NULL, ?, NULL, ?, ?)`
        ).run(
          sessionId,
          sessionCode,
          groupBookingId,
          station.id,
          resolvedCustomerId,
          resolvedCustomerName,
          parsed.data.billingMode,
          increment,
          rate30,
          rate60,
          offerPct,
          plannedMins,
          nowIso,
          expectedEndAt,
          initialEstimate,
          initialEstimate,
          parsed.data.notes?.trim() || null,
          auth.staff.staffId,
          nowIso,
          nowIso
        );

        db.prepare("UPDATE gaming_stations SET status = 'occupied', updated_at = ? WHERE id = ?").run(
          nowIso,
          station.id
        );

        db.prepare(
          `INSERT INTO session_events (id, session_id, event_type, payload_json, actor_staff_id, created_at)
           VALUES (?, ?, 'started', ?, ?, ?)`
        ).run(
          `evt_${crypto.randomUUID().slice(0, 10)}`,
          sessionId,
          JSON.stringify({
            billingMode: parsed.data.billingMode,
            plannedDurationMinutes: plannedMins,
            groupBookingId,
          }),
          auth.staff.staffId,
          nowIso
        );

        logActivity({
          staff: auth.staff,
          action: 'session_started',
          entityType: 'session',
          entityId: sessionId,
          summary: `Started ${
            plannedMins ? `${plannedMins}m` : 'Pay-as-you-play'
          } session on ${station.name}${
            resolvedCustomerName ? ` for ${resolvedCustomerName}` : ''
          }`,
          createdAt: nowIso,
        });

        ids.push(sessionId);
      }

      if (parsed.data.bookingId) {
        db.prepare(
          "UPDATE bookings SET status = 'checked_in', updated_at = ? WHERE id = ?"
        ).run(nowIso, parsed.data.bookingId);
      }

      return ids;
    });

    const createdSessions = createdIds
      .map((id) => getSessionById(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));

    return NextResponse.json(
      {
        sessions: createdSessions,
        session: createdSessions[0] ?? null,
        groupBookingId,
      },
      { status: 201 }
    );
  } catch (err) {
    const e = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: e.message || 'Failed to start session' },
      { status: e.status || 500 }
    );
  }
}
