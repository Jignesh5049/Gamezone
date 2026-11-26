import crypto from 'node:crypto';
import type { NextResponse } from 'next/server';
import { getDb, toPlain } from './db';
import type { StaffProfile, StaffRole } from './types';

export function getOwnerProfile(): StaffProfile {
  const db = getDb();
  const row = toPlain<{
    staffId: string;
    userId: string;
    email: string;
    fullName: string;
    role: StaffRole;
    phone: string | null;
    isActive: number;
  }>(
    db
      .prepare(
        `SELECT s.id AS staffId, u.id AS userId, u.email, u.full_name AS fullName, s.role, s.phone,
                (u.is_active AND s.is_active) AS isActive
         FROM staff s
         JOIN users u ON u.id = s.user_id
         WHERE s.is_active = 1 AND u.is_active = 1
         ORDER BY CASE s.role WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 ELSE 3 END
         LIMIT 1`
      )
      .get() as never
  );

  if (!row) {
    return {
      staffId: 'stf_admin',
      userId: 'usr_admin',
      email: 'owner@gamezone.in',
      fullName: 'Owner',
      role: 'admin',
      phone: null,
      isActive: true,
    };
  }

  return {
    staffId: row.staffId,
    userId: row.userId,
    email: row.email,
    fullName: row.fullName,
    role: 'admin',
    phone: row.phone,
    isActive: true,
  };
}

export async function getSessionStaff(): Promise<StaffProfile> {
  return getOwnerProfile();
}

export async function requireAuth(
  _allowedRoles?: StaffRole[]
): Promise<{ staff: StaffProfile } | { error: NextResponse }> {
  void _allowedRoles;
  return { staff: getOwnerProfile() };
}

export function logActivity(params: {
  staff: StaffProfile | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}): void {
  const db = getDb();
  db.prepare(
    `INSERT INTO activity_logs (id, actor_staff_id, actor_name, actor_role, action, entity_type, entity_id, summary, metadata_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    `log_${crypto.randomUUID().slice(0, 12)}`,
    params.staff?.staffId ?? null,
    params.staff?.fullName ?? 'Owner',
    params.staff?.role ?? 'admin',
    params.action,
    params.entityType,
    params.entityId ?? null,
    params.summary,
    params.metadata ? JSON.stringify(params.metadata) : null,
    params.createdAt ?? new Date().toISOString()
  );
}
