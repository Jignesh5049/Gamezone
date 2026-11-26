import { getDb, toPlain, toPlainAll } from './db';
import { computeSessionMetrics } from './timer';
import { getDateRangeBoundsUTC, getISTDateKey, getISTDayBoundsUTC } from './timezone';
import type {
  ActivityLogRecord,
  BootstrapPayload,
  DashboardNotification,
  GameCategory,
  GamingStation,
  PricingRule,
  SessionRecord,
  StaffProfile,
  TodaySummary,
} from './types';

export function getAllSettings(): Record<string, string> {
  const db = getDb();
  const rows = toPlainAll<{ key: string; value: string }>(
    db.prepare('SELECT key, value FROM settings').all() as never
  );
  const map: Record<string, string> = {};
  for (const r of rows) {
    map[r.key] = r.value;
  }
  return map;
}

export function getAllCategories(): GameCategory[] {
  const db = getDb();
  return toPlainAll<GameCategory>(
    db.prepare('SELECT * FROM game_categories ORDER BY sort_order ASC, name ASC').all() as never
  );
}

export function getAllPricingRules(): PricingRule[] {
  const db = getDb();
  return toPlainAll<PricingRule>(
    db
      .prepare(
        `SELECT pr.*, gc.name AS category_name, gs.name AS station_name
         FROM pricing_rules pr
         JOIN game_categories gc ON gc.id = pr.category_id
         LEFT JOIN gaming_stations gs ON gs.id = pr.station_id
         ORDER BY gc.sort_order ASC, pr.station_id IS NULL DESC, pr.name ASC`
      )
      .all() as never
  );
}

export function resolveEffectivePricing(
  stationId: string,
  categoryId: string,
  rules?: PricingRule[]
): PricingRule | null {
  const all = rules ?? getAllPricingRules();
  const stationOverride = all.find(
    (r) => r.station_id === stationId && r.is_active === 1
  );
  if (stationOverride) return stationOverride;
  const catRule = all.find(
    (r) => r.category_id === categoryId && !r.station_id && r.is_active === 1
  );
  return catRule ?? null;
}

const SESSION_SELECT = `
  SELECT s.*,
         gs.name AS station_name,
         gs.code AS station_code,
         gs.category_id AS category_id,
         gc.name AS category_name,
         c.phone AS customer_phone,
         u1.full_name AS started_by_name,
         u2.full_name AS ended_by_name
  FROM sessions s
  JOIN gaming_stations gs ON gs.id = s.station_id
  JOIN game_categories gc ON gc.id = gs.category_id
  LEFT JOIN customers c ON c.id = s.customer_id
  LEFT JOIN staff st1 ON st1.id = s.started_by
  LEFT JOIN users u1 ON u1.id = st1.user_id
  LEFT JOIN staff st2 ON st2.id = s.ended_by
  LEFT JOIN users u2 ON u2.id = st2.user_id
`;

export function getSessionById(sessionId: string): SessionRecord | null {
  const db = getDb();
  return toPlain<SessionRecord>(
    db.prepare(`${SESSION_SELECT} WHERE s.id = ?`).get(sessionId) as never
  );
}

export function getActiveSessions(): SessionRecord[] {
  const db = getDb();
  return toPlainAll<SessionRecord>(
    db
      .prepare(
        `${SESSION_SELECT}
         WHERE s.status IN ('active', 'paused')
         ORDER BY s.started_at ASC`
      )
      .all() as never
  );
}

export function getAllStationsWithState(): GamingStation[] {
  const db = getDb();
  const rawStations = toPlainAll<
    Omit<GamingStation, 'effective_pricing' | 'active_session'>
  >(
    db
      .prepare(
        `SELECT gs.*, gc.name AS category_name, gc.slug AS category_slug, gc.icon AS category_icon
         FROM gaming_stations gs
         JOIN game_categories gc ON gc.id = gs.category_id
         ORDER BY gc.sort_order ASC, gs.sort_order ASC, gs.name ASC`
      )
      .all() as never
  );

  const rules = getAllPricingRules();
  const activeSessions = getActiveSessions();
  const activeByStation = new Map<string, SessionRecord>();
  for (const ses of activeSessions) {
    activeByStation.set(ses.station_id, ses);
  }

  return rawStations.map((st) => ({
    ...st,
    effective_pricing: resolveEffectivePricing(st.id, st.category_id, rules),
    active_session: activeByStation.get(st.id) ?? null,
  }));
}

export function buildBootstrapPayload(staff: StaffProfile): BootstrapPayload {
  const db = getDb();
  const now = new Date();
  const serverNow = now.toISOString();
  const nowMs = now.getTime();

  const settings = getAllSettings();
  const categories = getAllCategories();
  const stations = getAllStationsWithState();
  const activeSessions = stations
    .map((s) => s.active_session)
    .filter((s): s is SessionRecord => Boolean(s));

  const todayKey = getISTDateKey(nowMs);
  const { startIso: todayStart, endIso: todayEnd } = getISTDayBoundsUTC(todayKey);

  // Rule #11: Collected revenue strictly from actual payment records
  const todayRevRow = toPlain<{ total: number }>(
    db
      .prepare(
        `SELECT COALESCE(SUM(amount), 0) AS total
         FROM payments
         WHERE status = 'completed' AND paid_at >= ? AND paid_at <= ?`
      )
      .get(todayStart, todayEnd) as never
  );

  const todayCompletedRow = toPlain<{ cnt: number; avgMins: number }>(
    db
      .prepare(
        `SELECT COUNT(*) AS cnt, COALESCE(AVG(billable_minutes), 0) AS avgMins
         FROM sessions
         WHERE status = 'completed' AND ended_at >= ? AND ended_at <= ?`
      )
      .get(todayStart, todayEnd) as never
  );

  const pendingRow = toPlain<{ cnt: number; amount: number }>(
    db
      .prepare(
        `SELECT COUNT(*) AS cnt,
                COALESCE(SUM(MAX(0, final_amount - paid_amount)), 0) AS amount
         FROM sessions
         WHERE status = 'completed' AND payment_status IN ('unpaid', 'partial')`
      )
      .get() as never
  );

  const todaySummary: TodaySummary = {
    totalStations: stations.filter((s) => s.status !== 'disabled').length,
    occupiedStations: stations.filter((s) => s.status === 'occupied').length,
    availableStations: stations.filter((s) => s.status === 'available').length,
    maintenanceStations: stations.filter((s) => s.status === 'maintenance').length,
    activeSessionsCount: activeSessions.length,
    todayRevenue: Math.round(todayRevRow?.total ?? 0),
    todayCompletedSessions: todayCompletedRow?.cnt ?? 0,
    avgSessionDurationMinutes: Math.round(todayCompletedRow?.avgMins ?? 0),
    pendingPaymentsCount: pendingRow?.cnt ?? 0,
    pendingPaymentsAmount: Math.round(pendingRow?.amount ?? 0),
  };

  const recentActivity = toPlainAll<ActivityLogRecord>(
    db
      .prepare('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 15')
      .all() as never
  );

  const recentSessions = toPlainAll<SessionRecord>(
    db
      .prepare(`${SESSION_SELECT} ORDER BY s.updated_at DESC LIMIT 12`)
      .all() as never
  );

  const warnMins = Number(settings.warning_minutes ?? 10);
  const critMins = Number(settings.critical_minutes ?? 5);

  const notifications: DashboardNotification[] = [];

  for (const ses of activeSessions) {
    const metrics = computeSessionMetrics(ses, nowMs, warnMins, critMins);
    if (metrics.alertLevel === 'expired') {
      notifications.push({
        id: `notif_exp_${ses.id}`,
        type: 'expired',
        title: `${ses.station_name} Session Expired`,
        message: `${ses.session_code} has exceeded planned duration. Extend or end session.`,
        stationId: ses.station_id,
        sessionId: ses.id,
        createdAt: serverNow,
      });
    } else if (metrics.alertLevel === 'critical' || metrics.alertLevel === 'warning') {
      const minsLeft = Math.max(1, Math.ceil((metrics.remainingSeconds ?? 0) / 60));
      notifications.push({
        id: `notif_warn_${ses.id}`,
        type: metrics.alertLevel === 'critical' ? 'critical' : 'warning',
        title: `${ses.station_name} Ending in ${minsLeft}m`,
        message: `${ses.session_code} is nearing completion.`,
        stationId: ses.station_id,
        sessionId: ses.id,
        createdAt: serverNow,
      });
    }
  }

  if (todaySummary.pendingPaymentsCount > 0) {
    notifications.push({
      id: 'notif_pending_payments',
      type: 'pending_payment',
      title: `${todaySummary.pendingPaymentsCount} Pending Payment${todaySummary.pendingPaymentsCount > 1 ? 's' : ''}`,
      message: `₹${todaySummary.pendingPaymentsAmount} awaiting settlement on completed sessions.`,
      createdAt: serverNow,
    });
  }

  for (const st of stations) {
    if (st.status === 'maintenance') {
      notifications.push({
        id: `notif_maint_${st.id}`,
        type: 'maintenance',
        title: `${st.name} Under Maintenance`,
        message: st.notes || 'Equipment currently unavailable for rental.',
        stationId: st.id,
        createdAt: serverNow,
      });
    }
  }

  return {
    serverNow,
    staff,
    settings,
    categories,
    stations,
    activeSessions,
    recentActivity,
    recentSessions,
    todaySummary,
    notifications,
  };
}

export function querySessions(filters: {
  preset?: string | null;
  from?: string | null;
  to?: string | null;
  categoryId?: string | null;
  stationId?: string | null;
  paymentStatus?: string | null;
  status?: string | null;
  search?: string | null;
  limit?: number;
}): SessionRecord[] {
  const db = getDb();
  const where: string[] = [];
  const params: Array<string | number> = [];

  if (filters.preset && filters.preset !== 'all') {
    const presetVal = (['today', 'yesterday', '7d', '30d', 'custom'].includes(filters.preset)
      ? filters.preset
      : 'today') as 'today' | 'yesterday' | '7d' | '30d' | 'custom';
    const bounds = getDateRangeBoundsUTC(presetVal, filters.from, filters.to);
    where.push('s.started_at >= ? AND s.started_at <= ?');
    params.push(bounds.startIso, bounds.endIso);
  }

  if (filters.categoryId && filters.categoryId !== 'all') {
    where.push('gs.category_id = ?');
    params.push(filters.categoryId);
  }

  if (filters.stationId && filters.stationId !== 'all') {
    where.push('s.station_id = ?');
    params.push(filters.stationId);
  }

  if (filters.paymentStatus && filters.paymentStatus !== 'all') {
    where.push('s.payment_status = ?');
    params.push(filters.paymentStatus);
  }

  if (filters.status && filters.status !== 'all') {
    where.push('s.status = ?');
    params.push(filters.status);
  }

  if (filters.search && filters.search.trim().length > 0) {
    const q = `%${filters.search.trim()}%`;
    where.push(
      '(s.session_code LIKE ? OR COALESCE(s.customer_name, \'\') LIKE ? OR gs.name LIKE ? OR COALESCE(c.phone, \'\') LIKE ?)'
    );
    params.push(q, q, q, q);
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const limit = filters.limit ?? 200;

  return toPlainAll<SessionRecord>(
    db
      .prepare(
        `${SESSION_SELECT}
         ${whereClause}
         ORDER BY s.started_at DESC
         LIMIT ?`
      )
      .all(...params, limit) as never
  );
}
