import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { DatabaseSync as DatabaseSyncType } from 'node:sqlite';
import { getISTDateKey } from './timezone';

type SqliteModule = typeof import('node:sqlite');

function loadSqlite(): SqliteModule {
  const proc = process as unknown as {
    getBuiltinModule?: (id: string) => SqliteModule;
  };
  if (typeof proc.getBuiltinModule === 'function') {
    return proc.getBuiltinModule('node:sqlite');
  }
  // Fallback for environments without getBuiltinModule
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('node:sqlite') as SqliteModule;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, hashHex] = storedHash.split(':');
  if (!salt || !hashHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hashHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function toPlain<T>(row: T | undefined | null): T | null {
  if (!row || typeof row !== 'object') return null;
  return { ...(row as Record<string, unknown>) } as T;
}

export function toPlainAll<T>(rows: T[]): T[] {
  return rows.map((r) => ({ ...(r as Record<string, unknown>) }) as T);
}

const globalForDb = globalThis as unknown as {
  __gamezoneDb?: DatabaseSyncType;
  __gamezoneDbInitialized?: boolean;
};

function getDbPath(): string {
  return process.env.GAMEZONE_DB_PATH || path.join(process.cwd(), 'data', 'gamezone.db');
}

export function getDb(): DatabaseSyncType {
  if (!globalForDb.__gamezoneDb) {
    const dbPath = getDbPath();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    const { DatabaseSync } = loadSqlite();
    const db = new DatabaseSync(dbPath);
    db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
    `);
    globalForDb.__gamezoneDb = db;
  }

  if (!globalForDb.__gamezoneDbInitialized) {
    initializeSchema(globalForDb.__gamezoneDb);
    seedIfEmpty(globalForDb.__gamezoneDb);
    globalForDb.__gamezoneDbInitialized = true;
  }

  return globalForDb.__gamezoneDb;
}

export function withTransaction<T>(fn: (db: DatabaseSyncType) => T): T {
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn(db);
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw err;
  }
}

function initializeSchema(db: DatabaseSyncType): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS staff (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'staff')),
      phone TEXT,
      pin_code TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS game_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      icon TEXT NOT NULL DEFAULT 'gamepad',
      description TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS gaming_stations (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES game_categories(id) ON DELETE RESTRICT,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'maintenance', 'disabled')),
      equipment_model TEXT,
      purchase_date TEXT,
      purchase_cost REAL,
      notes TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pricing_rules (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES game_categories(id) ON DELETE CASCADE,
      station_id TEXT REFERENCES gaming_stations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      rate_30min REAL NOT NULL CHECK (rate_30min >= 0),
      rate_60min REAL NOT NULL CHECK (rate_60min >= 0),
      custom_hourly_rate REAL,
      default_billing_mode TEXT NOT NULL DEFAULT 'fixed' CHECK (default_billing_mode IN ('fixed', 'pay_as_you_play')),
      billing_increment_minutes INTEGER NOT NULL DEFAULT 30 CHECK (billing_increment_minutes IN (15, 30, 60)),
      offer_label TEXT,
      offer_discount_percent REAL NOT NULL DEFAULT 0 CHECK (offer_discount_percent >= 0 AND offer_discount_percent <= 100),
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      notes TEXT,
      total_visits INTEGER NOT NULL DEFAULT 0,
      total_spent REAL NOT NULL DEFAULT 0,
      last_visit_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      session_code TEXT NOT NULL UNIQUE,
      group_booking_id TEXT,
      station_id TEXT NOT NULL REFERENCES gaming_stations(id) ON DELETE RESTRICT,
      customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
      customer_name TEXT,
      status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
      billing_mode TEXT NOT NULL CHECK (billing_mode IN ('fixed', 'pay_as_you_play')),
      billing_increment_minutes INTEGER NOT NULL DEFAULT 30 CHECK (billing_increment_minutes IN (15, 30, 60)),
      rate_30min REAL NOT NULL,
      rate_60min REAL NOT NULL,
      offer_discount_percent REAL NOT NULL DEFAULT 0,
      planned_duration_minutes INTEGER,
      started_at TEXT NOT NULL,
      expected_end_at TEXT,
      ended_at TEXT,
      paused_at TEXT,
      accumulated_paused_seconds INTEGER NOT NULL DEFAULT 0,
      billable_minutes INTEGER NOT NULL DEFAULT 0,
      base_amount REAL NOT NULL DEFAULT 0,
      additional_charges REAL NOT NULL DEFAULT 0,
      discount_amount REAL NOT NULL DEFAULT 0,
      discount_reason TEXT,
      discount_authorized_by TEXT REFERENCES staff(id) ON DELETE SET NULL,
      final_amount REAL NOT NULL DEFAULT 0,
      paid_amount REAL NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
      notes TEXT,
      cancel_reason TEXT,
      started_by TEXT NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
      ended_by TEXT REFERENCES staff(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_session_per_station
      ON sessions(station_id)
      WHERE status IN ('active', 'paused');

    CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    CREATE INDEX IF NOT EXISTS idx_sessions_customer_id ON sessions(customer_id);

    CREATE TABLE IF NOT EXISTS session_events (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      payload_json TEXT,
      actor_staff_id TEXT REFERENCES staff(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_session_events_session_id ON session_events(session_id, created_at);

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      receipt_number TEXT NOT NULL UNIQUE,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
      amount REAL NOT NULL CHECK (amount >= 0),
      method TEXT NOT NULL CHECK (method IN ('cash', 'upi', 'card', 'other')),
      status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'refunded')),
      reference_note TEXT,
      received_by TEXT NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
      paid_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at DESC);
    CREATE INDEX IF NOT EXISTS idx_payments_session_id ON payments(session_id);

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      booking_code TEXT NOT NULL UNIQUE,
      group_booking_id TEXT,
      station_id TEXT NOT NULL REFERENCES gaming_stations(id) ON DELETE CASCADE,
      customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      scheduled_start_at TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
      status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'checked_in', 'cancelled', 'completed')),
      notes TEXT,
      created_by TEXT NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_bookings_scheduled_start ON bookings(scheduled_start_at);

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL CHECK (amount >= 0),
      payment_method TEXT NOT NULL DEFAULT 'cash',
      expense_date TEXT NOT NULL,
      notes TEXT,
      recorded_by TEXT NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS maintenance_records (
      id TEXT PRIMARY KEY,
      station_id TEXT NOT NULL REFERENCES gaming_stations(id) ON DELETE CASCADE,
      issue_title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed')),
      cost REAL NOT NULL DEFAULT 0,
      technician TEXT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      recorded_by TEXT NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      actor_staff_id TEXT REFERENCES staff(id) ON DELETE SET NULL,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      summary TEXT NOT NULL,
      metadata_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

function seedIfEmpty(db: DatabaseSyncType): void {
  const existing = db.prepare('SELECT COUNT(*) AS cnt FROM users').get() as { cnt: number };
  if (existing.cnt > 0) return;

  const now = new Date();
  const nowIso = now.toISOString();
  const minsAgo = (m: number) => new Date(now.getTime() - m * 60_000).toISOString();
  const minsFromNow = (m: number) => new Date(now.getTime() + m * 60_000).toISOString();
  const todayIST = getISTDateKey(now);

  db.exec('BEGIN IMMEDIATE');
  try {
    // 1. Users & Staff
    const insertUser = db.prepare(
      'INSERT INTO users (id, email, password_hash, full_name, is_active, created_at) VALUES (?, ?, ?, ?, 1, ?)'
    );
    const insertStaff = db.prepare(
      'INSERT INTO staff (id, user_id, role, phone, pin_code, is_active, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
    );

    insertUser.run('usr_admin', 'admin@gamezone.in', hashPassword('admin123'), 'Arjun Mehta', nowIso);
    insertStaff.run('stf_admin', 'usr_admin', 'admin', '+91 98201 11223', '1234', nowIso);

    insertUser.run('usr_manager', 'manager@gamezone.in', hashPassword('manager123'), 'Priya Nair', nowIso);
    insertStaff.run('stf_manager', 'usr_manager', 'manager', '+91 98201 44556', '2468', nowIso);

    insertUser.run('usr_staff', 'staff@gamezone.in', hashPassword('staff123'), 'Rohan Verma', nowIso);
    insertStaff.run('stf_staff', 'usr_staff', 'staff', '+91 98201 77889', null, nowIso);

    // 2. Game Categories
    const insertCat = db.prepare(
      'INSERT INTO game_categories (id, name, slug, icon, description, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    insertCat.run('cat_pool', 'Pool Tables', 'pool-tables', 'circle-dot', 'Tournament-grade 8-ball & snooker tables', 1, nowIso);
    insertCat.run('cat_tt', 'Table Tennis', 'table-tennis', 'disc', 'ITTF approved indoor table tennis arenas', 2, nowIso);
    insertCat.run('cat_ps', 'PlayStation', 'playstation', 'gamepad-2', '4K HDR PS4 & PS5 lounge stations', 3, nowIso);

    // 3. Gaming Stations (9 realistic stations matching prompt)
    const insertStation = db.prepare(
      `INSERT INTO gaming_stations (id, category_id, name, code, status, equipment_model, purchase_date, purchase_cost, notes, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    insertStation.run('stn_pool_1', 'cat_pool', 'Pool Table 01', 'PL-01', 'occupied', 'Wiraka M1 8ft Slate', '2025-04-12', 95000, 'Main Championship Bay', 1, nowIso, nowIso);
    insertStation.run('stn_pool_2', 'cat_pool', 'Pool Table 02', 'PL-02', 'available', 'Wiraka M1 8ft Slate', '2025-04-12', 95000, 'Near front lounge', 2, nowIso, nowIso);
    insertStation.run('stn_pool_3', 'cat_pool', 'Pool Table 03', 'PL-03', 'available', 'Rasson Victory II', '2025-08-20', 115000, 'Corner VIP bay', 3, nowIso, nowIso);

    insertStation.run('stn_tt_1', 'cat_tt', 'Table Tennis 01', 'TT-01', 'available', 'Stag 1000DX 25mm', '2025-05-03', 32000, 'Pro court mat', 4, nowIso, nowIso);
    insertStation.run('stn_tt_2', 'cat_tt', 'Table Tennis 02', 'TT-02', 'available', 'Stag 1000DX 25mm', '2025-05-03', 32000, 'Includes 4 paddles', 5, nowIso, nowIso);

    insertStation.run('stn_ps4_1', 'cat_ps', 'PS4 Station 01', 'PS4-01', 'available', 'PS4 Pro + 55" 4K TV', '2024-11-10', 62000, '2 DualShock 4 controllers', 6, nowIso, nowIso);
    insertStation.run('stn_ps4_2', 'cat_ps', 'PS4 Station 02', 'PS4-02', 'available', 'PS4 Slim + 50" 4K TV', '2024-11-10', 54000, '2 DualShock 4 controllers', 7, nowIso, nowIso);
    insertStation.run('stn_ps5_1', 'cat_ps', 'PS5 Station 01', 'PS5-01', 'occupied', 'PS5 Disc + 65" OLED', '2025-06-18', 118000, 'DualSense Edge ready', 8, nowIso, nowIso);
    insertStation.run('stn_ps5_2', 'cat_ps', 'PS5 Station 02', 'PS5-02', 'available', 'PS5 Disc + 65" OLED', '2025-06-18', 118000, 'FC 26 & Tekken 8 installed', 9, nowIso, nowIso);

    // 4. Pricing Rules
    const insertRule = db.prepare(
      `INSERT INTO pricing_rules (id, category_id, station_id, name, rate_30min, rate_60min, custom_hourly_rate, default_billing_mode, billing_increment_minutes, offer_label, offer_discount_percent, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    );
    insertRule.run('prc_pool', 'cat_pool', null, 'Pool Table Standard Rate', 100, 200, 200, 'fixed', 30, null, 0, nowIso, nowIso);
    insertRule.run('prc_tt', 'cat_tt', null, 'Table Tennis Standard Rate', 80, 160, 160, 'fixed', 30, null, 0, nowIso, nowIso);
    insertRule.run('prc_ps4', 'cat_ps', null, 'PlayStation 4 Standard Rate', 60, 120, 120, 'fixed', 30, null, 0, nowIso, nowIso);
    insertRule.run('prc_ps5_1', 'cat_ps', 'stn_ps5_1', 'PS5 Station 01 Premium Rate', 100, 200, 200, 'fixed', 30, null, 0, nowIso, nowIso);
    insertRule.run('prc_ps5_2', 'cat_ps', 'stn_ps5_2', 'PS5 Station 02 Premium Rate', 100, 200, 200, 'fixed', 30, null, 0, nowIso, nowIso);

    // 5. Customers
    const insertCust = db.prepare(
      `INSERT INTO customers (id, name, phone, notes, total_visits, total_spent, last_visit_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insertCust.run('cust_1', 'Kabir Sharma', '9820451120', 'Regular pool player, prefers Table 01', 12, 3400, minsAgo(24), nowIso, nowIso);
    insertCust.run('cust_2', 'Ananya Patel', '9819223344', 'Weekend PS5 FIFA group', 8, 2240, minsAgo(22), nowIso, nowIso);
    insertCust.run('cust_3', 'Vikram Joshi', '9765401199', 'Table Tennis league member', 15, 2960, minsAgo(180), nowIso, nowIso);
    insertCust.run('cust_4', 'Devansh Kulkarni', '9930118877', 'Prefers UPI checkout', 4, 720, minsAgo(320), nowIso, nowIso);
    insertCust.run('cust_5', 'Siddharth Rao', '9867004411', null, 2, 420, minsAgo(1440), nowIso, nowIso);

    // 6. Historical Completed Sessions + 1 Pending Unpaid + 2 Live Running Sessions
    const insertSession = db.prepare(
      `INSERT INTO sessions (
        id, session_code, group_booking_id, station_id, customer_id, customer_name,
        status, billing_mode, billing_increment_minutes, rate_30min, rate_60min, offer_discount_percent,
        planned_duration_minutes, started_at, expected_end_at, ended_at, paused_at, accumulated_paused_seconds,
        billable_minutes, base_amount, additional_charges, discount_amount, discount_reason, discount_authorized_by,
        final_amount, paid_amount, payment_status, notes, cancel_reason, started_by, ended_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const insertEvent = db.prepare(
      'INSERT INTO session_events (id, session_id, event_type, payload_json, actor_staff_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const insertPayment = db.prepare(
      `INSERT INTO payments (id, receipt_number, session_id, customer_id, amount, method, status, reference_note, received_by, paid_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?)`
    );

    // Completed session 1 (today, TT-01, UPI)
    insertSession.run(
      'ses_hist_1', 'SES-1001', null, 'stn_tt_1', 'cust_3', 'Vikram Joshi',
      'completed', 'fixed', 30, 80, 160, 0,
      60, minsAgo(240), minsAgo(180), minsAgo(180), null, 0,
      60, 160, 0, 0, null, null,
      160, 160, 'paid', 'League practice', null, 'stf_staff', 'stf_staff', minsAgo(240), minsAgo(180)
    );
    insertPayment.run('pay_1', 'RCP-2026-1001', 'ses_hist_1', 'cust_3', 160, 'upi', 'GPay verified', 'stf_staff', minsAgo(180), minsAgo(180));

    // Completed session 2 (today, PS4-01, Cash)
    insertSession.run(
      'ses_hist_2', 'SES-1002', null, 'stn_ps4_1', 'cust_4', 'Devansh Kulkarni',
      'completed', 'fixed', 30, 60, 120, 0,
      90, minsAgo(390), minsAgo(300), minsAgo(300), null, 0,
      90, 180, 20, 0, null, null,
      200, 200, 'paid', 'Includes 1 cold drink add-on', null, 'stf_staff', 'stf_manager', minsAgo(390), minsAgo(300)
    );
    insertPayment.run('pay_2', 'RCP-2026-1002', 'ses_hist_2', 'cust_4', 200, 'cash', 'Cash drawer', 'stf_manager', minsAgo(300), minsAgo(300));

    // Completed session 3 (today, Pool Table 02, Unpaid pending settlement!)
    insertSession.run(
      'ses_hist_3', 'SES-1003', null, 'stn_pool_2', 'cust_1', 'Kabir Sharma',
      'completed', 'fixed', 30, 100, 200, 0,
      60, minsAgo(150), minsAgo(90), minsAgo(90), null, 0,
      60, 200, 0, 0, null, null,
      200, 0, 'unpaid', 'Customer stepped out for ATM — pending settlement', null, 'stf_staff', 'stf_staff', minsAgo(150), minsAgo(90)
    );

    // Completed session 4 (yesterday, PS5-02, Card)
    insertSession.run(
      'ses_hist_4', 'SES-1004', null, 'stn_ps5_2', 'cust_5', 'Siddharth Rao',
      'completed', 'fixed', 30, 100, 200, 0,
      120, minsAgo(1560), minsAgo(1440), minsAgo(1440), null, 0,
      120, 400, 0, 40, 'Member loyalty discount', 'stf_manager',
      360, 360, 'paid', '2-hour FIFA tournament match', null, 'stf_admin', 'stf_manager', minsAgo(1560), minsAgo(1440)
    );
    insertPayment.run('pay_3', 'RCP-2026-1003', 'ses_hist_4', 'cust_5', 360, 'card', 'POS terminal #1', 'stf_manager', minsAgo(1440), minsAgo(1440));

    // Active Live Session 1: Pool Table 01 running for 24 minutes of 60 minutes
    insertSession.run(
      'ses_live_1', 'SES-1005', null, 'stn_pool_1', 'cust_1', 'Kabir Sharma',
      'active', 'fixed', 30, 100, 200, 0,
      60, minsAgo(24), minsFromNow(36), null, null, 0,
      0, 200, 0, 0, null, null,
      200, 0, 'unpaid', '2 players', null, 'stf_staff', null, minsAgo(24), minsAgo(24)
    );
    insertEvent.run('evt_live_1', 'ses_live_1', 'started', JSON.stringify({ durationMinutes: 60, billingMode: 'fixed' }), 'stf_staff', minsAgo(24));

    // Active Live Session 2: PS5 Station 01 running for 22 minutes of 30 minutes (8 mins left -> triggers Orange Ending Soon warning!)
    insertSession.run(
      'ses_live_2', 'SES-1006', null, 'stn_ps5_1', 'cust_2', 'Ananya Patel',
      'active', 'fixed', 30, 100, 200, 0,
      30, minsAgo(22), minsFromNow(8), null, null, 0,
      0, 100, 0, 0, null, null,
      100, 0, 'unpaid', 'FC 26 Co-op', null, 'stf_staff', null, minsAgo(22), minsAgo(22)
    );
    insertEvent.run('evt_live_2', 'ses_live_2', 'started', JSON.stringify({ durationMinutes: 30, billingMode: 'fixed' }), 'stf_staff', minsAgo(22));

    // 7. Advance Booking
    db.prepare(
      `INSERT INTO bookings (id, booking_code, group_booking_id, station_id, customer_id, customer_name, customer_phone, scheduled_start_at, duration_minutes, status, notes, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?, ?)`
    ).run(
      'bkg_1', 'BKG-401', null, 'stn_ps5_2', 'cust_2', 'Ananya Patel', '9819223344',
      minsFromNow(90), 120, 'Weekend squad reservation (4 controllers)', 'stf_manager', nowIso, nowIso
    );

    // 8. Operational Expenses
    const insertExp = db.prepare(
      'INSERT INTO expenses (id, category, description, amount, payment_method, expense_date, notes, recorded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    insertExp.run('exp_1', 'Refreshments', 'Cold drinks & bottled water restock', 650, 'cash', todayIST, '2 crates delivered', 'stf_manager', minsAgo(200));
    insertExp.run('exp_2', 'Maintenance', 'Pool cue chalk & tip replacement kit', 480, 'upi', todayIST, '12 blue chalk cubes', 'stf_admin', minsAgo(310));

    // 9. Maintenance History
    db.prepare(
      `INSERT INTO maintenance_records (id, station_id, issue_title, description, status, cost, technician, started_at, completed_at, recorded_by, created_at)
       VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?)`
    ).run(
      'mnt_1', 'stn_pool_3', 'Cloth brushing & pocket alignment', 'Routine slate leveling and felt brush',
      450, 'Suresh (Table Tech)', minsAgo(1400), minsAgo(1300), 'stf_admin', minsAgo(1400)
    );

    // 10. Activity Logs
    const insertLog = db.prepare(
      'INSERT INTO activity_logs (id, actor_staff_id, actor_name, actor_role, action, entity_type, entity_id, summary, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    insertLog.run('log_1', 'stf_staff', 'Rohan Verma', 'staff', 'session_started', 'session', 'ses_live_1', 'Started 60m session on Pool Table 01 for Kabir Sharma', null, minsAgo(24));
    insertLog.run('log_2', 'stf_staff', 'Rohan Verma', 'staff', 'session_started', 'session', 'ses_live_2', 'Started 30m session on PS5 Station 01 for Ananya Patel', null, minsAgo(22));
    insertLog.run('log_3', 'stf_manager', 'Priya Nair', 'manager', 'payment_recorded', 'payment', 'pay_2', 'Collected ₹200 (Cash) for PS4 Station 01 (SES-1002)', null, minsAgo(300));
    insertLog.run('log_4', 'stf_staff', 'Rohan Verma', 'staff', 'payment_recorded', 'payment', 'pay_1', 'Collected ₹160 (UPI) for Table Tennis 01 (SES-1001)', null, minsAgo(180));

    // 11. Settings
    const insertSetting = db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)');
    const defaultSettings: Record<string, string> = {
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
      receipt_footer: 'Thank you for playing at Apex Arena! Follow @apexarena.in',
    };
    for (const [k, v] of Object.entries(defaultSettings)) {
      insertSetting.run(k, v, nowIso);
    }

    db.exec('COMMIT');
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // ignore
    }
    throw err;
  }
}
