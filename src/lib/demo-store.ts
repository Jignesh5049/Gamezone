import { calculateRentalAmount, computeSessionMetrics } from './timer';
import {
  addDaysToISTDateKey,
  formatISTDateTime,
  getDateRangeBoundsUTC,
  getISTDateKey,
  getISTDayBoundsUTC,
  getISTHour,
} from './timezone';
import { buildCsv } from './utils';
import type {
  ActivityLogRecord,
  BillingMode,
  BookingRecord,
  BookingStatus,
  BootstrapPayload,
  CheckoutPreview,
  DashboardNotification,
  GameCategory,
  GamingStation,
  MaintenanceRecord,
  PaymentMethod,
  PaymentRecord,
  PaymentStatus,
  PricingRule,
  ReceiptData,
  SessionEventRecord,
  SessionRecord,
  StaffProfile,
  StationStatus,
  TodaySummary,
} from './types';

const STORE_KEY = 'gz_demo_state_v1';

interface RawStation {
  id: string;
  category_id: string;
  name: string;
  code: string;
  status: StationStatus;
  equipment_model: string | null;
  purchase_date: string | null;
  purchase_cost: number | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DemoState {
  categories: GameCategory[];
  stations: RawStation[];
  pricingRules: PricingRule[];
  sessions: SessionRecord[];
  sessionEvents: SessionEventRecord[];
  payments: PaymentRecord[];
  bookings: BookingRecord[];
  maintenanceRecords: MaintenanceRecord[];
  activityLogs: ActivityLogRecord[];
  settings: Record<string, string>;
}

let memoryFallbackState: DemoState | null = null;

function uid(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}

export function createSeedState(): DemoState {
  const now = new Date();
  const nowIso = now.toISOString();
  const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();
  const minsFromNow = (m: number) => new Date(now.getTime() + m * 60_000).toISOString();

  const categories: GameCategory[] = [
    {
      id: 'cat_pool',
      name: 'Pool Tables',
      slug: 'pool-tables',
      icon: 'circle-dot',
      description: 'Tournament-grade 8-ball & snooker tables',
      sort_order: 1,
      created_at: nowIso,
    },
    {
      id: 'cat_tt',
      name: 'Table Tennis',
      slug: 'table-tennis',
      icon: 'disc',
      description: 'ITTF approved indoor table tennis arenas',
      sort_order: 2,
      created_at: nowIso,
    },
    {
      id: 'cat_ps',
      name: 'PlayStation',
      slug: 'playstation',
      icon: 'gamepad-2',
      description: '4K HDR PS4 & PS5 lounge stations',
      sort_order: 3,
      created_at: nowIso,
    },
  ];

  const stations: RawStation[] = [
    {
      id: 'stn_pool_1',
      category_id: 'cat_pool',
      name: 'Pool Table 01',
      code: 'PL-01',
      status: 'occupied',
      equipment_model: 'Wiraka M1 8ft Slate',
      purchase_date: '2025-04-12',
      purchase_cost: 95000,
      notes: 'Main Championship Bay',
      sort_order: 1,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 'stn_pool_2',
      category_id: 'cat_pool',
      name: 'Pool Table 02',
      code: 'PL-02',
      status: 'available',
      equipment_model: 'Wiraka M1 8ft Slate',
      purchase_date: '2025-04-12',
      purchase_cost: 95000,
      notes: 'Near front lounge',
      sort_order: 2,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 'stn_pool_3',
      category_id: 'cat_pool',
      name: 'Pool Table 03',
      code: 'PL-03',
      status: 'available',
      equipment_model: 'Rasson Victory II',
      purchase_date: '2025-08-20',
      purchase_cost: 115000,
      notes: 'Corner VIP bay',
      sort_order: 3,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 'stn_tt_1',
      category_id: 'cat_tt',
      name: 'Table Tennis 01',
      code: 'TT-01',
      status: 'available',
      equipment_model: 'Stag 1000DX 25mm',
      purchase_date: '2025-05-03',
      purchase_cost: 32000,
      notes: 'Pro court mat',
      sort_order: 4,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 'stn_tt_2',
      category_id: 'cat_tt',
      name: 'Table Tennis 02',
      code: 'TT-02',
      status: 'available',
      equipment_model: 'Stag 1000DX 25mm',
      purchase_date: '2025-05-03',
      purchase_cost: 32000,
      notes: 'Includes 4 paddles',
      sort_order: 5,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 'stn_ps4_1',
      category_id: 'cat_ps',
      name: 'PS4 Station 01',
      code: 'PS4-01',
      status: 'available',
      equipment_model: 'PS4 Pro + 55" 4K TV',
      purchase_date: '2024-11-10',
      purchase_cost: 62000,
      notes: '2 DualShock 4 controllers',
      sort_order: 6,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 'stn_ps4_2',
      category_id: 'cat_ps',
      name: 'PS4 Station 02',
      code: 'PS4-02',
      status: 'available',
      equipment_model: 'PS4 Slim + 50" 4K TV',
      purchase_date: '2024-11-10',
      purchase_cost: 54000,
      notes: '2 DualShock 4 controllers',
      sort_order: 7,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 'stn_ps5_1',
      category_id: 'cat_ps',
      name: 'PS5 Station 01',
      code: 'PS5-01',
      status: 'occupied',
      equipment_model: 'PS5 Disc + 65" OLED',
      purchase_date: '2025-06-18',
      purchase_cost: 118000,
      notes: 'DualSense Edge ready',
      sort_order: 8,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 'stn_ps5_2',
      category_id: 'cat_ps',
      name: 'PS5 Station 02',
      code: 'PS5-02',
      status: 'available',
      equipment_model: 'PS5 Disc + 65" OLED',
      purchase_date: '2025-06-18',
      purchase_cost: 118000,
      notes: 'FC 26 & Tekken 8 installed',
      sort_order: 9,
      created_at: nowIso,
      updated_at: nowIso,
    },
  ];

  const pricingRules: PricingRule[] = [
    {
      id: 'prc_pool',
      category_id: 'cat_pool',
      station_id: null,
      name: 'Pool Table Standard Rate',
      rate_30min: 100,
      rate_60min: 200,
      custom_hourly_rate: 200,
      default_billing_mode: 'fixed',
      billing_increment_minutes: 30,
      offer_label: null,
      offer_discount_percent: 0,
      is_active: 1,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 'prc_tt',
      category_id: 'cat_tt',
      station_id: null,
      name: 'Table Tennis Standard Rate',
      rate_30min: 80,
      rate_60min: 160,
      custom_hourly_rate: 160,
      default_billing_mode: 'fixed',
      billing_increment_minutes: 30,
      offer_label: null,
      offer_discount_percent: 0,
      is_active: 1,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 'prc_ps4',
      category_id: 'cat_ps',
      station_id: null,
      name: 'PlayStation 4 Standard Rate',
      rate_30min: 60,
      rate_60min: 120,
      custom_hourly_rate: 120,
      default_billing_mode: 'fixed',
      billing_increment_minutes: 30,
      offer_label: null,
      offer_discount_percent: 0,
      is_active: 1,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 'prc_ps5_1',
      category_id: 'cat_ps',
      station_id: 'stn_ps5_1',
      name: 'PS5 Station 01 Premium Rate',
      rate_30min: 100,
      rate_60min: 200,
      custom_hourly_rate: 200,
      default_billing_mode: 'fixed',
      billing_increment_minutes: 30,
      offer_label: null,
      offer_discount_percent: 0,
      is_active: 1,
      created_at: nowIso,
      updated_at: nowIso,
    },
    {
      id: 'prc_ps5_2',
      category_id: 'cat_ps',
      station_id: 'stn_ps5_2',
      name: 'PS5 Station 02 Premium Rate',
      rate_30min: 100,
      rate_60min: 200,
      custom_hourly_rate: 200,
      default_billing_mode: 'fixed',
      billing_increment_minutes: 30,
      offer_label: null,
      offer_discount_percent: 0,
      is_active: 1,
      created_at: nowIso,
      updated_at: nowIso,
    },
  ];

  const sessions: SessionRecord[] = [
    {
      id: 'ses_hist_1',
      session_code: 'SES-1001',
      group_booking_id: null,
      station_id: 'stn_tt_1',
      customer_id: null,
      customer_name: null,
      status: 'completed',
      billing_mode: 'fixed',
      billing_increment_minutes: 30,
      rate_30min: 80,
      rate_60min: 160,
      offer_discount_percent: 0,
      planned_duration_minutes: 60,
      started_at: minsAgo(240),
      expected_end_at: minsAgo(180),
      ended_at: minsAgo(180),
      paused_at: null,
      accumulated_paused_seconds: 0,
      billable_minutes: 60,
      base_amount: 160,
      additional_charges: 0,
      discount_amount: 0,
      discount_reason: null,
      discount_authorized_by: null,
      final_amount: 160,
      paid_amount: 160,
      payment_status: 'paid',
      notes: 'League practice',
      cancel_reason: null,
      started_by: 'stf_admin',
      ended_by: 'stf_admin',
      created_at: minsAgo(240),
      updated_at: minsAgo(180),
    },
    {
      id: 'ses_hist_2',
      session_code: 'SES-1002',
      group_booking_id: null,
      station_id: 'stn_ps4_1',
      customer_id: null,
      customer_name: null,
      status: 'completed',
      billing_mode: 'fixed',
      billing_increment_minutes: 30,
      rate_30min: 60,
      rate_60min: 120,
      offer_discount_percent: 0,
      planned_duration_minutes: 90,
      started_at: minsAgo(390),
      expected_end_at: minsAgo(300),
      ended_at: minsAgo(300),
      paused_at: null,
      accumulated_paused_seconds: 0,
      billable_minutes: 90,
      base_amount: 180,
      additional_charges: 20,
      discount_amount: 0,
      discount_reason: null,
      discount_authorized_by: null,
      final_amount: 200,
      paid_amount: 200,
      payment_status: 'paid',
      notes: 'Includes cold drink add-on',
      cancel_reason: null,
      started_by: 'stf_admin',
      ended_by: 'stf_admin',
      created_at: minsAgo(390),
      updated_at: minsAgo(300),
    },
    {
      id: 'ses_hist_3',
      session_code: 'SES-1003',
      group_booking_id: null,
      station_id: 'stn_pool_2',
      customer_id: null,
      customer_name: null,
      status: 'completed',
      billing_mode: 'fixed',
      billing_increment_minutes: 30,
      rate_30min: 100,
      rate_60min: 200,
      offer_discount_percent: 0,
      planned_duration_minutes: 60,
      started_at: minsAgo(150),
      expected_end_at: minsAgo(90),
      ended_at: minsAgo(90),
      paused_at: null,
      accumulated_paused_seconds: 0,
      billable_minutes: 60,
      base_amount: 200,
      additional_charges: 0,
      discount_amount: 0,
      discount_reason: null,
      discount_authorized_by: null,
      final_amount: 200,
      paid_amount: 0,
      payment_status: 'unpaid',
      notes: 'Pending settlement',
      cancel_reason: null,
      started_by: 'stf_admin',
      ended_by: 'stf_admin',
      created_at: minsAgo(150),
      updated_at: minsAgo(90),
    },
    {
      id: 'ses_hist_4',
      session_code: 'SES-1004',
      group_booking_id: null,
      station_id: 'stn_ps5_2',
      customer_id: null,
      customer_name: null,
      status: 'completed',
      billing_mode: 'fixed',
      billing_increment_minutes: 30,
      rate_30min: 100,
      rate_60min: 200,
      offer_discount_percent: 0,
      planned_duration_minutes: 120,
      started_at: minsAgo(1560),
      expected_end_at: minsAgo(1440),
      ended_at: minsAgo(1440),
      paused_at: null,
      accumulated_paused_seconds: 0,
      billable_minutes: 120,
      base_amount: 400,
      additional_charges: 0,
      discount_amount: 40,
      discount_reason: 'Loyalty discount',
      discount_authorized_by: 'stf_admin',
      final_amount: 360,
      paid_amount: 360,
      payment_status: 'paid',
      notes: '2-hour FIFA match',
      cancel_reason: null,
      started_by: 'stf_admin',
      ended_by: 'stf_admin',
      created_at: minsAgo(1560),
      updated_at: minsAgo(1440),
    },
    {
      id: 'ses_live_1',
      session_code: 'SES-1005',
      group_booking_id: null,
      station_id: 'stn_pool_1',
      customer_id: null,
      customer_name: null,
      status: 'active',
      billing_mode: 'fixed',
      billing_increment_minutes: 30,
      rate_30min: 100,
      rate_60min: 200,
      offer_discount_percent: 0,
      planned_duration_minutes: 60,
      started_at: minsAgo(24),
      expected_end_at: minsFromNow(36),
      ended_at: null,
      paused_at: null,
      accumulated_paused_seconds: 0,
      billable_minutes: 0,
      base_amount: 200,
      additional_charges: 0,
      discount_amount: 0,
      discount_reason: null,
      discount_authorized_by: null,
      final_amount: 200,
      paid_amount: 0,
      payment_status: 'unpaid',
      notes: null,
      cancel_reason: null,
      started_by: 'stf_admin',
      ended_by: null,
      created_at: minsAgo(24),
      updated_at: minsAgo(24),
    },
    {
      id: 'ses_live_2',
      session_code: 'SES-1006',
      group_booking_id: null,
      station_id: 'stn_ps5_1',
      customer_id: null,
      customer_name: null,
      status: 'active',
      billing_mode: 'fixed',
      billing_increment_minutes: 30,
      rate_30min: 100,
      rate_60min: 200,
      offer_discount_percent: 0,
      planned_duration_minutes: 30,
      started_at: minsAgo(22),
      expected_end_at: minsFromNow(8),
      ended_at: null,
      paused_at: null,
      accumulated_paused_seconds: 0,
      billable_minutes: 0,
      base_amount: 100,
      additional_charges: 0,
      discount_amount: 0,
      discount_reason: null,
      discount_authorized_by: null,
      final_amount: 100,
      paid_amount: 0,
      payment_status: 'unpaid',
      notes: null,
      cancel_reason: null,
      started_by: 'stf_admin',
      ended_by: null,
      created_at: minsAgo(22),
      updated_at: minsAgo(22),
    },
  ];

  const sessionEvents: SessionEventRecord[] = [
    {
      id: 'evt_live_1',
      session_id: 'ses_live_1',
      event_type: 'started',
      payload_json: JSON.stringify({ durationMinutes: 60, billingMode: 'fixed' }),
      actor_staff_id: 'stf_admin',
      actor_name: 'Owner',
      created_at: minsAgo(24),
    },
    {
      id: 'evt_live_2',
      session_id: 'ses_live_2',
      event_type: 'started',
      payload_json: JSON.stringify({ durationMinutes: 30, billingMode: 'fixed' }),
      actor_staff_id: 'stf_admin',
      actor_name: 'Owner',
      created_at: minsAgo(22),
    },
  ];

  const payments: PaymentRecord[] = [
    {
      id: 'pay_1',
      receipt_number: 'RCP-2026-1001',
      session_id: 'ses_hist_1',
      customer_id: null,
      amount: 160,
      method: 'upi',
      status: 'completed',
      reference_note: 'GPay verified',
      received_by: 'stf_admin',
      received_by_name: 'Owner',
      paid_at: minsAgo(180),
      created_at: minsAgo(180),
    },
    {
      id: 'pay_2',
      receipt_number: 'RCP-2026-1002',
      session_id: 'ses_hist_2',
      customer_id: null,
      amount: 200,
      method: 'cash',
      status: 'completed',
      reference_note: 'Cash drawer',
      received_by: 'stf_admin',
      received_by_name: 'Owner',
      paid_at: minsAgo(300),
      created_at: minsAgo(300),
    },
    {
      id: 'pay_3',
      receipt_number: 'RCP-2026-1003',
      session_id: 'ses_hist_4',
      customer_id: null,
      amount: 360,
      method: 'card',
      status: 'completed',
      reference_note: 'POS terminal #1',
      received_by: 'stf_admin',
      received_by_name: 'Owner',
      paid_at: minsAgo(1440),
      created_at: minsAgo(1440),
    },
  ];

  const bookings: BookingRecord[] = [
    {
      id: 'bkg_1',
      booking_code: 'BKG-401',
      group_booking_id: null,
      station_id: 'stn_ps5_2',
      customer_id: null,
      customer_name: 'Reserved Slot',
      customer_phone: null,
      scheduled_start_at: minsFromNow(90),
      duration_minutes: 120,
      status: 'confirmed',
      notes: '4 controllers setup',
      created_by: 'stf_admin',
      created_at: nowIso,
      updated_at: nowIso,
    },
  ];

  const maintenanceRecords: MaintenanceRecord[] = [
    {
      id: 'mnt_1',
      station_id: 'stn_pool_3',
      issue_title: 'Cloth brushing & pocket alignment',
      description: 'Routine slate leveling and felt brush',
      status: 'completed',
      cost: 450,
      technician: 'Suresh (Table Tech)',
      started_at: minsAgo(1400),
      completed_at: minsAgo(1300),
      recorded_by: 'stf_admin',
      created_at: minsAgo(1400),
    },
  ];

  const activityLogs: ActivityLogRecord[] = [
    {
      id: 'log_1',
      actor_staff_id: 'stf_admin',
      actor_name: 'Owner',
      actor_role: 'admin',
      action: 'session_started',
      entity_type: 'session',
      entity_id: 'ses_live_1',
      summary: 'Started 60m session on Pool Table 01',
      metadata_json: null,
      created_at: minsAgo(24),
    },
    {
      id: 'log_2',
      actor_staff_id: 'stf_admin',
      actor_name: 'Owner',
      actor_role: 'admin',
      action: 'session_started',
      entity_type: 'session',
      entity_id: 'ses_live_2',
      summary: 'Started 30m session on PS5 Station 01',
      metadata_json: null,
      created_at: minsAgo(22),
    },
  ];

  const settings: Record<string, string> = {
    zone_name: 'Apex Arena Game Zone',
    zone_address: '2nd Floor, Orion Arcade, MG Road, Bengaluru',
    zone_phone: '+91 80 4123 8900',
    currency: 'INR',
    timezone: 'Asia/Kolkata',
    warning_minutes: '10',
    critical_minutes: '5',
    sound_alerts: 'true',
    default_billing_mode: 'fixed',
    default_increment: '30',
    receipt_footer: 'Thank you for playing at Apex Arena!',
  };

  return {
    categories,
    stations,
    pricingRules,
    sessions,
    sessionEvents,
    payments,
    bookings,
    maintenanceRecords,
    activityLogs,
    settings,
  };
}

export function loadDemoState(): DemoState {
  if (typeof window === 'undefined') {
    if (!memoryFallbackState) memoryFallbackState = createSeedState();
    return memoryFallbackState;
  }
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    if (raw) {
      return JSON.parse(raw) as DemoState;
    }
  } catch {
    // ignore corrupt localStorage
  }
  const seed = createSeedState();
  saveDemoState(seed);
  return seed;
}

export function saveDemoState(state: DemoState): void {
  memoryFallbackState = state;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch {
      // ignore quota errors
    }
  }
}

export function resetDemoState(): DemoState {
  const seed = createSeedState();
  saveDemoState(seed);
  return seed;
}

function enrichPricingRule(rule: PricingRule, state: DemoState): PricingRule {
  const cat = state.categories.find((c) => c.id === rule.category_id);
  const st = rule.station_id
    ? state.stations.find((s) => s.id === rule.station_id)
    : null;
  return {
    ...rule,
    category_name: cat?.name || '',
    station_name: st?.name || null,
  };
}

function resolveRule(
  stationId: string,
  categoryId: string,
  state: DemoState
): PricingRule | null {
  const stationOverride = state.pricingRules.find(
    (r) => r.station_id === stationId && r.is_active === 1
  );
  if (stationOverride) return enrichPricingRule(stationOverride, state);
  const catRule = state.pricingRules.find(
    (r) => r.category_id === categoryId && !r.station_id && r.is_active === 1
  );
  return catRule ? enrichPricingRule(catRule, state) : null;
}

function enrichSession(ses: SessionRecord, state: DemoState): SessionRecord {
  const st = state.stations.find((s) => s.id === ses.station_id);
  const cat = st ? state.categories.find((c) => c.id === st.category_id) : null;
  return {
    ...ses,
    station_name: st?.name || 'Station',
    station_code: st?.code || '',
    category_id: st?.category_id || '',
    category_name: cat?.name || '',
    started_by_name: 'Owner',
    ended_by_name: ses.ended_by ? 'Owner' : null,
  };
}

function appendLog(
  state: DemoState,
  action: string,
  entityType: string,
  entityId: string | null,
  summary: string
): void {
  state.activityLogs.unshift({
    id: uid('log'),
    actor_staff_id: 'stf_admin',
    actor_name: 'Owner',
    actor_role: 'admin',
    action,
    entity_type: entityType,
    entity_id: entityId,
    summary,
    metadata_json: null,
    created_at: new Date().toISOString(),
  });
  if (state.activityLogs.length > 100) {
    state.activityLogs = state.activityLogs.slice(0, 100);
  }
}

export function buildClientBootstrap(owner: StaffProfile): BootstrapPayload {
  const state = loadDemoState();
  const now = new Date();
  const serverNow = now.toISOString();
  const nowMs = now.getTime();

  const categories = [...state.categories].sort((a, b) => a.sort_order - b.sort_order);
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const enrichedSessions = state.sessions.map((s) => enrichSession(s, state));
  const activeSessions = enrichedSessions
    .filter((s) => s.status === 'active' || s.status === 'paused')
    .sort((a, b) => a.started_at.localeCompare(b.started_at));

  const activeByStation = new Map(activeSessions.map((s) => [s.station_id, s]));

  const stations: GamingStation[] = [...state.stations]
    .sort((a, b) => {
      const ca = catMap.get(a.category_id)?.sort_order ?? 99;
      const cb = catMap.get(b.category_id)?.sort_order ?? 99;
      return ca !== cb ? ca - cb : a.sort_order - b.sort_order;
    })
    .map((st) => {
      const cat = catMap.get(st.category_id);
      return {
        ...st,
        category_name: cat?.name || '',
        category_slug: cat?.slug || '',
        category_icon: cat?.icon || 'gamepad-2',
        effective_pricing: resolveRule(st.id, st.category_id, state),
        active_session: activeByStation.get(st.id) ?? null,
      };
    });

  const todayKey = getISTDateKey(nowMs);
  const { startIso: todayStart, endIso: todayEnd } = getISTDayBoundsUTC(todayKey);

  const todayRevenue = Math.round(
    state.payments
      .filter((p) => p.status === 'completed' && p.paid_at >= todayStart && p.paid_at <= todayEnd)
      .reduce((sum, p) => sum + p.amount, 0)
  );

  const todayCompleted = state.sessions.filter(
    (s) =>
      s.status === 'completed' &&
      s.ended_at &&
      s.ended_at >= todayStart &&
      s.ended_at <= todayEnd
  );
  const avgMins =
    todayCompleted.length > 0
      ? Math.round(
          todayCompleted.reduce((sum, s) => sum + s.billable_minutes, 0) /
            todayCompleted.length
        )
      : 0;

  const pendingSessions = state.sessions.filter(
    (s) => s.status === 'completed' && (s.payment_status === 'unpaid' || s.payment_status === 'partial')
  );
  const pendingAmount = Math.round(
    pendingSessions.reduce((sum, s) => sum + Math.max(0, s.final_amount - s.paid_amount), 0)
  );

  const todaySummary: TodaySummary = {
    totalStations: stations.filter((s) => s.status !== 'disabled').length,
    occupiedStations: stations.filter((s) => s.status === 'occupied').length,
    availableStations: stations.filter((s) => s.status === 'available').length,
    maintenanceStations: stations.filter((s) => s.status === 'maintenance').length,
    activeSessionsCount: activeSessions.length,
    todayRevenue,
    todayCompletedSessions: todayCompleted.length,
    avgSessionDurationMinutes: avgMins,
    pendingPaymentsCount: pendingSessions.length,
    pendingPaymentsAmount: pendingAmount,
  };

  const warnMins = Number(state.settings.warning_minutes ?? 10);
  const critMins = Number(state.settings.critical_minutes ?? 5);
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
    staff: owner,
    settings: { ...state.settings },
    categories,
    stations,
    activeSessions,
    recentActivity: state.activityLogs.slice(0, 15),
    recentSessions: [...enrichedSessions]
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .slice(0, 12),
    todaySummary,
    notifications,
  };
}

export function createCategory(input: {
  name: string;
  description?: string | null;
  defaultRate30?: number;
  defaultRate60?: number;
}): { ok: boolean; error?: string } {
  const state = loadDemoState();
  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: 'Category name is too short' };
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  if (state.categories.some((c) => c.name.toLowerCase() === name.toLowerCase() || c.slug === slug)) {
    return { ok: false, error: 'Category already exists' };
  }

  const nowIso = new Date().toISOString();
  const id = uid('cat');
  const maxOrder = Math.max(0, ...state.categories.map((c) => c.sort_order));
  state.categories.push({
    id,
    name,
    slug,
    icon: 'gamepad-2',
    description: input.description?.trim() || null,
    sort_order: maxOrder + 1,
    created_at: nowIso,
  });

  if (input.defaultRate30 !== undefined) {
    const r30 = Math.max(0, Number(input.defaultRate30) || 100);
    const r60 = Math.max(0, Number(input.defaultRate60) || r30 * 2);
    state.pricingRules.push({
      id: uid('prc'),
      category_id: id,
      station_id: null,
      name: `${name} Standard Rate`,
      rate_30min: r30,
      rate_60min: r60,
      custom_hourly_rate: r60,
      default_billing_mode: 'fixed',
      billing_increment_minutes: 30,
      offer_label: null,
      offer_discount_percent: 0,
      is_active: 1,
      created_at: nowIso,
      updated_at: nowIso,
    });
  }

  appendLog(state, 'category_created', 'game_category', id, `Added game category "${name}"`);
  saveDemoState(state);
  return { ok: true };
}

export function createStation(input: {
  categoryId: string;
  name: string;
  customRate30?: number | null;
  customRate60?: number | null;
}): { ok: boolean; error?: string } {
  const state = loadDemoState();
  const name = input.name.trim();
  if (name.length < 2) return { ok: false, error: 'Station name is too short' };
  if (state.stations.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
    return { ok: false, error: 'A station with this name already exists' };
  }
  const cat = state.categories.find((c) => c.id === input.categoryId);
  if (!cat) return { ok: false, error: 'Category not found' };

  const nowIso = new Date().toISOString();
  const id = uid('stn');
  const code = name
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .toUpperCase()
    .slice(0, 10);
  const maxOrder = Math.max(0, ...state.stations.map((s) => s.sort_order));

  state.stations.push({
    id,
    category_id: cat.id,
    name,
    code,
    status: 'available',
    equipment_model: null,
    purchase_date: null,
    purchase_cost: null,
    notes: null,
    sort_order: maxOrder + 1,
    created_at: nowIso,
    updated_at: nowIso,
  });

  if (input.customRate30 !== undefined && input.customRate30 !== null) {
    const r30 = Math.max(0, Number(input.customRate30));
    const r60 = Math.max(0, Number(input.customRate60 ?? r30 * 2));
    state.pricingRules.push({
      id: uid('prc'),
      category_id: cat.id,
      station_id: id,
      name: `${name} Custom Rate`,
      rate_30min: r30,
      rate_60min: r60,
      custom_hourly_rate: r60,
      default_billing_mode: 'fixed',
      billing_increment_minutes: 30,
      offer_label: null,
      offer_discount_percent: 0,
      is_active: 1,
      created_at: nowIso,
      updated_at: nowIso,
    });
  }

  appendLog(state, 'station_created', 'gaming_station', id, `Added station "${name}" under ${cat.name}`);
  saveDemoState(state);
  return { ok: true };
}

export function updateStation(
  id: string,
  patch: {
    name?: string;
    status?: 'available' | 'maintenance' | 'disabled';
    equipmentModel?: string | null;
    purchaseDate?: string | null;
    purchaseCost?: number | null;
    notes?: string | null;
  }
): { ok: boolean; error?: string } {
  const state = loadDemoState();
  const station = state.stations.find((s) => s.id === id);
  if (!station) return { ok: false, error: 'Station not found' };
  if (patch.status && station.status === 'occupied') {
    return { ok: false, error: 'Cannot change status while a live session is active on this station' };
  }

  if (patch.name !== undefined) station.name = patch.name.trim();
  if (patch.status !== undefined) station.status = patch.status;
  if (patch.equipmentModel !== undefined) station.equipment_model = patch.equipmentModel;
  if (patch.purchaseDate !== undefined) station.purchase_date = patch.purchaseDate;
  if (patch.purchaseCost !== undefined) station.purchase_cost = patch.purchaseCost;
  if (patch.notes !== undefined) station.notes = patch.notes;
  station.updated_at = new Date().toISOString();

  appendLog(state, 'station_updated', 'gaming_station', id, `Updated station "${station.name}" (${station.status})`);
  saveDemoState(state);
  return { ok: true };
}

export function startSessions(input: {
  stationIds: string[];
  billingMode: BillingMode;
  plannedDurationMinutes: number | null;
  bookingId?: string | null;
}): { ok: boolean; error?: string; sessions?: SessionRecord[] } {
  const state = loadDemoState();
  const targetIds = Array.from(new Set(input.stationIds));
  if (targetIds.length === 0) return { ok: false, error: 'Select at least one gaming station' };
  if (input.billingMode === 'fixed' && (!input.plannedDurationMinutes || input.plannedDurationMinutes < 5)) {
    return { ok: false, error: 'Planned duration (minimum 5 minutes) is required' };
  }

  for (const stId of targetIds) {
    const st = state.stations.find((s) => s.id === stId);
    if (!st) return { ok: false, error: 'Station not found' };
    if (st.status === 'maintenance' || st.status === 'disabled') {
      return { ok: false, error: `${st.name} is currently ${st.status} and cannot be rented` };
    }
    const active = state.sessions.find(
      (s) => s.station_id === stId && (s.status === 'active' || s.status === 'paused')
    );
    if (st.status === 'occupied' || active) {
      return { ok: false, error: `${st.name} already has an active session running` };
    }
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const groupBookingId = targetIds.length > 1 ? uid('grp') : null;
  const created: SessionRecord[] = [];

  for (const stId of targetIds) {
    const st = state.stations.find((s) => s.id === stId)!;
    const rule = resolveRule(st.id, st.category_id, state);
    const rate30 = rule?.rate_30min ?? 100;
    const rate60 = rule?.rate_60min ?? rate30 * 2;
    const increment = rule?.billing_increment_minutes ?? 30;
    const offerPct = rule?.offer_discount_percent ?? 0;

    const plannedMins = input.billingMode === 'fixed' ? input.plannedDurationMinutes : null;
    const expectedEndAt =
      plannedMins !== null ? new Date(now.getTime() + plannedMins * 60_000).toISOString() : null;

    const initialEstimate =
      plannedMins !== null
        ? calculateRentalAmount({
            billableElapsedSeconds: plannedMins * 60,
            plannedDurationMinutes: plannedMins,
            billingMode: input.billingMode,
            billingIncrementMinutes: increment,
            ratePer30Min: rate30,
            ratePer60Min: rate60,
            offerDiscountPercent: offerPct,
          }).baseAmount
        : 0;

    const sessionId = uid('ses');
    const sessionCode = `SES-${Math.floor(1000 + Math.random() * 9000)}`;
    const ses: SessionRecord = {
      id: sessionId,
      session_code: sessionCode,
      group_booking_id: groupBookingId,
      station_id: st.id,
      customer_id: null,
      customer_name: null,
      status: 'active',
      billing_mode: input.billingMode,
      billing_increment_minutes: increment,
      rate_30min: rate30,
      rate_60min: rate60,
      offer_discount_percent: offerPct,
      planned_duration_minutes: plannedMins,
      started_at: nowIso,
      expected_end_at: expectedEndAt,
      ended_at: null,
      paused_at: null,
      accumulated_paused_seconds: 0,
      billable_minutes: 0,
      base_amount: initialEstimate,
      additional_charges: 0,
      discount_amount: 0,
      discount_reason: null,
      discount_authorized_by: null,
      final_amount: initialEstimate,
      paid_amount: 0,
      payment_status: 'unpaid',
      notes: null,
      cancel_reason: null,
      started_by: 'stf_admin',
      ended_by: null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    state.sessions.push(ses);
    st.status = 'occupied';
    st.updated_at = nowIso;
    state.sessionEvents.push({
      id: uid('evt'),
      session_id: sessionId,
      event_type: 'started',
      payload_json: JSON.stringify({ billingMode: input.billingMode, plannedDurationMinutes: plannedMins }),
      actor_staff_id: 'stf_admin',
      actor_name: 'Owner',
      created_at: nowIso,
    });
    appendLog(
      state,
      'session_started',
      'session',
      sessionId,
      `Started ${plannedMins ? `${plannedMins}m` : 'Pay-as-you-play'} session on ${st.name}`
    );
    created.push(enrichSession(ses, state));
  }

  if (input.bookingId) {
    const bkg = state.bookings.find((b) => b.id === input.bookingId);
    if (bkg) {
      bkg.status = 'checked_in';
      bkg.updated_at = nowIso;
    }
  }

  saveDemoState(state);
  return { ok: true, sessions: created };
}

export function pauseSessionById(id: string): { ok: boolean; error?: string } {
  const state = loadDemoState();
  const ses = state.sessions.find((s) => s.id === id);
  if (!ses) return { ok: false, error: 'Session not found' };
  if (ses.status !== 'active') return { ok: false, error: `Cannot pause session in "${ses.status}" state` };

  const nowIso = new Date().toISOString();
  ses.status = 'paused';
  ses.paused_at = nowIso;
  ses.updated_at = nowIso;
  const st = state.stations.find((s) => s.id === ses.station_id);
  state.sessionEvents.push({
    id: uid('evt'),
    session_id: id,
    event_type: 'paused',
    payload_json: JSON.stringify({ pausedAt: nowIso }),
    actor_staff_id: 'stf_admin',
    actor_name: 'Owner',
    created_at: nowIso,
  });
  appendLog(state, 'session_paused', 'session', id, `Paused timer for ${st?.name || 'Station'} (${ses.session_code})`);
  saveDemoState(state);
  return { ok: true };
}

export function resumeSessionById(id: string): { ok: boolean; error?: string } {
  const state = loadDemoState();
  const ses = state.sessions.find((s) => s.id === id);
  if (!ses) return { ok: false, error: 'Session not found' };
  if (ses.status !== 'paused' || !ses.paused_at) {
    return { ok: false, error: `Cannot resume session in "${ses.status}" state` };
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const delta = Math.max(0, Math.floor((now.getTime() - Date.parse(ses.paused_at)) / 1000));
  ses.accumulated_paused_seconds = (ses.accumulated_paused_seconds || 0) + delta;
  ses.paused_at = null;
  ses.status = 'active';
  if (ses.billing_mode === 'fixed' && ses.planned_duration_minutes) {
    ses.expected_end_at = new Date(
      Date.parse(ses.started_at) +
        (ses.planned_duration_minutes * 60 + ses.accumulated_paused_seconds) * 1000
    ).toISOString();
  }
  ses.updated_at = nowIso;

  const st = state.stations.find((s) => s.id === ses.station_id);
  state.sessionEvents.push({
    id: uid('evt'),
    session_id: id,
    event_type: 'resumed',
    payload_json: JSON.stringify({ pausedDeltaSeconds: delta }),
    actor_staff_id: 'stf_admin',
    actor_name: 'Owner',
    created_at: nowIso,
  });
  appendLog(state, 'session_resumed', 'session', id, `Resumed timer for ${st?.name || 'Station'} (+${delta}s paused excluded)`);
  saveDemoState(state);
  return { ok: true };
}

export function extendSessionById(id: string, minutes: number): { ok: boolean; error?: string } {
  const state = loadDemoState();
  const ses = state.sessions.find((s) => s.id === id);
  if (!ses) return { ok: false, error: 'Session not found' };
  if (ses.status !== 'active' && ses.status !== 'paused') {
    return { ok: false, error: 'Only active or paused sessions can be extended' };
  }

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const metrics = computeSessionMetrics(ses, nowMs);
  const currentPlanned =
    ses.planned_duration_minutes ?? Math.max(30, Math.ceil(metrics.billableElapsedSeconds / 60 / 30) * 30);
  const nextPlanned = currentPlanned + minutes;
  const startMs = Date.parse(ses.started_at);

  ses.billing_mode = 'fixed';
  ses.planned_duration_minutes = nextPlanned;
  ses.expected_end_at = new Date(
    startMs + (nextPlanned * 60 + metrics.totalPausedSeconds) * 1000
  ).toISOString();
  const updatedBase = calculateRentalAmount({
    billableElapsedSeconds: nextPlanned * 60,
    plannedDurationMinutes: nextPlanned,
    billingMode: 'fixed',
    billingIncrementMinutes: ses.billing_increment_minutes,
    ratePer30Min: ses.rate_30min,
    ratePer60Min: ses.rate_60min,
    offerDiscountPercent: ses.offer_discount_percent,
  }).baseAmount;
  ses.base_amount = updatedBase;
  ses.final_amount = Math.max(0, updatedBase + ses.additional_charges - ses.discount_amount);
  ses.updated_at = nowIso;

  const st = state.stations.find((s) => s.id === ses.station_id);
  state.sessionEvents.push({
    id: uid('evt'),
    session_id: id,
    event_type: 'extended',
    payload_json: JSON.stringify({ addedMinutes: minutes, newPlannedMinutes: nextPlanned }),
    actor_staff_id: 'stf_admin',
    actor_name: 'Owner',
    created_at: nowIso,
  });
  appendLog(state, 'session_extended', 'session', id, `Extended ${st?.name || 'Station'} (${ses.session_code}) by +${minutes}m`);
  saveDemoState(state);
  return { ok: true };
}

export function transferSessionById(
  id: string,
  targetStationId: string,
  keepOriginalRate: boolean
): { ok: boolean; error?: string } {
  const state = loadDemoState();
  const ses = state.sessions.find((s) => s.id === id);
  if (!ses) return { ok: false, error: 'Session not found' };
  if (ses.status !== 'active' && ses.status !== 'paused') {
    return { ok: false, error: 'Only active or paused sessions can be transferred' };
  }
  const source = state.stations.find((s) => s.id === ses.station_id);
  const target = state.stations.find((s) => s.id === targetStationId);
  if (!target) return { ok: false, error: 'Target station not found' };
  if (target.status !== 'available') return { ok: false, error: `${target.name} is currently ${target.status}` };

  const nowIso = new Date().toISOString();
  if (source) {
    source.status = 'available';
    source.updated_at = nowIso;
  }
  target.status = 'occupied';
  target.updated_at = nowIso;

  ses.station_id = target.id;
  if (!keepOriginalRate) {
    const rule = resolveRule(target.id, target.category_id, state);
    if (rule) {
      ses.rate_30min = rule.rate_30min;
      ses.rate_60min = rule.rate_60min;
    }
  }
  ses.updated_at = nowIso;

  state.sessionEvents.push({
    id: uid('evt'),
    session_id: id,
    event_type: 'transferred',
    payload_json: JSON.stringify({ from: source?.name, to: target.name }),
    actor_staff_id: 'stf_admin',
    actor_name: 'Owner',
    created_at: nowIso,
  });
  appendLog(state, 'session_transferred', 'session', id, `Transferred ${ses.session_code} from ${source?.name} to ${target.name}`);
  saveDemoState(state);
  return { ok: true };
}

export function getCheckoutPreview(id: string): { preview?: CheckoutPreview; error?: string } {
  const state = loadDemoState();
  const raw = state.sessions.find((s) => s.id === id);
  if (!raw) return { error: 'Session not found' };

  const session = enrichSession(raw, state);
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

  return {
    preview: {
      serverNow: new Date(nowMs).toISOString(),
      session,
      metrics,
      calculation,
    },
  };
}

export function checkoutSessionById(
  id: string,
  input: {
    additionalCharges: number;
    discountAmount: number;
    discountReason?: string | null;
    paymentMethod: PaymentMethod;
    paidAmount: number;
    referenceNote?: string | null;
  }
): { ok: boolean; error?: string; receipt?: ReceiptData } {
  const state = loadDemoState();
  const ses = state.sessions.find((s) => s.id === id);
  if (!ses) return { ok: false, error: 'Session not found' };
  if (ses.status !== 'active' && ses.status !== 'paused') {
    return { ok: false, error: `Session is already ${ses.status}` };
  }

  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const metrics = computeSessionMetrics(ses, nowMs);
  const calculation = calculateRentalAmount({
    billableElapsedSeconds: metrics.billableElapsedSeconds,
    plannedDurationMinutes: ses.planned_duration_minutes,
    billingMode: ses.billing_mode,
    billingIncrementMinutes: ses.billing_increment_minutes,
    ratePer30Min: ses.rate_30min,
    ratePer60Min: ses.rate_60min,
    offerDiscountPercent: ses.offer_discount_percent,
  });

  const finalAmount = Math.max(
    0,
    Math.round(calculation.baseAmount + input.additionalCharges - input.discountAmount)
  );
  const paidAmount = Math.round(input.paidAmount);
  let paymentStatus: PaymentStatus = 'unpaid';
  if (finalAmount === 0 || paidAmount >= finalAmount) paymentStatus = 'paid';
  else if (paidAmount > 0) paymentStatus = 'partial';

  const receiptNumber = `RCP-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

  ses.status = 'completed';
  ses.ended_at = nowIso;
  ses.paused_at = null;
  ses.accumulated_paused_seconds = metrics.totalPausedSeconds;
  ses.billable_minutes = calculation.billableMinutes;
  ses.base_amount = calculation.baseAmount;
  ses.additional_charges = input.additionalCharges;
  ses.discount_amount = input.discountAmount;
  ses.discount_reason = input.discountReason?.trim() || null;
  ses.discount_authorized_by = input.discountAmount > 0 ? 'stf_admin' : null;
  ses.final_amount = finalAmount;
  ses.paid_amount = paidAmount;
  ses.payment_status = paymentStatus;
  ses.ended_by = 'stf_admin';
  ses.updated_at = nowIso;

  const st = state.stations.find((s) => s.id === ses.station_id);
  if (st) {
    st.status = 'available';
    st.updated_at = nowIso;
  }

  if (paidAmount > 0) {
    state.payments.push({
      id: uid('pay'),
      receipt_number: receiptNumber,
      session_id: id,
      customer_id: null,
      amount: paidAmount,
      method: input.paymentMethod,
      status: 'completed',
      reference_note: input.referenceNote?.trim() || null,
      received_by: 'stf_admin',
      received_by_name: 'Owner',
      paid_at: nowIso,
      created_at: nowIso,
    });
  }

  state.sessionEvents.push({
    id: uid('evt'),
    session_id: id,
    event_type: 'completed',
    payload_json: JSON.stringify({ finalAmount, paidAmount, paymentStatus }),
    actor_staff_id: 'stf_admin',
    actor_name: 'Owner',
    created_at: nowIso,
  });
  appendLog(
    state,
    'session_completed',
    'session',
    id,
    `Ended ${st?.name || 'Station'} (${ses.session_code}) — Bill ₹${finalAmount}, Paid ₹${paidAmount}`
  );
  saveDemoState(state);

  const sessionPayments = state.payments.filter((p) => p.session_id === id);
  return {
    ok: true,
    receipt: {
      zoneName: state.settings.zone_name || 'Apex Arena Game Zone',
      zoneAddress: state.settings.zone_address || '',
      zonePhone: state.settings.zone_phone || '',
      receiptNumber: sessionPayments[sessionPayments.length - 1]?.receipt_number || receiptNumber,
      issuedAt: nowIso,
      session: enrichSession(ses, state),
      payments: sessionPayments,
    },
  };
}

export function getSessionDetailById(id: string) {
  const state = loadDemoState();
  const raw = state.sessions.find((s) => s.id === id);
  if (!raw) return null;
  const session = enrichSession(raw, state);
  const metrics = computeSessionMetrics(session, Date.now());
  const calculation = calculateRentalAmount({
    billableElapsedSeconds: metrics.billableElapsedSeconds,
    plannedDurationMinutes: session.planned_duration_minutes,
    billingMode: session.billing_mode,
    billingIncrementMinutes: session.billing_increment_minutes,
    ratePer30Min: session.rate_30min,
    ratePer60Min: session.rate_60min,
    offerDiscountPercent: session.offer_discount_percent,
  });
  const events = state.sessionEvents.filter((e) => e.session_id === id);
  const payments = state.payments.filter((p) => p.session_id === id);
  return { session, metrics, calculation, events, payments };
}

export function updateSessionNotesById(id: string, notes: string): boolean {
  const state = loadDemoState();
  const ses = state.sessions.find((s) => s.id === id);
  if (!ses) return false;
  ses.notes = notes.trim() || null;
  ses.updated_at = new Date().toISOString();
  saveDemoState(state);
  return true;
}

export function cancelSessionById(id: string, reason: string): { ok: boolean; error?: string } {
  const state = loadDemoState();
  const ses = state.sessions.find((s) => s.id === id);
  if (!ses) return { ok: false, error: 'Session not found' };
  if (ses.status === 'completed' || ses.status === 'cancelled') {
    return { ok: false, error: 'Only active or paused sessions can be cancelled' };
  }
  const nowIso = new Date().toISOString();
  ses.status = 'cancelled';
  ses.ended_at = nowIso;
  ses.cancel_reason = reason.trim();
  ses.billable_minutes = 0;
  ses.base_amount = 0;
  ses.final_amount = 0;
  ses.updated_at = nowIso;

  const st = state.stations.find((s) => s.id === ses.station_id);
  if (st) {
    st.status = 'available';
    st.updated_at = nowIso;
  }
  state.sessionEvents.push({
    id: uid('evt'),
    session_id: id,
    event_type: 'cancelled',
    payload_json: JSON.stringify({ reason }),
    actor_staff_id: 'stf_admin',
    actor_name: 'Owner',
    created_at: nowIso,
  });
  appendLog(state, 'session_cancelled', 'session', id, `Cancelled ${ses.session_code}: ${reason}`);
  saveDemoState(state);
  return { ok: true };
}

export function settlePaymentById(
  id: string,
  amount: number,
  method: PaymentMethod
): { ok: boolean; error?: string; receipt?: ReceiptData } {
  const state = loadDemoState();
  const ses = state.sessions.find((s) => s.id === id);
  if (!ses) return { ok: false, error: 'Session not found' };
  if (ses.status !== 'completed') return { ok: false, error: 'Session must be completed first' };

  const nowIso = new Date().toISOString();
  const amt = Math.round(amount);
  const receiptNumber = `RCP-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
  state.payments.push({
    id: uid('pay'),
    receipt_number: receiptNumber,
    session_id: id,
    customer_id: null,
    amount: amt,
    method,
    status: 'completed',
    reference_note: null,
    received_by: 'stf_admin',
    received_by_name: 'Owner',
    paid_at: nowIso,
    created_at: nowIso,
  });

  ses.paid_amount = Math.round(ses.paid_amount + amt);
  ses.payment_status = ses.paid_amount >= ses.final_amount ? 'paid' : 'partial';
  ses.updated_at = nowIso;
  appendLog(state, 'payment_settled', 'payment', id, `Recorded ₹${amt} (${method.toUpperCase()}) for ${ses.session_code}`);
  saveDemoState(state);

  const sessionPayments = state.payments.filter((p) => p.session_id === id);
  return {
    ok: true,
    receipt: {
      zoneName: state.settings.zone_name || 'Apex Arena Game Zone',
      zoneAddress: state.settings.zone_address || '',
      zonePhone: state.settings.zone_phone || '',
      receiptNumber,
      issuedAt: nowIso,
      session: enrichSession(ses, state),
      payments: sessionPayments,
    },
  };
}

export function listFilteredSessions(filters: {
  preset?: string;
  from?: string;
  to?: string;
  categoryId?: string;
  stationId?: string;
  paymentStatus?: string;
  search?: string;
}): SessionRecord[] {
  const state = loadDemoState();
  let rows = state.sessions.map((s) => enrichSession(s, state));

  if (filters.preset && filters.preset !== 'all') {
    const p = (['today', 'yesterday', '7d', '30d', 'custom'].includes(filters.preset)
      ? filters.preset
      : 'today') as 'today' | 'yesterday' | '7d' | '30d' | 'custom';
    const bounds = getDateRangeBoundsUTC(p, filters.from, filters.to);
    rows = rows.filter((s) => s.started_at >= bounds.startIso && s.started_at <= bounds.endIso);
  }
  if (filters.categoryId && filters.categoryId !== 'all') {
    rows = rows.filter((s) => s.category_id === filters.categoryId);
  }
  if (filters.stationId && filters.stationId !== 'all') {
    rows = rows.filter((s) => s.station_id === filters.stationId);
  }
  if (filters.paymentStatus && filters.paymentStatus !== 'all') {
    rows = rows.filter((s) => s.payment_status === filters.paymentStatus);
  }
  if (filters.search && filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    rows = rows.filter(
      (s) =>
        s.session_code.toLowerCase().includes(q) ||
        (s.station_name || '').toLowerCase().includes(q)
    );
  }

  return rows.sort((a, b) => b.started_at.localeCompare(a.started_at));
}

export function listPricingRules(): PricingRule[] {
  const state = loadDemoState();
  return state.pricingRules.map((r) => enrichPricingRule(r, state));
}

export function createPricingRule(input: {
  categoryId: string;
  stationId?: string | null;
  name: string;
  rate30Min: number;
  rate60Min: number;
  defaultBillingMode: BillingMode;
  billingIncrementMinutes: 15 | 30 | 60;
  offerLabel?: string | null;
  offerDiscountPercent: number;
}): { ok: boolean; error?: string } {
  const state = loadDemoState();
  const nowIso = new Date().toISOString();
  const id = uid('prc');
  state.pricingRules.push({
    id,
    category_id: input.categoryId,
    station_id: input.stationId || null,
    name: input.name.trim(),
    rate_30min: input.rate30Min,
    rate_60min: input.rate60Min,
    custom_hourly_rate: input.rate60Min,
    default_billing_mode: input.defaultBillingMode,
    billing_increment_minutes: input.billingIncrementMinutes,
    offer_label: input.offerLabel?.trim() || null,
    offer_discount_percent: input.offerDiscountPercent,
    is_active: 1,
    created_at: nowIso,
    updated_at: nowIso,
  });
  appendLog(state, 'pricing_created', 'pricing_rule', id, `Created pricing rule "${input.name}"`);
  saveDemoState(state);
  return { ok: true };
}

export function updatePricingRule(
  id: string,
  patch: {
    name?: string;
    rate30Min?: number;
    rate60Min?: number;
    defaultBillingMode?: BillingMode;
    billingIncrementMinutes?: 15 | 30 | 60;
    offerLabel?: string | null;
    offerDiscountPercent?: number;
  }
): { ok: boolean; error?: string } {
  const state = loadDemoState();
  const rule = state.pricingRules.find((r) => r.id === id);
  if (!rule) return { ok: false, error: 'Pricing rule not found' };
  if (patch.name !== undefined) rule.name = patch.name.trim();
  if (patch.rate30Min !== undefined) rule.rate_30min = patch.rate30Min;
  if (patch.rate60Min !== undefined) {
    rule.rate_60min = patch.rate60Min;
    rule.custom_hourly_rate = patch.rate60Min;
  }
  if (patch.defaultBillingMode !== undefined) rule.default_billing_mode = patch.defaultBillingMode;
  if (patch.billingIncrementMinutes !== undefined) {
    rule.billing_increment_minutes = patch.billingIncrementMinutes;
  }
  if (patch.offerLabel !== undefined) rule.offer_label = patch.offerLabel?.trim() || null;
  if (patch.offerDiscountPercent !== undefined) {
    rule.offer_discount_percent = patch.offerDiscountPercent;
  }
  rule.updated_at = new Date().toISOString();
  appendLog(state, 'pricing_updated', 'pricing_rule', id, `Updated pricing "${rule.name}"`);
  saveDemoState(state);
  return { ok: true };
}

export function deletePricingRule(id: string): void {
  const state = loadDemoState();
  state.pricingRules = state.pricingRules.filter((r) => r.id !== id);
  saveDemoState(state);
}

export function listBookings(status?: string): BookingRecord[] {
  const state = loadDemoState();
  let rows = state.bookings.map((b) => {
    const st = state.stations.find((s) => s.id === b.station_id);
    const cat = st ? state.categories.find((c) => c.id === st.category_id) : null;
    return {
      ...b,
      station_name: st?.name || '',
      category_name: cat?.name || '',
      created_by_name: 'Owner',
    };
  });
  if (status && status !== 'all') {
    rows = rows.filter((b) => b.status === status);
  }
  return rows.sort((a, b) => a.scheduled_start_at.localeCompare(b.scheduled_start_at));
}

export function createBooking(input: {
  stationIds: string[];
  scheduledStartAt: string;
  durationMinutes: number;
  notes?: string | null;
}): { ok: boolean; error?: string } {
  const state = loadDemoState();
  const startMs = Date.parse(input.scheduledStartAt);
  if (Number.isNaN(startMs)) return { ok: false, error: 'Invalid start time' };
  const endMs = startMs + input.durationMinutes * 60_000;
  const nowIso = new Date().toISOString();
  const uniqueIds = Array.from(new Set(input.stationIds));
  const groupBookingId = uniqueIds.length > 1 ? uid('grp_bkg') : null;

  for (const stId of uniqueIds) {
    const st = state.stations.find((s) => s.id === stId);
    if (!st) return { ok: false, error: 'Station not found' };
    if (st.status === 'maintenance' || st.status === 'disabled') {
      return { ok: false, error: `${st.name} is ${st.status} and cannot be booked` };
    }
    const overlap = state.bookings.some((b) => {
      if (b.station_id !== stId || b.status !== 'confirmed') return false;
      const bStart = Date.parse(b.scheduled_start_at);
      const bEnd = bStart + b.duration_minutes * 60_000;
      return startMs < bEnd && endMs > bStart;
    });
    if (overlap) {
      return { ok: false, error: `${st.name} already has a conflicting booking in that slot` };
    }
  }

  for (const stId of uniqueIds) {
    const st = state.stations.find((s) => s.id === stId)!;
    const id = uid('bkg');
    const code = `BKG-${Math.floor(100 + Math.random() * 900)}`;
    state.bookings.push({
      id,
      booking_code: code,
      group_booking_id: groupBookingId,
      station_id: stId,
      customer_id: null,
      customer_name: 'Reserved Slot',
      customer_phone: null,
      scheduled_start_at: new Date(startMs).toISOString(),
      duration_minutes: input.durationMinutes,
      status: 'confirmed',
      notes: input.notes?.trim() || null,
      created_by: 'stf_admin',
      created_at: nowIso,
      updated_at: nowIso,
    });
    appendLog(state, 'booking_created', 'booking', id, `Reserved ${st.name} (${code})`);
  }

  saveDemoState(state);
  return { ok: true };
}

export function updateBookingStatus(id: string, status: BookingStatus): void {
  const state = loadDemoState();
  const b = state.bookings.find((x) => x.id === id);
  if (!b) return;
  b.status = status;
  b.updated_at = new Date().toISOString();
  appendLog(state, `booking_${status}`, 'booking', id, `Marked booking ${b.booking_code} as ${status}`);
  saveDemoState(state);
}

export function listMaintenance(): MaintenanceRecord[] {
  const state = loadDemoState();
  return [...state.maintenanceRecords]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((m) => {
      const st = state.stations.find((s) => s.id === m.station_id);
      const cat = st ? state.categories.find((c) => c.id === st.category_id) : null;
      return {
        ...m,
        station_name: st?.name || '',
        category_name: cat?.name || '',
        recorded_by_name: 'Owner',
      };
    });
}

export function createMaintenance(input: {
  stationId: string;
  issueTitle: string;
  description?: string | null;
  cost: number;
  technician?: string | null;
  setStationMaintenance: boolean;
}): { ok: boolean; error?: string } {
  const state = loadDemoState();
  const st = state.stations.find((s) => s.id === input.stationId);
  if (!st) return { ok: false, error: 'Station not found' };
  if (input.setStationMaintenance && st.status === 'occupied') {
    return { ok: false, error: `Cannot place ${st.name} under maintenance while a session is running` };
  }
  const nowIso = new Date().toISOString();
  const id = uid('mnt');
  state.maintenanceRecords.unshift({
    id,
    station_id: st.id,
    issue_title: input.issueTitle.trim(),
    description: input.description?.trim() || null,
    status: 'open',
    cost: input.cost,
    technician: input.technician?.trim() || null,
    started_at: nowIso,
    completed_at: null,
    recorded_by: 'stf_admin',
    created_at: nowIso,
  });
  if (input.setStationMaintenance) {
    st.status = 'maintenance';
    st.updated_at = nowIso;
  }
  appendLog(state, 'maintenance_logged', 'maintenance_record', id, `Logged maintenance for ${st.name}: ${input.issueTitle.trim()}`);
  saveDemoState(state);
  return { ok: true };
}

export function completeMaintenance(id: string): void {
  const state = loadDemoState();
  const rec = state.maintenanceRecords.find((m) => m.id === id);
  if (!rec) return;
  const nowIso = new Date().toISOString();
  rec.status = 'completed';
  rec.completed_at = nowIso;
  const st = state.stations.find((s) => s.id === rec.station_id);
  if (st && st.status === 'maintenance') {
    st.status = 'available';
    st.updated_at = nowIso;
  }
  saveDemoState(state);
}

export function computeAnalytics(
  preset: 'today' | 'yesterday' | '7d' | '30d' | 'custom',
  from?: string,
  to?: string
) {
  const state = loadDemoState();
  const nowMs = Date.now();
  const todayKey = getISTDateKey(nowMs);
  const todayBounds = getISTDayBoundsUTC(todayKey);
  const weekBounds = getDateRangeBoundsUTC('7d', null, null, nowMs);
  const monthBounds = getDateRangeBoundsUTC('30d', null, null, nowMs);
  const activeRange = getDateRangeBoundsUTC(preset, from, to, nowMs);

  const sumPay = (startIso?: string, endIso?: string) =>
    Math.round(
      state.payments
        .filter(
          (p) =>
            p.status === 'completed' &&
            (!startIso || p.paid_at >= startIso) &&
            (!endIso || p.paid_at <= endIso)
        )
        .reduce((acc, p) => acc + p.amount, 0)
    );

  const completedInRange = state.sessions.filter(
    (s) =>
      s.status === 'completed' &&
      s.started_at >= activeRange.startIso &&
      s.started_at <= activeRange.endIso
  );
  const totalMinutes = completedInRange.reduce((acc, s) => acc + s.billable_minutes, 0);
  const avgMinutes =
    completedInRange.length > 0 ? Math.round(totalMinutes / completedInRange.length) : 0;

  const pendingSessions = state.sessions.filter(
    (s) => s.status === 'completed' && (s.payment_status === 'unpaid' || s.payment_status === 'partial')
  );
  const pendingAmount = Math.round(
    pendingSessions.reduce((acc, s) => acc + Math.max(0, s.final_amount - s.paid_amount), 0)
  );

  const sessionMap = new Map(state.sessions.map((s) => [s.id, s]));
  const stationMap = new Map(state.stations.map((s) => [s.id, s]));

  const revenueByCategory = state.categories
    .map((cat) => {
      const catStationIds = new Set(
        state.stations.filter((s) => s.category_id === cat.id).map((s) => s.id)
      );
      const revenue = Math.round(
        state.payments
          .filter((p) => {
            if (p.status !== 'completed') return false;
            if (p.paid_at < activeRange.startIso || p.paid_at > activeRange.endIso) return false;
            const ses = sessionMap.get(p.session_id);
            return ses ? catStationIds.has(ses.station_id) : false;
          })
          .reduce((acc, p) => acc + p.amount, 0)
      );
      const sessions = completedInRange.filter((s) => catStationIds.has(s.station_id)).length;
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        revenue,
        sessions,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const revenueByStation = state.stations
    .map((st) => {
      const cat = state.categories.find((c) => c.id === st.category_id);
      const revenue = Math.round(
        state.payments
          .filter((p) => {
            if (p.status !== 'completed') return false;
            if (p.paid_at < activeRange.startIso || p.paid_at > activeRange.endIso) return false;
            const ses = sessionMap.get(p.session_id);
            return ses?.station_id === st.id;
          })
          .reduce((acc, p) => acc + p.amount, 0)
      );
      const stSessions = completedInRange.filter((s) => s.station_id === st.id);
      const hours = Number(
        (stSessions.reduce((acc, s) => acc + s.billable_minutes, 0) / 60).toFixed(1)
      );
      return {
        stationId: st.id,
        stationName: st.name,
        categoryName: cat?.name || '',
        revenue,
        sessions: stSessions.length,
        hours,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const dailySeries = Array.from({ length: 14 }, (_, idx) => {
    const key = addDaysToISTDateKey(todayKey, idx - 13);
    const bounds = getISTDayBoundsUTC(key);
    return {
      label: key.slice(5),
      revenue: sumPay(bounds.startIso, bounds.endIso),
    };
  });

  const weeklySeries = [3, 2, 1, 0].map((weeksAgo) => {
    const endKey = addDaysToISTDateKey(todayKey, -weeksAgo * 7);
    const startKey = addDaysToISTDateKey(endKey, -6);
    return {
      label: `${startKey.slice(5)}..${endKey.slice(5)}`,
      revenue: sumPay(
        getISTDayBoundsUTC(startKey).startIso,
        getISTDayBoundsUTC(endKey).endIso
      ),
    };
  });

  const monthlyMap = new Map<string, number>();
  for (const p of state.payments) {
    if (p.status !== 'completed') continue;
    const mk = getISTDateKey(p.paid_at).slice(0, 7);
    monthlyMap.set(mk, (monthlyMap.get(mk) || 0) + Math.round(p.amount));
  }
  const monthlySeries = Array.from(monthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)
    .map(([label, revenue]) => ({ label, revenue }));

  const hourBuckets = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, '0')}:00`,
    sessions: 0,
  }));
  for (const s of state.sessions) {
    if (
      s.status !== 'cancelled' &&
      s.started_at >= activeRange.startIso &&
      s.started_at <= activeRange.endIso
    ) {
      const h = getISTHour(s.started_at);
      if (hourBuckets[h]) hourBuckets[h].sessions += 1;
    }
  }

  return {
    summary: {
      todayRevenue: sumPay(todayBounds.startIso, todayBounds.endIso),
      weeklyRevenue: sumPay(weekBounds.startIso, weekBounds.endIso),
      monthlyRevenue: sumPay(monthBounds.startIso, monthBounds.endIso),
      totalRevenue: sumPay(),
      rangeRevenue: sumPay(activeRange.startIso, activeRange.endIso),
      pendingPaymentsCount: pendingSessions.length,
      pendingPaymentsAmount: pendingAmount,
      totalCustomers: 0,
      totalSessions: completedInRange.length,
      totalGamingHours: Number((totalMinutes / 60).toFixed(1)),
      avgSessionDurationMinutes: avgMinutes,
      mostPopularGame:
        [...revenueByCategory].sort((a, b) => b.sessions - a.sessions)[0]?.categoryName || '—',
      mostProfitableStation:
        revenueByStation[0]?.revenue > 0 ? revenueByStation[0].stationName : '—',
    },
    revenueByCategory,
    revenueByStation,
    dailySeries,
    weeklySeries,
    monthlySeries,
    peakHours: hourBuckets.filter((b) => b.hour >= 9 && b.hour <= 23),
  };
  void stationMap;
}

export function computeDailyClosing(dateKey: string) {
  const state = loadDemoState();
  const { startIso, endIso } = getISTDayBoundsUTC(dateKey);

  const payments = state.payments
    .filter((p) => p.status === 'completed' && p.paid_at >= startIso && p.paid_at <= endIso)
    .sort((a, b) => b.paid_at.localeCompare(a.paid_at))
    .map((p) => {
      const ses = state.sessions.find((s) => s.id === p.session_id);
      const st = ses ? state.stations.find((x) => x.id === ses.station_id) : null;
      return {
        ...p,
        session_code: ses?.session_code || '',
        station_name: st?.name || '',
      };
    });

  let cashReceived = 0;
  let upiReceived = 0;
  let cardReceived = 0;
  let otherReceived = 0;
  for (const p of payments) {
    if (p.method === 'cash') cashReceived += p.amount;
    else if (p.method === 'upi') upiReceived += p.amount;
    else if (p.method === 'card') cardReceived += p.amount;
    else otherReceived += p.amount;
  }
  const totalCollected = Math.round(cashReceived + upiReceived + cardReceived + otherReceived);

  const completedToday = state.sessions.filter(
    (s) => s.status === 'completed' && s.ended_at && s.ended_at >= startIso && s.ended_at <= endIso
  );
  const pendingToday = completedToday.filter(
    (s) => s.payment_status === 'unpaid' || s.payment_status === 'partial'
  );

  return {
    date: dateKey,
    cashReceived: Math.round(cashReceived),
    upiReceived: Math.round(upiReceived),
    cardReceived: Math.round(cardReceived),
    otherReceived: Math.round(otherReceived),
    totalCollected,
    pendingPaymentsAmount: Math.round(
      pendingToday.reduce((sum, s) => sum + Math.max(0, s.final_amount - s.paid_amount), 0)
    ),
    pendingPaymentsCount: pendingToday.length,
    totalSessions: completedToday.length,
    totalGamingHours: Number(
      (completedToday.reduce((sum, s) => sum + s.billable_minutes, 0) / 60).toFixed(2)
    ),
    totalDiscounts: Math.round(
      completedToday.reduce((sum, s) => sum + s.discount_amount, 0)
    ),
    netRevenue: totalCollected,
    payments,
  };
}

export function downloadCsvFile(
  type: 'sessions' | 'payments' | 'revenue',
  filters?: {
    preset?: string;
    from?: string;
    to?: string;
    categoryId?: string;
    stationId?: string;
    paymentStatus?: string;
    search?: string;
  }
): void {
  if (typeof window === 'undefined') return;
  const state = loadDemoState();
  let csv = '';
  const filename = `gamezone-${type}.csv`;

  if (type === 'sessions') {
    const rows = listFilteredSessions(filters || {});
    csv = buildCsv(
      [
        'Session Code',
        'Category',
        'Station',
        'Billing Mode',
        'Status',
        'Started At (IST)',
        'Ended At (IST)',
        'Paused Seconds',
        'Billable Minutes',
        'Base Amount',
        'Add-On Charges',
        'Discount',
        'Final Amount',
        'Paid Amount',
        'Payment Status',
      ],
      rows.map((s) => [
        s.session_code,
        s.category_name || '',
        s.station_name || '',
        s.billing_mode,
        s.status,
        formatISTDateTime(s.started_at),
        formatISTDateTime(s.ended_at),
        s.accumulated_paused_seconds,
        s.billable_minutes,
        s.base_amount,
        s.additional_charges,
        s.discount_amount,
        s.final_amount,
        s.paid_amount,
        s.payment_status,
      ])
    );
  } else if (type === 'payments') {
    const rows = [...state.payments].sort((a, b) => b.paid_at.localeCompare(a.paid_at));
    csv = buildCsv(
      ['Receipt Number', 'Session Code', 'Station', 'Amount (INR)', 'Method', 'Status', 'Paid At (IST)'],
      rows.map((p) => {
        const ses = state.sessions.find((s) => s.id === p.session_id);
        const st = ses ? state.stations.find((x) => x.id === ses.station_id) : null;
        return [
          p.receipt_number,
          ses?.session_code || '',
          st?.name || '',
          p.amount,
          p.method.toUpperCase(),
          p.status,
          formatISTDateTime(p.paid_at),
        ];
      })
    );
  } else {
    const analytics = computeAnalytics('30d');
    csv = buildCsv(
      ['Station', 'Category', 'Completed Sessions', 'Gaming Hours', 'Collected Revenue (INR)'],
      analytics.revenueByStation.map((r) => [
        r.stationName,
        r.categoryName,
        r.sessions,
        r.hours,
        r.revenue,
      ])
    );
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
